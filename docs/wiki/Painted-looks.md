# Painted looks: Stylize and Hand-painted layers

Two layers that act on **every map at once** (colour, roughness, metallic, height, normal). Both are in **Layer › New** and in the right-click menu of the Layers panel. Each sits on top of the stack and changes everything below it. Its opacity, blend mode and mask work like any layer.

## Stylize layer (painted strokes)

Repaints everything below as brush strokes that follow the shapes in the picture. The colour, height and normal share the same strokes, so the paint catches light, and the roughness is evened out along them.

- **Looks:** Gouache, Oil, Thick paint, Soft wash, Watercolour, Comic, Pastel, Chalk, Charcoal.
- **Strokes:** size, flow, edge keeping, length.
- **Paint:** bristles, colour variation, canvas grain.
- **Relief:** paint relief (height) and normal bend.
- **Amount** 0 leaves the picture as it was.

## Hand-painted layer

Paints a hand-painted look from the **shape of the model**, the way stylized game textures fake their lighting. No real light is used, so it stays put when you turn the model or change the lighting in the viewer.

What it reads, best first:

1. The baked mesh maps of the texture set (World normal, Position, AO, Curvature, Thickness). Bake them in **Bake mesh maps**.
2. The model itself (3D Paint), when a map is not baked.
3. In the Paint tab: the document's own maps below the layer (normal, AO, curvature), or the picture's light and dark (**Shape from the picture**).

Groups (each folds open):

- **Colour:** its own base colour, or **the layers below** (paint the light over a polypaint or a bake).
- **Light direction:** Top, Front, Left, Right, Back, Bottom, or any height and turn. Top uses the green of the world-space normal, the usual trick for fake lighting. **Show the directions** shows the normals in colour, so you can see which parts face which way.
- **Shadow and light:** shadow colour and softness (multiplied), light colour (overlaid), and **Form light**: the normals laid over the colour in grey, as Overlay or Linear add.
- **Top and bottom:** a light colour at the top of the model and a dark one at the bottom.
- **Crevices (AO)**, **Edges and cavities**, **Thin parts** (needs a Thickness bake) and **Glow from below**.
- **Highlights:** a ring of 1–8 painted lights with colour, tightness, height and turn.
- **Colour variation:** soft blotches and a second hue.
- **Brush strokes:** stamped with any brush from the Brushes panel (pick it in the list), or **Import a stroke picture…** (dark or opaque is paint; it is also added to Custom tips). Size, variety, density, turn, **Follow the forms**, keep detail, leave some out, stay inside colour edges, opacity.
- **Roughness** and **Metallic:** a value, partly taken from the colour (darker is rougher).
- **Finish:** multiply and overlay push, saturation.

Presets:

- **Game materials:** Old wood, Steel, Gold, Bronze, Copper, Oxidized copper, Bone, Rock, Marble, Ice, Moss, Jade, Obsidian.
- **Skin and character:** Fair skin, Warm skin, Dark skin, Orc skin, Painted skin, Cloth, Leather.

**Painted skin** paints over the layers below. It is for a polypainted or baked face: a soft form light, low contrast, dry-brush strokes. Keep the lighting subtle: the real lights in the viewer or game still do the shading.
