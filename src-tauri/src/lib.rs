//! Gouache Studio desktop back end.
//!
//! The painting interface runs in the window (WebView2 on Windows). This Rust side is the
//! "engine room": direct file access, recent files, undo spill-to-disk, self-update, and later the
//! heavy GPU/CPU work (mesh baking, large-file encoding) that a browser cannot do.

mod altmenu;
mod engine;
mod files;
mod undo_spill;
mod updates;


#[tauri::command]
fn set_title(window: tauri::WebviewWindow, title: String) -> Result<(), String> {
    window.set_title(&title).map_err(|e| e.to_string())
}

/// The file the app was started with (double-clicking a .gouache file in Explorer), if any.
#[tauri::command]
fn launch_file() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| !a.starts_with('-') && std::path::Path::new(a).is_file())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updates::Pending::default())
        .manage(undo_spill::CacheDir::default())
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
                // TEST BUILD ONLY: open the web console at start-up to show any error
                w.open_devtools();
                altmenu::install(&w);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_title,
            launch_file,
            files::read_file,
            files::file_size,
            files::read_file_range,
            files::write_file,
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
