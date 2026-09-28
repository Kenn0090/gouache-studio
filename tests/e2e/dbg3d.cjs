/* Guide pictures for 3D Paint (docs/wiki/images/p3d-tab.png, material-panel.png, mask-tools.png, levels-simple.png, bake-tabs.png). */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+"/out/";
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
 const r=await p.evaluate(async()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.doc.active=L;__gs.msAdd(L,'grad',{p:{axis:'up',from:0,to:1,inv:false}});__gs.requestRender(true);
   await new Promise(r=>setTimeout(r,800));const m=__gs.v3.mesh,d=__gs.readRGBA8(L.mask.target),W=__gs.doc.w,H=__gs.doc.h;const out=[];
   let ymin=1e9,ymax=-1e9;for(let i=1;i<m.pos.length;i+=3){ymin=Math.min(ymin,m.pos[i]);ymax=Math.max(ymax,m.pos[i]);}
   for(let v=0;v<m.pos.length/3;v+=97){const u=m.uv[v*2],vv=m.uv[v*2+1],x=Math.min(W-1,Math.floor(u*W)),y=Math.min(H-1,Math.floor(vv*H));out.push([+((m.pos[v*3+1]-ymin)/(ymax-ymin)).toFixed(2),d[(y*W+x)*4]]);}
   return {n:m.pos.length/3,out:out.slice(0,20)};});
 console.log(JSON.stringify(r));await b.close();})();
