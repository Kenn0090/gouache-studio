/* ================= .gouache documents =================
   Gouache Studio's own file: everything the app knows about a document, so nothing is lost
   between sessions (maps, per-map blend modes, masks, live gradients, editable text, animation).
   Layout: "GOUACHE\0", u32 version, u32 header length, header JSON (UTF-8), then image blobs.
   Each image is stored premultiplied, cropped to where it has content, and deflated on its own:
   8-bit images as bytes, 16-bit images as half floats. */
const GF_MAGIC=[71,79,85,65,67,72,69,0],GF_VERSION=1;
function readRegion(t,x,y,w,h){gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);let out;
  if(t.depth===16){const f=new Float32Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.FLOAT,f);out=new Uint16Array(f.length);for(let i=0;i<f.length;i++)out[i]=f2h(f[i]);out=new Uint8Array(out.buffer);}
  else{out=new Uint8Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,out);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return out;}
function writeRegion(t,x,y,w,h,bytes){gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  if(t.depth===16)gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,w,h,gl.RGBA,gl.HALF_FLOAT,new Uint16Array(bytes.buffer,bytes.byteOffset,w*h*4));
  else gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);t.mipDirty=true;}
async function encodeGouache(){const blobs=[];let off=0;
  const put=async(t,full)=>{if(!t||t.empty)return null;const b=full?[0,0,doc.w,doc.h]:contentBounds(t);if(!b)return null;
    const [x,y]=b,w=b[2]-b[0],h=b[3]-b[1],c=await streamThrough(readRegion(t,x,y,w,h),'deflate-raw');blobs.push(c);const r={o:off,n:c.length,r:[x,y,w,h],d:t.depth};off+=c.length;return r;};
  const mask=async n=>n.mask?{en:n.mask.enabled,img:await put(n.mask.target,true)}:null;
  const node=async n=>{const base={name:n.name,vis:n.visible,op:n.opacity,mode:n.mode,mask:await mask(n)};
    if(n.type==='group'){const kids=[];for(const c of n.children)kids.push(await node(c));return Object.assign(base,{t:'G',open:n.open,kids});}
    if(n.fx)return Object.assign(base,{t:'F',clip:n.clip,mapModes:n.mapModes||{},fx:{map:n.fx.map,stack:fxCleanStack(n.fx.stack)}});
    const maps={};for(const k of mapKeysOf(n)){const r=await put(mapT(n,k));if(r)maps[k]=r;}
    return Object.assign(base,{t:'L',clip:n.clip,lock:n.lockAlpha,mapModes:n.mapModes||{},maps,text:n.text?cloneText(n.text):undefined,grad:n.grad||undefined,hold:n.frame?n.hold:undefined});};
  const R=paintRoot(),kids=[];for(const c of R.children){kids.push(await node(c));await tick();}
  const all=allLayers(R),active=doc.active&&!doc.active.frame?allNodes(R).indexOf(doc.active):-1;
  const A=doc.anim;let anim=null;
  if(A){const frames=[];for(const F of A.frames)frames.push(await node(F));
    anim={frames,fps:A.fps,cur:A.cur,onion:A.onion,tags:A.tags.map(t=>{const [a,b]=tagRange(t);return {name:t.name,from:a,to:b,mode:t.mode,color:t.color};}),mode:ui.mode,bg:ui.animBg};}
  /* the 3D view's settings, and an imported model so it comes back with the document */
  let meshRec=null;if(typeof v3!=='undefined'&&v3.imported){const c=await streamThrough(meshPack(v3.imported),'deflate-raw');blobs.push(c);meshRec={o:off,n:c.length,name:v3.imported.name};off+=c.length;}
  const head={cage:cageClone(doc.cage),v3d:doc.v3d||null,mesh:meshRec,app:'Gouache Studio',v:GF_VERSION,w:doc.w,h:doc.h,depth:doc.depth,wrap:doc.wrap,name:doc.name,
    maps:doc.maps,map:doc.map,view:doc.view,mapDef:doc.mapDef,nrmStr:doc.nrmStr,light:doc.light,tex:texCfg,kids,active,anim,layers:all.length};
  const hj=new TextEncoder().encode(JSON.stringify(head)),pre=new Uint8Array(16);pre.set(GF_MAGIC,0);const dv=new DataView(pre.buffer);dv.setUint32(8,GF_VERSION,true);dv.setUint32(12,hj.length,true);
  return new Blob([pre,hj,...blobs],{type:'application/octet-stream'});}
function isGouache(buf){const u=new Uint8Array(buf,0,Math.min(8,buf.byteLength));return u.length===8&&GF_MAGIC.every((v,i)=>u[i]===v);}
async function openGouache(buf,name){if(!isGouache(buf))throw new Error('This is not a Gouache Studio document.');
  const dv=new DataView(buf),ver=dv.getUint32(8,true),hl=dv.getUint32(12,true);
  if(ver>GF_VERSION)throw new Error('This document was saved by a newer Gouache Studio. Update the app to open it.');
  const head=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,16,hl))),data=16+hl;
  if(head.w>MAX_DIM||head.h>MAX_DIM)throw new Error('This document is larger than this computer can edit.');
  const depth=head.depth===16&&!canFloat?8:head.depth;
  newDoc(head.w,head.h,depth,false,head.name||name,!!head.wrap);
  Object.assign(doc,{maps:head.maps||['base'],mapDef:head.mapDef||{},nrmStr:head.nrmStr!=null?head.nrmStr:8,light:head.light||{az:135,el:40}});
  if(head.tex)Object.assign(texCfg,head.tex);
  if(head.cage&&head.cage.A)doc.cage=cageClone(head.cage);
  if(head.v3d)doc.v3d=Object.assign({},V3D_DEFAULTS,head.v3d);
  if(head.mesh){try{const raw=await streamThrough(new Uint8Array(buf,data+head.mesh.o,head.mesh.n),'deflate-raw',true);v3.imported=meshUnpack(raw,head.mesh.name||'Model');}catch(e){console.warn('model not restored',e);}}
  const img=async(r,t)=>{if(!r)return;const raw=await streamThrough(new Uint8Array(buf,data+r.o,r.n),'deflate-raw',true);const [x,y,w,h]=r.r;
    if(r.d===t.depth){writeRegion(t,x,y,w,h,raw);return;}
    /* stored at another depth (e.g. 16-bit file on a GPU without float targets): convert */
    const n=w*h*4,out=t.depth===16?new Uint16Array(n):new Uint8Array(n);
    if(r.d===16){const hv=new Uint16Array(raw.buffer,raw.byteOffset,n),lut=h2fLut();for(let i=0;i<n;i++)out[i]=clamp(Math.round(lut[hv[i]]*255),0,255);}
    else for(let i=0;i<n;i++)out[i]=f2h(raw[i]/255);
    writeRegion(t,x,y,w,h,new Uint8Array(out.buffer));};
  const mk=async(o,parent)=>{let n;
    if(o.t==='G'){n=newGroupObj(o.name);n.open=o.open!==false;}
    else if(o.t==='F'){n=newFxLayerObj(o.name,(o.fx.stack||[]).filter(it=>it.conv?CONVERTERS[it.conv]:FX[it.id]),o.fx.map);n.clip=!!o.clip;n.mapModes=Object.assign({},o.mapModes||{});}
    else{n=newLayerObj(o.name);n.clip=!!o.clip;n.lockAlpha=!!o.lock;n.mapModes=Object.assign({},o.mapModes||{});
      for(const k in o.maps||{}){if(k!=='base'&&!doc.maps.includes(k))continue;const t=k==='base'?n.maps.base:ensureMapTarget(n,k);await img(o.maps[k],t);}
      if(o.text)n.text=o.text;if(o.grad)n.grad=o.grad;}
    Object.assign(n,{visible:o.vis!==false,opacity:o.op==null?1:o.op,mode:o.mode==null?(o.t==='G'?-1:0):o.mode});
    if(o.mask){n.mask=makeMask(1);n.mask.enabled=o.mask.en!==false;await img(o.mask.img,n.mask.target);}
    if(parent)insertNode(n,parent);
    if(o.t==='G')for(const c of o.kids||[])await mk(c,n);
    return n;};
  for(const o of head.kids||[]){await mk(o,doc.root);await tick();}
  if(!allLayers().length){const L=newLayerObj('Background');insertNode(L,doc.root);}
  syncTargets();
  const nodes=allNodes(doc.root);selectOnly(nodes[head.active]||allLayers().slice(-1)[0]);doc.count=allLayers().length;
  let animMode=false;
  if(head.anim&&head.anim.frames&&head.anim.frames.length){const an=head.anim,frames=[];
    for(const o of an.frames){const F=await mk(o,null);F.frame=true;F.hold=o.hold||1;F.parent=null;frames.push(F);}
    doc.anim=makeAnim(frames);doc.anim.fps=an.fps||12;doc.anim.cur=clamp(an.cur||0,0,frames.length-1);if(an.onion)doc.anim.onion=Object.assign(doc.anim.onion,an.onion);
    doc.anim.tags=(an.tags||[]).filter(t=>frames[t.from]&&frames[t.to]).map(t=>({name:t.name,from:frames[t.from],to:frames[t.to],mode:t.mode||'loop',color:t.color||TAG_COLORS[0]}));
    if(an.bg)ui.animBg=an.bg;animMode=an.mode==='anim';}
  if(head.map&&head.map!=='base'&&doc.maps.includes(head.map))setEditMap(head.map);
  if(head.view&&head.view!==doc.map&&(head.view==='material'||head.view==='nfinal'||head.view==='normal'))doc.view=head.view==='normal'?'nfinal':head.view;
  changedAll();updateStatus();fit();refreshMapsUI();buildBrushPanel();if(animMode)setMode('anim',true);
  if(v3.on){v3.mesh=null;if(!v3.pop)build3dPane();else build3dPane();v3.mapsDirty=true;v3.dirty=true;requestRender(true);}
  toast('Opened “'+(head.name||name)+'”.');}
