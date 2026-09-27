Move, transform, warp and crop.

- **Move tool** (`V`): drag the selected layers, or only the selected pixels when there is a selection. Arrow keys nudge 1 px, Shift+arrow 10 px. Masks move with their layer.
- **Free transform** (`Ctrl+T`): corners scale proportionally (Shift stretches), sides scale one way, drag outside to rotate (Shift snaps 15°), `Ctrl`+drag a side to skew, `Ctrl`+drag a corner to distort, Alt works from the centre, and the centre mark can be moved.
- The transform panel has exact position, size, angle and skew fields, flip and 90° rotate buttons, and smooth, bilinear or pixel-art resampling. Everything is live; **Enter** applies as one undo step, **Esc** cancels. The image is resampled only once, however many adjustments you make.
- **Warp**: from the transform panel, bend the image with a grid (2×2 to 8×8) of points; click a point to show its curve handles for finer bends.
- **Crop tool** (`C`): drag the box, type an exact size, pick a ratio or a power-of-two size, drag just outside to straighten, or crop to the selection (also in the Image menu). Pixels outside are deleted; crop can be undone.
- In tile mode, moves and transforms wrap across the edges.
- Text layers become pixels when transformed; undo brings the editable text back.
