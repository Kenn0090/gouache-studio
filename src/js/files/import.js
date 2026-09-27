/* ================= Upload + place ================= */
function uploadStraight(raw){
  if(raw.w>GL_MAX||raw.h>GL_MAX)throw new Error('This image is '+raw.w+'×'+raw.h+', larger than this GPU can hold ('+GL_MAX+' px).');
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  if(raw.el){gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,raw.el);}
  else if(raw.data instanceof Uint16Array||raw.data instanceof Float32Array){const d=raw.data,f=new Float32Array(d.length);
    if(d instanceof Uint16Array)for(let i=0;i<d.length;i++)f[i]=d[i]/65535;else for(let i=0;i<d.length;i++)f[i]=(i&3)===3?d[i]:lin2srgb(Math.max(0,d[i]));
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,raw.w,raw.h,0,gl.RGBA,gl.FLOAT,f);}
  else{const d=raw.data;gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,raw.w,raw.h,0,gl.RGBA,gl.UNSIGNED_BYTE,d instanceof Uint8Array?d:new Uint8Array(d.buffer,d.byteOffset,d.length));}
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;
}
function uploadMask(md){const n=md.width*md.height,a=new Uint8Array(n),d=md.data,sh=d instanceof Uint16Array?8:0,st=d.length>=n*4?4:1;
  for(let i=0;i<n;i++)a[i]=d[i*st]>>sh;const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,md.width,md.height,0,gl.RED,gl.UNSIGNED_BYTE,a);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);return t;}
function premultInto(target,tex,off,mask){run(P.place,target,{uSrc:tex,uOff:off,uMask:mask?mask.tex:dummy,uMaskRect:mask?mask.rect:[0,0,0,0],uMaskDefault:mask?mask.def:1,uUseMask:!!mask});}
function drawRawInto(target,raw,fit){
  const iw=raw.w,ih=raw.h,tex=uploadStraight(raw),tmp=makeTarget(iw,ih,doc.depth,false);premultInto(tmp,tex,[0,0],null);gl.deleteTexture(tex);
  const W=target.w,H=target.h,s=fit?Math.min(1,W/iw,H/ih):1,ox=s===1?Math.round((W-iw)/2):(W-iw*s)/2,oy=s===1?Math.round((H-ih)/2):(H-ih*s)/2;
  run(P.resample,target,{uSrc:tmp.tex,uOffset:[ox,oy],uScale:[1/s,1/s],uTaps:{int:Math.min(8,Math.ceil(1/s))}});disposeTarget(tmp);
}
function openRaw(raw,name){const s=Math.min(1,MAX_DIM/raw.w,MAX_DIM/raw.h),depth=raw.bits>8&&canFloat?16:doc.depth;
  const L=newDoc(Math.max(1,Math.round(raw.w*s)),Math.max(1,Math.round(raw.h*s)),depth,null,name,false);L.name=name;drawRawInto(L.target,raw,true);changedAll();updateStatus();
  toast('Opened '+raw.w+' × '+raw.h+(raw.bits>8?' at 16 bits per channel':'')+(s<1?', scaled to fit '+MAX_DIM+' px':'')+'.');}
function placeRaw(raw,name){const L=cmdAddLayer(name);drawRawInto(L.target,raw,true);changed(L);toast('Placed “'+name+'” as a new layer.');}
async function decodeFile(file){const ext=extOf(file.name);
  if(ext==='tga')return decodeTGA(await file.arrayBuffer());
  if(ext==='dds')return decodeDDS(await file.arrayBuffer());
  if(ext==='tif'||ext==='tiff')return decodeTIFF(await file.arrayBuffer());
  if(ext==='psd'){needLib('agPsd','PSD');const psd=agPsd.readPsd(await file.arrayBuffer(),{useImageData:true,skipThumbnail:true,skipLayerImageData:true});
    if(!psd.imageData)throw new Error('This PSD was saved without a flattened image. Use File › Open to bring in its layers.');return {w:psd.width,h:psd.height,data:psd.imageData.data,bits:psd.bitsPerChannel||8};}
  return loadImageEl(file);}
function askReplace(){if(!hist.undo.length||hist.undo[hist.undo.length-1]===doc.savedAt)return Promise.resolve(true);return new Promise(res=>{openDialog({title:'Replace the current painting?',
  body:el('p',{class:'note',text:'Opening a file replaces what is on the canvas. Use File › Save first if you want to keep it.'}),okLabel:'Open anyway',onOk(){res(true);},onCancel(){res(false);}});});}
async function handleFile(file,mode,path){const ext=extOf(file.name);loadStart(file.name);
  try{if(!['abr','ttf','otf','woff','woff2'].includes(ext)){loadBusy(mode==='open'?'Opening…':'Placing…');await loadPaint();}if(ext==='abr'){await importABR(file);return;}
    if(['ttf','otf','woff','woff2'].includes(ext)){await addFontFile(file);return;}
    if(mode==='open'){if(!(await askReplace()))return;const head=await file.slice(0,8).arrayBuffer();if(ext==='gouache'||isGouache(head)){await openGouache(await file.arrayBuffer(),baseName(file.name));doc.filePath=path||null;markSaved();}else if(ext==='psd'){await openPSD(await file.arrayBuffer(),baseName(file.name));doc.filePath=path||null;}else{openRaw(await decodeFile(file),baseName(file.name));doc.filePath=null;}
      if(path)platform.recentAdd(path);updateTitle();}
    else if(ui.mode==='anim')toast('To bring images into an animation, use Import in the timeline.');else placeRaw(await decodeFile(file),baseName(file.name)||'Pasted image');}
  catch(e){console.error(e);toast(e.message||String(e));}finally{loadEnd();}}
let fileMode='open';
const OPEN_FILTERS={open:[{name:'Images and documents',extensions:['gouache','psd','png','jpg','jpeg','webp','gif','bmp','tga','dds','tif','tiff']},{name:'Brushes and fonts',extensions:['abr','ttf','otf','woff','woff2']}],
  place:[{name:'Images',extensions:['psd','png','jpg','jpeg','webp','gif','bmp','tga','dds','tif','tiff']}],abr:[{name:'Photoshop brushes',extensions:['abr']}],font:[{name:'Fonts',extensions:['ttf','otf','woff','woff2']}]};
const MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',bmp:'image/bmp'};
/* desktop: open a file from disk by path (native dialog, recent files) */
async function openPath(path,mode){try{loadStart(fileNameOf(path));let bytes;try{bytes=await platform.readFile(path);}finally{loadEnd();}const name=fileNameOf(path);
    await handleFile(new File([bytes],name,{type:MIME[extOf(name)]||''}),mode,path);}catch(e){console.error(e);toast('Could not open “'+fileNameOf(path)+'”: '+(e.message||e));}}
async function pickFile(m){if(platform.isDesktop){try{const p=await platform.openDialog(OPEN_FILTERS[m]||OPEN_FILTERS.open);if(p)await openPath(p,m==='abr'||m==='font'?'open':m);}catch(e){toast('The file dialog failed: '+(e.message||e));}return;}
  pickFileWeb(m);}
function pickFileWeb(m){fileMode=m;const f=$('#fileIn');f.accept=m==='font'?'.ttf,.otf,.woff,.woff2':m==='abr'?'.abr':(m==='open'?'.gouache,':'')+'.psd,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tga,.dds,.tif,.tiff,.abr,image/*';f.value='';f.click();}
$('#fileIn').addEventListener('change',e=>{const f=e.target.files[0];if(f)handleFile(f,fileMode==='abr'||fileMode==='font'?'open':fileMode);});
$('#work').addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();$('#dropHint').hidden=false;}});
$('#work').addEventListener('dragleave',e=>{if(e.target===$('#work')||!$('#work').contains(e.relatedTarget))$('#dropHint').hidden=true;});
$('#work').addEventListener('drop',e=>{e.preventDefault();$('#dropHint').hidden=true;const fs=[...e.dataTransfer.files],f=fs[0];if(!f)return;
  /* 3D models: into the baker in the Bake tab, into the 3D view otherwise */
  if(fs.some(x=>isModelName(x.name))){if(ui.mode==='bake')bakeDropFiles(fs,null);else v3DropModel(fs);return;}
  if(ui.mode==='convert'){cvSourceFromFile(f);return;}
  handleFile(f,'place');});
/* model files dropped on the Bake panel */
bakeDropZone($('#bakeSec'),null);
/* images dropped on the Convert panel become the source */
(s=>{s.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();s.classList.add('dropon');}});s.addEventListener('dragleave',()=>s.classList.remove('dropon'));
  s.addEventListener('drop',e=>{e.preventDefault();s.classList.remove('dropon');const f=e.dataTransfer.files[0];if(f)cvSourceFromFile(f);});})($('#convSec'));
/* paste: our own copied pixels (the clipboard holds a marker for them), else an image from another app */
document.addEventListener('paste',e=>{if(isTypingTarget(e.target))return;const cd=e.clipboardData,txt=cd?cd.getData('text/plain'):'';
  if(clip&&txt===clip.marker){e.preventDefault();pasteClip();return;}
  const it=[...(cd?cd.items:[])].find(i=>i.type.startsWith('image/'));if(it){e.preventDefault();const f=it.getAsFile();handleFile(new File([f],'Pasted image.png',{type:f.type}),'place');return;}
  if(clip&&!txt){e.preventDefault();pasteClip();}});
