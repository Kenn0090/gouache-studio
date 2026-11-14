/* A texture set's editable pixels are a cache of a raster source and the dabs painted on it.
   Each dab keeps its original coordinate system, including the random values and pen pressure
   already resolved by the brush engine. Rebuilding a texture never feeds that cache back into itself. */
const p3PaintImages=new WeakMap();
const p3PaintMeshes=new WeakMap();
function p3PaintMeshKey(mesh){
  if(!mesh)return null;
  let key=p3PaintMeshes.get(mesh);
  if(key)return key;
  let hash=2166136261;
  for(const a of [mesh.pos,mesh.uv,mesh.idx]){
    const bits=new Uint32Array(a.buffer,a.byteOffset,a.length);
    for(const v of bits)hash=Math.imul(hash^v,16777619);
  }
  key=[mesh.pos.length,mesh.uv.length,mesh.idx.length,hash>>>0].join('/');
  p3PaintMeshes.set(mesh,key);
  return key;
}
function p3PaintImage(tip){
  if(!tip)return null;
  let image=p3PaintImages.get(tip);
  if(!image){
    image={w:tip.w||tip.size,h:tip.h||tip.size,nearest:!!tip._nearest,repeat:!!tip.pixels,alpha:tip.pixels||tip.alpha};
    p3PaintImages.set(tip,image);
  }
  return image;
}
function p3PaintWrite(t){
  if(t._paintSource)t._paintStale=true;
  t._paintClear=null;
}
const p3PaintAttach=(t,source)=>{t._paintSource=source;t._paintStale=false;};
const p3PaintValid=t=>t&&!t._paintStale?t._paintSource:null;
function p3PaintRead(t){
  if(!t.mono)return readRegionAsync(t,0,0,t.w,t.h);
  const stage=makeTarget(t.w,t.h,t.depth,false);
  blit(t,stage,0,0,t.w,t.h,0,0);
  return readRegionAsync(stage,0,0,t.w,t.h).finally(()=>disposeTarget(stage));
}
function p3PaintSource(t,force=false){
  if(!force&&t._paintSource&&!t._paintStale)return t._paintSource;
  const base={w:t.w,h:t.h,d:t.depth};
  if(t._paintClear)base.color=t._paintClear.slice();
  else{
    base.image=p3PaintRead(t).then(raw=>pxPack(raw,base.w,base.h,base.d,false,true));
    base.image.catch(()=>{}); // report the failure if a rebuild or save needs this picture
  }
  return {base,tail:null};
}
function p3PaintJobs(){
  const jobs=[];
  for(const L of paintLayers())for(const k of Object.keys(L.maps||{})){
    const src=L.maps[k];
    if(src&&!src.empty)jobs.push({src,set:t=>{L.maps[k]=t;}});
  }
  for(const n of allNodes())if(n.mask){
    const mask=n.mask;
    jobs.push({src:mask.target,set:t=>{mask.target=t;mask._key=null;},derived:!!mask.stack});
    for(const r of mask.stack||[])if(r.t&&r.kind==='paint')jobs.push({src:r.t,set:t=>{r.t=t;}});
  }
  return jobs;
}
let p3PaintBusy=false;
async function p3PaintHold(fn){
  const held=tabDocs.hold;
  const windows=[...new Set([window,work.ownerDocument.defaultView,...dk.pops.map(p=>p.win),
    ...dtab.tabs.map(t=>t.win?.w),v3.pop?.win])].filter(w=>w&&!w.closed);
  const keys=e=>{if(e.target?.classList?.contains('lb-x')&&(e.key==='Enter'||e.key===' '))return;e.preventDefault();e.stopImmediatePropagation();};
  const covers=[];
  p3PaintBusy=true;tabDocs.hold=true;
  try{
    for(const win of windows){
      const c=win.document.createElement('div');
      c.className='ascover';
      win.document.body.append(c);covers.push(c);
      win.addEventListener('keydown',keys,true);
    }
    return await fn();
  }finally{
    for(const win of windows)if(!win.closed)win.removeEventListener('keydown',keys,true);
    covers.forEach(c=>c.remove());
    tabDocs.hold=held;p3PaintBusy=false;requestRender(true);
  }
}
function p3PaintWork(cancel){
  let buffer=null,last=performance.now();
  const check=()=>{
    if(cancel?.stopped)throw new Error('Texture size change cancelled.');
    if(gl.getError()!==gl.NO_ERROR||gl.isContextLost())throw new Error(NO_GPU_MEM);
  };
  return {images:new Map(),mesh:null,check,yieldNeeded:()=>performance.now()-last>=24,
    async pause(){check();await tick();last=performance.now();check();},
    buffer(w,h,depth,wrap,packed){
      if(buffer&&(buffer.w!==w||buffer.h!==h||buffer.depth!==depth||buffer.packed!==packed)){
        disposeTarget(buffer);buffer=null;
      }
      if(!buffer)buffer=makeTarget(w,h,depth,wrap,packed);
      else setWrap(buffer,wrap);
      return buffer;
    },
    free(){disposeTarget(buffer);meshSpaceFree(this.mesh);for(const t of this.images.values())gl.deleteTexture(t);}
  };
}
async function p3PaintPrepare(w,h,keep,cancel){
  if(w<1||h<1||Math.max(w,h)>MAX_DIM||(doc.depth===16&&w*h>=268435456))throw new Error('This computer cannot render textures at that size.');
  const jobs=p3PaintJobs(),work=p3PaintWork(cancel);
  trimPools(0);
  while(!gl.isContextLost()&&gl.getError()!==gl.NO_ERROR){}
  try{
    for(let i=0;i<jobs.length;i++){
      const j=jobs[i],src=j.src;
      j.nt=makeTarget(w,h,src.depth,undefined,src.depth===16&&w*h>=268435456,src.mono);
      work.check();
      if(j.derived)p3PaintScale(src,j.nt);
      else await p3PaintRebuild(j,work,keep);
      work.check();
      if(cancel)loadSet((i+1)/(jobs.length+1),'Rebuilding layers and masks…');
      if(work.yieldNeeded())await work.pause();
    }
    return jobs;
  }catch(e){for(const j of jobs)disposeTarget(j.nt);throw e;}
  finally{work.free();}
}
function p3PaintDetachWorking(){
  // Keep the old selection and working images alive until the new size fits in graphics memory.
  for(const k of Object.keys(aux))delete aux[k];
  for(const k of Object.keys(emptyTs))delete emptyTs[k];
  sel.t=null;
}
function p3PaintFreeWorking(state){
  for(const a of Object.values(state.aux)){
    for(const k of ['strokeT','beforeT','scratchT','previewT'])disposeTarget(a[k]);
    for(const t of a.pool.all)disposeTarget(t);
  }
  for(const t of Object.values(state.empties))disposeTarget(t);
  disposeTarget(state.sel.t);
}
async function p3PaintAtSize(w,h,{keep=false,cancel=null}={},action){
  const old=docState(),jobs=await p3PaintPrepare(w,h,keep,cancel);
  let committed=false,swapped=false;
  try{
    if(cancel?.stopped)throw new Error('Texture size change cancelled.');
    p3PaintDetachWorking();
    swapped=true;
    doc.heightReference=doc.heightReference||[doc.w,doc.h]; // keep bump slopes in the same UV units
    doc.w=w;doc.h=h;
    allocAux();
    if(gl.getError()!==gl.NO_ERROR||gl.isContextLost())throw new Error(NO_GPU_MEM);
    for(const j of jobs)j.set(j.nt);
    syncTargets();
    if(action)return await action();
    clearHistory();
    committed=true;
    return true;
  }finally{
    if(committed){
      for(const j of jobs)disposeTarget(j.src);
      p3PaintFreeWorking(old);
    }else if(swapped){
      for(const j of jobs)j.set(j.src);
      p3PaintFreeWorking({aux,empties:emptyTs,sel});
      setDocState(old);
      for(const j of jobs)disposeTarget(j.nt);
    }else for(const j of jobs)disposeTarget(j.nt);
  }
}
function p3PaintCopy(src,dst){
  const source=p3PaintValid(src);
  if(source)p3PaintAttach(dst,source);
  else if(src._paintClear)dst._paintClear=src._paintClear.slice();
}
function p3PaintBegin(s){
  const {o,L,space}=s;
  if(ui.mode!=='p3d'||!doc.p3||L.quick||L.fill||L.path||L.maskOf?.path)return;
  if(p3PaintValid(L.target)||o.extras?.some(e=>p3PaintValid(mapT(L,e.key,true)))){
    s.paintRaster={main:p3PaintValid(L.target),extras:new Map((o.extras||[]).map(e=>[e.key,p3PaintValid(mapT(L,e.key,true))]))};
  }
  if(o.sel||o.mixBrush||o.weldHeat||o.material
    ||(s.dabTint&&(o.lineBlend||o.fanFill))||o.softEnd>0
    ||!['brush','erase','dodge','burn'].includes(o.tool))return;
  const projection=space?.paintProjection||null;
  if(space&&!projection)return;
  const channels=[{t:L.target,getTarget:recTarget(L),merge:{uStroke:{int:strokeMode(o)},...tonalU(o),...chanU(o),
    uStrokeColor:o.color.slice(),uStrokeTint:!!s.tint,uStrokeOpacity:o.opacity,uLockAlpha:!!L.lockAlpha}}];
  if(o.extras?.length&&L.lockAlpha)return; // the extra channels depend on the live base-map coverage
  for(const e of o.extras||[])channels.push({t:mapT(L,e.key),getTarget:()=>mapT(L,e.key,true),merge:{uStroke:{int:e.mode},uStrokeColor:e.color.slice(),
    uStrokeOpacity:o.opacity,uLockAlpha:false}});
  s.paintReplay={channels,draw:{size:[s.SW,s.SH],d:s.space?.buf.depth||strokeT.depth,w:doc.w,h:doc.h,wrap:doc.wrap,
    projection,world:o.tool==='brush'&&o.worldNormal?Array.from(o.worldNormal):null,tint:s.dabTint,
    over:!!(o.buildup||o.pFlow),dabs:[]}};
}
function paintRegularDab(t,u,center,alpha,color,tint,over){
  const d={...u,uCenter:center,uAlpha:alpha,uTint:{int:tint?1:0},uDabCol:color||[0,0,0]};
  if(tint)run(P.stamp,t,{...d,uTint:{int:2}},{blend:'tintfirst'});
  run(P.stamp,t,d,{blend:over?'over':tint?'tintmax':'max'});
}
function p3PaintDab(s,u,copies,alpha,tip){
  const p=s.paintReplay?.draw;
  if(!p)return;
  if(!p.uniforms){
    const {uSize,uRadius,uExtent,uAngle,uFlip,uHard,uGrain,uSpray,uSprayFleck,uSprayRing,uPat,uDualOff,
      uTip,uTexImg,uDual,...fixed}=u;
    p.uniforms=fixed;
    p.images=[p3PaintImage(tip),p3PaintImage(s.texT),p3PaintImage(dualPictures.get(uDual))];
  }
  for(const [x,y] of copies)p.dabs.push([x,y,u.uRadius,u.uExtent,u.uAngle,alpha,...u.uFlip,u.uHard,u.uGrain,
    u.uSpray[0],u.uSpray[1],u.uSpray[2],u.uSpray[3],u.uSprayFleck,...u.uSprayRing,u.uPat[2],u.uPat[3],
    ...(u.uDualOff||[0,0]),...(s.dabCol||[])]);
  p.pattern=u.uPat.slice(0,2);
}
function p3PaintBatch(s,batch){
  const data=new Float32Array(batch.data),u={...batch.u};
  for(let i=0;i<data.length;i+=10){
    const [x,y,r,ext,angle,alpha,fx,fy,dx,dy]=data.subarray(i,i+10);
    Object.assign(u,{uRadius:r,uExtent:ext,uAngle:angle,uFlip:[fx,fy],uDualOff:[dx,dy]});
    p3PaintDab(s,u,[[x,y]],alpha,s.o.tip);
  }
}
function p3PaintBefore(s){
  const r=s.paintReplay;
  if(!r?.draw.dabs.length)return;
  for(const c of r.channels)c.before=p3PaintSource(c.t);
}
function p3PaintAfter(s){
  const r=s.paintReplay;
  if(!r)return;
  for(const c of r.channels)if(c.before&&c.t._paintClear===null){
    c.after={base:c.before.base,tail:{prev:c.before.tail,draw:r.draw,merge:c.merge}};
    p3PaintAttach(c.t,c.after);
  }
}
function p3PaintUndo(r,s){
  return p3PaintUndoSources(r,s.paintReplay?.channels.filter(c=>c.after)||[]);
}
function p3PaintUndoSources(r,channels){
  if(!channels.length)return r;
  const undo=r.undo,redo=r.redo;
  const restore=k=>{for(const c of channels){const t=c.getTarget();if(t?.tex&&!t.empty)p3PaintAttach(t,c[k]);}};
  r.undo=function(){undo.call(this);restore('before');};
  r.redo=function(){redo.call(this);restore('after');};
  return r;
}
function p3PaintSnap(s){
  return new Promise((resolve,reject)=>{
    const ready=data=>data?resolve(data):reject(new Error('Could not preserve the edited texture region.'));
    if(s._job)s._ready=ready;
    else ready(s.data);
  });
}
/* Pixel tools store only their changed region over the existing source. A local retouch
   at 1K can then be rebuilt without upsampling all the untouched 4K detail around it. */
function p3PaintPatch(source,getTarget,before,after,x,y){
  if(!source||!before||!after)return null;
  const t=getTarget(),w=after.w,h=after.h,d=after.depth;
  if(!t||t.empty)return null;
  if(t._paintClear){
    const next=p3PaintSource(t,true);
    p3PaintAttach(t,next);
    return {getTarget,before:source,after:next};
  }
  const pack=s=>p3PaintSnap(s).then(raw=>pxPack(new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength),w,h,d,false));
  const patch={x,y,w,h,d,W:t.w,H:t.h,before:pack(before),after:pack(after)};
  patch.before.catch(()=>{});patch.after.catch(()=>{});
  const next={base:source.base,tail:{prev:source.tail,patch}};
  p3PaintAttach(t,next);
  return {getTarget,before:source,after:next};
}
function p3PaintRasterUndo(r,s,parts,x,y,before,after){
  if(s.paintReplay||!s.paintRaster)return r;
  const changes=[],add=(...args)=>{const c=p3PaintPatch(...args);if(c)changes.push(c);};
  add(s.paintRaster.main,recTarget(s.L),before,after,x,y);
  for(const p of parts)add(s.paintRaster.extras.get(p.k),()=>mapT(s.L,p.k,true),p.before,p.after,x,y);
  return p3PaintUndoSources(r,changes);
}
function p3PaintSteps(source){
  const steps=[];
  for(let step=source.tail;step;step=step.prev)steps.push(step);
  return steps.reverse();
}
function p3PaintScale(src,dst){
  if(src.w===dst.w&&src.h===dst.h&&src.depth===dst.depth&&src.mono===dst.mono&&src.packed===dst.packed){
    blit(src,dst,0,0,src.w,src.h,0,0);
    return;
  }
  const scale=[src.w/dst.w,src.h/dst.h],taps=Math.min(8,Math.max(1,Math.ceil(Math.max(...scale))));
  run(P.resample,dst,{uSrc:src.tex,uOffset:[0,0],uScale:scale,uTaps:{int:taps}});
}
function p3PaintTexture(image,cache){
  if(!image)return dummy;
  let tex=cache.get(image);
  if(tex)return tex;
  tex=tipTexture(image.alpha,image.w,image.h,image.nearest);
  if(image.repeat){
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  }
  cache.set(image,tex);
  return tex;
}
function p3PaintRect(box,w,h){
  const x=clamp(Math.floor(box[0]),0,w),y=clamp(Math.floor(box[1]),0,h);
  return [x,y,Math.max(0,clamp(Math.ceil(box[2]),0,w)-x),Math.max(0,clamp(Math.ceil(box[3]),0,h)-y)];
}
async function p3PaintDraw(step,t,work){
  const {draw:p,merge}=step,{w,h}=t;
  const [sw,sh]=p.size;
  const factor=p.projection?Math.min(MAX_DIM/Math.max(sw,sh),Math.max(w/p.w,h/p.h)):1;
  const depth=p.d===16&&canFloat?16:8;
  const space=p.projection?meshSpace(Math.max(1,Math.round(sw*factor)),Math.max(1,Math.round(sh*factor)),p.projection,depth,work):null;
  const uv=work.buffer(w,h,depth,p.wrap,t.packed&&depth===16);
  const dst=space?space.buf:uv;
  const scale=[dst.w/sw,dst.h/sh],box=[Infinity,Infinity,-Infinity,-Infinity];
  for(const [x,y,,ext] of p.dabs){
    box[0]=Math.min(box[0],x-ext);box[1]=Math.min(box[1],y-ext);
    box[2]=Math.max(box[2],x+ext);box[3]=Math.max(box[3],y+ext);
  }
  const pixels=box.map((v,i)=>v*scale[i%2]);
  const area=p3PaintRect(pixels,dst.w,dst.h);
  if(!area[2]||!area[3])return;
  scissorDo(area,()=>clearTarget(dst));
  const [uTip,uTexImg,uDual]=p.images.map(i=>p3PaintTexture(i,work.images));
  const U={...p.uniforms,uTip,uTexImg,uDual,uSize:p.size,uDabScale:scale.map(v=>1/v)};
  for(const [x,y,r,ext,angle,a,fx,fy,hard,grain,spray,den,seed,mist,fleck,ring,swirl,phase,pat,patSeed,dx,dy,...color] of p.dabs){
    Object.assign(U,{uRadius:r,uExtent:ext,uAngle:angle,uFlip:[fx,fy],uHard:hard,uGrain:grain,uSpray:[spray,den,seed,mist],
      uSprayFleck:fleck,uSprayRing:[ring,swirl,phase],uPat:[...p.pattern,pat,patSeed],uDualOff:[dx,dy]});
    paintRegularDab(dst,U,[x,y],a,color.length?color:null,p.tint,p.over);
    if(work.yieldNeeded())await work.pause();
  }
  let r=area;
  if(space){
    const b=space.viewportBounds({bb:pixels});
    r=b?p3PaintRect([b[0]*w/doc.w-2,b[1]*h/doc.h-2,b[2]*w/doc.w+2,b[3]*h/doc.h+2],w,h):[0,0,w,h];
    if(!r[2]||!r[3])return;
    scissorDo(r,()=>space.projectStroke(dst,uv,false,p.world));
  }
  const old=makeTarget(r[2],r[3],t.depth,false,t.packed,t.mono);
  try{
    blit(t,old,...r,0,0);
    scissorDo(r,()=>run(P.merge,t,{...merge,uSrc:old.tex,uSrcOrigin:{iv2:r.slice(0,2)},uStrokeTex:uv.tex}));
  }finally{disposeTarget(old);}
}
let P_PAINT_PATCH=null;
function p3PaintUpload(w,h,d,raw){
  const depth=d===16&&canFloat?16:8,t=makeTarget(w,h,depth,false);
  if(d!==depth){
    const half=new Uint16Array(raw.buffer,raw.byteOffset,w*h*4),lut=h2fLut();
    raw=Uint8Array.from(half,v=>clamp(Math.round(lut[v]*255),0,255));
  }
  writeRegion(t,0,0,w,h,raw);
  return t;
}
async function p3PaintDrawPatch(p,t){
  const scale=[t.w/p.W,t.h/p.H],area=p3PaintRect([p.x*scale[0],p.y*scale[1],(p.x+p.w)*scale[0],(p.y+p.h)*scale[1]],t.w,t.h);
  if(!area[2]||!area[3])return;
  const targets=[];
  const unpack=async image=>{
    const {bytes,f}=await image,raw=await pxUnpack(bytes,p.w,p.h,p.d,f);
    const tex=p3PaintUpload(p.w,p.h,p.d,raw);
    targets.push(tex);
    return tex;
  };
  try{
    const before=await unpack(p.before),after=await unpack(p.after);
    if(!P_PAINT_PATCH)P_PAINT_PATCH=program(`
uniform sampler2D uBefore, uAfter;
uniform vec2 uScale, uOrigin;
void main(){
  ivec2 q=ivec2(floor(gl_FragCoord.xy*uScale-uOrigin));
  if(any(lessThan(q,ivec2(0)))||any(greaterThanEqual(q,textureSize(uAfter,0)))) discard;
  vec4 newer=texelFetch(uAfter,q,0);
  if(all(equal(newer,texelFetch(uBefore,q,0)))) discard;
  o=newer;
}`);
    scissorDo(area,()=>run(P_PAINT_PATCH,t,{uBefore:before.tex,uAfter:after.tex,uScale:scale.map(v=>1/v),uOrigin:[p.x,p.y]}));
  }finally{targets.forEach(disposeTarget);}
}
async function p3PaintRebuild(j,work,keep){
  const {src,nt}=j,current=p3PaintValid(src);
  if(!current&&src._paintClear){
    clearTarget(nt,src._paintClear);
    return;
  }
  const steps=current?p3PaintSteps(current):[];
  const meshMismatch=steps.some(s=>s.draw?.projection&&s.draw.projection.mesh!==p3PaintMeshKey(v3.mesh));
  if(!current||meshMismatch){
    p3PaintScale(src,nt);
    if(keep){
      const source=p3PaintSource(src,true);
      await source.base.image;
      p3PaintAttach(nt,source);
    }
    return;
  }
  const b=current.base;
  if(b.color)clearTarget(nt,b.color);
  else{
    const {bytes,f}=await b.image;
    const raw=await pxUnpack(bytes,b.w,b.h,b.d,f);
    if(b.w===nt.w&&b.h===nt.h&&b.d===nt.depth)writeRegion(nt,0,0,b.w,b.h,raw);
    else{
      const t=p3PaintUpload(b.w,b.h,b.d,raw);
      try{p3PaintScale(t,nt);}finally{disposeTarget(t);}
    }
  }
  for(const step of steps){
    work.check();
    if(step.patch)await p3PaintDrawPatch(step.patch,nt);
    else await p3PaintDraw(step,nt,work);
  }
  if(keep)p3PaintAttach(nt,current);
}
function p3PaintBase64(a){
  if(a.toBase64)return a.toBase64();
  let bin='';
  for(let i=0;i<a.length;i+=8192)bin+=String.fromCharCode(...a.subarray(i,i+8192));
  return btoa(bin);
}
function p3PaintEncode(source,defer){
  const b=source.base,base={w:b.w,h:b.h,d:b.d,color:b.color};
  if(b.image)base.image=defer(b.image,{});
  const out={v:1,base};
  if(!source.tail)return out;
  const images=[],keys=new Map(),patches=[];
  const imageKey=i=>{
    if(!i)return -1;
    if(!keys.has(i)){keys.set(i,images.length);images.push({...i,alpha:p3PaintBase64(i.alpha)});}
    return keys.get(i);
  };
  // Keep patch blob descriptors in the header so defer can assign their final offsets.
  const steps=p3PaintSteps(source).map(({draw,merge,patch})=>{
    if(!patch)return {draw:{...draw,images:draw.images.map(imageKey)},merge};
    return {patch:patches.push({...patch,before:defer(patch.before,{}),after:defer(patch.after,{})})-1};
  });
  const code=new TextEncoder().encode(JSON.stringify({images,steps}));
  if(patches.length)out.patches=patches;
  out.strokes=defer(streamThrough(code,'deflate-raw').then(bytes=>({bytes})),{});
  return out;
}
async function p3PaintDecode(t,r,blob){
  if(r?.v!==1||!r.base)return;
  try{
    const b=r.base;
    if(!Number.isInteger(b.w)||!Number.isInteger(b.h)||b.w<1||b.h<1||Math.max(b.w,b.h)>MAX_DIM||![8,16].includes(b.d))return;
    const base={w:b.w,h:b.h,d:b.d,color:b.color};
    const unpack=r=>Promise.resolve({bytes:blob(r).slice(),f:r.f});
    if(!Array.isArray(b.color)){
      if(!b.image)return;
      base.image=unpack(b.image);
    }
    let tail=null;
    if(r.strokes){
      const {images,steps}=JSON.parse(new TextDecoder().decode(await streamThrough(blob(r.strokes),'deflate-raw',true)));
      for(const i of images)i.alpha=Uint8Array.from(atob(i.alpha),c=>c.charCodeAt(0));
      for(const {draw,merge,patch} of steps){
        if(draw){draw.images=draw.images.map(i=>images[i]||null);tail={prev:tail,draw,merge};}
        else{const p=r.patches[patch];tail={prev:tail,patch:{...p,before:unpack(p.before),after:unpack(p.after)}};}
      }
    }
    p3PaintAttach(t,{base,tail});
  }catch(e){console.warn('Could not restore editable 3D paint. The saved texture pixels were loaded.',e);}
}
