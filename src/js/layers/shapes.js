/* ================= Shape tool =================
   Rectangle, rounded rectangle, ellipse, polygon, star, line, arrow and heart, each on a layer of
   its own that stays editable (L.shape) until painted on, transformed or converted to pixels.
   Drawn on the GPU from a distance field, so edges are smooth at any size. The fill and outline go
   into the base colour; the bevel, with a choice of profiles, raises the Height map (and so the
   normal). Drag on the canvas to draw one; drag its handles to resize, move or turn it. */
const SHAPE_KINDS=[['rect','Rectangle'],['round','Rounded'],['ellipse','Ellipse'],['poly','Polygon'],['star','Star'],['line','Line'],['arrow','Arrow'],['heart','Heart']];
ui.shape={kind:'rect',fillOn:true,lineOn:false,line:[0,0,0],lineW:6,corner:24,sides:6,inner:.5,head:3,bevel:{on:false,profile:'round',size:16,depth:.6,dir:'up'}};
const lineKind=k=>k==='line'||k==='arrow';
const FS_SHAPE=`uniform vec2 uC; uniform vec2 uH; uniform float uRot; uniform int uKind; uniform float uCorner; uniform float uSides; uniform float uInner;
uniform vec2 uA; uniform vec2 uB; uniform float uW; uniform float uHead; uniform int uOut; uniform vec3 uFill; uniform vec3 uLine; uniform float uLineW; uniform int uFillOn; uniform int uLineOn;
uniform vec4 uBev; /* on, size, depth×direction, profile */
float sdBox(vec2 p,vec2 b,float r){ r=min(r,min(b.x,b.y)); vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
float sdEll(vec2 p,vec2 ab){ ab=max(ab,vec2(1e-3)); float k0=length(p/ab),k1=length(p/(ab*ab)); return k1>0.0?k0*(k0-1.0)/k1:-min(ab.x,ab.y); }
float sdPoly(vec2 p,float r,float n){ float an=3.14159265/n; vec2 acs=vec2(cos(an),sin(an)); float bn=mod(atan(p.x,-p.y),2.0*an)-an; p=length(p)*vec2(cos(bn),abs(sin(bn))); p-=r*acs; p.y+=clamp(-p.y,0.0,r*acs.y); return length(p)*sign(p.x); }
float sdStar(vec2 p,float r,float n,float inner){ float an=3.14159265/n; float m=clamp(2.0+(n-2.0)*inner,2.0,n); float en=3.14159265/m;
  vec2 acs=vec2(cos(an),sin(an)),ecs=vec2(cos(en),sin(en)); float bn=mod(atan(p.x,-p.y),2.0*an)-an; p=length(p)*vec2(cos(bn),abs(sin(bn))); p-=r*acs; p+=ecs*clamp(-dot(p,ecs),0.0,r*acs.y/ecs.y); return length(p)*sign(p.x); }
float sdSeg(vec2 p,vec2 a,vec2 b){ vec2 pa=p-a,ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.0,1.0); return length(pa-ba*h); }
float sdTri(vec2 p,vec2 p0,vec2 p1,vec2 p2){ vec2 e0=p1-p0,e1=p2-p1,e2=p0-p2,v0=p-p0,v1=p-p1,v2=p-p2;
  vec2 pq0=v0-e0*clamp(dot(v0,e0)/dot(e0,e0),0.0,1.0),pq1=v1-e1*clamp(dot(v1,e1)/dot(e1,e1),0.0,1.0),pq2=v2-e2*clamp(dot(v2,e2)/dot(e2,e2),0.0,1.0);
  float s=sign(e0.x*e2.y-e0.y*e2.x); vec2 d=min(min(vec2(dot(pq0,pq0),s*(v0.x*e0.y-v0.y*e0.x)),vec2(dot(pq1,pq1),s*(v1.x*e1.y-v1.y*e1.x))),vec2(dot(pq2,pq2),s*(v2.x*e2.y-v2.y*e2.x)));
  return -sqrt(d.x)*sign(d.y); }
float dot2(vec2 v){ return dot(v,v); }
float sdHeart(vec2 p){ p.x=abs(p.x); if(p.y+p.x>1.0) return sqrt(dot2(p-vec2(0.25,0.75)))-sqrt(2.0)/4.0; return sqrt(min(dot2(p-vec2(0.0,1.0)),dot2(p-0.5*max(p.x+p.y,0.0))))*sign(p.x-p.y); }
float prof(float t,int k){ t=clamp(t,0.0,1.0); if(k==1) return sqrt(1.0-(1.0-t)*(1.0-t)); if(k==2) return 1.0-sqrt(max(1.0-t*t,0.0)); if(k==3) return smoothstep(0.0,1.0,t);
  if(k==4){ float u=t*2.999; return (floor(u)+smoothstep(0.3,0.7,fract(u)))/3.0; } if(k==5) return sin(t*1.5707963); return t; }
float sd(vec2 q){
  if(uKind==5||uKind==6){ float d=sdSeg(q,uA,uB)-uW*0.5; if(uKind==6){ vec2 dir=normalize(uB-uA+vec2(1e-6)),nr=vec2(-dir.y,dir.x); float hl=uW*uHead; vec2 base=uB-dir*hl;
      d=min(sdSeg(q,uA,base)-uW*0.5,sdTri(q,uB,base+nr*hl*0.6,base-nr*hl*0.6)); } return d; }
  vec2 p=q-uC; float c=cos(uRot),s=sin(uRot); p=vec2(c*p.x+s*p.y,-s*p.x+c*p.y); float m=min(uH.x,uH.y);
  if(uKind==0) return sdBox(p,uH,0.0);
  if(uKind==1) return sdBox(p,uH,uCorner);
  if(uKind==2) return sdEll(p,uH);
  if(uKind==3) return sdPoly(p/uH,1.0,uSides)*m;
  if(uKind==4) return sdStar(p/uH,1.0,uSides,uInner)*m;
  /* heart: fits its box, point at the bottom */
  vec2 h=vec2(p.x/uH.x*0.604,(0.5-0.5*p.y/uH.y)*1.104); return sdHeart(h)/0.58*m; }
void main(){ vec2 q=gl_FragCoord.xy; float d=sd(q); float fill=clamp(0.5-d,0.0,1.0);
  if(uOut==0){ vec4 r=vec4(0.0); if(uFillOn==1) r=vec4(uFill*fill,fill);
    if(uLineOn==1){ float a=clamp(0.5-d,0.0,1.0)*clamp(uLineW+d+0.5,0.0,1.0); r=vec4(uLine*a,a)+r*(1.0-a); } o=r; return; }
  /* height: mid-grey is flat; the bevel rises over its size from the edge in */
  float h=uBev.x>0.5?prof(-d/max(uBev.y,0.5),int(uBev.w+0.5))*uBev.z:0.0; o=vec4(vec3(clamp(0.5+h*0.5,0.0,1.0))*fill,fill); }`;
let SHP=null;
function shapeProg(){if(!SHP)SHP=program(FS_SHAPE);return SHP;}
function shapeUniforms(s){const x0=Math.min(s.x0,s.x1),x1=Math.max(s.x0,s.x1),y0=Math.min(s.y0,s.y1),y1=Math.max(s.y0,s.y1),B=s.bevel||{};
  return {uC:[(x0+x1)/2,(y0+y1)/2],uH:[Math.max(.5,(x1-x0)/2),Math.max(.5,(y1-y0)/2)],uRot:(s.rot||0)*Math.PI/180,uKind:{int:Math.max(0,SHAPE_KINDS.findIndex(k=>k[0]===s.kind))},
    uCorner:s.corner||0,uSides:Math.max(3,s.sides||5),uInner:s.inner==null?.5:s.inner,uA:[s.x0,s.y0],uB:[s.x1,s.y1],uW:Math.max(1,s.lineW||1),uHead:s.head||3,
    uFill:s.fill||[1,1,1],uLine:s.line||[0,0,0],uLineW:s.lineW||0,uFillOn:lineKind(s.kind)?true:s.fillOn!==false,uLineOn:!lineKind(s.kind)&&!!s.lineOn,
    uBev:[B.on?1:0,B.size||0,(B.depth==null?.6:B.depth)*(B.dir==='down'?-1:1),Math.max(0,BEVEL_PROFILES.findIndex(p=>p[0]===B.profile))]};}
/* draw the shape into the layer: base colour, and the height map when bevelled */
function renderShape(L){const s=L.shape;if(!s)return;const P=shapeProg(),u=shapeUniforms(s),B=ensureMapTarget(L,'base');
  run(P,B,Object.assign({},u,{uOut:{int:0}}));
  if(s.bevel&&s.bevel.on){if(!doc.maps.includes('height'))setDocMaps([...doc.maps,'height'],'Add Height for the bevel');run(P,ensureMapTarget(L,'height'),Object.assign({},u,{uOut:{int:1}}));}
  else{const h=L.maps&&L.maps.height;if(h&&!h.empty)clearTarget(h);}
  scheduleThumb(L);requestRender(true);}
const activeShape=()=>isLayer(doc.active)&&doc.active.shape?doc.active:null;
/* edit sessions (one undo step per burst of changes) */
let ssess=null;
const cloneShape=s=>JSON.parse(JSON.stringify(s));
function shapeBegin(L){if(ssess&&ssess.L!==L)shapeCommit();if(!ssess)ssess={L,before:cloneShape(L.shape)};clearTimeout(ssess.timer);}
function shapeTouch(){if(!ssess)return;clearTimeout(ssess.timer);ssess.timer=setTimeout(shapeCommit,700);}
function shapeCommit(){const s=ssess;if(!s)return;ssess=null;clearTimeout(s.timer);const L=s.L;if(!L.shape)return;const a=s.before,b=cloneShape(L.shape);if(JSON.stringify(a)===JSON.stringify(b))return;
  pushUndo({label:'Edit shape',refs:[L],undo(){L.shape=cloneShape(a);renderShape(L);},redo(){L.shape=cloneShape(b);renderShape(L);}});renderLayers();}
function shapeRasterize(L){if(!L||!L.shape)return;if(ssess&&ssess.L===L)shapeCommit();const s=L.shape;L.shape=null;
  pushUndo({label:'Convert shape to pixels',refs:[L],undo(){L.shape=s;},redo(){L.shape=null;}});renderLayers();if(ui.tool==='shape')buildBrushPanel();}
/* a setting changed in the panel: the active shape follows (and new shapes use it) */
function shapeSet(fn){fn(ui.shape);const L=ui.tool==='shape'?activeShape():null;if(L){shapeBegin(L);fn(L.shape);renderShape(L);shapeTouch();drawXfOverlay();}}

/* ---- on the canvas ---- */
function shapeBox(s){return [Math.min(s.x0,s.x1),Math.min(s.y0,s.y1),Math.max(s.x0,s.x1),Math.max(s.y0,s.y1)];}
function shapeCorners(s){const [x0,y0,x1,y1]=shapeBox(s),cx=(x0+x1)/2,cy=(y0+y1)/2,r=(s.rot||0)*Math.PI/180,c=Math.cos(r),sn=Math.sin(r);
  return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>[cx+c*(x-cx)-sn*(y-cy),cy+sn*(x-cx)+c*(y-cy)]);}
function shapeHandles(s){if(lineKind(s.kind))return [{id:'a',pos:[s.x0,s.y0]},{id:'b',pos:[s.x1,s.y1]}];
  const C=shapeCorners(s),[x0,y0,x1,y1]=shapeBox(s),cx=(x0+x1)/2,cy=(y0+y1)/2,r=(s.rot||0)*Math.PI/180,top=[(C[0][0]+C[1][0])/2,(C[0][1]+C[1][1])/2];
  const off=24/view.zoom;return [...C.map((p,i)=>({id:'c'+i,pos:p})),{id:'rot',pos:[top[0]+Math.sin(r)*off,top[1]-Math.cos(r)*off]}];}
function shapeInside(s,x,y){if(lineKind(s.kind)){const ax=s.x1-s.x0,ay=s.y1-s.y0,t=clamp(((x-s.x0)*ax+(y-s.y0)*ay)/((ax*ax+ay*ay)||1),0,1);return Math.hypot(x-s.x0-ax*t,y-s.y0-ay*t)<=Math.max(6/view.zoom,(s.lineW||1)*(s.kind==='arrow'?s.head||3:1)/2);}
  const [x0,y0,x1,y1]=shapeBox(s),cx=(x0+x1)/2,cy=(y0+y1)/2,r=-(s.rot||0)*Math.PI/180,dx=x-cx,dy=y-cy,lx=Math.cos(r)*dx-Math.sin(r)*dy,ly=Math.sin(r)*dx+Math.cos(r)*dy;
  return Math.abs(lx)<=(x1-x0)/2&&Math.abs(ly)<=(y1-y0)/2;}
function shapeHit(sx,sy,ix,iy){const L=activeShape();if(!L)return null;for(const h of shapeHandles(L.shape)){const q=scrPt(h.pos);if(Math.hypot(q[0]-sx,q[1]-sy)<=8)return {L,id:h.id};}
  return shapeInside(L.shape,ix,iy)?{L,id:'move'}:null;}
function shapeHover(e){const [sx,sy]=stageXY(e),[ix,iy]=toImage(e.clientX,e.clientY),h=shapeHit(sx,sy,ix,iy);cv.style.cursor=!h?'crosshair':h.id==='move'?'move':'grab';}
function shapePointerDown(e,ix,iy){if(ui.mode==='anim'){toast('Shapes are available in Paint mode.');return;}const [sx,sy]=stageXY(e),h=shapeHit(sx,sy,ix,iy);
  if(h){shapeBegin(h.L);ptr={mode:'shape',id:e.pointerId,h,m0:[ix,iy],s0:cloneShape(h.L.shape)};return;}
  /* a new shape layer, shown while dragging; one undo step when done */
  const L=newLayerObj(SHAPE_KINDS.find(k=>k[0]===ui.shape.kind)[1]);L.shape=Object.assign(cloneShape(ui.shape),{fill:ui.fg.slice(),line:ui.shape.lineOn?ui.bg.slice():ui.shape.line.slice(),x0:ix,y0:iy,x1:ix,y1:iy,rot:0});
  if(lineKind(L.shape.kind))L.shape.fill=ui.fg.slice();
  const [p,i]=insertPoint();insertNode(L,p,i);const prev=doc.active,prevSel=[...doc.sel];selectOnly(L);
  ptr={mode:'shape',id:e.pointerId,h:{L,id:'new',prev,prevSel,p,i},m0:[ix,iy],moved:false};renderLayers();}
function shapePointerMove(e,ix,iy){const p=ptr,s=p.h.L.shape,dx=ix-p.m0[0],dy=iy-p.m0[1];
  if(p.h.id==='new'){if(Math.hypot(dx,dy)*view.zoom<3&&!p.moved)return;p.moved=true;let x=ix,y=iy;
    if(e.shiftKey){if(lineKind(s.kind)){const a=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4),d=Math.hypot(dx,dy);x=p.m0[0]+Math.cos(a)*d;y=p.m0[1]+Math.sin(a)*d;}
      else{const m=Math.max(Math.abs(dx),Math.abs(dy));x=p.m0[0]+Math.sign(dx||1)*m;y=p.m0[1]+Math.sign(dy||1)*m;}}
    if(e.altKey&&!lineKind(s.kind)){s.x0=p.m0[0]-(x-p.m0[0]);s.y0=p.m0[1]-(y-p.m0[1]);}else{s.x0=p.m0[0];s.y0=p.m0[1];}s.x1=x;s.y1=y;}
  else{const s0=p.s0;
    if(p.h.id==='move'){for(const k of ['x0','x1'])s[k]=s0[k]+dx;for(const k of ['y0','y1'])s[k]=s0[k]+dy;}
    else if(p.h.id==='a'){s.x0=s0.x0+dx;s.y0=s0.y0+dy;}else if(p.h.id==='b'){s.x1=s0.x1+dx;s.y1=s0.y1+dy;}
    else if(p.h.id==='rot'){const [x0,y0,x1,y1]=shapeBox(s0),cx=(x0+x1)/2,cy=(y0+y1)/2;let a=Math.atan2(ix-cx,-(iy-cy))*180/Math.PI;if(e.shiftKey)a=Math.round(a/15)*15;s.rot=a;}
    else{/* a corner: the opposite one stays put, sizes measured along the shape's own axes */
      const i=+p.h.id.slice(1),C=shapeCorners(s0),opp=C[(i+2)%4],r=(s0.rot||0)*Math.PI/180,c=Math.cos(r),sn=Math.sin(r);
      const vx=ix-opp[0],vy=iy-opp[1];let lw=c*vx+sn*vy,lh=-sn*vx+c*vy;if(e.shiftKey){const m=Math.max(Math.abs(lw),Math.abs(lh));lw=Math.sign(lw||1)*m;lh=Math.sign(lh||1)*m;}
      const mx=opp[0]+(c*lw-sn*lh)/2,my=opp[1]+(sn*lw+c*lh)/2;s.x0=mx-Math.abs(lw)/2;s.x1=mx+Math.abs(lw)/2;s.y0=my-Math.abs(lh)/2;s.y1=my+Math.abs(lh)/2;}}
  renderShape(p.h.L);drawXfOverlay();}
function shapePointerUp(){const p=ptr,h=p.h;ptr=null;
  if(h.id==='new'){const L=h.L;detachNode(L);doc.active=h.prev;doc.sel=new Set(h.prevSel);
    if(!p.moved){disposeLayer(L);renderLayers();requestRender(true);return;}
    structOp('Shape',()=>{insertNode(L,h.p,h.i);selectOnly(L);});renderShape(L);buildBrushPanel();drawXfOverlay();return;}
  shapeTouch();}
function shapeOverlay(){if(ui.tool!=='shape')return '';const L=activeShape();if(!L)return '';const s=L.shape;let o='';
  if(!lineKind(s.kind)){const C=shapeCorners(s).map(scrPt);o+='<path class="ln" d="M'+C.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join('L')+'Z"/>';}
  for(const h of shapeHandles(s)){const q=scrPt(h.pos);o+=h.id==='rot'?'<circle class="pv" cx="'+q[0]+'" cy="'+q[1]+'" r="5"/>':'<rect class="hs" x="'+(q[0]-4)+'" y="'+(q[1]-4)+'" width="8" height="8"/>';}
  return o;}

/* ---- the panel ---- */
function colourBtn(id,get,set,title){const i=el('input',{type:'color',id,value:toHex(get()),title,'aria-label':title});i.addEventListener('input',()=>{const c=fromHex(i.value);if(c)set(c);});return i;}
function buildShapePanel(box){const L=activeShape(),S=L?L.shape:ui.shape;$('#brushTitle').textContent=L?'Shape layer':'Shape';
  const sl=(id,label,get,set,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:get(),fmt,onInput:v=>shapeSet(s=>set(s,v))}).el;
  box.append(el('p',{class:'note',text:L?'Drag the corners to resize, the round handle to turn, inside to move. Painting on it or transforming it turns it into pixels.':'Drag on the canvas to draw a shape on a new layer (Shift: square or straight; Alt: from the centre). It fills with the foreground colour.'}),
    seg(SHAPE_KINDS.map(([k,t])=>[k,t]),ui.shape.kind,v=>{ui.shape.kind=v;buildBrushPanel();},'Shape for new shapes'));
  const g=box.lastChild;g.classList.add('themeseg');
  const line=lineKind(S.kind);
  if(!line){box.append(el('div',{class:'frow'},chk('shpFillOn','Fill',S.fillOn!==false,v=>shapeSet(s=>{s.fillOn=v;})),L?colourBtn('shpFill',()=>S.fill||ui.fg,c=>shapeSet(s=>{s.fill=c;}),'Fill colour'):el('span',{class:'note',text:'foreground colour'})),
      el('div',{class:'frow'},chk('shpLineOn','Outline',!!S.lineOn,v=>{shapeSet(s=>{s.lineOn=v;});buildBrushPanel();}),colourBtn('shpLine',()=>S.line||[0,0,0],c=>shapeSet(s=>{s.line=c;}),'Outline colour')));
    if(S.lineOn)box.append(sl('shpLineW','Outline',()=>S.lineW,(s,v)=>{s.lineW=v;},1,100,1,v=>v+' px'));}
  else box.append(el('div',{class:'frow'},el('span',{text:'Colour'}),L?colourBtn('shpFill',()=>S.fill||ui.fg,c=>shapeSet(s=>{s.fill=c;}),'Colour'):el('span',{class:'note',text:'foreground colour'})),
    sl('shpLineW','Thickness',()=>S.lineW,(s,v)=>{s.lineW=v;},1,200,1,v=>v+' px'));
  if(S.kind==='round')box.append(sl('shpCorner','Corners',()=>S.corner,(s,v)=>{s.corner=v;},0,400,1,v=>v+' px'));
  if(S.kind==='poly'||S.kind==='star')box.append(sl('shpSides',S.kind==='star'?'Points':'Sides',()=>S.sides,(s,v)=>{s.sides=v;},3,24,1,v=>String(v)));
  if(S.kind==='star')box.append(sl('shpInner','Inner radius',()=>S.inner,(s,v)=>{s.inner=v;},.1,.95,.01,pct));
  if(S.kind==='arrow')box.append(sl('shpHead','Head size',()=>S.head,(s,v)=>{s.head=v;},1.5,8,.1,v=>v.toFixed(1)+'×'));
  const B=S.bevel||(S.bevel={on:false,profile:'round',size:16,depth:.6,dir:'up'});
  box.append(el('div',{class:'sub',text:'Bevel'}),chk('shpBevel','Bevel (raises the Height map)',!!B.on,v=>{shapeSet(s=>{s.bevel.on=v;});buildBrushPanel();}));
  if(B.on){const pg=seg(BEVEL_PROFILES,B.profile,v=>shapeSet(s=>{s.bevel.profile=v;}),'Bevel profile');pg.classList.add('themeseg');
    box.append(pg,sl('shpBevSize','Size',()=>B.size,(s,v)=>{s.bevel.size=v;},1,200,1,v=>v+' px'),sl('shpBevDepth','Depth',()=>B.depth,(s,v)=>{s.bevel.depth=v;},0,1,.01,pct),
      seg([['up','Raised'],['down','Sunken']],B.dir||'up',v=>shapeSet(s=>{s.bevel.dir=v;}),'Bevel direction'));}
  if(L)box.append(el('div',{class:'row wrap'},el('button',{class:'btn',id:'shpRaster',text:'Convert to pixels',onclick:()=>shapeRasterize(L)})));}

(function(){const bar=$('#tools'),b=el('button',{class:'tool','data-tool':'shape',title:'Shape (U)','aria-label':'Shape','aria-pressed':'false'});
  b.innerHTML='<svg viewBox="0 0 24 24"><rect x="3.5" y="10" width="9" height="9" rx="1.5"/><circle cx="15.5" cy="8.5" r="5"/></svg>';
  b.addEventListener('click',()=>setTool('shape'));bar.insertBefore(b,bar.querySelector('.tool[data-tool="text"]'));})();
