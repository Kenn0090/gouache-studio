/* Scene-aware rounded normals. The viewport and baker use the same sphere-chord
   probes through the mesh BVH. This is an independent implementation of the public
   Toolbag behaviour, not its undisclosed shader. No UV-space blur or geometry bevel. */
const BEVEL_GLSL=`
uniform float uBevelWidth; uniform float uBevelAngle;
uniform int uBevelSamples; uniform int uBevelHard; uniform int uBevelSame;
/* (0.70) shaping: profile 0 round, 1 smooth, 2 chamfer, 3 sharp; softness widens the blend; amounts for outer edges, inner corners and where separate meshes meet */
uniform int uBevelProfile; uniform float uBevelSoft; uniform float uBevelConvex; uniform float uBevelConcave; uniform float uBevelIsect;
float bvDistance(vec3 p,vec3 a,vec3 b){vec3 e=b-a;return length(p-a-e*clamp(dot(p-a,e)/max(dot(e,e),1e-20),0.0,1.0));}
vec3 bvGeom(int t){vec3 a=bkF(uTris,t*3).xyz,g=cross(bkF(uTris,t*3+1).xyz-a,bkF(uTris,t*3+2).xyz-a);g=normalize(g+vec3(1e-30));return dot(g,bkF(uTN,t*3).xyz)<0.0?-g:g;}
bool bvHardAt(int t,vec3 p,float r){if(uBevelHard==0)return false;int bits=int(bkF(uBVInfo,t*2).z+0.5);
  for(int e=0;e<3;e++){if((bits&(1<<e))!=0&&bvDistance(p,bkF(uTris,t*3+e).xyz,bkF(uTris,t*3+(e+1)%3).xyz)<r)return true;}return false;}
vec3 bvRotate(vec3 n,vec3 a,vec3 b){vec3 v=cross(a,b);return normalize(n+cross(v,n)+cross(v,cross(v,n))/max(1.0+dot(a,b),1e-5));}
vec3 bvShade(vec3 p,vec3 n,int own,vec2 bc){
  vec3 mask=bkF(uBVInfo,own*2+1).xyz;float r=uBevelWidth*clamp(dot(mask,vec3(1.0-bc.x-bc.y,bc)),0.0,1.0);if(r<=1e-6)return n;
  vec3 ng=bvGeom(own),tx=normalize(cross(abs(ng.z)<0.95?vec3(0,0,1):vec3(0,1,0),ng)),ty=cross(ng,tx);
  int savedPart=bkPart,savedSkip=bkSkip,savedSurface=bkSurface;bkPart=-1;bkSkip=-1;bkSurface=uBevelSame==1?int(bkF(uBVInfo,own*2).x+0.5):-1;
  vec3 sum=vec3(0);float total=0.0,cutoff=cos(radians(uBevelAngle));bool hard=bvHardAt(own,p,r);
  int ownSurf=int(bkF(uBVInfo,own*2).x+0.5);
  /* Three orthogonal chord directions avoid the bias of sampling only the front
     hemisphere. Inverse projected area gives equally oriented faces equal weight. */
  int ns=clamp(uBevelSamples,3,128),per=(ns+2)/3;
  for(int i=0;i<128;i++){if(i>=ns)break;int axis=i%3,j=i/3;
    vec3 d=axis==0?ng:axis==1?tx:ty,ax=axis==0?tx:axis==1?ty:ng,ay=cross(d,ax);
    float radial=sqrt((float(j)+0.5)/float(per)),angle=float(j)*2.39996323+float(axis)*1.04719755;
    vec3 off=(ax*cos(angle)+ay*sin(angle))*radial*r;float halfChord=sqrt(max(0.0,r*r-dot(off,off))),eps=max(2e-6,r*0.0002);
    vec3 origin=p+off-d*(halfChord+eps);float left=2.0*(halfChord+eps);
    for(int h=0;h<8;h++){float th;vec2 cb;int t=bkTrace(origin,d,left,false,th,cb);if(t<0)break;
      vec3 q=origin+d*th,g=bvGeom(t);float c=dot(ng,g),projected=abs(dot(g,d)),distance=length(q-p);
      /* Opposite walls of a thin part must not cancel each other. Coplanar
         triangles contribute the original face normal, never a diagonal seam. */
      if(c>-.999&&projected>0.02&&distance<r){bool eligible=c<cutoff-1e-6||hard||bvHardAt(t,q,r);
        bool bent=eligible&&c<.999999;vec3 candidate=bent?g:ng;float f=clamp(distance/r,0.0,1.0),base=uBevelProfile==1?smoothstep(0.0,1.0,1.0-f):uBevelProfile==2?1.0-f:uBevelProfile==3?pow(1.0-f,2.5):sqrt(max(0.0,1.0-f*f));
        base=pow(max(base,0.0),mix(1.0,0.35,uBevelSoft));float w=base/max(projected,0.2);
        if(bent){ /* outer edges, inner corners, and a meeting of two separate meshes each have their own amount */
          w*=dot(q-p,ng)<0.0?uBevelConvex:uBevelConcave; if(int(bkF(uBVInfo,t*2).x+0.5)!=ownSurf) w*=uBevelIsect; }
        sum+=candidate*w;total+=w;}
      float advance=th+eps;origin+=d*advance;left-=advance;if(left<=eps)break;
    }
  }
  bkPart=savedPart;bkSkip=savedSkip;bkSurface=savedSurface;
  return total>1e-8&&dot(sum,sum)>1e-12?bvRotate(n,ng,normalize(sum)):n;
}
/* Recover the visible triangle without duplicating every corner of a large mesh.
   At an intersection prefer the face with the rasterized geometric normal. */
int bvSurface(vec3 p,vec3 gn,out vec2 bc){int own=-1;float best=-2.0,eps=max(1e-5,uBevelWidth*0.001);vec3 o=p+gn*eps;float left=eps*2.0;
  bkPart=-1;bkSkip=-1;bkSurface=-1;bc=vec2(0);
  for(int i=0;i<8;i++){float th;vec2 cb;int t=bkTrace(o,-gn,left,false,th,cb);if(t<0)break;float score=dot(bvGeom(t),gn);
    if(score>best){best=score;own=t;bc=cb;}float step=th+2e-6;o-=gn*step;left-=step;if(left<=0.0||best>.9999)break;}
  return own;
}`;
const BV_UNIT_MM={mm:1,cm:10,m:1000,in:25.4};
function bvSettings(){const o=bakeCfg.bevel||(bakeCfg.bevel={on:false,preview:true,width:.5,angle:30});
  for(const [k,v] of Object.entries({samples:24,hardEdges:true,sameSurface:false,mask:'none',unit:'percent',modelUnit:'cm',profile:'round',soft:0,convex:1,concave:1,isect:1}))if(o[k]===undefined)o[k]=v;return o;}
const bevelPreviewOn=()=>(ui.mode==='bake'&&bvSettings().on&&bvSettings().preview&&canFloat&&bk.show==='material'&&!bk.uvCheck)||(ui.mode==='p3d'&&bvSettings().on&&bvSettings().preview&&canFloat);
/* the model the width is measured on: the Bake tab's low-poly, or the model in the 3D view (3D Paint) */
const bvMesh=()=>ui.mode==='bake'&&typeof bkLow==='function'?bkLow():v3.mesh;
function bvWidth(o,m){if(!o||!o.on)return 0;const w=Math.max(0,+o.width||0);if(o.unit!=='mm')return w*.02;
  m=m||bvMesh();return w*(m?.xf?.s||1)/(BV_UNIT_MM[o.modelUnit]||10);}
function bvUniforms(o,m){const num=(v,d)=>v===undefined?d:+v,P={round:0,smooth:1,chamfer:2,sharp:3};return {uBevelProfile:{int:P[o?.profile]||0},uBevelSoft:num(o?.soft,0),uBevelConvex:num(o?.convex,1),uBevelConcave:num(o?.concave,1),uBevelIsect:num(o?.isect,1),uBevelWidth:bvWidth(o,m),uBevelAngle:+o?.angle||0,uBevelSamples:{int:Math.max(3,Math.min(128,+o?.samples||24))},uBevelHard:!!o?.hardEdges,uBevelSame:!!o?.sameSurface};}

/* Hard-edge identity follows the imported corner normals, independent of UVs,
   materials, face triangulation and the user's angle threshold. */
function bevelNormals(m,angle,hardEdges=false){const cached=m._bevelN;if(cached&&cached.idx===m.idx&&cached.pos===m.pos&&cached.nrm===m.nrm&&cached.angle===angle&&cached.hardEdges===hardEdges)return cached.data;
  const T=m.idx.length/3,I=m.idx,P=m.pos,normals=new Float32Array(T*3),out=new Float32Array(T*12),edges=new Map(),key=i=>Math.round(P[i*3]*1e5)+','+Math.round(P[i*3+1]*1e5)+','+Math.round(P[i*3+2]*1e5);
  for(let t=0;t<T;t++){const ids=[I[t*3],I[t*3+1],I[t*3+2]],a=ids[0]*3,b=ids[1]*3,c=ids[2]*3;
    let n=norm3(cross3([P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],[P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2]]));
    if(m.nrm&&dot3(n,[m.nrm[a],m.nrm[a+1],m.nrm[a+2]])<0)n=n.map(x=>-x);normals.set(n,t*3);
    const part=m.triPart?m.triPart[t]:0;
    for(let e=0;e<3;e++){const x=key(ids[e]),y=key(ids[(e+1)%3]),k=part+'|'+(x<y?x+'|'+y:y+'|'+x),list=edges.get(k);if(list)list.push([t,e]);else edges.set(k,[[t,e]]);}}
  const cutoff=Math.cos(Math.max(0,Math.min(180,+angle||0))*Math.PI/180);
  for(const list of edges.values()){if(list.length!==2)continue;const [a,b]=list,N0=normals.subarray(a[0]*3,a[0]*3+3),N1=normals.subarray(b[0]*3,b[0]*3+3),d=dot3(N0,N1);let hard=false;
    if(hardEdges&&m.nrm)for(let e=0;e<2;e++){const i=I[a[0]*3+(a[1]+e)%3];for(let k=0;k<2;k++){const j=I[b[0]*3+(b[1]+k)%3];if(key(i)===key(j)&&dot3(m.nrm.subarray(i*3,i*3+3),m.nrm.subarray(j*3,j*3+3))<.9999)hard=true;}}
    if((d>=cutoff-1e-6&&!hard)||d<-.9999||d>.999999)continue;
    for(const [own,other] of [[a,b],[b,a]]){const p=own[0]*12+own[1]*4;out.set(normals.subarray(other[0]*3,other[0]*3+3),p);out[p+3]=1;}}
  m._bevelN={idx:m.idx,pos:m.pos,nrm:m.nrm,angle,hardEdges,data:out};return out;}
/* Typed edge tables avoid millions of strings/arrays on CAD and high-poly meshes.
   Self-contained for the worker; only the one-byte-per-face result stays cached. */
function bvHardBitsBuild(P,I,N,parts){const T=I.length/3,E=I.length,bits=new Uint8Array(T);let cap=16;while(cap<E*1.25)cap*=2;
  const first=new Int32Array(cap).fill(-1),second=new Int32Array(cap).fill(-1),mask=cap-1;
  const quant=(i,c)=>Math.round(P[i*3+c]*1e5),same=(i,j)=>quant(i,0)===quant(j,0)&&quant(i,1)===quant(j,1)&&quant(i,2)===quant(j,2);
  const end=e=>I[Math.floor(e/3)*3+(e%3+1)%3],before=(a,b)=>quant(a,0)<quant(b,0)||quant(a,0)===quant(b,0)&&(quant(a,1)<quant(b,1)||quant(a,1)===quant(b,1)&&quant(a,2)<quant(b,2));
  const face=t=>{const a=I[t*3]*3,b=I[t*3+1]*3,c=I[t*3+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2];let x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];};
  for(let e=0;e<E;e++){const t=Math.floor(e/3),part=parts?parts[t]:0;let a=I[e],b=end(e);if(!before(a,b)){const q=a;a=b;b=q;}
    let h=part;for(let c=0;c<3;c++){h=Math.imul(h^quant(a,c),16777619);h=Math.imul(h^quant(b,c),2246822519);}h=(h^(h>>>16))&mask;
    while(first[h]>=0){const f=first[h],ft=Math.floor(f/3);let fa=I[f],fb=end(f);if(!before(fa,fb)){const q=fa;fa=fb;fb=q;}
      if((parts?parts[ft]:0)===part&&same(a,fa)&&same(b,fb))break;h=(h+1)&mask;}
    if(first[h]<0){first[h]=e;continue;}const f=first[h],ft=Math.floor(f/3);
    if(second[h]!==-1){bits[ft]&=~(1<<(f%3));if(second[h]>=0)bits[Math.floor(second[h]/3)]&=~(1<<(second[h]%3));second[h]=-2;continue;}
    second[h]=e;let hard=false;for(const i of [I[e],end(e)])for(const j of [I[f],end(f)])if(same(i,j)&&N[i*3]*N[j*3]+N[i*3+1]*N[j*3+1]+N[i*3+2]*N[j*3+2]<.9999)hard=true;
    if(hard){const x=face(t),y=face(ft);if(Math.abs(x[0]*y[0]+x[1]*y[1]+x[2]*y[2])<.999999){bits[t]|=1<<(e%3);bits[ft]|=1<<(f%3);}}
  }return bits;}
const bvParts=m=>m.bvSurfaceIds||m.triPart;
function bvHardBitsValid(m){const c=m._bvHardBits;return c&&c.idx===m.idx&&c.pos===m.pos&&c.nrm===m.nrm&&c.parts===bvParts(m);}
async function bvPrepareInfo(hg,o){if(!o?.hardEdges||bvHardBitsValid(hg.source))return;const m=hg.source;if(m._bvHardPending)return m._bvHardPending;
  const key={idx:m.idx,pos:m.pos,nrm:m.nrm,parts:bvParts(m)};m._bvHardPending=(async()=>{
    let data;if(m.idx.length<150000)data=bvHardBitsBuild(m.pos,m.idx,m.nrm,bvParts(m));
    else data=await new Promise((res,rej)=>{let w;try{const url=URL.createObjectURL(new Blob([bvHardBitsBuild.toString()+'\nonmessage=e=>{const d=e.data,b=bvHardBitsBuild(d.P,d.I,d.N,d.parts);postMessage(b,[b.buffer]);};'],{type:'text/javascript'}));w=new Worker(url);URL.revokeObjectURL(url);}catch(e){rej(e);return;}
      w.onmessage=e=>{w.terminate();res(e.data);};w.onerror=e=>{w.terminate();rej(new Error(e.message||'Could not prepare bevel hard edges'));};const P=m.pos.slice(),I=m.idx.slice(),N=m.nrm.slice(),parts=bvParts(m)?.slice();w.postMessage({P,I,N,parts},[P.buffer,I.buffer,N.buffer,...(parts?[parts.buffer]:[])]);});
    if(key.idx===m.idx&&key.pos===m.pos&&key.nrm===m.nrm&&key.parts===bvParts(m))m._bvHardBits={...key,data};
  })();try{await m._bvHardPending;}finally{m._bvHardPending=null;}}
/* (0.70) per-material width: each material takes a share (0 to 100%) of the bevel width, like the vertex colour mask */
function bvMatShare(o,m,t){const n=m.matNames&&m.triMat?m.matNames[m.triMat[t]]:null,v=n!=null&&o.mats?o.mats[n]:undefined;return v===undefined?1:Math.max(0,Math.min(1,+v));}
function bevelBakeTex(hg,o){if(!o||!o.on)return null;const m=hg.source,key=[!!o.hardEdges,o.mask||'none',m.idx,m.pos,m.nrm,m.vcol,m._bvHardBits,bvParts(m),JSON.stringify(o.mats||{})+'|'+(m.matNames||[]).join(',')];
  if(hg.bevel&&key.every((v,i)=>v===hg.bevel.key[i]))return hg.bevel.tex;
  if(hg.bevel)gl.deleteTexture(hg.bevel.tex);
  const hard=o.hardEdges?(bvHardBitsValid(m)?m._bvHardBits.data:bvHardBitsBuild(m.pos,m.idx,m.nrm,bvParts(m))):null,mask={r:0,g:1,b:2,a:3}[o.mask],col=m.vcol,I=m.idx,order=hg.order,parts=bvParts(m);
  const tex=bkBandTex(hg.count*2,false,(b,t0,t1)=>{for(let q=t0;q<t1;q++){const t=order[q>>1],p=(q-t0)*4;
    if(q%2===0){b[p]=parts?parts[t]:0;b[p+1]=m.triMat?m.triMat[t]:0;b[p+2]=hard?hard[t]:0;}
    else{const share=bvMatShare(o,m,t);for(let c=0;c<3;c++)b[p+c]=share*(mask===undefined||!col?1:Math.max(0,Math.min(1,col[I[t*3+c]*4+mask])));}}});
  hg.bevel={tex,key};return tex;}

/* The scene probes have their own small shader pass. The final material reuses
   its normal-map sampler, staying within Windows' sixteen-sampler limit. */
const bvGPU={low:null,high:null};let P_BV3=null,P_BVHIGH=null,P_BVGEOM=null,P_BVRAY=null,P_BVCOPY=null;
const bvClay={};
function bevelClay(see){const key=see?'over':'solid';if(!bvClay[key]){bvClay[key]=makeTarget(1,1,8,false);clearTarget(bvClay[key],see?[1,.72,.45,1]:[.62,.62,.64,1]);}return bvClay[key];}
function bvScreenMaterial(fs){return fs.replace('if((uHas&4)!=0){ vec3 n=mapSample(uNrm,uv+uPN).rgb*2.0-1.0; N=normalize(T*n.x+B*n.y+Ng*n.z); }','{ vec4 rounded=texelFetch(uNrm,ivec2(gl_FragCoord.xy),0); if(rounded.a>0.0)N=normalize(rounded.xyz); }');}
function bevelFreeGPU(s){if(!s)return;s.disposed=true;if(s.hg)bkFreeHigh(s.hg);bvScreenFree(s);}
function bvScreenFree(s){if(s.G){bkFreeMRT(s.G);gl.deleteRenderbuffer(s.depth);s.G=null;}if(s.out){disposeTarget(s.out);s.out=null;}s.screenKey=null;}
function bevelPreviewGPU(m,slot='low'){if(!m)return null;let s=bvGPU[slot];if(s&&s.mesh===m&&s.idx===m.idx&&s.pos===m.pos&&s.nrm===m.nrm)return s;
  bevelFreeGPU(s);s=bvGPU[slot]={mesh:m,idx:m.idx,pos:m.pos,nrm:m.nrm,hg:null,disposed:false};
  s.ready=bkHighGPU(m,()=>{},false).then(async hg=>{if(s.disposed){bkFreeHigh(hg);return;}s.hg=hg;await bvPrepareInfo(hg,bvSettings());if(!s.disposed){v3.dirty=true;requestRender();}}).catch(e=>{if(!s.disposed){s.error=String(e);if(s.hg){bkFreeHigh(s.hg);s.hg=null;}bvScreenFree(s);bvStatus();toast('Bevel preview: '+e.message);}});bvStatus();return s;}
function bevelPreviewProgram(high=false){if(high)return P_BVHIGH||(P_BVHIGH=Object.assign(prog3(VS_3D,'uniform float uBVAlpha;\n'+bvScreenMaterial(FS_3D).replace('vec3 T=normalize(vTan.xyz-Ng*dot(Ng,vTan.xyz)), B=cross(Ng,T)*vTan.w;','vec3 T=normalize(cross(abs(Ng.z)<.95?vec3(0,0,1):vec3(0,1,0),Ng)), B=cross(Ng,T);').replaceAll('vec4(pow(clamp(col,0.0,1.0),vec3(1.0/2.2)),1.0)','vec4(pow(clamp(col,0.0,1.0),vec3(1.0/2.2)),uBVAlpha)')),{decodeOnly:true}));
  return P_BV3||(P_BV3=Object.assign(prog3(VS_3D,bvScreenMaterial(FS_3D)),{decodeOnly:true}));}
function bvPrograms(){if(!P_BVGEOM)P_BVGEOM=prog3(VS_3D,`in vec3 vP;in vec3 vN;in vec2 vT;in vec4 vTan;
uniform sampler2D uNrm;uniform sampler2D uBase;uniform sampler2D uOpac;uniform int uHas;uniform int uClip;uniform int uHigh;uniform vec2 uPN;
layout(location=1) out vec4 oG;layout(location=2) out vec4 oS;
void main(){if(uHigh==0&&uClip==1){float a=texture(uBase,vT).a;if((uHas&64)!=0)a*=texture(uOpac,vT).r;if(a<.5)discard;}
vec3 n=normalize(vN),g=cross(dFdx(vP),dFdy(vP));g=dot(g,g)>1e-20?normalize(g):n;if(dot(g,n)<0.0)g=-g;vec3 shade=n;
if((uHas&4)!=0){vec3 t=normalize(vTan.xyz-n*dot(n,vTan.xyz)),b=cross(n,t)*vTan.w,c=texture(uNrm,vT+uPN).rgb*2.0-1.0;shade=normalize(t*c.x+b*c.y+n*c.z);}
o=vec4(vP,1);oG=vec4(g,1);oS=vec4(shade,1);}`,FS_HEAD.replace('out vec4 o;','layout(location=0) out vec4 o;'));
  if(!P_BVRAY)P_BVRAY=prog3(VS_FULL,BK_TRACE+BEVEL_GLSL+`uniform sampler2D uBVPosition;uniform sampler2D uBVGeometric;uniform sampler2D uBVInput;
void main(){ivec2 xy=ivec2(gl_FragCoord.xy);vec4 p=texelFetch(uBVPosition,xy,0);if(p.a==0.0){o=vec4(0);return;}vec3 n=texelFetch(uBVInput,xy,0).xyz,gn=texelFetch(uBVGeometric,xy,0).xyz;vec2 bc;int t=bvSurface(p.xyz,gn,bc);o=vec4(t>=0?bvShade(p.xyz,n,t,bc):n,1);}`);
  if(!P_BVCOPY)P_BVCOPY=prog3(VS_FULL,'uniform sampler2D uSrc;void main(){o=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0);}');
  for(const p of [P_BVGEOM,P_BVRAY,P_BVCOPY])progOk(p);}
function bevelScreen(s,g,common,U,F,high=false){if(!s?.hg||s.error)return null;const o=bvSettings();if(o.hardEdges&&!bvHardBitsValid(s.mesh)){if(!s.infoReady)s.infoReady=bvPrepareInfo(s.hg,o).then(()=>{s.infoReady=null;v3.dirty=true;requestRender();}).catch(e=>{s.error=String(e);bvStatus();toast('Bevel preview: '+e.message);});return null;}bvPrograms();const info=bevelBakeTex(s.hg,o);
  const key=[F.w,F.h,...common.uVP.m4,JSON.stringify(o),U.uHas?.int||0,U.uClip||false].join('|');
  let fresh=false;/* the picture changed (the camera moved): redo all of it at once, roughly, then refine */
  if(s.screenKey!==key||s.inputNormal!==U.uNrm||s.inputBase!==U.uBase){
    fresh=true;
    if(!s.G||s.G.w!==F.w||s.G.h!==F.h){bvScreenFree(s);s.G=bkMRT(F.w,F.h,3);s.depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,s.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,F.w,F.h);gl.bindFramebuffer(gl.FRAMEBUFFER,s.G.fbo);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,s.depth);s.out=makeTarget(F.w,F.h,16,false);}
    bkClear(s.G);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
    useProg(P_BVGEOM,{...U,...common,uHigh:high,uHas:U.uHas||{int:0},uUseH:false,uMorph:0,uPN:U.uPN||[0,0]});gl.bindVertexArray(g.vao);gl.drawElements(gl.TRIANGLES,g.count,gl.UNSIGNED_INT,0);
    gl.disable(gl.DEPTH_TEST);run(P_BVCOPY,s.out,{uSrc:s.G.tex[2]});s.screenKey=key;s.inputNormal=U.uNrm;s.inputBase=U.uBase;s.tile=0;
  }
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.enable(gl.SCISSOR_TEST);bindTarget(s.out);
  const block=o.samples>32?64:128,nx=Math.ceil(F.w/block),ny=Math.ceil(F.h/block),limit=fresh?0:Math.min(nx*ny,s.tile+2);
  useProg(P_BVRAY,{...bvUniforms(o,bvMesh()),uNodes:s.hg.nodes,uTris:s.hg.tris,uTN:s.hg.nrm,uTC:s.hg.col,uBVInfo:info,uBVPosition:s.G.tex[0],uBVGeometric:s.G.tex[1],uBVInput:s.G.tex[2]});gl.bindVertexArray(vao);
  if(fresh){/* (0.70) moving the view: every pixel rounded straight away with a few rays, so the bevel never pops in patch by patch; the full quality follows tile by tile once the view is still */
    gl.disable(gl.SCISSOR_TEST);useProg(P_BVRAY,{...bvUniforms(o,bvMesh()),uBevelSamples:{int:Math.min(6,Math.max(3,o.samples|0))},uNodes:s.hg.nodes,uTris:s.hg.tris,uTN:s.hg.nrm,uTC:s.hg.col,uBVInfo:info,uBVPosition:s.G.tex[0],uBVGeometric:s.G.tex[1],uBVInput:s.G.tex[2]});gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.enable(gl.SCISSOR_TEST);
    useProg(P_BVRAY,{...bvUniforms(o,bvMesh()),uNodes:s.hg.nodes,uTris:s.hg.tris,uTN:s.hg.nrm,uTC:s.hg.col,uBVInfo:info,uBVPosition:s.G.tex[0],uBVGeometric:s.G.tex[1],uBVInput:s.G.tex[2]});}
  while(s.tile<limit){const x=s.tile%nx*block,y=Math.floor(s.tile/nx)*block;gl.scissor(x,y,Math.min(block,F.w-x),Math.min(block,F.h-y));gl.drawArrays(gl.TRIANGLE_STRIP,0,4);s.tile++;}
  gl.disable(gl.SCISSOR_TEST);gl.flush();bvStatus();if(s.tile<nx*ny){v3.dirty=true;requestAnimationFrame(()=>{v3.dirty=true;requestRender();});}
  gl.bindFramebuffer(gl.FRAMEBUFFER,F.ms);gl.viewport(0,0,F.w,F.h);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);return s.out;
}
const bvPreviewState={highMode:null};
function bvSetPreview(value){const o=bvSettings();o.preview=value;if(value&&o.on){bk.show='material';bk.uvCheck=false;bk.dirty=true;}if(value&&o.on&&bakeCfg.high){if(bvPreviewState.highMode===null)bvPreviewState.highMode=bk.showHigh||'off';bk.showHigh='only';}else if(bvPreviewState.highMode!==null){if(bk.showHigh==='only')bk.showHigh=bvPreviewState.highMode;bvPreviewState.highMode=null;}if(!value||!o.on)for(const s of Object.values(bvGPU))if(s)bvScreenFree(s);bvStatus();v3.dirty=true;requestRender(true);}
function bvStatusText(){const o=bvSettings(),s=bvGPU[ui.mode==='bake'&&bakeCfg.high?'high':'low'];let text='Preview off';
  if(o.on&&o.preview){if(s?.error)text='Preview unavailable: '+s.error;else if(!s?.hg||s.infoReady||!s.out)text='Preparing bevel preview…';else{const block=o.samples>32?64:128,total=Math.ceil(s.out.w/block)*Math.ceil(s.out.h/block);text=s.tile<total?'Refining preview · '+Math.round(s.tile/total*100)+'%':'Preview ready';}}
  return text;}
function bvStatus(){const e=$('#bkBevelStatus');if(e){const text=bvStatusText();if(e.textContent!==text)e.textContent=text;}}
function bvChanged(){for(const s of Object.values(bvGPU))if(s)s.screenKey=null;if(ui.mode==='bake'){bvSetPreview(true);return;}
  /* 3D Paint: the model in the 3D view shows it live */
  const o=bvSettings();if(!o.on)for(const s of Object.values(bvGPU))if(s)bvScreenFree(s);bvStatus();v3.dirty=true;requestRender(true);}
function bvChangeUnit(unit){const o=bvSettings(),m=bvMesh(),actual=bvWidth({...o,on:true},m);o.unit=unit;o.width=unit==='mm'?actual*(BV_UNIT_MM[o.modelUnit]||10)/(m.xf?.s||1):actual/.02;bvChanged();}
/* (0.70, Kenn) the Bevel shader's settings, shared by the Bake tab, the Shader panel and the 3D Paint Bake window.
   Like Marmoset Toolbag's: a low-poly with sharp edges gets rounded normals, so no high-poly is needed for them. */
/* one slider per material of the model: the share of the width it gets (only when the model has several materials) */
function bevelMatRows(o){const m=bvMesh(),names=m&&m.matNames||[];if(names.length<2)return [];const mats=o.mats||(o.mats={});
  return [el('div',{class:'sub',text:'Width per material'}),el('p',{class:'note',text:'Each material gets a share of the width above, so hard parts can have a wider bevel than soft ones. 0% leaves a material sharp.'}),
    ...names.map((n,i)=>makeSlider({id:'bkBevelMat'+i,label:n||'Material '+(i+1),min:0,max:1,step:.01,value:mats[n]===undefined?1:mats[n],fmt:pct,onInput:v=>{mats[n]=v;bvChanged();}}).el)];}
function bevelFields(o,again){const select=(id,values,value,change)=>{const s=el('select',{id},...values.map(([v,t])=>el('option',{value:v,text:t})));s.value=value;s.onchange=()=>change(s.value);return s;};
  const ch=()=>{bvChanged();if(again)again();};
  return [el('label',{text:'Width units'}),select('bkBevelUnit',[['percent','% of model'],['mm','Millimeters']],o.unit,u=>{bvChangeUnit(u);if(again)again();}),
    ...(o.unit==='mm'?[el('label',{text:'Model file units'}),select('bkBevelModelUnit',[['mm','Millimeters'],['cm','Centimeters'],['m','Meters'],['in','Inches']],o.modelUnit,v=>{o.modelUnit=v;ch();})]:[]),
    makeSlider({id:'bkBevelWidth',label:o.unit==='mm'?'Width (mm)':'Width (% of model)',min:0,max:o.unit==='mm'?Math.max(10,o.width*2):5,step:.01,value:o.width,fmt:v=>v.toFixed(2)+(o.unit==='mm'?' mm':'%'),onInput:v=>{o.width=v;bvChanged();}}).el,
    makeSlider({id:'bkBevelAngle',label:'Minimum edge angle',min:0,max:180,step:1,value:o.angle,fmt:v=>Math.round(v)+'°',onInput:v=>{o.angle=v;bvChanged();}}).el,
    makeSlider({id:'bkBevelSamples',label:'Samples',min:3,max:128,step:1,value:o.samples,fmt:v=>Math.round(v)+' rays',onInput:v=>{o.samples=Math.round(v);bvChanged();}}).el,
    el('label',{text:'Edge profile'}),select('bkBevelProfile',[['round','Round'],['smooth','Smooth'],['chamfer','Chamfer (straight ramp)'],['sharp','Tight (narrow rounding)']],o.profile,v=>{o.profile=v;bvChanged();}),
    makeSlider({id:'bkBevelSoft',label:'Softness',min:0,max:1,step:.01,value:o.soft,fmt:pct,onInput:v=>{o.soft=v;bvChanged();}}).el,
    makeSlider({id:'bkBevelConvex',label:'Outer edges',min:0,max:1.5,step:.01,value:o.convex,fmt:pct,onInput:v=>{o.convex=v;bvChanged();}}).el,
    makeSlider({id:'bkBevelConcave',label:'Inner corners',min:0,max:1.5,step:.01,value:o.concave,fmt:pct,onInput:v=>{o.concave=v;bvChanged();}}).el,
    makeSlider({id:'bkBevelIsect',label:'Where meshes meet',min:0,max:1.5,step:.01,value:o.isect,fmt:pct,onInput:v=>{o.isect=v;bvChanged();}}).el,
    chk('bkBevelHard','Bevel hard edges',o.hardEdges,v=>{o.hardEdges=v;bvChanged();}),chk('bkBevelSame','Same surface only',o.sameSurface,v=>{o.sameSurface=v;bvChanged();}),
    ...bevelMatRows(o),
    el('label',{text:'Vertex color width mask'}),select('bkBevelMask',[['none','None'],['r','Red'],['g','Green'],['b','Blue'],['a','Alpha']],o.mask,v=>{o.mask=v;bvChanged();})];}
function bevelBakeControls(){const o=bvSettings();
  return el('div',{class:'dlg-grid',id:'bkBevelControls'},el('div',{class:'sub',text:'Bevel shader'}),
    chk('bkBevelOn','Enable bevel',!!o.on,v=>{o.on=v;bvChanged();}),chk('bkBevelPreview','Preview before baking',o.preview!==false,v=>bvSetPreview(v)),
    ...bevelFields(o,()=>buildBakePanel()),
    el('p',{class:'note',id:'bkBevelStatus',text:bvStatusText()}),
    el('p',{class:'note',text:'Probes nearby surfaces to round edges and mesh intersections in shading. Same surface only excludes other imported objects. Samples trade speed for quality. The mesh silhouette stays unchanged.'}),
    el('p',{class:'note',text:o.unit==='mm'?'Set Model file units to the units used when exporting your mesh. Vertex colors multiply the width; meshes without vertex colors keep the full width.':'Choose Millimeters for a physical width. Smaller widths usually suit hard-surface details best.'}),
    el('button',{class:'btn',id:'bkBakeBevel',text:'Bake bevel normal',disabled:!!bk.busy,onclick:()=>{o.on=true;runBakeSets(bkLow(),['normal']);}}));}
/* 3D Paint: the same shader as a section (Shader panel, Bake mesh maps window): live in the 3D view, and baked into the normal map */
function bevelSection(redraw,idp){const o=bvSettings(),again=()=>{if(redraw)redraw();};
  return el('div',{class:'dlg-grid',id:(idp||'')+'BevelBox'},el('div',{class:'sub',text:'Bevel shader (rounded edges)'}),
    el('p',{class:'note',text:'Rounds the sharp edges of a low-poly in its normals, like Marmoset Toolbag, so a high-poly is not needed for them. Shown live on the model, and baked with the Normal map.'}),
    chk((idp||'')+'BevelOn','Round the edges',!!o.on,v=>{o.on=v;bvChanged();again();}),
    ...(o.on?[chk((idp||'')+'BevelPrev','Show it in the 3D view',o.preview!==false,v=>{o.preview=v;bvChanged();}),...bevelFields(o,again),el('p',{class:'note',id:'bkBevelStatus',text:bvStatusText()})]:[]));}
