const {chromium}=require('playwright');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 ok(await p.evaluate(()=>__gs.bk.showCage===false&&__gs.bakeCageAlpha()===0),'cage is off by default');
 await p.evaluate(()=>__gs.bakeCageFlash());
 ok(await p.evaluate(()=>__gs.bakeCageAlpha())===1,'slider shows the cage');
 await p.waitForTimeout(1250);const mid=await p.evaluate(()=>__gs.bakeCageAlpha());ok(mid<1&&mid>0,'then it fades ('+mid.toFixed(2)+')');
 await p.waitForTimeout(700);ok(await p.evaluate(()=>__gs.bakeCageAlpha())===0,'and is gone');
 await p.evaluate(()=>{__gs.bk.showCage=true;});ok(await p.evaluate(()=>__gs.bakeCageAlpha())===1,'the switch keeps it on');
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
