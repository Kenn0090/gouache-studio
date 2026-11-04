const {chromium}=require('playwright'),path=require('path');
let failures=0;const ok=(v,m)=>{console.log((v?'PASS ':'FAIL ')+m);if(!v)failures++;};
(async()=>{
 const b=await chromium.launch({channel:process.env.GS_BROWSER_CHANNEL||'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.fulfill({body:''}));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>__gs.closeWelcome());
 // Compare live optimized results to the full compositor at every step, including untouched pixels.
 for(const kind of ['root','nested','isolated','group-mask','clipped','mask','16-bit','wrapped','blur-above','dependent-mask']){
  const r=await p.evaluate(kind=>{const G=__gs;G.newDoc(128,128,kind==='16-bit'?16:8,[.25,.35,.5],kind,kind==='wrapped');G.ui.viewMask=false;let parent=G.doc.root;
   if(['nested','isolated','group-mask','clipped'].includes(kind)){parent=G.newGroupObj('Group');parent.mode=kind==='isolated'?1:-1;parent.opacity=.67;G.insertNode(parent,G.doc.root);if(kind==='group-mask')parent.mask=G.makeMask(.7);}
   const base=G.newLayerObj('Under');G.clearTarget(base.target,[.4,.2,.1,.6]);G.insertNode(base,parent);
   G.insertNode(G.newFxLayerObj('Invert',[G.fxItem('invert')],'base'),parent);
   const L=G.newLayerObj('Paint');G.clearTarget(L.target,[.1,.2,.3,.4]);G.insertNode(L,parent);if(kind==='clipped')L.clip=true;
   if(kind==='blur-above')G.insertNode(G.newFxLayerObj('Blur',[G.fxItem('blur')],'base'),parent);
   if(kind==='dependent-mask'){base.mask=G.makeMask(1);base.mask.stack=[{id:'ref',kind:'ref',on:true,mode:'normal',op:1,p:{name:'Paint'}}];}
   G.selectOnly(L);let target=L;if(kind==='mask'){G.cmdAddMask(1);target=G.editTarget().L;}
   const o=Object.assign({},G.brush,{tool:'brush',size:11,color:[.9,.05,.1],flow:.8,opacity:.8,spacing:.2,pSize:false,smoothing:0,grain:0,tip:null,sym:null});
   G.composite();G.beginStroke(target,30,40,1,o);G.composite();const st=G.strokeNow();let max=0,px=0,fullPx=0;const before=G.compStats().parts;
   for(let i=1;i<5;i++){G.addPoint(30+i*3,40+i*2,1);G.runStat.px=0;G.composite();px+=G.runStat.px;const a=G.readRGBA8(G.compOut());
    const saved=st.cacheSafe;st.cacheSafe=false;G.runStat.px=0;G.composite();fullPx+=G.runStat.px;st.cacheSafe=saved;const z=G.readRGBA8(G.compOut());for(let j=0;j<a.length;j++)max=Math.max(max,Math.abs(a[j]-z[j]));}
   const partial=G.compStats().parts-before,safe=st.cacheSafe;G.endStroke(true);G.composite();const pixels=G.readRGBA8(L.target);G.undo();G.redo();G.composite();const again=G.readRGBA8(L.target);const undoOK=pixels.every((v,i)=>v===again[i]);
   return {max,px,fullPx,partial,safe,undoOK,error:G.gl.getError()};},kind);
  console.log(kind,JSON.stringify(r));ok(r.max<=1,kind+' matches full compositor across the whole image');ok(r.undoOK,kind+' undo/redo retains pixels');ok(r.error===0,kind+' has no graphics errors');
  if(['blur-above','dependent-mask'].includes(kind))ok(r.partial===0,kind+' uses conservative full redraw');else ok(r.partial>0&&r.px<r.fullPx*(kind==='wrapped'?.8:.6),kind+' reduces shader pixel work');
 }
 for(const depth of [8,16]){
  const reuse=await p.evaluate(depth=>{const G=__gs;G.newDoc(128,128,depth,[.2,.3,.4],'Cache reuse',false);const L=G.newLayerObj('Paint');G.insertNode(L,G.doc.root);G.selectOnly(L);G.composite();
   const o={...G.brush,tool:'brush',size:10,color:[.8,.1,.2],pSize:false,smoothing:0,tip:null,sym:null};let released=true,stable=true,warm=0;const pixels=[];
   for(let i=0;i<6;i++){G.beginStroke(L,32+i*8,48,1,o);G.composite();const s=G.strokeNow(),t=s.cache?.get(G.doc.root.children)?.base?.t;
    if(!t||!t.pool)throw Error('Expected a pooled complete prefix');const n=t.pool.all.length;if(i===0)warm=n;else stable=stable&&n<=warm;
    G.endStroke(true);released=released&&!!t.tex&&t.pool.free.includes(t)&&!s.cache;G.composite();pixels.push(G.readRGBA8(L.target)[(48*128+32+i*8)*4+3]);}
   const before=G.readRGBA8(L.target);G.undo();G.redo();const same=G.readRGBA8(L.target).every((v,i)=>v===before[i]);return {released,stable,pixels,same,error:G.gl.getError()};},depth);
  console.log('cache reuse',depth,reuse);ok(reuse.released&&reuse.stable&&reuse.pixels.every(v=>v>0)&&reuse.same&&reuse.error===0,depth+'-bit repeated strokes reuse released prefix buffers and retain pixels/undo');
 }
 const pack=await p.evaluate(async()=>{const G=__gs,W=256,raw=new Uint8Array(W*W*4);for(let i=0;i<raw.length;i++)raw[i]=(i*17+(i>>9))&255;
  const packed=await G.pxPack(raw,W,W,8,false),out=await G.pxUnpack(packed.bytes,W,W,8,packed.f);const same=raw.every((v,i)=>v===out[i]);
  const floats=new Float32Array(W*W*4);for(let i=0;i<floats.length;i++)floats[i]=(i%101)/100;const expected=G.pxBytes(floats,16),half=await G.pxPack(floats,W,W,16,false),back=await G.pxUnpack(half.bytes,W,W,16,half.f);
  const view=raw.subarray(64,64+64*64*4),sub=await G.pxPack(view,64,64,8,false),subOut=await G.pxUnpack(sub.bytes,64,64,8,sub.f);
  return {same,half:expected.every((v,i)=>v===back[i]),retained:raw.byteLength===W*W*4&&floats.byteLength>0,sub:view.every((v,i)=>v===subOut[i]),completed:G.pxWorkerState.completed};});
 ok(pack.same&&pack.half&&pack.sub,'lossless 8-bit/16-bit worker packing round trips exactly');ok(pack.retained,'packing retains caller-owned buffers');ok(pack.completed>=2,'large images actually use the worker');
 const failure=await p.evaluate(async()=>{const G=__gs;G.newDoc(256,256,8,[.3,.4,.5],'Failure',false);const promise=G.encodeGouache();
  while(!G.pxWorkerState.jobs.size)await new Promise(r=>setTimeout(r,1));G.pxWorkerState.worker.onerror({preventDefault(){}});let rejected=false;try{await promise;}catch(e){rejected=true;}
  const clean=!G.gfSavingNow()&&!G.tabDocs.hold&&!document.querySelector('.ascover'),blob=await G.encodeGouache();return {rejected,clean,fallback:blob.size>16,unavailable:G.pxWorkerState.unavailable};});
 ok(failure.rejected&&failure.clean&&failure.fallback&&failure.unavailable,'worker failure unlocks the app; retry saves with the local fallback');
 const save=await p.evaluate(async()=>{const G=__gs;G.newDoc(256,256,8,[.2,.4,.6],'Save',false);G.prefs.smallFiles=false;G.setDocMaps(['base','height','rough']);const L=G.doc.active;
  G.clearTarget(G.ensureMapTarget(L,'height'),[.372,.372,.372,1]);L.mask=G.makeMask(.63);const h=G.readRegion(G.mapT(L,'height'),0,0,256,256),base=G.readRegion(L.maps.base,0,0,256,256);
  let ticks=0,timer=setInterval(()=>ticks++,1);const promise=G.encodeGouache();await new Promise(r=>setTimeout(r,0));const busy=G.gfSavingNow(),covered=!!document.querySelector('.ascover');
  const blob=await promise;clearInterval(timer);const stats=G.gfSaveStats.last;await G.openGouache(await blob.arrayBuffer(),'Save');const H=G.readRegion(G.mapT(G.doc.active,'height'),0,0,256,256),B=G.readRegion(G.doc.active.maps.base,0,0,256,256);
  return {busy,covered,ticks,stats,half:h.every((v,i)=>v===H[i]),base:base.every((v,i)=>v===B[i]),mask:!!G.doc.active.mask,clean:!G.gfSavingNow()&&!document.querySelector('.ascover'),error:G.gl.getError()};});
 console.log('save',JSON.stringify(save));ok(save.busy&&save.covered&&save.clean,'save protects document state and releases its guard');ok(save.ticks>3,'UI event loop remains responsive during save');ok(save.half&&save.base&&save.mask,'Gouache file preserves pixels, height precision and mask');ok(save.error===0,'save has no graphics errors');
 const memory=await p.evaluate(()=>{const G=__gs;G.newDoc(128,128,8,[.2,.3,.4],'Memory',false);G.composite();const layer=G.doc.active.target,checked=G.acquire(),spares=Array.from({length:9},()=>G.acquire());spares.forEach(G.release);
  const before=G.gpuMemory(),freed=G.trimPools(0),after=G.gpuMemory(),a=G.readRGBA8(layer),alive=!!layer.tex&&!!checked.tex&&!!G.compOut().tex;G.release(checked);const t=G.acquire();G.clearTarget(t,[.1,.1,.1,1]);G.release(t);G.composite();
  return {freed,before,after,alive,pixels:a[0]>40&&a[3]===255,error:G.gl.getError()};});
 console.log('memory',JSON.stringify(memory));ok(memory.freed>0&&memory.after.bytes<memory.before.bytes&&memory.after.spare===0,'idle trimming releases only free scratch storage');ok(memory.alive&&memory.pixels&&memory.error===0,'layers and checked-out results survive trimming and painting can resume');
 const crop=await p.evaluate(async()=>{const G=__gs;G.newDoc(80,128,8,[0,0,0],'Crop',false);const t=G.doc.active.target;G.clearTarget(t);const d=new Uint8Array(80*128*4);for(let y=22;y<70;y++)for(let x=13;x<55;x++){const i=(y*80+x)*4;d[i]=120;d[i+3]=255;}
  const tex=G.uploadStraight({w:80,h:128,data:d,bits:8});G.premultInto(t,tex,[0,0],null);G.gl.deleteTexture(tex);const sync=G.contentBounds(t),async=await G.contentBoundsAsync(t),blob=await G.encodeGouache();await G.openGouache(await blob.arrayBuffer(),'Crop');const z=G.readRegion(G.doc.active.target,0,0,80,128);
  return {sync,async,same:d.every((v,i)=>v===z[i])};});
 ok(JSON.stringify(crop.sync)===JSON.stringify(crop.async)&&crop.same,'asynchronous crop preserves bounds and pixels on a non-square document');
 await p.evaluate(()=>{const G=__gs;G.newDoc(64,64,8,[.2,.4,.6],'Window',false);G.dtPop(G.dtab().live);});
 const popped=await p.evaluate(async()=>{const G=__gs,t=G.dtab().tabs.find(t=>t.win);if(!t)return {opened:false};const w=t.win.w,promise=G.encodeGouache();const guarded=!!w.document.querySelector('.ascover')&&G.dtBusy();await promise;const clean=!w.document.querySelector('.ascover');G.dtDock(t.id);return {opened:true,guarded,clean};});
 ok(popped.opened&&popped.guarded&&popped.clean,'saving guards a detached document window and cleans up afterward');
 const anim=await p.evaluate(async()=>{const G=__gs;G.setMode('anim',true);G.addFrame();G.doc.anim.fps=60;G.togglePlay();G.tabDocs.hold=true;const current=G.doc.anim.cur;await new Promise(r=>setTimeout(r,130));const held=G.doc.anim.cur===current;G.tabDocs.hold=false;await new Promise(r=>setTimeout(r,55));const resumed=!!G.playing;G.stopPlay();return {held,resumed};});
 ok(anim.held&&anim.resumed,'animation playback waits while a document is captured and remains available afterward');
 await p.evaluate(()=>{__gs.perf.on=true;__gs.requestRender(true);});await p.waitForTimeout(750);await p.evaluate(()=>__gs.perfUpdate());const monitor=await p.locator('.perfbox').textContent();ok(/Tracked textures:/.test(monitor)&&/Last save preparation:/.test(monitor)&&/GPU frame:/.test(monitor),'monitor reports texture memory, GPU availability and save stages');
 ok(errors.length===0,'no application errors '+errors.join(' | '));await b.close();process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
