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
 const setFG=async hx=>{await p.evaluate(()=>__gs.showPanel('color'));await p.fill('#hex',hx);await p.press('#hex','Enter');await p.evaluate(()=>document.activeElement&&document.activeElement.blur());};
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 const ws0=await p.evaluate(()=>__gs.dk.ws);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 ok(await p.evaluate(()=>__gs.dk.ws==='texturing'),'entering 3D Paint switches to the Texturing workspace (was '+ws0+')');
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 /* ---- texture sets: delete ---- */
 await p.evaluate(()=>{const o='v -2 -1 0\nv -0.1 -1 0\nv -0.1 1 0\nv -2 1 0\nv 0.1 -1 0\nv 2 -1 0\nv 2 1 0\nv 0.1 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nusemtl Left\nf 1/1 2/2 3/3 4/4\nusemtl Right\nf 5/1 6/2 7/3 8/4\n';__gs.useModel(__gs.parseOBJ(o,'two.obj'));});await W(800);
 await p.evaluate(()=>{Object.assign(__gs.v3.cam,{yaw:0,pitch:0});__gs.v3.dirty=true;});await W(300);
 await setFG('#d02020');await p.evaluate(()=>Object.assign(__gs.brush,{size:40,hardness:1,opacity:1,flow:1,smoothing:0,pSize:false,tip:null}));
 await p.mouse.move(cx-hb.width*.2-30,cy);await p.mouse.down();await p.mouse.move(cx-hb.width*.2+30,cy,{steps:8});await p.mouse.up();await W(400);
 const red=()=>p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint'),d=__gs.readRGBA8(__gs.mapT(L,'base'));let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>150&&d[i+1]<80&&d[i+3]>200)n++;return n;});
 ok((await red())>200,'painted the Left set');
 await p.click('#p3dBody .p3set:has-text("Left") .p3del');await W(200);await p.click('#dlgOk');await W(600);
 let s=await p.evaluate(()=>({sets:__gs.p3.sets.map(S=>S.name),cur:__gs.p3.sets[__gs.p3.cur].name}));
 ok(s.sets.includes('Left')&&s.sets.includes('Right')&&s.cur==='Right','deleting the active set moves to another, and its part starts a new set '+JSON.stringify(s));
 await p.click('#p3dBody .p3set:has-text("Left")');await W(500);ok((await red())===0,'the deleted set’s painting is gone');
 /* ---- shades past the ends ---- */
 await p.evaluate(()=>{__gs.ui.bg=[.35,.05,.05];});await setFG('#102030');await setFG('#e02020');
 const lum=()=>p.evaluate(()=>{const c=__gs.ui.fg;return .2126*c[0]+.7152*c[1]+.0722*c[2];});
 await p.mouse.move(cx,cy);for(let i=0;i<8;i++)await p.keyboard.press('ArrowRight');await W();const l8=await lum();
 for(let i=0;i<4;i++)await p.keyboard.press('ArrowRight');await W();const l12=await lum();
 const st=await p.evaluate(()=>({i:__gs.ui.shade.i,on:[...document.querySelectorAll('#mix button')].findIndex(b=>b.classList.contains('on')),fg:__gs.ui.fg.map(v=>Math.round(v*255))}));
 ok(st.i===12&&l12<l8-.005&&st.on>=0&&st.fg[0]>st.fg[1],'arrow keys keep going past the end, darker in the same colour '+JSON.stringify(st)+' '+l8.toFixed(3)+'→'+l12.toFixed(3));
 /* ---- stencil invert with X ---- */
 await p.selectOption('#p3Model','plane');await W(800);await p.evaluate(()=>{Object.assign(__gs.v3.cam,{yaw:0,pitch:0});__gs.v3.dirty=true;});
 await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,64,64);x.fillStyle='#fff';x.fillRect(0,0,64,32);
   const b=await new Promise(r=>c.toBlob(r,'image/png'));await __gs.st3Load(new File([b],'half.png',{type:'image/png'}));Object.assign(__gs.st3,{x:.5,y:.5,scale:1.2,rot:0,mode:'mask',invert:false});});await W(300);
 await p.mouse.move(cx,cy);await p.keyboard.press('x');await W(200);ok(await p.evaluate(()=>__gs.st3.invert),'X over the view inverts the stencil');
 await setFG('#e01010');await p.evaluate(()=>Object.assign(__gs.brush,{size:30}));
 await p.mouse.move(cx,hb.y+hb.height*.2);await p.mouse.down();await p.mouse.move(cx,hb.y+hb.height*.8,{steps:16});await p.mouse.up();await W(600);
 const halves=await p.evaluate(()=>{const F=__gs.v3.fbo,g=document.querySelector('#gl').getContext('webgl2'),d=new Uint8Array(F.w*F.h*4);g.bindFramebuffer(g.FRAMEBUFFER,F.rf);g.readPixels(0,0,F.w,F.h,g.RGBA,g.UNSIGNED_BYTE,d);g.bindFramebuffer(g.FRAMEBUFFER,null);
   let top=0,bot=0;for(let y=0;y<F.h;y++)for(let x=0;x<F.w;x++){const i=(y*F.w+x)*4;if(d[i]>150&&d[i+1]<90&&d[i+2]<90){if(y>=F.h/2)top++;else bot++;}}return {top,bot};});
 ok(halves.bot>200&&halves.top<halves.bot*.1,'inverted stencil paints the black half '+JSON.stringify(halves));
 const fgBefore=await p.evaluate(()=>__gs.ui.fg.join());await p.evaluate(()=>{__gs.st3.mode='off';});await p.mouse.move(cx,cy);await p.keyboard.press('x');await W();
 ok(await p.evaluate(()=>__gs.st3.invert)&&(await p.evaluate(()=>__gs.ui.fg.join()))!==fgBefore,'without a stencil, X swaps the colours as before');
 /* ---- tip outline cursor ---- */
 await p.evaluate(()=>{__gs.prefs.tipCursor=true;__gs.brush.tip=__gs.library[0].presets.find(p=>p.tip).tip;});
 await p.mouse.move(cx+5,cy+5);await W(200);
 ok(await p.evaluate(()=>{const c=document.querySelector('.v3cur');return !!c&&c.classList.contains('tipcur')&&!!c.querySelector('canvas');}),'tip outline cursor on the model');
 await p.click('#p3dBody .segb:text-is("3D + 2D")');await W(400);const cb=await p.locator('#gl').boundingBox();await p.mouse.move(cb.x+cb.width-140,cb.y+200);await W(200);
 ok(await p.evaluate(()=>{const c=document.querySelector('#brushCursor');return c.classList.contains('tipcur')&&!!c.querySelector('canvas');}),'and on the flat canvas');
 await p.evaluate(()=>{__gs.prefs.tipCursor=false;__gs.brush.tip=null;});await p.click('#p3dBody .segb:text-is("3D")');
 await p.screenshot({path:OUT+'p3d2.png'});
 /* ---- mask mode: Alt+click the mask shows it on the model, unlit; the bar fills it; Esc leaves ---- */
 const px=()=>p.evaluate(()=>{const F=__gs.v3.fbo,g=document.querySelector('#gl').getContext('webgl2'),d=new Uint8Array(4);g.bindFramebuffer(g.FRAMEBUFFER,F.rf);g.readPixels(F.w>>1,F.h>>1,1,1,g.RGBA,g.UNSIGNED_BYTE,d);g.bindFramebuffer(g.FRAMEBUFFER,null);return Array.from(d);});
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.doc.active=L;__gs.doc.sel=new Set([L]);__gs.act('addMask');});await W(300);
 const mt=p.locator('#layerList .lrow:has(.lname:text-is("Paint")) .mthumb');await mt.click({modifiers:['Alt']});await W(600);
 ok(await p.evaluate(()=>__gs.ui.viewMask&&!document.querySelector('#maskBar').hidden),'Alt+click on the mask: mask mode with its bar');
 let c=await px();ok(c[0]>240&&c[1]>240&&c[2]>240,'the model shows the (white) mask, unlit '+c);
 await p.click('#maskBlack');await W(500);c=await px();ok(c[0]<15&&c[1]<15,'Fill black shows black on the model '+c);
 await p.click('#maskInv');await W(500);c=await px();ok(c[0]>240,'Invert '+c);
 await p.mouse.move(cx,cy);await p.keyboard.press('Escape');await W(400);
 ok(await p.evaluate(()=>!__gs.ui.viewMask&&document.querySelector('#maskBar').hidden),'Esc leaves mask mode');
 c=await px();ok(!(c[0]>240&&c[1]>240&&c[2]>240),'the model shows its material again '+c);
 /* ---- mask tools: nothing paints until Paint is on; Box selects what you see; drag inside moves it; the thumbnail leaves ---- */
 await mt.click({modifiers:['Alt']});await W(500);
 const mblack=()=>p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint'),d=__gs.readRGBA8(L.mask.target);let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<60)n++;return n;});
 const selInfo=()=>p.evaluate(()=>{const d=__gs.selPixels(),W=__gs.doc.w;let n=0,sx=0;for(let i=0;i<d.length;i++)if(d[i]>127){n++;sx+=i%W;}return {n,x:n?Math.round(sx/n):0,on:!!__gs.sel.active};});
 await p.evaluate(()=>{__gs.v3.paintOn=true;Object.assign(__gs.brush,{size:40,hardness:1,opacity:1,flow:1,smoothing:0,lazy:0,pSize:false,tip:null});});await setFG('#000000');await p.evaluate(()=>document.activeElement&&document.activeElement.blur());
 const stroke3=async(x0,y0,x1,y1)=>{await p.mouse.move(x0,y0);await p.mouse.down();await p.mouse.move(x1,y1,{steps:8});await p.mouse.up();await W(500);};
 await stroke3(cx-40,cy,cx+40,cy);ok(await mblack()===0,'in mask mode nothing paints until Paint is pressed');
 await p.click('#mk_paint');await W(200);await stroke3(cx-40,cy,cx+40,cy);const nb=await mblack();ok(nb>200,'with Paint on, the brush paints the mask ('+nb+')');
 await p.click('#maskWhite');await W(300);await p.click('#mk_box');await W(200);
 ok(await p.evaluate(()=>__gs.ui.tool==='marquee'&&document.querySelector('#mk_box').getAttribute('aria-pressed')==='true'),'Box is on (and the canvas uses the marquee)');
 await stroke3(cx-70,cy-60,cx-5,cy+60);const s1=await selInfo();ok(s1.on&&s1.n>300,'Box selects the visible part of the model '+JSON.stringify(s1));
 ok(await p.evaluate(()=>{const c=document.querySelector('.v3mk');return !!c&&!c.hidden;}),'the box outline shows over the view');
 await stroke3(cx-40,cy,cx+50,cy);const s2=await selInfo();ok(s2.on&&Math.abs(s2.n-s1.n)<s1.n*.5&&s2.x!==s1.x,'dragging inside moves the selection '+JSON.stringify(s2));
 await p.click('#maskBlack');await W(400);const nb2=await mblack();ok(nb2>100&&Math.abs(nb2-s2.n)<s2.n*.35,'Fill black fills only the selection ('+nb2+')');
 await p.keyboard.press('Control+d');await W(200);await p.click('#mk_poly');await W(200);
 for(const [dx,dy] of [[-50,-50],[30,-50],[30,40]]){await p.mouse.click(cx+dx,cy+dy);await W(120);}await p.keyboard.press('Enter');await W(500);
 const s3=await selInfo();ok(s3.on&&s3.n>100,'Polygon: click the corners, Enter closes '+JSON.stringify(s3));
 await p.keyboard.press('Control+d');await W(200);
 /* ID colour: a baked ID map (left half red, right half blue); a click on the model picks its colour there */
 await p.evaluate(()=>{const d=__gs.doc,t=__gs.makeTarget(d.w,d.h,8,false),g=document.querySelector('#gl').getContext('webgl2'),px=new Uint8Array(d.w*d.h*4);
   for(let i=0;i<d.w*d.h;i++){const left=(i%d.w)<d.w/2;px.set(left?[255,0,0,255]:[0,0,255,255],i*4);}g.bindTexture(g.TEXTURE_2D,t.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,d.w,d.h,g.RGBA,g.UNSIGNED_BYTE,px);d.meshMaps=Object.assign(d.meshMaps||{},{id:t});});
 await p.click('#mk_id');await W(200);ok(await p.evaluate(()=>!!document.querySelector('#idTol')),'ID colour shows its settings row');
 const idHalves=()=>p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint'),d=__gs.readRGBA8(L.mask.target),W=__gs.doc.w;let l=0,r=0;for(let i=0;i<d.length;i+=4)if(d[i]>200){if((i/4)%W<W/2)l++;else r++;}return {l,r,half:W*__gs.doc.h/2};});
 const nU=await p.evaluate(()=>__gs.hist.undo.length);
 await p.mouse.click(cx-30,cy);await W(400);let hv=await idHalves();
 ok((hv.l===hv.half&&hv.r===0)||(hv.r===hv.half&&hv.l===0),'picking an ID colour: that colour white, the rest black '+JSON.stringify(hv));
 await p.click('label:has(#idInv), #idInv');await W(300);const hv2=await idHalves();ok(hv2.l===hv.r&&hv2.r===hv.l,'Invert swaps them '+JSON.stringify(hv2));
 await W(900);ok(await p.evaluate(n=>{const d=__gs.hist.undo.length-n;return (d===2||d===3)&&__gs.hist.undo.slice(-1)[0].label==='ID colour selection';},nU),'the ID colour row, then one undo step for its changes');
 ok(await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint'),r=L.mask.stack&&L.mask.stack.find(x=>x.kind==='id');return !!r&&r.p.cols.length===1&&r.p.inv;}),'the ID selection is a live row of the mask');
 await p.click('#mk_id');await W(100);
 await p.locator('#layerList .lrow:has(.lname:text-is("Paint")) .thumbs > :first-child').click();await W(400);
 ok(await p.evaluate(()=>!__gs.ui.viewMask&&document.querySelector('#maskBar').hidden),'clicking the layer thumbnail leaves mask mode');
 await p.click('#modeTabs [data-mode=paint]');await W(600);ok(await p.evaluate(ws=>__gs.dk.ws===ws,ws0),'leaving brings the previous workspace back');
 /* ---- Paint › Send to 3D Paint: flattened into a new layer of the active set ---- */
 await p.evaluate(()=>{__gs.allLayers()[0].visible=false;__gs.act('addLayer');});await W();
 await p.evaluate(()=>{const s=__gs.sel;});await setFG('#20c040');
 await p.keyboard.press('m');const gb=await p.locator('#gl').boundingBox();
 const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));
 await p.mouse.move(gb.x+v.x+40*v.z,gb.y+v.y+40*v.z);await p.mouse.down();await p.mouse.move(gb.x+v.x+140*v.z,gb.y+v.y+120*v.z,{steps:5});await p.mouse.up();await W();
 await p.evaluate(()=>__gs.act('fill'));await p.evaluate(()=>__gs.act('deselect'));await W();
 await p.evaluate(()=>__gs.act('sendP3'));await W(1200);
 const sp=await p.evaluate(()=>{const L=__gs.doc.active,T=L._fillImg.base,d=__gs.captureRegionNow(T,0,0,T.w,T.h).data,W=__gs.doc.w;/* (0.27) it arrives as a live sticker: its own picture */let g=0,o=0;for(let i=0;i<d.length;i+=4){if(d[i+1]>150&&d[i]<90&&d[i+3]>200)g++;else if(d[i+3]>20)o++;}return {mode:__gs.mode,name:L.name,g,o,frac:g/(W*W),sticker:!!(L.fill&&L.fill.decal&&L.fill.proj==='planar')};});
 ok(sp.mode==='p3d'&&sp.sticker&&/from Paint/.test(sp.name)&&sp.g>100&&sp.o<sp.g*.1,'Send to 3D Paint: the painting arrives as a sticker layer in 3D Paint '+JSON.stringify(sp));
 await p.click('#modeTabs [data-mode=paint]');await W(600);
 /* right-click one layer › Send layer to 3D Paint: only that layer goes */
 await p.evaluate(()=>{__gs.allLayers()[0].visible=true;__gs.act('addLayer');});await W();await setFG('#2040e0');
 await p.keyboard.press('m');{const v2=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));await p.mouse.move(gb.x+v2.x+160*v2.z,gb.y+v2.y+40*v2.z);await p.mouse.down();await p.mouse.move(gb.x+v2.x+260*v2.z,gb.y+v2.y+120*v2.z,{steps:5});await p.mouse.up();await W();}
 await p.evaluate(()=>{__gs.act('fill');__gs.act('deselect');const L=__gs.doc.active;L.name='Logo';__gs.showPanel('layers');__gs.renderLayers();});await W(300);
 await p.click('#layerList .lrow:has(.lname:text-is("Logo"))',{button:'right'});await W(150);
 ok(await p.evaluate(()=>[...document.querySelectorAll('#menuPop .mi')].some(b=>b.textContent.includes('Send layer to 3D Paint'))),'right-click in Paint offers Send layer to 3D Paint');
 await p.click('#menuPop .mi:has-text("Send layer to 3D Paint")');await W(1200);
 const sl=await p.evaluate(()=>{const L=__gs.doc.active,T=L._fillImg.base,d=__gs.captureRegionNow(T,0,0,T.w,T.h).data;let bl=0,o=0;for(let i=0;i<d.length;i+=4){if(d[i+2]>150&&d[i]<90&&d[i+3]>200)bl++;else if(d[i+3]>20)o++;}return {mode:__gs.mode,name:L.name,bl,o};});
 ok(sl.mode==='p3d'&&/Logo/.test(sl.name)&&sl.bl>100&&sl.o<sl.bl*.1,'only that layer arrives in 3D Paint (no background, no other layers) '+JSON.stringify(sl));
 await p.click('#modeTabs [data-mode=paint]');await W(600);
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
