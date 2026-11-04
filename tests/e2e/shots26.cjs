/* Guide pictures for 0.26 (docs/wiki/images/raytraced.png, shaders.png, render-window.png). */
const {chromium}=require('playwright');
const OLD=__dirname+'/',fs=require('fs');
const OUT=require("path").resolve(__dirname,"../../docs/wiki/images")+"/";
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1600,height:950}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:512,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const W=ms=>p.waitForTimeout(ms||200);
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await W(3000);
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 /* the shaders side by side, on a sphere with a warm base colour */
 await p.selectOption('#v3Model','sphere');await W(1500);
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Base material');L.fill.maps.base.c=[.78,.55,.45];L.fill.maps.rough.v=.45;__gs.fillRender(L);__gs.v3.cam.yaw=.4;__gs.v3.cam.pitch=.15;__gs.v3.cam.dist=3.1;__gs.v3.cam.tx=__gs.v3.cam.ty=__gs.v3.cam.tz=0;});await W(1500);
 const tiles=[];for(const k of ['skin','aniso','velvet','toon','cel']){await p.evaluate(k=>{__gs.doc.v3shade={kind:k,p:{aniso:{amount:.8,dir:0},velvet:{sheen:1.2,srough:.5,rim:1.5,col:[1,.85,.8]}}};if(k==='aniso'){const L=__gs.allLayers().find(l=>l.name==='Base material');L.fill.maps.metal.v=1;L.fill.maps.rough.v=.35;__gs.fillRender(L);}else{const L=__gs.allLayers().find(l=>l.name==='Base material');L.fill.maps.metal.v=0;L.fill.maps.rough.v=.45;__gs.fillRender(L);}__gs.v3.dirty=true;},k);await W(1500);
   tiles.push(await p.evaluate(()=>{const w=300,h=300,d=__gs.v3Offscreen(w,h,{});return Array.from(d);}));}
 const png=await p.evaluate(tiles=>{const w=300,h=300,c=document.createElement('canvas');c.width=w*tiles.length;c.height=h;const x=c.getContext('2d');
   tiles.forEach((t,i)=>{const im=x.createImageData(w,h);for(let y=0;y<h;y++)for(let q=0;q<w*4;q++)im.data[y*w*4+q]=t[(h-1-y)*w*4+q];x.putImageData(im,i*w,0);});return c.toDataURL('image/png').split(',')[1];},tiles);
 fs.writeFileSync(OUT+'shaders.png',Buffer.from(png,'base64'));console.log('shot shaders');
 /* ray traced: gun metal on the rounded cube, sunset HDRI as background */
 await p.evaluate(()=>{__gs.doc.v3shade={kind:'std',p:{}};const L=__gs.allLayers().find(l=>l.name==='Base material');L.fill.maps.metal.v=0;__gs.fillRender(L);});
 await p.selectOption('#v3Model','rcube');await W(1500);
 await p.evaluate(()=>{const rec=__gs.smBuiltins().find(r=>/gun metal/i.test(r.name));__gs.smApply(rec);__gs.doc.v3d.env='sunset';__gs.doc.v3d.envBg=true;__gs.doc.v3d.envBlur=.5;Object.assign(__gs.v3.cam,{yaw:.6,pitch:.3});__gs.v3.dirty=true;});await W(4000);
 await p.click('#v3Shade button:has-text("Ray traced")');for(let i=0;i<90;i++){await W(1000);if(await p.evaluate(()=>__gs.rt.view&&__gs.rt.view.n>=160))break;}
 const bx=await p.locator('#pane3d').boundingBox();await p.mouse.move(5,900);await p.screenshot({path:OUT+'raytraced.png',clip:bx});console.log('shot rt');
 await p.click('#v3Shade button:has-text("Lit")');await W(500);
 await p.click('#v3RenderBtn');await W(400);await p.click('#rtDlg .segb:has-text("Draft")');await p.evaluate(()=>{const z=document.querySelector('#rtDlg');});await p.setViewportSize({width:1100,height:760});await W(800);await p.click('#dlgCancel');await W(300);await p.click('#v3RenderBtn');await W(400);await p.click('#rtDlg .segb:has-text("Draft")');await p.evaluate(()=>document.getElementById('rtGo').click());
 for(let i=0;i<400;i++){await W(1500);if(await p.evaluate(()=>/Done/.test(document.getElementById('rtMsg').textContent)))break;}
 await p.locator('#modal .dialog').screenshot({path:OUT+'render-window.png'});console.log('shot render window');
 await b.close();})();
