# Converters and filters

Every dialog below **previews live** on the canvas. Turn this off for one dialog with its Preview checkbox, or everywhere in Preferences. Filters work on **the map you're viewing** and stay **inside the selection**. Every filter dialog also has **Keep editable**, which makes a [filter layer](Filter-layers.md) clipped to the layer instead of changing its pixels.

## Maps menu: converters

![A converter with live preview: curvature from the height map.](images/converter-curvature.png)
*A converter with live preview: curvature from the height map.*

Each converter makes a **new layer** in the target map and adds that map if it's missing. You can fade, mask or paint over the result. **Keep live** makes a filter layer that updates by itself whenever the source map changes.

| Converter | Result |
|---|---|
| Height from base colour | Lighter areas become raised. Sliders for fine detail, large shapes, shape size, contrast and smoothing, plus invert. |
| Normal from base colour | Height from brightness, turned into normal detail. |
| Roughness from base colour | Brightness mapped into a roughness range. |
| Ambient occlusion from height | Crevices get darker; the layer multiplies over the AO map. |
| Curvature from height | Smooth curvature: edges light, cavities dark. It can go to a base colour layer (for edge highlights and wear), a roughness layer, or a **selection**. |
| Curvature from normal | The same, read straight from the finished normal. |
| Ambient occlusion from normal | Rebuilds the shape from the normal map, then darkens its crevices. |
| Height from normal | Rebuilds the shape a loaded normal map describes. |
| Flip normal green | Switches a normal layer between DirectX and OpenGL. |

## Adjust menu

![Curves.](images/curves.png)
*Curves.*

![Levels.](images/levels.png)
*Levels.*

- **Color adjustments** (Ctrl+U): exposure, brightness, contrast, saturation, hue, temperature.
- **Levels** (Ctrl+L): input black, midtones and input white; output black and white; per channel, with a histogram and **Auto**.
- **Curves** (Ctrl+M):
  - click the curve to add a point, drag to move it, drag it off the box to remove it;
  - works per channel;
  - presets: S-curve, lighter, darker, invert, flatten.
- **Hue / Saturation**, with **Colorize**.
- **Gradient map:** each brightness replaced by a colour from a gradient.
- **Invert** (Ctrl+I), **Desaturate** (Ctrl+Shift+U), **Threshold**, **Posterize**.
- **Quantize:** reduce to 2–64 colours picked from the image, with optional dithering.

## Filter menu

![A filter dialog (Clouds) with live preview.](images/filter-clouds.png)
*A filter dialog (Clouds) with live preview.*

- **Blurs:**
  - Gaussian;
  - Box (flat and even);
  - Radial, which spins around or zooms towards a centre you choose;
  - **Lens blur:** out-of-focus camera look, where bright spots bloom into round or six-sided highlights;
  - Surface blur (smooths but keeps edges);
  - Motion blur.
- **Sharpen**, **High pass** (keep only fine detail; set the layer to Overlay to sharpen).
- **Artistic:**
  - **Oil paint:** calm, flat dabs;
  - **Painterly:** strokes that follow the shapes;
  - **Cutout:** a few flat colours with simplified edges;
  - **Mosaic:** square tiles, with optional grout and bevel.
- **Stylize:** Emboss, Find edges.
- **Noise and patterns:**
  - Add noise;
  - **Render clouds** and **Render cells** (Voronoi). Both tile seamlessly and can be colour or black and white.
- **Tiling:** **Offset** (slides the image with wrap-around so seams show), **Make seamless** (blends the edges).

Heavy filters (painterly, oil paint, lens and surface blur, cutout) are drawn in small pieces, so big images don't freeze the graphics driver. They can still take a moment on very large documents.

**Cutout and Quantize** pick their colours once. **Pick colours again** refreshes them.
