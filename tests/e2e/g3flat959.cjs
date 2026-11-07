/* 0.95.9: Quick mask is switched off (Q, menu, button); 3D gradient points can be moved and added on the flat canvas */
const {chromium}=require('playwright'),path=require('path');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1500,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'split'}));localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* ---- Quick mask is off ---- */
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'qm',false));await W(300);await p.mouse.move(700,450);await p.keyboard.press('q');await W(200);
 ok(await p.evaluate(()=>!__gs.sel.quick),'Q does not turn on Quick mask');
 ok(await p.evaluate(()=>!__gs.menuList(__gs.MENUS.Select,'Select').some(e=>/Quick mask/.test(e.textContent))),'Select menu has no Quick mask');
 /* ---- 3D gradient points on the flat canvas ---- */
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{const G=__gs;G.v3s().model='sphere';G.v3.mesh=null;G.v3.dirty=true;G.requestRender(true);});await W(1500);
 await p.evaluate(()=>{__gs.cmdNewG3dLayer();__gs.g3.sel=-1;__gs.drawXfOverlay();});await W(800);
 const sp=await p.evaluate(()=>{const G=__gs,T=G.g3Target(),uv=G.g3Spots(T);return uv.map(u=>u&&G.toScreen(u[0]*G.doc.w,u[1]*G.doc.h));});
 const st=await p.locator('#stage').boundingBox();
 ok(sp.length===2&&sp.every(Boolean),'both points have a spot on the flat texture '+JSON.stringify(sp));
 ok(await p.evaluate(()=>document.querySelectorAll('#xfOv circle, svg circle').length>=2),'the points are drawn on the flat canvas');
 const p0=await p.evaluate(()=>__gs.doc.active.fill.g3.pts[0].p.slice());
 const a=[st.x+sp[0][0],st.y+sp[0][1]];
 await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(a[0]+30,a[1]+25,{steps:6});await p.mouse.up();await W(500);
 const p1=await p.evaluate(()=>__gs.doc.active.fill.g3.pts[0].p.slice());
 ok(Math.hypot(p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2])>.05,'dragging the dot on the canvas moves the point '+JSON.stringify([p0,p1].map(v=>v.map(x=>+x.toFixed(2)))));
 const r1=Math.hypot(p1[0]-.5,p1[1]-.5,p1[2]-.5);ok(r1>.45&&r1<.6,'it stays just above the surface (distance from the middle '+r1.toFixed(2)+')');
 await p.keyboard.press('Control+z');await W(400);
 const p2=await p.evaluate(()=>__gs.doc.active&&__gs.doc.active.fill?__gs.doc.active.fill.g3.pts[0].p.slice():null);ok(p2&&Math.hypot(p2[0]-p0[0],p2[1]-p0[1],p2[2]-p0[2])<1e-3,'one undo puts it back');
 /* Add point, then a click on the canvas */
 await p.evaluate(()=>{__gs.g3.arm=true;});const c=[st.x+sp[0][0]+40,st.y+sp[0][1]+10];await p.mouse.click(c[0],c[1]);await W(500);
 ok(await p.evaluate(()=>__gs.doc.active.fill.g3.pts.length===3&&!__gs.g3.arm),'Add point + a click on the canvas adds a point');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
