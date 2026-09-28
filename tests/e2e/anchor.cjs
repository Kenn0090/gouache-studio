/* 0.24: anchor points: an anchor on a layer, masks reading it (height, shape), generators following its height, renaming. */
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
 const W=ms=>p.waitForTimeout(ms||150);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:8});await p.mouse.up();await W(150);};
 const setFG=async hx=>{await p.evaluate(()=>__gs.showPanel('color'));await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const comp=(k,pts)=>p.evaluate(([k,pts])=>{const t=__gs.compositeMap(k),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[k,pts]);
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'mstack',false));await W(300);
 await p.evaluate(()=>{__gs.newDoc(128,128,8,[1,1,1],'anc',false);__gs.setDocMaps(['base','rough','metal','height','normal'],'maps');});await W(300);
 /* a "Details" layer with raised blocks in its height */
 await p.evaluate(()=>{__gs.act('addLayer');const A=__gs.doc.active;A.name='Details';const H=__gs.ensureMapTarget(A,'height'),g=document.querySelector('#gl').getContext('webgl2'),n=128,px=new Uint8Array(n*n*4);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){const on=x>32&&x<96&&y>40&&y<88;const v=on?230:128;px.set([v,v,v,255],(y*n+x)*4);}{const T8=__gs.makeTarget(n,n,8,false);g.bindTexture(g.TEXTURE_2D,T8.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,n,n,g.RGBA,g.UNSIGNED_BYTE,px);__gs.copyScaled(T8,H);}H.empty=false;
   __gs.cfxAddAnchor(A);});await W(300);
 ok(await p.evaluate(()=>{const A=__gs.layerByName('Details');return A.cfx&&A.cfx[0].kind==='anchorpt'&&A.cfx[0].p.name==='Details'&&!!document.querySelector('#layerList .msrow.c');}),'✦ › Anchor point puts an anchor row on the layer');
 /* another layer's mask reads the anchor's height */
 await p.evaluate(()=>{__gs.act('addLayer');const B=__gs.doc.active;B.name='Paint over';__gs.msAdd(B,'anchor',{p:{name:'Details',ch:'height',inv:false}});});await W(400);
 const mk=()=>p.evaluate(()=>{const B=__gs.layerByName('Paint over'),d=__gs.readRGBA8(B.mask.target),W=__gs.doc.w;return [d[(64*W+64)*4],d[(10*W+10)*4]];});
 let m=await mk();ok(m[0]>200&&m[1]<150,'From anchor · height: the mask follows the anchor layer’s height '+m);
 /* change the anchor layer: the mask follows */
 await p.evaluate(()=>{const A=__gs.layerByName('Details'),H=__gs.mapT(A,'height'),g=document.querySelector('#gl').getContext('webgl2'),n=128,px=new Uint8Array(n*n*4);for(let i=0;i<n*n;i++)px.set([40,40,40,255],i*4);
   {const T8=__gs.makeTarget(n,n,8,false);g.bindTexture(g.TEXTURE_2D,T8.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,n,n,g.RGBA,g.UNSIGNED_BYTE,px);__gs.copyScaled(T8,H);}A.lookVer=(A.lookVer||0)+1;__gs.requestRender(true);});await W(400);
 m=await mk();ok(m[0]<80,'…live: when the anchor layer changes, so does the mask '+m);
 await p.evaluate(()=>{const A=__gs.layerByName('Details'),H=__gs.mapT(A,'height'),g=document.querySelector('#gl').getContext('webgl2'),n=128,px=new Uint8Array(n*n*4);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){const on=x>32&&x<96&&y>40&&y<88;const v=on?230:128;px.set([v,v,v,255],(y*n+x)*4);}{const T8=__gs.makeTarget(n,n,8,false);g.bindTexture(g.TEXTURE_2D,T8.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,n,n,g.RGBA,g.UNSIGNED_BYTE,px);__gs.copyScaled(T8,H);}A.lookVer++;});
 /* a generator following the anchor: edge wear on the painted block's edges */
 await p.evaluate(()=>{const B=__gs.layerByName('Paint over');B.mask.stack.length=0;__gs.msAdd(B,'gen',{p:{g:'edge',amount:.5,width:.5,breakup:0,contrast:3,scale:6,seed:1,inv:false,anchor:''}});});await W(400);
 const wear=()=>p.evaluate(()=>{const B=__gs.layerByName('Paint over'),d=__gs.readRGBA8(B.mask.target);let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>128)n++;return n;});
 const w0=await wear();
 await p.evaluate(()=>{const B=__gs.layerByName('Paint over'),r=B.mask.stack[0];__gs.msEdit(B,r,x=>{x.p.anchor='Details';});});await W(500);const w1=await wear();
 ok(w1>w0+50,'a generator set to follow the anchor wears the edges of the anchor’s details ('+w0+' → '+w1+')');
 /* renaming the anchor keeps the rows that use it */
 await p.evaluate(()=>{const A=__gs.layerByName('Details');__gs.msSelect(A,'c',A.cfx[0].id);});await W(200);await p.fill('#ms_aname','Blocks');await p.press('#ms_aname','Enter');await W(300);
 ok(await p.evaluate(()=>__gs.layerByName('Paint over').mask.stack[0].p.anchor==='Blocks'),'renaming the anchor keeps the rows that follow it');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
