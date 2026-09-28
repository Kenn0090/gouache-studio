/* ================= Transforms: core =================
   A transform session (xf) keeps a copy of everything it changes, and re-renders the result from those
   originals on every adjustment, so the image is resampled only once however many tweaks are made.
   The box is stored as four document-space corners (q: top-left, top-right, bottom-right, bottom-left)
   of the source rectangle (rect); a projective mapping between them covers move, scale, rotate, skew and distort.
   Warp replaces the box with a grid of curved (Bezier) cells. */
let xf=null;
ui.xfInterp=2; /* 0 nearest, 1 bilinear, 2 bicubic */

/* ---- 3x3 matrix helpers (row-major arrays of 9) ---- */
function sqToQuad(q){const [x0,y0,x1,y1,x2,y2,x3,y3]=q,sx=x0-x1+x2-x3,sy=y0-y1+y2-y3;let g=0,h=0;
  if(Math.abs(sx)>1e-9||Math.abs(sy)>1e-9){const dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,den=dx1*dy2-dx2*dy1;if(Math.abs(den)>1e-12){g=(sx*dy2-dx2*sy)/den;h=(dx1*sy-sx*dy1)/den;}}
  return [x1-x0+g*x1,x3-x0+h*x3,x0, y1-y0+g*y1,y3-y0+h*y3,y0, g,h,1];}
function mul3(a,b){const r=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)r[i*3+j]=a[i*3]*b[j]+a[i*3+1]*b[3+j]+a[i*3+2]*b[6+j];return r;}
function inv3(m){const [a,b,c,d,e,f,g,h,i]=m,A=e*i-f*h,B=-(d*i-f*g),C=d*h-e*g,det=a*A+b*B+c*C;if(Math.abs(det)<1e-18)return null;
  return [A/det,-(b*i-c*h)/det,(b*f-c*e)/det, B/det,(a*i-c*g)/det,-(a*f-c*d)/det, C/det,-(a*h-b*g)/det,(a*e-b*d)/det];}
function apply3(m,x,y){const z=m[6]*x+m[7]*y+m[8];return [(m[0]*x+m[1]*y+m[2])/z,(m[3]*x+m[4]*y+m[5])/z];}
/* rect [x0,y0,x1,y1] -> quad */
function rectToQuad(r,q){const w=r[2]-r[0],h=r[3]-r[1];return mul3(sqToQuad(q),[1/w,0,-r[0]/w, 0,1/h,-r[1]/h, 0,0,1]);}
const rectCorners=r=>[r[0],r[1],r[2],r[1],r[2],r[3],r[0],r[3]];
function quadBB(q){return [Math.min(q[0],q[2],q[4],q[6]),Math.min(q[1],q[3],q[5],q[7]),Math.max(q[0],q[2],q[4],q[6]),Math.max(q[1],q[3],q[5],q[7])];}
function isParallelogram(q){const s=Math.hypot(q[4]-q[0],q[5]-q[1])+1;return Math.abs(q[0]+q[4]-q[2]-q[6])<1e-4*s&&Math.abs(q[1]+q[5]-q[3]-q[7])<1e-4*s;}

/* ---- where is there content? column and row projections on the GPU, then two tiny readbacks ---- */
let projT=null;
function contentBounds(t,alphaOnly){const W=doc.w,H=doc.h,n=Math.max(W,H);
  if(!projT||projT.w<n){if(projT){gl.deleteTexture(projT.tex);gl.deleteFramebuffer(projT.fbo);}projT=makeTargetRaw(n,1);}
  const read=(axis,len)=>{bindTarget(projT);gl.viewport(0,0,len,1);run(P.proj,projT,{uSrc:t.tex,uAxis:{int:axis},uAlphaOnly:alphaOnly!==false});
    const u=new Uint8Array(projT.w*4);gl.bindFramebuffer(gl.FRAMEBUFFER,projT.fbo);gl.readPixels(0,0,projT.w,1,gl.RGBA,gl.UNSIGNED_BYTE,u);
    let a=-1,b=-1;for(let i=0;i<len;i++)if(u[i*4]>127){if(a<0)a=i;b=i;}return a<0?null:[a,b+1];};
  const cx=read(0,W);if(!cx)return null;const cy=read(1,H);return cy?[cx[0],cy[0],cx[1],cy[1]]:null;}

/* ---- starting a session ---- */
function xfLayers(){if(doc.active&&doc.active.editMask&&doc.active.mask)return {maskOnly:doc.active};
  const out=[];for(const n of topSelected()){if(n.type==='group')out.push(...allLayers(n));else out.push(n);}return {layers:[...new Set(out)]};}
/* opts.move: started by the Move tool (translation only, applied on release) */
function xfStart(opts){opts=opts||{};if(xf)return true;
  if(preview||selLive){toast('Apply or cancel the open dialog first.');return false;}
  if(sel.quick){toast('Leave quick mask (Q) first.');return false;}
  const pick=xfLayers(),useSel=sel.active&&!!sel.bb;const items=[];let rect=null;
  if(pick.maskOnly){const n=pick.maskOnly,m=n.mask,orig=acquireD(m.target.depth);blit(m.target,orig,0,0,doc.w,doc.h,0,0);
    items.push({node:n,t:()=>m.target,orig,src:orig,base:null,outside:[1,1,1,1],full:true,mask:m});rect=fullRect();}
  else{let layers=pick.layers;if(!layers.length){toast('Select a layer to transform.');return false;}
    for(const L of layers)if(L.text||L.grad||L.shape){rasterizeText(L);toast('Converted to pixels for the transform. Undo brings the editable layer back.');}
    /* every map of every layer moves together */
    for(const L of layers){for(const k of mapKeysOf(L)){const T0=mapT(L,k),d=T0.depth,orig=acquireD(d);blit(T0,orig,0,0,doc.w,doc.h,0,0);let src=orig,base=null;
      if(useSel){src=acquireD(d);run(P.cropsel,src,{uSrc:orig.tex,uSel:sel.t.tex,uOff:[0,0],uUseSel:true});
        base=acquireD(d);const clearT=acquireD(d);clearTarget(clearT);run(P.selmix,base,{uOld:orig.tex,uNew:clearT.tex,uSel:sel.t.tex});release(clearT);}
      const b=contentBounds(src);if(b)rect=rUnion(rect,b);
      items.push({node:L,t:()=>mapT(L,k),orig,src,base,outside:[0,0,0,0]});}
      if(!useSel&&L.mask){const m=L.mask,mo=acquireD(m.target.depth);blit(m.target,mo,0,0,doc.w,doc.h,0,0);items.push({node:L,t:()=>m.target,orig:mo,src:mo,base:null,outside:[1,1,1,1],full:true,mask:m});}}
    if(!rect){for(const it of items)freeItem(it);toast(useSel?'There are no pixels inside the selection to transform.':'The layer is empty, so there is nothing to transform.');return false;}}
  let selItem=null;if(useSel&&!pick.maskOnly){const o=acquireD(sel.t.depth);blit(sel.t,o,0,0,doc.w,doc.h,0,0);selItem={orig:o,bb:sel.bb.slice()};}
  xf={items,selItem,rect,q:rectCorners(rect),pivot:[(rect[0]+rect[2])/2,(rect[1]+rect[3])/2],warp:null,move:!!opts.move,dirty:null};
  if(!xf.move){buildBrushPanel();drawXfOverlay();}
  return true;}
function freeItem(it){for(const k of ['orig','src','base'])if(it[k]&&(k==='orig'||it[k]!==it.orig))release(it[k]);}

/* ---- rendering the current state into the real layers ---- */
function xfOutBB(){const b=xf.warp?warpBB():quadBB(xf.q);return b;}
function xfRegion(it,bb){const r=it.full?fullRect():rUnion(xf.rect,bb);return doc.wrap?fullRect():rInter(rGrow(r,3),fullRect());}
function xfSS(){if(xf.warp)return 1;const q=xf.q,w=xf.rect[2]-xf.rect[0],h=xf.rect[3]-xf.rect[1];
  const sx=Math.min(Math.hypot(q[2]-q[0],q[3]-q[1]),Math.hypot(q[4]-q[6],q[5]-q[7]))/w,sy=Math.min(Math.hypot(q[6]-q[0],q[7]-q[1]),Math.hypot(q[4]-q[2],q[5]-q[3]))/h;
  return clamp(Math.ceil(1/Math.max(1e-3,Math.min(sx,sy))),1,4);}
function xfRender(fast){if(!xf)return;const bb=xfOutBB(),prev=xf.dirty;xf.dirty=bb;
  const interp=fast&&ui.xfInterp===2?1:ui.xfInterp,ss=fast?1:xfSS();
  const H=xf.warp?null:inv3(rectToQuad(xf.rect,xf.q));if(!xf.warp&&!H)return;
  for(const it of xf.items){const reg=rUnion(xfRegion(it,bb),prev?xfRegion(it,prev):null);if(!reg)continue;const dst=it.t();
    gl.enable(gl.SCISSOR_TEST);gl.scissor(reg[0],reg[1],reg[2]-reg[0],reg[3]-reg[1]);
    if(xf.warp)warpDraw(it,dst,interp);
    else run(P.xform,dst,{uSrc:it.src.tex,uH0:H.slice(0,3),uH1:H.slice(3,6),uH2:H.slice(6,9),uInterp:{int:interp},uSS:{int:ss},uWrap:doc.wrap,
      uRect:it.full?[0,0,doc.w,doc.h]:xf.rect,uDoc:[doc.w,doc.h],uOutside:it.outside,uBase:it.base?it.base.tex:dummy,uUseBase:!!it.base});
    gl.disable(gl.SCISSOR_TEST);}
  if(xf.selItem){const si=xf.selItem;
    if(xf.warp)warpDraw({src:si.orig,outside:[0,0,0,1],base:null},sel.t,1);
    else run(P.xform,sel.t,{uSrc:si.orig.tex,uH0:H.slice(0,3),uH1:H.slice(3,6),uH2:H.slice(6,9),uInterp:{int:1},uSS:{int:1},uWrap:doc.wrap,uRect:xf.rect,uDoc:[doc.w,doc.h],uOutside:[0,0,0,1]});
    sel.bb=rToDoc(rGrow(bb,1));selChanged();}
  requestRender(true);}

/* ---- finishing ---- */
function xfCommit(){if(!xf)return;const s=xf;xfRender(false);xf=null;
  const bb=s.warp?warpBBOf(s):quadBB(s.q),snaps=[],steps=[];
  for(const it of s.items){const r=it.full?fullRect():rToDoc(rUnion(s.rect,rGrow(bb,3)));if(!r)continue;const w=r[2]-r[0],h=r[3]-r[1];
    const b=captureRegion(it.orig,r[0],r[1],w,h),a=captureRegion(it.t(),r[0],r[1],w,h);snaps.push(b,a);steps.push({it,r,b,a});}
  let selStep=null;if(s.selItem){const r=rToDoc(rUnion(s.selItem.bb,sel.bb))||fullRect();selStep={r,b:captureSel(s.selItem.orig,r),a:captureSel(sel.t,r),bbB:s.selItem.bb,bbA:sel.bb&&sel.bb.slice()};snaps.push(selStep.b,selStep.a);}
  const refs=[...new Set(s.items.map(it=>it.node))],masks=s.items.filter(it=>it.mask).map(it=>it.mask);
  const label=s.move?'Move':s.warp?'Warp':'Transform';
  pushUndo({label,refs,masks,snaps,
    undo(){for(const st of steps)restoreRegion(st.b,st.it.t(),st.r[0],st.r[1]);if(selStep){restoreSel(selStep.b,selStep.r[0],selStep.r[1]);sel.bb=selStep.bbB;sel.active=true;selChanged();}},
    redo(){for(const st of steps)restoreRegion(st.a,st.it.t(),st.r[0],st.r[1]);if(selStep){restoreSel(selStep.a,selStep.r[0],selStep.r[1]);sel.bb=selStep.bbA;sel.active=true;selChanged();}}});
  for(const it of s.items)freeItem(it);if(s.selItem)release(s.selItem.orig);
  xfEnd(refs);}
function xfCancel(){if(!xf)return;const s=xf;xf=null;
  for(const it of s.items){blit(it.orig,it.t(),0,0,doc.w,doc.h,0,0);freeItem(it);}
  if(s.selItem){blit(s.selItem.orig,sel.t,0,0,doc.w,doc.h,0,0);sel.bb=s.selItem.bb;release(s.selItem.orig);selChanged();}
  xfEnd(s.items.map(it=>it.node));}
function xfEnd(nodes){for(const n of nodes)scheduleThumb(n);renderLayers();requestRender(true);cv.style.cursor='';drawXfOverlay();buildBrushPanel();}
