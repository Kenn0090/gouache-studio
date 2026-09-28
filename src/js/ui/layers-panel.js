/* ================= Layers panel ================= */
/* blend mode picker with live hover preview */
const modeBtn=$('#lModeBtn'),modePop=el('div',{class:'modepop',role:'listbox','aria-label':'Blend modes',hidden:true});document.body.append(modePop);
let modeState=null;
const modeLabel=m=>m<0?'Pass through':MODES[m];
function previewMode(m){if(!modeState)return;if(!prefs.livePreview&&m!==modeState.orig)return;setMapModeOf(modeState.node,modeState.k,m);requestRender(true);}
function closeModePop(commit){if(!modeState)return;const st=modeState;modeState=null;modePop.hidden=true;modeBtn.setAttribute('aria-expanded','false');
  setMapModeOf(st.node,st.k,commit==null?st.orig:commit);renderLayers();requestRender(true);if(commit==null)modeBtn.focus();}
function openModePop(){const n=doc.active;if(!n)return;if(modeState){closeModePop();return;}closeMenu();
  const k=doc.map,cm=mapModeOf(n,k);modeState={node:n,k,orig:cm};const items=[];
  const add=m=>{const b=el('button',{role:'option','aria-selected':String(m===cm),text:modeLabel(m)});b.dataset.mode=m;
    b.addEventListener('mouseenter',()=>{b.focus({preventScroll:true});});b.addEventListener('focus',()=>previewMode(m));
    b.addEventListener('click',()=>closeModePop(m));items.push(b);return b;};
  const kids=[el('div',{class:'mhint',text:(doc.map!=='base'&&n.type!=='group'?'Blend mode for the '+MAP_DEFS[doc.map].label+' map. ':'')+'Hover or arrow keys to preview. Click or Enter applies, Esc cancels.'})];if(n.type==='group')kids.push(add(-1));
  for(const [g,ids] of MODE_GROUPS){if(g)kids.push(el('div',{class:'mg',text:g}));for(const i of ids)kids.push(add(i));}
  modePop.replaceChildren(...kids);modePop.hidden=false;modeBtn.setAttribute('aria-expanded','true');
  const r=modeBtn.getBoundingClientRect(),h=Math.min(window.innerHeight*.7,560);modePop.style.maxHeight=h+'px';
  modePop.style.left=Math.max(8,Math.min(r.left,window.innerWidth-228))+'px';
  const below=window.innerHeight-r.bottom-8;modePop.style.top=(below>=Math.min(h,modePop.scrollHeight)?r.bottom+4:Math.max(8,r.top-4-Math.min(h,modePop.scrollHeight)))+'px';
  const cur=items.find(b=>+b.dataset.mode===cm)||items[0];cur.scrollIntoView({block:'center'});cur.focus({preventScroll:true});}
modeBtn.addEventListener('click',openModePop);
modePop.addEventListener('mouseleave',()=>{if(modeState)previewMode(modeState.orig);});
modePop.addEventListener('keydown',e=>{const items=[...modePop.querySelectorAll('button')],i=items.indexOf(document.activeElement);
  if(e.key==='ArrowDown'){e.preventDefault();(items[i+1]||items[0]).focus();}else if(e.key==='ArrowUp'){e.preventDefault();(items[i-1]||items[items.length-1]).focus();}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeModePop();}else if(e.key==='Tab'){e.preventDefault();}});
document.addEventListener('pointerdown',e=>{if(modeState&&!modePop.contains(e.target)&&e.target!==modeBtn&&!modeBtn.contains(e.target))closeModePop();});
const opSlider=makeSlider({id:'lOp',label:'Opacity',min:0,max:1,step:.01,value:1,fmt:pct,onInput:v=>{if(doc.active){doc.active.opacity=v;requestRender(true);}}});
$('#lOpacityRow').append(opSlider.el);
$('#lClip').addEventListener('change',e=>{if(isLayer(doc.active)){doc.active.clip=e.target.checked;renderLayers();requestRender(true);}});
$('#lLock').addEventListener('change',e=>{if(isLayer(doc.active)){doc.active.lockAlpha=e.target.checked;renderLayers();}});
const eyeOn='<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>';
const eyeOff='<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.9 3.6M6.2 7.4C3.9 9.1 2.5 12 2.5 12S6 18.5 12 18.5c1.3 0 2.5-.3 3.6-.8"/></svg>';
const folderSvg='<svg viewBox="0 0 24 24"><path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2h7.2a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>';
function displayRows(){const rows=[];const walk=(g,depth)=>{for(let i=g.children.length-1;i>=0;i--){const n=g.children[i];rows.push({n,depth,clipped:!!clipBaseOf(g.children,i)});if(n.type==='group'&&n.open)walk(n,depth+1);}};walk(doc.root,0);return rows;}
function effVisible(n){let c=n;while(c&&c!==doc.root){if(!c.visible)return false;c=c.parent;}return true;}
function updateRowClasses(){for(const r of $('#layerList').children){if(!r._node)continue;r.classList.toggle('on',r._node===doc.active);r.classList.toggle('sel',doc.sel.has(r._node));r.setAttribute('aria-selected',String(doc.sel.has(r._node)));}syncLayerProps();}
let gradPanelFor=null;
let lkPanelFor=null;
function syncLayerProps(){const A=doc.active,grp=A&&A.type==='group';if(ui.tool==='text'&&textPanelFor!==activeText()&&!fontState)buildBrushPanel();
  if(ui.tool==='gradient'&&gradPanelFor!==activeGrad()){gradPanelFor=activeGrad();buildBrushPanel();drawXfOverlay();}
  if((ui.tool==='array'||ui.tool==='shape')&&lkPanelFor!==doc.active){lkPanelFor=doc.active;buildBrushPanel();drawXfOverlay();}
  $('#lModeName').textContent=A?modeLabel(mapModeOf(A,doc.map)):'Normal';modeBtn.disabled=!A;renderMaskRow();
  if(A){opSlider.set(A.opacity);$('#lClip').checked=!!A.clip;$('#lLock').checked=!!A.lockAlpha;}
  $('#lClip').disabled=$('#lLock').disabled=!isLayer(A);
  const tops=topSelected(),p=A&&A.parent,i=p?p.children.indexOf(A):-1;
  const mb=$('#lMerge'),mt=tops.length>1?'Merge '+tops.length+' layers':grp?'Merge group':'Merge down';mb.title=mt+' (Ctrl+E)';mb.setAttribute('aria-label',mt);
  mb.disabled=!(tops.length>1||grp||(isLayer(A)&&i>0&&isLayer(p.children[i-1])));
  $('#lDel').disabled=!A;$('#lUp').disabled=!A||i>=p.children.length-1;$('#lDown').disabled=!A||i<=0;$('#lUngroup').disabled=!grp;
}
function renderLayers(){
  const list=$('#layerList');list.replaceChildren();
  for(const {n,depth,clipped} of displayRows()){const grp=n.type==='group';
    const eye=el('button',{class:'eye',title:n.visible?'Hide':'Show','aria-label':(n.visible?'Hide ':'Show ')+n.name});eye.innerHTML=n.visible?eyeOn:eyeOff;
    eye.addEventListener('click',e=>{e.stopPropagation();n.visible=!n.visible;renderLayers();requestRender(true);});
    const meta=[];if(grp){meta.push(n.mode<0?'pass':MODES[n.mode]);const om=doc.maps.length>1&&ui.mode!=='anim'?onlyMapOf(n):null;if(om)meta.push(MAP_SHORT[om]);}else{const mm=mapModeOf(n,doc.map);if(mm!==(doc.map==='base'?0:MAP_DEFS[doc.map].blend))meta.push(MODES[mm].replace(' (Add)',''));}
    if(n.text)meta.unshift('text');if(n.grad)meta.unshift('gradient');if(n.shape)meta.unshift('shape');if(n.fill)meta.unshift('fill');if(n.array&&n.array.on!==false)meta.unshift('array');if(n.opacity<1)meta.push(Math.round(n.opacity*100)+'%');if(n.lockAlpha)meta.push('lock');
    /* which maps this layer has something in (so a layer painted only in Height is easy to find) */
    if(n.fx){meta.length=0;const mm=mapModeOf(n,n.fx.map);if(mm)meta.push(MODES[mm].replace(' (Add)',''));if(n.opacity<1)meta.push(Math.round(n.opacity*100)+'%');
      meta.unshift(n.fx.stack.filter(it=>it.on!==false).map(fxItemTitle).join(', ')||'no filters');if(doc.maps.length>1)meta.push(MAP_SHORT[n.fx.map]);}
    else if(!grp&&doc.maps.length>1&&ui.mode!=='anim'){const ks=mapKeysOf(n).filter(k=>doc.maps.includes(k)&&!(k==='base'&&isBlankBase(n)));
      if(!ks.includes(doc.map))meta.push('empty in '+MAP_DEFS[doc.map].label.toLowerCase());if(ks.length)meta.push(ks.map(k=>MAP_SHORT[k]).join(' '));}
    const name=el('div',{class:'lname',text:(clipped?'↳ ':'')+n.name,title:'Double-click to rename'});
    let icon;
    if(grp){icon=el('button',{class:'caret'+(n.open?' open':''),'aria-label':(n.open?'Collapse ':'Expand ')+n.name,'aria-expanded':String(n.open)});icon.innerHTML=folderSvg;
      icon.addEventListener('click',e=>{e.stopPropagation();n.open=!n.open;renderLayers();});icon.addEventListener('pointerdown',e=>e.stopPropagation());}
    else{icon=n.thumb;icon.classList.toggle('edit',!!(n.mask&&!n.editMask&&n===doc.active));icon.classList.toggle('fxthumb',!!n.fx);
      if(n.fx){icon.title='Filter layer: double-click to change its filters';icon.ondblclick=e=>{e.stopPropagation();selectOnly(n);updateRowClasses();fxEditor(n);};}else if(n.fill){icon.title='Fill layer: double-click to change what it fills';icon.ondblclick=e=>{e.stopPropagation();selectOnly(n);updateRowClasses();dlgFillLayer(n);};}else{icon.ondblclick=null;icon.title='';}}
    const thumbs=el('div',{class:'thumbs'},icon);
    if(n.mask){const mt=n.mask.thumb;mt.className='mthumb'+(n.editMask&&n===doc.active?' edit':'')+(n.mask.enabled?'':' off');mt.title='Mask: click to edit, Shift+click to turn off or on, Alt+click to view it';thumbs.append(mt);}
    icon=thumbs;
    const row=el('div',{class:'lrow'+(grp?' group':'')+(clipped?' clip':'')+(effVisible(n)?'':' hid'),role:'option',tabindex:'0',style:'--depth:'+depth},eye,icon,name,el('div',{class:'lmeta',text:(grp?n.children.length+' · ':'')+meta.join(' · ')}));
    if(!grp&&!n.fx&&n.styles&&STYLE_ORDER.some(k=>n.styles[k]&&n.styles[k].on)){const fx=el('button',{class:'fxbadge',text:'fx',title:'Layer style: click to change','aria-label':'Layer style of '+n.name});
      fx.addEventListener('pointerdown',e=>e.stopPropagation());fx.addEventListener('click',e=>{e.stopPropagation();selectOnly(n);updateRowClasses();dlgLayerStyle();});row.append(fx);}
    row._node=n;
    row.addEventListener('pointerdown',e=>layerPointerDown(e,n,row));
    row.addEventListener('contextmenu',e=>{e.preventDefault();if(!doc.sel.has(n)){selectOnly(n);updateRowClasses();syncLayerProps();}layerMenu(e,n);});
    row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectOnly(n);updateRowClasses();}});
    name.addEventListener('dblclick',e=>{e.stopPropagation();const inp=el('input',{value:n.name,'aria-label':'Name'});name.replaceChildren(inp);inp.focus();inp.select();
      inp.addEventListener('pointerdown',ev=>ev.stopPropagation());
      const done=()=>{const v=inp.value.trim();if(v&&v!==n.name){n.name=v;n.autoName=false;}renderLayers();};inp.addEventListener('blur',done);inp.addEventListener('keydown',ev=>{ev.stopPropagation();if(ev.key==='Enter')inp.blur();if(ev.key==='Escape'){inp.value=n.name;inp.blur();}});});
    /* a layer with mask rows or content effects: ▾ folds them (like Substance) */
    if(typeof msRowsEl==='function'&&(msHas(n)||(n.cfx&&n.cfx.length))){const fold=el('button',{class:'msfold'+(n.fxFold?'':' open'),text:n.fxFold?'▸':'▾',title:n.fxFold?'Show its mask and effect rows':'Fold its rows','aria-label':(n.fxFold?'Show':'Fold')+' the rows of '+n.name});
      fold.addEventListener('pointerdown',e=>e.stopPropagation());fold.addEventListener('click',e=>{e.stopPropagation();n.fxFold=!n.fxFold;renderLayers();});row.insertBefore(fold,row.children[1]);}
    row.addEventListener('pointerdown',()=>{if(ui.msSel){ui.msSel=null;if(typeof renderMatEd==='function')requestAnimationFrame(()=>renderMatEd(true));}},true);
    list.append(row);if(typeof msRowsEl==='function')for(const r of msRowsEl(n))list.append(r);}
  list.append(dropLine);updateRowClasses();if(typeof maskBarSync==='function')maskBarSync();v3.dirty=true;
}
function renderMaskRow(){const A=doc.active,row=$('#maskRow');row.replaceChildren();if(!A)return;
  if(!A.mask){row.append(el('button',{class:'btn sm',text:'Add mask',title:'Add a white mask (reveals everything)',onclick:()=>cmdAddMask(1)}),el('button',{class:'btn sm',text:'Add hide-all mask',title:'Add a black mask (hides everything)',onclick:()=>cmdAddMask(0)}));return;}
  row.append(...[el('div',{class:'sub',style:'width:100%',text:A.editMask?'Painting on the mask: black hides, white reveals.':'Mask attached. Click its thumbnail to paint on it.'}),
    chk('mEn','Mask on',A.mask.enabled,v=>{A.mask.enabled=v;renderLayers();requestRender(true);}),
    chk('mView','View mask',!!ui.viewMask,v=>{ui.viewMask=v;if(v)A.editMask=true;renderLayers();requestRender();}),
    isLayer(A)?el('button',{class:'btn sm',text:'Apply',title:'Bake the mask into the layer’s transparency',onclick:cmdApplyMask}):null,
    el('button',{class:'btn sm',text:'Delete mask',onclick:cmdDeleteMask})].filter(Boolean));}
function maskRecord(n,oldM,newM,label){return {label,refs:[n],masks:[oldM,newM].filter(Boolean),undo(){n.mask=oldM;n.editMask=!!oldM&&n.editMask;if(!oldM)ui.viewMask=false;},redo(){n.mask=newM;n.editMask=!!newM;if(!newM)ui.viewMask=false;}};}
function cmdAddMask(fill){const n=doc.active;if(!n){toast('Select a layer or group first.');return;}if(n.mask){toast('This already has a mask.');return;}
  const m=makeMask(fill),fromSel=sel.active&&!sel.quick;if(fromSel)run(P.loadsel,m.target,{uSrc:sel.t.tex,uWhat:{int:1},uInv:!fill});
  const r=maskRecord(n,null,m,fromSel?(fill?'Add mask from selection':'Add mask hiding selection'):'Add mask');r.redo();pushUndo(r);changed(n);
  toast(fromSel?(fill?'Mask added: the selection stays visible.':'Mask added: the selection is hidden.'):fill?'Mask added. Paint black to hide.':'Hide-all mask added. Paint white to reveal.');}
function cmdDeleteMask(){const n=doc.active;if(!n||!n.mask)return;const r=maskRecord(n,n.mask,null,'Delete mask');r.redo();pushUndo(r);changed(n);}
/* the mask is baked into every map the layer has */
function cmdApplyMask(){const L=doc.active;if(!isLayer(L)||!L.mask)return;const W=doc.w,H=doc.h,m=L.mask,steps=[];
  for(const k of mapKeysOf(L)){const T=mapT(L,k),before=captureRegion(T,0,0,W,H),tmp=acquireD(T.depth);run(P.applymask,tmp,{uSrc:T.tex,uM:m.target.tex});blit(tmp,T,0,0,W,H,0,0);release(tmp);steps.push({k,before,after:captureRegion(T,0,0,W,H)});}
  L.mask=null;L.editMask=false;ui.viewMask=false;
  pushUndo({label:'Apply mask',refs:[L],masks:[m],snaps:steps.flatMap(s=>[s.before,s.after]),undo(){for(const s of steps)restoreRegion(s.before,mapT(L,s.k),0,0);L.mask=m;},redo(){for(const s of steps)restoreRegion(s.after,mapT(L,s.k),0,0);L.mask=null;L.editMask=false;}});changed(L);}
/* selection + drag to rearrange */
const dropLine=el('div',{class:'dropline',hidden:true});
let ldrag=null;
/* the one map a layer or group holds when it has nothing in the base colour (sent bakes and conversions) */
function onlyMapOf(n){const ks=new Set();const add=L=>{if(L.fx||L.text||L.grad)return false;for(const k of mapKeysOf(L))if(!(k==='base'&&isBlankBase(L)))ks.add(k);return true;};
  if(n.type==='group'){const walk=g=>g.children.every(c=>c.type==='group'?walk(c):add(c));if(!walk(n))return null;}else if(!add(n))return null;
  if(ks.size!==1)return null;const k=[...ks][0];return k!=='base'&&doc.maps.includes(k)?k:null;}
function layerPointerDown(e,n,row){
  if(e.button!==0||e.target.closest('button,input'))return;
  if(xf&&!xf.move)xfCommit();
  if((e.ctrlKey||e.metaKey)&&(e.target===n.thumb||(n.mask&&e.target===n.mask.thumb))){const mode=e.shiftKey&&e.altKey?'int':e.shiftKey?'add':e.altKey?'sub':'new';
    if(e.target===n.thumb)selectLayerPixels(n,mode);else selectMask(n,mode);return;}
  if(n.mask&&e.target===n.mask.thumb){if(e.shiftKey){n.mask.enabled=!n.mask.enabled;toast(n.mask.enabled?'Mask on.':'Mask off.');}
    else if(e.altKey){selectOnly(n);n.editMask=true;ui.viewMask=!ui.viewMask;}
    else{selectOnly(n);n.editMask=true;}renderLayers();requestRender(true);refreshChanUI();return;}
  /* the layer's own thumbnail: back to the layer (and out of mask mode) */
  if(e.target===n.thumb&&ui.viewMask&&typeof maskModeExit==='function'){maskModeExit();v3.dirty=true;}
  if(e.target===n.thumb&&n.editMask){n.editMask=false;ui.viewMask=false;}
  let pendingSingle=null;
  if(e.shiftKey&&doc.active){const rows=displayRows().map(r=>r.n),a=rows.indexOf(doc.active),b=rows.indexOf(n);if(a>=0&&b>=0){const lo=Math.min(a,b),hi=Math.max(a,b);doc.sel=new Set(rows.slice(lo,hi+1));}doc.sel.add(n);doc.active=n;}
  else if(e.ctrlKey||e.metaKey){if(doc.sel.has(n)&&doc.sel.size>1){doc.sel.delete(n);if(doc.active===n)doc.active=[...doc.sel].pop();}else{doc.sel.add(n);doc.active=n;}}
  else if(!doc.sel.has(n))selectOnly(n);else{doc.active=n;pendingSingle=n;}
  updateRowClasses();
  /* clicking a layer or group that only holds one other map shows that map */
  if(ui.mode==='paint'&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey){const k=onlyMapOf(n);if(k&&k!==doc.map){setView(k);if(doc.map===k)toast('Showing the '+MAP_DEFS[k].label.toLowerCase()+' map.');}}
  ldrag={n,x:e.clientX,y:e.clientY,id:e.pointerId,moving:false,pendingSingle,target:null};
}
function dropTargetAt(y){const rows=[...$('#layerList').querySelectorAll('.lrow')];if(!rows.length)return null;
  for(const r of rows){const b=r.getBoundingClientRect();if(y>=b.top&&y<b.bottom){const n=r._node,f=(y-b.top)/b.height;
    if(n.type==='group'&&f>.3&&f<.7)return {ref:n,where:'into',row:r};return {ref:n,where:f<.5?'above':'below',row:r};}}
  const first=rows[0],last=rows[rows.length-1];
  return y<first.getBoundingClientRect().top?{ref:first._node,where:'above',row:first}:{ref:last._node,where:'below',row:last};}
function resolveDrop(t){if(!t)return null;const {ref,where}=t;
  if(where==='into')return {parent:ref,top:true};
  if(where==='below'&&ref.type==='group'&&ref.open&&ref.children.length)return {parent:ref,top:true};
  return {parent:ref.parent,ref,where};}
function dropAllowed(nodes,d){if(!d)return false;if(d.ref&&nodes.includes(d.ref))return false;for(const n of nodes){if(d.parent===n||isAncestor(n,d.parent))return false;}return true;}
window.addEventListener('pointermove',e=>{if(!ldrag||e.pointerId!==ldrag.id)return;
  if(!ldrag.moving){if(Math.hypot(e.clientX-ldrag.x,e.clientY-ldrag.y)<5)return;ldrag.moving=true;ldrag.pendingSingle=null;document.body.classList.add('ldragging');}
  document.querySelectorAll('.lrow.drop-into,.lrow.drop-mask').forEach(r=>r.classList.remove('drop-into','drop-mask'));dropLine.hidden=true;
  /* onto a mask thumbnail (or Alt over a row): the dragged layer becomes that mask */
  const under=document.elementFromPoint(e.clientX,e.clientY),mrow=under&&under.closest('.lrow');ldrag.maskTo=null;
  if(mrow&&mrow._node&&mrow._node!==ldrag.n&&(under.closest('.mthumb')||e.altKey)&&isLayer(ldrag.n)){ldrag.maskTo=mrow._node;ldrag.target=null;mrow.classList.add('drop-mask');return;}
  const t=dropTargetAt(e.clientY),d=resolveDrop(t),nodes=topSelected();ldrag.target=dropAllowed(nodes,d)?d:null;
  if(!ldrag.target)return;
  if(d.top&&t.where==='into'){t.row.classList.add('drop-into');return;}
  const list=$('#layerList'),lb=list.getBoundingClientRect(),rb=t.row.getBoundingClientRect();
  dropLine.hidden=false;dropLine.style.top=((t.where==='above'?rb.top:rb.bottom)-lb.top+list.scrollTop-1)+'px';
  dropLine.style.left=(rb.left-lb.left+10+(d.top?(+(t.row.style.getPropertyValue('--depth'))+1)*14:+(t.row.style.getPropertyValue('--depth'))*14))+'px';});
function endLayerDrag(e){if(!ldrag||e.pointerId!==ldrag.id)return;const g=ldrag;ldrag=null;document.body.classList.remove('ldragging');dropLine.hidden=true;
  document.querySelectorAll('.lrow.drop-into,.lrow.drop-mask').forEach(r=>r.classList.remove('drop-into','drop-mask'));
  if(g.moving&&g.maskTo){layerIntoMask(g.n,g.maskTo);return;}
  if(!g.moving){if(g.pendingSingle){selectOnly(g.pendingSingle);updateRowClasses();}return;}
  if(g.target)moveNodes(topSelected(),g.target);}
window.addEventListener('pointerup',endLayerDrag);window.addEventListener('pointercancel',endLayerDrag);
function moveNodes(nodes,d){if(!nodes.length||!dropAllowed(nodes,d))return;
  structOp(nodes.length>1?'Move layers':'Move layer',()=>{for(const n of nodes)detachNode(n);
    let i=d.top?d.parent.children.length:d.parent.children.indexOf(d.ref)+(d.where==='above'?1:0);
    for(const n of nodes)insertNode(n,d.parent,i++);
    if(d.top)d.parent.open=true;});}

/* commands */
function insertPoint(){const a=doc.active;if(!a)return [doc.root,doc.root.children.length];if(a.type==='group'&&a.open)return [a,a.children.length];return [a.parent,a.parent.children.indexOf(a)+1];}
function cmdAddLayer(name){const L=newLayerObj(name);structOp('New layer',()=>{const [p,i]=insertPoint();insertNode(L,p,i);selectOnly(L);});return L;}
function cmdNewGroup(){const G=newGroupObj();structOp('New group',()=>{const [p,i]=insertPoint();insertNode(G,p,i);selectOnly(G);});}
function cmdGroup(){const tops=topSelected();if(!tops.length)return;
  structOp('Group layers',()=>{const top=tops[tops.length-1],p=top.parent,G=newGroupObj();insertNode(G,p,p.children.indexOf(top)+1);for(const n of tops){detachNode(n);insertNode(n,G);}selectOnly(G);});
  toast('Grouped '+tops.length+' item'+(tops.length===1?'':'s')+'.');}
function cmdUngroup(){const G=doc.active;if(!G||G.type!=='group'){toast('Select a group to ungroup.');return;}
  structOp('Ungroup',()=>{const p=G.parent,i=p.children.indexOf(G),ch=G.children.slice();detachNode(G);p.children.splice(i,0,...ch);ch.forEach(c=>c.parent=p);doc.sel=new Set(ch);doc.active=ch[ch.length-1]||p.children[Math.max(0,i-1)]||null;});}
function cloneNode(n){if(n.type==='layer'&&n.fx){const L=newFxLayerObj(n.name+' copy',JSON.parse(JSON.stringify(fxCleanStack(n.fx.stack))),n.fx.map);Object.assign(L,{opacity:n.opacity,mode:n.mode,clip:n.clip,visible:n.visible,mask:cloneMask(n.mask)});L.mapModes=Object.assign({},n.mapModes);return L;}
  if(n.type==='layer'){const L=newLayerObj(n.name+' copy');Object.assign(L,{opacity:n.opacity,mode:n.mode,clip:n.clip,lockAlpha:n.lockAlpha,visible:n.visible,mask:cloneMask(n.mask),text:n.text?cloneText(n.text):null,grad:n.grad?cloneGrad(n.grad):null,array:n.array?JSON.parse(JSON.stringify(n.array)):null,arrBox:n.arrBox||null,styles:n.styles?JSON.parse(JSON.stringify(n.styles)):null,shape:n.shape?JSON.parse(JSON.stringify(n.shape)):null,fill:n.fill?JSON.parse(JSON.stringify(n.fill)):null});if(n._fillImg){L._fillImg={};for(const k in n._fillImg){const s=n._fillImg[k],t=makeTarget(s.w,s.h,8,true);blit(s,t,0,0,s.w,s.h,0,0);L._fillImg[k]=t;}}for(const k of mapKeysOf(n))blit(mapT(n,k),ensureMapTarget(L,k),0,0,doc.w,doc.h,0,0);L.mapModes=Object.assign({},n.mapModes);L.target=L.maps[doc.map]||emptyFor(mapDepth(doc.map));if(L.text)L.text.bbox=layoutText(L.text);return L;}
  const G=newGroupObj(n.name+' copy');Object.assign(G,{opacity:n.opacity,mode:n.mode,visible:n.visible,open:n.open,mask:cloneMask(n.mask)});for(const c of n.children){const cc=cloneNode(c);cc.name=c.name;insertNode(cc,G);}return G;}
function cmdDuplicate(){const tops=topSelected();if(!tops.length)return;
  structOp('Duplicate',()=>{const clones=[];for(const n of tops){const c=cloneNode(n);insertNode(c,n.parent,n.parent.children.indexOf(n)+1);clones.push(c);}doc.sel=new Set(clones);doc.active=clones[clones.length-1];});}
function cmdDelete(){const tops=topSelected();if(!tops.length)return;
  const remaining=allLayers().filter(L=>!tops.some(t=>t===L||isAncestor(t,L)));if(!remaining.length){toast('Keep at least one layer in the document.');return;}
  structOp(tops.length>1?'Delete layers':'Delete',()=>{const ref=tops[0],p=ref.parent,i=p.children.indexOf(ref);for(const n of tops)detachNode(n);
    const next=p.children[Math.max(0,i-1)]||(p!==doc.root?p:null)||remaining[remaining.length-1];selectOnly(next);});}
function cmdMove(d){const A=doc.active;if(!A)return;const p=A.parent,i=p.children.indexOf(A),j=i+d;if(j<0||j>=p.children.length)return;
  structOp('Move layer',()=>{p.children.splice(i,1);p.children.splice(j,0,A);});}
/* a new layer holding, for every map some of the given layers use, render(k) */
function anyInMap(list,k){return list.some(n=>n.type==='group'?anyInMap(n.children,k):hasMap(n,k));}
function mergedLayer(name,list,props,render){const M=newLayerObj(name);Object.assign(M,props||{});
  for(const k of doc.maps){if(k!=='base'&&!anyInMap(list,k))continue;const R=render?render(k):renderNodesMap(list,k);if(!R)continue;blit(R,ensureMapTarget(M,k),0,0,doc.w,doc.h,0,0);release(R);}
  M.target=M.maps[doc.map]||emptyFor(mapDepth(doc.map));return M;}
function cmdMergeDown(){const L=doc.active;if(!isLayer(L))return;const p=L.parent,i=p.children.indexOf(L),lower=p.children[i-1];
  if(!isLayer(lower)){toast(lower?'The item below is a group. Use Merge group on it first.':'There is no layer below to merge into.');return;}
  const clipped=clipBaseOf(p.children,i)===lower;
  if(isFx(L)){/* bake the filters into the layer below */
    const M=mergedLayer(lower.name,[lower],{opacity:lower.opacity,mode:lower.mode,visible:lower.visible,clip:lower.clip,lockAlpha:lower.lockAlpha,mask:cloneMask(lower.mask)},k=>{
      if(!hasMap(lower,k))return null;const d=mapDepth(k),prev=pool;pool=auxFor(d).pool;const B=acquire();blit(mapT(lower,k),B,0,0,doc.w,doc.h,0,0);
      const R=k===L.fx.map&&L.visible?fxApplyLayer(L,B,k,maskTexOf(L)):B;if(R!==B)release(B);pool=prev;return R;});
    M.mapModes=Object.assign({},lower.mapModes);structOp('Merge filter down',()=>{const at=p.children.indexOf(lower);detachNode(L);detachNode(lower);insertNode(M,p,at);selectOnly(M);});return;}
  
  const M=mergedLayer(lower.name,[L,lower],{opacity:lower.opacity,mode:lower.mode,visible:lower.visible,clip:lower.clip,lockAlpha:lower.lockAlpha,mask:cloneMask(lower.mask)},k=>{
    const d=mapDepth(k),E=emptyFor(d),LT=hasMap(L,k)?mapT(L,k):E,BT=hasMap(lower,k)?mapT(lower,k):E,R=acquireD(d);
    run(P.comp,R,{uBase:BT.tex,uLayer:LT.tex,uStrokeTex:strokeT.tex,uMask:clipped?mapT(lower,'base').tex:dummy,uUseMask:clipped,uLMask:maskTexOf(L)||dummy,uUseLMask:!!maskTexOf(L),uMode:{int:mapModeOf(L,k)},uOpacity:L.visible?L.opacity:0,uStroke:{int:0},uStrokeColor:[0,0,0],uStrokeOpacity:0,uLockAlpha:false});return R;});
  M.mapModes=Object.assign({},lower.mapModes);
  structOp('Merge down',()=>{const k=p.children.indexOf(lower);detachNode(L);detachNode(lower);insertNode(M,p,k);selectOnly(M);});}
function cmdMergeGroup(){const G=doc.active;if(!G||G.type!=='group')return;
  const M=mergedLayer(G.name,G.children,{opacity:G.opacity,mode:Math.max(0,G.mode),visible:G.visible,mask:cloneMask(G.mask)});
  structOp('Merge group',()=>{const p=G.parent,i=p.children.indexOf(G);detachNode(G);insertNode(M,p,i);selectOnly(M);});}
function cmdMergeSelected(){const tops=topSelected();if(tops.length<2)return;
  const M=mergedLayer('Merged',tops);
  structOp('Merge layers',()=>{const top=tops[tops.length-1],p=top.parent;insertNode(M,p,p.children.indexOf(top)+1);for(const n of tops)detachNode(n);selectOnly(M);});}
function cmdMerge(){const tops=topSelected();if(tops.length>1)cmdMergeSelected();else if(doc.active&&doc.active.type==='group')cmdMergeGroup();else cmdMergeDown();}
function hiddenNodes(g,out){for(const n of g.children){if(!n.visible)out.push(n);else if(n.type==='group')hiddenNodes(n,out);}return out;}
function cmdMergeVisible(){const M=mergedLayer('Merged',doc.root.children);
  structOp('Merge visible',()=>{const hid=hiddenNodes(doc.root,[]);for(const n of hid)detachNode(n);doc.root.children=[];hid.forEach(n=>insertNode(n,doc.root));insertNode(M,doc.root);selectOnly(M);});
  toast('Merged visible layers. Hidden layers were kept.');}
function cmdFlatten(){const hid=hiddenNodes(doc.root,[]),count=hid.reduce((s,n)=>s+(n.type==='layer'?1:allLayers(n).length),0);
  const go=()=>{const M=mergedLayer('Background',doc.root.children);structOp('Flatten image',()=>{doc.root.children=[];insertNode(M,doc.root);selectOnly(M);});toast('Flattened to one layer. Undo brings the layers back.');};
  if(!count){go();return;}
  openDialog({title:'Flatten image?',body:el('p',{class:'note',text:'Flattening combines everything visible into one layer and discards '+count+' hidden layer'+(count===1?'':'s')+'. You can undo this.'}),okLabel:'Flatten',onOk:go});}
$('#lAdd').addEventListener('click',()=>cmdAddLayer());$('#lGroup').addEventListener('click',()=>{if(doc.sel.size>1||(doc.active&&topSelected().length))cmdGroup();else cmdNewGroup();});
$('#lUngroup').addEventListener('click',cmdUngroup);$('#lDup').addEventListener('click',cmdDuplicate);$('#lDel').addEventListener('click',cmdDelete);
$('#lMerge').addEventListener('click',cmdMerge);$('#lUp').addEventListener('click',()=>cmdMove(1));$('#lDown').addEventListener('click',()=>cmdMove(-1));
/* right-click a layer: masks, layer styles (each adds that style and opens it), filters, array, and the usual commands */
function layerMenu(e,n){const pop=$('#menuPop');closeMenu();const lay=isLayer(n)&&!n.fx,grp=n.type==='group',anim=ui.mode==='anim';
  const it=(t,f,key,dis)=>{const b=el('button',{class:'mi',role:'menuitem',disabled:!!dis,onclick:()=>{pop.hidden=true;f();}},el('span'),el('span',{text:t}),el('span',{text:key||''}));return b;};
  const head=t=>el('div',{class:'mh',text:t});const sep=()=>el('div',{class:'msep'});
  const items=[];
  if(!anim){if(n.mask)items.push(it('Delete mask',cmdDeleteMask),...(typeof msHas==='function'&&msHas(n)?[it('Flatten mask (keep the result, drop its rows)',()=>msFlatten(n))]:[]));else items.push(it('Add mask',()=>cmdAddMask(1)),it('Add black mask (hide all)',()=>cmdAddMask(0)),...(lay&&typeof liveMaskStart==='function'?[it('Live mask…',()=>liveMaskStart(n))]:[]));}
  if(lay&&!anim){items.push(sep(),head('Layer style'));for(const k of STYLE_ORDER)items.push(it(STYLE_DEFS[k].label+(n.styles&&n.styles[k]&&n.styles[k].on?' ✓':''),()=>dlgLayerStyle(k,true)));
    items.push(it('All styles…',()=>dlgLayerStyle()),sep(),it('Filter layer above…',cmdNewFxLayer),it('Array…',()=>setTool('array')));
    if(n.fill)items.splice(0,0,it('Fill settings…',()=>dlgFillLayer(n)),it('Mesh maps from this material…',()=>dlgMatConvert(n)),sep());
    if(n.text||n.grad||n.shape||n.fill)items.push(it('Convert to pixels',()=>{if(n.fill)fillRasterize(n);else rasterizeText(n);changed(n);}));}
  const mm=typeof maskMeshKeys==='function'?maskMeshKeys():[];
  if(lay&&!anim&&mm.length){items.push(sep(),head('Mask from mesh map'));for(const k of mm)items.push(it(P3_MESHMAP_NAMES[k]||k,()=>maskFromMeshMap(n,k)));}
  if(!anim&&ui.mode==='paint'&&typeof sendToP3==='function')items.push(sep(),it('Send layer to 3D Paint',()=>sendToP3(n)));
  if(!anim)items.push(it('New fill layer',cmdNewFillLayer));
  items.push(sep(),it(grp?'Ungroup':'Group into folder',grp?cmdUngroup:cmdGroup,grp?'Ctrl+Shift+G':'Ctrl+G',anim),it('Duplicate',cmdDuplicate,'Ctrl+J',anim),it(grp?'Merge group':'Merge down',cmdMerge,'Ctrl+E',anim),it('Delete',cmdDelete,'Del',anim));
  pop.replaceChildren(...items);pop.hidden=false;
  pop.style.left=Math.max(4,Math.min(e.clientX,window.innerWidth-pop.offsetWidth-8))+'px';pop.style.top=Math.max(4,Math.min(e.clientY+4,window.innerHeight-pop.offsetHeight-8))+'px';
  const off=ev=>{if(!pop.contains(ev.target)){pop.hidden=true;document.removeEventListener('pointerdown',off,true);}};setTimeout(()=>document.addEventListener('pointerdown',off,true),0);}
$('#lMaskAdd').addEventListener('click',()=>{if(isLayer(doc.active)||(doc.active&&doc.active.type==='group'))cmdAddMask(1);else toast('Select a layer to add a mask to.');});
$('#lStyle').addEventListener('click',()=>dlgLayerStyle());$('#lFill').addEventListener('click',()=>cmdNewFillLayer());
