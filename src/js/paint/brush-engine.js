/* ================= Brush engine ================= */
const BRUSH_DEFAULTS={size:24,opacity:1,flow:1,hardness:.85,spacing:.06,grain:0,smoothing:.25,pSize:true,pOpacity:false,minSize:.2,buildup:false,curve:0,strength:.6,charge:0,
  tip:null,angle:0,roundness:1,flipX:false,flipY:false,randFlipX:false,randFlipY:false,sizeJitter:0,angleJitter:0,scatter:0,count:1,bothAxes:false,followDir:false};
const brush=Object.assign({},BRUSH_DEFAULTS);
function pcurve(p,o){return Math.pow(clamp(p,0,1),Math.pow(2,-o.curve*1.6));}
function radiusAt(p){const o=stroke.o;let r=o.size/2;if(o.pSize)r*=o.minSize+(1-o.minSize)*pcurve(p,o);return Math.max(.5,r);}
function alphaAt(p){const o=stroke.o;let a=o.flow;if(o.pOpacity)a*=pcurve(p,o);return a;}
function spacingAt(p){return Math.max(.5,stroke.o.spacing*2*radiusAt(p));}
function beginStroke(L,x,y,p,o){
  const W=doc.w,H=doc.h;blit(L.target,beforeT,0,0,W,H,0,0);
  if(o.tool!=='smudge')clearTarget(strokeT);
  const gx=Math.max(1,Math.round(W/6)),gy=Math.max(1,Math.round(H/6));
  stroke={L,o,x,y,p,lsx:x,lsy:y,dir:0,carry:0,bb:[W,H,0,0],gScale:[W/gx,H/gy],gPeriod:[gx,gy]};
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
    stampOne(px,py,r,a,ang,fx,fy,dx,dy);
  }
}
function stampOne(x,y,r,a,ang,fx,fy,dx,dy){
  const s=stroke,o=s.o,W=doc.w,H=doc.h,tip=o.tip&&o.tip.tex?o.tip:null,ext=r*(tip?1.4143:1)+2;const copies=[];
  if(doc.wrap){const cx0=mod(x,W),cy0=mod(y,H);for(const ox of [-W,0,W])for(const oy of [-H,0,H]){const cx=cx0+ox,cy=cy0+oy;if(cx+ext<0||cx-ext>W||cy+ext<0||cy-ext>H)continue;copies.push([cx,cy]);}}
  else if(!(x+ext<0||x-ext>W||y+ext<0||y-ext>H))copies.push([x,y]);
  if(!copies.length)return;
  const U={uRadius:r,uExtent:ext,uSize:[W,H],uHard:o.hardness,uGrain:o.grain,uGrainScale:s.gScale,uPeriod:s.gPeriod,
    uUseTip:!!tip,uTip:tip?tip.tex:dummy,uAngle:ang,uRound:o.roundness||1,uFlip:[fx,fy],uTipAspect:tip?tip.w/tip.h:1};
  if(o.tool==='smudge'){
    if(doc.wrap)blit(s.L.target,scratchT,0,0,W,H,0,0);
    else{const x0=clamp(Math.floor(Math.min(x,x-dx)-ext-4),0,W),y0=clamp(Math.floor(Math.min(y,y-dy)-ext-4),0,H),x1=clamp(Math.ceil(Math.max(x,x-dx)+ext+4),0,W),y1=clamp(Math.ceil(Math.max(y,y-dy)+ext+4),0,H);if(x1>x0&&y1>y0)blit(s.L.target,scratchT,x0,y0,x1-x0,y1-y0,x0,y0);}
    for(const c of copies)run(P.smudge,s.L.target,Object.assign({},U,{uCenter:c,uSrc:scratchT.tex,uDelta:[dx,dy],uAlpha:a,uStrength:o.strength,uCharge:o.charge,uColor:o.color,uLockAlpha:s.L.lockAlpha},chanU(o),selU(o)));
  } else {
    for(const c of copies)run(P.stamp,strokeT,Object.assign({},U,{uCenter:c,uAlpha:a}),{blend:o.buildup?'over':'max'});
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
  if(s.o.tool!=='smudge')run(P.merge,L.target,{uSrc:beforeT.tex,uStrokeTex:strokeT.tex,uStroke:{int:s.o.tool==='erase'?2:1},uStrokeColor:s.o.color,uStrokeOpacity:s.o.opacity,uLockAlpha:L.lockAlpha,...chanU(s.o),...selU(s.o)});
  stroke=null;
  if(record){
    const x0=clamp(Math.floor(s.bb[0]),0,W),y0=clamp(Math.floor(s.bb[1]),0,H),x1=clamp(Math.ceil(s.bb[2]),0,W),y1=clamp(Math.ceil(s.bb[3]),0,H);
    if(x1>x0&&y1>y0){const w=x1-x0,h=y1-y0;pushUndo(regionRecord(L,captureRegion(beforeT,x0,y0,w,h),captureRegion(L.target,x0,y0,w,h),x0,y0,w,h,s.o.tool==='erase'?'Erase':s.o.tool==='smudge'?'Blend':'Brush stroke'));}
    scheduleThumb(L.maskOf||L);
  }
  requestRender(true);
}
