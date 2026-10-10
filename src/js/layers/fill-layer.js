/* ================= Fill (material) layers =================
   Like Substance Painter's fill layers: one layer that fills every map it has switched on (base colour,
   roughness, metallic, height, normal, emissive, opacity…) with a value or colour, or with an image. Images are
   laid out by the UVs (tiled, turned) or triplanar: projected from the three axes of the model and blended, so
   there are no seams. Height images make bump detail (the normal follows the height), with a strength. What shows
   is decided by the mask, so painting on a fill layer paints its mask. The layer stays live: double-click it to
   change the material. L.fill = {maps:{k:{on,src,c,v,tile,rot,name}},proj,triSharp,hStr,name};
   the chosen images are L._fillImg[k] (kept in .gouache files). */
/* projections (0.23.1): 0 UV (uUvM: offset/turn/scale), 1 triplanar, 2 planar, 3 spherical; uInv takes a world position
   into the projection's own space (its offset, rotation and scale) */
const FS_FILLIMG=`uniform sampler2D uSrc; uniform float uTile; uniform float uRot; uniform int uGrey; uniform int uProj; uniform sampler2D uPos; uniform sampler2D uNrm; uniform sampler2D uTan;
uniform float uSharp; uniform float uHStr; uniform int uHeight; uniform int uNormal; uniform mat4 uInv; uniform mat3 uNrmInv; uniform mat3 uUvM; uniform int uRep; uniform int uFront; uniform int uKeepA; in vec2 vUV;
vec4 samp(vec2 t){ float c=cos(uRot),s=sin(uRot); t=mat2(c,s,-s,c)*(t-0.5)+0.5; return texture(uSrc,t); }
vec4 sampL(vec2 t){ float c=cos(uRot),s=sin(uRot); t=mat2(c,s,-s,c)*(t-0.5)+0.5; return textureLod(uSrc,t,0.0); }
void main(){ vec4 s;
  if(uProj>=1){ ivec2 q=ivec2(gl_FragCoord.xy); vec4 P=texelFetch(uPos,q,0); if(P.a<0.5){ o=vec4(0.0); return; }
    vec3 L=(uInv*vec4(P.xyz,1.0)).xyz;
    vec3 Nworld=normalize(texelFetch(uNrm,q,0).xyz+1e-5),N=normalize(uNrmInv*Nworld+1e-5);
    if(uProj==1){ vec3 w=pow(abs(N),vec3(uSharp)); w/=max(w.x+w.y+w.z,1e-5); vec3 p=L*uTile*0.5;
      if(uNormal==1){ float c=cos(uRot),sn=sin(uRot); mat2 rot=mat2(c,-sn,sn,c);
        vec3 nx=samp(p.zy).rgb*2.0-1.0,ny=samp(p.xz).rgb*2.0-1.0,nz=samp(p.xy).rgb*2.0-1.0;
        nx.xy=rot*nx.xy;ny.xy=rot*ny.xy;nz.xy=rot*nz.xy;
        vec3 sx=vec3(sign(N.x)*nx.z,-sign(N.x)*nx.y,nx.x);
        vec3 sy=vec3(ny.x,sign(N.y)*ny.z,-sign(N.y)*ny.y);
        vec3 sz=vec3(sign(N.z)*nz.x,nz.y,sign(N.z)*nz.z);
        vec3 nLocal=normalize(sx*w.x+sy*w.y+sz*w.z);
        vec3 nWorld=normalize(transpose(mat3(uInv))*nLocal);vec4 tn=texelFetch(uTan,q,0);
        vec3 T=normalize(tn.xyz-Nworld*dot(Nworld,tn.xyz)),B=cross(Nworld,T)*tn.w;
        vec3 nTangent=normalize(vec3(dot(nWorld,T),dot(nWorld,B),dot(nWorld,Nworld)));
        s=vec4(nTangent*0.5+0.5,1.0);
      } else s=samp(p.zy)*w.x+samp(p.xz)*w.y+samp(p.xy)*w.z; }
    else if(uProj==2){ vec2 t=vec2(L.x*0.5+0.5,0.5-L.y*0.5); if(uKeepA==1&&abs(L.z)>1.0){ o=vec4(0.0); return; }
      if(uFront==1){ vec3 Nl=normalize(mat3(uInv)*texelFetch(uNrm,q,0).xyz+1e-5); if(uKeepA==1?abs(Nl.z)<0.5:Nl.z<0.15){ o=vec4(0.0); return; } }/* decals: the model's stored normals may point either way, the thin slab above keeps a sticker to the surface under it */ if(uRep==0&&(t.x<0.0||t.y<0.0||t.x>1.0||t.y>1.0)){ o=vec4(0.0); return; } s=samp(t*uTile); }
    else { vec3 d=normalize(L+vec3(0.0,0.0,1e-6)); vec2 t=vec2(atan(d.x,d.z)/6.2831853+0.5,0.5-asin(clamp(d.y,-1.0,1.0))/3.1415927); s=sampL(t*uTile); } }
  else s=samp((uUvM*vec3(vUV,1.0)).xy*uTile);
  vec3 c=s.a>1e-6?s.rgb/s.a:vec3(0.0);
  if(uGrey==1){ float g=dot(c,vec3(0.299,0.587,0.114)); if(uHeight==1) g=clamp(0.5+(g-0.5)*uHStr,0.0,1.0); o=uKeepA==1?vec4(vec3(g)*s.a,s.a):vec4(vec3(g),1.0); return; }
  if(uNormal==1){ o=uKeepA==1?vec4(c*s.a,s.a):vec4(c,1.0); return; }
  o=s; }`;
let P_FILLIMG=null,fillCount=0;
/* maps a fill can fill (curvature is a measurement, not a material) */
/* (0.37.1) Tint & adjust: recolours the material's colour after it is drawn (the mock-up's Recolour section) */
const FS_FILLTINT=`uniform sampler2D uSrc; uniform vec3 uTint; uniform float uAmt; uniform int uMode; uniform vec4 uAdj;
vec3 hueRot(vec3 c,float a){ float cs=cos(a),sn=sin(a); vec3 k=vec3(0.57735); return c*cs+cross(k,c)*sn+k*dot(k,c)*(1.0-cs); }
void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); vec3 x=c.a>0.0?c.rgb/c.a:c.rgb; float l=dot(x,vec3(.299,.587,.114)); vec3 t=uTint, r=x;
  if(uAmt>0.0){ if(uMode==0) r=x*t; else if(uMode==1) r=clamp(t*(l/max(dot(t,vec3(.299,.587,.114)),.03)),0.0,1.0);
    else if(uMode==2) r=mix(2.0*x*t,1.0-2.0*(1.0-x)*(1.0-t),step(.5,x));
    else r=l<.5?mix(t*.12,t,l*2.0):mix(t,mix(t,vec3(1.0),.7),l*2.0-1.0);
    r=mix(x,r,uAmt); }
  r=(r-.5)*(1.0+uAdj.x)+.5+uAdj.y; float l2=dot(r,vec3(.299,.587,.114)); r=mix(vec3(l2),r,1.0+uAdj.z); if(abs(uAdj.w)>1e-4) r=hueRot(r,uAdj.w);
  o=vec4(clamp(r,0.0,1.0)*c.a,c.a); }`;
let P_FILLTINT=null;
const fillTintOn=f=>!!f&&((f.tint&&f.tint.on&&f.tint.amt>0)||(f.adj&&(f.adj.con||f.adj.bri||f.adj.sat||f.adj.hue)));
function fillTintPost(L){const f=L.fill;if(!fillTintOn(f)||!f.maps.base||!f.maps.base.on)return;const T=mapT(L,'base');if(!T||T.empty)return;
  if(!P_FILLTINT)P_FILLTINT=program(FS_FILLTINT);const opaque=T.opaque,tmp=acquire(),tn=f.tint&&f.tint.on?f.tint:{amt:0,c:[1,1,1],mode:'multiply'},a=f.adj||{};
  run(P_FILLTINT,tmp,{uSrc:T.tex,uTint:tn.c||[1,1,1],uAmt:tn.amt||0,uMode:{int:['multiply','colorize','overlay','gradient'].indexOf(tn.mode||'multiply')},uAdj:[a.con||0,(a.bri||0)*.5,a.sat||0,(a.hue||0)*Math.PI/180]});
  blit(tmp,T,0,0,T.w,T.h,0,0);T.opaque=opaque;release(tmp);}
const FILL_SKIP=['curv'];
const fillMapsOf=()=>doc.maps.filter(k=>!FILL_SKIP.includes(k));
function fillDefaults(){const m={};for(const k of MAP_ORDER){if(FILL_SKIP.includes(k))continue;const d=MAP_DEFS[k].def;
    m[k]={on:k==='base'||k==='rough'||k==='metal'||k==='spec'||k==='gloss',src:k==='normal'?'image':'value',c:k==='base'?ui.fg.slice():k==='spec'?[.22,.22,.22]:k==='emis'?[0,0,0]:null,v:d==null?.5:d,tile:1,rot:0};}
  return {maps:m,proj:'uv',triSharp:4,hStr:1};}
const fillClone=f=>JSON.parse(JSON.stringify(f));
/* Match the storage rounding of the previous cleared image, including 8-bit flat normals. */
function fillSolidColor(k,c){return mapDepth(k)===16?c.map(v=>h2fLut()[f2h(v)]):c.map(v=>Math.round(clamp(v,0,1)*255)/255);}
/* where each texel of the texture sits on the model (and which way it faces), for triplanar: the model drawn in UV space */
const VS_FILLPOS=`#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aT; layout(location=3) in vec4 aTan; uniform vec2 uShift; uniform float uUVs; out vec3 vP; out vec3 vN; out vec4 vTan;
void main(){ vP=aP; vN=aN; vTan=aTan; gl_Position=vec4((aT*uUVs-uShift)*2.0-1.0,0.0,1.0); }`;
const FS_FILLDIL=`uniform sampler2D uSrc; void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec4 c=texelFetch(uSrc,p,0); if(c.a>0.5){ o=c; return; }
  vec4 acc=vec4(0.0); for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ vec4 n=texelFetch(uSrc,clamp(p+ivec2(i,j),ivec2(0),s-1),0); if(n.a>0.5) acc+=vec4(n.rgb,1.0); }
  o=acc.a>0.0?vec4(acc.rgb/acc.a,1.0):vec4(0.0); }`;
let P_FILLPOS=null,fillPosC=null,fillPosLimit='';
function fillPosMaps(){const m=v3.mesh,g=v3.gpu;if(!m||!g||m.noUV)return null;const R=ui.mode==='p3d'&&typeof p3Range==='function'?p3Range():{start:0,count:m.idx.length/3},uvs=(v3s().uvs)||1;
  const key=[m.name,m.idx.length,R.start,R.count,doc.w,doc.h,uvs].join();if(fillPosC&&fillPosC.key===key&&fillPosC.m===m)return fillPosC;
  /* The desktop renderer cannot allocate a 2 GiB or larger image. Position maps use four 32-bit channels. */
  if(doc.w*doc.h>=134217728){if(fillPosLimit!==key){fillPosLimit=key;toast('3D projection needs smaller textures on this renderer. At 16K, use UV projection.');}return null;}
  fillPosLimit='';
  if(fillPosC){disposeTarget(fillPosC.pos);disposeTarget(fillPosC.nrm);disposeTarget(fillPosC.tan);}
  if(!P_FILLPOS)P_FILLPOS={pos:prog3(VS_FILLPOS,'in vec3 vP; in vec3 vN; in vec4 vTan; void main(){ o=vec4(vP,1.0); }'),nrm:prog3(VS_FILLPOS,'in vec3 vP; in vec3 vN; in vec4 vTan; void main(){ o=vec4(normalize(vN),1.0); }'),tan:prog3(VS_FILLPOS,'in vec3 vP; in vec3 vN; in vec4 vTan; void main(){ o=vec4(normalize(vTan.xyz),vTan.w); }'),dil:program(FS_FILLDIL)};
  /* 32-bit float images must be read unfiltered (nearest), or they read as zero */
  const mk=depth=>{const t=makeTarget(doc.w,doc.h,depth,false);gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t;},pos=mk(32),nrm=mk(32),tan=mk(16),tmp=mk(32);
  for(const [t,pr] of [[pos,P_FILLPOS.pos],[nrm,P_FILLPOS.nrm],[tan,P_FILLPOS.tan]]){clearTarget(t,[0,0,0,0]);
    for(let j=0;j<uvs;j++)for(let i=0;i<uvs;i++){useProg(pr,{uShift:[i,j],uUVs:uvs});bindTarget(t);gl.disable(gl.BLEND);gl.bindVertexArray(g.vao);gl.drawElements(gl.TRIANGLES,R.count*3,gl.UNSIGNED_INT,R.start*12);}
    gl.bindVertexArray(vao);
    /* a few texels of padding past the UV edges, so seams don't show */
    for(let n=0;n<4;n++){run(P_FILLPOS.dil,tmp,{uSrc:t.tex});blit(tmp,t,0,0,doc.w,doc.h,0,0);}}
  disposeTarget(tmp);fillPosC={key,m,pos,nrm,tan};return fillPosC;}
/* A live image channel is rendered into a borrowed output, never into every material layer. */
function fillLiveSource(L,k){const f=L.fill,s=f&&f.maps[k];if(!s||!s.on||!['image','baked','conv'].includes(s.src)||k==='base'&&fillTintOn(f))return null;
  const t=s.src==='image'?L._fillImg&&L._fillImg[k]:doc.meshMaps&&doc.meshMaps[s.mm];return t&&t.tex?t:null;}
function fillLiveOpaque(L,k){const f=L.fill,s=f&&f.maps[k],img=fillLiveSource(L,k);return !!img&&!f.decal&&(!pxfIs3D(f.proj)||s.src!=='image')&&(MAP_DEFS[k].grey||k==='normal'||!!img.opaque);}
let P_FILLCOMP=null;
/* UV sampling can feed the composite directly. Quantize as the former intermediate texture did. */
function fillCompProgram(){if(!P_FILLCOMP){const sample=FS_FILLIMG.replace('void main(){ vec4 s;','vec4 fillSample(){ vec4 s;').replace(/o=([^;]+);\s*(?:return;)?/g,'return $1;');
    P_FILLCOMP=program(sample+`uniform int uFillDepth;
vec4 fillQuant(vec4 c){ if(uFillDepth==16) return vec4(unpackHalf2x16(packHalf2x16(c.rg)),unpackHalf2x16(packHalf2x16(c.ba))); return roundEven(clamp(c,0.0,1.0)*255.0)/255.0; }
`+FS_COMP.replace('texelFetch(uLayer,p,0)','fillQuant(fillSample())'));P_FILLCOMP.defaults=P.comp.defaults;}return P_FILLCOMP;}
function fillCompUniforms(L,k){const f=L.fill,s=f.maps[k],bk=s.src==='baked'||s.src==='conv';return Object.assign({uSrc:fillLiveSource(L,k).tex,uTile:bk?1:Math.max(.05,s.tile||1),uRot:bk?0:(s.rot||0)*Math.PI/180,uGrey:{int:MAP_DEFS[k].grey?1:0},uPos:dummy,uNrm:dummy,uTan:dummy,uRep:{int:f.rep===false?0:1},uFront:{int:f.front?1:0},uKeepA:{int:f.decal?1:0},uSharp:f.triSharp||4,uHStr:f.hStr==null?1:f.hStr,uHeight:{int:k==='height'?1:0},uNormal:{int:k==='normal'?1:0},uFillDepth:{int:mapDepth(k)}},pxfUniforms('uv',bk||pxfIs3D(f.proj)?null:f.xf));}
function fillDrawMap(L,k,T){const f=L.fill,s=f.maps[k],grey=MAP_DEFS[k].grey,bk=s.src==='baked'||s.src==='conv',img=fillLiveSource(L,k),tri=pxfIs3D(f.proj)&&!bk?fillPosMaps():null;
  if(!img){clearTarget(T);return;}if(!P_FILLIMG)P_FILLIMG=program(FS_FILLIMG);
  run(P_FILLIMG,T,Object.assign({uSrc:img.tex,uTile:bk?1:Math.max(.05,s.tile||1),uRot:bk?0:(s.rot||0)*Math.PI/180,uGrey:{int:grey?1:0},uPos:tri?tri.pos.tex:dummy,uNrm:tri?tri.nrm.tex:dummy,uTan:tri?tri.tan.tex:dummy,uRep:{int:f.rep===false?0:1},uFront:{int:f.front?1:0},uKeepA:{int:f.decal?1:0},
    uSharp:f.triSharp||4,uHStr:f.hStr==null?1:f.hStr,uHeight:{int:k==='height'?1:0},uNormal:{int:k==='normal'?1:0}},(tri&&!bk?pxfUniforms(f.proj,f.xf):pxfUniforms('uv',bk||pxfIs3D(f.proj)?null:f.xf))));T.opaque=(!tri||bk)&&!f.decal&&(grey||k==='normal'||!!img.opaque);
}
/* redraw a fill layer's maps from its settings (image maps need their picture in memory) */
function fillRender(L,only){const f=L.fill;if(!f)return;
  for(const k of fillMapsOf()){if(only&&k!==only)continue;const s=f.maps[k]||(f.maps[k]=fillDefaults().maps[k]);
    /* Hide the bumps below: a flat height and normal even where the material has none of its own (decals only cover their outline) */
    if(!s.on&&f.coverH!==false&&!f.decal&&(k==='height'||k==='normal')&&doc.maps.includes(k)){setMapSolid(L,k,fillSolidColor(k,k==='normal'?[.5,.5,1,1]:[.5,.5,.5,1]));continue;}
    if(!s.on){const t=mapT(L,k,true);if(t&&!t.empty)disposeTarget(t);delete L.maps[k];if(L._fillSolid)delete L._fillSolid[k];if(L._fillLive)delete L._fillLive[k];if(k===doc.map)L.target=emptyFor(mapDepth(k));continue;}
    if(s.src==='value'&&!(k==='base'&&fillTintOn(f))){const c=k==='normal'?[.5,.5,1]:MAP_DEFS[k].grey?[s.v,s.v,s.v]:(s.c||[s.v,s.v,s.v]);setMapSolid(L,k,fillSolidColor(k,[...c,1]));continue;}
    if(k==='normal'&&!(s.src==='baked'||s.src==='conv'?doc.meshMaps&&doc.meshMaps[s.mm]:L._fillImg&&L._fillImg[k])){setMapSolid(L,k,fillSolidColor(k,[.5,.5,1,1]));continue;}
    if(fillLiveSource(L,k)){setMapLive(L,k);continue;}
    if(L._fillLive)delete L._fillLive[k];const tri=pxfIs3D(f.proj)?fillPosMaps():null,T=ensureMapTarget(L,k),grey=MAP_DEFS[k].grey;
    if(s.src==='image'||s.src==='baked'||s.src==='conv'){const bk=s.src==='baked'||s.src==='conv',img=bk?doc.meshMaps&&doc.meshMaps[s.mm]:L._fillImg&&L._fillImg[k];if(!img){if(k==='normal')clearTarget(T,[.5,.5,1,1]);continue;}if(!P_FILLIMG)P_FILLIMG=program(FS_FILLIMG);
      run(P_FILLIMG,T,Object.assign({uSrc:img.tex,uTile:bk?1:Math.max(.05,s.tile||1),uRot:bk?0:(s.rot||0)*Math.PI/180,uGrey:{int:grey?1:0},uPos:tri?tri.pos.tex:dummy,uNrm:tri?tri.nrm.tex:dummy,uTan:tri?tri.tan.tex:dummy,uRep:{int:f.rep===false?0:1},uFront:{int:f.front?1:0},uKeepA:{int:f.decal?1:0},
        uSharp:f.triSharp||4,uHStr:f.hStr==null?1:f.hStr,uHeight:{int:k==='height'?1:0},uNormal:{int:k==='normal'?1:0}},(tri&&!bk?pxfUniforms(f.proj,f.xf):pxfUniforms('uv',bk||pxfIs3D(f.proj)?null:f.xf))));T.opaque=(!tri||bk)&&!f.decal&&(grey||k==='normal'||!!img.opaque);continue;}
    if(k==='normal'){clearTarget(T,[.5,.5,1,1]);continue;}
    const c=grey?[s.v,s.v,s.v]:(s.c||[s.v,s.v,s.v]);clearTarget(T,[c[0],c[1],c[2],1]);}
  if(!only||only==='base')fillTintPost(L);
  if(doc.map==='base')delete L.blankBase;L.lookVer=(L.lookVer||0)+1;scheduleThumb(L);requestRender(true);}
/* Layer › New fill layer (and the fill button under the layers): fills everything; a selection becomes its mask.
   preset: a material {name, maps:{k:{c|v|src…}}, proj, triSharp, hStr, imgs:{k:target}} fills with it and skips the dialog */
function cmdNewFillLayer(preset){if(ui.mode==='anim'){toast('Fill layers are available in Paint mode.');return;}
  if(ui.mode!=='paint'&&ui.mode!=='p3d'&&typeof setMode==='function')setMode('paint',true);
  const L=newLayerObj(preset&&preset.name||'Fill '+(++fillCount),true);doc.count--;L.fill=fillDefaults();
  if(preset&&preset.maps){for(const k in L.fill.maps)L.fill.maps[k].on=false;for(const k in preset.maps)if(L.fill.maps[k])Object.assign(L.fill.maps[k],{on:true,src:'value'},preset.maps[k]);
    for(const k of ['proj','triSharp','hStr','xf','rep','front','decal'])if(preset[k]!=null)L.fill[k]=JSON.parse(JSON.stringify(preset[k]));L.fill.name=preset.name;
    if(preset.imgs){L._fillImg={};for(const k in preset.imgs){const s=preset.imgs[k],t=makeTarget(s.w,s.h,8,true);blit(s,t,0,0,s.w,s.h,0,0);L._fillImg[k]=t;}}
    const need=Object.keys(preset.maps).filter(k=>preset.maps[k].on!==false&&!doc.maps.includes(k)&&MAP_DEFS[k]&&!(doc.workflow==='spec'&&(k==='rough'||k==='metal')));
    if(need.length)setDocMaps([...doc.maps,...need],'Add maps for the material');}
  fillRender(L);
  /* (0.27, Kenn: "materials shouldn't have a mask by default") a mask only when there is a selection to keep it in;
     painting on a material without one does nothing (fillNoMask) */
  const fromSel=sel.active&&!sel.quick;if(fromSel){const m=makeMask(1);run(P.loadsel,m.target,{uSrc:sel.t.tex,uWhat:{int:1},uInv:false});L.mask=m;L.editMask=true;}
  structOp(preset?'Add material':'New fill layer',()=>{const [p,i]=insertPoint();insertNode(L,p,i);selectOnly(L);});
  changed(L);if(!preset)dlgFillLayer(L,true);else{renderLayers();toast('Added “'+L.name+'”'+(fromSel?' in the selection.':'.'));}return L;}
/* ---- the Material panel (a tab beside Colour): edits the selected material layer live, on the canvas and the model.
   Changes become one undo step when you pause (or pick another layer). Each channel is a colour or value, an image,
   or one of the texture set's baked mesh maps. ---- */
const MAT_CH=['base','rough','metal','height','normal','emis','opac','spec','gloss','ao'];
const matEd={L:null,snap:null,timer:0,shown:null,open:{},openAll:(()=>{try{return localStorage.getItem('gs.matOpen')==='all';}catch(e){return false;}})()};
function matEdSnap(L){const keys=fillMapsOf(),S={};for(const k of keys){const t=mapT(L,k,true);S[k]=!mapSolid(L,k)&&t&&!t.empty?captureRegion(t,0,0,doc.w,doc.h):null;}
  return {f:fillClone(L.fill),C:fillClone(L._fillSolid||{}),V:fillClone(L._fillLive||{}),S,I:Object.assign({},L._fillImg||{}),n:L.name,keys};}
function matEdBegin(L){if(matEd.snap&&matEd.L===L)return;matEdCommit();matEd.L=L;matEd.snap=matEdSnap(L);}
function matEdCommit(){clearTimeout(matEd.timer);matEd.timer=0;const L=matEd.L,B=matEd.snap;matEd.snap=null;if(!L||!B||!L.fill)return;
  const I=L._fillImg||{},sameImg=Object.keys(I).length===Object.keys(B.I).length&&Object.keys(I).every(k=>I[k]===B.I[k]);
  if(JSON.stringify(B.f)===JSON.stringify(L.fill)&&B.n===L.name&&sameImg)return;
  const A=matEdSnap(L),keys=[...new Set([...B.keys,...A.keys])];
  const put=X=>{L.fill=fillClone(X.f);L._fillImg=Object.assign({},X.I);L.name=X.n;
    for(const k of keys){const s=X.S[k];if(X.V[k])setMapLive(L,k);else if(X.C[k])setMapSolid(L,k,X.C[k]);else if(s)restoreRegion(s,ensureMapTarget(L,k),0,0);else{const t=mapT(L,k,true);if(t&&!t.empty)disposeTarget(t);delete L.maps[k];if(L._fillSolid)delete L._fillSolid[k];if(L._fillLive)delete L._fillLive[k];if(k===doc.map)L.target=emptyFor(mapDepth(k));}}
    L.lookVer=(L.lookVer||0)+1;changed(L);renderLayers();if(matEd.shown===L)renderMatEd(true);};
  pushUndo({label:'Material',refs:[L],snaps:[...Object.values(B.S),...Object.values(A.S)].filter(Boolean),undo(){put(B);},redo(){put(A);}});}
/* images a channel shows: its own picture, or the baked mesh map it uses */
function fillImgsOf(L){const o=Object.assign({},L._fillImg||{}),M=doc.meshMaps||{},f=L.fill;if(f)for(const k in f.maps){const s=f.maps[k];if(s&&(s.src==='baked'||s.src==='conv')&&M[s.mm])o[k]=M[s.mm];}return o;}
function renderMatEd(force){const box=document.getElementById('matEdBody');if(!box)return;const L=doc.active;
  /* a mask or effect row selected in the Layers panel: its settings */
  const row=typeof msRowOf==='function'&&ui.msSel&&(ui.msSel.L===L||ui.msSel.L.live)?msRowOf(ui.msSel):null;
  /* (0.27) only rebuild when a different row is picked: rebuilding while a slider is dragged took the slider away from the mouse */
  if(row){if(!force&&matEd.shownRow===row&&matEd.shown===null&&box.childElementCount)return;if(matEd.L&&matEd.L!==L)matEdCommit();matEd.shown=null;matEd.shownRow=row;box.replaceChildren();msRowEditor(box,ui.msSel.L,ui.msSel.where,row);return;}
  matEd.shownRow=null;
  if(!force&&matEd.shown===L&&box.childElementCount&&!(L&&L.fill&&!box.querySelector('.matHead')))return;
  if(matEd.L&&matEd.L!==L)matEdCommit();matEd.shown=L;
  if(!isLayer(L)||!L.fill){box.replaceChildren(el('p',{class:'note',text:'Select a material (fill) layer, or a mask or effect row under a layer, to change it here.'}),
    el('div',{class:'chips'},el('button',{class:'btn sm',id:'matEdNew',text:'New material',onclick:()=>cmdNewFillLayer()}),el('button',{class:'btn sm',text:'Materials…',onclick:()=>showPanel('mats')})));return;}
  const W=L.fill,prev=matPreviewEl(()=>L.fill,()=>fillImgsOf(L));
  /* every change: remember the state before the first one, redraw, and make the undo step after a pause */
  const edit=(fn,k,redraw)=>{matEdBegin(L);fn();if(k!==false){fillRender(L,k||undefined);prev.redraw();}clearTimeout(matEd.timer);matEd.timer=setTimeout(matEdCommit,700);if(redraw)renderMatEd(true);};
  box.replaceChildren();
  const nm=el('input',{type:'text',id:'fl_name',value:L.name,'aria-label':'Material name'});nm.addEventListener('input',()=>edit(()=>{L.name=nm.value||L.name;W.name=L.name;renderLayers();},false));
  box.append(el('div',{class:'matHead'},prev.el,el('div',{class:'dlg-grid'},nm,
    el('div',{class:'sub',text:'Projection'}),(()=>{const g=seg(PXF_MODES,W.proj||'uv',v=>edit(()=>{W.proj=v;if(pxfIs3D(v)&&!fillPosMaps())toast('This projection needs a model: open the 3D view or 3D Paint. Until then images follow the UVs.');},null,true),'Projection');g.classList.add('tight');g.id='fl_proj';return g;})(),
    W.proj==='tri'?makeSlider({id:'fl_sharp',label:'Blend',min:1,max:16,step:.5,value:W.triSharp||4,fmt:v=>v<3?'soft':v>9?'sharp':'medium',onInput:v=>edit(()=>{W.triSharp=v;})}).el:null,
    W.proj==='planar'?el('div',{class:'chips'},chk('fl_rep','Repeat',W.rep!==false,v=>edit(()=>{W.rep=v;},null)),chk('fl_front','Front faces only',!!W.front,v=>edit(()=>{W.front=v;},null))):null,
    pxfFields(()=>pxfOf(W),fn=>edit(()=>fn(pxfOf(W)),null),W.proj||'uv',()=>renderMatEd(true),!!W.decal))));
  /* Tint & adjust: what most people change, straight under the projection */
  {const TN=W.tint||(W.tint={on:false,mode:'multiply',c:[.77,.42,.18],amt:.7}),AJ=W.adj||(W.adj={con:0,bri:0,sat:0,hue:0}),fold=(id,title,on,body)=>{const open=matEd.open[id]!==false&&(matEd.open[id]||on||matEd.openAll);
      const card=el('div',{class:'fillcard tint'+(open?' open':'')},el('div',{class:'fillhead',onclick:e=>{if(e.target.closest('.chk'))return;matEd.open[id]=!card.classList.contains('open');card.classList.toggle('open',matEd.open[id]);}},
        el('span',{class:'chev',text:'▸'}),el('span',{class:'nm',text:title}),el('span',{class:'v',id:id+'_v'})),body);return card;};
    const tb=el('div',{class:'fillbody'},
      seg([['multiply','Multiply'],['colorize','Colorize'],['overlay','Overlay'],['gradient','Gradient']],TN.mode||'multiply',v=>edit(()=>{TN.mode=v;TN.on=true;},'base',true),'Tint mode'),
      el('div',{class:'frow'},el('label',{text:'Colour'}),colourBtn('fl_tint_c',()=>TN.c,c=>edit(()=>{TN.c=c;TN.on=true;},'base'),'Tint colour')),
      makeSlider({id:'fl_tint_a',label:'Amount',min:0,max:1,step:.01,value:TN.amt,fmt:pct,onInput:v=>edit(()=>{TN.amt=v;TN.on=v>0;},'base')}).el,
      el('div',{class:'chips'},...[['Rust',[.77,.42,.18]],['Moss',[.30,.49,.29]],['Blue steel',[.23,.44,.88]],['Gold',[.79,.64,.29]]].map(([n,c])=>el('button',{class:'btn sm',text:n,onclick:()=>edit(()=>{TN.c=c.slice();TN.on=true;if(!TN.amt)TN.amt=.7;},'base',true)})),
        el('button',{class:'btn sm',id:'fl_tint_off',text:'None',onclick:()=>edit(()=>{TN.on=false;},'base',true)})));
    const aj=(id,label,key,min,max,fm)=>makeSlider({id,label,min,max,step:key==='hue'?1:.01,value:AJ[key]||0,fmt:fm,onInput:v=>edit(()=>{AJ[key]=v;},'base')}).el;
    const ab=el('div',{class:'fillbody'},aj('fl_adj_con','Contrast','con',-1,1,pct),aj('fl_adj_bri','Brightness','bri',-1,1,pct),aj('fl_adj_sat','Saturation','sat',-1,1,pct),aj('fl_adj_hue','Hue shift','hue',-180,180,v=>Math.round(v)+'°'),el('div',{class:'chips resetrow'},el('button',{class:'btn sm',id:'fl_adj_reset',text:'Reset',title:'Back to no adjustment',onclick:()=>edit(()=>{Object.assign(AJ,{con:0,bri:0,sat:0,hue:0});},'base',true)})));
    const t1=fold('fl_tint','Tint',TN.on,tb),t2=fold('fl_adj','Adjust',fillTintOn({adj:AJ}),ab);
    t1.querySelector('.fillhead').append(chk('fl_tint_on','',!!TN.on,v=>edit(()=>{TN.on=v;if(v&&!TN.amt)TN.amt=.7;matEd.open.fl_tint=v;},'base',true)));
    t1.querySelector('.v').textContent=TN.on?(TN.mode||'multiply')+' '+Math.round(TN.amt*100)+'%':'off';t2.querySelector('.v').textContent=fillTintOn({adj:AJ})?'on':'contrast, brightness…';
    box.append(el('div',{class:'sub',text:'Tint & adjust'}),t1,t2);}
  const M=doc.meshMaps||{},mks=Object.keys(M).filter(k=>!k.startsWith('cv:')),cks=Object.keys(M).filter(k=>k.startsWith('cv:')),keys=MAT_CH.filter(k=>fillMapsOf().includes(k)&&!(doc.workflow==='spec'?k==='rough'||k==='metal':k==='spec'||k==='gloss'));/* (0.53.1) only the channels of this project's workflow: no Roughness or Metallic in Spec/Gloss, no Specular or Glossiness in PBR */
  if(ui.mode==='p3d'&&doc.p3){const spec=doc.workflow==='spec',hand=doc.p3Setup==='handpainted';box.append(el('div',{class:'sub p3-material-section',text:(hand?'Hand-painted · ':'')+(spec?'Spec Gloss parameters':'PBR parameters')}));}
  for(const k of keys){const s=W.maps[k]||(W.maps[k]=fillDefaults().maps[k]),grey=MAP_DEFS[k].grey,isN=k==='normal';
    const row=el('div',{class:'fillbody'}),open=!!(s.on&&(matEd.open[k]||matEd.openAll)),card=el('div',{class:'fillcard fillrow'+(open?' open':'')+(s.on?'':' off')});
    const sumTxt=!s.on?'Off':s.src==='value'?(grey?Math.round(s.v*100)/100:'Colour'):s.src==='baked'?'Mesh map':s.src==='conv'?'Converted':(s.name?'Image':'No image'),sw=s.on&&s.src==='value'?(grey?[s.v,s.v,s.v]:(s.c||[.5,.5,.5])):[.5,.5,.5];
    card.append(el('div',{class:'fillhead',onclick:e=>{if(e.target.closest('.chk'))return;matEd.open[k]=!card.classList.contains('open');card.classList.toggle('open',matEd.open[k]);}},
      el('span',{class:'chev',text:'▸'}),el('span',{class:'sw',style:'background:rgb('+sw.map(x=>Math.round(clamp(x,0,1)*255)).join(',')+')'}),el('span',{class:'nm',text:MAP_DEFS[k].label}),el('span',{class:'v',text:String(sumTxt)}),
      chk('fl_on_'+k,'',!!s.on,v=>edit(()=>{s.on=v;matEd.open[k]=v;if(v&&isN&&s.src==='value')s.src='image';},k,true))),row);
    if(s.on){const srcs=[...(isN?[]:[['value',grey?'Value':'Colour']]),['image','Image'],['baked','Mesh map'],['conv','Converted']];
      row.append(seg(srcs,s.src,v=>{if(v==='image'&&!(L._fillImg&&L._fillImg[k])){matEdBegin(L);fillPickImage(L,k,s,()=>edit(()=>{},k,true));return;}
        edit(()=>{s.src=v;if(v==='baked'&&!(M[s.mm]&&!s.mm.startsWith('cv:')))s.mm=mks.find(x=>x===k)||(isN?'normal':mks.find(x=>x!=='normal'))||mks[0];if(v==='conv'&&!(M[s.mm]&&s.mm.startsWith('cv:')))s.mm=cks.find(x=>x==='cv:'+k)||cks[0];},k,true);},'Fill '+MAP_DEFS[k].label+' with'));
      if(s.src==='value'&&!isN){if(grey)row.append(makeSlider({id:'fl_v_'+k,label:k==='metal'?'Metallic':k==='rough'?'Roughness':k==='height'?'Height':k==='gloss'?'Glossiness':'Level',min:0,max:1,step:.01,value:s.v,fmt:pct,onInput:v=>edit(()=>{s.v=v;},k)}).el);
        else row.append(el('div',{class:'frow'},el('label',{text:'Colour'}),colourBtn('fl_c_'+k,()=>s.c||[.5,.5,.5],c=>edit(()=>{s.c=c;},k),MAP_DEFS[k].label+' colour')));}
      else if(s.src==='conv'){
        /* the maps made by Filter › Mesh maps from material, as tiles */
        if(!cks.length)row.append(el('p',{class:'note',text:'No converted maps yet. Right-click a material layer › Mesh maps from this material.'}),el('button',{class:'btn sm',text:'Make them…',onclick:()=>dlgMatConvert(L)}));
        else row.append(el('div',{class:'cvtiles'},...cks.map(x=>el('button',{class:'cvtile'+(s.mm===x?' on':''),id:'fl_cv_'+k+'_'+x.slice(3),'aria-pressed':String(s.mm===x),text:msMeshName(x).replace(' (converted)',''),onclick:()=>edit(()=>{s.mm=x;},k,true)}))));}
      else if(s.src==='baked'){
        if(!mks.length)row.append(el('p',{class:'note',text:'No baked maps in this texture set yet. Bake in the Bake tab and press Send to 3D Paint.'}));
        else{const pick=el('select',{id:'fl_mm_'+k,'aria-label':MAP_DEFS[k].label+' from the baked map'},...mks.map(x=>el('option',{value:x,text:(typeof P3_MESHMAP_NAMES!=='undefined'&&P3_MESHMAP_NAMES[x])||x})));
          pick.value=M[s.mm]?s.mm:mks[0];pick.onchange=()=>edit(()=>{s.mm=pick.value;},k);row.append(pick);
          if(k==='height')row.append(makeSlider({id:'fl_hs',label:'Bump strength',min:0,max:4,numericMax:20,step:.05,value:W.hStr==null?1:W.hStr,fmt:pct,onInput:v=>edit(()=>{W.hStr=v;},k)}).el);}}
      else{const has=!!(L._fillImg&&L._fillImg[k]);
        row.append(el('div',{class:'row wrap'},el('span',{class:'note',text:s.name||(isN?'No normal map yet':'No image')}),el('button',{class:'btn sm',text:'Choose image…',id:'fl_img_'+k,onclick:()=>{matEdBegin(L);fillPickImage(L,k,s,()=>edit(()=>{},k,true));}})));
        if(has)row.append(makeSlider({id:'fl_t_'+k,label:W.proj==='tri'?'Scale':'Tile',min:.25,max:1000,numericMin:.01,numericMax:10000,step:.25,value:s.tile||1,fmt:v=>v+'×',onInput:v=>edit(()=>{s.tile=v;},k)}).el,
          makeSlider({id:'fl_r_'+k,label:'Turn',min:-180,max:180,step:1,value:s.rot||0,fmt:v=>v+'°',onInput:v=>edit(()=>{s.rot=v;},k)}).el);
        else if(s.name)row.append(el('p',{class:'note',text:'Choose the image again to change its tiling.'}));
        if(k==='height'&&has)row.append(makeSlider({id:'fl_hs',label:'Bump strength',min:0,max:4,numericMax:20,step:.05,value:W.hStr==null?1:W.hStr,fmt:pct,onInput:v=>edit(()=>{W.hStr=v;},k)}).el,
          el('p',{class:'note',text:'Height makes bump detail: the normal follows it, on the model and in exported normal maps.'}));}}
    box.append(card);}
  box.append(chk('fl_cover','Hide the bumps below',W.coverH!==false,v=>edit(()=>{W.coverH=v;},null)),
    el('p',{class:'note',text:'On: this material covers the height and normal detail of the layers under it. Off: its bumps are added on top of theirs.'}));
  const miss=['rough','metal','height','normal','emis','opac'].filter(k=>!doc.maps.includes(k)&&!(doc.workflow==='spec'&&(k==='rough'||k==='metal')));
  if(miss.length)box.append(el('div',{class:'chips'},el('span',{class:'note',text:'Add a map:'}),...miss.map(k=>el('button',{class:'btn sm',text:MAP_DEFS[k].label,onclick:()=>{matEdCommit();setDocMaps([...doc.maps,k],'Add a map for the material');fillRender(L);renderMatEd(true);}}))));
  box.append(el('div',{class:'chips'},el('button',{class:'btn sm',id:'fl_save',text:'Save to Materials',title:'Keep this material in the Materials tab for other layers and projects',onclick:()=>{matEdCommit();if(typeof matSaveFromFill==='function')matSaveFromFill(L,L.fill);}})),
    el('p',{class:'note',text:'Painting on a material layer paints its mask: black hides the material, white shows it.'}));}
/* the layer's material: brings the Material panel forward on it (double-click a material layer, Fill settings…) */
function dlgFillLayer(L){L=L||doc.active;if(!isLayer(L)||!L.fill){toast('Select a fill layer.');return;}if(doc.active!==L){selectOnly(L);renderLayers();}
  showPanel('matEd');renderMatEd(true);}
/* the panel follows the selected layer */
/* (0.27) picking another layer (which only restyles the rows) also shows it here; this used to happen only by luck */
function matEdFollow(){if((matEd.shown!==doc.active&&!(matEd.shown===null&&matEd.shownRow&&typeof msRowOf==='function'&&ui.msSel&&msRowOf(ui.msSel)===matEd.shownRow))||(doc.active&&doc.active.fill&&!document.querySelector('#matEdBody .matHead')))renderMatEd();}
{const ur=updateRowClasses;updateRowClasses=function(...a){const r=ur.apply(this,a);matEdFollow();return r;};}
{const rl=renderLayers;renderLayers=function(...a){const r=rl.apply(this,a);if((matEd.shown!==doc.active&&!(matEd.shown===null&&matEd.shownRow&&typeof msRowOf==='function'&&ui.msSel&&msRowOf(ui.msSel)===matEd.shownRow))||(doc.active&&doc.active.fill&&!document.querySelector('#matEdBody .matHead')))renderMatEd();return r;};}
async function fillPickImage(L,k,s,done){const fs=await pickFiles('image/*',false,'Images',['png','jpg','jpeg','webp','tga','tif','tiff','bmp','psd','exr','hdr']);const f=fs[0];if(!f){if(!(L._fillImg&&L._fillImg[k])&&k!=='normal')s.src='value';done();return;}
  let t;try{t=await fileTarget(f);}catch(e){toast('Could not read '+f.name+': '+(e.message||e));if(k!=='normal')s.src='value';done();return;}
  setWrap(t,true);L._fillImg=L._fillImg||{};L._fillImg[k]=t;s.src='image';s.name=f.name;done();}
/* painting, filters and fills on a fill layer go to its mask */
/* painting, filling or a gradient on a material without a mask: the material itself is made from its settings,
   so the paint goes into a new black mask (Kenn: paint white to reveal, like Substance) (one undo step) */
/* (0.28, Kenn) a material layer without a mask: painting, filling and gradients do nothing at all (it is made from its
   settings; add a mask to show it in places) */
function fillNoMask(){const n=doc.active;return ui.mode!=='bake'&&!sel.quick&&isLayer(n)&&!!n.fill&&!n.mask&&!n.fx;}
function fillMaskEdit(n){if(isLayer(n)&&n.fill&&n.mask&&!n.editMask)n.editMask=true;}
/* Convert to pixels: the layer keeps what it shows now and becomes a normal layer */
function fillRasterize(L){if(!L||!L.fill)return;const f=L.fill;for(const k of mapKeysOf(L))if(mapSolid(L,k)||mapLive(L,k))ensureMapTarget(L,k);L.fill=null;pushUndo({label:'Convert fill to pixels',refs:[L],undo(){L.fill=f;renderLayers();},redo(){L.fill=null;renderLayers();}});renderLayers();}
/* Preview shading samples the original material maps on the GPU. Read back only the
   small finished preview, never a full document or a CPU copy of each material map. */
let P_MATPREVIEW=null;
const FS_MATPREVIEW=`uniform vec2 uSize; uniform sampler2D uBase; uniform sampler2D uRough; uniform sampler2D uMetal; uniform sampler2D uHeight; uniform sampler2D uNormal;
uniform int uBaseOn; uniform int uRoughOn; uniform int uMetalOn; uniform int uHeightOn; uniform int uNormalOn;
uniform vec3 uColor; uniform float uR; uniform float uM; uniform float uH;
uniform vec2 uBaseTile; uniform vec2 uRoughTile; uniform vec2 uMetalTile; uniform vec2 uHeightTile; uniform vec2 uNormalTile;
uniform vec4 uRot; uniform float uNormalRot;
vec2 uvAt(vec2 uv,vec2 tile,float angle){float a=cos(angle),b=sin(angle);return mat2(a,b,-b,a)*(uv*tile-.5)+.5;}
vec3 sampleColor(sampler2D im,vec2 uv){vec4 c=texture(im,uv);return c.a>1e-6?c.rgb/c.a:vec3(0);}
void main(){vec2 q=vec2(gl_FragCoord.x/uSize.x*2.0-1.0,1.0-gl_FragCoord.y/uSize.y*2.0);float rr=dot(q,q);if(rr>=1.0){o=vec4(0);return;}
vec3 N=vec3(q,sqrt(1.0-rr));vec2 uv=vec2(.5+atan(N.x,N.z)/6.2831853,.5-asin(N.y)/3.1415927);uv.x*=2.0;
vec3 T=normalize(vec3(N.z,0,-N.x)),B=normalize(cross(N,T));vec3 bump=vec3(0,0,1);
if(uNormalOn==1){bump=sampleColor(uNormal,uvAt(uv,uNormalTile,uNormalRot))*2.0-1.0;float a=cos(uNormalRot),b=sin(uNormalRot);bump.xy=mat2(a,-b,b,a)*bump.xy;}
if(uHeightOn==1){vec2 t=uvAt(uv,uHeightTile,uRot.w),e=1.0/vec2(textureSize(uHeight,0));float hx=sampleColor(uHeight,t+vec2(e.x,0)).r-sampleColor(uHeight,t-vec2(e.x,0)).r,hy=sampleColor(uHeight,t+vec2(0,e.y)).r-sampleColor(uHeight,t-vec2(0,e.y)).r;bump.xy+=vec2(-hx,hy)*uH*6.0;}
N=normalize(T*bump.x+B*bump.y+N*max(bump.z,.001));vec3 c=uBaseOn==1?sampleColor(uBase,uvAt(uv,uBaseTile,uRot.x)):uColor;c=pow(max(c,vec3(0)),vec3(2.2));
float r=clamp(uRoughOn==1?sampleColor(uRough,uvAt(uv,uRoughTile,uRot.y)).r:uR,.04,1.0),mt=clamp(uMetalOn==1?sampleColor(uMetal,uvAt(uv,uMetalTile,uRot.z)).r:uM,0.0,1.0);
vec3 L=normalize(vec3(-.5,.6,.65)),H=normalize(L+vec3(0,0,1));float nl=max(0.0,dot(N,L)),nh=max(0.0,dot(N,H)),sp=pow(nh,2.0+(1.0-r)*(1.0-r)*120.0)*(1.0-r*.7)*(.3+mt*.7);
float Ry=2.0*N.z*N.y,sky=(.25+.75*clamp(Ry*.5+.5,0.0,1.0))*(1.0-r*.55)+r*.2,fr=pow(1.0-clamp(N.z,0.0,1.0),3.0),amb=.18+.1*N.y;
vec3 spec=mix(vec3(.04+.5*fr*(1.0-r)),c,mt),color=c*(1.0-mt)*(nl*.9+amb)+spec*(sp*1.6+sky*mix(.8,1.1,mt));float alpha=clamp((1.0-rr)*uSize.x*.5,0.0,1.0);o=vec4(pow(clamp(color,0.0,1.0),vec3(1.0/2.2))*alpha,alpha);}`;
/* (0.51) Spec/Gloss material: the same conversion the viewer makes (FS_SG2MR in core/workflow.js), on the material's own values,
   so the preview shows its Specular colour and Glossiness */
function matSgValues(f){const val=k=>{const s=f.maps?.[k];return s&&s.on&&s.src==='value'?s:null;};
  const D=f.maps?.base?.on?(f.maps.base.c||[.7,.7,.7]):[.72,.72,.72],sp=val('spec'),gl=val('gloss');
  const S=sp?(sp.c||[.22,.22,.22]):[.22,.22,.22],g=gl?gl.v:(f.maps?.gloss?.v??.5);
  const lin=c=>Math.pow(Math.max(c,0),2.2),lum=c=>Math.sqrt(.299*c[0]*c[0]+.587*c[1]*c[1]+.114*c[2]*c[2]);
  const Dl=D.map(lin),Sl=S.map(lin),oms=1-Math.max(...Sl),dl=lum(Dl),sl=lum(Sl);
  let m=0;if(sl>=.04){const a=.04,b=dl*oms/(1-a)+sl-2*a,c=a-sl,q=Math.max(b*b-4*a*c,0);m=Math.min(1,Math.max(0,(-b+Math.sqrt(q))/(2*a)));}
  const bd=Dl.map(x=>x*oms/(1-.04)/Math.max(1-m,1e-4)),bs=Sl.map(x=>(x-.04*(1-m))/Math.max(m,1e-4));
  const B=[0,1,2].map(i=>Math.min(1,Math.max(0,bd[i]+(bs[i]-bd[i])*m*m)));
  return {color:B.map(x=>Math.pow(x,1/2.2)),metal:m,rough:Math.min(1,Math.max(0,1-g))};}
function matPreviewPixels(f,I,S){if(!P_MATPREVIEW)P_MATPREVIEW=program(FS_MATPREVIEW);const U={uSize:[S,S],uColor:f.maps?.base?.on?(f.maps.base.c||[.7,.7,.7]):[.72,.72,.72],uR:f.maps?.rough?.on?(f.maps.rough.v??.5):.5,uM:f.maps?.metal?.on?(f.maps.metal.v??0):0,uH:f.hStr??1},keys=['base','rough','metal','height','normal'],rots=[];
  if(doc.workflow==='spec'){const sg=matSgValues(f);U.uColor=sg.color;U.uR=sg.rough;U.uM=sg.metal;}
for(const k of keys){const m=f.maps?.[k],name=k[0].toUpperCase()+k.slice(1),on=!!(m?.on&&m.src!=='value'&&I[k]?.tex);U['u'+name]=on?I[k].tex:dummy;U['u'+name+'On']={int:on?1:0};U['u'+name+'Tile']=[m?.tile??1,m?.tile??1];rots.push((m?.rot||0)*Math.PI/180);}U.uRot=rots.slice(0,4);U.uNormalRot=rots[4];const t=makeTarget(S,S,8,false);try{run(P_MATPREVIEW,t,U);const d=captureRegionNow(t,0,0,S,S).data;for(let i=0;i<d.length;i+=4)if(d[i+3]){const a=255/d[i+3];d[i]=Math.min(255,Math.round(d[i]*a));d[i+1]=Math.min(255,Math.round(d[i+1]*a));d[i+2]=Math.min(255,Math.round(d[i+2]*a));}return d;}finally{disposeTarget(t);}}
function matPreviewEl(getF,getImgs,size,scale){const S0=size||96,S=scale?Math.round(S0*scale):Math.min(1024,Math.max(256,Math.round(S0*Math.max(window.devicePixelRatio||1,4)))),cv2=el('canvas',{class:'matprev',width:S,height:S,style:'width:'+S0+'px;height:'+S0+'px','aria-hidden':'true'});
  const redrawGPU=()=>{const x=cv2.getContext('2d'),id=x.createImageData(S,S);id.data.set(matPreviewPixels(getF(),getImgs()||{},S));x.putImageData(id,0,0);};
  redrawGPU();return {el:cv2,redraw:redrawGPU};
}
