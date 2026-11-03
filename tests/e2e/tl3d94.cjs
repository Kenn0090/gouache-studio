/* 0.94: the timelapse in 3D Paint records the 3D view, and camera turns too */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}}),p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();const O='/home/user/gouache-studio/tests/e2e/';
  if(u.includes('pako'))return r.fulfill({path:O+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:O+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:O+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  return u.startsWith('file:')?r.continue():r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>{indexedDB.deleteDatabase('gouache-timelapse');});
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(2500);
 await p.evaluate(()=>{__gs.tlr.cfg.unit='s';__gs.tlr.cfg.freq=60;__gs.tlr.cfg.comp=40;__gs.tlr.cfg.size=480;});
 await p.evaluate(()=>__gs.tlStart());await p.waitForTimeout(1500);
 let c1=await p.evaluate(()=>({on:__gs.tlr.on,count:__gs.tlr.count,sz:__gs.tlr.sz3}));
 ok(c1.on&&c1.count>=1&&c1.sz&&c1.sz.w>=2,'recording starts in 3D Paint and takes a picture of the 3D view '+JSON.stringify(c1));
 await p.waitForTimeout(1500);
 const still=await p.evaluate(()=>__gs.tlr.count);await p.waitForTimeout(1500);
 ok(await p.evaluate(()=>__gs.tlr.count)===still,'nothing changed, so no new picture ('+still+')');
 await p.evaluate(()=>{__gs.v3.cam.yaw+=1.2;});await p.waitForTimeout(2500);
 const turned=await p.evaluate(()=>__gs.tlr.count);
 ok(turned>still,'turning the camera adds a picture ('+turned+')');
 await p.evaluate(()=>__gs.tlStop());await p.waitForTimeout(500);
 ok(errs.length===0,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
