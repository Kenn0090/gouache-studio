/* ================= Painting on the model =================
   With Paint on (3D view toolbar), dragging on the model paints. The brush stamps into a
   screen-sized buffer, exactly as it would on the canvas; then the model is drawn flat in its
   UV layout and every texel looks up where it sits on screen: if it is visible there (not
   hidden behind other parts, not facing away) it takes the brush's value. So the brush is round
   on screen, crosses UV seams cleanly, and lands on whatever the layer or map being painted is
   (in the Bake tab: the skew or offset map). Alt+drag turns the model, right-drag moves it. */
v3.paintOn=false;
const FS_3DDEPTH=`uniform vec3 uCamP; void main(){ o=vec4(length(vP-uCamP),0.0,0.0,1.0); }`;
const VS_3DPROJ=`#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aT;
uniform float uUVs; uniform vec2 uShift; uniform sampler2D uH; uniform float uDisp; uniform int uUseH;
out vec3 vP; out vec3 vN;
void main(){ vec2 t=aT*uUVs; vec3 p=aP; if(uUseH==1&&uDisp!=0.0){ float h=textureLod(uH,t,0.0).r-0.5; p+=aN*h*uDisp; }
  vP=p; vN=aN; vec2 q=t-uShift; gl_Position=vec4(q*2.0-1.0,0.0,1.0); }`;
/* uMir: for mirror and radial painting, the texel looks up the brush where its mirror image is (identity otherwise) */
const FS_3DPROJ=`in vec3 vP; in vec3 vN; uniform mat4 uVPm; uniform sampler2D uStroke; uniform highp sampler2D uDepth; uniform vec3 uCamP; uniform mat4 uMir;
void main(){ vec3 q=(uMir*vec4(vP,1.0)).xyz, nq=mat3(uMir)*vN; vec4 c=uVPm*vec4(q,1.0); if(c.w<=1e-6){ o=vec4(0); return; } vec2 s=c.xy/c.w*0.5+0.5;
  if(s.x<0.0||s.y<0.0||s.x>1.0||s.y>1.0){ o=vec4(0); return; }
  ivec2 ds=textureSize(uDepth,0); float z=texelFetch(uDepth,clamp(ivec2(s*vec2(ds)),ivec2(0),ds-1),0).r; float d=length(q-uCamP);
  if(z<=0.0||d>z*1.006+0.004){ o=vec4(0); return; }
  float f=abs(dot(normalize(nq),normalize(uCamP-q))); vec4 t=texture(uStroke,s); o=vec4(t.rgb,t.a*smoothstep(0.04,0.22,f)); }`;
const VS_3DD=VS_3D.replace('out vec3 vP; out vec3 vN; out vec2 vT; out vec4 vTan;','out vec3 vP; out vec3 vN; out vec2 vT; out vec4 vTan;');
let P3P=null;
function p3p(){if(!P3P)P3P={depth:prog3(VS_3DD,FS_3DDEPTH.replace('void main','in vec3 vP; in vec3 vN; in vec2 vT; in vec4 vTan;\nvoid main')),proj:prog3(VS_3DPROJ,FS_3DPROJ)};return P3P;}
function v3ViewProj(w,h){const s=v3s(),eye=v3Eye(),V=m4look(eye,[v3.cam.tx,v3.cam.ty,v3.cam.tz],[0,1,0]),Pm=m4persp(s.fov*Math.PI/180,w/h,.02,100);return {VP:m4mul(Pm,V),eye};}
/* the screen buffer the brush stamps into, and how far away the model is at each pixel */
function meshSpace(w,h){const P=p3p(),g=v3.gpu;if(!g)return null;let M=v3.mp;
  if(!M||M.w!==w||M.h!==h){if(M){disposeTarget(M.buf);gl.deleteFramebuffer(M.fb);gl.deleteTexture(M.dt);gl.deleteRenderbuffer(M.rb);}
    M={w,h,buf:makeTarget(w,h,doc.depth===16?16:8,false)};M.fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,M.fb);
    M.dt=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,M.dt);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,M.dt,0);M.rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,M.rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,M.rb);gl.bindFramebuffer(gl.FRAMEBUFFER,null);v3.mp=M;}
  const s=v3s(),bake=ui.mode==='bake',T=v3.tex,{VP,eye}=v3ViewProj(w,h),useH=!bake&&!!(T.height&&s.disp&&doc.maps.includes('height')),uvs=bake?1:s.uvs;
  gl.bindFramebuffer(gl.FRAMEBUFFER,M.fb);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);
  useProg(P.depth,{uVP:{m4:VP},uUVs:uvs,uH:useH?T.height.tex:dummy,uDisp:s.disp*.3,uUseH:useH,uCamP:eye});gl.bindVertexArray(g.vao);gl.drawElements(gl.TRIANGLES,g.count,gl.UNSIGNED_INT,0);gl.bindVertexArray(vao);
  gl.disable(gl.DEPTH_TEST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  const mirs=mir3Mats(),mesh=v3.mesh,R=ui.mode==='p3d'&&typeof p3Range==='function'?p3Range():{start:0,count:g.count/3};/* 3D Paint: only the active texture set takes paint */
  return {w,h,buf:M.buf,
    sync(){bindTarget(strokeT);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      for(const Mi of mirs){useProg(P.proj,{uVPm:{m4:VP},uStroke:M.buf.tex,uDepth:M.dt,uCamP:eye,uUVs:uvs,uH:useH?T.height.tex:dummy,uDisp:s.disp*.3,uUseH:useH,uMir:{m4:Mi}});
      bindTarget(strokeT);gl.enable(gl.BLEND);gl.blendEquation(gl.MAX);gl.blendFunc(gl.ONE,gl.ONE);gl.disable(gl.CULL_FACE);
      const loc=gl.getUniformLocation(P.proj.p,'uShift');gl.bindVertexArray(g.vao);
      for(let j=0;j<uvs;j++)for(let i=0;i<uvs;i++){gl.uniform2f(loc,i,j);gl.drawElements(gl.TRIANGLES,R.count*3,gl.UNSIGNED_INT,R.start*12);}}
      gl.bindVertexArray(vao);gl.blendEquation(gl.FUNC_ADD);gl.disable(gl.BLEND);},
    /* the part of the texture this stroke can have touched: triangles whose screen position meets the stroke */
    bbox(st){const b=st&&st.bb;if(!b||b[2]<b[0]||mirs.length>1)return [0,0,doc.w,doc.h];let x0=1,y0=1,x1=0,y1=0;const p=mesh.pos,uv=mesh.uv,ix=mesh.idx,n=p.length/3,sx=new Float32Array(n),sy=new Float32Array(n),ok=new Uint8Array(n);
      for(let i=0;i<n;i++){const X=p[i*3],Y=p[i*3+1],Z=p[i*3+2],cw=VP[3]*X+VP[7]*Y+VP[11]*Z+VP[15];if(cw<=1e-6)continue;ok[i]=1;sx[i]=((VP[0]*X+VP[4]*Y+VP[8]*Z+VP[12])/cw*.5+.5)*w;sy[i]=((VP[1]*X+VP[5]*Y+VP[9]*Z+VP[13])/cw*.5+.5)*h;}
      const pad=Math.max(8,(s.disp||0)*w*.2);
      for(let t=R.start*3;t<(R.start+R.count)*3;t+=3){const a=ix[t],c=ix[t+1],d=ix[t+2];if(!ok[a]||!ok[c]||!ok[d])continue;
        if(Math.max(sx[a],sx[c],sx[d])<b[0]-pad||Math.min(sx[a],sx[c],sx[d])>b[2]+pad||Math.max(sy[a],sy[c],sy[d])<b[1]-pad||Math.min(sy[a],sy[c],sy[d])>b[3]+pad)continue;
        for(const v of [a,c,d]){const u=uv[v*2]*uvs,vv=uv[v*2+1]*uvs;x0=Math.min(x0,u);y0=Math.min(y0,vv);x1=Math.max(x1,u);y1=Math.max(y1,vv);}}
      if(x1<x0)return [0,0,0,0];if(uvs>1||x0<0||y0<0||x1>1||y1>1)return [0,0,doc.w,doc.h];
      return [x0*doc.w-2,y0*doc.h-2,x1*doc.w+2,y1*doc.h+2];}};}
/* ---- pointer on the 3D view ---- */
const MESH_TOOLS=['brush','erase','dodge','burn'];
function meshPaintReady(e){return v3.paintOn&&MESH_TOOLS.includes(ui.tool)&&!e.altKey&&e.button===0&&v3.gpu&&v3.mesh&&!v3.mesh.noUV;}
function meshPt(hit,e){const r=hit.getBoundingClientRect();return [e.clientX-r.left,r.height-(e.clientY-r.top)];}
function meshDown(hit,e){if(stroke||preview||selLive)return false;if(typeof bk!=='undefined'&&bk.busy&&ui.mode==='bake'){toast('Wait for the bake to finish.');return true;}
  const et=ui.mode==='bake'?bakeEditTarget():editTarget(),o=paintOpts(et);if(!o)return true;
  const r=hit.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height)),sp=meshSpace(w,h);if(!sp)return true;
  o.space=sp;o.sym=null;const [x,y]=meshPt(hit,e),p=pressureOf(e);v3.mstroke={id:e.pointerId,sx:x,sy:y,sp:p,rx:x,ry:y};beginStroke(et.L,x,y,p,o);return true;}
function meshMove(hit,e){const m=v3.mstroke;if(!m||e.pointerId!==m.id||!stroke)return;const evs=e.getCoalescedEvents?e.getCoalescedEvents():[];const k=1-brush.smoothing*.93;
  for(const ev of (evs.length?evs:[e])){const [x,y]=meshPt(hit,ev),p=pressureOf(ev);m.rx=x;m.ry=y;m.sx+=(x-m.sx)*k;m.sy+=(y-m.sy)*k;m.sp+=(p-m.sp)*Math.max(k,.4);addPoint(m.sx,m.sy,m.sp);}}
function meshUp(e){const m=v3.mstroke;if(!m||(e&&e.pointerId!==m.id))return;v3.mstroke=null;if(stroke){if(brush.smoothing>0)addPoint(m.rx,m.ry,m.sp);endStroke(true);}}
/* round cursor showing the brush size over the model */
function meshCursor(hit,e){let c=v3.curEl;if(!c||!c.isConnected){c=v3.curEl=el('div',{class:'v3cur'});hit.parentNode.append(c);}
  if(!e||!v3.paintOn||!MESH_TOOLS.includes(ui.tool)){c.hidden=true;return;}const r=hit.getBoundingClientRect(),pr=hit.parentNode.getBoundingClientRect(),d=Math.max(3,brush.size);
  c.hidden=false;c.style.width=c.style.height=d+'px';c.style.transform='translate('+(e.clientX-pr.left-d/2)+'px,'+(e.clientY-pr.top-d/2)+'px)';}
/* ---- what is under the pointer: the model's UV there (and how far away), from a one-pixel render ---- */
const FS_3DPICK=`in vec3 vP; in vec3 vN; in vec2 vT; in vec4 vTan; uniform vec3 uCamP; uniform float uSet; void main(){ o=vec4(fract(vT),length(vP-uCamP),1.0+uSet); }`;
let P3PICK=null;
function v3PickAt(hit,e){const g=v3.gpu;if(!g||!v3.mesh)return null;if(!P3PICK)P3PICK=prog3(VS_3DD,FS_3DPICK);
  const r=hit.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height),px=e.clientX-r.left,py=h-(e.clientY-r.top);if(px<0||py<0||px>w||py>h)return null;
  let K=v3.pk;if(!K){K=v3.pk={};K.t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,K.t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,1,1,0,gl.RGBA,gl.FLOAT,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    K.fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,K.fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,K.t,0);
    K.rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,K.rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,1,1);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,K.rb);}
  const s=v3s(),bake=ui.mode==='bake'||ui.mode==='convert',T=v3.tex,{VP,eye}=v3ViewProj(w,h),useH=!bake&&!!(T.height&&s.disp&&doc.maps.includes('height')),uvs=bake?1:s.uvs;
  /* a projection that blows the pixel under the pointer up to the whole (1×1) target */
  const cx=2*px/w-1,cy=2*py/h-1,M=m4();M[0]=w;M[5]=h;M[10]=1;M[15]=1;M[12]=-w*cx;M[13]=-h*cy;const VPp=m4mul(M,VP);
  gl.bindFramebuffer(gl.FRAMEBUFFER,K.fb);gl.viewport(0,0,1,1);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);
  const rs=ui.mode==='p3d'&&v3.mesh.setRanges?v3.mesh.setRanges:[{start:0,count:g.count/3}];gl.bindVertexArray(g.vao);
  rs.forEach((R,k)=>{useProg(P3PICK,{uVP:{m4:VPp},uUVs:uvs,uH:useH?T.height.tex:dummy,uDisp:s.disp*.3,uUseH:useH,uCamP:eye,uSet:k});gl.drawElements(gl.TRIANGLES,R.count*3,gl.UNSIGNED_INT,R.start*12);});gl.bindVertexArray(vao);
  gl.disable(gl.DEPTH_TEST);const out=new Float32Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,out);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(out[3]<.5)return null;const dist=out[2],ray=v3Ray(w,h,px,py);return {uv:[out[0],out[1]],set:Math.round(out[3]-1),dist,pos:[eye[0]+ray[0]*dist,eye[1]+ray[1]*dist,eye[2]+ray[2]*dist],dir:ray,eye};}
/* the direction from the camera through a pixel of the view */
function v3Ray(w,h,px,py){const s=v3s(),eye=v3Eye(),c=v3.cam,f=norm3(sub3([c.tx,c.ty,c.tz],eye)),r=norm3(cross3(f,[0,1,0])),u=cross3(r,f),t=Math.tan(s.fov*Math.PI/360),x=(2*px/w-1)*t*w/h,y=(2*py/h-1)*t;
  return norm3([f[0]+r[0]*x+u[0]*y,f[1]+r[1]*x+u[1]*y,f[2]+r[2]*x+u[2]*y]);}
/* hold Alt over the model: its base colour there becomes the foreground colour (Alt+drag still turns) */
let v3PickQ=null;
function v3HoverPick(hit,e){if(ui.mode==='bake'||ui.mode==='convert'||stroke)return;const q={clientX:e.clientX,clientY:e.clientY};if(v3PickQ){v3PickQ.e=q;return;}v3PickQ={e:q};
  requestAnimationFrame(()=>{const ev=v3PickQ.e;v3PickQ=null;const p=v3PickAt(hit,ev);const t=p&&ui.mode==='p3d'&&typeof p3SetTex==='function'?p3SetTex(p.set,'base'):v3.tex.base;if(!p||!t)return;
    const x=clamp(Math.floor(p.uv[0]*t.w),0,t.w-1),y=clamp(Math.floor(p.uv[1]*t.h),0,t.h-1),d=captureRegionNow(t,x,y,1,1).data;
    let c=t.depth===16?(()=>{const L=h2fLut();return [L[d[0]],L[d[1]],L[d[2]],L[d[3]]];})():[d[0]/255,d[1]/255,d[2]/255,d[3]/255];
    if(c[3]<.02)return;c=[c[0]/c[3],c[1]/c[3],c[2]/c[3]].map(v=>clamp(v,0,1));if(toHex(c)!==toHex(ui.fg))setFG(c);});}

/* ---- mirror and radial painting on the model ----
   Mirrors across X, Y and/or Z planes (each can be moved off centre, snapping to the centre and to steps), and
   radial copies around an axis. The copies are matrices: every texel also takes the brush where its mirror image is. */
const mir3=Object.assign({x:false,y:false,z:false,off:[0,0,0],radial:0,axis:'y',snap:true,show:true},(()=>{try{return JSON.parse(localStorage.getItem('gs.mir3d')||'{}');}catch(e){return {};}})());
function mir3Save(){try{localStorage.setItem('gs.mir3d',JSON.stringify(mir3));}catch(e){}v3.dirty=true;requestRender();}
const mir3On=()=>mir3.x||mir3.y||mir3.z||mir3.radial>1;
function mir3Mats(){const I=()=>{const m=m4();m[0]=m[5]=m[10]=m[15]=1;return m;};let L=[I()];const o=mir3.off;
  ['x','y','z'].forEach((a,i)=>{if(!mir3[a])return;const R=I();R[i*5]=-1;R[12+i]=2*o[i];L=L.concat(L.map(M=>m4mul(R,M)));});
  const n=mir3.radial|0;if(n>1){const ax=['x','y','z'].indexOf(mir3.axis),out=[];
    for(let k=0;k<n;k++){const a=2*Math.PI*k/n,c=Math.cos(a),sn=Math.sin(a),R=I(),u=(ax+1)%3,v=(ax+2)%3;
      R[u*4+u]=c;R[v*4+u]=-sn;R[u*4+v]=sn;R[v*4+v]=c;/* rotate about the axis through the centre point */
      const T1=I(),T2=I();for(let j=0;j<3;j++){T1[12+j]=o[j];T2[12+j]=-o[j];}const Rk=m4mul(T1,m4mul(R,T2));for(const M of L)out.push(m4mul(Rk,M));}L=out;}
  return L.slice(0,32);}
/* the mirror planes on the model, as outlines */
let mir3VB=null;
function drawMir3(VP){if(!mir3.show||!(mir3.x||mir3.y||mir3.z)||!v3.mesh)return;const r=(v3.mesh.radius||1.2)*1.15,o=mir3.off,pts=[];
  ['x','y','z'].forEach((a,i)=>{if(!mir3[a])return;const u=(i+1)%3,v=(i+2)%3,c=[[-r,-r],[r,-r],[r,r],[-r,r]];
    for(let k=0;k<4;k++){const A=c[k],B=c[(k+1)%4];for(const P of [A,B]){const p=[0,0,0];p[i]=o[i];p[u]=P[0];p[v]=P[1];pts.push(...p);}}
    for(let t=-3;t<=3;t++){const q=t/4*r;for(const P of [[q,-r],[q,r],[-r,q],[r,q]]){const p=[0,0,0];p[i]=o[i];p[u]=P[0];p[v]=P[1];pts.push(...p);}}});
  if(!pts.length)return;if(!mir3VB){mir3VB={vao:gl.createVertexArray(),vb:gl.createBuffer()};}
  gl.bindVertexArray(mir3VB.vao);gl.bindBuffer(gl.ARRAY_BUFFER,mir3VB.vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pts),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
  for(const a of [1,2,3])gl.disableVertexAttribArray(a);gl.vertexAttrib3f(1,0,1,0);gl.vertexAttrib2f(2,0,0);gl.vertexAttrib4f(3,1,0,0,1);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  useProg(P3.line,{uVP:{m4:VP},uUVs:1,uH:dummy,uDisp:0,uUseH:false,uCol:[.35,.8,1,.55]});gl.drawArrays(gl.LINES,0,pts.length/3);
  gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(vao);}
/* the Mirror section (3D Paint panel, and the 3D view's settings in Paint) */
function mir3Box(){const box=el('div',{class:'dlg-grid',id:'mir3Box'}),redo=()=>{const n=mir3Box();box.replaceWith(n);};
  const tg=(k,l)=>el('button',{class:'optchip'+(mir3[k]?' on':''),id:'mir3_'+k,'aria-pressed':String(!!mir3[k]),text:l,onclick:()=>{mir3[k]=!mir3[k];mir3Save();redo();}});
  box.append(el('div',{class:'chips'},tg('x','Mirror X'),tg('y','Mirror Y'),tg('z','Mirror Z')));
  const snapV=v=>{if(Math.abs(v)<.025)return 0;return mir3.snap?Math.round(v/.05)*.05:v;};
  ['x','y','z'].forEach((a,i)=>{if(!mir3[a]&&!(mir3.radial>1))return;box.append(makeSlider({id:'mir3o_'+a,label:a.toUpperCase()+' plane',min:-1.2,max:1.2,step:.005,value:mir3.off[i],fmt:v=>v===0?'centre':(v>0?'+':'')+v.toFixed(2),
    onInput:v=>{mir3.off[i]=snapV(v);mir3Save();},onChange:()=>redo()}).el);});
  box.append(makeSlider({id:'mir3r',label:'Radial copies',min:1,max:16,step:1,value:Math.max(1,mir3.radial),fmt:v=>v<2?'off':v+'×',onInput:v=>{mir3.radial=v<2?0:v;mir3Save();},onChange:()=>redo()}).el);
  if(mir3.radial>1)box.append(seg([['x','Around X'],['y','Around Y'],['z','Around Z']],mir3.axis,v=>{mir3.axis=v;mir3Save();redo();},'Radial axis'));
  box.append(el('div',{class:'chips'},chk('mir3Snap','Snap planes',!!mir3.snap,v=>{mir3.snap=v;mir3Save();}),chk('mir3Show','Show planes',!!mir3.show,v=>{mir3.show=v;mir3Save();}),
    el('button',{class:'btn sm',text:'Centre',onclick:()=>{mir3.off=[0,0,0];mir3Save();redo();}})));
  return box;}
