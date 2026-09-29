# Gouache Studio wiki

Gouache Studio is a GPU-powered painting and texture app for hand-painted and PBR game art. It runs as a Windows desktop app that updates itself, and also in a browser.

## Start here
- [Getting started](Getting-started.md): installing, updates, a tour of the screen, your first document, document tabs and windows
- [Keyboard shortcuts](Keyboard-shortcuts.md)
- [Panels and workspaces](Panels-and-workspaces.md): the options bar, the dock, floating panels, workspaces, the Filter Gallery

## Painting
- [Brushes and painting](Brushes-and-painting.md): brushes, presets, colour jitter, making your own tips, Photoshop brushes, pen pressure, eraser, blend, healing brushes, clone stamp, dodge and burn
- [Layers](Layers.md): layers, groups, masks, fill layers, the right-click menu, blend modes, clipping, text, live gradients
- [Masks and effects](Masks-and-effects.md): rows under a layer's mask (paint, mesh maps, ID colours, noise, generators, filters), content effects, the live mask, mesh maps from a material
- [Smart materials, smart masks and anchor points](Smart-materials-and-anchors.md): whole folders of layers or masks saved to reuse; masks that follow what you painted lower down
- [Shapes, arrays and layer styles](Shapes-arrays-and-layer-styles.md): shapes with bevels, repeating a layer in a line, grid or circle, drop shadows, strokes, bevels and more
- [Selections, transforms and crop](Selections-transforms-and-crop.md)
- [Rulers and guides](Rulers-and-guides.md): rulers in pixels, inches or centimetres, guides, snapping
- [Fills and gradients](Fills-and-gradients.md)
- [Cage painting and symmetry](Cage-painting-and-symmetry.md): paint through a cage onto slanted or curved shapes; mirror and radial symmetry

## Texture maps
- [Maps and PBR](Maps-and-PBR.md): base colour, roughness, metallic, height, normal and more; the Maps panel; painting several maps at once
- [Convert tab](Convert-tab.md): CrazyBump-style map making from a photo or another map
- [Brush tab](Brush-tab.md): draw your own brush tips on a canvas of their own
- [Converters and filters](Converters-and-filters.md): make one map from another; every adjustment and filter, including the Embroidery patch
- [Textures, decals and the material library](Textures-and-decals.md): grunge maps and textures, decals on the model, ready-made materials (and who made them)
- [Filter layers](Filter-layers.md): filters you can change later, smart filters, live converters, pattern layers

## 3D
- [3D Paint](3D-Paint.md): the 3D Paint tab. Paint on a model with texture sets, mirror and radial painting, stencils, selections on the model, materials, baking mesh maps and project files
- [3D view](3D-view.md): see your textures on a model while you paint; HDRI lighting, shaders, ray-traced renders, screenshots and turntables
- [Baker](Baker.md): the Bake tab. Bake normal, AO, curvature and more from a high-poly model, watch it on the model, and paint skew and offset fixes
- Painting on the model: see [3D view](3D-view.md#painting-on-the-model)

## Animation
- [Animation, flipbooks and sprite sheets](Animation.md)

## Files
- [Files, saving and export](Files-and-export.md): .gouache documents, PSD, image formats, texture export for Unreal, Unity, Godot and Blender (your own packed presets, the model as .glb or .obj, sending straight into the engine or Blender), models that update when their file changes, sprite sheets

## Settings and help
- [Preferences and performance](Preferences-and-performance.md): engine quality, smaller files, themes (rounded or sharp), shortcut hints and the shortcut helper, autosave countdown, previews, memory
- [Troubleshooting and FAQ](Troubleshooting.md)

## Roadmap
| Phase | What | Version |
|---|---|---|
| 0 | Desktop app, self-updates | 0.1 |
| 1 | Selections, transforms, crop, fills, gradients, dodge/burn, flipbooks | 0.2–0.5 |
| 2 | Maps in documents, engine texture export, .gouache files | 0.6 |
| 3 | Converters and filters | 0.7 |
| 4 | Filter layers | 0.8 |
| 5 | 3D view | 0.9 |
| 6 | Baker | 0.10 |
| 7 | Cage painting and symmetry | 0.11 |
| 8 | Bake tab, painting on the model, skew and offset painting | 0.12 |
| 9 | Convert tab (CrazyBump-style map converter) | 0.13 |
| 10 | Colour jitter, keyboard shortcuts, themes, brush tips, pictures into masks, Tile filter | 0.14 |
| 11 | Brush tab | 0.14.1 |
| 12 | Specular/Gloss workflow | 0.15 |
| 13 | New layout: options bar, tabbed dock, floating panels, workspaces, Filter Gallery | 0.16 |
| 14 | 15 new filters (glass, print, photo and artistic looks), Y2K gradient maps | 0.17 |
| 15 | Faster baking, memory and disk settings, bake tabs, reworked curvature, bakes as layers | 0.18 |
| 16 | Shapes with bevels, Array tool, layer styles | 0.19 |
| 17 | Fill layers, own canvas for Bake and Convert, bake export, right-click layer menu, resizable dock | 0.20 |
| 18 | 3D Paint tab (texture sets, Substance-style layers, mirror, stencils, selections) | 0.21 |
| 19 | Material layers and the Materials tab, triplanar, mask mode, bake to 3D Paint per material, ID from vertex colours/polypaint, floating dialogs, History, lazy mouse; Material panel, mesh maps in materials and masks, mask tools and ID colour masks, Substance-style Levels (0.22.2) | 0.22 |
| 20 | Masks and effects: rows under a layer (paint, mesh maps, ID colours, direction, gradients, noise, generators, filters), content effects, Properties panel, live mask, mesh maps from a material | 0.23 |
| 20b | Planar and spherical projections, projection gizmo and UV frame | 0.23.1 |
| 21 | Smart materials and smart masks, anchor points, baking inside 3D Paint, healing brushes, clone stamp | 0.24 |
| 22 | Welcome screen, autosave, recent files, per-tool brushes, shape corner bevels, shortcut categories | 0.25 |
| 23 | HDRI lighting, shaders per texture set, ray-traced view and renders, screenshots, turntables, high-poly in the Bake tab | 0.26 |
| 23b | Polish from testers: no accidental reloads, rulers and guides, layer locks, New document presets, colour wheel/sliders/swatches, shortcut helper, sharp theme, faster big canvases, autosave countdown | 0.26.1 |
| 23c | Document tabs, and documents in windows of their own | 0.26.2 |
| 24 | Your own export presets, the model with its textures, Send to Blender/Unity/Godot/Unreal (+ Blender add-on), model updater, Warp / Slope blur / Distort, stretchable panels, stickers from Paint, materials from downloaded textures or the Convert tab, drag materials onto layers, autosave for every tab | 0.27 |
| 25 | Textures panel (photo grunge, generated, yours), Decals, materials library (ambientCG), Embroidery patch, smaller files, engine quality, Help menu, Height depth fixes, animation shortcuts | 0.28 |
