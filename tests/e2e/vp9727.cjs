/* 0.97.27 (Kenn): Lights, Camera and Post FX buttons on the 3D view open dockable panels; sticky focus; the old copies are gone */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1600,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await p.waitForTimeout(3000);const W=ms=>p.waitForTimeout(ms||300);
 ok(await p.evaluate(()=>['v3LightsBtn','v3CamBtn','v3PostBtn'].every(id=>!!document.getElementById(id))),'the 3D view has Lights, Camera and Post FX buttons');
 /* Lights: a floating, dockable panel with the rig; the gizmo shows */
 await p.click('#v3LightsBtn');await W(600);
 const li=await p.evaluate(()=>({shown:__gs.panelShown('v3lights'),float:__gs.dk.L.floats.some(f=>f.tabs.includes('v3lights')),rig:!!document.querySelector('#vpLightsBody #lAuto'),studio:!!document.querySelector('#vpLightsBody #vplFill'),
   lights:__gs.lightRig().lights.length,on:document.getElementById('v3LightsBtn').classList.contains('on')}));
 ok(li.shown&&li.float&&li.rig&&li.studio&&li.lights>0&&li.on,'Lights opens as a floating panel with your lights and the studio lighting '+JSON.stringify(li));
 ok(await p.evaluate(()=>{const c=document.querySelector('.v3lgz');return !!c&&!c.hidden;}),'…and the light gizmo shows on the model');
 const tab=await p.evaluate(()=>!!document.querySelector('.dkfloat [data-tab="v3lights"],.dkfloat .dktab'));
 ok(tab,'…its tab can be dragged into the dock like any panel');
 await p.click('#v3LightsBtn');await W(400);
 ok(await p.evaluate(()=>!__gs.panelShown('v3lights')&&!document.getElementById('v3LightsBtn').classList.contains('on')),'clicking the button again hides it');
 /* Camera: lens, depth of field, sticky focus */
 await p.click('#v3CamBtn');await W(500);
 ok(await p.evaluate(()=>!!document.querySelector('#vpCamBody #v3Mm')&&!!document.querySelector('#vpCamBody #v3Lens')&&!!document.querySelector('#vpCamBody #vpDof')),'Camera has the focal length, lens picks and depth of field');
 await p.evaluate(()=>{document.querySelector('#vpDof input,#vpDof').click();});await W(300);
 if(!(await p.evaluate(()=>__gs.postOf().dof.on)))await p.evaluate(()=>{const c=document.querySelector('#vpDof');(c.querySelector('input')||c).click();});await W(300);
 ok(await p.evaluate(()=>__gs.postOf().dof.on&&!!document.getElementById('vpFocusPick')),'turning depth of field on shows the focus controls');
 await p.click('#vpFocusPick');await W(200);
 const hb=await p.locator('#v3Hit').boundingBox();await p.mouse.click(hb.x+hb.width/2,hb.y+hb.height/2);await W(500);
 const D=await p.evaluate(()=>__gs.postOf().dof);ok(D.sticky&&Array.isArray(D.pt)&&D.pt.length===3,'clicking the model sets a sticky focus point '+JSON.stringify(D.pt));
 const f=await p.evaluate(()=>{const g=__gs,D=g.postOf().dof,a=g.vpFocusDist(D);g.v3.cam.dist*=1.5;const b=g.vpFocusDist(D);g.v3.cam.dist/=1.5;return [a,b];});
 ok(f[1]>f[0]*1.2,'the focus follows that point as the camera zooms out '+f.map(x=>x.toFixed(2)));
 const img=await p.evaluate(()=>{const g=__gs,a=g.v3Offscreen(160,120);let n=0;for(let i=0;i<a.length;i+=4)n+=a[i];return n;});ok(img>0&&!errs.length,'the 3D view draws with depth of field on');
 /* Post FX */
 await p.click('#v3PostBtn');await W(500);
 ok(await p.evaluate(()=>!!document.querySelector('#vpPostBody #postBox')&&!document.querySelector('#vpPostBody #post_dof')),'Post FX has the effects, depth of field moved to Camera');
 /* the old copies are gone */
 const old=await p.evaluate(()=>{__gs.showPanel('shading');__gs.renderShading();return {post:!!document.querySelector('#shadeBody #postBox'),studio:!!document.querySelector('#shadeBody #shStudioFill'),btns:!!document.getElementById('shVpBtns')};});
 ok(!old.post&&!old.studio&&old.btns,'the Shader panel no longer repeats them; it has buttons to the new panels '+JSON.stringify(old));
 ok(!errs.length,'no page errors '+errs.join(' | '));await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
