/* ================= Artist style unwrap (0.55.2) =================
   Learned from 20 hand-made unwraps (a backpack, jackets, a helmet, swords, shoes…): artists keep few, big pieces
   (10–30 per 10,000 triangles, where the plain unwrap made 110), cut mostly along hard edges, straighten the pieces to the
   square's axes and fill the square well. This stage joins the small pieces of the plain unwrap back together while they stay
   "developable" (can lie flat without stretching: the angle defect at inner corners stays small), joining across soft edges first
   so the seams that are left sit on the hard edges. After flattening, a joined piece that still stretches too much is split
   back into the pieces it was made from. */
const UW_CLOTH={angle:60,flat:20,artist:false,cut:true,straighten:true,defBudget:2.5,stretchMax:1.8,qMax:99,flex:0.3,smooth:false,coneThr:.9,flipTol:.04,maxSlits:60};
const UW_ARTIST={angle:89,flat:20,artist:true,straighten:true,defBudget:2.5,stretchMax:2.2,qMax:99,flex:0.4};
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
  const maj=pos>=neg?1:-1;let a3=0,a2=0;for(let i=0;i<n;i++){a3+=A3[i];a2+=AA[i];}const k=a2>0&&a3>0?a2/a3:1;let s2=0;
  for(let i=0;i<n;i++){const [a,b,c]=tris[i];let e;if(E[i]<0||SG[i]!==maj)e=400;else e=E[i]*k;/* 400 = a stretch of 20 */s2+=e*A3[i];const ex=Math.max(0,e-1)*A3[i];ve[a]+=ex;ve[b]+=ex;ve[c]+=ex;}
  return {stretch:a3>0?Math.sqrt(s2/a3):1,ve};}
function uwChartStretch(m,F){return uwChartEnergy(m,F).stretch;}
/* flatten a chart; one that stretches too much is split: a joined chart back into the pieces it was made of, a single piece
   by cutting it again with a tighter angle (a big cone can swallow a whole dome that cannot lie flat) */
function* uwFlattenSplitG(m,topo,C,opt,depth){depth=depth||0;const F=yield* uwFlattenG(m,topo,C,opt),lim=opt.stretchMax||1.5;
  if(C.tris.length<8)return [{C,F}];
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
  const grp=opt.reeb===false?null:uwReebPieces(m,topo,opt);
  const adj=Int32Array.from(topo.adj);if(mat||grp)for(let t=0;t<T;t++)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0&&((mat&&mat[o]!==mat[t])||(grp&&grp[o]!==grp[t])))adj[t*3+k]=-1;}
  const WX=new Float64Array(Wn*3);for(let t=0;t<T;t++)for(let k=0;k<3;k++){const w=tw[t*3+k],v=I[t*3+k];WX[w*3]=P[v*3];WX[w*3+1]=P[v*3+1];WX[w*3+2]=P[v*3+2];}
  /* edges */
  const em=new Map(),ea=[],eb=[],e0=[],e1=[];const te=new Int32Array(T*3).fill(-1);
  for(let t=0;t<T;t++){if(deg[t])continue;for(let k=0;k<3;k++){const a=tw[t*3+k],b=tw[t*3+(k+1)%3],key=a<b?a*Wn+b:b*Wn+a;let e=em.get(key);if(e===undefined){e=ea.length;em.set(key,e);ea.push(a);eb.push(b);e0.push(t);e1.push(-1);}else if(e1[e]<0)e1[e]=t;else e1[e]=-2;te[t*3+k]=e;}}
  const E=ea.length,cut=new Uint8Array(E),len=new Float64Array(E),cost=new Float64Array(E),bnd=new Uint8Array(E);
  for(let e=0;e<E;e++){const a=ea[e],b=eb[e];len[e]=Math.hypot(WX[a*3]-WX[b*3],WX[a*3+1]-WX[b*3+1],WX[a*3+2]-WX[b*3+2]);
    const border=e1[e]<0||(grp&&grp[e0[e]]!==grp[e1[e]])||(mat&&mat[e0[e]]!==mat[e1[e]]);bnd[e]=border?1:0;let hard=0;if(!border){const t=e0[e],u=e1[e],d=nx[t]*nx[u]+ny[t]*ny[u]+nz[t]*nz[u];hard=Math.min(1,Math.acos(Math.max(-1,Math.min(1,d)))*180/Math.PI/55);}
    cost[e]=border?0:len[e]*(1+3*(1-hard));if(border)cut[e]=1;}
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
function uwSlit(m,topo,C,ctx,seg,F){const {tw,wv}=topo,{adj,te,cut,ea,eb,e0,e1,cost,cnt,ve,onCut}=ctx,chart=seg.chart,id=C.id,en=uwChartEnergy(m,F,topo);
  let bi=-1,bv=0;for(let i=0;i<en.ve.length;i++){const w=wv[F.verts[i]];if(onCut[w])continue;if(en.ve[i]>bv){bv=en.ve[i];bi=i;}}
  if(bi<0)return null;const start=wv[F.verts[bi]];
  /* Dijkstra inside the chart from that corner to a corner that touches a seam or border */
  const inC=new Set(C.tris),dist=new Map([[start,0]]),prev=new Map(),h=uwHeap();h.push(0,start);let hit=-1;
  while(h.size()){const [d,w]=h.pop();if(d>dist.get(w))continue;if(w!==start&&onCut[w]){hit=w;break;}
    for(let i=cnt[w];i<cnt[w+1];i++){const e=ve[i];const t0=e0[e],t1=e1[e];if(!(inC.has(t0)||(t1>=0&&inC.has(t1))))continue;if(cut[e])continue;const o=ea[e]===w?eb[e]:ea[e],nd=d+cost[e];if(nd<(dist.has(o)?dist.get(o):1e30)){dist.set(o,nd);prev.set(o,[w,e]);h.push(nd,o);}}}
  if(hit<0)return null;let w=hit,n=0;while(w!==start){const [p,e]=prev.get(w);cut[e]=1;onCut[ea[e]]=1;onCut[eb[e]]=1;w=p;n++;}
  /* the pieces now */
  const out=[],seen=new Set();let nid=0;
  for(const s0 of C.tris){if(seen.has(s0))continue;const P2={id:-1,tris:[],mat:C.mat,nx:0,ny:0,nz:0,area:0,kids:null},st=[s0];seen.add(s0);
    while(st.length){const t=st.pop();P2.tris.push(t);P2.nx+=topo.nx[t]*topo.area[t];P2.ny+=topo.ny[t]*topo.area[t];P2.nz+=topo.nz[t]*topo.area[t];P2.area+=topo.area[t];
      for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0&&inC.has(o)&&!seen.has(o)&&!cut[te[t*3+k]]){seen.add(o);st.push(o);}}}
    out.push(P2);}
  return out;}
function* uwCutRefineG(m,topo,opt,C,seg,depth){depth=depth||0;const F=yield* uwFlattenG(m,topo,C,opt),lim=opt.stretchMax||1.8;
  if(C.tris.length<10||depth>=opt.maxSlits||uwChartStretch(m,F)<=lim)return [{C,F}];
  const parts=uwSlit(m,topo,C,seg.ctx,seg,F);if(!parts)return [{C,F}];
  const out=[];for(const c of parts)for(const x of yield* uwCutRefineG(m,topo,opt,c,seg,depth+1))out.push(x);return out;}

/* ---- pelts and sewing patterns: find the closed loops (0.56) ----
   Measure how far every point of a shell is from its biggest opening (the hem, say) and cut the shell into rings of equal distance. Following the rings
   outward, a tube (a sleeve, a leg) stays one ring wide, and where it splits in two (the shoulder, the crotch) the ring around the split is a closed loop.
   Seams go along those closed loops; what lies between two loops is a tube or a panel, and each tube then needs only one seam along its length.
   Returns, for every triangle, the number of the piece it belongs to. */
function uwReebPieces(m,topo,opt){const {T,tw,deg,area}=topo,Wn=topo.W,P=m.pos,I=m.idx,mat=m.triMat||null;
  const adj=Int32Array.from(topo.adj);if(mat)for(let t=0;t<T;t++)for(let k=0;k<3;k++){const o=adj[t*3+k];if(o>=0&&mat[o]!==mat[t])adj[t*3+k]=-1;}
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
    const pid=new Map();for(const t of L){const r=ff(node.get(t));let g=pid.get(r);if(g===undefined){g=ng++;pid.set(r,g);}grp[t]=g;}}
  /* the rings' borders are staircases: even them out (a triangle with two sides in another piece joins it) */
  for(let r=0;r<8;r++){let n=0;for(let t=0;t<T;t++){if(deg[t])continue;const g=grp[t],cs=[-1,-1,-1];let same=0;for(let k=0;k<3;k++){const o=adj[t*3+k];cs[k]=o>=0?grp[o]:-1;if(cs[k]===g)same++;}
      if(same>1)continue;let B=-1;for(let k=0;k<3;k++){if(cs[k]<0||cs[k]===g)continue;let c=0;for(let q=0;q<3;q++)if(cs[q]===cs[k])c++;if(c>=2){B=cs[k];break;}}
      if(B>=0){grp[t]=B;n++;}}
    if(!n)break;}
  return grp;}

/* a corner of a triangle belongs to the same place on the flat chart as the corners next to it, unless a seam (or a slit) lies between them */
function uwCornerClasses(C,topo){const cx=topo.cutCtx,{adj,te,cut}=cx,{tw}=topo,tris=C.tris,n=tris.length,lt=new Map();tris.forEach((t,i)=>lt.set(t,i));
  const par=new Int32Array(n*3);for(let i=0;i<par.length;i++)par[i]=i;const f=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
  const un=(a,b)=>{a=f(a);b=f(b);if(a!==b)par[a]=b;};
  for(let i=0;i<n;i++){const t=tris[i];for(let k=0;k<3;k++){const o=adj[t*3+k];if(o<0||cut[te[t*3+k]])continue;const j=lt.get(o);if(j===undefined)continue;
    for(const kk of [k,(k+1)%3]){const w=tw[t*3+kk];for(let q=0;q<3;q++)if(tw[o*3+q]===w){un(i*3+kk,j*3+q);break;}}}}
  const out=new Int32Array(n*3);for(let i=0;i<out.length;i++)out[i]=f(i);return out;}
