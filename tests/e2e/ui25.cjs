/* 0.25: undo default, big brushes, each tool its own brush, mirror in the 3D bar, Stencils tab, shortcut groups, welcome screen, 3D Paint layer to Paint and back. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.removeItem('gs.heal');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);
 ok(await p.evaluate(()=>__gs.undoSteps()===30),'fewer undo steps by default (30 in the browser, 50 in the desktop app)');
 /* big brushes */
 await p.evaluate(()=>{__gs.setTool('brush');});await p.mouse.move(700,500);for(let i=0;i<80;i++)await p.keyboard.press(']');
 let sz=await p.evaluate(()=>__gs.brush.size);ok(sz===5000,'] grows the brush up to 5000 px '+sz);
 await p.evaluate(()=>{__gs.prefs.maxBrush=20000;});for(let i=0;i<20;i++)await p.keyboard.press(']');sz=await p.evaluate(()=>__gs.brush.size);ok(sz>5000,'…and past it with the Preferences setting '+sz);
 await p.evaluate(()=>{__gs.prefs.maxBrush=0;});
 /* each tool its own brush */
 await p.evaluate(()=>{__gs.setTool('brush');__gs.brush.size=30;__gs.brush.opacity=.5;__gs.setTool('erase');__gs.brush.size=80;__gs.brush.opacity=1;__gs.setTool('brush');});
 let bs=await p.evaluate(()=>[__gs.brush.size,__gs.brush.opacity]);ok(bs[0]===30&&bs[1]===.5,'the brush keeps its own size and opacity '+bs);
 bs=await p.evaluate(()=>{__gs.setTool('erase');return [__gs.brush.size,__gs.brush.opacity];});ok(bs[0]===80&&bs[1]===1,'…and the eraser its own '+bs);
 await p.evaluate(()=>__gs.setTool('brush'));await p.evaluate(()=>__gs.showPanel('tool'));await W(200);
 await p.click('label[for=bShareTip]');await W(100);
 bs=await p.evaluate(()=>{__gs.brush.angle=40;__gs.setTool('erase');return [__gs.brush.angle,__gs.brush.size];});ok(bs[0]===40&&bs[1]===80,'All tools share the brush tip: the tip goes along, the size stays per tool '+bs);
 await p.evaluate(()=>__gs.setTool('brush'));await p.click('label[for=bShareTip]');
 ok(await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gs.toolBrush'));return s.slots.erase.size===80;}),'each tool’s brush is remembered for next time');
 /* 3D Paint: mirror in the view's top bar, Stencils beside Brushes */
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 ok(await p.evaluate(()=>!!document.querySelector('.v3bar #v3Mir #mir3_x')&&!document.querySelector('#p3dBody #mir3Box')&&!document.querySelector('#p3dBody #st3Box')),'the mirror is in the 3D view’s top bar, not the panel');
 await p.click('#mir3_x');await W(150);ok(await p.evaluate(()=>__gs.mir3.x===true&&document.querySelector('#mir3_x').classList.contains('on')),'X in the bar turns the mirror on');
 await p.click('#mir3More');await W(150);ok(await p.evaluate(()=>!document.querySelector('#v3MirPop').hidden&&!!document.querySelector('#v3MirPop #mir3o_x')),'▾ opens the plane settings');
 await p.selectOption('#mir3Rad','6');await W(100);ok(await p.evaluate(()=>__gs.mir3.radial===6),'radial copies from the bar');
 await p.evaluate(()=>{__gs.mir3.x=false;__gs.mir3.radial=0;});
 await p.evaluate(()=>__gs.showPanel('brushes'));await W(300);
 ok(await p.evaluate(()=>{const b=document.querySelector('#stBrush');return !!b&&!b.hidden&&!!b.querySelector('#stUse');}),'Stencils is a switch inside Brushes');
 ok(await p.evaluate(()=>!__gs.dk.L.shelf.tabs.includes('stencils')),'…with no tab of its own');
 /* a 3D Paint layer to the Paint canvas and back */
 const fillBase=(name,c)=>p.evaluate(([name,c])=>{const L=__gs.allLayers().find(l=>l.name===name),T=__gs.mapT(L,'base'),n=T.w,m=T.h,g=document.querySelector('#gl').getContext('webgl2'),px=new Uint8Array(n*m*4);for(let i=0;i<n*m;i++)px.set(c,i*4);
   const T8=__gs.makeTarget(n,m,8,false);g.bindTexture(g.TEXTURE_2D,T8.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,n,m,g.RGBA,g.UNSIGNED_BYTE,px);__gs.copyScaled(T8,T);T.empty=false;L.lookVer=(L.lookVer||0)+1;__gs.requestRender(true);},[name,c]);
 const baseAt=name=>p.evaluate(name=>{const L=__gs.allLayers().find(l=>l.name===name);const d=__gs.readRGBA8(__gs.mapT(L,'base'));return Array.from(d.slice(0,4));},name);
 await fillBase('Paint',[220,30,30,255]);await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.doc.active=L;__gs.doc.sel=new Set([L]);L.opacity=.7;__gs.act('addMask');__gs.showPanel('layers');__gs.renderLayers();});await W(300);
 await p.click('#layerList .lrow:has(.lname:text-is("Paint"))',{button:'right'});await W(150);await p.click('#menuPop .mi:has-text("Edit in the Paint canvas")');await W(1200);
 let rt=await p.evaluate(()=>({mode:__gs.mode,has:__gs.allLayers().some(l=>l.name==='Paint (from 3D Paint)')}));ok(rt.mode==='paint'&&rt.has,'Edit in the Paint canvas opens the layer in Paint '+JSON.stringify(rt));
 let c=await baseAt('Paint (from 3D Paint)');ok(c[0]>200&&c[1]<60,'…with its content '+c);
 await fillBase('Paint (from 3D Paint)',[30,40,220,255]);await W(200);
 await p.click('#layerList .lrow:has(.lname:text-is("Paint (from 3D Paint)"))',{button:'right'});await W(150);await p.click('#menuPop .mi:has-text("Send back to 3D Paint")');await W(1500);
 rt=await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');return {mode:__gs.mode,op:L&&L.opacity,mask:!!(L&&L.mask)};});ok(rt.mode==='p3d'&&rt.op===.7&&rt.mask,'Send back returns to 3D Paint, keeping the layer’s opacity and mask '+JSON.stringify(rt));
 c=await baseAt('Paint');ok(c[2]>200&&c[0]<60,'…with the edits from Paint '+c);
 await p.keyboard.press('Control+z');await W(500);c=await baseAt('Paint');ok(c[0]>200,'one undo brings the original back '+c);
 /* keyboard shortcuts in categories, with a warning when a key is taken */
 await p.evaluate(()=>__gs.act('keys'));await W(300);
 ok(await p.evaluate(()=>document.querySelectorAll('.kbcats .kbcat').length>=10),'the shortcuts editor lists categories');
 await p.click('.kbcat[data-cat="tools-paint"]');await W(100);
 let rows=await p.evaluate(()=>[...document.querySelectorAll('.kblist .kbrow span:first-child')].map(s=>s.textContent));
 ok(rows.includes('Healing brush')&&rows.includes('Clone stamp')&&!rows.includes('Marquee'),'Painting tools shows just those '+rows.join());
 await p.locator('.kbrow[data-id="tool:clone"] .kbkey').click();await p.keyboard.press('b');await W(150);
 ok(await p.evaluate(()=>!!document.querySelector('#kbClash')&&/used by “Brush”/.test(document.querySelector('#kbClash').textContent)),'a key already in use asks first');
 await p.click('#kbUseHere');await W(150);
 ok(await p.evaluate(()=>__gs.kbKeyOf('tool:clone')==='B'&&__gs.kbKeyOf('tool:brush')===''),'Use it here moves the key');
 await p.evaluate(()=>{localStorage.removeItem('gs.keys');});await p.click('#dlgCancel');await W(200);
 ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?fails+" FAILED":"ALL PASSED");process.exit(fails?1:0);
})();
