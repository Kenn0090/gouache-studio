/* 0.94: carry on drawing from an open end of a finished path */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.newDoc(300,300,8,[1,1,1],'P',false,'hand');});await p.waitForTimeout(400);
 await p.locator('#tools [data-tool="pen"]').click();await p.waitForTimeout(200);
 const at=async(x,y)=>p.evaluate(([x,y])=>{const r=document.getElementById('stage').getBoundingClientRect(),v=__gs.view;return [r.left+v.x+x*v.zoom,r.top+v.y+y*v.zoom];},[x,y]);
 const click=async(x,y)=>{await p.mouse.click(...await at(x,y));await p.waitForTimeout(120);};
 const pts=()=>p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path);return {n:L.paths.length,pts:L.path.points.map(q=>q.p.map(Math.round)),drawing:__gs.pathEdit.drawing};});
 for(const [x,y] of [[60,150],[120,100],[180,150]])await click(x,y);await p.keyboard.press('Enter');await p.waitForTimeout(200);
 let s=await pts();ok(s.n===1&&s.pts.length===3,'a finished open path of three points');
 /* the last point: click it, then click empty canvas: the path carries on */
 await click(180,150);await click(240,100);
 s=await pts();ok(s.n===1&&s.pts.length===4&&s.pts[3][0]===240,'with the last point selected, a click carries the path on ('+JSON.stringify(s.pts)+')');
 ok(s.drawing===true,'and it is drawing, so more clicks add more points');
 await click(270,160);await p.keyboard.press('Enter');await p.waitForTimeout(200);
 s=await pts();ok(s.n===1&&s.pts.length===5&&s.pts[0][0]===60&&s.pts[4][0]===270,'Enter finishes it with the points in order '+JSON.stringify(s.pts.map(q=>q[0])));
 /* the first point: the new points go before it, and the path keeps its direction */
 await click(60,150);await click(30,100);
 s=await pts();ok(s.pts.length===6,'a click carries on from the first point too');
 await p.keyboard.press('Enter');await p.waitForTimeout(200);
 s=await pts();ok(s.pts.length===6&&s.pts[0][0]===30&&s.pts[1][0]===60&&s.pts[5][0]===270,'finished, the new point is first and the direction is as drawn '+JSON.stringify(s.pts.map(q=>q[0])));
 /* with no end selected, a click still starts a new path */
 await p.keyboard.press('Escape');await click(120,250);await p.keyboard.press('Enter');await p.waitForTimeout(200);
 s=await pts();ok(s.n===2,'with nothing selected a click on empty canvas starts a new path');
 /* undo takes the continuation back */
 ok(!errs.length,'no page errors '+errs.join(' | ').slice(0,200));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
