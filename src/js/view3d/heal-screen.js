/* ================= Heal and clone on the model, from the surface as seen on screen (0.97.27, Georgian via Kenn) =================
   "It's sampling from the flat texture and getting info from the random UV islands close to the open border at the neck. It needs a
   continuous texture built kinda screen space, and sampling from that."
   On the flat texture, clone and heal copy from the texture shifted by an offset; on a model that offset crosses UV seams into other
   pieces of the layout. On the model they now work like this:
     1. a picture of the view tells, for each screen pixel, which texture pixel of the active set is there (scrSUV, full size)
     2. a picture of the texture tells, for each texture pixel, where it sits on screen (scrTS)
     3. each texture pixel under the stroke looks up its screen spot, moves by the offset ON SCREEN, and copies the texture pixel
        the model shows there (scrShift). Neighbours on screen are neighbours on the surface, so seams and open borders no longer
        pull in unrelated pieces.
   The offset: Alt+click a source on the model (it is kept as a point of the model, so turning the camera afterwards is fine);
   spot healing picks a nearby spot on the model beside the stroke by itself. */
const hscr={ctx:null};
const VS_SCRTS=VS_3D.replace('out vec3 vP;','out vec4 vC; out vec3 vP;').replace('gl_Position=uVP*vec4(p,1.0);','vC=uVP*vec4(p,1.0); gl_Position=vec4(t*2.0-1.0,0.0,1.0);');
const FS_SCRTS=`in vec4 vC; in vec3 vP; in vec3 vN; in vec2 vT; in vec4 vTan; uniform vec2 uScr; uniform vec3 uCamP; uniform int uOrtho; uniform vec3 uFwd; uniform float uSet;
void main(){ if(vC.w<=0.0){ o=vec4(0.0); return; } vec2 nd=vC.xy/vC.w; o=vec4((nd*0.5+0.5)*uScr, uOrtho==1?dot(vP-uCamP,uFwd):length(vP-uCamP), 1.0+uSet); }`;
/* texture pixels at the edge of a UV piece that no triangle covers take a neighbour's spot */
const FS_SCRDIL=`uniform sampler2D uSrc;
void main(){ ivec2 q=ivec2(gl_FragCoord.xy), sz=textureSize(uSrc,0); vec4 c=texelFetch(uSrc,q,0); if(c.a>0.5){ o=c; return; }
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ vec4 n=texelFetch(uSrc,clamp(q+ivec2(i,j),ivec2(0),sz-1),0); if(n.a>0.5){ o=n; return; } } o=c; }`;
/* the source picture of one map (uWhich 0) and where it is known (uWhich 1) */
const FS_SCRSH=`uniform sampler2D uT; uniform sampler2D uTS; uniform sampler2D uSUV; uniform vec2 uOffS; uniform float uSet; uniform int uWhich;
bool suvAt(vec2 s, out vec2 uv){ ivec2 sz=textureSize(uSUV,0); if(s.x<0.0||s.y<0.0||s.x>=float(sz.x)||s.y>=float(sz.y)) return false;
  vec4 n=texelFetch(uSUV,ivec2(floor(s)),0); if(abs(n.a-(1.0+uSet))>0.25) return false;
  vec2 f=s-0.5; ivec2 i0=ivec2(floor(f)); vec2 w=fract(f);
  vec4 a=texelFetch(uSUV,clamp(i0,ivec2(0),sz-1),0), b=texelFetch(uSUV,clamp(i0+ivec2(1,0),ivec2(0),sz-1),0), c=texelFetch(uSUV,clamp(i0+ivec2(0,1),ivec2(0),sz-1),0), d=texelFetch(uSUV,clamp(i0+ivec2(1,1),ivec2(0),sz-1),0);
  bool same=abs(a.a-n.a)<0.25&&abs(b.a-n.a)<0.25&&abs(c.a-n.a)<0.25&&abs(d.a-n.a)<0.25;
  float spread=max(max(length(a.xy-n.xy),length(b.xy-n.xy)),max(length(c.xy-n.xy),length(d.xy-n.xy)));
  /* smooth between screen pixels on one piece; at a seam (the texture jumps) the nearest pixel */
  uv = same&&spread<0.02 ? mix(mix(a.xy,b.xy,w.x),mix(c.xy,d.xy,w.x),w.y) : n.xy; return true; }
void main(){ ivec2 q=ivec2(gl_FragCoord.xy); vec4 ts=texelFetch(uTS,q,0); vec2 uv; bool ok=ts.a>0.5&&abs(ts.a-(1.0+uSet))<0.25&&suvAt(ts.xy+uOffS,uv);
  if(uWhich==1){ o=vec4(ok?1.0:0.0); return; } o= ok ? texture(uT,uv) : texelFetch(uT,q,0); }`;
let P_SCRTS=null,P_SCRDIL=null,P_SCRSH=null;
function scrF32(w,h,depth){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,null);
  for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
  const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);let rb=null;
  if(depth){rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);}
  return {tex:t,fbo,rb,w,h};}
function scrFree32(t){if(!t)return;gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.fbo);if(t.rb)gl.deleteRenderbuffer(t.rb);}
function scrFree(){const c=hscr.ctx;if(!c)return;scrFree32(c.suv);scrFree32(c.ts);hscr.ctx=null;}
/* the screen point of a point of the model (pixels from the bottom-left of the 3D view) */
function scrProject(VP,p,W,H){const x=VP[0]*p[0]+VP[4]*p[1]+VP[8]*p[2]+VP[12],y=VP[1]*p[0]+VP[5]*p[1]+VP[9]*p[2]+VP[13],w=VP[3]*p[0]+VP[7]*p[1]+VP[11]*p[2]+VP[15];
  if(w<=1e-6)return null;return [(x/w*.5+.5)*W,(y/w*.5+.5)*H];}
/* at the start of a heal or clone stroke on the model: the two pictures, and the offset on screen */
function scrBegin(hit,e,tool){scrFree();if(window.__oldHeal)return;/* tests: the old texture-shift way */const g=v3.gpu,m=v3.mesh;if(!g||!m||ui.mode!=='p3d')return;
  const r=hit.getBoundingClientRect(),W=Math.max(1,Math.round(r.width)),H=Math.max(1,Math.round(r.height)),s=v3s(),T=v3.tex,{VP,eye}=v3ViewProj(W,H);
  const useH=!!(T.height&&s.disp&&doc.maps.includes('height')),uvs=p3.udim||p3.ua?1:s.uvs,fwd=norm3(sub3([v3.cam.tx,v3.cam.ty,v3.cam.tz],eye));
  const rs=m.setRanges||[{start:0,count:g.count/3}],A=typeof p3Range==='function'?p3Range():null,ai=A?Math.max(0,rs.findIndex(R=>R.start===A.start&&R.count===A.count)):0;
  if(!P3PICK)P3PICK=prog3(VS_3DD,FS_3DPICK);if(!P_SCRTS){P_SCRTS=prog3(VS_SCRTS,FS_SCRTS);P_SCRDIL=program(FS_SCRDIL);P_SCRSH=program(FS_SCRSH);}
  const fb0=gl.getParameter(gl.FRAMEBUFFER_BINDING),vp0=gl.getParameter(gl.VIEWPORT);
  const suv=scrF32(W,H,true),ts=scrF32(doc.w,doc.h,false),tmp=scrF32(doc.w,doc.h,false);
  try{const common={uVP:{m4:VP},uUVs:uvs,uH:useH?T.height.tex:dummy,uDisp:s.disp*.3,uUseH:useH,uUseUDIM:!!p3.udim,uCamP:eye,uOrtho:{int:s.ortho?1:0},uFwd:fwd};
    gl.bindVertexArray(g.vao);
    /* 1. the view: texture position, distance and set under each screen pixel */
    gl.bindFramebuffer(gl.FRAMEBUFFER,suv.fbo);gl.viewport(0,0,W,H);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);
    rs.forEach((R,k)=>{useProg(P3PICK,Object.assign({uSet:k},common));gl.drawElements(gl.TRIANGLES,R.count*3,gl.UNSIGNED_INT,R.start*12);});
    gl.disable(gl.DEPTH_TEST);
    /* 2. the texture: where each texture pixel of the active set sits on screen */
    gl.bindFramebuffer(gl.FRAMEBUFFER,tmp.fbo);gl.viewport(0,0,doc.w,doc.h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.CULL_FACE);
    const R=rs[ai];useProg(P_SCRTS,Object.assign({uSet:ai,uScr:[W,H]},common));gl.drawElements(gl.TRIANGLES,R.count*3,gl.UNSIGNED_INT,R.start*12);
    gl.bindVertexArray(vao);run(P_SCRDIL,ts,{uSrc:tmp.tex});run(P_SCRDIL,tmp,{uSrc:ts.tex});run(P_SCRDIL,ts,{uSrc:tmp.tex});}
  finally{scrFree32(tmp);gl.bindVertexArray(vao);gl.bindFramebuffer(gl.FRAMEBUFFER,fb0);gl.viewport(vp0[0],vp0[1],vp0[2],vp0[3]);}
  const start=[e.clientX-r.left,r.height-(e.clientY-r.top)];
  let off=null;
  if(tool==='clone'||heal.mode==='source'){if(heal.aligned&&heal.offS)off=heal.offS.slice();
    else if(heal.srcPos){const q=scrProject(VP,heal.srcPos,W,H);if(q)off=[q[0]-start[0],q[1]-start[1]];}
    if(off)heal.offS=off.slice();}
  hscr.ctx={suv,ts,W,H,set:ai,off,tool,spot:tool==='heal'&&heal.mode!=='source',pts:[start],r,R:scrBrushR(H),VP};}
/* the brush radius on screen, roughly */
function scrBrushR(H){try{return Math.max(6,(brush.size||24)*.5*meshBrushScale(H));}catch(e){return 20;}}
window.addEventListener('pointermove',e=>{const c=hscr.ctx;if(!c||!stroke||!c.r)return;c.pts.push([e.clientX-c.r.left,c.r.height-(e.clientY-c.r.top)]);if(c.pts.length>600)c.pts.splice(1,c.pts.length-600);},true);
/* the context for this stroke (heal.js asks for it); spot healing finds its offset now */
function scrHealCtx(s){const c=hscr.ctx;if(!c||ui.mode!=='p3d')return null;if(c.spot&&!c.off)c.off=scrSpotOffset(c);return c;}
/* spot healing on the model: a spot beside the stroke where the model continues (same set, same depth), across from the stroke */
function scrSpotOffset(c){const W=c.W,H=c.H,d=new Float32Array(W*H*4);gl.bindFramebuffer(gl.FRAMEBUFFER,c.suv.fbo);gl.readPixels(0,0,W,H,gl.RGBA,gl.FLOAT,d);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  const at=(x,y)=>{x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=W||y>=H)return null;const i=(y*W+x)*4;return Math.abs(d[i+3]-(1+c.set))<.25?d[i+2]:null;};
  const P=c.pts,n=P.length,cx=P.reduce((a,p)=>a+p[0],0)/n,cy=P.reduce((a,p)=>a+p[1],0)/n,R=c.R;
  const ext=Math.max(R,...P.map(p=>Math.hypot(p[0]-cx,p[1]-cy)+R));
  const dir=n>1?norm3([P[n-1][0]-P[0][0],P[n-1][1]-P[0][1],0]):[1,0,0],perp=[-dir[1],dir[0]];
  /* points to test: the stroke and a ring around each of its points */
  const S=[];const step=Math.max(1,Math.floor(n/24));for(let i=0;i<n;i+=step){const p=P[i];S.push(p);for(let k=0;k<6;k++){const a=k*Math.PI/3;S.push([p[0]+Math.cos(a)*R*.8,p[1]+Math.sin(a)*R*.8]);}}
  const base=S.map(p=>at(p[0],p[1])),tol=(v3.mesh?.radius||1)*.15;let best=null;
  for(const k of [1.15,1.6,2.2])for(let j=0;j<8;j++){const a=j*Math.PI/4,v=[Math.cos(a)*perp[0]-Math.sin(a)*perp[1],Math.sin(a)*perp[0]+Math.cos(a)*perp[1]],o=[v[0]*ext*k,v[1]*ext*k];
    let ok=0,cnt=0;for(let i=0;i<S.length;i++){if(base[i]==null)continue;cnt++;const z=at(S[i][0]+o[0],S[i][1]+o[1]);if(z!=null&&Math.abs(z-base[i])<tol)ok++;}
    const f=cnt?ok/cnt:0,score=f-(j%4===0?0:.02)-k*.01;if(!best||score>best.score)best={o,score,f};}
  return best&&best.f>=.6?best.o:null;}
/* one map's source picture: for each texture pixel under the stroke, the texture pixel the model shows at its screen spot + offset */
function scrShift(c,src,depth){if(!c||!c.off)return null;const v=acquireD(depth||src.depth||doc.depth),ok=acquireD(8);
  const U={uT:src.tex,uTS:c.ts.tex,uSUV:c.suv.tex,uOffS:c.off,uSet:c.set};run(P_SCRSH,v,Object.assign({uWhich:{int:0}},U));run(P_SCRSH,ok,Object.assign({uWhich:{int:1}},U));return {v,ok};}
/* a new stroke starts fresh; the pictures go when the stroke is done */
{const f=endStroke;endStroke=function(){try{return f.apply(this,arguments);}finally{if(!stroke)scrFree();}};}
