# Troubleshooting and FAQ

**The update doesn't show up.**

The app only checks for updates a few seconds after it starts. Use **File › Check for updates…**, or restart. You can always install by hand from the [releases page](https://github.com/Kenn0090/gouache-studio/releases/latest); your settings and brushes are kept.

**"This is a filter layer: it has no pixels to paint on."**

You selected a filter layer. Click a normal layer to paint. Double-click the filter layer's thumbnail to change its filters.

**I painted but nothing appeared.**

Check these in order:
1. The status bar shows which **map** you're painting. In multi-map documents you might be painting Height while viewing Material.
2. The layer may be hidden, or inside a hidden group.
3. A selection may be limiting the paint. Press Ctrl+D to deselect.
4. Only some **channels** may be active. Click RGB in the Channels panel.
5. **Lock alpha** may be on while the layer is empty.

**A layer made by a converter looks empty.**

It lives in another map, such as Height or Normal. Its row says which, for example "Hgt". Click that map in the Maps panel.

**The 3D model is grey or has no texture.**

The model may have no UVs; the corner of the 3D view says so. On hand-painted documents, make sure base colour has paint.

**Height doesn't push the model out.**

Raise **Detail** at the top of the 3D view and **Height depth** in its Settings. The model needs enough triangles to show the height.

**The bake misses parts or has bits of other parts in it.**

- **Misses parts:** raise **Front** and **Back**.
- **Other parts leak in:** lower them, or use **Match parts by name** (`_low` / `_high`) or a cage.
- **Gaps at hard edges:** turn on **Average ray directions**.

**The GPU context was lost.**

The graphics driver reset, which can happen with very heavy work on weak GPUs. Save often. Heavy filters and bakes are split into small pieces to avoid this.

**Where are my brushes and preferences stored?**

In the app's storage on your computer, so they survive updates.
