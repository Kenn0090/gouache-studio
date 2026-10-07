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
