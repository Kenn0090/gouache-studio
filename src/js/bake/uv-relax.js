/* ================= Relax and overlap check for UVs (0.56) =================
   Relax evens out stretching inside every piece without moving the seams: each edge of the model is pulled toward the length it should
   have on the flat picture (its length on the model times the piece's own scale). With "Keep outlines" the border of each piece stays where it is
   and only the inside moves; without it the whole piece may change shape (it keeps its size and place). A move that would flip a triangle is not made.
   The overlap check draws every triangle into a picture (1024 or 2048 px) and finds pixels that two pieces share, or that a piece covers twice
   (a fold-over); the result is shown on the layout and on the model, and Fix packs the pieces again. */
/* welded vertices of a mesh (same place on the model and in the picture are one) */
function uvWeld(m){const P=m.pos,UV=m.uv,n=P.length/3,key=new Map(),wid=new Int32Array(n);let W=0;const q=1e5;
  for(let i=0;i<n;i++){const k=Math.round(P[i*3]*q)+','+Math.round(P[i*3+1]*q)+','+Math.round(P[i*3+2]*q)+'|'+Math.round(UV[i*2]*4096)+','+Math.round(UV[i*2+1]*4096);let w=key.get(k);if(w===undefined){w=W++;key.set(k,w);}wid[i]=w;}
  return {wid,W};}
async function uwRelax(m,optIn,pr){const opt=Object.assign({strength:50,pin:true},optIn||{}),I=m.idx,T=I.length/3,P=m.pos,UV=m.uv,{wid,W}=uvWeld(m),isl=uwIslands(m);
  pr=pr||(()=>{});
  const U=new Float64Array(W),V=new Float64Array(W),X=new Float64Array(W*3);
  for(let i=0;i<wid.length;i++){const w=wid[i];U[w]=UV[i*2];V[w]=UV[i*2+1];X[w*3]=P[i*3];X[w*3+1]=P[i*3+1];X[w*3+2]=P[i*3+2];}
  const tw=new Int32Array(T*3);for(let t=0;t<T;t++){tw[t*3]=wid[I[t*3]];tw[t*3+1]=wid[I[t*3+1]];tw[t*3+2]=wid[I[t*3+2]];}
  await uwArap(T,W,tw,X,U,V,isl.ids,isl.count,opt,pr);
  const uv=new Float32Array(UV.length);for(let i=0;i<wid.length;i++){const w=wid[i];uv[i*2]=U[w];uv[i*2+1]=V[w];}
  const r=Object.assign({},m,{uv,_uvAn:null,_uvIsl:null,_uvMet:null});r.tan=tangentsOf(r.pos,r.nrm,r.uv,r.idx);return r;}
/* the engine: triangles tw (3 corners each, indices into W points), the points' places X (3 numbers each) and their flat places U,V (changed in place), the piece of every triangle */
async function uwArap(T,W,tw,X,U,V,ids,ng,opt,pr){
  const ou=Float64Array.from(U),ov=Float64Array.from(V),isw=new Int32Array(W).fill(-1);
  const a2=new Float64Array(ng),a3=new Float64Array(ng),sa=new Float64Array(ng);
  for(let t=0;t<T;t++){const a=tw[t*3],b=tw[t*3+1],c=tw[t*3+2],id=ids[t];isw[a]=isw[b]=isw[c]=id;
    const ar=((U[b]-U[a])*(V[c]-V[a])-(U[c]-U[a])*(V[b]-V[a]))/2;a2[id]+=Math.abs(ar);sa[id]+=ar;
    const ux=X[b*3]-X[a*3],uy=X[b*3+1]-X[a*3+1],uz=X[b*3+2]-X[a*3+2],vx=X[c*3]-X[a*3],vy=X[c*3+1]-X[a*3+1],vz=X[c*3+2]-X[a*3+2];a3[id]+=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2;}
  /* every triangle's own flat shape (its true lengths, times the piece's scale), the way a flat triangle of that shape would lie, and the weights of its three edges */
  const xs=new Float64Array(T*6),cw=new Float64Array(T*3),ok=new Uint8Array(T);
  for(let t=0;t<T;t++){const id=ids[t],s=a3[id]>0?Math.sqrt(a2[id]/a3[id]):1,ori=sa[id]<0?-1:1,a=tw[t*3],b=tw[t*3+1],c=tw[t*3+2];
    const e1=[X[b*3]-X[a*3],X[b*3+1]-X[a*3+1],X[b*3+2]-X[a*3+2]],e2=[X[c*3]-X[a*3],X[c*3+1]-X[a*3+1],X[c*3+2]-X[a*3+2]],l1=Math.hypot(...e1),cr=Math.hypot(e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]);
    if(l1<1e-14||cr<1e-14||a===b||b===c||a===c)continue;ok[t]=1;const d=(e1[0]*e2[0]+e1[1]*e2[1]+e1[2]*e2[2])/l1;
    xs[t*6+2]=l1*s;xs[t*6+4]=d*s;xs[t*6+5]=ori*cr/l1*s;
    const cot=(p,q,r)=>{const A=[X[q*3]-X[p*3],X[q*3+1]-X[p*3+1],X[q*3+2]-X[p*3+2]],B=[X[r*3]-X[p*3],X[r*3+1]-X[p*3+1],X[r*3+2]-X[p*3+2]],dt=A[0]*B[0]+A[1]*B[1]+A[2]*B[2],cc=Math.hypot(A[1]*B[2]-A[2]*B[1],A[2]*B[0]-A[0]*B[2],A[0]*B[1]-A[1]*B[0]);return cc>1e-14?dt/cc:0;};
    cw[t*3]=Math.max(.5*cot(c,a,b),1e-3);/* edge 0 (a-b) is opposite corner c */cw[t*3+1]=Math.max(.5*cot(a,b,c),1e-3);/* edge 1 (b-c) */cw[t*3+2]=Math.max(.5*cot(b,c,a),1e-3);/* edge 2 (c-a) */}
  /* edges of the whole picture with their weights; the ones used once are borders */
  const em=new Map(),ea=[],eb=[],ew=[],ec=[];
  const eid=(a,b)=>{const k=a<b?a*W+b:b*W+a;let e=em.get(k);if(e===undefined){e=ea.length;em.set(k,e);ea.push(a<b?a:b);eb.push(a<b?b:a);ew.push(0);ec.push(0);}return e;};
  const te=new Int32Array(T*3).fill(-1);
  for(let t=0;t<T;t++){if(!ok[t])continue;for(let k=0;k<3;k++){const e=eid(tw[t*3+k],tw[t*3+(k+1)%3]);te[t*3+k]=e;ew[e]+=cw[t*3+k];ec[e]++;}}
  const E=ea.length,EA=Int32Array.from(ea),EB=Int32Array.from(eb),EW=Float64Array.from(ew),fixed=new Uint8Array(W),has=new Uint8Array(W);
  for(let e=0;e<E;e++){has[EA[e]]=1;has[EB[e]]=1;if(opt.pin&&ec[e]===1){fixed[EA[e]]=1;fixed[EB[e]]=1;}}
  /* free pieces: one corner is held so the piece cannot slide */
  const held=new Uint8Array(ng);if(!opt.pin)for(let w=0;w<W;w++)if(has[w]&&isw[w]>=0&&!held[isw[w]]){held[isw[w]]=1;fixed[w]=1;}
  const free=[];for(let w=0;w<W;w++)if(has[w]&&!fixed[w])free.push(w);const NF=free.length,fi=new Int32Array(W).fill(-1);free.forEach((w,i)=>fi[w]=i);
  const iters=Math.max(2,Math.round(1+Math.max(1,Math.min(100,opt.strength))/5)),bu=new Float64Array(W),bv=new Float64Array(W),rr=new Float64Array(T*4);
  const diag=new Float64Array(W);for(let e=0;e<E;e++){diag[EA[e]]+=EW[e];diag[EB[e]]+=EW[e];}
  /* L x for the free corners (the fixed ones count as zero) */
  const lap=(x,out)=>{out.fill(0);for(let e=0;e<E;e++){const a=EA[e],b=EB[e],w=EW[e];const ia=fi[a],ib=fi[b];if(ia>=0){out[ia]+=w*x[ia];if(ib>=0)out[ia]-=w*x[ib];}if(ib>=0){out[ib]+=w*x[ib];if(ia>=0)out[ib]-=w*x[ia];}}};
  const cg=async(rhs,x0,out)=>{const r=new Float64Array(NF),z=new Float64Array(NF),pv=new Float64Array(NF),Ap=new Float64Array(NF);lap(x0,Ap);let rz=0,r0=0;
    for(let i=0;i<NF;i++){r[i]=rhs[i]-Ap[i];z[i]=r[i]/(diag[free[i]]||1);pv[i]=z[i];rz+=r[i]*z[i];r0+=r[i]*r[i];}out.set(x0);if(r0<1e-24)return;
    for(let it=0;it<60;it++){lap(pv,Ap);let pA=0;for(let i=0;i<NF;i++)pA+=pv[i]*Ap[i];if(pA<=1e-30)break;const al=rz/pA;let rn=0,rz2=0;
      for(let i=0;i<NF;i++){out[i]+=al*pv[i];r[i]-=al*Ap[i];z[i]=r[i]/(diag[free[i]]||1);rz2+=r[i]*z[i];rn+=r[i]*r[i];}
      if(rn<r0*1e-8)break;const be=rz2/rz;rz=rz2;for(let i=0;i<NF;i++)pv[i]=z[i]+be*pv[i];}};
  const xu=new Float64Array(NF),xv=new Float64Array(NF),ru=new Float64Array(NF),rv=new Float64Array(NF);
  for(let i=0;i<NF;i++){xu[i]=U[free[i]];xv[i]=V[free[i]];}
  for(let it=0;it<iters;it++){
    /* local: the turn that best fits each triangle's flat shape to where it is now */
    bu.fill(0);bv.fill(0);
    for(let t=0;t<T;t++){if(!ok[t])continue;let c00=0,c01=0,c10=0,c11=0;
      for(let k=0;k<3;k++){const i=k,j=(k+1)%3,a=tw[t*3+i],b=tw[t*3+j],w=cw[t*3+k],dx=xs[t*6+i*2]-xs[t*6+j*2],dy=xs[t*6+i*2+1]-xs[t*6+j*2+1],du=U[a]-U[b],dv=V[a]-V[b];c00+=w*du*dx;c01+=w*du*dy;c10+=w*dv*dx;c11+=w*dv*dy;}
      const th=Math.atan2(c10-c01,c00+c11),cs=Math.cos(th),sn=Math.sin(th);
      for(let k=0;k<3;k++){const i=k,j=(k+1)%3,a=tw[t*3+i],b=tw[t*3+j],w=cw[t*3+k],dx=xs[t*6+i*2]-xs[t*6+j*2],dy=xs[t*6+i*2+1]-xs[t*6+j*2+1],ru0=cs*dx-sn*dy,rv0=sn*dx+cs*dy;bu[a]+=w*ru0;bv[a]+=w*rv0;bu[b]-=w*ru0;bv[b]-=w*rv0;}}
    /* global: move the free corners so every edge follows its turned flat edge */
    for(let i=0;i<NF;i++){ru[i]=bu[free[i]];rv[i]=bv[free[i]];}
    for(let e=0;e<E;e++){const a=EA[e],b=EB[e],w=EW[e],ia=fi[a],ib=fi[b];if(ia>=0&&ib<0){ru[ia]+=w*U[b];rv[ia]+=w*V[b];}else if(ib>=0&&ia<0){ru[ib]+=w*U[a];rv[ib]+=w*V[a];}}
    const nu=new Float64Array(NF),nv=new Float64Array(NF);await cg(ru,xu,nu);await cg(rv,xv,nv);
    for(let i=0;i<NF;i++){xu[i]=nu[i];xv[i]=nv[i];U[free[i]]=nu[i];V[free[i]]=nv[i];}
    pr('Relaxing… '+Math.round((it+1)/iters*100)+'%',(it+1)/iters);await uwYield();uwLast=performance.now();if(uwStop.on)throw new Error('Stopped');}
  /* a free piece may have drifted: put it back around its old centre */
  if(!opt.pin){const cx0=new Float64Array(ng),cy0=new Float64Array(ng),cx1=new Float64Array(ng),cy1=new Float64Array(ng),n=new Float64Array(ng);
    for(let w=0;w<W;w++){const i=isw[w];if(i<0||!has[w])continue;cx0[i]+=ou[w];cy0[i]+=ov[w];cx1[i]+=U[w];cy1[i]+=V[w];n[i]++;}
    for(let w=0;w<W;w++){const i=isw[w];if(i<0||!n[i]||!has[w])continue;U[w]+=cx0[i]/n[i]-cx1[i]/n[i];V[w]+=cy0[i]/n[i]-cy1[i]/n[i];}}
}

/* ---- overlap check ---- */
function uvOverlapCheck(m,S){const I=m.idx,T=I.length/3,UV=m.uv;if(!m.uv||m.noUV)return {none:true,faces:0,pct:0,folded:0,pixels:0,S:0,bad:null,cover:null};
  S=S||(T<=30000?2048:1024);const isl=uvIslandsOf(m),owner=new Int32Array(S*S),sgn=new Int8Array(S*S),cover=new Uint8Array(S*S),bad=new Uint8Array(S*S);
  const tri=[];for(let t=0;t<T;t++){const a=I[t*3],b=I[t*3+1],c=I[t*3+2];tri.push([UV[a*2]*S,UV[a*2+1]*S,UV[b*2]*S,UV[b*2+1]*S,UV[c*2]*S,UV[c*2+1]*S]);}
  const each=(t,fn)=>{const [ax,ay,bx,by,cx,cy]=tri[t],den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-12)return;
    const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx))),x1=Math.min(S-1,Math.ceil(Math.max(ax,bx,cx))),y0=Math.max(0,Math.floor(Math.min(ay,by,cy))),y1=Math.min(S-1,Math.ceil(Math.max(ay,by,cy)));
    const sgv=den>0?1:-1;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const qx=x+.5-cx,qy=y+.5-cy,w1=((by-cy)*qx+(cx-bx)*qy)/den,w2=((cy-ay)*qx+(ax-cx)*qy)/den,w3=1-w1-w2;if(w1>0&&w2>0&&w3>0)fn(y*S+x,sgv);}};
  for(let t=0;t<T;t++){const id=isl.ids[t]+1;each(t,(p,s)=>{cover[p]=Math.min(255,cover[p]+1);if(!owner[p]){owner[p]=id;sgn[p]=s;}else bad[p]=1;});}
  let faces=0,folded=0,px=0;const flag=new Uint8Array(T);
  for(let t=0;t<T;t++){let hit=0;each(t,(p)=>{if(bad[p])hit=1;});if(hit){flag[t]=1;faces++;}}
  for(let p=0;p<S*S;p++)if(bad[p])px++;
  /* a fold: two layers of the same piece */
  for(let t=0;t<T;t++){if(!flag[t])continue;const id=isl.ids[t]+1;let f=0;each(t,(p,s)=>{if(bad[p]&&owner[p]===id)f=1;});if(f)folded++;}
  let covered=0;for(let p=0;p<S*S;p++)if(cover[p])covered++;
  return {none:false,faces,flag,pct:T?faces/T*100:0,folded,pixels:px,pixelPct:covered?px/covered*100:0,S,bad,cover};}
/* the check as a picture: grey where one layer covers, red where pieces overlap */
function uvOverlapCanvas(m,S,res){res=res||uvOverlapCheck(m,S);const cv=document.createElement('canvas');cv.width=cv.height=S;const x=cv.getContext('2d',{willReadFrequently:true});x.fillStyle='#17181c';x.fillRect(0,0,S,S);if(res.none)return cv;
  const img=x.getImageData(0,0,S,S),d=img.data,r=res.S/S;
  for(let y=0;y<S;y++)for(let xx=0;xx<S;xx++){const p=Math.floor(y*r)*res.S+Math.floor(xx*r),o=(y*S+xx)*4;if(res.bad[p]){d[o]=235;d[o+1]=50;d[o+2]=50;}else if(res.cover[p]){d[o]=104;d[o+1]=124;d[o+2]=140;}}
  x.putImageData(img,0,0);return cv;}
