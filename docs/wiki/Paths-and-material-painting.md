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

## Weld brush and paths

In **3D Paint**, open **Welds** in the bottom shelf, select a preset, and drag on the model to paint freehand. **Standard weld** leaves rounded, uneven overlaps, **Narrow weld** leaves a thin seam with long swells, and **Sharp weld** leaves tight, crisp ridges.

For regular painting, open **Brushes → Welds** in Paint or 3D Paint and choose a preset. In the **Welds** shelf, **Use as Brush** loads the current weld shape into the regular Brush. It paints in your foreground color on the active paint layer or map.

Increase **Bead fusion** to fill the joins between puddles while retaining the overlap ridges. **Edge blend** tapers the height and fades the material into the surface underneath. Standard starts with both settings high. Use **Detail sharpness** to define the overlap ridges and **Smoothness** to soften the ripples across the whole bead. **Pitting** recesses small spots on the bead and **Spatter** adds raised droplets beside it. Both controls start at zero. **Weld finish → Keep underlying paint** writes only height, so the bead uses the material already on the surface. Freehand material strokes use a shared material mask.

Choose **Draw weld path** to place an editable bead on the model. Click for points, drag for Bézier handles, and press **Enter** to finish. **Ripple spacing** is a percentage of the bead width. At 30%, the distance from one ripple to the next is 30% of the width. Path ripples follow the length of the bead across UV islands in the active texture set. On bare-metal paths, **Heat tint**, **Halo spread**, and **Burn halo** control the discolored band beside the weld. **End taper** narrows and lowers the ends. The path recipe saves with the project.

For a freehand **Bare metal** weld, **Heat tint** sets the strength of the halo and **Halo spread** sets its reach. With **Heat responds to pen pressure** enabled, lighter pressure leaves a narrow gold tint and heavier pressure spreads the violet and blue bands. A mouse uses full pressure. The halo is stored on a color layer beneath the weld and shares the stroke’s undo step.

## Stitch brushes

Open **Stitches** in the **3D Paint** shelf and pick a preset. Gouache paints thread color, raised strands, recessed needle holes and roughness on a **Stitches** layer. Drag to paint a seam or click once to place a bar tack, buttonhole or darning patch.

**Stitch size** sets the size of each stitch and **Stitch spacing** sets the distance between them as a percentage of size. **Thread thickness** adjusts the strand width, **Thread height** adjusts relief, and **Needle holes** controls the strength of the recesses. **Fiber twist** brings out the plies in each strand. **Thread roughness** sets how much the thread catches the light.

Choose **Draw stitch path**, click points on the model and press **Enter** to finish. Select the path with the **Surface Path** tool to edit the curve or its stitch settings. **Puckering** adjusts the depth of folds beside the thread and **Pucker spread** sets their reach. **Seam relief** controls the groove or ridge underneath the thread on seam presets. **Stitch damage** breaks or drops stitches, **Thread fray** adds loose fibers, and **Stitch variation** varies individual stitches. **Shuffle variation** changes the pattern. Editable paths keep the random seed in the project.

## Surface detail brushes

Open **Surface Details** in the **3D Paint** shelf to paint dents, gouges, chips, corrosion pits, grime, rust or cast-metal texture. Use **Relief strength**, **Color amount** and **Roughness amount** to control which parts of the underlying material change. Lower **Spacing** to overlap dabs when dragging. Add a mask to the finished layer to control where its details show.

Choose **Sealant Bead** in the same shelf to create an editable surface path with a round, tooled, or flat profile. Tune the height, squeeze-out, gaps, and tool marks.

Click on the model to place points, drag a point to curve the path, and press **Enter** to finish. Select it with **Surface Path** to edit it later.
