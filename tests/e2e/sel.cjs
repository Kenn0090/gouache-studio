const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';require('fs').mkdirSync(OUT,{recursive:true});
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});
 await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:'file://'}).catch(()=>{});
 const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 // fresh 400x300 white document with an empty layer on top
 await p.evaluate(()=>{__gs.newDoc(400,300,8,[1,1,1],'SelTest',false);});
 await p.keyboard.press('Control+Shift+N');await p.waitForTimeout(100);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1,opts={})=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:opts.steps||8});await p.mouse.up();await p.waitForTimeout(60);};
 const click=async(x,y)=>{const a=await scr(x,y);await p.mouse.click(a[0],a[1]);await p.waitForTimeout(60);};
 const selAt=async(pts)=>p.evaluate(pts=>{const d=__gs.selPixels(),W=__gs.doc.w;return pts.map(([x,y])=>d[y*W+x]);},pts);
 const layerPx=async(name,pts)=>p.evaluate(([name,pts])=>{const L=__gs.layerByName(name),d=__gs.readRGBA8(L.target),W=__gs.doc.w;return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[name,pts]);
 const state=()=>p.evaluate(()=>({active:__gs.sel.active,bb:__gs.sel.bb,quick:__gs.sel.quick,undo:__gs.hist.undo.length,pill:document.querySelector('#stSel').hidden?'':document.querySelector('#stSel').textContent}));

 // 1. rectangular marquee
 await p.keyboard.press('m');
 ok(await p.textContent('#brushTitle')==='Rectangular marquee','marquee tool panel');
 await drag(100,100,300,200);
 let s=await state();ok(s.active&&JSON.stringify(s.bb)==='[100,100,300,200]','marquee bounds '+JSON.stringify(s.bb)+' pill '+s.pill);
 let v=await selAt([[150,150],[99,150],[100,100],[299,199],[300,150],[50,50]]);ok(v.join()==='255,0,255,255,0,0','marquee pixels '+v);
 await p.screenshot({path:OUT+'sel-ants.png'});
 // 2. fill inside selection, on the empty layer
 await p.evaluate(()=>{});await p.keyboard.press('Alt+Delete');await p.waitForTimeout(100);
 v=await layerPx('Layer 2',[[150,150],[50,50],[310,150]]);ok(v[0][3]===255&&v[1][3]===0&&v[2][3]===0,'fill limited to selection '+JSON.stringify(v));
 // 3. brush stroke across the edge stays inside
 await p.keyboard.press('b');await p.keyboard.press('x');
 await drag(50,250,350,120,{steps:30});
 v=await layerPx('Layer 2',[[80,236],[330,130]]);ok(v[0][3]===0&&v[1][3]===0,'brush clipped outside selection '+JSON.stringify(v));
 // 4. add an ellipse with Shift
 await p.keyboard.press('m');await p.keyboard.press('Shift+M');ok(await p.textContent('#brushTitle')==='Elliptical marquee','Shift+M switches to ellipse');
 await p.keyboard.down('Shift');await drag(250,150,350,250);await p.keyboard.up('Shift');
 s=await state();v=await selAt([[300,200],[150,150],[340,160],[340,240]]);ok(v[0]===255&&v[1]===255&&v[2]===0&&v[3]===0&&JSON.stringify(s.bb)==='[100,100,350,250]','add ellipse '+v+' '+JSON.stringify(s.bb));
 // 5. subtract a rectangle with Alt
 await p.keyboard.press('Shift+M');await p.keyboard.down('Alt');await drag(120,120,160,160);await p.keyboard.up('Alt');
 v=await selAt([[140,140],[170,170]]);ok(v.join()==='0,255','subtract '+v);
 // 6. invert, deselect, reselect
 await p.keyboard.press('Control+Shift+I');v=await selAt([[140,140],[170,170],[10,10]]);ok(v.join()==='255,0,255','invert '+v);
 await p.keyboard.press('Control+d');s=await state();ok(!s.active&&s.pill==='','deselect');
 await p.keyboard.press('Control+Shift+D');s=await state();ok(s.active,'reselect');
 // 7. undo back through selection steps
 const u0=(await state()).undo;
 for(let i=0;i<4;i++)await p.keyboard.press('Control+z');
 v=await selAt([[140,140],[10,10]]);ok(v.join()==='255,0','undo 4 steps back to add-ellipse state '+v);
 await p.keyboard.press('Control+Shift+Z');v=await selAt([[140,140]]);ok(v[0]===0,'redo subtract '+v);
 // 8. freehand lasso (new) triangle
 await p.keyboard.press('Control+d');await p.keyboard.press('l');
 { const pts=[[50,50],[150,50],[100,130],[50,50]];const a=await scr(...pts[0]);await p.mouse.move(a[0],a[1]);await p.mouse.down();
   for(const q of pts.slice(1)){for(let t=1;t<=10;t++){} const c=await scr(...q);await p.mouse.move(c[0],c[1],{steps:12});}await p.mouse.up();await p.waitForTimeout(80);}
 v=await selAt([[100,70],[60,120],[140,120]]);ok(v.join()==='255,0,0','freehand lasso '+v);
 // 9. polygonal lasso: Shift+L, click 4 points, Enter
 await p.keyboard.press('Shift+L');ok(await p.textContent('#brushTitle')==='Polygonal lasso','Shift+L polygonal');
 await click(200,20);await click(380,20);await click(380,90);await click(200,90);await p.keyboard.press('Enter');await p.waitForTimeout(80);
 v=await selAt([[300,50],[100,70]]);ok(v.join()==='255,0','polygonal lasso (new replaces) '+v);
 // 10. move the selection by dragging inside it
 await p.keyboard.press('Shift+L');await drag(300,50,300,150);
 v=await selAt([[300,150],[300,50]]);s=await state();ok(v.join()==='255,0'&&Math.abs(s.bb[1]-120)<=1,'move selection '+v+' '+JSON.stringify(s.bb));
 console.log('focus',await p.evaluate(()=>{const a=document.activeElement;return a.tagName+'#'+a.id+'.'+a.className+' tool='+__gs.ui.tool;}));const bx=(await state()).bb[0];await p.keyboard.press('ArrowRight');await p.waitForTimeout(100);s=await state();ok(s.bb[0]===bx+1,'arrow nudge '+JSON.stringify(s.bb));
 // 11. magic wand on the filled red block (layer 1 has foreground fill in 100..300 x 100..200)
 await p.keyboard.press('w');await click(150,110);
 s=await state();v=await selAt([[150,110],[50,50]]);ok(v[1]===0&&v[0]===255,'magic wand picks fill '+v+' '+JSON.stringify(s.bb));
 // 12. quick mask: paint a black line, then back to selection
 await p.keyboard.press('Control+a');await p.keyboard.press('q');s=await state();ok(s.quick&&s.pill==='Quick mask','quick mask on');
 await p.screenshot({path:OUT+'sel-quick0.png'});
 await p.keyboard.press('b');await p.keyboard.press('d'); // black foreground
 await drag(20,280,380,280,{steps:20});await p.screenshot({path:OUT+'sel-quick1.png'});
 await p.keyboard.press('q');s=await state();v=await selAt([[200,280],[200,20]]);ok(!s.quick&&s.active&&v[0]<30&&v[1]===255,'quick mask painted hole '+v);
 // 13. copy + paste in place
 await p.keyboard.press('Control+d');await p.keyboard.press('m');await drag(100,100,200,150);
 const layersBefore=await p.evaluate(()=>__gs.doc.root.children.length);
 await p.click('#menus button:text-is("Edit")');await p.click('#menuPop .mi:has-text("Copy")>>nth=0');
 await p.click('#menus button:text-is("Edit")');await p.click('#menuPop .mi:has-text("Paste")');
 v=await layerPx('Pasted',[[150,120],[250,120]]);const nL=await p.evaluate(()=>__gs.doc.root.children.length);
 ok(nL===layersBefore+1&&v[0][3]===255&&v[1][3]===0,'copy + paste in place '+JSON.stringify(v));
 // Ctrl+C / Ctrl+V via keyboard (clipboard events)
 await p.keyboard.press('Control+c');await p.keyboard.press('Control+v');await p.waitForTimeout(150);
 const nL2=await p.evaluate(()=>__gs.doc.root.children.length);ok(nL2===nL+1,'Ctrl+C / Ctrl+V pastes (layers '+nL+' -> '+nL2+')');
 // 14. Ctrl+J layer via copy
 await p.evaluate(()=>{});const nJ=await p.evaluate(()=>__gs.doc.root.children.length);await p.keyboard.press('Control+j');
 const nJ2=await p.evaluate(()=>__gs.doc.root.children.length);ok(nJ2===nJ+1,'layer via copy');
 // 15. Invert image (Ctrl+I) limited to selection on Background
 await p.evaluate(()=>{const L=__gs.layerByName('Background');});
 await p.click('#layerList .lrow:has(.lname:text-is("Background"))');await p.keyboard.press('Control+i');
 v=await layerPx('Background',[[150,120],[50,50]]);ok(v[0][0]===0&&v[1][0]===255,'invert limited to selection '+JSON.stringify(v));
 // 16. Delete clears only the selection, undo restores
 await p.keyboard.press('Delete');v=await layerPx('Background',[[150,120],[50,50]]);ok(v[0][3]===0&&v[1][3]===255,'delete selection '+JSON.stringify(v));
 await p.keyboard.press('Control+z');v=await layerPx('Background',[[150,120]]);ok(v[0][3]===255,'undo delete');
 // 17. feather / expand / contract / smooth via Select menu
 const menuItem=async(menu,item)=>{await p.click('#menus button:text-is("'+menu+'")');await p.click('#menuPop .mi:has-text("'+item+'")');};
 // live preview: Expand changes the selection while the dialog is open; Esc restores; slider updates live
 const u1=(await state()).undo;
 await menuItem('Select','Expand');await p.waitForTimeout(150);v=await selAt([[98,98]]);ok(v[0]===255,'expand previews live '+v);
 await p.evaluate(()=>{const i=document.querySelector('#selR');i.value=10;i.dispatchEvent(new Event('input'));});await p.waitForTimeout(150);
 v=await selAt([[92,92],[88,88]]);ok(v.join()==='255,0','slider updates live to 10px '+v);
 await p.keyboard.press('Escape');await p.waitForTimeout(100);v=await selAt([[98,98],[100,100]]);s=await state();ok(v.join()==='0,255'&&s.undo===u1&&JSON.stringify(s.bb)==='[100,100,200,150]','cancel restores, no undo step '+v+' '+JSON.stringify(s.bb));
 await menuItem('Select','Feather');await p.waitForTimeout(150);await p.screenshot({path:OUT+'sel-live-feather.png'});await p.keyboard.press('Escape');
 await menuItem('Select','Expand');await p.click('#dlgOk');s=await state();ok(s.undo===u1+1,'apply = one undo step');s=await state();v=await selAt([[98,98],[95,95]]);ok(JSON.stringify(s.bb)==='[96,96,204,154]'&&v.join()==='255,0','expand 4px '+v+' '+JSON.stringify(s.bb));
 await menuItem('Select','Contract');await p.click('#dlgOk');v=await selAt([[98,98],[101,101]]);ok(v.join()==='0,255','contract 4px '+v);
 await menuItem('Select','Feather');await p.click('#dlgOk');v=await selAt([[100,125],[150,125],[90,125]]);ok(v[0]>60&&v[0]<200&&v[1]===255&&v[2]<60,'feather soft edge '+v);
 // 18. Ctrl+click layer thumbnail loads its pixels
 await p.keyboard.press('Control+d');await p.locator('#layerList .lrow:has(.lname:text-is("Layer 2")) canvas').first().click({modifiers:['Control']});
 v=await selAt([[150,150],[50,50]]);ok(v[0]===255&&v[1]===0,'ctrl+click thumbnail selects layer pixels '+v);
 // 19. add mask from selection
 await p.click('#layerList .lrow:has(.lname:text-is("Background"))');await p.click('#menus button:text-is("Image")');await p.hover('#menuPop .hassub:has-text("Layer")');await p.click('#menuSub .mi:has-text("Add mask")');
 const mk=await p.evaluate(()=>{const L=__gs.layerByName('Background'),d=__gs.readRGBA8(L.mask.target),W=__gs.doc.w;return [d[(150*W+150)*4],d[(50*W+50)*4]];});ok(mk.join()==='255,0','mask from selection '+mk);
 // 20. tile mode: marquee across the right edge wraps to the left
 await p.keyboard.press('Control+d');await p.keyboard.press('Shift+T');await p.waitForTimeout(150);
 await p.keyboard.press('m');await drag(370,50,430,80);v=await selAt([[380,60],[10,60],[40,60]]);s=await state();
 ok(v.join()==='255,255,0','tile mode wraps selection '+v+' '+JSON.stringify(s.bb));
 await p.screenshot({path:OUT+'sel-tile.png'});
 console.log(errs.length?errs.join('\n'):'no errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})();
