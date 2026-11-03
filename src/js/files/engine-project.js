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
  rec.assets[pascal(name)]={sets,looks:[...new Set(sets.map(s=>eshLook((shInfo[s].sh||{}).kind)))],model:modelFile||null,source:(typeof curFilePath==='function'?curFilePath():null)||null,sent:new Date().toISOString()};
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
    if(n)box.append(el('div',{class:'frow'},el('span',{class:'note',text:Object.entries(rec.assets).map(([a,v])=>a+(v.looks&&v.looks.length?' ('+v.looks.join(', ')+')':'')).join(' · ')})));});
  return [box];}
