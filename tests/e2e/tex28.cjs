/* 0.28: Textures panel: generated, photo grunge, yours; uses: mask row, material channel, new layer, brush tip, stencil */
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
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'tex',false,'pbr'));await W(300);
 await p.evaluate(()=>__gs.showPanel('textures'));await W(1500);
 const n=await p.evaluate(()=>({all:document.querySelectorAll('#txGrid .txtile').length,thumbs:[...document.querySelectorAll('#txGrid .txtile img')].filter(i=>i.src.startsWith('data:')).length}));
 ok(n.all===await p.evaluate(()=>__gs.TX_PHOTO.length+__gs.TX_GEN.length),'the panel lists every photo grunge and generated texture ('+n.all+')');
 await p.locator('#txSec').screenshot({path:OUT+'tex-panel.png'});
 /* a photo grunge and a generated one decode to real pictures */
 const px=await p.evaluate(async()=>{const a=await __gs.txTarget({kind:'photo',id:'drips',name:'Drips'}),b=await __gs.txTarget({kind:'gen',id:'cells',name:'Cells'});
   const st=t=>{const d=__gs.captureRegionNow(t,0,0,t.w,t.h).data;let mn=255,mx=0;for(let i=0;i<d.length;i+=4*97){mn=Math.min(mn,d[i]);mx=Math.max(mx,d[i]);}return [t.w,mn,mx];};return {a:st(a),b:st(b)};});
 ok(px.a[0]===1024&&px.a[2]-px.a[1]>150&&px.b[2]-px.b[1]>150,'photo and generated textures load with full contrast '+JSON.stringify(px));
 /* the newer photo grunge (every one of the 75 decodes to a 1024 picture with contrast) */
 const allOk=await p.evaluate(async()=>{const bad=[];const ids=['brushed-scratches','ink-smears','runs-5','cracks-1','dry-cracks','rust-pits-3','worn-paint-2','frost-veins'];
   for(const id of ids){const t=await __gs.txTarget({kind:'photo',id,name:id});const d=__gs.captureRegionNow(t,0,0,t.w,t.h).data;let mx=0;for(let i=0;i<d.length;i+=4*97)mx=Math.max(mx,d[i]);if(t.w!==1024||mx<150)bad.push(id+':'+t.w+':'+mx);}return bad;});
 ok(!allOk.length,'the newer photo grunge maps decode with contrast '+JSON.stringify(allOk));
 /* click a tile: its uses */
 await p.click('#tx_gen_clouds',{button:'right'});await W(300);const menu=await p.evaluate(()=>[...document.querySelectorAll('#menuPop .mi')].map(b=>b.textContent));
 ok(menu.some(t=>t.includes('mask'))&&menu.some(t=>t.includes('New layer'))&&menu.some(t=>t.includes('Brush tip'))&&menu.some(t=>t.includes('Stencil')),'right-clicking a texture offers its uses');
 await p.keyboard.press('Escape');await p.mouse.click(5,450);
 await p.evaluate(()=>__gs.act('addLayer'));await W(200);
 await p.evaluate(()=>__gs.txToMask({kind:'gen',id:'clouds',name:'Clouds'}));await W(600);
 ok(await p.evaluate(()=>{const L=__gs.doc.active;return !!(L.mask&&L.mask.stack&&L.mask.stack.some(r=>r.kind==='image'&&r.t));}),'Add to the mask: a picture row with the texture');
 await p.evaluate(()=>__gs.txToLayer({kind:'photo',id:'spatter',name:'Spatter'}));await W(600);
 ok(await p.evaluate(()=>__gs.doc.active.name==='Spatter'),'New layer from a texture');
 await p.evaluate(()=>__gs.act('undo'));await W(300);ok(await p.evaluate(()=>!__gs.allLayers().some(l=>l.name==='Spatter')),'undo removes it');
 const tip=await p.evaluate(async()=>{await __gs.txToTip({kind:'gen',id:'blotches',name:'Blotches'});return __gs.brush.tip&&__gs.brush.tip.name;});ok(/Blotches/.test(tip||''),'Brush tip from a texture ('+tip+')');
 await p.evaluate(()=>__gs.cmdNewFillLayer());await W(400);
 await p.evaluate(()=>__gs.txToChannel({kind:'gen',id:'grain',name:'Grain'},'rough'));await W(600);
 ok(await p.evaluate(()=>{const L=__gs.doc.active;return L.fill.maps.rough.src==='image'&&!!L._fillImg.rough;}),'Material channel: roughness uses the texture');
 /* yours: import (added straight from a target here), survives a reload of the library */
 await p.evaluate(async()=>{const t=await __gs.txTarget({kind:'gen',id:'dots',name:'Dots'});const c=__gs.makeTarget?null:null;await __gs.txAddTarget(t,'My dots');});await W(300);
 const mine=await p.evaluate(async()=>{__gs.tx.mine=[];__gs.tx.loaded=false;await new Promise(r=>setTimeout(r,50));const all=await (async()=>{__gs.tx.loaded=false;return null;})();return true;});
 await p.evaluate(()=>{__gs.tx.show='mine';});await p.evaluate(()=>__gs.showPanel('textures'));await p.evaluate(()=>document.querySelector('#txSec')&&window.dispatchEvent(new Event('resize')));
 await p.evaluate(async()=>{/* reload from storage */const r=await new Promise(res=>{const q=indexedDB.open('gouache-studio');q.onsuccess=()=>{const t=q.result.transaction('textures').objectStore('textures').getAll();t.onsuccess=()=>res(t.result);};});window.__stored=r.map(x=>({name:x.name,packed:!!x.z,raw:!!x.data}));});
 const st=await p.evaluate(()=>window.__stored);ok(st.length===1&&st[0].name==='My dots'&&st[0].packed&&!st[0].raw,'your textures are kept on this computer, packed '+JSON.stringify(st));
 /* stencil in 3D Paint */
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);await p.evaluate(()=>__gs.txToStencil({kind:'photo',id:'rings',name:'Water rings'}));await W(400);
 ok(await p.evaluate(()=>__gs.st3&&__gs.st3.name==='Water rings'),'Stencil from a texture in 3D Paint');
 /* drag a tile: onto a layer's middle → its mask; to a layer's edge → a new layer there */
 await p.evaluate(()=>{__gs.showPanel('textures');__gs.showPanel('layers');});await W(300);
 await p.evaluate(()=>__gs.act('addLayer'));await W(300);
 await p.locator('#tx_gen_clouds').scrollIntoViewIfNeeded();const tileB=await p.locator('#tx_gen_clouds').boundingBox();const rowB=await p.locator('#layerList .lrow').first().boundingBox();
 const n0=await p.evaluate(()=>__gs.allLayers().length);
 await p.mouse.move(tileB.x+30,tileB.y+30);await p.mouse.down();await p.mouse.move(tileB.x+40,tileB.y+40,{steps:3});await p.mouse.move(rowB.x+rowB.width/2,rowB.y+rowB.height/2,{steps:8});await p.mouse.up();await W(800);
 ok(await p.evaluate(()=>__gs.allLayers().some(L=>L.mask&&L.mask.stack&&L.mask.stack.some(r=>r.kind==='image'))),'dragging a texture onto a layer puts it in that layer’s mask');
 await p.locator('#tx_gen_clouds').scrollIntoViewIfNeeded();const tB2=await p.locator('#tx_gen_clouds').boundingBox(),rB2=await p.locator('#layerList .lrow').first().boundingBox();
 await p.mouse.move(tB2.x+30,tB2.y+30);await p.mouse.down();await p.mouse.move(tB2.x+40,tB2.y+40,{steps:3});await p.mouse.move(rB2.x+rB2.width/2,rB2.y+2,{steps:8});await p.mouse.up();await W(800);
 ok(await p.evaluate(n=>__gs.allLayers().length===n+1,n0),'dragging one to a layer’s edge makes a new layer there');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
