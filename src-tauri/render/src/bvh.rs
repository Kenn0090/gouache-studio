//! A bounding-volume tree over the model's triangles, for ray tracing in compute shaders.
//! Binned surface-area heuristic, two children side by side (the right one is always `left + 1`).

use glam::Vec3;

/// One node, 32 bytes, laid out for a storage buffer. `count == 0`: an inner node, `a` is its left child
/// (the right child is `a + 1`). Otherwise a leaf: `a` is the first triangle, `count` how many follow.
#[repr(C)]
#[derive(Clone, Copy, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct Node {
    pub min: [f32; 3],
    pub a: u32,
    pub max: [f32; 3],
    pub count: u32,
}

/// The finished tree: nodes, and the triangles in leaf order (three corners each, as vec4 so a shader reads them directly).
pub struct Bvh {
    pub nodes: Vec<Node>,
    pub tris: Vec<[f32; 4]>,
    /// for each triangle in leaf order, its index in the list that went in (to find its material and normals again)
    pub order: Vec<u32>,
}

const BINS: usize = 16;
const LEAF: usize = 4;

#[derive(Clone, Copy)]
struct Aabb {
    min: Vec3,
    max: Vec3,
}

impl Aabb {
    const EMPTY: Aabb = Aabb { min: Vec3::splat(f32::INFINITY), max: Vec3::splat(f32::NEG_INFINITY) };
    fn grow(&mut self, p: Vec3) {
        self.min = self.min.min(p);
        self.max = self.max.max(p);
    }
    fn join(&mut self, o: &Aabb) {
        self.min = self.min.min(o.min);
        self.max = self.max.max(o.max);
    }
    fn area(&self) -> f32 {
        let d = (self.max - self.min).max(Vec3::ZERO);
        2.0 * (d.x * d.y + d.y * d.z + d.z * d.x)
    }
}

/// Builds the tree from corner positions (3 floats each) and triangles as corner indices (3 per triangle).
pub fn build(positions: &[f32], indices: &[u32]) -> Bvh {
    let n = indices.len() / 3;
    let p = |i: u32| Vec3::new(positions[i as usize * 3], positions[i as usize * 3 + 1], positions[i as usize * 3 + 2]);
    let mut bb = Vec::with_capacity(n);
    let mut cen = Vec::with_capacity(n);
    for t in 0..n {
        let (a, b, c) = (p(indices[t * 3]), p(indices[t * 3 + 1]), p(indices[t * 3 + 2]));
        let mut x = Aabb::EMPTY;
        x.grow(a);
        x.grow(b);
        x.grow(c);
        cen.push((x.min + x.max) * 0.5);
        bb.push(x);
    }
    let mut order: Vec<u32> = (0..n as u32).collect();
    let mut nodes = vec![Node { min: [0.0; 3], a: 0, max: [0.0; 3], count: 0 }];
    if n > 0 {
        // iterative: (node index, first, count)
        let mut stack = vec![(0usize, 0usize, n)];
        while let Some((ni, first, count)) = stack.pop() {
            let mut b = Aabb::EMPTY;
            let mut cb = Aabb::EMPTY;
            for &t in &order[first..first + count] {
                b.join(&bb[t as usize]);
                cb.grow(cen[t as usize]);
            }
            nodes[ni].min = b.min.to_array();
            nodes[ni].max = b.max.to_array();
            let ext = cb.max - cb.min;
            let axis = if ext.x >= ext.y && ext.x >= ext.z { 0 } else if ext.y >= ext.z { 1 } else { 2 };
            let make_leaf = |nodes: &mut Vec<Node>| {
                nodes[ni].a = first as u32;
                nodes[ni].count = count as u32;
            };
            if count <= 2 || ext[axis] <= 1e-12 {
                make_leaf(&mut nodes);
                continue;
            }
            // binned SAH
            let mut cnt = [0usize; BINS];
            let mut bins = [Aabb::EMPTY; BINS];
            let k = BINS as f32 / ext[axis];
            let bin_of = |t: u32| (((cen[t as usize][axis] - cb.min[axis]) * k) as usize).min(BINS - 1);
            for &t in &order[first..first + count] {
                let i = bin_of(t);
                cnt[i] += 1;
                bins[i].join(&bb[t as usize]);
            }
            let mut left_area = [0.0f32; BINS - 1];
            let mut left_n = [0usize; BINS - 1];
            let (mut acc, mut an) = (Aabb::EMPTY, 0);
            for i in 0..BINS - 1 {
                acc.join(&bins[i]);
                an += cnt[i];
                left_area[i] = acc.area();
                left_n[i] = an;
            }
            let (mut best, mut best_cost) = (0usize, f32::INFINITY);
            let (mut acc, mut an) = (Aabb::EMPTY, 0);
            for i in (1..BINS).rev() {
                acc.join(&bins[i]);
                an += cnt[i];
                let cost = left_area[i - 1] * left_n[i - 1] as f32 + acc.area() * an as f32;
                if left_n[i - 1] > 0 && an > 0 && cost < best_cost {
                    best_cost = cost;
                    best = i - 1;
                }
            }
            let leaf_cost = b.area() * count as f32;
            if best_cost.is_infinite() || (count <= LEAF && best_cost * 1.0 + b.area() * 0.5 >= leaf_cost) {
                if count <= LEAF || best_cost.is_infinite() {
                    make_leaf(&mut nodes);
                    continue;
                }
            }
            // partition
            let slice = &mut order[first..first + count];
            let (mut i, mut j) = (0usize, count);
            while i < j {
                if bin_of(slice[i]) <= best {
                    i += 1;
                } else {
                    j -= 1;
                    slice.swap(i, j);
                }
            }
            let mid = i;
            if mid == 0 || mid == count {
                make_leaf(&mut nodes);
                continue;
            }
            let left = nodes.len();
            nodes.push(Node { min: [0.0; 3], a: 0, max: [0.0; 3], count: 0 });
            nodes.push(Node { min: [0.0; 3], a: 0, max: [0.0; 3], count: 0 });
            nodes[ni].a = left as u32;
            nodes[ni].count = 0;
            stack.push((left + 1, first + mid, count - mid));
            stack.push((left, first, mid));
        }
    }
    let mut tris = Vec::with_capacity(n * 3);
    for &t in &order {
        for c in 0..3 {
            let v = p(indices[t as usize * 3 + c]);
            tris.push([v.x, v.y, v.z, 0.0]);
        }
    }
    Bvh { nodes, tris, order }
}

impl Bvh {
    /// Distance along the ray to the nearest triangle (Möller–Trumbore), or None. The same walk the shader does.
    pub fn closest(&self, o: Vec3, d: Vec3, tmax: f32) -> Option<(f32, u32)> {
        if self.tris.is_empty() {
            return None;
        }
        let inv = Vec3::ONE / d;
        let mut best = tmax;
        let mut hit = None;
        let mut stack = vec![0u32];
        while let Some(ni) = stack.pop() {
            let nd = &self.nodes[ni as usize];
            let (t0, t1) = ((Vec3::from(nd.min) - o) * inv, (Vec3::from(nd.max) - o) * inv);
            let (lo, hi) = (t0.min(t1), t0.max(t1));
            let (tn, tf) = (lo.x.max(lo.y).max(lo.z).max(0.0), hi.x.min(hi.y).min(hi.z).min(best));
            if tn > tf {
                continue;
            }
            if nd.count == 0 {
                stack.push(nd.a + 1);
                stack.push(nd.a);
            } else {
                for t in nd.a..nd.a + nd.count {
                    let v = |c: usize| Vec3::new(self.tris[t as usize * 3 + c][0], self.tris[t as usize * 3 + c][1], self.tris[t as usize * 3 + c][2]);
                    let (v0, v1, v2) = (v(0), v(1), v(2));
                    let (e1, e2) = (v1 - v0, v2 - v0);
                    let pv = d.cross(e2);
                    let det = e1.dot(pv);
                    if det.abs() < 1e-12 {
                        continue;
                    }
                    let id = 1.0 / det;
                    let tv = o - v0;
                    let u = tv.dot(pv) * id;
                    if !(0.0..=1.0).contains(&u) {
                        continue;
                    }
                    let q = tv.cross(e1);
                    let w = d.dot(q) * id;
                    if w < 0.0 || u + w > 1.0 {
                        continue;
                    }
                    let tt = e2.dot(q) * id;
                    if tt > 1e-6 && tt < best {
                        best = tt;
                        hit = Some((tt, self.order[t as usize]));
                    }
                }
            }
        }
        hit
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A grid of small quads at random heights; the tree must find what a brute-force search finds.
    #[test]
    fn matches_brute_force() {
        let mut pos = Vec::new();
        let mut idx = Vec::new();
        let mut s = 12345u32;
        let mut rnd = || {
            s = s.wrapping_mul(1664525).wrapping_add(1013904223);
            (s >> 8) as f32 / 16777216.0
        };
        for i in 0..400u32 {
            let (x, y, z) = (rnd() * 10.0 - 5.0, rnd() * 10.0 - 5.0, rnd() * 10.0 - 5.0);
            let b = pos.len() as u32 / 3;
            for (dx, dy, dz) in [(0.0, 0.0, 0.0), (0.4, 0.0, 0.1), (0.0, 0.4, 0.2)] {
                pos.extend_from_slice(&[x + dx, y + dy, z + dz]);
            }
            idx.extend_from_slice(&[b, b + 1, b + 2]);
            let _ = i;
        }
        let bvh = build(&pos, &idx);
        assert_eq!(bvh.tris.len(), 400 * 3);
        let brute = |o: Vec3, d: Vec3| {
            let mut best = f32::INFINITY;
            for t in 0..400usize {
                let v = |c: usize| Vec3::new(pos[idx[t * 3 + c] as usize * 3], pos[idx[t * 3 + c] as usize * 3 + 1], pos[idx[t * 3 + c] as usize * 3 + 2]);
                let (v0, v1, v2) = (v(0), v(1), v(2));
                let (e1, e2) = (v1 - v0, v2 - v0);
                let pv = d.cross(e2);
                let det = e1.dot(pv);
                if det.abs() < 1e-12 {
                    continue;
                }
                let id = 1.0 / det;
                let tv = o - v0;
                let u = tv.dot(pv) * id;
                let q = tv.cross(e1);
                let w = d.dot(q) * id;
                let tt = e2.dot(q) * id;
                if (0.0..=1.0).contains(&u) && w >= 0.0 && u + w <= 1.0 && tt > 1e-6 && tt < best {
                    best = tt;
                }
            }
            best
        };
        let mut hits = 0;
        for _ in 0..300 {
            let o = Vec3::new(rnd() * 12.0 - 6.0, rnd() * 12.0 - 6.0, -8.0);
            let d = Vec3::new(rnd() - 0.5, rnd() - 0.5, 1.0).normalize();
            let want = brute(o, d);
            let got = bvh.closest(o, d, f32::INFINITY).map(|h| h.0).unwrap_or(f32::INFINITY);
            assert!((want.is_infinite() && got.is_infinite()) || (want - got).abs() < 1e-4, "{want} vs {got}");
            if want.is_finite() {
                hits += 1;
            }
        }
        assert!(hits > 5, "the test rays should hit something ({hits})");
    }
}

#[cfg(test)]
mod speed {
    use super::*;
    /// Not a check, a measurement: how long a million triangles take (run with --release -- --ignored --nocapture).
    #[test]
    #[ignore]
    fn million_triangles() {
        let n = 1_000_000usize;
        let mut s = 7u32;
        let mut r = || {
            s = s.wrapping_mul(1664525).wrapping_add(1013904223);
            (s >> 8) as f32 / 16777216.0
        };
        let mut pos = Vec::with_capacity(n * 9);
        let mut idx = Vec::with_capacity(n * 3);
        for t in 0..n {
            let (x, y, z) = (r() * 100.0, r() * 100.0, r() * 100.0);
            for _ in 0..3 {
                pos.extend_from_slice(&[x + r() * 0.2, y + r() * 0.2, z + r() * 0.2]);
            }
            idx.extend_from_slice(&[t as u32 * 3, t as u32 * 3 + 1, t as u32 * 3 + 2]);
        }
        let t0 = std::time::Instant::now();
        let b = build(&pos, &idx);
        println!("{} triangles: {} nodes in {:?}", n, b.nodes.len(), t0.elapsed());
    }
}
