/* ================= Mask mode tools =================
   In mask mode (Alt+click a mask) nothing paints until Paint is pressed in the mask bar, like Substance Painter.
   Box, Lasso and Polygon draw a shape: on the flat canvas they are the usual selection tools (drag inside a
   selection to move it); on the model the shape selects the parts of the model you can see under it, and a drag
   inside the shape moves it (the selection follows when you let go). Fill white / Fill black then fill the
   selection, and painting stays inside it. Shift adds to the selection, Ctrl takes away. */
const mk3={tool:null,pts:null,draw:null,move:null,el:null};
const MK_TOOLS=[['paint','Paint'],['box','Box'],['lasso','Lasso'],['poly','Polygon']];
const maskToolsOn=()=>!!(ui.viewMask&&doc.active&&doc.active.mask&&ui.mode!=='anim'&&ui.mode!=='bake');
const maskPaintLocked=()=>maskToolsOn()&&mk3.tool!=='paint';
function maskTool(t){if(mk3.tool===t)t=null;mk3.tool=t;mk3.draw=null;mk3.move=null;
  if(t==='paint'){if(!MESH_TOOLS.includes(ui.tool))setTool('brush');if(v3.on||ui.mode==='p3d')v3.paintOn=true;}
  else if(t==='box'){ui.marquee='rect';setTool('marquee');}
  else if(t==='lasso'){ui.lasso='free';setTool('lasso');}
  else if(t==='poly'){ui.lasso='poly';setTool('lasso');}
  maskBarSync();mk3Overlay();}
function mk3Reset(){mk3.tool=null;mk3.pts=null;mk3.draw=null;mk3.move=null;mk3Overlay();}
const mk3Hint=()=>({paint:'Paint white to show, black to hide.',box:'Drag over the model to select what you see. Drag inside the box to move it. Shift adds, Ctrl removes.',
  lasso:'Draw around what you want. Drag inside the shape to move it. Shift adds, Ctrl removes.',poly:'Click the corners; double-click (or click the first point, or press Enter) to close.'})[mk3.tool]||'Press Paint to paint the mask, or Box, Lasso or Polygon to select parts of the model.';
function mk3InPoly(x,y,P){let c=false;for(let i=0,j=P.length-2;i<P.length;j=i,i+=2){const xi=P[i],yi=P[i+1],xj=P[j],yj=P[j+1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;}
/* pointer on the 3D view in mask mode: true when the mask tools took it */
function mk3Down(hit,e){
  if(!mk3.tool||mk3.tool==='paint'){if(!mk3.tool&&v3CanPaint()){toast('Press Paint in the mask bar to paint the mask.');return true;}return false;}
  if(!sel.active)mk3.pts=null;const [x,y]=meshPt(hit,e);
  if(mk3.pts&&!mk3.draw&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&mk3InPoly(x,y,mk3.pts)){mk3.move={id:e.pointerId,x,y,pts0:mk3.pts.slice()};return true;}
  const mode=e.shiftKey?'add':(e.ctrlKey||e.metaKey)?'sub':'new';
  if(mk3.tool==='poly'){const d=mk3.draw;
    if(!d)mk3.draw={kind:'poly',pts:[x,y],cur:[x,y],mode};
    else{const P=d.pts;if(e.detail>=2||(P.length>=6&&Math.hypot(x-P[0],y-P[1])<8)){mk3Finish();return true;}P.push(x,y);}
    mk3Overlay();return true;}
  mk3.draw={kind:mk3.tool,id:e.pointerId,x0:x,y0:y,pts:[x,y],mode};mk3Overlay();return true;}
const mk3Busy=()=>!!(mk3.draw||mk3.move);
function mk3Move(hit,e){const [x,y]=meshPt(hit,e);
  if(mk3.move){if(e.pointerId!==mk3.move.id)return;const dx=x-mk3.move.x,dy=y-mk3.move.y;mk3.pts=mk3.move.pts0.map((v,i)=>v+(i&1?dy:dx));mk3Overlay();return;}
  const d=mk3.draw;if(!d)return;
  if(d.kind==='poly'){d.cur=[x,y];mk3Overlay();return;}
  if(e.pointerId!==d.id)return;
  if(d.kind==='box')d.pts=[d.x0,d.y0,x,d.y0,x,y,d.x0,y];else{const n=d.pts.length;if(Math.hypot(x-d.pts[n-2],y-d.pts[n-1])>=2)d.pts.push(x,y);}
  mk3Overlay();}
function mk3Up(e){if(mk3.move&&(!e||e.pointerId===mk3.move.id)){const m=mk3.move;mk3.move=null;if(mk3.pts&&(mk3.pts[0]!==m.pts0[0]||mk3.pts[1]!==m.pts0[1]))mk3Project('new','Move selection');return;}
  const d=mk3.draw;if(d&&d.kind!=='poly'&&(!e||e.pointerId===d.id))mk3Finish();}
function mk3Finish(){const d=mk3.draw;mk3.draw=null;if(!d){mk3Overlay();return;}const P=d.pts;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let i=0;i<P.length;i+=2){x0=Math.min(x0,P[i]);x1=Math.max(x1,P[i]);y0=Math.min(y0,P[i+1]);y1=Math.max(y1,P[i+1]);}
  if(P.length<6||x1-x0<3||y1-y0<3){if(d.mode==='new'){deselect();mk3.pts=null;}mk3Overlay();return;}
  mk3.pts=P.slice();mk3Project(d.mode,d.kind==='box'?'Box select':d.kind==='poly'?'Polygon select':'Lasso select');}
/* the shape on the screen → the parts of the model visible under it → a selection on the texture */
const FS_MK3A=`uniform sampler2D uSrc; void main(){ float a=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0).a; o=vec4(vec3(a),1.0); }`;
let P_MK3A=null;
function mk3Project(mode,label){const hit=document.getElementById('v3Hit');if(!hit||!mk3.pts||selBusy())return;
  const r=hit.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height)),sp=meshSpace(w,h);if(!sp)return;
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),P=mk3.pts;x.fillStyle='#fff';x.beginPath();x.moveTo(P[0],P[1]);for(let i=2;i<P.length;i+=2)x.lineTo(P[i],P[i+1]);x.closePath();x.fill();
  /* the canvas's top row lands in the texture's first row, which is the bottom of the view: the same way up as the pointer */
  const tmp=makeTarget(w,h,8,false);gl.bindTexture(gl.TEXTURE_2D,tmp.tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,c);copyScaled(tmp,sp.buf);disposeTarget(tmp);
  const stm=st3.mode;st3.mode='off';try{sp.sync();}finally{st3.mode=stm;}
  if(!P_MK3A)P_MK3A=program(FS_MK3A);const t=acquireS();run(P_MK3A,t,{uSrc:strokeT.tex});
  applyShape(t,mode,fullRect(),label);release(t);clearTarget(strokeT);v3.dirty=true;requestRender(true);mk3Overlay();}
/* the dashed outline over the view */
function mk3Overlay(){const hit=document.getElementById('v3Hit');let c=mk3.el;const d=mk3.draw,P=d?d.pts:(sel.active?mk3.pts:null);
  if(!hit||!maskToolsOn()||!P){if(c)c.hidden=true;return;}
  if(!c||!c.isConnected){c=mk3.el=el('canvas',{class:'v3mk','aria-hidden':'true'});hit.parentNode.insertBefore(c,hit.nextSibling);}
  const r=hit.getBoundingClientRect(),pr=hit.parentNode.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;}c.hidden=false;c.style.left=(r.left-pr.left)+'px';c.style.top=(r.top-pr.top)+'px';c.style.width=w+'px';c.style.height=h+'px';
  const x=c.getContext('2d');x.clearRect(0,0,w,h);const pts=d&&d.kind==='poly'?[...P,...d.cur]:P;x.beginPath();x.moveTo(pts[0],h-pts[1]);for(let i=2;i<pts.length;i+=2)x.lineTo(pts[i],h-pts[i+1]);if(!(d&&d.kind==='poly'))x.closePath();
  x.lineWidth=1.5;x.setLineDash([6,4]);x.strokeStyle='#000';x.stroke();x.lineDashOffset=5;x.strokeStyle='#fff';x.stroke();}
window.addEventListener('keydown',e=>{if(!mk3.draw||isTypingTarget(e.target))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();mk3.draw=null;mk3Overlay();}
  else if(e.key==='Enter'&&mk3.draw.kind==='poly'){e.preventDefault();e.stopImmediatePropagation();mk3Finish();}},true);
