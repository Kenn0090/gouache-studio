/* ================= 3D Paint tab =================
   Painting on a model, like Substance Painter. The tab has a canvas of its own (tabdoc.js), separate from
   Paint: the maps of the model's texture set, with the usual layers, fill layers, masks and per-map blending.
   The 3D view is the main viewport; painting is always on (left paints; the navigation keys turn, move and
   zoom); Alt over the model picks its colour. Layouts: 3D only, 3D beside the flat texture, or the flat
   texture only. Colour and Brushes sit in their own column beside the viewport (dock.js, dock2). */
const P3_PREFS=(()=>{try{return JSON.parse(localStorage.getItem('gs.p3d')||'{}');}catch(e){return {};}})();
const p3={size:P3_PREFS.size||2048,layout:P3_PREFS.layout||'split',was:null,v3d:null,imported:null,cam:null,started:false,sets:[],cur:0,blank:null,setup:'pbr',workflow:'metal',udim:false};
function p3Save(){try{localStorage.setItem('gs.p3d',JSON.stringify({size:p3.size,layout:p3.layout}));}catch(e){}}
const P3_MAPS=['base','rough','metal','height','normal'],P3_MAPS_SPEC=['base','spec','gloss','height','normal'];
/* a new texture set: the PBR maps, a base material (a fill layer) and an empty layer to paint on */
function p3Setup(name,startMaterial,workflow){workflow=workflow||p3.workflow||'metal';p3.workflow=workflow;const keys=workflow==='spec'?P3_MAPS_SPEC:P3_MAPS;doc.maps=keys.slice();doc.workflow=workflow;doc.p3Setup=p3.setup||'pbr';doc.name=name||'3D Paint';syncTargets();
  /* the viewer shader follows the template: Spec/Gloss starts with the Spec/Gloss shader, PBR with Standard (the set's shader can still be changed in the Shader panel) */
  doc.v3shade=workflow==='spec'?{kind:'specgloss',p:{}}:{kind:'std',p:{}};
  const P=paintLayers()[0];P.name='Paint';
  const mats={neutral:{c:[.82,.82,.82],rough:.6,metal:0,spec:[.22,.22,.22],gloss:.4},steel:{c:[.48,.5,.53],rough:.28,metal:1,spec:[.72,.72,.72],gloss:.72},polymer:{c:[.12,.22,.3],rough:.38,metal:0,spec:[.22,.22,.22],gloss:.62}},mat=mats[startMaterial]||mats.neutral;
  const B=newLayerObj('Base material',true);doc.count--;B.fill=fillDefaults();Object.assign(B.fill.maps.base,{on:true,src:'value',c:mat.c.slice()});
  if(workflow==='spec'){Object.assign(B.fill.maps.spec,{on:true,src:'value',c:mat.spec.slice()});Object.assign(B.fill.maps.gloss,{on:true,v:mat.gloss});B.fill.maps.rough.on=false;B.fill.maps.metal.on=false;}
  else{Object.assign(B.fill.maps.rough,{on:true,v:mat.rough});Object.assign(B.fill.maps.metal,{on:true,v:mat.metal});B.fill.maps.spec.on=false;B.fill.maps.gloss.on=false;}B.fill.maps.height.on=false;fillRender(B);
  insertNode(B,doc.root,0);selectOnly(P);hist.undo=[];hist.redo=[];doc.p3=true;}
function p3dEnter(){const firstStart=!p3.started;p3.was={on:v3.on,paintOn:v3.paintOn,imported:v3.imported,cam:Object.assign({},v3.cam),tex:v3.tex,ws:dk.ws};if(v3.pop)pop3D(false,true);
  /* its workspace comes with the tab (dkModeWs in dock.js) */
  const S=p3.sets[p3.cur];v3.tex=(S&&S.tex)||{};if(S)S.tex=null;v3.mapsDirty=true;
  tabDocEnter('p3d',p3.size,p3.size,S?S.name:'3D Paint');if(!doc.p3)p3Setup(S?S.name:null,p3.startMaterial);
  doc.v3d=p3.v3d||(p3.v3d=Object.assign({},V3D_DEFAULTS,{model:'matpreview',detail:0,unlit:false,showUV:true,litUV:true,envSun:.55,studioFill:.22,studioRim:.2}));
  v3.imported=p3.imported;if(firstStart&&p3.v3d.model==='imported'&&v3.imported)doc.v3d.model='imported';v3.mesh=null;if(p3.cam)Object.assign(v3.cam,p3.cam);
  v3.paintOn=true;if(!MESH_TOOLS.includes(ui.tool))setTool('brush');
  $('#docName').textContent=doc.name;v3.on=false;p3ApplyLayout();if(!p3.cam)v3Frame();if(firstStart&&v3.on&&doc.v3d.model==='imported'&&v3.imported){if(!v3.mesh||v3.mesh.name!==v3.imported.name)v3LoadModel(true);v3Frame();requestRender(true);}p3.started=true;buildP3Panel();}
function p3dExit(){p3.cam=Object.assign({},v3.cam);p3.imported=v3.imported;p3.v3d=doc.v3d;const S=p3.sets[p3.cur];if(S)S.tex=v3.tex;v3.tex=(p3.was&&p3.was.tex)||{};v3.mapsDirty=true;tabDocExit('p3d');
  const w=p3.was||{};v3.imported=w.imported||null;v3.mesh=null;if(w.cam)Object.assign(v3.cam,w.cam);v3.paintOn=!!w.paintOn;
  $('#work').classList.remove('v3full');toggle3D(!!w.on);if(typeof vpStripSync==='function')vpStripSync(false);if(v3.on){v3LoadModel(true);build3dPane();}}
/* 3D only (the viewport takes the whole painting area), 3D + the flat texture, or the flat texture only */
function p3ApplyLayout(){const L=p3.layout,work=$('#work');work.classList.toggle('v3full',L==='3d');toggle3D(L!=='2d');if(v3.on&&!v3.mesh)v3LoadModel(true);if(typeof vpStripSync==='function')vpStripSync();}
function p3SetLayout(L){p3.layout=L;p3Save();p3ApplyLayout();buildP3Panel();}
function p3BakePanel(){const b=$('#p3bkBody');if(!b)return;b.replaceChildren(
    el('p',{class:'note',text:'Bake ambient occlusion, curvature, normals and more from the model, per texture set. Masks, generators and smart materials use them.'}),el('div',{class:'chips'},el('button',{class:'btn sm',id:'p3BakeBtn',text:'Bake mesh maps…',title:'Bake AO, curvature, normal… for the texture sets, here',onclick:dlgP3Bake}),
      Object.keys(bk.res||{}).length?el('button',{class:'btn sm',text:'Fine-tune in the Bake tab',onclick:()=>setMode('bake')}):null,Object.keys(bk.res||{}).length?el('button',{class:'btn sm',id:'p3BakePaint',text:'Send to the Paint canvas',title:'The bake as layers in the painting, to clean up by hand',onclick:p3BakeToPaint}):null),p3MeshMapsBox());}
function buildP3Panel(){p3BakePanel();if(typeof stBrushRender==='function')stBrushRender();if(typeof renderShading==='function')renderShading();const box=$('#p3dBody');if(!box)return;box.replaceChildren();const s=v3s();
  const models=el('select',{id:'p3Model','aria-label':'Model'},...Object.entries(PRIMS).map(([k,[l]])=>el('option',{value:k,text:l})),
    ...(v3.imported?[el('option',{value:'imported',text:v3.imported.name})]:[]),el('option',{value:'__import',text:'Import a model (OBJ, glTF, GLB, FBX)…'}));
  models.value=s.model;models.onchange=()=>{if(models.value==='__import'){models.value=s.model;importModel().then(()=>{p3.imported=v3.imported;buildP3Panel();});return;}s.model=models.value;v3LoadModel();buildP3Panel();};
  box.append(el('div',{class:'sub',text:'Model'}),models,s.model==='matpreview'?el('button',{class:'btn sm',id:'p3PreviewMaps',text:'Load preview material and mesh maps',onclick:()=>studioPreviewMaps()}):null,
    el('div',{class:'sub',text:'Texture sets'}),p3SetsBox(),el('p',{class:'note',text:p3.udim?'Each material has a paintable texture set for every detected UV tile. A stroke starts on the tile under the cursor.':'One set of maps per material of the model. Click a set to paint it.'}),
    el('div',{class:'sub',text:'Layout'}),seg([['3d','3D'],['split','3D + 2D'],['2d','2D']],p3.layout,p3SetLayout,'Viewport layout'),
    el('div',{class:'sub',text:'Navigation'}),seg([['substance','Substance Painter'],['coat','3D-Coat']],v3nav.mode,v=>{setNav3d(v);buildP3Panel();},'Navigation style'),
    el('div',{class:'sub',text:'Brush alignment'}),seg([['wrap','Surface wrap'],['camera','Camera']],s.paintAlign||'wrap',v=>{s.paintAlign=v;v3.dirty=true;requestRender(true);buildP3Panel();},'3D brush alignment'),el('p',{class:'note',text:(s.paintAlign||'wrap')==='wrap'?'Surface wrap follows the stroke across front-facing surfaces, including those behind a raised edge.':'Camera projects the stroke from the view and only paints the depth-visible surface.'}),
    el('p',{class:'note',text:v3nav.mode==='coat'?'Left paints. Right-drag turns, middle-drag moves, Ctrl+right-drag zooms (or the wheel). Left-drag off the model turns too.':'Left paints. Alt+left turns, Alt+middle moves, Alt+right zooms (or the wheel). Middle or right drag also moves.'}),
    el('p',{class:'note',text:'Shift-click joins the previous brush endpoint. Hold Shift while dragging for a straight line. Hold Alt over the model to pick its colour. Left/Right arrow keys step through the shades in the Color panel. Double-click empty space to reframe.'}),
    el('div',{class:'sub',text:'Project'}),el('div',{class:'chips'},el('button',{class:'btn sm',text:'Save project',title:'Save the model and all texture sets as a .gouache3d project (Ctrl+S here)',onclick:()=>saveP3Project(false)}),el('button',{class:'btn sm',text:'Open project…',onclick:()=>pickFile('open')})),
    el('div',{class:'sub',text:'Select on the model'}),sel3Box(),
    el('div',{class:'sub',text:'Texture size · '+p3Resolution()}),seg([[1024,'1K'],[2048,'2K'],[4096,'4K'],...(doc.w>4096?[[doc.w,Math.round(doc.w/1024)+'K']]:[])],doc.w,v=>p3Resize(+v),'Texture size'));p3ResolutionSync();}
function p3Resize(n){if(n===doc.w&&n===doc.h)return;if(n>MAX_DIM){toast('This computer cannot edit textures that large.');return;}resizeImageDoc(n,n);if(doc.w!==n||doc.h!==n)return;p3.size=n;p3Save();for(const L of paintLayers())if(L.fill)fillRender(L);buildP3Panel();}

/* ---- texture sets: one per material of the model, each its own canvas of maps (like Substance Painter) ----
   The active set's canvas is the live document; the others are set aside (docState) with the textures they
   last showed on the model, so the whole model draws with every set's own maps. Only the active set takes paint. */
const p3Range=()=>{const m=v3.mesh,r=m&&m.setRanges;const S=p3.sets[p3.cur];return (r&&S&&r.find(x=>x.name===p3Binding(S)))||{start:0,count:m?m.idx.length/3:0};};
/* UDIM addressing is based on integer UV tiles: U advances across columns, V across rows.
   Keep the address math separate from rendering so import, paint, and export share one rule. */
function p3UdimAddress(u,v){if(!Number.isFinite(u)||!Number.isFinite(v))return null;const x=Math.floor(u),y=Math.floor(v);
  if(x<0||x>9||y<0||y>99)return null;return {id:1001+x+y*10,u:x,v:y,uv:[u-x,v-y]};}
function p3UdimTiles(mesh,range){if(!mesh||!mesh.uv||!mesh.idx)return [];const start=Math.max(0,range&&range.start||0),end=Math.min(mesh.idx.length/3,start+(range&&range.count||mesh.idx.length/3)),found=new Map();
  for(let t=start;t<end;t++){const a=mesh.idx[t*3],b=mesh.idx[t*3+1],c=mesh.idx[t*3+2],uv=mesh.uv;
    const q=p3UdimAddress((uv[a*2]+uv[b*2]+uv[c*2])/3,(uv[a*2+1]+uv[b*2+1]+uv[c*2+1])/3);if(q&&!found.has(q.id))found.set(q.id,q);}
  return [...found.values()].sort((a,b)=>a.id-b.id);}
function p3Blank(){if(!p3.blank){const t=makeTarget(4,4,8,true);clearTarget(t,[.82,.82,.82,1]);p3.blank={base:t};}return p3.blank;}
/* what to draw: every set's triangles with that set's textures */
function p3DrawList(){const m=v3.mesh,rs=m&&m.setRanges||[{name:p3Binding(p3.sets[0]||{name:'default'}),start:0,count:m?m.idx.length/3:0}];
  const out=[];for(const r of rs){const materialSets=p3.sets.map((S,i)=>({S,i})).filter(x=>p3Binding(x.S)===r.name&&!x.S.hidden);
    for(const {S,i} of materialSets){const T=i===p3.cur?v3.tex:(S.tex&&S.tex.base?S.tex:p3Blank()),D=i===p3.cur?doc:(S.state&&S.state.doc),mm=D&&D.meshMaps;
      out.push({T,start:r.start,count:r.count,sh:D?v3ShadeOf(D):null,thick:mm&&mm.thick||null,udim:p3.udim?S.tile:null});}}
  return out;}
/* a texture of set k (range index k of the model), for picking */
function p3SetTex(k,map){const rs=v3.mesh&&v3.mesh.setRanges,nm=rs&&rs[k]?rs[k].name:null,i=nm?p3.sets.findIndex(S=>p3Binding(S)===nm):p3.cur;
  const T=i===p3.cur||i<0?v3.tex:p3.sets[i].tex;return T&&T[map];}
/* the model's materials decide the sets; work on a set is kept by name (a set whose material is gone stays, marked, until deleted) */
function p3SyncSets(){const rs=v3.mesh?meshGroupByMat(v3.mesh):[{name:'default',start:0,count:v3.mesh?v3.mesh.idx.length/3:0}],names=rs.map(r=>r.name),tilesByName=new Map(rs.map(r=>[r.name,p3UdimTiles(v3.mesh,r)]));
  if(!p3.sets.length){p3.sets=names.flatMap(n=>(p3.udim?(tilesByName.get(n)||[]):[]).map(t=>({name:n+' · '+t.id,material:n,tile:t,state:null,tex:null,missing:false})));if(!p3.sets.length)p3.sets=names.map(n=>({name:n,state:null,tex:null,missing:false}));p3.cur=0;doc.name=p3.sets[0].name;}
  else{/* a single set from a plain shape carries over to the first material of a model */
    if(p3.sets.length===1&&!names.includes(p3Binding(p3.sets[0]))&&p3Binding(p3.sets[0])==='default'){const S=p3.sets[0];S.material=names[0];if(S.name==='default')S.name=names[0];doc.name=S.name;}
    if(p3.udim)for(const S of p3.sets){const ts=tilesByName.get(p3Binding(S))||[];if(!S.tile&&ts.length){S.tile=ts[0];if(S.name===p3Binding(S)||S.name==='default')S.name=p3Binding(S)+' · '+S.tile.id;}}
    for(const n of names){const tiles=p3.udim?(tilesByName.get(n)||[]):[];const wanted=tiles.length?tiles:[null];for(const tile of wanted)if(!p3.sets.some(S=>p3Binding(S)===n&&((S.tile&&tile&&S.tile.id===tile.id)||(!S.tile&&!tile))))p3.sets.push({name:tile?n+' · '+tile.id:n,material:n,tile,state:null,tex:null,missing:false});}
    for(const S of p3.sets)S.missing=!names.includes(p3Binding(S));
    if(p3.sets[p3.cur]?.missing){const i=p3.sets.findIndex(S=>!S.missing);if(i>=0)p3SwitchSet(i,true);}}
  for(const S of p3.sets)S.udimTiles=tilesByName.get(p3Binding(S))||[];
  $('#docName').textContent=doc.name;}
function p3SwitchSet(i,quiet){if(i===p3.cur||!p3.sets[i])return;if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  if(typeof xf!=='undefined'&&xf)xfCommit();if(typeof gsess!=='undefined'&&gsess)gradCommit();
  const A=p3.sets[p3.cur],B=p3.sets[i];A.state=docState();A.tex=v3.tex;
  if(B.state){setDocState(B.state);B.state=null;}else{blankTabDoc(p3.size,p3.size,B.name);p3Setup(B.name);}
  doc.v3d=p3.v3d;v3.tex=B.tex||{};B.tex=null;p3.cur=i;v3.mapsDirty=true;v3.editDirty=true;v3.dirty=true;
  $('#docName').textContent=doc.name;if(typeof selChanged==='function')selChanged();
  renderLayers();refreshChanUI();refreshMapsUI();buildBrushPanel();changedAll();fit();updateStatus();buildP3Panel();requestRender(true);if(!quiet)toast('Texture set “'+B.name+'”.');}
/* deleting a set whose material is still on the model starts that set again, empty */
function p3DeleteSet(i){const S=p3.sets[i];if(!S)return;if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const onModel=!S.missing;confirmDlg('Delete texture set','Delete the set “'+S.name+'” and everything painted on it?'+(onModel?' Its part of the model starts again with a new, empty set.':'')+' This can’t be undone.','Delete',()=>{
  if(i===p3.cur){const j=p3.sets.findIndex((T,k)=>k!==i&&!T.missing);
    if(j<0){/* the only set: start it again */const old=docState();blankTabDoc(p3.size,p3.size,S.name);p3Setup(S.name);disposeDocState(old);for(const k in v3.tex)disposeTarget(v3.tex[k]);v3.tex={};doc.v3d=p3.v3d;
      v3.mapsDirty=true;renderLayers();refreshMapsUI();buildBrushPanel();changedAll();fit();updateStatus();buildP3Panel();requestRender(true);toast('Texture set “'+S.name+'” started again.');return;}
    p3SwitchSet(j,true);}
  disposeDocState(S.state);if(S.tex)for(const k in S.tex)disposeTarget(S.tex[k]);const cur=p3.sets[p3.cur];p3.sets.splice(p3.sets.indexOf(S),1);p3.cur=p3.sets.indexOf(cur);
  if(onModel)p3SyncSets();v3.dirty=true;requestRender(true);buildP3Panel();toast('Deleted the texture set “'+S.name+'”.');});}
/* (0.35, Kenn) an eyeball on each texture set hides the parts of the model that use it; baking follows what is visible */
function p3EyeBtn(S){const b=el('button',{class:'eye p3eye',title:S.hidden?'Show this texture set on the model':'Hide the parts of the model that use this texture set','aria-label':(S.hidden?'Show ':'Hide ')+S.name,'aria-pressed':String(!S.hidden)});
  b.innerHTML=S.hidden?eyeOff:eyeOn;b.addEventListener('click',ev=>{ev.stopPropagation();S.hidden=!S.hidden;v3.dirty=true;requestRender(true);buildP3Panel();});return b;}
function p3SetsBox(){const box=el('div',{class:'p3sets',role:'listbox','aria-label':'Texture sets'});
  p3.sets.forEach((S,i)=>{const on=i===p3.cur,tiles=(S.udimTiles||[]).map(t=>t.id);const row=el('div',{class:'p3set'+(on?' on':'')+(S.missing?' missing':''),role:'option','aria-selected':String(on),tabindex:'0',title:S.missing?'This material is not on the current model':'Paint on '+S.name+(tiles.length?' · UV tiles '+tiles.join(', '):'')},
      p3EyeBtn(S),el('span',{class:'p3sn',text:S.name,ondblclick:ev=>{ev.stopPropagation();p3RenameDialog(i);}}),S.tile?el('span',{class:'p3udims',text:String(S.tile.id),'aria-label':'UDIM '+S.tile.id,title:'UDIM tile '+S.tile.id}):tiles.length?el('span',{class:'p3udims',text:tiles.join(' · '),'aria-label':'UV tiles '+tiles.join(', '),title:'UDIM tiles detected: '+tiles.join(', ')}):null,el('button',{class:'btn sm p3rename',text:'Rename',title:'Name this texture set',onclick:ev=>{ev.stopPropagation();p3RenameDialog(i);}}),el('button',{class:'btn sm p3del',text:'×','aria-label':'Delete '+S.name,title:'Delete this texture set',onclick:ev=>{ev.stopPropagation();p3DeleteSet(i);}}));
    row.addEventListener('click',()=>{if(!S.missing)p3SwitchSet(i);});row.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&!S.missing){ev.preventDefault();p3SwitchSet(i);}});box.append(row);});
  return box;}

/* ---- selecting parts of the model (like Marmoset Toolbag): double-click with a selection kind chosen ----
   Object (a part of the model file), material, UV island, face (a triangle and its quad partner) or a loop of
   quads crossing the edge you click near. Shift adds, Ctrl removes. The result is an ordinary selection in UV
   space: painting keeps inside it on the model and on the flat canvas, and Add mask turns it into a mask. */
const sel3={mode:'off'};
const SEL3_KINDS=[['off','Off'],['object','Object'],['material','Material'],['island','UV island'],['face','Face'],['loop','Loop']];
/* welded vertices (same place; same place and UV) and which triangles meet at each edge, made once per model */
function sel3Topo(m){if(m._topo)return m._topo;const n=m.pos.length/3,P=m.pos,U=m.uv,pid=new Uint32Array(n),uid=new Uint32Array(n),pm=new Map(),um=new Map(),q=v=>Math.round(v*1e5);
  for(let i=0;i<n;i++){const kp=q(P[i*3])+','+q(P[i*3+1])+','+q(P[i*3+2]);let a=pm.get(kp);if(a===undefined){a=pm.size;pm.set(kp,a);}pid[i]=a;
    const ku=kp+'|'+q(U[i*2])+','+q(U[i*2+1]);let b=um.get(ku);if(b===undefined){b=um.size;um.set(ku,b);}uid[i]=b;}
  const T=m.idx.length/3,NP=pm.size+1,NU=um.size+1,ep=new Map(),eu=new Map(),add=(M,k,t)=>{const a=M.get(k);if(a)a.push(t);else M.set(k,[t]);};
  const ek=(a,b,N)=>a<b?a*N+b:b*N+a;
  for(let t=0;t<T;t++)for(let e=0;e<3;e++){const a=m.idx[t*3+e],b=m.idx[t*3+(e+1)%3];add(ep,ek(pid[a],pid[b],NP),t);add(eu,ek(uid[a],uid[b],NU),t);}
  return m._topo={pid,uid,ep,eu,NP,NU,ek};}
function sel3Nrm(m,t){const i=m.idx,P=m.pos,a=i[t*3]*3,b=i[t*3+1]*3,c=i[t*3+2]*3,u=[P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],v=[P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2]];return norm3(cross3(u,v));}
/* the triangle under a hit point: the ray from the eye, nearest crossing (Möller–Trumbore) */
function sel3Tri(m,eye,dir,R){const P=m.pos,I=m.idx;let best=-1,bt=1e30;
  for(let t=R.start;t<R.start+R.count;t++){const a=I[t*3]*3,b=I[t*3+1]*3,c=I[t*3+2]*3;
    const e1x=P[b]-P[a],e1y=P[b+1]-P[a+1],e1z=P[b+2]-P[a+2],e2x=P[c]-P[a],e2y=P[c+1]-P[a+1],e2z=P[c+2]-P[a+2];
    const px=dir[1]*e2z-dir[2]*e2y,py=dir[2]*e2x-dir[0]*e2z,pz=dir[0]*e2y-dir[1]*e2x,det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-12)continue;const inv=1/det;
    const sx=eye[0]-P[a],sy=eye[1]-P[a+1],sz=eye[2]-P[a+2],u=(sx*px+sy*py+sz*pz)*inv;if(u<-1e-6||u>1+1e-6)continue;
    const qx=sy*e1z-sz*e1y,qy=sz*e1x-sx*e1z,qz=sx*e1y-sy*e1x,v=(dir[0]*qx+dir[1]*qy+dir[2]*qz)*inv;if(v<-1e-6||u+v>1+1e-6)continue;
    const d=(e2x*qx+e2y*qy+e2z*qz)*inv;if(d>1e-6&&d<bt){bt=d;best=t;}}
  return best;}
/* the partner triangle that makes a quad with t: across t's longest edge, nearly in the same plane */
function sel3Partner(m,tp,t){const I=m.idx,P=m.pos;let le=-1,ll=-1;for(let e=0;e<3;e++){const a=I[t*3+e]*3,b=I[t*3+(e+1)%3]*3,l=Math.hypot(P[a]-P[b],P[a+1]-P[b+1],P[a+2]-P[b+2]);if(l>ll){ll=l;le=e;}}
  const a=I[t*3+le],b=I[t*3+(le+1)%3],ts=tp.ep.get(tp.ek(tp.pid[a],tp.pid[b],tp.NP))||[],n0=sel3Nrm(m,t);
  for(const o of ts)if(o!==t&&dot3(n0,sel3Nrm(m,o))>.97)return o;return -1;}
/* the quad's outer edges, as welded vertex pairs */
function sel3QuadEdges(m,tp,tris){const es=[],cnt=new Map();for(const t of tris)for(let e=0;e<3;e++){const a=tp.pid[m.idx[t*3+e]],b=tp.pid[m.idx[t*3+(e+1)%3]],k=tp.ek(a,b,tp.NP);cnt.set(k,(cnt.get(k)||0)+1);es.push([a,b,k]);}
  return es.filter(e=>cnt.get(e[2])===1);}
function sel3Loop(m,tp,t0,hitPos,R){const inR=t=>t>=R.start&&t<R.start+R.count,quad=t=>{const o=sel3Partner(m,tp,t);return o>=0&&inR(o)?[t,o]:[t];};
  const wp=new Map();for(let i=0;i<m.pos.length/3;i++)if(!wp.has(tp.pid[i]))wp.set(tp.pid[i],i);const V=p=>{const i=wp.get(p)*3;return [m.pos[i],m.pos[i+1],m.pos[i+2]];};
  const Q0=quad(t0),E=sel3QuadEdges(m,tp,Q0);if(E.length!==4)return Q0;
  const dseg=(p,a,b)=>{const A=V(a),B=V(b),ab=sub3(B,A),t=clamp(dot3(sub3(p,A),ab)/Math.max(1e-12,dot3(ab,ab)),0,1);return Math.hypot(...sub3(p,[A[0]+ab[0]*t,A[1]+ab[1]*t,A[2]+ab[2]*t]));};
  let near=E[0];for(const e of E)if(dseg(hitPos,e[0],e[1])<dseg(hitPos,near[0],near[1]))near=e;
  const opp=(Es,e)=>Es.find(x=>x[0]!==e[0]&&x[0]!==e[1]&&x[1]!==e[0]&&x[1]!==e[1]);
  const out=new Set(Q0),walk=(Q,e)=>{for(let g=0;g<100000;g++){const ts=(tp.ep.get(e[2])||[]).filter(t=>!Q.includes(t)&&inR(t));if(!ts.length)return;const Q2=quad(ts[0]);if(Q2.some(t=>out.has(t)))return;
      const E2=sel3QuadEdges(m,tp,Q2);if(E2.length!==4){Q2.forEach(t=>out.add(t));return;}Q2.forEach(t=>out.add(t));const e2=E2.find(x=>x[2]===e[2]);const o=e2&&opp(E2,e2);if(!o)return;Q=Q2;e=o;}};
  walk(Q0,near);const o=opp(E,near);if(o)walk(Q0,o);return [...out];}
/* separate pieces: triangles that share a welded corner belong to one shell (made once per model) */
function sel3Shells(m){if(m._shell)return m._shell;const tp=sel3Topo(m),T=m.idx.length/3,par=new Int32Array(tp.NP+1).map((_,i)=>i),f=a=>{while(par[a]!==a){par[a]=par[par[a]];a=par[a];}return a;};
  for(let t=0;t<T;t++){const a=f(tp.pid[m.idx[t*3]]);for(let c=1;c<3;c++){const b=f(tp.pid[m.idx[t*3+c]]);if(a!==b)par[b]=a;}}
  const out=new Uint32Array(T);for(let t=0;t<T;t++)out[t]=f(tp.pid[m.idx[t*3]]);return m._shell=out;}
function sel3Grow(m,t,kind,hitPos,R){const inR=x=>x>=R.start&&x<R.start+R.count,all=[];
  if(kind==='object'){const sh=sel3Shells(m);for(let x=R.start;x<R.start+R.count;x++)if(sh[x]===sh[t])all.push(x);return all;}
  if(kind==='material'){for(let x=R.start;x<R.start+R.count;x++)if(!m.triMat||m.triMat[x]===m.triMat[t])all.push(x);return all;}
  const tp=sel3Topo(m);
  if(kind==='island'){const seen=new Uint8Array(m.idx.length/3),st=[t];seen[t]=1;while(st.length){const c=st.pop();all.push(c);
      for(let e=0;e<3;e++){const a=tp.uid[m.idx[c*3+e]],b=tp.uid[m.idx[c*3+(e+1)%3]];for(const o of tp.eu.get(tp.ek(a,b,tp.NU))||[])if(!seen[o]&&inR(o)){seen[o]=1;st.push(o);}}}return all;}
  if(kind==='face'){const o=sel3Partner(m,tp,t);return o>=0&&inR(o)?[t,o]:[t];}
  return sel3Loop(m,tp,t,hitPos,R);}
/* selected triangles drawn white at their UVs (edges too, so seams are covered) into a selection-sized image */
const VS_SEL3=`#version 300 es
layout(location=2) in vec2 aT; uniform vec2 uShift; uniform float uUVs; void main(){ gl_Position=vec4((aT*uUVs-uShift)*2.0-1.0,0.0,1.0); }`;
let P_SEL3=null;
/* into=[target, value]: draw into that image (a mask) in that grey, without clearing it */
function sel3Draw(m,tris,into){if(!P_SEL3)P_SEL3=prog3(VS_SEL3,`uniform float uV; void main(){ o=vec4(vec3(uV),1.0); }`);const g=v3.gpu,t=into?into[0]:acquireS();if(!into)clearTarget(t,[0,0,0,1]);const val=into?into[1]:1;
  const tri=new Uint32Array(tris.length*3),ln=new Uint32Array(tris.length*6);tris.forEach((x,i)=>{for(let c=0;c<3;c++){tri[i*3+c]=m.idx[x*3+c];ln[i*6+c*2]=m.idx[x*3+c];ln[i*6+c*2+1]=m.idx[x*3+(c+1)%3];}});
  const va=gl.createVertexArray();gl.bindVertexArray(va);gl.bindBuffer(gl.ARRAY_BUFFER,g.vb);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,60,24);
  const eb=gl.createBuffer(),lb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,tri,gl.STREAM_DRAW);
  const uvs=v3s().uvs||1;bindTarget(t);gl.disable(gl.BLEND);
  for(let j=0;j<uvs;j++)for(let i=0;i<uvs;i++){useProg(P_SEL3,{uShift:[i,j],uUVs:uvs,uV:val});bindTarget(t);gl.bindVertexArray(va);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.drawElements(gl.TRIANGLES,tri.length,gl.UNSIGNED_INT,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,lb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ln,gl.STREAM_DRAW);gl.drawElements(gl.LINES,ln.length,gl.UNSIGNED_INT,0);}
  gl.bindVertexArray(vao);gl.deleteVertexArray(va);gl.deleteBuffer(eb);gl.deleteBuffer(lb);return t;}
/* double-click on the model (from the 3D view): true when it made a selection */
function p3SelectAt(hit,e){if(sel3.mode==='off'||!v3.mesh||(ui.mode!=='p3d'&&ui.mode!=='paint')||selBusy())return false;const p=v3PickAt(hit,e);if(!p)return false;
  const m=v3.mesh,R=ui.mode==='p3d'?p3Range():{start:0,count:m.idx.length/3},t=sel3Tri(m,p.eye,p.dir,R);
  if(t<0){toast(ui.mode==='p3d'?'That part belongs to another texture set. Switch to its set to select on it.':'Nothing to select there.');return true;}
  /* faces, loops and islands are found on the model as loaded (the view may show it subdivided), then mapped back */
  const O=m.src||m,f=m.subF||1,RO={start:R.start/f,count:R.count/f},hitPos=f>1?p.pos:p.pos;
  const own=sel3Grow(O,Math.floor(t/f),sel3.mode,hitPos,RO),tris=[];for(const x of own)for(let j=0;j<f;j++)tris.push(x*f+j);
  /* in mask view the part goes straight into the mask: white shows, Ctrl+double-click hides (black) */
  if(maskViewTex()){const et=editTarget();if(et&&et.isMask){const v=(e.ctrlKey||e.metaKey)?0:1;fullRecord(et.L,v?'Show part in mask':'Hide part in mask',()=>sel3Draw(m,tris,[et.target,v]));v3.dirty=true;requestRender(true);return true;}}
  const mode=e.shiftKey?'add':(e.ctrlKey||e.metaKey)?'sub':'new',img=sel3Draw(m,tris);
  applyShape(img,mode,fullRect(),'Select '+SEL3_KINDS.find(k=>k[0]===sel3.mode)[1].toLowerCase());release(img);v3.dirty=true;requestRender(true);return true;}
function sel3Box(){const pick=el('select',{id:'sel3Kind','aria-label':'Double-click on the model selects'},...SEL3_KINDS.map(([k,l])=>el('option',{value:k,text:k==='off'?'Off (double-click reframes)':l})));pick.value=sel3.mode;pick.onchange=()=>{sel3.mode=pick.value;if(ui.mode==='p3d')buildP3Panel();};
  return el('div',{class:'dlg-grid'},pick,
  el('p',{class:'note',text:sel3.mode==='off'?'Choose what a double-click on the model selects.':'Double-click the model to select. Shift+double-click adds, Ctrl+double-click removes, Ctrl+D deselects. Painting stays inside the selection.'}));}

/* ---- materials: ready-made fill layers (colour, roughness, metallic), added above the active layer ---- */
const P3_MATERIALS=[
  ['Steel',{base:{c:[.56,.57,.58]},rough:{v:.32},metal:{v:1}}],['Iron (rough)',{base:{c:[.42,.42,.43]},rough:{v:.62},metal:{v:1}}],
  ['Aluminium',{base:{c:[.91,.92,.92]},rough:{v:.25},metal:{v:1}}],['Gold',{base:{c:[1,.78,.34]},rough:{v:.22},metal:{v:1}}],
  ['Copper',{base:{c:[.95,.64,.54]},rough:{v:.28},metal:{v:1}}],['Brass',{base:{c:[.91,.78,.42]},rough:{v:.3},metal:{v:1}}],
  ['Chrome',{base:{c:[.55,.56,.55]},rough:{v:.06},metal:{v:1}}],['Rust',{base:{c:[.45,.2,.1]},rough:{v:.85},metal:{v:0}}],
  ['Glossy plastic',{base:{c:[.8,.15,.12]},rough:{v:.18},metal:{v:0}}],['Matte plastic',{base:{c:[.25,.35,.55]},rough:{v:.6},metal:{v:0}}],
  ['Rubber',{base:{c:[.08,.08,.08]},rough:{v:.9},metal:{v:0}}],['Painted metal',{base:{c:[.2,.45,.3]},rough:{v:.45},metal:{v:0}}],
  ['Wood (varnished)',{base:{c:[.45,.28,.14]},rough:{v:.35},metal:{v:0}}],['Stone',{base:{c:[.5,.48,.44]},rough:{v:.8},metal:{v:0}}],
  ['Fabric',{base:{c:[.55,.5,.42]},rough:{v:.95},metal:{v:0}}],['Dirt',{base:{c:[.3,.24,.17]},rough:{v:.95},metal:{v:0}}]];
function p3MatBox(){const spec=doc.workflow==='spec',items=spec?P3_MATERIALS.map(([n,m])=>[n,{base:m.base,spec:{c:m.metal.v>.5?[.72,.72,.72]:[.22,.22,.22]},gloss:{v:1-m.rough.v}}]):P3_MATERIALS;
  return el('div',{class:'p3mats'},...items.map(([n,m])=>{const c=m.base.c,gloss=spec?m.gloss.v:0,metal=spec?m.spec.c[0]>.5:m.metal.v>.5,sw=el('span',{class:'p3sw',style:'background:'+toHex(c)+(metal?';background-image:linear-gradient(135deg,rgba(255,255,255,.45),transparent 55%)':'')});
  return el('button',{class:'p3mat',title:spec?n+': specular '+Math.round(m.spec.c[0]*100)+'%, glossiness '+Math.round(gloss*100)+'%. Adds a fill layer (in the selection, if there is one)':n+': roughness '+Math.round(m.rough.v*100)+'%, metallic '+Math.round(m.metal.v*100)+'%. Adds a fill layer (in the selection, if there is one)',onclick:()=>cmdNewFillLayer({name:n,maps:JSON.parse(JSON.stringify(m))})},sw,el('span',{text:n}));}));}

/* ---- mask mode (Alt+click a layer's mask, like Substance Painter) ----
   The mask shows on the model in black and white, unlit, and on the flat canvas; a bar offers what you do to
   masks: fill white or black, invert, and the model selections (double-click the model: that part turns white,
   Ctrl+double-click turns it black). Painting paints the mask. Done, Esc or Alt+click again goes back. */
function maskViewTex(){const A=doc.active;if(!ui.viewMask||!A||!A.mask)return null;const v=viewSource();return v&&v.mask?v.t:A.mask.target;}
const FS_MASKOP=`uniform sampler2D uSrc; uniform sampler2D uSel; uniform int uOp; uniform float uV; uniform int uUseSel;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float m=texelFetch(uSrc,p,0).r, k=uUseSel==1?texelFetch(uSel,p,0).r:1.0; float n=uOp==1?1.0-m:uV; o=vec4(vec3(mix(m,n,k)),1.0); }`;
let P_MASKOP=null;
function maskOp(op,v){const et=editTarget();if(!et||!et.isMask){toast('Select a mask first (click its thumbnail).');return;}if(!P_MASKOP)P_MASKOP=program(FS_MASKOP);
  const T=et.target,useSel=sel.active&&!sel.quick;
  fullRecord(et.L,op===1?'Invert mask':v?'Fill mask white':'Fill mask black',()=>{const tmp=acquireD(T.depth);blit(T,tmp,0,0,doc.w,doc.h,0,0);run(P_MASKOP,T,{uSrc:tmp.tex,uSel:useSel?sel.t.tex:dummy,uOp:{int:op},uV:v||0,uUseSel:{int:useSel?1:0}});release(tmp);});
  v3.dirty=true;requestRender(true);}
/* right-click › Mask from mesh map: a baked grey map (AO, curvature, thickness, height) becomes the layer's mask */
const MASK_MESH_OK=['ao','curv','curvEdge','curvCrease','thick','height'];
const maskMeshKeys=()=>Object.keys(doc.meshMaps||{}).filter(k=>MASK_MESH_OK.includes(k));
function maskFromMeshMap(L,k){if(!(doc.meshMaps&&doc.meshMaps[k])||!isLayer(L))return;if(doc.active!==L)selectOnly(L);
  /* a live row of the mask: it follows the mesh map, and more rows can go on top */
  msAdd(L,'mesh',{p:{k,inv:false}},'Mask from '+(P3_MESHMAP_NAMES[k]||k).toLowerCase());v3.dirty=true;requestRender(true);
  toast('The mask of “'+L.name+'” is now its '+(P3_MESHMAP_NAMES[k]||k).toLowerCase()+'. Alt+click it to see it on the model.');}
function maskModeExit(){const A=doc.active;if(typeof mk3Reset==='function')mk3Reset();ui.viewMask=false;if(A&&A.mask)A.editMask=false;renderLayers();requestRender(true);v3.dirty=true;}
function maskBarSync(){let bar=document.getElementById('maskBar');
  if(typeof lm!=='undefined'&&lm.on&&doc.active!==lm.L)liveMaskEnd();
  const live=typeof liveOn==='function'&&liveOn(),on=live||!!(ui.viewMask&&doc.active&&doc.active.mask&&ui.mode!=='anim');
  /* entering and leaving the mask view: selections and the Box/Lasso tool used for the mask don't stay behind */
  if(on&&!live&&!mk3.was){mk3.was={tool:ui.tool,sel:sel.active,used:false};}
  else if(!on&&mk3.was){const w=mk3.was;mk3.was=null;if(mk3.tool)mk3Reset();
    if(sel.active&&(w.used||!w.sel))deselect();drawSelOverlay();
    if((ui.tool==='marquee'||ui.tool==='lasso')&&w.tool!==ui.tool)setTool(w.tool||'brush');}
  if(!on){if(bar)bar.hidden=true;return;}
  if(!bar){bar=el('div',{id:'maskBar',class:'maskbar',role:'toolbar','aria-label':'Mask'});$('#work').append(bar);}
  bar.classList.toggle('live',live);
  if(live){const tools=el('div',{class:'seg',role:'group','aria-label':'Live mask tools'},...MK_TOOLS.filter(t=>t[0]!=='paint').map(([k,l])=>el('button',{class:'segb',id:'mk_'+k,'aria-pressed':String(mk3.tool===k),text:l,onclick:()=>maskTool(k)})));
    bar.replaceChildren(el('span',{class:'maskbar-t',text:'Live mask on “'+lm.L.name+'”'}),tools,
      el('span',{class:'maskbar-n',text:mk3.tool?mk3Hint():'Painting and fills stay inside the live mask.'}),
      el('button',{class:'btn sm',id:'lmClear',text:'Clear',onclick:()=>{for(const r of lm.M.mask.stack.slice())liveRemove(r.id);}}),
      el('button',{class:'btn sm primary',id:'lmKeep',text:'Keep…',onclick:liveMaskKeep}),
      el('button',{class:'btn sm',id:'lmClose',text:'Close',title:'Stop the live mask (nothing is kept)',onclick:()=>liveMaskEnd()}),liveBarRow());
    if(mk3.tool==='id')bar.append(idSelRow());bar.hidden=false;return;}
  const kinds=SEL3_KINDS.filter(k=>k[0]!=='off'),pick=el('select',{id:'maskSel','aria-label':'Double-click the model to fill'},el('option',{value:'off',text:'Double-click: off'}),...kinds.map(([k,l])=>el('option',{value:k,text:'Double-click: '+l})));
  pick.value=sel3.mode;pick.onchange=()=>{sel3.mode=pick.value;if(ui.mode==='p3d')buildP3Panel();};
  const tools=el('div',{class:'seg',role:'group','aria-label':'Mask tools'},...MK_TOOLS.map(([k,l])=>el('button',{class:'segb',id:'mk_'+k,'aria-pressed':String(mk3.tool===k),text:l,
    title:k==='paint'?'Paint the mask (nothing paints until this is on)':k==='id'?'Pick colours of the baked ID map: they turn white in the mask':'Select with a '+l.toLowerCase()+' (drag inside it to move it)',onclick:()=>maskTool(k)})));
  bar.replaceChildren(el('span',{class:'maskbar-t',text:'Mask of “'+doc.active.name+'”'}),tools,
    el('button',{class:'btn sm',id:'maskWhite',text:'Fill white',title:'Show everything (or the selection)',onclick:()=>maskOp(0,1)}),
    el('button',{class:'btn sm',id:'maskBlack',text:'Fill black',title:'Hide everything (or the selection)',onclick:()=>maskOp(0,0)}),
    el('button',{class:'btn sm',id:'maskInv',text:'Invert',onclick:()=>maskOp(1)}),pick,
    el('span',{class:'maskbar-n',text:typeof mk3Hint==='function'?mk3Hint():''}),
    el('button',{class:'btn sm primary',id:'maskDone',text:'Done',title:'Back to the material (Esc)',onclick:maskModeExit}));
  if(typeof mk3!=='undefined'&&mk3.tool==='id')bar.append(idSelRow());
  bar.hidden=false;}
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui.viewMask&&!(typeof mk3!=='undefined'&&mk3.draw)&&modal.hidden&&!isTypingTarget(e.target)&&!(typeof xf!=='undefined'&&xf)&&!selLive){e.preventDefault();e.stopImmediatePropagation();maskModeExit();}},true);

/* ---- Paint › Send to 3D Paint: the painting, flattened (every map it shares with 3D Paint), as a new layer of the
   active texture set, ready to move and scale with Free transform. Nothing stays live: it is plain pixels. */
/* only: one layer or group (right-click › Send layer to 3D Paint), flattened with its effects; else the whole painting */
function sendToP3(only){if(ui.mode!=='paint'){toast('Send to 3D Paint works from the Paint tab.');return;}if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const maps=doc.maps.filter(k=>P3_MAPS.includes(k)),R=only?[only]:paintRoot().children,imgs={},name=only?only.name:(doc.name||'Painting');
  const vis=only?only.visible:true;if(only)only.visible=true;/* a hidden layer is sent as it would show */
  for(const k of maps){const t=renderNodesMap(R,k),c=makeTarget(doc.w,doc.h,t.depth,false);blit(t,c,0,0,doc.w,doc.h,0,0);release(t);imgs[k]=c;}
  if(only)only.visible=vis;
  /* every map keeps only what shows in the base colour (a sticker has one outline) */
  if(imgs.base)for(const k in imgs)if(k!=='base'){const t=acquireD(imgs[k].depth);run(p3StickerProg(),t,{uSrc:imgs[k].tex,uM:imgs.base.tex});blit(t,imgs[k],0,0,t.w,t.h,0,0);release(t);}
  const aspect=doc.h/doc.w,assets=doc.projectAssets||[];
  if(!setMode('p3d',true)){for(const k in imgs)disposeTarget(imgs[k]);return;}
  for(const a of assets)paRemember(a.kind,a.rec,doc,true);
  /* (0.27, Kenn) a live sticker: a material whose pictures are projected onto the model from where you are looking,
     see-through where the painting is, with the move/turn/scale gizmo; right-click › Convert to pixels fixes it */
  const chans={};for(const k in imgs)if(doc.maps.includes(k)&&!FILL_SKIP.includes(k))chans[k]={on:true,src:'image',name:name,tile:1,rot:0};
  const L=cmdNewFillLayer({name:name+' (from Paint)',maps:chans,proj:'planar',rep:false,front:true,decal:true,xf:p3StickerXf(aspect),imgs});
  for(const k in imgs)disposeTarget(imgs[k]);
  if(L){L.fill.decal=true;fillRender(L);renderLayers();if(typeof showPanel==='function')showPanel('matEd');if(typeof renderMatEd==='function')renderMatEd(true);}
  toast('“'+name+'” is on the model as a sticker, projected from this view. Drag the arrows, rings and boxes to move, turn and scale it; right-click › Convert to pixels fixes it.');return L;}
const FS_STICKER=`uniform sampler2D uSrc; uniform sampler2D uM; void main(){ ivec2 p=ivec2(gl_FragCoord.xy); o=texelFetch(uSrc,p,0)*texelFetch(uM,p,0).a; }`;
let P_STICKER=null;const p3StickerProg=()=>P_STICKER||(P_STICKER=program(FS_STICKER));
/* a planar projection facing the camera, centred where it looks, half the model's size, the painting's proportions */
function p3StickerXf(aspect){const c=v3.cam,eye=v3Eye(),tg=[c.tx,c.ty,c.tz],f=norm3(sub3(tg,eye));let r=cross3(f,[0,1,0]);if(Math.hypot(...r)<1e-4)r=[1,0,0];r=norm3(r);const u=cross3(r,f),bk=[-f[0],-f[1],-f[2]];
  const R=[[r[0],u[0],bk[0]],[r[1],u[1],bk[1]],[r[2],u[2],bk[2]]].map(row=>row.map((v,j)=>j===1?v:-v)),{c:mc}=pxfModel();
  return {t:[tg[0]-mc[0],tg[1]-mc[1],tg[2]-mc[2]],r:pxfEuler(R),s:aspect>1?[.5/aspect,.5,1]:[.5,.5*aspect,1]};}
/* src into dst keeping its proportions, centred (the rest stays empty) */
function fitInto(src,dst){const k=Math.min(dst.w/src.w,dst.h/src.h),off=[(dst.w-src.w*k)/2,(dst.h-src.h*k)/2];
  run(P.resample,dst,{uSrc:src.tex,uOffset:off,uScale:[1/k,1/k],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(1/k)))},uOutside:[0,0,0,0]});}

/* ---- bakes from the Bake tab: the model, and each material's maps into its own texture set ----
   They become the set's mesh maps (doc.meshMaps, like Substance Painter's: for masks and smart materials) and the
   baked normal becomes a layer in the Normal map so its detail shows; with "also as layers", AO and curvature
   arrive as blendable layers too. by: {material name: {map: target}} ('*' = the same for every set). */
const P3_MESHMAP_NAMES={normal:'Normal',height:'Height',ao:'Ambient occlusion',curv:'Curvature',curvEdge:'Curvature edges',curvCrease:'Curvature creases',thick:'Thickness',wnormal:'World normal',position:'Position',id:'ID',rough:'Roughness',metal:'Metallic'};
/* C / Shift+C in 3D Paint (Kenn, 0.28): step through the set's baked mesh maps on the model, unlit, like the Bake tab */
const p3mm={k:null};
const p3mmKeys=()=>Object.keys(doc.meshMaps||{}).filter(k=>doc.meshMaps[k]&&!k.startsWith('cv:'));
function p3MeshShowTex(){if(libIdView&&ui.mode==='p3d'&&doc.meshMaps&&doc.meshMaps.id)return doc.meshMaps.id;if(ui.mode!=='p3d'||!p3mm.k)return null;const t=doc.meshMaps&&doc.meshMaps[p3mm.k];if(!t){p3mm.k=null;p3mmBadge();return null;}return t;}
function p3mmBadge(){let b=document.getElementById('p3mmBadge');const on=ui.mode==='p3d'&&!!p3mm.k;
  if(!on){if(b)b.hidden=true;return;}
  if(!b){b=el('button',{id:'p3mmBadge',class:'p3mmbadge',title:'Back to the material (Esc)',onclick:()=>p3mmSet(null)});$('#work').append(b);}
  b.textContent='Mesh map: '+(P3_MESHMAP_NAMES[p3mm.k]||p3mm.k)+'  ·  C next, Esc back';b.hidden=false;}
function p3mmSet(k){p3mm.k=k;p3mmBadge();v3.dirty=true;requestRender(true);}
function p3mmCycle(dir){const K=p3mmKeys();if(!K.length){toast('No mesh maps yet: bake them (Bake mesh maps…) or send bakes from the Bake tab. Then C steps through them.');return;}
  const L=[null,...K],i=Math.max(0,L.indexOf(p3mm.k)),k=L[(i+dir+L.length)%L.length];p3mmSet(k);
  toast('Showing: '+(k?P3_MESHMAP_NAMES[k]||k:'the material'));}
function p3ShowLit(){closeMenu();ui.viewMask=false;libIdShow(false);p3mmSet(null);v3s().unlit=false;v3.rt=false;setView('material');build3dPane();v3.mapsDirty=true;v3.dirty=true;requestRender(true);}
window.addEventListener('keydown',e=>{if(typeof pathKeys==='function'&&pathKeys(e))return;if(ui.mode!=='p3d'||!modal.hidden||isTypingTarget(e.target)||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('#menuPop.tool-menu:not([hidden])'))return;
  if((e.key==='m'||e.key==='M')&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)p3ShowLit();}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat){closeMenu();cmdDelete();}}
  else if(e.key==='c'||e.key==='C'){e.preventDefault();e.stopImmediatePropagation();p3mmCycle(e.shiftKey?-1:1);}
  else if(e.key==='Escape'&&p3mm.k&&!ui.viewMask){e.preventDefault();e.stopImmediatePropagation();p3mmSet(null);}},true);
function p3ReceiveBake(mesh,by,ks,asLayers){if(ui.mode!=='p3d'&&!setMode('p3d',true))return;
  if(mesh&&mesh!==v3.imported){v3.imported=p3.imported=mesh;v3s().model='imported';v3.mesh=null;v3LoadModel();}
  const back=p3.sets[p3.cur]&&p3.sets[p3.cur].name;let n=0;
  for(let i=0;i<p3.sets.length;i++){const S=p3.sets[i],binding=p3Binding(S),res=(S.tile&&by[binding+'@'+S.tile.id])||by[binding]||by['*'];if(!res||S.missing)continue;p3SwitchSet(i,true);p3ApplyBake(res,ks,asLayers);n++;}
  const j=p3.sets.findIndex(S=>S.name===back);if(j>=0)p3SwitchSet(j,true);buildP3Panel();
  toast(n?'Sent the bake to '+n+' texture set'+(n>1?'s':'')+(asLayers?', as mesh maps and layers.':', as mesh maps.'):'No texture set matched the baked materials.');}
function p3ApplyBake(res,ks,asLayers){const M=doc.meshMaps||(doc.meshMaps={});
  for(const k of ks){if(!res[k])continue;let t=M[k];if(!t||t.w!==doc.w||t.h!==doc.h){if(t)disposeTarget(t);t=M[k]=makeTarget(doc.w,doc.h,k==='height'&&canFloat?16:doc.depth,false);}copyScaled(res[k],t);}
  /* (0.27, Kenn: sent bakes shouldn't be added to the layer stack) they are the set's mesh maps; the baked normal
     shades the model from there (meshNormalBase). Layers only when asked for; an old "Mesh normal (baked)" layer goes. */
  const add=[];
  if(asLayers)for(const k of ks)if(k!=='normal'&&M[k])add.push(p3MeshLayer(k));
  const old=paintLayers().filter(L=>L.meshMap&&(add.some(a=>a.meshMap===L.meshMap)||(L.meshMap==='normal'&&ks.includes('normal'))));
  if(old.length||add.length)structOp('Bake from the Bake tab',()=>{for(const L of old)detachNode(L);for(const L of add)insertNode(L,doc.root,L.meshMap==='normal'?1:doc.root.children.length);});
  syncTargets();p3MeshMapsChanged();renderLayers();}
/* a mesh map as a layer: the normal in the Normal map, AO on Multiply, curvature on Overlay, the rest hidden in the base colour */
function p3MeshLayer(k){const M=doc.meshMaps,L=newLayerObj(k==='normal'?'Mesh normal (baked)':'Baked '+(P3_MESHMAP_NAMES[k]||k).toLowerCase());doc.count--;
  const own=k==='normal'?'normal':'base';for(const x of Object.keys(L.maps))if(x!==own){disposeTarget(L.maps[x]);delete L.maps[x];}
  copyScaled(M[k],ensureMapTarget(L,own));if(own!=='base'){L.blankBase=true;setMapModeOf(L,own,0);}
  if(k==='ao')L.mode=MODES.indexOf('Multiply');else if(/^curv/.test(k))L.mode=MODES.indexOf('Overlay');else if(k!=='normal')L.visible=false;
  L.meshMap=k;L.baked=true;return L;}
function p3MeshMapsBox(){const M=doc.meshMaps||{},ks=Object.keys(M);if(!ks.length)return el('p',{class:'note',text:'None yet. Press Bake mesh maps (or bake in the Bake tab and press Send to 3D Paint): the baked maps land here, per texture set.'});
  return el('div',{class:'p3mm'},...ks.map(k=>el('div',{class:'p3mmrow'},el('span',{text:msMeshName(k)}),
    el('button',{class:'btn sm',text:'Edit in 2D',onclick:()=>p3MapEdit(k)}),
    el('button',{class:'btn sm',text:'Add as layer',onclick:()=>{const L=p3MeshLayer(k);structOp('Add mesh map layer',()=>{insertNode(L,doc.root);selectOnly(L);});changed(L);}}))));}
/* ---- a 3D Paint layer to the Paint canvas and back (0.25) ----
   Right-click a layer in 3D Paint › Edit in the Paint canvas: its content (every map, without its mask, opacity
   or blend mode) becomes a linked layer in the painting. Edit it there with every Paint tool, then right-click ›
   Send back to 3D Paint: it replaces the original layer's content (it becomes a plain paint layer), keeping its
   name, mask, opacity and blend mode, as one undo step. */
function flatNodeMaps(n,maps){const s={v:n.visible,o:n.opacity,m:n.mode,me:n.mask?n.mask.enabled:null};n.visible=true;n.opacity=1;if(n.type!=='group')n.mode=0;if(n.mask)n.mask.enabled=false;
  const out={};try{for(const k of maps){const t=renderNodesMap([n],k),c=makeTarget(doc.w,doc.h,t.depth,false);blit(t,c,0,0,doc.w,doc.h,0,0);release(t);out[k]=c;}}
  finally{n.visible=s.v;n.opacity=s.o;n.mode=s.m;if(n.mask)n.mask.enabled=s.me;}return out;}
function p3LayerToPaint(n){if(ui.mode!=='p3d'||!n)return;if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const set=p3.sets[p3.cur].name,tok=n.p3tok||(n.p3tok='l'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),maps=doc.maps.slice(),imgs=flatNodeMaps(n,maps),name=n.name;
  if(!setMode('paint',true)){for(const k in imgs)disposeTarget(imgs[k]);return;}
  const need=maps.filter(k=>!doc.maps.includes(k)&&MAP_DEFS[k]);if(need.length)setDocMaps([...doc.maps,...need],'Add maps from 3D Paint');
  const L=newLayerObj(name+' (from 3D Paint)');doc.count--;for(const x of Object.keys(L.maps))if(!imgs[x]){disposeTarget(L.maps[x]);delete L.maps[x];}
  for(const k in imgs){if(doc.maps.includes(k))copyScaled(imgs[k],ensureMapTarget(L,k));disposeTarget(imgs[k]);}
  L.p3link={set,tok,name};syncTargets();structOp('From 3D Paint',()=>{const [p,i]=insertPoint();insertNode(L,p,i);selectOnly(L);});changed(L);renderLayers();
  toast('“'+name+'” is in the Paint canvas. Edit it, then right-click it › Send back to 3D Paint.');return L;}
function paintLayerBackToP3(n){const ln=n&&n.p3link;if(!ln)return;if(ui.mode!=='paint'){toast('Send back works from the Paint tab.');return;}if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const maps=doc.maps.slice(),imgs=flatNodeMaps(n,maps);
  if(!setMode('p3d',true)){for(const k in imgs)disposeTarget(imgs[k]);return;}
  const done=()=>{for(const k in imgs)disposeTarget(imgs[k]);};
  const si=p3.sets.findIndex(S=>S.name===ln.set);if(si<0){done();toast('The texture set “'+ln.set+'” is gone.');return;}if(si!==p3.cur)p3SwitchSet(si,true);
  const O=allNodes().find(x=>x.p3tok===ln.tok);if(!O||O.type==='group'){done();toast('The layer “'+ln.name+'” is no longer in 3D Paint.');return;}
  const L=newLayerObj(O.name);doc.count--;for(const x of Object.keys(L.maps))if(!imgs[x]){disposeTarget(L.maps[x]);delete L.maps[x];}
  for(const k in imgs)if(doc.maps.includes(k))copyScaled(imgs[k],ensureMapTarget(L,k));done();
  Object.assign(L,{opacity:O.opacity,mode:O.mode,visible:O.visible,clip:O.clip,p3tok:O.p3tok});if(O.mask)L.mask=cloneMask(O.mask);/* (its effects and styles are now part of the pixels) */
  syncTargets();structOp('Back from Paint',()=>{const P=O.parent,i=P.children.indexOf(O);detachNode(O);insertNode(L,P,i);selectOnly(L);});changed(L);renderLayers();buildP3Panel();
  toast('“'+L.name+'” in 3D Paint now has your edits from the Paint canvas.');return L;}
{const sm=setMode;setMode=function(m,q){const r=sm(m,q);p3mmBadge();if(typeof stBrushRender==='function')stBrushRender();if(typeof renderDecals==="function")renderDecals();if(typeof renderEnvs==="function")renderEnvs();return r;};}

/* Display names never change the mesh's material binding. */
const p3Binding=S=>S.material||S.name;
function p3RenameSet(i,name){const S=p3.sets[i];name=String(name||'').trim();if(!S||!name||p3.sets.some((T,j)=>j!==i&&T.name.toLowerCase()===name.toLowerCase()))return false;if(stroke||preview||selLive)return false;
 const old=S.name;if(old===name)return true;S.material=p3Binding(S);S.name=name;p3.metadataVer=(p3.metadataVer||0)+1;if(i===p3.cur)doc.name=name;else if(S.state)S.state.doc.name=name;
 withPaintDoc(()=>{for(const n of allNodes())if(n.p3link?.set===old)n.p3link.set=name;});updateStatus();buildP3Panel();v3.dirty=true;requestRender();return true;}
function p3RenameDialog(i){const S=p3.sets[i];if(!S)return;const input=el('input',{id:'p3SetName',value:S.name,type:'text','aria-label':'Texture set name'});openDialog({title:'Name texture set',body:el('div',{class:'dlg-grid'},input,el('p',{class:'note',text:'This name is used in the project and exported textures. Each texture set needs a different name.'})),okLabel:'Rename',onOk(){if(!p3RenameSet(i,input.value))toast('Use a non-empty, unique texture set name and finish the current edit first.');}});input.focus();input.select();}

