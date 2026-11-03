/* ================= The new viewer, first test (0.94) =================
   Kenn: a new 3D viewer in the desktop app, running on the graphics card directly (the first step towards ray traced
   looks and DLSS). This first test opens it in its own window with the model on show and its base colour picture,
   lit by a sky and one light, with an orbit camera (left drag turns, right drag zooms, middle drag moves, wheel zooms).
   It never takes over the normal viewer. On a computer without a usable graphics card it says so (it can run on the
   software adapter), and the normal viewer carries on as it always has. */
const NV_TEX_MAX=1024;
async function nvOpen(){
  if(!platform.isDesktop){toast('The new viewer is in the desktop app.');return null;}
  try{
    const m=mxModel();if(!m||!m.pos||!m.idx){toast('Open a model in the 3D view first.');return null;}
    const pos=new Float32Array(m.pos),nrm=m.nrm&&m.nrm.length===m.pos.length?new Float32Array(m.nrm):new Float32Array(0),
      uv=m.uv&&m.uv.length===(m.pos.length/3)*2?new Float32Array(m.uv):new Float32Array(0),idx=new Uint32Array(m.idx);
    /* the base colour picture of what you are painting, no bigger than NV_TEX_MAX across */
    let rgba=new Uint8Array(0),tw=0,th=0;
    if(doc.maps.includes('base')||true){const t=compositeMap('base');
      try{const f=readMapF(t,4),W=t.w,H=t.h,k=Math.min(1,NV_TEX_MAX/Math.max(W,H));tw=Math.max(1,Math.round(W*k));th=Math.max(1,Math.round(H*k));
        const r=k<1?resampleF(f,W,H,4,tw,th,true):f;rgba=new Uint8Array(tw*th*4);for(let i=0;i<rgba.length;i++)rgba[i]=Math.max(0,Math.min(255,Math.round(r[i]*255)));
        for(let i=3;i<rgba.length;i+=4)rgba[i]=255;}
      finally{release(t);}}
    const body=new Uint8Array(pos.byteLength+nrm.byteLength+uv.byteLength+idx.byteLength+rgba.length);let o=0;
    for(const a of [pos,nrm,uv,idx]){body.set(new Uint8Array(a.buffer,a.byteOffset,a.byteLength),o);o+=a.byteLength;}body.set(rgba,o);
    const meta={pos:pos.length,nrm:nrm.length,uv:uv.length,idx:idx.length,tw,th};
    const info=await platform.invoke('viewer_open',body,{headers:{'x-meta':JSON.stringify(meta)}});
    toast('New viewer open on '+info.name+' ('+info.backend+(info.software?', software':'')+').');
    return info;
  }catch(e){console.warn(e);toast('The new viewer could not start: '+(e&&e.message||e)+'. The normal viewer is unchanged.');return null;}}
function nvClose(){if(platform.isDesktop)platform.invoke('viewer_close').catch(()=>{});}
