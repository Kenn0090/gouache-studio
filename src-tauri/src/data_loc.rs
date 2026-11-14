//! Where Gouache keeps its data (0.97.22): the web view's profile (saved materials, downloaded Library, skies, AI models,
//! settings), the disk cache (undo, exports) and the autosave copies. By default they are under the user's AppData on the
//! C drive; the person can pick another folder and the data is moved there at the next start (before the window opens, so
//! no file is in use). The choice lives in a tiny `location.json` that stays in the default config folder.
use crate::data_core;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const ROOT_NAME: &str = "Gouache Studio data";

#[derive(Serialize, Deserialize, Default, Clone)]
struct Loc {
    /// The folder the person picked (the data lives in a "Gouache Studio data" folder inside it).
    data: Option<String>,
    /// Folders still to move at the next start: (from, to).
    pending: Vec<(String, String)>,
    /// What went wrong at the last start (shown in Preferences until the next change).
    error: Option<String>,
}

fn file(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    fs::create_dir_all(&dir).ok()?;
    Some(dir.join("location.json"))
}

fn load(app: &AppHandle) -> Loc {
    file(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<Loc>(&s).ok())
        .unwrap_or_default()
}

fn save(app: &AppHandle, loc: &Loc) -> Result<(), String> {
    let p = file(app).ok_or_else(|| "the settings folder is not available".to_string())?;
    fs::write(p, serde_json::to_string_pretty(loc).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

/// The three places, for a given chosen folder (None: the defaults).
fn places(app: &AppHandle, data: Option<&str>) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    match data {
        Some(d) => {
            let r = PathBuf::from(d).join(ROOT_NAME);
            Ok((r.join("EBWebView"), r.join("cache"), r.join("autosave")))
        }
        None => {
            let local = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
            let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
            let auto = app.path().app_data_dir().map_err(|e| e.to_string())?.join("autosave");
            Ok((local.join("EBWebView"), cache, auto))
        }
    }
}

/// Called first thing at start-up: carry out a move that was asked for, then point the cache at the chosen folder.
pub fn startup(app: &AppHandle) {
    let mut loc = load(app);
    if !loc.pending.is_empty() {
        let pairs: Vec<(PathBuf, PathBuf)> = loc.pending.iter().map(|(a, b)| (PathBuf::from(a), PathBuf::from(b))).collect();
        let errs = data_core::move_all(&pairs);
        loc.pending.clear();
        loc.error = if errs.is_empty() { None } else { Some(errs.join(" · ")) };
        let _ = save(app, &loc);
    }
    if let Some(d) = loc.data.as_deref() {
        if let Ok((_, cache, _)) = places(app, Some(d)) {
            let _ = fs::create_dir_all(&cache);
            if let Ok(mut g) = app.state::<crate::undo_spill::CacheDir>().0.lock() {
                *g = Some(cache);
            }
        }
    }
}

/// The web view's profile folder to use (None: leave it to the system's default).
pub fn web_dir(app: &AppHandle) -> Option<PathBuf> {
    let loc = load(app);
    let d = loc.data?;
    let (web, _, _) = places(app, Some(&d)).ok()?;
    let _ = fs::create_dir_all(&web);
    Some(web)
}

/// Where autosave copies go.
pub fn autosave_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let loc = load(app);
    let (_, _, auto) = places(app, loc.data.as_deref())?;
    fs::create_dir_all(&auto).map_err(|e| e.to_string())?;
    Ok(auto)
}

#[derive(Serialize)]
pub struct DataInfo {
    /// The folder the data lives in now.
    pub dir: String,
    /// The folder Gouache would use without a choice.
    pub default_dir: String,
    pub custom: bool,
    pub size_bytes: u64,
    pub free_bytes: u64,
    /// A move is waiting for the next start.
    pub pending: bool,
    pub pending_to: String,
    pub error: String,
}

#[tauri::command]
pub fn data_info(app: AppHandle) -> Result<DataInfo, String> {
    let loc = load(&app);
    let (web, cache, auto) = places(&app, loc.data.as_deref())?;
    let (dweb, _, _) = places(&app, None)?;
    let shown = match loc.data.as_deref() {
        Some(d) => PathBuf::from(d).join(ROOT_NAME),
        None => dweb.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| dweb.clone()),
    };
    let size = data_core::dir_size(&web) + data_core::dir_size(&cache) + data_core::dir_size(&auto);
    let free = crate::undo_spill::disk_free_of(&shown);
    Ok(DataInfo {
        dir: shown.to_string_lossy().into_owned(),
        default_dir: dweb.parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default(),
        custom: loc.data.is_some(),
        size_bytes: size,
        free_bytes: free,
        pending: !loc.pending.is_empty(),
        pending_to: loc.pending.first().map(|p| p.1.clone()).unwrap_or_default(),
        error: loc.error.clone().unwrap_or_default(),
    })
}

/// Choose another folder (None: back to the default). The move itself happens at the next start.
#[tauri::command]
pub fn data_set(app: AppHandle, dir: Option<String>) -> Result<String, String> {
    let mut loc = load(&app);
    let new = dir.as_deref().map(str::trim).filter(|d| !d.is_empty()).map(|d| d.to_string());
    // where everything is now, and where it will be
    let (cw, cc, ca) = places(&app, loc.data.as_deref())?;
    let (nw, nc, na) = places(&app, new.as_deref())?;
    if let Some(d) = new.as_deref() {
        data_core::check_writable(&PathBuf::from(d).join(ROOT_NAME))?;
    }
    if cw == nw {
        return Ok("same".into());
    }
    for (a, b) in [(&cw, &nw), (&cc, &nc), (&ca, &na)] {
        if data_core::overlaps(a, b) {
            return Err("pick a folder that is not inside the current data folder".into());
        }
    }
    loc.pending = vec![
        (cw.to_string_lossy().into_owned(), nw.to_string_lossy().into_owned()),
        (cc.to_string_lossy().into_owned(), nc.to_string_lossy().into_owned()),
        (ca.to_string_lossy().into_owned(), na.to_string_lossy().into_owned()),
    ];
    loc.data = new;
    loc.error = None;
    save(&app, &loc)?;
    Ok("restart".into())
}

/// Restart the app (the page asks after a new data folder was chosen).
#[tauri::command]
pub fn data_restart(app: AppHandle) {
    app.restart();
}
