/* ================= 3D Paint waits until it is ready (0.98.17) =================
   Kenn: "letting the 3D paint section load fully before allowing me to do things, because it's unusable when opening". Opening a project or
   coming back to the tab left work for later: the mask shaders compiled on first use, the model's textures were built on the first frames,
   the position maps and the skin/metal packs were made on the first draws, so the first strokes and clicks stuttered for seconds.
   A screen now covers 3D Paint with a progress bar and does that work up front; it goes when the view has drawn a run of smooth frames
   (or after two minutes, or "Start now"). Preferences › "3D Paint: wait until ready" turns it off. Tests skip it (navigator.webdriver)
   unless they set window.__p3Ready. */
const p3r={el:null,on:false,t0:0,good:0,last:0,raf:0,ms:false,pos:false,dirty0:true,why:''};
const P3R_GOOD=12,P3R_MAX=120000;const p3rFrame=()=>window.__p3rFrame||150;/* ms: a frame drawn faster counts as smooth */
function p3ReadySteps(){return [
  ['The model',()=>!v3.on||!!(v3.mesh&&v3.gpu)],
  ['Mask and material shaders',()=>p3r.ms],
  ['Position maps',()=>p3r.pos],
  ['A test stroke',()=>p3r.warm==='done'],
  ['Textures on the model',()=>!v3.on||!(v3.mapsDirty||v3.editDirty)],
  ['Smooth drawing',()=>p3r.good>=P3R_GOOD]];}
function p3ReadyEls(){if(p3r.el)return p3r.el;
  const b=el('div',{id:'p3Ready',role:'status','aria-live':'polite',hidden:true},
    el('div',{class:'p3r-box'},el('div',{class:'p3r-t',text:'Getting 3D Paint ready'}),el('div',{class:'p3r-why'}),
      el('div',{class:'p3r-bar'},el('div')),el('ul',{class:'p3r-list'}),
      el('button',{class:'p3r-skip',hidden:true,text:'Start now',onclick:()=>p3ReadyEnd('skipped')})));
  /* nothing behind it reacts while it is up */
  for(const ev of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','wheel','contextmenu'])b.addEventListener(ev,e=>{if(!e.target.closest('.p3r-skip')){e.preventDefault();e.stopPropagation();}},{passive:false});
  document.body.append(b);return p3r.el=b;}
function p3ReadyKey(e){if(p3r.on){e.preventDefault();e.stopImmediatePropagation();}}
function p3ReadyNeeded(){if(prefs.p3Ready===false)return false;if(typeof navigator!=='undefined'&&navigator.webdriver&&!window.__p3Ready)return false;return true;}
function p3ReadyShow(why){if(!p3ReadyNeeded()||ui.mode!=='p3d')return;const b=p3ReadyEls();b.querySelector('.p3r-why').textContent=why||'';
  p3r.why=why||'';p3r.t0=performance.now();p3r.good=0;p3r.last=0;p3r.ms=false;p3r.pos=false;p3r.warm=null;p3r.w=null;p3r.warmRan=0;b.querySelector('.p3r-skip').hidden=true;
  if(!p3r.on){p3r.on=true;b.hidden=false;window.addEventListener('keydown',p3ReadyKey,true);window.addEventListener('keyup',p3ReadyKey,true);}
  cancelAnimationFrame(p3r.raf);p3r.raf=requestAnimationFrame(p3ReadyTick);p3ReadyPaint();}
function p3ReadyEnd(how){if(!p3r.on)return;if(p3r.w)p3ReadyWarmEnd();p3r.on=false;cancelAnimationFrame(p3r.raf);if(p3r.el)p3r.el.hidden=true;
  window.removeEventListener('keydown',p3ReadyKey,true);window.removeEventListener('keyup',p3ReadyKey,true);p3r.done=how||'ready';requestRender(true);}
function p3ReadyPaint(){const b=p3r.el;if(!b)return;const S=p3ReadySteps();let n=0;const ul=b.querySelector('.p3r-list');ul.textContent='';
  for(const [name,test] of S){let d=false;try{d=!!test();}catch(e){}if(d)n++;ul.append(el('li',{class:d?'done':'',text:(d?'✓ ':'… ')+name}));}
  const f=(n+(p3r.good>=P3R_GOOD?0:Math.min(1,p3r.good/P3R_GOOD)))/S.length;b.querySelector('.p3r-bar>div').style.width=Math.round(100*Math.min(1,f))+'%';return n===S.length;}
/* the work that otherwise waits for the first use, one piece per frame so the bar moves */
function p3ReadyWork(){if(!p3r.ms){try{if(typeof msProgs==='function')msProgs();}catch(e){}p3r.ms=true;return true;}
  if(!p3r.pos){try{if(v3.on&&v3.mesh&&typeof fillPosMaps==='function'&&doc.root&&everyNode().some(L=>L.fill||L.maskOf))fillPosMaps();}catch(e){}p3r.pos=true;return true;}
  if(p3r.warm!=='done'){p3ReadyWarm();return true;}
  return false;}
/* (0.98.19, Kenn's painting report: thirteen 0.4 s freezes in the first 20 s of painting, outside the app's own steps) the graphics
   driver finishes each drawing program the first time a stroke uses it. A faint test stroke on the model (and a smoothing one) does that
   behind this screen; both are undone and leave no history. Skipped when the active layer is not a plain paint layer. */
function p3WarmOk(){if(window.__p3NoWarm)return false;const L=doc.active,hit=document.getElementById('v3Hit');return !!(v3.on&&v3.mesh&&hit&&hit.offsetWidth>8&&L&&!L.fill&&!L.maskOf&&!L.children&&!L.adj&&!L.filter&&!L.locked&&MESH_TOOLS.includes(ui.tool)&&!stroke&&typeof meshDown==='function');}
function p3ReadyWarm(){const w=p3r.w||(p3r.w={step:0});
  try{if(w.step>0&&performance.now()-w.t0>20000){p3ReadyWarmEnd();return;}/* never hold the screen more than 20 s for it */
    if(w.step===0){if(!p3WarmOk()){p3r.warm='done';return;}w.t0=performance.now();const hit=document.getElementById('v3Hit'),R=hit.getBoundingClientRect();
      w.hit=hit;w.cx=R.left+R.width/2;w.cy=R.top+R.height/2;w.dx=Math.max(4,R.width*.04);w.u0=hist.undo.length;w.redo=hist.redo.slice();w.anchor=typeof brushLineAnchor!=='undefined'?brushLineAnchor:null;
      w.op=brush.opacity;brush.opacity=.01;w.pass=0;w.step=1;}
    const ev=(x,b)=>({clientX:x,clientY:w.cy,button:0,buttons:b,pointerId:987654,pointerType:'mouse',pressure:.5,ctrlKey:w.pass===1,metaKey:false,shiftKey:prefs.ctrlDrag==='flowop'&&w.pass===1,altKey:false,isPrimary:true,
      preventDefault(){},stopPropagation(){},getCoalescedEvents(){return [];},timeStamp:performance.now()});
    if(w.step===1){if(!meshDown(w.hit,ev(w.cx-w.dx,1))&&!v3.mstroke){w.step=9;return;}p3r.warmRan++;w.step=2;w.k=0;return;}
    if(w.step===2){meshMove(w.hit,ev(w.cx-w.dx+w.dx*2*(++w.k)/4,1));if(w.k>=4)w.step=3;return;}
    if(w.step===3){meshUp(ev(w.cx+w.dx,0));w.step=4;return;}
    if(w.step===5){if(w.undoing)return;w.step=6;}
    if(w.step===4){if(stroke)return;w.step=5;w.undoing=true;p3WarmUndo(w.u0).finally(()=>{w.undoing=false;});return;}
    if(w.step===6){
      /* the second pass is Ctrl + drag (smoothing), when that is on */
      if(w.pass===0&&prefs.ctrlLeft!==false&&prefs.painterControls!==false){w.pass=1;w.step=1;return;}w.step=9;}
    if(w.step===9){p3ReadyWarmEnd();}}
  catch(e){console.warn('3D Paint warm-up',e);p3ReadyWarmEnd();}}
async function p3WarmUndo(n){let g=6;while(hist.undo.length>n&&g-->0&&!stroke){const k=hist.undo.length;await undo();if(hist.undo.length===k)break;}}
function p3ReadyWarmEnd(){const w=p3r.w;p3r.w=null;p3r.warm='done';if(!w||w.step===0)return;try{if(v3.mstroke)meshUp();}catch(e){}if(w.op!==undefined)brush.opacity=w.op;
  if(w.u0!=null)p3WarmUndo(w.u0).then(()=>{hist.redo=w.redo;if(typeof renderHistory==='function')try{renderHistory();}catch(e){}});if(typeof brushLineAnchor!=='undefined')brushLineAnchor=w.anchor;if(typeof renderHistory==='function')try{renderHistory();}catch(e){}v3.dirty=true;requestRender(true);}
function p3ReadyTick(t){if(!p3r.on)return;if(ui.mode!=='p3d'){p3ReadyEnd('left');return;}
  const dt=p3r.last?t-p3r.last:0;p3r.last=t;const busy=(typeof busyJobs!=='undefined'&&busyJobs.size)||(typeof loadDepth!=='undefined'&&loadDepth>0);
  const worked=p3ReadyWork();
  /* a smooth frame: drawn quickly with nothing left to build */
  if(!worked&&dt&&dt<p3rFrame()&&!busy&&!(v3.on&&(v3.mapsDirty||v3.editDirty)))p3r.good++;else if(dt>=p3rFrame())p3r.good=0;
  if(v3.on){v3.dirty=true;requestRender(true);}
  const all=p3ReadyPaint(),el0=t-p3r.t0;if(el0>5000&&p3r.el)p3r.el.querySelector('.p3r-skip').hidden=false;
  if(all||el0>P3R_MAX){p3ReadyEnd(all?'ready':'timeout');return;}
  p3r.raf=requestAnimationFrame(p3ReadyTick);}
/* when it comes up: the tab is opened, a project opens or a new one starts */
{const sm=setMode;setMode=function(m){const was=ui.mode,r=sm.apply(this,arguments);if(r!==false&&m==='p3d'&&was!=='p3d'&&p3.started)p3ReadyShow('Opening the 3D Paint tab');return r;};}
{const op=openP3Project;openP3Project=async function(buf,name){const r=await op.apply(this,arguments);if(ui.mode==='p3d'&&p3.started)p3ReadyShow('Opening '+(p3.name||name||'the project'));return r;};}
{const np=p3NewProject;p3NewProject=async function(){const r=await np.apply(this,arguments);if(ui.mode==='p3d'&&p3.started)p3ReadyShow('Starting the new project');return r;};}
