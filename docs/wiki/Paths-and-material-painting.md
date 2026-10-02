# Paths and material painting

## Material brush

In the **Materials** shelf, select a single material and press **Paint material**. Paint on the 2D canvas or the model in 3D Paint. The material brush applies its enabled colour, roughness, metallic, height, normal and other channels together. Missing document channels are added automatically. Smart materials and smart masks remain layer stacks; choose a single material for this brush.

Each material gets a **Paint · material name** layer. More strokes with the same material and tiling reuse that layer. Choosing another material or tiling starts another layer. **Material tiling** is in Tool settings; brush size, opacity, hardness, flow and tip controls work as usual. Select a layer’s colour thumbnail to begin; an ordinary mask thumbnail remains a mask-editing target.

The layer keeps the material recipe and original source images, plus one shared stroke mask. This avoids expanding a separate document-size image for every channel. Undo removes the stroke from every channel together. Edit the material’s channels through its material settings; its coverage stays painted. Height follows the document’s usual additive blending unless you change that channel’s blend mode. Save and reopen the document or 3D project to retain the recipe and strokes.

## Pen (P)

Choose **Pen** in the toolbar on the flat canvas. Click to add corner points. Click and drag to create paired Bézier handles. Click the first point to close a path with three or more points. **Enter** finishes; then click a point or handle to select and drag it. **Alt+drag** a handle moves it independently of its pair.

Tool settings has:

- **Path only**, **Brush stroke**, and **Fill**. Fill closes a path with three or more points.
- **Width**, **Hardness**, **Opacity**, and **Point pressure**. The path captures the current brush tip when created.
- **Corner**, **Smooth**, **Insert point after**, and **Delete point** for the selected anchor. Delete/Backspace also removes a selected anchor.
- **Path colour** or **Use selected library material**.
- **Make selection** for a closed path, **Duplicate path**, and **Delete path**.

Use **New path** for another path. Each path owns a layer and is listed in Tool settings. Its geometry, material, tip and coverage save with the document. Undo/redo retains editable points and regenerates the painting.

## Surface Path in 3D Paint

Choose **Surface Path** in the 3D Paint toolbar. Click the model to place points; drag a new point for curve handles. Enter finishes. Click existing anchors or handles to edit. **Alt+drag** rotates the model as usual.

Width uses the model’s units, so it stays consistent when zooming. Hardness, opacity, per-point pressure, Corner/Smooth and point insertion are available in Tool settings. Choose a colour, or select a library material in the shelf and press **Use selected library material**.

The path is attached to the mesh and painted into the texture set’s UVs. It crosses separate UV islands and keeps its position when the camera rotates. Geometry and coverage save in the 3D project. If the mesh is replaced by different geometry, existing paths retain their saved appearance; create a new path for the replacement mesh.

This version implements **Paint along path**. Ribbon, Filled-path, Erase-path and Smudge-path modes are not included.

## Clear layer

The eraser-shaped **Clear layer** button in Layers clears all painted channels together. On a material it removes coverage while retaining the editable recipe. On a path it clears the rendered stroke/fill while keeping the editable geometry. Undo restores the appearance.
