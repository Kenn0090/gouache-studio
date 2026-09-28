/* 0.25: shape corner bevel with segments (like a 3D bevel), rounding the whole shape, stepped height bevel. */
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
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1,opts={})=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:opts.steps||8});await p.mouse.up();await p.waitForTimeout(120);};
 const mpx=(name,k,pts)=>p.evaluate(([name,k,pts])=>{const L=__gs.layerByName(name),t=__gs.mapT(L,k);if(!t||t.empty)return null;const d=__gs.readRGBA8(t),W=__gs.doc.w;return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[name,k,pts]);
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const comp=(k,pts)=>p.evaluate(([k,pts])=>{const t=__gs.compositeMap(k),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[k,pts]);
 const W=ms=>p.waitForTimeout(ms||150);
 await p.evaluate(()=>__gs.newDoc(200,200,8,[1,1,1],'shape25',false));await W(300);await setFG('#3060c0');
 await p.keyboard.press('u');await W(150);await p.click('#brushBody .segb:text-is("Rectangle")');await drag(40,40,160,160);
 const set=f=>p.evaluate(f);const rr=()=>p.evaluate(()=>{const L=__gs.doc.active;__gs.renderShape(L);});
 let px=await mpx('Rectangle','base',[[42,42],[100,100]]);ok(px[0][3]>200,'a plain rectangle has sharp corners');
 ok(await p.evaluate(()=>!!document.querySelector('#shpCbSize')&&!!document.querySelector('#shpCbSeg')),'the Shape panel has Corner bevel: Amount and Segments');
 await set(()=>{__gs.doc.active.shape.cb={size:30,seg:1};});await rr();await W(200);
 px=await mpx('Rectangle','base',[[45,45],[49,49],[62,62],[100,100]]);ok(px[0][3]<30&&px[1][3]<30&&px[2][3]>200,'1 segment cuts the corners flat '+JSON.stringify(px.map(q=>q[3])));
 await set(()=>{__gs.doc.active.shape.cb={size:30,seg:8};});await rr();await W(200);
 px=await mpx('Rectangle','base',[[45,45],[49,49]]);ok(px[0][3]<30&&px[1][3]>150,'more segments round them '+JSON.stringify(px.map(q=>q[3])));
 /* the whole shape rounded in height */
 await set(()=>{const s=__gs.doc.active.shape;s.cb={size:0,seg:1};s.bevel={on:true,profile:'round',size:8,depth:1,dir:'up',seg:0,full:true};});await rr();await W(300);
 let h=await mpx('Rectangle','height',[[100,100],[70,100],[50,100]]);ok(h&&h[0][0]>h[1][0]+8&&h[1][0]>h[2][0]+8,'Round the whole shape: the height rises all the way to the middle '+JSON.stringify(h&&h.map(q=>q[0])));
 const line=async()=>(await mpx('Rectangle','height',[[44,100],[48,100],[52,100],[56,100],[60,100],[64,100],[68,100],[72,100]])).map(q=>q[0]);
 const smooth=await line();await set(()=>{__gs.doc.active.shape.bevel.seg=2;});await rr();await W(300);const steps=await line();
 ok(smooth.join()!==steps.join(),'height Segments make the bevel faceted, like a 3D bevel '+smooth+' / '+steps);
 /* a star with bevelled points */
 await p.click('#brushBody .segb:text-is("Star")');await drag(20,20,90,90);await set(()=>{__gs.doc.active.shape.cb={size:6,seg:4};});await rr();await W(200);
 px=await mpx('Star','base',[[55,55]]);ok(px&&px[0][3]>200,'stars and polygons take the corner bevel too');
 ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
