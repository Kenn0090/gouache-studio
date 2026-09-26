//! Undo history spill-to-disk. When undo snapshots exceed the RAM budget, the interface sends the
//! oldest ones here; they are written to temporary files and read back only if you undo that far.

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

static NEXT: AtomicU64 = AtomicU64::new(1);

fn dir(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("undo-spill");
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}

/// Clear leftovers from a previous session.
pub fn reset(app: &AppHandle) {
    if let Ok(d) = dir(app) {
        let _ = fs::remove_dir_all(&d);
        let _ = fs::create_dir_all(&d);
    }
}

fn safe_id(id: &str) -> Result<&str, String> {
    if !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric()) {
        Ok(id)
    } else {
        Err("bad spill id".into())
    }
}

#[tauri::command]
pub fn spill_write(app: AppHandle, request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw bytes".into());
    };
    let id = format!("u{}", NEXT.fetch_add(1, Ordering::Relaxed));
    fs::write(dir(&app)?.join(&id), bytes).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn spill_read(app: AppHandle, id: String) -> Result<Response, String> {
    let p = dir(&app)?.join(safe_id(&id)?);
    fs::read(p).map(Response::new).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn spill_delete(app: AppHandle, id: String) -> Result<(), String> {
    let p = dir(&app)?.join(safe_id(&id)?);
    let _ = fs::remove_file(p);
    Ok(())
}
