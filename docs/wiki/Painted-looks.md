# Painted looks: Stylize and Hand-painted layers

Two layers that act on **every map at once** (colour, roughness, metallic, height, normal). Both are in **Layer › New** and in the right-click menu of the Layers panel. Each sits on top of the stack and changes everything below it. Its opacity, blend mode and mask work like any layer.

## Stylize layer

Our own version of the stylization filter in Substance Painter. On top are master sliders: **Stylization** (how much of all of it), **Brush strokes**, **Smoothness**, **Colorize**, **Gradient**, **Baked lighting**, **Edges and cavities** and a **Random seed**. Each has a group below with its settings:

- **Brush strokes:** the tip (any brush from the Brushes panel, or **Import a stroke picture…**), Strokes amount, Strokes scale, Scale random, Stroke length, Strokes follow surface, Strokes rotation, Rotation random, Projection hardness, **Normal threshold** (a stroke does not wrap around onto a side facing another way), Colour per stroke. The same strokes land in every map.
- **Brush strokes effects:** height relief, normal relief, darker stroke edges, roughness variation.
- **Smoothness:** a radius and an amount for each map.
- **Colorize:** hue shift, saturation, brightness, contrast, flat tones.
- **Gradient:** 1 or 2 colours, each with opacity and blend mode (Normal, Multiply, Screen, Overlay, Soft light, Add), horizontal and vertical rotation, invert, offset, contrast. It runs across the model (baked position, else the model, else the top of the picture).
- **Baked lighting:** how much of it the strokes carry (**Brush strokes in lighting**), diffuse intensity, colour, radius and contrast, specular intensity, colour, radius and contrast, and the light's horizontal and vertical rotation. It uses the baked world normal.
- **Edges and cavities:** edge colour, opacity and width, cavity colour, opacity and width, ambient occlusion, from the baked curvature and AO.
- **Helpers:** show the strokes' relief, the normals the layer reads, or its AO / curvature / thin-parts map.

Presets: Painterly, Smudges, Thick strokes, Soft paint, Sketchy, Comic. **Restore defaults** puts every setting back.

## Hand-painted layer

Paints a hand-painted look from the **shape of the model**, the way stylized game textures fake their lighting. No real light is used, so it stays put when you turn the model or change the lighting in the viewer.

What it reads, best first:

1. The baked mesh maps of the texture set (World normal, Position, AO, Curvature, Thickness, Normal). Bake them in **Bake mesh maps**. The fine detail of the baked normal map and of normals painted below is added on top (**Detail from normal maps**). The line at the top of the settings says which maps it is reading.
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

## Spec/Gloss and saving

Both layers work in Spec/Gloss projects. The Hand-painted layer then makes **glossiness**, and with **Metal parts** on, a coloured specular and a dark diffuse, the same way the app converts between workflows.

To keep a look, right-click the layer › **Save as smart material…** (3D Paint). It is listed in Materials › Smart materials; adding it puts the same layer back on top of the stack, so it still works on everything below. The Hand-painted presets are listed there too.

## The settings window

The settings open in a wide window: the groups (Presets, Colour, Light direction, Shadow and light, … or Main, Brush strokes, Smoothness, … for Stylize) are listed down the left; click one to see its settings on the right. The window remembers the group you were on.

## Undo and defaults

- While a layer's settings are open, **↶ Undo** and **↷ Redo** (or Ctrl+Z, Ctrl+Shift+Z) step through your changes one at a time. After **Done**, Edit › Undo takes the whole edit back in one step.
- Every slider has a small **↺** button that puts just that slider back to its default. It hides while the slider is already at the default.
- The Lights window and the Bake tab's Lighting page have Undo and Redo too.
