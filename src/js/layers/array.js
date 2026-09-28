/* ================= Array tool =================
   Repeats the active layer in a line, a grid or a circle. The copies stay live (see look.js):
   paint on the layer and every copy follows; change the settings or drag the handles on the
   canvas any time. Apply turns the copies into pixels. */
const activeArr=()=>isLayer(doc.active)&&!doc.active.fx&&doc.active.array?doc.active:null;
/* edits: one undo step per burst of changes */
let asess=null;
const cloneArr=a=>JSON.parse(JSON.stringify(a));
function arrBegin(L){if(asess&&asess.L!==L)arrCommit();if(!asess)asess={L,before:L.array?cloneArr(L.array):null};clearTimeout(asess.timer);}
function arrTouch(){if(!asess)return;clearTimeout(asess.timer);asess.timer=setTimeout(arrCommit,700);}
function arrCommit(){const s=asess;if(!s)return;asess=null;clearTimeout(s.timer);const L=s.L,a=s.before,b=L.array?cloneArr(L.array):null;
  if(JSON.stringify(a)===JSON.stringify(b))return;
  pushUndo({label:!a?'Add array':!b?'Remove array':'Edit array',refs:[L],undo(){L.array=a?cloneArr(a):null;arrChanged(L);},redo(){L.array=b?cloneArr(b):null;arrChanged(L);}});}
function arrChanged(L,quiet){L.lookVer=(L.lookVer||0)+1;scheduleThumb(L);requestRender(true);drawXfOverlay();if(!quiet&&ui.tool==='array')arrPanelSync();renderLayers();}
function arrEdit(fn){const L=activeArr();if(!L)return;arrBegin(L);fn(L.array);arrChanged(L,true);arrTouch();}

/* ---- set up, remove, apply ---- */
function arrAdd(mode){const L=doc.active;if(!isLayer(L)||L.fx){toast('Select a layer to repeat.');return;}
  const b=arrayMeasure(L),w=b[2]-b[0],h=b[3]-b[1],cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
  arrBegin(L);L.array=Object.assign(cloneArr(ARRAY_DEF),{mode:mode||'line',dx:Math.round(Math.min(w+20,doc.w/4)),gx:Math.round(Math.min(w+20,doc.w/4)),gy:Math.round(Math.min(h+20,doc.h/4)),
    cx:Math.round(cx),cy:Math.round(cy+Math.max(60,Math.min(doc.w,doc.h)*.25)),seed:1+Math.floor(Math.random()*999)});
  arrChanged(L);arrTouch();buildBrushPanel();}
function arrRemove(){const L=activeArr();if(!L)return;arrBegin(L);L.array=null;arrChanged(L);arrCommit();buildBrushPanel();}
/* bake the copies into the layer's pixels, every map, as one undo step */
function arrApply(){const L=activeArr();if(!L)return;arrCommit();const ks=mapKeysOf(L),before={},after={},A=L.array;
  for(const k of ks)before[k]=captureRegionNow(mapT(L,k),0,0,doc.w,doc.h);
  for(const k of ks){const t=mapT(L,k),tmp=acquireD(t.depth);arrayDraw(L,t,tmp,k,false);blit(tmp,t,0,0,doc.w,doc.h,0,0);release(tmp);after[k]=captureRegionNow(t,0,0,doc.w,doc.h);}
  L.array=null;const put=snaps=>{for(const k in snaps){const t=mapT(L,k);if(t)restoreRegion(snaps[k],t,0,0);}};
  pushUndo({label:'Apply array',refs:[L],snaps:[...Object.values(before),...Object.values(after)],undo(){put(before);L.array=cloneArr(A);arrChanged(L);},redo(){put(after);L.array=null;arrChanged(L);}});
  arrChanged(L);buildBrushPanel();toast('Array applied: the copies are pixels now.');}

/* ---- handles on the canvas ---- */
function arrPivot(L){const b=L.arrBox||arrayMeasure(L);return [(b[0]+b[2])/2,(b[1]+b[3])/2];}
function arrHandles(L){const A=L.array,p=arrPivot(L);
  if(A.mode==='grid')return [{id:'gx',pos:[p[0]+A.gx,p[1]]},{id:'gy',pos:[p[0],p[1]+A.gy]}];
  if(A.mode==='circle')return [{id:'c',pos:[A.cx,A.cy]}];
  return [{id:'d',pos:[p[0]+A.dx,p[1]+A.dy]}];}
function arrHit(sx,sy){const L=activeArr();if(!L||!L.array.on)return null;for(const h of arrHandles(L)){const q=scrPt(h.pos);if(Math.hypot(q[0]-sx,q[1]-sy)<=9)return Object.assign({L},h);}return null;}
function arrHover(e){const [sx,sy]=stageXY(e);cv.style.cursor=arrHit(sx,sy)?'grab':'';}
function arrPointerDown(e,ix,iy){const [sx,sy]=stageXY(e),h=arrHit(sx,sy);
  if(!h){if(!activeArr())toast('Press “Add array” in the Tool settings panel, or pick a layer that has one.');return;}
  arrBegin(h.L);ptr={mode:'arr',id:e.pointerId,h,m0:[ix,iy],a0:cloneArr(h.L.array)};}
function arrPointerMove(e,ix,iy){const p=ptr,A=p.h.L.array,dx=ix-p.m0[0],dy=iy-p.m0[1],a0=p.a0;
  if(p.h.id==='d'){A.dx=Math.round(a0.dx+dx);A.dy=Math.round(a0.dy+dy);if(e.shiftKey){if(Math.abs(A.dx)>Math.abs(A.dy))A.dy=0;else A.dx=0;}}
  else if(p.h.id==='gx')A.gx=Math.round(a0.gx+dx);else if(p.h.id==='gy')A.gy=Math.round(a0.gy+dy);
  else if(p.h.id==='c'){A.cx=Math.round(a0.cx+dx);A.cy=Math.round(a0.cy+dy);}
  arrChanged(p.h.L,true);arrPanelSync(true);}
function arrPointerUp(){ptr=null;arrTouch();}
/* outlines of the copies, and the handles */
function lkOverlay(){if(ui.tool!=='array')return '';const L=activeArr();if(!L||!L.array.on)return '';const b=L.arrBox||arrayMeasure(L),piv=[(b[0]+b[2])/2,(b[1]+b[3])/2];let s='';
  const cps=arrayCopies(L.array,piv);if(cps.length<=200)for(const M of cps){const c=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]].map(([x,y])=>scrPt([M[0]*x+M[1]*y+M[2],M[3]*x+M[4]*y+M[5]]));
    s+='<path class="ln" style="opacity:.45" d="M'+c.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join('L')+'Z"/>';}
  const P=scrPt(piv);for(const h of arrHandles(L)){const q=scrPt(h.pos);if(h.id!=='c')s+='<path class="ln" d="M'+P[0]+' '+P[1]+'L'+q[0]+' '+q[1]+'"/>';s+='<circle class="ge" cx="'+q[0]+'" cy="'+q[1]+'" r="6"/>';}
  if(L.array.mode==='circle'){const q=scrPt([L.array.cx,L.array.cy]),r=Math.hypot(piv[0]-L.array.cx,piv[1]-L.array.cy)*view.zoom;s+='<circle class="ln" style="opacity:.5" fill="none" cx="'+q[0]+'" cy="'+q[1]+'" r="'+r+'"/>';}
  return s;}

/* ---- the panel ---- */
let arrPanelEls=null;
function arrPanelSync(light){if(ui.tool!=='array')return;if(light&&arrPanelEls){const A=(activeArr()||{}).array;if(A)for(const [k,s] of arrPanelEls)s.set(A[k]);return;}buildBrushPanel();}
function buildArrayPanel(box){$('#brushTitle').textContent='Array';const L=activeArr();arrPanelEls=[];
  if(!L){box.append(el('p',{class:'note',text:isLayer(doc.active)&&!doc.active.fx?'Repeat “'+doc.active.name+'” in a line, a grid or a circle. The copies stay live: paint on the layer and they all follow.':'Select a layer to repeat.'}));
    if(isLayer(doc.active)&&!doc.active.fx)box.append(el('div',{class:'row wrap'},...[['line','Line'],['grid','Grid'],['circle','Circle']].map(([m,t])=>el('button',{class:'btn sm',id:'arrAdd_'+m,text:'Add '+t.toLowerCase()+' array',onclick:()=>arrAdd(m)}))));return;}
  const A=L.array,S=(id,label,key,min,max,step,fmt)=>{const s=makeSlider({id,label,min,max,step,value:A[key],fmt,onInput:v=>arrEdit(a=>{a[key]=v;})});arrPanelEls.push([key,s]);return s.el;};
  box.append(el('p',{class:'note',text:'Drag the round handles on the canvas. Everything stays editable until you press Apply.'}),
    chk('arrOn','Show the copies',A.on!==false,v=>arrEdit(a=>{a.on=v;})),
    seg([['line','Line'],['grid','Grid'],['circle','Circle']],A.mode,v=>{arrEdit(a=>{a.mode=v;});buildBrushPanel();},'Array'));
  if(A.mode==='line')box.append(S('arrCount','Copies','count',2,100,1,v=>String(v)),S('arrDx','Step X','dx',-2000,2000,1,v=>v+' px'),S('arrDy','Step Y','dy',-2000,2000,1,v=>v+' px'));
  if(A.mode==='grid')box.append(S('arrCols','Columns','cols',1,40,1,v=>String(v)),S('arrRows','Rows','rows',1,40,1,v=>String(v)),S('arrGx','Gap X','gx',-2000,2000,1,v=>v+' px'),S('arrGy','Gap Y','gy',-2000,2000,1,v=>v+' px'));
  if(A.mode==='circle')box.append(S('arrCountC','Copies','count',2,100,1,v=>String(v)),S('arrSweep','Sweep','sweep',10,360,1,v=>v+'°'),
    chk('arrTurn','Turn each copy to face the centre',A.turn!==false,v=>arrEdit(a=>{a.turn=v;})),S('arrCx','Centre X','cx',-doc.w,doc.w*2,1,v=>v+' px'),S('arrCy','Centre Y','cy',-doc.h,doc.h*2,1,v=>v+' px'));
  box.append(el('div',{class:'sub',text:'Variety'}),chk('arrVary','Vary each copy at random',!!A.vary,v=>{arrEdit(a=>{a.vary=v;});buildBrushPanel();}));
  if(A.vary)box.append(S('arrVRot','Rotation','vRot',0,180,1,v=>'± '+v+'°'),S('arrVScale','Size','vScale',0,.9,.01,v=>'± '+Math.round(v*100)+'%'),S('arrVHue','Hue','vHue',0,180,1,v=>'± '+v+'°'),S('arrVVal','Brightness','vVal',0,.9,.01,v=>'± '+Math.round(v*100)+'%'),
    el('button',{class:'btn sm',id:'arrSeed',text:'Shuffle',title:'A different random variation',onclick:()=>arrEdit(a=>{a.seed=1+Math.floor(Math.random()*9999);})}));
  box.append(el('div',{class:'row wrap'},el('button',{class:'btn',id:'arrApply',text:'Apply',title:'Turn the copies into pixels',onclick:arrApply}),el('button',{class:'btn',id:'arrRemove',text:'Remove array',onclick:arrRemove})));}

(function(){const bar=$('#tools'),b=el('button',{class:'tool','data-tool':'array',title:'Array: repeat the layer in a line, grid or circle','aria-label':'Array','aria-pressed':'false'});
  b.innerHTML='<svg viewBox="0 0 24 24"><rect x="3" y="9" width="5" height="6" rx="1"/><rect x="9.5" y="9" width="5" height="6" rx="1" opacity=".7"/><rect x="16" y="9" width="5" height="6" rx="1" opacity=".45"/></svg>';
  b.addEventListener('click',()=>setTool('array'));bar.insertBefore(b,bar.querySelector('.tool[data-tool="text"]'));})();
