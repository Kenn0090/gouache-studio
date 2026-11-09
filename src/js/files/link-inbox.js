/* ================= Things sent TO Gouache from Blender, Unity and Unreal (0.96.4, Kenn: "export and import into both") =================
   The desktop app listens on 127.0.0.1 (src-tauri link.rs, port LINK_PORT). Each app's Gouache plug-in writes files to a folder
   of its own and posts a short message naming them:
   {from:'blender'|'unity'|'unreal', kind:'model'|'high'|'material'|'camera', name, file, textures:{base,normal,rough,metal,ao,height,emis,opac}, normalDX, camera:{eye,target,fov,zup}}
   model    = a changed (or new) model: it replaces the 3D Paint model and keeps the painting (as the model updater does); in the Bake tab, the low-poly
   high     = a high-poly for the Bake tab
   material = textures that become a material layer (and are kept in Materials)
   camera   = Gouache's 3D view takes Blender's viewport view */
/* LINK_PORT (47660) is in engine-link.js, which loads first */
const linkIn={busy:false,queue:[],last:null};
function linkFrom(m){return {blender:'Blender',unity:'Unity',unreal:'Unreal'}[m&&m.from]||'another app';}
async function linkReadFile(path){const b=await platform.readFile(path);return new File([b],fileNameOf(path));}
async function linkLoadModel(path){const nm=await mwLoad(path);await mwTag(nm,path);return nm;}
async function linkModel(m,role){const who=linkFrom(m);let nm;try{nm=await linkLoadModel(m.file);}catch(e){toast('Could not read the model from '+who+': '+(e.message||e));return;}
  if(role==='high'||(ui.mode==='bake'&&role!=='low3d')){if(ui.mode!=='bake')setMode('bake');bakeSetModel(role==='high'?'high':'low',nm);return;}
  if(ui.mode!=='p3d')setMode('p3d');
  if(p3.imported){mwSwap(p3.imported,nm);nm.srcPath=m.file;toast('Updated the model from '+who+': '+nm.tris.toLocaleString()+' triangles. Your painting is kept.');}
  else{await p3NewProject(ui.mode==='p3d'?doc.w:2048,{imported:nm});toast('Started a 3D Paint project with “'+nm.name+'” from '+who+'.');}}
/* textures named by channel: they go through Materials › From textures, so packed and DirectX maps work as there */
const LINK_CH_NAME={base:'BaseColor',normal:'Normal',rough:'Roughness',metal:'Metallic',ao:'AmbientOcclusion',height:'Displacement',emis:'Emission',opac:'Opacity',gloss:'Glossiness',arm:'ARM'};
async function linkMaterial(m){const T=m.textures||{},files=[];
  for(const k in T){if(!T[k]||!LINK_CH_NAME[k])continue;try{const f=await linkReadFile(T[k]);const ext=extOf(f.name)||'png';
      files.push(new File([f],(m.name||'Material')+'_'+LINK_CH_NAME[k]+(k==='normal'&&m.normalDX?'DX':'')+'.'+ext));}catch(e){toast('Skipped '+fileNameOf(T[k])+': '+(e.message||e));}}
  if(!files.length){toast('No textures came from '+linkFrom(m)+'.');return null;}
  let rec;try{rec=await miBuild(files,m.name||null,4096);}catch(e){toast('Could not use the textures from '+linkFrom(m)+': '+(e.message||e));return null;}
  rec.name=m.name||rec.name;matLib.list.push(rec);try{store.put(rec,'materials');}catch(e){}renderMats();
  if(ui.mode!=='p3d'&&ui.mode!=='paint')setMode(p3.imported?'p3d':'paint');
  const L=matApply(rec);toast('Added the material “'+rec.name+'” from '+linkFrom(m)+' (also kept in Materials).');return L;}
/* Blender's view: eye and target in its world (Z up unless zup is false), placed like the model was (centred and scaled to 2 units) */
function linkCamera(m){const c=m.camera;if(!c||!c.eye||!c.target){toast('No camera came from '+linkFrom(m)+'.');return;}
  const M=(ui.mode==='p3d'?p3.imported:null)||v3.imported||v3.mesh;const up=c.zup!==false?p=>[p[0],p[2],-p[1]]:p=>p.slice(0,3);
  const fit=p=>{p=up(p);if(M&&M.fitC)p=p.map((v,i)=>(v-M.fitC[i])*M.fitS);for(let i=0;i<((M&&M.upTurns)|0);i++)p=[p[0],p[2],-p[1]];/* the model was turned Z up → Y up on loading */return p;};
  const e=fit(c.eye),t=fit(c.target),d=[e[0]-t[0],e[1]-t[1],e[2]-t[2]],dist=Math.hypot(...d)||1;
  Object.assign(v3.cam,{tx:t[0],ty:t[1],tz:t[2],dist,pitch:Math.asin(Math.max(-1,Math.min(1,d[1]/dist))),yaw:Math.atan2(d[0],d[2])});
  if(c.fov>1&&c.fov<170)v3s().fov=c.fov;if(c.ortho!=null)v3s().ortho=!!c.ortho;
  if(!v3.on&&ui.mode!=='p3d'&&ui.mode!=='bake')toggle3D();v3.dirty=true;requestRender(true);toast('The 3D view now matches '+linkFrom(m)+'’s view.');}
async function linkInbox(m){if(typeof m==='string'){try{m=JSON.parse(m);}catch(e){return;}}if(!m||typeof m!=='object')return;
  linkIn.queue.push(m);if(linkIn.busy)return;linkIn.busy=true;
  try{while(linkIn.queue.length){const x=linkIn.queue.shift();linkIn.last=x;
      if(stroke||!document.getElementById('modal').hidden){await new Promise(r=>setTimeout(r,400));if(stroke||!document.getElementById('modal').hidden){linkIn.queue.unshift(x);continue;}}
      try{if(x.kind==='camera')linkCamera(x);
        else if(x.kind==='material')await linkMaterial(x);
        else if(x.kind==='high')await linkModel(x,'high');
        else if(x.kind==='model'){if(x.file)await linkModel(x,ui.mode==='bake'?'low':'low3d');if(x.textures&&Object.keys(x.textures).length)await linkMaterial(x);}
        else toast('Gouache got something it does not know from '+linkFrom(x)+'.');}
      catch(e){console.error('link',e);toast('Could not take what '+linkFrom(x)+' sent: '+(e.message||e));}}}
  finally{linkIn.busy=false;}}
if(platform.isDesktop&&TAURI&&TAURI.event){TAURI.event.listen('link-inbox',e=>linkInbox(e.payload));}
