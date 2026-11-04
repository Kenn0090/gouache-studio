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
    // a row of balls, each with another shader of the 3D view, on a floor, under a made-up sky
    let looks: [(&str, i32, [f32; 4], [f32; 4], [f32; 3], [f32; 3], [f32; 4]); 8] = [
        ("Standard", 0, [0.; 4], [0.; 4], [1.; 3], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Hologram", 9, [40., 0.35, 1.4, 0.8], [0.6, 0.5, 0., 0.], [0.2, 0.85, 1.], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Glass", 10, [0.5, 0., 0.5, 1.], [0.08, 0.2, 0., 0.], [0.9, 0.97, 1.], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Fur", 11, [0.5, 90., 0.3, 0.3], [1., 0.5, 0.7, 0.5], [0.95, 0.85, 0.7], [0.; 3], [0.3, 0., 0., 0.]),
        ("Iridescent", 12, [0.8, 0., 1.5, 0.8], [0.; 4], [1.; 3], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Car paint", 13, [0.5, 170., 1., 1.], [0.04, 0.3, 0., 0.], [1., 0.85, 0.5], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Cloth", 14, [1., 0.5, 0., 0.5], [0.4, 0., 0., 0.], [1., 0.9, 0.85], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Wax", 15, [1.5, 0.7, 0.6, 0.5], [0.; 4], [1., 0.62, 0.3], [0.; 3], [0.45, 1., 0.5, 0.]),
    ];
    let toons: [(&str, i32, [f32; 4], [f32; 4], [f32; 3], [f32; 3], [f32; 4]); 8] = [
        ("Standard", 0, [0.; 4], [0.; 4], [1.; 3], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Halftone", 16, [3., 0.1, 0.5, 90.], [0., 0.55, 0.5, 0.55], [0.7, 0.25, 0.6], [1., 0.65, 0.55], [0.5, 0.35, 0.3, 0.]),
        ("Halftone hard", 16, [3., 0.02, 0., 90.], [2., 0.6, 0.8, 0.5], [0.6, 0.2, 0.5], [1., 0.8, 0.5], [0.6, 0.3, 0.5, 0.]),
        ("Halftone coarse", 16, [2., 0.1, 0.9, 40.], [0., 0.5, 0.4, 0.5], [0.75, 0.3, 0.55], [1., 0.7, 0.6], [0.4, 0.35, 0.2, 0.]),
        ("Ink", 17, [2., 0.03, 0.3, 0.6], [2.5, 0.4, 0., 0.35], [0.45, 0.45, 0.75], [1., 0.4, 0.35], [0.08, 0.04, 0.05, 0.]),
        ("Ink clean", 17, [1., 0.01, 0.25, 0.5], [2., 0., 1., 0.35], [0.5, 0.5, 0.8], [1., 0.75, 0.6], [0.05, 0.05, 0.08, 0.]),
        ("Ink night", 17, [2., 0.03, 0.35, 0.8], [2., 0.3, 0., 0.3], [0.25, 0.3, 0.6], [0.4, 0.7, 1.], [0.08, 0.04, 0.05, 0.]),
        ("Toon", 4, [3., 0., 0.3, 0.2], [2., 0., 0., 0.], [0.45, 0.4, 0.55], [0.; 3], [0.45, 1., 0.5, 0.]),
    ];
    let kinds: [(&str, i32, [f32; 4], [f32; 4], [f32; 3], [f32; 3], [f32; 4]); 8] = if std::env::var("GOUACHE_LOOKS").map(|v| v == "2").unwrap_or(false) { toons } else if std::env::var_os("GOUACHE_LOOKS").is_some() { looks } else { [
        ("Standard", 0, [0.; 4], [0.; 4], [1.; 3], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Skin", 1, [0.5, 0.6, 0.5, 0.5], [0., 0., 0.3, 0.], [0.85, 0.25, 0.18], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Brushed", 2, [0.7, 0.1, 0., 0.5], [0.; 4], [1.; 3], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Velvet", 3, [0.8, 0.5, 1., 0.5], [0.; 4], [1., 0.6, 0.7], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Toon", 4, [3., 0., 0.3, 0.2], [2., 0., 0., 0.], [0.45, 0.4, 0.55], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Cel", 5, [0.5, 0.06, 0.3, 0.15], [2., 0., 0., 0.], [0.45, 0.42, 0.55], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("SpecGloss", 6, [0.; 4], [0.; 4], [1.; 3], [0.; 3], [0.45, 1., 0.5, 0.]),
        ("Retro", 8, [32., 1., 0.6, 0.], [0., 0., 0.35, 1.], [31., 31., 31.], [0.5, 0.55, 0.65], [0.45, 1., 0.5, 0.]),
    ] };
    let (sp, sn, suv, sidx) = sphere(40);
    let cnt = sp.len() as u32 / 3;
    let (mut p, mut n, mut uv) = (vec![], vec![], vec![]);
    let mut groups = vec![];
    let mk = |f: &dyn Fn(u32, u32) -> [u8; 4]| { let mut v = vec![]; for y in 0..64 { for x in 0..64 { v.extend(f(x, y)); } } Tex8 { width: 64, height: 64, rgba: v } };
    for (k, (name, kind, pp, q, c, d, skin)) in kinds.iter().enumerate() {
        let off = (k as f32 - 3.5) * 2.3;
        for i in 0..cnt as usize { p.extend([sp[i * 3] + off, sp[i * 3 + 1], sp[i * 3 + 2]]); n.extend([sn[i * 3], sn[i * 3 + 1], sn[i * 3 + 2]]); uv.extend([suv[i * 2], suv[i * 2 + 1]]); }
        let idx: Vec<u32> = sidx.iter().map(|i| i + cnt * k as u32).collect();
        let base = mk(&|x, y| if (x / 8 + y / 8) % 2 == 0 { [225, 190, 150, 255] } else { [150, 100, 80, 255] });
        let shader = ShaderParams { kind: *kind, p: *pp, q: *q, c: *c, d: *d, skin: *skin, e: if *kind == 17 { [0.6, 0.8, 0., 0.] } else if *kind == 16 { [std::env::var("GOUACHE_FOLLOW").ok().and_then(|v| v.parse().ok()).unwrap_or(0.0), 0., 0., 0.] } else { [0.; 4] } };
        groups.push(Group { name: name.to_string(), indices: idx, material: Material { shader, base: Some(base), orm: None, normal: None, emissive: None, height: if std::env::var_os("GOUACHE_DISP").is_some() { let mut px = Vec::new(); for y in 0..64u32 { for x in 0..64u32 { let v = if ((x / 8) + (y / 8)) % 2 == 0 { 255u8 } else { 0 }; px.extend_from_slice(&[v, v, v, 255]); } } Some(Tex8 { width: 64, height: 64, rgba: px }) } else { None }, thick: None, udim: None, fold_off: 0.0, rough: 0.45, metal: if *kind == 2 { 1.0 } else { 0.0 }, partial: false } });
    }
    let fb = cnt * kinds.len() as u32;
    p.extend([-12., -1., -4., 12., -1., -4., 12., -1., 4., -12., -1., 4.]);
    n.extend([0., 1., 0., 0., 1., 0., 0., 1., 0., 0., 1., 0.]);
    uv.extend([0., 0., 8., 0., 8., 2., 0., 2.]);
    let floor = mk(&|x, y| if (x / 16 + y / 16) % 2 == 0 { [120, 120, 130, 255] } else { [60, 60, 70, 255] });
    groups.push(Group { name: "Floor".into(), indices: vec![fb, fb + 2, fb + 1, fb, fb + 3, fb + 2], material: Material { shader: ShaderParams::default(), base: Some(floor), orm: None, normal: None, emissive: None, height: None, thick: None, fold_off: 0.0, udim: if std::env::var_os("GOUACHE_UDIM").is_some() { Some([0, 0]) } else { None }, rough: 0.8, metal: 0.0, partial: false } });
    let (w, h) = (256u32, 128u32);
    let mut rgb = vec![];
    for y in 0..h { for x in 0..w {
        let v = y as f32 / h as f32;
        let mut c = if v < 0.5 { [0.3 + 0.4 * (1.0 - v * 2.0), 0.5 + 0.3 * (1.0 - v * 2.0), 0.9] } else { [0.35, 0.3, 0.25] };
        let (dx, dy) = (x as f32 - 160.0, y as f32 - 30.0);
        if dx * dx + dy * dy < 40.0 { c = [40.0, 36.0, 30.0]; }
        rgb.extend(c);
    } }
    let scene = Scene { mesh: MeshData { positions: p, normals: n, uvs: uv }, groups, env: Some(EnvData { width: w, height: h, rgb }), settings: Settings { paint: std::env::var_os("GOUACHE_RING_TEST").is_some(), brush: 0.2, rt: std::env::var_os("GOUACHE_RT_TEST").is_some(), mir: if std::env::var_os("GOUACHE_MIR").is_some() { [0.0, f32::NAN, f32::NAN] } else { [f32::NAN; 3] }, mir_radial: if std::env::var_os("GOUACHE_MIR").is_some() { [6.0, 1.0] } else { [0.0, 0.0] }, mir_r: if std::env::var_os("GOUACHE_MIR").is_some() { 2.0 } else { 0.0 }, wire: std::env::var("GOUACHE_WIRE").ok().and_then(|v| v.parse().ok()).unwrap_or(0), fold: std::env::var("GOUACHE_FOLD").ok().and_then(|v| v.parse().ok()).unwrap_or(0.0), hv: std::env::var("GOUACHE_HV").ok().and_then(|v| v.parse().ok()).unwrap_or(0), mirc_n: if std::env::var_os("GOUACHE_MIRC").is_some() { 2 } else { 0 }, mirc: { let mut a = [[0.0f32; 16]; 32]; a[0] = [1.,0.,0.,0., 0.,1.,0.,0., 0.,0.,1.,0., 0.,0.,0.,1.]; a[1] = [-1.,0.,0.,0., 0.,1.,0.,0., 0.,0.,1.,0., 0.,0.,0.,1.]; a }, floor: if std::env::var_os("GOUACHE_FLOOR").is_some() { [-0.98, 8.0, 0.8, 1.0] } else { [0.0, 0.0, 1.0, 0.5] }, post_on: std::env::var_os("GOUACHE_POST").is_some(), post: { let m: f32 = std::env::var("GOUACHE_POST").ok().and_then(|v| v.parse().ok()).unwrap_or(0.0); [[0.3, 0.5, 0.0, 0.0], [if m == 2.0 { 1.0 } else { 0.0 }, 0.8, 0.0, 0.0], [1.0, 1.0, 0.25, 0.0], [0.2, 0.2, 0.3, 0.2], [0.6, 0.5, 0.3, 0.3], [0.6, 7.13, 1.0, 1.4], [if m == 3.0 { 8.0 } else { 0.0 }, 1.0, 5.0, 0.0]] }, disp: if std::env::var_os("GOUACHE_DISP").is_some() { 0.12 } else { 0.0 }, st_on: std::env::var_os("GOUACHE_ST").is_some(), st: [800.0, 450.0, 200.0, 200.0, 0.3, 0.6, 0.0, 0.0], st_view: [1600.0, 900.0], ..Settings::default() }, window: None };
    match open(scene, None) {
        Ok(v) => { println!("OPEN {:?}", v.report);
            if std::env::var_os("GOUACHE_BEV").is_some() { let (w, h) = (1600u32, 900u32); let mut b: Vec<u8> = Vec::new(); b.extend_from_slice(&w.to_le_bytes()); b.extend_from_slice(&h.to_le_bytes()); for f in [f32::NAN, 0.0, 0.0, 0.0, 0.0, 0.0] { b.extend_from_slice(&f.to_le_bytes()); } for _ in 0..(w * h) { b.extend_from_slice(&[255, 128, 128, 255]); } let n = (b.len() / 4) as u32; v.set_textures("__bev".to_string(), Material { base: Some(Tex8 { width: n, height: 1, rgba: b }), ..Default::default() }); }
            if std::env::var_os("GOUACHE_HV").is_some() { let mut b: Vec<u8> = Vec::new(); b.extend_from_slice(&4u32.to_le_bytes()); b.extend_from_slice(&6u32.to_le_bytes()); for (x, y) in [(-6.0f32, -0.6f32), (6.0, -0.6), (6.0, 0.9), (-6.0, 0.9)] { for f in [x, y, 0.8f32, 0.0, 0.3, 0.95] { b.extend_from_slice(&f.to_le_bytes()); } } for i in [0u32, 1, 2, 0, 2, 3] { b.extend_from_slice(&i.to_le_bytes()); } let n = (b.len() / 4) as u32; v.set_textures("__hv".to_string(), Material { base: Some(Tex8 { width: n, height: 1, rgba: b }), ..Default::default() }); }
            if std::env::var_os("GOUACHE_HL").is_some() { let mut b = Vec::new(); for t in 1..300u32 { for k in [0u32, t, t + 1] { b.extend_from_slice(&k.to_le_bytes()); } } v.set_textures("__hl".to_string(), Material { base: Some(Tex8 { width: 897, height: 1, rgba: b }), ..Default::default() }); }
            if std::env::var_os("GOUACHE_ST").is_some() { let mut px = Vec::new(); for y in 0..64u32 { for x in 0..64u32 { let on = ((x / 8) + (y / 8)) % 2 == 0; px.extend_from_slice(&[if on { 255 } else { 20 }, if y < 32 { 255 } else { 60 }, 40, 255]); } } v.set_textures("__stencil".to_string(), Material { base: Some(Tex8 { width: 64, height: 64, rgba: px }), ..Default::default() }); }
            if let Some(path) = std::env::var_os("GOUACHE_CAPTURE") {
                std::thread::sleep(std::time::Duration::from_secs(2));
                match v.capture(1600, 900) { Ok(png) => { std::fs::write(path, png).unwrap(); println!("CAPTURED"); } Err(e) => println!("CAPTURE ERROR {e}") }
            } std::thread::sleep(std::time::Duration::from_secs(14)); v.close(); std::thread::sleep(std::time::Duration::from_millis(500)); println!("CLOSED"); }
        Err(e) => println!("ERROR {e}"),
    }
}
