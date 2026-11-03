/* ================= The new viewer (0.94) =================
   Kenn: a new 3D viewer in the desktop app, running on the graphics card directly (the first step towards ray traced
   looks and DLSS). It opens in its own window with the model on show, one material per texture set (base colour,
   normal, roughness / metal / occlusion, emissive), lit by the environment you chose and one sun, with an orbit
   camera (left drag turns, right drag zooms, middle drag moves, wheel zooms).
   It never takes over the normal viewer. On a computer without a usable graphics card it can run on the software
   adapter; if it cannot start at all it says so and the normal viewer carries on as it always has. */
const NV_TEX_MAX=1024,NV_ENV_MAX=2048;
/* the environment picture the 3D view is using, as linear floats no wider than NV_ENV_MAX */
async function nvEnv(){const s=v3s(),k=envOf(s);if(k==='none')return null;let img=null;
  if(k==='custom'&&env.custom)img=env.custom.img;else{const it=ENV_LIST.find(e=>e[0]===k)||ENV_LIST[0];img=parseHDR(await envBundled(it[2]));}
  if(!img||!img.rgb)return null;let {w,h,rgb}=img;
  if(w>NV_ENV_MAX){const f=Math.ceil(w/NV_ENV_MAX),W=Math.floor(w/f),H=Math.max(1,Math.floor(h/f)),o=new Float32Array(W*H*3);
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
  const envd=await nvEnv();
  return {m,groups,texBy,shBy,envd,settings:nvSettings()};}
/* the 3D view's lighting settings, as the new viewer takes them */
function nvSettings(){const s=v3s();return {tone:toneInt(s),expo:s.expo==null?1:s.expo,env_turn:(s.envRot||0)/360,env_strength:s.envI==null?1:s.envI,show_bg:!!s.envBg,env_blur:s.envBlur==null?.35:s.envBlur,sun_az:s.sunAz==null?40:s.sunAz,sun_el:s.sunEl==null?45:s.sunEl,sun_i:s.sunI==null?1:s.sunI,fov:s.fov||45,paint:!!nv.paint,brush:nv.paint?nvBrushFrac():0,rt:!!s.nvRt};}
const nvEnvKey=()=>{const s=v3s(),k=envOf(s);return k+(k==='custom'&&env.custom?':'+env.custom.name:'');};
/* a lighting update: the same body as a scene, with no model; the environment picture only when it changed */
function nvUpdateBody(settings,mode,envd){const meta={pos:0,nrm:0,uv:0,groups:[],env_mode:mode,env:mode==='set'&&envd?{w:envd.w,h:envd.h}:null,settings};
  const json=new TextEncoder().encode(JSON.stringify(meta)),extra=mode==='set'&&envd?new Uint8Array(envd.rgb.buffer,envd.rgb.byteOffset,envd.rgb.byteLength):new Uint8Array(0),out=new Uint8Array(4+json.length+extra.length),dv=new DataView(out.buffer);
  dv.setUint32(0,json.length,true);out.set(json,4);out.set(extra,4+json.length);return out;}
/* while the window is open, changes to the lighting in the 3D view (environment, strength, turn, blur, tone, exposure, sun) follow into it */
const nv={isOpen:false,timer:null,sig:'',envKey:'',busy:false,paint:false,listen:null,tex:null,sync:0};
async function nvPush(){if(nv.busy)return;nv.busy=true;
  try{const key=nvEnvKey(),changed=key!==nv.envKey;let mode='keep',envd=null;
    if(changed){envd=await nvEnv();mode=envd?'set':'clear';}
    const alive=await platform.invoke('viewer_update',nvUpdateBody(nvSettings(),mode,envd));
    nv.envKey=key;if(!alive){nvStopWatch();nv.isOpen=false;}}
  catch(e){console.warn(e);}finally{nv.busy=false;}}
function nvWatch(){nvStopWatch();nv.envKey=nvEnvKey();nv.sig=JSON.stringify(nvSettings())+nv.envKey;
  nv.timer=setInterval(()=>{if(!platform.isDesktop)return;const sig=JSON.stringify(nvSettings())+nvEnvKey();if(sig!==nv.sig){nv.sig=sig;nvPush();}},400);}
/* a finished picture from the window, at any size (PNG bytes) */
async function nvCapture(w,h){const r=await platform.invoke('viewer_capture',{width:Math.round(w),height:Math.round(h)});return r instanceof Uint8Array?r:new Uint8Array(r);}
/* one turntable frame from the window: raw RGBA, top row first */
async function nvFrame(w,h,yawAdd,envTurn,sunAz,rounds){const r=await platform.invoke('viewer_capture_raw',{width:Math.round(w),height:Math.round(h),yawAdd,envTurn,sunAz,rounds});const u=r instanceof Uint8Array?r:new Uint8Array(r);return u;}
function nvStopWatch(){if(nv.timer){clearInterval(nv.timer);nv.timer=null;}}

/* ---- painting through the window ----
   The window reports the pointer (position, camera, keys). The page turns that into pointer events on the 3D view, so the
   normal brush paints; afterwards the changed material is sent back as new pictures. */
/* the brush's diameter as a part of the view's height (the same on the window) */
function nvBrushFrac(){const hit=document.getElementById('v3Hit');if(!hit||!v3.paintOn||typeof MESH_TOOLS==='undefined'||!MESH_TOOLS.includes(ui.tool))return 0;const h=hit.getBoundingClientRect().height;return h>0?Math.round(brush.size*meshBrushScale(h)/h*1000)/1000:0;}
const NV_TEX_LIVE=512,NV_LIVE_MS=100;
function nvPaintOn(){return platform.isDesktop&&ui.mode==='p3d';}
function nvCamFrom(ev){const c=v3.cam,d=[ev.eye[0]-ev.tgt[0],ev.eye[1]-ev.tgt[1],ev.eye[2]-ev.tgt[2]],L=Math.hypot(d[0],d[1],d[2])||1;
  c.tx=ev.tgt[0];c.ty=ev.tgt[1];c.tz=ev.tgt[2];c.dist=L;c.pitch=Math.asin(Math.max(-1,Math.min(1,d[1]/L)));c.yaw=Math.atan2(d[0],d[2]);}
/* a world point on the ray through the window pixel; the main view then sees the same surface there */
function nvPixelRay(ev){const t=Math.tan(ev.fov*Math.PI/360),e=ev.eye,g=ev.tgt;
  const fw=norm3(sub3(g,e)),r=norm3(cross3(fw,[0,1,0])),u=cross3(r,fw),x=(2*ev.x/ev.w-1)*t*ev.w/ev.h,y=(2*ev.y/ev.h-1)*t;
  const d=norm3([fw[0]+r[0]*x-u[0]*y,fw[1]+r[1]*x-u[1]*y,fw[2]+r[2]*x-u[2]*y]),L=Math.hypot(g[0]-e[0],g[1]-e[1],g[2]-e[2]);
  return [e[0]+d[0]*L,e[1]+d[1]*L,e[2]+d[2]*L];}
function nvHandle(ev){if(!nvPaintOn()||!ev||!ev.t)return;if(ev.t==='cam'){nvCamFrom(ev);return;}const hit=document.getElementById('v3Hit');if(!hit)return;
  nvCamFrom(ev);const p=pathProject(nvPixelRay(ev),'3d',hit);if(!p)return;const r=hit.getBoundingClientRect(),cx=r.left+p[0],cy=r.top+p[1];
  const mk=(type,buttons)=>new PointerEvent(type,{pointerId:991,pointerType:'mouse',isPrimary:true,bubbles:true,cancelable:true,clientX:cx,clientY:cy,button:0,buttons,shiftKey:!!ev.shift,ctrlKey:!!ev.ctrl,altKey:!!ev.alt,pressure:ev.t==='up'?0:.5});
  if(ev.t==='down'){clearTimeout(nv.sync);hit.dispatchEvent(mk('pointerdown',1));nv.liveAt=performance.now();}
  else if(ev.t==='move'){hit.dispatchEvent(mk('pointermove',1));nvLiveTick();}
  else if(ev.t==='up'){hit.dispatchEvent(mk('pointerup',0));nvSyncSoon();}}
/* while dragging: a small copy of the maps every so often (the full one follows after the stroke) */
function nvLiveTick(){const now=performance.now();if(nv.texBusy||now-(nv.liveAt||0)<NV_LIVE_MS)return;nv.liveAt=now;nvSyncLive().then(()=>{nv.liveAt=performance.now();});}
/* after a stroke: rebuild the active set's maps and send them */
function nvSyncSoon(){clearTimeout(nv.sync);nv.sync=setTimeout(nvSyncTextures,350);}
/* while dragging: only the base colour, as plain pixels (no PNG), small; the other maps stay as they were */
function nvLiveBase(){const W=doc.w,H=doc.h,sc=Math.min(1,NV_TEX_LIVE/Math.max(W,H)),w=Math.max(2,Math.round(W*sc)),h=Math.max(2,Math.round(H*sc));
  const full=compositeMap('base');let small=null;
  try{small=makeTarget(w,h,8,false);const sci=gl.isEnabled(gl.SCISSOR_TEST);if(sci)gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,full.fbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,small.fbo);
    gl.blitFramebuffer(0,0,W,H,0,0,w,h,gl.COLOR_BUFFER_BIT,full.depth===32?gl.NEAREST:gl.LINEAR);gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(sci)gl.enable(gl.SCISSOR_TEST);
    const d=captureRegionNow(small,0,0,w,h).data,out=new Uint8Array(w*h*4);
    for(let j=0;j<h;j++){let a=(h-1-j)*w*4,b=j*w*4;for(let i=0;i<w;i++,a+=4,b+=4){const al=255-d[a+3];out[b]=Math.min(255,d[a]+al);out[b+1]=Math.min(255,d[a+1]+al);out[b+2]=Math.min(255,d[a+2]+al);out[b+3]=255;}}
    return {w,h,px:out};}
  finally{release(full);if(small)disposeTarget(small);}}
async function nvSyncLive(){if(!nvPaintOn()||nv.texBusy)return;nv.texBusy=true;
  try{const S=p3.sets[p3.cur];if(!S)return;const t0=performance.now(),b=nvLiveBase();
    const meta={pos:0,nrm:0,uv:0,groups:[{name:S.name,idx:0,rough:.6,metal:0,sh:nvShader(),tex:{base:b.px.length,orm:0,normal:0,emissive:0},raw:[b.w,b.h],partial:true}],env:null,settings:nvSettings()};
    const json=new TextEncoder().encode(JSON.stringify(meta)),out=new Uint8Array(4+json.length+b.px.length);new DataView(out.buffer).setUint32(0,json.length,true);out.set(json,4);out.set(b.px,4+json.length);
    if(window.__nvHook)window.__nvHook('live',meta);nv.liveMs=performance.now()-t0;
    const alive=await platform.invoke('viewer_textures',out);if(!alive)nvStopWatch();}
  catch(e){console.warn(e);}finally{nv.texBusy=false;}}
async function nvSyncTextures(live){if(!nvPaintOn()||nv.texBusy){if(nv.texBusy&&!live)nvSyncSoon();return;}nv.texBusy=true;
  const saved={size:texCfg.size,pad:texCfg.pad,meshMaps:texCfg.meshMaps,h16:texCfg.h16};
  try{texCfg.size=live?NV_TEX_LIVE:NV_TEX_MAX;texCfg.pad='none';texCfg.meshMaps=false;
    const S=p3.sets[p3.cur];if(!S)return;const g=await buildTextures(GLTF_TEX,'preview'),T={};for(const f of g)T[f.suffix]=f.data;
    const len=k=>T[k]?T[k].length:0,parts=[];
    const meta={pos:0,nrm:0,uv:0,groups:[{name:S.name,idx:0,rough:.6,metal:0,sh:nvShader(),tex:{base:len('BaseColor'),orm:len('ORM'),normal:len('Normal'),emissive:len('Emissive')}}],env:null,settings:nvSettings()};
    for(const k of ['BaseColor','ORM','Normal','Emissive'])if(T[k])parts.push(T[k]);
    const json=new TextEncoder().encode(JSON.stringify(meta));let total=4+json.length;for(const p of parts)total+=p.byteLength;
    const out=new Uint8Array(total),dv=new DataView(out.buffer);dv.setUint32(0,json.length,true);out.set(json,4);let o=4+json.length;for(const p of parts){out.set(new Uint8Array(p.buffer,p.byteOffset,p.byteLength),o);o+=p.byteLength;}
    nv.lastTex={name:S.name,bytes:out.length};
    if(window.__nvHook)window.__nvHook('textures',meta);
    const alive=await platform.invoke('viewer_textures',out);if(!alive)nvStopWatch();}
  catch(e){console.warn(e);}finally{Object.assign(texCfg,saved);nv.texBusy=false;}}
async function nvListen(){if(nv.listen||typeof TAURI==='undefined'||!TAURI||!TAURI.event)return;
  nv.listen=await TAURI.event.listen('viewer-event',e=>{try{nvHandle(JSON.parse(e.payload));}catch(er){console.warn(er);}});}
function nvUnlisten(){if(nv.listen){nv.listen();nv.listen=null;}}
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
    toast('New viewer open on '+info.name+' ('+info.backend+(info.software?', software':'')+').'+(nvPaintOn()?' Paint in it; hold Alt to turn the view.':''));nv.isOpen=true;nv.paint=nvPaintOn();nvListen();nvWatch();if(nv.paint)nvPush();return info;}
  catch(e){console.warn(e);toast('The new viewer could not start: '+(e&&e.message||e)+'. The normal viewer is unchanged.');return null;}}
function nvClose(){nv.isOpen=false;nvStopWatch();nvUnlisten();nv.paint=false;if(platform.isDesktop)platform.invoke('viewer_close').catch(()=>{});}
