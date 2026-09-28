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
function p3dEnter(){p3.was={on:v3.on,paintOn:v3.paintOn,imported:v3.imported,cam:Object.assign({},v3.cam),tex:v3.tex,ws:dk.ws};if(v3.pop)pop3D(false,true);
  /* 3D Paint works in the Texturing workspace (Paint gets its own back when you leave) */
  if(dk.ws!=='texturing'&&typeof setWorkspace==='function')setWorkspace('texturing',true);
  const S=p3.sets[p3.cur];v3.tex=(S&&S.tex)||{};if(S)S.tex=null;v3.mapsDirty=true;
  tabDocEnter('p3d',p3.size,p3.size,S?S.name:'3D Paint');if(!doc.p3)p3Setup(S?S.name:null);
  doc.v3d=p3.v3d||(p3.v3d=Object.assign({},V3D_DEFAULTS,{model:'rcube',detail:2,unlit:false}));doc.workflow='metal';
  v3.imported=p3.imported;v3.mesh=null;if(p3.cam)Object.assign(v3.cam,p3.cam);
  v3.paintOn=true;if(!MESH_TOOLS.includes(ui.tool))setTool('brush');
  $('#docName').textContent=doc.name;v3.on=false;p3ApplyLayout();if(!p3.cam)v3Frame();p3.started=true;buildP3Panel();}
function p3dExit(){p3.cam=Object.assign({},v3.cam);p3.imported=v3.imported;p3.v3d=doc.v3d;const S=p3.sets[p3.cur];if(S)S.tex=v3.tex;v3.tex=(p3.was&&p3.was.tex)||{};v3.mapsDirty=true;tabDocExit('p3d');
  const w=p3.was||{};v3.imported=w.imported||null;v3.mesh=null;if(w.cam)Object.assign(v3.cam,w.cam);v3.paintOn=!!w.paintOn;
  $('#work').classList.remove('v3full');toggle3D(!!w.on);if(v3.on){v3LoadModel(true);build3dPane();}
  if(w.ws&&w.ws!==dk.ws&&typeof setWorkspace==='function')setWorkspace(w.ws,true);}
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
    el('div',{class:'sub',text:'Mesh maps (baked)'}),p3MeshMapsBox(),
    el('div',{class:'sub',text:'Project'}),el('div',{class:'chips'},el('button',{class:'btn sm',text:'Save project',title:'Save the model and all texture sets as a .gouache3d project (Ctrl+S here)',onclick:()=>saveP3Project(false)}),el('button',{class:'btn sm',text:'Open project…',onclick:()=>pickFile('open')}),el('button',{class:'btn sm',text:'Export textures…',onclick:()=>actions.expTex()})),
    el('div',{class:'sub',text:'Select on the model'}),sel3Box(),
    el('div',{class:'sub',text:'Mirror'}),mir3Box(),
    el('div',{class:'sub',text:'Stencil'}),st3Box(),
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
/* deleting a set whose material is still on the model starts that set again, empty */
function p3DeleteSet(i){const S=p3.sets[i];if(!S)return;if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const onModel=!S.missing;confirmDlg('Delete texture set','Delete the set “'+S.name+'” and everything painted on it?'+(onModel?' Its part of the model starts again with a new, empty set.':'')+' This can’t be undone.','Delete',()=>{
  if(i===p3.cur){const j=p3.sets.findIndex((T,k)=>k!==i&&!T.missing);
    if(j<0){/* the only set: start it again */const old=docState();blankTabDoc(p3.size,p3.size,S.name);p3Setup(S.name);disposeDocState(old);for(const k in v3.tex)disposeTarget(v3.tex[k]);v3.tex={};doc.v3d=p3.v3d;
      v3.mapsDirty=true;renderLayers();refreshMapsUI();buildBrushPanel();changedAll();fit();updateStatus();buildP3Panel();requestRender(true);toast('Texture set “'+S.name+'” started again.');return;}
    p3SwitchSet(j,true);}
  disposeDocState(S.state);if(S.tex)for(const k in S.tex)disposeTarget(S.tex[k]);const cur=p3.sets[p3.cur];p3.sets.splice(p3.sets.indexOf(S),1);p3.cur=p3.sets.indexOf(cur);
  if(onModel)p3SyncSets();v3.dirty=true;requestRender(true);buildP3Panel();toast('Deleted the texture set “'+S.name+'”.');});}
function p3SetsBox(){const box=el('div',{class:'p3sets',role:'listbox','aria-label':'Texture sets'});
  p3.sets.forEach((S,i)=>{const on=i===p3.cur;const row=el('div',{class:'p3set'+(on?' on':'')+(S.missing?' missing':''),role:'option','aria-selected':String(on),tabindex:'0',title:S.missing?'This material is not on the current model':'Paint on '+S.name},
      el('span',{class:'p3sn',text:S.name}),el('button',{class:'btn sm p3del',text:'×','aria-label':'Delete '+S.name,title:'Delete this texture set',onclick:ev=>{ev.stopPropagation();p3DeleteSet(i);}}));
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
function sel3Grow(m,t,kind,hitPos,R){const inR=x=>x>=R.start&&x<R.start+R.count,all=[];
  if(kind==='object'){const P=m.triPart;for(let x=R.start;x<R.start+R.count;x++)if(!P||P[x]===P[t])all.push(x);return all;}
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
  const va=gl.createVertexArray();gl.bindVertexArray(va);gl.bindBuffer(gl.ARRAY_BUFFER,g.vb);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,48,24);
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
  el('p',{class:'note',text:sel3.mode==='off'?'Choose what a double-click on the model selects.':'Double-click the model to select. Shift+double-click adds, Ctrl+double-click removes, Ctrl+D deselects. Painting stays inside the selection.'}),
  el('div',{class:'chips'},el('button',{class:'btn sm',text:'Selection to mask',title:'Give the active layer a mask made from the selection',onclick:()=>{if(!sel.active){toast('Select something first.');return;}cmdAddMask(1);}})));}

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
function p3MatBox(){return el('div',{class:'p3mats'},...P3_MATERIALS.map(([n,m])=>{const c=m.base.c,sw=el('span',{class:'p3sw',style:'background:'+toHex(c)+(m.metal.v>.5?';background-image:linear-gradient(135deg,rgba(255,255,255,.45),transparent 55%)':'')});
  return el('button',{class:'p3mat',title:n+': roughness '+Math.round(m.rough.v*100)+'%, metallic '+Math.round(m.metal.v*100)+'%. Adds a fill layer (in the selection, if there is one)',onclick:()=>cmdNewFillLayer({name:n,maps:JSON.parse(JSON.stringify(m))})},sw,el('span',{text:n}));}));}

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
const FS_MASKLUM=`uniform sampler2D uSrc; void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); float g=dot(c.a>1e-6?c.rgb/c.a:vec3(0.0),vec3(0.299,0.587,0.114)); o=vec4(vec3(g),1.0); }`;
let P_MASKLUM=null;
function maskFromMeshMap(L,k){const M=doc.meshMaps&&doc.meshMaps[k];if(!M||!isLayer(L))return;if(!P_MASKLUM)P_MASKLUM=program(FS_MASKLUM);
  if(!L.mask){if(doc.active!==L)selectOnly(L);cmdAddMask(1);}if(!L.mask)return;
  const T=L.mask.target;fullRecord({target:T,lockAlpha:false,maskOf:L,maskObj:L.mask},'Mask from '+(P3_MESHMAP_NAMES[k]||k).toLowerCase(),()=>{const tmp=acquireD(T.depth);copyScaled(M,tmp);run(P_MASKLUM,T,{uSrc:tmp.tex});release(tmp);});
  changed(L);renderLayers();v3.dirty=true;requestRender(true);toast('The mask of “'+L.name+'” is now its '+(P3_MESHMAP_NAMES[k]||k).toLowerCase()+'. Alt+click it to see it on the model.');}
function maskModeExit(){const A=doc.active;if(typeof mk3Reset==='function')mk3Reset();ui.viewMask=false;if(A&&A.mask)A.editMask=false;renderLayers();requestRender(true);v3.dirty=true;}
function maskBarSync(){let bar=document.getElementById('maskBar');const on=!!(ui.viewMask&&doc.active&&doc.active.mask&&ui.mode!=='anim');
  if(!on){if(bar)bar.hidden=true;return;}
  if(!bar){bar=el('div',{id:'maskBar',class:'maskbar',role:'toolbar','aria-label':'Mask'});$('#work').append(bar);}
  const kinds=SEL3_KINDS.filter(k=>k[0]!=='off'),pick=el('select',{id:'maskSel','aria-label':'Double-click the model to fill'},el('option',{value:'off',text:'Double-click: off'}),...kinds.map(([k,l])=>el('option',{value:k,text:'Double-click: '+l})));
  pick.value=sel3.mode;pick.onchange=()=>{sel3.mode=pick.value;if(ui.mode==='p3d')buildP3Panel();};
  const tools=el('div',{class:'seg',role:'group','aria-label':'Mask tools'},...MK_TOOLS.map(([k,l])=>el('button',{class:'segb',id:'mk_'+k,'aria-pressed':String(mk3.tool===k),text:l,
    title:k==='paint'?'Paint the mask (nothing paints until this is on)':'Select with a '+l.toLowerCase()+' (drag inside it to move it)',onclick:()=>maskTool(k)})));
  bar.replaceChildren(el('span',{class:'maskbar-t',text:'Mask of “'+doc.active.name+'”'}),tools,
    el('button',{class:'btn sm',id:'maskWhite',text:'Fill white',title:'Show everything (or the selection)',onclick:()=>maskOp(0,1)}),
    el('button',{class:'btn sm',id:'maskBlack',text:'Fill black',title:'Hide everything (or the selection)',onclick:()=>maskOp(0,0)}),
    el('button',{class:'btn sm',id:'maskInv',text:'Invert',onclick:()=>maskOp(1)}),pick,
    el('span',{class:'maskbar-n',text:typeof mk3Hint==='function'?mk3Hint():''}),
    el('button',{class:'btn sm primary',id:'maskDone',text:'Done',title:'Back to the material (Esc)',onclick:maskModeExit}));
  bar.hidden=false;}
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui.viewMask&&!(typeof mk3!=='undefined'&&mk3.draw)&&modal.hidden&&!isTypingTarget(e.target)&&!(typeof xf!=='undefined'&&xf)&&!selLive){e.preventDefault();e.stopImmediatePropagation();maskModeExit();}},true);

/* ---- Paint › Send to 3D Paint: the painting, flattened (every map it shares with 3D Paint), as a new layer of the
   active texture set, ready to move and scale with Free transform. Nothing stays live: it is plain pixels. */
function sendToP3(){if(ui.mode!=='paint'){toast('Send to 3D Paint works from the Paint tab.');return;}if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const maps=doc.maps.filter(k=>P3_MAPS.includes(k)),R=paintRoot().children,imgs={},name=doc.name||'Painting';
  for(const k of maps){const t=renderNodesMap(R,k),c=makeTarget(doc.w,doc.h,t.depth,false);blit(t,c,0,0,doc.w,doc.h,0,0);release(t);imgs[k]=c;}
  if(!setMode('p3d',true)){for(const k in imgs)disposeTarget(imgs[k]);return;}
  const L=newLayerObj(name+' (from Paint)');doc.count--;
  for(const k in imgs){if(!doc.maps.includes(k)){disposeTarget(imgs[k]);continue;}fitInto(imgs[k],ensureMapTarget(L,k));disposeTarget(imgs[k]);}
  syncTargets();structOp('Send from Paint',()=>{const [p,i]=insertPoint();insertNode(L,p,i);selectOnly(L);});changed(L);renderLayers();
  toast('“'+name+'” is a new layer in “'+doc.name+'”. Press Ctrl+T to move and scale it.');return L;}
/* src into dst keeping its proportions, centred (the rest stays empty) */
function fitInto(src,dst){const k=Math.min(dst.w/src.w,dst.h/src.h),off=[(dst.w-src.w*k)/2,(dst.h-src.h*k)/2];
  run(P.resample,dst,{uSrc:src.tex,uOffset:off,uScale:[1/k,1/k],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(1/k)))},uOutside:[0,0,0,0]});}

/* ---- bakes from the Bake tab: the model, and each material's maps into its own texture set ----
   They become the set's mesh maps (doc.meshMaps, like Substance Painter's: for masks and smart materials) and the
   baked normal becomes a layer in the Normal map so its detail shows; with "also as layers", AO and curvature
   arrive as blendable layers too. by: {material name: {map: target}} ('*' = the same for every set). */
const P3_MESHMAP_NAMES={normal:'Normal',height:'Height',ao:'Ambient occlusion',curv:'Curvature',curvEdge:'Curvature edges',curvCrease:'Curvature creases',thick:'Thickness',wnormal:'World normal',position:'Position',id:'ID'};
function p3ReceiveBake(mesh,by,ks,asLayers){if(ui.mode!=='p3d'&&!setMode('p3d',true))return;
  if(mesh&&mesh!==v3.imported){v3.imported=p3.imported=mesh;v3s().model='imported';v3.mesh=null;v3LoadModel();}
  const back=p3.sets[p3.cur]&&p3.sets[p3.cur].name;let n=0;
  for(let i=0;i<p3.sets.length;i++){const S=p3.sets[i],res=by[S.name]||by['*'];if(!res||S.missing)continue;p3SwitchSet(i,true);p3ApplyBake(res,ks,asLayers);n++;}
  const j=p3.sets.findIndex(S=>S.name===back);if(j>=0)p3SwitchSet(j,true);buildP3Panel();
  toast(n?'Sent the bake to '+n+' texture set'+(n>1?'s':'')+(asLayers?', as mesh maps and layers.':', as mesh maps.'):'No texture set matched the baked materials.');}
function p3ApplyBake(res,ks,asLayers){const M=doc.meshMaps||(doc.meshMaps={});
  for(const k of ks){if(!res[k])continue;let t=M[k];if(!t||t.w!==doc.w||t.h!==doc.h){if(t)disposeTarget(t);t=M[k]=makeTarget(doc.w,doc.h,k==='height'&&canFloat?16:doc.depth,false);}copyScaled(res[k],t);}
  const add=[];
  if(ks.includes('normal')&&M.normal)add.push(p3MeshLayer('normal'));
  if(asLayers)for(const k of ks)if(k!=='normal'&&M[k])add.push(p3MeshLayer(k));
  const old=paintLayers().filter(L=>L.meshMap&&add.some(a=>a.meshMap===L.meshMap));
  structOp('Bake from the Bake tab',()=>{for(const L of old)detachNode(L);for(const L of add)insertNode(L,doc.root,L.meshMap==='normal'?1:doc.root.children.length);});
  syncTargets();changedAll();renderLayers();}
/* a mesh map as a layer: the normal in the Normal map, AO on Multiply, curvature on Overlay, the rest hidden in the base colour */
function p3MeshLayer(k){const M=doc.meshMaps,L=newLayerObj(k==='normal'?'Mesh normal (baked)':'Baked '+(P3_MESHMAP_NAMES[k]||k).toLowerCase());doc.count--;
  const own=k==='normal'?'normal':'base';for(const x of Object.keys(L.maps))if(x!==own){disposeTarget(L.maps[x]);delete L.maps[x];}
  copyScaled(M[k],ensureMapTarget(L,own));if(own!=='base'){L.blankBase=true;setMapModeOf(L,own,0);}
  if(k==='ao')L.mode=MODES.indexOf('Multiply');else if(/^curv/.test(k))L.mode=MODES.indexOf('Overlay');else if(k!=='normal')L.visible=false;
  L.meshMap=k;L.baked=true;return L;}
function p3MeshMapsBox(){const M=doc.meshMaps||{},ks=Object.keys(M);if(!ks.length)return el('p',{class:'note',text:'None yet. Bake in the Bake tab and press Send to 3D Paint: the baked maps land here, per texture set.'});
  return el('div',{class:'p3mm'},...ks.map(k=>el('div',{class:'p3mmrow'},el('span',{text:P3_MESHMAP_NAMES[k]||k}),
    el('button',{class:'btn sm',text:'Add as layer',onclick:()=>{const L=p3MeshLayer(k);structOp('Add mesh map layer',()=>{insertNode(L,doc.root);selectOnly(L);});changed(L);}}))));}
