/* 0.88.2: the Brushes panel's sets fold shut (arrow on each header, Fold all, Unfold all) and the choice is remembered. */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1500);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 await p.evaluate(()=>__gs.newDoc(200,200,8,[1,1,1],'Fold',false,'hand'));await p.waitForTimeout(400);
 const state=()=>p.evaluate(()=>{const sets=[...document.querySelectorAll('#libBody > .libset')];return {n:sets.length,folded:sets.filter(s=>s.classList.contains('folded')).length,tiles:sets.map(s=>s.querySelector('.tiles').childElementCount),shown:sets.map(s=>getComputedStyle(s.querySelector('.tiles')).display)};});
 const s0=await state();console.log('start',JSON.stringify({n:s0.n,folded:s0.folded}));
 ok(s0.n>=5&&s0.folded===0,'the brush sets start unfolded ('+s0.n+' sets)');
 // fold one set with its arrow
 await p.evaluate(()=>document.querySelectorAll('#libBody > .libset')[1].querySelector('.libfold').click());await p.waitForTimeout(100);
 const s1=await state();ok(s1.folded===1&&s1.shown[1]==='none','the arrow folds a set shut and hides its brushes');
 // it stays folded after the panel redraws
 await p.evaluate(()=>{const q=__gs.library.flatMap(x=>x.presets)[0];__gs.applyPreset(q);});await p.waitForTimeout(150);
 const s2=await state();ok(s2.folded===1&&s2.shown[1]==='none','a folded set stays folded when the panel redraws');
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('gs.libFold')||'[]').length===1),'what is folded is remembered');
 // click the header title to unfold
 await p.evaluate(()=>document.querySelectorAll('#libBody > .libset')[1].querySelector('.libset-h span').click());await p.waitForTimeout(100);
 const s3=await state();ok(s3.folded===0&&s3.shown[1]!=='none'&&s3.tiles[1]>0,'clicking the title unfolds it again, with its brushes');
 // fold all / unfold all
 await p.evaluate(()=>[...document.querySelectorAll('#libBody .libfoldbar button')].find(b=>/Fold all/.test(b.textContent)&&!/Unfold/.test(b.textContent)).click());await p.waitForTimeout(150);
 const s4=await state();ok(s4.folded===s4.n,'Fold all folds every set ('+s4.folded+'/'+s4.n+')');
 await p.evaluate(()=>[...document.querySelectorAll('#libBody .libfoldbar button')].find(b=>/Unfold all/.test(b.textContent)).click());await p.waitForTimeout(150);
 const s5=await state();ok(s5.folded===0&&s5.shown.every(d=>d!=='none'),'Unfold all opens every set');
 // a brush can still be picked in an open set
 ok(await p.evaluate(()=>{const t=document.querySelector('#libBody .libset:not(.folded) .tiles button, #libBody .libset:not(.folded) .tiles [role]');return !!t;}),'brush tiles are still there in the open sets');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
