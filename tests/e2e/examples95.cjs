/* 0.95: the new welcome-screen examples build without errors and paint something */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/*',r=>{const u=r.request().url();const O='/home/user/gouache-studio/tests/e2e/';
  if(u.includes('pako'))return r.fulfill({path:O+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:O+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:O+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  {const m=u.match(/materials\/([a-z0-9-]+\.gmat)$/);if(m)return r.fulfill({path:'/home/user/gouache-studio/assets/materials/'+m[1],contentType:'application/octet-stream'});}
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.addInitScript(()=>{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 const ids=await p.evaluate(()=>__gs.EXAMPLES.map(e=>e.id));
 ok(['cobble','p3metal','planks','brushes','p3rust','p3stone','p3bronze'].every(i=>ids.includes(i)),'the welcome screen lists the new examples ('+ids.join(', ')+')');
 /* painted examples: layers and some paint */
 const stat=(fn,a)=>p.evaluate(fn,a);
 await stat(()=>__gs.exWoodPlanks());
 const w=await stat(()=>{const t=__gs.compositeMap('base'),d=__gs.captureRegionNow(t,0,0,t.w,t.h).data;__gs.release(t);let dark=0,warm=0;for(let i=0;i<d.length;i+=4){if(d[i]<90)dark++;if(d[i]>120&&d[i+2]<110)warm++;}return {name:__gs.doc.name,layers:__gs.allLayers().length,dark,warm,n:d.length/4};});
 ok(w.name==='Wood planks'&&w.layers>=6&&w.warm>w.n*.4,'the wood planks example has its layers and is mostly warm wood ('+JSON.stringify(w)+')');
 await stat(()=>__gs.exBrushSampler());
 const s=await stat(()=>{const t=__gs.compositeMap('base'),d=__gs.captureRegionNow(t,0,0,t.w,t.h).data;__gs.release(t);let ink=0;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-243)+Math.abs(d[i+1]-236)>60)ink++;return {name:__gs.doc.name,layers:__gs.allLayers().length,ink};});
 ok(s.name==='Brush sampler'&&s.layers>=10&&s.ink>3000,'the brush sampler has ten stroke layers and real paint ('+JSON.stringify(s)+')');
 /* 3D examples */
 for(const id of ['p3rust','p3stone','p3bronze']){
   await stat(()=>{__gs.setMode('p3d',true);});await p.waitForTimeout(1500);
   const before=await stat(()=>__gs.doc.root.children.length);
   await stat(i=>__gs.EXAMPLES.find(e=>e.id===i).run(),id).catch(()=>{});
   for(let k=0;k<30&&(await stat(()=>__gs.doc.root.children.length))<=before;k++)await p.waitForTimeout(500);
   const after=await stat(()=>__gs.doc.root.children.length);ok(after>before,id+' adds its smart materials ('+before+' -> '+after+' layers)');}
 ok(errs.length===0,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
