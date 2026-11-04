/* 0.27: Autosave keeps every open document tab */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* names from the sites */
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});
 const fill=async hex=>{await p.evaluate(h=>{__gs.setFG(h);__gs.act('addLayer');},hex);await W(100);await p.keyboard.press('Alt+Backspace');await W(300);};
 /* tab 1 */
 await p.evaluate(()=>__gs.act('new'));await W(300);await p.fill('#dW','96');await p.fill('#dH','64');await p.click('#dlgOk');await W(800);
 await p.evaluate(()=>{__gs.doc.name='First';});await fill([1,0,0]);
 /* tab 2 */
 await p.evaluate(()=>__gs.act('new'));await W(300);await p.fill('#dW','80');await p.fill('#dH','80');await p.click('#dlgOk');await W(800);
 await p.evaluate(()=>{__gs.doc.name='Second';});await fill([0,0,1]);
 const ids=await p.evaluate(()=>__gs.dtab().tabs.map(t=>t.id));ok(ids.length>=2,'two tabs open '+ids);
 /* back to the first: the second is now a stashed tab with unsaved work */
 await p.click('#docTabs .dtab >> nth=0').catch(()=>{});await W(600);
 const before=await p.evaluate(()=>({live:__gs.dtab().live,name:__gs.doc.name,w:__gs.doc.w,layers:__gs.allLayers().length}));
 ok(before.name==='First','working on the first tab '+JSON.stringify(before));
 await p.evaluate(()=>__gs.autosaveNow(true));await W(1500);
 const recs=await p.evaluate(async()=>(await __gs.asRecoveries()).map(r=>r.kind+':'+r.name).sort());
 ok(recs.some(r=>/^tab:.*:First$/.test(r))&&recs.some(r=>/^tab:.*:Second$/.test(r)),'both tabs autosaved '+JSON.stringify(recs));
 const after=await p.evaluate(()=>({live:__gs.dtab().live,name:__gs.doc.name,w:__gs.doc.w,layers:__gs.allLayers().length}));
 ok(JSON.stringify(after)===JSON.stringify(before),'the document on screen is unchanged '+JSON.stringify(after));
 ok(await p.evaluate(()=>!document.querySelector('.ascover')),'the screen is free again');
 /* the second tab is intact */
 await p.click('#docTabs .dtab >> nth=1').catch(()=>{});await W(600);
 const s=await p.evaluate(()=>({name:__gs.doc.name,w:__gs.doc.w,c:Array.from(__gs.readRGBA8(__gs.compOut()).slice(0,4))}));
 ok(s.name==='Second'&&s.w===80&&s.c[2]>200&&s.c[0]<40,'the other tab still has its work '+JSON.stringify(s));
 /* nothing changed since: no second copy */
 const w0=await p.evaluate(()=>__gs.asPending());ok(!w0,'nothing left to autosave');
 /* closing a tab drops its copy */
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
