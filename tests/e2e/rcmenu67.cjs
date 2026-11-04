/* 0.67: right-click brush picker (2D canvas and the 3D model): sliders, collections, search, textures as brush tips */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'rc',false));await p.waitForTimeout(300);
 await p.keyboard.press('b');
 const box=await p.locator('#gl').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
 const open=()=>p.evaluate(()=>!!document.getElementById('brushPop'));
 await p.mouse.click(cx,cy,{button:'right'});await p.waitForTimeout(400);
 ok(await open(),'right-click on the canvas with the brush opens the brush picker');
 ok(await p.evaluate(()=>!!document.getElementById('rcSize')&&!!document.getElementById('rcOp')),'it has size and opacity sliders');
 ok(await p.evaluate(()=>document.querySelectorAll('#brushPop .bptile').length>8&&document.querySelectorAll('#brushPop details.bpset').length>=3),'and the brush library in collections');
 await p.keyboard.press('Escape');await p.waitForTimeout(200);ok(!(await open()),'Escape closes it');
 await p.mouse.click(cx,cy,{button:'right'});await p.waitForTimeout(300);
 // search and pick
 await p.fill('#bpSearch','pen');await p.waitForTimeout(300);
 const n=await p.evaluate(()=>document.querySelectorAll('#brushPop .bptile').length);ok(n>=1,'searching finds brushes ('+n+')');
 const name=await p.evaluate(()=>document.querySelector('#brushPop .bptile').getAttribute('aria-label'));
 await p.click('#brushPop .bptile >> nth=0');await p.waitForTimeout(300);
 const on=await p.evaluate(()=>{const b=document.querySelector('#libBody button.on');return b&&b.getAttribute('aria-label');});ok(!(await open())&&on===name,'clicking a brush picks it and closes the picker ('+name+' / '+on+')');
 // size slider
 await p.mouse.click(cx,cy,{button:'right'});await p.waitForTimeout(300);
 await p.evaluate(()=>{const e=document.getElementById('rcSize');e.value=700;e.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(200);
 ok(await p.evaluate(()=>__gs.brush.size)>60,'the size slider changes the brush ('+await p.evaluate(()=>__gs.brush.size)+')');
 // textures as tips
 await p.click('#bpTab_textures');await p.waitForTimeout(500);
 ok(await p.evaluate(()=>document.querySelectorAll('#brushPop .bptx .bptile').length>10),'the Textures tab lists the textures');
 await p.click('#brushPop .bptx .bptile >> nth=0');await p.waitForTimeout(1200);
 ok(!(await open())&&await p.evaluate(()=>!!__gs.brush.tip),'clicking a texture uses it as the brush tip ('+await p.evaluate(()=>__gs.brush.tip&&__gs.brush.tip.name)+')');
 // not for other tools, with Ctrl, or when turned off
 await p.keyboard.press('i');await p.mouse.click(cx,cy,{button:'right'});await p.waitForTimeout(300);ok(!(await open()),'not with the eyedropper');
 await p.keyboard.press('b');await p.keyboard.down('Control');await p.mouse.click(cx,cy,{button:'right'});await p.keyboard.up('Control');await p.waitForTimeout(300);ok(!(await open()),'not with Ctrl held');
 await p.evaluate(()=>{__gs.prefs.rcBrush=false;});await p.mouse.click(cx,cy,{button:'right'});await p.waitForTimeout(300);ok(!(await open()),'not when turned off in Preferences');await p.evaluate(()=>{delete __gs.prefs.rcBrush;});
 // 3D
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1800);
 const hb=await p.locator('#v3Hit').boundingBox(),mx=hb.x+hb.width/2,my=hb.y+hb.height/2;
 await p.mouse.move(mx,my);await p.mouse.down({button:'right'});await p.mouse.move(mx+80,my+30,{steps:6});await p.mouse.up({button:'right'});await p.waitForTimeout(400);
 ok(!(await open()),'3D: a right-drag (moving the view) does not open it');
 await p.mouse.click(mx,my,{button:'right'});await p.waitForTimeout(400);
 ok(await open(),'3D: a right-click on the model opens it');
 await p.keyboard.press('Escape');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
