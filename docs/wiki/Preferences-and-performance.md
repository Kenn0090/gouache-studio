# Preferences and performance

## Preferences (Ctrl+K)

![Preferences.](images/preferences-memory.png)
*Preferences, with Memory and disk at the bottom (desktop app).*

- **Theme:** Dark, **Dark red** (the Dark theme with red accents), Darker, Warm and Light, or **Custom**: pick your own Background, Panels, Text, Highlight and Accent colours (**Start from…** copies a preset to begin with). Themes preview as you click; **Cancel** goes back.
- **Show shortcut hints on the canvas:** the line of keys at the bottom of the canvas. **View › Shortcut hints** turns it on and off too.
- **Keyboard shortcuts…** opens the shortcut editor (see [Keyboard shortcuts](Keyboard-shortcuts.md)).
- **Live previews:** filters, adjustments, Select menu changes and hover previews (blend modes, fonts) show on the canvas as you adjust them. Turn this off for very large documents or slower machines. Each dialog also has its own **Preview** checkbox.

## Memory and disk
Like Photoshop's memory and scratch disk settings.
- **Use up to:** the memory limit. The app shows how much memory your computer has and how much is free. Undo history and loaded models (the 3D view and the Bake tab) share this memory. Past it, the desktop app moves older undo steps to the **disk cache** and reads them back if you undo that far; the browser version drops the oldest steps. It starts at half your memory. Leave room for Windows and other apps: half to three quarters works well.
- **Undo steps:** how many steps the history keeps (20 to 1000).
- **Disk cache** (desktop app): the folder for undo steps past the memory limit and for the **search trees** of high-polys you've baked. Press **Change…** to put it on another drive (a fast SSD with plenty of space is best), or **Default** to go back. The app only writes inside a *Gouache Studio cache* folder there. Moving it takes the undo steps already on disk along.
- **Cache size:** the most the disk cache may hold. Past it, the oldest undo steps and the least recently used search trees are removed. The line below shows what's in it and how much space the drive has left. **Clear bake trees** deletes the saved search trees; they're rebuilt when needed.

Everything takes effect when you press **Save**. The performance monitor's last line shows the memory in use.

## Tile mode (Shift+T)
For seamless textures: strokes, blurs and patterns wrap across the edges, and the canvas shows neighbouring copies so seams are easy to spot. See also *Filter › Offset* and *Make seamless*.

## Bit depth
**Image › 8 bits / 16 bits per channel.** 16-bit (half float) avoids banding in smooth gradients and heavy adjustments. The Height map is always 16-bit when the graphics card supports it.

## Performance monitor

![The performance monitor.](images/performance-monitor.png)
*The performance monitor.*

**View › Performance monitor** shows the frame rate, the slowest recent frame, the longest freeze, and what the app was doing then: compositing, the view or thumbnails. Its last line shows memory: undo steps in memory (and on disk), loaded models, and the limit. If you notice a hitch, turn it on and note what it says.

## Tips for big documents
- **Hide the 3D view** or the Material view when you don't need them. They add work to every change.
- **Use cheaper filters while painting:** slow filters (painterly, lens and surface blur, live converters) catch up after each stroke. If painting under them still drags, hide their filter layers.
- **Stay at 8-bit** unless you need 16-bit.
