/* ================= Transforms: on-canvas handles, Move tool, panel ================= */
const xfOv=document.createElementNS('http://www.w3.org/2000/svg','svg');xfOv.id='xfOv';xfOv.setAttribute('aria-hidden','true');stage.append(xfOv);
const ROT_CURSOR='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M6 14a7 7 0 1 0 2-7" fill="none" stroke="#000" stroke-width="3.2"/><path d="M6 14a7 7 0 1 0 2-7" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M4 4l5 3-5 3z" fill="#fff" stroke="#000" stroke-width="1"/></svg>')+'") 12 12, crosshair';
const xfLocalRect=()=>{const [x0,y0,x1,y1]=xf.rect,cx=(x0+x1)/2,cy=(y0+y1)/2;return {x0,y0,x1,y1,cx,cy,LC:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],EM:[[cx,y0],[x1,cy],[cx,y1],[x0,cy]]};};
const scrPt=p=>toScreen(p[0],p[1]);
function xfHandles(){const H=rectToQuad(xf.rect,xf.q),R=xfLocalRect();
  return {H,corners:R.LC.map(p=>apply3(H,p[0],p[1])),edges:R.EM.map(p=>apply3(H,p[0],p[1])),pivot:apply3(H,xf.pivot[0],xf.pivot[1])};}
function pointInPoly(x,y,pts){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}return c;}
function stageXY(e){const r=stage.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}

/* what is under the pointer */
function xfHit(sx,sy){const near=(p,r)=>{const s=scrPt(p);return Math.hypot(s[0]-sx,s[1]-sy)<=(r||8);};
  if(xf.warp){const W=xf.warp;
    if(W.active){const [i,j]=W.active;const hs=warpHandlesOf(W,i,j);for(const h of hs)if(near(h))return {type:'whandle',p:h};}
    for(let j=0;j<=W.n;j++)for(let i=0;i<=W.n;i++)if(near(W.A[j][i]))return {type:'wanchor',i,j};
    return null;}
  const h=xfHandles();
  if(near(h.pivot,7))return {type:'pivot'};
  for(let k=0;k<4;k++)if(near(h.corners[k]))return {type:'corner',k};
  for(let k=0;k<4;k++)if(near(h.edges[k]))return {type:'edge',k};
  if(pointInPoly(sx,sy,h.corners.map(scrPt)))return {type:'move'};
  return {type:'rotate'};}
function xfCursor(hit,e){if(!hit)return '';if(hit.type==='move')return 'move';if(hit.type==='rotate')return ROT_CURSOR;if(hit.type==='pivot')return 'crosshair';
  if(hit.type==='corner')return (e&&(e.ctrlKey||e.metaKey))?'default':(hit.k%2?'nesw-resize':'nwse-resize');if(hit.type==='edge')return (e&&(e.ctrlKey||e.metaKey))?(hit.k%2?'ns-resize':'ew-resize'):(hit.k%2?'ew-resize':'ns-resize');return 'pointer';}
function xfHover(e){const [sx,sy]=stageXY(e);cv.style.cursor=xfCursor(xfHit(sx,sy),e);}

function xfPointerDown(e,ix,iy){const [sx,sy]=stageXY(e);let hit=xfHit(sx,sy);if(hit&&xf.dragMode==='rotate'&&hit.type!=='pivot')hit={type:'rotate'};if(hit&&['skew','shear'].includes(xf.dragMode)&&hit.type==='corner')hit={type:'edge',k:hit.k<2?0:2};
  if(!hit){if(xf.warp){xf.warp.active=null;drawXfOverlay();}return;}
  const H0=rectToQuad(xf.rect,xf.q),Hi=inv3(H0);
  ptr={mode:'xf',id:e.pointerId,hit,q0:xf.q.slice(),H0,Hi,m0:[ix,iy],u0:apply3(Hi,ix,iy),pd:apply3(H0,xf.pivot[0],xf.pivot[1])};
  if(hit.type==='wanchor'){xf.warp.active=[hit.i,hit.j];ptr.last=[ix,iy];}
  if(hit.type==='whandle')ptr.last=[ix,iy];
  drawXfOverlay();}
function xfPointerMove(e,ix,iy){const p=ptr,h=p.hit,R=xfLocalRect(),dx=ix-p.m0[0],dy=iy-p.m0[1],ctrl=e.ctrlKey||e.metaKey||['distort','skew','shear'].includes(xf.dragMode);
  const fromLocal=pts=>pts.flatMap(q=>apply3(p.H0,q[0],q[1]));const u=apply3(p.Hi,ix,iy);
  if(h.type==='wanchor'||h.type==='whandle'){const W=xf.warp,ddx=ix-p.last[0],ddy=iy-p.last[1];p.last=[ix,iy];
    if(h.type==='wanchor')warpMoveAnchor(W,h.i,h.j,ddx,ddy);else{h.p[0]+=ddx;h.p[1]+=ddy;W.mesh=null;}
    xfRender(true);drawXfOverlay();return;}
  if(h.type==='pivot'){const Hi=inv3(rectToQuad(xf.rect,xf.q));xf.pivot=apply3(Hi,ix,iy);drawXfOverlay();return;}
  if(h.type==='move'){let mx=dx,my=dy;if(e.shiftKey){if(Math.abs(mx)>Math.abs(my))my=0;else mx=0;}xf.q=p.q0.map((v,i)=>v+(i%2?my:mx));}
  else if(h.type==='rotate'){let a=Math.atan2(iy-p.pd[1],ix-p.pd[0])-Math.atan2(p.m0[1]-p.pd[1],p.m0[0]-p.pd[0]);if(e.shiftKey)a=Math.round(a/(Math.PI/12))*(Math.PI/12);
    const c=Math.cos(a),s=Math.sin(a);xf.q=[];for(let i=0;i<8;i+=2){const x=p.q0[i]-p.pd[0],y=p.q0[i+1]-p.pd[1];xf.q.push(p.pd[0]+x*c-y*s,p.pd[1]+x*s+y*c);}}
  else if(h.type==='corner'&&xf.dragMode==='perspective'){const k=h.k,pair=k^1;xf.q=p.q0.slice();xf.q[k*2]+=dx;xf.q[k*2+1]+=dy;xf.q[pair*2]-=dx;xf.q[pair*2+1]+=dy;}
  else if(h.type==='corner'&&ctrl){xf.q=p.q0.slice();xf.q[h.k*2]+=dx;xf.q[h.k*2+1]+=dy;}
  else if(h.type==='corner'){const c=R.LC[h.k],a=e.altKey?[R.cx,R.cy]:R.LC[(h.k+2)%4];let sx=(u[0]-a[0])/(c[0]-a[0]),sy=(u[1]-a[1])/(c[1]-a[1]);
    if(!e.shiftKey){const vx=c[0]-a[0],vy=c[1]-a[1],s=((u[0]-a[0])*vx+(u[1]-a[1])*vy)/(vx*vx+vy*vy);sx=sy=s;}
    xf.q=fromLocal(R.LC.map(q=>[a[0]+(q[0]-a[0])*sx,a[1]+(q[1]-a[1])*sy]));}
  else if(h.type==='edge'&&ctrl){const k=h.k,d=k%2===0?u[0]-p.u0[0]:u[1]-p.u0[1];
    const A=k===0?(e.altKey?R.cy:R.y1):k===2?(e.altKey?R.cy:R.y0):k===1?(e.altKey?R.cx:R.x0):(e.altKey?R.cx:R.x1),E=k===0?R.y0:k===2?R.y1:k===1?R.x1:R.x0;
    xf.q=fromLocal(R.LC.map(q=>k%2===0?[q[0]+d*(q[1]-A)/(E-A),q[1]]:[q[0],q[1]+d*(q[0]-A)/(E-A)]));}
  else if(h.type==='edge'){const k=h.k;let sx=1,sy=1;
    if(k%2===0){const c=k===0?R.y0:R.y1,a=e.altKey?R.cy:(k===0?R.y1:R.y0);sy=(u[1]-a)/(c-a);xf.q=fromLocal(R.LC.map(q=>[q[0],a+(q[1]-a)*sy]));}
    else{const c=k===1?R.x1:R.x0,a=e.altKey?R.cx:(k===1?R.x0:R.x1);sx=(u[0]-a)/(c-a);xf.q=fromLocal(R.LC.map(q=>[a+(q[0]-a)*sx,q[1]]));}}
  xfRender(true);drawXfOverlay();xfPanelSync();}
function xfPointerUp(){ptr=null;xfRender(false);drawXfOverlay();xfPanelSync();}

/* ---- overlay drawing ---- */
function drawXfOverlay(){if(!xf||xf.move){if(typeof crop!=='undefined'&&crop){drawCropOverlay();return;}const g=(ui.cageFlat?'':(typeof drawGradOverlay==='function'?drawGradOverlay():'')+(typeof lkOverlay==='function'?lkOverlay()+shapeOverlay():''))+cageOverlay()+(typeof cvOverlay==='function'?cvOverlay():'')+(typeof pxfOverlay2D==='function'&&!ui.cageFlat?pxfOverlay2D():'');if(g){xfOv.innerHTML=g;return;}if(xfOv.firstChild)xfOv.replaceChildren();return;}
  const f=p=>scrPt(p).map(v=>v.toFixed(1)).join(' ');let s='';
  if(xf.warp){const W=xf.warp;let d='';
    for(let j=0;j<=W.n;j++)for(let i=0;i<W.n;i++){const e=W.hE[j][i];d+='M'+f(W.A[j][i])+'C'+f(e[0])+' '+f(e[1])+' '+f(W.A[j][i+1]);}
    for(let i=0;i<=W.n;i++)for(let j=0;j<W.n;j++){const e=W.vE[i][j];d+='M'+f(W.A[j][i])+'C'+f(e[0])+' '+f(e[1])+' '+f(W.A[j+1][i]);}
    s+='<path class="ln" d="'+d+'"/>';
    if(W.active){const [i,j]=W.active,a=W.A[j][i];for(const h of warpHandlesOf(W,i,j)){s+='<path class="hl" d="M'+f(a)+'L'+f(h)+'"/>';const q=scrPt(h);s+='<circle class="hc" cx="'+q[0]+'" cy="'+q[1]+'" r="4"/>';}}
    for(let j=0;j<=W.n;j++)for(let i=0;i<=W.n;i++){const q=scrPt(W.A[j][i]),on=W.active&&W.active[0]===i&&W.active[1]===j;s+='<rect class="hs'+(on?' on':'')+'" x="'+(q[0]-4)+'" y="'+(q[1]-4)+'" width="8" height="8"/>';}}
  else{const h=xfHandles();s+='<path class="ln" d="M'+h.corners.map(f).join('L')+'Z"/>';
    for(const p of [...h.corners,...h.edges]){const q=scrPt(p);s+='<rect class="hs" x="'+(q[0]-4)+'" y="'+(q[1]-4)+'" width="8" height="8"/>';}
    const q=scrPt(h.pivot);s+='<circle class="pv" cx="'+q[0]+'" cy="'+q[1]+'" r="5"/><path class="pv" d="M'+(q[0]-8)+' '+q[1]+'H'+(q[0]+8)+'M'+q[0]+' '+(q[1]-8)+'V'+(q[1]+8)+'"/>';}
  xfOv.innerHTML=s;}

/* ---- numbers: position, scale, angle, skew (for boxes that are not distorted) ---- */
function xfDecompose(){if(!isParallelogram(xf.q))return null;const q=xf.q,w=xf.rect[2]-xf.rect[0],h=xf.rect[3]-xf.rect[1];
  const a=(q[2]-q[0])/w,c=(q[3]-q[1])/w,b=(q[6]-q[0])/h,d=(q[7]-q[1])/h,th=Math.atan2(c,a),co=Math.cos(th),si=Math.sin(th),sx=Math.hypot(a,c),sy=-si*b+co*d,k=Math.abs(sy)<1e-9?0:(co*b+si*d)/sy;
  const pd=apply3(rectToQuad(xf.rect,xf.q),xf.pivot[0],xf.pivot[1]);return {x:pd[0],y:pd[1],sx,sy,ang:th*180/Math.PI,skew:Math.atan(k)*180/Math.PI};}
function xfCompose(v){const th=v.ang*Math.PI/180,co=Math.cos(th),si=Math.sin(th),k=Math.tan(v.skew*Math.PI/180),sx=v.sx,sy=v.sy;
  const L=[co*sx,co*k*sy-si*sy,si*sx,si*k*sy+co*sy],R=xfLocalRect();
  xf.q=R.LC.flatMap(p=>{const x=p[0]-xf.pivot[0],y=p[1]-xf.pivot[1];return [v.x+L[0]*x+L[1]*y,v.y+L[2]*x+L[3]*y];});}
let xfFields=null;ui.xfLink=true;
function xfPanelSync(){const v=xf&&!xf.warp?xfDecompose():null;
  for(const [k,inp,fmt] of xfFields||[]){inp.disabled=!v;if(document.activeElement!==inp)inp.value=v?fmt(v[k]):'';}
  if(typeof xfQuickSync==='function')xfQuickSync();
  const n=$('#xfNote');if(n)n.textContent=xf&&xf.warp?'':(v?'':'Distorted: drag the handles, or use the buttons.');}
function buildXfPanel(box){$('#brushTitle').textContent=xf.warp?'Warp':'Transform';xfFields=null;
  const sel_=el('select',{id:'xfInterp','aria-label':'Resampling'},...[['2','Smooth (bicubic)'],['1','Bilinear'],['0','Nearest (pixel art)']].map(([v,t])=>el('option',{value:v,text:t})));sel_.value=String(ui.xfInterp);
  sel_.addEventListener('change',()=>{ui.xfInterp=+sel_.value;xfRender(false);xfQuickSync();});
  if(!xf.warp){const mk=(k,label,fmt,parse)=>{const inp=el('input',{class:'num',type:'number',id:'xf_'+k,step:'any','aria-label':label});
      inp.addEventListener('change',()=>{const v=xfDecompose();if(!v)return;const n=parseFloat(inp.value);if(!isFinite(n))return;const old=v[k];v[k]=parse(n);
        if(ui.xfLink&&(k==='sx'||k==='sy')&&old){const r=v[k]/old;if(k==='sx')v.sy*=r;else v.sx*=r;}
        xfCompose(v);xfRender(false);drawXfOverlay();xfPanelSync();});
      return [k,inp,fmt,label];};
    xfFields=[mk('x','X',v=>v.toFixed(1),n=>n),mk('y','Y',v=>v.toFixed(1),n=>n),mk('sx','W %',v=>(v*100).toFixed(1),n=>n/100),mk('sy','H %',v=>(v*100).toFixed(1),n=>n/100),mk('ang','Angle °',v=>v.toFixed(1),n=>n),mk('skew','Skew °',v=>v.toFixed(1),n=>n)];
    const grid=el('div',{class:'xfgrid'});for(const [k,inp,,label] of xfFields)grid.append(el('label',{for:inp.id,text:label}),inp);
    box.append(grid,chk('xfLink','Keep W and H proportional when typing',ui.xfLink,v=>{ui.xfLink=v;xfQuickSync();}),el('div',{class:'sub',id:'xfNote'}));
    box.append(el('div',{class:'frow'},
      el('button',{class:'btn sm',text:'Flip ↔',title:'Flip horizontally',onclick:()=>xfFlip(true)}),el('button',{class:'btn sm',text:'Flip ↕',title:'Flip vertically',onclick:()=>xfFlip(false)}),
      el('button',{class:'btn sm',text:'↻ 90°',title:'Rotate 90° clockwise',onclick:()=>xfRot90(1)}),el('button',{class:'btn sm',text:'↺ 90°',title:'Rotate 90° counter-clockwise',onclick:()=>xfRot90(-1)})));}
  box.append(el('div',{class:'frow'},el('label',{for:'xfInterp',text:'Resampling'}),sel_));
  const gs=el('select',{id:'xfGrid','aria-label':'Warp grid'},...[2,3,4,5,6,8].map(n=>el('option',{value:String(n),text:n+' × '+n})));gs.value=String(ui.warpN);
  gs.addEventListener('change',()=>{ui.warpN=+gs.value;if(xf.warp){warpResize(ui.warpN);xfRender(false);drawXfOverlay();xfPanelSync();}});
  if(!xf.warp)box.append(el('div',{class:'frow'},el('button',{class:'btn sm',text:'Warp',title:'Bend the image with a grid of curved cells',onclick:()=>{warpInit(ui.warpN);xfRender(false);buildBrushPanel();drawXfOverlay();}}),el('label',{for:'xfGrid',text:'Grid'}),gs));
  else box.append(el('div',{class:'frow'},el('label',{for:'xfGrid',text:'Grid'}),gs,el('button',{class:'btn sm',text:'Reset warp',onclick:()=>{warpInit(ui.warpN);xfRender(false);drawXfOverlay();}})));
  box.append(el('div',{class:'frow'},el('button',{class:'btn sm primary',text:'Apply (Enter)',onclick:xfCommit}),el('button',{class:'btn sm',text:'Cancel (Esc)',onclick:xfCancel})));
  box.append(el('div',{class:'sub',text:xf.warp?'Drag a grid point to bend the image; click a point to show its curve handles and drag those for finer bends.':
    'Corners scale proportionally (Shift stretches freely). Sides scale one way. Drag outside to rotate (Shift snaps 15°). Ctrl+drag a side to skew, Ctrl+drag a corner to distort. Alt works from the centre. Drag the centre mark to rotate around another point.'}));
  xfPanelSync();}
function xfFlip(h){const q=xf.q,P=i=>[q[i*2],q[i*2+1]];const o=h?[1,0,3,2]:[3,2,1,0];xf.q=o.flatMap(i=>P(i));xf.contentSel=!!xf.selItem;xfRender(false);drawXfOverlay();xfPanelSync();}
function xfRot90(dir){const H=rectToQuad(xf.rect,xf.q),pd=apply3(H,xf.pivot[0],xf.pivot[1]),q=xf.q;xf.q=[];
  for(let i=0;i<8;i+=2){const x=q[i]-pd[0],y=q[i+1]-pd[1];xf.q.push(pd[0]-dir*y,pd[1]+dir*x);}xfRender(false);drawXfOverlay();xfPanelSync();}
function freeTransform(){if(xf)return;if(xfStart()){xfRender(false);toast('Transform: drag the handles, Enter applies, Esc cancels.');}}

/* ---- Move tool (V) ---- */
function movePointerDown(e,ix,iy){if(!xfStart({move:true,copy:e.altKey&&sel.active}))return;ptr={mode:'movedrag',id:e.pointerId,m0:[ix,iy],q0:xf.q.slice(),d:[0,0]};}
function movePointerMove(e,ix,iy){let dx=Math.round(ix-ptr.m0[0]),dy=Math.round(iy-ptr.m0[1]);if(e.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}
  if(dx===ptr.d[0]&&dy===ptr.d[1])return;ptr.d=[dx,dy];xf.q=ptr.q0.map((v,i)=>v+(i%2?dy:dx));xfRender(true);}
function movePointerUp(){const d=ptr.d;ptr=null;if(d[0]||d[1])xfCommit();else xfCancel();}
function nudgeLayer(dx,dy){if(!xfStart({move:true}))return;xf.q=xf.q.map((v,i)=>v+(i%2?dy:dx));xfCommit();}
function buildMovePanel(box){$('#brushTitle').textContent='Move';
  box.append(el('div',{class:'sub',text:'Drag to move the selected layers, or only the selected pixels when there is a selection. Alt+drag copies the selected pixels. Shift keeps the move straight. Arrow keys nudge 1 px, Shift+arrow 10 px.'}),
    el('div',{class:'frow'},el('button',{class:'btn sm',text:'Free transform (Ctrl+T)',onclick:freeTransform})));}

(function addTools(){const bar=$('#tools');
  const mk=(tool,label,icon,before)=>{const b=el('button',{class:'tool','data-tool':tool,title:label,'aria-label':label.replace(/ \(.*\)$/,''),'aria-pressed':'false'});b.innerHTML='<svg viewBox="0 0 24 24">'+icon+'</svg>';b.addEventListener('click',()=>setTool(b.dataset.tool));bar.insertBefore(b,before);};
  mk('move','Move (V)','<path d="M12 3v18M3 12h18"/><path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',bar.firstElementChild);
  const fillIcons={gradient:'<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M8 5v14M12.5 5v14M17 5v14" opacity=".35"/>',bucket:'<path d="M5 11l7-7 7 7-7 7z"/><path d="M19 13.5c1 1.6 1.6 2.6 1.6 3.4a1.6 1.6 0 0 1-3.2 0c0-.8.6-1.8 1.6-3.4z"/><path d="M5 11h14"/>',
    gbucket:'<path d="M5 11l7-7 7 7-7 7z"/><path d="M8.5 7.5l7 7M10.5 5.5l7 7" opacity=".45"/><path d="M19 13.5c1 1.6 1.6 2.6 1.6 3.4a1.6 1.6 0 0 1-3.2 0c0-.8.6-1.8 1.6-3.4z"/>'};
  const tonalIcons={dodge:'<circle cx="9" cy="9" r="5"/><path d="M12.5 12.5 20 20"/>',burn:'<path d="M6 14c0-4 4-6 6-10 2 4 6 6 6 10a6 6 0 0 1-12 0z"/><path d="M10 15.5a2 2 0 0 0 4 0c0-1.2-1-2-2-3.5-1 1.5-2 2.3-2 3.5z"/>'};
  const sm=bar.querySelector('.tool[data-tool="smudge"]').nextElementSibling;
  mk('gradient','Gradient / paint bucket / gradient bucket (G, Shift+G switches)',fillIcons.gradient,sm);mk('dodge','Dodge / burn (O, Shift+O switches)',tonalIcons.dodge,sm);
  window.__groupIcons={gradient:fillIcons.gradient,bucket:fillIcons.bucket,gbucket:fillIcons.gbucket,dodge:tonalIcons.dodge,burn:tonalIcons.burn};
  mk('cage','Cage: bend and flat painting (K)','<path d="M4 6.5 19 4l1 15.5L5 18z"/><path d="M11.6 5.2l.7 13.6M4.5 12.2l15.2-.9" opacity=".55"/><circle cx="4" cy="6.5" r="1.3"/><circle cx="19" cy="4" r="1.3"/><circle cx="20" cy="19.5" r="1.3"/><circle cx="5" cy="18" r="1.3"/>',bar.querySelector('.tool[data-tool="text"]'));
  mk('crop','Crop (C)','<path d="M6 2v16h16"/><path d="M2 6h16v16"/>',bar.querySelector('.tool[data-tool="text"]'));})();
/* keys while a transform is open; returns true if used */
function xfKeys(e,m,k){if(!xf||xf.move)return false;
  if(e.key==='Enter'){e.preventDefault();xfCommit();return true;}
  if(e.key==='Escape'||(m&&k==='z')){e.preventDefault();xfCancel();return true;}
  if(e.key.startsWith('Arrow')){e.preventDefault();const s=e.shiftKey?10:1,d={ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,-s],ArrowDown:[0,s]}[e.key];
    if(xf.warp){const W=xf.warp;if(W.active){warpMoveAnchor(W,W.active[0],W.active[1],d[0],d[1]);}else return true;}else xf.q=xf.q.map((v,i)=>v+(i%2?d[1]:d[0]));
    xfRender(false);drawXfOverlay();xfPanelSync();return true;}
  return false;}

/* tool buttons that hold two tools (gradient/bucket, dodge/burn) show the current one */
ui.fillKind='gradient';ui.tonal='dodge';ui.tonalRange=1;ui.tonalExposure=.5;ui.tonalProtect=true;
function updateGroupButtons(t){const G=window.__groupIcons;if(!G)return;
  for(const [pair,cur] of [[['gradient','bucket','gbucket'],ui.fillKind],[['dodge','burn'],ui.tonal]]){const b=document.querySelector('.tool[data-group="'+pair[0]+'"]');if(!b)continue;
    b.dataset.tool=cur;b.querySelector('svg').innerHTML=G[cur];b.setAttribute('aria-pressed',String(pair.includes(t)));if(b.classList.contains('has-tool-menu'))toolMenuDecorate(b);}}
document.querySelectorAll('.tool[data-tool="gradient"],.tool[data-tool="dodge"]').forEach(b=>{b.dataset.group=b.dataset.tool;});

function xfContextMenu(e){if(!xf||xf.move)return;e.preventDefault();closeMenu();openName=':transform';
  const item=(label,fn,disabled=false)=>el('button',{class:'mi',role:'menuitem',disabled,onclick:()=>{closeMenu();if(xf)fn();}},el('span'),el('span',{text:label}),el('span'));
  const set=mode=>{xf.dragMode=mode;buildBrushPanel();drawXfOverlay();};
  pop.replaceChildren(...[['free','Free transform'],['scale','Scale'],['rotate','Rotate'],['skew','Skew'],['shear','Shear'],['distort','Distort'],['perspective','Perspective']].map(([mode,label])=>item((xf.dragMode===mode?'✓ ':'')+label,()=>set(mode),!!xf.warp)),item('Warp',()=>{if(!xf.warp)warpInit(ui.warpN);set('warp');xfRender(false);}),el('div',{class:'msep'}),item('Flip horizontal',()=>xfFlip(true),!!xf.warp),item('Flip vertical',()=>xfFlip(false),!!xf.warp),item('Rotate 90° clockwise',()=>xfRot90(1),!!xf.warp),el('div',{class:'msep'}),item('Apply transform',xfCommit),item('Cancel transform',xfCancel));
  pop.hidden=false;pop.style.left=Math.max(4,Math.min(e.clientX,innerWidth-pop.offsetWidth-8))+'px';pop.style.top=Math.max(4,Math.min(e.clientY,innerHeight-pop.offsetHeight-8))+'px';pop.querySelector('button:not([disabled])')?.focus();}
