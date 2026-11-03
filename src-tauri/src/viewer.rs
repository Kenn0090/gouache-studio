//! The new native 3D viewer (0.94): opens it in its own window with the model, its materials and the environment.
//! The page sends one raw body (see gouache-render's wire format).

use std::sync::Mutex;

use std::sync::Arc;

use gouache_render::{CaptureOpts, scene_from_bytes, textures_from_bytes, update_from_bytes, Viewer};
use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Emitter};

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
pub async fn viewer_open(app: AppHandle, request: Request<'_>) -> Result<ViewerInfo, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected a raw body".into());
    };
    let scene = scene_from_bytes(bytes)?;
    drop(request); // nothing borrowed from the request may live across the await below
    let out = tauri::async_runtime::spawn_blocking(move || {
        close_current();
        // what the pointer does in the window (while painting) goes to the page as 'viewer-event'
        let sink: gouache_render::EventSink = Arc::new(move |json: String| {
            let _ = app.emit("viewer-event", json);
        });
        gouache_render::open(scene, Some(sink))
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

/// Changes the lighting of the open viewer (and its environment picture when asked) without sending the model again.
/// Returns false when there is no viewer any more (the window was closed).
#[tauri::command]
pub fn viewer_update(request: Request<'_>) -> Result<bool, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected a raw body".into());
    };
    let (settings, env) = update_from_bytes(bytes)?;
    let mut g = VIEWER.lock().map_err(|e| e.to_string())?;
    let alive = match g.as_ref() {
        Some(v) => v.update(settings, env),
        None => false,
    };
    if !alive {
        *g = None;
    }
    Ok(alive)
}

/// Replaces the model, materials and settings of the open window (the model was changed in the page) without closing it.
/// Returns false when there is no viewer any more.
#[tauri::command]
pub fn viewer_scene(request: Request<'_>) -> Result<bool, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected a raw body".into());
    };
    let scene = scene_from_bytes(bytes)?;
    let mut g = VIEWER.lock().map_err(|e| e.to_string())?;
    let alive = match g.as_ref() {
        Some(v) => v.set_scene(scene),
        None => false,
    };
    if !alive {
        *g = None;
    }
    Ok(alive)
}

/// Gives one material of the open viewer new pictures (after painting). Returns false when the viewer is gone.
#[tauri::command]
pub fn viewer_textures(request: Request<'_>) -> Result<bool, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected a raw body".into());
    };
    let (name, material) = textures_from_bytes(bytes)?;
    let mut g = VIEWER.lock().map_err(|e| e.to_string())?;
    let alive = match g.as_ref() {
        Some(v) => v.set_textures(name, material),
        None => false,
    };
    if !alive {
        *g = None;
    }
    Ok(alive)
}

/// A PNG picture of what the open viewer shows, at the size asked for (the ray tracing settles first, so large pictures take a while).
#[tauri::command]
pub async fn viewer_capture(width: u32, height: u32) -> Result<tauri::ipc::Response, String> {
    let png = tauri::async_runtime::spawn_blocking(move || {
        let g = VIEWER.lock().map_err(|e| e.to_string())?;
        match g.as_ref() {
            Some(v) => v.capture(width, height),
            None => Err("the new viewer is not open".to_string()),
        }
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(png))
}

/// One picture as raw RGBA bytes (top row first), turned a little from the window's view; for turntables.
#[tauri::command]
pub async fn viewer_capture_raw(width: u32, height: u32, yaw_add: f32, env_turn: Option<f32>, sun_az: Option<f32>, rounds: u32) -> Result<tauri::ipc::Response, String> {
    let rgba = tauri::async_runtime::spawn_blocking(move || {
        let g = VIEWER.lock().map_err(|e| e.to_string())?;
        match g.as_ref() {
            Some(v) => v.capture_rgba(width, height, CaptureOpts { yaw_add, env_turn, sun_az, rounds }),
            None => Err("the new viewer is not open".to_string()),
        }
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(rgba))
}
