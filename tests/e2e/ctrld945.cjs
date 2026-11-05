/* 0.94.5: Ctrl+D duplicates the layer in 3D Paint (Kenn); in Paint it still deselects */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(2500);
 const n0=await p.evaluate(()=>__gs.allLayers().length);
 await p.mouse.move(400,400);await p.keyboard.press('Control+d');await p.waitForTimeout(400);
 ok(await p.evaluate(n=>__gs.allLayers().length===n+1,n0),'Ctrl+D adds a copy of the layer in 3D Paint');
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(200);
 ok(await p.evaluate(n=>__gs.allLayers().length===n,n0),'…and undo takes it away');
 await p.click('#modeTabs [data-mode=paint]');await p.waitForTimeout(1500);
 const n1=await p.evaluate(()=>__gs.allLayers().length);await p.keyboard.press('Control+d');await p.waitForTimeout(300);
 ok(await p.evaluate(n=>__gs.allLayers().length===n,n1),'in Paint Ctrl+D does not duplicate (it deselects)');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
