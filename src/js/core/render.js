/* ================= Rendering ================= */
function requestRender(comp){if(comp)dirtyComp=true;if(!raf)raf=requestAnimationFrame(frame);}
const perf={on:false,frames:[],worst:null,last:0};
function frame(){raf=0;const t0=performance.now();let tc=t0;if(stroke&&stroke.spaceDirty){stroke.spaceDirty=false;stroke.space.sync();}if(dirtyComp){composite();dirtyComp=false;tc=performance.now();}drawView();drawUVOverlay();draw3D();const tv=performance.now();flushThumbs();if(tedit)positionEditor();
  if(perf.on)perfFrame(t0,tc-t0,tv-tc,performance.now()-tv);}
let maskOverride=new Map();
function maskTexOf(n){if(!n.mask||!n.mask.enabled)return null;return maskOverride.get(n)||n.mask.target.tex;}
/* selection clipping for a stroke: only when the stroke was started with an active selection */
/* how a stroke is merged: 1 paint, 2 erase, 3 dodge, 4 burn (plus the dodge/burn settings) */
function strokeMode(o){return o.tool==='erase'?2:o.tool==='dodge'?3:o.tool==='burn'?4:1;}
function tonalU(o){return o&&(o.tool==='dodge'||o.tool==='burn')?{uTonalRange:{int:o.range},uProtect:!!o.protect}:{};}
function selU(o){return o&&o.sel&&sel.t?{uSelTex:sel.t.tex,uUseSel:true}:{uSelTex:dummy,uUseSel:false};}
function chanU(o){return o&&o.chan?{uChanMode:{int:1},uChan:o.chan}:{uChanMode:{int:0},uChan:[1,1,1,1]};}
/* composite a list of layers for map k (default: the map being edited) onto acc.
   Layers with nothing in map k are skipped; clipping always uses the base colour's shape. */
/* While a stroke is being painted nothing below the painted layer changes, so the picture of
   everything underneath is made once per stroke and reused every frame. */
function strokeCacheFor(list,k){if(!stroke||list!==doc.root.children)return null;let n=stroke.L.maskOf||stroke.L;
  while(n&&n.parent&&n.parent!==doc.root)n=n.parent;const i=list.indexOf(n);if(i<1)return null;
  const c=stroke.cache||(stroke.cache={});return c[k]||(c[k]={i,t:null});}
function dropStrokeCache(s){if(s&&s.cache){for(const k in s.cache)if(s.cache[k].t)disposeTarget(s.cache[k].t);s.cache=null;}}
function compositeList(list,acc,k){k=k||doc.map;const edit=k===doc.map;
  const sc=strokeCacheFor(list,k);let start=0;
  if(sc&&sc.t&&sc.t.depth===acc.depth){blit(sc.t,acc,0,0,doc.w,doc.h,0,0);start=sc.i;}
  for(let i=start;i<list.length;i++){if(sc&&i===sc.i&&!sc.t){sc.t=makeTarget(doc.w,doc.h,acc.depth);blit(acc,sc.t,0,0,doc.w,doc.h,0,0);}
    const n=list[i],clipped=clipBaseOf(list,i);
    if(!n.visible)continue;if(clipped&&!clipped.visible)continue;
    const mt=maskTexOf(n);
    /* filter layer: changes what is below it (clipped ones are applied to their base layer instead) */
    if(n.type==='layer'&&n.fx){if(clipped||n.fx.map!==k)continue;const r=fxApplyLayer(n,acc,k,mt);if(r!==acc){release(acc);acc=r;}continue;}
    if(n.type==='layer'){const T=edit?n.target:mapT(n,k);if(!T||T.empty)continue;
      let src=(edit&&preview&&!preview.off&&preview.L===n&&!preview.isMask)?previewT:T,own=null;const out=acquire(),cm=clipped?maskTexOf(clipped):null;
      let st=(stroke&&stroke.L===n&&stroke.o.tool!=='smudge')?stroke:null,ex=null;
      if(st&&!edit){ex=(st.o.extras||[]).find(e=>e.key===k)||null;if(!ex)st=null;}
      const cf=clippedFx(list,i,k);
      if(cf.length){/* the live stroke goes in first, so clipped filters apply to it too */
        if(st){own=acquire();run(P.merge,own,Object.assign({uSrc:src.tex,uStrokeTex:strokeT.tex,uStroke:{int:ex?ex.mode:strokeMode(st.o)},uStrokeColor:ex?ex.color:st.o.color,uStrokeTint:!ex&&!!st.tint,uStrokeOpacity:st.o.opacity,uLockAlpha:ex?false:n.lockAlpha},
          edit?chanU(st.o):chanU(null),ex?st.exU:selU(st.o),edit?tonalU(st.o):{}));src=own;st=null;ex=null;}
        for(const f of cf){const r=fxApplyLayer(f,src,k,maskTexOf(f));if(r!==src){if(own)release(own);own=r;src=r;}}}
      run(P.comp,out,Object.assign({uBase:acc.tex,uLayer:src.tex,uStrokeTex:strokeT.tex,uMask:clipped?(mapT(clipped,'base')||emptyFor(8)).tex:dummy,uUseMask:!!clipped,uMask2:cm||dummy,uUseMask2:!!cm,uLMask:mt||dummy,uUseLMask:!!mt,
        uMode:{int:mapModeOf(n,k)},uOpacity:n.opacity,uStroke:{int:st?(ex?ex.mode:strokeMode(st.o)):0},uStrokeTint:!!(st&&!ex&&st.tint),uStrokeColor:st?(ex?ex.color:st.o.color):[0,0,0],uStrokeOpacity:st?st.o.opacity:0,uLockAlpha:ex?false:n.lockAlpha},
        edit?chanU(st&&st.o):chanU(null),ex?st.exU:selU(st&&st.o),edit?tonalU(st&&st.o):{}));
      if(own)release(own);release(acc);acc=out;}
    else if(n.mode<0){
      if(n.opacity>=.999&&!mt)acc=compositeList(n.children,acc,k);
      else{const x=acquire();blit(acc,x,0,0,doc.w,doc.h,0,0);const r=compositeList(n.children,x,k),out=acquire();run(P.mix,out,{uA:acc.tex,uB:r.tex,uT:n.opacity,uM:mt||dummy,uUseM:!!mt});release(acc);release(r);acc=out;}}
    else{const g=acquire();clearTarget(g);const r=compositeList(n.children,g,k),out=acquire();
      run(P.comp,out,{uBase:acc.tex,uLayer:r.tex,uStrokeTex:strokeT.tex,uMask:dummy,uUseMask:false,uLMask:mt||dummy,uUseLMask:!!mt,uMode:{int:n.mode},uOpacity:n.opacity,uStroke:{int:0},uStrokeColor:[0,0,0],uStrokeOpacity:0,uLockAlpha:false});
      release(acc);release(r);acc=out;}}
  return acc;}
function renderNodes(list){const acc=acquire();clearTarget(acc);return compositeList(list,acc);}
let maskViewT=null,maskViewLive=false;
function composite(){if(compOut)release(compOut);maskOverride=new Map();const tmp=[];maskViewLive=false;
  if(stroke&&stroke.L.maskOf&&stroke.o.tool!=='smudge'){const lm=acquire();tmp.push(lm);run(P.merge,lm,Object.assign({uSrc:beforeT.tex,uStrokeTex:strokeT.tex,uStroke:{int:strokeMode(stroke.o)},uStrokeColor:stroke.o.color,...tintU(),uStrokeOpacity:stroke.o.opacity,uLockAlpha:false},selU(stroke.o),tonalU(stroke.o)));maskOverride.set(stroke.L.maskOf,lm.tex);if(ui.viewMask){if(!maskViewT||maskViewT.w!==doc.w||maskViewT.h!==doc.h||maskViewT.depth!==lm.depth){disposeTarget(maskViewT);maskViewT=makeTarget(doc.w,doc.h,lm.depth);}blit(lm,maskViewT,0,0,doc.w,doc.h,0,0);maskViewLive=true;}}
  if(preview&&!preview.off&&preview.isMask)maskOverride.set(preview.L,previewT.tex);
  {const acc=acquire();clearTarget(acc,ui.mode==='anim'?[0,0,0,0]:mapDefault(doc.map));compOut=compositeList(doc.root.children,acc);}
  if(ui.mode!=='anim'&&(doc.view==='material'||doc.view==='nfinal'))buildMaterialView();compOut.mipDirty=true;tmp.forEach(release);maskOverride=new Map();
  if(ui.mode==='anim'){buildOnion();if(stroke)liveFrameUpdate();}else if(onionT){release(onionT);onionT=null;}v3Changed();}
function dprNow(){return cv.height/Math.max(1,stage.clientHeight);}
function viewSource(){const A=doc.active;if(ui.viewMask&&A&&A.mask){
    if(stroke&&stroke.L.maskObj===A.mask&&maskViewLive)return {t:maskViewT,mask:true};
    if(preview&&!preview.off&&preview.isMask&&preview.L===A)return {t:previewT,mask:true};return {t:A.mask.target,mask:true};}
  return {t:compOut,mask:false};}
function drawView(){
  bindTarget(null);gl.clearColor(21/255,23/255,27/255,1);gl.clear(gl.COLOR_BUFFER_BIT);
  const dpr=dprNow(),z=view.zoom,vs=viewSource(),fl=cageFlatActive(),bv=ui.mode==='bake'?bakeViewTex():ui.mode==='convert'?cvViewTex():null,T=bv||(fl?cageRenderFlat(vs.t):vs.t),DW=fl?fl.fw:doc.w,DH=fl?fl.fh:doc.h;
  gl.bindTexture(gl.TEXTURE_2D,T.tex);
  if(z<1&&T===compOut){if(compOut.mipDirty){gl.generateMipmap(gl.TEXTURE_2D);compOut.mipDirty=false;}gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
  else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,z>=2?gl.NEAREST:gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,z>=2?gl.NEAREST:gl.LINEAR);
  const ox=view.x*dpr,oy=view.y*dpr,ew=DW*z*dpr,eh=DH*z*dpr,t=doc.wrap&&!fl;
  const sh=chan.show,n=sh.filter(Boolean).length,single=n===1?sh.indexOf(1):-1;
  run(P.view,null,{uComp:T.tex,uOrigin:t?[ox-ew,oy-eh]:[ox,oy],uExtent:t?[ew*3,eh*3]:[ew,eh],uViewport:[cv.width,cv.height],
    uUV0:t?[-1,-1]:[0,0],uUV1:t?[2,2]:[1,1],uChk1:[.235,.247,.271],uChk2:[.188,.2,.22],uChkSize:Math.max(4,8*dpr),
    uShow:sh,uSingle:{int:vs.mask?-1:single},uMaskView:vs.mask,...(fl?{}:selViewU(z,dpr,t)),...(fl?{}:animViewU(vs))});
  gl.bindTexture(gl.TEXTURE_2D,T.tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  releaseSelView();drawSelOverlay();drawXfOverlay();
}
/* animation mode: onion skin under the frame, and the chosen canvas background */
function animViewU(vs){if(ui.mode!=='anim'||vs.mask)return {};const u={};if(onionT){u.uUnder=onionT.tex;u.uUseUnder=true;}
  if(ui.animBg==='white')u.uBg=[1,1,1,1];else if(ui.animBg==='grey')u.uBg=[.5,.5,.5,1];else if(ui.animBg==='dark')u.uBg=[.12,.12,.13,1];return u;}
/* marching ants (active selection) or red overlay (quick mask) drawn by the view shader */
let selViewTmp=null;
function selViewU(z,dpr,wrap){if(!sel.t)return {};
  if(sel.quick){let t=sel.t;
    if(stroke&&stroke.L.quick&&stroke.o.tool!=='smudge'){selViewTmp=acquire();run(P.merge,selViewTmp,Object.assign({uSrc:beforeT.tex,uStrokeTex:strokeT.tex,uStroke:{int:strokeMode(stroke.o)},uStrokeColor:stroke.o.color,...tintU(),uStrokeOpacity:stroke.o.opacity,uLockAlpha:false},tonalU(stroke.o)));t=selViewTmp;bindTarget(null);}
    else if(preview&&!preview.off&&preview.et&&preview.et.L.quick)t=previewT;
    return {uSel:t.tex,uSelMode:{int:2},uWrap:wrap};}
  if(typeof selLive!=='undefined'&&selLive&&selLive.overlay&&selLive.on)return {uSel:sel.t.tex,uSelMode:{int:2},uWrap:wrap};
  if(!sel.active)return {};
  return {uSel:sel.t.tex,uSelMode:{int:1},uTime:(performance.now()/1000)%1000,uPx:1/(z*dpr),uWrap:wrap};}
function releaseSelView(){if(selViewTmp){release(selViewTmp);selViewTmp=null;}}

/* thumbnails */
const thumbT=makeTargetRaw(40,40);const thumbBuf=new Uint8Array(40*40*4);const thumbQ=new Set();
function makeTargetRaw(w,h){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);return {tex,fbo,w,h,depth:8};}
function scheduleThumb(n){if(n){if(n.frame)frameDirty(n);thumbQ.add(n);chanThumbDirty=true;}requestRender();}
let chanThumbDirty=true;
function renderThumb(target,canvas){const s=Math.min(40/doc.w,40/doc.h),tw=doc.w*s,th=doc.h*s;clearTarget(thumbT);
  run(P.resample,thumbT,{uSrc:target.tex,uOffset:[(40-tw)/2,(40-th)/2],uScale:[1/s,1/s],uTaps:{int:Math.min(8,Math.ceil(1/s))}});
  /* collected when the GPU is done, so thumbnails never make painting wait */
  asyncRead(thumbT.fbo,0,0,40,40,gl.UNSIGNED_BYTE,Uint8Array,40*40*4,buf=>{if(typeof canvas==='function'){canvas(buf);return;}
    const img=new ImageData(40,40);const d=img.data;
    for(let i=0;i<d.length;i+=4){const a=buf[i+3];if(a){d[i]=Math.min(255,buf[i]*255/a);d[i+1]=Math.min(255,buf[i+1]*255/a);d[i+2]=Math.min(255,buf[i+2]*255/a);d[i+3]=a;}}
    canvas.getContext('2d').putImageData(img,0,0);});}
function flushThumbs(){
  for(const n of thumbQ){if(n.type==='layer'&&n.target&&n.target.tex){let t=n.target;
      /* a layer with only one other map (a sent bake or conversion) shows that map instead of an empty square */
      if(doc.map==='base'&&isBlankBase(n)&&n.maps){const ks=Object.keys(n.maps).filter(k=>k!=='base'&&n.maps[k]&&!n.maps[k].empty&&n.maps[k].tex);if(ks.length===1)t=n.maps[ks[0]];}
      renderThumb(t,n.thumb);}
    if(n.mask&&n.mask.target.tex)renderThumb(n.mask.target,n.mask.thumb);}
  thumbQ.clear();
  if(chanThumbDirty&&compOut&&typeof drawChannelThumbs==='function'){chanThumbDirty=false;drawChannelThumbs();}
}
function changed(L){if(L)scheduleThumb(L);renderLayers();requestRender(true);}
function changedAll(){allNodes().forEach(scheduleThumb);chanThumbDirty=true;renderLayers();requestRender(true);}
