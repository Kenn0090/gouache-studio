//! Tauri side of "Send to HandBrake" (0.98): finds HandBrake, runs HandBrakeCLI in the background on a
//! finished timelapse video and tells the page how far it is ("hb-progress", then "hb-done").
use serde::Serialize;
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
pub struct Found {
    gui: Option<String>,
    cli: Option<String>,
}

#[derive(Serialize, Clone)]
struct Progress {
    id: String,
    pct: f32,
}

#[derive(Serialize, Clone)]
struct Done {
    id: String,
    ok: bool,
    size: u64,
    msg: String,
}

fn jobs() -> &'static Mutex<HashMap<String, Child>> {
    static J: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();
    J.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Where HandBrake is, looking first at the places the user chose earlier.
#[tauri::command]
pub fn hb_find(gui: Option<String>, cli: Option<String>) -> Found {
    let (g, c) = crate::handbrake_core::find(gui.as_deref(), cli.as_deref());
    Found { gui: g, cli: c }
}

fn save_output(staged: &Path, output: &Path) -> Result<u64, String> {
    let size = std::fs::metadata(staged).map(|file| file.len()).unwrap_or(0);
    if size == 0 {
        return Err("HandBrake did not produce a video".into());
    }
    std::fs::rename(staged, output).map_err(|e| format!("Could not save the compressed video: {e}"))?;
    Ok(size)
}

/// Compress `input` into `output` in the background. Returns at once; progress and the result come as events.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn hb_run(app: AppHandle, id: String, cli: String, input: String, output: String, kind: String, quality: u8, width: u32, height: u32, fps: u32) -> Result<(), String> {
    let parent = Path::new(&output).parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(Path::new("."));
    // Keep the old copy in place until the replacement has encoded successfully.
    let work = tempfile::Builder::new().prefix(".gouache-handbrake-").tempdir_in(parent)
        .map_err(|e| format!("Could not prepare the compressed video: {e}"))?;
    let staged = work.path().join("video.mp4");
    let args = crate::handbrake_core::args(&crate::handbrake_core::Job { input: &input, output: &staged.to_string_lossy(), kind: &kind, quality, width, height, fps });
    let mut cmd = Command::new(&cli);
    cmd.args(&args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // no console window
    }
    let mut child = cmd.spawn().map_err(|e| format!("HandBrake could not be started: {e}"))?;
    let mut out = child.stdout.take().ok_or("no output from HandBrake")?;
    jobs().lock().unwrap().insert(id.clone(), child);
    std::thread::spawn(move || {
        let mut buf = [0u8; 2048];
        let mut line = String::new();
        let mut last = -1.0f32;
        loop {
            match out.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    for &b in &buf[..n] {
                        if b == b'\r' || b == b'\n' {
                            if let Some(p) = crate::handbrake_core::progress(&line) {
                                if (p - last).abs() >= 0.5 {
                                    last = p;
                                    let _ = app.emit("hb-progress", Progress { id: id.clone(), pct: p });
                                }
                            }
                            line.clear();
                        } else if line.len() < 4096 {
                            line.push(b as char);
                        }
                    }
                }
            }
        }
        // the job is still in the list unless it was stopped
        let child = jobs().lock().unwrap().remove(&id);
        let result = match child {
            None => Err("stopped".into()),
            Some(mut c) => match c.wait() {
                Ok(s) if s.success() => save_output(&staged, Path::new(&output)),
                Ok(s) => Err(format!("HandBrake ended with code {}", s.code().unwrap_or(-1))),
                Err(e) => Err(e.to_string()),
            },
        };
        drop(work);
        let (ok, size, msg) = match result {
            Ok(size) => (true, size, String::new()),
            Err(msg) => (false, 0, msg),
        };
        let _ = app.emit("hb-done", Done { id, ok, size, msg });
    });
    Ok(())
}

/// Stop a running compression.
#[tauri::command]
pub fn hb_cancel(id: String) -> bool {
    let mut jobs = jobs().lock().unwrap();
    if let Some(mut c) = jobs.remove(&id) {
        let _ = c.kill();
        let _ = c.wait();
        true
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_previous_video_until_replacement_is_ready() {
        let dir = tempfile::tempdir().unwrap();
        let staged = dir.path().join("staged.mp4");
        let output = dir.path().join("video-small.mp4");
        std::fs::write(&output, b"original compressed copy").unwrap();
        std::fs::write(&staged, []).unwrap();
        assert!(save_output(&staged, &output).is_err());
        assert_eq!(std::fs::read(&output).unwrap(), b"original compressed copy");

        std::fs::write(&staged, b"replacement video").unwrap();
        assert_eq!(save_output(&staged, &output).unwrap(), 17);
        assert_eq!(std::fs::read(&output).unwrap(), b"replacement video");
        assert!(!staged.exists());
    }
}
