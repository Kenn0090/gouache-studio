/* (0.97.21, Kenn) Right-click anything in the shelf › Show in Explorer.
   The shelf's content is stored inside the app, so there is usually no loose file: the item is saved as a file in the
   app's Exports folder (one folder per category) and that file is shown in Explorer. In the browser version it is saved
   through the normal save window instead. */
const SH_REV_CAT={mat:'Materials',smart:'Smart materials',smask:'Smart masks',gen:'Generators',tex:'Textures'};
const shSlug=s=>String(s||'item').replace(/[^\w\- .()]+/g,'_').trim()||'item';
async function shRevealFolder(cat){const info=await platform.cacheInfo();if(!info||!info.dir)throw new Error('The export folder is not available.');
  const dir=info.dir.replace(/[\\/]+$/,'')+'/Exports/'+shSlug(cat);await platform.invoke('make_dir',{path:info.dir.replace(/[\\/]+$/,'')+'/Exports'}).catch(()=>{});await platform.invoke('make_dir',{path:dir});return dir;}
/* run an export that ends in deliver(): write where we say, then show it */
async function shRevealGo(job,cat){if(typeof job!=='function')return;
  if(!platform.isDesktop){try{await job();}catch(e){toast('Could not save a copy: '+(e.message||e));}return;}
  let dir;try{dir=await shRevealFolder(cat||'Shelf');}catch(e){toast('Could not open the export folder: '+(e.message||e));return;}
  let wrote=null;
  deliverHook=async(name,blob)=>{const path=dir+'/'+shSlug(name);await platform.writeFile(path,new Uint8Array(await blob.arrayBuffer()));wrote=path;return {ok:true,name,path,desktop:true};};
  try{await job();}catch(e){toast('Could not save a copy: '+(e.message||e));}finally{deliverHook=null;}
  if(wrote){await platform.invoke('reveal_path',{path:wrote}).catch(e=>toast('Could not open Explorer: '+(e.message||e)));}
  else toast('Nothing was saved.');}
const shBlobOfBytes=(bytes,type)=>new Blob([bytes],{type:type||'application/octet-stream'});
const shCanvasBlob=c=>new Promise(r=>c.toBlob(r,'image/png'));
async function shTargetBlob(t){const w=t.w,h=t.h,d=captureRegionNow(t,0,0,w,h).data,c=document.createElement('canvas');c.width=w;c.height=h;
  const id=c.getContext('2d').createImageData(w,h);for(let i=0;i<d.length;i+=4){const a=d[i+3]||0;id.data[i]=a?Math.min(255,d[i]*255/a):0;id.data[i+1]=a?Math.min(255,d[i+1]*255/a):0;id.data[i+2]=a?Math.min(255,d[i+2]*255/a):0;id.data[i+3]=a;}
  c.getContext('2d').putImageData(id,0,0);return shCanvasBlob(c);}
async function shDataUrlBlob(u){return (await fetch(u)).blob();}
/* a job per kind of item */
function shRevealTex(it){return async()=>{await txLoad();
  if(it.kind==='photo'){const b=await txPhotoBytes(it.id);return deliver(shSlug(it.name)+'.webp',shBlobOfBytes(b,'image/webp'));}
  const t=await txTarget(it);if(!t)throw new Error('This texture is not ready yet.');return deliver(shSlug(it.name)+'.png',await shTargetBlob(t));};}
function shRevealMat(rec){return async()=>{if(rec.bundled&&rec.bundled.file){const b=await gmFetch(rec.bundled.file);if(b)return deliver(rec.bundled.file,shBlobOfBytes(b));}
  const r=typeof gmLoad==='function'&&rec.bundled?await gmLoad(rec):rec;return matExport(r||rec);};}
function shRevealTip(tip){return async()=>{const w=tip.w,h=tip.h,A=tip._A||tip.alpha;if(!A)throw new Error('This brush tip has no picture.');
  const c=document.createElement('canvas');c.width=w;c.height=h;const id=c.getContext('2d').createImageData(w,h);
  for(let i=0;i<w*h;i++){const v=A[i]>1?A[i]:Math.round(A[i]*255);id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=255;id.data[i*4+3]=Math.max(0,Math.min(255,v));}
  c.getContext('2d').putImageData(id,0,0);return deliver(shSlug(tip.name)+'.png',await shCanvasBlob(c));};}
function shRevealEnv(label){const e=typeof ENV_LIST!=='undefined'&&ENV_LIST.find(x=>x[1]===label);if(!e)return null;
  return async()=>{const b=await envBundled(e[2]);return deliver(e[2]+'.hdr',shBlobOfBytes(b));};}
function shRevealGen(r){const u=typeof GEN_THUMBS!=='undefined'&&GEN_THUMBS[r.group+'|'+r.name];if(!u)return null;return async()=>deliver(shSlug(r.name)+'.png',await shDataUrlBlob(u));}
/* what is under the pointer */
function shRevealJob(t){const d=t._libDrag;
  if(d){const [kind,rec]=d;
    if(kind==='mat'||kind==='smart'||kind==='smask')return {cat:SH_REV_CAT[kind],job:shRevealMat(rec)};
    if(kind==='gen')return {cat:'Generators',job:shRevealGen(rec)};}
  if(t.classList.contains('envtile')){const j=shRevealEnv(t.getAttribute('aria-label'));if(j)return {cat:'Environments',job:j};}
  if(t.classList.contains('shat')){const k=(t.dataset.shkey||'').replace('shalpha:','');const it=(typeof tipCatalogue==='function'?tipCatalogue():[]).find(x=>x.tip&&x.tip.name===k),tip=it&&it.tip;if(tip)return {cat:'Alphas',job:shRevealTip(tip)};}
  if(t.classList.contains('shbt')){const nm=(t.dataset.shkey||'').replace('shbrush:','');const p=(typeof library!=='undefined'?library.flatMap(s=>s.presets):[]).find(x=>x.name===nm);if(p&&p.tip)return {cat:'Brushes',job:shRevealTip(p.tip)};}
  if(t.classList.contains('dctile')){const id=t.id.replace(/^dc_/,'');const it=typeof DC_LIST!=='undefined'&&DC_LIST.find(x=>x[0]===id);
    if(it)return {cat:'Decals',job:async()=>{const c=dcDraw(id,'base',512);return deliver(shSlug(it[1])+'.png',await shCanvasBlob(c));}};}
  return null;}
document.addEventListener('contextmenu',e=>{const t=e.target.closest&&e.target.closest('.dkshelf .mattile');if(!t||t.classList.contains('txtile'))return;
  const found=shRevealJob(t);if(!found||!found.job)return;e.preventDefault();e.stopPropagation();
  const pop=$('#menuPop');closeMenu();
  pop.replaceChildren(el('button',{class:'mi',role:'menuitem',onclick:()=>{pop.hidden=true;shRevealGo(found.job,found.cat);}},el('span'),el('span',{text:platform.isDesktop?'Show in Explorer':'Save a copy…'}),el('span')));
  pop.hidden=false;pop.style.left=Math.min(e.clientX,window.innerWidth-pop.offsetWidth-8)+'px';pop.style.top=(e.clientY+6)+'px';},true);
