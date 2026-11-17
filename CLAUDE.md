# Gouache Studio: notes for assistants

Read `AGENTS.md` before publishing (version rules, shared releases with other agents). Per-version history lives in `CHANGELOG.md` and git history, not here.

## The owner
- **Kenn** owns the project and does not program. Explain in plain words, no code or jargon. He reads replies, not diffs.
- He likes to talk a design through first: propose a plan, ask a few numbered or multiple-choice questions, then build. He adds requests mid-task; fold them in when they fit.
- Windows, RTX 4080. The desktop app updates itself from GitHub releases. Merge and publish only when he says so.
- When a request is ambiguous, check what he means before building.

## What the app is
A GPU painting and texture app for game art: Paint, 3D Paint, Bake, Convert, Photo, Animation and Brush tabs. Tauri 2 desktop app (WebView2) that also runs in a browser. Repo: Kenn0090/gouache-studio. No licence chosen yet: do not claim it is open source. User guide in `docs/wiki/` (Home.md lists pages), kept current with each release.

## Code layout
- `src/js/**`: plain JavaScript, no modules. `scripts/build.mjs` concatenates files in the order of `src/js/order.json` into `src/index.template.html`, producing `dist-web/index.html` and `dist/`. Every top-level name is global; the build stops on duplicate names. New files go into `order.json`. `cv` is the main canvas, so the Convert tab state is `cvS`.
- `src/styles/app.css`: all styles. `src-tauri/`: Rust side (files, undo spill, updater, links, window).
- Areas: `gpu/` (targets, `run`, pools, shaders), `core/` (document, maps, render, `boot.js` with `window.__gs` debug hooks), `ui/` (panels, dock, menus, keys, themes), `paint/`, `filters/`, `layers/` (fill layers, mask stack, smart materials), `view3d/` (3D view, 3D Paint, mesh parsers, projections), `bake/`, `convert/`, `photo/`, `files/` (.gouache, PSD, export, links), `api/` (scripting).
- Conventions: image-changing features preview live (global preference plus a per-dialog Preview tick). Only the normal map is colour. Sent bakes and conversions arrive as one group per map. UI text is short plain English. Pop-up windows should be wide and compact, not tall.

## Build, test, release
- `npm run build` builds `dist-web/` and `dist/`.
- Tests: `tests/e2e/` (see its README). `npm install` there, then `node <test>.cjs`, or `./regress.sh` (about 18 minutes). Playwright with a SwiftShader software GPU, pixel checks. Do not rebuild while the suite runs; run at most two tests at once. Add or extend a test for each feature. In this container use `NODE_PATH=$(npm root -g)` and link the global playwright. Some tests fail on main already (livemask ID colour, ui20, gfile, p3d, mats, ui25 shortcut clash, lv39, dock workspaces, tests needing msedge): check against main before blaming a change.
- Debug hooks: add names by prepending to `Object.assign(window.__gs,{...})` in `core/boot.js` (editing the first name with sed once dropped hooks). `page.evaluate` cannot see top-level names, only `__gs`.
- Release: fetch `origin/main`, merge it into the branch, `node scripts/bump.mjs X.Y.Z`, add a top section to `CHANGELOG.md` and `RELEASE_NOTES.md`, `npm run build`, commit and push, open the PR, merge when Kenn says. `.github/workflows/build.yml` builds the Windows installer and publishes the release when the version changes, then commits "Refresh the Windows download link" (it edits the `[windows-download]:` line in README.md by pattern, so that line must exist exactly once). A workflow_dispatch build of a branch publishes a release if the version is new.
- Put `[skip ci]` in docs-only commits. End commit messages with the attribution lines the session gives.
- **Signing key:** the updater's private key lives only in the GitHub secret `TAURI_SIGNING_PRIVATE_KEY`. Never commit or print it.

## Lessons learned (pitfalls)
- `readRGBA8(t)` reads a document-sized region; for small targets use `captureRegionNow(t,0,0,t.w,t.h).data`. `gaussian()` uses document-sized scratch: use a same-size temp for other sizes.
- Temporal-dead-zone errors: do not use something defined later in `order.json` at load time; use function declarations or call at run time. A top-level name that repeats an earlier one silently replaces it.
- Never call `gl.getError()` or a synchronous `readPixels` in a per-stroke path: it waits for all queued GPU work. Use fenced async reads.
- Big GPU passes: `run()` tiles targets over ~12.6M pixels; use it rather than one huge draw. Uniforms set on a shared program persist: set them back. After drawing a model, rebind the global `vao`.
- DOM `append(null)` writes the text "null": use `''` or filter. The `el()` helper skips null.
- Float textures hold integers exactly only below 2^24 (baker indices). Big models: parse from bytes into growable typed arrays. In WebView2 HTML5 drag and drop gives real `File` objects.
- Do not use `sed` to restructure code that contains regexes or backslashes (it dropped a backslash in generated C# once); edit with a script and re-read.
- Engine export files (Unity, Godot, Unreal, Blender, Roblox) have been written without the real apps; test with stand-ins and tell Kenn what is unverified.
- Swiftshader is slow: small documents, no screenshots during heavy bakes; GPU time cannot be measured in the container, only CPU cost.
- 3D Paint: UV alignment (default) stamps straight onto the texture; clone/heal/smudge/liquify need Tangent | Wrap. Surface wrap needs its depth check. UDIM sets keep one canvas per material with tiles inside (`udim-atlas.js`); legacy `p3.udim` projects still open.
- Spec/Gloss, Metal/Rough, custom maps (`MAP_USER`) all flow through `doc.mapDef`; the viewer shader has a 16-sampler limit, so extra channels are packed (`chPackUniforms`).
- The new native viewer (`src-tauri/render`, `view3d/new-viewer.js`) is banked: `NV_BANKED=true`. Code stays; do not ship it enabled without Kenn.

## Open items (ask Kenn first, he has more to add)
UV tab (RizomUV-style), add-on / plug-in system, UV island cage, code signing for the installer, licence choice, installer look, Blender live link after 1.0, Python scripting on the same command set, replacing some grunge maps, UDIM resize bug (needs his project), Fur in the engines.
