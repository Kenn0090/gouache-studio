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
