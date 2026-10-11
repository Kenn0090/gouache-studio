/* 0.55.1: dragging over the eyes hides/shows layers; symmetry belongs to each document; radial rays can be typed; Reset centre;
   Liquify follows symmetry; Undo can cover symmetry settings; New document and Recent files look tidy. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1500}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:30000});
 await p.waitForTimeout(800);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 // ---- drag over the eyes
 await p.evaluate(()=>{const G=__gs;G.newDoc(256,256,8,[1,1,1],'Eyes',false,'hand');});await p.waitForTimeout(300);
 for(let i=0;i<4;i++){await p.evaluate(()=>document.querySelector('#lAdd')?.click());await p.waitForTimeout(150);}
 const n=await p.evaluate(()=>document.querySelectorAll('#layerList .eye, .layerlist .eye, .eye').length);
 ok(n>=4,'there are layers with eyes ('+n+')');
 const pos=await p.evaluate(()=>[...document.querySelectorAll('.eye')].map(e=>{const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];}));
 await p.mouse.move(pos[0][0],pos[0][1]);await p.mouse.down();
 for(let i=1;i<2;i++)await p.mouse.move(pos[i][0],pos[i][1],{steps:4});
 await p.mouse.up();await p.waitForTimeout(200);
 const vis=await p.evaluate(()=>[...document.querySelectorAll('.eye')].slice(0,2).map(e=>e.classList.contains('off')));
 ok(vis.every(x=>x===true),'press an eye and drag down: every layer passed is hidden ('+vis+')');
 const pos2=await p.evaluate(()=>[...document.querySelectorAll('.eye')].map(e=>{const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];}));
 await p.mouse.move(pos2[0][0],pos2[0][1]);await p.mouse.down();for(let i=1;i<2;i++)await p.mouse.move(pos2[i][0],pos2[i][1],{steps:4});await p.mouse.up();await p.waitForTimeout(200);
 const vis2=await p.evaluate(()=>[...document.querySelectorAll('.eye')].slice(0,2).map(e=>e.classList.contains('off')));
 ok(vis2.every(x=>x===false),'and the same drag shows them again ('+vis2+')');
 await p.mouse.click(pos2[1][0],pos2[1][1]);await p.waitForTimeout(200);
 ok(await p.evaluate(()=>document.querySelectorAll('.eye')[1].classList.contains('off')),'a plain click still toggles one layer');
 // ---- symmetry belongs to the document
 const s1=await p.evaluate(()=>{const G=__gs;G.setSym('radial');G.ui.sym.n=9;G.ui.sym.cx=.3;return G.ui.sym.mode;});
 await p.evaluate(()=>{__gs.dtNewTab();__gs.newDoc(256,256,8,[1,1,1],'Second',false,'hand');});await p.waitForTimeout(500);
 const s2=await p.evaluate(()=>({m:__gs.ui.sym.mode,n:__gs.ui.sym.n,cx:__gs.ui.sym.cx}));
 ok(s1==='radial'&&s2.m==='off'&&s2.cx===.5,'a new document starts with symmetry off ('+JSON.stringify(s2)+')');
 await p.evaluate(()=>{__gs.setSym('xy');});
 const first=await p.evaluate(()=>{const G=__gs;G.dtActivate(G.dtab().tabs[0].id);return {m:G.ui.sym.mode,n:G.ui.sym.n,cx:G.ui.sym.cx};});await p.waitForTimeout(500);
 ok(first.m==='radial'&&first.n===9&&first.cx===.3,'switching back to the first tab brings its own symmetry back ('+JSON.stringify(first)+')');
 // ---- rays and reset
 await p.evaluate(()=>{__gs.setTool('brush');__gs.buildBrushPanel();});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!document.getElementById('symNum')),'Radial symmetry has a box for any number of rays');
 await p.fill('#symNum','40');await p.dispatchEvent('#symNum','change');
 ok(await p.evaluate(()=>__gs.ui.sym.n)===40,'40 rays can be typed');
 ok(await p.evaluate(()=>__gs.symCopies(__gs.symFor(null),256,256,100,100,0,1,1,0,0).length)===40,'and the brush makes 40 copies');
 await p.click('#symReset');ok(await p.evaluate(()=>__gs.ui.sym.cx)===.5,'Reset centre puts the centre back in the middle');
 // ---- undo covers symmetry only when switched on
 const hl=()=>p.evaluate(()=>__gs.hist.undo.length);
 let h0=await hl();await p.evaluate(()=>{__gs.ui.sym.cx=.2;});await p.evaluate(()=>__gs.setSym('x'));
 ok(await hl()===h0,'by default a symmetry change is not an undo step');
 await p.evaluate(()=>{__gs.prefs.undoSettings=true;});h0=await hl();await p.evaluate(()=>__gs.setSym('y'));
 ok(await hl()===h0+1,'with the preference on, it is');
 await p.evaluate(()=>__gs.undo());ok(await p.evaluate(()=>__gs.ui.sym.mode)==='x','and Undo puts the symmetry back ('+await p.evaluate(()=>__gs.ui.sym.mode)+')');
 // ---- each document keeps its own brushes
 const bt=await p.evaluate(async()=>{const G=__gs;G.setTool('brush');G.brush.size=77;G.brush.opacity=.4;const t0=G.dtab().tabs[0].id;
   G.dtNewTab();G.newDoc(256,256,8,[1,1,1],'Third',false,'hand');G.dtab&&0;await new Promise(r=>setTimeout(r,300));const fresh={s:G.brush.size,o:G.brush.opacity};
   G.brush.size=33;G.dtActivate(t0);await new Promise(r=>setTimeout(r,300));return {fresh,back:{s:G.brush.size,o:G.brush.opacity}};});
 ok(bt.fresh.s===24&&bt.fresh.o===1,'a new document starts with the starting brush ('+JSON.stringify(bt.fresh)+')');
 ok(bt.back.s===77&&Math.abs(bt.back.o-.4)<.01,'and going back to the first one brings its own brush back ('+JSON.stringify(bt.back)+')');
 // ---- undo covers brush settings and colour when switched on
 await p.evaluate(()=>{__gs.prefs.undoSettings=true;});await p.waitForTimeout(800);
 let u0=await hl();await p.evaluate(()=>{__gs.brush.size=120;});await p.waitForTimeout(1900);
 ok(await hl()===u0+1,'with the preference on, a brush size change becomes an undo step');
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(300);ok(await p.evaluate(()=>__gs.brush.size)===77,'and Undo gives the old size back ('+await p.evaluate(()=>__gs.brush.size)+')');
 u0=await hl();await p.evaluate(()=>{__gs.ui.fg=[.1,.8,.2];});await p.waitForTimeout(1900);
 ok(await hl()===u0+1,'a colour change is an undo step too');
 await p.evaluate(()=>{__gs.prefs.undoSettings=false;});
 // ---- liquify follows symmetry
 await p.evaluate(()=>{const G=__gs;G.prefs.undoSettings=false;G.ui.sym.mode='x';G.ui.sym.n=6;G.ui.sym.cx=.5;G.ui.sym.cy=.5;G.setTool('liquify');});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!document.getElementById('symCx')),'the Liquify panel shows the symmetry settings');
 // ---- dialogs
 await p.evaluate(()=>__gs.dlgNew());await p.waitForTimeout(400);
 ok(await p.evaluate(()=>document.querySelectorAll('.dlg-new .dsec .dsec-h').length)===3,'New document has three titled sections');
 await p.evaluate(()=>__gs.closeDialog());
 await p.evaluate(()=>{__gs.platform.recentDetails=async()=>[{path:'C:\\a\\one.gouache',t:Date.now()-5000},{path:'C:\\a\\two.gouache3d',t:Date.now()-9000}];__gs.dlgRecent();});await p.waitForTimeout(500);
 const rr=await p.evaluate(()=>[...document.querySelectorAll('#recentDlg .recentrow')].map(r=>{const o=r.querySelector('.recentopen').getBoundingClientRect(),a=r.querySelector('.btn.sm').getBoundingClientRect();return o.right<=a.left+1&&o.width>150;}));
 ok(rr.length===2&&rr.every(Boolean),'Recent files rows no longer overlap');
 ok(!errs.length,'no errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
