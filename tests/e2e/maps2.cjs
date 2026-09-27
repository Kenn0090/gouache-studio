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

 await p.keyboard.press('Control+Alt+n');await p.waitForTimeout(200);
 await p.fill('#dW','300');await p.fill('#dH','200');await p.click('button.chip:has-text("PBR")');await p.click('#dlgOk');await p.waitForTimeout(400);
 await p.keyboard.press('b');await p.waitForTimeout(100);
 ok(await p.locator('.mapbrush').count()===1,'brush has Maps section');
 await p.evaluate(()=>__gs.showPanel('tool'));await p.check('#mb_rough');await p.waitForTimeout(80);await p.check('#mb_height');await p.waitForTimeout(80);
 await p.evaluate(()=>{__gs.ui.mapBrush.rough.v=.2;__gs.ui.mapBrush.height.v=1;});
 await p.keyboard.press('Control+Shift+n');const ln=await p.evaluate(()=>__gs.doc.active.name);
 await setFG('#00ff00');await drag(50,100,250,100);
 let a=await mpx(ln,'base',[[150,100]]),r=await mpx(ln,'rough',[[150,100],[150,20]]),h=await mpx(ln,'height',[[150,100]]),m=await mpx(ln,'metal',[[150,100]]);
 ok(a&&a[0][1]===255,'base painted green '+JSON.stringify(a));
 ok(r&&Math.abs(r[0][0]-51)<3&&r[1][3]===0,'rough painted 20% '+JSON.stringify(r));
 ok(h&&h[0][0]>250,'height painted +100% '+JSON.stringify(h));ok(m===null,'metal untouched');
 let n=await p.evaluate(()=>__gs.hist.undo.length);
 await p.keyboard.press('Control+z');await p.waitForTimeout(100);
 r=await mpx(ln,'rough',[[150,100]]);h=await mpx(ln,'height',[[150,100]]);a=await mpx(ln,'base',[[150,100]]);
 ok(r[0][3]===0&&h[0][3]===0&&a[0][3]===0,'one undo clears all three '+JSON.stringify([a,r,h]));
 await p.keyboard.press('Control+Shift+Z');await p.waitForTimeout(100);r=await mpx(ln,'rough',[[150,100]]);ok(r[0][3]===255,'redo');
 // live preview in material view: composite of rough during stroke
 // eraser erases enabled maps
 await p.keyboard.press('e');await p.waitForTimeout(80);await drag(150,60,150,140);
 r=await mpx(ln,'rough',[[150,100]]);h=await mpx(ln,'height',[[150,100]]);a=await mpx(ln,'base',[[150,100]]);
 ok(r[0][3]===0&&h[0][3]===0&&a[0][3]===0,'eraser erases all enabled maps '+JSON.stringify([a,r,h]));
 // fill with selection fills other maps
 await p.keyboard.press('m');await drag(10,10,40,40);await p.keyboard.press('Alt+Backspace');await p.waitForTimeout(100);
 r=await mpx(ln,'rough',[[20,20],[60,60]]);ok(r[0][3]===255&&Math.abs(r[0][0]-51)<3&&r[1][3]===0,'Fill selection fills rough '+JSON.stringify(r));
 await p.keyboard.press('Delete');await p.waitForTimeout(100);r=await mpx(ln,'rough',[[20,20]]);ok(r[0][3]===0,'Delete clears rough');
 await p.keyboard.press('Control+d');
 // bucket
 await p.keyboard.press('Shift+Alt+1');await p.evaluate(()=>{__gs.ui.tool;});await p.keyboard.press('g');await p.evaluate(()=>{});
 await p.evaluate(()=>{document.querySelector('#toolBtns [data-tool="bucket"],button[data-tool="bucket"]')});
 // lock alpha: other maps only inside base shape
 await p.keyboard.press('b');await p.keyboard.press('Control+Shift+n');const l2=await p.evaluate(()=>__gs.doc.active.name);
 await setFG('#0000ff');await p.evaluate(()=>{__gs.ui.mapBrush.rough.on=false;__gs.ui.mapBrush.height.on=false;});await drag(100,30,200,30);
 await p.evaluate(()=>{__gs.ui.mapBrush.rough.on=true;});await p.check('#lLock');await drag(150,10,150,60);
 r=await mpx(l2,'rough',[[150,30],[150,55]]);ok(r[0][3]===255&&r[1][3]===0,'lock alpha: rough follows base shape '+JSON.stringify(r));
 // painting while viewing roughness paints fg into rough, and base when base toggle? (base not extra)
 await p.uncheck('#lLock');
 await p.click('#mapList .mrow:has-text("Material")');await p.waitForTimeout(150);
 await p.screenshot({path:OUT+'maps-brush.png'});
 // save brush remembers maps
 await p.click('#mapList .mrow:has-text("Base colour")');await p.keyboard.press('b');
 await p.evaluate(()=>__gs.showPanel('brushes'));await p.click('#saveBrushBtn');await p.fill('#sbName','Rough brush');await p.click('#dlgOk');await p.waitForTimeout(100);
 await p.evaluate(()=>{__gs.ui.mapBrush.rough.on=false;__gs.ui.mapBrush.rough.v=.9;});
 await p.click('.libset button[aria-label="Round"]');await p.click('.libset button[aria-label="Rough brush"]');await p.waitForTimeout(100);
 let mb=await p.evaluate(()=>__gs.ui.mapBrush.rough);ok(mb.on&&Math.abs(mb.v-.2)<1e-6,'saved brush restores map values '+JSON.stringify(mb));
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
