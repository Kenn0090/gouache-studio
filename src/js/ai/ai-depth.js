/* ================= AI: how far away is each part of the picture (Depth Anything V2 small) =================
   Gives a grey picture, near = white, far = black, at about 518 px. Lens blur and Relight in the Photo tab, and the Convert tab's
   height from a photo, use it. */
async function aiDepthRun(img){const ort=await aiEngine(),sess=await aiSession('depth','depth.onnx'),k=518/Math.max(img.w,img.h),w=Math.max(14,Math.round(img.w*k/14)*14),h=Math.max(14,Math.round(img.h*k/14)*14),px=aiResizeRGBA(img,w,h),f=new Float32Array(3*w*h),mean=[.485,.456,.406],std=[.229,.224,.225];
  for(let i=0;i<w*h;i++)for(let c=0;c<3;c++)f[c*w*h+i]=(px[i*4+c]/255-mean[c])/std[c];
  const out=await sess.run({[sess.inputNames[0]]:new ort.Tensor('float32',f,[1,3,h,w])}),o=out[sess.outputNames[0]],d=o.data,n=w*h;let mn=1e9,mx=-1e9;for(let i=0;i<n;i++){const v=d[i];if(v<mn)mn=v;if(v>mx)mx=v;}
  /* leave out the extreme 0.5% each side so one odd pixel does not squash the range */
  const sorted=Float32Array.from(d.subarray(0,n)).sort(),lo=sorted[Math.floor(n*.005)],hi=sorted[Math.floor(n*.995)],r=Math.max(1e-6,hi-lo),u8=new Uint8Array(n);
  const fl=new Float32Array(n);for(let i=0;i<n;i++){const v=clamp((d[i]-lo)/r,0,1);fl[i]=v;u8[i]=Math.round(v*255);}return {w,h,data:u8,f:fl};}
/* a gentle blur of a float picture (a few texels), to take out model noise and old 8-bit steps */
function aiBlurFloat(a,w,h,sig){const R=Math.max(1,Math.ceil(sig*3)),k=new Float32Array(R*2+1);let sum=0;for(let i=-R;i<=R;i++){k[i+R]=Math.exp(-i*i/(2*sig*sig));sum+=k[i+R];}for(let i=0;i<k.length;i++)k[i]/=sum;
  const t=new Float32Array(w*h),o=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0;for(let i=-R;i<=R;i++)s+=a[y*w+Math.min(w-1,Math.max(0,x+i))]*k[i+R];t[y*w+x]=s;}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0;for(let i=-R;i<=R;i++)s+=t[Math.min(h-1,Math.max(0,y+i))*w+x]*k[i+R];o[y*w+x]=s;}return o;}
