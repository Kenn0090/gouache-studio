/* ---- RAW photos (0.60): LibRaw (through libraw-wasm) turns the camera file into colour; it runs in a worker of its own and is thrown away after each photo so its memory is given back ---- */
function phRawBytes(name){const tag=document.getElementById('raw_'+name.replace(/\W/g,'_'));
  if(tag){const b=atob(tag.textContent.trim()),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return Promise.resolve(u);}
  return fetch('raw/'+name).then(r=>{if(!r.ok)throw new Error('The RAW reader is missing from this copy of the app.');return r.arrayBuffer();}).then(b=>new Uint8Array(b));}
async function phRawGunzip(u8){if(u8[0]!==0x1f||u8[1]!==0x8b)return u8;const ds=new DecompressionStream('gzip'),w=ds.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer());}
const phRawCache={wasm:null,js:null,url:null};
async function phRawStart(){
  if(!phRawCache.wasm){const [w,j]=await Promise.all([phRawBytes('libraw.wasm').then(phRawGunzip),phRawBytes('worker.js')]);phRawCache.wasm=w;phRawCache.js=new TextDecoder().decode(j);
    phRawCache.url=await new Promise((res,rej)=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=()=>rej(f.error);f.readAsDataURL(new Blob([w],{type:'application/wasm'}));});}
  const src=phRawCache.js.replace('new URL("libraw.wasm",import.meta.url).href',JSON.stringify(phRawCache.url)).split('import.meta.url').join('self.location.href'),
    jsUrl=URL.createObjectURL(new Blob([src],{type:'text/javascript'})),worker=new Worker(jsUrl),pending=new Map();let nextId=0;
  worker.onmessage=({data:e})=>{const t=pending.get(e&&e.id);if(!t)return;pending.delete(e.id);if(e.error)t.reject(new Error(e.error));else t.resolve(e.out);};
  worker.onerror=e=>{for(const t of pending.values())t.reject(new Error('The RAW reader stopped: '+(e.message||'unknown error')));pending.clear();};
  const call=(fn,...args)=>new Promise((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});const tr=args.map(a=>a&&a.buffer instanceof ArrayBuffer?a.buffer:null).filter(Boolean);worker.postMessage({id,fn,args},tr);});
  return {call,close(){worker.terminate();URL.revokeObjectURL(jsUrl);for(const t of pending.values())t.reject(new Error('closed'));pending.clear();}};}
let phRawLock=Promise.resolve();
function phRawJob(fn){const run=phRawLock.then(fn,fn);phRawLock=run.then(()=>{},()=>{});return run;}
/* the sensor's turn (LibRaw "flip" 5 and 6 are quarter turns) */
function phRawDims(m){const w=m.width,h=m.height,f=m.flip|0;return f===5||f===6?[h,w]:[w,h];}
async function phRawDecode(file,opt){opt=opt||{};
  return phRawJob(async()=>{const bytes=new Uint8Array(await file.arrayBuffer()),R=await phRawStart();
    try{
      const quick=!!opt.quick;
      await R.call('open',bytes,{useCameraWb:true,outputBps:16,outputColor:1,noAutoBright:true,highlight:0,userQual:3,halfSize:false});
      const m=await R.call('metadata',false);
      if(quick){let bm=null;
        try{const t=await R.call('thumbnailData');if(t&&t.data&&t.data.length&&t.format==='jpeg')bm=await createImageBitmap(new Blob([t.data],{type:'image/jpeg'}),{imageOrientation:'from-image'});}catch(e){bm=null;}
        const [w,h]=phRawDims(m);
        if(bm)return {bm,w,h,quick:true};
        /* no picture inside the file: a quick half-size development for the strip */
        await R.call('open',bytes,{useCameraWb:true,outputBps:8,outputColor:1,noAutoBright:true,highlight:0,userQual:0,halfSize:true});
        const q=await R.call('imageData'),n=q.width*q.height,px=new Uint8ClampedArray(n*4),ch=q.colors||3;
        for(let i=0;i<n;i++){px[i*4]=q.data[i*ch];px[i*4+1]=q.data[i*ch+(ch>1?1:0)];px[i*4+2]=q.data[i*ch+(ch>2?2:0)];px[i*4+3]=255;}
        return {bm:await createImageBitmap(new ImageData(px,q.width,q.height)),w,h,quick:true};}
      const img=await R.call('imageData');if(!img||!img.data)throw new Error('This RAW file could not be developed.');
      return {rgb16:img.data,w:img.width,h:img.height,colors:img.colors||3,meta:m};
    }finally{R.close();}});}
/* 16-bit RGB from LibRaw → half-float texture, a band of rows at a time so a 24-megapixel photo does not need a second copy in memory */
function phUploadRgb16(dec,target){const w=dec.w,h=dec.h,src=dec.rgb16,ch=dec.colors||3,rows=Math.max(1,Math.min(h,Math.floor(4e6/w))),buf=new Float32Array(w*rows*4);
  gl.bindTexture(gl.TEXTURE_2D,target.tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  for(let y0=0;y0<h;y0+=rows){const n=Math.min(rows,h-y0);let o=0,s=(y0*w)*ch;
    for(let i=0,c=w*n;i<c;i++){const g=src[s];buf[o]=g/65535;buf[o+1]=(ch>1?src[s+1]:g)/65535;buf[o+2]=(ch>2?src[s+2]:g)/65535;buf[o+3]=1;o+=4;s+=ch;}
    gl.texSubImage2D(gl.TEXTURE_2D,0,0,y0,w,n,gl.RGBA,gl.FLOAT,n===rows?buf:buf.subarray(0,w*n*4));}
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);}
