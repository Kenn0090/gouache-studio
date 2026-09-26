/* ================= Selection tools: marquee, lasso, polygonal lasso, magic wand ================= */
const SEL_TOOLS=['marquee','lasso','wand'];
const isSelTool=t=>SEL_TOOLS.includes(t);
let polyLasso=null; /* polygonal lasso in progress: {pts,mode,last,time} */
function modeFromMods(e){if(e.shiftKey&&e.altKey)return 'int';if(e.shiftKey)return 'add';if(e.altKey)return 'sub';return ui.selMode;}
function cancelSelTool(){polyLasso=null;if(ptr&&(ptr.mode==='marq'||ptr.mode==='lasso'||ptr.mode==='selmove')){if(ptr.mode==='selmove'&&ptr.snap){blit(ptr.snap,sel.t,0,0,doc.w,doc.h,0,0);release(ptr.snap);}ptr=null;}drawSelOverlay();}
const toScreen=(x,y)=>[view.x+x*view.zoom,view.y+y*view.zoom];

/* pointer down on the canvas with a selection tool (called from view-input) */
function selPointerDown(e,ix,iy){
  if(sel.quick){toast('Quick mask is on. Paint with a brush, or press Q to turn it into a selection.');return;}
  if(preview){toast('Apply or cancel the open filter first.');return;}
  const t=ui.tool;
  if(t==='wand'){magicWand(ix,iy,modeFromMods(e));return;}
  if(t==='lasso'&&ui.lasso==='poly'){polyClick(e,ix,iy);return;}
  const noMods=!e.shiftKey&&!e.altKey&&!e.ctrlKey&&!e.metaKey;
  if(noMods&&sel.active&&selValueAt(ix,iy)>=.5){const snap=acquire();blit(sel.t,snap,0,0,doc.w,doc.h,0,0);
    ptr={mode:'selmove',id:e.pointerId,sx:ix,sy:iy,dx:0,dy:0,snap,bb:sel.bb.slice()};return;}
  const mode=modeFromMods(e);
  if(t==='marquee')ptr={mode:'marq',id:e.pointerId,x0:ix,y0:iy,x1:ix,y1:iy,selMode:mode,startShift:e.shiftKey,startAlt:e.altKey,rect:null};
  else ptr={mode:'lasso',id:e.pointerId,pts:[ix,iy],selMode:mode,startAlt:e.altKey,straight:false,cur:[ix,iy]};
  drawSelOverlay();}
function selPointerMove(e,ix,iy){
  if(ptr.mode==='selmove'){const dx=Math.round(ix-ptr.sx),dy=Math.round(iy-ptr.sy);if(dx===ptr.dx&&dy===ptr.dy)return;ptr.dx=dx;ptr.dy=dy;shiftSel(ptr.snap,dx,dy);requestRender();return;}
  if(ptr.mode==='marq'){ptr.x1=ix;ptr.y1=iy;ptr.rect=marqRect(e);drawSelOverlay();return;}
  if(ptr.mode==='lasso'){ptr.cur=[ix,iy];const straight=e.altKey&&!ptr.startAlt;
    if(ptr.straight&&!straight)ptr.pts.push(ix,iy);ptr.straight=straight;
    if(!straight){const n=ptr.pts.length,lx=ptr.pts[n-2],ly=ptr.pts[n-1];if(Math.hypot(ix-lx,iy-ly)*view.zoom>=1.5)ptr.pts.push(ix,iy);}
    drawSelOverlay();}}
function selPointerUp(e){const p=ptr;ptr=null;
  if(p.mode==='selmove'){const nb=rToDoc([p.bb[0]+p.dx,p.bb[1]+p.dy,p.bb[2]+p.dx,p.bb[3]+p.dy]);
    if(p.dx||p.dy)selRecord('Move selection',rUnion(p.bb,nb),()=>{sel.bb=nb;},p.snap);release(p.snap);drawSelOverlay();return;}
  if(p.mode==='marq'){const r=p.rect;drawSelOverlay();
    if(!r||r[2]-r[0]<1||r[3]-r[1]<1){if(p.selMode==='new'||!sel.active)deselect();return;}
    const pts=ui.marquee==='ellipse'?ellipsePts(...r):rectPts(...r);
    selectPolygon(pts,p.selMode,ui.marquee==='ellipse'?'Elliptical marquee':'Rectangular marquee',ui.marquee==='ellipse'&&ui.selAA);return;}
  if(p.mode==='lasso'){if(p.straight)p.pts.push(p.cur[0],p.cur[1]);drawSelOverlay();
    const b=polyBounds(p.pts);if(p.pts.length<6||(b[2]-b[0])*view.zoom<2||(b[3]-b[1])*view.zoom<2){if(p.selMode==='new'||!sel.active)deselect();return;}
    selectPolygon(p.pts,p.selMode,'Lasso',ui.selAA);}}
/* marquee rectangle in whole pixels; Shift (pressed after starting) = square/circle, Alt = from the centre */
function marqRect(e){let x0=ptr.x0,y0=ptr.y0,x1=ptr.x1,y1=ptr.y1;
  if(e.shiftKey&&!ptr.startShift){const s=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));x1=x0+Math.sign(x1-x0||1)*s;y1=y0+Math.sign(y1-y0||1)*s;}
  if(e.altKey&&!ptr.startAlt){x0=2*ptr.x0-x1;y0=2*ptr.y0-y1;}
  const r=[Math.round(Math.min(x0,x1)),Math.round(Math.min(y0,y1)),Math.round(Math.max(x0,x1)),Math.round(Math.max(y0,y1))];
  if(!doc.wrap){r[0]=clamp(r[0],0,doc.w);r[2]=clamp(r[2],0,doc.w);r[1]=clamp(r[1],0,doc.h);r[3]=clamp(r[3],0,doc.h);}
  return r;}
/* polygonal lasso: click points, close on the first point, double-click or Enter; Backspace removes a point; Esc cancels */
function polyClick(e,ix,iy){const now=performance.now();
  if(!polyLasso){polyLasso={pts:[ix,iy],mode:modeFromMods(e),startShift:e.shiftKey,time:now,cur:[ix,iy]};drawSelOverlay();return;}
  const P2=polyLasso,[fx,fy]=toScreen(P2.pts[0],P2.pts[1]),[sx,sy]=toScreen(ix,iy);
  const n=P2.pts.length,[lx,ly]=toScreen(P2.pts[n-2],P2.pts[n-1]);
  if(n>=6&&Math.hypot(sx-fx,sy-fy)<9){polyClose();return;}
  if(now-P2.time<350&&Math.hypot(sx-lx,sy-ly)<5){polyClose();return;}
  const q=polyConstrain(e,ix,iy);P2.pts.push(q[0],q[1]);P2.time=now;drawSelOverlay();}
function polyConstrain(e,ix,iy){const P2=polyLasso;if(!P2||!e.shiftKey||P2.startShift)return [ix,iy];const n=P2.pts.length,lx=P2.pts[n-2],ly=P2.pts[n-1];
  const a=Math.round(Math.atan2(iy-ly,ix-lx)/(Math.PI/4))*(Math.PI/4),d=Math.hypot(ix-lx,iy-ly);return [lx+Math.cos(a)*d,ly+Math.sin(a)*d];}
function polyMove(e,ix,iy){if(!polyLasso)return;polyLasso.cur=polyConstrain(e,ix,iy);drawSelOverlay();}
function polyClose(){const P2=polyLasso;polyLasso=null;drawSelOverlay();if(!P2||P2.pts.length<6)return;selectPolygon(P2.pts,P2.mode,'Polygonal lasso',ui.selAA);}
function polyKey(e){if(!polyLasso)return false;
  if(e.key==='Enter'){e.preventDefault();polyClose();return true;}
  if(e.key==='Escape'){e.preventDefault();polyLasso=null;drawSelOverlay();return true;}
  if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();if(polyLasso.pts.length>2)polyLasso.pts.length-=2;else polyLasso=null;drawSelOverlay();return true;}
  return false;}

/* the outline being drawn, as an SVG over the canvas (the finished selection is drawn by the GPU) */
const selOv=document.createElementNS('http://www.w3.org/2000/svg','svg');selOv.id='selOv';selOv.setAttribute('aria-hidden','true');stage.append(selOv);
function drawSelOverlay(){let d='';const Z=(x,y)=>toScreen(x,y).map(v=>v.toFixed(1)).join(' ');
  if(ptr&&ptr.mode==='marq'&&ptr.rect){const [x0,y0,x1,y1]=ptr.rect;
    if(ui.marquee==='ellipse'){const p=ellipsePts(x0,y0,x1,y1),step=Math.max(2,Math.floor(p.length/180))*2;d='M'+Z(p[0],p[1]);for(let i=step;i<p.length;i+=step)d+='L'+Z(p[i],p[i+1]);d+='Z';}
    else d='M'+Z(x0,y0)+'L'+Z(x1,y0)+'L'+Z(x1,y1)+'L'+Z(x0,y1)+'Z';}
  else if(ptr&&ptr.mode==='lasso'){const p=ptr.pts;d='M'+Z(p[0],p[1]);for(let i=2;i<p.length;i+=2)d+='L'+Z(p[i],p[i+1]);if(ptr.straight)d+='L'+Z(ptr.cur[0],ptr.cur[1]);}
  else if(polyLasso){const p=polyLasso.pts;d='M'+Z(p[0],p[1]);for(let i=2;i<p.length;i+=2)d+='L'+Z(p[i],p[i+1]);d+='L'+Z(polyLasso.cur[0],polyLasso.cur[1]);}
  if(!d){if(selOv.firstChild)selOv.replaceChildren();return;}
  selOv.innerHTML='<path class="a" d="'+d+'"/><path class="b" d="'+d+'"/>'+(polyLasso?'<circle cx="'+toScreen(polyLasso.pts[0],polyLasso.pts[1]).join('" cy="')+'" r="4"/>':'');}

/* ---- tool panel (in the right-hand Brush section) ---- */
const SEL_TITLES={marquee:()=>ui.marquee==='ellipse'?'Elliptical marquee':'Rectangular marquee',lasso:()=>ui.lasso==='poly'?'Polygonal lasso':'Lasso',wand:()=>'Magic wand'};
function seg(options,value,onPick,label){const g=el('div',{class:'seg',role:'radiogroup','aria-label':label});
  for(const [v,text,title] of options){const b=el('button',{class:'segb','aria-pressed':String(v===value),title:title||text,text});b.addEventListener('click',()=>{onPick(v);g.querySelectorAll('.segb').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});g.append(b);}
  return g;}
function buildSelectPanel(box){const t=ui.tool;$('#brushTitle').textContent=SEL_TITLES[t]();
  if(t==='marquee')box.append(seg([['rect','Rectangle'],['ellipse','Ellipse']],ui.marquee,v=>{ui.marquee=v;$('#brushTitle').textContent=SEL_TITLES[t]();updateSelIcons();},'Marquee shape'));
  if(t==='lasso')box.append(seg([['free','Freehand'],['poly','Polygonal']],ui.lasso,v=>{ui.lasso=v;polyLasso=null;drawSelOverlay();$('#brushTitle').textContent=SEL_TITLES[t]();updateSelIcons();},'Lasso type'));
  box.append(el('div',{class:'sub',text:'Mode (or hold Shift to add, Alt to subtract, both to intersect)'}),
    seg([['new','New'],['add','Add','Add to selection (Shift)'],['sub','Subtract','Subtract from selection (Alt)'],['int','Intersect','Intersect with selection (Shift+Alt)']],ui.selMode,v=>{ui.selMode=v;},'Selection mode'));
  box.append(makeSlider({id:'sFeather',label:'Feather',min:0,max:250,step:1,value:ui.selFeather,fmt:v=>v+'px',onInput:v=>{ui.selFeather=v;}}).el);
  if(t==='wand')box.append(makeSlider({id:'sTol',label:'Tolerance',min:0,max:255,step:1,value:ui.wandTol,onInput:v=>{ui.wandTol=v;}}).el);
  const chips=el('div',{class:'chips'});
  if(!(t==='marquee'&&ui.marquee==='rect'))chips.append(chk('sAA','Anti-alias',ui.selAA,v=>{ui.selAA=v;}));
  if(t==='wand')chips.append(chk('sCont','Contiguous',ui.wandContig,v=>{ui.wandContig=v;}),chk('sAll','Sample all layers',ui.wandAll,v=>{ui.wandAll=v;}));
  if(chips.childNodes.length)box.append(chips);
  box.append(el('div',{class:'frow'},
    el('button',{class:'btn sm',text:'Select all',title:'Ctrl+A',onclick:selectAll}),el('button',{class:'btn sm',text:'Deselect',title:'Ctrl+D',onclick:deselect}),
    el('button',{class:'btn sm',text:'Invert',title:'Ctrl+Shift+I',onclick:invertSel}),el('button',{class:'btn sm',text:'Quick mask',title:'Q',onclick:toggleQuickMask})));
  const tips={marquee:'Drag to select. Shift after starting makes a square or circle, Alt draws from the centre. Drag inside a selection to move it; arrow keys nudge it.',
    lasso:ui.lasso==='poly'?'Click to place points. Click the first point, double-click or press Enter to close. Backspace removes the last point, Esc cancels. Shift keeps lines at 45°.':'Drag around an area. Hold Alt while dragging for straight lines. Drag inside a selection to move it.',
    wand:'Click a colour to select it. Tolerance sets how similar colours must be. Contiguous picks only touching pixels.'};
  box.append(el('div',{class:'sub',text:tips[t]}));}

/* toolbar icons change with the marquee / lasso variant */
const SEL_ICONS={rect:'<path d="M4 7V4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4"/>',
  ellipse:'<path d="M12 4a8 8 0 0 1 8 8M20 12a8 8 0 0 1-8 8M12 20a8 8 0 0 1-8-8M4 12a8 8 0 0 1 8-8" stroke-dasharray="3 2.4"/>',
  free:'<path d="M7.5 17.5C4.5 16 3 13.8 3 11.5 3 7.4 7 4.5 12 4.5s9 2.9 9 6.5-4 6-9 6c-1.2 0-2.3-.1-3.3-.4"/><path d="M8.7 16.6c-.8 1-.6 2.4.6 2.9"/>',
  poly:'<path d="M4 16 7 5l9 2 4 8-9 4z" stroke-dasharray="3 2.2"/>',
  wand:'<path d="m4 20 10-10"/><path d="m14 10 2 2"/><path d="M17 3v3M15.5 4.5h3M20 8v2M19 9h2M11 3v2M10 4h2"/>'};
function updateSelIcons(){const m=document.querySelector('.tool[data-tool="marquee"] svg'),l=document.querySelector('.tool[data-tool="lasso"] svg');
  if(m)m.innerHTML=SEL_ICONS[ui.marquee];if(l)l.innerHTML=SEL_ICONS[ui.lasso];}
(function addSelTools(){const bar=$('#tools'),before=bar.querySelector('.tool[data-tool="text"]');
  const mk=(tool,label,key,icon)=>{const b=el('button',{class:'tool','data-tool':tool,title:label+' ('+key+')','aria-label':label,'aria-pressed':'false'});b.innerHTML='<svg viewBox="0 0 24 24">'+icon+'</svg>';b.addEventListener('click',()=>setTool(tool));bar.insertBefore(b,before);};
  mk('marquee','Marquee: rectangle or ellipse','M, Shift+M switches',SEL_ICONS.rect);mk('lasso','Lasso: freehand or polygonal','L, Shift+L switches',SEL_ICONS.free);mk('wand','Magic wand','W',SEL_ICONS.wand);})();

/* keyboard shortcuts for selections; returns true if the key was used */
function selKeys(e,m,k){
  if(polyKey(e))return true;
  if(m){if(k==='a'){e.preventDefault();selectAll();return true;}
    if(k==='d'){e.preventDefault();e.shiftKey?reselect():deselect();return true;}
    if(k==='i'&&e.shiftKey){e.preventDefault();invertSel();return true;}
    if(k==='j'&&sel.active&&!sel.quick){e.preventDefault();layerViaSel(e.shiftKey);return true;}
    if(k==='c'&&e.shiftKey){e.preventDefault();if(copySel(true))writeClipMarker();return true;}
    return false;}
  if(e.altKey)return false;
  if(k==='m'){if(e.shiftKey&&ui.tool==='marquee'){ui.marquee=ui.marquee==='rect'?'ellipse':'rect';updateSelIcons();buildBrushPanel();}else setTool('marquee');return true;}
  if(k==='l'){if(e.shiftKey&&ui.tool==='lasso'){ui.lasso=ui.lasso==='free'?'poly':'free';polyLasso=null;updateSelIcons();buildBrushPanel();drawSelOverlay();}else setTool('lasso');return true;}
  if(k==='w'){setTool('wand');return true;}
  if(k==='q'){toggleQuickMask();return true;}
  if(isSelTool(ui.tool)&&sel.active&&e.key.startsWith('Arrow')){e.preventDefault();const s=e.shiftKey?10:1,d={ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,-s],ArrowDown:[0,s]}[e.key];nudgeSel(d[0],d[1]);return true;}
  return false;}

/* ---- Select menu dialogs ---- */
function radiusDialog(title,label,max,def,fn,note){if(!needSel())return;let v=def;
  const body=el('div',{class:'dlg-grid'},makeSlider({id:'selR',label,min:1,max,step:1,value:def,fmt:x=>x+'px',onInput:x=>{v=x;}}).el);if(note)body.append(el('p',{class:'note',text:note}));
  openDialog({title,body,okLabel:'Apply',onOk(){fn(v);}});}
function dlgFeather(){radiusDialog('Feather selection','Radius',250,8,featherSel,'Softens the edge of the selection.');}
function dlgExpand(){radiusDialog('Expand selection','Expand by',100,4,expandSel);}
function dlgContract(){radiusDialog('Contract selection','Contract by',100,4,contractSel);}
function dlgSmooth(){radiusDialog('Smooth selection','Radius',100,4,smoothSel,'Rounds off jagged corners and removes small specks.');}
function dlgLoadSel(){if(selBusy())return;const A=doc.active;const opts=[];
  if(A)opts.push(['layer','Transparency of “'+A.name+'”']);if(A&&A.mask)opts.push(['mask','Mask of “'+A.name+'”']);
  opts.push(['r','Red channel of the image'],['g','Green channel of the image'],['b','Blue channel of the image'],['a','Alpha (transparency) of the image'],['lum','Brightness of the image']);
  let src=opts[0][0],mode='new',inv=false;
  const s=el('select',{id:'lsSrc','aria-label':'Source'},...opts.map(([v,t])=>el('option',{value:v,text:t})));s.addEventListener('change',()=>{src=s.value;});
  const body=el('div',{class:'dlg-grid'},el('div',{class:'frow'},el('label',{for:'lsSrc',text:'From'}),s),
    seg([['new','New'],['add','Add'],['sub','Subtract'],['int','Intersect']],mode,v=>{mode=v;},'Mode'),chk('lsInv','Invert',false,v=>{inv=v;}));
  openDialog({title:'Load selection',body,okLabel:'Load',onOk(){
    if(src==='layer'){if(inv){const t=isLayer(A)?A.target:null;if(t)loadSelFrom(t.tex,0,mode,'Load selection',true);else{const r=renderNodes(A.children);loadSelFrom(r.tex,0,mode,'Load selection',true);release(r);}}else selectLayerPixels(A,mode);return;}
    if(src==='mask'){loadSelFrom(A.mask.target.tex,1,mode,'Load selection',inv);return;}
    loadSelFrom(freshComposite().tex,{r:1,g:2,b:3,a:0,lum:4}[src],mode,'Load selection',inv);}});}
