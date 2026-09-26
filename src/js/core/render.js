/* ================= Rendering ================= */
function requestRender(comp){if(comp)dirtyComp=true;if(!raf)raf=requestAnimationFrame(frame);}
function frame(){raf=0;if(dirtyComp){composite();dirtyComp=false;}drawView();flushThumbs();if(tedit)positionEditor();}
let maskOverride=new Map();
function maskTexOf(n){if(!n.mask||!n.mask.enabled)return null;return maskOverride.get(n)||n.mask.target.tex;}
/* selection clipping for a stroke: only when the stroke was started with an active selection */
function selU(o){return o&&o.sel&&sel.t?{uSelTex:sel.t.tex,uUseSel:true}:{uSelTex:dummy,uUseSel:false};}
function chanU(o){return o&&o.chan?{uChanMode:{int:1},uChan:o.chan}:{uChanMode:{int:0},uChan:[1,1,1,1]};}
function compositeList(list,acc){let base=null;
  for(let i=0;i<list.length;i++){const n=list[i],clipped=clipBaseOf(list,i);if(!clipped)base=n;
    if(!n.visible)continue;if(clipped&&!clipped.visible)continue;
    const mt=maskTexOf(n);
    if(n.type==='layer'){const src=(preview&&preview.L===n&&!preview.isMask)?previewT:n.target,st=(stroke&&stroke.L===n&&stroke.o.tool!=='smudge')?stroke:null,out=acquire(),cm=clipped?maskTexOf(clipped):null;
      run(P.comp,out,Object.assign({uBase:acc.tex,uLayer:src.tex,uStrokeTex:strokeT.tex,uMask:clipped?clipped.target.tex:dummy,uUseMask:!!clipped,uMask2:cm||dummy,uUseMask2:!!cm,uLMask:mt||dummy,uUseLMask:!!mt,
        uMode:{int:n.mode},uOpacity:n.opacity,uStroke:{int:st?(st.o.tool==='erase'?2:1):0},uStrokeColor:st?st.o.color:[0,0,0],uStrokeOpacity:st?st.o.opacity:0,uLockAlpha:n.lockAlpha},chanU(st&&st.o),selU(st&&st.o)));
      release(acc);acc=out;}
    else if(n.mode<0){
      if(n.opacity>=.999&&!mt)acc=compositeList(n.children,acc);
      else{const x=acquire();blit(acc,x,0,0,doc.w,doc.h,0,0);const r=compositeList(n.children,x),out=acquire();run(P.mix,out,{uA:acc.tex,uB:r.tex,uT:n.opacity,uM:mt||dummy,uUseM:!!mt});release(acc);release(r);acc=out;}}
    else{const g=acquire();clearTarget(g);const r=compositeList(n.children,g),out=acquire();
      run(P.comp,out,{uBase:acc.tex,uLayer:r.tex,uStrokeTex:strokeT.tex,uMask:dummy,uUseMask:false,uLMask:mt||dummy,uUseLMask:!!mt,uMode:{int:n.mode},uOpacity:n.opacity,uStroke:{int:0},uStrokeColor:[0,0,0],uStrokeOpacity:0,uLockAlpha:false});
      release(acc);release(r);acc=out;}}
  return acc;}
function renderNodes(list){const acc=acquire();clearTarget(acc);return compositeList(list,acc);}
let maskViewT=null,maskViewLive=false;
function composite(){if(compOut)release(compOut);maskOverride=new Map();const tmp=[];maskViewLive=false;
  if(stroke&&stroke.L.maskOf&&stroke.o.tool!=='smudge'){const lm=acquire();tmp.push(lm);run(P.merge,lm,Object.assign({uSrc:beforeT.tex,uStrokeTex:strokeT.tex,uStroke:{int:1},uStrokeColor:stroke.o.color,uStrokeOpacity:stroke.o.opacity,uLockAlpha:false},selU(stroke.o)));maskOverride.set(stroke.L.maskOf,lm.tex);if(ui.viewMask){if(!maskViewT||maskViewT.w!==doc.w||maskViewT.h!==doc.h||maskViewT.depth!==doc.depth){disposeTarget(maskViewT);maskViewT=makeTarget(doc.w,doc.h);}blit(lm,maskViewT,0,0,doc.w,doc.h,0,0);maskViewLive=true;}}
  if(preview&&preview.isMask)maskOverride.set(preview.L,previewT.tex);
  compOut=renderNodes(doc.root.children);compOut.mipDirty=true;tmp.forEach(release);maskOverride=new Map();}
function dprNow(){return cv.width/Math.max(1,stage.clientWidth);}
function viewSource(){const A=doc.active;if(ui.viewMask&&A&&A.mask){
    if(stroke&&stroke.L.maskObj===A.mask&&maskViewLive)return {t:maskViewT,mask:true};
    if(preview&&preview.isMask&&preview.L===A)return {t:previewT,mask:true};return {t:A.mask.target,mask:true};}
  return {t:compOut,mask:false};}
function drawView(){
  bindTarget(null);gl.clearColor(21/255,23/255,27/255,1);gl.clear(gl.COLOR_BUFFER_BIT);
  const dpr=dprNow(),z=view.zoom,vs=viewSource(),T=vs.t;
  gl.bindTexture(gl.TEXTURE_2D,T.tex);
  if(z<1&&T===compOut){if(compOut.mipDirty){gl.generateMipmap(gl.TEXTURE_2D);compOut.mipDirty=false;}gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
  else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,z>=2?gl.NEAREST:gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,z>=2?gl.NEAREST:gl.LINEAR);
  const ox=view.x*dpr,oy=view.y*dpr,ew=doc.w*z*dpr,eh=doc.h*z*dpr,t=doc.wrap;
  const sh=chan.show,n=sh.filter(Boolean).length,single=n===1?sh.indexOf(1):-1;
  run(P.view,null,{uComp:T.tex,uOrigin:t?[ox-ew,oy-eh]:[ox,oy],uExtent:t?[ew*3,eh*3]:[ew,eh],uViewport:[cv.width,cv.height],
    uUV0:t?[-1,-1]:[0,0],uUV1:t?[2,2]:[1,1],uChk1:[.235,.247,.271],uChk2:[.188,.2,.22],uChkSize:Math.max(4,8*dpr),
    uShow:sh,uSingle:{int:vs.mask?-1:single},uMaskView:vs.mask,...selViewU(z,dpr,t)});
  gl.bindTexture(gl.TEXTURE_2D,T.tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  releaseSelView();drawSelOverlay();
}
/* marching ants (active selection) or red overlay (quick mask) drawn by the view shader */
let selViewTmp=null;
function selViewU(z,dpr,wrap){if(!sel.t)return {};
  if(sel.quick){let t=sel.t;
    if(stroke&&stroke.L.quick&&stroke.o.tool!=='smudge'){selViewTmp=acquire();run(P.merge,selViewTmp,{uSrc:beforeT.tex,uStrokeTex:strokeT.tex,uStroke:{int:1},uStrokeColor:stroke.o.color,uStrokeOpacity:stroke.o.opacity,uLockAlpha:false});t=selViewTmp;bindTarget(null);}
    else if(preview&&preview.et&&preview.et.L.quick)t=previewT;
    return {uSel:t.tex,uSelMode:{int:2},uWrap:wrap};}
  if(!sel.active)return {};
  return {uSel:sel.t.tex,uSelMode:{int:1},uTime:(performance.now()/1000)%1000,uPx:1/(z*dpr),uWrap:wrap};}
function releaseSelView(){if(selViewTmp){release(selViewTmp);selViewTmp=null;}}

/* thumbnails */
const thumbT=makeTargetRaw(40,40);const thumbBuf=new Uint8Array(40*40*4);const thumbQ=new Set();
function makeTargetRaw(w,h){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);return {tex,fbo,w,h,depth:8};}
function scheduleThumb(n){if(n){thumbQ.add(n);chanThumbDirty=true;}requestRender();}
let chanThumbDirty=true;
function renderThumb(target,canvas){const s=Math.min(40/doc.w,40/doc.h),tw=doc.w*s,th=doc.h*s;clearTarget(thumbT);
  run(P.resample,thumbT,{uSrc:target.tex,uOffset:[(40-tw)/2,(40-th)/2],uScale:[1/s,1/s],uTaps:{int:Math.min(8,Math.ceil(1/s))}});
  gl.bindFramebuffer(gl.FRAMEBUFFER,thumbT.fbo);gl.readPixels(0,0,40,40,gl.RGBA,gl.UNSIGNED_BYTE,thumbBuf);
  if(!canvas)return thumbBuf;const img=new ImageData(40,40);const d=img.data;
  for(let i=0;i<d.length;i+=4){const a=thumbBuf[i+3];if(a){d[i]=Math.min(255,thumbBuf[i]*255/a);d[i+1]=Math.min(255,thumbBuf[i+1]*255/a);d[i+2]=Math.min(255,thumbBuf[i+2]*255/a);d[i+3]=a;}}
  canvas.getContext('2d').putImageData(img,0,0);return thumbBuf;}
function flushThumbs(){
  for(const n of thumbQ){if(n.type==='layer'&&n.target&&n.target.tex)renderThumb(n.target,n.thumb);if(n.mask&&n.mask.target.tex)renderThumb(n.mask.target,n.mask.thumb);}
  thumbQ.clear();
  if(chanThumbDirty&&compOut&&typeof drawChannelThumbs==='function'){chanThumbDirty=false;drawChannelThumbs();}
}
function changed(L){if(L)scheduleThumb(L);renderLayers();requestRender(true);}
function changedAll(){allNodes().forEach(scheduleThumb);chanThumbDirty=true;renderLayers();requestRender(true);}
