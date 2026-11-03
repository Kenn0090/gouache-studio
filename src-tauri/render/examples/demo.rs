// Opens the viewer with a sphere and a plane, two materials and a made-up sky, then closes it after a few seconds.
use gouache_render::*;
fn sphere(n: u32) -> (Vec<f32>, Vec<f32>, Vec<f32>, Vec<u32>) {
    let (mut p, mut nr, mut uv, mut idx) = (vec![], vec![], vec![], vec![]);
    for y in 0..=n { for x in 0..=n {
        let (u, v) = (x as f32 / n as f32, y as f32 / n as f32);
        let (th, ph) = (v * std::f32::consts::PI, u * 2.0 * std::f32::consts::PI);
        let d = [th.sin() * ph.cos(), th.cos(), th.sin() * ph.sin()];
        p.extend(d); nr.extend(d); uv.extend([u * 2.0, v]);
    } }
    for y in 0..n { for x in 0..n { let a = y * (n + 1) + x; let b = a + n + 1; idx.extend([a, b, a + 1, a + 1, b, b + 1]); } }
    (p, nr, uv, idx)
}
fn main() {
    let (p, n, uv, idx) = sphere(48);
    let cnt = p.len() as u32 / 3;
    // a floor under it
    let mut p2 = p.clone(); let mut n2 = n.clone(); let mut uv2 = uv.clone();
    p2.extend([-3., -1., -3., 3., -1., -3., 3., -1., 3., -3., -1., 3.]);
    n2.extend([0., 1., 0., 0., 1., 0., 0., 1., 0., 0., 1., 0.]);
    uv2.extend([0., 0., 4., 0., 4., 4., 0., 4.]);
    let floor_idx = vec![cnt, cnt + 2, cnt + 1, cnt, cnt + 3, cnt + 2];
    // base colour: checker; orm: shiny metal stripes; normal: bumps
    let mk = |f: &dyn Fn(u32, u32) -> [u8; 4]| { let mut v = vec![]; for y in 0..128 { for x in 0..128 { v.extend(f(x, y)); } } Tex8 { width: 128, height: 128, rgba: v } };
    let base = mk(&|x, y| if (x / 16 + y / 16) % 2 == 0 { [230, 200, 90, 255] } else { [160, 40, 40, 255] });
    let orm = mk(&|x, _| [255, if (x / 8) % 2 == 0 { 40 } else { 200 }, if (x / 8) % 2 == 0 { 255 } else { 0 }, 255]);
    let nrm = mk(&|x, y| { let a = ((x % 16) as f32 - 8.0) / 8.0; let b = ((y % 16) as f32 - 8.0) / 8.0; [(128.0 + a * 60.0) as u8, (128.0 + b * 60.0) as u8, 220, 255] });
    let floor = mk(&|x, y| if (x / 32 + y / 32) % 2 == 0 { [120, 120, 130, 255] } else { [60, 60, 70, 255] });
    // a sky: blue above, warm ground, a bright sun
    let (w, h) = (256u32, 128u32);
    let mut rgb = vec![];
    for y in 0..h { for x in 0..w {
        let v = y as f32 / h as f32;
        let mut c = if v < 0.5 { [0.3 + 0.4 * (1.0 - v * 2.0), 0.5 + 0.3 * (1.0 - v * 2.0), 0.9] } else { [0.35, 0.3, 0.25] };
        let (dx, dy) = (x as f32 - 160.0, y as f32 - 30.0);
        if dx * dx + dy * dy < 40.0 { c = [40.0, 36.0, 30.0]; }
        rgb.extend(c);
    } }
    let scene = Scene {
        mesh: MeshData { positions: p2, normals: n2, uvs: uv2 },
        groups: vec![
            Group { name: "Ball".into(), indices: idx, material: Material { base: Some(base), orm: Some(orm), normal: Some(nrm), emissive: None, rough: 0.5, metal: 0.0 } },
            Group { name: "Floor".into(), indices: floor_idx, material: Material { base: Some(floor), orm: None, normal: None, emissive: None, rough: 0.8, metal: 0.0 } },
        ],
        env: Some(EnvData { width: w, height: h, rgb }),
        settings: Settings::default(),
    };
    match open(scene) {
        Ok(v) => { println!("OPEN {:?}", v.report); std::thread::sleep(std::time::Duration::from_secs(12)); v.close(); std::thread::sleep(std::time::Duration::from_millis(500)); println!("CLOSED"); }
        Err(e) => println!("ERROR {e}"),
    }
}
