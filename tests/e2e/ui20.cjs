/* 0.20: Bake/Convert with their own canvas, Delete key, 3D button, right-click layer menu, dock width,
   the options bar's More row, and fill layers (value or image per map, painted through the mask, kept in files). */
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
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:8});await p.mouse.up();await W(150);};
 const setFG=async hx=>{await p.evaluate(()=>__gs.showPanel('color'));await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const comp=(k,pts)=>p.evaluate(([k,pts])=>{const t=__gs.compositeMap(k),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[k,pts]);
 const names=()=>p.evaluate(()=>__gs.allLayers().map(L=>L.name));
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'ui20',false));await W(300);
 await p.evaluate(()=>__gs.setDocMaps(['base','rough','metal','height','normal'],'maps'));await W();

 /* ---- Bake and Convert have their own canvas ---- */
 await p.click('#modeTabs [data-mode=convert]');await W(500);
 let s=await p.evaluate(()=>({mode:__gs.mode,own:__gs.tabDocs.key,layers:__gs.allLayers().length,paint:__gs.inPaint(()=>__gs.allLayers().map(L=>L.name))}));
 ok(s.mode==='convert'&&s.own==='convert'&&s.paint.includes('Background'),'Convert tab has its own canvas '+JSON.stringify(s));
 ok(await p.evaluate(()=>{const s=document.querySelector('section[aria-labelledby="hColor"]');return !s.offsetParent;}),'no colour panel in Convert');
 await p.click('#modeTabs [data-mode=paint]');await W(400);
 s=await p.evaluate(()=>({own:__gs.tabDocs.key,names:__gs.allLayers().map(L=>L.name),w:__gs.doc.w}));
 ok(!s.own&&s.names.includes('Background')&&s.w===300,'back in Paint the painting is unchanged '+JSON.stringify(s));

 /* ---- 3D button ---- */
 await p.click('#btn3d');await W(300);ok(await p.evaluate(()=>__gs.v3.on&&document.querySelector('#btn3d').getAttribute('aria-pressed')==='true'),'3D button shows the 3D view');
 await p.click('#btn3d');await W(300);ok(await p.evaluate(()=>!__gs.v3.on),'and hides it');

 /* ---- Delete key deletes the layer ---- */
 await p.click('#lAdd');await W();const n0=(await names()).length;
 await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.keyboard.press('Delete');await W();
 ok((await names()).length===n0-1,'Delete removes the selected layer');
 await p.keyboard.press('Control+z');await W();ok((await names()).length===n0,'undo brings it back');

 /* ---- layer icon buttons: one row, always in view at the bottom of the panel ---- */
 for(let i=0;i<6;i++)await p.click('#lAdd');await W();
 const lb=await p.evaluate(()=>{const bs=[...document.querySelectorAll('.lbtns.icons .lyb')].map(b=>b.getBoundingClientRect()),body=document.querySelector('#lAdd').closest('.dkbody').getBoundingClientRect();
   return {w:['section[aria-labelledby="hLayers"]','.lbtns.icons','#layerList','.dkbody'].map(s=>{const r=document.querySelector('#lAdd').closest('.dkbody').querySelector(s)||document.querySelector(s);const q=r.getBoundingClientRect();return s.slice(0,8)+':'+Math.round(q.left)+'-'+Math.round(q.right)+' sw'+r.scrollWidth;}),l0:Math.round(bs[0].left),b:[Math.round(bs[0].top),Math.round(bs[0].bottom),Math.round(bs[11].right)],body:[Math.round(body.top),Math.round(body.bottom),Math.round(body.right)],rows:new Set(bs.map(r=>Math.round(r.y))).size,inView:bs.every(r=>r.bottom<=body.bottom+1&&r.top>=body.top-1&&r.right<=body.right+1),n:bs.length};});
 ok(lb.rows===1&&lb.inView&&lb.n===12,'layer buttons: one row, in view '+JSON.stringify(lb));
 for(let i=0;i<6;i++)await p.keyboard.press('Control+z');await W();
 /* ---- right-click menu ---- */
 const row=p.locator('#layerList .lrow').first();
 await row.click({button:'right'});await W();
 const items=await p.evaluate(()=>[...document.querySelectorAll('#menuPop .mi')].map(b=>b.textContent));
 ok(items.some(t=>t.includes('Drop shadow'))&&items.some(t=>t.includes('Add mask'))&&items.some(t=>t.includes('Duplicate')),'right-click shows the layer menu '+items.length);
 await p.click('#menuPop .mi:has-text("Drop shadow")');await W(250);
 ok(await p.evaluate(()=>document.querySelector('#ls_drop')&&document.querySelector('#ls_drop').checked),'picking a style turns it on in the Layer style dialog');
 const fl=await p.evaluate(()=>{const m=document.querySelector('#modal');return {float:m.classList.contains('float'),bg:getComputedStyle(m).backgroundColor};});
 ok(fl.float&&/rgba\(0, 0, 0, 0\)|transparent/.test(fl.bg),'the dialog floats without darkening the window '+JSON.stringify(fl));
 const tb=await p.locator('#dlgTitle').boundingBox();await p.mouse.move(tb.x+30,tb.y+8);await p.mouse.down();await p.mouse.move(tb.x-270,tb.y+208,{steps:6});await p.mouse.up();
 const tb2=await p.locator('#dlgTitle').boundingBox();ok(Math.abs(tb2.x-(tb.x-300))<3&&Math.abs(tb2.y-(tb.y+200))<3,'and moves by its title bar');
 await p.click('#dlgOk');await W();
 ok(await p.evaluate(()=>!!(__gs.doc.active.styles&&__gs.doc.active.styles.drop.on)),'the layer keeps the drop shadow');

 /* ---- dock width ---- */
 const w0=await p.evaluate(()=>__gs.dk.L.w),hb=await p.locator('#app>.dkwidth').boundingBox();
 await p.mouse.move(hb.x+3,hb.y+200);await p.mouse.down();await p.mouse.move(hb.x-77,hb.y+200,{steps:5});await p.mouse.up();await W(200);
 const w1=await p.evaluate(()=>({w:__gs.dk.L.w,real:document.querySelector('#dock').getBoundingClientRect().width}));
 ok(Math.abs(w1.w-(w0+80))<3&&Math.abs(w1.real-w1.w)<3,'dragging the dock edge widens the dock '+w0+' → '+JSON.stringify(w1));

 /* ---- options bar: More ---- */
 await p.keyboard.press('b');await W();
 ok(!(await p.$('#ob_spacing')),'spacing is not in the short bar');
 await p.click('#obMore');await W();ok(!!(await p.$('#ob_spacing'))&&!!(await p.$('#ob_sizeJitter')),'More shows spacing and jitter');
 await p.click('#obMore');await W();ok(!(await p.$('#ob_spacing')),'Less hides them again');

 /* ---- fill layers ---- */
 await setFG('#2060c0');
 await p.click('#lFill');await W(300);
 ok(await p.evaluate(()=>!!document.querySelector('#fl_v_rough')),'new fill layer opens its settings');
 await p.evaluate(()=>{const i=document.querySelector('#fl_v_rough input[type=range]')||document.querySelector('#fl_v_rough');i.value=.8;i.dispatchEvent(new Event('input',{bubbles:true}));
   const m=document.querySelector('#fl_v_metal input[type=range]')||document.querySelector('#fl_v_metal');m.value=1;m.dispatchEvent(new Event('input',{bubbles:true}));});await W(900);
 const F=await p.evaluate(()=>{const L=__gs.doc.active;return {name:L.name,fill:!!L.fill,mask:!!L.mask,edit:!!L.editMask};});
 ok(F.fill&&F.mask,'fill layer with a mask '+JSON.stringify(F));
 let v=await comp('base',[[150,100]]),r=await comp('rough',[[150,100]]),m=await comp('metal',[[150,100]]);
 ok(v[0][2]>170&&v[0][0]<60,'base colour filled with the foreground '+v[0]);
 ok(Math.abs(r[0][0]-204)<4&&m[0][0]>250,'roughness 80% and metallic 100% '+r[0][0]+'/'+m[0][0]);
 /* painting black on it paints the mask, hiding the fill there */
 await setFG('#000000');await p.keyboard.press('b');
 await p.evaluate(()=>Object.assign(__gs.brush,{size:40,hardness:1,opacity:1,flow:1,smoothing:0,pSize:false,tip:null}));
 await drag(40,100,90,100);
 v=await comp('base',[[60,100],[200,100]]);r=await comp('rough',[[60,100]]);
 ok(v[0][0]>240&&v[1][0]<60&&v[1][2]>170,'painting black hides the fill (mask) '+JSON.stringify(v));
 ok(r[0][0]>120&&r[0][0]<136,'and its roughness too '+r[0][0]);
 ok(await p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base'));return d[(100*300+60)*4+2]>170;}),'the fill itself is untouched');
 /* changing a value later, with undo */
 await p.evaluate(()=>__gs.act('newFill')).catch(()=>{});await W(300);
 const cnt=(await names()).filter(n=>n.startsWith('Fill')).length;ok(cnt===2,'Layer › New fill layer adds another '+cnt);
 await p.keyboard.press('Control+z');await W();
 await p.evaluate(()=>{const L=__gs.layerByName('Fill 1');__gs.doc.active=L;__gs.doc.sel=new Set([L]);});
 await p.evaluate(()=>__gs.dlgFill());await W(200);
 await p.evaluate(()=>{const i=document.querySelector('#fl_v_rough input[type=range]')||document.querySelector('#fl_v_rough');i.value=.2;i.dispatchEvent(new Event('input',{bubbles:true}));});
 await W(900);r=await comp('rough',[[150,100]]);ok(Math.abs(r[0][0]-51)<4,'roughness changed to 20% '+r[0][0]);
 await p.keyboard.press('Control+z');await W(300);r=await comp('rough',[[150,100]]);ok(Math.abs(r[0][0]-204)<4,'undo restores 80% '+r[0][0]);
 /* Duplicate keeps it a fill layer; Convert to pixels makes it a normal layer */
 /* kept in .gouache files */
 await p.evaluate(async()=>{const b=await __gs.encodeGouache();window.__gbuf=await b.arrayBuffer();});
 await p.evaluate(()=>__gs.newDoc(50,50,8,[1,1,1],'x',false));await p.evaluate(async()=>{await __gs.openGouache(window.__gbuf,'t');});await W(400);
 const re=await p.evaluate(()=>{const L=__gs.layerByName('Fill 1');return L&&{fill:!!L.fill,rough:L.fill.maps.rough.v,mask:!!L.mask};});
 ok(re&&re.fill&&Math.abs(re.rough-.8)<.01&&re.mask,'fill layer survives saving and opening '+JSON.stringify(re));
 v=await comp('base',[[60,100],[200,100]]);ok(v[0][0]>240&&v[1][0]<60&&v[1][2]>170,'and still shows through its mask');
 await p.screenshot({path:OUT+'ui20.png'});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
