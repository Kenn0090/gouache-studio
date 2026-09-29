/* 0.27: Drag materials, smart materials and smart masks from the Materials tab onto the layer stack */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* names from the sites */
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 await p.evaluate(()=>{__gs.showPanel('layers');__gs.showPanel('mats');});await W(600);
 const names=()=>p.evaluate(()=>__gs.doc.root.children.map(n=>n.name).reverse());/* top first, as the panel shows */
 console.log('start',JSON.stringify(await names()));
 const drag=async(tileSel,rowName,where)=>{const t=p.locator(tileSel).first();await t.scrollIntoViewIfNeeded();const a=await t.boundingBox();
   const rl=p.locator('#layerList .lrow',{hasText:rowName}).first();await rl.scrollIntoViewIfNeeded();const r=await rl.boundingBox();const y=where==='above'?r.y+4:where==='below'?r.y+r.height-4:r.y+r.height/2;
   await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(a.x+a.width/2+30,a.y+a.height/2+10,{steps:3});
   await p.mouse.move(r.x+r.width/2,y,{steps:8});await W(150);const shown=await p.evaluate(()=>!document.querySelector('.dropline').hidden||!!document.querySelector('.lrow.drop-mask,.lrow.drop-into'));
   await p.mouse.up();await W(700);return shown;};
 /* a material between Paint and Base material */
 const matTile='#matBody .matgrid:not(#matMine) .mattile:not(.smart)';const matName=await p.locator(matTile).first().getAttribute('title');
 let shown=await drag(matTile,'Base material','above');let n=await names();
 ok(shown,'dragging shows where it will land');
 ok(n.length===3&&n[0]==='Paint'&&n[2]==='Base material'&&matName.startsWith(n[1]),'a material dropped between two layers lands between them '+JSON.stringify(n));
 /* a smart material above Paint */
 const smTile='#matBody .mattile.smart';const smCount=await p.locator(smTile).count();
 const first=await p.evaluate(()=>{const t=[...document.querySelectorAll('#matBody .mattile.smart')].find(b=>b._libDrag&&b._libDrag[0]==='smart');return t?t._libDrag[1].name:null;});
 if(first){await p.evaluate(()=>{[...document.querySelectorAll('#matBody .mattile.smart')].forEach(b=>b.classList.toggle('pick',b._libDrag&&b._libDrag[0]==='smart'));});
   await drag('#matBody .mattile.smart.pick','Paint','above');n=await names();ok(n[0]===first&&n.length===4,'a smart material dropped above the top layer lands on top '+JSON.stringify(n));}
 else ok(false,'no smart material tiles found');
 /* a smart mask onto Base material */
 await p.evaluate(()=>{[...document.querySelectorAll('#matBody .mattile.smart')].forEach(b=>b.classList.toggle('pickm',b._libDrag&&b._libDrag[0]==='smask'));});
 const smask=await p.evaluate(()=>{const b=document.querySelector('#matBody .mattile.pickm');return b&&b._libDrag[1].name;});
 await drag('#matBody .mattile.pickm','Base material','mid');

 ok(await p.evaluate(()=>{const L=__gs.layerByName('Base material');return !!(L.mask&&L.mask.stack&&L.mask.stack.length);}),'a smart mask dropped onto a layer becomes its mask ('+smask+')');
 ok(await p.evaluate(()=>__gs.hist.undo.slice(-3).map(u=>u.label).join('|')).then(s=>/Add material/.test(s)&&/Smart mask|smart material/i.test(s)),'each drop is an undo step');
 /* a click still adds as before (on top of the selected layer) */
 const cnt=()=>p.evaluate(()=>__gs.allLayers().length);const before=await cnt();await p.locator(matTile).first().click();await W(500);ok((await cnt())===before+1,'clicking a tile still adds it');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
