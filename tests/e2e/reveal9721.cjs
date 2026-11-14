/* 0.97.21: right-click a shelf tile > Show in Explorer (desktop: saved into the Exports folder, then revealed) */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1500,height:950}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForFunction(()=>window.__gs);
 await p.evaluate(()=>{__gs.closeWelcome();__gs.setMode('p3d');});await p.waitForTimeout(3000);
 /* pretend to be the desktop app */
 await p.evaluate(()=>{const P=__gs.platform;window.__rev={w:[],r:[],d:[]};P.isDesktop=true;P.cacheInfo=async()=>({dir:'C:/cache'});
  P.invoke=async(c,a)=>{if(c==='make_dir')__rev.d.push(a.path);if(c==='reveal_path')__rev.r.push(a.path);};P.writeFile=async(pa,by)=>{__rev.w.push([pa,by.length]);};});
 for(const [panel,sel,label] of [['smats','#smGrid .mattile','Smart material'],['shalpha','.shat','Alpha'],['envs','.envtile','Environment'],['mats','#matLib .mattile','Library material']]){
  await p.evaluate(id=>__gs.showPanel(id),panel);await p.waitForTimeout(1200);
  const t=p.locator('.dkshelf '+sel).first();
  if(!(await t.count())){ok(false,label+': a tile to click');continue;}
  await t.scrollIntoViewIfNeeded();await t.click({button:'right'});await p.waitForTimeout(300);
  const item=p.locator('#menuPop').getByText('Show in Explorer');
  ok(await item.count()===1,label+': right-click offers Show in Explorer');
  if(await item.count()){await item.click();await p.waitForTimeout(2500);}
 }
 const r=await p.evaluate(()=>__rev);console.log(JSON.stringify(r).slice(0,600));
 ok(r.w.length>=3,'files were written to the Exports folder ('+r.w.length+')');
 ok(r.r.length===r.w.length&&r.r.every(x=>x.startsWith('C:/cache/Exports/')),'each file was shown in Explorer');
 ok(errs.length===0,'no page errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
