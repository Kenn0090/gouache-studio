// Ray-traced shadows and ambient occlusion, a few rays per pixel each frame, added up over frames.
struct Rt {
    inv_view_proj: mat4x4<f32>,
    cam_pos: vec4<f32>,
    sun_dir: vec4<f32>,   // toward the sun; w = how wide the sun looks (tan of the half angle)
    p: vec4<f32>,         // x frame number, y ao radius, z ray offset, w 1 when there is a tree
    res: vec4<f32>,       // width, height
};
struct Node { mn: vec3<f32>, a: u32, mx: vec3<f32>, count: u32 };
@group(0) @binding(0) var<uniform> rt: Rt;
@group(0) @binding(1) var depth_tex: texture_depth_2d;
@group(0) @binding(2) var nrm_tex: texture_2d<f32>;
@group(0) @binding(3) var<storage, read> nodes: array<Node>;
@group(0) @binding(4) var<storage, read> tris: array<vec4<f32>>;
@group(0) @binding(5) var prev_tex: texture_2d<f32>;
@group(0) @binding(6) var out_tex: texture_storage_2d<rgba16float, write>;

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
    }
    let cnt = prev.z;
    let k = 1.0 / (cnt + 1.0);
    let res = vec3<f32>(mix(prev.x, sun_vis, k), mix(prev.y, ao, k), min(cnt + 1.0, 1024.0));
    textureStore(out_tex, px, vec4<f32>(res, 1.0));
}

