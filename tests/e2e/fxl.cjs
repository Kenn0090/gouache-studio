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

 await p.evaluate(()=>__gs.newDoc(200,120,8,[.2,.4,.8],'fx',false));
 await setFG('#ffffff');await p.keyboard.press('b');await p.evaluate(()=>{__gs.brush.size=16;__gs.brush.hardness=1;});
 await p.keyboard.press('Control+Shift+n');await drag(20,60,180,60);const PL=await p.evaluate(()=>__gs.doc.active.name);
 const cp=async pts=>p.evaluate(pts=>{const d=__gs.readRGBA8(__gs.compOut()),W=__gs.doc.w;return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},pts);
 const P0=[[100,60],[100,20],[100,69]];const c0=await cp(P0);
 const nl=()=>p.evaluate(()=>__gs.doc.root.children.length);const n0=await nl();
 // + Filter → add Invert → Done
 await p.click('#lFx');await p.waitForTimeout(200);await p.selectOption('#fxAdd','invert');await p.waitForTimeout(250);
 let c1=await cp(P0);ok(c1[1][0]>200&&c1[1][2]<60,'invert filter layer inverts below (live) '+JSON.stringify(c1));
 await p.click('#dlgOk');await p.waitForTimeout(200);ok(await nl()===n0+1,'filter layer added');
 const nm=await p.evaluate(()=>__gs.doc.active.name+'|'+!!__gs.doc.active.fx);ok(nm==='Invert|true','named and active '+nm);
 await p.keyboard.press('Control+z');await p.waitForTimeout(200);ok(await nl()===n0,'undo removes filter layer');let c2=await cp(P0);ok(JSON.stringify(c2)===JSON.stringify(c0),'back to original');
 await p.keyboard.press('Control+Shift+Z');await p.waitForTimeout(200);
 // painting on filter layer is refused
 await drag(30,100,60,100);const h=await p.evaluate(()=>__gs.hist.undo[__gs.hist.undo.length-1].label);ok(h!=='Brush stroke','cannot paint on filter layer ('+h+')');
 // edit: add blur to stack, turn invert off
 await p.evaluate(()=>{const L=__gs.doc.active;__gs.act('editFx');});await p.waitForTimeout(200);
 await p.selectOption('#fxAdd','blur');await p.waitForTimeout(200);
 await p.click('.fxitem >> nth=0 >> .eye');await p.waitForTimeout(200);await p.screenshot({path:OUT+'fxed.png'});await p.waitForTimeout(250);
 let c3=await cp([[100,53]]);ok(c3[0][0]<200&&c3[0][0]>60,'blur only (invert off) '+JSON.stringify(c3));
 await p.click('#dlgOk');await p.waitForTimeout(200);
 await p.keyboard.press('Control+z');await p.waitForTimeout(200);let c4=await cp(P0);ok(JSON.stringify(c4)===JSON.stringify(c1),'undo edit restores invert-only '+JSON.stringify(c4));
 await p.keyboard.press('Control+Shift+Z');await p.waitForTimeout(200);
 // clipped: keep-editable from one-off dialog on the paint layer -> only that layer
 await p.evaluate((PL)=>{const L=__gs.layerByName(PL);__gs.doc.active=L;__gs.doc.sel=new Set([L]);},PL);
 await p.evaluate(()=>__gs.doc.root.children.forEach(n=>{if(n.fx)n.visible=false;}));
 await p.evaluate(()=>__gs.act('hueSat'));await p.waitForTimeout(200);console.log('DBG',await p.evaluate(()=>[document.querySelector('#modal').hidden,document.querySelector('#dlgTitle').textContent,[...document.querySelectorAll('.toast')].map(t=>t.textContent).join('|'),__gs.doc.active.name]));await p.evaluate(()=>{const s=document.querySelector('#fx_h');s.value=120;s.dispatchEvent(new Event('input'));});
 await p.check('#fxKeep');await p.click('#dlgOk');await p.waitForTimeout(300);
 const cl=await p.evaluate(()=>({clip:__gs.doc.active.clip,fx:!!__gs.doc.active.fx}));ok(cl.clip&&cl.fx,'keep editable -> clipped filter layer');
 let c5=await cp([[100,20],[100,60]]);ok(Math.abs(c5[0][2]-c0[1][2])<3,'background untouched by clipped filter '+JSON.stringify([c5,c0]));
 // stroke on the clipped base shows through filter live
 // pattern layer
 await p.evaluate((PL)=>{const L=__gs.layerByName(PL);__gs.doc.active=L;__gs.doc.sel=new Set([L]);},PL);
 await p.click('#lFx');await p.waitForTimeout(150);await p.selectOption('#fxAdd','cells');await p.waitForTimeout(250);await p.click('#dlgOk');await p.waitForTimeout(200);
 // merge down of clipped hue layer: select it
 // save + reopen .gouache keeps filter layers
 const names=await p.evaluate(()=>__gs.doc.root.children.map(n=>n.name+(n.fx?'*':'')).join(','));
 await p.evaluate(async()=>{const b=await __gs.encodeGouache();window.__gbuf=await b.arrayBuffer();});
 const cA=await cp([[100,60],[50,20]]);
 await p.evaluate(()=>__gs.newDoc(50,50,8,[1,1,1],'x',false));await p.evaluate(async()=>{await __gs.openGouache(window.__gbuf,'t');});await p.waitForTimeout(400);
 const names2=await p.evaluate(()=>__gs.doc.root.children.map(n=>n.name+(n.fx?'*':'')).join(','));const cB=await cp([[100,60],[50,20]]);
 ok(names===names2&&JSON.stringify(cA)===JSON.stringify(cB),'gouache roundtrip '+names+' / '+names2+' '+JSON.stringify([cA,cB]));
 // PSD export does not crash
 const ps=await p.evaluate(async()=>{const b=await __gs.encodePSD();return b.size;});ok(ps>1000,'psd export '+ps);
 // live converter layer: PBR doc, curvature from height live, paint height -> updates
 await p.keyboard.press('Control+Alt+n');await p.waitForTimeout(200);await p.fill('#dW','128');await p.fill('#dH','96');await p.click('button.chip:has-text("PBR")');await p.click('#dlgOk');await p.waitForTimeout(300);
 await setFG('#808080');await p.keyboard.press('Alt+Backspace');await p.evaluate(()=>__gs.dlgConvert('curvFromHeight'));await p.waitForTimeout(200);await p.check('#cvLive');await p.click('#dlgOk');await p.waitForTimeout(300);
 const lv=await p.evaluate(()=>({fx:!!__gs.doc.active.fx,map:__gs.doc.map}));ok(lv.fx&&lv.map==='curv','live curvature layer in the Curvature map '+JSON.stringify(lv));
 const q0=await p.evaluate(()=>{const t=__gs.compositeMap('curv'),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return Array.from(d.slice((28*W+64)*4,(28*W+64)*4+4));});
 await p.evaluate(()=>{const L=__gs.layerByName('Background');__gs.doc.active=L;__gs.doc.sel=new Set([L]);});await p.keyboard.press('Shift+Alt+4');await p.keyboard.press('b');await setFG('#ffffff');await p.evaluate(()=>{__gs.brush.size=40;__gs.brush.hardness=.9;__gs.brush.pSize=false;});await drag(64,48,65,48);await p.keyboard.press('Shift+Alt+1');await p.waitForTimeout(300);
 const q1=await p.evaluate(()=>{const t=__gs.compositeMap('curv'),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return Array.from(d.slice((28*W+64)*4,(28*W+64)*4+4));});
 console.log('DBG2',await p.evaluate(()=>{const t=__gs.compositeMap('height'),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return [Array.from(d.slice((48*W+64)*4,(48*W+64)*4+4)),Array.from(d.slice((28*W+64)*4,(28*W+64)*4+4)),__gs.doc.root.children.map(n=>n.name+(n.fx?JSON.stringify(n.fx):'')+n.visible+n.opacity)];}));
 ok(JSON.stringify(q0)!==JSON.stringify(q1),'live curvature follows height '+JSON.stringify([q0,q1]));
 await p.screenshot({path:OUT+'fxl.png'});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
