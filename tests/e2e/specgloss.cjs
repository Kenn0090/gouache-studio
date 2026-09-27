const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const cpx=(k,x,y)=>p.evaluate(([k,x,y])=>{const t=__gs.compositeMap(k);const d=__gs.readRGBA8(t);__gs.release(t);const i=(y*__gs.doc.w+x)*4;return [d[i],d[i+1],d[i+2],d[i+3]];},[k,x,y]);
 const matpx=(x,y)=>p.evaluate(([x,y])=>{__gs.setView('material');return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const d=__gs.readRGBA8(__gs.compOut());const i=(y*__gs.doc.w+x)*4;r([d[i],d[i+1],d[i+2]]);})));},[x,y]);
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'SG',false,'pbr'));await W();
 // a red layer; the left half metal, the right half rough
 await p.evaluate(()=>{const L=__gs.allLayers()[0],g=__gs.gl||null;});
 await p.evaluate(()=>{__gs.act('addLayer');});await setFG('#c83020');await p.evaluate(()=>__gs.act('fill'));
 await p.evaluate(()=>__gs.setEditMap('metal'));await p.evaluate(()=>__gs.setTool('marquee'));
 const box2=await p.locator('#gl').boundingBox();const s2=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box2.x+v.x+x*v.z,box2.y+v.y+y*v.z];};
 const a=await s2(0,0),c=await s2(64,128);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:4});await p.mouse.up();await W(200);
 await setFG('#ffffff');await p.evaluate(()=>__gs.act('fill'));await p.evaluate(()=>__gs.act('deselect'));
 await p.evaluate(()=>__gs.setEditMap('rough'));await setFG('#333333');await p.evaluate(()=>__gs.act('fill'));await p.evaluate(()=>__gs.setEditMap('base'));await W(300);
 const m0=[await cpx('metal',20,60),await cpx('metal',100,60)];ok(m0[0][0]>250&&m0[1][0]<5,'set up: left metal, right not '+JSON.stringify(m0));
 const look0=[await matpx(20,60),await matpx(100,60)];await p.evaluate(()=>__gs.setView('base'));
 // switch to Specular/Gloss
 await p.evaluate(()=>__gs.wfSwitch('spec','convert'));await W(400);
 let st=await p.evaluate(()=>({wf:__gs.doc.workflow,maps:__gs.doc.maps.join(),groups:__gs.doc.root.children.map(n=>n.name).join('|')}));
 ok(st.wf==='spec'&&st.maps==='base,spec,gloss,height,normal','workflow and maps switched '+JSON.stringify(st));
 ok(/Diffuse \(converted\)/.test(st.groups)&&/Specular \(converted\)/.test(st.groups)&&/Glossiness \(converted\)/.test(st.groups),'one converted group per map');
 const D=[await cpx('base',20,60),await cpx('base',100,60)],S=[await cpx('spec',20,60),await cpx('spec',100,60)],G=await cpx('gloss',100,60);
 ok(D[0][0]<10&&D[1][0]>190,'diffuse: black on metal, red elsewhere '+JSON.stringify(D));
 ok(S[0][0]>180&&S[0][1]<80&&Math.abs(S[1][0]-S[1][2])<4&&S[1][0]>45&&S[1][0]<70,'specular: the red on metal, dark grey elsewhere '+JSON.stringify(S));
 ok(Math.abs(G[0]-(255-51))<4,'glossiness = 1 − roughness '+G);
 const look1=[await matpx(20,60),await matpx(100,60)];await p.evaluate(()=>__gs.setView('base'));
 const dl=(A,B)=>Math.max(...A.map((v,i)=>Math.abs(v-B[i])));
 ok(dl(look0[0],look1[0])<14&&dl(look0[1],look1[1])<14,'the material looks the same after switching '+JSON.stringify([look0,look1]));
 await p.screenshot({path:OUT+'sg-switch.png'});
 // back, restoring the layers
 await p.evaluate(()=>__gs.wfSwitch('metal','restore'));await W(400);
 st=await p.evaluate(()=>({wf:__gs.doc.workflow,maps:__gs.doc.maps.join(),groups:__gs.doc.root.children.map(n=>n.name).join('|')}));
 ok(st.wf==='metal'&&st.maps==='base,rough,metal,height,normal'&&!/converted/.test(st.groups),'restored: back to Metal/Rough, converted groups gone '+JSON.stringify(st));
 const m1=[await cpx('metal',20,60),await cpx('base',100,60),await cpx('rough',100,60)];ok(m1[0][0]>250&&m1[1][0]>190&&Math.abs(m1[2][0]-51)<3,'restored maps are the originals '+JSON.stringify(m1));
 // undo / redo the switch
 await p.evaluate(()=>__gs.undo());await W(300);ok(await p.evaluate(()=>__gs.doc.workflow)==='spec','undo goes back to Specular/Gloss');
 await p.evaluate(()=>__gs.undo());await W(300);ok(await p.evaluate(()=>__gs.doc.workflow)==='metal'&&(await cpx('metal',20,60))[0]>250,'undo again: the original document');
 await p.evaluate(()=>__gs.redo());await W(300);ok(await p.evaluate(()=>__gs.doc.workflow)==='spec'&&(await cpx('spec',20,60))[0]>180,'redo: Specular/Gloss again');

 // 3D view shades the Specular/Gloss document
 await p.evaluate(()=>__gs.act('view3d'));await W(1500);
 ok(await p.evaluate(()=>!!(__gs.v3.tex.sgBase&&__gs.v3.tex.sgMetal&&__gs.v3.tex.sgRough)),'3D view gets the equivalent base/metal/rough');
 await p.screenshot({path:OUT+'sg-3d.png'});await p.evaluate(()=>__gs.act('view3d'));await W(300);
 // export: Unity specular (RGB specular, A smoothness) and the list of presets
 const ex=await p.evaluate(async()=>{const names=Object.keys(__gs.TEX_PRESETS).filter(k=>(__gs.TEX_PRESETS[k].wf||'metal')==='spec');
   const f=await __gs.buildTextures(__gs.TEX_PRESETS.unitySG,'Wall');const sp=f.find(x=>/Specular/.test(x.name));
   const bm=await createImageBitmap(new Blob([sp.data],{type:'image/png'}),{premultiplyAlpha:'none',colorSpaceConversion:'none'});const c=new OffscreenCanvas(bm.width,bm.height),x=c.getContext('2d');x.drawImage(bm,0,0);
   const d=x.getImageData(0,0,bm.width,bm.height).data,at=(X,Y)=>Array.from(d.slice((Y*bm.width+X)*4,(Y*bm.width+X)*4+4));
   const u=await __gs.buildTextures(__gs.TEX_PRESETS.unrealSG,'Wall');
   return {names,files:f.map(x=>x.name),metal:at(20,60),rough:at(100,60),unreal:u.map(x=>x.name)};});
 ok(ex.names.length===3&&ex.files.join().includes('Wall_Albedo.png')&&ex.files.join().includes('Wall_Specular.png'),'Unity specular files '+ex.files.join());
 ok(ex.rough[3]>195&&ex.rough[3]<212&&Math.abs(ex.rough[0]-59)<6&&ex.metal[0]>180,'specular RGB with glossiness in alpha '+JSON.stringify([ex.metal,ex.rough]));
 ok(['T_Wall_D.png','T_Wall_S.png','T_Wall_G.png'].every(n=>ex.unreal.includes(n)),'Unreal spec/gloss files '+ex.unreal.join());
 await p.evaluate(()=>__gs.act('expTex'));await W(300);const opts=await p.evaluate(()=>[...document.querySelectorAll('#txPreset option')].map(o=>o.textContent));await p.click('#dlgCancel');
 ok(opts.length===3&&opts.every(t=>/spec/i.test(t)),'Export textures offers the Specular/Gloss presets '+opts.join(' | '));
 // save and reopen keeps the workflow
 await p.evaluate(async()=>{const b=await __gs.encodeGouache();window.__gbuf=await b.arrayBuffer();});await p.evaluate(async()=>{await __gs.openGouache(window.__gbuf,'t');});await W(400);
 ok(await p.evaluate(()=>__gs.doc.workflow)==='spec'&&(await cpx('spec',20,60))[0]>180,'.gouache keeps Specular/Gloss');
 // the Maps dialog: labels and the switch (converting)
 await p.evaluate(()=>__gs.act('maps'));await W(300);
 const labels=await p.evaluate(()=>[...document.querySelectorAll('#dlgBody .mapopt label')].map(l=>l.textContent.trim()));
 ok(labels.includes('Diffuse')&&labels.includes('Specular')&&labels.includes('Glossiness')&&!labels.includes('Metallic'),'Maps dialog lists the Specular/Gloss maps '+labels.join(','));
 await p.click('#dlgBody .segb:text("Metal/Rough")');await p.click('#dlgOk');await W(400);
 ok(await p.evaluate(()=>__gs.doc.workflow)==='metal'&&(await cpx('metal',20,60))[0]>240&&(await cpx('rough',100,60))[0]<60,'Maps dialog switches back to Metal/Rough, converting '+JSON.stringify([await cpx('metal',20,60),await cpx('rough',100,60)]));
 // the new document template
 await p.evaluate(()=>__gs.act('new'));await W(300);await p.click('#dlgBody .chip:text("PBR spec/gloss")');await p.fill('#dW','64');await p.fill('#dH','64');await p.click('#dlgOk');await W(400);
 ok(await p.evaluate(()=>__gs.doc.workflow==='spec'&&__gs.doc.maps.join()==='base,spec,gloss,height,normal'),'New document: PBR spec/gloss template');
 ok(await p.evaluate(()=>{__gs.setEditMap('base');return document.querySelector('#mapsList')?document.querySelector('#mapsList').textContent:'';}).then(t=>t.includes('Diffuse')||t===''),'maps list says Diffuse');
 // Convert sends glossiness and specular
 await setFG('#3070d0');await p.evaluate(()=>__gs.act('fill'));await p.click('#modeTabs [data-mode=convert]');await W(900);
 await p.evaluate(()=>{__gs.cvSetKind('photo');for(const k in __gs.cv.make)__gs.cv.make[k]=false;__gs.cv.make.rough=true;__gs.cv.make.metal=true;});await W(300);await p.click('#cvSend');await W(400);
 const cg=await p.evaluate(()=>__gs.doc.root.children.map(n=>n.name).join('|'));ok(/Converted glossiness/.test(cg)&&/Converted specular/.test(cg),'Convert sends glossiness and specular '+cg);
 await p.click('#modeTabs [data-mode=paint]');await W(300);
 ok(!errs.length,'no errors '+errs.join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
