#!/usr/bin/env node
/* Builds the library that ships with the app from ambientCG (CC0) downloads.

   What it makes
     assets/materials/<name>.gmat   one ready-made material (1K pictures as WebP, a 256 px preview, category, credit)
     assets/grunge/<name>.webp      one grey 1024 px photo-grunge map

   How to run (needs `npm install` in the project folder and in tests/e2e, and a fresh `npm run build`, because the
   real app code in dist-web is what turns the pictures into a material):
     node scripts/lib-build.cjs scripts/lib-list.json              build everything in the list
     node scripts/lib-build.cjs scripts/lib-list.json materials    only the materials
     node scripts/lib-build.cjs scripts/lib-list.json grunge       only the grunge
     node scripts/lib-build.cjs scripts/lib-list.json Brass Runs   only entries whose name matches a word
   Existing files with the same name are replaced. Downloads are kept in a cache folder (LIB_CACHE, default
   <temp>/gouache-lib-cache) so a second run does not download again.

   The list file (scripts/lib-list.json)
     { "materials": [ { "id": "Metal048A", "name": "Brass", "cat": "Metal" }, ... ],
       "grunge":    [ { "id": "Scratches001", "name": "Brushed scratches", "ch": "Opacity", "invert": false,
                        "lo": 0.5, "hi": 99.5 }, ... ] }
   Material categories: Metal, Leather, Fabric, Plastic & rubber, Wood, Ground & nature, Stone & tile,
   Paint & ceramic (the Library buttons come from GM_CATS in src/js/layers/materials.js).
   Grunge: ch = which ambientCG picture to use (Opacity, Roughness, Displacement, Color, AmbientOcclusion);
   invert flips it (dark marks become bright); lo/hi = the percentiles that become black and white.
   After a grunge run, add the printed lines to TX_PHOTO in src/js/ui/textures.js, and the ids to the wiki credits. */
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'tests/e2e/node_modules/playwright'));
const CACHE = process.env.LIB_CACHE || path.join(os.tmpdir(), 'gouache-lib-cache');
fs.mkdirSync(CACHE, { recursive: true });

const listFile = path.resolve(process.argv[2] || path.join(__dirname, 'lib-list.json'));
const args = process.argv.slice(3);
const list = JSON.parse(fs.readFileSync(listFile, 'utf8'));
const doMat = !args.includes('grunge'), doGr = !args.includes('materials');
const words = args.filter(a => a !== 'materials' && a !== 'grunge').map(a => a.toLowerCase());
const want = e => !words.length || words.some(w => e.name.toLowerCase().includes(w) || e.id.toLowerCase() === w);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* download one 1K JPG zip (kept in the cache) */
function fetchZip(id) {
  const f = path.join(CACHE, id + '_1K-JPG.zip');
  if (fs.existsSync(f) && fs.statSync(f).size > 1000) return f;
  for (let t = 0; t < 5; t++) {
    try { cp.execFileSync('curl', ['-sS', '-L', '--fail', '-o', f, `https://ambientcg.com/get?file=${id}_1K-JPG.zip`]); if (fs.statSync(f).size > 1000) return f; }
    catch (e) { console.log('  download retry', id); }
  }
  throw new Error('could not download ' + id);
}
const zipEntry = (zip, id, ch) => {
  const names = cp.execFileSync('unzip', ['-Z1', zip]).toString().split('\n');
  const n = names.find(n => n.endsWith('_' + ch + '.jpg'));
  return n ? cp.execFileSync('unzip', ['-p', zip, n], { maxBuffer: 1 << 28 }) : null;
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const p = await ctx.newPage();
  const NM = path.join(ROOT, 'tests/e2e/node_modules/');
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('pako')) return r.fulfill({ path: NM + 'pako/dist/pako.min.js', contentType: 'text/javascript' });
    if (u.includes('UTIF.js')) return r.fulfill({ path: NM + 'utif/UTIF.js', contentType: 'text/javascript' });
    if (u.includes('ag-psd')) return r.fulfill({ path: NM + 'ag-psd/dist/bundle.js', contentType: 'text/javascript' });
    if (u.startsWith('file:')) return r.continue();
    return r.abort();
  });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('file://' + path.join(ROOT, 'dist-web/index.html') + '?debug');
  await p.waitForTimeout(2500);

  let total = 0;
  if (doMat) {
    fs.mkdirSync(path.join(ROOT, 'assets/materials'), { recursive: true });
    for (const e of list.materials.filter(want)) {
      const zip = fetchZip(e.id);
      const b64 = fs.readFileSync(zip).toString('base64');
      const out = await p.evaluate(async ({ b64, name, keep }) => {
        const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const files = await __gs.miUnzip(bin.buffer);
        const rec = await __gs.miBuild(files, name, 1024);
        /* keep the files small: the AO and opacity pictures are left out (colour already has the shading; opacity is
           nearly always plain white), unless the list entry says "keep": ["ao"] */
        for (const k of ['ao', 'opac']) if (rec.imgs[k] && !(keep || []).includes(k)) {
          delete rec.imgs[k]; const m = rec.fill.maps[k]; m.on = false; m.src = 'value'; delete m.name; m.v = 1;
        }
        /* pictures as WebP (like Materials › export, but WebP for every channel), smaller when a material is big */
        const enc = q => {
          const imgs = {};
          for (const k in rec.imgs) {
            const im = rec.imgs[k], c = document.createElement('canvas'); c.width = im.w; c.height = im.h;
            const x = c.getContext('2d'), id = x.createImageData(im.w, im.h), d = im.data;
            for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] || 1; id.data[i] = Math.min(255, d[i] * 255 / a); id.data[i + 1] = Math.min(255, d[i + 1] * 255 / a); id.data[i + 2] = Math.min(255, d[i + 2] * 255 / a); id.data[i + 3] = d[i + 3]; }
            x.putImageData(id, 0, 0); imgs[k] = { w: im.w, h: im.h, png: c.toDataURL('image/webp', q) };
          }
          return imgs;
        };
        let q = .85, imgs = enc(q);
        const size = o => Object.values(o).reduce((s, v) => s + v.png.length, 0) * 0.75;
        while (size(imgs) > 650e3 && q > .5) { q -= .05; imgs = enc(q); }
        const thumb = __gs.matPreviewEl(() => rec.fill, () => __gs.matRecTargets(rec), 256, 1).el.toDataURL('image/webp', 0.9);
        return { fill: rec.fill, imgs, thumb, q };
      }, { b64, name: e.name, keep: e.keep });
      const j = { app: 'Gouache Studio', kind: 'material', v: 1, name: e.name, fill: out.fill, imgs: out.imgs, thumb: out.thumb, credit: `ambientCG.com ${e.id} (CC0)`, cat: e.cat };
      const buf = zlib.gzipSync(Buffer.from(JSON.stringify(j)), { level: 9 });
      fs.writeFileSync(path.join(ROOT, 'assets/materials', slug(e.name) + '.gmat'), buf);
      total += buf.length;
      console.log(`${e.cat.padEnd(17)} ${e.name.padEnd(28)} ${e.id.padEnd(14)} ${(buf.length / 1024) | 0} KB (q ${out.q.toFixed(2)}, ${Object.keys(out.imgs).join('/')})`);
    }
  }
  if (doGr) {
    fs.mkdirSync(path.join(ROOT, 'assets/grunge'), { recursive: true });
    const lines = [];
    for (const e of list.grunge.filter(want)) {
      const zip = fetchZip(e.id);
      const jpg = zipEntry(zip, e.id, e.ch || 'Opacity');
      if (!jpg) { console.log('  MISSING', e.id, e.ch); continue; }
      const out = await p.evaluate(async ({ b64, e }) => {
        const bm = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b64)).blob());
        const S = 1024, c = new OffscreenCanvas(S, S), x = c.getContext('2d');
        x.drawImage(bm, 0, 0, S, S);
        const id = x.getImageData(0, 0, S, S), d = id.data, n = S * S, g = new Uint8Array(n), hist = new Uint32Array(256);
        for (let i = 0; i < n; i++) { let v = Math.round(.2126 * d[i * 4] + .7152 * d[i * 4 + 1] + .0722 * d[i * 4 + 2]); if (e.invert) v = 255 - v; g[i] = v; hist[v]++; }
        const pct = pc => { let s = 0; const t = n * pc / 100; for (let v = 0; v < 256; v++) { s += hist[v]; if (s >= t) return v; } return 255; };
        const lo = pct(e.lo == null ? .5 : e.lo), hi = Math.max(lo + 8, pct(e.hi == null ? 99.5 : e.hi)), gm = e.gamma || 1;
        for (let i = 0; i < n; i++) { let v = Math.min(1, Math.max(0, (g[i] - lo) / (hi - lo))); v = Math.pow(v, gm) * 255 + .5; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
        x.putImageData(id, 0, 0);
        let q = .86, blob = await c.convertToBlob({ type: 'image/webp', quality: q });
        while (blob.size > 300e3 && q > .5) { q -= .08; blob = await c.convertToBlob({ type: 'image/webp', quality: q }); }
        const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
        return { b64: btoa(s), lo, hi, q };
      }, { b64: jpg.toString('base64'), e });
      const buf = Buffer.from(out.b64, 'base64');
      fs.writeFileSync(path.join(ROOT, 'assets/grunge', slug(e.name) + '.webp'), buf);
      total += buf.length;
      lines.push(`['${slug(e.name)}','${e.name}']`);
      console.log(`grunge ${e.name.padEnd(24)} ${e.id.padEnd(24)} ${(buf.length / 1024) | 0} KB (levels ${out.lo}-${out.hi}, q ${out.q.toFixed(2)})`);
    }
    if (lines.length) console.log('\nFor TX_PHOTO in src/js/ui/textures.js:\n' + lines.join(','));
  }
  console.log('\nwritten: ' + (total / 1048576).toFixed(1) + ' MB');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
