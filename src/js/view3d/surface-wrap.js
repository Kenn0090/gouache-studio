/* ================= Surface wrap (0.98.13, Kenn: "wrap like Painter") =================
   Tangent | Wrap used to project the brush from the camera: it stopped where the surface turned away, left a gap on walls the camera cannot
   see and broke at seams. Now the brush is measured on the model itself. The stroke runs on the texture like UV alignment, but each dab
   asks every texel where it sits in space (the position picture) and paints by its distance from the dab's centre there. */
const swOn=()=>ui.mode==='p3d'&&v3s().paintAlign==='wrap'&&v3s().surfWrap!==false;
/* plain brush and eraser only; stencils, UDIM sets made by tile and the other tools keep the camera projection */
function swUsable(){if(!swOn()||!['brush','erase'].includes(ui.tool))return false;if(typeof st3!=='undefined'&&st3.img&&st3.mode!=='off')return false;
  if(typeof p3!=='undefined'&&p3.udim)return false;const C=typeof fillPosMaps==='function'?fillPosMaps():null;if(!C||!C.pos||!C.nrm)return false;return !!(typeof uvmBuild==='function'&&uvmBuild());}
/* the camera's right-hand direction in space, to orient the brush tip */
function swRight(){let e=null,t=null;try{e=v3Eye();t=[v3.cam.tx||0,v3.cam.ty||0,v3.cam.tz||0];}catch(_){}if(!e||!t)return [1,0,0];
  const f=[t[0]-e[0],t[1]-e[1],t[2]-e[2]],r=[f[1]*0-f[2]*1,f[2]*0-f[0]*0,f[0]*1-f[1]*0],l=Math.hypot(r[0],r[1],r[2])||1;return [r[0]/l,r[1]/l,r[2]/l];}
/* one dab at a texel: the uniforms for the shader and the box of texels it can reach */
function swDab(s,x,y,r,ext){const U=uvm,C=fillPosMaps();if(!U||!U.P||!C||!C.pos||!C.nrm)return null;const c=uvmPos(x,y);if(!c)return null;
  const e=Math.max(1,doc.w/U.G),a=uvmPos(x+e,y)||c,b=uvmPos(x,y+e)||c,wpt=(Math.hypot(a[0]-c[0],a[1]-c[1],a[2]-c[2])+Math.hypot(b[0]-c[0],b[1]-c[1],b[2]-c[2]))/(2*e);
  if(!(wpt>1e-9))return null;const Rw=r*wpt,Rx=Rw*(ext/Math.max(r,1e-3));
  const c0=[0,1,2].map(k=>Math.floor((c[k]-Rx-U.lo[k])/U.cell)),c1=[0,1,2].map(k=>Math.floor((c[k]+Rx-U.lo[k])/U.cell));
  if((c1[0]-c0[0]+1)*(c1[1]-c0[1]+1)*(c1[2]-c0[2]+1)>20000)return null;
  let x0=1e9,y0=1e9,x1=-1,y1=-1;const R2=Rx*Rx;
  for(let i=c0[0];i<=c1[0];i++)for(let j=c0[1];j<=c1[1];j++)for(let k=c0[2];k<=c1[2];k++)for(let q=U.head[U.hash(i,j,k)];q>=0;q=U.next[q]){
    const dx=U.P[q*4]-c[0],dy=U.P[q*4+1]-c[1],dz=U.P[q*4+2]-c[2];if(dx*dx+dy*dy+dz*dz>R2)continue;const X=(q%U.G+.5)/U.G*doc.w,Y=((q/U.G)|0)+.5;const Yp=Y/U.H*doc.h;
    if(X<x0)x0=X;if(X>x1)x1=X;if(Yp<y0)y0=Yp;if(Yp>y1)y1=Yp;}
  if(x1<0)return null;const pad=e*1.5+2;x0=Math.max(0,Math.floor(x0-pad));y0=Math.max(0,Math.floor(y0-pad));x1=Math.min(doc.w,Math.ceil(x1+pad));y1=Math.min(doc.h,Math.ceil(y1+pad));
  if(x1<=x0||y1<=y0)return null;
  if(window.__swDebug)window.__swDebug.push({x,y,c,Rw,wpt,r,ext,rect:[x0,y0,x1,y1]});
  return {rect:[x0,y0,x1,y1],u:{uSurf:{int:1},uPosT:C.pos.tex,uNrmT:C.nrm.tex,uSC:c,uSR:s.surf.right,uSW:Rw,uQuad:{int:1},uQC:[(x0+x1)/2,(y0+y1)/2],uQE:[(x1-x0)/2,(y1-y0)/2]}};}
