Converters and filters.

**Maps menu: make one map from another.** Each converter previews live and adds a new layer, so you can fade it, mask it or paint over it:
- **Height, Normal or Roughness from base colour.** Sliders for fine detail, large shapes, contrast and invert.
- **Ambient occlusion from height:** crevices get darker.
- **Smooth curvature from height:** edges light, cavities dark. It can go to a base colour layer (for edge highlights and wear), a roughness layer, or a selection.
- **Height from normal:** rebuilds the shape a loaded normal map describes.
- **Flip normal green** (DirectX ↔ OpenGL).
- **Document maps…** moved here. A converter adds its target map for you if the document doesn't have it yet.

**Adjust:** **Levels** (Ctrl+L, with histogram and Auto), **Curves** (Ctrl+M, per channel, with presets), **Hue / Saturation** (with Colorize), **Gradient map**, **Desaturate** (Ctrl+Shift+U), **Threshold** and **Quantize** (reduce to 2–64 colours taken from the image, with dithering).

**Filter:**
- **Blur and sharpen:** Surface blur (keeps edges), Motion blur, High pass.
- **Artistic:** Oil paint, Painterly (strokes that follow the shapes), Cutout, Mosaic (with grout and bevel).
- **Stylize:** Emboss, Find edges.
- **Noise and patterns:** Add noise, Render clouds, Render cells. Clouds and cells tile seamlessly.
- **Tiling:** Offset, Make seamless.

All of them preview live, work on the map you're viewing, and stay inside the selection. Heavy filters are drawn in pieces so large images don't freeze the graphics driver.
