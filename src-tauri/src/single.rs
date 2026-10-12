//! One running app (0.58, Kenn): opening a .gouache file from Explorer while the app is already open must not start another copy.
//! The first copy listens on a local port; a later copy hands it the file name there and quits. Only the standard library is used.
use std::io::{BufRead, BufReader, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::Path;
use std::time::Duration;

const ADDR: &str = "127.0.0.1:47652";
const HELLO: &str = "GOUACHE-STUDIO";

/// The file named on the command line, if any (what Explorer passes when a document is double-clicked).
pub fn file_arg() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| !a.starts_with('-') && Path::new(a).is_file())
}

/// Tell a running copy about this start (its file, or just "come to the front"). True when one answered, so this copy can quit.
pub fn hand_over() -> bool {
    let addr: SocketAddr = match ADDR.parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    let mut s = match TcpStream::connect_timeout(&addr, Duration::from_millis(400)) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let _ = s.set_read_timeout(Some(Duration::from_millis(1500)));
    let _ = s.set_write_timeout(Some(Duration::from_millis(1500)));
    let msg = match file_arg() {
        Some(f) => format!("{}\nOPEN\t{}\n", HELLO, f),
        None => format!("{}\nFOCUS\n", HELLO),
    };
    if s.write_all(msg.as_bytes()).is_err() {
        return false;
    }
    let mut line = String::new();
    let mut r = BufReader::new(&s);
    matches!(r.read_line(&mut line), Ok(n) if n > 0) && line.trim() == "OK"
}

/// Listen for later starts. `on_message` gets Some(path) to open, or None to just show the window.
pub fn listen<F>(on_message: F)
where
    F: Fn(Option<String>) + Send + 'static,
{
    let listener = match TcpListener::bind(ADDR) {
        Ok(l) => l,
        Err(_) => return, // another program has the port: carry on as a normal copy
    };
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let mut stream = match stream {
                Ok(s) => s,
                Err(_) => continue,
            };
            let _ = stream.set_read_timeout(Some(Duration::from_millis(1500)));
            let mut lines = Vec::new();
            {
                let mut r = BufReader::new(&stream);
                for _ in 0..2 {
                    let mut l = String::new();
                    if r.read_line(&mut l).unwrap_or(0) == 0 {
                        break;
                    }
                    lines.push(l.trim_end_matches(['\r', '\n']).to_string());
                }
            }
            if lines.first().map(|s| s.as_str()) != Some(HELLO) {
                continue;
            }
            let path = lines
                .get(1)
                .and_then(|l| l.strip_prefix("OPEN\t"))
                .map(|p| p.to_string());
            on_message(path);
            let _ = stream.write_all(b"OK\n");
        }
    });
}
