// Opens the viewer with a scene saved by the page (the body sent to `viewer_open`), for checking the whole path.
fn main() {
    let path = std::env::args().nth(1).expect("path to the body file");
    let bytes = std::fs::read(path).unwrap();
    let scene = gouache_render::scene_from_bytes(&bytes).unwrap();
    match gouache_render::open(scene, None) {
        Ok(v) => { println!("OPEN {:?}", v.report); std::thread::sleep(std::time::Duration::from_secs(3));
            if let Some(out) = std::env::var_os("GOUACHE_CAPTURE") {
                let (w, h) = (std::env::var("CAP_W").ok().and_then(|v| v.parse().ok()).unwrap_or(1100u32), std::env::var("CAP_H").ok().and_then(|v| v.parse().ok()).unwrap_or(760u32));
                match v.capture(w, h, std::env::var("GOUACHE_TRANSPARENT").is_ok()) { Ok(png) => { std::fs::write(out, png).unwrap(); println!("CAPTURED"); } Err(e) => println!("CAPTURE ERROR {e}") }
            } v.close(); std::thread::sleep(std::time::Duration::from_millis(500)); println!("CLOSED"); }
        Err(e) => println!("ERROR {e}"),
    }
}
