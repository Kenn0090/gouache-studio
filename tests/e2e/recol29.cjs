/* 0.29: Recolour on a material: keeps the detail, changes only the base colour */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);
 await p.evaluate(()=>__gs.newDoc(64,64,8,[1,1,1],'recol',false));await W(300);
 await p.evaluate(()=>{__gs.act('newFill');});await W(600);
 if(await p.isVisible('#modal'))await p.click('#dlgOk');await W(300);
 await p.evaluate(()=>__gs.showPanel('matEd'));await W(300);
 const px=()=>p.evaluate(()=>{const t=__gs.compositeMap('base'),d=__gs.readRGBA8(t);__gs.release(t);return Array.from(d.slice(0,4));});
 ok(await p.isVisible('#rc_tint')||await p.isVisible('.recolBox'),'the Recolour section shows in the Material panel');
 /* make the base a known orange, then recolour to blue with One colour */
 await p.evaluate(()=>{const L=__gs.doc.active;L.fill.maps.base.on=true;L.fill.maps.base.src='value';L.fill.maps.base.c=[.8,.4,.1];__gs.fillRender(L);});await W(300);
 const a=await px();ok(a[0]>a[2]+80,'starts orange '+a);
 await p.click('.recolBox button:has-text("One colour")');await W(300);
 await p.evaluate(()=>{const L=__gs.doc.active;L.fill.recol.tint=[.1,.3,.9];__gs.fillRender(L);});await W(300);
 const c=await px();ok(c[2]>c[0]+80,'One colour turns it blue '+c);
 await p.click('.recolBox button:has-text("Main colour")');await W(400);
 await p.evaluate(()=>{const L=__gs.doc.active,r=L.fill.recol;r.pairs[0].t=[.1,.8,.2];__gs.fillRender(L);});await W(300);
 const d=await px();ok(d[1]>d[0]+60&&d[1]>d[2]+60,'Main colour swaps the detected orange for green '+d);
 await p.evaluate(()=>{const L=__gs.doc.active;L.fill.recol.mode='off';L.fill.recol.con=1.6;__gs.fillRender(L);});await W(300);
 const e=await px();ok(e[0]!==a[0]||e[1]!==a[1],'Contrast alone changes the picture '+e);
 console.log(errs.join('\n'));console.log(fails?'FAILS '+fails:'ALL PASSED');await b.close();process.exit(fails?1:0);})();
