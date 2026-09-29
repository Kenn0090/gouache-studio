/* 0.22 (Substance-like round): texture set delete, Texturing workspace, shades past the ends, stencil invert (X), tip outline cursor. */
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
 /* 0.27 fixes Kenn reported */
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 await p.evaluate(()=>__gs.showPanel('layers'));await W(300);
 await p.locator('#layerList .lrow',{hasText:'Base material'}).first().click({position:{x:120,y:12}});await W(500);
 await p.evaluate(()=>__gs.showPanel('matEd'));await W(1200);
 ok(await p.locator('#fl_v_rough').isVisible(),'picking a material layer shows it in Properties');
 /* 1. material sliders slide back and forth (the tab bar's unsaved check no longer rebuilds the panel mid-drag) */
 for(const id of ['#fl_v_rough','#fl_v_metal']){const r=p.locator(id);await r.scrollIntoViewIfNeeded();const bb=await r.boundingBox();
   await p.evaluate(i=>{window.__el=document.querySelector(i);},id);const y=bb.y+bb.height/2;await p.mouse.move(bb.x+bb.width*.5,y);await p.mouse.down();const vs=[];
   for(const f of [1,0,.8]){await p.mouse.move(bb.x+bb.width*f,y,{steps:5});await W(900);vs.push(await p.evaluate(i=>(document.querySelector(i)===window.__el)+':'+document.querySelector(i).value,id));}
   await p.mouse.up();await W(300);
   ok(bb.width>120&&vs[0]==='true:1'&&vs[1]==='true:0'&&vs[2].startsWith('true:0.'),id+' drags both ways ('+Math.round(bb.width)+' px wide; '+vs.join(' ')+')');}
 /* 2. the Mesh map drop-down stays open and picks */
 await p.evaluate(()=>{const g=__gs;const mk=c=>{const t=g.makeTarget(g.doc.w,g.doc.h,8,true);g.clearTarget(t,c);return t;};g.doc.meshMaps={ao:mk([.3,.3,.3,1]),curv:mk([.7,.7,.7,1])};});
 await p.locator('#matEdBody .fillrow',{has:p.locator('#fl_v_rough')}).locator('.segb',{hasText:'Mesh map'}).click();await W(500);
 await p.evaluate(()=>{window.__s=document.querySelector('#fl_mm_rough');});await W(1600);
 const same=await p.evaluate(()=>document.querySelector('#fl_mm_rough')===window.__s);
 await p.selectOption('#fl_mm_rough','curv');await W(500);
 ok(same&&await p.evaluate(()=>__gs.doc.active.fill.maps.rough.mm==='curv'),'the Mesh map list stays put and picks a map');
 /* 3. a new material has no mask; painting on it does nothing (0.28); the later checks give it a hide-all mask */
 const L=await p.evaluate(()=>{const L=__gs.cmdNewFillLayer({name:'Steel',maps:{base:{c:[.6,.6,.6]},metal:{v:1}}});return {mask:!!L.mask,name:L.name};});
 ok(!L.mask,'a material arrives without a mask');
 await p.evaluate(()=>__gs.setFG([1,1,1]));
 const box=await p.locator('#v3Hit').boundingBox();
 await p.mouse.move(box.x+box.width/2-20,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2+20,box.y+box.height/2,{steps:4});await p.mouse.up();await W(500);
 ok(await p.evaluate(()=>{const L=__gs.layerByName('Steel');return !L.mask&&__gs.hist.undo.slice(-1)[0].label!=='Paint';}),'painting on a material without a mask does nothing (0.28)');
 await p.evaluate(()=>{const L=__gs.layerByName('Steel');__gs.doc.active=L;__gs.act('addMaskHide');});await W(200);
 /* 4. baked normal: a mesh map, not a layer; it shades the model */
 const n0=await p.evaluate(()=>{const t=__gs.normalComp2(),d=__gs.readRGBA8(t);__gs.release(t);return [d[0],d[1],d[2]];});
 const r=await p.evaluate(()=>{const g=__gs,t=g.makeTarget(g.doc.w,g.doc.h,8,true);g.clearTarget(t,[.8,.5,.8,1]);const n=g.allLayers().length;g.p3ApplyBake({normal:t},['normal'],false);
   const o=g.normalComp2(),d=g.readRGBA8(o);g.release(o);return {added:g.allLayers().length-n,base:!!g.meshNormalBase(),px:[d[0],d[1],d[2]]};});
 ok(r.added===0&&r.base,'a sent normal bake adds no layer ('+r.added+') and becomes the mesh normal');
 ok(r.px[0]-n0[0]>40,'the painted normal sits on the baked one ('+n0+' → '+r.px+')');
 /* 5. every filter can go on a mask */
 await p.evaluate(()=>{const L=__gs.layerByName('Steel');L.editMask=true;__gs.renderLayers();});await W(200);
 await p.click('#lFxAdd');await W(200);await p.click('#menuPop .mi:has-text("All filters")');await W(150);await p.click('#menuPop .mi:has-text("Artistic")');await W(150);await p.click('#menuPop .mi:has-text("Oil paint")');await W(400);
 ok(await p.evaluate(()=>__gs.layerByName('Steel').mask.stack.some(r=>r.kind==='filter'&&r.fx==='oilPaint')),'Oil paint added to the mask from All filters');
 /* 6. filters from the right-click layer menu, on the layer and on its mask */
 await p.locator('#layerList .lrow',{hasText:'Steel'}).first().click({button:'right',position:{x:120,y:12}});await W(200);
 await p.click('#menuPop .mi:has-text("Filter this layer")');await W(250);await p.click('#menuPop .mi:has-text("Adjust")');await W(150);await p.click('#menuPop .mi:has-text("Invert")');await W(400);
 ok(await p.evaluate(()=>(__gs.layerByName('Steel').cfx||[]).some(r=>r.fx==='invert')),'right-click › Filter this layer adds a live filter to the layer');
 await p.locator('#layerList .lrow',{hasText:'Steel'}).first().click({button:'right',position:{x:120,y:12}});await W(200);
 await p.click('#menuPop .mi:has-text("Filter its mask")');await W(250);await p.locator('#menuPop .mi',{hasText:/^Blur$|Gaussian blur/}).first().click();await W(400);
 ok(await p.evaluate(()=>__gs.layerByName('Steel').mask.stack.filter(r=>r.kind==='filter').length>=2),'right-click › Filter its mask adds a filter to the mask');
 /* 9. the environment in the Shader panel, and Shift+right-drag turns the sky */
 await p.evaluate(()=>__gs.showPanel('shading'));await W(300);
 ok(await p.locator('#shEnv').isVisible()&&await p.locator('#shEnvRot').count()===1,'the Shader panel has the Environment settings');
 const r0=await p.evaluate(()=>__gs.v3s?0:0)+await p.evaluate(()=>__gs.doc.v3d.envRot||0);
 const hb=await p.locator('#v3Hit').boundingBox();await p.keyboard.down('Shift');
 await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await p.mouse.down({button:'right'});await p.mouse.move(hb.x+hb.width/2+80,hb.y+hb.height/2,{steps:5});await p.mouse.up({button:'right'});await p.keyboard.up('Shift');await W(200);
 const r1=await p.evaluate(()=>__gs.doc.v3d.envRot||0),sl=+(await p.locator('#shEnvRot').inputValue());
 ok(Math.abs(r1-r0-40)<3&&Math.abs(sl-r1)<1.01,'Shift + right-drag turns the sky ('+r0+' → '+r1+'°, slider '+sl+')');
 await p.screenshot({path:OUT+'fix27-shader.png'});
 /* 10. Paint › Send layer to 3D Paint: a live sticker projected from the view */
 await p.click('#modeTabs [data-mode=paint]');await W(800);
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();__gs.newDoc(160,160,8,null,'F',false);});await W(400);
 {const q=await p.evaluate(()=>[__gs.toScreen(50,30),__gs.toScreen(110,130)]);await p.evaluate(()=>__gs.setFG([1,0,0]));await p.keyboard.press('m');
  await p.mouse.move(q[0][0],q[0][1]);await p.mouse.down();await p.mouse.move(q[1][0],q[1][1],{steps:3});await p.mouse.up();await W(100);
  await p.keyboard.press('Alt+Backspace');await W(200);await p.keyboard.press('Control+d');await W(200);}
 await p.evaluate(()=>__gs.sendToP3(__gs.doc.active));await W(2500);
 const stk=await p.evaluate(()=>{const L=__gs.doc.active,t=__gs.mapT(L,'base'),d=__gs.captureRegionNow(t,0,0,t.w,t.h).data;let red=0,other=0,cy=0;for(let i=0;i<d.length;i+=4){if(d[i+3]>200&&d[i]>200&&d[i+1]<60){red++;cy+=Math.floor(i/4/t.w);}else if(d[i+3]>20)other++;}
   return {mode:__gs.mode,decal:!!(L.fill&&L.fill.decal),proj:L.fill&&L.fill.proj,mask:!!L.mask,red,other,cy:cy/Math.max(1,red)};});
 ok(stk.mode==='p3d'&&stk.decal&&stk.proj==='planar'&&!stk.mask&&stk.red>150&&stk.other<stk.red*.2,'a sent layer lands on the model as a see-through sticker '+JSON.stringify(stk));
 await p.evaluate(()=>{const L=__gs.doc.active;L.fill.xf.t[1]+=.4;__gs.fillRender(L);});await W(300);
 const moved=await p.evaluate(()=>{const L=__gs.doc.active,t=__gs.mapT(L,'base'),d=__gs.captureRegionNow(t,0,0,t.w,t.h).data;let red=0,cy=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>200&&d[i]>200&&d[i+1]<60){red++;cy+=Math.floor(i/4/t.w);}return {red,cy:cy/Math.max(1,red)};});
 ok(moved.red>50&&Math.abs(moved.cy-stk.cy)>3,'moving it changes where it lands ('+stk.cy.toFixed(1)+' → '+moved.cy.toFixed(1)+')');
 /* 7. New document › Start in: a new 3D Paint project at the chosen size */
 await p.evaluate(()=>__gs.act('new'));await W(300);
 ok(await p.locator('#dStart').isVisible(),'New document has a Start in choice');
 await p.locator('#dStart .chip',{hasText:'3D Paint'}).click();await p.fill('#dW','128');await W(100);
 await p.click('#dlgOk');await W(600);
 if(await p.locator('#dlgOk',{hasText:'Start new'}).isVisible())await p.click('#dlgOk');await W(1500);
 const np=await p.evaluate(()=>({mode:__gs.mode,w:__gs.doc.w,names:__gs.allLayers().map(L=>L.name)}));
 ok(np.mode==='p3d'&&np.w===128&&!np.names.includes('Steel')&&np.names.includes('Base material'),'Start in 3D Paint makes a fresh project at 128 '+JSON.stringify(np));
 await p.evaluate(()=>__gs.act('new'));await W(300);await p.locator('#dStart .chip',{hasText:'Paint'}).first().click();await p.fill('#dW','200');await p.fill('#dH','100');
 await p.click('#dlgOk');await W(1200);
 const pp=await p.evaluate(()=>({mode:__gs.mode,w:__gs.doc.w,h:__gs.doc.h}));ok(pp.mode==='paint'&&pp.w===200&&pp.h===100,'Start in Paint opens a new Paint document '+JSON.stringify(pp));
 /* 8. layer styles on a masked material: they follow the mask, and the shadow spills outside it */
 const q=await p.evaluate(()=>[__gs.toScreen(40,20),__gs.toScreen(120,70)]);
 await p.keyboard.press('m');await p.mouse.move(q[0][0],q[0][1]);await p.mouse.down();await p.mouse.move(q[1][0],q[1][1],{steps:4});await p.mouse.up();await W(200);
 await p.evaluate(()=>{__gs.cmdNewFillLayer({name:'Blue',maps:{base:{c:[0,0,1]}}});});await W(400);await p.keyboard.press('Control+d');await W(200);
 const at=()=>p.evaluate(()=>{const t=__gs.compositeMap('base'),d=__gs.readRGBA8(t);__gs.release(t);let grey=0,blueish=0;for(let i=0;i<d.length;i+=4){if(d[i]<200&&Math.abs(d[i]-d[i+2])<25)grey++;if(d[i+2]>200&&d[i]>60&&d[i]<230)blueish++;}return {grey,blueish};});
 const s0=await at();
 await p.locator('#layerList .lrow',{hasText:'Blue'}).first().click({button:'right',position:{x:120,y:12}});await W(200);
 await p.click('#menuPop .mi:has-text("Drop shadow")');await W(500);await p.click('#dlgOk');await W(500);
 const s1=await at();
 ok(s1.grey>s0.grey+200&&s1.blueish<s1.grey/3,'drop shadow shows outside a masked material, grey not blue ('+JSON.stringify(s0)+' → '+JSON.stringify(s1)+')');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
