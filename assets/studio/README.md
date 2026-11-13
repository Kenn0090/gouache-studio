# Material preview assets

Kenn supplied Material_Preview_L.fbx (the updated preview low-poly) and its baked maps for use as Gouache Studio's material preview and smart-material/mask/generator test mesh.

- material-preview.obj.gz is the mesh from the FBX, written as an OBJ (one vertex per corner, UVs and normals as in the file) and gzipped.
- preview-N (normal), AO, Curv (curvature), Thickness, Position, WNormal (world normal) and ID are 2048-square copies of the 4096-square baked PNGs.
- preview-H is a 2048-square 16-bit greyscale copy; height precision is retained.
- The old colour and ORM textures were made for the previous UV layout and were removed; the preview material is plain grey.

These files are user-supplied assets, rather than assets downloaded from an external texture service.
