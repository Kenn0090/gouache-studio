/* 0.95: custom tangents on path points: handle length and break/join handles */
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
 // 0.95: handle length and breaking the handles of a point
 await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path);__gs.pathSelect(L,[1]);__gs.buildBrushPanel&&__gs.buildBrushPanel();});await p.waitForTimeout(200);
 ok(await p.evaluate(()=>!!document.getElementById('pathTanLen')&&!!document.getElementById('pathBreak')),'the Path panel has Handle length and Break handles for a selected point');
 const r0=await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path);__gs.pathSetTanLen(L.path,1,1);return __gs.pathTanRatio(L.path,1);});
 const r1=await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path);__gs.pathSetTanLen(L.path,1,2);return __gs.pathTanRatio(L.path,1);});
 ok(Math.abs(r0-1)<.01&&Math.abs(r1-2)<.01,'Handle length sets the handles to a share of the automatic ones ('+r0.toFixed(2)+', '+r1.toFixed(2)+')');
 await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path);__gs.pathBreak(L,[1],true);});
 ok(await p.evaluate(()=>__gs.allLayers().find(L=>L.path).path.points[1].broken===true),'Break handles marks the point so its handles move on their own');
 ok(errs.length===0,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
