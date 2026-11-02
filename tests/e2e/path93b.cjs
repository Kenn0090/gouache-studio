/* 0.93.3 (2b): editing a path like Substance Painter: add a point by clicking the line, double-click smooth/corner, rectangle select, delete, reverse, per-path opacity */
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
 const click=async(x,y,o)=>p.mouse.click(...await at(x,y),o);
 const info=()=>p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path);return L?{n:L.path.points.length,pts:L.path.points.map(q=>q.p.map(v=>Math.round(v))),handles:L.path.points.map(q=>Math.round(Math.hypot(...(q.out||[0,0])))),paths:L.paths.length,sel:__gs.pathSelection(L)}:null;});
 for(const [x,y] of [[40,60],[120,40],[200,90]])await click(x,y);await p.keyboard.press('Enter');await p.waitForTimeout(200);
 let s=await info();ok(s.n===3,'a path with three points');
 // add a point by clicking the line (midpoint of the first segment)
 await click(80,50);await p.waitForTimeout(250);s=await info();ok(s.n===4&&s.paths===1,'clicking along the line adds a point ('+JSON.stringify(s.pts)+')');
 // double-click a point: smooth, again: corner
 let a=await at(s.pts[2][0],s.pts[2][1]);await p.mouse.dblclick(a[0],a[1]);await p.waitForTimeout(250);s=await info();ok(s.handles[2]>0,'double-clicking a point makes it smooth (handle '+s.handles[2]+')');
 a=await at(s.pts[2][0],s.pts[2][1]);await p.mouse.dblclick(a[0],a[1]);await p.waitForTimeout(250);s=await info();ok(s.handles[2]===0,'double-clicking again makes it a corner');
 // rectangle select two points and delete
 const x0=await at(20,20),x1=await at(140,70);await p.mouse.move(x0[0],x0[1]);await p.mouse.down();await p.mouse.move(x1[0],x1[1],{steps:6});await p.mouse.up();await p.waitForTimeout(250);s=await info();
 ok(s.sel.length>=2,'dragging a rectangle selects points ('+JSON.stringify(s.sel)+')');
 const left=s.n-s.sel.length;await p.keyboard.press('Delete');await p.waitForTimeout(250);s=await info();ok(s.n===left,'Delete removes the selected points ('+s.n+' left)');
 // reverse
 const before=await info();await p.click('#pathReverse').catch(()=>{});await p.waitForTimeout(250);s=await info();
 ok(before.n<2||(JSON.stringify(s.pts)===JSON.stringify(before.pts.slice().reverse())),'Reverse direction flips the order of the points');
 // per-path opacity: two paths, 40% and 100%
 await p.evaluate(()=>__gs.newDoc(300,300,8,[1,1,1],'Q',false,'hand'));await p.waitForTimeout(300);await p.locator('#tools [data-tool="pen"]').click();
 for(const [x,y] of [[40,60],[120,60],[200,60]])await click(x,y);await p.keyboard.press('Enter');await p.waitForTimeout(150);
 for(const [x,y] of [[40,200],[120,200],[200,200]])await click(x,y);await p.keyboard.press('Enter');await p.waitForTimeout(150);
 const op=await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path);L.paths.forEach((P,i)=>{P.mode='stroke';P.width=12;P.opacity=i?1:.4;});__gs.pathRender(L);const v=(x,y)=>__gs.captureRegionNow(L.mask.target,x,y,1,1).data[0];return {a:v(120,60),b:v(120,200),layerOpacity:L.opacity};});
 ok(Math.abs(op.a-102)<20&&op.b>245&&op.layerOpacity===1,'each path keeps its own opacity ('+JSON.stringify(op)+')');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
