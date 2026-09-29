/* ================= Autosave and backups (0.25) =================
   Every few minutes (Preferences › Files: off, 1, 2, 5, 10, 15 or 30 minutes; 5 by default) the painting, and the
   3D Paint project while you are in 3D Paint, are saved as recovery copies when they have changed: in the desktop
   app to an Autosave folder beside the app's settings, in the browser to its own storage. They are removed when
   you save for real. If the app closes without saving (or crashes), the welcome screen offers them back.
   Optionally autosave also saves over the file itself (when it has one). Backups: before saving over a file,
   the previous version is kept beside it as "name.backup.gouache" (Preferences, on by default). */
const AS_TIMES=[0,1,2,5,10,15,30];
const asMin=()=>prefs.autosaveMin===undefined?5:prefs.autosaveMin;
const as={last:{},t:{},busy:false,dir:null};
const asSlug=s=>String(s||'Untitled').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80);
async function asDir(){if(!as.dir)as.dir=await platform.invoke('autosave_dir');return as.dir;}
/* the browser keeps its copies in the app's own storage */
const asDB={open(){if(this.db)return Promise.resolve(this.db);return new Promise((res,rej)=>{try{const r=indexedDB.open('gouache-autosave',1);r.onupgradeneeded=()=>{r.result.createObjectStore('copies',{keyPath:'id'});};r.onsuccess=()=>{this.db=r.result;res(this.db);};r.onerror=()=>rej(r.error);}catch(e){rej(e);}});},
  run(mode,fn){return this.open().then(db=>new Promise((res,rej)=>{const t=db.transaction('copies',mode),q=fn(t.objectStore('copies'));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error);}));}};
/* what changed since the last autosave */
/* (0.27) read the painting's history without swapping documents: the tab bar asks every 0.7 s, and a swap rebuilt
   the panels (a Material slider was taken from under the mouse mid-drag) */
function asPaintPeek(fn){const S=tabDocs.paint&&!tabDocs.inPaint?tabDocs.paint:null;return S?fn(S.undo||[],S.doc):fn(hist.undo,doc);}
const asPaintSig=()=>asPaintPeek(u=>u.length?u[u.length-1]:null);
const asPaintSaved=()=>asPaintPeek((u,d)=>!u.length||u[u.length-1]===d.savedAt);
const asPaintName=()=>asPaintPeek((u,d)=>d.name||'Untitled');
async function asWrite(kind,name,blob){const t=Date.now();
  if(platform.isDesktop){const dir=await asDir(),sep=dir.includes('\\')?'\\':'/',file=dir+sep+(kind==='p3d'?'3D Paint - ':'Paint - ')+asSlug(name)+(kind==='p3d'?'.gouache3d':'.gouache');
    if(as.t[kind]&&as.t[kind].path&&as.t[kind].path!==file)platform.invoke('autosave_delete',{path:as.t[kind].path}).catch(()=>{});
    await platform.writeFile(file,new Uint8Array(await blob.arrayBuffer()));as.t[kind]={path:file,t};}
  else{await asDB.run('readwrite',st=>st.put({id:kind,name,t,blob}));as.t[kind]={t};}
  fileLocUpdate&&fileLocUpdate();}
async function asClear(kind){const c=as.t[kind];delete as.t[kind];as.last[kind]=undefined;
  try{if(platform.isDesktop){if(c&&c.path)await platform.invoke('autosave_delete',{path:c.path});}else await asDB.run('readwrite',st=>st.delete(kind));}catch(e){}}
async function autosaveNow(force){if(as.busy||stroke||preview||(typeof tabDocs!=='undefined'&&tabDocs.hold)||(typeof bk!=='undefined'&&bk.busy))return false;as.busy=true;let n=0;
  try{/* the painting */
    const sig=asPaintSig();if(sig&&(force||sig!==as.last.paint)){if(asPaintSaved()){await asClear('paint');}
      else{if(prefs.autosaveOver&&platform.isDesktop&&withPaintDoc(()=>doc.filePath&&extOf(doc.filePath)==='gouache'))await withPaintDocAsync(()=>saveDoc(false));
        else await asWrite('paint',asPaintName(),await encodeGouache());n++;}as.last.paint=sig;}
    /* the 3D Paint project (only while in 3D Paint: its texture sets are live there) */
    if(ui.mode==='p3d'&&typeof p3!=='undefined'&&p3.started){const s=p3Sig();if(force||s!==as.last.p3d){if(s===p3.savedAt)await asClear('p3d');
      else{if(prefs.autosaveOver&&platform.isDesktop&&p3.path)await saveP3Project(false);else await asWrite('p3d',p3.name||'3D Paint',await encodeP3Project());n++;}as.last.p3d=s;}}}
  catch(e){console.warn('autosave',e);}finally{as.busy=false;}return n>0;}
let asTimer=0,asNext=0;
/* Before each autosave a small popup counts down (Preferences: 3, 5 or 10 seconds, or no warning), so nobody is
   surprised by the short pause while it saves. "Not now" waits another minute; "Save now" saves at once. */
const asCountSec=()=>prefs.autosaveWarn===undefined?5:prefs.autosaveWarn;
function asPending(){try{const sig=asPaintSig();if(sig&&sig!==as.last.paint&&!asPaintSaved())return true;
  if(ui.mode==='p3d'&&typeof p3!=='undefined'&&p3.started){const s=p3Sig();if(s!==as.last.p3d&&s!==p3.savedAt)return true;}}catch(e){}return false;}
let asCd=null;
function asCountClose(){if(!asCd)return;clearInterval(asCd.timer);asCd.box.remove();asCd=null;}
function asCountdown(){if(asCd)return;const n0=asCountSec();if(!n0){autosaveNow(false);return;}
  const num=el('b',{text:String(n0)}),box=el('div',{class:'ascount',role:'status','aria-live':'polite'},
    el('span',{},'Autosaving in ',num,'…'),
    el('button',{class:'btn sm',text:'Not now',onclick:()=>{asCountClose();asNext=Date.now()+60000;}}),
    el('button',{class:'btn sm primary',text:'Save now',onclick:()=>{asCountClose();autosaveNow(false);}}));
  document.body.append(box);let n=n0;
  asCd={box,timer:setInterval(()=>{n--;if(n>0){num.textContent=String(n);return;}
    if(stroke||ptrBusy()){num.textContent='0';return;} /* wait until the stroke is finished */
    asCountClose();box.classList.add('go');autosaveNow(false).then(ok=>{if(ok)toast('Autosaved.');});},1000)};}
const ptrBusy=()=>typeof ptr!=='undefined'&&!!ptr;
function asSchedule(){clearInterval(asTimer);asCountClose();const m=asMin();if(!m){asNext=0;return;}asNext=Date.now()+m*60000;
  asTimer=setInterval(()=>{if(Date.now()<asNext||asCd)return;asNext=Date.now()+asMin()*60000;if(asPending())asCountdown();},15000);}
/* after a real save the recovery copy is not needed any more */
{const sd=saveDoc;saveDoc=async function(f){const r=await sd(f);if(asPaintSaved())asClear('paint');return r;};
 const sp=saveP3Project;saveP3Project=async function(f){const r=await sp(f);if(p3.savedAt===p3Sig())asClear('p3d');return r;};}
/* recovery copies left by a session that did not end with everything saved */
async function asRecoveries(){try{if(platform.isDesktop){const l=await platform.invoke('autosave_list');return (l||[]).filter(([p])=>/\.gouache3?d?$/i.test(p)).map(([path,t])=>({kind:/\.gouache3d$/i.test(path)?'p3d':'paint',name:fileNameOf(path).replace(/^(3D )?Paint - /,'').replace(/\.gouache3?d?$/i,''),t:t*1000,path}));}
  const all=await asDB.run('readonly',st=>st.getAll());return (all||[]).map(r=>({kind:r.id,name:r.name,t:r.t,blob:r.blob}));}catch(e){return [];}}
async function asRecover(r){try{let buf;if(r.path){const u=await platform.readFile(r.path);buf=u.buffer.slice(u.byteOffset,u.byteOffset+u.byteLength);}else buf=await r.blob.arrayBuffer();
    if(r.kind==='p3d'){if(ui.mode!=='p3d'&&!setMode('p3d',true))return;await openP3Project(buf,r.name,null);}
    else{if(tabDocs.paint&&!setMode('paint',true))return;if(!(await askReplace()))return;await openGouache(buf,r.name);}
    toast('Recovered “'+r.name+'”. Save it to keep it.');}
  catch(e){toast('Could not recover it: '+(e.message||e));}}
async function asDiscard(r){try{if(r.path)await platform.invoke('autosave_delete',{path:r.path});else await asDB.run('readwrite',st=>st.delete(r.kind));}catch(e){}}
/* backups: the previous version kept beside the file when saving over it */
{const wf=platform.writeFile.bind(platform);platform.writeFile=async function(path,bytes){if(prefs.backup!==false&&/\.gouache3?d?$/i.test(path)&&!(as.dir&&path.startsWith(as.dir)))await this.invoke('backup_copy',{path}).catch(()=>{});return wf(path,bytes);};}
function autosavePrefsBox(){const d={min:asMin(),warn:asCountSec(),over:!!prefs.autosaveOver,backup:prefs.backup!==false};
  const el1=el('div',{class:'dlg-grid'},seg(AS_TIMES.map(m=>[m,m?m+' min':'Off']),d.min,v=>{d.min=+v;},'Autosave every'),
    seg([[0,'No warning'],[3,'3 s'],[5,'5 s'],[10,'10 s']],d.warn,v=>{d.warn=+v;},'Countdown first'),
    chk('pAsOver','Autosave also saves over the file itself (when it has been saved before)',d.over,v=>{d.over=v;}),
    el('p',{class:'note',text:'Otherwise autosave keeps a recovery copy'+(platform.isDesktop?' in the app’s Autosave folder':' in the browser')+', offered back if the app closes without saving.'}),
    platform.isDesktop?chk('pBackup','Keep a backup of the previous save beside the file (name.backup.gouache)',d.backup,v=>{d.backup=v;}):null);
  return {el:el1,save(){prefs.autosaveMin=d.min;prefs.autosaveWarn=d.warn;prefs.autosaveOver=d.over;prefs.backup=d.backup;asSchedule();}};}
setTimeout(asSchedule,3000);
