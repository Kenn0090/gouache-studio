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
 await p.evaluate(()=>{__gs.setMode('p3d');});await W(9000);
 await p.evaluate(()=>{__gs.v3s().rigLive=true;__gs.lightAutoRig();const R=__gs.lightRig();R.sel=R.lights.find(l=>l.type==='sun').id;__gs.lgzSetFree(true);__gs.v3.cam.dist*=3.5;__gs.v3.dirty=true;});await W(800);
 await p.evaluate(()=>{__gs.showPanel('v3lights');});await W(1500);
 const info=await p.evaluate(()=>{const secs=[...document.querySelectorAll('.lsec>summary')].map(x=>x.textContent);const sel=__gs.lightRig().sel;return {secs,sel};});
 console.log(JSON.stringify(info));
 ok(info.secs.length>=3,'the light has Marmoset-style sections');
 const bb=await p.evaluate(()=>{const e=document.querySelector('#lsec_light');if(!e)return null;const r=e.closest('.dkfloat,.dkgroup,#dock,body').getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
 await p.evaluate(()=>{document.querySelector('#lsec_transform').scrollIntoView({block:'start'});});await W(400);await p.screenshot({path:'/tmp/lp.png',clip:{x:1140,y:790,width:300,height:210},timeout:120000});
 await p.evaluate(()=>{document.querySelector('#lsec_light').scrollIntoView({block:'start'});});await W(400);await p.screenshot({path:'/tmp/lp2.png',clip:{x:1140,y:790,width:300,height:210},timeout:120000});
 await b.close();process.exit(fails?1:0);})();
