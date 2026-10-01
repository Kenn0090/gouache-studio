/* ================= Panels: dock, tabs, floating panels, icons, workspaces =================
   The panels are the existing <section class="sec"> blocks; this file only moves them around.
   The right dock holds groups of tabbed panels (drag the bars between groups to resize); a tab can be
   dragged to another group, between groups, onto the icon column (one click away), or off the dock to float.
   The arrangement is a workspace: Painting, Texturing, 3D Paint, Minimal or your own, remembered per workspace. */
const PANELS={
  p3d:{title:'3D Paint',sel:'#p3dSec',avail:m=>m==='p3d',mode:true},
  hist:{title:'History',sel:'#histSec',avail:m=>m!=='convert',icon:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'},
  matEd:{title:'Properties',sel:'#matEdSec',avail:m=>m==='p3d',icon:'<circle cx="12" cy="12" r="8"/><path d="M8 15l8-8M9 9h.01"/>'},
  shading:{title:'Shader',sel:'#shadeSec',avail:m=>m==='p3d',icon:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" opacity=".35"/>'},
  stencils:{title:'Stencils',sel:'#st3Sec',avail:m=>false,icon:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 15l3-4 2 3 1.5-2 1.5 3"/>'},
  mats:{title:'Materials',sel:'#matSec',avail:m=>m==='p3d',icon:'<circle cx="12" cy="12" r="8"/><path d="M7 9.5a6 6 0 0 1 5-3" opacity=".6"/>'},
  textures:{title:'Textures',sel:'#txSec',avail:m=>m==='paint'||m==='p3d',icon:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M7 8h1M11 7h1M15 9h1M8 12h1M13 13h1M16 15h1M9 16h1" stroke-width="2.4" stroke-linecap="round"/>'},
  p3bake:{title:'Bake Maps',sel:'#p3bkSec',avail:m=>m==='p3d',icon:'<path d="M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-4 3-6 6-10z"/><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5" opacity=".6"/>'},
  envs:{title:'Environments',sel:'#envSec',avail:m=>m==='p3d',icon:'<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>'},
  decals:{title:'Decals',sel:'#dcSec',avail:m=>m==='p3d',icon:'<circle cx="12" cy="12" r="7"/><path d="M9 9l6 6M15 9l-6 6"/>'},
  brushtab:{title:'Brush maker',sel:'#brushTabSec',avail:m=>m==='brush',mode:true},
  conv:{title:'Convert',sel:'#convSec',avail:m=>m==='convert',mode:true},
  bake:{title:'Bake',sel:'#bakeSec',avail:m=>m==='bake',mode:true},
  anim:{title:'Animation',sel:'#animSec',avail:m=>m==='anim',mode:true},
  color:{title:'Color',sel:'section[aria-labelledby="hColor"]',avail:m=>m!=='convert'&&m!=='bake',icon:'<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16" opacity=".5"/>'},
  brushes:{title:'Brushes',sel:'section[aria-labelledby="hBrush"]',avail:m=>m!=='convert'&&m!=='bake',icon:'<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>'},
  tool:{title:'Tool settings',sel:'#toolSec',avail:m=>m==='p3d',icon:'<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="8" cy="17" r="1.8"/>'},
  maps:{title:'Maps',sel:'#mapsSec',avail:m=>m==='paint'||m==='anim'||m==='p3d',icon:'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>'},
  layers:{title:'Layers',sel:'section[aria-labelledby="hLayers"]',avail:m=>m==='paint'||m==='brush'||m==='p3d',icon:'<path d="M12 4 3 9l9 5 9-5-9-5z"/><path d="m3 14 9 5 9-5"/>'},
  chan:{title:'Channels',sel:'section[aria-labelledby="hChan"]',avail:m=>m==='paint'||m==='p3d',icon:'<circle cx="9" cy="10" r="5"/><circle cx="15" cy="10" r="5"/><circle cx="12" cy="15" r="5"/>'}};
const PANEL_IDS=Object.keys(PANELS);
const MODE_GROUP=['p3d','brushtab','conv','bake','anim'];
/* the built-in workspaces: extra = 3D view on and how wide, painting on the model */
const WS_PRESETS={
  painting:{name:'Paint',tb:{side:'left',cols:1},opt:true,w:300,groups:[{tabs:MODE_GROUP.slice(),f:1.4},{tabs:['color','matEd','shading'],f:1.05},{tabs:['brushes','stencils','mats','textures','decals','envs','tool'],f:1.25},{tabs:['maps','p3bake'],f:.45},{tabs:['layers','chan','hist'],f:1.6}],icons:[],floats:[]},
  texturing:{name:'3D Paint',tb:{side:'left',cols:1},opt:true,w:300,extra:{v3:.45},groups:[{tabs:[...MODE_GROUP,'p3bake','shading'],f:1.2},{tabs:['layers','maps','chan','hist'],f:2.5}],shelf:{tabs:['mats','textures','decals','envs','brushes'],f:1,h:260},icons:[],floats:[]},
  paint3d:{name:'3D Paint (big view)',tb:{side:'left',cols:1},opt:true,w:280,extra:{v3:.68,paint3d:true},groups:[{tabs:[...MODE_GROUP,'p3bake','shading'],f:1.2},{tabs:['layers','maps','chan','hist'],f:2.5}],shelf:{tabs:['mats','textures','decals','envs','brushes'],f:1,h:260},icons:[],floats:[]},
  minimal:{name:'Minimal',tb:{side:'left',cols:1},opt:true,w:300,groups:[{tabs:MODE_GROUP.slice(),f:1}],icons:['color','matEd','shading','brushes','stencils','mats','textures','decals','envs','tool','maps','layers','chan','hist'],floats:[]}};
/* (0.28, Kenn) each top tab has its own workspace, and the drop-down follows the tab */
for(const [k,n] of [['animation','Animation'],['bake','Bake'],['convert','Convert'],['brush','Brush']])WS_PRESETS[k]=Object.assign(JSON.parse(JSON.stringify(WS_PRESETS.painting)),{name:n});
/* Brush creation keeps its previews and settings together, with painting brushes below the canvas. */
WS_PRESETS.brush={name:'Brush',tb:{side:'left',cols:1},opt:true,w:420,groups:[{tabs:MODE_GROUP.slice(),active:'brushtab',f:3.5},{tabs:['color'],f:1}],shelf:{tabs:['brushes'],h:230,f:1},icons:['layers','hist','maps','chan','matEd','shading','tool','stencils','mats','textures','decals','envs','p3bake'],floats:[]};
const WS_MODE_DEF={paint:'painting',p3d:'texturing',anim:'animation',bake:'bake',convert:'convert',brush:'brush'};
const dk={ws:'painting',L:null,custom:{},saved:{},lock:false,flyout:null,drag:null,modeWs:{}};
(()=>{try{const s=JSON.parse(localStorage.getItem('gs.dock')||'{}');if(s.ws)dk.ws=s.ws;if(s.modeWs)dk.modeWs=s.modeWs;if(s.col2&&s.col2.groups)dk.col2=s.col2;dk.saved=s.saved||{};dk.custom=s.custom||{};dk.lock=!!s.lock;
  /* Upgrade the old copied Paint layout once; retain custom arrangements. */
  if(!localStorage.getItem('gs.brushLayout464')){const L=dk.saved.brush;if(L&&L.groups&&L.groups.length===5&&L.groups[0].tabs.includes('brushtab')&&L.groups[1].tabs.includes('color')&&L.groups[2].tabs.includes('brushes'))delete dk.saved.brush;localStorage.setItem('gs.brushLayout464','1');}
  /* 0.36: the asset panels moved to the bottom shelf in 3D Paint */
  if(!localStorage.getItem('gs.layout371')){localStorage.setItem('gs.layout371','1');
    /* 0.37.1: Bake Maps and Shader join the texture sets tab; Stencils became a switch in Brushes */
    for(const n of ['texturing','paint3d']){const L=dk.saved[n];if(!L)continue;const all=[...(L.groups||[]),L.shelf].filter(Boolean);for(const g of all)g.tabs=(g.tabs||[]).filter(t=>!['p3bake','shading','stencils'].includes(t));const g0=(L.groups||[]).find(g=>g.tabs.includes('p3d'))||(L.groups||[])[0];if(g0)g0.tabs.push('p3bake','shading');if(L.shelf&&L.shelf.h<240)L.shelf.h=260;}
    if(dk.col2)for(const g of dk.col2.groups)g.tabs=g.tabs.filter(t=>!['shading','stencils'].includes(t));}
  if(!localStorage.getItem('gs.layout37')){localStorage.setItem('gs.layout37','1');delete dk.saved.texturing;delete dk.saved.paint3d;if(dk.col2)delete dk.col2;}}catch(e){}})();
const dkClone=o=>JSON.parse(JSON.stringify(o));
function dkPreset(ws){return dkClone(WS_PRESETS[ws]||dk.custom[ws]||WS_PRESETS.painting);}
function dkSave(){if(dk.L)dk.saved[dk.ws]=dk.L;try{localStorage.setItem('gs.dock',JSON.stringify({ws:dk.ws,modeWs:dk.modeWs,saved:dk.saved,custom:dk.custom,lock:dk.lock,col2:dk.col2}));}catch(e){}}
/* every panel is in exactly one place: a group, a float, the icons, or hidden */
function dkFix(L){const seen=new Set();const keep=a=>a.filter(id=>PANELS[id]&&!seen.has(id)&&seen.add(id));
  if(!L.shelf)L.shelf={tabs:[],f:1,h:170};if(!L.fold)L.fold={};
  for(const g of L.groups)g.tabs=keep(g.tabs);L.shelf.tabs=keep(L.shelf.tabs);for(const f of L.floats)f.tabs=keep(f.tabs);L.icons=keep(L.icons||[]);L.hidden=keep(L.hidden||[]);
  L.groups=L.groups.filter(g=>g.tabs.length);L.floats=L.floats.filter(f=>f.tabs.length);
  for(const id of PANEL_IDS)if(!seen.has(id)){const home=WS_PRESETS.painting.groups.find(g=>g.tabs.includes(id));const g=L.groups.find(g=>home&&g.tabs.some(t=>home.tabs.includes(t)));if(g)g.tabs.push(id);else L.groups.push({tabs:[id],f:1});}
  return L;}
/* the panels themselves, found once (while redrawing they are briefly off the page) */
const dkSecs={};const dkSec=id=>dkSecs[id]||(dkSecs[id]=document.querySelector(PANELS[id].sel));
/* (0.45, Kenn) the brush library and the brush settings are one panel everywhere except 3D Paint, where the settings keep their own panel beside the colour */
function brushMergeSync(){const tool=$('#toolSec'),bb=$('#brushBody'),title=dk.toolTitle;if(!tool||!bb)return;const sep=ui.mode==='p3d',home=$('#hBrush'),pw=$('#brushPrev')&&$('#brushPrev').parentNode;
  if(sep){if(bb.parentNode!==tool)tool.append(bb);const ht=$('#hTool');if(title&&ht&&title.parentNode!==ht)ht.prepend(title);}
  else if(pw){if(bb.previousElementSibling!==pw)pw.after(bb);if(title&&home&&title.parentNode!==home)home.prepend(title);}}
/* ---- building the page structure once ---- */
function dkInit(){
  /* Tool settings get a panel of their own, split from the brush library */
  const bs=dkSec('brushes'),hb=$('#hBrush'),title=$('#brushTitle');dk.toolTitle=title;
  const tool=el('section',{class:'sec',id:'toolSec','aria-labelledby':'hTool'},el('div',{class:'sec-h',id:'hTool'},title));tool.append($('#brushBody'));bs.after(tool);hb.prepend(el('span',{text:'Brushes'}));
  const panel=document.querySelector('aside.panel');panel.id='dock';panel.setAttribute('aria-label','Panels');
  dk.park=el('div',{id:'dkPark',hidden:true});document.body.append(dk.park);for(const id of PANEL_IDS)dk.park.append(dkSec(id));panel.replaceChildren();
  dk.icons=el('nav',{id:'dkIcons','aria-label':'Panels kept as icons'});panel.before(dk.icons);
  const grip=el('div',{class:'tbgrip',title:'Drag to the other side of the window. Double-click for one or two columns.'});$('#tools').prepend(grip);
  grip.addEventListener('dblclick',()=>dkToolbar({cols:dk.L.tb.cols===2?1:2}));
  grip.addEventListener('pointerdown',e=>{if(dk.lock)return;e.preventDefault();const up=ev=>{window.removeEventListener('pointerup',up);const side=ev.clientX>window.innerWidth/2?'right':'left';if(side!==dk.L.tb.side)dkToolbar({side});};window.addEventListener('pointerup',up);});
  dkApply(dk.saved[dk.ws]?dkClone(dk.saved[dk.ws]):dkPreset(dk.ws),true);
  window.addEventListener('pointermove',dkDragMove);window.addEventListener('pointerup',dkDragEnd);
  new ResizeObserver(()=>{for(const f of dk.L.floats)dkKeepOnScreen(f);}).observe(document.body);}
/* ---- applying a layout ---- */
function dkApply(L,first){dk.L=dkFix(L);dkRender();if(!first)dkWorkspaceExtras();dkSave();}
function dkToolbar(o){Object.assign(dk.L.tb,o);dkRender();dkSave();resizeGL();fit();}
function dkGrid(){const L=dk.L,app=$('#app'),F=L.fold||{},shOn=!!(L.shelf&&dkAvail(L.shelf).length),hasDock=L.groups.some(g=>dkAvail(g).length)&&L.w>0,ic=L.icons.length?'38px':'0px',tw=F.tools?'26px':L.tb.cols===2?'82px':'46px';
  document.body.classList.toggle('tb2',L.tb.cols===2);document.body.classList.toggle('noopt',!L.opt);
  for(const k of ['dock','dock2','tools','opt','shelf'])app.classList.toggle('f-'+k,!!F[k]);
  const left=L.tb.side!=='right';
  const c2=dkCol2On()&&dk.col2.groups.some(g=>dkAvail(g).length)?(F.dock2?26:dk.col2.w)+'px':'0px';
  const dw=hasDock?(F.dock?26:L.w)+'px':'0px';
  app.style.gridTemplateColumns=left?`${tw} minmax(0,1fr) ${c2} ${ic} ${dw}`:`minmax(0,1fr) ${tw} ${c2} ${ic} ${dw}`;
  app.style.gridTemplateRows=`38px ${L.opt?(F.opt?'26px':'minmax(36px,auto)'):'0px'} minmax(0,1fr) auto ${shOn?(F.shelf?26:clamp(L.shelf.h||170,90,Math.max(90,window.innerHeight*.6))):0}px 26px`;
  /* (0.38.2, Kenn) like Substance: the shelf sits under the viewport only; the right-hand panels run all the way down */
  const sh='"shelf shelf dock2 icons dock"';
  app.style.gridTemplateAreas=left?`"head head head head head" "opt opt opt opt opt" "tools work dock2 icons dock" "tools tl dock2 icons dock" ${sh} "status status status status status"`:`"head head head head head" "opt opt opt opt opt" "work tools dock2 icons dock" "tl tools dock2 icons dock" ${sh} "status status status status status"`;}
/* ---- (0.30) fold arrows on every docked bar and column, and the bottom shelf ---- */
const DK_FOLDS=[['dock','#dock','Panels',()=>dk.L.groups.some(g=>dkAvail(g).length)&&dk.L.w>0,()=>['›','‹']],
  ['dock2','#dock2','Colour and brushes',()=>dkCol2On()&&dk.col2.groups.some(g=>dkAvail(g).length),()=>['›','‹']],
  ['tools','#tools','Tools',()=>true,()=>dk.L.tb.side==='right'?['›','‹']:['‹','›']],
  ['opt','#optBar','Tool options',()=>!!dk.L.opt,()=>['⌃','⌄']],
  ['shelf','#dkShelf','Shelf',()=>!!(dk.L.shelf&&dkAvail(dk.L.shelf).length),()=>['⌄','⌃']]];
function dkFoldSet(k,v){dk.L.fold=dk.L.fold||{};dk.L.fold[k]=v;dkRender();dkSave();if(typeof resizeGL==='function')requestAnimationFrame(()=>{resizeGL();if(typeof fit==='function')fit();});}
function dkFoldBtns(){const F=dk.L.fold||{};dk.fb=dk.fb||{};
  for(const [k,sel,lbl,present,glyph] of DK_FOLDS){const node=$(sel);if(!node)continue;let b=dk.fb[k];
    if(!b){b=dk.fb[k]=el('button',{class:'dkfold fb-'+k,type:'button'});b.style.gridArea=k==='opt'?'opt':k;$('#app').append(b);b.addEventListener('click',()=>dkFoldSet(k,!(dk.L.fold&&dk.L.fold[k])));}
    const on=present(),f=!!F[k],g=glyph();b.hidden=!on;b.textContent=f?g[1]:g[0];b.title=(f?'Show ':'Hide ')+lbl.toLowerCase();b.setAttribute('aria-label',b.title);b.setAttribute('aria-expanded',String(!f));
    node.classList.toggle('dkfolded',on&&f);node.dataset.lbl=lbl;}}
function dkShelfRender(){const L=dk.L,S=L.shelf;if(!dk.shelf){dk.shelf=el('aside',{class:'dkshelf',id:'dkShelf','aria-label':'Shelf'});$('#app').append(dk.shelf);}
  const on=dkAvail(S).length>0;dk.shelf.hidden=!on;dk.shelf.replaceChildren();if(!on)return;
  const bar=el('div',{class:'dkshbar',role:'separator','aria-orientation':'horizontal',title:'Drag to make the shelf taller (double-click: back to the usual height)'});
  bar.addEventListener('dblclick',()=>{if(dk.lock)return;S.h=170;dkGrid();dkSave();resizeGL();fit();});
  bar.addEventListener('pointerdown',e=>{if(dk.lock||e.button!==0||(L.fold&&L.fold.shelf))return;e.preventDefault();const h0=S.h||170,y0=e.clientY;document.body.classList.add('stvresize');
    const mv=ev=>{S.h=Math.round(clamp(h0-(ev.clientY-y0),90,Math.max(90,window.innerHeight*.6)));dkGrid();if(typeof resizeGL==='function')resizeGL();};
    const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);document.body.classList.remove('stvresize');dkSave();if(typeof fit==='function')fit();};window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);});
  dk.shelf.append(bar,dkGroup(S));}
/* in 3D Paint, Colour, Material, Brushes, Materials and Tool settings sit in a column of their own beside the
   viewport (dock2). Its tabs drag like any other: out of it, or other tabs into it (remembered in gs.dock col2). */
const DK_COL2=['color','matEd','shading','brushes','stencils','mats','textures','decals','envs','tool'];
const dkCol2On=()=>ui.mode==='p3d';
const dkC2Has=id=>dk.col2.groups.some(g=>g.tabs.includes(id));
const dkIn=id=>PANELS[id].avail(ui.mode)&&!(dkCol2On()&&dkC2Has(id));
const dkAvail=g=>(g._c2?g.tabs.filter(id=>PANELS[id].avail(ui.mode)):g.tabs.filter(id=>dkIn(id))).filter(id=>!(typeof isBeginner==='function'&&isBeginner()&&BEGINNER_HIDE_PANELS.includes(id)));
if(!dk.col2)dk.col2={w:320,groups:[{tabs:['matEd','tool','color'],f:1,_c2:true}]};
/* older saved columns: the Material tab joins Colour */
if(!dkC2Has('matEd')){const g=dk.col2.groups.find(g=>g.tabs.includes('color'))||dk.col2.groups[0];if(g)g.tabs.push('matEd');}
for(const g of dk.col2.groups)g._c2=true;
/* (0.33, Kenn) a panel keeps its scroll place when the dock is rebuilt (clicking a mask row brings Properties forward) */
function dkSecKey(v){if(!v)return '';if(v.id)return v.id;const d=v.querySelector('[id]');return d?d.id:'';}
function dkScrollSave(){const m={};for(const b of document.querySelectorAll('.dkbody')){const v=[...b.children].find(c=>!c.classList.contains('dk-off'));const k=dkSecKey(v);if(k&&b.scrollTop)m[k]=b.scrollTop;}return m;}
function dkScrollRestore(m){if(!m)return;for(const b of document.querySelectorAll('.dkbody')){const v=[...b.children].find(c=>!c.classList.contains('dk-off'));const k=dkSecKey(v);if(k&&m[k])b.scrollTop=m[k];}}
function dkRender(){brushMergeSync();const keepSc=dkScrollSave(),L=dk.L,dock=$('#dock');dkGrid();
  for(const id of PANEL_IDS){const s=dkSec(id);s.classList.remove('dk-off');}
  dock.replaceChildren();const gs=L.groups.filter(g=>dkAvail(g).length);
  gs.forEach((g,i)=>{if(i)dock.append(dkSplit(gs[i-1],g));dock.append(dkGroup(g));});
  if(!dk.wbar){dk.wbar=dkWidthBar();$('#app').append(dk.wbar);}dk.wbar.hidden=!gs.length||!(L.w>0);
  /* the second column (3D Paint) */
  if(!dk.dock2){dk.dock2=el('aside',{class:'panel',id:'dock2','aria-label':'Colour and brushes'});$('#app').append(dk.dock2);}
  dk.dock2.replaceChildren();dk.dock2.hidden=!dkCol2On();
  if(dkCol2On()){const g2=dk.col2.groups.filter(g=>dkAvail(g).length);g2.forEach((g,i)=>{if(i)dk.dock2.append(dkSplit(g2[i-1],g));dk.dock2.append(dkGroup(g));});}
  dkShelfRender();
  dk.icons.replaceChildren(...L.icons.filter(id=>dkIn(id)).map(id=>{const b=el('button',{class:'dkicon'+(dk.flyout===id?' on':''),title:PANELS[id].title,'aria-label':PANELS[id].title,'aria-pressed':String(dk.flyout===id)});
    b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+(PANELS[id].icon||'')+'</svg>';b.onclick=()=>dkFlyout(dk.flyout===id?null:id);b.addEventListener('pointerdown',e=>dkDragStart(e,id,{icons:true}));return b;}));
  for(const n of [...document.querySelectorAll('.dkfloat')])n.remove();
  for(const f of L.floats){if(f.pop){const pp=dk.pops.find(x=>x.f===f&&!x.win.closed);if(pp){dkPopEl(f,pp);continue;}f.pop=false;f.wasPop=true;}dkFloatEl(f);}
  if(dk.flyout&&!(L.icons.includes(dk.flyout)&&dkIn(dk.flyout)))dk.flyout=null;
  if(dk.flyout)dkFlyoutEl(dk.flyout);
  for(const id of PANEL_IDS){const s=dkSec(id);if(!s.parentElement||s.parentElement===dk.park||!s.isConnected)dk.park.append(s);}
  dkFoldBtns();if(dk.wbar)dk.wbar.hidden=dk.wbar.hidden||!!(L.fold&&L.fold.dock);
  dkScrollRestore(keepSc);requestAnimationFrame(()=>dkScrollRestore(keepSc));
  if(typeof resizeGL==='function')requestAnimationFrame(()=>{resizeGL();if(typeof drawSV==='function')drawSV();});}
function dkTabs(tabs,active,where,onPick){const strip=el('div',{class:'dktabs',role:'tablist'});
  for(const id of tabs){const on=id===active,b=el('button',{class:'dktab'+(on?' on':''),role:'tab','aria-selected':String(on),text:id==='tool'?(dk.toolTitle.textContent||'Tool settings'):PANELS[id].title});
    b.addEventListener('click',()=>onPick(id));if(!where.popped)b.addEventListener('pointerdown',e=>dkDragStart(e,id,where));strip.append(b);}
  const more=el('button',{class:'dkmore','aria-label':'Panel options',title:'Panel options',text:'⋯'});more.onclick=e=>dkMenu(e,active,where);strip.append(more);return strip;}
function dkGroup(g){const av=dkAvail(g);let a=av.includes(g.active)?g.active:av[0];
  /* a workspace tab that just became available (entering Bake, Convert…) comes to the front */
  /* (0.37.1) only when it has just become available: Bake Maps and Shader share the group with the 3D Paint tab and must be able to stay in front */
  const mp0=av.find(id=>PANELS[id].mode)||null,mp=mp0&&g._mp!==mp0?mp0:null;g._mp=mp0;if(mp)a=mp;
  /* keep the chosen tab when it is only hidden for now (Layers while in Animation), so it comes back to the front */
  if(mp||av.includes(g.active)||!g.active||!PANEL_IDS.includes(g.active))g.active=a;
  const body=el('div',{class:'dkbody'});for(const id of av){const s=dkSec(id);s.classList.toggle('dk-off',id!==a);body.append(s);}
  const box=el('div',{class:'dkgrp'+(g.min?' min':''),style:'flex:'+(g.min?'0 0 auto':g.f+' 1 0px')},dkTabs(av,a,{group:g,c2:!!g._c2},id=>{g.active=id;g.min=false;dkRender();dkSave();}),body);
  box.querySelector('.dktabs').addEventListener('dblclick',e=>{if(e.target.closest('.dktab')){g.min=!g.min;dkRender();dkSave();}});
  box._g=g;return box;}
/* the dock's left edge: drag to make the whole dock wider or narrower (double-click: back to the usual width) */
function dkSetWidth(w){dk.L.w=Math.round(clamp(w,220,Math.min(720,window.innerWidth*.6)));dkGrid();if(typeof resizeGL==='function'){resizeGL();fit();}if(typeof drawSV==='function')drawSV();}
function dkWidthBar(){const s=el('div',{class:'dkwidth',role:'separator','aria-orientation':'vertical','aria-label':'Dock width',title:'Drag to resize the dock'});
  s.addEventListener('dblclick',()=>{if(dk.lock)return;dkSetWidth(300);dkSave();});
  s.addEventListener('pointerdown',e=>{if(dk.lock||e.button!==0)return;e.preventDefault();const w0=dk.L.w,x0=e.clientX;document.body.classList.add('dkresizing');
    const mv=ev=>dkSetWidth(w0-(ev.clientX-x0));
    const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);document.body.classList.remove('dkresizing');dkSave();};window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);});
  return s;}
function dkSplit(a,b){const s=el('div',{class:'dksplit',role:'separator','aria-orientation':'horizontal',title:'Drag to resize'});
  s.addEventListener('pointerdown',e=>{if(dk.lock||a.min||b.min)return;e.preventDefault();const A=s.previousSibling,B=s.nextSibling,ha=A.getBoundingClientRect().height,hb=B.getBoundingClientRect().height,tot=a.f+b.f,y0=e.clientY;
    const mv=ev=>{const d=clamp(ev.clientY-y0,-ha+40,hb-40),na=(ha+d)/(ha+hb)*tot;a.f=na;b.f=tot-na;A.style.flex=a.f+' 1 0px';B.style.flex=b.f+' 1 0px';};
    const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);dkSave();};window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);});
  return s;}
/* ---- floating panels (inside the window) ---- */
function dkKeepOnScreen(f){f.x=clamp(f.x,0,Math.max(0,window.innerWidth-120));f.y=clamp(f.y,38,Math.max(38,window.innerHeight-60));}
function dkFloatEl(f){const av=f.tabs.filter(id=>dkIn(id));if(!av.length)return;const a=av.includes(f.active)?f.active:av[0];f.active=a;dkKeepOnScreen(f);
  const body=el('div',{class:'dkbody'});for(const id of av){const s=dkSec(id);s.classList.toggle('dk-off',id!==a);body.append(s);}
  const tabs=dkTabs(av,a,{float:f},id=>{f.active=id;dkRender();dkSave();});
  const dockBtn=el('button',{class:'dkmore',text:'⤓',title:'Back into the dock','aria-label':'Back into the dock',onclick:()=>{dk.L.floats=dk.L.floats.filter(x=>x!==f);dk.L.groups.push({tabs:f.tabs,f:1});dkApply(dk.L,true);}});
  const close=el('button',{class:'dkmore',text:'✕',title:'Close (Window menu brings it back)','aria-label':'Close',onclick:()=>{dk.L.floats=dk.L.floats.filter(x=>x!==f);dk.L.hidden.push(...f.tabs);dkApply(dk.L,true);}});
  const popBtn=el('button',{class:'dkmore',text:'⧉',title:'Its own window (for a second monitor)','aria-label':'Move to its own window',onclick:()=>dkPopOut(f)});
  tabs.append(popBtn,dockBtn,close);
  const grow=el('div',{class:'dkgrow',title:'Resize'});
  const w=el('div',{class:'dkfloat',style:`left:${f.x}px;top:${f.y}px;width:${f.w||300}px;height:${f.h||360}px`},tabs,body,grow);document.body.append(w);
  tabs.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();const x0=e.clientX-f.x,y0=e.clientY-f.y;
    const mv=ev=>{f.x=ev.clientX-x0;f.y=ev.clientY-y0;dkKeepOnScreen(f);w.style.left=f.x+'px';w.style.top=f.y+'px';};const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);dkSave();};
    window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);});
  grow.addEventListener('pointerdown',e=>{e.preventDefault();const x0=e.clientX,y0=e.clientY,W=f.w||300,H=f.h||360;
    const mv=ev=>{f.w=Math.max(200,W+ev.clientX-x0);f.h=Math.max(120,H+ev.clientY-y0);w.style.width=f.w+'px';w.style.height=f.h+'px';};const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);dkSave();};
    window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);});}
/* ---- the icon column: a click opens the panel beside it ---- */
function dkFlyout(id){dk.flyout=id;dkRender();}
function dkFlyoutEl(id){const b=[...dk.icons.children].find(x=>x.title===PANELS[id].title),r=(b||dk.icons).getBoundingClientRect(),s=dkSec(id);s.classList.remove('dk-off');
  const w=el('div',{class:'dkfloat flyout',style:`top:${Math.max(40,Math.min(r.top,window.innerHeight-420))}px;right:${window.innerWidth-dk.icons.getBoundingClientRect().left+4}px;width:300px;max-height:${window.innerHeight-90}px`},
    el('div',{class:'dktabs'},el('span',{class:'dktab on',text:PANELS[id].title}),el('button',{class:'dkmore',text:'✕','aria-label':'Close',onclick:()=>dkFlyout(null)})),el('div',{class:'dkbody'},s));
  document.body.append(w);}
document.addEventListener('pointerdown',e=>{if(dk.flyout&&!e.target.closest('.flyout,#dkIcons,#modal,.fontpop,#menuPop'))dkFlyout(null);},true);
/* ---- the ⋯ menu of a group ---- */
function dkMenu(e,id,where){const inShelf=dk.L.shelf.tabs.includes(id),items=[inShelf?['Back into the dock',()=>dkMove(id,{newGroup:dk.L.groups.length})]:['Move to the bottom shelf',()=>dkMove(id,{group:dk.L.shelf})],['Float “'+PANELS[id].title+'”',()=>dkMove(id,{float:{x:e.clientX-320,y:e.clientY+10}})],['Keep as an icon',()=>dkMove(id,{icons:true})],['Close',()=>dkMove(id,{hidden:true})]];
  if(where.group)items.push([where.group.min?'Unfold group':'Fold group',()=>{where.group.min=!where.group.min;dkRender();dkSave();}]);
  const pop=$('#menuPop');closeMenu();pop.replaceChildren(...items.map(([t,f])=>el('button',{class:'mi',role:'menuitem',onclick:()=>{pop.hidden=true;f();}},el('span'),el('span',{text:t}),el('span'))));
  pop.hidden=false;pop.style.left=Math.min(e.clientX,window.innerWidth-pop.offsetWidth-8)+'px';pop.style.top=(e.clientY+6)+'px';
  const off=ev=>{if(!pop.contains(ev.target)){pop.hidden=true;document.removeEventListener('pointerdown',off,true);}};setTimeout(()=>document.addEventListener('pointerdown',off,true),0);}
/* take a panel out of wherever it is and put it somewhere else */
function dkRemove(id){const L=dk.L;if(dkCol2On()){for(const g of dk.col2.groups)g.tabs=g.tabs.filter(t=>t!==id);dk.col2.groups=dk.col2.groups.filter(g=>g.tabs.length);}for(const g of L.groups)g.tabs=g.tabs.filter(t=>t!==id);if(L.shelf)L.shelf.tabs=L.shelf.tabs.filter(t=>t!==id);for(const f of L.floats)f.tabs=f.tabs.filter(t=>t!==id);L.icons=L.icons.filter(t=>t!==id);L.hidden=L.hidden.filter(t=>t!==id);if(dk.flyout===id)dk.flyout=null;}
function dkMove(id,to){const L=dk.L;dkRemove(id);
  if(to.group){to.group.tabs.splice(to.index==null?to.group.tabs.length:to.index,0,id);to.group.active=id;to.group.min=false;}
  else if(to.newGroup!=null){L.groups.splice(to.newGroup,0,{tabs:[id],active:id,f:1});}
  else if(to.newGroup2!=null){dk.col2.groups.splice(to.newGroup2,0,{tabs:[id],active:id,f:1,_c2:true});}
  else if(to.float){L.floats.push({tabs:[id],active:id,x:to.float.x,y:to.float.y,w:300,h:Math.min(420,window.innerHeight-120)});}
  else if(to.icons)L.icons.push(id);else if(to.hidden)L.hidden.push(id);
  if(!L.groups.some(g=>g.tabs.length)&&!to.group&&to.newGroup==null&&to.newGroup2==null&&L.icons.length===0)L.groups.push({tabs:[],f:1});
  dkApply(L,true);}
/* show a panel (Window menu, tests): brings it back into the dock and to the front */
function showPanel(id){if(id==='tool'&&ui.mode!=='p3d')id='brushes';const L=dk.L;if(dkCol2On()&&dkC2Has(id)){const g2=dk.col2.groups.find(g=>g.tabs.includes(id));if(g2){g2.active=id;g2.min=false;dkRender();return;}}let g=L.groups.find(g=>g.tabs.includes(id));const f=L.floats.find(f=>f.tabs.includes(id));
  if(f){f.active=id;dkRender();return;}if(!g&&L.shelf&&L.shelf.tabs.includes(id)){L.shelf.active=id;L.shelf.min=false;if(L.fold&&L.fold.shelf){L.fold.shelf=false;dkGrid();}dkRender();dkSave();return;}if(L.icons.includes(id)){dkFlyout(id);return;}
  if(!g){L.hidden=L.hidden.filter(t=>t!==id);const home=WS_PRESETS.painting.groups.findIndex(x=>x.tabs.includes(id));g=L.groups.find(x=>x.tabs.some(t=>(WS_PRESETS.painting.groups[home]||{tabs:[]}).tabs.includes(t)));
    if(g)g.tabs.push(id);else{g={tabs:[id],f:1};L.groups.push(g);}}
  g.active=id;g.min=false;dkRender();dkSave();}
function panelShown(id){const L=dk.L;if(dkCol2On()&&dkC2Has(id))return true;return L.groups.some(g=>g.tabs.includes(id))||(L.shelf&&L.shelf.tabs.includes(id))||L.floats.some(f=>f.tabs.includes(id))||L.icons.includes(id);}
function togglePanel(id){if(panelShown(id)&&!dk.L.icons.includes(id)){dkMove(id,{hidden:true});}else showPanel(id);}
/* ---- dragging a tab ---- */
function dkDragStart(e,id,where){if(dk.lock||e.button!==0)return;dk.drag={id,where,x:e.clientX,y:e.clientY,on:false,ghost:null,hint:null,to:null};}
/* where a dragged tab would land among the tabs of a group: how many of the others are to its left, and a bar to show it */
function dkTabSlot(gEl,g,id,x){const strip=gEl.querySelector('.dktabs'),sr=strip.getBoundingClientRect(),btns=[...strip.querySelectorAll('.dktab')].filter((b,i)=>g.tabs[i]!==id);
  let n=0;for(const b of btns){const r=b.getBoundingClientRect();if(x>r.left+r.width/2)n++;}
  const at=n===0?(btns[0]?btns[0].getBoundingClientRect().left:sr.left):btns[n-1].getBoundingClientRect().right;
  return {index:n,box:{left:at-1,top:sr.top,width:3,height:sr.height}};}
function dkDragMove(e){const d=dk.drag;if(!d)return;if(!d.on){if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;d.on=true;d.ghost=el('div',{class:'dkghost',text:PANELS[d.id].title});d.hint=el('div',{class:'dkhint',hidden:true});document.body.append(d.ghost,d.hint);document.body.classList.add('dkdragging');}
  d.ghost.style.left=(e.clientX+12)+'px';d.ghost.style.top=(e.clientY+8)+'px';
  const t=document.elementFromPoint(e.clientX,e.clientY),dock=$('#dock');let to=null,box=null;
  if(t&&t.closest('#dkIcons')){to={icons:true};box=dk.icons.getBoundingClientRect();}
  else if(t&&t.closest('#dock')){const gEl=t.closest('.dkgrp'),grs=[...dock.querySelectorAll('.dkgrp')];
    if(gEl){const r=gEl.getBoundingClientRect(),g=gEl._g,i=dk.L.groups.indexOf(g);
      if(t.closest('.dktabs')){const T=dkTabSlot(gEl,g,d.id,e.clientX);to={group:g,index:T.index};box=T.box;}
      else if(e.clientY<r.top+r.height*.28){to={newGroup:i};box={left:r.left,top:r.top-4,width:r.width,height:10};}
      else if(e.clientY>r.bottom-r.height*.28){to={newGroup:i+1};box={left:r.left,top:r.bottom-6,width:r.width,height:10};}
      else{to={group:g};box=r;}}
    else if(grs.length){const r=dock.getBoundingClientRect();to={newGroup:dk.L.groups.length};box={left:r.left,top:r.bottom-12,width:r.width,height:10};}}
  else if(t&&t.closest('#dock2')&&dkCol2On()){const gEl=t.closest('.dkgrp'),d2=dk.dock2,G=dk.col2.groups;
    if(gEl){const r=gEl.getBoundingClientRect(),g=gEl._g,i=G.indexOf(g);
      if(t.closest('.dktabs')){const T=dkTabSlot(gEl,g,d.id,e.clientX);to={group:g,index:T.index};box=T.box;}
      else if(e.clientY<r.top+r.height*.28){to={newGroup2:i};box={left:r.left,top:r.top-4,width:r.width,height:10};}
      else if(e.clientY>r.bottom-r.height*.28){to={newGroup2:i+1};box={left:r.left,top:r.bottom-6,width:r.width,height:10};}
      else{to={group:g};box=r;}}
    else{const r=d2.getBoundingClientRect();to={newGroup2:G.length};box={left:r.left,top:r.bottom-12,width:r.width,height:10};}}
  else if(t&&t.closest('#dkShelf')){const gEl=t.closest('.dkgrp'),S=dk.L.shelf;
    if(gEl&&t.closest('.dktabs')){const T=dkTabSlot(gEl,S,d.id,e.clientX);to={group:S,index:T.index};box=T.box;}else{to={group:S};box=(gEl||dk.shelf).getBoundingClientRect();}}
  else if(t&&t.closest('#workWrap')&&e.clientY>$('#workWrap').getBoundingClientRect().bottom-Math.min(90,$('#workWrap').getBoundingClientRect().height*.2)){const r=$('#workWrap').getBoundingClientRect();to={group:dk.L.shelf};box={left:r.left,top:r.bottom-8,width:r.width,height:10};}
  else if(t&&t.closest('.dkfloat:not(.flyout)')){/* onto another floating panel: join it */const fe=t.closest('.dkfloat');const f=dk.L.floats[[...document.querySelectorAll('.dkfloat:not(.flyout)')].indexOf(fe)];if(f){to={floatJoin:f};box=fe.getBoundingClientRect();}}
  else{to={float:{x:e.clientX-40,y:e.clientY-12}};}
  d.to=to;if(box){Object.assign(d.hint.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px'});d.hint.hidden=false;}else d.hint.hidden=true;}
function dkDragEnd(){const d=dk.drag;dk.drag=null;if(!d||!d.on)return;d.ghost.remove();d.hint.remove();document.body.classList.remove('dkdragging');
  if(!d.to)return;if(d.to.floatJoin){const f=d.to.floatJoin;if(f.tabs.includes(d.id))return;dkRemove(d.id);f.tabs.push(d.id);f.active=d.id;dkApply(dk.L,true);return;}
  if(d.to.group&&d.to.group.tabs.includes(d.id)&&d.to.group.tabs.length===1)return;
  dkMove(d.id,d.to);}
/* ---- workspaces ---- */
function wsList(){return [...Object.keys(WS_PRESETS).map(k=>[k,WS_PRESETS[k].name]),...Object.keys(dk.custom).map(k=>[k,dk.custom[k].name||k])];}
function setWorkspace(ws,quiet){if(!WS_PRESETS[ws]&&!dk.custom[ws])return;dk.ws=ws;dk.flyout=null;dkApply(dk.saved[ws]?dkClone(dk.saved[ws]):dkPreset(ws));syncWsSel();if(!quiet)toast('Workspace: '+(WS_PRESETS[ws]||dk.custom[ws]).name+'.');}
function resetWorkspace(){delete dk.saved[dk.ws];dk.flyout=null;dkApply(dkPreset(dk.ws));toast('Workspace reset.');}
function saveWorkspaceAs(){const inp=el('input',{type:'text',value:'My workspace','aria-label':'Name'});
  openDialog({title:'Save workspace',body:el('div',{class:'dlg-grid'},el('p',{class:'note',text:'Saves where every panel is, the toolbar and the options bar.'}),inp),okLabel:'Save',onOk(){const n=inp.value.trim();if(!n)return false;const id='c_'+n.toLowerCase().replace(/[^a-z0-9]+/g,'_');
    dk.custom[id]=Object.assign(dkClone(dk.L),{name:n});delete dk.saved[id];dk.ws=id;dkSave();syncWsSel();toast('Saved the workspace “'+n+'”.');}});setTimeout(()=>{inp.focus();inp.select();},0);}
function deleteWorkspace(){if(!dk.custom[dk.ws]){toast('Built-in workspaces can be reset, not deleted.');return;}const n=dk.custom[dk.ws].name;delete dk.custom[dk.ws];delete dk.saved[dk.ws];setWorkspace('painting');toast('Deleted the workspace “'+n+'”.');}
function toggleLockPanels(){dk.lock=!dk.lock;dkSave();document.body.classList.toggle('dklock',dk.lock);toast(dk.lock?'Panels locked: tabs and bars can’t be dragged.':'Panels unlocked.');}
/* 3D view and painting on the model for Texturing and 3D Paint */
function dkWorkspaceExtras(){const x=dk.L.extra||{};if(typeof toggle3D!=='function')return;
  if(x.v3&&ui.mode==='paint'){if(!v3.on)toggle3D(true);if(!v3.pop)$('#work').style.setProperty('--pane3d',Math.round($('#work').clientWidth*x.v3)+'px');if(x.paint3d)v3.paintOn=true;if(typeof build3dPane==='function')build3dPane();}
  else if(!x.v3&&v3.on&&ui.mode==='paint'&&dk.prevExtra&&dk.prevExtra.v3)toggle3D(false);
  dk.prevExtra=x;resizeGL();fit();requestRender(true);}
function syncWsSel(){const s=$('#wsSel');if(!s)return;s.replaceChildren(...wsList().map(([k,n])=>el('option',{value:k,text:n})),el('option',{value:'',disabled:true,text:'──────────'}),
  el('option',{value:':save',text:'Save workspace…'}),el('option',{value:':reset',text:'Reset this workspace'}),el('option',{value:':delete',text:'Delete this workspace'}));s.value=dk.ws;}
function dkModeChanged(){if(dk.L)dkRender();}
/* bring a panel to the front of its group if it is in the dock (without moving it) */
function dkActivate(id){if(!dk.L)return;const g=(dkCol2On()&&dk.col2.groups.find(g=>g.tabs.includes(id)))||dk.L.groups.find(g=>g.tabs.includes(id));if(g&&g.active!==id){g.active=id;g.min=false;dkRender();}}

/* ---- panels in windows of their own (a second monitor) ---- */
dk.pops=[];dk.popSeq=0;
function dkPopQuery(s){for(const p of dk.pops){if(p.win.closed)continue;try{const e=p.win.document.querySelector(s);if(e)return e;}catch(e){}}return null;}
/* the look of the main window: stylesheets, theme colours, body classes */
function dkPopSync(){for(const p of dk.pops){if(p.win.closed)continue;const d=p.win.document;d.documentElement.style.cssText=document.documentElement.style.cssText;d.body.className=document.body.className;}}
function dkPopOut(f,quiet){const W=Math.round(f.w||320),H=Math.round(f.h||440);
  const feat='width='+W+',height='+H+(f.sx!=null?',left='+Math.round(f.sx)+',top='+Math.round(f.sy):'');
  let w=null;try{w=window.open('about:blank','gspanel'+(++dk.popSeq),feat);}catch(e){}
  if(!w){if(!quiet)toast('The window could not be opened.');f.pop=false;dkRender();return false;}
  const d=w.document;d.title='Gouache Studio — '+f.tabs.map(id=>PANELS[id].title).join(', ');
  for(const st of document.querySelectorAll('style,link[rel=stylesheet]'))d.head.append(d.importNode(st,true));
  d.body.style.cssText='margin:0;height:100vh;overflow:hidden;background:var(--panel);color:var(--text);font:12.5px/1.4 var(--ui)';
  const p={f,win:w};dk.pops.push(p);f.pop=true;delete f.wasPop;dkPopSync();
  /* keys typed in the panel window work as in the main window (unless typing in a field) */
  for(const type of ['keydown','keyup'])w.addEventListener(type,e=>{const t=e.target,tag=(t.tagName||'').toLowerCase();if((tag==='input'&&!['range','checkbox','radio','button'].includes(t.type))||tag==='textarea'||tag==='select')return;
    const ev=new KeyboardEvent(type,{key:e.key,code:e.code,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey,repeat:e.repeat,bubbles:true,cancelable:true});window.dispatchEvent(ev);if(ev.defaultPrevented)e.preventDefault();});
  /* drags that started in the panel window (layer rows, sliders) keep following the pointer */
  for(const type of ['pointermove','pointerup','pointercancel'])w.addEventListener(type,e=>{window.dispatchEvent(new PointerEvent(type,{clientX:e.clientX,clientY:e.clientY,screenX:e.screenX,screenY:e.screenY,pointerId:e.pointerId,pointerType:e.pointerType,button:e.button,buttons:e.buttons,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey,pressure:e.pressure}));});
  w.addEventListener('resize',()=>{f.w=w.innerWidth;f.h=w.innerHeight;if(typeof drawSV==='function')drawSV();if(typeof schedulePreview==='function')schedulePreview();dkSave();});
  p.timer=setInterval(()=>{if(w.closed){clearInterval(p.timer);return;}if(w.screenX!==f.sx||w.screenY!==f.sy){f.sx=w.screenX;f.sy=w.screenY;dkSave();}},1000);
  w.addEventListener('pagehide',()=>{if(!p.closing)dkPopClosed(p);});
  dkRender();dkSave();if(!quiet)toast('The panel is in its own window: drag it to your other monitor. Close it (or press ⤓ there) to bring it back.');return true;}
function dkPopEl(f,p){const d=p.win.document,av=f.tabs.filter(id=>dkIn(id));
  if(!av.length){d.body.replaceChildren(d.createTextNode(''));const n=el('p',{class:'note',style:'padding:16px',text:'Not used in this tab of the app.'});d.body.append(n);return;}
  const a=av.includes(f.active)?f.active:av[0];f.active=a;const body=el('div',{class:'dkbody',style:'flex:1;min-height:0'});for(const id of av){const s=dkSec(id);s.classList.toggle('dk-off',id!==a);body.append(s);}
  const tabs=dkTabs(av,a,{float:f,popped:true},id=>{f.active=id;dkRender();dkSave();});
  tabs.append(el('button',{class:'dkmore',text:'⤓',title:'Back into the main window','aria-label':'Back into the main window',onclick:()=>{p.closing=true;dkPopClosed(p,true);try{p.win.close();}catch(e){}}}));
  d.body.replaceChildren(el('div',{style:'display:flex;flex-direction:column;height:100vh'},tabs,body));}
/* the panel window was closed: its panels come back as a floating panel (or into the dock with ⤓) */
function dkPopClosed(p,toDock){clearInterval(p.timer);dk.pops=dk.pops.filter(x=>x!==p);const f=p.f;f.pop=false;
  for(const id of f.tabs){const s=dkSec(id);document.adoptNode(s);dk.park.append(s);}
  if(toDock){dk.L.floats=dk.L.floats.filter(x=>x!==f);dk.L.groups.push({tabs:f.tabs,f:1});}
  dkApply(dk.L,true);}
/* windows that were open when the app closed come back (the desktop app allows it; a browser may not) */
function dkReopenPops(){for(const f of dk.L.floats)if(f.wasPop&&!dk.pops.some(p=>p.f===f)){delete f.wasPop;if(platform.isDesktop)dkPopOut(f,true);}dkRender();}
window.addEventListener('beforeunload',()=>{for(const p of dk.pops){p.closing=true;try{p.win.close();}catch(e){}}});

/* the workspace a tab uses (the one last picked while in it, else its own) */
function wsForMode(m){const w=dk.modeWs[m]||WS_MODE_DEF[m]||'painting';return WS_PRESETS[w]||dk.custom[w]?w:(WS_MODE_DEF[m]||'painting');}
function dkModeWs(){const w=wsForMode(ui.mode);if(w!==dk.ws){if(dk.L)dkSave();setWorkspace(w,true);}else syncWsSel();}
{const sm=setMode;setMode=function(m,q){const r=sm(m,q);if(r!==false&&ui.mode===m)dkModeWs();return r;};}
