# 3D view

**View › 3D view** (F3), or the **3D** button at the top, puts a model beside the canvas. It shows your maps live: the map you're painting updates every frame, and the other maps a few times a second. Drag the divider to resize the panel.

## Models

![The 3D view docked beside the canvas.](images/3d-view.png)
*The 3D view docked beside the canvas.*

- **Built-in:** plane, cube, rounded cube, sphere, cylinder.
- **Import:** **OBJ**, **glTF / GLB** or **FBX** (binary FBX; for text FBX, export as glTF or OBJ). Pick *Import a model…* in the model list, or **drag the file onto the app**. A loading bar shows big files coming in.
- An imported model is **saved inside your .gouache file**.
- The corner of the view shows the model's triangle count. It warns you if the model has no UVs, since textures can't map onto a model without them.

## Detail (mesh density)

![A dense plane showing the height map as real displacement.](images/3d-height.png)
*A dense plane showing the height map as real displacement.*

The **Detail** menu at the top gives the model more triangles, from Low up to ×128, so **Height depth** can push the surface out finely. Imported models are split into smaller triangles the same way. Turning up Height depth on a low-detail model raises Detail to ×16 by itself. The highest levels are heavy on older or built-in graphics chips.

## Shading
- **Lit:** full PBR, using base colour, roughness, metallic, the finished normal, AO, emissive and opacity, with a sky light and a sun.
- **Unlit:** base colour only (plus AO), the way hand-painted games usually look. This is the default for hand-painted documents.

## Toolbar

![The UV overlay on the canvas while the 3D view shows a sphere.](images/3d-uv-overlay.png)
*The UV overlay on the canvas while the 3D view shows a sphere.*

- **Model** and **Detail** menus, **Lit / Unlit**.
- **Wireframe:** shows the mesh edges.
- **UVs:** draws the model's UV layout **over your 2D canvas**, so you can see where to paint.
- **Turntable:** slow spin.
- **Settings:**
  - **Tile repeat:** repeats seamless textures across the model.
  - **Height depth.**
  - **Sun:** angle, height and strength.
  - **Sky strength**, **Exposure**, **Lens** (field of view).
  - **Background:** dark, grey or light.
  - **Cut out transparent areas:** for leaves, fences and other alpha cut-outs.
- **Pop out:** moves the 3D view into its own window, handy on a second monitor. **Dock** (or closing that window) brings it back.
- **×** closes the 3D view.

## Painting on the model
Press **Paint** in the 3D view's toolbar, then paint on the model with the Brush, Eraser, Dodge or Burn.
- The paint goes onto the active layer and the map you're editing, exactly as if you'd painted on the canvas. Other maps ticked under "Also paint", selections, masks, Lock alpha and undo all apply.
- The brush is round on screen, and its size is in screen pixels. Paint only lands on parts of the model you can see, not on the back or behind other parts. It carries across UV seams without a break.
- **Alt+drag** turns the model while Paint is on, **right-drag** moves it, and the **wheel** zooms.
- In the Bake tab, the same brush paints the skew and offset maps (see [Baker](Baker.md)).

![Painting on the model.](images/paint-on-model.png)
*Painting straight onto the model. The stroke lands in the layer on the canvas too.*

## Camera
- **Drag:** orbit.
- **Right-drag**, middle-drag or **Shift+drag:** pan.
- **Wheel:** zoom.
- **Double-click:** frame the model again.
