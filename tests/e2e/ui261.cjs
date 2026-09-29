/* 0.26.1 polish: no accidental reload, Tab, rulers and guides, autosave countdown, safe 8/16-bit switch, and more. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
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
 const W=ms=>p.waitForTimeout(ms||150);
 const scr=async(x,y)=>{const box=await p.locator('#gl').boundingBox();const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const comp=(pts)=>p.evaluate((pts)=>{const t=__gs.compositeMap('base'),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},pts);
 await p.evaluate(()=>{localStorage.removeItem('gs.rulers');__gs.newDoc(256,256,8,[1,1,1],'T',false);});await W(300);
 /* no accidental reload */
 await p.evaluate(()=>{window.__alive=1;});
 await p.mouse.move(700,500);await p.keyboard.press('F5');await W(300);
 ok(await p.evaluate(()=>window.__alive===1),'F5 does not reload the app');
 await p.keyboard.press('Control+r');await W(300);
 ok(await p.evaluate(()=>window.__alive===1&&__gs.rl().on),'Ctrl+R shows the rulers instead of reloading');
 ok(await p.isVisible('.ruler.rh')&&await p.isVisible('.ruler.rv'),'…the top and left rulers are there');
 /* Tab does not walk the buttons */
 await p.evaluate(()=>document.activeElement&&document.activeElement.blur());const f0=await p.evaluate(()=>document.activeElement&&document.activeElement.tagName);
 await p.keyboard.press('Tab');await p.keyboard.press('Tab');const f1=await p.evaluate(()=>document.activeElement&&document.activeElement.tagName);
 ok(f0===f1,'Tab does not move through the interface '+f0+' '+f1);
 /* dragging does not highlight interface text */
 ok(await p.evaluate(()=>{const ev=new Event('selectstart',{bubbles:true,cancelable:true});document.querySelector('.sec-h').dispatchEvent(ev);return ev.defaultPrevented;}),'interface text cannot be highlighted by dragging');
 /* guides: drag one out of the top ruler */
 const rh=await p.locator('.ruler.rh').boundingBox();const [gx,gy]=await scr(128,100);
 await p.mouse.move(rh.x+200,rh.y+10);await p.mouse.down();await p.mouse.move(rh.x+200,gy,{steps:6});await p.mouse.up();await W(200);
 let G=await p.evaluate(()=>__gs.doc.guides.slice());ok(G.length===1&&G[0].o==='h'&&Math.abs(G[0].p-100)<=1,'dragging from the top ruler makes a horizontal guide '+JSON.stringify(G));
 const rv=await p.locator('.ruler.rv').boundingBox();const [vx]=await scr(60,0);
 await p.mouse.move(rv.x+10,rv.y+200);await p.mouse.down();await p.mouse.move(vx,rv.y+200,{steps:6});await p.mouse.up();await W(200);
 G=await p.evaluate(()=>__gs.doc.guides.slice());ok(G.length===2&&G[1].o==='v'&&Math.abs(G[1].p-60)<=1,'…and from the left ruler a vertical one '+JSON.stringify(G));
 /* snapping */
 await p.evaluate(()=>__gs.setTool('marquee'));
 let sn=await p.evaluate(()=>{const z=__gs.view.zoom;return __gs.gdSnap(60+3/z,100-3/z);});ok(Math.abs(sn[0]-60)<1e-6&&Math.abs(sn[1]-100)<1e-6,'points near guides snap onto them '+sn);
 sn=await p.evaluate(()=>__gs.gdSnap(150,180));ok(sn[0]===150&&sn[1]===180,'…points far away do not');
 /* marquee snaps */
 const a=await scr(62,102),c=await scr(180,200);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:6});await p.mouse.up();await W(300);
 const sp=await p.evaluate(()=>{const d=__gs.selPixels();const W=__gs.doc.w,at=(x,y)=>d[y*W+x];return [at(60,100),at(59,100),at(60,99)];});
 ok(sp[0]>128&&sp[1]<128&&sp[2]<128,'a selection drawn near guides starts exactly on them '+sp);
 await p.keyboard.press('Control+d');await W(100);
 /* move a guide with the Move tool, undo, delete by dragging onto the ruler */
 await p.evaluate(()=>__gs.setTool('move'));const [hx,hy]=await scr(128,100),[hx2,hy2]=await scr(128,150);
 await p.mouse.move(hx,hy);await p.mouse.down();await p.mouse.move(hx2,hy2,{steps:6});await p.mouse.up();await W(200);
 G=await p.evaluate(()=>__gs.doc.guides.slice());ok(Math.abs(G[0].p-150)<=1,'the Move tool drags a guide '+JSON.stringify(G));
 await p.keyboard.press('Control+z');await W(300);G=await p.evaluate(()=>__gs.doc.guides.slice());ok(Math.abs(G[0].p-100)<=1,'…undo puts it back');
 await p.mouse.move(hx,hy);await p.mouse.down();await p.mouse.move(hx,rh.y+5,{steps:6});await p.mouse.up();await W(200);
 G=await p.evaluate(()=>__gs.doc.guides.slice());ok(G.length===1&&G[0].o==='v','dragging a guide back onto the ruler deletes it');
 /* guides in files; Ctrl+; hides them */
 const kept=await p.evaluate(async()=>{__gs.doc.dpi=300;const b=await __gs.encodeGouache();__gs.doc.guides=[];await __gs.openGouache(await b.arrayBuffer(),'x.gouache');return [__gs.doc.guides.length,__gs.doc.dpi];});
 ok(kept[0]===1&&kept[1]===300,'guides and the resolution are saved in .gouache files '+kept);
 await p.keyboard.press('Control+;');ok(await p.evaluate(()=>!__gs.rl().show),'Ctrl+; hides the guides');await p.keyboard.press('Control+;');
 await p.evaluate(()=>{__gs.rl().unit='in';});await W(100);ok(await p.evaluate(()=>__gs.rl().unit==='in'),'rulers can measure in inches');
 await p.screenshot({path:'/tmp/claude-0/-home-user-gouache-studio/b50c4247-fe44-5859-b749-7be7a4db9b43/scratchpad/rulers.png'});
 await p.evaluate(()=>{__gs.rl().unit='px';});
 await p.keyboard.press('Control+r');ok(await p.evaluate(()=>!__gs.rl().on),'Ctrl+R hides the rulers again');
 /* 8 / 16 bit */
 await p.evaluate(()=>{__gs.setTool('brush');__gs.brush.size=30;});const s0=await scr(40,128),s1=await scr(200,128);await p.mouse.move(s0[0],s0[1]);await p.mouse.down();await p.mouse.move(s1[0],s1[1],{steps:8});await p.mouse.up();await W(400);
 const before=await comp([[128,128],[10,10]]);await p.evaluate(()=>__gs.setDepth(16));await W(300);const mid=await comp([[128,128],[10,10]]);await p.evaluate(()=>__gs.setDepth(8));await W(300);const after=await comp([[128,128],[10,10]]);
 ok(JSON.stringify(before)===JSON.stringify(mid)&&JSON.stringify(before)===JSON.stringify(after)&&await p.evaluate(()=>__gs.doc.depth===8),'switching 8 → 16 → 8 bit keeps the picture '+JSON.stringify([before,mid,after]));
 /* autosave countdown */
 await p.mouse.move(s0[0],s0[1]+40);await p.mouse.down();await p.mouse.move(s1[0],s1[1]+40,{steps:6});await p.mouse.up();await W(300);
 await p.evaluate(()=>{__gs.prefs.autosaveWarn=3;});ok(await p.evaluate(()=>__gs.asPending()),'there are unsaved changes to autosave');
 await p.evaluate(()=>__gs.asCountdown());await W(200);ok(await p.isVisible('.ascount'),'a countdown shows before autosaving');
 const t1=await p.textContent('.ascount b');await W(1100);const t2=await p.textContent('.ascount b');ok(+t2===+t1-1,'…counting down '+t1+' → '+t2);
 await p.click('.ascount button:has-text("Not now")');ok(!(await p.isVisible('.ascount')),'Not now puts it off');
 await p.evaluate(()=>__gs.asCountdown());await W(3600);ok(!(await p.isVisible('.ascount'))&&!(await p.evaluate(()=>__gs.asPending())),'…otherwise it autosaves when it reaches zero');
 /* the layer buttons stay put when a layer is deleted */
 await p.evaluate(()=>{__gs.showPanel('layers');for(let i=0;i<4;i++)__gs.act('addLayer');});await W(300);
 const y0=(await p.locator('.lbtns.icons').boundingBox()).y;await p.evaluate(()=>{__gs.act('delLayer');__gs.act('delLayer');__gs.act('delLayer');});await W(300);
 const y1=(await p.locator('.lbtns.icons').boundingBox()).y;ok(Math.abs(y1-y0)<1,'the layer buttons stay at the bottom of the panel when layers are deleted '+y0+' '+y1);
 /* undo presses while one is busy are kept, not lost */
 const nU=await p.evaluate(async()=>{const n=__gs.hist.undo.length;__gs.undo();__gs.undo();__gs.undo();await new Promise(r=>setTimeout(r,400));return n-__gs.hist.undo.length;});ok(nU===3,'three quick undos undo three steps '+nU);
 await p.screenshot({path:'/tmp/claude-0/-home-user-gouache-studio/b50c4247-fe44-5859-b749-7be7a4db9b43/scratchpad/ui261b.png'});
 /* big-canvas speed-ups: while painting (with symmetry) only the new parts are composited, and the result matches a full redraw */
 await p.evaluate(()=>{__gs.newDoc(512,512,8,[1,1,1],'Perf',false);for(let i=0;i<2;i++)__gs.act('addLayer');__gs.act('symX');__gs.setTool('brush');__gs.brush.size=24;});await W(300);
 {const a=await scr(60,100),c=await scr(200,300);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:10});await W(300);
  const same=await p.evaluate(()=>{const A=__gs.readRGBA8(__gs.compOut()),t=__gs.compositeMap('base'),B=__gs.readRGBA8(t);__gs.release(t);let d=0,n=0;for(let i=0;i<A.length;i++){const e=Math.abs(A[i]-B[i]);if(e>d)d=e;if(e>2)n++;}return [d,n];});
  ok(await p.evaluate(()=>__gs.compStats().parts>0),'…the quick partial redraw was used');
  ok(same[1]===0,'while painting with symmetry, the quick partial redraw matches a full one '+same);
  const mir=await p.evaluate(()=>{const A=__gs.readRGBA8(__gs.compOut()),W=__gs.doc.w,at=(x,y)=>A[(y*W+x)*4+1];return [at(130,200),at(511-130,200)];});
  await p.mouse.up();await W(400);
  const fin=await p.evaluate(()=>{const t=__gs.compositeMap('base'),A=__gs.readRGBA8(t),W=__gs.doc.w,at=(x,y)=>A[(y*W+x)*4+1];__gs.release(t);return [at(130,200),at(511-130,200)];});
  ok(mir[0]<200&&mir[1]<200&&fin[0]===mir[0]&&fin[1]===mir[1],'…both sides are painted and stay the same after the stroke '+mir+' '+fin);
  await p.keyboard.press('Control+z');await W(300);const un=await p.evaluate(()=>{const t=__gs.compositeMap('base'),A=__gs.readRGBA8(t);__gs.release(t);let n=0;for(let i=0;i<A.length;i+=4)if(A[i+1]<250)n++;return n;});
  ok(un===0,'…and undo takes the whole stroke back '+un);
  await p.evaluate(()=>__gs.act('symX'));}
 /* Photoshop-style locks */
 await p.evaluate(()=>{__gs.newDoc(256,256,8,[1,1,1],'Locks',false);__gs.showPanel('layers');__gs.setTool('brush');__gs.brush.size=30;});await W(300);
 ok(await p.isVisible('#lock_alpha')&&await p.isVisible('#lock_px')&&await p.isVisible('#lock_pos')&&await p.isVisible('#lock_all'),'four lock buttons in the Layers panel');
 await p.click('#lock_px');await W(100);
 const pxHash=()=>p.evaluate(()=>{const t=__gs.compositeMap('base'),d=__gs.readRGBA8(t);__gs.release(t);let h=0;for(let i=0;i<d.length;i+=5)h=(h*31+d[i])|0;return h;});
 let h0=await pxHash();{const a=await scr(40,128),c=await scr(200,128);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:6});await p.mouse.up();await W(300);}
 ok(await pxHash()===h0&&/locked/.test(await p.textContent('#toast')),'a pixel-locked layer cannot be painted, and says why');
 await p.evaluate(()=>__gs.act('invert'));await W(200);ok(await pxHash()===h0,'…nor inverted or filtered');
 await p.click('#lock_px');await p.click('#lock_pos');await W(100);
 await p.keyboard.press('Control+t');await W(200);ok(await p.evaluate(()=>!__gs.xf||!__gs.xf()),'a position-locked layer cannot be transformed');
 {const a=await scr(40,128),c=await scr(200,128);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:6});await p.mouse.up();await W(300);}
 ok(await pxHash()!==h0,'…but can still be painted');
 await p.click('#lock_pos');await p.click('#lock_all');const lk=await p.evaluate(async()=>{const b=await __gs.encodeGouache();__gs.doc.root.children[0].lockAll=false;await __gs.openGouache(await b.arrayBuffer(),'l.gouache');return __gs.doc.root.children[0].lockAll;});
 ok(lk===true,'locks are saved in .gouache files');
 /* New document presets */
 await p.evaluate(()=>__gs.act('new'));await W(300);
 await p.selectOption('#modal select[aria-label=Preset]',{label:'Letter (8.5 × 11 in)'});await W(100);
 ok(await p.evaluate(()=>document.querySelector('#modal select[aria-label=Units]').value==='in'&&document.querySelector('#dW').value==='8.5'),'the Letter preset fills in 8.5 × 11 inches at 300 DPI');
 await p.click('#dlgOk');await W(500);const nd=await p.evaluate(()=>[__gs.doc.w,__gs.doc.h,__gs.doc.dpi]);ok(nd[0]===2550&&nd[1]===3300&&nd[2]===300,'…making a 2550 × 3300 px canvas '+nd);
 await p.evaluate(()=>__gs.act('new'));await W(300);await p.selectOption('#modal select[aria-label=Preset]',{label:'Full HD 1080p (16:9)'});await p.click('#modal button[aria-label="Swap width and height"]');
 ok(await p.evaluate(()=>document.querySelector('#dW').value==='1080'&&document.querySelector('#dH').value==='1920'),'⇄ swaps to portrait');await p.click('#dlgCancel');
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'T2',false));await W(200);
 /* shortcut helper */
 await p.mouse.move(700,500);await p.keyboard.down('Control');await W(800);
 ok(await p.isVisible('.khcard')&&/Undo/.test(await p.textContent('.khcard')),'holding Ctrl shows its shortcuts');
 await p.keyboard.up('Control');await W(100);ok(!(await p.isVisible('.khcard')),'…and letting go hides them');
 await p.keyboard.down('Alt');await W(200);await p.mouse.move(760,540,{steps:4});await W(700);ok(!(await p.isVisible('.khcard')),'holding Alt while moving the pointer (picking colours) does not show it');await p.keyboard.up('Alt');
 /* the options bar shows the tip's own shape */
 await p.evaluate(()=>{__gs.usePreset('Sponge');__gs.buildOptBar();});await W(100);
 ok(await p.evaluate(()=>!!__gs.brush.tip&&!!document.querySelector('.optdot.tipimg')),'a textured brush shows its tip shape in the options bar');
 console.log(errs.join('\n'));console.log(fails?'FAILS '+fails:'ALL PASS');await b.close();process.exit(fails?1:0);})();
