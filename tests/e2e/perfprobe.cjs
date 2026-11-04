/* A profiling helper (not a pass/fail test): runs typical painting jobs and prints what they cost.
   Counts graphics-card passes and pixels per program (runStat), readbacks (the slow ones), texture and buffer creation, and wall time.
   SIZE=2048 LAYERS=6 node perfprobe.cjs [2d|3d|all]   (software GPU: compare numbers, do not trust absolute times) */
const {chromium}=require('playwright');
const SIZE=+process.env.SIZE||2048,LAYERS=+process.env.LAYERS||6,WHICH=process.argv[2]||'all';
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 await p.addInitScript(()=>{const C={rp:0,rpMs:0,tex:0,texMs:0,fbo:0,sub:0,subMs:0,flush:0};window.__gl=C;const G=WebGL2RenderingContext.prototype;
  const wrap=(n,cnt,ms)=>{const o=G[n];G[n]=function(){const t=performance.now();const r=o.apply(this,arguments);C[cnt]++;if(ms)C[ms]+=performance.now()-t;return r;};};
  wrap('readPixels','rp','rpMs');wrap('texImage2D','tex','texMs');wrap('createFramebuffer','fbo');wrap('texSubImage2D','sub','subMs');wrap('finish','flush');});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const reset=()=>p.evaluate(()=>{const S=__gs.runStat;S.n=0;S.px=0;S.by={};const C=window.__gl;for(const k in C)C[k]=0;if(__gs.perf){__gs.perf.on=true;__gs.perf.frames=[];}});
 const report=async(label,t0)=>{const r=await p.evaluate(()=>{const S=__gs.runStat,C=window.__gl,top=Object.entries(S.by).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>k+' '+(v/1e6).toFixed(1)+'M');
   return {passes:S.n,Mpx:+(S.px/1e6).toFixed(1),top,readbacks:C.rp,readMs:Math.round(C.rpMs),texImage:C.tex,texMs:Math.round(C.texMs),fbos:C.fbo,subImage:C.sub,frames:__gs.perf?__gs.perf.frames.length:0};});
  console.log(label.padEnd(34),'wall '+String(Math.round(performance.now()-t0)).padStart(6)+' ms',JSON.stringify(r));};
 const cdp=await p.context().newCDPSession(p);const PROF=!!process.env.PROFILE;if(PROF)await cdp.send('Profiler.enable');
 const top=async(label)=>{const {profile}=await cdp.send('Profiler.stop');const self={},byId={};for(const n of profile.nodes)byId[n.id]=n;const dt=profile.timeDeltas,tot=dt.reduce((a,b)=>a+b,0);
   profile.samples.forEach((id,i)=>{const n=byId[id],cf=n.callFrame,k=(cf.functionName||'(anon)')+' :'+cf.lineNumber;self[k]=(self[k]||0)+dt[i];});
   if(process.env.CALLERS){const parent={};for(const n of profile.nodes)for(const c of (n.children||[]))parent[c]=n.id;const want=process.env.CALLERS,agg={};profile.samples.forEach((id,i)=>{const n=byId[id];if(n.callFrame.functionName!==want)return;let chain=[],q=parent[id],d=0;while(q&&d<7){const c=byId[q].callFrame;chain.push((c.functionName||'(anon)')+':'+c.lineNumber);q=parent[q];d++;}const k=chain.join(' <- ');agg[k]=(agg[k]||0)+dt[i];});
     Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,4).forEach(([k,v])=>console.log('     callers of '+want+' '+(v/1000).toFixed(0)+' ms: '+k));}
   console.log('   hot JS ('+label+', '+Math.round(tot/1000)+' ms sampled):');Object.entries(self).sort((a,b)=>b[1]-a[1]).slice(0,+process.env.TOP||14).forEach(([k,v])=>console.log('     '+(v/1000).toFixed(0).padStart(6)+' ms  '+k));};
 const time=async(label,fn)=>{await reset();if(PROF){await cdp.send('Profiler.setSamplingInterval',{interval:200});await cdp.send('Profiler.start');}const t0=performance.now();await fn();await p.waitForTimeout(250);await report(label,t0);if(PROF)await top(label);};
 if(WHICH==='2d'||WHICH==='all'){
  await p.evaluate(([n,L])=>{__gs.newDoc(n,n,8,[1,1,1],'perf',false);for(let i=0;i<L;i++)__gs.act('addLayer');},[SIZE,LAYERS]);await p.waitForTimeout(1500);
  const box=await p.locator('#gl').boundingBox();
  const scr=async(fx,fy)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+fx*SIZE*v.z,box.y+v.y+fy*SIZE*v.z];};
  const stroke=async(n)=>{const a=await scr(.2,.3),c=await scr(.6,.5);await p.mouse.move(a[0],a[1]);await p.mouse.down();for(let i=0;i<n;i++){const t=i/(n-1);await p.mouse.move(a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t+Math.sin(t*9)*40);await p.waitForTimeout(4);}await p.mouse.up();};
  await p.evaluate(()=>{__gs.setTool&&__gs.setTool('brush');});
  await time('brush stroke (60 moves)',()=>stroke(60));
  await time('second stroke (warm)',()=>stroke(60));
  await time('undo',()=>p.evaluate(()=>__gs.undo()));
  await time('redo',()=>p.evaluate(()=>__gs.redo&&__gs.redo()));
  await p.evaluate(()=>{__gs.ui.sym.mode='radial';__gs.ui.sym.n=8;});
  await time('stroke with radial symmetry x8',()=>stroke(60));
  await p.evaluate(()=>{__gs.ui.sym.mode='off';});
  await time('add layer',()=>p.evaluate(()=>__gs.act('addLayer')));
  await time('switch layer x10',async()=>{for(let i=0;i<10;i++){await p.evaluate(i=>{const L=__gs.allLayers();__gs.doc.active=L[i%L.length];__gs.requestRender(true);},i);await p.waitForTimeout(40);}});
  await time('invert (whole canvas)',()=>p.evaluate(()=>__gs.act('invert')));
  await time('select all + feather',()=>p.evaluate(()=>{__gs.act('selAll');}));
  await time('zoom steps x8',async()=>{for(let i=0;i<8;i++){await p.mouse.move(700,450);await p.mouse.wheel(0,i<4?-240:240);await p.waitForTimeout(60);}});
  await time('hide/show layer x10',async()=>{for(let i=0;i<10;i++){await p.evaluate(()=>{const L=__gs.allLayers()[1];L.visible=!L.visible;__gs.requestRender(true);});await p.waitForTimeout(40);}});
 }
 if(WHICH==='3d'||WHICH==='all'){
  await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'painting',false));await p.waitForTimeout(300);
  await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(2500);
  await p.evaluate(n=>__gs.p3Resize(n),+process.env.TEX||2048);await p.waitForTimeout(2000);
  const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
  await p.evaluate(()=>{Object.assign(__gs.brush,{size:40,hardness:1,opacity:1,flow:1,smoothing:0,pSize:false,tip:null});});
  const st3=async()=>{await p.mouse.move(cx-90,cy-20);await p.mouse.down();for(let i=0;i<40;i++){await p.mouse.move(cx-90+i*4.5,cy-20+Math.sin(i/3)*30);await p.waitForTimeout(8);}await p.mouse.up();};
  await time('3D: idle frame (render)',()=>p.evaluate(()=>{__gs.requestRender(true);}));
  await time('3D: stroke on model (40 moves)',st3);
  await time('3D: second stroke',st3);
  await time('3D: orbit (Alt+drag x30)',async()=>{await p.keyboard.down('Alt');await p.mouse.move(cx,cy);await p.mouse.down();for(let i=0;i<30;i++){await p.mouse.move(cx+i*4,cy+i,{steps:1});await p.waitForTimeout(8);}await p.mouse.up();await p.keyboard.up('Alt');});
  await time('3D: hover over model x40',async()=>{for(let i=0;i<40;i++){await p.mouse.move(cx-60+i*3,cy+Math.sin(i/4)*20);await p.waitForTimeout(8);}});
  await time('3D: undo',()=>p.evaluate(()=>__gs.undo()));
 }
 console.log(errs.length?'ERRORS '+errs.join('|'):'(no page errors)');
 await b.close();
})();
