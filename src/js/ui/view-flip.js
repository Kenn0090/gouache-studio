/* ================= Rotate and flip (0.46) =================
   View: turn the picture on screen (any angle) or mirror it left-right, to check a drawing with fresh eyes. Nothing in the
   document changes, and every tool still works through the turned view.
   Document: flip or turn the whole canvas (Image menu), and flip a layer (Layer menu), with hotkeys for each. */
/* the picture's turn and mirror as a 2×2 matrix (screen from picture, without the zoom); null when the view is plain */
function vxA(){if(!(view.rot||view.flip)||['p3d','bake','convert'].includes(ui.mode))return null;const c=Math.cos(view.rot),s=Math.sin(view.rot),f=view.flip?-1:1;return [c*f,-s,s*f,c];}
function vxBox(DW,DH){const A=vxA();return A?[Math.abs(A[0])*DW+Math.abs(A[1])*DH,Math.abs(A[2])*DW+Math.abs(A[3])*DH]:[DW,DH];}
function vxCentre(W,H,DW,DH){const A=vxA()||[1,0,0,1],z=view.zoom;view.x=W/2-z*(A[0]*DW/2+A[1]*DH/2);view.y=H/2-z*(A[2]*DW/2+A[3]*DH/2);}
/* set the turn and mirror, keeping the point of the picture now in the middle of the window where it is */
function vxSet(rot,flip,pivot){const W=stage.clientWidth,H=stage.clientHeight,r=stage.getBoundingClientRect(),p=pivot||toImage(r.left+W/2,r.top+H/2);
  rot=((rot%(2*Math.PI))+3*Math.PI)%(2*Math.PI)-Math.PI;if(Math.abs(rot)<1e-6)rot=0;view.rot=rot;view.flip=!!flip;
  const A=vxA()||[1,0,0,1],z=view.zoom;view.x=W/2-z*(A[0]*p[0]+A[1]*p[1]);view.y=H/2-z*(A[2]*p[0]+A[3]*p[1]);
  updateStatus();refreshCursor();if(typeof rl!=='undefined')rl.sig='';requestRender();}
const vxDeg=()=>Math.round(view.rot*180/Math.PI*10)/10;
function vxRotate(deg){vxSet(view.rot+deg*Math.PI/180,view.flip);toast('View turned to '+vxDeg()+'°'+(view.flip?' (flipped)':'')+'. Alt+0 puts it straight.');}
function vxFlip(){vxSet(-view.rot,!view.flip);toast(view.flip?'View flipped left-right. The picture itself is unchanged. Press the same key to flip back.':'View flipped back.');}
function vxReset(quiet){if(!view.rot&&!view.flip)return;vxSet(0,false);if(!quiet)toast('View straight again.');}
function dlgRotateView(){const inp=el('input',{type:'number',class:'num',min:-180,max:180,step:1,value:String(vxDeg()),'aria-label':'Angle in degrees'}),rng=el('input',{type:'range',min:-180,max:180,step:1,value:String(vxDeg()),'aria-label':'Angle'});
  inp.step=rng.step='.1';const set=v=>{v=clamp(+v||0,-180,180);inp.value=rng.value=String(v);vxSet(v*Math.PI/180,view.flip);};inp.oninput=()=>set(inp.value);rng.oninput=()=>set(rng.value);
  openDialog({title:'Rotate view',okLabel:'Done',cancelLabel:'Straighten',body:el('div',{class:'dlg-grid'},el('div',{class:'frow'},el('label',{text:'Angle'}),inp,el('span',{text:'°'})),rng,
    el('p',{class:'note',text:'Turns only what you see. You can also hold R and drag on the canvas, or hold Shift + Space and drag.'})),onOk(){},onCancel(){vxReset(true);}});}
/* Hold R and drag freely; Shift deliberately constrains to 15-degree angles. */
let rotHold=false;
function vxDragStart(e){const r=stage.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  return {mode:'vrot',id:e.pointerId,cx,cy,a0:Math.atan2(e.clientY-cy,e.clientX-cx),r0:view.rot,p:toImage(cx,cy)};}
function vxDragMove(e){const p=ptr;let rot=p.r0+Math.atan2(e.clientY-p.cy,e.clientX-p.cx)-p.a0;if(e.shiftKey)rot=Math.round(rot/(Math.PI/12))*Math.PI/12;vxSet(rot,view.flip,p.p);}

/* ---- flip a layer (around the middle of what it holds, or of the selection) ---- */
function flipLayers(h){if(typeof xf!=='undefined'&&xf)xfCommit();if(ui.mode==='anim'||ui.mode==='bake'||ui.mode==='convert'){toast('Flip layer works in Paint.');return;}
  const old=ui.xfInterp;ui.xfInterp=0;
  try{if(!xfStart())return;xf.contentSel=!!xf.selItem;const q=xf.q;xf.q=h?[q[2],q[3],q[0],q[1],q[6],q[7],q[4],q[5]]:[q[6],q[7],q[4],q[5],q[2],q[3],q[0],q[1]];xfRender(false);xfCommit();}finally{ui.xfInterp=old;}}
/* ---- turn or flip the whole canvas ---- */
function canvasXf(kind){
  if(ui.mode!=='paint'){toast('Canvas turning works in Paint.');return;}
  if(stroke||preview||selLive){toast('Finish the current edit first.');return;}if(xf)xfCommit();if(doc.anim){toast('Canvas turning is not available for flipbooks yet.');return;}
  if(sel.quick){toast('Leave quick mask (Q) first.');return;}
  if(everyLayer().some(L=>L.path)){toast('Turn path layers into pixels first. They cannot be turned yet.');return;}
  for(const L of everyLayer())if(L.text||L.grad||L.shape)rasterizeText(L);
  const W=doc.w,H=doc.h,swap=kind==='cw'||kind==='ccw',nw=swap?H:W,nh=swap?W:H;
  const U={fh:{uX:[-1,0],uY:[0,1],uB:[W,0]},fv:{uX:[1,0],uY:[0,-1],uB:[0,H]},r180:{uX:[-1,0],uY:[0,-1],uB:[W,H]},cw:{uX:[0,1],uY:[-1,0],uB:[0,H]},ccw:{uX:[0,-1],uY:[1,0],uB:[W,0]}}[kind];
  if(sel.active)sel.active=false;
  if(!rebuildLayers(nw,nh,doc.depth,(s,d)=>run(P.axf,d,Object.assign({uSrc:s.tex},U)))){toast(NO_GPU_MEM);return;}
  const g=doc.guides||[];for(const G of g){const p=G.p,h=G.o==='h';
    if(kind==='fh'){if(!h)G.p=W-p;}else if(kind==='fv'){if(h)G.p=H-p;}else if(kind==='r180'){G.p=(h?H:W)-p;}
    else if(kind==='cw'){G.o=h?'v':'h';G.p=h?H-p:p;}else{G.o=h?'v':'h';G.p=h?p:W-p;}}
  if(doc.cage){doc.cage=null;cageFlatOff();}
  if(typeof pathFlush==='function')pathFlush();
  fit();changedAll();updateStatus();
  toast({fh:'Canvas flipped left-right.',fv:'Canvas flipped top-bottom.',r180:'Canvas turned 180°.',cw:'Canvas turned 90° clockwise.',ccw:'Canvas turned 90° counter-clockwise.'}[kind]+' Undo history was cleared.');}
/* ---- Transform warp, ready to be given a key ---- */
function xfWarpCmd(){if(!xf){if(!xfStart())return;xfRender(false);}if(!xf.warp){warpInit(ui.warpN);xfRender(false);buildBrushPanel();drawXfOverlay();}toast('Warp: drag the grid points. Enter applies, Esc cancels.');}

Object.assign(actions,{viewRotL:()=>vxRotate(-15),viewRotR:()=>vxRotate(15),viewRotDlg:dlgRotateView,viewRotReset:()=>vxReset(),viewFlip:vxFlip,
  canvasCW:()=>canvasXf('cw'),canvasCCW:()=>canvasXf('ccw'),canvas180:()=>canvasXf('r180'),canvasFH:()=>canvasXf('fh'),canvasFV:()=>canvasXf('fv'),
  flipLH:()=>flipLayers(true),flipLV:()=>flipLayers(false),xfWarp:xfWarpCmd});
MENUS.View.splice(MENUS.View.indexOf('-')+0,0,'-',['Rotate view left 15°','viewRotL','Alt+,'],['Rotate view right 15°','viewRotR','Alt+.'],['Rotate view…','viewRotDlg'],['Flip view left-right','viewFlip','Alt+H'],['Straighten view','viewRotReset','Alt+0']);
MENUS.Image.splice(MENUS.Image.findIndex(i=>i[1]==='cropSel')+1,0,'-',['Rotate canvas 90° clockwise','canvasCW'],['Rotate canvas 90° counter-clockwise','canvasCCW'],['Rotate canvas 180°','canvas180'],['Flip canvas left-right','canvasFH','Ctrl+Alt+Shift+H'],['Flip canvas top-bottom','canvasFV','Ctrl+Alt+Shift+V']);
MENUS.Edit.splice(MENUS.Edit.findIndex(i=>i[1]==='freeTransform')+1,0,['Transform warp','xfWarp','Ctrl+Alt+T'],['Flip layer left-right','flipLH','Ctrl+Alt+H'],['Flip layer top-bottom','flipLV','Ctrl+Alt+V']);
/* these keys are run by the shortcut editor itself (the other built-in keys live in their own handlers) */
const KB_AUTO=['clearContents','searchCommands','tool:liquify','viewRotL','viewRotR','viewFlip','viewRotReset','canvasFH','canvasFV','flipLH','flipLV','xfWarp'];
kbCmds=null;
