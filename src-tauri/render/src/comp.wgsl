// ---- putting it on the picture ----
struct Comp { p: vec4<f32>, q: vec4<f32> }; // p: x 1 when on, y sun shadow strength, z ambient strength, w reflection strength; q: x tone mode, y exposure
@group(0) @binding(0) var<uniform> comp: Comp;
@group(0) @binding(1) var scene_tex: texture_2d<f32>;
@group(0) @binding(2) var cnrm_tex: texture_2d<f32>;
@group(0) @binding(3) var crt_tex: texture_2d<f32>;
@group(0) @binding(4) var cmat_tex: texture_2d<f32>;
@group(0) @binding(5) var crf_tex: texture_2d<f32>;

fn tone_c(c0: vec3<f32>) -> vec3<f32> {
    let c = c0 * comp.q.y;
    if (comp.q.x > 4.5) { return clamp(c, vec3<f32>(0.0), vec3<f32>(1.0)); }
    if (comp.q.x < 0.5) { return c / (vec3<f32>(1.0) + c); }
    let a = 2.51; let b = 0.03; let cc = 2.43; let d = 0.59; let e = 0.14;
    return clamp((c * (a * c + b)) / (c * (cc * c + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

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
    var r = textureLoad(crt_tex, px, 0);
    var rf = textureLoad(crf_tex, px, 0);
    // while few rays have been added the answer is grainy: average with neighbours that face the same way
    let soft = clamp(1.0 - comp.q.z / 40.0, 0.0, 1.0);
    if (soft > 0.02) {
        var sr = r;
        var sf2 = rf;
        var wsum = 1.0;
        let rad = i32(1.0 + soft * 3.0);
        for (var dy = -rad; dy <= rad; dy = dy + 1) {
            for (var dx = -rad; dx <= rad; dx = dx + 1) {
                if (dx == 0 && dy == 0) { continue; }
                let q = px + vec2<i32>(dx, dy);
                let nn = textureLoad(cnrm_tex, q, 0);
                if (nn.w <= 0.0) { continue; }
                let wn = pow(max(dot(nn.xyz * 2.0 - 1.0, n.xyz * 2.0 - 1.0), 0.0), 24.0);
                if (wn < 0.05) { continue; }
                let wt = wn * soft;
                sr += textureLoad(crt_tex, q, 0) * wt;
                sf2 += textureLoad(crf_tex, q, 0) * wt;
                wsum += wt;
            }
        }
        r = sr / wsum;
        rf = sf2 / wsum;
    }
    let sf = clamp((n.w - 0.25) / 0.75, 0.0, 1.0);
    let sun = mix(1.0, r.x, comp.p.y);
    let amb = mix(1.0, r.y, comp.p.z);
    let sp = textureLoad(cmat_tex, px, 0).y;
    // where the mirror ray met the model, its colour replaces the sky in the reflection
    let hitc = tone_c(rf.rgb / max(rf.w, 1e-3));
    let rw = sp * rf.w * comp.p.w;
    var col = c.rgb * (sf * sun + (1.0 - sf) * amb);
    col = col * (1.0 - rw) + hitc * rw;
    return vec4<f32>(col, c.a);
}
