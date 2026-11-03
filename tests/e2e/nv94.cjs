/* 0.27: Send an export straight into Blender, Unity, Godot or Unreal (desktop, with a stand-in for the disk) */
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
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* names from the sites */
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 /* the browser version only explains */
 await p.evaluate(()=>__gs.dlgExportTextures());await W(300);
 ok(await p.locator('#txSend').count()===0&&await p.evaluate(()=>/desktop app/.test(document.querySelector('#dlgBody').textContent)),'the browser version says sending needs the desktop app');
 await p.click('#dlgCancel');await W(200);
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 /* the browser version only explains */
 await p.evaluate(()=>__gs.nvOpen());await W(200);
 ok(await p.evaluate(()=>/desktop app/.test(document.body.textContent)),'the browser says the new viewer is in the desktop app');
 /* pretend to be the desktop app and catch what would go to the viewer */
 await p.evaluate(()=>{const P=__gs.platform;P.isDesktop=true;window.__calls=[];window.__ups=[];
   P.invoke=async(cmd,body)=>{if(cmd==='viewer_update'){const dv=new DataView(body.buffer,body.byteOffset,body.byteLength),jl=dv.getUint32(0,true),meta=JSON.parse(new TextDecoder().decode(body.slice(4,4+jl)));window.__ups.push({meta,len:body.length,jl});return true;}if(cmd==='viewer_open'){const dv=new DataView(body.buffer,body.byteOffset,body.byteLength),jl=dv.getUint32(0,true),meta=JSON.parse(new TextDecoder().decode(body.slice(4,4+jl)));
       let need=4+jl+(meta.pos+meta.nrm+meta.uv)*4;for(const g of meta.groups)need+=g.idx*4+g.tex.base+g.tex.orm+g.tex.normal+g.tex.emissive;if(meta.env)need+=meta.env.w*meta.env.h*12;
       const g0=meta.groups[0],o=4+jl+(meta.pos+meta.nrm+meta.uv)*4+g0.idx*4,png=g0.tex.base?Array.from(body.slice(o,o+4)):null;
       window.__calls.push({cmd,len:body.length,need,meta,png});return {name:'Test card',backend:'Vulkan',kind:'DiscreteGpu',software:false};}return null;};});
 await p.evaluate(()=>__gs.nvOpen());await W(3000);
 const c=await p.evaluate(()=>window.__calls.find(x=>x.cmd==='viewer_open'));
 ok(!!c,'the new viewer is asked to open');
 const m=c&&c.meta;
 ok(m&&m.pos>0&&m.groups.length>=1&&m.groups[0].idx>0,'it sends the model and at least one material '+JSON.stringify(m&&{pos:m.pos,groups:m.groups.map(g=>g.name+':'+g.idx)}));
 ok(c&&c.len===c.need,'the body is exactly as long as its description says ('+(c&&c.len)+')');
 ok(m&&m.groups[0].tex.base>0&&c.png&&c.png[0]===137&&c.png[1]===80,'the material’s base colour goes as a PNG picture');
 ok(m&&m.settings&&typeof m.settings.tone==='number'&&m.settings.env_strength>0,'the 3D view’s lighting settings go with it '+JSON.stringify(m&&m.settings));
 ok(m&&m.groups[0].sh&&m.groups[0].sh.k===0&&m.groups[0].sh.p.length===4&&m.groups[0].sh.c.length===3,'each material carries its shader and settings '+JSON.stringify(m&&m.groups[0].sh).slice(0,120));
 await p.evaluate(()=>{__gs.doc.v3shade={kind:'toon',p:{toon:{steps:4,outline:3}}};window.__calls=[];});
 await p.evaluate(()=>__gs.nvOpen());await W(3000);
 const c2=await p.evaluate(()=>window.__calls.find(x=>x.cmd==='viewer_open'));
 ok(c2&&c2.meta.groups[0].sh.k===4&&c2.meta.groups[0].sh.p[0]===4&&c2.meta.groups[0].sh.q[0]===3,'a Toon set goes with its bands and outline width '+JSON.stringify(c2&&c2.meta.groups[0].sh).slice(0,140));
 ok(m&&(m.env===null||(m.env.w>0&&m.env.h>0)),'and the environment picture ('+JSON.stringify(m&&m.env)+')');
 ok(await p.evaluate(()=>/New viewer open on Test card/.test(document.body.textContent)),'it tells you what it runs on');
 /* the window follows the 3D view's lighting */
 await p.evaluate(()=>{window.__ups=[];__gs.v3s().envI=1.7;__gs.v3s().envBlur=.8;});await W(1200);
 let up=await p.evaluate(()=>window.__ups.slice());
 ok(up.length>=1&&up[up.length-1].meta.env_mode==='keep'&&up[up.length-1].meta.settings.env_strength===1.7&&up[up.length-1].meta.settings.env_blur===.8,'a change of strength and blur follows into the window without sending the picture again '+JSON.stringify(up.map(u=>[u.meta.env_mode,u.len])));
 await p.evaluate(()=>{window.__ups=[];__gs.v3s().env='photo';});await W(2500);
 up=await p.evaluate(()=>window.__ups.slice());
 ok(up.some(u=>u.meta.env_mode==='set'&&u.meta.env&&u.meta.env.w>0&&u.len>u.jl+1000000),'a different environment sends its picture ('+JSON.stringify(up.map(u=>[u.meta.env_mode,u.len]))+')');
 await p.evaluate(()=>{window.__ups=[];__gs.v3s().env='none';});await W(1500);
 up=await p.evaluate(()=>window.__ups.slice());
 ok(up.some(u=>u.meta.env_mode==='clear'),'turning the environment off clears it');
 /* the window follows the page's own camera */
 await p.evaluate(()=>{window.__ups=[];__gs.v3.cam.yaw+=0.7;});await W(1300);
 up=await p.evaluate(()=>window.__ups.slice());
 ok(up.some(u=>Array.isArray(u.meta.settings.cam)&&u.meta.settings.cam.length===6),'turning the 3D view in the app sends its camera to the window '+JSON.stringify(up.map(u=>u.meta.settings.cam&&u.meta.settings.cam.slice(0,3))));
 /* the ray tracing settings are in Preferences and go with the lighting */
 await p.evaluate(()=>{window.__ups=[];__gs.v3s().nvShadow=.3;__gs.v3s().nvSamples=200;});await W(1200);
 up=await p.evaluate(()=>window.__ups.slice());
 ok(up.some(u=>u.meta.settings.rt_shadow===.3&&u.meta.settings.rt_samples===200),'the ray tracing strength and quality settings follow into the window');
 await p.evaluate(()=>__gs.dlgPrefs());await W(500);await p.click('#pTab_speed');await W(400);
 ok(await p.locator('#pNvSh').count()===1&&await p.locator('#pNvQ').count()===1,'Preferences has the ray tracing sliders');
 await p.evaluate(()=>__gs.nvClose?.());
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
