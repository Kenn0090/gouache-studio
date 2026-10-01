/* ================= Projections and their transforms (0.23.1) =================
   Pictures and patterns laid over the model can be projected four ways: UV (follow the model's UVs), Triplanar
   (from three sides, blended), Planar (straight from one direction, like a slide projector) and Spherical (wrapped
   around from a centre). Each has a transform, xf = {t:[x,y,z], r:[x,y,z] degrees, s:[x,y,z]}: offset, rotation and
   scale. For UV only t[0..1], r[2] and s[0..1] are used (in texture units). The 3D ones get a gizmo in the viewport
   (proj-gizmo.js); UV gets handles on the flat canvas. Noise and generator patterns use UV or World (3D). */
const PXF_MODES=[['uv','UV'],['tri','Triplanar'],['planar','Planar'],['sphere','Spherical']];
const PXF_IX={uv:0,tri:1,planar:2,sphere:3,world:1};
const pxfIs3D=m=>m==='tri'||m==='planar'||m==='sphere'||m==='world';
const pxfDef=()=>({t:[0,0,0],r:[0,0,0],s:[1,1,1]});
function pxfOf(o){if(!o.xf)o.xf=pxfDef();return o.xf;}
const pxfIsId=x=>!x||(x.t.every(v=>!v)&&x.r.every(v=>!v)&&x.s.every(v=>v===1));
/* rotation from angles in degrees, R = Rz·Ry·Rx, as rows */
function pxfRot(r){const [a,b,c]=r.map(v=>v*Math.PI/180),ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cc=Math.cos(c),sc=Math.sin(c);
  return [[cc*cb,cc*sb*sa-sc*ca,cc*sb*ca+sc*sa],[sc*cb,sc*sb*sa+cc*ca,sc*sb*ca-cc*sa],[-sb,cb*sa,cb*ca]];}
/* …and back (for the gizmo's rings) */
function pxfEuler(R){const sb=-clamp(R[2][0],-1,1),b=Math.asin(sb);let a,c;
  if(Math.abs(sb)<.9999){a=Math.atan2(R[2][1],R[2][2]);c=Math.atan2(R[1][0],R[0][0]);}else{a=Math.atan2(-R[1][2],R[1][1]);c=0;}
  const d=v=>Math.round(v*180/Math.PI*100)/100;return [d(a),d(b),d(c)];}
function pxfMul3(A,B){const o=[[0,0,0],[0,0,0],[0,0,0]];for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)o[i][j]+=A[i][k]*B[k][j];return o;}
function pxfAxisRot(w,ang){const [x,y,z]=norm3(w),c=Math.cos(ang),s=Math.sin(ang),t=1-c;
  return [[t*x*x+c,t*x*y-s*z,t*x*z+s*y],[t*x*y+s*z,t*y*y+c,t*y*z-s*x],[t*x*z-s*y,t*y*z+s*x,t*z*z+c]];}
/* the model's box: its centre and its largest side */
function pxfModel(){const m=v3.mesh;if(!m)return {c:[0,0,0],S:1};if(!m._bb){const p=m.pos,mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<p.length;i+=3)for(let j=0;j<3;j++){mn[j]=Math.min(mn[j],p[i+j]);mx[j]=Math.max(mx[j],p[i+j]);}m._bb={mn,sz:mx.map((v,j)=>v-mn[j])};}
  const b=m._bb;return {c:b.mn.map((v,j)=>v+b.sz[j]/2),S:Math.max(1e-4,...b.sz)};}
/* the size one unit of scale stands for: triplanar tiles in model units (as before), planar and spherical cover
   the model at scale 1, patterns (noise) are measured against the model's size */
const pxfUnit=(mode,S)=>mode==='tri'?1:mode==='world'?S:S/2;
/* where the projection sits in the world (for the gizmo) */
function pxfCenter(xf){const {c}=pxfModel();return [c[0]+xf.t[0],c[1]+xf.t[1],c[2]+xf.t[2]];}
/* uniforms for the shaders: uProj, uInv (world → projection space), uUvM (texture coordinates → projected ones) */
const pxfNorm=x=>{const d=pxfDef();if(!x)return d;return {t:[0,1,2].map(i=>+((x.t||[])[i]||0)),r:[0,1,2].map(i=>+((x.r||[])[i]||0)),s:[0,1,2].map(i=>{const v=+((x.s||[])[i]);return isFinite(v)&&v?v:1;})};};
function pxfUniforms(mode,xf){const X=pxfNorm(xf),{c,S}=pxfModel(),k=pxfUnit(mode,S),R=pxfRot(X.r);
  const o=[c[0]+X.t[0],c[1]+X.t[1],c[2]+X.t[2]],d=[0,1,2].map(i=>(X.s[i]||1)*k),inv=new Float32Array(16);
  for(let i=0;i<3;i++){let tr=0;for(let j=0;j<3;j++){const v=R[j][i]/d[i];inv[j*4+i]=v;tr-=v*o[j];}inv[12+i]=tr;}inv[15]=1;
  /* UV: offset, turn and scale around the middle of the texture */
  const a=(X.r[2]||0)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),su=X.s[0]||1,sv=X.s[1]||1,A=[[ca/su,sa/su],[-sa/sv,ca/sv]];
  const cx=.5+X.t[0],cy=.5+X.t[1],b=[.5-(A[0][0]*cx+A[0][1]*cy),.5-(A[1][0]*cx+A[1][1]*cy)];
  const uvm=new Float32Array([A[0][0],A[1][0],0,A[0][1],A[1][1],0,b[0],b[1],1]);
  return {uProj:{int:PXF_IX[mode]||0},uInv:{m4:inv},uUvM:{m3:uvm}};}
/* the four corners of the UV frame, in texture units (0..1), for the 2D handles */
function pxfUvCorners(xf){const X=pxfNorm(xf),a=(X.r[2]||0)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),su=X.s[0]||1,sv=X.s[1]||1;
  return [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y])=>{const px=x*su,py=y*sv;return [.5+X.t[0]+ca*px-sa*py,.5+X.t[1]+sa*px+ca*py];});}

/* ---- what is being transformed: the selected mask row with a picture or pattern, else a material layer ---- */
function pxfTarget(){const L=doc.active;if(!L||ui.mode==='anim')return null;
  const liveM=typeof lm!=='undefined'&&lm.on&&ui.msSel&&ui.msSel.L===lm.M?lm.M:null;
  if(ui.msSel&&(ui.msSel.L===L||liveM)){const r=typeof msRowOf==='function'?msRowOf(ui.msSel):null,owner=ui.msSel.L;
    if(r&&(r.kind==='image'||r.kind==='noise'||r.kind==='gen'))return {kind:'row',L:owner,r,title:msRowTitle(r),mode:pxfRowMode(r),get xf(){return pxfOf(r.p);},
      edit(fn){msEdit(owner,r,x=>fn(pxfOf(x.p)));}};
    return null;}
  if(isLayer(L)&&L.fill&&L.fill.maps&&Object.values(L.fill.maps).some(s=>s&&s.on&&s.src==='image'))return {kind:'fill',L,title:L.name,mode:L.fill.proj||'uv',get xf(){return pxfOf(L.fill);},
    edit(fn){matEdBegin(L);fn(pxfOf(L.fill));fillRender(L);clearTimeout(matEd.timer);matEd.timer=setTimeout(matEdCommit,700);}};
  return null;}
/* a row's projection: pictures choose any of the four; patterns are UV or World (3D) */
function pxfRowMode(r){const p=r.p||{};if(r.kind==='image')return p.proj||(p.tri?'tri':'uv');if(r.kind==='noise')return p.proj||(p.tri===false?'uv':'world');return p.proj||'world';}

/* ---- the transform fields in Properties ---- */
/* (0.33, Kenn) lock X and Y (and Z) together like Substance Painter: changing one scale number changes the others by the same factor */
function pxfLocked(){try{return localStorage.getItem('gs.pxfLock')!=='0';}catch(e){return true;}}
function pxfSetScale(x,i,v,n,tiling){v=Math.max(.001,v);const nv=tiling?1/v:v,old=x.s[i]||1,f=pxfLocked()?nv/old:1;
  /* (0.37.1, Kenn) with the chain on, the number typed goes into every axis */
  if(!pxfLocked()){x.s[i]=Math.max(.001,nv);return;}for(let k=0;k<n;k++)x.s[k]=Math.max(.001,nv);}
/* (0.33, Kenn) material and pattern scale is shown as Tiling, like Substance Painter: a bigger number repeats more. It is stored as the size (1 / tiling), so older files look the same. Decals keep Size. */
const pxfShow=(v,tiling)=>tiling?1/(v||1):v;
function pxfLockBtn(){const b=el('button',{class:'btn sm pxflock',id:'pxfLock','aria-label':'Keep the scale proportions'});
  const paint=()=>{const on=pxfLocked();b.textContent=on?'🔗':'⛓';b.classList.toggle('on',on);b.title=on?'Locked: the scale numbers move together. Click to unlock.':'Unlocked: each scale number is separate. Click to lock.';};
  paint();b.addEventListener('click',()=>{try{localStorage.setItem('gs.pxfLock',pxfLocked()?'0':'1');}catch(e){}paint();});return b;}
function pxfFields(get,edit,mode,onReset,size){const til=!size,X=get(),is3=pxfIs3D(mode),box=el('div',{class:'pxf'});
  const num=(id,label,val,step,set)=>{const i=el('input',{type:'number',id,step:String(step),value:String(Math.round(val*1000)/1000),'aria-label':label,title:label});
    i.addEventListener('change',()=>{const v=parseFloat(i.value);if(!isFinite(v))return;edit(x=>set(x,v));const Y=get();for(let k=0;k<(is3?3:2);k++){const e=box.querySelector('#pxf_s'+k);if(e)e.value=String(Math.round(pxfShow(Y.s[k],til)*1000)/1000);}const sl=box.querySelector('#pxf_tslide');if(sl)sl.value=String(Math.log10(pxfShow(Y.s[0],true)));});return i;};
  const row=(label,...ins)=>el('div',{class:'pxfrow'},el('span',{class:'pxfl',text:label}),...ins);
  const rowL=(label,...ins)=>el('div',{class:'pxfrow'},el('span',{class:'pxfl'},label+' ',pxfLockBtn()),...ins);
  if(is3){box.append(row('Offset',...[0,1,2].map(i=>num('pxf_t'+i,'Offset '+'XYZ'[i],X.t[i],.01,(x,v)=>{x.t[i]=v;}))),
    row('Rotation',...[0,1,2].map(i=>num('pxf_r'+i,'Rotation '+'XYZ'[i],X.r[i],1,(x,v)=>{x.r[i]=v;}))),
    rowL(til?'Tiling':'Size',...[0,1,2].map(i=>num('pxf_s'+i,(til?'Tiling ':'Size ')+'XYZ'[i],pxfShow(X.s[i],til),til?.1:.05,(x,v)=>pxfSetScale(x,i,v,3,til)))));}
  else box.append(row('Offset',num('pxf_t0','Offset U',X.t[0],.01,(x,v)=>{x.t[0]=v;}),num('pxf_t1','Offset V',X.t[1],.01,(x,v)=>{x.t[1]=v;})),
    row('Turn',num('pxf_r2','Turn',X.r[2],1,(x,v)=>{x.r[2]=v;})),
    rowL(til?'Tiling':'Size',num('pxf_s0',(til?'Tiling':'Size')+' U',pxfShow(X.s[0],til),til?.1:.05,(x,v)=>pxfSetScale(x,0,v,2,til)),num('pxf_s1',(til?'Tiling':'Size')+' V',pxfShow(X.s[1],til),til?.1:.05,(x,v)=>pxfSetScale(x,1,v,2,til))));
  /* (0.34, Kenn) a slider for the tiling: log scale from 0.1 to 1000 repeats; with the lock on it moves every axis */
  if(til){const cnt=is3?3:2,sl=el('input',{type:'range',id:'pxf_tslide',min:'-1',max:'3',step:'0.01',value:String(Math.log10(pxfShow(X.s[0],true))),'aria-label':'Tiling slider',title:'Tiling: drag to repeat the picture more or less'});
    sl.addEventListener('input',()=>{const v=Math.pow(10,parseFloat(sl.value));edit(x=>pxfSetScale(x,0,v,cnt,true));const Y=get();for(let i=0;i<cnt;i++){const e=document.getElementById('pxf_s'+i);if(e)e.value=String(Math.round(1000/(Y.s[i]||1))/1000);}});
    [...box.querySelectorAll('.pxfrow')].pop()?.after(el('div',{class:'pxfrow tsl'},sl));}
  for(const i of box.querySelectorAll('input[id^=pxf_s]'))i.dataset.til=til?'1':'0';
  if(!is3&&ui.mode==='p3d')box.append(el('div',{class:'chips'},chk('pxf2Show','Show the frame on the flat texture',pxf2.show,v=>{pxf2.show=v;if(typeof drawXfOverlay==='function')drawXfOverlay();requestRender(true);})));
  box.append(el('div',{class:'chips'},el('button',{class:'btn sm',id:'pxfReset',text:'Reset',onclick:()=>{edit(x=>Object.assign(x,pxfDef()));if(onReset)onReset();}}),
    el('span',{class:'note',text:is3?'Drag the gizmo on the model: arrows move, rings turn, boxes scale.':'On the flat canvas: drag a corner to scale (Shift keeps proportions), the round handle to turn, and inside with the Move tool (or Ctrl) to move.'})));
  return box;}
/* after a drag, the fields show the new numbers */
function pxfSyncFields(){const T=pxfTarget();if(!T)return;const X=T.xf;for(let i=0;i<3;i++)for(const [k,a] of [['t',X.t],['r',X.r],['s',X.s]]){const e=document.getElementById('pxf_'+k+i);if(e&&document.activeElement!==e){const v=k==='s'&&e.dataset.til==='1'?1/(a[i]||1):a[i];e.value=String(Math.round(v*1000)/1000);}}const sl=document.getElementById('pxf_tslide');if(sl&&document.activeElement!==sl){const e0=document.getElementById('pxf_s0');if(e0&&e0.dataset.til==='1')sl.value=String(Math.log10(Math.max(.1,1/(X.s[0]||1))));}}

/* ---- UV projections: a frame with handles on the flat canvas (like Free Transform) ----
   Drag inside to move, a corner to scale (Shift keeps the proportions), the round handle to turn. */
const pxf2={drag:null,show:false};
function pxf2Active(){const T=pxfTarget();return T&&(ui.mode!=='p3d'||pxf2.show)&&!pxfIs3D(T.mode)&&!xf&&!(typeof crop!=='undefined'&&crop)?T:null;}
function pxf2Geom(T){const X=pxfNorm(T.xf),C=pxfUvCorners(X).map(([u,v])=>toScreen(u*doc.w,v*doc.h)),mid=[(C[0][0]+C[1][0])/2,(C[0][1]+C[1][1])/2],cen=toScreen((.5+X.t[0])*doc.w,(.5+X.t[1])*doc.h);
  const ux=mid[0]-cen[0],uy=mid[1]-cen[1],l=Math.hypot(ux,uy)||1,rot=[mid[0]+ux/l*26,mid[1]+uy/l*26];return {X,C,cen,rot,mid};}
function pxfOverlay2D(){const T=pxf2Active();if(!T)return '';const G=pxf2Geom(T),f=p=>p[0].toFixed(1)+' '+p[1].toFixed(1);
  let s='<path class="ln" d="M'+G.C.map(f).join('L')+'Z"/><path class="ln" d="M'+f(G.mid)+'L'+f(G.rot)+'"/>';
  for(const q of G.C)s+='<rect class="hs" x="'+(q[0]-5)+'" y="'+(q[1]-5)+'" width="10" height="10"/>';
  s+='<circle class="ge" cx="'+G.rot[0]+'" cy="'+G.rot[1]+'" r="6"/><circle class="hc" cx="'+G.cen[0]+'" cy="'+G.cen[1]+'" r="3"/>';return s;}
function pxf2Down(e){const T=pxf2Active();if(!T||e.button!==0||e.altKey)return false;const r=stage.getBoundingClientRect(),m=[e.clientX-r.left,e.clientY-r.top],G=pxf2Geom(T);
  const inQuad=p=>{let c=false;for(let i=0,j=3;i<4;j=i++){const a=G.C[i],b=G.C[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
  let h=null;if(Math.hypot(m[0]-G.rot[0],m[1]-G.rot[1])<9)h={k:'r'};else{const ci=G.C.findIndex(q=>Math.hypot(m[0]-q[0],m[1]-q[1])<9);if(ci>=0)h={k:'s',i:ci};else if(inQuad(m)&&(ui.tool==='move'||e.ctrlKey||e.metaKey||!MESH_TOOLS.includes(ui.tool)))h={k:'t'};}
  if(!h)return false;e.preventDefault();pxf2.drag={h,m0:m,G,X0:pxfNorm(T.xf),T};
  const mv=ev=>{const D=pxf2.drag;if(!D)return;const q=[ev.clientX-r.left,ev.clientY-r.top],X0=D.X0,z=view.zoom;let fn=null;
    if(D.h.k==='t'){const du=(q[0]-D.m0[0])/z/doc.w,dv=(q[1]-D.m0[1])/z/doc.h;fn=x=>{x.t[0]=X0.t[0]+du;x.t[1]=X0.t[1]+dv;};}
    else if(D.h.k==='r'){const c=D.G.cen,a0=Math.atan2(D.m0[1]-c[1],D.m0[0]-c[0]),a1=Math.atan2(q[1]-c[1],q[0]-c[0]);let d=(a1-a0)*180/Math.PI;if(ev.shiftKey)d=Math.round((X0.r[2]+d)/15)*15-X0.r[2];fn=x=>{x.r[2]=Math.round((X0.r[2]+d)*100)/100;};}
    else{/* the corner's distance from the centre, measured along the frame's own axes */const c=D.G.cen,a=(X0.r[2]||0)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),lx=(q[0]-c[0])/z/doc.w,ly=(q[1]-c[1])/z/doc.h;
      let su=Math.abs(ca*lx+sa*ly)*2,sv=Math.abs(-sa*lx+ca*ly)*2;if(ev.shiftKey){const k=Math.max(su/(X0.s[0]||1),sv/(X0.s[1]||1));su=(X0.s[0]||1)*k;sv=(X0.s[1]||1)*k;}fn=x=>{x.s[0]=Math.max(.01,su);x.s[1]=Math.max(.01,sv);};}
    D.T.edit(x=>{const n=pxfNorm(x);Object.assign(x,{t:n.t,r:n.r,s:n.s});fn(x);});pxfSyncFields();drawXfOverlay();requestRender(true);v3.dirty=true;};
  const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);pxf2.drag=null;drawXfOverlay();};
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);return true;}
