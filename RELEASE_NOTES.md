# Gouache Studio 0.48.0

- **Material brush:** select a single material in the Materials shelf and press **Paint material**. Each stroke applies its enabled channels together, using one shared coverage mask. The material remains editable; undo removes the whole stroke.
- **Pen (P):** click for corners, drag for Bézier handles, close paths, and turn them into selections, fills or brush strokes. Edit points, width, hardness, opacity and point pressure in Tool settings. Paths save with the document.
- **Surface Path:** create editable curves on the model in 3D Paint, then paint colour or a library material along them. Paths follow the surface across UV seams and stay in place when the camera rotates. The first release supports Paint along path.
- Fixed black flashes when rotating the model during baking, and the blur/quality snap while painting on an 8K canvas.
- Added an undoable **Clear layer** button. Drag the lower-right corner of **Preferences** to resize it; its size is remembered.
