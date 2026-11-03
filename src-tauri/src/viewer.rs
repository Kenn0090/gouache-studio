//! The new native 3D viewer (0.94): opens it in its own window, with the model and its picture.
//! The page sends one raw body: positions, normals, UVs (32-bit floats), triangle indices (32-bit),
//! then the picture (RGBA bytes). The counts travel in the `x-meta` header as JSON.

use std::sync::Mutex;

use gouache_render::{MeshData, TexData, Viewer};
use serde::{Deserialize, Serialize};
use tauri::ipc::{InvokeBody, Request};

static VIEWER: Mutex<Option<Viewer>> = Mutex::new(None);

#[derive(Deserialize)]
struct Meta {
    pos: usize,
    nrm: usize,
    uv: usize,
    idx: usize,
    tw: u32,
    th: u32,
}

#[derive(Serialize)]
pub struct ViewerInfo {
    pub name: String,
    pub backend: String,
    pub kind: String,
    pub software: bool,
}

fn floats(b: &[u8]) -> Vec<f32> {
    b.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect()
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
    let meta: Meta = serde_json::from_str(
        request.headers().get("x-meta").ok_or("missing x-meta header")?.to_str().map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("bad x-meta: {e}"))?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected a raw body".into());
    };
    let (np, nn, nu, ni) = (meta.pos * 4, meta.nrm * 4, meta.uv * 4, meta.idx * 4);
    let nt = (meta.tw as usize) * (meta.th as usize) * 4;
    if bytes.len() != np + nn + nu + ni + nt {
        return Err(format!("the model data is the wrong size ({} bytes, expected {})", bytes.len(), np + nn + nu + ni + nt));
    }
    let positions = floats(&bytes[..np]);
    let normals = floats(&bytes[np..np + nn]);
    let uvs = floats(&bytes[np + nn..np + nn + nu]);
    let indices: Vec<u32> =
        bytes[np + nn + nu..np + nn + nu + ni].chunks_exact(4).map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect();
    let tex = if nt > 0 {
        Some(TexData { width: meta.tw, height: meta.th, rgba: bytes[np + nn + nu + ni..].to_vec() })
    } else {
        None
    };
    let mesh = MeshData { positions, normals, uvs, indices };
    drop(request); // nothing borrowed from the request may live across the await below
    let out = tauri::async_runtime::spawn_blocking(move || {
        close_current();
        gouache_render::open(mesh, tex)
    })
    .await
    .map_err(|e| e.to_string())??;
    let info = ViewerInfo {
        name: out.report.name.clone(),
        backend: out.report.backend.clone(),
        kind: out.report.kind.clone(),
        software: out.report.software,
    };
    *VIEWER.lock().map_err(|e| e.to_string())? = Some(out);
    Ok(info)
}

#[tauri::command]
pub fn viewer_close() {
    close_current();
}
