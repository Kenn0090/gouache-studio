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


 // A. 16-bit document: marquee, undo, wand, fill
 await p.evaluate(()=>{__gs.newDoc(300,200,16,[1,1,1],'Deep',false);});await p.keyboard.press('Control+Shift+N');
 await p.keyboard.press('m');await drag(50,50,150,120);let v=await selAt([[60,60],[40,40]]);ok(v.join()==='255,0','16-bit marquee '+v);
 await p.keyboard.press('Alt+Delete');await p.keyboard.press('Control+d');await p.keyboard.press('Control+z');v=await selAt([[60,60]]);let s=await state();ok(s.active&&v[0]===255,'16-bit undo deselect');
 await p.keyboard.press('Control+d');await p.keyboard.press('w');await click(100,100);s=await state();ok(s.active&&s.bb[0]<=50&&s.bb[2]>=150&&s.bb[2]<=154,'16-bit wand '+JSON.stringify(s.bb));
 await p.keyboard.press('Shift+M');await p.keyboard.press('m');
 // B. large document (chunked polygon fill): 5000 x 2600
 await p.evaluate(()=>{__gs.newDoc(5000,2600,8,[1,1,1],'Big',false);});await p.keyboard.press('Control+Shift+N');
 await p.keyboard.press('m');await p.keyboard.press('Shift+M');await drag(300,300,4700,2300,{steps:5});
 v=await selAt([[2500,1300],[2100,400],[4600,1300],[310,310],[2500,290]]);ok(v[0]===255&&v[1]===255&&v[2]===255&&v[3]===0&&v[4]===0,'big ellipse across chunks '+v);
 await p.keyboard.press('Alt+Delete');let lp=await layerPx('Layer 2',[[2500,1300],[310,310]]);ok(lp[0][3]===255&&lp[1][3]===0,'big fill in selection');
 await p.keyboard.press('Shift+M');
 // C. smudge respects the selection; painting on a mask too
 await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'Smudge',false);});
 await p.keyboard.press('m');await drag(0,0,150,200);await p.keyboard.press('Control+Shift+I');await p.keyboard.press('Control+Shift+I'); // left half
 await p.keyboard.press('d');await p.keyboard.press('Alt+Delete'); // black fill on left half of Background
 await p.keyboard.press('Control+Shift+I'); // now right half selected
 await p.keyboard.press('s');await drag(100,100,250,100,{steps:25});
 lp=await layerPx('Background',[[170,100],[120,100]]);ok(lp[0][0]<250&&lp[1][0]===0,'smudge drags colour into selection only '+JSON.stringify(lp));
 await p.keyboard.press('Control+Shift+I'); // left half
 await p.click('#maskRow button:text-is("Add mask")');
 const mk0=await p.evaluate(()=>{const L=__gs.layerByName('Background'),d=__gs.readRGBA8(L.mask.target),W=__gs.doc.w;return [d[(100*W+50)*4],d[(100*W+250)*4]];});ok(mk0.join()==='255,0','mask from left-half selection '+mk0);
 await p.keyboard.press('b');await p.keyboard.press('x');await p.keyboard.press('d');await p.keyboard.press('x'); // fg white
 await drag(20,150,280,150,{steps:25});
 const mk=await p.evaluate(()=>{const L=__gs.layerByName('Background'),d=__gs.readRGBA8(L.mask.target),W=__gs.doc.w;return [d[(150*W+250)*4]];});ok(mk[0]===0,'mask stroke clipped to selection '+mk);
 await p.screenshot({path:OUT+'sel2.png'});
 console.log(errs.length?errs.join('\n'):'no errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})();
