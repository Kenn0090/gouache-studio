// Builds Gouache Studio from src/ into:
//   dist-web/index.html  - one self-contained page (libraries and fonts from CDNs), for the browser version
//   dist/                - the desktop app's frontend (libraries and fonts bundled locally, works offline)
import zlib from 'zlib';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = p => path.join(root, p);
const read = p => fs.readFileSync(r(p), 'utf8');
const target = (process.argv.find(a => a.startsWith('--target=')) || '--target=all').split('=')[1];

const order = JSON.parse(read('src/js/order.json')).order;
/* every file shares one scope: a second top-level function/const with the same name silently replaces the first
   (0.26.1: a new applyShape in themes.js broke every selection tool), so the build stops on duplicates */
{const seen = new Map(), dup = [], glsl = new Set(['float','int','vec2','vec3','vec4','mat3','mat4','bool','uint']);
 for (const n of order) read(`src/js/${n}.js`).split('\n').forEach((l, i) => {
   const m = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(l); if (!m) return;
   const k = m[1] || m[2]; if (glsl.has(k)) return; if (seen.has(k)) dup.push(`${k}: ${seen.get(k)} and ${n}.js:${i + 1}`); else seen.set(k, `${n}.js:${i + 1}`); });
 if (dup.length) { console.error('Duplicate top-level names:\n  ' + dup.join('\n  ')); process.exit(1); }}
const APP_VERSION = JSON.parse(read('package.json')).version;
/* the Blender add-on (assets/addons), carried inside the app so it can be saved from the Export window */
const BLENDER_ADDON = fs.existsSync(r('assets/addons/gouache_link.py')) ? read('assets/addons/gouache_link.py') : '';
/* the change log for Help › What's new */
const CHANGELOG = fs.existsSync(r('CHANGELOG.md')) ? read('CHANGELOG.md') : '';
/* materials shipped with the app (assets/materials/*.gmat): a list with names and previews goes into the page; the
   files themselves are copied next to the desktop app and loaded when first used */
const GMATS = fs.existsSync(r('assets/materials')) ? fs.readdirSync(r('assets/materials')).filter(f => f.endsWith('.gmat')).sort().map(f => {
  let b = fs.readFileSync(r('assets/materials/' + f)); if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b);
  const j = JSON.parse(b.toString('utf8')); return { file: f, name: j.name || f.replace(/\.gmat$/, ''), thumb: j.thumb || '', credit: j.credit || '', kind: j.kind || 'material', cat: j.cat || 'Other' };
}) : [];
/* Small shelf previews are separate from originals in both offline and one-page builds.
   Stale previews are ignored so replacing a texture cannot show an unrelated picture. */
const TX_PREVIEW_DATA = {};
if (fs.existsSync(r('assets/grunge/previews.json'))) {
  const previews = JSON.parse(read('assets/grunge/previews.json'));
  for (const [slug, p] of Object.entries(previews.items || {})) {
    const file = r(`assets/grunge/${slug}.webp`);
    if (fs.existsSync(file) && crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') === p.sha256) TX_PREVIEW_DATA[slug] = p.image;
  }
}
const js = `const APP_VERSION='${APP_VERSION}';\nconst TX_PREVIEWS=${JSON.stringify(TX_PREVIEW_DATA)};\nconst GM_BUNDLED=${JSON.stringify(GMATS).replace(/<\//g, '<\\/')};\nconst BLENDER_ADDON=${JSON.stringify(BLENDER_ADDON).replace(/<\//g, '<\\/')};\nconst CHANGELOG_MD=${JSON.stringify(CHANGELOG).replace(/<\//g, '<\\/')};\n` + order.map(n => `/* ---- ${n}.js ---- */\n` + read(`src/js/${n}.js`)).join('\n');
const css = read('src/styles/app.css');
const tpl = read('src/index.template.html');
const assemble = head => tpl.replace(/<!--VERSION-->/g, APP_VERSION).replace('<!--HEAD-->', () => head).replace('<!--STYLE-->', () => css).replace('<!--SCRIPT-->', () => js);

/* the bundled HDRIs (assets/hdri): the desktop app loads them as files; the one-page web version carries them inside the page */
const HDRIS = fs.existsSync(r('assets/hdri')) ? fs.readdirSync(r('assets/hdri')).filter(f => f.endsWith('.hdr')) : [];
const GRUNGE = fs.existsSync(r('assets/grunge')) ? fs.readdirSync(r('assets/grunge')).filter(f => f.endsWith('.webp')) : [];
const BRUSHPACKS = fs.existsSync(r('assets/brushes')) ? fs.readdirSync(r('assets/brushes')).filter(f => f.endsWith('.webp')) : [];
const hdriTags = () => HDRIS.map(f => `<script type="text/plain" id="hdri_${f.replace(/_1k\.hdr$/, '')}">${fs.readFileSync(r('assets/hdri/' + f)).toString('base64')}</script>`)
  .concat(BRUSHPACKS.map(f => `<script type="text/plain" id="br_${f.replace(/\.webp$/, '')}">${fs.readFileSync(r('assets/brushes/' + f)).toString('base64')}</script>`))
  .concat(GRUNGE.map(f => `<script type="text/plain" id="gr_${f.replace(/\.webp$/, '')}">${fs.readFileSync(r('assets/grunge/' + f)).toString('base64')}</script>`)).join('\n');
function buildWeb() {
  fs.mkdirSync(r('dist-web'), { recursive: true });
  for (const g of GMATS) copy('assets/materials/' + g.file, `dist-web/materials/${g.file}`);
  fs.writeFileSync(r('dist-web/index.html'), assemble(read('src/head.web.html')).replace('<!--HDRI-->', () => hdriTags()));
  console.log('web     -> dist-web/index.html');
}

function copy(from, to) { fs.mkdirSync(path.dirname(r(to)), { recursive: true }); fs.copyFileSync(r(from), r(to)); }
function buildDesktop() {
  const out = 'dist';
  fs.rmSync(r(out), { recursive: true, force: true });
  copy('node_modules/pako/dist/pako.min.js', `${out}/vendor/pako.min.js`);
  copy('node_modules/utif/UTIF.js', `${out}/vendor/UTIF.js`);
  copy('node_modules/ag-psd/dist/bundle.js', `${out}/vendor/ag-psd.js`);
  for (const f of HDRIS) copy('assets/hdri/' + f, `${out}/hdri/${f}`);
  for (const g of GMATS) copy('assets/materials/' + g.file, `${out}/materials/${g.file}`);
  for (const f of GRUNGE) copy('assets/grunge/' + f, `${out}/grunge/${f}`);
  for (const f of BRUSHPACKS) copy('assets/brushes/' + f, `${out}/brushes/${f}`);
  // UI fonts bundled so the app looks right offline
  const fonts = [
    ['@fontsource/instrument-sans', 'Instrument Sans', [400, 500, 600]],
    ['@fontsource/jetbrains-mono', 'JetBrains Mono', [400, 500]],
  ];
  let fontCss = '';
  for (const [pkg, family, weights] of fonts) {
    for (const w of weights) {
      const file = `${pkg.split('/')[1]}-latin-${w}-normal.woff2`;
      copy(`node_modules/${pkg}/files/${file}`, `${out}/fonts/${file}`);
      fontCss += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${file}) format("woff2")}\n`;
    }
  }
  fs.writeFileSync(r(`${out}/fonts/fonts.css`), fontCss);
  const head = [
    '<link rel="stylesheet" href="fonts/fonts.css">',
    '<script defer src="vendor/pako.min.js"></script>',
    '<script defer src="vendor/UTIF.js"></script>',
    '<script defer src="vendor/ag-psd.js"></script>',
  ].join('\n');
  fs.writeFileSync(r(`${out}/index.html`), '<!doctype html>\n<html lang="en"><head>\n' + assemble(head).replace('<style>', '<meta name="viewport" content="width=device-width,initial-scale=1">\n<style>').replace('</style>', '</style>\n</head><body>') + '</body></html>\n');
  console.log('desktop -> dist/');
}

if (target === 'web' || target === 'all') buildWeb();
if (target === 'desktop' || target === 'all') buildDesktop();
