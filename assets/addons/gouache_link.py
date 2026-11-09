# Gouache Studio link: lets Gouache Studio send models (with their textures) into this Blender, and (1.1) lets this
# Blender send models, high-polys, textures and the view back to Gouache Studio (3D view sidebar > Gouache tab).
# Install: Blender > Edit > Preferences > Add-ons > Install... (pick this file) and tick "Gouache Studio link".
# It listens on this computer only (127.0.0.1). Each send replaces the previous import of the same model,
# kept in a collection called "Gouache - <name>".
bl_info = {
    "name": "Gouache Studio link",
    "author": "Gouache Studio",
    "version": (1, 1, 0),
    "blender": (3, 0, 0),
    "location": "3D View > Sidebar > Gouache",
    "description": "Send models, textures and the view to Gouache Studio, and receive what it sends",
    "category": "Import-Export",
}

import json
import os
import queue
import tempfile
import time
import urllib.request
import socket
import threading

import bpy

PORT = 47650
_jobs = queue.Queue()
_server = {"sock": None, "thread": None, "run": False}


def _serve():
    s = _server["sock"]
    while _server["run"]:
        try:
            conn, _ = s.accept()
        except OSError:
            break
        try:
            conn.settimeout(3)
            data = b""
            while b"\r\n\r\n" not in data:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                data += chunk
            head, _, body = data.partition(b"\r\n\r\n")
            length = 0
            for line in head.split(b"\r\n"):
                if line.lower().startswith(b"content-length:"):
                    length = int(line.split(b":", 1)[1].strip() or 0)
            while len(body) < length:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                body += chunk
            path = body.decode("utf-8", "replace").strip()
            ok = head.startswith(b"POST /import") and os.path.isfile(path)
            if ok:
                _jobs.put(path)
            conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok" if ok
                         else b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
        except Exception:
            pass
        finally:
            conn.close()


def _import(path):
    name = os.path.splitext(os.path.basename(path))[0]
    coll_name = "Gouache - " + name
    coll = bpy.data.collections.get(coll_name)
    if coll is None:
        coll = bpy.data.collections.new(coll_name)
        bpy.context.scene.collection.children.link(coll)
    else:
        for ob in list(coll.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
    before = set(bpy.data.objects)
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".obj":
        if hasattr(bpy.ops.wm, "obj_import"):
            bpy.ops.wm.obj_import(filepath=path)
        else:
            bpy.ops.import_scene.obj(filepath=path)
    for ob in set(bpy.data.objects) - before:
        for c in list(ob.users_collection):
            c.objects.unlink(ob)
        coll.objects.link(ob)


def _poll():
    try:
        while True:
            _import(_jobs.get_nowait())
    except queue.Empty:
        pass
    except Exception as e:
        print("Gouache Studio link:", e)
    return 0.5


# ---------------------------------------------------------------- sending to Gouache Studio (1.1)
GOUACHE_PORT = 47660


def _post(msg):
    req = urllib.request.Request("http://127.0.0.1:%d/inbox" % GOUACHE_PORT, data=json.dumps(msg).encode("utf-8"),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=4) as r:
        return r.read() == b"ok"


def _outdir(name):
    d = os.path.join(tempfile.gettempdir(), "gouache_link", "%s_%d" % (bpy.path.clean_name(name or "model"), int(time.time() * 1000)))
    os.makedirs(d, exist_ok=True)
    return d


def _model_name(context):
    ob = context.active_object
    for c in (ob.users_collection if ob else []):
        if c.name.startswith("Gouache - "):
            return c.name[len("Gouache - "):]
    return ob.name if ob else "Model"


def _export_selected(context, name):
    if not context.selected_objects:
        raise RuntimeError("Select the object(s) to send first.")
    path = os.path.join(_outdir(name), bpy.path.clean_name(name) + ".glb")
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError:
        kw.pop("export_apply", None)
        bpy.ops.export_scene.gltf(**kw)
    return path


def _image_file(img, folder, tag):
    """A file on disk for this image: its own file when it has one, else a PNG copy."""
    src = bpy.path.abspath(img.filepath) if img.filepath else ""
    if src and os.path.isfile(src) and not img.packed_file and not img.is_dirty:
        return src
    out = os.path.join(folder, bpy.path.clean_name(img.name) + "_" + tag + ".png")
    cp = img.copy()
    try:
        cp.filepath_raw = out
        cp.file_format = "PNG"
        cp.save()
    finally:
        bpy.data.images.remove(cp)
    return out


def _image_behind(sock, depth=0):
    """The Image Texture node feeding a socket (through Normal Map, Separate Color, Displacement, Bump, ... nodes)."""
    if not sock or not sock.is_linked or depth > 6:
        return None, None
    n = sock.links[0].from_node
    if n.type == "TEX_IMAGE" and n.image:
        return n.image, None
    if n.type in ("SEPARATE_COLOR", "SEPRGB", "SEPARATE_RGB"):
        img, _ = _image_behind(n.inputs[0], depth + 1)
        return img, sock.links[0].from_socket.name
    for i in n.inputs:
        if i.is_linked and i.type in ("RGBA", "VECTOR", "VALUE"):
            img, ch = _image_behind(i, depth + 1)
            if img:
                return img, ch
    return None, None


def _textures(context, folder):
    ob = context.active_object
    mat = ob.active_material if ob else None
    if not mat or not mat.use_nodes:
        raise RuntimeError("The active object has no node material with textures.")
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    out = next((n for n in mat.node_tree.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None)
    found = {}
    if bsdf:
        for key, names in (("base", ["Base Color"]), ("rough", ["Roughness"]), ("metal", ["Metallic"]), ("normal", ["Normal"]),
                           ("emis", ["Emission Color", "Emission"]), ("opac", ["Alpha"])):
            for nm in names:
                if nm in bsdf.inputs:
                    img, ch = _image_behind(bsdf.inputs[nm])
                    if img:
                        found[key] = (img, ch)
                        break
    if out and "Displacement" in out.inputs:
        img, ch = _image_behind(out.inputs["Displacement"])
        if img:
            found["height"] = (img, ch)
    tex = {}
    # roughness and metallic packed in one picture (glTF style: G = roughness, B = metallic, R = occlusion)
    r, m = found.get("rough"), found.get("metal")
    if r and m and r[0] == m[0] and r[1] and m[1]:
        tex["arm"] = _image_file(r[0], folder, "ARM")
        found.pop("rough")
        found.pop("metal")
    for key, (img, ch) in found.items():
        tex[key] = _image_file(img, folder, key)
    if not tex:
        raise RuntimeError("No image textures were found on the material “%s”." % mat.name)
    return mat.name, tex


def _view(context):
    rv = context.region_data
    sd = context.space_data
    reg = context.region
    if rv is None:
        raise RuntimeError("Use this from the 3D view.")
    if rv.view_perspective == "CAMERA" and context.scene.camera:
        cam = context.scene.camera
        eye = cam.matrix_world.translation
        fwd = cam.matrix_world.to_quaternion() @ __import__("mathutils").Vector((0, 0, -1))
        target = eye + fwd * 5.0
        fov = cam.data.angle_y * 57.29578 if cam.data.type == "PERSP" else 30.0
        return {"eye": list(eye), "target": list(target), "fov": fov, "ortho": cam.data.type == "ORTHO", "zup": True}
    inv = rv.view_matrix.inverted()
    eye = inv.translation
    target = rv.view_location
    import math
    w, h = max(1, reg.width), max(1, reg.height)
    hf = 2 * math.atan(36.0 / (2 * sd.lens))  # the wider side
    vf = hf if h >= w else 2 * math.atan(math.tan(hf / 2) * h / w)
    return {"eye": list(eye), "target": list(target), "fov": math.degrees(vf), "ortho": rv.view_perspective == "ORTHO", "zup": True}


class GOUACHE_OT_send(bpy.types.Operator):
    """Send to Gouache Studio (it must be running)"""
    bl_idname = "gouache.send"
    bl_label = "Send to Gouache"
    what: bpy.props.StringProperty(default="model")

    def execute(self, context):
        try:
            name = _model_name(context)
            msg = {"from": "blender", "kind": self.what, "name": name}
            if self.what in ("model", "high"):
                msg["file"] = _export_selected(context, name)
                if self.what == "model" and context.scene.gouache_with_textures:
                    try:
                        msg["textures"] = _textures(context, os.path.dirname(msg["file"]))[1]
                    except RuntimeError:
                        pass
            elif self.what == "material":
                mname, tex = _textures(context, _outdir(name))
                msg["name"] = mname
                msg["textures"] = tex
            elif self.what == "camera":
                msg["camera"] = _view(context)
            if not _post(msg):
                raise RuntimeError("Gouache Studio did not accept it.")
            self.report({"INFO"}, "Sent to Gouache Studio.")
            return {"FINISHED"}
        except urllib.error.URLError:
            self.report({"ERROR"}, "Gouache Studio isn't running (or is an older version without the link).")
        except Exception as e:
            self.report({"ERROR"}, "Gouache: " + str(e))
        return {"CANCELLED"}


class GOUACHE_PT_panel(bpy.types.Panel):
    bl_label = "Gouache Studio"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Gouache"

    def draw(self, context):
        col = self.layout.column(align=True)
        col.operator("gouache.send", text="Send model", icon="EXPORT").what = "model"
        col.prop(context.scene, "gouache_with_textures", text="With its textures")
        col.separator()
        col.operator("gouache.send", text="Send as high-poly (Bake)", icon="MESH_MONKEY").what = "high"
        col.operator("gouache.send", text="Send textures as a material", icon="MATERIAL").what = "material"
        col.operator("gouache.send", text="Match Gouache's view to this one", icon="VIEW_CAMERA").what = "camera"
        self.layout.label(text="Changed models keep your painting.")


_classes = (GOUACHE_OT_send, GOUACHE_PT_panel)


def register():
    for c in _classes:
        try:
            bpy.utils.register_class(c)
        except ValueError:
            pass
    if not hasattr(bpy.types.Scene, "gouache_with_textures"):
        bpy.types.Scene.gouache_with_textures = bpy.props.BoolProperty(name="With its textures", default=False,
                                                                       description="Also send the active material's textures as a material")
    if _server["run"]:
        return
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind(("127.0.0.1", PORT))
    except OSError as e:
        print("Gouache Studio link: port", PORT, "is busy:", e)
        return
    s.listen(4)
    _server.update(sock=s, run=True)
    _server["thread"] = threading.Thread(target=_serve, daemon=True)
    _server["thread"].start()
    bpy.app.timers.register(_poll, persistent=True)


def unregister():
    for c in reversed(_classes):
        try:
            bpy.utils.unregister_class(c)
        except RuntimeError:
            pass
    _server["run"] = False
    if _server["sock"]:
        try:
            _server["sock"].close()
        except OSError:
            pass
    _server["sock"] = None
    if bpy.app.timers.is_registered(_poll):
        bpy.app.timers.unregister(_poll)
