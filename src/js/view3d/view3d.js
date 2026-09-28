/* ================= 3D view =================
   The model is drawn by the same GPU context as the canvas, so it uses the document's maps
   directly (no copying through the CPU). The canvas element spans the painting area and the
   3D pane; the 2D view draws first and the 3D picture is copied into the pane's part. */
const VS_3D=`#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aT; layout(location=3) in vec4 aTan;
uniform mat4 uVP; uniform float uUVs; uniform sampler2D uH; uniform float uDisp; uniform int uUseH;
out vec3 vP; out vec3 vN; out vec2 vT; out vec4 vTan;
void main(){ vec2 t=aT*uUVs; vec3 p=aP; if(uUseH==1&&uDisp!=0.0){ float h=textureLod(uH,t,0.0).r-0.5; p+=aN*h*uDisp; }
  vP=p; vN=aN; vT=t; vTan=aTan; gl_Position=uVP*vec4(p,1.0); }`;
const FS_3D=`in vec3 vP; in vec3 vN; in vec2 vT; in vec4 vTan;
uniform sampler2D uBase; uniform sampler2D uRough; uniform sampler2D uMetal; uniform sampler2D uNrm; uniform sampler2D uAO; uniform sampler2D uEmis; uniform sampler2D uOpac;
uniform int uFlipY; uniform int uHas; uniform vec2 uDef; uniform vec3 uCam; uniform vec3 uSun; uniform float uSunI; uniform float uSkyI; uniform float uExpo; uniform int uUnlit; uniform int uClip;
vec3 lin(vec3 c){ return pow(max(c,0.0),vec3(2.2)); }
vec3 sky(vec3 d){ float y=d.y; vec3 zen=vec3(0.32,0.45,0.72),hor=vec3(0.78,0.80,0.84),gnd=vec3(0.24,0.22,0.20);
  return y>0.0?mix(hor,zen,pow(y,0.6)):mix(hor,gnd,pow(-y,0.4)); }
void main(){ vec4 b=texture(uBase,vT); float a=b.a; if((uHas&64)!=0) a*=texture(uOpac,vT).r;
  if(uClip==1&&a<0.5) discard; vec3 alb=b.a>1e-5?b.rgb/b.a:vec3(0.0);
  if(uUnlit==1){ vec3 c=alb; if((uHas&8)!=0) c*=texture(uAO,vT).r; o=vec4(c,1.0); return; }
  alb=lin(alb);
  vec3 N=normalize(vN);
  if((uHas&4)!=0){ vec3 T=normalize(vTan.xyz-N*dot(N,vTan.xyz)), B=cross(N,T)*vTan.w; vec3 n=texture(uNrm,vT).rgb*2.0-1.0; N=normalize(T*n.x+B*n.y+N*n.z); }
  if(gl_FrontFacing==(uFlipY==1)) N=-N;
  float rough=clamp((uHas&1)!=0?texture(uRough,vT).r:uDef.x,0.04,1.0), metal=(uHas&2)!=0?texture(uMetal,vT).r:uDef.y, ao=(uHas&8)!=0?texture(uAO,vT).r:1.0;
  vec3 V=normalize(uCam-vP), L=normalize(uSun), H=normalize(L+V);
  float NdL=max(dot(N,L),0.0), NdV=max(dot(N,V),1e-3), NdH=max(dot(N,H),0.0), VdH=max(dot(V,H),0.0);
  float a2=pow(rough,4.0), dd=NdH*NdH*(a2-1.0)+1.0, D=a2/(3.14159*dd*dd);
  float k=(rough+1.0)*(rough+1.0)/8.0, G=(NdL/(NdL*(1.0-k)+k))*(NdV/(NdV*(1.0-k)+k));
  vec3 F0=mix(vec3(0.04),alb,metal), F=F0+(1.0-F0)*pow(1.0-VdH,5.0);
  vec3 spec=D*G*F/max(4.0*NdL*NdV,1e-3), dif=(1.0-F)*(1.0-metal)*alb/3.14159;
  vec3 col=(dif+spec)*NdL*uSunI*3.0;
  /* sky light: blurry reflections for rough surfaces, sharp for smooth ones */
  vec3 R=reflect(-V,N); vec3 Fr=F0+(max(vec3(1.0-rough),F0)-F0)*pow(1.0-NdV,5.0);
  vec3 envS=mix(sky(R),mix(sky(N),vec3(0.55),0.5),rough*rough), envD=mix(sky(N),vec3(0.5),0.35);
  col+=(envD*alb*(1.0-metal)+envS*Fr)*uSkyI*ao;
  if((uHas&16)!=0) col+=lin(texture(uEmis,vT).rgb)*2.0;
  col*=uExpo; col=col/(1.0+col*0.12); o=vec4(pow(clamp(col,0.0,1.0),vec3(1.0/2.2)),1.0); }`;
const FS_3DLINE=`uniform vec4 uCol; void main(){ o=uCol; }`;
const VS_UV=`#version 300 es
layout(location=2) in vec2 aT; uniform vec2 uOrigin; uniform vec2 uExtent; uniform vec2 uViewport; uniform vec2 uShift;
void main(){ vec2 p=uOrigin+(aT+uShift)*uExtent; gl_Position=vec4(p.x/uViewport.x*2.0-1.0,1.0-p.y/uViewport.y*2.0,0.0,1.0); }`;
function prog3(vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,FS_HEAD+fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return {p,locs:{}};}
const FS_3DSEL=`in vec3 vP; in vec3 vN; in vec2 vT; in vec4 vTan; uniform sampler2D uSel; void main(){ float m=texture(uSel,fract(vT)).r; if(m<0.02) discard; o=vec4(1.0,0.62,0.22,0.32*m); }`;
const P3={mesh:prog3(VS_3D,FS_3D),line:prog3(VS_3D,FS_3DLINE),uv:prog3(VS_UV,FS_3DLINE),sel:prog3(VS_3D,FS_3DSEL)};

/* ---- settings (kept in the document) ---- */
const V3D_DEFAULTS={model:'plane',detail:0,unlit:null,uvs:1,disp:0,sunAz:40,sunEl:45,sunI:1,skyI:1,expo:1,bg:'dark',clip:true,wire:false,showUV:false,spin:false,fov:40};
const v3={on:false,mesh:null,gpu:null,tex:{},cam:{yaw:.5,pitch:.25,dist:3.2,tx:0,ty:0,tz:0},dirty:true,mapsDirty:true,editDirty:true,lastFull:0,fbo:null,imported:null};
function v3s(){if(!doc.v3d)doc.v3d=Object.assign({},V3D_DEFAULTS);return doc.v3d;}
const v3Unlit=()=>{const s=v3s();return s.unlit==null?doc.maps.length<2:s.unlit;};

/* ---- mesh on the GPU ---- */
function v3Upload(m){const g=v3.gpu;if(g){gl.deleteVertexArray(g.vao);gl.deleteBuffer(g.vb);gl.deleteBuffer(g.ib);gl.deleteBuffer(g.eb);gl.deleteVertexArray(g.evao);}
  const n=m.verts,d=new Float32Array(n*12);for(let i=0;i<n;i++){d.set(m.pos.subarray(i*3,i*3+3),i*12);d.set(m.nrm.subarray(i*3,i*3+3),i*12+3);d.set(m.uv.subarray(i*2,i*2+2),i*12+6);d.set(m.tan.subarray(i*4,i*4+4),i*12+8);}
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);
  const at=(i,sz,o)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,sz,gl.FLOAT,false,48,o*4);};at(0,3,0);at(1,3,3);at(2,2,6);at(3,4,8);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.idx,gl.STATIC_DRAW);
  const edges=meshEdges(m),evao=gl.createVertexArray();gl.bindVertexArray(evao);gl.bindBuffer(gl.ARRAY_BUFFER,vb);at(0,3,0);at(1,3,3);at(2,2,6);at(3,4,8);
  const eb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,edges,gl.STATIC_DRAW);
  gl.bindVertexArray(vao);v3.gpu={vao,vb,ib,eb,evao,count:m.idx.length,ecount:edges.length};}
function v3SetMesh(m,keepCam){v3.mesh=m;meshGroupByMat(m);v3Upload(m);gl.bindVertexArray(vao);if(!keepCam)v3Frame();v3.dirty=true;requestRender();refresh3dUI();if(ui.mode==='p3d'&&typeof p3SyncSets==='function'){p3SyncSets();buildP3Panel();}if(v3s().showUV)requestRender();}
function v3LoadModel(keepCam){const s=v3s();if(s.model==='dplane'){s.model='plane';s.detail=Math.max(s.detail||0,5);}
  if(s.model==='imported'&&v3.imported)meshGroupByMat(v3.imported);/* grouped before subdividing, so triangles keep their order */
  const m=s.model==='imported'&&v3.imported?subdivideMesh(v3.imported,s.detail||0):primMesh(PRIMS[s.model]?s.model:'plane',s.detail||0);v3SetMesh(m,keepCam);}

/* ---- maps as textures for the model: the map being painted updates every frame, the rest a few times a second ---- */
function v3MapTex(k,src){let t=v3.tex[k];if(!t||t.w!==doc.w||t.h!==doc.h||t.depth!==src.depth){if(t)disposeTarget(t);t=v3.tex[k]=makeTarget(doc.w,doc.h,src.depth,true);}
  blit(src,t,0,0,doc.w,doc.h,0,0);gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  if(anisoExt)gl.texParameterf(gl.TEXTURE_2D,anisoExt.TEXTURE_MAX_ANISOTROPY_EXT,8);return t;}
const anisoExt=gl.getExtension('EXT_texture_filter_anisotropic');
function v3Needed(){if(v3Unlit())return doc.maps.filter(k=>k==='base'||k==='ao');return doc.maps.filter(k=>k!=='normal'&&k!=='height'&&k!=='curv').concat(doc.maps.includes('height')||doc.maps.includes('normal')?['nfinal']:[]);}
function v3Refresh(){if(!v3.on)return;if(ui.mode==='bake'){bakeV3Refresh();return;}if(ui.mode==='convert'){cvV3Refresh();return;}const now=performance.now(),full=v3.mapsDirty&&(!stroke||now-v3.lastFull>150);
  const plain=doc.view===doc.map&&compOut&&ui.mode!=='anim';
  const one=k=>{if(k==='nfinal'){const t=normalComposite(false,null);v3MapTex(k,t);release(t);return;}
    if(k===doc.map&&plain){v3MapTex(k,compOut);return;}
    if(ui.mode==='anim'&&k==='base'){v3MapTex(k,compOut);return;}
    const t=compositeMap(k);v3MapTex(k,t);release(t);};
  if(full){for(const k of v3Needed())one(k);if(v3s().disp&&doc.maps.includes('height')){const t=compositeMap('height');v3MapTex('height',t);release(t);}
    v3.mapsDirty=false;v3.editDirty=false;v3.lastFull=now;v3.dirty=true;v3SgDerive();}
  else if(v3.editDirty){const k=ui.mode==='anim'?'base':doc.map;if(v3Needed().includes(k))one(k);if(k==='height'&&stroke&&now-v3.lastFull>150){one('nfinal');}v3.editDirty=false;v3.dirty=true;if(['base','spec','gloss'].includes(k))v3SgDerive();}}
/* Specular/Gloss documents shade the model with the equivalent base/metal/rough */
function v3SgDerive(){if(doc.workflow!=='spec'||!v3.tex.base||ui.mode==='anim')return;const T=v3.tex,r=sgAsMR(T.base,doc.maps.includes('spec')?T.spec:null,doc.maps.includes('gloss')?T.gloss:null);
  v3MapTex('sgBase',r.base);v3MapTex('sgMetal',r.metal);v3MapTex('sgRough',r.rough);for(const k in r)release(r[k]);}
/* called by composite(): the document changed */
function v3Changed(){if(!v3.on)return;v3.editDirty=true;v3.mapsDirty=true;}

/* ---- camera ---- */
const m4=()=>new Float32Array(16);
function m4persp(f,a,n,fa){const o=m4(),t=1/Math.tan(f/2);o[0]=t/a;o[5]=t;o[10]=(fa+n)/(n-fa);o[11]=-1;o[14]=2*fa*n/(n-fa);return o;}
function m4look(e,c,u){const z=norm3(sub3(e,c)),x=norm3(cross3(u,z)),y=cross3(z,x),o=m4();o[0]=x[0];o[4]=x[1];o[8]=x[2];o[1]=y[0];o[5]=y[1];o[9]=y[2];o[2]=z[0];o[6]=z[1];o[10]=z[2];
  o[12]=-dot3(x,e);o[13]=-dot3(y,e);o[14]=-dot3(z,e);o[15]=1;return o;}
function m4mul(a,b){const o=m4();for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+i]*b[j*4+k];o[j*4+i]=s;}return o;}
const sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm3=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
function v3Eye(){const c=v3.cam,cp=Math.cos(c.pitch);return [c.tx+Math.sin(c.yaw)*cp*c.dist,c.ty+Math.sin(c.pitch)*c.dist,c.tz+Math.cos(c.yaw)*cp*c.dist];}
function v3Frame(){const r=v3.mesh?v3.mesh.radius:1.5,pane=v3.pop?null:$('#pane3d'),asp=pane&&pane.clientHeight?Math.min(1,pane.clientWidth/pane.clientHeight):1,f=2*Math.atan(Math.tan(v3s().fov*Math.PI/360)*asp);Object.assign(v3.cam,{tx:0,ty:0,tz:0,dist:r/Math.sin(f/2)*1.08});
  if(v3s().model==='plane'||v3s().model==='dplane'){v3.cam.yaw=0;v3.cam.pitch=0;}v3.dirty=true;}

/* ---- drawing ---- */
function v3Targets(w,h){let F=v3.fbo;if(F&&F.w===w&&F.h===h)return F;
  if(F){gl.deleteFramebuffer(F.ms);gl.deleteRenderbuffer(F.c);gl.deleteRenderbuffer(F.d);gl.deleteFramebuffer(F.rf);gl.deleteRenderbuffer(F.rc);}
  const S=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)||0);F={w,h};
  F.ms=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,F.ms);
  F.c=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,F.c);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,S,gl.RGBA8,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,F.c);
  F.d=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,F.d);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,S,gl.DEPTH_COMPONENT24,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,F.d);
  F.rf=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,F.rf);F.rc=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,F.rc);gl.renderbufferStorage(gl.RENDERBUFFER,gl.RGBA8,w,h);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,F.rc);gl.bindFramebuffer(gl.FRAMEBUFFER,null);v3.fbo=F;v3.dirty=true;return F;}
const BG3={dark:[.09,.1,.115],grey:[.32,.33,.35],light:[.78,.79,.81]};
function v3Render(F,flip){const s=v3s(),g=v3.gpu;if(!g)return;
  /* 3D Paint's per-set list is made before drawing starts (it may create textures, which binds other framebuffers) */
  const pre=ui.mode==='p3d'&&typeof p3DrawList==='function'?p3DrawList():null;
  /* mask view (Alt+click a mask): the active layer's mask on the model, black and white, unlit */
  const mv=ui.mode!=='bake'&&ui.mode!=='convert'&&typeof maskViewTex==='function'?maskViewTex():null;
  gl.bindFramebuffer(gl.FRAMEBUFFER,F.ms);gl.viewport(0,0,F.w,F.h);const bg=BG3[s.bg]||BG3.dark;gl.clearColor(bg[0],bg[1],bg[2],1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  const eye=v3Eye(),V=m4look(eye,[v3.cam.tx,v3.cam.ty,v3.cam.tz],[0,1,0]),Pm=m4persp(s.fov*Math.PI/180,F.w/F.h,.02,100);if(flip)Pm[5]=-Pm[5];const VP=m4mul(Pm,V);
  const bake=(ui.mode==='bake'||ui.mode==='convert')&&v3.btex,sg=!bake&&doc.workflow==='spec'&&v3.tex.sgBase&&ui.mode!=='anim'&&!v3Unlit();
  const T0=bake?v3.btex:sg?Object.assign({},v3.tex,{base:v3.tex.sgBase,metal:v3.tex.sgMetal,rough:v3.tex.sgRough}):v3.tex;
  const a=s.sunAz*Math.PI/180,e=s.sunEl*Math.PI/180;
  const common={uVP:{m4:VP},uUVs:bake?1:s.uvs,uH:T0.height&&s.disp?T0.height.tex:dummy,uDisp:s.disp*.3,uUseH:!!(!bake&&T0.height&&s.disp&&doc.maps.includes('height'))};
  /* one draw per texture set in 3D Paint (each with its own maps), else the whole model with the document's maps */
  let list=!bake&&pre?pre:[{T:T0,start:0,count:g.count/3}];
  if(mv){const R=ui.mode==='p3d'&&typeof p3Range==='function'?p3Range():null;list=list.map(it=>!R||it.start===R.start?{T:{base:mv},start:it.start,count:it.count,unlit:true}:it);}
  if(s.wire){gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);}gl.bindVertexArray(g.vao);
  for(const it of list){const T=it.T||{},base=T.base||null;if(!base||!it.count)continue;
    const ok=k=>T[k]&&(bake||(sg&&(k==='rough'||k==='metal'))||(k==='nfinal'?doc.maps.includes('height')||doc.maps.includes('normal'):doc.maps.includes(k)));
    const hm=(ok('rough')?1:0)|(ok('metal')?2:0)|(ok('nfinal')?4:0)|(ok('ao')?8:0)|(ok('emis')?16:0)|(ok('opac')?64:0);
    useProg(P3.mesh,Object.assign({},common,{uH:T.height&&s.disp?T.height.tex:dummy,uBase:base.tex,uRough:ok('rough')?T.rough.tex:dummy,uMetal:ok('metal')?T.metal.tex:dummy,uNrm:ok('nfinal')?T.nfinal.tex:dummy,uAO:ok('ao')?T.ao.tex:dummy,uEmis:ok('emis')?T.emis.tex:dummy,uOpac:ok('opac')?T.opac.tex:dummy,
      uHas:{int:hm},uDef:[mapDefault('rough')[0],mapDefault('metal')[0]],uCam:eye,uSun:[Math.cos(e)*Math.sin(a),Math.sin(e),Math.cos(e)*Math.cos(a)],uSunI:s.sunI,uSkyI:s.skyI,uExpo:s.expo,uUnlit:it.unlit?true:bake?!!v3.bunlit:v3Unlit(),uFlipY:!!flip,uClip:!it.unlit&&!!s.clip}));
    gl.drawElements(gl.TRIANGLES,it.count*3,gl.UNSIGNED_INT,it.start*12);}
  gl.disable(gl.POLYGON_OFFSET_FILL);
  /* the selection, tinted on the model (3D Paint, or while painting on the model) */
  if(!bake&&sel.active&&!sel.quick&&sel.t&&(ui.mode==='p3d'||v3.paintOn)){const R=ui.mode==='p3d'&&typeof p3Range==='function'?p3Range():{start:0,count:g.count/3};
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);useProg(P3.sel,Object.assign({},common,{uSel:sel.t.tex}));gl.bindVertexArray(g.vao);
    gl.drawElements(gl.TRIANGLES,R.count*3,gl.UNSIGNED_INT,R.start*12);gl.depthMask(true);gl.disable(gl.BLEND);}
  if(s.wire){useProg(P3.line,Object.assign({},common,{uCol:[.95,.7,.35,1]}));gl.bindVertexArray(g.evao);gl.drawElements(gl.LINES,g.ecount,gl.UNSIGNED_INT,0);}
  if(bake)bakeDrawCage(common);
  if(!bake&&(v3.paintOn||ui.mode==='p3d'))drawMir3(VP);
  gl.bindVertexArray(vao);gl.disable(gl.DEPTH_TEST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,F.ms);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,F.rf);gl.blitFramebuffer(0,0,F.w,F.h,0,0,F.w,F.h,gl.COLOR_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
/* after the 2D view: refresh maps if needed, redraw the model if anything changed, copy it into the pane */
function draw3D(){if(!v3.on)return;if(v3.pop){drawPop();return;}const pane=$('#pane3d'),d=dprNow(),w=Math.max(1,Math.round(pane.clientWidth*d)),h=cv.height,x0=cv.width-w;
  if(!v3.mesh)v3LoadModel();v3Refresh();const F=v3Targets(w,h);
  if(v3.dirty){v3Render(F);v3.dirty=false;}
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,F.rf);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);gl.blitFramebuffer(0,0,w,h,x0,0,x0+w,h,gl.COLOR_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(v3s().spin&&!v3.drag){v3.cam.yaw+=.006;v3.dirty=true;requestRender();}}
/* the model's UV layout over the 2D canvas */
function drawUVOverlay(){if(!v3.on||!v3s().showUV||!v3.gpu)return;const d=dprNow(),z=view.zoom;
  bindTarget(null);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.bindVertexArray(v3.gpu.evao);
  const reps=doc.wrap?[-1,0,1]:[0];for(const sx of reps)for(const sy of reps){useProg(P3.uv,{uOrigin:[view.x*d,view.y*d],uExtent:[doc.w*z*d,doc.h*z*d],uViewport:[cv.width,cv.height],uShift:[sx,sy],uCol:sx||sy?[1,.75,.35,.25]:[1,.75,.35,.8]});
    gl.drawElements(gl.LINES,v3.gpu.ecount,gl.UNSIGNED_INT,0);}
  gl.bindVertexArray(vao);gl.disable(gl.BLEND);}

/* ---- the pane: toolbar, settings, camera controls ---- */
$('#btn3d').addEventListener('click',()=>toggle3D());
function toggle3D(on){v3.on=on===undefined?!v3.on:!!on;$('#btn3d').setAttribute('aria-pressed',String(v3.on));const pane=$('#pane3d'),sp=$('#split3d'),work=$('#work');
  if(v3.on&&ui.mode==='anim'&&false)return;
  if(!v3.on&&v3.pop)pop3D(false,true);
  pane.hidden=!v3.on||!!v3.pop;sp.hidden=!v3.on||!!v3.pop;let w=320;try{w=+localStorage.getItem('gs.pane3d')||0;}catch(e){}if(!w)w=Math.round(work.clientWidth*.42);
  const full=v3.on&&!v3.pop&&work.classList.contains('v3full');if(full)sp.hidden=true;
  work.style.setProperty('--pane3d',full?'100%':v3.on&&!v3.pop?clamp(w,200,work.clientWidth-200)+'px':'0px');sp.style.right=v3.on?'calc(var(--pane3d) - 3px)':'';
  if(v3.on){if(!v3.pop)build3dPane();v3.mapsDirty=true;v3.editDirty=true;v3.dirty=true;if(!v3.mesh)v3LoadModel();}
  resizeGL();fit();requestRender(true);}
function build3dPane(){const pane=v3.pop?v3.pop.box:$('#pane3d'),s=v3s();pane.replaceChildren();
  const models=el('select',{id:'v3Model','aria-label':'Model'},...Object.entries(PRIMS).map(([k,[l]])=>el('option',{value:k,text:l})),
    ...(v3.imported?[el('option',{value:'imported',text:v3.imported.name})]:[]),el('option',{value:'__import',text:'Import a model (OBJ, glTF, GLB, FBX)…'}));
  models.value=s.model;models.onchange=()=>{if(models.value==='__import'){models.value=s.model;importModel();return;}s.model=models.value;v3LoadModel();};
  /* mesh density: in the toolbar, since height only shows on a dense mesh */
  const detSel=el('select',{id:'v3Det','aria-label':'Mesh detail',title:'Mesh detail: more triangles let Height depth push the surface out finely'},...['Low','×2','×4','×8','×16','×32','×64','×128'].map((l,i)=>el('option',{value:i,text:'Detail '+l})));
  detSel.value=String(s.detail||0);detSel.onchange=()=>{s.detail=+detSel.value;v3LoadModel(true);};v3.detSel=detSel;
  const tog=(id,label,key,title)=>{const b=el('button',{class:'btn sm'+(s[key]?' on':''),id,text:label,title,'aria-pressed':String(!!s[key])});b.onclick=()=>{s[key]=!s[key];b.classList.toggle('on',s[key]);b.setAttribute('aria-pressed',String(s[key]));v3.dirty=true;requestRender();};return b;};
  const shade=seg([['lit','Lit'],['unlit','Unlit']],v3Unlit()?'unlit':'lit',x=>{s.unlit=x==='unlit';v3.mapsDirty=true;v3.dirty=true;requestRender(true);},'Shading');
  const gear=el('button',{class:'btn sm',text:'Settings',id:'v3Gear','aria-expanded':'false'});
  const dock=el('button',{class:'btn sm',text:v3.pop?'Dock':'Pop out',id:'v3Pop',title:v3.pop?'Put the 3D view back beside the canvas':'Open the 3D view in its own window (for a second screen)'});dock.onclick=()=>pop3D(!v3.pop);
  const close=el('button',{class:'btn sm',text:'×',title:'Close the 3D view (F3)','aria-label':'Close the 3D view'});close.onclick=()=>{if(ui.mode==='p3d')p3SetLayout('2d');else toggle3D(false);};
  const pbtn=el('button',{class:'btn sm'+(v3.paintOn?' on':''),id:'v3Paint',text:'Paint',title:'Paint on the model with the brush (Alt+drag turns it, right-drag moves it)','aria-pressed':String(v3.paintOn)});
  pbtn.onclick=()=>{v3.paintOn=!v3.paintOn;pbtn.classList.toggle('on',v3.paintOn);pbtn.setAttribute('aria-pressed',String(v3.paintOn));if(v3.paintOn&&!MESH_TOOLS.includes(ui.tool))setTool('brush');refresh3dUI();};
  const inBake=ui.mode==='bake',lowLab=inBake?el('span',{class:'v3lab',text:'Low-poly: '+bkLow().name,title:'Choose the low-poly in the Bake panel'}):null;
  const bar=el('div',{class:'v3bar'},...(inBake?[lowLab]:ui.mode==='convert'?[models,detSel]:[models,detSel,shade]),...(ui.mode==='convert'||ui.mode==='p3d'?[]:[pbtn]),tog('v3Wire','Wireframe','wire','Show the mesh edges'),tog('v3UV','UVs','showUV','Draw the model’s UV layout over your canvas'),tog('v3Spin','Turntable','spin','Spin the model slowly'),gear,dock,close);
  const box=el('div',{class:'v3set',hidden:true});
  const S=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:s[key],fmt,onInput:v=>{s[key]=v;if(key==='disp'){v3.mapsDirty=true;if(v>0&&(s.detail||0)<4&&!v3.detAuto){v3.detAuto=true;s.detail=4;if(v3.detSel)v3.detSel.value='4';v3LoadModel(true);toast('Mesh detail raised to ×16 so the height can show. Change it with the Detail menu at the top of the 3D view.');}}v3.dirty=true;requestRender(key==='disp');}}).el;
  box.append(S('v3Uvs','Tile repeat','uvs',1,8,1,v=>v+'×'),S('v3Disp','Height depth','disp',0,1,.01,pct),S('v3Az','Sun angle','sunAz',0,360,1,deg),S('v3El','Sun height','sunEl',0,90,1,deg),
    S('v3Si','Sun strength','sunI',0,3,.05,pct),S('v3Ki','Sky strength','skyI',0,3,.05,pct),S('v3Ex','Exposure','expo',.2,3,.05,pct),S('v3Fov','Lens','fov',15,90,1,v=>v+'°'),
    el('div',{class:'sub',text:'Background'}),seg([['dark','Dark'],['grey','Grey'],['light','Light']],s.bg,x=>{s.bg=x;v3.dirty=true;requestRender();},'Background'),
    chk('v3Clip','Cut out transparent areas',!!s.clip,x=>{s.clip=x;v3.dirty=true;requestRender();}),
    ...(ui.mode==='p3d'||ui.mode==='bake'||ui.mode==='convert'?[]:[el('div',{class:'sub',text:'Mirror painting on the model'}),mir3Box(),el('div',{class:'sub',text:'Select on the model'}),sel3Box()]),
    el('p',{class:'note',text:'Drag to turn, right-drag to move, wheel to zoom, double-click to reframe. Raise Detail (top of the 3D view) to see Height depth push the surface out finely; imported models are subdivided.'}));
  gear.onclick=()=>{box.hidden=!box.hidden;gear.setAttribute('aria-expanded',String(!box.hidden));};
  const info=el('div',{class:'v3info',id:'v3Info'});v3.infoEl=info;
  const hit=el('div',{class:'v3hit',id:'v3Hit'});
  pane.append(hit,bar,box,info);refresh3dUI();v3Controls(hit);st3.el=null;requestAnimationFrame(st3Overlay);}
function refresh3dUI(){const i=v3.infoEl;if(!i||!v3.mesh)return;const m=v3.mesh;i.textContent=m.name+' · '+m.tris.toLocaleString()+' triangles'+(m.noUV?' · this model has no UVs, so textures cannot map onto it':v3.paintOn?' · painting: '+v3NavHint()+'; hold Alt over the model to pick its colour':'');}
/* ---- navigation: Substance Painter style (default) or 3D-Coat style (Preferences, or the 3D Paint panel) ----
   Substance: Alt+left turns, Alt+middle moves, Alt+right zooms; middle or right drag also moves; left paints.
   3D-Coat: right-drag turns (Shift+right moves, Ctrl+right zooms), middle moves, left paints on the model and turns off it.
   With painting off, left-drag turns in both. Holding Alt over the model (no button) picks its colour. */
const v3nav={mode:(()=>{try{return localStorage.getItem('gs.nav3d')||'substance';}catch(e){return 'substance';}})()};
function setNav3d(m){v3nav.mode=m;try{localStorage.setItem('gs.nav3d',m);}catch(e){}refresh3dUI();}
const v3CanPaint=()=>v3.paintOn&&MESH_TOOLS.includes(ui.tool)&&!!v3.gpu&&!!v3.mesh&&!v3.mesh.noUV;
function v3NavHint(){return v3nav.mode==='coat'?'right-drag turns, middle moves, Ctrl+right zooms':'Alt+left turns, Alt+middle moves, Alt+right zooms';}
function v3NavOf(hit,e){const b=e.button,paint=v3CanPaint();
  if(st3.sKey&&st3.img)return b===0?'strot':b===2?'stscale':'stmove';
  if(v3nav.mode==='coat'){if(b===2)return e.ctrlKey?'zoom':e.shiftKey?'pan':'turn';if(b===1)return 'pan';if(e.altKey)return 'turn';
    if(paint)return v3PickAt(hit,e)?'paint':'turn';return e.shiftKey?'pan':'turn';}
  if(e.altKey)return b===1?'pan':b===2?'zoom':'turn';
  if(b===1||b===2)return 'pan';if(paint)return 'paint';return e.shiftKey?'pan':'turn';}
function v3Controls(hit){hit.addEventListener('contextmenu',e=>e.preventDefault());
  hit.addEventListener('pointerdown',e=>{if(v3.mstroke&&!stroke)v3.mstroke=null;/* a stroke that never started must not block turning */
    if(v3.mstroke&&v3.mstroke.id!==e.pointerId)meshUp();/* one whose release was missed is finished now */v3.drag=null;
    e.preventDefault();/* no text selection or native drag from here: a double-click used to select text, and the next press dragged it, taking the mouse away */
    try{hit.setPointerCapture(e.pointerId);}catch(er){}
    /* mask mode: Paint must be on to paint; Box, Lasso and Polygon draw shapes */
    /* the projection gizmo (a material or mask row projected from 3D) */
    if(e.button===0&&!e.altKey&&!st3.sKey&&pgzDown(hit,e))return;
    if(e.button===0&&!e.altKey&&!st3.sKey&&(maskToolsOn()||liveOn())&&mk3Down(hit,e))return;
    let how=v3NavOf(hit,e);
    if(how==='paint'){if(e.button===0&&meshDown(hit,e)&&v3.mstroke)return;how='turn';if(stroke)return;}
    v3.drag={x:e.clientX,y:e.clientY,how,id:e.pointerId,x0:e.clientX,y0:e.clientY,alt:e.altKey&&e.button===0};});
  hit.addEventListener('pointermove',e=>{if(pgz.drag){if(!e.buttons){pgzUp();return;}pgzMove(hit,e);return;}if(!e.buttons&&pgzHover(hit,e)){meshCursor(hit,null);return;}if(mk3Busy()){mk3Move(hit,e);return;}meshCursor(hit,e);
    /* no button held any more: the release went missing (another window, a pen gesture, Alt menu mode); finish instead of sticking */
    if(!e.buttons){if(v3.mstroke)meshUp();if(v3.drag)v3.drag=null;}
    if(v3.mstroke){meshMove(hit,e);return;}const d=v3.drag;
    if(!d){if(e.altKey&&!e.buttons)v3HoverPick(hit,e);return;}
    if(d.how.startsWith('st')){st3Drag(d,e,hit);d.x=e.clientX;d.y=e.clientY;return;}
    const dx=e.clientX-d.x,dy=e.clientY-d.y;d.x=e.clientX;d.y=e.clientY;const c=v3.cam;
    if(d.how==='pan'){const k=c.dist*.0018,eye=v3Eye(),f=norm3(sub3([c.tx,c.ty,c.tz],eye)),r=norm3(cross3(f,[0,1,0])),u=cross3(r,f);c.tx+=(-r[0]*dx+u[0]*dy)*k;c.ty+=(-r[1]*dx+u[1]*dy)*k;c.tz+=(-r[2]*dx+u[2]*dy)*k;}
    else if(d.how==='zoom')c.dist=clamp(c.dist*Math.exp((dy-dx)*.006),.2,50);
    else{c.yaw-=dx*.008;c.pitch=clamp(c.pitch+dy*.008,-1.55,1.55);}v3.dirty=true;requestRender();});
  const up=e=>{if(pgz.drag){pgzUp();return;}if(mk3Busy()&&e.type!=='lostpointercapture'){mk3Up(e);return;}if(v3.drag&&e.pointerId!==undefined&&v3.drag.id!==e.pointerId)return;v3.drag=null;meshUp(e);};
  hit.addEventListener('pointerup',up);hit.addEventListener('pointercancel',up);hit.addEventListener('lostpointercapture',up);hit.addEventListener('pointerleave',()=>{v3.hover=false;meshCursor(hit,null);});hit.addEventListener('pointerenter',()=>{v3.hover=true;});
  hit.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();v3.cam.dist=clamp(v3.cam.dist*Math.exp(e.deltaY*.0012),.2,50);v3.dirty=true;requestRender();},{passive:false});
  for(const t of ['selectstart','dragstart'])hit.parentNode.addEventListener(t,e=>e.preventDefault());
  hit.addEventListener('dblclick',e=>{const s=window.getSelection&&window.getSelection();if(s&&s.rangeCount)s.removeAllRanges();if(maskToolsOn()&&mk3.tool&&mk3.tool!=='paint')return;if(typeof p3SelectAt==='function'&&p3SelectAt(hit,e))return;v3Frame();requestRender();});}
/* a release anywhere (or the window losing focus) ends turning and painting on the model */
window.addEventListener('pointerup',e=>{if(v3.drag&&v3.drag.id===e.pointerId){const d=v3.drag;v3.drag=null;
    /* the heal brush: Alt+click on the model (without turning it) sets where to copy from */
    if(d.alt&&(ui.tool==='heal'||ui.tool==='clone')&&Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<4){const hit=document.getElementById('v3Hit'),pk=hit&&v3PickAt(hit,e);
      if(pk){if(ui.tool==='heal'&&heal.mode==='spot'){heal.mode='source';healSave();buildBrushPanel();buildOptBar();}healSetSource(pk.uv[0]*doc.w,pk.uv[1]*doc.h,ui.mode==='p3d'?pk.set:null);}}}if(v3.mstroke&&v3.mstroke.id===e.pointerId)meshUp(e);},true);
window.addEventListener('blur',()=>{v3.drag=null;if(v3.mstroke)meshUp();});
/* Alt on its own must not hand the keyboard to the window menu (Windows), which made the model seem locked */
for(const t of ['keydown','keyup'])window.addEventListener(t,e=>{if(e.key==='Alt')e.preventDefault();},true);
/* dragging the divider */
(()=>{const sp=$('#split3d'),work=$('#work');let d=null;
  sp.addEventListener('pointerdown',e=>{sp.setPointerCapture(e.pointerId);d={x:e.clientX,w:$('#pane3d').clientWidth};});
  sp.addEventListener('pointermove',e=>{if(!d)return;const w=clamp(d.w-(e.clientX-d.x),200,work.clientWidth-200);work.style.setProperty('--pane3d',w+'px');resizeGL();requestRender();});
  sp.addEventListener('pointerup',()=>{if(!d)return;d=null;try{localStorage.setItem('gs.pane3d',String($('#pane3d').clientWidth));}catch(e){}});})();

/* ---- importing a model ---- */
async function v3DropModel(files){const f=files.find(x=>isModelName(x.name));if(!f)return;loadStart(f.name);
  try{const m=await parseModelFile(f,files);v3.imported=m;v3s().model='imported';if(!v3.on)toggle3D(true);v3SetMesh(m);build3dPane();toast('Loaded “'+m.name+'”: '+m.tris.toLocaleString()+' triangles.'+(m.noUV?' It has no UVs, so the textures cannot map onto it.':''));}
  catch(e){console.warn(e);toast('This model could not be loaded: '+(e.message||e));}finally{loadEnd();}}
async function importModel(){const done=m=>{v3.imported=m;v3s().model='imported';v3SetMesh(m);build3dPane();toast('Loaded “'+m.name+'”: '+m.tris.toLocaleString()+' triangles.'+(m.noUV?' It has no UVs, so the textures cannot map onto it.':''));};
  if(platform.isDesktop){try{const p=await platform.openDialog([{name:'3D models',extensions:['obj','glb','gltf','fbx','OBJ','GLB','GLTF','FBX']}]);if(!p)return;loadStart(fileNameOf(p));
      try{const bytes=await platform.readFile(p);const dir=p.replace(/[\\/][^\\/]*$/,''),sep=p.includes('\\')?'\\':'/';
        done(await parseModelBytes(fileNameOf(p),bytes,async u=>{const b=await platform.readFile(dir+sep+u);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}));}finally{loadEnd();}}
    catch(e){console.warn(e);toast('This model could not be loaded: '+(e.message||e));}return;}
  const f=el('input',{type:'file',accept:'.obj,.glb,.gltf,.fbx',multiple:true});f.onchange=async()=>{const fs=[...f.files],file=fs.find(x=>isModelName(x.name));if(!file)return;loadStart(file.name);
    try{done(await parseModelFile(file,fs));}catch(e){console.warn(e);toast('This model could not be loaded: '+(e.message||e));}finally{loadEnd();}};f.click();}
/* ---- its own window (second screen): the GPU draws it here and the picture is copied into that window ---- */
function pop3D(out,quiet){if(out){if(v3.pop)return;const w=window.open('about:blank','gouache3d','width=960,height=720');
    if(!w){toast('The window could not be opened.');return;}
    const d=w.document;d.title='Gouache Studio — 3D view';for(const s of document.querySelectorAll('style,link[rel=stylesheet]'))d.head.append(d.importNode(s,true));
    d.body.style.cssText='margin:0;background:#16181c;overflow:hidden;height:100vh';
    const c=d.createElement('canvas');c.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';const box=d.createElement('div');box.style.cssText='position:absolute;inset:0';
    d.body.append(c,box);v3.pop={win:w,cv:c,ctx:c.getContext('2d'),box,busy:false};
    w.addEventListener('resize',()=>{v3.dirty=true;requestRender();});
    w.addEventListener('pagehide',()=>{if(v3.pop&&v3.pop.win===w&&!v3.pop.closing)pop3D(false);});
    build3dPane();toggle3D(true);v3.dirty=true;requestRender(true);if(!quiet)toast('3D view is in its own window. Press Dock there (or close it) to bring it back.');}
  else{const p=v3.pop;if(!p)return;p.closing=true;v3.pop=null;try{p.win.close();}catch(e){}if(v3.on){toggle3D(true);}}}
function drawPop(){const p=v3.pop;if(p.win.closed){pop3D(false);return;}const dpr=p.win.devicePixelRatio||1,w=Math.max(1,Math.round(p.win.innerWidth*dpr)),h=Math.max(1,Math.round(p.win.innerHeight*dpr));
  if(p.cv.width!==w||p.cv.height!==h){p.cv.width=w;p.cv.height=h;v3.dirty=true;}
  if(!v3.mesh)v3LoadModel();v3Refresh();const F=v3Targets(w,h);
  if(v3.dirty&&!p.busy){v3Render(F,true);v3.dirty=false;p.busy=true;
    asyncRead(F.rf,0,0,w,h,gl.UNSIGNED_BYTE,Uint8Array,w*h*4,buf=>{p.busy=false;if(v3.pop!==p||p.cv.width!==w||p.cv.height!==h){requestRender();return;}
      p.ctx.putImageData(new ImageData(new Uint8ClampedArray(buf.buffer),w,h),0,0);if(v3.dirty)requestRender();});}
  if(v3s().spin&&!v3.drag){v3.cam.yaw+=.006;v3.dirty=true;requestRender();}}
