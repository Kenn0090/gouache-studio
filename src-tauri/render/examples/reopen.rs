//! Opens the viewer, closes it, opens it again, and takes a picture from the second window.
//! Run it under a virtual display: xvfb-run -a ./target/release/examples/reopen
use gouache_render::*;

fn scene() -> Scene {
    let p = vec![-1.0f32, -1.0, 0.0, 1.0, -1.0, 0.0, 0.0, 1.0, 0.0];
    let n = vec![0.0f32, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0];
    let uv = vec![0.0f32, 0.0, 1.0, 0.0, 0.5, 1.0];
    let groups = vec![Group { name: "Tri".into(), indices: vec![0, 1, 2], material: Material::default() }];
    Scene { mesh: MeshData { positions: p, normals: n, uvs: uv }, groups, env: None, settings: Settings::default(), window: None }
}

fn main() {
    for round in 1..=3 {
        match open(scene(), None) {
            Ok(v) => {
                println!("OPEN {round}: {}", v.report.name);
                std::thread::sleep(std::time::Duration::from_secs(2));
                match v.capture(320, 200, false) {
                    Ok(png) => println!("PICTURE {round}: {} bytes", png.len()),
                    Err(e) => println!("CAPTURE ERROR {round}: {e}"),
                }
                v.close();
                std::thread::sleep(std::time::Duration::from_millis(800));
                println!("CLOSED {round}");
            }
            Err(e) => {
                println!("OPEN ERROR {round}: {e}");
                std::process::exit(1);
            }
        }
    }
    println!("ALL ROUNDS OK");
}
