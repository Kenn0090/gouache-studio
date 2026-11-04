/* 0.95: Physical size: a projection's size in real units, from the model's file units */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.setMode('p3d',true);});await p.waitForTimeout(1500);
 const build=()=>p.evaluate(()=>{window.__xf=window.__xf||Object.assign(__gs.pxfDef(),{s:[1,1,1]});document.getElementById('unitTest')?.remove();const box=document.createElement('div');box.id='unitTest';document.body.append(box);
   box.append(__gs.pxfFields(()=>window.__xf,fn=>fn(window.__xf),'planar',null,true));return {unit:!!document.getElementById('pxf_unit'),p0:!!document.getElementById('pxf_p0')};});
 let r=await build();ok(r.unit&&!r.p0,'the size panel has a Real size choice, off to begin with');
 await p.evaluate(()=>localStorage.setItem('gs.pxfUnit','cm'));r=await build();ok(r.p0,'with units on, the size shows in real units');
 await p.evaluate(()=>{const i=document.getElementById('pxf_p0');i.value='5';i.dispatchEvent(new Event('change'));});await p.waitForTimeout(300);
 r=await build();const v=await p.evaluate(()=>parseFloat(document.getElementById('pxf_p0').value));
 ok(Math.abs(v-5)<.02,'typing 5 cm gives a size of 5 cm back ('+v+')');
 await p.evaluate(()=>localStorage.setItem('gs.pxfUnit','in'));r=await build();const vi=await p.evaluate(()=>parseFloat(document.getElementById('pxf_p0').value));
 ok(Math.abs(vi-5/2.54)<.02,'the same size in inches is 5 / 2.54 ('+vi+')');
 ok(errs.length===0,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
