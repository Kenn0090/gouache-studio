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
  p3r.why=why||'';p3r.t0=performance.now();p3r.good=0;p3r.last=0;p3r.ms=false;p3r.pos=false;b.querySelector('.p3r-skip').hidden=true;
  if(!p3r.on){p3r.on=true;b.hidden=false;window.addEventListener('keydown',p3ReadyKey,true);window.addEventListener('keyup',p3ReadyKey,true);}
  cancelAnimationFrame(p3r.raf);p3r.raf=requestAnimationFrame(p3ReadyTick);p3ReadyPaint();}
function p3ReadyEnd(how){if(!p3r.on)return;p3r.on=false;cancelAnimationFrame(p3r.raf);if(p3r.el)p3r.el.hidden=true;
  window.removeEventListener('keydown',p3ReadyKey,true);window.removeEventListener('keyup',p3ReadyKey,true);p3r.done=how||'ready';requestRender(true);}
function p3ReadyPaint(){const b=p3r.el;if(!b)return;const S=p3ReadySteps();let n=0;const ul=b.querySelector('.p3r-list');ul.textContent='';
  for(const [name,test] of S){let d=false;try{d=!!test();}catch(e){}if(d)n++;ul.append(el('li',{class:d?'done':'',text:(d?'✓ ':'… ')+name}));}
  const f=(n+(p3r.good>=P3R_GOOD?0:Math.min(1,p3r.good/P3R_GOOD)))/S.length;b.querySelector('.p3r-bar>div').style.width=Math.round(100*Math.min(1,f))+'%';return n===S.length;}
/* the work that otherwise waits for the first use, one piece per frame so the bar moves */
function p3ReadyWork(){if(!p3r.ms){try{if(typeof msProgs==='function')msProgs();}catch(e){}p3r.ms=true;return true;}
  if(!p3r.pos){try{if(v3.on&&v3.mesh&&typeof fillPosMaps==='function'&&doc.root&&everyNode().some(L=>L.fill||L.maskOf))fillPosMaps();}catch(e){}p3r.pos=true;return true;}
  return false;}
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
