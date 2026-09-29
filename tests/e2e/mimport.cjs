/* 0.27: Materials › From textures: sorting downloaded textures (ambientCG, Poly Haven…) into a material */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* names from the sites */
 const names={'Bricks076C_2K-PNG_Color.png':'base','Bricks076C_2K-PNG_NormalGL.png':'normal','Bricks076C_2K-PNG_NormalDX.png':'normal','Bricks076C_2K-PNG_Roughness.png':'rough',
   'Bricks076C_2K-PNG_Displacement.png':'height','Bricks076C_2K-PNG_AmbientOcclusion.png':'ao','Metal012_Metalness.jpg':'metal','brick_wall_001_diff_2k.jpg':'base','brick_wall_001_nor_gl_2k.png':'normal',
   'brick_wall_001_arm_2k.jpg':'arm','brick_wall_001_rough_2k.jpg':'rough','brick_wall_001_disp_2k.png':'height','Wood_BaseColor.png':'base','Wood_Emissive.png':'emis','Leaves_Opacity.png':'opac',
   'Bricks076C.png':null,'Bricks076C_PREVIEW.jpg':null,'wood_gloss.png':'gloss'};
 const got=await p.evaluate(n=>{const o={};for(const k in n){const c=__gs.miChannel(k);o[k]=c?c.k+(c.dx?'/dx':''):null;}return o;},names);
 const wrong=Object.keys(names).filter(k=>(got[k]||'').split('/')[0]!==(names[k]||''));
 ok(!wrong.length,'texture names sorted into channels'+(wrong.length?' (wrong: '+wrong.map(k=>k+'→'+got[k]).join(', ')+')':''));
 ok(got['Bricks076C_2K-PNG_NormalDX.png']==='normal/dx'&&got['Bricks076C_2K-PNG_NormalGL.png']==='normal','DirectX and OpenGL normals told apart');
 ok(await p.evaluate(()=>__gs.miName(['brick_wall_001_diff_2k.jpg','brick_wall_001_nor_gl_2k.png']))==='Brick wall 001','a name from the shared words');
 /* a Poly Haven style set as images: colour, OpenGL normal, packed ARM; plus a DirectX normal that must lose to the GL one */
 const rec=await p.evaluate(async()=>{const mk=(c,name)=>new Promise(res=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d');x.fillStyle=c;x.fillRect(0,0,64,64);cv.toBlob(bl=>res(new File([bl],name)),'image/png');});
   const fs=[await mk('rgb(200,40,40)','rock_diff_1k.png'),await mk('rgb(128,100,255)','rock_nor_gl_1k.png'),await mk('rgb(128,200,255)','rock_nor_dx_1k.png'),await mk('rgb(50,150,250)','rock_arm_1k.png'),await mk('#888','rock_1k.png')];
   const r=await __gs.miBuild(fs,'',32);const px=k=>Array.from(r.imgs[k].data.slice(0,3));
   return {name:r.name,ch:Object.keys(r.imgs).sort().join(),w:r.imgs.base.w,base:px('base'),n:px('normal'),ao:px('ao'),rough:px('rough'),metal:px('metal'),src:r.fill.maps.rough.src+'/'+r.fill.maps.metal.src};});
 ok(rec.ch==='ao,base,metal,normal,rough','channels found: '+rec.ch);
 ok(rec.ao[0]===50&&rec.rough[0]===150&&rec.metal[0]===250,'ARM unpacked into AO, roughness and metal '+JSON.stringify([rec.ao,rec.rough,rec.metal]));
 ok(rec.n[1]===100,'the OpenGL normal wins over the DirectX one '+rec.n);
 ok(rec.w===32&&rec.base[0]===200,'pictures scaled to the chosen size, colours kept '+rec.w+' '+rec.base);
 /* a .zip (ambientCG style) with a DirectX normal only: green flipped */
 const z=await p.evaluate(async()=>{const mk=(c,name)=>new Promise(res=>{const cv=document.createElement('canvas');cv.width=cv.height=16;const x=cv.getContext('2d');x.fillStyle=c;x.fillRect(0,0,16,16);cv.toBlob(async bl=>res({name,data:new Uint8Array(await bl.arrayBuffer())}),'image/png');});
   const zip=await __gs.makeZipMulti([await mk('rgb(10,200,10)','Grass001_1K-PNG_Color.png'),await mk('rgb(128,60,255)','Grass001_1K-PNG_NormalDX.png'),await mk('#666','Grass001_1K-PNG_Roughness.png')]);
   const files=await __gs.miUnzip(await zip.arrayBuffer());const r=await __gs.miBuild(files,'Grass001',0);
   return {files:files.map(f=>f.name).sort().join(),ch:Object.keys(r.imgs).sort().join(),n:Array.from(r.imgs.normal.data.slice(0,3)),name:r.name};});
 ok(z.files.split(',').length===3&&z.ch==='base,normal,rough','a .zip is read ('+z.files+')');
 ok(z.n[1]===255-60,'a DirectX normal is flipped to OpenGL '+z.n);
 /* the button and dialog */
 await p.evaluate(()=>__gs.showPanel('mats'));await W(300);
 ok(await p.locator('#matFromTex').isVisible(),'Materials has a From textures… button');
 await p.click('#matFromTex');await W(200);ok(await p.locator('#miFolder').isVisible()&&await p.locator('#miFiles').isVisible(),'it offers a folder, or images / a .zip');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
