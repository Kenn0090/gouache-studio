/* ================= Send an export straight into Blender, Unity, Godot or Unreal (0.27, desktop) =================
   Kenn: an option in the export window to send the textures (and the model, with its textures hooked up) straight
   into the engine or app. Unity, Godot and Unreal: the files go into a folder inside your project, which the editor
   picks up (Unity and Godot when you switch to them; Unreal with Auto Import on, or drag the .glb in). Blender: a
   running Blender with the Gouache Studio add-on receives the .glb at once (each send replaces the last one);
   without it, Blender is started with the model if you told the app where Blender is. */
const ES_TARGETS=[['none','Nowhere else (just save)'],['blender','Blender'],['unity','Unity'],['godot','Godot'],['unreal','Unreal Engine']];
const ES_PORT=47650;
const es=(()=>{const d={to:'none',dirs:{},blender:''};try{return Object.assign(d,JSON.parse(localStorage.getItem('gs.engines')||'{}'));}catch(e){return d;}})();
function esSave(){try{localStorage.setItem('gs.engines',JSON.stringify(es));}catch(e){}}
const esActive=()=>platform.isDesktop&&es.to&&es.to!=='none';
const esSep=d=>d.includes('\\')?'\\':'/';
/* where each engine keeps imported files, inside the project */
const esSub=(to,name)=>({unity:['Assets','Gouache',name],godot:['gouache',name],unreal:['Content','Gouache',name]})[to];
/* is this folder the right kind of project? (Godot has project.godot, Unreal a .uproject; Unity has an Assets folder) */
async function esCheckProject(to,dir){try{const fs=(await platform.invoke('dir_files',{dir}))||[],names=fs.map(([p])=>fileNameOf(p).toLowerCase());
    if(to==='godot')return names.includes('project.godot');if(to==='unreal')return names.some(n=>n.endsWith('.uproject'));return true;}catch(e){return true;}}
/* the controls in the Export textures window */
function esRow(redraw){if(!platform.isDesktop)return [el('p',{class:'note',text:'Sending straight into Blender, Unity, Godot or Unreal works in the desktop app.'})];
  const sel=el('select',{id:'txSend','aria-label':'Send to'},...ES_TARGETS.map(([v,l])=>el('option',{value:v,text:l})));sel.value=es.to||'none';
  sel.onchange=()=>{es.to=sel.value;esSave();if(esActive()&&mxHasModel()&&texCfg.model==='none')texCfg.model='glb';redraw();};
  const out=[el('div',{class:'frow'},el('label',{for:'txSend',text:'Send to'}),sel)];
  if(es.to==='blender'){
    out.push(el('p',{class:'note',text:'A running Blender with the Gouache Studio add-on gets the model at once (each send replaces the last one). Otherwise Blender is started with it'+(es.blender?'.':' once you choose the Blender program.')}),
      el('div',{class:'chips'},el('button',{class:'btn sm',id:'esAddon',text:'Save the Blender add-on…',onclick:esSaveAddon}),
        el('button',{class:'btn sm',id:'esBlender',text:es.blender?'Blender: '+fileNameOf(es.blender):'Choose the Blender program…',title:es.blender||'',onclick:async()=>{const p=await platform.openDialog([{name:'Blender',extensions:['exe','app','']}]).catch(()=>null);if(p){es.blender=p;esSave();redraw();}}})),
      el('div',{class:'chips'},el('span',{class:'note',text:'Files go to: '+(es.dirs.blender||'a folder you choose')}),el('button',{class:'btn sm',text:es.dirs.blender?'Change…':'Choose…',onclick:async()=>{const d=await platform.pickFolder();if(d){es.dirs.blender=d;esSave();redraw();}}})));}
  else if(es.to!=='none'){const d=es.dirs[es.to],label=ES_TARGETS.find(x=>x[0]===es.to)[1];
    out.push(el('div',{class:'chips'},el('span',{class:'note',text:d?label+' project: '+d:'Choose your '+label+' project’s folder.'}),
      el('button',{class:'btn sm',id:'esProject',text:d?'Change…':'Choose project…',onclick:async()=>{const p=await platform.pickFolder();if(!p)return;
        if(!(await esCheckProject(es.to,p))){toast('That folder doesn’t look like a '+label+' project ('+(es.to==='godot'?'no project.godot':'no .uproject file')+').');return;}es.dirs[es.to]=p;esSave();redraw();}})),
      el('p',{class:'note',text:es.to==='unity'?'Files go to Assets/Gouache/<name>. Unity imports them when you switch to it; the .glb needs the glTFast package (Package Manager).':
        es.to==='godot'?'Files go to res://gouache/<name>. Godot imports them when you switch to it, materials included.':
        'Files go to Content/Gouache/<name>. Turn on Auto Import (Editor Preferences › Loading & Saving), or drag the .glb into the Content Browser; Unreal 5 builds the materials from it.'}));}
  return out;}
/* where the export goes: the engine project's folder, Blender's folder, or a folder you pick */
async function esTargetDir(name){if(!esActive())return await platform.pickFolder();
  if(es.to==='blender'){if(!es.dirs.blender){const d=await platform.pickFolder();if(!d)return null;es.dirs.blender=d;esSave();}return es.dirs.blender;}
  const base=es.dirs[es.to];if(!base){toast('Choose the project folder in the export window first.');return null;}
  const dir=[base.replace(/[\\/]+$/,''),...esSub(es.to,pascal(name))].join(esSep(base));await platform.invoke('make_dir',{path:dir});return dir;}
/* after the files are written */
async function esAfter(dir,files,name){if(!esActive())return;const label=ES_TARGETS.find(x=>x[0]===es.to)[1],sep=esSep(dir);
  if(es.to!=='blender'){toast('Sent '+files.length+' files to '+label+': '+dir);return;}
  const m=files.find(f=>/\.(glb|obj)$/i.test(f.name));if(!m){toast('Saved to '+dir+'. Tick a model (.glb) to send it to Blender.');return;}
  const path=dir.replace(/[\\/]+$/,'')+sep+m.name;
  if(await platform.invoke('blender_send',{path,port:ES_PORT}).catch(()=>false)){toast('Sent “'+m.name+'” to Blender.');return;}
  if(!es.blender){toast('Saved to '+dir+'. Blender isn’t listening: install the add-on (Save the Blender add-on…) and start Blender, or choose the Blender program so it can be started.');return;}
  /* start Blender with a tiny script that imports the model */
  const script=dir.replace(/[\\/]+$/,'')+sep+'_gouache_open.py',pl=JSON.stringify(path);
  await platform.writeFile(script,new TextEncoder().encode('import bpy\nif "Cube" in bpy.data.objects:\n    bpy.data.objects.remove(bpy.data.objects["Cube"], do_unlink=True)\n'+(/\.obj$/i.test(path)?'bpy.ops.wm.obj_import(filepath='+pl+')\n':'bpy.ops.import_scene.gltf(filepath='+pl+')\n')));
  try{await platform.invoke('launch_app',{exe:es.blender,args:['--python',script]});toast('Starting Blender with “'+m.name+'”…');}catch(e){toast('Could not start Blender: '+(e.message||e));}}
/* the add-on file, to install in Blender (Edit › Preferences › Add-ons › Install…) */
async function esSaveAddon(){const bytes=new TextEncoder().encode(BLENDER_ADDON||'');
  if(platform.isDesktop){const d=await platform.pickFolder();if(!d)return;const p=d.replace(/[\\/]+$/,'')+esSep(d)+'gouache_link.py';await platform.writeFile(p,bytes);
    toast('Saved '+p+'. In Blender: Edit › Preferences › Add-ons › Install…, pick it and tick “Gouache Studio link”.');return;}
  const r=await deliver('gouache_link.py',new Blob([bytes],{type:'text/x-python'}));toast(deliveredText(r,'The Blender add-on'));}
