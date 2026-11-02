/* ================= Timelapse recorder (0.90) =================
   Record: while it runs, a small picture of the WHOLE canvas is taken every so often, but only when something has changed since the last one.
   How often is set by a number and a unit (per second, minute or hour). The pictures are kept in the app's own storage (IndexedDB), so a crash loses
   nothing: after a crash the recording is offered again, and it resumes when the document is recovered. Stop & Save makes the video with the app's own
   encoder (no extra download), keeps it in the list for replay, and on the desktop also writes it into the "completed TL's" folder.
   A size limit (Preferences › Files) makes the oldest pictures give way, so a recording never fills the disk. */
const TL_DEF={unit:'m',freq:6,comp:35,size:1280,vfps:30,fmt:'webm-vp9'};
const TL_UNITS=[['s','per second',1000],['m','per minute',60000],['h','per hour',3600000]];
const tlr={on:false,paused:false,sid:null,name:'',docName:'',count:0,first:0,bytes:0,timer:0,busy:false,cfg:Object.assign({},TL_DEF),sess:null,full:false,replay:null,ui:{}};
try{Object.assign(tlr.cfg,JSON.parse(localStorage.getItem('gs.tlr')||'{}'));}catch(e){}
const tlSaveCfg=()=>{try{localStorage.setItem('gs.tlr',JSON.stringify(tlr.cfg));}catch(e){}};
const tlInterval=()=>{const u=TL_UNITS.find(x=>x[0]===tlr.cfg.unit)||TL_UNITS[1];return Math.max(16,u[2]/Math.max(1,tlr.cfg.freq));};
const tlLimitBytes=()=>Math.max(50,+prefs.tlMaxMB||2000)*1048576;
/* ---- storage ---- */
let tlDbP=null;const tlRq=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
function tlDB(){return tlDbP||(tlDbP=new Promise((res,rej)=>{const r=indexedDB.open('gouache-timelapse',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('sessions',{keyPath:'id'});d.createObjectStore('frames',{keyPath:['sid','i']});d.createObjectStore('videos',{keyPath:'id'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));}
const tlStore=async(n,mode='readonly')=>(await tlDB()).transaction(n,mode).objectStore(n);
const tlPut=async(n,v)=>tlRq((await tlStore(n,'readwrite')).put(v));
const tlGet=async(n,k)=>tlRq((await tlStore(n)).get(k));
const tlAll=async n=>tlRq((await tlStore(n)).getAll());
const tlDel=async(n,k)=>tlRq((await tlStore(n,'readwrite')).delete(k));
const tlDelFrames=async(sid,a,b)=>tlRq((await tlStore('frames','readwrite')).delete(IDBKeyRange.bound([sid,a],[sid,b])));
async function tlSessions(){try{return (await tlAll('sessions')).sort((a,b)=>b.created-a.created);}catch(e){return [];}}
async function tlVideos(){try{return (await tlAll('videos')).sort((a,b)=>b.created-a.created);}catch(e){return [];}}
/* ---- taking a picture of the whole canvas ---- */
async function tlSnapshot(){const W=doc.w,H=doc.h,sc=Math.min(1,tlr.cfg.size/Math.max(W,H)),w=Math.max(2,Math.round(W*sc)&~1),h=Math.max(2,Math.round(H*sc)&~1);
  const full=compositeMap('base');let small=null;
  try{small=makeTarget(w,h,8,false);const sci=gl.isEnabled(gl.SCISSOR_TEST);if(sci)gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,full.fbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,small.fbo);
    gl.blitFramebuffer(0,0,W,H,0,0,w,h,gl.COLOR_BUFFER_BIT,full.depth===32?gl.NEAREST:gl.LINEAR);gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(sci)gl.enable(gl.SCISSOR_TEST);
    const d=captureRegionNow(small,0,0,w,h).data,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h);
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){const a=((h-1-j)*w+i)*4,b=(j*w+i)*4,al=255-d[a+3];im.data[b]=Math.min(255,d[a]+al);im.data[b+1]=Math.min(255,d[a+1]+al);im.data[b+2]=Math.min(255,d[a+2]+al);im.data[b+3]=255;}
    x.putImageData(im,0,0);const q=clamp(1-tlr.cfg.comp/100,.05,1);
    let blob=await new Promise(r=>c.toBlob(r,'image/webp',q));if(!blob||blob.type!=='image/webp')blob=await new Promise(r=>c.toBlob(r,'image/jpeg',q));
    return {blob,w,h};}
  finally{release(full);if(small)disposeTarget(small);}}
async function tlSaveSess(){if(!tlr.sess)return;Object.assign(tlr.sess,{count:tlr.count,first:tlr.first,bytes:tlr.bytes,cfg:Object.assign({},tlr.cfg),state:tlr.on?'progress':tlr.sess.state});try{await tlPut('sessions',tlr.sess);}catch(e){}}
async function tlCapture(){if(tlr.busy||!tlr.on||tlr.paused)return;tlr.busy=true;tlTouch=false;
  try{const s=await tlSnapshot();if(!s.blob)return;const i=tlr.count;await tlPut('frames',{sid:tlr.sid,i,blob:s.blob,w:s.w,h:s.h});tlr.count++;tlr.bytes+=s.blob.size;
    /* the size limit: the oldest pictures give way */
    const lim=tlLimitBytes();let guard=0;while(tlr.bytes>lim&&tlr.first<tlr.count-2&&guard++<50){const f=await tlGet('frames',[tlr.sid,tlr.first]);if(f){tlr.bytes-=f.blob.size;}await tlDelFrames(tlr.sid,tlr.first,tlr.first);tlr.first++;if(!tlr.full){tlr.full=true;toast('The timelapse folder is full ('+Math.round(lim/1048576)+' MB), so the oldest pictures are being replaced. You can raise the limit in Preferences › Files.');}}
    if(tlr.count%8===1)await tlSaveSess();tlUI();}
  catch(e){console.error('timelapse',e);}finally{tlr.busy=false;}}
function tlLoop(){clearTimeout(tlr.timer);if(!tlr.on)return;tlr.timer=setTimeout(async()=>{if(tlr.on&&!tlr.paused&&tlTouch&&ui.mode==='paint')await tlCapture();tlLoop();},tlInterval());}
/* ---- record / pause / stop ---- */
async function tlStart(resume){if(tlr.on)return;if(ui.mode!=='paint'){toast('The timelapse records the Paint canvas. Switch to Paint first.');return;}
  if(resume){tlr.sess=resume;tlr.sid=resume.id;tlr.name=resume.name;tlr.count=resume.count||0;tlr.first=resume.first||0;tlr.bytes=resume.bytes||0;tlr.docName=doc.name||resume.docName||'';Object.assign(tlr.cfg,resume.cfg||{});}
  else{const n=(await tlSessions()).length+(await tlVideos()).length+1;tlr.sid='tlr'+Date.now();tlr.name='Timelapse '+n+' · '+(doc.name||'Untitled');tlr.docName=doc.name||'';tlr.count=0;tlr.first=0;tlr.bytes=0;tlr.sess={id:tlr.sid,name:tlr.name,docName:tlr.docName,created:Date.now(),state:'progress',count:0,first:0,bytes:0};}
  tlr.full=false;tlr.on=true;tlr.paused=false;await tlSaveSess();tlTouch=true;await tlCapture();tlLoop();tlUI();toast(resume?'Timelapse resumed.':'Recording the timelapse.');}
function tlPause(){if(!tlr.on)return;tlr.paused=!tlr.paused;if(!tlr.paused){tlTouch=true;tlCapture();}tlSaveSess();tlUI();toast(tlr.paused?'Timelapse paused.':'Timelapse recording.');}
async function tlStop(){if(!tlr.on&&!tlr.paused)return;const sess=tlr.sess,sid=tlr.sid;await tlSaveSess();tlr.on=false;tlr.paused=false;clearTimeout(tlr.timer);tlUI();
  if(tlr.count-tlr.first<2){toast('Not enough pictures yet for a timelapse (it needs at least two changes to the canvas).');sess.state='progress';await tlPut('sessions',sess);return;}
  await tlFinish(sess);}
/* ---- making the video ---- */
async function tlEncode(sess,progress){const fmt=tlr.cfg.fmt,F=VID_FORMATS.find(f=>f[0]===fmt)||VID_FORMATS[0],fps=clamp(tlr.cfg.vfps,1,60);
  const first=await tlGet('frames',[sess.id,sess.first]);if(!first)throw new Error('The pictures of this timelapse are missing.');
  const sc=1;const W=Math.max(2,first.w&~1),H=Math.max(2,first.h&~1),bitrate=Math.round(W*H*fps*.12);
  const codec=await vidSupport(F[0],W,H,fps,bitrate);if(!codec)throw new Error('This computer cannot make '+F[1]+' video at '+W+' × '+H+'. Try a smaller size or another format.');
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d'),chunks=[];let desc=null,err=null;
  const enc=new VideoEncoder({output:(c,meta)=>{const d=new Uint8Array(c.byteLength);c.copyTo(d);if(meta&&meta.decoderConfig&&meta.decoderConfig.description&&!desc)desc=meta.decoderConfig.description;chunks.push({data:d,key:c.type==='key',ts:c.timestamp,dur:(c.duration||0)/1000});},error:e=>{err=e;}});
  enc.configure(Object.assign({codec,width:W,height:H,bitrate,framerate:fps,latencyMode:'quality'},codec.startsWith('avc1')?{avc:{format:'avc'}}:codec.startsWith('hvc1')?{hevc:{format:'hevc'}}:{}));
  const n=sess.count-sess.first,ms=1000/fps,gop=Math.max(1,Math.round(fps*2));let k=0;
  for(let i=sess.first;i<sess.count;i++){if(err)throw err;const f=await tlGet('frames',[sess.id,i]);if(!f)continue;const bmp=await createImageBitmap(f.blob);
    x.fillStyle='#fff';x.fillRect(0,0,W,H);const s=Math.min(W/bmp.width,H/bmp.height),dw=bmp.width*s,dh=bmp.height*s;x.imageSmoothingQuality='high';x.drawImage(bmp,(W-dw)/2,(H-dh)/2,dw,dh);bmp.close&&bmp.close();
    const vf=new VideoFrame(cv,{timestamp:Math.round(k*ms*1000),duration:Math.round(ms*1000)});enc.encode(vf,{keyFrame:k%gop===0});vf.close();k++;
    while(enc.encodeQueueSize>6)await new Promise(r=>setTimeout(r,4));if(progress&&k%6===0){progress(k/n);await new Promise(r=>setTimeout(r,0));}}
  await enc.flush();enc.close();if(err)throw err;if(!chunks.length)throw new Error('The encoder made no frames.');
  chunks.sort((a,b)=>a.ts-b.ts);const samples=chunks.map(c=>({data:c.data,key:c.key,dur:c.dur||ms}));
  return {blob:F[2]==='webm'?webmWrite(samples,W,H,codec,desc):mp4Write(samples,W,H,codec,desc,F[2]==='mov'),ext:F[3],w:W,h:H,frames:k,codec,fps};}
async function tlFinish(sess){loadStart('Making the timelapse video');
  try{const r=await tlEncode(sess,f=>loadSet(f*.9,'Encoding picture '+Math.round(f*100)+'%…'));loadSet(.95,'Saving…');
    const vid={id:'v'+Date.now(),name:sess.name,created:Date.now(),ext:r.ext,blob:r.blob,frames:r.frames,w:r.w,h:r.h,fps:r.fps,docName:sess.docName};await tlPut('videos',vid);
    await tlDelFrames(sess.id,0,1e9);await tlDel('sessions',sess.id);if(tlr.sid===sess.id){tlr.sess=null;tlr.sid=null;tlr.count=0;}
    let where='';if(platform.isDesktop){try{const base=(await platform.cacheInfo()).dir.replace(/[\\/]+$/,'')+'/Timelapse/completed TL\'s';await platform.invoke('make_dir',{path:base});const file=base+'/'+slug(sess.name)+'-'+vid.id+'.'+r.ext;await platform.writeFile(file,r.blob);vid.path=file;await tlPut('videos',vid);where=' It is in the “completed TL’s” folder.';}catch(e){console.warn('timelapse folder',e);}}
    const d=await deliver(slug(sess.name)+'.'+r.ext,r.blob);toast(deliveredText(d,'Timelapse')+' ('+r.w+' × '+r.h+', '+r.frames+' pictures, '+(r.frames/r.fps).toFixed(1)+' s).'+where);}
  catch(e){console.error(e);toast('The timelapse video could not be made: '+(e.message||e)+' Your pictures are kept; open the timelapse list to try again.');sess.state='progress';try{await tlPut('sessions',sess);}catch(e2){}}
  finally{loadEnd();tlUI();}}
/* ---- replay on the canvas ---- */
async function tlReplay(vid){if(!vid)return;tlReplayClose();const box=el('div',{id:'tlReplay',class:'tlreplay'}),v=el('video',{controls:false,autoplay:true,muted:true,playsinline:true}),url=URL.createObjectURL(vid.blob);v.src=url;
  const bar=el('div',{class:'tlrbar'},el('span',{text:vid.name}),el('button',{class:'btn sm',type:'button',text:'Close',onclick:()=>tlReplayClose()}));box.append(v,bar);$('#stage').append(box);tlr.replay={box,v,url};
  v.addEventListener('ended',()=>tlUI());v.addEventListener('pause',()=>tlUI());v.addEventListener('play',()=>tlUI());try{await v.play();}catch(e){}tlUI();}
function tlReplayClose(){if(!tlr.replay)return;try{tlr.replay.v.pause();}catch(e){}tlr.replay.box.remove();URL.revokeObjectURL(tlr.replay.url);tlr.replay=null;tlUI();}
/* ---- the bar and its settings window ---- */
async function tlUI(){const u=tlr.ui;if(!u.rec)return;const rec=tlr.on&&!tlr.paused;
  u.rec.classList.toggle('rec',rec);u.rec.classList.toggle('paused',tlr.on&&tlr.paused);
  u.rec.textContent=tlr.on&&!tlr.paused?'❚❚':'●';u.rec.title=tlr.on?(tlr.paused?'Resume recording':'Pause recording'):'Record a timelapse';u.rec.setAttribute('aria-label',u.rec.title);
  u.dot.classList.toggle('blink',rec);u.stop.disabled=!tlr.on;
  u.info.textContent=tlr.on?tlr.count-tlr.first+' pictures · '+Math.round(tlr.bytes/1048576*10)/10+' MB':'';
  const vids=await tlVideos(),cur=u.sel.value;u.sel.replaceChildren(...vids.map(v=>el('option',{value:v.id,text:v.name+' · '+v.frames})),...(vids.length?[]:[el('option',{value:'',text:'No timelapses yet'})]));if(vids.some(v=>v.id===cur))u.sel.value=cur;
  const playing=tlr.replay&&!tlr.replay.v.paused&&!tlr.replay.v.ended;u.play.textContent=playing?'❚❚':'▶';u.play.title=playing?'Pause the replay':'Replay the selected timelapse on the canvas';u.play.disabled=!vids.length;}
async function tlPop(){const old=$('#tlPop');if(old){old.remove();return;}
  const sess=(await tlSessions()).filter(s=>s.id!==tlr.sid),vids=await tlVideos(),pop=el('div',{id:'tlPop',class:'tlpop',role:'dialog','aria-label':'Timelapse settings'});
  const sel=(label,opts,get,set)=>{const s=el('select',{'aria-label':label},...opts.map(([v,t])=>el('option',{value:String(v),text:t})));s.value=String(get());s.onchange=()=>{set(s.value);tlSaveCfg();upd();};return el('div',{class:'frow'},el('label',{text:label}),s);};
  const info=el('p',{class:'note'}),upd=()=>{const ms=tlInterval();info.textContent='A picture of the whole canvas every '+(ms<1000?Math.round(ms)+' ms':ms<90000?(ms/1000).toFixed(ms<10000?1:0)+' seconds':ms<5400000?(ms/60000).toFixed(1)+' minutes':(ms/3600000).toFixed(1)+' hours')+', only when something changed. Each picture is one frame of the video.';};
  const freq=makeSlider({id:'tlFreq',label:'How many pictures',min:1,max:60,step:1,value:tlr.cfg.freq,fmt:v=>String(Math.round(v)),onInput:v=>{tlr.cfg.freq=Math.round(v);tlSaveCfg();upd();}});
  const comp=makeSlider({id:'tlComp',label:'Compression',min:0,max:90,step:1,value:tlr.cfg.comp,fmt:v=>Math.round(v)+'%',onInput:v=>{tlr.cfg.comp=Math.round(v);tlSaveCfg();}});
  pop.append(el('div',{class:'sub',text:'Timelapse'}),
    sel('Pictures taken',TL_UNITS.map(u=>[u[0],u[1]]),()=>tlr.cfg.unit,v=>{tlr.cfg.unit=v;}),freq.el,info,comp.el,
    el('p',{class:'note',text:'Compression makes each picture smaller (and the folder last longer) at the cost of a little sharpness.'}),
    sel('Picture size',[[720,'720 px (small)'],[1280,'1280 px'],[1920,'1920 px (full HD)'],[2560,'2560 px'],[8192,'Full size']],()=>tlr.cfg.size,v=>{tlr.cfg.size=+v;}),
    sel('Video speed',[[12,'12 pictures a second'],[24,'24 pictures a second'],[30,'30 pictures a second'],[60,'60 pictures a second']],()=>tlr.cfg.vfps,v=>{tlr.cfg.vfps=+v;}),
    sel('Video format',VID_FORMATS.filter(f=>!f[5]).map(f=>[f[0],f[1]]),()=>tlr.cfg.fmt,v=>{tlr.cfg.fmt=v;}));
  if(sess.length)pop.append(el('div',{class:'sub',text:'Unfinished recordings'}),...sess.map(s=>el('div',{class:'frow tlrow'},el('span',{text:s.name+' · '+(s.count-s.first)+' pictures'}),
    el('button',{class:'btn sm',type:'button',text:'Resume',onclick:()=>{pop.remove();tlStart(s);}}),el('button',{class:'btn sm',type:'button',text:'Make video',onclick:()=>{pop.remove();tlFinish(s);}}),
    el('button',{class:'btn sm',type:'button',text:'Delete',onclick:async()=>{await tlDelFrames(s.id,0,1e9);await tlDel('sessions',s.id);pop.remove();tlPop();}}))));
  if(vids.length)pop.append(el('div',{class:'sub',text:'Finished timelapses'}),...vids.map(v=>el('div',{class:'frow tlrow'},el('span',{text:v.name+' · '+v.frames+' pictures · '+Math.round(v.blob.size/1048576*10)/10+' MB'}),
    el('button',{class:'btn sm',type:'button',text:'Save a copy',onclick:()=>deliver(slug(v.name)+'.'+v.ext,v.blob)}),
    el('button',{class:'btn sm',type:'button',text:'Delete',onclick:async()=>{await tlDel('videos',v.id);pop.remove();tlUI();tlPop();}}))));
  upd();document.body.append(pop);const r=tlr.ui.gear.getBoundingClientRect();pop.style.left=Math.max(8,Math.min(innerWidth-pop.offsetWidth-8,r.left))+'px';pop.style.top=(r.bottom+6)+'px';
  setTimeout(()=>{const off=e=>{if(!pop.contains(e.target)&&e.target!==tlr.ui.gear){pop.remove();window.removeEventListener('pointerdown',off,true);}};window.addEventListener('pointerdown',off,true);},0);}
async function tlFolder(){if(platform.isDesktop){try{const base=(await platform.cacheInfo()).dir.replace(/[\\/]+$/,'')+'/Timelapse/completed TL\'s';await platform.invoke('make_dir',{path:base});await platform.invoke('reveal_path',{path:base});return;}catch(e){}}
  tlPop();toast(platform.isDesktop?'The folder could not be opened. Your finished timelapses are listed here.':'In the browser, finished timelapses are kept in the list below; use Save a copy to put one in a folder.');}
function tlBuild(){const menus=$('#menus');if(!menus||tlr.ui.rec)return;
  const btn=(txt,title,cls,fn)=>el('button',{type:'button',class:'tlbtn '+(cls||''),title,'aria-label':title,text:txt,onclick:fn});
  const dot=el('span',{class:'tldot','aria-hidden':'true'}),rec=btn('●','Record a timelapse','tlrec',()=>{if(tlr.on)tlPause();else tlStart();}),
    play=btn('▶','Replay the selected timelapse on the canvas','tlplay',async()=>{if(tlr.replay&&!tlr.replay.v.ended){tlr.replay.v.paused?tlr.replay.v.play():tlr.replay.v.pause();return;}const v=await tlGet('videos',sel.value);if(v)tlReplay(v);}),
    sel=el('select',{class:'tlsel','aria-label':'Timelapse to replay',title:'Your finished timelapses'}),
    stop=btn('■','Stop and save the timelapse as a video','tlstop',()=>tlStop()),folder=btn('📁','Show where the finished timelapses are kept','tlfolder',()=>tlFolder()),
    gear=btn('⚙','Timelapse settings: how often, compression, size','tlgear',()=>tlPop()),info=el('span',{class:'tlinfo'});
  const bar=el('div',{id:'tlBar',class:'tlbar',role:'group','aria-label':'Timelapse recorder'},dot,rec,play,stop,folder,gear,sel,info);menus.after(bar);
  Object.assign(tlr.ui,{rec,play,sel,stop,gear,dot,info});tlUI();}
/* after a crash: the recovered document gets its recording back */
async function tlAfterRecover(){const s=(await tlSessions()).filter(x=>x.state==='progress'&&!tlr.on);if(s.length&&ui.mode==='paint'){toast('Resuming your unfinished timelapse “'+s[0].name+'”.');tlStart(s[0]);}}
async function tlOffer(){const s=(await tlSessions()).filter(x=>x.state==='progress');if(s.length&&!tlr.on)toast('There is an unfinished timelapse ('+s.length+'). Open the ⚙ next to the record button to resume it or make its video.');}
window.addEventListener('beforeunload',()=>{if(tlr.on)tlSaveSess();});
if(typeof document!=='undefined'){const go=()=>{try{tlBuild();setTimeout(tlOffer,4000);}catch(e){console.warn('timelapse bar',e);}};if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',go);else setTimeout(go,0);}
