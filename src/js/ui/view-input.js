/* ================= View + input ================= */
function resizeGL(){const d=Math.min(window.devicePixelRatio||1,2);const w=Math.max(1,Math.round(stage.clientWidth*d)),h=Math.max(1,Math.round(stage.clientHeight*d));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}requestRender();}
function fit(){const W=stage.clientWidth,H=stage.clientHeight,pad=doc.wrap?90:48;view.zoom=clamp(Math.min((W-pad)/doc.w,(H-pad)/doc.h),.02,32);view.x=(W-doc.w*view.zoom)/2;view.y=(H-doc.h*view.zoom)/2;updateStatus();refreshCursor();requestRender();}
function actual(){const W=stage.clientWidth,H=stage.clientHeight;view.zoom=1;view.x=Math.round((W-doc.w)/2);view.y=Math.round((H-doc.h)/2);updateStatus();refreshCursor();requestRender();}
function zoomAt(f,sx,sy){const z=clamp(view.zoom*f,.02,64),k=z/view.zoom;view.x=sx-(sx-view.x)*k;view.y=sy-(sy-view.y)*k;view.zoom=z;updateStatus();refreshCursor();requestRender();}
function toImage(cx,cy){const r=stage.getBoundingClientRect();return [(cx-r.left-view.x)/view.zoom,(cy-r.top-view.y)/view.zoom];}
function updateStatus(){$('#stDoc').textContent=doc.w+' × '+doc.h+' px';$('#stDepth').textContent=doc.depth+'-bit';$('#stDepth').title=doc.depth===16?'16 bits per channel (half float). Click for 8-bit.':(canFloat?'8 bits per channel. Click for 16-bit.':'8 bits per channel. 16-bit is not supported on this GPU.');
  $('#stZoom').textContent=(view.zoom*100).toFixed(view.zoom<.1?1:0)+'%';$('#stFmt').textContent='WebGL2 · '+(doc.depth===16?'RGBA16F':'RGBA8')+' layers';$('#docName').textContent=doc.name;updateTitle();}
$('#stDepth').addEventListener('click',()=>setDepth(doc.depth===16?8:16));
$('#tileBtn').addEventListener('click',toggleTile);

const bc=$('#brushCursor');let lastPos=null,spaceDown=false,ptr=null;
function refreshCursor(){if(!lastPos){bc.hidden=true;return;}const paint=['brush','erase','smudge'].includes(ui.tool)&&!spaceDown&&!(ptr&&ptr.mode==='pan');
  if(!paint){bc.hidden=true;return;}const d=Math.max(3,brush.size*view.zoom);bc.hidden=false;bc.style.width=d+'px';bc.style.height=d+'px';bc.style.transform='translate('+(lastPos[0]-d/2)+'px,'+(lastPos[1]-d/2)+'px)';}
function pressureOf(e){return e.pointerType==='pen'?Math.max(.02,e.pressure||0):1;}
function showPressure(e){const pb=$('#pBar'),pv=$('#pVal');if(e.pointerType==='pen'){pb.style.width=Math.round((e.pressure||0)*100)+'%';pv.textContent=(e.pressure||0).toFixed(2)+' pen';}else{pb.style.width=(e.buttons?100:0)+'%';pv.textContent=e.pointerType==='touch'?'touch':'mouse';}}
cv.addEventListener('pointerdown',e=>{
  if(ptr)return;closeMenu();const pan=e.button===1||spaceDown||ui.tool==='hand';if(!pan&&e.button!==0)return;
  e.preventDefault();cv.setPointerCapture(e.pointerId);showPressure(e);
  if(pan){ptr={mode:'pan',id:e.pointerId,sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y};stage.classList.add('panning');refreshCursor();return;}
  const [ix,iy]=toImage(e.clientX,e.clientY);
  if(selLive){toast('Apply or cancel the selection dialog first.');return;}
  if(isSelTool(ui.tool)){selPointerDown(e,ix,iy);return;}
  if(ui.tool==='text'){
    if(tedit){const b=tedit.L.text.bbox;if(b&&ix>=b.bx&&ix<=b.bx+b.bw&&iy>=b.by&&iy<=b.by+b.bh){ted.focus();return;}closeTextEditor();return;}
    const hit=hitText(ix,iy);if(hit){selectOnly(hit);renderLayers();ptr={mode:'tmove',id:e.pointerId,L:hit,sx:ix,sy:iy,ox:hit.text.x,oy:hit.text.y,moved:false};return;}
    if(!effVisible(doc.active||doc.root)&&doc.active){}createText(ix,iy);return;}
  if(ui.tool==='picker'||e.altKey){ptr={mode:'pick',id:e.pointerId};pickAt(ix,iy);return;}
  const et=editTarget();if(!et){toast(doc.active?'A group is selected. Select a layer inside it, or click the group’s mask thumbnail to paint its mask.':'Select a layer to paint on.');return;}
  if(!effVisible(et.node)&&!ui.viewMask){toast('The active layer (or its group) is hidden. Show it to paint on it.');return;}
  if(preview){toast('Apply or cancel the open filter first.');return;}
  if(!et.isMask&&et.node.text){rasterizeText(et.node);toast('Text converted to pixels so you can paint on it. Undo brings the editable text back.');}
  const L=et.L,p=pressureOf(e);const o=Object.assign({},brush,{tool:ui.tool,color:ui.fg.slice(),chan:!et.isMask&&chanRestricted()?chan.edit.slice():null,sel:selOn(et)});
  if(et.isMask){const g=lum3(ui.fg);o.color=[g,g,g];if(o.tool==='erase'){o.tool='brush';o.color=[1,1,1];}}
  if(ui.tool!=='erase'&&(ui.tool==='brush'||brush.charge>0))pushRecent(ui.fg);
  ptr={mode:'paint',id:e.pointerId,sx:ix,sy:iy,sp:p,rx:ix,ry:iy};beginStroke(L,ix,iy,p,o);
});
cv.addEventListener('pointermove',e=>{
  const r=stage.getBoundingClientRect();lastPos=[e.clientX-r.left,e.clientY-r.top];refreshCursor();showPressure(e);
  const [mx,my]=toImage(e.clientX,e.clientY);$('#stPos').textContent=(mx>=0&&my>=0&&mx<doc.w&&my<doc.h)?Math.floor(mx)+', '+Math.floor(my):'–';
  if(!ptr&&polyLasso){polyMove(e,mx,my);return;}
  if(!ptr||e.pointerId!==ptr.id)return;
  if(ptr.mode==='marq'||ptr.mode==='lasso'||ptr.mode==='selmove'){selPointerMove(e,mx,my);return;}
  if(ptr.mode==='pan'){view.x=ptr.vx+e.clientX-ptr.sx;view.y=ptr.vy+e.clientY-ptr.sy;requestRender();return;}
  if(ptr.mode==='tmove'){const [mx2,my2]=toImage(e.clientX,e.clientY),dx=mx2-ptr.sx,dy=my2-ptr.sy;if(!ptr.moved&&Math.hypot(dx,dy)*view.zoom<4)return;
    if(!ptr.moved){ptr.moved=true;textBegin(ptr.L);}ptr.L.text.x=Math.round(ptr.ox+dx);ptr.L.text.y=Math.round(ptr.oy+dy);renderText(ptr.L);return;}
  const evs=e.getCoalescedEvents?e.getCoalescedEvents():[];const list=evs.length?evs:[e];
  if(ptr.mode==='pick'){const l=list[list.length-1];const q=toImage(l.clientX,l.clientY);pickAt(q[0],q[1]);return;}
  const k=1-brush.smoothing*.93;
  for(const ev of list){const [ix,iy]=toImage(ev.clientX,ev.clientY),p=pressureOf(ev);ptr.rx=ix;ptr.ry=iy;
    ptr.sx+=(ix-ptr.sx)*k;ptr.sy+=(iy-ptr.sy)*k;ptr.sp+=(p-ptr.sp)*Math.max(k,.4);addPoint(ptr.sx,ptr.sy,ptr.sp);}
});
function endPtr(e){if(!ptr||e.pointerId!==ptr.id)return;if(ptr.mode==='marq'||ptr.mode==='lasso'||ptr.mode==='selmove'){selPointerUp(e);refreshCursor();return;}if(ptr.mode==='paint'){if(brush.smoothing>0)addPoint(ptr.rx,ptr.ry,ptr.sp);endStroke(true);}
  if(ptr.mode==='tmove'){const t=ptr;ptr=null;if(t.moved){textCommit();changed(t.L);}else openTextEditor(t.L,false);refreshCursor();return;}
  ptr=null;stage.classList.remove('panning');refreshCursor();$('#pBar').style.width='0%';}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);cv.addEventListener('lostpointercapture',endPtr);
cv.addEventListener('pointerleave',()=>{if(!ptr){lastPos=null;bc.hidden=true;}});
cv.addEventListener('contextmenu',e=>e.preventDefault());
stage.addEventListener('wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect();const dy=e.deltaY*(e.deltaMode===1?16:1);zoomAt(Math.exp(-dy*(e.ctrlKey?.01:.0015)),e.clientX-r.left,e.clientY-r.top);},{passive:false});

window.addEventListener('keydown',e=>{
  const t=e.target,tag=(t.tagName||'').toLowerCase();const typing=(tag==='input'&&!['range','checkbox','radio','button'].includes(t.type))||tag==='select'||tag==='textarea';
  if(e.key==='Escape'){if(openName){closeMenu();return;}if(!modal.hidden){$('#dlgCancel').click();return;}}
  if(!modal.hidden||typing)return;
  const m=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(selKeys(e,m,k))return;
  if(m){const map={z:e.shiftKey?'redo':'undo',y:'redo',o:'open',s:e.shiftKey?'savePsdAs':'savePsd',u:'adjust',i:'invert','0':'fit','1':'actual',e:e.shiftKey?'export':'merge'};
    if(k==='n'&&e.shiftKey){e.preventDefault();cmdAddLayer();return;}if(k==='g'){e.preventDefault();e.shiftKey?cmdUngroup():cmdGroup();return;}if(k==='j'){e.preventDefault();cmdDuplicate();return;}if(k==='n'&&e.altKey){e.preventDefault();dlgNew();return;}
    if(map[k]){e.preventDefault();actions[map[k]]();}return;}
  if(e.altKey&&/^Digit[2-6]$/.test(e.code)){e.preventDefault();selectChannel(+e.code.slice(5)-3,false);return;}
  if(e.code==='Space'){e.preventDefault();if(!spaceDown){spaceDown=true;stage.classList.add('grab');refreshCursor();}return;}
  const tools={b:'brush',e:'erase',s:'smudge',i:'picker',h:'hand'};
  if(tools[k]){setTool(tools[k]);return;}
  if(k==='['||k===']'){brush.size=clamp(Math.round(brush.size*(k===']'?1.15:1/1.15)+(k===']'?1:-1)),1,500);if(sizeSlider)sizeSlider.set(brush.size);refreshCursor();schedulePreview();return;}
  if(k==='x'){swapColors();return;}if(k==='d'){ui.bg=[1,1,1];setFG([0,0,0]);return;}if(k==='t'){if(e.shiftKey)toggleTile();else setTool('text');return;}
  if(k==='delete'||k==='backspace'){e.preventDefault();e.altKey?fillLayer():clearLayer();}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;if(ui.tool!=='hand')stage.classList.remove('grab');refreshCursor();}});
window.addEventListener('blur',()=>{spaceDown=false;stage.classList.toggle('grab',ui.tool==='hand');});
new ResizeObserver(()=>{resizeGL();drawSV();}).observe(stage);
new ResizeObserver(()=>drawSV()).observe(svC);
cv.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('The GPU context was lost. Reload the page to continue.');});
