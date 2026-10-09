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
const MAT_PREVIEWS = fs.existsSync(r('assets/materials/previews.json')) ? JSON.parse(read('assets/materials/previews.json')).items || {} : {};
const GMATS = fs.existsSync(r('assets/materials')) ? fs.readdirSync(r('assets/materials')).filter(f => f.endsWith('.gmat')).sort().map(f => {
  let b = fs.readFileSync(r('assets/materials/' + f)); if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b);
  const j = JSON.parse(b.toString('utf8')), p = MAT_PREVIEWS[f], valid = p && p.file === path.basename(p.file) && fs.existsSync(r('assets/material-previews/' + p.file)) && p.sha256 === crypto.createHash('sha256').update(fs.readFileSync(r('assets/materials/' + f))).digest('hex');
  return { file: f, name: j.name || f.replace(/\.gmat$/, ''), thumb: valid ? 'material-previews/' + p.file : j.thumb || '', preview: valid ? p.file : null, credit: j.credit || '', kind: j.kind || 'material', cat: j.cat || 'Other', wf: j.wf || '' };
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
const studioFonts=JSON.parse(read('assets/fonts/manifest.json'));
const studioFontCss=studioFonts.map(f=>`@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:url(${f.file}) format("truetype")}`).join('\n');
const css = read('src/styles/app.css');
const tpl = read('src/index.template.html');
const assemble = head => tpl.replace(/<!--VERSION-->/g, APP_VERSION).replace('<!--HEAD-->', () => head).replace('<!--STYLE-->', () => css).replace('<!--SCRIPT-->', () => js);

/* the bundled HDRIs (assets/hdri): the desktop app loads them as files; the one-page web version carries them inside the page */
const HDRIS = fs.existsSync(r('assets/hdri')) ? fs.readdirSync(r('assets/hdri')).filter(f => f.endsWith('.hdr')) : [];
const GRUNGE = fs.existsSync(r('assets/grunge')) ? fs.readdirSync(r('assets/grunge')).filter(f => f.endsWith('.webp')) : [];
const BRUSHPACKS = fs.existsSync(r('assets/brushes')) ? fs.readdirSync(r('assets/brushes')).filter(f => f.endsWith('.webp')) : [];
/* Pack the supplied brush alphas efficiently for desktop and self-contained web builds. */
function bmpMaskPng(b) {
  const i16=o=>b.readUInt16LE(o),i32=o=>b.readInt32LE(o),offset=i32(10),dib=i32(14),w=i32(18),rawH=i32(22),bits=i16(28),compression=i32(30);
  if(w<1||!rawH||bits!==8||compression!==0)throw new Error('Unsupported brush BMP: expected an uncompressed 8-bit image');
  const h=Math.abs(rawH),topDown=rawH<0,paletteAt=14+dib,row=Math.floor((w*bits+31)/32)*4,raw=Buffer.alloc((w+1)*h);
  for(let y=0;y<h;y++){const sy=topDown?y:h-1-y,dst=y*(w+1),src=offset+sy*row;for(let x=0;x<w;x++){const ix=b[src+x],p=paletteAt+ix*4,B=b[p],G=b[p+1],R=b[p+2];raw[dst+1+x]=Math.round(.2126*R+.7152*G+.0722*B);}}
  const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  const chunk=(name,data)=>{const t=Buffer.from(name),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);let c=0xffffffff;for(const v of t)c=crcTable[(c^v)&255]^(c>>>8);for(const v of data)c=crcTable[(c^v)&255]^(c>>>8);crc.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([len,t,data,crc]);};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const USER_BRUSHES=fs.existsSync(r('assets/brushes/user'))?fs.readdirSync(r('assets/brushes/user')).filter(f=>/\.(png|bmp)$/i.test(f)).sort().map(f=>{
  const src=fs.readFileSync(r('assets/brushes/user/'+f)),out=f.replace(/\.bmp$/i,'.png');
  return {file:out,data:/\.bmp$/i.test(f)?bmpMaskPng(src):src};
}):[];
function userBrushTag(f) { const x=USER_BRUSHES.find(v=>v.file===f);return '<script type="text/plain" id="user_brush_'+f.replace(/[^a-z0-9]/gi,'_')+'">'+x.data.toString('base64')+'</script>'; }

const STUDIO = fs.readdirSync(r('assets/studio')).filter(f => /\.(png|gz)$/.test(f));
const hdriTags = () => HDRIS.map(f => `<script type="text/plain" id="hdri_${f.replace(/_1k\.hdr$/, '')}">${fs.readFileSync(r('assets/hdri/' + f)).toString('base64')}</script>`)
  .concat(BRUSHPACKS.map(f => `<script type="text/plain" id="br_${f.replace(/\.webp$/, '')}">${fs.readFileSync(r('assets/brushes/' + f)).toString('base64')}</script>`))
  .concat(GRUNGE.map(f => `<script type="text/plain" id="gr_${f.replace(/\.webp$/, '')}">${fs.readFileSync(r('assets/grunge/' + f)).toString('base64')}</script>`)).concat(STUDIO.map(f => `<script type="text/plain" id="studio_${f.replace(/[^a-z0-9]/gi,'_')}">${fs.readFileSync(r('assets/studio/'+f)).toString('base64')}</script>`)).concat(USER_BRUSHES.map(x=>userBrushTag(x.file))).join('\n');
function buildWeb() {
  fs.mkdirSync(r('dist-web'), { recursive: true });
  for(const f of studioFonts){copy('assets/fonts/'+f.file,'dist-web/fonts/'+f.file);copy('assets/fonts/'+f.license,'dist-web/fonts/'+f.license);}
  fs.writeFileSync(r('dist-web/fonts/studio.css'),studioFontCss);
  for (const g of GMATS) copy('assets/materials/' + g.file, `dist-web/materials/${g.file}`);
  for (const g of GMATS) if(g.preview) copy('assets/material-previews/' + g.preview, `dist-web/material-previews/${g.preview}`);
  fs.writeFileSync(r('dist-web/index.html'), assemble(read('src/head.web.html')+'<link rel="stylesheet" href="fonts/studio.css">').replace('<!--HDRI-->', () => hdriTags()));
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
  for (const g of GMATS) if(g.preview) copy('assets/material-previews/' + g.preview, `${out}/material-previews/${g.preview}`);
  for (const f of GRUNGE) copy('assets/grunge/' + f, `${out}/grunge/${f}`);
  for(const f of STUDIO) copy('assets/studio/'+f,`${out}/studio/${f}`);
  for(const f of studioFonts){copy('assets/fonts/'+f.file,`${out}/fonts/${f.file}`);copy('assets/fonts/'+f.license,`${out}/fonts/${f.license}`);}
  for (const f of BRUSHPACKS) copy('assets/brushes/' + f, `${out}/brushes/${f}`);
  for (const f of USER_BRUSHES) { const p=out+'/brushes/user/'+f.file; fs.mkdirSync(r(path.dirname(p)), { recursive: true }); fs.writeFileSync(r(p), f.data); }
  // UI fonts bundled so the app looks right offline
  const fonts = [
    ['@fontsource/instrument-sans', 'Instrument Sans', [400, 500, 600]],
    ['@fontsource/jetbrains-mono', 'JetBrains Mono', [400, 500]],
  ];
  let fontCss = studioFontCss+'\n';
  for (const [pkg, family, weights] of fonts) {
    for (const w of weights) {
      const file = `${pkg.split('/')[1]}-latin-${w}-normal.woff2`;
      copy(`node_modules/${pkg}/files/${file}`, `${out}/fonts/${file}`);
      fontCss += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(${file}) format("woff2")}\n`;
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
