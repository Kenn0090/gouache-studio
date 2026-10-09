# Maps and PBR

A document can hold several **maps**: images of the same size that together describe a material.

| Map | What it is | Unpainted value |
|---|---|---|
| Base colour | The colour (albedo) | transparent |
| Roughness | 0% glossy … 100% matte | 50% (you can change it) |
| Metallic | 0% not metal … 100% metal | 0% |
| Height | Raised (lighter) or lowered (darker) around mid-grey | 50% (flat) |
| Normal | Surface direction detail (OpenGL: green = up) | flat |
| Ambient occlusion | How much light reaches each spot | 100% (white) |
| Curvature | Raised edges (light) and cavities (dark), a grey mask for wear and dirt. Not shown in the material; exported as its own texture | 50% (grey) |
| Emissive | Glow colour | black |
| Opacity | See-through areas | 100% |

**Templates** in *File › New document* set up the maps for you: **Hand-painted** has base colour only, **PBR** has base, roughness, metallic, height and normal. **Maps › Document maps…** adds or removes maps and sets the "unpainted value" of the grey ones. Removing a map can be undone.

Height is stored at 16 bits even in 8-bit documents, so it stays smooth.

## Specular/Gloss workflow
Documents are **Metal/Rough** by default. A **Specular/Gloss** document paints three different maps instead of Base colour, Metallic and Roughness:

| Map | What it is | Unpainted value |
|---|---|---|
| Diffuse | The colour of non-metals; black (or very dark) on bare metal | transparent |
| Specular | A colour: about 22% grey for non-metals, the metal's own colour for metals | 22% grey |
| Glossiness | 0% rough … 100% shiny (the opposite of roughness) | 50% |

- Start one with *File › New document*, template **PBR spec/gloss**, or switch any document in **Maps › Document maps…** under **Workflow**.

![Workflow in Document maps.](images/maps-workflow.png)
*Maps › Document maps with the Specular/Gloss workflow.*

- **Switching** converts every layer where it sits: nothing is stacked on top. A material layer with plain values gets new Diffuse, Specular and Glossiness values (or Base colour, Metallic and Roughness going the other way) and stays editable, so changing its Specular colour still changes the model. Painted layers are converted pixel by pixel. A material with pictures becomes a plain layer. One undo step takes the switch back.
- The material view, the 3D view and the ray-traced render shade a Specular/Gloss document correctly: the Specular colour is the colour of the reflections, as in the traditional workflow (a brown body with a yellow shine reads as gold).
- **Library materials follow the project.** A Metal/Rough material added to a Spec/Gloss document is converted as it goes in, and the other way round. The Library has ten Spec/Gloss materials with their own **Spec/Gloss** tag and a small S/G icon on each tile.
- Brushes that paint several maps at once get **Specular** (a colour) and **Glossiness** values.
- The **Convert tab** sends **Glossiness** (inverted roughness) and **Specular** (grey, with the photo's colour where it's metal) to a Specular/Gloss document.
- **Export textures** offers the Specular/Gloss presets (see [Files and export](Files-and-export.md)).

## The Maps panel

![The Maps panel.](images/maps-panel.png)
*The Maps panel.*

Found above Layers.
- **Switching maps:** click a map, or press Shift+Alt+1…9, to **view and paint it**. The status bar shows which map you're painting.
- **Material (lit):** every map shown together with lighting. Use *Light angle* and *Light height* to turn the light. You keep painting whichever map you picked last.
- **Normal (final):** the finished normal map, meaning the normal made from Height plus any normal detail you painted or loaded.
- **Bump:** how strongly Height turns into normal detail.

## Painting several maps in one stroke

![The Material (lit) view, showing every map together.](images/material-view.png)
*The Material (lit) view, showing every map together.*

The Brush panel has an **Also paint** section for the other maps: tick a map and give it a value, for example Roughness 20%, Metallic 100%, Height +50%.
- The map you're **viewing** gets the foreground colour.
- The ticked maps get their own values.
- One stroke is **one undo step**.
- The **eraser**, **paint bucket**, **Fill** and **Delete** follow the same switches.
- With **Lock alpha** on, the other maps stay inside the shape of the base colour.
- **Save brush** remembers these switches and values.

## What works on which maps

![The Normal (final) view.](images/normal-view.png)
*The Normal (final) view.*

- **All maps of a layer:** Move, Free transform, Warp, Crop, Image/Canvas size, layer via copy/cut, masks, groups and selections.
- **Only the map you're viewing:** Blend, Dodge/Burn, gradients, filters and adjustments.

## Layers in multi-map documents

![Choosing which maps a document has.](images/document-maps.png)
*Choosing which maps a document has.*

Layers only store the maps they actually use, so memory isn't wasted. Each layer has its own blend mode per map. Layer rows show which maps have content (Col, Rgh, Met, Hgt, Nrm, AO, Emi, Opa), or "empty in …" for the map you're viewing.

## Exporting
See [Files, saving and export](Files-and-export.md): **Export textures for a game engine** packs and names the maps for Unreal, Unity URP/HDRP, Godot or Blender.
