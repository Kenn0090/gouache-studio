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
  const c=new OffscreenCanvas(w,h),x=c.getContext('2d');x.drawImage(bm,0,0);bm.close&&bm.close();const d=x.getImageData(0,0,w,h).data,out=new Uint8Array(w*h*4);
  for(let i=0;i<d.length;i+=4){const a=d[i+3],f=a/255;out[i]=Math.round(d[i]*f);out[i+1]=Math.round(d[i+1]*f);out[i+2]=Math.round(d[i+2]*f);out[i+3]=a;}return out;}
/* pack: {bytes, f} ('p' lossless, 'w' WebP); lossy only when asked and Smaller files is on, and only if it is smaller */
async function pxPack(raw,w,h,depth,lossy){const z=await streamThrough(pxPredict(raw,w,h,depth),'deflate-raw');
  if(lossy&&depth!==16&&pxSmall()&&w*h>=4096){const wb=await pxWebp(raw,w,h);if(wb&&wb.length<z.length*.8)return {bytes:wb,f:'w'};}
  return {bytes:z,f:'p'};}
/* unpack a stored picture back to raw pixels; f missing = an older file (plain deflate) */
async function pxUnpack(u8,w,h,depth,f){if(f==='w')return pxWebpDecode(u8,w,h);const raw=await streamThrough(u8,'deflate-raw',true);return f==='p'?pxUnpredict(raw,w,h,depth):raw;}
/* a picture in a .gmat: WebP for colour and grey channels with Smaller files on (smaller than PNG), else PNG */
function pxDataURL(c,key){if(pxSmall()&&PX_LOSSY.has(key)&&pxWebpOk!==false){const u=c.toDataURL('image/webp',.92);if(u.startsWith('data:image/webp'))return u;pxWebpOk=false;}return c.toDataURL('image/png');}
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
  store.put=async(d,sn)=>sn==='materials'?put0(await pxDeep(d,true),sn):put0(d,sn);
  store.all=async sn=>{const r=await all0(sn);if(sn!=='materials'||!r)return r;const out=[];for(const x of r){try{out.push(await pxDeep(x,false));}catch(e){console.warn('material',e);}}return out;};}
