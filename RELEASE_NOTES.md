3D Paint works more like Substance Painter: materials, mask mode, baking straight into texture sets.

- **Material layers and the Materials tab.** Fill layers are now full materials: base colour, roughness, metallic, height, normal, emissive and opacity.
  - Each channel is a colour, a value or an image (tile and turn it).
  - **Height makes bump detail**, with a strength slider.
  - **Triplanar** lays images over the model with no UV seams.
  - Double-click a material layer to change it later.
  - **Save to Materials** keeps a material (with its images) for other projects. The new **Materials** tab (beside Brushes) adds one with a click, and **⤓** exports it as a .gmat file to share.
- **Bake → 3D Paint.** The Bake tab can **bake each material separately** and **Send to 3D Paint**: the model arrives with each material's maps in its own texture set, as that set's mesh maps. The baked normal shows on the model straight away.
- **ID bakes** can take their colours from separate meshes, materials, vertex colours or **ZBrush polypaint**.
- **Mask mode.** Alt+click a mask to see it on the model in black and white. A bar offers Fill white/black, Invert, and double-click parts of the model (object, UV island, face, loop…) to show or hide them. **Done** or Esc goes back.
- **Paint › File › Send to 3D Paint** puts your painting (a logo, a decal) into 3D Paint as a flattened layer, keeping its proportions. Press Ctrl+T there to move and scale it.
- **Dialogs float.** Layer style, the Filter Gallery, materials and the rest no longer darken the window, and you can drag them by the title bar.
- **History panel** (beside Layers): click a step to go back to it.
- **Lazy mouse** (brush bar › More): the brush follows the pointer on a string, for steady lines.
- **Export textures** in 3D Paint exports **every texture set** at once. Baked AO fills the ORM/occlusion files.
- Texture sets can be **deleted**. 3D Paint uses the **Texturing** workspace and gives Paint its own back.
- The **shade strip** keeps going past its ends with the arrow keys.
- **Stencils** can be inverted (**X** over the model).
- **Preferences › Show the brush tip's shape as the cursor.**
