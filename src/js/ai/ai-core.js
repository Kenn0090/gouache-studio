/* ================= AI add-ons: the engine and the model downloads (0.61) =================
   The AI features run on this computer: ONNX Runtime Web (on the graphics card through WebGPU, or on the processor) runs small open
   models. Nothing is sent anywhere. The engine and each model are downloaded once, checked, and kept in the browser's storage
   (IndexedDB 'gouache-ai'). The app itself stays small. Add or remove them in File › AI add-ons. */
const AI_ORT_VER='1.22.0',AI_CDN='https://cdn.jsdelivr.net/npm/onnxruntime-web@'+AI_ORT_VER+'/dist/';
const AI_HF=(repo,rev,f)=>'https://huggingface.co/'+repo+'/resolve/'+rev+'/'+f;
/* every part: what it is for, how big, who made it (and under which licence), and its files with a checksum */
const AI_PARTS={
  engine:{title:'AI engine',use:'Runs the models below on your graphics card (or the processor). Needed by every AI feature.',license:'MIT',credit:'ONNX Runtime by Microsoft',link:'https://github.com/microsoft/onnxruntime',
    files:[{n:'ort.webgpu.min.mjs',url:AI_CDN+'ort.webgpu.min.mjs',size:357582,sha:'e131e81c9324807e1e6f9103e8f8e936112827dcc9993cde9407a333b1f07ae0'},
      {n:'ort-wasm-simd-threaded.jsep.mjs',url:AI_CDN+'ort-wasm-simd-threaded.jsep.mjs',size:44677,sha:'1cbcba8f2c769c1eecbab66a1b1e55ef11704515bf4306373e3db3c37cf6dcd8'},
      {n:'ort-wasm-simd-threaded.jsep.wasm',url:AI_CDN+'ort-wasm-simd-threaded.jsep.wasm',size:21872216,sha:'b45970d0632383a057c27ca5b660b216f8e00c17cf8db9f6207b5e4abc839368'}]},
  sam:{title:'Select subject and sky',use:'Click an object (or press Select sky) and get a clean mask of it. Used in Photo, and in Select in Paint.',license:'Apache 2.0',credit:'SlimSAM (from Segment Anything by Meta), ONNX by Xenova',link:'https://huggingface.co/Xenova/slimsam-77-uniform',
    files:[{n:'vision_encoder.onnx',url:AI_HF('Xenova/slimsam-77-uniform','5850ab45f587c112167512ffef949107115e26a0','onnx/vision_encoder.onnx'),size:23276014,sha:'9f8433273a6750b587779baa0cf5508111001bf7e7acfcf585d370139fd366d0'},
      {n:'mask_decoder.onnx',url:AI_HF('Xenova/slimsam-77-uniform','5850ab45f587c112167512ffef949107115e26a0','onnx/prompt_encoder_mask_decoder.onnx'),size:16557892,sha:'f4514391764fbd56e08e119060d874ecd7d52994bfb1968af159e12d4943b5bb'}]},
  depth:{title:'Depth (Lens blur, Relight, height from a photo)',use:'Works out how far away each part of a photo is. Lens blur and Relight use it, and so does the Convert tab’s height map.',license:'Apache 2.0',credit:'Depth Anything V2 Small, ONNX by onnx-community',link:'https://huggingface.co/onnx-community/depth-anything-v2-small',
    files:[{n:'depth.onnx',url:AI_HF('onnx-community/depth-anything-v2-small','4472b7362082ad9968fee890ca0f1e5aca36b93d','onnx/model.onnx'),size:99060839,sha:'afb6a5c28f3b6bf1618c6e43f02073ef9dfdc70e937502d51603e57b0a1df10c'}]},
  lama:{title:'Remove',use:'Takes an object out of a picture and fills the gap from what is around it.',license:'Apache 2.0',credit:'LaMa by Samsung AI Center, ONNX by Carve',link:'https://huggingface.co/Carve/LaMa-ONNX',
    files:[{n:'lama.onnx',url:AI_HF('Carve/LaMa-ONNX','c3c0c9e468934d62e79c329e35d82dd09ff8c444','lama_fp32.onnx'),size:208044816,sha:'1faef5301d78db7dda502fe59966957ec4b79dd64e16f03ed96913c7a4eb68d6'}]}};
const AI_ORDER=['engine','sam','depth','lama'];
const AI={have:{},sess:{},ort:null,ortP:null,busy:null,urlFix:null,dev:null};
const aiMB=b=>b>=1e8?Math.round(b/1e6)+' MB':(b/1e6).toFixed(b<1e7?1:0)+' MB';
const aiSize=id=>AI_PARTS[id].files.reduce((a,f)=>a+f.size,0);
/* ---- storage ---- */
const aiDB={open(){if(this.db)return Promise.resolve(this.db);return new Promise((res,rej)=>{try{const r=indexedDB.open('gouache-ai',1);r.onupgradeneeded=()=>{r.result.createObjectStore('files');};r.onsuccess=()=>{this.db=r.result;res(r.result);};r.onerror=()=>rej(r.error);}catch(e){rej(e);}});},
  async get(k){const db=await this.open();return new Promise((res,rej)=>{const q=db.transaction('files').objectStore('files').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});},
  async put(k,v){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('files','readwrite');t.objectStore('files').put(v,k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error);});},
  async del(k){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('files','readwrite');t.objectStore('files').delete(k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error);});}};
async function aiRefresh(){for(const id of AI_ORDER){let ok=true;for(const f of AI_PARTS[id].files){let v=null;try{v=await aiDB.get(id+'/'+f.n);}catch(e){}if(!v||v.sha!==f.sha){ok=false;break;}}AI.have[id]=ok;}
  if(typeof aiUiSync==='function')aiUiSync();return AI.have;}
const aiHas=id=>!!AI.have[id];
/* ---- downloading ---- */
async function aiSha(buf){const h=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function aiFetchFile(f,onBytes){const url=AI.urlFix?AI.urlFix(f.url,f):f.url,r=await fetch(url);if(!r.ok)throw new Error('The download of '+f.n+' failed ('+r.status+').');
  const total=+r.headers.get('content-length')||f.size,chunks=[];let got=0;
  if(r.body&&r.body.getReader){const rd=r.body.getReader();for(;;){const {done,value}=await rd.read();if(done)break;chunks.push(value);got+=value.length;onBytes(got,total);}}else{const b=new Uint8Array(await r.arrayBuffer());chunks.push(b);got=b.length;onBytes(got,total);}
  const out=new Uint8Array(got);let o=0;for(const c of chunks){out.set(c,o);o+=c.length;}return out.buffer;}
/* download one part; onProgress(0..1, text) */
async function aiInstall(id,onProgress){const P=AI_PARTS[id],tot=aiSize(id);let done=0;
  for(const f of P.files){const buf=await aiFetchFile(f,(g)=>{if(onProgress)onProgress((done+g)/tot,P.title+' · '+f.n);});
    const sha=await aiSha(buf);if(sha!==f.sha&&!AI.urlFix)throw new Error('The file '+f.n+' did not match its checksum. Please try again.');
    await aiDB.put(id+'/'+f.n,{buf,sha:f.sha,size:buf.byteLength,v:1});done+=f.size;}
  AI.have[id]=true;delete AI.sess[id];if(id==='engine'){AI.ort=null;AI.ortP=null;}if(typeof aiUiSync==='function')aiUiSync();}
async function aiRemove(id){for(const f of AI_PARTS[id].files)await aiDB.del(id+'/'+f.n);AI.have[id]=false;aiFree(id);if(id==='engine'){AI.ort=null;AI.ortP=null;}if(typeof aiUiSync==='function')aiUiSync();}
/* ---- the engine ---- */
async function aiGPU(){if(AI.dev)return AI.dev;let d={gpu:false,f16:false};try{if(navigator.gpu){const a=await navigator.gpu.requestAdapter();if(a)d={gpu:true,f16:a.features.has('shader-f16'),name:(a.info&&(a.info.description||a.info.device))||''};}}catch(e){}AI.dev=d;return d;}
async function aiEngine(){if(AI.ort)return AI.ort;if(AI.ortP)return AI.ortP;
  AI.ortP=(async()=>{if(!AI.have.engine)await aiRefresh();if(!AI.have.engine)throw new Error('The AI engine is not installed. Open File › AI add-ons to install it.');
    const get=async n=>{const v=await aiDB.get('engine/'+n);if(!v)throw new Error('The AI engine is incomplete.');return v.buf;};
    const js=URL.createObjectURL(new Blob([await get('ort.webgpu.min.mjs')],{type:'text/javascript'})),mjs=URL.createObjectURL(new Blob([await get('ort-wasm-simd-threaded.jsep.mjs')],{type:'text/javascript'})),
      wasm=URL.createObjectURL(new Blob([await get('ort-wasm-simd-threaded.jsep.wasm')],{type:'application/wasm'}));
    const ort=await import(js);ort.env.wasm.wasmPaths={mjs,wasm};ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';AI.ort=ort;return ort;})();
  try{return await AI.ortP;}catch(e){AI.ortP=null;throw e;}}
/* a model ready to run. Tries the graphics card first, falls back to the processor. */
async function aiSession(part,file){const key=part+'/'+file;if(AI.sess[key])return AI.sess[key];
  const ort=await aiEngine(),v=await aiDB.get(key);if(!v)throw new Error('This AI model is not installed. Open File › AI add-ons.');
  const pref=(typeof prefs!=='undefined'&&prefs.aiDevice)||'auto',dev=await aiGPU(),tries=(pref==='cpu'||!dev.gpu)?['wasm']:pref==='gpu'?['webgpu']:['webgpu','wasm'];let err=null;
  for(const ep of tries){try{const s=await ort.InferenceSession.create(new Uint8Array(v.buf),{executionProviders:[ep],graphOptimizationLevel:'all'});s._ep=ep;AI.sess[key]=s;AI.lastEp=ep;return s;}catch(e){err=e;console.warn('AI: '+ep+' failed for '+key,e);}}
  throw new Error('This AI model could not start: '+((err&&err.message)||err));}
function aiFree(part){for(const k of Object.keys(AI.sess))if(!part||k.startsWith(part+'/')){try{AI.sess[k].release&&AI.sess[k].release();}catch(e){}delete AI.sess[k];}}
/* run with the loading bar showing */
async function aiBusy(label,fn){if(AI.busy)throw new Error('Another AI job is still running.');AI.busy=label;loadStart(label);loadSet(.05,'Starting…');await new Promise(r=>setTimeout(r,30));
  try{return await fn(p=>loadSet(.05+.9*clamp(p,0,1),'Working…'));}finally{AI.busy=null;loadEnd();}}
/* the pixels of a target as an 8-bit RGBA picture (straight alpha) at a chosen size */
function aiPixels(t,maxSide){const k=Math.min(1,maxSide/Math.max(t.w,t.h)),w=Math.max(2,Math.round(t.w*k)),h=Math.max(2,Math.round(t.h*k));let src=t,tmp=null;
  if(k<1){tmp=makeTarget(w,h,8,false);run(P.resample,tmp,{uSrc:t.tex,uOffset:[0,0],uScale:[t.w/w,t.h/h],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(t.w/w)))}});src=tmp;}
  try{const d=captureRegionNow(src,0,0,src.w,src.h).data,out=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){const a=d[i*4+3]||0;if(a>0){const m=255/a;out[i*4]=Math.min(255,d[i*4]*m);out[i*4+1]=Math.min(255,d[i*4+1]*m);out[i*4+2]=Math.min(255,d[i*4+2]*m);out[i*4+3]=a;}}return {w,h,data:out};}finally{if(tmp)disposeTarget(tmp);}}
