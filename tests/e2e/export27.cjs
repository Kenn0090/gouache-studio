/* 0.27: Export window: your own packed presets, 8K, the model with its textures (.glb / .obj) */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
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
 /* your own preset: metal/rough/AO packed, DirectX normal, snake_case names */
 const pk=await p.evaluate(async()=>{const g=__gs;g.txUser=[{id:'t1',label:'Packed',normal:'dx',naming:'snake',pattern:'{name}_{s}',outs:[{s:'MRA',kind:'pack',ch:['metal','rough','ao','none']},{s:'Col',kind:'rgb',map:'base',alpha:'none'},{s:'N',kind:'rgb',map:'normal'}]}];g.txInstall();
   const pr=g.TEX_PRESETS.u_t1;const fs=await g.buildTextures(pr,'My Rock');
   const px=async f=>{const bm=await createImageBitmap(new Blob([f.data],{type:'image/png'}));const c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;const x=c.getContext('2d');x.drawImage(bm,0,0);return Array.from(x.getImageData(bm.width>>1,bm.height>>1,1,1).data);};
   return {label:pr.label,names:fs.map(f=>f.name),mra:await px(fs.find(f=>f.suffix==='MRA'))};});
 ok(pk.label==='★ Packed'&&pk.names.join()==='my_rock_MRA.png,my_rock_Col.png,my_rock_N.png','your own preset makes its files '+pk.names.join(', '));
 ok(pk.mra[0]<8&&Math.abs(pk.mra[1]-140)<6,'packed channels: R metallic 0, G roughness 55% '+pk.mra);
 /* the model: glb with textures inside */
 const glb=await p.evaluate(async()=>{const g=__gs,m=g.mxModel(),T={};for(const f of await g.buildTextures(g.GLTF_TEX,'Rock'))T[f.suffix]=f;
   const groups=g.mxGroups(m,['default']),b=g.mxGLB(m,groups,{default:T},'Rock'),dv=new DataView(b.buffer);const jl=dv.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(b.subarray(20,20+jl)));
   return {magic:dv.getUint32(0,true)===0x46546C67,len:dv.getUint32(8,true)===b.length,mats:j.materials.length,bc:!!j.materials[0].pbrMetallicRoughness.baseColorTexture,mr:!!j.materials[0].pbrMetallicRoughness.metallicRoughnessTexture,
     nt:!!j.materials[0].normalTexture,imgs:j.images.length,tris:j.accessors[j.meshes[0].primitives[0].indices].count/3,modelTris:m.idx.length/3,uv:j.meshes[0].primitives[0].attributes.TEXCOORD_0!==undefined};});
 ok(glb.magic&&glb.len,'a valid .glb');
 ok(glb.mats===1&&glb.bc&&glb.mr&&glb.nt&&glb.imgs>=3,'its material has base colour, metal/rough and normal textures inside '+JSON.stringify(glb));
 ok(glb.tris===glb.modelTris&&glb.uv,'every triangle, with UVs');
 const rt=await p.evaluate(async()=>{const g=__gs,m=g.mxModel(),b=g.mxGLB(m,g.mxGroups(m,['default']),{default:{}},'Rock');const r=await g.parseGLTF(b.buffer.slice(0),'Rock.glb');
   let d=0;for(let i=0;i<Math.min(m.pos.length,r.pos.length);i++)d=Math.max(d,Math.abs(m.pos[i]-r.pos[i]));return {n:r.pos.length===m.pos.length,tris:r.idx.length===m.idx.length,d,uv:Math.abs(r.uv[5]-m.uv[5])<1e-5};});
 ok(rt.n&&rt.tris&&rt.d<1e-5&&rt.uv,'the .glb opens again in Gouache Studio unchanged '+JSON.stringify(rt));
 /* obj + mtl */
 const obj=await p.evaluate(async()=>{const g=__gs,m=g.mxModel(),pr=g.TEX_PRESETS.blender,fs=await g.buildTextures(pr,'Rock'),o=g.mxOBJ(m,g.mxGroups(m,['default']),{default:fs},'Rock',pr);
   const t=new TextDecoder(),a=t.decode(o.obj),b=t.decode(o.mtl);return {mtllib:a.includes('mtllib Rock.mtl'),use:a.includes('usemtl default'),f:(a.match(/\nf /g)||[]).length,kd:/map_Kd Rock_BaseColor\.png/.test(b),pr:/map_Pr Rock_Roughness\.png/.test(b),nrm:/norm Rock_Normal\.png/.test(b)};});
 ok(obj.mtllib&&obj.use&&obj.f>100,'the .obj names its material and faces '+JSON.stringify(obj));
 ok(obj.kd&&obj.pr&&obj.nrm,'the .mtl points at the base colour, roughness and normal files');
 /* the window */
 await p.evaluate(()=>__gs.dlgExportTextures());await W(300);
 ok(await p.locator('#txModel').isVisible(),'Export textures offers the model');
 ok(await p.evaluate(()=>[...document.querySelectorAll('#txSize option')].some(o=>o.value==='8192')),'8K is a size');
 ok(await p.evaluate(()=>[...document.querySelectorAll('#txPreset option')].some(o=>o.textContent==='★ Packed')),'your presets are in the list');
 await p.click('#txNewPreset');await W(300);
 ok(await p.locator('#txpName').isVisible()&&await p.locator('.txprow').count()>=3,'New preset… opens the editor, starting from the chosen preset');
 await p.screenshot({path:__dirname+'/out/export27-editor.png'});
 await p.fill('#txpName','Mine');await p.click('#txpAdd');await W(100);await p.click('#dlgOk');await W(500);
 ok(await p.evaluate(()=>__gs.txUser.some(d=>d.label==='Mine')&&[...document.querySelectorAll('#txPreset option')].some(o=>o.textContent==='★ Mine')),'saving it adds it to the list');
 ok(await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gs.texPresets')||'[]');return s.length===2;}),'kept for next time');
 await p.click('#dlgCancel').catch(()=>{});
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
