/* ================= 3D Paint tab =================
   Painting on a model, like Substance Painter. The tab has a canvas of its own (tabdoc.js), separate from
   Paint: the maps of the model's texture set, with the usual layers, fill layers, masks and per-map blending.
   The 3D view is the main viewport; painting is always on (left paints; the navigation keys turn, move and
   zoom); Alt over the model picks its colour. Layouts: 3D only, 3D beside the flat texture, or the flat
   texture only. Colour and Brushes sit in their own column beside the viewport (dock.js, dock2). */
const P3_PREFS=(()=>{try{return JSON.parse(localStorage.getItem('gs.p3d')||'{}');}catch(e){return {};}})();
const p3={size:P3_PREFS.size||2048,layout:P3_PREFS.layout||'3d',was:null,v3d:null,imported:null,cam:null,started:false,sets:[],cur:0,blank:null};
function p3Save(){try{localStorage.setItem('gs.p3d',JSON.stringify({size:p3.size,layout:p3.layout}));}catch(e){}}
const P3_MAPS=['base','rough','metal','height','normal'];
/* a new texture set: the PBR maps, a base material (a fill layer) and an empty layer to paint on */
function p3Setup(name){doc.maps=P3_MAPS.slice();doc.workflow='metal';doc.name=name||'3D Paint';syncTargets();
  const P=paintLayers()[0];P.name='Paint';
  const B=newLayerObj('Base material');doc.count--;B.fill=fillDefaults();Object.assign(B.fill.maps.base,{on:true,src:'value',c:[.72,.72,.72]});
  Object.assign(B.fill.maps.rough,{on:true,v:.55});Object.assign(B.fill.maps.metal,{on:true,v:0});B.fill.maps.height.on=false;fillRender(B);
  insertNode(B,doc.root,0);selectOnly(P);hist.undo=[];hist.redo=[];doc.p3=true;}
function p3dEnter(){p3.was={on:v3.on,paintOn:v3.paintOn,imported:v3.imported,cam:Object.assign({},v3.cam),tex:v3.tex};if(v3.pop)pop3D(false,true);
  const S=p3.sets[p3.cur];v3.tex=(S&&S.tex)||{};if(S)S.tex=null;v3.mapsDirty=true;
  tabDocEnter('p3d',p3.size,p3.size,S?S.name:'3D Paint');if(!doc.p3)p3Setup(S?S.name:null);
  doc.v3d=p3.v3d||(p3.v3d=Object.assign({},V3D_DEFAULTS,{model:'rcube',detail:2,unlit:false}));doc.workflow='metal';
  v3.imported=p3.imported;v3.mesh=null;if(p3.cam)Object.assign(v3.cam,p3.cam);
  v3.paintOn=true;if(!MESH_TOOLS.includes(ui.tool))setTool('brush');
  $('#docName').textContent=doc.name;v3.on=false;p3ApplyLayout();if(!p3.cam)v3Frame();p3.started=true;buildP3Panel();}
function p3dExit(){p3.cam=Object.assign({},v3.cam);p3.imported=v3.imported;p3.v3d=doc.v3d;const S=p3.sets[p3.cur];if(S)S.tex=v3.tex;v3.tex=(p3.was&&p3.was.tex)||{};v3.mapsDirty=true;tabDocExit('p3d');
  const w=p3.was||{};v3.imported=w.imported||null;v3.mesh=null;if(w.cam)Object.assign(v3.cam,w.cam);v3.paintOn=!!w.paintOn;
  $('#work').classList.remove('v3full');toggle3D(!!w.on);if(v3.on){v3LoadModel(true);build3dPane();}}
/* 3D only (the viewport takes the whole painting area), 3D + the flat texture, or the flat texture only */
function p3ApplyLayout(){const L=p3.layout,work=$('#work');work.classList.toggle('v3full',L==='3d');toggle3D(L!=='2d');if(v3.on&&!v3.mesh)v3LoadModel(true);}
function p3SetLayout(L){p3.layout=L;p3Save();p3ApplyLayout();buildP3Panel();}
function buildP3Panel(){const box=$('#p3dBody');if(!box)return;box.replaceChildren();const s=v3s();
  const models=el('select',{id:'p3Model','aria-label':'Model'},...Object.entries(PRIMS).map(([k,[l]])=>el('option',{value:k,text:l})),
    ...(v3.imported?[el('option',{value:'imported',text:v3.imported.name})]:[]),el('option',{value:'__import',text:'Import a model (OBJ, glTF, GLB, FBX)…'}));
  models.value=s.model;models.onchange=()=>{if(models.value==='__import'){models.value=s.model;importModel().then(()=>{p3.imported=v3.imported;buildP3Panel();});return;}s.model=models.value;v3LoadModel();buildP3Panel();};
  box.append(el('div',{class:'sub',text:'Model'}),models,
    el('div',{class:'sub',text:'Texture sets'}),p3SetsBox(),el('p',{class:'note',text:p3.sets.length>1?'One set of maps per material of the model. Click a set to paint it.':'The model has one material, so one texture set.'}),
    el('div',{class:'sub',text:'Layout'}),seg([['3d','3D'],['split','3D + 2D'],['2d','2D']],p3.layout,p3SetLayout,'Viewport layout'),
    el('div',{class:'sub',text:'Navigation'}),seg([['substance','Substance Painter'],['coat','3D-Coat']],v3nav.mode,v=>{setNav3d(v);buildP3Panel();},'Navigation style'),
    el('p',{class:'note',text:v3nav.mode==='coat'?'Left paints. Right-drag turns, middle-drag moves, Ctrl+right-drag zooms (or the wheel). Left-drag off the model turns too.':'Left paints. Alt+left turns, Alt+middle moves, Alt+right zooms (or the wheel). Middle or right drag also moves.'}),
    el('p',{class:'note',text:'Hold Alt over the model to pick its colour. Left/Right arrow keys step through the shades in the Color panel. Double-click empty space to reframe.'}),
    el('div',{class:'sub',text:'Texture size'}),seg([[1024,'1K'],[2048,'2K'],[4096,'4K']],doc.w,v=>p3Resize(+v),'Texture size'));}
function p3Resize(n){if(n===doc.w&&n===doc.h)return;if(n>MAX_DIM){toast('This computer cannot edit textures that large.');return;}p3.size=n;p3Save();resizeImageDoc(n,n);for(const L of paintLayers())if(L.fill)fillRender(L);buildP3Panel();}

/* ---- texture sets: one per material of the model, each its own canvas of maps (like Substance Painter) ----
   The active set's canvas is the live document; the others are set aside (docState) with the textures they
   last showed on the model, so the whole model draws with every set's own maps. Only the active set takes paint. */
const p3Range=()=>{const m=v3.mesh,r=m&&m.setRanges;const S=p3.sets[p3.cur];return (r&&S&&r.find(x=>x.name===S.name))||{start:0,count:m?m.idx.length/3:0};};
function p3Blank(){if(!p3.blank){const t=makeTarget(4,4,8,true);clearTarget(t,[.72,.72,.72,1]);p3.blank={base:t};}return p3.blank;}
/* what to draw: every set's triangles with that set's textures */
function p3DrawList(){const m=v3.mesh,rs=m&&m.setRanges;if(!rs||rs.length<2)return [{T:v3.tex,start:0,count:m?m.idx.length/3:0}];
  return rs.map(r=>{const i=p3.sets.findIndex(S=>S.name===r.name);const T=i===p3.cur?v3.tex:(i>=0&&p3.sets[i].tex&&p3.sets[i].tex.base?p3.sets[i].tex:p3Blank());return {T,start:r.start,count:r.count};});}
/* a texture of set k (range index k of the model), for picking */
function p3SetTex(k,map){const rs=v3.mesh&&v3.mesh.setRanges,nm=rs&&rs[k]?rs[k].name:null,i=nm?p3.sets.findIndex(S=>S.name===nm):p3.cur;
  const T=i===p3.cur||i<0?v3.tex:p3.sets[i].tex;return T&&T[map];}
/* the model's materials decide the sets; work on a set is kept by name (a set whose material is gone stays, marked, until deleted) */
function p3SyncSets(){const rs=v3.mesh?meshGroupByMat(v3.mesh):[{name:'default'}],names=rs.map(r=>r.name);
  if(!p3.sets.length){p3.sets=names.map(n=>({name:n,state:null,tex:null,missing:false}));p3.cur=0;doc.name=p3.sets[0].name;}
  else{/* a single set from a plain shape carries over to the first material of a model */
    if(p3.sets.length===1&&!names.includes(p3.sets[0].name)&&p3.sets[0].name==='default'){p3.sets[0].name=names[0];doc.name=names[0];}
    for(const n of names)if(!p3.sets.some(S=>S.name===n))p3.sets.push({name:n,state:null,tex:null,missing:false});
    for(const S of p3.sets)S.missing=!names.includes(S.name);
    if(p3.sets[p3.cur].missing){const i=p3.sets.findIndex(S=>!S.missing);if(i>=0)p3SwitchSet(i,true);}}
  $('#docName').textContent=doc.name;}
function p3SwitchSet(i,quiet){if(i===p3.cur||!p3.sets[i])return;if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  if(typeof xf!=='undefined'&&xf)xfCommit();if(typeof gsess!=='undefined'&&gsess)gradCommit();
  const A=p3.sets[p3.cur],B=p3.sets[i];A.state=docState();A.tex=v3.tex;
  if(B.state){setDocState(B.state);B.state=null;}else{blankTabDoc(p3.size,p3.size,B.name);p3Setup(B.name);}
  doc.v3d=p3.v3d;v3.tex=B.tex||{};B.tex=null;p3.cur=i;v3.mapsDirty=true;v3.editDirty=true;v3.dirty=true;
  $('#docName').textContent=doc.name;if(typeof selChanged==='function')selChanged();
  renderLayers();refreshChanUI();refreshMapsUI();buildBrushPanel();changedAll();fit();updateStatus();buildP3Panel();requestRender(true);if(!quiet)toast('Texture set “'+B.name+'”.');}
function p3DeleteSet(i){const S=p3.sets[i];if(!S||i===p3.cur)return;confirmDlg('Delete texture set','Delete the set “'+S.name+'” and everything painted on it? This can’t be undone.','Delete',()=>{
  disposeDocState(S.state);if(S.tex)for(const k in S.tex)disposeTarget(S.tex[k]);const cur=p3.sets[p3.cur];p3.sets.splice(i,1);p3.cur=p3.sets.indexOf(cur);buildP3Panel();});}
function p3SetsBox(){const box=el('div',{class:'p3sets',role:'listbox','aria-label':'Texture sets'});
  p3.sets.forEach((S,i)=>{const on=i===p3.cur;const row=el('div',{class:'p3set'+(on?' on':'')+(S.missing?' missing':''),role:'option','aria-selected':String(on),tabindex:'0',title:S.missing?'This material is not on the current model':'Paint on '+S.name},
      el('span',{class:'p3sn',text:S.name}),S.missing?el('button',{class:'btn sm',text:'×','aria-label':'Delete '+S.name,title:'Delete this set',onclick:ev=>{ev.stopPropagation();p3DeleteSet(i);}}):null);
    row.addEventListener('click',()=>{if(!S.missing)p3SwitchSet(i);});row.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&!S.missing){ev.preventDefault();p3SwitchSet(i);}});box.append(row);});
  return box;}
