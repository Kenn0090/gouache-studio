# Gouache Studio 0.46.12

- 3D Paint shows the active document resolution in the viewport and texture-size settings, including 8K and 16K.
- New 3D Paint documents offer a setup window for importing a model and assigning mesh maps to a texture set. Later, use the labeled drop slots in Maps to import, replace, inspect or remove maps.
- The Material Library shelf has Mesh maps and Projects tabs. Projects lists live layer materials, source textures, textures made from the canvas and converted materials. Click or drag an asset onto the layers to reuse it.
- Project assets and imported mesh maps are included in project saves. Assets remain compressed until used; mesh maps retain their source resolution to avoid unnecessary 8K/16K copies.
- Placing or dropping a PSD keeps its layers and folders, with names, visibility, opacity, blend modes and pixel masks. The entire import can be undone together. File Open continues to preserve layers. Photoshop adjustment layers, vector masks and layer effects are reported as unsupported; text and smart objects use their raster images.
- Validated in the Windows desktop renderer on an RTX 4080 at 8K and 16K with six material layers, an imported mesh map and the Projects shelf open. Import, save/reopen, map-driven materials/masks, PSD undo and existing material-performance checks passed.
