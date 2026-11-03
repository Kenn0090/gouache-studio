// Gouache Studio · native viewer · physically based shading lit by the environment and one sun
struct Frame {
    view_proj: mat4x4<f32>,
    inv_view_proj: mat4x4<f32>,
    cam_pos: vec4<f32>,
    sun_dir: vec4<f32>,      // toward the sun
    sun_col: vec4<f32>,      // rgb × intensity
    params: vec4<f32>,       // x exposure, y environment turn (turns), z environment strength, w tone mapping
    info: vec4<f32>,         // x mip levels, y 1 when there is an environment, z show background
    sh: array<vec4<f32>, 9>, // diffuse lighting of the environment (already divided by pi)
    extra: vec4<f32>,        // x seconds, y size of a screen pixel at the model's distance
    cursor: vec4<f32>,       // brush outline: x, y, radius (pixels), 1 when shown
    res: vec4<f32>,          // width, height
};
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var env_tex: texture_2d<f32>;
@group(0) @binding(2) var env_smp: sampler;
@group(0) @binding(3) var spec_tex: texture_2d_array<f32>;   // the environment blurred for roughness 0, 0.2, 0.4, 0.6, 0.8, 1

struct Mat {
    flags: vec4<f32>,        // x has orm, y rough fallback, z metal fallback, w unused
    tint: vec4<f32>,
    shk: vec4<f32>,          // x the shader (0 standard, 1 skin, 2 brushed metal, 3 velvet, 4 toon, 5 cel, 6 spec/gloss, 7 panner, 8 retro)
    shp: vec4<f32>,          // the shader's settings, as the 3D view keeps them
    shq: vec4<f32>,
    shc: vec4<f32>,
    shd: vec4<f32>,
    skin: vec4<f32>,
};
@group(1) @binding(0) var base_tex: texture_2d<f32>;
@group(1) @binding(1) var orm_tex: texture_2d<f32>;
@group(1) @binding(2) var nrm_tex: texture_2d<f32>;
@group(1) @binding(3) var emi_tex: texture_2d<f32>;
@group(1) @binding(4) var tex_smp: sampler;
@group(1) @binding(5) var<uniform> mat: Mat;

const PI: f32 = 3.14159265;

fn env_turn(d: vec3<f32>) -> vec3<f32> {
    let a = frame.params.y * 2.0 * PI;
    let w = -d.z;
    let x2 = d.x * cos(a) + w * sin(a);
    let w2 = w * cos(a) - d.x * sin(a);
    return vec3<f32>(x2, d.y, -w2);
}
fn env_uv(d: vec3<f32>) -> vec2<f32> {
    return vec2<f32>(atan2(d.x, -d.z) / (2.0 * PI) + 0.5, acos(clamp(d.y, -1.0, 1.0)) / PI);
}
fn env_sample(d: vec3<f32>, lod: f32) -> vec3<f32> {
    return textureSampleLevel(env_tex, env_smp, env_uv(env_turn(d)), lod).rgb * frame.params.z;
}
// reflections: the environment already blurred the way a surface of this roughness blurs it
fn env_spec(d: vec3<f32>, rough: f32) -> vec3<f32> {
    let uv = env_uv(env_turn(d));
    let f = clamp(rough, 0.0, 1.0) * 5.0;
    let i0 = i32(floor(f));
    let i1 = min(i0 + 1, 5);
    let a = textureSampleLevel(spec_tex, env_smp, uv, i0, 0.0).rgb;
    let b = textureSampleLevel(spec_tex, env_smp, uv, i1, 0.0).rgb;
    return mix(a, b, f - f32(i0)) * frame.params.z;
}
fn sh_diffuse(n0: vec3<f32>) -> vec3<f32> {
    let n = env_turn(n0);
    var c = frame.sh[0].rgb * 0.282095;
    c += frame.sh[1].rgb * 0.488603 * n.y + frame.sh[2].rgb * 0.488603 * n.z + frame.sh[3].rgb * 0.488603 * n.x;
    c += frame.sh[4].rgb * 1.092548 * n.x * n.y + frame.sh[5].rgb * 1.092548 * n.y * n.z + frame.sh[6].rgb * 0.315392 * (3.0 * n.z * n.z - 1.0)
       + frame.sh[7].rgb * 1.092548 * n.x * n.z + frame.sh[8].rgb * 0.546274 * (n.x * n.x - n.y * n.y);
    return max(c, vec3<f32>(0.0)) * frame.params.z;
}
fn tone(c0: vec3<f32>) -> vec3<f32> {
    let c = c0 * frame.params.x;
    let t = i32(frame.params.w);
    if (t == 5) { return clamp(c, vec3<f32>(0.0), vec3<f32>(1.0)); }
    if (t == 0) { return clamp(c / (c + vec3<f32>(1.0)), vec3<f32>(0.0), vec3<f32>(1.0)); }
    let k = c * 0.6;
    return clamp((k * (2.51 * k + 0.03)) / (k * (2.43 * k + 0.59) + 0.14), vec3<f32>(0.0), vec3<f32>(1.0));
}
fn env_brdf(rough: f32, nv: f32) -> vec2<f32> {
    let c0 = vec4<f32>(-1.0, -0.0275, -0.572, 0.022);
    let c1 = vec4<f32>(1.0, 0.0425, 1.04, -0.04);
    let r = rough * c0 + c1;
    let a004 = min(r.x * r.x, exp2(-9.28 * nv)) * r.x + r.y;
    return vec2<f32>(-1.04, 1.04) * a004 + r.zw;
}

struct VIn {
    @location(0) pos: vec3<f32>,
    @location(1) nrm: vec3<f32>,
    @location(2) uv: vec2<f32>,
};
struct VOut {
    @builtin(position) clip: vec4<f32>,
    @location(0) wpos: vec3<f32>,
    @location(1) nrm: vec3<f32>,
    @location(2) uv: vec2<f32>,
};

@vertex
fn vs(i: VIn) -> VOut {
    var o: VOut;
    o.clip = frame.view_proj * vec4<f32>(i.pos, 1.0);
    o.wpos = i.pos;
    o.nrm = i.nrm;
    o.uv = i.uv;
    return o;
}

fn lin3(c: vec3<f32>) -> vec3<f32> { return pow(max(c, vec3<f32>(0.0)), vec3<f32>(2.2)); }
fn bayer(p: vec2<f32>) -> f32 {
    let x = i32(p.x) & 3;
    let y = i32(p.y) & 3;
    var v = 0;
    for (var k = 0; k < 2; k = k + 1) {
        let xb = (x >> u32(k)) & 1;
        let yb = (y >> u32(k)) & 1;
        v = v | ((((xb ^ yb) << 1u) | yb) << u32(2 * (1 - k)));
    }
    return (f32(v) + 0.5) / 16.0;
}

var<private> g_sf: f32 = 0.0;
fn lum(c: vec3<f32>) -> f32 { return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722)); }

struct FOut {
    @location(0) c: vec4<f32>,
    @location(1) n: vec4<f32>,   // world normal (0..1) and the share of the light that comes from the sun; w = 0 where there is no surface
};

@fragment
fn fs(i: VOut) -> FOut {
    var o: FOut;
    g_sf = 0.0;
    o.c = fs_shade(i);
    var nw = normalize(i.nrm);
    if (dot(nw, normalize(frame.cam_pos.xyz - i.wpos)) < 0.0) { nw = -nw; }
    o.n = vec4<f32>(nw * 0.5 + 0.5, 0.25 + 0.75 * g_sf);
    return o;
}

fn fs_shade(i: VOut) -> vec4<f32> {
    let kind = i32(mat.shk.x + 0.5);
    var uv = i.uv;
    if (kind == 7) { uv = uv + frame.extra.x * mat.shd.xy; }   // panner: the maps slide
    var n = normalize(i.nrm);
    let v = normalize(frame.cam_pos.xyz - i.wpos);
    if (dot(n, v) < 0.0) { n = -n; }

    // retro: the maps are read as a small grid of texels
    var base_uv = uv;
    var lodbias = 0.0;
    if (kind == 8) {
        let res = max(mat.shp.x, 1.0);
        let sz = vec2<f32>(textureDimensions(base_tex, 0));
        let r = vec2<f32>(res, res * sz.y / sz.x);
        if (mat.shp.y < 1.5) { base_uv = (floor(uv * r) + 0.5) / r; }
        lodbias = max(log2(max(sz.x / r.x, 1.0)), 0.0);
    }
    let guv = base_uv;
    let dp1 = dpdx(i.wpos);
    let dp2 = dpdy(i.wpos);
    let duv1 = dpdx(uv);
    let duv2 = dpdy(uv);
    let dp2perp = cross(dp2, n);
    let dp1perp = cross(n, dp1);
    let t0 = dp2perp * duv1.x + dp1perp * duv2.x;
    let b0 = dp2perp * duv1.y + dp1perp * duv2.y;
    let invmax = inverseSqrt(max(max(dot(t0, t0), dot(b0, b0)), 1e-20));
    let tt = t0 * invmax;
    let bb = b0 * invmax;
    var albedo4 = textureSampleGrad(base_tex, tex_smp, guv, duv1, duv2);
    if (kind == 8) { albedo4 = textureSampleLevel(base_tex, tex_smp, guv, lodbias); }
    let albedo = albedo4.rgb * mat.tint.rgb;
    var nn = n;
    if (kind != 8) {
        let tn = textureSample(nrm_tex, tex_smp, guv).xyz * 2.0 - 1.0;
        nn = normalize(mat3x3<f32>(tt, bb, n) * tn);
    }
    var rough = mat.flags.y;
    var metal = mat.flags.z;
    var ao = 1.0;
    if (mat.flags.x > 0.5) {
        let orm = textureSample(orm_tex, tex_smp, guv).rgb;
        ao = orm.r;
        rough = orm.g;
        metal = orm.b;
    }
    rough = clamp(rough, 0.04, 1.0);
    let emis = textureSample(emi_tex, tex_smp, guv).rgb;

    let nv = max(dot(nn, v), 1e-3);
    let l = normalize(frame.sun_dir.xyz);
    let h = normalize(l + v);
    let nl = max(dot(nn, l), 0.0);
    let nh = max(dot(nn, h), 0.0);
    let vh = max(dot(v, h), 0.0);
    let f0 = mix(vec3<f32>(0.04), albedo, metal);
    let sun = frame.sun_col.rgb;
    let skyi = 1.0;

    // ---- retro: a plain light, banded if asked, fog, few colours with a dither ----
    if (kind == 8) {
        var lr = max(dot(n, l), 0.0);
        if (mat.shq.x > 0.5) { lr = floor(lr * mat.shq.x + 0.5) / mat.shq.x; }
        let amb = mat.shq.z;
        var c = pow(albedo, vec3<f32>(1.0 / 2.2)) * (amb + (1.0 - amb) * lr) * mat.shq.w * frame.params.x;
        c = c + emis;
        let fg = 1.0 - exp(-length(frame.cam_pos.xyz - i.wpos) * mat.shq.y * 0.35);
        c = mix(c, mat.shd.rgb, clamp(fg, 0.0, 1.0));
        c = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
        c = floor(c * mat.shc.rgb + 0.5 + (bayer(i.clip.xy) - 0.5) * mat.shp.z) / mat.shc.rgb;
        return vec4<f32>(lin3(clamp(c, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
    }

    // ---- toon and cel: flat bands of light from the sun ----
    if (kind == 4 || kind == 5) {
        let lt = dot(nn, l) * 0.5 + 0.5;
        var band = 0.0;
        if (kind == 4) {
            let st = max(mat.shp.x, 1.0);
            band = floor(lt * st + 0.5 * mat.shq.y) / st;
        } else {
            band = smoothstep(mat.shp.x - mat.shp.y * 0.5, mat.shp.x + mat.shp.y * 0.5 + 1e-4, lt);
        }
        let bs = mix(albedo * lin3(mat.shc.rgb), albedo, clamp(band, 0.0, 1.0));
        let sp = step(1.0 - mat.shp.z * 0.05, nh) * (1.0 - rough * 0.5) * step(0.01, mat.shp.z);
        let rim = smoothstep(1.0 - mat.shp.w, 1.0, 1.0 - nv) * mat.shp.w;
        var amb = vec3<f32>(0.2);
        if (frame.info.y > 0.5) { amb = sh_diffuse(nn) * 0.25; }
        var col = bs * (0.75 + 0.25 * frame.params.z) + bs * amb * ao + vec3<f32>(sp) + albedo * rim;
        col = col + emis * 2.0;
        return vec4<f32>(clamp(col * frame.params.x, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
    }

    // ---- the lit shaders ----
    let diff_col = albedo * (1.0 - metal);
    let a = rough * rough;
    let a2 = a * a;
    var d = a2 / (PI * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0));
    var ts = tt;
    var bs2 = bb;
    if (kind == 2) {
        let ang = mat.shp.y * 2.0 * PI;
        ts = normalize(tt * cos(ang) + bb * sin(ang));
        ts = normalize(ts - nn * dot(nn, ts));
        bs2 = cross(nn, ts);
        let an = clamp(mat.shp.x, -0.95, 0.95);
        let ax = max(a * (1.0 + an), 0.002);
        let ay = max(a * (1.0 - an), 0.002);
        let th = dot(ts, h) / ax;
        let bh = dot(bs2, h) / ay;
        let q = th * th + bh * bh + nh * nh;
        d = 1.0 / (PI * ax * ay * q * q);
    }
    let vis = 0.5 / max(nl * sqrt(nv * nv * (1.0 - a2) + a2) + nv * sqrt(nl * nl * (1.0 - a2) + a2), 0.0001);
    let f = f0 + (vec3<f32>(1.0) - f0) * pow(1.0 - vh, 5.0);
    let spec = d * vis * f;
    let dif = (vec3<f32>(1.0) - f) * (1.0 - metal) * albedo / PI;
    var col = (dif + spec) * nl * sun;
    var thick = mat.shp.w;
    if (kind == 1) {
        let ns = normalize(mix(nn, n, mat.shp.z));
        let sss = clamp(mat.shc.rgb, vec3<f32>(0.02), vec3<f32>(1.0));
        let wrap = mat.shp.x * vec3<f32>(0.8, 0.38, 0.18);
        var dl = max((vec3<f32>(dot(ns, l)) + wrap) / (vec3<f32>(1.0) + wrap), vec3<f32>(0.0)) / (vec3<f32>(1.0) + wrap);
        dl = mix(vec3<f32>(max(dot(ns, l), 0.0)), dl, clamp(mat.shp.y, 0.0, 1.0));
        let attenuation = exp(-max(thick, 0.0) * mat.skin.y / sss);
        let back = max(dot(-ns, l), 0.0);
        let transmitted = attenuation * sss * back * mat.skin.z * mat.shp.y;
        let sr = clamp(mix(rough, mat.skin.x, 0.75), 0.08, 1.0);
        let ar = sr * sr;
        let dd = nh * nh * (ar * ar - 1.0) + 1.0;
        let surface = vec3<f32>(0.028) * (ar * ar / (PI * dd * dd)) * 0.25 * nl;
        col = ((vec3<f32>(1.0) - f) * (1.0 - metal) * albedo / PI * dl + surface) * sun + transmitted * albedo * sun * 0.5;
    }
    if (kind == 3) {
        let sr = max(mat.shp.y, 0.05);
        let sn = sqrt(max(1.0 - nh * nh, 0.0));
        let dc = (2.0 + 1.0 / sr) * pow(sn, 1.0 / sr) / (2.0 * PI);
        col += lin3(mat.shc.rgb) * mat.shp.x * dc * nl * sun / max(4.0 * (nl + nv - nl * nv), 1e-3);
    }

    let sun_part = col;
    // ---- light from the environment ----
    var nr = nn;
    if (kind == 2) {
        let at = cross(bs2, v);
        let an2 = normalize(cross(at, bs2));
        nr = normalize(mix(nn, an2, abs(mat.shp.x) * clamp(1.0 - rough * 0.5, 0.0, 1.0)));
    }
    var env_d = vec3<f32>(0.0);
    var env_s = vec3<f32>(0.0);
    if (frame.info.y > 0.5) {
        let r = reflect(-v, nr);
        let ab = env_brdf(rough, nv);
        env_d = diff_col * sh_diffuse(nn);
        env_s = env_spec(r, rough) * (f0 * ab.x + vec3<f32>(ab.y));
        if (kind == 1) {
            let ns = normalize(mix(nn, n, mat.shp.z));
            let sss = clamp(mat.shc.rgb, vec3<f32>(0.02), vec3<f32>(1.0));
            let attenuation = exp(-max(thick, 0.0) * mat.skin.y / sss);
            env_d = diff_col * sh_diffuse(ns) + sh_diffuse(-ns) * attenuation * sss * albedo * mat.shp.y * mat.skin.z * 0.25;
            let sr = clamp(mix(rough, mat.skin.x, 0.75), 0.08, 1.0);
            let sab = env_brdf(sr, nv);
            env_s = env_spec(reflect(-v, nn), sr) * (vec3<f32>(0.028) * sab.x + sab.y);
        }
        if (kind == 3) { env_s += lin3(mat.shc.rgb) * mat.shp.x * sh_diffuse(nn) * pow(1.0 - nv, max(mat.shp.z, 0.5) * 3.0 + 1.0); }
    } else {
        let hemi = mix(vec3<f32>(0.25), vec3<f32>(0.6, 0.7, 0.85), nn.y * 0.5 + 0.5);
        env_d = diff_col * hemi;
    }
    if (kind == 6) {
        let m = i32(mat.shp.x + 0.5);
        if (m == 1) { return vec4<f32>(diff_col, 1.0); }
        if (m == 2) { return vec4<f32>(f0, 1.0); }
        if (m == 3) { return vec4<f32>(vec3<f32>(lin3(vec3<f32>(1.0 - rough)).x), 1.0); }
        if (m == 4) { return vec4<f32>(tone(env_s * ao), 1.0); }
    }
    col += (env_d * ao + env_s * ao) * skyi;
    col += emis * 2.0;
    g_sf = lum(sun_part) / max(lum(col), 1e-4);
    return vec4<f32>(tone(col), 1.0);
}

// the outline of toon and cel: the faces turned away from the camera, pushed out along their normals
struct OutOut {
    @builtin(position) clip: vec4<f32>,
    @location(0) wpos: vec3<f32>,
    @location(1) nrm: vec3<f32>,
};
@vertex
fn vs_out(i: VIn) -> OutOut {
    var o: OutOut;
    let w = mat.shq.x * frame.extra.y;
    o.clip = frame.view_proj * vec4<f32>(i.pos + normalize(i.nrm) * w, 1.0);
    o.wpos = i.pos;
    o.nrm = i.nrm;
    return o;
}
@fragment
fn fs_out(i: OutOut) -> FOut {
    if (dot(normalize(i.nrm), normalize(frame.cam_pos.xyz - i.wpos)) > 0.0) { discard; }
    var o: FOut;
    o.c = vec4<f32>(lin3(mat.shd.rgb), 1.0);
    o.n = vec4<f32>(0.0);
    return o;
}

// the environment behind the model
struct BgOut {
    @builtin(position) clip: vec4<f32>,
    @location(0) ndc: vec2<f32>,
};
@vertex
fn vs_bg(@builtin(vertex_index) vi: u32) -> BgOut {
    var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
    var o: BgOut;
    o.clip = vec4<f32>(p[vi], 1.0, 1.0);
    o.ndc = p[vi];
    return o;
}
@fragment
fn fs_bg(i: BgOut) -> FOut {
    var o: FOut;
    o.n = vec4<f32>(0.0);
    let far = frame.inv_view_proj * vec4<f32>(i.ndc, 1.0, 1.0);
    let near = frame.inv_view_proj * vec4<f32>(i.ndc, 0.0, 1.0);
    let d = normalize(far.xyz / far.w - near.xyz / near.w);
    if (frame.info.y < 0.5 || frame.info.z < 0.5) {
        o.c = vec4<f32>(tone(vec3<f32>(0.035, 0.04, 0.05) / frame.params.x), 1.0);
        return o;
    }
    // the picture behind the model, blurred as much as the 3D view's Background blur asks
    let t = frame.extra.z * 3.0;
    var c = env_sample(d, 0.0);
    if (t >= 1.0) { c = env_spec(d, clamp(t - 1.0, 0.0, 2.0) * 0.2); }
    else if (t > 0.0) { c = mix(c, env_spec(d, 0.0), t); }
    o.c = vec4<f32>(tone(c), 1.0);
    return o;
}

// ---- blurring the environment for each roughness (run once when an environment is set) ----
struct Pre {
    a: vec4<f32>,   // x roughness, y samples, z width of the picture, w unused
    b: vec4<f32>,   // x, y size of what is drawn
};
@group(0) @binding(0) var pre_src: texture_2d<f32>;
@group(0) @binding(1) var pre_smp: sampler;
@group(0) @binding(2) var<uniform> pre: Pre;

fn hamm(i: u32, n: u32) -> vec2<f32> {
    return vec2<f32>(f32(i) / f32(n), f32(reverseBits(i)) * 2.3283064365386963e-10);
}
fn uv_dir(uv: vec2<f32>) -> vec3<f32> {
    let ph = (uv.x - 0.5) * 2.0 * PI;
    let th = uv.y * PI;
    return vec3<f32>(sin(th) * sin(ph), cos(th), -sin(th) * cos(ph));
}
@vertex
fn vs_pre(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
    var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
    return vec4<f32>(p[vi], 0.0, 1.0);
}
@fragment
fn fs_pre(@builtin(position) frag: vec4<f32>) -> @location(0) vec4<f32> {
    let uv = frag.xy / pre.b.xy;
    let n = uv_dir(uv);
    let up = select(vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 0.0), abs(n.y) < 0.999);
    let t = normalize(cross(up, n));
    let b = cross(n, t);
    let r = pre.a.x;
    let a = r * r;
    let count = u32(pre.a.y);
    var acc = vec3<f32>(0.0);
    var wsum = 0.0;
    for (var i = 0u; i < count; i = i + 1u) {
        let xi = hamm(i, count);
        let ph = 2.0 * PI * xi.x;
        let ct = sqrt((1.0 - xi.y) / (1.0 + (a * a - 1.0) * xi.y));
        let st = sqrt(1.0 - ct * ct);
        let h = normalize(t * (st * cos(ph)) + b * (st * sin(ph)) + n * ct);
        let l = 2.0 * dot(n, h) * h - n;
        let ndl = dot(n, l);
        if (ndl <= 0.0) { continue; }
        let ndh = max(dot(n, h), 0.0);
        let d = ndh * ndh * (a * a - 1.0) + 1.0;
        let dd = a * a / (PI * d * d);
        let pdf = dd / 4.0 + 1e-4;
        let sa = 1.0 / (f32(count) * pdf);
        let sp = 4.0 * PI / (pre.a.z * pre.a.z * 0.5);
        var lod = 0.0;
        if (r >= 0.01) { lod = max(0.5 * log2(sa / sp) + 1.0, 0.0); }
        let luv = vec2<f32>(atan2(l.x, -l.z) / (2.0 * PI) + 0.5, acos(clamp(l.y, -1.0, 1.0)) / PI);
        acc += textureSampleLevel(pre_src, pre_smp, luv, lod).rgb * ndl;
        wsum += ndl;
    }
    return vec4<f32>(acc / max(wsum, 1e-4), 1.0);
}

// The brush outline: a thin light ring with a dark one just outside, so it shows on any colour.
@fragment
fn fs_ring(@builtin(position) p: vec4<f32>) -> @location(0) vec4<f32> {
    let d = abs(length(p.xy - frame.cursor.xy) - frame.cursor.z);
    let light = 1.0 - smoothstep(0.6, 1.4, d);
    let dark = (1.0 - smoothstep(1.4, 2.4, abs(d - 1.2))) * 0.55;
    let a = max(light, dark);
    if (a < 0.01) { discard; }
    return vec4<f32>(vec3<f32>(light), a);
}
