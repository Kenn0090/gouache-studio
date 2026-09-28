/* ================= Baker: GPU engine =================
   The low-poly model is drawn flat in its UV layout. Every texel knows its point on the low-poly
   surface; a ray is sent from just outside that point (front distance) back through it (to the
   back distance) and the first place it meets the high-poly is found with a bounding-volume tree
   walked on the GPU. What is found there becomes the normal, height, AO and other maps.
   Work is done in tiles and small pieces so the app stays responsive and the driver never
   waits too long on one job. */
const BK_TW=Math.min(8192,gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096); /* width of the data textures */
/* ---- bounding volume tree over the high-poly triangles ----
   Binned surface-area split (what ray tracers use): each node is cut where the two halves cost the
   least to test, so a ray skips much more of the model than with a plain middle cut.
   Typed arrays only, so tens of millions of triangles fit in memory. Nodes are two texels,
   [min.xyz, first triangle (leaf) or split axis] [max.xyz, -count (leaf) or right child];
   the left child always follows its parent. A leaf's first triangle is split between the two .w values
   (low 20 bits, then count + 8 × the rest) so every number stays exact in a 32-bit float.
   Self-contained, so it can run in a worker. */
function bvhBuild(pos,idx,onProgress){const T=idx.length/3,bx=new Float32Array(T*6);
  for(let t=0;t<T;t++){const a=idx[t*3]*3,b=idx[t*3+1]*3,c=idx[t*3+2]*3,o=t*6;for(let k=0;k<3;k++){const x=pos[a+k],y=pos[b+k],z=pos[c+k];bx[o+k]=x<y?(x<z?x:z):(y<z?y:z);bx[o+3+k]=x>y?(x>z?x:z):(y>z?y:z);}}
  const order=new Uint32Array(T);for(let i=0;i<T;i++)order[i]=i;
  let cap=Math.max(64,Math.ceil(T*.8)),nd=new Float32Array(cap*8),n=0;
  const NBMAX=16,bc=new Float64Array(NBMAX*3),bb=new Float32Array(NBMAX*3*6),rA=new Float64Array(NBMAX),rC=new Float64Array(NBMAX),cm=new Float64Array(3),ex=new Float64Array(3),sc=new Float64Array(3);
  const area=(x0,y0,z0,x1,y1,z1)=>{const dx=x1-x0,dy=y1-y0,dz=z1-z0;return dx<0?0:dx*dy+dy*dz+dz*dx;};
  const st=[0,T,-1,0];let done=0,lastP=0;
  while(st.length){const depth=st.pop(),parent=st.pop(),e=st.pop(),s=st.pop();
    if(n>=cap){cap=Math.ceil(cap*1.5);const g=new Float32Array(cap*8);g.set(nd);nd=g;}
    const id=n++;if(parent>=0)nd[parent*8+7]=id;/* the right child is recorded; the left one is parent+1 */
    const cnt=e-s;let mn0=1e30,mn1=1e30,mn2=1e30,mx0=-1e30,mx1=-1e30,mx2=-1e30,c0=1e30,c1=1e30,c2=1e30,C0=-1e30,C1=-1e30,C2=-1e30;
    for(let i=s;i<e;i++){const o=order[i]*6,a0=bx[o],a1=bx[o+1],a2=bx[o+2],b0=bx[o+3],b1=bx[o+4],b2=bx[o+5];
      if(a0<mn0)mn0=a0;if(a1<mn1)mn1=a1;if(a2<mn2)mn2=a2;if(b0>mx0)mx0=b0;if(b1>mx1)mx1=b1;if(b2>mx2)mx2=b2;
      const x=a0+b0,y=a1+b1,z=a2+b2;if(x<c0)c0=x;if(x>C0)C0=x;if(y<c1)c1=y;if(y>C1)C1=y;if(z<c2)c2=z;if(z>C2)C2=z;}
    const o=id*8;nd[o]=mn0;nd[o+1]=mn1;nd[o+2]=mn2;nd[o+4]=mx0;nd[o+5]=mx1;nd[o+6]=mx2;
    if(cnt<=4){nd[o+3]=s%1048576;nd[o+7]=-(cnt+8*Math.floor(s/1048576));done+=cnt;if(onProgress&&done-lastP>2e6){lastP=done;onProgress(done/T);}continue;}
    /* centres are kept doubled (min+max) */
    cm[0]=c0;cm[1]=c1;cm[2]=c2;ex[0]=C0-c0;ex[1]=C1-c1;ex[2]=C2-c2;let ax=-1,split=0;const NB=cnt>256?NBMAX:cnt>32?8:4;
    for(let k=0;k<3;k++)sc[k]=ex[k]>0?NB*(1-1e-6)/ex[k]:0;
    if(depth<44&&(sc[0]||sc[1]||sc[2])){
      /* bin the triangles along each axis by centre, adding up their boxes (big nodes: a sample is enough) */
      bc.fill(0);for(let q=0;q<NB*3;q++){const b=q*6;bb[b]=bb[b+1]=bb[b+2]=1e30;bb[b+3]=bb[b+4]=bb[b+5]=-1e30;}
      const step=cnt>8192?Math.floor(cnt/4096):1;
      for(let i=s;i<e;i+=step){const o=order[i]*6,a0=bx[o],a1=bx[o+1],a2=bx[o+2],b0=bx[o+3],b1=bx[o+4],b2=bx[o+5];
        for(let k=0;k<3;k++){if(!sc[k])continue;const q=k*NB+Math.floor((bx[o+k]+bx[o+3+k]-cm[k])*sc[k]),b=q*6;bc[q]++;
          if(a0<bb[b])bb[b]=a0;if(a1<bb[b+1])bb[b+1]=a1;if(a2<bb[b+2])bb[b+2]=a2;if(b0>bb[b+3])bb[b+3]=b0;if(b1>bb[b+4])bb[b+4]=b1;if(b2>bb[b+5])bb[b+5]=b2;}}
      let best=Math.ceil(cnt/step)*area(mn0,mn1,mn2,mx0,mx1,mx2);
      for(let k=0;k<3;k++){if(!sc[k])continue;
        let x0=1e30,y0=1e30,z0=1e30,x1=-1e30,y1=-1e30,z1=-1e30,c=0;
        for(let i=NB-1;i>0;i--){const b=(k*NB+i)*6;c+=bc[k*NB+i];if(bb[b]<x0)x0=bb[b];if(bb[b+1]<y0)y0=bb[b+1];if(bb[b+2]<z0)z0=bb[b+2];if(bb[b+3]>x1)x1=bb[b+3];if(bb[b+4]>y1)y1=bb[b+4];if(bb[b+5]>z1)z1=bb[b+5];rA[i]=area(x0,y0,z0,x1,y1,z1);rC[i]=c;}
        x0=1e30;y0=1e30;z0=1e30;x1=-1e30;y1=-1e30;z1=-1e30;c=0;
        for(let i=0;i<NB-1;i++){const b=(k*NB+i)*6;c+=bc[k*NB+i];if(bb[b]<x0)x0=bb[b];if(bb[b+1]<y0)y0=bb[b+1];if(bb[b+2]<z0)z0=bb[b+2];if(bb[b+3]>x1)x1=bb[b+3];if(bb[b+4]>y1)y1=bb[b+4];if(bb[b+5]>z1)z1=bb[b+5];
          if(!c||!rC[i+1])continue;const cost=c*area(x0,y0,z0,x1,y1,z1)+rC[i+1]*rA[i+1];if(cost<best){best=cost;ax=k;split=i+1;}}}}
    let m=s;
    if(ax>=0){const sk=sc[ax],c=cm[ax];let i=s,j=e-1;
      while(i<=j){const t=order[i],q=t*6+ax;if(Math.floor((bx[q]+bx[q+3]-c)*sk)<split)i++;else{order[i]=order[j];order[j]=t;j--;}}m=i;}
    if(ax<0||m===s||m===e){/* no useful cut (or very deep): halve the list along the longest axis */
      ax=ex[0]>=ex[1]&&ex[0]>=ex[2]?0:ex[1]>=ex[2]?1:2;m=(s+e)>>1;
      if(ex[ax]>0){const sub=order.subarray(s,e),key=new Float32Array(cnt),ix=new Uint32Array(cnt);for(let i=0;i<cnt;i++){const q=sub[i]*6+ax;key[i]=bx[q]+bx[q+3];ix[i]=i;}
        ix.sort((a,b)=>key[a]-key[b]);const cp=Uint32Array.from(ix,i=>sub[i]);sub.set(cp);}}
    nd[o+3]=ax;nd[o+7]=0;
    st.push(m,e,id,depth+1,s,m,-1,depth+1);}
  return {nodeData:nd.subarray(0,n*8),order,nodes:n};}
/* the tree is built in a worker so the app stays responsive (falls back to building it here) */
function bvhBuildAsync(pos,idx,onProgress){return new Promise((res,rej)=>{const here=()=>{bvhBuildAsync.via='here';try{res(bvhBuild(pos,idx,onProgress));}catch(e){rej(e);}};let w;
  try{const src=bvhBuild.toString()+'\nonmessage=e=>{const r=bvhBuild(e.data.pos,e.data.idx,f=>postMessage({f}));postMessage({done:1,nodeData:r.nodeData,order:r.order,nodes:r.nodes},[r.nodeData.buffer,r.order.buffer]);};';
    const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));w=new Worker(url);URL.revokeObjectURL(url);}catch(e){here();return;}
  w.onmessage=e=>{const d=e.data;if(d.done){w.terminate();bvhBuildAsync.via='worker';res(d);}else if(onProgress)onProgress(d.f);};
  w.onerror=e=>{e.preventDefault();w.terminate();here();};
  const P=pos.slice(),X=idx.slice();w.postMessage({pos:P,idx:X},[P.buffer,X.buffer]);});}
/* the desktop app keeps each high-poly's tree in the disk cache, found again by a fingerprint of its
   points and triangles, so baking the same high-poly later (even after a restart) skips building it */
function bvhKey(h){let a=0x811c9dc5,b=0x9e3779b9;const hash=u=>{for(let i=0;i<u.length;i++){const v=u[i];a=Math.imul(a^v,16777619);b=Math.imul(b^v,2246822519)^(b>>>13);}};
  const P=h.pos instanceof Float32Array?h.pos:Float32Array.from(h.pos);hash(new Uint32Array(P.buffer,P.byteOffset,P.length));hash(h.idx instanceof Uint32Array?h.idx:Uint32Array.from(h.idx));
  return 't'+(h.idx.length/3)+'x'+(a>>>0).toString(16)+(b>>>0).toString(16);}
async function bvhCached(h,build){if(!platform.isDesktop)return build();const T=h.idx.length/3;if(T<200000)return build();
  const key=bvhKey(h);
  try{const buf=await platform.treeRead(key),hd=new Uint32Array(buf,0,4);
    if(hd[0]===0x47535456&&hd[1]===1&&hd[3]===T&&buf.byteLength===16+hd[2]*32+T*4)return {nodes:hd[2],nodeData:new Float32Array(buf,16,hd[2]*8),order:new Uint32Array(buf,16+hd[2]*32,T),cached:true};}catch(e){}
  const B=await build();
  try{const out=new Uint8Array(16+B.nodes*32+T*4),hd=new Uint32Array(out.buffer,0,4);hd.set([0x47535456,1,B.nodes,T]);
    out.set(new Uint8Array(B.nodeData.buffer,B.nodeData.byteOffset,B.nodes*32),16);out.set(new Uint8Array(B.order.buffer,B.order.byteOffset,T*4),16+B.nodes*32);
    platform.treeWrite(key,out).then(()=>platform.treePrune(Math.max(0,mem.diskGB*1073741824-hist.undo.reduce((s,r)=>s+recDisk(r),0)))).catch(e=>console.warn('search tree not cached',e));}catch(e){console.warn(e);}
  return B;}
/* the high-poly on the GPU: tree nodes, triangle corners, corner normals and colours.
   Each texture is filled a band of rows at a time from one small buffer, so even a high-poly of
   tens of millions of triangles needs little memory beyond the model itself; normals and colours
   are stored at half precision, and colours only when ID colours are baked */
function bkBandTex(texels,half,fill){const w=Math.min(BK_TW,Math.max(1,texels)),h=Math.max(1,Math.ceil(texels/BK_TW)),max=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if(h>max)throw new Error('the high-poly has too many triangles for this graphics card ('+Math.floor(max*BK_TW/3).toLocaleString()+' at most)');
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texStorage2D(gl.TEXTURE_2D,1,half?gl.RGBA16F:gl.RGBA32F,w,h);
  for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);
  const rows=Math.max(1,Math.floor((1<<22)/w)),buf=new Float32Array(rows*w*4);
  for(let y=0;y<h;y+=rows){const n=Math.min(rows,h-y),b=buf.subarray(0,n*w*4);b.fill(0);fill(b,y*w,Math.min(texels,(y+n)*w));gl.bindTexture(gl.TEXTURE_2D,tex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,y,w,n,gl.RGBA,gl.FLOAT,b);}
  return tex;}
async function bkHighGPU(h,onStep,needCol){const T=h.idx.length/3;onStep('Sorting '+T.toLocaleString()+' high-poly triangles…');
  const B=await bvhCached(h,()=>bvhBuildAsync(h.pos,h.idx,f=>onStep('Sorting '+T.toLocaleString()+' high-poly triangles… '+Math.round(f*100)+'%')));
  if(B.nodes>=16777216)throw new Error('the high-poly has too many triangles');
  onStep('Sending the high-poly to the graphics card…');await nextTick();
  const o=B.order,I=h.idx,nd=B.nodeData;
  const nodes=bkBandTex(B.nodes*2,false,(b,t0,t1)=>b.set(nd.subarray(t0*4,t1*4)));
  /* corners: texel k*3+v is corner v of the k-th triangle in tree order */
  const corners=(src,stride,w)=>(b,t0,t1)=>{for(let q=t0;q<t1;q++){const k=(q/3)|0,t=o[k],vi=I[t*3+q-k*3],d=(q-t0)*4;for(let c=0;c<3;c++)b[d+c]=src[vi*stride+c];if(w)b[d+3]=w(t);}};
  const tris=bkBandTex(T*3,false,corners(h.pos,3,t=>h.bakePart?h.bakePart[t]:0));
  const nrm=bkBandTex(T*3,true,corners(h.nrm,3,null));
  let col;if(needCol){col=bkBandTex(T*3,true,(b,t0,t1)=>{for(let q=t0;q<t1;q++){const k=(q/3)|0,t=o[k],vi=I[t*3+q-k*3],d=(q-t0)*4;
      if(h.col){b[d]=h.col[vi*4];b[d+1]=h.col[vi*4+1];b[d+2]=h.col[vi*4+2];}else{const c=h.triCol&&h.triCol.length?[h.triCol[t*3],h.triCol[t*3+1],h.triCol[t*3+2]]:partCol(h.triPart?h.triPart[t]:0);b[d]=c[0];b[d+1]=c[1];b[d+2]=c[2];}b[d+3]=1;}});}
  else col=bkBandTex(1,true,()=>{});
  return {nodes,tris,nrm,col,count:T,nodeCount:B.nodes,hasCol:!!needCol};}
const partCol=(()=>{const cache={};return p=>cache[p]||(cache[p]=idColor('part '+p));})();
function bkFreeHigh(g){if(!g)return;for(const k of ['nodes','tris','nrm','col'])gl.deleteTexture(g[k]);}

/* ---- shaders ---- */
const BK_TRACE=`uniform highp sampler2D uNodes; uniform highp sampler2D uTris; uniform highp sampler2D uTN; uniform highp sampler2D uTC;
int bkPart=-1; int bkSkip=-1;
vec4 bkF(highp sampler2D s,int i){ return texelFetch(s,ivec2(i%${BK_TW},i/${BK_TW}),0); }
bool bkBox(vec3 o,vec3 inv,vec3 a,vec3 b,float tmax){ vec3 t0=(a-o)*inv,t1=(b-o)*inv; vec3 lo=min(t0,t1),hi=max(t0,t1);
  float tn=max(max(lo.x,lo.y),max(lo.z,0.0)), tf=min(min(hi.x,hi.y),min(hi.z,tmax)); return tn<=tf; }
/* closest hit (any=false) or any hit (any=true) along o+t*d, 0<t<tmax. The nearer child is visited
   first (by the ray's direction along the node's split axis), so closest hits shrink the search early. */
int bkTrace(vec3 o,vec3 d,float tmax,bool any,out float tHit,out vec2 bc){ int st[64]; int sp=0; st[sp++]=0; int hit=-1; tHit=tmax; bc=vec2(0);
  vec3 inv=1.0/(d+vec3(1e-12)); int guard=0;
  while(sp>0&&guard<40000){ guard++; int ni=st[--sp]; vec4 a=bkF(uNodes,ni*2),b=bkF(uNodes,ni*2+1); if(!bkBox(o,inv,a.xyz,b.xyz,tHit)) continue;
    if(b.w<0.0){ int e=int(-b.w+0.5),c=e%8,s=int(a.w+0.5)+(e/8)*1048576;
      for(int k=0;k<4;k++){ if(k>=c) break; int t=s+k; if(t==bkSkip) continue; vec4 w0=bkF(uTris,t*3); if(bkPart>=0&&int(w0.w+0.5)!=bkPart) continue; vec3 v0=w0.xyz,v1=bkF(uTris,t*3+1).xyz,v2=bkF(uTris,t*3+2).xyz;
        vec3 e1=v1-v0,e2=v2-v0,p=cross(d,e2); float det=dot(e1,p); if(abs(det)<1e-12) continue; float id=1.0/det; vec3 s0=o-v0; float u=dot(s0,p)*id; if(u<0.0||u>1.0) continue;
        vec3 q=cross(s0,e1); float v=dot(d,q)*id; if(v<0.0||u+v>1.0) continue; float tt=dot(e2,q)*id; if(tt>1e-6&&tt<tHit){ tHit=tt; hit=t; bc=vec2(u,v); if(any) return hit; } } }
    else if(sp<62){ int r=int(b.w+0.5),ax=int(a.w+0.5); if(d[ax]<0.0){ st[sp++]=ni+1; st[sp++]=r; } else { st[sp++]=r; st[sp++]=ni+1; } } }
  return hit; }
vec3 bkNrm(int t,vec2 bc){ return normalize(bkF(uTN,t*3).xyz*(1.0-bc.x-bc.y)+bkF(uTN,t*3+1).xyz*bc.x+bkF(uTN,t*3+2).xyz*bc.y); }
vec3 bkCol(int t,vec2 bc){ return bkF(uTC,t*3).xyz*(1.0-bc.x-bc.y)+bkF(uTC,t*3+1).xyz*bc.x+bkF(uTC,t*3+2).xyz*bc.y; }
/* the triangle a ray hit, kept exactly in two floats: (index mod 4096, 1 + index / 4096); w > 0.5 means "hit" */
vec2 bkTriPack(int t){ return vec2(float(t%4096),1.0+float(t/4096)); }
int bkTriUnpack(vec4 ti){ return int(ti.x+0.5)+(int(ti.w+0.5)-1)*4096; }
/* random numbers from integer hashing (no sin(): that repeats in patterns and showed as banding) */
uint bkPcg(uint v){ uint s=v*747796405u+2891336453u; uint w=((s>>((s>>28u)+4u))^s)*277803737u; return (w>>22u)^w; }
float bkRnd(uint v){ return float(bkPcg(v)>>8u)*(1.0/16777216.0); }
float bkRadInv(uint b){ b=(b<<16u)|(b>>16u); b=((b&0x55555555u)<<1u)|((b&0xAAAAAAAAu)>>1u); b=((b&0x33333333u)<<2u)|((b&0xCCCCCCCCu)>>2u);
  b=((b&0x0F0F0F0Fu)<<4u)|((b&0xF0F0F0F0u)>>4u); b=((b&0x00FF00FFu)<<8u)|((b&0xFF00FF00u)>>8u); return float(b>>8u)*(1.0/16777216.0); }
/* cosine-weighted direction around n, with a frame that turns smoothly with n (no seams where it flips) */
vec3 bkHemi(vec3 n,vec2 r){ float ph=6.2831853*r.x,ct=sqrt(1.0-r.y),stt=sqrt(r.y); float sg=n.z>=0.0?1.0:-1.0,a=-1.0/(sg+n.z),b=n.x*n.y*a;
  vec3 t=vec3(1.0+sg*n.x*n.x*a,sg*b,-sg*n.x),bb=vec3(b,sg+n.y*n.y*a,-n.y); return normalize(t*(cos(ph)*stt)+bb*(sin(ph)*stt)+n*ct); }
`;
/* 1. the low-poly drawn in UV space: surface point, ray direction, tangent frame */
const BK_VS_UV=`#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aT; layout(location=3) in vec4 aTan; layout(location=4) in vec3 aR; layout(location=5) in float aPart; layout(location=6) in float aCurv;
uniform vec2 uFull; uniform vec4 uTile;
out vec3 vP; out vec3 vN; out vec4 vTan; out vec3 vR; flat out float vPart; out float vCurv; out vec2 vT;
void main(){ vec2 px=aT*uFull; vec2 c=(px-uTile.xy)/uTile.zw*2.0-1.0; gl_Position=vec4(c,0.0,1.0); vP=aP; vN=aN; vTan=aTan; vR=aR; vPart=aPart; vCurv=aCurv; vT=aT; }`;
const BK_FS_UV=`#version 300 es
precision highp float; in vec3 vP; in vec3 vN; in vec4 vTan; in vec3 vR; flat in float vPart; in float vCurv; in vec2 vT; uniform int uCage;
uniform sampler2D uSkew; uniform sampler2D uOffs; uniform int uUseSkew; uniform int uUseOff;
layout(location=0) out vec4 oP; layout(location=1) out vec4 oN; layout(location=2) out vec4 oT; layout(location=3) out vec4 oR;
/* skew map: white keeps the averaged (cage) ray direction, black shoots straight out of the face.
   offset map: grey keeps the front/back distances, white doubles them, black shrinks them to nothing.
   The offset factor rides in oP.w (1 + factor; 0 still means "no surface here"). */
void main(){ vec3 n=normalize(vN); vec3 fn=cross(dFdx(vP),dFdy(vP)); fn=dot(fn,fn)>1e-20?normalize(fn):n; if(dot(fn,n)<0.0) fn=-fn;
  float sk=uUseSkew==1?clamp(texture(uSkew,vT).r,0.0,1.0):1.0, of=uUseOff==1?clamp(texture(uOffs,vT).r,0.0,1.0)*2.0:1.0;
  oP=vec4(vP,1.0+of); oN=vec4(n,vPart); oT=vTan;
  if(uCage==1){ vec3 d=vR-vP; float l=length(d); vec3 dc=l>1e-7?d/l:fn; oR=vec4(vP+normalize(mix(fn,dc,sk))*l,vCurv); }
  else oR=vec4(normalize(mix(fn,normalize(vR),sk)),vCurv); }`;
/* 2. the ray from the cage to the high-poly */
const BK_FS_HIT=BK_TRACE+`uniform sampler2D uGP; uniform sampler2D uGR; uniform sampler2D uGN; uniform float uFront; uniform float uBack; uniform int uSelf; uniform int uCage; uniform int uMatch;
layout(location=0) out vec4 oH; layout(location=1) out vec4 oHN;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 P=texelFetch(uGP,p,0); if(P.w<0.5){ o=vec4(0); oH=vec4(0); oHN=vec4(0); return; }
  vec3 R=texelFetch(uGR,p,0).xyz; float th; vec2 bc; o=vec4(0);
  if(uSelf==1){ oH=vec4(P.xyz,1.0); oHN=vec4(0,0,0,0); return; }
  if(uMatch==1) bkPart=int(texelFetch(uGN,p,0).w+0.5);
  /* the ray starts on the cage (a loaded cage mesh, or the surface pushed out by the front distance) */
  vec3 org,dir; float len,front; float of=max(P.w-1.0,0.0);
  if(uCage==1){ vec3 Rc=P.xyz+(R-P.xyz)*of; vec3 v=P.xyz-Rc; front=length(v); dir=front>1e-6?v/front:-normalize(texelFetch(uGN,p,0).xyz); org=Rc; len=front+uBack*of; }
  else { dir=-R; front=uFront*of; org=P.xyz+R*front; len=front+uBack*of; }
  int t=bkTrace(org,dir,len,false,th,bc);
  if(t<0){ oH=vec4(P.xyz,0.5); oHN=vec4(0,0,0,0); return; }
  vec3 hp=org+dir*th; oH=vec4(hp,1.0); oHN=vec4(bkNrm(t,bc),front-th); vec2 tp=bkTriPack(t); o=vec4(tp.x,bc,tp.y); }`;
/* 3. what each map records (value in rgb, coverage in a) */
const BK_FS_OUT=BK_TRACE+`uniform sampler2D uGR; uniform sampler2D uGP; uniform sampler2D uGN; uniform sampler2D uGT; uniform sampler2D uHP; uniform sampler2D uHN; uniform sampler2D uHT;
uniform int uKind; uniform int uMatch; uniform int uFlipY; uniform float uRange; uniform vec3 uBMin; uniform vec3 uBSize; uniform int uRays; uniform float uDist; uniform uint uSeed; uniform int uSelf; uniform ivec2 uOrg; uniform int uSS; uniform float uSpread;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 P=texelFetch(uGP,p,0); if(P.w<0.5){ o=vec4(0); return; }
  vec3 Nl=normalize(texelFetch(uGN,p,0).xyz); vec4 H=texelFetch(uHP,p,0),HN=texelFetch(uHN,p,0); bool hit=H.w>0.75; vec3 Nh=hit&&uSelf==0?normalize(HN.xyz):Nl; vec3 X=hit?H.xyz:P.xyz;
  if(uKind==0){ /* tangent-space normal */ vec4 Tn=texelFetch(uGT,p,0); vec3 T=normalize(Tn.xyz-Nl*dot(Nl,Tn.xyz)),B=cross(Nl,T)*(Tn.w<0.0?-1.0:1.0);
    vec3 n=vec3(dot(Nh,T),dot(Nh,B),dot(Nh,Nl)); if(n.z<0.0) n.z=0.0; n=normalize(n); if(uFlipY==1) n.y=-n.y; o=vec4(n*0.5+0.5,1.0); return; }
  if(uKind==1){ /* height: how far the high-poly is above (light) or below (dark) the low-poly */ float d=hit?HN.w:0.0; o=vec4(vec3(clamp(0.5+d/(2.0*uRange),0.0,1.0)),1.0); return; }
  if(uKind==2){ o=vec4(Nh*0.5+0.5,1.0); return; }
  if(uKind==7){ /* curvature of the low-poly itself */ o=vec4(vec3(clamp(0.5+texelFetch(uGR,p,0).w,0.0,1.0)),1.0); return; }
  if(uKind==3){ o=vec4(clamp((X-uBMin)/uBSize,0.0,1.0),1.0); return; }
  if(uKind==9){ o=vec4(X,1.0); return; } /* for curvature from the shape: exact surface point and normal */
  if(uKind==10){ o=vec4(Nh,1.0); return; }
  if(uKind==4){ /* ID colours */ vec4 ti=texelFetch(uHT,p,0); o=vec4(hit&&ti.w>0.5?bkCol(bkTriUnpack(ti),ti.yz):vec3(0.0),1.0); return; }
  /* ambient occlusion (5) and thickness (6): rays over the hemisphere.
     The rays of one output pixel are shared out over its anti-aliasing samples, as one evenly spread
     (Hammersley) set turned by a per-pixel random angle: smooth results from few rays, no banding.
     They leave from the hit triangle's own face (which they skip), so its facets cannot shade it. */
  if(uMatch==1) bkPart=int(texelFetch(uGN,p,0).w+0.5);
  vec3 n=uKind==5?Nh:-Nh, ng=n; vec4 ti=texelFetch(uHT,p,0);
  if(hit&&uSelf==0&&ti.w>0.5){ int tt=bkTriUnpack(ti); bkSkip=tt; vec3 v0=bkF(uTris,tt*3).xyz; vec3 g=cross(bkF(uTris,tt*3+1).xyz-v0,bkF(uTris,tt*3+2).xyz-v0);
    if(dot(g,g)>1e-30){ g=normalize(g); ng=dot(g,n)<0.0?-g:g; } }
  vec3 org=X+ng*max(uDist*0.0005,1e-5); float acc=0.0;
  ivec2 fp=p+uOrg; ivec2 px=fp/uSS, sub=fp-px*uSS; uint j=uint(sub.y*uSS+sub.x), per=uint(uSS*uSS), total=uint(uRays)*per;
  uint h=bkPcg(uint(px.x)*1973u+bkPcg(uint(px.y)*9277u+uSeed)); vec2 rot=vec2(bkRnd(h),bkRnd(h^0x9E3779B9u));
  for(int i=0;i<256;i++){ if(i>=uRays) break; uint gi=uint(i)*per+j; vec2 r=fract(vec2((float(gi)+0.5)/float(total),bkRadInv(gi))+rot);
    r.y*=uSpread; vec3 d=bkHemi(n,r); float dg=dot(d,ng); if(dg<0.0) d=d-2.0*dg*ng; float th; vec2 bc;
    int t=bkTrace(org,d,uDist,uKind==5,th,bc); if(uKind==5) acc+=t>=0?1.0:0.0; else acc+=t>=0?th/uDist:1.0; }
  float v=acc/float(uRays); o=vec4(vec3(uKind==5?1.0-v:v),1.0); }`;
/* curvature from the surface's shape, over the whole image once every tile is done: how the normal turns
   between each point and points around it (at two distances), measured on the model itself, so mirrored
   or flipped UVs make no difference. Pairs of opposite neighbours are used together, and pairs that
   straddle a UV seam (very uneven distances) are skipped. Convex > 0.5 > concave; coverage kept in alpha. */
const BK_FS_GCURV=`uniform sampler2D uP; uniform sampler2D uN; uniform float uRad; uniform float uStr;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uP,0); vec4 a=texelFetch(uP,p,0); if(a.a<=0.0){ o=vec4(0); return; }
  vec3 X=a.rgb/a.a, N=normalize(texelFetch(uN,p,0).rgb+vec3(1e-9)); float acc=0.0,n=0.0;
  for(int ring=0;ring<2;ring++){ float r=ring==0?uRad:max(1.0,uRad*0.5);
    for(int i=0;i<4;i++){ float an=float(i)*0.7853982; ivec2 d=ivec2(round(vec2(cos(an),sin(an))*r)); ivec2 q1=p+d,q2=p-d;
      if(any(lessThan(min(q1,q2),ivec2(0)))||any(greaterThanEqual(max(q1,q2),s))) continue;
      vec4 a1=texelFetch(uP,q1,0),a2=texelFetch(uP,q2,0); if(a1.a<=0.0||a2.a<=0.0) continue;
      vec3 d1=a1.rgb/a1.a-X,d2=a2.rgb/a2.a-X; float l1=length(d1),l2=length(d2); if(l1<1e-12||l2<1e-12||l1>3.0*l2||l2>3.0*l1) continue;
      vec3 n1=normalize(texelFetch(uN,q1,0).rgb+vec3(1e-9)),n2=normalize(texelFetch(uN,q2,0).rgb+vec3(1e-9));
      acc+=dot(n1-N,d1/l1)+dot(n2-N,d2/l2); n+=2.0; } }
  float c=n>0.0?acc/n*uStr:0.0; o=vec4(vec3(clamp(0.5+c,0.0,1.0))*a.a,a.a); }`;
/* 4. tile → final image: average the samples of each output pixel, keeping coverage */
const BK_FS_DOWN=`uniform sampler2D uSrc; uniform int uSS; uniform vec2 uOff;
void main(){ ivec2 q=(ivec2(gl_FragCoord.xy)-ivec2(uOff))*uSS; vec4 acc=vec4(0);
  for(int y=0;y<4;y++){ if(y>=uSS) break; for(int x=0;x<4;x++){ if(x>=uSS) break; vec4 c=texelFetch(uSrc,q+ivec2(x,y),0); acc+=vec4(c.rgb*c.a,c.a); } }
  float n=float(uSS*uSS); o=vec4(acc.rgb/n,acc.a/n); }`;
/* 5. padding: empty pixels take the average of covered neighbours, repeatedly; then everything becomes opaque */
const BK_FS_DIL=`uniform sampler2D uSrc; void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec4 c=texelFetch(uSrc,p,0); if(c.a>0.0){ o=c; return; }
  vec4 acc=vec4(0); for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ ivec2 q=clamp(p+ivec2(x,y),ivec2(0),s-1); vec4 n=texelFetch(uSrc,q,0); if(n.a>0.0) acc+=vec4(n.rgb/n.a,1.0); }
  o=acc.a>0.0?vec4(acc.rgb/acc.a,1.0):vec4(0); }`;
const BK_FS_FIN=`uniform sampler2D uSrc; uniform vec4 uEmpty; void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); o=c.a>0.0?vec4(c.rgb/c.a,1.0):uEmpty; }`;
let BKP=null;
function bkPrograms(){if(BKP)return BKP;const mk=(vs,fs,head)=>{const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,head?fs:FS_HEAD+fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return {p,locs:{}};};
  BKP={uv:mk(BK_VS_UV,BK_FS_UV,true),hit:mk(VS_FULL,FS_HEAD.replace('out vec4 o;','')+'layout(location=2) out vec4 o;\n'+BK_FS_HIT,true),out:mk(VS_FULL,BK_FS_OUT),down:mk(VS_FULL,BK_FS_DOWN),dil:mk(VS_FULL,BK_FS_DIL),fin:mk(VS_FULL,BK_FS_FIN),gcurv:mk(VS_FULL,BK_FS_GCURV)};return BKP;}

/* ---- float render targets (several outputs at once) ---- */
function bkMRT(w,h,n){const fbo=gl.createFramebuffer(),tex=[];gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
  for(let i=0;i<n;i++){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,t,0);tex.push(t);}
  gl.drawBuffers(tex.map((_,i)=>gl.COLOR_ATTACHMENT0+i));gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {fbo,tex,w,h};}
function bkFreeMRT(m){if(!m)return;gl.deleteFramebuffer(m.fbo);m.tex.forEach(t=>gl.deleteTexture(t));}
function bkClear(m){gl.bindFramebuffer(gl.FRAMEBUFFER,m.fbo);gl.viewport(0,0,m.w,m.h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}
/* the low-poly on the GPU (with the ray direction as an extra attribute) */
function bkLowGPU(L){const n=L.pos.length/3,d=new Float32Array(n*17);
  for(let i=0;i<n;i++){d.set(L.pos.subarray(i*3,i*3+3),i*17);d.set(L.nrm.subarray(i*3,i*3+3),i*17+3);d.set(L.uv.subarray(i*2,i*2+2),i*17+6);d.set(L.tan.subarray(i*4,i*4+4),i*17+8);d.set(L.ray.subarray(i*3,i*3+3),i*17+12);d[i*17+15]=L.vertPart?L.vertPart[i]:0;d[i*17+16]=L.vertCurv?L.vertCurv[i]:0;}
  const vaoL=gl.createVertexArray();gl.bindVertexArray(vaoL);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);
  const at=(i,sz,o)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,sz,gl.FLOAT,false,68,o*4);};at(0,3,0);at(1,3,3);at(2,2,6);at(3,4,8);at(4,3,12);at(5,1,15);at(6,1,16);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,L.idx,gl.STATIC_DRAW);gl.bindVertexArray(vao);
  return {vao:vaoL,vb,ib,count:L.idx.length};}
function bkFreeLow(g){if(!g)return;gl.deleteVertexArray(g.vao);gl.deleteBuffer(g.vb);gl.deleteBuffer(g.ib);}
/* ray directions: normals averaged over every corner at the same place, so hard edges do not leave gaps */
/* curvature of a mesh at each corner: how the smoothed normals turn along the edges around it (convex > 0) */
function meshCurvature(L){const n=L.pos.length/3,key=i=>Math.round(L.pos[i*3]*1e4)+','+Math.round(L.pos[i*3+1]*1e4)+','+Math.round(L.pos[i*3+2]*1e4),ids=new Map(),w=new Int32Array(n);
  for(let i=0;i<n;i++){const k=key(i);let id=ids.get(k);if(id===undefined){id=ids.size;ids.set(k,id);}w[i]=id;}
  const W=ids.size,P=new Float32Array(W*3),N=new Float32Array(W*3),nb=Array.from({length:W},()=>new Set());
  for(let i=0;i<n;i++)for(let c=0;c<3;c++)P[w[i]*3+c]=L.pos[i*3+c];
  for(let t=0;t<L.idx.length;t+=3){const a=w[L.idx[t]],b=w[L.idx[t+1]],c=w[L.idx[t+2]];
    const u=[0,1,2].map(k=>P[b*3+k]-P[a*3+k]),v=[0,1,2].map(k=>P[c*3+k]-P[a*3+k]),f=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    for(const x of [a,b,c])for(let k=0;k<3;k++)N[x*3+k]+=f[k];nb[a].add(b).add(c);nb[b].add(a).add(c);nb[c].add(a).add(b);}
  for(let i=0;i<W;i++){const l=Math.hypot(N[i*3],N[i*3+1],N[i*3+2])||1;N[i*3]/=l;N[i*3+1]/=l;N[i*3+2]/=l;}
  let el=0,ec=0;const K=new Float32Array(W);
  for(let i=0;i<W;i++){let s=0,c=0;for(const j of nb[i]){const d=[0,1,2].map(k=>P[j*3+k]-P[i*3+k]),dn=[0,1,2].map(k=>N[j*3+k]-N[i*3+k]),l2=d[0]*d[0]+d[1]*d[1]+d[2]*d[2];if(l2<1e-12)continue;
      s+=(dn[0]*d[0]+dn[1]*d[1]+dn[2]*d[2])/l2;c++;el+=Math.sqrt(l2);ec++;}K[i]=c?s/c:0;}
  const avg=ec?el/ec:1,out=new Float32Array(n);for(let i=0;i<n;i++)out[i]=Math.max(-.5,Math.min(.5,K[w[i]]*avg*.5));return out;}
function bkRayDirs(L,average){if(!average)return L.nrm.slice();const n=L.pos.length/3,acc=new Map(),key=i=>Math.round(L.pos[i*3]*1e4)+','+Math.round(L.pos[i*3+1]*1e4)+','+Math.round(L.pos[i*3+2]*1e4);
  for(let i=0;i<n;i++){const k=key(i);let a=acc.get(k);if(!a){a=[0,0,0];acc.set(k,a);}a[0]+=L.nrm[i*3];a[1]+=L.nrm[i*3+1];a[2]+=L.nrm[i*3+2];}
  const out=new Float32Array(n*3);for(let i=0;i<n;i++){const a=acc.get(key(i)),l=Math.hypot(...a)||1;out[i*3]=a[0]/l;out[i*3+1]=a[1]/l;out[i*3+2]=a[2]/l;}return out;}

/* AO and thickness rays per anti-aliasing sample: the pixel's rays shared out over its samples (at least 4 each) */
const bkRaysPer=(rays,SS)=>Math.max(4,Math.ceil(rays/(SS*SS)));
const BK_KINDS={normal:0,height:1,wnormal:2,position:3,id:4,ao:5,thick:6,mcurv:7,cpos:9,cnrm:10};
const nextTick=()=>new Promise(r=>setTimeout(r,0));
/* bake: low and high (already in the same space), settings; returns {kind: target} at size W×H */
async function bakeRun(low,high,o,progress){const P=bkPrograms(),W=o.size,H=o.sizeH||o.size,SS=o.ss,FW=W*SS,FH=H*SS,TILE=Math.min(1024,Math.max(FW,FH));
  /* low-poly only: rays find the low-poly itself (a hair's breadth away), so AO, thickness, ID and the rest work the same */
  const self=false,solo=!high;if(solo){o=Object.assign({},o,{front:.003,back:.003,cage:null,average:false,match:false});low.vertCurv=meshCurvature(low);}
  const hg=o.hg||await bkHighGPU(high||low,progress.step,o.kinds.includes('id'));if(progress.cancelled){if(!o.hg)bkFreeHigh(hg);return null;}
  low.ray=o.cage?o.cage:bkRayDirs(low,o.average);const lg=bkLowGPU(low);
  const kinds=o.kinds.filter(k=>k!=='curv');const outDepth=canFloat?16:8;
  /* o.acc: running sums kept from an earlier bake (re-bake part of it); o.rect: only this part (output pixels) */
  const results={},acc=o.acc||{};for(const k of kinds)if(!acc[k]||acc[k].w!==W||acc[k].h!==H){if(acc[k])disposeTarget(acc[k]);acc[k]=makeTarget(W,H,k==='cpos'||k==='cnrm'?32:16,false);if(acc[k].depth===32){/* 32-bit float cannot be filtered on every card */gl.bindTexture(gl.TEXTURE_2D,acc[k].tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);}}
  const RR=o.rect?[Math.max(0,Math.floor(o.rect[0]))*SS,Math.max(0,Math.floor(o.rect[1]))*SS,Math.min(W,Math.ceil(o.rect[2]))*SS,Math.min(H,Math.ceil(o.rect[3]))*SS]:[0,0,FW,FH];
  const G=bkMRT(TILE,TILE,4),HB=bkMRT(TILE,TILE,3),OUT=bkMRT(TILE,TILE,1);
  let bmin=[1e9,1e9,1e9],bmax=[-1e9,-1e9,-1e9];const src=high||low;for(let i=0;i<src.pos.length;i+=3)for(let c=0;c<3;c++){bmin[c]=Math.min(bmin[c],src.pos[i+c]);bmax[c]=Math.max(bmax[c],src.pos[i+c]);}
  const bsize=bmin.map((v,c)=>Math.max(1e-6,bmax[c]-v));
  const tiles=[];for(let y=0;y<FH;y+=TILE)for(let x=0;x<FW;x+=TILE){const t=[x,y,Math.min(TILE,FW-x),Math.min(TILE,FH-y)];if(t[0]<RR[2]&&t[0]+t[2]>RR[0]&&t[1]<RR[3]&&t[1]+t[3]>RR[1])tiles.push(t);}
  const heavy=kinds.filter(k=>k==='ao'||k==='thick').length,steps=tiles.length*(2+kinds.length+heavy*6);let done=0;const tick=async()=>{done++;progress.set(done/steps);await nextTick();};
  const SUB=bkRaysPer(o.rays,SS)>64?128:256;
  try{
  for(const [tx,ty,tw,th] of tiles){if(progress.cancelled)break;
    /* the part of this tile to work on (tile coordinates) */
    const lx0=Math.max(0,RR[0]-tx),ly0=Math.max(0,RR[1]-ty),lx1=Math.min(tw,RR[2]-tx),ly1=Math.min(th,RR[3]-ty);
    /* 1: surface points of this tile */
    bkClear(G);gl.bindFramebuffer(gl.FRAMEBUFFER,G.fbo);gl.viewport(0,0,tw,th);useProg(P.uv,{uFull:[FW,FH],uTile:[tx,ty,tw,th],uCage:!!o.cage,uSkew:o.skew?o.skew.tex:dummy,uOffs:o.offset?o.offset.tex:dummy,uUseSkew:!!o.skew,uUseOff:!!o.offset});
    gl.disable(gl.CULL_FACE);gl.bindVertexArray(lg.vao);gl.drawElements(gl.TRIANGLES,lg.count,gl.UNSIGNED_INT,0);gl.bindVertexArray(vao);await tick();
    /* 2: rays to the high-poly, in small pieces */
    bkClear(HB);const hitU={uNodes:hg.nodes,uTris:hg.tris,uTN:hg.nrm,uTC:hg.col,uGP:G.tex[0],uGR:G.tex[3],uGN:G.tex[1],uFront:o.front,uBack:o.back,uSelf:self,uCage:!!o.cage,uMatch:!!o.match};
    gl.enable(gl.SCISSOR_TEST);
    for(let sy=ly0;sy<ly1;sy+=256)for(let sx=lx0;sx<lx1;sx+=256){gl.bindFramebuffer(gl.FRAMEBUFFER,HB.fbo);gl.viewport(0,0,tw,th);gl.scissor(sx,sy,Math.min(256,lx1-sx),Math.min(256,ly1-sy));useProg(P.hit,hitU);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.flush();}
    gl.disable(gl.SCISSOR_TEST);await tick();
    /* 3: each map, then averaged into the final image */
    for(const k of kinds){if(progress.cancelled)break;const kind=BK_KINDS[k],rayed=k==='ao'||k==='thick',sub=rayed?SUB:Math.max(tw,th);
      gl.bindFramebuffer(gl.FRAMEBUFFER,OUT.fbo);gl.viewport(0,0,tw,th);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.SCISSOR_TEST);
      const U={uNodes:hg.nodes,uTris:hg.tris,uTN:hg.nrm,uTC:hg.col,uGR:G.tex[3],uGP:G.tex[0],uGN:G.tex[1],uGT:G.tex[2],uHP:HB.tex[0],uHN:HB.tex[1],uHT:HB.tex[2],uKind:{int:kind},uMatch:!!o.match,uFlipY:o.dx,uRange:Math.max(o.front,o.back),
        uBMin:bmin,uBSize:bsize,uRays:{int:bkRaysPer(k==='ao'?o.rays:o.thickRays||Math.max(8,o.rays>>1),SS)},uSpread:k==='ao'?(o.aoSpread||1):1,uDist:k==='ao'?o.aoDist:o.thickDist,uSeed:{uint:Math.floor((o.seed||1.3)*1e6)},uSelf:self,uOrg:{iv2:[tx,ty]},uSS:{int:SS}};
      let n=0;for(let sy=ly0;sy<ly1;sy+=sub)for(let sx=lx0;sx<lx1;sx+=sub){gl.bindFramebuffer(gl.FRAMEBUFFER,OUT.fbo);gl.viewport(0,0,tw,th);gl.scissor(sx,sy,Math.min(sub,lx1-sx),Math.min(sub,ly1-sy));useProg(P.out,U);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.flush();
        if(rayed&&++n%4===0){await nextTick();if(progress.cancelled)break;}}
      gl.disable(gl.SCISSOR_TEST);
      /* average into the result: output pixels covered by this tile */
      const ox=tx/SS,oy=ty/SS;gl.enable(gl.SCISSOR_TEST);bindTarget(acc[k]);gl.scissor(ox+lx0/SS,oy+ly0/SS,(lx1-lx0)/SS,(ly1-ly0)/SS);
      useProg(P.down,{uSrc:OUT.tex[0],uSS:{int:SS},uOff:[ox,oy]});gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.disable(gl.SCISSOR_TEST);
      for(let i=0;i<(rayed?6:0);i++)await tick();await tick();}
    if(o.onTile&&!progress.cancelled)o.onTile(acc,kinds.filter(k=>k!=='cpos'&&k!=='cnrm'));}
  if(progress.cancelled)return null;
  /* padding past the UV edges, then opaque results */
  /* curvature from the shape, over the whole image */
  let outKinds=kinds.filter(k=>k!=='cpos'&&k!=='cnrm');
  if(acc.cpos&&acc.cnrm&&kinds.includes('cpos')){if(!acc.gcurv||acc.gcurv.w!==W||acc.gcurv.h!==H){if(acc.gcurv)disposeTarget(acc.gcurv);acc.gcurv=makeTarget(W,H,16,false);}
    run(P.gcurv,acc.gcurv,{uP:acc.cpos.tex,uN:acc.cnrm.tex,uRad:Math.max(1,o.curvRadius||3),uStr:o.curvStr||1});outKinds.push('gcurv');}
  progress.step('Padding the edges…');
  for(const k of outKinds){let a=acc[k],b=makeTarget(W,H,16,false);const keep=!!o.acc;if(keep&&o.pad>0){run(P.dil,b,{uSrc:a.tex});a=b;b=makeTarget(W,H,16,false);}
    for(let i=keep&&o.pad>0?1:0;i<o.pad;i++){run(P.dil,b,{uSrc:a.tex});const t=a;a=b;b=t;if(i%16===15)await nextTick();}
    const fin=makeTarget(W,H,k==='height'||k==='position'?16:outDepth,false);
    const empty=k==='normal'?[.5,.5,1,1]:k==='height'||k==='gcurv'?[.5,.5,.5,1]:k==='ao'||k==='thick'?[1,1,1,1]:[0,0,0,1];
    run(P.fin,fin,{uSrc:a.tex,uEmpty:empty});if(a!==acc[k])disposeTarget(a);if(b!==acc[k])disposeTarget(b);results[k]=fin;}
  return results;}
  finally{if(!o.acc)for(const k in acc)if(acc[k].tex)disposeTarget(acc[k]);bkFreeMRT(G);bkFreeMRT(HB);bkFreeMRT(OUT);if(!o.hg)bkFreeHigh(hg);bkFreeLow(lg);gl.bindVertexArray(vao);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}}
