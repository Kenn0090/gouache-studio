//! The disk cache ("scratch disk", Preferences › Memory and disk). It holds undo steps that do not
//! fit in the memory limit (read back only if you undo that far) and the high-poly search trees the
//! baker keeps between sessions. The folder can be moved to another drive; the app only ever writes
//! inside its own "Gouache Studio cache" folder there.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

static NEXT: AtomicU64 = AtomicU64::new(1);
const SPILL: &str = "undo-spill";
const TREES: &str = "trees";

/// The folder chosen in Preferences (None: the app's own cache folder).
#[derive(Default)]
pub struct CacheDir(pub Mutex<Option<PathBuf>>);

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    let chosen = app
        .state::<CacheDir>()
        .0
        .lock()
        .map_err(|_| "cache folder unavailable".to_string())?
        .clone();
    match chosen {
        Some(p) => Ok(p),
        None => app.path().app_cache_dir().map_err(|e| e.to_string()),
    }
}

fn sub(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let d = root(app)?.join(name);
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}

/// Clear undo steps left over from a previous session.
pub fn reset(app: &AppHandle) {
    if let Ok(r) = root(app) {
        let d = r.join(SPILL);
        let _ = fs::remove_dir_all(&d);
        let _ = fs::create_dir_all(&d);
    }
}

fn safe_id(id: &str) -> Result<&str, String> {
    if !id.is_empty() && id.len() <= 128 && id.chars().all(|c| c.is_ascii_alphanumeric()) {
        Ok(id)
    } else {
        Err("bad cache id".into())
    }
}

fn dir_size(d: &Path) -> u64 {
    fs::read_dir(d)
        .map(|it| {
            it.filter_map(|e| e.ok())
                .filter_map(|e| e.metadata().ok())
                .filter(|m| m.is_file())
                .map(|m| m.len())
                .sum()
        })
        .unwrap_or(0)
}

/* ---- undo steps ---- */

#[tauri::command]
pub fn spill_write(app: AppHandle, request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw bytes".into());
    };
    let id = format!("u{}", NEXT.fetch_add(1, Ordering::Relaxed));
    fs::write(sub(&app, SPILL)?.join(&id), bytes).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn spill_read(app: AppHandle, id: String) -> Result<Response, String> {
    let p = sub(&app, SPILL)?.join(safe_id(&id)?);
    fs::read(p).map(Response::new).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn spill_delete(app: AppHandle, id: String) -> Result<(), String> {
    let p = sub(&app, SPILL)?.join(safe_id(&id)?);
    let _ = fs::remove_file(p);
    Ok(())
}

/* ---- high-poly search trees ---- */

#[tauri::command]
pub fn tree_write(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw bytes".into());
    };
    let key = request
        .headers()
        .get("x-key")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing key")?
        .to_string();
    let d = sub(&app, TREES)?;
    let tmp = d.join(format!("{}.part", safe_id(&key)?));
    fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, d.join(format!("{}.bin", key))).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn tree_read(app: AppHandle, key: String) -> Result<Response, String> {
    let p = sub(&app, TREES)?.join(format!("{}.bin", safe_id(&key)?));
    let bytes = fs::read(&p).map_err(|e| e.to_string())?;
    // mark it as recently used, so pruning removes older trees first
    if let Ok(f) = fs::File::options().append(true).open(&p) {
        let _ = f.set_modified(std::time::SystemTime::now());
    }
    Ok(Response::new(bytes))
}

/// Remove the least recently used trees until the rest fit in `max_bytes` (0 removes them all).
#[tauri::command]
pub fn tree_prune(app: AppHandle, max_bytes: u64) -> Result<u64, String> {
    let d = sub(&app, TREES)?;
    let mut files: Vec<(std::time::SystemTime, u64, PathBuf)> = fs::read_dir(&d)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let m = e.metadata().ok()?;
            let t = m.modified().ok()?;
            Some((t, m.len(), e.path()))
        })
        .collect();
    files.sort_by_key(|f| f.0);
    let mut total: u64 = files.iter().map(|f| f.1).sum();
    for (_, len, p) in files {
        if total <= max_bytes {
            break;
        }
        if fs::remove_file(&p).is_ok() {
            total -= len;
        }
    }
    Ok(total)
}

/* ---- the folder, and what the machine has ---- */

#[derive(Serialize)]
pub struct CacheInfo {
    pub dir: String,
    pub custom: bool,
    pub spill_bytes: u64,
    pub tree_bytes: u64,
    pub free_bytes: u64,
    pub ram_total: u64,
    pub ram_avail: u64,
}

#[tauri::command]
pub fn cache_info(app: AppHandle) -> Result<CacheInfo, String> {
    let r = root(&app)?;
    let _ = fs::create_dir_all(&r);
    let custom = app
        .state::<CacheDir>()
        .0
        .lock()
        .map(|g| g.is_some())
        .unwrap_or(false);
    let (ram_total, ram_avail) = system_ram();
    Ok(CacheInfo {
        dir: r.to_string_lossy().into_owned(),
        custom,
        spill_bytes: dir_size(&r.join(SPILL)),
        tree_bytes: dir_size(&r.join(TREES)),
        free_bytes: disk_free(&r),
        ram_total,
        ram_avail,
    })
}

/// Use `dir` (None: the default) for the cache. Undo steps already on disk move along, since
/// the history still needs them; the old folder's trees are left behind and cleared.
#[tauri::command]
pub fn cache_set_dir(app: AppHandle, dir: Option<String>) -> Result<String, String> {
    let old = root(&app)?;
    let new = match dir.as_deref().map(str::trim).filter(|d| !d.is_empty()) {
        Some(d) => Some(PathBuf::from(d).join("Gouache Studio cache")),
        None => None,
    };
    let new_root = match &new {
        Some(p) => p.clone(),
        None => app.path().app_cache_dir().map_err(|e| e.to_string())?,
    };
    if new_root == old {
        return Ok(new_root.to_string_lossy().into_owned());
    }
    let new_spill = new_root.join(SPILL);
    let _ = fs::remove_dir_all(&new_spill);
    fs::create_dir_all(&new_spill).map_err(|e| format!("the folder cannot be used: {e}"))?;
    let probe = new_spill.join("probe");
    fs::write(&probe, b"ok").map_err(|e| format!("the folder cannot be written to: {e}"))?;
    let _ = fs::remove_file(&probe);
    if let Ok(it) = fs::read_dir(old.join(SPILL)) {
        for e in it.filter_map(|e| e.ok()) {
            let to = new_spill.join(e.file_name());
            if fs::rename(e.path(), &to).is_err() {
                fs::copy(e.path(), &to).map_err(|e| format!("undo steps could not be moved: {e}"))?;
                let _ = fs::remove_file(e.path());
            }
        }
    }
    let _ = fs::remove_dir_all(old.join(SPILL));
    let _ = fs::remove_dir_all(old.join(TREES));
    *app.state::<CacheDir>()
        .0
        .lock()
        .map_err(|_| "cache folder unavailable".to_string())? = new;
    Ok(new_root.to_string_lossy().into_owned())
}

#[cfg(windows)]
mod win {
    #[repr(C)]
    pub struct MemoryStatusEx {
        pub length: u32,
        pub memory_load: u32,
        pub total_phys: u64,
        pub avail_phys: u64,
        pub total_page_file: u64,
        pub avail_page_file: u64,
        pub total_virtual: u64,
        pub avail_virtual: u64,
        pub avail_extended_virtual: u64,
    }
    #[link(name = "kernel32")]
    extern "system" {
        pub fn GlobalMemoryStatusEx(buffer: *mut MemoryStatusEx) -> i32;
        pub fn GetDiskFreeSpaceExW(
            dir: *const u16,
            free_to_caller: *mut u64,
            total: *mut u64,
            total_free: *mut u64,
        ) -> i32;
    }
}

/// Installed and currently available RAM in bytes (0 when unknown).
fn system_ram() -> (u64, u64) {
    #[cfg(windows)]
    {
        let mut m = win::MemoryStatusEx {
            length: std::mem::size_of::<win::MemoryStatusEx>() as u32,
            memory_load: 0,
            total_phys: 0,
            avail_phys: 0,
            total_page_file: 0,
            avail_page_file: 0,
            total_virtual: 0,
            avail_virtual: 0,
            avail_extended_virtual: 0,
        };
        if unsafe { win::GlobalMemoryStatusEx(&mut m) } != 0 {
            return (m.total_phys, m.avail_phys);
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(s) = fs::read_to_string("/proc/meminfo") {
            let kb = |name: &str| -> u64 {
                s.lines()
                    .find(|l| l.starts_with(name))
                    .and_then(|l| l.split_whitespace().nth(1))
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(0)
                    * 1024
            };
            return (kb("MemTotal:"), kb("MemAvailable:"));
        }
    }
    (0, 0)
}

/// Free space on the drive holding `p` in bytes (0 when unknown).
fn disk_free(p: &Path) -> u64 {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let w: Vec<u16> = p.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
        let (mut avail, mut total, mut free) = (0u64, 0u64, 0u64);
        if unsafe { win::GetDiskFreeSpaceExW(w.as_ptr(), &mut avail, &mut total, &mut free) } != 0 {
            return avail;
        }
    }
    let _ = p;
    0
}
