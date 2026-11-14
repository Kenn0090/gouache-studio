//! Moving Gouache's data folders to another drive (0.97.22). No Tauri types here, so it can be built and tested on its own:
//! `rustc --test src/data_core.rs -o /tmp/dc && /tmp/dc`
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Total size of everything under `d` in bytes (0 when it is missing).
pub fn dir_size(d: &Path) -> u64 {
    let mut n = 0u64;
    if let Ok(it) = fs::read_dir(d) {
        for e in it.filter_map(|e| e.ok()) {
            let p = e.path();
            match e.metadata() {
                Ok(m) if m.is_dir() => n += dir_size(&p),
                Ok(m) => n += m.len(),
                Err(_) => {}
            }
        }
    }
    n
}

/// Can files be written in `d`? (creates it)
pub fn check_writable(d: &Path) -> Result<(), String> {
    fs::create_dir_all(d).map_err(|e| format!("the folder cannot be used: {e}"))?;
    let probe = d.join(".gouache-probe");
    fs::write(&probe, b"ok").map_err(|e| format!("the folder cannot be written to: {e}"))?;
    let _ = fs::remove_file(&probe);
    Ok(())
}

fn copy_all(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for e in fs::read_dir(from)? {
        let e = e?;
        let src = e.path();
        let dst = to.join(e.file_name());
        let ty = e.file_type()?;
        if ty.is_dir() {
            copy_all(&src, &dst)?;
        } else if ty.is_file() {
            fs::copy(&src, &dst)?;
        }
    }
    Ok(())
}

/// Same place? (one inside the other counts: copying a folder into itself would never end)
pub fn overlaps(a: &Path, b: &Path) -> bool {
    a == b || a.starts_with(b) || b.starts_with(a)
}

/// Copy everything in `from` into `to`, check that every file arrived with the same size, and only then delete `from`.
/// On any problem nothing is deleted and the error says what went wrong. A missing `from` is fine (nothing to move).
pub fn move_dir(from: &Path, to: &Path) -> Result<(), String> {
    if !from.exists() {
        return Ok(());
    }
    if overlaps(from, to) {
        return Err(format!("{} and {} are inside each other", from.display(), to.display()));
    }
    copy_all(from, to).map_err(|e| format!("copying to {} failed: {e}", to.display()))?;
    if dir_size(from) != dir_size(to) {
        return Err(format!("the copy in {} is not the same size as the original, so the original was kept", to.display()));
    }
    fs::remove_dir_all(from).map_err(|e| format!("the copy is in place but the old folder could not be removed: {e}"))?;
    Ok(())
}

/// What a move of several folders did.
pub fn move_all(pairs: &[(PathBuf, PathBuf)]) -> Vec<String> {
    let mut errs = Vec::new();
    for (a, b) in pairs {
        if let Err(e) = move_dir(a, b) {
            errs.push(e);
        }
    }
    errs
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("gouache-data-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn moves_nested_files_and_removes_the_old_folder() {
        let a = tmp("a");
        let b = tmp("b").join("new");
        fs::create_dir_all(a.join("x/y")).unwrap();
        fs::write(a.join("one.bin"), vec![1u8; 1000]).unwrap();
        fs::write(a.join("x/y/two.bin"), vec![2u8; 2500]).unwrap();
        assert_eq!(move_dir(&a, &b), Ok(()));
        assert!(!a.exists());
        assert_eq!(fs::read(b.join("x/y/two.bin")).unwrap().len(), 2500);
        assert_eq!(dir_size(&b), 3500);
        let _ = fs::remove_dir_all(b.parent().unwrap());
    }

    #[test]
    fn a_missing_source_is_not_an_error() {
        let a = tmp("c").join("nope");
        let b = tmp("d");
        assert_eq!(move_dir(&a, &b), Ok(()));
        let _ = fs::remove_dir_all(b);
    }

    #[test]
    fn refuses_to_copy_a_folder_into_itself() {
        let a = tmp("e");
        fs::write(a.join("f"), b"1").unwrap();
        assert!(move_dir(&a, &a.join("inside")).is_err());
        assert!(a.join("f").exists());
        let _ = fs::remove_dir_all(a);
    }

    #[test]
    fn a_folder_that_cannot_be_written_is_refused() {
        let a = tmp("g");
        let file = a.join("plain-file");
        fs::write(&file, b"x").unwrap();
        assert!(check_writable(&file.join("sub")).is_err());
        assert!(check_writable(&a.join("ok")).is_ok());
        let _ = fs::remove_dir_all(a);
    }
}
