/* 0.23: Mesh maps from a material (curvature, AO, edges, roughness, metallic from its height) and the Converted source. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text())&&!/GPU stall due to ReadPixels/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);
 await p.evaluate(()=>{__gs.setMode('p3d');});await W(4000);
 const ok1=await p.evaluate(async()=>{const g=__gs;const r=await g.p3Resize(512);return r;});await W(1500);
 const txt=await p.evaluate(()=>__gs.rrText());console.log(txt.slice(0,900));
 ok(ok1===true,'the resize worked');
 ok(/RESIZE REPORT/.test(txt)&&/asked for 512 px/.test(txt)&&/DONE/.test(txt),'the report lists the resize');
 ok(/how the \d+ pictures were brought/.test(txt),'it says how each picture was brought to the new size');
 await p.evaluate(()=>{__gs.actions.resizeReport();});await W(500);
 ok(await p.evaluate(()=>!!document.getElementById('rrText')&&document.getElementById('rrText').value.includes('RESIZE REPORT')),'Help › Resize report… opens it');
 await p.evaluate(()=>{const c=document.getElementById('rrHide');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));});await W(300);
 ok(await p.evaluate(()=>!/ · Paint ·|Base material/.test(document.getElementById('rrText').value)),'Hide layer names replaces the names');
 ok(!errs.length,'no errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
