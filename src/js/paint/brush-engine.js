/* ================= Brush engine ================= */
const BRUSH_DEFAULTS={size:24,opacity:1,flow:1,hardness:.85,spacing:.06,grain:0,pattern:0,patSize:10,patDen:1,patRamp:0,texKey:'',texScale:128,texDepth:0,texInvert:false,taperStart:0,taperEnd:0,smoothing:.25,pSize:true,pOpacity:false,minSize:.2,buildup:false,curve:0,strength:.6,charge:0,sampleAll:true,hueMix:0,
  tip:null,angle:0,roundness:1,flipX:false,flipY:false,randFlipX:false,randFlipY:false,sizeJitter:0,angleJitter:0,scatter:0,count:1,bothAxes:false,followDir:false,
  hueJitter:0,satJitter:0,valJitter:0,jitterPerStroke:false,lazy:0,correction:0,lineBlend:false,fanFill:0,blendMode:'smear',streak:0,mixKeep:false,laneN:0,laneHue:0,laneVal:0,laneMode:0,endInk:0,dual:null,pFlow:false,edgeSat:0,glaze:0,pigment:1,wet:0,pickup:0,mixLab:false,paintMix:.7,mix:false,mixLoad:.8,mixPick:.5,mixWet:.7,mixDry:0,mixUse:.2,mixBristles:0,mixDryB:0,mixThick:0,mixEven:false,mixWC:0,mixWCEdge:0,mixWCPools:0,mixWCGran:0,mixWCBloom:0,mixTooth:0,spray:0,sprayDen:.8,sprayMist:0,sprayVar:0,sprayFleck:0,sprayRing:0,spraySwirl:0,sprayPress:0,spraySolid:1,tooth:0,simP:'off',simLevel:.7,drip:0,dripAuto:0,dripWidth:1,smoothCurve:false};
/* lazy mouse: the brush follows the pointer on a string of R pixels, so it only moves once the string is pulled tight */
function lazyStep(s,x,y,R){if(!(R>0))return [x,y];if(s.lx===undefined){s.lx=s.sx;s.ly=s.sy;}const dx=x-s.lx,dy=y-s.ly,d=Math.hypot(dx,dy);if(d<=R)return null;s.lx+=dx*(d-R)/d;s.ly+=dy*(d-R)/d;return [s.lx,s.ly];}
/* Keep stabilization consistent across pointer sample rates. At 60 Hz this matches the
   original response; coalesced 120/240 Hz samples no longer make the stroke feel heavier. */
function strokeSmooth(s,x,y,p,amount,time,bypass){
  const response=clamp(amount,0,1)*.93,now=Number.isFinite(time)?time:performance.now();
  const dt=s.smoothAt==null?1000/60:clamp(now-s.smoothAt,1,100),scale=dt/(1000/60),k=1-Math.pow(response,scale);
  const pressureK=1-Math.pow(Math.min(response,.6),scale);
  s.smoothAt=now;const pos=bypass?1:k;s.sx+=(x-s.sx)*pos;s.sy+=(y-s.sy)*pos;s.sp+=(p-s.sp)*pressureK;return [s.sx,s.sy,s.sp];}
/* Line correction (0.95, Kenn): the line is drawn a little behind the pen, from the average of the points around it (both the ones behind and the ones just ahead),
   so wobble is ironed out without the usual stabiliser lag or rounding off corners; when the pen lifts, the rest is flushed so the line ends where the pen did.
   W = how far (in image pixels, along the path) the averaging reaches. */
function corrFeed(s,x,y,p,W,flush,endX,endY){const Q=s.cq||(s.cq={x:[],y:[],p:[],l:[],i:0,j:0});
  const push=(a,b,c)=>{const n=Q.x.length,l=n?Q.l[n-1]+Math.hypot(a-Q.x[n-1],b-Q.y[n-1]):0;Q.x.push(a);Q.y.push(b);Q.p.push(c);Q.l.push(l);};
  if(!flush)push(x,y,p);else if(endX!==undefined&&Q.x.length)push(endX,endY,p);
  const out=[],n=Q.x.length;
  while(Q.i<n){const i=Q.i,li=Q.l[i];if(!flush&&Q.l[n-1]-li<W)break;
    if(flush&&i===n-1){out.push([Q.x[i],Q.y[i],Q.p[i]]);Q.i++;continue;}
    while(Q.j<i&&li-Q.l[Q.j]>W)Q.j++;
    let sx=0,sy=0,sp=0,sw=0;
    for(let j=Q.j;j<n;j++){const d=Math.abs(Q.l[j]-li);if(d>W){if(Q.l[j]>li)break;continue;}const w=1-d/(W+1e-6);sx+=Q.x[j]*w;sy+=Q.y[j]*w;sp+=Q.p[j]*w;sw+=w;}
    out.push(sw>0?[sx/sw,sy/sw,sp/sw]:[Q.x[i],Q.y[i],Q.p[i]]);Q.i++;}
  return out;}
const brush=Object.assign({},BRUSH_DEFAULTS);
function pcurve(p,o){return Math.pow(clamp(p,0,1),Math.pow(2,-o.curve*1.6));}
function radiusAt(p){const o=stroke.o;let r=o.size/2*(stroke.rs||1);if(o.pSize)r*=o.minSize+(1-o.minSize)*pcurve(p,o);return Math.max(.5,r);}
function alphaAt(p){const o=stroke.o;let a=o.flow;if(o.pOpacity||o.pFlow)a*=pcurve(p,o);return a;}
function spacingAt(p){return Math.max(.5,stroke.o.spacing*2*radiusAt(p));}
/* colour jitter: each dab (or each stroke) gets its own hue, saturation and brightness around the brush colour */
function jitterColor(c,o,grey){const R=()=>Math.random()*2-1;
  if(grey){const g=clamp(c[0]*(1+R()*(o.valJitter||0)),0,1);return [g,g,g];}
  let [h,s,v]=rgb2hsv(c[0],c[1],c[2]);h=((h+R()*(o.hueJitter||0)*180)%360+360)%360;s=clamp(s*(1+R()*(o.satJitter||0)),0,1);v=clamp(v*(1+R()*(o.valJitter||0)),0,1);return hsv2rgb(h,s,v);}
/* strokes with colour jitter keep each dab's colour in strokeT's RGB (straight colour, starting from the brush colour) */
function strokeTints(o){if(o.tool!=='brush'||o.noTint||!o.color)return false;const grey=doc.map!=='base';if(doc.map==='normal')return false;
  if((o.lineBlend||o.fanFill)&&!grey&&!o.space)return true;/* Line blend (0.95): the strip carries its own colours */
  if(o.laneN>0&&!grey&&!o.space)return true;/* lanes of colour across the brush */
  /* A colour stencil supplies RGB in the projection, even with all colour jitter off.
     Keep the brush RGB in the screen buffer too, so holding N can bypass it mid-stroke. */
  if(!grey&&o.space&&o.space.colourStencil)return true;
  return grey?(o.valJitter||0)>0:((o.hueJitter||0)+(o.satJitter||0)+(o.valJitter||0))>0;}
const tintU=()=>({uStrokeTint:!!(stroke&&stroke.tint)});
function beginStroke(L,x,y,p,o){
  if(typeof liqClearRestore==='function')liqClearRestore();
  const W=doc.w,H=doc.h;
  /* Big canvases: plain painting copies only the part of the layer the stroke covered, when it ends (endStroke), and
     clears only what the last stroke left in strokeT, instead of the whole canvas each time (a 16k canvas is 1 GB). */
  const lazy=['brush','erase','dodge','burn'].includes(o.tool)&&!L.quick&&ui.mode!=='bake'&&(!o.space||!!L.maskOf);
  if(strokeT.w===1&&strokeT.h===1&&doc.w*doc.h>=67108864)useAux(L.target.depth,false,lazy);
  else if(!lazy&&(beforeT.w!==W||beforeT.h!==H))useAux(L.target.depth,false);
  if(!lazy)blit(L.target,beforeT,0,0,W,H,0,0);
  const tint=strokeTints(o),tc=[0,0,0,0];let clearBox=null;
  /* a watercolour mixing stroke draws into the stroke buffer like a normal brush, so it clears what the last stroke left there first (otherwise that leftover is forgotten and shows through later strokes) */
  if(o.tool!=='smudge'||(o.mixBrush&&o.mixWC>0)){
    const d=strokeT.dirtyR;
    if(d&&d!=='all'){if(d[2]>0&&d[3]>0){scissorDo(d,()=>clearTarget(strokeT,tint?tc:undefined));clearBox=[d[0],d[1],d[0]+d[2],d[1]+d[3]];}}
    else if(d==='all'||doc.wrap){clearTarget(strokeT,tint?tc:undefined);clearBox=[0,0,W,H];}
    strokeT.dirtyR=null;
  }
  /* o.space: the stroke is stamped somewhere else (a cage's flat space, the screen over the 3D model) and drawn into strokeT by space.sync() */
  const cg=o.space&&(o.tool!=='smudge'||o.space.mesh)?o.space:null;if(cg)clearTarget(cg.buf,tint?tc:undefined);
  const SW=cg?cg.w:W,SH=cg?cg.h:H;
  const sampleT=o.tool==='smudge'&&o.sampleAll&&!o.space&&!L.maskOf&&!L.quick?compositeMap(doc.map):null;
  const gx=Math.max(1,Math.round(W/6)),gy=Math.max(1,Math.round(H/6));
  stroke={lazy,fd:o.space?'all':null,L,o,x,y,p,lsx:x,lsy:y,dir:0,carry:0,bb:[W,H,0,0],clearBox,gScale:[W/gx,H/gy],gPeriod:[gx,gy],space:cg,rs:cg?(o.cageRs||1):1,SW,SH,sym:o.sym||null,tint,grey:doc.map!=='base',sampleT,sampleAt:performance.now()};
  /* Resolve the library and repeating mask once, rather than per dab at low spacing. */
  stroke.dualU=typeof dualUniforms==='function'?dualUniforms(o.dual,false):null;
  if(o.mixBrush)mixBegin(stroke);
  if((o.drip>0||o.dripAuto>0)&&o.tool==='brush'&&!o.space){stroke.drips=[];stroke.dAx=x;stroke.dAy=y;stroke.dwell=0;stroke.dripT=performance.now();stroke.dripFrame=requestAnimationFrame(brushDripLoop);}
  if(o.smoothCurve&&!o.space&&['brush','erase','smudge'].includes(o.tool))stroke.cv={px:x,py:y,pp:p,mx:x,my:y,mp:p};
  if(tint&&o.jitterPerStroke)stroke.dabCol=jitterColor(o.color,o,stroke.grey);
  /* other maps painted by the same stroke: make sure the layer has an image there; with Lock alpha they follow the base colour's shape */
  if(o.extras&&o.extras.length){for(const e of o.extras)ensureMapTarget(L,e.key);
    if(L.lockAlpha){const lt=acquireD(doc.depth);run(P.lockcov,lt,Object.assign({uA:mapT(L,'base').tex},selU(o)));stroke.lockT=lt;stroke.exU={uSelTex:lt.tex,uUseSel:true};}
    else stroke.exU=selU(o);}
  if(o.tool==='clone')cloneBegin(stroke);
  if(o.tool==='smudge'&&stroke.space)meshSmudgeBegin(stroke);/* on the 3D model (mesh-pull.js) */
  if((o.lineBlend||o.fanFill)&&tint&&typeof lbBegin==='function'){stroke.cv=null;lbBegin(stroke);requestRender(true);return;}
  /* a brush that turns with the stroke waits for the first couple of pixels, so its first dab already points the way you are going */
  if(o.followDir&&(o.tool==='brush'||o.tool==='erase'||o.mixer)&&!o.space){stroke.fdWait=true;stroke.carry=0;}else{stamp(x,y,p);stroke.carry=spacingAt(p);}if(o.tool==='brush'&&o.endInk>0){stroke.inkAnchor=[x,y];stroke.inkSince=performance.now();stroke.inkFrame=requestAnimationFrame(brushInkLoop);}requestRender(true);
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
/* Drips: hold the brush still with the button down and paint runs down from under it. Each drip grows downward, slowing and thinning, and ends in a small bead.
   The drips only run while the button is held; releasing keeps what has run so far. */
/* a drip is solid paint: drawn with a hard round dab, not with the spray shape */
function dripDab(s,x,y,r,a){s.solid=true;try{stampOne(x,y,r,a,0,1,1,0,0);}finally{s.solid=false;}}
/* Pressure without a pen: the mouse has no pressure, so it can be made up. Speed: moving fast gives a light thin line, slow a heavy one (like a real can).
   Taper: the stroke eases in from thin, and fades out when you let go. Fixed: one pressure you choose. A real pen is never changed. */
function simPressStart(p0,e){const o=brush;if(e.pointerType==='pen'||!o.simP||o.simP==='off')return p0;return o.simP==='fixed'?clamp(o.simLevel||.7,.05,1):o.simP==='taper'?.15:.8;}
function simPress(P,ix,iy,time,p0){const o=brush;if(!P||!P.sim||P.sim.pen||!o.simP||o.simP==='off')return p0;const S=P.sim,dist=Math.hypot(ix-S.x,iy-S.y),dt=Math.max(1,time-S.t);S.x=ix;S.y=iy;S.t=time;S.travel+=dist;
  if(o.simP==='fixed')return clamp(o.simLevel||.7,.05,1);
  if(o.simP==='speed'){S.spd=S.spd*.8+(dist/dt)*.2;return clamp(1.05-S.spd/Math.max(.6,o.size*.02),.1,1);}
  return clamp(.08+.92*S.travel/Math.max(30,o.size*1.1),.08,1);}
function taperTail(s){if(!s.simOn&&!(s.o.taperEnd>0))return;const len=s.o.taperEnd>0?s.o.taperEnd:Math.max(30,s.o.size*2.2),n=20,p0=s.p;for(let i=1;i<=n;i++)addPointLin(s.x+Math.cos(s.dir)*len/n,s.y+Math.sin(s.dir)*len/n,Math.max(.05,p0*Math.pow(1-i/n,1.3)));}
function dripSpawn(s,x,y,k){const o=s.o,r=radiusAt(s.p);if(s.drips.length>=60)return;
  s.drips.push({x,y,w:Math.max(1.8,o.size*.042*(o.dripWidth||1))*(.7+Math.random()*.7),len:0,max:r*(1.5+Math.random()*4)*(.6+k),sp:45+Math.random()*110,ph:Math.random()*6,done:false});}
/* when the button is released the drips still running finish most of their run at once, so a stroke keeps its drips */
function dripFinish(s){if(!s.drips)return;const a=Math.min(1,alphaAt(s.p)+.5);
  for(const d of s.drips){if(d.done)continue;const target=d.max*(.55+.45*Math.random()),adv=Math.max(0,target-d.len),y0=d.y+d.len,steps=Math.max(1,Math.ceil(adv/Math.max(1,d.w*.35)));
    for(let i=1;i<=steps;i++){const yy=y0+adv*i/steps;dripDab(s,d.x+Math.sin(d.ph+yy*.03)*.6,yy,d.w*(1-.25*(d.len+adv*i/steps)/d.max)/2,a);}
    d.done=true;dripDab(s,d.x,d.y+d.len+adv,d.w*.62,a);}}
function brushDripLoop(now){const s=stroke;if(!s||!s.drips)return;
  const dt=Math.min(.25,Math.max(0,(now-(s.dripT||now))/1000));s.dripT=now;const o=s.o,r=radiusAt(s.p);
  if(Math.hypot(s.x-s.dAx,s.y-s.dAy)>Math.max(2,r*.12)){s.dAx=s.x;s.dAy=s.y;s.dwell=0;s.held=0;}else s.dwell+=dt;
  if(o.drip>0&&s.dwell>.3&&(s.held||0)<4&&s.drips.length<60){const k=Math.min(1.6,s.dwell-.3);if(Math.random()<o.drip*(.8+k)*1.2*dt){s.held=(s.held||0)+1;
    dripSpawn(s,s.x+(Math.random()-.5)*r*.9,s.y+r*.05*Math.random(),k);}}
  const a=Math.min(1,alphaAt(s.p)+.5);
  for(const d of s.drips){if(d.done)continue;const adv=d.sp*dt*(1-.7*d.len/d.max),y0=d.y+d.len;d.len+=adv;
    const steps=Math.max(1,Math.ceil(adv/Math.max(1,d.w*.35)));
    for(let i=1;i<=steps;i++){const yy=y0+adv*i/steps;dripDab(s,d.x+Math.sin(d.ph+yy*.03)*.6,yy,d.w*(1-.25*d.len/d.max)/2,a);}
    if(d.len>=d.max){d.done=true;dripDab(s,d.x,d.y+d.len,d.w*.62,a);}}/* the bead at the end */
  requestRender(true);s.dripFrame=requestAnimationFrame(brushDripLoop);}
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
  if(s.space&&!s.msm)s.spaceDirty=true;if(s.clone)s.cloneDirty=true;
}
/* continue a stroke from a new place without painting the gap between (a stroke that left the cage and came back) */
function refreshStrokeSample(s){if(!s||!s.sampleT||!s.o.sampleAll||s.o.mixBrush)return false;const now=performance.now();if(now-s.sampleAt<16)return false;const prev=s.sampleT;s.sampleT=compositeMap(doc.map);if(s.samplePrevT)release(s.samplePrevT);s.samplePrevT=prev;s.sampleAt=now;return true;}
function strokeJump(x,y,p){const s=stroke;if(!s)return;refreshStrokeSample(s);s.sampleBlend=1;s.x=x;s.y=y;s.p=p;s.lsx=x;s.lsy=y;stamp(x,y,p);if(s.samplePrevT){release(s.samplePrevT);s.samplePrevT=null;}s.carry=spacingAt(p);requestRender(true);}
function stampOne(x,y,r,a,ang,fx,fy,dx,dy){
  const s=stroke,o=s.o,W=s.SW||doc.w,H=s.SH||doc.h,tip=o.tip&&o.tip.tex?o.tip:null,ext=r*(tip?1.4143:o.spray>0&&o.sprayFleck>0?2.8:1)+2;const copies=[];
  if(doc.wrap&&!s.space){const cx0=mod(x,W),cy0=mod(y,H);for(const ox of [-W,0,W])for(const oy of [-H,0,H]){const cx=cx0+ox,cy=cy0+oy;if(cx+ext<0||cx-ext>W||cy+ext<0||cy-ext>H)continue;copies.push([cx,cy]);}}
  else if(!(x+ext<0||x-ext>W||y+ext<0||y-ext>H))copies.push([x,y]);
  if(!copies.length)return;
  const U={uRadius:r,uExtent:ext,uLane:[o.laneN||0,o.laneHue||0,o.laneVal||0,o.laneMode||0],uSize:[W,H],uHard:s.solid?.9:o.hardness,uGrain:s.solid?0:o.grain,uGrainScale:s.gScale,uPeriod:s.gPeriod,
    uUseTip:!!tip,uTip:tip?tip.tex:dummy,uAngle:ang,uRound:o.roundness||1,uFlip:[fx,fy],uTipAspect:tip?tip.w/tip.h:1,uSpray:o.spray>0&&!tip&&!s.solid?[o.spray,o.sprayDen*(1-(o.sprayPress||0)*(1-pcurve(s.p,o))),Math.random()*997,o.sprayMist]:[0,0,0,0],uSprayVar:o.sprayVar||0,uSprayFleck:o.spray>0&&!tip&&!s.solid?(o.sprayFleck||0)*((o.pSize||o.pFlow||o.pOpacity||o.simP!=='off')?.3+.7*pcurve(s.p,o):1):0,uSprayRing:o.spray>0&&!tip&&!s.solid?[o.sprayRing||0,o.spraySwirl||0,(s.ph=(s.ph||0)+.9+Math.random()*.5)]:[0,0,0],uSpraySolid:o.spraySolid==null?1:o.spraySolid,uTexImg:(s.texT===undefined&&(s.texT=o.texDepth>0&&o.texKey&&typeof dualTip==='function'?dualTip({tipKey:o.texKey}):null),s.texT)?s.texT.tex:dummy,uTexSet:[o.texScale||128,s.texT?o.texDepth:0,o.texInvert?1:0,1.5],uPat:o.pattern>0?[o.pattern,o.patSize||10,(o.patDen==null?1:o.patDen)*(.4+.6*pcurve(s.p,o))*(o.patRamp>0?.22+.78*Math.min(1,(s.trav||0)/o.patRamp):1),s.patSeed==null?(s.patSeed=Math.random()*400):s.patSeed]:[0,10,1,0],uPaper:o.tooth>0?(()=>{const pi=s.pap||(s.pap=(typeof paperInfo==='function'&&paperInfo())||{t:4,sc:1});return [pi.t,pi.sc,o.tooth];})():[0,1,0]};
  if(s.dualU){if(o.dual.random)s.dualU.uDualOff=[Math.random()*s.dualU.uDualSize[0],Math.random()*s.dualU.uDualSize[1]];Object.assign(U,s.dualU);}
  if(o.tool==='smudge'&&s.space){/* on the 3D model: the dab goes into the screen buffer, then pulls paint through the model's UVs (mesh-pull.js) */
    clearTarget(s.space.buf);for(const c of copies)run(P.stamp,s.space.buf,Object.assign({},U,{uCenter:c,uAlpha:a,uTint:{int:0},uDabCol:[0,0,0]}),{blend:'max'});
    for(const c of copies)meshSmudgeApply(s,c[0],c[1],ext,dx,dy);
  } else if(o.tool==='smudge'){
    if(doc.wrap)blit(s.L.target,scratchT,0,0,W,H,0,0);
    else{const x0=clamp(Math.floor(Math.min(x,x-dx)-ext-4),0,W),y0=clamp(Math.floor(Math.min(y,y-dy)-ext-4),0,H),x1=clamp(Math.ceil(Math.max(x,x-dx)+ext+4),0,W),y1=clamp(Math.ceil(Math.max(y,y-dy)+ext+4),0,H);if(x1>x0&&y1>y0)blit(s.L.target,scratchT,x0,y0,x1-x0,y1-y0,x0,y0);}
    if(s.mix){for(const c of copies)mixDab(s,c,U,a,ext,r,dx,dy);}else for(const c of copies)run(P.smudge,s.L.target,Object.assign({},U,{uCenter:c,uSrc:(s.sampleT||scratchT).tex,uSrcPrev:(s.samplePrevT||s.sampleT||scratchT).tex,uSampleBlend:s.samplePrevT?clamp(s.sampleBlend??1,0,1):1,uDst:scratchT.tex,uDelta:[dx,dy],uSoft:o.blendMode==='soft'?1:0,uStreak:o.streak||0,uAlpha:a,uStrength:o.strength,uCharge:o.charge,uPaintMix:o.paintMix||0,uMixLab:o.mixLab?1:0,uHueMix:clamp(o.hueMix||0,0,1),uNormalMap:{int:doc.map==='normal'?1:0},uColor:o.color,uLockAlpha:s.L.lockAlpha},chanU(o),selU(o)));
  } else {
    const dst=s.space?s.space.buf:strokeT;
    if(dst===strokeT&&!doc.wrap)for(const c of copies)clearStrokeBufferRegion(s,[c[0]-ext,c[1]-ext,c[0]+ext,c[1]+ext]);
    if(s.dualBatch){s.dualBatch.u=U;for(const c of copies)s.dualBatch.data.push(c[0],c[1],r,ext,ang,a,fx,fy,...U.uDualOff);
      if(s.dualBatch.data.length>=10240){dualBatchFlush(s);dualBatchStart(s);}}
    else for(const c of copies){if(s.tint)run(P.stamp,dst,Object.assign({},U,{uCenter:c,uAlpha:a,uTint:{int:2},uDabCol:s.dabCol}),{blend:'tintfirst'});
      run(P.stamp,dst,Object.assign({},U,{uCenter:c,uAlpha:a,uTint:{int:s.tint?1:0},uDabCol:s.dabCol||[0,0,0]}),{blend:o.buildup||o.pFlow?'over':s.tint?'tintmax':'max'});}
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
function addPointLin(x,y,p){
  const s=stroke;if(!s)return;if(s.lb)return lbMove(s,x,y,p);const dx=x-s.x,dy=y-s.y,len=Math.hypot(dx,dy);
  if(s.inkAnchor&&Math.hypot(x-s.inkAnchor[0],y-s.inkAnchor[1])>Math.max(.5,radiusAt(p)*.12)){s.inkAnchor=[x,y];s.inkSince=performance.now();s.inkCharge=0;}
  if(len<1e-4){s.p=p;return;}s.trav=(s.trav||0)+len;
  if(s.fdWait){if(len<2.5){s.p=p;return;}s.fdWait=false;}
  if(len>0.5)s.dir=Math.atan2(dy,dx);
  const sampled=!!s.sampleT&&refreshStrokeSample(s);let t=s.carry,guard=0;
  if(typeof dualBatchStart==='function')dualBatchStart(s);
  try{while(t<=len&&guard++<20000){const f=t/len;let pp=s.p+(p-s.p)*f;if(s.o.taperStart>0)pp*=Math.max(.06,Math.min(1,((s.trav||0)-len+t)/s.o.taperStart));s.sampleBlend=sampled?f:1;stamp(s.x+dx*f,s.y+dy*f,pp);t+=spacingAt(pp);}}
  finally{if(s.dualBatch)dualBatchFlush(s);}
  if(s.drips&&s.o.dripAuto>0){const r=radiusAt(p),n=s.o.dripAuto*len/Math.max(8,r*3);if(Math.random()<n){const g=(Math.random()+Math.random()+Math.random()-1.5)*.7;dripSpawn(s,x+g*r,y+r*(.35+.35*Math.random()),Math.random()*.4);}}
  s.sampleBlend=1;if(s.samplePrevT){release(s.samplePrevT);s.samplePrevT=null;}s.carry=t-len;s.x=x;s.y=y;s.p=p;requestRender(true);
}
/* Smooth curves: instead of straight lines between the points the pointer reports, the stroke follows a curve that passes
   through the middle of each segment, with the reported points as its control points. Corners round off and long strokes flow.
   The stroke trails half a segment behind the pointer and catches up when it ends (endStroke). */
function addPoint(x,y,p){const s=stroke;if(!s)return;const c=s.cv;if(!c)return addPointLin(x,y,p);
  const mx=(c.px+x)/2,my=(c.py+y)/2,mp=(c.pp+p)/2;curveTo(s,c,c.px,c.py,c.pp,mx,my,mp);c.px=x;c.py=y;c.pp=p;c.mx=mx;c.my=my;c.mp=mp;}
function curveTo(s,c,cx,cy,cp,ex,ey,ep){const sx=c.mx,sy=c.my,sp=c.mp,len=Math.hypot(cx-sx,cy-sy)+Math.hypot(ex-cx,ey-cy),n=clamp(Math.ceil(len/3),1,60);
  for(let i=1;i<=n;i++){const t=i/n,u=1-t;addPointLin(u*u*sx+2*u*t*cx+t*t*ex,u*u*sy+2*u*t*cy+t*t*ey,sp+(ep-sp)*t);}}
function curveFinish(s){const c=s.cv;if(!c)return;s.cv=null;curveTo(s,c,c.px,c.py,c.pp,c.px,c.py,c.pp);}
function endStroke(record){
  const s=stroke;if(!s)return;curveFinish(s);taperTail(s);if(s.drips)dripFinish(s);if(s.fdWait){s.fdWait=false;stamp(s.x,s.y,s.p);}const L=s.L,W=doc.w,H=doc.h;
  if(s.inkFrame)cancelAnimationFrame(s.inkFrame);if(s.dripFrame)cancelAnimationFrame(s.dripFrame);
  if(s.space){if(s.spaceDirty){s.spaceDirty=false;s.space.sync();}const b=s.space.bbox(s);s.bb=doc.wrap?[0,0,W,H]:[b[0]-2,b[1]-2,b[2]+2,b[3]+2];}
  const healing=s.o.tool==='heal',cloning=s.o.tool==='clone';
  const x0=clamp(Math.floor(s.bb[0]),0,W),y0=clamp(Math.floor(s.bb[1]),0,H),x1=clamp(Math.ceil(s.bb[2]),0,W),y1=clamp(Math.ceil(s.bb[3]),0,H),bw=x1-x0,bh=y1-y0,R=[x0,y0,bw,bh];
  /* A normal stroke needs only a small before-image of its painted area for merging and undo. */
  let lazySrc=null,lazyBefore=null;
  if(s.lazy&&bw>0&&bh>0){lazySrc=makeTarget(bw,bh,L.target.depth,false,packedHeight(L.target.depth));blit(L.target,lazySrc,x0,y0,bw,bh,0,0);if(record)lazyBefore=captureRegion(lazySrc,0,0,bw,bh);}
  if(s.o.tool!=='smudge'&&!healing&&!cloning&&bw>0&&bh>0){scissorDo(R,()=>run(strokeMergeProgram(s),L.target,{uSrc:s.lazy?lazySrc.tex:beforeT.tex,uSrcOrigin:{iv2:s.lazy?[x0,y0]:[0,0]},uStrokeTex:strokeT.tex,uStroke:{int:strokeMode(s.o)},...tonalU(s.o),uStrokeColor:s.o.color,uStrokeTint:!!s.tint,uStrokeOpacity:s.o.opacity,uLockAlpha:L.lockAlpha,...chanU(s.o),...selU(s.o),...strokeMaterialU(s)}));if(lazySrc)disposeTarget(lazySrc);}
  if(s.o.tool!=='smudge'||s.wcBuf)strokeT.dirtyR=s.space?'all':R;
  /* the heal brush heals every map of the layer where the stroke went */
  const parts=healing?healApply(s,x0,y0,bw,bh,record).parts:cloning&&s.clone?cloneEnd(s,x0,y0,bw,bh,record):s.msm?meshSmudgeEnd(s,x0,y0,bw,bh,record):[];
  for(const e of (healing||cloning||s.msm?[]:s.o.extras||[])){if(!(bw>0&&bh>0))break;const T=mapT(L,e.key),old=acquireD(T.depth);blit(T,old,x0,y0,bw,bh,x0,y0);
    if(record&&bw>0&&bh>0)parts.push({k:e.key,before:captureRegion(old,x0,y0,bw,bh)});
    scissorDo(R,()=>run(strokeMergeProgram(s),T,Object.assign({uSrc:old.tex,uStrokeTex:strokeT.tex,uStroke:{int:e.mode},uStrokeColor:e.color,uStrokeOpacity:s.o.opacity,uLockAlpha:false},chanU(null),s.exU,strokeMaterialU(s,e.key))));release(old);
    if(parts.length&&parts[parts.length-1].k===e.key)parts[parts.length-1].after=captureRegion(T,x0,y0,bw,bh);}
  if(s.lockT)release(s.lockT);if(s.sampleT)release(s.sampleT);if(s.samplePrevT)release(s.samplePrevT);dropStrokeCache(s);
  if(s.mix)mixEnd(s);
  if(s.lb)lbEnd(s);
  stroke=null;
  if(record){
    if(bw>0&&bh>0){const r=regionRecord(L,lazyBefore||captureRegion(beforeT,x0,y0,bw,bh),captureRegion(L.target,x0,y0,bw,bh),x0,y0,bw,bh,s.o.tool==='erase'?'Erase':s.o.tool==='smudge'?(s.o.mixer?'Brush stroke':'Blend'):s.o.tool==='dodge'?'Dodge':s.o.tool==='burn'?'Burn':healing?'Heal':cloning?'Clone':'Brush stroke');
      if(L.onRecord)L.onRecord(r,[x0,y0,bw,bh]);
      pushUndo(parts.length?withMapParts(r,L,parts,x0,y0):r);}
    scheduleThumb(L.maskOf||L);
  }
  requestRender(true);if(typeof v3WeldEnd==='function')v3WeldEnd(s,R);
}
