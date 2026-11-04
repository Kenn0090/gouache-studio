# The new viewer

The new viewer is a second window that draws your model straight on your graphics card. It is a test: the normal 3D view stays as it is, and you can switch the new one off at any time. It is in the desktop app only.

## Opening it

In 3D Paint, press **New viewer** in the bar above the 3D view. The button lights up while the window is open. Press it again, or close the window, to go back. The window opens where you left it last time.

## What it shows

- One material per texture set, with the colour, normal, roughness, metal, occlusion and glow maps you have painted.
- Your environment, sun and tone settings from the 3D view. Change them in the app and the window follows.
- Each texture set's shader: Standard, Skin, Brushed metal, Velvet, Toon, Cel, Spec/Gloss, Panner and Retro, with their outlines.

## How close it is to the 3D view

I compared the two on the same model, material, camera and lighting. Colours and brightness agree within a few percent, normal maps light the same way, and these carry over: the environment, your light rig, the studio fill and rim lights, the Unlit and Metal views, orthographic view, hidden texture sets and the background colour. Edges against the background are smoothed.

Wireframe, selection tint, mirror guides, the mask and mesh map views (C and B keys) and cut-out see-through materials (parts with less than half opacity disappear) work in the new viewer. The stencil you use for projection painting shows over the model too. The shadow floor (Studio lighting) shows, with the model's ray-traced shadow on it (ray tracing switches on in the window while the floor is on, and the floor's colour is blended where the shadow falls). With a selection tool armed, the part under the pointer lights up. Height depth (displacement) moves the surface in the window too (turn the 3D view's Detail up for smoother results). The Shader panel's post processing works in the window too (bloom, depth of field, sharpen, colour grade, vignette, chromatic aberration, film grain and the filter looks). Ambient occlusion is left out because the ray tracing already does it. The 3D view's "Cut out transparent areas" switch decides whether parts under half opacity disappear. Like the normal 3D view, there is no blended see-through. The sun is only on when the environment is off (or its sun slider is up), as in the 3D view, so ray-traced sun shadows need that too.

The Bake and Convert tabs can use the new viewer too: their 3D bar has a **New viewer** button, and the window shows the model with the baked or converted maps. The Bake tab's high-poly (See-through / Only) shows in it, and so does the Bevel preview, on the model and on the high-poly shown on its own (rounded edges: it is made for the window's view once the view stands still for a moment, so it returns a moment after you stop turning). With a tab's paint-on-model switch on you can paint in the window in the Paint and Bake tabs too.

More that carries over: UDIM tiles (each tile's texture set on its own part of the model), the mirror copies of the brush ring, the decal landing ring, and the Bake tab's Unfold slider. The window also follows what you change while it is open: edits to the maps (filters, layer colours, material swaps), a changed shader, and a new model, texture sets or Detail.

**Known differences from the normal 3D view.** The Skin shader is a few percent darker (the two viewers light the back of the surface with slightly different maths). Big textures go to the window as a full set after each stroke. Ray-traced shadows, reflections and the shadow floor are extras that only the window has.

## Moving around

When you turn, zoom or move in the window, the main 3D view follows, so both always show the same view. The Timelapse in 3D Paint also takes its pictures from the window while it is open.

- **Alt + drag** turns the model (plain drag turns it when painting is off). Mouse wheel zooms.
- **Shift + right-drag** turns the sky.
- **F** brings the whole model back into view.
- **R** turns ray tracing on or off.
- **P** takes a picture.
- Turning the 3D view in the app turns the window as well, and the other way round.

## Painting in the window

A plain left-drag paints with your current brush. A ring shows the brush size. The app does the painting, so everything you set up in 3D Paint (brush, mirror, stencils, selections) works. If painting in the window feels slow on your computer, turn off **Paint inside the new viewer window** in Preferences › Speed. The window then only shows the model while you paint in the normal 3D view. After a stroke, Preferences › Speed shows what it cost.

## Ray tracing

Turn it on in Preferences › Speed. It adds soft sun shadows, darker corners where surfaces meet, and reflections that show the rest of the model (its colours and textures). It works on any graphics card. The picture is a little grainy for a moment and then settles when you stop moving.

Sliders in Preferences › Speed set how strong the shadows, darker corners and reflections are, how soft the sun's shadows are, and the quality (how many rounds of rays are added). A higher quality takes longer to settle.

Big models are prepared in the background the first time: the window keeps answering while it works.

## Pictures

While the window is open, **Screenshot**, **Turntable** and the **Render** window can use it (the Render window has **Render in the new viewer**). A see-through background works too: the model and its floor stay solid and the rest is transparent.

## If something is wrong

If the window cannot start, a message says why and the normal viewer is unchanged. If painting through the window is slow, a message tells you once and points at the switch above.

## Hologram, Glass, Fur, Iridescent, Car paint, Cloth sheen and Wax

These seven looks are in the **Shader** list (per texture set) and show the same in the 3D view and in the new viewer window. Their settings are in the Shader panel, each with its own set.

- **Hologram** is see-through: edge glow, scan lines that move, a bright band sweeping up, glitch slices, a pulsing edge, a flicker and a soft body glow. It is blended over what is behind it.
- **Glass** bends the sky and shows the model's own back parts through it. Use the normal map for ripples. It doesn't bend other objects behind it.
- **Fur** grows strands in layers out of the surface. The base colour map colours it; the tip colour fades in at the ends. Wind moves it.
- **Iridescent** shifts colour with the angle you look from: soap bubble, beetle shell, oil slick.
- **Car paint** is a base colour under a clear coat, with metallic flakes that sparkle as you move.
- **Cloth sheen** is a soft sheen for fabric; raise Satin streak for satin or silk.
- **Wax / marble glow** lets light travel through the surface. A baked Thickness map makes thin parts glow more.

Not yet: ray-traced reflections don't see these looks. The engine exports do have them: see Files and export.

## Halftone cel and Ink toon

- **Halftone cel** turns the light into a few flat colour steps and makes the edge between steps out of comic-print dots. Shadows get warmer and more saturated (set the tint and how much it counts), the top step can have a white highlight, and a rim light catches the edges. The dots are on the model's surface, so they follow its texture layout. An outline is optional.
- **Ink toon** has hard-edged shadow shapes in a cool colour, a coloured rim light (Fresnel) and an inked outline. The outline is either a darker version of each surface colour or one colour you pick, and **Hand-drawn wobble** makes its width vary like a pen line.

Like the other new looks, these go to the engines too (see Files and export).
