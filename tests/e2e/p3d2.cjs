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
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');await p.evaluate(()=>document.activeElement&&document.activeElement.blur());};
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
 await p.click('#p3dBody .segb:text-is("3D + 2D")');await W(400);const cb=await p.locator('#gl').boundingBox();await p.mouse.move(cb.x+60,cb.y+200);await W(200);
 ok(await p.evaluate(()=>{const c=document.querySelector('#brushCursor');return c.classList.contains('tipcur')&&!!c.querySelector('canvas');}),'and on the flat canvas');
 await p.evaluate(()=>{__gs.prefs.tipCursor=false;__gs.brush.tip=null;});await p.click('#p3dBody .segb:text-is("3D")');
 await p.screenshot({path:OUT+'p3d2.png'});
 await p.click('#modeTabs [data-mode=paint]');await W(600);ok(await p.evaluate(ws=>__gs.dk.ws===ws,ws0),'leaving brings the previous workspace back');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
