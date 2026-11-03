// ---- putting it on the picture ----
struct Comp { p: vec4<f32>, q: vec4<f32>, f: vec4<f32> }; // f: shadow floor colour (linear) // p: x 1 when on, y sun shadow strength, z ambient strength, w reflection strength; q: x tone mode, y exposure
@group(0) @binding(0) var<uniform> comp: Comp;
@group(0) @binding(1) var scene_tex: texture_2d<f32>;
@group(0) @binding(2) var cnrm_tex: texture_2d<f32>;
@group(0) @binding(3) var crt_tex: texture_2d<f32>;
@group(0) @binding(4) var cmat_tex: texture_2d<f32>;
@group(0) @binding(5) var crf_tex: texture_2d<f32>;
@group(0) @binding(6) var fx_samp: sampler;

fn lm(c: vec3<f32>) -> f32 { return sqrt(max(dot(c, vec3<f32>(0.299, 0.587, 0.114)), 0.0)); }

// Smooths jagged edges: where the picture's brightness jumps, the pixel is read from half a pixel across the edge (a light version of FXAA)
fn smooth_edges(px: vec2<i32>) -> vec4<f32> {
    let dims = vec2<f32>(textureDimensions(scene_tex));
    let c = textureLoad(scene_tex, px, 0);
    let lc = lm(c.rgb);
    let ln = lm(textureLoad(scene_tex, px + vec2<i32>(0, -1), 0).rgb);
    let ls = lm(textureLoad(scene_tex, px + vec2<i32>(0, 1), 0).rgb);
    let le = lm(textureLoad(scene_tex, px + vec2<i32>(1, 0), 0).rgb);
    let lw = lm(textureLoad(scene_tex, px + vec2<i32>(-1, 0), 0).rgb);
    let lmax = max(lc, max(max(ln, ls), max(le, lw)));
    let lmin = min(lc, min(min(ln, ls), min(le, lw)));
    let range = lmax - lmin;
    if (range < max(0.0625, lmax * 0.125)) { return c; }
    let lnw = lm(textureLoad(scene_tex, px + vec2<i32>(-1, -1), 0).rgb);
    let lne = lm(textureLoad(scene_tex, px + vec2<i32>(1, -1), 0).rgb);
    let lsw = lm(textureLoad(scene_tex, px + vec2<i32>(-1, 1), 0).rgb);
    let lse = lm(textureLoad(scene_tex, px + vec2<i32>(1, 1), 0).rgb);
    let edge_h = abs(lnw + lsw - 2.0 * lw) + 2.0 * abs(ln + ls - 2.0 * lc) + abs(lne + lse - 2.0 * le);
    let edge_v = abs(lnw + lne - 2.0 * ln) + 2.0 * abs(lw + le - 2.0 * lc) + abs(lsw + lse - 2.0 * ls);
    let horiz = edge_h >= edge_v;
    // across the edge: toward the neighbour that differs most from this pixel
    let l1 = select(lw, ln, horiz);
    let l2 = select(le, ls, horiz);
    let toward_second = abs(l2 - lc) >= abs(l1 - lc);
    let sgn = select(-1.0, 1.0, toward_second);
    let off = select(vec2<f32>(sgn * 0.5, 0.0), vec2<f32>(0.0, sgn * 0.5), horiz);
    let edged = textureSampleLevel(scene_tex, fx_samp, (vec2<f32>(px) + vec2<f32>(0.5) + off) / dims, 0.0);
    // lone bright or dark pixels: also mix with the average of the neighbours
    let avg = (ln + ls + le + lw + lnw + lne + lsw + lse + lc) / 9.0;
    let sub = clamp(abs(avg - lc) / max(range, 1e-4), 0.0, 1.0);
    let blur = (textureLoad(scene_tex, px + vec2<i32>(0, -1), 0) + textureLoad(scene_tex, px + vec2<i32>(0, 1), 0) + textureLoad(scene_tex, px + vec2<i32>(1, 0), 0) + textureLoad(scene_tex, px + vec2<i32>(-1, 0), 0) + c) / 5.0;
    return mix(mix(c, edged, 0.8), blur, sub * sub * 0.5);
}

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
    var c = textureLoad(scene_tex, px, 0);
    if (comp.q.w > 0.5) {
        // only where the model meets the background or another surface is cut off sharply (textures keep their crispness)
        let s0 = textureLoad(cnrm_tex, px, 0).w > 0.0;
        var edge = false;
        for (var k = 0; k < 4; k = k + 1) {
            let o = select(select(vec2<i32>(0, 1), vec2<i32>(-1, 0), k == 2), select(vec2<i32>(0, -1), vec2<i32>(1, 0), k == 1), k < 2);
            if ((textureLoad(cnrm_tex, px + o, 0).w > 0.0) != s0) { edge = true; }
        }
        if (edge) { c = smooth_edges(px); }
    }
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
    let mt = textureLoad(cmat_tex, px, 0);
    if (mt.w > 0.25 && mt.w < 0.75) {
        // the shadow floor: only its shadow shows, in the floor's colour
        let lit = mix(1.0, r.x, mt.z);
        return vec4<f32>(mix(comp.f.rgb, c.rgb, lit), c.a);
    }
    let sp = mt.y;
    // where the mirror ray met the model, its colour replaces the sky in the reflection
    let hitc = tone_c(rf.rgb / max(rf.w, 1e-3));
    let rw = sp * rf.w * comp.p.w;
    var col = c.rgb * (sf * sun + (1.0 - sf) * amb);
    col = col * (1.0 - rw) + hitc * rw;
    return vec4<f32>(col, c.a);
}
