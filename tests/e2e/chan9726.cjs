/* 0.97.26: Scattering, Scatter colour, Translucency, Specular level and channels of your own; Material slots in the Shader panel (Georgian via Kenn) */
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
 await p.evaluate(()=>{const s=__gs.v3s();s.model='sphere';__gs.v3LoadModel&&__gs.v3LoadModel(true);});await W(800);
 const shot=()=>p.evaluate(()=>{__gs.v3.dirty=true;return Array.from(__gs.v3Offscreen(200,160));});
 const diff=(a,b)=>{let d=0;for(let i=0;i<a.length;i+=4)d+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);return d/(a.length/4);};
 /* picking Skin in the Shader panel adds its channels (Painter's half) */
 await p.evaluate(()=>{__gs.showPanel('shading');__gs.renderShading();});await W(300);
 await p.selectOption('#shKind','skin');await W(600);
 ok(await p.evaluate(()=>['sss','sssc','trans'].every(k=>__gs.doc.maps.includes(k))),'choosing Skin adds Scattering, Scatter colour and Translucency');
 await p.evaluate(()=>__gs.renderShading());await W(200);
 ok(await p.evaluate(()=>!!document.getElementById('shSlots')&&document.getElementById('slot_sss').value==='paint'&&document.getElementById('slot_rough').value!=='pic'),'the Material slots list shows each input and where it comes from');
 /* a material that sets each channel; changing it changes the model */
 const fill=o=>p.evaluate(o=>{const g=__gs;let L=g.layerByName('Skin test');if(!L){g.cmdNewFillLayer();L=g.doc.active;L.name='Skin test';}for(const k in L.fill.maps)L.fill.maps[k].on=false;
   for(const [k,v] of Object.entries(o))Object.assign(L.fill.maps[k],{on:true,src:'value'},Array.isArray(v)?{c:v}:{v});g.fillRender(L);g.changedAll();g.setView('material');},o);
 await fill({sss:1,trans:1});await W(900);const full=await shot();
 await fill({sss:0,trans:1});await W(900);const noS=await shot();
 ok(diff(full,noS)>0.5,'painting Scattering black changes the skin '+diff(full,noS).toFixed(2));
 await fill({sss:1,sssc:[.1,.9,.2]});await W(900);const green=await shot();
 ok(diff(full,green)>0.5,'a green Scatter colour changes the skin '+diff(full,green).toFixed(2));
 await p.evaluate(()=>__gs.shadeEdit(d=>{d.p.skin=Object.assign({},__gs.shParams(d,'skin'),{transmission:1});}));
 await p.evaluate(()=>{__gs.v3s().sunAz=220;__gs.v3s().sunEl=10;__gs.v3s().sunI=2;});
 await fill({sss:1,trans:1});await W(900);const tr1=await shot();await fill({sss:1,trans:0});await W(900);const tr0=await shot();
 ok(diff(tr1,tr0)>0.05,'Translucency changes the light coming through '+diff(tr1,tr0).toFixed(3));
 /* Specular level (Metal/Rough) */
 await p.selectOption('#shKind','std');await W(400);
 await p.evaluate(()=>__gs.setDocMaps(__gs.doc.maps.concat('specl'),'Specular level'));await W(300);
 await fill({specl:0,rough:.25});await W(900);const s0=await shot();await fill({specl:1,rough:.25});await W(900);const s1=await shot();
 ok(diff(s0,s1)>0.5,'Specular level changes the shine '+diff(s0,s1).toFixed(2));
 /* channels of your own: named, exported */
 await p.evaluate(()=>{__gs.doc.mapDef=Object.assign({},__gs.doc.mapDef,{'name:u1':'Wetness'});__gs.setDocMaps(__gs.doc.maps.concat('u1'),'Wetness');});await W(200);
 ok(await p.evaluate(()=>__gs.MAP_DEFS.u1.label==='Wetness'&&__gs.MAP_DEFS.u1.grey),'a channel of your own carries its name');
 const outs=await p.evaluate(()=>__gs.texOutputs(__gs.TEX_PRESETS.unreal).map(o=>o.s));
 ok(['Scattering','ScatterColour','Translucency','SpecularLevel','Wetness'].every(s=>outs.includes(s)),'the export lists the new channels as their own files '+outs.join(','));
 /* the Document maps window: name box for your own channel */
 await p.evaluate(()=>__gs.dlgMaps());await W(300);
 ok(await p.evaluate(()=>document.getElementById('mpn_u1')?.value==='Wetness'&&!!document.getElementById('mp_u2')),'Document maps has a name box and a free slot for another channel of your own');
 await p.keyboard.press('Escape');await W(200);
 /* Value takes a channel out */
 await p.evaluate(()=>{__gs.v3ShadeOf&&0;});await p.selectOption('#shKind','skin');await W(400);
 await p.evaluate(()=>{const L=__gs.layerByName('Skin test');L.fill.maps.trans.on=false;__gs.fillRender(L);__gs.slotValue('trans');});await W(400);
 const dlg=await p.$('#modal:not([hidden]) .dlg-actions button.primary, #modal:not([hidden]) .dlg-ok');if(dlg){await dlg.click();await W(300);}
 ok(await p.evaluate(()=>!__gs.doc.maps.includes('trans')),'Value takes Translucency out of the set');
 /* Picture… on a slot goes into that channel of the selected material */
 const pic=await p.evaluate(async()=>{const g=__gs;const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle='#808080';x.fillRect(0,0,32,32);
   const f=new File([await new Promise(r=>c.toBlob(r,'image/png'))],'Ears_Translucency.png',{type:'image/png'});const L=g.layerByName('Skin test');g.selectOnly(L);const n0=g.doc.root.children.length;
   await g.slotPicture('trans',f);const m=L.fill.maps.trans;return {on:m.on,src:m.src,name:m.name,same:g.doc.active===L,added:g.doc.root.children.length-n0,inMaps:g.doc.maps.includes('trans')};});
 ok(pic.on&&pic.src==='image'&&pic.name==='Ears_Translucency.png'&&pic.same&&pic.added===0&&pic.inMaps,'Picture… puts the image into the selected material’s Translucency channel '+JSON.stringify(pic));
 /* PSD: each channel as a layered PSD, and a layered PSD into a channel */
 const psd=await p.evaluate(async()=>{const g=__gs;await g.loadPaint();const L=g.layerByName('Skin test');L.fill.maps.rough.on=true;L.fill.maps.rough.v=.8;g.fillRender(L);
   const files=await g.psdChannelFiles('Helmet'),f=files.find(x=>/Roughness\.psd$/.test(x.name));if(!f)return {names:files.map(x=>x.name)};
   const r=agPsd.readPsd(f.data.buffer.slice(f.data.byteOffset,f.data.byteOffset+f.data.byteLength),{useImageData:true});
   const before=g.doc.root.children.length,G=await g.psdIntoChannel(f.data.buffer.slice(f.data.byteOffset,f.data.byteOffset+f.data.byteLength),'Helmet rough','u1');
   const leaves=[];const w=n=>{if(n.children)n.children.forEach(w);else leaves.push(n);};w(G);
   return {names:files.map(x=>x.name),layers:(r.children||[]).length,w:r.width,count:g.doc.root.children.length-before,inU1:leaves.some(n=>n.maps&&n.maps.u1&&!n.maps.u1.empty),blank:leaves.every(n=>n.blankBase),chan:g.doc.map};});
 ok(psd.names&&psd.names.includes('Helmet_BaseColour.psd')&&psd.names.includes('Helmet_Roughness.psd')&&psd.names.includes('Helmet_Wetness.psd'),'each channel is saved as its own PSD '+(psd.names||[]).join(','));
 ok(psd.layers>=2,'the PSD keeps the layers ('+psd.layers+' layers, '+psd.w+' px)');
 ok(psd.count===1&&psd.inU1&&psd.blank&&psd.chan==='u1','a layered PSD comes into a channel as one folder that paints only that channel '+JSON.stringify(psd));
 /* focal length, linked to the view angle */
 const lens=await p.evaluate(()=>{const g=__gs,s=g.v3s();s.fov=40;const box=document.createElement('div');box.id='lensTest';box.append(...g.lensBox(s));document.body.append(box);
   const mm=document.getElementById('v3Mm');mm.value='85';mm.dispatchEvent(new Event('input',{bubbles:true}));const fovAfterMm=s.fov;
   document.querySelector('#v3Lens [data-mm="24"]').click();const fov24=s.fov;box.remove();
   return {mm50:g.mmToFov(50).toFixed(1),back:Math.round(g.fovToMm(g.mmToFov(85))),fovAfterMm:+fovAfterMm.toFixed(1),fov24:+fov24.toFixed(1)};});
 ok(lens.mm50==='27.0'&&lens.back===85&&Math.abs(lens.fovAfterMm-16.1)<.2&&Math.abs(lens.fov24-53.1)<.2,'50 mm is a 27° view and the two stay linked '+JSON.stringify(lens));
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
