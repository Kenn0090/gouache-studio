// Builds Gouache Studio from src/ into:
//   dist-web/index.html  - one self-contained page (libraries and fonts from CDNs), for the browser version
//   dist/                - the desktop app's frontend (libraries and fonts bundled locally, works offline)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = p => path.join(root, p);
const read = p => fs.readFileSync(r(p), 'utf8');
const target = (process.argv.find(a => a.startsWith('--target=')) || '--target=all').split('=')[1];

const order = JSON.parse(read('src/js/order.json')).order;
const APP_VERSION = JSON.parse(read('package.json')).version;
const js = `const APP_VERSION='${APP_VERSION}';\n` + order.map(n => `/* ---- ${n}.js ---- */\n` + read(`src/js/${n}.js`)).join('\n');
const css = read('src/styles/app.css');
const tpl = read('src/index.template.html');
const assemble = head => tpl.replace(/<!--VERSION-->/g, APP_VERSION).replace('<!--HEAD-->', () => head).replace('<!--STYLE-->', () => css).replace('<!--SCRIPT-->', () => js);

function buildWeb() {
  fs.mkdirSync(r('dist-web'), { recursive: true });
  fs.writeFileSync(r('dist-web/index.html'), assemble(read('src/head.web.html')));
  console.log('web     -> dist-web/index.html');
}

function copy(from, to) { fs.mkdirSync(path.dirname(r(to)), { recursive: true }); fs.copyFileSync(r(from), r(to)); }
function buildDesktop() {
  const out = 'dist';
  fs.rmSync(r(out), { recursive: true, force: true });
  copy('node_modules/pako/dist/pako.min.js', `${out}/vendor/pako.min.js`);
  copy('node_modules/utif/UTIF.js', `${out}/vendor/UTIF.js`);
  copy('node_modules/ag-psd/dist/bundle.js', `${out}/vendor/ag-psd.js`);
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
