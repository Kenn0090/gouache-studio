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
 /* ---- entering the tab ---- */
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 let s=await p.evaluate(()=>({mode:__gs.mode,own:__gs.tabDocs.key,w:__gs.doc.w,maps:__gs.doc.maps.join(),layers:__gs.allLayers().map(L=>L.name),v3:__gs.v3.on,paint:__gs.inPaint(()=>__gs.allLayers().map(L=>L.name)),
   dock2:!document.querySelector('#dock2').hidden&&!!document.querySelector('#dock2 section[aria-labelledby="hColor"]')}));
 ok(s.mode==='p3d'&&s.own==='p3d'&&s.w===256,'3D Paint has its own canvas '+JSON.stringify(s));
 ok(s.maps==='base,rough,metal,height,normal'&&s.layers.join()==='Base material,Paint','a PBR texture set with a base material and a paint layer');
 ok(s.v3&&s.dock2,'3D view on, Colour in the column beside it');
 const hb=await p.locator('#v3Hit').boundingBox();ok(hb&&hb.width>700,'3D layout: the viewport takes the painting area '+(hb&&Math.round(hb.width)));
 await p.screenshot({path:OUT+'p3d-enter.png'});
 /* ---- painting on the model with a left drag ---- */
 await setFG('#d02020');await p.evaluate(()=>Object.assign(__gs.brush,{size:40,hardness:1,opacity:1,flow:1,smoothing:0,pSize:false,tip:null}));
 const cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 const red=()=>p.evaluate(()=>{const L=__gs.layerByName('Paint'),d=__gs.readRGBA8(__gs.mapT(L,'base'));let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>150&&d[i+1]<80&&d[i+3]>200)n++;return n;});
 await p.mouse.move(cx-60,cy);await p.mouse.down();await p.mouse.move(cx+60,cy,{steps:10});await p.mouse.up();await W(500);
 const r1=await red();ok(r1>200,'left drag paints on the model ('+r1+' px)');
 /* ---- Alt+left drag turns (Substance style), and does not paint ---- */
 const yaw0=await p.evaluate(()=>__gs.v3.cam.yaw);
 await p.keyboard.down('Alt');await p.mouse.move(cx,cy+60);await p.mouse.down();await p.mouse.move(cx+100,cy+60,{steps:6});await p.mouse.up();await p.keyboard.up('Alt');await W(300);
 const yaw1=await p.evaluate(()=>__gs.v3.cam.yaw);ok(Math.abs(yaw1-yaw0)>.3&&(await red())===r1,'Alt+drag turns the model without painting '+yaw0.toFixed(2)+' → '+yaw1.toFixed(2));
 /* middle drag moves */
 const tx0=await p.evaluate(()=>__gs.v3.cam.tx+__gs.v3.cam.ty+__gs.v3.cam.tz);
 await p.mouse.move(cx,cy);await p.mouse.down({button:'middle'});await p.mouse.move(cx+80,cy+30,{steps:5});await p.mouse.up({button:'middle'});await W(200);
 ok(Math.abs(await p.evaluate(()=>__gs.v3.cam.tx+__gs.v3.cam.ty+__gs.v3.cam.tz)-tx0)>.05,'middle drag moves the view');
 await p.mouse.dblclick(hb.x+10,hb.y+hb.height-10);await W(300);
 /* ---- Alt over the model picks its colour ---- */
 await setFG('#20a040');
 await p.evaluate(()=>{__gs.v3.cam.yaw=.5;__gs.v3.cam.pitch=.25;__gs.v3.dirty=true;});await W(300);
 await p.mouse.move(cx-2,cy);await p.keyboard.down('Alt');await p.mouse.move(cx,cy,{steps:2});await W(400);await p.keyboard.up('Alt');
 let fg=await p.evaluate(()=>__gs.ui.fg.map(v=>Math.round(v*255)));ok(fg[0]!==32||fg[1]!==160,'Alt over the model picks a colour '+fg);
 /* ---- 3D-Coat navigation ---- */
 await p.click('#p3dBody .segb:text-is("3D-Coat")');await W();
 const y2=await p.evaluate(()=>__gs.v3.cam.yaw);await p.mouse.move(cx,cy);await p.mouse.down({button:'right'});await p.mouse.move(cx+90,cy,{steps:5});await p.mouse.up({button:'right'});await W(200);
 ok(Math.abs(await p.evaluate(()=>__gs.v3.cam.yaw)-y2)>.3,'3D-Coat style: right-drag turns');
 await p.click('#p3dBody .segb:text-is("Substance Painter")');await W();
 /* ---- lock-up: a stroke that never started must not stop the model turning ---- */
 await p.evaluate(()=>{__gs.v3.mstroke={id:99};});
 const y3=await p.evaluate(()=>__gs.v3.cam.yaw);await p.keyboard.down('Alt');await p.mouse.move(cx,cy);await p.mouse.down();await p.mouse.move(cx+90,cy,{steps:5});await p.mouse.up();await p.keyboard.up('Alt');await W(200);
 ok(Math.abs(await p.evaluate(()=>__gs.v3.cam.yaw)-y3)>.3,'a stuck stroke no longer locks the model');
 /* ---- shade strip: Left/Right arrow keys ---- */
 await p.evaluate(()=>{__gs.ui.bg=[1,1,1];});await setFG('#000000');await p.evaluate(()=>document.activeElement&&document.activeElement.blur());await W();
 const onIdx=()=>p.evaluate(()=>({i:[...document.querySelectorAll('#mix button')].findIndex(b=>b.classList.contains('on')),fg:__gs.ui.fg.map(v=>Math.round(v*255))[0],bg:__gs.ui.bg[0]}));
 const st=[await onIdx()];await p.keyboard.press('ArrowRight');await W();st.push(await onIdx());await p.keyboard.press('ArrowRight');await W();st.push(await onIdx());
 ok(st[2].i===2&&st[2].fg>20&&st[2].fg<140,'Right arrow steps along the shade strip '+JSON.stringify(st));
 await p.keyboard.press('ArrowLeft');await W();ok((await onIdx()).i===1,'Left arrow steps back');
 /* ---- layouts ---- */
 await p.click('#p3dBody .segb:text-is("3D + 2D")');await W(400);
 let l=await p.evaluate(()=>({pane:document.querySelector('#pane3d').getBoundingClientRect().width,work:document.querySelector('#work').getBoundingClientRect().width}));ok(l.pane>150&&l.pane<l.work-150,'3D + 2D layout '+JSON.stringify(l));
 await p.click('#p3dBody .segb:text-is("2D")');await W(400);ok(await p.evaluate(()=>!__gs.v3.on),'2D layout hides the viewport');
 await p.click('#p3dBody .segb:text-is("3D")');await W(400);
 await p.screenshot({path:OUT+'p3d-painted.png'});
 /* ---- back to Paint: the painting is untouched, and 3D Paint keeps its work ---- */
 await p.click('#modeTabs [data-mode=paint]');await W(600);
 s=await p.evaluate(()=>({own:__gs.tabDocs.key,names:__gs.allLayers().map(L=>L.name),w:__gs.doc.w,dock2:document.querySelector('#dock2').hidden}));
 ok(!s.own&&s.names.join()==='Background'&&s.w===300&&s.dock2,'back in Paint the painting is unchanged '+JSON.stringify(s));
 await p.click('#modeTabs [data-mode=p3d]');await W(800);ok((await red())>=r1-5,'3D Paint keeps its painting');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
