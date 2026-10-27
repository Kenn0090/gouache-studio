//! Online library (0.75): the page cannot ask ambientCG itself (their search service and their download link
//! send no cross-site permission), so the desktop side does the asking. Only ambientCG's own servers are allowed.

use std::collections::HashSet;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

use reqwest::redirect::Policy;
use reqwest::{Client, Url};
use tauri::ipc::Response;
use tauri::{AppHandle, Emitter};

/// Downloads the page asked to stop.
static CANCELLED: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(|| Mutex::new(HashSet::new()));

/// The biggest download taken in (the 4K zips are about 75 MB; 8K is not offered).
const MAX_BYTES: usize = 400 * 1024 * 1024;

/// https only, and only ambientCG's own hosts (the search, the download link and the CDNs behind it).
fn allowed(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }
    match url.host_str() {
        Some(h) => h == "ambientcg.com" || h == "struffelproductions.com" || h.ends_with(".struffelproductions.com"),
        None => false,
    }
}

fn parse(url: &str) -> Result<Url, String> {
    let u = Url::parse(url).map_err(|e| format!("bad address: {e}"))?;
    if allowed(&u) {
        Ok(u)
    } else {
        Err("that address is not allowed".into())
    }
}

/// reqwest is built without its own crypto provider (like the updater), so one is installed once before the first client.
fn client() -> Result<Client, String> {
    static TLS: std::sync::Once = std::sync::Once::new();
    TLS.call_once(|| {
        let _ = rustls::crypto::ring::default_provider().install_default();
    });
    Client::builder()
        .user_agent(concat!("GouacheStudio/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(15))
        .read_timeout(Duration::from_secs(40))
        .redirect(Policy::custom(|attempt| {
            if attempt.previous().len() >= 5 {
                attempt.error("too many redirects")
            } else if allowed(attempt.url()) {
                attempt.follow()
            } else {
                attempt.error("redirected to a site that is not allowed")
            }
        }))
        .build()
        .map_err(|e| e.to_string())
}

/// A page of text (the search results, as JSON).
#[tauri::command]
pub async fn net_get_text(url: String) -> Result<String, String> {
    let url = parse(&url)?;
    let resp = client()?
        .get(url)
        .timeout(Duration::from_secs(40))
        .send()
        .await
        .map_err(|e| format!("could not reach the site: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("the site answered {}", resp.status()));
    }
    resp.text().await.map_err(|e| e.to_string())
}

/// The download itself (kept apart from the command so it can be tried without a window).
async fn fetch_bytes(url: &str, id: &str, progress: impl Fn(u64, u64)) -> Result<Vec<u8>, String> {
    let url = parse(url)?;
    CANCELLED.lock().map_err(|e| e.to_string())?.remove(id);
    let mut resp = client()?
        .get(url)
        .send()
        .await
        .map_err(|e| format!("could not reach the site: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("the site answered {}", resp.status()));
    }
    let total = resp.content_length().unwrap_or(0);
    if total as usize > MAX_BYTES {
        return Err("that download is too big".into());
    }
    let mut buf: Vec<u8> = Vec::with_capacity(total.min(MAX_BYTES as u64) as usize);
    let mut last_sent = 0usize;
    loop {
        let chunk = resp.chunk().await.map_err(|e| format!("the download stopped: {e}"))?;
        let Some(chunk) = chunk else { break };
        if CANCELLED.lock().map_err(|e| e.to_string())?.remove(id) {
            return Err("cancelled".into());
        }
        buf.extend_from_slice(&chunk);
        if buf.len() > MAX_BYTES {
            return Err("that download is too big".into());
        }
        if buf.len() - last_sent >= 256 * 1024 {
            last_sent = buf.len();
            progress(buf.len() as u64, total);
        }
    }
    progress(buf.len() as u64, total);
    Ok(buf)
}

/// A file, handed back as raw bytes. Progress goes to the page as `gs-net-progress` (id, bytes so far, total or 0).
#[tauri::command]
pub async fn net_download(app: AppHandle, id: String, url: String) -> Result<Response, String> {
    let name = id.clone();
    let buf = fetch_bytes(&url, &id, move |got, total| {
        let _ = app.emit("gs-net-progress", (name.clone(), got, total));
    })
    .await?;
    Ok(Response::new(buf))
}

/// Stop a download that is running.
#[tauri::command]
pub fn net_cancel(id: String) {
    if let Ok(mut s) = CANCELLED.lock() {
        s.insert(id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::Ordering;

    #[test]
    fn only_ambientcg_hosts_are_allowed() {
        let ok = |u: &str| allowed(&Url::parse(u).unwrap());
        assert!(ok("https://ambientcg.com/api/v2/full_json?type=Material"));
        assert!(ok("https://acg-download.struffelproductions.com/file/x.zip"));
        assert!(ok("https://struffelproductions.com/a"));
        assert!(!ok("http://ambientcg.com/a")); // not https
        assert!(!ok("https://evil.com/ambientcg.com"));
        assert!(!ok("https://ambientcg.com.evil.com/a"));
        assert!(!ok("https://notstruffelproductions.com/a"));
        assert!(!ok("file:///c:/secret"));
    }

    /// Needs the internet: `cargo test -- --ignored`
    #[test]
    #[ignore]
    fn search_and_download_follow_redirects() {
        tauri::async_runtime::block_on(async {
            let t = net_get_text("https://ambientcg.com/api/v2/full_json?type=Material&limit=1".into()).await.unwrap();
            assert!(t.contains("foundAssets"));
            let seen = std::sync::atomic::AtomicU64::new(0);
            let bytes = fetch_bytes("https://ambientcg.com/get?file=Metal047B_1K-JPG.zip", "t1", |got, _| {
                seen.store(got, Ordering::SeqCst);
            })
            .await
            .unwrap();
            assert!(bytes.len() > 1_000_000 && &bytes[0..2] == b"PK");
            assert_eq!(seen.load(Ordering::SeqCst) as usize, bytes.len());
            assert!(net_get_text("https://example.com/".into()).await.is_err());
        });
    }
}
