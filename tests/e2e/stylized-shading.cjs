/* Tests the stylize layer, world-space brush projection and comic shading on the software GPU. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../../dist');
const preview = process.env.GOUACHE_STYLIZED_PREVIEW;

async function main() {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({
      channel: process.env.GOUACHE_TEST_BROWSER || (process.platform === 'win32' ? 'msedge' : undefined),
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage({viewport: {width: 1440, height: 920}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (/shader compile|shader link|WebGL: INVALID/i.test(message.text())) errors.push(message.text());
    });
    await page.addInitScript(() => {
      localStorage.setItem('gs.p3d', JSON.stringify({size: 256, layout: '3d'}));
      localStorage.setItem('gs.welcome', 'no');
    });
    await page.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
    await page.goto(url + '/index.html?debug');
    await page.waitForFunction(() => window.__gs);
    const arcane = await page.evaluate(async () => {
      const g = __gs, W = 160;
      g.closeWelcome();
      g.newDoc(W, W, 8, null, 'Paint study', false);
      const layer = g.doc.active, pixels = new Uint8Array(W * W * 4);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        if (x < 7 || y < 7) continue;
        const i = (y * W + x) * 4, right = x > W * 0.58 + 9 * Math.sin(y / 26);
        const light = 22 * Math.sin((x + 2 * y) / 29) + y * 0.3;
        pixels.set(right ? [46 + light, 71 + light, 106 + light, 255] : [153 + light, 64 + light, 32 + light, 255], i);
      }
      g.writeRegion(g.ensureMapTarget(layer, 'base'), 0, 0, W, W, pixels);
      g.changedAll();
      g.act('newArcanePaint');
      const filter = g.doc.active, v = filter.fx.stack[0].v;
      const controls = ['pa_fine', 'pa_dry', 'pa_edgeKeep', 'pa_tones'].every(id => document.getElementById(id));
      document.querySelector('#modal button.primary, #dlgOk')?.click();
      const grab = () => {
        g.changedAll();
        const t = g.compositeMap('base'), d = g.readRGBA8(t);
        g.release(t);
        return d;
      };
      const a = grab(), preset = v.preset;
      const change = (key, value) => {
        v[key] = value;
        filter.lookVer = (filter.lookVer || 0) + 1;
        return grab();
      };
      const diff = (a, b) => a.reduce((sum, q, i) => sum + (i % 4 === 3 ? 0 : Math.abs(q - b[i])), 0) / a.length;
      const fine = diff(a, change('fine', 0));
      change('fine', .52);
      const dry = diff(a, change('dry', 0));
      change('dry', .5);
      const tones = diff(a, change('tones', 0));
      const unchanged = diff(pixels, change('stylization', 0));
      change('stylization', 1);
      change('tones', .72);
      const saved = await g.encodeGouache();
      await g.openGouache(await saved.arrayBuffer(), 'paint-study.gouache');
      const reopened = g.allNodes(g.doc.root).find(n => n.fx?.stack[0]?.id === 'stylizeP');
      return {controls, preset, fine, dry, tones, unchanged, alpha: a[3], changed: diff(pixels, a), saved: reopened?.fx.stack[0].v.preset};
    });
    console.log('Arcane-inspired', arcane);
    assert(arcane.controls && arcane.preset === 'Arcane-inspired' && arcane.saved === arcane.preset);
    assert(arcane.fine > 0.1 && arcane.dry > 0.08 && arcane.tones > 1 && arcane.changed > 2);
    assert(arcane.unchanged < 0.1 && arcane.alpha === 0);
    await page.evaluate(() => {
      const g = __gs;
      g.setMode('p3d');
      g.useModel(g.parseOBJ([
        'v -1 -0.75 0', 'v 0 -0.75 0', 'v 0 0.75 0', 'v -1 0.75 0',
        'v 1 -0.75 0', 'v 1 0.75 0',
        'vt .05 .15', 'vt .45 .15', 'vt .45 .85', 'vt .05 .85',
        'vt .94 .15', 'vt .55 .15', 'vt .55 .85', 'vt .94 .85',
        'vn 0 0 1',
        'f 1/1/1 2/2/1 3/3/1', 'f 1/1/1 3/3/1 4/4/1',
        'f 2/5/1 5/6/1 6/7/1', 'f 2/5/1 6/7/1 3/8/1'
      ].join('\n')));
      Object.assign(g.v3.cam, {yaw: 0, pitch: 0, tx: 0, ty: 0, tz: 0, dist: 3.2});
      Object.assign(g.v3s(), {env: 'none', envBg: false, floor: false, paintAlign: 'uv', sizeSpace: 'viewport'});
      g.v3.paintOn = true;
      g.cmdNewNormalLayer();
      g.showPanel('tool');
      g.buildBrushPanel();
    });
    const worldButton = page.locator('.npsec .segb').filter({hasText: 'World direction'});
    await worldButton.evaluate(button => button.click());
    await page.evaluate(() => {
      const g = __gs;
      Object.assign(g.np, {worldAz: 42, worldEl: 25});
      Object.assign(g.brush, {size: 66, hardness: 0.95, opacity: 1, flow: 1, spacing: 0.1, smoothing: 0, tip: null, pSize: false, pOpacity: false, grain: 0});
    });
    const originalNormal = await page.evaluate(() => Array.from(__gs.readRGBA8(__gs.doc.active.maps.normal)));
    const hit = await page.locator('#v3Hit').boundingBox();
    const cx = hit.x + hit.width / 2, cy = hit.y + hit.height / 2;
    await page.mouse.move(cx - 100, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy, {steps: 12});
    await page.mouse.up();
    const world = await page.evaluate(() => {
      const g = __gs, L = g.doc.active, T = L.maps.normal, d = g.readRGBA8(T);
      const n = [0, 0], r = [0, 0];
      for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) {
        const i = (y * T.w + x) * 4, side = +(x >= T.w / 2);
        if (d[i + 3] < 245) continue;
        n[side]++;
        r[side] += d[i] / d[i + 3];
      }
      const select = document.getElementById('p3ChannelView');
      select.value = 'world';
      select.dispatchEvent(new Event('change', {bubbles: true}));
      g.v3Refresh();
      const out = g.v3Offscreen(400, 300, {overlays: false});
      const at = x => Array.from(out.slice((150 * 400 + x) * 4, (150 * 400 + x) * 4 + 3));
      return {coverage: n, red: r.map((q, i) => q / n[i]), left: at(174), right: at(226), map: g.doc.map};
    });
    console.log('World Direction', world);
    assert(world.map === 'normal' && world.coverage.every(n => n > 100));
    assert(world.red[0] > 0.68 && world.red[1] < 0.32);
    assert(world.left[0] > 185 && world.left.every((q, i) => Math.abs(q - world.right[i]) < 8));
    await page.keyboard.press('m');
    assert.equal(await page.evaluate(() => __gs.v3s().worldNormalView), false);
    await page.evaluate(() => __gs.undo());
    const undone = await page.evaluate(() => Array.from(__gs.readRGBA8(__gs.doc.active.maps.normal)));
    assert.deepEqual(undone, originalNormal, 'Undo restores the exact normal map');
    await page.evaluate(() => {
      const g = __gs;
      g.useModel(g.primMesh('sphere', 0));
      Object.assign(g.v3.cam, {yaw: 0.08, pitch: 0.14, dist: 3.2, tx: 0, ty: 0, tz: 0});
      Object.assign(g.v3s(), {sunAz: 50, sunEl: 37, sunI: 1.2, shadowRes: 1024, shadows: true, skyI: 0.63});
      g.showPanel('shading');
      g.renderShading();
    });
    await page.locator('#shKind').evaluate(select => {select.value = 'hatch';select.dispatchEvent(new Event('change'));});
    const comic = await page.evaluate(preview => {
      const g = __gs, W = 480, H = 400, L = g.doc.active;
      const set = p => g.shadeEdit(sh => Object.assign(sh.p.hatch ||= {}, p));
      const frame = (time = 0) => g.v3Offscreen(W, H, {time, overlays: false});
      const diff = (a, b) => a.reduce((sum, q, i) => sum + (i % 4 === 3 ? 0 : Math.abs(q - b[i])), 0) / a.length;
      const png = (() => {
        if (!preview) return null;
        const d = frame(), c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d'), im = ctx.createImageData(W, H);
        for (let y = 0; y < H; y++) im.data.set(d.subarray((H-1-y)*W*4, (H-y)*W*4), y*W*4);
        ctx.putImageData(im, 0, 0);
        return c.toDataURL().split(',')[1];
      })();
      set({drift: 0, sweep: 0, speed: 1});
      const a = frame(), still = diff(a, frame(1.25));
      set({weight: 0});
      const ink = diff(a, frame());
      set({weight: .74, drift: .85});
      const motion = diff(frame(0), frame(0.62));
      set({drift: 0, sweep: 55});
      const sweep = diff(frame(0), frame(1.9));
      let animation = null;
      if (preview) {
        const frames = [], width = 384, height = 320, count = 30;
        set({drift: .42, sweep: 55, speed: 2 * Math.PI / (5 * 0.8)});
        for (let i = 0; i < count; i++) {
          const data = g.v3Offscreen(width, height, {time: i / 6, overlays: false}), top = new Uint8Array(data.length);
          for (let y = 0; y < height; y++) top.set(data.subarray((height-1-y)*width*4, (height-y)*width*4), y*width*4);
          frames.push(top);
        }
        const bytes = g.gifEncode(width, height, frames, 17);
        animation = Array.from(bytes);
      }
      set({sweep: 0, drift: 0, speed: 1});
      const t = L.maps.normal, source = new Uint8Array(t.w*t.h*4);
      for (let y=0; y<t.h; y++) for (let x=0; x<t.w; x++){
        if((x>>4)%2===0)source.set([188,160,231,255],(y*t.w+x)*4);
      }
      g.writeRegion(t, 0, 0, t.w, t.h, source);
      g.changedAll();g.v3.mapsDirty = true;g.v3Refresh();
      const nrm = diff(a, frame());
      set({outline: 0});
      const noOutline = frame();
      set({outline: 6, outlineOpacity: 1, ocol: [0.9, 0.2, 0.1]});
      const outlined = frame();
      set({outlineOn: false});
      const toggle = diff(noOutline, frame());
      set({outlineOn: true, outlineOpacity: 0.4});
      const faintOutline = frame();
      const outline = diff(noOutline, outlined), opacity = diff(noOutline, faintOutline);
      set({outline: 0, pattern: 1});
      const pattern = diff(noOutline, frame());
      set({pattern: 0});
      return {ink, still, motion, sweep, nrm, outline, opacity, toggle, pattern,
        controls: ['sh_sweep', 'shHatchOutline', 'sh_outlineOpacity', 'sh_ocol', 'shHatchTexture'].every(id => document.getElementById(id)),
        preview: png, animation};
    }, !!preview);
    if (preview && comic.preview) fs.writeFileSync(path.join(preview, 'gouache-comic-crosshatch.png'), Buffer.from(comic.preview, 'base64'));
    if (preview && comic.animation) fs.writeFileSync(path.join(preview, 'gouache-animated-crosshatch.gif'), Buffer.from(comic.animation));
    delete comic.preview;
    delete comic.animation;
    console.log('Comic Crosshatch', comic);
    assert(comic.controls && comic.ink > 1.0 && comic.still < 0.05);
    assert(comic.motion > 0.035 && comic.sweep > 3 && comic.nrm > 1);
    assert(comic.outline > 0.3 && comic.opacity > 0.1 && comic.opacity < comic.outline && comic.toggle === 0);
    assert(comic.pattern > 0.3);
    await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#000';
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 16, 0, 4, 64);
      const blob = await new Promise(resolve => c.toBlob(resolve));
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([blob], 'Test hatch.png', {type: 'image/png'}));
      document.querySelector('#shHatchTexture .fxddrop').dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer}));
    });
    await page.waitForFunction(() => __gs.doc.v3shade?.p?.hatch?.gimg?.kind === 'project', null, {timeout: 10000});
    await page.evaluate(() => __gs.v3Offscreen(320, 256, {time: 0}));
    const custom = await page.evaluate(async () => {
      const g = __gs, render = () => g.v3Offscreen(320, 256, {time: 0, overlays: false});
      const difference = (a, b) => a.reduce((sum, q, i) => sum + (i % 4 === 3 ? 0 : Math.abs(q - b[i])), 0) / a.length;
      const set = settings => g.shadeEdit(sh => Object.assign(sh.p.hatch, settings));
      const attached = g.doc.v3shade.p.hatch.gimg;
      const withImage = render();
      set({gimg: null});
      const without = render();
      set({gimg: attached, ginv: true});
      const inverted = render();
      const project = await g.encodeP3Project();
      const open = g.openP3Project(await project.arrayBuffer(), 'hatch-test.gouache3d');
      document.getElementById('dlgOk')?.click();
      await open;
      g.v3Offscreen(320, 256, {time: 0});
      return {texture: difference(withImage, without), invert: difference(withImage, inverted),
        saved: g.doc.v3shade.p.hatch.gimg.name === 'Test hatch' && g.doc.v3shade.p.hatch.ginv &&
          g.doc.projectAssets.some(a => a.rec.id === attached.id && a.rec.z.length > 0)};
    });
    console.log('Custom hatch', custom);
    assert(custom.texture > 0.3 && custom.invert > 0.3 && custom.saved);
    assert.deepEqual(errors, []);
    console.log('ALL PASSED');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {console.error(error);process.exitCode = 1;});
