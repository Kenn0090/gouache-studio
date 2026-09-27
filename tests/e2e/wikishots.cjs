const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=require('path').resolve(__dirname,'../../docs/wiki/images')+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1,opts={})=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:opts.steps||8});await p.mouse.up();await p.waitForTimeout(120);};
 const mpx=(name,k,pts)=>p.evaluate(([name,k,pts])=>{const L=__gs.layerByName(name),t=__gs.mapT(L,k);if(!t||t.empty)return null;const d=__gs.readRGBA8(t),W=__gs.doc.w;return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[name,k,pts]);
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};

 const W=async ms=>p.waitForTimeout(ms||300);
 const shot=async n=>{await W(400);await p.screenshot({path:OUT+n+'.png'});console.log('shot',n);};
 const elShot=async(n,sel)=>{await W(400);await p.locator(sel).first().screenshot({path:OUT+n+'.png'});console.log('shot',n);};
 const dlg=async n=>elShot(n,'#modal .dialog');
 const clip=async(n,x,y,w,h)=>{await W(400);await p.screenshot({path:OUT+n+'.png',clip:{x,y,width:w,height:h}});console.log('shot',n);};
 // 1 overview with sample tile
 await p.evaluate(()=>{const t=document.querySelector('#toast');if(t)t.hidden=true;});
 await shot('overview');
 await elShot('layers-panel','section[aria-labelledby="hLayers"]');
 await elShot('brush-panel','section[aria-labelledby="hBrush"]');
 await elShot('color-panel','section[aria-labelledby="hColor"]');
 // blend mode popup
 await p.click('#lModeBtn');await W(300);await elShot('blend-modes','.modepop');await p.keyboard.press('Escape');await W();
 // selection + transform
 await p.keyboard.press('l');await drag(300,300,700,650,{steps:3});
 const pts=[[300,300],[650,260],[760,600],[420,720],[250,520]];const a0=await scr(...pts[0]);await p.mouse.move(a0[0],a0[1]);await p.mouse.down();for(const q of pts.slice(1).concat([pts[0]])){const c=await scr(...q);await p.mouse.move(c[0],c[1],{steps:6});}await p.mouse.up();
 await shot('selection');await p.keyboard.press('Control+d');
 await p.evaluate(()=>{const L=__gs.layerByName('Stones');__gs.doc.active=L;__gs.doc.sel=new Set([L]);});await p.keyboard.press('v');await p.keyboard.press('Control+t');await W(600);await shot('transform');await p.keyboard.press('Escape');await W();
 // new document dialog
 await p.keyboard.press('Control+Alt+n');await W();await p.click('button.chip:has-text("PBR")');await dlg('new-document');
 await p.fill('#dW','1024');await p.fill('#dH','1024');await p.click('#dlgOk');await W(600);
 // PBR painting: clouds base, paint with maps
 await p.evaluate(()=>__gs.act('clouds'));await W();await dlg('filter-clouds');await p.click('#dlgOk');await W();
 await p.evaluate(()=>{const m=__gs.ui.mapBrush;m.height.v=.85;m.rough.v=.3;m.metal.v=.85;m.height.on=m.rough.on=m.metal.on=true;__gs.brush.size=90;__gs.brush.hardness=.8;__gs.brush.pSize=false;});await p.keyboard.press('e');await p.keyboard.press('b');await W();
 await setFG('#caa04a');for(const [a,b2,c,d] of [[150,250,870,250],[150,512,870,512],[150,770,870,770],[250,150,250,870],[512,150,512,870],[770,150,770,870]])await drag(a,b2,c,d,{steps:14});
 await elShot('also-paint','.mapbrush');
 await p.click('#mapList .mrow:has-text("Material")');await W(800);await shot('material-view');
 await elShot('maps-panel','#mapsSec');
 await p.click('#mapList .mrow:has-text("Normal (final)")');await W(600);await shot('normal-view');
 await p.click('#mapList .mrow:has-text("Base colour")');await W();
 // converter dialog: curvature from height
 await p.evaluate(()=>__gs.dlgConvert('curvFromHeight'));await W(900);await shot('converter-curvature');await p.click('#dlgCancel');await W();
 // curves
 await p.evaluate(()=>__gs.act('curves'));await W(500);await p.selectOption('#cvPre','s');await W(500);await shot('curves');await p.click('#dlgCancel');await W();
 await p.evaluate(()=>__gs.act('levels'));await W(500);await dlg('levels');await p.click('#dlgCancel');await W();
 // filter layer editor
 await p.click('#lFx');await W();await p.selectOption('#fxAdd','hueSat');await W(400);await p.evaluate(()=>{const s=document.querySelector('#fx_h');s.value=-35;s.dispatchEvent(new Event('input'));});await W(300);
 await p.selectOption('#fxAdd','lensBlur');await W(600);await shot('filter-layer-editor');await p.click('#dlgOk');await W();
 await elShot('filter-layer-row','section[aria-labelledby="hLayers"]');
 await p.keyboard.press('Control+z');await W();
 // 3D view
 await p.keyboard.press('F3');await W(800);await p.selectOption('#v3Model','rcube');await W(700);
 const pb=await p.locator('#v3Hit').boundingBox();await p.mouse.move(pb.x+pb.width/2,pb.y+pb.height/2);await p.mouse.down();await p.mouse.move(pb.x+pb.width/2+90,pb.y+pb.height/2+50,{steps:4});await p.mouse.up();await W(800);
 await shot('3d-view');
 await p.click('#v3UV');await p.selectOption('#v3Model','sphere');await W(600);{const hb=await p.locator('#v3Hit').boundingBox();await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);for(let i=0;i<4;i++){await p.mouse.wheel(0,120);await W(150);}}await W(700);await shot('3d-uv-overlay');await p.click('#v3UV');
 await p.selectOption('#v3Model','plane');await p.click('#v3Gear',{force:true});await p.evaluate(()=>{const s=document.querySelector('#v3Disp');s.value=.5;s.dispatchEvent(new Event('input'));});await W(1500);
 const pb2=await p.locator('#v3Hit').boundingBox();await p.mouse.move(pb2.x+pb2.width/2,pb2.y+pb2.height/2);await p.mouse.down();await p.mouse.move(pb2.x+pb2.width/2+40,pb2.y+pb2.height/2+110,{steps:4});await p.mouse.up();await W(600);await p.evaluate(()=>{const g=document.querySelector('#v3Gear');if(g.getAttribute('aria-expanded')==='true')g.click();});await W(900);
 await shot('3d-height');
 await p.keyboard.press('F3');await W(600);
 // bake dialog + export textures + preferences + maps dialog
 await p.click('#dlgCancel');await W();
 await p.evaluate(()=>__gs.act('expTex'));await W();await dlg('export-textures');await p.click('#dlgCancel');await W();
 await p.evaluate(()=>__gs.act('maps'));await W();await dlg('document-maps');await p.click('#dlgCancel');await W();
 await p.keyboard.press('Control+k');await W();await dlg('preferences');await p.click('#dlgCancel');await W();
 await p.evaluate(()=>__gs.act('perf'));await W(1200);await elShot('performance-monitor','.perfbox');await p.evaluate(()=>__gs.act('perf'));
 // gradient
 await p.evaluate(()=>__gs.newDoc(800,500,8,[1,1,1],'Gradient',false));await W();await p.keyboard.press('g');await W();
 await p.click('.gpre[aria-label="Warm light"]').catch(()=>{});await drag(120,420,680,80,{steps:6});await W(600);await shot('gradient');
 // painterly
 // animation
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'Bounce',false));await p.evaluate(()=>__gs.setMode('anim',true));await W(500);
 await p.keyboard.press('b');await p.evaluate(()=>{__gs.brush.size=40;__gs.brush.hardness=.95;__gs.brush.pSize=false;});await setFG('#d4553a');
 for(let f=0;f<6;f++){const y=60+Math.abs(Math.sin(f/6*Math.PI))*0+ [60,110,160,190,160,110][f];await drag(122,y,134,y+2);if(f<5){await p.evaluate(()=>__gs.act?1:1);await p.click('#timeline button:has-text("+ Frame")');await W(200);}}
 await shot('animation');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
