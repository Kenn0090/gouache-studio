# Baker

The **Bake** tab (top right, or **Maps › Bake from high poly…**) copies the detail of a high-poly model onto the low-poly model's UVs, at the document's size. For a bigger bake, change *Image › Image size* first.

![The Bake tab.](images/bake-tab.png)
*The Bake tab: settings on the right, the bake on the model in the middle, the baked map on the left.*

## The Bake tab
- The **3D view** shows the low-poly large in the middle. While a bake runs you watch it fill in on the model, piece by piece, and you can turn the model as it goes. **Cancel** stops it at any point.
- The **canvas** on the left shows the baked map.
- **Show** chooses what you look at:
  - **Material (lit)** is a clay model with the baked normal and AO. You can tick *Use the document's base colour on the model*.
  - Any single baked map on its own.
  - The skew or offset map.
- Bakes stay in the tab, so you can check them and bake again as often as you like. **Send to document** adds them as layers.
  - Tick **Send results to layers automatically** to have every bake go straight into the document.
  - **Replace the last baked layers** swaps the previous bake's layers for the new ones, instead of piling them up.

## Models

- **Low-poly:** the model in the 3D view, or load a file (OBJ, glTF, GLB, FBX). It must have UVs.
- **High-poly:** load a file. Or choose **None** to bake the low-poly on its own (see below).
- **Cage:** either *Push out by the front distance*, or load a **cage model**, which is your low-poly pushed outwards with the same vertices and triangles.

## Rays
Each pixel of the low-poly's UVs sends a ray from just outside the surface back through it and records where it first meets the high-poly.
- **Front:** how far outside the surface the ray starts, as a % of the model's size.
- **Back:** how far inside it still looks.
- **Average ray directions:** stops gaps and seams at hard edges.
- **Match parts by name:** `crate_low` bakes only against `crate_high`. This stops close parts from leaking into each other. The endings `_low/_high`, `_lo/_hi` and `_lp/_hp` are recognised, and the panel lists the parts it matched.

If parts of the high-poly are missed, raise the distances. If detail from other parts leaks in, lower them or match parts by name. To fix just one area, paint an offset map (below).

## Maps
| Map | Where it goes |
|---|---|
| Normal (OpenGL) | New layer in the Normal map |
| Height (high-poly above = light) | New layer in the Height map |
| Ambient occlusion | New layer in the AO map |
| Curvature | *Baked maps* group (base colour) |
| Thickness (white = thick) | *Baked maps* group |
| World-space normal | *Baked maps* group |
| Position (gradient over the model's box) | *Baked maps* group |
| ID colours (vertex colours, material colours, or one colour per part) | *Baked maps* group |

Maps the document doesn't have yet are added for you. The **Baked maps** group is hidden: show it, or use its layers as masks with *Select › Load selection*.

## Low-poly on its own
Choose High-poly **None** to bake AO, **curvature from the model's own shape**, thickness, ID, world-space normal and position. Normal and height are skipped because they'd come out flat.

## Quality
- **Rays and reach:** more rays make AO and thickness smoother but slower. Reach is how far those rays look.
- **Anti-aliasing:** 1×, 4× or 16× samples per pixel.
- **Padding:** extends colour past the UV edges so seams don't show.

Baking runs on the graphics card in small pieces with a progress bar and **Cancel**, so the app stays responsive.

## Fixing the bake: skew and offset
Sometimes a bake comes out wrong in places. Floating details like screws, bolts and panel lines come out smeared or leaning, parts of the high-poly are missed, or detail from a nearby part leaks in. You fix those by painting two maps on the low-poly, the same idea as Marmoset Toolbag's projection tools.

Under **Fix the bake**, pick **Skew** or **Offset**, then paint with the Brush (the Eraser puts the neutral colour back):
- **Skew** (neutral is white): paint **black** over details that lean or smear. The rays there shoot straight out of the surface instead of along the averaged direction. White keeps the averaged direction, which avoids gaps at hard edges.
- **Offset** (neutral is grey): **lighter** reaches further, for parts of the high-poly that were missed. **Darker** reaches less far, for detail leaking in from nearby. **Estimate offset** makes a starting offset map for you by measuring how far the high-poly actually is at each pixel.

You can paint **on the model in the 3D view** or on the map on the canvas. The areas you paint show as a tint: orange for skew, orange or blue for offset.

After each stroke, the quick maps (normal, height, curvature, position, world-space normal, ID) **re-bake straight away where you painted**, so you see the fix at once. AO and thickness are slower, so they update on the next full **Bake**.

Every stroke can be undone. **Clear skew** and **Clear offset** start over. Both maps are saved in your .gouache file.

![Painting skew on the model.](images/bake-skew.png)
*Painting skew over part of a model. The orange tint shows where the rays now shoot straight out.*

## Exporting for DirectX engines
Bakes are stored as OpenGL normals, like everything else in the app. Pick the engine preset in *File › Export textures for a game engine* and DirectX normals (Unreal) are flipped on export.
