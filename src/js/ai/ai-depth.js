/* ================= AI: how far away is each part of the picture (Depth Anything V2 small) =================
   Gives a grey picture, near = white, far = black, at about 518 px. Lens blur and Relight in the Photo tab, and the Convert tab's
   height from a photo, use it. */
async function aiDepthRun(img){const ort=await aiEngine(),sess=await aiSession('depth','depth.onnx'),k=518/Math.max(img.w,img.h),w=Math.max(14,Math.round(img.w*k/14)*14),h=Math.max(14,Math.round(img.h*k/14)*14),px=aiResizeRGBA(img,w,h),f=new Float32Array(3*w*h),mean=[.485,.456,.406],std=[.229,.224,.225];
  for(let i=0;i<w*h;i++)for(let c=0;c<3;c++)f[c*w*h+i]=(px[i*4+c]/255-mean[c])/std[c];
  const out=await sess.run({[sess.inputNames[0]]:new ort.Tensor('float32',f,[1,3,h,w])}),o=out[sess.outputNames[0]],d=o.data,n=w*h;let mn=1e9,mx=-1e9;for(let i=0;i<n;i++){const v=d[i];if(v<mn)mn=v;if(v>mx)mx=v;}
  /* leave out the extreme 0.5% each side so one odd pixel does not squash the range */
  const sorted=Float32Array.from(d.subarray(0,n)).sort(),lo=sorted[Math.floor(n*.005)],hi=sorted[Math.floor(n*.995)],r=Math.max(1e-6,hi-lo),u8=new Uint8Array(n);
  for(let i=0;i<n;i++)u8[i]=Math.round(clamp((d[i]-lo)/r,0,1)*255);return {w,h,data:u8};}
