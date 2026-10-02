# Gouache Studio 0.47.1

- Faster 3D painting with studio shadows: colour strokes over opaque materials reuse the shadow map. Inactive key lights skip shadow work; alpha and displacement strokes update shadows less often while dragging and refresh on release.
- Edit baked or imported mesh maps from Maps using **Edit in 2D**. A marked layer opens at the map's original resolution; right-click it and choose **Send to 3D Paint as mesh map** to update materials and generators. Links survive project saves and texture-set renames, and returning a map supports undo/redo. Height maps keep 16-bit precision.
- Heal now samples visible layers by default, so 3D painting can repair a material from a separate paint layer. **Sample visible layers** can be disabled to sample only the active layer. Spot healing and Alt-click source healing both work, with adjustable opacity.
- Paint and 3D Paint brush cursors show only the brush outline, without the centre crosshair.
