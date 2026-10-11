/* ================= Artist style unwrap (0.55.2) =================
   Learned from 20 hand-made unwraps (a backpack, jackets, a helmet, swords, shoes…): artists keep few, big pieces
   (10–30 per 10,000 triangles, where the plain unwrap made 110), cut mostly along hard edges, straighten the pieces to the
   square's axes and fill the square well. This stage joins the small pieces of the plain unwrap back together while they stay
   "developable" (can lie flat without stretching: the angle defect at inner corners stays small), joining across soft edges first
   so the seams that are left sit on the hard edges. After flattening, a joined piece that still stretches too much is split
   back into the pieces it was made from. */
const UW_CLOTH={unfold:true,creaseDeg:55,creaseMin:30,angle:60,flat:20,artist:false,cut:true,straighten:true,defBudget:2.5,stretchMax:1.8,qMax:99,flex:0.3,smooth:false,coneThr:.9,flipTol:.04,maxSlits:60};
const UW_ARTIST={fillMin:.3,absorbSmall:true,unfold:true,angle:89,flat:20,artist:true,straighten:true,defBudget:2.5,stretchMax:2.2,qMax:99,flex:0.4};
/* the angle at every triangle corner */
function uwCornerAngles(m,topo){const P=m.pos,I=m.idx,T=topo.T,out=new Float32Array(T*3);
  for(let t=0;t<T;t++)for(let k=0;k<3;k++){const a=I[t*3+k]*3,b=I[t*3+(k+1)%3]*3,c=I[t*3+(k+2)%3]*3;
    const ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2],l=Math.hypot(ux,uy,uz)*Math.hypot(vx,vy,vz);
    out[t*3+k]=l>1e-20?Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy+uz*vz)/l))):0;}
  return out;}
/* per chart: for each welded corner the angle sum around it and how many chart-border edges touch it */
function uwChartVerts(C,topo,ang,chart,m){const {tw,adj}=topo,M=new Map();let B=0,Lb=0;
  for(const t of C.tris)for(let k=0;k<3;k++){const v=tw[t*3+k];let e=M.get(v);if(!e){e={a:0,be:0};M.set(v,e);}e.a+=ang[t*3+k];
    const nb=adj[t*3+k];if(nb<0||chart[nb]!==C.id){e.be++;let f=M.get(tw[t*3+(k+1)%3]);if(!f){f={a:0,be:0};M.set(tw[t*3+(k+1)%3],f);}f.be++;B++;Lb+=uwEdgeLen(m.pos,m.idx,t,k);}}
  return {M,B,Lb};}
const uwDefOf=e=>e.be===0?Math.abs(2*Math.PI-e.a):0;
function uwArtistMerge(m,topo,seg,opt,yieldFn){const {T,tw,adj,nx,ny,nz,area}=topo,mat=m.triMat||null,chart=seg.chart,ang=uwCornerAngles(m,topo),budget=opt.defBudget||1.2;
  const charts=seg.charts.filter(c=>c.tris.length);charts.forEach((c,i)=>{c.id=i;for(const t of c.tris)chart[t]=i;c.kids=null;});
  for(const C of charts){const {M,B,Lb}=uwChartVerts(C,topo,ang,chart,m);C.vm=M;C.B=B;C.Lb=Lb;C.F=C.tris.length;let d=0;for(const e of M.values())d+=uwDefOf(e);C.def=d;C.ver=0;C.alive=true;}
  /* how two neighbouring charts would look joined: null when not allowed */
  const trial=(C,D)=>{if(C.mat!==D.mat)return null;
    const sh=new Map();let se=0,soft=0,sl=0;
    for(const t of C.tris)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0||chart[o]!==D.id)continue;se++;sl+=uwEdgeLen(m.pos,m.idx,t,k);const a=tw[t*3+k],b=tw[t*3+(k+1)%3];sh.set(a,(sh.get(a)||0)+1);sh.set(b,(sh.get(b)||0)+1);
      soft+=nx[t]*nx[o]+ny[t]*ny[o]+nz[t]*nz[o];}
    if(!se)return null;
    let sv=0;const small=C.vm.size<D.vm.size?C.vm:D.vm,big=small===C.vm?D.vm:C.vm;for(const v of small.keys())if(big.has(v))sv++;
    const V=C.vm.size+D.vm.size-sv,Bn=C.B+D.B-2*se,F=C.F+D.F,E=(3*F+Bn)/2;if(V-E+F!==1)return null;/* still one disk */
    let def=C.def+D.def;for(const [v,s] of sh){const a=C.vm.get(v),b=D.vm.get(v);if(!a||!b)continue;def-=uwDefOf(a)+uwDefOf(b);def+=uwDefOf({a:a.a+b.a,be:a.be+b.be-2*s});}
    if(def>budget*(1+Math.log10(1+(C.F+D.F)/200)*0.3))return null;
    /* how compact the joined piece is: its outline length squared over 16 times its area (1 for a square, 3 for a 1:8 strip); jagged or sprawling outlines score high */
    const Lbn=C.Lb+D.Lb-2*sl,Q=Lbn*Lbn/(16*Math.max(C.area+D.area,1e-12));if(Q>(opt.qMax||3))return null;
    const sm=soft/se;/* 1 = flat across the border, lower = a crease */
    return {cost:(def-C.def-D.def)*1.0+(1-sm)*1.4+Q*0.15+Math.log(Math.max(2,Math.min(C.F,D.F)))*0.02,def,se};};
  /* a heap of [cost, index into jobs] */
  const heap=uwHeap();
  const jobs=[];const push=(C,D)=>{const r=trial(C,D);if(!r)return;jobs.push({C,D,vc:C.ver,vd:D.ver,r});heap.push(r.cost,jobs.length-1);};
  const nbrs=C=>{const s=new Set();for(const t of C.tris)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0&&chart[o]!==C.id&&chart[o]>=0)s.add(chart[o]);}return s;};
  for(const C of charts)for(const j of nbrs(C))if(j>C.id)push(C,charts[j]);
  let steps=0;
  while(heap.size()){const [, ji]=heap.pop(),J=jobs[ji];if(!J.C.alive||!J.D.alive||J.C.ver!==J.vc||J.D.ver!==J.vd)continue;
    let C=J.C,D=J.D;if(C.F>D.F){const x=C;C=D;D=x;}/* the smaller joins the bigger */
    const r=trial(C,D);if(!r)continue;
    /* join C into D (keep both as the kids for a possible split) */
    const kid={id:-1,tris:D.tris,mat:D.mat,nx:D.nx,ny:D.ny,nz:D.nz,area:D.area,kids:D.kids,vm:null};const kidC={id:-1,tris:C.tris,mat:C.mat,nx:C.nx,ny:C.ny,nz:C.nz,area:C.area,kids:C.kids,vm:null};
    D.kids=[kid,kidC];D.tris=D.tris.concat(C.tris);D.nx+=C.nx;D.ny+=C.ny;D.nz+=C.nz;D.area+=C.area;
    for(const t of C.tris)chart[t]=D.id;
    for(const [v,e] of C.vm){const f=D.vm.get(v);if(f){f.a+=e.a;f.be+=e.be;}else D.vm.set(v,e);}
    const rec=uwChartVerts(D,topo,ang,chart,m);D.vm=rec.M;D.B=rec.B;D.Lb=rec.Lb;D.F=D.tris.length;D.def=0;for(const e of D.vm.values())D.def+=uwDefOf(e);
    C.alive=false;C.tris=[];D.ver++;
    for(const j of nbrs(D))push(D,charts[j]);
    if(yieldFn&&(++steps%200===0))yieldFn();}
  seg.charts=charts.filter(c=>c.alive);seg.charts.forEach((c,i)=>{c.id=i;for(const t of c.tris)chart[t]=i;});return seg;}
/* how stretched a flattened chart is (1 = perfect): the average over its triangles, weighted by area. Triangles that came out turned over
   (the other way round from most of the piece) count as badly stretched. Returns the number, and the stretch gathered at each corner. */
function uwChartEnergy(m,F){const P=m.pos,{verts,tris,u,v}=F,n=tris.length,E=new Float64Array(n),A3=new Float64Array(n),SG=new Int8Array(n),AA=new Float64Array(n),ve=new Float64Array(verts.length);let pos=0,neg=0;
  for(let i=0;i<n;i++){const [a,b,c]=tris[i],pa=verts[a]*3,pb=verts[b]*3,pc=verts[c]*3,x1=u[a],y1=v[a],x2=u[b],y2=v[b],x3=u[c],y3=v[c],A=((x2-x1)*(y3-y1)-(x3-x1)*(y2-y1))/2;
    const ux=P[pb]-P[pa],uy=P[pb+1]-P[pa+1],uz=P[pb+2]-P[pa+2],wx=P[pc]-P[pa],wy=P[pc+1]-P[pa+1],wz=P[pc+2]-P[pa+2],t3=Math.hypot(uy*wz-uz*wy,uz*wx-ux*wz,ux*wy-uy*wx)/2;A3[i]=t3;AA[i]=Math.abs(A);SG[i]=A>0?1:A<0?-1:0;if(A>0)pos+=t3;else neg+=t3;
    if(Math.abs(A)<1e-14){E[i]=-1;continue;}let ss=0,st=0;for(let k=0;k<3;k++){const q=P[pa+k],r=P[pb+k],s=P[pc+k],Ss=(q*(y2-y3)+r*(y3-y1)+s*(y1-y2))/(2*A),St=(q*(x3-x2)+r*(x1-x3)+s*(x2-x1))/(2*A);ss+=Ss*Ss;st+=St*St;}E[i]=(ss+st)/2;}
  const maj=pos>=neg?1:-1;let a3=0,a2=0;for(let i=0;i<n;i++){a3+=A3[i];a2+=AA[i];}const k=a2>0&&a3>0?a2/a3:1;let s2=0;const vs=new Float64Array(verts.length);
  for(let i=0;i<n;i++){const [a,b,c]=tris[i];let e;if(E[i]<0||SG[i]!==maj)e=400;else e=E[i]*k;/* 400 = a stretch of 20 */s2+=e*A3[i];const ex=Math.max(0,e-1)*A3[i];ve[a]+=ex;ve[b]+=ex;ve[c]+=ex;if(A3[i]>0&&AA[i]>0){const dv=Math.abs(Math.log(AA[i]/A3[i]/k))*A3[i];vs[a]+=dv;vs[b]+=dv;vs[c]+=dv;}}
  return {stretch:a3>0?Math.sqrt(s2/a3):1,ve,vs};}
/* how much of a flattened chart lies on top of itself: the share of covered pixels that two triangles reach (a spiral has no flipped triangles and still overlaps) */
function uwSelfOverlap(F,flags){const {tris,u,v}=F,n=tris.length;if(n<20)return 0;let x0=1e30,y0=1e30,x1=-1e30,y1=-1e30;for(let i=0;i<u.length;i++){if(u[i]<x0)x0=u[i];if(u[i]>x1)x1=u[i];if(v[i]<y0)y0=v[i];if(v[i]>y1)y1=v[i];}
  const S=256,sc=(S-2)/Math.max(x1-x0,y1-y0,1e-12),cov=new Uint8Array(S*S);let covered=0,over=0;
  for(let i=0;i<n;i++){const [a,b,c]=tris[i],ax=(u[a]-x0)*sc+1,ay=(v[a]-y0)*sc+1,bx=(u[b]-x0)*sc+1,by=(v[b]-y0)*sc+1,cx=(u[c]-x0)*sc+1,cy=(v[c]-y0)*sc+1,den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-9)continue;
    const xa=Math.max(0,Math.floor(Math.min(ax,bx,cx))),xb=Math.min(S-1,Math.ceil(Math.max(ax,bx,cx))),ya=Math.max(0,Math.floor(Math.min(ay,by,cy))),yb=Math.min(S-1,Math.ceil(Math.max(ay,by,cy)));
    for(let y=ya;y<=yb;y++)for(let x=xa;x<=xb;x++){const qx=x+.5-cx,qy=y+.5-cy,w1=((by-cy)*qx+(cx-bx)*qy)/den,w2=((cy-ay)*qx+(ax-cx)*qy)/den,w3=1-w1-w2;if(w1>0&&w2>0&&w3>0){const p=y*S+x;if(!cov[p]){cov[p]=1;covered++;}else if(cov[p]===1){cov[p]=2;over++;}}}}
  if(flags)for(let i=0;i<n;i++){const [a,b,c]=tris[i],px=Math.floor(((u[a]+u[b]+u[c])/3-x0)*sc+1),py=Math.floor(((v[a]+v[b]+v[c])/3-y0)*sc+1);flags[i]=px>=0&&px<S&&py>=0&&py<S&&cov[py*S+px]===2?1:0;}
  return covered?over/covered:0;}
function uwChartStretch(m,F){return uwChartEnergy(m,F).stretch;}
/* flatten a chart; one that stretches too much is split: a joined chart back into the pieces it was made of, a single piece
   by cutting it again with a tighter angle (a big cone can swallow a whole dome that cannot lie flat) */
/* how much of its best-fitting rectangle a flattened piece fills: a bent ribbon fills very little of it, and wastes the square */
function uwBoxFill(F){const {tris,u,v}=F,n=tris.length;let a=0;for(let i=0;i<n;i++){const [p,q,r]=tris[i];a+=Math.abs((u[q]-u[p])*(v[r]-v[p])-(u[r]-u[p])*(v[q]-v[p]))/2;}
  const fit=uwFit(F,false,false);return a/Math.max(1e-12,fit.w*fit.h);}
function* uwFlattenSplitG(m,topo,C,opt,depth){depth=depth||0;const F=yield* uwFlattenG(m,topo,C,opt),lim=opt.stretchMax||1.5;
  if(C.tris.length<8)return [{C,F}];
  /* a long bent piece (a ribbon around a curve) is cut across, so each part can lie straight */
  if(opt.fillMin&&C.tris.length>=(opt.fillMinTris||40)&&depth<6&&uwBoxFill(F)<opt.fillMin){const parts=uwSplitPlane(m,topo,C);
    if(parts&&parts.length>=2&&parts.every(c=>c.tris.length>=6)){const out=[];for(const c of parts)for(const x of yield* uwFlattenSplitG(m,topo,c,opt,depth+1))out.push(x);return out;}}
  if(uwChartStretch(m,F)<=lim)return [{C,F}];
  if(C.kids&&C.kids.length){const out=[];for(const k of C.kids)for(const x of yield* uwFlattenSplitG(m,topo,k,opt,depth)){out.push(x);}return out;}
  if(depth>=6)return [{C,F}];
  const parts=uwSplitPlane(m,topo,C);if(!parts||parts.length<2)return [{C,F}];
  const out=[];for(const c of parts)for(const x of yield* uwFlattenSplitG(m,topo,c,opt,depth+1))out.push(x);return out;}
/* cut a chart in two with a plane across its long direction, through the middle (by area): a straight seam, like an artist's cut.
   Each side is split again into its connected pieces. */
function uwSplitPlane(m,topo,C){const P=m.pos,I=m.idx,{adj,area,nx,ny,nz}=topo,tris=C.tris,n=tris.length;if(n<8)return null;
  const cx=new Float64Array(n),cy=new Float64Array(n),cz=new Float64Array(n);let sx=0,sy=0,sz=0,sa=0;
  for(let i=0;i<n;i++){const t=tris[i],a=I[t*3]*3,b=I[t*3+1]*3,c=I[t*3+2]*3;cx[i]=(P[a]+P[b]+P[c])/3;cy[i]=(P[a+1]+P[b+1]+P[c+1])/3;cz[i]=(P[a+2]+P[b+2]+P[c+2])/3;const w=area[t];sx+=cx[i]*w;sy+=cy[i]*w;sz+=cz[i]*w;sa+=w;}
  if(sa<=0)return null;sx/=sa;sy/=sa;sz/=sa;let xx=0,xy=0,xz=0,yy=0,yz=0,zz=0;
  for(let i=0;i<n;i++){const w=area[tris[i]],dx=cx[i]-sx,dy=cy[i]-sy,dz=cz[i]-sz;xx+=w*dx*dx;xy+=w*dx*dy;xz+=w*dx*dz;yy+=w*dy*dy;yz+=w*dy*dz;zz+=w*dz*dz;}
  let ax=1,ay=.3,az=.1;for(let it=0;it<30;it++){const bx=xx*ax+xy*ay+xz*az,by=xy*ax+yy*ay+yz*az,bz=xz*ax+yz*ay+zz*az,l=Math.hypot(bx,by,bz)||1;ax=bx/l;ay=by/l;az=bz/l;}
  const key=new Float64Array(n),ord=Array.from({length:n},(_,i)=>i);for(let i=0;i<n;i++)key[i]=(cx[i]-sx)*ax+(cy[i]-sy)*ay+(cz[i]-sz)*az;ord.sort((a,b)=>key[a]-key[b]);
  let acc=0,cut=key[ord[0]];for(const i of ord){acc+=area[tris[i]];if(acc>=sa/2){cut=key[i];break;}}
  const side=new Int8Array(topo.T).fill(-1),idx=new Map();tris.forEach((t,i)=>{side[t]=key[i]<=cut?0:1;idx.set(t,i);});
  const seen=new Uint8Array(topo.T),parts=[];
  for(const t0 of tris){if(seen[t0])continue;const sd=side[t0],comp=[t0],st=[t0];seen[t0]=1;
    while(st.length){const t=st.pop();for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0&&!seen[o]&&side[o]===sd){seen[o]=1;comp.push(o);st.push(o);}}}
    let nxs=0,nys=0,nzs=0,ar=0;for(const t of comp){nxs+=nx[t]*area[t];nys+=ny[t]*area[t];nzs+=nz[t]*area[t];ar+=area[t];}
    parts.push({id:-1,tris:comp,mat:C.mat,nx:nxs,ny:nys,nz:nzs,area:ar,kids:null});}
  return parts.length>=2?parts:null;}
/* the direction most of a chart's outline runs in (in 4 turns, so a square counts as one direction); the angle that makes it level */
function uwDominant(F){const n=F.u.length;if(!F.tris||n<3)return null;const em=new Map();
  for(const [a,b,c] of F.tris)for(const [p,q] of [[a,b],[b,c],[c,a]]){const k=p<q?p*n+q:q*n+p;em.set(k,(em.get(k)||0)+1);}
  let sx=0,sy=0;for(const [k,c] of em){if(c!==1)continue;const p=Math.floor(k/n),q=k%n,dx=F.u[q]-F.u[p],dy=F.v[q]-F.v[p],l=Math.hypot(dx,dy),th=Math.atan2(dy,dx);sx+=l*Math.cos(4*th);sy+=l*Math.sin(4*th);}
  if(Math.hypot(sx,sy)<1e-12)return null;return -Math.atan2(sy,sx)/4;}

/* the turn that stands the model's "up" (world +Y) upright in a flat chart: artists lay pieces out so that gravity runs down the texture */
function uwUpAngle(m,F){const P=m.pos,{verts,tris,u,v}=F;let wx=0,wy=0;
  for(const [a,b,c] of tris){const pa=verts[a]*3,pb=verts[b]*3,pc=verts[c]*3;
    const e1=[P[pb]-P[pa],P[pb+1]-P[pa+1],P[pb+2]-P[pa+2]],e2=[P[pc]-P[pa],P[pc+1]-P[pa+1],P[pc+2]-P[pa+2]];
    const nx=e1[1]*e2[2]-e1[2]*e2[1],ny=e1[2]*e2[0]-e1[0]*e2[2],nz=e1[0]*e2[1]-e1[1]*e2[0],nl=Math.hypot(nx,ny,nz);if(nl<1e-14)continue;
    const n=[nx/nl,ny/nl,nz/nl],g=[-n[1]*n[0],1-n[1]*n[1],-n[1]*n[2]];/* up, projected into the triangle's plane */
    const d11=e1[0]*e1[0]+e1[1]*e1[1]+e1[2]*e1[2],d12=e1[0]*e2[0]+e1[1]*e2[1]+e1[2]*e2[2],d22=e2[0]*e2[0]+e2[1]*e2[1]+e2[2]*e2[2],det=d11*d22-d12*d12;if(Math.abs(det)<1e-20)continue;
    const g1=g[0]*e1[0]+g[1]*e1[1]+g[2]*e1[2],g2=g[0]*e2[0]+g[1]*e2[1]+g[2]*e2[2],al=(g1*d22-g2*d12)/det,be=(g2*d11-g1*d12)/det;
    const dx1=u[b]-u[a],dy1=v[b]-v[a],dx2=u[c]-u[a],dy2=v[c]-v[a],w=nl/2;/* weight by the triangle's area */
    wx+=(al*dx1+be*dx2)*w;wy+=(al*dy1+be*dy2)*w;}
  const L=Math.hypot(wx,wy);if(L<1e-12)return null;return {ang:Math.PI/2-Math.atan2(wy,wx),strength:L};}

/* ---- cleaner seams (0.56) ----
   Charts that grow triangle by triangle end with saw-toothed borders and thin fingers. A triangle that has two sides touching another piece
   and at most one side in its own is handed to that piece, round after round, so teeth and fingers are shaved off and the seam runs straight.
   A piece that would no longer be one connected disk keeps its old shape. */
function uwSmoothCharts(m,topo,seg,opt,rounds){const {T,adj,tw,nx,ny,nz,area,deg}=topo,chart=seg.chart,charts=seg.charts,mat=m.triMat||null,lim=Math.cos(Math.min(95,(opt.angle||66)+14)*Math.PI/180);rounds=rounds||8;
  const moved=[];let total=0;
  const nOf=c=>{const l=Math.hypot(c.nx,c.ny,c.nz)||1;return [c.nx/l,c.ny/l,c.nz/l];};const cn=charts.map(nOf);
  for(let r=0;r<rounds;r++){let n=0;
    for(let t=0;t<T;t++){if(deg[t])continue;const A=chart[t];if(A<0)continue;let nA=0,B=-1,nB=0;const cs=[-1,-1,-1];
      for(let k=0;k<3;k++){const o=adj[t*3+k];cs[k]=o>=0?chart[o]:-1;if(cs[k]===A)nA++;}
      for(let k=0;k<3;k++){const c=cs[k];if(c<0||c===A)continue;let cnt=0;for(let q=0;q<3;q++)if(cs[q]===c)cnt++;if(cnt>nB){nB=cnt;B=c;}}
      if(B<0||nB<2||nA>1)continue;if(charts[B].mat!==charts[A].mat)continue;
      const nb=cn[B];if(nx[t]*nb[0]+ny[t]*nb[1]+nz[t]*nb[2]<lim)continue;
      chart[t]=B;moved.push([t,A,B]);n++;}
    total+=n;if(!n)break;}
  if(!total)return seg;
  /* each piece must stay one connected disk; the ones that do not give their moves back */
  const bad=new Set();
  for(let pass=0;pass<4;pass++){const by=new Map();for(let t=0;t<T;t++){const c=chart[t];if(c<0)continue;let a=by.get(c);if(!a){a=[];by.set(c,a);}a.push(t);}
    const touched=new Set();for(const [,A,B] of moved){touched.add(A);touched.add(B);}
    let changed=false;
    for(const c of touched){if(bad.has(c))continue;const ts=by.get(c)||[];if(!ts.length){continue;}
      const seen=new Set(),st=[ts[0]];seen.add(ts[0]);let comp=1;const inC=new Set(ts);
      while(st.length){const t=st.pop();for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0&&inC.has(o)&&!seen.has(o)){seen.add(o);st.push(o);}}}
      let ok=seen.size===ts.length;
      if(ok){const V=new Set(),E=new Set();for(const t of ts)for(let k=0;k<3;k++){const a=tw[t*3+k],b=tw[t*3+(k+1)%3];V.add(a);E.add(a<b?a*67108864+b:b*67108864+a);}ok=(V.size-E.size+ts.length)===1;}
      if(!ok){bad.add(c);changed=true;}}
    if(!changed)break;
    for(let i=moved.length-1;i>=0;i--){const [t,A,B]=moved[i];if(bad.has(A)||bad.has(B)){if(chart[t]===B)chart[t]=A;moved.splice(i,1);}}}
  /* the charts' lists and sums again */
  for(const c of charts){c.tris=[];c.nx=c.ny=c.nz=c.area=0;}
  for(let t=0;t<T;t++){const c=chart[t];if(c<0)continue;const C=charts[c];C.tris.push(t);C.nx+=nx[t]*area[t];C.ny+=ny[t]*area[t];C.nz+=nz[t]*area[t];C.area+=area[t];}
  seg.charts=charts.filter(c=>c.tris.length);seg.charts.forEach((c,i)=>{c.id=i;for(const t of c.tris)chart[t]=i;});return seg;}

/* ---- Clothing / pattern style: cut like a tailor (0.56) ----
   Instead of growing pieces, cut as little as it takes: the model is cut open along a short tree of seams that joins every opening (cuffs, hem,
   neck) and every sharp corner of the surface, so what is left lies flat. The seams are the shortest ways between those places that run along
   hard edges where there are some. A piece that still stretches too much is cut again by the flatten step. */
function uwCutSegment(m,topo,opt,onStep){const {T,tw,deg,nx,ny,nz,area}=topo,P=m.pos,I=m.idx,Wn=topo.W,mat=m.triMat||null,ang=uwCornerAngles(m,topo);
  /* triangle neighbours, but never across two materials */
  const grp=opt.reeb===false?null:uwReebPieces(m,topo,opt),crease=opt.creaseDeg?uwCreaseMask(m,topo,opt):null;uwAbsorbGroups(m,topo,grp,crease,opt);
  const adj=Int32Array.from(topo.adj);if(crease)for(let t=0;t<T;t++)for(let k=0;k<3;k++)if(crease[t*3+k])adj[t*3+k]=-1;
  if(mat||grp)for(let t=0;t<T;t++)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0&&((mat&&mat[o]!==mat[t])||(grp&&grp[o]!==grp[t])))adj[t*3+k]=-1;}
  const WX=new Float64Array(Wn*3);for(let t=0;t<T;t++)for(let k=0;k<3;k++){const w=tw[t*3+k],v=I[t*3+k];WX[w*3]=P[v*3];WX[w*3+1]=P[v*3+1];WX[w*3+2]=P[v*3+2];}
  /* edges */
  const em=new Map(),ea=[],eb=[],e0=[],e1=[];const te=new Int32Array(T*3).fill(-1);
  for(let t=0;t<T;t++){if(deg[t])continue;for(let k=0;k<3;k++){const a=tw[t*3+k],b=tw[t*3+(k+1)%3],key=a<b?a*Wn+b:b*Wn+a;let e=em.get(key);if(e===undefined){e=ea.length;em.set(key,e);ea.push(a);eb.push(b);e0.push(t);e1.push(-1);}else if(e1[e]<0)e1[e]=t;else e1[e]=-2;te[t*3+k]=e;}}
  const creaseEdge=(t,u)=>{if(!crease)return false;for(let k=0;k<3;k++)if(topo.adj[t*3+k]===u&&crease[t*3+k])return true;return false;};
  const E=ea.length,cut=new Uint8Array(E),len=new Float64Array(E),cost=new Float64Array(E),bnd=new Uint8Array(E);
  for(let e=0;e<E;e++){const a=ea[e],b=eb[e];len[e]=Math.hypot(WX[a*3]-WX[b*3],WX[a*3+1]-WX[b*3+1],WX[a*3+2]-WX[b*3+2]);
    const border=e1[e]<0||(grp&&grp[e0[e]]!==grp[e1[e]])||(mat&&mat[e0[e]]!==mat[e1[e]])||(crease&&creaseEdge(e0[e],e1[e]));bnd[e]=border?1:0;let hard=0;if(!border){const t=e0[e],u=e1[e],d=nx[t]*nx[u]+ny[t]*ny[u]+nz[t]*nz[u];hard=Math.min(1,Math.acos(Math.max(-1,Math.min(1,d)))*180/Math.PI/55);}
    cost[e]=border?0:len[e]*(1+(opt.hardBonus===undefined?3:opt.hardBonus)*(1-hard));if(border)cut[e]=1;}
  /* vertex → edges */
  const cnt=new Int32Array(Wn+1);for(let e=0;e<E;e++){cnt[ea[e]+1]++;cnt[eb[e]+1]++;}for(let i=0;i<Wn;i++)cnt[i+1]+=cnt[i];const ve=new Int32Array(cnt[Wn]),fill=cnt.slice(0,Wn);for(let e=0;e<E;e++){ve[fill[ea[e]]++]=e;ve[fill[eb[e]]++]=e;}
  const onBorder=new Uint8Array(Wn),defect=new Float64Array(Wn),asum=new Float64Array(Wn);
  for(let e=0;e<E;e++)if(bnd[e]){onBorder[ea[e]]=1;onBorder[eb[e]]=1;}
  for(let t=0;t<T;t++){if(deg[t])continue;for(let k=0;k<3;k++)asum[tw[t*3+k]]+=ang[t*3+k];}
  for(let w=0;w<Wn;w++)defect[w]=onBorder[w]?0:2*Math.PI-asum[w];
  /* a corner counts when the surface around it turns a lot (its own defect plus half of the neighbours') */
  const ring=new Float64Array(Wn);for(let w=0;w<Wn;w++){let s=defect[w];for(let i=cnt[w];i<cnt[w+1];i++){const e=ve[i],o=ea[e]===w?eb[e]:ea[e];s+=defect[o]*.5;}ring[w]=s;}
  const thr=opt.coneThr||.9;
  /* shells and borders */
  const par=new Int32Array(T);for(let t=0;t<T;t++)par[t]=t;const find=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
  for(let t=0;t<T;t++)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0){const a=find(t),b=find(o);if(a!==b)par[a]=b;}}
  const vpar=new Int32Array(Wn);for(let w=0;w<Wn;w++)vpar[w]=w;const vf=x=>{while(vpar[x]!==x){vpar[x]=vpar[vpar[x]];x=vpar[x];}return x;};
  for(let e=0;e<E;e++)if(bnd[e]){const a=vf(ea[e]),b=vf(eb[e]);if(a!==b)vpar[a]=b;}
  const shellOf=new Map();for(let t=0;t<T;t++){if(deg[t])continue;const r=find(t);let s=shellOf.get(r);if(!s){s={tris:[],verts:new Set()};shellOf.set(r,s);}s.tris.push(t);for(let k=0;k<3;k++)s.verts.add(tw[t*3+k]);}
  const dist=new Float64Array(Wn),prev=new Int32Array(Wn),pe=new Int32Array(Wn),inS=new Uint8Array(Wn);
  for(const [,sh] of shellOf){
    const verts=[...sh.verts];
    /* terminals: border loops (all their corners) and sharp corners */
    const loops=new Map();for(const w of verts)if(onBorder[w]){const r=vf(w);let l=loops.get(r);if(!l){l=[];loops.set(r,l);}l.push(w);}
    const terms=[...loops.values()].map(vs=>({vs,len:vs.length}));terms.sort((a,b)=>b.len-a.len);
    const cones=verts.filter(w=>!onBorder[w]&&Math.abs(ring[w])>thr).sort((a,b)=>Math.abs(ring[b])-Math.abs(ring[a]));
    /* thin out cones: keep one per neighbourhood so a rounded corner does not ask for ten seams */
    const kept=[],taken=new Set();for(const w of cones){if(taken.has(w))continue;kept.push(w);taken.add(w);for(let i=cnt[w];i<cnt[w+1];i++){const e=ve[i],o=ea[e]===w?eb[e]:ea[e];taken.add(o);for(let j=cnt[o];j<cnt[o+1];j++){const e2=ve[j];taken.add(ea[e2]);taken.add(eb[e2]);}}}
    for(const w of kept)terms.push({vs:[w],len:1});
    if(terms.length<2)continue;
    const termOf=new Int32Array(Wn).fill(-1);terms.forEach((t,i)=>{for(const w of t.vs)termOf[w]=i;});
    for(const w of verts)inS[w]=0;for(const w of terms[0].vs)inS[w]=1;const done=new Uint8Array(terms.length);done[0]=1;let left=terms.length-1,guard=0;
    while(left>0&&guard++<terms.length+5){
      for(const w of verts){dist[w]=1e30;prev[w]=-1;pe[w]=-1;}
      const h=uwHeap();for(const w of verts)if(inS[w]){dist[w]=0;h.push(0,w);}
      let hit=-1;
      while(h.size()){const [d,w]=h.pop();if(d>dist[w])continue;if(!inS[w]&&termOf[w]>=0&&!done[termOf[w]]){hit=w;break;}
        for(let i=cnt[w];i<cnt[w+1];i++){const e=ve[i],o=ea[e]===w?eb[e]:ea[e],nd=d+cost[e];if(nd<dist[o]){dist[o]=nd;prev[o]=w;pe[o]=e;h.push(nd,o);}}}
      if(hit<0)break;
      const ti=termOf[hit];done[ti]=1;left--;let w=hit,pl=0;while(w>=0&&!inS[w]){const e=pe[w];if(e>=0){cut[e]=1;pl++;}inS[w]=1;w=prev[w];}
      for(const v of terms[ti].vs)inS[v]=1;
      if(onStep)onStep();}
  }
  /* pieces: triangles joined over every edge that is not cut */
  const chart=new Int32Array(T).fill(-1),charts=[];
  for(let s=0;s<T;s++){if(chart[s]>=0||deg[s])continue;const id=charts.length,C={id,tris:[],mat:mat?mat[s]:0,nx:0,ny:0,nz:0,area:0,kids:null},st=[s];chart[s]=id;
    while(st.length){const t=st.pop();C.tris.push(t);C.nx+=nx[t]*area[t];C.ny+=ny[t]*area[t];C.nz+=nz[t]*area[t];C.area+=area[t];
      for(let k=0;k<3;k++){const o=adj[t*3+k],e=te[t*3+k];if(o>=0&&chart[o]<0&&!deg[o]&&!cut[e]){chart[o]=id;st.push(o);}}}
    charts.push(C);}
  for(let t=0;t<T;t++)if(chart[t]<0)chart[t]=-2;
  return {chart,charts,ctx:{adj,te,cut,ea,eb,e0,e1,cost,cnt,ve,onCut:(()=>{const o=new Uint8Array(Wn);for(let e=0;e<E;e++)if(cut[e]){o[ea[e]]=1;o[eb[e]]=1;}return o;})()}};}

/* cut a chart further: a slit from its most stretched corner out to the nearest seam or border, along hard edges where it can; then the pieces that result */
function uwSlit(m,topo,C,ctx,seg,F,byScale){const {tw,wv}=topo,{adj,te,cut,ea,eb,e0,e1,cost,cnt,ve,onCut}=ctx,chart=seg.chart,id=C.id,en=uwChartEnergy(m,F,topo);let sv=byScale?en.vs:en.ve;if(byScale==='overlap'){const fl=new Uint8Array(F.tris.length);uwSelfOverlap(F,fl);sv=new Float64Array(F.verts.length);
    /* where the cloth lies on itself, the surface is a saddle (more angle around a point than a plane has: the armpit between arm and body): the cut starts at the middle of the saddle */
    const ang=uwCornerAngles(m,topo),asum=new Map(),cnts=new Map();for(const t of C.tris)for(let k=0;k<3;k++){const w=tw[t*3+k];asum.set(w,(asum.get(w)||0)+ang[t*3+k]);}
    const sad=w=>{const a=asum.get(w);return a===undefined||onCut[w]?0:Math.max(0,a-2*Math.PI);};const K=new Map();
    for(const w of asum.keys()){let q=sad(w);for(let i=cnt[w];i<cnt[w+1];i++){const e=ve[i],o=ea[e]===w?eb[e]:ea[e];q+=sad(o)*.6;}K.set(w,q);}
    const flagged=new Set();F.tris.forEach((t,i)=>{if(fl[i])for(const q of t)flagged.add(wv[F.verts[q]]);});
    F.verts.forEach((v,i)=>{const w=wv[v];sv[i]=(flagged.has(w)?1:0)*(1e-6+(K.get(w)||0));});}
  let bi=-1,bv=0;for(let i=0;i<sv.length;i++){const w=wv[F.verts[i]];if(onCut[w])continue;if(sv[i]>bv){bv=sv[i];bi=i;}}
  if(bi<0)return null;const start=wv[F.verts[bi]];
  /* Dijkstra inside the chart from that corner to a corner that touches a seam or border */
  const inC=new Set(C.tris),dist=new Map([[start,0]]),prev=new Map(),h=uwHeap();h.push(0,start);let hit=-1;
  /* a saddle is opened to the edge of the piece (a side seam), not to the nearest seam a step away */
  let edgeV=null;if(byScale==='overlap'){edgeV=new Set();for(const t of C.tris)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0||!inC.has(o)){edgeV.add(tw[t*3+k]);edgeV.add(tw[t*3+(k+1)%3]);}}}
  while(h.size()){const [d,w]=h.pop();if(d>dist.get(w))continue;if(w!==start&&(edgeV?edgeV.has(w):onCut[w])){hit=w;break;}
    for(let i=cnt[w];i<cnt[w+1];i++){const e=ve[i];const t0=e0[e],t1=e1[e];if(!(inC.has(t0)||(t1>=0&&inC.has(t1))))continue;if(cut[e])continue;const o=ea[e]===w?eb[e]:ea[e],nd=d+cost[e];if(nd<(dist.has(o)?dist.get(o):1e30)){dist.set(o,nd);prev.set(o,[w,e]);h.push(nd,o);}}}
  if(hit<0)return null;let w=hit,n=0;const undoL=[];while(w!==start){const [p,e]=prev.get(w);undoL.push([e,onCut[ea[e]],onCut[eb[e]],cut[e]]);cut[e]=1;onCut[ea[e]]=1;onCut[eb[e]]=1;w=p;n++;}
  const undo=()=>{for(let i=undoL.length-1;i>=0;i--){const [e,a,b,c]=undoL[i];cut[e]=c;onCut[ea[e]]=a;onCut[eb[e]]=b;}};
  /* the pieces now */
  const out=[],seen=new Set();let nid=0;
  for(const s0 of C.tris){if(seen.has(s0))continue;const P2={id:-1,tris:[],mat:C.mat,nx:0,ny:0,nz:0,area:0,kids:null},st=[s0];seen.add(s0);
    while(st.length){const t=st.pop();P2.tris.push(t);P2.nx+=topo.nx[t]*topo.area[t];P2.ny+=topo.ny[t]*topo.area[t];P2.nz+=topo.nz[t]*topo.area[t];P2.area+=topo.area[t];
      for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0&&inC.has(o)&&!seen.has(o)&&!cut[te[t*3+k]]){seen.add(o);st.push(o);}}}
    out.push(P2);}
  out.undo=undo;return out;}
function* uwCutRefineG(m,topo,opt,C,seg,depth,sdepth){depth=depth||0;sdepth=sdepth||0;
  /* a thin plate is cut front from back before anything else */
  if(!depth&&!sdepth&&opt.thinPlates!==false){const th=uwSplitThin(m,topo,C,seg.ctx);if(th){const out=[];for(const c of th)for(const x of yield* uwCutRefineG(m,topo,opt,c,seg,0,1))out.push(x);return out;}}const lim=opt.stretchMax||1.8,thr=opt.overlapMax===undefined?.012:opt.overlapMax,none=opt.noOverlap===undefined?.004:opt.noOverlap,undos=[];
  let cur=C,F,best=null,bad=0,last=0;
  /* still lying on itself after the relief cuts: cut it where the two layers are apart (a seam), and flatten the pieces */
  const split=function*(){if(!best||best.ov<=none||best.ov*best.C.tris.length<(opt.splitMinTris||10)||sdepth>=(opt.splitDepth||6)||best.C.tris.length<(opt.splitMinChart||40))return null;
    while(undos.length>best.n)undos.pop()();
    for(let rank=-2;rank<(opt.splitTries||2);rank++){const sp=rank===-2?uwSplitThin(m,topo,best.C,seg.ctx):rank<0?(opt.sideSeams===false?null:uwSideSeams(m,topo,best.C,seg.ctx,opt)):uwSplitByOverlap(m,topo,best.C,seg.ctx,best.F,opt,rank);if(!sp)continue;
      const out=[];for(const c of sp)for(const x of yield* uwCutRefineG(m,topo,opt,c,seg,depth+undos.length+1,sdepth+1))out.push(x);
      let ow=0,tt=0;for(const x of out){const n=x.C.tris.length;ow+=uwSelfOverlap(x.F)*n;tt+=n;}
      if(ow/Math.max(tt,1)<=best.ov*.6||ow/Math.max(tt,1)<=none)return out;sp.undo();}
    return null;};
  const fopt=sdepth>0?Object.assign({},opt,{unrollStarts:1}):opt;/* pieces cut out of a bigger one are flattened with one start only: it is quicker */
  for(;;){F=yield* uwFlattenG(m,topo,cur,fopt);if(cur.tris.length<10||depth+undos.length>=opt.maxSlits)break;
    const st=uwChartStretch(m,F),ov=uwSelfOverlap(F),score=st+10*ov;last=score;
    if(!best||score<best.score*.99){best={C:cur,F,score,ov,n:undos.length};bad=0;}else bad++;
    if(st<=lim&&ov<=none)break;
    if(st<=lim&&ov<thr&&sdepth>=(opt.splitDepth||6))break;
    /* more cuts only while they help: a few in a row that change nothing end it */
    if(bad>=(opt.slitPatience||5))break;
    const parts=uwSlit(m,topo,cur,seg.ctx,seg,F,st<=lim?(ov>.012?'overlap':true):false);if(!parts)break;
    if(parts.length>1){
      /* a cut that divides the piece (a side seam: front and back): kept only when a lot overlapped and the pieces lie clearly flatter */
      if(st<=lim&&ov<(opt.splitOverlap||.08)){parts.undo();break;}
      const out=[];for(const c of parts)for(const x of yield* uwCutRefineG(m,topo,opt,c,seg,depth+undos.length+1,sdepth))out.push(x);
      if(st<=lim){let ow=0,tt=0;for(const x of out){const n=x.C.tris.length;ow+=uwSelfOverlap(x.F)*n;tt+=n;}if(ow/Math.max(tt,1)>ov*.6){parts.undo();break;}}
      return out;}
    undos.push(parts.undo);cur=parts[0];}
  if(!best)return [{C:cur,F}];
  const alt=yield* split();if(alt)return alt;
  /* the last layout is not the best one seen (a cut made it worse): take those cuts back */
  if(best.C!==cur&&best.score<last*.97){while(undos.length>best.n)undos.pop()();return [{C:best.C,F:best.F}];}
  return [{C:cur,F}];}

/* pairs of triangles of a flattened chart that cover the same pixel (the one below, the one above): where the cloth lies on itself */
function uwOverlapPairs(F,max){const {tris,u,v}=F,n=tris.length,pairs=[];if(n<30)return pairs;let x0=1e30,y0=1e30,x1=-1e30,y1=-1e30;for(let i=0;i<u.length;i++){if(u[i]<x0)x0=u[i];if(u[i]>x1)x1=u[i];if(v[i]<y0)y0=v[i];if(v[i]>y1)y1=v[i];}
  const S=256,sc=(S-2)/Math.max(x1-x0,y1-y0,1e-12),first=new Int32Array(S*S).fill(-1),two=new Uint8Array(S*S);
  for(let i=0;i<n;i++){const [a,b,c]=tris[i],ax=(u[a]-x0)*sc+1,ay=(v[a]-y0)*sc+1,bx=(u[b]-x0)*sc+1,by=(v[b]-y0)*sc+1,cx=(u[c]-x0)*sc+1,cy=(v[c]-y0)*sc+1,den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-9)continue;
    const xa=Math.max(0,Math.floor(Math.min(ax,bx,cx))),xb=Math.min(S-1,Math.ceil(Math.max(ax,bx,cx))),ya=Math.max(0,Math.floor(Math.min(ay,by,cy))),yb=Math.min(S-1,Math.ceil(Math.max(ay,by,cy)));
    for(let y=ya;y<=yb;y++)for(let x=xa;x<=xb;x++){const qx=x+.5-cx,qy=y+.5-cy,w1=((by-cy)*qx+(cx-bx)*qy)/den,w2=((cy-ay)*qx+(ax-cx)*qy)/den,w3=1-w1-w2;if(w1>0&&w2>0&&w3>0){const p=y*S+x;if(first[p]<0)first[p]=i;else if(!two[p]&&pairs.length<max){two[p]=1;pairs.push([first[p],i]);}}}}
  return pairs;}
/* cut the chart where the two layers that lie on each other are apart on the model: the shortest seam (a minimum cut, edges costing what the cut tree charges
   for them, so hard edges are cheap) between the triangles below and the triangles above. The chart falls into pieces, each flattened on its own. */
function uwSplitByOverlap(m,topo,C,ctx,F,opt,rank){opt=opt||{};rank=rank||0;const pairs=uwOverlapPairs(F,4000);if(pairs.length<6)return null;
  const tris=C.tris,n=tris.length,{adj,te,cut,cost,ea,eb}=ctx,lt=new Map();tris.forEach((t,i)=>lt.set(t,i));
  /* one overlap at a time: the biggest connected run of overlapping triangles */
  const inPair=new Uint8Array(n);for(const [i,j] of pairs){inPair[i]=1;inPair[j]=1;}const blob=new Int32Array(n).fill(-1),bsz=[];
  for(let s0=0;s0<n;s0++){if(!inPair[s0]||blob[s0]>=0)continue;const id=bsz.length,st=[s0];blob[s0]=id;let c=0;while(st.length){const i=st.pop();c++;for(let k=0;k<3;k++){const o=adj[tris[i]*3+k];if(o<0)continue;const j=lt.get(o);if(j!==undefined&&inPair[j]&&blob[j]<0){blob[j]=id;st.push(j);}}}bsz.push(c);}
  const bord=bsz.map((c,q)=>q).sort((a,b)=>bsz[b]-bsz[a]);if(rank>=bord.length)return null;const bb=bord[rank];
  /* which sheet every overlapping triangle belongs to: the triangle next to it is on the same sheet, the one it lies on is on the other */
  const partner=new Map();for(const [i,j] of pairs)if(blob[i]===bb||blob[j]===bb){(partner.get(i)||partner.set(i,[]).get(i)).push(j);(partner.get(j)||partner.set(j,[]).get(j)).push(i);}
  const vote=new Int8Array(n);for(const [i0] of pairs){if(blob[i0]!==bb||vote[i0])continue;vote[i0]=1;const q=[i0];
    while(q.length){const i=q.pop();for(let k=0;k<3;k++){const o=adj[tris[i]*3+k];if(o<0)continue;const j=lt.get(o);if(j!==undefined&&partner.has(j)&&!vote[j]){vote[j]=vote[i];q.push(j);}}
      for(const j of partner.get(i)||[])if(!vote[j]){vote[j]=-vote[i];q.push(j);}}}
  let ns=0,nt=0;for(let i=0;i<n;i++){if(vote[i]>0)ns++;else if(vote[i]<0)nt++;}
  /* the smaller sheet is the one that is cut loose; it is grown by a couple of rings so the seam around it is a smooth loop, not the ragged edge of the overlap */
  if(ns<nt)for(let i=0;i<n;i++)vote[i]=-vote[i];
  {let ring=[];for(let i=0;i<n;i++)if(vote[i]<0)ring.push(i);for(let r=0;r<(opt.splitGrow===undefined?1:opt.splitGrow);r++){const nx2=[];for(const i of ring)for(let k=0;k<3;k++){const o=adj[tris[i]*3+k];if(o<0)continue;const j=lt.get(o);if(j!==undefined&&vote[j]===0){vote[j]=-1;nx2.push(j);}}ring=nx2;}}
  ns=0;nt=0;
  const edges=[];for(let i=0;i<n;i++){const t=tris[i];for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0)continue;const j=lt.get(o);if(j===undefined||j<i)continue;const e=te[t*3+k];if(e<0||cut[e])continue;edges.push([i,j,Math.max(cost[e],1e-9)]);}}
  const SRC=n,SNK=n+1,BIG=1e9;for(let i=0;i<n;i++){if(vote[i]>0){edges.push([SRC,i,BIG]);ns++;}else if(vote[i]<0){edges.push([i,SNK,BIG]);nt++;}}
  if(!ns||!nt)return null;const side=uwMaxFlowSide(n,edges,SRC,SNK);
  /* the pieces: connected runs of triangles on one side; the edges between the two sides become seams */
  const comp=new Int32Array(n).fill(-1),parts=[];
  for(let s0=0;s0<n;s0++){if(comp[s0]>=0)continue;const id=parts.length,P2={id:-1,tris:[],mat:C.mat,nx:0,ny:0,nz:0,area:0,kids:null},st=[s0];comp[s0]=id;
    while(st.length){const i=st.pop(),t=tris[i];P2.tris.push(t);P2.nx+=topo.nx[t]*topo.area[t];P2.ny+=topo.ny[t]*topo.area[t];P2.nz+=topo.nz[t]*topo.area[t];P2.area+=topo.area[t];
      for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0)continue;const j=lt.get(o);if(j===undefined||comp[j]>=0||side[j]!==side[i]||cut[te[t*3+k]])continue;comp[j]=id;st.push(j);}}
    parts.push(P2);}
  /* a fragment smaller than a few percent of the chart is not worth a seam: it joins the piece it touches most */
  const minT=opt.splitMinTrisPiece||10;for(let pass=0;pass<4;pass++){let any=false;
    for(let q=0;q<parts.length;q++){const P2=parts[q];if(!P2||P2.tris.length>=minT)continue;const touch=new Map();
      for(const t of P2.tris){const i=lt.get(t);for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0)continue;const j=lt.get(o);if(j===undefined||comp[j]===comp[i]||cut[te[t*3+k]])continue;touch.set(comp[j],(touch.get(comp[j])||0)+1);}}
      let bq=-1,bc=0;for(const [c2,c] of touch)if(c>bc){bc=c;bq=c2;}if(bq<0||!parts[bq])continue;
      for(const t of P2.tris){comp[lt.get(t)]=bq;parts[bq].tris.push(t);parts[bq].nx+=topo.nx[t]*topo.area[t];parts[bq].ny+=topo.ny[t]*topo.area[t];parts[bq].nz+=topo.nz[t]*topo.area[t];parts[bq].area+=topo.area[t];}parts[q]=null;any=true;}
    if(!any)break;}
  const live=parts.filter(Boolean);live.forEach((P2,i)=>{for(const t of P2.tris)comp[lt.get(t)]=i;});parts.length=0;for(const P2 of live)parts.push(P2);
  if(parts.length<2||parts.length>6)return null;
  {let small=1e9;for(const q of parts)small=Math.min(small,q.tris.length);if(small<(opt.splitPatchMin||10))return null;}
  const {onCut}=ctx,undoL=[];for(let i=0;i<n;i++){const t=tris[i];for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0)continue;const j=lt.get(o);if(j===undefined||comp[j]===comp[i])continue;const e=te[t*3+k];if(cut[e])continue;
      undoL.push([e,onCut[ea[e]],onCut[eb[e]]]);cut[e]=1;onCut[ea[e]]=1;onCut[eb[e]]=1;}}
  parts.undo=()=>{for(let i=undoL.length-1;i>=0;i--){const [e,a,b]=undoL[i];cut[e]=0;onCut[ea[e]]=a;onCut[eb[e]]=b;}};return parts;}

/* a thin plate (a sword guard, a badge, a belt buckle) has a front and a back in one piece, and they lie on top of each other when it is flattened. When the
   normals of a piece fall in two opposite groups, it is cut in two halfway through the plate, front from back (the rim goes to the nearer half). */
function uwSplitThin(m,topo,C,ctx){const tris=C.tris,n=tris.length;if(n<40)return null;const {nx,ny,nz,area}=topo,P=m.pos,I=m.idx,{te,cut,ea,eb,onCut,adj}=ctx;
  let xx=0,xy=0,xz=0,yy=0,yz=0,zz=0,A=0;for(const t of tris){const a=area[t];xx+=a*nx[t]*nx[t];xy+=a*nx[t]*ny[t];xz+=a*nx[t]*nz[t];yy+=a*ny[t]*ny[t];yz+=a*ny[t]*nz[t];zz+=a*nz[t]*nz[t];A+=a;}
  let ax=1,ay=.3,az=.1;for(let it=0;it<30;it++){const bx=xx*ax+xy*ay+xz*az,by=xy*ax+yy*ay+yz*az,bz=xz*ax+yz*ay+zz*az,l=Math.hypot(bx,by,bz)||1;ax=bx/l;ay=by/l;az=bz/l;}
  let along=0,pos=0,neg=0;for(const t of tris){const d=nx[t]*ax+ny[t]*ay+nz[t]*az;along+=area[t]*Math.abs(d);if(d>.5)pos+=area[t];else if(d<-.5)neg+=area[t];}
  if(along<A*.75||pos<A*.3||neg<A*.3)return null;
  const key=new Float64Array(n);let lo=1e30,hi=-1e30;tris.forEach((t,i)=>{const a=I[t*3]*3,b=I[t*3+1]*3,c=I[t*3+2]*3;key[i]=((P[a]+P[b]+P[c])*ax+(P[a+1]+P[b+1]+P[c+1])*ay+(P[a+2]+P[b+2]+P[c+2])*az)/3;if(key[i]<lo)lo=key[i];if(key[i]>hi)hi=key[i];});
  /* the middle of the plate: where the two groups of normals swap */
  let sp=0,sn=0,kp=0,kn=0;tris.forEach((t,i)=>{const d=nx[t]*ax+ny[t]*ay+nz[t]*az;if(d>.5){sp+=area[t];kp+=area[t]*key[i];}else if(d<-.5){sn+=area[t];kn+=area[t]*key[i];}});
  const mid=(kp/sp+kn/sn)/2,side=new Uint8Array(n);tris.forEach((t,i)=>{side[i]=key[i]>mid?1:0;});
  const lt=new Map();tris.forEach((t,i)=>lt.set(t,i));const comp=new Int32Array(n).fill(-1),parts=[];
  for(let s0=0;s0<n;s0++){if(comp[s0]>=0)continue;const id=parts.length,P2={id:-1,tris:[],mat:C.mat,nx:0,ny:0,nz:0,area:0,kids:null},st=[s0];comp[s0]=id;
    while(st.length){const i=st.pop(),t=tris[i];P2.tris.push(t);P2.nx+=nx[t]*area[t];P2.ny+=ny[t]*area[t];P2.nz+=nz[t]*area[t];P2.area+=area[t];
      for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0)continue;const j=lt.get(o);if(j===undefined||comp[j]>=0||side[j]!==side[i]||cut[te[t*3+k]])continue;comp[j]=id;st.push(j);}}
    parts.push(P2);}
  if(parts.length<2)return null;
  const undoL=[];for(let i=0;i<n;i++){const t=tris[i];for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0)continue;const j=lt.get(o);if(j===undefined||comp[j]===comp[i])continue;const e=te[t*3+k];if(cut[e])continue;undoL.push([e,onCut[ea[e]],onCut[eb[e]]]);cut[e]=1;onCut[ea[e]]=1;onCut[eb[e]]=1;}}
  parts.undo=()=>{for(let i=undoL.length-1;i>=0;i--){const [e,a,b]=undoL[i];cut[e]=0;onCut[ea[e]]=a;onCut[eb[e]]=b;}};return parts;}

/* a side seam: the way a tailor opens an armhole. Each opening of the chart that has another piece on its far side (a sleeve) is joined to the hem by a second
   cut, from the point of the opening opposite to where the first cut leaves it. "Down" is the direction from the first cut to that point, so no up axis is
   needed. The chart falls into front and back panels. */
function uwSideSeams(m,topo,C,ctx,opt){opt=opt||{};const tris=C.tris,{te,cut,cost,ea,eb,cnt,ve,e0,e1,onCut}=ctx,I=m.idx,P=m.pos,inC=new Set(tris);
  const wpos=new Map();for(const t of tris)for(let k=0;k<3;k++)if(!wpos.has(topo.tw[t*3+k]))wpos.set(topo.tw[t*3+k],I[t*3+k]*3);
  const par=new Map(),fd=x=>{while(par.get(x)!==x){par.set(x,par.get(par.get(x)));x=par.get(x);}return x;};
  const bedge=[];let hasNb=new Set();
  for(const t of tris)for(let k=0;k<3;k++){const o=topo.adj[t*3+k];if(o>=0&&inC.has(o))continue;const e=te[t*3+k];if(e<0)continue;const a=ea[e],b=eb[e];bedge.push([a,b,o>=0]);for(const q of [a,b])if(!par.has(q))par.set(q,q);const x=fd(a),y=fd(b);if(x!==y)par.set(x,y);}
  const loops=new Map();for(const [a,b,nb] of bedge){const r=fd(a);let L=loops.get(r);if(!L){L={vs:new Set(),nb:false};loops.set(r,L);}L.vs.add(a);L.vs.add(b);if(nb)L.nb=true;}
  const list=[...loops.values()].sort((a,b)=>b.vs.size-a.vs.size);if(list.length<2)return null;const main=list[0];
  /* where the existing cuts inside the chart reach each opening */
  const inner=new Set();for(const t of tris)for(let k=0;k<3;k++){const e=te[t*3+k];if(e>=0&&cut[e]&&topo.adj[t*3+k]>=0&&inC.has(topo.adj[t*3+k])){inner.add(ea[e]);inner.add(eb[e]);}}
  const dist=(a,b)=>{const pa=wpos.get(a),pb=wpos.get(b);return Math.hypot(P[pa]-P[pb],P[pa+1]-P[pb+1],P[pa+2]-P[pb+2]);};
  const added=[];let nseam=0;
  for(const L of list){if(L===main||!L.nb||L.vs.size<10)continue;
    let p1=-1;for(const w of L.vs)if(inner.has(w)){p1=w;break;}if(p1<0)continue;
    let p2=-1,bd=-1;for(const w of L.vs){const d=dist(p1,w);if(d>bd){bd=d;p2=w;}}if(p2<0||bd<1e-9)continue;
    const a=wpos.get(p1),b=wpos.get(p2),dx=(P[b]-P[a])/bd,dy=(P[b+1]-P[a+1])/bd,dz=(P[b+2]-P[a+2])/bd;
    /* the cheapest way from p2 to the main opening, going mostly along "down" and ending below p2 */
    const D=new Map([[p2,0]]),prev=new Map(),h=uwHeap();h.push(0,p2);let hit=-1;
    while(h.size()){const [d,w]=h.pop();if(d>D.get(w))continue;
      if(w!==p2&&main.vs.has(w)){const q=wpos.get(w);if((P[q]-P[b])*dx+(P[q+1]-P[b+1])*dy+(P[q+2]-P[b+2])*dz>bd*.3){hit=w;break;}}
      for(let i=cnt[w];i<cnt[w+1];i++){const e=ve[i];if(!(inC.has(e0[e])||(e1[e]>=0&&inC.has(e1[e]))))continue;if(cut[e]&&!(main.vs.has(ea[e])&&main.vs.has(eb[e])))continue;
        const o=ea[e]===w?eb[e]:ea[e],qa=wpos.get(w),qb=wpos.get(o);if(qb===undefined)continue;const ex=P[qb]-P[qa],ey=P[qb+1]-P[qa+1],ez=P[qb+2]-P[qa+2],len=Math.hypot(ex,ey,ez)||1e-12,c=(ex*dx+ey*dy+ez*dz)/len;
        const nd=d+len*(c<-.2?10:1+3*(1-Math.max(0,c)))*(cost[e]/Math.max(len,1e-12)>0?1:1);if(nd<(D.has(o)?D.get(o):1e30)){D.set(o,nd);prev.set(o,[w,e]);h.push(nd,o);}}}
    if(hit<0)continue;let w=hit;while(w!==p2){const [pw,e]=prev.get(w);if(!cut[e])added.push([e,cut[e],onCut[ea[e]],onCut[eb[e]]]);w=pw;}nseam++;}
  if(!nseam)return null;
  for(const [e] of added){cut[e]=1;onCut[ea[e]]=1;onCut[eb[e]]=1;}
  const undo=()=>{for(let i=added.length-1;i>=0;i--){const [e,c,a,b]=added[i];cut[e]=c;onCut[ea[e]]=a;onCut[eb[e]]=b;}};
  /* the panels now */
  const out=[],seen=new Set();
  for(const s0 of tris){if(seen.has(s0))continue;const P2={id:-1,tris:[],mat:C.mat,nx:0,ny:0,nz:0,area:0,kids:null},st=[s0];seen.add(s0);
    while(st.length){const t=st.pop();P2.tris.push(t);P2.nx+=topo.nx[t]*topo.area[t];P2.ny+=topo.ny[t]*topo.area[t];P2.nz+=topo.nz[t]*topo.area[t];P2.area+=topo.area[t];
      for(let k=0;k<3;k++){const o=ctx.adj[t*3+k];if(o>=0&&inC.has(o)&&!seen.has(o)&&!cut[te[t*3+k]]){seen.add(o);st.push(o);}}}
    out.push(P2);}
  out.undo=undo;if(out.length<2){undo();return null;}return out;}

/* ---- pelts and sewing patterns: find the closed loops (0.56) ----
   Measure how far every point of a shell is from its biggest opening (the hem, say) and cut the shell into rings of equal distance. Following the rings
   outward, a tube (a sleeve, a leg) stays one ring wide, and where it splits in two (the shoulder, the crotch) the ring around the split is a closed loop.
   Seams go along those closed loops; what lies between two loops is a tube or a panel, and each tube then needs only one seam along its length.
   Returns, for every triangle, the number of the piece it belongs to. */
function uwReebPieces(m,topo,opt){const {T,tw,deg,area}=topo,Wn=topo.W,P=m.pos,I=m.idx,mat=m.triMat||null;
  const adj=Int32Array.from(topo.adj);if(mat)for(let t=0;t<T;t++)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0&&mat[o]!==mat[t])adj[t*3+k]=-1;}
  const crease=opt.creaseDeg?uwCreaseMask(m,topo,opt):null;if(crease)for(let t=0;t<T;t++)for(let k=0;k<3;k++)if(crease[t*3+k])adj[t*3+k]=-1;
  const grp=new Int32Array(T).fill(-1);let ng=0;
  /* shells */
  const sh=new Int32Array(T).fill(-1);const shells=[];
  for(let s=0;s<T;s++){if(sh[s]>=0||deg[s])continue;const id=shells.length,L=[s],st=[s];sh[s]=id;while(st.length){const t=st.pop();for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0&&sh[o]<0&&!deg[o]){sh[o]=id;L.push(o);st.push(o);}}}shells.push(L);}
  const WX=new Float64Array(Wn*3);for(let t=0;t<T;t++)for(let k=0;k<3;k++){const w=tw[t*3+k],v=I[t*3+k];WX[w*3]=P[v*3];WX[w*3+1]=P[v*3+1];WX[w*3+2]=P[v*3+2];}
  const minFrac=opt.reebMin||.0015;
  for(const L of shells){
    if(L.length<200){for(const t of L)grp[t]=ng;ng++;continue;}
    /* welded neighbours inside the shell, and its border corners */
    const nbr=new Map(),bord=new Set(),cntE=new Map();
    const link=(a,b)=>{let x=nbr.get(a);if(!x){x=new Set();nbr.set(a,x);}x.add(b);};
    for(const t of L)for(let k=0;k<3;k++){const a=tw[t*3+k],b=tw[t*3+(k+1)%3];link(a,b);link(b,a);if(adj[t*3+k]<0){bord.add(a);bord.add(b);}}
    /* the longest border loop is the source (all its corners at distance 0); with no border, the lowest point */
    let src=[...bord];
    if(bord.size){const par=new Map();const f=x=>{let r=x;while(par.get(r)!==r)r=par.get(r);return r;};for(const w of bord)par.set(w,w);
      for(const t of L)for(let k=0;k<3;k++)if(adj[t*3+k]<0){const a=f(tw[t*3+k]),b=f(tw[t*3+(k+1)%3]);if(a!==b)par.set(a,b);}
      const loops=new Map();for(const w of bord){const r=f(w);let l=loops.get(r);if(!l){l=[];loops.set(r,l);}l.push(w);}
      let best=null,bl=-1;for(const l of loops.values()){let len=0;for(const w of l)len+=1;if(len>bl){bl=len;best=l;}}src=best;}
    else{let lo=null,ly=1e30;for(const w of nbr.keys())if(WX[w*3+1]<ly){ly=WX[w*3+1];lo=w;}src=[lo];}
    /* distance along the surface */
    const dist=new Map(),h=uwHeap(),ids=[...nbr.keys()],idx=new Map();ids.forEach((w,i)=>idx.set(w,i));const D=new Float64Array(ids.length).fill(1e30);
    for(const w of src){D[idx.get(w)]=0;h.push(0,idx.get(w));}
    while(h.size()){const [d,i]=h.pop();if(d>D[i])continue;const w=ids[i];for(const o of nbr.get(w)){const j=idx.get(o),nd=d+Math.hypot(WX[w*3]-WX[o*3],WX[w*3+1]-WX[o*3+1],WX[w*3+2]-WX[o*3+2]);if(nd<D[j]){D[j]=nd;h.push(nd,j);}}}
    let mx=0;for(const d of D)if(d<1e29&&d>mx)mx=d;if(mx<=0){for(const t of L)grp[t]=ng;ng++;continue;}
    /* rings three edge lengths thick, so a ring is not torn apart by the triangles */
    let le=0,ln=0;for(const [w,set] of nbr)for(const o of set){le+=Math.hypot(WX[w*3]-WX[o*3],WX[w*3+1]-WX[o*3+1],WX[w*3+2]-WX[o*3+2]);ln++;}const avgE=ln?le/ln:mx/40,NB=Math.max(8,Math.min(160,Math.round(mx/(opt.reebThick||3)/avgE)));
    const band=t=>{const a=D[idx.get(tw[t*3])],b=D[idx.get(tw[t*3+1])],c=D[idx.get(tw[t*3+2])];return Math.min(NB-1,Math.floor(Math.min(a,b,c)/mx*NB));};/* the band of a triangle's nearest corner: rings stay in one piece */
    const tb=new Map();for(const t of L)tb.set(t,band(t));
    /* rings: connected triangles of the same band */
    const node=new Map();const nodes=[];
    for(const s of L){if(node.has(s))continue;const id=nodes.length,N={id,band:tb.get(s),tris:[],area:0,up:new Set(),down:new Set()},st=[s];node.set(s,id);
      while(st.length){const t=st.pop();N.tris.push(t);N.area+=area[t];for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0&&!node.has(o)&&tb.get(o)===N.band){node.set(o,id);st.push(o);}}}
      nodes.push(N);}
    for(const t of L)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0)continue;const a=node.get(t),b=node.get(o);if(a===b)continue;if(nodes[a].band<nodes[b].band){nodes[a].up.add(b);nodes[b].down.add(a);}else if(nodes[a].band>nodes[b].band){nodes[a].down.add(b);nodes[b].up.add(a);}}
    /* small rings (a pocket, a seam allowance) belong to the bigger ring beside them */
    const tot=L.reduce((s,t)=>s+area[t],0),pu=nodes.map(n=>n.id);const pf=x=>{while(pu[x]!==x){pu[x]=pu[pu[x]];x=pu[x];}return x;};
    for(const N of nodes){if(N.area>=tot*minFrac)continue;let bn=-1,ba=-1;for(const o of [...N.up,...N.down]){if(nodes[o].area>ba){ba=nodes[o].area;bn=o;}}if(bn>=0){const a=pf(N.id),b=pf(bn);if(a!==b)pu[a]=b;}}
    /* a ring where the surface splits (two rings above it) or joins (two below) gets a closed loop cut on each side of the split */
    const big=nodes.filter(n=>pf(n.id)===n.id||true);
    const cutLink=new Set();
    const bigUp=n=>[...n.up].filter(o=>nodes[o].area>=tot*minFrac),bigDown=n=>[...n.down].filter(o=>nodes[o].area>=tot*minFrac);
    for(const N of nodes){if(N.area<tot*minFrac)continue;const up=bigUp(N),dn=bigDown(N);if(up.length>=2)for(const o of up)cutLink.add(N.id+'>'+o);if(dn.length>=2)for(const o of dn)cutLink.add(o+'>'+N.id);}
    /* pieces: rings joined except across a cut loop */
    const pp=nodes.map(n=>n.id);const ff=x=>{while(pp[x]!==x){pp[x]=pp[pp[x]];x=pp[x];}return x;};
    for(const N of nodes){for(const o of N.up){if(cutLink.has(N.id+'>'+o))continue;const a=ff(N.id),b=ff(o);if(a!==b)pp[a]=b;}}
    /* small rings follow the bigger ring they were put with */
    for(const N of nodes){if(N.area<tot*minFrac){const r=pf(N.id);if(r!==N.id){const a=ff(N.id),b=ff(r);if(a!==b)pp[a]=b;}}}
    const pid=new Map();for(const t of L){const r=ff(node.get(t));let g=pid.get(r);if(g===undefined){g=ng++;pid.set(r,g);}grp[t]=g;}
    if(opt.reebCut!==false)uwSlideSplits(m,topo,adj,L,node,nodes,cutLink,grp,opt);
    /* a piece that is only a sliver of the shell (a ring that happened to split twice) joins the piece it shares the most border with */
    for(let pass=0;pass<4;pass++){const parea=new Map(),touch=new Map();for(const t of L){const g=grp[t];parea.set(g,(parea.get(g)||0)+area[t]);}
      for(const t of L)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0||grp[o]===grp[t])continue;const key=grp[t]+'>'+grp[o];touch.set(key,(touch.get(key)||0)+1);}
      const move=new Map();for(const [g,a] of parea){if(a>=tot*(opt.reebSliver||.065))continue;let best=-1,bc=0;for(const [key,c] of touch){const [x,y]=key.split('>').map(Number);if(x===g&&c>bc){bc=c;best=y;}}if(best>=0&&parea.get(best)>a)move.set(g,best);}
      if(!move.size)break;for(const t of L)if(move.has(grp[t]))grp[t]=move.get(grp[t]);}}
  /* the rings' borders are staircases: even them out (a triangle with two sides in another piece joins it) */
  for(let r=0;r<8;r++){let n=0;for(let t=0;t<T;t++){if(deg[t])continue;const g=grp[t],cs=[-1,-1,-1];let same=0;for(let k=0;k<3;k++){const o=adj[t*3+k];cs[k]=o>=0?grp[o]:-1;if(cs[k]===g)same++;}
      if(same>1)continue;let B=-1;for(let k=0;k<3;k++){if(cs[k]<0||cs[k]===g)continue;let c=0;for(let q=0;q<3;q++)if(cs[q]===cs[k])c++;if(c>=2){B=cs[k];break;}}
      if(B>=0){grp[t]=B;n++;}}
    if(!n)break;}
  return grp;}

/* a small piece that hugs one neighbour along most of its outline is not worth a seam of its own: a tailor would have cut it together with that piece.
   Works on the pieces found by uwReebPieces, before the cuts are planned (a piece joined afterwards would bring a loop of its own that no cut reaches). */
function uwAbsorbGroups(m,topo,grp,crease,opt){if(!grp||opt.absorb===false)return;const {T,deg,adj}=topo,mat=m.triMat||null,lim=opt.absorbTris||260,share=opt.absorbShare||.6;
  for(let pass=0;pass<4;pass++){
    /* the pieces as they stand: triangles joined over every edge that is not a piece border, a material change or a crease */
    const pc=new Int32Array(T).fill(-1),pg=[],pt=[];
    for(let s=0;s<T;s++){if(deg[s]||pc[s]>=0)continue;const id=pg.length,st=[s],list=[];pc[s]=id;pg.push(grp[s]);pt.push(list);
      while(st.length){const t=st.pop();list.push(t);for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0||deg[o]||pc[o]>=0||grp[o]!==grp[t]||(mat&&mat[o]!==mat[t])||(crease&&crease[t*3+k]))continue;pc[o]=id;st.push(o);}}}
    const move=new Map();
    for(let g=0;g<pg.length;g++){const list=pt[g];if(list.length>=lim)continue;const per=new Map();let perim=0,cre=0;
      for(const t of list)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0&&pc[o]===g)continue;perim++;if(o<0||deg[o])continue;per.set(pc[o],(per.get(pc[o])||0)+1);if((crease&&crease[t*3+k])||(mat&&mat[o]!==mat[t]))cre++;}
      let best=-1,bn=0;for(const [og,n] of per)if(n>bn){bn=n;best=og;}
      if(best<0||bn<perim*share||cre>bn*.25||pt[best].length<list.length*2||pg[best]===pg[g])continue;move.set(g,best);}
    for(const [g,b] of [...move])if(move.has(b))move.delete(g);
    if(!move.size)break;for(const [g,b] of move)for(const t of pt[g])grp[t]=pg[b];}}

/* a corner of a triangle belongs to the same place on the flat chart as the corners next to it, unless a seam (or a slit) lies between them */
function uwCornerClasses(C,topo){const cx=topo.cutCtx,{adj,te,cut}=cx,{tw}=topo,tris=C.tris,n=tris.length,lt=new Map();tris.forEach((t,i)=>lt.set(t,i));
  const par=new Int32Array(n*3);for(let i=0;i<par.length;i++)par[i]=i;const f=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
  const un=(a,b)=>{a=f(a);b=f(b);if(a!==b)par[a]=b;};
  for(let i=0;i<n;i++){const t=tris[i];for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0||cut[te[t*3+k]])continue;const j=lt.get(o);if(j===undefined)continue;
    for(const kk of [k,(k+1)%3]){const w=tw[t*3+kk];for(let q=0;q<3;q++)if(tw[o*3+q]===w){un(i*3+kk,j*3+q);break;}}}}
  const out=new Int32Array(n*3);for(let i=0;i<out.length;i++)out[i]=f(i);return out;}

/* ---- sharp creases that run a long way are seams (0.56) ----
   A cuff, a pocket flap, a collar, a zipper tape: each is outlined by a row of sharp edges (a pattern maker would cut right there).
   Sharp edges (opt.creaseDeg, 70° by default) that join into a chain of at least a dozen edges become cuts. Returns a mask over triangle sides. */
function uwCreaseMask(m,topo,opt){let deg=opt.creaseDeg||70,mask=null;/* a model that is creased everywhere (pleats, stitching) gets a higher threshold until the cuts are a few percent of its edges */
  for(let i=0;i<5;i++){mask=uwCreaseMask1(m,topo,Object.assign({},opt,{creaseDeg:deg}));let n=0,tot=0;for(let q=0;q<mask.length;q++){if(topo.adj[q]>=0){tot++;if(mask[q])n++;}}if(!tot||n/tot<(opt.creaseShare||.045))break;deg+=10;}
  return mask;}
function uwCreaseMask1(m,topo,opt){const {T,tw,adj,nx,ny,nz,deg}=topo,I=m.idx,P=m.pos,Wn=topo.W,cdeg=opt.creaseDeg||70,mat=m.triMat||null;
  const mask=new Uint8Array(T*3),cr=Math.cos(cdeg*Math.PI/180),par=new Int32Array(Wn);for(let i=0;i<Wn;i++)par[i]=i;const f=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
  const list=[];let sum=0,cnt=0;
  for(let t=0;t<T;t++){if(deg[t])continue;for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<t||o<0)continue;const a=I[t*3+k]*3,b=I[t*3+(k+1)%3]*3,len=Math.hypot(P[a]-P[b],P[a+1]-P[b+1],P[a+2]-P[b+2]);sum+=len;cnt++;
      if(nx[t]*nx[o]+ny[t]*ny[o]+nz[t]*nz[o]<cr){list.push([t,k,o,len]);const x=f(tw[t*3+k]),y=f(tw[t*3+(k+1)%3]);if(x!==y)par[x]=y;}}}
  const avg=cnt?sum/cnt:0,cl=new Map(),ce=new Map();
  for(const [t,k,o,len] of list){const r=f(tw[t*3+k]);cl.set(r,(cl.get(r)||0)+len);ce.set(r,(ce.get(r)||0)+1);}
  const minE=opt.creaseMin||14;
  for(const [t,k,o] of list){const r=f(tw[t*3+k]);if(ce.get(r)>=minE&&cl.get(r)>=avg*minE){mask[t*3+k]=1;/* the other side of the edge */for(let q=0;q<3;q++)if(adj[o*3+q]===t){mask[o*3+q]=1;break;}}}
  return mask;}

/* ---- unrolling (0.56) ----
   A conformal map (LSCM) of a bucket shape, a tube with a flat shoulder on top, fans out around the neck and lies on itself. A tailor lays the cloth flat
   instead: every triangle is put down against the one before it with its true shape, front after front. Where the fronts meet there are small gaps and
   overlaps; as-rigid-as-possible relaxation closes them. Returns the flat places (U,V) for the chart's corners. */
function uwUnroll(m,cv,tr,X,Y,start){const P=m.pos,n=cv.length,T=tr.length,U=Float64Array.from(X),V=Float64Array.from(Y),set=new Uint8Array(n),done=new Uint8Array(T);
  const d3=(a,b)=>Math.hypot(P[cv[a]*3]-P[cv[b]*3],P[cv[a]*3+1]-P[cv[b]*3+1],P[cv[a]*3+2]-P[cv[b]*3+2]);
  const em=new Map();for(let t=0;t<T;t++)for(let k=0;k<3;k++){const a=tr[t][k],b=tr[t][(k+1)%3],key=a<b?a*n+b:b*n+a;let l=em.get(key);if(!l){l=[];em.set(key,l);}l.push(t);}
  /* start in the middle of the chart */
  let cx=0,cy=0,cz=0;for(let i=0;i<n;i++){cx+=P[cv[i]*3];cy+=P[cv[i]*3+1];cz+=P[cv[i]*3+2];}cx/=n;cy/=n;cz/=n;
  let s0=start>=0?start:0,bd=1e30;if(!(start>=0))for(let t=0;t<T;t++){const [a,b,c]=tr[t];const mx=(P[cv[a]*3]+P[cv[b]*3]+P[cv[c]*3])/3-cx,my=(P[cv[a]*3+1]+P[cv[b]*3+1]+P[cv[c]*3+1])/3-cy,mz=(P[cv[a]*3+2]+P[cv[b]*3+2]+P[cv[c]*3+2])/3-cz,d=mx*mx+my*my+mz*mz;if(d<bd){bd=d;s0=t;}}
  const q=[s0];done[s0]=1;{const [a,b,c]=tr[s0],L=d3(a,b),dc=d3(a,c),db=d3(b,c);U[a]=0;V[a]=0;U[b]=L;V[b]=0;const x=(dc*dc-db*db+L*L)/(2*L);U[c]=x;V[c]=Math.sqrt(Math.max(0,dc*dc-x*x));set[a]=set[b]=set[c]=1;}
  for(let qi=0;qi<q.length;qi++){const t=q[qi];
    for(let k=0;k<3;k++){const a=tr[t][k],b=tr[t][(k+1)%3],key=a<b?a*n+b:b*n+a,l=em.get(key);if(!l)continue;
      for(const t2 of l){if(done[t2])continue;done[t2]=1;q.push(t2);const c2=tr[t2].find(v=>v!==a&&v!==b);if(c2===undefined||set[c2])continue;
        const ex=U[b]-U[a],ey=V[b]-V[a],L=Math.hypot(ex,ey);if(L<1e-18)continue;const d1=d3(a,c2),d2=d3(b,c2),x=(d1*d1-d2*d2+L*L)/(2*L),y=-Math.sqrt(Math.max(0,d1*d1-x*x));
        /* the third corner of this triangle lies on the other side of the edge from the corner of the triangle it came from */
        const ox=ex/L,oy=ey/L;U[c2]=U[a]+x*ox-y*oy;V[c2]=V[a]+x*oy+y*ox;set[c2]=1;}}}
  return {U,V,reached:set.reduce((a,b)=>a+b,0)};}

/* ---- the shortest loop: slide a split to where the tube is narrowest (0.56) ----
   A ring found by distance can sit crooked across a sleeve. Between the part of the garment below the split and the sleeve above it, the shortest
   closed loop of edges that separates them is the sleeve's root as a tailor would cut it. It is found as a minimum cut (maximum flow) on the triangles
   in a window around the split, an edge costing its length. */
function uwMaxFlowSide(n,edges,S,Tn){/* edges: [a,b,cap] undirected; returns a Uint8Array: 1 = on the source side after the cut */
  const m=edges.length*2,to=new Int32Array(m),cap=new Float64Array(m),nx=new Int32Array(m),head=new Int32Array(n+2).fill(-1);let c=0;
  const add=(a,b,w)=>{to[c]=b;cap[c]=w;nx[c]=head[a];head[a]=c++;to[c]=a;cap[c]=w;nx[c]=head[b];head[b]=c++;};
  for(const [a,b,w] of edges)add(a,b,w);
  const lvl=new Int32Array(n+2),cur=new Int32Array(n+2),q=new Int32Array(n+2);
  const bfs=()=>{lvl.fill(-1);lvl[S]=0;let h=0,t=0;q[t++]=S;while(h<t){const u=q[h++];for(let e=head[u];e>=0;e=nx[e])if(cap[e]>1e-12&&lvl[to[e]]<0){lvl[to[e]]=lvl[u]+1;q[t++]=to[e];}}return lvl[Tn]>=0;};
  const dfs=(u,f)=>{if(u===Tn)return f;for(;cur[u]>=0;cur[u]=nx[cur[u]]){const e=cur[u],v=to[e];if(cap[e]>1e-12&&lvl[v]===lvl[u]+1){const d=dfs(v,Math.min(f,cap[e]));if(d>1e-12){cap[e]-=d;cap[e^1]+=d;return d;}}}return 0;};
  let guard=0;while(bfs()&&guard++<400){for(let i=0;i<n+2;i++)cur[i]=head[i];let f;while((f=dfs(S,1e30))>1e-12);}
  const side=new Uint8Array(n+2);const st=[S];side[S]=1;while(st.length){const u=st.pop();for(let e=head[u];e>=0;e=nx[e])if(cap[e]>1e-12&&!side[to[e]]){side[to[e]]=1;st.push(to[e]);}}
  return side;}

function uwSlideSplits(m,topo,adj,L,node,nodes,cutLink,grp,opt){const P=m.pos,I=m.idx,W=opt.reebWindow||2;
  const len=(t,k)=>{const a=I[t*3+k]*3,b=I[t*3+(k+1)%3]*3;return Math.hypot(P[a]-P[b],P[a+1]-P[b+1],P[a+2]-P[b+2]);};
  const subtree=(r)=>{const seen=new Set([r]),st=[r];while(st.length){const x=st.pop();for(const o of nodes[x].up)if(!seen.has(o)){seen.add(o);st.push(o);}}return seen;};
  const links=[...cutLink].map(k=>k.split('>').map(Number)).sort((a,b)=>nodes[b[1]].area-nodes[a[1]].area);
  for(const [A,B] of links){if(nodes[A].band>=nodes[B].band)continue;const k=nodes[A].band,sub=subtree(B);
    const free=[],freeIdx=new Map();const state=new Map();/* 0 free, 1 source, 2 sink */
    for(const t of L){const nd=node.get(t),band=nodes[nd].band,inSub=sub.has(nd);let st;
      if(inSub){st=band>=k+1+W?2:(band<=k+W?0:2);if(band>k+W)st=2;}
      else{st=(band>=k-W&&band<=k&&!sub.has(nd)&&grp[t]===grp[nodes[A].tris[0]])?0:1;}
      state.set(t,st);if(st===0){freeIdx.set(t,free.length);free.push(t);}}
    if(free.length<8||free.length>40000)continue;
    const nF=free.length,Sn=nF,Tn=nF+1,edges=[];let toSink=0;
    /* in a tube of even width every loop is as short as the next: prefer the one nearest the junction */
    const dev=t=>1+(opt.reebBias||.25)*Math.max(0,nodes[node.get(t)].band-k);
    for(const t of free){const i=freeIdx.get(t);for(let q=0;q<3;q++){const o=adj[t*3+q];if(o<0)continue;const so=state.get(o);if(so===undefined)continue;const w=len(t,q)*Math.min(dev(t),dev(o));
        if(so===0){const j=freeIdx.get(o);if(j>i)edges.push([i,j,w]);}else if(so===1)edges.push([i,Sn,w]);else{edges.push([i,Tn,w]);toSink++;}}}
    if(!toSink)continue;
    const side=uwMaxFlowSide(nF+2,edges,Sn,Tn),gA=grp[nodes[A].tris[0]],gB=grp[nodes[B].tris[0]];
    for(let i=0;i<nF;i++)grp[free[i]]=side[i]?gA:gB;}}

/* ---------- small pieces join their neighbour (0.57, the weapons pass) ----------
   Hand-made weapon unwraps have about half as many pieces as the Artist style gave: screws, little plates and trims that
   the artist left on the piece next to them. After the pieces are flattened, each very small one is tried on the neighbour it
   shares the most border with: the two are flattened together, and the join is kept only when the result does not stretch
   much more than the neighbour did and does not lie on itself. */
function* uwAbsorbSmallG(m,topo,opt,items,budgetMs){const {adj,area,nx,ny,nz}=topo,T=topo.T,mat=m.triMat||null,lim=(opt.stretchMax||1.5)*1.25,thr=opt.smallPiece||.004,t0=performance.now();
  const owner=new Int32Array(T).fill(-1),alive=items.map(()=>true),A=items.map(it=>{let a=0;for(const t of it.C.tris)a+=area[t];return a;});let total=0;for(const a of A)total+=a;
  items.forEach((it,i)=>{for(const t of it.C.tris)owner[t]=i;});const tried=new Set();let merged=0;
  for(;;){if(performance.now()-t0>budgetMs)break;
    let s=-1;for(let i=0;i<items.length;i++)if(alive[i]&&!tried.has(i)&&A[i]<total*thr&&(s<0||A[i]<A[s]))s=i;if(s<0)break;tried.add(s);
    const share=new Map();let border=0;for(const t of items[s].C.tris)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0)continue;const ow=owner[o];if(ow===s||ow<0)continue;border++;share.set(ow,(share.get(ow)||0)+1);}
    if(!border)continue;
    const cand=[...share.entries()].filter(([j,n])=>alive[j]&&n>=border*.25&&(!mat||items[j].C.mat===items[s].C.mat)).sort((a,b)=>b[1]-a[1]).slice(0,2);
    for(const [j] of cand){if(performance.now()-t0>budgetMs)break;
      const tris=items[j].C.tris.concat(items[s].C.tris);let nxs=0,nys=0,nzs=0,ar=0;for(const t of tris){nxs+=nx[t]*area[t];nys+=ny[t]*area[t];nzs+=nz[t]*area[t];ar+=area[t];}
      const C={id:-1,tris,mat:items[j].C.mat,nx:nxs,ny:nys,nz:nzs,area:ar,kids:null},F=yield* uwFlattenG(m,topo,C,opt),st=uwChartStretch(m,F),base=Math.max(uwChartStretch(m,items[j].F),1.2);
      if(st<=Math.min(lim,base*1.3)&&uwSelfOverlap(F,null)<(opt.overlapMax||.012)&&!(opt.fillMin&&C.tris.length>=(opt.fillMinTris||40)&&uwBoxFill(F)<opt.fillMin*.9)){
        items[j]={C,F};alive[s]=false;A[j]=ar;for(const t of items[s].C.tris)owner[t]=j;for(const t of tris)owner[t]=j;tried.delete(j);merged++;break;}}}
  return items.filter((_,i)=>alive[i]);}
