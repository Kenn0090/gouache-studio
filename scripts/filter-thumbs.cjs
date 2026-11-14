/* Regenerate the Filters shelf previews after npm run build:desktop. */
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'assets/filter-thumbs');

async function main() {
  const browser = await chromium.launch({
    channel: process.env.GOUACHE_TEST_BROWSER || (process.platform === 'win32' ? 'msedge' : undefined),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {if (/shader compile|shader link|WebGL: INVALID/i.test(m.text())) errors.push(m.text());});
    await page.addInitScript(() => localStorage.setItem('gs.welcome', 'no'));
    await page.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort());
    await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href + '?debug');
    await page.waitForFunction(() => window.__gs);
    const thumbnails = await page.evaluate(() => {
      const size = 192, thumbSize = 128;
      const g = __gs;
      g.closeWelcome();
      g.newDoc(size, size, 8, null, 'Filter samples', false);
      const sample = document.createElement('canvas');
      sample.width = sample.height = size;
      const ctx = sample.getContext('2d');
      const paint = (color, points) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
        ctx.closePath();
        ctx.fill();
      };
      const circle = (color, x, y, radius) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      };
      const gradient = (from, to, y = size) => {
        const fill = ctx.createLinearGradient(0, 0, 0, y);
        fill.addColorStop(0, from);
        fill.addColorStop(1, to);
        return fill;
      };
      let randomState = 142;
      const random = () => ((randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) / 4294967296);
      const landscape = () => {
        ctx.fillStyle = gradient('#24294a', '#dd8274', 120);
        ctx.fillRect(0, 0, size, size);
        circle('#ffcf9e', 132, 52, 33);
        paint('#7383a2', [[0,115],[26,95],[50,98],[75,72],[99,99],[130,86],[158,100],[192,74],[192,145],[0,145]]);
        paint('#abb8c5', [[48,97],[75,72],[99,99],[78,91],[68,95],[71,86]]);
        paint('#345b70', [[0,51],[25,56],[55,108],[72,114],[88,139],[0,153]]);
        paint('#507f83', [[25,56],[55,108],[72,114],[88,139],[51,119],[38,103],[34,82]]);
        paint('#203e50', [[0,78],[30,91],[47,122],[65,141],[0,154]]);
        paint(gradient('#397685','#14263d'), [[0,140],[94,126],[192,118],[192,192],[0,192]]);
        for (let i = 0; i < 46; i++) {
          const y = 127 + random()*63, width = 3 + random()*39;
          const x = 110 + random()*72 - width/2;
          ctx.fillStyle = i%3 ? '#e8a389' : '#f9ceae';
          ctx.globalAlpha = .2 + random()*.65;
          ctx.fillRect(x, y, width, .75 + random()*1.6);
        }
        ctx.globalAlpha = 1;
        paint('#262a3d', [[0,192],[0,161],[32,149],[49,151],[63,147],[76,157],[99,164],[82,173],[104,183],[149,192]]);
        paint('#bd695c', [[0,162],[32,149],[49,151],[63,147],[76,157],[52,155],[24,166],[0,171]]);
        paint('#a34b47', [[37,149],[40,93],[57,93],[62,150]]);
        paint('#edaa8b', [[40,93],[49,93],[47,149],[37,149]]);
        paint('#302b42', [[34,94],[48,77],[62,94]]);
        ctx.fillStyle = '#ffead4';ctx.fillRect(45, 98, 8, 11);
        ctx.fillStyle = '#333044';ctx.fillRect(47, 128, 7, 21);
        for (let i = 0; i < 1500; i++) {
          const x = random()*size, y = random()*size;
          ctx.fillStyle = i%2 ? '#fed4ae0f' : '#151a3910';
          ctx.fillRect(x, y, 1+random()*4, 1+random());
        }
      };
      const decal = () => {
        ctx.clearRect(0, 0, size, size);
        circle('#efd3a0', 97, 96, 73);
        circle('#a64d38', 97, 96, 64);
        circle('#d67d55', 97, 96, 58);
        paint('#ffe5b9', [[97,45],[108,82],[147,96],[108,108],[97,148],[84,108],[47,96],[84,83]]);
        paint('#562f3e', [[97,45],[97,96],[84,83],[97,45],[108,82],[97,96],[147,96],[108,108],[97,96],[97,148],[84,108],[97,96],[47,96]]);
      };
      const lights = () => {
        ctx.fillStyle = '#1e2442';ctx.fillRect(0, 0, size, size);
        [[29,49,10,'#ffb58c'],[87,62,16,'#fff0cc'],[131,36,8,'#ee8997'],[152,119,13,'#84d3e3'],
          [53,139,18,'#fbceb4'],[99,153,8,'#ffc587'],[173,66,6,'#fbceb4'],[101,108,6,'#d0eaf5']]
          .forEach(([x,y,r,color]) => circle(color,x,y,r));
      };
      const sourceTarget = g.makeTarget(size, size, 8, false);
      const destination = g.makeTarget(size, size, 8, false);
      const full = document.createElement('canvas');full.width = full.height = size;
      const fullCtx = full.getContext('2d');
      const thumb = document.createElement('canvas');thumb.width = thumb.height = thumbSize;
      const thumbCtx = thumb.getContext('2d');
      thumbCtx.imageSmoothingQuality = 'high';
      const rgba = () => {
        const data = ctx.getImageData(0, 0, size, size).data, pixels = new Uint8Array(data.length);
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const from = (y*size+x)*4, to = ((size-1-y)*size+x)*4, a = data[from+3]/255;
          for (let k = 0; k < 3; k++) pixels[to+k] = Math.round(data[from+k]*a);
          pixels[to+3] = data[from+3];
        }
        return pixels;
      };
      landscape();const landscapePixels = rgba();
      decal();const decalPixels = rgba();
      lights();const lightPixels = rgba();

      // The stylize and edge wear filters read shape information as well as color.
      const shape = g.makeTarget(size, size, 8, false);
      const shapePixels = new Uint8Array(size*size*4);
      for (let i = 0; i < shapePixels.length; i += 4) {
        const v = Math.round(128+Math.tanh((landscapePixels[i]-landscapePixels[i+2])/48)*91);
        shapePixels.set([v,v,v,255],i);
      }
      g.writeRegion(shape, 0, 0, size, size, shapePixels);
      g.doc.meshMaps = {curv:shape};
      g.setDocMaps(['base','curv'],'Add sample curvature');
      g.writeRegion(g.ensureMapTarget(g.doc.active,'curv'),0,0,size,size,shapePixels);

      // Exaggerate subtle or neutral defaults just enough to read at shelf size.
      const examples = {
        colorAdj:{temp:47,sat:22,contrast:11}, levels:{lv:{...g.fxDefaults(g.FX.levels).lv,m:[.09,1.48,.89,0,1]}},
        curves:{pts:{...g.fxDefaults(g.FX.curves).pts,m:[[0,.05],[.38,.22],[.64,.82],[1,1]]}},
        hueSat:{h:80,s:33}, gradMap:{pick:7}, delight:{r:72,even:1,shad:.45}, posterize:{n:4}, quantize:{n:7,d:.3},
        blur:{r:20}, boxBlur:{x:18,y:3}, radialBlur:{a:38}, lensBlur:{r:21,b:3.5,t:.45},
        surfBlur:{r:11,t:44}, motionBlur:{a:-29,d:67}, driftBlur:{len:78,curve:.8,sc:88,ang:22},
        sharpen:{r:3.5,a:2.8}, highPass:{r:18}, convolve:{k:[-1,0,1,-2,0,2,-1,0,1],abs:true,lum:false,step:3},
        warp:{amt:29,size:76}, slopeBlur:{mode:'min',guide:'noise',amt:26,size:40}, distort:{kind:'waves',amt:25,size:52},
        filmGrain:{amt:.81,size:3.3}, dissolve:{t:.49,sc:35,edge:.11}, vfxGlow:{amt:3.25,r:27,th:.2,tint:[1,.71,.74]},
        oilPaint:{r:8,p:2}, painterly:{r:9,flow:4}, kuwahara:{r:7,p:3}, watercolour:{r:6,bleed:9,light:.52},
        charcoal:{len:22,con:.6}, mosaic:{c:24,g:2,bv:.3,gcol:[.12,.14,.20,1]},
        acid:{amt:58,sc:66,hue:.77}, glass:{mode:'rib',amt:16,sc:18,ang:23}, emboss:{h:4},
        paintEmboss:{width:9,depth:2.2}, ghostDecal:{tear:.51}, edges:{a:2.8}, noise:{a:.49,mono:false},
        softFocus:{amt:1,r:24,glow:1.55}, anaglyph:{off:14}, halftone:{cell:14}, engraving:{sp:9}, riso:{mis:8},
        pixelBitmap:{px:12}, retroPixel:{...g.RETRO_PRESETS.find(([id])=>id==='psx')[2],res:20},
        clouds:{ca:[.08,.13,.29],cb:[.69,.82,.91]}, cells:{mode:1,ca:[.08,.20,.25],cb:[.51,.81,.73]},
        offset:{x:59,y:44}, seamless:{w:.57}, tile:{nx:3}, edgeWear:{src:'curv',k:3,e:1.1,c:.85},
        arcane:{sSize:66,tones:.91}, stylizeP:{sSize:114,sLen:2.2,sCVar:.65,sHard:.71},
        stylizeG:{size:8,bristle:.58,cvar:.16}, handPaint:{sSize:66,sAmt:.7}
      };
      const items = {};
      try {
        for (const [, records] of g.shelfFilterGroups()) for (const {id} of records) {
          const item = g.shelfFilterItem(id);
          const {v} = item;
          if ('seed' in v) v.seed = 11;
          if ('meshSeams' in v) v.meshSeams = false;
          Object.assign(v, examples[id]);
          const input = ['ghostDecal','paintEmboss','dissolve'].includes(id) ? decalPixels :
            ['lensBlur','vfxGlow','softFocus'].includes(id) ? lightPixels : landscapePixels;
          g.writeRegion(sourceTarget, 0, 0, size, size, input);
          g.clearTarget(destination);
          g.FX[item.id].render(sourceTarget, destination, v, {k:'base'});
          const pixels = g.readRGBA8(destination), image = fullCtx.createImageData(size, size);
          let difference = 0, minLight = 255, maxLight = 0;
          for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            const from = ((size-1-y)*size+x)*4, to = (y*size+x)*4, a = pixels[from+3]/255;
            for (let k = 0; k < 3; k++) {
              difference += Math.abs(pixels[from+k]-input[from+k]);
              // Composite premultiplied output over a dark neutral swatch.
              image.data[to+k] = pixels[from+k]+[31,35,45][k]*(1-a);
            }
            const light = .21*image.data[to]+.72*image.data[to+1]+.07*image.data[to+2];
            minLight = Math.min(minLight, light);maxLight = Math.max(maxLight, light);
            image.data[to+3] = 255;
          }
          if (maxLight-minLight < 12) throw new Error('Filter sample is too flat: '+id);
          if (difference/(size*size*3) < .6) throw new Error('Filter sample shows no visible change: '+id);
          fullCtx.putImageData(image, 0, 0);
          thumbCtx.drawImage(full, 0, 0, thumbSize, thumbSize);
          items[id] = thumb.toDataURL('image/webp', .89);
        }
      } finally {
        g.disposeTarget(sourceTarget);g.disposeTarget(destination);
      }
      return items;
    });
    if (errors.length) throw new Error(errors.join('\n'));
    fs.mkdirSync(output, {recursive: true});
    for (const [id, image] of Object.entries(thumbnails)) {
      if (!image.startsWith('data:image/webp;base64,')) throw new Error(`WebP encoding failed for ${id}`);
      fs.writeFileSync(path.join(output, `${id}.webp`), Buffer.from(image.split(',')[1], 'base64'));
    }
    console.log(`Rendered ${Object.keys(thumbnails).length} filter thumbnails.`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {console.error(error);process.exitCode = 1;});
