/* ================= Pictures in a set with UV tiles (0.97.26, Georgian via Kenn: "it's stretching it instead of adding both 1001 and 1002") =================
   A texture set with UV tiles (UDIMs) paints all its tiles on one canvas, side by side (1001 | 1002 = a 2:1 canvas). A picture
   chosen for a material channel used to be stretched over that whole canvas. Now:
     - tile pictures (a tile number in the name: Body_1001_D.png, Body.1002.png) each go into their own tile; picking one tile's
       picture finds the others beside it in the same folder (desktop app), or pick/drop them all together
     - a plain picture is repeated once in every tile (as UV tiling works per tile in Painter)
   The tiles are put together into one canvas-sized picture, so everything after (tiling, projection, saving) is unchanged. */
const UDIM_RX=/(^|[^0-9])(1\d\d\d)(?=[^0-9]|$)/;
const udimNameId=n=>{const m=UDIM_RX.exec(String(n||''));const id=m?+m[2]:0;return id>=1001&&id<=1999?id:0;};
const udimPattern=n=>String(n||'').replace(UDIM_RX,(a,b)=>b+'<UDIM>');
/* the active set's tile box when it has more than one tile */
function udimImgBox(){if(typeof udimOn!=='function'||!udimOn()||!p3.sets[p3.cur])return null;const B=udimBox(p3Binding(p3.sets[p3.cur]));return B&&B.tiles.length>1?{B,name:p3Binding(p3.sets[p3.cur])}:null;}
/* pictures → one canvas picture: tile pictures in their tiles, or one picture in every tile */
/* (0.97.30) material pictures stay in the plain grid of tiles (the material reads them per tile); mesh maps (packed) follow the
   canvas, where tiles of different sizes are packed */
async function udimAtlasFrom(files,box,packed){const grid=!packed&&box.B.lay,gt=grid?Math.max(64,Math.min(Math.max(...box.B.tiles.map(T=>udimNominal(box.name,T))),Math.floor(udimLim()/Math.max(box.B.nx,box.B.ny)))):0,
  W=grid?gt*box.B.nx:doc.w,H=grid?gt*box.B.ny:doc.h,out=makeTarget(W,H,8,false);clearTarget(out,[0,0,0,0]);const byId=new Map();
  for(const f of files){const id=udimNameId(f.name);if(id&&!byId.has(id))byId.set(id,f);}
  const plain=!byId.size?files[0]:null;let placed=0;const missing=[];
  for(const T of box.B.tiles){const f=plain||byId.get(T.id);if(!f){missing.push(T.id);continue;}
    const t=await fileTarget(f);try{const R=(grid?udimGridRect:udimTileRect)(box.name,T,W,H);
      scissorDo(R,()=>run(P.resample,out,{uSrc:t.tex,uOffset:[R[0],R[1]],uScale:[t.w/R[2],t.h/R[3]],uTaps:{int:Math.max(1,Math.min(8,Math.ceil(Math.max(t.w/R[2],t.h/R[3]))))},uOutside:[0,0,0,0]}));placed++;}
    finally{disposeTarget(t);}}
  return {t:out,placed,missing,plain:!!plain,name:plain?plain.name:udimPattern(files.find(f=>udimNameId(f.name))?.name||files[0].name)};}
/* the other tiles' pictures beside a picked one (desktop: same folder, same name with another tile number) */
async function udimSiblings(path){try{const dir=path.replace(/[\\/][^\\/]*$/,''),name=fileNameOf(path),pat=udimPattern(name).toLowerCase();
    const list=(await platform.invoke('dir_files',{dir}))||[],out=[];
    for(const [p] of list){const n=fileNameOf(p);if(n===name||!udimNameId(n)||udimPattern(n).toLowerCase()!==pat)continue;out.push(new File([await platform.readFile(p)],n));}
    return out;}catch(e){return [];}}
{const f=fillUseImage;fillUseImage=async function(L,k,s,file,done){const box=udimImgBox(),files=Array.isArray(file)?file:[file];
  if(!box||!files.length||!files[0])return f.call(this,L,k,s,files[0],done);
  /* a plain picture keeps its own size: the material repeats it once per tile (fillUdimT) */
  if(!files.some(x=>udimNameId(x.name))){await f.call(this,L,k,s,files[0],()=>{s.atlas=false;s.atlasOf=s.name;done();});toast('“'+files[0].name+'” repeats in each of the '+box.B.tiles.length+' UV tiles.');return;}
  const root=doc.root,W0=L.fill;let A;try{A=await udimAtlasFrom(files,box);}catch(e){toast('Could not read '+files[0].name+': '+(e.message||e));return;}
  if(doc.root!==root||!inDoc(L)||L.fill!==W0||W0.maps[k]!==s){disposeTarget(A.t);toast('The material changed while the images were loading. Drop them again.');return;}
  if(!fillEnableDocMap(k)){disposeTarget(A.t);toast('This material cannot use the '+MAP_DEFS[k].label+' channel.');return;}
  matEdBegin(L);setWrap(A.t,true);L._fillImg=L._fillImg||{};L._fillImg[k]=A.t;s.src='image';s.name=A.name;s.tile=1;s.atlas=true;s.atlasOf=s.name;done();
  toast(A.plain?'“'+A.name+'” is repeated in each of the '+box.B.tiles.length+' UV tiles.':MAP_DEFS[k].label+': '+A.placed+' of '+box.B.tiles.length+' UV tiles filled'+(A.missing.length?' (no picture for '+A.missing.join(', ')+': pick or drop those files too)':'')+'.');};}
/* pick pictures for a set with tiles: several at once; picking one tile's picture also brings the other tiles' from its folder (desktop) */
async function udimPickFiles(title,exts){let files=[];
  if(platform.isDesktop){try{const ps=await platform.openFiles([{name:title,extensions:exts}],true);if(!ps||!ps.length)return [];
      for(const p of ps)files.push(new File([await platform.readFile(p)],fileNameOf(p)));
      if(ps.length===1&&udimNameId(files[0].name))files.push(...await udimSiblings(ps[0]));}catch(e){toast('The file dialog failed: '+(e.message||e));return [];}}
  else files=await pickFiles('image/*,.tga,.dds,.tif,.tiff',true,title,exts);
  if(!platform.isDesktop&&files.length===1&&udimNameId(files[0].name))toast('Tip: pick all the tile pictures together (…1001, …1002) to fill every tile.');
  return files;}
const UDIM_EXTS=['png','jpg','jpeg','webp','tga','tif','tiff','bmp','psd','exr','hdr','dds'];
{const f=fillPickImage;fillPickImage=async function(L,k,s,done){if(!udimImgBox())return f.apply(this,arguments);
  const files=await udimPickFiles('Images',UDIM_EXTS);if(!files.length){done();return;}await fillUseImage(L,k,s,files,done);};}
/* (Georgian: "same as the input maps") mesh map slots: tile maps go into their tiles too */
{const f=p3MapImport;p3MapImport=async function(k,file){const box=udimImgBox(),files=Array.isArray(file)?file:[file];if(!box||!files[0])return f.call(this,k,files[0]);
  const root=doc.root;let A=null;try{loadStart(files[0].name);loadBusy('Reading mesh map…');await loadPaint();A=await udimAtlasFrom(files,box,true);setWrap(A.t,true);
    if(doc.root!==root||ui.mode!=='p3d')throw new Error('The texture set changed during import. Try again.');p3MapSet(k,A.t,A.name);
    toast(P3_MESHMAP_NAMES[k]+' in “'+doc.name+'”: '+(A.plain?'“'+A.name+'” repeated in each UV tile.':A.placed+' of '+box.B.tiles.length+' UV tiles'+(A.missing.length?' (no map for '+A.missing.join(', ')+')':'')+'.'));A=null;}
  catch(e){if(A)disposeTarget(A.t);toast('Could not import '+files[0].name+': '+(e.message||e));}finally{loadEnd();}};}
{const f=p3MapPick;p3MapPick=async function(k){if(!udimImgBox())return f.apply(this,arguments);const files=await udimPickFiles(P3_MESHMAP_NAMES[k],UDIM_EXTS);if(files.length)await p3MapImport(k,files);};}
/* several mesh maps dropped at once: the tile files of one map go in together */
{const f=p3MapBatch;p3MapBatch=async function(files){if(!udimImgBox())return f.apply(this,arguments);const groups=new Map(),rest=[];
  for(const x of files){const k=udimNameId(x.name)?p3MapGuess(x.name):null;if(!k){rest.push(x);continue;}const key=k+'|'+udimPattern(x.name).toLowerCase();if(!groups.has(key))groups.set(key,{k,files:[]});groups.get(key).files.push(x);}
  for(const g of groups.values())await p3MapImport(g.k,g.files);if(rest.length)await f.call(this,rest);};}
/* dropping several tile pictures on one channel card: they go together (the card's own handler sends one picture per channel) */
document.addEventListener('drop',e=>{const card=e.target.closest&&e.target.closest('.fillcard[data-material-channel]');if(!card||!udimImgBox())return;
  const fs=[...(e.dataTransfer&&e.dataTransfer.files||[])].filter(f=>typeof fillImageFile!=='function'||fillImageFile(f));if(fs.length<2||!fs.every(f=>udimNameId(f.name)))return;
  const L=doc.active,k=card.dataset.materialChannel;if(!L||!L.fill||!L.fill.maps[k])return;e.preventDefault();e.stopPropagation();card.classList.remove('material-drop');
  const s=L.fill.maps[k];fillUseImage(L,k,s,fs,()=>{matEdBegin(L);s.on=true;fillRender(L);changedAll();matEdCommit();if(typeof renderMatEd==='function')renderMatEd();});},true);
document.addEventListener('drop',e=>{const row=e.target.closest&&e.target.closest('.meshslot[data-mesh-slot]');if(!row||!udimImgBox())return;const fs=[...(e.dataTransfer&&e.dataTransfer.files||[])];if(fs.length<2||!fs.some(f=>udimNameId(f.name)))return;
  e.preventDefault();e.stopPropagation();row.classList.remove('dropon');p3MapImport(row.dataset.meshSlot,fs);},true);
/* Materials › From textures with tile files (Tpose_1001_BaseColor.png, Tpose_1002_BaseColor.png…): the tiles of each map are put
   together first, so the material's pictures hold every tile (shaped like the tile canvas, so they cover it: fillUdimT) */
async function udimTargetFile(t,name){const d=captureRegionNow(t,0,0,t.w,t.h).data,c=document.createElement('canvas');c.width=t.w;c.height=t.h;const x=c.getContext('2d'),id=x.createImageData(t.w,t.h);
  for(let i=0;i<d.length;i+=4){const a=d[i+3],k=a?255/a:0;id.data[i]=Math.min(255,d[i]*k);id.data[i+1]=Math.min(255,d[i+1]*k);id.data[i+2]=Math.min(255,d[i+2]*k);id.data[i+3]=a;}
  x.putImageData(id,0,0);return new File([await new Promise(r=>c.toBlob(r,'image/png'))],name,{type:'image/png'});}
{const f=miBuild;miBuild=async function(files,folder,max){const box=udimImgBox();if(!box||!files||!files.some(x=>udimNameId(x.name)))return f.apply(this,arguments);
  const groups=new Map(),out=[];
  for(const x of files){if(!udimNameId(x.name)){out.push(x);continue;}const key=udimPattern(x.name).toLowerCase();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x);}
  const made=new Set();
  for(const g of groups.values()){const A=await udimAtlasFrom(g,box);try{const nm=A.name.replace('<UDIM>','UDIM');made.add(nm);out.push(await udimTargetFile(A.t,nm));}finally{disposeTarget(A.t);}}
  const rec=await f.call(this,out,folder,max?Math.max(max,Math.max(doc.w,doc.h)):max);
  for(const k in rec.fill.maps){const m=rec.fill.maps[k];if(m.src==='image'&&made.has(m.name)){m.atlas=true;m.atlasOf=m.name;}}
  return rec;};}
