/* 0.23: mask stacks (rows under a layer: paint, fill, noise, generators, filters) and content effects. */
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
 const N=+process.env.SIZE||256;
 await p.evaluate(()=>{__gs.perf.on=true;});await p.evaluate(n=>__gs.newDoc(n,n,8,[1,1,1],'perf30',false),N);await W(500);
 const raw=require('fs').readFileSync(require('path').resolve(__dirname,'../../assets/materials/aged-copper.gmat'));
 await p.evaluate(async b64=>{const j=await __gs.gmatParse(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));const rec={fill:j.fill,imgs:await __gs.gmatImgs(j)},f=j.fill;
   __gs.cmdNewFillLayer({name:'Copper',maps:f.maps,proj:f.proj,triSharp:f.triSharp,hStr:f.hStr,xf:f.xf,rep:f.rep,front:f.front,imgs:__gs.matRecTargets(rec)});},raw.toString('base64'));await W(1500);
 await p.evaluate(()=>{__gs.act('addMaskHide');});await W(400);
 await p.evaluate(()=>__gs.act('addLayer'));await W(300);
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.fill);__gs.doc.active=L;__gs.requestRender&&__gs.requestRender(true);});await W(300);
 console.log(JSON.stringify(await p.evaluate(()=>({layers:__gs.allLayers().map(l=>l.name+(l.mask?' [mask]':'')+(l.fill?' [fill]':'')),active:__gs.doc.active.name,edit:__gs.doc.active.editMask}))));
 const stroke=async(label)=>{await p.evaluate(()=>{__gs.runStat.n=0;__gs.runStat.px=0;__gs.runStat.by={};__gs.perf.frames=[];});
  const a=await scr(N*.1,N*.1),c=await scr(N*.9,N*.9);await p.mouse.move(a[0],a[1]);await p.mouse.down();
  for(let i=0;i<40;i++){await p.mouse.move(a[0]+(c[0]-a[0])*i/39,a[1]+(c[1]-a[1])*((i%2)?i/39:1-i/39+.2));await p.waitForTimeout(+process.env.GAP||4);}
  await p.mouse.up();await W(300);
  const r=await p.evaluate(()=>{const F=__gs.perf.frames.filter(f=>f.stroke);return {frames:F.length,runs:__gs.runStat.n,Mpx:Math.round(__gs.runStat.px/1e5)/10,runsPerFrame:Math.round(__gs.runStat.n/Math.max(1,F.length)),MpxPerFrame:Math.round(__gs.runStat.px/Math.max(1,F.length)/1e5)/10,by:Object.entries(__gs.runStat.by).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([k,v])=>k+" "+Math.round(v/1e5)/10)};});
  console.log(label,JSON.stringify(r));return r;};
 await stroke('heavy: material + black mask, painting on the mask');
 await b.close();
})();
