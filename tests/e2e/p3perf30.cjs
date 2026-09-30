/* 0.21 3D Paint tab: its own canvas, layouts, painting and navigating, Alt-hover colour pick, shade arrows. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{__gs.perf.on=true;const L=__gs.layerByName('Base material');__gs.doc.active=L;});await W(200);
 await p.evaluate(()=>{__gs.act('addMaskHide');});await W(500);
 await p.evaluate(()=>__gs.showPanel('color'));await setFG('#ffffff');await p.evaluate(()=>{document.activeElement.blur();Object.assign(__gs.brush,{size:40,hardness:1,opacity:1,flow:1,smoothing:0,pSize:false,tip:null});});
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 console.log(JSON.stringify(await p.evaluate(()=>({active:__gs.doc.active.name,mask:!!__gs.doc.active.mask,edit:__gs.doc.active.editMask,w:__gs.doc.w}))));
 const stroke=async label=>{await p.evaluate(()=>{const R=__gs.runStat;R.n=0;R.px=0;R.by={};});
  await p.mouse.move(cx-90,cy-20);await p.mouse.down();for(let i=0;i<30;i++){await p.mouse.move(cx-90+i*6,cy-20+Math.sin(i/3)*30);await p.waitForTimeout(8);}await p.mouse.up();await W(600);
  const r=await p.evaluate(()=>{const R=__gs.runStat;return {Mpx:Math.round(R.px/1e4)/100,by:Object.entries(R.by).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>k+' '+Math.round(v/1e4)/100)};});
  console.log(label,JSON.stringify(r));return r;};
 const best=await stroke('Best');
 await p.evaluate(()=>{__gs.prefs.paintSpeed='fast';});const fast=await stroke('Fast');
 ok(fast.Mpx<best.Mpx,'Fast asks the graphics chip for less per stroke ('+best.Mpx+' -> '+fast.Mpx+' Mpx)');
 await p.evaluate(()=>{__gs.prefs.paintScale=0.5;});
 const sizes=await p.evaluate(async()=>{const v=__gs.v3||window.v3;const a=v.fbo.w;return a;});
 await p.mouse.move(cx-90,cy-20);await p.mouse.down();let mid=0;for(let i=0;i<12;i++){await p.mouse.move(cx-90+i*6,cy-20+i*2);await p.waitForTimeout(40);}
 mid=await p.evaluate(()=>(__gs.v3||window.v3).fbo.w);await p.mouse.up();await W(700);
 const after=await p.evaluate(()=>(__gs.v3||window.v3).fbo.w);
 ok(mid<sizes*0.6&&after===sizes,'Half size: model drawn at half while painting ('+sizes+' -> '+mid+'), full again after ('+after+')');
 await p.evaluate(()=>{__gs.prefs.paintScale=0.75;});
 await p.mouse.move(cx-90,cy-20);await p.mouse.down();for(let i=0;i<12;i++){await p.mouse.move(cx-90+i*6,cy-20+i*2);await p.waitForTimeout(40);}
 const mid3=await p.evaluate(()=>(__gs.v3||window.v3).fbo.w);await p.mouse.up();await W(500);
 ok(mid3>sizes*0.7&&mid3<sizes*0.8,'Three quarters: model drawn at 3/4 while painting ('+mid3+' of '+sizes+')');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,200));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})();
