//! Gouache Studio desktop back end.
//!
//! The painting interface runs in the window (WebView2 on Windows). This Rust side is the
//! "engine room": direct file access, recent files, undo spill-to-disk, self-update, and later the
//! heavy GPU/CPU work (mesh baking, large-file encoding) that a browser cannot do.

mod engine;
mod files;
mod undo_spill;
mod updates;

use tauri::Manager;

#[tauri::command]
fn set_title(window: tauri::WebviewWindow, title: String) -> Result<(), String> {
    window.set_title(&title).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updates::Pending::default())
        .setup(|app| {
            // Start each session with an empty undo spill folder.
            undo_spill::reset(&app.handle());
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_title("Gouache Studio");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_title,
            files::read_file,
            files::write_file,
            files::recent_list,
            files::recent_add,
            undo_spill::spill_write,
            undo_spill::spill_read,
            undo_spill::spill_delete,
            engine::engine_info,
            updates::update_check,
            updates::update_install,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Gouache Studio");
}
