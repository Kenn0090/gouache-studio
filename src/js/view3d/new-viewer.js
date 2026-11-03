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
/* the mask view / channel view / baked-map view of the 3D view (C and B keys, Alt+click a mask): a picture shown unlit */
function nvViewTarget(){if(ui.mode==='bake'||ui.mode==='convert')return null;try{let t=typeof maskViewTex==='function'?((typeof idViewTex==='function'&&idViewTex())||maskViewTex()||(typeof p3MeshShowTex==='function'?p3MeshShowTex():null)):null;
  if(!t&&typeof p3ChannelView==='function'){const c=p3ChannelView();if(c)t=v3.tex[c]||null;}return t||null;}catch(e){return null;}}
function nvViewKey(){if(nvBakeMode()){const b=v3.btex;return 'bk'+(b._nvid||(b._nvid=Math.random().toString(36).slice(2)));}const t=nvViewTarget();if(!t&&nvSelOn())return 'sel'+nvSelVer+':'+JSON.stringify(sel.bb);return t?(t.id||t.tex&&t.tex._nvid||(t.tex?(t.tex._nvid=Math.random().toString(36).slice(2)):'v')):'';}
async function nvViewPNG(){const t=nvViewTarget();if(!t)return null;
  const c=captureRegionNow(t,0,0,t.w,t.h),n=t.w*t.h,rgba=new Uint8ClampedArray(n*4);
  if(c.depth===16){for(let i=0;i<n*4;i++)rgba[i]=Math.max(0,Math.min(255,Math.round(h2f(c.data[i])*255)));}else rgba.set(c.data);
  for(let i=3;i<n*4;i+=4)rgba[i]=255;
  const cv0=document.createElement('canvas');cv0.width=t.w;cv0.height=t.h;const x0=cv0.getContext('2d'),im=x0.createImageData(t.w,t.h);
  for(let y=0;y<t.h;y++)im.data.set(rgba.subarray((t.h-1-y)*t.w*4,(t.h-y)*t.w*4),y*t.w*4);x0.putImageData(im,0,0);
  const sc=Math.min(1,NV_TEX_MAX/Math.max(t.w,t.h)),cv1=document.createElement('canvas');cv1.width=Math.max(2,Math.round(t.w*sc));cv1.height=Math.max(2,Math.round(t.h*sc));cv1.getContext('2d').drawImage(cv0,0,0,cv1.width,cv1.height);
  const b=await new Promise(r=>cv1.toBlob(r,'image/png'));return b?new Uint8Array(await b.arrayBuffer()):null;}
/* height depth: the height map goes along as a grey picture; the window moves the surface by it */
function nvDispOn(){try{const s=v3s();return ui.mode!=='bake'&&ui.mode!=='convert'&&!!s.disp&&doc.maps.includes('height')&&!!v3.tex.height;}catch(e){return false;}}
async function nvGreyPNG(t){const c=captureRegionNow(t,0,0,t.w,t.h),n=t.w*t.h,cv=document.createElement('canvas');cv.width=t.w;cv.height=t.h;
  const x=cv.getContext('2d'),im=x.createImageData(t.w,t.h);for(let i=0;i<n;i++){const v=c.depth===16?Math.max(0,Math.min(255,Math.round(h2f(c.data[i*4])*255))):c.data[i*4];im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=v;im.data[i*4+3]=255;}
  x.putImageData(im,0,0);const sc=Math.min(1,1024/Math.max(t.w,t.h));let cv2=cv;if(sc<1){cv2=document.createElement('canvas');cv2.width=Math.max(2,Math.round(t.w*sc));cv2.height=Math.max(2,Math.round(t.h*sc));cv2.getContext('2d').drawImage(cv,0,0,cv2.width,cv2.height);}
  /* rows: the target's first row is the bottom of the picture, a PNG starts at the top */
  const out=document.createElement('canvas');out.width=cv2.width;out.height=cv2.height;const o=out.getContext('2d');o.translate(0,out.height);o.scale(1,-1);o.drawImage(cv2,0,0);
  const b=await new Promise(r=>out.toBlob(r,'image/png'));return b?new Uint8Array(await b.arrayBuffer()):null;}
async function nvHeightApply(T){if(nvViewTarget())return;if(nvDispOn()){const g=await nvGreyPNG(v3.tex.height);if(g)T.Height=g;}
  /* skin: the baked thickness map (doc.meshMaps.thick) */
  try{if(ui.mode==='p3d'&&nvShader().k===1&&doc.meshMaps&&doc.meshMaps.thick){const g=await nvGreyPNG(doc.meshMaps.thick);if(g)T.Thick=g;}}catch(e){}}
/* the selection (orange tint on the model): painted into the picture the window shows, like the 3D view does on top */
let nvSelVer=0;
{const a=applyShape;applyShape=function(...r){nvSelVer++;return a.apply(this,r);};}
const nvSelOn=()=>ui.mode==='p3d'&&sel.active&&!sel.quick&&!!sel.t;
async function nvSelApply(T){if(!nvSelOn()||!T.BaseColor)return;
  const bmp=await createImageBitmap(new Blob([T.BaseColor],{type:'image/png'})),w=bmp.width,h=bmp.height,cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');x.drawImage(bmp,0,0);
  const m=captureRegionNow(sel.t,0,0,sel.t.w,sel.t.h),im=x.getImageData(0,0,w,h),d=im.data;
  for(let y=0;y<h;y++){const sy=Math.min(sel.t.h-1,Math.floor((h-1-y)*sel.t.h/h));for(let xx=0;xx<w;xx++){const sx=Math.min(sel.t.w-1,Math.floor(xx*sel.t.w/w)),mv=m.depth===16?h2f(m.data[(sy*sel.t.w+sx)*4]):m.data[(sy*sel.t.w+sx)*4]/255;
    if(mv<.02)continue;const k=.32*mv,i=(y*w+xx)*4;d[i]+=(255-d[i])*k;d[i+1]+=(158-d[i+1])*k;d[i+2]+=(56-d[i+2])*k;}}
  x.putImageData(im,0,0);const b=await new Promise(r=>cv.toBlob(r,'image/png'));if(b)T.BaseColor=new Uint8Array(await b.arrayBuffer());}
async function nvViewApply(T){const v=await nvViewPNG();if(v){T.BaseColor=v;delete T.ORM;delete T.Normal;delete T.Emissive;delete T.Height;delete T.Thick;}else{await nvSelApply(T);await nvHeightApply(T);}}
/* the Bake and Convert tabs keep what the model shows in v3.btex (base, normal, AO, roughness, metal): these go to the window as the model's maps */
const nvBakeMode=()=>(ui.mode==='bake'||ui.mode==='convert')&&!!v3.btex;
function nvRead(t,w,h){const c=captureRegionNow(t,0,0,t.w,t.h),o=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++){const sy=Math.min(t.h-1,Math.floor(y*t.h/h));for(let x=0;x<w;x++){const sx=Math.min(t.w-1,Math.floor(x*t.w/w)),i=(sy*t.w+sx)*4,d=(y*w+x)*4;
    for(let k=0;k<4;k++)o[d+k]=c.depth===16?Math.max(0,Math.min(255,Math.round(h2f(c.data[i+k])*255))):c.data[i+k];}}return o;}
async function nvPngOf(w,h,rgba){const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d'),im=x.createImageData(w,h);
  for(let y=0;y<h;y++)im.data.set(rgba.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);/* the target's first row is the bottom */
  x.putImageData(im,0,0);const b=await new Promise(r=>cv.toBlob(r,'image/png'));return b?new Uint8Array(await b.arrayBuffer()):null;}
async function nvBakeTextures(){const B=v3.btex,T={};if(!B)return T;const cap=t=>{const sc=Math.min(1,NV_TEX_MAX/Math.max(t.w,t.h));return [Math.max(2,Math.round(t.w*sc)),Math.max(2,Math.round(t.h*sc))];};
  if(B.base){const [w,h]=cap(B.base),a=nvRead(B.base,w,h);for(let i=3;i<a.length;i+=4)a[i]=255;T.BaseColor=await nvPngOf(w,h,a);}
  if(B.nfinal){const [w,h]=cap(B.nfinal),a=nvRead(B.nfinal,w,h);for(let i=3;i<a.length;i+=4)a[i]=255;T.Normal=await nvPngOf(w,h,a);}
  const ch=[B.ao,B.rough,B.metal];if(ch.some(Boolean)){const ref=ch.find(Boolean),[w,h]=cap(ref),o=new Uint8ClampedArray(w*h*4);
    ch.forEach((t,k)=>{if(t){const a=nvRead(t,w,h);for(let i=0;i<w*h;i++)o[i*4+k]=a[i*4];}else for(let i=0;i<w*h;i++)o[i*4+k]=k===1?255:k===2?0:255;});
    for(let i=3;i<o.length;i+=4)o[i]=255;T.ORM=await nvPngOf(w,h,o);}
  return T;}
async function nvScene(){const m=mxModel();if(!m||!m.pos||!m.idx)throw new Error('Open a model in the 3D view first.');
  const saved={size:texCfg.size,pad:texCfg.pad,meshMaps:texCfg.meshMaps,h16:texCfg.h16},texBy={},shBy={};
  try{texCfg.size=NV_TEX_MAX;texCfg.pad='none';texCfg.meshMaps=false;
    const one=async(setName)=>{const g=await buildTextures(GLTF_TEX,'preview'),T={};for(const f of g)T[f.suffix]=f.data;await nvViewApply(T);texBy[setName]=T;shBy[setName]=nvShader();};
    if(nvBakeMode()){const nm=doc.name||'Model';texBy[nm]=await nvBakeTextures();shBy[nm]=nvShader();}
    else{const sets=ui.mode==='p3d'?p3.sets.filter(S=>!S.missing&&!S.hidden):[];
    if(ui.mode==='p3d'&&sets.length>1){const back=p3.cur;try{for(let i=0;i<p3.sets.length;i++){if(p3.sets[i].missing||p3.sets[i].hidden)continue;p3SwitchSet(i,true);await one(p3.sets[i].name);}}finally{p3SwitchSet(back,true);}}
    else{const S=ui.mode==='p3d'&&p3.sets[p3.cur];await one(S?S.name:(doc.name||'Model'));}}}
  finally{Object.assign(texCfg,saved);}
  const groups=mxGroups(m,Object.keys(texBy)).filter(g=>g.idx.length);
  const envd=await nvEnv();
  return {m,groups,texBy,shBy,envd,settings:nvSettings()};}
/* post processing (Shader panel): the same effects, worked on the window's picture. Ambient occlusion is left to the ray tracing. */
function nvPost(){try{if(typeof postOf!=='function'||typeof postActive!=='function'||!postActive(v3s()))return {};const p=postOf(),r=v=>Math.round(v*1e4)/1e4;
  const g=p.grain,anim=g.on&&g.animated&&g.amt>0;
  return {post:[[p.bloom.thr,p.bloom.rad,0,0],[p.dof.on?1:0,p.dof.amt,p.dof.focus,0],[p.bloom.on?1:0,p.bloom.amt,g.col,0],p.grade.on?[p.grade.exp,p.grade.con,p.grade.sat,p.grade.warm]:[0,0,0,0],
    [p.vig.on?p.vig.amt:0,p.vig.soft,g.on?g.amt:0,p.ca.on?p.ca.amt:0],[p.sharp.on?p.sharp.amt:0,anim?-(g.speed||24):7.13,p.grade.on?1:0,g.size],[p.look.on?p.look.mode:0,p.look.amt,p.look.lv,0]].map(a=>a.map(r))};}catch(e){return {};}}
/* the shadow floor: it shows only the model's shadow, so the window's ray tracing is switched on while it is */
function nvFloorOn(){try{const s=v3s();return !!s.floor&&s.shadows!==false&&!!v3.mesh&&ui.mode!=='bake'&&ui.mode!=='convert'&&!(typeof v3Unlit==='function'&&v3Unlit())&&!nvViewTarget()&&!s.wire;}catch(e){return false;}}
function nvFloor(){if(!nvFloorOn())return {};const s=v3s(),r=v=>Math.round(v*1e4)/1e4,c=s.floorColor||[0,0,0];
  return {floor:[r(studioFloorY()),r(Math.max(v3.mesh.radius||1,1)*3.5),s.floorOpacity==null?.5:s.floorOpacity,1],floor_col:c.map(v=>r(Math.pow(Math.max(0,v),2.2)))};}
/* the mirror planes / radial rays of the 3D bar (when "Show guides" is on) */
function nvMirror(){try{if(ui.mode!=='p3d'||typeof mir3==='undefined'||!mir3.show||!mir3On()||!v3.mesh)return {};const o=mir3.off||[0,0,0],r=Math.round((v3.mesh.radius||1.2)*1.15*1000)/1000;
  return {mir:['x','y','z'].map((a,i)=>mir3[a]?o[i]:null),mir_radial:mir3.radial>1?[mir3.radial|0,['x','y','z'].indexOf(mir3.axis)]:[0,0],mir_off:[o[0],o[1],o[2]],mir_r:r};}catch(e){return {};}}
/* the stencil (projection painting): kept in the pixels of the 3D view in the page, the window maps them to its own */
function nvStencil(){try{const hit=document.getElementById('v3Hit');if(ui.mode!=='p3d'||!hit||typeof st3==='undefined'||!st3.img||st3.mode==='off'||!(st3.show>0))return {st_on:false};
  const r=hit.getBoundingClientRect(),wm=r.width,hm=r.height;if(!(wm>8&&hm>8))return {st_on:false};const S=st3.scale*hm,a=st3.img.w/st3.img.h,q=v=>Math.round(v*100)/100;
  return {st_on:true,st:[q(st3.x*wm),q(st3.y*hm),q(S*a/2),q(S/2),Math.round(st3.rot*Math.PI/180*1e4)/1e4,st3.show,(st3.invert?1:0)|(st3.tile?2:0),0],st_view:[q(wm),q(hm)]};}catch(e){return {st_on:false};}}
/* the stencil's picture goes to the window once (again when it is another picture) */
async function nvStencilSend(){if(!nv.isOpen||ui.mode!=='p3d'||typeof st3==='undefined'||!st3.img)return;const t=st3.img;if(nv.stImg===t||nv.stBusy)return;nv.stBusy=true;
  try{const d=captureRegionNow(t,0,0,t.w,t.h).data,w=Math.min(1024,t.w),h=Math.max(1,Math.round(w*t.h/t.w)),src=document.createElement('canvas');src.width=t.w;src.height=t.h;
    const id=src.getContext('2d').createImageData(t.w,t.h);for(let y=0;y<t.h;y++)for(let x=0;x<t.w;x++){const i=(y*t.w+x)*4,o=i,a=d[i+3]||1;id.data[o]=Math.min(255,d[i]*255/a);id.data[o+1]=Math.min(255,d[i+1]*255/a);id.data[o+2]=Math.min(255,d[i+2]*255/a);id.data[o+3]=d[i+3];}
    src.getContext('2d').putImageData(id,0,0);const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(src,0,0,w,h);
    const b=await new Promise(r=>cv.toBlob(r,'image/png'));if(!b)return;const png=new Uint8Array(await b.arrayBuffer());
    const meta={pos:0,nrm:0,uv:0,groups:[{name:'__stencil',idx:0,rough:.6,metal:0,sh:nvShader(),tex:{base:png.length,orm:0,normal:0,emissive:0}}],env:null,settings:nvSettings()},json=new TextEncoder().encode(JSON.stringify(meta)),out=new Uint8Array(4+json.length+png.length);
    new DataView(out.buffer).setUint32(0,json.length,true);out.set(json,4);out.set(png,4+json.length);
    await platform.invoke('viewer_textures',out);nv.stImg=t;}catch(e){console.warn(e);}finally{nv.stBusy=false;}}
/* the 3D view's lighting settings, as the new viewer takes them */
function nvSettings(){const s=v3s();return {tone:toneInt(s),expo:s.expo==null?1:s.expo,env_turn:(s.envRot||0)/360,env_strength:s.envI==null?1:s.envI,show_bg:!!s.envBg,env_blur:s.envBlur==null?.35:s.envBlur,sun_az:s.sunAz==null?40:s.sunAz,sun_el:s.sunEl==null?45:s.sunEl,sun_i:envOf(s)!=='none'?(s.envSun||0):(s.sunI==null?1:s.sunI),fov:s.fov||45,bg:(typeof BG3!=='undefined'&&(BG3[s.bg]||BG3.dark))||[.09,.1,.115],lights:nvLights(),ortho:!!s.ortho,studio_fill:s.studioFill==null?.12:s.studioFill,studio_rim:s.studioRim==null?.08:s.studioRim,unlit:!!(typeof v3Unlit==='function'&&v3Unlit())||!!nvViewTarget()||(nvBakeMode()&&!!v3.bunlit),metal_view:s.metalView?(s.metalRough==null?.2:s.metalRough):0,rt_shadow:s.nvShadow==null?.9:s.nvShadow,rt_ao:s.nvAO==null?.85:s.nvAO,rt_refl:s.nvRefl==null?.7:s.nvRefl,rt_soft:s.nvSoft==null?.02:s.nvSoft,rt_samples:Math.round(s.nvSamples||96),cam:nvCamOut(),paint:!!nv.isOpen&&nvPaintOn(),brush:nv.isOpen&&nvPaintOn()?nvBrushFrac():0,rt:(!!s.nvRt||nvFloorOn())&&!s.wire,disp:nvDispOn()?Math.round((s.disp||0)*.3*1e4)/1e4:0,wire:s.wire?(s.wireOnly?2:1):0,wire_col:(typeof prefs!=='undefined'&&prefs.wireCol)||[.95,.7,.35],...nvMirror(),...nvStencil(),...nvPost(),...nvFloor(),clip:v3s().clip!==false};}
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
    nv.envKey=key;if(!alive){nvStopWatch();nv.isOpen=false;nvBtnSync();}}
  catch(e){console.warn(e);}finally{nv.busy=false;}}
function nvWatch(){nvStopWatch();nv.envKey=nvEnvKey();nv.sig=JSON.stringify(nvSettings())+nv.envKey;
  nv.viewKey=nvViewKey();nv.stImg=null;nvStencilSend();nv.timer=setInterval(()=>{if(!platform.isDesktop)return;nvStencilSend();if(nv.hlSig)nvHlSend();{const vk=(ui.mode==='p3d'||nvBakeMode())?nvViewKey():'';if(vk!==nv.viewKey){nv.viewKey=vk;nv.viewForce=true;nvSyncSoon();}}const sig=JSON.stringify(nvSettings())+nvEnvKey();if(sig!==nv.sig){nv.sig=sig;nvPush();}},400);}
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
/* your lights from the light rig (when they are switched on in the 3D view): up to 4, 12 numbers each */
function nvLights(){try{if(typeof lightViewUniforms!=='function')return [];const U=lightViewUniforms(),n=U.uVLN&&U.uVLN.int||0,out=[];for(let i=0;i<Math.min(4,n);i++){const a=U.uVLA.v4a,b=U.uVLB.v4a,c=U.uVLC.v4a,r=v=>Math.round(v*1e4)/1e4;out.push([0,1,2,3].map(k=>r(a[i*4+k])).concat([0,1,2,3].map(k=>r(b[i*4+k])),[0,1,2,3].map(k=>r(c[i*4+k]))));}return out;}catch(e){return [];}}
/* where the page's own camera is (eye and target), to make the window follow it; nothing while the window has just moved it itself */
function nvCamOut(){if(!nv.isOpen||performance.now()-(nv.winCamAt||0)<700||!v3.cam)return null;const e=v3Eye(),c=v3.cam,r=a=>Math.round(a*1000)/1000;return [r(e[0]),r(e[1]),r(e[2]),r(c.tx),r(c.ty),r(c.tz)];}
const NV_TEX_LIVE=512,NV_LIVE_MS=100;
function nvPaintOn(){return platform.isDesktop&&ui.mode==='p3d'&&v3s().nvPaint!==false;}
function nvCamFrom(ev){nv.winCamAt=performance.now();const c=v3.cam,d=[ev.eye[0]-ev.tgt[0],ev.eye[1]-ev.tgt[1],ev.eye[2]-ev.tgt[2]],L=Math.hypot(d[0],d[1],d[2])||1;
  c.tx=ev.tgt[0];c.ty=ev.tgt[1];c.tz=ev.tgt[2];c.dist=L;c.pitch=Math.asin(Math.max(-1,Math.min(1,d[1]/L)));c.yaw=Math.atan2(d[0],d[2]);}
/* a world point on the ray through the window pixel; the main view then sees the same surface there */
function nvPixelRay(ev){const t=Math.tan(ev.fov*Math.PI/360),e=ev.eye,g=ev.tgt;
  const fw=norm3(sub3(g,e)),r=norm3(cross3(fw,[0,1,0])),u=cross3(r,fw),x=(2*ev.x/ev.w-1)*t*ev.w/ev.h,y=(2*ev.y/ev.h-1)*t;
  const L=Math.hypot(g[0]-e[0],g[1]-e[1],g[2]-e[2]);
  if(v3s().ortho){/* no depth shrinking: the ray runs straight ahead from a point on the picture plane */return [e[0]+r[0]*x*L-u[0]*y*L+fw[0]*L,e[1]+r[1]*x*L-u[1]*y*L+fw[1]*L,e[2]+r[2]*x*L-u[2]*y*L+fw[2]*L];}
  const d=norm3([fw[0]+r[0]*x-u[0]*y,fw[1]+r[1]*x-u[1]*y,fw[2]+r[2]*x-u[2]*y]);
  return [e[0]+d[0]*L,e[1]+d[1]*L,e[2]+d[2]*L];}
/* the part under the pointer while a selection tool is armed (the window reports the pointer even with no button down) */
function nvHover(ev){try{if(typeof sel3==='undefined'||!sel3.armed||sel3.mode==='off'||!nvPaintOn())return;const hit=document.getElementById('v3Hit');if(!hit)return;
  nvCamFrom(ev);const p=pathProject(nvPixelRay(ev),'3d',hit);if(!p)return;const r=hit.getBoundingClientRect();
  hit.dispatchEvent(new PointerEvent('pointermove',{pointerId:991,pointerType:'mouse',isPrimary:true,bubbles:true,cancelable:true,clientX:r.left+p[0],clientY:r.top+p[1],button:0,buttons:0,shiftKey:!!ev.shift,ctrlKey:!!ev.ctrl,altKey:!!ev.alt}));
  clearTimeout(nv.hlT);nv.hlT=setTimeout(nvHlSend,45);}catch(e){}}
async function nvHlSend(){if(!nv.isOpen||nv.hlBusy)return;const H=typeof sel3HoverState!=='undefined'?sel3HoverState:null,ok=H&&typeof sel3!=='undefined'&&sel3.armed&&H.mesh===v3.mesh&&H.tris&&H.tris.length,tris=ok?H.tris:[];
  const sig=tris.length?tris.length+':'+tris[0]+':'+tris[tris.length-1]:'';if(sig===nv.hlSig)return;nv.hlBusy=true;
  try{let ids;if(tris.length){ids=new Uint32Array(Math.min(tris.length,200000)*3);for(let i=0;i<ids.length/3;i++)ids.set(v3.mesh.idx.subarray(tris[i]*3,tris[i]*3+3),i*3);}else ids=new Uint32Array(1);
    const px=new Uint8Array(ids.buffer,ids.byteOffset,ids.byteLength),meta={pos:0,nrm:0,uv:0,groups:[{name:'__hl',idx:0,rough:.6,metal:0,tex:{base:px.length,orm:0,normal:0,emissive:0},raw:[ids.length,1]}],env:null,settings:nvSettings()},json=new TextEncoder().encode(JSON.stringify(meta)),out=new Uint8Array(4+json.length+px.length);
    new DataView(out.buffer).setUint32(0,json.length,true);out.set(json,4);out.set(px,4+json.length);await platform.invoke('viewer_textures',out);nv.hlSig=sig;}
  catch(e){console.warn(e);}finally{nv.hlBusy=false;}}
function nvHandle(ev){if(ev&&(ev.t==='key-p'||ev.t==='key-r')){if(ev.t==='key-p'){if(typeof v3Screenshot==='function')v3Screenshot('view',false);}else{const s=v3s();s.nvRt=!s.nvRt;toast('Ray tracing '+(s.nvRt?'on':'off')+' in the new viewer.');}return;}
  if(ev&&ev.t==='closed'){/* where the window was, for next time */try{if(ev.win&&ev.win[2]>=300)localStorage.setItem('gs.nvWin',JSON.stringify(ev.win));}catch(e){}
    const was=nv.isOpen;nv.isOpen=false;nv.paint=false;nvStopWatch();nvBtnSync();if(was)toast('The new viewer window was closed.');return;}
  if(!nvPaintOn()||!ev||!ev.t)return;if(ev.t==='cam'){nvCamFrom(ev);return;}if(ev.t==='hover'){nvHover(ev);return;}
  const st=nv.st||(nv.st={ev:0,run:0,ms:0,live:0,liveMs:0,max:0});
  if(ev.t==='move'){st.ev++;nv.pendingMove=ev;if(!nv.moveRaf)nv.moveRaf=requestAnimationFrame(nvFlushMove);return;}/* one move per frame, like a normal mouse */
  if(ev.t==='down'){nv.st={ev:1,run:0,ms:0,live:0,liveMs:0,max:0};}
  nvFlushMove();nvDispatch(ev);}
function nvFlushMove(){nv.moveRaf=0;const ev=nv.pendingMove;nv.pendingMove=null;if(!ev)return;const t0=performance.now();nvDispatch(ev);const dt=performance.now()-t0,st=nv.st;if(st){st.run++;st.ms+=dt;st.max=Math.max(st.max,dt);}}
function nvDispatch(ev){if(!nvPaintOn())return;const hit=document.getElementById('v3Hit');if(!hit)return;
  nvCamFrom(ev);const p=pathProject(nvPixelRay(ev),'3d',hit);if(!p)return;const r=hit.getBoundingClientRect(),cx=r.left+p[0],cy=r.top+p[1];
  const mk=(type,buttons)=>new PointerEvent(type,{pointerId:991,pointerType:'mouse',isPrimary:true,bubbles:true,cancelable:true,clientX:cx,clientY:cy,button:0,buttons,shiftKey:!!ev.shift,ctrlKey:!!ev.ctrl,altKey:!!ev.alt,pressure:ev.t==='up'?0:.5});
  if(ev.t==='down'){clearTimeout(nv.sync);hit.dispatchEvent(mk('pointerdown',1));nv.liveAt=performance.now();}
  else if(ev.t==='move'){hit.dispatchEvent(mk('pointermove',1));nvLiveTick();}
  else if(ev.t==='up'){hit.dispatchEvent(mk('pointerup',0));nvSyncSoon();nvSlowCheck();}}
/* once per session: if painting through the window is slow here, say so and offer the way back */
function nvSlowCheck(){const s=nv.st;if(nv.slowTold||!s||s.run<20)return;const avg=s.ms/s.run,live=s.live?s.liveMs/s.live:0;
  if(avg>45||live>500){nv.slowTold=true;toast('Painting in the new viewer is slow on this computer ('+avg.toFixed(0)+' ms a move). Painting in the normal 3D view is smoother: turn off Preferences › Speed › Paint inside the new viewer window.');}}
/* what the last stroke cost, for Preferences */
function nvStatsText(){const s=nv.st;if(!s||!s.ev)return 'No stroke yet in the new viewer.';return 'Last stroke: '+s.ev+' mouse moves from the window, '+s.run+' painted (average '+(s.run?(s.ms/s.run).toFixed(1):'0')+' ms, slowest '+s.max.toFixed(0)+' ms); '+s.live+' live pictures'+(s.live?' (average '+(s.liveMs/s.live).toFixed(0)+' ms each)':'')+'.';}
/* while dragging: a small copy of the maps every so often (the full one follows after the stroke) */
function nvLiveTick(){const now=performance.now(),st=nv.st,avg=st&&st.live?st.liveMs/st.live:0,gap=Math.min(800,Math.max(NV_LIVE_MS,avg*3));if(nv.texBusy||now-(nv.liveAt||0)<gap)return;nv.liveAt=now;nvSyncLive().then(()=>{nv.liveAt=performance.now();});}
/* after a stroke: rebuild the active set's maps and send them */
function nvSyncSoon(){clearTimeout(nv.sync);nv.sync=setTimeout(nvSyncTextures,350);}
/* while dragging: only the base colour, as plain pixels (no PNG), small; the other maps stay as they were.
   The pixels are read back without making the page wait for the card (a fence is checked on later frames). */
function nvLiveStart(){const W=doc.w,H=doc.h,sc=Math.min(1,NV_TEX_LIVE/Math.max(W,H)),w=Math.max(2,Math.round(W*sc)),h=Math.max(2,Math.round(H*sc));
  const full=compositeMap('base');let small=null;
  try{small=makeTarget(w,h,8,false);const sci=gl.isEnabled(gl.SCISSOR_TEST);if(sci)gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,full.fbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,small.fbo);
    gl.blitFramebuffer(0,0,W,H,0,0,w,h,gl.COLOR_BUFFER_BIT,full.depth===32?gl.NEAREST:gl.LINEAR);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,small.fbo);
    const buf=gl.createBuffer();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buf);gl.bufferData(gl.PIXEL_PACK_BUFFER,w*h*4,gl.STREAM_READ);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,0);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(sci)gl.enable(gl.SCISSOR_TEST);
    const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();return {buf,fence,w,h,t0:performance.now(),sc:nvSetName()};}
  finally{release(full);if(small)disposeTarget(small);}}
function nvSetName(){const S=p3.sets[p3.cur];return S?S.name:'';}
/* the pixels when the card has finished (null while it has not) */
function nvLiveTake(job){const r=gl.clientWaitSync(job.fence,0,0);if(r===gl.TIMEOUT_EXPIRED)return null;
  const d=new Uint8Array(job.w*job.h*4);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,job.buf);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,d);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.deleteBuffer(job.buf);gl.deleteSync(job.fence);
  const w=job.w,h=job.h,out=new Uint8Array(w*h*4);
  for(let j=0;j<h;j++){let a=(h-1-j)*w*4,b=j*w*4;for(let i=0;i<w;i++,a+=4,b+=4){const al=255-d[a+3];out[b]=Math.min(255,d[a]+al);out[b+1]=Math.min(255,d[a+1]+al);out[b+2]=Math.min(255,d[a+2]+al);out[b+3]=255;}}
  return {w,h,px:out};}
async function nvSendLive(job,b){const meta={pos:0,nrm:0,uv:0,groups:[{name:job.sc,idx:0,rough:.6,metal:0,sh:nvShader(),tex:{base:b.px.length,orm:0,normal:0,emissive:0},raw:[b.w,b.h],partial:true}],env:null,settings:nvSettings()};
  const json=new TextEncoder().encode(JSON.stringify(meta)),out=new Uint8Array(4+json.length+b.px.length);new DataView(out.buffer).setUint32(0,json.length,true);out.set(json,4);out.set(b.px,4+json.length);
  if(window.__nvHook)window.__nvHook('live',meta);nv.liveMs=performance.now()-job.t0;if(nv.st){nv.st.live++;nv.st.liveMs+=nv.liveMs;}
  const alive=await platform.invoke('viewer_textures',out);if(!alive)nvStopWatch();}
/* one live picture at a time: start it, then check each frame until the card is done, then send it */
function nvSyncLive(){return new Promise(done=>{if(!nvPaintOn()||nv.texBusy){done();return;}nv.texBusy=true;
  let job=null;try{job=nvLiveStart();}catch(e){console.warn(e);nv.texBusy=false;done();return;}
  const poll=async()=>{try{if(!nvPaintOn()){gl.deleteBuffer(job.buf);gl.deleteSync(job.fence);nv.texBusy=false;done();return;}
    const b=nvLiveTake(job);if(!b){requestAnimationFrame(poll);return;}await nvSendLive(job,b);}catch(e){console.warn(e);}nv.texBusy=false;done();};
  requestAnimationFrame(poll);});}
async function nvSyncTextures(live){if(!(nvPaintOn()||nv.viewForce)||nv.texBusy){if(nv.texBusy&&!live)nvSyncSoon();return;}nv.texBusy=true;
  const saved={size:texCfg.size,pad:texCfg.pad,meshMaps:texCfg.meshMaps,h16:texCfg.h16};
  try{texCfg.size=live?NV_TEX_LIVE:NV_TEX_MAX;texCfg.pad='none';texCfg.meshMaps=false;
    const bm=nvBakeMode(),S=bm?{name:doc.name||'Model'}:p3.sets[p3.cur];if(!S)return;let T={};if(bm)T=await nvBakeTextures();else{const g=await buildTextures(GLTF_TEX,'preview');for(const f of g)T[f.suffix]=f.data;await nvViewApply(T);}
    const len=k=>T[k]?T[k].length:0,parts=[];
    const meta={pos:0,nrm:0,uv:0,groups:[{name:S.name,idx:0,rough:.6,metal:0,sh:nvShader(),tex:{base:len('BaseColor'),orm:len('ORM'),normal:len('Normal'),emissive:len('Emissive'),height:len('Height'),thick:len('Thick')}}],env:null,settings:nvSettings()};
    for(const k of ['BaseColor','ORM','Normal','Emissive','Height','Thick'])if(T[k])parts.push(T[k]);
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
  let win=null;try{win=JSON.parse(localStorage.getItem('gs.nvWin')||'null');}catch(e){}
  const parts=[pos,nrm,uv],meta={pos:pos.length,nrm:nrm.length,uv:uv.length,groups:[],env:null,settings:sc.settings,win:Array.isArray(win)&&win.length===4?win:undefined};
  for(const g of sc.groups){const T=sc.texBy[g.name]||{},len=k=>T[k]?T[k].length:0;
    meta.groups.push({name:g.name,idx:g.idx.length,rough:.6,metal:0,sh:sc.shBy[g.name]||undefined,tex:{base:len('BaseColor'),orm:len('ORM'),normal:len('Normal'),emissive:len('Emissive'),height:len('Height'),thick:len('Thick')}});
    parts.push(g.idx);for(const k of ['BaseColor','ORM','Normal','Emissive','Height','Thick'])if(T[k])parts.push(T[k]);}
  if(sc.envd){meta.env={w:sc.envd.w,h:sc.envd.h};parts.push(sc.envd.rgb);}
  const json=new TextEncoder().encode(JSON.stringify(meta)),bytes=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
  let total=4+json.length;for(const p of parts)total+=p.byteLength;const out=new Uint8Array(total),dv=new DataView(out.buffer);dv.setUint32(0,json.length,true);out.set(json,4);let o=4+json.length;
  for(const p of parts){out.set(bytes(p),o);o+=p.byteLength;}return out;}
async function nvOpen(){
  if(!platform.isDesktop){toast('The new viewer is in the desktop app.');return null;}
  try{toast('Opening the new viewer…');const sc=await nvScene(),body=nvBody(sc);
    const info=await platform.invoke('viewer_open',body);
    toast('New viewer open on '+info.name+' ('+info.backend+(info.software?', software':'')+').'+(nvPaintOn()?' Paint in it; hold Alt to turn the view.':''));nv.isOpen=true;nvBtnSync();nv.paint=nvPaintOn();nvListen();nvWatch();nvPush();return info;}
  catch(e){console.warn(e);toast('The new viewer could not start: '+(e&&e.message||e)+'. The normal viewer is unchanged.');return null;}}
function nvBtnSync(){const b=document.getElementById('v3Nv');if(b){b.hidden=!platform.isDesktop;b.classList.toggle('on',!!nv.isOpen);}}
function nvClose(){nv.isOpen=false;nvBtnSync();nvStopWatch();nvUnlisten();nv.paint=false;if(platform.isDesktop)platform.invoke('viewer_close').catch(()=>{});}
