/* ================= The new viewer (0.94) =================
   Kenn: a new 3D viewer in the desktop app, running on the graphics card directly (the first step towards ray traced
   looks and DLSS). It opens in its own window with the model on show, one material per texture set (base colour,
   normal, roughness / metal / occlusion, emissive), lit by the environment you chose and one sun, with an orbit
   camera (left drag turns, right drag zooms, middle drag moves, wheel zooms).
   It never takes over the normal viewer. On a computer without a usable graphics card it can run on the software
   adapter; if it cannot start at all it says so and the normal viewer carries on as it always has. */
const NV_TEX_MAX=1024;
/* the environment picture the 3D view is using, as linear floats no wider than 1024 */
async function nvEnv(){const s=v3s(),k=envOf(s);if(k==='none')return null;let img=null;
  if(k==='custom'&&env.custom)img=env.custom.img;else{const it=ENV_LIST.find(e=>e[0]===k)||ENV_LIST[0];img=parseHDR(await envBundled(it[2]));}
  if(!img||!img.rgb)return null;let {w,h,rgb}=img;
  if(w>1024){const f=Math.ceil(w/1024),W=Math.floor(w/f),H=Math.max(1,Math.floor(h/f)),o=new Float32Array(W*H*3);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){let r=0,g=0,b=0;for(let j=0;j<f;j++)for(let i=0;i<f;i++){const q=((y*f+j)*w+x*f+i)*3;r+=rgb[q];g+=rgb[q+1];b+=rgb[q+2];}const q=(y*W+x)*3,n=f*f;o[q]=r/n;o[q+1]=g/n;o[q+2]=b/n;}
    w=W;h=H;rgb=o;}
  return {w,h,rgb:rgb instanceof Float32Array?rgb:new Float32Array(rgb)};}
/* the shader of the set on show (Standard, Skin, Toon...) with its settings, as the 3D view keeps them */
function nvShader(){const sh=v3ShadeOf(doc),u=shadeUniforms(sh),P=shParams(sh),a=v=>Array.from(v||[0,0,0,0]);
  const o={k:u.uSh&&u.uSh.int!=null?u.uSh.int:0,p:a(u.uShP).slice(0,4),q:a(u.uShQ).slice(0,4),c:a(u.uShC).slice(0,3),d:a(u.uShD).slice(0,3),skin:a(u.uSkin).slice(0,4)};
  while(o.p.length<4)o.p.push(0);while(o.q.length<4)o.q.push(0);while(o.c.length<3)o.c.push(0);while(o.d.length<3)o.d.push(0);while(o.skin.length<4)o.skin.push(0);
  if(sh.kind==='panner')o.d=[P.sx||0,P.sy||0,0];return o;}
/* the model and each texture set's maps (the same maps the export makes, at preview size) */
async function nvScene(){const m=mxModel();if(!m||!m.pos||!m.idx)throw new Error('Open a model in the 3D view first.');
  const saved={size:texCfg.size,pad:texCfg.pad,meshMaps:texCfg.meshMaps,h16:texCfg.h16},texBy={},shBy={};
  try{texCfg.size=NV_TEX_MAX;texCfg.pad='none';texCfg.meshMaps=false;
    const one=async(setName)=>{const g=await buildTextures(GLTF_TEX,'preview'),T={};for(const f of g)T[f.suffix]=f.data;texBy[setName]=T;shBy[setName]=nvShader();};
    const sets=ui.mode==='p3d'?p3.sets.filter(S=>!S.missing):[];
    if(ui.mode==='p3d'&&sets.length>1){const back=p3.cur;try{for(let i=0;i<p3.sets.length;i++){if(p3.sets[i].missing)continue;p3SwitchSet(i,true);await one(p3.sets[i].name);}}finally{p3SwitchSet(back,true);}}
    else{const S=ui.mode==='p3d'&&p3.sets[p3.cur];await one(S?S.name:(doc.name||'Model'));}}
  finally{Object.assign(texCfg,saved);}
  const groups=mxGroups(m,Object.keys(texBy)).filter(g=>g.idx.length);
  const s=v3s(),envd=await nvEnv();
  return {m,groups,texBy,shBy,envd,settings:{tone:toneInt(s),expo:s.expo==null?1:s.expo,env_turn:(s.envRot||0)/360,env_strength:s.envI==null?1:s.envI,show_bg:!!s.envBg,sun_az:s.sunAz==null?40:s.sunAz,sun_el:s.sunEl==null?45:s.sunEl,sun_i:s.sunI==null?1:s.sunI}};}
/* what goes to the Rust side: a length, the JSON, then the numbers and pictures it describes */
function nvBody(sc){const m=sc.m,n=m.pos.length/3,f32=a=>new Float32Array(a);
  const pos=f32(m.pos),nrm=m.nrm&&m.nrm.length===m.pos.length?f32(m.nrm):f32(0),uv=m.uv&&m.uv.length===n*2?f32(m.uv):f32(0);
  const parts=[pos,nrm,uv],meta={pos:pos.length,nrm:nrm.length,uv:uv.length,groups:[],env:null,settings:sc.settings};
  for(const g of sc.groups){const T=sc.texBy[g.name]||{},len=k=>T[k]?T[k].length:0;
    meta.groups.push({name:g.name,idx:g.idx.length,rough:.6,metal:0,sh:sc.shBy[g.name]||undefined,tex:{base:len('BaseColor'),orm:len('ORM'),normal:len('Normal'),emissive:len('Emissive')}});
    parts.push(g.idx);for(const k of ['BaseColor','ORM','Normal','Emissive'])if(T[k])parts.push(T[k]);}
  if(sc.envd){meta.env={w:sc.envd.w,h:sc.envd.h};parts.push(sc.envd.rgb);}
  const json=new TextEncoder().encode(JSON.stringify(meta)),bytes=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
  let total=4+json.length;for(const p of parts)total+=p.byteLength;const out=new Uint8Array(total),dv=new DataView(out.buffer);dv.setUint32(0,json.length,true);out.set(json,4);let o=4+json.length;
  for(const p of parts){out.set(bytes(p),o);o+=p.byteLength;}return out;}
async function nvOpen(){
  if(!platform.isDesktop){toast('The new viewer is in the desktop app.');return null;}
  try{toast('Opening the new viewer…');const sc=await nvScene(),body=nvBody(sc);
    const info=await platform.invoke('viewer_open',body);
    toast('New viewer open on '+info.name+' ('+info.backend+(info.software?', software':'')+').');return info;}
  catch(e){console.warn(e);toast('The new viewer could not start: '+(e&&e.message||e)+'. The normal viewer is unchanged.');return null;}}
function nvClose(){if(platform.isDesktop)platform.invoke('viewer_close').catch(()=>{});}
