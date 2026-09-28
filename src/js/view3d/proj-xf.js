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
function pxfFields(get,edit,mode,onReset){const X=get(),is3=pxfIs3D(mode),box=el('div',{class:'pxf'});
  const num=(id,label,val,step,set)=>{const i=el('input',{type:'number',id,step:String(step),value:String(Math.round(val*1000)/1000),'aria-label':label,title:label});
    i.addEventListener('change',()=>{const v=parseFloat(i.value);if(!isFinite(v))return;edit(x=>set(x,v));});return i;};
  const row=(label,...ins)=>el('div',{class:'pxfrow'},el('span',{class:'pxfl',text:label}),...ins);
  if(is3){box.append(row('Offset',...[0,1,2].map(i=>num('pxf_t'+i,'Offset '+'XYZ'[i],X.t[i],.01,(x,v)=>{x.t[i]=v;}))),
    row('Rotation',...[0,1,2].map(i=>num('pxf_r'+i,'Rotation '+'XYZ'[i],X.r[i],1,(x,v)=>{x.r[i]=v;}))),
    row('Scale',...[0,1,2].map(i=>num('pxf_s'+i,'Scale '+'XYZ'[i],X.s[i],.05,(x,v)=>{x.s[i]=Math.max(.001,v);}))));}
  else box.append(row('Offset',num('pxf_t0','Offset U',X.t[0],.01,(x,v)=>{x.t[0]=v;}),num('pxf_t1','Offset V',X.t[1],.01,(x,v)=>{x.t[1]=v;})),
    row('Turn',num('pxf_r2','Turn',X.r[2],1,(x,v)=>{x.r[2]=v;})),
    row('Scale',num('pxf_s0','Scale U',X.s[0],.05,(x,v)=>{x.s[0]=Math.max(.001,v);}),num('pxf_s1','Scale V',X.s[1],.05,(x,v)=>{x.s[1]=Math.max(.001,v);})));
  box.append(el('div',{class:'chips'},el('button',{class:'btn sm',id:'pxfReset',text:'Reset',onclick:()=>{edit(x=>Object.assign(x,pxfDef()));if(onReset)onReset();}}),
    el('span',{class:'note',text:is3?'Drag the gizmo on the model: arrows move, rings turn, boxes scale.':'Drag the frame on the flat canvas: inside moves, corners scale, the round handle turns.'})));
  return box;}
/* after a drag, the fields show the new numbers */
function pxfSyncFields(){const T=pxfTarget();if(!T)return;const X=T.xf;for(let i=0;i<3;i++)for(const [k,a] of [['t',X.t],['r',X.r],['s',X.s]]){const e=document.getElementById('pxf_'+k+i);if(e&&document.activeElement!==e)e.value=String(Math.round(a[i]*1000)/1000);}}
