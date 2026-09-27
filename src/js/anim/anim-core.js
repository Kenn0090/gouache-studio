/* ================= Animation mode: core =================
   doc.anim holds the frames (each a single image, stored as a layer object with .frame = true),
   timing (fps, a hold per frame), tags and onion-skin settings. In Animation mode the document's
   root is swapped for animRoot, whose only child is the current frame, so every tool paints on it
   unchanged. Paint mode's layers are kept in doc.paintRoot until you switch back. */
const animRoot={type:'group',children:[],isRoot:true,visible:true,opacity:1,mode:-1,anim:true,name:'Frames'};
ui.mode='paint';ui.animBg='checker';
const TAG_COLORS=['#e2a453','#6fb3d9','#8fca6e','#d97ea1','#b491e0','#e0cf6b','#6fd0b8'];
function newFrame(){const L=newLayerObj('Frame');L.frame=true;L.hold=1;return L;}
function makeAnim(frames){return {frames:frames||[newFrame()],cur:0,fps:12,tags:[],onion:{on:true,before:1,after:1,fade:.5,tint:true}};}
const paintRoot=()=>doc.paintRoot||doc.root;
function everyLayer(){return [...allLayers(paintRoot()),...(doc.anim?doc.anim.frames:[])];}
function everyNode(){return [...allNodes(paintRoot()),...(doc.anim?doc.anim.frames:[])];}
const A_=()=>doc.anim;

/* ---- switching modes ---- */
function setMode(m,quiet){if(m===ui.mode)return true;
  if(preview||selLive){toast('Apply or cancel the open dialog first.');return false;}
  if(stroke)return false;
  if(typeof xf!=='undefined'&&xf)xfCommit();if(typeof gsess!=='undefined'&&gsess)gradCommit();if(typeof tedit!=='undefined'&&tedit)closeTextEditor();textCommit();cancelSelTool();stopPlay();
  if(m==='anim'){if(!doc.anim)doc.anim=makeAnim();doc.paintRoot=doc.root;doc.paintSel={active:doc.active,sel:[...doc.sel]};doc.root=animRoot;ui.mode='anim';showFrame(doc.anim.cur,true);}
  else{doc.root=doc.paintRoot;doc.paintRoot=null;const s=doc.paintSel||{active:null,sel:[]};doc.active=s.active;doc.sel=new Set(s.sel);ui.mode='paint';}
  document.body.classList.toggle('animmode',ui.mode==='anim');$('#modeSel').value=ui.mode;
  if(ui.tool==='text')setTool('brush');
  renderLayers();refreshChanUI();renderTimeline();renderAnimPanel();buildBrushPanel();changedAll();resizeGL();requestRender(true);
  if(!quiet)toast(ui.mode==='anim'?'Animation mode: paint each frame. , and . step through frames, Enter plays.':'Paint mode.');return true;}
function showFrame(i,noRender){const A=A_();if(!A)return;A.cur=clamp(i,0,A.frames.length-1);const F=A.frames[A.cur];
  if(ui.mode==='anim'){animRoot.children=[F];F.parent=animRoot;selectOnly(F);}
  if(!noRender){renderTimeline();requestRender(true);}}
const curFrame=()=>A_()?A_().frames[A_().cur]:null;

/* ---- undoable frame operations ---- */
function animState(){const A=A_();return {frames:A.frames.slice(),holds:A.frames.map(f=>f.hold),cur:A.cur,fps:A.fps,tags:A.tags.map(t=>Object.assign({},t))};}
function setAnimState(s){const A=A_();A.frames=s.frames.slice();s.frames.forEach((f,i)=>f.hold=s.holds[i]);A.fps=s.fps;A.tags=s.tags.map(t=>Object.assign({},t));showFrame(s.cur);renderAnimPanel();}
function animOp(label,fn){const A=A_();if(!A)return;if(ptr&&ptr.mode==='paint')return;stopPlay();const before=animState();if(fn(A)===false)return;const after=animState();
  pushUndo({label,mode:'anim',refs:[...new Set([...before.frames,...after.frames])],undo(){setAnimState(before);},redo(){setAnimState(after);}});
  showFrame(A.cur);renderAnimPanel();}
function addFrame(){animOp('New frame',A=>{A.frames.splice(A.cur+1,0,newFrame());A.cur++;});}
function duplicateFrame(){animOp('Duplicate frame',A=>{const s=A.frames[A.cur],F=newFrame();blit(s.target,F.target,0,0,doc.w,doc.h,0,0);F.hold=s.hold;A.frames.splice(A.cur+1,0,F);A.cur++;frameDirty(F);});}
function deleteFrame(){const A=A_();if(!A)return;if(A.frames.length<2){toast('An animation keeps at least one frame.');return;}
  animOp('Delete frame',A=>{const F=A.frames[A.cur];A.frames.splice(A.cur,1);
    for(const t of A.tags){if(t.from===F||t.to===F){const i=A.cur;const near=A.frames[Math.min(i,A.frames.length-1)];if(t.from===F)t.from=near;if(t.to===F)t.to=near;}}
    A.tags=A.tags.filter(t=>A.frames.includes(t.from)&&A.frames.includes(t.to));A.cur=Math.min(A.cur,A.frames.length-1);});}
function moveFrame(from,to){if(from===to)return;animOp('Move frame',A=>{const [F]=A.frames.splice(from,1);A.frames.splice(to,0,F);A.cur=to;});}
function setHold(h){h=clamp(Math.round(h)||1,1,99);const F=curFrame();if(!F||F.hold===h)return;animOp('Frame hold',()=>{F.hold=h;});}
function setFps(v){v=clamp(Math.round(v)||12,1,120);const A=A_();if(!A||A.fps===v)return;animOp('Frame rate',A=>{A.fps=v;});}
function tagRange(t){const A=A_();let a=A.frames.indexOf(t.from),b=A.frames.indexOf(t.to);if(a>b)[a,b]=[b,a];return [a,b];}
function addTag(a,b){animOp('New tag',A=>{const n=A.tags.length;A.tags.push({name:['idle','run','attack','jump','hit'][n]||('tag '+(n+1)),from:A.frames[Math.min(a,b)],to:A.frames[Math.max(a,b)],mode:'loop',color:TAG_COLORS[n%TAG_COLORS.length]});});}
function editTag(i,patch){animOp('Edit tag',A=>{Object.assign(A.tags[i],patch);});}
function deleteTag(i){animOp('Delete tag',A=>{A.tags.splice(i,1);});}

/* ---- playback ---- */
let playing=null;ui.playTag=-1;
function playOrder(){const A=A_();let a=0,b=A.frames.length-1,mode='loop';
  if(ui.playTag>=0&&A.tags[ui.playTag]){[a,b]=tagRange(A.tags[ui.playTag]);mode=A.tags[ui.playTag].mode;}
  const seq=[];for(let i=a;i<=b;i++)seq.push(i);if(mode==='pingpong')for(let i=b-1;i>a;i--)seq.push(i);return {seq,mode};}
function togglePlay(){if(playing){stopPlay();return;}const A=A_();if(!A||A.frames.length<2){toast('Add a second frame to play the animation.');return;}
  const {seq,mode}=playOrder();playing={k:0,seq,mode,start:A.cur};renderTimeline();requestRender(true);step();
  function step(){if(!playing)return;const i=playing.seq[playing.k];showFrame(i);const F=A.frames[i];
    playing.timer=setTimeout(()=>{if(!playing)return;playing.k++;if(playing.k>=playing.seq.length){if(playing.mode==='once'){stopPlay();return;}playing.k=0;}step();},F.hold*1000/A.fps);}}
function stopPlay(){if(!playing)return;clearTimeout(playing.timer);playing=null;renderTimeline();requestRender(true);}

/* ---- onion skin: tinted copies of nearby frames drawn under the current one (view only) ---- */
let onionT=null;
function buildOnion(){if(onionT){release(onionT);onionT=null;}const A=A_();if(ui.mode!=='anim'||!A||!A.onion.on||playing)return null;
  const o=A.onion,list=[];for(let k=o.before;k>=1;k--)list.push([A.cur-k,k,[.85,.15,.15]]);for(let k=o.after;k>=1;k--)list.push([A.cur+k,k,[.15,.7,.25]]);
  const use=list.filter(([i])=>i>=0&&i<A.frames.length);if(!use.length)return null;
  onionT=acquire();clearTarget(onionT);
  for(const [i,k,tint] of use)run(P.onion,onionT,{uSrc:A.frames[i].target.tex,uTint:tint,uUseTint:!!o.tint,uAlpha:Math.pow(o.fade,k)*.9},{blend:'over'});
  return onionT;}

/* ---- small images of frames (timeline thumbnails and the preview window) ---- */
const frameImgs=new WeakMap();let smallT=null;const SMALL=512;
function frameDirty(F){const r=frameImgs.get(F);if(r)r.dirty=true;scheduleTimeline();}
function renderSmall(t,canvas){const s=Math.min(1,SMALL/Math.max(doc.w,doc.h)),w=Math.max(1,Math.round(doc.w*s)),h=Math.max(1,Math.round(doc.h*s));
  if(!smallT||smallT.w!==w||smallT.h!==h){if(smallT){gl.deleteTexture(smallT.tex);gl.deleteFramebuffer(smallT.fbo);}smallT=makeTargetRaw(w,h);}
  clearTarget(smallT);run(P.resample,smallT,{uSrc:t.tex,uOffset:[0,0],uScale:[1/s,1/s],uTaps:{int:Math.min(8,Math.ceil(1/s))}});
  const buf=new Uint8Array(w*h*4);gl.bindFramebuffer(gl.FRAMEBUFFER,smallT.fbo);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);
  const img=new ImageData(w,h),d=img.data;for(let i=0;i<d.length;i+=4){const a=buf[i+3];if(a){d[i]=Math.min(255,buf[i]*255/a);d[i+1]=Math.min(255,buf[i+1]*255/a);d[i+2]=Math.min(255,buf[i+2]*255/a);d[i+3]=a;}}
  canvas.width=w;canvas.height=h;canvas.getContext('2d').putImageData(img,0,0);}
function frameImage(F){let r=frameImgs.get(F);if(!r){r={c:document.createElement('canvas'),dirty:true};frameImgs.set(F,r);}
  if(r.dirty&&F.target&&F.target.tex){renderSmall(F.target,r.c);r.dirty=false;}return r.c;}
/* while painting, refresh the current frame's small image from the live composite a few times a second */
let liveFrameAt=0;
function liveFrameUpdate(){if(ui.mode!=='anim'||!compOut)return;const now=performance.now();if(now-liveFrameAt<180)return;liveFrameAt=now;
  const F=curFrame();if(!F)return;let r=frameImgs.get(F);if(!r){r={c:document.createElement('canvas'),dirty:false};frameImgs.set(F,r);}renderSmall(compOut,r.c);r.dirty=false;scheduleTimeline();}
