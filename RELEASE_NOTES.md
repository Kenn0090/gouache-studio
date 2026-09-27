Material maps and game-engine export.

- **Templates** in File › New document: **Hand-painted** (base colour only), **PBR** (base colour, roughness, metallic, height, normal) or **Custom**. Add or remove maps any time with **Image › Document maps…** (also ambient occlusion, emissive and opacity).
- **Maps panel** above Layers: click a map to see and paint it (Shift+Alt+1…). **Material** shows every map together, lit, with a light you can turn; **Normal** shows the final normal map.
- **Paint several maps in one stroke**: the brush's *Also paint* section switches maps on with their own values (roughness 20 %, height +50 %…). The eraser, paint bucket, Fill and Delete follow the same switches. One stroke is one undo step.
- **Normal maps are made from height** automatically (Bump slider), combined with any normal detail you load.
- Layers only store the maps they use. Each layer has its own blend mode per map (height defaults to Linear Light around mid-grey). Masks, groups, selections, Move, Transform and Crop work on every map at once; blend, dodge/burn, gradients and filters work on the map you are viewing.
- Height is kept at 16 bits even in 8-bit documents.
- **File › Export textures for a game engine…**: presets for **Unreal** (T_Name_BC / N / ORM, DirectX normals), **Unity URP** (metallic + smoothness), **Unity HDRP** (mask map), **Godot** (ORM, OpenGL normals) and **Blender**, with size, PNG or TGA, and 16-bit height.
- **Save now writes a .gouache document** that keeps everything: maps, masks, live gradients, editable text and animation. Double-click a .gouache file to open it. PSD is still available as **File › Export as PSD…** (base colour only).
- **Save brush**: keep your brush settings, including which maps it paints and their values.
