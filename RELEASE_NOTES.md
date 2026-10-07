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
