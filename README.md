# Gouache Studio

A GPU-accelerated painting and texture app for hand-painted game art. Windows desktop app built with Tauri, and also runs in a browser.

**[User guide (wiki)](docs/wiki/Home.md)**: how everything in the app works.

## Download

Get the latest installer from [Releases](https://github.com/Kenn0090/gouache-studio/releases/latest): `Gouache Studio_x.y.z_x64-setup.exe`. Once installed, the app checks for updates when it starts and can update itself (File › Check for updates…).

Test builds of every change are on the **Actions** tab (download `gouache-studio-windows`).

## Roadmap

1. ~~Desktop foundation~~ (0.1)
2. ~~Selections, transforms, crop, fills, gradients, dodge/burn, flipbooks~~ (0.2–0.5)
3. ~~Material maps and game-engine export presets~~ (0.6)
4. ~~Converters and filters~~ (0.7)
5. ~~Filter layers~~ (0.8)
6. ~~3D viewer~~ (0.9)
7. ~~Baker~~ (0.10)
8. Cage / skew painting
9. Paint on the model

## Releasing a version

1. `node scripts/bump.mjs 0.2.0`
2. Write what's new in `RELEASE_NOTES.md` (shown in the app's update card and on the release page).
3. Commit and push to `main`.

When the pushed version has no release yet, the build publishes `v0.2.0` automatically. Releases are signed with the `TAURI_SIGNING_PRIVATE_KEY` repository secret.

## Build it yourself

```
npm ci
npm run build:web        # single-file browser version -> dist-web/index.html
npm run desktop:build    # desktop installer (needs Rust + Tauri prerequisites)
```

Source lives in `src/js` (the app, ordered by `src/js/order.json`) and `src-tauri` (the native shell: file access, recent files, undo spill to disk).
