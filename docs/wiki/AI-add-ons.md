# AI add-ons

Some features use small AI models: pick out a subject or the sky with a click, take an object out of a photo, blur a background like a lens, add a light to a photo, and make a height map from a photo.

**Everything runs on your own computer** (on the graphics card when it can, otherwise the processor). Nothing is sent anywhere, and no account is needed. The app itself stays small: the models are separate downloads that you choose.

## Getting them
Open **File › AI add-ons…** (the app also offers it once after an update). Each part shows its size, licence and a Download button, and can be removed again:

| Part | Size | What it does |
|---|---|---|
| AI engine | 22 MB | Runs the models. Downloaded first, needed by the rest. |
| Select subject and sky | 40 MB | Click an object or press Select sky. |
| Depth | 99 MB | Lens blur, Relight, and a height map from a photo. |
| Remove | 208 MB | Takes an object out and fills the gap. |
| Upscale | 134 MB | Makes a picture 2×, 4× or 8× bigger and adds believable detail. |

"Run on" in the window lets you force the graphics card or the processor. Downloads are checked against a fingerprint, so a damaged file is refused. Models not used for a few minutes are unloaded to free memory.

## Where you use them
- **Photo tab** › *AI tools*: **Select subject…** (click; click more to add, Alt+click to take an area away) and **Select sky**. The result is a mask in *Masks*, with the usual sliders, Invert and range. *Remove*: press **Remove…** and paint over what you want gone (each removal can be undone). *Lens blur*: blurs by distance from a focus you pick, with a depth map you can look at. *Relight*: drag a light onto the picture; it shades the photo like a surface made from the depth map. You can use up to four lights (point, spotlight or sun), add shadows, shine and rim light, tint the dark side, or pick a ready-made lighting such as Golden hour, Window light, Studio, Neon or Candle (see the Photo tab page).
- **Paint tab**: **Select › Select subject (AI)…** and **Select › Select sky (AI)** make a selection from what you see. **Edit › Remove selection (AI)** fills the selection on the current layer from what is around it (Undo works).
- **Upscale** (makes a picture bigger): in the **Photo tab** open *Export…* and choose *Make it bigger (AI)*; in the **Paint tab** use **Image › Upscale (AI)…** (a bigger copy opens in a new tab, your document is not changed); in the **Convert tab** press **Upscale (AI)…** to swap the source for a bigger one, so every map is made at the bigger size. Choose 2×, 4× or 8× (8× is two passes). **AI detail** mixes in a plain smooth enlargement: 100% is full AI, lower is more natural. *Preview* shows a before/after of the middle of the picture at its real size. Big pictures are done in tiles; the window shows the new size first and refuses anything over the app's size limit. Stop ends the job.
- **Convert tab**: tick **Height from AI depth** to make the height map from the photo's depth instead of its brightness.

The first use of a picture takes a little while on a slow computer (a few seconds on a graphics card); later clicks on the same picture are quick.

## Credits and licences
All of these are free for any use (including selling the app); credit is kept here:
- ONNX Runtime (Microsoft), MIT: https://github.com/microsoft/onnxruntime
- SlimSAM (made from Segment Anything by Meta AI), Apache 2.0, ONNX files by Xenova: https://huggingface.co/Xenova/slimsam-77-uniform
- Depth Anything V2 Small, Apache 2.0, ONNX files by onnx-community: https://huggingface.co/onnx-community/depth-anything-v2-small
- Real-ESRGAN (Xintao Wang et al.), BSD 3-Clause, ONNX files by SceneWorks: https://huggingface.co/SceneWorks/real-esrgan-onnx
- LaMa (Samsung AI Center Moscow), Apache 2.0, ONNX files by Carve: https://huggingface.co/Carve/LaMa-ONNX

Models are downloaded from Hugging Face (and the engine from jsDelivr); you need a connection once, then it works offline.
