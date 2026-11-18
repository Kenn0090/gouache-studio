## Gouache Studio 0.98.18

- Ray-traced view: every shader now shows there. Skin has real light under the surface (ears glow against a backlight); Wax too.
- Glass bends and reflects light; car paint has clear coat and flakes; the eye has a glossy cornea and a deep iris; iridescent shifts colour.
- Velvet, cloth and fur get their soft sheen; brushed metal stretches its highlights; toon and the drawn styles keep their look with real shadows.

## Gouache Studio 0.98.17

- 3D Paint shows a progress screen while it loads and waits until it is ready.
- Ctrl + drag smooths the paint again (Smooth or Blend, set in Preferences); flow and opacity moved to Ctrl + Shift + drag.
- Big textures: while painting, only the painted channels refresh on the model; the rest catch up when you let go.
- Switching shaders no longer leaks graphics memory; Skin uses a third less memory at 8K.
- Backface culling has an Edge falloff, so paint fades out near the angle instead of a hard edge.

## Gouache Studio 0.98.16

- Big 3D Paint projects use much less memory: fixes for crashes during autosave and graphics card resets at 8K.
- Autosave saves only what changed and waits when memory is nearly full.
- Texture sets and documents you are not painting free their work pictures; grey maps in the 3D view use a quarter of the memory.

## Gouache Studio 0.98.15

- Tangent | Wrap is the camera projection again; the surface wrap is an optional beta switch under Projection.
- Curvature bake can measure each size band from the model, for real detail.
- Softer brushes in 3D Paint (16-bit stroke picture).
- Autosave waits while a file or project is loading.
- A texture-size change checks graphics memory first and refuses instead of resetting the card.
- New Help › Resize report… for finding out how each layer was brought to a new size.

## Gouache Studio 0.98.14

- Tangent | Wrap now measures the brush on the model's surface: it carries onto hidden walls and across seams.
- Curvature has seven size bands (Sharp to Huge) with a Substance default button, everywhere curvature is used.
- Edge wear has a Painter-style card (Wear Level, Grunge, AO Masking, Micro Details).
- Lights: W shows move arrows, R shows rotation rings; the sun handle is hidden until the Lights panel opens.
- Ctrl + left-drag sets flow and opacity. The brush paints only its own channels.
- A picture dropped on Converted opens in the Convert tab; one Send as layer button.

## Gouache Studio 0.98.13

- Wrap brush stays round on leaning surfaces; smoother edges where paint is hidden.
- A bar shows when the app is compiling shaders or building skies and search trees.
- Lights panel laid out like Marmoset's; lights stay off until turned on; R turns the light gizmo.
- Undo history uses less memory.

## Gouache Studio 0.98.12

- Drop pictures onto a material's Converted or Mesh map channel; send any converted or baked map as a layer.
- Paint on 3D models wraps to the rim at full strength, like Painter.
- Lights: new Orbit / Free switch, with cones and arrows showing where lights point.
- Smoother soft brushes; no Material brush in 3D Paint; smaller undo steps; start-up in 3D Paint waits for the window.

## Gouache Studio 0.98.11

- Lights in the viewport get gizmos: the studio sun can be grabbed and turned, and a selected light shows Reach, Cone and Softness handles.
- Environments: **Get more skies…** browses and downloads Poly Haven's free HDRIs (1K, 2K or 4K).
- New **Eye (iris parallax)** shader with depth, cornea bending, pupil size, dark ring, tints and presets.

## Gouache Studio 0.98.10

- Big pictures are drawn in tiles, so no single job runs long enough to make Windows reset the graphics driver (fewer crashes and black or missing patches on 8K).
- The graphics-memory warning now knows your card: a 24 GB card is no longer treated as 6 GB.
- Hue / Saturation and filter layers take mask rows too; their mask has the full mask menu. Drag a mask row onto another layer to move it.
- Mask Builder curvature blurs go across UV seams. New Perlin volume noise.
- The Export button leads the options bar. Tile sizes are set tile by tile. Paint thins out smoothly near the edge in wrap mode.
- New option: Alt + click picks the colour on the model (off by default).
