const {chromium}=require('playwright');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1600,height:950}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>{localStorage.removeItem('gs.optExport');__gs.newDoc(128,128,8,[.5,.5,.5],'ap',false,'pbr');});await p.waitForTimeout(500);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(2500);
 const where=()=>p.evaluate(()=>{const e=document.getElementById('optExport');if(!e)return null;const r=e.getBoundingClientRect();return {parent:e.parentNode.id||e.parentNode.className,x:Math.round(r.x),y:Math.round(r.y)};});
 ok(!(await p.evaluate(()=>document.getElementById('optBar').textContent)).includes('null'),'no stray "null" text in the options bar');
 let w0=await where();ok(w0&&/optBar|optbar/.test(w0.parent),'starts in the options bar '+JSON.stringify(w0));
 const b0=await p.locator('#optExport').boundingBox();const wv=await p.locator('#work').boundingBox();
 await p.mouse.move(b0.x+10,b0.y+10);await p.mouse.down();await p.mouse.move(wv.x+wv.width*.7,wv.y+wv.height*.6,{steps:10});await p.mouse.up();await p.waitForTimeout(500);
 const w1=await where();ok(w1&&w1.parent==='work','dropped on the viewport it docks there '+JSON.stringify(w1));
 ok(await p.evaluate(()=>document.getElementById('modal').hidden),'a drag does not open the export window');
 await p.evaluate(()=>{__gs.buildOptBar&&__gs.buildOptBar();});await p.waitForTimeout(300);const w1b=await where();ok(w1b&&Math.abs(w1b.x-w1.x)<3&&w1b.parent==='work','it stays there when the bar is rebuilt');
 /* onto a shelf bar */
 await p.evaluate(()=>{__gs.showPanel('mats');});await p.waitForTimeout(800);
 const bar=await p.locator('#shbar_mats').boundingBox();ok(!!bar,'the Materials shelf has a bar');
 const b1=await p.locator('#optExport').boundingBox();
 await p.mouse.move(b1.x+8,b1.y+8);await p.mouse.down();await p.mouse.move(bar.x+bar.width*.6,bar.y+bar.height/2,{steps:10});await p.mouse.up();await p.waitForTimeout(600);
 const w2=await where();ok(w2&&w2.parent==='shbar_mats','dropped on a shelf bar it becomes a button there '+JSON.stringify(w2));
 await p.mouse.click(w2.x+10,w2.y+8);await p.waitForTimeout(700);ok(!(await p.evaluate(()=>document.getElementById('modal').hidden)),'a click in the shelf opens Export');
 await p.evaluate(()=>{document.getElementById('dlgCancel')&&document.getElementById('dlgCancel').click();});await p.waitForTimeout(300);
 /* put back */
 await p.locator('#optExport').click({button:'right'});await p.waitForTimeout(600);const w3=await where();ok(w3&&/optBar|optbar/.test(w3.parent),'right-click puts it back in the options bar '+JSON.stringify(w3));
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);})();
