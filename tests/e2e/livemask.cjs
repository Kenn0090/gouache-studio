/* 0.23: live mask on a layer without a mask (ID colour, shapes, Keep as a mask stack or apply to the layer), mask rows in 3D Paint. */
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
 const setFG=async hx=>{await p.evaluate(()=>__gs.showPanel('color'));await p.fill('#hex',hx);await p.press('#hex','Enter');await p.evaluate(()=>document.activeElement&&document.activeElement.blur());};
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 await p.evaluate(()=>{__gs.useModel(__gs.parseOBJ('v -1 -1 0\nv 1 -1 0\nv 1 1 0\nv -1 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nf 1/1 2/2 3/3 4/4\n','quad.obj'));});await W(800);
 await p.evaluate(()=>{Object.assign(__gs.v3.cam,{yaw:0,pitch:0});__gs.v3.dirty=true;
   const d=__gs.doc,t=__gs.makeTarget(d.w,d.h,8,false),g=document.querySelector('#gl').getContext('webgl2'),px=new Uint8Array(d.w*d.h*4);
   for(let i=0;i<d.w*d.h;i++)px.set((i%d.w)<d.w/2?[255,0,0,255]:[0,0,255,255],i*4);g.bindTexture(g.TEXTURE_2D,t.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,d.w,d.h,g.RGBA,g.UNSIGNED_BYTE,px);d.meshMaps={id:t};});await W(400);
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 const selHalves=()=>p.evaluate(()=>{const d=__gs.selPixels(),n=__gs.doc.w;let l=0,r=0;for(let i=0;i<d.length;i++)if(d[i]>127){if(i%n<n/2)l++;else r++;}return {l,r,on:!!__gs.sel.active};});
 const paintHalves=()=>p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint'),d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w;let l=0,r=0;for(let i=0;i<d.length;i+=4)if(d[i+1]>150&&d[i]<90&&d[i+3]>200){if((i/4)%W<W/2)l++;else r++;}return {l,r};});
 /* right-click the Paint layer (no mask) › Live mask… */
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.doc.active=L;__gs.doc.sel=new Set([L]);__gs.showPanel('layers');});await W(200);
 await p.click('#layerList .lrow:has(.lname:text-is("Paint"))',{button:'right'});await W(150);await p.click('#menuPop .mi:has-text("Live mask")');await W(300);
 ok(await p.evaluate(()=>__gs.lm.on&&!!document.querySelector('#maskBar.live')&&!!document.querySelector('#lmKeep')),'right-click › Live mask… opens the live mask bar');
 await p.click('#mk_id');await W(150);await p.mouse.click(cx-hb.width*.2,cy);await W(500);
 let sh=await selHalves();ok(sh.on&&sh.l>1000&&sh.r===0,'picking an ID colour makes a live selection of that colour '+JSON.stringify(sh));
 await p.click('#mk_id');await W(150);
 await setFG('#20d040');await p.evaluate(()=>Object.assign(__gs.brush,{size:60,hardness:1,opacity:1,flow:1,smoothing:0,lazy:0,pSize:false,tip:null}));
 await p.mouse.move(cx-hb.width*.35,cy);await p.mouse.down();await p.mouse.move(cx+hb.width*.35,cy,{steps:14});await p.mouse.up();await W(500);
 let ph=await paintHalves();ok(ph.l>500&&ph.r===0,'painting across stays inside the live mask '+JSON.stringify(ph));
 /* Keep… as a mask stack */
 await p.click('#lmKeep');await W(200);await p.click('#lmStack');await W(400);
 let k=await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');return {mask:!!(L.mask&&L.mask.stack),rows:L.mask&&L.mask.stack.map(r=>r.kind).join(),live:__gs.lm.on,sel:__gs.sel.active};});
 ok(k.mask&&k.rows==='id'&&!k.live&&!k.sel,'Keep › As a mask stack: the layer gets a mask with the ID colour row '+JSON.stringify(k));
 ok(await p.evaluate(()=>document.querySelectorAll('#layerList .msrow.m').length===0),'…its rows stay hidden until the mask is selected');
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.selectOnly(L);L.editMask=true;__gs.renderLayers();});await W(200);
 ok(await p.evaluate(()=>document.querySelectorAll('#layerList .msrow.m').length===1),'…and show as a row under the layer once it is');
 await p.keyboard.press('Control+z');await W(400);ok(await p.evaluate(()=>!__gs.allLayers().find(l=>l.name==='Paint').mask),'undo takes the mask away again');
 /* a second layer: live mask from a generator, then Apply to the layer */
 await p.evaluate(()=>__gs.act('addLayer'));await W(200);await p.evaluate(()=>{__gs.act('fill');});await W(300);
 const full=await p.evaluate(()=>{const d=__gs.readRGBA8(__gs.mapT(__gs.doc.active,'base'));let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>200)n++;return n;});
 await p.evaluate(()=>{__gs.liveMaskStart(__gs.doc.active);__gs.liveAdd('grad',{p:{axis:'x',from:.45,to:.55,inv:false}});});await W(400);
 ok(await p.evaluate(()=>__gs.sel.active&&!!document.querySelector('#maskBar .lmchip')),'rows added to the live mask show as chips in its bar');
 await p.click('#lmKeep');await W(200);await p.click('#lmApply');await W(400);
 const cut=await p.evaluate(()=>{const d=__gs.readRGBA8(__gs.mapT(__gs.doc.active,'base'));let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>200)n++;return {n,mask:!!__gs.doc.active.mask};});
 ok(cut.n<full*.7&&cut.n>full*.2&&!cut.mask,'Keep › Apply to the layer cuts it (no mask added) '+full+' → '+JSON.stringify(cut));
 await p.screenshot({path:OUT+'livemask.png'});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
