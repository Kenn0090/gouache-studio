Filter layers, new blurs, and fixes.

**Filter layers.** Filters and adjustments you can change at any time:
- **+ Filter** in the Layers panel, or **Layer › New filter layer…**, adds a layer that changes everything under it. It holds a **stack** of filters that apply from top to bottom. Each filter can be turned off, reordered or removed.
- **Double-click the thumbnail** of a filter layer to change its filters. It has its own opacity, blend mode and mask like any layer.
- **Clip it to a layer** ("Clip to layer below") and it changes only that layer, like a smart filter. Painting on that layer shows the filters as you paint.
- **Every filter dialog has "Keep editable".** It adds a filter layer clipped to the layer you were filtering, instead of changing its pixels.
- **Patterns** (clouds, cells) can live in a filter layer, so you can re-edit them later.
- **Live converters.** Tick **Keep live** in Curvature, AO, Height, Normal or Roughness, or add them to a filter layer. The result updates itself when you paint the source map. Slow filters (painterly, oil paint, lens blur, surface blur, live converters) catch up when each stroke ends, so painting stays smooth.
- **Merge down** bakes a filter layer into the layer under it.
- **.gouache files** keep filter layers editable. **PSD export** turns them into their pixels.

**New:**
- **Blurs:** Box blur, Radial blur (spin or zoom), and Lens blur, a camera-style blur where bright spots bloom into round or six-sided highlights.
- **Maps › Curvature from normal** and **Ambient occlusion from normal.**

**Fixed:**
- **The Normal map row could not be edited.** Clicking it, or making a layer with *Normal from base colour*, showed the finished normal while you kept painting base colour. It now switches to the Normal map properly.
- **Easier to find converted layers:** layer rows now show which maps each layer has content in, or "empty in …" for the map you're viewing.
