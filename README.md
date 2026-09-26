# Gouache Studio

A GPU-accelerated painting and texture app for hand-painted game art. Windows desktop app built with Tauri, and also runs in a browser.

## Download

Get the latest installer from [Releases](https://github.com/Kenn0090/gouache-studio/releases/latest): `Gouache Studio_x.y.z_x64-setup.exe`. Once installed, the app checks for updates when it starts and can update itself (File › Check for updates…).

Test builds of every change are on the **Actions** tab (download `gouache-studio-windows`).

## Releasing a version

```
node scripts/bump.mjs 0.2.0
git commit -am "Version 0.2.0"
git tag -a v0.2.0 -m "What's new in this version..."
git push origin main v0.2.0
```

The tag message becomes the release notes shown in the app's update card. Releases are signed with the `TAURI_SIGNING_PRIVATE_KEY` repository secret.

## Build it yourself

```
npm ci
npm run build:web        # single-file browser version -> dist-web/index.html
npm run desktop:build    # desktop installer (needs Rust + Tauri prerequisites)
```

Source lives in `src/js` (the app, ordered by `src/js/order.json`) and `src-tauri` (the native shell: file access, recent files, undo spill to disk).
