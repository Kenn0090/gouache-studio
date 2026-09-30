/* ================= Screenshots, renders and turntables of the 3D view (0.26) =================
   - Screenshot (camera button): the 3D view as a PNG, at the view's size or bigger, optionally with a
     transparent background. In Ray traced mode it saves the ray-traced picture as it is.
   - Render…: a ray-traced picture in a window of its own: size, samples, bounces, background (HDRI, colour
     or transparent). It cleans up as it goes; save it at any time.
   - Turntable…: the model turns in front of the camera and is recorded: how many spins, seconds per spin,
     frames per second, size, format (WebM or MP4 video, GIF, PNG sequence), whether the light turns with the
     model, and a transparent background (PNG sequence). */
/* the view drawn off-screen at w×h (the normal, fast shading) → RGBA rows, bottom first */
function v3Offscreen(w,h,o){o=o||{};const S=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)||0),F={w,h};
  F.ms=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,F.ms);F.c=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,F.c);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,S,gl.RGBA8,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,F.c);
  F.d=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,F.d);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,S,gl.DEPTH_COMPONENT24,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,F.d);
  F.rf=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,F.rf);F.rc=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,F.rc);gl.renderbufferStorage(gl.RENDERBUFFER,gl.RGBA8,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,F.rc);
  const was=v3.transparent;v3.transparent=!!o.transparent;let out;
  try{v3Render(F,false);gl.bindFramebuffer(gl.FRAMEBUFFER,F.rf);out=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,out);}
  finally{v3.transparent=was;gl.bindFramebuffer(gl.FRAMEBUFFER,null);v3PostFree(F);gl.deleteFramebuffer(F.ms);gl.deleteFramebuffer(F.rf);for(const r of [F.c,F.d,F.rc])gl.deleteRenderbuffer(r);v3.dirty=true;requestRender();}
  return out;}
const v3ViewSize=()=>{const pane=v3.pop?null:$('#pane3d'),d=dprNow();return pane?[Math.max(16,Math.round(pane.clientWidth*d)),Math.max(16,Math.round(pane.clientHeight*d))]:[1280,720];};
const V3_SIZES=[['view','View'],['x2','View ×2'],['1080','1920 × 1080'],['sq2k','2048 × 2048'],['4k','3840 × 2160']];
function v3SizeOf(k){const [w,h]=v3ViewSize(),mx=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)||4096,f=(W,H)=>{const s=Math.min(1,mx/Math.max(W,H));return [Math.round(W*s),Math.round(H*s)];};
  return k==='x2'?f(w*2,h*2):k==='1080'?f(1920,1080):k==='sq2k'?f(2048,2048):k==='4k'?f(3840,2160):[w,h];}
const v3FileBase=()=>slug((ui.mode==='p3d'&&typeof p3!=='undefined'&&p3.name)||doc.name||'Render');
/* ---- screenshot ---- */
function dlgScreenshot(){if(!v3.on||!v3.mesh){toast('Open the 3D view first.');return;}let size='view',tr=false;
  const body=el('div',{class:'dlg-grid',id:'shotDlg'},el('div',{class:'sub',text:'Size'}),(()=>{const g=seg(V3_SIZES,size,v=>{size=v;},'Size');g.classList.add('themeseg');return g;})(),
    chk('shotTr','Transparent background',tr,v=>{tr=v;}),el('p',{class:'note',text:v3.rt?'Ray traced mode: the ray-traced picture is saved as it is now, at the view’s size.':'Saved as PNG.'}));
  openDialog({title:'Screenshot',body,okLabel:'Save',onOk(){setTimeout(()=>v3Screenshot(size,tr),0);}});}
async function v3Screenshot(size,tr){let w,h,d,premul=!!tr;
  if(v3.rt&&rt.view&&rt.view.n){const S=rt.view;w=S.w;h=S.h;d=rtPixels(S,!tr);}
  else{[w,h]=v3SizeOf(size||'view');d=v3Offscreen(w,h,{transparent:tr});}
  const blob=await pixelsToPNG(w,h,d,premul),r=await deliver(v3FileBase()+'_3d.png',blob);toast(deliveredText(r,'Screenshot'));return {w,h};}
/* ---- the Render window (ray traced) ---- */
const rtWin={S:null,run:false,raf:0,o:null};
function dlgRender(){if(!v3.on||!v3.mesh){toast('Open the 3D view first.');return;}if(v3.mesh.noUV){toast('This model has no UVs, so its textures cannot show.');return;}
  const o=rtWin.o||(rtWin.o={size:'view',spp:256,bounces:4,bg:'hdri'});const prev=el('canvas',{class:'rtprev',id:'rtPrev'}),bar=el('div',{class:'bakebar'},el('div')),msg=el('p',{class:'note',id:'rtMsg',text:'Set it up, then press Render.'});
  const go=el('button',{class:'btn',id:'rtGo',text:'Render',onclick:()=>rtWinStart(prev,bar,msg,go)}),save=el('button',{class:'btn',id:'rtSave',text:'Save PNG…',onclick:rtWinSave});
  const sz=seg(V3_SIZES,o.size,v=>{o.size=v;},'Size');sz.classList.add('themeseg');
  const body=el('div',{class:'dlg-grid',id:'rtDlg'},el('div',{class:'sub',text:'Size'}),sz,
    el('div',{class:'sub',text:'Quality'}),seg([[64,'Draft (64)'],[256,'Good (256)'],[1024,'Best (1024)']],o.spp,v=>{o.spp=+v;},'Samples'),
    makeSlider({id:'rtBounces',label:'Light bounces',min:1,max:8,step:1,value:o.bounces,fmt:v=>String(v),onInput:v=>{o.bounces=v;}}).el,
    el('div',{class:'sub',text:'Background'}),seg([['hdri','HDRI'],['colour','Colour'],['clear','Transparent']],o.bg,v=>{o.bg=v;},'Background'),
    prev,bar,msg,el('div',{class:'chips'},go,save),
    el('p',{class:'note',text:'Lit by the HDRI (and the extra sun) from the 3D view’s Settings, with real shadows and bounced light. It gets cleaner the longer it runs; the camera is the 3D view’s when you press Render.'}));
  openDialog({title:'Render (ray traced)',body,okLabel:null,cancelLabel:'Close',wide:true,onCancel(){rtWinStop();}});}
async function rtWinStart(prev,bar,msg,go){rtWinStop();const o=rtWin.o,[w,h]=v3SizeOf(o.size);msg.textContent='Preparing…';const g=await rtScene();if(!g){msg.textContent='Ray tracing could not start.';return;}
  const E=envUniforms();if(envOf(v3s())!=='none'&&!E.uEnvOn){msg.textContent='Loading the HDRI…';await new Promise(r=>setTimeout(r,400));}rtMaterials(g);
  rtFree(rtWin.S);const S=rtWin.S=rtSession(w,h);S.cam=Object.assign({},v3.cam);clearTarget(S.a);clearTarget(S.b);rtWin.run=true;go.textContent='Stop';go.onclick=()=>{rtWinStop();go.textContent='Render';go.onclick=()=>rtWinStart(prev,bar,msg,go);};
  prev.width=w;prev.height=h;const bgCol=(BG3[v3s().bg]||BG3.dark).map(v=>Math.pow(v,2.2)),bgk={hdri:0,colour:1,clear:2}[o.bg];let last=0;
  const tickR=()=>{if(!rtWin.run||!prev.isConnected){rtWin.run=false;return;}const t0=performance.now();
    while(S.n<o.spp&&performance.now()-t0<30){rtStepCam(S,g,{bg:bgk,bgCol,bounces:o.bounces,cam:S.cam});}
    bar.firstChild.style.width=(S.n/o.spp*100).toFixed(1)+'%';msg.textContent=S.n+' / '+o.spp+' samples · '+w+' × '+h;
    if(S.n>=o.spp||performance.now()-last>900){last=performance.now();rtWinPreview(prev);}
    if(S.n>=o.spp){rtWin.run=false;msg.textContent='Done: '+S.n+' samples · '+w+' × '+h+'. Save it with Save PNG.';go.textContent='Render';go.onclick=()=>rtWinStart(prev,bar,msg,go);return;}
    rtWin.raf=requestAnimationFrame(tickR);};
  rtWin.raf=requestAnimationFrame(tickR);}
function rtStepCam(S,g,o){const keep=Object.assign({},v3.cam);Object.assign(v3.cam,o.cam);try{rtStep(S,g,o);}finally{Object.assign(v3.cam,keep);}}
function rtWinPreview(c){const S=rtWin.S;if(!S||!S.n)return;const d=rtPixels(S,rtWin.o.bg!=='clear'),x=c.getContext('2d'),im=x.createImageData(S.w,S.h);
  for(let y=0;y<S.h;y++)im.data.set(d.subarray((S.h-1-y)*S.w*4,(S.h-y)*S.w*4),y*S.w*4);x.putImageData(im,0,0);}
function rtWinStop(){rtWin.run=false;cancelAnimationFrame(rtWin.raf);}
async function rtWinSave(){const S=rtWin.S;if(!S||!S.n){toast('Render first.');return;}const tr=rtWin.o.bg==='clear',d=rtPixels(S,!tr);const r=await deliver(v3FileBase()+'_render.png',await pixelsToPNG(S.w,S.h,d,tr));toast(deliveredText(r,'Render'));}
/* ---- turntable ---- */
const TT_FORMATS=()=>[['webm','WebM video'],...(typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported('video/mp4')?[['mp4','MP4 video']]:[]),['gif','GIF'],['png','PNG sequence']];
function dlgTurntable(){if(!v3.on||!v3.mesh){toast('Open the 3D view first.');return;}
  const o=v3.tto||(v3.tto={spins:1,secs:6,fps:30,size:'view',fmt:'webm',lightTurns:false,tr:false});
  const body=el('div',{class:'dlg-grid',id:'ttDlg'},
    makeSlider({id:'ttSpins',label:'Spins',min:1,max:5,step:1,value:o.spins,fmt:v=>String(v),onInput:v=>{o.spins=v;}}).el,
    makeSlider({id:'ttSecs',label:'Seconds per spin',min:1,max:30,step:1,value:o.secs,fmt:v=>v+' s',onInput:v=>{o.secs=v;}}).el,
    el('div',{class:'sub',text:'Frames per second'}),seg([[24,'24'],[30,'30'],[60,'60']],o.fps,v=>{o.fps=+v;},'Frames per second'),
    el('div',{class:'sub',text:'Size'}),(()=>{const g=seg(V3_SIZES.slice(0,3),o.size,v=>{o.size=v;},'Size');g.classList.add('themeseg');return g;})(),
    el('div',{class:'sub',text:'Format'}),(()=>{const g=seg(TT_FORMATS(),o.fmt,v=>{o.fmt=v;},'Format');g.classList.add('themeseg');return g;})(),
    chk('ttLight','The light turns with the model',o.lightTurns,v=>{o.lightTurns=v;}),chk('ttTr','Transparent background (PNG sequence)',o.tr,v=>{o.tr=v;}),
    el('p',{class:'note',text:'Off: the model turns under still lights, so its reflections move across it. On: the lighting stays the same on the model. GIFs are kept to 640 px wide.'}));
  openDialog({title:'Turntable',body,okLabel:'Record',onOk(){setTimeout(()=>ttRecord(o),0);}});}
async function ttRecord(o){const s=v3s(),n=Math.max(2,Math.round(o.spins*o.secs*o.fps));let [w,h]=v3SizeOf(o.size);if(o.fmt==='gif'&&w>640){h=Math.round(h*640/w);w=640;}
  if(o.fmt!=='png'){w&=~1;h&=~1;}const cam0=Object.assign({},v3.cam),rot0=s.envRot||0,az0=s.sunAz,tr=o.fmt==='png'&&o.tr;
  const frame=i=>{v3.postSeed=7.13+i*3.17;const a=2*Math.PI*o.spins*i/n;v3.cam.yaw=cam0.yaw+a;/* light fixed to the viewer unless it turns with the model */if(!o.lightTurns){s.envRot=(rot0+a*180/Math.PI)%360;s.sunAz=(az0+a*180/Math.PI)%360;}
    const d=v3Offscreen(w,h,{transparent:tr});const top=new Uint8Array(w*h*4);for(let y=0;y<h;y++)top.set(d.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);return top;};
  const restore=()=>{Object.assign(v3.cam,cam0);s.envRot=rot0;s.sunAz=az0;v3.postSeed=0;v3.dirty=true;requestRender();};
  loadStart('Turntable');let cancelled=false;
  try{if(o.fmt==='webm'||o.fmt==='mp4'){const c=el('canvas',{width:w,height:h}),x=c.getContext('2d'),st=c.captureStream(0),track=st.getVideoTracks()[0];
      const mime=o.fmt==='mp4'?'video/mp4':['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'video/webm',rec=new MediaRecorder(st,{mimeType:mime,videoBitsPerSecond:Math.min(40e6,w*h*o.fps*.12)}),chunks=[];
      rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};const done=new Promise(r=>{rec.onstop=r;});rec.start();const dt=1000/o.fps;let t0=performance.now();
      for(let i=0;i<n;i++){const im=new ImageData(new Uint8ClampedArray(frame(i).buffer),w,h);x.putImageData(im,0,0);track.requestFrame&&track.requestFrame();loadSet(i/n,'Recording frame '+(i+1)+' of '+n+'…');
        const wait=t0+dt*(i+1)-performance.now();await new Promise(r=>setTimeout(r,Math.max(0,wait)));}
      rec.stop();await done;restore();const r=await deliver(v3FileBase()+'_turntable.'+(o.fmt==='mp4'?'mp4':'webm'),new Blob(chunks,{type:mime.split(';')[0]}));toast(deliveredText(r,'Turntable'));}
    else if(o.fmt==='gif'){const frames=[];for(let i=0;i<n;i++){frames.push(frame(i));loadSet(i/n*.7,'Frame '+(i+1)+' of '+n+'…');if(i%4===0)await loadPaint();}
      restore();loadSet(.75,'Making the GIF…');await loadPaint();const r=await deliver(v3FileBase()+'_turntable.gif',new Blob([gifEncode(w,h,frames,Math.round(100/o.fps))],{type:'image/gif'}));toast(deliveredText(r,'Turntable'));}
    else{let dir=null;if(platform.isDesktop){dir=await platform.pickFolder();if(!dir){restore();cancelled=true;return;}}const files=[],base=v3FileBase();
      for(let i=0;i<n;i++){const d=frame(i),flip=new Uint8Array(w*h*4);for(let y=0;y<h;y++)flip.set(d.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);
        const png=new Uint8Array(await (await pixelsToPNG(w,h,flip,tr)).arrayBuffer()),name=base+'_'+String(i).padStart(4,'0')+'.png';loadSet(i/n,'Frame '+(i+1)+' of '+n+'…');
        if(dir){const sep=dir.includes('\\')?'\\':'/';await platform.writeFile(dir.replace(/[\\/]$/,'')+sep+name,png);}else files.push({name,data:png});}
      restore();if(dir)toast('Saved '+n+' frames to '+dir);else{const r=await deliver(base+'_turntable.zip',await makeZipMulti(files));toast(deliveredText(r,'Turntable frames'));}}}
  catch(e){console.error(e);restore();toast('The turntable could not be recorded: '+(e.message||e));}
  finally{loadEnd();}}
/* ---- a small GIF encoder: one palette (median cut over sampled frames), LZW, looping ---- */
function gifPalette(frames){const px=[];for(const f of frames.filter((_,i)=>i%Math.max(1,Math.floor(frames.length/8))===0))for(let i=0;i<f.length;i+=4*37)px.push([f[i],f[i+1],f[i+2]]);
  let boxes=[px];while(boxes.length<256){boxes.sort((a,b)=>b.length-a.length);const b=boxes.shift();if(b.length<2){boxes.push(b);break;}
    const r=[0,1,2].map(c=>{let lo=255,hi=0;for(const p of b){lo=Math.min(lo,p[c]);hi=Math.max(hi,p[c]);}return hi-lo;}),c=r.indexOf(Math.max(...r));b.sort((x,y)=>x[c]-y[c]);const m=b.length>>1;boxes.push(b.slice(0,m),b.slice(m));}
  const pal=boxes.map(b=>{const s=[0,0,0];for(const p of b){s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];}return s.map(v=>Math.round(v/Math.max(1,b.length)));});while(pal.length<256)pal.push([0,0,0]);return pal;}
function gifEncode(w,h,frames,delay){const pal=gifPalette(frames),out=[],b=v=>out.push(v&255),w16=v=>{b(v);b(v>>8);},cache=new Int16Array(32768).fill(-1);
  const near=(r,g,bl)=>{const k=((r>>3)<<10)|((g>>3)<<5)|(bl>>3);let c=cache[k];if(c>=0)return c;let best=0,bd=1e9;for(let i=0;i<256;i++){const p=pal[i],d=(p[0]-r)**2+(p[1]-g)**2+(p[2]-bl)**2;if(d<bd){bd=d;best=i;}}cache[k]=best;return best;};
  for(const ch of 'GIF89a')b(ch.charCodeAt(0));w16(w);w16(h);b(0xF7);b(0);b(0);for(const p of pal){b(p[0]);b(p[1]);b(p[2]);}
  b(0x21);b(0xFF);b(11);for(const ch of 'NETSCAPE2.0')b(ch.charCodeAt(0));b(3);b(1);w16(0);b(0);
  for(const f of frames){b(0x21);b(0xF9);b(4);b(0);w16(delay);b(0);b(0);b(0x2C);w16(0);w16(0);w16(w);w16(h);b(0);
    const idx=new Uint8Array(w*h);for(let i=0;i<w*h;i++)idx[i]=near(f[i*4],f[i*4+1],f[i*4+2]);
    /* LZW, 8-bit codes */b(8);const bytes=[];let cur=0,nb=0;const put=(code,size)=>{cur|=code<<nb;nb+=size;while(nb>=8){bytes.push(cur&255);cur>>=8;nb-=8;}};
    const CLR=256,EOI=257;let dict=new Map(),next=258,size=9;put(CLR,size);let pre=idx[0];
    for(let i=1;i<idx.length;i++){const k=idx[i],key=pre*256+k,v=dict.get(key);if(v!==undefined){pre=v;continue;}put(pre,size);
      if(next<4096){dict.set(key,next++);if(next>(1<<size)&&size<12)size++;}else{put(CLR,size);dict=new Map();next=258;size=9;}pre=k;}
    put(pre,size);put(EOI,size);if(nb>0)bytes.push(cur&255);for(let i=0;i<bytes.length;i+=255){const n=Math.min(255,bytes.length-i);b(n);for(let j=0;j<n;j++)b(bytes[i+j]);}b(0);}
  b(0x3B);return new Uint8Array(out);}
