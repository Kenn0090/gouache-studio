/* 0.97.22: Preferences › Memory and disk › Data folder (desktop only; the desktop side is faked here) */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1400,height:950}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForFunction(()=>window.__gs);
 await p.evaluate(()=>{__gs.closeWelcome();const P=__gs.platform;window.__d={set:[],restart:0};P.isDesktop=true;
  P.cacheInfo=async()=>({dir:'C:/cache',custom:false,spill_bytes:0,tree_bytes:0,free_bytes:0,ram_total:0,ram_avail:0});
  P.dataInfo=async()=>({dir:'C:/Users/x/AppData',default_dir:'C:/Users/x/AppData',custom:false,size_bytes:5e9,free_bytes:2e10,pending:false,pending_to:'',error:''});
  P.pickFolder=async()=>'D:/Gouache';P.dataSet=async d=>{__d.set.push(d);return 'restart';};P.dataRestart=async()=>{__d.restart++;};});
 await p.evaluate(()=>__gs.dlgPrefs('speed'));await p.waitForTimeout(800);
 const tab=p.getByRole('tab',{name:/Memory/i});if(await tab.count())await tab.first().click();await p.waitForTimeout(600);
 ok(await p.locator('#pDataChange').count()===1,'Data folder section with Change…');
 ok((await p.locator('#pDataUse').textContent()).includes('In use'),'shows what is in use');
 await p.locator('#pDataChange').click();await p.waitForTimeout(500);
 await p.locator('#dlgOk').click();await p.waitForTimeout(600);
 let r=await p.evaluate(()=>__d);ok(r.set.length===1&&r.set[0]==='D:/Gouache','the chosen folder was sent ('+JSON.stringify(r.set)+')');
 await p.locator('#dlgOk').click();await p.waitForTimeout(500);
 r=await p.evaluate(()=>__d);ok(r.restart===1,'Gouache restarts to finish the move');
 ok(errs.length===0,'no page errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
