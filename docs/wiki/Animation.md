# Animation, flipbooks and sprite sheets

Switch **Paint ▾ / Animation** in the top-right corner. Animation mode shows only frames. Each frame is its own image, and you paint it with the usual tools. Your paint-mode layers wait untouched until you switch back.

## Timeline (under the canvas)

![Animation mode: the timeline under the canvas, with onion skin.](images/animation.png)
*Animation mode: the timeline under the canvas, with onion skin.*

- **Frames:** add, duplicate, delete, and drag to reorder. **,** and **.** step through frames; **Enter** plays.
- **Quick dupli…:** make many copies of the current frame in one go. Pick **4, 8, 12, 16, 24, 32 or 64**, or type any number, and choose whether they go right after this frame or at the end. One undo removes them all.
- **Tools…:** **Reverse**, **Ping-pong** (forward, then back), **Repeat…** and **Set the hold…**. They work on the frames you picked with Shift+click, or on all frames.
- **Seconds ruler:** above the frames, with a mark where each second starts. Click or drag on it to scrub through the animation.
- **Speed:** frame rate buttons for **12, 24, 30 and 60 fps**, or type any rate up to 240. Each frame has a **hold** (how many frames it lasts).
- **Tags:** Shift+click a range of frames and tag it (idle, run, attack…). A tag can **loop**, **play once** or **ping-pong**.
- **Onion skin:** earlier frames in red, later ones in green. Choose how many to show and how faint they are.
- **Preview window:** keeps playing while you paint.

## Importing frames
From the File menu:
- **Frames from a sprite sheet…:** slice it by rows × columns.
- **Frames from an image sequence…**
- **Frames from a GIF…**

## Export (File › Export sprite sheet / flipbook…)
- **Frame rate and in-betweens:** **Export at** another rate (2×, 4×, 24 to 240 fps) and choose **In-between frames**: **Off** repeats the nearest frame, **Blend** cross-fades between frames, **Motion** follows the movement so a swinging sword or a rising flame glides instead of fading. The window shows how many frames you get. GIF files can't play faster than 50 fps.
- **Live preview**, played from the sheet itself.
- **Grid:** presets (Fit, 2×2, 4×4, 8×8, 16×16) or any size, plus what to do with leftover cells.
- **Frames:** frame size (100/50/25%), padding, edge extrusion, power-of-two sizes, and tags as separate rows.
- **Data files:** JSON for Unity, Godot and Unreal, or a Godot **SpriteFrames** resource.
- **Other outputs:** a **PNG sequence** or an animated **GIF**.

Animations are saved in .gouache files. They're also stored inside PSDs exported by Gouache Studio, so they come back when you reopen them here.

Animation mode paints base colour only, so switch to Paint mode for the other maps.

## Frame shortcuts
- **Ctrl+F** new frame, **Ctrl+D** duplicate the frame, **Delete** removes the frame (when nothing is selected)
- **,** and **.** step to the previous and next frame
- **Space** plays and stops (hold Space and drag to pan, as before)
- **Ctrl+Shift+Left/Right** moves the frame earlier or later

## Effects and keyframes

Under the frames is the **Effects** area. Pick **+ Effect…** to add Radial blur, Warp, Distort, Noise, Colour ramp and more. The effect sits over every frame. Press the **◆** next to a slider to set a keyframe on the current frame; do it on another frame with a different value and the slider moves by itself in between. Choose how it moves (Linear, Ease in, Ease out, Ease in-out, Hold) with **New keys**. The diamonds on the strip show the keys. Exports use the effects as you see them.

**Erode / Dissolve and Glow** are in the effect list too. Animate Dissolve's Amount from 0 to 100% to make something burn or erode away. **Quick dupli** can step an effect: pick the effect and a slider, and it moves from the first value to the last across the copies.
