/* ================= Targets ================= */
function texFmt(depth){return depth===16?{i:gl.RGBA16F,t:gl.HALF_FLOAT}:{i:gl.RGBA8,t:gl.UNSIGNED_BYTE};}
function makeTarget(w,h,depth,wrap){
  depth=depth||doc.depth; if(wrap===undefined)wrap=doc.wrap;
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);const F=texFmt(depth);
  gl.texImage2D(gl.TEXTURE_2D,0,F.i,w,h,0,gl.RGBA,F.t,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  const wm=wrap?gl.REPEAT:gl.CLAMP_TO_EDGE;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wm);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wm);
  const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  const t={tex,fbo,w,h,depth,mipDirty:true};clearTarget(t);return t;
}
function disposeTarget(t){if(!t)return;gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.fbo);t.tex=null;t.fbo=null;}
function setWrap(t,rep){gl.bindTexture(gl.TEXTURE_2D,t.tex);const wm=rep?gl.REPEAT:gl.CLAMP_TO_EDGE;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wm);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wm);}
function bindTarget(t){gl.bindFramebuffer(gl.FRAMEBUFFER,t?t.fbo:null);gl.viewport(0,0,t?t.w:cv.width,t?t.h:cv.height);}
function clearTarget(t,c){bindTarget(t);c=c||[0,0,0,0];gl.clearColor(c[0],c[1],c[2],c[3]);gl.clear(gl.COLOR_BUFFER_BIT);}
function blit(src,dst,sx,sy,w,h,dx,dy){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,src.fbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,dst.fbo);gl.blitFramebuffer(sx,sy,sx+w,sy+h,dx,dy,dx+w,dy+h,gl.COLOR_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
/* Undo snapshots live in system RAM (typed arrays), not in video memory.
   8-bit layers: 4 bytes per pixel. 16-bit layers: stored as half floats, 8 bytes per pixel. */
let halfRead=null;
function captureRegion(src,x,y,w,h){
  gl.bindFramebuffer(gl.FRAMEBUFFER,src.fbo);
  if(src.depth===16){
    if(halfRead===null)halfRead=gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT)===gl.RGBA&&gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE)===gl.HALF_FLOAT;
    let u;
    if(halfRead){u=new Uint16Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.HALF_FLOAT,u);}
    else{const f=new Float32Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.FLOAT,f);u=new Uint16Array(f.length);for(let i=0;i<f.length;i++)u[i]=f2h(f[i]);}
    return {w,h,depth:16,data:u,bytes:u.byteLength};}
  const u=new Uint8Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,u);return {w,h,depth:8,data:u,bytes:u.byteLength};}
function restoreRegion(snap,dst,x,y){gl.bindTexture(gl.TEXTURE_2D,dst.tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  if(snap.depth===16)gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,snap.w,snap.h,gl.RGBA,gl.HALF_FLOAT,snap.data);
  else gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,snap.w,snap.h,gl.RGBA,gl.UNSIGNED_BYTE,snap.data);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);}
function run(prog,target,u,opts){
  if(prog.defaults)u=Object.assign({},prog.defaults,u);
  gl.useProgram(prog.p);let unit=0;
  for(const k in u){const v=u[k];let l=prog.locs[k];if(l===undefined)l=prog.locs[k]=gl.getUniformLocation(prog.p,k);if(l===null)continue;
    if(v instanceof WebGLTexture){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,v);gl.uniform1i(l,unit);unit++;}
    else if(typeof v==='number')gl.uniform1f(l,v);
    else if(typeof v==='boolean')gl.uniform1i(l,v?1:0);
    else if(v.int!==undefined)gl.uniform1i(l,v.int);
    else if(v.length===2)gl.uniform2f(l,v[0],v[1]);else if(v.length===3)gl.uniform3f(l,v[0],v[1],v[2]);else if(v.length===4)gl.uniform4f(l,v[0],v[1],v[2],v[3]);}
  bindTarget(target);
  const b=opts&&opts.blend;
  if(b){gl.enable(gl.BLEND);if(b==='max'){gl.blendEquation(gl.MAX);gl.blendFunc(gl.ONE,gl.ONE);}else{gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);}}
  else gl.disable(gl.BLEND);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  if(b)gl.disable(gl.BLEND);
}
const dummy=(()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);return t;})();

const CH_DEF={uChanMode:{int:0},uChan:[1,1,1,1]};
const SEL_DEF={uSelTex:dummy,uUseSel:false};
P.comp.defaults=Object.assign({uMask2:dummy,uLMask:dummy,uUseMask2:false,uUseLMask:false},CH_DEF,SEL_DEF);P.merge.defaults=Object.assign({},CH_DEF,SEL_DEF);P.smudge.defaults=Object.assign({},CH_DEF,SEL_DEF);
P.mix.defaults={uM:dummy,uUseM:false};P.resample.defaults={uOutside:[0,0,0,0]};P.view.defaults={uShow:[1,1,1,0],uSingle:{int:-1},uMaskView:false,uSel:dummy,uSelMode:{int:0},uTime:0,uPx:1,uWrap:false};
P.shift.defaults={uWrap:false,uOutside:[0,0,0,0]};P.selop.defaults={uShape:dummy,uOldOn:true};P.loadsel.defaults={uInv:false};P.cropsel.defaults={uSel:dummy,uUseSel:false};
