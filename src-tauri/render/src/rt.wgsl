// Ray-traced shadows and ambient occlusion, a few rays per pixel each frame, added up over frames.
struct Rt {
    inv_view_proj: mat4x4<f32>,
    cam_pos: vec4<f32>,
    sun_dir: vec4<f32>,   // toward the sun; w = how wide the sun looks (tan of the half angle)
    p: vec4<f32>,         // x frame number, y ao radius, z ray offset, w 1 when there is a tree
    res: vec4<f32>,       // width, height
    amb: vec4<f32>,       // light from the sky on a surface facing up (rough)
    sun_col: vec4<f32>,
};
struct Node { mn: vec3<f32>, a: u32, mx: vec3<f32>, count: u32 };
@group(0) @binding(0) var<uniform> rt: Rt;
@group(0) @binding(1) var depth_tex: texture_depth_2d;
@group(0) @binding(2) var nrm_tex: texture_2d<f32>;
@group(0) @binding(3) var<storage, read> nodes: array<Node>;
@group(0) @binding(4) var<storage, read> tris: array<vec4<f32>>;
@group(0) @binding(5) var prev_tex: texture_2d<f32>;
@group(0) @binding(6) var out_tex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(7) var mat_tex: texture_2d<f32>;
@group(0) @binding(8) var prev2_tex: texture_2d<f32>;
@group(0) @binding(9) var out2_tex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(10) var<storage, read> tri_uv: array<vec4<f32>>;
// per material group, 3 vec4: [average colour, look kind] [roughness, metal, glow, look setting 1] [tint colour, look setting 2]
@group(0) @binding(11) var<uniform> ginfo: array<vec4<f32>, 384>;
@group(0) @binding(13) var base_arr: texture_2d_array<f32>;
@group(0) @binding(14) var base_samp: sampler;

fn pcg(v: u32) -> u32 {
    let s = v * 747796405u + 2891336453u;
    let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
    return (w >> 22u) ^ w;
}
fn rnd(h: ptr<function, u32>) -> f32 {
    *h = pcg(*h);
    return f32(*h) / 4294967296.0;
}

// any triangle between o and o + d * tmax?
fn occluded(o: vec3<f32>, d: vec3<f32>, tmax: f32) -> bool {
    let inv = 1.0 / d;
    var stack: array<u32, 40>;
    var sp = 1;
    stack[0] = 0u;
    loop {
        if (sp == 0) { break; }
        sp = sp - 1;
        let nd = nodes[stack[sp]];
        let t0 = (nd.mn - o) * inv;
        let t1 = (nd.mx - o) * inv;
        let lo = min(t0, t1);
        let hi = max(t0, t1);
        let tn = max(max(lo.x, lo.y), max(lo.z, 0.0));
        let tf = min(min(hi.x, hi.y), min(hi.z, tmax));
        if (tn > tf) { continue; }
        if (nd.count == 0u) {
            stack[sp] = nd.a + 1u;
            stack[sp + 1] = nd.a;
            sp = sp + 2;
        } else {
            for (var t = nd.a; t < nd.a + nd.count; t = t + 1u) {
                let v0 = tris[t * 3u].xyz;
                let e1 = tris[t * 3u + 1u].xyz - v0;
                let e2 = tris[t * 3u + 2u].xyz - v0;
                let pv = cross(d, e2);
                let det = dot(e1, pv);
                if (abs(det) < 1e-12) { continue; }
                let id = 1.0 / det;
                let tv = o - v0;
                let u = dot(tv, pv) * id;
                if (u < 0.0 || u > 1.0) { continue; }
                let q = cross(tv, e1);
                let w = dot(d, q) * id;
                if (w < 0.0 || u + w > 1.0) { continue; }
                let tt = dot(e2, q) * id;
                if (tt > 1e-6 && tt < tmax) { return true; }
            }
        }
    }
    return false;
}

// the nearest triangle along the ray: x distance (-1 when none), y triangle number, z w the barycentric weights of corners 1 and 2
fn closest(o: vec3<f32>, d: vec3<f32>, tmax: f32) -> vec4<f32> {
    let inv = 1.0 / d;
    var stack: array<u32, 40>;
    var sp = 1;
    stack[0] = 0u;
    var best = tmax;
    var hit = -1.0;
    var bu = 0.0;
    var bw = 0.0;
    loop {
        if (sp == 0) { break; }
        sp = sp - 1;
        let nd = nodes[stack[sp]];
        let t0 = (nd.mn - o) * inv;
        let t1 = (nd.mx - o) * inv;
        let lo = min(t0, t1);
        let hi = max(t0, t1);
        let tn = max(max(lo.x, lo.y), max(lo.z, 0.0));
        let tf = min(min(hi.x, hi.y), min(hi.z, best));
        if (tn > tf) { continue; }
        if (nd.count == 0u) {
            stack[sp] = nd.a + 1u;
            stack[sp + 1] = nd.a;
            sp = sp + 2;
        } else {
            for (var t = nd.a; t < nd.a + nd.count; t = t + 1u) {
                let v0 = tris[t * 3u].xyz;
                let e1 = tris[t * 3u + 1u].xyz - v0;
                let e2 = tris[t * 3u + 2u].xyz - v0;
                let pv = cross(d, e2);
                let det = dot(e1, pv);
                if (abs(det) < 1e-12) { continue; }
                let id = 1.0 / det;
                let tv = o - v0;
                let u = dot(tv, pv) * id;
                if (u < 0.0 || u > 1.0) { continue; }
                let q = cross(tv, e1);
                let w = dot(d, q) * id;
                if (w < 0.0 || u + w > 1.0) { continue; }
                let tt = dot(e2, q) * id;
                if (tt > 1e-6 && tt < best) { best = tt; hit = f32(t); bu = u; bw = w; }
            }
        }
    }
    if (hit < 0.0) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    return vec4<f32>(best, hit, bu, bw);
}


// how a surface looks where a reflection ray lands: an approximation of each look (the full shader does not run inside rays)
fn shade_hit(gi: u32, alb: vec3<f32>, hn: vec3<f32>, fd: vec3<f32>, sd: vec3<f32>, sunvis: f32) -> vec3<f32> {
    let g = min(gi, 127u);
    let a = ginfo[g * 3u];
    let b = ginfo[g * 3u + 1u];
    let c = ginfo[g * 3u + 2u];
    let kind = i32(a.w + 0.5);
    let rough = clamp(b.x, 0.04, 1.0);
    let metal = clamp(b.y, 0.0, 1.0);
    let glow = b.z;
    let tint = c.xyz;
    let sky = rt.amb.rgb;
    let nv = max(dot(hn, -fd), 0.0);
    let fres = pow(1.0 - nv, 3.0);
    let amb_here = sky * (0.6 + 0.4 * hn.y) * 0.5;
    let sl = max(dot(hn, sd), 0.0);
    let diffuse = alb * (amb_here + rt.sun_col.rgb * sl * sunvis / 3.14159265);
    let spec_col = mix(vec3<f32>(0.04), alb, metal);
    let hv = normalize(sd - fd);
    let shin = mix(200.0, 8.0, rough);
    let spec_sun = rt.sun_col.rgb * pow(max(dot(hn, hv), 0.0), shin) * sunvis * (shin + 8.0) / 25.0;
    let env_spec = amb_here * (1.0 - rough * 0.5) * (fres * 0.8 + 0.2);
    var col = diffuse * (1.0 - metal) + spec_col * (spec_sun + env_spec * 2.0);
    if (kind == 4 || kind == 5 || kind == 16 || kind == 17) {
        // toon and cel: flat steps of light
        let band = floor(clamp(sl * sunvis, 0.0, 0.999) * 3.0) / 3.0;
        col = alb * (amb_here * 1.4 + rt.sun_col.rgb * (0.25 + 0.75 * band) * 0.3);
    } else if (kind == 1 || kind == 15) {
        // skin and wax: light wraps round the edge
        col = alb * (amb_here + rt.sun_col.rgb * sunvis * max((dot(hn, sd) + 0.5) / 1.5, 0.0) / 3.14159265) + tint * fres * 0.05;
    } else if (kind == 3 || kind == 14) {
        // velvet and cloth: a soft sheen at grazing angles
        col = diffuse + sky * mix(vec3<f32>(1.0), tint, 0.6) * fres * 0.5;
    } else if (kind == 9) {
        // hologram: it glows in its own colour
        col = tint * (0.5 + fres * 1.2) + alb * 0.1;
    } else if (kind == 10) {
        // glass: mostly a mirror
        col = tint * 0.12 + env_spec * 0.8 + spec_sun;
    } else if (kind == 11) {
        col = diffuse * 0.9 + sky * fres * 0.15;
    } else if (kind == 12) {
        // iridescent: a rainbow that shifts with the angle
        let rb = 0.5 + 0.5 * cos(6.2831853 * (nv * 1.5 + vec3<f32>(0.0, 0.33, 0.67)));
        col = col * 0.6 + rb * (0.2 + fres) * (sky * 1.5 + rt.sun_col.rgb * sunvis * 0.1);
    } else if (kind == 13) {
        // car paint: a clear coat over the colour
        col = col + vec3<f32>(1.0) * (fres * 0.5 + 0.04) * sky * 2.0 + spec_sun * 2.0;
    }
    col = col + alb * glow * 2.0;
    return max(col, vec3<f32>(0.0));
}

fn basis(n: vec3<f32>) -> mat3x3<f32> {
    let s = select(-1.0, 1.0, n.z >= 0.0);
    let a = -1.0 / (s + n.z);
    let b = n.x * n.y * a;
    let t = vec3<f32>(1.0 + s * n.x * n.x * a, s * b, -s * n.x);
    let bt = vec3<f32>(b, s + n.y * n.y * a, -n.y);
    return mat3x3<f32>(t, bt, n);
}

@compute @workgroup_size(8, 8)
fn cs(@builtin(global_invocation_id) g: vec3<u32>) {
    let w = u32(rt.res.x);
    let h = u32(rt.res.y);
    if (g.x >= w || g.y >= h) { return; }
    let px = vec2<i32>(i32(g.x), i32(g.y));
    let prev = textureLoad(prev_tex, px, 0);
    let frame = u32(rt.p.x);
    let nrm = textureLoad(nrm_tex, px, 0);
    var sun_vis = 1.0;
    var ao = 1.0;
    var refl_rgb = vec3<f32>(0.0);
    var refl_hit = 0.0;
    if (nrm.w > 0.0 && rt.p.w > 0.5) {
        let d = textureLoad(depth_tex, px, 0);
        let ndc = vec4<f32>((f32(g.x) + 0.5) / rt.res.x * 2.0 - 1.0, 1.0 - (f32(g.y) + 0.5) / rt.res.y * 2.0, d, 1.0);
        let wp = rt.inv_view_proj * ndc;
        let pos = wp.xyz / wp.w;
        let n = normalize(nrm.xyz * 2.0 - 1.0);
        let o = pos + n * rt.p.z;
        var h1 = pcg(g.x + pcg(g.y + pcg(frame * 7919u + 17u)));
        // the sun: a ray through a small disc around its direction
        let sd = normalize(rt.sun_dir.xyz);
        let sb = basis(sd);
        let r = sqrt(rnd(&h1)) * rt.sun_dir.w;
        let a = rnd(&h1) * 6.2831853;
        let ld = normalize(sd + sb[0] * (r * cos(a)) + sb[1] * (r * sin(a)));
        if (dot(ld, n) > 0.0 && occluded(o, ld, 1e30)) { sun_vis = 0.0; }
        if (dot(ld, n) <= 0.0) { sun_vis = 1.0; }
        // ambient: a ray over the hemisphere, short
        let nb = basis(n);
        let u1 = rnd(&h1);
        let u2 = rnd(&h1);
        let rr = sqrt(u1);
        let ph = 6.2831853 * u2;
        let hd = nb * vec3<f32>(rr * cos(ph), rr * sin(ph), sqrt(max(1.0 - u1, 0.0)));
        if (occluded(o, hd, rt.p.y)) { ao = 0.0; }
        // reflection: a mirror ray, spread by the roughness; blocked means the reflection shows the model itself, not the sky
        let rough = textureLoad(mat_tex, px, 0).x;
        let rd = reflect(normalize(pos - rt.cam_pos.xyz), n);
        let jb = basis(rd);
        let ju = rnd(&h1);
        let jv = rnd(&h1);
        let jr = sqrt(ju) * rough * rough * 1.6;
        var fd = normalize(rd + jb[0] * (jr * cos(6.2831853 * jv)) + jb[1] * (jr * sin(6.2831853 * jv)));
        if (dot(fd, n) <= 0.0) { fd = rd; }
        let ch = closest(o, fd, rt.p.y * 8.0);
        if (ch.x > 0.0) {
            let ti = u32(ch.y);
            let v0 = tris[ti * 3u].xyz;
            var hn = normalize(cross(tris[ti * 3u + 1u].xyz - v0, tris[ti * 3u + 2u].xyz - v0));
            if (dot(hn, fd) > 0.0) { hn = -hn; }
            let uv0 = tri_uv[ti * 2u];
            let uv1 = tri_uv[ti * 2u + 1u];
            let g = u32(uv1.z + 0.5);
            let huv = uv0.xy * (1.0 - ch.z - ch.w) + uv0.zw * ch.z + uv1.xy * ch.w;
            let alb = textureSampleLevel(base_arr, base_samp, huv, i32(g), 0.0).rgb;
            let hp = o + fd * ch.x + hn * rt.p.z;
            var sunvis = 0.0;
            if (dot(hn, sd) > 0.0 && !occluded(hp, sd, 1e30)) { sunvis = 1.0; }
            refl_rgb = shade_hit(g, alb, hn, fd, sd, sunvis);
            refl_hit = 1.0;
        }
    }
    let cnt = rt.p.x;
    let k = 1.0 / (cnt + 1.0);
    let prev2 = textureLoad(prev2_tex, px, 0);
    textureStore(out_tex, px, vec4<f32>(mix(prev.x, sun_vis, k), mix(prev.y, ao, k), 0.0, 1.0));
    textureStore(out2_tex, px, vec4<f32>(mix(prev2.rgb, refl_rgb * refl_hit, k), mix(prev2.w, refl_hit, k)));
}

