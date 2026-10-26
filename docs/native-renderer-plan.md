# Desktop renderer plan (prep for a native / WebGPU swap)

Status: prep only. Nothing here changes how the app draws today (WebGL2 in WebView2 / browsers).

## What we have to port (measured on 0.73.3)

| Area | WebGL calls (`gl.xxx(`) | Notes |
|---|---|---|
| `view3d/` (3D view, painting, shading, ray tracer, HDRIs) | ~540 | most of the surface; the viewer shader uses 16 samplers |
| `bake/` | ~170 | BVH textures, float accumulation |
| `gpu/` (targets, `run()`, pools) | ~130 | already the single choke point for full-screen passes |
| `paint/`, `select/`, `photo/`, `ai/`, `files/`, `ui/`, `layers/`, `filters/`, `core/` | ~290 | mostly through `run()`/`makeTarget()`, some direct |
| Total | ~1240 calls in 46 files, ~95 shaders | |

Everything is GLSL ES 3.00 strings. A WebGPU or native renderer needs WGSL (or SPIR-V via naga/Slang).

## Why not a full native swap first

- It means rewriting the 3D view, brush engine, filters and baker (most of the app) and keeping a second renderer for the web build. Every new shader would exist twice.
- Most clarity problems seen so far are lighting/shadow/AA quality, not API limits.
- DLSS needs NVIDIA's native SDK, so it only comes with a native viewport.

## Staged route (each stage ships on its own)

0. **0.74 (done / in progress):** stability and measurement. Graphics card report records card, driver, memory, WebGPU availability and timings so we know what the 3070/5070 testers really have. The back-end name is `gpuBackend.kind` (`ui/gpu-health.js`).
1. **Funnel the GL calls.** Move direct `gl.*` use out of feature files into `gpu/` helpers (`run`, `makeTarget`, a mesh-draw helper, a compute-style "accumulate" helper). Target: feature code never touches `gl` except in `gpu/` and `view3d/`. Behaviour must stay pixel-identical (existing tests).
2. **Shader source layer.** Keep GLSL as the source of truth and translate to WGSL at build time (naga) so shaders are not hand-ported twice. Start with the full-screen filter shaders (simple, many, testable).
3. **WebGPU back-end (desktop first, same WebView2).** `gpuBackend.kind==='webgpu'` for the heaviest paths only: 3D paint projection, baker, ray tracer. WebGL2 stays as fallback and for the web build. Gains: compute shaders, bigger buffers, timestamp queries, no 2-second driver watchdog hits on one long draw (work can be split across submits).
4. **Native 3D viewport (optional, desktop only).** A Rust `wgpu` child window inside the Tauri window shows the 3D view; the page keeps UI and 2D painting. Unlocks hardware ray tracing (via a Vulkan/DX12 RT path) and DLSS/DLAA. Needs: shared textures between the page and the native window (or the 3D painting moved natively), an input/overlay bridge, and a second code path for the viewer and ray tracer.

Stage 4 is only worth starting if stage 3 numbers (from the report) show the viewer, not painting, is the limit.

## Decisions needed from Kenn before stage 1

- Is the web build still released? (Tests use it internally either way.)
- Is Windows-only enough for stage 4 (DX12/Vulkan), or must macOS/Linux keep working?

## Safety rules for every stage

- Pixel-compare tests before/after (as `tests/e2e/fix74.cjs` does for boxed 3D updates).
- No change to file formats.
- The report (Help › Graphics card report) must state which back-end is active.
