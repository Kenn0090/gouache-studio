/* ================= Seam-aware Warp (0.96.1, Kenn: "the UVs are breaking … even with warps") =================
   A Warp row used to push each pixel along a noise drawn on the flat texture, so the two sides of a UV seam moved in
   different directions and the pattern stopped matching. On a model it now works on the surface itself: the push is a
   3D noise over the model (the same on both sides of a seam), flattened onto the surface, and the read point walks across
   welded edges into the next UV island (the same walk the seam-aware blur uses). The push matches the old one in pixels. */
const FS_SEAMWARP=FS_SEAMBLUR.slice(0,FS_SEAMBLUR.indexOf('void main()'))+MS_NOISE_GLSL+`
uniform float uAmt; uniform float uFreq; uniform vec3 uBmin; uniform float uBsz;
void main(){vec3 b=vec3(1.0-vBary.x-vBary.y,vBary);int t=vFace;
 vec3 A=pointAt(t,0),B=pointAt(t,1),C=pointAt(t,2),p=A*b.x+B*b.y+C*b.z,nn=cross(B-A,C-A);float a3=length(nn);vec3 n=nn/max(a3,1e-12);
 vec2 ua=uvAt(t,0)*uSize,ub=uvAt(t,1)*uSize,uc=uvAt(t,2)*uSize;float aUV=abs((ub.x-ua.x)*(uc.y-ua.y)-(ub.y-ua.y)*(uc.x-ua.x));
 float perPx=sqrt(a3/max(aUV,1e-12));
 vec3 q=(p-uBmin)/max(uBsz,1e-6)*uFreq;
 vec3 d=vec3(fbm(q),fbm(q+vec3(5.2,1.3,7.7)),fbm(q+vec3(2.9,8.4,3.3)))-0.5;d-=n*dot(d,n);
 vec3 target=p+d*uAmt*8.0*perPx;
 vec2 tap=walkUV(t,b,baryWorld(t,target));o=textureLod(uSrc,tap,0.0);}`;
let seamWarpProgram=null;
function meshConnectedWarp(src,dst,amt,scale,seed){if(ui.mode!=='p3d'||!v3.mesh||src===dst||src.w!==doc.w||src.h!==doc.h||dst.w!==src.w||dst.h!==src.h||Math.abs(amt)<1e-4)return false;
 const C=seamBlurMesh();if(!C)return false;if(!seamWarpProgram)seamWarpProgram=prog3(VS_SEAMBLUR,FS_SEAMWARP);
 const m=v3.mesh;if(!m._bb)msSurf();const bb=m._bb||{mn:[0,0,0],sz:[1,1,1]};
 blit(src,dst,0,0,src.w,src.h,0,0);/* pixels outside the model stay as they were */
 try{useProg(seamWarpProgram,{uFaces:C.tex,uSrc:src.tex,uSize:[src.w,src.h],uRadius:[0,0],uBox:{int:0},uAmt:amt,uFreq:scale,uSeed:seed,uBmin:bb.mn,uBsz:Math.max(...bb.sz)},!!dst.packed);
  bindTarget(dst);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(C.vao);gl.drawArrays(gl.TRIANGLES,0,C.count*3);}
 finally{gl.bindVertexArray(vao);}seamBlurPadding(C,dst);return true;}
