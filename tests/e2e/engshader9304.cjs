/* 0.27: Send an export straight into Blender, Unity, Godot or Unreal (desktop, with a stand-in for the disk) */
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
 /* the browser version only explains */
 await p.evaluate(()=>__gs.dlgExportTextures());await W(300);
 ok(await p.locator('#txSend').count()===0&&await p.evaluate(()=>/desktop app/.test(document.querySelector('#dlgBody').textContent)),'the browser version says sending needs the desktop app');
 await p.click('#dlgCancel');await W(200);
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 await p.evaluate(()=>{const P=__gs.platform;window.__written={};P.isDesktop=true;
   P.invoke=async(cmd,a)=>{if(cmd==='dir_files')return [[a.dir+'/project.godot',0,0]];return null;};
   P.writeFile=async(path,bytes)=>{window.__written[path]=bytes.length<60000&&/\.(gdshader|tres|shader|mat|meta|json|gdata|py)$/.test(path)?new TextDecoder().decode(bytes):'(binary '+bytes.length+')';};P.pickFolder=async()=>'C:/proj';});
 /* every shader kind makes a Godot shader and a Unity material */
 const kinds=['std','skin','aniso','velvet','toon','cel','specgloss','panner','retro'];
 const res=await p.evaluate(kinds=>kinds.map(k=>{const sh={kind:k,p:{}},have={base:true,orm:true,normal:true,emis:true};
   const g=__gs.eshGodotShader(k==='specgloss'?'std':k,false);const f=__gs.eshFiles('unity','Rock',{Body:{sh,tex:{BaseColor:{name:'R_Body_BaseColor.png'},ORM:{name:'R_Body_ORM.png'},Normal:{name:'R_Body_Normal.png'}},alpha:false}},1);
   const gf=__gs.eshFiles('godot','Rock',{Body:{sh,tex:{BaseColor:{name:'R_Body_BaseColor.png'},ORM:{name:'R_Body_ORM.png'},Normal:{name:'R_Body_Normal.png'}},alpha:false}},1);
   return {k,g:g.slice(0,400),hasFrag:/void fragment/.test(g),unity:f.map(x=>x.name),godot:gf.map(x=>x.name),mat:new TextDecoder().decode(f.find(x=>x.name==='Body.mat').data)};}),kinds);
 for(const r of res){ok(r.hasFrag&&/shader_type spatial/.test(r.g),r.k+': a Godot shader is written');
  ok(r.unity.includes('Body.mat')&&r.unity.includes('../GouacheShaded.shader')&&r.godot.includes('Body.tres'),r.k+': Unity and Godot files listed');
  ok(new RegExp('_Kind: '+(r.k==='specgloss'?0:kinds.indexOf(r.k))+'\\b').test(r.mat),r.k+': the Unity material picks its look');}
 const toon=await p.evaluate(()=>{const f=__gs.eshFiles('godot','Rock',{Body:{sh:{kind:'toon',p:{}},tex:{},alpha:false}},2);return f.map(x=>x.name);});
 ok(toon.includes('Body_outline.tres')&&toon.includes('../_shaders/Toon.gdshader')&&toon.includes('../_shaders/Outline.gdshader'),'Toon in Godot also gets an outline material '+JSON.stringify(toon));
 /* the whole export: Godot */
 await p.evaluate(()=>{const g=__gs;g.es.to='godot';g.es.dirs.godot='C:/proj';g.texCfg.name='Rock';g.texCfg.preset='urp';g.texCfg.model='none';g.texCfg.size=64;g.texCfg.engShader=true;});
 await p.evaluate(()=>__gs.exportTextures());await W(6000);
 let w=await p.evaluate(()=>window.__written);const names=Object.keys(w).map(x=>x.split('/').slice(-2).join('/'));
 ok(names.some(x=>/_shaders\/.*\.gdshader$/.test(x))&&names.some(x=>/Rock\/.*\.tres$/.test(x)),'Godot export writes a shared .gdshader and a .tres '+JSON.stringify(names).slice(0,300));
 const tres=Object.entries(w).find(([k])=>k.endsWith('.tres')&&!k.includes('outline'));
 ok(tres&&/gd_resource type="ShaderMaterial"/.test(tres[1])&&/res:\/\/gouache\/Rock\//.test(tres[1])&&/albedo_tex/.test(tres[1])&&/res:\/\/gouache\/_shaders\//.test(tres[1]),'…the material points at the shared shader and the textures');
 /* Unity */
 await p.evaluate(()=>{const g=__gs;g.es.to='unity';g.es.dirs.unity='C:/proj';window.__written={};});
 await p.evaluate(()=>__gs.exportTextures());await W(6000);
 w=await p.evaluate(()=>window.__written);const un=Object.keys(w);
 ok(un.some(x=>/Assets\/Gouache\/GouacheShaded\.shader$/.test(x)),'Unity export writes the shared shader above the export folder '+JSON.stringify(un.map(x=>x.slice(-50))).slice(0,300));
 ok(un.some(x=>x.endsWith('.mat'))&&un.some(x=>x.endsWith('.png.meta')),'…and the material and texture settings');
 ok(un.some(x=>/Assets\/Gouache\/GouacheAssign\.cs$/.test(x)),'…and the script that gives the model its materials');
 {const mt=Object.entries(w).find(([k])=>k.endsWith('.mat'));ok(mt&&/_NormalScale: 1/.test(mt[1])&&/_RoughScale: 1/.test(mt[1]),'…the material has strength sliders');}
 const nm=Object.entries(w).find(([k])=>/Normal\.png\.meta$/.test(k));ok(nm&&/textureType: 1/.test(nm[1]),'…the normal map is set as a Normal map');
 /* Unity Built-in pipeline */
 await p.evaluate(()=>{__gs.texCfg.unityRP='builtin';window.__written={};});
 await p.evaluate(()=>__gs.exportTextures());await W(6000);
 w=await p.evaluate(()=>window.__written);const bn=Object.keys(w);
 ok(bn.some(x=>/Assets\/Gouache\/GouacheShadedBuiltin\.shader$/.test(x))&&!bn.some(x=>/GouacheShaded\.shader$/.test(x)),'Unity Built-in: its own shader is written');
 const mat=Object.entries(w).find(([k])=>k.endsWith('.mat'));ok(mat&&/5b1d8c3a7e0f4a29b6d4c8e1f2a30b17/.test(mat[1]),'…and the material points at it');
 /* Unreal */
 await p.evaluate(()=>{const g=__gs;g.es.to='unreal';g.es.dirs.unreal='C:/proj';window.__written={};});
 await p.evaluate(()=>__gs.exportTextures());await W(6000);
 w=await p.evaluate(()=>window.__written);const un2=Object.keys(w);
 const js=Object.entries(w).find(([k])=>k.endsWith('gouache_unreal.gdata')),py=Object.entries(w).find(([k])=>k.endsWith('gouache_unreal_setup.py'));
 ok(js&&py&&/Content\/Gouache\/Rock\//.test(js[0]),'Unreal export writes the setup script and its list '+JSON.stringify(un2.map(x=>x.slice(-30))).slice(0,200));
 ok(js&&JSON.parse(js[1]).sets.length>=1&&JSON.parse(js[1]).sets[0].tex.BaseColor&&JSON.parse(js[1]).sets[0].look&&JSON.parse(js[1]).sets[0].scalars.HasORM!==undefined,'…the list names the sets, their textures and settings');
 ok(py&&/unreal\.MaterialEditingLibrary/.test(py[1].length>100?py[1]:'(binary)'),'…the script is the real one');
 ok(!errs.length,'no page errors '+errs.join(' | ').slice(0,200));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
