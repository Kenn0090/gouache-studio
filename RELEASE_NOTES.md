Baking: a tab of settings for each map, reworked curvature, and bakes sent as layers you can blend.

- **A tab per map** in the Bake panel: General, Normal, AO, Curvature, Height, Thickness and Other, each with its own settings. AO gets **Spread**; Thickness gets its own Rays.
- **Curvature, reworked:** measured on the high-poly's real shape by default, so mirrored and flipped UVs come out right. You can still work it out from the baked normal or from the document's normal map, with **Flip green**. New Radius, Strength, Edges and Creases settings, plus optional **edges-only** and **creases-only** maps.
- **Bakes arrive as layers:** each one is also a layer in the base colour, so you can blend them (curvature on Overlay over AO). AO, curvature and height still go into their own maps too. *Maps only* in the General tab sends them the old way.
- The installer builds faster.
