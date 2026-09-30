/* 0.28.1: a material covers ("Hide the bumps below", on by default; untick to add bumps instead) the height and normal detail of the layers under it */
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
 await p.addInitScript(()=>{try{localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(64,64,8,[1,1,1],'cover',false,'pbr'));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 /* the height where the model shows: a bumpy material under, a flat one on top */
 const h=()=>p.evaluate(()=>{const t=__gs.compositeMap('height'),g=__gs.gl;g.bindFramebuffer(g.FRAMEBUFFER,t.fbo);const f=new Float32Array(4);g.readPixels(20,20,1,1,g.RGBA,g.FLOAT,f);g.bindFramebuffer(g.FRAMEBUFFER,null);__gs.release(t);return +f[0].toFixed(3);});
 const h0=await h();
 await p.evaluate(()=>{__gs.cmdNewFillLayer({name:'Bumpy',maps:{height:{v:.9}}});});await W(400);const h1=await h();
 await p.evaluate(()=>{__gs.cmdNewFillLayer({name:'Smooth',maps:{height:{v:.5},base:{c:[.8,.7,.3]}}});});await W(400);const h2=await h();
 ok(Math.abs(h1-h0)>.2&&Math.abs(h2-.5)<.02,'by default a flat material on top hides the bumps below ('+[h0,h1,h2]+')');
 await p.evaluate(()=>__gs.showPanel('matEd'));await W(300);
 ok(await p.locator('#fl_cover').count()===1,'the Material panel has "Hide the bumps below"');
 ok(await p.locator('#fl_cover').isChecked(),'…and it is ticked');
 await p.click('#fl_cover');await W(900);const h3=await h();
 ok(Math.abs(h3-h1)<.02,'unticked, the bumps below add up again ('+h3+')');
 await p.click('#fl_cover');await W(900);
 /* also without a height of its own */
 await p.evaluate(()=>{const L=__gs.doc.active;L.fill.maps.height.on=false;__gs.fillRender(L);});await W(400);
 ok(Math.abs(await h()-.5)<.02,'…even when the material has no height channel');
 await W(900);await p.evaluate(()=>__gs.act('undo'));await W(400);
 ok(await p.evaluate(()=>{const L=__gs.layerByName('Smooth');return !!L&&L.fill.coverH===false;}),'undo takes back the last tick (the layer stays)');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
