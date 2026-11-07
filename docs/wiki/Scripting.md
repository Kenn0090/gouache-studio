# Scripting

**Window › Scripts…** opens the Scripts window. A script is a short list of commands that does a job for you: set up layers, put the same material on every texture set, run a chain of filters, paint a stroke. Scripts are written in **JavaScript** (Python will come later and use the same commands). Every run is **one undo step**, so Ctrl+Z takes back everything a script did.

## The window
- **The list** (left): your saved scripts and the examples. Click one to load it.
- **The script** (middle): type here. **Tab** indents, **Ctrl+Enter** runs.
- **▶ Run** runs it; **Stop** stops it at its next command; **Save** keeps it under its name; **Load file… / Save file…** read and write `.js` files to share. Only run scripts from people you trust: a script can change your documents.
- **● Record**: press it, use the app as usual, then press **Stop recording**. What you did is added to the script as commands: new layers and materials, masks, colours, tools and brushes, filters with their settings, selections, tab changes, menu commands, and brush strokes on the flat canvas. (Strokes on the 3D model are not recorded yet.)
- **The log** shows what the script writes with `gouache.log(...)`, how long it took, and any mistake in plain words.
- **Commands** lists every command; click one to insert it.

## The commands
Colours are `[r, g, b]` from 0 to 1, or `"#rrggbb"`. Positions are canvas pixels (x to the right, y down). Commands marked *await* take a moment: write `await` before them.

| Command | What it does |
|---|---|
| `gouache.log(...)`, `gouache.toast(text)` | Write to the log; show a short message. |
| `await gouache.wait(ms)` | Pause. |
| `await gouache.ask(question, default)` | Ask a question; gives the answer (or null). |
| `gouache.mode()`, `await gouache.setMode('p3d')` | The tab: paint, p3d, anim, bake, convert, photo, brush. |
| `gouache.doc.info()` | Name, size, bits, maps, the map being edited, saved or not. |
| `await gouache.doc.new({width, height, bits, name, background})` | A new document (a new tab). |
| `await gouache.doc.open(path)`, `await gouache.doc.save()` | Open a file by its path (desktop app), save. |
| `gouache.doc.setMap('rough')` | Edit another map. |
| `gouache.layers.list()`, `.active()`, `.select(name)` | The layers (name, kind, opacity, blend, mask…). |
| `gouache.layers.add(name)`, `.addGroup(name)` | A paint layer, a group. |
| `gouache.layers.addMaterial({name, base, rough, metal, …})` | A material layer with those channels. |
| `await gouache.layers.addLibraryMaterial(name)`, `addSmartMaterial(name)`, `addSmartMask(name)` | From the Materials panel. |
| `gouache.layers.add3DGradient()` | A 3D gradient layer. |
| `gouache.layers.set(name, {opacity, blend, visible, name})` | Change a layer. |
| `.duplicate()`, `.delete()`, `.mergeDown()`, `.group([names])` | As in the layer menu. |
| `gouache.layers.addMask(name, 'white' / 'black')` | A mask. |
| `gouache.layers.addMaskRow(kind, settings)` | A mask row: `'gen'` (a generator: `{g:'edge'}`), `'noise'`, `'fill'`, `'dir'`, `'grad'`, `'g3d'`, `'filter'` (`{fx:'blur'}`)… |
| `gouache.layers.fill(colour)` | Fill the layer (inside the selection). |
| `gouache.select.all()`, `.none()`, `.invert()`, `.rect(x, y, w, h)` | Selections. |
| `gouache.paint.colour(c)`, `.tool(name)`, `.brush(name)`, `.size(px)`, `.opacity(v)` | The brush. |
| `await gouache.paint.stroke([[x, y, pressure], …])` | One stroke with the current brush. |
| `gouache.filters.list()`, `await gouache.filters.apply(id, settings)`, `.addFilterLayer(id, settings)` | Filters (settings on top of their defaults). |
| `gouache.p3d.sets()`, `await gouache.p3d.selectSet(name)`, `await gouache.p3d.inEverySet(fn)` | 3D Paint texture sets. |
| `await gouache.menu(id)`, `gouache.menus()` | Run any menu command; list them all. |
| `gouache.undo()`, `gouache.redo()` | Undo and redo. |

## Example
```js
// In every texture set: a rust material that shows on the edges
await gouache.setMode('p3d');
await gouache.p3d.inEverySet(async set => {
  gouache.layers.addMaterial({ name: 'Rust edges', base: [0.42, 0.2, 0.09], rough: 0.85 });
  gouache.layers.addMask(null, 'black');
  gouache.layers.addMaskRow('gen', { g: 'edge', amount: 0.55 });
  gouache.log('Done:', set);
});
```

## Coming next
Add-ons (shareable packs that add brushes, filters, generators, panels and menu items, each asking for the permissions it needs) and control from other programs (a local connection, off until you turn it on, and command-line runs) will use these same commands.
