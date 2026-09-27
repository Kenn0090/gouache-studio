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
 await p.fill('#dW','200');await p.fill('#dH','120');await p.click('button.chip:has-text("PBR")');await p.click('#dlgOk');await p.waitForTimeout(400);
 await setFG('#3366cc');await p.keyboard.press('b');
 await p.evaluate(()=>{const m=__gs.ui.mapBrush;Object.assign(m.rough,{on:true,v:.3});Object.assign(m.height,{on:true,v:.9});__gs.brush.size=20;});
 await p.keyboard.press('Control+Shift+n');await drag(20,60,180,60);
 await p.keyboard.press('Control+g');await p.waitForTimeout(100);
 // mask on group
 await p.click('#maskRow button:has-text("Add mask")').catch(()=>{});await p.waitForTimeout(100);
 // gradient live layer
 await p.keyboard.press('g');await p.click('.gpre[aria-label="Foreground to background"]');await drag(10,10,190,10);await p.keyboard.press('Enter');await p.waitForTimeout(200);
 await p.keyboard.press('b');
 // set per-map mode and nrm strength
 await p.evaluate(()=>{const L=__gs.layerByName('Layer 1')||__gs.allLayers()[1];L.mapModes={height:0};__gs.doc.nrmStr=12;__gs.doc.light.az=200;});
 await p.keyboard.press('Shift+Alt+4');
 const snap=()=>p.evaluate(()=>{const out={maps:__gs.doc.maps.join(),map:__gs.doc.map,nrm:__gs.doc.nrmStr,az:__gs.doc.light.az,layers:[]};
   const walk=(n,d)=>{for(const c of n.children){const e={t:c.type,name:c.name,d,vis:c.visible,op:c.opacity,mode:c.mode,mm:JSON.stringify(c.mapModes||{}),mask:!!c.mask,grad:!!c.grad};
     if(c.type==='layer'){e.keys=__gs.mapKeysOf(c).join();e.sums={};for(const k of __gs.mapKeysOf(c)){const d8=__gs.readRGBA8(__gs.mapT(c,k));let s=0;for(let i=0;i<d8.length;i+=7)s+=d8[i];e.sums[k]=s;}}
     if(c.mask){const d8=__gs.readRGBA8(c.mask.target);let s=0;for(let i=0;i<d8.length;i+=7)s+=d8[i];e.msum=s;}
     out.layers.push(e);if(c.children)walk(c,d+1);}};walk(__gs.doc.root,0);return out;});
 const before=await snap();
 const bytes=await p.evaluate(async()=>{const b=await __gs.encodeGouache();window.__gbuf=await b.arrayBuffer();return window.__gbuf.byteLength;});
 console.log('file bytes',bytes);
 await p.evaluate(()=>__gs.newDoc(50,50,8,[1,1,1],'x',false));
 await p.evaluate(async()=>{await __gs.openGouache(window.__gbuf,'t');});await p.waitForTimeout(300);
 const after=await snap();
 ok(JSON.stringify(before)===JSON.stringify(after),'roundtrip identical\n'+JSON.stringify(before)+'\n'+JSON.stringify(after));
 // 16-bit document + anim
 await p.evaluate(()=>__gs.newDoc(64,48,16,[1,0,0],'anim16',false));await p.evaluate(()=>__gs.setMode('anim',true));
 await setFG('#00ff00');await drag(10,10,50,40);
 const b2=await p.evaluate(async()=>{const px=__gs.readRGBA8(__gs.anim.frames[0].target);const b=await __gs.encodeGouache();window.__gbuf=await b.arrayBuffer();return Array.from(px.slice((20*64+30)*4,(20*64+30)*4+4));});
 await p.evaluate(()=>__gs.newDoc(50,50,8,[1,1,1],'x',false));await p.evaluate(async()=>{await __gs.openGouache(window.__gbuf,'t');});await p.waitForTimeout(300);
 const a2=await p.evaluate(()=>({mode:__gs.mode,n:__gs.anim&&__gs.anim.frames.length,d:__gs.doc.depth,px:Array.from(__gs.readRGBA8(__gs.anim.frames[0].target).slice((20*64+30)*4,(20*64+30)*4+4))}));
 ok(a2.mode==='anim'&&a2.n===1&&a2.d===16&&JSON.stringify(a2.px)===JSON.stringify(b2),'anim 16-bit roundtrip '+JSON.stringify([a2,b2]));
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
