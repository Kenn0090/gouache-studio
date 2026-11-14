const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '../../dist');
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
      args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage({viewport:{width:1440,height:960}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {if (/shader compile|shader link|WebGL: INVALID/i.test(msg.text())) errors.push(msg.text());});
    await page.addInitScript(() => {
      localStorage.setItem('gs.welcome','no');
      localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'2d'}));
    });
    await page.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
    await page.goto(url + '/index.html?debug');
    await page.waitForFunction(() => window.__gs);
    await page.evaluate(() => {
      const g=__gs;
      g.closeWelcome();g.setMode('p3d');
      const {w,h}=g.doc;
      const texture=sample=>{
        const target=g.makeTarget(w,h,8,false),pixels=new Uint8Array(w*h*4);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const v=sample(x,y);pixels.set([v,v,v,255],(y*w+x)*4);
        }
        g.writeRegion(target,0,0,w,h,pixels);
        return target;
      };
      g.doc.meshMaps={
        curvEdge:texture((x,y)=>Math.abs(y-h*.49)<2 ? 240 : Math.abs(y-h*.49)<8 ? 55 : 0),
        ao:texture(x=>x<w/2?255:0)
      };
      g.cmdNewFillLayer({name:'Varnish',maps:{base:{on:true,c:[.31,.1,.064]}}});
    });
    const shelf=page.locator('#dkShelf');
    await shelf.getByRole('tab',{name:'Generators',exact:true}).click();
    await page.getByRole('searchbox',{name:'Search generators',exact:true}).fill('wood edge wear');
    await shelf.getByRole('button',{name:'Wood Edge Wear',exact:true}).click();
    assert.equal(await page.evaluate(()=>__gs.doc.active.name),'Varnish');
    assert.equal(await page.locator('#ms_g').inputValue(),'woodWear');
    await page.locator('#ms_woodStyle').selectOption('splintered');
    assert.equal(await page.evaluate(()=>__gs.doc.active.mask.stack.at(-1).p.woodSplinters),.9);
    await page.locator('#ms_proj').getByRole('button',{name:'UV',exact:true}).click();
    await page.locator('#ms_woodAngle').waitFor();
    const results=await page.evaluate(async()=>{
      const g=__gs,L=g.doc.active,row=L.mask.stack.at(-1),{w,h}=g.doc;
      const base={...row.p,woodScan:'',woodSplinters:0,woodGrain:.85,edgeGrow:0,distort:0,woodAngle:0,proj:'uv'};
      const render=overrides=>{
        Object.assign(row.p,base,overrides);L.mask._key=null;g.msUpdate(L);
        return g.captureRegionNow(L.mask.target,0,0,w,h).data;
      };
      const val=(a,x,y)=>a[(y*w+x)*4], delta=(a,b)=>a.reduce((s,v,i)=>i%4?s:s+Math.abs(v-b[i]),0);
      const mass=(a,x0,x1)=>{let total=0;for(let x=x0;x<x1;x++)for(let y=0;y<h;y++)total+=val(a,x,y);return total;};
      const narrow=render({}),wide=render({edgeGrow:1}),angled=render({woodAngle:90}),warped=render({distort:1}),
        splitting=render({woodOutput:'splinters',woodSplinters:1}),noWear=render({amount:0}),openCavities=render({cavityProtection:0});
      const ref={kind:'photo',id:'grunge-wood-splits',name:'Split Wood Fibres'};
      await g.txTarget(ref);
      const scanned=render({woodScan:ref.id,woodScanAmount:1});
      const inverted=render({inv:true});
      return {narrow:mass(narrow,0,w),wide:mass(wide,0,w),angle:delta(narrow,angled),warp:delta(narrow,warped),
        splitting:mass(splitting,0,w),flat:val(wide,18,8),disabled:mass(noWear,0,w),
        cavity:mass(narrow,w/2,w),openCavity:mass(openCavities,w/2,w),scan:delta(narrow,scanned),
        inverted:val(inverted,18,8)};
    });
    assert(results.narrow>1000 && results.wide>results.narrow*1.2 && results.flat===0,JSON.stringify(results));
    assert(results.angle>3000 && results.warp>3000 && results.splitting>1000 && results.scan>1000,JSON.stringify(results));
    assert(results.disabled===0 && results.cavity<results.openCavity*.3 && results.inverted===255,JSON.stringify(results));
    assert.deepEqual(errors,[]);
    console.log('PASS Wood Edge Wear mask, wood presets, grain direction, splinters, growth, distortion, cavity protection and offline scan');
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
