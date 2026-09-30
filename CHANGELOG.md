# What's new in Gouache Studio

## 0.31.1

A middle step for painting on slower computers.

- **"Model while painting" now has Three quarters** between Full size and Half size. Three quarters is sharper than Half and still lighter than Full. It is in Preferences and in the 3D view's settings.

## 0.31.0

Paint starts to look like Photoshop.

- **Layer is a menu of its own again**, in the same order as Photoshop: New, Duplicate, Delete, Layer style, Layer mask (Reveal all, Hide all, Apply, Delete), Group, Merge and Flatten.
- **Chain link on layers with a mask:** a small chain sits between the layer's picture and its mask. Linked (the default), moving or transforming the layer moves the mask too. Click the chain to unlink, and the mask stays where it is. It is saved in your file.

## 0.30.2

Low power painting for slower computers.

- **New "Model while painting" setting:** Half size draws the 3D model at half the size, without smoothing, while you paint, then sharp again when you lift the brush. It is in Preferences and in the 3D view's settings, next to Painting speed. It is off by default.

## 0.30.1

Faster painting on masks.

- **Painting on a mask is much lighter:** while you paint on a mask, the app used to redraw the whole picture on every brush move. It now redraws only the area you just painted. The result is the same.
- **Fast painting speed also holds back the 3D map updates:** with Painting speed on Fast, the model's other maps (roughness, normal and so on) update when you lift the brush instead of during the stroke. Balanced updates them less often.

## 0.30.0

Fold arrows, a bottom shelf, sharper material previews and a painting speed setting.

- **Fold arrows:** the toolbar, the tool options bar and the panel columns each have a small arrow that folds them into a thin strip. Click it again to bring them back. Folding gives the canvas the room.
- **Bottom shelf:** drag any panel tab to the bottom of the canvas, or use the panel's … menu › Move to the bottom shelf. Drag its top edge to make it taller, or fold it.
- **Sharper material previews:** the library pictures and the hover preview are drawn from the full images at higher detail.
- **Painting speed:** Best, Balanced or Fast, in Preferences and in the 3D view's Settings. Balanced and Fast redraw the picture less often while you paint, which helps slower computers and big documents. The paint itself is the same. It is saved per computer.

## 0.29.2

3D Paint gets a Bake Maps tab, and the skin shader looks better.

- **Bake Maps tab:** baking mesh maps now has its own tab in 3D Paint, next to Maps, instead of sitting in the long 3D Paint panel.
- **Skin shader:** light now bleeds past the shadow edge red first, like real skin, and there is a new Oily sheen slider.

## 0.29.1

Fixes for lag, blurry material previews and moving panel tabs.

- **Less lag with grunge masks and filters:** the effects on a layer are now remembered while you paint, so a stroke no longer redoes them every time.
- **Sharper material previews:** the little spheres and the hover preview are drawn in higher detail and smoothed, so you can tell what the material is.
- **Panel tabs:** drag a tab to any spot among the others in its group; a bar shows where it will land.

## 0.29.0

Filters in categories, drag and drop for textures and materials, and a closer look at materials.

- **Filter menu in categories:** Blur, Sharpen, Distort, Paint and sketch, Photo looks, Print, Edges and relief, Noise and render, Tiling. Point at a category and its filters open beside it.
- **Textures:** drag a texture onto a layer to put it in that layer's mask, or to the edge of a layer to make a new layer there. Click adds a new layer. Right-click still offers all the other uses.
- **Materials:** a click now only highlights a material. Drag it onto the layer stack, or press the fill layer button to add the highlighted one. The same goes for smart materials, and the mask button applies a highlighted smart mask.
- **A closer look at materials:** point at a material and a larger preview opens beside it with its channels, size and source.
- **Thumbnail size:** S, M and L buttons at the top of the Materials tab.

## 0.28.2

Quick fixes and a cleaner 3D Paint panel.

- **Document tabs move freely:** one drag now carries a tab left or right past as many others as you like.
- **Colours start black and white**, like Photoshop, instead of yellow.
- **Colour picker drags stop when you let go**, even if the release was missed (a stuck drag could keep changing the colour).
- **Layer buttons can sit at the top or bottom** of the layer list: use the small arrow beside "Layers".
- **Less lag painting on a mask** that has rows under your paint row: they are worked out once per stroke instead of every frame.
- **Recolour for materials:** a new section in the Material panel changes a material's base colour and keeps its detail, like Marmoset's Recolor. Modes: One colour, Main colour (finds the dominant colour), Several colours, and Custom (pick from and to colours), plus Contrast, Brightness and Saturation sliders. Roughness, metal and the normal map are untouched.
- **File menu follows the section:** 3D Paint, Bake, Convert, Brush, Animation and Paint each show only the File items that fit (for example no PSD export or sprite sheets in 3D Paint).
- **Submenus:** the layer right-click menu nests Layer style and Mask from mesh map, and the Image menu holds Layer and Maps as fly-outs.
- **Cleaner menu bar:** the Maps and Layer menus are gone from the top; their items are at the end of the Image menu.
- **3D Paint panel:** Export textures and Selection to mask buttons removed (Export textures stays in the File menu).

## 0.28.1

More materials and grunge, and materials that cover what's under them.

- **75 materials in the Library**, mostly for characters and weapons, in categories (Metal, Leather, Fabric, Plastic & rubber, Wood, Ground & nature): gunmetal, blued gun metal, titanium, brushed aluminium, polished and scratched steel, chrome, polished gold, copper, bronze, chainmail, a carbon-look weave, knurled grip, snakeskin, tufted and padded leather, tartan, plaid, velvet, knit, felt, gun polymer, grip rubber, walnut, and a few for nature like grass and moss. All from ambientCG (CC0).
- **40 photo grunge maps** in the Textures panel: new hand print, fingerprints, smudges, oily marks, chips, grime, speckle, micro scratches, wipes, swipes and more leak streaks.
- **Materials cover the bumps below:** a smooth material on top now hides the height and normal detail of the layers under it. Untick **Hide the bumps below** in the Material panel to let the bumps add up instead.

## 0.28.0

Textures, decals, a material library, embroidery patches, much smaller files, and a lot of your requests.

- **Materials Library:** 23 ready-made materials from ambientCG (free, CC0): red, brown, black and quilted leather, worn steel, dark iron, brass, blued steel, brushed metal, rusty painted metal, rust, dirt, dry mud, gravel, linen, wool, check fabric, canvas, dark and pale wood, concrete, rubber and plastic. Click one (or drag it onto the layers) to use it. Any .gmat file placed in the app's materials folder becomes a built-in too.
- **Textures panel:** 13 photo grunge maps (streaks, water rings, specks, stains, drips, splotches, spatter, scratches, dirt, dust, fingerprints, smears, leak streaks), 12 generated seamless textures, and your own pictures. Share yours as a .gtex pack. Click one to use it: in a mask, in a material channel, as a new layer, as a stencil, or as a brush tip.
- **Decals panel (3D Paint):** bolts, rivets, screws, vents, a warning label, hazard stripes, a serial plate, a crack, a bullet hole and scratches. Click one, then click the model: it lands facing the surface with colour, height, roughness and metal, as its own layer you can move, turn and scale. Import your own logos and labels too.
- **Filter › Embroidery patch:** turns a picture into a stitched patch, with thread colours taken from the picture, satin edges, fill stitches, a merrow border, thread shine and height.
- **Smaller files:** every document, project, autosave and material is packed much tighter without losing anything. With **Smaller files** (Preferences, on by default), colour and grey maps are also kept as high-quality WebP. Normal maps, height and masks always stay exact. .gmat files are compressed too.
- **Engine quality** (Preferences): Low, Medium, High or Ultra, for slower or faster computers.
- **Height depth works on your models:** hard edges and seams no longer tear open, and models with several texture sets keep their textures when you raise Detail.
- **Help menu:** the user guide (F1), what's new, keyboard shortcuts, reporting a problem, and About.
- **The workspace follows the tab:** each top tab remembers its own workspace.
- **Animation shortcuts:** Ctrl+F new frame, Ctrl+D duplicate, Delete removes the frame, `,` and `.` step between frames, Space plays and stops, Ctrl+Shift+Left/Right moves the frame.
- **Alt+click a tick box** in a list (maps to bake, Material channels and more) to keep only that one; Alt+click it again for everything else.
- **C in 3D Paint** steps through the baked mesh maps on the model; Esc goes back to the material.
- **ID colour mask** from the right-click menu, and baked ID maps reach 3D Paint.
- **Material layers without a mask:** painting on one now does nothing (add a mask to paint where it shows).
- **Fixed:** selections and lassos made in the mask view no longer stay after you leave it.

## 0.27.0

Export straight into your engine, models that update themselves, new filters, and a lot of your requests.

- **Your own export presets:** pack any maps into the red, green, blue and alpha of one image (for example metallic, roughness and AO), choose the normal style and the file names. Sizes now go up to 8K.
- **The model comes too:** export a **.glb** with every texture inside and connected (one material per texture set), or an **.obj + .mtl**.
- **Send to Blender, Unity, Godot or Unreal** (desktop): the files go straight into your project's folder. For Blender there's a small add-on (Export window › Save the Blender add-on…): a running Blender receives the model at once, and each send replaces the last one.
- **Models that update:** when a model file you imported is saved again in another program, the app asks to update it and to bake again with the last settings (or does both without asking, if you like). A changed high-poly always asks first. Desktop only.
- **New filters:** Warp, Slope blur (Blur, Min, Max, like Substance) and Distort (waves, ripple, twirl, pinch). They're also in the Filter Gallery, filter layers and masks, and generators have a new **Distort** setting for irregular wear.
- **Stretch every panel:** a wider dock, the 3D Paint column, the toolbar (one or two columns) and a taller Animation timeline.
- **Stickers from Paint:** a layer sent to 3D Paint lands on the model as a see-through sticker, projected from your view, and you can move, turn and scale it on the model.
- **Materials from downloads:** Materials › From textures… turns a download from ambientCG, Poly Haven, ShareTextures and similar sites (folder, images or .zip) into a material.
- **Convert tab › Turn into material:** the converted maps become a material for 3D Paint.
- **Drag onto the layers:** drag materials and smart materials between layers, or a smart mask onto a layer.
- **Autosave** keeps every open document tab, not only the one on screen.
- **New document › Start in:** Paint, 3D Paint, Animation or Brush.
- **Materials** start without a mask; painting on one adds a black mask to paint white into. Sent bakes stay out of the layer stack (the baked normal shades the model by itself).
- **Environment** settings are in the Shader panel, and **Shift + right-drag** turns the lighting, like Substance Painter.
- **Filters on masks:** every filter can go on a mask, and the right-click menu has Filter this layer and Filter its mask.
- **Fixed:** layer styles now work on materials and masked layers; the Material panel's sliders drag smoothly back and forth; the Mesh map list in materials no longer closes by itself.

## 0.26.2

Document tabs, and documents in windows of their own

## 0.26.1

Polish from testers: no accidental reloads, rulers and guides, layer locks, New document presets, colour wheel/sliders/swatches, shortcut helper, sharp theme, faster big canvases, autosave countdown

## 0.26

HDRI lighting, shaders per texture set, ray-traced view and renders, screenshots, turntables, high-poly in the Bake tab

## 0.25

Welcome screen, autosave, recent files, per-tool brushes, shape corner bevels, shortcut categories

## 0.24

Smart materials and smart masks, anchor points, baking inside 3D Paint, healing brushes, clone stamp

## 0.23.1

Planar and spherical projections, projection gizmo and UV frame

## 0.23

Masks and effects: rows under a layer (paint, mesh maps, ID colours, direction, gradients, noise, generators, filters), content effects, Properties panel, live mask, mesh maps from a material

## 0.22

Material layers and the Materials tab, triplanar, mask mode, bake to 3D Paint per material, ID from vertex colours/polypaint, floating dialogs, History, lazy mouse; Material panel, mesh maps in materials and masks, mask tools and ID colour masks, Substance-style Levels (0.22.2)

## 0.21

3D Paint tab (texture sets, Substance-style layers, mirror, stencils, selections)

## 0.20

Fill layers, own canvas for Bake and Convert, bake export, right-click layer menu, resizable dock

## 0.19

Shapes with bevels, Array tool, layer styles

## 0.18

Faster baking, memory and disk settings, bake tabs, reworked curvature, bakes as layers

## 0.17

15 new filters (glass, print, photo and artistic looks), Y2K gradient maps

## 0.16

New layout: options bar, tabbed dock, floating panels, workspaces, Filter Gallery

## 0.15

Specular/Gloss workflow

## 0.14.1

Brush tab

## 0.14

Colour jitter, keyboard shortcuts, themes, brush tips, pictures into masks, Tile filter

## 0.13

Convert tab (CrazyBump-style map converter)

## 0.12

Bake tab, painting on the model, skew and offset painting

## 0.11

Cage painting and symmetry

## 0.10

Baker

## 0.9

3D view

## 0.8

Filter layers

## 0.7

Converters and filters

## 0.6

Maps in documents, engine texture export, .gouache files

## 0.2–0.5

Selections, transforms, crop, fills, gradients, dodge/burn, flipbooks

## 0.1

Desktop app, self-updates
