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
async function udimAtlasFrom(files,box){const W=doc.w,H=doc.h,out=makeTarget(W,H,8,false);clearTarget(out,[0,0,0,0]);const byId=new Map();
  for(const f of files){const id=udimNameId(f.name);if(id&&!byId.has(id))byId.set(id,f);}
  const plain=!byId.size?files[0]:null;let placed=0;const missing=[];
  for(const T of box.B.tiles){const f=plain||byId.get(T.id);if(!f){missing.push(T.id);continue;}
    const t=await fileTarget(f);try{const R=udimTileRect(box.name,T,W,H);
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
  const root=doc.root,W0=L.fill;let A;try{A=await udimAtlasFrom(files,box);}catch(e){toast('Could not read '+files[0].name+': '+(e.message||e));return;}
  if(doc.root!==root||!inDoc(L)||L.fill!==W0||W0.maps[k]!==s){disposeTarget(A.t);toast('The material changed while the images were loading. Drop them again.');return;}
  if(!fillEnableDocMap(k)){disposeTarget(A.t);toast('This material cannot use the '+MAP_DEFS[k].label+' channel.');return;}
  matEdBegin(L);setWrap(A.t,true);L._fillImg=L._fillImg||{};L._fillImg[k]=A.t;s.src='image';s.name=A.name;s.tile=1;done();
  toast(A.plain?'“'+A.name+'” is repeated in each of the '+box.B.tiles.length+' UV tiles.':MAP_DEFS[k].label+': '+A.placed+' of '+box.B.tiles.length+' UV tiles filled'+(A.missing.length?' (no picture for '+A.missing.join(', ')+': pick or drop those files too)':'')+'.');};}
{const f=fillPickImage;fillPickImage=async function(L,k,s,done){const box=udimImgBox();if(!box)return f.apply(this,arguments);
  const exts=['png','jpg','jpeg','webp','tga','tif','tiff','bmp','psd','exr','hdr'];let files=[];
  if(platform.isDesktop){try{const ps=await platform.openFiles([{name:'Images',extensions:exts}],true);if(!ps||!ps.length){done();return;}
      for(const p of ps)files.push(new File([await platform.readFile(p)],fileNameOf(p)));
      if(ps.length===1&&udimNameId(files[0].name))files.push(...await udimSiblings(ps[0]));}catch(e){toast('The file dialog failed: '+(e.message||e));done();return;}}
  else files=await pickFiles('image/*',true,'Images',exts);
  if(!files.length){done();return;}
  if(!platform.isDesktop&&files.length===1&&udimNameId(files[0].name))toast('Tip: pick all the tile pictures together (…1001, …1002) to fill every tile.');
  await fillUseImage(L,k,s,files,done);};}
/* dropping several tile pictures on one channel card: they go together (the card's own handler sends one picture per channel) */
document.addEventListener('drop',e=>{const card=e.target.closest&&e.target.closest('.fillcard[data-material-channel]');if(!card||!udimImgBox())return;
  const fs=[...(e.dataTransfer&&e.dataTransfer.files||[])].filter(f=>typeof fillImageFile!=='function'||fillImageFile(f));if(fs.length<2||!fs.every(f=>udimNameId(f.name)))return;
  const L=doc.active,k=card.dataset.materialChannel;if(!L||!L.fill||!L.fill.maps[k])return;e.preventDefault();e.stopPropagation();card.classList.remove('material-drop');
  const s=L.fill.maps[k];fillUseImage(L,k,s,fs,()=>{matEdBegin(L);s.on=true;fillRender(L);changedAll();matEdCommit();if(typeof renderMatEd==='function')renderMatEd();});},true);
