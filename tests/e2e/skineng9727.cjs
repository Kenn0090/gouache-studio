/* 0.97.27: the skin in the game engines (scatter, translucency and fuzz with their maps), and Specular reflectivity
   exported as Metallic + Base colour */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:64,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 const skinP={fuzz:.6,fuzzScale:1.5,fcol:[.9,.8,.7],tcol:[1,.4,.2],transmission:.7,transDepth:2,surface:.5,oil:.2};
 /* Godot: the shared Skin shader and the set's material */
 const g=await p.evaluate(P=>{const sh={kind:'skin',p:{skin:P}},T={BaseColor:{name:'R_Body_BaseColor.png'},ORM:{name:'R_Body_ORM.png'},SkinMask:{name:'R_Body_SkinMask.png'},ScatterColour:{name:'R_Body_ScatterColour.png'}};
   const f=__gs.eshFiles('godot','Rock',{Body:{sh,tex:T,alpha:false}},1),dec=x=>new TextDecoder().decode(x.data);
   return {shader:dec(f.find(x=>/Skin\.gdshader$/.test(x.name))),tres:dec(f.find(x=>x.name==='Body.tres'))};},skinP);
 ok(/render_mode[^;]*sss_mode_skin/.test(g.shader)&&/uniform sampler2D skin_tex/.test(g.shader)&&/SSS_STRENGTH = scatter_strength \* skm\.r/.test(g.shader),'Godot skin: skin mode, the skin mask scales the scatter');
 ok(/SSS_TRANSMITTANCE_BOOST = transmission \* skm\.g/.test(g.shader)&&/RIM = fz/.test(g.shader)&&/scatter_colour_tex/.test(g.shader),'…translucency from the mask, fuzz as rim light, the scatter colour map');
 ok(/skin_tex = ExtResource/.test(g.tres)&&/scatter_colour_tex = ExtResource/.test(g.tres)&&/has_scatter_colour = true/.test(g.tres)&&/shader_parameter\/fuzz = 0\.6/.test(g.tres)&&/translucency_colour = Color\(1(\.0)?, 0\.4, 0\.2, 1\)/.test(g.tres),'…the material carries the maps and the settings');
 ok(!/vec3\(/.test(g.tres),'…with Godot value names only (no vec3 in the .tres)');
 /* Unity */
 const u=await p.evaluate(P=>{const sh={kind:'skin',p:{skin:P}},T={BaseColor:{name:'R_Body_BaseColor.png'},SkinMask:{name:'R_Body_SkinMask.png'},ScatterColour:{name:'R_Body_ScatterColour.png'}};
   const f=__gs.eshFiles('unity','Rock',{Body:{sh,tex:T,alpha:false}},1),dec=x=>new TextDecoder().decode(x.data);
   return {mat:dec(f.find(x=>x.name==='Body.mat')),metas:f.map(x=>x.name),shader:__gs.ESH_UNITY_SHADER};},skinP);
 ok(/_SkinMap:\n\s+m_Texture: \{fileID: 2800000, guid: [0-9a-f]{32}/.test(u.mat)&&/_SssColMap:\n\s+m_Texture: \{fileID: 2800000, guid: [0-9a-f]{32}/.test(u.mat),'Unity: the material links the skin mask and the scatter colour map');
 ok(/_HasSssCol: 1/.test(u.mat)&&/_ShE: \{r: 0\.6, g: 1\.5/.test(u.mat),'…the fuzz settings and the scatter-colour switch');
 ok(u.metas.includes('R_Body_SkinMask.png.meta')&&u.metas.includes('R_Body_ScatterColour.png.meta'),'…texture settings for both maps');
 ok(/_SkinMap\("Skin mask/.test(u.shader)&&/TEXTURE2D\(_SkinMap\)/.test(u.shader)&&/float4 _ShP, _ShQ, _ShC, _ShD, _Skin, _Pan, _ShE; float _HasSssCol;/.test(u.shader)&&/skm\.g/.test(u.shader),'…and the URP shader reads them');
 /* Unreal */
 const ue=await p.evaluate(P=>{const sh={kind:'skin',p:{skin:P}},T={BaseColor:{name:'R_Body_BaseColor.png'},SkinMask:{name:'R_Body_SkinMask.png'},ScatterColour:{name:'R_Body_ScatterColour.png'}};
   const f=__gs.eshFiles('unreal','Rock',{Body:{sh,tex:T,alpha:false}},1);return JSON.parse(new TextDecoder().decode(f.find(x=>x.name==='gouache_unreal.gdata').data));},skinP);
 const s0=ue.sets[0];
 ok(s0.tex.SkinMask==='R_Body_SkinMask.png'&&s0.tex.ScatterColour==='R_Body_ScatterColour.png','Unreal: the setup data lists the skin maps');
 ok(s0.scalars.Fuzz===.6&&s0.scalars.HasScatterColour===1&&Math.abs(s0.scalars.Translucency-.7)<1e-6&&s0.vectors.TranslucencyColour&&s0.vectors.FuzzColour,'…and the skin settings '+JSON.stringify(s0.scalars));
 const py=require('fs').readFileSync(__dirname+'/../../assets/addons/gouache_unreal_setup.py','utf8');
 for(const n of ['SkinMaskTex','ScatterColourTex','TranslucencyColour','FuzzColour','FuzzScale','FuzzOcclusion','SkinRoughness','Oiliness','HasScatterColour','Translucency'])ok(py.includes('"'+n+'"'),'…the Skin master has '+n);
 ok(/"SkinMask": "SkinMaskTex"/.test(py),'…and each instance gets the skin mask');
 /* the whole export with a Skin set: a SkinMask picture */
 await p.evaluate(()=>{const P=__gs.platform;window.__written={};P.isDesktop=true;P.invoke=async(cmd,a)=>{if(cmd==='dir_files')return [[a.dir+'/project.godot',0,0]];return null;};
   P.writeFile=async(path,bytes)=>{window.__written[path]=bytes.length;};P.pickFolder=async()=>'C:/proj';});
 await p.evaluate(()=>{__gs.doc.v3shade={kind:'skin',p:{skin:Object.assign({},__gs.SH_DEF.skin)}};__gs.setDocMaps(__gs.doc.maps.filter(k=>!['sss','trans','fuzzm','sssc'].includes(k)).concat('sss','trans'),'skin');
   const g=__gs;g.es.to='godot';g.es.dirs.godot='C:/proj';g.texCfg.name='Rock';g.texCfg.preset='urp';g.texCfg.model='none';g.texCfg.size=64;g.texCfg.engShader=true;});
 await p.evaluate(()=>__gs.exportTextures());await W(6000);
 let w=Object.keys(await p.evaluate(()=>window.__written));
 ok(w.some(x=>/SkinMask\.png$/.test(x)),'a Skin set exports its SkinMask picture '+JSON.stringify(w.map(x=>x.split('/').pop())).slice(0,400));
 ok(!w.some(x=>/SkinMask.*SkinMask/.test(x))&&w.filter(x=>/Scattering\.png$/.test(x)).length<=2,'…without extra copies of the channel files');
 /* Specular reflectivity → Metallic + Base colour */
 const sm=await p.evaluate(()=>{__gs.doc.v3shade={kind:'std',p:{std:{refl:'spec',specDef:[1,1,1]}}};__gs.setDocMaps(__gs.doc.maps.filter(k=>k!=='metal'&&k!=='specc'),'spec');
   const on=__gs.texSpecMetal(),pad=__gs.texPadBegin(__gs.doc.w),A=__gs.texSpecSolve(pad,__gs.doc.w,__gs.doc.h);__gs.texPadEnd(pad);
   const outs=__gs.texOutputs(__gs.GLTF_TEX).map(o=>o.s);
   __gs.doc.v3shade.p.std.specDef=[.22,.22,.22];const pad2=__gs.texPadBegin(__gs.doc.w),B=__gs.texSpecSolve(pad2,__gs.doc.w,__gs.doc.h);__gs.texPadEnd(pad2);
   const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;__gs.doc.v3shade={kind:'std',p:{}};return {on,mHigh:avg(A.metal),mLow:avg(B.metal),outs,off:__gs.texSpecMetal()};});
 ok(sm.on&&!sm.off,'Specular reflectivity is noticed on export');
 ok(sm.mHigh>.9&&sm.mLow<.02,'a white specular colour turns into metal, the usual 4% into none ('+sm.mHigh.toFixed(3)+', '+sm.mLow.toFixed(3)+')');
 ok(sm.outs.includes('ORM'),'…and the ORM picture is written even without a Metallic channel '+JSON.stringify(sm.outs));
 ok(!errs.length,'no page errors '+errs.join(' | ').slice(0,400));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
