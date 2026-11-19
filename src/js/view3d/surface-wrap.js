/* ================= Surface wrap (0.98.13, Kenn: "wrap like Painter") =================
   Tangent | Wrap used to project the brush from the camera: it stopped where the surface turned away, left a gap on walls the camera cannot
   see and broke at seams. Now the brush is measured on the model itself. The stroke runs on the texture like UV alignment, but each dab
   asks every texel where it sits in space (the position picture) and paints by its distance from the dab's centre there. */
/* (0.98.15, Kenn: "the tangent wrap isn't working, go back to the previous version") off unless you turn it on under Projection */
const swOn=()=>ui.mode==='p3d'&&v3s().paintAlign==='wrap'&&v3s().surfWrap!==false;/* (0.98.20) on by default */
/* plain brush and eraser only; stencils, UDIM sets made by tile and the other tools keep the camera projection */
function swUsable(){if(!swOn()||!['brush','erase','dodge','burn','material'].includes(ui.tool))return false;/* (0.98.20) dodge, burn and the material brush too */if(typeof st3!=='undefined'&&st3.img&&st3.mode!=='off')return false;
  if(typeof p3!=='undefined'&&p3.udim)return false;const C=typeof fillPosMaps==='function'?fillPosMaps():null;if(!C||!C.pos||!C.nrm)return false;const U=typeof uvmBuild==='function'&&uvmBuild();return !!(U&&!U.overlap);}
/* the camera's right-hand direction in space, to orient the brush tip */
function swRight(){let e=null,t=null;try{e=v3Eye();t=[v3.cam.tx||0,v3.cam.ty||0,v3.cam.tz||0];}catch(_){}if(!e||!t)return [1,0,0];
  const f=[t[0]-e[0],t[1]-e[1],t[2]-e[2]],r=[f[1]*0-f[2]*1,f[2]*0-f[0]*0,f[0]*1-f[1]*0],l=Math.hypot(r[0],r[1],r[2])||1;return [r[0]/l,r[1]/l,r[2]/l];}
/* ---- (0.98.20, Kenn: "inconsistent brush sizes", "the alignment not matching", "painting on edges isn't working") ----
   The measured causes (tests/e2e/surf9820.cjs, models with real UV layouts): the brush's size on the model came from how densely the
   texture is packed where the stroke STARTED (and where each dab landed), so the same brush was 0.97× on one face and 1.31× on the next,
   and up to 5.7× with paint spilling out of the island on a sparse one. Now:
   - the brush has one size ON THE MODEL (swBaseR, by Size Space), and every dab is that size wherever it lands;
   - while the stroke moves, its size in texture pixels follows the packing under the pointer (swAdapt), so the gaps between dabs stay
     the same on the model too;
   - plain UV alignment uses the same size and is clipped to the model and to the brush's reach in space (no paint in empty texture or on
     a neighbouring island). */
/* the camera's eye and the world size of one screen pixel at distance d */
function swEye(){try{return v3Eye();}catch(e){return [0,0,3];}}
function swPxWorld(d){const hit=document.getElementById('v3Hit'),h=hit?hit.getBoundingClientRect().height||1:1;return 2*d*Math.tan(v3s().fov*Math.PI/360)/h;}
/* world units per texture pixel at a texel (from the position picture), or null off the model */
function swWpt(x,y){const U=uvm;if(!U||!U.P)return null;const c=uvmPos(x,y);if(!c)return null;const e=Math.max(1,doc.w/U.G),l=[];
  /* (0.98.20) one step each way across and down; at an island's edge a step lands on the same sample (zero) or on another island far away
     in space (too long): both are left out, the median of the rest is taken */
  for(const [dx,dy] of [[e,0],[-e,0],[0,e],[0,-e]]){const q=uvmPos(x+dx,y+dy);if(!q)continue;const d=Math.hypot(q[0]-c[0],q[1]-c[1],q[2]-c[2])/e;if(d>1e-7)l.push(d);}
  if(!l.length)return null;l.sort((a,b)=>a-b);const med=l[l.length>>1],ok=l.filter(v=>v>med*.35&&v<med*3);return ok.length?ok.reduce((a,b)=>a+b,0)/ok.length:null;}
/* the brush's radius on the model (world units) at full size, by Size Space: Object = fixed on the model, Viewport = screen pixels at the
   point's distance, Texture = texture pixels where it lands */
function swBaseR(o,c,x,y){const half=(o.size||brush.size)/2,sp=v3s().sizeSpace||'object';
  if(sp==='viewport'&&c){const e=swEye();return half*swPxWorld(Math.hypot(c[0]-e[0],c[1]-e[1],c[2]-e[2]));}
  if(sp==='texture'){const w=swWpt(x,y);if(w)return half*w;}
  return half*(v3.mesh&&v3.mesh.radius||1)/256;}
/* while the stroke moves: its radius in texture pixels follows the packing under the pointer */
function swAdapt(s,x,y){if(!s||!s.o||!uvm.P)return;const c=uvmPos(x,y),w=swWpt(x,y);if(!c||!w)return;const R=swBaseR(s.o,c,x,y),half=(s.o.size||brush.size)/2,rs=Math.max(.02,R/w/half);
  /* a step never changes the size more than 1.5× (packing changes over a few texels; a bad sample must not blow the brush up) */
  s.rs=s.rs>0?clamp(rs,s.rs/1.5,s.rs*1.5):rs;s.swR=R;}
/* (0.98.20) how far the paint goes round an edge, from Projection's Backface culling: the angle (only when set under 90°, a 90° edge is painted
   round like Painter's Tangent | Wrap), faded over the Edge falloff; culling off = no limit */
function swCull(){const s=v3s();if(s.noBack===false)return [-2,0];const a=clamp(s.cullAngle==null?90:+s.cullAngle,1,90),soft=(typeof meshCullSoft==='function'?meshCullSoft():.3)*.6;
  return [a<89.5?Math.cos(a*Math.PI/180):-0.15,soft];}
/* one dab at a texel: the uniforms for the shader and the box of texels it can reach */
function swDab(s,x,y,r,ext,clipOnly){const U=uvm,C=fillPosMaps();if(!U||!U.P||!C||!C.pos||!C.nrm)return null;const c=uvmPos(x,y);if(!c)return null;
  const e=Math.max(1,doc.w/U.G),wpt=swWpt(x,y);if(!(wpt>1e-9))return null;
  /* the dab's radius on the model: the brush's size there, times this dab's share of it (pressure, jitter) */
  const half=(s.o.size||brush.size)/2*(s.rs||1),Rw=swBaseR(s.o,c,x,y)*(r/Math.max(half,1e-3)),Rx=Rw*(ext/Math.max(r,1e-3));
  if(clipOnly){const R=Math.max(Rx,Rw*1.3);return {rect:null,u:{uSurf:{int:2},uPosT:C.pos.tex,uNrmT:C.nrm.tex,uSC:c,uSR:s.surf?s.surf.right:[1,0,0],uSW:R}};}
  const c0=[0,1,2].map(k=>Math.floor((c[k]-Rx-U.lo[k])/U.cell)),c1=[0,1,2].map(k=>Math.floor((c[k]+Rx-U.lo[k])/U.cell));
  let x0=1e9,y0=1e9,x1=-1,y1=-1;const R2=Rx*Rx,hits=[];
  const take=q=>{const dx=U.P[q*4]-c[0],dy=U.P[q*4+1]-c[1],dz=U.P[q*4+2]-c[2];if(dx*dx+dy*dy+dz*dz>R2)return;const X=(q%U.G+.5)/U.G*doc.w,Yp=(((q/U.G)|0)+.5)/U.H*doc.h;hits.push(X,Yp);
    if(X<x0)x0=X;if(X>x1)x1=X;if(Yp<y0)y0=Yp;if(Yp>y1)y1=Yp;};
  /* (0.98.20) a big brush reaches more cells than is worth visiting one by one (it gave up and fell back to a flat stamp): look at every sample instead */
  if((c1[0]-c0[0]+1)*(c1[1]-c0[1]+1)*(c1[2]-c0[2]+1)>20000){for(let q=0;q<U.G*U.H;q++)if(U.P[q*4+3]>=.5)take(q);}
  else for(let i=c0[0];i<=c1[0];i++)for(let j=c0[1];j<=c1[1];j++)for(let k=c0[2];k<=c1[2];k++)for(let q=U.head[U.hash(i,j,k)];q>=0;q=U.next[q])take(q);
  if(x1<0)return null;const pad=e*1.5+2;x0=Math.max(0,Math.floor(x0-pad));y0=Math.max(0,Math.floor(y0-pad));x1=Math.min(doc.w,Math.ceil(x1+pad));y1=Math.min(doc.h,Math.ceil(y1+pad));
  if(x1<=x0||y1<=y0)return null;
  /* (0.98.22, Georgian: dabs of 0.4–1.2 s at 8K) a dab that reaches across a seam touches patches far apart on the texture: one box round all
     of them covered the whole width between. Now each patch gets its own box (connected cells of the texture). */
  let rects=null;{const C=Math.max(32,pad*2),key=new Map();for(let i=0;i<hits.length;i+=2)key.set(Math.floor(hits[i]/C)+','+Math.floor(hits[i+1]/C),[Math.floor(hits[i]/C),Math.floor(hits[i+1]/C)]);
    if(key.size>1){const seen=new Set(),out=[];for(const [k,[cx,cy]] of key){if(seen.has(k))continue;let b=[cx,cy,cx,cy];const st=[[cx,cy]];seen.add(k);
        while(st.length){const [a,bq]=st.pop();b=[Math.min(b[0],a),Math.min(b[1],bq),Math.max(b[2],a),Math.max(b[3],bq)];for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const k2=(a+i)+','+(bq+j);if(key.has(k2)&&!seen.has(k2)){seen.add(k2);st.push([a+i,bq+j]);}}}
        out.push([Math.max(0,Math.floor(b[0]*C-pad)),Math.max(0,Math.floor(b[1]*C-pad)),Math.min(doc.w,Math.ceil((b[2]+1)*C+pad)),Math.min(doc.h,Math.ceil((b[3]+1)*C+pad))]);}
      const area=r=>(r[2]-r[0])*(r[3]-r[1]);if(out.length>1&&out.length<=12&&out.reduce((s,r)=>s+area(r),0)<area([x0,y0,x1,y1])*.7)rects=out;}}
  if(window.__swDebug)window.__swDebug.push({x,y,c,Rw,wpt,r,ext,rect:[x0,y0,x1,y1],rects});
  return {rect:[x0,y0,x1,y1],rects,u:{uSurf:{int:1},uPosT:C.pos.tex,uNrmT:C.nrm.tex,uSC:c,uSR:s.surf.right,uSW:Rw,uSurfCull:swCull(),uQuad:{int:1},uQC:[(x0+x1)/2,(y0+y1)/2],uQE:[(x1-x0)/2,(y1-y0)/2]}};}
