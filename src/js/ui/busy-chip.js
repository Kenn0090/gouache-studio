/* (0.98.13, Kenn: "if something is loading in the background or compiling, give a visible bar for that")
   A small bar in the corner while the app is doing work that can stall the picture: the graphics card compiling a shader
   (the first time each one is used), building a sky's lighting, building a model's search tree. Several jobs share one bar. */
const busyJobs=new Map();let busyEl=null,busySeq=0,busyShownAt=0,busyHideT=0;
function busyEls(){if(!busyEl){busyEl=el('div',{id:'busyChip',role:'status','aria-live':'polite',hidden:true},el('span',{class:'bc-msg'}),el('div',{class:'bc-bar'},el('div')));document.body.append(busyEl);}return busyEl;}
function busyShow(){const b=busyEls();clearTimeout(busyHideT);if(b.hidden){b.hidden=false;busyShownAt=performance.now();}
  const names=[...new Set([...busyJobs.values()])];b.querySelector('.bc-msg').textContent=names.join(' · ')+'…';}
function busyHide(){if(busyJobs.size||!busyEl)return;const wait=Math.max(0,500-(performance.now()-busyShownAt));clearTimeout(busyHideT);busyHideT=setTimeout(()=>{if(!busyJobs.size)busyEl.hidden=true;},wait);}
/* start a named job; call the returned function when it is done */
function busyStart(label){const id=++busySeq;busyJobs.set(id,label);busyShow();let done=false;return ()=>{if(done)return;done=true;busyJobs.delete(id);busyHide();};}
function busyAround(label,fn){const end=busyStart(label);try{const r=fn();if(r&&typeof r.then==='function')return r.finally(end);end();return r;}catch(e){end();throw e;}}
{const use0=useProg;useProg=function(prog,u,packedOut){let end=null;if(prog&&!prog._busySeen){prog._busySeen=true;end=busyStart('Compiling shaders');}
  try{return use0.apply(this,arguments);}finally{if(end)requestAnimationFrame(()=>requestAnimationFrame(end));}};}
if(typeof envBuild==='function'){const e0=envBuild;envBuild=function(){const end=busyStart('Building the sky lighting');try{return e0.apply(this,arguments);}finally{requestAnimationFrame(()=>requestAnimationFrame(end));}};}
if(typeof bvhBuildAsync==='function'){const b0=bvhBuildAsync;bvhBuildAsync=function(){const end=busyStart('Building the search tree');const r=b0.apply(this,arguments);r.then(end,end);return r;};}
