/* ================= GPU health (0.74) =================
   - Which graphics card Windows gave us, written to a small log (localStorage gs.gpuLog) together with what was
     going on when the card reset, so a black screen can be described exactly.
   - A reset card ("context lost") can't be repaired in place: every texture is gone. We stop touching the card
     (autosave would write black pictures over the good recovery copy), say what happened, and restart the app so the
     welcome screen offers the last autosave.
   - A warning before graphics memory runs out (a full card is the usual cause of a black screen at 4096 px).
   - Help › Graphics card report: the card, memory and a short speed test, with a Copy button for testers. */
const gpuHealth={lost:false,warned:false,vram:0};
function gpuInfo(){const x=gl.getExtension('WEBGL_debug_renderer_info'),o={renderer:x?gl.getParameter(x.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:x?gl.getParameter(x.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),version:gl.getParameter(gl.VERSION),maxTex:gl.getParameter(gl.MAX_TEXTURE_SIZE),maxSamplers:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),float:canFloat,
    quality:prefs.quality||'high',pref:gpuPrefGet()};try{const c=document.createElement('canvas').getContext('webgl2');o.software=/swiftshader|llvmpipe|software|basic render/i.test(o.renderer);}catch(e){}return o;}
function gpuPrefGet(){try{return localStorage.getItem('gs.gpuPref')||'high-performance';}catch(e){return 'high-performance';}}
function gpuLogRead(){try{return JSON.parse(localStorage.getItem('gs.gpuLog')||'[]');}catch(e){return [];}}
function gpuLogAdd(kind){try{const G=gpuMemory(),l=gpuLogRead();l.push({t:Date.now(),kind,renderer:gpuInfo().renderer,doc:doc.w+'x'+doc.h+' '+doc.depth+'-bit',layers:allLayers().length,maps:doc.maps.length,mode:ui.mode,tracked:Math.round(G.bytes/1048576)+' MB',targets:G.targets});
  localStorage.setItem('gs.gpuLog',JSON.stringify(l.slice(-20)));}catch(e){}}
gpuLogAdd('start');
/* A trail of save steps that survives a crash: the page cannot log anything once its process is gone, so the step is written
   (at most every 400 ms) to localStorage. The next start finds a save that never finished and says where it stopped. */
let ghCrumbAt=0,ghCrumbStep='',ghProject=false;/* ghProject: a whole 3D Paint project is being encoded (its sets are not the end of the save) */
function ghCrumb(step,force){const now=Date.now();if(!force&&step===ghCrumbStep&&now-ghCrumbAt<400)return;if(!force&&now-ghCrumbAt<400&&/^save: picture/.test(step))return;ghCrumbAt=now;ghCrumbStep=step;
  try{const m=performance.memory;localStorage.setItem('gs.crumb',JSON.stringify({t:now,step,heap:m?Math.round(m.usedJSHeapSize/1048576):undefined,lim:m?Math.round(m.jsHeapSizeLimit/1048576):undefined,doc:doc.w+'x'+doc.h,layers:allLayers().length,gpu:Math.round(gpuMemory().bytes/1048576)}));}catch(e){}}
(function(){try{const c=JSON.parse(localStorage.getItem('gs.crumb')||'null');if(c&&/^save:/.test(c.step)&&!/finished|failed|cancel|encoded/.test(c.step)){const l=gpuLogRead();l.push({t:c.t,kind:'last session stopped during: '+c.step+(c.heap?' (page memory '+c.heap+' of '+c.lim+' MB)':''),renderer:'',doc:c.doc,layers:c.layers,maps:0,mode:'',tracked:c.gpu+' MB',targets:0});localStorage.setItem('gs.log.crumb','1');localStorage.setItem('gs.gpuLog',JSON.stringify(l.slice(-20)));}
  localStorage.removeItem('gs.crumb');}catch(e){}})();

/* the drawing back-end in use; a WebGPU or native one is planned (docs/native-renderer-plan.md) and will switch this */
const gpuBackend={kind:'webgl2'};
/* does this machine offer WebGPU (the planned next step)? asked once, shown in the report */
async function ghWebGPU(){try{if(!navigator.gpu)return 'not available';const a=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!a)return 'no adapter';const i=a.info||{},l=a.limits||{};return 'available — '+[i.vendor,i.architecture,i.description].filter(Boolean).join(' ')+' · max buffer '+fmtBytes(l.maxBufferSize||0)+' · timestamp query '+(a.features&&a.features.has('timestamp-query')?'yes':'no');}catch(e){return 'error: '+(e.message||e);}}

cv.addEventListener('webglcontextlost',e=>{e.preventDefault();if(gpuHealth.lost)return;gpuHealth.lost=true;gpuLogAdd('context lost');
  try{if(typeof as!=='undefined')as.busy=true;}catch(err){}
  openDialog({title:'The graphics card reset',okLabel:'Restart the app',cancelLabel:'Stay here',
    body:el('div',{class:'dlg-grid'},el('p',{text:'Windows reset the graphics card (it was asked to do too much at once, or it ran out of memory), so the picture on screen is gone.'}),
      el('p',{text:'Your last autosave is safe. Restart the app and the welcome screen offers it back. Nothing was saved over it just now.'}),
      el('p',{class:'note',text:'Tip: Preferences › Graphics shows the card in use and a lower setting for the 3D view. Help › Graphics card report helps us find the cause.'})),
    onOk(){window.__gsQuit=true;location.reload();}});});
cv.addEventListener('webglcontextrestored',()=>{gpuLogAdd('context restored');toast('The graphics card came back. Restart the app to be safe.');});

/* graphics memory: warn once when the textures we track get near what the card can hold */
function gpuBudget(){try{const g=+localStorage.getItem('gs.vramSet');if(g>0)return g*1073741824;}catch(e){}if(gpuHealth.vram)return gpuHealth.vram;try{const v=+localStorage.getItem('gs.vram2');if(v>0)return v*1048576;}catch(e){}return 6*1073741824;}
setInterval(()=>{if(gpuHealth.lost||gpuHealth.warned||document.hidden)return;const G=gpuMemory(),b=gpuBudget();
  if(G.bytes>b*0.75){gpuHealth.warned=true;gpuLogAdd('memory high');toast('Graphics memory is nearly full ('+fmtBytes(G.bytes)+' of about '+fmtBytes(b)+'). Close tabs, use a smaller canvas or 8-bit, or lower the 3D quality to avoid a black screen.');}},5000);

/* how fast this card draws the CURRENT brush: dabs go into a private 1024×1024 picture (the document is not touched) */
function ghBrushTest(){const B=brush,out={},T=1024,wait=()=>{};let t=null;
  try{t=makeTarget(T,T,8);const r=Math.max(.5,(B.size||40)/2),tip=B.tip&&B.tip.tex?B.tip:null,ext=r*(tip?1.4143:1)+2,gx=Math.max(1,Math.round(T/6)),step=Math.max(.5,(B.spacing||.1)*2*r);
    const U={uRadius:r,uExtent:ext,uSize:[T,T],uHard:B.hardness,uGrain:B.grain||0,uGrainScale:[T/gx,T/gx],uPeriod:[gx,gx],uUseTip:!!tip,uTip:tip?tip.tex:dummy,uAngle:0,uRound:B.roundness||1,uFlip:[1,1],uTipAspect:tip?tip.w/tip.h:1};
    const sync=()=>{const b=new Uint8Array(4);gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,b);};
    const pass=(dual,n)=>{const D=dual?dualUniforms(B.dual,false):null;if(dual&&!D)return null;clearTarget(t);sync();const t0=performance.now();
      for(let i=0;i<n;i++){const d=i*step,x=60+d%(T-120),y=120+((d/(T-120))|0)%6*140;run(P.stamp,t,Object.assign({},U,D||{},{uCenter:[x,y],uAlpha:1,uTint:{int:0},uDabCol:[0,0,0]}),{blend:'max'});}
      sync();return performance.now()-t0;};
    pass(false,20);/* warm-up */
    const n=300,plain=pass(false,n);out.size=Math.round(B.size||40);out.spacing=Math.round((B.spacing||.1)*1000)/10;out.tip=tip?'tip picture':'round';
    out.plainMs=plain/n;const dual=B.dual&&B.dual.on?pass(true,n):null;if(dual!==null)out.dualMs=dual/n;
  }catch(e){out.error=String(e.message||e);}finally{if(t)disposeTarget(t);}
  return out;}
/* ---- speed test ---- */
const GH_FS=`in vec2 vUV; uniform float uN; void main(){vec2 p=vUV*8.0;float a=0.0;for(int i=0;i<int(uN);i++){p=vec2(sin(p.y*1.3+a),cos(p.x*1.7-a))*1.1+p*0.3;a+=dot(p,p)*0.01;}o=vec4(fract(a),0.5,0.5,1.0);}`;
let ghProg=null;
async function ghTest(){const out={},wait=()=>new Promise(r=>setTimeout(r,30));ghProg=ghProg||program(GH_FS);
  const sync=t=>{const b=new Uint16Array(4);gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);gl.readPixels(0,0,1,1,gl.RGBA,gl.HALF_FLOAT,b);};
  let t=null;
  try{/* 1: a heavy full-screen shader at 4096×4096 (the 4K painting size) */
    t=makeTarget(4096,4096,16);run(ghProg,t,{uN:8});sync(t);await wait();
    let t0=performance.now();for(let i=0;i<6;i++)run(ghProg,t,{uN:16});sync(t);out.shaderMs=(performance.now()-t0)/6;
    /* 2: many blended copies (memory speed: what layer compositing does) */
    const u={uN:1};t0=performance.now();gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);for(let i=0;i<24;i++)run(ghProg,t,u);gl.disable(gl.BLEND);sync(t);out.blendMs=(performance.now()-t0)/24;
  }catch(e){out.error=String(e.message||e);}finally{if(t)disposeTarget(t);}
  /* 3: how many 4096² half-float pictures (128 MB each) the card takes before it refuses */
  const held=[];try{for(let i=0;i<24;i++){const x=makeTarget(4096,4096,16);held.push(x);if(gl.getError()!==gl.NO_ERROR){break;}}}catch(e){}
  out.fit=held.length*128;for(const x of held)disposeTarget(x);
  /* the test stops at 24 pictures (3 GB): reaching that says the card has at least that much, not how much */
  out.capped=held.length>=24;
  if(!out.capped&&out.fit>=1024){gpuHealth.vram=out.fit*1048576*1.25;try{localStorage.setItem('gs.vram2',String(Math.round(out.fit*1.25)));}catch(e){}}
  out.brush=ghBrushTest();out.webgpu=await ghWebGPU();return out;}
function ghReportText(r){const I=gpuInfo(),G=gpuMemory(),log=gpuLogRead().filter(x=>x.kind!=='start').slice(-5);
  return ['Gouache Studio '+(typeof APP_VERSION!=='undefined'?APP_VERSION:''),
    'Graphics card: '+I.renderer+(I.software?'  (SOFTWARE — no real graphics card in use)':''),'Vendor: '+I.vendor,'Driver/API: '+I.version,
    'Largest texture: '+I.maxTex+' · samplers: '+I.maxSamplers+' · float targets: '+(I.float?'yes':'no'),'Card preference: '+I.pref+' · 3D quality: '+I.quality,
    'Document: '+doc.w+'×'+doc.h+' '+doc.depth+'-bit · '+allLayers().length+' layers · '+doc.maps.length+' maps · mode '+ui.mode,
    'Tracked graphics memory: '+fmtBytes(G.bytes)+' in '+G.targets+' pictures (budget '+fmtBytes(gpuBudget())+')',
    (()=>{const S=typeof gfSaveStats!=='undefined'&&gfSaveStats.last;return S&&S.images?'Last save: '+(S.total/1000).toFixed(1)+' s in all · GPU read '+(S.read/1000).toFixed(1)+' s · waiting for packing '+(S.pack/1000).toFixed(1)+' s · finding edges '+(S.bounds/1000).toFixed(1)+' s · '+S.images+' pictures, '+fmtBytes(S.bytes):'';})(),
    (()=>{const e=gpuLogRead().filter(x=>/^last session stopped/.test(x.kind)).pop();return e?'The app stopped while saving ('+new Date(e.t).toLocaleString()+'): '+e.kind.replace('last session stopped during: ',''):'';})(),
    (()=>{const F=typeof v3!=='undefined'&&v3.fbo;return F?'3D view buffer: '+F.w+'×'+F.h+' with '+F.S+'× smoothing':'';})(),
    'Drawing back-end: '+gpuBackend.kind+' · WebGPU: '+(r&&r.webgpu||'checking…'),
    r&&r.brush?(r.brush.error?'Brush test failed: '+r.brush.error:'Current brush ('+r.brush.size+' px, '+r.brush.tip+', spacing '+r.brush.spacing+'%): '+(1000/r.brush.plainMs).toFixed(0)+' dabs a second'+(r.brush.dualMs?' · with dual brush '+(1000/r.brush.dualMs).toFixed(0)+' dabs a second':'')):'',
    r?(r.error?'Test failed: '+r.error:'Speed test at 4096²: heavy shader '+r.shaderMs.toFixed(1)+' ms · layer blend '+r.blendMs.toFixed(1)+' ms · room for '+(r.capped?'at least ':'about ')+r.fit+' MB of pictures'):'',
    gpuHealth.sample?'Painting sample (10 s, taken '+gpuHealth.sample.at+'):\n'+gpuHealth.sample.text:'',
    log.length?'Recent events: '+log.map(x=>new Date(x.t).toLocaleString()+' '+x.kind+' ('+x.doc+', '+x.layers+' layers, '+x.tracked+')').join('; '):''].filter(Boolean).join('\n');}
function dlgGpuReport(){const pre=el('pre',{class:'note',style:'white-space:pre-wrap;user-select:text;max-height:320px;overflow:auto'}),text0=ghReportText(null);pre.textContent=text0+'\n\nRunning the speed test…';
  const sel=el('select',{id:'ghPref',onchange:e=>{try{localStorage.setItem('gs.gpuPref',e.target.value);}catch(x){}note.textContent='Restart the app to use this choice.';}},
    ...[['high-performance','Fastest card (recommended)'],['default','Let the system decide'],['low-power','Power saving card']].map(([v,t])=>el('option',{value:v,text:t,selected:gpuPrefGet()===v})));
  const note=el('p',{class:'note',text:''});let txt=text0;
  const vsel=el('select',{id:'ghVram',onchange:e=>{try{if(e.target.value==='0')localStorage.removeItem('gs.vramSet');else localStorage.setItem('gs.vramSet',e.target.value);}catch(x){}gpuHealth.warned=false;note.textContent='Saved. The memory warning now uses '+fmtBytes(gpuBudget())+'.';}},
    ...[['0','Not sure (assume 6 GB)'],['4','4 GB'],['6','6 GB'],['8','8 GB'],['10','10 GB'],['12','12 GB'],['16','16 GB'],['24','24 GB']].map(([v,t])=>{let cur='0';try{cur=localStorage.getItem('gs.vramSet')||'0';}catch(x){}return el('option',{value:v,text:t,selected:cur===v});}));
  const rec=el('button',{class:'btn sm',text:'Record 10 seconds of painting…',title:'Closes this window, you paint for 10 seconds, then the report comes back with what the app was doing',onclick:()=>{closeDialog();ghRecord();}});
  openDialog({title:'Graphics card report',okLabel:'Copy report',cancelLabel:'Close',body:el('div',{class:'dlg-grid'},pre,el('label',{text:'Which graphics card to ask for: '},sel),el('label',{text:'Your card’s memory (for the warning): '},vsel),rec,note),
    onOk(){try{navigator.clipboard.writeText(txt);toast('Report copied.');}catch(e){}return false;}});
  setTimeout(async()=>{const r=await ghTest();txt=ghReportText(r);pre.textContent=txt;},50);}
/* 10 seconds of the performance monitor while the person paints, kept for the report */
function ghRecord(){const was=perf.on;perf.on=true;perf.frames=[];toast('Recording: paint now for 10 seconds…');requestRender(true);
  setTimeout(()=>{perfUpdate();gpuHealth.sample={at:new Date().toLocaleTimeString(),text:perfBox.textContent};perf.on=was;perfBox.hidden=!was;dlgGpuReport();},10000);}
MENUS.Help.splice(MENUS.Help.length-1,0,['Graphics card report…','gpuReport']);
Object.assign(actions,{gpuReport:dlgGpuReport});
