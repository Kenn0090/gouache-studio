/* ================= Photo tab (0.60, Kenn): Lightroom-style editing =================
   A tab with a canvas of its own (like Convert). Photos stay as they were: edits are settings, saved beside the photo and always
   changeable. Left to right: the photos (bottom shelf), the picture, and the Develop panel. */
const ph={photos:[],cur:-1,out:null,dirty:true,show:'edit',crop:false,clip:null,open:{light:true,color:false,curve:false,mix:false,grade:false,detail:false,effects:false,geo:false},seq:0,hist:null,live:0,rtimer:0,vp:0};
const PH_EXTS=['jpg','jpeg','png','webp','avif','bmp','gif','tif','tiff'];
const PH_RAW=['cr2','cr3','nef','nrw','arw','sr2','srf','dng','raf','orf','rw2','pef','srw','x3f','3fr','erf','kdc','mef','mos','mrw'];
const phP=()=>ph.photos[ph.cur]||null;
/* the settings being edited */
const phS=()=>{const p=phP();return p?p.s:null;};
const phPathGet=(o,path)=>path.split('.').reduce((a,k)=>a==null?a:a[k],o);
function phPathSet(o,path,v){const ks=path.split('.'),last=ks.pop(),t=ks.reduce((a,k)=>a[k],o);t[last]=v;}
/* ---- entering and leaving the tab ---- */
function photoEnter(){const own=tabDocs.own.photo,p=phP();tabDocEnter('photo',own?own.doc.w:1200,own?own.doc.h:800,'Photo');
  phBuildPanel();phBuildLib();if(p)phSizeDoc();phDirty();resizeGL();fit();requestRender(true);}
function photoExit(){phSidecarFlush();tabDocExit('photo');ph.crop=false;resizeGL();fit();requestRender(true);}
/* the canvas shows the edited picture */
function phViewTex(){const p=phP();if(!p||!p.psrc){if(!ph.empty||ph.empty.w!==doc.w||ph.empty.h!==doc.h){if(ph.empty)disposeTarget(ph.empty);ph.empty=makeTarget(Math.max(2,doc.w),Math.max(2,doc.h),8,false);clearTarget(ph.empty,[.1,.1,.11,1]);}return ph.empty;}
  phUpdate();return ph.out;}
function phDepth(){return canFloat?16:8;}
/* the canvas follows the size of the cropped picture (long side up to the preview size) */
function phPreviewMax(){return platform.isDesktop?3072:2048;}
function phSizeDoc(){const p=phP();if(!p)return;const s=ph.crop?Object.assign({},p.s,{geo:Object.assign({},p.s.geo,{crop:[0,0,1,1]})}):p.s,[ow,oh]=phOutSize(s,p.pw,p.ph);
  if(doc.w!==ow||doc.h!==oh){tabDocResize(ow,oh,'Photo');}}
function phUpdate(){const p=phP();if(!p||!p.psrc)return;if(!ph.dirty&&ph.out&&ph.out.w===doc.w&&ph.out.h===doc.h)return;
  if(!ph.out||ph.out.w!==doc.w||ph.out.h!==doc.h){if(ph.out)disposeTarget(ph.out);ph.out=makeTarget(doc.w,doc.h,phDepth(),false);}
  let s=ph.show==='before'?phDefaultsKeepGeo(p.s):p.s;if(ph.crop)s=Object.assign({},s,{geo:Object.assign({},s.geo,{crop:[0,0,1,1]})});
  phRender(p.psrc,ph.out,s,{seed:p.seed||0,showId:ph.show!=='before'&&ph.lm&&ph.lm.show?ph.lm.sel:null,clip:!!ph.clipWarn});ph.dirty=false;phHistSoon();}
/* the original picture keeps its turn and crop; only the edits go */
function phDefaultsKeepGeo(s){const d=phDefaults();d.geo=phClone(s.geo);return d;}
function phDirty(){ph.dirty=true;requestRender(true);}
/* ---- reading photos ---- */
async function phDecode(file,opt){if(!file)throw new Error('No file');const ext=((file.name||'').split('.').pop()||'').toLowerCase();
  if(PH_RAW.includes(ext)){if(typeof phRawDecode==='function')return phRawDecode(file,opt);throw new Error('RAW photos need the RAW reader.');}
  if(ext==='tif'||ext==='tiff'){const r=await phTiff(file);if(r)return r;}
  const bm=await createImageBitmap(file,{imageOrientation:'from-image',premultiplyAlpha:'none',colorSpaceConversion:'default'});return {bm,w:bm.width,h:bm.height};}
async function phTiff(file){try{if(typeof decodeTIFF==='function'){const raw=await decodeTIFF(await file.arrayBuffer());if(raw&&raw.w){return {raw,w:raw.w,h:raw.h};}}}catch(e){}return null;}
function phDecDepth(dec){return dec.rgb16?16:8;}
function phUploadInto(dec,target){if(dec.rgb16)return phUploadRgb16(dec,target);const tex=uploadStraight(dec.bm?{w:dec.w,h:dec.h,el:dec.bm}:dec.raw);try{premultInto(target,tex,[0,0],null);}finally{gl.deleteTexture(tex);}}
/* a small picture of it for the strip */
function phThumb(dec){const S=140,k=Math.min(1,S/Math.max(dec.w,dec.h)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(dec.w*k));c.height=Math.max(1,Math.round(dec.h*k));
  const x=c.getContext('2d');if(dec.bm){x.imageSmoothingQuality='high';x.drawImage(dec.bm,0,0,c.width,c.height);}else{const t=makeTarget(dec.w,dec.h,8,false),sm=makeTarget(c.width,c.height,8,false);try{phUploadInto(dec,t);run(P.resample,sm,{uSrc:t.tex,uOffset:[0,0],uScale:[dec.w/c.width,dec.h/c.height],uTaps:{int:4}});
    const px=captureRegionNow(sm,0,0,sm.w,sm.h).data,id=new ImageData(sm.w,sm.h);for(let y=0;y<sm.h;y++)for(let xx=0;xx<sm.w;xx++){const i=(y*sm.w+xx)*4,j=(y*sm.w+xx)*4,a=px[i+3]||1;id.data[j]=px[i]*255/a;id.data[j+1]=px[i+1]*255/a;id.data[j+2]=px[i+2]*255/a;id.data[j+3]=255;}x.putImageData(id,0,0);}finally{disposeTarget(t);disposeTarget(sm);}}
  return c.toDataURL('image/jpeg',.82);}
async function phAddFiles(files){let first=-1;loadStart('Opening photos');try{let k=0;for(const f of files){loadSet(k++/files.length,f.name);
    try{const dec=await phDecode(f,{quick:true}),p={id:++ph.seq,name:f.name,file:f,path:f.gsPath||null,w:dec.w,h:dec.h,s:phDefaults(),thumb:phThumb(dec),hist:null,snaps:[],seed:ph.seq*7.13,rating:0,flag:0};
      if(dec.bm&&dec.bm.close)dec.bm.close();phSidecarLoad(p);ph.photos.push(p);if(first<0)first=ph.photos.length-1;}
    catch(e){console.warn(e);toast('“'+f.name+'” could not be opened: '+(e.message||e));}await new Promise(r=>setTimeout(r,0));}}finally{loadEnd();}
  phBuildLib();if(first>=0&&(ph.cur<0||ph.cur>=ph.photos.length))await phSelect(first);else if(first>=0)await phSelect(first);}
async function phSelect(i){if(i<0||i>=ph.photos.length)return;if(ph.cur===i&&phP()&&phP().psrc)return;phSidecarFlush();const old=phP();if(old&&old.psrc){disposeTarget(old.psrc);old.psrc=null;}
  ph.cur=i;if(ph.lm){ph.lm.sel=null;ph.lm.tool=null;}if(ph.sp){ph.sp.sel=null;ph.sp.tool=false;}const p=phP();loadStart('Opening '+p.name);
  try{const dec=await phDecode(p.file),k=Math.min(1,phPreviewMax()/Math.max(dec.w,dec.h));p.w=dec.w;p.h=dec.h;p.pw=Math.max(2,Math.round(dec.w*k));p.ph=Math.max(2,Math.round(dec.h*k));
    const full=makeTarget(dec.w,dec.h,phDecDepth(dec),false);try{phUploadInto(dec,full);p.psrc=makeTarget(p.pw,p.ph,phDecDepth(dec),false);
      if(k===1)blit(full,p.psrc,0,0,dec.w,dec.h,0,0);else run(P.resample,p.psrc,{uSrc:full.tex,uOffset:[0,0],uScale:[dec.w/p.pw,dec.h/p.ph],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(dec.w/p.pw)))}});}finally{disposeTarget(full);}
    if(dec.bm&&dec.bm.close)dec.bm.close();}
  catch(e){console.error(e);toast('This photo could not be read: '+(e.message||e));ph.cur=-1;loadEnd();phBuildLib();return;}
  loadEnd();if(!p.hist)p.hist={list:[{label:'Open',s:phClone(p.s)}],i:0};ph.crop=false;phFreeCache();phSizeDoc();phBuildPanel();phBuildLib();phDirty();fit();requestRender(true);}
async function phOpenDialog(){const files=await phPickFiles();if(files.length)await phAddFiles(files);}
async function phPickFiles(){if(platform.isDesktop){try{const paths=await platform.openFiles([{name:'Photos',extensions:[...PH_EXTS,...PH_RAW]}],true);if(!paths||!paths.length)return [];const out=[];
      for(const path of paths){const b=await platform.readFile(path),f=new File([b],fileNameOf(path));f.gsPath=path;out.push(f);}return out;}catch(e){toast('The file dialog failed: '+(e.message||e));return [];}}
  return pickFiles('image/*,'+PH_RAW.map(x=>'.'+x).join(','),true,'Photos',[...PH_EXTS,...PH_RAW]);}
/* ---- edits: settings with history ---- */
function phCommit(label){const p=phP();if(!p||!p.hist)return;const h=p.hist,cur=JSON.stringify(p.s);if(JSON.stringify(h.list[h.i].s)===cur)return;h.list=h.list.slice(0,h.i+1);h.list.push({label,s:phClone(p.s)});if(h.list.length>200)h.list.shift();h.i=h.list.length-1;phSidecarSoon();phRenderHist();}
function phHistGo(i){const p=phP();if(!p||!p.hist)return;const h=p.hist;i=clamp(i,0,h.list.length-1);h.i=i;p.s=phClone(h.list[i].s);phAfterSet();}
function phUndo(){const p=phP();if(p&&p.hist&&p.hist.i>0)phHistGo(p.hist.i-1);}
function phRedo(){const p=phP();if(p&&p.hist&&p.hist.i<p.hist.list.length-1)phHistGo(p.hist.i+1);}
function phSet(path,v,label){const s=phS();if(!s)return;phPathSet(s,path,v);phDirty();phHistLater(label||path);}
let phHT=0,phHL='';
function phHistLater(label){phHL=label;clearTimeout(phHT);phHT=setTimeout(()=>phCommit(phHL),500);}
/* a whole new set of settings (a preset, paste, reset) */
function phApply(next,label){const p=phP();if(!p)return;p.s=next;phAfterSet();phCommit(label);}
function phAfterSet(){ph.crop=false;phSizeDoc();phBuildPanel();phDirty();fit();phSidecarSoon();}
function phReset(){const p=phP();if(!p)return;phApply(phDefaults(),'Reset');}
/* ---- before / after ---- */
function phShow(mode){ph.show=mode;const b=$('#phBefore');if(b)b.classList.toggle('on',mode==='before');phDirty();}
/* ---- the histogram, from a small copy of what is shown ---- */
function phHistSoon(){clearTimeout(ph.rtimer);ph.rtimer=setTimeout(phHistogram,160);}
function phHistogram(){const cv=$('#phHisto');if(!cv||!ph.out||ui.mode!=='photo')return;const S=96,k=Math.min(1,S/Math.max(ph.out.w,ph.out.h)),w=Math.max(2,Math.round(ph.out.w*k)),h=Math.max(2,Math.round(ph.out.h*k)),sm=makeTarget(w,h,8,false);
  try{run(P.resample,sm,{uSrc:ph.out.tex,uOffset:[0,0],uScale:[ph.out.w/w,ph.out.h/h],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(ph.out.w/w)))}});const d=captureRegionNow(sm,0,0,w,h).data,H=[new Float32Array(256),new Float32Array(256),new Float32Array(256)];
    for(let i=0;i<d.length;i+=4){H[0][d[i]]++;H[1][d[i+1]]++;H[2][d[i+2]]++;}let mx=1;for(const a of H)for(let i=1;i<255;i++)if(a[i]>mx)mx=a[i];
    const c=cv.getContext('2d'),W=cv.width,Hh=cv.height;c.clearRect(0,0,W,Hh);c.globalCompositeOperation='lighter';[['#c33','#f66'],['#3a3','#6e6'],['#36c','#6af']].forEach(([f],ci)=>{c.fillStyle=f;c.beginPath();c.moveTo(0,Hh);for(let x=0;x<W;x++){const v=H[ci][Math.min(255,Math.floor(x*256/W))]/mx;c.lineTo(x,Hh-Math.min(1,Math.sqrt(v))*Hh*.95);}c.lineTo(W,Hh);c.fill();});c.globalCompositeOperation='source-over';}
  finally{disposeTarget(sm);}}
