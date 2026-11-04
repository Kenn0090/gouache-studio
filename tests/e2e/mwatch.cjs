/* 0.27: Automatic model updater: a model file saved again elsewhere is offered back, then baked again */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* names from the sites */
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 /* pretend files on disk */
 await p.evaluate(()=>{const quads=n=>{let s='';for(let i=0;i<n;i++){const x=i*2;s+=`v ${x} 0 0\nv ${x+1} 0 0\nv ${x+1} 1 0\nv ${x} 1 0\n`;}s+='vt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\n';for(let i=0;i<n;i++){const b=i*4;s+=`f ${b+1}/1 ${b+2}/2 ${b+3}/3 ${b+4}/4\n`;}return new TextEncoder().encode(s);};
   window.__files={'C:/art/box.obj':{t:100,b:quads(1)},'C:/art/high.obj':{t:100,b:quads(3)}};window.__quads=quads;
   __gs.mw.stat=async p=>window.__files[p].t;__gs.mw.read=async p=>window.__files[p].b.slice();
   __gs.mw.p3Bake=(...a)=>{window.__rebaked=a;};});
 await p.evaluate(async()=>{const g=__gs,m=g.parseOBJ(window.__files['C:/art/box.obj'].b,'box');await g.mwTag(m,'C:/art/box.obj');g.p3.imported=m;g.useModel(m);});await W(800);
 const tris=()=>p.evaluate(()=>__gs.v3.imported.tris);
 ok(await tris()===2&&await p.evaluate(()=>__gs.mwModels().length===1),'the model is followed');
 /* saved again: asks */
 await p.evaluate(()=>{window.__files['C:/art/box.obj']={t:200,b:window.__quads(2)};__gs.mwTick();});await W(800);
 ok(await p.locator('#dlgTitle').textContent()==='The model changed'&&await p.locator('#mwAlways').count()===1,'saving the file again asks to update it (with an "always" choice)');
 await p.click('#dlgOk');await W(1500);
 ok(await tris()===4,'Update loads the new model '+await tris());
 ok(await p.evaluate(()=>__gs.v3.imported.srcPath==='C:/art/box.obj'&&__gs.p3.imported===__gs.v3.imported),'…in 3D Paint, still followed');
 /* nothing changed: nothing asked */
 await p.evaluate(()=>__gs.mwTick());await W(500);ok(await p.evaluate(()=>document.getElementById('modal').hidden),'no question when the file has not changed');
 /* always: no questions, and it bakes again with the last settings */
 await p.evaluate(()=>{__gs.prefs.meshAuto=true;__gs.p3bk.lastArgs={ks:['ao'],size:128,which:['default']};window.__files['C:/art/box.obj']={t:300,b:window.__quads(3)};__gs.mwTick();});await W(1800);
 ok(await tris()===6&&await p.evaluate(()=>document.getElementById('modal').hidden),'with "always", it updates without asking');
 ok(await p.evaluate(()=>JSON.stringify(window.__rebaked))==='[["ao"],128,["default"]]','…and bakes again with the last settings');
 /* the high-poly: always asks, even with "always" */
 await p.evaluate(async()=>{const g=__gs,h=g.parseOBJ(window.__files['C:/art/high.obj'].b,'high');await g.mwTag(h,'C:/art/high.obj');g.bakeCfg.high=h;window.__files['C:/art/high.obj']={t:400,b:window.__quads(5)};g.mwTick();});await W(800);
 ok(await p.locator('#dlgTitle').textContent()==='The high-poly changed','a changed high-poly is never updated without asking');
 await p.click('#dlgCancel');await W(400);
 ok(await p.evaluate(()=>__gs.bakeCfg.high.tris===6),'"Not now" keeps the old high-poly');
 await p.evaluate(()=>__gs.mwTick());await W(500);ok(await p.evaluate(()=>document.getElementById('modal').hidden),'and does not ask again for the same save');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
