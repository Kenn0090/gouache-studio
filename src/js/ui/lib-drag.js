/* ================= Drag from the Materials tab onto the layer stack (0.27) =================
   Kenn: "I should be able to drag things to the layer stack in 3D Paint, such as materials, smart materials,
   smart masks". A material or smart material dropped between layers becomes a new layer (or folder) right there;
   a smart mask dropped onto a layer becomes that layer's mask. Clicking a tile still adds it as before. */
const libDrag={d:null};
const libGhost=el('div',{class:'libghost',hidden:true});document.body.append(libGhost);
document.addEventListener('pointerdown',e=>{if(e.button!==0)return;const t=e.target.closest&&e.target.closest('.mattile');if(!t||!t._libDrag)return;
  libDrag.d={kind:t._libDrag[0],rec:t._libDrag[1],x:e.clientX,y:e.clientY,id:e.pointerId,moving:false,tile:t};},true);
/* (0.37.2, Kenn) Ctrl + drag over the model shows the ID map so you can see which colour the material lands on */
let libIdView=false;
function libIdShow(on){on=!!on&&ui.mode==='p3d'&&!!(doc.meshMaps&&doc.meshMaps.id);if(on===libIdView)return;libIdView=on;if(typeof v3!=='undefined'){v3.dirty=true;requestRender(true);}}
function libClear(){const pn=document.getElementById('pane3d');if(pn)pn.classList.remove('libover');document.querySelectorAll('.lrow.drop-into,.lrow.drop-mask,.meshslot.dropon').forEach(r=>r.classList.remove('drop-into','drop-mask','dropon'));dropLine.hidden=true;}
/* where a drop at (x, y) goes: {mask: layer} for smart masks, {at: {parent, index}} for the rest */
function libTarget(x,y,D){D=D||libDrag.d;
  if(D.kind==='meshmap'){const row=document.elementFromPoint(x,y)?.closest('[data-mesh-slot]');return row?{meshSlot:row.dataset.meshSlot,row}:null;}
  /* (0.37.1, Kenn) dropped on the model: a new layer with the material; with Ctrl, only where the ID colour under the pointer is */
  if(ui.mode==='p3d'&&(D.kind==='mat'||D.kind==='smart')){const u=document.elementFromPoint(x,y);if(u&&u.id==='v3Hit')return {mesh:true,x,y,ctrl:!!D.ctrl};}
  const list=$('#layerList'),lb=list&&list.getBoundingClientRect();if(!lb||x<lb.left||x>lb.right||y<lb.top-8||y>lb.bottom+8)return null;
  if(D.kind==='smask'||D.kind==='tex'||D.kind==='project'&&D.rec.kind==='tex'){const under=document.elementFromPoint(x,y),row=under&&under.closest('.lrow');const n=row&&row._node;
    /* a texture on the middle of a layer goes into its mask; near a row's edge it becomes a layer there */
    if(D.kind==='smask'||(n&&!n.fx&&y>row.getBoundingClientRect().top+row.offsetHeight*.3&&y<row.getBoundingClientRect().bottom-row.offsetHeight*.3))return n&&!n.fx?{mask:n,row}:null;}
  const t=dropTargetAt(y),d=resolveDrop(t);if(!d)return {at:{parent:doc.root,index:doc.root.children.length},t:null,d:null};
  const index=d.top?d.parent.children.length:d.parent.children.indexOf(d.ref)+(d.where==='above'?1:0);return {at:{parent:d.parent,index},t,d};}
window.addEventListener('pointermove',e=>{const D=libDrag.d;if(!D||e.pointerId!==D.id)return;
  if(!D.moving){if(Math.hypot(e.clientX-D.x,e.clientY-D.y)<6)return;D.moving=true;libGhost.textContent=D.rec.name;libGhost.hidden=false;document.body.classList.add('libdragging');}
  libGhost.style.left=(e.clientX+12)+'px';libGhost.style.top=(e.clientY+10)+'px';libClear();D.ctrl=e.ctrlKey||e.metaKey;
  /* near the list's top or bottom edge: it scrolls */
  {const L=$('#layerList'),b=L&&L.getBoundingClientRect();if(b&&e.clientX>=b.left&&e.clientX<=b.right){if(e.clientY<b.top+24&&e.clientY>b.top-30)L.scrollTop-=14;else if(e.clientY>b.bottom-24&&e.clientY<b.bottom+30)L.scrollTop+=14;}}
  const T=libTarget(e.clientX,e.clientY);D.target=T;libIdShow(!!(T&&T.mesh&&D.ctrl));if(!T)return;
  if(T.meshSlot){T.row.classList.add('dropon');return;}
  if(T.mesh){const pn=document.getElementById('pane3d');if(pn)pn.classList.add('libover');return;}
  if(T.mask){T.row.classList.add('drop-mask');return;}
  if(T.t){if(T.d.top&&T.t.where==='into'){T.t.row.classList.add('drop-into');return;}
    const list=$('#layerList'),lb=list.getBoundingClientRect(),rb=T.t.row.getBoundingClientRect();dropLine.hidden=false;
    dropLine.style.top=((T.t.where==='above'?rb.top:rb.bottom)-lb.top+list.scrollTop-1)+'px';dropLine.style.left=(rb.left-lb.left+10)+'px';}});
function libDrop(e){const D=libDrag.d;if(!D||e.pointerId!==D.id)return;libDrag.d=null;libGhost.hidden=true;document.body.classList.remove('libdragging');libClear();libIdShow(false);
  if(!D.moving)return;/* a plain click: the tile's own click adds it as before */
  /* a drag is not a click */
  const stop=ev=>{ev.stopPropagation();ev.preventDefault();};D.tile.addEventListener('click',stop,{capture:true,once:true});setTimeout(()=>D.tile.removeEventListener('click',stop,{capture:true}),50);
  D.ctrl=e.ctrlKey||e.metaKey;const T=libTarget(e.clientX,e.clientY,D);if(!T)return;libApply(D.kind,D.rec,T);}
window.addEventListener('pointerup',libDrop,true);window.addEventListener('pointercancel',e=>{if(libDrag.d&&e.pointerId===libDrag.d.id){libDrag.d=null;libGhost.hidden=true;libClear();libIdShow(false);document.body.classList.remove('libdragging');}},true);
/* also used by tests */
function libApply(kind,rec,T){if(kind==='meshmap')return p3MapLibraryDrop(rec,T.meshSlot);if(kind==='project')return paUse(rec,T);if(rec&&rec.bundled&&!(rec.fill&&rec.imgs)){gmLoad(rec).then(()=>libApply(kind,rec,T)).catch(e=>toast('Could not load “'+rec.name+'”: '+(e.message||e)));return;}if(T.mesh)return libMeshDrop(kind,rec,T);
  if(kind==='smask'){const n=T.mask;if(!n)return;selectOnly(n);renderLayers();smMaskApply(rec);return;}
  if(kind==='tex'){if(T.mask){selectOnly(T.mask);renderLayers();return txToMask(rec);}return txToLayer(rec,T.at);}
  insertAt=T.at;try{return kind==='smart'?smApply(rec):matApply(rec);}finally{insertAt=null;}}

/* a material dropped on the model. Ctrl: the layer gets an ID-colour mask holding only the colour that was under the pointer */
async function libMeshDrop(kind,rec,T){
  if(!T.ctrl){insertAt=null;return kind==='smart'?smApply(rec):matApply(rec);}
  const M=typeof idSelMap==='function'?idSelMap():null;if(!M){toast('Ctrl + drop needs an ID map: bake ID colours and send them to 3D Paint first.');return;}
  const hit=document.getElementById('v3Hit'),p=hit&&v3PickAt(hit,{clientX:T.x,clientY:T.y});if(!p||!p.uv){toast('Drop the material on the model.');return;}
  const d=captureRegionNow(M,clamp(Math.floor(p.uv[0]*M.w),0,M.w-1),clamp(Math.floor(p.uv[1]*M.h),0,M.h-1),1,1).data;if(d[3]<3){toast('No ID colour there.');return;}
  const a=d[3]/255,c=[d[0]/255/a,d[1]/255/a,d[2]/255/a];
  insertAt=null;const h0=hist.undo.length;await (kind==='smart'?smApply(rec):matApply(rec));
  const L=doc.active;if(!isLayer(L)||L.mask)return;
  const r=msAdd(L,'id');if(r){msEdit(L,r,x=>{x.p.cols=[c];},'ID colour');if(typeof msCommit==='function')msCommit();}
  undoMerge(h0,'Add '+rec.name+' by ID colour');
  /* (0.38.1, Kenn) land on the material, not the mask, so its settings can be adjusted right away */
  L.editMask=false;ui.msSel=null;selectOnly(L);if(typeof renderMatEd==='function')renderMatEd(true);
  renderLayers();requestRender(true);toast('Added “'+rec.name+'” only where that ID colour is.');}
