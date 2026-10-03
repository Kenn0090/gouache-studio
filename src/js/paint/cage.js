/* ================= Cage painting and symmetry =================
   A cage is a grid of points laid over part of the document (4 corners, or a grid of columns × rows).
   It defines a smooth surface that maps a flat rectangle ("flat space", fw × fh pixels) onto the document.
   Two ways to paint through it:
   - Bend: paint on the canvas as usual; inside the cage, strokes are made in flat space and bent back,
     so the brush takes the cage's shape.
   - Flat view (F): the canvas shows the cage's contents straightened out; you paint there and every
     stroke is bent back onto the document live.
   Either way a stroke is stamped into cageST (flat space) and drawn through the cage mesh into strokeT
   (document space); from there the normal merge, other maps, selection and undo all work unchanged.
   Symmetry mirrors each dab (left–right, top–bottom, both, or radial) around a centre in the space
   being painted: the document, or the cage's flat space. */
ui.cageNx=4;ui.cageNy=4;ui.cageKind='quad';ui.cagePersp=true;ui.cageFlat=false;
ui.sym={mode:'off',n:6,cx:.5,cy:.5};
let cageST=null,cageViewT=null,cageGL=null,cageSavedView=null;

/* ---------- the surface ---------- */
function cageOf(){return doc.cage||null;}
function cageGet(C,j,i){const nx=C.nx,ny=C.ny;
  if(i<0){const a=cageGet(C,j,0),b=cageGet(C,j,Math.min(1,nx));return [2*a[0]-b[0],2*a[1]-b[1]];}
  if(i>nx){const a=cageGet(C,j,nx),b=cageGet(C,j,Math.max(nx-1,0));return [2*a[0]-b[0],2*a[1]-b[1]];}
  if(j<0){const a=cageGet(C,0,i),b=cageGet(C,Math.min(1,ny),i);return [2*a[0]-b[0],2*a[1]-b[1]];}
  if(j>ny){const a=cageGet(C,ny,i),b=cageGet(C,Math.max(ny-1,0),i);return [2*a[0]-b[0],2*a[1]-b[1]];}
  return C.A[j][i];}
function cr(p0,p1,p2,p3,t){const t2=t*t,t3=t2*t;return .5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);}
function cageHomog(C){if(C._H)return C._H;const [x0,y0]=C.A[0][0],[x1,y1]=C.A[0][1],[x2,y2]=C.A[1][1],[x3,y3]=C.A[1][0];
  const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;let g=0,h=0;
  if(Math.abs(dx3)>1e-9||Math.abs(dy3)>1e-9){const den=dx1*dy2-dx2*dy1;if(Math.abs(den)>1e-12){g=(dx3*dy2-dx2*dy3)/den;h=(dx1*dy3-dx3*dy1)/den;}}
  return C._H=[x1-x0+g*x1,x3-x0+h*x3,x0,y1-y0+g*y1,y3-y0+h*y3,y0,g,h];}
/* document point for flat-space fraction (u,v) in 0..1 */
function cagePt(C,u,v){
  if(C.nx===1&&C.ny===1&&C.persp){const H=cageHomog(C),w=H[6]*u+H[7]*v+1;return [(H[0]*u+H[1]*v+H[2])/w,(H[3]*u+H[4]*v+H[5])/w];}
  const gu=clamp(u,0,1)*C.nx,gv=clamp(v,0,1)*C.ny,i=Math.min(Math.floor(gu),C.nx-1),j=Math.min(Math.floor(gv),C.ny-1),tu=gu-i,tv=gv-j;
  const row=jj=>{const p=[0,1,2,3].map(k=>cageGet(C,jj,i-1+k));return [cr(p[0][0],p[1][0],p[2][0],p[3][0],tu),cr(p[0][1],p[1][1],p[2][1],p[3][1],tu)];};
  const r=[0,1,2,3].map(k=>row(j-1+k));return [cr(r[0][0],r[1][0],r[2][0],r[3][0],tv),cr(r[0][1],r[1][1],r[2][1],r[3][1],tv)];}
/* flat size: average length of the cage across and down, so painting keeps roughly the document's scale */
function cageSize(C){const L=(f)=>{let s=0,p=f(0);for(let k=1;k<=48;k++){const q=f(k/48);s+=Math.hypot(q[0]-p[0],q[1]-p[1]);p=q;}return s;};
  const w=(L(t=>cagePt(C,t,0))+L(t=>cagePt(C,t,.5))+L(t=>cagePt(C,t,1)))/3,h=(L(t=>cagePt(C,0,t))+L(t=>cagePt(C,.5,t))+L(t=>cagePt(C,1,t)))/3;
  let fw=Math.max(8,w),fh=Math.max(8,h);const lim=Math.min(MAX_DIM,4096),k=Math.min(1,lim/fw,lim/fh);return [Math.round(fw*k),Math.round(fh*k)];}
/* triangles: document x,y + flat x,y per vertex (fwd), and the same with the roles swapped (inv) */
function cageMesh(C){if(C._m)return C._m;const [fw,fh]=cageSize(C);C.fw=fw;C.fh=fh;
  const persp=C.nx===1&&C.ny===1&&C.persp,Nu=persp?32:C.nx*Math.max(4,Math.ceil(48/C.nx)),Nv=persp?32:C.ny*Math.max(4,Math.ceil(48/C.ny));
  const G=new Array((Nu+1)*(Nv+1));for(let b=0;b<=Nv;b++)for(let a=0;a<=Nu;a++){const u=a/Nu,v=b/Nv,p=cagePt(C,u,v);G[b*(Nu+1)+a]=[p[0],p[1],u*fw,v*fh];}
  const n=Nu*Nv*6,fwd=new Float32Array(n*4),inv=new Float32Array(n*4);let o=0;const bb=[Infinity,Infinity,-Infinity,-Infinity];
  for(let b=0;b<Nv;b++)for(let a=0;a<Nu;a++){const q00=G[b*(Nu+1)+a],q10=G[b*(Nu+1)+a+1],q01=G[(b+1)*(Nu+1)+a],q11=G[(b+1)*(Nu+1)+a+1];
    for(const q of [q00,q10,q11,q00,q11,q01]){fwd[o]=q[0];fwd[o+1]=q[1];fwd[o+2]=q[2];fwd[o+3]=q[3];inv[o]=q[2];inv[o+1]=q[3];inv[o+2]=q[0];inv[o+3]=q[1];o+=4;
      bb[0]=Math.min(bb[0],q[0]);bb[1]=Math.min(bb[1],q[1]);bb[2]=Math.max(bb[2],q[0]);bb[3]=Math.max(bb[3],q[1]);}}
  return C._m={fwd,inv,bb,Nu,Nv};}
function cageChanged(){const C=cageOf();if(C){C._m=null;C._H=null;cageMesh(C);}if(ui.cageFlat&&!C)cageFlatOff();requestRender(true);drawXfOverlay();if(ui.tool==='cage')cagePanelSync();}
function cageBBox(C){const b=cageMesh(C).bb;return [b[0],b[1],b[2],b[3]];}
/* document point -> flat point (and how much the cage scales there); null outside the cage */
function cageInv(C,x,y){const m=cageMesh(C),t=m.fwd;if(x<m.bb[0]-1||y<m.bb[1]-1||x>m.bb[2]+1||y>m.bb[3]+1)return null;
  for(let o=0;o<t.length;o+=12){const ax=t[o],ay=t[o+1],bx=t[o+4],by=t[o+5],cx=t[o+8],cy=t[o+9];
    if(x<Math.min(ax,bx,cx)||x>Math.max(ax,bx,cx)||y<Math.min(ay,by,cy)||y>Math.max(ay,by,cy))continue;
    const d=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(d)<1e-9)continue;
    const l1=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/d,l2=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/d,l3=1-l1-l2;
    if(l1<-1e-6||l2<-1e-6||l3<-1e-6)continue;
    const fx=l1*t[o+2]+l2*t[o+6]+l3*t[o+10],fy=l1*t[o+3]+l2*t[o+7]+l3*t[o+11];
    const fa=Math.abs((t[o+6]-t[o+2])*(t[o+11]-t[o+3])-(t[o+10]-t[o+2])*(t[o+7]-t[o+3]));
    return {x:fx,y:fy,s:Math.sqrt(Math.abs(d)/Math.max(fa,1e-9))};}
  return null;}
function cageFwd(x,y){const C=cageOf();cageMesh(C);return cagePt(C,x/C.fw,y/C.fh);}

/* ---------- drawing through the mesh ---------- */
function cageDraw(mesh,src,dst,W,H,offs,clear){
  if(!cageGL){const v=gl.createVertexArray(),buf=gl.createBuffer();gl.bindVertexArray(v);gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,8);gl.bindVertexArray(vao);cageGL={v,buf};}
  if(clear)clearTarget(dst);
  useProg(P.mesh,{uSrc:src.tex,uOutside:[0,0,0,0],uInterp:{int:1},uSize:[W,H]});bindTarget(dst);
  gl.bindVertexArray(cageGL.v);gl.bindBuffer(gl.ARRAY_BUFFER,cageGL.buf);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STREAM_DRAW);
  gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  const loc=gl.getUniformLocation(P.mesh.p,'uOff');for(const [ox,oy] of offs){gl.uniform2f(loc,ox,oy);gl.drawArrays(gl.TRIANGLES,0,mesh.length/4);}
  gl.disable(gl.BLEND);gl.bindVertexArray(vao);}
function wrapOffs(){const W=doc.w,H=doc.h;return doc.wrap?[[-W,-H],[0,-H],[W,-H],[-W,0],[0,0],[W,0],[-W,H],[0,H],[W,H]]:[[0,0]];}
/* the flat stroke buffer, bent into the document's stroke buffer */
function cageStrokeTarget(C){cageMesh(C);if(!cageST||cageST.w!==C.fw||cageST.h!==C.fh){if(cageST)disposeTarget(cageST);cageST=makeTarget(C.fw,C.fh,doc.depth===16?16:8,false);}return cageST;}
function cageSpace(C){cageMesh(C);const buf=cageStrokeTarget(C);return {C,w:C.fw,h:C.fh,buf,sync(){cageDraw(cageMesh(C).fwd,buf,strokeT,doc.w,doc.h,wrapOffs(),true);},bbox:()=>cageBBox(C)};}
/* what the flat view shows: the current view picture straightened out */
function cageRenderFlat(src){const C=cageOf();const m=cageMesh(C);
  if(!cageViewT||cageViewT.w!==C.fw||cageViewT.h!==C.fh){if(cageViewT)disposeTarget(cageViewT);cageViewT=makeTarget(C.fw,C.fh,8,false);}
  cageDraw(m.inv,src,cageViewT,C.fw,C.fh,[[0,0]],true);return cageViewT;}

/* ---------- flat view ---------- */
function cageFlatActive(){return ui.cageFlat&&cageOf()?cageOf():null;}
function viewDims(){const C=cageFlatActive();if(C){cageMesh(C);return [C.fw,C.fh];}return [doc.w,doc.h];}
function toggleCageFlat(){if(ui.cageFlat){cageFlatOff();return;}const C=cageOf();if(!C){toast('Draw a cage first: pick the Cage tool (K) and drag over the area you want to paint.');setTool('cage');return;}
  if(xf&&!xf.move)xfCommit();if(typeof crop!=='undefined')crop=null;
  cageSavedView={x:view.x,y:view.y,zoom:view.zoom};ui.cageFlat=true;cageMesh(C);
  if(!['brush','erase','dodge','burn','picker','hand'].includes(ui.tool))setTool('brush');
  cageBanner(true);fit();requestRender(true);drawXfOverlay();}
function cageFlatOff(){if(!ui.cageFlat)return;ui.cageFlat=false;cageBanner(false);if(cageSavedView){Object.assign(view,cageSavedView);cageSavedView=null;updateStatus();refreshCursor();}else fit();requestRender(true);drawXfOverlay();}
let cageBan=null;
function cageBanner(on){if(!cageBan){cageBan=el('div',{id:'cageBanner',role:'status'});stage.append(cageBan);}
  cageBan.hidden=!on;if(on){const C=cageOf();cageBan.replaceChildren(el('b',{text:'Flat cage view'}),document.createTextNode(' · '+C.fw+' × '+C.fh+' · what you paint here is bent back onto the canvas · '),el('button',{class:'btn sm',text:'Back to canvas (Shift+F)',onclick:cageFlatOff}));}}

/* ---------- starting a stroke through the cage ---------- */
/* returns false (don't paint), null (paint normally) or the starting point in flat space */
function cageStrokeStart(o,ix,iy){const C=cageOf();
  if(ui.cageFlat&&C){if(o.tool==='smudge'){toast('The blend brush works on the canvas, not in the flat view. Press Shift+F to go back.');return false;}
    o.space=cageSpace(C);return {x:ix,y:iy,kind:'flat'};}
  if(!C||!C.on||o.tool==='smudge')return null;
  const m=cageInv(C,ix,iy);if(!m)return null;o.space=cageSpace(C);o.cageRs=1/Math.max(m.s,1e-3);return {x:m.x,y:m.y,kind:'bend'};}

/* ---------- symmetry ---------- */
function symFor(o){const S=ui.sym;if(S.mode==='off')return null;return {mode:S.mode,n:clamp(Math.round(S.n),2,32),cx:S.cx,cy:S.cy};}
/* copies of a dab: [x, y, angle, flipX, flipY, dx, dy] */
function symCopies(sym,W,H,x,y,ang,fx,fy,dx,dy){const out=[[x,y,ang,fx,fy,dx,dy]];if(!sym)return out;const cx=sym.cx*W,cy=sym.cy*H;
  if(sym.mode==='radial'){for(let k=1;k<sym.n;k++){const t=k*2*Math.PI/sym.n,c=Math.cos(t),s=Math.sin(t),rx=x-cx,ry=y-cy;
      out.push([cx+c*rx-s*ry,cy+s*rx+c*ry,ang+t,fx,fy,c*dx-s*dy,s*dx+c*dy]);}return out;}
  if(sym.mode==='x'||sym.mode==='xy')out.push([2*cx-x,y,-ang,-fx,fy,-dx,dy]);
  if(sym.mode==='y'||sym.mode==='xy')out.push([x,2*cy-y,-ang,fx,-fy,dx,-dy]);
  if(sym.mode==='xy')out.push([2*cx-x,2*cy-y,ang,-fx,-fy,-dx,-dy]);
  return out;}
const SYM_MODES=[['off','Off'],['x','Left–right'],['y','Top–bottom'],['xy','Both'],['radial','Radial']];
function setSym(mode){ui.sym.mode=mode;buildBrushPanel();drawXfOverlay();requestRender();}
function symToggleX(){setSym(ui.sym.mode==='x'?'off':'x');toast(ui.sym.mode==='x'?'Symmetry: left–right':'Symmetry off');}
function buildSymSection(box){const S=ui.sym;
  box.append(el('div',{class:'sub',text:'Symmetry'}),seg(SYM_MODES.map(m=>[m[0],m[1]]),S.mode,v=>setSym(v),'Symmetry'));
  if(S.mode==='off')return;
  if(S.mode==='radial')box.append(makeSlider({id:'symN',label:'Copies',min:2,max:24,step:1,value:S.n,fmt:v=>String(v),onInput:v=>{S.n=v;drawXfOverlay();}}).el);
  if(S.mode!=='y')box.append(makeSlider({id:'symCx',label:'Centre ↔',min:0,max:1,step:.005,value:S.cx,fmt:pct,onInput:v=>{S.cx=v;drawXfOverlay();}}).el);
  if(S.mode!=='x')box.append(makeSlider({id:'symCy',label:'Centre ↕',min:0,max:1,step:.005,value:S.cy,fmt:pct,onInput:v=>{S.cy=v;drawXfOverlay();}}).el);
  box.append(el('div',{class:'hint2',text:'Mirrors around the document, or around the cage when you paint through one. Shift+X turns left–right on and off.'}));}

/* ---------- the Cage tool ---------- */
function cageClone(C){return C?{nx:C.nx,ny:C.ny,persp:!!C.persp,on:C.on!==false,A:C.A.map(r=>r.map(p=>[p[0],p[1]]))}:null;}
function cageRecord(label,before){const after=cageClone(cageOf());
  pushUndo({label,undo(){doc.cage=cageClone(before);cageChanged();},redo(){doc.cage=cageClone(after);cageChanged();}});}
function cageFromRect(x0,y0,x1,y1,nx,ny){const A=[];for(let j=0;j<=ny;j++){const r=[];for(let i=0;i<=nx;i++)r.push([x0+(x1-x0)*i/nx,y0+(y1-y0)*j/ny]);A.push(r);}
  return {nx,ny,A,persp:ui.cagePersp,on:true};}
function cageDims(){return ui.cageKind==='quad'?[1,1]:[ui.cageNx,ui.cageNy];}
/* change the grid, keeping the shape */
function cageRegrid(nx,ny){const C=cageOf();if(!C||(C.nx===nx&&C.ny===ny))return;const before=cageClone(C);cageMesh(C);
  const A=[];for(let j=0;j<=ny;j++){const r=[];for(let i=0;i<=nx;i++)r.push(cagePt(C,i/nx,j/ny));A.push(r);}
  doc.cage={nx,ny,A,persp:ui.cagePersp,on:C.on};cageRecord('Change cage grid',before);cageChanged();}
function cageSetRect(r,label){if(!r||r[2]-r[0]<2||r[3]-r[1]<2){toast('Nothing to fit the cage to.');return;}const before=cageClone(cageOf()),[nx,ny]=cageDims();
  doc.cage=cageFromRect(r[0],r[1],r[2],r[3],nx,ny);cageRecord(label,before);cageChanged();}
function cageDelete(){const C=cageOf();if(!C)return;const before=cageClone(C);doc.cage=null;cageFlatOff();cageRecord('Delete cage',before);cageChanged();}
function cageHitAnchor(C,sx,sy){let best=null,bd=9;for(let j=0;j<=C.ny;j++)for(let i=0;i<=C.nx;i++){const q=scrPt(C.A[j][i]),d=Math.hypot(q[0]-sx,q[1]-sy);if(d<bd){bd=d;best=[i,j];}}return best;}
function cagePointerDown(e,ix,iy){const C=cageOf(),[sx,sy]=stageXY(e);
  if(C){const h=cageHitAnchor(C,sx,sy);
    if(h){ptr={mode:'cage',id:e.pointerId,kind:'pt',h,before:cageClone(C),sx:ix,sy:iy,o:C.A[h[1]][h[0]].slice()};C.active=h;drawXfOverlay();return;}
    if(cageInv(C,ix,iy)){ptr={mode:'cage',id:e.pointerId,kind:'move',before:cageClone(C),sx:ix,sy:iy,o:C.A.map(r=>r.map(p=>p.slice()))};return;}}
  ptr={mode:'cage',id:e.pointerId,kind:'new',x0:ix,y0:iy,x1:ix,y1:iy,before:cageClone(C)};}
function cagePointerMove(e,mx,my){const p=ptr,C=cageOf();
  if(p.kind==='pt'){let x=p.o[0]+mx-p.sx,y=p.o[1]+my-p.sy;C.A[p.h[1]][p.h[0]]=[x,y];cageChanged();return;}
  if(p.kind==='move'){const dx=mx-p.sx,dy=my-p.sy;C.A=p.o.map(r=>r.map(q=>[q[0]+dx,q[1]+dy]));cageChanged();return;}
  p.x1=mx;p.y1=my;if(e.shiftKey){const d=Math.max(Math.abs(mx-p.x0),Math.abs(my-p.y0));p.x1=p.x0+Math.sign(mx-p.x0||1)*d;p.y1=p.y0+Math.sign(my-p.y0||1)*d;}drawXfOverlay();}
function cagePointerUp(){const p=ptr;ptr=null;
  if(p.kind==='new'){const x0=Math.min(p.x0,p.x1),x1=Math.max(p.x0,p.x1),y0=Math.min(p.y0,p.y1),y1=Math.max(p.y0,p.y1);
    if((x1-x0)*view.zoom<6||(y1-y0)*view.zoom<6){drawXfOverlay();return;}
    const [nx,ny]=cageDims();doc.cage=cageFromRect(x0,y0,x1,y1,nx,ny);cageRecord('New cage',p.before);cageChanged();return;}
  const moved=JSON.stringify(p.before.A)!==JSON.stringify(cageOf().A);if(moved)cageRecord(p.kind==='pt'?'Move cage point':'Move cage',p.before);drawXfOverlay();}
function cageHover(e){const C=cageOf();if(!C){cv.style.cursor='crosshair';return;}const [sx,sy]=stageXY(e);
  if(cageHitAnchor(C,sx,sy))cv.style.cursor='pointer';else{const [x,y]=toImage(e.clientX,e.clientY);cv.style.cursor=cageInv(C,x,y)?'move':'crosshair';}}
function cageKeys(e,m,k){
  if(ui.cageFlat&&e.key==='Escape'){e.preventDefault();cageFlatOff();return true;}
  if(m||e.altKey||ui.mode==='bake')return false;
  if(k==='k'&&!e.shiftKey){if(ui.cageFlat)cageFlatOff();setTool('cage');return true;}
  if(k==='f'&&e.shiftKey){toggleCageFlat();return true;}
  if(k==='x'&&e.shiftKey){symToggleX();return true;}
  if(ui.tool==='cage'&&cageOf()&&cageOf().active&&e.key.startsWith('Arrow')){e.preventDefault();const C=cageOf(),[i,j]=C.active,s=e.shiftKey?10:1,d={ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,-s],ArrowDown:[0,s]}[e.key];
    const before=cageClone(C);C.A[j][i]=[C.A[j][i][0]+d[0],C.A[j][i][1]+d[1]];cageRecord('Move cage point',before);cageChanged();return true;}
  if(ui.tool==='cage'&&(k==='delete'||k==='backspace')&&cageOf()){e.preventDefault();cageDelete();return true;}
  return false;}

/* ---------- panel ---------- */
function buildCagePanel(box){$('#brushTitle').textContent='Cage';const C=cageOf();
  box.append(el('div',{class:'hint2',text:C?'Drag the points to fit the shape you want to paint on. Drag inside to move the whole cage, or drag outside to draw a new one.':'Drag over the area you want to paint on to draw a cage. Then fit its points to the shape: a slanted panel, a curved strip, a door in perspective.'}));
  box.append(el('div',{class:'sub',text:'Shape'}),seg([['quad','4 corners'],['grid','Grid']],ui.cageKind,v=>{ui.cageKind=v;const [nx,ny]=cageDims();if(C)cageRegrid(nx,ny);buildBrushPanel();},'Cage shape'));
  if(ui.cageKind==='grid'){
    box.append(makeSlider({id:'cgNx',label:'Columns',min:1,max:12,step:1,value:ui.cageNx,fmt:v=>String(v),onInput:v=>{ui.cageNx=v;},onChange:()=>{if(cageOf())cageRegrid(ui.cageNx,ui.cageNy);}}).el,
      makeSlider({id:'cgNy',label:'Rows',min:1,max:12,step:1,value:ui.cageNy,fmt:v=>String(v),onInput:v=>{ui.cageNy=v;},onChange:()=>{if(cageOf())cageRegrid(ui.cageNx,ui.cageNy);}}).el);}
  else box.append(el('div',{class:'chips'},chk('cgPersp','Perspective',ui.cagePersp,v=>{ui.cagePersp=v;const c=cageOf();if(c&&c.nx===1&&c.ny===1){const b=cageClone(c);c.persp=v;cageRecord('Cage perspective',b);cageChanged();}})));
  box.append(el('div',{class:'sub',text:'Painting'}));
  box.append(el('div',{class:'chips'},chk('cgOn','Bend brush strokes inside the cage',C?C.on!==false:true,v=>{const c=cageOf();if(c){c.on=v;drawXfOverlay();}})));
  const bt=(t,f,dis,title)=>{const b=el('button',{class:'btn sm',text:t,title:title||''});b.disabled=!!dis;b.addEventListener('click',f);return b;};
  box.append(el('div',{class:'row wrap'},bt('Flat view (F)',toggleCageFlat,!C,'Paint on the cage’s contents straightened out'),
    bt('Fit to selection',()=>cageSetRect(sel.active&&sel.bb?sel.bb:null,'Fit cage to selection'),!(sel.active&&sel.bb)),
    bt('Fit to layer',()=>{const L=doc.active&&doc.active.target?doc.active:null;cageSetRect(L?contentBounds(L.target):null,'Fit cage to layer');},false),
    bt('Delete cage',cageDelete,!C)));
  if(C){cageMesh(C);box.append(el('div',{class:'sub',id:'cgInfo',text:'Flat size '+C.fw+' × '+C.fh+' px · '+(C.nx===1&&C.ny===1?'4 corners':C.nx+' × '+C.ny+' grid')}));}
  box.append(el('div',{class:'hint2',text:'Paint with any brush: inside the cage the brush bends to its shape. Hold Shift as you paint to follow the cage’s lines, so the stroke curves with it. Or press F to paint on it laid flat, where straight lines stay straight. Arrow keys nudge the selected point; Delete removes the cage.'}));}
function cagePanelSync(){const i=$('#cgInfo'),C=cageOf();if(i&&C)i.textContent='Flat size '+C.fw+' × '+C.fh+' px · '+(C.nx===1&&C.ny===1?'4 corners':C.nx+' × '+C.ny+' grid');}

/* ---------- on-canvas overlay ---------- */
function cageOverlay(){let s='';const C=cageOf(),f=p=>scrPt(p).map(v=>v.toFixed(1)).join(' ');
  const paintTool=['brush','erase','smudge','dodge','burn'].includes(ui.tool);
  if(ui.cageFlat&&C){const W=C.fw,H=C.fh;s+='<path class="cgf" d="M'+f([0,0])+'L'+f([W,0])+'L'+f([W,H])+'L'+f([0,H])+'Z"/>';}
  else if(C&&(ui.tool==='cage'||(paintTool&&C.on!==false))){cageMesh(C);const full=ui.tool==='cage',seg=16;let d='';
    const line=(fn)=>{let q='M'+f(fn(0));for(let k=1;k<=seg;k++)q+='L'+f(fn(k/seg));return q;};
    if(full){for(let j=0;j<=C.ny;j++)d+=line(t=>cagePt(C,t,j/C.ny));for(let i=0;i<=C.nx;i++)d+=line(t=>cagePt(C,i/C.nx,t));}
    else{d+=line(t=>cagePt(C,t,0))+line(t=>cagePt(C,1,t))+line(t=>cagePt(C,1-t,1))+line(t=>cagePt(C,0,1-t));}
    s+='<path class="'+(full?'ln':'cgo')+'" d="'+d+'"/>';
    if(full)for(let j=0;j<=C.ny;j++)for(let i=0;i<=C.nx;i++){const q=scrPt(C.A[j][i]),on=C.active&&C.active[0]===i&&C.active[1]===j;s+='<rect class="hs'+(on?' on':'')+'" x="'+(q[0]-4)+'" y="'+(q[1]-4)+'" width="8" height="8"/>';}}
  if(ptr&&ptr.mode==='cage'&&ptr.kind==='new'){const a=scrPt([ptr.x0,ptr.y0]),b=scrPt([ptr.x1,ptr.y1]);s+='<rect class="ln" x="'+Math.min(a[0],b[0])+'" y="'+Math.min(a[1],b[1])+'" width="'+Math.abs(b[0]-a[0])+'" height="'+Math.abs(b[1]-a[1])+'"/>';}
  /* symmetry guides, in the space being painted */
  const S=ui.sym;if(S.mode!=='off'&&paintTool){const [W,H]=viewDims(),cx=S.cx*W,cy=S.cy*H;let d='';
    if(S.mode==='radial'){const R=Math.hypot(W,H);for(let k=0;k<S.n;k++){const t=k*2*Math.PI/S.n-Math.PI/2;d+='M'+f([cx,cy])+'L'+f([cx+Math.cos(t)*R,cy+Math.sin(t)*R]);}}
    else{if(S.mode!=='y')d+='M'+f([cx,0])+'L'+f([cx,H]);if(S.mode!=='x')d+='M'+f([0,cy])+'L'+f([W,cy]);}
    s+='<path class="sym" d="'+d+'"/>';}
  /* Brush tab: centre cross and circle, to keep tips centred and round */
  if(ui.mode==='brush'&&bt.guides&&!ui.cageFlat){const [W,H]=viewDims(),c=[W/2,H/2],r=Math.min(W,H)*.43,q=[];for(let k=0;k<=48;k++){const t=k/48*Math.PI*2;q.push((k?'L':'M')+f([c[0]+Math.cos(t)*r,c[1]+Math.sin(t)*r]));}
    s+='<path class="guide" d="M'+f([W/2,0])+'L'+f([W/2,H])+'M'+f([0,H/2])+'L'+f([W,H/2])+q.join('')+'"/>';}
  return s;}
