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
 await p.evaluate(()=>__gs.cmdNewFillLayer());await W(600);
 await p.evaluate(()=>__gs.act('addLayer'));await W(300);
 const info=await p.evaluate(()=>({layers:__gs.allLayers().map(l=>l.name+(l.mask?' [mask]':'')+(l.fill?' [fill]':'')),active:__gs.doc.active.name}));console.log(JSON.stringify(info));
 const setActive=(pred)=>p.evaluate(pr=>{const L=__gs.allLayers().find(new Function('l','return '+pr));__gs.setActiveLayer?__gs.setActiveLayer(L):(__gs.doc.active=L);__gs.requestRender&&__gs.requestRender(true);return !!L;},pred);
 const stroke=async(label)=>{await p.evaluate(()=>{__gs.runStat.n=0;__gs.runStat.px=0;__gs.runStat.by={};__gs.perf.frames=[];});
  const a=await scr(N*.1,N*.1),c=await scr(N*.9,N*.9);await p.mouse.move(a[0],a[1]);await p.mouse.down();
  for(let i=0;i<40;i++){await p.mouse.move(a[0]+(c[0]-a[0])*i/39,a[1]+(c[1]-a[1])*((i%2)?i/39:1-i/39+.2));await p.waitForTimeout(+process.env.GAP||4);}
  await p.mouse.up();await W(300);
  const r=await p.evaluate(()=>{const F=__gs.perf.frames.filter(f=>f.stroke);return {frames:F.length,runs:__gs.runStat.n,Mpx:Math.round(__gs.runStat.px/1e5)/10,runsPerFrame:Math.round(__gs.runStat.n/Math.max(1,F.length)),MpxPerFrame:Math.round(__gs.runStat.px/Math.max(1,F.length)/1e5)/10,by:Object.entries(__gs.runStat.by).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([k,v])=>k+" "+Math.round(v/1e5)/10)};});
  console.log(label,JSON.stringify(r));return r;};
 await stroke('paint layer on top');
 console.log(await setActive('l.fill'));
 await p.evaluate(()=>{__gs.act('addMask');});await W(400);
 console.log(JSON.stringify(await p.evaluate(()=>({m:!!__gs.doc.active.mask,edit:__gs.doc.active.editMask,name:__gs.doc.active.name}))));
 const rb=await stroke('material layer with mask, painting on the mask');
 await p.evaluate(()=>{__gs.prefs.paintSpeed='fast';});
 const rf=await stroke('same, painting speed Fast');
 await p.evaluate(()=>{__gs.prefs.paintSpeed='balanced';});const rm=await stroke('same, Balanced');
 ok(rf.frames<rb.frames*.7,'Fast redraws less often than Best ('+rb.frames+' -> '+rf.frames+' screen updates)');ok(rm.frames<rb.frames&&rm.frames>rf.frames,'Balanced is in between ('+rm.frames+')');
 ok(Math.abs(rf.runs-rb.runs)<rb.runs*.05,'the paint itself is the same ('+rb.runs+' vs '+rf.runs+' brush dabs)');
 await p.evaluate(()=>{__gs.prefs.paintSpeed=undefined;});
 /* the viewport settings carry the same two switches */
 await p.click('#btn3d');await W(1500);
 const has=await p.evaluate(()=>{const g=document.querySelector('#v3Gear');if(!g)return 'nogear';g.click();const t=document.querySelector('.v3set').textContent;return /Engine quality/.test(t)&&/Painting speed/.test(t);});
 ok(has===true,'the viewport settings carry both switches');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,200));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})();
