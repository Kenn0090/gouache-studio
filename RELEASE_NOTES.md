Smoother painting.

- **Fewer hitches.** After each stroke the app used to stop and wait for the graphics card to copy the undo snapshot and the layer thumbnails back to memory. That copy now happens in the background, so painting doesn't pause.
- **Faster strokes on documents with many layers.** While you paint, everything under the layer you're painting is drawn once and reused, instead of being redrawn every frame.
- **View › Performance monitor** shows the frame rate and the slowest recent moment, and what it was doing. If you still notice a hitch, turn it on and send me what it says.
