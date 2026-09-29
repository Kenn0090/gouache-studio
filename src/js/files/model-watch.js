/* ================= Automatic model updater (0.27, desktop) =================
   Kenn: when a model is saved again after editing it elsewhere (Blender, Maya…), ask "Update the mesh?" and then
   bake again with the last settings; a setting does both without asking. It follows the models of 3D Paint, the 3D
   view and the Bake tab (they work together). A changed high-poly is never updated without asking. Only models
   opened from a file dialog in the desktop app can be watched (a browser can't look at files on disk). */
const mw={timer:0,busy:false,
  stat:p=>platform.invoke('file_mtime',{path:p}),
  read:async p=>platform.readFile(p),
  p3Bake:(...a)=>p3Bake(...a)};
/* remember where a model came from, and when that file was last saved */
async function mwTag(m,path){if(!m||!path)return m;m.srcPath=path;try{m.srcTime=await mw.stat(path);}catch(e){m.srcTime=0;}mwStart();return m;}
/* the models being used, with what each is: the painting model (low) or the high-poly */
function mwModels(){const out=[],seen=new Set(),add=(m,role)=>{if(m&&m.srcPath&&!seen.has(m)){seen.add(m);out.push({m,role});}};
  add(v3.imported,'low');if(typeof p3!=='undefined')add(p3.imported,'low');
  if(typeof bakeCfg!=='undefined'){add(bakeCfg.low,'low');add(bakeCfg.high,'high');}return out;}
async function mwLoad(path){const bytes=await mw.read(path),dir=path.replace(/[\\/][^\\/]*$/,''),sep=path.includes('\\')?'\\':'/';loadStart(fileNameOf(path));
  try{return await parseModelBytes(fileNameOf(path),bytes,async u=>{const b=await mw.read(dir+sep+u);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);});}finally{loadEnd();}}
/* put the new model everywhere the old one was */
function mwSwap(old,m){m.srcPath=old.srcPath;m.srcTime=old.srcTime;
  if(v3.imported===old){v3.imported=m;v3.mesh=null;v3LoadModel(true);}
  if(typeof p3!=='undefined'&&p3.imported===old){p3.imported=m;if(ui.mode==='p3d'){v3.imported=m;if(typeof p3SyncSets==='function'){v3LoadModel(true);p3SyncSets();buildP3Panel();}}}
  if(typeof bakeCfg!=='undefined'){if(bakeCfg.low===old)bakeSetModel('low',m);if(bakeCfg.high===old)bakeSetModel('high',m);}
  v3.mapsDirty=true;v3.dirty=true;requestRender(true);}
/* bake again with the last settings: 3D Paint's Bake mesh maps if it was used, else the Bake tab */
function mwCanRebake(){return !!((ui.mode==='p3d'&&p3bk.lastArgs)||(bakeCfg.low&&Object.keys(bakeCfg.kinds||{}).some(k=>bakeCfg.kinds[k])&&(Object.keys(bk.res||{}).length||bk.byMat)));}
async function mwRebake(){if(bk.busy)return;
  if(ui.mode==='p3d'&&p3bk.lastArgs){const a=p3bk.lastArgs;return mw.p3Bake(a.ks,a.size,a.which);}
  const C=bakeCfg,L=bkLow(),ks=Object.keys(C.kinds).filter(k=>C.kinds[k]);if(!L||!ks.length)return;
  if(C.perMat!==false&&bkMats(L))return runBakeSets(L,ks);bk.byMat=null;return runBake(L,ks);}
function mwAsk(title,text,ok,extra){return new Promise(res=>openDialog({title,body:el('div',{class:'dlg-grid'},el('p',{class:'note',text}),...(extra||[])),okLabel:ok,cancelLabel:'Not now',onOk(){res(true);},onCancel(){res(false);}}));}
async function mwChanged(e,t){const {m,role}=e,name=fileNameOf(m.srcPath),auto=!!prefs.meshAuto&&role!=='high';
  if(!auto){let always=!!prefs.meshAuto;
    const extra=role==='high'?[]:[chk('mwAlways','Always update and bake without asking',always,v=>{always=v;})];
    const yes=await mwAsk(role==='high'?'The high-poly changed':'The model changed',
      '“'+name+'” was saved again'+(role==='high'?' (the high-poly used for baking)':'')+'. Update it here?','Update',extra);
    if(role!=='high'&&always!==!!prefs.meshAuto){prefs.meshAuto=always;savePrefs();}
    if(!yes){m.srcTime=t;return;}}
  let nm;try{nm=await mwLoad(m.srcPath);}catch(err){toast('Could not read the changed model: '+(err.message||err));m.srcTime=t;return;}
  nm.srcPath=m.srcPath;m.srcTime=t;mwSwap(m,nm);nm.srcTime=t;
  toast('Updated “'+nm.name+'”: '+nm.tris.toLocaleString()+' triangles.');
  if(!mwCanRebake())return;
  if(auto||prefs.meshAuto||await mwAsk('Bake again?','Bake the mesh maps again with the last settings, so everything that uses them follows the new model?','Bake'))await mwRebake();}
async function mwTick(){if(mw.busy||bk.busy||(typeof stroke!=='undefined'&&stroke)||!document.getElementById('modal').hidden)return;mw.busy=true;
  try{for(const e of mwModels()){let t;try{t=await mw.stat(e.m.srcPath);}catch(err){continue;}if(!t||!e.m.srcTime||t<=e.m.srcTime+.5)continue;await mwChanged(e,t);break;}}
  finally{mw.busy=false;}}
function mwStart(){if(mw.timer||!platform.isDesktop)return;mw.timer=setInterval(mwTick,2500);}
