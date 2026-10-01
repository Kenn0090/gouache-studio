# Gouache Studio 0.46.10

- Uniform material colours and values, including flat height and normal channels, no longer allocate a full-size image per layer. This reduces graphics-memory pressure in large 3D Paint stacks.
- Opaque materials skip the layers they completely cover. Masks, transparency, blend modes, decals and effects keep the underlying layers when needed.
- Supported brush strokes directly on the model now composite only the affected texture area, as well as updating that area in the viewport.
- Height painting buffers are allocated when you edit height, rather than whenever the viewport displays it.
- Saving preserves compatibility with previous Gouache files. Existing uniform fill images become compact when reopened; undo, duplicates, masks, resizing and pixel conversion keep their channel data.
