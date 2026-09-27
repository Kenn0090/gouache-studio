/* ================= Paint bucket ================= */
ui.bucketTol=32;ui.bucketContig=true;ui.bucketAll=false;ui.bucketAA=true;ui.bucketOpacity=1;
/* a W*H byte mask (255 = covered) uploaded into a pooled grey target */
function maskToTarget(m){const W=doc.w,H=doc.h,tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,W,H,0,gl.RED,gl.UNSIGNED_BYTE,m);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  const t=acquire();run(P.rcopy,t,{uSrc:tex,uOff:[0,0]});gl.deleteTexture(tex);return t;}
function bucketFill(ix,iy){if(preview||selLive){toast('Apply or cancel the open dialog first.');return;}
  const et=needTarget();if(!et)return;if(!effVisible(et.node)&&!ui.viewMask){toast('Show the active layer first.');return;}
  const W=doc.w,H=doc.h;let x=Math.floor(ix),y=Math.floor(iy);if(doc.wrap){x=mod(x,W);y=mod(y,H);}if(x<0||y<0||x>=W||y>=H)return;
  const px=readRGBA8(ui.bucketAll&&!et.isMask?freshComposite():et.target);
  const m=wandMask(px,W,H,x,y,Math.round(ui.bucketTol),ui.bucketContig,doc.wrap);let bb=maskBounds(m,W,H);if(!bb)return;
  const cov=maskToTarget(m);if(ui.bucketAA){gaussian(cov,cov,.7);bb=rToDoc(rGrow(bb,2));}
  const op=ui.bucketOpacity,c=et.isMask||et.L.quick?Array(3).fill(lum3(ui.fg)):ui.fg;
  const su={uSelTex:selOn(et)?sel.t.tex:dummy,uUseSel:selOn(et)};
  run(P.fillcov,previewT,Object.assign({uOld:et.target.tex,uCov:cov.tex,uColor:[c[0]*op,c[1]*op,c[2]*op,op]},su));chanLimit(et);
  const r=selRect(et)?rInter(bb,selRect(et)):bb;if(!r){release(cov);return;}
  if(!et.isMask)pushRecent(ui.fg);
  /* the same area filled in the other enabled maps with their values */
  const oth=otherMapsFor(et).map(k=>({k,apply:T=>{const mc=mapBrushColor(k),o=acquireD(T.depth);run(P.fillcov,o,Object.assign({uOld:T.tex,uCov:cov.tex,uColor:[mc[0]*op,mc[1]*op,mc[2]*op,op]},su));blit(o,T,0,0,W,H,0,0);release(o);}}));
  fullRecord(et.L,'Paint bucket',()=>blit(previewT,et.target,0,0,W,H,0,0),r,oth);release(cov);}
function buildBucketPanel(box){$('#brushTitle').textContent='Paint bucket';
  box.append(makeSlider({id:'bkTol',label:'Tolerance',min:0,max:255,step:1,value:ui.bucketTol,onInput:v=>{ui.bucketTol=v;}}).el,
    makeSlider({id:'bkOp',label:'Opacity',min:0,max:1,step:.01,value:ui.bucketOpacity,fmt:pct,onInput:v=>{ui.bucketOpacity=v;}}).el,
    el('div',{class:'chips'},chk('bkCont','Contiguous',ui.bucketContig,v=>{ui.bucketContig=v;}),chk('bkAll','Sample all layers',ui.bucketAll,v=>{ui.bucketAll=v;}),chk('bkAA','Anti-alias',ui.bucketAA,v=>{ui.bucketAA=v;})),
    el('div',{class:'sub',text:'Click to fill similar colours with the foreground colour. With a selection, the fill stays inside it. Shift+G switches to the gradient bucket.'}));buildMapBrushSection(box,'fill');}

/* ---- gradient bucket: press in an area, drag the direction; the gradient fills only that area ---- */
function gbucketDown(e,ix,iy){if(preview||selLive){toast('Apply or cancel the open dialog first.');return;}
  const et=needTarget();if(!et)return;if(!effVisible(et.node)&&!ui.viewMask){toast('Show the active layer first.');return;}
  const W=doc.w,H=doc.h;let x=Math.floor(ix),y=Math.floor(iy);if(doc.wrap){x=mod(x,W);y=mod(y,H);}if(x<0||y<0||x>=W||y>=H)return;
  const px=readRGBA8(ui.bucketAll&&!et.isMask?freshComposite():et.target);
  const m=wandMask(px,W,H,x,y,Math.round(ui.bucketTol),ui.bucketContig,doc.wrap);let bb=maskBounds(m,W,H);if(!bb)return;
  const cov=maskToTarget(m);if(ui.bucketAA){gaussian(cov,cov,.7);bb=rToDoc(rGrow(bb,2));}
  preview={L:et.node,isMask:et.isMask,et};ptr={mode:'gbucket',id:e.pointerId,et,cov,bb,a:[ix,iy],b:null,moved:false};
  gbucketRender([bb[0],(bb[1]+bb[3])/2],[bb[2],(bb[1]+bb[3])/2]);}
function gbucketRender(a,b){const p=ptr,et=p.et,g=acquire();p.ga=a;p.gb=b;
  drawGradient(g,{def:ui.grad,a,b},{opacity:ui.gradOpacity,gray:et.isMask||!!et.L.quick});
  run(P.texcov,previewT,{uOld:et.target.tex,uCov:p.cov.tex,uTex:g.tex,uSelTex:selOn(et)?sel.t.tex:dummy,uUseSel:selOn(et)});release(g);chanLimit(et);requestRender(true);drawXfOverlay();}
function gbucketMove(e,ix,iy){const p=ptr;if(!p.moved&&Math.hypot(ix-p.a[0],iy-p.a[1])*view.zoom<3)return;p.moved=true;p.b=snapAngle(p.a,[ix,iy],e);gbucketRender(p.a,p.b);}
function gbucketUp(){const p=ptr;ptr=null;const et=p.et,r=selRect(et)?rInter(p.bb,selRect(et)):p.bb;release(p.cov);
  if(r){if(!et.isMask)pushRecent(ui.fg);fullRecord(et.L,'Gradient bucket',()=>blit(previewT,et.target,0,0,doc.w,doc.h,0,0),r);}
  preview=null;requestRender(true);drawXfOverlay();}
