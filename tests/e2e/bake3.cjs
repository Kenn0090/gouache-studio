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


 await p.evaluate(()=>__gs.newDoc(256,256,8,[.5,.5,.5],'solo',false));
 const r=await p.evaluate(async()=>{const C=__gs.bakeCfg;C.high=null;C.low=null;C.cage=null;C.ss=1;C.rays=16;C.pad=4;
   const low=__gs.primMeshX('rcube');for(const k in C.kinds)C.kinds[k]=['ao','curv','id','normal'].includes(k);
   await __gs.runBake(low,Object.keys(C.kinds).filter(k=>C.kinds[k]));return __gs.allLayers().map(l=>l.name);});
 console.log(JSON.stringify(r));ok(r.includes('Baked curvature')&&!r.includes('Baked normal'),'low-only: curvature made, normal skipped');
 const cur=await p.evaluate(()=>{const L=__gs.layerByName('Baked curvature'),d=__gs.readRGBA8(__gs.mapT(L,'curv'));let mn=255,mx=0;for(let i=0;i<d.length;i+=4){mn=Math.min(mn,d[i]);mx=Math.max(mx,d[i]);}return [mn,mx];});
 ok(cur[1]>170,'curvature bright at rounded edges '+cur);
 await p.evaluate(()=>{for(const n of __gs.doc.root.children)if(n.type==='group'){n.visible=true;n.children.forEach(c=>c.visible=c.name==='Curvature');}__gs.doc.root.children.forEach(n=>{if(n.name==='Baked AO')n.visible=false;});});await p.waitForTimeout(300);await p.screenshot({path:OUT+'bake-solo.png'});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
