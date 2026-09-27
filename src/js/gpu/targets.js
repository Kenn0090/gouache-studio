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
/* ---- reading pixels back without stalling ----
   A plain readPixels makes the CPU wait until the GPU has finished everything queued, which shows
   up as a hitch. Instead the copy goes into a GPU buffer with a fence; the bytes are collected a
   frame or two later, when the GPU is done. Anything that needs them sooner waits only then. */
const pendingReads=new Set();
function asyncRead(fbo,x,y,w,h,type,ctor,n,done){const buf=gl.createBuffer();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buf);gl.bufferData(gl.PIXEL_PACK_BUFFER,n*ctor.BYTES_PER_ELEMENT,gl.STREAM_READ);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.readPixels(x,y,w,h,gl.RGBA,type,0);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
  const job={buf,fence,finish(){if(!pendingReads.delete(job))return;const out=new ctor(n);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buf);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,out);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    gl.deleteBuffer(buf);gl.deleteSync(fence);done(out);}};
  pendingReads.add(job);schedulePoll();return job;}
let pollTimer=0;
function schedulePoll(){if(!pollTimer&&pendingReads.size)pollTimer=setTimeout(pollReads,4);}
function pollReads(){pollTimer=0;for(const j of [...pendingReads]){const s=gl.clientWaitSync(j.fence,0,0);if(s===gl.ALREADY_SIGNALED||s===gl.CONDITION_SATISFIED)j.finish();}schedulePoll();}
/* immediate read, for code that needs the pixels right away */
function captureRegionNow(src,x,y,w,h){gl.bindFramebuffer(gl.FRAMEBUFFER,src.fbo);let u;
  if(src.depth===16){const f=new Float32Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.FLOAT,f);u=new Uint16Array(f.length);for(let i=0;i<f.length;i++)u[i]=f2h(f[i]);}
  else{u=new Uint8Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,u);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {w,h,depth:src.depth===16?16:8,data:u,bytes:u.byteLength};}
/* an undo snapshot: its pixels arrive asynchronously; reading .data before then waits for them */
function makeSnap(w,h,depth,bytes){const s={w,h,depth,bytes,_d:null,_job:null,
  get data(){if(this._job)this._job.finish();return this._d;},set data(v){this._d=v;},get resident(){return !!(this._d||this._job);}};return s;}
function captureRegion(src,x,y,w,h){const n=w*h*4;
  if(src.depth===16){
    if(halfRead===null)halfRead=gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT)===gl.RGBA&&gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE)===gl.HALF_FLOAT;
    const s=makeSnap(w,h,16,n*2);
    s._job=halfRead?asyncRead(src.fbo,x,y,w,h,gl.HALF_FLOAT,Uint16Array,n,u=>{s._job=null;s._d=u;})
      :asyncRead(src.fbo,x,y,w,h,gl.FLOAT,Float32Array,n,f=>{const u=new Uint16Array(n);for(let i=0;i<n;i++)u[i]=f2h(f[i]);s._job=null;s._d=u;});
    return s;}
  const s=makeSnap(w,h,8,n);s._job=asyncRead(src.fbo,x,y,w,h,gl.UNSIGNED_BYTE,Uint8Array,n,u=>{s._job=null;s._d=u;});return s;}
function restoreRegion(snap,dst,x,y){gl.bindTexture(gl.TEXTURE_2D,dst.tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  if(snap.depth===16)gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,snap.w,snap.h,gl.RGBA,gl.HALF_FLOAT,snap.data);
  else gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,snap.w,snap.h,gl.RGBA,gl.UNSIGNED_BYTE,snap.data);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);}
let runTiling=false;
function run(prog,target,u,opts){if(prog.tiled&&!runTiling&&target.w*target.h>262144){runTiling=true;try{runTiled(prog,target,u);}finally{runTiling=false;}return;}
  useProg(prog,u);
  bindTarget(target);
  const b=opts&&opts.blend;
  if(b){gl.enable(gl.BLEND);if(b==='max'){gl.blendEquation(gl.MAX);gl.blendFunc(gl.ONE,gl.ONE);}else{gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);}}
  else gl.disable(gl.BLEND);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  if(b)gl.disable(gl.BLEND);
}
/* select a program and set its uniforms (textures go to units 0,1,2...) */
function useProg(prog,u){
  if(prog.defaults)u=Object.assign({},prog.defaults,u);
  gl.useProgram(prog.p);let unit=0;
  for(const k in u){const v=u[k];let l=prog.locs[k];if(l===undefined)l=prog.locs[k]=gl.getUniformLocation(prog.p,k);if(l===null)continue;
    if(v instanceof WebGLTexture){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,v);gl.uniform1i(l,unit);unit++;}
    else if(typeof v==='number')gl.uniform1f(l,v);
    else if(typeof v==='boolean')gl.uniform1i(l,v?1:0);
    else if(v.int!==undefined)gl.uniform1i(l,v.int);
    else if(v.v3)gl.uniform3fv(l,v.v3);
    else if(v.m4)gl.uniformMatrix4fv(l,false,v.m4);
    else if(v.length===2)gl.uniform2f(l,v[0],v[1]);else if(v.length===3)gl.uniform3f(l,v[0],v[1],v[2]);else if(v.length===4)gl.uniform4f(l,v[0],v[1],v[2],v[3]);}
}
const dummy=(()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);return t;})();

const CH_DEF={uChanMode:{int:0},uChan:[1,1,1,1]};
const SEL_DEF={uSelTex:dummy,uUseSel:false,uTonalRange:{int:1},uProtect:true};
P.comp.defaults=Object.assign({uMask2:dummy,uLMask:dummy,uUseMask2:false,uUseLMask:false},CH_DEF,SEL_DEF);P.merge.defaults=Object.assign({},CH_DEF,SEL_DEF);P.smudge.defaults=Object.assign({},CH_DEF,SEL_DEF);
P.mix.defaults={uM:dummy,uUseM:false};P.resample.defaults={uOutside:[0,0,0,0]};P.view.defaults={uShow:[1,1,1,0],uSingle:{int:-1},uMaskView:false,uSel:dummy,uSelMode:{int:0},uTime:0,uPx:1,uWrap:false,uUnder:dummy,uUseUnder:false,uBg:[0,0,0,0]};
P.shift.defaults={uWrap:false,uOutside:[0,0,0,0]};P.grad.defaults={uShape:{int:0},uDither:false,uOpacity:1,uGray:false,uBase:dummy,uUseBase:false,uSelTex:dummy,uUseSel:false};P.fillcov.defaults={uSelTex:dummy,uUseSel:false};P.lockcov.defaults={uSelTex:dummy,uUseSel:false};P.texcov.defaults={uSelTex:dummy,uUseSel:false};P.xform.defaults={uOutside:[0,0,0,0],uInterp:{int:2},uSS:{int:1},uWrap:false,uRect:[0,0,0,0],uBase:dummy,uUseBase:false};P.mesh.defaults={uOutside:[0,0,0,0],uInterp:{int:2},uOff:[0,0]};P.proj.defaults={uAlphaOnly:true};P.selop.defaults={uShape:dummy,uOldOn:true};P.loadsel.defaults={uInv:false};P.cropsel.defaults={uSel:dummy,uUseSel:false};
