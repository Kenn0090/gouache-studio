/* 0.94: delete a single imported brush with a right-click */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.newDoc(300,300,8,[1,1,1],'D',false,'hand');
   const mk=n=>({name:n,tool:'brush',size:20,tip:null});__gs.library.push({id:'imp1',name:'Imported',presets:[mk('Alpha'),mk('Beta'),mk('Gamma')],tips:[]});__gs.renderLibrary&&__gs.renderLibrary();});
 await p.evaluate(()=>__gs.showPanel('brushes'));await p.waitForTimeout(500);
 const n0=await p.evaluate(()=>document.querySelectorAll('#libBody button[aria-label="Beta"]').length);ok(n0===1,'the imported brush shows in the panel');
 await p.click('#libBody button[aria-label="Beta"]',{button:'right'});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>/Delete “Beta”/.test(document.body.innerText)),'right-click asks to delete it');
 await p.click('text=Delete >> nth=-1');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>__gs.library.find(s=>s.id==='imp1').presets.map(q=>q.name).join()==='Alpha,Gamma'),'only that brush is gone');
 await p.click('#libBody button[aria-label="Round"]',{button:'right'}).catch(()=>{});await p.waitForTimeout(200);
 ok(!(await p.evaluate(()=>/Delete “Round”/.test(document.body.innerText))),'built-in brushes cannot be deleted');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
