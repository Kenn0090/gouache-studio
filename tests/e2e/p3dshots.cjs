/* Guide pictures for 3D Paint (docs/wiki/images/p3d-tab.png, material-panel.png, mask-tools.png, levels-simple.png, bake-tabs.png, mask-rows.png, live-mask.png, mat-convert.png). */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=require("path").resolve(__dirname,"../../docs/wiki/images")+"/";
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1600,height:950}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:512,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Base material');__gs.doc.active=L;__gs.doc.sel=new Set([L]);});await p.evaluate(()=>__gs.showPanel('mats'));await W(200);await p.click('#matBody .mattile:has-text("Painted metal")');await W(400);
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.doc.active=L;__gs.doc.sel=new Set([L]);Object.assign(__gs.v3.cam,{yaw:.6,pitch:.35});__gs.v3.dirty=true;});
 await p.click('#mir3_x');await W(200);
 await p.fill('#hex','#e8b040');await p.press('#hex','Enter');await p.evaluate(()=>{document.activeElement.blur();Object.assign(__gs.brush,{size:26,hardness:.9,smoothing:0,pSize:false,tip:null});});
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 for(const [a,b,c,d] of [[-40,-80,120,-60],[-20,10,140,40],[30,90,110,120]]){await p.mouse.move(cx+a,cy+b);await p.mouse.down();await p.mouse.move(cx+c,cy+d,{steps:14});await p.mouse.up();await W(300);}
 await p.mouse.move(cx+300,cy+250);await W(800);await p.screenshot({path:OUT+'p3d-tab.png'});console.log('shot p3d-tab');
 /* the Material panel beside Colour, on the painted-metal layer */
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Painted metal');__gs.doc.active=L;__gs.doc.sel=new Set([L]);__gs.showPanel('matEd');__gs.renderMatEd(true);});await W(400);
 await p.locator('#dock2').screenshot({path:OUT+'material-panel.png'});console.log('shot material-panel');
 /* mask mode with the ID colour row (a made-up ID map: four colour bands) */
 await p.evaluate(()=>{const d=__gs.doc,t=__gs.makeTarget(d.w,d.h,8,false),g=document.querySelector('#gl').getContext('webgl2'),px=new Uint8Array(d.w*d.h*4),C=[[220,60,50],[60,160,220],[240,200,60],[90,200,110]];
   for(let i=0;i<d.w*d.h;i++){px.set([...C[Math.floor((i%d.w)/d.w*4)],255],i*4);}g.bindTexture(g.TEXTURE_2D,t.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,d.w,d.h,g.RGBA,g.UNSIGNED_BYTE,px);d.meshMaps={id:t};});
 const mt=p.locator('#layerList .lrow:has(.lname:text-is("Painted metal")) .mthumb');await p.evaluate(()=>__gs.showPanel('layers'));await mt.click({modifiers:['Alt']});await W(500);
 await p.click('#mk_id');await W(200);await p.mouse.click(cx-20,cy);await W(300);await p.mouse.click(cx+60,cy+40);await W(500);await p.mouse.move(cx+300,cy+250);await W(300);
 await p.locator('#work').screenshot({path:OUT+'mask-tools.png'});console.log('shot mask-tools');
 await p.click('#maskDone');await W(300);
 /* Levels, simple layout */
 await p.evaluate(()=>__gs.act('levels'));await W(600);await p.locator('#modal .dialog').screenshot({path:OUT+'levels-simple.png'});console.log('shot levels-simple');await p.click('#dlgCancel');await W(200);
 /* 0.23: mask rows under the layer, with Properties showing the selected row */
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Painted metal');__gs.doc.active=L;__gs.doc.sel=new Set([L]);
   if(L.mask&&L.mask.stack)L.mask.stack.length=0;__gs.msAdd(L,'fill',{p:{v:1}});__gs.msAdd(L,'gen',{p:{g:'edge',amount:.55,width:.6,breakup:.5,contrast:1.5,scale:6,seed:1,inv:false}});
   const n=__gs.msAdd(L,'noise',{p:{type:'grunge',scale:5,contrast:2,level:.1,seed:2,tri:true,inv:false}});n.mode='multiply';n.op=.8;__gs.msAdd(L,'filter',{fx:'levels'});
   const g=L.mask.stack.find(r=>r.kind==='gen');__gs.msSelect(L,'m',g.id);
   for(const gg of __gs.dk.L.groups)gg.min=!gg.tabs.includes('layers');__gs.showPanel('layers');__gs.ui.viewMask=false;__gs.v3.dirty=true;});await W(900);
 {const a=await p.locator('#dock2').boundingBox(),d=await p.locator('#dock').boundingBox();await p.screenshot({path:OUT+'mask-rows.png',clip:{x:a.x,y:a.y,width:d.x+d.width-a.x,height:Math.min(a.height,d.height)}});console.log('shot mask-rows');}
 /* the live mask on a layer without a mask */
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.doc.active=L;__gs.doc.sel=new Set([L]);__gs.liveMaskStart(L);__gs.liveAdd('gen',{p:{g:'dust',amount:.5,width:.5,breakup:.5,contrast:1.5,scale:6,seed:1,inv:false}});});await W(600);
 await p.click('#mk_id');await W(200);await p.mouse.click(cx-20,cy);await W(600);await p.mouse.move(cx+300,cy+250);await W(300);
 await p.locator('#work').screenshot({path:OUT+'live-mask.png'});console.log('shot live-mask');
 await p.click('#lmClose');await W(200);
 /* Mesh maps from a material */
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Painted metal');__gs.doc.active=L;__gs.dlgMatConvert(L);});await W(400);
 await p.locator('#modal .dialog').screenshot({path:OUT+'mat-convert.png'});console.log('shot mat-convert');await p.click('#dlgCancel');await W(200);
 /* the Bake tab's tabs */
 await p.click('#modeTabs [data-mode=bake]');await W(1200);await p.evaluate(()=>{for(const g of __gs.dk.L.groups)g.min=!g.tabs.includes('bake');__gs.showPanel('bake');});await W(300);
 await p.locator('#bakeSec').screenshot({path:OUT+'bake-tabs.png'});console.log('shot bake-tabs');
 console.log(errs.length?'ERR '+errs[0]:'ALL PASSED');await b.close();})();
