/* ================= Engine projects (0.94, bridge) =================
   Kenn: working on a game with many assets that share shaders, Gouache should know the project: which engine and folder,
   how textures are exported there, which assets were already sent and which shader looks (master shaders) exist, and how
   old each master is. So sending a new asset reuses what is there, sending an old asset updates it in place, and masters
   are only touched (after asking) when the look itself changed in a new version of Gouache.
   The record is a small file inside the engine project: <project>/gouache_project.json, shared with teammates. */
const EP_FILE='gouache_project.json';
const EP_KEYS=['preset','size','fmt','normal','pad','padPx','h16','meshMaps','model'];
const epPath=to=>es.dirs[to]?elJoin(es.dirs[to],EP_FILE):null;
const epBlank=(to,base)=>({gouache:1,engine:to,name:(base||'').split(/[\\/]/).filter(Boolean).pop()||'Game',settings:null,assets:{},masters:{}});
async function epLoad(to){const f=epPath(to);if(!f)return null;
  try{if(!(await elExists(f)))return epBlank(to,es.dirs[to]);const t=new TextDecoder().decode(await platform.readFile(f)),r=JSON.parse(t);
    return Object.assign(epBlank(to,es.dirs[to]),r,{assets:r.assets||{},masters:r.masters||{}});}catch(e){console.warn(e);return epBlank(to,es.dirs[to]);}}
async function epSaveRec(to,rec){const f=epPath(to);if(!f)return;rec.updated=new Date().toISOString();await platform.writeFile(f,new TextEncoder().encode(JSON.stringify(rec,null,1)));}
const epSettingsFrom=()=>{const o={};for(const k of EP_KEYS)if(texCfg[k]!==undefined)o[k]=texCfg[k];return o;};
/* the asked-before-updating step: resolves true to update the master shaders, false to leave them */
function epAskMasters(rec,to){return new Promise(res=>{const old=rec.masters[to],body=el('div',{class:'dlg-grid'},el('p',{class:'note',text:'The Gouache shaders in this Gouache version are newer than the master shaders already in your '+EL_NAME[to]+' project (version '+old+', now '+ESH_MASTER_VER+').'}),
    el('p',{class:'note',text:'Update them in place? Each asset keeps its own textures and settings. Your own changes to the master shader files would be replaced.'}));
  let done=false;const fin=v=>{if(!done){done=true;res(v);}};
  openDialog({title:'Update the master shaders?',body,okLabel:'Update them',onOk(){fin(true);},onCancel(){fin(false);}});});}
/* called before the files are written: should the shared master shaders be rewritten? */
async function epMastersCheck(to){if(!EL_PORT[to]||!es.dirs[to])return {rec:null,update:false};const rec=await epLoad(to);
  const old=rec.masters[to];let update=false;if(old!=null&&old<ESH_MASTER_VER)update=await epAskMasters(rec,to);return {rec,update};}
/* after the export: remember it in the project file */
async function epRecord(to,rec,name,files,shInfo,modelFile,updated){if(!rec||!es.dirs[to])return;
  if(rec.masters[to]==null||updated)rec.masters[to]=ESH_MASTER_VER;
  rec.settings=epSettingsFrom();
  const sets=Object.keys(shInfo||{});
  const infos={};for(const st of sets){const I=shInfo[st],tex={};for(const [k,f] of Object.entries(I.tex||{}))if(f&&f.name)tex[k]=f.name;infos[st]={sh:JSON.parse(JSON.stringify(I.sh||{kind:'std',p:{}})),tex,alpha:!!I.alpha,variant:I.variant||null};}
  rec.assets[pascal(name)]={sets,looks:[...new Set(sets.map(s=>eshLook((shInfo[s].sh||{}).kind)))],model:modelFile||null,size:eshModelSize(mxHasModel()?mxModel():null),infos,source:(typeof curFilePath==='function'?curFilePath():null)||null,sent:new Date().toISOString()};
  try{await epSaveRec(to,rec);}catch(e){console.warn(e);}}
/* the export window: the project's name, its settings, and what it holds */
function epRow(redraw){const to=es.to;if(!EL_PORT[to]||!platform.isDesktop||!es.dirs[to])return [];
  const box=el('div',{class:'dlg-grid',id:'epBox'});
  epLoad(to).then(rec=>{const n=Object.keys(rec.assets).length,known=!!(rec.settings);
    const use=chk('epUse','Use this project’s export settings',es.useProject!==false,v=>{es.useProject=v;esSave();if(v&&rec.settings){Object.assign(texCfg,rec.settings);redraw();}});
    box.append(el('div',{class:'sub',text:'Engine project'}),
      el('p',{class:'note',id:'epNote',text:'“'+rec.name+'” ('+EL_NAME[to]+'): '+(n?n+' asset'+(n===1?'':'s')+' sent so far'+(known?'':''):'nothing sent yet')+'. Gouache remembers them in '+EP_FILE+' inside the project, so sending again updates the same files and materials.'}),
      ...(known?[use]:[]));
    /* the project's settings go into the window once per project, so every asset is exported the same way */
    if(known&&es.useProject!==false&&epRow.applied!==to+'|'+es.dirs[to]){epRow.applied=to+'|'+es.dirs[to];Object.assign(texCfg,rec.settings);redraw();}
    if(n)box.append(el('div',{class:'frow'},el('span',{class:'note',text:Object.entries(rec.assets).map(([a,v])=>a+(v.looks&&v.looks.length?' ('+v.looks.join(', ')+')':'')).join(' · ')})));
    if(n)box.append(el('div',{class:'chips'},el('button',{class:'btn sm',id:'epUpdateAll',text:'Update all assets…',title:'Send every asset of this project again from its saved file',onclick:()=>{closeDialog();epUpdateAll(to);}})));});
  return [box];}

/* ================= Variants: the same shader, a different look =================
   Kenn: when an asset uses the shader of a look but with tweaks, choose what to do with the difference:
   only this asset, save it as a named variant other assets can share, or change the look for everyone.
   Each look's usual settings (the project's base) are the first ones sent. A variant keeps its settings under a name:
   in Unreal it is a parent Material Instance (assets add only their textures); in Unity and Godot, where materials have
   no parent, the variant is kept in the project record and every asset using it gets the same values. */
const epRound=v=>typeof v==='number'?+v.toFixed(4):Array.isArray(v)?v.map(epRound):v;
function epP(sh){const P=shParams(sh),o={};for(const k of Object.keys(SH_DEF[sh.kind]||{}))o[k]=epRound(P[k]);return o;}
const epSame=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function epAskVariant(look,asset,set,names){return new Promise(res=>{let mode='variant',name=names[0]||'';
  const nm=el('input',{type:'text',id:'epVarName',value:name,placeholder:'Variant name (for example Night)'});nm.addEventListener('input',()=>{name=nm.value;});
  const choices=[['asset','Only this asset'],['variant','Save as a variant'],['all','Change the look for everyone']];
  const note=el('p',{class:'note',id:'epVarNote'}),sync=()=>{note.textContent=mode==='asset'?'Only “'+asset+'” gets these settings. The shared shader and the other assets stay as they are.':mode==='variant'?'The settings are kept under the name below. Other assets can use the same variant, and changing it later updates all of them.':'The look’s usual settings become these, and every asset that follows the usual look is updated to match.';nm.style.display=mode==='variant'?'':'none';};
  const sg=seg(choices,mode,v=>{mode=v;sync();},'What to do with the difference');
  const body=el('div',{class:'dlg-grid'},el('p',{class:'note',text:'“'+asset+'” ('+set+') uses the '+look+' look with different settings from the rest of this project. What should Gouache do with the difference?'}),sg,note,nm);sync();
  let done=false;const fin=v=>{if(!done){done=true;res(v);}};
  openDialog({title:look+': same shader, different look',body,okLabel:'Continue',onOk(){if(mode==='variant'&&!name.trim()){toast('Give the variant a name.');return false;}fin({mode,name:name.trim()});},onCancel(){fin({mode:'asset',name:''});}});});}
/* decides, for every set about to be sent, whether it follows the project's look, is its own, or is a variant;
   returns what has to change for assets already in the project */
async function epResolve(to,rec,name,shInfo){const out={regen:new Set(),updates:[]};if(!rec)return out;rec.bases=rec.bases||{};rec.variants=rec.variants||{};
  const pn=pascal(name),prev=(rec.assets[pn]||{}).infos||{};
  for(const set of Object.keys(shInfo)){const I=shInfo[set],sh=I.sh||{kind:'std',p:{}},look=eshLook(sh.kind),P=epP(sh),base=rec.bases[look];
    if(!base){rec.bases[look]=P;continue;}
    const was=prev[set]&&prev[set].variant;
    if(was&&rec.variants[look]&&rec.variants[look][was]&&epSame(rec.variants[look][was],P)){I.variant=was;continue;}
    if(epSame(base,P)&&!was)continue;
    if(epSame(base,P)&&was){continue;}   // went back to the usual look
    const match=Object.entries(rec.variants[look]||{}).find(([k,v])=>epSame(v,P));
    if(match){I.variant=match[0];continue;}   // the settings of a variant already in the project
    const c=await epAskVariant(look,pn,set,Object.keys(rec.variants[look]||{}));
    if(c.mode==='asset')continue;
    if(c.mode==='variant'){(rec.variants[look]=rec.variants[look]||{});const changed=rec.variants[look][c.name]&&!epSame(rec.variants[look][c.name],P);rec.variants[look][c.name]=P;I.variant=c.name;
      if(changed)for(const [a,v] of Object.entries(rec.assets))for(const [s2,inf] of Object.entries(v.infos||{}))if(inf.variant===c.name&&!(a===pn&&s2===set)){inf.sh=JSON.parse(JSON.stringify(sh));out.regen.add(a);}
      if(changed)out.updates.push({kind:'variant',look,variant:c.name,...epVariantParams(sh)});
      continue;}
    /* change the look for everyone: the assets that follow the usual look take the new settings */
    const old=base;rec.bases[look]=P;
    for(const [a,v] of Object.entries(rec.assets))for(const [s2,inf] of Object.entries(v.infos||{}))if(!inf.variant&&eshLook((inf.sh||{}).kind)===look&&epSame(epP(inf.sh),old)&&!(a===pn&&s2===set)){inf.sh=JSON.parse(JSON.stringify(sh));out.regen.add(a);
      const pr=eshUnrealParams(inf.sh,v.size||1,!!(inf.tex&&inf.tex.ORM));out.updates.push({kind:'asset',asset:a,safe:eshSafe(s2),scalars:pr.scalars,vectors:pr.vectors});}}
  return out;}
function epVariantParams(sh){const pr=eshUnrealParams(sh,1,false),keys=new Set(pr.lookKeys),sc={},vc={};for(const [k,v] of Object.entries(pr.scalars))if(keys.has(k))sc[k]=v;for(const [k,v] of Object.entries(pr.vectors))if(keys.has(k))vc[k]=v;return {scalars:sc,vectors:vc};}
/* Unity and Godot: rewrite the material files of assets whose look changed (no textures are sent again) */
async function epRegen(to,rec,regen){if(!regen||!regen.size||to==='unreal')return 0;let n=0;
  for(const a of regen){const v=rec.assets[a];if(!v||!v.infos)continue;const info={};
    for(const [s,inf] of Object.entries(v.infos)){const tex={};for(const [k,f] of Object.entries(inf.tex||{}))tex[k]={name:f};info[s]={sh:inf.sh,tex,alpha:!!inf.alpha,variant:inf.variant||null};}
    const dir=elJoin(es.dirs[to],...esSub(to,a));
    for(const f of eshFiles(to,a,info,v.size||1,v.model)){if(f.shared||/\.(png|tga)(\.meta)?$/i.test(f.name)||/\.(glb|fbx|obj)$/i.test(f.name))continue;
      const fp=eshPath(dir,f.name);await platform.invoke('make_dir',{path:fp.replace(/[\\/][^\\/]*$/,'')});await platform.writeFile(fp,f.data);n++;}}
  return n;}

/* ================= Update all assets =================
   Kenn: a button that re-sends every asset of an engine project, one after another, with a progress list. Each asset's
   saved Gouache file is opened in turn and exported again with the project's settings (same names, so the files and
   materials in the engine are updated in place). Your current work must be saved first; it is opened again at the end. */
const EP_STATE_TEXT={wait:'waiting',working:'sending…',ok:'sent',fail:'could not be sent',nosrc:'no saved file (send it once from its own project)',missing:'saved file not found'};
async function epUpdateAll(to){if(!platform.isDesktop||!es.dirs[to])return;const rec=await epLoad(to),names=Object.keys(rec.assets);
  if(!names.length){toast('Nothing has been sent to this project yet.');return;}
  if(typeof unsavedWork==='function'&&unsavedWork()){toast('Save your current work first: Update all opens each asset in turn.');return;}
  const rows=[];for(const n of names){const src=rec.assets[n].source||null;rows.push({n,src,state:!src?'nosrc':(await elExists(src))?'wait':'missing',el:null,txt:null});}
  const orig=typeof curFilePath==='function'?curFilePath():null;let stop=false,running=false,finished=false;
  const list=el('div',{class:'dlg-grid',id:'epUpList'});
  const paint=()=>{for(const r of rows)if(r.txt)r.txt.textContent=EP_STATE_TEXT[r.state];};
  for(const r of rows){r.txt=el('span',{class:'dim'});list.append(el('div',{class:'frow',id:'epUp_'+r.n},el('span',{text:r.n+(rec.assets[r.n].looks&&rec.assets[r.n].looks.length?' ('+rec.assets[r.n].looks.join(', ')+')':'')}),r.txt));}paint();
  const todo=rows.filter(r=>r.state==='wait').length;
  const body=el('div',{class:'dlg-grid'},el('p',{class:'note',text:todo?'Each asset’s saved file is opened in turn and sent again with this project’s settings. Your current work is opened again at the end.':'None of these assets has a saved file to send again.'}),list);
  const run=async()=>{if(running||finished)return;running=true;const ok=$('#dlgOk');if(ok){ok.disabled=true;ok.textContent='Working…';}
    for(const r of rows){if(stop)break;if(r.state!=='wait')continue;r.state='working';paint();
      try{await (window.__epHook&&window.__epHook.openPath||openPath)(r.src,'open');for(let i=0;i<100&&typeof loadDepth!=='undefined'&&loadDepth>0;i++)await new Promise(q=>setTimeout(q,100));await new Promise(q=>setTimeout(q,300));
        Object.assign(texCfg,rec.settings||{});texCfg.name=r.n;es.to=to;const files=await (window.__epHook&&window.__epHook.exportTextures||exportTextures)();r.state=files&&files.length?'ok':'fail';}
      catch(e){console.warn(e);r.state='fail';}paint();}
    if(orig){try{await (window.__epHook&&window.__epHook.openPath||openPath)(orig,'open');}catch(e){console.warn(e);}}
    running=false;finished=true;if(ok){ok.disabled=false;ok.textContent='Close';}
    const n=rows.filter(r=>r.state==='ok').length;toast('Updated '+n+' of '+rows.length+' asset'+(rows.length===1?'':'s')+'.');};
  openDialog({title:'Update all assets',body,okLabel:todo?'Start':'Close',onOk(){if(finished||!todo)return;run();return false;},onCancel(){stop=true;}});}
