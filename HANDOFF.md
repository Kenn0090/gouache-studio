# Hand-off: Gouache Studio, branch `claude/bold-mendel-y1q16j`

Last updated 2026-11-15. Read `CLAUDE.md` and `AGENTS.md` first. CLAUDE.md has the full history; this file is only the state of the current round.

## Where things stand

- Official `main` is **0.97.25** (released). This branch is **7 commits ahead of main and NOT released**.
- Everything below is built, tested in the cloud container (SwiftShader), committed and pushed to the branch.
- The next version is **0.97.26**. CHANGELOG.md and RELEASE_NOTES.md already have a 0.97.26 section covering all of it. Still to do at release: `node scripts/bump.mjs 0.97.26` (check `main` and the latest release first: the other agent, Codex, also releases), build, PR, merge.
- Kenn has **not** said "merge and publish" for this round yet. Don't release without him asking.

## What this round built (all unreleased)

Started from Georgian's feedback (a friend testing the app): paint SSS, translucency and specular; custom shader/material setups like Painter and Marmoset; focal length; PSD support; UV tiles (UDIM) problems.

1. **New channels:** Scattering, Scatter colour, Translucency, Specular level (Metal/Rough), and up to 8 channels of your own (named, grey or colour). Picking the Skin shader adds the three skin channels. The 3D view packs them into existing picture inputs (the shader has no free ones). They export as their own files.
2. **Material slots** under each shader in the Shader panel: each input is Value, Painted or Picture. Picture puts an image into that channel of the selected material (or a new material carrying only that channel).
3. **Custom shader maker:** shader "Custom (mix your own)" = Standard plus up to 8 ingredient rows from the other looks (lighting styles, shine, extras), each with an amount, settings and a mask channel. Shaders library on the 3D Paint shelf (save, apply, drag onto a texture set, .gshader export/import), saved in the project. Engines get Standard.
4. **PSD:** export each channel as a layered PSD (tick in the export window); import a layered PSD into a channel (File › Import, or drop on 3D Paint).
5. **Focal length** in mm next to the view angle, with 18–135 mm buttons.
6. **UV tiles (UDIM), for Georgian:**
   - Tile pictures (`_1001_`, `_1002_` in the name) go into their own tiles. Picking one finds the others in the same folder (desktop).
   - This works for material channels, mesh map slots (input maps), and Materials › From textures.
   - Plain pictures, Library/smart materials and procedurals (noise, grunge, generators) repeat once per tile with correct proportions.
   - Triplanar covers every tile.

Tests for this round: `chan9726`, `cx9727`, `udimimg9726` (all pass). Older tests re-run and passing: fur945, looks95, engshader9304, smthumb969, saveas964, cover281, udim95, projxf, mstack, mimport, maps53, shelf96 (updated to the current shelf list). Known failures that also fail on main: multi947, part966; project-maps-psd needs the Edge browser.

## Settled after the first hand-off (built, tests pass)
- **How painting a channel works** (Kenn sent a screenshot of Painter's Texture Set Settings):
  - a **Texture Set Settings** panel: channel list with + / −, an 8/16-bit format per channel, size and workflow;
  - a **row of channel buttons** in every material and on the brush, each with its own value, so one stroke can paint several channels.
  - Test: tss9726.
- **Skin like Marmoset's Subsurface Scatter** (Kenn sent Marmoset's panel, "no need to ask questions"): Scatter / Translucency / Fuzz, each with a map slot, depths in mm and colours. New channels Specular colour and Fuzz.
- **Reflectivity drop-down** (Metalness / Specular) on Standard and Skin. Test: skin9726.
- The YouTube video (https://www.youtube.com/watch?v=Brryt3l-fiQ) was never watched (YouTube blocks the cloud container). The Painter screenshot answered the question instead.

## Code map for this round

- `src/js/core/maps.js`: new map keys `specl`, `sss`, `sssc`, `trans`, `MAP_USER` (u1–u8; names and colour flags in `doc.mapDef['name:uN']` / `['col:uN']`).
- `src/js/view3d/shading.js`: `chPackUniforms` / `chPackRun` / `FS_CHPACK`. The pack step saves and restores GL state, because it runs mid-draw.
- `src/js/view3d/view3d.js`: the FS_3D skin block reads the packed inputs; the custom block (uSh 19) sits before the final emissive add; `lensBox`.
- `src/js/view3d/shade-slots.js`: Material slots; `slotPicture`, `slotPaint`, `slotValue`, `slotAutoAdd`.
- `src/js/view3d/custom-shader.js`: `CX` ingredients, library (`gs.cxLib`), shelf panel `shshaders`.
- `src/js/ui/texset-settings.js`: Texture Set Settings panel, formats, channel buttons on materials and the brush.
- `src/js/view3d/skin-marmoset.js`: Marmoset skin layout and uniforms, Specular reflectivity.
- `src/js/view3d/udim-images.js` (loaded after `ui/project-shelf`): wraps `fillUseImage`, `fillPickImage`, `p3MapImport`, `p3MapPick`, `p3MapBatch` and `miBuild`.
- `src/js/layers/fill-layer.js`: `uUdimT` / `fillUdimT`.
- `src/js/view3d/proj-xf.js`: UV matrix scaled per tile.
- `src/js/files/psd-save.js` `encodePSD(k)`; `src/js/files/psd-open.js` `psdIntoChannel`; `src/js/files/tex-export.js` (extra channel outputs, `psdChannelFiles`).
- Wiki: `docs/wiki/3D-Paint.md`, sections "Skin channels, Material slots…", "Custom shader maker", "Pictures in a material with UV tiles". Images: `material-slots.png`, `custom-shader.png` (made by `tests/e2e/shots9726.cjs`).

## Not done or limits (worth telling Kenn when relevant)

- The ray-traced view and the engine shaders (Unity/Godot/Unreal) ignore the new channels and custom shaders. Engines get Standard plus the channels as extra files.
- Glass in a custom shader bends the sky but doesn't show the model's back faces.
- Retro pixels' texel grid covers the whole set (its colour steps follow the mask).
- Mesh maps combined from tile files are 8-bit, which matters only for height.
- An unmarked 2:1 picture is treated as "all tiles" only on non-square tile grids.
- Only Kenn can check the new skin channels and the custom shader on real hardware (RTX 4080).
