/* ================= AI: pick out an object or the sky (SlimSAM) =================
   The picture goes through the image part once (slow part, a second or two; kept for more clicks), then every click or box is a
   quick second step. Masks come back as soft grey pictures at the size asked for. */
const SAM_SIDE=1024;
function aiResizeRGBA(img,w,h){const c=new OffscreenCanvas(img.w,img.h),x=c.getContext('2d');x.putImageData(new ImageData(img.data,img.w,img.h),0,0);const c2=new OffscreenCanvas(w,h),y=c2.getContext('2d');y.imageSmoothingQuality='high';y.drawImage(c,0,0,w,h);return y.getImageData(0,0,w,h).data;}
/* embed: {emb,pos,w,h,rw,rh,scale} for a picture {w,h,data} */
async function aiSamEmbed(img){const ort=await aiEngine(),enc=await aiSession('sam','vision_encoder.onnx'),k=SAM_SIDE/Math.max(img.w,img.h),rw=Math.round(img.w*k),rh=Math.round(img.h*k),px=aiResizeRGBA(img,rw,rh),S=SAM_SIDE,f=new Float32Array(3*S*S),mean=[.485,.456,.406],std=[.229,.224,.225];
  for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const i=(y*rw+x)*4,j=y*S+x;for(let c=0;c<3;c++)f[c*S*S+j]=(px[i+c]/255-mean[c])/std[c];}
  const out=await enc.run({pixel_values:new ort.Tensor('float32',f,[1,3,S,S])});
  return {emb:out.image_embeddings,pos:out.image_positional_embeddings,w:img.w,h:img.h,rw,rh,scale:k};}
/* a mask for some clicks: points [{x,y,pos}] in the picture's own pixels (pos false = "not this"). Returns {w,h,data:Uint8 0..255 soft, iou} at outW×outH */
async function aiSamMask(E,points,outW,outH,opt){opt=opt||{};const ort=await aiEngine(),dec=await aiSession('sam','mask_decoder.onnx'),n=points.length,pts=new Float32Array(n*2),lab=new BigInt64Array(n);
  points.forEach((p,i)=>{pts[i*2]=p.x*E.scale;pts[i*2+1]=p.y*E.scale;lab[i]=BigInt(p.pos===false?0:1);});
  const r=await dec.run({input_points:new ort.Tensor('float32',pts,[1,1,n,2]),input_labels:new ort.Tensor('int64',lab,[1,1,n]),image_embeddings:E.emb,image_positional_embeddings:E.pos});
  const iou=r.iou_scores.data,m=r.pred_masks.data;let best=0;const pick=opt.pick;if(pick!=null)best=pick;else for(let i=1;i<3;i++)if(iou[i]>iou[best])best=i;
  const L=256,lo=m.subarray(best*L*L,(best+1)*L*L),vw=E.rw/SAM_SIDE*L,vh=E.rh/SAM_SIDE*L,out=new Uint8Array(outW*outH),sg=opt.soft||1.6;
  for(let y=0;y<outH;y++){const fy=Math.min(vh-1.001,(y+.5)/outH*vh-.5),y0=Math.max(0,Math.floor(fy)),y1=Math.min(L-1,y0+1),ty=Math.max(0,fy-y0);
    for(let x=0;x<outW;x++){const fx=Math.min(vw-1.001,(x+.5)/outW*vw-.5),x0=Math.max(0,Math.floor(fx)),x1=Math.min(L-1,x0+1),tx=Math.max(0,fx-x0);
      const v=(lo[y0*L+x0]*(1-tx)+lo[y0*L+x1]*tx)*(1-ty)+(lo[y1*L+x0]*(1-tx)+lo[y1*L+x1]*tx)*ty;out[y*outW+x]=Math.round(255/(1+Math.exp(-v*sg)));}}
  return {w:outW,h:outH,data:out,iou:iou[best]};}
/* ---- sky: find the likely sky first (blue or bright and smooth, joined to the top edge), then let the model draw its exact edge ---- */
function aiSkyGuess(img){const W=Math.min(160,img.w),k=W/img.w,w=W,h=Math.max(2,Math.round(img.h*k)),px=aiResizeRGBA(img,w,h),cand=new Uint8Array(w*h),L=new Float32Array(w*h);
  for(let i=0;i<w*h;i++)L[i]=(.2126*px[i*4]+.7152*px[i*4+1]+.0722*px[i*4+2])/255;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,r=px[i*4]/255,g=px[i*4+1]/255,b=px[i*4+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=mx>0?(mx-mn)/mx:0;
    const gx=x>0&&x<w-1?Math.abs(L[i+1]-L[i-1]):0,gy=y>0&&y<h-1?Math.abs(L[i+w]-L[i-w]):0,flat=gx+gy<.07;
    const blue=b>=r&&b>=g*.92&&b-r>.04,cloud=mn>.62&&sat<.18,grey=mn>.45&&sat<.1&&L[i]>.5;if(flat&&(blue||cloud||grey))cand[i]=1;}
  /* keep what touches the top edge */
  const seen=new Uint8Array(w*h),st=[];for(let x=0;x<w;x++)if(cand[x]){seen[x]=1;st.push(x);}let n=0;
  while(st.length){const i=st.pop();n++;const x=i%w,y=(i/w)|0;for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&cand[j]&&!seen[j]){seen[j]=1;st.push(j);}}
  if(n<w*h*.04)return null;
  /* a few points inside the sky (spread along the top part) and one in the lower middle that is not sky */
  const pos=[],cols=[.2,.5,.8];for(const cx of cols){let found=null;for(let y=1;y<h&&!found;y++){const x=Math.round(cx*(w-1)),i=y*w+x;if(seen[i]&&seen[i-w]){let run=0;while(y+run<h&&seen[(y+run)*w+x])run++;found=[x,y+Math.floor(run/2)];}}if(found)pos.push({x:(found[0]+.5)/k,y:(found[1]+.5)/k,pos:true});}
  if(!pos.length)return null;let bottom=null;for(let y=h-2;y>h*.5&&!bottom;y--){const x=Math.round(w/2);if(!seen[y*w+x]){bottom={x:(x+.5)/k,y:(y+.5)/k,pos:false};}}
  const m=new Uint8Array(w*h);for(let i=0;i<w*h;i++)m[i]=seen[i]?255:0;return {points:bottom?pos.concat([bottom]):pos,cover:n/(w*h),guess:{w,h,data:m}};}
