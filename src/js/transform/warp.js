/* ================= Warp grid =================
   n x n cells. Anchors A[row][col]; each cell edge is a cubic Bezier with two handles:
   hE[row][col] = handles of the horizontal edge from A[row][col] to A[row][col+1],
   vE[col][row] = handles of the vertical edge from A[row][col] to A[row+1][col].
   Inside a cell the surface is a Coons patch blending its four curved edges. */
ui.warpN=4;
function warpInit(n){const H=rectToQuad(xf.rect,xf.q),r=xf.rect,w=r[2]-r[0],h=r[3]-r[1],P=(fx,fy)=>apply3(H,r[0]+fx*w,r[1]+fy*h);
  const A=[],hE=[],vE=[];
  for(let j=0;j<=n;j++){const row=[];for(let i=0;i<=n;i++)row.push(P(i/n,j/n));A.push(row);}
  for(let j=0;j<=n;j++){const row=[];for(let i=0;i<n;i++)row.push([P((i+1/3)/n,j/n),P((i+2/3)/n,j/n)]);hE.push(row);}
  for(let i=0;i<=n;i++){const col=[];for(let j=0;j<n;j++)col.push([P(i/n,(j+1/3)/n),P(i/n,(j+2/3)/n)]);vE.push(col);}
  xf.warp={n,A,hE,vE,active:null,mesh:null};}
function bz(p0,c1,c2,p1,t){const u=1-t,a=u*u*u,b=3*u*u*t,c=3*u*t*t,d=t*t*t;return [a*p0[0]+b*c1[0]+c*c2[0]+d*p1[0],a*p0[1]+b*c1[1]+c*c2[1]+d*p1[1]];}
function cellPt(W,i,j,u,v){const A=W.A,t=W.hE[j][i],bt=W.hE[j+1][i],l=W.vE[i][j],rt=W.vE[i+1][j];
  const P00=A[j][i],P10=A[j][i+1],P01=A[j+1][i],P11=A[j+1][i+1];
  const C0=bz(P00,t[0],t[1],P10,u),C1=bz(P01,bt[0],bt[1],P11,u),D0=bz(P00,l[0],l[1],P01,v),D1=bz(P10,rt[0],rt[1],P11,v);
  const k=(q)=> (1-v)*C0[q]+v*C1[q]+(1-u)*D0[q]+u*D1[q]-((1-u)*(1-v)*P00[q]+u*(1-v)*P10[q]+(1-u)*v*P01[q]+u*v*P11[q]);
  return [k(0),k(1)];}
/* triangles with (document x, y, source x, y) per vertex */
function warpMesh(s){const W=s.warp;if(W.mesh)return W.mesh;const n=W.n,K=Math.max(8,Math.round(64/n)),r=s.rect,w=r[2]-r[0],h=r[3]-r[1];
  const out=new Float32Array(n*n*K*K*6*4);let o=0;const pts=new Array((K+1)*(K+1));
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    for(let b=0;b<=K;b++)for(let a=0;a<=K;a++){const u=a/K,v=b/K,p=cellPt(W,i,j,u,v);pts[b*(K+1)+a]=[p[0],p[1],r[0]+(i+u)/n*w,r[1]+(j+v)/n*h];}
    for(let b=0;b<K;b++)for(let a=0;a<K;a++){const q00=pts[b*(K+1)+a],q10=pts[b*(K+1)+a+1],q01=pts[(b+1)*(K+1)+a],q11=pts[(b+1)*(K+1)+a+1];
      for(const q of [q00,q10,q11,q00,q11,q01]){out[o++]=q[0];out[o++]=q[1];out[o++]=q[2];out[o++]=q[3];}}}
  return W.mesh=out;}
function warpBBOf(s){const W=s.warp;let b=[Infinity,Infinity,-Infinity,-Infinity];const add=p=>{b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);};
  W.A.forEach(r=>r.forEach(add));W.hE.forEach(r=>r.forEach(e=>{add(e[0]);add(e[1]);}));W.vE.forEach(c=>c.forEach(e=>{add(e[0]);add(e[1]);}));return b;}
function warpBB(){return warpBBOf(xf);}
let warpGL=null;
function warpDraw(it,dst,interp){
  if(!warpGL){const vao2=gl.createVertexArray(),buf=gl.createBuffer();gl.bindVertexArray(vao2);gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,8);gl.bindVertexArray(vao);warpGL={vao2,buf};}
  /* underneath: the layer with its hole, the untouched mask, or empty */
  if(it.base)blit(it.base,dst,0,0,doc.w,doc.h,0,0);else if(it.full)blit(it.orig,dst,0,0,doc.w,doc.h,0,0);else clearTarget(dst,it.outside);
  const mesh=warpMesh(xf),W=doc.w,H=doc.h;
  useProg(P.mesh,{uSrc:it.src.tex,uOutside:it.outside,uInterp:{int:interp},uSize:[W,H]});bindTarget(dst);
  gl.bindVertexArray(warpGL.vao2);gl.bindBuffer(gl.ARRAY_BUFFER,warpGL.buf);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STREAM_DRAW);
  gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  const loc=gl.getUniformLocation(P.mesh.p,'uOff'),offs=doc.wrap?[[-W,-H],[0,-H],[W,-H],[-W,0],[0,0],[W,0],[-W,H],[0,H],[W,H]]:[[0,0]];
  for(const [ox,oy] of offs){gl.uniform2f(loc,ox,oy);gl.drawArrays(gl.TRIANGLES,0,mesh.length/4);}
  gl.disable(gl.BLEND);gl.bindVertexArray(vao);}
/* moving an anchor carries its handles along */
function warpMoveAnchor(W,i,j,dx,dy){const mv=p=>{p[0]+=dx;p[1]+=dy;};mv(W.A[j][i]);
  if(i>0)mv(W.hE[j][i-1][1]);if(i<W.n)mv(W.hE[j][i][0]);if(j>0)mv(W.vE[i][j-1][1]);if(j<W.n)mv(W.vE[i][j][0]);W.mesh=null;}
/* handles belonging to anchor (i,j): [point, ...] */
function warpHandlesOf(W,i,j){const h=[];if(i>0)h.push(W.hE[j][i-1][1]);if(i<W.n)h.push(W.hE[j][i][0]);if(j>0)h.push(W.vE[i][j-1][1]);if(j<W.n)h.push(W.vE[i][j][0]);return h;}
