//! Direct file reads and writes, plus the recent-files list.

use std::fs;
use std::path::PathBuf;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

const MAX_RECENT: usize = 12;

/// Read a whole file and hand the bytes to the interface as binary (no JSON encoding).
#[tauri::command]
pub fn read_file(path: String) -> Result<Response, String> {
    fs::read(&path).map(Response::new).map_err(|e| format!("{path}: {e}"))
}

/// Size of a file in bytes (so big reads can be done in pieces with a progress bar).
#[tauri::command]
pub fn file_size(path: String) -> Result<u64, String> {
    fs::metadata(&path).map(|m| m.len()).map_err(|e| format!("{path}: {e}"))
}

/// Read part of a file: `len` bytes from `offset`, as binary.
#[tauri::command]
pub fn read_file_range(path: String, offset: u64, len: u64) -> Result<Response, String> {
    use std::io::{Read, Seek, SeekFrom};
    let mut f = fs::File::open(&path).map_err(|e| format!("{path}: {e}"))?;
    f.seek(SeekFrom::Start(offset)).map_err(|e| format!("{path}: {e}"))?;
    let mut buf = Vec::with_capacity(len as usize);
    f.take(len).read_to_end(&mut buf).map_err(|e| format!("{path}: {e}"))?;
    Ok(Response::new(buf))
}

/// Write bytes sent as a raw request body. The destination path travels in the `x-path` header
/// (URL-encoded), so large files never pass through JSON.
#[tauri::command]
pub fn write_file(request: Request<'_>) -> Result<(), String> {
    let raw = request
        .headers()
        .get("x-path")
        .ok_or("missing x-path header")?
        .to_str()
        .map_err(|e| e.to_string())?;
    let path = percent_decode(raw);
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw bytes".into());
    };
    // Write to a temporary file next to the target, then rename, so a crash never leaves a half-written file.
    let target = PathBuf::from(&path);
    let tmp = target.with_extension(format!(
        "{}.part",
        target.extension().and_then(|e| e.to_str()).unwrap_or("tmp")
    ));
    fs::write(&tmp, bytes).map_err(|e| format!("{path}: {e}"))?;
    fs::rename(&tmp, &target).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("{path}: {e}")
    })
}

fn recent_file(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    fs::create_dir_all(&dir).ok()?;
    Some(dir.join("recent.json"))
}

fn load_recent(app: &AppHandle) -> Vec<String> {
    recent_file(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .unwrap_or_default()
}

/// Recent files that still exist on disk, newest first.
#[tauri::command]
pub fn recent_list(app: AppHandle) -> Vec<String> {
    load_recent(&app)
        .into_iter()
        .filter(|p| PathBuf::from(p).exists())
        .collect()
}

#[tauri::command]
pub fn recent_add(app: AppHandle, path: String) -> Result<(), String> {
    let mut list = load_recent(&app);
    list.retain(|p| p != &path);
    list.insert(0, path);
    list.truncate(MAX_RECENT);
    let file = recent_file(&app).ok_or("no config directory")?;
    fs::write(file, serde_json::to_string_pretty(&list).unwrap()).map_err(|e| e.to_string())
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use super::percent_decode;
    #[test]
    fn decodes_windows_paths() {
        assert_eq!(
            percent_decode("C%3A%5CUsers%5CKenn%5CTextures%5Cstone%20tile.psd"),
            r"C:\Users\Kenn\Textures\stone tile.psd"
        );
        assert_eq!(percent_decode("%E2%9C%93.png"), "✓.png");
        assert_eq!(percent_decode("plain"), "plain");
    }
}
