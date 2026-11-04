//! Replays what the page sent the viewer: opens the saved scene, then applies the saved picture messages one by one and counts the red paint in what is drawn.
//! Run: xvfb-run -a ./target/release/examples/replay <open.bin> <tex0.bin> [tex1.bin ...]
use gouache_render::*;

fn red_pixels(png_bytes: &[u8]) -> (usize, usize) {
    let dec = png::Decoder::new(std::io::Cursor::new(png_bytes));
    let mut r = dec.read_info().unwrap();
    let mut buf = vec![0; r.output_buffer_size()];
    let info = r.next_frame(&mut buf).unwrap();
    let ch = info.color_type.samples();
    let mut red = 0;
    for p in buf[..info.buffer_size()].chunks(ch) {
        if p[0] > 180 && p[1] < 90 && p[2] < 90 {
            red += 1;
        }
    }
    (red, (info.width * info.height) as usize)
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let scene = scene_from_bytes(&std::fs::read(&args[0]).unwrap()).unwrap();
    let v = open(scene, None).unwrap();
    std::thread::sleep(std::time::Duration::from_secs(2));
    let shot = |label: &str| {
        let png = v.capture(900, 600, false).unwrap();
        let (red, tot) = red_pixels(&png);
        println!("{label}: {red} red of {tot}");
    };
    shot("before any paint");
    for (i, f) in args[1..].iter().enumerate() {
        let (name, mat) = textures_from_bytes(&std::fs::read(f).unwrap()).unwrap();
        let partial = mat.partial;
        let alive = v.set_textures(name.clone(), mat);
        std::thread::sleep(std::time::Duration::from_millis(600));
        shot(&format!("after message {i} (group {name}, partial {partial}, alive {alive})"));
    }
    v.close();
}
