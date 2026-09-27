# Fills and gradients

Press **G** for the fill tools; **Shift+G** cycles through them.

## Paint bucket
Fills similar colours with the foreground colour.
- **Settings:** Tolerance, Opacity, Contiguous, Sample all layers, Anti-alias.
- **Selection:** with a selection active, the fill stays inside it.
- **Other maps:** in multi-map documents, it also fills the other maps that are switched on (*Also fill* in the panel).

## Gradient tool

![Dragging a gradient.](images/gradient.png)
*Dragging a gradient.*

Drag to draw a gradient. It becomes a **live gradient layer**: drag its end points later, click the line to add a colour stop, and change the colours any time.
- **Shapes:** linear, radial, angle, reflected, diamond.
- **Blending:**
  - **Perceptual** (OKLab): clean, even steps. This is the default.
  - **Linear light.**
  - **Classic:** like Photoshop.
- **Other options:** opacity stops, **Reverse**, and **Dither**, which stops banding in 8-bit documents.
- **Presets:** foreground to background, foreground to transparent, black to white, and several colour ramps.

Painting on a gradient layer turns it into pixels; **Undo** brings the editable gradient back.

## Gradient bucket
Press inside an area and drag a direction. The gradient fills only that area, found the same way as the paint bucket finds its area.

## Fill and Clear
- **Alt+Backspace** fills with the foreground colour, on the whole layer or inside the selection.
- **Backspace / Del** clears the layer or the selection.
- **Other maps:** in multi-map documents, both follow the brush's *Also paint* switches.
