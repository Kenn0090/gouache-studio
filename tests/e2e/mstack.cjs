/* 0.23: mask stacks (rows under a layer: paint, fill, noise, generators, filters) and content effects. */
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
 const W=ms=>p.waitForTimeout(ms||150);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:8});await p.mouse.up();await W(150);};
 const setFG=async hx=>{await p.evaluate(()=>__gs.showPanel('color'));await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const comp=(k,pts)=>p.evaluate(([k,pts])=>{const t=__gs.compositeMap(k),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[k,pts]);
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'mstack',false));await W(300);
 await p.evaluate(()=>__gs.act('addLayer'));await W();await setFG('#e02020');await p.evaluate(()=>{document.activeElement.blur();__gs.act('fill');});await W(200);
 const L=()=>'__gs.doc.active';
 const px=(k,x,y)=>comp(k,[[x,y]]).then(r=>r[0]);
 let c=await px('base',64,64);ok(c[0]>200&&c[1]<60,'red layer '+c);
 /* a white Fill row: a mask with a stack, everything shows */
 await p.evaluate(()=>__gs.msAdd(__gs.doc.active,'fill',{p:{v:1}}));await W(300);
 let st=await p.evaluate(()=>{const A=__gs.doc.active;return {has:!!(A.mask&&A.mask.stack),n:A.mask.stack.length,kinds:A.mask.stack.map(r=>r.kind)};});
 ok(st.has&&st.n===1&&st.kinds[0]==='fill','adding a row makes a mask with a stack '+JSON.stringify(st));
 c=await px('base',64,64);ok(c[0]>200&&c[1]<60,'white fill shows the layer '+c);
 /* a black Fill on top hides it */
 await p.evaluate(()=>__gs.msAdd(__gs.doc.active,'fill',{p:{v:0}}));await W(300);c=await px('base',64,64);ok(c[1]>240,'black fill on top hides it '+c);
 /* multiply at 50%: half */
 await p.evaluate(()=>{const A=__gs.doc.active,r=A.mask.stack[1];__gs.msEdit(A,r,x=>{x.p.v=.5;x.mode='multiply';});});await W(300);
 c=await px('base',64,64);ok(c[1]>100&&c[1]<160,'blend modes and settings are live (multiply 50%) '+c);
 await W(800);ok(await p.evaluate(()=>__gs.hist.undo.slice(-1)[0].label.startsWith('Change')),'a settings change is one undo step');
 await p.keyboard.press('Control+z');await W(300);c=await px('base',64,64);ok(c[1]>240,'undo brings the black fill back '+c);
 await p.keyboard.press('Control+z');await W(300);c=await px('base',64,64);ok(c[1]<60,'undo again removes the row '+c);
 /* noise and a threshold filter */
 await p.evaluate(()=>{__gs.msAdd(__gs.doc.active,'noise',{p:{type:'clouds',scale:4,contrast:3,level:0,seed:3,tri:false,inv:false}});});await W(400);
 const stats=()=>p.evaluate(()=>{const A=__gs.doc.active,d=__gs.readRGBA8(A.mask.target);let lo=0,hi=0,mid=0;for(let i=0;i<d.length;i+=4){if(d[i]<20)lo++;else if(d[i]>235)hi++;else mid++;}return {lo,hi,mid};});
 let s1=await stats();ok(s1.mid>2000,'noise row makes greys '+JSON.stringify(s1));
 await p.evaluate(()=>__gs.msAdd(__gs.doc.active,'filter',{fx:'threshold'}));await W(400);let s2=await stats();ok(s2.mid<s1.mid*.2&&s2.lo>500&&s2.hi>500,'threshold filter above makes it black and white '+JSON.stringify(s2));
 /* a Paint row: painting goes into it; the brush eraser really erases it */
 await p.evaluate(()=>{const A=__gs.doc.active;__gs.msAdd(A,'paint');});await W(200);
 ok(await p.evaluate(()=>{const A=__gs.doc.active,r=__gs.msRowOf(__gs.ui.msSel);return r&&r.kind==='paint'&&A.editMask;}),'a new Paint row is selected and the mask is being edited');
 await setFG('#000000');await p.evaluate(()=>{document.activeElement.blur();__gs.setTool('brush');Object.assign(__gs.brush,{size:30,hardness:1,opacity:1,flow:1,smoothing:0,lazy:0,pSize:false,tip:null});});
 await drag(10,64,50,64);c=await px('base',30,64);ok(c[1]>240,'painting black in the Paint row hides the layer there '+c);
 const onRow=await p.evaluate(()=>{const r=__gs.msRowOf(__gs.ui.msSel),d=__gs.readRGBA8(r.t),W=__gs.doc.w;return [d[(64*W+30)*4+3],d[(64*W+100)*4+3]];});ok(onRow[0]>200&&onRow[1]===0,'the stroke is in the Paint row, the rest of it is clear '+onRow);
 await p.keyboard.press('e');await drag(10,64,50,64);await p.keyboard.press('b');
 ok(await p.evaluate(()=>{const r=__gs.msRowOf(__gs.ui.msSel),d=__gs.readRGBA8(r.t),W=__gs.doc.w;return d[(64*W+30)*4+3]<10;}),'the eraser clears the Paint row');
 /* content effect: invert on the layer's own colour */
 await p.evaluate(()=>{const A=__gs.doc.active;__gs.msRemove(A,'m',A.mask.stack[A.mask.stack.length-2].id);});await W(200);
 await p.evaluate(()=>{const A=__gs.doc.active;for(const r of A.mask.stack)r.on=r.kind==='fill';A.mask._key=null;A.lookVer++;__gs.requestRender(true);});await W(300);
 c=await px('base',64,64);ok(c[0]>200&&c[1]<60,'turning rows off with the eye '+c);
 await p.evaluate(()=>__gs.cfxAdd(__gs.doc.active,'invert'));await W(300);c=await px('base',64,64);ok(c[0]<60&&c[1]>200,'content effect (invert) changes the layer\'s own colour '+c);
 /* generators and direction in the flat texture (no model): they still work */
 await p.evaluate(()=>{const A=__gs.doc.active;__gs.msAdd(A,'gen',{p:{g:'dust',amount:.5,width:.5,breakup:.5,contrast:1.5,scale:6,seed:1,inv:false}});__gs.msAdd(A,'dir');__gs.msAdd(A,'grad');});await W(400);
 ok(await p.evaluate(()=>{const A=__gs.doc.active;return A.mask.stack.length>=5;}),'generator, direction and gradient rows added');
 /* ---- the rows in the Layers panel, FX ▾, Properties ---- */
 await p.evaluate(()=>{for(const g of __gs.dk.L.groups)g.min=!g.tabs.includes('layers')&&!g.tabs.includes('matEd');__gs.showPanel('layers');});await W(300);
 const nrows=await p.evaluate(()=>({rows:document.querySelectorAll('#layerList .msrow').length,m:document.querySelectorAll('#layerList .msrow.m').length,c:document.querySelectorAll('#layerList .msrow.c').length,want:__gs.doc.active.mask.stack.length}));
 ok(nrows.m===nrows.want&&nrows.c===1,'mask rows and the content effect show under the layer '+JSON.stringify(nrows));
 await p.click('#layerList .msrow.m:has-text("Dust on top")');await W(300);
 ok(await p.evaluate(()=>!!document.querySelector('#matEdBody #ms_g')&&document.querySelector('#hMatEd').textContent.includes('Properties')),'clicking a row shows its settings in Properties');
 await p.evaluate(()=>{const s=document.querySelector('#ms_amt input[type=range]')||document.querySelector('#ms_amt');s.value=.9;s.dispatchEvent(new Event('input',{bubbles:true}));});await W(300);
 ok(await p.evaluate(()=>{const r=__gs.msRowOf(__gs.ui.msSel);return r.p.amount>.85;}),'a slider changes the row live');
 await p.evaluate(()=>{__gs.doc.active.editMask=true;});await p.click('#lFxAdd');await W(200);
 ok(await p.evaluate(()=>!document.querySelector('#menuPop').hidden&&document.querySelector('#menuPop').textContent.includes('Generator')),'FX ▾ with the mask selected offers mask rows');
 await p.click('#menuPop .mi:has-text("Generator")');await W(150);await p.click('#menuPop .mi:has-text("Moss")');await W(300);
 ok(await p.evaluate(()=>[...document.querySelectorAll('#layerList .msrow.m .lname')].some(e=>e.textContent==='Moss')),'…and a generator preset lands as a row');
 const order0=await p.evaluate(()=>__gs.doc.active.mask.stack.map(r=>r.kind).join());
 const rA=p.locator('#layerList .msrow.m').first(),rB=p.locator('#layerList .msrow.m').nth(2);const ba=await rA.boundingBox(),bb=await rB.boundingBox();
 await p.mouse.move(ba.x+60,ba.y+ba.height/2);await p.mouse.down();await p.mouse.move(bb.x+60,bb.y+bb.height/2,{steps:6});await p.mouse.up();await W(300);
 ok(await p.evaluate(o=>__gs.doc.active.mask.stack.map(r=>r.kind).join()!==o,order0),'dragging a row reorders the stack');
 await p.screenshot({path:OUT+'mstack-rows.png'});
 await p.click('#layerList .msfold');await W(150);ok(await p.evaluate(()=>document.querySelectorAll('#layerList .msrow').length===0),'▾ folds the rows away');
 await p.click('#layerList .msfold');await W(150);
 /* files: rows and effects come back */
 const before=await p.evaluate(()=>{const A=__gs.doc.active;return {k:A.mask.stack.map(r=>r.kind+':'+r.mode+':'+(r.on!==false)).join(),c:(A.cfx||[]).map(r=>r.fx).join(),m:Array.from(__gs.readRGBA8(A.mask.target).slice(0,40)).join()};});
 await p.evaluate(async()=>{const b=await __gs.encodeGouache();window.__gb=await b.arrayBuffer();});
 await p.evaluate(()=>__gs.newDoc(50,50,8,[1,1,1],'x',false));await p.evaluate(async()=>{await __gs.openGouache(window.__gb,'t');});await W(500);
 const after=await p.evaluate(()=>{const A=__gs.allLayers().find(l=>l.mask);__gs.doc.active=A;__gs.requestRender(true);return {k:A.mask.stack.map(r=>r.kind+':'+r.mode+':'+(r.on!==false)).join(),c:(A.cfx||[]).map(r=>r.fx).join()};});await W(300);
 const m2=await p.evaluate(()=>{const A=__gs.allLayers().find(l=>l.mask);return Array.from(__gs.readRGBA8(A.mask.target).slice(0,40)).join();});
 ok(after.k===before.k&&after.c===before.c,'rows and content effects are saved in the file '+JSON.stringify(after));
 ok(m2===before.m,'the mask comes back the same');
 /* flatten */
 await p.evaluate(()=>__gs.msFlatten(__gs.allLayers().find(l=>l.mask)));await W(200);ok(await p.evaluate(()=>!__gs.allLayers().find(l=>l.mask).mask.stack),'Flatten mask keeps the picture and drops the rows');
 await p.screenshot({path:OUT+'mstack.png'});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
