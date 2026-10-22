# Normal layers

A **normal layer** is a layer you paint bumps, dents and tilts into. It holds only a **Height** and a **Normal**, so it lays detail over your material the way a normal map does, and it works in Paint and in 3D Paint (on the model).

## Make one

**Layer › New › Normal layer**, or the wavy-line button under the layer list. If the document has no Height or Normal map yet, they are added.

## Paint it

Pick the Brush. The Brush panel has a **Normal paint** section with three modes:

- **Raise** and **Dent** push the surface up or down where you paint. The brush shape is the profile: a soft brush makes hills, a textured tip makes a textured bump. **Strength** is how high or deep it goes (100% is the whole height range). Lower Opacity or Flow for gentler strokes.
- **Direction** tilts the surface toward an **angle** (0° is right, 90° is up) by an amount of **Tilt**. The swatch shows the colour it paints into the Normal.
- **Bump (whole document)** sets how strongly height turns into normal detail everywhere.

In Paint the lit normal is shown so you can see what you are doing. In 3D Paint you see it on the model.

## Other tools work on it too

- **Smudge** drags bumps or tilts and keeps every normal the right length, in Paint and on the model.
- **Marquee, Lasso and the other selections** limit where you paint, for quick panels.
- **Gradient tool** makes a slope: drag from the low side to the high side to make a ramp of height (Raise makes it rise, Dent makes it fall).
- **Levels** (and the other adjustments) change the depth of what you have painted.
- One undo takes back a stroke.

## Convert to AO, curvature and more

Right-click a layer that has a height or a normal and choose **Convert to** ▸ **Ambient occlusion (AO)**, **Curvature**, **Edges** or **Creases**. A window opens with the settings (radius, strength, AO reach) and a small **preview** that follows them. Press **Make** and each map becomes a new layer, and is also added to the **mesh maps** (the converted maps that masks, generators and the Materials panel use). **All of them…** opens the full window.

## Good to know

- A normal layer saves with the file like any other layer.
- Painting the Normal directly (Direction) writes normals that are not renormalised where strokes overlap softly; the exported normal is always put right.
