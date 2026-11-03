// ---- putting it on the picture ----
struct Comp { p: vec4<f32> }; // x 1 when on, y sun shadow strength, z ambient strength
@group(0) @binding(0) var<uniform> comp: Comp;
@group(0) @binding(1) var scene_tex: texture_2d<f32>;
@group(0) @binding(2) var cnrm_tex: texture_2d<f32>;
@group(0) @binding(3) var crt_tex: texture_2d<f32>;
@group(0) @binding(4) var cmat_tex: texture_2d<f32>;

@vertex
fn vs_comp(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
    var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
    return vec4<f32>(p[vi], 0.0, 1.0);
}
@fragment
fn fs_comp(@builtin(position) p: vec4<f32>) -> @location(0) vec4<f32> {
    let px = vec2<i32>(p.xy);
    let c = textureLoad(scene_tex, px, 0);
    if (comp.p.x < 0.5) { return c; }
    let n = textureLoad(cnrm_tex, px, 0);
    if (n.w <= 0.0) { return c; }
    let r = textureLoad(crt_tex, px, 0);
    let sf = clamp((n.w - 0.25) / 0.75, 0.0, 1.0);
    let sun = mix(1.0, r.x, comp.p.y);
    let amb = mix(1.0, r.y, comp.p.z);
    let sp = textureLoad(cmat_tex, px, 0).y;
    let reflect_dim = 1.0 - sp * (1.0 - r.w) * comp.p.w;
    return vec4<f32>(c.rgb * (sf * sun + (1.0 - sf) * amb) * reflect_dim, c.a);
}
