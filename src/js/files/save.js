/* ================= Saving files ================= */
async function makeZip(name,data){const nb=new TextEncoder().encode(name),comp=await streamThrough(data,'deflate-raw'),crc=crc32(data);
  const lh=new DataView(new ArrayBuffer(30));lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,8,true);lh.setUint16(12,0x21,true);
  lh.setUint32(14,crc,true);lh.setUint32(18,comp.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,nb.length,true);
  const cd=new DataView(new ArrayBuffer(46));cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);cd.setUint16(8,0x0800,true);cd.setUint16(10,8,true);cd.setUint16(14,0x21,true);
  cd.setUint32(16,crc,true);cd.setUint32(20,comp.length,true);cd.setUint32(24,data.length,true);cd.setUint16(28,nb.length,true);
  const end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,1,true);end.setUint16(10,1,true);end.setUint32(12,46+nb.length,true);end.setUint32(16,30+nb.length+comp.length,true);
  return new Blob([lh,nb,comp,cd,nb,end],{type:'application/zip'});}
let dlPromise=null;
function downloadsCap(){if(!(window.claude&&typeof window.claude.use==='function'))return Promise.resolve(null);if(!dlPromise)dlPromise=window.claude.use('downloads').catch(()=>null);return dlPromise;}
const VIEWER_OK=['png','jpg','jpeg','webp','gif','zip'];
async function deliver(filename,blob){
  if(platform.isDesktop){
    try{const path=await platform.saveAs(filename,blob);if(!path)return {ok:false,msg:'Save cancelled.'};return {ok:true,name:fileNameOf(path),path,desktop:true};}
    catch(e){return {ok:false,msg:'The file could not be saved: '+(e.message||e)}}}
  const dl=await downloadsCap();
  if(dl){let name=filename,data=blob,zipped=false;
    if(!VIEWER_OK.includes(extOf(filename))){data=await makeZip(filename,new Uint8Array(await blob.arrayBuffer()));name=baseName(filename)+'.zip';zipped=true;}
    try{await dl.save({filename:name,data});return {ok:true,name,zipped};}
    catch(e){const c=e&&e.code;if(c==='declined')return {ok:false,msg:'Save cancelled.'};
      if(c==='rejected_extension'||c==='extension_not_enabled')return {ok:false,msg:'This viewer cannot save .'+extOf(name)+' files. Open the app as a local file to save '+extOf(filename).toUpperCase()+' directly.'};
      if(c==='rate_limited')return {ok:false,msg:'A save prompt is already open. Finish that one first.'};
      return {ok:false,msg:'The file could not be saved ('+(c||e.message||'unknown error')+').'};}}
  const url=URL.createObjectURL(blob),a=el('a',{href:url,download:filename});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  return {ok:true,name:filename,zipped:false,direct:true};}
function deliveredText(r,what){if(!r.ok)return r.msg;if(r.desktop)return 'Saved '+r.path;return r.zipped?what+' saved inside '+r.name+'. This viewer only saves a few file types, so it is zipped; unzip to get the file.':(r.direct?'Downloaded '+r.name+'.':'Saved '+r.name+'.');}
/* Save (Ctrl+S): in the desktop app, re-saves to the PSD it came from; otherwise asks where. Save As (Ctrl+Shift+S) always asks. */
async function savePSD(forceAsk){toast('Preparing PSD…');try{await tick();const blob=await encodePSD();
    if(platform.isDesktop&&doc.filePath&&!forceAsk&&extOf(doc.filePath)==='psd'){await platform.writeFile(doc.filePath,new Uint8Array(await blob.arrayBuffer()));toast('Saved '+doc.filePath);markSaved();return;}
    const r=await deliver(slug(doc.name)+'.psd',blob);toast(deliveredText(r,'PSD'));
    if(r.ok&&r.path){doc.filePath=r.path;doc.name=baseName(fileNameOf(r.path));platform.recentAdd(r.path);markSaved();updateStatus();}}
  catch(e){console.error(e);toast('The PSD could not be saved: '+e.message);}}
function savePSDAs(){if(doc.maps.length>1)toast('A PSD holds the base colour only. Save as .gouache to keep every map.');return savePSD(true);}
/* Save (Ctrl+S): the document's own .gouache file; the first save (or Save As) asks where */
async function saveDoc(forceAsk){if(stroke){return;}toast('Saving…');try{await tick();const blob=await encodeGouache();
    if(platform.isDesktop&&doc.filePath&&!forceAsk&&extOf(doc.filePath)==='gouache'){await platform.writeFile(doc.filePath,blob);toast('Saved '+doc.filePath);markSaved();return;}
    if(platform.isDesktop){const path=await platform.saveAs(slug(doc.name)+'.gouache',blob,'Gouache Studio document');if(!path){toast('Save cancelled.');return;}
      doc.filePath=path;doc.name=baseName(fileNameOf(path));platform.recentAdd(path);markSaved();updateStatus();toast('Saved '+path);return;}
    const r=await deliver(slug(doc.name)+'.gouache',blob);toast(deliveredText(r,'Document'));if(r.ok)markSaved();}
  catch(e){console.error(e);toast('The document could not be saved: '+(e.message||e));}}
function markSaved(){doc.savedAt=hist.undo.length?hist.undo[hist.undo.length-1]:null;if(doc.projectAssets)doc.projectAssets._saved=doc.projectAssets._ver||0;updateTitle();}
function updateTitle(){platform.setTitle((doc.name||'Untitled')+(doc.filePath?' — '+doc.filePath:'')+' — Gouache Studio');}
/* Recent files: files/recent.js */

/* (0.96.4, Kenn) Save as (Ctrl+Shift+S) offers every file type Gouache can write: the document itself, a layered PSD,
   or a flat picture (PNG, TGA, DDS, TIFF, EXR, JPG, WebP); in 3D Paint the project, or textures (and the model) for a game engine */
const saveAsCfg={fmt:localStorage.getItem('gs.saveAsFmt')||''};
function saveAsChoices(){if(ui.mode==='p3d')return [['gouache3d','3D Paint project (.gouache3d)','The model and every texture set, to keep working later.'],
    ['tex','Textures for a game engine…','Unreal, Unity, Godot, Blender… with the model if you like (Ctrl+Shift+E).']];
  return [['gouache','Gouache document (.gouache)','Every layer, mask, map and setting, to keep working later.'],['psd','Photoshop (.psd)','Layers of the base colour, for other painting apps.'],
    ...FORMATS.map(([v,l])=>[v,l+' (.'+v+')','One flat picture of what you see.'])];}
/* (0.97.15, Kenn) Save As like Photoshop: the standard file window with a "Save as type" list, then a small window with that format's options
   (PNG bit depth, JPEG quality…). In a browser one window holds the name, the type and the options. 3D Paint keeps its project / textures choice. */
const SAVE_TYPES=[['gouache','Gouache document',['gouache']],['psd','Photoshop',['psd']],['png','PNG',['png']],['jpg','JPEG',['jpg','jpeg']],['tga','Targa',['tga']],['tif','TIFF',['tif','tiff']],['dds','DirectDraw Surface',['dds']],['exr','OpenEXR',['exr']],['webp','WebP',['webp']]];
const saveTypeOfExt=e=>{e=(e||'').toLowerCase();const t=SAVE_TYPES.find(t=>t[2].includes(e));return t?t[0]:null;};
const saveTypeInfo=v=>SAVE_TYPES.find(t=>t[0]===v)||SAVE_TYPES[0];
function saveFmtDefault(){const f=saveAsCfg.fmt;if(saveTypeOfExt(f)&&f!=='gouache3d'&&f!=='tex')return saveTypeOfExt(f);const e=saveTypeOfExt(extOf(doc.filePath||''));return e||'gouache';}
/* options window for one picture format; calls go() when OK is pressed (formats with no options go straight on) */
function saveFormatOptions(fmt,go){if(!['png','jpg','tga','tif','dds','webp'].includes(fmt)){go();return;}
  exp.fmt=fmt;exp.png16=exp.tif16=doc.depth===16;
  const opts=el('div',{class:'fmt-opts'}),draw=()=>opts.replaceChildren(...exportOptsFor(fmt,draw));draw();
  openDialog({title:saveTypeInfo(fmt)[1]+' options',body:el('div',{class:'dlg-grid'},opts,el('p',{class:'note',text:doc.w+' × '+doc.h+' px · what you see (all visible layers)'})),okLabel:'OK',onOk(){setTimeout(go,0);}});}
async function saveImageTo(fmt,path,filename){exp.fmt=fmt;exp.src='image';toast('Preparing '+fmt.toUpperCase()+'…');await tick();
  try{const {blob}=await buildExport();
    if(path){await platform.writeFile(path,blob);toast('Saved '+path);platform.recentAdd(path);return;}
    const r=await deliver(filename||slug(doc.name)+'.'+(fmt==='tif'?'tif':fmt),blob);toast(deliveredText(r,fmt.toUpperCase()));}
  catch(e){console.error(e);toast('The picture could not be saved: '+(e.message||e));}}
async function saveDocAt(path){toast('Saving…');try{await tick();const blob=await encodeGouache();await platform.writeFile(path,blob);doc.filePath=path;doc.name=baseName(fileNameOf(path));platform.recentAdd(path);markSaved();updateStatus();toast('Saved '+path);}catch(e){console.error(e);toast('The document could not be saved: '+(e.message||e));}}
async function savePSDAt(path){if(doc.maps.length>1)toast('A PSD holds the base colour only. Save as .gouache to keep every map.');try{await tick();const blob=await encodePSD();await platform.writeFile(path,new Uint8Array(await blob.arrayBuffer()));doc.filePath=path;doc.name=baseName(fileNameOf(path));platform.recentAdd(path);markSaved();updateStatus();toast('Saved '+path);}catch(e){console.error(e);toast('The PSD could not be saved: '+(e.message||e));}}
async function dlgSaveAsNative(){const cur=saveFmtDefault(),order=[saveTypeInfo(cur),...SAVE_TYPES.filter(t=>t[0]!==cur)];
  const path=await platform.saveAsPath(slug(doc.name)+'.'+saveTypeInfo(cur)[2][0],order.map(t=>({name:t[1]+' (*.'+t[2].join(', *.')+')',extensions:t[2]})));
  if(!path)return;let fmt=saveTypeOfExt(extOf(path)),p=path;if(!fmt){fmt=cur;p=path+'.'+saveTypeInfo(cur)[2][0];}
  saveAsCfg.fmt=fmt;try{localStorage.setItem('gs.saveAsFmt',fmt);}catch(e){}
  if(fmt==='gouache')return withPaintDocAsync(()=>saveDocAt(p));if(fmt==='psd')return withPaintDocAsync(()=>savePSDAt(p));
  saveFormatOptions(fmt,()=>saveImageTo(fmt,p));}
function dlgSaveAsWeb(){let cur=saveFmtDefault();const name=el('input',{type:'text',id:'saveAsName',value:slug(doc.name),'aria-label':'File name'}),
    sel=el('select',{id:'saveAsType','aria-label':'Save as type'},...SAVE_TYPES.map(t=>el('option',{value:t[0],text:t[1]+' (.'+t[2][0]+')'}))),opts=el('div',{class:'fmt-opts'});sel.value=cur;
  const draw=()=>{cur=sel.value;exp.fmt=cur;exp.png16=exp.tif16=doc.depth===16;opts.replaceChildren(...(['png','jpg','tga','tif','dds','webp'].includes(cur)?exportOptsFor(cur,draw):[]));};sel.onchange=draw;draw();
  openDialog({title:'Save as',body:el('div',{class:'dlg-grid'},el('div',{class:'frow'},el('label',{text:'File name'}),name),el('div',{class:'frow'},el('label',{text:'Save as type'}),sel),opts),okLabel:'Save',
    onOk(){const base=(name.value.trim()||slug(doc.name)).replace(/[\\/:*?"<>|]/g,'_'),fmt=sel.value,ext=saveTypeInfo(fmt)[2][0];saveAsCfg.fmt=fmt;try{localStorage.setItem('gs.saveAsFmt',fmt);}catch(e){}
      setTimeout(()=>{if(fmt==='gouache')return withPaintDocAsync(()=>saveDoc(true));if(fmt==='psd')return withPaintDocAsync(savePSDAs);saveImageTo(fmt,null,base+'.'+ext);},0);}});}
function dlgSaveAs(){if(ui.mode!=='p3d')return platform.isDesktop?dlgSaveAsNative():dlgSaveAsWeb();
  const ch=saveAsChoices(),def='gouache3d';let cur=ch.some(c=>c[0]===saveAsCfg.fmt)?saveAsCfg.fmt:def;
  const list=el('div',{class:'saveas-list',role:'radiogroup','aria-label':'File type'});
  const draw=()=>list.replaceChildren(...ch.map(([v,l,n])=>el('label',{class:'saveas-row'+(v===cur?' on':'')},
    el('input',{type:'radio',name:'saveAsFmt',value:v,id:'saveAs_'+v,checked:v===cur,onchange:()=>{cur=v;draw();}}),el('span',{},el('b',{text:l}),el('small',{class:'dim',text:' '+n})))));
  draw();
  openDialog({title:'Save as',body:el('div',{},list),okLabel:'Continue',onOk(){saveAsCfg.fmt=cur;try{localStorage.setItem('gs.saveAsFmt',cur);}catch(e){}setTimeout(()=>saveAsGo(cur),0);}});}
function saveAsGo(v){if(v==='gouache3d')return saveP3Project(true);if(v==='tex')return dlgExportTextures();
  if(v==='gouache')return withPaintDocAsync(()=>saveDoc(true));if(v==='psd')return withPaintDocAsync(savePSDAs);
  exp.fmt=v;return dlgExport();}
