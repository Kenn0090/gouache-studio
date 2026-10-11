/* ================= Artist style unwrap (0.55.2) =================
   Learned from 20 hand-made unwraps (a backpack, jackets, a helmet, swords, shoes…): artists keep few, big pieces
   (10–30 per 10,000 triangles, where the plain unwrap made 110), cut mostly along hard edges, straighten the pieces to the
   square's axes and fill the square well. This stage joins the small pieces of the plain unwrap back together while they stay
   "developable" (can lie flat without stretching: the angle defect at inner corners stays small), joining across soft edges first
   so the seams that are left sit on the hard edges. After flattening, a joined piece that still stretches too much is split
   back into the pieces it was made from. */
const uwDbg={disk:0,def:0,ok:0,q:0,defs:[]};
const UW_ARTIST={angle:50,flat:20,artist:true,straighten:true,defBudget:1.2,stretchMax:1.5,qMax:3};
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
    const V=C.vm.size+D.vm.size-sv,Bn=C.B+D.B-2*se,F=C.F+D.F,E=(3*F+Bn)/2;if(V-E+F!==1){uwDbg.disk++;return null;}/* still one disk */
    let def=C.def+D.def;for(const [v,s] of sh){const a=C.vm.get(v),b=D.vm.get(v);if(!a||!b)continue;def-=uwDefOf(a)+uwDefOf(b);def+=uwDefOf({a:a.a+b.a,be:a.be+b.be-2*s});}
    if(def>budget*(1+Math.log10(1+(C.F+D.F)/200)*0.3)){uwDbg.def++;uwDbg.defs.push(def);return null;}uwDbg.ok++;
    /* how compact the joined piece is: its outline length squared over 16 times its area (1 for a square, 3 for a 1:8 strip); jagged or sprawling outlines score high */
    const Lbn=C.Lb+D.Lb-2*sl,Q=Lbn*Lbn/(16*Math.max(C.area+D.area,1e-12));if(Q>(opt.qMax||3)){uwDbg.q++;return null;}
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
/* how stretched a flattened chart is (1 = perfect): the average over its triangles, weighted by area */
function uwChartStretch(m,F){const P=m.pos,{verts,tris,u,v}=F;let s2=0,a3=0,a2=0;
  for(const [a,b,c] of tris){const pa=verts[a]*3,pb=verts[b]*3,pc=verts[c]*3;
    const x1=u[a],y1=v[a],x2=u[b],y2=v[b],x3=u[c],y3=v[c],A=((x2-x1)*(y3-y1)-(x3-x1)*(y2-y1))/2,aa=Math.abs(A);if(aa<1e-14)continue;
    const q=[0,1,2].map(k=>P[pa+k]),r=[0,1,2].map(k=>P[pb+k]),s=[0,1,2].map(k=>P[pc+k]);
    let ss=0,st=0;for(let k=0;k<3;k++){const Ss=(q[k]*(y2-y3)+r[k]*(y3-y1)+s[k]*(y1-y2))/(2*A),St=(q[k]*(x3-x2)+r[k]*(x1-x3)+s[k]*(x2-x1))/(2*A);ss+=Ss*Ss;st+=St*St;}
    const ux=r[0]-q[0],uy=r[1]-q[1],uz=r[2]-q[2],wx=s[0]-q[0],wy=s[1]-q[1],wz=s[2]-q[2],t3=Math.hypot(uy*wz-uz*wy,uz*wx-ux*wz,ux*wy-uy*wx)/2;
    s2+=(ss+st)/2*t3;a3+=t3;a2+=aa;}
  if(a3<=0||a2<=0)return 1;return Math.sqrt(s2/a3)*Math.sqrt(a2/a3);}
/* flatten a chart; a joined chart that stretches too much is split back into the pieces it was made of */
function* uwFlattenSplitG(m,topo,C,opt){const F=yield* uwFlattenG(m,topo,C,opt);
  if(C.kids&&C.kids.length&&uwChartStretch(m,F)>(opt.stretchMax||1.5)){const out=[];for(const k of C.kids){const r=yield* uwFlattenSplitG(m,topo,k,opt);for(const x of r)out.push(x);}return out;}
  return [{C,F}];}
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
