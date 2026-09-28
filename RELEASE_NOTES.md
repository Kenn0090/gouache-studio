Fixes the model locking up in the 3D view.

- **Double-clicking the model** no longer selects text on the page. That selection was what the next drag grabbed, so the model stopped turning until you clicked somewhere else.
- **Alt** no longer puts the window into Windows' hidden menu mode, which could swallow the next click.
- If a mouse or pen release is ever missed, turning and painting now stop by themselves instead of getting stuck.
- Holding Alt over the model picks the colour when the pointer rests, so a big model stays smooth.
