/* ================= .gouache documents =================
   Gouache Studio's own file: everything the app knows about a document, so nothing is lost
   between sessions (maps, per-map blend modes, masks, live gradients, editable text, animation).
   Layout: "GOUACHE\0", u32 version, u32 header length, header JSON (UTF-8), then image blobs.
   Each image is stored premultiplied, cropped to where it has content, and packed on its own (files/pixel-pack.js):
   8-bit images as bytes, 16-bit images as half floats. */
const GF_MAGIC=[71,79,85,65,67,72,69,0],GF_VERSION=1;
function readRegion(t,x,y,w,h){gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);let out;
  if(t.depth===16){const f=new Float32Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.FLOAT,f);packedRead(t,f);out=new Uint16Array(f.length);for(let i=0;i<f.length;i++)out[i]=f2h(f[i]);out=new Uint8Array(out.buffer);}
  else{out=new Uint8Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,out);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return out;}
function writeRegion(t,x,y,w,h,bytes){t.opaque=false;gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  if(t.depth===16)gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,w,h,t.packed?gl.RG:gl.RGBA,gl.HALF_FLOAT,packedUpload(t,new Uint16Array(bytes.buffer,bytes.byteOffset,w*h*4)));
  else gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);t.mipDirty=true;t.opaque=x===0&&y===0&&w===t.w&&h===t.h&&imageOpaque(bytes,t.depth);}
/* in the Bake or Convert tab, the painting is what gets saved */
async function encodeGouache(){return tabDocs.paint?withPaintDocAsync(encodeGouacheNow):encodeGouacheNow();}
let gfSaving=false;
const gfSaveStats={last:null};
/* Do not let a layer/tab change while its pixels and editable settings are being read. The UI thread
   remains free to paint the progress cursor; other-tab and 3D-set wrappers keep their own hold flag. */
async function encodeGouacheNow(opts){if(gfSaving)throw new Error('A document is already being saved.');gfSaving=true;
  const keys=e=>{e.preventDefault();e.stopImmediatePropagation();},held=tabDocs.hold;
  const surfaces=[...new Set([window,work.ownerDocument.defaultView,...dk.pops.map(p=>p.win),...dtab.tabs.map(t=>t.win&&t.win.w),v3.pop&&v3.pop.win])].filter(w=>w&&!w.closed),covers=[];
  const stats={bounds:0,read:0,pack:0,images:0,bytes:0,total:0},t=performance.now();
  try{for(const win of surfaces){win.addEventListener('keydown',keys,true);const c=win.document.createElement('div');c.className='ascover';win.document.body.append(c);covers.push(c);}tabDocs.hold=true;
    return await encodeGouacheData(opts,stats);}finally{stats.total=performance.now()-t;gfSaveStats.last=stats;gfSaving=false;tabDocs.hold=held;
    for(const win of surfaces)if(win&&!win.closed)win.removeEventListener('keydown',keys,true);covers.forEach(c=>c.remove());requestRender(true);}}
async function encodeGouacheData(opts,stats){opts=opts||{};const blobs=[];let off=0;/* lean: a 3D Paint texture set (no model, no bake fixes) */
  const pack=async(t,x,y,w,h,lossy)=>{let time=performance.now();const raw=await readRegionAsync(t,x,y,w,h);stats.read+=performance.now()-time;stats.bytes+=raw.byteLength;
    time=performance.now();const c=await pxPack(raw,w,h,t.depth,lossy,true);stats.pack+=performance.now()-time;stats.images++;return c;};
  /* pictures are packed (files/pixel-pack.js): lossless, or WebP for colour and grey maps with Smaller files on */
  const put=async(t,full,lossy)=>{if(!t||t.empty)return null;const start=performance.now(),b=full?[0,0,doc.w,doc.h]:await contentBoundsAsync(t);stats.bounds+=performance.now()-start;if(!b)return null;
    const [x,y]=b,w=b[2]-b[0],h=b[3]-b[1],c=await pack(t,x,y,w,h,lossy);blobs.push(c.bytes);const r={o:off,n:c.bytes.length,r:[x,y,w,h],d:t.depth,f:c.f};off+=c.bytes.length;return r;};
  /* Keep ordinary pixel blobs for older app versions, without allocating/readback of a full GPU image.
     The colour hint lets new versions reopen uniform maps without expanding their storage. */
  const putSolid=async(k,color)=>{const d=mapDepth(k),time=performance.now(),c=await pxPackSolid(color,doc.w,doc.h,d);stats.pack+=performance.now()-time;stats.images++;stats.bytes+=doc.w*doc.h*(d===16?8:4);
    blobs.push(c.bytes);const r={o:off,n:c.bytes.length,r:[0,0,doc.w,doc.h],d,f:c.f,c:color};off+=c.bytes.length;return r;};
  const mask=async n=>n.mask?{en:n.mask.enabled,lk:n.mask.link===false?0:undefined,img:await put(n.mask.target,true)}:null;
  const putRaw=async t=>{const c=await pack(t,0,0,t.w,t.h,false);blobs.push(c.bytes);const r={o:off,n:c.bytes.length,w:t.w,h:t.h,d:t.depth,f:c.f};off+=c.bytes.length;return r;};
  const node=async n=>{const base={name:n.name,vis:n.visible,op:n.opacity,mode:n.mode,mask:await mask(n),lockPx:n.lockPx||undefined,lockPos:n.lockPos||undefined,lockAll:n.lockAll||undefined,smSrc:n.smSrc||undefined,smMaskSrc:n.smMaskSrc||undefined};
    /* mask rows and content effects (0.23) */
    {const ms=await msEncode(n,put,putRaw);if(ms.stack)base.mstack=ms.stack;if(ms.cfx)base.cfx=ms.cfx;}
    if(n.type==='group'){const kids=[];for(const c of n.children)kids.push(await node(c));return Object.assign(base,{t:'G',open:n.open,kids});}
    if(n.fx)return Object.assign(base,{t:'F',clip:n.clip,mapModes:n.mapModes||{},fx:{map:n.fx.map,stack:fxCleanStack(n.fx.stack)}});
    const maps={};for(const k of mapKeysOf(n)){let r;const color=mapSolid(n,k);
      if(mapLive(n,k)){const tmp=acquireD(mapDepth(k));try{fillDrawMap(n,k,tmp);r=await put(tmp,true,PX_LOSSY.has(k));r.live=1;}finally{release(tmp);}}
      else r=color?await putSolid(k,color):await put(mapT(n,k),false,PX_LOSSY.has(k));if(r)maps[k]=r;}
    /* a material layer's own images (so it stays editable after opening) */
    let fillImg;if(n.fill&&n._fillImg){fillImg={};for(const k in n._fillImg){const t=n._fillImg[k],c=await pack(t,0,0,t.w,t.h,!mapLive(n,k)&&PX_LOSSY.has(k));blobs.push(c.bytes);fillImg[k]={o:off,n:c.bytes.length,w:t.w,h:t.h,f:c.f};off+=c.bytes.length;}}
    return Object.assign(base,{t:'L',clip:n.clip,lock:n.lockAlpha,mapModes:n.mapModes||{},maps,text:n.text?cloneText(n.text):undefined,grad:n.grad||undefined,array:n.array||undefined,arrBox:n.array?n.arrBox:undefined,styles:n.styles||undefined,shape:n.shape||undefined,fill:n.fill||undefined,idSel:n.idSel||undefined,fillImg,hold:n.frame?n.hold:undefined});};
  const R=paintRoot(),kids=[];for(const c of R.children){kids.push(await node(c));await tick();}
  const all=allLayers(R),active=doc.active&&!doc.active.frame?allNodes(R).indexOf(doc.active):-1;
  const A=doc.anim;let anim=null;
  if(A){const frames=[];for(const F of A.frames)frames.push(await node(F));
    anim={frames,fps:A.fps,cur:A.cur,onion:A.onion,tags:A.tags.map(t=>{const [a,b]=tagRange(t);return {name:t.name,from:a,to:b,mode:t.mode,color:t.color};}),mode:ui.mode,bg:ui.animBg,fxl:afxSave()};}
  /* the 3D view's settings, and an imported model so it comes back with the document */
  let meshRec=null;if(!opts.lean&&typeof v3!=='undefined'&&v3.imported){const c=await streamThrough(meshPack(v3.imported),'deflate-raw');blobs.push(c);meshRec={o:off,n:c.length,name:v3.imported.name};off+=c.length;}
  const bakeMaps={};if(!opts.lean)for(const k of ['skew','offset'])if(bk.maps[k]){const r=await put(bk.maps[k],true);if(r)bakeMaps[k]=r;}
  const meshMaps={};for(const k in doc.meshMaps||{}){const r=await put(doc.meshMaps[k],true);if(r)meshMaps[k]=r;}
  const head={p3:!!doc.p3,meshMaps,bakeMaps,cage:cageClone(doc.cage),v3d:doc.v3d||null,v3shade:doc.v3shade||null,guides:doc.guides&&doc.guides.length?doc.guides:undefined,dpi:doc.dpi||undefined,mesh:meshRec,app:'Gouache Studio',v:GF_VERSION,w:doc.w,h:doc.h,depth:doc.depth,wrap:doc.wrap,name:doc.name,
    maps:doc.maps,map:doc.map,view:doc.view,mapDef:doc.mapDef,workflow:doc.workflow,nrmStr:doc.nrmStr,light:doc.light,tex:texCfg,kids,active,anim,layers:all.length};
  const hj=new TextEncoder().encode(JSON.stringify(head)),pre=new Uint8Array(16);pre.set(GF_MAGIC,0);const dv=new DataView(pre.buffer);dv.setUint32(8,GF_VERSION,true);dv.setUint32(12,hj.length,true);
  return new Blob([pre,hj,...blobs],{type:'application/octet-stream'});}
function isGouache(buf){const u=new Uint8Array(buf,0,Math.min(8,buf.byteLength));return u.length===8&&GF_MAGIC.every((v,i)=>u[i]===v);}
function gfHead(buf){if(!isGouache(buf))throw new Error('This is not a Gouache Studio document.');const dv=new DataView(buf),ver=dv.getUint32(8,true),hl=dv.getUint32(12,true);
  if(ver>GF_VERSION)throw new Error('This document was saved by a newer Gouache Studio. Update the app to open it.');
  const head=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,16,hl)));if(head.w>MAX_DIM||head.h>MAX_DIM)throw new Error('This document is larger than this computer can edit.');if(head.depth===16&&head.w*head.h>=268435456)throw new Error('This renderer needs 8-bit colour for 16K square documents; height can keep 16-bit precision.');return {head,data:16+hl};}
async function openGouache(buf,name){const {head,data}=gfHead(buf);if(tabDocs.paint)setMode('paint',true);
  const depth=head.depth===16&&!canFloat?8:head.depth;
  newDoc(head.w,head.h,depth,false,head.name||name,!!head.wrap);
  if(head.tex)Object.assign(texCfg,head.tex);
  if(head.cage&&head.cage.A)doc.cage=cageClone(head.cage);
  if(head.v3d)doc.v3d=Object.assign({},V3D_DEFAULTS,head.v3d);
  doc.v3shade=head.v3shade||null;doc.guides=Array.isArray(head.guides)?head.guides.map(g=>({o:g.o==="v"?"v":"h",p:+g.p||0})):[];doc.dpi=+head.dpi||72;
  if(head.mesh){try{const raw=await streamThrough(new Uint8Array(buf,data+head.mesh.o,head.mesh.n),'deflate-raw',true);v3.imported=meshUnpack(raw,head.mesh.name||'Model');}catch(e){console.warn('model not restored',e);}}
  const {img,mk}=await gfReadInto(buf,head,data);
  for(const k in head.bakeMaps||{}){const t=bakeMapT(k,true);await img(head.bakeMaps[k],t);}
  let animMode=false;
  if(head.anim&&head.anim.frames&&head.anim.frames.length){const an=head.anim,frames=[];
    for(const o of an.frames){const F=await mk(o,null);F.frame=true;F.hold=o.hold||1;F.parent=null;frames.push(F);}
    doc.anim=makeAnim(frames);doc.anim.fps=an.fps||12;doc.anim.cur=clamp(an.cur||0,0,frames.length-1);if(an.onion)doc.anim.onion=Object.assign(doc.anim.onion,an.onion);
    doc.anim.tags=(an.tags||[]).filter(t=>frames[t.from]&&frames[t.to]).map(t=>({name:t.name,from:frames[t.from],to:frames[t.to],mode:t.mode||'loop',color:t.color||TAG_COLORS[0]}));
    if(an.bg)ui.animBg=an.bg;doc.anim.fxl=afxLoad(an.fxl);animMode=an.mode==='anim';}
  if(head.map&&head.map!=='base'&&doc.maps.includes(head.map))setEditMap(head.map);
  if(head.view&&head.view!==doc.map&&(head.view==='material'||head.view==='nfinal'||head.view==='normal'))doc.view=head.view==='normal'?'nfinal':head.view;
  changedAll();updateStatus();fit();refreshMapsUI();buildBrushPanel();if(animMode)setMode('anim',true);
  if(v3.on){v3.mesh=null;if(!v3.pop)build3dPane();else build3dPane();v3.mapsDirty=true;v3.dirty=true;requestRender(true);}
  toast('Opened “'+(head.name||name)+'”.');}
/* the maps, settings and layers of a document into the current (blank, right-sized) one; returns the image and layer readers */
async function gfReadInto(buf,head,data){
  Object.assign(doc,{maps:head.maps||['base'],mapDef:head.mapDef||{},workflow:head.workflow==='spec'?'spec':'metal',nrmStr:head.nrmStr!=null?head.nrmStr:8,light:head.light||{az:135,el:40}});if(head.p3)doc.p3=true;
  const img=async(r,t,L,k)=>{if(!r)return;const [x,y,w,h]=r.r;
    if(L&&x===0&&y===0&&w===doc.w&&h===doc.h&&Array.isArray(r.c)&&r.c.length===4&&r.c.every(Number.isFinite)){setMapSolid(L,k,fillSolidColor(k,r.c));return;}
    const raw=await pxUnpack(new Uint8Array(buf,data+r.o,r.n),w,h,r.d||8,r.f);
    /* Older documents also compact truly uniform fill images, checking every pixel, before GPU upload. */
    if(L&&x===0&&y===0&&w===doc.w&&h===doc.h){const a=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),step=r.d===16?8:4,v=a.getUint32(0,true),v2=step===8?a.getUint32(4,true):0;let same=true;
      for(let i=step;i<raw.byteLength;i+=step)if(a.getUint32(i,true)!==v||step===8&&a.getUint32(i+4,true)!==v2){same=false;break;}
      if(same){const c=step===8?Array.from({length:4},(_,i)=>h2fLut()[a.getUint16(i*2,true)]):Array.from(raw.subarray(0,4),v=>v/255);setMapSolid(L,k,fillSolidColor(k,c));return;}}
    if(typeof t==='function')t=t();
    if(r.d===t.depth){writeRegion(t,x,y,w,h,raw);return;}
    /* stored at another depth (e.g. 16-bit file on a GPU without float targets): convert */
    const n=w*h*4,out=t.depth===16?new Uint16Array(n):new Uint8Array(n);
    if(r.d===16){const hv=new Uint16Array(raw.buffer,raw.byteOffset,n),lut=h2fLut();for(let i=0;i<n;i++)out[i]=clamp(Math.round(lut[hv[i]]*255),0,255);}
    else for(let i=0;i<n;i++)out[i]=f2h(raw[i]/255);
    writeRegion(t,x,y,w,h,new Uint8Array(out.buffer));};
  const mk=async(o,parent)=>{let n;
    if(o.t==='G'){n=newGroupObj(o.name);n.open=o.open!==false;}
    else if(o.t==='F'){n=newFxLayerObj(o.name,(o.fx.stack||[]).filter(it=>it.conv?CONVERTERS[it.conv]:FX[it.id]),o.fx.map);n.clip=!!o.clip;n.mapModes=Object.assign({},o.mapModes||{});}
    else{n=newLayerObj(o.name,!!o.fill);n.clip=!!o.clip;n.lockAlpha=!!o.lock;n.mapModes=Object.assign({},o.mapModes||{});
      if(o.text)n.text=o.text;if(o.grad)n.grad=o.grad;if(o.array){n.array=o.array;n.arrBox=o.arrBox||null;}if(o.styles)n.styles=o.styles;if(o.shape)n.shape=o.shape;if(o.fill)n.fill=o.fill;if(o.idSel)n.idSel=o.idSel;
      if(o.fillImg){n._fillImg={};for(const k in o.fillImg){const r=o.fillImg[k],raw=await pxUnpack(new Uint8Array(buf,data+r.o,r.n),r.w,r.h,8,r.f),t=makeTarget(r.w,r.h,8,true);writeRegion(t,0,0,r.w,r.h,raw);n._fillImg[k]=t;}}
      for(const k in o.maps||{}){if(k!=='base'&&!doc.maps.includes(k))continue;const r=o.maps[k];if(r.live&&fillLiveSource(n,k))setMapLive(n,k);else await img(r,()=>ensureMapTarget(n,k),o.fill?n:null,k);}}
    Object.assign(n,{visible:o.vis!==false,opacity:o.op==null?1:o.op,mode:o.mode==null?(o.t==='G'?-1:0):o.mode});n.lockPx=!!o.lockPx;n.lockPos=!!o.lockPos;n.lockAll=!!o.lockAll;n.smSrc=o.smSrc;n.smMaskSrc=o.smMaskSrc;
    if(o.mask){n.mask=makeMask(1);n.mask.enabled=o.mask.en!==false;if(o.mask.lk===0)n.mask.link=false;await img(o.mask.img,n.mask.target);}
    await msDecode(n,o,img,async r=>{const raw=await pxUnpack(new Uint8Array(buf,data+r.o,r.n),r.w,r.h,r.d||8,r.f),t=makeTarget(r.w,r.h,8,true);writeRegion(t,0,0,r.w,r.h,raw);return t;});
    if(parent)insertNode(n,parent);
    if(o.t==='G')for(const c of o.kids||[])await mk(c,n);
    return n;};
  if(head.meshMaps&&Object.keys(head.meshMaps).length){doc.meshMaps={};for(const k in head.meshMaps){const r=head.meshMaps[k],t=makeTarget(doc.w,doc.h,r.d===16&&canFloat?16:8,false);await img(r,t);doc.meshMaps[k]=t;}}
  for(const o of head.kids||[]){await mk(o,doc.root);await tick();}
  if(!allLayers().length){const L=newLayerObj('Background');insertNode(L,doc.root);}
  syncTargets();
  const nodes=allNodes(doc.root);selectOnly(nodes[head.active]||allLayers().slice(-1)[0]);doc.count=allLayers().length;
  return {img,mk};}
