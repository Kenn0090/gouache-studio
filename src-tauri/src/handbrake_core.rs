//! HandBrake (0.98): finding the program, the arguments for a background compression, and reading its
//! progress. HandBrake is a separate free program the user installs; "HandBrake.exe" is its window and
//! "HandBrakeCLI.exe" (a separate download on handbrake.fr) is the one that can work in the background.
//! No Tauri types here, so it can be built and tested on its own.
use std::path::{Path, PathBuf};

const GUI: &[&str] = &["HandBrake.exe", "HandBrake", "ghb"];
const CLI: &[&str] = &["HandBrakeCLI.exe", "HandBrakeCLI"];

fn first_in(dir: &Path, names: &[&str]) -> Option<PathBuf> {
    names.iter().map(|n| dir.join(n)).find(|p| p.is_file())
}

/// The folders worth looking in: the usual install places, the folder of a path the user chose, and PATH.
pub fn search_dirs(hint: Option<&str>) -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = Vec::new();
    if let Some(h) = hint {
        let p = PathBuf::from(h);
        if p.is_dir() {
            v.push(p);
        } else if let Some(d) = p.parent() {
            v.push(d.to_path_buf());
        }
    }
    for k in ["ProgramFiles", "ProgramW6432", "ProgramFiles(x86)", "LOCALAPPDATA"] {
        if let Ok(d) = std::env::var(k) {
            v.push(Path::new(&d).join("HandBrake"));
            v.push(Path::new(&d).join("Programs").join("HandBrake"));
        }
    }
    v.push(PathBuf::from("/Applications/HandBrake.app/Contents/MacOS"));
    if let Ok(p) = std::env::var("PATH") {
        v.extend(std::env::split_paths(&p));
    }
    v
}

/// (window program, background program), each if found.
pub fn find(hint_gui: Option<&str>, hint_cli: Option<&str>) -> (Option<String>, Option<String>) {
    let exact = |h: Option<&str>| h.map(PathBuf::from).filter(|p| p.is_file());
    let mut gui = exact(hint_gui);
    let mut cli = exact(hint_cli);
    for d in search_dirs(hint_cli).into_iter().chain(search_dirs(hint_gui)) {
        if gui.is_none() {
            gui = first_in(&d, GUI);
        }
        if cli.is_none() {
            cli = first_in(&d, CLI);
        }
        if gui.is_some() && cli.is_some() {
            break;
        }
    }
    let s = |p: Option<PathBuf>| p.map(|p| p.to_string_lossy().into_owned());
    (s(gui), s(cli))
}

/// What a compression should do. `kind`: "h265" (smaller), "av1" (smallest, slow), "h264" (plays everywhere),
/// "nvenc" (NVIDIA card, fast). `quality` 0 = smallest, 1 = balanced, 2 = best.
pub struct Job<'a> {
    pub input: &'a str,
    pub output: &'a str,
    pub kind: &'a str,
    pub quality: u8,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}

/// The arguments for HandBrakeCLI. The picture keeps its size and speed; there is no sound track.
pub fn args(j: &Job) -> Vec<String> {
    let q = j.quality.min(2) as usize;
    let (enc, rf, speed): (&str, [u32; 3], Option<&str>) = match j.kind {
        "av1" => ("svt_av1", [40, 34, 28], Some("6")),
        "h264" => ("x264", [27, 23, 19], Some("medium")),
        "nvenc" => ("nvenc_h265", [32, 27, 22], None),
        _ => ("x265", [30, 26, 21], Some("medium")),
    };
    let mut a: Vec<String> = vec![
        "-i".into(), j.input.into(), "-o".into(), j.output.into(), "-f".into(), "av_mp4".into(), "--optimize".into(),
        "-e".into(), enc.into(), "-q".into(), rf[q].to_string(),
        "--crop".into(), "0:0:0:0".into(), "--non-anamorphic".into(), "-a".into(), "none".into(),
    ];
    if let Some(s) = speed {
        a.push("--encoder-preset".into());
        a.push(s.into());
    }
    if j.width >= 2 && j.height >= 2 {
        a.extend(["-w".into(), j.width.to_string(), "-l".into(), j.height.to_string()]);
    }
    if j.fps >= 1 {
        a.extend(["-r".into(), j.fps.to_string(), "--cfr".into()]);
    }
    a
}

/// HandBrakeCLI writes "Encoding: task 1 of 1, 45.32 % (…)" over and over on one line.
/// Returns the percentage (0..100) from a piece of its output, if there is one.
pub fn progress(text: &str) -> Option<f32> {
    let i = text.rfind('%')?;
    let head = text[..i].trim_end();
    let start = head.rfind(|c: char| !(c.is_ascii_digit() || c == '.')).map(|k| k + 1).unwrap_or(0);
    let v: f32 = head[start..].parse().ok()?;
    if (0.0..=100.0).contains(&v) {
        Some(v)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reads_progress() {
        assert_eq!(progress("Encoding: task 1 of 1, 45.32 % (12.3 fps, avg 11.0 fps, ETA 00h01m02s)"), None.or(Some(45.32)));
        assert_eq!(progress("Encoding: task 1 of 1, 0.00 %"), Some(0.0));
        assert_eq!(progress("Muxing: this may take awhile..."), None);
        assert_eq!(progress("Encoding: task 2 of 2, 100.00 %"), Some(100.0));
    }
    #[test]
    fn builds_arguments() {
        let a = args(&Job { input: "in.webm", output: "out.mp4", kind: "h265", quality: 1, width: 1280, height: 720, fps: 30 });
        let s = a.join(" ");
        assert!(s.starts_with("-i in.webm -o out.mp4 -f av_mp4"));
        assert!(s.contains("-e x265 -q 26") && s.contains("--encoder-preset medium"));
        assert!(s.contains("-w 1280 -l 720") && s.contains("-r 30 --cfr") && s.contains("-a none"));
        let n = args(&Job { input: "a", output: "b", kind: "nvenc", quality: 0, width: 0, height: 0, fps: 0 }).join(" ");
        assert!(n.contains("-e nvenc_h265 -q 32") && !n.contains("--encoder-preset") && !n.contains("-w "));
        assert!(args(&Job { input: "a", output: "b", kind: "av1", quality: 9, width: 2, height: 2, fps: 1 }).join(" ").contains("-e svt_av1 -q 28"));
    }
    #[test]
    fn finds_programs_in_a_chosen_folder() {
        let d = std::env::temp_dir().join(format!("hbtest{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        std::fs::write(d.join("HandBrakeCLI.exe"), b"x").unwrap();
        std::fs::write(d.join("HandBrake.exe"), b"x").unwrap();
        let (g, c) = find(None, Some(d.join("HandBrakeCLI.exe").to_str().unwrap()));
        assert!(c.unwrap().ends_with("HandBrakeCLI.exe"));
        assert!(g.unwrap().ends_with("HandBrake.exe"));
        let (g2, _) = find(Some(d.to_str().unwrap()), None);
        assert!(g2.unwrap().ends_with("HandBrake.exe"));
        std::fs::remove_dir_all(&d).ok();
    }
}
