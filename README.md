# Gouache Studio

A GPU-accelerated painting and texture app for hand-painted game art. Windows desktop app built with Tauri, and also runs in a browser.

## Download

Open the **Actions** tab, pick the latest successful "Build Windows installer" run, and download `gouache-studio-windows`. Inside the zip, `Gouache Studio_x.y.z_x64-setup.exe` is the installer.

## Build it yourself

```
npm ci
npm run build:web        # single-file browser version -> dist-web/index.html
npm run desktop:build    # desktop installer (needs Rust + Tauri prerequisites)
```

Source lives in `src/js` (the app, ordered by `src/js/order.json`) and `src-tauri` (the native shell: file access, recent files, undo spill to disk).
