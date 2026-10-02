# Gouache Studio 0.46.11

- Textured material layers keep their source images and settings, sharing full-size working images instead of retaining expanded copies for every channel in every layer. This addresses the freeze when adding materials at 8K.
- At 8K and 16K, scalar viewport channels use less storage at full resolution. Large brush buffers wait until an edit needs them.
- The 16K desktop height path retains 16-bit precision using compact value and transparency storage.
- Six library materials, painting directly on the model, camera navigation and undo passed at 8K and 16K in the Windows desktop renderer on an RTX 4080. Material edits, masks, effects, duplication and file compatibility also passed regression checks.
- 16K still needs substantial graphics memory and full updates take longer. Use 8-bit colour and UV projection at that size: full 16-bit colour and 3D projection position maps exceed the renderer's allocation limit and now show a message.
