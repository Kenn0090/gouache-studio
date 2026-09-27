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
 await p.fill('#dW','128');await p.fill('#dH','96');await p.click('button.chip:has-text("PBR")');await p.click('#dlgOk');await p.waitForTimeout(400);
 // base: dark background with a bright disc
 await setFG('#202020');await p.keyboard.press('Alt+Backspace');await setFG('#e0e0e0');await p.keyboard.press('b');await p.evaluate(()=>{__gs.brush.size=40;__gs.brush.hardness=.9;__gs.brush.pSize=false;});await drag(64,48,65,48);
 const comp=async(k,pts)=>p.evaluate(([k,pts])=>{const t=__gs.compositeMap(k),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[k,pts]);
 const run=async(id,setup)=>{await p.evaluate(id=>__gs.dlgConvert(id),id);await p.waitForTimeout(300);if(setup)await setup();await p.click('#dlgOk');await p.waitForTimeout(300);};
 const nl=()=>p.evaluate(()=>__gs.allLayers().length);
 let n0=await nl();
 await run('heightFromBase');
 let h=await comp('height',[[64,48],[5,5]]);ok(await nl()===n0+1&&h[0][0]>h[1][0]+40,'height from colour: disc raised '+JSON.stringify(h));
 ok(await p.evaluate(()=>__gs.doc.map)==='height','shows height after');
 await p.keyboard.press('Control+z');await p.waitForTimeout(200);ok(await nl()===n0,'undo removes layer');await p.keyboard.press('Control+Shift+Z');await p.waitForTimeout(200);
 // cancel leaves nothing
 await p.evaluate(()=>__gs.dlgConvert('roughFromBase'));await p.waitForTimeout(200);ok(await nl()===n0+2,'temp layer during preview');await p.click('#dlgCancel');await p.waitForTimeout(200);ok(await nl()===n0+1,'cancel removes temp layer');
 await run('roughFromBase');let r=await comp('rough',[[64,48],[5,5]]);ok(r[0][0]>r[1][0]+50,'rough from colour '+JSON.stringify(r));
 await run('normalFromBase');let nn=await comp('normal',[[64,30],[64,66],[46,48],[82,48],[5,5]]);ok(nn[0][1]>140&&nn[1][1]<116&&nn[2][0]<116&&nn[3][0]>140,'normal from colour '+JSON.stringify(nn));
 // AO needs ao map -> added automatically
 await run('aoFromHeight');let mp=await p.evaluate(()=>__gs.doc.maps.join());let ao=await comp('ao',[[64,48],[64,20],[5,5]]);ok(mp.includes('ao'),'ao map added '+mp);
 console.log('ao',JSON.stringify(ao));
 const base0=await comp('base',[[64,28],[40,40]]);await run('curvFromHeight');let cv=await comp('curv',[[64,28],[5,5]]);console.log('curv',JSON.stringify(cv));
 const base1=await comp('base',[[64,28],[40,40]]);ok(JSON.stringify(base0)===JSON.stringify(base1),'curvature leaves the base colour alone');
 ok(await p.evaluate(()=>__gs.doc.maps.includes('curv')&&__gs.doc.active&&__gs.doc.active.maps&&!!__gs.doc.active.maps.curv),'curvature goes into its own Curvature map');
 await run('curvFromHeight',async()=>{await p.selectOption('#cvOut','sel');});let sa=await p.evaluate(()=>__gs.sel.active);ok(sa,'curvature to selection');
 await p.keyboard.press('Control+d');
 await run('curvFromNormal');let cn=await comp('curv',[[64,28]]);console.log('curvN',JSON.stringify(cn));
 // edge wear filter on the colour layer
 await p.evaluate(()=>{__gs.setEditMap('base');const L=__gs.layerByName('Background');__gs.doc.active=L;__gs.doc.sel=new Set([L]);});await p.waitForTimeout(150);
 const ew0=await comp('base',[[64,28],[64,48],[5,5]]);await p.evaluate(()=>__gs.act('edgeWear'));await p.waitForTimeout(400);await p.click('#dlgOk');await p.waitForTimeout(300);
 const ew1=await comp('base',[[64,28],[64,48],[5,5]]);console.log('edgewear',JSON.stringify([ew0,ew1]));ok(JSON.stringify(ew0)!==JSON.stringify(ew1),'edge wear changes the colour along the shape');
 await run('aoFromNormal');let an=await comp('ao',[[64,20]]);console.log('aoN',JSON.stringify(an));
 await run('heightFromNormal');let hn=await comp('height',[[64,48],[5,5]]);console.log('h from n',JSON.stringify(hn));
 await p.screenshot({path:OUT+'conv.png'});const rows=await p.evaluate(()=>[...document.querySelectorAll('#layerList .lrow, #layerList [role=option]')].map(e=>e.textContent).join(' || '));console.log(rows);
 await p.evaluate(()=>__gs.setView('material'));await p.waitForTimeout(300);await p.screenshot({path:OUT+'conv-mat.png'});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
