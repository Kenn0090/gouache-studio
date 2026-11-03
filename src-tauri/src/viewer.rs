//! The new native 3D viewer (0.94): opens it in its own window with the model, its materials and the environment.
//! The page sends one raw body (see gouache-render's wire format).

use std::sync::Mutex;

use gouache_render::{scene_from_bytes, Viewer};
use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};

static VIEWER: Mutex<Option<Viewer>> = Mutex::new(None);

#[derive(Serialize)]
pub struct ViewerInfo {
    pub name: String,
    pub backend: String,
    pub kind: String,
    pub software: bool,
}

fn close_current() {
    if let Ok(mut g) = VIEWER.lock() {
        if let Some(v) = g.take() {
            v.close();
        }
    }
}

/// Opens (or replaces) the viewer window. Runs off the main thread: starting the graphics can take a moment.
#[tauri::command]
pub async fn viewer_open(request: Request<'_>) -> Result<ViewerInfo, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected a raw body".into());
    };
    let scene = scene_from_bytes(bytes)?;
    drop(request); // nothing borrowed from the request may live across the await below
    let out = tauri::async_runtime::spawn_blocking(move || {
        close_current();
        gouache_render::open(scene)
    })
    .await
    .map_err(|e| e.to_string())??;
    let info = ViewerInfo { name: out.report.name.clone(), backend: out.report.backend.clone(), kind: out.report.kind.clone(), software: out.report.software };
    *VIEWER.lock().map_err(|e| e.to_string())? = Some(out);
    Ok(info)
}

#[tauri::command]
pub fn viewer_close() {
    close_current();
}
