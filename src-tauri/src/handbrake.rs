//! Tauri side of "Send to HandBrake" (0.98): finds HandBrake, runs HandBrakeCLI in the background on a
//! finished timelapse video and tells the page how far it is ("hb-progress", then "hb-done").
use serde::Serialize;
use std::collections::HashMap;
use std::io::Read;
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

/// Compress `input` into `output` in the background. Returns at once; progress and the result come as events.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn hb_run(app: AppHandle, id: String, cli: String, input: String, output: String, kind: String, quality: u8, width: u32, height: u32, fps: u32) -> Result<(), String> {
    let args = crate::handbrake_core::args(&crate::handbrake_core::Job { input: &input, output: &output, kind: &kind, quality, width, height, fps });
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
        let (ok, msg) = match child {
            None => (false, "stopped".to_string()),
            Some(mut c) => match c.wait() {
                Ok(s) if s.success() => (true, String::new()),
                Ok(s) => (false, format!("HandBrake ended with code {}", s.code().unwrap_or(-1))),
                Err(e) => (false, e.to_string()),
            },
        };
        let size = std::fs::metadata(&output).map(|m| m.len()).unwrap_or(0);
        let ok = ok && size > 0;
        if !ok {
            let _ = std::fs::remove_file(&output);
        }
        let _ = app.emit("hb-done", Done { id, ok, size, msg });
    });
    Ok(())
}

/// Stop a running compression.
#[tauri::command]
pub fn hb_cancel(id: String) -> bool {
    if let Some(mut c) = jobs().lock().unwrap().remove(&id) {
        let _ = c.kill();
        let _ = c.wait();
        true
    } else {
        false
    }
}
