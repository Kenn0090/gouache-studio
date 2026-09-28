# 3D Paint

The **3D Paint** tab (top right, next to Paint) is for painting straight onto a model, in the spirit of Substance Painter. It has its own textures, separate from the Paint tab, and saves as its own project file.

![The 3D Paint tab.](images/p3d-tab.png)
*The model fills the painting area; Colour, Material, Brushes and Materials sit in a column beside it; the 3D Paint panel, Maps and Layers are on the right.*

The column beside the view works like the rest of the dock: drag its tabs out (to float them or put them with other panels), or drag other tabs into it.

## Getting started
1. Click **3D Paint** at the top right.
2. Pick a model in the **3D Paint** panel: one of the shapes, or **Import a model** (OBJ, glTF, GLB or FBX). You can also drop a model file on the view.
3. Paint with a left drag. The model starts with a **Base material** (a fill layer) and an empty **Paint** layer.

Each texture set has the PBR maps **base colour, roughness, metallic, height and normal**. The Layers panel works as in Paint: layers, groups, masks, fill layers, layer styles and a blend mode per map.

## Moving around
Choose the style under **Navigation**:

| | Substance Painter (default) | 3D-Coat |
|---|---|---|
| Paint | left drag | left drag on the model |
| Turn | Alt + left drag | right drag, or left drag off the model |
| Move | Alt + middle drag, or middle/right drag | middle drag, or Shift + right drag |
| Zoom | Alt + right drag, or the wheel | Ctrl + right drag, or the wheel |

Double-click empty space to frame the model again. The same navigation works in Paint's 3D view.

## Picking colours and shades
- **Hold Alt over the model** (without clicking) to pick its colour there. Alt + drag still turns the model.
- **Left / Right arrow keys** step through the shade strip in the Color panel while you paint. Clicking a shade still works, and the strip stays put while you step.

## Layouts
**3D** shows only the model, **3D + 2D** shows the flat texture beside it, and **2D** shows only the flat texture. You can paint in all of them.

## Texture sets
A model with several materials gets one **texture set** per material, each with its own maps and layers, like Substance Painter. Click a set in the list to paint it. Only the active set takes paint; the others keep showing their own textures on the model.

If you switch to a model that doesn't have a set's material, the set is kept (greyed out) so your work isn't lost.

The **×** on a set deletes it, after asking. If its material is still on the model, that part starts again with a new, empty set.

Entering 3D Paint switches to the **Texturing** workspace; going back to Paint brings your previous workspace back.

## Mirror and radial painting
Under **Mirror**:
- **Mirror X / Y / Z** paints the other side at the same time. The **plane** sliders move a mirror off centre. With **Snap planes** on, they snap to the centre and to small steps. **Show planes** draws them on the model.
- **Radial copies** repeats every stroke around an axis (for example 6 copies around Y). It works together with the mirrors.

Mirror painting also works in Paint's 3D view (Settings in the 3D view).

## Stencils (projection painting)
A stencil is a picture laid over the view:
- **Mask**: the brush paints only where the picture is light.
- **Colour**: the brush paints the picture's own colours onto the model.

Pick one of the built-in stencils (Grunge, Scratches, Dots, Stripes) or **Load image…**. **Show** sets how visible it is, **Repeat** tiles it.

To place it, hold **S** over the view:
- **S + left drag** turns it.
- **S + right drag** scales it.
- **S + middle drag** moves it.

**Invert** (or **X** over the model) swaps black and white.

## Selecting parts of the model
Under **Select on the model**, choose **Object**, **Material**, **UV island**, **Face** or **Loop**, then **double-click** the model:
- **Shift + double-click** adds to the selection.
- **Ctrl + double-click** removes from it.
- **Ctrl + D** deselects.

The selection is tinted on the model and shows on the flat texture too. Painting stays inside it. **Selection to mask** gives the active layer a mask made from it.

A **loop** is the ring of quads crossing the edge you click nearest to. Faces and loops follow the model as you imported it, even when the view shows it subdivided.

## Materials
The **Materials** tab sits beside Brushes. Click a material (Steel, Gold, Copper, Rust, Rubber, Plastic, your own…) to add it as a **material layer**. If a selection is active, it becomes the layer's mask; otherwise paint the mask to show the material where you want it.

**New material…** makes a material layer and shows it in the **Properties** panel (the tab beside Colour), which edits whichever material layer (or mask row) is selected. Double-clicking a material layer's thumbnail brings it forward.

![The Material panel beside Colour, and the Materials tab.](images/material-panel.png)

- **Channels:** base colour, roughness, metallic, height, normal, emissive and opacity. Each one is a colour or value, an **Image** (with **Tile** and **Turn**), or a **Mesh map**: one of the texture set's baked maps (AO, curvature, thickness…), laid over the model as baked.
- **Height** makes bump detail on the model (the normal follows it), with a **Bump strength** slider.
- **Projection:**
  - *UV* follows the model's UVs.
  - *Triplanar* projects images from three sides and blends them, so there are no seams. **Blend** sets how soft the joins are.
  - *Planar* projects straight from one direction, like a slide projector: good for decals and logos. **Repeat** tiles it; **Front faces only** keeps it off the parts facing away.
  - *Spherical* wraps it around from a centre point.
- **Moving, turning and scaling a projection:** with the layer selected, a **gizmo** sits on the model for Triplanar, Planar and Spherical. The arrows move it, the rings turn it, the small boxes scale it along one axis and the middle box scales it evenly. For *UV*, a frame shows on the flat canvas: drag a corner to scale (Shift keeps the proportions), the round handle to turn, and inside with the Move tool (or Ctrl) to move. **Offset**, **Rotation** and **Scale** are also in Properties, with **Reset**. Each drag is one undo step.

  ![The projection gizmo.](images/proj-gizmo.png)
- **Save to Materials** keeps the material, with its images, on this computer for other layers and projects. In the Materials tab, **⤓** exports one as a **.gmat** file and **Import…** brings one in.

The layer stays live: every change shows straight away on the model, and becomes one undo step when you pause.

## Mesh maps (from the Bake tab)
In the Bake tab, tick **Bake each material separately**, then press **Send to 3D Paint**. The model comes over, and each material's baked maps land in its own texture set as that set's **mesh maps** (listed in the 3D Paint panel), like Substance Painter's. They're what masks and smart materials will read.
- The baked normal becomes a layer in the Normal map, so the high-poly detail shows on the model straight away.
- **Add as layer** puts any mesh map in the layer stack.
- Tick *also add them as layers* before sending to get AO (Multiply) and curvature (Overlay) layers automatically.
- Material channels can use them (**Mesh map** in the Properties panel), and **right-click a layer › Mask from mesh map** makes its mask from AO, curvature, thickness or height.

## Mask mode
Masks can hold rows (generators, noise, mesh maps, ID colours, filters…) and layers without a mask can have a live mask: see [Masks and effects](Masks-and-effects.md).

**Alt + click a layer's mask** to see it on the model in black and white, without lighting. A bar appears at the top:

![Mask mode with ID colour.](images/mask-tools.png)

- **Paint:** nothing paints the mask until this is on (white shows the layer, black hides it).
- **Box**, **Lasso** and **Polygon** select what you can see of the model under the shape you draw. Drag inside the shape to move it; the selection follows when you let go. **Shift** adds, **Ctrl** takes away. For the polygon, click the corners, then double-click, click the first point or press **Enter**. On the flat texture they are the usual selection tools.
- **ID colour** (like Substance Painter's colour selection): click the model (or the flat texture) to pick colours of the texture set's baked **ID** map. Those colours turn white in the mask, the rest black. **Tolerance** sets how close a colour counts, **Softness** the edge, **Invert** swaps them; click a colour swatch to remove it. It stays with the layer, so you can come back and change it.
- **Fill white** / **Fill black** (inside the selection, if there is one) and **Invert**.
- **Double-click:** choose Object, Material, UV island, Face or Loop, then double-click the model. That part turns white in the mask; **Ctrl + double-click** turns it black.
- **Done**, **Esc**, Alt + click again, or clicking the layer's own thumbnail goes back to the material.

## From Paint
In the Paint tab, **right-click a layer › Send layer to 3D Paint** sends just that layer (or group), flattened with its effects. **File › Send to 3D Paint** flattens the whole painting (every map it shares with 3D Paint) into a new layer of the active texture set, keeping its proportions. Hide the background first to keep transparency. In 3D Paint, press **Ctrl + T** to move and scale it.

## Saving and exporting
- **Ctrl + S** in the 3D Paint tab (or **Save project**) saves a **.gouache3d** project: the model with its materials, every texture set with its layers, the camera and the mirror settings. Open it with **File › Open** or **Open project…**.
- **Export textures…** exports **every texture set** at once (untick it for just the active one), each named after its set. A baked AO fills the ORM or occlusion file (see [Files, saving and export](Files-and-export.md)).
- Your Paint document is saved separately, as before.
