/* ================= Smaller files (0.28) =================
   Kenn: bring file sizes way down across the board. Every picture a file keeps goes through here.
   Lossless ('p'): each channel on its own, every pixel stored as its difference from a guess made from its left, upper
   and upper-left neighbours (the predictor PNG and lossless JPEG use), then deflated. Pictures shrink to a fraction.
   Smaller files ('w', Preferences, on by default): colour and grey maps may be kept as high-quality WebP when that is
   smaller. Normal maps, Height, masks and baked mesh maps are always lossless: small errors there show as bumps,
   hard edges or wrong selections. 16-bit maps are always lossless. */
const pxSmall=()=>prefs.smallFiles!==false;
/* maps that may be stored lossy (if Smaller files is on) */
const PX_LOSSY=new Set(['base','rough','metal','ao','curv','emis','spec','gloss','opac','sheen']);
const pxMed=(a,b,c)=>c>=Math.max(a,b)?Math.min(a,b):c<=Math.min(a,b)?Math.max(a,b):a+b-c;
/* raw pixels (RGBA rows, 8-bit bytes or 16-bit half floats) -> planes of prediction differences */
function pxPredict(raw,w,h,depth){const n=w*h;
  if(depth===16){const v=new Uint16Array(raw.buffer,raw.byteOffset,n*4),out=new Uint8Array(n*8);
    for(let c=0;c<4;c++){const hi=c*2*n,lo=hi+n;
      for(let y=0,i=0;y<h;y++)for(let x=0;x<w;x++,i++){const s=v[i*4+c],a=x?v[(i-1)*4+c]:(y?v[(i-w)*4+c]:0),b=y?v[(i-w)*4+c]:a,cc=x&&y?v[(i-w-1)*4+c]:b;
        const d=(s-pxMed(a,b,cc))&65535;out[hi+i]=d>>8;out[lo+i]=d&255;}}
    return out;}
  const out=new Uint8Array(n*4);
  for(let c=0;c<4;c++){const o=c*n;for(let y=0,i=0;y<h;y++)for(let x=0;x<w;x++,i++){const s=raw[i*4+c],a=x?raw[(i-1)*4+c]:(y?raw[(i-w)*4+c]:0),b=y?raw[(i-w)*4+c]:a,cc=x&&y?raw[(i-w-1)*4+c]:b;
    out[o+i]=(s-pxMed(a,b,cc))&255;}}
  return out;}
function pxUnpredict(p,w,h,depth){const n=w*h;
  if(depth===16){const v=new Uint16Array(n*4);
    for(let c=0;c<4;c++){const hi=c*2*n,lo=hi+n;
      for(let y=0,i=0;y<h;y++)for(let x=0;x<w;x++,i++){const a=x?v[(i-1)*4+c]:(y?v[(i-w)*4+c]:0),b=y?v[(i-w)*4+c]:a,cc=x&&y?v[(i-w-1)*4+c]:b;
        v[i*4+c]=(pxMed(a,b,cc)+((p[hi+i]<<8)|p[lo+i]))&65535;}}
    return new Uint8Array(v.buffer);}
  const out=new Uint8Array(n*4);
  for(let c=0;c<4;c++){const o=c*n;for(let y=0,i=0;y<h;y++)for(let x=0;x<w;x++,i++){const a=x?out[(i-1)*4+c]:(y?out[(i-w)*4+c]:0),b=y?out[(i-w)*4+c]:a,cc=x&&y?out[(i-w-1)*4+c]:b;
    out[i*4+c]=(pxMed(a,b,cc)+p[o+i])&255;}}
  return out;}
/* a premultiplied 8-bit picture as WebP (null when this browser can't, or it is too big for WebP) */
let pxWebpOk=null;
async function pxWebp(raw,w,h,q){if(pxWebpOk===false||w>16383||h>16383||typeof OffscreenCanvas==='undefined')return null;
  try{const c=new OffscreenCanvas(w,h),x=c.getContext('2d'),id=new ImageData(w,h),d=id.data;
    for(let i=0;i<d.length;i+=4){const a=raw[i+3];if(a){const f=255/a;d[i]=Math.min(255,raw[i]*f+.5);d[i+1]=Math.min(255,raw[i+1]*f+.5);d[i+2]=Math.min(255,raw[i+2]*f+.5);}d[i+3]=a;}
    x.putImageData(id,0,0);const b=await c.convertToBlob({type:'image/webp',quality:q||.92});if(b.type!=='image/webp'){pxWebpOk=false;return null;}pxWebpOk=true;return new Uint8Array(await b.arrayBuffer());}
  catch(e){pxWebpOk=false;return null;}}
async function pxWebpDecode(u8,w,h){const bm=await createImageBitmap(new Blob([u8],{type:'image/webp'}),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
  const c=new OffscreenCanvas(w,h),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bm,0,0);bm.close&&bm.close();const d=x.getImageData(0,0,w,h).data,out=new Uint8Array(w*h*4);
  for(let i=0;i<d.length;i+=4){const a=d[i+3],f=a/255;out[i]=Math.round(d[i]*f);out[i+1]=Math.round(d[i+1]*f);out[i+2]=Math.round(d[i+2]*f);out[i+3]=a;}return out;}
/* pack: {bytes, f} ('p' lossless, 'w' WebP); lossy only when asked and Smaller files is on, and only if it is smaller */
function pxBytes(raw,depth){if(depth!==16||!(raw instanceof Float32Array))return raw;const out=new Uint16Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=f2h(raw[i]);return new Uint8Array(out.buffer);}
/* A constant image predicts to zero everywhere except the first sample of each channel plane. */
function pxSolidPredict(c,w,h,depth){const n=w*h,out=new Uint8Array(n*(depth===16?8:4));for(let i=0;i<4;i++){const v=depth===16?f2h(c[i]):Math.round(c[i]*255);if(depth===16){out[i*2*n]=v>>8;out[(i*2+1)*n]=v&255;}else out[i*n]=v;}return out;}
async function pxPackCore(raw,w,h,depth,lossy,small,solid){if(solid)return {bytes:await streamThrough(pxSolidPredict(solid,w,h,depth),'deflate-raw'),f:'p'};
  raw=pxBytes(raw,depth);const z=await streamThrough(pxPredict(raw,w,h,depth),'deflate-raw');
  /* (0.74.3) an empty or flat map is already tiny after deflate: trying WebP on it only costs seconds at 4096 px */
  if(lossy&&depth!==16&&small&&w*h>=4096&&z.length>w*h*.03){const wb=await pxWebp(raw,w,h);if(wb&&wb.length<z.length*.8)return {bytes:wb,f:'w'};}
  return {bytes:z,f:'p'};}
/* A single worker keeps prediction, half-float conversion and image encoding off the UI thread.
   Small images stay local. Existing callers retain their input; save readbacks transfer ownership. */
const pxWorkerState={worker:null,pool:[],unavailable:false,seq:0,jobs:new Map(),completed:0};
/* (0.57) a few packing workers, not one: saving hands every layer's picture to whichever is least busy */
function pxWorkerGet(){const S=pxWorkerState;if(S.pool.length||S.unavailable)return S.pool.length?S.pool.reduce((a,b)=>b.busy<a.busy?b:a):null;
  let url;try{const src='const pxMed='+pxMed.toString()+';let pxWebpOk=null;const _f32=new Float32Array(1),_u32=new Uint32Array(_f32.buffer);\n'+
    [f2h,pxBytes,pxPredict,pxSolidPredict,pxWebp,streamThrough,pxPackCore].map(f=>f.toString()).join('\n')+
    '\nonmessage=async e=>{const {id,args}=e.data;try{const result=await pxPackCore(...args);postMessage({id,result},[result.bytes.buffer]);}catch(e){postMessage({id,error:e.message||String(e)});}};';
    url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));const n=Math.max(1,Math.min(4,(navigator.hardwareConcurrency||4)-2));
    const fail=e=>{e.preventDefault();for(const j of S.jobs.values())j.reject(new Error('Image packing failed. Please try saving again.'));S.jobs.clear();for(const w of S.pool)w.terminate();S.pool=[];S.worker=null;S.unavailable=true;};
    for(let i=0;i<n;i++){const worker=new Worker(url);worker.busy=0;
      worker.onmessage=e=>{const {id,result,error}=e.data,j=S.jobs.get(id);if(!j)return;S.jobs.delete(id);worker.busy--;if(error)j.reject(new Error(error));else{S.completed++;j.resolve(result);}};
      worker.onerror=fail;S.pool.push(worker);}
    S.worker=S.pool[0];return S.worker;
  }catch(e){for(const w of S.pool)w.terminate();S.pool=[];S.worker=null;S.unavailable=true;return null;}finally{if(url)URL.revokeObjectURL(url);}}
async function pxPack(raw,w,h,depth,lossy,owned=false){const worker=w*h>=65536?pxWorkerGet():null;
  if(!worker)return pxPackCore(raw,w,h,depth,lossy,pxSmall());
  const bytes=owned?raw:raw.slice(),S=pxWorkerState,id=++S.seq;
  return new Promise((resolve,reject)=>{const job={resolve:v=>{clearTimeout(job.to);resolve(v);},reject:e=>{clearTimeout(job.to);reject(e);},worker};S.jobs.set(id,job);worker.busy++;
    /* (0.74.3) a packing worker that never answers (out of memory on a 4096 px picture) must not hold a save for ever: after two minutes it is dropped, with every job it still had */
    job.to=setTimeout(()=>{try{worker.terminate();}catch(e){}S.pool=S.pool.filter(w=>w!==worker);if(S.worker===worker)S.worker=null;
      for(const [jid,j] of [...S.jobs])if(j.worker===worker){S.jobs.delete(jid);j.reject(new Error('Packing a picture took too long, so the save was stopped. Try again, or turn off Smaller files in Preferences › Files.'));}},120000);
    try{worker.postMessage({id,args:[bytes,w,h,depth,lossy,pxSmall()]},[bytes.buffer]);}catch(e){S.jobs.delete(id);worker.busy--;job.reject(e);}});}
async function pxPackSolid(color,w,h,depth){const args=[null,w,h,depth,false,false,color],worker=w*h>=65536?pxWorkerGet():null;if(!worker)return pxPackCore(...args);
  const S=pxWorkerState,id=++S.seq;return new Promise((resolve,reject)=>{S.jobs.set(id,{resolve,reject});worker.busy++;try{worker.postMessage({id,args});}catch(e){S.jobs.delete(id);worker.busy--;reject(e);}});}
/* unpack a stored picture back to raw pixels; f missing = an older file (plain deflate) */
async function pxUnpack(u8,w,h,depth,f){if(f==='w')return pxWebpDecode(u8,w,h);const raw=await streamThrough(u8,'deflate-raw',true);return f==='p'?pxUnpredict(raw,w,h,depth):raw;}
/* a picture in a .gmat: WebP for colour and grey channels with Smaller files on (smaller than PNG), else PNG */
/* (0.98) pictures that must stay exact (normal, height, masks) go into .gmat files as lossless WebP instead of PNG: the same
   pixels in roughly half the bytes. Only where the browser's WebP at full quality really is lossless (Chromium and the
   desktop app; checked once on a small test picture), otherwise PNG as before. Every version of the app can read both. */
let pxWebpExact=null;
function pxWebpExactCheck(){if(pxWebpExact!==null)return;pxWebpExact=false;
  try{const n=48,c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d',{willReadFrequently:true}),id=x.createImageData(n,n),d=id.data;let v=12345;
    for(let i=0;i<d.length;i+=4){for(let k=0;k<3;k++){v=(v*1103515245+12345)>>>0;d[i+k]=(v>>>16)&255;}d[i+3]=255;}x.putImageData(id,0,0);
    const u=c.toDataURL('image/webp',1);if(!u.startsWith('data:image/webp'))return;
    const im=new Image();im.onload=()=>{try{const c2=document.createElement('canvas');c2.width=c2.height=n;const x2=c2.getContext('2d',{willReadFrequently:true});x2.drawImage(im,0,0);const e=x2.getImageData(0,0,n,n).data;
      let same=true;for(let i=0;i<d.length;i++)if(e[i]!==d[i]){same=false;break;}pxWebpExact=same;}catch(er){}};im.src=u;}catch(e){}}
setTimeout(pxWebpExactCheck,3000);
function pxDataURL(c,key){if(pxSmall()&&PX_LOSSY.has(key)&&pxWebpOk!==false){const u=c.toDataURL('image/webp',.92);if(u.startsWith('data:image/webp'))return u;pxWebpOk=false;}
  if(pxWebpExact&&c.width<=16383&&c.height<=16383){const u=c.toDataURL('image/webp',1);if(u.startsWith('data:image/webp'))return u;}
  return c.toDataURL('image/png');}
/* (0.98.3, Kenn: smaller normal maps in saved files) a .gmat normal map as TWO grey pictures side by side (red | green) in one lossy
   WebP at .97, the blue rebuilt from them (unit length). About 6x smaller than the lossless picture for an error of 4-5 in 255.
   Only with Smaller files on, and only for fully opaque pictures; the image record carries n2:1. */
function pxNormalURL(c){if(!pxSmall()||pxWebpOk===false)return null;const w=c.width,h=c.height;if(w*2>16383||h>16383)return null;
  const x=c.getContext('2d',{willReadFrequently:true}),d=x.getImageData(0,0,w,h).data;for(let i=3;i<d.length;i+=4)if(d[i]!==255)return null;
  const o=document.createElement('canvas');o.width=w*2;o.height=h;const ox=o.getContext('2d',{willReadFrequently:true}),id=ox.createImageData(w*2,h),e=id.data;
  for(let y=0;y<h;y++)for(let X=0;X<w;X++){const s=(y*w+X)*4,a=(y*w*2+X)*4,b=(y*w*2+w+X)*4;e[a]=e[a+1]=e[a+2]=d[s];e[a+3]=255;e[b]=e[b+1]=e[b+2]=d[s+1];e[b+3]=255;}
  ox.putImageData(id,0,0);const u=o.toDataURL('image/webp',.97);return u.startsWith('data:image/webp')?u:null;}
/* the two grey halves back to a normal map (premultiplied, opaque) */
function pxNormalRead(img,w,h){const c=document.createElement('canvas');c.width=w*2;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);const d=x.getImageData(0,0,w*2,h).data,out=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let X=0;X<w;X++){const a=(y*w*2+X)*4,b=(y*w*2+w+X)*4,o=(y*w+X)*4,nx=d[a]/127.5-1,ny=d[b]/127.5-1,nz=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));out[o]=d[a];out[o+1]=d[b];out[o+2]=Math.round((nz*.5+.5)*255);out[o+3]=255;}
  return out;}
/* .gmat files are gzipped JSON (older ones are plain JSON: both open) */
async function gmatBlob(obj){return new Blob([await streamThrough(new TextEncoder().encode(JSON.stringify(obj)),'gzip')],{type:'application/octet-stream'});}
async function gmatParse(src){let b=src instanceof Uint8Array?src:new Uint8Array(await (src.arrayBuffer?src.arrayBuffer():new Response(src).arrayBuffer()));
  if(b[0]===0x1f&&b[1]===0x8b)b=await streamThrough(b,'gzip',true);return JSON.parse(new TextDecoder().decode(b));}
/* the Materials library on this computer (IndexedDB) keeps its pictures packed too (lossless) */
async function pxDeep(o,pack){if(!o||typeof o!=='object'||ArrayBuffer.isView(o)||o instanceof Blob)return o;
  if(pack&&o.data instanceof Uint8Array&&o.w&&o.h&&o.data.length===o.w*o.h*4){const c=await pxPack(o.data,o.w,o.h,8,false);const r={};for(const k in o)if(k!=='data'&&k[0]!=='_')r[k]=o[k];r.z=c.bytes;r.zf=c.f;return r;}
  if(!pack&&o.z instanceof Uint8Array&&o.zf&&o.w&&o.h){const r={};for(const k in o)if(k!=='z'&&k!=='zf')r[k]=o[k];r.data=await pxUnpack(o.z,o.w,o.h,8,o.zf);return r;}
  if(Array.isArray(o)){const a=[];for(const v of o)a.push(await pxDeep(v,pack));return a;}
  if(Object.getPrototypeOf(o)!==Object.prototype)return pack?undefined:o;/* GPU textures and the like stay in memory only */
  const r={};for(const k in o){if(pack&&k[0]==='_')continue;const v=await pxDeep(o[k],pack);if(v!==undefined)r[k]=v;}return r;}
{const put0=store.put.bind(store),all0=store.all.bind(store);
  store.put=async(d,sn)=>sn==='materials'||sn==='textures'?put0(await pxDeep(d,true),sn):put0(d,sn);
  store.all=async sn=>{const r=await all0(sn);if((sn!=='materials'&&sn!=='textures')||!r)return r;const out=[];for(const x of r){try{out.push(await pxDeep(x,false));}catch(e){console.warn('material',e);}}return out;};}
