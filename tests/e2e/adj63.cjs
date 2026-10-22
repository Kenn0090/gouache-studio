/* 0.63: the Hue / Saturation adjustment layer in 3D Paint: an empty layer with live sliders in the Properties panel */
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
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text())&&!/GPU stall due to ReadPixels/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 const setFG=async hx=>{await p.evaluate(()=>__gs.showPanel('color'));await p.fill('#hex',hx);await p.press('#hex','Enter');};
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
 await p.selectOption('#p3Model','plane');await W(900);
 await setFG('#d02020');await p.mouse.move(cx-100,cy);await p.mouse.down();await p.mouse.move(cx+100,cy,{steps:10});await p.mouse.up();await W(500);
 const stats=()=>p.evaluate(()=>{const d=__gs.readRGBA8(__gs.compOut());let red=0,green=0,blue=0;for(let i=0;i<d.length;i+=4){if(d[i+3]<200)continue;const r=d[i],g=d[i+1],b=d[i+2];if(r>150&&g<90&&b<90)red++;else if(g>120&&r<100&&b<100)green++;else if(b>120&&r<100&&g<100)blue++;}return {red,green,blue};});
 const s0=await stats();ok(s0.red>500,'red paint on the model ('+s0.red+')');
 ok(await p.evaluate(()=>!!document.getElementById('lAdj')),'there is a Hue / Saturation layer button');
 const n0=await p.evaluate(()=>__gs.allLayers().length);
 await p.evaluate(()=>document.getElementById('lAdj').click());await W(600);
 ok(await p.evaluate(()=>__gs.allLayers().length)===n0+1&&await p.evaluate(()=>{const A=__gs.doc.active;return !!A.fx&&A.fx.stack[0].id==='hueSat'&&A.fx.map==='base'&&A.name==='Hue / Saturation';}),'one click adds an empty Hue / Saturation layer on the colour map');
 ok(await p.evaluate(()=>!!document.getElementById('adj_h')&&!!document.getElementById('adj_s')&&!!document.getElementById('adj_l')),'its Hue, Saturation and Lightness sliders show in the Properties panel');
 const s1=await stats();ok(Math.abs(s1.red-s0.red)<20,'at zero it changes nothing');
 const setv=async(id,v)=>{await p.evaluate(([id,v])=>{const e=document.getElementById('adj_'+id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await W(500);};
 await setv('h',120);const s2=await stats();ok(s2.red<s0.red*.1&&s2.green+s2.blue>s0.red*.5,'Hue +120 turns the red into another colour live ('+JSON.stringify(s2)+')');
 ok(await p.evaluate(()=>{const T=__gs.v3.tex.base,d=__gs.captureRegionNow(T,0,0,T.w,T.h).data;let red=0;for(let i=0;i<d.length;i+=4)if(d[i]>150&&d[i+1]<90&&d[i+2]<90)red++;return red<200;}),'and the 3D view shows it');
 await W(900);await p.evaluate(()=>__gs.undo());await W(500);const s3=await stats();ok(s3.red>s0.red*.8,'undo takes the colour change back in one step ('+s3.red+')');
 await p.evaluate(()=>__gs.redo());await W(500);ok((await stats()).red<s0.red*.1,'redo brings it back');
 // saturation -100 greys everything
 await setv('h',0);await setv('s',-100);const s4=await stats();ok(s4.red<20,'Saturation -100 removes the colour ('+s4.red+' red left)');
 await p.evaluate(()=>document.getElementById('adjReset').click());await W(500);const s5=await stats();ok(Math.abs(s5.red-s0.red)<30,'Reset puts it back '+JSON.stringify(s5)+' vs '+s0.red+' '+await p.evaluate(()=>JSON.stringify(__gs.doc.active.fx&&__gs.doc.active.fx.stack[0].v)));
 // inside a folder set to Pass through it still changes everything below the folder; a normal folder keeps the effect inside
 await setv('h',120);await p.evaluate(()=>document.getElementById('lGroup').click());await W(600);
 ok(await p.evaluate(()=>{const G=__gs.doc.root.children.find(n=>n.type==='group'&&n.children.some(c=>c.fx));return !!G&&G.mode===-1;}),'the layer sits in a new folder (Pass through by default)');
 ok((await stats()).red<s0.red*.1,'in a Pass through folder it still recolours the paint below');
 await p.evaluate(()=>{const G=__gs.doc.root.children.find(n=>n.type==='group'&&n.children.some(c=>c.fx));G.mode=0;__gs.changedAll();});await W(600);
 ok((await stats()).red>s0.red*.8,'in a Normal folder the effect stays inside the folder');
 await p.evaluate(()=>{const G=__gs.doc.root.children.find(n=>n.type==='group'&&n.children.some(c=>c.fx));G.mode=-1;__gs.changedAll();});await W(400);
 // another filter layer shows a plain panel with an Edit button
 await p.evaluate(()=>document.getElementById('lFx').click());await W(400);await p.selectOption('#fxAdd','invert');await W(300);await p.click('#dlgOk');await W(500);
 ok(await p.evaluate(()=>!!document.getElementById('fxPlainEdit')),'another filter layer shows an Edit filters button in the panel');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
