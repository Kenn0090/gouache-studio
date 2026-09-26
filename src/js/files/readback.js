/* ================= Pixel readback ================= */
function readPremult(t){gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);const n=t.w*t.h*4;
  if(t.depth===16){const f=new Float32Array(n);gl.readPixels(0,0,t.w,t.h,gl.RGBA,gl.FLOAT,f);return f;}
  const u=new Uint8Array(n);gl.readPixels(0,0,t.w,t.h,gl.RGBA,gl.UNSIGNED_BYTE,u);return u;}
function toStraight(px,bits){const n=px.length,sc=px instanceof Float32Array?1:1/255,max=bits===16?65535:255,out=bits===16?new Uint16Array(n):new Uint8Array(n);
  for(let i=0;i<n;i+=4){const a=Math.min(1,px[i+3]*sc);if(a<=0)continue;const ia=sc/a;
    out[i]=Math.min(1,Math.max(0,px[i]*ia))*max+.5|0;out[i+1]=Math.min(1,Math.max(0,px[i+1]*ia))*max+.5|0;out[i+2]=Math.min(1,Math.max(0,px[i+2]*ia))*max+.5|0;out[i+3]=a*max+.5|0;}
  return out;}
function sourceTarget(src){if(src==='layer'&&doc.active){if(isLayer(doc.active))return doc.active.target;return renderNodes(doc.active.children);}composite();dirtyComp=false;return compOut;}
