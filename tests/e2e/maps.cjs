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
 // new PBR doc through the dialog
 await p.keyboard.press('Control+Alt+n');await p.waitForTimeout(200);
 await p.fill('#dW','300');await p.fill('#dH','200');await p.click('button.chip:has-text("PBR")');await p.click('#dlgOk');await p.waitForTimeout(400);
 let s=await p.evaluate(()=>({maps:__gs.doc.maps.join(),rows:[...document.querySelectorAll('#mapList .mrow .lname')].map(e=>e.textContent)}));
 ok(s.maps==='base,rough,metal,height,normal','PBR template maps '+s.maps);ok(s.rows.length===7,'map rows incl material+normal '+s.rows.join('|'));
 let bg=await p.evaluate(()=>__gs.mapKeysOf(__gs.layerByName('Background')).join());ok(bg==='base','background only has base '+bg);
 // switch to height, paint white
 await p.click('#mapList .mrow:has-text("Height")');await p.waitForTimeout(150);
 s=await p.evaluate(()=>({m:__gs.doc.map,v:__gs.doc.view}));ok(s.m==='height'&&s.v==='height','editing height');
 await setFG('#ffffff');await p.keyboard.press('b');await drag(50,100,250,100);
 let v=await mpx('Background','height',[[150,100],[150,20]]);ok(v&&v[0][0]>200&&v[1][3]===0,'height painted on layer '+JSON.stringify(v));
 let d=await p.evaluate(()=>__gs.mapT(__gs.layerByName('Background'),'height').depth);ok(d===16,'height stored 16-bit ('+d+')');
 let base=await mpx('Background','base',[[150,100]]);ok(base[0][0]===255&&base[0][1]===255,'base untouched (white bg) '+JSON.stringify(base));
 // composite of height shows grey default where unpainted
 let c=await p.evaluate(()=>{const t=__gs.compositeMap('height'),d=__gs.readRGBA8(t),W=__gs.doc.w;const r=[Array.from(d.slice((20*W+150)*4,(20*W+150)*4+4)),Array.from(d.slice((100*W+150)*4,(100*W+150)*4+4))];__gs.release(t);return r;});
 ok(Math.abs(c[0][0]-128)<3&&c[1][0]>200,'height composite: mid-grey default, raised where painted '+JSON.stringify(c));
 // undo removes the stroke from height
 await p.keyboard.press('Control+z');await p.waitForTimeout(100);v=await mpx('Background','height',[[150,100]]);ok(!v||v[0][3]===0,'undo clears height '+JSON.stringify(v));
 await p.keyboard.press('Control+Shift+Z');await p.waitForTimeout(100);v=await mpx('Background','height',[[150,100]]);ok(v&&v[0][0]>200,'redo');
 // switch back to base: undo from base view restores into height
 await p.keyboard.press('Shift+Alt+1');await p.waitForTimeout(100);ok(await p.evaluate(()=>__gs.doc.map)==='base','Shift+Alt+1 → base');
 await p.keyboard.press('Control+z');await p.waitForTimeout(150);s=await p.evaluate(()=>__gs.doc.map);v=await mpx('Background','height',[[150,100]]);
 ok((!v||v[0][3]===0),'undo height stroke while on base ('+s+')');await p.keyboard.press('Control+Shift+Z');await p.waitForTimeout(100);
 // paint base red on a new layer, then move the layer: both maps move
 await p.keyboard.press('Shift+Alt+1');await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(100);
 const lname=await p.evaluate(()=>__gs.doc.active.name);
 await setFG('#ff0000');await drag(40,40,80,40);
 await p.keyboard.press('Shift+Alt+4');await setFG('#ffffff');await drag(40,40,80,40);await p.keyboard.press('Shift+Alt+1');
 ok((await p.evaluate(n=>__gs.mapKeysOf(__gs.layerByName(n)).join(),lname))==='base,height','new layer has base+height');
 await p.keyboard.press('v');await drag(60,40,60,140,{steps:6});await p.keyboard.press('Enter');await p.waitForTimeout(200);
 let a=await mpx(lname,'base',[[60,40],[60,140]]),h=await mpx(lname,'height',[[60,40],[60,140]]);
 ok(a[0][3]===0&&a[1][0]>200&&h[0][3]===0&&h[1][0]>200,'move carries base and height '+JSON.stringify([a,h]));
 await p.keyboard.press('Control+z');await p.waitForTimeout(150);h=await mpx(lname,'height',[[60,40]]);ok(h[0][0]>200,'undo move restores height');await p.keyboard.press('Control+Shift+Z');await p.waitForTimeout(150);
 // merge down merges both maps
 await p.keyboard.press('Control+e');await p.waitForTimeout(200);
 h=await mpx('Background','height',[[60,140],[150,100]]);ok(h&&h[0][0]>200&&h[1][0]>200,'merge down merges height '+JSON.stringify(h));
 // layer via copy with selection copies all maps
 await p.keyboard.press('m');await drag(100,80,200,120);await p.keyboard.press('Control+j');await p.waitForTimeout(200);
 const cn=await p.evaluate(()=>__gs.doc.active.name);s=await p.evaluate(n=>__gs.mapKeysOf(__gs.layerByName(n)).join(),cn);ok(s==='base,height','layer via copy has both maps '+s+' '+cn);
 h=await mpx(cn,'height',[[150,100],[60,140]]);ok(h[0][0]>200&&h[1][3]===0,'copied height only in selection '+JSON.stringify(h));
 await p.keyboard.press('Control+d');
 // crop
 await p.evaluate(()=>{});await p.keyboard.press('c');await p.waitForTimeout(150);
 await p.fill('#cr_w','200');await p.press('#cr_w','Tab');await p.fill('#cr_h','150');await p.press('#cr_h','Tab');await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('Enter');await p.waitForTimeout(300);
 s=await p.evaluate(()=>[__gs.doc.w,__gs.doc.h]);h=await mpx('Background','height',[[100,75]]);
 ok(s.join()==='200,150'&&h&&h[0][0]>200,'crop crops height '+s+' '+JSON.stringify(h));
 await p.keyboard.press('Control+z');await p.waitForTimeout(300);s=await p.evaluate(()=>[__gs.doc.w,__gs.doc.h]);h=await mpx('Background','height',[[150,100]]);ok(s.join()==='300,200'&&h[0][0]>200,'crop undo');
 await p.keyboard.press('b');
 // image size resamples maps
 await p.evaluate(()=>{});
 // remove height map, undo
 await p.evaluate(()=>__gs.setDocMaps(['base','rough','metal','normal']));s=await p.evaluate(()=>({m:__gs.doc.maps.join(),k:__gs.mapKeysOf(__gs.layerByName('Background')).join()}));
 ok(s.m==='base,rough,metal,normal'&&s.k==='base','remove height map '+JSON.stringify(s));
 await p.keyboard.press('Control+z');await p.waitForTimeout(200);h=await mpx('Background','height',[[150,100]]);ok(h&&h[0][0]>200,'undo restores height map');
 // views
 await p.click('#mapList .mrow:has-text("Material")');await p.waitForTimeout(200);s=await p.evaluate(()=>({m:__gs.doc.map,v:__gs.doc.view}));ok(s.v==='material'&&s.m==='base','material view keeps editing base '+JSON.stringify(s));
 await p.screenshot({path:OUT+'maps-panel.png'});
 // anim mode forces base
 await p.keyboard.press('Shift+Alt+4');await p.evaluate(()=>__gs.setMode('anim',true));s=await p.evaluate(()=>({m:__gs.doc.map,mode:__gs.mode}));ok(s.m==='base'&&s.mode==='anim','anim forces base '+JSON.stringify(s));
 await p.evaluate(()=>__gs.setMode('paint',true));
 // layer blend mode per map
 await p.keyboard.press('Shift+Alt+4');s=await p.textContent('#lModeName');ok(s==='Linear Light','height default blend shows Linear Light ('+s+')');await p.keyboard.press('Shift+Alt+1');
 s=await p.textContent('#lModeName');ok(s==='Normal','base blend Normal');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
