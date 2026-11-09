//! A tiny web server on this computer only (127.0.0.1), for the two-way links (0.96.4):
//! Blender, Unity and Unreal send things to Gouache (POST /inbox with a short JSON message that names files
//! they wrote), and Roblox Studio's plug-in fetches what Gouache published (GET /get/<key>), because a
//! Roblox plug-in can only talk over the web. No Tauri types here, so it can be built and tested on its own.
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

pub const PORT: u16 = 47660;
const MAX_INBOX: usize = 1 << 20;

fn blobs() -> &'static Mutex<HashMap<String, Vec<u8>>> {
    static B: OnceLock<Mutex<HashMap<String, Vec<u8>>>> = OnceLock::new();
    B.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Keep bytes for GET /get/<key> (an empty value removes the key).
pub fn publish(key: &str, bytes: Vec<u8>) {
    let mut b = blobs().lock().unwrap();
    if bytes.is_empty() {
        b.remove(key);
    } else {
        b.insert(key.to_string(), bytes);
    }
}

fn reply(s: &mut TcpStream, code: &str, ctype: &str, body: &[u8]) {
    let head = format!(
        "HTTP/1.1 {code}\r\nContent-Type: {ctype}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = s.write_all(head.as_bytes());
    let _ = s.write_all(body);
    let _ = s.flush();
}

fn handle(mut s: TcpStream, on_inbox: &(dyn Fn(String) + Send + Sync)) {
    let _ = s.set_read_timeout(Some(Duration::from_secs(5)));
    let mut data = Vec::new();
    let mut buf = [0u8; 8192];
    let head_end;
    loop {
        match s.read(&mut buf) {
            Ok(0) => return,
            Ok(n) => data.extend_from_slice(&buf[..n]),
            Err(_) => return,
        }
        if let Some(p) = data.windows(4).position(|w| w == b"\r\n\r\n") {
            head_end = p + 4;
            break;
        }
        if data.len() > 64 * 1024 {
            return;
        }
    }
    let head = String::from_utf8_lossy(&data[..head_end]).to_string();
    let mut lines = head.split("\r\n");
    let first = lines.next().unwrap_or("");
    let mut parts = first.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("/");
    let mut len = 0usize;
    for l in lines {
        if let Some((k, v)) = l.split_once(':') {
            if k.trim().eq_ignore_ascii_case("content-length") {
                len = v.trim().parse().unwrap_or(0);
            }
        }
    }
    match (method, path) {
        ("GET", "/ping") => reply(&mut s, "200 OK", "text/plain", b"gouache"),
        ("GET", p) if p.starts_with("/get/") => {
            let key = &p[5..];
            let got = blobs().lock().unwrap().get(key).cloned();
            match got {
                Some(b) => reply(&mut s, "200 OK", "application/octet-stream", &b),
                None => reply(&mut s, "404 Not Found", "text/plain", b"none"),
            }
        }
        ("POST", "/inbox") => {
            if len > MAX_INBOX {
                reply(&mut s, "413 Payload Too Large", "text/plain", b"too big");
                return;
            }
            let mut body = data[head_end..].to_vec();
            while body.len() < len {
                match s.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => body.extend_from_slice(&buf[..n]),
                }
            }
            body.truncate(len);
            match String::from_utf8(body) {
                Ok(t) => {
                    on_inbox(t);
                    reply(&mut s, "200 OK", "text/plain", b"ok");
                }
                Err(_) => reply(&mut s, "400 Bad Request", "text/plain", b"not text"),
            }
        }
        _ => reply(&mut s, "404 Not Found", "text/plain", b"?"),
    }
}

/// Start listening on a background thread. Returns false when the port is taken (another Gouache is running).
pub fn start(port: u16, on_inbox: impl Fn(String) + Send + Sync + 'static) -> bool {
    let l = match TcpListener::bind(("127.0.0.1", port)) {
        Ok(l) => l,
        Err(_) => return false,
    };
    let cb: Arc<dyn Fn(String) + Send + Sync> = Arc::new(on_inbox);
    std::thread::spawn(move || {
        for c in l.incoming().flatten() {
            let cb = cb.clone();
            std::thread::spawn(move || handle(c, &*cb));
        }
    });
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    fn req(port: u16, text: &[u8]) -> Vec<u8> {
        let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
        s.write_all(text).unwrap();
        let mut out = Vec::new();
        s.read_to_end(&mut out).unwrap();
        out
    }
    #[test]
    fn inbox_and_get() {
        let (tx, rx) = mpsc::channel();
        let tx = Mutex::new(tx);
        assert!(start(47699, move |t| tx.lock().unwrap().send(t).unwrap()));
        let body = br#"{"kind":"model"}"#;
        let r = req(47699, &[format!("POST /inbox HTTP/1.1\r\nContent-Length: {}\r\n\r\n", body.len()).as_bytes(), body].concat());
        assert!(String::from_utf8_lossy(&r).ends_with("ok"));
        assert_eq!(rx.recv_timeout(Duration::from_secs(2)).unwrap(), r#"{"kind":"model"}"#);
        publish("a", vec![1, 2, 3]);
        let r = req(47699, b"GET /get/a HTTP/1.1\r\n\r\n");
        assert!(r.ends_with(&[1, 2, 3]));
        let r = req(47699, b"GET /get/b HTTP/1.1\r\n\r\n");
        assert!(String::from_utf8_lossy(&r).starts_with("HTTP/1.1 404"));
        assert!(!start(47699, |_| {}));
    }
}
