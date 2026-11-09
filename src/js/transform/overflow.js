/* ================= Hidden pixels beyond the canvas (0.96.4, Kenn) =================
   "When I move an image outside of the canvas it deletes that portion" and "add a Delete cropped pixels".
   A layer keeps what falls outside the canvas in n.ext = {key: {t, ox, oy}} (key = a map, or EXT_MASK for its mask):
   a picture whose top-left corner sits at (ox, oy) in canvas pixels. Inside the canvas the layer itself is what
   counts (painting only changes that); the hidden picture only matters outside. Moving / transforming a whole layer
   and cropping work from the full picture (hidden + canvas) and keep what ends up outside again. Saved in .gouache. */
const EXT_MASK='@mask';
const extVis=(n,k)=>k===EXT_MASK?(n.mask&&n.mask.target):mapT(n,k);
const extOut=k=>k===EXT_MASK?[1,1,1,1]:[0,0,0,0];
function extAny(){return everyNode().some(n=>n.ext&&Object.keys(n.ext).length);}
function extFree(e){if(e)for(const k in e)if(e[k]&&e[k].t)disposeTarget(e[k].t);}
function extClearAll(){for(const n of everyNode()){extFree(n.ext);n.ext=null;}}
/* the full picture: the hidden part with the canvas on top. own = a new target the caller frees */
function extFull(n,k){const vis=extVis(n,k),e=n.ext&&n.ext[k];if(!vis)return null;if(!e)return {t:vis,ox:0,oy:0,own:false};
  const x0=Math.min(0,e.ox),y0=Math.min(0,e.oy),x1=Math.max(doc.w,e.ox+e.t.w),y1=Math.max(doc.h,e.oy+e.t.h);
  const t=makeTarget(x1-x0,y1-y0,vis.depth,false,vis.packed,vis.mono);clearTarget(t,extOut(k));
  blit(e.t,t,0,0,e.t.w,e.t.h,e.ox-x0,e.oy-y0);blit(vis,t,0,0,doc.w,doc.h,-x0,-y0);return {t,ox:x0,oy:y0,own:true};}
/* the box (canvas pixels) of what a layer's hidden picture holds, or null */
function extRect(n){const e=n.ext&&(n.ext.base||Object.values(n.ext)[0]);return e?[e.ox,e.oy,e.ox+e.t.w,e.oy+e.t.h]:null;}
function extAllRect(){let r=null;for(const n of everyNode()){const q=extRect(n);if(q)r=r?[Math.min(r[0],q[0]),Math.min(r[1],q[1]),Math.max(r[2],q[2]),Math.max(r[3],q[3])]:q;}return r;}
/* where a picture has paint: column and row projections (like contentBounds, for any size) */
let extProjT=null;
function extBounds(t){const n=Math.max(t.w,t.h);if(!extProjT||extProjT.w<n){disposeTarget(extProjT);extProjT=makeTargetRaw(n,1);}
  const read=(axis,len)=>{bindTarget(extProjT);gl.viewport(0,0,len,1);run(P.proj,extProjT,{uSrc:t.tex,uAxis:{int:axis},uAlphaOnly:true});
    const u=new Uint8Array(extProjT.w*4);gl.bindFramebuffer(gl.FRAMEBUFFER,extProjT.fbo);gl.readPixels(0,0,extProjT.w,1,gl.RGBA,gl.UNSIGNED_BYTE,u);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    let a=-1,b=-1;for(let i=0;i<len;i++)if(u[i*4]>127){if(a<0)a=i;b=i;}return a<0?null:[a,b+1];};
  const cx=read(0,t.w);if(!cx)return null;const cy=read(1,t.h);return cy?[cx[0],cy[0],cx[1],cy[1]]:null;}
/* draw a full picture through H (new canvas pixel → old canvas position) into a picture covering where it lands */
function extDraw(full,H,k,interp,box){const Hs=mul3([1,0,-full.ox,0,1,-full.oy,0,0,1],mul3(H,[1,0,box[0],0,1,box[1],0,0,1]));
  const w=box[2]-box[0],h=box[3]-box[1],t=makeTarget(w,h,full.t.depth,false,full.t.packed,full.t.mono);
  run(P.xform,t,{uSrc:full.t.tex,uH0:Hs.slice(0,3),uH1:Hs.slice(3,6),uH2:Hs.slice(6,9),uInterp:{int:interp},uSS:{int:1},uWrap:false,uRect:[0,0,0,0],uDoc:[w,h],uOutside:extOut(k),uBase:dummy,uUseBase:false});return t;}
/* after a move, transform or crop: what of each full picture now lies outside the canvas.
   fulls = {key: full}; H = new canvas pixel → old canvas position. Returns the new n.ext (or null) */
function extKeep(fulls,H,interp,cw,ch){cw=cw||doc.w;ch=ch||doc.h;const F=inv3(H);if(!F)return null;const b=fulls.base||Object.values(fulls)[0];if(!b)return null;
  /* where the content lands, from the paint in the base picture (masks follow the same box) */
  const cb=extBounds(b.t);if(!cb)return null;const pts=[[cb[0],cb[1]],[cb[2],cb[1]],[cb[2],cb[3]],[cb[0],cb[3]]].map(([x,y])=>apply3(F,x+b.ox,y+b.oy));
  let box=[Math.floor(Math.min(...pts.map(p=>p[0]))),Math.floor(Math.min(...pts.map(p=>p[1]))),Math.ceil(Math.max(...pts.map(p=>p[0]))),Math.ceil(Math.max(...pts.map(p=>p[1])))];
  if(box[0]>=0&&box[1]>=0&&box[2]<=cw&&box[3]<=ch)return null;/* nothing outside: nothing to keep */
  box=[box[0]-1,box[1]-1,box[2]+1,box[3]+1];if(box[2]-box[0]>MAX_DIM||box[3]-box[1]>MAX_DIM)return null;
  const out={};for(const k in fulls)out[k]={t:extDraw(fulls[k],H,k,interp,box),ox:box[0],oy:box[1]};return out;}

/* ---- canvas size: hidden pixels come back where the canvas grows ---- */
const FS_EXTPASTE=`uniform sampler2D uVis; uniform sampler2D uExt; uniform vec2 uOff; uniform vec4 uKeep;
void main(){ vec2 p=gl_FragCoord.xy; vec4 v=texelFetch(uVis,ivec2(p),0);
  if(p.x>=uKeep.x&&p.y>=uKeep.y&&p.x<uKeep.z&&p.y<uKeep.w){ o=v; return; }
  ivec2 q=ivec2(floor(p-uOff)),s=textureSize(uExt,0); if(any(lessThan(q,ivec2(0)))||any(greaterThanEqual(q,s))){ o=v; return; } o=texelFetch(uExt,q,0); }`;
let P_EXTPASTE=null;
function extAfterCanvasSize(dx,dy,oldW,oldH){if(!extAny())return;if(!P_EXTPASTE)P_EXTPASTE=program(FS_EXTPASTE);const keep=[dx,dy,dx+oldW,dy+oldH];
  for(const n of everyNode()){if(!n.ext)continue;for(const k in n.ext){const e=n.ext[k];e.ox+=dx;e.oy+=dy;const vis=extVis(n,k);if(!vis||vis.mono||vis.packed)continue;
      const t=acquireD(vis.depth);run(P_EXTPASTE,t,{uVis:vis.tex,uExt:e.t.tex,uOff:[e.ox,e.oy],uKeep:keep});blit(t,vis,0,0,doc.w,doc.h,0,0);release(t);}
    if(n.mask&&n.mask.stack)n.mask._key=null;scheduleThumb(n);}}
