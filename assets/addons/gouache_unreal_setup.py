# Gouache Studio - sets up Unreal from a Gouache export.
# In Unreal: turn on the "Python Editor Script Plugin" (Edit > Plugins), restart,
# then Tools > Execute Python Script... and pick this file (it sits beside gouache_unreal.gdata).
#
# What it makes, under /Game/Gouache:
#   _Masters/M_Gouache_<Look>   one master material per look (Standard, Toon, ...), made once and shared
#   <name>/                     the textures of this export, and one small Material Instance per texture set
#   MPC_Gouache                 the light direction Toon / Cel use (set from your level's Directional Light)
# Run it again after sending again: the textures and instances are updated in place, nothing is duplicated.
# If the export has a model (.fbx), it is imported too and its material slots are filled in by name.
import json
import os
import traceback
import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
_DATA_FILE = os.path.join(HERE, "gouache_unreal.gdata")
if not os.path.exists(_DATA_FILE):
    _DATA_FILE = os.path.join(HERE, "gouache_unreal.json")  # older exports
DATA = json.load(open(_DATA_FILE))
ROOT = "/Game/Gouache"
DEST = ROOT + "/" + DATA["name"]
MASTERS = ROOT + "/_Masters"
VARIANTS = ROOT + "/_Variants"
TOOLS = (getattr(unreal, "AssetToolsHelpers", None) or getattr(unreal, "AssetToolsHelper")).get_asset_tools()
MEL = unreal.MaterialEditingLibrary
EAL = unreal.EditorAssetLibrary


def import_file(path, dest, options=None, want=None):
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
    paths = task.get_editor_property("imported_object_paths") or []
    if want is None:
        return EAL.load_asset(paths[0]) if paths else None
    # a model import also brings materials and textures: pick the mesh out of everything that came in
    for p in paths:
        a = EAL.load_asset(p)
        if a is not None and isinstance(a, want):
            return a
    return None


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


def _png(path, rgb):
    import struct
    import zlib
    raw = b"".join(b"\0" + bytes(rgb) * 4 for _ in range(4))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 4, 4, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def default_texture(name, rgb, kind):
    """A tiny texture the master material starts with. Its settings must match the texture node's sampler type
    (colour, masks, normal), or Unreal marks the node as an error, so Gouache makes its own instead of using engine ones."""
    path = MASTERS + "/T_Gouache_" + name
    if EAL.does_asset_exist(path):
        return EAL.load_asset(path)
    import tempfile
    tmp = os.path.join(tempfile.gettempdir(), "T_Gouache_" + name + ".png")
    _png(tmp, rgb)
    tex = import_file(tmp, MASTERS)
    if tex is None:
        return None
    if kind == "color":
        tex.set_editor_property("srgb", True)
    elif kind == "data":
        tex.set_editor_property("srgb", False)
        tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_MASKS)
    else:
        tex.set_editor_property("srgb", False)
        tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
    EAL.save_loaded_asset(tex)
    return tex


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
        mpc = EAL.load_asset(path)
        try:
            # made by an older script without an id: rebuilt below
            prs = mpc.get_editor_property("vector_parameters")
            if prs and unreal.GuidLibrary.is_valid(prs[0].get_editor_property("id")):
                return mpc
        except Exception:
            return mpc
    else:
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
    try:
        prm.set_editor_property("id", unreal.GuidLibrary.new_guid())
    except Exception:
        pass
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
        """Connects an output of a to an input of b. Unreal names some pins differently from what they show
        (a Vector Parameter's colour output has no name; a texture's UV input is "UVs" or "Coordinates"),
        so the other names are tried too, and a wire that still does not connect is reported."""
        outs = [out_pin(a, ao)]
        ins = [bi] + PIN_ALIASES.get(bi, [])
        for o in outs:
            for i in ins:
                try:
                    if MEL.connect_material_expressions(a, o, b, i):
                        return True
                except Exception:
                    pass
        FAILED.append("%s.%s -> %s.%s" % (a.get_class().get_name(), ao, b.get_class().get_name(), bi))
        return False


FAILED = []
PIN_ALIASES = {"UVs": ["Coordinates", "UV"], "Coordinates": ["UVs"]}
COLOUR_NODES = tuple(c for c in (getattr(unreal, "MaterialExpressionVectorParameter", None), getattr(unreal, "MaterialExpressionConstant3Vector", None), getattr(unreal, "MaterialExpressionConstant4Vector", None)) if c)


def out_pin(node, name):
    """A Vector Parameter's first output (the colour, RGB) has no name in Unreal: "RGB" would not connect."""
    if name == "RGB" and isinstance(node, COLOUR_NODES):
        return ""
    return name


def prop(node, pin, mp):
    """Connects a node to an input of the material (Base Color, Roughness, ...); a failure is reported."""
    try:
        if MEL.connect_material_property(node, out_pin(node, pin), mp):
            return True
    except Exception:
        pass
    FAILED.append("%s -> %s" % (node.get_class().get_name(), str(mp)))
    return False


def no_lwc(g, node, x, y):
    """World Position is a large-world (double) value in Unreal 5: Custom nodes want a plain float3."""
    cls = getattr(unreal, "MaterialExpressionTruncateLWC", None)
    if cls is None:
        return node
    t = g.node(cls, x, y)
    g.link(node, "", t, "")
    return t


F1 = unreal.CustomMaterialOutputType.CMOT_FLOAT1
F2 = unreal.CustomMaterialOutputType.CMOT_FLOAT2
F3 = unreal.CustomMaterialOutputType.CMOT_FLOAT3
F4 = unreal.CustomMaterialOutputType.CMOT_FLOAT4


def master_path(look, alpha):
    return MASTERS + "/M_Gouache_" + look + ("_Alpha" if alpha else "")


def build_master(look, kind, alpha, S, existing=None):
    """S: the first set that uses this look (its settings become the master's defaults).
    existing: a master to rebuild in place (its instances keep working)."""
    name = "M_Gouache_" + look + ("_Alpha" if alpha else "")
    if existing is not None:
        mat = existing
        MEL.delete_all_material_expressions(mat)
    else:
        mat = TOOLS.create_asset(name, MASTERS, unreal.Material, unreal.MaterialFactoryNew())
    try:
        EAL.set_metadata_tag(mat, "gouache_master", str(max(MASTER_FIXED, int(DATA.get("masterVersion", 1)))))
    except Exception:
        pass
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

    white = default_texture("White", (255, 255, 255), "color")
    white_lin = default_texture("WhiteLinear", (255, 255, 255), "data")
    black = default_texture("Black", (0, 0, 0), "color")
    flat = default_texture("FlatNormal", (128, 128, 255), "normal")
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
    orm = g.texture("ORMTex", white_lin, SAMP.SAMPLERTYPE_MASKS, -900, 0)
    nrm = g.texture("NormalTex", flat, SAMP.SAMPLERTYPE_NORMAL, -900, 300)
    emi = g.texture("EmissiveTex", black, SAMP.SAMPLERTYPE_COLOR, -900, 600)
    for t in (base, orm, nrm, emi):
        g.link(uvn, "", t, "UVs")

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

    py = [-120]

    def orm_pick(code, extra):
        py[0] += 120
        c = g.custom(code, ["ORM", "Has"] + [e[0] for e in extra], F1, -500, py[0])
        g.link(orm, "RGB", c, "ORM")
        g.link(has, "", c, "Has")
        for e in extra:
            g.link(e[1], "", c, e[0])
        return c

    rough = orm_pick("return saturate(lerp(V, ORM.g * K, Has));", [("V", rv), ("K", rs)])
    metal = orm_pick("return saturate(lerp(V, ORM.b * K, Has));", [("V", mv), ("K", ms)])
    occl = orm_pick("return lerp(1.0, ORM.r, Has);", [])
    nrmc = g.custom("float3 n = N; n.xy *= K; return normalize(n);", ["N", "K"], F3, -500, 420)
    g.link(nrm, "RGB", nrmc, "N")
    g.link(ns, "", nrmc, "K")

    if look == "Hologram":
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        mat.set_editor_property("two_sided", True)
        N = g.node(unreal.MaterialExpressionPixelNormalWS, -500, 920)
        V = g.node(unreal.MaterialExpressionCameraVectorWS, -500, 1040)
        P = no_lwc(g, g.node(unreal.MaterialExpressionWorldPosition, -650, 1160), -500, 1160)
        T = g.node(unreal.MaterialExpressionTime, -500, 1280)
        col = vector("HoloColour", [0.2, 0.85, 1, 1])
        ps = [scalar("SeeThrough", 0.8), scalar("EdgeGlow", 1.4), scalar("ScanLines", 40), scalar("ScanSpeed", 0.6), scalar("Flicker", 0.35), scalar("Glitch", 0.5), scalar("EdgePulse", 0.5), scalar("Sweep", 0.6), scalar("BodyGlow", 0.5)]
        names = ["See", "Glow", "Lines", "Speed", "Flick", "Glitch", "Pulse", "Sweep", "Body"]
        code = (
            "float3 n = normalize(N); float3 vv = normalize(V); float nvh = saturate(abs(dot(n, vv))); float t = T; float h = P.z * 0.01;"
            " float ln = smoothstep(0.35, 0.65, sin((h * Lines - t * Speed * 3.0) * 1.5708) * 0.5 + 0.5);"
            " float fl = max(1.0 - Flick * (0.35 * frac(sin(floor(t * 24.0) * 127.1 + 311.7) * 43758.5453) + 0.15 * sin(t * 60.0)), 0.0);"
            " float edge = pow(1.0 - nvh, 2.5) * Glow * (1.0 + Pulse * 0.6 * sin(t * 3.0));"
            " float body = Body * (0.35 + 0.65 * dot(Base, float3(0.3333, 0.3333, 0.3333)));"
            " float sw = exp(-pow((frac(h * 0.35 - t * 0.25) - 0.5) * 7.0, 2.0)) * Sweep;"
            " float gl = step(0.965 - Glitch * 0.06, frac(sin(floor(h * 18.0) * 127.1 + floor(t * 7.0) * 311.7) * 43758.5453)) * Glitch;"
            " ln = saturate(ln + gl * 0.8);"
            " float3 c = Col * (edge + ln * 0.55 + body * (0.4 + 0.6 * ln) + sw * 0.9 + gl * 1.2) * fl * 2.0 + Em * 2.0;"
            " float a = saturate(See * (0.15 + 0.5 * ln + 0.9 * edge + body * 0.6 + sw * 0.5 + gl * 0.6)) * fl;"
            " return float4(c, a);"
        )
        c = g.custom(code, ["Base", "N", "V", "P", "T", "Col", "Em"] + names, F4, -200, 700)
        g.link(albedo, "", c, "Base")
        g.link(N, "", c, "N")
        g.link(V, "", c, "V")
        g.link(P, "", c, "P")
        g.link(T, "", c, "T")
        g.link(col, "RGB", c, "Col")
        g.link(emi, "RGB", c, "Em")
        for nm, p in zip(names, ps):
            g.link(p, "", c, nm)
        rgb = g.node(unreal.MaterialExpressionComponentMask, 100, 700)
        rgb.set_editor_property("r", True); rgb.set_editor_property("g", True); rgb.set_editor_property("b", True); rgb.set_editor_property("a", False)
        g.link(c, "", rgb, "")
        am = g.node(unreal.MaterialExpressionComponentMask, 100, 800)
        am.set_editor_property("r", False); am.set_editor_property("g", False); am.set_editor_property("b", False); am.set_editor_property("a", True)
        g.link(c, "", am, "")
        prop(rgb, "", MP.MP_EMISSIVE_COLOR)
        prop(am, "", MP.MP_OPACITY)
        MEL.recompile_material(mat)
        EAL.save_loaded_asset(mat)
        return mat

    custom_light = look in ("Toon", "Cel", "Retro", "HalftoneCel", "InkToon")
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
                "float3 n = normalize(N); float3 lv = normalize(L.xyz); float3 vv = normalize(V); float l = dot(n, lv) * 0.5 + 0.5; " + band +
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
        elif look in ("HalftoneCel", "InkToon"):
            if look == "HalftoneCel":
                tint3 = vector("ShadowTint", [0.7, 0.25, 0.6, 1])
                rimc = vector("RimColour", [1, 0.65, 0.55, 1])
                pl = [scalar("Bands", 3), scalar("StepSoftness", 0.1), scalar("DottedFade", 0.5), scalar("DotCells", 90), scalar("DotsFollow", 0), scalar("ShadowDepth", 0.55), scalar("ShadowBoost", 0.5), scalar("TintAmount", 0.55), scalar("Highlight", 0.3), scalar("RimLight", 0.5), scalar("RimWidth", 0.35)]
                pn = ["Bands", "Soft", "Dots", "Cells", "Follow", "Depth", "Boost", "TintAmt", "Hl", "Rim", "RimW"]
                code = (
                    "float3 n = normalize(N); float3 lv = normalize(L.xyz); float3 vv = normalize(V); float l = dot(n, lv) * 0.5 + 0.5; float st = max(Bands, 1.0); float x = l * st; float i0 = floor(x); float f = x - i0; float lvl = i0;"
                    " if (Dots > 0.01) { float w = Dots * 0.5; float t = saturate((f - 0.5) / (w * 2.0 + 0.001) + 0.5);"
                    " float2 c2 = float2(UV.x + UV.y, UV.x - UV.y) * Cells; float2 cc = frac(c2) - 0.5; float pp = length(cc) * 1.4142; float aa = fwidth(pp) + 0.001;"
                    " float lu = pow(dot(Base, float3(0.2126, 0.7152, 0.0722)), 1.0 / 2.2); float tt = t * 1.15 + Follow * (0.5 - lu) * 1.2 * 4.0 * t * (1.0 - t);"
                    " lvl = i0 + (1.0 - smoothstep(tt - aa, tt + aa, pp)) * step(0.001, t); }"
                    " else lvl = i0 + smoothstep(0.5 - Soft, 0.5 + Soft + 0.0001, f);"
                    " float ramp = saturate(lvl / st);"
                    " float3 sh = Base * (1.0 - Depth); float sl = dot(sh, float3(0.2126, 0.7152, 0.0722)); sh = lerp(float3(sl, sl, sl), sh, 1.0 + Boost * 1.5); sh *= lerp(float3(1, 1, 1), Tint * 2.0, TintAmt);"
                    " float3 c = lerp(sh, Base, ramp);"
                    " float3 h = normalize(lv + vv); float sp = step(1.0 - Hl * 0.02, saturate(dot(n, h))) * step(0.01, Hl); c = lerp(c, float3(1, 1, 1), sp * 0.8);"
                    " float rim = smoothstep(1.0 - RimW, 1.0, 1.0 - saturate(dot(n, vv))) * Rim * smoothstep(-0.1, 0.5, dot(n, lv));"
                    " return c + RimC * rim;"
                )
                c = g.custom(code, ["Base", "N", "L", "V", "UV", "Tint", "RimC"] + pn, F3, -200, 700)
                g.link(tint3, "RGB", c, "Tint")
            else:
                shc = vector("ShadowColour", [0.45, 0.45, 0.75, 1])
                rimc = vector("RimColour", [1, 0.4, 0.35, 1])
                pl = [scalar("ShadowShapes", 2), scalar("EdgeSoftness", 0.03), scalar("ShadowStrength", 0.6), scalar("RimLight", 0.8), scalar("RimWidth", 0.3), scalar("RimFollows", 0.6)]
                pn = ["Steps", "Soft", "Shade", "Rim", "RimW", "Follows"]
                code = (
                    "float3 n = normalize(N); float3 lv = normalize(L.xyz); float3 vv = normalize(V); float l = dot(n, lv) * 0.5 + 0.5; float st = max(Steps, 1.0); float lvv = 0.0;"
                    " for (int k = 1; k <= 3; k++) { if ((float)k > st) break; float th = (float)k / (st + 1.0) * 1.1; lvv += smoothstep(th - Soft, th + Soft + 0.0001, l); }"
                    " float ramp = lvv / st;"
                    " float3 dark = Base * lerp(float3(1, 1, 1), ShC * 2.0, Shade) * lerp(1.0, 0.55, Shade);"
                    " float3 c = lerp(dark, Base, ramp);"
                    " float rim = smoothstep(1.0 - RimW, 1.0, 1.0 - saturate(dot(n, vv))) * Rim * lerp(1.0, smoothstep(-0.3, 0.3, dot(n, lv)), Follows);"
                    " return c + RimC * rim;"
                )
                c = g.custom(code, ["Base", "N", "L", "V", "ShC", "RimC"] + pn, F3, -200, 700)
                g.link(shc, "RGB", c, "ShC")
            g.link(albedo, "", c, "Base")
            g.link(N, "", c, "N")
            g.link(Lp, "", c, "L")
            g.link(V, "", c, "V")
            g.link(rimc, "RGB", c, "RimC")
            if look == "HalftoneCel":
                g.link(uvn, "", c, "UV")
            for nm, p in zip(pn, pl):
                g.link(p, "", c, nm)
        else:
            lv = vector("ColourLevels", [31, 31, 31, 1])
            amb = scalar("Ambient", 0.35)
            bri = scalar("Brightness", 1)
            stp = scalar("LightBands", 0)
            dth = scalar("DitherAmount", 0.6)
            code = (
                "float3 n = normalize(N); float l = saturate(dot(n, normalize(L.xyz)));"
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
        if look in ("Toon", "Cel", "HalftoneCel", "InkToon"):
            # one material does both: front faces shaded, back faces pushed out along the normals in the outline colour
            mat.set_editor_property("two_sided", True)
            mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_MASKED)
            oc = vector("OutlineColour", [0, 0, 0, 1])
            ow = scalar("OutlineWidth", 0.0)
            back = oc
            backpin = "RGB"
            if look in ("HalftoneCel", "InkToon"):
                # a darker version of the surface colour, or one picked colour (Ink toon)
                od = scalar("OutlineDark", 0.3 if look == "HalftoneCel" else 0.35)
                om = scalar("OutlineMode", 0)
                bc = g.custom("float3 c = Base * pow(Dk, 2.2); float lu = dot(c, float3(0.3333, 0.3333, 0.3333)); c = lerp(float3(lu, lu, lu), c, 1.25); return lerp(c, Pick, Mode);", ["Base", "Dk", "Mode", "Pick"], F3, -200, 1500)
                g.link(albedo, "", bc, "Base")
                g.link(od, "", bc, "Dk")
                g.link(om, "", bc, "Mode")
                g.link(oc, "RGB", bc, "Pick")
                back = bc
                backpin = ""
            sw = g.node(unreal.MaterialExpressionTwoSidedSwitch, 100, 650)
            g.link(c, "", sw, "Front")
            g.link(back, backpin, sw, "Back")
            prop(sw, "", MP.MP_EMISSIVE_COLOR)
            vn = g.node(unreal.MaterialExpressionVertexNormalWS, -200, 1200)
            mul = g.node(unreal.MaterialExpressionMultiply, 0, 1150)
            g.link(vn, "", mul, "A")
            g.link(ow, "", mul, "B")
            if look == "InkToon":
                # a hand-drawn wobble in the line width
                wob = scalar("Wobble", 0.4)
                wp = no_lwc(g, g.node(unreal.MaterialExpressionWorldPosition, -350, 1300), -250, 1300)
                wc = g.custom("float n = sin(dot(P, float3(37, 23, 29)) * 0.01) * 0.5 + sin(dot(P, float3(17, 41, 31)) * 0.01) * 0.5; return 1.0 + W * 0.7 * n;", ["P", "W"], F1, -100, 1300)
                g.link(wp, "", wc, "P")
                g.link(wob, "", wc, "W")
                mul2 = g.node(unreal.MaterialExpressionMultiply, 100, 1180)
                g.link(mul, "", mul2, "A")
                g.link(wc, "", mul2, "B")
                mul = mul2
            zero = g.node(unreal.MaterialExpressionConstant3Vector, 0, 1250)
            sw2 = g.node(unreal.MaterialExpressionTwoSidedSwitch, 250, 1200)
            g.link(zero, "", sw2, "Front")
            g.link(mul, "", sw2, "Back")
            prop(sw2, "", MP.MP_WORLD_POSITION_OFFSET)
            one = g.node(unreal.MaterialExpressionConstant, 250, 1350)
            one.set_editor_property("r", 1.0)
            prop(one, "", MP.MP_OPACITY_MASK)
        else:
            prop(c, "", MP.MP_EMISSIVE_COLOR)
        MEL.recompile_material(mat)
        EAL.save_loaded_asset(mat)
        return mat

    # lit looks
    prop(albedo, "", MP.MP_BASE_COLOR)
    prop(rough, "", MP.MP_ROUGHNESS)
    prop(metal, "", MP.MP_METALLIC)
    prop(occl, "", MP.MP_AMBIENT_OCCLUSION)
    prop(nrmc, "", MP.MP_NORMAL)
    prop(emi, "RGB", MP.MP_EMISSIVE_COLOR)
    if alpha:
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        prop(base, "A", MP.MP_OPACITY)
    if look == "BrushedMetal":
        try:
            a = scalar("Stretch", 0.7)
            prop(a, "", MP.MP_ANISOTROPY)
        except Exception as e:
            unreal.log_warning("Gouache: anisotropy needs Unreal 5.1 or newer (" + str(e) + ")")
    elif look == "Velvet":
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_CLOTH)
        col = vector("SheenColour", [1, 1, 1, 1])
        prop(col, "RGB", MP.MP_SUBSURFACE_COLOR)
        amt = scalar("Sheen", 0.5)
        prop(amt, "", MP.MP_CUSTOM_DATA_0)
    elif look == "Glass":
        # lit, see-through, bending what is behind it (the refraction input), tinted, frosted
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        mat.set_editor_property("two_sided", True)
        try:
            mat.set_editor_property("refraction_mode", unreal.RefractionMode.RM_INDEX_OF_REFRACTION)
        except Exception:
            pass
        N = g.node(unreal.MaterialExpressionPixelNormalWS, -500, 920)
        V = g.node(unreal.MaterialExpressionCameraVectorWS, -500, 1040)
        gcol = vector("GlassColour", [0.9, 0.97, 1, 1])
        bend = scalar("Bending", 0.5)
        frost = scalar("Frost", 0)
        edge = scalar("EdgeReflect", 1)
        cloud = scalar("Cloudiness", 0.08)
        thick = scalar("Thickness", 0.5)
        ior = g.custom("return 1.0 + 0.5 * B;", ["B"], F1, -200, 900)
        g.link(bend, "", ior, "B")
        prop(ior, "", MP.MP_REFRACTION)
        tintc = g.custom("float3 gc = max(G, float3(0.02, 0.02, 0.02)); return Base * lerp(float3(1, 1, 1), gc, saturate(Th * 0.8));", ["Base", "G", "Th"], F3, -200, 1000)
        g.link(albedo, "", tintc, "Base")
        g.link(gcol, "RGB", tintc, "G")
        g.link(thick, "", tintc, "Th")
        prop(tintc, "", MP.MP_BASE_COLOR)
        fr = g.custom("float f = (0.04 + 0.96 * pow(1.0 - saturate(dot(normalize(N), normalize(V))), 5.0)) * E; return saturate(Cl + f + F * 0.5);", ["N", "V", "E", "Cl", "F"], F1, -200, 1100)
        g.link(N, "", fr, "N")
        g.link(V, "", fr, "V")
        g.link(edge, "", fr, "E")
        g.link(cloud, "", fr, "Cl")
        g.link(frost, "", fr, "F")
        prop(fr, "", MP.MP_OPACITY)
        rg = g.custom("return saturate(F * 0.6 + 0.02);", ["F"], F1, -200, 1200)
        g.link(frost, "", rg, "F")
        prop(rg, "", MP.MP_ROUGHNESS)
        prop(g.node(unreal.MaterialExpressionConstant, -200, 1300), "", MP.MP_METALLIC)
    elif look == "Fur":
        # Unreal has no strand shells in a material: a fuzzy cloth look with dark roots and a tip colour
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_CLOTH)
        tipc = vector("TipColour", [0.95, 0.85, 0.7, 1])
        prop(tipc, "RGB", MP.MP_SUBSURFACE_COLOR)
        tipa = scalar("TipAmount", 0.5)
        dr = scalar("DarkRoots", 0.5)
        prop(tipa, "", MP.MP_CUSTOM_DATA_0)
        bc = g.custom("return Base * (1.0 - D * 0.4);", ["Base", "D"], F3, -200, 1000)
        g.link(albedo, "", bc, "Base")
        g.link(dr, "", bc, "D")
        prop(bc, "", MP.MP_BASE_COLOR)
        rg = g.custom("return max(R, 0.85);", ["R"], F1, -200, 1100)
        g.link(rough, "", rg, "R")
        prop(rg, "", MP.MP_ROUGHNESS)
    elif look == "Iridescent":
        N = g.node(unreal.MaterialExpressionPixelNormalWS, -500, 920)
        V = g.node(unreal.MaterialExpressionCameraVectorWS, -500, 1040)
        st = scalar("IriStrength", 0.8)
        rg_ = scalar("IriRange", 1.5)
        sh_ = scalar("IriShift", 0)
        an = scalar("IriAngle", 0.8)
        bc = g.custom("float nv = saturate(dot(normalize(N), normalize(V))); float t = Sh + Rg * (0.3 + An * (1.0 - nv)); float3 film = 0.5 + 0.5 * cos(6.2832 * (t + float3(0.0, 0.33, 0.67))); return lerp(Base, lerp(film, float3(1, 1, 1), 0.15), S * 0.85);", ["Base", "N", "V", "S", "Rg", "Sh", "An"], F3, -200, 1000)
        for nm, src, pin in (("Base", albedo, ""), ("N", N, ""), ("V", V, ""), ("S", st, ""), ("Rg", rg_, ""), ("Sh", sh_, ""), ("An", an, "")):
            g.link(src, pin, bc, nm)
        prop(bc, "", MP.MP_BASE_COLOR)
        mc = g.custom("return lerp(M, 1.0, 0.6 * S);", ["M", "S"], F1, -200, 1100)
        g.link(metal, "", mc, "M")
        g.link(st, "", mc, "S")
        prop(mc, "", MP.MP_METALLIC)
    elif look == "CarPaint":
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_CLEAR_COAT)
        coat = scalar("Coat", 1)
        crough = scalar("CoatRoughness", 0.04)
        try:
            prop(coat, "", MP.MP_CUSTOM_DATA_0)
            prop(crough, "", MP.MP_CUSTOM_DATA_1)
        except Exception as e:
            unreal.log_warning("Gouache: clear coat inputs could not be connected (" + str(e) + ")")
        P = no_lwc(g, g.node(unreal.MaterialExpressionWorldPosition, -650, 1160), -500, 1160)
        fsz = scalar("FlakeSize", 170)
        fam = scalar("FlakeAmount", 0.5)
        fsp = scalar("FlakeSparkle", 1)
        fcol = vector("FlakeColour", [1, 0.85, 0.5, 1])
        fk = g.custom(
            "float3 q = mul(float3x3(0.36, -0.8, 0.48, 0.48, 0.6, 0.64, -0.8, 0.0, 0.6), P * 0.01) * Sz * 0.85; float3 ci = floor(q); float3 fr = frac(q) - 0.5; float fw = length(fwidth(q));"
            " float h1 = frac(sin(dot(ci, float3(127.1, 311.7, 74.7))) * 43758.5453); float h2 = frac(sin(dot(ci + 17.1, float3(127.1, 311.7, 74.7))) * 43758.5453);"
            " float h3 = frac(sin(dot(ci + 43.7, float3(127.1, 311.7, 74.7))) * 43758.5453); float h4 = frac(sin(dot(ci + 91.3, float3(127.1, 311.7, 74.7))) * 43758.5453);"
            " float rad = 0.22 + 0.28 * h4; float fm = step(h1, Am * 0.8) * smoothstep(rad, rad * 0.55, length(fr)) * (1.0 - smoothstep(0.5, 1.0, fw)); return float4(fm, h2, h3, h4);",
            ["P", "Sz", "Am"], F4, -200, 1000)
        g.link(P, "", fk, "P")
        g.link(fsz, "", fk, "Sz")
        g.link(fam, "", fk, "Am")
        bc = g.custom("return lerp(Base, lerp(Fc, Base, 0.2) * (0.6 + 0.8 * FK.w), FK.x * 0.7);", ["Base", "FK", "Fc"], F3, -200, 1100)
        g.link(albedo, "", bc, "Base")
        g.link(fk, "", bc, "FK")
        g.link(fcol, "RGB", bc, "Fc")
        prop(bc, "", MP.MP_BASE_COLOR)
        rg = g.custom("return lerp(R, 0.12, FK.x);", ["R", "FK"], F1, -200, 1200)
        g.link(rough, "", rg, "R")
        g.link(fk, "", rg, "FK")
        prop(rg, "", MP.MP_ROUGHNESS)
        mc = g.custom("return lerp(M, 1.0, FK.x);", ["M", "FK"], F1, -200, 1300)
        g.link(metal, "", mc, "M")
        g.link(fk, "", mc, "FK")
        prop(mc, "", MP.MP_METALLIC)
        nc = g.custom("float2 np = (float2(FK.y, FK.z) - 0.5) * 1.6; return normalize(N + float3(np * 1.5 * FK.x * Sp, 0));", ["N", "FK", "Sp"], F3, -200, 1400)
        g.link(nrmc, "", nc, "N")
        g.link(fk, "", nc, "FK")
        g.link(fsp, "", nc, "Sp")
        prop(nc, "", MP.MP_NORMAL)
    elif look == "ClothSheen":
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_CLOTH)
        col = vector("ClothColour", [1, 0.9, 0.85, 1])
        prop(col, "RGB", MP.MP_SUBSURFACE_COLOR)
        amt = scalar("ClothSheen", 1)
        soft = scalar("Softness", 0.5)
        weave = scalar("Weave", 0.4)
        cl = g.custom("return saturate(S * 0.6);", ["S"], F1, -200, 900)
        g.link(amt, "", cl, "S")
        prop(cl, "", MP.MP_CUSTOM_DATA_0)
        bc = g.custom("return B * lerp(1.0, 0.55 + 0.45 * sin(UV.x * 200.0) * sin(UV.y * 200.0), W);", ["B", "UV", "W"], F3, -200, 1000)
        g.link(albedo, "", bc, "B")
        g.link(uvn, "", bc, "UV")
        g.link(weave, "", bc, "W")
        prop(bc, "", MP.MP_BASE_COLOR)
        rg = g.custom("return max(R, lerp(0.3, 0.7, So));", ["R", "So"], F1, -200, 1100)
        g.link(rough, "", rg, "R")
        g.link(soft, "", rg, "So")
        prop(rg, "", MP.MP_ROUGHNESS)
    elif look == "Wax":
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_SUBSURFACE)
        col = vector("GlowColour", [1, 0.62, 0.3, 1])
        prop(col, "RGB", MP.MP_SUBSURFACE_COLOR)
        glow = scalar("Glow", 1.5)
        soft = scalar("WaxSoftness", 0.6)
        cl = g.custom("return saturate(G * 0.5);", ["G"], F1, -200, 900)
        g.link(glow, "", cl, "G")
        prop(cl, "", MP.MP_OPACITY)
        rg = g.custom("return lerp(R, max(R, 0.5), So);", ["R", "So"], F1, -200, 1100)
        g.link(rough, "", rg, "R")
        g.link(soft, "", rg, "So")
        prop(rg, "", MP.MP_ROUGHNESS)
    elif look == "Skin":
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_SUBSURFACE)
        col = vector("BloodColour", [0.85, 0.25, 0.18, 1])
        prop(col, "RGB", MP.MP_SUBSURFACE_COLOR)
        amt = scalar("ScatterStrength", 0.5)
        prop(amt, "", MP.MP_OPACITY)
    MEL.recompile_material(mat)
    EAL.save_loaded_asset(mat)
    return mat


MASTER_FIXED = 3


def master_version(mat):
    try:
        return int(EAL.get_metadata_tag(mat, "gouache_master") or 0)
    except Exception:
        return 0


def master_for(S):
    look = S["look"]
    alpha = bool(S.get("alpha")) and look not in ("Toon", "Cel", "Retro", "HalftoneCel", "InkToon", "Hologram", "Glass")
    path = master_path(look, alpha)
    if EAL.does_asset_exist(path):
        mat = EAL.load_asset(path)
        if master_version(mat) < MASTER_FIXED:
            unreal.log("Gouache: rebuilding " + path + " (made by an older Gouache that left wires unconnected)")
            return build_master(look, S["kind"], alpha, S, mat)
        if DATA.get("updateMasters"):
            unreal.log("Gouache: updating the master material " + path)
            return build_master(look, S["kind"], alpha, S, mat)
        return mat
    return build_master(look, S["kind"], alpha, S)


# ---------------------------------------------------------------- one asset's instance
def set_params(mi, scalars, vectors, skip=()):
    for n, v in scalars.items():
        if n not in skip:
            MEL.set_material_instance_scalar_parameter_value(mi, n, float(v))
    for n, v in vectors.items():
        if n not in skip:
            MEL.set_material_instance_vector_parameter_value(mi, n, unreal.LinearColor(v[0], v[1], v[2], v[3] if len(v) > 3 else 1.0))


def variant_parent(S, master):
    """A variant is a parent Material Instance holding one look's settings; assets that use it only add their textures."""
    name = "MI_Variant_" + S["look"] + "_" + S["variant"].replace(" ", "_")
    path = VARIANTS + "/" + name
    if EAL.does_asset_exist(path):
        vi = EAL.load_asset(path)
    else:
        vi = TOOLS.create_asset(name, VARIANTS, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    MEL.set_material_instance_parent(vi, master)
    keys = set(S.get("lookKeys", []))
    set_params(vi, {k: v for k, v in S["scalars"].items() if k in keys}, {k: v for k, v in S["vectors"].items() if k in keys})
    MEL.update_material_instance(vi)
    EAL.save_loaded_asset(vi)
    return vi


def make_instance(S, master):
    name = "MI_" + S["safe"]
    path = DEST + "/" + name
    if EAL.does_asset_exist(path):
        mi = EAL.load_asset(path)
    else:
        mi = TOOLS.create_asset(name, DEST, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    parent = variant_parent(S, master) if S.get("variant") else master
    MEL.set_material_instance_parent(mi, parent)
    for key, fname, kind in (("BaseColor", None, "color"), ("ORM", None, "data"), ("Normal", None, "normal"), ("Emissive", None, "color")):
        f = S["tex"].get(key)
        if not f:
            continue
        tex = import_texture(f, kind)
        if tex is not None:
            pname = {"BaseColor": "BaseColorTex", "ORM": "ORMTex", "Normal": "NormalTex", "Emissive": "EmissiveTex"}[key]
            MEL.set_material_instance_texture_parameter_value(mi, pname, tex)
    # a variant's look settings come from its parent; the asset only sets the rest
    set_params(mi, S["scalars"], S["vectors"], skip=set(S.get("lookKeys", [])) if S.get("variant") else ())
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
    kinds = tuple(c for c in (getattr(unreal, "StaticMesh", None), getattr(unreal, "SkeletalMesh", None)) if c)
    mesh = import_file(path, DEST, opts, kinds)
    if mesh is None:
        unreal.log_error("Gouache: " + mfile + " did not import as a mesh (see the lines above for Unreal's reason)")
        return
    done, missing = 0, []
    if isinstance(mesh, unreal.StaticMesh):
        slots = mesh.get_editor_property("static_materials")
        for i, slot in enumerate(slots):
            sname = str(slot.get_editor_property("material_slot_name"))
            mi = instances.get(sname) or instances.get(sname.replace(" ", "_"))
            if mi is not None:
                mesh.set_material(i, mi)
                done += 1
            else:
                missing.append(sname)
    else:
        mats = list(mesh.get_editor_property("materials"))
        for i, sm in enumerate(mats):
            sname = str(sm.get_editor_property("material_slot_name"))
            mi = instances.get(sname) or instances.get(sname.replace(" ", "_"))
            if mi is not None:
                sm.set_editor_property("material_interface", mi)
                mats[i] = sm
                done += 1
            else:
                missing.append(sname)
        mesh.set_editor_property("materials", mats)
    EAL.save_loaded_asset(mesh)
    unreal.log("Gouache: " + mfile + " imported, %d material slot(s) set" % done + ((", no material for: " + ", ".join(missing)) if missing else ""))


LIGHTS = None
if any(S["look"] in ("Toon", "Cel", "Retro", "HalftoneCel", "InkToon") for S in DATA["sets"]):
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
        unreal.log_error("Gouache: " + S["name"] + " (" + S["look"] + ") failed: " + str(e) + "\n" + traceback.format_exc())
for U in DATA.get("updates", []):
    # a look changed for assets already in the game: only parameters are updated, nothing is imported again
    try:
        if U.get("kind") == "variant":
            path = VARIANTS + "/MI_Variant_" + U["look"] + "_" + U["variant"].replace(" ", "_")
        else:
            path = ROOT + "/" + U["asset"] + "/MI_" + U["safe"]
        if EAL.does_asset_exist(path):
            ui = EAL.load_asset(path)
            set_params(ui, U["scalars"], U["vectors"])
            MEL.update_material_instance(ui)
            EAL.save_loaded_asset(ui)
            unreal.log("Gouache: updated " + path)
    except Exception as e:
        unreal.log_error("Gouache: could not update " + str(U.get("asset") or U.get("variant")) + ": " + str(e))
if not DATA["sets"]:
    unreal.log_warning("Gouache: this export had no texture sets to set up (was the Gouache shader tick off?)")
try:
    assign_to_model(inst)
except Exception as e:
    unreal.log_error("Gouache: the model could not be set up: " + str(e) + "\n" + traceback.format_exc())
if FAILED:
    unreal.log_error("Gouache: %d wires could not be connected (please send this to the Gouache author): %s" % (len(FAILED), "; ".join(FAILED[:40])))
unreal.log("Gouache: made %d of %d material(s) in %s: %s" % (len(made), len(DATA["sets"]), DEST, ", ".join(made)))
try:
    # the link starts any setup that came in while Unreal was closed; this marks this one as done
    open(os.path.join(HERE, ".gouache_done"), "w").write("done")
except Exception:
    pass
