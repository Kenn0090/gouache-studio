/* 0.97.23: the 3D view's Reset view button */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1400,height:950}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForFunction(()=>window.__gs);
 await p.evaluate(()=>{__gs.closeWelcome();__gs.setMode('p3d');});await p.waitForTimeout(3000);
 const shot=()=>p.evaluate(()=>{__gs.composite();__gs.v3Refresh();const T=__gs.v3.tex;return Object.fromEntries(['base','rough','nfinal'].filter(k=>T[k]).map(k=>{const d=__gs.captureRegionNow(T[k],20,20,1,1).data;return [k,[d[0],d[1],d[2],d[3]]];}));});
 const before=await shot();
 ok(!!before.base,'the 3D view has its maps ('+JSON.stringify(before)+')');
 await p.locator('#v3More').click();await p.waitForTimeout(300);
 ok(await p.locator('#v3Reset').count()===1,'there is a Reset view button');
 await p.locator('#v3Reset').click();await p.waitForTimeout(7000);
 const after=await shot();
 ok(JSON.stringify(after)===JSON.stringify(before),'the maps are built again and match ('+JSON.stringify(after)+')');
 ok(await p.evaluate(()=>__gs.gl.getError())===0,'no GL error');
 ok(errs.length===0,'no page errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
