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
 const drag=async(x0,y0,x1,y1,opts={})=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:opts.steps||8});await p.mouse.up();await p.waitForTimeout(80);};
 const dragScr=async(a,c,steps)=>{await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:steps||8});await p.mouse.up();await p.waitForTimeout(80);};
 const px=async(name,pts)=>p.evaluate(([name,pts])=>{const L=__gs.layerByName(name),d=__gs.readRGBA8(L.target),W=__gs.doc.w;return pts.map(([x,y])=>d[(y*W+x)*4+3]);},[name,pts]);
 const menuItem=async(menu,item)=>{await p.click('#menus button:text-is("'+menu+'")');await p.click('#menuPop .mi:has-text("'+item+'")');};
 const setup=async()=>{await p.evaluate(()=>{__gs.newDoc(400,300,8,[1,1,1],'XF',false);});await p.keyboard.press('Control+Shift+N');
   await p.keyboard.press('m');await drag(100,100,200,150);await p.keyboard.press('Alt+Delete');await p.keyboard.press('Control+d');await p.waitForTimeout(50);};
 await setup();
 let v=await px('Layer 2',[[150,125],[99,125],[205,125]]);ok(v.join()==='255,0,0','setup rect '+v);
 // 1. move tool drag
 await p.keyboard.press('v');ok(await p.textContent('#brushTitle')==='Move','move tool panel');
 await drag(150,120,180,140);v=await px('Layer 2',[[225,165],[105,105],[131,121]]);ok(v.join()==='255,0,255','move by 30,20 '+v);
 await p.keyboard.press('Control+z');v=await px('Layer 2',[[105,105],[225,165]]);ok(v.join()==='255,0','undo move '+v);
 await p.keyboard.press('ArrowRight');v=await px('Layer 2',[[100,120],[200,120]]);ok(v.join()==='0,255','arrow nudge 1px '+v);await p.keyboard.press('Control+z');
 // 2. free transform: numeric scale 50%
 await p.keyboard.press('Control+t');ok(await p.textContent('#brushTitle')==='Transform','Ctrl+T opens transform');
 ok(await p.inputValue('#xf_sx')==='100.0'&&await p.inputValue('#xf_x')==='150.0','fields '+await p.inputValue('#xf_sx')+' '+await p.inputValue('#xf_x'));
 await p.fill('#xf_sx','50');await p.press('#xf_sx','Tab');await p.waitForTimeout(80);ok(await p.inputValue('#xf_sy')==='50.0','linked H% '+await p.inputValue('#xf_sy'));
 await p.screenshot({path:OUT+'xf-box.png'});
 await p.locator('#gl').focus().catch(()=>{});await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('Enter');
 v=await px('Layer 2',[[130,125],[120,125],[150,114],[150,110]]);ok(v[0]===255&&v[1]===0&&v[2]===255&&v[3]===0,'scaled to 50% about centre '+v);
 await p.keyboard.press('Control+z');v=await px('Layer 2',[[105,105]]);ok(v[0]===255,'undo transform');
 // 3. Esc cancels
 await p.keyboard.press('Control+t');await p.click('button:text-is("↻ 90°")');v=await px('Layer 2',[[150,170],[105,105]]);ok(v.join()==='255,0','rotate 90 live '+v);
 await p.keyboard.press('Escape');v=await px('Layer 2',[[105,105],[150,170]]);let s=await p.evaluate(()=>!!__gs.xf);ok(v.join()==='255,0'&&!s,'Esc cancels '+v);
 // 4. drag a corner handle (proportional) and rotate outside
 await p.keyboard.press('Control+t');let h=await p.evaluate(()=>__gs.xfHandles().corners.map(c=>__gs.toScreen(c[0],c[1])));
 await dragScr([box.x+h[2][0],box.y+h[2][1]],[box.x+h[2][0]+120,box.y+h[2][1]+30]);
 let d=await p.evaluate(()=>{const q=__gs.xf.q;return [(q[2]-q[0])/100,(q[7]-q[1])/50];});ok(Math.abs(d[0]-d[1])<.01&&d[0]>1.2,'corner drag keeps proportions '+d.map(x=>x.toFixed(3)));
 await p.keyboard.down('Shift');h=await p.evaluate(()=>__gs.xfHandles().corners.map(c=>__gs.toScreen(c[0],c[1])));await dragScr([box.x+h[2][0],box.y+h[2][1]],[box.x+h[2][0]+60,box.y+h[2][1]]);await p.keyboard.up('Shift');
 d=await p.evaluate(()=>{const q=__gs.xf.q;return [(q[2]-q[0])/100,(q[7]-q[1])/50];});ok(Math.abs(d[0]-d[1])>.1,'Shift stretches freely '+d.map(x=>x.toFixed(3)));
 h=await p.evaluate(()=>__gs.xfHandles().corners.map(c=>__gs.toScreen(c[0],c[1])));
 await dragScr([box.x+h[1][0]+40,box.y+h[1][1]-40],[box.x+h[1][0]+80,box.y+h[1][1]+20]);ok(Math.abs(+await p.inputValue('#xf_ang'))>5,'drag outside rotates, angle '+await p.inputValue('#xf_ang'));
 // distort with Ctrl+corner
 h=await p.evaluate(()=>__gs.xfHandles().corners.map(c=>__gs.toScreen(c[0],c[1])));await p.keyboard.down('Control');await dragScr([box.x+h[0][0],box.y+h[0][1]],[box.x+h[0][0]-50,box.y+h[0][1]-40]);await p.keyboard.up('Control');
 ok(await p.isDisabled('#xf_sx'),'distort disables number fields');await p.screenshot({path:OUT+'xf-distort.png'});
 await p.keyboard.press('Enter');s=await p.evaluate(()=>__gs.hist.undo[__gs.hist.undo.length-1].label);ok(s==='Transform','one undo step "Transform" ('+s+')');await p.keyboard.press('Control+z');
 // 5. warp: drag the middle anchor
 await p.keyboard.press('Control+t');await p.click('button:text-is("Warp")');ok(await p.textContent('#brushTitle')==='Warp','warp mode');
 const mid=await p.evaluate(()=>{const W=__gs.xf.warp;return __gs.toScreen(...W.A[2][2]);});
 await dragScr([box.x+mid[0],box.y+mid[1]],[box.x+mid[0],box.y+mid[1]+120],10);
 const hs=await p.evaluate(()=>{const W=__gs.xf.warp;return W.active&&W.active.join();});ok(hs==='2,2','anchor selected shows handles');
 await p.screenshot({path:OUT+'xf-warp.png'});
 v=await px('Layer 2',[[150,165],[150,105]]);ok(v[0]===255,'warp bends content down '+v);
 // drag a curve handle
 const hp=await p.evaluate(()=>{const W=__gs.xf.warp;return __gs.toScreen(...W.hE[2][2][0]);});await dragScr([box.x+hp[0],box.y+hp[1]],[box.x+hp[0]+10,box.y+hp[1]-60]);
 await p.keyboard.press('Enter');s=await p.evaluate(()=>__gs.hist.undo[__gs.hist.undo.length-1].label);ok(s==='Warp','warp committed ('+s+')');
 await p.keyboard.press('Control+z');v=await px('Layer 2',[[105,105],[150,165]]);ok(v.join()==='255,0','undo warp '+v);
 // 6. selection transform: move part of the rect
 await p.keyboard.press('m');await drag(100,100,150,150);await p.keyboard.press('v');await drag(120,120,120,200);
 v=await px('Layer 2',[[120,120],[170,120],[120,190]]);s=await p.evaluate(()=>__gs.sel.bb);ok(v.join()==='0,255,255'&&s[1]>=175,'move selected pixels leaves a hole, selection follows '+v+' '+JSON.stringify(s));
 await p.keyboard.press('Control+z');await p.keyboard.press('Control+d');
 // 7. mask moves with the layer
 await p.click('#maskRow button:text-is("Add mask")');await p.keyboard.press('m');await drag(0,0,120,300);await p.keyboard.press('d');
 await p.click('#layerList .lrow:has(.lname:text-is("Layer 2")) canvas.mthumb');await p.keyboard.press('Alt+Delete');await p.keyboard.press('Control+d');
 await p.click('#layerList .lrow:has(.lname:text-is("Layer 2")) canvas >> nth=0');
 await p.keyboard.press('v');await drag(150,120,200,120);
 const mk=await p.evaluate(()=>{const L=__gs.layerByName('Layer 2'),dd=__gs.readRGBA8(L.mask.target),W=__gs.doc.w;return [dd[(125*W+160)*4],dd[(125*W+175)*4]];});ok(mk.join()==='0,255','mask moved with layer '+mk);
 // 8. crop tool
 await setup();await p.keyboard.press('c');ok(await p.textContent('#brushTitle')==='Crop','crop panel');
 await p.fill('#cr_w','200');await p.press('#cr_w','Tab');await p.fill('#cr_h','100');await p.press('#cr_h','Tab');
 await p.screenshot({path:OUT+'crop.png'});
 await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('Enter');await p.waitForTimeout(100);
 let dz=await p.evaluate(()=>[__gs.doc.w,__gs.doc.h]);ok(dz.join()==='200,100','crop to 200x100 '+dz);
 v=await px('Layer 2',[[50,25],[0,0],[149,74]]);ok(v.join()==='255,255,0','crop keeps centred content '+v);
 await p.keyboard.press('Control+z');dz=await p.evaluate(()=>[__gs.doc.w,__gs.doc.h]);v=await px('Layer 2',[[150,125]]);ok(dz.join()==='400,300'&&v[0]===255,'undo crop '+dz+' '+v);
 await p.keyboard.press('Control+Shift+Z');dz=await p.evaluate(()=>[__gs.doc.w,__gs.doc.h]);ok(dz.join()==='200,100','redo crop '+dz);
 await p.keyboard.press('Control+z');
 // rotated crop
 await p.fill('#cr_ang','15');await p.press('#cr_ang','Tab');await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('Enter');await p.waitForTimeout(100);
 dz=await p.evaluate(()=>[__gs.doc.w,__gs.doc.h]);ok(dz.join()==='400,300','rotated crop keeps size '+dz);await p.screenshot({path:OUT+'crop-rot.png'});await p.keyboard.press('Control+z');
 // crop to selection
 await p.keyboard.press('m');await drag(100,100,200,150);await menuItem('Image','Crop to selection');dz=await p.evaluate(()=>[__gs.doc.w,__gs.doc.h]);v=await px('Layer 2',[[0,0],[99,49]]);
 ok(dz.join()==='100,50'&&v.join()==='255,255','crop to selection '+dz+' '+v);await p.keyboard.press('Control+z');
 // 9. tile mode: move wraps
 await p.keyboard.press('Shift+T');await p.keyboard.press('v');await drag(150,125,400,125,{steps:10});v=await px('Layer 2',[[355,125],[5,125],[150,125]]);ok(v.join()==='255,255,0','tile mode move wraps '+v);
 await p.keyboard.press('Shift+T');
 // 10. 16-bit transform
 await p.evaluate(()=>{__gs.newDoc(300,200,16,[1,1,1],'Deep',false);});await p.keyboard.press('Control+Shift+N');await p.keyboard.press('m');await drag(50,50,150,120);await p.keyboard.press('Alt+Delete');await p.keyboard.press('Control+d');
 await p.keyboard.press('Control+t');await p.click('button:text-is("Flip ↔")');await p.keyboard.press('Enter');v=await px('Layer 2',[[60,60],[40,60]]);ok(v.join()==='255,0','16-bit flip '+v);
 // 11. text layer converts to pixels
 await p.keyboard.press('t');await p.mouse.click(box.x+500,box.y+400);await p.keyboard.type('Hi');await p.keyboard.press('Escape');await p.waitForTimeout(200);
 await p.keyboard.press('Control+t');await p.keyboard.press('Enter');s=await p.evaluate(()=>__gs.doc.active&&!!__gs.doc.active.text);ok(s===false,'text layer rasterized by transform');
 console.log(errs.length?errs.join('\n'):'no errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})();
