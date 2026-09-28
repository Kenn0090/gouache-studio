//! Direct file reads and writes, plus the recent-files list.

use std::fs;
use std::path::PathBuf;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

const MAX_RECENT: usize = 20;

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

/// Recent files with when each was last saved (seconds since 1970), newest first.
#[tauri::command]
pub fn recent_details(app: AppHandle) -> Vec<(String, u64)> {
    load_recent(&app)
        .into_iter()
        .filter_map(|p| {
            let m = fs::metadata(&p).ok()?;
            let t = m
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            Some((p, t))
        })
        .collect()
}

#[tauri::command]
pub fn recent_remove(app: AppHandle, path: String) -> Result<(), String> {
    let mut list = load_recent(&app);
    list.retain(|p| p != &path);
    let file = recent_file(&app).ok_or("no config directory")?;
    fs::write(file, serde_json::to_string_pretty(&list).unwrap()).map_err(|e| e.to_string())
}

/// Show a file in the system's file browser (selected in Explorer on Windows).
#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    #[cfg(target_os = "windows")]
    {
        let r = if p.is_file() {
            std::process::Command::new("explorer").arg(format!("/select,{}", path)).spawn()
        } else {
            std::process::Command::new("explorer").arg(&path).spawn()
        };
        return r.map(|_| ()).map_err(|e| e.to_string());
    }
    #[cfg(target_os = "macos")]
    {
        return std::process::Command::new("open").arg("-R").arg(&path).spawn().map(|_| ()).map_err(|e| e.to_string());
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        let dir = if p.is_file() { p.parent().map(|d| d.to_path_buf()).unwrap_or(p) } else { p };
        return std::process::Command::new("xdg-open").arg(dir).spawn().map(|_| ()).map_err(|e| e.to_string());
    }
}

/// The folder holding autosaved recovery copies (created if needed).
#[tauri::command]
pub fn autosave_dir(app: AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("autosave");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

/// Recovery copies: (path, saved time in seconds, size in bytes).
#[tauri::command]
pub fn autosave_list(app: AppHandle) -> Vec<(String, u64, u64)> {
    let Ok(dir) = autosave_dir(app) else { return vec![] };
    let Ok(rd) = fs::read_dir(&dir) else { return vec![] };
    rd.filter_map(|e| {
        let e = e.ok()?;
        let m = e.metadata().ok()?;
        if !m.is_file() {
            return None;
        }
        let t = m.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs();
        Some((e.path().to_string_lossy().to_string(), t, m.len()))
    })
    .collect()
}

/// Delete a recovery copy (only inside the autosave folder).
#[tauri::command]
pub fn autosave_delete(app: AppHandle, path: String) -> Result<(), String> {
    let dir = PathBuf::from(autosave_dir(app)?);
    let p = PathBuf::from(&path);
    if p.parent().map(|d| d == dir.as_path()) != Some(true) {
        return Err("not an autosave file".into());
    }
    fs::remove_file(p).map_err(|e| e.to_string())
}

/// Before saving over a file: keep the previous version beside it as "name.backup.ext".
#[tauri::command]
pub fn backup_copy(path: String) -> Result<Option<String>, String> {
    let p = PathBuf::from(&path);
    if !p.is_file() {
        return Ok(None);
    }
    let stem = p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let name = match p.extension() {
        Some(e) => format!("{}.backup.{}", stem, e.to_string_lossy()),
        None => format!("{}.backup", stem),
    };
    let dst = p.with_file_name(name);
    fs::copy(&p, &dst).map_err(|e| e.to_string())?;
    Ok(Some(dst.to_string_lossy().to_string()))
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
