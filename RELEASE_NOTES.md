# Gouache Studio 0.49.0

Big PSD files open, the picture can be turned and flipped, and Transform warp has its own key. This release also carries the three dry-ink brushes from 0.45.2, which never went out because the version number had slipped back.

- **Big PSDs open.** A PSD with hundreds of megapixels of layers (like a sketchbook file with 120 layers) no longer stops with "exceeds memory limit". Layers are unpacked one at a time, and any part of a layer hanging outside the page is left out.
- **Turn the view** (View menu): Alt+, and Alt+. turn it 15°, hold R and drag (or Shift+Space and drag) to turn it freely, Rotate view… for an exact angle, Alt+0 straightens it. Every tool keeps working through the turned view.
- **Flip the view left-right** (Alt+H) to check a drawing with fresh eyes. The picture itself is not changed.
- **Flip a layer** left-right or top-bottom (Edit menu, Ctrl+Alt+H and Ctrl+Alt+V), with undo.
- **Turn or flip the whole canvas** (Image menu): 90° either way, 180°, flip left-right (Ctrl+Alt+Shift+H) and top-bottom (Ctrl+Alt+Shift+V). Undo history is cleared, like Canvas size.
- **Transform warp** is now its own command (Edit menu, Ctrl+Alt+T), so you can give it any key in Edit › Keyboard shortcuts.
- Rulers and guides hide while the view is turned.
