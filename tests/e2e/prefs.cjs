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


 const menuItem=async(menu,item)=>{await p.click('#menus button:text-is("'+menu+'")');await p.click('#menuPop .mi:has-text("'+item+'")');};
 await p.click('#layerList .lrow:has(.lname:text-is("Background"))');
 await p.keyboard.press('Control+z'); // remove the empty layer; Background active
 await p.click('#layerList .lrow:has(.lname:text-is("Background"))');await p.keyboard.press('d');await p.keyboard.press('m');await drag(0,0,200,300);await p.keyboard.press('Alt+Delete');await p.keyboard.press('Control+d');
 // defaults: live on; blur previews on canvas
 const comp=async(x,y)=>p.evaluate(([x,y])=>{const c=document.querySelector('#gl');return 0;},[x,y]);
 const bgPx=async(pts)=>layerPx('Background',pts);
 await menuItem('Filter','Gaussian blur');await p.waitForTimeout(200);
 ok(await p.isChecked('#fxPrev'),'preview checkbox on by default');
 await p.keyboard.press('Escape');
 // Ctrl+K preferences: turn live previews off
 await p.keyboard.press('Control+k');ok((await p.textContent('#dlgTitle'))==='Preferences','Ctrl+K opens preferences');
 await p.uncheck('#pLive');await p.click('#dlgOk');
 const stored=await p.evaluate(()=>localStorage.getItem('gs.prefs'));ok(stored.includes('"livePreview":false'),'saved '+stored);
 await menuItem('Filter','Gaussian blur');await p.waitForTimeout(200);ok(!(await p.isChecked('#fxPrev')),'preview checkbox follows setting');
 await p.screenshot({path:OUT+'prev-off.png'});
 const hist0=await state();await p.click('#dlgOk');await p.waitForTimeout(100);
 let v=await bgPx([[200,150],[180,150]]);ok(v[0][0]>5&&v[0][0]<250,'apply still blurs with preview off '+JSON.stringify(v));
 await p.keyboard.press('Control+z');
 // selection dialog with preview off: selection unchanged until Apply
 await p.keyboard.press('m');await drag(100,100,200,150);
 await menuItem('Select','Expand');await p.waitForTimeout(150);v=await selAt([[98,98]]);ok(v[0]===0,'expand does not preview when off '+v);
 await p.check('#slPrev');await p.waitForTimeout(150);v=await selAt([[98,98]]);ok(v[0]===255,'ticking Preview shows it '+v);
 await p.uncheck('#slPrev');await p.waitForTimeout(100);v=await selAt([[98,98]]);ok(v[0]===0,'unticking restores original '+v);
 await p.click('#dlgOk');await p.waitForTimeout(100);v=await selAt([[98,98]]);ok(v[0]===255,'apply expands with preview off '+v);
 // reload keeps the setting
 await p.reload();await p.waitForTimeout(2500);await p.keyboard.press('Control+k');ok(!(await p.isChecked('#pLive')),'setting remembered after restart');
 await p.check('#pLive');await p.click('#dlgOk');
 console.log(errs.length?errs.join('\n'):'no errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})();
