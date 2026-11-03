# Gouache Studio - sets up Unreal from a Gouache export.
# In Unreal: turn on the "Python Editor Script Plugin" (Edit > Plugins), restart,
# then Tools > Execute Python Script... and pick this file (it sits beside gouache_unreal.json).
#
# What it makes, under /Game/Gouache:
#   _Masters/M_Gouache_<Look>   one master material per look (Standard, Toon, ...), made once and shared
#   <name>/                     the textures of this export, and one small Material Instance per texture set
#   MPC_Gouache                 the light direction Toon / Cel use (set from your level's Directional Light)
# Run it again after sending again: the textures and instances are updated in place, nothing is duplicated.
# If the export has a model (.fbx), it is imported too and its material slots are filled in by name.
import json
import os
import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(HERE, "gouache_unreal.json")))
ROOT = "/Game/Gouache"
DEST = ROOT + "/" + DATA["name"]
MASTERS = ROOT + "/_Masters"
TOOLS = (getattr(unreal, "AssetToolsHelpers", None) or getattr(unreal, "AssetToolsHelper")).get_asset_tools()
MEL = unreal.MaterialEditingLibrary
EAL = unreal.EditorAssetLibrary


def import_file(path, dest, options=None):
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", path)
    task.set_editor_property("destination_path", dest)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    try:
        task.set_editor_property("replace_existing_settings", True)
    except Exception:
        pass
    task.set_editor_property("save", False)
    if options is not None:
        task.set_editor_property("options", options)
    TOOLS.import_asset_tasks([task])
    paths = task.get_editor_property("imported_object_paths")
    return EAL.load_asset(paths[0]) if paths else None


def import_texture(fname, kind):
    """kind: color (sRGB), data (linear), normal"""
    tex = import_file(os.path.join(HERE, fname), DEST)
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
    EAL.save_loaded_asset(tex)
    return tex


def lin(c):
    return [max(0.0, v) ** 2.2 for v in c]


def engine_texture(*paths):
    for p in paths:
        try:
            t = EAL.load_asset(p)
            if t:
                return t
        except Exception:
            pass
    return None


# ---------------------------------------------------------------- light collection
def light_collection():
    path = ROOT + "/MPC_Gouache"
    if EAL.does_asset_exist(path):
        return EAL.load_asset(path)
    mpc = TOOLS.create_asset("MPC_Gouache", ROOT, unreal.MaterialParameterCollection, unreal.MaterialParameterCollectionFactoryNew())
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
    EAL.save_loaded_asset(mpc)
    return mpc


# ---------------------------------------------------------------- the master material of a look
class Graph:
    def __init__(self, mat):
        self.mat = mat
        self.col = {}

    def node(self, cls, x, y):
        return MEL.create_material_expression(self.mat, cls, x, y)

    def scalar(self, name, value, x, y):
        n = self.node(unreal.MaterialExpressionScalarParameter, x, y)
        n.set_editor_property("parameter_name", name)
        n.set_editor_property("default_value", float(value))
        return n

    def vector(self, name, rgba, x, y):
        n = self.node(unreal.MaterialExpressionVectorParameter, x, y)
        n.set_editor_property("parameter_name", name)
        n.set_editor_property("default_value", unreal.LinearColor(rgba[0], rgba[1], rgba[2], rgba[3] if len(rgba) > 3 else 1.0))
        return n

    def texture(self, name, default, sampler, x, y):
        n = self.node(unreal.MaterialExpressionTextureSampleParameter2D, x, y)
        n.set_editor_property("parameter_name", name)
        if default is not None:
            n.set_editor_property("texture", default)
        n.set_editor_property("sampler_type", sampler)
        return n

    def custom(self, code, names, out, x, y):
        c = self.node(unreal.MaterialExpressionCustom, x, y)
        c.set_editor_property("code", code)
        c.set_editor_property("output_type", out)
        ins = []
        for nm in names:
            i = unreal.CustomInput()
            i.set_editor_property("input_name", nm)
            ins.append(i)
        c.set_editor_property("inputs", ins)
        return c

    def link(self, a, ao, b, bi):
        MEL.connect_material_expressions(a, ao, b, bi)


F1 = unreal.CustomMaterialOutputType.CMOT_FLOAT1
F2 = unreal.CustomMaterialOutputType.CMOT_FLOAT2
F3 = unreal.CustomMaterialOutputType.CMOT_FLOAT3


def master_path(look, alpha):
    return MASTERS + "/M_Gouache_" + look + ("_Alpha" if alpha else "")


def build_master(look, kind, alpha, S):
    """S: the first set that uses this look (its settings become the master's defaults)."""
    name = "M_Gouache_" + look + ("_Alpha" if alpha else "")
    mat = TOOLS.create_asset(name, MASTERS, unreal.Material, unreal.MaterialFactoryNew())
    g = Graph(mat)
    sc = S["scalars"]
    vc = S["vectors"]
    MP = unreal.MaterialProperty

    y = [0]

    def scalar(n, d=0.0):
        y[0] += 90
        return g.scalar(n, sc.get(n, d), -1400, y[0] + 600)

    def vector(n, d):
        y[0] += 90
        return g.vector(n, vc.get(n, d), -1400, y[0] + 600)

    white = engine_texture("/Engine/EngineResources/WhiteSquareTexture", "/Engine/EngineMaterials/BaseGrid")
    black = engine_texture("/Engine/EngineResources/Black", "/Engine/EngineResources/WhiteSquareTexture")
    flat = engine_texture("/Engine/EngineMaterials/DefaultNormal", "/Engine/EngineMaterials/FlatNormal")
    SAMP = unreal.MaterialSamplerType

    # texture coordinates: scaled and moved, scrolled for Panner, snapped for Retro
    tc = g.node(unreal.MaterialExpressionTextureCoordinate, -1500, -300)
    uvs = vector("UVScale", [1, 1, 0, 1])
    uvo = vector("UVOffset", [0, 0, 0, 1])
    code = "return UV * S.xy + O.xy;"
    names = ["UV", "S", "O"]
    if look == "Panner":
        tm = g.node(unreal.MaterialExpressionTime, -1500, -150)
        pan = vector("PanSpeed", [0, 0.25, 0, 1])
        code = "return UV * S.xy + O.xy + T * P.xy;"
        names = ["UV", "S", "O", "T", "P"]
    if look == "Retro":
        tx = scalar("Texels", 32)
        code = "float2 u = UV * S.xy + O.xy; return (floor(u * K) + 0.5) / K;"
        names = ["UV", "S", "O", "K"]
    uvn = g.custom(code, names, F2, -1200, -300)
    g.link(tc, "", uvn, "UV")
    g.link(uvs, "RGB", uvn, "S")
    g.link(uvo, "RGB", uvn, "O")
    if look == "Panner":
        g.link(tm, "", uvn, "T")
        g.link(pan, "RGB", uvn, "P")
    if look == "Retro":
        g.link(tx, "", uvn, "K")

    base = g.texture("BaseColorTex", white, SAMP.SAMPLERTYPE_COLOR, -900, -300)
    orm = g.texture("ORMTex", white, SAMP.SAMPLERTYPE_MASKS, -900, 0)
    nrm = g.texture("NormalTex", flat, SAMP.SAMPLERTYPE_NORMAL, -900, 300)
    emi = g.texture("EmissiveTex", black, SAMP.SAMPLERTYPE_COLOR, -900, 600)
    for t in (base, orm, nrm, emi):
        g.link(uvn, "", t, "Coordinates")

    tint = vector("Tint", [1, 1, 1, 1])
    albedo = g.custom("return B.rgb * T;", ["B", "T"], F3, -600, -300)
    g.link(base, "RGB", albedo, "B")
    g.link(tint, "RGB", albedo, "T")

    has = scalar("HasORM", 0)
    rv = scalar("RoughnessValue", 0.6)
    mv = scalar("MetallicValue", 0.0)
    rs = scalar("RoughScale", 1)
    ms = scalar("MetalScale", 1)
    ns = scalar("NormalStrength", 1)

    def orm_pick(code, extra):
        c = g.custom(code, ["ORM", "Has"] + [e[0] for e in extra], F1, -500, 0)
        g.link(orm, "RGB", c, "ORM")
        g.link(has, "", c, "Has")
        for e in extra:
            g.link(e[1], "", c, e[0])
        return c

    rough = orm_pick("return saturate(lerp(V, ORM.g * K, Has));", [("V", rv), ("K", rs)])
    metal = orm_pick("return saturate(lerp(V, ORM.b * K, Has));", [("V", mv), ("K", ms)])
    occl = orm_pick("return lerp(1.0, ORM.r, Has);", [])
    nrmc = g.custom("float3 n = N; n.xy *= K; return normalize(n);", ["N", "K"], F3, -500, 300)
    g.link(nrm, "RGB", nrmc, "N")
    g.link(ns, "", nrmc, "K")

    custom_light = look in ("Toon", "Cel", "Retro")
    if custom_light:
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
        Lp = g.node(unreal.MaterialExpressionCollectionParameter, -500, 800)
        Lp.set_editor_property("collection", LIGHTS)
        Lp.set_editor_property("parameter_name", "LightDirection")
        N = g.node(unreal.MaterialExpressionPixelNormalWS, -500, 920)
        V = g.node(unreal.MaterialExpressionCameraVectorWS, -500, 1040)
        if look in ("Toon", "Cel"):
            sh = vector("ShadowColour", [0.45, 0.4, 0.55, 1])
            hl = scalar("Highlight", 0.3)
            rl = scalar("RimLight", 0.2)
            if look == "Toon":
                a1 = scalar("Bands", 3)
                a2 = scalar("BandShift", 0)
                band = "float st = max(A1, 1.0); float band = floor(l * st + 0.5 * A2) / st;"
            else:
                a1 = scalar("ShadowLine", 0.5)
                a2 = scalar("EdgeSoftness", 0.06)
                band = "float band = smoothstep(A1 - A2 * 0.5, A1 + A2 * 0.5 + 0.0001, l);"
            code = (
                "float3 n = normalize(N); float3 lv = normalize(L); float3 vv = normalize(V); float l = dot(n, lv) * 0.5 + 0.5; " + band +
                " float3 c = lerp(Base * Sh, Base, saturate(band));"
                " float3 h = normalize(lv + vv); float sp = step(1.0 - Hl * 0.05, saturate(dot(n, h))) * step(0.01, Hl);"
                " float rim = smoothstep(1.0 - Rl, 1.0, 1.0 - saturate(dot(n, vv))) * Rl;"
                " return c + sp + Base * rim;"
            )
            c = g.custom(code, ["Base", "N", "L", "V", "Sh", "Hl", "Rl", "A1", "A2"], F3, -200, 700)
            g.link(albedo, "", c, "Base")
            g.link(N, "", c, "N")
            g.link(Lp, "", c, "L")
            g.link(V, "", c, "V")
            g.link(sh, "RGB", c, "Sh")
            g.link(hl, "", c, "Hl")
            g.link(rl, "", c, "Rl")
            g.link(a1, "", c, "A1")
            g.link(a2, "", c, "A2")
        else:
            lv = vector("ColourLevels", [31, 31, 31, 1])
            amb = scalar("Ambient", 0.35)
            bri = scalar("Brightness", 1)
            stp = scalar("LightBands", 0)
            dth = scalar("DitherAmount", 0.6)
            code = (
                "float3 n = normalize(N); float l = saturate(dot(n, normalize(L)));"
                " if (Bd > 0.5) l = floor(l * Bd + 0.5) / Bd;"
                " float3 c = Base * (Am + (1.0 - Am) * l) * Br;"
                " c = pow(saturate(c), 1.0 / 2.2);"
                " int2 px = int2(Parameters.SvPosition.xy); float bay = float((px.x & 3) * 4 + (px.y & 3)) / 16.0;"
                " c = floor(c * Lv + 0.5 + (bay - 0.5) * Dt) / Lv;"
                " return pow(saturate(c), 2.2);"
            )
            c = g.custom(code, ["Base", "N", "L", "Lv", "Am", "Br", "Bd", "Dt"], F3, -200, 700)
            g.link(albedo, "", c, "Base")
            g.link(N, "", c, "N")
            g.link(Lp, "", c, "L")
            g.link(lv, "RGB", c, "Lv")
            g.link(amb, "", c, "Am")
            g.link(bri, "", c, "Br")
            g.link(stp, "", c, "Bd")
            g.link(dth, "", c, "Dt")
        if look in ("Toon", "Cel"):
            # one material does both: front faces shaded, back faces pushed out along the normals in the outline colour
            mat.set_editor_property("two_sided", True)
            mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_MASKED)
            oc = vector("OutlineColour", [0, 0, 0, 1])
            ow = scalar("OutlineWidth", 0.0)
            sw = g.node(unreal.MaterialExpressionTwoSidedSwitch, 100, 650)
            g.link(c, "", sw, "Front")
            g.link(oc, "RGB", sw, "Back")
            MEL.connect_material_property(sw, "", MP.MP_EMISSIVE_COLOR)
            vn = g.node(unreal.MaterialExpressionVertexNormalWS, -200, 1200)
            mul = g.node(unreal.MaterialExpressionMultiply, 0, 1150)
            g.link(vn, "", mul, "A")
            g.link(ow, "", mul, "B")
            zero = g.node(unreal.MaterialExpressionConstant3Vector, 0, 1250)
            sw2 = g.node(unreal.MaterialExpressionTwoSidedSwitch, 250, 1200)
            g.link(zero, "", sw2, "Front")
            g.link(mul, "", sw2, "Back")
            MEL.connect_material_property(sw2, "", MP.MP_WORLD_POSITION_OFFSET)
            one = g.node(unreal.MaterialExpressionConstant, 250, 1350)
            one.set_editor_property("r", 1.0)
            MEL.connect_material_property(one, "", MP.MP_OPACITY_MASK)
        else:
            MEL.connect_material_property(c, "", MP.MP_EMISSIVE_COLOR)
        MEL.recompile_material(mat)
        EAL.save_loaded_asset(mat)
        return mat

    # lit looks
    MEL.connect_material_property(albedo, "", MP.MP_BASE_COLOR)
    MEL.connect_material_property(rough, "", MP.MP_ROUGHNESS)
    MEL.connect_material_property(metal, "", MP.MP_METALLIC)
    MEL.connect_material_property(occl, "", MP.MP_AMBIENT_OCCLUSION)
    MEL.connect_material_property(nrmc, "", MP.MP_NORMAL)
    MEL.connect_material_property(emi, "RGB", MP.MP_EMISSIVE_COLOR)
    if alpha:
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        MEL.connect_material_property(base, "A", MP.MP_OPACITY)
    if look == "BrushedMetal":
        try:
            a = scalar("Stretch", 0.7)
            MEL.connect_material_property(a, "", MP.MP_ANISOTROPY)
        except Exception as e:
            unreal.log_warning("Gouache: anisotropy needs Unreal 5.1 or newer (" + str(e) + ")")
    elif look == "Velvet":
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_CLOTH)
        col = vector("SheenColour", [1, 1, 1, 1])
        MEL.connect_material_property(col, "RGB", MP.MP_SUBSURFACE_COLOR)
        amt = scalar("Sheen", 0.5)
        MEL.connect_material_property(amt, "", MP.MP_OPACITY)
    elif look == "Skin":
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_SUBSURFACE)
        col = vector("BloodColour", [0.85, 0.25, 0.18, 1])
        MEL.connect_material_property(col, "RGB", MP.MP_SUBSURFACE_COLOR)
        amt = scalar("ScatterStrength", 0.5)
        MEL.connect_material_property(amt, "", MP.MP_OPACITY)
    MEL.recompile_material(mat)
    EAL.save_loaded_asset(mat)
    return mat


def master_for(S):
    look = S["look"]
    alpha = bool(S.get("alpha")) and look not in ("Toon", "Cel", "Retro")
    path = master_path(look, alpha)
    if EAL.does_asset_exist(path):
        return EAL.load_asset(path)
    return build_master(look, S["kind"], alpha, S)


# ---------------------------------------------------------------- one asset's instance
def make_instance(S, master):
    name = "MI_" + S["safe"]
    path = DEST + "/" + name
    if EAL.does_asset_exist(path):
        mi = EAL.load_asset(path)
    else:
        mi = TOOLS.create_asset(name, DEST, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    MEL.set_material_instance_parent(mi, master)
    for key, fname, kind in (("BaseColor", None, "color"), ("ORM", None, "data"), ("Normal", None, "normal"), ("Emissive", None, "color")):
        f = S["tex"].get(key)
        if not f:
            continue
        tex = import_texture(f, kind)
        if tex is not None:
            pname = {"BaseColor": "BaseColorTex", "ORM": "ORMTex", "Normal": "NormalTex", "Emissive": "EmissiveTex"}[key]
            MEL.set_material_instance_texture_parameter_value(mi, pname, tex)
    for n, v in S["scalars"].items():
        MEL.set_material_instance_scalar_parameter_value(mi, n, float(v))
    for n, v in S["vectors"].items():
        MEL.set_material_instance_vector_parameter_value(mi, n, unreal.LinearColor(v[0], v[1], v[2], v[3] if len(v) > 3 else 1.0))
    MEL.update_material_instance(mi)
    EAL.save_loaded_asset(mi)
    return mi


def assign_to_model(instances):
    mfile = DATA.get("model")
    if not mfile or not mfile.lower().endswith((".fbx", ".obj")):
        if mfile:
            unreal.log("Gouache: " + mfile + " was not imported (import it yourself, then assign the MI_ materials)")
        return
    path = os.path.join(HERE, mfile)
    if not os.path.exists(path):
        return
    opts = None
    if mfile.lower().endswith(".fbx"):
        opts = unreal.FbxImportUI()
        opts.set_editor_property("import_materials", False)
        opts.set_editor_property("import_textures", False)
        opts.set_editor_property("import_as_skeletal", False)
    mesh = import_file(path, DEST, opts)
    if mesh is None or not isinstance(mesh, unreal.StaticMesh):
        return
    slots = mesh.get_editor_property("static_materials")
    for i, slot in enumerate(slots):
        sname = str(slot.get_editor_property("material_slot_name"))
        mi = instances.get(sname) or instances.get(sname.replace(" ", "_"))
        if mi is not None:
            mesh.set_material(i, mi)
    EAL.save_loaded_asset(mesh)
    unreal.log("Gouache: " + mfile + " imported with its materials set")


LIGHTS = None
if any(S["look"] in ("Toon", "Cel", "Retro") for S in DATA["sets"]):
    LIGHTS = light_collection()

made = []
inst = {}
for S in DATA["sets"]:
    try:
        master = master_for(S)
        mi = make_instance(S, master)
        inst[S["safe"]] = mi
        inst[S["name"]] = mi
        made.append("MI_" + S["safe"])
    except Exception as e:
        unreal.log_error("Gouache: " + S["name"] + " failed: " + str(e))
try:
    assign_to_model(inst)
except Exception as e:
    unreal.log_error("Gouache: the model could not be set up: " + str(e))
unreal.log("Gouache: made " + ", ".join(made) + " in " + DEST)
