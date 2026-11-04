/* ================= Warp projection (0.93.3, Kenn: like Substance Painter) =================
   A planar projection whose picture is bent by a grid of points: move the points and the picture follows, so it can be fitted around dents, folds and curved parts.
   xf.warp = {n:[rows,columns], pts:[[x,y,z],…]} in the projection's own space (the frame is -1..1 across). The surface through the points is a smooth cubic patch: each point has a tangent along the columns (w.tu) and along the rows (w.tv); until you drag a handle they are the Catmull-Rom ones, so the surface looks as it always did.
   For the shader the patch is turned into a lookup picture (where on the patch is each spot of the frame), built here on the CPU from the patch drawn as small quads. */
const wpjUI={edit:false,sel:[],drag:null};
const WPJ_N=384,WPJ_R=1.6;/* lookup size, and how far past the frame (in frame units) it reaches */
function wpjDefault(rows,cols){const pts=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)pts.push([-1+2*c/(cols-1),1-2*r/(rows-1),0]);return {n:[rows,cols],pts,moved:false};}
const wpjCR=(a,b,c,d,t)=>a.map((_,k)=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t));
/* a point of the surface: u across (0..1), v down (0..1). Each cell is a Hermite patch from its four corner points and their tangents. */
const wpjClamp=(w,r,c)=>Math.max(0,Math.min(w.n[0]-1,r))*w.n[1]+Math.max(0,Math.min(w.n[1]-1,c));
function wpjAuto(w,r,c,k){const P=(a,b)=>w.pts[wpjClamp(w,a,b)];const A=k==='u'?P(r,c-1):P(r-1,c),B=k==='u'?P(r,c+1):P(r+1,c);return [0,1,2].map(i=>(B[i]-A[i])/2);}
function wpjTan(w,r,c,k){const arr=k==='u'?w.tu:w.tv,t=arr&&arr[r*w.n[1]+c];return t||wpjAuto(w,r,c,k);}
const wpjH=t=>[2*t*t*t-3*t*t+1,-2*t*t*t+3*t*t,t*t*t-2*t*t+t,t*t*t-t*t];/* the two point weights, then the two tangent weights */
function wpjEval(w,u,v){const [R,C]=w.n,su=Math.min(C-1-1e-6,Math.max(0,u*(C-1))),sv=Math.min(R-1-1e-6,Math.max(0,v*(R-1))),ci=Math.floor(su),ri=Math.floor(sv),hu=wpjH(su-ci),hv=wpjH(sv-ri),out=[0,0,0];
  for(let b=0;b<2;b++)for(let a=0;a<2;a++){const r=ri+b,c=ci+a,P=w.pts[r*C+c],Tu=wpjTan(w,r,c,'u'),Tv=wpjTan(w,r,c,'v'),wp=hu[a]*hv[b],wu=hu[2+a]*hv[b],wv=hu[a]*hv[2+b];
    for(let k=0;k<3;k++)out[k]+=wp*P[k]+wu*Tu[k]+wv*Tv[k];}return out;}
/* the lookup picture: for each spot (x,y) of the frame, the (u,v) of the patch there; cached on the transform */
function wpjTex(xf){const w=xf&&xf.warp;if(!w||!w.pts||w.pts.length!==w.n[0]*w.n[1])return null;const key=JSON.stringify([w.n,w.pts,w.tu,w.tv]);
  if(xf._wt&&xf._wt.key===key)return xf._wt.tex;
  const N=WPJ_N,data=new Float32Array(N*N*4),M=48,V=[];
  for(let j=0;j<=M;j++)for(let i=0;i<=M;i++){const u=i/M,v=j/M,p=wpjEval(w,u,v);V.push([(p[0]+WPJ_R)/(2*WPJ_R)*N,(p[1]+WPJ_R)/(2*WPJ_R)*N,u,v]);}
  const tri=(a,b,c)=>{const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(N-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(N-1,Math.ceil(Math.max(a[1],b[1],c[1]))),
      d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-9)return;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=x+.5,py=y+.5,l1=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/d,l2=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/d,l3=1-l1-l2;
      if(l1<-.001||l2<-.001||l3<-.001)continue;const o=(y*N+x)*4;data[o]=l1*a[2]+l2*b[2]+l3*c[2];data[o+1]=l1*a[3]+l2*b[3]+l3*c[3];data[o+2]=1;data[o+3]=1;}};
  for(let j=0;j<M;j++)for(let i=0;i<M;i++){const a=V[j*(M+1)+i],b=V[j*(M+1)+i+1],c=V[(j+1)*(M+1)+i],d=V[(j+1)*(M+1)+i+1];tri(a,b,c);tri(b,d,c);}
  let tex=xf._wt&&xf._wt.tex;if(!tex){tex=gl.createTexture();}
  gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,N,N,0,gl.RGBA,gl.FLOAT,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  Object.defineProperty(xf,'_wt',{value:{key,tex},writable:true,configurable:true,enumerable:false});return tex;}
function wpjUniforms(mode,xf,X){if(mode!=='warp')return {uWarp:dummy,uWarpD:[1,.5,WPJ_R,WPJ_N]};
  const tex=wpjTex(xf);return {uWarp:tex||dummy,uWarpD:[X.depth>0?X.depth:1,X.dh==null?.5:X.dh,WPJ_R,tex?WPJ_N:0]};}
/* local (frame) space <-> world, the same transform the shader uses */
function wpjFrame(xf){const X=pxfNorm(xf),{c,S}=pxfModel(),k=S/2,R=pxfRot(X.r),o=[c[0]+X.t[0],c[1]+X.t[1],c[2]+X.t[2]],d=[0,1,2].map(i=>(X.s[i]||1)*k);return {R,o,d};}
function wpjToWorld(xf,L){const {R,o,d}=wpjFrame(xf);return [0,1,2].map(j=>o[j]+R[j][0]*L[0]*d[0]+R[j][1]*L[1]*d[1]+R[j][2]*L[2]*d[2]);}
function wpjToLocal(xf,P){const {R,o,d}=wpjFrame(xf);return [0,1,2].map(i=>((R[0][i]*(P[0]-o[0])+R[1][i]*(P[1]-o[1])+R[2][i]*(P[2]-o[2]))/d[i]));}
/* ---- editing: split, reset, move ---- */
function wpjSplit(w,kind){const [R,C]=w.n,P=(r,c)=>w.pts[r*C+c];
  const addCol=()=>{/* a new column in the middle of the widest gap */let best=0,bd=-1;for(let c=0;c<C-1;c++){const d=Math.abs(P(0,c+1)[0]-P(0,c)[0])+Math.abs(P(R-1,c+1)[0]-P(R-1,c)[0]);if(d>bd){bd=d;best=c;}}
    const out=[];for(let r=0;r<R;r++){for(let c=0;c<C;c++){out.push(P(r,c));if(c===best){const u=(c+.5)/(C-1),v=r/(R-1),p=wpjEval(w,u,v);out.push(p);}}}return {n:[R,C+1],pts:out,moved:true};};
  const addRow=()=>{let best=0,bd=-1;for(let r=0;r<R-1;r++){const d=Math.abs(P(r+1,0)[1]-P(r,0)[1])+Math.abs(P(r+1,C-1)[1]-P(r,C-1)[1]);if(d>bd){bd=d;best=r;}}
    const out=[];for(let r=0;r<R;r++){for(let c=0;c<C;c++)out.push(P(r,c));if(r===best)for(let c=0;c<C;c++){const u=c/(C-1),v=(r+.5)/(R-1);out.push(wpjEval(w,u,v));}}return {n:[R+1,C],pts:out,moved:true};};
  if(kind==='h')return addRow();if(kind==='v')return addCol();const a=addCol();return wpjSplit(a,'h');}
function wpjPanel(box,get,edit){const X=get(),w=X.warp;if(!w){edit(x=>{if(!x.warp)x.warp=wpjDefault(3,3);});return;}
  const num=(id,label,val,set)=>{const i=el('input',{type:'number',id,min:2,max:12,step:1,value:String(val),'aria-label':label,title:label+(w.moved?' (reset the vertices to change this)':''),disabled:!!w.moved});i.addEventListener('change',()=>{const v=Math.max(2,Math.min(12,Math.round(+i.value)));edit(x=>set(x,v));buildBrushPanel();if(typeof renderMatEd==='function')renderMatEd(true);});return i;};
  box.append(el('div',{class:'sub',text:'Warp'}),el('div',{class:'pxfrow'},el('span',{class:'pxfl',text:'Rows'}),num('warp_rows','Rows',w.n[0],(x,v)=>{x.warp=wpjDefault(v,x.warp.n[1]);}),el('span',{class:'pxfl',text:'Columns'}),num('warp_cols','Columns',w.n[1],(x,v)=>{x.warp=wpjDefault(x.warp.n[0],v);})),
    el('div',{class:'chips'},chk('warp_edit','Edit vertices',wpjUI.edit,v=>{wpjUI.edit=v;wpjUI.sel=[];requestRender(true);if(typeof pgzDraw==='function')pgzDraw();wpjDraw();})),
    el('div',{class:'chips'},el('button',{class:'btn sm',id:'warp_splitx',text:'Split crosswise',onclick:()=>{edit(x=>{x.warp=wpjSplit(x.warp,'x');});wpjUI.sel=[];renderMatEd(true);}}),el('button',{class:'btn sm',id:'warp_splith',text:'Split horizontally',onclick:()=>{edit(x=>{x.warp=wpjSplit(x.warp,'h');});wpjUI.sel=[];renderMatEd(true);}}),el('button',{class:'btn sm',id:'warp_splitv',text:'Split vertically',onclick:()=>{edit(x=>{x.warp=wpjSplit(x.warp,'v');});wpjUI.sel=[];renderMatEd(true);}})),
    makeSlider({id:'warp_depth',label:'Projection depth',min:.1,max:4,step:.05,value:X.depth>0?X.depth:1,fmt:v=>v.toFixed(2),onInput:v=>edit(x=>{x.depth=v;})}).el,makeSlider({id:'warp_dh',label:'Depth culling hardness',min:0,max:1,step:.01,value:X.dh==null?.5:X.dh,fmt:pct,onInput:v=>edit(x=>{x.dh=v;})}).el,
    el('div',{class:'chips'},el('button',{class:'btn sm',id:'warp_resetv',text:'Reset all vertices',onclick:()=>{edit(x=>{x.warp=wpjDefault(x.warp.n[0],x.warp.n[1]);});wpjUI.sel=[];renderMatEd(true);}}),
      el('span',{class:'note',text:'Turn on Edit vertices, then drag a point over the model: it sticks to the surface. Drag a box round points to select them; Shift adds. With one point selected, drag its round handles to bend the surface there.'})));}
/* ---- the viewport: the grid and its points ---- */
function wpjTarget(){const T=typeof pxfTarget==='function'?pxfTarget():null;return T&&T.mode==='warp'&&T.xf&&T.xf.warp?T:null;}
const wpjActive=()=>{const T=wpjUI.edit?wpjTarget():null;return T&&(v3.on||ui.mode==='p3d')&&v3.mesh?T:null;};
function wpjDraw(){const hit=document.getElementById('v3Hit');if(!hit)return;let c=hit.parentNode.querySelector('.warp-overlay');if(!c){c=el('canvas',{class:'path-overlay warp-overlay','aria-hidden':'true'});hit.parentNode.append(c);}
  const T=wpjActive();c.hidden=!T;if(!T)return;const r=hit.getBoundingClientRect(),pr=hit.parentNode.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),W=Math.round(r.width*d),H=Math.round(r.height*d);if(c.width!==W||c.height!==H){c.width=W;c.height=H;}
  c.style.left=(r.left-pr.left)+'px';c.style.top=(r.top-pr.top)+'px';c.style.width=r.width+'px';c.style.height=r.height+'px';const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,r.width,r.height);
  const xf=T.xf,w=xf.warp,[R,C]=w.n,proj=L=>pathProject(wpjToWorld(xf,L),'3d',hit);x.lineWidth=1.3;x.strokeStyle='#ffc763';
  const line=(f,steps)=>{x.beginPath();let st=true;for(let i=0;i<=steps;i++){const q=proj(f(i/steps));if(!q){st=true;continue;}st?x.moveTo(...q):x.lineTo(...q);st=false;}x.stroke();};
  for(let rr=0;rr<R;rr++)line(t=>wpjEval(w,t,rr/(R-1)),28);for(let cc=0;cc<C;cc++)line(t=>wpjEval(w,cc/(C-1),t),28);
  w.pts.forEach((p,i)=>{const q=proj(p);if(!q)return;x.fillStyle=wpjUI.sel.includes(i)?'#ffc763':'#202429';x.fillRect(q[0]-5,q[1]-5,10,10);x.strokeRect(q[0]-5,q[1]-5,10,10);});
  /* one point selected: its two tangent handles (drag one to bend the surface there) */
  for(const H of wpjHandles(T,hit)){const q=proj(w.pts[H.i]);x.strokeStyle='#ffc763';x.beginPath();x.moveTo(...q);x.lineTo(...H.at);x.stroke();x.fillStyle=H.k==='u'?'#ffc763':'#63d2ff';x.beginPath();x.arc(H.at[0],H.at[1],4.5,0,7);x.fill();x.strokeStyle='#202429';x.stroke();}
  const B=wpjUI.box;if(B){x.save();x.setLineDash([4,3]);x.strokeStyle='#fff';x.fillStyle='rgba(255,199,99,.12)';x.fillRect(Math.min(B.x0,B.x1),Math.min(B.y0,B.y1),Math.abs(B.x1-B.x0),Math.abs(B.y1-B.y0));x.strokeRect(Math.min(B.x0,B.x1),Math.min(B.y0,B.y1),Math.abs(B.x1-B.x0),Math.abs(B.y1-B.y0));x.restore();}}
/* the tangent handles of the single selected point: a third of the tangent away along each direction (both ways) */
function wpjHandles(T,hit){const out=[];if(!T||wpjUI.sel.length!==1)return out;const w=T.xf.warp,i=wpjUI.sel[0],C=w.n[1],r=Math.floor(i/C),c=i%C;
  for(const k of ['u','v']){const t=wpjTan(w,r,c,k);for(const sg of [1,-1]){const at=pathProject(wpjToWorld(T.xf,w.pts[i].map((v,m)=>v+sg*t[m]/3)),'3d',hit);if(at)out.push({i,k,sg,at});}}return out;}
function wpjHitHandle(hit,e){const T=wpjActive();if(!T)return null;const r=hit.getBoundingClientRect(),m=[e.clientX-r.left,e.clientY-r.top];let best=null,bd=9;for(const H of wpjHandles(T,hit)){const d=Math.hypot(H.at[0]-m[0],H.at[1]-m[1]);if(d<bd){bd=d;best=H;}}return best;}
function wpjHit(hit,e){const T=wpjActive();if(!T)return -1;const r=hit.getBoundingClientRect(),m=[e.clientX-r.left,e.clientY-r.top];let best=-1,bd=11;T.xf.warp.pts.forEach((p,i)=>{const q=pathProject(wpjToWorld(T.xf,p),'3d',hit);if(!q)return;const d=Math.hypot(q[0]-m[0],q[1]-m[1]);if(d<bd){bd=d;best=i;}});return best;}
document.addEventListener('pointerdown',e=>{if(e.button!==0||e.altKey||!e.target||e.target.id!=='v3Hit'||!wpjActive())return;const hit=e.target,T=wpjTarget(),H=wpjHitHandle(hit,e);
  if(H){e.preventDefault();e.stopImmediatePropagation();wpjUI.drag={id:e.pointerId,hit,handle:H,moved:false};try{hit.setPointerCapture(e.pointerId);}catch(er){}return;}
  const i=wpjHit(hit,e);
  if(i<0){/* empty space: drag a box round the points to select them (Shift adds) */e.preventDefault();e.stopImmediatePropagation();const r=hit.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;wpjUI.box={id:e.pointerId,hit,x0:x,y0:y,x1:x,y1:y,add:e.shiftKey,base:wpjUI.sel.slice()};try{hit.setPointerCapture(e.pointerId);}catch(er){}return;}
  e.preventDefault();e.stopImmediatePropagation();wpjUI.sel=e.shiftKey?(wpjUI.sel.includes(i)?wpjUI.sel.filter(k=>k!==i):[...wpjUI.sel,i]):(wpjUI.sel.includes(i)?wpjUI.sel:[i]);
  wpjUI.drag={id:e.pointerId,hit,i,start:T.xf.warp.pts.map(p=>p.slice()),moved:false};try{hit.setPointerCapture(e.pointerId);}catch(er){}wpjDraw();},true);
window.addEventListener('pointermove',e=>{const B=wpjUI.box;if(B&&e.pointerId===B.id){const r=B.hit.getBoundingClientRect();B.x1=e.clientX-r.left;B.y1=e.clientY-r.top;wpjDraw();e.preventDefault();e.stopImmediatePropagation();return;}
  const D=wpjUI.drag;if(!D||e.pointerId!==D.id)return;const T=wpjTarget();if(!T){wpjUI.drag=null;return;}const pk=v3PickAt(D.hit,e);if(!pk)return;
  if(D.handle){/* a tangent handle: the tangent is three times the way from the point to the handle */const {i,k,sg}=D.handle,L=wpjToLocal(T.xf,pk.pos);D.moved=true;
    T.edit(x=>{const w=x.warp,n=w.pts.length,P=w.pts[i];w.moved=true;if(!w.tu)w.tu=new Array(n).fill(null);if(!w.tv)w.tv=new Array(n).fill(null);(k==='u'?w.tu:w.tv)[i]=[0,1,2].map(m=>sg*(L[m]-P[m])*3);});wpjDraw();e.preventDefault();e.stopImmediatePropagation();return;}
  const base=D.start[D.i],L=wpjToLocal(T.xf,pk.pos),delta=[L[0]-base[0],L[1]-base[1],L[2]-base[2]];D.moved=true;
  T.edit(x=>{const w=x.warp;w.moved=true;for(const k of wpjUI.sel)if(D.start[k])w.pts[k]=[D.start[k][0]+delta[0],D.start[k][1]+delta[1],D.start[k][2]+delta[2]];});wpjDraw();e.preventDefault();e.stopImmediatePropagation();},true);
window.addEventListener('pointerup',e=>{const B=wpjUI.box;if(B&&e.pointerId===B.id){wpjUI.box=null;const T=wpjTarget();if(T){const small=Math.hypot(B.x1-B.x0,B.y1-B.y0)<4,x0=Math.min(B.x0,B.x1),x1=Math.max(B.x0,B.x1),y0=Math.min(B.y0,B.y1),y1=Math.max(B.y0,B.y1),inBox=[];
      if(!small)T.xf.warp.pts.forEach((p,i)=>{const q=pathProject(wpjToWorld(T.xf,p),'3d',B.hit);if(q&&q[0]>=x0&&q[0]<=x1&&q[1]>=y0&&q[1]<=y1)inBox.push(i);});
      wpjUI.sel=small?(B.add?B.base:[]):(B.add?[...new Set([...B.base,...inBox])]:inBox);}wpjDraw();return;}
  const D=wpjUI.drag;if(!D||e.pointerId!==D.id)return;wpjUI.drag=null;wpjDraw();},true);
{const d3=draw3D;draw3D=function(){d3();wpjDraw();};}
