/* ================= Mask and content stacks (like Substance Painter) =================
   A mask can hold a stack of its own rows, listed under the layer in the Layers panel: paint, fills, baked and
   converted mesh maps, ID colours, direction, gradients, noise, pictures, another layer's mask, generators (the
   Mask Builder presets) and filters. Each row has a blend mode, opacity and an eye; filters change everything below
   them. The result lands in L.mask.target, so everything that reads a mask (compositing, the 3D view, selections,
   export) works unchanged. A plain mask becomes a stack (one Paint row holding its picture) when the first row is
   added. L.mask.stack = [rows, bottom first]; a row = {id, kind, on, mode, op, p:{…settings}, t (paint/picture)}.
   Content effects (L.cfx, the blue rows) are filters on the layer's own maps, applied before it is blended.
   Paint rows keep their coverage in alpha, so a new Paint row changes nothing until you paint on it. */
const MS_MODES=[['normal','Normal','Norm'],['multiply','Multiply','Mult'],['add','Add','Add'],['subtract','Subtract','Sub'],['screen','Screen','Scrn'],['min','Min (darker)','Min'],['max','Max (lighter)','Max'],['overlay','Overlay','Ovl']];
const msModeIx=m=>Math.max(0,MS_MODES.findIndex(x=>x[0]===m));
const MS_GENS=[['edge','Edge wear'],['dirt','Dirt in cavities'],['dust','Dust on top'],['moss','Moss'],['rust','Rust streaks'],['water','Water line'],['slime','Slime'],['crud','Crud'],
  ['chips','Chipped paint'],['scratch','Scratches'],['snow','Snow on top'],['soot','Soot'],['drips','Drips and leaks'],['bleach','Sun-bleached']];
const MS_NOISES=[['clouds','Clouds'],['cells','Cells'],['grunge','Grunge'],['scratches','Scratches'],['streaks','Streaks'],['dots','Dots'],['fibres','Fibres']];
/* what each row kind is: its title, and its settings when new */
const MS_KINDS={
  paint:{title:'Paint',p:()=>({})},
  fill:{title:'Fill',p:()=>({v:1})},
  mesh:{title:'Mesh map',p:()=>({k:'ao',inv:false})},
  id:{title:'ID colour',p:()=>({cols:[],tol:.08,soft:.04,inv:false})},
  dir:{title:'Direction',p:()=>({axis:'up',angle:50,soft:15,inv:false})},
  grad:{title:'Gradient',p:()=>({axis:'up',from:0,to:1,inv:false})},
  noise:{title:'Noise',p:()=>({type:'grunge',scale:6,contrast:1.5,level:0,seed:1,tri:true,inv:false})},
  image:{title:'Picture',p:()=>({tile:1,rot:0,tri:false,inv:false,name:''})},
  ref:{title:'Another mask',p:()=>({name:''})},
  gen:{title:'Generator',p:()=>({g:'edge',amount:.5,width:.5,breakup:.5,contrast:1.5,scale:6,seed:1,inv:false})},
  filter:{title:'Filter'}};
/* filters a mask row can use (the ones that make sense on a black and white picture), plus our own */
const MS_FILTERS=['levels','curves','threshold','posterize','invert','blur','boxBlur','motionBlur','sharpen','highPass','edges'];
const MS_OWN_FILTERS={grow:'Grow / shrink',warp:'Warp',slope:'Slope blur'};
let msSeq=0;
function msRow(kind,o){const r=Object.assign({id:'r'+(++msSeq),kind,on:true,mode:'normal',op:1,p:MS_KINDS[kind]&&MS_KINDS[kind].p?MS_KINDS[kind].p():{}},o||{});return r;}
function msRowTitle(r){if(r.kind==='filter')return r.own?MS_OWN_FILTERS[r.own]:(FX[r.fx]?FX[r.fx].title:'Filter');
  if(r.kind==='gen')return (MS_GENS.find(g=>g[0]===r.p.g)||['','Generator'])[1];
  if(r.kind==='noise')return (MS_NOISES.find(g=>g[0]===r.p.type)||['','Noise'])[1];
  if(r.kind==='mesh')return msMeshName(r.p.k);
  if(r.kind==='image')return r.p.name||'Picture';
  if(r.kind==='ref')return 'Mask of “'+(r.p.name||'?')+'”';
  if(r.kind==='fill')return r.p.v>=.99?'White':r.p.v<=.01?'Black':'Grey '+Math.round(r.p.v*100)+'%';
  return r.name||MS_KINDS[r.kind].title;}
/* rows that read the document's own maps (no bake yet, or the Paint tab) redo when any layer changes */
let msDocVer=0;
const msUsesDoc=L=>L.mask.stack.some(r=>r.on!==false&&((r.kind==='mesh'&&!msMeshTex(r.p.k))||(r.kind==='gen'&&!msMeshTex('curv')&&!msMeshTex('ao'))||r.kind==='dir'&&!(v3.mesh&&(ui.mode==='p3d'||v3.on))));
{const st=scheduleThumb;scheduleThumb=function(n){msDocVer++;return st(n);};}
const msMeshName=k=>k&&k.startsWith('cv:')?(P3_MESHMAP_NAMES[k.slice(3)]||k.slice(3))+' (converted)':(typeof P3_MESHMAP_NAMES!=='undefined'&&P3_MESHMAP_NAMES[k])||(MAP_DEFS[k]?MAP_DEFS[k].label:k);
const msHas=L=>!!(L&&L.mask&&L.mask.stack);

/* ---- shaders ---- */
const MS_NOISE_GLSL=`uniform float uSeed;
float h3(vec3 p){ p=fract(p*0.3183099+vec3(0.1,0.2,0.3)+uSeed*0.1371); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i=floor(x),f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s/0.97; }
float worley(vec3 p){ vec3 i=floor(p),f=fract(p); float d=8.0; for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ vec3 g=vec3(x,y,z); vec3 r=g+vec3(h3(i+g),h3(i+g+11.1),h3(i+g+23.7))-f; d=min(d,dot(r,r)); } return sqrt(d); }
float noiseOf(int t,vec3 q){
  if(t==0) return fbm(q);
  if(t==1) return clamp(worley(q),0.0,1.0);
  if(t==2){ float a=fbm(q), b=fbm(q*3.1+5.0); return clamp(a*0.7+b*0.5-0.1+(1.0-worley(q*1.7))*0.25,0.0,1.0); }
  if(t==3){ vec3 s=vec3(q.x*0.08,q.y*4.0,q.z*0.08); float l=abs(fbm(s+vec3(0.0,fbm(q*0.5)*2.0,0.0))-0.5); return 1.0-smoothstep(0.0,0.035,l); }
  if(t==4) return fbm(vec3(q.x*2.5,q.y*0.15,q.z*2.5));
  if(t==5) return 1.0-smoothstep(0.15,0.3,worley(q*1.4));
  return fbm(vec3(q.x*6.0,q.y*0.4,q.z*6.0)+fbm(q)*1.5); }`;
/* the surface at each texel: world position and normal on the model (3D), or the flat texture (2D) */
const MS_SURF_GLSL=`uniform sampler2D uPos; uniform sampler2D uNrm; uniform int uHasPos; uniform vec3 uBmin; uniform vec3 uBsize; uniform sampler2D uDocN; uniform int uHasDocN; uniform vec2 uSz;
vec3 surfP(vec2 uv){ if(uHasPos==1){ vec4 P=texelFetch(uPos,ivec2(gl_FragCoord.xy),0); if(P.a>0.5) return (P.xyz-uBmin)/max(uBsize,vec3(1e-4)); } return vec3(uv.x,1.0-uv.y,0.5); }
vec3 surfN(){ if(uHasPos==1){ vec4 P=texelFetch(uPos,ivec2(gl_FragCoord.xy),0); if(P.a>0.5) return normalize(texelFetch(uNrm,ivec2(gl_FragCoord.xy),0).xyz+1e-5); }
  if(uHasDocN==1){ vec3 n=texture(uDocN,gl_FragCoord.xy/uSz).rgb*2.0-1.0; return normalize(vec3(n.x,n.y,n.z)); } return vec3(0.0,0.0,1.0); }
/* "up" for the flat texture: towards the top of the texture (green of the normal map) */
vec3 upOf(){ return uHasPos==1?vec3(0.0,1.0,0.0):vec3(0.0,1.0,0.0); }`;
const FS_MSBLEND=`uniform sampler2D uA; uniform sampler2D uB; uniform int uMode; uniform float uOp;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float a=texelFetch(uA,p,0).r; vec4 b4=texelFetch(uB,p,0); float cov=clamp(b4.a,0.0,1.0); float b=cov>1e-5?b4.r/cov:0.0; float r;
  if(uMode==0) r=b; else if(uMode==1) r=a*b; else if(uMode==2) r=a+b; else if(uMode==3) r=a-b; else if(uMode==4) r=1.0-(1.0-a)*(1.0-b);
  else if(uMode==5) r=min(a,b); else if(uMode==6) r=max(a,b); else r=a<0.5?2.0*a*b:1.0-2.0*(1.0-a)*(1.0-b);
  o=vec4(vec3(mix(a,clamp(r,0.0,1.0),cov*uOp)),1.0); }`;
/* one row's own picture (grey, coverage in alpha): 0 a texture's brightness, 1 a flat value, 2 direction, 3 gradient, 4 noise */
const FS_MSSRC=MS_NOISE_GLSL+MS_SURF_GLSL+`
uniform int uKind; uniform sampler2D uT; uniform float uV; uniform vec3 uDir; uniform float uA; uniform float uB; uniform float uC; uniform int uType; uniform int uTri; uniform float uScale; uniform int uInv; in vec2 vUV;
void main(){ vec2 uv=gl_FragCoord.xy/uSz; float m=0.0,cov=1.0;
  if(uKind==0){ vec4 c=texture(uT,uv); m=c.a>1e-5?dot(c.rgb/c.a,vec3(0.299,0.587,0.114)):0.0; }
  else if(uKind==1) m=uV;
  else if(uKind==2){ float d=dot(surfN(),normalize(uDir)); m=smoothstep(uA-uB,uA+uB,d); }
  else if(uKind==3){ vec3 P=surfP(uv); float t=dot(P,abs(uDir)); if(uDir.x+uDir.y+uDir.z<0.0) t=1.0-t; m=clamp((t-uA)/max(uB-uA,1e-3),0.0,1.0); }
  else { vec3 q=(uTri==1&&uHasPos==1?surfP(uv)*uBsize/max(max(uBsize.x,uBsize.y),uBsize.z):vec3(uv,0.0))*uScale; float n=noiseOf(uType,q); m=clamp((n-0.5)*uC+0.5+uV,0.0,1.0); }
  if(uInv==1) m=1.0-m; o=vec4(vec3(m)*cov,cov); }`;
/* generators: the Mask Builder presets, made from curvature, AO, direction and height with noise to break them up */
const FS_MSGEN=MS_NOISE_GLSL+MS_SURF_GLSL+`
uniform sampler2D uCurv; uniform int uHasCurv; uniform sampler2D uAO; uniform int uHasAO; uniform int uG; uniform float uAmt; uniform float uWidth; uniform float uBreak; uniform float uCon; uniform float uScale; uniform int uInv;
float curvOf(vec2 uv){ return uHasCurv==1?texture(uCurv,uv).r:0.5; }
float aoOf(vec2 uv){ return uHasAO==1?texture(uAO,uv).r:1.0; }
void main(){ vec2 uv=gl_FragCoord.xy/uSz; vec3 P=surfP(uv),N=surfN(); vec3 q=(uHasPos==1?P*uBsize/max(max(uBsize.x,uBsize.y),uBsize.z):vec3(uv,0.0))*uScale;
  float c=curvOf(uv),edge=clamp((c-0.5)*2.0,0.0,1.0),cav=clamp((0.5-c)*2.0,0.0,1.0),ao=aoOf(uv),occ=1.0-ao,up=dot(N,vec3(0.0,1.0,0.0)),n=fbm(q),w=uWidth;
  float b=0.0;
  if(uG==0) b=edge*(0.6+w*1.4);
  else if(uG==1) b=(occ*1.3+cav*0.8)*(0.6+w);
  else if(uG==2) b=smoothstep(0.1,0.9,up)*(0.6+w*0.8)-occ*0.2;
  else if(uG==3) b=(smoothstep(-0.1,0.8,up)*0.6+occ*0.7+cav*0.3)*(0.5+w*0.8)*(0.6+fbm(q*2.3)*0.8);
  else if(uG==4) b=(edge*0.5+occ*0.4+0.2)*fbm(vec3(q.x*3.0,q.y*0.25,q.z*3.0))*(0.8+w*1.2);
  else if(uG==5) b=1.0-smoothstep(w*0.6,w*0.6+0.08,P.y);
  else if(uG==6) b=(occ*0.9+cav*0.5+smoothstep(0.2,1.0,up)*0.3)*(0.5+w)*smoothstep(0.3,0.7,fbm(q*1.5));
  else if(uG==7) b=(occ*1.1+cav*0.6)*(0.5+w)*(0.4+noiseOf(2,q)*0.9);
  else if(uG==8) b=edge*(0.5+w*1.6)*step(0.35,1.0-worley(q*1.6))+edge*0.25;
  else if(uG==9) b=noiseOf(3,q*0.7)*(0.6+w)+edge*0.2;
  else if(uG==10) b=smoothstep(0.25-w*0.3,0.75-w*0.3,up)*1.2;
  else if(uG==11) b=(1.0-smoothstep(0.0,0.5+w*0.5,P.y))*0.7+occ*0.6;
  else if(uG==12) b=(edge*0.4+cav*0.4+occ*0.3)*fbm(vec3(q.x*4.0,q.y*0.12,q.z*4.0))*(1.0+w*1.5);
  else b=smoothstep(-0.2,0.9,up)*(0.4+w*0.8)*(0.7+fbm(q*0.5)*0.6);
  float v=b+(n-0.5)*uBreak*1.2, thr=1.0-uAmt, s=0.35/max(uCon,0.3);
  float m=smoothstep(thr-s,thr+s,v); if(uInv==1) m=1.0-m; o=vec4(vec3(m),1.0); }`;
/* our own mask filters: grow/shrink (min/max around), warp (pushed by noise), slope blur (smeared along a noise) */
const FS_MSOWN=MS_NOISE_GLSL+`uniform sampler2D uSrc; uniform int uOwn; uniform float uR; uniform float uS; uniform float uScale; uniform vec2 uSz;
void main(){ vec2 uv=gl_FragCoord.xy/uSz; float r=0.0;
  if(uOwn==0){ int R=int(clamp(abs(uR),0.0,12.0)); float mx=0.0,mn=1.0; for(int y=-12;y<=12;y++)for(int x=-12;x<=12;x++){ if(abs(x)>R||abs(y)>R||x*x+y*y>R*R+1) continue; float v=texture(uSrc,uv+vec2(x,y)/uSz).r; mx=max(mx,v); mn=min(mn,v); } r=uR>=0.0?mx:mn; }
  else if(uOwn==1){ vec3 q=vec3(uv*uScale,0.0); vec2 d=vec2(fbm(q),fbm(q+vec3(5.2,1.3,0.0)))-0.5; r=texture(uSrc,uv+d*uR/uSz*8.0).r; }
  else { vec3 q=vec3(uv*uScale,0.0); vec2 g=vec2(fbm(q+vec3(0.01,0.0,0.0))-fbm(q-vec3(0.01,0.0,0.0)),fbm(q+vec3(0.0,0.01,0.0))-fbm(q-vec3(0.0,0.01,0.0))); vec2 dir=normalize(g+1e-5); float s=0.0; for(int i=0;i<16;i++){ s+=texture(uSrc,uv+dir*float(i)*uR*0.25/uSz).r; } r=s/16.0; }
  o=vec4(vec3(r),1.0); }`;
let P_MS=null;
function msProgs(){if(!P_MS)P_MS={blend:program(FS_MSBLEND),src:program(FS_MSSRC),gen:program(FS_MSGEN),own:program(FS_MSOWN)};return P_MS;}

/* ---- what the rows read: mesh maps (baked, converted, or in 2D the document's maps) and the model's surface ---- */
function msMeshTex(k){const M=doc.meshMaps||{};if(M[k])return M[k];if(k&&k.startsWith('cv:')&&M[k])return M[k];
  return null;}
/* the document's own maps as stand-ins (the Paint tab, or no bake yet) */
function msDocMap(k,ctx){if(!doc.maps.includes(k))return null;if(ctx.doc[k]===undefined){ctx.doc[k]=null;const t=compositeMap(k);ctx.doc[k]=t;ctx.tmp.push(t);}return ctx.doc[k];}
function msMeshKeys(){const M=Object.keys(doc.meshMaps||{});const d=['ao','curv','height','normal','thick'].filter(k=>!M.includes(k)&&doc.maps.includes(k)&&k!=='normal');return [...M,...d];}
function msSurf(){const tri=typeof fillPosMaps==='function'&&v3.mesh&&(ui.mode==='p3d'||v3.on)?fillPosMaps():null;
  if(!tri)return {uPos:dummy,uNrm:dummy,uHasPos:{int:0},uBmin:[0,0,0],uBsize:[1,1,1]};
  const m=v3.mesh;if(!m._bb){const p=m.pos,mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<p.length;i+=3)for(let j=0;j<3;j++){mn[j]=Math.min(mn[j],p[i+j]);mx[j]=Math.max(mx[j],p[i+j]);}m._bb={mn,sz:mx.map((v,j)=>v-mn[j])};}
  return {uPos:tri.pos.tex,uNrm:tri.nrm.tex,uHasPos:{int:1},uBmin:m._bb.mn,uBsize:m._bb.sz};}
function msCtx(){const ctx={tmp:[],doc:{},surf:msSurf()};const dn=msDocMap('normal',ctx);
  Object.assign(ctx.surf,{uDocN:dn?dn.tex:dummy,uHasDocN:{int:dn?1:0},uSz:[doc.w,doc.h]});return ctx;}
function msCtxFree(ctx){for(const t of ctx.tmp)if(t)release(t);}
const MS_AXES={up:[0,1,0],down:[0,-1,0],x:[1,0,0],'-x':[-1,0,0],z:[0,0,1],'-z':[0,0,-1]};

/* one row's picture (grey, coverage in alpha): {t, pooled} or null */
function msSource(r,ctx,depth,ov,L,guard){const P=msProgs(),p=r.p,out=()=>acquireD(depth);
  if(r.kind==='paint'){const t=ov&&ov.row===r?ov.t:r.t;return t?{t,pooled:false}:null;}
  if(r.kind==='fill'){const o=out();clearTarget(o,[p.v,p.v,p.v,1]);return {t:o,pooled:true};}
  const lum=(tex,inv)=>{const o=out();run(P.src,o,Object.assign({uKind:{int:0},uT:tex,uInv:{int:inv?1:0},uSeed:0},ctx.surf));return {t:o,pooled:true};};
  if(r.kind==='mesh'){const t=msMeshTex(p.k)||msDocMap(p.k,ctx);return t?lum(t.tex,p.inv):null;}
  if(r.kind==='ref'){const o=r._ref&&r._ref.mask&&inDoc(r._ref)?r._ref:(allNodes(doc.root).find(n=>n.name===p.name&&n.mask&&n!==L)||null);if(!o||o===L||(guard||[]).includes(o))return null;r._ref=o;
    if(msHas(o))msUpdate(o,[...(guard||[]),L]);return lum(o.mask.target.tex,p.inv);}
  if(r.kind==='image'){if(!r.t)return null;if(!P_FILLIMG)P_FILLIMG=program(FS_FILLIMG);const tri=p.tri&&typeof fillPosMaps==='function'?fillPosMaps():null,o=out();
    run(P_FILLIMG,o,{uSrc:r.t.tex,uTile:Math.max(.05,p.tile||1),uRot:(p.rot||0)*Math.PI/180,uGrey:{int:1},uTri:{int:tri?1:0},uPos:tri?tri.pos.tex:dummy,uNrm:tri?tri.nrm.tex:dummy,uSharp:4,uHStr:1,uHeight:{int:0},uNormal:{int:0}});
    if(p.inv){const o2=out();run(P.src,o2,Object.assign({uKind:{int:0},uT:o.tex,uInv:{int:1},uSeed:0},ctx.surf));release(o);return {t:o2,pooled:true};}return {t:o,pooled:true};}
  if(r.kind==='id'){const M=doc.meshMaps&&doc.meshMaps.id;if(!M||!p.cols.length)return null;if(!P_IDSEL)P_IDSEL=program(FS_IDSEL);const o=out(),cols=new Float32Array(24);p.cols.slice(0,8).forEach((c,i)=>cols.set(c,i*3));
    run(P_IDSEL,o,{uId:M.tex,uSz:[o.w,o.h],uCols:{v3:cols},uN:{int:Math.min(8,p.cols.length)},uTol:p.tol,uSoft:p.soft,uInv:{int:p.inv?1:0}});return {t:o,pooled:true};}
  if(r.kind==='dir'){const o=out(),a=(p.angle||50)*Math.PI/180;run(P.src,o,Object.assign({uKind:{int:2},uDir:MS_AXES[p.axis]||[0,1,0],uA:Math.cos(a),uB:Math.max(.01,(p.soft||15)/90),uInv:{int:p.inv?1:0},uSeed:0},ctx.surf));return {t:o,pooled:true};}
  if(r.kind==='grad'){const o=out();run(P.src,o,Object.assign({uKind:{int:3},uDir:MS_AXES[p.axis]||[0,1,0],uA:p.from||0,uB:p.to==null?1:p.to,uInv:{int:p.inv?1:0},uSeed:0},ctx.surf));return {t:o,pooled:true};}
  if(r.kind==='noise'){const o=out();run(P.src,o,Object.assign({uKind:{int:4},uType:{int:Math.max(0,MS_NOISES.findIndex(n=>n[0]===p.type))},uScale:p.scale||6,uC:p.contrast||1,uV:p.level||0,uTri:{int:p.tri?1:0},uInv:{int:p.inv?1:0},uSeed:p.seed||1},ctx.surf));return {t:o,pooled:true};}
  if(r.kind==='gen'){const o=out(),curv=msMeshTex('curv')||msMeshTex('cv:curv')||msDocMap('curv',ctx),ao=msMeshTex('ao')||msMeshTex('cv:ao')||msDocMap('ao',ctx);
    run(P.gen,o,Object.assign({uG:{int:Math.max(0,MS_GENS.findIndex(g=>g[0]===p.g))},uCurv:curv?curv.tex:dummy,uHasCurv:{int:curv?1:0},uAO:ao?ao.tex:dummy,uHasAO:{int:ao?1:0},
      uAmt:p.amount,uWidth:p.width,uBreak:p.breakup,uCon:p.contrast,uScale:p.scale||6,uSeed:p.seed||1,uInv:{int:p.inv?1:0}},ctx.surf));return {t:o,pooled:true};}
  return null;}
/* a filter row on the picture so far */
function msFilter(r,acc){const o=acquireD(acc.depth);
  if(r.own){const P=msProgs(),p=r.p||{};run(P.own,o,{uSrc:acc.tex,uOwn:{int:['grow','warp','slope'].indexOf(r.own)},uR:p.r==null?3:p.r,uScale:p.scale||6,uSz:[doc.w,doc.h],uSeed:p.seed||1});return o;}
  const F=FX[r.fx];if(!F){release(o);return null;}F.render(acc,o,r.v||fxDefaults(F),{});return o;}
/* the whole stack → a picture (pooled). ov = {row, t}: that Paint row's picture while it is being painted */
function msEval(L,ov,guard){const M=L.mask,S=M.stack,P=msProgs(),d=M.target.depth,ctx=msCtx();let acc=acquireD(d);clearTarget(acc,[0,0,0,1]);
  try{for(const r of S){if(r.on===false)continue;let s=null;
    if(r.kind==='filter'){const f=msFilter(r,acc);if(!f)continue;s={t:f,pooled:true};}
    else s=msSource(r,ctx,d,ov,L,guard);
    if(!s)continue;const o=acquireD(d);run(P.blend,o,{uA:acc.tex,uB:s.t.tex,uMode:{int:msModeIx(r.mode)},uOp:r.op==null?1:r.op});if(s.pooled)release(s.t);release(acc);acc=o;}}
  finally{msCtxFree(ctx);}
  return acc;}
/* keep L.mask.target up to date: redone when the rows, the layer, the mesh maps or the model change */
function msKey(L){const M=doc.meshMaps||{};return [L.lookVer||0,JSON.stringify(L.mask.stack,(k,x)=>k==='t'||k[0]==='_'?undefined:x),Object.keys(M).map(k=>k+(M[k].tex?1:0)).join(),doc.w,doc.h,
  v3.mesh&&(ui.mode==='p3d'||v3.on)?v3.mesh.name+v3.mesh.idx.length+(typeof p3Range==='function'&&ui.mode==='p3d'?p3Range().start:0):'',msEpoch,msUsesDoc(L)?msDocVer:'',(L.mask.stack.find(r=>r.kind==='ref')?allNodes(doc.root).map(n=>n.mask&&n.mask._key?n.lookVer:'').join(','):'')].join('|');}
let msEpoch=0;
function msUpdate(L,guard){if(!msHas(L))return;const k=msKey(L);if(L.mask._key===k)return;L.mask._key=k;const r=msEval(L,null,guard);blit(r,L.mask.target,0,0,doc.w,doc.h,0,0);release(r);if(L.mask.thumb)thumbQ.add(L);}
function msUpdateAll(){for(const n of allNodes(doc.root))if(msHas(n))msUpdate(n);}

/* ---- turning a plain mask into a stack, adding and removing rows (each one undo step) ---- */
function msSnap(L){const M=L.mask;return {mask:M,target:M?M.target:null,stack:M&&M.stack?M.stack.map(r=>({r,d:JSON.stringify(r,(k,x)=>k==='t'||k[0]==='_'?undefined:x)})):null,cfx:(L.cfx||[]).map(r=>({r,d:JSON.stringify(r,(k,x)=>k[0]==='_'?undefined:x)}))};}
function msRestore(L,s){L.mask=s.mask;if(s.mask){s.mask.target=s.target;s.mask.stack=s.stack?s.stack.map(x=>Object.assign(x.r,JSON.parse(x.d),{t:x.r.t})):null;s.mask._key=null;}
  L.cfx=s.cfx.map(x=>Object.assign(x.r,JSON.parse(x.d)));L.lookVer=(L.lookVer||0)+1;}
function msRecord(L,label,fn){const b=msSnap(L);if(fn()===false)return false;const a=msSnap(L);
  pushUndo({label,refs:[L],masks:[b.mask,a.mask].filter(Boolean),undo(){msRestore(L,b);},redo(){msRestore(L,a);}});if(L.mask)L.mask._key=null;changed(L);return true;}
/* a plain mask becomes a stack: its picture is the first Paint row */
function msMakeStack(L){const M=L.mask;if(!M||M.stack)return;const t=M.target;M.target=makeTarget(doc.w,doc.h,t.depth);blit(t,M.target,0,0,doc.w,doc.h,0,0);
  M.stack=[msRow('paint',{t,name:'Paint'})];M._rows=M._rows||new Set();M._rows.add(M.stack[0]);M._key=null;}
/* a new, empty Paint row (transparent: it changes nothing until painted) */
function msNewPaintRow(L){const r=msRow('paint',{name:'Paint'});r.t=makeTarget(doc.w,doc.h,L.mask.target.depth);clearTarget(r.t,[0,0,0,0]);(L.mask._rows||(L.mask._rows=new Set())).add(r);return r;}
/* add a row to the mask (making the mask, or the stack, when there is none): above the selected row, else on top */
function msAdd(L,kind,o,label){if(!isLayer(L)&&!(L&&L.type==='group'))return null;let row=null;
  msRecord(L,label||('Add '+(o&&o.fx&&FX[o.fx]?FX[o.fx].title:o&&o.own?MS_OWN_FILTERS[o.own]:MS_KINDS[kind].title).toLowerCase()+' to the mask'),()=>{
    if(!L.mask){L.mask=makeMask(kind==='paint'?1:0);L.mask.stack=[];L.mask._rows=new Set();}
    msMakeStack(L);
    row=kind==='paint'?msNewPaintRow(L):msRow(kind,o);if(kind==='paint'&&o)Object.assign(row,o,{t:row.t});
    if(kind==='filter'&&row.fx&&!row.v&&FX[row.fx])row.v=fxDefaults(FX[row.fx]);
    const S=L.mask.stack,sel=ui.msSel&&ui.msSel.L===L&&ui.msSel.where==='m'?S.findIndex(x=>x.id===ui.msSel.id):-1;S.splice(sel>=0?sel+1:S.length,0,row);
    (L.mask._rows||(L.mask._rows=new Set())).add(row);L.editMask=true;});
  if(row)msSelect(L,'m',row.id);return row;}
function msRemove(L,where,id){msRecord(L,'Delete '+(where==='m'?'mask':'effect')+' row',()=>{const S=where==='m'?L.mask.stack:L.cfx;const i=S.findIndex(r=>r.id===id);if(i<0)return false;S.splice(i,1);});
  if(ui.msSel&&ui.msSel.id===id)ui.msSel=null;renderMatEd(true);}
function msMove(L,where,id,to){msRecord(L,'Move row',()=>{const S=where==='m'?L.mask.stack:L.cfx;const i=S.findIndex(r=>r.id===id);if(i<0)return false;const [r]=S.splice(i,1);S.splice(clamp(to,0,S.length),0,r);});}
/* Flatten mask: keep the result, drop the rows */
function msFlatten(L){if(!msHas(L))return;msUpdate(L);msRecord(L,'Flatten mask',()=>{L.mask.stack=null;});}
/* content effects: filters on the layer's own maps */
function cfxAdd(L,fx,own){if(!isLayer(L))return null;let row=null;
  msRecord(L,'Add '+(FX[fx]?FX[fx].title:'effect').toLowerCase()+' to “'+L.name+'”',()=>{row=msRow('filter',{fx,v:fxDefaults(FX[fx]),maps:'all'});L.cfx=L.cfx||[];L.cfx.push(row);L.editMask=false;});
  if(row)msSelect(L,'c',row.id);return row;}
/* the selected row (it shows in Properties; painting goes into a selected Paint row) */
function msSelect(L,where,id){ui.msSel={L,where,id};if(where==='m'){L.editMask=true;}if(doc.active!==L){selectOnly(L);}renderLayers();if(typeof showPanel==='function')showPanel('matEd');renderMatEd(true);requestRender(true);}
function msRowOf(sel){if(!sel||!sel.L)return null;const S=sel.where==='m'?(sel.L.mask&&sel.L.mask.stack):sel.L.cfx;return S?S.find(r=>r.id===sel.id)||null:null;}
/* where painting on a stacked mask goes: the selected Paint row, else the top Paint row, else a new one on top */
function msPaintRow(L){const S=L.mask.stack,cur=msRowOf(ui.msSel);if(cur&&cur.kind==='paint'&&ui.msSel.L===L&&S.includes(cur))return cur;
  for(let i=S.length-1;i>=0;i--)if(S[i].kind==='paint'&&S[i].on!==false)return S[i];
  const r=msNewPaintRow(L);S.push(r);ui.msSel={L,where:'m',id:r.id};renderLayers();return r;}

/* ---- content effects in compositing ---- */
const cfxOn=(n,k)=>!!(n.cfx&&n.cfx.some(r=>r.on!==false&&cfxMaps(r,k)));
const cfxMaps=(r,k)=>r.maps==='all'?k!=='normal':Array.isArray(r.maps)?r.maps.includes(k):k==='base';
function cfxApply(n,src,k){let cur=src;
  for(const r of n.cfx){if(r.on===false||!cfxMaps(r,k))continue;const F=FX[r.fx];if(!F)continue;const o=acquireD(src.depth);F.render(cur,o,r.v||fxDefaults(F),{});
    let res=o;if((r.op==null?1:r.op)<.999){res=acquireD(src.depth);run(P.mix,res,{uA:cur.tex,uB:o.tex,uT:r.op,uM:dummy,uUseM:false});release(o);}
    if(cur!==src)release(cur);cur=res;}
  return cur;}

/* ---- files: rows as settings, Paint rows and pictures as images ---- */
async function msEncode(L,put,putRaw){const out={};if(msHas(L)){out.stack=[];for(const r of L.mask.stack){const d=JSON.parse(JSON.stringify(r,(k,x)=>k==='t'||k[0]==='_'?undefined:x));
    if(r.t){if(r.kind==='image')d.pic=await putRaw(r.t);else d.img=await put(r.t,true);}out.stack.push(d);}}
  if(L.cfx&&L.cfx.length)out.cfx=L.cfx.map(r=>JSON.parse(JSON.stringify(r,(k,x)=>k[0]==='_'?undefined:x)));return out;}
async function msDecode(n,o,img,getRaw){if(o.cfx)n.cfx=o.cfx.map(r=>Object.assign(msRow('filter'),r,{id:'r'+(++msSeq)}));
  if(o.mstack&&n.mask){n.mask.stack=[];n.mask._rows=new Set();for(const d of o.mstack){const r=Object.assign(msRow(d.kind),d,{id:'r'+(++msSeq)});delete r.img;
    delete r.pic;if(d.img){r.t=makeTarget(doc.w,doc.h,d.img.d||8);clearTarget(r.t,[0,0,0,0]);await img(d.img,r.t);}else if(d.pic)r.t=await getRaw(d.pic);
    n.mask.stack.push(r);n.mask._rows.add(r);}n.mask._key=null;}}
/* every picture a mask holds, for freeing */
function maskDispose(m){if(!m)return;disposeTarget(m.target);if(m._rows)for(const r of m._rows)if(r.t)disposeTarget(r.t);m._rows=null;}

/* changing a row's settings: live, and one undo step once you pause (or do something else) */
const msEd={L:null,snap:null,timer:0,label:''};
function msEdit(L,row,fn,label){if(msEd.L!==L||!msEd.snap){msCommit();msEd.L=L;msEd.snap=msSnap(L);msEd.label=label||('Change '+msRowTitle(row).toLowerCase());}
  fn(row);if(L.mask)L.mask._key=null;L.lookVer=(L.lookVer||0)+1;requestRender(true);v3.dirty=true;clearTimeout(msEd.timer);msEd.timer=setTimeout(msCommit,700);}
function msCommit(){clearTimeout(msEd.timer);msEd.timer=0;const L=msEd.L,b=msEd.snap;msEd.snap=null;if(!L||!b)return;const a=msSnap(L);
  if(JSON.stringify(a.stack&&a.stack.map(x=>x.d))===JSON.stringify(b.stack&&b.stack.map(x=>x.d))&&JSON.stringify(a.cfx.map(x=>x.d))===JSON.stringify(b.cfx.map(x=>x.d)))return;
  pushUndo({label:msEd.label,refs:[L],masks:[a.mask].filter(Boolean),undo(){msRestore(L,b);},redo(){msRestore(L,a);}});}
