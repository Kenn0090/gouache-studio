# Textures, decals and the material library

## Textures panel
The **Textures** panel (next to Materials) holds grunge maps and textures you can use anywhere.

- **Photo grunge:** 13 real scans: Streaks, Water rings, Specks, Stains, Drips, Splotches, Spatter, Scratches, Dirt, Dust, Fingerprints, Smears and Leak streaks. They are grey pictures where white shows the marks.
- **Generated:** 12 seamless patterns made by the app: Clouds, Cells, Cracks, Grain, Ridges, Streaks, Fine scratches, Blotches, Dots, Weave, Bricks and Pits.
- **Yours:** **Import…** pictures (PNG, JPG, WebP, TGA…) or a **.gtex** pack. They are kept on this computer. **Export pack…** saves all of yours in one .gtex file to share.

Click a texture to see what it can do:
- **Add to the mask:** a Picture row in the selected layer's mask. Its size, turn and invert are in Properties.
- **Material channel:** with a material layer selected, use it as the base colour, roughness, metallic, height, AO, emissive or opacity.
- **New layer:** a layer filled with the texture. Try Multiply or Overlay.
- **Stencil** (3D Paint): paint through it onto the model.
- **Brush tip:** a custom brush tip made from it.

## Decals (3D Paint)
The **Decals** panel has bolts, rivets, cross and slot screws, a vent grille, a round vent, a warning label, hazard stripes, a serial plate, a crack, a bullet hole and scratches.

1. Click a decal. It lights up.
2. Click the model. The decal lands there, facing the surface. Keep clicking to place more; press **Esc** to stop.

Each decal carries colour, height (so the normal shows its shape), roughness and metal. It is its own layer, a sticker projected onto the model, so you can move, turn and scale it with the gizmo. Right-click › **Convert to pixels** fixes it in place.

- **Size** sets how big new decals are, compared with the model.
- **Tint with the foreground colour** colours new decals.
- **Import your own…** turns a PNG with transparency (a logo, a label) into a decal.

## Materials library
The Materials panel's **Library** has 23 ready-made materials: red, brown, black and quilted leather; worn steel, dark iron, brass, blued steel, brushed metal, rusty painted metal and rust; dirt, dry mud and gravel; linen, wool, check fabric and canvas; dark and pale wood; concrete, rubber and plastic. Click one to add it as a material layer, or drag it between layers. Each loads the first time you use it. (The browser version downloads it from the internet.)

**Your own built-in materials:** any .gmat file (Materials › ⤓ export) placed in the app's `materials` folder shows in the Library too. To ship one with the app, put it in `assets/materials` in the project.

## Credits
The photo grunge and the library materials come from **[ambientCG](https://ambientcg.com)** and are CC0 (free to use for anything, no credit required). We credit them gladly:
- Grunge: Surface Imperfections 003, 006, 007, 008, 010, 011, 012, 013, 015, 019; Fingerprints 002; Smear 002; Leaking 016A.
- Materials: Leather 037, 030, 026, 034C; Metal 055A, 046B, 048A, 032, 009, 053C; Rust 009; Ground 112, 103; Gravel 043; Fabric 061, 030, 083; Carpet 016; Wood 051, 092; Concrete 034; Rubber 004; Plastic 013A.
