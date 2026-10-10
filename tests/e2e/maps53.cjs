/* 0.53.1: the Maps tab shows each mesh map as one quiet line. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1600,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'SG',false,'pbrsg'));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 await p.evaluate(()=>{__gs.p3NewProject(512,{setup:'pbr',workflow:'metal',startMaterial:'steel'});});await p.waitForTimeout(2500);
 await p.evaluate(()=>{const t=__gs.makeTarget(1024,1024,8,false);__gs.clearTarget(t,[.5,.5,1,1]);__gs.p3MapSet('normal',t,'Baked normal');__gs.showPanel('maps');});await p.waitForTimeout(600);
 const rows=await p.evaluate(()=>{const f=document.querySelector('[data-mesh-slot=normal]'),e=document.querySelector('[data-mesh-slot=curv]');return {h:f.getBoundingClientRect().height,btns:[...f.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')),emptyBtn:e.querySelector('button').textContent,size:f.querySelector('.meshslotsize').textContent};});
 ok(rows.h<40,'a mesh-map row is one slim line ('+Math.round(rows.h)+' px)');
 ok(rows.btns.join()==='View on the model,Edit in 2D,Replace…,Remove Normal','a filled row has view, edit, replace and remove icons');
 ok(rows.emptyBtn==='Import…'&&rows.size==='1024','an empty row is just Import…, a filled one shows its size');
 ok(errs.length===0,'no page errors '+errs.slice(0,2));
 await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
