/* ================= Drag from the Materials tab onto the layer stack (0.27) =================
   Kenn: "I should be able to drag things to the layer stack in 3D Paint, such as materials, smart materials,
   smart masks". A material or smart material dropped between layers becomes a new layer (or folder) right there;
   a smart mask dropped onto a layer becomes that layer's mask. Clicking a tile still adds it as before. */
const libDrag={d:null};
const libGhost=el('div',{class:'libghost',hidden:true});document.body.append(libGhost);
document.addEventListener('pointerdown',e=>{if(e.button!==0)return;const t=e.target.closest&&e.target.closest('.mattile');if(!t||!t._libDrag)return;
  libDrag.d={kind:t._libDrag[0],rec:t._libDrag[1],x:e.clientX,y:e.clientY,id:e.pointerId,moving:false,tile:t};},true);
function libClear(){document.querySelectorAll('.lrow.drop-into,.lrow.drop-mask').forEach(r=>r.classList.remove('drop-into','drop-mask'));dropLine.hidden=true;}
/* where a drop at (x, y) goes: {mask: layer} for smart masks, {at: {parent, index}} for the rest */
function libTarget(x,y,D){D=D||libDrag.d;const list=$('#layerList'),lb=list&&list.getBoundingClientRect();if(!lb||x<lb.left||x>lb.right||y<lb.top-8||y>lb.bottom+8)return null;
  if(D.kind==='smask'){const under=document.elementFromPoint(x,y),row=under&&under.closest('.lrow');const n=row&&row._node;return n&&!n.fx?{mask:n,row}:null;}
  const t=dropTargetAt(y),d=resolveDrop(t);if(!d)return {at:{parent:doc.root,index:doc.root.children.length},t:null,d:null};
  const index=d.top?d.parent.children.length:d.parent.children.indexOf(d.ref)+(d.where==='above'?1:0);return {at:{parent:d.parent,index},t,d};}
window.addEventListener('pointermove',e=>{const D=libDrag.d;if(!D||e.pointerId!==D.id)return;
  if(!D.moving){if(Math.hypot(e.clientX-D.x,e.clientY-D.y)<6)return;D.moving=true;libGhost.textContent=D.rec.name;libGhost.hidden=false;document.body.classList.add('libdragging');}
  libGhost.style.left=(e.clientX+12)+'px';libGhost.style.top=(e.clientY+10)+'px';libClear();
  /* near the list's top or bottom edge: it scrolls */
  {const L=$('#layerList'),b=L&&L.getBoundingClientRect();if(b&&e.clientX>=b.left&&e.clientX<=b.right){if(e.clientY<b.top+24&&e.clientY>b.top-30)L.scrollTop-=14;else if(e.clientY>b.bottom-24&&e.clientY<b.bottom+30)L.scrollTop+=14;}}
  const T=libTarget(e.clientX,e.clientY);D.target=T;if(!T)return;
  if(T.mask){T.row.classList.add('drop-mask');return;}
  if(T.t){if(T.d.top&&T.t.where==='into'){T.t.row.classList.add('drop-into');return;}
    const list=$('#layerList'),lb=list.getBoundingClientRect(),rb=T.t.row.getBoundingClientRect();dropLine.hidden=false;
    dropLine.style.top=((T.t.where==='above'?rb.top:rb.bottom)-lb.top+list.scrollTop-1)+'px';dropLine.style.left=(rb.left-lb.left+10)+'px';}});
function libDrop(e){const D=libDrag.d;if(!D||e.pointerId!==D.id)return;libDrag.d=null;libGhost.hidden=true;document.body.classList.remove('libdragging');libClear();
  if(!D.moving)return;/* a plain click: the tile's own click adds it as before */
  /* a drag is not a click */
  const stop=ev=>{ev.stopPropagation();ev.preventDefault();};D.tile.addEventListener('click',stop,{capture:true,once:true});setTimeout(()=>D.tile.removeEventListener('click',stop,{capture:true}),50);
  const T=libTarget(e.clientX,e.clientY,D);if(!T)return;libApply(D.kind,D.rec,T);}
window.addEventListener('pointerup',libDrop,true);window.addEventListener('pointercancel',e=>{if(libDrag.d&&e.pointerId===libDrag.d.id){libDrag.d=null;libGhost.hidden=true;libClear();document.body.classList.remove('libdragging');}},true);
/* also used by tests */
function libApply(kind,rec,T){if(rec&&rec.bundled&&!(rec.fill&&rec.imgs)){gmLoad(rec).then(()=>libApply(kind,rec,T)).catch(e=>toast('Could not load “'+rec.name+'”: '+(e.message||e)));return;}if(kind==='smask'){const n=T.mask;if(!n)return;selectOnly(n);renderLayers();smMaskApply(rec);return;}
  insertAt=T.at;try{return kind==='smart'?smApply(rec):matApply(rec);}finally{insertAt=null;}}
