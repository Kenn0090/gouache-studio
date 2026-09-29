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
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 const n0=await p.evaluate(()=>__gs.allLayers().length);
 await p.click('#dc_bolt');await W(200);ok(await p.evaluate(()=>__gs.dc.armed&&__gs.dc.armed.id==='bolt'),'clicking a decal arms it');
 await p.mouse.click(cx-60,cy-40);await W(900);
 const L=await p.evaluate(()=>{const L=__gs.doc.active;return {name:L.name,decal:!!(L.fill&&L.fill.decal),proj:L.fill&&L.fill.proj,ch:Object.keys(L.fill.maps).filter(k=>L.fill.maps[k].on).join(','),t:L.fill.xf&&L.fill.xf.t.map(v=>+v.toFixed(2))};});
 ok(L.name==='Hex bolt'&&L.decal&&L.proj==='planar'&&/base/.test(L.ch)&&/height/.test(L.ch)&&/rough/.test(L.ch)&&/metal/.test(L.ch),'clicking the model places it as a movable decal layer '+JSON.stringify(L));
 await p.mouse.click(cx+60,cy-40);await W(900);ok(await p.evaluate(()=>__gs.allLayers().length)===n0+2,'it stays armed: a second click places another');
 await p.keyboard.press('Escape');await W(100);ok(await p.evaluate(()=>!__gs.dc.armed),'Esc stops placing');
 for(const [id,dx,dy] of [['bullet',-40,60],['warning',80,70],['vent',0,-120]]){await p.click('#dc_'+id);await W(150);await p.mouse.click(cx+dx,cy+dy);await W(900);await p.keyboard.press('Escape');}
 await p.evaluate(()=>{__gs.v3.dirty=true;});await W(1500);await p.locator('#work').screenshot({path:OUT+'dec-model.png'});
 await p.evaluate(()=>__gs.act('undo'));await W(300);ok(await p.evaluate(()=>!__gs.allLayers().some(l=>l.name==='Vent grille')),'undo removes the last decal');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
