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

Wireframe, selection tint, mirror guides, the mask and mesh map views (C and B keys) and cut-out see-through materials (parts with less than half opacity disappear) work in the new viewer. The stencil you use for projection painting shows over the model too. Height depth (displacement) moves the surface in the window too (turn the 3D view's Detail up for smoother results). Not there yet: soft see-through (blended opacity), and post effects such as glow. The sun is only on when the environment is off (or its sun slider is up), as in the 3D view, so ray-traced sun shadows need that too.

## Moving around

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

While the window is open, **Screenshot**, **Turntable** and the **Render** window can use it (the Render window has **Render in the new viewer**). A see-through background still uses the normal viewer.

## If something is wrong

If the window cannot start, a message says why and the normal viewer is unchanged. If painting through the window is slow, a message tells you once and points at the switch above.
