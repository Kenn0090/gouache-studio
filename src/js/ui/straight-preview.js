/* ================= Straight line preview (0.93.3, Kenn: like Substance Painter) =================
   Holding Shift with a painting tool shows a dotted line from where the last stroke ended to the pointer; click to draw it.
   Shift+Ctrl snaps the line's angle to 5 degree steps. The drawing itself is in straight-lines.js (brushLineStart / brushLineSnap). */
const slp={cv:null,cx:0,cy:0,shift:false,ctrl:false};
function slpTarget(){if(!brushLineAnchor||stroke||(typeof v3!=='undefined'&&v3.mstroke))return null;const A=brushLineAnchor,c=A.context;
  if(!c||c.layer!==doc.active||c.root!==doc.root||c.tool!==ui.tool)return null;
  if(c.space==='mesh'){const h=document.getElementById('v3Hit');if(!h||ui.mode!=='p3d')return null;const r=h.getBoundingClientRect();return {ax:r.left+A.x,ay:r.bottom-A.y,flip:true,r};}
  const st=document.getElementById('stage');if(!st)return null;const r=st.getBoundingClientRect(),s=toScreen(A.x,A.y);return {ax:r.left+s[0],ay:r.top+s[1],flip:false,r};}
function slpDraw(){const cv=slp.cv;if(!cv)return;const g=cv.getContext('2d');g.clearRect(0,0,cv.width,cv.height);
  if(!slp.shift)return;const T=slpTarget();if(!T)return;let x=slp.cx,y=slp.cy;
  if(x<T.r.left||x>T.r.right||y<T.r.top||y>T.r.bottom)return;
  if(slp.ctrl){const dx=x-T.ax,dy=y-T.ay,len=Math.hypot(dx,dy);if(len>1){const a=Math.round(Math.atan2(dy,dx)/(Math.PI/36))*(Math.PI/36);x=T.ax+Math.cos(a)*len;y=T.ay+Math.sin(a)*len;}}
  g.lineWidth=3;g.strokeStyle='rgba(0,0,0,.55)';g.setLineDash([7,7]);g.beginPath();g.moveTo(T.ax,T.ay);g.lineTo(x,y);g.stroke();
  g.lineWidth=1.5;g.strokeStyle='rgba(255,255,255,.95)';g.beginPath();g.moveTo(T.ax,T.ay);g.lineTo(x,y);g.stroke();}
function slpSize(){if(slp.cv){slp.cv.width=innerWidth;slp.cv.height=innerHeight;slpDraw();}}
(function(){const go=()=>{slp.cv=el('canvas',{id:'slPrev','aria-hidden':'true'});slp.cv.style.cssText='position:fixed;left:0;top:0;pointer-events:none;z-index:950';document.body.append(slp.cv);slpSize();
  window.addEventListener('resize',slpSize);
  window.addEventListener('pointermove',e=>{slp.cx=e.clientX;slp.cy=e.clientY;slp.shift=e.shiftKey;slp.ctrl=e.ctrlKey;slpDraw();},true);
  window.addEventListener('keydown',e=>{if(e.key==='Shift'||e.key==='Control'){slp.shift=e.shiftKey||e.key==='Shift';slp.ctrl=e.ctrlKey||e.key==='Control';slpDraw();}},true);
  window.addEventListener('keyup',e=>{if(e.key==='Shift')slp.shift=false;if(e.key==='Control')slp.ctrl=false;slpDraw();},true);
  window.addEventListener('pointerdown',()=>{const g=slp.cv.getContext('2d');g.clearRect(0,0,slp.cv.width,slp.cv.height);},true);
  window.addEventListener('blur',()=>{slp.shift=slp.ctrl=false;slpDraw();});};
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',go);else setTimeout(go,0);})();
