//! Tauri side of the two-way links (0.96.4): starts the small server in `link_core` and passes each
//! message from Blender, Unity or Unreal to the page as the "link-inbox" event; the page publishes what
//! Roblox Studio's plug-in should fetch with `link_publish` (raw bytes, key in the `x-key` header).
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Emitter};

static RUNNING: AtomicBool = AtomicBool::new(false);

pub fn start(app: &AppHandle) {
    let h = app.clone();
    let ok = crate::link_core::start(crate::link_core::PORT, move |text| {
        let _ = h.emit("link-inbox", text);
    });
    RUNNING.store(ok, Ordering::SeqCst);
}

/// The port the link listens on, or 0 when it could not start (another copy of Gouache has it).
#[tauri::command]
pub fn link_status() -> u16 {
    if RUNNING.load(Ordering::SeqCst) {
        crate::link_core::PORT
    } else {
        0
    }
}

#[tauri::command]
pub fn link_publish(request: Request<'_>) -> Result<(), String> {
    let key = request
        .headers()
        .get("x-key")
        .ok_or("missing x-key header")?
        .to_str()
        .map_err(|e| e.to_string())?
        .to_string();
    if key.is_empty() || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.') {
        return Err("bad key".into());
    }
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw bytes".into());
    };
    crate::link_core::publish(&key, bytes.clone());
    Ok(())
}
