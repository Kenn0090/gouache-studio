Faster baking, and memory settings like Photoshop's.

- **Faster AO and thickness bakes:** about 3 times faster at the default settings, more with 16× anti-aliasing. A pixel's rays are now shared out over its anti-aliasing samples, and every ray finds the high-poly quicker.
- **No more banding in AO and thickness:** the rays are spread evenly and randomly, and they no longer shade their own triangle.
- **Big high-polys:** sorting the high-poly (*Sorting triangles…*) runs in the background with a percentage, uses much less memory, and works past 16 million triangles.
- **Memory and disk** in Preferences (Ctrl+K): a memory limit (the app shows how much memory your computer has), how many undo steps to keep, and a **disk cache** folder you can move to another drive, with a size limit. Undo steps past the memory limit go to the disk cache.
- **Bake search trees are cached:** baking the same high-poly again, even after a restart, skips the sorting step.
- The performance monitor shows the memory in use.
