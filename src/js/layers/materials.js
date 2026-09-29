/* ================= Materials tab =================
   Ready-made and saved materials. A click adds the material as a fill (material) layer, in the selection if there
   is one. Materials you make in the material editor (Save to Materials) are kept on this computer (the browser's
   storage, like brushes) with their images, and can be exported and imported as .gmat files to share. */
const matLib={list:[],loaded:false};
/* the built-in ones, as material records */
function matBuiltins(){return (typeof P3_MATERIALS!=='undefined'?P3_MATERIALS:[]).map(([name,m])=>({id:'b:'+name,name,builtin:true,fill:{maps:Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(m))).map(([k,v])=>[k,Object.assign({on:true,src:'value'},v)])),proj:'uv',triSharp:4,hStr:1},imgs:{}}));}
async function matLoad(){if(matLib.loaded)return;matLib.loaded=true;try{const all=await store.all('materials');matLib.list=(all||[]).sort((a,b)=>(a.t||0)-(b.t||0));}catch(e){matLib.list=[];}renderMats();}
/* a record's images as graphics-card textures (made when first needed) */
function matRecTargets(rec){if(rec._t)return rec._t;const o={};for(const k in rec.imgs||{}){const im=rec.imgs[k],t=makeTarget(im.w,im.h,8,true);writeRegion(t,0,0,im.w,im.h,im.data);o[k]=t;}return rec._t=o;}
function matApply(rec){const f=rec.fill,maps={};for(const k in f.maps)maps[k]=Object.assign({},f.maps[k]);
  const L=cmdNewFillLayer({name:rec.name,maps,proj:f.proj,triSharp:f.triSharp,hStr:f.hStr,xf:f.xf,rep:f.rep,front:f.front,imgs:matRecTargets(rec)});if(L&&!(ui.mode==='p3d'||v3.on))toast('Added “'+rec.name+'”. It shows on the model in the 3D view or 3D Paint.');return L;}
/* from the material editor */
function matSaveFromFill(L,f){const name=(L.name||'Material').trim(),imgs={};
  for(const k in L._fillImg||{}){const s=f.maps[k];if(!s||!s.on||s.src!=='image')continue;const t=L._fillImg[k];imgs[k]={w:t.w,h:t.h,data:captureRegionNow(t,0,0,t.w,t.h).data};}
  const old=matLib.list.find(r=>r.name===name),rec={id:old?old.id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,t:old?old.t:Date.now(),fill:fillClone(f),imgs};
  if(old){if(old._t)for(const k in old._t)disposeTarget(old._t[k]);matLib.list[matLib.list.indexOf(old)]=rec;}else matLib.list.push(rec);
  store.put(rec,'materials');renderMats();toast((old?'Updated':'Saved')+' “'+name+'” in Materials.');}
function matDelete(rec){confirmDlg('Delete material','Delete the material “'+rec.name+'” from Materials? Layers that use it keep it.','Delete',()=>{
  const i=matLib.list.indexOf(rec);if(i>=0)matLib.list.splice(i,1);if(rec._t)for(const k in rec._t)disposeTarget(rec._t[k]);store.del(rec.id,'materials');renderMats();});}
/* .gmat: the material as gzipped JSON, its images as PNG or WebP */
async function matExport(rec){if(rec.kind==='smart'||rec.kind==='smask'){const body=await smImgsOut(rec.kind==='smart'?{tree:rec.tree}:{mask:rec.mask});
    const blob=await gmatBlob(Object.assign({app:'Gouache Studio',kind:rec.kind,v:1,name:rec.name},body));const r=await deliver(slug(rec.name)+'.gmat',blob);toast(deliveredText(r,rec.kind==='smart'?'Smart material':'Smart mask'));return;}
  const imgs={};for(const k in rec.imgs||{}){const im=rec.imgs[k],c=document.createElement('canvas');c.width=im.w;c.height=im.h;const x=c.getContext('2d'),id=x.createImageData(im.w,im.h),d=im.data;
    for(let i=0;i<d.length;i+=4){const a=d[i+3]||1;id.data[i]=Math.min(255,d[i]*255/a);id.data[i+1]=Math.min(255,d[i+1]*255/a);id.data[i+2]=Math.min(255,d[i+2]*255/a);id.data[i+3]=d[i+3];}
    x.putImageData(id,0,0);imgs[k]={w:im.w,h:im.h,png:pxDataURL(c,k)};}
  const blob=await gmatBlob({app:'Gouache Studio',kind:'material',v:1,name:rec.name,fill:rec.fill,imgs});
  const r=await deliver(slug(rec.name)+'.gmat',blob);toast(deliveredText(r,'Material'));}
/* a .gmat's pictures (PNG or WebP data URLs) back to premultiplied pixels */
async function gmatImgs(j){const imgs={};
  for(const k in j.imgs||{}){const im=j.imgs[k],img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('bad image'));i.src=im.png;});
    const c=document.createElement('canvas');c.width=im.w;c.height=im.h;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,im.w,im.h).data,out=new Uint8Array(d.length);
    for(let i=0;i<d.length;i+=4){const a=d[i+3];out[i]=d[i]*a/255;out[i+1]=d[i+1]*a/255;out[i+2]=d[i+2]*a/255;out[i+3]=a;}imgs[k]={w:im.w,h:im.h,data:out};}
  return imgs;}
/* ---- the Library: materials shipped with the app (assets/materials, e.g. from ambientCG), loaded when first used ---- */
const GM_RAW='https://raw.githubusercontent.com/Kenn0090/gouache-studio/main/assets/materials/';
const gmRecs=(typeof GM_BUNDLED!=='undefined'?GM_BUNDLED:[]).filter(g=>g.kind==='material').map(g=>({id:'s:'+g.file,name:g.name,builtin:true,bundled:g,thumb:g.thumb,credit:g.credit,cat:g.cat||'Other'}));
/* the Library's categories (Kenn: "almost triple the amount", so it is split up) */
const GM_CATS=['Metal','Leather','Fabric','Plastic & rubber','Wood','Ground & nature','Other'];
let gmCat=(()=>{try{return localStorage.getItem('gs.gmCat')||'Metal';}catch(e){return 'Metal';}})();
async function gmFetch(file){for(const u of (location.protocol==='file:'?[]:['materials/'+file]).concat([GM_RAW+file])){try{const r=await fetch(u);if(r.ok)return new Uint8Array(await r.arrayBuffer());}catch(e){}}
  throw new Error(platform.isDesktop?'the file is missing':'it could not be downloaded (the web version needs the internet for the library)');}
async function gmLoad(rec){if(rec.fill&&rec.imgs)return rec;if(rec._loading)return rec._loading;
  return rec._loading=(async()=>{try{const j=await gmatParse(await gmFetch(rec.bundled.file));rec.fill=j.fill;rec.imgs=await gmatImgs(j);return rec;}finally{rec._loading=null;}})();}
async function gmApply(rec){if(!(rec.fill&&rec.imgs)){toast('Loading “'+rec.name+'”…');try{await gmLoad(rec);}catch(e){toast('Could not load “'+rec.name+'”: '+(e.message||e));return null;}}return matApply(rec);}
async function matImport(){const fs=await pickFiles('.gmat,application/json',true,'Gouache Studio materials',['gmat']);let n=0;
  for(const f of fs){try{const j=await gmatParse(f);
      if((j.kind==='smart'&&j.tree)||(j.kind==='smask'&&j.mask)){const body=await smImgsIn(j.kind==='smart'?{tree:j.tree}:{mask:j.mask});smPut(Object.assign({kind:j.kind,name:j.name||baseName(f.name)},body));n++;continue;}
      if(j.kind!=='material'||!j.fill)throw new Error('not a material');
      const rec={id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:j.name||baseName(f.name),t:Date.now(),fill:j.fill,imgs:await gmatImgs(j)};matLib.list.push(rec);store.put(rec,'materials');n++;}
    catch(e){toast('Could not read '+f.name+': '+(e.message||e));}}
  if(n){renderMats();toast('Imported '+n+' material'+(n>1?'s':'')+'.');}}
function renderMats(){const box=document.getElementById('matBody');if(!box)return;if(!matLib.loaded){matLoad();}
  const mats=matLib.list.filter(r=>!r.kind||r.kind==='material'),smarts=matLib.list.filter(r=>r.kind==='smart'),smasks=matLib.list.filter(r=>r.kind==='smask');
  /* smart materials and smart masks (0.24) */
  const stile=(rec,mask)=>{const b=el('button',{class:'mattile smart',_libDrag:[mask?'smask':'smart',rec],title:rec.name+(mask?': click to give the active layer this mask':': click to add this smart material (a folder of live layers)'),onclick:()=>mask?smMaskApply(rec):smApply(rec)},mask?smaskPreviewEl(rec,56):smPreviewEl(rec,56),el('span',{text:rec.name}));
    if(rec.builtin)return b;return el('div',{class:'matwrap'},b,el('div',{class:'matacts'},el('button',{class:'btn sm',text:'⤓',title:'Export as a .gmat file','aria-label':'Export '+rec.name,onclick:()=>matExport(rec)}),el('button',{class:'btn sm',text:'×',title:'Delete from Materials','aria-label':'Delete '+rec.name,onclick:()=>matDelete(rec)})));};
  const tile=rec=>{const pv=matPreviewEl(()=>rec.fill,()=>matRecTargets(rec),56),b=el('button',{class:'mattile',_libDrag:['mat',rec],title:rec.name+': click to add as a material layer'+(sel.active?' (in the selection)':''),onclick:()=>matApply(rec)},pv.el,el('span',{text:rec.name}));
    if(rec.builtin)return b;const w=el('div',{class:'matwrap'},b,el('div',{class:'matacts'},
      el('button',{class:'btn sm',text:'⤓',title:'Export as a .gmat file','aria-label':'Export '+rec.name,onclick:()=>matExport(rec)}),el('button',{class:'btn sm',text:'×',title:'Delete from Materials','aria-label':'Delete '+rec.name,onclick:()=>matDelete(rec)})));return w;};
  box.replaceChildren(el('div',{class:'chips'},el('button',{class:'btn sm',id:'matNew',text:'New material…',title:'A new material layer, with the material editor',onclick:()=>cmdNewFillLayer()}),el('button',{class:'btn sm',text:'Import…',title:'A .gmat file saved from Gouache Studio',onclick:matImport}),el('button',{class:'btn sm',id:'matFromTex',text:'From textures…',title:'Make a material from downloaded textures (a folder, images or a .zip)',onclick:()=>dlgMatFromTextures()})),
    ...(mats.length?[el('div',{class:'sub',text:'Yours'}),el('div',{class:'matgrid',id:'matMine'},...mats.map(tile))]:[]),
    ...(gmRecs.length?[el('div',{class:'sub',text:'Library ('+gmRecs.length+')'}),segChips([...GM_CATS.filter(c=>gmRecs.some(r=>r.cat===c)).map(c=>[c,c+' '+gmRecs.filter(r=>r.cat===c).length]),['all','All']],()=>gmCat,v=>{gmCat=v;try{localStorage.setItem('gs.gmCat',v);}catch(e){}renderMats();}),
      el('div',{class:'matgrid',id:'matLib'},...gmRecs.filter(r=>gmCat==='all'||r.cat===gmCat).map(rec=>el('button',{class:'mattile',id:'gm_'+rec.bundled.file.replace(/\.gmat$/,''),_libDrag:['mat',rec],title:rec.name+(rec.credit?' ('+rec.credit+')':'')+': click to add as a material layer',onclick:()=>gmApply(rec)},
      el('img',{src:rec.thumb,alt:'',width:56,height:56,class:'gmthumb'}),el('span',{text:rec.name}))))]:[]),
    el('div',{class:'sub',text:'Built in'}),el('div',{class:'matgrid'},...matBuiltins().map(tile)),
    el('div',{class:'sub',text:'Smart materials'}),el('div',{class:'matgrid',id:'smGrid'},...smarts.map(r=>stile(r,false)),...smBuiltins().map(r=>stile(r,false))),
    el('div',{class:'sub',text:'Smart masks'}),el('div',{class:'matgrid',id:'smMaskGrid'},...smasks.map(r=>stile(r,true)),...smaskBuiltins().map(r=>stile(r,true))),
    el('p',{class:'note',text:'Right-click a folder or layer › Save as smart material, or a mask › Save as smart mask, to keep yours here.'}));}
