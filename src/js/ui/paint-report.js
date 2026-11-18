/* ================= Painting report (0.98, Help › Painting report…) =================
   Kenn: painting is smooth but could be smoother, with random stutters at 4K, with many layers and big brushes.
   Those depend on the graphics card, which cannot be measured anywhere but on the machine itself. This records
   while you paint: every screen refresh (how late it came), how long each of the app's own steps took, the
   graphics card's time per frame where the driver reports it, and the browser's long pauses. Stop gives a short
   text to copy: the setup, how even the frames were, and for each stutter what was going on at that moment.
   Nothing is timed unless a recording is running. */
const pr={on:false,hooked:false,t0:0,secs:[],frames:[],long:[],gpu:[],gpuSeen:0,strokeEnds:[],raf:0,last:0,chip:null,perfWas:false,text:''};
const PR_MAX=200000;
function prWrap(f,label,isAsync){if(typeof f!=='function'||f._pr)return f;
  const w=function(...a){if(!pr.on)return f.apply(this,a);const t=performance.now();let r;
    try{r=f.apply(this,a);}finally{if(!isAsync&&pr.secs.length<PR_MAX)pr.secs.push([label,t,performance.now()-t]);}
    if(isAsync){if(r&&typeof r.then==='function')r.then(()=>pr.secs.push([label,t,performance.now()-t]),()=>{});else pr.secs.push([label,t,performance.now()-t]);}
    return r;};
  w._pr=true;return w;}
/* the app's own steps, by the names its code calls them (each name has to be swapped by hand: they are not window properties) */
function prHook(){if(pr.hooked)return;pr.hooked=true;const T=(f,g)=>{try{f();}catch(e){}};
  T(()=>{composite=prWrap(composite,'putting the layers together');});
  T(()=>{drawView=prWrap(drawView,'drawing the canvas view');});
  T(()=>{draw3D=prWrap(draw3D,'drawing the 3D view');});
  T(()=>{drawUVOverlay=prWrap(drawUVOverlay,'UV overlay');});
  T(()=>{flushThumbs=prWrap(flushThumbs,'layer thumbnails');});
  T(()=>{beginStroke=prWrap(beginStroke,'starting a stroke');});
  T(()=>{endStroke=prWrap(endStroke,'finishing a stroke');});
  T(()=>{addPoint=prWrap(addPoint,'brush dabs');});
  T(()=>{renderLayers=prWrap(renderLayers,'Layers panel');});
  T(()=>{renderHistory=prWrap(renderHistory,'History panel');});
  T(()=>{navPicture=prWrap(navPicture,'navigator picture');});
  T(()=>{v3Refresh=prWrap(v3Refresh,'model textures refresh');});
  T(()=>{v3MapTex=prWrap(v3MapTex,'model map copy');});
  T(()=>{v3PatchMips=prWrap(v3PatchMips,'model texture detail levels');});
  T(()=>{studioShadowPrepare=prWrap(studioShadowPrepare,'shadows');});
  T(()=>{pushUndo=prWrap(pushUndo,'undo step');});
  T(()=>{trimPools=prWrap(trimPools,'freeing spare textures');});
  T(()=>{meshDown0=prWrap(meshDown0,'stroke start on the model');});
  T(()=>{meshDownUV=prWrap(meshDownUV,'stroke start on the model (UV)');});
  T(()=>{meshMove=prWrap(meshMove,'pen move on the model');});
  T(()=>{meshUp=prWrap(meshUp,'stroke end on the model');});
  T(()=>{msUpdate=prWrap(msUpdate,'mask rows');});
  T(()=>{fillRender=prWrap(fillRender,'material redraw');});
  T(()=>{dkRender=prWrap(dkRender,'panel layout');});
  T(()=>{renderMatEd=prWrap(renderMatEd,'Properties panel');});
  T(()=>{buildBrushPanel=prWrap(buildBrushPanel,'Brush panel');});
  T(()=>{drawBrushPreview=prWrap(drawBrushPreview,'brush preview');});
  T(()=>{updateStatus=prWrap(updateStatus,'status bar');});
  T(()=>{autosaveNow=prWrap(autosaveNow,'autosave',true);});
  T(()=>{tlCapture=prWrap(tlCapture,'timelapse picture',true);});
  try{new PerformanceObserver(l=>{if(!pr.on)return;for(const e of l.getEntries())pr.long.push([e.startTime,e.duration]);}).observe({entryTypes:['longtask']});}catch(e){}}
function prTick(now){if(!pr.on)return;if(pr.last&&pr.frames.length<PR_MAX)pr.frames.push([now,now-pr.last,stroke?1:0]);pr.last=now;
  /* the graphics card's own time for each canvas frame, where the driver reports it */
  try{perfGpuPoll();for(const s of perfGpu.samples)if(s.t>pr.gpuSeen){pr.gpuSeen=s.t;pr.gpu.push([s.t,s.ms]);}}catch(e){}
  pr.raf=requestAnimationFrame(prTick);}
function prStart(){prHook();Object.assign(pr,{on:true,t0:performance.now(),secs:[],frames:[],long:[],gpu:[],gpuSeen:performance.now(),last:0,text:''});
  pr.perfWas=perf.on;perf.on=true;/* the frame loop only asks the graphics card for timings while the monitor counts as on; its box stays hidden */
  pr.raf=requestAnimationFrame(prTick);prChip();}
function prStop(){if(!pr.on)return '';pr.on=false;cancelAnimationFrame(pr.raf);perf.on=pr.perfWas;if(pr.chip){pr.chip.remove();pr.chip=null;}
  try{pr.text=prReport();}catch(e){console.error(e);pr.text='The report could not be made: '+(e&&e.message||e);}return pr.text;}
function prChip(){if(pr.chip)pr.chip.remove();pr.chip=el('div',{id:'prChip',class:'hbchip prchip',role:'status'},el('span',{class:'tldot blink','aria-hidden':'true'}),el('span',{text:'Recording how painting runs. Paint as you normally do, then press Stop.'}),
  el('button',{class:'btn sm',type:'button',id:'prStop',text:'Stop',onclick:()=>{prStop();prShow();}}));document.body.append(pr.chip);}
const prPct=(a,p)=>{if(!a.length)return 0;const s=a.slice().sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
const prMs=v=>v>=100?Math.round(v)+' ms':v.toFixed(1)+' ms';
function prSetup(){const L=allLayers(),lines=[];let gi={};try{gi=gpuInfo();}catch(e){}
  const fills=L.filter(n=>n.fill).length,masks=L.filter(n=>n.mask).length,rows=L.reduce((s,n)=>s+((n.mask&&n.mask.stack)?n.mask.stack.filter(r=>r.kind!=='paint'&&r.kind!=='fill').length:0),0),
    fx=allNodes(doc.root).filter(n=>n.fx).length,cfx=L.filter(n=>n.cfx&&n.cfx.length).length,styles=L.filter(n=>n.styles).length;
  lines.push('Gouache Studio '+APP_VERSION+(platform.isDesktop?' (desktop)':' (browser)')+' · '+(gi.renderer||'graphics card unknown'));
  lines.push('Window '+innerWidth+' × '+innerHeight+' at ×'+(window.devicePixelRatio||1).toFixed(2)+' · tab '+ui.mode+(ui.mode==='p3d'&&typeof p3!=='undefined'&&p3.sets?' · '+p3.sets.length+' texture set'+(p3.sets.length>1?'s':''):''));
  lines.push('Document '+doc.w+' × '+doc.h+' '+doc.depth+'-bit · '+doc.maps.length+' map'+(doc.maps.length>1?'s':'')+' ('+doc.maps.join(', ')+') · editing '+doc.map);
  lines.push(L.length+' layers: '+fills+' material, '+masks+' with a mask ('+rows+' generator/filter rows), '+fx+' filter layers, '+cfx+' with effects, '+styles+' with styles');
  let br='';try{br=(typeof activePreset!=='undefined'&&activePreset&&activePreset.name?'“'+activePreset.name+'” ':'')+Math.round(brush.size)+' px, spacing '+(+brush.spacing).toFixed(2)+(brush.mix?', mixing':'')+(brush.grain?', grain':'')+(brush.dual?', dual':'');}catch(e){}
  let sym='';try{sym=ui.mode==='p3d'?(typeof mir3On==='function'&&mir3On()?' · mirror on':''):(typeof symFor==='function'&&symFor()?' · symmetry on':'');}catch(e){}
  let al='';try{if(ui.mode==='p3d')al=' · alignment '+(v3s().paintAlign||'wrap')+' · 3D view '+(v3.on?'on':'off')+(v3.mesh&&v3.mesh.idx?' · '+Math.round(v3.mesh.idx.length/3).toLocaleString()+' triangles':'');}catch(e){}
  lines.push('Tool '+ui.tool+' · brush '+br+sym+al);
  lines.push('Preferences: paint speed '+(prefs.paintSpeed||'automatic')+' · engine quality '+(prefs.quality||'high')+' · undo steps '+(typeof mem!=='undefined'&&mem.steps?mem.steps:'default')+' · timelapse '+(typeof tlr!=='undefined'&&tlr.on?'recording':'off'));
  return lines;}
function prReport(){const dur=(performance.now()-pr.t0)/1000,F=pr.frames,S=pr.secs,out=['PAINTING REPORT',...prSetup(),''];
  const strokes=S.filter(s=>/^(starting a stroke|stroke start on the model)/.test(s[0])).length,ends=S.filter(s=>/^(finishing a stroke|stroke end on the model)/.test(s[0])).map(s=>s[1]+s[2]);
  const near=t=>ends.some(e=>t>=e&&t-e<400),paint=F.filter(f=>f[2]||near(f[0])),idle=F.filter(f=>!f[2]&&!near(f[0]));
  out.push('Recorded '+dur.toFixed(1)+' s · '+strokes+' strokes · '+S.filter(s=>s[0]==='brush dabs'||s[0]==='pen move on the model').length+' pen moves · '+F.length+' screen refreshes');
  if(!paint.length){out.push('','No painting was recorded. Start the recording, paint a few strokes, then press Stop.');return out.join('\n');}
  const dts=paint.map(f=>f[1]),med=prPct(dts,.5),base=Math.max(4,med),limit=Math.max(base*2.5,30),stut=paint.filter(f=>f[1]>limit).sort((a,b)=>b[1]-a[1]);
  out.push('While painting: usual gap between refreshes '+prMs(med)+' ('+Math.round(1000/base)+' a second) · 95% under '+prMs(prPct(dts,.95))+' · worst '+prMs(Math.max(...dts)));
  out.push('Stutters (a refresh later than '+prMs(limit)+'): '+stut.length+' · over 50 ms: '+paint.filter(f=>f[1]>50).length+' · over 100 ms: '+paint.filter(f=>f[1]>100).length+' · over 250 ms: '+paint.filter(f=>f[1]>250).length);
  if(idle.length)out.push('Not painting: usual gap '+prMs(prPct(idle.map(f=>f[1]),.5))+' · worst '+prMs(Math.max(...idle.map(f=>f[1]))));
  if(pr.gpu.length){const g=pr.gpu.map(x=>x[1]);out.push('Graphics card per canvas frame: usual '+prMs(prPct(g,.5))+' · 95% under '+prMs(prPct(g,.95))+' · worst '+prMs(Math.max(...g))+' ('+g.length+' samples)');}
  else out.push('Graphics card per canvas frame: this driver does not report it');
  /* what was going on at each stutter */
  out.push('','WORST STUTTERS (what the app was doing in that moment)');
  if(!stut.length)out.push('none: every refresh came on time');
  for(const f of stut.slice(0,12)){const b=f[0],a=b-f[1],inWin=S.filter(s=>s[1]<b&&s[1]+s[2]>a),by=new Map();
    for(const s of inWin){const ov=Math.min(b,s[1]+s[2])-Math.max(a,s[1]);if(ov>0)by.set(s[0],(by.get(s[0])||0)+ov);}
    const top=[...by].filter(x=>x[1]>=1).sort((x,y)=>y[1]-x[1]),cover=top.length?top[0][1]:0,lt=pr.long.filter(l=>l[0]<b&&l[0]+l[1]>a).reduce((m,l)=>Math.max(m,l[1]),0);
    const gp=pr.gpu.filter(g=>g[0]>=a-50&&g[0]<=b+300).reduce((m,g)=>Math.max(m,g[1]),0),when=f[2]?'during a stroke':'just after a stroke';
    let why=top.slice(0,4).map(x=>x[0]+' '+prMs(x[1])).join(', ');
    if(cover<f[1]*.4)why=(why?why+'; ':'')+(gp>f[1]*.4?'the graphics card was busy ('+prMs(gp)+' for the frame)':lt>f[1]*.4?'the page was held up '+prMs(lt)+' outside the steps above (memory clean-up or the browser)':'most of it outside the app’s own steps (the graphics card catching up, or the browser)');
    out.push('· '+prMs(f[1])+' at '+((b-pr.t0)/1000).toFixed(1)+' s, '+when+': '+(why||'nothing of the app’s own was running'));}
  /* every step, added up */
  const tot=new Map();for(const s of S){const t=tot.get(s[0])||[0,0,0];t[0]++;t[1]+=s[2];if(s[2]>t[2])t[2]=s[2];tot.set(s[0],t);}
  out.push('','THE APP’S OWN STEPS (times each ran · usual · longest · total)');
  for(const [k,t] of [...tot].sort((x,y)=>y[1][1]-x[1][1]).slice(0,18))out.push('· '+k+': '+t[0]+' × · '+prMs(t[1]/t[0])+' · '+prMs(t[2])+' · '+(t[1]>=1000?(t[1]/1000).toFixed(2)+' s':prMs(t[1])));
  if(pr.long.length){const l=pr.long.map(x=>x[1]);out.push('','Long pauses of the page (over 50 ms): '+l.length+' · longest '+prMs(Math.max(...l)));}
  try{const G=gpuMemory();out.push('','Textures in use: '+fmtBytes(G.bytes)+' · spare '+fmtBytes(G.spare)+' · undo '+fmtBytes(hist.undo.reduce((s,r)=>s+recBytes(r),0)));
    /* (0.98.3) what the textures are made of, biggest first: where the graphics memory goes */
    const by=new Map();for(const t of gpuLiveTargets()){const k=t.w+'×'+t.h+' '+(t.mono?'one channel ':'')+(t.packed?'packed ':'')+t.depth+'-bit'+(t.pool&&t.pool.free.includes(t)?' (spare)':'');const o=by.get(k)||[0,0];o[0]++;o[1]+=gpuBytes(t);by.set(k,o);}
    for(const [k,o] of [...by].sort((x,y)=>y[1][1]-x[1][1]).slice(0,6))out.push('  · '+o[0]+' × '+k+' = '+fmtBytes(o[1]));}catch(e){}
  return out.join('\n');}
function prShow(){const ta=el('textarea',{id:'prText',class:'prtext',readonly:true,rows:22,'aria-label':'Painting report'});ta.value=pr.text||'';
  const copy=el('button',{class:'btn',type:'button',id:'prCopy',text:'Copy the report',onclick:async()=>{let ok=false;try{await navigator.clipboard.writeText(ta.value);ok=true;}catch(e){try{ta.select();ok=document.execCommand('copy');}catch(e2){}}toast(ok?'Report copied. Paste it into the chat.':'Could not copy: select the text and press Ctrl+C.');}});
  openDialog({title:'Painting report',body:el('div',{class:'dlg-grid'},el('p',{class:'note',text:'This says how evenly the screen refreshed while you painted, and what the app was doing at each stutter. It holds no pictures and no file names. Copy it and paste it into the chat.'}),ta,el('div',{class:'chips'},copy,
    el('button',{class:'btn',type:'button',id:'prAgain',text:'Record again',onclick:()=>{const c=$('#dlgCancel');if(c)c.click();setTimeout(prStart,150);}}))),okLabel:'Close',onOk(){},resizable:true});}
function dlgPaintReport(){if(pr.on){prStop();prShow();return;}
  openDialog({title:'Painting report',body:el('div',{class:'dlg-grid'},
    el('p',{text:'This measures how smoothly painting runs on this computer, and finds what causes a stutter.'}),
    el('p',{class:'note',text:'1. Open the work where it stutters (the big document, the layers, the brush). 2. Press Start. 3. Paint as you normally do for about half a minute, until it has stuttered a few times. 4. Press Stop on the note at the bottom of the window. 5. Copy the report and paste it into the chat.'}),
    el('p',{class:'note',text:'Recording costs almost nothing, and nothing is measured when it is not running.'})),okLabel:'Start',onOk(){setTimeout(prStart,100);}});}
actions.paintReport=dlgPaintReport;
{const i=MENUS.Help.findIndex(m=>Array.isArray(m)&&m[1]==='helpIssue');MENUS.Help.splice(i<0?MENUS.Help.length:i,0,['Painting report…','paintReport']);}
