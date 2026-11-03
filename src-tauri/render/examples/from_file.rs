// Opens the viewer with a scene saved by the page (the body sent to `viewer_open`), for checking the whole path.
fn main() {
    let path = std::env::args().nth(1).expect("path to the body file");
    let bytes = std::fs::read(path).unwrap();
    let scene = gouache_render::scene_from_bytes(&bytes).unwrap();
    match gouache_render::open(scene) {
        Ok(v) => { println!("OPEN {:?}", v.report); std::thread::sleep(std::time::Duration::from_secs(12)); v.close(); std::thread::sleep(std::time::Duration::from_millis(500)); println!("CLOSED"); }
        Err(e) => println!("ERROR {e}"),
    }
}
