/* ================= 3D Paint tab =================
   Painting on a model, like Substance Painter. The tab has a canvas of its own (tabdoc.js), separate from
   Paint: the maps of the model's texture set, with the usual layers, fill layers, masks and per-map blending.
   The 3D view is the main viewport; painting is always on (left paints; the navigation keys turn, move and
   zoom); Alt over the model picks its colour. Layouts: 3D only, 3D beside the flat texture, or the flat
   texture only. Colour and Brushes sit in their own column beside the viewport (dock.js, dock2). */
const P3_PREFS=(()=>{try{return JSON.parse(localStorage.getItem('gs.p3d')||'{}');}catch(e){return {};}})();
const p3={size:P3_PREFS.size||2048,layout:P3_PREFS.layout||'3d',was:null,v3d:null,imported:null,cam:null,started:false};
function p3Save(){try{localStorage.setItem('gs.p3d',JSON.stringify({size:p3.size,layout:p3.layout}));}catch(e){}}
const P3_MAPS=['base','rough','metal','height','normal'];
/* a new texture set: the PBR maps, a base material (a fill layer) and an empty layer to paint on */
function p3Setup(){doc.maps=P3_MAPS.slice();doc.workflow='metal';doc.name='3D Paint';syncTargets();
  const P=paintLayers()[0];P.name='Paint';
  const B=newLayerObj('Base material');doc.count--;B.fill=fillDefaults();Object.assign(B.fill.maps.base,{on:true,src:'value',c:[.72,.72,.72]});
  Object.assign(B.fill.maps.rough,{on:true,v:.55});Object.assign(B.fill.maps.metal,{on:true,v:0});B.fill.maps.height.on=false;fillRender(B);
  insertNode(B,doc.root,0);selectOnly(P);hist.undo=[];hist.redo=[];doc.p3=true;}
function p3dEnter(){p3.was={on:v3.on,paintOn:v3.paintOn,imported:v3.imported,cam:Object.assign({},v3.cam)};if(v3.pop)pop3D(false,true);
  tabDocEnter('p3d',p3.size,p3.size,'3D Paint');if(!doc.p3)p3Setup();
  doc.v3d=p3.v3d||(p3.v3d=Object.assign({},V3D_DEFAULTS,{model:'rcube',detail:2,unlit:false}));doc.workflow='metal';
  v3.imported=p3.imported;v3.mesh=null;if(p3.cam)Object.assign(v3.cam,p3.cam);
  v3.paintOn=true;if(!MESH_TOOLS.includes(ui.tool))setTool('brush');
  $('#docName').textContent=doc.name;v3.on=false;p3ApplyLayout();if(!p3.cam)v3Frame();p3.started=true;buildP3Panel();}
function p3dExit(){p3.cam=Object.assign({},v3.cam);p3.imported=v3.imported;p3.v3d=doc.v3d;tabDocExit('p3d');
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
    el('div',{class:'sub',text:'Layout'}),seg([['3d','3D'],['split','3D + 2D'],['2d','2D']],p3.layout,p3SetLayout,'Viewport layout'),
    el('div',{class:'sub',text:'Navigation'}),seg([['substance','Substance Painter'],['coat','3D-Coat']],v3nav.mode,v=>{setNav3d(v);buildP3Panel();},'Navigation style'),
    el('p',{class:'note',text:v3nav.mode==='coat'?'Left paints. Right-drag turns, middle-drag moves, Ctrl+right-drag zooms (or the wheel). Left-drag off the model turns too.':'Left paints. Alt+left turns, Alt+middle moves, Alt+right zooms (or the wheel). Middle or right drag also moves.'}),
    el('p',{class:'note',text:'Hold Alt over the model to pick its colour. Left/Right arrow keys step through the shades in the Color panel. Double-click empty space to reframe.'}),
    el('div',{class:'sub',text:'Texture size'}),seg([[1024,'1K'],[2048,'2K'],[4096,'4K']],doc.w,v=>p3Resize(+v),'Texture size'));}
function p3Resize(n){if(n===doc.w&&n===doc.h)return;if(n>MAX_DIM){toast('This computer cannot edit textures that large.');return;}p3.size=n;p3Save();resizeImageDoc(n,n);for(const L of paintLayers())if(L.fill)fillRender(L);buildP3Panel();}
