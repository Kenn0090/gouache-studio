//! The native "engine room". Phase 0 only reports what it has to work with; later phases add
//! the mesh baker (hardware ray tracing via Vulkan), fast texture encoders and large-file I/O here.

use serde::Serialize;

#[derive(Serialize)]
pub struct EngineInfo {
    pub version: &'static str,
    pub cpu_threads: usize,
    pub os: &'static str,
    pub arch: &'static str,
}

#[tauri::command]
pub fn engine_info() -> EngineInfo {
    EngineInfo {
        version: env!("CARGO_PKG_VERSION"),
        cpu_threads: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
    }
}
