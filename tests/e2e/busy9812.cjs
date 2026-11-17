/* the busy chip shows while shaders compile and goes away afterwards */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1200,height:800}})).newPage();
 await p.route('**/*',r=>{if(r.request().url().startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__seen=[];new MutationObserver(()=>{const c=document.getElementById('busyChip');if(c&&!c.hidden)window.__seen.push(c.textContent);}).observe(document,{subtree:true,childList:true,attributes:true,characterData:true});});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForTimeout(6000);
 const r=await p.evaluate(()=>({seen:window.__seen.filter((v,i,a)=>a.indexOf(v)===i).slice(0,3),hidden:document.getElementById('busyChip')?document.getElementById('busyChip').hidden:'none'}));
 console.log(JSON.stringify(r));
 ok(r.seen.some(t=>/Compiling shaders/.test(t)),'the chip showed "Compiling shaders…"');
 ok(r.hidden===true,'and it is gone when the work is done');
 ok(!errs.length,'no errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
