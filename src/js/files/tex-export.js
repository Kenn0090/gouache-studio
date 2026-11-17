/* ================= Export textures for game engines =================
   Each preset lists the files an engine expects: which maps go in which channels (packing),
   the normal map's green direction (DirectX for Unreal, OpenGL for the rest), roughness or
   smoothness, and the usual file names. Layouts checked against the engines' documentation:
   Unreal ORM = R occlusion, G roughness, B metallic; Unity URP metallic map = R metallic,
   A smoothness; Unity HDRP mask map = R metallic, G occlusion, B detail mask, A smoothness;
   Godot ORM = R occlusion, G roughness, B metallic, OpenGL normals; Blender = separate maps. */
const TEX_PRESETS={
  unreal:{label:'Unreal Engine',normal:'dx',name:n=>'T_'+pascal(n)+'_{s}',outs:[
    {s:'BC',what:'Base colour'+' (alpha: opacity)',rgb:'base',a:'opac?'},
    {s:'N',what:'Normal (DirectX)',rgb:'normal'},
    {s:'ORM',what:'R occlusion · G roughness · B metallic',ch:['ao','rough','metal'],need:['ao','rough','metal']},
    {s:'H',what:'Height',grey:'height'},
    {s:'Curv',what:'Curvature (mask)',grey:'curv'},
    {s:'E',what:'Emissive',rgb:'emis'}]},
  urp:{label:'Unity (URP)',normal:'gl',name:n=>pascal(n)+'_{s}',outs:[
    {s:'Albedo',what:'Base map (alpha: opacity)',rgb:'base',a:'opac?'},
    {s:'MetallicSmoothness',what:'R metallic · A smoothness',ch:['metal','metal','metal','smooth'],need:['metal','rough']},
    {s:'Normal',what:'Normal (OpenGL)',rgb:'normal'},
    {s:'Occlusion',what:'Occlusion',grey:'ao'},
    {s:'Height',what:'Height (parallax)',grey:'height'},
    {s:'Curvature',what:'Curvature (mask)',grey:'curv'},
    {s:'Emission',what:'Emission',rgb:'emis'}]},
  hdrp:{label:'Unity (HDRP)',normal:'gl',name:n=>pascal(n)+'_{s}',outs:[
    {s:'BaseColor',what:'Base colour (alpha: opacity)',rgb:'base',a:'opac?'},
    {s:'MaskMap',what:'R metallic · G occlusion · B detail mask · A smoothness',ch:['metal','ao','one','smooth'],need:['metal','ao','rough']},
    {s:'Normal',what:'Normal (OpenGL)',rgb:'normal'},
    {s:'Height',what:'Height',grey:'height'},
    {s:'Curvature',what:'Curvature (mask)',grey:'curv'},
    {s:'Emissive',what:'Emissive',rgb:'emis'}]},
  /* (0.96.4, Kenn) Roblox: a SurfaceAppearance takes Color (alpha: transparency), Normal (OpenGL), Roughness and Metalness, at most 1024 px */
  roblox:{label:'Roblox (SurfaceAppearance)',normal:'gl',max:1024,name:n=>pascal(n)+'_{s}',outs:[
    {s:'Color',what:'ColorMap (alpha: transparency)',rgb:'base',a:'opac?'},
    {s:'Normal',what:'NormalMap (OpenGL)',rgb:'normal'},
    {s:'Roughness',what:'RoughnessMap',grey:'rough'},
    {s:'Metalness',what:'MetalnessMap',grey:'metal'}]},
  godot:{label:'Godot',normal:'gl',name:n=>snake(n)+'_{s}',outs:[
    {s:'albedo',what:'Albedo (alpha: opacity)',rgb:'base',a:'opac?'},
    {s:'orm',what:'R occlusion · G roughness · B metallic (ORMMaterial3D)',ch:['ao','rough','metal'],need:['ao','rough','metal']},
    {s:'normal',what:'Normal (OpenGL)',rgb:'normal'},
    {s:'height',what:'Height (white is high)',grey:'height'},
    {s:'curvature',what:'Curvature (mask)',grey:'curv'},
    {s:'emission',what:'Emission',rgb:'emis'}]},
  /* Specular/Gloss documents. Unity's Standard (Specular setup): specular in RGB, smoothness (gloss) in alpha. Unreal has no built-in
     spec/gloss material, so the maps come separately for a custom material. */
  unitySG:{label:'Unity (Standard, specular)',wf:'spec',normal:'gl',name:n=>pascal(n)+'_{s}',outs:[
    {s:'Albedo',what:'Diffuse (alpha: opacity)',rgb:'base',a:'opac?'},
    {s:'Specular',what:'RGB specular · A smoothness (glossiness)',rgbA:['spec','gloss'],need:['spec','gloss']},
    {s:'Normal',what:'Normal (OpenGL)',rgb:'normal'},
    {s:'Occlusion',what:'Occlusion',grey:'ao'},
    {s:'Height',what:'Height (parallax)',grey:'height'},
    {s:'Emission',what:'Emission',rgb:'emis'}]},
  unrealSG:{label:'Unreal Engine (specular/gloss)',wf:'spec',normal:'dx',name:n=>'T_'+pascal(n)+'_{s}',outs:[
    {s:'D',what:'Diffuse (alpha: opacity)',rgb:'base',a:'opac?'},
    {s:'S',what:'Specular colour',rgb:'spec'},
    {s:'G',what:'Glossiness',grey:'gloss'},
    {s:'N',what:'Normal (DirectX)',rgb:'normal'},
    {s:'AO',what:'Ambient occlusion',grey:'ao'},
    {s:'H',what:'Height',grey:'height'},
    {s:'E',what:'Emissive',rgb:'emis'}]},
  separateSG:{label:'Separate maps (specular/gloss)',wf:'spec',normal:'gl',name:n=>pascal(n)+'_{s}',outs:[
    {s:'Diffuse',what:'Diffuse',rgb:'base'},
    {s:'Specular',what:'Specular colour',rgb:'spec'},
    {s:'Glossiness',what:'Glossiness',grey:'gloss'},
    {s:'Normal',what:'Normal (OpenGL)',rgb:'normal'},
    {s:'Height',what:'Height',grey:'height'},
    {s:'AO',what:'Ambient occlusion',grey:'ao'},
    {s:'Emission',what:'Emission',rgb:'emis'},
    {s:'Opacity',what:'Opacity',grey:'opac'}]},
  blender:{label:'Blender',normal:'gl',name:n=>pascal(n)+'_{s}',outs:[
    {s:'BaseColor',what:'Base colour',rgb:'base'},
    {s:'Roughness',what:'Roughness',grey:'rough'},
    {s:'Metallic',what:'Metallic',grey:'metal'},
    {s:'Normal',what:'Normal (OpenGL)',rgb:'normal'},
    {s:'Height',what:'Height',grey:'height'},
    {s:'Curvature',what:'Curvature (mask)',grey:'curv'},
    {s:'AO',what:'Ambient occlusion',grey:'ao'},
    {s:'Emission',what:'Emission',rgb:'emis'},
    {s:'Opacity',what:'Opacity',grey:'opac'}]}};
const pascal=n=>(String(n||'Texture').replace(/\.[a-z0-9]+$/i,'').match(/[A-Za-z0-9]+/g)||['Texture']).map(w=>w[0].toUpperCase()+w.slice(1)).join('');
const snake=n=>(String(n||'texture').replace(/\.[a-z0-9]+$/i,'').match(/[A-Za-z0-9]+/g)||['texture']).map(w=>w.toLowerCase()).join('_');
const texCfg={preset:'unreal',normal:'preset',size:0,fmt:'png',h16:true,name:'',allSets:true,model:'none',meshMaps:false,meshOff:{},pad:'dilate+inf',padPx:16};
/* a baked mesh map (3D Paint) stands in for a map the document doesn't paint, like AO in the ORM file */
/* (0.97.14, Kenn) Export baked maps: the set's baked maps (normal, AO, curvature, thickness, position, world normal, ID, height) go out beside the textures, also in game engine exports; each can be left out */
const texMeshWanted=k=>!!texCfg.meshMaps&&!(texCfg.meshOff&&texCfg.meshOff[k])&&!k.startsWith('cv:');
const texMeshKeys=()=>Object.keys(doc.meshMaps||{}).filter(k=>doc.meshMaps[k]&&!k.startsWith('cv:'));
const texMesh=k=>doc.meshMaps&&doc.meshMaps[k]&&!doc.maps.includes(k)?doc.meshMaps[k]:null;
/* which files this document produces with a preset */
const texPresetsFor=()=>Object.entries(TEX_PRESETS).filter(([k,p])=>(p.wf||'metal')===(doc.workflow||'metal'));
function texOutputs(pr){const has=k=>doc.maps.includes(k)||!!texMesh(k);
  return pr.outs.filter(o=>{if(o.rgb==='normal')return has('height')||has('normal');if(o.rgb)return has(o.rgb);if(o.grey)return has(o.grey);return o.need.some(has);});}
function texNormalFlip(pr){const c=texCfg.normal==='preset'?pr.normal:texCfg.normal;return c==='dx';}
/* read a map of the whole document as straight 0..1 floats (C = 1 grey or 4 RGBA) */
function readMapF(t,C){const px=readPremult(t),sc=px instanceof Float32Array?1:1/255,n=t.w*t.h,out=new Float32Array(n*C);
  for(let i=0;i<n;i++){const a=px[i*4+3]*sc;if(C===1){out[i]=a>0?Math.min(1,Math.max(0,px[i*4]*sc/a)):0;continue;}
    if(a>0)for(let c=0;c<3;c++)out[i*4+c]=Math.min(1,Math.max(0,px[i*4+c]*sc/a));out[i*4+3]=Math.min(1,a);}
  return out;}
/* area average when shrinking, bilinear when enlarging; alpha-weighted colour for RGBA */
function resampleF(src,W,H,C,nw,nh,aw){if(nw===W&&nh===H)return src;
  const axis=(n,N)=>{const s=N/n,taps=[];for(let i=0;i<n;i++){const t=[];if(s>=1){const a=i*s,b=a+s;for(let j=Math.floor(a);j<Math.ceil(b);j++){const w=Math.min(b,j+1)-Math.max(a,j);if(w>0)t.push([Math.min(N-1,j),w]);}}
      else{const x=(i+.5)*s-.5,j=Math.floor(x),f=x-j;t.push([clamp(j,0,N-1),1-f],[clamp(j+1,0,N-1),f]);}const tw=t.reduce((q,v)=>q+v[1],0);t.forEach(v=>v[1]/=tw);taps.push(t);}return taps;};
  const tx=axis(nw,W),ty=axis(nh,H),mid=new Float32Array(nw*H*C),out=new Float32Array(nw*nh*C);
  const pass=(inp,outp,taps,len,other,stride,ostride,iw,ow)=>{for(let o=0;o<other;o++)for(let i=0;i<len;i++){const acc=[0,0,0,0];let aw2=0;
      for(const [j,w] of taps[i]){const p=(iw(o,j))*C;if(C===4&&aw){const a=inp[p+3]*w;for(let c=0;c<3;c++)acc[c]+=inp[p+c]*a;acc[3]+=a;aw2+=a;}else for(let c=0;c<C;c++)acc[c]+=inp[p+c]*w;}
      const q=ow(o,i)*C;if(C===4&&aw){for(let c=0;c<3;c++)outp[q+c]=aw2>0?acc[c]/aw2:0;outp[q+3]=acc[3];}else for(let c=0;c<C;c++)outp[q+c]=acc[c];}};
  pass(src,mid,tx,nw,H,0,0,(y,x)=>y*W+x,(y,x)=>y*nw+x);
  pass(mid,out,ty,nh,nw,0,0,(x,y)=>y*nw+x,(x,y)=>y*nw+x);
  return out;}
/* PNG with any channel count (1 grey, 3 RGB, 4 RGBA) at 8 or 16 bits */
async function encodePNGx(W,H,q,C,bits){const bpp=C*bits/8,row=1+W*bpp,raw=new Uint8Array(row*H);
  for(let y=0;y<H;y++){let o=y*row+1;const s=y*W*C,e=s+W*C;if(bits===16)for(let i=s;i<e;i++){raw[o++]=q[i]>>8;raw[o++]=q[i]&255;}else for(let i=s;i<e;i++)raw[o++]=q[i];}
  const z=await zlib(raw),ih=new Uint8Array(13),dv=new DataView(ih.buffer);dv.setUint32(0,W);dv.setUint32(4,H);ih[8]=bits;ih[9]=C===1?0:C===3?2:6;
  return new Blob([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',z),chunk('IEND',new Uint8Array(0))],{type:'image/png'});}
/* (0.96.2) a fine, even grain of ±1 step before an 8-bit normal map is rounded: without it a gentle slope rounds into
   contour lines that bend at every triangle (herringbone and swirls on shiny or smooth surfaces); with it, they melt into noise
   too fine to see. Same seed every time, so exports are repeatable. */
function texDither(f){let s=0x9e3779b9;const r=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};for(let i=0;i<f.length;i++)f[i]+=(r()-r())/255;return f;}
function quant(f,bits){const m=bits===16?65535:255,q=bits===16?new Uint16Array(f.length):new Uint8Array(f.length);for(let i=0;i<f.length;i++)q[i]=Math.min(1,Math.max(0,f[i]))*m+.5|0;return q;}
/* (0.98.5) more file formats: the channels as 8- or 16-bit RGBA (grey fills RGB, no alpha = opaque) */
function texRGBA(f,W,H,C,bits){const q=quant(f,bits),n=W*H,st=bits===16?new Uint16Array(n*4):new Uint8Array(n*4),one=bits===16?65535:255;
  for(let i=0;i<n;i++){if(C===1){st[i*4]=st[i*4+1]=st[i*4+2]=q[i];st[i*4+3]=one;}else{for(let c=0;c<C;c++)st[i*4+c]=q[i*C+c];if(C===3)st[i*4+3]=one;}}return st;}
function encodeBMP(W,H,st){const row=W*4,hd=54,out=new Uint8Array(hd+row*H),dv=new DataView(out.buffer);out[0]=66;out[1]=77;dv.setUint32(2,out.length,true);dv.setUint32(10,hd,true);dv.setUint32(14,40,true);dv.setInt32(18,W,true);dv.setInt32(22,H,true);dv.setUint16(26,1,true);dv.setUint16(28,32,true);dv.setUint32(34,row*H,true);dv.setInt32(38,2835,true);dv.setInt32(42,2835,true);
  for(let y=0;y<H;y++){let o=hd+(H-1-y)*row;for(let x=0;x<W;x++){const i=(y*W+x)*4;out[o++]=st[i+2];out[o++]=st[i+1];out[o++]=st[i];out[o++]=st[i+3];}}return new Blob([out],{type:'image/bmp'});}
const TEX_FORMATS=[['png','PNG (lossless)'],['tga','TGA'],['tif','TIFF'],['dds','DDS (uncompressed)'],['webp','WebP (lossless)'],['bmp','BMP'],['jpg','JPG (smaller, lossy: not for normal maps)']];
async function encodeTex(W,H,f,C,fmt,bits){
  if(fmt==='tif'){const b=bits===16?16:8;return encodeTIFF(W,H,texRGBA(f,W,H,C,b),b);}
  if(fmt==='dds')return encodeDDS(W,H,texRGBA(f,W,H,C,8),'rgba',false);
  if(fmt==='webp')return canvasBlob(W,H,texRGBA(f,W,H,C,8),'image/webp',1,false);
  if(fmt==='jpg')return canvasBlob(W,H,texRGBA(f,W,H,C,8),'image/jpeg',.95,true);
  if(fmt==='bmp')return encodeBMP(W,H,texRGBA(f,W,H,C,8));
  if(fmt==='tga'){const q=quant(f,8),st=new Uint8Array(W*H*4);for(let i=0;i<W*H;i++){if(C===1){st[i*4]=st[i*4+1]=st[i*4+2]=q[i];st[i*4+3]=255;}else{st.set(q.subarray(i*C,i*C+C),i*4);if(C===3)st[i*4+3]=255;}}
    return encodeTGA(W,H,st,true,C===4);}
  return encodePNGx(W,H,quant(f,bits),C,bits);}
/* build every file of a preset: [{name,data}] */
async function buildTextures(pr,name,opt){const W=doc.w,H=doc.h,S=pr&&pr.max?Math.max(1,Math.round(Math.min(texCfg.size||W,pr.max*W/Math.max(W,H)))):(texCfg.size||0),U=opt&&opt.udim?texUdim():null;
  /* (0.95) a UDIM set: the size is per tile, and each tile is its own file (Name_BaseColor.1001.png …) */
  /* (0.97.30) tiles with their own sizes: each tile is written at its own size (scaled with the export size, if one is chosen) */
  if(U&&U.B.lay){U.sz={};let f=1;for(const T of U.B.tiles){const R=udimTileRect(U.m,T,W,H),o=texTileOv(T.id)||(S?Math.max(1,Math.round(S*udimNominal(U.m,T)/p3.size)):R[2]);U.sz[T.id]=o;f=Math.max(f,o/Math.max(1,R[2]));}
    const render=async()=>{if(opt?.replay&&ui.mode==='p3d')msUpdateAll();const pad=texPadBegin(Math.round(doc.w*Math.max(...Object.values(U.sz))/Math.max(1,...U.B.tiles.map(T=>udimTileRect(U.m,T,doc.w,doc.h)[2]))));
      try{return await buildTexturesIn(pr,name,doc.w,doc.h,0,0,pad,U);}finally{texPadEnd(pad);}};
    f=Math.min(f,MAX_DIM/Math.max(W,H));
    if(opt?.replay&&ui.mode==='p3d'&&f>1.01){if(!v3.mesh)v3LoadModel(true);const w=Math.round(W*f),h=Math.round(H*f);return p3PaintHold(()=>p3PaintAtSize(w,h,{},render));}
    return render();}
  const tw=U?W/U.B.nx:W,th=U?H/U.B.ny:H,nw=U?(S||Math.round(tw)):(S||W),nh=U?(S?Math.max(1,Math.round(S*th/tw)):Math.round(th)):(S?Math.max(1,Math.round(S*H/W)):H);
  const render=async()=>{if(opt?.replay&&ui.mode==='p3d')msUpdateAll();
    const pad=texPadBegin(U?Math.round(nw*U.B.nx):nw);
    try{return await buildTexturesIn(pr,name,doc.w,doc.h,nw,nh,pad,U);}finally{texPadEnd(pad);}};
  const targetW=U?nw*U.B.nx:nw,targetH=U?nh*U.B.ny:nh;
  if(opt?.replay&&ui.mode==='p3d'&&(targetW!==W||targetH!==H)){
    if(!v3.mesh)v3LoadModel(true);
    const scale=Math.min(1,MAX_DIM/Math.max(targetW,targetH));
    const w=U?Math.max(1,Math.floor(nw*scale))*U.B.nx:Math.max(1,Math.floor(targetW*scale));
    const h=U?Math.max(1,Math.floor(nh*scale))*U.B.ny:Math.max(1,Math.floor(targetH*scale));
    if(w!==W||h!==H)return p3PaintHold(()=>p3PaintAtSize(w,h,{},render));
  }
  return render();}
/* (0.98.1) the Export window's own choices for the set being written: a tile's export size, a tile left out */
const texSetNow=()=>ui.mode==='p3d'&&p3.sets&&p3.sets[p3.cur]?p3.sets[p3.cur].name:'';
const texTileOv=id=>{const o=texCfg.tileSz&&texCfg.tileSz[texSetNow()];return o&&o[id]>0?o[id]:0;};
const texTileOff=id=>{const o=texCfg.tileOff&&texCfg.tileOff[texSetNow()];return !!(o&&o[id]);};
function texUdim(){if(ui.mode!=='p3d'||!p3.ua)return null;const S=p3.sets[p3.cur],m=S&&p3Binding(S),B=m&&udimBox(m);return B?{m,B}:null;}
function texCrop(f,W,H,C,r){const [x,y,w,h]=r,o=new Float32Array(w*h*C);for(let j=0;j<h;j++){const yy=Math.min(H-1,y+j);o.set(f.subarray((yy*W+x)*C,(yy*W+x+w)*C),j*w*C);}return o;}
async function buildTexturesIn(pr,name,W,H,nw,nh,pad,U){
  const cache={},has=k=>doc.maps.includes(k);
  const grey=k=>{if(k==='one')return null;const kk=k==='smooth'?'rough':k;if(cache[kk]&&kk==='metal')return cache[kk];const mm=texMesh(kk);if(!has(kk)&&!mm)return null;if(!cache[kk]){if(mm){const pt=texPadT(pad,mm,true);cache[kk]=resampleF(readMapF(pt,1),pt.w,pt.h,1,W,H,false);if(pt!==mm)release(pt);}else{const t=texPadT(pad,compositeMap(kk));cache[kk]=readMapF(t,1);release(t);}}return cache[kk];};
  const def=k=>k==='zero'?0:k==='one'?1:k==='smooth'?1-mapDefault('rough')[0]:has(k)?mapDefault(k)[0]:(MAP_DEFS[k].def!=null?MAP_DEFS[k].def:0);
  const files=[],ext=texCfg.fmt,n=W*H;
  /* (0.97.27) Specular reflectivity: the Specular colour is turned into Metallic + Base colour for presets that carry them */
  const SM=texSpecMetal()&&texOutputs(pr).some(o=>o.rgb==='base'||o.grey==='metal'||(o.ch||[]).includes('metal')||(o.rgbA||[])[0]==='base')?texSpecSolve(pad,W,H):null;
  if(SM)cache.metal=SM.metal;
  for(const o of texOutputs(pr)){let f,C;
    if(o.rgb==='normal'){const t=texPadT(pad,normalComposite(texNormalFlip(pr),null));f=readMapF(t,4);release(t);C=3;f=dropAlpha(f,n);}
    else if(o.rgb){const t=texPadT(pad,compositeMap(o.rgb));const rgba=readMapF(t,4);release(t);
      if(SM&&o.rgb==='base')for(let i=0;i<n;i++)for(let j=0;j<3;j++)rgba[i*4+j]=SM.base[i*4+j];
      if(o.rgb==='sssc'){const sh=typeof v3ShadeOf==='function'?v3ShadeOf(doc):null,c=(sh&&sh.kind==='skin'&&shParams(sh).col)||SH_DEF.skin.col;for(let i=0;i<n;i++){const al=rgba[i*4+3];for(let j=0;j<3;j++)rgba[i*4+j]=rgba[i*4+j]*al+c[j]*(1-al);rgba[i*4+3]=1;}}
      if(o.a==='opac?'&&has('opac')){const op=grey('opac');for(let i=0;i<n;i++)rgba[i*4+3]*=op[i];C=4;f=rgba;}
      else if(o.rgb==='base'&&baseHasAlpha(rgba,n)&&o.a){C=4;f=rgba;}
      else{C=3;f=dropAlpha(rgba,n);}}
    else if(o.rgbA){const [rk,ak]=o.rgbA;const t=texPadT(pad,compositeMap(rk));const rgba=readMapF(t,4);release(t);if(SM&&rk==='base')for(let i=0;i<n;i++)for(let j=0;j<3;j++)rgba[i*4+j]=SM.base[i*4+j];const g=grey(ak),d=def(ak);for(let i=0;i<n;i++)rgba[i*4+3]=g?g[i]:d;C=4;f=rgba;
      if(!has(rk)){const c=mapDefault(rk);for(let i=0;i<n;i++){rgba[i*4]=c[0];rgba[i*4+1]=c[1];rgba[i*4+2]=c[2];}}}
    else if(o.grey){const g=grey(o.grey);if(!g)continue;f=g.slice();C=1;}
    else{C=o.ch.length;f=new Float32Array(n*C);o.ch.forEach((k,c)=>{const g=grey(k),inv=k==='smooth',d=def(k);for(let i=0;i<n;i++){const v=g?g[i]:d;f[i*C+c]=inv&&g?1-v:v;}});}
    const bits=o.grey==='height'&&texCfg.h16&&(ext==='png'||ext==='tif')?16:8;
    if(U){for(const T of U.B.tiles){if(texTileOff(T.id))continue;const R=udimTileRect(U.m,T,W,H),ov=U.sz?0:texTileOv(T.id),ow=ov||(U.sz?U.sz[T.id]:nw),oh=ov?Math.max(1,Math.round(ov*nh/Math.max(1,nw))):(U.sz?U.sz[T.id]:nh),r=resampleF(texCrop(f,W,H,C,R),R[2],R[3],C,ow,oh,C===4);if(o.rgb==='normal'&&bits===8)texDither(r);
      const blob=await encodeTex(ow,oh,r,C,ext,bits);files.push({suffix:o.s,tile:T.id,name:pr.name(name).replace('{s}',o.s)+'.'+T.id+'.'+ext,data:new Uint8Array(await blob.arrayBuffer())});await tick();}continue;}
    const r=resampleF(f,W,H,C,nw,nh,C===4);if(o.rgb==='normal'&&bits===8)texDither(r);
    const blob=await encodeTex(nw,nh,r,C,ext,bits);files.push({suffix:o.s,name:pr.name(name).replace('{s}',o.s)+'.'+ext,data:new Uint8Array(await blob.arrayBuffer())});await tick();}
  return files;}
function dropAlpha(f,n){const o=new Float32Array(n*3);for(let i=0;i<n;i++){o[i*3]=f[i*4];o[i*3+1]=f[i*4+1];o[i*3+2]=f[i*4+2];}return o;}
function baseHasAlpha(f,n){for(let i=0;i<n;i++)if(f[i*4+3]<.999)return true;return false;}
/* the Export window itself is in files/export-window.js (0.98.1) */
async function exportTextures(){const pr=TEX_PRESETS[texCfg.preset],name=texCfg.name||'Texture',wantModel=mxHasModel()&&texCfg.model&&texCfg.model!=='none';
  if(p3PaintBusy||tabDocs.hold||stroke||preview||selLive)return;
  let dir=null;if(platform.isDesktop){dir=await esTargetDir(name);if(!dir)return;}
  const epm=esActive()?await epMastersCheck(es.to):{rec:null,update:false};
  toast('Exporting textures…');await tick();
  try{let files=[];const bySet={},glTex={},shInfo={};
    /* each texture set (3D Paint), or the document; the model needs glTF-shaped textures too */
    const one=async(setName,fileName)=>{const fs=await buildTextures(pr,fileName,{udim:true,replay:true});bySet[setName]=fs;files.push(...fs);
      if(eshWanted()){const g=await buildTextures(GLTF_TEX,pascal(fileName),{replay:true}),T={};for(const f of g)T[f.suffix]=f;const sh0=eshSafeShade(v3ShadeOf(doc));if(sh0&&sh0.kind==='skin'){const sk=await buildTextures(ESH_SKIN_TEX,pascal(fileName),{replay:true});for(const f of sk){T[f.suffix]=f;g.push(f);}}shInfo[setName]={sh:JSON.parse(JSON.stringify(sh0)),tex:T,alpha:doc.maps.includes('opac')};for(const f of g)if(!files.some(x=>x.name===f.name))files.push(f);}if(texCfg.meshMaps)files.push(...await buildMeshMapTextures(pr,fileName));if(texCfg.psd)files.push(...await psdChannelFiles(fileName));
      if(wantModel&&texCfg.model==='glb'){const g=await buildTextures(GLTF_TEX,pascal(fileName),{replay:true}),T={};for(const f of g)T[f.suffix]=f;T.alpha=doc.maps.includes('opac');glTex[setName]=T;}};
    /* (0.98.1) a set can have its own export size: the Size setting is swapped for the time that set is written */
    const sized=async(setName,fn)=>{const own=texCfg.setSz&&texCfg.setSz[setName],was=texCfg.size;if(own)texCfg.size=own;try{return await fn();}finally{texCfg.size=was;}};
    const sets=ui.mode==='p3d'?p3.sets.filter(S=>!S.missing):[];
    if(ui.mode==='p3d'&&(texCfg.allSets||wantModel)&&sets.length>1){const back=p3.cur;
      try{for(let i=0;i<p3.sets.length;i++){if(p3.sets[i].missing||texCfg.setOff&&texCfg.setOff[p3.sets[i].name])continue;p3SwitchSet(i,true);const S=p3.sets[i];await sized(S.name,()=>one(S.name,S.tile?name+'_'+S.tile.id:name+'_'+S.name));}}finally{p3SwitchSet(back,true);}}
    else{const S=ui.mode==='p3d'&&p3.sets[p3.cur];await sized(S?S.name:'',()=>one(S?S.name:(doc.name||name),S&&S.tile?name+'_'+S.tile.id:name));}
    if(wantModel){const m=p3.ua&&ui.mode==='p3d'&&texCfg.model==='glb'&&v3.imported?udimAtlasMesh(v3.imported):mxModel()/* (0.95) glTF has no UDIM tiles: the .glb carries the tiles' canvas UVs and whole-canvas textures; OBJ/FBX keep the file's UDIM UVs with one picture per tile */,setNames=Object.keys(bySet),groups=mxGroups(m,setNames),mn=pascal(name);
      if(texCfg.model==='glb')files=files.concat([{name:mn+'.glb',data:mxGLB(m,groups,glTex,mn)}]);
      /* (0.95.1) OBJ and FBX follow the chosen up axis (Unreal/Blender Z up); glTF is always Y up */
      else if(texCfg.model==='fbx'){const z=upExportAxis()==='z';files.push({name:mn+'.fbx',data:mxFBX(z?upYtoZ(m):m,groups,bySet,mn,pr,{zUp:z})});}
      else{const o=mxOBJ(upExportAxis()==='z'?upYtoZ(m):m,groups,bySet,mn,pr);files.push({name:mn+'.obj',data:o.obj},{name:mn+'.mtl',data:o.mtl});}}
    const epv=eshWanted()?await epResolve(es.to,epm.rec,name,shInfo):{regen:new Set(),updates:[]};
    if(eshWanted()&&Object.keys(shInfo).length)files.push(...eshFiles(es.to,name,shInfo,eshModelSize(mxHasModel()?mxModel():null),wantModel&&['glb','obj','fbx'].includes(texCfg.model)?pascal(name)+'.'+texCfg.model:null,{updateMasters:epm.update,updates:epv.updates}));
    if(!files.length){toast('Nothing to export.');return;}
    if(dir){const sep=dir.includes('\\')?'\\':'/';for(const f of files){const fp=eshPath(dir,f.name);if(f.shared&&!epm.update&&await elExists(fp)&&!await eshStale(fp))continue;if(/^(\.\.\/)*[^\/]+\//.test(f.name))await platform.invoke('make_dir',{path:fp.replace(/[\\/][^\\/]*$/,'')});await platform.writeFile(fp,f.data);}toast('Saved '+files.length+' files to '+dir);esLastBySet=bySet;await esAfter(dir,files,name);if(eshWanted()){const nregen=await epRegen(es.to,epm.rec,epv.regen);if(nregen)toast('Updated '+nregen+' material file'+(nregen===1?'':'s')+' of other assets that follow this look.');}
    if(eshWanted())await epRecord(es.to,epm.rec,name,files,shInfo,wantModel&&['glb','obj','fbx'].includes(texCfg.model)?pascal(name)+'.'+texCfg.model:null,epm.update);}
    else{const r=await deliver(pascal(name)+'_'+(pr.user?'custom':texCfg.preset)+'.zip',await makeZipMulti(files));toast(deliveredText(r,'Textures'));}
    return files;}
  catch(e){console.error(e);toast('Export failed: '+(e.message||e));}}

const meshExportSuffix=k=>'Mesh_'+({normal:'Normal',height:'Height',ao:'AO',curv:'Curvature',curvEdge:'CurvatureEdges',curvCrease:'CurvatureCreases',thick:'Thickness',wnormal:'WorldNormal',position:'Position',id:'ID',rough:'Roughness',metal:'Metallic'}[k]||pascal(k));
async function buildMeshMapTextures(pr,name){const files=[],pad=texPadBegin(texCfg.size||doc.w);try{for(const [k,t0] of Object.entries(doc.meshMaps||{})){if(!t0||!texMeshWanted(k))continue;
 const t=texPadT(pad,t0,true),C=['normal','wnormal','position','id'].includes(k)?3:1,raw=readMapF(t,C===3?4:1);if(t!==t0)release(t);let f=C===3?dropAlpha(raw,t.w*t.h):raw;
 if(k==='normal'&&texNormalFlip(pr))for(let i=1;i<f.length;i+=3)f[i]=1-f[i];
 const W=texCfg.size||t.w,H=texCfg.size?Math.max(1,Math.round(texCfg.size*t.h/t.w)):t.h,r=resampleF(f,t.w,t.h,C,W,H,false),bits=k==='height'&&texCfg.h16&&(texCfg.fmt==='png'||texCfg.fmt==='tif')?16:8;
 const blob=await encodeTex(W,H,r,C,texCfg.fmt,bits),suffix=meshExportSuffix(k);files.push({suffix,name:pr.name(name).replace('{s}',suffix)+'.'+texCfg.fmt,data:new Uint8Array(await blob.arrayBuffer())});await tick();}}finally{texPadEnd(pad);}return files;}

/* (0.97.26) channels no preset knows about (Scattering, Scatter colour, Translucency, Specular level, your own channels)
   are exported as their own files after the preset's own, named after the channel */
const TEX_EXTRA=['specl','specc','sss','sssc','trans','fuzzm',...MAP_USER];
{const f=texOutputs;texOutputs=function(pr){const o0=f(pr),spec=texSpecMetal(),used=new Set();
  const outs=spec?pr.outs.filter(o=>o0.includes(o)||o.grey==='metal'||(o.ch||[]).includes('metal')):o0;if(pr.noExtra)return outs;
  for(const o of pr.outs){for(const k of [o.rgb,o.grey,...(o.ch||[]),...(o.rgbA||[])])if(k)used.add(k);}
  for(const k of TEX_EXTRA){if(used.has(k)||!doc.maps.includes(k))continue;if((k==='specl'||k==='specc')&&doc.workflow==='spec')continue;
    const D=MAP_DEFS[k],s=pascal(D.label);outs.push(D.grey?{s,what:D.label,grey:k}:{s,what:D.label,rgb:k});}
  return outs;};}
/* (0.97.27) Specular reflectivity (Shader panel, Standard and Skin): game engines and most presets read Metallic, so on export the
   Specular colour (or the unpainted specular colour) and the base colour are turned into Metallic + Base colour, with the same
   maths as switching a set to Metal / Rough. The Specular colour picture is still exported beside them. */
function texSpecMetal(){return typeof skReflSpec==='function'&&typeof v3ShadeOf==='function'&&skReflSpec(v3ShadeOf(doc));}
function texSpecSolve(pad,W,H){const n=W*H,c=shParams(v3ShadeOf(doc)).specDef||[.22,.22,.22];
  const rd=k=>{const t=texPadT(pad,compositeMap(k)),f=readMapF(t,4);release(t);return f;};
  const D=rd('base'),S=doc.maps.includes('specc')?rd('specc'):null,base=new Float32Array(n*4),metal=new Float32Array(n),s=[0,0,0],d=[0,0,0];
  for(let i=0;i<n;i++){const a=S?S[i*4+3]:0;for(let j=0;j<3;j++){s[j]=wfLin(S?c[j]*(1-a)+S[i*4+j]*a:c[j]);d[j]=wfLin(D[i*4+j]);}
    const oms=1-Math.max(s[0],s[1],s[2]),m=wfSolveMetal(wfLum(d),wfLum(s),oms);metal[i]=m;
    for(let j=0;j<3;j++){const bd=d[j]*oms/.96/Math.max(1-m,1e-4),bs=(s[j]-.04*(1-m))/Math.max(m,1e-4);base[i*4+j]=wfSrgb(Math.min(1,Math.max(0,bd+(bs-bd)*m*m)));}
    base[i*4+3]=D[i*4+3];}
  return {base,metal};}
/* (0.97.27) the skin's own maps for game engines in one picture: red Scattering, green Translucency, blue Fuzz (white where unpainted) */
const ESH_SKIN_TEX={label:'Skin mask',normal:'gl',name:n=>n+'_{s}',noExtra:true,outs:[{s:'SkinMask',ch:['sss','trans','fuzzm'],need:['sss','trans','fuzzm']}]};
/* (0.97.26) each channel of the set as a layered PSD at the canvas size, e.g. Helmet_BaseColour.psd, Helmet_Roughness.psd */
async function psdChannelFiles(fileName){const out=[];
  for(const k of doc.maps){if(k==='curv')continue;const blob=await encodePSD(k);
    out.push({name:pascal(fileName)+'_'+pascal(MAP_DEFS[k].label)+'.psd',data:new Uint8Array(await blob.arrayBuffer())});await tick();}
  return out;}
