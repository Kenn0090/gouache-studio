# Gouache Studio 0.51.5

- **Animation:** Shift+D duplicates the current frame; Ctrl+D deselects and Ctrl+Shift+D reselects. Held keys do not create repeated copies.

Validated frame pixels and hold duration, undo/redo, selection shortcuts and typing safety in the Windows desktop app.

# Gouache Studio 0.51.4

- **Text on rotated canvases:** the editing box and caret follow canvas rotation and mirror. Adding or editing text no longer straightens the view.
- **Gradient banding:** higher-precision lookup, smooth Gradient map interpolation, stable large-coordinate dithering and accurate low-opacity/transparent rounding. Canvas display dithering reduces visible steps in high-precision and zoomed-out gradients without changing exported pixels.
- **Gasa Pen and Gasa Manga Pen:** retain the current pen alongside a thinner, sharper and less smoothed manga variant with light ink bleed. Old built-in favorites migrate to the new name.

Validated in the native Windows desktop app, including text placement/editing/undo, 8K/16K-coordinate gradient strips, gradient precision and map interpolation, transparency, pressure linework and ink bleed.
