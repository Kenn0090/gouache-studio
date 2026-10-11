/* ================= Shape-aware packing (0.56.1) =================
   The box packer treats every piece as a rectangle, so an L-shaped torso keeps its empty corners and the small pieces cannot use them. Here every piece is
   drawn as its real outline on a coarse grid (a bit per cell, a little fatter than the piece so the padding stays), and the pieces are placed one after the
   other, biggest first, at the first place (top to bottom, left to right) where their outline does not touch the ones already there. The scale is searched
   like the box packer does: the biggest one at which everything still fits. When it cannot beat the box packer's scale by 2%, the box layout is kept. */
function uwShapeRaster(F,s,rot,G,m){/* F: {pts,tris,w,h}; the outline in cells, with m empty cells around it */
  const w=(rot?F.h:F.w)*s*G,h=(rot?F.w:F.h)*s*G,W=Math.ceil(w)+2*m+1,H=Math.ceil(h)+2*m+1,g=new Uint8Array(W*H),P=F.pts;
  const px=i=>rot?P[i*2+1]*s*G+m:P[i*2]*s*G+m,py=i=>rot?(F.w-P[i*2])*s*G+m:P[i*2+1]*s*G+m;
  for(const [a,b,c] of F.tris){const X=[px(a),px(b),px(c)],Y=[py(a),py(b),py(c)],y0=Math.max(0,Math.floor(Math.min(...Y))),y1=Math.min(H-1,Math.floor(Math.max(...Y)));
    for(let y=y0;y<=y1;y++){let lo=1e30,hi=-1e30;/* the part of the triangle inside the row y..y+1 */
      for(let e=0;e<3;e++){const ax=X[e],ay=Y[e],bx=X[(e+1)%3],by=Y[(e+1)%3];let ta=0,tb=1;const dy=by-ay;
        if(Math.abs(dy)<1e-12){if(ay<y||ay>y+1)continue;}else{const t0=(y-ay)/dy,t1=(y+1-ay)/dy;ta=Math.max(0,Math.min(t0,t1));tb=Math.min(1,Math.max(t0,t1));if(ta>tb)continue;}
        const xa=ax+(bx-ax)*ta,xb=ax+(bx-ax)*tb;if(xa<lo)lo=xa;if(xb<lo)lo=xb;if(xa>hi)hi=xa;if(xb>hi)hi=xb;}
      if(lo>hi)continue;const x0=Math.max(0,Math.floor(lo)),x1=Math.min(W-1,Math.floor(hi));for(let x=x0;x<=x1;x++)g[y*W+x]=1;}}
  /* fatter by m cells (a square brush), one direction at a time */
  if(m>0){const t=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(g[y*W+x]){const a=Math.max(0,x-m),b=Math.min(W-1,x+m);for(let q=a;q<=b;q++)t[y*W+q]=1;}
    g.fill(0);for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(t[y*W+x]){const a=Math.max(0,y-m),b=Math.min(H-1,y+m);for(let q=a;q<=b;q++)g[q*W+x]=1;}}
  const nw=(W+31)>>5,bits=new Uint32Array(nw*H);let cells=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(g[y*W+x]){bits[y*nw+(x>>5)]|=1<<(x&31);cells++;}
  return {W,H,nw,bits,cells};}
function uwShapeFit(occ,WG,R,x,y){const sh=x&31,base=x>>5,nw=R.nw,b=R.bits;
  for(let r=0;r<R.H;r++){const ro=(y+r)*WG+base,po=r*nw;for(let k=0;k<nw;k++){const v=b[po+k];if(!v)continue;if(occ[ro+k]&(v<<sh))return false;if(sh&&(occ[ro+k+1]&(v>>>(32-sh))))return false;}}
  return true;}
function uwShapePlace(occ,WG,R,x,y){const sh=x&31,base=x>>5,nw=R.nw,b=R.bits;
  for(let r=0;r<R.H;r++){const ro=(y+r)*WG+base,po=r*nw;for(let k=0;k<nw;k++){const v=b[po+k];if(!v)continue;occ[ro+k]|=v<<sh;if(sh)occ[ro+k+1]|=v>>>(32-sh);}}}
/* try one scale: positions for every piece or null */
function uwShapeTry(shapes,order,s,G,m,allowRot){const WG=((G+31)>>5)+1,occ=new Uint32Array(G*WG+WG),pos=new Array(shapes.length);
  const rs=shapes.map(F=>[uwShapeRaster(F,s,false,G,m),allowRot?uwShapeRaster(F,s,true,G,m):null]);
  for(const i of order){let best=null;
    for(let rot=0;rot<(allowRot?2:1);rot++){const R=rs[i][rot];if(R.W>G||R.H>G)continue;let found=null;
      for(let y=0;y+R.H<=G&&!found;y++){if(best&&y+R.H>best.score)break;for(let x=0;x+R.W<=G;x++){if(uwShapeFit(occ,WG,R,x,y)){found={x,y};break;}}}
      if(found){const score=found.y+R.H;if(!best||score<best.score)best={x:found.x,y:found.y,rot,score,R};}}
    if(!best)return null;uwShapePlace(occ,WG,best.R,best.x,best.y);pos[i]={x:best.x,y:best.y,rot:best.rot===1};}
  return pos;}
/* shapes: [{pts,tris,w,h}] in model units (as the boxes); base: the box packer's answer. Returns a pack like uwPack's, or null when it does not help. */
function uwShapePack(shapes,boxes,size,padPx,opt,base){const n=shapes.length,G=n>60?384:512,gapC=padPx/size*G,m=Math.max(1,Math.round(gapC/2)),allowRot=opt.rotate!==false,t0=performance.now(),limit=opt.shapeMs||3000;
  const areaOf=F=>{let a=0;for(const [p,q,r] of F.tris)a+=Math.abs((F.pts[q*2]-F.pts[p*2])*(F.pts[r*2+1]-F.pts[p*2+1])-(F.pts[r*2]-F.pts[p*2])*(F.pts[q*2+1]-F.pts[p*2+1]))/2;return a;};
  const ar=shapes.map(areaOf),order=shapes.map((_,i)=>i).sort((a,b)=>ar[b]-ar[a]);let totalShape=0;for(const a of ar)totalShape+=a;
  const hi0=Math.sqrt(1/Math.max(totalShape,1e-12))*.98;let lo=base.scale,hi=Math.min(base.scale*1.7,hi0),best=null,bs=0;
  /* the box scale itself must fit on this grid; if it does not, there is nothing to win */
  if(hi<=lo*1.02)return null;
  for(let k=0;k<8&&performance.now()-t0<limit;k++){const mid=k===0?Math.min(hi,lo*1.25):(lo+hi)/2,p=uwShapeTry(shapes,order,mid,G,m,allowRot);if(p){best=p;bs=mid;lo=mid;}else hi=mid;}
  if(!best||bs<base.scale*1.02)return null;
  const pos=best.map(p=>({x:(p.x+m)/G-padPx/size/2,y:(p.y+m)/G-padPx/size/2,rot:p.rot}));let used=0;for(const b of boxes)used+=b.w*bs*b.h*bs;
  return {scale:bs,pos,gap:padPx/size,util:used,order,shape:true};}
