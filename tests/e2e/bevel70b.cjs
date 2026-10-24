/* 0.70: Reset bevel to default, Metal view button, and no patchy bevel (the full-quality result is swapped in when complete). */
const {chromium}=require('playwright');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);const W=ms=>p.waitForTimeout(ms||300);
 await p.evaluate(()=>{const G=__gs;G.closeWelcome();G.setMode('p3d',true);G.useModel(G.primMesh('cube',1));G.cmdNewFillLayer({name:'Red',maps:{base:{c:[.85,.06,.03]}}});Object.assign(G.v3s(),{unlit:false,wire:false,spin:false,bg:'dark'});G.mir3.show=false;G.composite();G.v3Refresh();});await W(1000);
 const grab=()=>p.evaluate(()=>{const G=__gs,F=G.v3Targets(160,160);G.v3Render(F);const a=G.captureRegionNow({fbo:F.rf,w:F.w,h:F.h,depth:8},0,0,F.w,F.h).data;const sm=[];for(let i=0;i<a.length;i+=8)sm.push(a[i]+a[i+1]*3+a[i+2]*7);return {sm,err:G.gl.getError()};});
 const md=(x,y)=>{let m=0;for(let i=0;i<x.sm.length;i++)m=Math.max(m,Math.abs(x.sm[i]-y.sm[i]));return m;};
 const base=await grab();
 await p.locator('#v3Metal').click();await W(500);const metal=await grab();
 ok(await p.evaluate(()=>__gs.v3s().metalView)===true&&md(base,metal)>40&&metal.err===0,'the Metal button shows the model as polished metal');
 await p.locator('#v3Metal').click();await W(400);ok(md(base,await grab())<4,'clicking Metal again goes back');
 /* reset */
 await p.evaluate(()=>{const o=__gs.bvSettings();Object.assign(o,{on:true,width:3.3,angle:77,samples:60,profile:'chamfer',soft:.7,convex:.2,isect:0,mats:{a:.5}});__gs.showPanel('shading');__gs.renderShading();});await W(800);
 ok(await p.locator('#bkBevelReset').count()===1,'the Bevel shader has a Reset button');
 await p.locator('#bkBevelReset').click();await W(600);
 const o=await p.evaluate(()=>{const o=__gs.bvSettings();return {on:o.on,width:o.width,angle:o.angle,samples:o.samples,profile:o.profile,soft:o.soft,convex:o.convex,isect:o.isect,mats:Object.keys(o.mats||{}).length};});
 ok(o.on===true&&o.width===.5&&o.angle===30&&o.samples===24&&o.profile==='round'&&o.soft===0&&o.convex===1&&o.isect===1&&o.mats===0,'Reset puts every bevel setting back to default and keeps it on '+JSON.stringify(o));
 /* no patches: after a camera move the whole picture is rounded at once */
 await p.evaluate(()=>{Object.assign(__gs.bvSettings(),{on:true,preview:true,width:4,samples:32});__gs.bvChanged();});
 for(let i=0;i<120;i++){await W(1000);if(/ready/i.test(await p.evaluate(()=>__gs.bvStatusText())))break;}
 const still=await grab();
 await p.evaluate(()=>{__gs.v3.cam.yaw+=.3;__gs.v3.dirty=true;});await W(100);
 const first=await grab();/* the first picture after the move */
 for(let i=0;i<120;i++){await W(1000);if(/ready/i.test(await p.evaluate(()=>__gs.bvStatusText())))break;}
 const settled=await grab();
 ok(md(first,settled)<60,'right after a move the bevel is already there everywhere (no patchwork): max difference to the settled picture '+md(first,settled));
 ok(errs.length===0,'no application errors '+errs.slice(0,2).join(' | '));await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
