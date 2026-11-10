//! (0.96.5, Kenn) Picking colours and gradients from anywhere on the screen, also outside the app:
//! the main window steps aside for a moment, the whole desktop (every monitor) is copied, and the
//! window comes back. The page then shows the copy to click or drag a line on, like Substance
//! Designer's gradient picker. Reply: u32 width, u32 height, then RGBA rows top first.
use tauri::ipc::Response;

#[cfg(windows)]
mod imp {
    #[repr(C)]
    struct BitmapInfoHeader {
        size: u32,
        width: i32,
        height: i32,
        planes: u16,
        bit_count: u16,
        compression: u32,
        size_image: u32,
        x_ppm: i32,
        y_ppm: i32,
        clr_used: u32,
        clr_important: u32,
    }
    #[repr(C)]
    struct BitmapInfo {
        header: BitmapInfoHeader,
        colors: [u32; 3],
    }
    #[link(name = "user32")]
    extern "system" {
        fn GetSystemMetrics(i: i32) -> i32;
        fn GetDC(hwnd: isize) -> isize;
        fn ReleaseDC(hwnd: isize, dc: isize) -> i32;
    }
    #[link(name = "gdi32")]
    extern "system" {
        fn CreateCompatibleDC(dc: isize) -> isize;
        fn CreateCompatibleBitmap(dc: isize, w: i32, h: i32) -> isize;
        fn SelectObject(dc: isize, obj: isize) -> isize;
        fn BitBlt(dst: isize, x: i32, y: i32, w: i32, h: i32, src: isize, sx: i32, sy: i32, rop: u32) -> i32;
        fn GetDIBits(dc: isize, bmp: isize, start: u32, lines: u32, bits: *mut u8, info: *mut BitmapInfo, usage: u32) -> i32;
        fn DeleteObject(obj: isize) -> i32;
        fn DeleteDC(dc: isize) -> i32;
    }
    const SRCCOPY: u32 = 0x00CC_0020;
    const CAPTUREBLT: u32 = 0x4000_0000;
    pub fn grab() -> Result<(u32, u32, Vec<u8>), String> {
        unsafe {
            let (x, y, w, h) = (GetSystemMetrics(76), GetSystemMetrics(77), GetSystemMetrics(78), GetSystemMetrics(79));
            if w <= 0 || h <= 0 {
                return Err("no screen".into());
            }
            let screen = GetDC(0);
            let mem = CreateCompatibleDC(screen);
            let bmp = CreateCompatibleBitmap(screen, w, h);
            let old = SelectObject(mem, bmp);
            let ok = BitBlt(mem, 0, 0, w, h, screen, x, y, SRCCOPY | CAPTUREBLT);
            SelectObject(mem, old);
            let mut info = BitmapInfo {
                header: BitmapInfoHeader {
                    size: std::mem::size_of::<BitmapInfoHeader>() as u32,
                    width: w,
                    height: -h, // top row first
                    planes: 1,
                    bit_count: 32,
                    compression: 0,
                    size_image: 0,
                    x_ppm: 0,
                    y_ppm: 0,
                    clr_used: 0,
                    clr_important: 0,
                },
                colors: [0; 3],
            };
            let mut px = vec![0u8; (w as usize) * (h as usize) * 4];
            let lines = if ok != 0 { GetDIBits(mem, bmp, 0, h as u32, px.as_mut_ptr(), &mut info, 0) } else { 0 };
            DeleteObject(bmp);
            DeleteDC(mem);
            ReleaseDC(0, screen);
            if lines == 0 {
                return Err("the screen could not be copied".into());
            }
            for p in px.chunks_exact_mut(4) {
                p.swap(0, 2); // BGRA -> RGBA
                p[3] = 255;
            }
            Ok((w as u32, h as u32, px))
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn grab() -> Result<(u32, u32, Vec<u8>), String> {
        Err("Picking from the screen works in the Windows app.".into())
    }
}

#[tauri::command]
pub async fn screen_grab(window: tauri::WebviewWindow, hide: bool) -> Result<Response, String> {
    if hide {
        let _ = window.hide();
        std::thread::sleep(std::time::Duration::from_millis(280));
    }
    let r = imp::grab();
    if hide {
        let _ = window.show();
        let _ = window.set_focus();
    }
    let (w, h, px) = r?;
    let mut out = Vec::with_capacity(8 + px.len());
    out.extend_from_slice(&w.to_le_bytes());
    out.extend_from_slice(&h.to_le_bytes());
    out.extend_from_slice(&px);
    Ok(Response::new(out))
}
