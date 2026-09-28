/* Guide screenshots for 0.19: shapes, the Array tool, layer styles. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=require('path').resolve(__dirname,'../../docs/wiki/images')+'/';
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
 const W=async ms=>p.waitForTimeout(ms||300);
 const setv=(id,v)=>p.evaluate(([id,v])=>{const i=document.querySelector('#'+id);i.value=String(v);i.dispatchEvent(new Event('input'));},[id,v]);
 const stageShot=async n=>{await W(500);const bb=await p.locator('#stage').boundingBox();await p.screenshot({path:OUT+n+'.png',clip:{x:bb.x,y:bb.y,width:Math.min(bb.width,900),height:Math.min(bb.height,640)}});console.log('shot',n);};
 await p.evaluate(()=>__gs.newDoc(640,420,8,[.93,.91,.87],'shapes',false));await p.evaluate(()=>__gs.act('fit'));await W();
 await p.keyboard.press('u');
 const shapes=[['Rectangle','#c0392b'],['Rounded','#d9822b'],['Ellipse','#e0b030'],['Polygon','#3a9d5d'],['Star','#2f7fb8'],['Heart','#c2417a'],['Line','#333333'],['Arrow','#555555']];
 for(let i=0;i<shapes.length;i++){await setFG(shapes[i][1]);await p.click('#brushBody .segb:text-is("'+shapes[i][0]+'")');const x=30+(i%4)*152,y=30+Math.floor(i/4)*200;await drag(x,y,x+120,y+150);
   if(i<6){await p.check('#shpBevel');await W(100);}}
 await p.evaluate(()=>{__gs.doc.view='material';});await p.evaluate(()=>__gs.setView('material'));await stageShot('shapes');
 await p.evaluate(()=>__gs.setView('base'));
 /* the panel */
 await p.click('#layerList .lrow:has(.lname:text-is("Star"))');await W();await p.locator('#brushBody').screenshot({path:OUT+'shape-panel.png'});
 /* array: a circle of stars */
 await p.evaluate(()=>__gs.newDoc(640,420,8,[.93,.91,.87],'array',false));await p.evaluate(()=>__gs.act('fit'));await W();
 await setFG('#2f7fb8');await p.click('#brushBody .segb:text-is("Star")').catch(()=>{});await p.keyboard.press('u');await p.click('#brushBody .segb:text-is("Star")');await drag(290,40,350,100);
 await p.click('.tool[data-tool="array"]');await p.click('#arrAdd_circle');await W();
 await setv('arrCountC',10);await setv('arrCx',320);await setv('arrCy',210);await p.check('#arrVary');await W();await setv('arrVHue',40);await setv('arrVScale',.25);await p.evaluate(()=>__gs.act('fit'));
 await stageShot('array');
 await p.locator('#brushBody').screenshot({path:OUT+'array-panel.png'});
 /* layer style */
 await p.evaluate(()=>__gs.newDoc(640,420,8,[.93,.91,.87],'style',false));await p.evaluate(()=>__gs.act('fit'));
 await setFG('#d9822b');await p.keyboard.press('u');await p.click('#brushBody .segb:text-is("Rounded")');await drag(170,110,470,310);
 await p.click('#menus button:text-is("Layer")');await p.click('#menuPop .mi:has-text("Layer style")');await W();
 await p.check('#ls_drop');await p.check('#ls_stroke');await setv('lsSize',5);await p.click('#lsb_bevel');await p.check('#ls_bevel');await setv('lsSize',22);await W(500);
 await p.locator('#modal .dialog').screenshot({path:OUT+'layer-style.png'});console.log('shot layer-style');await p.click('#dlgOk');await stageShot('layer-style-result');
 console.log(errs.length?errs:'no errors');await b.close();})();
