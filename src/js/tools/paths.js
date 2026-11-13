/* Editable Bézier paths. Each path owns a layer: a compact fill recipe and one coverage
   mask, rather than a full-size painted image for every material channel. */
const pathEdit={L:null,point:-1,drawing:false,drag:null,sel:[],selPath:null,pend:null,rect:null};
let pathPanelFor=null;
/* display settings of the path overlay, like Substance Painter's (kept on this computer) */
const pathDisp=Object.assign({handle:4,width:1.5,col:[1,.78,.39],colOff:[.44,.84,1],normals:false,tangents:true,direction:true},(()=>{try{return JSON.parse(localStorage.getItem('gs.pathDisp')||'{}');}catch(e){return {};}})());
const pathDispSave=()=>{try{localStorage.setItem('gs.pathDisp',JSON.stringify(pathDisp));}catch(e){}};
const pathCss=c=>'rgb('+c.map(v=>Math.round(v*255)).join(',')+')';
const pathMeshCaches=new WeakMap();
function pathCopy(p){return JSON.parse(JSON.stringify(p));}
/* (0.93.3, Kenn: like Substance Painter) a path layer holds several paths: L.paths, with L.path the one being edited (L.paths[L.pathCur]) */
let pathSeq=0;
function pathEnsure(L){if(!L||!L.path)return;if(!Array.isArray(L.paths)||!L.paths.length)L.paths=[L.path];let i=L.paths.indexOf(L.path);if(i<0){i=clamp(L.pathCur|0,0,L.paths.length-1);L.path=L.paths[i];}L.pathCur=i;L.paths.forEach((P,k)=>{if(!P.name)P.name='Path '+(k+1);if(!P.id)P.id=Date.now().toString(36)+(++pathSeq);});}
function pathSetCur(L,i){pathEnsure(L);L.pathCur=clamp(i,0,L.paths.length-1);L.path=L.paths[L.pathCur];delete L._pathPreview;L._pathSamples=null;}
function pathSnap(L){pathEnsure(L);return {paths:pathCopy(L.paths),cur:L.pathCur};}
function pathRestore(L,sn){L.paths=pathCopy(sn.paths);L.pathCur=clamp(sn.cur|0,0,L.paths.length-1);L.path=L.paths[L.pathCur];}
const pathSnapOf=b=>b&&b.paths?b:{paths:[b],cur:0};
let pathClip=null;
function pathActive(){const L=doc.active;return L?.path&&inDoc(L)?L:null;}
const pathMaterial=P=>P?.weld||P?.stitch||P?.weather;
function pathToolOn(){return (ui.tool==='pen'&&['paint','p3d'].includes(ui.mode))||(ui.tool==='path'&&ui.mode==='p3d');}
function pathMeshIndex(m){let C=pathMeshCaches.get(m);if(C)return C;const n=m.idx.length/3,ids=Uint32Array.from({length:n},(_,i)=>i),bounds=new Float32Array(n*6);let hash=2166136261;
  for(let t=0;t<n;t++){const b=t*6;bounds[b]=bounds[b+1]=bounds[b+2]=Infinity;bounds[b+3]=bounds[b+4]=bounds[b+5]=-Infinity;
    for(let k=0;k<3;k++){const v=m.idx[t*3+k]*3;hash=Math.imul(hash^m.idx[t*3+k],16777619);for(let j=0;j<3;j++){const x=m.pos[v+j];bounds[b+j]=Math.min(bounds[b+j],x);bounds[b+3+j]=Math.max(bounds[b+3+j],x);hash=Math.imul(hash^(Math.round(x*1e6)|0),16777619);}}}
  const build=(a,b)=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=a;i<b;i++){const q=ids[i]*6;for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],bounds[q+j]);hi[j]=Math.max(hi[j],bounds[q+3+j]);}}
    const N={lo,hi,a,b};if(b-a<=16)return N;let ax=0;for(let j=1;j<3;j++)if(hi[j]-lo[j]>hi[ax]-lo[ax])ax=j;const mid=(lo[ax]+hi[ax])*2;let i=a,j=b-1;
    while(i<=j){const q=ids[i]*6;if(bounds[q+ax]+bounds[q+3+ax]<mid/2)i++;else{const v=ids[i];ids[i]=ids[j];ids[j--]=v;}}
    if(i===a||i===b)i=(a+b)>>1;N.l=build(a,i);N.r=build(i,b);return N;};
  C={ids,bounds,tree:build(0,n),sig:[m.pos.length,m.idx.length,hash>>>0].join(':')};pathMeshCaches.set(m,C);return C;}
/* Closest point on a triangle (barycentric region tests), including its interpolated normal. */
function pathTriPoint(m,t,p){const ids=[0,1,2].map(i=>m.idx[t*3+i]),A=ids.map(i=>Array.from(m.pos.subarray(i*3,i*3+3))),ab=sub3(A[1],A[0]),ac=sub3(A[2],A[0]),ap=sub3(p,A[0]);
  const d1=dot3(ab,ap),d2=dot3(ac,ap);let u=0,v=0;
  if(!(d1<=0&&d2<=0)){const bp=sub3(p,A[1]),d3=dot3(ab,bp),d4=dot3(ac,bp);
    if(d3>=0&&d4<=d3)u=1;else{const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)u=d1/(d1-d3);else{const cp=sub3(p,A[2]),d5=dot3(ab,cp),d6=dot3(ac,cp);
      if(d6>=0&&d5<=d6)v=1;else{const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)v=d2/(d2-d6);else{const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){v=(d4-d3)/((d4-d3)+(d5-d6));u=1-v;}else{const z=1/(va+vb+vc);u=vb*z;v=vc*z;}}}}}}
  const q=A[0].map((x,i)=>x+ab[i]*u+ac[i]*v),w=[1-u-v,u,v],normal=[0,0,0];for(let i=0;i<3;i++)for(let k=0;k<3;k++)normal[k]+=(m.nrm?m.nrm[ids[i]*3+k]:sel3Nrm(m,t)[k])*w[i];
  return {p:q,n:norm3(normal),tri:t,d:dot3(sub3(q,p),sub3(q,p))};}
function pathNearest(m,p,range){const C=pathMeshIndex(m),R=range||p3Range(),distance=N=>N.lo.reduce((s,x,i)=>s+Math.pow(Math.max(x-p[i],0,p[i]-N.hi[i]),2),0);let best=null;
  const visit=N=>{if(best&&distance(N)>best.d)return;if(N.l){let a=N.l,b=N.r;if(distance(a)>distance(b))[a,b]=[b,a];visit(a);visit(b);}else for(let i=N.a;i<N.b;i++){const t=C.ids[i];if(t<R.start||t>=R.start+R.count)continue;const q=pathTriPoint(m,t,p);if(!best||q.d<best.d)best=q;}};visit(C.tree);return best;}
function pathCurve(a,b,t){const h=a.out||a.p.map(()=>0),j=b.in||b.p.map(()=>0),s=1-t;return a.p.map((x,i)=>s*s*s*x+3*s*s*t*(x+h[i])+3*s*t*t*(b.p[i]+j[i])+t*t*t*b.p[i]);}
function pathSamples(P,surface){const out=[],pts=P.points,n=pts.length;if(n<2)return out;const count=n-1+(P.closed?1:0),radius=P.width/2,stepRadius=surface&&P.weld&&!P.weld.profile?radius*Math.min(1.2,Math.max(.3,(P.spacing||.2)*3)):radius*.4;
  for(let i=0;i<count;i++){const a=pts[i],b=pts[(i+1)%n],length=Math.hypot(...sub3d(b.p,a.p))+Math.hypot(...(a.out||[]))+Math.hypot(...(b.in||[])),steps=clamp(Math.ceil(length/Math.max(surface?stepRadius:.8,.0001)),4,256);
    for(let j=0;j<=steps;j++){if(i&&j===0)continue;const t=j/steps,p=pathCurve(a,b,t),q=surface?pathNearest(v3.mesh,p):{p};if(!q)continue;out.push({p:q.p,n:q.n,pressure:(a.pressure??1)*(1-t)+(b.pressure??1)*t,segment:i,t});}}
  return out;}
function sub3d(a,b){return a.map((v,i)=>v-b[i]);}
function pathValid(L){return L.path.kind!=='3d'||!!(v3.mesh&&v3.gpu&&!v3.mesh.noUV&&pathMeshIndex(v3.mesh).sig===L.path.mesh);}
let P_PATHTIPCOPY=null;
function pathTipCopy(tip){const t=makeTarget(tip.w,tip.h,8,false);
  if(tip.fbo)blit(tip,t,0,0,tip.w,tip.h,0,0);
  else{if(!P_PATHTIPCOPY)P_PATHTIPCOPY=program('uniform sampler2D uTip; uniform vec2 uTipSize; void main(){float a=texture(uTip,gl_FragCoord.xy/uTipSize).r; o=vec4(a);}');run(P_PATHTIPCOPY,t,{uTip:tip.tex,uTipSize:[tip.w,tip.h]});}
  return t;}
function pathNew(kind,stitch,weather){const L=newLayerObj(kind==='3d'?'Surface path':'Pen path',true),P={kind,points:[],closed:false,mode:kind==='3d'?'stroke':'none',width:kind==='3d'?(v3.mesh?.radius||1)*.035:brush.size,hardness:brush.hardness,opacity:brush.opacity,spacing:brush.spacing,angle:brush.angle||0,roundness:brush.roundness||1,pressure:true};
  const undoFrom=hist.undo.length;
  if(kind==='3d')P.mesh=pathMeshIndex(v3.mesh).sig;L.path=P;P.name='Path 1';L.paths=[P];L.pathCur=0;
  const weldMaterialTip=toolBrush.cur==='material'&&materialBrush.rec?.weldPaint&&brush.tip?.name.startsWith('Weld tip · ');
  if(kind==='3d'&&weather){
    weatherPathSetup(L,weather);
  }else if(kind==='3d'&&stitch){
    stitchEnsureChannels();P.stitch=stitch;P.width=(v3.mesh.radius||1)*stitch.size/256;P.opacity=1;L.name='Stitch path';
  }else if(kind==='3d'&&(weldPathArmed||weldMaterialTip)){
    weldPathArmed=false;weldEnsureChannels();weldPathSetup(L);
  }else{
    L.fill=fillDefaults();for(const k in L.fill.maps)L.fill.maps[k].on=false;
    L.fill.maps.base={on:true,src:'value',c:ui.fg.slice()};L.fill.coverH=false;L.fill.proj='uv';fillRender(L);
    L.mask=makeMask(0,true);L.editMask=false;
    const tip=brush.tip;if(tip?.tex){L._fillImg={pathTip:pathTipCopy(tip)};P.tipName=tip.name;}
  }
  const label=P.weather?'New '+P.weather.name.toLowerCase():P.weld?'New weld path':P.stitch?'New stitch path':'New '+(kind==='3d'?'surface':'Pen')+' path';
  structOp(label,()=>{const [p,i]=insertPoint();insertNode(L,p,i);selectOnly(L);});
  if(pathMaterial(P))undoMerge(undoFrom,label);
  pathEdit.L=L;pathEdit.point=-1;pathEdit.drawing=true;return L;}
function pathRecord(L,before,label){before=pathSnapOf(before);const after=pathSnap(L);if(JSON.stringify(before)===JSON.stringify(after))return;
  const put=p=>{pathRestore(L,p);selectOnly(L);pathEdit.L=L;pathEdit.point=-1;pathEdit.drawing=false;pathEdit.drag=null;delete L._pathPreview;pathRender(L);if(pathToolOn())buildBrushPanel();if(L.path.weld)weldToolsRender();if(L.path.stitch)stitchToolsRender();};pushUndo({label:label||'Edit path',refs:[L],undo(){put(before);},redo(){put(after);}});changed(L);}
function pathFlush(){for(const L of allLayers())if(L._pathBefore){clearTimeout(L._pathTimer);const b=L._pathBefore;L._pathBefore=null;pathRecord(L,b,'Path settings');}}
function pathChange(fn,label,P){pathFlush();const L=pathActive();if(!L||lockStop({node:L}))return;if(!pathValid(L)){toast('This path belongs to a different mesh. Its saved texture is preserved.');return;}const b=pathSnap(L);fn(P||L.path);pathRender(L);pathRecord(L,b,label);buildBrushPanel();}
function pathSplit(P,i,t=.5){const a=P.points[i],b=P.points[(i+1)%P.points.length];if(!a||!b||!P.closed&&i===P.points.length-1)return;
  const mix=(x,y)=>x.map((v,j)=>v*(1-t)+y[j]*t),c=a.p.map((v,j)=>v+(a.out?.[j]||0)),d=b.p.map((v,j)=>v+(b.in?.[j]||0)),A=mix(a.p,c),B=mix(c,d),C=mix(d,b.p),D=mix(A,B),E=mix(B,C),F=mix(D,E),q=P.kind==='3d'?pathNearest(v3.mesh,F):{p:F};
  a.out=sub3d(A,a.p);b.in=sub3d(C,b.p);P.points.splice(i+1,0,{p:q.p,n:q.n,pressure:(a.pressure||1)*(1-t)+(b.pressure||1)*t,in:sub3d(D,q.p),out:sub3d(E,q.p)});}
/* Surface ribbon coverage is evaluated in world space while rasterizing the mesh into UVs.
   This crosses separate UV islands and does not depend on the current camera. */
const FS_SURFACEPATH=`in vec3 vP; in vec3 vN; uniform vec3 uA; uniform vec3 uB; uniform vec3 uNA; uniform vec3 uNB; uniform vec2 uRadius; uniform float uDepth; uniform float uHard; uniform sampler2D uTip; uniform int uUseTip; uniform float uAspect; uniform float uFollow; uniform vec3 uUp;
void main(){vec3 ab=uB-uA; float t=clamp(dot(vP-uA,ab)/max(dot(ab,ab),1e-10),0.0,1.0);vec3 n=normalize(mix(uNA,uNB,t)),q=vP-mix(uA,uB,t);float z=dot(q,n),r=mix(uRadius.x,uRadius.y,t);if(dot(normalize(vN),n)<0.0||abs(z)>uDepth){o=vec4(0.0);return;}vec3 tangent=ab-n*dot(ab,n);if(uFollow<0.5)tangent=uUp-n*dot(uUp,n);tangent=normalize(length(tangent)>1e-6?tangent:cross(n,abs(n.y)<0.9?vec3(0,1,0):vec3(1,0,0)));vec3 side=normalize(cross(n,tangent));vec2 xy=vec2(dot(q,tangent),dot(q,side))/max(r,1e-6);float d=length(xy),aa=max(fwidth(d),0.002),a=1.0-smoothstep(uHard,max(uHard+aa,1.0),d);if(uUseTip==1){vec2 uv=xy*vec2(0.5/max(uAspect,1.0),0.5*min(uAspect,1.0))+0.5;a=all(greaterThanEqual(uv,vec2(0)))&&all(lessThanEqual(uv,vec2(1)))?texture(uTip,uv).a:0.0;}o=vec4(a,a,a,a);}`;
let P_SURFACEPATH=null;
const PATH_UP={x:[1,0,0],y:[0,1,0],z:[0,0,1],nx:[-1,0,0],ny:[0,-1,0],nz:[0,0,-1]};
/* the copies of a path that symmetry paints: mirrored across the model's X, Y or Z plane (the plane positions of the 3D mirror tool) */
function pathMirrorSets(P,samples){const sets=[samples];if(!P.sym||P.kind!=='3d')return sets;const axes=['x','y','z'].filter(a=>P.sym[a]),off=(typeof mir3!=='undefined'&&mir3.off)||[0,0,0];
  for(let m=1;m<(1<<axes.length);m++){const flip=axes.filter((a,i)=>m&(1<<i)).map(a=>'xyz'.indexOf(a));sets.push(samples.map(q=>({...q,p:q.p.map((v,k)=>flip.includes(k)?2*off[k]-v:v),n:q.n.map((v,k)=>flip.includes(k)?-v:v)})));}return sets;}
function pathSurfaceMask(L,samples,coverage,stamps,weld){if(!P_SURFACEPATH)P_SURFACEPATH=prog3(VS_3DPROJ,FS_SURFACEPATH);const m=v3.mesh,g=v3.gpu,C=pathMeshIndex(m),R=p3Range(),V=gl.createVertexArray(),E=gl.createBuffer(),T=coverage||L.mask.target,P=L.path,r=P.width/2,tip=weld?null:L._fillImg?.pathTip;
  const tile=weld&&p3.udim?p3.sets[p3.cur]?.tile:null;
  const shift=tile?[tile.u,tile.v]:[0,0],uvs=weld?(v3s().uvs||1):1;
  gl.bindVertexArray(V);gl.bindBuffer(gl.ARRAY_BUFFER,g.vb);for(const [a,n,o] of [[0,3,0],[1,3,12],[2,2,24],[4,3,48]]){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,n,gl.FLOAT,false,60,o);}gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,E);
  try{for(let i=stamps?0:1;i<samples.length;i++){const a=stamps?samples[i]:samples[i-1],b=samples[i],pad=r*(weld?2.5:1.2)*Math.max(1,P.depthK||1),lo=a.p.map((v,k)=>Math.min(v,b.p[k])-pad),hi=a.p.map((v,k)=>Math.max(v,b.p[k])+pad),tris=[],bb=[Infinity,Infinity,-Infinity,-Infinity];
      const overlaps=(l,h)=>l.every((v,k)=>v<=hi[k]&&h[k]>=lo[k]);const visit=N=>{if(!overlaps(N.lo,N.hi))return;if(N.l){visit(N.l);visit(N.r);}else for(let j=N.a;j<N.b;j++){const t=C.ids[j],q=t*6;if(t<R.start||t>=R.start+R.count||!overlaps(C.bounds.subarray(q,q+3),C.bounds.subarray(q+3,q+6)))continue;for(let k=0;k<3;k++){const v=m.idx[t*3+k];tris.push(v);const x=(m.uv[v*2]*uvs-shift[0])*doc.w,y=(m.uv[v*2+1]*uvs-shift[1])*doc.h;bb[0]=Math.min(bb[0],x);bb[1]=Math.min(bb[1],y);bb[2]=Math.max(bb[2],x);bb[3]=Math.max(bb[3],y);}}};visit(C.tree);if(!tris.length)continue;
      gl.bindVertexArray(V);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,E);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(tris),gl.STREAM_DRAW);bindTarget(T);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.SCISSOR_TEST);gl.scissor(Math.max(0,Math.floor(bb[0]-1)),Math.max(0,Math.floor(bb[1]-1)),Math.ceil(bb[2]-bb[0]+2),Math.ceil(bb[3]-bb[1]+2));gl.enable(gl.BLEND);gl.blendEquation(gl.MAX);gl.blendFunc(gl.ONE,gl.ONE);
      const u={uUVs:uvs,uShift:shift,uH:dummy,uDisp:0,uUseH:false,uA:a.p,uB:b.p,uNA:a.n,uNB:b.n,uRadius:[r*(P.pressure?a.pressure:1),r*(P.pressure?b.pressure:1)],uDepth:r*1.2*(P.depthK||1),uFollow:P.follow===false?0:1,uUp:PATH_UP[P.up||'y']||[0,1,0],uHard:P.hardness,uTip:tip?.tex||dummy,uUseTip:!!tip,uAspect:tip?tip.w/tip.h:1};
      if(weld){u.uRun=[weld.distance[i-1],weld.distance[i]];u.uEnd=[!P.closed&&i===1?1:0,!P.closed&&i===samples.length-1?1:0];}
      useProg(weld?weld.program:P_SURFACEPATH,weld?{...u,...weld.uniforms}:u);gl.drawElements(gl.TRIANGLES,tris.length,gl.UNSIGNED_INT,0);}}
  finally{gl.disable(gl.SCISSOR_TEST);gl.disable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.bindVertexArray(vao);gl.deleteVertexArray(V);gl.deleteBuffer(E);}}
/* Filled path (3D): everything on the surface that lies inside the closed path as seen along the path's average direction. The shape is the path's outline
   flattened onto a plane facing that direction; a surface point is filled when it is inside that outline, facing roughly the same way and not too far in front or behind. */
const FS_SURFACEFILL=`in vec3 vP; in vec3 vN; uniform vec3 uC; uniform vec3 uAx; uniform vec3 uU; uniform vec3 uV; uniform float uDepth; uniform float uCos; uniform int uCount; uniform vec4 uPoly[48];
void main(){vec3 q=vP-uC;float z=dot(q,uAx);if(abs(z)>uDepth||dot(normalize(vN),uAx)<uCos){o=vec4(0.0);return;}
  vec2 p=vec2(dot(q,uU),dot(q,uV));bool inside=false;
  for(int i=0;i<96;i++){if(i>=uCount)break;int j=(i+uCount-1)%uCount;vec4 A=uPoly[i/2],B=uPoly[j/2];vec2 a=(i%2==0)?A.xy:A.zw,b=(j%2==0)?B.xy:B.zw;
    if((a.y>p.y)!=(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}
  float v=inside?1.0:0.0;o=vec4(v,v,v,v);}`;
let P_SURFACEFILL=null;
function pathSurfaceFill(L,samples,T){if(samples.length<3)return;if(!P_SURFACEFILL)P_SURFACEFILL=prog3(VS_3DPROJ,FS_SURFACEFILL);const m=v3.mesh,g=v3.gpu,C=pathMeshIndex(m),R=p3Range(),P=L.path;
  let step=Math.ceil(samples.length/96);const pts=samples.filter((q,i)=>i%step===0).slice(0,96);if(pts.length<3)return;
  const c=[0,0,0],ax=[0,0,0];for(const q of pts){for(let k=0;k<3;k++){c[k]+=q.p[k]/pts.length;ax[k]+=q.n[k];}}const A=norm3(ax),ref=Math.abs(A[1])<.9?[0,1,0]:[1,0,0],U=norm3(cross3(ref,A)),V=cross3(A,U);
  const poly=pts.map(q=>{const d=sub3(q.p,c);return [dot3(d,U),dot3(d,V)];});let ext=0;for(const q of pts){const d=sub3(q.p,c);ext=Math.max(ext,Math.hypot(...d));}
  const depth=Math.max(ext*.9,P.width)*(P.depthK||1),pad=depth+ext*.2,lo=c.map(v=>v-ext-pad),hi=c.map(v=>v+ext+pad),flat=new Float32Array(96*2+0);poly.forEach((q,i)=>{flat[i*2]=q[0];flat[i*2+1]=q[1];});const packed=new Float32Array(48*4);packed.set(flat.subarray(0,Math.min(flat.length,192)));
  const V0=gl.createVertexArray(),E=gl.createBuffer(),tris=[],bb=[Infinity,Infinity,-Infinity,-Infinity];
  const overlaps=(l,h)=>l.every((v,k)=>v<=hi[k]&&h[k]>=lo[k]);const visit=N=>{if(!overlaps(N.lo,N.hi))return;if(N.l){visit(N.l);visit(N.r);}else for(let j=N.a;j<N.b;j++){const t=C.ids[j],q=t*6;if(t<R.start||t>=R.start+R.count||!overlaps(C.bounds.subarray(q,q+3),C.bounds.subarray(q+3,q+6)))continue;for(let k=0;k<3;k++){const v=m.idx[t*3+k];tris.push(v);bb[0]=Math.min(bb[0],m.uv[v*2]*doc.w);bb[1]=Math.min(bb[1],m.uv[v*2+1]*doc.h);bb[2]=Math.max(bb[2],m.uv[v*2]*doc.w);bb[3]=Math.max(bb[3],m.uv[v*2+1]*doc.h);}}};visit(C.tree);
  if(!tris.length){gl.deleteVertexArray(V0);gl.deleteBuffer(E);return;}
  try{gl.bindVertexArray(V0);gl.bindBuffer(gl.ARRAY_BUFFER,g.vb);for(const [a,n,o] of [[0,3,0],[1,3,12],[2,2,24],[4,3,48]]){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,n,gl.FLOAT,false,60,o);}gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,E);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(tris),gl.STREAM_DRAW);
    bindTarget(T);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.SCISSOR_TEST);gl.scissor(Math.max(0,Math.floor(bb[0]-1)),Math.max(0,Math.floor(bb[1]-1)),Math.ceil(bb[2]-bb[0]+2),Math.ceil(bb[3]-bb[1]+2));gl.enable(gl.BLEND);gl.blendEquation(gl.MAX);gl.blendFunc(gl.ONE,gl.ONE);
    useProg(P_SURFACEFILL,{uUVs:1,uShift:[0,0],uH:dummy,uDisp:0,uUseH:false,uC:c,uAx:A,uU:U,uV:V,uDepth:depth,uCos:.15,uCount:{int:pts.length},uPoly:{v4a:packed}});gl.drawElements(gl.TRIANGLES,tris.length,gl.UNSIGNED_INT,0);}
  finally{gl.disable(gl.SCISSOR_TEST);gl.disable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.bindVertexArray(vao);gl.deleteVertexArray(V0);gl.deleteBuffer(E);}}
let P_PATHMERGE=null;
function pathRender(L){if(L.path?.weather){weatherPathRender(L);return;}if(L.path?.weld){weldPathRender(L);return;}if(L.path?.stitch){stitchPathRender(L);return;}if(!L.path||!L.mask||!pathValid(L))return;pathEnsure(L);const T=L.mask.target,cur=L.path;clearTarget(T,[0,0,0,1]);
  /* (0.93.3) every path has its own opacity: it is drawn into a spare picture and mixed into the layer's coverage at that opacity, the stronger of two paths winning where they cross.
     A layer saved before this kept its path's opacity as the layer's opacity; that moves into the path coverage the first time it is drawn. */
  let tmp=null;try{for(const P of L.paths){if(P.hidden||P.points.length<2||P.mode==='none')continue;L.path=P;if(!tmp)tmp=acquireD(T.depth);clearTarget(tmp,[0,0,0,1]);
    const s=P.kind==='3d'?(P===cur&&L._pathSamples?L._pathSamples:pathSamples(P,true)):pathSamples(P,false);if(P.kind==='3d'){if(P.mode==='ribbon'){for(const set of pathMirrorSets(P,s))pathSurfaceRibbon(L,P,set,tmp);}else if(P.mode==='fill'){if(!P.closed)continue;for(const set of pathMirrorSets(P,s))pathSurfaceFill(L,set,tmp);}else for(const set of pathMirrorSets(P,s))pathSurfaceMask(L,set,tmp);}
    else if(P.mode==='fill'){if(!P.closed)continue;rasterPoly(s.flatMap(a=>a.p),tmp,true);}
    else{useAux(tmp.depth);const o=Object.assign({},BRUSH_DEFAULTS,{tool:'brush',size:P.width,hardness:P.hardness,opacity:1,flow:1,spacing:P.spacing,pSize:P.pressure,minSize:.05,color:[1,1,1],noTint:true,angle:P.angle,roundness:P.roundness,tip:L._fillImg?.pathTip||null});
      beginStroke({target:tmp,maskOf:L,lockAlpha:false},s[0].p[0],s[0].p[1],s[0].pressure,o);for(let k=1;k<s.length;k++)addPoint(s[k].p[0],s[k].p[1],s[k].pressure);endStroke(false);}
    if(!P_PATHMERGE)P_PATHMERGE=program('uniform sampler2D uSrc; uniform vec2 uSize; uniform float uK; void main(){ o=vec4(texture(uSrc,gl_FragCoord.xy/uSize).rgb*uK,1.0); }');
    run(P_PATHMERGE,T,{uSrc:tmp.tex,uSize:[tmp.w,tmp.h],uK:clamp(P.opacity==null?1:P.opacity,0,1)},{blend:'max'});}}
  finally{L.path=cur;if(tmp)release(tmp);}
  L.opacity=1;changed(L);}
function pathProject(p,kind,hit){if(kind==='2d')return toScreen(p[0],p[1]);const r=hit.getBoundingClientRect(),{VP}=v3ViewProj(r.width,r.height),w=VP[3]*p[0]+VP[7]*p[1]+VP[11]*p[2]+VP[15];if(w<=0)return null;return [((VP[0]*p[0]+VP[4]*p[1]+VP[8]*p[2]+VP[12])/w*.5+.5)*r.width,(.5-(VP[1]*p[0]+VP[5]*p[1]+VP[9]*p[2]+VP[13])/w*.5)*r.height];}
function pathOverlay(kind){const hit=kind==='3d'?document.getElementById('v3Hit'):stage;if(!hit)return;let c=hit.parentNode.querySelector('.path-overlay[data-kind="'+kind+'"]');if(!c){c=el('canvas',{class:'path-overlay','data-kind':kind,'aria-hidden':'true'});hit.parentNode.append(c);}c.hidden=!pathToolOn();if(c.hidden)return;
  const r=hit.getBoundingClientRect(),pr=hit.parentNode.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=Math.round(r.width*d),h=Math.round(r.height*d);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}c.style.left=(r.left-pr.left)+'px';c.style.top=(r.top-pr.top)+'px';c.style.width=r.width+'px';c.style.height=r.height+'px';const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,r.width,r.height);
  const RB=pathEdit.rect;if(RB&&pathEdit.pend&&pathEdit.pend.kind===kind){x.save();x.setLineDash([5,4]);x.strokeStyle='#ffc763';x.fillStyle='rgba(255,199,99,.12)';x.lineWidth=1;const rx=Math.min(RB[0],RB[2]),ry=Math.min(RB[1],RB[3]),rw=Math.abs(RB[2]-RB[0]),rh=Math.abs(RB[3]-RB[1]);x.fillRect(rx,ry,rw,rh);x.strokeRect(rx,ry,rw,rh);x.restore();}
  const D=pathDisp,onCol=pathCss(D.col),offCol=pathCss(D.colOff),hs=Math.max(2,D.handle);
  for(const L0 of allLayers())for(const P of (L0.path?(pathEnsure(L0),L0.paths):[])){const L=L0;if(!P||P.kind!==kind||!L.visible||!pathValid(L)||P.hidden)continue;const active=L===doc.active&&P===L.path,pts=P.points;x.strokeStyle=active?onCol:(L===doc.active?onCol:offCol);x.globalAlpha=active||L!==doc.active?1:.6;x.lineWidth=active?D.width+.5:D.width;
    const samples=kind==='3d'?(active?(L._pathPreview||L._pathSamples||(L._pathSamples=pathSamples(P,true))):pathSampleLine(L,P,kind)):pathSamples(P,false);x.beginPath();let start=true;for(const a of samples){const q=pathProject(a.p,kind,hit);if(!q){start=true;continue;}if(start)x.moveTo(...q);else x.lineTo(...q);start=false;}x.stroke();x.globalAlpha=1;
    /* the segment, point or path under the pointer is lit up */
    {const H=pathEdit.hov&&pathEdit.hov.P===P?pathEdit.hov:null;if(H&&(H.seg>=0||H.line)){x.save();x.strokeStyle='#ffffff';x.globalAlpha=.95;x.lineWidth=D.width+3;x.lineCap='round';x.lineJoin='round';x.beginPath();let s2=true;
      for(const a of samples){if(H.seg>=0&&a.segment!==H.seg){s2=true;continue;}const q=pathProject(a.p,kind,hit);if(!q){s2=true;continue;}if(s2)x.moveTo(...q);else x.lineTo(...q);s2=false;}x.stroke();x.restore();}}
    /* mirrored copies from symmetry, drawn faint */
    if(kind==='3d'&&P.sym&&active){x.save();x.globalAlpha=.4;x.setLineDash([4,4]);for(const set of pathMirrorSets(P,samples).slice(1)){x.beginPath();start=true;for(const a of set){const q=pathProject(a.p,kind,hit);if(!q){start=true;continue;}if(start)x.moveTo(...q);else x.lineTo(...q);start=false;}x.stroke();}x.restore();}
    /* the direction the path paints in: an arrow at its end */
    if(D.direction&&active&&samples.length>1){const A=pathProject(samples[samples.length-2].p,kind,hit),B=pathProject(samples[samples.length-1].p,kind,hit);if(A&&B){const ang=Math.atan2(B[1]-A[1],B[0]-A[0]);x.fillStyle=onCol;x.beginPath();x.moveTo(B[0]+Math.cos(ang)*hs*2.2,B[1]+Math.sin(ang)*hs*2.2);x.lineTo(B[0]+Math.cos(ang+2.5)*hs*1.6,B[1]+Math.sin(ang+2.5)*hs*1.6);x.lineTo(B[0]+Math.cos(ang-2.5)*hs*1.6,B[1]+Math.sin(ang-2.5)*hs*1.6);x.closePath();x.fill();}}
    pts.forEach((p,i)=>{const q=pathProject(p.p,kind,hit);if(!q)return;
      if(D.normals&&active&&kind==='3d'&&p.n){const rad=(v3.mesh?.radius||1)*.08,v=pathProject(p.p.map((a,j)=>a+p.n[j]*rad),kind,hit);if(v){x.save();x.strokeStyle='#7ee08a';x.beginPath();x.moveTo(...q);x.lineTo(...v);x.stroke();x.restore();}}
      if(active&&D.tangents)for(const k of ['in','out']){if(!p[k]||Math.hypot(...p[k])<1e-6)continue;const v=pathProject(p.p.map((a,j)=>a+p[k][j]),kind,hit);if(!v)continue;x.beginPath();x.moveTo(...q);x.lineTo(...v);x.stroke();x.fillStyle='#202429';x.beginPath();x.arc(...v,Math.max(2,hs*.75),0,Math.PI*2);x.fill();x.stroke();}
      x.fillStyle=active&&(pathSelection(L).includes(i))?onCol:'#202429';x.fillRect(q[0]-hs,q[1]-hs,hs*2,hs*2);x.strokeRect(q[0]-hs,q[1]-hs,hs*2,hs*2);
      {const H=pathEdit.hov;if(H&&H.P===P&&H.pt===i&&H.k==='anchor'){x.save();x.strokeStyle='#ffffff';x.lineWidth=2;x.strokeRect(q[0]-hs-3,q[1]-hs-3,hs*2+6,hs*2+6);x.restore();}}});}}
function pathSampleLine(L,P,kind){if(kind==='3d'){const key=JSON.stringify(P.points);if(P._smpKey!==key){P._smp=pathSamples(P,true);P._smpKey=key;}return P._smp;}return pathSamples(P,false);}
function pathHit(hit,e,kind){const r=hit.getBoundingClientRect(),p=[e.clientX-r.left,e.clientY-r.top],layers=allLayers().filter(L=>L.path?.kind===kind&&L.visible&&pathValid(L)).reverse();
  for(const L of layers){pathEnsure(L);L.paths.forEach((P,pi)=>{});
    for(let pi=L.paths.length-1;pi>=0;pi--){const P=L.paths[pi];if(P.hidden)continue;const activeP=L===doc.active&&P===L.path;
      for(let i=0;i<P.points.length;i++){const a=P.points[i],keys=activeP?['in','out','anchor']:['anchor'];for(const k of keys){if(k!=='anchor'&&(!a[k]||Math.hypot(...a[k])<1e-6))continue;const q=pathProject(k==='anchor'?a.p:a.p.map((v,j)=>v+a[k][j]),kind,hit);if(q&&Math.hypot(q[0]-p[0],q[1]-p[1])<9)return {L,P,pi,i,k};}}}}
  for(const L of layers)for(let pi=L.paths.length-1;pi>=0;pi--){const P=L.paths[pi];if(P.hidden||(L===doc.active&&P===L.path))continue;let prev=null;
    for(const a of pathSampleLine(L,P,kind)){const q=pathProject(a.p,kind,hit);if(q&&prev){const dx=q[0]-prev[0],dy=q[1]-prev[1],l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((p[0]-prev[0])*dx+(p[1]-prev[1])*dy)/l2)):0;if(Math.hypot(prev[0]+dx*t-p[0],prev[1]+dy*t-p[1])<7)return {L,P,pi,k:'select'};}prev=q;}}
  return null;}
/* the selected points of the path being edited: a rectangle or Shift+click selects several, otherwise the one clicked */
function pathSelection(L){if(!L||!L.path)return [];const n=L.path.points.length;if(pathEdit.point<0)return [];if(pathEdit.selPath===L.path&&pathEdit.sel.length)return pathEdit.sel.filter(i=>i>=0&&i<n);return pathEdit.point>=0&&pathEdit.point<n?[pathEdit.point]:[];}
function pathSelect(L,list){pathEdit.selPath=L.path;pathEdit.sel=list.slice();pathEdit.point=list.length?list[list.length-1]:-1;}
/* smooth point: handles follow the line between its neighbours; corner point: no handles (Painter's "linear" tangent) */
function pathSmoothAt(P,i){const q=P.points[i],n=P.points.length,a=P.points[(i-1+n)%n],b=P.points[(i+1)%n];if(n<2)return;q.out=sub3d(b.p,a.p).map(v=>v/6);q.in=q.out.map(v=>-v);}
function pathIsSmooth(q){return !!(q.in&&q.out&&(Math.hypot(...q.in)>1e-6||Math.hypot(...q.out)>1e-6));}
function pathToggleSmooth(L,list,force){if(!list.length)return;pathChange(P=>{for(const i of list){const q=P.points[i];if(!q)continue;const smooth=force==null?!pathIsSmooth(q):force;if(smooth)pathSmoothAt(P,i);else{q.in=q.p.map(()=>0);q.out=q.p.map(()=>0);}}},force==null?'Corner / smooth points':force?'Smooth points':'Corner points');}
/* (0.95, Kenn) custom tangents: how long a point's handles are compared with the automatic smooth ones, and handles that move on their own (broken) or as a pair (joined) */
function pathAutoLen(P,i){const n=P.points.length;if(n<2)return 0;const a=P.points[(i-1+n)%n],b=P.points[(i+1)%n];return Math.hypot(...sub3d(b.p,a.p))/6;}
function pathTanRatio(P,i){const q=P.points[i],auto=pathAutoLen(P,i);if(!q||!q.out||auto<1e-9)return 1;return Math.hypot(...q.out)/auto;}
function pathSetTanLen(P,i,k){const q=P.points[i];if(!q)return;const auto=pathAutoLen(P,i);if(auto<1e-9)return;if(!pathIsSmooth(q))pathSmoothAt(P,i);
  for(const key of ['in','out']){const v=q[key],l=v?Math.hypot(...v):0;if(l>1e-9)q[key]=v.map(x=>x*(auto*k/l));else{const o=q[key==='in'?'out':'in'];q[key]=o?o.map(x=>-x*(auto*k/Math.max(Math.hypot(...o),1e-9))):v;}}}
function pathBreak(L,list,on){if(!list.length)return;pathChange(P=>{for(const i of list){const q=P.points[i];if(!q)continue;q.broken=!!on;if(on&&!pathIsSmooth(q))pathSmoothAt(P,i);if(!on&&q.out)q.in=q.out.map(v=>-v);}},on?'Break handles':'Join handles');}
function pathDeletePoints(L,list){if(!list.length)return;pathChange(P=>{for(const i of list.slice().sort((a,b)=>b-a))P.points.splice(i,1);},list.length>1?'Delete path points':'Delete path point');pathSelect(L,[]);}
function pathReverse(L){pathChange(P=>{P.points.reverse();for(const q of P.points){const t=q.in;q.in=q.out;q.out=t;}},'Reverse path direction');pathSelect(L,[]);}
/* the nearest place on the path's line to the pointer, as a segment number and a position along it */
function pathNearLine(hit,e,kind,P){const r=hit.getBoundingClientRect(),m=[e.clientX-r.left,e.clientY-r.top];let best=null,prev=null,pq=null;
  for(const a of pathSamples(P,kind==='3d')){const q=pathProject(a.p,kind,hit);if(q&&prev&&pq){const dx=q[0]-pq[0],dy=q[1]-pq[1],l2=dx*dx+dy*dy,u=l2?Math.max(0,Math.min(1,((m[0]-pq[0])*dx+(m[1]-pq[1])*dy)/l2)):0,d=Math.hypot(pq[0]+dx*u-m[0],pq[1]+dy*u-m[1]);
      if(d<8&&(!best||d<best.d))best={d,i:a.segment,t:prev.segment===a.segment?prev.t+(a.t-prev.t)*u:a.t*u};}prev=a;pq=q;}
  return best&&best.t>.02&&best.t<.98?best:null;}
/* a new, empty path inside the same path layer: it starts with the settings of the one being edited */
function pathAddTo(L){pathEnsure(L);const before=pathSnap(L),P=pathCopy(L.path);P.points=[];P.closed=false;delete P.hidden;P.name='Path '+(L.paths.length+1);L.paths.push(P);pathSetCur(L,L.paths.length-1);pathEdit.L=L;pathEdit.point=-1;pathEdit.drawing=true;pathRecord(L,before,'New path');return P;}
function pathDelete(L,i){pathEnsure(L);if(L.paths.length<2){cmdDelete();return;}const before=pathSnap(L);L.paths.splice(i,1);pathSetCur(L,Math.min(i,L.paths.length-1));pathEdit.point=-1;pathRender(L);pathRecord(L,before,'Delete path');buildBrushPanel();requestRender();}
function pathDuplicate(L,i){pathEnsure(L);const before=pathSnap(L),P=pathCopy(L.paths[i]);P.name=(P.name||'Path')+' copy';L.paths.splice(i+1,0,P);pathSetCur(L,i+1);pathRender(L);pathRecord(L,before,'Duplicate path');buildBrushPanel();requestRender();}
function pathCopyClip(L){if(!L?.path)return;pathClip=pathCopy(L.path);toast('Copied “'+(L.path.name||'path')+'”.');if(pathToolOn())buildBrushPanel();}
function pathPaste(L){if(pathClip?.weather||L?.path?.weather){toast('Choose Sealant Bead to start another bead.');return;}if(pathClip?.stitch||L?.path?.stitch){toast('Use Duplicate path to copy a stitch path.');return;}if(!pathClip||!L?.path||pathClip.kind!==L.path.kind){toast(pathClip?'That path is a different kind.':'Copy a path first.');return;}pathEnsure(L);const before=pathSnap(L),P=pathCopy(pathClip);P.name=(P.name||'Path')+' copy';L.paths.push(P);pathSetCur(L,L.paths.length-1);pathRender(L);pathRecord(L,before,'Paste path');buildBrushPanel();requestRender();}
function pathEventPoint(hit,e,kind){if(kind==='2d')return {p:toImage(e.clientX,e.clientY)};const pk=v3PickAt(hit,e);if(!pk)return null;
  const active=p3.sets[p3.cur],range=v3.mesh.setRanges?.[pk.set];
  if(p3.udim?(!pk.tile||pk.tile.id!==active?.tile?.id||range&&range.start!==p3Range().start):pk.set!==p3.cur)return null;
  return pathNearest(v3.mesh,pk.pos);}
/* (0.94) Alt+click on an open, finished path adds a point at the end nearer the click (a click, not a drag: Alt+drag still turns the model) */
function pathAltAdd(hit,e,kind,L){if(!L||!L.path||L.path.closed||pathMaterial(L.path)||L.path.kind!==kind||lockStop({node:L})||lockedPos(L))return false;const q=pathEventPoint(hit,e,kind);if(!q)return false;
  const P=L.path,n=P.points.length,r=hit.getBoundingClientRect(),m=[e.clientX-r.left,e.clientY-r.top],dist=i=>{const v=pathProject(P.points[i].p,kind,hit);return v?Math.hypot(v[0]-m[0],v[1]-m[1]):1e9;};
  const first=n>1&&dist(0)<dist(n-1),before=pathSnap(L),pt={p:q.p,n:q.n,pressure:pressureOf(e),in:q.p.map(()=>0),out:q.p.map(()=>0)};
  if(first)P.points.unshift(pt);else P.points.push(pt);pathEdit.L=L;pathSelect(L,[first?0:P.points.length-1]);pathRender(L);pathRecord(L,before,'Add path point');buildBrushPanel();requestRender();return true;}
function pathAltStart(hit,e,kind){if(!e.altKey||e.button!==0||!pathToolOn()||!((kind==='2d'&&ui.tool==='pen')||(kind==='3d'&&ui.tool==='path'))||pathHit(hit,e,kind))return false;
  const L=pathActive();if(!L||!L.path||L.path.kind!==kind||!pathValid(L)||L.path.closed||pathMaterial(L.path)||!L.path.points.length||pathEdit.drawing)return false;
  if(kind==='2d')return pathAltAdd(hit,e,kind,L);
  pathEdit.altClick={id:e.pointerId,start:[e.clientX,e.clientY],hit,kind,moved:false};return false;}
function pathDown(hit,e,kind){if(pathAltStart(hit,e,kind))return true;if(!pathToolOn()||(kind==='2d'&&ui.tool!=='pen')||(kind==='3d'&&ui.tool!=='path')||e.button!==0||spaceDown||e.altKey&&!pathHit(hit,e,kind))return false;
  if(stroke||preview||xf||selLive||tabDocs.hold||gfSaving||bk.busy)return true;if(kind==='3d'&&(!v3.mesh||v3.mesh.noUV))return true;
  pathFlush();let found=pathHit(hit,e,kind);const active=pathActive();
  if(pathEdit.drawing&&active?.path?.weather&&found?.L!==active)found=null;
  const q=pathEventPoint(hit,e,kind);if(!q&&!found)return true;let L=found?.L||active;
  if(found&&found.k==='select'){selectOnly(found.L);pathSetCur(found.L,found.pi);pathEdit.L=found.L;pathEdit.point=-1;pathEdit.drawing=false;renderLayers();buildBrushPanel();requestRender();return true;}
  if(found&&found.pi!=null&&found.pi!==found.L.pathCur){selectOnly(found.L);pathSetCur(found.L,found.pi);}
  const can=L&&L.path&&L.path.kind===kind&&pathValid(L);
  /* editing a finished path: double-click a point to switch it between smooth and corner */
  const dbl=found&&found.k==='anchor'&&pathEdit.last&&pathEdit.last.P===found.P&&pathEdit.last.i===found.i&&e.timeStamp-pathEdit.last.t<400;if(found&&found.k==='anchor')pathEdit.last={P:found.P,i:found.i,t:e.timeStamp};
  if(dbl&&!pathEdit.drawing&&can){pathEdit.last=null;pathSelect(L,[found.i]);pathToggleSmooth(L,[found.i]);return true;}
  /* editing a finished path: click along its line to add a point there */
  if(!found&&can&&!pathEdit.drawing&&L.path.points.length>=2&&!e.shiftKey){const near=pathNearLine(hit,e,kind,L.path);
    if(near&&!lockStop({node:L})&&!lockedPos(L)){const before=pathSnap(L);pathSplit(L.path,near.i,near.t);const index=near.i+1;pathSelect(L,[index]);
      pathEdit.L=L;pathEdit.drag={id:e.pointerId,L,index,k:'anchor',before,origin:pathCopy(L.path.points[index]),start:[e.clientX,e.clientY],hit,kind,moved:false,added:true};try{hit.setPointerCapture(e.pointerId);}catch(er){}renderLayers();buildBrushPanel();requestRender();return true;}}
  /* clicking empty surface: drag draws a selection rectangle; a plain click starts a new path (decided when the button is released) */
  if(!found&&can&&!pathMaterial(L.path)&&!pathEdit.drawing){pathEdit.pend={id:e.pointerId,start:[e.clientX,e.clientY],hit,kind,shift:e.shiftKey,moved:false};try{hit.setPointerCapture(e.pointerId);}catch(er){}return true;}
  if(found&&found.k==='anchor'&&e.shiftKey&&can){const cur=pathSelection(L),i=found.i;pathSelect(L,cur.includes(i)?cur.filter(x=>x!==i):[...cur,i]);buildBrushPanel();requestRender();return true;}
  if(!can||(!found&&pathMaterial(L.path)&&!pathEdit.drawing))L=pathNew(kind,L?.path?.stitch?pathCopy(L.path.stitch):undefined,L?.path?.weather?{...pathCopy(L.path.weather),width:L.path.width/(v3.mesh.radius||1)}:undefined);
  if(lockStop({node:L})||lockedPos(L)){if(lockedPos(L))lockMsg(L,'position');return true;}selectOnly(L);const before=pathSnap(L);let index=found?.i,k=found?.k||'new';
  if(found)pathSelect(L,[found.i]);
  if(found&&index===0&&pathEdit.drawing&&L.path.points.length>=3&&!e.ctrlKey&&!e.altKey){L.path.closed=true;pathEdit.drawing=false;pathRender(L);pathRecord(L,before,'Close path');buildBrushPanel();return true;}
  if(!found){index=L.path.points.length;L.path.points.push({p:q.p,n:q.n,pressure:pressureOf(e),in:q.p.map(()=>0),out:q.p.map(()=>0)});}
  pathEdit.L=L;pathEdit.point=index;pathEdit.sel=[];pathEdit.drag={id:e.pointerId,L,index,k,before,origin:pathCopy(L.path.points[index]),start:[e.clientX,e.clientY],hit,kind,moved:false};try{hit.setPointerCapture(e.pointerId);}catch(er){}renderLayers();buildBrushPanel();requestRender();return true;}
/* what the pointer is over, so it can be lit up: a segment you could add a point to, a point, or another path */
function pathHoverUpdate(e){let h=null;const kind=ui.tool==='pen'?'2d':ui.tool==='path'?'3d':null;
  if(kind&&pathToolOn()&&!e.buttons&&!pathEdit.drag&&!pathEdit.pend){const hit=kind==='3d'?document.getElementById('v3Hit'):stage;
    if(hit&&e.target&&(e.target===hit||(hit.contains&&hit.contains(e.target))||(kind==='2d'&&e.target===cv))){const found=pathHit(hit,e,kind);
      if(found)h=found.k==='select'?{L:found.L,P:found.P,line:true}:{L:found.L,P:found.P,pt:found.i,k:found.k};
      else{const L=pathActive();if(L&&L.path&&L.path.kind===kind&&pathValid(L)&&!pathEdit.drawing&&L.path.points.length>=2&&!pathMaterial(L.path)){const near=pathNearLine(hit,e,kind,L.path);if(near)h={L,P:L.path,seg:near.i,t:near.t};}}}}
  const key=h?[h.L.paths?h.L.paths.indexOf(h.P):0,h.line?'l':'',h.seg,h.pt,h.k].join():'';if(key!==pathEdit.hovKey){pathEdit.hovKey=key;pathEdit.hov=h;requestRender();}}
function pathMove(e){pathHoverUpdate(e);{const AC=pathEdit.altClick;if(AC&&AC.id===e.pointerId&&Math.hypot(e.clientX-AC.start[0],e.clientY-AC.start[1])>4)AC.moved=true;}
  const PD=pathEdit.pend;if(PD&&PD.id===e.pointerId){if(!PD.moved&&Math.hypot(e.clientX-PD.start[0],e.clientY-PD.start[1])>5)PD.moved=true;
    if(PD.moved){const r=PD.hit.getBoundingClientRect();pathEdit.rect=[PD.start[0]-r.left,PD.start[1]-r.top,e.clientX-r.left,e.clientY-r.top];requestRender();}return true;}
  const D=pathEdit.drag;if(!D||D.id!==e.pointerId)return false;const q=pathEventPoint(D.hit,e,D.kind);if(!q)return true;D.moved=D.moved||Math.hypot(e.clientX-D.start[0],e.clientY-D.start[1])>2;const p=D.L.path.points[D.index];
  if(D.k==='anchor'){p.p=q.p;p.n=q.n;}else if(D.moved){const delta=sub3d(q.p,D.origin.p),key=D.k==='new'?'out':D.k,other=key==='in'?'out':'in';
    if(e.ctrlKey&&D.k!=='new'&&D.origin[key]&&Math.hypot(...D.origin[key])>1e-6){/* Ctrl: both handles of the point grow or shrink together */const f=Math.hypot(...sub3d(q.p,D.origin.p).map((v,j)=>v+D.origin[key][j]))/Math.hypot(...D.origin[key]);if(Number.isFinite(f)){p[key]=D.origin[key].map(v=>v*f);if(D.origin[other])p[other]=D.origin[other].map(v=>v*f);}}
    else{p[key]=delta;if(!e.altKey&&!p.broken)p[other]=delta.map(v=>-v);}}if(D.kind==='3d')D.L._pathPreview=pathSamples(D.L.path,true);requestRender();return true;}
function pathUp(e,cancel){{const AC=pathEdit.altClick;if(AC&&AC.id===e.pointerId){pathEdit.altClick=null;if(!AC.moved&&!cancel){const L=pathActive();if(L)pathAltAdd(AC.hit,e,AC.kind,L);}return false;}}
  const PD=pathEdit.pend;if(PD&&PD.id===e.pointerId){pathEdit.pend=null;pathEdit.rect=null;try{PD.hit.releasePointerCapture(e.pointerId);}catch(er){}if(cancel){requestRender();return true;}
    const L=pathActive();if(!L){return true;}
    if(PD.moved){const r=PD.hit.getBoundingClientRect(),x0=Math.min(PD.start[0],e.clientX)-r.left,x1=Math.max(PD.start[0],e.clientX)-r.left,y0=Math.min(PD.start[1],e.clientY)-r.top,y1=Math.max(PD.start[1],e.clientY)-r.top,inside=[];
      L.path.points.forEach((a,i)=>{const q=pathProject(a.p,PD.kind,PD.hit);if(q&&q[0]>=x0&&q[0]<=x1&&q[1]>=y0&&q[1]<=y1)inside.push(i);});pathSelect(L,PD.shift?[...new Set([...pathSelection(L),...inside])]:inside);buildBrushPanel();requestRender();return true;}
    const q=pathEventPoint(PD.hit,e,PD.kind);if(!q||lockStop({node:L})||lockedPos(L))return true;
    /* (0.94) an end point of an open path is selected: carry on from it instead of starting a new path. From the first point the path is turned round while you draw and turned back when you finish. */
    {const P0=L.path,n=P0.points.length,sel=pathSelection(L);
      if(!P0.closed&&n>=1&&!pathMaterial(P0)&&sel.length===1&&(sel[0]===n-1||sel[0]===0)){const before=pathSnap(L);
        if(sel[0]===0&&n>1){P0.points.reverse();for(const a of P0.points){const t=a.in;a.in=a.out;a.out=t;}pathEdit.rev=P0;}
        P0.points.push({p:q.p,n:q.n,pressure:pressureOf(e),in:q.p.map(()=>0),out:q.p.map(()=>0)});pathEdit.L=L;pathEdit.drawing=true;pathSelect(L,[P0.points.length-1]);
        pathRender(L);pathRecord(L,before,'Continue path');buildBrushPanel();requestRender();return true;}}
    pathAddTo(L);const before=pathSnap(L);L.path.points.push({p:q.p,n:q.n,pressure:pressureOf(e),in:q.p.map(()=>0),out:q.p.map(()=>0)});pathSelect(L,[0]);pathRender(L);pathRecord(L,before,'Add path point');buildBrushPanel();requestRender();return true;}
  const D=pathEdit.drag;if(!D||D.id!==e.pointerId)return false;pathEdit.drag=null;delete D.L._pathPreview;if(cancel)pathRestore(D.L,pathSnapOf(D.before));pathRender(D.L);if(!cancel)pathRecord(D.L,D.before,D.added||D.k==='new'?'Add path point':'Move path point');buildBrushPanel();return true;}
function pathFinish(){pathFlush();
  /* a path continued from its first point was turned round while drawing: put it back the way it ran */
  if(pathEdit.rev&&pathEdit.L&&pathEdit.L.path===pathEdit.rev&&pathEdit.drawing){const P=pathEdit.rev;P.points.reverse();for(const a of P.points){const t=a.in;a.in=a.out;a.out=t;}pathRender(pathEdit.L);}
  if(pathEdit.drawing&&pathEdit.L&&pathEdit.L.path)pathSelect(pathEdit.L,[]);   // finished: nothing selected, so the next click on empty surface starts a new path
  pathEdit.rev=null;pathEdit.drawing=false;pathEdit.drag=null;buildBrushPanel();requestRender();}
function pathResize(fx,fy,ox,oy){for(const L of everyLayer())if(L.path?.kind==='2d'){for(const p of L.path.points){p.p=[p.p[0]*fx+ox,p.p[1]*fy+oy];for(const k of ['in','out'])if(p[k])p[k]=[p[k][0]*fx,p[k][1]*fy];}L.path.width*=(fx+fy)/2;pathRender(L);}if(pathToolOn())buildBrushPanel();}
function pathKeys(e){const typing=!modal.hidden||openName||!pop.hidden||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.target.isContentEditable;
  if(pathToolOn()&&!typing&&!e.defaultPrevented&&(e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&/^[cv]$/i.test(e.key)&&pathActive()){e.key.toLowerCase()==='c'?pathCopyClip(pathActive()):pathPaste(pathActive());e.preventDefault();e.stopImmediatePropagation();return true;}
  if(!pathToolOn()||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||typing)return false;
  const L=pathActive();if(e.key==='Enter'||e.key==='Escape'){if(pathEdit.drag)pathUp({pointerId:pathEdit.drag.id},e.key==='Escape');if(e.key==='Escape'&&L)pathSelect(L,[]);pathFinish();e.preventDefault();e.stopImmediatePropagation();return true;}
  if((e.key==='Delete'||e.key==='Backspace')&&L&&pathSelection(L).length){pathDeletePoints(L,pathSelection(L));e.preventDefault();e.stopImmediatePropagation();return true;}
  if((e.key==='Delete'||e.key==='Backspace')&&L&&!pathSelection(L).length){pathDelete(L,L.pathCur);e.preventDefault();e.stopImmediatePropagation();return true;}return false;}
function pathNewButton(){pathFinish();const L=pathActive();if(L?.path.stitch){stitchPathStart();return;}if(L?.path.weather){sealantPathStart();return;}pathEdit.point=-1;if(L&&!pathMaterial(L.path)&&L.path.kind===(ui.tool==='path'?'3d':'2d')&&pathValid(L)){pathAddTo(L);buildBrushPanel();requestRender();return;}pathEdit.L=null;selectOnly(null);pathEdit.drawing=true;buildBrushPanel();requestRender();}
/* the Paths panel: every path of this layer, with show/hide, rename (double-click), duplicate, copy, paste and delete */
function pathsPanel(box,L){pathEnsure(L);const list=el('div',{class:'pathlist',role:'listbox','aria-label':'Paths'});
  L.paths.forEach((P,i)=>{const on=P===L.path,eye=el('button',{type:'button',class:'btn sm patheye',title:P.hidden?'Show this path':'Hide this path','aria-label':P.hidden?'Show path':'Hide path','aria-pressed':String(!P.hidden),text:P.hidden?'○':'●',onclick:e=>{e.stopPropagation();pathChange(q=>{q.hidden=!q.hidden;},P.hidden?'Show path':'Hide path',P);}}),
      nm=el('span',{class:'pathname',text:P.name||('Path '+(i+1))}),
      row=el('div',{class:'pathrow'+(on?' on':'')+(P.hidden?' off':''),role:'option','aria-selected':String(on),'data-path':String(i),title:'Click to select · double-click to rename',
        onclick:()=>{if(P===L.path)return;pathSetCur(L,i);pathEdit.point=-1;pathEdit.drawing=false;requestRender();buildBrushPanel();}},eye,nm);
    list.append(row);});
  box.append(el('div',{class:'sub',text:'Paths'}),list,el('div',{class:'chips'},
    el('button',{class:'btn sm',id:'pathAdd',text:'New',title:'Start another path in this layer',onclick:pathNewButton}),
    el('button',{class:'btn sm',id:'pathDup',text:'Duplicate',onclick:()=>pathDuplicate(L,L.pathCur)}),
    el('button',{class:'btn sm',id:'pathCopyBtn',text:'Copy',title:'Copy this path (Ctrl+C)',onclick:()=>pathCopyClip(L)}),
    el('button',{class:'btn sm',id:'pathPasteBtn',text:'Paste',title:'Paste the copied path into this layer (Ctrl+V)',disabled:!pathClip,onclick:()=>pathPaste(L)}),
    el('button',{class:'btn sm',id:'pathDel',text:'Delete',title:'Delete this path (Delete key)',onclick:()=>pathDelete(L,L.pathCur)})));}
/* double-click a path's name to rename it (one listener for the whole page: the panel is rebuilt by the first click) */
function pathRenameStart(i){const L=pathActive();if(!L||!L.paths[i])return;const P=L.paths[i],nm=document.querySelector('.pathrow[data-path="'+i+'"] .pathname');if(!nm)return;
  const inp=el('input',{class:'pathrename',value:P.name||'','aria-label':'Path name'});nm.replaceWith(inp);inp.focus();inp.select();let done=false;
  const fin=()=>{if(done)return;done=true;const v=inp.value.trim();if(v&&v!==P.name)pathChange(q=>{q.name=v;},'Rename path',P);else buildBrushPanel();};inp.onblur=fin;inp.onkeydown=k=>{if(k.key==='Enter')fin();if(k.key==='Escape'){done=true;buildBrushPanel();}k.stopPropagation();};}
document.addEventListener('dblclick',e=>{const row=e.target.closest?.('.pathrow');if(!row||e.target.closest('.patheye')||e.target.closest('input'))return;pathRenameStart(+row.dataset.path);});
function pathDisplayBox(){const d=el('details',{class:'pathdisp'},el('summary',{text:'Display'}));d.open=!!pathDisp.open;d.ontoggle=()=>{pathDisp.open=d.open;pathDispSave();};const f=()=>{pathDispSave();requestRender();};
  d.append(makeSlider({id:'pdHandle',label:'Handle size',min:2,max:10,step:1,value:pathDisp.handle,fmt:v=>Math.round(v)+' px',onInput:v=>{pathDisp.handle=v;f();}}).el,makeSlider({id:'pdWidth',label:'Path width',min:1,max:6,step:.5,value:pathDisp.width,fmt:v=>v+' px',onInput:v=>{pathDisp.width=v;f();}}).el,
    colourBtn('pdCol',()=>pathDisp.col,c=>{pathDisp.col=c;f();},'Path colour'),colourBtn('pdColOff',()=>pathDisp.colOff,c=>{pathDisp.colOff=c;f();},'Unselected path colour'),
    el('div',{class:'chips'},chk('pdNormals','Normals',pathDisp.normals,v=>{pathDisp.normals=v;f();}),chk('pdTangents','Tangents',pathDisp.tangents,v=>{pathDisp.tangents=v;f();}),chk('pdDir','Path direction',pathDisp.direction,v=>{pathDisp.direction=v;f();})));return d;}
function pathPanel(box){const L=pathActive(),P=L?.path;pathPanelFor=doc.active;$('#brushTitle').textContent=ui.tool==='path'?'Surface Path':'Pen';
  box.append(el('p',{class:'note',text:ui.tool==='path'?'Click on the model to add points. Drag a new point for a curve. Alt+drag rotates the model. Enter finishes; click a point to edit it.':'Click for corners; click and drag for Bézier handles. Drag points or handles to edit. Alt+drag a handle breaks its pair. Click the first point to close. Enter finishes. To carry on from an open end, click that end point, then click where the path should go (Esc first to start a new path instead).'}),
    el('div',{class:'chips'},el('button',{class:'btn sm',id:'pathNew',text:'New path',onclick:pathNewButton}),el('button',{class:'btn sm',id:'pathFinish',text:'Finish',disabled:!P,onclick:pathFinish})));
  if(!P){box.append(el('p',{class:'note',text:'Start a path on the '+(ui.tool==='path'?'model.':'canvas.')}));return;}
  if(P.stitch)box.append(el('div',{class:'sub',text:'Stitch settings'}),tsHost('stitch'));
  else if(P.weather)weatherPathControls(box,P);
  else pathsPanel(box,L);
  const name=el('input',{id:'pathName',value:L.name,'aria-label':'Layer name',title:'Layer name'});name.onchange=()=>{const b=L.name,a=name.value.trim()||b;L.name=a;pushUndo({label:'Rename layer',refs:[L],undo(){L.name=b;},redo(){L.name=a;}});changed(L);};box.append(name,
    seg(pathMaterial(P)?[['none','Path only'],['stroke',P.weather?P.weather.name:P.stitch?'Stitches':'Weld bead']]:P.kind==='3d'?[['stroke','Paint along path'],['ribbon','Ribbon path'],['fill','Filled path']]:[['none','Path only'],['stroke','Brush stroke'],['fill','Fill']],P.mode,v=>{pathChange(p=>{p.mode=v;if(v==='fill'&&p.points.length>=3)p.closed=true;},'Path painting mode');if(v==='ribbon'&&typeof rbUseText==='function'&&!rbImage(L,L.path))rbUseText(L,L.path,Object.assign({},t3.style,{content:'Ribbon text',align:'left'}));},'Path painting mode'),
    el('div',{class:'chips'},chk('pathClosed','Closed path',P.closed,v=>pathChange(p=>p.closed=v,'Close/open path')),chk('pathPressure','Point pressure',P.pressure,v=>pathChange(p=>p.pressure=v,'Path pressure'))));
  const sl=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:P[key],fmt,onInput:v=>{if(lockStop({node:L}))return;const b=pathSnap(L);L.path[key]=v;pathRender(L);clearTimeout(L._pathTimer);if(!L._pathBefore)L._pathBefore=b;L._pathTimer=setTimeout(()=>{const old=L._pathBefore;L._pathBefore=null;pathRecord(L,old,'Path '+label.toLowerCase());},400);}}).el;
  if(P.kind==='3d'&&P.mode==='ribbon'&&typeof ribbonPanel==='function')ribbonPanel(box,L,P);
  if(!P.weld?.profile&&!P.stitch)box.append(sl('pathWidth','Width','width',P.kind==='3d'?.001:1,P.kind==='3d'?2:1000,P.kind==='3d'?.001:1,v=>P.kind==='3d'?v.toFixed(3)+' units':Math.round(v)+' px'));
  if(!P.weld?.profile&&!P.stitch&&!P.weather)box.append(sl('pathHard','Hardness','hardness',0,1,.01,pct));
  box.append(sl('pathOpacity','Opacity','opacity',0,1,.01,pct));
  if(P.kind==='3d'){
    box.append(makeSlider({id:'pathDepth',label:'Projection depth',min:.1,max:6,step:.05,value:P.depthK||1,fmt:v=>v.toFixed(2)+'×',onInput:v=>{if(lockStop({node:L}))return;const b=pathSnap(L);L.path.depthK=v;pathRender(L);clearTimeout(L._pathTimer);if(!L._pathBefore)L._pathBefore=b;L._pathTimer=setTimeout(()=>{const old=L._pathBefore;L._pathBefore=null;pathRecord(L,old,'Path projection depth');},400);}}).el,
      (P.weld?.profile||P.stitch||P.weather)?null:el('div',{class:'chips'},chk('pathFollow','Follow path',P.follow!==false,v=>pathChange(q=>q.follow=v,'Follow path')),
        P.follow===false?el('select',{id:'pathUp','aria-label':'Up axis',title:'The axis that orients each stamp when Follow path is off'},...[['x','+X'],['y','+Y'],['z','+Z'],['nx','−X'],['ny','−Y'],['nz','−Z']].map(([v,t])=>el('option',{value:v,text:'Up axis: '+t}))):null),
      el('div',{class:'chips'},el('span',{class:'note',text:'Symmetry'}),...['x','y','z'].map(a=>chk('pathSym'+a,a.toUpperCase(),!!(P.sym&&P.sym[a]),v=>pathChange(q=>{q.sym=Object.assign({x:false,y:false,z:false},q.sym,{[a]:v});},'Path symmetry')))));
    const up=$('#pathUp');if(up){up.value=P.up||'y';up.onchange=()=>pathChange(q=>q.up=up.value,'Path up axis');}}
  box.append(pathDisplayBox());
  const selected=pathSelection(L),point=selected.length?P.points[selected[selected.length-1]]:null;
  if(point)box.append(makeSlider({id:'pathPointPressure',label:selected.length>1?'Pressure ('+selected.length+' points)':'Point pressure',min:.05,max:1,step:.01,value:point.pressure||1,fmt:pct,onInput:v=>{if(lockStop({node:L}))return;if(!L._pathBefore)L._pathBefore=pathSnap(L);for(const i of selected)if(P.points[i])P.points[i].pressure=v;requestRender();},onChange:()=>{pathRender(L);pathFlush();}}).el,
    el('div',{class:'chips'},el('button',{class:'btn sm',id:'pathCorner',text:'Corner',title:'Remove the curve handles of the selected points',onclick:()=>pathToggleSmooth(L,pathSelection(L),false)}),el('button',{class:'btn sm',id:'pathSmooth',text:'Smooth',title:'Make the selected points smooth (double-click a point to switch)',onclick:()=>pathToggleSmooth(L,pathSelection(L),true)}),
      el('button',{class:'btn sm',id:'pathBreak',text:point&&point.broken?'Join handles':'Break handles',title:'Break: each handle of the selected points moves on its own. Join: they move as a pair again.',onclick:()=>pathBreak(L,pathSelection(L),!(point&&point.broken))}),
      el('button',{class:'btn sm',id:'pathDelPoint',text:selected.length>1?'Delete points':'Delete point',onclick:()=>pathDeletePoints(L,pathSelection(L))})));
  if(point)box.append(makeSlider({id:'pathTanLen',label:selected.length>1?'Handle length ('+selected.length+' points)':'Handle length',min:0,max:3,step:.01,value:Math.min(3,pathTanRatio(P,selected[selected.length-1])),fmt:v=>Math.round(v*100)+'% of automatic',onInput:v=>{if(lockStop({node:L}))return;if(!L._pathBefore)L._pathBefore=pathSnap(L);for(const i of selected)pathSetTanLen(P,i,v);if(L.path.kind==='3d')L._pathPreview=pathSamples(L.path,true);requestRender();},onChange:()=>{pathRender(L);pathFlush();}}).el);
  box.append(el('div',{class:'chips'},el('button',{class:'btn sm',id:'pathReverse',text:'Reverse direction',title:'Flip the direction the path is painted in',disabled:P.points.length<2,onclick:()=>pathReverse(L)})));
  if(!pathMaterial(P))box.append(colourBtn('pathColor',()=>L.fill.maps.base.c||ui.fg,c=>{if(lockStop({node:L}))return;matEdBegin(L);L.fill.maps.base={on:true,src:'value',c};fillRender(L);matEdCommit();},'Path colour'),
    el('button',{class:'btn sm',id:'pathMaterial',text:'Use selected library material',onclick:async()=>{if(matSel.kind!=='mat'){toast('Select a material in the Materials shelf.');showPanel('mats');return;}const r=matSel.rec;if(lockStop({node:L}))return;try{if(r.bundled)await gmLoad(r);const need=Object.keys(r.fill.maps).filter(k=>r.fill.maps[k].on&&MAP_DEFS[k]&&!doc.maps.includes(k)&&!(doc.workflow==='spec'&&(k==='rough'||k==='metal')));if(need.length)setDocMaps([...doc.maps,...need],'Path material channels');matEdBegin(L);L.fill=fillClone(r.fill);L.fill.coverH=false;L._fillImg=L._fillImg||{};for(const k in matRecTargets(r)){const t=r._t[k],copy=makeTarget(t.w,t.h,8,true);blit(t,copy,0,0,t.w,t.h,0,0);L._fillImg[k]=copy;}fillRender(L);matEdCommit();buildBrushPanel();}catch(e){toast('Could not load material: '+e.message);}}}));
  box.append(el('div',{class:'chips'},P.kind==='2d'?el('button',{class:'btn sm',id:'pathSelect',text:'Make selection',disabled:!P.closed||P.points.length<3,onclick:()=>selectPolygon(pathSamples(P,false).flatMap(a=>a.p),ui.selMode,'Path selection',true)}):null,el('button',{class:'btn sm',id:'pathDuplicate',text:'Duplicate path',onclick:cmdDuplicate}),el('button',{class:'btn sm',id:'pathDelete',text:'Delete path',onclick:cmdDelete})));
  box.append(el('div',{class:'sub',text:'Path layers'}),...allLayers().filter(n=>n.path?.kind===P.kind).map(n=>el('button',{class:'btn sm'+(n===L?' on':''),text:n.name,onclick:()=>{selectOnly(n);pathEdit.L=n;pathEdit.point=-1;pathEdit.drawing=false;changed(n);buildBrushPanel();}})));}
/* Capture path editing before ordinary painting/navigation, including rebuilt 3D panes. */
document.addEventListener('pointerdown',e=>{const hit=e.target.closest?.('#v3Hit')||(e.target===cv?stage:null);if(!hit)return;const kind=hit.id==='v3Hit'?'3d':'2d';if(pathDown(hit,e,kind)){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('pointermove',e=>{if(pathMove(e)){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('pointerup',e=>{if(pathUp(e,false)){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('pointercancel',e=>pathUp(e,true),true);window.addEventListener('blur',()=>{if(pathEdit.drag)pathUp({pointerId:pathEdit.drag.id},true);});window.addEventListener('keydown',e=>pathKeys(e),true);
{const dv=drawView;drawView=function(){dv();pathOverlay('2d');};const d3=draw3D;draw3D=function(){d3();pathOverlay('3d');};const pr=pathRender;pathRender=function(L){if(L.path.kind==='3d'&&pathValid(L))L._pathSamples=pathSamples(L.path,true);pr(L);};}
(function(){for(const [tool,label,icon] of [['material','Material brush','<path d="m5 17 9-9 3 3-9 9H5z"/><path d="M3 3h6v6H3zM15 3h6v4h-6z"/>'],['pen','Pen','<path d="m4 20 3-11 6-6 8 8-6 6zM7 9l8 8M4 20l7-7"/><circle cx="12" cy="12" r="1.5"/>'],['path','Surface Path','<path d="M4 17c0-12 16 12 16-10"/><rect x="2" y="15" width="4" height="4"/><rect x="18" y="5" width="4" height="4"/>']]){const b=el('button',{class:'tool','data-tool':tool,title:label,'aria-label':label,'aria-pressed':'false'});b.innerHTML='<svg viewBox="0 0 24 24">'+icon+'</svg>';b.onclick=()=>setTool(tool);$('#tools').insertBefore(b,$('#tools .tool[data-tool="text"]'));}})();
