# Artist feedback and update plan

Source: Kenn's requests and Georgian Avasilcutei's feedback in this conversation. Keep this list when selecting subsequent work; completing one release does not complete the backlog.

## Priority 1: Painting correctness and interaction

- UV seams: continuous 3D brush coverage, smart-material seams, and blur across adjacent UV islands. This batch adds mesh-connected Gaussian and box blur within the current texture set for a single 0–1 UV tile. Other filters, mip padding, cross-set behavior, tiled UVs and more complex imported meshes still need work.
- Wacom Intuos Pro pressure: coalesced sample handling shipped in 0.51.7; hardware verification remains outstanding.
- Lazy mouse: stop the abrupt release tail in 2D and 3D. Continue evaluating tether feel and stroke latency.
- Layer performance: investigate the reported PSD with 22 layers and Multiply/Burn blend modes. The friend's PSD must be located or provided before claiming a diagnosis.
- Mask filter performance: profile and optimize masks with many filter rows at 4K and above; preserve full-resolution final output.
- Texture clicks should add a picture to the selected mask; clicks with a colour thumbnail selected still create a layer.
- Weld brush should paint directly onto an ordinary pixel layer, without automatically creating a fill layer or mask. Editable weld paths also regenerate ordinary pixel channels from their saved recipe, with disposable coverage used only during rendering.
- Weld appearance: compare overlapping rounded/crescent bead profiles and spacing against the supplied examples, including seams and grazing-light views. Do not equate a procedural preview thumbnail with validated model appearance.
- Live path controls: weld sliders update selected surface paths (0.51.11); verify undo, reopening and ordinary brush-to-path behavior.

## Priority 2: Clear workspace and navigation

- Separate saved layouts per mode, including when both modes use the same preset. Closing panels in Paint must not close them in 3D Paint.
- Simplify the workspace dropdown to layouts relevant to the current mode, while retaining custom 2D layouts. Selecting a panel layout must not replace the Paint canvas with a model.
- Dedicated shelf tabs in order: Materials, Textures, Decals, Environments, Projects, Mesh Maps, Tools. Shipped in 0.51.11; retain this order.
- Consistent hover tooltips across controls and icons.
- Symmetry independent of canvas rotation, with a local option and draggable symmetry plane.
- Clear radial symmetry controls and enabled visuals.
- Magnifier tool on Z shipped in 0.51.7; continue verifying navigation shortcuts.
- Brush drag/drop onto the editable path tool, including assigning tips to an existing path.

## Priority 3: Materials and authoring features

- Proper triplanar projection, following the referenced Visual Tech Art video after inspecting it.
- Mesh-map-influenced smart materials.
- Grunge mixer.
- Numerical input beyond slider bounds: dragging stays within the displayed range, but supported typed values such as 200% must remain valid.
- UDIM support: shared UDIM addressing and per-material UV-tile detection are in progress. Tile-specific texture storage, projection/painting, viewport sampling, project persistence and export remain to be implemented and verified together.

## Parked at Kenn's request

- 8K document option and resolution changes that rebuild from retained source recipes/strokes rather than repeatedly resampling already-downscaled textures.
- No JS-to-C++ rewrite is needed to address the reported artist issues.

## Release verification

Merge consent includes publishing desktop updates. A merged PR alone is not an installed update: verify the Windows build, installer assets, signatures and latest.json before reporting availability.
