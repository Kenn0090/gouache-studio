//! Pressing and releasing Alt on its own puts a Windows window into "menu mode" (the keyboard goes to the
//! window's menu and the next click is swallowed to leave it). Artists hold Alt all the time to turn the
//! 3D view, and that made the model seem to lock up. The page can't stop this: WebView2 hands the Alt
//! key up to the window. So the main window ignores the keyboard menu request (Alt+Space, the system
//! menu, still works).
#[cfg(all(windows, target_pointer_width = "64"))]
mod imp {
    use std::sync::atomic::{AtomicIsize, Ordering};
    const GWLP_WNDPROC: i32 = -4;
    const WM_SYSCOMMAND: u32 = 0x0112;
    const SC_KEYMENU: usize = 0xF100;
    const VK_SPACE: isize = 0x20;
    static ORIGINAL: AtomicIsize = AtomicIsize::new(0);
    #[link(name = "user32")]
    extern "system" {
        fn SetWindowLongPtrW(hwnd: isize, index: i32, value: isize) -> isize;
        fn CallWindowProcW(prev: isize, hwnd: isize, msg: u32, wp: usize, lp: isize) -> isize;
    }
    unsafe extern "system" fn proc_(hwnd: isize, msg: u32, wp: usize, lp: isize) -> isize {
        if msg == WM_SYSCOMMAND && (wp & 0xFFF0) == SC_KEYMENU && lp != VK_SPACE {
            return 0;
        }
        CallWindowProcW(ORIGINAL.load(Ordering::Relaxed), hwnd, msg, wp, lp)
    }
    pub fn install(hwnd: isize) {
        if hwnd == 0 || ORIGINAL.load(Ordering::Relaxed) != 0 {
            return;
        }
        let f: unsafe extern "system" fn(isize, u32, usize, isize) -> isize = proc_;
        let prev = unsafe { SetWindowLongPtrW(hwnd, GWLP_WNDPROC, f as usize as isize) };
        ORIGINAL.store(prev, Ordering::Relaxed);
    }
}

/// Stop Alt from sending the main window into menu mode (Windows only; nothing elsewhere).
pub fn install(window: &tauri::WebviewWindow) {
    #[cfg(all(windows, target_pointer_width = "64"))]
    if let Ok(h) = window.hwnd() {
        imp::install(h.0 as isize);
    }
    #[cfg(not(all(windows, target_pointer_width = "64")))]
    let _ = window;
}
