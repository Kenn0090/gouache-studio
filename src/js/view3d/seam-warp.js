/* ================= Seam-aware Warp (0.96.1, Kenn: "the UVs are breaking … even with warps") =================
   A Warp row used to push each pixel along a noise drawn on the flat texture, so the two sides of a UV seam moved in
   different directions and the pattern stopped matching. On a model it now works on the surface itself: the push is a
   3D noise over the model (the same on both sides of a seam), flattened onto the surface, and the read point walks across
   welded edges into the next UV island (the same walk the seam-aware blur uses). The push matches the old one in pixels. */
const FS_SEAMWARP=FS_SEAMBLUR.slice(0,FS_SEAMBLUR.indexOf('void main()'))+MS_NOISE_GLSL+`
uniform float uAmt; uniform float uFreq; uniform vec3 uBmin; uniform float uBsz; uniform int uWorldDistance;
void main(){vec3 b=vec3(1.0-vBary.x-vBary.y,vBary);int t=vFace;
 vec3 A=pointAt(t,0),B=pointAt(t,1),C=pointAt(t,2),p=A*b.x+B*b.y+C*b.z,nn=cross(B-A,C-A);float a3=length(nn);vec3 n=nn/max(a3,1e-12);
 vec2 ua=uvAt(t,0)*uSize,ub=uvAt(t,1)*uSize,uc=uvAt(t,2)*uSize;float aUV=abs((ub.x-ua.x)*(uc.y-ua.y)-(ub.y-ua.y)*(uc.x-ua.x));
 float perPx=sqrt(a3/max(aUV,1e-12));
 vec3 q=(p-uBmin)/max(uBsz,1e-6)*uFreq;
 vec3 d=vec3(fbm(q),fbm(q+vec3(5.2,1.3,7.7)),fbm(q+vec3(2.9,8.4,3.3)))-0.5;d-=n*dot(d,n);
 float distance=uAmt*(uWorldDistance==1?uBsz:8.0*perPx);
 vec3 target=p+d*distance;
 vec2 tap=walkUV(t,b,baryWorld(t,target));o=textureLod(uSrc,tap,0.0);}`;
let seamWarpProgram=null;
/* worldDistance expresses the amount as a fraction of the model's bounds, independent of UV density. */
function meshConnectedWarp(src,dst,amt,scale,seed,worldDistance=false){if(ui.mode!=='p3d'||!v3.mesh||src===dst||src.w!==doc.w||src.h!==doc.h||dst.w!==src.w||dst.h!==src.h||Math.abs(amt)<1e-4)return false;
 const C=seamBlurMesh();if(!C)return false;if(!seamWarpProgram)seamWarpProgram=prog3(VS_SEAMBLUR,FS_SEAMWARP);
 const m=v3.mesh;if(!m._bb)msSurf();const bb=m._bb||{mn:[0,0,0],sz:[1,1,1]};
 blit(src,dst,0,0,src.w,src.h,0,0);/* pixels outside the model stay as they were */
 try{useProg(seamWarpProgram,{uFaces:C.tex,uSrc:src.tex,uSize:[src.w,src.h],uRadius:[0,0],uBox:{int:0},uAmt:amt,uFreq:scale,uSeed:seed,uBmin:bb.mn,uBsz:Math.max(...bb.sz),uWorldDistance:{int:worldDistance?1:0}},!!dst.packed);
  bindTarget(dst);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(C.vao);gl.drawArrays(gl.TRIANGLES,0,C.count*3);}
 finally{gl.bindVertexArray(vao);}seamBlurPadding(C,dst);return true;}
/* (0.96.1, Kenn: "make slope blur seam-safe too") Slope blur on the model's surface: the slope (of a 3D noise, of
   the picture itself, or of a chosen picture) is measured on the triangle in 3D, and each step of the smear walks
   across UV seams to the texel that really lies next to it on the model. Same results as the flat one inside an island. */
const FS_SEAMSLOPE=FS_SEAMBLUR.slice(0,FS_SEAMBLUR.indexOf('void main()'))+MS_NOISE_GLSL+FXD_SLOPE_INFLUENCE+`
uniform float uAmt; uniform int uSteps; uniform int uMode; uniform int uGuide; uniform float uFreq; uniform vec3 uBmin; uniform float uBsz;
uniform sampler2D uGImg; uniform float uGTile; uniform float uGInv; uniform float uEdge;
int sT; vec3 sB; vec3 sA,sB3,sC;
vec2 tapAt(vec3 x){ return walkUV(sT,sB,baryWorld(sT,x)); }
float lum(vec4 c){ return dot(c.rgb,vec3(0.299,0.587,0.114))*c.a; }
float gd(vec3 x){ if(uGuide==1) return fbm((x-uBmin)/max(uBsz,1e-6)*uFreq);
  vec2 u=tapAt(x); if(uGuide==2){ float l=lum(textureLod(uGImg,fract(u*uGTile),0.0)); return uGInv>0.5?1.0-l:l; } return lum(textureLod(uSrc,u,0.0)); }
void main(){ vec3 b=vec3(1.0-vBary.x-vBary.y,vBary); sT=vFace; sB=b;
  vec2 uv=gl_FragCoord.xy/uSize; float weight=slopeInfluence(uv);
  if(weight<=0.0){ o=textureLod(uSrc,uv,0.0); return; }
  vec3 A=pointAt(sT,0),B=pointAt(sT,1),C=pointAt(sT,2),p=A*b.x+B*b.y+C*b.z,nn=cross(B-A,C-A); float a3=length(nn); vec3 n=nn/max(a3,1e-12);
  vec2 ua=uvAt(sT,0)*uSize,ub=uvAt(sT,1)*uSize,uc=uvAt(sT,2)*uSize; float aUV=abs((ub.x-ua.x)*(uc.y-ua.y)-(ub.y-ua.y)*(uc.x-ua.x));
  float perPx=sqrt(a3/max(aUV,1e-12));
  vec3 e1=normalize(B-A+vec3(1e-12)),e2=cross(n,e1); float h=uGuide==1?0.08*uBsz/max(uFreq,1e-3):uEdge*perPx;
  vec3 g=e1*(gd(p+e1*h)-gd(p-e1*h))+e2*(gd(p+e2*h)-gd(p-e2*h));
  vec3 dir=length(g)>1e-7?-normalize(g):vec3(0.0);
  vec4 acc=textureLod(uSrc,seamReadUV(sT,b),0.0),mn=acc,mx=acc; float k=1.0;
  for(int i=1;i<=64;i++){ if(i>uSteps) break; vec4 c=textureLod(uSrc,tapAt(p+dir*uAmt*perPx*float(i)/float(uSteps)),0.0); acc+=c; k+=1.0; mn=min(mn,c); mx=max(mx,c); }
  o=uMode==1?mn:uMode==2?mx:acc/k;
  if(weight<1.0) o=mix(textureLod(uSrc,uv,0.0),o,weight); }`;
let seamSlopeProgram=null;
/* o: {amt (texels), steps, mode 0 blur / 1 min / 2 max, guide 0 its own slope / 1 noise / 2 picture, freq (noise, per model size), gimg, gtile, ginv} */
function meshConnectedSlope(src,dst,o){if(ui.mode!=='p3d'||!v3.mesh||src===dst||src.w!==doc.w||src.h!==doc.h||dst.w!==src.w||dst.h!==src.h||!(Math.abs(o.amt)>1e-4))return false;
  const C=seamBlurMesh();if(!C)return false;if(!seamSlopeProgram)seamSlopeProgram=prog3(VS_SEAMBLUR,FS_SEAMSLOPE);
  const m=v3.mesh;if(!m._bb)msSurf();const bb=m._bb||{mn:[0,0,0],sz:[1,1,1]};
  blit(src,dst,0,0,src.w,src.h,0,0);
  try{useProg(seamSlopeProgram,{uFaces:C.tex,uSrc:src.tex,uSize:[src.w,src.h],uRadius:[0,0],uBox:{int:0},uAmt:o.amt,uSteps:{int:Math.max(1,Math.min(64,Math.round(o.steps||16)))},
      uMode:{int:o.mode|0},uGuide:{int:(o.guide===2&&!o.gimg)?0:o.guide|0},uFreq:o.freq||6,uSeed:o.seed||1,uBmin:bb.mn,uBsz:Math.max(...bb.sz),
      uGImg:(o.gimg||src).tex,uGTile:o.gtile||1,uGInv:o.ginv?1:0,uEdge:1.5,
      ...fxdSlopeInfluenceU(o.influence,o.invertInfluence)},!!dst.packed);
    bindTarget(dst);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(C.vao);gl.drawArrays(gl.TRIANGLES,0,C.count*3);}
  finally{gl.bindVertexArray(vao);}seamBlurPadding(C,dst);return true;}
