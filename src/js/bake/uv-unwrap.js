/* ================= Automatic UV unwrap (0.54) =================
   Kenn: "add a UV detection when you import a model ... if it doesn't have one, an auto unwrap, which you can review in the
   Bake section and randomize with a seed so it can repack."
   The classic recipe (the same steps xatlas, Blender's Smart UV Project and most game-tool unwrappers follow):
     1. cut the model into charts: grow each chart triangle by triangle while the surface keeps facing roughly the same way
        and the chart stays a flat-able disk (no holes, no pinched corners); merge tiny charts into a neighbour
     2. flatten each chart: a straight projection when it is nearly flat, otherwise LSCM (least squares conformal maps,
        Levy 2002) started from the projection; a chart that would fold over falls back to the projection
     3. give every chart the same texel density, turn it to the tightest box, and pack the boxes into the 0-1 square
        (MaxRects, Jukka Jylanki 2010), keeping a gap that grows with the texture size so mipmaps do not bleed
   The seed changes the order charts are started in and the order boxes are packed in, so each seed is a different, valid layout.
   Everything here is plain functions on a mesh (pos, nrm, uv, idx, triMat, ...) with no drawing. */
function uwRng(seed){let s=(seed>>>0)||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
const uwYield=()=>new Promise(r=>setTimeout(r,0));
/* ---- topology: weld vertices that sit at the same place, find each triangle's neighbours ---- */
function uwTopo(m){const P=m.pos,I=m.idx,T=I.length/3,N=P.length/3,q=1e5,wmap=new Map(),wv=new Uint32Array(N);let W=0;
  for(let i=0;i<N;i++){const k=Math.round(P[i*3]*q)+','+Math.round(P[i*3+1]*q)+','+Math.round(P[i*3+2]*q);let w=wmap.get(k);if(w===undefined){w=W++;wmap.set(k,w);}wv[i]=w;}
  const tw=new Uint32Array(T*3),area=new Float32Array(T),nx=new Float32Array(T),ny=new Float32Array(T),nz=new Float32Array(T),deg=new Uint8Array(T);
  for(let t=0;t<T;t++){const a=I[t*3],b=I[t*3+1],c=I[t*3+2];tw[t*3]=wv[a];tw[t*3+1]=wv[b];tw[t*3+2]=wv[c];
    const ux=P[b*3]-P[a*3],uy=P[b*3+1]-P[a*3+1],uz=P[b*3+2]-P[a*3+2],vx=P[c*3]-P[a*3],vy=P[c*3+1]-P[a*3+1],vz=P[c*3+2]-P[a*3+2];
    const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx,l=Math.hypot(cx,cy,cz);area[t]=l/2;
    if(l<1e-12||tw[t*3]===tw[t*3+1]||tw[t*3+1]===tw[t*3+2]||tw[t*3]===tw[t*3+2]){deg[t]=1;nx[t]=0;ny[t]=0;nz[t]=1;}else{nx[t]=cx/l;ny[t]=cy/l;nz[t]=cz/l;}}
  /* neighbours across each edge (edge k runs from corner k to corner k+1); an edge shared by more than two triangles counts as open */
  const adj=new Int32Array(T*3).fill(-1),em=new Map(),B=67108864;
  for(let t=0;t<T;t++){if(deg[t])continue;for(let k=0;k<3;k++){const a=tw[t*3+k],b=tw[t*3+(k+1)%3],key=a<b?a*B+b:b*B+a,e=em.get(key);
    if(e===undefined)em.set(key,t*3+k);else if(e>=0){const u=e;adj[t*3+k]=(u/3)|0;adj[u]=t;em.set(key,-1);}}}
  /* a non-manifold edge was marked -1 above only after pairing the first two; clear pairs that turned out to have a third triangle */
  const cnt=new Map();for(let t=0;t<T;t++){if(deg[t])continue;for(let k=0;k<3;k++){const a=tw[t*3+k],b=tw[t*3+(k+1)%3],key=a<b?a*B+b:b*B+a;cnt.set(key,(cnt.get(key)||0)+1);}}
  for(let t=0;t<T;t++){if(deg[t])continue;for(let k=0;k<3;k++){if(adj[t*3+k]<0)continue;const a=tw[t*3+k],b=tw[t*3+(k+1)%3],key=a<b?a*B+b:b*B+a;if(cnt.get(key)>2)adj[t*3+k]=-1;}}
  return {T,W,wv,tw,area,nx,ny,nz,deg,adj};}
const uwEdgeLen=(P,I,t,k)=>{const a=I[t*3+k],b=I[t*3+(k+1)%3];return Math.hypot(P[a*3]-P[b*3],P[a*3+1]-P[b*3+1],P[a*3+2]-P[b*3+2]);};
/* ---- a small binary heap of [cost, triangle] ---- */
function uwHeap(){const c=[],t=[];return {size:()=>c.length,push(cost,tri){let i=c.length;c.push(cost);t.push(tri);while(i>0){const p=(i-1)>>1;if(c[p]<=c[i])break;[c[p],c[i]]=[c[i],c[p]];[t[p],t[i]]=[t[i],t[p]];i=p;}},
  pop(){const r=[c[0],t[0]],lc=c.pop(),lt=t.pop();if(c.length){c[0]=lc;t[0]=lt;let i=0;for(;;){let l=i*2+1,rr=l+1,s=i;if(l<c.length&&c[l]<c[s])s=l;if(rr<c.length&&c[rr]<c[s])s=rr;if(s===i)break;[c[s],c[i]]=[c[i],c[s]];[t[s],t[i]]=[t[i],t[s]];i=s;}}return r;}};}
/* ---- 1. charts ---- */
function uwSegment(m,topo,opt,rng){const {T,tw,area,nx,ny,nz,deg,adj}=topo,P=m.pos,I=m.idx,cone=Math.cos(opt.angle*Math.PI/180),sharp=Math.cos(Math.max(20,opt.angle-6)*Math.PI/180);
  const chart=new Int32Array(T).fill(-1),charts=[],mat=m.triMat||null;
  /* start charts from the biggest triangles first, with the seed shaking the order */
  const order=[];for(let t=0;t<T;t++)if(!deg[t])order.push(t);const key=new Float32Array(T);for(const t of order)key[t]=area[t]*(0.55+0.9*rng());order.sort((a,b)=>key[b]-key[a]);
  for(const s of order){if(chart[s]>=0)continue;const id=charts.length,C={id,tris:[],mat:mat?mat[s]:0,nx:0,ny:0,nz:0,area:0},touched=new Set(),bc=new Map(),heap=uwHeap();
    const bump=(v,d)=>{bc.set(v,(bc.get(v)||0)+d);};
    const add=t=>{let shared=0;const e=[];for(let k=0;k<3;k++){const nb=adj[t*3+k],sh=nb>=0&&chart[nb]===id;e.push(sh);if(sh)shared++;
        const a=tw[t*3+k],b=tw[t*3+(k+1)%3];if(sh){bump(a,-1);bump(b,-1);}else{bump(a,1);bump(b,1);}}
      chart[t]=id;C.tris.push(t);C.nx+=nx[t]*area[t];C.ny+=ny[t]*area[t];C.nz+=nz[t]*area[t];C.area+=area[t];for(let k=0;k<3;k++)touched.add(tw[t*3+k]);
      for(let k=0;k<3;k++){const nb=adj[t*3+k];if(nb>=0&&chart[nb]<0&&!deg[nb]&&(!mat||mat[nb]===C.mat))push(nb,t);}};
    const costOf=(t,from)=>{const l=Math.hypot(C.nx,C.ny,C.nz)||1,d=(nx[t]*C.nx+ny[t]*C.ny+nz[t]*C.nz)/l;if(d<cone)return -1;
      if(from>=0&&nx[t]*nx[from]+ny[t]*ny[from]+nz[t]*nz[from]<sharp)return -1;return (1-d)*2+(1-Math.min(1,area[t]/(C.area/Math.max(1,C.tris.length))))*0.02;};
    /* may this triangle join without leaving a hole or a pinched corner? */
    const fits=t=>{const sh=[];let n=0;for(let k=0;k<3;k++){const nb=adj[t*3+k];const s=nb>=0&&chart[nb]===id;sh.push(s);if(s)n++;}if(!n)return false;
      if(n===1){const k=sh.indexOf(true),w=tw[t*3+(k+2)%3];return !touched.has(w);}
      if(n===2){const k=sh.indexOf(false),y=tw[t*3+(k+2)%3];/* the corner the two shared edges meet at */return (bc.get(y)||0)===2;}
      return true;};
    const push=(t,from)=>{const c=costOf(t,from);if(c>=0)heap.push(c,t*3+0);};
    add(s);
    while(heap.size()){const [, tt]=heap.pop(),t=(tt/3)|0;if(chart[t]>=0)continue;if(!fits(t))continue;
      /* the neighbour it grows from decides the sharp-edge test again with today's normal */
      let ok=false;for(let k=0;k<3;k++){const nb=adj[t*3+k];if(nb>=0&&chart[nb]===id&&nx[t]*nx[nb]+ny[t]*ny[nb]+nz[t]*nz[nb]>=sharp){ok=true;break;}}if(!ok)continue;
      if(costOf(t,-1)<0)continue;add(t);}
    charts.push(C);}
  /* triangles with no area ride along with a neighbour's chart (or get a chart of their own) so every corner gets a UV */
  for(let t=0;t<T;t++){if(chart[t]>=0)continue;let h=-1;for(let k=0;k<3&&h<0;k++){const nb=adj[t*3+k];if(nb>=0&&chart[nb]>=0)h=chart[nb];}chart[t]=-2;}
  return {chart,charts};}
/* ---- merge tiny charts into a neighbour when the result is still one disk and faces about the same way ---- */
function uwMerge(m,topo,seg,opt){const {T,tw,area,deg,adj}=topo,{chart,charts}=seg,cone=Math.cos((opt.angle+8)*Math.PI/180),mat=m.triMat||null;
  const tot=charts.reduce((s,c)=>s+c.area,0),small=Math.max(opt.minTris||6,T*0.002),smallA=tot*0.004;
  const alive=charts.filter(c=>c.tris.length);
  /* V, E, F of a chart (welded), to tell a disk from anything else */
  const stats=C=>{const V=new Set(),E=new Set();for(const t of C.tris)for(let k=0;k<3;k++){const a=tw[t*3+k],b=tw[t*3+(k+1)%3];V.add(a);E.add(a<b?a*67108864+b:b*67108864+a);}return {V,E};};
  for(const C of alive)C.st=null;
  const byArea=alive.slice().sort((a,b)=>a.area-b.area);
  for(const C of byArea){if(!C.tris.length||(C.tris.length>=small&&C.area>=smallA))continue;
    /* neighbours and how long the shared border is */
    const nb=new Map();for(const t of C.tris)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0)continue;const oc=chart[o];if(oc===C.id||oc<0)continue;nb.set(oc,(nb.get(oc)||0)+1);}
    const cand=[...nb].sort((a,b)=>b[1]-a[1]);
    for(const [oid] of cand){const D=charts[oid];if(!D.tris.length||D.mat!==C.mat)continue;
      const lc=Math.hypot(C.nx,C.ny,C.nz)||1,ld=Math.hypot(D.nx,D.ny,D.nz)||1;if((C.nx*D.nx+C.ny*D.ny+C.nz*D.nz)/(lc*ld)<cone)continue;
      const a=C.st||(C.st=stats(C)),b=D.st||(D.st=stats(D));let sv=0;for(const v of a.V)if(b.V.has(v))sv++;let se=0;for(const e of a.E)if(b.E.has(e))se++;
      const V=a.V.size+b.V.size-sv,E=a.E.size+b.E.size-se,F=C.tris.length+D.tris.length;if(V-E+F!==1)continue;
      for(const t of C.tris){chart[t]=D.id;D.tris.push(t);}D.nx+=C.nx;D.ny+=C.ny;D.nz+=C.nz;D.area+=C.area;for(const v of a.V)b.V.add(v);for(const e of a.E)b.E.add(e);C.tris=[];break;}}
  seg.charts=charts.filter(c=>c.tris.length);seg.charts.forEach((c,i)=>{c.id=i;for(const t of c.tris)chart[t]=i;});return seg;}
/* ---- 2. flatten one chart ---- */
function uwFlatten(m,topo,C,opt){const P=m.pos,I=m.idx,{tw,deg}=topo,vid=new Map(),cv=[],tr=[];
  for(const t of C.tris){const l=[];for(let k=0;k<3;k++){const w=tw[t*3+k];let i=vid.get(w);if(i===undefined){i=cv.length;vid.set(w,i);cv.push(I[t*3+k]);}l.push(i);}tr.push(l);}
  const n=cv.length,L=Math.hypot(C.nx,C.ny,C.nz)||1,N=[C.nx/L,C.ny/L,C.nz/L];
  /* a flat basis for the chart: u along the chart's longest direction (PCA of the points projected onto the plane) */
  const ref=Math.abs(N[1])<.9?[0,1,0]:[1,0,0];let ux=ref[1]*N[2]-ref[2]*N[1],uy=ref[2]*N[0]-ref[0]*N[2],uz=ref[0]*N[1]-ref[1]*N[0];let ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
  const vx=N[1]*uz-N[2]*uy,vy=N[2]*ux-N[0]*uz,vz=N[0]*uy-N[1]*ux;
  const X=new Float64Array(n),Y=new Float64Array(n);let cx=0,cy=0;
  for(let i=0;i<n;i++){const p=cv[i]*3;X[i]=P[p]*ux+P[p+1]*uy+P[p+2]*uz;Y[i]=P[p]*vx+P[p+1]*vy+P[p+2]*vz;cx+=X[i];cy+=Y[i];}cx/=n;cy/=n;
  let sxx=0,sxy=0,syy=0;for(let i=0;i<n;i++){const a=X[i]-cx,b=Y[i]-cy;sxx+=a*a;sxy+=a*b;syy+=b*b;}
  const th=.5*Math.atan2(2*sxy,sxx-syy),co=Math.cos(th),si=Math.sin(th);
  for(let i=0;i<n;i++){const a=X[i]-cx,b=Y[i]-cy;X[i]=a*co+b*si;Y[i]=-a*si+b*co;}
  /* the largest normal deviation decides whether a straight projection is good enough */
  let dev=1;for(const t of C.tris){const d=(topo.nx[t]*N[0]+topo.ny[t]*N[1]+topo.nz[t]*N[2]);if(d<dev)dev=d;}
  let U=X,V=Y,method='plane';
  if(dev<Math.cos(opt.flat*Math.PI/180)&&n>3&&n<=opt.lscmMax){const r=uwLSCM(m,cv,tr,X,Y,opt);if(r){U=r.u;V=r.v;method='lscm';}}
  /* the surface area in 3D and in the flat chart, so every chart can be given the same texel density */
  let a3=0,a2=0;for(let i=0;i<tr.length;i++){a3+=topo.area[C.tris[i]];const [p,q,r]=tr[i];a2+=Math.abs((U[q]-U[p])*(V[r]-V[p])-(U[r]-U[p])*(V[q]-V[p]))/2;}
  return {verts:cv,tris:tr,u:U,v:V,a3,a2,method};}
/* LSCM with two pinned corners (the farthest pair of the projection), solved by preconditioned conjugate gradients; null when it folds over */
function uwLSCM(m,cv,tr,X,Y,opt){const P=m.pos,n=cv.length,T=tr.length;
  /* local 2D frame of each triangle (an exact copy of its shape) */
  const rows=[];for(let i=0;i<T;i++){const [a,b,c]=tr[i],pa=cv[a]*3,pb=cv[b]*3,pc=cv[c]*3;
    const ex=P[pb]-P[pa],ey=P[pb+1]-P[pa+1],ez=P[pb+2]-P[pa+2],fx=P[pc]-P[pa],fy=P[pc+1]-P[pa+1],fz=P[pc+2]-P[pa+2];
    const el=Math.hypot(ex,ey,ez);if(el<1e-12)continue;const x1=0,y1=0,x2=el,y2=0,x3=(ex*fx+ey*fy+ez*fz)/el;const y3=Math.sqrt(Math.max(0,fx*fx+fy*fy+fz*fz-x3*x3));
    const d=x2*y3-x3*y2;if(Math.abs(d)<1e-14)continue;const s=1/Math.sqrt(Math.abs(d));
    rows.push({v:[a,b,c],wr:[(x3-x2)*s,(x1-x3)*s,(x2-x1)*s],wi:[(y3-y2)*s,(y1-y3)*s,(y2-y1)*s]});}
  if(!rows.length)return null;
  /* pin the two vertices farthest apart in the straight projection */
  let p0=0,p1=0,best=-1;{let mi=0,ma=0;for(let i=1;i<n;i++){if(X[i]<X[mi])mi=i;if(X[i]>X[ma])ma=i;}p0=mi;p1=ma;best=Math.hypot(X[p1]-X[p0],Y[p1]-Y[p0]);
    for(let i=0;i<n;i++){const d=Math.hypot(X[i]-X[p0],Y[i]-Y[p0]);if(d>best){best=d;p1=i;}}}
  if(p0===p1||best<1e-9)return null;
  /* unknowns u_i, v_i for every vertex; the pinned ones are held fixed (their gradient is zeroed) */
  const u=Float64Array.from(X),v=Float64Array.from(Y),fixed=new Uint8Array(n);fixed[p0]=1;fixed[p1]=1;
  /* residual rows: Re = sum wr*u - wi*v, Im = sum wi*u + wr*v ; minimise their squares */
  const R=rows.length,res=new Float64Array(R*2),g=new Float64Array(n*2),diag=new Float64Array(n*2);
  for(const r of rows)for(let j=0;j<3;j++){const i=r.v[j];diag[i*2]+=r.wr[j]*r.wr[j]+r.wi[j]*r.wi[j];diag[i*2+1]+=r.wi[j]*r.wi[j]+r.wr[j]*r.wr[j];}
  const Ax=(uu,vv,out)=>{for(let k=0;k<R;k++){const r=rows[k];let re=0,im=0;for(let j=0;j<3;j++){const i=r.v[j];re+=r.wr[j]*uu[i]-r.wi[j]*vv[i];im+=r.wi[j]*uu[i]+r.wr[j]*vv[i];}out[k*2]=re;out[k*2+1]=im;}};
  const ATr=(rr,out)=>{out.fill(0);for(let k=0;k<R;k++){const r=rows[k],re=rr[k*2],im=rr[k*2+1];for(let j=0;j<3;j++){const i=r.v[j];out[i*2]+=r.wr[j]*re+r.wi[j]*im;out[i*2+1]+=-r.wi[j]*re+r.wr[j]*im;}}};
  /* conjugate gradients on the normal equations for the free unknowns */
  const dU=new Float64Array(n),dV=new Float64Array(n),tmp=new Float64Array(R*2),tmp2=new Float64Array(n*2);
  Ax(u,v,res);ATr(res,g);for(let i=0;i<n;i++)if(fixed[i]){g[i*2]=0;g[i*2+1]=0;}
  const z=new Float64Array(n*2),pp=new Float64Array(n*2),Ap=new Float64Array(n*2);let rz=0;
  for(let i=0;i<n*2;i++){z[i]=g[i]/(diag[i]||1);pp[i]=z[i];rz+=g[i]*z[i];}
  const g0=Math.sqrt(g.reduce((s,x)=>s+x*x,0))||1;
  for(let it=0;it<opt.iters&&rz>0;it++){for(let i=0;i<n;i++){dU[i]=pp[i*2];dV[i]=pp[i*2+1];}Ax(dU,dV,tmp);ATr(tmp,Ap);for(let i=0;i<n;i++)if(fixed[i]){Ap[i*2]=0;Ap[i*2+1]=0;}
    let pAp=0;for(let i=0;i<n*2;i++)pAp+=pp[i]*Ap[i];if(pAp<=1e-30)break;const al=rz/pAp;
    for(let i=0;i<n;i++){u[i]-=al*pp[i*2];v[i]-=al*pp[i*2+1];}for(let i=0;i<n*2;i++)g[i]-=al*Ap[i];
    let gn=0,rz2=0;for(let i=0;i<n*2;i++){z[i]=g[i]/(diag[i]||1);rz2+=g[i]*z[i];gn+=g[i]*g[i];}if(Math.sqrt(gn)<g0*1e-5)break;
    const be=rz2/rz;rz=rz2;for(let i=0;i<n*2;i++)pp[i]=z[i]+be*pp[i];}
  /* every triangle must keep the orientation the projection gave it, or the result is thrown away */
  let sign=0;for(const r of rows){const [a,b,c]=r.v;const s0=(X[b]-X[a])*(Y[c]-Y[a])-(X[c]-X[a])*(Y[b]-Y[a]);if(Math.abs(s0)>1e-12){sign=s0>0?1:-1;break;}}
  let bad=0;for(const r of rows){const [a,b,c]=r.v,s1=(u[b]-u[a])*(v[c]-v[a])-(u[c]-u[a])*(v[b]-v[a]);if(sign*s1<=0)bad++;}
  if(bad>0)return null;for(let i=0;i<n;i++)if(!isFinite(u[i])||!isFinite(v[i]))return null;return {u,v};}
/* ---- 3. place every chart: same texel density, tightest box, packed ---- */
function uwHull(pts){const n=pts.length/2,idx=[];for(let i=0;i<n;i++)idx.push(i);idx.sort((a,b)=>pts[a*2]-pts[b*2]||pts[a*2+1]-pts[b*2+1]);
  const cr=(o,a,b)=>(pts[a*2]-pts[o*2])*(pts[b*2+1]-pts[o*2+1])-(pts[a*2+1]-pts[o*2+1])*(pts[b*2]-pts[o*2]),lo=[],up=[];
  for(const i of idx){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],i)<=0)lo.pop();lo.push(i);}
  for(let k=idx.length-1;k>=0;k--){const i=idx[k];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],i)<=0)up.pop();up.push(i);}
  lo.pop();up.pop();return lo.concat(up);}
/* turn a flattened chart to its smallest box; returns the box and the turned points */
function uwFit(F,keepAxes){const n=F.u.length;let pts=new Float64Array(n*2);for(let i=0;i<n;i++){pts[i*2]=F.u[i];pts[i*2+1]=F.v[i];}
  const h=n>2?uwHull(pts):[],cands=[0];if(!keepAxes)for(let k=0;k<h.length;k++){const a=h[k],b=h[(k+1)%h.length],ang=Math.atan2(pts[b*2+1]-pts[a*2+1],pts[b*2]-pts[a*2]);if(isFinite(ang))cands.push(-ang);}
  let best=null;const seen=new Set();for(const ang of cands){const key=Math.round(ang*1000);if(seen.has(key))continue;seen.add(key);const c=Math.cos(ang),s=Math.sin(ang);let x0=1e30,x1=-1e30,y0=1e30,y1=-1e30;
    for(let i=0;i<n;i++){const x=pts[i*2]*c-pts[i*2+1]*s,y=pts[i*2]*s+pts[i*2+1]*c;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    const w=x1-x0,hh=y1-y0,sc=w*hh;if(!best||sc<best.sc-1e-12)best={ang,c,s,x0,y0,w,h:hh,sc};}
  const out=new Float64Array(n*2);for(let i=0;i<n;i++){out[i*2]=pts[i*2]*best.c-pts[i*2+1]*best.s-best.x0;out[i*2+1]=pts[i*2]*best.s+pts[i*2+1]*best.c-best.y0;}
  return {pts:out,w:best.w,h:best.h};}
/* MaxRects (best short side fit): rects = [{w,h}], returns positions or null when they do not fit the unit square */
function uwMaxRects(rects,order,allowRot){let free=[{x:0,y:0,w:1,h:1}];const pos=new Array(rects.length);
  for(const i of order){const r=rects[i];let bx=null,bs=1e30,bl=1e30,rot=false;
    for(const f of free){for(const tryRot of allowRot?[false,true]:[false]){const w=tryRot?r.h:r.w,h=tryRot?r.w:r.h;if(w<=f.w+1e-9&&h<=f.h+1e-9){const ss=Math.min(f.w-w,f.h-h),ls=Math.max(f.w-w,f.h-h);if(ss<bs-1e-12||(Math.abs(ss-bs)<1e-12&&ls<bl)){bs=ss;bl=ls;bx={x:f.x,y:f.y};rot=tryRot;}}}}
    if(!bx)return null;const w=rot?r.h:r.w,h=rot?r.w:r.h;pos[i]={x:bx.x,y:bx.y,rot};
    const nf=[];for(const f of free){if(bx.x>=f.x+f.w||bx.x+w<=f.x||bx.y>=f.y+f.h||bx.y+h<=f.y){nf.push(f);continue;}
      if(bx.x>f.x)nf.push({x:f.x,y:f.y,w:bx.x-f.x,h:f.h});if(bx.x+w<f.x+f.w)nf.push({x:bx.x+w,y:f.y,w:f.x+f.w-bx.x-w,h:f.h});
      if(bx.y>f.y)nf.push({x:f.x,y:f.y,w:f.w,h:bx.y-f.y});if(bx.y+h<f.y+f.h)nf.push({x:f.x,y:bx.y+h,w:f.w,h:f.y+f.h-bx.y-h});}
    free=nf.filter((a,ai)=>{for(let bi=0;bi<nf.length;bi++){if(bi===ai)continue;const b=nf[bi];if(a.x>=b.x-1e-12&&a.y>=b.y-1e-12&&a.x+a.w<=b.x+b.w+1e-12&&a.y+a.h<=b.y+b.h+1e-12&&(bi<ai||!(b.x>=a.x-1e-12&&b.y>=a.y-1e-12&&b.x+b.w<=a.x+a.w+1e-12&&b.y+b.h<=a.y+a.h+1e-12)))return false;}return true;});}
  return pos;}
/* pack islands (each {w,h} in model units) into the unit square: the biggest scale that fits, with a gap of padPx pixels at size px */
function uwPack(boxes,size,padPx,seed,opt={}){const n=boxes.length;if(!n)return {scale:1,pos:[],util:0};const rng=uwRng(seed*2654435761+17),gap=padPx/size,allowRot=opt.rotate!==false;
  /* the order boxes are tried in: by the longest side, shaken by the seed (seed 0 is the plain order) */
  const key=boxes.map(b=>Math.max(b.w,b.h)*(seed?1+(rng()-.5)*.9:1)+(seed?rng()*1e-4:0)),order=boxes.map((_,i)=>i).sort((a,b)=>key[b]-key[a]);
  const fit=s=>{const rects=boxes.map(b=>({w:b.w*s+gap,h:b.h*s+gap}));return uwMaxRects(rects,order,allowRot);};
  let area=0;for(const b of boxes)area+=b.w*b.h;let hi=Math.sqrt(1/Math.max(area,1e-12)),lo=hi*.02;
  /* the tightest packing cannot beat the total area, so the answer sits between a small guess and the area bound */
  let best=null,bs=0;for(let k=0;k<22;k++){const mid=(lo+hi)/2,p=fit(mid);if(p){best=p;bs=mid;lo=mid;}else hi=mid;}
  if(!best){bs=lo;best=fit(lo);}
  if(!best){bs=lo*.5;best=fit(bs);}
  const rects=boxes.map(b=>({w:b.w*bs,h:b.h*bs}));let used=0;for(const r of rects)used+=r.w*r.h;
  return {scale:bs,pos:best||[],gap,util:used,order};}
/* ---- the whole unwrap ---- */
const UW_PRESETS={hard:{label:'Hard surface',angle:50,flat:20},balanced:{label:'Balanced',angle:66,flat:20},organic:{label:'Organic',angle:82,flat:12}};
function uwDefaults(){return {preset:'balanced',angle:66,flat:20,seed:1,packSeed:null,size:2048,padding:0,layout:'material',iters:400,lscmMax:60000,rotate:true,minTris:6};}
/* padding in pixels: about one pixel per mip level, and more for bigger textures (8 px at 1K, 16 at 2K, 32 at 4K) */
const uwAutoPad=size=>Math.max(4,Math.round(size/128));
async function uwUnwrap(m,optIn,progress){const opt=Object.assign(uwDefaults(),optIn||{}),rng=uwRng(opt.seed*7919+3),pr=progress||(()=>{});
  pr('Reading the model…',0);await uwYield();const topo=uwTopo(m);
  pr('Cutting into pieces…',.1);await uwYield();let seg=uwSegment(m,topo,opt,rng);seg=uwMerge(m,topo,seg,opt);
  const flats=[];let k=0;for(const C of seg.charts){flats.push(uwFlatten(m,topo,C,opt));if(++k%25===0){pr('Flattening…',.25+.5*k/seg.charts.length);await uwYield();}}
  return {topo,seg,flats,opt:Object.assign({},opt)};}
/* place the flattened charts (cheap, so re-rolling the pack or changing padding does not flatten again) */
function uwLayout(m,res,optIn){const opt=Object.assign({},res.opt,optIn||{}),{topo,seg,flats}=res,pad=opt.padding||uwAutoPad(opt.size),mats=m.triMat?[...new Set(seg.charts.map(c=>c.mat))].sort((a,b)=>a-b):[0];
  /* give every chart the texel density of the whole model (same scale from 3D area to flat area), then the tightest box */
  let A3=0,A2=0;for(const f of flats){A3+=f.a3;A2+=f.a2;}
  const fit=flats.map((f,i)=>{const sc=f.a2>0?Math.sqrt(f.a3/f.a2):1,o=uwFit({u:f.u,v:f.v},opt.keepAxes);for(let j=0;j<o.pts.length;j++)o.pts[j]*=sc;return {pts:o.pts,w:o.w*sc,h:o.h*sc,i};});
  const groups=opt.layout==='shared'?[mats.slice()]:mats.map(x=>[x]);
  const placed=new Array(flats.length),report=[];let util=0,sumScale=0;
  for(const grp of groups){const idxs=[];fit.forEach((f,i)=>{if(grp.includes(seg.charts[i].mat))idxs.push(i);});if(!idxs.length)continue;
    const boxes=idxs.map(i=>({w:fit[i].w,h:fit[i].h}));
    let pack=uwPack(boxes,opt.size,pad,opt.packSeed==null?opt.seed:opt.packSeed,opt);
    idxs.forEach((ci,bi)=>{const p=pack.pos[bi]||{x:0,y:0,rot:false};placed[ci]={x:p.x,y:p.y,rot:p.rot,s:pack.scale,gap:pack.gap};});
    report.push({mats:grp,util:pack.util,scale:pack.scale});util+=pack.util;sumScale+=pack.scale;}
  /* the uv of every chart corner */
  const uvs=flats.map((f,i)=>{const p=placed[i]||{x:0,y:0,rot:false,s:1,gap:0},F=fit[i],n=F.pts.length/2,out=new Float32Array(n*2),h=p.gap/2;
    for(let j=0;j<n;j++){let x=F.pts[j*2]*p.s,y=F.pts[j*2+1]*p.s;if(p.rot){const t=x;x=y;y=F.w*p.s-t;}out[j*2]=p.x+h+x;out[j*2+1]=p.y+h+y;}return out;});
  return {uvs,util:report.length?util/report.length:0,report,pad,seed:opt.seed,packSeed:opt.packSeed==null?opt.seed:opt.packSeed};}
/* a new mesh with the charts' UVs: corners that cross a seam become separate vertices; everything else about the mesh is kept */
function uwBuild(m,res,lay){const {topo,seg,flats}=res,I=m.idx,T=I.length/3,N=m.pos.length/3,map=new Map(),src=[],newIdx=new Uint32Array(I.length),uv=[],chartOf=seg.chart;
  /* for each chart: welded vertex -> its place in the chart's flat points */
  const local=flats.map(()=>new Map());flats.forEach((F,c)=>{F.tris.forEach((l,ti)=>{const t=seg.charts[c].tris[ti];for(let k=0;k<3;k++)local[c].set(topo.tw[t*3+k],l[k]);});});
  let next=0;
  for(let t=0;t<T;t++){const c=chartOf[t];for(let k=0;k<3;k++){const v=I[t*3+k];let u0=0,u1=0;
      if(c>=0){const li=local[c].get(topo.tw[t*3+k]);u0=lay.uvs[c][li*2];u1=lay.uvs[c][li*2+1];}
      /* a corner is a new vertex per (original vertex, chart): normals and colours stay exactly as they were */
      const key=c>=0?c*N+v:-1-v;let nv=map.get(key);if(nv===undefined){nv=next++;map.set(key,nv);src.push(v);uv.push(u0,1-u1);}newIdx[t*3+k]=nv;}}
  const M=src.length,copy=(a,w)=>{if(!a)return a;const o=new Float32Array(M*w);for(let i=0;i<M;i++)for(let j=0;j<w;j++)o[i*w+j]=a[src[i]*w+j];return o;};
  const r=Object.assign({},m,{pos:copy(m.pos,3),nrm:copy(m.nrm,3),uv:Float32Array.from(uv),idx:newIdx,vcol:copy(m.vcol,4),pcol:copy(m.pcol,4),noUV:false,verts:M,_uvAn:null,_uvIsl:null});
  r.tan=tangentsOf(r.pos,r.nrm,r.uv,r.idx);delete r.sub;r.uvAuto={opt:res.opt,seed:lay.seed,packSeed:lay.packSeed,util:lay.util,charts:flats.length};return r;}
/* ---- reading the UVs a model came with ---- */
/* which UV island (connected piece) every triangle belongs to */
function uwIslands(m){const I=m.idx,T=I.length/3,P=m.pos,UV=m.uv,q=1e5,key=new Map(),vid=new Uint32Array(m.pos.length/3);let W=0;
  for(let i=0;i<vid.length;i++){const k=Math.round(P[i*3]*q)+','+Math.round(P[i*3+1]*q)+','+Math.round(P[i*3+2]*q)+'|'+Math.round(UV[i*2]*4096)+','+Math.round(UV[i*2+1]*4096);let w=key.get(k);if(w===undefined){w=W++;key.set(k,w);}vid[i]=w;}
  const par=new Int32Array(T);for(let t=0;t<T;t++)par[t]=t;const find=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
  const em=new Map(),B=67108864;for(let t=0;t<T;t++)for(let k=0;k<3;k++){const a=vid[I[t*3+k]],b=vid[I[t*3+(k+1)%3]],e=a<b?a*B+b:b*B+a,o=em.get(e);if(o===undefined)em.set(e,t);else{const x=find(o),y=find(t);if(x!==y)par[x]=y;}}
  const ids=new Int32Array(T),lab=new Map();let n=0;for(let t=0;t<T;t++){const r=find(t);let l=lab.get(r);if(l===undefined){l=n++;lab.set(r,l);}ids[t]=l;}return {ids,count:n};}
/* what is wrong with a model's UVs: none, flat, outside the square, overlapping, uneven */
function uwAnalyze(m,optIn){const opt=Object.assign({udim:false},optIn||{}),out={none:false,issues:[],islands:0,overlapPct:0,outsidePct:0,uneven:0};
  if(!m||m.noUV||!m.uv){out.none=true;out.issues.push({kind:'none',text:'This model has no UVs.'});return out;}
  const I=m.idx,T=I.length/3,UV=m.uv,P=m.pos;let uvArea=0,outside=0,areaSum=0;const dens=new Float32Array(T),tw=new Float32Array(T);
  for(let t=0;t<T;t++){const a=I[t*3],b=I[t*3+1],c=I[t*3+2];
    const ar=((UV[b*2]-UV[a*2])*(UV[c*2+1]-UV[a*2+1])-(UV[c*2]-UV[a*2])*(UV[b*2+1]-UV[a*2+1]))/2;uvArea+=Math.abs(ar);
    const ux=P[b*3]-P[a*3],uy=P[b*3+1]-P[a*3+1],uz=P[b*3+2]-P[a*3+2],vx=P[c*3]-P[a*3],vy=P[c*3+1]-P[a*3+1],vz=P[c*3+2]-P[a*3+2];
    const a3=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2;tw[t]=a3;areaSum+=a3;dens[t]=a3>1e-12?Math.sqrt(Math.abs(ar)/a3):0;
    const cu=(UV[a*2]+UV[b*2]+UV[c*2])/3,cv=(UV[a*2+1]+UV[b*2+1]+UV[c*2+1])/3;if(!opt.udim&&(cu<-1e-3||cu>1+1e-3||cv<-1e-3||cv>1+1e-3))outside++;}
  if(uvArea<1e-9){out.none=true;out.issues.push({kind:'none',text:'The UVs are all squeezed into one spot, so the model has no usable UVs.'});return out;}
  out.outsidePct=outside/T*100;if(out.outsidePct>0.5)out.issues.push({kind:'outside',text:Math.round(out.outsidePct)+'% of the surface lies outside the 0–1 square.'});
  /* uneven texel density: area-weighted share of triangles far from the middle density */
  const sorted=[...dens.keys()].filter(t=>dens[t]>0).sort((a,b)=>dens[a]-dens[b]);let acc=0,med=0;for(const t of sorted){acc+=tw[t];if(acc>=areaSum/2){med=dens[t];break;}}
  if(med>0){let off=0;for(let t=0;t<T;t++)if(tw[t]>0&&(dens[t]<med*.5||dens[t]>med*2))off+=tw[t];out.uneven=off/areaSum*100;if(out.uneven>15)out.issues.push({kind:'uneven',text:'About '+Math.round(out.uneven)+'% of the surface has a very different texel size from the rest (stretched or squeezed).'});}
  /* overlapping islands: draw every triangle into a grid and look for cells two different islands both cover */
  const isl=uwIslands(m);out.islands=isl.count;
  if(isl.count>1&&!opt.udim){const S=Math.min(1024,Math.max(256,Math.round(Math.sqrt(T)*4))),own=new Int32Array(S*S).fill(-1),bad=new Uint8Array(S*S);let cover=0,overlap=0;
    for(let t=0;t<T;t++){const a=I[t*3],b=I[t*3+1],c=I[t*3+2],id=isl.ids[t],x0=UV[a*2]*S,y0=UV[a*2+1]*S,x1=UV[b*2]*S,y1=UV[b*2+1]*S,x2=UV[c*2]*S,y2=UV[c*2+1]*S;
      const mnx=Math.max(0,Math.floor(Math.min(x0,x1,x2))),mxx=Math.min(S-1,Math.ceil(Math.max(x0,x1,x2))),mny=Math.max(0,Math.floor(Math.min(y0,y1,y2))),mxy=Math.min(S-1,Math.ceil(Math.max(y0,y1,y2)));
      const d=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(Math.abs(d)<1e-9)continue;
      for(let y=mny;y<=mxy;y++)for(let x=mnx;x<=mxx;x++){const px=x+.5,py=y+.5,w0=((x1-px)*(y2-py)-(x2-px)*(y1-py))/d,w1=((x2-px)*(y0-py)-(x0-px)*(y2-py))/d,w2=1-w0-w1;
        if(w0<-1e-6||w1<-1e-6||w2<-1e-6)continue;const o=y*S+x;if(own[o]<0){own[o]=id;cover++;}else if(own[o]!==id&&!bad[o]){bad[o]=1;overlap++;}}}
    out.overlapPct=cover?overlap/cover*100:0;if(opt.mask)out.mask={S,bad};if(out.overlapPct>1)out.issues.push({kind:'overlap',text:'About '+Math.round(out.overlapPct)+'% of the used UV area is covered by more than one island, so bakes and paint would mix there.'});}
  return out;}
/* pack a model's own islands again (their shapes and sizes stay; they are moved apart and fitted into the square) */
function uwRepack(m,optIn){const opt=Object.assign(uwDefaults(),optIn||{}),isl=uwIslands(m),I=m.idx,T=I.length/3,UV=m.uv,pad=opt.padding||uwAutoPad(opt.size);
  const ib=[];for(let i=0;i<isl.count;i++)ib.push({x0:1e30,y0:1e30,x1:-1e30,y1:-1e30,mat:0});
  for(let t=0;t<T;t++){const b=ib[isl.ids[t]];if(m.triMat)b.mat=m.triMat[t];for(let k=0;k<3;k++){const v=I[t*3+k];b.x0=Math.min(b.x0,UV[v*2]);b.x1=Math.max(b.x1,UV[v*2]);b.y0=Math.min(b.y0,UV[v*2+1]);b.y1=Math.max(b.y1,UV[v*2+1]);}}
  const mats=m.triMat?[...new Set(ib.map(b=>b.mat))]:[0],groups=opt.layout==='shared'?[mats]:mats.map(x=>[x]),place=new Array(isl.count);let util=0,ng=0;
  for(const g of groups){const idxs=[];ib.forEach((b,i)=>{if(g.includes(b.mat))idxs.push(i);});if(!idxs.length)continue;
    const boxes=idxs.map(i=>({w:Math.max(1e-6,ib[i].x1-ib[i].x0),h:Math.max(1e-6,ib[i].y1-ib[i].y0)}));const p=uwPack(boxes,opt.size,pad,opt.packSeed==null?opt.seed:opt.packSeed,opt);
    idxs.forEach((ii,bi)=>{const q=p.pos[bi]||{x:0,y:0,rot:false};place[ii]={x:q.x,y:q.y,rot:q.rot,s:p.scale,gap:p.gap};});util+=p.util;ng++;}
  /* every vertex belongs to one island here (islands are split at their seams), so the map from old to new is per vertex */
  const uv=new Float32Array(UV.length),seen=new Uint8Array(UV.length/2);
  for(let t=0;t<T;t++){const b=ib[isl.ids[t]],p=place[isl.ids[t]];for(let k=0;k<3;k++){const v=I[t*3+k];if(seen[v])continue;seen[v]=1;
    let x=(UV[v*2]-b.x0)*p.s,y=(UV[v*2+1]-b.y0)*p.s;if(p.rot){const w=(b.x1-b.x0)*p.s;const tx=x;x=y;y=w-tx;}uv[v*2]=p.x+p.gap/2+x;uv[v*2+1]=p.y+p.gap/2+y;}}
  const r=Object.assign({},m,{uv,_uvAn:null,_uvIsl:null});r.tan=tangentsOf(r.pos,r.nrm,r.uv,r.idx);r.uvAuto={opt,seed:opt.seed,packSeed:opt.packSeed==null?opt.seed:opt.packSeed,util:ng?util/ng:0,charts:isl.count,repack:true};return r;}
