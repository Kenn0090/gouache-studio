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

