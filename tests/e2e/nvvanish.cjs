/* 0.94: painting through the new viewer window: its pointer events paint with the normal brush, the changed maps go back */
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
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='warning'||m.type()==='error')console.log('CON',m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 await p.evaluate(()=>{const P=__gs.platform;P.isDesktop=true;window.__tex=[];window.__ups=[];
   P.invoke=async(cmd,body)=>{if(cmd==='viewer_open'){window.__open=Array.from(body);return {name:'Test card',backend:'Vulkan',kind:'DiscreteGpu',software:false};}
     if(cmd==='viewer_textures'){window.__tex.push(body.length);window.__tb=window.__tb||[];window.__tb.push(Array.from(body));return true;}if(cmd==='viewer_update'){const dv=new DataView(body.buffer,body.byteOffset,body.byteLength),jl=dv.getUint32(0,true);window.__ups.push(JSON.parse(new TextDecoder().decode(body.slice(4,4+jl))));return true;}return null;};});
 await p.evaluate(()=>__gs.nvOpen());await W(3500);
 ok(await p.evaluate(()=>window.__ups.some(u=>u.settings.paint===true&&u.settings.fov>0)),'painting is switched on in the window with the view\'s field of view');

 await p.evaluate(()=>{__gs.setTool('brush');__gs.setFG([1,0,0]);__gs.brush.size=40;});
 const r=await p.evaluate(()=>{const h=document.getElementById('v3Hit').getBoundingClientRect();return {w:h.width,h:h.height};});
 const cam=await p.evaluate(()=>{const e=__gs.v3Eye(),c=__gs.v3.cam;return {eye:e,tgt:[c.tx,c.ty,c.tz],fov:__gs.v3s().fov||45};});
 const ev=(t,x,y)=>Object.assign({t,x,y,w:r.w,h:r.h,shift:false,ctrl:false,alt:false},cam);
 await p.evaluate(()=>{window.__tb=[];window.__tex=[];});
 await p.evaluate(a=>__gs.nvHandle(a),ev('down',r.w/2,r.h/2));
 for(let i=0;i<14;i++){await p.evaluate(a=>__gs.nvHandle(a),ev('move',r.w/2+i*6,r.h/2+i*2));await W(60);}
 await p.evaluate(a=>__gs.nvHandle(a),ev('up',r.w/2+84,r.h/2+28));
 const cnt=async()=>p.evaluate(async()=>{const sv=Object.assign({},__gs.texCfg);__gs.texCfg.size=1024;__gs.texCfg.pad='none';try{const f=(await __gs.buildTextures(__gs.GLTF_TEX,'preview')).find(f=>f.suffix==='BaseColor').data;const bm=await createImageBitmap(new Blob([f],{type:'image/png'}));const c=new OffscreenCanvas(bm.width,bm.height),x=c.getContext('2d');x.drawImage(bm,0,0);const d=x.getImageData(0,0,bm.width,bm.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>180&&d[i+1]<90&&d[i+2]<90)n++;return n;}finally{Object.assign(__gs.texCfg,sv);}});
 console.log('red right after lift:',await cnt());await W(1500);console.log('red 1.5 s later:',await cnt());await W(5000);console.log('red 6.5 s later:',await cnt());console.log('layers:',await p.evaluate(()=>__gs.doc.layers?__gs.doc.layers.map(l=>l.name+':'+(l.visible?'on':'off')).join(', '):'?'));
 /* the last picture set sent to the window: how much red does its base colour hold? */
 const res=await p.evaluate(async()=>{const out=[];for(const arr of window.__tb){const u=new Uint8Array(arr),dv=new DataView(u.buffer),jl=dv.getUint32(0,true),meta=JSON.parse(new TextDecoder().decode(u.slice(4,4+jl))),g=meta.groups[0],bl=g.tex.base;let red=0,tot=0,kind='';
   if(bl>0){const off=4+jl,bytes=u.slice(off,off+bl);if(g.raw||meta.raw||(g.tex&&g.tex.raw)){kind='raw';}
     try{const bm=await createImageBitmap(new Blob([bytes],{type:'image/png'}));const c=new OffscreenCanvas(bm.width,bm.height),x=c.getContext('2d');x.drawImage(bm,0,0);const d=x.getImageData(0,0,bm.width,bm.height).data;for(let i=0;i<d.length;i+=4){tot++;if(d[i]>180&&d[i+1]<90&&d[i+2]<90)red++;}kind='png';}catch(e){kind='raw?';}}
   out.push({kind,red,tot,partial:!!(meta.partial||g.partial),raw:g.raw||null});}return out;});
 console.log('pictures sent:',JSON.stringify(res));
 const last=res[res.length-1];
 ok(res.length>0,'pictures were sent to the window');
 ok(last&&last.kind==='png'&&last.red>200,'the last full picture set sent after the stroke holds the red paint ('+(last&&last.red)+' red pixels)');
 const docRed=await p.evaluate(async()=>{const f=(await __gs.buildTextures(__gs.GLTF_TEX,'preview')).find(f=>f.suffix==='BaseColor').data;const bm=await createImageBitmap(new Blob([f],{type:'image/png'}));const c=new OffscreenCanvas(bm.width,bm.height),x=c.getContext('2d');x.drawImage(bm,0,0);const d=x.getImageData(0,0,bm.width,bm.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>180&&d[i+1]<90&&d[i+2]<90)n++;return n;});
 ok(docRed>200,'the model\'s own base colour holds the red paint ('+docRed+' red pixels)');
 {const fs=require('fs');fs.mkdirSync(__dirname+'/out/replay',{recursive:true});const o=await p.evaluate(()=>window.__open),t=await p.evaluate(()=>window.__tb);fs.writeFileSync(__dirname+'/out/replay/open.bin',Buffer.from(o));t.forEach((a,i)=>fs.writeFileSync(__dirname+'/out/replay/tex'+i+'.bin',Buffer.from(a)));console.log('saved',t.length,'picture messages');}
 ok(errs.length===0,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
