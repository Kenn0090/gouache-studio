# Files, saving and export

## .gouache documents
**Save** (Ctrl+S) and **Save as** (Ctrl+Shift+S) write a **.gouache** file. It keeps everything:
- layers, groups, masks, blend modes;
- every map;
- filter layers, live gradients, editable text;
- animation;
- 3D view settings and any imported model.

The first save asks where to put the file; after that, Ctrl+S saves in place. **Open recent** lists recent files, and double-clicking a .gouache file in Explorer opens it.

## Opening files
**File › Open** reads **.gouache, PSD** (layers, groups, masks, blend modes), **PNG, JPG, WebP, GIF, BMP, TGA, DDS and TIFF**. Dropping an image onto the canvas places it as a new layer.
- **Place image as layer** adds an image to the current document.
- **Fonts** (TTF, OTF, WOFF) can be opened to add them to the Text tool.

## PSD
**File › Export as PSD…** writes a layered Photoshop file with groups, masks and blend modes.
- **Base colour only:** a PSD holds only the base colour map. Save as .gouache to keep every map.
- **Filter layers** are turned into the pixels they produce.
- **Round-trips:** live gradients, text and animation are stored inside the PSD, so they come back when you reopen it in Gouache Studio.

## Export an image (Ctrl+Shift+E)
Exports the **visible image** or the **active layer** as:
- **PNG** (8 or 16-bit)
- **TGA**
- **DDS**: BC1/DXT1, BC3/DXT5 or uncompressed, with mipmaps
- **TIFF**
- **EXR** (half-float, for HDR work)
- **JPG**
- **WebP**

## Export textures for a game engine

![Export textures, with engine presets.](images/export-textures.png)
*Export textures, with engine presets.*

**File › Export textures for a game engine…** writes every map as separate files, packed and named for the engine you pick:

| Preset | Files |
|---|---|
| Unreal | `T_Name_BC`, `T_Name_N` (DirectX normal), `T_Name_ORM` (R occlusion, G roughness, B metallic), `T_Name_H`, `T_Name_E` |
| Unity URP | `_Albedo`, `_MetallicSmoothness` (R metallic, A smoothness), `_Normal`, `_Occlusion`, `_Height`, `_Emission` |
| Unity HDRP | `_BaseColor`, `_MaskMap` (R metallic, G occlusion, B detail mask, A smoothness), `_Normal`, `_Height`, `_Emissive` |
| Godot | `_albedo`, `_orm`, `_normal`, `_height`, `_emission` |
| Blender | one file per map |

Other options:
- **Normal map direction:** the engine default, OpenGL or DirectX.
- **Size:** the document size or 256–4096.
- **Format:** PNG or TGA, with **16-bit height**.
- **Opacity:** goes into the base colour's alpha.

In the desktop app you choose a folder; in the browser the files come as a zip.

## Sprite sheets and flipbooks
See [Animation](Animation.md).

## Brushes
**File › Import brushes (.abr)** loads Photoshop brushes. See [Brushes and painting](Brushes-and-painting.md).
