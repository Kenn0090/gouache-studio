/* 0.94: things the 3D view draws over the model go to the new viewer window: a decal's landing ring, the shadow floor, the mirror copy cursors */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 await p.evaluate(()=>{const P=__gs.platform;P.isDesktop=true;window.__tex=[];window.__ups=[];
   P.invoke=async(cmd,body)=>{if(cmd==='viewer_scene'){window.__scenes=(window.__scenes||0)+1;return true;}if(cmd==='viewer_open')return {name:'Test card',backend:'Vulkan',kind:'DiscreteGpu',software:false};
     if(cmd==='viewer_textures'){const dv=new DataView(body.buffer,body.byteOffset,body.byteLength),jl=dv.getUint32(0,true);window.__tex.push(JSON.parse(new TextDecoder().decode(body.slice(4,4+jl))).groups[0]);return true;}
     if(cmd==='viewer_update'){const dv=new DataView(body.buffer,body.byteOffset,body.byteLength),jl=dv.getUint32(0,true);window.__ups.push(JSON.parse(new TextDecoder().decode(body.slice(4,4+jl))));return true;}return true;};});
 await p.evaluate(()=>__gs.nvOpen());await W(3500);
 /* a decal's landing ring */
 await p.evaluate(()=>{window.__tex.length=0;__gs.nvInd({pos:[0,0,0],n:[0,1,0],R:.3});});await W(300);
 const g=await p.evaluate(()=>window.__tex.find(x=>x.name==='__ind'));
 ok(g&&g.raw&&g.raw[0]>=64*6,'the decal ring goes to the window as lines ('+(g&&g.raw&&g.raw[0])+' numbers)');
 await p.evaluate(()=>{window.__tex.length=0;__gs.nvInd(null);});await W(300);
 ok(await p.evaluate(()=>window.__tex.some(x=>x.name==='__ind'&&x.raw[0]===6)),'it is cleared again');
 /* the shadow floor and the mirror copies in the settings */
 await p.evaluate(()=>{const s=__gs.v3s();s.floor=true;s.shadows=true;});
 const f=await p.evaluate(()=>__gs.nvSettings());
 ok(f.floor&&f.floor[3]===1&&f.rt===true,'the floor is in the settings and switches ray tracing on ('+JSON.stringify(f.floor)+')');
 /* the Bevel preview: rounded normals made for the window's own view */
 await p.evaluate(()=>{const o=window.__gs.bvSettings();o.on=true;o.preview=true;window.__gs.nv.winSize=[256,160];window.__gs.nv.isOpen=true;window.__tex.length=0;});
 const kk=await p.evaluate(()=>window.__gs.nvBevelKey());
 ok(kk&&kk.length>10,'the Bevel preview has a view key when it is on');
 await p.evaluate(()=>window.__gs.nvBevelRun());await W(500);
 for(let i=0;i<40&&!(await p.evaluate(()=>window.__tex.some(x=>x.name==='__bev')));i++)await W(500);
 const bg=await p.evaluate(()=>window.__tex.find(x=>x.name==='__bev'));
 ok(bg&&bg.raw&&bg.raw[0]===(32+256*160*4)/4,'the rounded normals go to the window as a picture of its size ('+(bg&&bg.raw&&bg.raw[0])+')');
 ok(await p.evaluate(()=>window.__ups.length>=0)&&(await p.evaluate(()=>window.__gs.nvSettings().track))===true,'the window is asked to report its camera');
 /* the window follows changes made while it is open */
 await p.evaluate(()=>{window.__tex.length=0;window.__gs.nv.mapsVer=(window.__gs.nv.mapsVer||0)+1;});
 for(let i=0;i<20&&!(await p.evaluate(()=>window.__tex.some(x=>x.tex&&x.tex.base>0)));i++)await W(500);
 ok(await p.evaluate(()=>window.__tex.some(x=>x.tex&&x.tex.base>0)),'a change to the maps sends the new pictures to the window');
 await p.evaluate(()=>{window.__tex.length=0;window.__gs.doc.v3shade={kind:'toon',p:{}};});
 for(let i=0;i<20&&!(await p.evaluate(()=>window.__tex.some(x=>x.sh&&x.sh.k===4)));i++)await W(500);
 ok(await p.evaluate(()=>window.__tex.some(x=>x.sh&&x.sh.k===4)),'a changed shader reaches the window');
 await p.evaluate(()=>{window.__scenes=0;window.__gs.v3s().detail=((window.__gs.v3s().detail)||0)+1;});
 for(let i=0;i<20&&!(await p.evaluate(()=>window.__scenes>0));i++)await W(500);
 ok(await p.evaluate(()=>window.__scenes>0),'a changed model sends the whole scene again');
 ok(errs.length===0,'no page errors '+errs.join('|'));
 await b.close();process.exit(fails?1:0);
})();
