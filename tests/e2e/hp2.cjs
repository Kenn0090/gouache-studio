const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const fs=require('fs');const txt=fs.readFileSync(__dirname+'/fixtures/high.obj','utf8');
 await p.evaluate(()=>__gs.newDoc(256,256,8,[.5,.5,.5],'D',false));
 await p.click('#modeTabs [data-mode=bake]');await p.waitForTimeout(500);
 ok(await p.$('#bk_highLoad')!==null,'Load… buttons');
 const drop=async(sel,name,txt)=>{await p.evaluate(([sel,name,txt])=>{const dt=new DataTransfer();dt.items.add(new File([txt],name));const t=document.querySelector(sel);
   t.dispatchEvent(new DragEvent('dragover',{dataTransfer:dt,bubbles:true,cancelable:true}));t.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));},[sel,name,txt]);await p.waitForTimeout(800);};
 await drop('#bakeBody .note','rock_high.obj',txt);
 ok(await p.evaluate(()=>__gs.bakeCfg.high&&__gs.bakeCfg.high.name==='rock_high'),'drop anywhere: _high goes to High-poly');
 await drop('#pane3d','thing.obj',txt);
 ok(await p.evaluate(()=>__gs.bakeCfg.low&&__gs.bakeCfg.low.name==='thing'),'drop unnamed model with high set → Low-poly (on the 3D view)');
 await drop('#bk_cageLoad','whatever.fbx','not a real fbx');
 ok(await p.evaluate(()=>!__gs.bakeCfg.cage),'bad FBX is refused');
 await p.evaluate(()=>{__gs.bakeCfg.low=null;__gs.bakeCfg.high=null;});
 await drop('#bk_high','other.obj',txt);ok(await p.evaluate(()=>__gs.bakeCfg.high&&__gs.bakeCfg.high.name==='other'),'drop on the High-poly row');
 // loading bar shows while a model loads (big file)
 await p.evaluate(()=>{window.__lb=0;const o=document.body;new MutationObserver(()=>{const b=document.querySelector('#loadBox');if(b&&!b.hidden)window.__lb++;}).observe(o,{subtree:true,attributes:true,childList:true});});
 await drop('#bk_high','big_high.obj',txt.repeat(3));ok(await p.evaluate(()=>window.__lb>0&&document.querySelector('#loadBox').hidden),'loading bar shown, then hidden');
 // bake + send: one group per map
 await p.evaluate(async()=>{const C=__gs.bakeCfg;C.ss=1;C.pad=2;C.front=15;C.back=5;C.rays=8;for(const k in C.kinds)C.kinds[k]=['normal','thick','curv'].includes(k);await __gs.runBake(__gs.bakeViewModel(),['normal','thick','curv']);});
 await p.click('#bkSend');await p.waitForTimeout(300);
 let g=await p.evaluate(()=>__gs.doc.root.children.map(n=>n.type+':'+n.name+':'+n.visible+':'+(n.children?n.children.map(c=>c.name).join('/'):'')));
 console.log(g);ok(g.filter(x=>x.startsWith('group:Baked')).length===3&&g.some(x=>x==='group:Baked thickness:false:Thickness'),'one group per baked map');
 await p.click('#bkSend');await p.waitForTimeout(300);g=await p.evaluate(()=>__gs.doc.root.children.filter(n=>n.type==='group').length);ok(g===3,'sending again replaces the groups ('+g+')');
 // cage shown
 await p.evaluate(()=>{__gs.bakeCfg.front=12;});await p.click('#bkFront');await p.waitForTimeout(400);await p.screenshot({path:OUT+'cage-shell.png'});
 ok(await p.evaluate(()=>!!__gs.bk.cageGPU),'cage drawn on the model');
 // paint mode: drop a model onto the canvas area → 3D view
 await p.click('#modeTabs [data-mode=paint]');await p.waitForTimeout(300);await drop('#work','crate.obj',txt);
 ok(await p.evaluate(()=>__gs.v3.on&&__gs.v3.imported&&__gs.v3.imported.name==='crate'),'dropping a model in Paint opens it in the 3D view');
 ok(errs.length===0,'no errors '+errs.join('\n'));console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
