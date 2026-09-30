/* 0.28: the materials Library (ambientCG, shipped with the app): tiles, loading on click, on the model */
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
  {const m=u.match(/materials\/([a-z0-9-]+\.gmat)$/);if(m)return r.fulfill({path:__dirname+'/../../assets/materials/'+m[1],contentType:'application/octet-stream'});}
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'lib',false,'pbr'));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>__gs.showPanel('mats'));await W(500);
 const cats=await p.evaluate(()=>document.querySelectorAll('#matBody .chip').length);
 await p.locator('#matBody .chip',{hasText:'Metal'}).first().click();await W(300);const metal=await p.evaluate(()=>document.querySelectorAll('#matLib .mattile').length);
 ok(cats>=9&&metal===46,'the Library is split into categories ('+cats+' buttons; Metal shows '+metal+')');
 await p.locator('#matBody .chip',{hasText:/^All$/}).first().click();await W(500);
 const n=await p.evaluate(()=>({tiles:document.querySelectorAll('#matLib .mattile').length,thumbs:[...document.querySelectorAll('#matLib img')].filter(i=>i.naturalWidth>0).length}));
 ok(n.tiles===150&&n.thumbs===150,'the Library shows 150 materials with previews '+JSON.stringify(n));
 await p.locator('#matSec').screenshot({path:OUT+'lib-panel.png'});
 // add a material layer, then double-click another tile: it replaces the material on the same layer
 await p.click('#gm_brown-leather');await p.click('#lFill');for(let i=0;i<60;i++){if(await p.evaluate(()=>__gs.doc.active&&__gs.doc.active.name==='Brown leather'))break;await W(250);}
 const n0=await p.evaluate(()=>__gs.allLayers().length),id0=await p.evaluate(()=>__gs.doc.active.id||__gs.doc.active.name);
 await p.dblclick('#gm_brass');for(let i=0;i<60;i++){if(await p.evaluate(()=>__gs.doc.active&&__gs.doc.active.name==='Brass'))break;await W(250);}
 ok(await p.evaluate(()=>__gs.doc.active.name==='Brass'&&__gs.doc.active.fill.name==='Brass'),'double-click replaced the material on the selected layer');
 ok(await p.evaluate(()=>__gs.allLayers().length)===n0,'no new layer was added');
 await W(300);await p.evaluate(()=>__gs.act('undo'));await W(500);
 ok(await p.evaluate(()=>__gs.doc.active.name==='Brown leather'),'undo brings the old material back');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
