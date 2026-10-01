# Gouache Studio 0.46.8

- The Textures shelf uses small previews instead of loading full images while you browse. All 99 built-in photo textures have bundled previews; generated patterns use temporary small previews.
- Imported textures stay packed until needed. New imports save a preview, and older imports create one when first shown and reuse it after reopening the app.
- Repeated requests share one texture load. Older unused full textures leave the cache during idle time, reducing graphics memory use.
- Applied textures and picture guides stay available for masks, layers, material channels, stencils and filters. Texture packs still export full-resolution originals.
- Thumbnail work runs in small batches and stops tracking tiles removed by searching, changing categories or closing the texture picker.
