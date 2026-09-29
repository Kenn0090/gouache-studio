/* 0.24: smart materials (folders of live layers) and smart masks: built-ins, save, apply, undo. */
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
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 await p.evaluate(()=>{__gs.useModel(__gs.primMesh('sphere',1));__gs.showPanel('mats');});await W(900);
 const g=await p.evaluate(()=>({sm:document.querySelectorAll('#smGrid .mattile').length,mk:document.querySelectorAll('#smMaskGrid .mattile').length,names:[...document.querySelectorAll('#smGrid .mattile span')].map(s=>s.textContent).join()}));
 ok(g.sm===9&&g.mk>=5&&/Gun Metal/.test(g.names)&&/Leather/.test(g.names),'Materials tab lists the 9 built-in smart materials and the smart masks '+JSON.stringify(g));
 const n0=await p.evaluate(()=>__gs.allLayers().length);
 await p.click('#smGrid .mattile:has-text("Gun Metal")');await p.click('#lFill');await W(900);
 let a=await p.evaluate(()=>{const G=__gs.doc.active;return {type:G.type,name:G.name,kids:G.children.map(c=>c.name+':'+(c.fill?'fill':'px')+':'+(c.mask&&c.mask.stack?c.mask.stack.map(r=>r.kind).join('+'):'-')).join(' | ')};});
 ok(a.type==='group'&&a.name==='Gun Metal'&&/Worn edges:fill:gen\+noise/.test(a.kids),'Gun Metal adds a folder of live material layers with generator masks '+JSON.stringify(a));
 const metal=await p.evaluate(()=>{const t=__gs.compositeMap('metal'),d=__gs.readRGBA8(t);__gs.release(t);let s=0;for(let i=0;i<d.length;i+=4)s+=d[i];return s/(d.length/4);});ok(metal>200,'…and the model is metal ('+metal.toFixed(0)+')');
 await p.keyboard.press('Control+z');await W(400);ok(await p.evaluate(n=>__gs.allLayers().length===n,n0),'undo takes the smart material away');
 /* every built-in goes on without trouble */
 const all=await p.evaluate(async()=>{const out=[];for(const r of __gs.smBuiltins()){const G=__gs.smApply(r);await new Promise(r=>setTimeout(r,50));out.push(G?G.children.length:0);}__gs.requestRender(true);return out;});await W(900);
 ok(all.length===9&&all.every(n=>n>=1),'all nine built-ins add their layers '+JSON.stringify(all));
 /* save a folder as a smart material and add it back */
 await p.evaluate(()=>{const G=__gs.allNodes?null:null;});
 await p.evaluate(()=>{const G=__gs.doc.root.children.filter(n=>n.type==='group').find(n=>n.name==='Leather');__gs.doc.active=G;__gs.doc.sel=new Set([G]);__gs.smSave(G);});await W(200);

 await p.fill('#smName','My leather');await p.click('#dlgOk');await W(300);
 ok(await p.evaluate(()=>[...document.querySelectorAll('#smGrid .mattile span')].some(s=>s.textContent==='My leather')),'Save as smart material puts it in the Materials tab');
 await p.click('#smGrid .mattile:has-text("My leather")');await p.click('#lFill');await W(800);
 const same=await p.evaluate(()=>{const s=n=>JSON.stringify(__gs.smSer(n),(k,v)=>k==='name'||k==='data'||k==='id'?undefined:v);const A=__gs.doc.root.children.find(n=>n.name==='Leather'),B=__gs.doc.active;return B.name==='My leather'&&s(A)===s(B);});
 ok(same,'…and it comes back the same (layers, materials, mask rows)');
 /* smart mask: save a layer's mask rows, give them to another layer */
 await p.evaluate(()=>{const G=__gs.doc.root.children.find(n=>n.name==='Gun Metal'),L=G.children.find(c=>c.name==='Worn edges');__gs.smMaskSave(L);});await W(200);
 await p.fill('#smName','Worn test');await p.click('#dlgOk');await W(300);
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.doc.active=L;__gs.doc.sel=new Set([L]);});
 await p.click('#smMaskGrid .mattile:has-text("Worn test")');await p.click('#lMaskAdd');await W(500);
 ok(await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');return L.mask&&L.mask.stack&&L.mask.stack.map(r=>r.kind).join()==='gen,noise';}),'a smart mask gives the layer those mask rows');
 await p.keyboard.press('Control+z');await W(300);ok(await p.evaluate(()=>!__gs.allLayers().find(l=>l.name==='Paint').mask),'undo takes the smart mask off');
 await p.screenshot({path:OUT+'smart.png'});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
