/* ================= View + input ================= */
const work=$('#work');
/* (0.37) in 3D Paint the 3D view is on the left and the flat texture on the right: how far the flat view starts from the left, in canvas pixels */
function stageOx(d){const w=document.getElementById('work');if(!w||!w.classList.contains('p3left')||typeof v3==='undefined'||!v3.on||v3.pop||w.classList.contains('v3full'))return 0;const p=document.getElementById('pane3d');return p?p.clientWidth*(d===undefined?dprNow():d):0;}
function resizeGL(){const d=Math.min(window.devicePixelRatio||1,typeof qual==='function'?qual('dpr'):2);const w=Math.max(1,Math.round(work.clientWidth*d)),h=Math.max(1,Math.round(work.clientHeight*d));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}requestRender();}
function fit(){const W=stage.clientWidth,H=stage.clientHeight,[DW,DH]=viewDims(),pad=doc.wrap&&!ui.cageFlat?90:48,[BW,BH]=vxBox(DW,DH);view.zoom=clamp(Math.min((W-pad)/BW,(H-pad)/BH),.02,32);vxCentre(W,H,DW,DH);updateStatus();refreshCursor();requestRender();}
function actual(){const W=stage.clientWidth,H=stage.clientHeight,[DW,DH]=viewDims();view.zoom=1;vxCentre(W,H,DW,DH);if(!vxA()){view.x=Math.round(view.x);view.y=Math.round(view.y);}updateStatus();refreshCursor();requestRender();}
function zoomAt(f,sx,sy){const z=clamp(view.zoom*f,.02,64),k=z/view.zoom;view.x=sx-(sx-view.x)*k;view.y=sy-(sy-view.y)*k;view.zoom=z;updateStatus();refreshCursor();requestRender();}
function toImage(cx,cy){const r=stage.getBoundingClientRect(),vx=(cx-r.left-view.x)/view.zoom,vy=(cy-r.top-view.y)/view.zoom,A=vxA();if(!A)return [vx,vy];const f=view.flip?-1:1,c=Math.cos(view.rot),s=Math.sin(view.rot);return [f*(c*vx+s*vy),-s*vx+c*vy];}
function updateStatus(){if(typeof vxCompassSync==='function')vxCompassSync();if(typeof p3ResolutionSync==='function')p3ResolutionSync();$('#stDoc').textContent=doc.w+' × '+doc.h+' px';$('#stDepth').textContent=doc.depth+'-bit';$('#stDepth').title=doc.depth===16?'16 bits per channel (half float). Click for 8-bit.':(canFloat?'8 bits per channel. Click for 16-bit.':'8 bits per channel. 16-bit is not supported on this GPU.');
  $('#stZoom').textContent=(view.zoom*100).toFixed(view.zoom<.1?1:0)+'%'+(vxA()?' · '+vxDeg()+'°'+(view.flip?' flipped':''):'');$('#stFmt').textContent='WebGL2 · '+(doc.depth===16?'RGBA16F':'RGBA8')+' layers';$('#docName').textContent=doc.name;updateTitle();if(typeof fileLocUpdate==='function')fileLocUpdate();}
$('#stDepth').addEventListener('click',()=>setDepth(doc.depth===16?8:16));
$('#tileBtn').addEventListener('click',toggleTile);

const bc=$('#brushCursor');let lastPos=null,spaceDown=false,ptr=null,altPickDown=false;
const brushPickerCursor='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M4 22l2-6L18 4l6 6L12 22l-6 2zM15 7l6 6" fill="#222" stroke="white" stroke-width="2"/><path d="M5 23l5-2-3-3z" fill="white"/></svg>')+'") 5 23, crosshair';
function brushPickCursorOn(){return ui.tool==='picker'||altPickDown&&prefs.altPick!==false&&!['heal','clone'].includes(ui.tool)&&!spaceDown&&!rotHold&&!stroke;}
function refreshCursor(){if(typeof healMarker==='function')healMarker();const hit=document.getElementById('v3Hit');if(hit&&typeof v3!=='undefined'){if(altPickDown&&prefs.altPick!==false&&!['heal','clone'].includes(ui.tool)){hit.style.cursor=brushPickerCursor;if(v3.curEl)v3.curEl.hidden=true;}else if(hit.style.cursor.includes('data:image/svg'))hit.style.cursor='';}if(brushPickCursorOn()){bc.hidden=true;cv.style.cursor=brushPickerCursor;return;}if(cv.style.cursor.includes('data:image/svg'))cv.style.cursor='';if(ui.tool==='zoom'&&!spaceDown){bc.hidden=true;cv.style.cursor='zoom-in';return;}if(!lastPos){bc.hidden=true;return;}const paint=['brush','erase','smudge','dodge','burn','heal','clone','material','liquify'].includes(ui.tool)&&!spaceDown&&!rotHold&&!(ptr&&['pan','vrot'].includes(ptr.mode));
  if(!paint){bc.hidden=true;if(cv.style.cursor==='none')cv.style.cursor='';return;}cv.style.cursor='none';const lq=ui.tool==='liquify',d=Math.max(3,(lq?liq.size:brush.size)*view.zoom);bc.hidden=false;bc.style.width=d+'px';bc.style.height=d+'px';if(lq){bc.classList.remove('tipcur');if(bc.firstChild)bc.replaceChildren();}else tipCursor(bc,d);bc.style.transform='translate('+(lastPos[0]-d/2)+'px,'+(lastPos[1]-d/2)+'px)';}
/* Preferences › Show the brush tip's shape as the cursor: the tip's outline, at the brush size, turned and squashed like the dabs */
const tipOutlineCache=new Map();
function tipOutline(tip,d){const n=clamp(Math.round(d/4)*4,8,512),key=tip.id+':'+n;let c=tipOutlineCache.get(key);if(c)return c;
  const a=tip.w/tip.h,W=a>=1?n:Math.max(2,Math.round(n*a)),H=a>=1?Math.max(2,Math.round(n/a)):n;
  c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.drawImage(tip.canvas,0,0,W,H);const A=x.getImageData(0,0,W,H).data,out=x.createImageData(W,H),O=out.data;
  const on=(i,j)=>i>=0&&j>=0&&i<W&&j<H&&A[(j*W+i)*4+3]>=110;
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){if(!on(i,j)||(on(i-1,j)&&on(i+1,j)&&on(i,j-1)&&on(i,j+1)))continue;const p=(j*W+i)*4;O[p]=O[p+1]=O[p+2]=O[p+3]=255;}
  x.putImageData(out,0,0);if(tipOutlineCache.size>32)tipOutlineCache.clear();tipOutlineCache.set(key,c);return c;}
function tipCursor(elm,d){const t=brush.tip,on=!!(prefs.tipCursor!==false&&t&&t.canvas);elm.classList.toggle('tipcur',on);
  if(!on){if(elm.firstChild)elm.replaceChildren();return;}
  const src=tipOutline(t,d);let c=elm.firstChild;if(!c||c.tagName!=='CANVAS'){c=document.createElement('canvas');elm.replaceChildren(c);}
  if(c._src!==src){c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);c._src=src;}
  const a=t.w/t.h;c.style.width=(a>=1?d:d*a)+'px';c.style.height=(a>=1?d/a:d)+'px';
  c.style.transform='translate(-50%,-50%) rotate('+(brush.angle||0)+'deg) scale('+(brush.flipX?-1:1)+','+(brush.roundness||1)*(brush.flipY?-1:1)+')';}
function pressureOf(e,parent){const pen=e.pointerType==='pen'||(!e.pointerType&&parent?.pointerType==='pen');if(!pen)return 1;const p=Number(e.pressure),fallback=Number(parent?.pressure);return clamp(Number.isFinite(p)&&p>0?p:Number.isFinite(fallback)&&fallback>0?fallback:.02,.02,1);}
function showPressure(e){const pb=$('#pBar'),pv=$('#pVal');if(e.pointerType==='pen'){pb.style.width=Math.round((e.pressure||0)*100)+'%';pv.textContent=(e.pressure||0).toFixed(2)+' pen';}else{pb.style.width=(e.buttons?100:0)+'%';pv.textContent=e.pointerType==='touch'?'touch':'mouse';}}
/* brush settings for a stroke on edit target et (null, with a message, if it can't be painted) */
function paintOpts(et){
  if(et===false)return null;
  if(!et){toast(doc.active&&doc.active.fx?'This is a filter layer: it has no pixels to paint on. Double-click its thumbnail to change its filters, or select a normal layer.':doc.active?'A group is selected. Select a layer inside it, or click the group’s mask thumbnail to paint its mask.':'Select a layer to paint on.');return null;}
  if(et.node&&!effVisible(et.node)&&!ui.viewMask){toast('The active layer (or its group) is hidden. Show it to paint on it.');return null;}
  if(preview){toast('Apply or cancel the open filter first.');return null;}
  if(!et.isMask&&et.node&&(et.node.text||et.node.grad||et.node.shape)){const g=et.node.grad?'Gradient':et.node.shape?'Shape':'Text';rasterizeText(et.node);toast(g+' converted to pixels so you can paint on it. Undo brings the editable '+g.toLowerCase()+' back.');}
  const o=Object.assign({},brush,{tool:ui.tool,color:ui.mode==='bake'&&typeof bk!=='undefined'&&bk.paint?bakePaintColor():ui.fg.slice(),chan:!et.isMask&&chanRestricted()?chan.edit.slice():null,sel:selOn(et)});
  if(o.tool==='dodge'||o.tool==='burn')Object.assign(o,{opacity:ui.tonalExposure,range:ui.tonalRange,protect:ui.tonalProtect});
  if(et.isMask){const g=lum3(o.color);o.color=[g,g,g];o.noTint=true;/* a mask's Paint row really erases (back to what is below it) */if(o.tool==='erase'&&!et.L.mrow){o.tool='brush';o.color=(et.erase||[1,1,1]).slice();}}
  o.extras=strokeExtras(o,et);if(!materialPaintOpts(o,et))return null;
  /* the heal brush: a faint grey trail while painting; the healing happens on release, on every map */
  if(o.tool==='heal')Object.assign(o,{color:[.6,.6,.6],healOpacity:o.opacity,opacity:.45,noTint:true,extras:[],buildup:false,hueJitter:0,satJitter:0,valJitter:0,chan:null});
  if(o.tool==='clone')Object.assign(o,{noTint:true,extras:[],buildup:false,hueJitter:0,satJitter:0,valJitter:0,chan:null});
  if(ui.tool!=='erase'&&(ui.tool==='brush'||brush.charge>0))pushRecent(ui.fg);
  return o;}
cv.addEventListener('pointerdown',e=>{
  if(ptr)return;closeMenu();const pan=e.button===1||spaceDown||ui.tool==='hand';if(!pan&&e.button!==0)return;
  e.preventDefault();cv.tabIndex=0;cv.focus({preventScroll:true});cv.setPointerCapture(e.pointerId);showPressure(e);
  if(rotHold||(spaceDown&&e.shiftKey)){ptr=vxDragStart(e);stage.classList.add('panning');return;}
  if(pan){ptr={mode:'pan',id:e.pointerId,sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y};stage.classList.add('panning');refreshCursor();return;}
  if(ui.tool==='zoom'){const r=stage.getBoundingClientRect();zoomAt(e.shiftKey?.5:2,e.clientX-r.left,e.clientY-r.top);return;}
  let [ix,iy]=toImage(e.clientX,e.clientY);if(typeof gdSnapOn==='function'&&gdSnapOn()&&!e.altKey)[ix,iy]=gdSnap(ix,iy);
  if(ui.tool==='liquify'&&!e.altKey&&ui.mode!=='bake'&&ui.mode!=='convert'){liqDown(e,ix,iy);return;}
  if(ui.cageFlat&&!['brush','erase','smudge','dodge','burn','heal','clone','picker'].includes(ui.tool)&&!e.altKey){toast('Only painting works in the flat cage view. Press F to go back to the canvas.');return;}
  if(ui.mode==='convert'){cvPointerDown(e,ix,iy);return;}
  /* a UV projection's frame (selected material or mask row with a picture or pattern) */
  if(typeof pxf2Down==='function'&&pxf2Down(e))return;
  if(ui.mode==='bake'&&!['brush','erase','picker','hand'].includes(ui.tool)&&!e.altKey){toast('In the Bake tab you can paint fixes with the Brush and Eraser. Switch to Paint for the other tools.');return;}
  if(ui.tool==='cage'){cagePointerDown(e,ix,iy);return;}
  if(selLive){toast('Apply or cancel the selection dialog first.');return;}
  if(xf&&!xf.move){xfPointerDown(e,ix,iy);return;}
  if(ui.tool==='crop'){cropPointerDown(e,ix,iy);return;}
  if(ui.tool==='move'){movePointerDown(e,ix,iy);return;}
  if(['gradient','bucket','gbucket'].includes(ui.tool)&&fillNoMask())return;
  if(ui.tool==='gradient'){gradPointerDown(e,ix,iy);return;}
  if(ui.tool==='array'){arrPointerDown(e,ix,iy);return;}
  if(ui.tool==='shape'){shapePointerDown(e,ix,iy);return;}
  if(['bucket','gbucket','gradient'].includes(ui.tool)&&typeof lockStop==='function'&&lockStop(editTarget()))return;
  if(ui.tool==='bucket'){bucketFill(ix,iy);return;}
  if(ui.tool==='gbucket'){gbucketDown(e,ix,iy);return;}
  if(typeof maskToolsOn==='function'&&(maskToolsOn()||liveOn())&&mk3.tool==='id'){idSelPickAt(ix,iy);return;}
  if(isSelTool(ui.tool)){selPointerDown(e,ix,iy);return;}
  if(ui.tool==='text'){
    if(tedit){const b=tedit.L.text.bbox;if(b&&ix>=b.bx&&ix<=b.bx+b.bw&&iy>=b.by&&iy<=b.by+b.bh){ted.focus();return;}closeTextEditor();return;}
    const hit=hitText(ix,iy);if(hit){selectOnly(hit);renderLayers();ptr={mode:'tmove',id:e.pointerId,L:hit,sx:ix,sy:iy,ox:hit.text.x,oy:hit.text.y,moved:false};return;}
    if(!effVisible(doc.active||doc.root)&&doc.active){}createText(ix,iy);return;}
  if(ui.tool==='clone'&&e.altKey){healSetSource(ix,iy);buildBrushPanel();return;}
  if(ui.tool==='heal'&&e.altKey){if(heal.mode==='spot'){heal.mode='source';healSave();buildBrushPanel();buildOptBar();}healSetSource(ix,iy);return;}
  if(ui.tool==='picker'||(e.altKey&&prefs.altPick!==false)){ptr={mode:'pick',id:e.pointerId};const q=ui.cageFlat?cageFwd(ix,iy):[ix,iy];pickAt(q[0],q[1]);return;}
  if(typeof maskPaintLocked==='function'&&maskPaintLocked()){toast('Press Paint in the mask bar to paint the mask.');return;}
  if(ui.tool==='material')materialBrushTarget();if(fillNoMask())return;
  const et=ui.mode==='bake'?bakeEditTarget():editTarget();if(ui.mode!=='bake'&&typeof lockStop==='function'&&lockStop(et))return;const o=paintOpts(et);if(!o)return;const L=et.L,p=pressureOf(e);
  if((o.tool==='heal'||o.tool==='clone')&&!healBegin(ix,iy,o.tool))return;const cz=cageStrokeStart(o,ix,iy);if(cz===false)return;const sx=cz?cz.x:ix,sy=cz?cz.y:iy;o.sym=symFor(o);
  const line=cz?null:brushLineStart(et,sx,sy,p,e,'canvas');
  ptr={mode:'paint',id:e.pointerId,sx,sy,sp:p,rx:sx,ry:sy,cage:cz?cz.kind:null,ox:sx,oy:sy,lock:null,line};beginStroke(L,line?line.x:sx,line?line.y:sy,line?line.p:p,o);if(line?.joined)addPoint(sx,sy,p);
});
cv.addEventListener('pointermove',e=>{
  const r=stage.getBoundingClientRect();lastPos=[e.clientX-r.left,e.clientY-r.top];refreshCursor();showPressure(e);
  let [mx,my]=toImage(e.clientX,e.clientY);$('#stPos').textContent=(mx>=0&&my>=0&&mx<doc.w&&my<doc.h)?Math.floor(mx)+', '+Math.floor(my):'–';
  if(typeof gdSnapOn==='function'&&gdSnapOn()&&!e.altKey)[mx,my]=gdSnap(mx,my);
  if(!ptr&&polyLasso){polyMove(e,mx,my);return;}
  if(!ptr){if(ui.tool==='cage'&&!ui.cageFlat)cageHover(e);else if(xf&&!xf.move)xfHover(e);else if(ui.tool==='crop'&&crop)cropHover(e);else if(ui.tool==='gradient')gradHover(e);else if(ui.tool==='array')arrHover(e);else if(ui.tool==='shape')shapeHover(e);}
  if(ptr&&e.pointerId===ptr.id){if(ptr.mode==='cvq'){cvPointerMove(e,mx,my);return;}if(ptr.mode==='cage'){cagePointerMove(e,mx,my);return;}if(ptr.mode==='xf'){xfPointerMove(e,mx,my);return;}if(ptr.mode==='crop'){cropPointerMove(e,mx,my);return;}if(ptr.mode==='movedrag'){movePointerMove(e,mx,my);return;}if(ptr.mode==='grad'){gradPointerMove(e,mx,my);return;}if(ptr.mode==='gbucket'){gbucketMove(e,mx,my);return;}}
  if(!ptr||e.pointerId!==ptr.id)return;
  if(ptr.mode==='marq'||ptr.mode==='lasso'||ptr.mode==='selmove'){selPointerMove(e,mx,my);return;}
  if(ptr.mode==='arr'){arrPointerMove(e,mx,my);return;}
  if(ptr.mode==='shape'){shapePointerMove(e,mx,my);return;}
  if(ptr.mode==='vrot'){vxDragMove(e);return;}
  if(ptr.mode==='liq'){liqMove(e,mx,my);return;}
  if(ptr.mode==='pan'){view.x=ptr.vx+e.clientX-ptr.sx;view.y=ptr.vy+e.clientY-ptr.sy;requestRender();return;}
  if(ptr.mode==='tmove'){const [mx2,my2]=toImage(e.clientX,e.clientY),dx=mx2-ptr.sx,dy=my2-ptr.sy;if(!ptr.moved&&Math.hypot(dx,dy)*view.zoom<4)return;
    if(!ptr.moved){ptr.moved=true;textBegin(ptr.L);}ptr.L.text.x=Math.round(ptr.ox+dx);ptr.L.text.y=Math.round(ptr.oy+dy);renderText(ptr.L);return;}
  const evs=e.getCoalescedEvents?e.getCoalescedEvents():[];const list=evs.length?evs:[e];
  if(ptr.mode==='pick'){const l=list[list.length-1];let q=toImage(l.clientX,l.clientY);if(ui.cageFlat)q=cageFwd(q[0],q[1]);pickAt(q[0],q[1]);return;}
  const k=1-brush.smoothing*.93;
  for(const ev of list){let [ix,iy]=toImage(ev.clientX,ev.clientY);const p=pressureOf(ev,e);
    if(ptr.cage==='bend'&&stroke&&stroke.space){const m=cageInv(stroke.space.C,ix,iy);if(!m){ptr.gap=true;continue;}ix=m.x;iy=m.y;stroke.rs=1/Math.max(m.s,1e-3);
      if(ptr.gap){ptr.gap=false;ptr.sx=ptr.rx=ix;ptr.sy=ptr.ry=iy;ptr.sp=p;strokeJump(ix,iy,p);continue;}}
    /* Shift inside a cage: follow the cage's grid lines (straight in flat space, so the stroke curves with the cage) */
    if(ptr.cage&&ev.shiftKey){if(!ptr.lock){const dx=ix-ptr.ox,dy=iy-ptr.oy;if(Math.hypot(dx,dy)>4)ptr.lock=Math.abs(dx)>=Math.abs(dy)?'u':'v';}if(ptr.lock==='u')iy=ptr.oy;else if(ptr.lock==='v')ix=ptr.ox;else continue;}
    if(ptr.line)[ix,iy]=brushLineSnap(ptr.line,ix,iy,ev.shiftKey);
    ptr.rx=ix;ptr.ry=iy;
    if(brush.lazy>0&&stroke&&!ev.shiftKey){const q=lazyStep(ptr,ix,iy,brush.lazy/view.zoom);if(!q)continue;ix=q[0];iy=q[1];}
    const step=ev.shiftKey?1:k;ptr.sx+=(ix-ptr.sx)*step;ptr.sy+=(iy-ptr.sy)*step;ptr.sp+=(p-ptr.sp)*Math.max(k,.4);addPoint(ptr.sx,ptr.sy,ptr.sp);}
});
function endPtr(e){if(!ptr||e.pointerId!==ptr.id)return;if(ptr.mode==='liq'){liqUp();return;}if(ptr.mode==='cvq'){ptr=null;return;}if(ptr.mode==='cage'){cagePointerUp();return;}if(ptr.mode==='xf'){xfPointerUp();return;}if(ptr.mode==='crop'){cropPointerUp();return;}if(ptr.mode==='movedrag'){movePointerUp();return;}if(ptr.mode==='grad'){gradPointerUp();return;}if(ptr.mode==='gbucket'){gbucketUp();return;}if(ptr.mode==='marq'||ptr.mode==='lasso'||ptr.mode==='selmove'){selPointerUp(e);refreshCursor();return;}if(ptr.mode==='paint'){if(brush.smoothing>0)addPoint(brush.lazy>0?ptr.sx:ptr.rx,brush.lazy>0?ptr.sy:ptr.ry,ptr.sp);brushLineRemember(ptr.line,brush.lazy>0?ptr.sx:ptr.rx,brush.lazy>0?ptr.sy:ptr.ry,ptr.sp);endStroke(true);}
  if(ptr.mode==='arr'){arrPointerUp();return;}
  if(ptr.mode==='shape'){shapePointerUp(e);return;}
  if(ptr.mode==='tmove'){const t=ptr;ptr=null;if(t.moved){textCommit();changed(t.L);}else openTextEditor(t.L,false);refreshCursor();return;}
  ptr=null;stage.classList.remove('panning');refreshCursor();$('#pBar').style.width='0%';}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);cv.addEventListener('lostpointercapture',endPtr);
cv.addEventListener('pointerleave',()=>{if(!ptr){lastPos=null;bc.hidden=true;}});
cv.addEventListener('contextmenu',e=>{e.preventDefault();if(xf&&!xf.move)xfContextMenu(e);});
cv.addEventListener('dblclick',e=>{if(ui.tool==='crop'&&crop){const [sx,sy]=stageXY(e);if(cropHit(sx,sy).type==='move')cropApply();}else if(xf&&!xf.move&&!xf.warp){const [sx,sy]=stageXY(e);const h=xfHit(sx,sy);if(h&&h.type==='move')xfCommit();}});
work.addEventListener('wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect();const dy=e.deltaY*(e.deltaMode===1?16:1);zoomAt(Math.exp(-dy*(e.ctrlKey?.01:.0015)),e.clientX-r.left,e.clientY-r.top);},{passive:false});

window.addEventListener('keydown',e=>{
  const t=e.target,tag=(t.tagName||'').toLowerCase();const typing=(tag==='input'&&!['range','checkbox','radio','button'].includes(t.type))||tag==='select'||tag==='textarea';
  if(e.key==='Escape'){if(openName||!pop.hidden||!flyEl.hidden){closeMenu();return;}if(!modal.hidden){$('#dlgCancel').click();return;}}
  if(!modal.hidden||typing)return;
  if(e.key==='Alt'){altPickDown=true;refreshCursor();return;}
  if(kbHandle(e))return;
  const m=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(!m&&!e.altKey&&e.shiftKey&&k==='b'){e.preventDefault();if(!e.repeat)brushSwapLast();return;}
  if(e.key==='F3'){e.preventDefault();toggle3D();return;}
  if(!m&&!e.altKey&&!e.shiftKey&&k==='f'){e.preventDefault();if(!e.repeat)toggleTabFull();return;}
  if(e.key==='Escape'&&document.body.classList.contains('tabfull')){e.preventDefault();toggleTabFull(false);return;}
  if(!m&&!e.altKey&&e.shiftKey&&k==='f'&&ui.mode==='p3d'){e.preventDefault();if(!e.repeat)actions.frame3d();return;}
  if(xfKeys(e,m,k)||cropKeys(e)||cageKeys(e,m,k))return;
  if(m&&k==='t'){e.preventDefault();freeTransform();return;}
  if(animKeys(e,m,k))return;
  if(selKeys(e,m,k))return;
  if(mapKeyNav(e))return;
  if(!m&&!e.altKey&&k==='v'){setTool('move');return;}
  if(!m&&!e.altKey&&k==='g'){const F=['gradient','bucket','gbucket'];if(e.shiftKey&&F.includes(ui.tool))ui.fillKind=F[(F.indexOf(ui.tool)+1)%3];setTool(ui.fillKind);return;}
  if(!m&&!e.altKey&&k==='o'){if(e.shiftKey&&(ui.tool==='dodge'||ui.tool==='burn'))ui.tonal=ui.tool==='dodge'?'burn':'dodge';setTool(ui.tonal);return;}
  if(!m&&!e.altKey&&k==='c'){setTool('crop');return;}
  if(ui.tool==='move'&&!m&&e.key.startsWith('Arrow')){e.preventDefault();const s=e.shiftKey?10:1,d={ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,-s],ArrowDown:[0,s]}[e.key];nudgeLayer(d[0],d[1]);return;}
  if(!m&&!e.altKey&&!e.shiftKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();shadeStep(e.key==='ArrowRight'?1:-1);return;}
  if(m){const map={z:e.shiftKey?'redo':'undo',y:'redo',o:'open',s:e.shiftKey?'saveAs':'save',u:e.shiftKey?'desat':'adjust',l:'levels',m:'curves',i:'invert','0':'fit','1':'actual',e:e.shiftKey?'export':'merge'};
    if(k==='k'){e.preventDefault();dlgPrefs();return;}
    if(k==='f'&&e.shiftKey){e.preventDefault();dlgGallery();return;}
    if(k==='n'&&e.shiftKey){e.preventDefault();cmdAddLayer();return;}if(k==='g'){e.preventDefault();e.shiftKey?cmdUngroup():cmdGroup();return;}if(k==='j'){e.preventDefault();cmdDuplicate();return;}if(k==='n'&&e.altKey){e.preventDefault();dlgNew();return;}
    if(map[k]){e.preventDefault();actions[map[k]]();}return;}
  if(e.altKey&&/^Digit[2-6]$/.test(e.code)){e.preventDefault();selectChannel(+e.code.slice(5)-3,false);return;}
  if(!m&&!e.altKey&&!e.shiftKey&&k==='r'&&!['p3d','bake','convert'].includes(ui.mode)){e.preventDefault();rotHold=true;stage.classList.add('grab');refreshCursor();return;}
  if(e.code==='Space'){e.preventDefault();if(!spaceDown){spaceDown=true;stage.classList.add('grab');refreshCursor();}return;}
  const tools={b:'brush',e:'erase',s:'smudge',i:'picker',h:'hand',u:'shape',j:'heal',y:'clone',p:'pen',z:'zoom'};
  if(tools[k]){setTool(tools[k]);return;}
  if(k==='['||k===']'){e.preventDefault();kbBrushSize(k===']'?1:-1);return;}
  if(k==='x'){swapColors();return;}if(k==='d'){ui.bg=[1,1,1];setFG([0,0,0]);return;}if(k==='t'){if(e.shiftKey)toggleTile();else setTool('text');return;}
  /* Delete: with a selection it clears what is selected (like Photoshop); without one it deletes the layer. Alt+Delete fills. */
  if((k==='delete'||k==='backspace')&&ui.mode!=='bake'&&ui.mode!=='convert'){e.preventDefault();if(e.altKey)fillLayer();else if((sel.active&&!sel.quick)||ui.mode==='anim'||ui.mode==='brush')clearLayer();else cmdDelete();}
});
window.addEventListener('keyup',e=>{if(e.key==='Alt'){altPickDown=false;refreshCursor();}if(e.key==='r'||e.key==='R'){rotHold=false;if(!spaceDown&&ui.tool!=='hand')stage.classList.remove('grab');refreshCursor();}if(e.code==='Space'){spaceDown=false;if(ui.tool!=='hand')stage.classList.remove('grab');refreshCursor();}});
window.addEventListener('blur',()=>{spaceDown=false;rotHold=false;altPickDown=false;stage.classList.toggle('grab',ui.tool==='hand');refreshCursor();});
new ResizeObserver(()=>{resizeGL();drawSV();}).observe(stage);new ResizeObserver(()=>resizeGL()).observe(work);
new ResizeObserver(()=>drawSV()).observe(svC);
cv.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('The GPU context was lost. Reload the page to continue.');});
