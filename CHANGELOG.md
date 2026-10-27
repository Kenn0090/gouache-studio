## 0.78.0

- **Hand-painted layer.** Layer > New > **Hand-painted layer** paints a stylized, hand-painted look from the shape of the model, the way game artists fake lighting: a shadow side and a lit side, top and bottom colours, crevices, edges and cavities, glowing thin parts and a glow from below, painted highlights and colour variation. It reads the baked mesh maps (world normal, position, AO, curvature, thickness), else the model, else the picture, so it works in 3D Paint and in Paint. No real light is used, so it stays put when you turn the model.
- **Pick the light direction:** Top (the green of the world-space normal), Front, Left, Right, Back, Bottom or any angle. **Show the directions** shows the normals in colour.
- **Brush strokes from your Brushes panel.** The layer stamps strokes with any brush tip you pick, turned along the forms. **Import a stroke picture…** adds your own.
- **Roughness and metallic** can be made from the colour.
- **Presets:** game materials (Old wood, Steel, Gold, Bronze, Copper, Oxidized copper, Bone, Rock, Marble, Ice, Moss, Jade, Obsidian) and skin and character (Fair, Warm, Dark and Orc skin, Painted skin, Cloth, Leather). **Painted skin** paints softly over a polypaint below.
- **Driven by the mesh maps.** The Hand-painted layer reads the baked world normal, position, AO, curvature and thickness of the texture set first, adds the fine detail of the baked normal map and of normals painted below (**Detail from normal maps**), and only falls back to the model or the picture for maps that are not baked. Its settings say which maps it is reading.
- **Stylize strokes follow the model.** A new **Strokes follow** setting: the model's shape (from the mesh maps), the colour below, or both (the default when there is a model or mesh maps).
- **Stylize paints in the mesh maps.** New **Baked lighting** (from the world normal, with its own light height and turn) and **Edges and cavities** (from AO and curvature) sliders paint the shape of the model into the colour before the strokes smear it.
- **Spec/Gloss.** Both layers work in Spec/Gloss projects: the Hand-painted layer makes glossiness, and metal parts get a coloured specular and a dark diffuse, as when converting.
- **Saved as materials.** Right-click a Hand-painted or Stylize layer › **Save as smart material…** (3D Paint). Added again, it comes back as the same layer on top, so it still reaches the layers below. All 20 Hand-painted presets are also in Materials › Smart materials.
- Fixed: the Stylize layer could turn some pixels black where the strokes made a strong ridge.
- New guide page: Painted looks.

## 0.77.0

- **Stylize layer (painted strokes).** Layer menu > **Stylize layer (painted strokes, all maps)** adds one layer that repaints everything below it as brush strokes, in the colour, the roughness, the height and the normal map together. Strokes follow the shapes in the picture, so a face or a stone is painted around its form.
- **Nine looks to start from:** Gouache, Oil, Thick paint, Soft wash, Watercolour, Comic, Pastel, Chalk and Charcoal. Sliders set stroke size, flow, sharpness, length, bristles, colour variation, raised relief, bend of the light and grain.
- **Every channel agrees.** The strokes raise ridges in the height, bend the normal map along them (staying correct), and even out the roughness so a painted surface does not shimmer. Each can be turned off. Amount 0 leaves the picture as it was.

## 0.76.2

- **What's taking space.** Help > **What's taking space in this project…** (also a button in the Graphics card report) lists the saved size of every picture in the project: each layer's maps, masks, mask rows, material pictures, baked maps and the 3D model, grouped by kind with the biggest first. It measures the same way a save does, without writing anything, and has a Copy button. It takes about as long as a save.
- **The Graphics card report** now also says how many triangles the model has and how much memory the page is using at that moment.

## 0.76.1

- **Big projects save without running out of memory.** A 3D Paint project (or a document) is now written to disk in 16 MB pieces, instead of being joined into one block of hundreds of MB first. The saved file is exactly the same. Autosave does the same.
- **Select part gives its memory back.** Picking model parts builds large edge maps of the model, hundreds of MB on a model with many triangles. They are now let go when you finish selecting (and before any save), and rebuilt only if you select again.
- **Fewer big pictures read at once** while saving a 4096 px project.
- The graphics card report's save trail now also says how many triangles the model had when the app stopped.

## 0.76.0

- **Poly Haven as a second source.** In **Get more…** a **Source** switch chooses between ambientCG and Poly Haven (about 870 CC0 textures: bricks, wood, rock, fabric, leather, metal and more). Search, category chips, Popular or Newest, 1K / 2K / 4K, ticking several, **Add as grunge map**, and the **In Library** marks all work the same. Each material keeps its creator's name and a link to its Poly Haven page. The window shows "Powered by Poly Haven" while it is selected. Desktop app only.

## 0.75.1

- **See-through materials can show what is under them.** A material whose picture has see-through parts (or an Opacity map) now has **Cut out by the material's transparency** in the Material panel. Tick it and a mask made from that transparency is added, so the layers under show through in every map (colour, roughness, metallic, height, normal), not only the colour. Untick it to take it away again. It appears as a **Material transparency** row in the mask, which you can invert, and a mask made only for this goes away when you untick it.

## 0.75.0

- **Get more materials (online library).** Materials › Library › **Get more…** opens a window inside the app where you can browse ambientCG (free, CC0), search, pick a category, tick several materials, choose **1K, 2K or 4K**, and add them to your Library in one go. Each one is built into a normal material (colour, roughness, metallic, normal, height) and keeps its credit. Desktop app only; it needs the internet only while downloading.
- **Grunge maps from ambientCG.** A **Grunge maps** category lists scratches, smears, surface imperfections, fingerprints, chips, rust and asphalt. **Add as grunge map** puts the grey map of any ticked material into Textures.
- **Downloaded materials, mixed or separate.** They are mixed into the Library categories and also listed under a **Downloaded** chip. A tick box keeps them in their own group only. Hover a downloaded tile and click × to delete it.
- **Upgrade the whole Library to 2K or 4K.** File › **Add-ons…** (formerly AI add-ons) has a new Library section. It shows the download and disk size, asks first, runs one material at a time, and can be stopped and continued. **Back to 1K** removes the upgrades. Upgraded materials replace their 1K originals in the Library.
- Big downloaded pictures are loaded only when you use a material, and let go afterwards, so a large Library does not fill memory.

## 0.74.4

- **Lighter project saving.** Saving a 3D Paint project no longer makes a second full copy of each texture set in memory. The saved file is exactly the same. This should help big 4096 px projects that spiked memory while saving.
- **The app now remembers where a save stopped.** If the app dies during a save, the next Help > Graphics card report says which step it reached (for example which picture, and how much memory the page was using), so the cause can be found.

## 0.74.3

- **Saving can no longer hang the app.** If the graphics card does not return a picture within a minute, or a packing worker stops answering for two minutes, the save stops with a clear message and the window works again (before, the window stayed covered and had to be closed from Task Manager).
- **Faster saving of big projects.** Empty and flat maps skip the WebP trial, which saves seconds per map at 4096 px.
- **Drag-selecting model parts no longer freezes.** A fast drag over the model asks the graphics card for at most about 20 ms of lookups per mouse move, and catches up on the next move.
- **Graphics card report** now shows the last save's timings (graphics read, packing, finding edges) and the 3D view's buffer size.

## 0.74.2

- **Copy and paste masks.** Right-click a layer (or use the buttons under the layer list) and choose **Copy mask**, then **Paste mask** on any other layer or folder of the same picture size. The whole mask comes across, including its rows. One Undo removes it.
- **Sliders can move in steps all the time (option, off by default).** In Edit > Preferences > Painting, tick **Sliders always move in steps** and every slider snaps to your increment without holding Ctrl. Hold Ctrl to move smoothly instead. Unticked, nothing changes.
- **Large 3D projects stay smoother.** At 4096 px or more, the other maps update on the model at most every 150 ms while you paint, even on Ultra. Before, Ultra refreshed all maps about 12 times a second.
- **Graphics card report:** choose how much memory your card has (the memory warning used a guess of 6 GB), and **Record 10 seconds of painting** adds what the app was doing while you painted (frame time split into composite, view and thumbnails) to the report.

## 0.74.1

- **Faster textured brushes.** The empty parts of a brush tip (most of a bristle or sponge tip) no longer cost grain and dual-brush work per pixel. Painted results are identical.
- **Graphics memory warning is no longer too early.** The speed test stops at 3 GB, and the app took that as the card's size, so the "memory nearly full" warning could appear at about 2.9 GB on an 8 GB card. The warning now assumes 6 GB unless the test finds the card's real limit, and the report says "at least" when the test is cut short.

## 0.74.0

- **Graphics card resets are handled.** If Windows resets the graphics card, a clear message offers to restart the app, and autosave no longer runs afterwards (so a black picture can't replace your last good recovery copy). The welcome screen offers the autosave back.
- **Fastest graphics card.** The app asks Windows for the high-performance card. You can change this in Help > Graphics card report.
- **Graphics memory warning.** A message appears before graphics memory fills up, which is the usual cause of a black screen at 4096 px.
- **Help > Graphics card report.** Shows the card, driver, memory and WebGPU support, runs a short 4096 px speed test, keeps a small log of card resets, and has a Copy button for sending to us.
- **Faster dual brush.** Build-up and flow strokes now use the batched path too.
- **Faster 3D painting at large sizes.** While you paint on the model, only the part of the texture the stroke can reach is cleared and updated, including with mirror painting. This cuts the work per frame a lot at 4096 px.

## 0.73.3

- **Drag-select multiple model parts in Mask mode.** With Select part active, drag across the model to include each Object, Material, UV island, Face or Loop you pass over in one mask edit. Ctrl-drag hides them; one Undo restores the previous mask.

## 0.73.2

- **Clear mask hides all.** Clear mask now resets the mask to black instead of revealing the whole layer. Undo restores the old mask and its rows; paint white to reveal areas again.

## 0.73.1

- **Dual brush picker.** Choose the second alpha from searchable thumbnails of every brush in the main library. Saved and imported brushes appear immediately; removed brushes disappear without restarting.
- **Reliable dual-brush toggle.** Turning dual brush off, switching to a plain brush, or removing its second tip restores normal painting immediately.
- **Dense dual-brush strokes.** Compatible strokes submit dabs together to reduce graphics calls at low spacing while retaining pressure, scatter, symmetry, random masks and Undo. Build-up, colour jitter and smudge keep their ordered painting paths.
- **Status-bar FPS.** The redraw rate appears beside the document dimensions. It reports Idle when the canvas needs no redraw and supports display rates above 60 Hz. Actual speed depends on the document, display and graphics hardware.

## 0.73.0

- **Slider controls.** Hold Ctrl while dragging to snap to increments of 5, and keep Ctrl held while using the mouse wheel to change the snap increment (5, 10, 15...). A small indicator shows the active increment; releasing Ctrl restores the starting increment. Hold Shift while dragging for one-tenth speed. Change the Ctrl increment in Edit > Preferences > Painting. Percent sliders use percentage points; mapped sliders use their displayed values.

- **Textures as mask layers.** Drop image files or library textures onto a black mask thumbnail or its mask rows to add separate editable picture layers. Multiple files add one row each; existing mask contents are preserved and each drop can be undone.
- **Mask texture contrast.** Every picture row has a live Contrast slider in the Material editor, alongside tiling, rotation and projection controls.
- **Backface painting is easier to find.** Paint back faces is available in viewport Settings, Brush Tool settings and the 3D Paint panel, with all controls synchronized. It starts off to protect back-facing surfaces.
- **Paint brush shortcut: 1.** Existing custom key bindings are preserved. The Photoshop shortcut preset still uses B.
- **Reliable 3D smudge.** Smudge and Smear sample current paint across distant UV islands instead of partially initialized copies. Normal maps stay normalized and one Undo restores all affected maps.

## 0.72.1

- Added a draggable **Rotation** slider for the whole material in UV projection, plus **X/Y/Z rotation sliders** for Triplanar, Planar and Spherical projections. Exact angle entry, viewport handles, Reset and Undo stay synchronized.

## 0.72.0

- **Smoother bevels.** Connected edges now blend continuously across face diagonals and curved rims, using the model's smooth normals. Separate-object intersections retain scene-aware rounding. Added preview-only **Metalness** and **Roughness** controls.
- **Viewport Settings.** Settings is directly visible in Paint, 3D Paint, Bake and Convert, including detached 3D views. Starting a new 3D project refreshes the controls for that project.
- **Sharper shadows.** Choose **Automatic, 1K, 2K, 4K, 8K or 16K** shadow resolution in Settings, within the graphics card's limit. Shadow coverage fits the model more closely and filtered comparisons soften pixel steps.
- **Safer tabs.** Document and panel tabs close from their right-click menus. Document save confirmations and Ctrl+W remain available.
- **Material image drops.** Drop an image file onto any material channel, including an inactive one. Dragging a texture from the library onto a channel also assigns it there, with Undo.
- **Selection hover.** Select part previews the faces under the pointer before changing the mask. The highlight leaves mask pixels untouched.
- **Separate mesh IDs.** Disconnected pieces receive distinct ID colours even when an exporter combines them into one object. UV and normal seams do not split a connected piece.
- **Exit texture inspection.** The viewport's **Material** button clears bake-map and UV previews. Active UV inspection buttons toggle off; Escape returns from bake inspection and 3D Paint channel inspection.

## 0.71.0

- **Viewport shadows.** Increased shadow-map resolution for sharper shadows, up to the graphics card's supported texture size.
- **Bevel shader.** Raised the default sample count from 24 to 48 and made hard-edge detection less sensitive to tiny normal differences. Older saved defaults receive the updated sample count.
- **Material inputs.** Image, baked and converted textures now have a per-channel Contrast control. The material's projection rotation also rotates tangent-space normal maps correctly.
- **Mask editing.** The mask toolbar sits below the viewport controls and settings. Leaving mask or live-mask mode restores the wireframe mode that was active before editing.
- **Layers.** Press F2 to rename the selected layer. Clear mask replaces the mask with white, and Undo restores its previous contents.
- **Bake IDs.** Separate meshes now receive distinct ID colors, including separately loaded meshes with matching names. Added UV-island IDs.
- **Wireframe.** Shift+W toggles the wireframe overlay and opens the 3D view when needed.
- **Suggestions.** Help › Send a suggestion opens a message box and prepares a GitHub issue form. Submitting the form requires a GitHub account.

## 0.70.1

- **Retro layer.** **Layer › New › Retro layer (N64 / PSX)** puts a Retro effect on top of the stack, changing everything below it; **Retro layer (this layer only)** (also in a layer's right-click menu) clips it to the selected layer. Both open with the console presets and work in Paint and 3D Paint.
- **Bevel shader, smoother preview.** Moving the 3D view no longer fills the bevel in patch by patch: the whole picture is rounded at once with a few rays, then refined to full quality off-screen and swapped in when it is complete, so no rectangular patches show.
- **Reset bevel to default** button in the Bevel shader settings (Shader panel, Bake mesh maps window and Bake tab). It resets every setting except whether the bevel is on.
- **Metal view.** A **Metal** button in the 3D view shows the model as polished steel whatever its own material, so shape and bevel read clearly. A **Metal view roughness** slider is in the viewport settings.
- **Retro viewport shader.** Fixed a washed-out, nearly white picture on light models; there is a new **Brightness** control and a lower default.
- **Viewport settings panel.** Fixed the settings panel opening on top of the ⋯ button after a project reopened; it now sits under the toolbar and follows it when the toolbar resizes.

## 0.70.0

- **Textures in the Material editor.** Each channel set to **Image** now has a **Textures…** button next to Choose image…. It opens the Textures library (generated, photo grunge and yours) with a search and categories; click one to use it as that channel, with its Tile and Turn controls. Choosing **Image** no longer forces the file picker open first.
- **Retro pixelate (N64 / PSX)** filter (Filter › Print, Filter Gallery, filter layers). Pick Nintendo 64, PlayStation, Saturn, Dreamcast, Game Boy Colour or Chunky 8-colour, then adjust: the texel grid size, filtering (none, N64 3-point, bilinear), average or sharp shrinking, separate red/green/blue colour bits, 4×4 pattern or noise dither (per screen pixel or per texel), saturation, contrast, brightness, gamma, texel edge lines, 1-bit see-through cut-out and black and white.
- **Retro (N64 / PSX) viewport shader.** A new choice in the Shader panel for each texture set: the textures become a small grid of texels with console filtering, colour cut to 15/16 bits with a dither, a plain light with optional light bands, fog and a vertex wobble. Presets for Nintendo 64, PlayStation, Saturn, Dreamcast and Chunky 3-bit.
- **Bevel shader in 3D Paint.** The Marmoset-style rounded edges (from Bake › Normal) are now also in the Shader panel and the **Bake mesh maps** window. Switch on **Round the edges** to see sharp low-poly edges rounded live on the model, and bake them with the Normal map, with no high-poly needed. Width, minimum edge angle, samples, hard edges and same-surface settings are shared with the Bake tab.
- **More Bevel shader options.** New **Edge profile** (Round, Smooth, Chamfer, Tight), **Softness**, and separate amounts for **Outer edges**, **Inner corners** and **Where meshes meet** (0% leaves intersections sharp). **Width per material**: on a model with several materials, each gets a share of the width, so hard parts can have a wider bevel than soft ones. All of them work in the Bake tab, the Shader panel and the Bake mesh maps window, and bake with the Normal map.
- **Viewport settings stay open.** The 3D view's settings panel now remembers whether it was open, so it stays in view until you close it.
- **Wireframe toggles off.** Clicking Wireframe or Wireframe overlay a second time turns it off again.

## 0.69.0

- **Color Range.** **Select › Color Range…** selects matching colours throughout an image, with sampled colours, fuzziness, live image/selection previews, invert, and New/Add/Subtract/Intersect. Sample the visible image or active layer; Shift-click adds a colour and Alt-click removes one. Transparency and 16-bit colour precision are retained. Apply is one undo step; Cancel restores the previous selection.
- **Normal painting in the viewport.** Adding a Normal layer in 3D Paint opens the final Normal map view and shows live Raise/Dent height detail and Direction painting. Use **M**, **Lit**, or the viewport channel menu to return to shaded painting.
- **Channel and baked-map shortcuts.** In 3D Paint, **C / Shift+C** cycles channel views, including unlit Base colour, and **B / Shift+B** cycles baked maps. Inspection keeps your brush and edited channel unchanged, uses each texture set's own data, and excludes lighting and colour grading. B/C retain their existing 2D Paint actions.
- Fixed a cursor error when returning from a rebuilt 3D viewport.

## 0.68.4

- **Imported stencil colours.** In 3D Paint, **Brushes › Use a stencil › Colour** now paints the imported texture's own colours, including with colour jitter off. The live stroke and released paint match; image transparency and brush opacity both apply. **Mask** mode still paints your selected brush colour through the picture, and holding **N** bypasses the stencil.

## 0.68.3

- **Pen: let go of Alt to zoom, like Painter.** Hold Alt and press the pen's side button and drag to pan; let go of Alt while the button is still down and the same drag zooms (drag up or right to zoom in, down or left to zoom out); press Alt again to pan. It works in 3D Paint and on the flat canvas.

## 0.68.2

- **Pen: Ctrl + Alt + the pen's side button zooms.** Alt + the pen's button pans (0.68.1), and holding Ctrl as well now zooms: drag up or right to zoom in, down or left to zoom out. It works in 3D Paint and on the flat canvas.

## 0.68.1

- **Pen: Alt + the pen's side button pans in 3D Paint.** As in Substance Painter (Alt + the tablet's second button), holding Alt and pressing the pen's side button now moves the view, in the 3D view and on the flat canvas. Before, Alt turned it into a zoom in 3D.

## 0.68.0

- **Normal layers.** **Layer › New › Normal layer** (or the wavy-line button under the layer list) makes a layer you paint bumps, dents and tilts into. In the Brush panel, **Normal paint** has **Raise** and **Dent** (the brush shape is the profile, so a soft brush makes hills and a textured tip makes a textured bump), **Direction** (tilts the surface toward an angle) and a **Strength**. It works in Paint and on the model in 3D Paint. **Smudge** keeps normals the right length, the **marquee and lasso** limit where you paint, the **gradient tool** makes slopes (drag from the low side to the high side) and **Levels** changes the depth. One undo per stroke, and it saves with the file.
- **Convert to…** Right-click a layer that has a height or a normal › **Convert to** › Ambient occlusion (AO), Curvature, Edges or Creases. A window opens with the settings and a live preview; **Make** adds each map as a new layer and to the mesh maps (converted maps for masks, generators and the Materials panel).
- **Paint mixing in the brush.** New brush settings **Paint mixing** and **Pick up paint**: the new colour mixes with the paint it goes over like wet pigment (blue over yellow gives green, not grey), and Pick up paint carries colour along like a loaded brush on wet paint. **Mix colours like** chooses **Pigment** or a perceptual **Lab** mix. Oil filbert, Gouache filbert and Palette knife have some by default. The Blend brush gets **Paint mixing** too. Mixes keep the lightness of the two colours, so red over blue no longer goes black.
- **Watercolour.** **Thin pigment** makes a stroke behave like a thin layer of pigment (bright, the paper shows through, strokes show through each other like glazes), **Pigment amount** sets how much, and **Edge colour** makes the faint edges of a stroke richer. The watercolour brushes have them on.
- **Bristle brushes.** **Bristle flat**, **Bristle dry brush** and **Bristle thin pigment** in Drawing and painting: hair-fine bristles that run along the stroke and leave long streaks. A brush that follows the stroke now waits for the first couple of pixels, so its first dab already points the right way.
- Fixed: Mesh maps from a material could throw an error when the viewed map was not the base colour.

## 0.67.0

- **Right-click brush picker.** Right-click on the canvas or on the 3D model (without dragging) opens a small picker next to the cursor with **Size**, **Opacity** and **Hardness** sliders, your brush collections with a search box, and textures you can use as the brush tip. Hold the button and drag as before and no picker opens. Turn it off in Preferences.
- **Tear-off menus.** Every menu starts with a dotted **tear off** row. Click it and the menu stays open in a small window you can move; its items and fly-outs work as usual. Drag one torn-off menu's grip onto another to **fuse** them into one column, or drag it out to make its own window again. Click a name to fold it, **×** to close it. They come back next time you start the app; **Window › Close all torn-off menus** clears them.
- **The brush preview stays in view.** In the brush settings, the stroke preview now stays at the top while the settings scroll under it. **⧉** pops it out into a window you can move and resize over the canvas, and **↗** in that window sends it to a window of its own (second monitor).
- **Exact window scale.** **View › Window scale › Exact percentage…** and a number box in Preferences › Look take any value from 50% to 300%.
- **Pen and tablet test** now also shows older mouse, wheel and key events, to find out what a tablet really sends.

## 0.66.0

- **Dual Brush.** In the brush settings, tick **Dual brush** to let a second brush tip shape the first, like Photoshop's Dual Brush. Pick the second tip (built in, drawing and painting tips, or your own) and set its **Size, Spacing, Scatter, Count and Amount**. **Multiply** shows the brush only where the second tip is; **Knock out** cuts holes in it. The pattern stays fixed on the canvas, or tick **Random for every dab** for a stippled look. It saves with your brushes, and **Dual sponge wash** is a ready-made one.
- **Watercolour glaze now has its cursor outline.** Faint and soft brush tips (like the Watercolour pool) show an outline too.
- **Pen pressure.** **Flow** is now its own pressure choice next to Size, Opacity and Build-up, and a **pressure curve graph** lets you drag the middle of the curve for a softer or firmer pen (double-click for a straight line).
- **Colour harmony and three-colour mixing** under the Colour panel's shade strip. Harmony shows Complementary, Split complementary, Triadic, Tetradic, Analogous or Monochrome colours for your colour (click to paint with one, Shift+click for the background colour); Mix three colours has a triangle that blends three corner colours in OKLab.
- **Close the tabs you don't use.** Every work tab except 2D Paint (Photo, 3D Paint, Animation, Bake, Convert, Brush) and every panel tab has a small **×**. **Window › Sections…** and **Window › Panels…** bring them back, and a closed work tab opens again by itself when something sends you there (for example Send to Bake).
- **Window scale.** View › Window scale (Larger, Smaller, 75% to 200%) and Preferences › Look make the whole window bigger or smaller; it is remembered. In a browser use the browser's zoom.
- **Skip back faces** is also a button in the 3D view's **⋯** menu.

## 0.65.0

- **Smudge, Smear and Liquify on the 3D model.** In 3D Paint the **Blend (smudge)** tool and **Liquify** now work on the model. **Smudge** drags paint along your stroke and blends it; **Smear** (a switch next to Smudge in the options bar) drags a longer streak. **Liquify** pushes, pinches, bloats and twirls the paint (Pinch, Bloat and Twirl keep working while you hold the button). They move paint across the surface and over UV seams, and **every map of the layer moves together** (colour, roughness, height and the rest), with one undo step per stroke. A selection limits them. They work in a plain texture set (not UDIM tiles) and not yet with the 3D mirror; Liquify's Restore mode stays on the flat canvas.
- **Hue / Saturation layer.** A new layer button (a small dial) and **Layer › New › Hue / Saturation layer** add an empty layer that changes the colour of everything under it. Its **Hue, Saturation and Lightness** sliders (and **Colorize**) are in the Properties panel and change the model live; it takes a mask, opacity and blend mode, and undo covers it. A **Pass through** folder lets it reach the layers below the folder. Any filter layer now shows its settings in the Properties panel with an **Edit filters…** button.
- **Skip back faces (3D Paint).** New switch under *Brush alignment*, on by default: paint no longer goes through a thin part to its far side or lands on a face seen from behind. Turn it off for models whose faces point the wrong way, or to paint the inside of a part.
- **Pen and tablet.** The pen's side button now moves the view like the middle mouse button, in 2D and in 3D, also while the pen hovers (a tablet pen never reports a middle click). Preferences › Painting has a switch, and **Help › Pen and tablet test…** shows what your pen and its buttons send.
- Fixes to older tests only (no change for you): the 3D Paint layer-list and Shift+F checks.

## 0.64.2

- 3D Paint viewport Settings now starts with Shaded, Wireframe and Wireframe overlay display choices. Wireframe-only draws hidden-line edges without a material fill; overlay keeps the shaded material beneath the edges. The display choice is saved in the project and stays consistent with the mask toolbar.
- Viewport Settings scrolls within short viewports without zooming the model or 2D canvas. Opening Settings closes the More menu, keeps the panel on screen, and places it above viewport overlays.
- Replaced the tiny text-based mask/effect fold marker between the layer eye and folder with a clear SVG chevron, a separate click target and an expanded/collapsed accessibility state.

## 0.64.1

- 3D Paint: the temporary colour-picker hold key can be changed in Edit › Keyboard shortcuts › Brush and colour. Supports letters, combinations and modifier-only keys, keeps the current brush, and cancels pending samples on release. Alt navigation and 2D colour picking retain their controls.
- Black-mask painting no longer copies the whole mask on press for regular brush, eraser and dodge/burn strokes. Smaller plain-mask strokes, including projected and group masks, update only their painted material region on release, with exact undo/redo. Complex mask stacks, filters, wrapping and alternate views retain the full update when required for correctness. Projected strokes do not repeat an already-synchronized projection on release.
- 3D Paint: double-clicking the mesh no longer creates a selection or fills a mask. Object, material, UV-island, face and loop selection use the explicit Select part control followed by a click. Done selecting or Escape returns to painting; double-clicking empty space still frames the model.

## 0.64.0

- Bake › Normal: scene-aware bevel shading now probes surrounding geometry, rounding convex/concave corners and intersections between separate meshes. Preview and normal baking share the calculation.
- Added millimeter width with model-file units, Samples, Bevel hard edges, Same surface only, and vertex-color width masking. Existing percentage widths remain compatible.
- Bevel preview refines in tiles, reports when it is ready, retains normal detail, and avoids applying a previous bevel bake twice. High-poly preview uses material lighting. Large-mesh hard edges prepare in a worker without duplicating every triangle corner for preview.

## 0.63.0

- Mask mode: added a Wireframe toggle to the mask toolbar.
- Object selection respects imported object boundaries, including meshes that touch; the fallback separates pieces that only meet at a corner.
- UV island selection grows across connected faces despite small UV precision differences, and selection caches refresh when UVs change.
- Texture sets can be deleted without returning on the next refresh. Deletion survives saving and reopening, including deletion of the last set. Restore deleted sets explicitly when needed; empty projects retain their pipeline settings.
- Shared Square asks whether to combine the texture sets or keep them separate. Combining transfers each set’s visible material into one group in a single set, including normal-map orientation after UV packing. The confirmation explains that the old layer stacks are flattened.
- 3D Paint layer opacity is independent for each channel and is preserved by duplication, undo and project save/reopen.
- Bake › Normal: added a Bevel shader with width, minimum edge angle, preview and Bake bevel normal controls. The preview shows the high-poly when supplied, otherwise the low-poly. Preview and baking share the same connected-edge calculation, including edges crossing texture-set boundaries. The silhouette stays unchanged; intersections between separate meshes are not part of this version.

## 0.62.0

- **AI upscaler (new optional download, 134 MB).** Make a picture **2×, 4× or 8× bigger** with believable extra detail (Real-ESRGAN, free for any use; it runs on your computer and nothing is sent anywhere). Get it in **File › AI add-ons**. Where to use it: in the **Photo tab**, **Export…** has *Make it bigger (AI)*; in the **Paint tab**, **Image › Upscale (AI)…** opens a bigger copy in a new tab and leaves your document alone; in the **Convert tab**, **Upscale (AI)…** swaps the source for a bigger picture so every map is made at the bigger size. 8× is two passes (4× then 2×). **AI detail** mixes in a plain smooth enlargement (100% is full AI, lower is more natural). **Preview** shows a before/after of the middle of the picture at its real size. Big pictures are done in tiles, the window shows the new size first and warns when it is over the app's limit, and Stop ends the job.
- **Relight has many more options.** Up to **four lights**, each a **point light**, a **spotlight** (a cone you aim with its small square, with Cone angle and Soft edge) or the **sun** (parallel light; a low sun gives long shadows), each with its own colour. New **Shadows** (things in the picture shade what is behind them), **Shine** with Tightness, **Rim light** on the edges that face the light, and a colour for the dark side. **Ready-made lighting…** sets everything in one click: Golden hour, Window light, Studio (two lights), Spotlight, Moonlight, Sunset rim light, Neon, Candle and Overhead. The Height slider now has the right range (older files still open correctly).
- **Preset pictures with no photo.** The little pictures in the Photo tab's Presets show a sample scene when no photo is open, instead of empty boxes.
- Fixed and tidied tests only (no change for you): the 3D Paint layer-list and Shift+F checks follow the current layout.

## 0.61.1

- **Photo – Relight is smooth.** The stepping (banding) when you move the light is gone: the depth guess is now stored with finer detail and smoothed, and the light always sits above the surface.
- **Photo – presets swap, they no longer pile up.** Clicking another preset replaces the last one instead of adding to it. A new **Amount** slider dials a preset up or down.
- **Photo – more presets.** 68 in total, in the groups Look, Film, Portrait, Landscape, Street & night, Black & white and Game art. Toning now comes after the Black & white step, so a tinted black-and-white look works as expected.
- **Speed pass for 2D and 3D Paint.** No graphics-card stalls or memory churn on every frame of a stroke; shaders compile in the background instead of freezing the app; brush tips and the 3D Paint material, decal and environment lists load only when first needed, so the app starts faster (about twice as fast in our tests).

## 0.61.0

- **AI add-ons (optional downloads).** Some features use small AI models that run on your own computer (on the graphics card when possible, otherwise the processor). Nothing is sent anywhere. Open **File › AI add-ons…** to download only the parts you want (about 370 MB in all), see their size, licence and credit, and remove them again. The app also offers it once after updating. Downloads are checked, and models not used for a few minutes are unloaded to free memory.
- **Photo tab – AI tools.** **Select subject…** (click an object; click more to add, Alt+click to take an area away) and **Select sky** make masks with the usual sliders, Invert and range. **Remove…**: paint over something and it is filled from what is around it; each removal can be undone, and it is also applied when you export. **Lens blur** blurs by distance from a focus you pick (with a depth map you can look at), and **Relight** puts a light on the photo that you can drag around; both use a depth map that is saved with the photo.
- **Paint tab.** **Select › Select subject (AI)…** and **Select › Select sky (AI)** make a selection from what you see, and **Edit › Remove selection (AI)** takes the selected thing out of the current layer and fills it from its surroundings (Undo works).
- **Convert tab.** Tick **Height from AI depth** to make the height map from the photo's depth instead of its brightness.
- Models used (all free for any use, credited in the wiki and in the add-ons window): ONNX Runtime (MIT), SlimSAM (Apache 2.0), Depth Anything V2 Small (Apache 2.0) and LaMa (Apache 2.0).

## 0.60.0

- **New Photo tab (next to 2D Paint): a Lightroom-style photo editor.** Open JPEG, PNG, WebP, TIFF and **RAW** photos (Canon, Nikon, Sony, Fujifilm, Panasonic, Olympus, Pentax, DNG and more; developed with the camera's white balance at full 16-bit quality). Your original file is never changed: the edits are kept beside it (a `.gphoto` file in the desktop app) and can always be changed or reset. It has its own layout: the Develop panel, a strip of your photos, presets and a history.
- **Develop panel.** Basic (Auto tone, Temperature, Tint, Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Texture, Clarity, Dehaze, Vibrance, Saturation, Black & white), Tone curve (all channels or red, green, blue), Colour mixer (eight colour bands), **Point colour** (click a colour on the photo and change just that colour), Colour grading, Detail (sharpening and an edge-keeping noise reduction for brightness and colour), Effects (vignette, grain) and Geometry (crop with shapes, Straighten, vertical and horizontal keystone, lens distortion, colour fringing, flips).
- **Masks (local adjustments).** Linear gradient, Radial gradient and Brush masks, each with its own light and colour sliders, Invert, Amount, a Luminance range or Colour range, and Show the mask. Masks follow your crop and tilt.
- **Spot removal.** Click a blemish: it is copied from a clean place nearby (picked for you, or drag the dashed circle) and either healed to the light around it or cloned.
- **Auto level and Auto upright** find the horizon and the walls and straighten the picture (Full also fixes sideways slopes). **Auto tone** sets the Basic sliders from the picture. Press **J** to see clipped highlights (red) and shadows (blue).
- **Presets, History and Snapshots,** hold the **Backslash** key to see the photo before your edits, **Copy and Paste** edits between photos (choose which groups), star ratings (1–5), pick and reject (P, X) with a filter in the strip, and **Export** to JPEG, PNG or WebP at the original size, a chosen long side or a percentage (several photos make a zip). **To Paint** puts the edited photo on a layer in 2D Paint.
- File › **Open photos…** and **Export photo…** appear in the Photo tab. The welcome screen has a Photo start card.
- Coming later for this tab: panoramas, HDR merge, AVIF and JPEG XL export, and optional AI features (subject and sky selection, Remove, Relight, Lens Blur) as an add-on. RAW reading uses LibRaw.

## 0.59.0

- **8K in 3D Paint.** The texture size choice in 3D Paint (and the Bake mesh maps window) now offers 8K, on computers that can edit textures that large.
- **Perspective guides.** View › **Perspective guides…** puts one, two or three vanishing points with a horizon over your canvas, with lines fanning out from each point. Drag a point on the canvas (the horizon between the first two stays level) or type its place, and change how many lines are drawn. With **Strokes snap to the guide lines** on, a stroke you start towards a vanishing point runs exactly along the line to it; hold Shift for the usual straight horizontal and vertical lines instead. The guides are saved with the document and Undo covers them. (Free Transform already has Perspective and Distort for correcting a picture.)
- **Saved documents remember the session.** A .gouache file now keeps the panel layout, the zoom and place of the view, and the tool, and brings them back when you open it (a toast says so). Two switches in Preferences › Files turn this off: one for saving the layout, one for restoring it.

## 0.58.0

- **Layers in Animation.** Every frame is now a stack of layers, shown in the normal Layers panel (blend modes, opacity, masks, locks, styles, groups). A new frame has the same layers as the one before it, empty. Pick **Show in every frame** in a layer's right-click menu to share a layer (a fixed background, a character base): painting on it changes it in every frame; **Delete from every frame** removes it. Frames are saved and reopened with their layers (a shared layer is stored once), and old animations open as one layer per frame. Pen, Shape and Text tools work in Animation now.
- **Video export for animations.** File › **Export animation video…** (and a **Video…** button in the sprite-sheet export): MP4 (H.264 or H.265), MOV (H.264) and WebM (VP9 or AV1). Pick the size, quality, all frames or one tag, how many times to repeat, and a background colour. Every frame keeps its own length (holds), so the timing is exact. Which formats work depends on your computer.
- **Faster smart masks and smart materials.** The grunge picture behind most smart masks was read back from the graphics card and sent again each time one was added. It now stays on the card (a mask that took about 4 s took about 0.2 s in our test), and the mask shaders are prepared while the app is idle.
- **New fill layers in 3D Paint start as a blank base**: mid-grey, 20% roughness, not metal (80% glossiness in Spec/Gloss projects).
- **Ctrl+N opens New document** (Ctrl+Alt+N still works), also in Animation.
- **Gasa Pen is the starting brush** for the app and for every new document.
- **The zoom tool drags**: drag right to zoom in, left to zoom out. A click still zooms in.
- **Marquee and lasso in the tool menu.** Click the corner arrow (or hold the button) to pick the rectangle or ellipse marquee, the freehand or polygonal lasso.
- **Colour-blind friendly onion skin.** Choose Red/green, Blue/orange or Dark/light in the Animation panel.
- **No Maps panel for a document that only has its base colour.** It shows up again for PBR and other multi-map documents.
- **One running copy.** Opening a document from Explorer while Gouache Studio is already open now opens it as another tab in that window instead of starting a second copy.
- **Faster saving (continued).** Smart-material pictures and masks stay on the graphics card too.

## 0.57.0

- **Undo can cover layer actions.** A new Preferences choice makes hiding or showing a layer, changing its opacity or blend mode, renaming it and its locks into Undo steps (Ctrl+Z / Ctrl+Shift+Z). It is off by default.
- **Radial symmetry: set the number of rays.** Type the number in the options bar next to the symmetry choice. A ↺ button next to it puts the symmetry back to its start.
- **The symmetry centre is easy to find and reset.** Hover the blue centre point: the brush circle hides, the point lights up with a ring and the cursor becomes a hand. A small pop-out beside it has **Reset centre**, the rays (− / number / +) and **Reset all symmetry**. The brush panel has a **Reset all symmetry** button too.
- **The unwrap Style list stays available.** After choosing a style, relaxing or fixing overlaps, you can pick another style and try again. A model that came with its own UVs asks first, since a style replaces them (the Original UVs button brings them back).
- **Bake and Convert have no tool column.** The left tools are gone in those two tabs, so the work area is wider.
- **New document window, clearer order.** Same layout, now with strong section headings (Start in, Size, Canvas) and labelled groups inside them: Preset, Dimensions, Template, Bit depth, Background. The size buttons are larger and Portrait and Landscape sit on one line.
- **Storyboard template.** A new **Storyboard** template (and a Storyboard group in the Preset list: Letter, A4, single panels 16:9, 2.39:1, 4:3, 9:16). Pick the panels per page (1 to 8), the panel shape, caption lines and a title strip; a small preview shows the page. You get a locked **Storyboard frames** layer and an empty **Sketch** layer on top.
- **Faster saving.** Pictures are packed by several workers at once while the next layer is read back, and each layer's content edges are found with one wait on the graphics card instead of two. Saving a 10-layer 2K document took about half the time in our test. On Windows the backup of the previous file is now made instantly instead of copying the whole file.
- **Weapons pass for the Artist style.** Very small pieces (screws, little plates, trims) join the neighbour they share the most border with when the result still lies flat and does not overlap: the sample pistol went from 116 to about 78 pieces, the sword from 45 to 36, the backpack from 81 to 60. Long bent strips are cut across so each part lies straight, instead of becoming huge diagonal slivers. Unwrapping takes a few seconds longer (rolls are limited).

## 0.56.0

- **Clothing (pattern) style.** A new choice in the UVs card's Style list that unwraps clothes like sewing patterns. It looks for the closed loops around the model: the sharp edge chains that outline cuffs, pockets, zipper tapes and collars become seams, and where a sleeve (or a leg) joins the body it finds the shortest closed loop around the sleeve's root and cuts there, so the seam is a clean ring rather than a crooked staircase. Each tube then gets one seam along its length, running along hard edges where there are some, and every piece is flattened; a piece that is folded over is relaxed flat. On the sample jacket it makes a torso, two sleeves that unroll into clean panels, the collar, cuffs, pocket and small parts (44 pieces) instead of 180, with the same low stretch. It is slower than the other styles on big models (a few seconds, up to ten for a 27,000-triangle skirt, with the progress bar and Stop).
- **Cleaner seams in every style.** The border between two pieces no longer follows the triangles in a saw-tooth: a triangle with two sides in the neighbouring piece joins it, so teeth and thin fingers are shaved off. Artist style also cleans up after joining pieces.
- **Relax.** A **Relax** button (with a Strength slider and **Keep outlines**) evens out the stretching inside each piece without moving the seams. With *Keep outlines* off, the pieces may change shape (they keep their size and place, and are packed again if they now overlap). It says so when there is nothing to relax.
- **Check overlaps.** A **Check overlaps** button finds faces that share space with another piece or fold over inside their own piece, shows how many, and paints them red on the layout and on the model (**On the model › Overlaps**). **Fix overlaps** relaxes folded pieces and packs the pieces apart.
- **LSCM no longer throws a piece away when the result comes out mirrored.** A flattened piece that came out as a mirror image of the first guess was counted as all flipped and replaced by a straight projection; it is now turned back.

- **The torso no longer lies on itself.** A garment shaped like a bucket (a tube with a flat shoulder on top) used to come out of the flattening fanned around the neck, with a fifth of it on top of itself and no folded triangle to give it away. Now, when a piece overlaps itself, the cloth is laid flat triangle by triangle (from three different starting points; the flattest wins) and smoothed. On the sample jacket the torso is one wide sheet like a hand-made unwrap, with shoulders and armhole notches, its stretch drops from 2.6 to 1.2 and the overlap from 21% to about 3%.
- **Fewer fragments.** A small piece that hugs one neighbour along most of its outline (for example the patch under a sleeve) joins that neighbour instead of getting its own seams. Pieces divided by a real crease or a material change are left alone.
- **Check overlaps** now also finds a piece that covers itself, and Fix overlaps relaxes it.

- **Pieces are packed by their real outline.** Until now every piece was packed as a rectangle, so the empty corners of a bent piece (a torso with armhole notches) stayed empty. Now each outline is drawn on a fine grid and small pieces tuck into the corners of big ones, which lets the pieces grow. On the sample models the picture is covered 3 to 12 points more (Backpack 37% to 49%); a wide torso that fills the picture's width cannot grow, so the jacket changes little.
- **Cloth bunched under an armpit gets a side seam.** Where the surface is a saddle (the armpit between arm and body) it cannot lie flat, so the cut now runs from the middle of the saddle out to the edge of the piece, like a side seam. The cut is taken back if it makes the layout worse. On the sample jacket the leftover overlap fell from 3.4% to 2.3%.

- **No overlap inside a piece.** When a piece still lies on itself after flattening, the Clothing style now keeps cutting until it does not. First choice is a **side seam** the way a tailor opens an armhole: from the point of the armhole opposite to the shoulder cut down toward the hem, so a sweater becomes a front panel and a back panel (a jacket also gets a side panel under the arm). If that is not enough, it cuts out the smallest sheet of the overlap along the shortest seam around it. Every cut is kept only when the pieces lie clearly flatter, and taken back otherwise. Overlap across the whole model on the sample garments: jacket 1.5% to 0.03% of the covered pixels, sweater 0%, coats and the other jackets 0.1 to 0.3%.

- **Thin plates are cut front from back.** A sword guard or a badge has a front and a back; in the Clothing style they are now cut in two before the rest of the work, so they no longer lie on each other.

## 0.55.2

- **Artist style unwrap.** A new **Artist style** choice in the UVs card's Style list, tuned on 20 hand-made unwraps (a backpack, jackets, a helmet, swords, shoes, a face…). It cuts into fewer, bigger pieces, joins small neighbours while they can still lie flat (so the seams that are left follow the hard edges), stands each piece upright so the model's up is the texture's up (when that costs little space), shrinks a very long piece a little so it stops limiting everyone else's size, and cuts a piece that would stretch too much with a straight seam through the middle. On the 20 models it makes about 3 times fewer pieces than Balanced with the same low stretch.
- **Seam angle goes up to 89° for it.** Artist style starts at 89° (big pieces); lower it for more, smaller pieces.

## 0.55.1

- **Re-rolling no longer freezes the app.** Rolling the dice, Re-roll and unwrapping now show a real progress bar (which layout, which step) with a **Stop** button, and the app stays responsive while they work. The long steps give way many times a second, the pictures in the gallery are drawn about 30 times faster, and packing the pieces is several times faster. On a 69,000-triangle helmet, rolling the dice took 24 s with a 3 s freeze before; it now takes 9 s with no freeze longer than a fifth of a second.
- **A bigger look at the UVs.** Hover the small UV picture in the Bake tab's UVs card and a large one (up to 640 px) appears beside it, with the island count and how much of the square is used. It follows the chosen view (layout, checker, stretch or texel size).
- **Spec/Gloss projects no longer get Roughness or Metallic.** Smart materials, Library materials, decals and plain material layers made for Metal/Rough are now converted to Specular and Glossiness as they are added (and the other way round in a Metal/Rough project), so the Material editor and the maps stay clean.
- **Each document keeps its own brushes.** A new document starts with the starting brush for every tool, and each tab remembers the brushes of all its tools (size, opacity, tip and the rest) while you switch between tabs.
- **Symmetry belongs to the document.** A new or opened document starts with symmetry off, and each tab keeps its own mode, centre and rays instead of carrying them across.
- **Radial symmetry: any number of rays** (2 to 128): type it in the new box under the Rays slider. **Reset centre** is a clearer button, and **Liquify now follows symmetry** (mirrored and radial) like the brush.
- **Undo can cover settings.** Preferences › Painting › *Undo also covers settings* makes a change of symmetry (mode, rays, alignment, centre), of the brush (size, opacity and the rest) or of the colour an undo step (off by default). Brush and colour changes count once you stop adjusting for a moment.
- **Drag over the eyes** in the Layers panel: press an eye and drag down the list to hide or show every layer you pass.
- **Closing the desktop window asks to save.** Unsaved documents (and an unsaved 3D Paint project) get a Save / Don’t save / Cancel question before the app quits.
- **Tidier windows.** New document is grouped into **Start in**, **Size** and **Canvas**. Recent files no longer has overlapping buttons.

## 0.55.0

- **Stretch colours.** In the UVs card, **On the model** has Off, Checker, **Stretch** and **Texel size**. Stretch tints the model and the flat layout from green (a perfect fit) through yellow to red (very stretched); Texel size from blue (small) through green to red (big). The seams show as white lines on the model.
- **Live seam angle.** Dragging the Seam angle slider re-cuts the model while you drag, so the seams and colours follow your hand.
- **Dice gallery.** **Roll the dice** cuts and packs 12 different layouts at once and shows them as tiles with their score (how much of the square is used) and number of pieces. The tightest one is marked **best**. Click a tile to use it; the star pins a layout so it stays when you roll again.
- **Unfold.** An **Unfold** slider and a **Play** button slide the model open along its seams into the flat layout and back (each material side by side). The cage and high-poly are hidden while it is unfolded.

## 0.54.0

- **UV check on import.** A low-poly you load (in the New 3D Paint Project window, the Bake tab, or dropped on the 3D view) is checked. No UVs: a window says so and offers **Auto unwrap** or **Continue without UVs**. Overlapping islands, parts outside the 0–1 square or very uneven texel size: a window lists them and offers **Optimize layout**, **Auto unwrap instead** or **Keep as they are**.
- **Auto unwrap.** Cuts the model into pieces where the surface turns, flattens them (a straight projection when nearly flat, LSCM otherwise), gives every piece the same texel size and packs them into the 0–1 square with a gap that follows the texture size. One square per material or one shared square.
- **Review in the Bake tab.** A new **UVs** card shows the layout (overlaps in red), a numbered **checker on the model**, **Style** and **Seam angle**, **Padding**, a **Seed** with **Re-roll** and **Best of 24** (repacks the same pieces 24 ways and keeps the tightest), **Optimize layout** for a model's own islands, and **Original UVs** to go back.
- **Export model with UVs…** (File menu and the UVs card): OBJ, glTF binary and binary FBX, with UVs, normals and a material group per material.

## 0.53.1

- **Spec/Gloss now really works in 3D Paint.** The Glossiness did nothing on the model: 3D Paint was reading a leftover Roughness instead. Now Glossiness sets how sharp the reflection is, and the Specular colour is the colour of the reflection, so a blue shine on a green jade or a gold shine on a brown body show up. The ten Spec/Gloss Library materials have new preview pictures that show it.
- **Switching to Spec/Gloss updates the Material editor.** After choosing Spec/Gloss in the Shader panel (or undoing it, or switching texture sets), the editor still listed Roughness and Metallic. It now lists only Diffuse, Specular and Glossiness in a Spec/Gloss project, and only the PBR channels in a PBR one. The Recolour note and new texture sets follow too.
- **A quieter Maps tab.** Each mesh map is one slim line: dot, name, size and small icons (view, edit in 2D, replace, remove). Empty ones just say Import…

## 0.53.0

- **Panels dock to any side.** Drag a tab to the left, top or right edge of the viewport (a strip shows where it will land) and it docks there; the bottom edge is still the shelf. **⋯ › Dock to the left / top / right** does the same without dragging. A dock goes away when it is empty, and each workspace remembers its docks.
- **Vertical or side by side.** On any dock, **⋯ › Put the panel groups side by side** (or **Stack the panel groups vertically**) switches how its groups are laid out. The new left and top docks resize from their inner edge (double-click for the usual size).
- **Substance Painter style controls in 3D Paint.** **Ctrl + right drag** sets the brush size (left/right) and hardness (up/down), with a ring showing the result; **Ctrl + left drag** sets flow and rotation (it works on the flat texture too). Stencils: **S + left drag** turns (Shift snaps to 90°), **S + middle drag** moves, **S + right drag** scales, and holding **N** paints without the stencil. **F1** 3D + 2D, **F2** 3D only, **F3** 2D only, **F4** swaps the two sides, **F5** perspective, **F6** orthographic. A Preferences switch turns the Ctrl drags off.
- **Spec/Gloss lists are right.** A new Spec/Gloss project (or switching a set) now shows Specular and Glossiness in the Maps list, the channel drop-down and Also paint, and the Metallic and Roughness entries are gone. Glossiness can be adjusted like any other channel.
- **New 3D Paint Project window:** once you choose your own low-poly mesh, the built-in shape drop-down is disabled. A new **Optional high-poly** row sets up the Bake window with both models when the project is created, for when you have no maps to import.

## 0.52.2

- **The real fix for the stuck loading screen.** The 3D viewer's shader had grown to 17 textures when the Specular map was added in 0.51.31. Many Windows graphics cards allow only 16 in one shader, so the shader failed to build while the app was starting and the loading screen never ended. The Specular map now comes in through the Metallic slot (a Spec/Gloss set has no Metallic map), so the shader is back to 16. A new test checks that no shader goes above 16 textures.
- The Maps tab is shorter and tidier: an empty mesh-map slot is one line (name and Import…) instead of a tall box, and a filled one shows its file and the View / Edit buttons.

## 0.52.1

- **Start-up fix.** Some computers could get stuck on the loading screen after updating to 0.52.0. The eight new wrinkle textures had been added into the same graphics program as the older generated textures, which made that program much slower to prepare on some graphics drivers. Each wrinkle texture is now its own small program, prepared only when it is shown, and the older textures are back to how they were.
- **Safer start-up.** Every step of starting the app is now guarded: if one fails the rest still starts, and a short notice says what went wrong. If the loading screen is still up after 15 seconds it now says where it stopped and offers **Reset the saved panel layouts and restart** instead of loading forever.
- The bundled brush tip files B2 to B10 have the same capital letters everywhere, so all 64 bundled brush tips load.

## 0.52.0

- **Spec/Gloss is redone.** Switching a document or a 3D Paint texture set between Metal/Rough and Spec/Gloss now converts every layer where it sits. Before, the converted look was stacked on top as frozen groups, so editing the material underneath changed nothing and the Specular stayed grey. Now a material keeps its Specular colour and Glossiness, editing them changes the map and the model, and undo covers the whole switch.
- The ray-traced render now follows the Specular colour and Glossiness of a Spec/Gloss set.
- **Ten Spec/Gloss materials** in the Library (Gold, Rose gold, Copper, Bronze, Jade with blue shine, Purple lacquer, Pearl car paint, Red velvet, Teal satin, Beetle shell). They are made the traditional way, with a body colour and a different shine colour. They have their own **Spec/Gloss** tag and a small S/G icon on the tile.
- A Metal/Rough Library material added to a Spec/Gloss project is converted (values and pictures) as it is added, and a Spec/Gloss material in a Metal/Rough project likewise.
- **Baker:** 16× anti-aliasing is the default; flat surfaces bake to exactly flat instead of flipping between two values in patches; normals are renormalised after averaging; the high-poly's normals keep full precision; rays no longer slip between touching triangles.
- **Compare with a normal map** in the Bake tab: pick a map made in Marmoset (or anywhere) and see the average angle difference plus a difference picture.
- The Bake button is now big, orange and has a flame on it, at the top of the Bake panel, and stays in view. While baking it turns into Cancel and fills with the progress. Send to Paint, Send to 3D Paint and Export sit right under it.
- The Bake panel is one wide panel in two columns (models, maps and sending on the left, the settings on the right), so everything fits without scrolling. History is now a tab beside it instead of a pane taking half the height. Old saved Bake layouts are reset once.
- **Wrinkle textures:** eight seamless wrinkle maps in the Textures panel (category Wrinkles) for shirts, sleeves, skin and leather.
- **42 new texture brushes**, angular and abstract: shard drips, jagged edges, torn zigzags, fractures, grunge scratches, shard sprays, shards, cut streaks, faceted blobs and shattered glass.

## 0.51.31

- The mesh-map import rows in the Maps tab show their labels above the buttons instead of under them.
- A Spec/Gloss 3D Paint set shows its Specular colour in the 3D viewport as the reflection colour, so a coloured Specular now appears on the model. The ray-traced render is not updated yet.

## 0.51.30

- A 3D Paint texture set can now be converted between Metal/Roughness and Specular/Glossiness. Choosing Specular / Glossiness in the Shader panel converts the set's maps and switches the viewer to the Spec/Gloss shader. Undo and redo cover the switch, and switching back restores the set aside.
- Choosing Spec/Gloss in the Shader panel no longer leaves the viewer on the Spec/Gloss shader while the maps are still Metal/Roughness.
- Material preview and sliders follow Specular and Glossiness on Spec/Gloss sets.

## 0.51.29

- The material preview in the Material editor now follows Specular colour and Glossiness on Spec/Gloss 3D Paint projects, so edits show on screen straight away.
- The glossiness slider is labelled Glossiness instead of Level.
- The Properties panel is now called Material editor, in the panel tab and in messages that point to it.

## 0.51.28

- Choosing Specular / Glossiness when creating a 3D Paint project now starts it with the Spec/Gloss viewer shader. PBR projects start with the Standard shader. The shader can still be changed per texture set.

## 0.51.27

- Fix first-time 3D Paint project creation so a mesh selected in the new-project dialog becomes the active viewport mesh; do not leave the default plane loaded.

## 0.51.26

- Hide the startup primitive dropdown once an imported mesh is active in 3D Paint. Show a Replace mesh button instead, so the viewport stays focused on the imported asset.

## 0.51.25

- Disable built-in startup primitives after importing a mesh in 3D Paint, keep the imported mesh selected, and retain the Import option for replacing it.

## 0.51.24

- Bundle the supplied B1–B10 and Stroke_01–10 alpha images, plus CHIP and Poly_01, as built-in brush presets.
- Remove the recently added denim and cloth-fold smart materials.
- Add original polygon, angular-chip, dry-rake and painterly alpha brushes based on the supplied visual references.
- Add adjustable colour-stop counts and per-stop colour input to gradient ramps.
- Ensure an imported mesh is active and visible when the first 3D Paint project opens.

## 0.51.21

- Keep projected brush opacity consistent across visible steep bevels and hard edges in 3D Paint, instead of fading coverage based on shading normals.
- Retain depth checks to protect hidden surfaces, UV seam padding, and exact paint undo/redo. Existing unpainted pixels in saved strokes need to be repainted.

## 0.51.20

- Fix thin bright UV seams on ordinary painted layers in 3D Paint, including layers with Box Blur or Gaussian Blur attached.
- Extend texture edge pixels into a small UV border so texture sampling stays continuous at full resolution and in the first two smaller previews. Original layer pixels remain editable and unchanged.

## 0.51.19

- Preserve smooth detail through seam-aware Gaussian and box blur instead of shifting samples at every triangle edge.
- Follow the first surface edge crossed by each blur sample and support longer walks through densely triangulated models.
- Keep empty UV gutters and separate texture sets out of connected surface blur.

## 0.51.18

- Type values beyond the normal slider range for spacing, scatter, lazy mouse distance, angle, weld width/spacing, tiling, bump strength, stencil scale and supported 3D lighting/height and filter strengths.
- Keep typed values visible while the slider thumb stays within its normal range; retain valid limits for opacity and hardness.
- Synchronise precise numeric values between the brush panel and top bar.

## 0.51.17

- Preview mirrored and radial brush copies directly on visible mesh surfaces.
- Hide symmetry planes and radial guides while keeping copy cursors visible with separate display controls.

## 0.51.16

- Restore weld brush painting to one shared mask that reveals the material across its channels.
- Reduce pauses at stroke start and release with partial undo capture, prepared mask shaders and regional 3D preview refreshes.
- Preserve undo, redo, saved projects and existing editable weld paths.

## 0.51.15

- Choose Canvas or Screen alignment for 2D mirror symmetry, including rotated and flipped canvas views.
- Drag the on-canvas symmetry centre or reset it with Centre.
- Show radial symmetry rays and an axis-centred ring in 3D, with a highlighted copy count and axis.

# What's new in Gouache Studio

## 0.51.14

- Reduce repeated-stroke pauses in large layered documents by reusing released GPU layer-cache buffers. Idle memory trimming can still reclaim these buffers.

## 0.51.13

- Copy brush-tip alpha correctly into editable paths instead of reading the screen framebuffer.
- Reduce weld painting preview work by refreshing the changed colour, roughness, metal and normal regions instead of whole textures. Use a lighter weld shader prepared when the tool is selected.
- Keep the 3D brush footprint independent of viewport zoom, with the cursor following the projected brush size.

## 0.51.12

- **Weld pixel painting:** the weld brush paints enabled channels directly onto a plain pixel layer, without creating a fill layer or coverage mask. Editable weld paths retain their route and controls while regenerating ordinary pixel channels.
- **Independent workspaces:** Paint and 3D Paint remember panel arrangements separately, even when using the same preset. The workspace menu shows layouts relevant to the current mode and keeps the Paint canvas in place.
- **Texture masks:** clicking a texture adds it to the selected mask; clicking with a colour thumbnail selected still creates a layer.
- **Lazy mouse:** releasing a stroke no longer draws an abrupt tail from the tether to the cursor.
- **Mesh-connected blur:** Gaussian and box blur can follow adjacent mesh triangles across separated UV islands within the current texture set. Single-tile UV layouts are supported; atlas-edge wrapping remains a separate option.

## 0.51.11

- **Weld tools shelf:** put weld controls in a dedicated Tools tab after Materials, Textures, Decals, Environments, Projects and Mesh Maps.
- **Live weld editing:** weld profile sliders update selected paths as you adjust them; the bead uses a round halo-like profile and spaced overlapping stamps.
- **Surface seam coverage:** weld paths continue over adjacent faces at hard mesh splits.


## 0.51.10

- **Weld tools in Materials Library:** bead profiles now live in a Tools view with controls for width, raised height, ripple spacing, irregularity and heat tint. The Projects shelf is reserved for document assets.
- **More weld profiles:** TIG, MIG, Walking the Cup, Convex, Concave, Angular, Double Weld and Tack.


## 0.51.9

- **Weld bead normal detail:** weld strokes now carry a generated, rippled surface normal alongside their metallic colour, roughness and raised height.

## 0.51.8

- **High-resolution 3D painting:** on documents of 16 megapixels or more with at least four layers, the viewport automatically limits redraws to about 30 fps while painting. Every pointer sample still paints; choose Best in Painting speed for full-rate viewport redraws.
- **Weld bead height:** the control now starts at the displayed default and keeps each preset in sync.

## 0.51.7

- **Weld brush:** the Projects shelf has a Weld brush tab with TIG, MIG and tack bead presets. Strokes paint metallic colour, roughness and raised height together; bead height is adjustable.
- **Magnifying glass:** press Z, click to zoom in around the pointer, or Shift-click to zoom out. The toolbar button and Keyboard shortcuts list include the tool.
- **Pen pressure:** 2D and 3D painting now keep the parent pen event's pressure when coalesced samples omit pen metadata, improving compatibility with Windows Ink tablets.

## 0.51.6

- **Sharper material previews:** all 200 bundled material thumbnails now render at 768 × 768. Library hover previews render at 768 pixels or higher; editor and saved-material preview balls render at least 256 pixels, keeping the same compact panel layout.
- **More visible surface detail:** material preview balls now include normal, roughness and metallic texture maps alongside colour and height. GPU shading samples the original maps without copying them into CPU preview buffers.

## 0.51.5

- **Animation shortcuts:** Shift+D duplicates the current frame. Ctrl+D deselects and Ctrl+Shift+D reselects, including in Animation. Holding Shift+D creates only one copy per press. The Duplicate button shows its shortcut.

## 0.51.4

- **Rotated text:** creating, typing and reopening text now follows the canvas rotation and mirror instead of resetting the view. The editor and caret stay aligned with the artwork.
- **Smoother gradients:** higher-precision colour lookup and interpolation remove lookup steps, including Gradient map. Stable dithering works across large coordinates, transparent gradients and low opacity; display dithering also reduces banding when viewing high-precision or zoomed-out gradients.
- **Gasa brushes:** the existing pen is now Gasa Pen. Gasa Manga Pen adds a substantially thinner nib, sharper pressure taper and less smoothing for sketchy manga linework, retaining slight ink bleed. Existing built-in pen favorites keep working under the new name.

## 0.51.3

- **Favorites:** open Window > Favorites, then drag toolbar tools, brushes, textures, materials and smart masks into the panel. Float or dock it, search and filter its contents. 2D canvas and 3D Paint have separate saved collections.
- **Brush switching:** Shift+B swaps the last two presets and recalls their individual session sizes. The shortcut can be changed in Keyboard shortcuts.
- **2D texture layers and masks:** drag a texture onto the canvas or layer stack to add a layer, into a folder to group it, or onto a mask thumbnail to add an editable picture row. Mask Properties are now available in 2D Paint.
- **Canvas compass:** see the rotation angle, drag its dial to rotate freely, hold Shift for 15-degree steps, or click the angle/double-click the dial to straighten the view.

## 0.51.2

- **Liquify:** fixed the second Twirl direction and Restore. Restore paints back the latest deformation after release and remains undoable. Bracket keys now change Liquify Size and synchronize its controls.
- **Gasa Gaya Pen:** Ink bleed keeps the narrow nib shape and gradually wets its edges while held. Pressure controls buildup; no round blob is added when lifting.
- **Alt eyedropper:** holding Alt shows the eyedropper cursor; releasing restores the brush.
- **Canvas-only view:** F hides panels to fill the app window with the canvas; F, Tab or Escape restores them. Flat cage view and framing the 3D model move to Shift+F.

## 0.51.1

- **Gasa Gaya Pen:** sharp pressure taper and lightly rough ink edges. Single clicks keep the nib shape; End ink pooling is reserved for drawn strokes and responds to pressure.
- **New canvas colour:** choose Custom colour with a picker or precise hex value.
- **Recent brushes:** the last twelve presets are available at the top of the brush library.
- **Brush sizes:** each preset remembers its size per tool during the session. Default size restores only its original size.
- **Liquify:** Size and Strength retain edits and precise input; the top bar and Tool settings stay synchronized.

## 0.51.0

- Hold R and drag to rotate the canvas freely. Shift constrains rotation to 15-degree steps; the angle dialog accepts tenths of a degree. Painting returns keyboard focus to the canvas so Space pans after using dropdowns.
- Hidden layers show a clear Hidden badge and highlighted crossed-out eye. Children in hidden folders explain that they are Hidden by group.
- New documents have Portrait (vertical) and Landscape (horizontal) buttons that preserve dimensions, units and DPI. Square texture and brush workspaces keep their existing workflow.
- Added Help > Search commands (Ctrl+Shift+P) for tools, filters and menu actions, with current shortcuts and keyboard navigation.
- Horizontal and vertical flip buttons are available above the canvas with selection tools and Move. Flipped selected artwork becomes the active pixel selection and switches to Move, ready to drag. Undo restores the original selection and artwork.
- Added Clear layer contents to the layer right-click and Layer menus, with Ctrl+Q. Clears all painted channels while keeping the layer and respecting locks, with Undo; an active selection does not limit it.
- Refined Gasa Gaya Pen with a soft asymmetric tapered nib, sharp pressure-sensitive ink lines and a modest rounded deposit at lift-off. The new End ink brush control adjusts or disables the deposit and saves with brush presets.
- Verified these interactions in the native Windows desktop app, including pixel selection parity, dragging flipped artwork, clear/undo across channels and marker ink undo.

## 0.50.1

- Fixed blocky strokes and checkerboard rectangles in the zoomed-out canvas while painting at high resolution. Regional preview updates now expose all mip levels while reading them, then restore the texture's sampling mode. Painted layer pixels remain unchanged; full-image regeneration is still avoided during continuing strokes.
- Added Gasa Gaya Pen to Basic media: an original fine pen/marker preset with a crisp nib, solid ink and pressure taper, based on Kenn's visual references.
- Verified colour/alpha mip parity and actual brush preview/pixel preservation in the native desktop app at 8K and 16K.

## 0.50.0

Liquify: push, pinch, bloat and twirl the paint with a brush, like Clip Studio Paint.

- **Liquify tool** (toolbar button after Clone stamp, or Ctrl+Shift+X). Modes: **Push** (drag the paint along), **Pinch** and **Bloat** (hold to pull in or swell out), **Twirl** clockwise or counter-clockwise (hold to swirl) and **Restore** (softly undoes the change you made in this stroke). Size and Strength are in the bar above the canvas.
- Every map of the layer moves together, so a material stays in step. A selection limits the effect, and each stroke is one undo step.

## 0.49.0

Big PSD files open, the picture can be turned and flipped, and Transform warp has its own key. This release also carries the three dry-ink brushes from 0.45.2, which never went out because the version number had slipped back.

- **Big PSDs open.** A PSD with hundreds of megapixels of layers (like a sketchbook file with 120 layers) no longer stops with "exceeds memory limit". Layers are unpacked one at a time, and any part of a layer hanging outside the page is left out.
- **Turn the view** (View menu): Alt+, and Alt+. turn it 15°, hold R and drag (or Shift+Space and drag) to turn it freely, Rotate view… for an exact angle, Alt+0 straightens it. Every tool keeps working through the turned view.
- **Flip the view left-right** (Alt+H) to check a drawing with fresh eyes. The picture itself is not changed.
- **Flip a layer** left-right or top-bottom (Edit menu, Ctrl+Alt+H and Ctrl+Alt+V), with undo.
- **Turn or flip the whole canvas** (Image menu): 90° either way, 180°, flip left-right (Ctrl+Alt+Shift+H) and top-bottom (Ctrl+Alt+Shift+V). Undo history is cleared, like Canvas size.
- **Transform warp** is now its own command (Edit menu, Ctrl+Alt+T), so you can give it any key in Edit › Keyboard shortcuts.
- Rulers and guides hide while the view is turned.

## 0.45.2

Three dry-ink brushes in Basic media, in the scratchy style of a scanned ink brush.

- **Dry ink pen**, **Dry ink brush** and **Scratchy liner**: strokes break up into fine streaks and ragged edges, thin at the ends when you press lightly. All are our own, drawn in the app.

## 0.48.0

- Paint a library material’s colour, roughness, metallic, height, normal and other enabled channels together. Material strokes share one compact coverage mask and retain the editable material recipe, with one undo per stroke.
- Add the Pen tool: editable Bézier points and handles, open/closed paths, brush strokes, fills, selections, point pressure and saved path layers.
- Add Surface Path in 3D Paint: editable curves attached to the mesh, width/hardness/opacity and point-pressure controls, and colour or library material along the path. Strokes cross UV seams and remain fixed when the camera rotates. This release supports Paint along path.
- Fix black flashes while rotating the model during baking by restoring the shared graphics state at each bake pause.
- Keep 8K canvas detail stable while painting. Dirty regions update their mip levels without switching the canvas to a blurrier filter during strokes.
- Add Clear layer for painted channels, material coverage and path strokes, with undo. Preferences can be resized from its corner and remembers its size.

## 0.47.3

- Show toolbar arrows only on tools with multiple alternatives: Spot/Source Healing, Dodge/Burn and Gradient/Fill. Each menu contains its own group; Brush, Eraser, Blend and Clone keep plain icons and normal clicks.
- Healing menu choices switch and remember the actual Spot/Source mode in Paint and 3D Paint. Hold, drag-to-select, keyboard access and saved brush settings continue to work.

## 0.47.2

- Add corner arrows to the painting tools. Click an arrow or hold the left mouse button on a tool to open a compact menu with tool icons, names and shortcuts. Switch by clicking, or hold, drag and release; each tool keeps its own brush settings.
- Give Gradient/Paint bucket the same menu. Quick clicks and existing shortcuts keep working, with keyboard access and menus that fit either side of the toolbar in Paint and 3D Paint.

## 0.47.1

- Reuse studio shadow depth during colour strokes over opaque materials, skip inactive key-light shadows, and limit alpha/displacement shadow refreshes while painting. Final shadows refresh when the stroke ends.
- Maps gains **Edit in 2D**. The source-size Paint document has a marked mesh-map layer and a **Send to 3D Paint as mesh map** context action. Return links persist through saves and texture-set renames; updates refresh generators/materials, support undo/redo, and preserve source dimensions and 16-bit height precision.
- Heal samples visible layers by default, allowing repairs on a blank layer above a material. Spot and Alt-click source healing retain coverage outside the repair, respect opacity, and support undo/redo.
- Remove the centre crosshair from Paint and 3D Paint brush cursors while retaining the brush outline.

## 0.47.0

- Twenty new Drawing and painting brushes: graphite pencils, charcoal, pastel, watercolour, gouache, acrylic, oil, palette knife, fan, ink, marker and crayon.
- Eight new artwork fonts, with all sixteen artwork families bundled for offline desktop use.
- Shift-click connects brush endpoints; Shift-drag draws horizontal or vertical lines in Paint and 3D Paint.
- Studio lighting presets, fill and rim lights, balanced PBR reflections and real mesh shadows.
- Improved Skin shader with thickness-driven transmission, surface roughness, scatter depth, broad highlights and oily sheen.
- Transparent shadow floor placed under the mesh, with height, direction, light height, softness, opacity and colour controls.
- Rename texture sets without losing their mesh material connections. Names are saved in projects and used in exports.
- Static FBX export with UVs, normals, material slots and texture-file links. Engine exports can include each set's assigned mesh maps.
- Material preview model from Kenn's supplied mesh, framed for viewing, with optional preview material and normal, curvature, height, thickness and AO maps.
- Preserve 16-bit PNG data-map samples during import, including interlaced PNGs. Preview copies are 2K; original supplied files are unchanged.


## 0.46.13

The Projects tab appears only in 3D Paint's Material Library shelf. It no longer appears on the 2D Paint canvas, including saved layouts and after switching between workspaces.

## 0.46.12

3D Paint now displays its actual texture-set resolution, including 8K and 16K. File New offers a model and mesh-map setup window; Maps has labeled import/drop slots for replacing maps later. The Library shelf gains Mesh maps and Projects tabs. Project assets include live layers, source textures and created/converted assets, with compressed records saved inside the document. Imported mesh maps retain their source dimensions and work with normal shading, masks and live material channels.

PSD placement and canvas drops preserve layer folders, names, visibility, opacity, supported blend modes and pixel masks, with one undo step. File Open remains layered; unsupported Photoshop features are reported. Desktop 8K/16K checks and material-memory, shelf and project round-trip regressions passed.

## 0.46.11

Lower memory use when adding textured materials in large 3D Paint documents. Material layers keep their source textures and settings, sharing temporary full-size images when needed. At 8K and 16K, scalar viewport channels use one channel at full resolution, and large brush buffers wait until an edit needs them. The desktop 16K height path keeps half-float precision with compact value and transparency storage.

Tested six library materials, projected painting, camera navigation and undo at 8K and 16K in the Windows desktop renderer on an RTX 4080. Material settings, masks, effects, duplication and project compatibility also have regression checks. 16K still needs substantial graphics memory: use 8-bit colour and UV projection there. Oversized 16-bit colour and 3D projection allocations now show a message instead of attempting unsupported graphics images.

## 0.46.10

Less graphics-memory pressure from uniform material channels and flat bumps. Opaque material stacks skip covered rows, and supported model brush strokes composite only the affected texture area. Height brush buffers are created when height is edited. Files, masks, undo and duplicates preserve the material data.

## 0.45.3

More believable muzzle flashes, with new burst styles and smoke.

- Choose Directional flash, Outward burst or Front-facing flash.
- Start from five presets and adjust the flame, moving sparks, glow and flash duration.
- Add an optional smoke trail that lingers after the flash.
- Larger live preview beside the controls, with Make frames kept visible.

## 0.45.2

A new muzzle flash generator for game-ready sprite effects.

- **Animation › VFX › Muzzle flash:** generates a short one-shot flash with a hot core, directional flame, side flare, sparks and glow. Controls include size, strength, width, reach, rotation, softness, glow, spark amount, spikes, turbulence and brightness, with the existing colour presets or your own colours.
- **Rotation:** point the flash in any direction to match side-view, angled or top-down weapon sprites.

## 0.45.1

The layer controls now work together, as in Kenn's mock-up.

- **Layers panel:** the blend mode and the channel drop-down sit side by side, the **opacity slider runs the full width** with a filled track you can see, then the layer buttons, then Clip and Lock, then the mask buttons. Before, the slider was squeezed to a dot.

## 0.45.0

Tidier panels, a new effect picker, 8 more VFX generators and 93 more brushes.

- **Layers panel:** blend mode, opacity, Clip, Lock and the mask buttons now sit at the top, above the layer list, and take less room (blend and opacity side by side).
- **Paint tab:** the Properties, Shader and Materials panels are gone (they live in 3D Paint). The brush library and the brush settings are now **one Brushes panel**.
- **Preferences** fits its window: nothing is cut off at the right any more, and there is no sideways scrollbar.
- **Animation › + Effect ▾** is a proper picker: sections down the left (Animated, Adjust, Blurs, Distort, Artistic, Photo and print, Patterns, Tiling), the effects on the right, and a search box.
- **8 new VFX generators:** Ripples, Slash, Impact burst, Dust puff, Energy beam, Bubbles, Portal and Sparkles. The looping ones loop exactly.
- **93 new brushes:** 12 Basic media brushes (pencils, charcoal, pastel, dry brush, stipple, hatching, fur, oil, wash, marker, fine liner) and 81 free particle and mark tips (dirt, smoke, lightning, glints, swooshes, cracks, fire) from Kenney's CC0 packs, credited in the wiki.

## 0.44.1

Every filter is now an effect on the Animation timeline.

- **+ Effect…** lists the whole Filter gallery in groups (Adjust, Blur and sharpen, Distort, Artistic, Photo and print, Patterns, Tiling), with the animation favourites on top. Anything you can do as a filter you can now keyframe over the frames.
- Each effect shows all of its settings: the sliders (with a ◆ to keyframe them) and its other controls (modes, ticks, colour pickers).

## 0.44.0

More VFX generators, many more controls, and keyframes that follow their frames.

- **Six new generators** in the VFX… menu: **Explosion**, **Lightning**, **Magic orb**, **Shockwave**, **Rain** and **Snow**, and a **Blood splat** (a burst with spikes, flying droplets and drips that run down; also green ooze, black oil and more through the colour list). Fire, Smoke and Sparks stay.
- **Far more sliders** on every generator, each kind with the ones that make sense for it: Size, Turbulence, Strength, Speed (how many times it cycles per loop), Width, Height / reach, Lean / wind, Amount, Softness, Glow, Flicker, Density contrast, Brightness and Spikes. **Your colours** lets you pick a dark and a bright colour. **Reset sliders** puts them back.
- Looping generators loop exactly; Explosion, Shockwave and Blood splat play once from start to finish.
- **Keyframes follow their frames**: add a frame, delete one, duplicate or move frames and the keyframes on an effect stay on the frames they belong to. A key on a deleted frame is removed, and undo brings it back.

## 0.43.1

Keyframing is quicker.

- Move a slider that has keyframes on any frame and a keyframe is added there at once. The ◆ and the key strip update straight away, with no stepping forward and back.
- Erode / Dissolve now eats the picture away more evenly as Amount goes from 0 to 100%.

## 0.43.0

VFX helpers on the Animation tab.

- **VFX… menu** on the timeline with **Fire**, **Smoke** and **Sparks** generators. Pick how many frames (it loops exactly), the colours (orange fire, blue flame, toxic green, magic purple), the size of the detail, turbulence and strength, and watch the live preview. Tick **Shape it with the painted frame** and the fire or smoke rises from what you painted.
- **Spin this frame**: makes a full turn of the current picture over as many frames as you like.
- **Make loop seamless**: fades the last frames into the first ones so the loop has no jump.
- **Cut this frame into a grid**: slice a sprite sheet you drew or generated (8×8 and so on) into frames.

## 0.42.0

Effects on the animation timeline.

- **Effects under the frames**: add Radial blur, Warp, Distort, Noise, Colour ramp, Blur and more with **+ Effect…**. They sit over every frame and show live.
- **Keyframes**: press the ◆ next to any slider to set a key on the current frame. Between keys the value moves by itself (Linear, Ease in, Ease out, Ease in-out or Hold), so things can blur, warp or fade as the animation plays.
- Diamonds on each effect's strip show where its keys are; click the strip to jump to that frame.
- Effects are saved in the file, are undoable, and **export as rendered** (sprite sheets, GIFs, sequences).
- **Erode / Dissolve** effect: eats the picture away with noise and an optional glowing burn edge. Animate Amount from 0 to 100% to make things erode over time. Also in the Filter gallery and as a filter layer.
- **Glow** effect: a soft bloom around the bright parts.
- **Film grain** effect for the animation: fine grain that changes on every frame so it moves when played (switch off "Change every frame" for still grain). Also available as a filter.
- **Quick dupli can step an effect**: pick an effect and a slider, and it goes from one value to another across the copies. Keyframes after the copies move along with their frames.
- **Filter look** (3D view post processing, in the Shader panel): live Greyscale, Sepia, Invert, Black and white, Duotone, Posterize, Night vision, Thermal, CRT scanlines and Blueprint.

## 0.41.1

ACES and other tone mapping, and better ambient occlusion and film grain.

- **Tone mapping list** in the 3D settings: Filmic, **ACES**, **AgX**, **PBR Neutral**, Soft and None (linear). It applies to the 3D view, screenshots, renders and turntables.
- **Better ambient occlusion** (Post processing): smooth contact shadows that follow the surface, without the speckle, edge halos or dirty grey. New **Smoothness** slider.
- **Better film grain** (Post processing): finer, strongest in the mid-tones, with **Grain size** (the same look at any render size) and **Colour noise** sliders. Turntable frames get different grain each frame.

## 0.41.0

Animation: Quick dupli, frame tools, a seconds ruler, and export at any frame rate with in-between frames.

- **Quick dupli…** makes copies of the current frame in one go: pick 4, 8, 12, 16, 24, 32 or 64, or type a number, and put them right after the frame or at the end. One undo removes them all.
- **Tools…** in the timeline: Reverse, Ping-pong, Repeat and Set the hold, for the frames you Shift+click, or all frames.
- **Seconds ruler** above the frames: click or drag it to scrub through the animation. The frame rate goes up to 240, with a 60 button.
- **Export at any frame rate** (2×, 4×, 24 to 240 fps) with **In-between frames**: Blend (soft cross-fade) or Motion (follows the movement). It works for the sprite sheet, the PNG sequence and the GIF.

## 0.40.1

Windows open in the middle of the screen, and colours can be picked from anywhere on your screen.

- **Every pop-up window** opens in the centre of the screen, every time. You can still drag one by its title bar while it is open.
- **Eyedropper for colour pickers:** a dropper button beside the hex box in the Colour panel and in the pop-up picker. Click it, then click any pixel on your screen, even outside Gouache Studio. Esc cancels.

## 0.40.0

Panels out of the way, a lit flat view, post effects, a Panner shader and a channel drop-down.

- **Tab** hides every panel so the canvas or the 3D view fills the window (in every tab). Tab again brings them back.
- **Lit UV view** (3D Paint): the flat view shows the model laid out flat and lit like the 3D view, as in Substance Painter. The **Lit** button sits next to UV in the viewport strip.
- **Post processing** in the Shader panel: Bloom, Ambient occlusion, Depth of field, Sharpen, Colour grade, Vignette, Chromatic aberration and Film grain, each with a switch, its own sliders and a Reset. They also go into screenshots, renders and turntables.
- **Panner (PBR)** shader: slides the textures over the model in the 3D view (water, belts, glowing energy). Pick the speed, which maps slide, and whether the whole material slides or just one layer. Viewer only, nothing in your painting or exports changes.
- **Channel drop-down** on the layer stack in 3D Paint: pick the channel you see and paint; the blend mode and opacity shown are for that channel.

## 0.39.2

The colour picker opens out into a full picker.

- **Colour buttons** (tint, shader colours, shapes) now open a full picker from the swatch: a colour square, a hue bar, Hue / Saturation / Lightness sliders, a hex box, and the starting colour beside the new one so you can go back. The system picker is still one click away.

## 0.39.1

Slope blur can follow a picture.

- **Slope blur** has a new "A picture" choice. Drop a picture on the box, click it to browse, or use **Choose from Textures…** to pick from the library. The blur then flows along that picture's slope. Flip the slope reverses it, and Picture repeat tiles it.

## 0.39.0

Launch screen, Classic/Modern look, Beginner/Full level, and a Substance-style shelf.

- **Launch screen:** the first time you start, pick your **Look**, your **Level** and where to **Start in**. File › Launch screen… shows it again, and Preferences › Look has the same choices.
- **Classic / Modern:** Classic has square corners and a compact feel; Modern is rounded and roomier.
- **Beginner / Full:** Beginner shows only the main tools (move, brush, eraser, fill, select, picker, hand) and hides the less-used panels, with a short Getting started card. Full shows everything. People who already use the app stay on Full.
- **The bottom shelf** now sits under the 3D view only, so the panels on the right run all the way down, like Substance Painter.
- **Ctrl + drop a material on the model** now leaves the material selected, so its settings show right away.

## 0.38.1

A small fix for material drops.

- **Ctrl + drop a material on the model:** the material itself is now selected afterwards, so its settings show right away. It used to select the ID colour mask.

## 0.38.0

Turn the canvas into a texture, plus layer menu tidy-up.

- **Turn canvas into a texture** (File menu, the Textures panel's From canvas button, and right-click a layer › Turn layer into a texture): pick Grunge, Decal, Material, Brush tip or Stencil. Transparency is kept, and only the selected area is used when there is a selection.
- **Decal and Material** open the Convert tab with your picture. Make the maps, then press Turn into material. A decal keeps its cut-out and sits on the model like a sticker.
- **Flatten image** is now in the layer right-click menu in Paint.
- **Smart material** entries are gone from the layer menu in the Paint tab (they stay in 3D Paint).

## 0.37.2

Neater Preferences, reset buttons and a better colour picker.

- **Preferences** now has tabs (Look, Painting, Speed, Files) so the window is short. Each tab except Look has a **Reset this tab** button.
- **Reset buttons:** Reset lighting (environment, sun and exposure), Reset this shader, Reset brush, and Reset in the material Adjust section.
- **Brushes in the shelf:** the tips fill the left side, with a small stroke preview and the stencil switch on the right.
- **Colour picker:** colour buttons (tint, shader colours, shapes) open a small picker with Hue, Saturation and Lightness sliders and a hex box. The system picker is still one click away.
- **Ctrl + drag a material over the model** shows the ID map so you can see which colour it lands on. The whole drop is one undo step.

## 0.37.1

Fixes and a tidier 3D Paint.

- **Brush tips on other tools:** picking a brush texture while the eraser, blend, dodge, burn, heal or clone tool is on now applies it to that tool. It used to jump back to the paintbrush and ignore it.
- **Material editor:** new Tint & adjust section at the top (tint colour with Multiply, Colorize, Overlay or Gradient, plus contrast, brightness, saturation and hue shift). The channels are folding cards with an on/off switch.
- **Tiling lock:** with the chain on, a number you type goes into every axis.
- **F** brings the model back to the middle in 3D Paint.
- **Layers** start right under their buttons. **Bake Maps** and **Shader** are tabs beside the texture sets. **3D · Split · 2D · UV** moved to the lower right.
- **Stencils** are now a "Use a stencil" switch in Brushes: drop a picture on it or click to choose one. The Brushes panel no longer repeats size, opacity, flow and hardness from the top bar.
- **Material shelf:** round previews, a search box, taller by default. You can still drag its tabs around to make your own layout.
- **Drop a material on the model** to add it as a layer. Hold Ctrl while dropping to use only the ID colour under the pointer.
- No rulers in 3D Paint. A material's frame no longer shows on the flat texture unless you tick it. Messages no longer cover the 3D bar.
- Alt+click on a tick box that was clicked directly now works (for example the material channels).
- Your saved 3D Paint layout is adjusted once: Bake Maps and Shader move next to the texture sets, and Stencils goes.

## 0.37.0

3D Paint has a new, calmer layout, closer to the mock-up.

- **Less to look at:** the material editor has its own column (Properties, Brush, Color and Shader as tabs). Texture sets and Layers sit together on the right (Layers, Maps, Channels, History and Bake Maps as tabs). Assets stay on the bottom shelf.
- **3D on the left, flat texture on the right,** side by side by default. Drag the divider to change the split.
- **Slim top bar:** only size, opacity, flow, hardness and what the brush paints. Everything else about the brush (spacing, smoothing, lazy mouse, jitter, symmetry for the flat canvas) is in the Brush tab. The 3D view's own bar shows shading, mirror, view and perspective; wireframe, spin, screenshot, render, turntable, settings and pop out are behind the ⋯ button.
- **Layer buttons at the top** of the layer list in 3D Paint.
- **Fewer tools and no key hints** in 3D Paint: crop, text, shape, array and cage tools are hidden there, and the shortcut card on the canvas is off.
- Click the colour swatch on the toolbar to bring the Colour tab forward.
- Your saved 3D Paint layout is reset once to this one. Everything else works as before.

## 0.36.3

Environments in the shelf, and an eyeball for each material in the Bake tab.

- **Environments category:** the 3D Paint shelf now has an **Environments** category with a thumbnail for each HDRI. Click one to light the model with it. **Load your own…** reads a .hdr or .exr, and **Simple sky** turns the HDRI off. Turn, brightness and the background are still in the Shader panel.
- **Bake tab eyeball:** when a model has more than one material, a **Materials to bake** list shows an eyeball for each. Close an eye and that material is left out of the bake, so a big model can be baked in groups. The eyeball does not hide the material in the 3D view of the Bake tab yet.

## 0.36.2

Two small fixes you asked for.

- **Alt colour picking can be turned off:** Preferences has a new tick, "Alt picks a colour". Untick it and Alt+click on the canvas, or holding Alt over the model, no longer picks a colour. Alt still turns the 3D view.
- **Chain link and the 3D scale boxes:** with the chain on, dragging one scale box on the 3D handles now scales X, Y and Z together. Turn the chain off to scale one direction at a time.

## 0.36.1

Double-click "Object" now picks separate pieces.

- **Object selection:** in 3D Paint, double-clicking with the Object selection now picks just the pieces that are connected together. Parts of a model that do not touch each other are separate objects, even when the file calls them all one object.

## 0.36.0

The 3D Paint bottom shelf, like Substance Painter's.

- **Bottom shelf:** in 3D Paint the asset panels now sit along the bottom in one wide shelf, with a **category list** down the left: **Materials**, **Textures** (grunges), **Decals**, **Stencils** and **Brushes**. Click a category to see its tiles. Drag the bar above the shelf to make it taller, or use the fold arrow to hide it.
- **Thumbnail size:** the S / M / L buttons in the Materials category make the tiles smaller or bigger.
- **Materials view:** chips at the top of Materials show All, Yours, Library, Smart materials or Smart masks, so you only see what you are looking for.
- **More room on the sides:** the right-hand columns give the layer list more height now that the assets have moved down. If you saved your own 3D Paint layout, it is reset once to the new one.
- Not in this round: an Environments category (HDRIs) and the eyeball in the Bake tab. Both come next.

## 0.35.0

The 3D Paint viewport gets a layout strip, and texture sets get an eyeball.

- **Viewport strip:** a small pill at the bottom of the 3D Paint area switches between **3D**, **Split** and **2D**, and turns the **UV** layout on and off. In Split the two views start the same size, and you can drag the divider. The flat texture keeps its own zoom.
- **UV layout on by default** over the flat texture in 3D Paint, so you can see where things land.
- **Eyeball on each texture set:** hide a set and the parts of the model that use it disappear from the 3D view. It is saved with the project. The Bake mesh maps window leaves hidden sets unticked, so you can bake in groups.
- **File menu in 3D Paint** now has **Import a model** and **Bake mesh maps** in it.
- **Update a saved smart material or smart mask:** right-click a folder that came from your saved smart material (or a layer whose mask came from your saved smart mask) and choose **Update smart material “name” in Materials** (or the mask one). It asks first, then puts your changes back into the library. The built-in ones can't be overwritten: use Save as to keep your own version.

## 0.34.0

Swap a layer's material by double-clicking, a Tiling slider, tidier mask rows, 50 calm base materials and lots of new smart materials and masks.

- **Double-click to swap the material:** with a material layer selected (not its mask), double-click a tile in Materials and it replaces that layer's material. The layer keeps its mask, blend and place in the stack. One undo brings the old one back.
- **Tiling slider:** the Tiling numbers now have a slider (from 0.1 to 30 repeats). With the chain lock on it moves every axis together. The lock button sits under the label so the number boxes have room.
- **Mask rows only when the mask is selected:** the rows under a layer that belong to its mask now show only while that mask is the one selected. Click the mask thumbnail to see them.
- **50 calm base materials (200 in the Library now):** plain, even leathers, fabrics and metals, dusty dirts and fine sands, made to sit under smart masks. Dirt, dust and sand are in Ground & nature.
- **19 new smart materials:** Worn Steel, Rusty Painted Metal, Chipped Yellow Paint, Aged Bronze, Copper Patina, Battle Leather, Old Black Leather, Dirty Canvas, Worn Khaki Cloth, Weathered Wood, Old Planks, Cracked Stone, Snowy Rock, Muddy Ground, Stained Concrete, Scuffed Plastic, Cracked Porcelain, Worn Carbon and Molten Rock. They are built from the library materials and the grunge maps, and stay live.
- **12 new smart masks:** Scratched edges, Scuffed edges, Rust streaks, Rust pits, Heavy grime, Paint chips, Cracks, Water stains, Settled dust, Frost, Fingerprints and Dripping grime.

## 0.33.1

The library is now 150 materials and 75 photo grunge maps.

- **75 new materials** (all free to use, from ambientCG): more metals (nickel, cobalt, platinum, copper, aluminium, rusty and dented iron, sci-fi panels, diamond plate, corrugated steel), leathers, cloths and tartans, plastics, woods, ground and nature, and two new Library buttons: **Stone & tile** and **Paint & ceramic**.
- **35 new grunge maps:** scratches, smears and stains, drips, cracks, rust pits, worn paint and frost veins. Find them in the Textures panel.
- Credits for every new one are on the Textures and decals wiki page.

## 0.33.0

Turn to a side view with Shift, no more jumping layer list, and a scale lock.

- **Shift snaps the turn:** while turning the model, hold Shift and it snaps to the nearest side view (front, back, left, right, top or bottom). Let go of Shift and it carries on turning freely.
- **Fixed: the layer list jumping.** Clicking a mask row or effect row (which brings the Properties panel forward) sent the layer list back to the top. Panels now keep their scroll place.
- **Tiling like Painter, with a lock:** a material's or pattern's scale is now called Tiling, and a bigger number repeats it more (before, a smaller number did). Older files look exactly the same. Decals keep a Size number. The chain button next to it (on by default) keeps the proportions: change one number and the others follow. Unlock it to set each one alone.

## 0.32.1

Decals show where they will land, sit on the right side, and the 3D view snaps to sides.

- **Placement halo for decals:** when you drag a decal (or click one and move over the model), a glowing ring with a grid follows the cursor on the surface, tilted with it, so you see exactly where and how big the decal will be.
- **Fixed: decals landing behind the model.** On models whose surface directions point inwards, a decal could appear on the far side. A decal now only covers the surface right under it, whichever way the model's directions point, and it no longer reaches through to the back.
- **Snap the view:** a new View… menu in the 3D view snaps to Front, Back, Left, Right, Top or Bottom. Numpad 1, 3 and 7 do Front, Right and Top over the model; hold Ctrl for the opposite side.
- **Perspective or Orthographic:** a button in the 3D view switches between them (Numpad 5 too). Orthographic has no depth shrinking, good for lining things up. Painting, picking and decals work in both. Ray traced mode still uses a perspective camera.
- **Alt+click clears the mask:** with a mask tool on (ID colour, Box, Lasso, Polygon or Paint), an Alt+click on the model, without dragging, clears the mask: the picked ID colours, the selection, or the mask itself. Alt+drag still turns the model.

## 0.32.0

Decals like Substance Painter, an ID map view for ID colour masks, and brush tips the right way up.

- **Drag a decal onto the model:** drag a decal from the Decals panel over the model. It sits on the surface under the cursor, facing out, and follows you so you see exactly where it will land. Let go to place it. Let go off the model, or press Esc, and it goes away again. Clicking a decal and then the model still works.
- **Add a decal as a layer:** pick a decal and use Add as a layer with Sticker, Tri-planar or UV projection. It is a normal decal layer you can move, turn and scale in Properties.
- **ID colour masks show the ID map:** while you pick ID colours, the model shows the ID map itself, and the colours you have picked turn white. Click a swatch to remove a colour and it goes back to its own colour.
- **Fixed: brush tips painted upside down on the model.** A brush with a tip shape came out flipped top to bottom on the 3D model. It now lands the right way up, and rotating the tip or making it follow the stroke direction turns it the right way too.

## 0.31.3

Brush tips land the right way up on the 3D model.

- **Fixed: brush tips painted upside down on the model.** A brush with a tip shape (an arrow, a leaf, a letter) came out flipped top to bottom when you painted on the 3D model. It now lands the right way up, and rotating the tip or making it follow the stroke direction turns it the right way too.

## 0.31.2

Quicker blend modes, and a middle step for slower computers.

- **Change a blend mode right on the row:** on the rows under a layer's mask (and the effect rows on the layer), click the blend name to pick another one from a list. It is one undo step.
- **"Model while painting" has Three quarters** between Full size and Half size. It is in Preferences and in the 3D view's settings.

## 0.31.1

A middle step for painting on slower computers.

- **"Model while painting" now has Three quarters** between Full size and Half size. Three quarters is sharper than Half and still lighter than Full. It is in Preferences and in the 3D view's settings.

## 0.31.0

Paint starts to look like Photoshop.

- **Layer is a menu of its own again**, in the same order as Photoshop: New, Duplicate, Delete, Layer style, Layer mask (Reveal all, Hide all, Apply, Delete), Group, Merge and Flatten.
- **Chain link on layers with a mask:** a small chain sits between the layer's picture and its mask. Linked (the default), moving or transforming the layer moves the mask too. Click the chain to unlink, and the mask stays where it is. It is saved in your file.

## 0.30.2

Low power painting for slower computers.

- **New "Model while painting" setting:** Half size draws the 3D model at half the size, without smoothing, while you paint, then sharp again when you lift the brush. It is in Preferences and in the 3D view's settings, next to Painting speed. It is off by default.

## 0.30.1

Faster painting on masks.

- **Painting on a mask is much lighter:** while you paint on a mask, the app used to redraw the whole picture on every brush move. It now redraws only the area you just painted. The result is the same.
- **Fast painting speed also holds back the 3D map updates:** with Painting speed on Fast, the model's other maps (roughness, normal and so on) update when you lift the brush instead of during the stroke. Balanced updates them less often.

## 0.30.0

Fold arrows, a bottom shelf, sharper material previews and a painting speed setting.

- **Fold arrows:** the toolbar, the tool options bar and the panel columns each have a small arrow that folds them into a thin strip. Click it again to bring them back. Folding gives the canvas the room.
- **Bottom shelf:** drag any panel tab to the bottom of the canvas, or use the panel's … menu › Move to the bottom shelf. Drag its top edge to make it taller, or fold it.
- **Sharper material previews:** the library pictures and the hover preview are drawn from the full images at higher detail.
- **Painting speed:** Best, Balanced or Fast, in Preferences and in the 3D view's Settings. Balanced and Fast redraw the picture less often while you paint, which helps slower computers and big documents. The paint itself is the same. It is saved per computer.

## 0.29.2

3D Paint gets a Bake Maps tab, and the skin shader looks better.

- **Bake Maps tab:** baking mesh maps now has its own tab in 3D Paint, next to Maps, instead of sitting in the long 3D Paint panel.
- **Skin shader:** light now bleeds past the shadow edge red first, like real skin, and there is a new Oily sheen slider.

## 0.29.1

Fixes for lag, blurry material previews and moving panel tabs.

- **Less lag with grunge masks and filters:** the effects on a layer are now remembered while you paint, so a stroke no longer redoes them every time.
- **Sharper material previews:** the little spheres and the hover preview are drawn in higher detail and smoothed, so you can tell what the material is.
- **Panel tabs:** drag a tab to any spot among the others in its group; a bar shows where it will land.

## 0.29.0

Filters in categories, drag and drop for textures and materials, and a closer look at materials.

- **Filter menu in categories:** Blur, Sharpen, Distort, Paint and sketch, Photo looks, Print, Edges and relief, Noise and render, Tiling. Point at a category and its filters open beside it.
- **Textures:** drag a texture onto a layer to put it in that layer's mask, or to the edge of a layer to make a new layer there. Click adds a new layer. Right-click still offers all the other uses.
- **Materials:** a click now only highlights a material. Drag it onto the layer stack, or press the fill layer button to add the highlighted one. The same goes for smart materials, and the mask button applies a highlighted smart mask.
- **A closer look at materials:** point at a material and a larger preview opens beside it with its channels, size and source.
- **Thumbnail size:** S, M and L buttons at the top of the Materials tab.

## 0.28.2

Quick fixes and a cleaner 3D Paint panel.

- **Document tabs move freely:** one drag now carries a tab left or right past as many others as you like.
- **Colours start black and white**, like Photoshop, instead of yellow.
- **Colour picker drags stop when you let go**, even if the release was missed (a stuck drag could keep changing the colour).
- **Layer buttons can sit at the top or bottom** of the layer list: use the small arrow beside "Layers".
- **Less lag painting on a mask** that has rows under your paint row: they are worked out once per stroke instead of every frame.
- **Recolour for materials:** a new section in the Material panel changes a material's base colour and keeps its detail, like Marmoset's Recolor. Modes: One colour, Main colour (finds the dominant colour), Several colours, and Custom (pick from and to colours), plus Contrast, Brightness and Saturation sliders. Roughness, metal and the normal map are untouched.
- **File menu follows the section:** 3D Paint, Bake, Convert, Brush, Animation and Paint each show only the File items that fit (for example no PSD export or sprite sheets in 3D Paint).
- **Submenus:** the layer right-click menu nests Layer style and Mask from mesh map, and the Image menu holds Layer and Maps as fly-outs.
- **Cleaner menu bar:** the Maps and Layer menus are gone from the top; their items are at the end of the Image menu.
- **3D Paint panel:** Export textures and Selection to mask buttons removed (Export textures stays in the File menu).

## 0.28.1

More materials and grunge, and materials that cover what's under them.

- **75 materials in the Library**, mostly for characters and weapons, in categories (Metal, Leather, Fabric, Plastic & rubber, Wood, Ground & nature): gunmetal, blued gun metal, titanium, brushed aluminium, polished and scratched steel, chrome, polished gold, copper, bronze, chainmail, a carbon-look weave, knurled grip, snakeskin, tufted and padded leather, tartan, plaid, velvet, knit, felt, gun polymer, grip rubber, walnut, and a few for nature like grass and moss. All from ambientCG (CC0).
- **40 photo grunge maps** in the Textures panel: new hand print, fingerprints, smudges, oily marks, chips, grime, speckle, micro scratches, wipes, swipes and more leak streaks.
- **Materials cover the bumps below:** a smooth material on top now hides the height and normal detail of the layers under it. Untick **Hide the bumps below** in the Material panel to let the bumps add up instead.

## 0.28.0

Textures, decals, a material library, embroidery patches, much smaller files, and a lot of your requests.

- **Materials Library:** 23 ready-made materials from ambientCG (free, CC0): red, brown, black and quilted leather, worn steel, dark iron, brass, blued steel, brushed metal, rusty painted metal, rust, dirt, dry mud, gravel, linen, wool, check fabric, canvas, dark and pale wood, concrete, rubber and plastic. Click one (or drag it onto the layers) to use it. Any .gmat file placed in the app's materials folder becomes a built-in too.
- **Textures panel:** 13 photo grunge maps (streaks, water rings, specks, stains, drips, splotches, spatter, scratches, dirt, dust, fingerprints, smears, leak streaks), 12 generated seamless textures, and your own pictures. Share yours as a .gtex pack. Click one to use it: in a mask, in a material channel, as a new layer, as a stencil, or as a brush tip.
- **Decals panel (3D Paint):** bolts, rivets, screws, vents, a warning label, hazard stripes, a serial plate, a crack, a bullet hole and scratches. Click one, then click the model: it lands facing the surface with colour, height, roughness and metal, as its own layer you can move, turn and scale. Import your own logos and labels too.
- **Filter › Embroidery patch:** turns a picture into a stitched patch, with thread colours taken from the picture, satin edges, fill stitches, a merrow border, thread shine and height.
- **Smaller files:** every document, project, autosave and material is packed much tighter without losing anything. With **Smaller files** (Preferences, on by default), colour and grey maps are also kept as high-quality WebP. Normal maps, height and masks always stay exact. .gmat files are compressed too.
- **Engine quality** (Preferences): Low, Medium, High or Ultra, for slower or faster computers.
- **Height depth works on your models:** hard edges and seams no longer tear open, and models with several texture sets keep their textures when you raise Detail.
- **Help menu:** the user guide (F1), what's new, keyboard shortcuts, reporting a problem, and About.
- **The workspace follows the tab:** each top tab remembers its own workspace.
- **Animation shortcuts:** Ctrl+F new frame, Ctrl+D duplicate, Delete removes the frame, `,` and `.` step between frames, Space plays and stops, Ctrl+Shift+Left/Right moves the frame.
- **Alt+click a tick box** in a list (maps to bake, Material channels and more) to keep only that one; Alt+click it again for everything else.
- **C in 3D Paint** steps through the baked mesh maps on the model; Esc goes back to the material.
- **ID colour mask** from the right-click menu, and baked ID maps reach 3D Paint.
- **Material layers without a mask:** painting on one now does nothing (add a mask to paint where it shows).
- **Fixed:** selections and lassos made in the mask view no longer stay after you leave it.

## 0.27.0

Export straight into your engine, models that update themselves, new filters, and a lot of your requests.

- **Your own export presets:** pack any maps into the red, green, blue and alpha of one image (for example metallic, roughness and AO), choose the normal style and the file names. Sizes now go up to 8K.
- **The model comes too:** export a **.glb** with every texture inside and connected (one material per texture set), or an **.obj + .mtl**.
- **Send to Blender, Unity, Godot or Unreal** (desktop): the files go straight into your project's folder. For Blender there's a small add-on (Export window › Save the Blender add-on…): a running Blender receives the model at once, and each send replaces the last one.
- **Models that update:** when a model file you imported is saved again in another program, the app asks to update it and to bake again with the last settings (or does both without asking, if you like). A changed high-poly always asks first. Desktop only.
- **New filters:** Warp, Slope blur (Blur, Min, Max, like Substance) and Distort (waves, ripple, twirl, pinch). They're also in the Filter Gallery, filter layers and masks, and generators have a new **Distort** setting for irregular wear.
- **Stretch every panel:** a wider dock, the 3D Paint column, the toolbar (one or two columns) and a taller Animation timeline.
- **Stickers from Paint:** a layer sent to 3D Paint lands on the model as a see-through sticker, projected from your view, and you can move, turn and scale it on the model.
- **Materials from downloads:** Materials › From textures… turns a download from ambientCG, Poly Haven, ShareTextures and similar sites (folder, images or .zip) into a material.
- **Convert tab › Turn into material:** the converted maps become a material for 3D Paint.
- **Drag onto the layers:** drag materials and smart materials between layers, or a smart mask onto a layer.
- **Autosave** keeps every open document tab, not only the one on screen.
- **New document › Start in:** Paint, 3D Paint, Animation or Brush.
- **Materials** start without a mask; painting on one adds a black mask to paint white into. Sent bakes stay out of the layer stack (the baked normal shades the model by itself).
- **Environment** settings are in the Shader panel, and **Shift + right-drag** turns the lighting, like Substance Painter.
- **Filters on masks:** every filter can go on a mask, and the right-click menu has Filter this layer and Filter its mask.
- **Fixed:** layer styles now work on materials and masked layers; the Material panel's sliders drag smoothly back and forth; the Mesh map list in materials no longer closes by itself.

## 0.26.2

Document tabs, and documents in windows of their own

## 0.26.1

Polish from testers: no accidental reloads, rulers and guides, layer locks, New document presets, colour wheel/sliders/swatches, shortcut helper, sharp theme, faster big canvases, autosave countdown

## 0.26

HDRI lighting, shaders per texture set, ray-traced view and renders, screenshots, turntables, high-poly in the Bake tab

## 0.25

Welcome screen, autosave, recent files, per-tool brushes, shape corner bevels, shortcut categories

## 0.24

Smart materials and smart masks, anchor points, baking inside 3D Paint, healing brushes, clone stamp

## 0.23.1

Planar and spherical projections, projection gizmo and UV frame

## 0.23

Masks and effects: rows under a layer (paint, mesh maps, ID colours, direction, gradients, noise, generators, filters), content effects, Properties panel, live mask, mesh maps from a material

## 0.22

Material layers and the Materials tab, triplanar, mask mode, bake to 3D Paint per material, ID from vertex colours/polypaint, floating dialogs, History, lazy mouse; Material panel, mesh maps in materials and masks, mask tools and ID colour masks, Substance-style Levels (0.22.2)

## 0.21

3D Paint tab (texture sets, Substance-style layers, mirror, stencils, selections)

## 0.20

Fill layers, own canvas for Bake and Convert, bake export, right-click layer menu, resizable dock

## 0.19

Shapes with bevels, Array tool, layer styles

## 0.18

Faster baking, memory and disk settings, bake tabs, reworked curvature, bakes as layers

## 0.17

15 new filters (glass, print, photo and artistic looks), Y2K gradient maps

## 0.16

New layout: options bar, tabbed dock, floating panels, workspaces, Filter Gallery

## 0.15

Specular/Gloss workflow

## 0.14.1

Brush tab

## 0.14

Colour jitter, keyboard shortcuts, themes, brush tips, pictures into masks, Tile filter

## 0.13

Convert tab (CrazyBump-style map converter)

## 0.12

Bake tab, painting on the model, skew and offset painting

## 0.11

Cage painting and symmetry

## 0.10

Baker

## 0.9

3D view

## 0.8

Filter layers

## 0.7

Converters and filters

## 0.6

Maps in documents, engine texture export, .gouache files

## 0.2–0.5

Selections, transforms, crop, fills, gradients, dodge/burn, flipbooks

## 0.1

Desktop app, self-updates
## 0.51.22

- Add multi-tile UDIM painting, baking, project persistence, UV-channel selection and UDIM-named texture exports.
- Add a sprite-focused Animate new-document setup, 16-colour indie palettes, swatch-first color controls and pixel brushes.
- Add square, scratch, grunge-wear, abstract-shard and running-stitch brush presets, five denim smart materials and ten cloth-fold variants.
- Consolidate recent local improvements to seam-aware painting and blur, angled surface coverage, weld responsiveness, symmetry cursors, numeric slider values and pipeline-aware 3D project setup.

## 0.51.23

- Add five original procedural smart masks: chunky paint wear, poster pigment breakup, stylized edge chips, denim abrasion and cloth crease breakup.

