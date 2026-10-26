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
function gpuBudget(){if(gpuHealth.vram)return gpuHealth.vram;try{const v=+localStorage.getItem('gs.vram');if(v>0)return v*1048576;}catch(e){}return 6*1073741824;}
setInterval(()=>{if(gpuHealth.lost||gpuHealth.warned||document.hidden)return;const G=gpuMemory(),b=gpuBudget();
  if(G.bytes>b*0.75){gpuHealth.warned=true;gpuLogAdd('memory high');toast('Graphics memory is nearly full ('+fmtBytes(G.bytes)+' of about '+fmtBytes(b)+'). Close tabs, use a smaller canvas or 8-bit, or lower the 3D quality to avoid a black screen.');}},5000);

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
  if(out.fit>=1024){gpuHealth.vram=out.fit*1048576*1.25;try{localStorage.setItem('gs.vram',String(Math.round(out.fit*1.25)));}catch(e){}}
  out.webgpu=await ghWebGPU();return out;}
function ghReportText(r){const I=gpuInfo(),G=gpuMemory(),log=gpuLogRead().filter(x=>x.kind!=='start').slice(-5);
  return ['Gouache Studio '+(typeof APP_VERSION!=='undefined'?APP_VERSION:''),
    'Graphics card: '+I.renderer+(I.software?'  (SOFTWARE — no real graphics card in use)':''),'Vendor: '+I.vendor,'Driver/API: '+I.version,
    'Largest texture: '+I.maxTex+' · samplers: '+I.maxSamplers+' · float targets: '+(I.float?'yes':'no'),'Card preference: '+I.pref+' · 3D quality: '+I.quality,
    'Document: '+doc.w+'×'+doc.h+' '+doc.depth+'-bit · '+allLayers().length+' layers · '+doc.maps.length+' maps · mode '+ui.mode,
    'Tracked graphics memory: '+fmtBytes(G.bytes)+' in '+G.targets+' pictures (budget '+fmtBytes(gpuBudget())+')',
    'Drawing back-end: '+gpuBackend.kind+' · WebGPU: '+(r&&r.webgpu||'checking…'),
    r?(r.error?'Test failed: '+r.error:'Speed test at 4096²: heavy shader '+r.shaderMs.toFixed(1)+' ms · layer blend '+r.blendMs.toFixed(1)+' ms · room for about '+r.fit+' MB of pictures'):'',
    log.length?'Recent events: '+log.map(x=>new Date(x.t).toLocaleString()+' '+x.kind+' ('+x.doc+', '+x.layers+' layers, '+x.tracked+')').join('; '):''].filter(Boolean).join('\n');}
function dlgGpuReport(){const pre=el('pre',{class:'note',style:'white-space:pre-wrap;user-select:text;max-height:320px;overflow:auto'}),text0=ghReportText(null);pre.textContent=text0+'\n\nRunning the speed test…';
  const sel=el('select',{id:'ghPref',onchange:e=>{try{localStorage.setItem('gs.gpuPref',e.target.value);}catch(x){}note.textContent='Restart the app to use this choice.';}},
    ...[['high-performance','Fastest card (recommended)'],['default','Let the system decide'],['low-power','Power saving card']].map(([v,t])=>el('option',{value:v,text:t,selected:gpuPrefGet()===v})));
  const note=el('p',{class:'note',text:''});let txt=text0;
  openDialog({title:'Graphics card report',okLabel:'Copy report',cancelLabel:'Close',body:el('div',{class:'dlg-grid'},pre,el('label',{text:'Which graphics card to ask for: '},sel),note),
    onOk(){try{navigator.clipboard.writeText(txt);toast('Report copied.');}catch(e){}return false;}});
  setTimeout(async()=>{const r=await ghTest();txt=ghReportText(r);pre.textContent=txt;},50);}
MENUS.Help.splice(MENUS.Help.length-1,0,['Graphics card report…','gpuReport']);
Object.assign(actions,{gpuReport:dlgGpuReport});
