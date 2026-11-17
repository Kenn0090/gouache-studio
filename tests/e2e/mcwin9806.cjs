/* 0.23: Mesh maps from a material (curvature, AO, edges, roughness, metallic from its height) and the Converted source. */
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
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text())&&!/GPU stall due to ReadPixels/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:8});await p.mouse.up();await W(150);};
 const setFG=async hx=>{await p.evaluate(()=>__gs.showPanel('color'));await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const comp=(k,pts)=>p.evaluate(([k,pts])=>{const t=__gs.compositeMap(k),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[k,pts]);
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'mstack',false));await W(300);
 await p.evaluate(()=>{__gs.newDoc(128,128,8,[1,1,1],'mc',false);__gs.setDocMaps(['base','rough','metal','height','normal'],'maps');});await W(300);
 await p.evaluate(()=>{const L=__gs.cmdNewFillLayer({name:'Bumps',maps:{base:{c:[.6,.6,.6]},rough:{v:.5},metal:{v:0}}});
   const n=128,t=__gs.makeTarget(n,n,8,true),g=document.querySelector('#gl').getContext('webgl2'),px=new Uint8Array(n*n*4);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){const cx=(x%32)-16,cy=(y%32)-16,h=Math.max(0,1-Math.hypot(cx,cy)/10);const v=Math.round(40+h*200);px.set([v,v,v,255],(y*n+x)*4);}
   g.bindTexture(g.TEXTURE_2D,t.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,n,n,g.RGBA,g.UNSIGNED_BYTE,px);
   L._fillImg={height:t};Object.assign(L.fill.maps.height,{on:true,src:'image',tile:1,rot:0,name:'bumps'});__gs.fillRender(L);});await W(300);
 const vary=(t)=>{let lo=255,hi=0;for(let i=0;i<t.length;i+=4){lo=Math.min(lo,t[i]);hi=Math.max(hi,t[i]);}return hi-lo;};
 await p.evaluate(()=>__gs.act('matConvert'));await W(300);
 ok(await p.evaluate(()=>!!document.querySelector('#mc_curv')&&!!document.querySelector('#mc_toMat')&&/Mesh maps from a material/.test(document.querySelector('#dlgTitle').textContent)),'Filter › Mesh maps from material… opens its dialog');
 ok(await p.evaluate(()=>{const b=document.querySelector('.mcwide');return !!b&&b.querySelectorAll('.mccol').length===2&&!!document.querySelector('#mc_more')&&document.querySelector('#modal .dialog').classList.contains('resizable');}),'the window is wide, resizable, two columns with a More options fold');
 ok(await p.evaluate(()=>document.querySelector('#mc_more').open===false&&!!document.querySelector('#mc_s')&&!!document.querySelector('#mc_toMesh')),'Strength and Send to are up front, the rest is folded');
 await p.click('#mc_toConvert');await W(1500);
 const cv=await p.evaluate(()=>({m:__gs.ui.mode,src:!!__gs.cvS.src,kind:__gs.cvS.kind,name:__gs.cvS.srcName}));ok(cv.m==='convert'&&cv.src&&cv.kind==='height','Open in Convert tab sends the height '+JSON.stringify(cv));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);})();
