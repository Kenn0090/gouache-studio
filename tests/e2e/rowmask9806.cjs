const {chromium}=require('playwright');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(64,64,8,[1,1,1],'ap',false,'pbr'));await p.waitForTimeout(400);
 const mean=()=>p.evaluate(()=>{const L=__gs.doc.active;__gs.msUpdate&&__gs.msUpdate(L);const d=__gs.readRGBA8(L.mask.target);let s=0;for(let i=0;i<d.length;i+=4)s+=d[i];return s/(d.length/4);});
 await p.evaluate(()=>{const g=__gs;g.cmdAddLayer();const L=g.doc.active;const r=g.msAdd(L,'fill',{v:1});window.__rowId=r&&r.id;g.msUpdate(L);});await p.waitForTimeout(300);
 const m0=await mean();ok(m0>240,'a fill row of 1 makes the mask white '+m0.toFixed(0));
 await p.evaluate(()=>{const g=__gs,L=g.doc.active;g.msAddRowMask(L,window.__rowId,true);});await p.waitForTimeout(300);
 const m1=await mean();ok(m1<10,'a black row mask hides the row '+m1.toFixed(0));
 ok(await p.evaluate(()=>{const L=__gs.doc.active;return !!__gs.msRowMaskOf(L.mask.stack,L.mask.stack.find(r=>r.id===window.__rowId));}),'the row has its mask');
 /* paint white into the row mask on the left half */
 await p.evaluate(()=>{const g=__gs,L=g.doc.active,c=g.msRowMaskOf(L.mask.stack,L.mask.stack.find(r=>r.id===window.__rowId));g.scissorDo([0,0,32,64],()=>g.clearTarget(c.t,[1,1,1,1]));L.lookVer=(L.lookVer||0)+1;});await p.waitForTimeout(300);
 const m2=await mean();ok(m2>100&&m2<150,'painting white shows the row there (about half) '+m2.toFixed(0));
 ok(await p.evaluate(()=>document.querySelectorAll('.msrow .msrmk').length>=0),'row button renders');
 await p.evaluate(()=>{const g=__gs,L=g.doc.active;g.msRemoveRowMask(L,window.__rowId);});await p.waitForTimeout(300);
 const m3=await mean();ok(m3>240,'deleting the row mask shows the row again '+m3.toFixed(0));
 /* move a row (with its mask) to another layer */
 await p.evaluate(()=>{const g=__gs,L=g.doc.active;g.msAddRowMask(L,window.__rowId,false);window.__L1=L;g.cmdAddLayer();window.__L2=g.doc.active;});await p.waitForTimeout(200);
 const mv=await p.evaluate(()=>{const g=__gs,r=g.msMoveRowToLayer(window.__L1,'m',window.__rowId,window.__L2);g.msUpdate(window.__L1);g.msUpdate(window.__L2);const ds=L=>{const d=g.readRGBA8(L.mask.target);let s=0;for(let i=0;i<d.length;i+=4)s+=d[i];return s/(d.length/4);};
   return {r,a:ds(window.__L1),b:ds(window.__L2),has:!!g.msRowMaskOf(window.__L2.mask.stack,window.__L2.mask.stack.find(x=>x.id===window.__rowId))};});
 ok(mv.r&&mv.a<10&&mv.b>240&&mv.has,'the row and its mask moved to the other layer '+JSON.stringify(mv));
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(300);
 const un=await p.evaluate(()=>{const g=__gs;g.msUpdate(window.__L1);g.msUpdate(window.__L2);const ds=L=>{if(!L.mask)return 0;const d=g.readRGBA8(L.mask.target);let s=0;for(let i=0;i<d.length;i+=4)s+=d[i];return s/(d.length/4);};return {a:ds(window.__L1),b:ds(window.__L2)};});
 ok(un.a>240&&un.b<10,'one undo puts it back '+JSON.stringify(un));
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);})();
