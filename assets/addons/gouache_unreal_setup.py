# Gouache Studio - builds Unreal materials from a Gouache export.
# In Unreal: turn on the "Python Editor Script Plugin" (Edit > Plugins), restart,
# then Tools > Execute Python Script... and pick this file. It imports the textures
# and makes one material per texture set (M_<Set>) in /Game/Gouache/<name>.
# Toon and Cel read the light direction from MPC_Gouache (set from your level's Directional Light)
# and draw their outline in the same material (back faces pushed out along the normals).
import json
import os
import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(HERE, "gouache_unreal.json")))
DEST = "/Game/Gouache/" + DATA["name"]
TOOLS = unreal.AssetToolsHelper.get_asset_tools()
MEL = unreal.MaterialEditingLibrary


def import_texture(fname, kind):
    """kind: color (sRGB), data (linear), normal"""
    path = os.path.join(HERE, fname)
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", path)
    task.set_editor_property("destination_path", DEST)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("save", False)
    TOOLS.import_asset_tasks([task])
    paths = task.get_editor_property("imported_object_paths")
    tex = unreal.EditorAssetLibrary.load_asset(paths[0]) if paths else None
    if tex is None:
        unreal.log_warning("Gouache: could not import " + fname)
        return None
    if kind == "color":
        tex.set_editor_property("srgb", True)
    elif kind == "data":
        tex.set_editor_property("srgb", False)
        tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_MASKS)
    elif kind == "normal":
        tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
        tex.set_editor_property("srgb", False)
    unreal.EditorAssetLibrary.save_loaded_asset(tex)
    return tex


class Graph:
    def __init__(self, mat):
        self.mat = mat
        self.y = 0

    def node(self, cls, x, y):
        return MEL.create_material_expression(self.mat, cls, x, y)

    def const(self, value, x, y):
        n = self.node(unreal.MaterialExpressionConstant, x, y)
        n.set_editor_property("r", float(value))
        return n

    def const3(self, rgb, x, y):
        n = self.node(unreal.MaterialExpressionConstant3Vector, x, y)
        n.set_editor_property("constant", unreal.LinearColor(rgb[0], rgb[1], rgb[2], 1.0))
        return n

    def tex(self, texture, sampler, x, y):
        n = self.node(unreal.MaterialExpressionTextureSample, x, y)
        n.set_editor_property("texture", texture)
        if sampler == "normal":
            n.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
        elif sampler == "data":
            n.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_MASKS)
        return n

    def custom(self, code, names, out3, x, y):
        c = self.node(unreal.MaterialExpressionCustom, x, y)
        c.set_editor_property("code", code)
        c.set_editor_property(
            "output_type",
            unreal.CustomMaterialOutputType.CMOT_FLOAT3 if out3 else unreal.CustomMaterialOutputType.CMOT_FLOAT2,
        )
        ins = []
        for nm in names:
            i = unreal.CustomInput()
            i.set_editor_property("input_name", nm)
            ins.append(i)
        c.set_editor_property("inputs", ins)
        return c


def make_light_collection():
    """MPC_Gouache.LightDirection: the direction toward the light that Toon / Cel use.
    It is set from the first Directional Light in the open level (change it in the asset any time)."""
    mpc = TOOLS.create_asset("MPC_Gouache", DEST, unreal.MaterialParameterCollection, unreal.MaterialParameterCollectionFactoryNew())
    vec = [0.4, 0.6, 0.7]
    try:
        for a in unreal.EditorLevelLibrary.get_all_level_actors():
            if isinstance(a, unreal.DirectionalLight):
                f = a.get_actor_forward_vector()
                vec = [-f.x, -f.y, -f.z]
                break
    except Exception as e:
        unreal.log_warning("Gouache: no Directional Light found, using a default (" + str(e) + ")")
    prm = unreal.CollectionVectorParameter()
    prm.set_editor_property("parameter_name", "LightDirection")
    prm.set_editor_property("default_value", unreal.LinearColor(vec[0], vec[1], vec[2], 0.0))
    mpc.set_editor_property("vector_parameters", [prm])
    unreal.EditorAssetLibrary.save_loaded_asset(mpc)
    return mpc


def lin(c):
    return [max(0.0, v) ** 2.2 for v in c]


def build_material(S):
    name = "M_" + S["safe"]
    mat = TOOLS.create_asset(name, DEST, unreal.Material, unreal.MaterialFactoryNew())
    g = Graph(mat)
    kind = S["kind"]
    p = S["p"]
    T = S["tex"]
    uvnode = None
    X = -900

    # texture coordinates: scrolled (Panner) or snapped to a small grid (Retro)
    if kind == "panner":
        tc = g.node(unreal.MaterialExpressionTextureCoordinate, X - 400, 0)
        pan = g.node(unreal.MaterialExpressionPanner, X - 200, 0)
        pan.set_editor_property("speed_x", float(p.get("sx", 0)))
        pan.set_editor_property("speed_y", float(p.get("sy", 0)))
        MEL.connect_material_expressions(tc, "", pan, "Coordinate")
        uvnode = pan
    elif kind == "retro":
        tc = g.node(unreal.MaterialExpressionTextureCoordinate, X - 400, 0)
        R = float(p.get("res", 32))
        snap = g.custom("return (floor(UV * %f) + 0.5) / %f;" % (R, R), ["UV"], False, X - 200, 0)
        MEL.connect_material_expressions(tc, "", snap, "UV")
        uvnode = snap

    def sample(fname, sampler):
        if not fname:
            return None
        tex = import_texture(fname, sampler if sampler != "color" else "color")
        if tex is None:
            return None
        n = g.tex(tex, sampler, X, g.y)
        g.y += 260
        if uvnode is not None:
            MEL.connect_material_expressions(uvnode, "", n, "Coordinates")
        return n

    base = sample(T.get("BaseColor"), "color")
    orm = sample(T.get("ORM"), "data")
    nrm = sample(T.get("Normal"), "normal")
    emi = sample(T.get("Emissive"), "color")

    custom_light = kind in ("toon", "cel", "retro")
    if custom_light:
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
        # a fixed light direction, like the viewer's sun (change the numbers to match your scene)
        L = g.node(unreal.MaterialExpressionCollectionParameter, -500, 700)
        L.set_editor_property("collection", LIGHTS)
        L.set_editor_property("parameter_name", "LightDirection")
        N = g.node(unreal.MaterialExpressionPixelNormalWS, -500, 840)
        V = g.node(unreal.MaterialExpressionCameraVectorWS, -500, 960)
        bc = base if base is not None else g.const3([0.8, 0.8, 0.8], X, g.y)
        bco = "RGB" if base is not None else ""
        if kind in ("toon", "cel"):
            sh = lin(p.get("col", [0.45, 0.4, 0.55]))
            if kind == "toon":
                band = "float st = max(%f, 1.0); float band = floor(l * st + 0.5 * %f) / st;" % (float(p.get("steps", 3)), float(p.get("offset", 0)))
            else:
                th, so = float(p.get("thresh", 0.5)), float(p.get("soft", 0.06))
                band = "float band = smoothstep(%f, %f, l);" % (th - so * 0.5, th + so * 0.5 + 1e-4)
            code = (
                "float3 n = normalize(N); float3 lv = normalize(L); float l = dot(n, lv) * 0.5 + 0.5; " + band +
                " float3 c = lerp(Base * float3(%f, %f, %f), Base, saturate(band));"
                " float3 h = normalize(lv + normalize(V)); float sp = step(1.0 - %f * 0.05, saturate(dot(n, h))) * step(0.01, %f);"
                " float rim = smoothstep(1.0 - %f, 1.0, 1.0 - saturate(dot(n, normalize(V)))) * %f;"
                " return c + sp + Base * rim;"
            ) % (sh[0], sh[1], sh[2], float(p.get("spec", 0.3)), float(p.get("spec", 0.3)), float(p.get("rim", 0.2)), float(p.get("rim", 0.2)))
            c = g.custom(code, ["Base", "N", "L", "V"], True, -200, 600)
        else:
            amb = float(p.get("amb", 0.35))
            bright = float(p.get("bright", 1.0))
            steps = float(p.get("steps", 0))
            lv = [(1 << int(p.get(k, 5))) - 1 for k in ("br", "bg", "bb")]
            code = (
                "float3 n = normalize(N); float l = saturate(dot(n, normalize(L)));"
                " if (%f > 0.5) l = floor(l * %f + 0.5) / %f;"
                " float3 c = Base * (%f + (1.0 - %f) * l) * %f;"
                " c = pow(saturate(c), 1.0 / 2.2);"
                " int2 px = int2(Parameters.SvPosition.xy); float bay = float((px.x & 3) * 4 + (px.y & 3)) / 16.0;"
                " float3 lv = float3(%f, %f, %f);"
                " c = floor(c * lv + 0.5 + (bay - 0.5) * %f) / lv;"
                " return pow(saturate(c), 2.2);"
            ) % (steps, max(steps, 1.0), max(steps, 1.0), amb, amb, bright, lv[0], lv[1], lv[2], float(p.get("dither", 0.6)))
            c = g.custom(code, ["Base", "N", "L"], True, -200, 600)
        MEL.connect_material_expressions(bc, bco, c, "Base")
        MEL.connect_material_expressions(N, "", c, "N")
        MEL.connect_material_expressions(L, "", c, "L")
        if kind != "retro":
            MEL.connect_material_expressions(V, "", c, "V")
        ow = float(S.get("outlineW", 0))
        if kind in ("toon", "cel") and ow > 0:
            # one material does both: the front faces are shaded, the back faces are pushed out along
            # the normals and drawn in the outline colour (the classic inverted hull outline)
            mat.set_editor_property("two_sided", True)
            mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_MASKED)
            oc = g.const3(lin(p.get("ocol", [0, 0, 0])), -200, 760)
            sw = g.node(unreal.MaterialExpressionTwoSidedSwitch, 100, 650)
            MEL.connect_material_expressions(c, "", sw, "Front")
            MEL.connect_material_expressions(oc, "", sw, "Back")
            MEL.connect_material_property(sw, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
            vn = g.node(unreal.MaterialExpressionVertexNormalWS, -200, 900)
            wd = g.const(ow, -200, 1000)
            mul = g.node(unreal.MaterialExpressionMultiply, 0, 950)
            MEL.connect_material_expressions(vn, "", mul, "A")
            MEL.connect_material_expressions(wd, "", mul, "B")
            zero = g.const3([0, 0, 0], 0, 1050)
            sw2 = g.node(unreal.MaterialExpressionTwoSidedSwitch, 250, 1000)
            MEL.connect_material_expressions(zero, "", sw2, "Front")
            MEL.connect_material_expressions(mul, "", sw2, "Back")
            MEL.connect_material_property(sw2, "", unreal.MaterialProperty.MP_WORLD_POSITION_OFFSET)
            one = g.const(1.0, 250, 1150)
            MEL.connect_material_property(one, "", unreal.MaterialProperty.MP_OPACITY_MASK)
        else:
            MEL.connect_material_property(c, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
        MEL.recompile_material(mat)
        unreal.EditorAssetLibrary.save_loaded_asset(mat)
        return name

    # lit shaders
    if base is not None:
        MEL.connect_material_property(base, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
        if S.get("alpha"):
            mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
            MEL.connect_material_property(base, "A", unreal.MaterialProperty.MP_OPACITY)
    if orm is not None:
        MEL.connect_material_property(orm, "R", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)
        MEL.connect_material_property(orm, "G", unreal.MaterialProperty.MP_ROUGHNESS)
        MEL.connect_material_property(orm, "B", unreal.MaterialProperty.MP_METALLIC)
    if nrm is not None:
        MEL.connect_material_property(nrm, "RGB", unreal.MaterialProperty.MP_NORMAL)
    if emi is not None:
        MEL.connect_material_property(emi, "RGB", unreal.MaterialProperty.MP_EMISSIVE_COLOR)

    if kind == "aniso":
        try:
            a = g.const(min(1.0, abs(float(p.get("amount", 0.7)))), -300, 1100)
            MEL.connect_material_property(a, "", unreal.MaterialProperty.MP_ANISOTROPY)
        except Exception as e:
            unreal.log_warning("Gouache: anisotropy needs Unreal 5.1 or newer (" + str(e) + ")")
    elif kind == "velvet":
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_CLOTH)
        col = g.const3(lin(p.get("col", [1, 1, 1])), -300, 1100)
        MEL.connect_material_property(col, "", unreal.MaterialProperty.MP_SUBSURFACE_COLOR)
        amt = g.const(min(1.0, float(p.get("sheen", 0.8)) * 0.6), -300, 1250)
        MEL.connect_material_property(amt, "", unreal.MaterialProperty.MP_OPACITY)
    elif kind == "skin":
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_SUBSURFACE)
        col = g.const3(lin(p.get("col", [0.85, 0.25, 0.18])), -300, 1100)
        MEL.connect_material_property(col, "", unreal.MaterialProperty.MP_SUBSURFACE_COLOR)
        amt = g.const(min(1.0, float(p.get("scatter", 0.5)) * float(p.get("strength", 0.6)) + 0.2), -300, 1250)
        MEL.connect_material_property(amt, "", unreal.MaterialProperty.MP_OPACITY)

    MEL.recompile_material(mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mat)
    return name


LIGHTS = None
if any(S["kind"] in ("toon", "cel", "retro") for S in DATA["sets"]):
    LIGHTS = make_light_collection()

made = []
for S in DATA["sets"]:
    try:
        made.append(build_material(S))
    except Exception as e:
        unreal.log_error("Gouache: " + S["name"] + " failed: " + str(e))
unreal.log("Gouache: made " + ", ".join(made) + " in " + DEST)
