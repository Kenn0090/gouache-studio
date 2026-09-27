# Animation, flipbooks and sprite sheets

Switch **Paint ▾ / Animation** in the top-right corner. Animation mode shows only frames. Each frame is its own image, and you paint it with the usual tools. Your paint-mode layers wait untouched until you switch back.

## Timeline (under the canvas)

![Animation mode: the timeline under the canvas, with onion skin.](images/animation.png)
*Animation mode: the timeline under the canvas, with onion skin.*

- **Frames:** add, duplicate, delete, and drag to reorder. **,** and **.** step through frames; **Enter** plays.
- **Speed:** frame rate buttons for **12, 24 and 30 fps**, or type any rate. Each frame has a **hold** (how many frames it lasts).
- **Tags:** Shift+click a range of frames and tag it (idle, run, attack…). A tag can **loop**, **play once** or **ping-pong**.
- **Onion skin:** earlier frames in red, later ones in green. Choose how many to show and how faint they are.
- **Preview window:** keeps playing while you paint.

## Importing frames
From the File menu:
- **Frames from a sprite sheet…:** slice it by rows × columns.
- **Frames from an image sequence…**
- **Frames from a GIF…**

## Export (File › Export sprite sheet / flipbook…)
- **Live preview**, played from the sheet itself.
- **Grid:** presets (Fit, 2×2, 4×4, 8×8, 16×16) or any size, plus what to do with leftover cells.
- **Frames:** frame size (100/50/25%), padding, edge extrusion, power-of-two sizes, and tags as separate rows.
- **Data files:** JSON for Unity, Godot and Unreal, or a Godot **SpriteFrames** resource.
- **Other outputs:** a **PNG sequence** or an animated **GIF**.

Animations are saved in .gouache files. They're also stored inside PSDs exported by Gouache Studio, so they come back when you reopen them here.

Animation mode paints base colour only, so switch to Paint mode for the other maps.
