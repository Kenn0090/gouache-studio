/* ================= Baker: GPU engine =================
   The low-poly model is drawn flat in its UV layout. Every texel knows its point on the low-poly
   surface; a ray is sent from just outside that point (front distance) back through it (to the
   back distance) and the first place it meets the high-poly is found with a bounding-volume tree
   walked on the GPU. What is found there becomes the normal, height, AO and other maps.
   Work is done in tiles and small pieces so the app stays responsive and the driver never
   waits too long on one job. */
const BK_TW=4096; /* width of the data textures */
/* ---- bounding volume tree over the high-poly triangles ---- */
function bvhBuild(pos,idx,onProgress){const T=idx.length/3,cx=new Float32Array(T*3),bmin=new Float32Array(T*3),bmax=new Float32Array(T*3);
  for(let t=0;t<T;t++)for(let c=0;c<3;c++){const a=pos[idx[t*3]*3+c],b=pos[idx[t*3+1]*3+c],d=pos[idx[t*3+2]*3+c];bmin[t*3+c]=Math.min(a,b,d);bmax[t*3+c]=Math.max(a,b,d);cx[t*3+c]=(a+b+d)/3;}
  const order=new Uint32Array(T);for(let i=0;i<T;i++)order[i]=i;
  const nodes=[];/* {mn,mx,left,right,start,count} flattened later */
  const stack=[[0,T,-1,0]];/* start,end,parent,isRight */
  const out=[];let built=0;
  while(stack.length){const [s,e,parent,isRight]=stack.pop();const mn=[1e30,1e30,1e30],mx=[-1e30,-1e30,-1e30],cmn=[1e30,1e30,1e30],cmx=[-1e30,-1e30,-1e30];
    for(let i=s;i<e;i++){const t=order[i];for(let c=0;c<3;c++){if(bmin[t*3+c]<mn[c])mn[c]=bmin[t*3+c];if(bmax[t*3+c]>mx[c])mx[c]=bmax[t*3+c];const v=cx[t*3+c];if(v<cmn[c])cmn[c]=v;if(v>cmx[c])cmx[c]=v;}}
    const id=out.length;out.push({mn,mx,start:s,count:e-s,right:-1});if(parent>=0&&isRight)out[parent].right=id;
    if(e-s<=4){built+=e-s;continue;}
    let ax=0;for(let c=1;c<3;c++)if(cmx[c]-cmn[c]>cmx[ax]-cmn[ax])ax=c;
    const mid=(cmn[ax]+cmx[ax])/2;let i=s,j=e-1;
    while(i<=j){if(cx[order[i]*3+ax]<mid)i++;else{const t=order[i];order[i]=order[j];order[j]=t;j--;}}
    let m=i;if(m===s||m===e){/* all centroids on one side: split in the middle of the list */m=(s+e)>>1;
      const sub=Array.from(order.subarray(s,e)).sort((a,b)=>cx[a*3+ax]-cx[b*3+ax]);order.set(sub,s);}
    out[id].count=0;
    /* left child comes right after this node (depth first); the right one is pushed first so it is built later */
    stack.push([m,e,id,1]);stack.push([s,m,id,0]);}
  const n=out.length,nodeData=new Float32Array(n*8);
  out.forEach((o,i)=>{nodeData.set([o.mn[0],o.mn[1],o.mn[2],o.count?o.start:0,o.mx[0],o.mx[1],o.mx[2],o.count?-o.count:o.right],i*8);});
  return {nodeData,order,nodes:n};}
/* float texture holding count RGBA texels (padded to rows of BK_TW) */
function bkDataTex(data,texels){const w=Math.min(BK_TW,Math.max(1,texels)),h=Math.max(1,Math.ceil(texels/BK_TW)),full=new Float32Array(w*h*4);full.set(data.subarray(0,Math.min(data.length,full.length)));
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,full);
  for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);return tex;}
/* the high-poly on the GPU: tree nodes, triangle corners, corner normals and colours */
function bkHighGPU(h,onStep){const T=h.idx.length/3;onStep('Sorting '+T.toLocaleString()+' high-poly triangles…');
  const B=bvhBuild(h.pos,h.idx);const P=new Float32Array(T*12),N=new Float32Array(T*12),C=new Float32Array(T*12);
  for(let k=0;k<T;k++){const t=B.order[k];const part=h.bakePart?h.bakePart[t]:0;for(let v=0;v<3;v++){const vi=h.idx[t*3+v];P.set([h.pos[vi*3],h.pos[vi*3+1],h.pos[vi*3+2],part],(k*3+v)*4);N.set([h.nrm[vi*3],h.nrm[vi*3+1],h.nrm[vi*3+2],0],(k*3+v)*4);
      if(h.col)C.set([h.col[vi*4],h.col[vi*4+1],h.col[vi*4+2],1],(k*3+v)*4);else if(h.triCol&&h.triCol.length)C.set([h.triCol[t*3],h.triCol[t*3+1],h.triCol[t*3+2],1],(k*3+v)*4);else C.set([...partCol(h.triPart?h.triPart[t]:0),1],(k*3+v)*4);}}
  return {nodes:bkDataTex(B.nodeData,B.nodes*2),tris:bkDataTex(P,T*3),nrm:bkDataTex(N,T*3),col:bkDataTex(C,T*3),count:T,nodeCount:B.nodes};}
const partCol=(()=>{const cache={};return p=>cache[p]||(cache[p]=idColor('part '+p));})();
function bkFreeHigh(g){if(!g)return;for(const k of ['nodes','tris','nrm','col'])gl.deleteTexture(g[k]);}

/* ---- shaders ---- */
const BK_TRACE=`uniform highp sampler2D uNodes; uniform highp sampler2D uTris; uniform highp sampler2D uTN; uniform highp sampler2D uTC;
int bkPart=-1;
vec4 bkF(highp sampler2D s,int i){ return texelFetch(s,ivec2(i%${BK_TW},i/${BK_TW}),0); }
bool bkBox(vec3 o,vec3 inv,vec3 a,vec3 b,float tmax){ vec3 t0=(a-o)*inv,t1=(b-o)*inv; vec3 lo=min(t0,t1),hi=max(t0,t1);
  float tn=max(max(lo.x,lo.y),max(lo.z,0.0)), tf=min(min(hi.x,hi.y),min(hi.z,tmax)); return tn<=tf; }
/* closest hit (any=false) or any hit (any=true) along o+t*d, 0<t<tmax */
int bkTrace(vec3 o,vec3 d,float tmax,bool any,out float tHit,out vec2 bc){ int st[48]; int sp=0; st[sp++]=0; int hit=-1; tHit=tmax; bc=vec2(0);
  vec3 inv=1.0/(d+vec3(1e-12)); int guard=0;
  while(sp>0&&guard<20000){ guard++; int ni=st[--sp]; vec4 a=bkF(uNodes,ni*2),b=bkF(uNodes,ni*2+1); if(!bkBox(o,inv,a.xyz,b.xyz,tHit)) continue;
    if(b.w<0.0){ int s=int(a.w),c=int(-b.w);
      for(int k=0;k<4;k++){ if(k>=c) break; int t=s+k; vec4 w0=bkF(uTris,t*3); if(bkPart>=0&&int(w0.w+0.5)!=bkPart) continue; vec3 v0=w0.xyz,v1=bkF(uTris,t*3+1).xyz,v2=bkF(uTris,t*3+2).xyz;
        vec3 e1=v1-v0,e2=v2-v0,p=cross(d,e2); float det=dot(e1,p); if(abs(det)<1e-12) continue; float id=1.0/det; vec3 s0=o-v0; float u=dot(s0,p)*id; if(u<0.0||u>1.0) continue;
        vec3 q=cross(s0,e1); float v=dot(d,q)*id; if(v<0.0||u+v>1.0) continue; float tt=dot(e2,q)*id; if(tt>1e-6&&tt<tHit){ tHit=tt; hit=t; bc=vec2(u,v); if(any) return hit; } } }
    else if(sp<46){ st[sp++]=int(b.w); st[sp++]=ni+1; } }
  return hit; }
vec3 bkNrm(int t,vec2 bc){ return normalize(bkF(uTN,t*3).xyz*(1.0-bc.x-bc.y)+bkF(uTN,t*3+1).xyz*bc.x+bkF(uTN,t*3+2).xyz*bc.y); }
vec3 bkCol(int t,vec2 bc){ return bkF(uTC,t*3).xyz*(1.0-bc.x-bc.y)+bkF(uTC,t*3+1).xyz*bc.x+bkF(uTC,t*3+2).xyz*bc.y; }
float bkHash(vec2 p,float s){ return fract(sin(dot(p,vec2(12.9898,78.233))+s*37.719)*43758.5453); }
/* cosine-weighted direction around n */
vec3 bkHemi(vec3 n,vec2 r){ float ph=6.2831853*r.x,ct=sqrt(1.0-r.y),stt=sqrt(r.y); vec3 t=normalize(abs(n.x)<0.9?cross(n,vec3(1,0,0)):cross(n,vec3(0,1,0))),b=cross(n,t); return normalize(t*cos(ph)*stt+b*sin(ph)*stt+n*ct); }
`;
/* 1. the low-poly drawn in UV space: surface point, ray direction, tangent frame */
const BK_VS_UV=`#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aT; layout(location=3) in vec4 aTan; layout(location=4) in vec3 aR; layout(location=5) in float aPart; layout(location=6) in float aCurv;
uniform vec2 uFull; uniform vec4 uTile;
out vec3 vP; out vec3 vN; out vec4 vTan; out vec3 vR; flat out float vPart; out float vCurv;
void main(){ vec2 px=aT*uFull; vec2 c=(px-uTile.xy)/uTile.zw*2.0-1.0; gl_Position=vec4(c,0.0,1.0); vP=aP; vN=aN; vTan=aTan; vR=aR; vPart=aPart; vCurv=aCurv; }`;
const BK_FS_UV=`#version 300 es
precision highp float; in vec3 vP; in vec3 vN; in vec4 vTan; in vec3 vR; flat in float vPart; in float vCurv; uniform int uCage;
layout(location=0) out vec4 oP; layout(location=1) out vec4 oN; layout(location=2) out vec4 oT; layout(location=3) out vec4 oR;
void main(){ oP=vec4(vP,1.0); oN=vec4(normalize(vN),vPart); oT=vTan; oR=uCage==1?vec4(vR,vCurv):vec4(normalize(vR),vCurv); }`;
/* 2. the ray from the cage to the high-poly */
const BK_FS_HIT=BK_TRACE+`uniform sampler2D uGP; uniform sampler2D uGR; uniform sampler2D uGN; uniform float uFront; uniform float uBack; uniform int uSelf; uniform int uCage; uniform int uMatch;
layout(location=0) out vec4 oH; layout(location=1) out vec4 oHN;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 P=texelFetch(uGP,p,0); if(P.w<0.5){ o=vec4(0); oH=vec4(0); oHN=vec4(0); return; }
  vec3 R=texelFetch(uGR,p,0).xyz; float th; vec2 bc; o=vec4(0);
  if(uSelf==1){ oH=vec4(P.xyz,1.0); oHN=vec4(0,0,0,0); return; }
  if(uMatch==1) bkPart=int(texelFetch(uGN,p,0).w+0.5);
  /* the ray starts on the cage (a loaded cage mesh, or the surface pushed out by the front distance) */
  vec3 org,dir; float len,front;
  if(uCage==1){ vec3 v=P.xyz-R; front=length(v); dir=front>1e-6?v/front:-normalize(texelFetch(uGN,p,0).xyz); org=R; len=front+uBack; }
  else { dir=-R; org=P.xyz+R*uFront; front=uFront; len=uFront+uBack; }
  int t=bkTrace(org,dir,len,false,th,bc);
  if(t<0){ oH=vec4(P.xyz,0.5); oHN=vec4(0,0,0,0); return; }
  vec3 hp=org+dir*th; oH=vec4(hp,1.0); oHN=vec4(bkNrm(t,bc),front-th); o=vec4(float(t),bc,1.0); }`;
/* 3. what each map records (value in rgb, coverage in a) */
const BK_FS_OUT=BK_TRACE+`uniform sampler2D uGR; uniform sampler2D uGP; uniform sampler2D uGN; uniform sampler2D uGT; uniform sampler2D uHP; uniform sampler2D uHN; uniform sampler2D uHT;
uniform int uKind; uniform int uMatch; uniform int uFlipY; uniform float uRange; uniform vec3 uBMin; uniform vec3 uBSize; uniform int uRays; uniform float uDist; uniform float uSeed; uniform int uSelf;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 P=texelFetch(uGP,p,0); if(P.w<0.5){ o=vec4(0); return; }
  vec3 Nl=normalize(texelFetch(uGN,p,0).xyz); vec4 H=texelFetch(uHP,p,0),HN=texelFetch(uHN,p,0); bool hit=H.w>0.75; vec3 Nh=hit&&uSelf==0?normalize(HN.xyz):Nl; vec3 X=hit?H.xyz:P.xyz;
  if(uKind==0){ /* tangent-space normal */ vec4 Tn=texelFetch(uGT,p,0); vec3 T=normalize(Tn.xyz-Nl*dot(Nl,Tn.xyz)),B=cross(Nl,T)*(Tn.w<0.0?-1.0:1.0);
    vec3 n=vec3(dot(Nh,T),dot(Nh,B),dot(Nh,Nl)); if(n.z<0.0) n.z=0.0; n=normalize(n); if(uFlipY==1) n.y=-n.y; o=vec4(n*0.5+0.5,1.0); return; }
  if(uKind==1){ /* height: how far the high-poly is above (light) or below (dark) the low-poly */ float d=hit?HN.w:0.0; o=vec4(vec3(clamp(0.5+d/(2.0*uRange),0.0,1.0)),1.0); return; }
  if(uKind==2){ o=vec4(Nh*0.5+0.5,1.0); return; }
  if(uKind==7){ /* curvature of the low-poly itself */ o=vec4(vec3(clamp(0.5+texelFetch(uGR,p,0).w,0.0,1.0)),1.0); return; }
  if(uKind==3){ o=vec4(clamp((X-uBMin)/uBSize,0.0,1.0),1.0); return; }
  if(uKind==4){ /* ID colours */ vec4 ti=texelFetch(uHT,p,0); o=vec4(hit&&ti.w>0.5?bkCol(int(ti.x),ti.yz):vec3(0.0),1.0); return; }
  /* ambient occlusion (5) and thickness (6): rays over the hemisphere */
  if(uMatch==1) bkPart=int(texelFetch(uGN,p,0).w+0.5);
  vec3 n=uKind==5?Nh:-Nh; vec3 org=X+n*max(uDist*0.002,1e-4); float acc=0.0;
  for(int i=0;i<256;i++){ if(i>=uRays) break; vec2 r=vec2(bkHash(vec2(p)+float(i)*1.37,uSeed),bkHash(vec2(p).yx+float(i)*2.11,uSeed+3.1)); vec3 d=bkHemi(n,r); float th; vec2 bc;
    int t=bkTrace(org,d,uDist,uKind==5,th,bc); if(uKind==5) acc+=t>=0?1.0:0.0; else acc+=t>=0?th/uDist:1.0; }
  float v=acc/float(uRays); o=vec4(vec3(uKind==5?1.0-v:v),1.0); }`;
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
  BKP={uv:mk(BK_VS_UV,BK_FS_UV,true),hit:mk(VS_FULL,FS_HEAD.replace('out vec4 o;','')+'layout(location=2) out vec4 o;\n'+BK_FS_HIT,true),out:mk(VS_FULL,BK_FS_OUT),down:mk(VS_FULL,BK_FS_DOWN),dil:mk(VS_FULL,BK_FS_DIL),fin:mk(VS_FULL,BK_FS_FIN)};return BKP;}

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

const BK_KINDS={normal:0,height:1,wnormal:2,position:3,id:4,ao:5,thick:6,mcurv:7};
const nextTick=()=>new Promise(r=>setTimeout(r,0));
/* bake: low and high (already in the same space), settings; returns {kind: target} at size W×H */
async function bakeRun(low,high,o,progress){const P=bkPrograms(),W=o.size,H=o.sizeH||o.size,SS=o.ss,FW=W*SS,FH=H*SS,TILE=Math.min(1024,Math.max(FW,FH));
  /* low-poly only: rays find the low-poly itself (a hair's breadth away), so AO, thickness, ID and the rest work the same */
  const self=false,solo=!high;if(solo){o=Object.assign({},o,{front:.003,back:.003,cage:null,average:false,match:false});low.vertCurv=meshCurvature(low);}
  const hg=bkHighGPU(high||low,progress.step);if(progress.cancelled){bkFreeHigh(hg);return null;}
  low.ray=o.cage?o.cage:bkRayDirs(low,o.average);const lg=bkLowGPU(low);
  const kinds=o.kinds.filter(k=>k!=='curv');const outDepth=canFloat?16:8;
  const results={},acc={};for(const k of kinds)acc[k]=makeTarget(W,H,16,false);
  const G=bkMRT(TILE,TILE,4),HB=bkMRT(TILE,TILE,3),OUT=bkMRT(TILE,TILE,1);
  let bmin=[1e9,1e9,1e9],bmax=[-1e9,-1e9,-1e9];const src=high||low;for(let i=0;i<src.pos.length;i+=3)for(let c=0;c<3;c++){bmin[c]=Math.min(bmin[c],src.pos[i+c]);bmax[c]=Math.max(bmax[c],src.pos[i+c]);}
  const bsize=bmin.map((v,c)=>Math.max(1e-6,bmax[c]-v));
  const tiles=[];for(let y=0;y<FH;y+=TILE)for(let x=0;x<FW;x+=TILE)tiles.push([x,y,Math.min(TILE,FW-x),Math.min(TILE,FH-y)]);
  const heavy=kinds.filter(k=>k==='ao'||k==='thick').length,steps=tiles.length*(2+kinds.length+heavy*6);let done=0;const tick=async()=>{done++;progress.set(done/steps);await nextTick();};
  const SUB=o.rays>64?128:256;
  try{
  for(const [tx,ty,tw,th] of tiles){if(progress.cancelled)break;
    /* 1: surface points of this tile */
    bkClear(G);gl.bindFramebuffer(gl.FRAMEBUFFER,G.fbo);gl.viewport(0,0,tw,th);useProg(P.uv,{uFull:[FW,FH],uTile:[tx,ty,tw,th],uCage:!!o.cage});
    gl.disable(gl.CULL_FACE);gl.bindVertexArray(lg.vao);gl.drawElements(gl.TRIANGLES,lg.count,gl.UNSIGNED_INT,0);gl.bindVertexArray(vao);await tick();
    /* 2: rays to the high-poly, in small pieces */
    bkClear(HB);const hitU={uNodes:hg.nodes,uTris:hg.tris,uTN:hg.nrm,uTC:hg.col,uGP:G.tex[0],uGR:G.tex[3],uGN:G.tex[1],uFront:o.front,uBack:o.back,uSelf:self,uCage:!!o.cage,uMatch:!!o.match};
    gl.enable(gl.SCISSOR_TEST);
    for(let sy=0;sy<th;sy+=256)for(let sx=0;sx<tw;sx+=256){gl.bindFramebuffer(gl.FRAMEBUFFER,HB.fbo);gl.viewport(0,0,tw,th);gl.scissor(sx,sy,Math.min(256,tw-sx),Math.min(256,th-sy));useProg(P.hit,hitU);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.flush();}
    gl.disable(gl.SCISSOR_TEST);await tick();
    /* 3: each map, then averaged into the final image */
    for(const k of kinds){if(progress.cancelled)break;const kind=BK_KINDS[k],rayed=k==='ao'||k==='thick',sub=rayed?SUB:Math.max(tw,th);
      gl.bindFramebuffer(gl.FRAMEBUFFER,OUT.fbo);gl.viewport(0,0,tw,th);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.SCISSOR_TEST);
      const U={uNodes:hg.nodes,uTris:hg.tris,uTN:hg.nrm,uTC:hg.col,uGR:G.tex[3],uGP:G.tex[0],uGN:G.tex[1],uGT:G.tex[2],uHP:HB.tex[0],uHN:HB.tex[1],uHT:HB.tex[2],uKind:{int:kind},uMatch:!!o.match,uFlipY:o.dx,uRange:Math.max(o.front,o.back),
        uBMin:bmin,uBSize:bsize,uRays:{int:k==='ao'?o.rays:Math.max(8,o.rays>>1)},uDist:k==='ao'?o.aoDist:o.thickDist,uSeed:o.seed||1.3,uSelf:self};
      let n=0;for(let sy=0;sy<th;sy+=sub)for(let sx=0;sx<tw;sx+=sub){gl.bindFramebuffer(gl.FRAMEBUFFER,OUT.fbo);gl.viewport(0,0,tw,th);gl.scissor(sx,sy,Math.min(sub,tw-sx),Math.min(sub,th-sy));useProg(P.out,U);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.flush();
        if(rayed&&++n%4===0){await nextTick();if(progress.cancelled)break;}}
      gl.disable(gl.SCISSOR_TEST);
      /* average into the result: output pixels covered by this tile */
      const ox=tx/SS,oy=ty/SS,ow=tw/SS,oh=th/SS;gl.enable(gl.SCISSOR_TEST);bindTarget(acc[k]);gl.scissor(ox,oy,ow,oh);
      useProg(P.down,{uSrc:OUT.tex[0],uSS:{int:SS},uOff:[ox,oy]});gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.disable(gl.SCISSOR_TEST);
      for(let i=0;i<(rayed?6:0);i++)await tick();await tick();}}
  if(progress.cancelled)return null;
  /* padding past the UV edges, then opaque results */
  progress.step('Padding the edges…');
  for(const k of kinds){let a=acc[k],b=makeTarget(W,H,16,false);for(let i=0;i<o.pad;i++){run(P.dil,b,{uSrc:a.tex});const t=a;a=b;b=t;if(i%16===15)await nextTick();}
    const fin=makeTarget(W,H,k==='height'||k==='position'?16:outDepth,false);
    const empty=k==='normal'?[.5,.5,1,1]:k==='height'?[.5,.5,.5,1]:k==='ao'||k==='thick'?[1,1,1,1]:[0,0,0,1];
    run(P.fin,fin,{uSrc:a.tex,uEmpty:empty});disposeTarget(a);disposeTarget(b);results[k]=fin;}
  return results;}
  finally{for(const k in acc)if(!results[k]&&acc[k].tex)disposeTarget(acc[k]);bkFreeMRT(G);bkFreeMRT(HB);bkFreeMRT(OUT);bkFreeHigh(hg);bkFreeLow(lg);gl.bindVertexArray(vao);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}}
