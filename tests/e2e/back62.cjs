/* 0.62.1: Skip back faces: paint never goes through a part to its far side (camera alignment seen from behind), and the option can be turned off */
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
 const stroke=async()=>{await p.mouse.move(cx-60,cy);await p.mouse.down();await p.mouse.move(cx+60,cy,{steps:10});await p.mouse.up();await W(500);};
 await p.evaluate(()=>{const s=__gs.v3s();s.paintAlign='camera';__gs.v3.dirty=true;});
 ok(await p.evaluate(()=>{const c=document.getElementById('p3BackfacePaint');return !!c&&!c.checked&&__gs.v3s().noBack!==false;}),'Skip back faces is on by default');
 // seen from behind with Camera alignment, the plane's far side used to take paint
 await p.evaluate(()=>{__gs.v3s().noBack=false;Object.assign(__gs.v3.cam,{yaw:Math.PI,pitch:0});__gs.v3.dirty=true;});await W(500);
 const base=await red();await stroke();const off=await red();ok(off>base+100,'with it off, the back of the plane takes paint (+'+(off-base)+' px)');
 await p.evaluate(()=>__gs.undo());await W(600);const afterUndo=await red();ok(afterUndo<=base+5,'undo takes it away ('+afterUndo+' vs '+base+')');
 await p.evaluate(()=>{__gs.v3s().noBack=true;__gs.v3.dirty=true;});await W(300);
 await stroke();const on=await red();ok(on<=afterUndo+5,'with it on, paint does not go through to the back (+'+(on-afterUndo)+' px)');
 // from the front it still paints
 await p.evaluate(()=>{Object.assign(__gs.v3.cam,{yaw:0,pitch:0});__gs.v3.dirty=true;});await W(500);
 await stroke();const fr=await red();ok(fr>on+100,'and the front still paints ('+fr+' px)');
 // the checkbox changes the setting
 await p.evaluate(()=>{const c=document.getElementById('p3BackfacePaint');c.click();});await W(200);
 ok(await p.evaluate(()=>__gs.v3s().noBack===false),'the checkbox turns it off');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
