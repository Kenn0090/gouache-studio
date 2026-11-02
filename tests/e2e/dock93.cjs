/* 0.93: a second column in Paint (drag a tab to the right edge of the canvas) and floating panels */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.newDoc(400,400,8,[1,1,1],'D',false,'hand');});await p.waitForTimeout(500);
 const vis=s=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&e.getClientRects().length>0;},s);
 ok(!(await vis('#dock2')),'Paint starts with no second column');
 const drag=async(label,tx,ty)=>{const t=await p.locator('.dktab:text-is("'+label+'")').first().boundingBox();await p.mouse.move(t.x+20,t.y+10);await p.mouse.down();await p.mouse.move(tx,ty,{steps:12});await p.mouse.up();await p.waitForTimeout(400);};
 const wr=await p.evaluate(()=>{const r=document.querySelector('#workWrap').getBoundingClientRect();return {r:r.right,t:r.top,h:r.height,l:r.left,w:r.width};});
 await drag('Brushes',wr.r-12,wr.t+wr.h/2);
 ok(await vis('#dock2'),'dropping a tab at the right edge of the canvas makes a new column');
 ok(await p.evaluate(()=>[...document.querySelectorAll('#dock2 .dktab')].some(e=>e.textContent.trim()==='Brushes')),'the Brushes tab is in it');
 ok(await p.evaluate(()=>!![...document.querySelectorAll('#dock .dktab')].find(e=>e.textContent.trim()==='Textures')),'the other tabs stay in the main dock');
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('gs.dock')).col2P.groups.length===1),'the column is remembered');
 // outside everything → floating
 await drag('Textures',wr.l+wr.w/2,wr.t+wr.h/2);
 ok(await p.evaluate(()=>document.querySelectorAll('.dkfloat').length>=1&&!![...document.querySelectorAll('.dkfloat .dktab')].find(e=>e.textContent.trim()==='Textures')),'dropping on the middle of the canvas makes a floating panel');
 // empty the column → it goes away
 await p.evaluate(()=>{const id='brushes';__gs.dkMove(id,{group:__gs.dk.L.groups[0]});});await p.waitForTimeout(300);
 ok(!(await vis('#dock2')),'the column disappears when it is empty');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
