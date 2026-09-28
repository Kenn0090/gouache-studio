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
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1,opts={})=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:opts.steps||8});await p.mouse.up();await p.waitForTimeout(120);};
 const mpx=(name,k,pts)=>p.evaluate(([name,k,pts])=>{const L=__gs.layerByName(name),t=__gs.mapT(L,k);if(!t||t.empty)return null;const d=__gs.readRGBA8(t),W=__gs.doc.w;return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[name,k,pts]);
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};

 await p.evaluate(()=>__gs.newDoc(760,520,8,[.3,.5,.8],'f',false));
 await setFG('#e08030');await p.keyboard.press('b');await p.evaluate(()=>{__gs.brush.size=30;});await drag(20,30,140,90);await setFG('#206020');await drag(20,90,140,30);
 const sig=()=>p.evaluate(()=>{const d=__gs.readRGBA8(__gs.doc.active.target);let s=0;for(let i=0;i<d.length;i+=3)s=(s*31+d[i])>>>0;return s;});
 const acts=['boxBlur','radialBlur','lensBlur','levels','curves','hueSat','gradMap','desat','threshold','posterize','quantize','surfBlur','motionBlur','highPass','oilPaint','painterly','cutout','mosaic','emboss','edges','noise','clouds','cells','offset','seamless'];
 const tweak={levels:async()=>{
   /* the simple (Substance-style) layout: drag the white input handle left, the picture changes */
   ok(await p.isVisible('canvas.lvsimple'),'Levels opens in the simple layout');const g0=await p.locator('#gl').screenshot();
   const bb=await p.locator('canvas.lvsimple').boundingBox(),sx=bb.width/256,sy=bb.height/132;
   await p.mouse.move(bb.x+(8+240)*sx,bb.y+95*sy);await p.mouse.down();await p.mouse.move(bb.x+(8+120)*sx,bb.y+95*sy,{steps:5});await p.mouse.up();await p.waitForTimeout(400);
   ok(!(await p.locator('#gl').screenshot()).equals(g0),'dragging a handle changes the picture');
   await p.click('.segb:text-is("Sliders")');await p.click('.dlg-grid button:has-text("Reset")').catch(()=>{});
   await p.click('.dlg-grid button:has-text("Auto")');await p.evaluate(()=>{const s=document.querySelector('#lvG');s.value=1.8;s.dispatchEvent(new Event('input'));});},
   curves:async()=>{await p.selectOption('#cvPre','s');},hueSat:async()=>{await p.evaluate(()=>{const s=document.querySelector('#fx_h');s.value=90;s.dispatchEvent(new Event('input'));});},
   mosaic:async()=>{await p.evaluate(()=>{const s=document.querySelector('#fx_g');s.value=2;s.dispatchEvent(new Event('input'));});},
   offset:null};
 for(const a of acts){const s0=await sig();const t0=Date.now();await p.evaluate(a=>__gs.act(a),a);await p.waitForTimeout(150);if(tweak[a])await tweak[a]();await p.waitForTimeout(100);
   const dlg=await p.evaluate(()=>!document.querySelector('#modal').hidden);if(dlg){await p.screenshot({path:OUT+'fx-'+a+'.png'});await p.click('#dlgOk');}await p.waitForTimeout(150);
   const s1=await sig();ok(s1!==s0,a+' changed pixels ('+(Date.now()-t0)+'ms)');
   await p.keyboard.press('Control+z');await p.waitForTimeout(120);const s2=await sig();ok(s2===s0,a+' undo');}
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
