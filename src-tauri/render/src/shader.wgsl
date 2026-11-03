// Gouache Studio · native viewer · first test shader (lit by a sky/ground blend and one light)
struct Frame {
    view_proj: mat4x4<f32>,
    cam_pos: vec4<f32>,
    light_dir: vec4<f32>,   // toward the light
    sky: vec4<f32>,
    ground: vec4<f32>,
};
@group(0) @binding(0) var<uniform> frame: Frame;
@group(1) @binding(0) var base_tex: texture_2d<f32>;
@group(1) @binding(1) var base_smp: sampler;

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
    var n = normalize(i.nrm);
    let v = normalize(frame.cam_pos.xyz - i.wpos);
    if (dot(n, v) < 0.0) { n = -n; }
    let albedo = textureSample(base_tex, base_smp, i.uv).rgb;
    let l = normalize(frame.light_dir.xyz);
    let ndl = max(dot(n, l), 0.0);
    let hemi = mix(frame.ground.rgb, frame.sky.rgb, n.y * 0.5 + 0.5);
    let h = normalize(l + v);
    let spec = pow(max(dot(n, h), 0.0), 48.0) * 0.25;
    let col = albedo * (hemi * 0.6 + vec3<f32>(1.0, 0.97, 0.92) * ndl * 1.1) + vec3<f32>(spec) * ndl;
    return vec4<f32>(col, 1.0);
}
