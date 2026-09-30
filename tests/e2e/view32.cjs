/* 0.28: Decals: click a decal, click the model; a movable sticker layer with colour, height, roughness, metal */
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
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'dec',false,'pbr'));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>__gs.showPanel('decals'));await W(400);
 ok(await p.evaluate(()=>document.querySelectorAll('#dcGrid .dctile').length)===12,'the Decals panel lists 12 decals');
 await p.locator('#dcSec').screenshot({path:OUT+'dec-panel.png'});
 await p.evaluate(()=>__gs.showPanel('decals'));await W(400);
 const cam=()=>p.evaluate(()=>{const c=__gs.v3.cam;return [Math.round(c.yaw*100)/100,Math.round(c.pitch*100)/100];});
 for(const [k,yaw,pit] of [['back',3.14,0],['left',-1.57,0],['right',1.57,0],['top',null,1.57],['bottom',null,-1.57],['front',0,0]]){
  await p.selectOption('#v3ViewSel',k);await W(200);const [y,pi]=await cam();
  ok((yaw===null||Math.abs(y-yaw)<.02)&&Math.abs(pi-pit)<.02,k+' view -> yaw '+y+' pitch '+pi);}
 ok(await p.evaluate(()=>document.getElementById('v3ViewSel').value==='')  ,'the menu goes back to View…');
 await p.evaluate(()=>{__gs.v3.dirty=true;});await W(600);await p.locator('#pane3d').screenshot({path:OUT+'view32-persp.png'});
 await p.click('#v3Proj');await W(600);ok((await p.textContent('#v3Proj'))==='Orthographic','the button says Orthographic');
 ok(await p.evaluate(()=>__gs.v3s().ortho===true),'orthographic on');
 await p.selectOption('#v3ViewSel','right');await W(300);await p.evaluate(()=>{__gs.v3.dirty=true;});await W(800);await p.locator('#pane3d').screenshot({path:OUT+'view32-ortho.png'});
 // painting/picking still work in ortho: a decal lands where the pointer is
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 const n0=await p.evaluate(()=>__gs.allLayers().length);
 await p.click('#dc_bolt');await W(150);await p.mouse.click(cx,cy);await W(1000);await p.keyboard.press('Escape');
 ok(await p.evaluate(()=>__gs.allLayers().length)===n0+1,'a decal can be placed in the orthographic view');
 await p.click('#v3Proj');await W(300);ok((await p.textContent('#v3Proj'))==='Perspective','and back to perspective');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
