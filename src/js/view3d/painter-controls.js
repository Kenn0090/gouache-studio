/* ================= Substance Painter style controls on the 3D view (0.53) =================
   Kenn: "I want all of the controls to be like Painter." These follow Painter's own shortcut list (Settings › Shortcuts):
   - Ctrl + right-drag: brush size (left–right) and hardness (up–down); a ring shows the result and a label gives the numbers
   - Ctrl + left-drag: flow (left–right) and brush rotation (up–down)
   - stencil: S + left-drag rotates (Shift snaps to 90°), S + middle-drag moves, S + right-drag scales; hold N to ignore the stencil
   - F1 3D + 2D · F2 3D only · F3 2D only · F4 swap the two sides · F5 perspective · F6 orthographic
   (Alt navigation, Shift + right-drag for the sky, [ ] for the size, F to frame, Shift-click lines and Alt colour picking were already like Painter.)
   Preferences › Painting › "Substance Painter style mouse controls on the model" turns the Ctrl drags off. */
const pc={el:null};
const pcOn=()=>prefs.painterControls!==false&&ui.mode==='p3d'&&typeof v3nav!=='undefined'&&v3nav.mode!=='coat';
/* which adjusting drag a press starts (null: none) */
function pcNavOf(e,paint){if(!paint||!pcOn()||!MESH_TOOLS.includes(ui.tool))return null;
  if(!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey)return null;return e.button===2?'bsize':e.button===0?'bflow':null;}
function pcAdjust(d,e,hit,flat){const B=d.b0||(d.b0={size:brush.size,hardness:brush.hardness,flow:brush.flow,angle:brush.angle||0}),dx=e.clientX-d.x0,dy=e.clientY-d.y0;
  if(d.how==='bsize'){brush.size=clamp(Math.round(B.size*Math.exp(dx/160)),1,brushMax());brush.hardness=clamp(+(B.hardness-dy/220).toFixed(3),0,1);brushRememberSize();}
  else{brush.flow=clamp(+(B.flow+dx/280).toFixed(3),.01,1);brush.angle=Math.round(((B.angle-dy*.8+540)%360+360)%360-180);}
  if(typeof sizeSlider!=='undefined'&&sizeSlider)sizeSlider.set(brush.size);if(typeof optSync==='function')optSync();
  pcOverlay(d,hit,flat);}
/* the ring that follows the adjustment: outer = size, inner = hardness, a tick shows the rotation */
function pcOverlay(d,hit,flat){const r=hit.getBoundingClientRect(),home=flat?$('#stage'):hit.parentNode,pr=home.getBoundingClientRect();let c=pc.el;
  if(!c||!c.isConnected||c.parentNode!==home){if(c)c.remove();c=pc.el=el('div',{class:'pcadj'},el('i',{class:'pcring'}),el('i',{class:'pcin'}),el('i',{class:'pctick'}),el('b',{class:'pclbl'}));home.append(c);}
  const D=Math.max(8,flat?brush.size*view.zoom:brush.size*meshBrushScale(r.height));c.hidden=false;c.style.setProperty('--d',D+'px');c.style.setProperty('--hf',String(Math.max(.05,brush.hardness)));c.style.setProperty('--a',(-(brush.angle||0))+'deg');
  c.style.transform='translate('+(d.x0-pr.left)+'px,'+(d.y0-pr.top)+'px)';
  c.querySelector('.pclbl').textContent=d.how==='bsize'?'Size '+Math.round(brush.size)+' px · Hardness '+Math.round(brush.hardness*100)+'%':'Flow '+Math.round(brush.flow*100)+'% · Rotation '+Math.round(brush.angle||0)+'°';}
function pcEnd(){if(pc.el&&!pc.el.hidden){pc.el.hidden=true;if(typeof buildBrushPanel==='function')buildBrushPanel();if(typeof buildOptBar==='function')buildOptBar();if(typeof brushRememberSize==='function')brushRememberSize();}}
window.addEventListener('pointerup',pcEnd,true);window.addEventListener('pointercancel',pcEnd,true);window.addEventListener('blur',pcEnd);
/* N held: the stencil is ignored (st3Uniforms reads st3.nKey) */
window.addEventListener('keydown',e=>{if((e.key==='n'||e.key==='N')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.repeat&&st3.img&&ui.mode==='p3d'&&v3.on&&v3.hover&&!isTypingTarget(e.target)){e.preventDefault();e.stopImmediatePropagation();st3.nKey=true;v3.dirty=true;requestRender();}},true);
window.addEventListener('keyup',e=>{if((e.key==='n'||e.key==='N')&&st3.nKey){st3.nKey=false;v3.dirty=true;requestRender();}},true);
/* F1–F6 in 3D Paint, as in Painter */
const pcSwapped=()=>{try{return localStorage.getItem('gs.p3swap')==='1';}catch(e){return false;}};
function pcSwap(){const on=!pcSwapped();try{localStorage.setItem('gs.p3swap',on?'1':'0');}catch(e){}const w=$('#work');if(w)w.classList.toggle('p3left',!on);if(typeof resizeGL==='function')resizeGL();fit();v3.dirty=true;requestRender(true);toast(on?'The flat texture is on the left, the 3D view on the right.':'The 3D view is on the left, the flat texture on the right.');}
window.addEventListener('keydown',e=>{if(!pcOn()||isTypingTarget(e.target)||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey)return;
  const m={F1:()=>p3SetLayout('split'),F2:()=>p3SetLayout('3d'),F3:()=>p3SetLayout('2d'),F4:pcSwap,F5:()=>v3SetOrtho(false),F6:()=>v3SetOrtho(true)}[e.key];
  if(!m||document.getElementById('modal')&&!document.getElementById('modal').hidden)return;e.preventDefault();e.stopImmediatePropagation();m();},true);

/* the same two drags on the flat texture of 3D Paint (the canvas side of Split), as in Painter's 2D view */
(()=>{const cvEl=document.getElementById('gl');if(!cvEl)return;let d2=null;
  const flatOk=e=>pcOn()&&['brush','erase','dodge','burn','smudge'].includes(ui.tool)&&(e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&(e.button===0||e.button===2)&&!document.getElementById('modal')?.offsetParent;
  cvEl.addEventListener('pointerdown',e=>{if(!flatOk(e))return;e.preventDefault();e.stopImmediatePropagation();try{cvEl.setPointerCapture(e.pointerId);}catch(er){}
    d2={how:e.button===2?'bsize':'bflow',id:e.pointerId,x0:e.clientX,y0:e.clientY};},true);
  window.addEventListener('pointermove',e=>{if(!d2||e.pointerId!==d2.id)return;if(!e.buttons){d2=null;pcEnd();return;}e.stopImmediatePropagation();pcAdjust(d2,e,cvEl,true);},true);
  const done=e=>{if(d2&&(!e||e.pointerId===d2.id)){d2=null;pcEnd();}};window.addEventListener('pointerup',done,true);window.addEventListener('pointercancel',done,true);
  cvEl.addEventListener('contextmenu',e=>{if(pcOn()&&(e.ctrlKey||e.metaKey))e.preventDefault();},true);})();
