3D Paint feels more like Substance Painter: a Material panel, mask tools and ID colour masks.

- **Material panel** beside Colour: it edits the selected material layer live (no more pop-up window). Each change is one undo step once you pause.
- **Mesh map** in materials: any channel can use one of the texture set's baked maps (AO, curvature, thickness…).
- **Right-click a layer › Mask from mesh map**: the mask becomes the baked AO, curvature, thickness or height.
- **Mask mode** (Alt+click a mask):
  - Nothing paints until you press **Paint**.
  - **Box**, **Lasso** and **Polygon** select what you see on the model. Drag inside the shape to move it.
  - **ID colour**: click the model to pick colours of the baked ID map; they turn white in the mask. Tolerance, Softness and Invert, and it stays editable.
  - Clicking the layer's own thumbnail leaves mask mode.
- The **column beside the 3D view** (Colour, Material, Brushes, Materials) can be rearranged: drag tabs out of it or into it.
- **Bake tab:** every bake has its own tab (World normal, Position and ID replace "Other").
- **Levels** has a simple layout like Substance Painter's: drag the handles under the histogram and on the output bar. Sliders are one click away.
