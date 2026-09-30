/* 0.28: Decals: click a decal, click the model; a movable sticker layer with colour, height, roughness, metal */
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
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'dec',false,'pbr'));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>__gs.showPanel('decals'));await W(400);
 ok(await p.evaluate(()=>document.querySelectorAll('#dcGrid .dctile').length)===12,'the Decals panel lists 12 decals');
 await p.locator('#dcSec').screenshot({path:OUT+'dec-panel.png'});
 await p.evaluate(()=>__gs.showPanel('decals'));await W(400);
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 const tb=await p.locator('#dc_bolt').boundingBox();
 const n0=await p.evaluate(()=>__gs.allLayers().length);
 const info=()=>p.evaluate(()=>{const L=__gs.doc.active;return {n:__gs.allLayers().length,name:L.name,vis:L.visible!==false,t:L.fill&&L.fill.xf?L.fill.xf.t.map(v=>Math.round(v*1000)/1000):null};});
 await p.mouse.move(tb.x+20,tb.y+20);await p.mouse.down();
 for(let i=1;i<=6;i++){await p.mouse.move(tb.x+20+(cx-tb.x-20)*i/6,tb.y+20+(cy-tb.y-20)*i/6);await p.waitForTimeout(90);}
 await W(700);const a=await info();
 ok(a.n===n0+1&&a.name==='Hex bolt'&&a.vis&&a.t,'dragging onto the model shows the decal on the surface '+JSON.stringify(a));
 await p.mouse.move(cx+70,cy-40,{steps:5});await W(800);const b2=await info();
 ok(b2.n===n0+1&&JSON.stringify(b2.t)!==JSON.stringify(a.t),'it follows the cursor over the model '+JSON.stringify(b2.t));
 await p.evaluate(()=>{__gs.v3.dirty=true;});await W(900);await p.locator('#work').screenshot({path:OUT+'dec32-drag.png'});
 await p.mouse.up();await W(500);const c=await info();
 ok(c.n===n0+1&&c.vis,'letting go places it');
 ok(await p.evaluate(()=>!__gs.dc.armed),'a drag does not leave a decal armed');
 // dropped off the model: taken away again
 await p.mouse.move(tb.x+20,tb.y+20);await p.mouse.down();
 for(let i=1;i<=5;i++){await p.mouse.move(tb.x+20+(cx-tb.x-20)*i/5,tb.y+20+(cy-tb.y-20)*i/5);await p.waitForTimeout(90);}
 await W(600);ok((await info()).n===n0+2,'a second drag shows a second decal');
 await p.mouse.move(tb.x+30,tb.y+300,{steps:4});await W(500);await p.mouse.up();await W(700);
 ok((await info()).n===n0+1,'letting go off the model takes the preview away again');
 for(const m of ['planar','tri','uv']){await p.click('#dc_rivet');await W(150);await p.keyboard.press('Escape');await p.click('#dc_rivet');await W(100);
  const before=await p.evaluate(()=>__gs.allLayers().length);await p.click('#dcAdd_'+m);await W(1200);
  const r=await p.evaluate(()=>{const L=__gs.doc.active;return {n:__gs.allLayers().length,proj:L.fill&&L.fill.proj,decal:!!(L.fill&&L.fill.decal)};});
  ok(r.n===before+1&&r.proj===m&&r.decal,'Add as a layer ('+m+') makes a decal layer '+JSON.stringify(r));await p.keyboard.press('Escape');}
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
