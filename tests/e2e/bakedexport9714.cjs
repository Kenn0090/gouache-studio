/* 0.97.14 (Kenn): Export baked maps in the export window (also for game engine exports), each map can be left out */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await(await b.newContext({viewport:{width:1500,height:1000}})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
await p.evaluate(async()=>{const G=__gs;await G.studioPreviewLoad();G.v3s().model='matpreview';});await p.waitForTimeout(600);
/* no baked maps yet: the window says so */
await p.evaluate(()=>__gs.dlgExportTextures());await p.waitForTimeout(500);
ok(await p.evaluate(()=>!!document.getElementById('txNoBaked')&&!document.getElementById('txMeshMaps')),'a set without baked maps says so instead of a tick');
await p.evaluate(()=>{document.querySelector('#modal .dlg-actions button.ghost,#modal [data-cancel]')?.click();__gs.closeDialog&&__gs.closeDialog();});await p.waitForTimeout(300);
await p.evaluate(async()=>{await __gs.studioPreviewMaps();});await p.waitForTimeout(1500);
await p.evaluate(()=>__gs.dlgExportTextures());await p.waitForTimeout(600);
ok(await p.evaluate(()=>!!document.getElementById('txMeshMaps')&&/Export baked maps/.test(document.getElementById('txMeshMaps').closest('label,div').textContent)),'the window has an Export baked maps tick');
await p.evaluate(()=>{const c=document.getElementById('txMeshMaps');if(!c.checked)c.click();});await p.waitForTimeout(400);
const rows=await p.evaluate(()=>[...document.querySelectorAll('#modal .texrow code')].map(c=>c.textContent).filter(t=>/Mesh_/.test(t)));
ok(rows.length>=6&&rows.some(r=>/Mesh_Position/.test(r))&&rows.some(r=>/Mesh_WorldNormal/.test(r)),'the file list shows the baked maps ('+rows.length+')');
ok(await p.evaluate(()=>document.querySelectorAll('#txMeshPick input').length>=6),'each baked map has its own tick');
await p.evaluate(()=>document.getElementById('txMesh_position').click());await p.waitForTimeout(300);
ok(await p.evaluate(()=>![...document.querySelectorAll('#modal .texrow code')].some(c=>/Mesh_Position/.test(c.textContent))),'unticking Position takes it off the list');
const files=await p.evaluate(async()=>{const G=__gs;const fs=await G.buildMeshMapTextures(G.TEX_PRESETS[G.texCfg.preset],'T');return fs.map(f=>f.name+':'+f.data.length);});
ok(files.length>=5&&!files.some(f=>/Position/.test(f))&&files.every(f=>+f.split(':')[1]>100),'the files are made without the unticked map ('+files.length+')');
ok(errs.length===0,'no page errors '+errs.join('|'));
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
