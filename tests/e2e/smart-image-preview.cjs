/* A smart material with embedded pixels must apply and render its tile without turning those pixels into JSON. */
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '../../dist');
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({
      channel: process.env.GS_BROWSER_CHANNEL || 'msedge',
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage({viewport:{width:1100,height:800}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('gs.welcome', 'no');
      localStorage.setItem('gs.p3d', JSON.stringify({size:128,layout:'2d'}));
    });
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin + '/index.html?debug');
    await page.waitForFunction(() => window.__gs && __gs.gmRecs.some(r => r.bundled?.file === 'worn-steel.gmat'));
    await page.evaluate(() => {
      const G = __gs;
      G.closeWelcome();
      G.setMode('p3d', true);
      G.useModel(G.primMesh('sphere', 0));
      // Reproduce the V8 error as soon as a clone tries to stringify any saved picture.
      const stringify = JSON.stringify;
      JSON.stringify = function (value, replacer, space) {
        if (Array.isArray(replacer)) return stringify.call(this, value, replacer, space);
        return stringify.call(this, value, function (key, child) {
          if (key === 'data' && ArrayBuffer.isView(child) && child.byteLength >= 65536) {
            throw new RangeError('Invalid string length');
          }
          return typeof replacer === 'function' ? replacer.call(this, key, child) : child;
        }, space);
      };

      const size = 1024, data = new Uint8Array(size * size * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i+1] = data[i+2] = 224;
        data[i+3] = 255;
      }
      const imageLayer = {
        t:'L', name:'Red with a picture mask',
        fill:{proj:'uv', maps:{base:{on:true, src:'value', c:[.8,.04,.04]}}},
        mask:{rows:[{kind:'image', p:{name:'Embedded pixels'}, img:{w:size,h:size,data}}]}
      };
      const libLayer = {t:'L', name:'Library base', lib:'worn-steel', fill:{maps:{base:{on:true,c:[.4,.4,.4]}}}};
      window.smartImageOnly = G.smPut({kind:'smart', name:'Image only', tree:{t:'G',kids:[imageLayer]}});
      window.smartMixed = G.smPut({kind:'smart', name:'Mixed images', tree:{t:'G',kids:[libLayer,imageLayer]}});
    });
    const applied = await page.evaluate(async () => {
      const G = __gs;
      const inspect = node => {
        const target = node?.children.at(-1).mask.stack[0].t;
        return target && {w:target.w, sample:[...G.captureRegionNow(target,0,0,1,1).data]};
      };
      const plain = inspect(await G.smApply(window.smartImageOnly));
      const mixed = await G.smApply(window.smartMixed);
      const lib = mixed?.children[0]._fillImg?.base;
      return {plain,mixed:inspect(mixed),library:lib?lib._lib:null};
    });
    assert.deepEqual(applied, {
      plain:{w:1024,sample:[224,224,224,255]},
      mixed:{w:1024,sample:[224,224,224,255]},
      library:'worn-steel'
    });
    console.log('PASS embedded mask pixels and linked Library pictures apply together');

    const queued = await page.evaluate(() => {
      const G = __gs, source = G.doc.active;
      Object.assign(G.v3s(),{wire:true,wireOnly:true,unlit:true,channelView:'rough'});
      G.ui.viewMask = true;
      const project = {root:G.doc.root,active:G.doc.active,mesh:G.v3.mesh,view:G.doc.v3d,
        undo:G.hist.undo,mode:G.ui.mode,cam:G.v3.cam,sets:G.p3.sets};
      window.savedProject = project;
      function save(name) {
        G.smSave(source);
        document.getElementById('smName').value = name;
        document.getElementById('dlgOk').click();
        return G.matLib.list.find(r => r.name === name);
      }
      const a=save('Image preview A'),b=save('Image preview B');
      const target=source.children.at(-1).mask.stack[0].t;
      G.writeRegion(target,0,0,1,1,new Uint8Array([32,32,32,255]));
      return [!!a,!!b];
    });
    assert.deepEqual(queued, [false,false]);
    await page.waitForFunction(() => {
      const materials=__gs.matLib.list;
      window.previewFirst=materials.find(r=>r.name==='Image preview A');
      window.previewSecond=materials.find(r=>r.name==='Image preview B');
      return window.previewFirst?.thumb && window.previewSecond?.thumb;
    },{},{timeout:90000});
    const preview = await page.evaluate(async () => {
      const G = __gs, old = window.savedProject;
      const im = new Image();
      im.src = window.previewSecond.thumb;
      await im.decode();
      const c = document.createElement('canvas');
      c.width=im.width;c.height=im.height;
      const ctx=c.getContext('2d');
      ctx.drawImage(im,0,0);
      const d=ctx.getImageData(0,0,c.width,c.height).data;
      let red=0, clear=0;
      for(let i=0;i<d.length;i+=4){
        if(d[i+3]<10)clear++;
        else if(d[i]>d[i+1]*1.5&&d[i]>60)red++;
      }
      return {
        w:im.width,h:im.height,clear,red,samePreview:window.previewFirst.thumb===window.previewSecond.thumb,
        saved:[...window.previewSecond.tree.kids.at(-1).mask.rows[0].img.data.slice(0,4)],
        current:[...G.captureRegionNow(G.doc.active.children.at(-1).mask.stack[0].t,0,0,1,1).data],
        sameProject:G.doc.root===old.root&&G.doc.active===old.active&&G.v3.mesh===old.mesh&&
          G.doc.v3d===old.view&&G.hist.undo===old.undo&&G.ui.mode===old.mode&&G.v3.cam===old.cam&&
          G.p3.sets===old.sets&&G.v3s().wire&&G.v3s().channelView==='rough'&&G.ui.viewMask
      };
    });
    assert.equal(preview.w,256);
    assert.equal(preview.h,256);
    assert.ok(preview.clear>6000&&preview.red>6000,JSON.stringify(preview));
    assert.equal(preview.samePreview,true);
    assert.equal(preview.sameProject,true);
    assert.deepEqual(preview.saved,[224,224,224,255]);
    assert.deepEqual(preview.current,[32,32,32,255]);
    console.log('PASS two quick saves get isolated lit Material Preview thumbnails');

    const repaired = await page.evaluate(async () => {
      const G=__gs, r=window.previewFirst, expected=r.thumb;
      r.thumb='old viewport crop';
      G.setMode('paint',true);
      const root=G.doc.root;
      await G.smThumbRedo(r);
      return r.thumb===expected&&G.doc.root===root&&G.ui.mode==='paint';
    });
    assert.equal(repaired,true);
    await page.waitForFunction(async () => {
      const rec=window.previewFirst;
      const db=await new Promise((resolve,reject)=>{
        const request=indexedDB.open('gouache-studio');
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
      });
      try{
        const materials=db.transaction('materials').objectStore('materials');
        const read=id=>new Promise((resolve,reject)=>{
          const request=materials.get(id);
          request.onsuccess=()=>resolve(request.result);
          request.onerror=()=>reject(request.error);
        });
        const [recipe,tile]=await Promise.all([read(rec.id),read('smart-preview:'+rec.id)]);
        return recipe?.previewRev===rec.previewRev && !recipe.thumb && tile?.thumb===rec.thumb;
      }finally{db.close();}
    });
    await page.reload();
    await page.waitForFunction(() => __gs.matLib.list.some(r=>r.name==='Image preview A'&&r.thumb));
    const persisted=await page.evaluate(async () => {
      const G=__gs,rec=G.matLib.list.find(r=>r.name==='Image preview A');
      const layer=(await G.smApply(rec)).children.at(-1);
      return {thumb:rec.thumb.startsWith('data:image/'),sample:[...G.captureRegionNow(layer.mask.stack[0].t,0,0,1,1).data],
        visiblePreviewRecords:G.matLib.list.filter(r=>r.kind==='smart-preview').length};
    });
    assert.deepEqual(persisted,{thumb:true,sample:[224,224,224,255],visiblePreviewRecords:0});
    const painted=await page.evaluate(async () => {
      const G=__gs,size=1024,data=new Uint8Array(size*size*4);
      for(let i=0;i<data.length;i+=4){data[i]=56;data[i+1]=76;data[i+2]=96;data[i+3]=255;}
      const img={w:size,h:size,data},rec={name:'Paint and flat mask',
        tree:{t:'G',kids:[{t:'L',name:'Painted pixels',maps:{base:img},mask:{img}}]}};
      G.closeWelcome();
      const samples=[];
      for(const [w,depth] of [[1024,8],[128,8],[128,16]]){
        G.newDoc(w,w,depth,[1,1,1],'Texture',false);
        const layer=(await G.smApply(rec)).children[0];
        samples.push([layer.target,layer.mask.target].map(target=>{
          const data=G.captureRegionNow(target,0,0,1,1).data;
          const byte=v=>Math.round((1+(v&1023)/1024)*2**((v>>10)-15)*255);
          return {w:target.w,depth:target.depth,rgba:[...data].map(v=>depth===16?byte(v):v)};
        }));
      }
      return samples;
    });
    assert.deepEqual(painted,[[1024,8],[128,8],[128,16]].map(([w,depth])=>
      Array.from({length:2},()=>({w,depth,rgba:[56,76,96,255]}))));
    console.log('PASS painted layers and flat masks keep their pixels across texture sizes and bit depths');

    await page.evaluate(() => {
      const G=__gs;
      G.setMode('p3d',true);
      G.useModel(G.primMesh('sphere',0));
      const layer=G.cmdNewFillLayer({name:'Coat',maps:{base:{c:[.7,.2,.1]},rough:{v:.9},metal:{v:1}}});
      layer.opacity=.58;
      G.setMapOpacityOf(layer,'base',.35);
      G.setMapOpacityOf(layer,'rough',.72);
      G.setMapOpacityOf(layer,'metal',0);
      G.act('group');
      const group=G.doc.active;
      group.opacity=.8;
      G.setMapOpacityOf(group,'base',.6);
      G.setMapOpacityOf(group,'rough',.25);
      G.smSave(group);
      document.getElementById('smName').value='Channel opacity example';
      document.getElementById('dlgOk').click();
    });
    await page.waitForFunction(async () => {
      const G=__gs,rec=G.matLib.list.find(r=>r.name==='Channel opacity example');
      return rec?.thumb&&!!await G.store.getRaw(rec.id,'materials');
    });
    await page.reload();
    await page.waitForFunction(() => __gs.matLib.list.some(r=>r.name==='Channel opacity example'));
    const opacity=await page.evaluate(async () => {
      const G=__gs,rec=G.matLib.list.find(r=>r.name==='Channel opacity example');
      G.setMode('p3d',true);
      G.useModel(G.primMesh('sphere',0));
      const exported=await G.gmatParse(await G.gmatBlob({kind:'smart',name:'Exported opacity',...await G.smImgsOut({tree:rec.tree})}));
      const read=node=>['base','rough','metal','height'].map(k=>G.mapOpacityOf(node,k));
      const applied=await G.smApply(rec),imported=await G.smApply(exported);
      (applied.children[0].mapOpacities??={}).base=.9;
      const reapplied=await G.smApply(rec);
      const fx={t:'L',name:'Desaturate',fx:{map:'all',stack:[{id:'desat',v:{}}]}};
      const effectFolder=await G.smApply({name:'Faded filter',tree:{t:'G',op:.4,mapOpacities:{base:.2},kids:[fx]}});
      const standalone=await G.smApply({name:'Filter alone',tree:{t:'G',kids:[fx]}});
      return {folder:read(applied),layer:read(reapplied.children[0]),importedFolder:read(imported),importedLayer:read(imported.children[0]),
        effectFolder:{type:effectFolder.type,opacity:read(effectFolder)},standalone:standalone.fx?.map};
    });
    assert.deepEqual(opacity,{
      folder:[.6,.25,.8,.8],layer:[.35,.72,0,.58],
      importedFolder:[.6,.25,.8,.8],importedLayer:[.35,.72,0,.58],
      effectFolder:{type:'group',opacity:[.2,.4,.4,.4]},standalone:'all'
    });
    console.log('PASS saved and exported Smart Materials retain layer and group opacity for every channel');

    assert.deepEqual(errors,[]);
    console.log('PASS redo and restart load the new preview without rewriting the recipe');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode=1; });
