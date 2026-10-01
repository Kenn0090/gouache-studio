# Gouache Studio 0.46.7

- Painting reuses unchanged layers inside nested groups. Effects below cached layers no longer force full redraws of every plain stroke; dependent effects and masks keep the full redraw path.
- Large save images are packed in a background worker and read back asynchronously from the graphics card, reducing work on the main UI thread. Existing project files stay compatible, including lossless masks and 16-bit height.
- Saving briefly holds edits and tab changes while capturing a consistent document. Animation playback waits during capture and resumes afterward.
- Unused scratch textures are trimmed during idle time. Layer pixels, undo history and textures still in use are preserved.
- Performance monitor now reports tracked texture storage, scratch reuse, partial/full redraw counts, GPU frame timings when available and save preparation stages.
