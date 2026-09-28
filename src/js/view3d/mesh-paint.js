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
uniform int uSt; uniform sampler2D uStT; uniform vec2 uStC; uniform vec2 uStHalf; uniform float uStRot; uniform vec2 uScr; uniform int uStTile; uniform int uStInv;
void main(){ vec3 q=(uMir*vec4(vP,1.0)).xyz, nq=mat3(uMir)*vN; vec4 c=uVPm*vec4(q,1.0); if(c.w<=1e-6){ o=vec4(0); return; } vec2 s=c.xy/c.w*0.5+0.5;
  if(s.x<0.0||s.y<0.0||s.x>1.0||s.y>1.0){ o=vec4(0); return; }
  ivec2 ds=textureSize(uDepth,0); float z=texelFetch(uDepth,clamp(ivec2(s*vec2(ds)),ivec2(0),ds-1),0).r; float d=length(q-uCamP);
  if(z<=0.0||d>z*1.006+0.004){ o=vec4(0); return; }
  float f=abs(dot(normalize(nq),normalize(uCamP-q))); vec4 t=texture(uStroke,s);
  /* stencil: 1 = mask (light parts let paint through), 2 = colour (paints the picture itself) */
  if(uSt>0){ vec2 pp=s*uScr-uStC; float cr=cos(uStRot),sr=sin(uStRot); vec2 l=vec2(cr*pp.x-sr*pp.y,sr*pp.x+cr*pp.y)/(2.0*uStHalf)+0.5;
    if(uStTile==1) l=fract(l); else if(l.x<0.0||l.y<0.0||l.x>1.0||l.y>1.0){ o=vec4(0); return; }
    vec4 m=texture(uStT,vec2(l.x,1.0-l.y));/* pictures are stored top row first */ if(uSt==1){ float k=m.a>1e-5?dot(m.rgb/m.a,vec3(0.299,0.587,0.114))*m.a:0.0; t.a*=uStInv==1?1.0-k:k; } else { vec3 c=m.a>1e-5?m.rgb/m.a:vec3(0.0); t.rgb=uStInv==1?1.0-c:c; t.a*=m.a; } }
  o=vec4(t.rgb,t.a*smoothstep(0.04,0.22,f)); }`;
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
      const stU=st3Uniforms(w,h);for(const Mi of mirs){useProg(P.proj,Object.assign({uVPm:{m4:VP},uStroke:M.buf.tex,uDepth:M.dt,uCamP:eye,uUVs:uvs,uH:useH?T.height.tex:dummy,uDisp:s.disp*.3,uUseH:useH,uMir:{m4:Mi}},stU));
      bindTarget(strokeT);gl.enable(gl.BLEND);gl.blendEquation(gl.MAX);gl.blendFunc(gl.ONE,gl.ONE);gl.disable(gl.CULL_FACE);
      const loc=gl.getUniformLocation(P.proj.p,'uShift');gl.bindVertexArray(g.vao);
      for(let j=0;j<uvs;j++)for(let i=0;i<uvs;i++){gl.uniform2f(loc,i,j);gl.drawElements(gl.TRIANGLES,R.count*3,gl.UNSIGNED_INT,R.start*12);}}
      gl.bindVertexArray(vao);gl.blendEquation(gl.FUNC_ADD);gl.disable(gl.BLEND);},
    /* the part of the texture this stroke can have touched: triangles whose screen position meets the stroke */
    bbox(st){const b=st&&st.bb;if(!b||b[2]<b[0]||mirs.length>1)return [0,0,doc.w,doc.h];/* (a stencil only takes paint away, so the box still holds) */let x0=1,y0=1,x1=0,y1=0;const p=mesh.pos,uv=mesh.uv,ix=mesh.idx,n=p.length/3,sx=new Float32Array(n),sy=new Float32Array(n),ok=new Uint8Array(n);
      for(let i=0;i<n;i++){const X=p[i*3],Y=p[i*3+1],Z=p[i*3+2],cw=VP[3]*X+VP[7]*Y+VP[11]*Z+VP[15];if(cw<=1e-6)continue;ok[i]=1;sx[i]=((VP[0]*X+VP[4]*Y+VP[8]*Z+VP[12])/cw*.5+.5)*w;sy[i]=((VP[1]*X+VP[5]*Y+VP[9]*Z+VP[13])/cw*.5+.5)*h;}
      const pad=Math.max(8,(s.disp||0)*w*.2);
      for(let t=R.start*3;t<(R.start+R.count)*3;t+=3){const a=ix[t],c=ix[t+1],d=ix[t+2];if(!ok[a]||!ok[c]||!ok[d])continue;
        if(Math.max(sx[a],sx[c],sx[d])<b[0]-pad||Math.min(sx[a],sx[c],sx[d])>b[2]+pad||Math.max(sy[a],sy[c],sy[d])<b[1]-pad||Math.min(sy[a],sy[c],sy[d])>b[3]+pad)continue;
        for(const v of [a,c,d]){const u=uv[v*2]*uvs,vv=uv[v*2+1]*uvs;x0=Math.min(x0,u);y0=Math.min(y0,vv);x1=Math.max(x1,u);y1=Math.max(y1,vv);}}
      if(x1<x0)return [0,0,0,0];if(uvs>1||x0<0||y0<0||x1>1||y1>1)return [0,0,doc.w,doc.h];
      return [x0*doc.w-2,y0*doc.h-2,x1*doc.w+2,y1*doc.h+2];}};}
/* ---- pointer on the 3D view ---- */
const MESH_TOOLS=['brush','erase','dodge','burn','heal','clone'];
function meshPaintReady(e){return v3.paintOn&&MESH_TOOLS.includes(ui.tool)&&!e.altKey&&e.button===0&&v3.gpu&&v3.mesh&&!v3.mesh.noUV;}
function meshPt(hit,e){const r=hit.getBoundingClientRect();return [e.clientX-r.left,r.height-(e.clientY-r.top)];}
function meshDown(hit,e){if(stroke||preview||selLive)return false;if(typeof bk!=='undefined'&&bk.busy&&ui.mode==='bake'){toast('Wait for the bake to finish.');return true;}
  const et=ui.mode==='bake'?bakeEditTarget():editTarget(),o=paintOpts(et);if(!o)return true;
  const r=hit.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height)),sp=meshSpace(w,h);if(!sp)return true;
  if(o.tool==='heal'||o.tool==='clone'){const pk=v3PickAt(hit,e);if(!pk)return true;if(!healBegin(pk.uv[0]*doc.w,pk.uv[1]*doc.h,o.tool))return true;}
  o.space=sp;o.sym=null;const [x,y]=meshPt(hit,e),p=pressureOf(e);v3.mstroke={id:e.pointerId,sx:x,sy:y,sp:p,rx:x,ry:y};beginStroke(et.L,x,y,p,o);return true;}
function meshMove(hit,e){const m=v3.mstroke;if(!m||e.pointerId!==m.id||!stroke)return;const evs=e.getCoalescedEvents?e.getCoalescedEvents():[];const k=1-brush.smoothing*.93;
  for(const ev of (evs.length?evs:[e])){let [x,y]=meshPt(hit,ev);const p=pressureOf(ev);m.rx=x;m.ry=y;if(brush.lazy>0){const q=lazyStep(m,x,y,brush.lazy);if(!q)continue;x=q[0];y=q[1];}m.sx+=(x-m.sx)*k;m.sy+=(y-m.sy)*k;m.sp+=(p-m.sp)*Math.max(k,.4);addPoint(m.sx,m.sy,m.sp);}}
function meshUp(e){const m=v3.mstroke;if(!m||(e&&e.pointerId!==m.id))return;v3.mstroke=null;if(stroke){if(brush.smoothing>0)addPoint(m.rx,m.ry,m.sp);endStroke(true);}}
/* round cursor showing the brush size over the model */
function meshCursor(hit,e){let c=v3.curEl;if(!c||!c.isConnected){c=v3.curEl=el('div',{class:'v3cur'});hit.parentNode.append(c);}
  if(!e||!v3.paintOn||!MESH_TOOLS.includes(ui.tool)){c.hidden=true;return;}const r=hit.getBoundingClientRect(),pr=hit.parentNode.getBoundingClientRect(),d=Math.max(3,brush.size);
  c.hidden=false;c.style.width=c.style.height=d+'px';c.style.transform='translate('+(e.clientX-pr.left-d/2)+'px,'+(e.clientY-pr.top-d/2)+'px)';tipCursor(c,d);}
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
/* it picks when the pointer rests for a moment, not on every movement (each pick waits for the graphics card) */
let v3PickQ=null;
function v3HoverPick(hit,e){if(ui.mode==='bake'||ui.mode==='convert'||stroke||ui.tool==='heal'||ui.tool==='clone')return;const q={clientX:e.clientX,clientY:e.clientY};clearTimeout(v3PickQ);
  v3PickQ=setTimeout(()=>{const ev=q;v3PickQ=null;if(v3.drag||v3.mstroke||!v3.on)return;const p=v3PickAt(hit,ev);const t=p&&ui.mode==='p3d'&&typeof p3SetTex==='function'?p3SetTex(p.set,'base'):v3.tex.base;if(!p||!t)return;
    const x=clamp(Math.floor(p.uv[0]*t.w),0,t.w-1),y=clamp(Math.floor(p.uv[1]*t.h),0,t.h-1),d=captureRegionNow(t,x,y,1,1).data;
    let c=t.depth===16?(()=>{const L=h2fLut();return [L[d[0]],L[d[1]],L[d[2]],L[d[3]]];})():[d[0]/255,d[1]/255,d[2]/255,d[3]/255];
    if(c[3]<.02)return;c=[c[0]/c[3],c[1]/c[3],c[2]/c[3]].map(v=>clamp(v,0,1));if(toHex(c)!==toHex(ui.fg))setFG(c);},60);}

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
    for(const P of [[0,-r],[0,r],[-r,0],[r,0]]){const p=[0,0,0];p[i]=o[i];p[u]=P[0];p[v]=P[1];pts.push(...p);}});
  if(!pts.length)return;if(!mir3VB){mir3VB={vao:gl.createVertexArray(),vb:gl.createBuffer()};}
  gl.bindVertexArray(mir3VB.vao);gl.bindBuffer(gl.ARRAY_BUFFER,mir3VB.vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pts),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
  for(const a of [1,2,3])gl.disableVertexAttribArray(a);gl.vertexAttrib3f(1,0,1,0);gl.vertexAttrib2f(2,0,0);gl.vertexAttrib4f(3,1,0,0,1);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  useProg(P3.line,{uVP:{m4:VP},uUVs:1,uH:dummy,uDisp:0,uUseH:false,uCol:[.35,.8,1,.4]});gl.drawArrays(gl.LINES,0,pts.length/3);
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

/* ---- stencils (projection painting): a picture over the 3D view ----
   Mask: the brush paints only where the picture is light. Colour: the brush paints the picture's own colours.
   Hold S over the view: S+left-drag turns it, S+right-drag scales it, S+middle-drag moves it (like Substance Painter).
   Its place is kept relative to the view: centre (0..1 from the top left), height as a share of the view's height. */
const st3={img:null,name:'',mode:'mask',x:.5,y:.5,scale:.6,rot:0,show:.35,tile:false,invert:false,sKey:false,list:[]};
function st3Uniforms(w,h){if(!st3.img||st3.mode==='off')return {uSt:{int:0},uStT:dummy,uStC:[0,0],uStHalf:[1,1],uStRot:0,uScr:[w,h],uStTile:{int:0},uStInv:{int:0}};
  const S=st3.scale*h,a=st3.img.w/st3.img.h;return {uSt:{int:st3.mode==='colour'?2:1},uStT:st3.img.tex,uStC:[st3.x*w,(1-st3.y)*h],uStHalf:[S*a/2,S/2],uStRot:st3.rot*Math.PI/180,uScr:[w,h],uStTile:{int:st3.tile?1:0},uStInv:{int:st3.invert?1:0}};}
/* the picture shown over the view (a plain canvas, so it costs the GPU nothing) */
function st3Overlay(){const hit=document.getElementById('v3Hit');let c=st3.el;
  if(!hit||!st3.img||st3.mode==='off'||!st3.show){if(c)c.hidden=true;return;}
  if(!c||!c.isConnected){c=st3.el=el('canvas',{class:'v3stencil','aria-hidden':'true'});hit.parentNode.insertBefore(c,hit.nextSibling);st3.drawn=null;}
  if(st3.drawn!==st3.img){const w=Math.min(1024,st3.img.w),h=Math.round(w*st3.img.h/st3.img.w);c.width=w;c.height=h;const d=captureRegionNow(st3.img,0,0,st3.img.w,st3.img.h).data,src=document.createElement('canvas');src.width=st3.img.w;src.height=st3.img.h;
    const id=src.getContext('2d').createImageData(st3.img.w,st3.img.h);for(let i=0;i<d.length;i+=4){const a=d[i+3]||1;id.data[i]=d[i]*255/a;id.data[i+1]=d[i+1]*255/a;id.data[i+2]=d[i+2]*255/a;id.data[i+3]=d[i+3];}
    const sx=src.getContext('2d');sx.putImageData(id,0,0);const x=c.getContext('2d');x.clearRect(0,0,w,h);x.drawImage(src,0,0,w,h);st3.drawn=st3.img;}
  const r=hit.getBoundingClientRect(),pr=hit.parentNode.getBoundingClientRect(),S=st3.scale*r.height,a=st3.img.w/st3.img.h;
  c.hidden=false;c.style.width=S*a+'px';c.style.height=S+'px';c.style.opacity=String(st3.show);c.style.filter=st3.invert?'invert(1)':'';
  c.style.transform='translate('+(r.left-pr.left+st3.x*r.width-S*a/2)+'px,'+(r.top-pr.top+st3.y*r.height-S/2)+'px) rotate('+st3.rot+'deg)';}
async function st3Load(file){let t;try{t=await fileTarget(file);}catch(e){toast('Could not read '+file.name+': '+(e.message||e));return;}setWrap(t,true);st3Use(t,file.name);}
function st3Use(t,name){if(st3.img&&!st3.list.some(s=>s.t===st3.img))disposeTarget(st3.img);st3.img=t;st3.name=name;if(!st3.list.some(s=>s.t===t))st3.list.unshift({t,name});st3.list=st3.list.slice(0,12);
  if(st3.mode==='off')st3.mode='mask';st3Overlay();if(typeof buildP3Panel==='function'&&ui.mode==='p3d')buildP3Panel();}
function st3Clear(){st3.img=null;st3.name='';st3Overlay();if(ui.mode==='p3d')buildP3Panel();}
/* built-in stencils, drawn once */
function st3Builtin(kind){const N=512,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,N,N);x.fillStyle='#fff';x.strokeStyle='#fff';let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  if(kind==='dots'){for(let j=0;j<8;j++)for(let i=0;i<8;i++){x.beginPath();x.arc(32+i*64,32+j*64,20,0,7);x.fill();}}
  else if(kind==='stripes'){x.save();x.translate(N/2,N/2);x.rotate(Math.PI/4);for(let i=-N;i<N;i+=48)x.fillRect(i,-N,24,2*N);x.restore();}
  else if(kind==='scratches'){x.lineCap='round';for(let i=0;i<70;i++){x.lineWidth=.6+rnd()*2.2;x.globalAlpha=.4+rnd()*.6;const a=rnd()*Math.PI,l=40+rnd()*200,px=rnd()*N,py=rnd()*N;x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+Math.cos(a)*l/2+rnd()*20,py+Math.sin(a)*l/2,px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke();}}
  else{/* grunge: blotches over noise */const id=x.getImageData(0,0,N,N);for(let i=0;i<id.data.length;i+=4){const v=rnd()<.5?rnd()*90:0;id.data[i]=id.data[i+1]=id.data[i+2]=v;}x.putImageData(id,0,0);
    for(let i=0;i<260;i++){x.globalAlpha=.08+rnd()*.35;x.beginPath();x.arc(rnd()*N,rnd()*N,4+rnd()*46,0,7);x.fill();}}
  const tex=uploadStraight({el:c,w:N,h:N}),t=makeTarget(N,N,8,true);premultInto(t,tex,[0,0],null);gl.deleteTexture(tex);return t;}
const ST3_BUILTIN=[['grunge','Grunge'],['scratches','Scratches'],['dots','Dots'],['stripes','Stripes']];
function st3Box(){const box=el('div',{class:'dlg-grid',id:'st3Box'});
  const tiles=el('div',{class:'st3tiles'},...ST3_BUILTIN.map(([k,l])=>el('button',{class:'btn sm'+(st3.name===l?' on':''),text:l,id:'st3_'+k,onclick:()=>{const f=st3.list.find(s=>s.name===l);st3Use(f?f.t:st3Builtin(k),l);}})),
    ...st3.list.filter(s=>!ST3_BUILTIN.some(b=>b[1]===s.name)).map(s=>el('button',{class:'btn sm'+(st3.img===s.t?' on':''),text:s.name,title:s.name,onclick:()=>st3Use(s.t,s.name)})),
    el('button',{class:'btn sm',text:'Load image…',id:'st3Load',onclick:async()=>{const fs=await pickFiles('image/*',false,'Images',['png','jpg','jpeg','webp','tga','tif','tiff','bmp','psd','exr']);if(fs[0])st3Load(fs[0]);}}));
  box.append(tiles);
  if(st3.img){box.append(seg([['mask','Mask'],['colour','Colour'],['off','Off']],st3.mode,v=>{st3.mode=v;st3Overlay();buildP3Panel();},'Stencil mode'),
    el('p',{class:'note',text:st3.mode==='colour'?'The brush paints the picture’s own colours onto the model.':'The brush paints only where the picture is light.'}),
    makeSlider({id:'st3Show',label:'Show',min:0,max:1,step:.05,value:st3.show,fmt:pct,onInput:v=>{st3.show=v;st3Overlay();}}).el,
    makeSlider({id:'st3Scale',label:'Size',min:.05,max:4,step:.01,value:st3.scale,fmt:pct,onInput:v=>{st3.scale=v;st3Overlay();}}).el,
    makeSlider({id:'st3Rot',label:'Angle',min:-180,max:180,step:1,value:st3.rot,fmt:v=>v+'°',onInput:v=>{st3.rot=v;st3Overlay();}}).el,
    el('div',{class:'chips'},chk('st3Inv','Invert (X)',st3.invert,v=>{st3.invert=v;st3Overlay();}),chk('st3Tile','Repeat',st3.tile,v=>{st3.tile=v;}),el('button',{class:'btn sm',text:'Centre',onclick:()=>{Object.assign(st3,{x:.5,y:.5,rot:0});st3Overlay();buildP3Panel();}}),el('button',{class:'btn sm',text:'Remove',onclick:st3Clear})),
    el('p',{class:'note',text:'Hold S over the view: S+left-drag turns the stencil, S+right-drag scales it, S+middle-drag moves it.'}));}
  return box;}
/* S held over the 3D view moves the stencil instead of choosing the Smudge tool */
window.addEventListener('keydown',e=>{if((e.key==='s'||e.key==='S')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&st3.img&&v3.on&&v3.hover&&!isTypingTarget(e.target)){e.preventDefault();e.stopImmediatePropagation();st3.sKey=true;}},true);
window.addEventListener('keyup',e=>{if(e.key==='s'||e.key==='S')st3.sKey=false;},true);
/* X over the 3D view with a stencil: swap black and white (elsewhere X still swaps the colours) */
function st3Invert(){st3.invert=!st3.invert;st3Overlay();const c=document.getElementById('st3Inv');if(c)c.checked=st3.invert;toast(st3.invert?'Stencil inverted.':'Stencil back to normal.');}
window.addEventListener('keydown',e=>{if((e.key==='x'||e.key==='X')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&st3.img&&st3.mode!=='off'&&v3.on&&v3.hover&&!isTypingTarget(e.target)){e.preventDefault();e.stopImmediatePropagation();st3Invert();}},true);
function st3Drag(d,e,hit){const r=hit.getBoundingClientRect(),dx=e.clientX-d.x,dy=e.clientY-d.y;
  if(d.how==='stmove'){st3.x+=dx/r.width;st3.y+=dy/r.height;}
  else if(d.how==='stscale')st3.scale=clamp(st3.scale*Math.exp((dx-dy)*.005),.02,8);
  else{const cx=r.left+st3.x*r.width,cy=r.top+st3.y*r.height,a0=Math.atan2(d.y-cy,d.x-cx),a1=Math.atan2(e.clientY-cy,e.clientX-cx);st3.rot=((st3.rot+(a1-a0)*180/Math.PI+540)%360)-180;}
  st3Overlay();}
