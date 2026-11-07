## 0.95.6

- **21 new smart materials and 24 new smart masks** (weapons, sci-fi, fantasy, stylised, staples; wear, weather, stylised, technical); the older ones break up unevenly and catch the light.
- **12 mixed grunges** in Textures › Mixed.
- **Delete every layer:** a default grey material (3D Paint) or plain canvas (Paint) is left in their place.
- **3D Paint:** Ctrl + drag smooths the paint (Shift + click is only for straight lines again); flow and rotation moved to Ctrl + middle-drag.

## 0.95.5

- **3D Paint:** Projection section (alignment incl. UV, backface culling angle, size space), Polygon fill tool (face, triangle, loop, UV island), Shift + drag smooths like 3D-Coat, instant colour picking.
- **Brush:** [ and ] show the outline at once and speed up when held; tool tooltips show the key for the current tab.
- **Wider edge and cavity masks** like Painter's (wear and dirt spread from edges and grooves; faint curvature maps work).
- **Wireframe opacity**, smart material/mask thumbnails on the Material preview model (masks in black and white).
- **Fixed:** Quick mask on and off left the model tinted orange.

## 0.95.4

- **Lighting bake preview:** on the Bake tab's Lighting page the model shows your lights and their shadows live, before you bake.
- **Painting on the model:** strokes no longer land on hidden parts behind the one you paint (such as the neck under the chin).
- **L** turns left–right symmetry on and off (Mirror X in 3D Paint).

## 0.95.3

- **FBX import:** text (ASCII) FBX meshes can now be imported, including the Dragon model.
- **Cancel mesh imports:** use Stop on the loading bar to cancel a large model import.

## 0.95.2

- **Smaller 4K materials:** grey maps kept at 2K inside 4K materials (a switch, on by default), and grey material pictures use a quarter of the graphics memory.
## 0.95.1

- **Up axis:** choose Auto / Y up / Z up when importing (Auto reads the file), 90° turn buttons, and exported OBJ/FBX follow the engine (Z up for Unreal and Blender).
## 0.95.0

- **UDIMs:** one texture set per material with its tiles inside; strokes, fills and blurs carry across tiles with no seams; export writes one picture per tile.
- **Instance to sets:** right-click a material to link copies of it into other texture sets; change one and the others follow.
## 0.94.10

- **Dense models:** hovering, painting and turning big models is much lighter (brush outline made once, big models drawn lighter while turning, shadow redrawn after the stroke).
- Fixed a stray "null" under the Model list in 3D Paint.
## 0.94.9

- **Add layer** in 3D Paint makes a regular paint layer again.
- **Ignore polygroups from ZBrush** tick in the New 3D Paint project window (on by default).
- **Don't save** moved to the bottom row of the save question.
- **Ray traced view** no longer crashes big views on fast cards; the 3D view may run smoother on some cards.
## 0.94.8

- **Stumpy G:** a gentler stump blend that blurs smoothly, without steps. Any soft blend can switch on **Smoother blur** in the Blend panel.
## 0.94.7

- **The new viewer is set aside** for a future update (its button and settings are hidden).
- **Drop several pictures at once** on the canvas (one layer each) or on a material (each to the channel its name says).
- **Hand-painted materials** show their settings as soon as you add or select them.
## 0.94.6

- **Hand-painted materials:** the Hand-painted presets are now materials in the Materials panel: click or drag them on, and they work like any material (with roughness, metal and height), or switch them to paint over the layers below.
- **New layers in 3D Paint** are a plain 50% grey material.
## 0.94.5

- **Fur:** random placement, length and direction, patches, a Fur mask you can paint or take from a picture, and a pattern picture that shapes the fur.
- **Ctrl+D** duplicates the layer in 3D Paint.
## 0.94.4

- **Game engines:** models sent as FBX now open in Unreal and Unity, the live link is added by itself on the first send (Unreal: restart once), and the model gets its materials in Unreal and Unity.
- **New viewer: strokes show at once.** The window draws your brush mark itself as you paint, then the finished paint replaces it. Turning the model in the window is also lighter.
## 0.94.3

- **Unity, Godot and Unreal exports fixed:** the Unity shader and its material script had errors (which also stopped the live link), two Godot material files would not load and the Godot live link did not start, and the Unreal setup script left wires unconnected. Send again and the broken files from before are replaced.
## 0.94.2

- **New viewer fixes:** the window can be closed and opened again (before, it only opened once), painting in it is lighter (the main 3D view no longer redraws on every pen move), and reflections use each material's normal map and roughness and metal pictures.
- **Faster start:** the app no longer loads every installed AI model and sky file into memory at start just to check they are there.
- **Brow** is rebuilt from your videos: a wide loaf of fine vertical fibres, each with its own soft pastel tint.
## 0.94.1

- **Heavy Paint style brushes, rebuilt from your recordings:** Oil bristle, Oil, Fried fluff, Charcoal, Brow, Boxes, Blur ice, Fan, Fan fade and Line now behave like the originals (flake-cloud and fibre tips, damascus marble that softens when you lift, a lasso-style fan fill, a smear with Pull, and a Line that works like MS Paint's line tool). New brush settings: Grain size, Soften at end and Pull. The shaded Oil bristle stays as Oil bristle 3D.
- **Brush tools:** Smoothing and Correction on the main bar, a brush tip picker, a resizable brush list, a better Blend brush (Soft blend and Wet smear), Line blend, and upgrades to the Mixing brush.
- **New viewer:** the main 3D view now follows when you turn, zoom or move in the window. Screenshots, turntables and the 3D Paint timelapse use it, including see-through backgrounds. Ray-traced reflections show the new looks and a denoiser clears the grain faster. Painting in the window is lighter.
- **Nine new looks** for the model (Hologram, Glass, Fur, Iridescent, Car paint, Cloth sheen, Wax, Halftone cel, Ink toon), also sent to Unity, Godot and Unreal.
- **Content window and a smaller installer:** File › Content… lets you choose bigger Library pictures, skies and the AI add-ons, and each release also offers a smaller installer.
- **Smaller changes:** real-size units and UV filtering for projected pictures, custom path handles, more imported brush detail, more examples on the welcome screen, and Unreal data files that no longer get imported as tables.
## 0.94.0

- **New viewer (test):** Preferences › Speed › New viewer opens the model in its own window, drawn straight on your graphics card, with your environment, sun and each texture set's shader (Standard, Skin, Brushed metal, Velvet, Toon, Cel, Spec/Gloss, Panner, Retro). In 3D Paint you can paint right in it (left-drag paints, Alt + drag turns the view) and see a brush outline. Optional ray-traced shadows, darker corners and reflections work on any graphics card. The normal viewer is unchanged.
- **Engine projects and live links:** sending to Unity, Godot or Unreal remembers the project, shares one master shader per look, offers variants, can update all assets, and can install a small plug-in that sets materials up in the editor.
- **Paths:** carry on from an open end, Alt+click adds a point, paths light up under the pointer, and you can change the path and wireframe colours in Preferences.
- **Soften normals, skew painting and the cage** follow-ups in the Bake tab.
