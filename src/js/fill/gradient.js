/* ================= Gradients =================
   A gradient definition: colour stops, opacity stops, shape, blending method (perceptual = OKLab,
   linear = linear light, classic = plain sRGB), reverse and dither. It is baked into a small strip
   texture that the GPU samples. A live gradient layer keeps {def, a, b} (end points in document pixels)
   and redraws itself whenever they change; Rasterize turns it into ordinary pixels. */
const GRAD_SHAPES=['linear','radial','angle','reflected','diamond'];
const cloneGrad=g=>JSON.parse(JSON.stringify(g));
function gradDef(stops,alphas,extra){return Object.assign({stops,alphas:alphas||[{p:0,a:1},{p:1,a:1}],method:'perceptual',shape:'linear',reverse:false,dither:true},extra||{});}
const hexStops=list=>list.map(([p,h])=>({p,c:fromHex(h)}));
/* built-in presets; the first two follow the current colours */
const GRAD_BUILTIN=[
  {name:'Foreground to background',dyn:'fgbg'},{name:'Foreground to transparent',dyn:'fgclear'},
  {name:'Black to white',def:gradDef(hexStops([[0,'#000000'],[1,'#ffffff']]))},
  {name:'Warm light',def:gradDef(hexStops([[0,'#3b1f2b'],[.45,'#c2603a'],[1,'#f6d58e']]))},
  {name:'Cool shadow',def:gradDef(hexStops([[0,'#101a33'],[.5,'#3c5a7d'],[1,'#a9c6d9']]))},
  {name:'Foliage',def:gradDef(hexStops([[0,'#1d2b1a'],[.5,'#4f7a36'],[1,'#c9d98a']]))},
  {name:'Stone',def:gradDef(hexStops([[0,'#2a2826'],[.55,'#7b766d'],[1,'#d8d2c4']]))},
  {name:'Sunset sky',def:gradDef(hexStops([[0,'#2b2f6b'],[.5,'#d9607a'],[1,'#ffd28a']]))}];
function presetDef(pr){if(pr.dyn==='fgbg')return gradDef([{p:0,c:ui.fg.slice()},{p:1,c:ui.bg.slice()}]);
  if(pr.dyn==='fgclear')return gradDef([{p:0,c:ui.fg.slice()},{p:1,c:ui.fg.slice()}],[{p:0,a:1},{p:1,a:0}]);return cloneGrad(pr.def);}
let userGradPresets=(()=>{try{return JSON.parse(localStorage.getItem('gs.gradPresets')||'[]');}catch(e){return [];}})();
function saveGradPresets(){try{localStorage.setItem('gs.gradPresets',JSON.stringify(userGradPresets));}catch(e){}}
ui.grad=presetDef(GRAD_BUILTIN[0]);ui.gradLive=true;ui.gradOpacity=1;

/* ---- sampling a definition ---- */
function mixMethod(a,b,f,m){if(m==='classic')return a.map((v,i)=>v+(b[i]-v)*f);
  if(m==='linear')return a.map((v,i)=>{const x=lin(v),y=lin(b[i]);return unlin(x+(y-x)*f);});
  const A=toOk(a),B=toOk(b);return fromOk(A.map((v,i)=>v+(B[i]-v)*f)).map(v=>clamp(v,0,1));}
function gradAt(def,t){if(def.reverse)t=1-t;const s=def.stops.slice().sort((x,y)=>x.p-y.p),A=def.alphas.slice().sort((x,y)=>x.p-y.p);let c,a;
  if(t<=s[0].p)c=s[0].c;else if(t>=s[s.length-1].p)c=s[s.length-1].c;else{let k=0;while(k<s.length-2&&t>s[k+1].p)k++;const f=(t-s[k].p)/Math.max(1e-6,s[k+1].p-s[k].p);c=mixMethod(s[k].c,s[k+1].c,f,def.method);}
  if(t<=A[0].p)a=A[0].a;else if(t>=A[A.length-1].p)a=A[A.length-1].a;else{let k=0;while(k<A.length-2&&t>A[k+1].p)k++;const f=(t-A[k].p)/Math.max(1e-6,A[k+1].p-A[k].p);a=A[k].a+(A[k+1].a-A[k].a)*f;}
  return [c[0],c[1],c[2],a];}
const LUT_N=512;let lutTex=null;
function uploadLut(def){const d=new Float32Array(LUT_N*4);for(let i=0;i<LUT_N;i++){const c=gradAt(def,i/(LUT_N-1));d.set(c,i*4);}
  if(!lutTex){lutTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,lutTex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);}
  gl.bindTexture(gl.TEXTURE_2D,lutTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,LUT_N,1,0,gl.RGBA,gl.FLOAT,d);return lutTex;}
/* draw a gradient into dst; o = {base, opacity, sel, gray} */
function drawGradient(dst,g,o){o=o||{};const tex=uploadLut(g.def);
  run(P.grad,dst,{uLut:tex,uA:g.a,uB:g.b,uShape:{int:Math.max(0,GRAD_SHAPES.indexOf(g.def.shape))},uDither:!!g.def.dither&&doc.depth===8,uOpacity:o.opacity==null?1:o.opacity,uGray:!!o.gray,
    uBase:o.base?o.base.tex:dummy,uUseBase:!!o.base,uSelTex:o.sel?sel.t.tex:dummy,uUseSel:!!o.sel});}
function renderLiveGrad(L){if(!L.grad)return;drawGradient(L.target,L.grad);scheduleThumb(L);requestRender(true);}
/* a CSS preview of a definition */
function gradCss(def,dir){const n=24,parts=[];for(let i=0;i<=n;i++){const c=gradAt(def,i/n);parts.push('rgba('+c.slice(0,3).map(v=>Math.round(v*255)).join(',')+','+c[3].toFixed(3)+') '+(i/n*100).toFixed(1)+'%');}
  return 'linear-gradient('+(dir||'90deg')+','+parts.join(',')+')';}

/* ---- live gradient layers: edit sessions give one undo step per edit ---- */
let gsess=null;
function gradBegin(L){if(gsess&&gsess.L!==L)gradCommit();if(!gsess)gsess={L,before:cloneGrad(L.grad)};clearTimeout(gsess.timer);}
function gradTouch(){if(!gsess)return;clearTimeout(gsess.timer);gsess.timer=setTimeout(gradCommit,700);}
function gradCommit(){const s=gsess;if(!s)return;gsess=null;clearTimeout(s.timer);const L=s.L;if(!L.grad)return;const a=s.before,b=cloneGrad(L.grad);
  if(JSON.stringify(a)===JSON.stringify(b))return;
  pushUndo({label:'Edit gradient',refs:[L],undo(){L.grad=cloneGrad(a);renderLiveGrad(L);gradPanelRefresh();},redo(){L.grad=cloneGrad(b);renderLiveGrad(L);gradPanelRefresh();}});renderLayers();}
function rasterizeGrad(L){if(!L||!L.grad)return;if(gsess&&gsess.L===L)gradCommit();const g=L.grad;L.grad=null;
  pushUndo({label:'Rasterize gradient',refs:[L],undo(){L.grad=g;},redo(){L.grad=null;}});renderLayers();if(ui.tool==='gradient')buildBrushPanel();}
const activeGrad=()=>isLayer(doc.active)&&doc.active.grad?doc.active:null;
/* the definition the panel edits: the selected live gradient layer, or the tool's own */
/* only the gradient tool edits a selected gradient layer; the gradient bucket always uses the tool's own gradient */
const editedGrad=()=>ui.tool==='gradient'?activeGrad():null;
const panelDef=()=>{const L=editedGrad();return L?L.grad.def:ui.grad;};
function defChanged(){const L=editedGrad();if(L){gradBegin(L);renderLiveGrad(L);gradTouch();renderLayers();}gradPanelRefresh(true);drawXfOverlay();}

/* ---- the gradient tool on the canvas ---- */
function gradHandles(L){const g=L.grad,d=g.def,pt=t=>[g.a[0]+(g.b[0]-g.a[0])*t,g.a[1]+(g.b[1]-g.a[1])*t];
  return {a:g.a,b:g.b,stops:d.stops.map((s,i)=>({i,pos:pt(d.reverse?1-s.p:s.p)}))};}
function gradHit(sx,sy){const L=activeGrad();if(!L)return null;const h=gradHandles(L),near=(p,r)=>{const s=scrPt(p);return Math.hypot(s[0]-sx,s[1]-sy)<=(r||8);};
  if(near(h.a))return {type:'a',L};if(near(h.b))return {type:'b',L};
  for(const s of h.stops)if(near(s.pos,7))return {type:'stop',i:s.i,L};
  const A=scrPt(h.a),B=scrPt(h.b),vx=B[0]-A[0],vy=B[1]-A[1],t=((sx-A[0])*vx+(sy-A[1])*vy)/(vx*vx+vy*vy||1);
  if(t>0&&t<1&&Math.hypot(sx-A[0]-vx*t,sy-A[1]-vy*t)<6)return {type:'line',t,L};return null;}
function gradHover(e){const [sx,sy]=stageXY(e),h=gradHit(sx,sy);cv.style.cursor=h?(h.type==='line'?'copy':'grab'):'';}
function snapAngle(a,b,e){if(!e.shiftKey)return b;const dx=b[0]-a[0],dy=b[1]-a[1],ang=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4),d=Math.hypot(dx,dy);return [a[0]+Math.cos(ang)*d,a[1]+Math.sin(ang)*d];}
function gradPointerDown(e,ix,iy){const [sx,sy]=stageXY(e),hit=gradHit(sx,sy);
  if(hit){gradBegin(hit.L);ptr={mode:'grad',id:e.pointerId,hit,m0:[ix,iy],moved:false,g0:cloneGrad(hit.L.grad)};return;}
  const A=activeGrad();
  if(A){gradBegin(A);ptr={mode:'grad',id:e.pointerId,hit:{type:'redraw',L:A},m0:[ix,iy],moved:false,g0:cloneGrad(A.grad)};return;}
  if(ui.gradLive&&ui.mode!=='anim'){/* a new live gradient layer, shown while dragging; one undo step when done */
    const L=newLayerObj('Gradient');L.grad={def:cloneGrad(ui.grad),a:[ix,iy],b:[ix+1,iy]};const [p,i]=insertPoint();insertNode(L,p,i);
    if(sel.active&&!sel.quick){L.mask=makeMask(1);run(P.loadsel,L.mask.target,{uSrc:sel.t.tex,uWhat:{int:1},uInv:false});}
    const prev=doc.active,prevSel=[...doc.sel];selectOnly(L);
    ptr={mode:'grad',id:e.pointerId,hit:{type:'new',L,prev,prevSel,p,i},m0:[ix,iy],moved:false};renderLayers();return;}
  const et=needTarget();if(!et)return;if(!effVisible(et.node)&&!ui.viewMask){toast('Show the active layer first.');return;}
  preview={L:et.node,isMask:et.isMask,et};ptr={mode:'grad',id:e.pointerId,hit:{type:'classic',et},m0:[ix,iy],moved:false,a:[ix,iy],b:[ix,iy]};}
function gradPointerMove(e,ix,iy){const p=ptr,h=p.hit;if(!p.moved&&Math.hypot(ix-p.m0[0],iy-p.m0[1])*view.zoom<3)return;p.moved=true;
  if(h.type==='classic'){p.b=snapAngle(p.a,[ix,iy],e);const et=h.et;
    drawGradient(previewT,{def:ui.grad,a:p.a,b:p.b},{base:et.target,opacity:ui.gradOpacity,sel:selOn(et),gray:et.isMask||!!et.L.quick});chanLimit(et);requestRender(true);drawXfOverlay();return;}
  const L=h.L,g=L.grad;
  if(h.type==='new'||h.type==='redraw'){g.a=p.m0.slice();g.b=snapAngle(g.a,[ix,iy],e);}
  else if(h.type==='a'){g.a=[p.g0.a[0]+ix-p.m0[0],p.g0.a[1]+iy-p.m0[1]];if(e.shiftKey)g.a=snapAngle(g.b,g.a,e);}
  else if(h.type==='b'){g.b=[p.g0.b[0]+ix-p.m0[0],p.g0.b[1]+iy-p.m0[1]];if(e.shiftKey)g.b=snapAngle(g.a,g.b,e);}
  else if(h.type==='stop'){const vx=g.b[0]-g.a[0],vy=g.b[1]-g.a[1],t=((ix-g.a[0])*vx+(iy-g.a[1])*vy)/(vx*vx+vy*vy||1),off=Math.abs((ix-g.a[0])*vy-(iy-g.a[1])*vx)/Math.hypot(vx,vy)*view.zoom;
    const s=g.def.stops,st=p.stopObj||(p.stopObj=s[h.i]);p.removing=off>40&&s.length>2;
    st.p=clamp(g.def.reverse?1-t:t,0,1);ui.gradStop={kind:'c',i:s.indexOf(st)};}
  renderLiveGrad(L);drawXfOverlay();gradPanelRefresh(true);}
function gradPointerUp(){const p=ptr,h=p.hit;ptr=null;
  if(h.type==='classic'){if(p.moved){const et=h.et;fullRecord(et.L,'Gradient',()=>blit(previewT,et.target,0,0,doc.w,doc.h,0,0),selRect(et));}preview=null;requestRender(true);drawXfOverlay();return;}
  if(h.type==='new'){const L=h.L;detachNode(L);doc.active=h.prev;doc.sel=new Set(h.prevSel);
    if(!p.moved){disposeLayer(L);renderLayers();requestRender(true);return;}
    structOp('Gradient layer',()=>{insertNode(L,h.p,h.i);selectOnly(L);});buildBrushPanel();drawXfOverlay();return;}
  if(h.type==='line'&&!p.moved){const L=h.L,g=L.grad,t=g.def.reverse?1-h.t:h.t;g.def.stops.push({p:t,c:ui.fg.slice()});ui.gradStop={kind:'c',i:g.def.stops.length-1};renderLiveGrad(L);}
  if(h.type==='stop'&&!p.moved)ui.gradStop={kind:'c',i:h.i};
  if(h.type==='stop'&&p.removing){const s=h.L.grad.def.stops;s.splice(s.indexOf(p.stopObj),1);ui.gradStop={kind:'c',i:0};renderLiveGrad(h.L);}
  gradTouch();gradPanelRefresh();drawXfOverlay();}
function drawGradOverlay(){let a,b,L=null;
  if(ptr&&ptr.mode==='grad'&&ptr.hit.type==='classic'){if(!ptr.moved)return '';a=ptr.a;b=ptr.b;}
  else if(ptr&&ptr.mode==='gbucket'){if(!ptr.moved)return '';a=ptr.a;b=ptr.b;}
  else{L=activeGrad();if(!L||ui.tool!=='gradient')return '';a=L.grad.a;b=L.grad.b;}
  const A=scrPt(a),B=scrPt(b);let s='<path class="ln" d="M'+A.join(' ')+'L'+B.join(' ')+'"/>';
  s+='<circle class="ge" cx="'+A[0]+'" cy="'+A[1]+'" r="5"/><circle class="ge" cx="'+B[0]+'" cy="'+B[1]+'" r="5"/>';
  if(L)for(const st of gradHandles(L).stops){const q=scrPt(st.pos),c=L.grad.def.stops[st.i].c,on=ui.gradStop&&ui.gradStop.kind==='c'&&ui.gradStop.i===st.i;
    s+='<rect class="gs'+(on?' on':'')+'" x="'+(q[0]-5)+'" y="'+(q[1]-5)+'" width="10" height="10" rx="2" fill="'+toHex(c)+'"/>';}
  return s;}

/* ---- panel ---- */
ui.gradStop={kind:'c',i:0};
let gradPanelBox=null;
function gradPanelRefresh(light){if((ui.tool!=='gradient'&&ui.tool!=='gbucket')||!gradPanelBox)return;if(light&&gradBar){drawGradBar();return;}buildBrushPanel();}
let gradBar=null;
function drawGradBar(){const d=panelDef(),b=gradBar;if(!b)return;b.strip.style.background=gradCss(d)+', repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0/10px 10px';
  const mk=(list,kind)=>{const row=kind==='c'?b.crow:b.arow;row.replaceChildren();
    list.forEach((s,i)=>{const on=ui.gradStop.kind===kind&&ui.gradStop.i===i;const m=el('button',{class:'gstop '+kind+(on?' on':''),'aria-label':(kind==='c'?'Colour':'Opacity')+' stop at '+Math.round(s.p*100)+'%',title:'Drag to move, drag away to remove',style:'left:'+(s.p*100)+'%;'+(kind==='c'?'background:'+toHex(s.c):'background:rgb('+Array(3).fill(Math.round(s.a*255)).join(',')+')')});
      m.addEventListener('pointerdown',e=>stopDrag(e,kind,i,row));row.append(m);});};
  mk(d.stops,'c');mk(d.alphas,'a');
  const st=ui.gradStop,list=st.kind==='c'?d.stops:d.alphas,s=list[Math.min(st.i,list.length-1)];b.info.replaceChildren();
  if(!s)return;
  const loc=el('input',{class:'num',type:'number',min:0,max:100,step:1,value:Math.round(s.p*100),'aria-label':'Location %',id:'gsLoc'});loc.addEventListener('change',()=>{s.p=clamp(+loc.value/100,0,1);defChanged();});
  if(st.kind==='c')b.info.append(el('span',{class:'swatch',style:'background:'+toHex(s.c)}),el('button',{class:'btn sm',text:'Use foreground',title:'Set this stop to the foreground colour',onclick:()=>{s.c=ui.fg.slice();defChanged();}}));
  else{const op=el('input',{class:'num',type:'number',min:0,max:100,step:1,value:Math.round(s.a*100),'aria-label':'Opacity %',id:'gsOp'});op.addEventListener('change',()=>{s.a=clamp(+op.value/100,0,1);defChanged();});b.info.append(el('label',{for:'gsOp',text:'Opacity %'}),op);}
  b.info.append(el('label',{for:'gsLoc',text:'Location %'}),loc);
  if(list.length>2)b.info.append(el('button',{class:'xbtn',text:'×',title:'Remove this stop','aria-label':'Remove stop',onclick:()=>{list.splice(list.indexOf(s),1);ui.gradStop.i=0;defChanged();}}));}
function stopDrag(e,kind,i,row){e.preventDefault();e.stopPropagation();ui.gradStop={kind,i};const d=panelDef(),list=kind==='c'?d.stops:d.alphas,s=list[i],r=row.getBoundingClientRect();let removed=false;
  const mv=ev=>{const p=clamp((ev.clientX-r.left)/r.width,0,1),away=Math.abs(ev.clientY-(r.top+r.height/2))>36&&list.length>2;
    if(away&&!removed){list.splice(list.indexOf(s),1);removed=true;}else if(!away&&removed){list.push(s);removed=false;}
    s.p=p;ui.gradStop={kind,i:Math.max(0,list.indexOf(s))};defChanged();};
  const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);if(removed)ui.gradStop={kind,i:0};defChanged();};
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);drawGradBar();}
function buildGradPanel(box){gradPanelBox=box;const L=editedGrad(),d=panelDef(),gb=ui.tool==='gbucket';$('#brushTitle').textContent=gb?'Gradient bucket':L?'Gradient layer':'Gradient';
  if(gb)box.append(el('div',{class:'sub',text:'Press inside an area and drag to set the direction; the gradient fills only that area (similar colours, like the paint bucket). A click fills it left to right.'}));else
  if(!L)box.append(seg([['live','Live gradient layer','Makes an editable gradient layer'],['classic','Classic','Paints the gradient into the current layer']],ui.gradLive?'live':'classic',v=>{ui.gradLive=v==='live';buildBrushPanel();},'Gradient mode'));
  else box.append(el('div',{class:'sub',text:'Drag the end points on the canvas; click the line to add a colour stop, drag a stop along the line to move it. Drag anywhere else to redraw it.'}));
  const sg=seg(GRAD_SHAPES.map(s=>[s,s==='reflected'?'Reflect':s[0].toUpperCase()+s.slice(1),s[0].toUpperCase()+s.slice(1)]),d.shape,v=>{d.shape=v;defChanged();},'Shape');sg.classList.add('tight');box.append(sg);
  /* stop editor: opacity stops above the strip, colour stops below; click a row to add a stop */
  const strip=el('div',{class:'gstrip'}),arow=el('div',{class:'grow a',title:'Click to add an opacity stop'}),crow=el('div',{class:'grow c',title:'Click to add a colour stop (foreground colour)'}),info=el('div',{class:'frow ginfo'});
  const addAt=(row,kind)=>row.addEventListener('pointerdown',e=>{if(e.target!==row)return;const r=row.getBoundingClientRect(),p=clamp((e.clientX-r.left)/r.width,0,1),dd=panelDef();
    if(kind==='c'){dd.stops.push({p,c:ui.fg.slice()});ui.gradStop={kind:'c',i:dd.stops.length-1};}else{dd.alphas.push({p,a:gradAt(Object.assign({},dd,{reverse:false}),p)[3]});ui.gradStop={kind:'a',i:dd.alphas.length-1};}defChanged();});
  addAt(crow,'c');addAt(arow,'a');
  gradBar={strip,arow,crow,info};box.append(el('div',{class:'gbar'},arow,strip,crow),info);drawGradBar();
  const pre=el('div',{class:'gpresets'});
  const addPre=(pr,user)=>{const dd=pr.dyn?presetDef(pr):pr.def;const b=el('button',{class:'gpre',title:pr.name+(user?' (right-click to remove)':''),'aria-label':pr.name,style:'background:'+gradCss(dd)+', repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0/8px 8px'});
    b.addEventListener('click',()=>{const nd=presetDef(pr);nd.shape=panelDef().shape;nd.method=panelDef().method;nd.dither=panelDef().dither;
      const LL=editedGrad();if(LL){gradBegin(LL);LL.grad.def=nd;renderLiveGrad(LL);gradTouch();}else ui.grad=nd;ui.gradStop={kind:'c',i:0};buildBrushPanel();drawXfOverlay();});
    if(user)b.addEventListener('contextmenu',e=>{e.preventDefault();userGradPresets.splice(userGradPresets.indexOf(pr),1);saveGradPresets();buildBrushPanel();});pre.append(b);};
  GRAD_BUILTIN.forEach(p=>addPre(p,false));userGradPresets.forEach(p=>addPre(p,true));
  pre.append(el('button',{class:'btn sm',text:'+ Save',title:'Save this gradient as a preset',onclick:()=>{userGradPresets.push({name:'My gradient '+(userGradPresets.length+1),def:cloneGrad(panelDef())});saveGradPresets();buildBrushPanel();}}));
  box.append(el('div',{class:'sub',text:'Presets'}),pre);
  const ms=el('select',{id:'gMethod','aria-label':'Blending method'},...[['perceptual','Perceptual'],['linear','Linear'],['classic','Classic']].map(([v,t])=>el('option',{value:v,text:t})));ms.value=d.method;
  ms.addEventListener('change',()=>{d.method=ms.value;defChanged();});
  box.append(el('div',{class:'frow'},el('label',{for:'gMethod',text:'Blending'}),ms),el('div',{class:'chips'},chk('gRev','Reverse',d.reverse,v=>{d.reverse=v;defChanged();}),chk('gDith','Dither',d.dither,v=>{d.dither=v;defChanged();})));
  if(gb){box.append(makeSlider({id:'gbTol',label:'Tolerance',min:0,max:255,step:1,value:ui.bucketTol,onInput:v=>{ui.bucketTol=v;}}).el,
      makeSlider({id:'gbOp',label:'Opacity',min:0,max:1,step:.01,value:ui.gradOpacity,fmt:pct,onInput:v=>{ui.gradOpacity=v;}}).el,
      el('div',{class:'chips'},chk('gbCont','Contiguous',ui.bucketContig,v=>{ui.bucketContig=v;}),chk('gbAll','Sample all layers',ui.bucketAll,v=>{ui.bucketAll=v;}),chk('gbAA','Anti-alias',ui.bucketAA,v=>{ui.bucketAA=v;})));return;}
  if(!L&&!ui.gradLive)box.append(makeSlider({id:'gOp',label:'Opacity',min:0,max:1,step:.01,value:ui.gradOpacity,fmt:pct,onInput:v=>{ui.gradOpacity=v;}}).el);
  if(L)box.append(el('div',{class:'frow'},el('button',{class:'btn sm',text:'Rasterize',title:'Turn the gradient into ordinary pixels',onclick:()=>rasterizeGrad(L)})));
  else box.append(el('div',{class:'sub',text:ui.gradLive?'Drag on the canvas to make a gradient layer you can keep editing. Shift keeps the angle to 45° steps. With a selection, the layer gets a mask of it.':'Drag on the canvas to paint a gradient into the current layer. Shift keeps the angle to 45° steps.'}));}

/* ---- saving live layers (and text) in PSD files: hidden notes in the file's XMP metadata ---- */
const GS_NS='https://github.com/Kenn0090/gouache-studio/ns/1.0/';
/* what a PSD save walks: the paint layers, plus the animation's frames in a hidden group */
function psdRoot(){const R=paintRoot();if(!doc.anim)return R;doc.anim.frames.forEach((F,i)=>{F.name='Frame '+(i+1);});
  const G={type:'group',name:'Gouache animation',children:doc.anim.frames,visible:false,opacity:1,mode:-1,open:false,mask:null,lockAlpha:false};return {type:'group',children:[...R.children,G],isRoot:true};}
function liveLayersXmp(){const list=[];allLayers(psdRoot()).forEach((L,i)=>{if(L.grad)list.push({i,name:L.name,grad:L.grad});else if(L.text)list.push({i,name:L.name,text:cloneText(L.text)});});
  const A=doc.anim,anim=A?{fps:A.fps,cur:A.cur,holds:A.frames.map(f=>f.hold),tags:A.tags.map(t=>{const [a,b]=tagRange(t);return {name:t.name,from:a,to:b,mode:t.mode,color:t.color};}),onion:A.onion,mode:ui.mode,bg:ui.animBg}:null;
  if(!list.length&&!anim)return null;const b64=btoa(unescape(encodeURIComponent(JSON.stringify({v:2,layers:list,anim}))));
  return '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:gouache="'+GS_NS+'"><gouache:liveLayers>'+b64+'</gouache:liveLayers></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';}
function readLiveLayersXmp(xmp){if(!xmp)return {layers:[],anim:null};const m=/<gouache:liveLayers>([^<]+)<\/gouache:liveLayers>/.exec(xmp);if(!m)return {layers:[],anim:null};
  try{const v=JSON.parse(decodeURIComponent(escape(atob(m[1].trim()))));return Array.isArray(v)?{layers:v,anim:null}:v;}catch(e){console.warn('live layer notes unreadable',e);return {layers:[],anim:null};}}
