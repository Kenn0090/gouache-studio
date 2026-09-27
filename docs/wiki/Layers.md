# Layers

## Basics

![The Layers panel, with a group and clipped layers.](images/layers-panel.png)
*The Layers panel, with a group and clipped layers.*

- **+ Layer** (Ctrl+Shift+N), **+ Group**, **Duplicate** (Ctrl+J), **Delete**, and the ↑ / ↓ buttons.
- **Selecting:** click to select a layer; Ctrl or Shift+click selects several. Drag to reorder, or drop onto a group to move a layer inside it.
- **Rename:** double-click a layer's name.
- **Visibility:** the eye button hides or shows a layer.
- **Layer properties** (above the list):
  - **Blend mode:** hover a mode to preview it before choosing.
  - **Opacity.**
  - **Clip to layer below:** the layer only shows where the layer under it has paint.
  - **Lock alpha:** paint only where the layer already has paint.

## Blend modes

![Choosing a blend mode.](images/blend-modes.png)
*Choosing a blend mode.*

Normal, Multiply, Screen, Overlay, Darken, Lighten, Color dodge, Color burn, Hard light, Soft light, Difference, Exclusion, Linear dodge (Add), Hue, Saturation, Color, Luminosity, Vivid light, Linear light, Pin light and more. Groups can also be **Pass through**.

In documents with several maps, each layer has **a blend mode per map**. The mode button shows the one for the map you're viewing. Height layers default to Linear Light, so mid-grey leaves the height unchanged.

## Masks
**Add mask** starts a mask that shows everything; **Add hide-all mask** starts one that hides everything. If a selection is active, the new mask is made from it.

Click the mask thumbnail to paint the mask. **Shift+click** turns the mask off or on, and **Alt+click** views it. **Layer › Apply mask** bakes the mask into the layer; **Delete mask** removes it.

## Groups
Groups can be nested, and each has its own mode, opacity and mask. **Merge group** flattens a group into one layer.

## Merging
- **Merge down** (Ctrl+E) merges the active layer into the one below. With several layers selected, it merges those.
- **Merge visible** and **Flatten image** (which asks before throwing away hidden layers).
- **Merging a filter layer down** bakes its filters into the layer below.

## Text layers
The **Text tool (T)**: click the canvas to type, click existing text to edit it, drag text to move it. Esc or Ctrl+Enter finishes typing.
- **Font:** hover a font to preview it. **+ Add font file…** loads your own fonts (TTF, OTF, WOFF).
- **Style:** size, bold, italic, alignment, line height, letter spacing.
- **Colour:** fill colour, plus an outline with its own colour and width.
- **Rasterize:** text stays editable until you paint, filter or merge it; then it turns into pixels, and **Undo** brings the editable text back. Rasterize does this by hand.
- **PSD:** PSD files store text layers as pixels.

## Live gradient layers
The Gradient tool makes a layer you can re-edit: drag its ends, change its colours. See [Fills and gradients](Fills-and-gradients.md).

## Layer rows in multi-map documents
Each row lists which maps the layer has content in (Col, Rgh, Met, Hgt, Nrm, AO, Emi, Opa). If the layer is empty in the map you're viewing, the row says **empty in …**.
