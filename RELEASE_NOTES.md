# Gouache Studio 0.72.1

- Added a draggable **Rotation** slider for the whole material in UV projection, plus **X/Y/Z rotation sliders** for Triplanar, Planar and Spherical projections. Exact angle entry, viewport handles, Reset and Undo stay synchronized.

# Gouache Studio 0.72.0

- **Smoother bevels.** Connected edges now blend continuously across face diagonals and curved rims, using the model's smooth normals. Separate-object intersections retain scene-aware rounding. Added preview-only **Metalness** and **Roughness** controls.
- **Viewport Settings.** Settings is directly visible in Paint, 3D Paint, Bake and Convert, including detached 3D views. Starting a new 3D project refreshes the controls for that project.
- **Sharper shadows.** Choose **Automatic, 1K, 2K, 4K, 8K or 16K** shadow resolution in Settings, within the graphics card's limit. Shadow coverage fits the model more closely and filtered comparisons soften pixel steps.
- **Safer tabs.** Document and panel tabs close from their right-click menus. Document save confirmations and Ctrl+W remain available.
- **Material image drops.** Drop an image file onto any material channel, including an inactive one. Dragging a texture from the library onto a channel also assigns it there, with Undo.
- **Selection hover.** Select part previews the faces under the pointer before changing the mask. The highlight leaves mask pixels untouched.
- **Separate mesh IDs.** Disconnected pieces receive distinct ID colours even when an exporter combines them into one object. UV and normal seams do not split a connected piece.
- **Exit texture inspection.** The viewport's **Material** button clears bake-map and UV previews. Active UV inspection buttons toggle off; Escape returns from bake inspection and 3D Paint channel inspection.

# Gouache Studio 0.71.0

- Sharper viewport shadows, within the graphics card's texture-size limit.
- Bevel shader: 48 default samples and more tolerant hard-edge detection.
- Per-channel **Contrast** for image, baked and converted material textures; material rotation now correctly rotates normal maps.
- The mask toolbar stays clear of viewport controls and settings. Leaving mask mode restores the previous wireframe mode.
- Press **F2** to rename the selected layer. **Clear mask** reveals the whole layer and can be undone.
- Separate-mesh ID bakes now distinguish meshes even when their names match. Added **UV islands** as an ID source.
- **Shift+W** toggles wireframe overlay and opens the 3D view if needed.
- **Help › Send a suggestion** prepares a GitHub issue from an in-app message. GitHub sign-in is required to submit it.

# Gouache Studio 0.70.1

- New **Retro layer (N64 / PSX)**: on top of the stack for everything below, or clipped to one layer (Layer › New, or right-click a layer).
- Bevel shader: no more patchy preview while the view moves, a **Reset bevel to default** button, and a new **Metal** view button to see any model as polished steel.
- Retro viewport shader: fixed the washed-out look on light models and added a Brightness control.
- Fixed the 3D view's settings panel covering the ⋯ button after a project reopened.

# Gouache Studio 0.70.0

- **Textures in the Material editor**: every Image channel has a **Textures…** button that picks from the Textures library.
- New **Retro pixelate (N64 / PSX)** filter with console presets and lots of settings: texel size, filtering, colour bits, dither, cut-out and more.
- New **Retro (N64 / PSX)** viewport shader: texel grid, console filtering, 15/16-bit colour with dither, light bands, fog and vertex wobble.
- **Bevel shader in 3D Paint**: round sharp low-poly edges live on the model and bake them into the Normal map without a high-poly. Also in the Bake mesh maps window.
- Bevel shader options: edge profile, softness, outer edges, inner corners, where meshes meet, and width per material.
- The 3D view's settings panel stays open once you open it.
- Wireframe and Wireframe overlay turn off when clicked a second time.

# Gouache Studio 0.69.0

- **Select › Color Range…**: sampled colours, fuzziness, live previews, invert, selection combinations and undo. Shift-click the image preview to add a sampled colour; Alt-click removes one.
- New Normal layers in 3D Paint automatically show the final Normal map, including live Raise/Dent and Direction painting. **M** or **Lit** returns to shaded painting.
- **C / Shift+C** cycles channel views, including unlit Base colour. **B / Shift+B** cycles baked maps. These views preserve your brush and edited channel; 2D Paint shortcuts are retained.
- Fixed a cursor error when leaving a rebuilt 3D viewport.

# Gouache Studio 0.68.4

- Fixed imported stencils painting the brush colour instead of the texture's colours. In 3D Paint, choose **Brushes › Use a stencil › Colour** to paint the image itself; colour jitter is no longer required.
- Source transparency, brush opacity, undo/redo, Mask mode and the **N** bypass are retained.

# Gouache Studio 0.68.3

- Pen: hold Alt and the pen's side button to pan; let go of Alt with the button still down and the same drag zooms (like Painter). Works in 3D Paint and on the canvas.

# Gouache Studio 0.68.2

- Pen: Ctrl + Alt + the pen's side button now zooms (drag up or right to zoom in), in 3D Paint and on the canvas. Alt + the button still pans.

# Gouache Studio 0.68.1

- Pen: Alt + the pen's side button now pans the view in 3D Paint (like Alt + middle click in Substance Painter) and on the canvas. Before, Alt made it zoom.

# Gouache Studio 0.68.0

- Normal layers: paint bumps, dents and tilts straight into a normal (Raise, Dent, Direction), on the canvas or on the 3D model. Smudge, selections, the gradient tool (slopes) and Levels work on them.
- Right-click a layer › Convert to › AO, Curvature, Edges or Creases, with settings and a live preview; the result is a new layer and a mesh map.
- Brushes can mix paint like pigment (blue over yellow makes green): Paint mixing, Pick up paint, and a Pigment / Lab choice. The Blend brush mixes like paint too.
- Watercolour: Thin pigment, Pigment amount and Edge colour.
- New Bristle flat, Bristle dry brush and Bristle thin pigment brushes.

# Gouache Studio 0.67.0

- Right-click on the canvas or the 3D model opens a brush picker: size, opacity and hardness sliders, brush collections with search, and textures as brush tips.
- Tear-off menus: click the dotted row at the top of any menu to keep it open in a window you can move; drag them together to fuse them into one column.
- The brush preview stays in view while you edit a brush, and can pop out into its own window.
- Window scale accepts an exact percentage (50 to 300).
- Help › Pen and tablet test shows more of what a tablet sends.

# Gouache Studio 0.66.0

- Dual Brush: a second brush tip shapes the first (Multiply or Knock out), with its own size, spacing, scatter and count. Ready-made Dual sponge wash brush.
- The Watercolour glaze brush now shows its cursor outline.
- Pen pressure can drive Flow on its own, and a pressure curve graph shapes the response.
- Colour panel: Harmony swatches (complementary, triadic and more) and three-colour mixing.
- Close tabs you don't use: every work tab (except 2D Paint) and panel tab has a ×; Window › Sections… and Panels… bring them back.
- Window scale: make the whole window bigger or smaller (View menu, Preferences).
- Skip back faces button in the 3D view's ⋯ menu.

# Gouache Studio 0.65.0

- 3D Paint: Smudge, Smear and Liquify now work on the model, on every map of the layer together, with one undo step per stroke.
- New Hue / Saturation layer: an empty layer with live Hue, Saturation and Lightness sliders in the Properties panel that changes everything below it.
- 3D Paint: Skip back faces (on by default) stops paint going through thin parts.
- The pen's side button now moves the view (2D and 3D); Help › Pen and tablet test shows what your pen sends.

# Gouache Studio 0.64.2

- New Shaded, Wireframe and Wireframe overlay options at the top of 3D Paint viewport Settings. The choice is saved with the project.
- Scroll through viewport Settings without zooming the model or canvas, including on small windows.
- Fixed the tiny fold marker between the eye and folder in the layer stack with a clear SVG chevron.

# Gouache Studio 0.64.1

- Change the 3D colour-picker hold key in Edit › Keyboard shortcuts › Brush and colour. Hold the new key to sample, then release to resume painting. Alt navigation still works.
- Reduced black-mask stroke start/end work: regular brush strokes avoid a full mask copy on press, and smaller plain-mask strokes update the painted material region on release. Undo/redo stays exact; complex mask stacks and dependent filters keep full updates when needed.
- Removed double-click selection/mask filling on the 3D Paint mesh. Use Select part, then click the desired part; Done selecting or Escape returns to painting. Double-click empty space still reframes.

# Gouache Studio 0.64.0

- Bake › Normal: bevel shading now rounds convex/concave edges and intersections between separate meshes using the same scene probes in preview and baking.
- New controls: physical width in millimeters with model-file units, sample quality, authored hard edges, Same surface only, and vertex-color width masking. Existing percentage widths still work.
- Preview refines in tiles and reports completion. It retains existing normal detail, avoids doubling a previous bevel bake, and shows high-poly specular highlights with material lighting. Large-mesh preparation runs in a worker.

# Gouache Studio 0.63.0

- Mask mode: added a Wireframe toggle to the mask toolbar.
- Object selection respects imported object boundaries, including meshes that touch; the fallback separates pieces that only meet at a corner.
- UV island selection grows across connected faces despite small UV precision differences, and selection caches refresh when UVs change.
- Texture sets can be deleted without returning on the next refresh. Deletion survives saving and reopening, including deletion of the last set. Restore deleted sets explicitly when needed; empty projects retain their pipeline settings.
- Shared Square asks whether to combine the texture sets or keep them separate. Combining transfers each set’s visible material into one group in a single set, including normal-map orientation after UV packing. The confirmation explains that the old layer stacks are flattened.
- 3D Paint layer opacity is independent for each channel and is preserved by duplication, undo and project save/reopen.
- Bake › Normal: added a Bevel shader with width, minimum edge angle, preview and Bake bevel normal controls. The preview shows the high-poly when supplied, otherwise the low-poly. Preview and baking share the same connected-edge calculation, including edges crossing texture-set boundaries. The silhouette stays unchanged; intersections between separate meshes are not part of this version.

# Gouache Studio 0.62.0

- AI upscaler (optional download, File › AI add-ons): make pictures 2x, 4x or 8x bigger. Photo export, Paint (Image › Upscale) and Convert; AI detail slider and a before/after preview.
- Relight: up to four lights (point, spotlight, sun) with colour, shadows, shine, rim light, a coloured dark side, and ready-made lightings (Golden hour, Studio, Neon and more).
- Photo presets show a sample picture when no photo is open.

# Gouache Studio 0.61.1

- Photo: Relight no longer shows steps; presets swap instead of piling up, with an Amount slider; 68 presets in total.
- Faster 2D and 3D Paint: smoother strokes, background shader compile, quicker start-up.

# Gouache Studio 0.61.0

- AI add-ons (optional downloads, run on your computer): File › AI add-ons…
- Photo tab: Select subject, Select sky, Remove (paint over it), Lens blur and Relight.
- Paint tab: Select subject (AI), Select sky (AI) and Remove selection (AI).
- Convert tab: height map from AI depth.

# Gouache Studio 0.60.0

- New Photo tab (after 2D Paint): a Lightroom-style editor for JPEG, PNG, WebP, TIFF and RAW photos. Your originals are never changed; edits are saved beside the photo.
- Develop panel: Basic, Tone curve, Colour mixer, Point colour, Colour grading, Detail with noise reduction, Effects, and Geometry (crop, straighten, keystone, lens distortion).
- Masks: linear, radial and brush masks with their own sliders and luminance or colour range. Spot removal (heal or clone). Auto tone, Auto level and Auto upright.
- Presets, History, Snapshots, Copy and Paste edits, star ratings and filter, Export to JPEG, PNG or WebP, and To Paint.

# Gouache Studio 0.59.0

- 8K texture size in 3D Paint and in the Bake mesh maps window (where the computer allows it).
- Perspective guides: 1, 2 or 3 vanishing points with a horizon; drag the points; strokes snap to the guide lines; saved with the document.
- A saved document remembers the panel layout, the zoom and place of the view, and the tool (two switches in Preferences › Files).

# Gouache Studio 0.58.0

- Layers in Animation: each frame is a stack of layers; share a layer across all frames; saved with the file; pen, shape and text tools work.
- Video export for animations: MP4 (H.264, H.265), MOV and WebM, with exact frame timing.
- Faster smart masks and smart materials; mask shaders get ready while the app is idle.
- New fill layers in 3D Paint start as a blank mid-grey base with 20% roughness.
- Ctrl+N opens New document.
- Gasa Pen is the starting brush.
- The zoom tool drags (right = in, left = out).
- Marquee and lasso shapes are in the tool menu.
- Colour-blind friendly onion skin colours.
- No Maps panel for base-colour-only documents.
- Opening a document from Explorer while the app runs opens it as a tab in that window.

# Gouache Studio 0.57.0

- Undo can cover hiding layers, opacity, blend mode, rename and locks (new Preferences choice, off by default).
- Radial symmetry: type the number of rays in the options bar, with a reset button.
- Hover the symmetry centre: it lights up, and a pop-out offers Reset centre, rays and Reset all symmetry.
- The unwrap Style list stays available so you can try another style again.
- No left tool column in the Bake and Convert tabs: more room to work.
- New document window: clearer section headings and labelled groups, larger size buttons.
- New Storyboard template with panels, numbers, captions and a title strip on a locked layer, plus Sketch layer.
- Faster saving: several packing workers at once, one graphics wait per layer for its edges, instant backups on Windows.
- Artist style on weapons: small pieces join their neighbour and bent strips are cut straight (pistol 116 to about 78 pieces).

# Gouache Studio 0.56.0

- New Clothing (pattern) style: cuts along the closed loops of a garment (sleeves, cuffs, hem) and one seam down each tube, like a sewing pattern.
- Cleaner seams in every style: no more saw-teeth or thin fingers along the borders.
- Relax button: evens out stretching inside each piece without moving the seams.
- Check overlaps button: shows overlapping and folded faces in red on the layout and the model; Fix overlaps packs them apart.
- The Clothing style lays a bucket-shaped garment flat instead of letting it lie on itself: the sample jacket torso is now one clean sheet with a third of the stretch.
- Small pieces that hug a neighbour join it instead of getting their own seams.
- Check overlaps also finds a piece that covers itself.
- Pieces are packed by their real shape, so small pieces fill the corners of big ones and the picture is used better (3 to 12 points more covered on the sample models).
- Cloth bunched under an armpit gets a side seam, which lowers the overlap on jackets.
- Clothing style avoids overlaps inside a piece: it adds side seams under the arms (front and back panels, like a sewing pattern) and cuts out any small sheet that still lies on another.
- Thin plates (a sword guard, a badge) are cut front from back in the Clothing style.

# Gouache Studio 0.55.2

- New Artist style in the unwrap Style list: fewer, bigger, upright pieces with seams on hard edges, tuned on hand-made unwraps. About 3 times fewer pieces than Balanced.

# Gouache Studio 0.55.1

- Re-rolling and unwrapping show a progress bar with a Stop button and no longer freeze the app; rolling the dice is about 3 times faster.
- Hover the UV picture in the Bake tab for a big view of it.
- Spec/Gloss projects no longer get Roughness or Metallic from materials: they are converted as they are added.
- Each document keeps its own brushes and symmetry; radial symmetry takes any number of rays; Reset centre; Liquify follows symmetry; an optional preference makes undo cover symmetry, brush and colour changes.
- Drag over the eyes in the Layers panel to hide or show several layers.
- Closing the desktop window asks to save unsaved work. New document and Recent files are tidier.

# Gouache Studio 0.55.0

- Review an unwrap with colour: stretch (green to red) or texel size (blue to red) on the model and in the layout, with the seams as white lines.
- The Seam angle slider re-cuts live while you drag it.
- Roll the dice: 12 layouts at once with their scores, click one to use it, pin favourites.
- Unfold: slide the model open into its flat layout and back, with a Play button.

# Gouache Studio 0.54.0

- New models are checked for UVs. No UVs: Auto unwrap or continue without. Overlapping or stretched UVs: Optimize layout, Auto unwrap instead, or keep them.
- Auto unwrap cuts, flattens and packs the model (one square per material or shared) with padding that follows the texture size.
- Review it in the Bake tab: layout picture with overlaps, checker on the model, seam angle, padding, seed with Re-roll, and Best of 24.
- Export model with UVs as OBJ, glTF binary or FBX.

# Gouache Studio 0.53.1

- Spec/Gloss now works on the 3D model: Glossiness changes how sharp the reflection is and the Specular colour tints it. The Spec/Gloss Library previews were redone.
- Switching a project to Spec/Gloss updates the Material editor (no more Roughness or Metallic there).
- The Maps tab is tidier: one slim line per mesh map.

# Gouache Studio 0.53.0

- Panels can be docked to the left, top or right of the viewport (drag a tab to an edge, or use the panel's ⋯ menu), and any dock can lay its groups out vertically or side by side.
- 3D Paint gets Substance Painter style controls: Ctrl + right drag for brush size and hardness, Ctrl + left drag for flow and rotation, S + drag for the stencil, N to ignore it, F1 to F6 for the view layout and perspective.
- Spec/Gloss projects list Specular and Glossiness (not Metallic and Roughness) everywhere, and Glossiness can be adjusted.
- The New 3D Paint Project window locks the shape drop-down once your own mesh is chosen, and can take a high-poly to set up baking.

# Gouache Studio 0.52.2

- Fixes the app staying on the loading screen on graphics cards that allow only 16 textures per shader. The 3D viewer shader used 17 since 0.51.31; the Specular map now shares the Metallic slot.
- The Maps tab is more compact: empty mesh-map slots are single lines.

# Gouache Studio 0.52.1

- Fixes the app getting stuck on the loading screen after updating to 0.52.0 on some computers (the wrinkle textures now prepare separately).
- Start-up is safer: a failing step no longer stops the rest, and a loading screen that takes more than 15 seconds says where it stopped and offers to reset the saved panel layouts.

# Gouache Studio 0.52.0

- Spec/Gloss is redone: switching converts each layer in place, so a material keeps its Specular colour and Glossiness and editing them changes the model. The ray-traced render follows them too.
- Ten traditional Spec/Gloss materials in the Library, with their own tag and an S/G icon. Library materials are converted when added to the other workflow.
- Baker: 16x anti-aliasing by default, exactly flat surfaces, cleaner normals, and a Compare tool for normal maps made elsewhere.
- A stylish Bake button at the top of the Bake panel (it fills with progress while baking), with Send to Paint, Send to 3D Paint and Export under it. The panel is now two columns with History as a tab, so everything is in view without scrolling.
- Eight wrinkle textures and 42 new angular texture brushes.

# Gouache Studio 0.51.31

- Mesh-map import rows in the Maps tab show their labels above the buttons instead of under them.
- Spec/Gloss 3D Paint sets show their Specular colour on the 3D model, so a coloured Specular now appears in the viewport. The ray-traced render is not updated yet.

# Gouache Studio 0.51.30

- 3D Paint texture sets can switch between Metal/Roughness and Specular/Glossiness. Choosing Specular / Glossiness in the Shader panel converts the set's maps and switches the viewer shader. Undo and redo cover the switch, and switching back restores the set's material.
- Material preview and sliders follow Specular and Glossiness on Spec/Gloss sets.

# Gouache Studio 0.51.29

- On Spec/Gloss 3D Paint projects the material preview now follows the Specular colour and Glossiness, so changes show straight away.
- The glossiness slider is labelled Glossiness instead of Level.
- The Properties panel is renamed Material editor.

# Gouache Studio 0.51.28

- Choosing Specular / Glossiness when creating a 3D Paint project now starts it with the Spec/Gloss viewer shader, and the Properties panel shows Spec Gloss inputs with a coloured Specular. PBR projects start with the Standard shader.

# Gouache Studio 0.51.24

- Bundle the supplied B1–B10 and Stroke_01–10 alpha images, plus CHIP and Poly_01, as built-in brush presets.
- Remove the recently added denim and cloth-fold smart materials at the artist's request.
- Add original polygon, angular-chip, dry-rake and painterly alpha brushes inspired by the supplied references.
- Add a colour-stop count and direct colour editing to the gradient ramp.
- Load and frame a selected imported mesh when a new 3D Paint project first opens.

# Gouache Studio 0.51.21

- Keep projected brush opacity consistent across visible steep bevels and hard edges in 3D Paint, instead of fading coverage based on shading normals.
- Retain depth checks to protect hidden surfaces, UV seam padding, and exact paint undo/redo. Existing unpainted pixels in saved strokes need to be repainted.

# Gouache Studio 0.51.20

- Fix thin bright UV seams on ordinary painted layers in 3D Paint, including layers with Box Blur or Gaussian Blur attached.
- Extend texture edge pixels into a small UV border so texture sampling stays continuous at full resolution and in the first two smaller previews. Original layer pixels remain editable and unchanged.

# Gouache Studio 0.51.19

- Preserve smooth detail through seam-aware Gaussian and box blur instead of shifting samples at every triangle edge.
- Follow the first surface edge crossed by each blur sample and support longer walks through densely triangulated models.
- Keep empty UV gutters and separate texture sets out of connected surface blur.

# Gouache Studio 0.51.18

- Type values beyond the normal slider range for spacing, scatter, lazy mouse distance, angle, weld width/spacing, tiling, bump strength, stencil scale and supported 3D lighting/height and filter strengths.
- Keep typed values visible while the slider thumb stays within its normal range; retain valid limits for opacity and hardness.
- Synchronise precise numeric values between the brush panel and top bar.

# Gouache Studio 0.51.17

- Preview mirrored and radial brush copies directly on visible mesh surfaces.
- Hide symmetry planes and radial guides while keeping copy cursors visible with separate display controls.

# Gouache Studio 0.51.16

- Restore weld brush painting to one shared mask that reveals the material across its channels.
- Reduce pauses at stroke start and release with partial undo capture, prepared mask shaders and regional 3D preview refreshes.
- Preserve undo, redo, saved projects and existing editable weld paths.

# Gouache Studio 0.51.15

- Choose Canvas or Screen alignment for 2D mirror symmetry, including rotated and flipped canvas views.
- Drag the on-canvas symmetry centre or reset it with Centre.
- Show radial symmetry rays and an axis-centred ring in 3D, with a highlighted copy count and axis.

# Gouache Studio 0.51.14

- Reduce repeated-stroke pauses in large layered documents by reusing released GPU layer-cache buffers. Idle memory trimming can still reclaim these buffers.

# Gouache Studio 0.51.13

- Correct the brush-tip alpha used by editable weld paths.
- Reduce weld painting preview stutters by updating changed material regions and using a lighter weld shader.
- Keep the 3D brush size consistent on the model when zooming, with a matching cursor.

# Gouache Studio 0.51.12

- Weld brush strokes paint ordinary pixel layers without adding a fill layer or mask; editable weld paths also use ordinary pixel channels.
- Paint and 3D Paint retain independent panel layouts, with simpler layout menus.
- Texture clicks use the selected mask, and lazy mouse no longer jumps to the cursor on release.
- Gaussian and box blur can follow connected mesh triangles across UV seams within a single-tile texture set.

# Gouache Studio 0.51.11

- Give weld tools their own shelf tab, improve the round bead profile, update selected weld paths live, and extend surface coverage across hard seams.

# Gouache Studio 0.51.10

- Move weld profiles from the Projects shelf to Materials Library → Tools, with bead width, height, ripple spacing, irregularity and heat tint controls. Add Walking the Cup, Convex, Concave, Angular and Double Weld profiles alongside TIG, MIG and Tack.

# Gouache Studio 0.51.9

- Weld bead strokes now include generated surface normal detail for a rippled, formed-metal appearance alongside the existing raised height and metallic channels.

# Gouache Studio 0.51.8

- High-resolution 3D painting automatically caps redraw rate for large, multi-layer documents without dropping brush samples; Best restores full-rate redraws.
- Align Weld bead-height control with its selected presets.

# Gouache Studio 0.51.7

- Weld brush tab in the Projects shelf with raised TIG, MIG and tack bead presets, adjustable height and linked metallic material channels.
- Restore the Z magnifying glass tool, with pointer-centred zoom and Shift-click zoom out.
- Preserve Wacom pressure when coalesced pointer samples omit pen metadata in 2D and 3D painting.

# Gouache Studio 0.51.6

- Regenerated all 200 bundled material thumbnails at 768 × 768 with sharper surface detail.
- Higher-resolution Library hover, material editor and saved-material preview balls.
- Preview shading now includes normal, roughness and metallic texture maps, plus colour and height, using GPU rendering and releasing temporary preview buffers after every redraw.

Validated preview dimensions, normal-map shading, transparent edges and repeated redraw memory usage in the Windows desktop app. Material files and document textures retain their original resolution.

# Gouache Studio 0.51.5

- **Animation:** Shift+D duplicates the current frame; Ctrl+D deselects and Ctrl+Shift+D reselects. Held keys do not create repeated copies.

Validated frame pixels and hold duration, undo/redo, selection shortcuts and typing safety in the Windows desktop app.

# Gouache Studio 0.51.4

- **Text on rotated canvases:** the editing box and caret follow canvas rotation and mirror. Adding or editing text no longer straightens the view.
- **Gradient banding:** higher-precision lookup, smooth Gradient map interpolation, stable large-coordinate dithering and accurate low-opacity/transparent rounding. Canvas display dithering reduces visible steps in high-precision and zoomed-out gradients without changing exported pixels.
- **Gasa Pen and Gasa Manga Pen:** retain the current pen alongside a thinner, sharper and less smoothed manga variant with light ink bleed. Old built-in favorites migrate to the new name.

Validated in the native Windows desktop app, including text placement/editing/undo, 8K/16K-coordinate gradient strips, gradient precision and map interpolation, transparency, pressure linework and ink bleed.
# Gouache Studio 0.51.22

- Add UDIM texture sets: select the intended FBX UV channel, paint across detected tiles, bake tile-specific mesh maps, save projects and export tile-numbered textures. The resizable 3D project setup includes UDIM workflow selection.
- Add an Animate sprite-document setup with pixel-art canvas sizes, frame-rate selection, transparent 8-bit canvases, five game palettes and pixel-first swatches.
- Add crisp square and pixel brushes, original scratch, grunge-wear, abstract and running-stitch brushes, plus five denim smart materials and ten procedural cloth-fold smart materials.
- Consolidate the earlier local painting updates: seam-aware paint and blur, better surface coverage at angles and bevels, smoother weld painting, visible symmetry cursors, extended numeric slider entry, and PBR/Spec Gloss project setup with mesh maps and bake integration.
- Keep the existing Grunge Mixer, smart-mask/material library, and texture drag-and-drop workflow in the same update.

# Gouache Studio 0.51.23

- Add five procedural smart masks for stylized paint breakup, edge chipping, denim abrasion and cloth creases.
- Retain the 0.51.22 UDIM, sprite-workflow, brush and textile additions.

