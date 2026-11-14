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
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage({viewport:{width:1200,height:850}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.text().startsWith('Resolution test:')) console.log(m.text());
      if (/shader compile|shader link|WebGL: INVALID/i.test(m.text())) errors.push(m.text());
    });
    await page.addInitScript(() => {
      localStorage.setItem('gs.p3d', JSON.stringify({size:1024,layout:'3d'}));
      localStorage.setItem('gs.welcome', 'no');
    });
    await page.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
    await page.goto(url + '/index.html?debug');
    await page.waitForFunction(() => window.__gs);
    const result = await page.evaluate(async () => {
      const g = __gs, {doc} = g;
      const must = (condition, message) => { if (!condition) throw new Error(message); };
      const hash = t => {
        const px = g.captureRegionNow(t,0,0,t.w,t.h).data;
        let s = 2166136261;
        for (const v of px) s = Math.imul(s ^ v, 16777619);
        return s >>> 0;
      };
      const options = (color, more = {}) => ({
        ...g.BRUSH_DEFAULTS, tool:'brush',color,size:17,hardness:1,spacing:.17,flow:.7,opacity:.84,
        pSize:true,pFlow:true,tip:null,simP:'off',...more
      });
      const brush = (L,o,x,y) => {
        g.beginStroke(L,x,y,.55,o);
        g.addPoint(x+91,y-34,.94);
        g.addPoint(x+131,y+9,.35);
        g.endStroke(true);
      };
      const replayCount = t => {
        let count = 0;
        for (let s=t._paintSource?.tail;s;s=s.prev) count++;
        must(!t._paintStale,'Paint source was stale');
        return count;
      };
      g.closeWelcome();
      g.setMode('p3d');
      g.useModel(g.parseOBJ([
        'v -1 -1 0','v 1 -1 0','v 1 1 0','v -1 1 0',
        'vt 0 0','vt 1 0','vt 1 1','vt 0 1','vn 0 0 1',
        'usemtl Main','f 1/1/1 2/2/1 3/3/1','f 1/1/1 3/3/1 4/4/1',
        'v 1.3 -1 0','v 1.6 -1 0','v 1.3 1 0','usemtl Trim','f 5/1/1 6/2/1 7/4/1'
      ].join('\n')));
      Object.assign(g.v3.cam,{yaw:0,pitch:0,tx:0,ty:0,tz:0,dist:3.2});
      Object.assign(g.v3s(),{paintAlign:'camera',sizeSpace:'viewport',disp:0});
      const low = doc.w, high = low * 4;
      const firstSet = g.p3.cur, trim = g.p3.sets.findIndex(s=>s.name==='Trim');
      g.p3SwitchSet(trim,true);
      g.p3SwitchSet(firstSet,true);
      const layer = doc.active;
      layer.name = 'UV and camera';
      const rough = g.ensureMapTarget(layer,'rough');
      const height = g.ensureMapTarget(layer,'height');
      brush(layer,options([.92,.16,.02],{tip:g.TIPS.square,extras:[
        {key:'rough',mode:1,color:[.75,.75,.75]}, {key:'height',mode:1,color:[.6,.6,.6]}
      ]}),300,270);
      must(replayCount(layer.maps.base)===1&&replayCount(rough)===1,'UV stroke and extra map recorded');
      const first = hash(layer.maps.base);
      const normal = g.ensureMapTarget(layer,'normal');
      g.setEditMap('normal');
      brush(layer,options([.5,.5,1],{space:g.meshSpace(256,256),cageRs:.54,noTint:true,
        worldNormal:[.45,.28,.85],extras:[]}),79,133);
      must(replayCount(normal)===1,'World direction normal stroke recorded');
      const lowNormal = hash(normal);
      g.setEditMap('base');
      const space = g.meshSpace(256,256);
      brush(layer,options([.09,.7,.92],{space,cageRs:.54,extras:[],dual:{
        on:true,tipKey:'b:sponge',size:20,spacing:80,scatter:50,count:1,mode:0,amount:50
      }}),79,134);
      must(replayCount(layer.maps.base)===2,'Camera stroke recorded');
      const second = hash(layer.maps.base);
      must(second!==first,'Camera stroke changed color');
      await g.undo();
      must(hash(layer.maps.base)===first&&replayCount(layer.maps.base)===1,'Undo restored source');
      await g.redo();
      must(hash(layer.maps.base)===second&&replayCount(layer.maps.base)===2,'Redo restored source');
      g.cmdAddMask(1);
      const row = g.msAdd(layer,'paint');
      const et = g.editTarget();
      brush(et.L,options([0,0,0],{noTint:true,extras:[]}),312,270);
      const lowMask = hash(row.t),lowRough = hash(rough),lowHeight = hash(height);
      must(replayCount(row.t)===1,'Mask Paint row recorded');
      const sig = g.p3Sig();
      const pending = g.p3Resize(high);
      document.querySelector('#loadBox .lb-x').click();
      must(await pending===false&&doc.w===low&&g.p3Sig()===sig,'Cancelled resize preserved document');
      must(await g.p3Resize(high)&&doc.w===high,'Resize to 4K completed');
      console.log('Resolution test: Rebuilt at 4K');
      g.p3SwitchSet(trim,true);
      must(doc.w===low,'Resizing the Main texture set left Trim at 1K');
      g.setMode('paint',true);
      g.setMode('p3d',true);
      must(doc.w===low,'A smaller texture set retained its size after a tab switch');
      g.p3SwitchSet(firstSet,true);
      must(doc.w===high,'Returning to Main restored its 4K size');
      must(replayCount(layer.maps.base)===2&&row.t.w===high,'Both strokes and mask rebuilt at 4K');
      const highHash = hash(layer.maps.base);
      const legacy = g.newLayerObj('Legacy raster');
      g.insertNode(legacy,doc.root);
      const pattern = new Uint8Array([255,0,0,255, 0,0,0,255, 0,0,0,255, 255,0,0,255]);
      g.writeRegion(legacy.maps.base,2049,2049,2,2,pattern);
      const legacyHash = hash(legacy.maps.base);
      must(await g.p3Resize(low)&&doc.w===low,'Resize back to 1K completed');
      must(hash(layer.maps.base)===second&&hash(row.t)===lowMask&&hash(layer.maps.rough)===lowRough
        &&hash(layer.maps.height)===lowHeight&&hash(layer.maps.normal)===lowNormal,'Round-trip was pixel exact');
      const legacyLow = hash(legacy.maps.base);
      g.clearTarget(g.sel.t,[1,1,1,1]);
      g.sel.active = true;
      brush(legacy,options([0,.8,0],{sel:true,extras:[]}),100,120);
      g.sel.active = false;
      const retouched = hash(legacy.maps.base);
      must(retouched!==legacyLow&&legacy.maps.base._paintSource.tail.patch,'Pixel edit kept a local change');
      await g.undo();
      must(hash(legacy.maps.base)===legacyLow,'Undo restored the original image before the pixel edit');
      await g.redo();
      must(hash(legacy.maps.base)===retouched,'Redo restored the pixel edit');
      const saved = await g.encodeP3Project();
      console.log('Resolution test: Saved at 1K');
      g.p3.savedAt=g.p3Sig();
      await g.openP3Project(await saved.arrayBuffer(),'Resolution test');
      const reopened = g.layerByName('UV and camera');
      const reopenedLegacy = g.layerByName('Legacy raster');
      must(replayCount(reopened.maps.base)===2,'The file retained UV and projected strokes');
      const undo = g.hist.undo;
      const config = {...g.texCfg};
      Object.assign(g.texCfg,{size:high,pad:'none',fmt:'png'});
      const preset = {name:base=>base+'_{s}',outs:[{s:'BaseColor',rgb:'base',a:true}]};
      const exported = await g.buildTextures(preset,'Resolution',{replay:true});
      console.log('Resolution test: Exported directly at 4K');
      const header = new DataView(exported[0].data.buffer,exported[0].data.byteOffset);
      must(header.getUint32(16)===high&&doc.w===low&&g.hist.undo===undo,'Export rendered at 4K and restored 1K workspace');
      must(await g.p3Resize(high),'Saved texture rebuilt at 4K');
      must(hash(reopened.maps.base)===highHash,'Reopened projected stroke was pixel exact');
      must(hash(reopenedLegacy.maps.base)!==legacyHash,'The lower-resolution edit survived the 1K save');
      const pixels = g.captureRegionNow(reopenedLegacy.maps.base,2049,2049,2,2).data;
      must(pattern.every((value,i)=>value===pixels[i]),'The local edit preserved the untouched 4K raster detail');
      const native = await g.buildTextures(preset,'Resolution',{replay:true});
      for(const [i,{data,suffix}] of native.entries()){
        const direct=exported[i].data;
        must(data.length===direct.length&&data.every((v,j)=>v===direct[j]),'4K '+suffix+' exports differed ('+direct.length+' vs '+data.length+' bytes)');
      }
      Object.assign(g.texCfg,config);
      const bumpPreset={name:preset.name,outs:[{s:'Normal',rgb:'normal'}]};
      Object.assign(g.texCfg,{size:512,pad:'none',fmt:'png'});
      const directNormal=(await g.buildTextures(bumpPreset,'Bump',{replay:true}))[0].data;
      must(await g.p3Resize(512),'Lower-resolution normals rebuilt');
      const workingNormal=(await g.buildTextures(bumpPreset,'Bump',{replay:true}))[0].data;
      must(directNormal.length===workingNormal.length&&directNormal.every((v,i)=>v===workingNormal[i]),
        'The normal map exported at the same strength from either working size');
      Object.assign(g.texCfg,config);
      return {low,high,strokes:replayCount(reopened.maps.base),savedBytes:saved.size,exportedBytes:exported[0].data.length};
    });
    console.log(result);
    assert.deepEqual(errors,[]);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
