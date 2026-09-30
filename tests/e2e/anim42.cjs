/* 0.42: effect tracks with keyframes */
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
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(64,48,8,[1,1,1],'a42',false));await W(300);
 await p.click('#modeTabs [data-mode=anim]');await W(300);
 /* paint a dot on frame 1, make 4 frames */
 await p.evaluate(()=>{__gs.quickDupli(3,'end');});await W(300);
 await p.evaluate(()=>__gs.afxAdd('blur'));await W(300);
 ok(await p.evaluate(()=>__gs.afxList().length===1),'effect added');
 ok(await p.evaluate(()=>!!document.querySelector('.afxhead')),'effect row shown');
 const key=await p.evaluate(()=>{const d=Object.keys(__gs.afxList()[0].v).find(k=>typeof __gs.afxList()[0].v[k]==='number');return d;});
 await p.evaluate(k=>{__gs.afxSetKey(0,k,0,0,'lin');__gs.afxSetKey(0,k,3,30,'lin');},key);await W(200);
 const vals=await p.evaluate(k=>[0,1,2,3].map(f=>__gs.afxValue(__gs.afxList()[0],k,f)),key);
 ok(Math.abs(vals[0])<1e-6&&Math.abs(vals[3]-30)<1e-6&&Math.abs(vals[1]-10)<1e-6,'values blend between keys '+vals.join(','));
 await p.evaluate(()=>{const A=__gs.anim;A.cur=1;__gs.afxApply();});
 ok(await p.evaluate(k=>Math.abs(__gs.afxList()[0]._L.fx.stack[0].v[k]-10)<1e-6,key),'layer gets the frame value');
 const r=await p.evaluate(()=>__gs.afxRenderAll(__gs.anim).length);ok(r===4,'export renders every frame with effects');
 const sv=await p.evaluate(()=>__gs.afxLoad(JSON.parse(JSON.stringify(__gs.afxSave()))).length);ok(sv===1,'saves and loads');
 await p.keyboard.press('Control+z');await W(400);
 ok(await p.evaluate(()=>__gs.afxList().length===1),'undo after keys keeps the effect');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
