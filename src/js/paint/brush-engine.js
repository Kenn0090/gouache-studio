/* ================= Brush engine ================= */
const BRUSH_DEFAULTS={size:24,opacity:1,flow:1,hardness:.85,spacing:.06,grain:0,smoothing:.25,pSize:true,pOpacity:false,minSize:.2,buildup:false,curve:0,strength:.6,charge:0,
  tip:null,angle:0,roundness:1,flipX:false,flipY:false,randFlipX:false,randFlipY:false,sizeJitter:0,angleJitter:0,scatter:0,count:1,bothAxes:false,followDir:false,
  hueJitter:0,satJitter:0,valJitter:0,jitterPerStroke:false,lazy:0};
/* lazy mouse: the brush follows the pointer on a string of R pixels, so it only moves once the string is pulled tight */
function lazyStep(s,x,y,R){if(!(R>0))return [x,y];if(s.lx===undefined){s.lx=s.sx;s.ly=s.sy;}const dx=x-s.lx,dy=y-s.ly,d=Math.hypot(dx,dy);if(d<=R)return null;s.lx+=dx*(d-R)/d;s.ly+=dy*(d-R)/d;return [s.lx,s.ly];}
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
  const W=doc.w,H=doc.h;blit(L.target,beforeT,0,0,W,H,0,0);
  const tint=strokeTints(o),tc=[0,0,0,0];
  if(o.tool!=='smudge')clearTarget(strokeT,tint?tc:undefined);
  /* o.space: the stroke is stamped somewhere else (a cage's flat space, the screen over the 3D model) and drawn into strokeT by space.sync() */
  const cg=o.tool!=='smudge'&&o.space?o.space:null;if(cg)clearTarget(cg.buf,tint?tc:undefined);
  const SW=cg?cg.w:W,SH=cg?cg.h:H;
  const gx=Math.max(1,Math.round(W/6)),gy=Math.max(1,Math.round(H/6));
  stroke={L,o,x,y,p,lsx:x,lsy:y,dir:0,carry:0,bb:[W,H,0,0],gScale:[W/gx,H/gy],gPeriod:[gx,gy],space:cg,rs:cg?(o.cageRs||1):1,SW,SH,sym:o.sym||null,tint,grey:doc.map!=='base'};
  if(tint&&o.jitterPerStroke)stroke.dabCol=jitterColor(o.color,o,stroke.grey);
  /* other maps painted by the same stroke: make sure the layer has an image there; with Lock alpha they follow the base colour's shape */
  if(o.extras&&o.extras.length){for(const e of o.extras)ensureMapTarget(L,e.key);
    if(L.lockAlpha){const lt=acquireD(doc.depth);run(P.lockcov,lt,Object.assign({uA:mapT(L,'base').tex},selU(o)));stroke.lockT=lt;stroke.exU={uSelTex:lt.tex,uUseSel:true};}
    else stroke.exU=selU(o);}
  if(o.tool==='clone')cloneBegin(stroke);
  stamp(x,y,p);stroke.carry=spacingAt(p);requestRender(true);
}
function stamp(x,y,p){
  const s=stroke,o=s.o,r0=radiusAt(p),a=alphaAt(p);
  let dx=0,dy=0;if(o.tool==='smudge'){dx=x-s.lsx;dy=y-s.lsy;s.lsx=x;s.lsy=y;}
  const n=Math.max(1,Math.round(o.count||1)),dir=s.dir,PI=Math.PI;
  for(let k=0;k<n;k++){
    const r=Math.max(.5,r0*(1-(o.sizeJitter||0)*Math.random()));
    const ang=-(o.angle||0)*PI/180+(o.followDir?dir:0)+(o.angleJitter||0)*(Math.random()*2-1)*PI;
    let px=x,py=y;
    if(o.scatter>0){const d=r0*2*o.scatter,c=Math.cos(dir),sn=Math.sin(dir),t=(Math.random()*2-1)*d;px+=-sn*t;py+=c*t;if(o.bothAxes){const u=(Math.random()*2-1)*d;px+=c*u;py+=sn*u;}}
    const fx=(o.flipX?-1:1)*(o.randFlipX&&Math.random()<.5?-1:1),fy=(o.flipY?-1:1)*(o.randFlipY&&Math.random()<.5?-1:1);
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
    for(const c of copies){if(s.tint)run(P.stamp,dst,Object.assign({},U,{uCenter:c,uAlpha:a,uTint:{int:2},uDabCol:s.dabCol}),{blend:'tintfirst'});
      run(P.stamp,dst,Object.assign({},U,{uCenter:c,uAlpha:a,uTint:{int:s.tint?1:0},uDabCol:s.dabCol||[0,0,0]}),{blend:o.buildup?'over':s.tint?'tintmax':'max'});}
  }
  for(const [cx,cy] of copies){const b=s.bb;b[0]=Math.min(b[0],cx-ext-1);b[1]=Math.min(b[1],cy-ext-1);b[2]=Math.max(b[2],cx+ext+1);b[3]=Math.max(b[3],cy+ext+1);}
}
function addPoint(x,y,p){
  const s=stroke;if(!s)return;const dx=x-s.x,dy=y-s.y,len=Math.hypot(dx,dy);
  if(len<1e-4){s.p=p;return;}
  if(len>0.5)s.dir=Math.atan2(dy,dx);
  let t=s.carry,guard=0;
  while(t<=len&&guard++<20000){const f=t/len,pp=s.p+(p-s.p)*f;stamp(s.x+dx*f,s.y+dy*f,pp);t+=spacingAt(pp);}
  s.carry=t-len;s.x=x;s.y=y;s.p=p;requestRender(true);
}
function endStroke(record){
  const s=stroke;if(!s)return;const L=s.L,W=doc.w,H=doc.h;
  if(s.space){s.spaceDirty=false;s.space.sync();const b=s.space.bbox(s);s.bb=doc.wrap?[0,0,W,H]:[b[0]-2,b[1]-2,b[2]+2,b[3]+2];}
  const healing=s.o.tool==='heal',cloning=s.o.tool==='clone';
  if(s.o.tool!=='smudge'&&!healing&&!cloning)run(P.merge,L.target,{uSrc:beforeT.tex,uStrokeTex:strokeT.tex,uStroke:{int:strokeMode(s.o)},...tonalU(s.o),uStrokeColor:s.o.color,uStrokeTint:!!s.tint,uStrokeOpacity:s.o.opacity,uLockAlpha:L.lockAlpha,...chanU(s.o),...selU(s.o)});
  const x0=clamp(Math.floor(s.bb[0]),0,W),y0=clamp(Math.floor(s.bb[1]),0,H),x1=clamp(Math.ceil(s.bb[2]),0,W),y1=clamp(Math.ceil(s.bb[3]),0,H),bw=x1-x0,bh=y1-y0;
  /* the heal brush heals every map of the layer where the stroke went */
  const parts=healing?healApply(s,x0,y0,bw,bh,record).parts:cloning&&s.clone?cloneEnd(s,x0,y0,bw,bh,record):[];
  for(const e of (s.o.extras||[])){const T=mapT(L,e.key),old=acquireD(T.depth);blit(T,old,0,0,W,H,0,0);
    if(record&&bw>0&&bh>0)parts.push({k:e.key,before:captureRegion(old,x0,y0,bw,bh)});
    run(P.merge,T,Object.assign({uSrc:old.tex,uStrokeTex:strokeT.tex,uStroke:{int:e.mode},uStrokeColor:e.color,uStrokeOpacity:s.o.opacity,uLockAlpha:false},chanU(null),s.exU));release(old);
    if(parts.length&&parts[parts.length-1].k===e.key)parts[parts.length-1].after=captureRegion(T,x0,y0,bw,bh);}
  if(s.lockT)release(s.lockT);dropStrokeCache(s);
  stroke=null;
  if(record){
    if(bw>0&&bh>0){const r=regionRecord(L,captureRegion(beforeT,x0,y0,bw,bh),captureRegion(L.target,x0,y0,bw,bh),x0,y0,bw,bh,s.o.tool==='erase'?'Erase':s.o.tool==='smudge'?'Blend':s.o.tool==='dodge'?'Dodge':s.o.tool==='burn'?'Burn':healing?'Heal':cloning?'Clone':'Brush stroke');
      if(L.onRecord)L.onRecord(r,[x0,y0,bw,bh]);
      pushUndo(parts.length?withMapParts(r,L,parts,x0,y0):r);}
    scheduleThumb(L.maskOf||L);
  }
  requestRender(true);
}
