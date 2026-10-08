/* ================= Targets ================= */
let uvWrapScope=null;
/* Texture storage only: driver overhead, mesh buffers and multisampled view targets are separate. */
const gpuTargets=new Set();
const gpuTextureTargets=new WeakMap();
/* Tracking must not keep an abandoned texture alive merely for the memory counter. */
function gpuTrack(t){t._gpuRef=new WeakRef(t);gpuTargets.add(t._gpuRef);gpuTextureTargets.set(t.tex,t);return t;}
function gpuLiveTargets(){const out=[];for(const ref of gpuTargets){const t=ref.deref();if(t)out.push(t);else gpuTargets.delete(ref);}return out;}
const gpuBytes=t=>t.w*t.h*(t.mono?(t.depth===32?4:t.depth===16?2:1):t.packed?4:t.depth===32?16:t.depth===16?8:4);
function gpuMemory(){let bytes=0,spare=0;const targets=gpuLiveTargets();for(const t of targets){bytes+=gpuBytes(t);if(t.pool&&t.pool.free.includes(t))spare+=gpuBytes(t);}return {bytes,spare,targets:targets.length};}
/* Repeat only while evaluating an effect; never change the document or a pooled texture permanently. */
function uvWrapTarget(t){if(!uvWrapScope||!t||!t.tex)return;if(!uvWrapScope.saved.has(t)){gl.bindTexture(gl.TEXTURE_2D,t.tex);uvWrapScope.saved.set(t,[gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S),gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T)]);}setWrap(t,uvWrapScope.on);}
function withUVWrap(on,targets,fn){const previous=uvWrapScope,old=doc.wrap,scope={on:!!on,docWrap:old,saved:new Map()};uvWrapScope=scope;doc.wrap=scope.on;
  try{for(const t of targets)uvWrapTarget(t);return fn();}finally{for(const [t,wrap] of scope.saved)if(t.tex){gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap[0]);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap[1]);}doc.wrap=old;uvWrapScope=previous;}}
function texFmt(depth){return depth===32?{i:gl.RGBA32F,t:gl.FLOAT}:depth===16?{i:gl.RGBA16F,t:gl.HALF_FLOAT}:{i:gl.RGBA8,t:gl.UNSIGNED_BYTE};}
function makeTarget(w,h,depth,wrap,packed,mono){
  depth=depth||doc.depth; if(wrap===undefined)wrap=uvWrapScope?uvWrapScope.docWrap:doc.wrap;
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);const F=texFmt(depth);
  gl.texImage2D(gl.TEXTURE_2D,0,mono?(depth===16?gl.R16F:depth===32?gl.R32F:gl.R8):packed?gl.RG16F:F.i,w,h,0,mono?gl.RED:packed?gl.RG:gl.RGBA,F.t,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  const wm=wrap?gl.REPEAT:gl.CLAMP_TO_EDGE;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wm);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wm);
  const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  const t=gpuTrack({tex,fbo,w,h,depth,packed:!!packed,mono:!!mono,mipDirty:true});clearTarget(t);return t;
}
function disposeTarget(t){if(!t)return;gpuTargets.delete(t._gpuRef);gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.fbo);t.tex=null;t.fbo=null;}
function setWrap(t,rep){gl.bindTexture(gl.TEXTURE_2D,t.tex);const wm=rep?gl.REPEAT:gl.CLAMP_TO_EDGE;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wm);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wm);}
/* Opacity proofs are conservative: any write invalidates them unless the complete result is known. */
function bindTarget(t){if(t)t.opaque=false;gl.bindFramebuffer(gl.FRAMEBUFFER,t?t.fbo:null);gl.viewport(0,0,t?t.w:cv.width,t?t.h:cv.height);}
function clearTarget(t,c){bindTarget(t);c=c||[0,0,0,0];gl.clearColor(c[0],t&&t.packed?c[3]:c[1],c[2],c[3]);gl.clear(gl.COLOR_BUFFER_BIT);if(t)t.opaque=c[3]===1&&!gl.isEnabled(gl.SCISSOR_TEST);}
function blit(src,dst,sx,sy,w,h,dx,dy){const opaque=!!src.opaque,proof=opaque&&sx>=0&&sy>=0&&sx+w<=src.w&&sy+h<=src.h&&dx===0&&dy===0&&w===dst.w&&h===dst.h&&!gl.isEnabled(gl.SCISSOR_TEST);
  if(!!src.packed!==!!dst.packed||!!src.mono!==!!dst.mono){const copy=()=>run(P.resample,dst,{uSrc:src.tex,uOffset:[dx-sx,dy-sy],uScale:[1,1],uTaps:{int:1}});if(scissorNow)copy();else scissorDo([dx,dy,w,h],copy);dst.opaque=proof;return;}
  dst.opaque=proof;gl.bindFramebuffer(gl.READ_FRAMEBUFFER,src.fbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,dst.fbo);gl.blitFramebuffer(sx,sy,sx+w,sy+h,dx,dy,dx+w,dy+h,gl.COLOR_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
function packedRead(t,u){if(t.packed||t.mono)for(let i=0;i<u.length;i+=4){const a=t.mono?(u instanceof Uint16Array?0x3c00:t.depth===8?255:1):u[i+1];u[i+1]=u[i+2]=u[i];u[i+3]=a;}return u;}
function packedUpload(t,u){if(t.mono){const out=new u.constructor(u.length/4);for(let i=0;i<out.length;i++)out[i]=u[i*4];return out;}if(!t.packed)return u;const out=new Uint16Array(u.length/2);for(let i=0,j=0;i<u.length;i+=4){out[j++]=u[i];out[j++]=u[i+3];}return out;}
function imageOpaque(bytes,depth){const step=depth===16?8:4;for(let i=step-1;i<bytes.length;i+=step)if(depth===16?bytes[i]!==60||bytes[i-1]!==0:bytes[i]!==255)return false;return bytes.length>0;}
/* Undo snapshots live in system RAM (typed arrays), not in video memory.
   8-bit layers: 4 bytes per pixel. 16-bit layers: stored as half floats, 8 bytes per pixel. */
let halfRead=null;
/* ---- reading pixels back without stalling ----
   A plain readPixels makes the CPU wait until the GPU has finished everything queued, which shows
   up as a hitch. Instead the copy goes into a GPU buffer with a fence; the bytes are collected a
   frame or two later, when the GPU is done. Anything that needs them sooner waits only then. */
const pendingReads=new Set();
function asyncRead(fbo,x,y,w,h,type,ctor,n,done,failed){const buf=gl.createBuffer();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buf);gl.bufferData(gl.PIXEL_PACK_BUFFER,n*ctor.BYTES_PER_ELEMENT,gl.STREAM_READ);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.readPixels(x,y,w,h,gl.RGBA,type,0);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
  const job={buf,fence,fail(){if(!pendingReads.delete(job))return;gl.deleteBuffer(buf);gl.deleteSync(fence);if(failed)failed(new Error('The graphics card could not return the image. Please try saving again.'));},
    finish(){if(gl.isContextLost()){job.fail();return;}if(!pendingReads.delete(job))return;const out=new ctor(n);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buf);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,out);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    gl.deleteBuffer(buf);gl.deleteSync(fence);done(out);}};
  pendingReads.add(job);schedulePoll();return job;}
let pollTimer=0;
function schedulePoll(){if(!pollTimer&&pendingReads.size)pollTimer=setTimeout(pollReads,4);}
function pollReads(){pollTimer=0;for(const j of [...pendingReads]){const s=gl.clientWaitSync(j.fence,0,0);if(s===gl.WAIT_FAILED||gl.isContextLost())j.fail();else if(s===gl.ALREADY_SIGNALED||s===gl.CONDITION_SATISFIED)j.finish();}schedulePoll();}
/* immediate read, for code that needs the pixels right away */
function captureRegionNow(src,x,y,w,h){gl.bindFramebuffer(gl.FRAMEBUFFER,src.fbo);let u;
  if(src.depth===16){const f=new Float32Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.FLOAT,f);packedRead(src,f);u=new Uint16Array(f.length);for(let i=0;i<f.length;i++)u[i]=f2h(f[i]);}
  else{u=new Uint8Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,u);packedRead(src,u);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {w,h,depth:src.depth===16?16:8,data:u,bytes:u.byteLength};}
/* an undo snapshot: its pixels arrive asynchronously; reading .data before then waits for them */
function makeSnap(w,h,depth,bytes){const s={w,h,depth,bytes,_d:null,_job:null,
  get data(){if(this._job)this._job.finish();return this._d;},set data(v){this._d=v;},get resident(){return !!(this._d||this._job);}};return s;}
function captureRegion(src,x,y,w,h){const n=w*h*4;
  if(src.depth===16){
    if(halfRead===null)halfRead=gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT)===gl.RGBA&&gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE)===gl.HALF_FLOAT;
    const s=makeSnap(w,h,16,n*2);
    s._job=halfRead?asyncRead(src.fbo,x,y,w,h,gl.HALF_FLOAT,Uint16Array,n,u=>{s._job=null;s._d=packedRead(src,u);})
      :asyncRead(src.fbo,x,y,w,h,gl.FLOAT,Float32Array,n,f=>{packedRead(src,f);const u=new Uint16Array(n);for(let i=0;i<n;i++)u[i]=f2h(f[i]);s._job=null;s._d=u;});
    return s;}
  const s=makeSnap(w,h,8,n);s._job=asyncRead(src.fbo,x,y,w,h,gl.UNSIGNED_BYTE,Uint8Array,n,u=>{s._job=null;s._d=packedRead(src,u);});return s;}
/* File reads wait for the fence instead of forcing an undo snapshot's .data getter early.
   The file worker converts float pixels to half-float bytes. */
function readRegionAsync(src,x,y,w,h){return new Promise((resolve,reject)=>{if(gl.isContextLost()){reject(new Error('The graphics context was lost.'));return;}
  asyncRead(src.fbo,x,y,w,h,src.depth===16?gl.FLOAT:gl.UNSIGNED_BYTE,src.depth===16?Float32Array:Uint8Array,w*h*4,u=>resolve(packedRead(src,u)),reject);});}
function restoreRegion(snap,dst,x,y){dst.opaque=false;gl.bindTexture(gl.TEXTURE_2D,dst.tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  if(snap.depth===16)gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,snap.w,snap.h,dst.mono?gl.RED:dst.packed?gl.RG:gl.RGBA,gl.HALF_FLOAT,packedUpload(dst,snap.data));
  else gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,snap.w,snap.h,dst.mono?gl.RED:gl.RGBA,gl.UNSIGNED_BYTE,packedUpload(dst,snap.data));
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);}
/* draw only inside a rectangle (x, y, w, h in the target's pixels) */
let scissorNow=null;
function scissorDo(r,fn){scissorNow=r;gl.enable(gl.SCISSOR_TEST);gl.scissor(Math.max(0,Math.floor(r[0])),Math.max(0,Math.floor(r[1])),Math.max(0,Math.ceil(r[2])),Math.max(0,Math.ceil(r[3])));try{return fn();}finally{scissorNow=null;gl.disable(gl.SCISSOR_TEST);}}
let runTiling=false;
const runStat={n:0,px:0,by:{}};
function run(prog,target,u,opts){runStat.n++;{const a=target?(scissorNow?Math.min(target.w*target.h,scissorNow[2]*scissorNow[3]):target.w*target.h):0;runStat.px+=a;const k=prog._n||'?';runStat.by[k]=(runStat.by[k]||0)+a;}if(prog.tiled&&!runTiling&&target.w*target.h>262144){runTiling=true;try{runTiled(prog,target,u);}finally{runTiling=false;}return;}
  let packedDst=null;const tinted=target&&target.packed&&opts&&['tintfirst','tintmax'].includes(opts.blend);
  if(tinted){let r=scissorNow||[0,0,target.w,target.h];if(!scissorNow&&u.uCenter&&u.uExtent){const [x,y]=u.uCenter,e=u.uExtent,x0=Math.max(0,Math.floor(x-e)),y0=Math.max(0,Math.floor(y-e));r=[x0,y0,Math.max(1,Math.min(target.w,Math.ceil(x+e))-x0),Math.max(1,Math.min(target.h,Math.ceil(y+e))-y0)];}
    packedDst=makeTarget(r[2],r[3],target.depth,false,true);const clipped=gl.isEnabled(gl.SCISSOR_TEST);if(clipped)gl.disable(gl.SCISSOR_TEST);try{blit(target,packedDst,...r,0,0);}finally{if(clipped)gl.enable(gl.SCISSOR_TEST);}
    u=Object.assign({},u,{gsPackedTint:{int:opts.blend==='tintfirst'?1:2},gsPackedDst:packedDst.tex,gsPackedOrigin:[r[0],r[1]]});}
  useProg(prog,u,!!(target&&target.packed));
  bindTarget(target);
  const b=!tinted&&opts&&opts.blend;
  if(b){gl.enable(gl.BLEND);if(b==='max'){gl.blendEquation(gl.MAX);gl.blendFunc(gl.ONE,gl.ONE);}else if(b==='tintfirst'){gl.blendEquation(gl.FUNC_ADD);gl.blendFuncSeparate(gl.ONE_MINUS_DST_ALPHA,gl.DST_ALPHA,gl.ZERO,gl.ONE);}else if(b==='tintmax'){gl.blendEquationSeparate(gl.FUNC_ADD,gl.MAX);gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE);}else{gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);}}
  else gl.disable(gl.BLEND);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  if(packedDst)disposeTarget(packedDst);
  if(b)gl.disable(gl.BLEND);
}
/* select a program and set its uniforms (textures go to units 0,1,2...) */
function useProg(prog,u,packedOut){
  if(prog.defaults)u=Object.assign({},prog.defaults,u);
  if(packedOut||Object.values(u).some(v=>v instanceof WebGLTexture&&(gpuTextureTargets.get(v)?.packed||gpuTextureTargets.get(v)?.mono))){prog=packedProgram(prog);u=Object.assign({gsPackedTint:{int:0},gsPackedDst:dummy},u,{gsPackedOut:!!packedOut});for(const k of prog.packNames){const t=gpuTextureTargets.get(u[k]);u['gsPacked_'+k]=!!t?.packed;u['gsMono_'+k]=!!t?.mono;}}
  gl.useProgram(prog.p);let unit=0;
  for(const k in u){const v=u[k];let l=prog.locs[k];if(l===undefined)l=prog.locs[k]=gl.getUniformLocation(prog.p,k);if(l===null)continue;
    if(v==null)throw new Error('Missing graphics input: '+k);
    if(v instanceof WebGLTexture){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,v);gl.uniform1i(l,unit);unit++;}
    else if(v&&v.arr){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D_ARRAY,v.arr);gl.uniform1i(l,unit);unit++;}
    else if(typeof v==='number')gl.uniform1f(l,v);
    else if(typeof v==='boolean')gl.uniform1i(l,v?1:0);
    else if(v.int!==undefined)gl.uniform1i(l,v.int);
    else if(v.uint!==undefined)gl.uniform1ui(l,v.uint>>>0);
    else if(v.iv2)gl.uniform2i(l,v.iv2[0],v.iv2[1]);
    else if(v.v3)gl.uniform3fv(l,v.v3);
    else if(v.m4)gl.uniformMatrix4fv(l,false,v.m4);
    else if(v.m3)gl.uniformMatrix3fv(l,false,v.m3);
    else if(v.v4a)gl.uniform4fv(l,v.v4a);
    else if(v.length===2)gl.uniform2f(l,v[0],v[1]);else if(v.length===3)gl.uniform3f(l,v[0],v[1],v[2]);else if(v.length===4)gl.uniform4f(l,v[0],v[1],v[2],v[3]);}
}
const dummy=(()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);return t;})();

const CH_DEF={uChanMode:{int:0},uChan:[1,1,1,1]};
const SEL_DEF={uSelTex:dummy,uUseSel:false,uTonalRange:{int:1},uProtect:true};
P.comp.defaults=Object.assign({uSolid:false,uSolidColor:[0,0,0,0],uMask2:dummy,uLMask:dummy,uUseMask2:false,uUseLMask:false,uStrokeTint:false},CH_DEF,SEL_DEF);P.merge.defaults=Object.assign({uStrokeTint:false,uSrcOrigin:{iv2:[0,0]}},CH_DEF,SEL_DEF);P.stamp.defaults={uTint:{int:0},uDabCol:[0,0,0]};P.smudge.defaults=Object.assign({},CH_DEF,SEL_DEF);
P.mix.defaults={uM:dummy,uUseM:false};P.resample.defaults={uOutside:[0,0,0,0]};P.view.defaults={uR:[1,0,0,1],uShow:[1,1,1,0],uSingle:{int:-1},uMaskView:false,uSel:dummy,uSelMode:{int:0},uTime:0,uPx:1,uWrap:false,uUnder:dummy,uUseUnder:false,uBg:[0,0,0,0]};
P.shift.defaults={uWrap:false,uOutside:[0,0,0,0]};P.grad.defaults={uShape:{int:0},uDither:false,uOpacity:1,uGray:false,uBase:dummy,uUseBase:false,uSelTex:dummy,uUseSel:false};P.fillcov.defaults={uSelTex:dummy,uUseSel:false};P.lockcov.defaults={uSelTex:dummy,uUseSel:false};P.texcov.defaults={uSelTex:dummy,uUseSel:false};P.xform.defaults={uOutside:[0,0,0,0],uInterp:{int:2},uSS:{int:1},uWrap:false,uRect:[0,0,0,0],uBase:dummy,uUseBase:false};P.mesh.defaults={uOutside:[0,0,0,0],uInterp:{int:2},uOff:[0,0]};P.proj.defaults={uAlphaOnly:true};P.selop.defaults={uShape:dummy,uOldOn:true};P.loadsel.defaults={uInv:false};P.cropsel.defaults={uSel:dummy,uUseSel:false};
