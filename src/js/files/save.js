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
  if(platform.isDesktop){const bytes=new Uint8Array(await blob.arrayBuffer());
    try{const path=await platform.saveAs(filename,bytes);if(!path)return {ok:false,msg:'Save cancelled.'};return {ok:true,name:fileNameOf(path),path,desktop:true};}
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
function savePSDAs(){return savePSD(true);}
function markSaved(){doc.savedAt=hist.undo.length?hist.undo[hist.undo.length-1]:null;updateTitle();}
function updateTitle(){platform.setTitle((doc.name||'Untitled')+(doc.filePath?' — '+doc.filePath:'')+' — Gouache Studio');}
/* Open recent (desktop) */
async function dlgRecent(){const list=await platform.recentList();
  const body=el('div',{class:'dlg-grid'});
  if(!list.length)body.append(el('p',{class:'note',text:'Files you open or save will be listed here.'}));
  else body.append(el('div',{class:'recentlist'},...list.map(p=>el('button',{class:'btn',title:p,onclick:()=>{closeDialog();openPath(p,'open');}},el('b',{text:fileNameOf(p)}),el('span',{class:'dim',text:p})))));
  openDialog({title:'Open recent',body,okLabel:null,cancelLabel:'Close'});}

