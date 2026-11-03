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
};
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var env_tex: texture_2d<f32>;
@group(0) @binding(2) var env_smp: sampler;

struct Mat {
    flags: vec4<f32>,        // x has orm, y rough fallback, z metal fallback, w unused
    tint: vec4<f32>,
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

@fragment
fn fs(i: VOut) -> @location(0) vec4<f32> {
    let uv = i.uv;
    var n = normalize(i.nrm);
    let v = normalize(frame.cam_pos.xyz - i.wpos);
    if (dot(n, v) < 0.0) { n = -n; }
    // the surface frame from screen derivatives, so no tangents are needed
    let dp1 = dpdx(i.wpos);
    let dp2 = dpdy(i.wpos);
    let duv1 = dpdx(uv);
    let duv2 = dpdy(uv);
    let dp2perp = cross(dp2, n);
    let dp1perp = cross(n, dp1);
    let t = dp2perp * duv1.x + dp1perp * duv2.x;
    let b = dp2perp * duv1.y + dp1perp * duv2.y;
    let invmax = inverseSqrt(max(max(dot(t, t), dot(b, b)), 1e-20));
    let tn = textureSample(nrm_tex, tex_smp, uv).xyz * 2.0 - 1.0;
    let nn = normalize(mat3x3<f32>(t * invmax, b * invmax, n) * vec3<f32>(tn.x, tn.y, tn.z));

    let albedo = textureSample(base_tex, tex_smp, uv).rgb * mat.tint.rgb;
    var rough = mat.flags.y;
    var metal = mat.flags.z;
    var ao = 1.0;
    if (mat.flags.x > 0.5) {
        let orm = textureSample(orm_tex, tex_smp, uv).rgb;
        ao = orm.r;
        rough = orm.g;
        metal = orm.b;
    }
    rough = clamp(rough, 0.045, 1.0);
    let emis = textureSample(emi_tex, tex_smp, uv).rgb;

    let nv = max(dot(nn, v), 1e-3);
    let f0 = mix(vec3<f32>(0.04), albedo, metal);
    let diff_col = albedo * (1.0 - metal);

    // light from the environment
    var col = vec3<f32>(0.0);
    if (frame.info.y > 0.5) {
        let r = reflect(-v, nn);
        let lod = rough * (frame.info.x - 1.0);
        let spec_env = env_sample(r, lod);
        let ab = env_brdf(rough, nv);
        col += diff_col * sh_diffuse(nn) * ao + spec_env * (f0 * ab.x + vec3<f32>(ab.y)) * ao;
    } else {
        let hemi = mix(vec3<f32>(0.25), vec3<f32>(0.6, 0.7, 0.85), nn.y * 0.5 + 0.5);
        col += diff_col * hemi * ao;
    }

    // the sun
    let l = normalize(frame.sun_dir.xyz);
    let h = normalize(l + v);
    let nl = max(dot(nn, l), 0.0);
    let nh = max(dot(nn, h), 0.0);
    let vh = max(dot(v, h), 0.0);
    let a = rough * rough;
    let a2 = a * a;
    let d = a2 / (PI * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0));
    let k = (rough + 1.0) * (rough + 1.0) / 8.0;
    let g = (nl / (nl * (1.0 - k) + k)) * (nv / (nv * (1.0 - k) + k));
    let f = f0 + (vec3<f32>(1.0) - f0) * pow(1.0 - vh, 5.0);
    let spec = d * g * f / max(4.0 * nl * nv, 1e-3);
    col += (diff_col / PI + spec) * frame.sun_col.rgb * nl;

    col += emis;
    return vec4<f32>(tone(col), 1.0);
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
fn fs_bg(i: BgOut) -> @location(0) vec4<f32> {
    let far = frame.inv_view_proj * vec4<f32>(i.ndc, 1.0, 1.0);
    let near = frame.inv_view_proj * vec4<f32>(i.ndc, 0.0, 1.0);
    let d = normalize(far.xyz / far.w - near.xyz / near.w);
    if (frame.info.y < 0.5 || frame.info.z < 0.5) {
        return vec4<f32>(tone(vec3<f32>(0.035, 0.04, 0.05) / frame.params.x), 1.0);
    }
    return vec4<f32>(tone(env_sample(d, 1.0)), 1.0);
}
