/* ================= Send to HandBrake (0.98, Kenn) =================
   HandBrake is a separate free program (handbrake.fr) that squeezes video much harder than the browser's encoder can.
   Two ways, for a finished timelapse: "Compress" runs HandBrake's command-line program quietly in the background and
   puts a smaller .mp4 next to the video; "Open in HandBrake" opens the HandBrake window with the video loaded, to set
   everything by hand. Desktop app only (the web version cannot start programs).
   The window is HandBrake.exe; the background worker is HandBrakeCLI.exe, a separate download on handbrake.fr. */
const HB_KINDS=[['h265','Smaller (H.265)'],['av1','Smallest, slower (AV1)'],['h264','Plays everywhere (H.264)'],['nvenc','Fast, on an NVIDIA card (H.265)']];
const HB_Q=[['0','Smallest file'],['1','Balanced'],['2','Best picture']];
const hb={cfg:{gui:'',cli:'',kind:'h265',q:1,auto:false},found:null,jobs:new Map(),listening:false,chip:null};
try{Object.assign(hb.cfg,JSON.parse(localStorage.getItem('gs.hb')||'{}'));}catch(e){}
const hbSave=()=>{try{localStorage.setItem('gs.hb',JSON.stringify(hb.cfg));}catch(e){}};
async function hbFind(){if(!platform.isDesktop)return hb.found={gui:null,cli:null};
  try{hb.found=await platform.invoke('hb_find',{gui:hb.cfg.gui||null,cli:hb.cfg.cli||null});}catch(e){console.warn('handbrake',e);hb.found={gui:null,cli:null};}return hb.found;}
/* point Gouache at HandBrake by hand: either program; the other one is looked for in the same folder */
async function hbChoose(){const p=await platform.openDialog([{name:'HandBrake',extensions:['exe','app','']}]).catch(()=>null);if(!p)return false;
  if(/cli/i.test(fileNameOf(p)))hb.cfg.cli=p;else hb.cfg.gui=p;hbSave();await hbFind();
  if(hb.found.cli&&!hb.cfg.cli){hb.cfg.cli=hb.found.cli;}if(hb.found.gui&&!hb.cfg.gui){hb.cfg.gui=hb.found.gui;}hbSave();return true;}
const HB_NEED_CLI='Compressing in the background needs HandBrake’s command-line program, HandBrakeCLI. It is a separate free download on handbrake.fr (Downloads › Command Line Version). Unzip it anywhere, then press “Find HandBrake…” and choose HandBrakeCLI.exe.';
const HB_NEED_GUI='HandBrake was not found on this computer. It is a free program from handbrake.fr. Install it, or press “Find HandBrake…” and choose HandBrake.exe.';
async function hbOpen(v){if(!platform.isDesktop){toast('Opening HandBrake works in the desktop app. Here, use Save a copy and open that file in HandBrake.');return false;}
  if(!v||!v.path){toast('This timelapse has no file on disk yet. Use Save a copy, then open that file in HandBrake.');return false;}
  const f=await hbFind();if(!f.gui){toast(HB_NEED_GUI);return false;}
  try{await platform.invoke('launch_app',{exe:f.gui,args:[v.path]});toast('Opening “'+v.name+'” in HandBrake…');return true;}catch(e){toast('HandBrake could not be started: '+(e.message||e));return false;}}
function hbListen(){if(hb.listening||typeof TAURI==='undefined'||!TAURI||!TAURI.event)return;hb.listening=true;
  TAURI.event.listen('hb-progress',e=>{const j=hb.jobs.get(e.payload.id);if(j){j.pct=e.payload.pct;hbChip();}});
  TAURI.event.listen('hb-done',e=>hbDone(e.payload));}
/* the little progress note at the bottom of the window, with Stop */
function hbChip(){const jobs=[...hb.jobs.values()];if(!jobs.length){if(hb.chip){hb.chip.remove();hb.chip=null;}return;}
  if(!hb.chip){hb.chip=el('div',{id:'hbChip',class:'hbchip',role:'status','aria-live':'polite'});document.body.append(hb.chip);}
  const j=jobs[0];hb.chip.replaceChildren(el('span',{text:'HandBrake is compressing “'+j.name+'” · '+Math.round(j.pct||0)+'%'+(jobs.length>1?' (+'+(jobs.length-1)+' waiting)':'')}),
    el('button',{class:'btn sm',type:'button',id:'hbStop',text:'Stop',onclick:()=>{platform.invoke('hb_cancel',{id:j.id}).catch(()=>{});}}));}
async function hbDone(r){const j=hb.jobs.get(r.id);if(!j)return;hb.jobs.delete(r.id);hbChip();
  if(!r.ok){toast(r.msg==='stopped'?'HandBrake was stopped. The original video is untouched.':'HandBrake could not compress “'+j.name+'”'+(r.msg?' ('+r.msg+')':'')+'. The original video is untouched.');return;}
  const mb=n=>(Math.round(n/104857.6)/10)+' MB',was=j.size||0;
  try{const v=await tlGet('videos',j.vid);if(v){v.hb={path:j.out,size:r.size};await tlPut('videos',v);}}catch(e){}
  toast('HandBrake made “'+j.name+'” '+mb(r.size)+(was?' (it was '+mb(was)+(was>r.size?', '+Math.round((1-r.size/was)*100)+'% smaller':'')+')':'')+'. It is next to the original: '+fileNameOf(j.out));
  if(typeof tlUI==='function')tlUI();}
/* compress one finished timelapse in the background; quiet = started by "after each timelapse" (no nagging when HandBrake is missing) */
async function hbCompress(v,quiet){if(!platform.isDesktop){if(!quiet)toast('Compressing with HandBrake works in the desktop app. Here, use Save a copy and open that file in HandBrake.');return false;}
  if(!v||!v.path){if(!quiet)toast('This timelapse has no file on disk yet. Use Save a copy, then compress that file in HandBrake.');return false;}
  const f=await hbFind();if(!f.cli){if(!quiet)toast(HB_NEED_CLI);else toast('The timelapse was not sent to HandBrake: HandBrakeCLI was not found (see the timelapse settings).');return false;}
  hbListen();const id='hb'+Date.now()+Math.round(Math.random()*1e4),out=v.path.replace(/\.[^./\\]+$/,'')+'-small.mp4';
  hb.jobs.set(id,{id,vid:v.id,name:v.name,out,pct:0,size:v.blob?v.blob.size:0});hbChip();
  try{await platform.invoke('hb_run',{id,cli:f.cli,input:v.path,output:out,kind:hb.cfg.kind,quality:+hb.cfg.q||0,width:v.w|0,height:v.h|0,fps:v.fps|0});return true;}
  catch(e){hb.jobs.delete(id);hbChip();toast('HandBrake could not be started: '+(e.message||e));return false;}}
function hbAfterTimelapse(v){if(hb.cfg.auto&&platform.isDesktop&&v&&v.path)hbCompress(v,true);}
/* the buttons on a finished timelapse's row */
function hbRowButtons(v){if(!platform.isDesktop)return [];
  return [el('button',{class:'btn sm hbgo',type:'button',text:'Compress',title:'Make a smaller copy with HandBrake, in the background',onclick:()=>hbCompress(v)}),
    el('button',{class:'btn sm hbopen',type:'button',text:'Open in HandBrake',title:'Open this video in the HandBrake window',onclick:()=>hbOpen(v)}),
    ...(v.hb&&v.hb.path?[el('button',{class:'btn sm',type:'button',text:'Show smaller copy ('+(Math.round(v.hb.size/104857.6)/10)+' MB)',onclick:()=>platform.invoke('reveal_path',{path:v.hb.path}).catch(()=>toast('The smaller copy is no longer there.'))})]:[])];}
/* the HandBrake part of the timelapse settings */
function hbTimelapseBox(redraw){const head=el('div',{class:'sub',text:'HandBrake'});
  if(!platform.isDesktop)return [head,el('p',{class:'note',text:'In the desktop app, a finished timelapse can be sent to HandBrake (a free program) to make it much smaller. Here in the browser, save a copy and open it in HandBrake yourself.'})];
  const st=el('p',{class:'note',id:'hbState',text:'Looking for HandBrake…'});
  const sel=(id,label,opts,get,set)=>{const s=el('select',{id,'aria-label':label},...opts.map(([v,t])=>el('option',{value:String(v),text:t})));s.value=String(get());s.onchange=()=>{set(s.value);hbSave();};return el('div',{class:'frow'},el('label',{text:label,for:id}),s);};
  const auto=el('input',{type:'checkbox',id:'hbAuto'});auto.checked=!!hb.cfg.auto;auto.onchange=()=>{hb.cfg.auto=auto.checked;hbSave();};
  hbFind().then(f=>{st.textContent=f.cli&&f.gui?'HandBrake is ready (the window and the background compressor were found).':f.gui?'HandBrake’s window was found, so “Open in HandBrake” works. '+HB_NEED_CLI:f.cli?'The background compressor (HandBrakeCLI) was found. HandBrake’s own window was not, so “Open in HandBrake” needs it installed or chosen.':HB_NEED_GUI+' For compressing in the background, also get HandBrakeCLI (Downloads › Command Line Version).';});
  return [head,el('p',{class:'note',text:'HandBrake is a free program that makes a finished video much smaller. Compress works in the background and puts a “-small.mp4” next to the video; Open in HandBrake lets you set everything yourself. The buttons are on each finished timelapse below.'}),st,
    el('div',{class:'chips'},el('button',{class:'btn sm',type:'button',id:'hbFindBtn',text:'Find HandBrake…',title:'Choose HandBrake.exe or HandBrakeCLI.exe yourself',onclick:async()=>{if(await hbChoose())redraw();}})),
    sel('hbKind','Compress as',HB_KINDS,()=>hb.cfg.kind,v=>{hb.cfg.kind=v;}),sel('hbQ','How small',HB_Q,()=>hb.cfg.q,v=>{hb.cfg.q=+v;}),
    el('label',{class:'chk',for:'hbAuto'},auto,el('span',{text:' Compress with HandBrake after every timelapse'}))];}
