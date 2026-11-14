/* 0.97.24: New material and Reset to default in the material editor */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1400,height:950}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForFunction(()=>window.__gs);
 await p.evaluate(()=>{__gs.closeWelcome();__gs.setMode('p3d');});await p.waitForTimeout(2500);
 await p.evaluate(()=>{const g=__gs;g.cmdNewFillLayer();const L=g.doc.active;L.fill.maps.base.c=[.9,.1,.1];L.fill.maps.rough.on=true;L.fill.maps.rough.v=.9;L.fill.maps.metal.on=true;L.fill.maps.metal.v=1;g.fillRender(L);g.selectOnly(L);g.showPanel('matEd');g.renderMatEd(true);});
 await p.waitForTimeout(800);
 const n0=await p.evaluate(()=>__gs.allLayers().length);
 ok(await p.locator('#matEdNewHere').count()===1&&await p.locator('#matEdReset').count()===1,'the editor has New material and Reset to default');
 await p.locator('#matEdReset').click();await p.waitForTimeout(800);
 const r=await p.evaluate(()=>{const f=__gs.doc.active.fill;return {c:f.maps.base.c,metal:f.maps.metal.on,rough:f.maps.rough.on};});
 ok(Math.abs(r.c[0]-.5)<.01&&!r.metal&&!r.rough,'Reset to default: grey base, other channels off '+JSON.stringify(r));
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(500);
 ok(await p.evaluate(()=>Math.abs(__gs.doc.active.fill.maps.base.c[0]-.9)<.01),'one undo brings the old material back');
 await p.locator('#matEdNewHere').click();await p.waitForTimeout(800);
 ok(await p.evaluate(()=>__gs.allLayers().length)===n0+1,'New material adds a layer');
 ok(errs.length===0,'no page errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
