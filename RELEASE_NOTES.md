Fixes and additions for the Bake tab and converters.

- **Loading models:** each model in the Bake tab has its own **Load…** button, and you can **drag and drop** model files onto Low-poly, High-poly or Cage. Files named _low, _high and _cage go to the right place by themselves. Dropping a model in the Paint tab opens it in the 3D view. Text (ASCII) FBX files now get a clear message.
- **Big high-poly models no longer crash the app:** models are now read straight from the file's bytes, so a big OBJ or FBX uses a fraction of the memory it did. A 136 MB, 2.4-million-triangle OBJ now loads in about 2 seconds. The baker also uses less graphics memory for big high-polys.
- **Loading bar** for files coming into the app. Big files show real progress as they are read.
- **See the cage:** "Show the cage on the model" draws where the rays start as a see-through blue shell. It follows Front, your offset map and a loaded cage.
- **Sent bakes get one group per map** in the layer stack. Maps that live in the base colour start hidden.
- **Curvature has its own map:** curvature (from the converters or the baker) goes into a new grey **Curvature** map instead of blending into your base colour. Only the Normal map is in colour.
- **New filter: Edge wear** lightens raised edges and darkens cavities of your colours, following the height and normal maps. It works as a filter layer too.
