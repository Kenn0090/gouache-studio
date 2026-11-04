// Post processing on the finished picture (the same effects and maths as the 3D view's post.js, worked on display values)
struct P {
    a: vec4<f32>,   // bloom threshold, bloom spread, near, far
    d: vec4<f32>,   // depth of field: on, blur, focus distance, 1 when the view is orthographic
    b: vec4<f32>,   // bloom on, bloom amount, grain colour noise
    g: vec4<f32>,   // colour grade: exposure, contrast, saturation, warmth
    v: vec4<f32>,   // vignette amount, softness, grain amount, chromatic aberration
    s: vec4<f32>,   // sharpen, grain seed, grade on, grain size
    l: vec4<f32>,   // filter look: mode, strength, levels
    px: vec4<f32>,  // 1/width, 1/height, aspect, 0
    dir: vec4<f32>, // blur direction (a step in uv)
};
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var src_tex: texture_2d<f32>;
@group(0) @binding(2) var bloom_tex: texture_2d<f32>;
@group(0) @binding(3) var depth_tex: texture_depth_2d;
@group(0) @binding(4) var smp: sampler;

struct V { @builtin(position) clip: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex
fn vs(@builtin(vertex_index) vi: u32) -> V {
    var q = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
    var o: V;
    o.clip = vec4<f32>(q[vi], 0.0, 1.0);
    o.uv = vec2<f32>((q[vi].x + 1.0) * 0.5, 1.0 - (q[vi].y + 1.0) * 0.5);
    return o;
}

fn enc3(c: vec3<f32>) -> vec3<f32> {
    let x = max(c, vec3<f32>(0.0));
    return select(1.055 * pow(x, vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055), x * 12.92, x <= vec3<f32>(0.0031308));
}
fn dec3(c: vec3<f32>) -> vec3<f32> {
    return select(pow((c + vec3<f32>(0.055)) / 1.055, vec3<f32>(2.4)), c / 12.92, c <= vec3<f32>(0.04045));
}
fn src_at(uv: vec2<f32>) -> vec3<f32> { return enc3(textureSampleLevel(src_tex, smp, uv, 0.0).rgb); }

@fragment
fn fs_bright(i: V) -> @location(0) vec4<f32> {
    let c = src_at(i.uv);
    let l = max(max(c.r, c.g), c.b);
    let k = max(l - p.a.x, 0.0) / max(l, 1e-3);
    return vec4<f32>(c * k, 1.0);
}

@fragment
fn fs_blur(i: V) -> @location(0) vec4<f32> {
    let d = p.dir.xy;
    var s = textureSampleLevel(bloom_tex, smp, i.uv, 0.0).rgb * 0.227027;
    s = s + (textureSampleLevel(bloom_tex, smp, i.uv + d * 1.3846, 0.0).rgb + textureSampleLevel(bloom_tex, smp, i.uv - d * 1.3846, 0.0).rgb) * 0.316216;
    s = s + (textureSampleLevel(bloom_tex, smp, i.uv + d * 3.2308, 0.0).rgb + textureSampleLevel(bloom_tex, smp, i.uv - d * 3.2308, 0.0).rgb) * 0.070270;
    return vec4<f32>(s, 1.0);
}

fn lin(uv: vec2<f32>) -> f32 {
    let sz = vec2<f32>(textureDimensions(depth_tex));
    let q = vec2<i32>(clamp(uv, vec2<f32>(0.0), vec2<f32>(0.9999)) * sz);
    let d = textureLoad(depth_tex, q, 0);
    if (d >= 0.99999) { return 1e4; }
    if (p.d.w > 0.5) { return p.a.z + d * (p.a.w - p.a.z); }
    return p.a.z * p.a.w / (p.a.w - d * (p.a.w - p.a.z));
}
fn h12(q: vec2<f32>) -> f32 {
    var p3 = fract(vec3<f32>(q.xyx) * 0.1031);
    p3 = p3 + dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

@fragment
fn fs_post(i: V) -> @location(0) vec4<f32> {
    let uv = i.uv;
    let fc = i.clip.xy;
    var c = src_at(uv);
    if (p.v.w > 0.0) {
        let d = (uv - vec2<f32>(0.5)) * p.v.w * 0.03;
        c = vec3<f32>(src_at(uv + d).r, c.g, src_at(uv - d).b);
    }
    if (p.d.x > 0.5) {
        let z = lin(uv);
        let foc = p.d.z;
        let coc = min(abs(z - foc) / max(foc, 0.001), 1.0) * p.d.y;
        let r = coc * 14.0;
        if (r > 0.5) {
            var acc = c;
            var w = 1.0;
            for (var k = 0; k < 24; k = k + 1) {
                let a = f32(k) * 2.39996;
                let rr = sqrt((f32(k) + 0.5) / 24.0);
                let off = vec2<f32>(cos(a), sin(a)) * rr * r * p.px.xy;
                let zs = lin(uv + off);
                let cs = min(abs(zs - foc) / max(foc, 0.001), 1.0) * p.d.y * 14.0;
                let wt = smoothstep(0.0, 1.0, cs / max(rr * r, 0.5));
                acc = acc + src_at(uv + off) * wt;
                w = w + wt;
            }
            c = acc / w;
        }
    }
    if (p.s.x > 0.0) {
        let av = (src_at(uv + vec2<f32>(p.px.x, 0.0)) + src_at(uv - vec2<f32>(p.px.x, 0.0)) + src_at(uv + vec2<f32>(0.0, p.px.y)) + src_at(uv - vec2<f32>(0.0, p.px.y))) * 0.25;
        c = c + (c - av) * p.s.x * 2.0;
    }
    if (p.b.x > 0.5) { c = c + textureSampleLevel(bloom_tex, smp, uv, 0.0).rgb * p.b.y * 1.5; }
    if (p.s.z > 0.5) {
        c = c * exp2(p.g.x);
        c = (c - vec3<f32>(0.5)) * (1.0 + p.g.y) + vec3<f32>(0.5);
        let l = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
        c = mix(vec3<f32>(l), c, 1.0 + p.g.z);
        c.r = c.r * (1.0 + p.g.w * 0.15);
        c.b = c.b * (1.0 - p.g.w * 0.15);
    }
    if (p.v.x > 0.0) {
        let d = length((uv - vec2<f32>(0.5)) * vec2<f32>(p.px.z, 1.0));
        c = c * (1.0 - p.v.x * smoothstep(0.3, 0.3 + 0.15 + p.v.y * 0.9, d));
    }
    if (p.v.z > 0.0) {
        let gp = floor(fc / max(p.s.w, 0.5));
        let m = h12(gp + p.s.y) + h12(gp + p.s.y + 19.7) - 1.0;
        let n = vec3<f32>(h12(gp + p.s.y + 41.3) + h12(gp + p.s.y + 57.1) - 1.0, h12(gp + p.s.y + 73.9) + h12(gp + p.s.y + 88.3) - 1.0, h12(gp + p.s.y + 101.7) + h12(gp + p.s.y + 127.9) - 1.0);
        let l = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
        let w = 0.3 + 0.7 * clamp(4.0 * l * (1.0 - l), 0.0, 1.0);
        c = c + mix(vec3<f32>(m), n, p.b.z) * p.v.z * 0.3 * w;
    }
    if (p.l.x > 0.5) {
        c = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
        let l = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
        var r = c;
        let m = i32(p.l.x + 0.5);
        if (m == 1) { r = vec3<f32>(l); }
        else if (m == 2) { r = vec3<f32>(l) * vec3<f32>(1.07, 0.86, 0.62) + vec3<f32>(0.02, 0.0, -0.02); }
        else if (m == 3) { r = vec3<f32>(1.0) - c; }
        else if (m == 4) { r = vec3<f32>(step(0.5, l)); }
        else if (m == 5) { r = mix(vec3<f32>(0.05, 0.08, 0.3), vec3<f32>(1.0, 0.75, 0.35), l); }
        else if (m == 6) { let n = max(p.l.z, 2.0); r = floor(c * n + vec3<f32>(0.5)) / n; }
        else if (m == 7) { let g = clamp(l * 1.6, 0.0, 1.0) * (0.85 + 0.15 * h12(fc + p.s.y)); r = vec3<f32>(0.05, 1.0, 0.25) * g; }
        else if (m == 8) { r = clamp(vec3<f32>(1.5 * l - 0.5, 1.5 - abs(3.0 * l - 1.5), 1.5 * (1.0 - l) - 0.25), vec3<f32>(0.0), vec3<f32>(1.0)); }
        else if (m == 9) { let sl = 0.75 + 0.25 * sin(fc.y * 3.14159); r = c * sl; r = mix(r, r * vec3<f32>(1.05, 1.0, 0.95), 0.5); }
        else if (m == 10) { r = mix(vec3<f32>(0.05, 0.2, 0.55), vec3<f32>(0.85, 0.93, 1.0), l); }
        c = mix(c, r, p.l.y);
    }
    return vec4<f32>(dec3(clamp(c, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
