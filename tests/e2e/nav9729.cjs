/* 0.97.29 (JayM: "drag on the navigator and if you drag it off it makes everything unfunctional"): dragging past the navigator's edge
   used to hide it mid-drag, then its zero size put the view at infinity and no click worked */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>{const g=__gs;g.view.zoom*=6;g.requestRender(true);g.navSync();});await p.waitForTimeout(800);
 const box=await p.locator('#navPip').boundingBox();ok(!!box,'the navigator shows when zoomed in');
 await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();
 for(let i=1;i<=14;i++)await p.mouse.move(box.x+box.width/2-i*60,box.y+box.height/2-i*40);
 const mid=await p.evaluate(()=>!document.getElementById('navPip').hidden);await p.mouse.up();await p.waitForTimeout(400);
 const st=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom,drag:__gs.nav.drag}));
 ok(mid,'it stays shown while it is being dragged past its edge');
 ok(isFinite(st.x)&&isFinite(st.y)&&isFinite(st.z)&&!st.drag,'the view stays a real position and the drag ends '+JSON.stringify(st));
 /* the app still works: a brush stroke paints */
 const before=await p.evaluate(()=>__gs.hist.undo.length);
 await p.evaluate(()=>{__gs.setTool('brush');});await p.mouse.move(600,400);await p.mouse.down();await p.mouse.move(700,450,{steps:5});await p.mouse.up();await p.waitForTimeout(400);
 ok(await p.evaluate(b=>__gs.hist.undo.length>b,before),'painting still works afterwards');
 /* a broken view (from anywhere) is put back on screen */
 await p.evaluate(()=>{__gs.view.x=-Infinity;__gs.requestRender(true);});await p.waitForTimeout(500);
 ok(await p.evaluate(()=>isFinite(__gs.view.x)),'a broken view position is reset by itself');
 ok(!errs.length,'no page errors '+errs.join(' | '));await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
