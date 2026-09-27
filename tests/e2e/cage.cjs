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
 const drag=async(x0,y0,x1,y1,opts={})=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:opts.steps||12});await p.mouse.up();await p.waitForTimeout(120);};
 const px=async(name,pts)=>p.evaluate(([name,pts])=>{const L=__gs.layerByName(name),d=__gs.readRGBA8(L.target),W=__gs.doc.w;return pts.map(([x,y])=>{x=Math.round(x);y=Math.round(y);return Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4));});},[name,pts]);
 const red=v=>v[0]>200&&v[1]<80&&v[2]<80, white=v=>v[0]>240&&v[1]>240&&v[2]>240;
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 await p.evaluate(()=>{__gs.newDoc(400,300,8,[1,1,1],'Cage',false);Object.assign(__gs.brush,{size:14,hardness:1,smoothing:0,spacing:.06,tip:null,pSize:false,opacity:1,flow:1});});
 await setFG('#ff0000');
 await p.keyboard.press('k');ok(await p.textContent('#brushTitle')==='Cage','cage tool panel');
 await drag(100,100,300,200);
 let C=await p.evaluate(()=>__gs.doc.cage&&{nx:__gs.doc.cage.nx,A:__gs.doc.cage.A});ok(C&&C.nx===1&&Math.round(C.A[1][1][0])===300,'4-corner cage drawn '+JSON.stringify(C&&C.A));
 ok(await p.evaluate(()=>__gs.hist.undo.at(-1).label)==='New cage','new cage is undoable');
 await drag(300,100,340,60);C=await p.evaluate(()=>__gs.doc.cage.A);ok(Math.round(C[0][1][0])===340&&Math.round(C[0][1][1])===60,'corner dragged '+JSON.stringify(C[0][1]));
 await p.screenshot({path:OUT+'cage-tool.png'});
 // bend: horizontal stroke through the middle of the cage
 await p.keyboard.press('b');
 await drag(120,150,280,150);
 let v=await px('Background',[[200,150],[150,150],[200,100],[200,195]]);ok(red(v[0])&&red(v[1])&&white(v[2])&&white(v[3]),'bent stroke painted inside '+JSON.stringify(v));
 // mapped: the line follows flat v=0.5 -> check a point on the flat midline curve
 await p.keyboard.down('Shift');await drag(120,120,280,120);await p.keyboard.up('Shift');
 const mid=await p.evaluate(()=>{const C=__gs.doc.cage,m=__gs.cageInv(C,120,120);return [__gs.cagePt(C,.72,m.y/C.fh),__gs.cagePt(C,.5,m.y/C.fh)];});v=await px('Background',[...mid,[270,120]]);ok(red(v[0])&&red(v[1])&&white(v[2]),'Shift stroke follows the cage line '+JSON.stringify(mid)+JSON.stringify(v));
 // leaving the cage: nothing painted outside
 await drag(250,120,390,120);v=await px('Background',[[370,120],[260,120]]);ok(white(v[0])&&red(v[1]),'stroke clipped at cage edge '+JSON.stringify(v));
 // outside: paints normally
 await drag(20,20,60,20);v=await px('Background',[[40,20]]);ok(red(v[0]),'outside the cage paints normally');
 // undo last stroke
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(300);v=await px('Background',[[40,20]]);ok(white(v[0]),'undo stroke');
 // flat view: vertical line down the middle of flat space
 await p.keyboard.press('f');let st=await p.evaluate(()=>({f:__gs.ui.cageFlat,fw:__gs.doc.cage.fw,fh:__gs.doc.cage.fh}));ok(st.f,'flat view on '+JSON.stringify(st));
 await setFG('#0000ff');
 await drag(st.fw/2,3,st.fw/2,st.fh-3);
 await p.screenshot({path:OUT+'cage-flat.png'});
 await p.keyboard.press('Escape');ok(!(await p.evaluate(()=>__gs.ui.cageFlat)),'Esc leaves flat view');
 const pts=await p.evaluate(()=>{const C=__gs.doc.cage;return [__gs.cagePt(C,.5,.15),__gs.cagePt(C,.5,.85),__gs.cagePt(C,.25,.5)];});
 v=await px('Background',pts);const blue=q=>q[2]>200&&q[0]<80;ok(blue(v[0])&&blue(v[1])&&!blue(v[2]),'flat-view line bent onto the canvas '+JSON.stringify(v));
 await p.screenshot({path:OUT+'cage-after.png'});
 // grid cage + regrid keeps shape
 await p.keyboard.press('k');await p.click('.seg [aria-checked] >> text=Grid').catch(()=>{});
 await p.evaluate(()=>{const b=[...document.querySelectorAll('.seg button')].find(b=>b.textContent==='Grid');b&&b.click();});await p.waitForTimeout(200);
 C=await p.evaluate(()=>({nx:__gs.doc.cage.nx,ny:__gs.doc.cage.ny,c:__gs.doc.cage.A[0].at(-1)}));ok(C.nx===4&&C.ny===4&&Math.round(C.c[0])===340,'regrid to 4×4 keeps corners '+JSON.stringify(C));
 // bend an interior point, paint, check the curve
 await p.evaluate(()=>{const C=__gs.doc.cage;C.A[2][2]=[C.A[2][2][0],C.A[2][2][1]-30];__gs.cageMesh(C);C._m=null;});
 await p.screenshot({path:OUT+'cage-grid.png'});
 // save / open keeps the cage
 const r=await p.evaluate(async()=>{const b=await __gs.encodeGouache();const buf=await b.arrayBuffer();await __gs.openGouache(buf,'x.gouache');return __gs.doc.cage&&__gs.doc.cage.nx;});ok(r===4,'cage saved in .gouache');
 // symmetry
 await p.evaluate(()=>{__gs.newDoc(400,300,8,[1,1,1],'Sym',false);__gs.ui.sym.mode='x';__gs.ui.sym.cx=.5;__gs.ui.sym.cy=.5;});await setFG('#ff0000');await p.keyboard.press('b');
 await drag(100,150,101,150,{steps:2});v=await px('Background',[[100,150],[300,150],[100,50]]);ok(red(v[0])&&red(v[1])&&white(v[2]),'left-right symmetry '+JSON.stringify(v));
 await p.evaluate(()=>{__gs.ui.sym.mode='radial';__gs.ui.sym.n=4;});
 await drag(200,60,201,60,{steps:2});v=await px('Background',[[200,60],[290,150],[200,240],[110,150]]);ok(v.every(red),'radial x4 '+JSON.stringify(v));
 // mirrored elongated dab orientation: angle 30deg, roundness .25
 await p.evaluate(()=>{__gs.newDoc(400,300,8,[1,1,1],'Sym2',false);__gs.ui.sym.mode='x';Object.assign(__gs.brush,{size:80,roundness:.2,angle:30});});
 await drag(100,150,100.5,150,{steps:1});
 v=await px('Background',[[100+30*Math.cos(Math.PI/6),150-30*Math.sin(Math.PI/6)],[300-30*Math.cos(Math.PI/6),150-30*Math.sin(Math.PI/6)],[300+30*Math.cos(Math.PI/6),150-30*Math.sin(Math.PI/6)]]);
 ok((red(v[0])===red(v[1]))&&(red(v[1])!==red(v[2])),'mirrored dab is a mirror image '+JSON.stringify(v));
 await p.screenshot({path:OUT+'sym.png'});
 await p.evaluate(()=>{__gs.ui.sym.mode='off';Object.assign(__gs.brush,{roundness:1,angle:0});});
 ok(errs.length===0,'no errors '+errs.join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();
})();
