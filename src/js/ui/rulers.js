/* ================= Rulers and guides (0.26.1) =================
   Like Photoshop: Ctrl+R shows rulers along the top and left of the canvas (units px, in, cm, mm or pt: right-click
   a ruler, or click the corner). Drag out of a ruler to make a guide (from the top ruler: a horizontal guide). With
   the Move tool, or holding Ctrl with any tool, drag a guide to move it, or back onto a ruler to delete it.
   Selections, crop, shapes, gradients and arrays snap to guides and the canvas edges. View menu: Show guides
   (Ctrl+;), Snap to guides, Lock guides (Alt+Ctrl+;), New guide…, Clear guides. Guides are part of the document
   (saved in .gouache files, with undo); the rulers and settings are remembered. */
const RUL=20,GD_NEAR=5,GD_SNAP=8;
const rl={on:false,unit:'px',show:true,snap:true,lock:false,drag:null,hover:null,sig:''};
try{Object.assign(rl,JSON.parse(localStorage.getItem('gs.rulers')||'{}'),{drag:null,hover:null,sig:''});}catch(e){}
function rlStore(){try{localStorage.setItem('gs.rulers',JSON.stringify({on:rl.on,unit:rl.unit,show:rl.show,snap:rl.snap,lock:rl.lock}));}catch(e){}}
const RL_UNITS=[['px','Pixels'],['in','Inches'],['cm','Centimetres'],['mm','Millimetres'],['pt','Points']];
const rlPPU=u=>{const d=doc.dpi||72;return {px:1,in:d,cm:d/2.54,mm:d/25.4,pt:d/72}[u]||1;};
const guides=()=>doc.guides||(doc.guides=[]);
const rlH=el('canvas',{class:'ruler rh','aria-hidden':'true'}),rlV=el('canvas',{class:'ruler rv','aria-hidden':'true'}),
  rlC=el('button',{class:'ruler rc',title:'Ruler units',text:'px','aria-label':'Ruler units'}),gdC=el('canvas',{class:'guidecv','aria-hidden':'true'});
stage.append(gdC,rlH,rlV,rlC);
const rlVis=()=>rl.on&&ui.mode!=='p3d';
function rlSync(){for(const e of [rlH,rlV,rlC])e.hidden=!rlVis();rlC.textContent=rl.unit;rl.sig='';}
function toggleRulers(on){rl.on=on===undefined?!rl.on:!!on;rlStore();rlSync();toast(rl.on?'Rulers on (Ctrl+R hides them). Drag from a ruler to make a guide.':'Rulers off.');}
function rlSize(c,w,h){const r=devicePixelRatio||1;if(c.width!==Math.round(w*r)||c.height!==Math.round(h*r)){c.width=Math.round(w*r);c.height=Math.round(h*r);}c.style.width=w+'px';c.style.height=h+'px';const g=c.getContext('2d');g.setTransform(r,0,0,r,0,0);return g;}
function rlCol(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()||'#888';}
/* ticks: a round step in the current unit, at least 60 px apart on screen for numbers */
function rlStep(){const ppu=rlPPU(rl.unit)*view.zoom;for(let e=-3;e<7;e++)for(const m of [1,2,5]){const s=m*Math.pow(10,e);if(s*ppu>=60)return s;}return 1e6;}
function rlDraw(g,len,horiz){const bg=rlCol('--panel'),ln=rlCol('--line-2'),tx=rlCol('--muted');g.fillStyle=bg;g.fillRect(0,0,horiz?len:RUL,horiz?RUL:len);
  g.strokeStyle=ln;g.beginPath();if(horiz){g.moveTo(0,RUL-.5);g.lineTo(len,RUL-.5);}else{g.moveTo(RUL-.5,0);g.lineTo(RUL-.5,len);}g.stroke();
  const ppu=rlPPU(rl.unit),z=view.zoom,off=horiz?view.x:view.y,step=rlStep(),sub=step*ppu*z>=120?10:step*ppu*z>=60?5:2,
    u0=(-off/z)/ppu,u1=((len-off)/z)/ppu;g.fillStyle=tx;g.font='10px '+(rlCol('--ui')||'sans-serif');g.strokeStyle=tx;g.beginPath();
  for(let u=Math.floor(u0/step)*step;u<=u1+step;u+=step/sub){const k=Math.round(u/(step/sub)),s=off+u*ppu*z,major=k%sub===0,h=major?RUL-2:(k%(sub/2)===0&&sub===10?7:4);
    if(s<0||s>len)continue;const p=Math.round(s)+.5;if(horiz){g.moveTo(p,RUL);g.lineTo(p,RUL-h);}else{g.moveTo(RUL,p);g.lineTo(RUL-h,p);}
    if(major){const t=String(+(Math.round(u/step)*step).toFixed(3));if(horiz)g.fillText(t,p+3,9);else{g.save();g.translate(9,p+3);g.rotate(-Math.PI/2);g.textAlign='right';g.fillText(t,0,0);g.restore();}}}
  g.stroke();
  /* where the pointer is */
  if(lastPos){const q=horiz?lastPos[0]:lastPos[1];if(q>=0&&q<=len){g.strokeStyle=rlCol('--accent');g.beginPath();if(horiz){g.moveTo(q+.5,0);g.lineTo(q+.5,RUL);}else{g.moveTo(0,q+.5);g.lineTo(RUL,q+.5);}g.stroke();}}}
function gdScreen(G){return G.o==='h'?view.y+G.p*view.zoom:view.x+G.p*view.zoom;}
function gdDraw(){const W=stage.clientWidth,H=stage.clientHeight,g=rlSize(gdC,W,H);g.clearRect(0,0,W,H);
  const list=guides().slice();if(rl.drag&&rl.drag.g&&!list.includes(rl.drag.g))list.push(rl.drag.g);
  if(!rl.show&&!rl.drag)return;
  for(const G of list){const s=Math.round(gdScreen(G))+.5,act=(rl.drag&&rl.drag.g===G)||rl.hover===G;g.strokeStyle=act?'#8fe3ff':'#29b6f6';g.lineWidth=1;if(rl.lock&&!act)g.setLineDash([4,3]);else g.setLineDash([]);
    g.beginPath();if(G.o==='h'){g.moveTo(0,s);g.lineTo(W,s);}else{g.moveTo(s,0);g.lineTo(s,H);}g.stroke();}
  if(rl.drag&&rl.drag.g){const G=rl.drag.g,u=G.p/rlPPU(rl.unit),t=(rl.unit==='px'?Math.round(u):u.toFixed(2))+' '+rl.unit,s=gdScreen(G);
    g.font='11px sans-serif';const tw=g.measureText(t).width+10,x=G.o==='h'?(lastPos?lastPos[0]+14:40):s+8,y=G.o==='h'?s-8:(lastPos?lastPos[1]+22:40);
    g.fillStyle='rgba(0,0,0,.75)';g.fillRect(x,y-13,tw,18);g.fillStyle='#fff';g.fillText(t,x+5,y);}}
function rlFrame(){const W=stage.clientWidth,H=stage.clientHeight,
    sig=[view.x,view.y,view.zoom,W,H,rlVis(),ui.mode,rl.show,rl.lock,rl.unit,doc.dpi,JSON.stringify(doc.guides||[]),lastPos&&lastPos.join(),rl.hover&&rl.hover.p,rl.drag&&rl.drag.g&&rl.drag.g.p,document.documentElement.style.cssText.length].join('|');
  if(sig!==rl.sig){rl.sig=sig;if(rlH.hidden===rlVis())rlSync();gdDraw();if(rlVis()){rlDraw(rlSize(rlH,Math.max(0,W-RUL),RUL),Math.max(0,W-RUL),true);
      const gv=rlSize(rlV,RUL,Math.max(0,H-RUL));gv.save();gv.translate(0,-RUL);rlDraw(gv,H,false);gv.restore();}}
  requestAnimationFrame(rlFrame);}
/* the top ruler starts after the corner, so it draws with the view shifted by RUL */
{const d0=rlDraw;rlDraw=function(g,len,horiz){if(horiz){g.save();g.translate(-RUL,0);d0(g,len+RUL,true);g.restore();}else d0(g,len,false);};}
/* ---------- guides: add, move, delete (with undo) ---------- */
function gdRecord(label,before){const after=JSON.stringify(guides());if(after===before)return;const b=JSON.parse(before),a=JSON.parse(after);
  pushUndo({label,refs:[],undo(){doc.guides=JSON.parse(JSON.stringify(b));rl.sig='';},redo(){doc.guides=JSON.parse(JSON.stringify(a));rl.sig='';}});}
function gdAdd(o,p){const before=JSON.stringify(guides());guides().push({o,p});gdRecord('New guide',before);rl.sig='';}
function gdClear(){if(!guides().length){toast('There are no guides.');return;}const before=JSON.stringify(guides());doc.guides=[];gdRecord('Clear guides',before);rl.sig='';toast('Guides cleared.');}
function gdAt(sx,sy){if(!rl.show)return null;let best=null,bd=GD_NEAR+1;for(const G of guides()){const d=Math.abs((G.o==='h'?sy:sx)-gdScreen(G));if(d<bd){bd=d;best=G;}}return best;}
function gdPos(e,o){const r=stage.getBoundingClientRect(),s=o==='h'?e.clientY-r.top:e.clientX-r.left,p=(s-(o==='h'?view.y:view.x))/view.zoom;
  /* whole pixels; Shift snaps to the ruler's ticks */
  if(e.shiftKey){const st=rlStep()*rlPPU(rl.unit)/5;return Math.round(p/st)*st;}return Math.round(p);}
function gdOnRuler(e,o){const r=stage.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;return o==='h'?y<RUL||y<0:x<RUL||x<0;}
function gdDragStart(e,G,isNew){e.preventDefault();e.stopImmediatePropagation();const t=e.currentTarget;try{t.setPointerCapture(e.pointerId);}catch(err){}
  rl.drag={g:G,isNew,before:JSON.stringify(guides()),id:e.pointerId,t,moved:isNew};
  const mv=ev=>{if(ev.pointerId!==rl.drag.id)return;const r=stage.getBoundingClientRect();lastPos=[ev.clientX-r.left,ev.clientY-r.top];rl.drag.moved=true;G.p=gdPos(ev,G.o);rl.sig='';},
    up=ev=>{if(ev.pointerId!==rl.drag.id)return;t.removeEventListener('pointermove',mv);t.removeEventListener('pointerup',up);t.removeEventListener('pointercancel',up);
      const D=rl.drag;rl.drag=null;const gone=gdOnRuler(ev,G.o);const i=guides().indexOf(G);
      if(gone){if(i>=0)guides().splice(i,1);if(!D.isNew)gdRecord('Delete guide',D.before);}
      else if(D.isNew){guides().push(G);gdRecord('New guide',D.before);if(!rl.show){rl.show=true;rlStore();}}
      else if(D.moved)gdRecord('Move guide',D.before);rl.sig='';};
  t.addEventListener('pointermove',mv);t.addEventListener('pointerup',up);t.addEventListener('pointercancel',up);}
rlH.addEventListener('pointerdown',e=>{if(e.button!==0)return;gdDragStart(e,{o:'h',p:gdPos(e,'h')},true);});
rlV.addEventListener('pointerdown',e=>{if(e.button!==0)return;gdDragStart(e,{o:'v',p:gdPos(e,'v')},true);});
const gdCanGrab=e=>rl.show&&!rl.lock&&(ui.tool==='move'||e.ctrlKey||e.metaKey)&&!(typeof xf!=='undefined'&&xf&&!xf.move)&&['paint','anim','brush'].includes(ui.mode);
cv.addEventListener('pointerdown',e=>{if(e.button!==0||spaceDown||!gdCanGrab(e))return;const r=stage.getBoundingClientRect(),G=gdAt(e.clientX-r.left,e.clientY-r.top);if(G)gdDragStart(e,G,false);},true);
cv.addEventListener('pointermove',e=>{if(rl.drag)return;const r=stage.getBoundingClientRect(),G=gdCanGrab(e)?gdAt(e.clientX-r.left,e.clientY-r.top):null;
  if(G!==rl.hover){rl.hover=G;document.body.classList.toggle('gdhov-h',!!G&&G.o==='h');document.body.classList.toggle('gdhov-v',!!G&&G.o==='v');rl.sig='';}});
/* units: right-click a ruler or click the corner */
function rlUnitMenu(e){e.preventDefault();const pop=$('#menuPop');closeMenu();
  pop.replaceChildren(el('div',{class:'mh',text:'Ruler units'}),...RL_UNITS.map(([u,n])=>el('button',{class:'mi',role:'menuitem',onclick:()=>{pop.hidden=true;rl.unit=u;rlStore();rlSync();}},el('span',{text:rl.unit===u?'✓':''}),el('span',{text:n}),el('span'))),
    el('div',{class:'msep'}),el('button',{class:'mi',role:'menuitem',onclick:()=>{pop.hidden=true;dlgDPI();}},el('span'),el('span',{text:'Resolution ('+(doc.dpi||72)+' DPI)…'}),el('span')));
  pop.hidden=false;pop.style.left=Math.min(e.clientX,innerWidth-pop.offsetWidth-8)+'px';pop.style.top=Math.min(e.clientY+4,innerHeight-pop.offsetHeight-8)+'px';
  const off=ev=>{if(!pop.contains(ev.target)){pop.hidden=true;document.removeEventListener('pointerdown',off,true);}};setTimeout(()=>document.addEventListener('pointerdown',off,true),0);}
rlH.addEventListener('contextmenu',rlUnitMenu);rlV.addEventListener('contextmenu',rlUnitMenu);rlC.addEventListener('click',rlUnitMenu);
function dlgDPI(){let d=doc.dpi||72;const inp=el('input',{type:'number',min:1,max:9600,value:d,'aria-label':'Pixels per inch'});
  openDialog({title:'Resolution',body:el('div',{class:'dlg-grid'},el('label',{},'Pixels per inch (DPI) ',inp),el('p',{class:'note',text:'Only changes how inches and centimetres are measured (rulers, print size). The pixels stay the same.'})),okLabel:'OK',
    onOk(){const v=Math.round(+inp.value);if(v>0){doc.dpi=v;rl.sig='';updateStatus&&updateStatus();}}});}
function dlgNewGuide(){let o='v',unit=rl.unit;const inp=el('input',{type:'number',step:'any',value:0,'aria-label':'Position'});
  const body=el('div',{class:'dlg-grid'},seg([['v','Vertical'],['h','Horizontal']],o,v=>{o=v;},'Orientation'),el('label',{},'Position ',inp,' ',el('span',{text:unit})),
    el('p',{class:'note',text:'Measured from the '+'left (vertical) or top (horizontal) edge of the canvas.'}));
  openDialog({title:'New guide',body,okLabel:'Add',onOk(){gdAdd(o,+inp.value*rlPPU(unit));if(!rl.show){rl.show=true;rlStore();}}});}
/* snapping for selections, crop, shapes, gradients and arrays (painting never snaps) */
const GD_SNAP_TOOLS=['crop','shape','gradient','array'];
function gdSnapOn(){return rl.snap&&(GD_SNAP_TOOLS.includes(ui.tool)||isSelTool(ui.tool))&&ui.mode!=='p3d'&&!(ptr&&(ptr.mode==='selmove'||ptr.mode==='lasso'));}
function gdSnap(x,y){const tol=GD_SNAP/view.zoom;let bx=null,dx=tol,by=null,dy=tol;
  const xs=[0,doc.w],ys=[0,doc.h];if(rl.show)for(const G of guides())(G.o==='v'?xs:ys).push(G.p);
  for(const v of xs){const d=Math.abs(x-v);if(d<dx){dx=d;bx=v;}}for(const v of ys){const d=Math.abs(y-v);if(d<dy){dy=d;by=v;}}
  return [bx===null?x:bx,by===null?y:by];}
/* keys: Ctrl+; guides, Alt+Ctrl+; lock */
window.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.key!==';'||isTypingTarget(e.target))return;e.preventDefault();e.stopImmediatePropagation();
  if(e.altKey){rl.lock=!rl.lock;toast(rl.lock?'Guides locked.':'Guides unlocked.');}else{rl.show=!rl.show;toast(rl.show?'Guides shown.':'Guides hidden.');}rlStore();rl.sig='';},true);
/* View menu */
MENUS.View.splice(MENUS.View.indexOf('-')+0,0,'-',['Rulers','rulers','Ctrl+R'],['Show guides','guidesShow','Ctrl+;'],['Snap to guides','guidesSnap'],['Lock guides','guidesLock','Alt+Ctrl+;'],['New guide…','guideNew'],['Clear guides','guidesClear']);
Object.assign(actions,{rulers:()=>toggleRulers(),guidesShow:()=>{rl.show=!rl.show;rlStore();rl.sig='';},guidesSnap:()=>{rl.snap=!rl.snap;rlStore();},guidesLock:()=>{rl.lock=!rl.lock;rlStore();rl.sig='';},guideNew:dlgNewGuide,guidesClear:gdClear});
Object.assign(checked,{rulers:()=>rl.on,guidesShow:()=>rl.show,guidesSnap:()=>rl.snap,guidesLock:()=>rl.lock});
rlSync();requestAnimationFrame(rlFrame);
