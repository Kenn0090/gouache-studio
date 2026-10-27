//! Gouache Studio desktop back end.
//!
//! The painting interface runs in the window (WebView2 on Windows). This Rust side is the
//! "engine room": direct file access, recent files, undo spill-to-disk, self-update, and later the
//! heavy GPU/CPU work (mesh baking, large-file encoding) that a browser cannot do.

mod altmenu;
mod engine;
mod files;
mod net;
mod single;
mod undo_spill;
mod updates;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;


/// While the page is running it asks to be told when the window is closed (so it can ask about unsaved work).
/// Off by default, so a page that never loaded can still be closed.
static CLOSE_GUARD: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn close_guard(on: bool) {
    CLOSE_GUARD.store(on, Ordering::SeqCst);
}

/// Quit for real (the page calls this once it has asked about unsaved work).
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_title(window: tauri::WebviewWindow, title: String) -> Result<(), String> {
    window.set_title(&title).map_err(|e| e.to_string())
}

/// The file the app was started with (double-clicking a .gouache file in Explorer), if any.
#[tauri::command]
fn launch_file() -> Option<String> {
    single::file_arg()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Already running? Hand this start's file to that copy and quit, so a double-clicked document opens as another tab there.
    if single::hand_over() {
        return;
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updates::Pending::default())
        .manage(undo_spill::CacheDir::default())
        .on_window_event(|window, event| {
            // Closing the main window: when the page asked for it, hold the close and let the page ask
            // "save your changes?" first (it calls quit_app when the answer is in).
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    if CLOSE_GUARD.load(Ordering::SeqCst) {
                        api.prevent_close();
                        let _ = window.emit("gs-close", ());
                    }
                }
            }
        })
        .setup(|app| {
            // Start each session with an empty undo folder in the default cache (a chosen folder is
            // cleared when the interface sets it at start-up).
            undo_spill::reset(&app.handle());
            // The main window is built here (not from the config alone) so that the 3D view can
            // pop out into its own window: window.open("about:blank") from the page is allowed and
            // gets a plain window the page draws into. Anything else is refused.
            if let Some(cfg) = app.config().app.windows.iter().find(|w| w.label == "main").cloned() {
                let w = tauri::WebviewWindowBuilder::from_config(app.handle(), &cfg)?
                    .on_new_window(|url, _features| {
                        if url.as_str() == "about:blank" {
                            tauri::webview::NewWindowResponse::Allow
                        } else {
                            tauri::webview::NewWindowResponse::Deny
                        }
                    })
                    .build()?;
                let _ = w.set_title("Gouache Studio");
                altmenu::install(&w);
            }
            // Later starts (a document opened from Explorer) arrive here: show the window and tell the page which file to open.
            let handle = app.handle().clone();
            single::listen(move |path| {
                use tauri::Manager as _;
                if let Some(w) = handle.get_webview_window("main") {
                    let _ = w.unminimize();
                    let _ = w.show();
                    let _ = w.set_focus();
                    if let Some(p) = path {
                        let _ = w.emit("gs-open-file", p);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_title,
            close_guard,
            quit_app,
            launch_file,
            net::net_get_text,
            net::net_download,
            net::net_cancel,
            files::read_file,
            files::file_size,
            files::read_file_range,
            files::write_file,
            files::write_chunk,
            files::recent_list,
            files::recent_add,
            files::recent_details,
            files::recent_remove,
            files::reveal_path,
            files::autosave_dir,
            files::dir_files,
            files::file_mtime,
            files::make_dir,
            files::launch_app,
            files::blender_send,
            files::open_url,
            files::autosave_list,
            files::autosave_delete,
            files::backup_copy,
            undo_spill::spill_write,
            undo_spill::spill_read,
            undo_spill::spill_delete,
            undo_spill::tree_write,
            undo_spill::tree_read,
            undo_spill::tree_prune,
            undo_spill::cache_info,
            undo_spill::cache_set_dir,
            engine::engine_info,
            updates::update_check,
            updates::update_install,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Gouache Studio");
}
