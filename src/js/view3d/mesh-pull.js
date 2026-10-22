/* ================= Smudge, Smear and Liquify on the 3D model (0.63) =================
   Painting on the model stamps the brush into a screen-sized buffer and looks it up from the model's UV layout (mesh-paint.js).
   Smudge and Liquify need to know where paint comes FROM: the depth pass also stores each screen pixel's UV, so a texel that is
   under the brush (found by projecting its 3D position to the screen) can look at the pixel the stroke came from, read that pixel's
   UV, and take the colour there. That works across UV seams and on every map of the layer at once (a material).
   Smudge: each dab pulls paint from where the brush just was and carries it on. Smear: the same, but it drags a longer streak.
   Liquify: the screen gets a movement map (pushed, pinched, bloated, twirled); the layer is redrawn from a copy of how it was,
   through that map, so the picture is resampled only once per stroke. */
const smudge3d=(()=>{const d={mode:'smudge'};try{Object.assign(d,JSON.parse(localStorage.getItem('gs.smudge3d')||'{}'));}catch(e){}return d;})();
const smudge3dSave=()=>{try{localStorage.setItem('gs.smudge3d',JSON.stringify({mode:smudge3d.mode}));}catch(e){}};
/* uMode 0: Smudge (under the dab, pull from the pixel uDelta behind it); 1: Liquify (pull through the movement map uDisp2) */
const FS_3DPULL=`in vec3 vP; in vec3 vN; in vec2 vT; uniform mat4 uVPm; uniform highp sampler2D uDepth; uniform vec3 uCamP; uniform int uAlign; uniform int uNoBack; uniform int uUseUDIM; uniform vec2 uUDIMTile;
uniform int uMode; uniform sampler2D uCopy; uniform sampler2D uStroke; uniform vec2 uDelta; uniform float uK; uniform float uCharge; uniform vec3 uColor; uniform int uLockAlpha; uniform float uTol; uniform int uNormalMap;
uniform sampler2D uDisp2; uniform sampler2D uSelTex; uniform int uUseSel;
void main(){ if(uUseUDIM==1&&any(notEqual(floor(vT),uUDIMTile)))discard;
  vec4 c=uVPm*vec4(vP,1.0); if(c.w<=1e-6) discard; vec2 s=c.xy/c.w*0.5+0.5; if(s.x<0.0||s.y<0.0||s.x>1.0||s.y>1.0) discard;
  ivec2 ds=textureSize(uDepth,0); ivec2 ip=clamp(ivec2(s*vec2(ds)),ivec2(0),ds-ivec2(1)); float z=texelFetch(uDepth,ip,0).r; float d=length(vP-uCamP);
  vec3 n=normalize(vN),viewDir=normalize(uCamP-vP);
  if(uNoBack==1){ vec3 gn=cross(dFdx(vP),dFdy(vP)); if(dot(gn,gn)>1e-24){ gn=normalize(gn); if(dot(gn,vN)<0.0) gn=-gn; if(dot(gn,viewDir)<=0.0) discard; } }
  if(uAlign==1){ if(dot(n,viewDir)<-0.035) discard; } else if(z<=0.0||d>z*1.006+0.004) discard;
  ivec2 fp=ivec2(gl_FragCoord.xy); vec4 dst=texelFetch(uCopy,fp,0);
  float m=1.0; if(uUseSel==1) m=texelFetch(uSelTex,fp,0).r; if(m<=0.0) discard;
  vec2 shift; float k;
  if(uMode==0){ k=texelFetch(uStroke,ip,0).a*uK*m; if(k<=0.0) discard; shift=uDelta; }
  else{ shift=texelFetch(uDisp2,ip,0).xy; k=m; if(dot(shift,shift)<1e-6){ o=dst; return; } }
  ivec2 sp2=ivec2(floor(s*vec2(ds)-shift));
  if(any(lessThan(sp2,ivec2(0)))||any(greaterThanEqual(sp2,ds))){ if(uMode==1){ o=dst; return; } discard; }
  vec4 sv=texelFetch(uDepth,sp2,0);
  if(sv.r<=0.0||abs(sv.r-d)>uTol*d){ if(uMode==1){ o=dst; return; } discard; }
  vec4 pulled=texture(uCopy,sv.gb);
  if(uMode==0) pulled=mix(pulled,vec4(uColor,1.0),uCharge);
  vec4 r=mix(dst,pulled,clamp(k,0.0,1.0));
  if(uNormalMap==1&&r.a>1e-6){ vec3 nn=r.rgb/r.a*2.0-1.0; float ll=length(nn); nn=ll>1e-4?nn/ll:vec3(0.0,0.0,1.0); r=vec4((nn*0.5+0.5)*r.a,r.a); } /* normals stay unit length */
  if(uLockAlpha==1){ vec3 cc=r.a>1e-6?r.rgb/r.a:vec3(0.0); r=vec4(cc*dst.a,dst.a); }
  o=r; }`;
let P3PULL=null;
function p3pull(){if(!P3PULL)P3PULL=prog3(VS_3DPROJ,FS_3DPULL);return P3PULL;}
/* the part of a map that a screen rectangle can have touched, as whole pixels (or null) */
function meshPullRect(sp,bb){const rc=sp.bbox({bb:[bb[0]-2,bb[1]-2,bb[2]+2,bb[3]+2]});if(!rc||rc[2]<=rc[0]||rc[3]<=rc[1])return null;
  const x0=clamp(Math.floor(rc[0]),0,doc.w),y0=clamp(Math.floor(rc[1]),0,doc.h),x1=clamp(Math.ceil(rc[2]),0,doc.w),y1=clamp(Math.ceil(rc[3]),0,doc.h);return x1>x0&&y1>y0?[x0,y0,x1-x0,y1-y0]:null;}
/* ---- Smudge and Smear ---- */
/* a copy of every map as it was, so the undo step can hold all of them (the primary map's copy is beforeT) */
function meshSmudgeBegin(s){const L=s.L,items=[];
  const add=(k,T)=>{const bef=k===null?beforeT:acquireD(T.depth);if(k!==null)blit(T,bef,0,0,T.w,T.h,0,0);items.push({k,T,bef});};
  add(null,L.target);
  if(!L.maskOf&&!L.quick&&L.maps)for(const k of Object.keys(L.maps)){const T=L.maps[k];if(!T||T===L.target||T.empty||!T.tex)continue;add(k,T);}
  s.msm={items};}
/* one dab: cx,cy = where it is on screen, ext = its reach, dx,dy = how far the brush moved since the last dab */
function meshSmudgeApply(s,cx,cy,ext,dx,dy){const sp=s.space,m=s.msm;if(!sp||!m)return;
  const rc=meshPullRect(sp,[cx-ext,cy-ext,cx+ext,cy+ext]);if(!rc)return;
  const o=s.o,smear=smudge3d.mode==='smear',k=smear?Math.min(1,o.strength*1.35+.15):o.strength,mul=smear?2.4:1,P=p3pull(),sel=selU(o);
  for(const it of m.items){const T=it.T,colour=(it.k===null?doc.map:it.k)==='base',pre=acquireD(T.depth);blit(T,pre,rc[0],rc[1],rc[2],rc[3],rc[0],rc[1]);
    scissorDo(rc,()=>sp.pull(P,T,Object.assign({uMode:{int:0},uNormalMap:{int:doc.map==='normal'?1:0},uCopy:pre.tex,uStroke:sp.buf.tex,uDelta:[dx*mul,dy*mul],uK:k,uTol:.12,uCharge:colour?(o.charge||0):0,uColor:o.color||[0,0,0],uLockAlpha:{int:s.L.lockAlpha?1:0}},sel)));
    release(pre);}
  if(!s.L.maskOf&&!s.L.quick)s.L.lookVer=(s.L.lookVer||0)+1;}
/* at the end: the undo parts of the other maps */
function meshSmudgeEnd(s,x0,y0,bw,bh,record){const parts=[];
  for(const it of s.msm.items){if(it.k===null)continue;if(record&&bw>0&&bh>0)parts.push({k:it.k,before:captureRegion(it.bef,x0,y0,bw,bh),after:captureRegion(it.T,x0,y0,bw,bh)});release(it.bef);}
  s.msm=null;return parts;}
/* Smudge or Smear, shown where the Blend brush's settings are (3D Paint only) */
function smudge3dSeg(){return seg([['smudge','Smudge','Blend paint along the stroke'],['smear','Smear','Drag a longer streak of paint']],smudge3d.mode,v=>{smudge3d.mode=v;smudge3dSave();if(typeof buildBrushPanel==='function')buildBrushPanel();if(typeof buildOptBar==='function')buildOptBar();},'Smudge or Smear');}
/* ---- Liquify ---- */
function meshLiqDown(hit,e,et,o,sp){
  if(!canFloat){toast('Liquify needs a graphics card that can use 16-bit textures.');return true;}
  if(!sp.mesh||(typeof p3!=='undefined'&&p3.udim)){toast('Liquify on the model needs a plain texture set (no UDIM tiles).');return true;}
  if(liq.mode==='restore'){toast('Restore works on the flat canvas. On the model use Push, Pinch, Bloat or Twirl.');return true;}
  liqProgs();const L=et.L,items=[];
  const add=(k,T)=>{const orig=acquireD(T.depth);blit(T,orig,0,0,T.w,T.h,0,0);items.push({k,T,orig});};
  add(null,et.target);
  if(!et.isMask&&L.maps)for(const k of mapKeysOf(L)){const T=mapT(L,k);if(!T||T===et.target||T.empty)continue;add(k,T);}
  const D=makeTarget(sp.w,sp.h,16,false),tmp=makeTarget(sp.w,sp.h,16,false);clearTarget(D,[0,0,0,0]);
  const [x,y]=meshPt(hit,e),ml={L,et,o,sp,items,D,tmp,w:sp.w,h:sp.h,last:[x,y],pos:[x,y],bb:null,dirty:null,t:performance.now(),dabs:0,scale:meshBrushScale(hit.getBoundingClientRect().height)};
  v3.mstroke={id:e.pointerId,liq:true,ml};meshLiqDab(ml,x,y,0,0,1);meshLiqFlush(ml);meshLiqLoop(ml);return true;}
/* one dab into the screen's movement map */
function meshLiqDab(ml,x,y,dx,dy,amount){const r=liq.size/2*ml.scale,mode=['push','pinch','bloat','cw','ccw'].indexOf(liq.mode);if(mode<0)return;
  const twirl=mode>=3,K=mode===0?0:twirl?liq.strength*amount*.04*(liq.mode==='cw'?-1:1):liq.strength*amount*.12;
  const bx=Math.max(0,Math.floor(x-r-1)),by=Math.max(0,Math.floor(y-r-1)),bw=Math.min(ml.w,Math.ceil(x+r+1))-bx,bh=Math.min(ml.h,Math.ceil(y+r+1))-by;if(bw<=0||bh<=0)return;
  scissorDo([bx,by,bw,bh],()=>run(P_LIQDAB,ml.tmp,{uD:ml.D.tex,uC:[x,y],uR:r,uMode:{int:twirl?3:mode},uDelta:[dx*liq.strength*1.6,dy*liq.strength*1.6],uK:K}));
  blit(ml.tmp,ml.D,bx,by,bw,bh,bx,by);const box=[bx,by,bx+bw,by+bh];
  ml.bb=ml.bb?[Math.min(ml.bb[0],box[0]),Math.min(ml.bb[1],box[1]),Math.max(ml.bb[2],box[2]),Math.max(ml.bb[3],box[3])]:box;
  ml.dirty=ml.dirty?[Math.min(ml.dirty[0],box[0]),Math.min(ml.dirty[1],box[1]),Math.max(ml.dirty[2],box[2]),Math.max(ml.dirty[3],box[3])]:box;ml.dabs++;}
/* redraw every map from its copy through the movement map, inside what changed */
function meshLiqFlush(ml){if(!ml.dirty)return;const rc=meshPullRect(ml.sp,ml.dirty);ml.dirty=null;if(!rc)return;const P=p3pull(),sel=selU(ml.o);
  for(const it of ml.items)scissorDo(rc,()=>ml.sp.pull(P,it.T,Object.assign({uMode:{int:1},uNormalMap:{int:doc.map==='normal'?1:0},uCopy:it.orig.tex,uDisp2:ml.D.tex,uTol:.12,uK:1,uStroke:dummy,uDelta:[0,0],uCharge:0,uColor:[0,0,0],uLockAlpha:{int:0}},sel)));
  if(!ml.L.maskOf&&!ml.L.quick)ml.L.lookVer=(ml.L.lookVer||0)+1;requestRender(true);}
/* the hold modes (pinch, bloat, twirl) keep working while the button is down */
function meshLiqLoop(ml){const m=v3.mstroke;if(!m||m.ml!==ml)return;const now=performance.now(),dt=Math.min(.1,(now-ml.t)/1000);ml.t=now;
  if(liq.mode!=='push')meshLiqDab(ml,ml.pos[0],ml.pos[1],0,0,dt*60);meshLiqFlush(ml);requestAnimationFrame(()=>meshLiqLoop(ml));}
function meshLiqMove(hit,e){const m=v3.mstroke,ml=m&&m.ml;if(!ml)return;const [x,y]=meshPt(hit,e),[lx,ly]=ml.last,len=Math.hypot(x-lx,y-ly),step=Math.max(2,liq.size*ml.scale*.12),n=Math.max(1,Math.ceil(len/step));
  for(let i=1;i<=n;i++)meshLiqDab(ml,lx+(x-lx)*i/n,ly+(y-ly)*i/n,(x-lx)/n,(y-ly)/n,liq.mode==='push'?1:.6/n*Math.min(n,4));
  ml.last=[x,y];ml.pos=[x,y];meshLiqFlush(ml);}
function meshLiqUp(){const m=v3.mstroke,ml=m&&m.ml;v3.mstroke=null;if(!ml)return;meshLiqFlush(ml);
  try{const rc=ml.bb&&ml.dabs?meshPullRect(ml.sp,ml.bb):null;
    if(rc){const [x,y,w,h]=rc,P=ml.items[0],before=captureRegion(P.orig,x,y,w,h),after=captureRegion(P.T,x,y,w,h),
      parts=ml.items.slice(1).map(it=>({k:it.k,before:captureRegion(it.orig,x,y,w,h),after:captureRegion(it.T,x,y,w,h)})),rec=regionRecord(ml.L,before,after,x,y,w,h,'Liquify');pushUndo(parts.length?withMapParts(rec,ml.L,parts,x,y):rec);}}
  finally{for(const it of ml.items)release(it.orig);disposeTarget(ml.D);disposeTarget(ml.tmp);}
  changed(ml.L.maskOf||ml.L);scheduleThumb(ml.L.maskOf||ml.L);refreshCursor();}
