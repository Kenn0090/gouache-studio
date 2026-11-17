/* start-up in the section picked with "Always start in": waits for the window to settle, then switches */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1300,height:800}})).newPage();
 await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('gs.prefs',JSON.stringify({startMode:'p3d',setupDone:true,noWelcome:true}));});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html'));
 await p.waitForTimeout(1500);
 
 await p.waitForTimeout(6000);
 ok(await p.evaluate(()=>document.body.classList.contains('m-p3d')),'it switched to 3D Paint after the window settled');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
