/* 0.22: per-material baking and Send to 3D Paint (model + mesh maps per texture set). */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 const waitIdle=async()=>{for(let i=0;i<900;i++){if(await p.evaluate(()=>!__gs.bk.busy&&!__gs.bk.regionBusy))return;await W(100);}};
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=bake]');await W(600);
 await p.evaluate(()=>{const o='v -2 -1 0\nv -0.1 -1 0\nv -0.1 1 0\nv -2 1 0\nv 0.1 -1 0\nv 2 -1 0\nv 2 1 0\nv 0.1 1 0\nv 0.1 -1 0.6\nv 2 -1 0.6\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nusemtl Left\nf 1/1 2/2 3/3 4/4\nusemtl Right\nf 5/1 6/2 7/3 8/4\nf 5/1 9/2 10/3 6/4\n';
   const C=__gs.bakeCfg;C.low=__gs.parseOBJ(o,'two_low.obj');C.high=null;C.cage=null;C.size=128;C.ss=1;C.pad=2;C.rays=32;C.aoDist=100;C.match=false;for(const k in C.kinds)C.kinds[k]=k==='ao';C.perMat=true;C.p3Layers=true;});
 await p.evaluate(()=>__gs.act('bake'));await W(400);
 await p.click('#bkGo');await W(300);await waitIdle();await W(300);
 let s=await p.evaluate(()=>({mats:__gs.bk.byMat&&Object.keys(__gs.bk.byMat),show:__gs.bk.matShow,res:Object.keys(__gs.bk.res),sel:!!document.querySelector('#bkMat')}));
 ok(s.mats&&s.mats.join()==='Left,Right'&&s.show==='Left'&&s.res.includes('ao')&&s.sel,'one bake per material '+JSON.stringify(s));
 /* the two materials' AO differ (Right has a wall next to it) */
 const avg=()=>p.evaluate(()=>{const d=__gs.readRGBA8(__gs.bk.res.ao);let s=0,n=0;for(let i=0;i<d.length;i+=4){s+=d[i];n++;}return s/n;});
 const aL=await avg();await p.selectOption('#bkMat','Right');await W(300);const aR=await avg();
 ok(Math.abs(aL-aR)>1,'each material has its own result ('+aL.toFixed(1)+' / '+aR.toFixed(1)+')');
 ok(await p.evaluate(()=>!!document.querySelector('#bkPerMat')&&document.querySelector('#bkPerMat').checked),'the panel offers baking each material separately');
 await p.click('#bkSendP3');await W(1500);
 s=await p.evaluate(()=>({mode:__gs.mode,model:__gs.v3.imported&&__gs.v3.imported.name,sets:__gs.p3.sets.map(S=>S.name),cur:__gs.p3.sets[__gs.p3.cur].name,mm:Object.keys(__gs.doc.meshMaps||{}),layers:__gs.allLayers().map(L=>L.name)}));
 ok(s.mode==='p3d'&&s.model==='two_low.obj'&&s.sets.join()==='Left,Right','Send to 3D Paint brings the low-poly and its sets '+JSON.stringify(s));
 ok(s.mm.includes('ao')&&s.layers.includes('Baked ambient occlusion'),'the set has the AO as a mesh map, and as a layer');
 const mmAvg=()=>p.evaluate(()=>{const d=__gs.readRGBA8(__gs.doc.meshMaps.ao);let s=0,n=0;for(let i=0;i<d.length;i+=4){s+=d[i];n++;}return s/n;});
 const m1=await mmAvg();await p.click('#p3dBody .p3set:has-text("Right")');await W(500);const m2=await mmAvg();
 ok(Math.abs(m1-m2)>1&&(await p.evaluate(()=>Object.keys(__gs.doc.meshMaps||{}).includes('ao'))),'each set got its own material’s bake ('+m1.toFixed(1)+' / '+m2.toFixed(1)+')');
 /* kept in the project file */
 await p.evaluate(async()=>{const b=await __gs.encodeP3Project();window.__pb=await b.arrayBuffer();});
 await p.evaluate(()=>{window.__o=__gs.openP3Project(window.__pb,'x').then(()=>'ok',e=>String(e));});await W(400);
 if(await p.evaluate(()=>!document.querySelector('#modal').hidden))await p.click('#dlgOk');ok((await p.evaluate(()=>window.__o))==='ok','project reopened');await W(600);
 ok(await p.evaluate(()=>!!(__gs.doc.meshMaps&&__gs.doc.meshMaps.ao)),'mesh maps kept in the project');
 await p.screenshot({path:OUT+'bakep3.png'});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
