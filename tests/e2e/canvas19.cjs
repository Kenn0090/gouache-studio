/* 0.19 canvas tools: shapes (with bevel), the Array tool, layer styles, and keeping them in .gouache files. */
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
 const comp=(k,pts)=>p.evaluate(([k,pts])=>{const t=__gs.compositeMap(k),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[k,pts]);
 const act=()=>p.evaluate(()=>{const L=__gs.doc.active;return {name:L.name,shape:L.shape,array:L.array,styles:L.styles};});
 await p.evaluate(()=>__gs.newDoc(400,300,8,[1,1,1],'canvas19',false));await p.waitForTimeout(300);
 await setFG('#c03020');
 /* ---- shapes ---- */
 await p.keyboard.press('u');await p.waitForTimeout(150);ok(await p.evaluate(()=>__gs.ui.tool)==='shape','U picks the Shape tool');
 await p.click('#brushBody .segb:text-is("Rectangle")');await drag(40,40,120,100);
 let a=await act();ok(a.shape&&a.shape.kind==='rect'&&a.name==='Rectangle','dragging draws a rectangle on a new layer');
 let v=await comp('base',[[80,70],[30,30]]);ok(v[0][0]>180&&v[0][1]<70&&v[1][0]>240,'filled with the foreground colour '+JSON.stringify(v));
 /* resize by the bottom-right corner */
 await drag(120,100,150,130);a=await act();ok(Math.abs(Math.max(a.shape.x0,a.shape.x1)-150)<3&&Math.abs(Math.max(a.shape.y0,a.shape.y1)-130)<3,'corner handle resizes '+JSON.stringify([a.shape.x1,a.shape.y1]));
 /* move from inside */
 await drag(90,80,100,80);a=await act();ok(Math.abs(Math.min(a.shape.x0,a.shape.x1)-50)<3,'dragging inside moves it');
 /* bevel: raises the height map */
 await p.check('#shpBevel');await p.waitForTimeout(200);
 ok(await p.evaluate(()=>__gs.doc.maps.includes('height')),'bevel adds the Height map');
 v=await comp('height',[[100,85],[52,85],[20,20]]);ok(v[0][0]>v[1][0]+20&&Math.abs(v[2][0]-128)<3,'bevel: centre high, edge low, outside flat '+JSON.stringify(v));
 await p.click('#brushBody .segb:text-is("Cove")');await p.waitForTimeout(150);const cove=await comp('height',[[56,85]]);
 await p.click('#brushBody .segb:text-is("Round")');await p.waitForTimeout(150);const round=await comp('height',[[56,85]]);
 ok(round[0][0]>cove[0][0]+10,'profiles differ (round rises faster than cove) '+round[0][0]+'/'+cove[0][0]);
 /* star and heart */
 await p.evaluate(()=>{__gs.doc.active=null;});await p.click('#brushBody .segb:text-is("Heart")');await drag(250,40,330,120);
 v=await comp('base',[[290,70],[290,45],[255,118]]);ok(v[0][1]<120&&v[1][1]>240&&v[2][1]>240,'heart: filled in the middle, notch at the top, empty bottom corner '+JSON.stringify(v));
 /* painting on a shape turns it into pixels (undo brings it back) */
 await p.keyboard.press('b');await drag(270,80,300,80);ok(!(await act()).shape,'painting converts the shape to pixels');
 await p.keyboard.press('Control+z');await p.waitForTimeout(100);await p.keyboard.press('Control+z');await p.waitForTimeout(150);ok(!!(await act()).shape,'undo brings the editable shape back');
 /* ---- array ---- */
 await p.click('#layerList .lrow:has(.lname:text-is("Rectangle"))');
 await p.click('.tool[data-tool="array"]');await p.waitForTimeout(150);await p.click('#arrAdd_line');await p.waitForTimeout(200);
 a=await act();ok(a.array&&a.array.mode==='line'&&a.array.count===5,'Add line array');
 const dx=a.array.dx;v=await comp('base',[[100+dx,85],[100+2*dx,85]]);ok(v[0][1]<120&&v[1][1]<120,'copies appear along the line (step '+dx+')');
 /* drag the step handle straight down */
 const piv=await p.evaluate(()=>{const b=__gs.doc.active.arrBox;return [(b[0]+b[2])/2,(b[1]+b[3])/2];});
 await drag(piv[0]+dx,piv[1],piv[0],piv[1]+70,{steps:6});a=await act();ok(Math.abs(a.array.dx)<3&&Math.abs(a.array.dy-70)<3,'dragging the handle sets the step '+a.array.dx+','+a.array.dy);
 await p.fill('#arrCount','3').catch(()=>{});await p.evaluate(()=>{const i=document.querySelector('#arrCount');i.value='3';i.dispatchEvent(new Event('input'));});await p.waitForTimeout(200);
 v=await comp('base',[[100,85+70],[100,85+140],[100,85+210]]);ok(v[0][1]<120&&v[1][1]<120&&v[2][1]>240,'Copies slider: three copies '+JSON.stringify(v));
 /* grid and circle */
 await p.click('#brushBody .segb:text-is("Grid")');a=await act();ok(a.array.mode==='grid','grid mode');
 await p.click('#brushBody .segb:text-is("Circle")');await p.waitForTimeout(150);a=await act();ok(a.array.mode==='circle','circle mode');
 {const t=2*Math.PI/a.array.count,rx=piv[0]-a.array.cx,ry=piv[1]-a.array.cy;v=await comp('base',[[Math.round(a.array.cx+Math.cos(t)*rx-Math.sin(t)*ry),Math.round(a.array.cy+Math.sin(t)*rx+Math.cos(t)*ry)]]);}ok(v[0][1]<120,'a copy on the far side of the circle');
 /* variety: different copies get different colours */
 await p.click('#brushBody .segb:text-is("Line")');await p.check('#arrVary');await p.evaluate(()=>{const i=document.querySelector('#arrVHue');i.value='120';i.dispatchEvent(new Event('input'));});await p.waitForTimeout(200);
 a=await act();v=await comp('base',[[100,85],[100,85+70]]);ok(a.array.vary&&JSON.stringify(v[0])!==JSON.stringify(v[1]),'Hue variety tints the copies differently '+JSON.stringify(v));
 /* the array follows paint on the layer (live) */
 /* apply: pixels, and undo brings the array back */
 await p.click('#arrApply');await p.waitForTimeout(200);a=await act();ok(!a.array,'Apply turns the copies into pixels');
 v=await comp('base',[[100,85+70]]);ok(!(v[0][0]>240&&v[0][1]>240&&v[0][2]>240),'the copy is still there as pixels '+JSON.stringify(v));
 await p.keyboard.press('Control+z');await p.waitForTimeout(200);a=await act();ok(!!a.array,'undo brings the live array back');
 /* ---- layer style ---- */
 await p.click('#menus button:text-is("Layer")');await p.click('#menuPop .mi:has-text("Layer style")');await p.waitForTimeout(200);
 ok((await p.textContent('#dlgTitle')).startsWith('Layer style'),'Layer › Layer style opens the dialog');
 await p.check('#ls_stroke');await p.evaluate(()=>{const i=document.querySelector('#lsSize');i.value='6';i.dispatchEvent(new Event('input'));});await p.waitForTimeout(150);
 v=await comp('base',[[47,85]]);ok(v[0][0]<60&&v[0][1]<60,'stroke draws outside the edge (live) '+JSON.stringify(v));
 await p.click('#lsb_bevel');await p.check('#ls_bevel');
 await p.click('#lsb_overlay');await p.check('#ls_overlay');await p.check('#lsSurf_overlay');
 await p.evaluate(()=>{const i=document.querySelector('#lsMetal');i.value='1';i.dispatchEvent(new Event('input'));});
 await p.screenshot({path:OUT+'layer-style.png'});
 await p.click('#dlgOk');await p.waitForTimeout(300);
 ok(await p.isVisible('#layerList .lrow .fxbadge'),'fx badge on the layer');
 ok(await p.evaluate(()=>__gs.doc.maps.includes('metal')),'metallic map added for the overlay’s surface');
 v=await comp('metal',[[100,85],[20,20]]);ok(v[0][0]>200&&v[1][0]<30,'overlay sets metallic inside the shape '+JSON.stringify(v));
 /* ---- kept in .gouache files ---- */
 await p.evaluate(async()=>{const b=await __gs.encodeGouache();window.__gbuf=await b.arrayBuffer();});
 await p.evaluate(()=>__gs.newDoc(50,50,8,[1,1,1],'x',false));await p.evaluate(async()=>{await __gs.openGouache(window.__gbuf,'t');});await p.waitForTimeout(400);
 const re=await p.evaluate(()=>{const L=__gs.layerByName('Rectangle');return {shape:!!L.shape,array:!!L.array,stroke:!!(L.styles&&L.styles.stroke.on)};});
 ok(re.shape&&re.array&&re.stroke,'shape, array and styles survive saving and opening '+JSON.stringify(re));
 v=await comp('base',[[47,85]]);ok(v[0][0]<60,'and still draw');
 await p.screenshot({path:OUT+'canvas19.png'});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
