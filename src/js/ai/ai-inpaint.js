/* ================= AI: fill a hole from its surroundings (LaMa) =================
   img: {w,h,data RGBA8}; hole: Uint8Array w*h (255 = take this out); bb: [x0,y0,x1,y1] box of the hole in pixels.
   Works on a 512 px square around the hole (the model's size) and returns a patch: {rect:[x,y,w,h] as 0..1 of the picture, rgba} whose
   alpha fades out at the hole's edge, so it can be laid over the picture at any resolution. */
async function aiInpaintPatch(img,hole,bb,prog){prog=prog||(()=>{});const W=img.w,H=img.h,S=512,bw=bb[2]-bb[0],bh=bb[3]-bb[1],side=Math.min(Math.min(W,H),Math.max(192,Math.max(bw,bh)*2.2)),cx=(bb[0]+bb[2])/2,cy=(bb[1]+bb[3])/2,sx=clamp(cx-side/2,0,W-side),sy=clamp(cy-side/2,0,H-side);
  const c=new OffscreenCanvas(W,H);c.getContext('2d').putImageData(new ImageData(img.data,W,H),0,0);
  const cc=new OffscreenCanvas(S,S),x2=cc.getContext('2d',{willReadFrequently:true});x2.imageSmoothingQuality='high';x2.drawImage(c,sx,sy,side,side,0,0,S,S);const px=x2.getImageData(0,0,S,S).data;
  const hm=new Uint8ClampedArray(W*H*4);for(let i=0;i<W*H;i++){const v=hole[i];hm[i*4]=hm[i*4+1]=hm[i*4+2]=v;hm[i*4+3]=255;}
  const mc=new OffscreenCanvas(W,H);mc.getContext('2d').putImageData(new ImageData(hm,W,H),0,0);const mm=new OffscreenCanvas(S,S),m2=mm.getContext('2d',{willReadFrequently:true});m2.imageSmoothingQuality='high';m2.drawImage(mc,sx,sy,side,side,0,0,S,S);
  const md=m2.getImageData(0,0,S,S).data,h0=new Uint8Array(S*S);for(let i=0;i<S*S;i++)h0[i]=md[i*4]>127?255:0;
  const grown=phMaxFilter(h0,S,S,Math.max(3,Math.round(S*.012))),ort=await aiEngine(),sess=await aiSession('lama','lama.onnx'),f=new Float32Array(3*S*S),mk=new Float32Array(S*S);
  for(let i=0;i<S*S;i++){f[i]=px[i*4]/255;f[S*S+i]=px[i*4+1]/255;f[2*S*S+i]=px[i*4+2]/255;mk[i]=grown[i]>127?1:0;}prog(.2);
  const out=await sess.run({image:new ort.Tensor('float32',f,[1,3,S,S]),mask:new ort.Tensor('float32',mk,[1,1,S,S])}),o=out.output.data;prog(.9);
  const soft=phBoxBlur(grown,S,S,Math.max(2,Math.round(S*.008))),rgba=new Uint8ClampedArray(S*S*4);
  for(let i=0;i<S*S;i++){rgba[i*4]=o[i];rgba[i*4+1]=o[S*S+i];rgba[i*4+2]=o[2*S*S+i];rgba[i*4+3]=soft[i];}
  return {rect:[sx/W,sy/H,side/W,side/H],rgba};}
