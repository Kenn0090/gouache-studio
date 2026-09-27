The Specular/Gloss workflow.

- **Specular/Gloss documents:** paint **Diffuse**, **Specular** (a colour map) and **Glossiness** instead of Base colour, Metallic and Roughness. Start one with the **PBR spec/gloss** template in File › New, or switch any document in **Maps › Document maps › Workflow**.
- **Switching converts your material:** the finished look becomes one new group per map, and it looks the same as before. Your old layers are set aside, and switching back brings them back exactly (or converts again, your choice). Switching is one undo step.
- **Material view and 3D view** shade Specular/Gloss correctly.
- **Export textures** for Specular/Gloss: **Unity (Standard, specular)** with glossiness in the specular map's alpha, **Unreal** (diffuse, specular and gloss files for a custom material), or separate maps.
- Multi-map brushes paint **Specular** and **Glossiness**; the **Convert tab** sends glossiness and specular to Specular/Gloss documents.
