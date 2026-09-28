# Gouache Studio: notes for Claude

Read this first. It carries over everything from the long first conversation that built the app (versions 0.1 to 0.13).

## The person
- **Kenn** owns the project and doesn't know any programming language. Explain things in plain words, with no code and no jargon. He reads replies, not diffs.
- He likes to **talk a design through before it is built**: propose a plan, ask a few numbered questions, then build. He answers with numbered lists ("1. Yes 2. Yes 3. …").
- He iterates a lot and adds requests mid-task. Fold them into the current work when they fit.
- He's on **Windows** with an **RTX 4080**. The installed desktop app updates itself from GitHub releases.
- When a request is ambiguous, check what he means before building. In Phase 7, "skew painting" turned out to mean Marmoset-style projection skew in the baker, not a cage paint tool.

## What the app is
A GPU hand-painting and texture app (Photoshop-style painting plus PBR maps, 3D view, baker and converter) for game art. Public, open-source repo: **Kenn0090/gouache-studio**. Windows desktop app (Tauri 2 + WebView2) that updates itself; also runs in a browser.

The top-right tabs are **Paint · Animation · Bake · Convert · Brush** (the Brush tab swaps in a sketch document of its own: `docState()`/`setDocState()` in `paint/brush-tab.js`). The user guide is in `docs/wiki/` (Home.md lists every page) and is kept up to date with each release, with screenshots in `docs/wiki/images/`.

## Code layout
- `src/js/**`: plain JavaScript (no framework, no modules). `scripts/build.mjs` concatenates the files **in the order listed in `src/js/order.json`** into one script inside `src/index.template.html`, producing `dist-web/index.html` (web) and `dist/` (desktop). Every top-level name is global, so **new names must not clash**. `cv` is the main canvas, which is why the Convert tab's state is `cvS`. A new file must be added to `order.json`.
- `src/styles/app.css`: all styles.
- `src-tauri/`: the Rust side: file reading and writing (`files.rs`, including chunked `read_file_range`), undo spill, updater, and the main window built in `lib.rs` (allows `about:blank` pop-outs for the 3D view).
- Main areas:
  - `gpu/` (targets, `run(prog,target,uniforms)`, pools `acquire/acquireD/release`, shaders)
  - `core/` (document, maps, render, `boot.js` with the `window.__gs` debug hooks)
  - `ui/` (panels, menus, `keys.js` rebindable shortcuts: built-in keys stay in their handlers, `kbHandle()` only steps in for keys the user changed; `themes.js` colour themes set the CSS variables on `:root`)
  - `paint/` (brush engine, brushes, map brush, cage and symmetry)
  - `filters/` (filters registry `FX`, converters registry `CONVERTERS`, filter layers)
  - `view3d/` (3D view, mesh parsers OBJ/glTF/FBX, painting on the model)
  - `bake/` (GPU baker with BVH; Bake tab)
  - `convert/` (Convert tab)
  - `files/` (.gouache, PSD, texture export, loading bar)
- Conventions:
  - Every image-changing feature previews live, with the global Preferences toggle and a per-dialog Preview checkbox.
  - Only the normal map is in colour. Converted or baked grey maps go to their own maps (there is a `curv` Curvature map).
  - Sent bakes and conversions arrive as **one group per map**.
  - UI text is short, plain English.

## Build, test, release
- `npm run build` builds `dist-web/` and `dist/`.
- Tests are in `tests/e2e/` (see its README): `npm install` there, then `node <test>.cjs` or `./regress.sh` (about 30 minutes). They use Playwright with a SwiftShader software GPU and check pixels. **Don't rebuild while the suite runs.** Add or extend a test for each feature. The `*shots.cjs` scripts regenerate wiki screenshots.
- **Release:**
  1. `node scripts/bump.mjs X.Y.Z`
  2. Write `RELEASE_NOTES.md` (shown to users in the updater).
  3. `npm run build`
  4. Commit and push to `main`.

  `.github/workflows/build.yml` builds the Windows installer and publishes the release when the version changes. Check the run's status through the GitHub API and `…/releases/latest/download/latest.json`. Put `[skip ci]` in docs-only commits.
- End commit messages with the Co-Authored-By / Claude-Session lines the session provides.
- **Signing key:** the updater's private key lives only in the GitHub secret `TAURI_SIGNING_PRIVATE_KEY` (empty password); Kenn has a backup copy. **Never commit it or print it.** If it were lost, installed copies could no longer verify updates.

## Lessons learned (pitfalls)
- `readRGBA8(t)` reads a **document-sized** region. For small targets use `captureRegionNow(t,0,0,t.w,t.h).data`.
- `gaussian()` uses the document-sized `scratchT`. For targets of other sizes use a same-size temp (see `cvBlur` in `convert-tab.js`).
- Beware temporal-dead-zone errors when a file uses something defined later in `order.json` at load time; call it only at runtime.
- Big models: parse from bytes with growable typed arrays (`grow()` in `mesh.js`). Plain arrays and giant strings ran WebView2 out of memory.
- In WebView2 (`dragDropEnabled: false`), HTML5 drag and drop gives real `File` objects.
- Swiftshader is slow: keep test documents small, and avoid screenshots during heavy bakes.
- Numbers kept in float textures (triangle and node indices in the baker) must stay below 2^24 to be exact; the baker splits bigger ones over two values (`bkTriPack`, the leaf encoding in `bvhBuild`).
- GPU work is asynchronous: to time it, include a readback (`readRGBA8`) in the timed part.

## Where things stand (after 0.18.0)
Done: phases 0–9, including selections, transforms, fills, animation/flipbooks, PBR maps, converters and filters, filter layers, 3D view (pop-out, painting on the model), baker (Bake tab, progressive preview, skew/offset painting, cage display, drag and drop, low-memory loading), cage painting and symmetry on the canvas, and the Convert tab (CrazyBump-style). 0.13.1 fixed Convert rings/height-from-normal; 0.14 added colour jitter (per-dab colour lives in strokeT's RGB), keyboard shortcuts editor, themes, Make brush tip + Brush tip template, pictures into masks, Tile filter.

0.14.1 added the Brush tab; 0.15 the Specular/Gloss workflow (`core/workflow.js`: doc.workflow, maps spec/gloss, diffuse kept in 'base'; shading converts to metal/rough on the fly; switching converts the composite into one group per map and stashes the old maps on each layer in L.wfStash, not saved in files).

0.16 built the new layout (`ui/dock.js`: panels are the existing sections moved into tabbed groups; layouts per workspace in localStorage `gs.dock`; tests use `__gs.showPanel(id)` to bring a tab forward; `ui/optbar.js`; Filter Gallery in `filters/gallery.js`). 0.16.1 added panel windows for a second monitor (dkPopOut: window.open about:blank, sections moved into that document; $() also searches those windows; keys and pointer moves are forwarded to the main window). Design notes for 0.16 (mock-up approved: https://claude.ai/artifact/Ucp9wVG6fWBYRTXt6EoVv1 — tool options bar above the canvas for brush size/opacity/flow/hardness etc.; right dock of tabbed panel groups with resize bars; icon column for less-used panels; tabs draggable between groups/edges or floating, floating panels can go to a second monitor as their own windows in the desktop app; Window menu to show/hide panels; toolbar movable and optionally two columns; Workspaces: Painting, Texturing, Minimal and a 3D Paint workspace like Substance Painter, plus save/reset/lock; Filter Gallery pop-out with thumbnails in folders, stacked filters, Apply or As a filter layer), 0.17 shipped the new filters from Kenn's list (`filters/filters-more.js`; our own versions of the looks, not copies of the Envato packs): Glass (both: seen through frosted/ribbed glass, and a glassy overlay of streaks/reflections), Soft focus, Acid (both: warped colour flow and glitchy motion trails), Halftone (incl. wavy), Engraving (+ pop-art colour), Riso print, B&W print, Watercolour, Drift blur, Pixel/bitmap (chunky dithered pixels and Photoshop-style bitmap), Y2K gradient map presets, Anaglyph, Charcoal, Cinematic mono, Kuwahara — new Filter Gallery folders Photo and Print. Also wanted (Kenn, for both 3D Paint and the 2D canvas): a **Mask Builder** like Substance Designer's (masks generated from mesh maps: curvature edges, AO cavities, world-normal direction such as dust on top, position gradients, plus noise breakup); agreed: a live generated mask on a layer (paint over it to fix spots), 2D uses the document's maps (up = top of the texture), 3D Paint uses the real model (world direction, position, thickness); grunge = built-in noises plus your own images; presets Edge wear, Dirt in cavities, Dust on top, Moss, Rust streaks, Water line, Slime, Crud, Chipped paint, Scratches, Snow on top, Soot, Drips and leaks, Sun-bleached; ships with the 3D Paint tab (0.20). 0.18 did performance: the baker's search tree is a binned-SAH BVH built in a worker (`bvhBuild`/`bvhBuildAsync`, typed arrays, nearer child first in the shader), AO/thickness rays shared out over the anti-aliasing samples (Hammersley + PCG hash; `bkRaysPer`), rays leave from and skip their own triangle (fixed banding); Preferences › Memory and disk (`ui/memory.js`, rules in `core/document.js`: `mem` in localStorage `gs.mem`, memory limit = undo in RAM + loaded models, undo steps, disk cache folder/size; Rust `undo_spill.rs` has the cache folder, `cache_info` with RAM via GlobalMemoryStatusEx, and saved search trees `tree_*`). Kenn's high-polys are 1–18 million triangles, low-polys up to 300k. Then 0.19 canvas tools (Array tool: line/grid/circle, editable until Apply; shapes with bevel; layer styles, all incl. height/normal), 0.20 3D (3D Paint tab like Substance with switchable viewport layouts; Kenn's 3D view requests from 0.18, held for this release: the model sometimes locks up and won't turn in the 3D view, colour picking on the model like 3D-Coat/Painter, painting and navigating without turning Paint off, and Left/Right arrow keys stepping through the shade strip (Mix row in the Color panel) while painting, keeping click; Marmoset-style selections: object/material/UV island/face/loop double-click, as masks in 3D and on the 2D canvas; 3D mirror tool with movable symmetry plane and snapping; HDRIs; C key cycles maps on the model in Bake; high-poly in Bake). Later: more filters (Kenn will send links), add-ons, UV island cage.

Open items Kenn has seen (he also has **more features to add**, so ask him first):
1. Load your own **HDRIs** to light the 3D view (asked for early on).
2. An **add-on / plugin system** (he wants others to extend the open-source app; needs a design first).
3. The **UV island cage** (postponed).
4. **Symmetry when painting on the model.**
5. Show the **high-poly in the Bake tab**.
6. AI light removal for photos (probably not).
7. Things only Kenn can check on his machine: skew fixes on a real bake, the Convert tab's default strengths on real photos, big high-polys.
8. The installer isn't code-signed (Windows shows a warning); a certificate is his call.
