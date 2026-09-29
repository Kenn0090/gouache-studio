# Gouache Studio link: lets Gouache Studio send models (with their textures) into this Blender.
# Install: Blender > Edit > Preferences > Add-ons > Install... (pick this file) and tick "Gouache Studio link".
# It listens on this computer only (127.0.0.1). Each send replaces the previous import of the same model,
# kept in a collection called "Gouache - <name>".
bl_info = {
    "name": "Gouache Studio link",
    "author": "Gouache Studio",
    "version": (1, 0, 0),
    "blender": (3, 0, 0),
    "location": "Runs in the background",
    "description": "Receive models and textures sent from Gouache Studio",
    "category": "Import-Export",
}

import os
import queue
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


def register():
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
    _server["run"] = False
    if _server["sock"]:
        try:
            _server["sock"].close()
        except OSError:
            pass
    _server["sock"] = None
    if bpy.app.timers.is_registered(_poll):
        bpy.app.timers.unregister(_poll)
