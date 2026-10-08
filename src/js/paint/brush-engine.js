/* ================= Brush engine ================= */
const BRUSH_DEFAULTS={size:24,opacity:1,flow:1,hardness:.85,spacing:.06,grain:0,smoothing:.25,pSize:true,pOpacity:false,minSize:.2,buildup:false,curve:0,strength:.6,charge:0,
  tip:null,angle:0,roundness:1,flipX:false,flipY:false,randFlipX:false,randFlipY:false,sizeJitter:0,angleJitter:0,scatter:0,count:1,bothAxes:false,followDir:false,
  hueJitter:0,satJitter:0,valJitter:0,jitterPerStroke:false,lazy:0,endInk:0};
/* lazy mouse: the brush follows the pointer on a string of R pixels, so it only moves once the string is pulled tight */
function lazyStep(s,x,y,R){if(!(R>0))return [x,y];if(s.lx===undefined){s.lx=s.sx;s.ly=s.sy;}const dx=x-s.lx,dy=y-s.ly,d=Math.hypot(dx,dy);if(d<=R)return null;s.lx+=dx*(d-R)/d;s.ly+=dy*(d-R)/d;return [s.lx,s.ly];}
/* Keep stabilization consistent across pointer sample rates. At 60 Hz this matches the
   original response; coalesced 120/240 Hz samples no longer make the stroke feel heavier. */
function strokeSmooth(s,x,y,p,amount,time,bypass){
  const response=clamp(amount,0,1)*.93,now=Number.isFinite(time)?time:performance.now();
  const dt=s.smoothAt==null?1000/60:clamp(now-s.smoothAt,1,100),scale=dt/(1000/60),k=1-Math.pow(response,scale);
  const pressureK=1-Math.pow(Math.min(response,.6),scale);
  s.smoothAt=now;const pos=bypass?1:k;s.sx+=(x-s.sx)*pos;s.sy+=(y-s.sy)*pos;s.sp+=(p-s.sp)*pressureK;return [s.sx,s.sy,s.sp];}
const brush=Object.assign({},BRUSH_DEFAULTS);
function pcurve(p,o){return Math.pow(clamp(p,0,1),Math.pow(2,-o.curve*1.6));}
function radiusAt(p){const o=stroke.o;let r=o.size/2*(stroke.rs||1);if(o.pSize)r*=o.minSize+(1-o.minSize)*pcurve(p,o);return Math.max(.5,r);}
function alphaAt(p){const o=stroke.o;let a=o.flow;if(o.pOpacity)a*=pcurve(p,o);return a;}
function spacingAt(p){return Math.max(.5,stroke.o.spacing*2*radiusAt(p));}
/* colour jitter: each dab (or each stroke) gets its own hue, saturation and brightness around the brush colour */
function jitterColor(c,o,grey){const R=()=>Math.random()*2-1;
  if(grey){const g=clamp(c[0]*(1+R()*(o.valJitter||0)),0,1);return [g,g,g];}
  let [h,s,v]=rgb2hsv(c[0],c[1],c[2]);h=((h+R()*(o.hueJitter||0)*180)%360+360)%360;s=clamp(s*(1+R()*(o.satJitter||0)),0,1);v=clamp(v*(1+R()*(o.valJitter||0)),0,1);return hsv2rgb(h,s,v);}
/* strokes with colour jitter keep each dab's colour in strokeT's RGB (straight colour, starting from the brush colour) */
function strokeTints(o){if(o.tool!=='brush'||o.noTint||!o.color)return false;const grey=doc.map!=='base';if(doc.map==='normal')return false;
  return grey?(o.valJitter||0)>0:((o.hueJitter||0)+(o.satJitter||0)+(o.valJitter||0))>0;}
const tintU=()=>({uStrokeTint:!!(stroke&&stroke.tint)});
function beginStroke(L,x,y,p,o){
  if(typeof liqClearRestore==='function')liqClearRestore();
  const W=doc.w,H=doc.h;
  /* Big canvases: plain painting copies only the part of the layer the stroke covered, when it ends (endStroke), and
     clears only what the last stroke left in strokeT, instead of the whole canvas each time (a 16k canvas is 1 GB). */
  const weldMask=!!o.weldMask&&L.maskOf?.materialPaint?.startsWith('weld:')&&!L.maskObj?.stack;
  const lazy=['brush','erase','dodge','burn'].includes(o.tool)&&(!L.maskOf||weldMask)&&!L.quick&&ui.mode!=='bake'&&(!o.space||weldMask);
  if(strokeT.w===1&&strokeT.h===1&&doc.w*doc.h>=67108864)useAux(L.target.depth,false,lazy);
  else if(!lazy&&(beforeT.w!==W||beforeT.h!==H))useAux(L.target.depth,false);
  if(!lazy)blit(L.target,beforeT,0,0,W,H,0,0);
  const tint=strokeTints(o),tc=[0,0,0,0];let clearBox=null;
  if(o.tool!=='smudge'){
    const d=strokeT.dirtyR;
    if(d&&d!=='all'){if(d[2]>0&&d[3]>0){scissorDo(d,()=>clearTarget(strokeT,tint?tc:undefined));clearBox=[d[0],d[1],d[0]+d[2],d[1]+d[3]];}}
    else if(d==='all'||doc.wrap){clearTarget(strokeT,tint?tc:undefined);clearBox=[0,0,W,H];}
    strokeT.dirtyR=null;
  }
  /* o.space: the stroke is stamped somewhere else (a cage's flat space, the screen over the 3D model) and drawn into strokeT by space.sync() */
  const cg=o.tool!=='smudge'&&o.space?o.space:null;if(cg)clearTarget(cg.buf,tint?tc:undefined);
  const SW=cg?cg.w:W,SH=cg?cg.h:H;
  const gx=Math.max(1,Math.round(W/6)),gy=Math.max(1,Math.round(H/6));
  stroke={lazy,fd:o.space?'all':null,L,o,x,y,p,lsx:x,lsy:y,dir:0,carry:0,bb:[W,H,0,0],clearBox,gScale:[W/gx,H/gy],gPeriod:[gx,gy],space:cg,rs:cg?(o.cageRs||1):1,SW,SH,sym:o.sym||null,tint,grey:doc.map!=='base'};
  if(tint&&o.jitterPerStroke)stroke.dabCol=jitterColor(o.color,o,stroke.grey);
  /* other maps painted by the same stroke: make sure the layer has an image there; with Lock alpha they follow the base colour's shape */
  if(o.extras&&o.extras.length){for(const e of o.extras)ensureMapTarget(L,e.key);
    if(L.lockAlpha){const lt=acquireD(doc.depth);run(P.lockcov,lt,Object.assign({uA:mapT(L,'base').tex},selU(o)));stroke.lockT=lt;stroke.exU={uSelTex:lt.tex,uUseSel:true};}
    else stroke.exU=selU(o);}
  if(o.tool==='clone')cloneBegin(stroke);
  stamp(x,y,p);stroke.carry=spacingAt(p);if(o.tool==='brush'&&o.endInk>0){stroke.inkAnchor=[x,y];stroke.inkSince=performance.now();stroke.inkFrame=requestAnimationFrame(brushInkLoop);}requestRender(true);
}
/* Ink wets the paper while the nib lingers, rather than adding a dot at release.
   A bounded, local stamp uses the normal selection, symmetry, maps and undo path. */
function brushInkLoop(now){const s=stroke;if(!s||!s.inkAnchor)return;
  if(now-(s.inkTick||0)>=33){s.inkTick=now;const age=(now-s.inkSince)/1000;
    const pressure=pcurve(s.p,s.o),charge=clamp((age-.12)/1.25,0,1)*clamp(s.o.endInk/.18,0,2)*(.15+.85*pressure);
    if(charge>0&&Math.abs(charge-(s.inkCharge||0))>.007){s.inkCharge=charge;const r=radiusAt(s.p),yup=!!(s.space&&s.space.yup),ang0=-(s.o.angle||0)*Math.PI/180+(s.o.followDir?(yup?-s.dir:s.dir):0),ang=yup?-ang0:ang0;
      /* Preserve the narrow nib; ink wets only a small fringe of its own shape. */
      const radius=r*(1+Math.min(.16,Math.sqrt(charge)*.12));
      for(const c of symCopies(s.sym,s.SW,s.SH,s.x+r*.015,s.y-r*.015,ang,s.o.flipX?-1:1,(s.o.flipY?-1:1)*(yup?-1:1),0,0))stampOne(c[0],c[1],radius,alphaAt(s.p)*clamp(.3+charge,0,1),c[2],c[3],c[4],0,0);
      if(s.space)s.spaceDirty=true;requestRender(true);}}
  s.inkFrame=requestAnimationFrame(brushInkLoop);
}
function stamp(x,y,p){
  const s=stroke,o=s.o,r0=radiusAt(p),a=alphaAt(p);
  let dx=0,dy=0;if(o.tool==='smudge'){dx=x-s.lsx;dy=y-s.lsy;s.lsx=x;s.lsy=y;}
  const n=Math.max(1,Math.round(o.count||1)),dir=s.dir,PI=Math.PI;
  for(let k=0;k<n;k++){
    const r=Math.max(.5,r0*(1-(o.sizeJitter||0)*Math.random()));
    const yup=!!(s.space&&s.space.yup),ang0=-(o.angle||0)*PI/180+(o.followDir?(yup?-dir:dir):0)+(o.angleJitter||0)*(Math.random()*2-1)*PI,ang=yup?-ang0:ang0;/* (0.32) the screen buffer over the 3D model counts y upward: mirror the tip so it lands the right way up */
    let px=x,py=y;
    if(o.scatter>0){const d=r0*2*o.scatter,c=Math.cos(dir),sn=Math.sin(dir),t=(Math.random()*2-1)*d;px+=-sn*t;py+=c*t;if(o.bothAxes){const u=(Math.random()*2-1)*d;px+=c*u;py+=sn*u;}}
    const fx=(o.flipX?-1:1)*(o.randFlipX&&Math.random()<.5?-1:1),fy=(o.flipY?-1:1)*(o.randFlipY&&Math.random()<.5?-1:1)*(yup?-1:1);
    if(s.tint&&!o.jitterPerStroke)s.dabCol=jitterColor(o.color,o,s.grey);
    for(const c of symCopies(s.sym,s.SW,s.SH,px,py,ang,fx,fy,dx,dy))stampOne(c[0],c[1],r,a,c[2],c[3],c[4],c[5],c[6]);
  }
  if(s.space)s.spaceDirty=true;if(s.clone)s.cloneDirty=true;
}
/* continue a stroke from a new place without painting the gap between (a stroke that left the cage and came back) */
function strokeJump(x,y,p){const s=stroke;if(!s)return;s.x=x;s.y=y;s.p=p;s.lsx=x;s.lsy=y;stamp(x,y,p);s.carry=spacingAt(p);requestRender(true);}
function stampOne(x,y,r,a,ang,fx,fy,dx,dy){
  const s=stroke,o=s.o,W=s.SW||doc.w,H=s.SH||doc.h,tip=o.tip&&o.tip.tex?o.tip:null,ext=r*(tip?1.4143:1)+2;const copies=[];
  if(doc.wrap&&!s.space){const cx0=mod(x,W),cy0=mod(y,H);for(const ox of [-W,0,W])for(const oy of [-H,0,H]){const cx=cx0+ox,cy=cy0+oy;if(cx+ext<0||cx-ext>W||cy+ext<0||cy-ext>H)continue;copies.push([cx,cy]);}}
  else if(!(x+ext<0||x-ext>W||y+ext<0||y-ext>H))copies.push([x,y]);
  if(!copies.length)return;
  const U={uRadius:r,uExtent:ext,uSize:[W,H],uHard:o.hardness,uGrain:o.grain,uGrainScale:s.gScale,uPeriod:s.gPeriod,
    uUseTip:!!tip,uTip:tip?tip.tex:dummy,uAngle:ang,uRound:o.roundness||1,uFlip:[fx,fy],uTipAspect:tip?tip.w/tip.h:1};
  if(o.tool==='smudge'){
    if(doc.wrap)blit(s.L.target,scratchT,0,0,W,H,0,0);
    else{const x0=clamp(Math.floor(Math.min(x,x-dx)-ext-4),0,W),y0=clamp(Math.floor(Math.min(y,y-dy)-ext-4),0,H),x1=clamp(Math.ceil(Math.max(x,x-dx)+ext+4),0,W),y1=clamp(Math.ceil(Math.max(y,y-dy)+ext+4),0,H);if(x1>x0&&y1>y0)blit(s.L.target,scratchT,x0,y0,x1-x0,y1-y0,x0,y0);}
    for(const c of copies)run(P.smudge,s.L.target,Object.assign({},U,{uCenter:c,uSrc:scratchT.tex,uDelta:[dx,dy],uAlpha:a,uStrength:o.strength,uCharge:o.charge,uColor:o.color,uLockAlpha:s.L.lockAlpha},chanU(o),selU(o)));
  } else {
    const dst=s.space?s.space.buf:strokeT;
    if(dst===strokeT&&!doc.wrap)for(const c of copies)clearStrokeBufferRegion(s,[c[0]-ext,c[1]-ext,c[0]+ext,c[1]+ext]);
    for(const c of copies){if(s.tint)run(P.stamp,dst,Object.assign({},U,{uCenter:c,uAlpha:a,uTint:{int:2},uDabCol:s.dabCol}),{blend:'tintfirst'});
      run(P.stamp,dst,Object.assign({},U,{uCenter:c,uAlpha:a,uTint:{int:s.tint?1:0},uDabCol:s.dabCol||[0,0,0]}),{blend:o.buildup?'over':s.tint?'tintmax':'max'});}
  }
  for(const [cx,cy] of copies){const b=s.bb;b[0]=Math.min(b[0],cx-ext-1);b[1]=Math.min(b[1],cy-ext-1);b[2]=Math.max(b[2],cx+ext+1);b[3]=Math.max(b[3],cy+ext+1);}
  /* what changed since the last frame, so only that part of the picture is composited again */
  if(s.fd!=='all')for(const [cx,cy] of copies){const e=ext+(o.tool==='smudge'?Math.hypot(dx,dy):0)+3;fdAdd(s,[cx-e,cy-e,cx+e,cy+e]);}
}
/* The stroke texture only needs initialized pixels where this stroke can merge. Grow a cleared
   rectangle as dabs extend the stroke, clearing just its newly exposed strips instead of the
   entire (potentially 8K or 16K) canvas at pointer-down. */
function clearStrokeBufferRegion(s,r){
  const W=doc.w,H=doc.h,x0=clamp(Math.floor(r[0]),0,W),y0=clamp(Math.floor(r[1]),0,H),x1=clamp(Math.ceil(r[2]),0,W),y1=clamp(Math.ceil(r[3]),0,H);
  if(x1<=x0||y1<=y0)return;
  const b=s.clearBox;
  if(!b){scissorDo([x0,y0,x1-x0,y1-y0],()=>clearTarget(strokeT));s.clearBox=[x0,y0,x1,y1];return;}
  const nx0=Math.min(b[0],x0),ny0=Math.min(b[1],y0),nx1=Math.max(b[2],x1),ny1=Math.max(b[3],y1);
  if(nx0===b[0]&&ny0===b[1]&&nx1===b[2]&&ny1===b[3])return;
  const clear=(x,y,w,h)=>{if(w>0&&h>0)scissorDo([x,y,w,h],()=>clearTarget(strokeT));};
  clear(nx0,ny0,nx1-nx0,Math.max(0,b[1]-ny0));
  clear(nx0,b[3],nx1-nx0,Math.max(0,ny1-b[3]));
  const iy0=Math.max(ny0,b[1]),iy1=Math.min(ny1,b[3]);
  clear(nx0,iy0,Math.max(0,b[0]-nx0),iy1-iy0);
  clear(b[2],iy0,Math.max(0,nx1-b[2]),iy1-iy0);
  s.clearBox=[nx0,ny0,nx1,ny1];
}
/* changed areas are kept as a few separate boxes (symmetry paints far apart: one box around both would be most of the canvas) */
function fdAdd(s,r){const L=s.fd||(s.fd=[]),near=Math.max(64,(r[2]-r[0])*2);
  for(const f of L)if(r[0]<=f[2]+near&&r[2]>=f[0]-near&&r[1]<=f[3]+near&&r[3]>=f[1]-near){f[0]=Math.min(f[0],r[0]);f[1]=Math.min(f[1],r[1]);f[2]=Math.max(f[2],r[2]);f[3]=Math.max(f[3],r[3]);return;}
  L.push(r.slice());if(L.length>12){const u=L.reduce((a,f)=>[Math.min(a[0],f[0]),Math.min(a[1],f[1]),Math.max(a[2],f[2]),Math.max(a[3],f[3])]);s.fd=[u];}}
function addPoint(x,y,p){
  const s=stroke;if(!s)return;const dx=x-s.x,dy=y-s.y,len=Math.hypot(dx,dy);
  if(s.inkAnchor&&Math.hypot(x-s.inkAnchor[0],y-s.inkAnchor[1])>Math.max(.5,radiusAt(p)*.12)){s.inkAnchor=[x,y];s.inkSince=performance.now();s.inkCharge=0;}
  if(len<1e-4){s.p=p;return;}
  if(len>0.5)s.dir=Math.atan2(dy,dx);
  let t=s.carry,guard=0;
  while(t<=len&&guard++<20000){const f=t/len,pp=s.p+(p-s.p)*f;stamp(s.x+dx*f,s.y+dy*f,pp);t+=spacingAt(pp);}
  s.carry=t-len;s.x=x;s.y=y;s.p=p;requestRender(true);
}
function endStroke(record){
  const s=stroke;if(!s)return;const L=s.L,W=doc.w,H=doc.h;
  if(s.inkFrame)cancelAnimationFrame(s.inkFrame);
  if(s.space){s.spaceDirty=false;s.space.sync();const b=s.space.bbox(s);s.bb=doc.wrap?[0,0,W,H]:[b[0]-2,b[1]-2,b[2]+2,b[3]+2];}
  const healing=s.o.tool==='heal',cloning=s.o.tool==='clone';
  const x0=clamp(Math.floor(s.bb[0]),0,W),y0=clamp(Math.floor(s.bb[1]),0,H),x1=clamp(Math.ceil(s.bb[2]),0,W),y1=clamp(Math.ceil(s.bb[3]),0,H),bw=x1-x0,bh=y1-y0,R=[x0,y0,bw,bh];
  /* A normal stroke needs only a small before-image of its painted area for merging and undo. */
  let lazySrc=null,lazyBefore=null;
  if(s.lazy&&bw>0&&bh>0){lazySrc=makeTarget(bw,bh,L.target.depth,false,packedHeight(L.target.depth));blit(L.target,lazySrc,x0,y0,bw,bh,0,0);if(record)lazyBefore=captureRegion(lazySrc,0,0,bw,bh);}
  if(s.o.tool!=='smudge'&&!healing&&!cloning&&bw>0&&bh>0){scissorDo(R,()=>run(strokeMergeProgram(s),L.target,{uSrc:s.lazy?lazySrc.tex:beforeT.tex,uSrcOrigin:{iv2:s.lazy?[x0,y0]:[0,0]},uStrokeTex:strokeT.tex,uStroke:{int:strokeMode(s.o)},...tonalU(s.o),uStrokeColor:s.o.color,uStrokeTint:!!s.tint,uStrokeOpacity:s.o.opacity,uLockAlpha:L.lockAlpha,...chanU(s.o),...selU(s.o),...strokeMaterialU(s)}));if(lazySrc)disposeTarget(lazySrc);}
  if(s.o.tool!=='smudge')strokeT.dirtyR=s.space?'all':R;
  /* the heal brush heals every map of the layer where the stroke went */
  const parts=healing?healApply(s,x0,y0,bw,bh,record).parts:cloning&&s.clone?cloneEnd(s,x0,y0,bw,bh,record):[];
  for(const e of (healing||cloning?[]:s.o.extras||[])){if(!(bw>0&&bh>0))break;const T=mapT(L,e.key),old=acquireD(T.depth);blit(T,old,x0,y0,bw,bh,x0,y0);
    if(record&&bw>0&&bh>0)parts.push({k:e.key,before:captureRegion(old,x0,y0,bw,bh)});
    scissorDo(R,()=>run(strokeMergeProgram(s),T,Object.assign({uSrc:old.tex,uStrokeTex:strokeT.tex,uStroke:{int:e.mode},uStrokeColor:e.color,uStrokeOpacity:s.o.opacity,uLockAlpha:false},chanU(null),s.exU,strokeMaterialU(s,e.key))));release(old);
    if(parts.length&&parts[parts.length-1].k===e.key)parts[parts.length-1].after=captureRegion(T,x0,y0,bw,bh);}
  if(s.lockT)release(s.lockT);dropStrokeCache(s);
  stroke=null;
  if(record){
    if(bw>0&&bh>0){const r=regionRecord(L,lazyBefore||captureRegion(beforeT,x0,y0,bw,bh),captureRegion(L.target,x0,y0,bw,bh),x0,y0,bw,bh,s.o.tool==='erase'?'Erase':s.o.tool==='smudge'?'Blend':s.o.tool==='dodge'?'Dodge':s.o.tool==='burn'?'Burn':healing?'Heal':cloning?'Clone':'Brush stroke');
      if(L.onRecord)L.onRecord(r,[x0,y0,bw,bh]);
      pushUndo(parts.length?withMapParts(r,L,parts,x0,y0):r);}
    scheduleThumb(L.maskOf||L);
  }
  requestRender(true);if(typeof v3WeldEnd==='function')v3WeldEnd(s,R);
}
