/* Mesh-connected blur. Each tap walks welded triangle edges in surface space,
   then reads that triangle's UVs. Atlas neighbours and 0..1 wrapping are unrelated
   to surface neighbours; disconnected surfaces and texture sets never share taps. */
let seamBlurCache=null,seamBlurProgram=null;
const VS_SEAMBLUR=`#version 300 es
layout(location=0) in vec2 aUV; layout(location=1) in float aFace; layout(location=2) in vec2 aBary;
out vec2 vBary; flat out int vFace;
void main(){vBary=aBary;vFace=int(aFace);gl_Position=vec4(aUV*2.0-1.0,0,1);}`;
const FS_SEAMBLUR=`in vec2 vBary; flat in int vFace;
uniform highp sampler2D uFaces; uniform sampler2D uSrc; uniform vec2 uSize; uniform vec2 uRadius; uniform int uBox;
vec4 faceData(int t,int k){int i=t*5+k,w=textureSize(uFaces,0).x;return texelFetch(uFaces,ivec2(i%w,i/w),0);}
vec3 pointAt(int t,int k){return faceData(t,k+2).xyz;}
vec2 uvAt(int t,int k){vec4 a=faceData(t,0);return k==0?a.xy:k==1?a.zw:faceData(t,1).xy;}
vec3 baryUV(int t,vec2 p){vec2 a=uvAt(t,0),b=uvAt(t,1)-a,c=uvAt(t,2)-a,q=p-a;float d=b.x*c.y-b.y*c.x;
 if(abs(d)<1e-12)return vec3(1,0,0);float y=(q.x*c.y-q.y*c.x)/d,z=(b.x*q.y-b.y*q.x)/d;return vec3(1.0-y-z,y,z);}
vec3 baryWorld(int t,vec3 p){vec3 a=pointAt(t,0),b=pointAt(t,1)-a,c=pointAt(t,2)-a,q=p-a;
 float bb=dot(b,b),bc=dot(b,c),cc=dot(c,c),d=bb*cc-bc*bc;if(abs(d)<1e-16)return vec3(1,0,0);
 float y=(cc*dot(q,b)-bc*dot(q,c))/d,z=(bb*dot(q,c)-bc*dot(q,b))/d;return vec3(1.0-y-z,y,z);}
/* Only atlas borders need an inset. Interior triangle edges share the same pixels.
   Move a sample the minimum distance towards the inset triangle; never remap its interior. */
vec2 seamReadUV(int t,vec3 b){vec2 a=uvAt(t,0)*uSize,c=uvAt(t,1)*uSize,d=uvAt(t,2)*uSize;
 float area=abs((c.x-a.x)*(d.y-a.y)-(c.y-a.y)*(d.x-a.x));int borders=int(faceData(t,3).w);
 vec3 inset=1.01*vec3(abs(c.x-d.x)+abs(c.y-d.y),abs(d.x-a.x)+abs(d.y-a.y),abs(a.x-c.x)+abs(a.y-c.y))/max(area,1e-8);
 for(int k=0;k<3;k++)if((borders&(1<<k))==0)inset[k]=0.0;
 float sum=dot(inset,vec3(1));if(sum>=.99)return (a+c+d)/(3.0*uSize);
 vec3 centre=inset+vec3((1.0-sum)/3.0);float shift=0.0;
 for(int k=0;k<3;k++)if(b[k]<inset[k])shift=max(shift,(inset[k]-b[k])/max(centre[k]-b[k],1e-8));
 b=mix(b,centre,clamp(shift,0.0,1.0));return (a*b.x+c*b.y+d*b.z)/uSize;}
vec2 walkUV(int t,vec3 anchor,vec3 b){for(int step=0;step<64;step++){
 /* Follow the first edge crossed by the segment, rather than the most negative
    endpoint coordinate (which can select an unrelated edge at triangle corners). */
 int e=-1;float first=2.0;for(int k=0;k<3;k++)if(b[k]<-0.00001){float f=max(0.0,anchor[k])/max(anchor[k]-b[k],1e-8);if(f<first){first=f;e=k;}}
 if(e<0)break;
 vec4 links=faceData(t,1);int next=int(e==0?links.z:e==1?links.w:faceData(t,2).w);
 vec3 crossing=mix(anchor,b,clamp(first,0.0,1.0));
 if(next<0){b=crossing;break;}
 vec3 a=pointAt(t,(e+1)%3),c=pointAt(t,(e+2)%3),op=pointAt(t,e),edge=c-a;float len=length(edge);if(len<1e-8)break;edge/=len;
 vec3 p=pointAt(t,0)*b.x+pointAt(t,1)*b.y+pointAt(t,2)*b.z,side=op-a-edge*dot(op-a,edge);
 vec3 hit=pointAt(t,0)*crossing.x+pointAt(t,1)*crossing.y+pointAt(t,2)*crossing.z;
 float distance=-dot(p-a,normalize(side));vec3 nside=vec3(0);float longest=0.0;
 for(int k=0;k<3;k++){vec3 s=pointAt(next,k)-a;s-=edge*dot(s,edge);float d=dot(s,s);if(d>longest){longest=d;nside=s;}}
 if(longest<1e-16)break;p=a+edge*dot(p-a,edge)+normalize(nside)*distance;t=next;b=baryWorld(t,p);anchor=baryWorld(t,hit);
 }
 b=max(b,vec3(0));b/=max(dot(b,vec3(1)),1e-8);return seamReadUV(t,b);}
void main(){vec3 b=vec3(1.0-vBary.x-vBary.y,vBary);vec2 uv=uvAt(vFace,0)*b.x+uvAt(vFace,1)*b.y+uvAt(vFace,2)*b.z;
 vec4 acc=vec4(0);float total=0.0;
 for(int y=-4;y<=4;y++)for(int x=-4;x<=4;x++){vec2 p=vec2(x,y)/4.0;float weight=uBox==1?1.0:exp(-dot(p,p)*4.5);
 vec2 tap=walkUV(vFace,b,baryUV(vFace,uv+p*uRadius/uSize));acc+=textureLod(uSrc,tap,0.0)*weight;total+=weight;}
 o=acc/total;}`;
function seamBlurDispose(){if(!seamBlurCache)return;const c=seamBlurCache;gl.deleteTexture(c.tex);gl.deleteBuffer(c.vb);gl.deleteVertexArray(c.vao);if(c.pad)disposeTarget(c.pad);seamBlurCache=null;}
function seamBlurMesh(){const m=v3.mesh;if(!m||!v3.gpu||m.noUV||v3s().uvs!==1)return null;const R=p3Range();
 if(seamBlurCache?.mesh===m&&seamBlurCache.start===R.start&&seamBlurCache.count===R.count)return seamBlurCache;
 seamBlurDispose();const n=R.count;if(!n)return null;const width=Math.min(1024,gl.getParameter(gl.MAX_TEXTURE_SIZE)),height=Math.ceil(n*5/width);
 if(height>gl.getParameter(gl.MAX_TEXTURE_SIZE))return null;
 const data=new Float32Array(width*height*4),vertices=new Float32Array(n*3*5),topo=sel3Topo(m);
 for(let i=0;i<n;i++){const t=R.start+i,ids=Array.from(m.idx.subarray(t*3,t*3+3)),uv=ids.map(v=>[m.uv[v*2],m.uv[v*2+1]]);
  /* UDIM/tiled layouts need their own tile-aware topology. Preserve the ordinary filter there. */
  if(uv.some(q=>q.some(v=>v<0||v>1))){return null;}
  data.set([...uv[0],...uv[1]],i*20);data.set([...uv[2],-1,-1],i*20+4);
  let borders=0;for(let k=0;k<3;k++){const v=ids[k];data.set([m.pos[v*3],m.pos[v*3+1],m.pos[v*3+2],k===0?-1:0],i*20+8+k*4);
   const edge=topo.ep.get(topo.ek(topo.pid[ids[(k+1)%3]],topo.pid[ids[(k+2)%3]],topo.NP));
   let continuous=false;
   if(edge?.length===2){const other=edge[0]===t?edge[1]:edge[0];if(other>=R.start&&other<R.start+n){data[i*20+(k===0?6:k===1?7:11)]=other-R.start;
    continuous=true;for(let j=1;j<=2;j++){const v=ids[(k+j)%3];let found=false;
     for(let h=0;h<3;h++){const w=m.idx[other*3+h];if(topo.pid[v]===topo.pid[w]&&Math.abs(m.uv[v*2]-m.uv[w*2])<1e-6&&Math.abs(m.uv[v*2+1]-m.uv[w*2+1])<1e-6){found=true;break;}}
     if(!found){continuous=false;break;}}}}
   if(!continuous)borders|=1<<k;
   vertices.set([...uv[k],i,k===1?1:0,k===2?1:0],(i*3+k)*5);}data[i*20+15]=borders;}
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,width,height,0,gl.RGBA,gl.FLOAT,data);
 for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);
 for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
 const V=gl.createVertexArray(),vb=gl.createBuffer();gl.bindVertexArray(V);gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
 for(const [a,size,off] of [[0,2,0],[1,1,8],[2,2,12]]){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,20,off);}gl.bindVertexArray(vao);
 return seamBlurCache={mesh:m,start:R.start,count:R.count,tex,vao:V,vb};}
/* The view's bilinear and mip reads straddle atlas edges. Keep a short, nearest-island
   apron on filtered output, including transparent layers; alpha is coverage, not a UV mask.
   Encode pixel owners in RGBA8 so 4K/16K coordinates do not lose half-float precision. */
let seamPadPrograms=null;
const SEAM_OWNER_GLSL=`ivec2 ownerAt(sampler2D img,ivec2 p){ivec4 b=ivec4(round(texelFetch(img,p,0)*255.0));return ivec2(b.x*256+b.y,b.z*256+b.w)-1;}
vec4 ownerPack(ivec2 p){ivec2 v=p+1;return vec4(v.x/256,v.x%256,v.y/256,v.y%256)/255.0;}`;
function seamBlurPadding(C,dst,region){if(!seamPadPrograms)seamPadPrograms={
 seed:prog3(VS_SEAMBLUR,SEAM_OWNER_GLSL+`void main(){o=ownerPack(ivec2(gl_FragCoord.xy));}`),
 grow:program(SEAM_OWNER_GLSL+`uniform sampler2D uOwners;
 void main(){ivec2 p=ivec2(gl_FragCoord.xy),size=textureSize(uOwners,0),best=ivec2(-1);float distance=1e20;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ivec2 q=p+ivec2(x,y);if(any(lessThan(q,ivec2(0)))||any(greaterThanEqual(q,size)))continue;
 ivec2 owner=ownerAt(uOwners,q);if(any(lessThan(owner,ivec2(0))))continue;vec2 delta=vec2(owner-p);float d=dot(delta,delta);
 if(d<distance){distance=d;best=owner;}}o=any(lessThan(best,ivec2(0)))?vec4(0):ownerPack(best);}`),
 apply:program(SEAM_OWNER_GLSL+`uniform sampler2D uOwners;uniform sampler2D uSrc;uniform vec2 uOffset;
 void main(){ivec2 p=ivec2(gl_FragCoord.xy)+ivec2(uOffset),owner=ownerAt(uOwners,p);vec2 delta=vec2(owner-p);
 o=texelFetch(uSrc,all(greaterThanEqual(owner,ivec2(0)))&&dot(delta,delta)<=64.0?owner:p,0);}`)};
 if(!C.pad||C.pad.w!==dst.w||C.pad.h!==dst.h){if(C.pad)disposeTarget(C.pad);C.pad=makeTarget(dst.w,dst.h,8,false);
  const tmp=makeTarget(dst.w,dst.h,8,false);try{clearTarget(C.pad,[0,0,0,0]);useProg(seamPadPrograms.seed,{});bindTarget(C.pad);
   gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(C.vao);gl.drawArrays(gl.TRIANGLES,0,C.count*3);gl.bindVertexArray(vao);
   for(let i=0;i<8;i++){run(seamPadPrograms.grow,tmp,{uOwners:C.pad.tex});blit(tmp,C.pad,0,0,dst.w,dst.h,0,0);}
  }finally{disposeTarget(tmp);}}
 const r=region||[0,0,dst.w,dst.h],tmp=makeTarget(r[2],r[3],dst.depth,false,dst.packed,dst.mono);
 try{run(seamPadPrograms.apply,tmp,{uOwners:C.pad.tex,uSrc:dst.tex,uOffset:r.slice(0,2)});blit(tmp,dst,0,0,r[2],r[3],r[0],r[1]);}finally{disposeTarget(tmp);}}
function meshConnectedBlur(src,dst,x,y,box){if(ui.mode!=='p3d'||src.w!==doc.w||src.h!==doc.h||dst.w!==src.w||dst.h!==src.h||!v3.mesh)return false;
 const C=seamBlurMesh();if(!C)return false;if(!seamBlurProgram)seamBlurProgram=prog3(VS_SEAMBLUR,FS_SEAMBLUR);
 /* Preserve atlas pixels outside the mesh. In-place filters borrow their source. */
 let read=src,tmp=null;if(src===dst){tmp=makeTarget(src.w,src.h,src.depth,false,src.packed,src.mono);blit(src,tmp,0,0,src.w,src.h,0,0);read=tmp;}else blit(src,dst,0,0,src.w,src.h,0,0);
 try{useProg(seamBlurProgram,{uFaces:C.tex,uSrc:read.tex,uSize:[src.w,src.h],uRadius:box?[x,y]:[x*3,y*3],uBox:{int:box?1:0}},!!dst.packed);
  bindTarget(dst);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(C.vao);gl.drawArrays(gl.TRIANGLES,0,C.count*3);
 }finally{gl.bindVertexArray(vao);if(tmp)disposeTarget(tmp);}seamBlurPadding(C,dst);return true;}
