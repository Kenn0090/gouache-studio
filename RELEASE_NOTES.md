The baker.

**Maps › Bake from high poly…** copies the detail of a high-poly model onto your low-poly's UVs.

- **Models:** the low-poly can be the model in the 3D view or a file. The high-poly can be an FBX, OBJ, glTF or GLB file.
- **Maps you can bake:**
  - **Normal**, **Height** and **Ambient occlusion** go into the matching maps as new layers. Any missing maps are added for you.
  - **Curvature**, **Thickness**, **World-space normal**, **Position** and **ID colours** go into a hidden **Baked maps** group, ready to use as masks.
  - ID colours come from vertex colours, material colours, or one colour per part.
- **Rays:**
  - **Front and Back** set how far outside and inside the surface the baker looks.
  - **Average ray directions** stops gaps at hard edges.
  - You can load your own **cage** model instead of using distances.
- **Match parts by name:** "crate_low" bakes only against "crate_high", so parts that sit close together don't leak into each other.
- **Low-poly only:** leave the high-poly on **None** to bake AO, curvature (from the model's own shape), thickness, ID colours, world-space normal and position from the low-poly by itself.
- **Quality:** anti-aliasing at 1×, 4× or 16× samples per pixel, **edge padding** past UV seams, and a progress bar with Cancel.
- **Speed:** everything runs on the graphics card in small pieces, so the app stays responsive during big bakes.
