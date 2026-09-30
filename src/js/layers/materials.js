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
const GM_CATS=['Metal','Leather','Fabric','Plastic & rubber','Wood','Ground & nature','Stone & tile','Paint & ceramic','Other'];
/* (0.36, Kenn) which kind of material to show: all, yours, the Library, smart materials or smart masks (the shelf's category list) */
const MAT_VIEWS=[['all','All'],['yours','Yours'],['library','Library'],['smart','Smart materials'],['smask','Smart masks']];
let matView=(()=>{try{return localStorage.getItem('gs.matView')||'all';}catch(e){return 'all';}})();
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
/* (0.29, Kenn) a click only highlights a tile. Drag it onto the layers, or press the fill layer button, to add it.
   Hovering shows a larger look with details, and S / M / L sets the thumbnail size. */
const matSel={kind:null,rec:null};
const MT_SIZES={s:44,m:64,l:104};
let matSize=(()=>{try{return localStorage.getItem('gs.matSize')||'m';}catch(e){return 'm';}})();
const matTw=()=>MT_SIZES[matSize]||64;
function matPick(kind,rec,tile){matSel.kind=kind;matSel.rec=rec;document.querySelectorAll('#matBody .mattile.sel').forEach(t=>t.classList.remove('sel'));if(tile)tile.classList.add('sel');}
/* the fill layer button adds the highlighted material; false when nothing is highlighted */
function matAddSelected(){const r=matSel.rec;if(!r||matSel.kind==='smask')return false;
  if(matSel.kind==='smart')smApply(r);else if(r.bundled&&!r.fill)gmApply(r);else if(r.bundled)gmApply(r);else matApply(r);return true;}
function matMaskSelected(){const r=matSel.rec;if(!r||matSel.kind!=='smask')return false;smMaskApply(r);return true;}
/* (0.34, Kenn) double-click a material while a material layer is selected: it replaces that layer's material (mask, blend and place in the stack stay); one undo step */
async function matReplace(rec){const L=doc.active;
  if(!(isLayer(L)&&L.fill&&!L.editMask))return false;
  if(rec.bundled&&!(rec.fill&&rec.imgs)){toast('Loading “'+rec.name+'”…');try{await gmLoad(rec);}catch(e){toast('Could not load “'+rec.name+'”: '+(e.message||e));return true;}}
  if(doc.active!==L)return true;
  const f=rec.fill,imgs=matRecTargets(rec);matEdBegin(L);
  const nf=fillDefaults();for(const k in nf.maps)nf.maps[k].on=false;for(const k in f.maps)if(nf.maps[k])Object.assign(nf.maps[k],{on:true,src:'value'},JSON.parse(JSON.stringify(f.maps[k])));
  for(const k of ['proj','triSharp','hStr','xf','rep','front','decal'])if(f[k]!=null)nf[k]=JSON.parse(JSON.stringify(f[k]));nf.name=rec.name;
  L.fill=nf;L.name=rec.name;L._fillImg={};
  for(const k in imgs){const t=imgs[k],c=makeTarget(t.w,t.h,8,true);blit(t,c,0,0,t.w,t.h,0,0);L._fillImg[k]=c;}
  const need=Object.keys(f.maps).filter(k=>f.maps[k].on!==false&&!doc.maps.includes(k)&&MAP_DEFS[k]&&!(doc.workflow==='spec'&&(k==='rough'||k==='metal')));
  if(need.length)setDocMaps([...doc.maps,...need],'Add maps for the material');
  fillRender(L);L.lookVer=(L.lookVer||0)+1;matEdCommit();changed(L);renderLayers();renderMatEd(true);requestRender(true);
  toast('Replaced the material with “'+rec.name+'”.');return true;}
let matPopEl=null,matPopT=0;
function matPopHide(){clearTimeout(matPopT);if(matPopEl){matPopEl.remove();matPopEl=null;}}
function matPopShow(kind,rec,tile){matPopHide();matPopT=setTimeout(()=>{
  const S=176;let pv;
  const info=[];
  if(kind==='smart')pv=smPreviewEl(rec,S);else if(kind==='smask')pv=smaskPreviewEl(rec,S);
  else if(rec.fill&&(rec.imgs||!rec.bundled)){pv=matPreviewEl(()=>rec.fill,()=>matRecTargets(rec),S).el;}
  else{pv=el('img',{class:'matprev',src:rec.thumb||'',width:S,height:S,alt:''});
    if(rec.bundled)gmLoad(rec).then(()=>{if(matPopEl&&matPopEl._rec===rec){const n=matPreviewEl(()=>rec.fill,()=>matRecTargets(rec),S).el;pv.replaceWith(n);pv=n;}}).catch(()=>{});}
  const kindName=kind==='smart'?'Smart material (a folder of live layers)':kind==='smask'?'Smart mask':'Material';
  info.push(el('div',{class:'mpsub',text:kindName+(rec.cat?' · '+rec.cat:'')}));
  const F=rec.fill;if(F&&F.maps){const on=Object.keys(F.maps).filter(k=>F.maps[k]&&F.maps[k].on&&MAP_DEFS[k]).map(k=>MAP_DEFS[k].label);if(on.length)info.push(el('div',{class:'mpline',text:'Channels: '+on.join(', ')}));}
  if(rec.imgs){const im=Object.values(rec.imgs)[0];if(im&&im.w)info.push(el('div',{class:'mpline',text:'Pictures: '+im.w+' × '+im.h+' px'}));}
  if(rec.credit)info.push(el('div',{class:'mpline',text:'Source: '+rec.credit}));
  info.push(el('div',{class:'mpline dim',text:'Drag onto the layers, or highlight it and press the fill layer button.'}));
  const pop=el('div',{class:'matpop',role:'tooltip'},pv,el('div',{class:'mpname',text:rec.name}),...info);pop._rec=rec;document.body.append(pop);matPopEl=pop;
  const r=tile.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;let x=r.left-w-8;if(x<8)x=Math.min(innerWidth-w-8,r.right+8);
  pop.style.left=x+'px';pop.style.top=Math.max(8,Math.min(r.top,innerHeight-h-8))+'px';},350);}
function matHoverOn(b,kind,rec){b.addEventListener('mouseenter',()=>matPopShow(kind,rec,b));b.addEventListener('mouseleave',matPopHide);b.addEventListener('pointerdown',matPopHide);}
/* (0.37.1) a search box over the shelf: hides the tiles whose name does not match, without rebuilding the list */
let matQuery='';
function matSearchFilter(box){const q=matQuery.trim().toLowerCase();box.querySelectorAll('.mattile').forEach(t=>{const w=t.closest('.matwrap')||t,nm=(t.textContent||t.title||'').toLowerCase();w.hidden=!!q&&!nm.includes(q);});}
function matSearchBox(){const i=el('input',{type:'search',id:'matSearch',class:'matsearch',placeholder:'Search',value:matQuery,'aria-label':'Search materials'});
  i.addEventListener('input',()=>{matQuery=i.value;const b=document.getElementById('matBody');if(b)matSearchFilter(b);});return i;}
function renderMats(){const box=document.getElementById('matBody');if(!box)return;if(!matLib.loaded){matLoad();}matPopHide();const tw=matTw();box.style.setProperty('--tw',tw+'px');
  const mats=matLib.list.filter(r=>!r.kind||r.kind==='material'),smarts=matLib.list.filter(r=>r.kind==='smart'),smasks=matLib.list.filter(r=>r.kind==='smask');
  const mark=(b,kind,rec)=>{b._libDrag=[kind,rec];if(matSel.rec===rec)b.classList.add('sel');matHoverOn(b,kind,rec);return b;};
  /* smart materials and smart masks (0.24) */
  const stile=(rec,mask)=>{const kind=mask?'smask':'smart',b=mark(el('button',{class:'mattile smart',title:rec.name+(mask?': click to highlight, then press the mask button under the layers, or drag it onto a layer':': click to highlight, then press the fill layer button, or drag it onto the layers. Double-click to swap it into the selected material layer'),onclick:()=>matPick(kind,rec,b)},mask?smaskPreviewEl(rec,tw):smPreviewEl(rec,tw),el('span',{text:rec.name})),kind,rec);
    if(rec.builtin)return b;return el('div',{class:'matwrap'},b,el('div',{class:'matacts'},el('button',{class:'btn sm',text:'⤓',title:'Export as a .gmat file','aria-label':'Export '+rec.name,onclick:()=>matExport(rec)}),el('button',{class:'btn sm',text:'×',title:'Delete from Materials','aria-label':'Delete '+rec.name,onclick:()=>matDelete(rec)})));};
  const tile=rec=>{const pv=matPreviewEl(()=>rec.fill,()=>matRecTargets(rec),tw),b=mark(el('button',{class:'mattile',title:rec.name+': click to highlight, then press the fill layer button, or drag it onto the layers. Double-click to swap it into the selected material layer',onclick:()=>matPick('mat',rec,b),ondblclick:()=>matReplace(rec)},pv.el,el('span',{text:rec.name})),'mat',rec);
    if(rec.builtin)return b;const w=el('div',{class:'matwrap'},b,el('div',{class:'matacts'},
      el('button',{class:'btn sm',text:'⤓',title:'Export as a .gmat file','aria-label':'Export '+rec.name,onclick:()=>matExport(rec)}),el('button',{class:'btn sm',text:'×',title:'Delete from Materials','aria-label':'Delete '+rec.name,onclick:()=>matDelete(rec)})));return w;};
  const sizeSeg=el('div',{class:'seg matsize',role:'radiogroup','aria-label':'Thumbnail size'},...[['s','S'],['m','M'],['l','L']].map(([k,l])=>el('button',{type:'button',role:'radio','aria-checked':String(matSize===k),class:matSize===k?'on':'',id:'matSize_'+k,title:'Thumbnail size '+l,text:l,onclick:()=>{matSize=k;try{localStorage.setItem('gs.matSize',k);}catch(e){}renderMats();}})));
  box.classList.toggle('one',matView!=='all');
  box.replaceChildren(el('div',{class:'chips'},el('button',{class:'btn sm',id:'matNew',text:'New material…',title:'A new material layer, with the material editor',onclick:()=>cmdNewFillLayer()}),el('button',{class:'btn sm',text:'Import…',title:'A .gmat file saved from Gouache Studio',onclick:matImport}),el('button',{class:'btn sm',id:'matFromTex',text:'From textures…',title:'Make a material from downloaded textures (a folder, images or a .zip)',onclick:()=>dlgMatFromTextures()}),matSearchBox(),sizeSeg),segChips(MAT_VIEWS,()=>matView,v=>{matView=v;try{localStorage.setItem('gs.matView',v);}catch(e){}renderMats();}),
    ...(mats.length&&(matView==='all'||matView==='yours')?[el('div',{class:'sub',text:'Yours'}),el('div',{class:'matgrid',id:'matMine'},...mats.map(tile))]:[]),
    ...(gmRecs.length&&(matView==='all'||matView==='library')?[el('div',{class:'sub',text:'Library ('+gmRecs.length+')'}),segChips([...GM_CATS.filter(c=>gmRecs.some(r=>r.cat===c)).map(c=>[c,c+' '+gmRecs.filter(r=>r.cat===c).length]),['all','All']],()=>gmCat,v=>{gmCat=v;try{localStorage.setItem('gs.gmCat',v);}catch(e){}renderMats();}),
      el('div',{class:'matgrid',id:'matLib'},...gmRecs.filter(r=>gmCat==='all'||r.cat===gmCat).map(rec=>{const b=mark(el('button',{class:'mattile',id:'gm_'+rec.bundled.file.replace(/\.gmat$/,''),title:rec.name+(rec.credit?' ('+rec.credit+')':'')+': click to highlight, then press the fill layer button, or drag it onto the layers. Double-click to swap it into the selected material layer',onclick:()=>matPick('mat',rec,b),ondblclick:()=>matReplace(rec)},
      el('img',{src:rec.thumb,alt:'',width:tw,height:tw,class:'gmthumb',draggable:'false'}),el('span',{text:rec.name})),'mat',rec);return b;}))]:[]),
    ...(matView==='all'||matView==='library'?[el('div',{class:'sub',text:'Built in'}),el('div',{class:'matgrid'},...matBuiltins().map(tile))]:[]),
    ...(matView==='all'||matView==='smart'?[el('div',{class:'sub',text:'Smart materials'}),el('div',{class:'matgrid',id:'smGrid'},...smarts.map(r=>stile(r,false)),...smBuiltins().map(r=>stile(r,false)))]:[]),
    ...(matView==='all'||matView==='smask'?[el('div',{class:'sub',text:'Smart masks'}),el('div',{class:'matgrid',id:'smMaskGrid'},...smasks.map(r=>stile(r,true)),...smaskBuiltins().map(r=>stile(r,true)))]:[]),
    el('p',{class:'note',text:'Right-click a folder or layer › Save as smart material, or a mask › Save as smart mask, to keep yours here.'}));if(matQuery)matSearchFilter(box);}
