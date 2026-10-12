/* ================= Animation mode: core =================
   doc.anim holds the frames (each a single image, stored as a layer object with .frame = true),
   timing (fps, a hold per frame), tags and onion-skin settings. In Animation mode the document's
   root is swapped for animRoot, whose only child is the current frame, so every tool paints on it
   unchanged. Paint mode's layers are kept in doc.paintRoot until you switch back. */
const animRoot={type:'group',children:[],isRoot:true,visible:true,opacity:1,mode:-1,anim:true,name:'Frames'};
ui.mode='paint';ui.animBg='checker';
const TAG_COLORS=['#e2a453','#6fb3d9','#8fca6e','#d97ea1','#b491e0','#e0cf6b','#6fd0b8'];
/* (0.58, Kenn) a frame is a folder of layers: the picture you see is all of them together. The folder keeps the frame's hold;
   a layer can be shared, so the same layer shows in every frame (a fixed background, say). */
function newFrame(){const F=newGroupObj('Frame');F.frame=true;F.hold=1;F.open=true;const L=newLayerObj('Layer 1');doc.count--;insertNode(L,F);F._act=L;return F;}
/* the bottom layer of a frame: where imported pictures and generated frames are drawn */
const frameLayer=F=>allLayers(F)[0]||null;
/* the frame a layer (or the frame itself) belongs to */
function animFrameOf(n){const A=A_();if(!A||!n)return null;if(n.frame)return A.frames.includes(n)?n:null;const cur=A.frames[A.cur];if(cur&&allNodes(cur).includes(n))return cur;return A.frames.find(F=>allNodes(F).includes(n))||null;}
/* the frame as one picture, all its layers together (pooled: give it back with release()) */
function frameFlat(F){const prev=pool;pool=auxFor(mapDepth('base')).pool;let r;try{const acc=acquire();clearTarget(acc,mapDefault('base'));r=compositeList([F],acc,'base');}finally{pool=prev;}return r;}
/* a frame made from a single picture layer (an older file, a PSD) becomes a folder holding it */
function frameUpgrade(L){if(L.type==='group')return L;const F=newGroupObj('Frame');F.frame=true;F.hold=L.hold||1;F.open=true;L.frame=false;delete L.hold;insertNode(L,F);F._act=L;return F;}
function makeAnim(frames){return {frames:frames||[newFrame()],cur:0,fps:12,tags:[],onion:{on:true,before:1,after:1,fade:.5,tint:true}};}
const paintRoot=()=>doc.paintRoot||doc.root;
function animFrameNodes(){const out=[];if(doc.anim)for(const F of doc.anim.frames){out.push(F);allNodes(F,out);}return [...new Set(out)];}
function everyLayer(){return [...allLayers(paintRoot()),...animFrameNodes().filter(n=>n.type!=='group')];}
function everyNode(){return [...allNodes(paintRoot()),...animFrameNodes()];}
const A_=()=>doc.anim;

/* ---- switching modes ---- */
function setMode(m,quiet){if(m===ui.mode)return true;
  if(preview||selLive){toast('Apply or cancel the open dialog first.');return false;}
  if(stroke||typeof pathEdit!=='undefined'&&pathEdit.drag)return false;if(typeof bk!=='undefined'&&bk.busy){toast('Wait for the bake to finish, or cancel it.');return false;}if(typeof pathFlush==='function')pathFlush();
  if(typeof xf!=='undefined'&&xf)xfCommit();if(typeof gsess!=='undefined'&&gsess)gradCommit();if(typeof tedit!=='undefined'&&tedit)closeTextEditor();textCommit();cancelSelTool();stopPlay();
  if(typeof cageFlatOff==='function')cageFlatOff();
  if(m==='anim'&&(doc.map!=='base'||doc.view!=='base')){setEditMap('base');if(doc.map!=='base')return false;}
  const from=ui.mode;
  /* Carry the 3D Paint project's imported low-poly into Bake before p3dExit restores the
     previous workspace's model. Bake uses this as its low source and displays it in the view. */
  if(from==='p3d'&&m==='bake'&&p3.imported)bakeCfg.low=p3.imported;
  if(from==='p3d')p3dExit();if(from==='bake')bakeExit();if(from==='convert')convertExit();if(from==='photo')photoExit();if(from==='brush')brushTabExit();
  if(from==='anim'){doc.root=doc.paintRoot;doc.paintRoot=null;const s=doc.paintSel||{active:null,sel:[]};doc.active=s.active;doc.sel=new Set(s.sel);ui.mode='paint';}
  if(m==='anim'){if(!doc.anim)doc.anim=makeAnim();doc.paintRoot=doc.root;doc.paintSel={active:doc.active,sel:[...doc.sel]};doc.root=animRoot;ui.mode='anim';showFrame(doc.anim.cur,true);}
  else ui.mode=m;
  document.body.classList.toggle('animmode',ui.mode==='anim');document.body.classList.toggle('bakemode',ui.mode==='bake');document.body.classList.toggle('convmode',ui.mode==='convert');document.body.classList.toggle('photomode',ui.mode==='photo');document.body.classList.toggle('brushmode',ui.mode==='brush');document.body.classList.toggle('p3dmode',ui.mode==='p3d');syncModeTabs();
  if(ui.mode==='p3d')p3dEnter();if(ui.mode==='bake')bakeEnter();if(ui.mode==='convert')convertEnter();if(ui.mode==='photo')photoEnter();if(ui.mode==='brush')brushTabEnter();
  if(ui.tool==='text'&&ui.mode!=='paint'&&ui.mode!=='anim')setTool('brush');
  if(typeof tipBanner==='function')tipBanner();if(typeof dkModeChanged==='function')dkModeChanged();
  renderLayers();refreshChanUI();refreshMapsUI();renderTimeline();renderAnimPanel();buildBrushPanel();changedAll();resizeGL();requestRender(true);
  if(!quiet)toast(ui.mode==='anim'?'Animation mode: paint each frame. , and . step through frames, Enter plays.':ui.mode==='bake'?'Bake: bake maps from a high-poly model, see them on the model, and paint fixes.':ui.mode==='convert'?'Convert: make normal, height, AO and more from a photo or another map.':ui.mode==='photo'?'Photo: open photos and edit them like Lightroom. Your photo files are never changed.':ui.mode==='brush'?'Brush: draw a brush tip in black. Your painting is kept in Paint.':ui.mode==='p3d'?'3D Paint: paint on the model. Its textures are separate from Paint.':'Paint mode.');return true;}
function showFrame(i,noRender){const A=A_();if(!A)return;const prev=A.frames[A.cur];if(prev&&ui.mode==='anim'&&doc.active&&allNodes(prev).includes(doc.active))prev._act=doc.active;
  A.cur=clamp(i,0,A.frames.length-1);const F=A.frames[A.cur];
  if(ui.mode==='anim'){animRoot.children=[F];F.parent=animRoot;if(typeof afxApply==='function')afxApply();const act=F._act&&allNodes(F).includes(F._act)?F._act:frameLayer(F);selectOnly(act);}
  if(!noRender){renderTimeline();requestRender(true);}}
const curFrame=()=>A_()?A_().frames[A_().cur]:null;


/* ---- layers shared by every frame (a fixed background, a character base) ----
   The same layer object sits in every frame's folder, so painting on it in one frame changes it in all of them. */
function animShareLayer(L,on){const A=A_();if(!A||!L||L.type==='group')return;const home=L.parent;if(!home||!home.frame){toast('Only a layer directly in the frame can be shared.');return;}
  animOp(on?'Show layer in every frame':'Separate layer in each frame',A=>{
    if(on){const idx=home.children.indexOf(L);L.shared=true;for(const F of A.frames){if(F===home)continue;
        /* an empty layer with the same name in that frame (made by New frame) is replaced by the shared one */
        const c=F.children[idx];if(c&&c.type==='layer'&&!c.fx&&!c.shared&&c.name===L.name&&!contentBounds(c.target)){F.children[idx]=L;continue;}insertNode(L,F,Math.min(idx,F.children.length));}L.parent=home;}
    else{L.shared=false;for(const F of A.frames){if(F===home)continue;const i=F.children.indexOf(L);if(i<0)continue;const k=cloneNode(L);k.name=L.name;k.shared=false;F.children[i]=k;k.parent=F;}}});
  frameDirty(home);toast(on?'“'+L.name+'” now shows in every frame. Painting on it changes it everywhere.':'“'+L.name+'” is separate in each frame now (every frame has its own copy).');}
/* take a shared layer out of every frame */
function animDeleteShared(L){const A=A_();if(!A||!L||!L.shared)return;
  animOp('Delete layer from every frame',A=>{for(const F of A.frames){const i=F.children.indexOf(L);if(i>=0)F.children.splice(i,1);}L.shared=false;
    for(const F of A.frames)if(!F.children.length){const B=newLayerObj('Layer 1');doc.count--;insertNode(B,F);F._act=B;}});}
/* ---- undoable frame operations ---- */
function animState(){const A=A_();return {frames:A.frames.slice(),kids:A.frames.map(f=>f.children.slice()),sh:animFrameNodes().filter(n=>n.shared),holds:A.frames.map(f=>f.hold),cur:A.cur,fps:A.fps,tags:A.tags.map(t=>Object.assign({},t)),fxl:(A.fxl||[]).map(afxClone)};}
function setAnimState(s){const A=A_();for(const n of animFrameNodes())n.shared=false;A.frames=s.frames.slice();s.frames.forEach((f,i)=>{f.hold=s.holds[i];f.children=s.kids[i].slice();for(const c of f.children)c.parent=f;});for(const n of s.sh||[])n.shared=true;A.fps=s.fps;A.tags=s.tags.map(t=>Object.assign({},t));A.fxl=(s.fxl||[]).map(afxClone);showFrame(s.cur);renderAnimPanel();}
function animOp(label,fn){const A=A_();if(!A)return;if(ptr&&ptr.mode==='paint')return;stopPlay();const before=animState();
  /* keyframes follow the frames they sit on when frames are added, deleted or moved */
  const order=A.frames.slice(),kr=[];for(const tr of A.fxl||[])for(const k in tr.keys)for(const x of tr.keys[k])kr.push([tr,k,x,order[x.f]]);
  if(fn(A)===false)return;
  for(const [tr,k,x,F] of kr){const n=F?A.frames.indexOf(F):-1;if(n<0){const ks=tr.keys[k];if(ks){const i=ks.indexOf(x);if(i>=0)ks.splice(i,1);if(!ks.length){tr.v[k]=x.v;delete tr.keys[k];}}}else x.f=n;}
  for(const tr of A.fxl||[])for(const k in tr.keys)tr.keys[k].sort((a,b)=>a.f-b.f);
  const after=animState();
  pushUndo({label,mode:'anim',refs:[...new Set([...before.frames,...after.frames,...before.kids.flat(),...after.kids.flat()])],undo(){setAnimState(before);},redo(){setAnimState(after);}});
  showFrame(A.cur);renderAnimPanel();}
function addFrame(){animOp('New frame',A=>{A.frames.splice(A.cur+1,0,frameBlankLike(A.frames[A.cur]));A.cur++;});}
function duplicateFrame(){animOp('Duplicate frame',A=>{const s=A.frames[A.cur],F=frameCopy(s);A.frames.splice(A.cur+1,0,F);A.cur++;});}
function deleteFrame(){const A=A_();if(!A)return;if(A.frames.length<2){toast('An animation keeps at least one frame.');return;}
  animOp('Delete frame',A=>{const F=A.frames[A.cur];A.frames.splice(A.cur,1);
    for(const t of A.tags){if(t.from===F||t.to===F){const i=A.cur;const near=A.frames[Math.min(i,A.frames.length-1)];if(t.from===F)t.from=near;if(t.to===F)t.to=near;}}
    A.tags=A.tags.filter(t=>A.frames.includes(t.from)&&A.frames.includes(t.to));A.cur=Math.min(A.cur,A.frames.length-1);});}
function moveFrame(from,to){if(from===to)return;animOp('Move frame',A=>{const [F]=A.frames.splice(from,1);A.frames.splice(to,0,F);A.cur=to;});}
/* ---- (0.41, Kenn) Quick dupli and flipbook helpers: one undo step each ---- */
const QD_PRESETS=[4,8,12,16,24,32,64];
/* a copy of a frame: its layers are copied too, except shared ones, which stay the same layer in the new frame */
function frameCopy(s){const F=newGroupObj('Frame');F.frame=true;F.hold=s.hold;F.open=true;
  const cp=(c,parent)=>{if(c.shared&&c.type!=='group'){insertNode(c,parent);return c;}const k=cloneNode(c);k.name=c.name;insertNode(k,parent);return k;};
  let act=null;for(const c of s.children){const k=cp(c,F);if(c===s._act)act=k;}F._act=act||frameLayer(F);frameDirty(F);return F;}
/* a new, empty frame with the same layers as this one (same names, blend modes and order); shared layers are shared */
function frameBlankLike(s){const F=newGroupObj('Frame');F.frame=true;F.hold=1;F.open=true;
  const bl=(c,parent)=>{if(c.shared&&c.type!=='group'){insertNode(c,parent);return c;}let k;if(c.type==='group'){k=newGroupObj(c.name);k.open=c.open;for(const x of c.children)bl(x,k);}else if(c.fx){k=cloneNode(c);}else{k=newLayerObj(c.name);doc.count--;}
    Object.assign(k,{name:c.name,opacity:c.opacity,mode:c.mode,clip:c.clip,visible:c.visible});insertNode(k,parent);return k;};
  let act=null;for(const c of s.children){const k=bl(c,F);if(c===s._act)act=k;}if(!F.children.length){const L=newLayerObj('Layer 1');doc.count--;insertNode(L,F);}F._act=act||frameLayer(F);return F;}
function animMemOk(extra){const per=doc.w*doc.h*(doc.depth>8?8:4),A=A_();const total=(A.frames.length+extra)*per;
  if(total>2.5e9){toast('That would use about '+(total/1e9).toFixed(1)+' GB of video memory. Try fewer frames or a smaller canvas.');return false;}return true;}
/* n copies of the current frame, straight after it ('after') or at the end of the animation ('end') */
function quickDupli(n,where,step){const A=A_();if(!A)return;n=clamp(Math.round(n)||0,1,512);if(!animMemOk(n))return;
  animOp('Quick dupli',A=>{const s=A.frames[A.cur],src=A.cur,at=where==='end'?A.frames.length:A.cur+1,list=[];for(let k=0;k<n;k++)list.push(frameCopy(s));A.frames.splice(at,0,...list);A.cur=at+n-1;ui.fsel=[at,at+n-1];
    /* optional: step an effect's slider from one value on the first frame to another on the last copy */
    const tr=step&&(A.fxl||[])[step.track];if(tr&&tr.keys&&typeof step.from==='number'&&typeof step.to==='number'){
      const ks=tr.keys[step.key]=(tr.keys[step.key]||[]).filter(x=>x.f!==src);
      ks.push({f:src,v:step.from,e:step.e||'lin'},{f:at+n-1,v:step.to,e:step.e||'lin'});ks.sort((a,b)=>a.f-b.f);}});}
/* the frames a helper works on: the Shift+click range, or all frames */
function animRange(){const A=A_();if(ui.fsel){const a=Math.min(...ui.fsel),b=Math.max(...ui.fsel);return [clamp(a,0,A.frames.length-1),clamp(b,0,A.frames.length-1)];}return [0,A.frames.length-1];}
function reverseFrames(){const A=A_();if(!A)return;const [a,b]=animRange();if(b<=a){toast('Pick a range with Shift+click, or have at least two frames.');return;}
  animOp('Reverse frames',A=>{const part=A.frames.slice(a,b+1).reverse();A.frames.splice(a,b-a+1,...part);if(A.cur>=a&&A.cur<=b)A.cur=a+b-A.cur;});}
/* play forward then back: adds reversed copies after the range (without doubling the two ends) */
function pingPongFrames(){const A=A_();if(!A)return;const [a,b]=animRange();if(b<=a){toast('Pick a range with Shift+click, or have at least two frames.');return;}if(!animMemOk(b-a-1))return;
  animOp('Ping-pong',A=>{const list=[];for(let i=b-1;i>a;i--)list.push(frameCopy(A.frames[i]));A.frames.splice(b+1,0,...list);ui.fsel=null;});}
/* the range, repeated n more times */
function repeatFrames(n){const A=A_();if(!A)return;n=clamp(Math.round(n)||1,1,64);const [a,b]=animRange(),len=b-a+1;if(!animMemOk(len*n))return;
  animOp('Repeat frames',A=>{const src=A.frames.slice(a,b+1),list=[];for(let k=0;k<n;k++)for(const f of src)list.push(frameCopy(f));A.frames.splice(b+1,0,...list);ui.fsel=null;});}
function setRangeHold(h){const A=A_();if(!A)return;h=clamp(Math.round(h)||1,1,99);const [a,b]=animRange();animOp('Frame hold',A=>{for(let i=a;i<=b;i++)A.frames[i].hold=h;});}
function setHold(h){h=clamp(Math.round(h)||1,1,99);const F=curFrame();if(!F||F.hold===h)return;animOp('Frame hold',()=>{F.hold=h;});}
function setFps(v){v=clamp(Math.round(v)||12,1,240);const A=A_();if(!A||A.fps===v)return;animOp('Frame rate',A=>{A.fps=v;});}
function tagRange(t,A){A=A||A_();let a=A.frames.indexOf(t.from),b=A.frames.indexOf(t.to);if(a>b)[a,b]=[b,a];return [a,b];}
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
  function step(){if(!playing)return;if(tabDocs.hold){playing.timer=setTimeout(step,50);return;}const i=playing.seq[playing.k];showFrame(i);const F=A.frames[i];
    playing.timer=setTimeout(()=>{if(!playing)return;playing.k++;if(playing.k>=playing.seq.length){if(playing.mode==='once'){stopPlay();return;}playing.k=0;}step();},F.hold*1000/A.fps);}}
function stopPlay(){if(!playing)return;clearTimeout(playing.timer);playing=null;renderTimeline();requestRender(true);}

/* ---- onion skin: tinted copies of nearby frames drawn under the current one (view only) ---- */
/* (0.58, Kenn) colour-blind friendly choices for the onion skin: red and green look alike to many people */
const ONION_PALS={rg:{name:'Red before, green after',b:[.85,.15,.15],a:[.15,.7,.25]},bo:{name:'Blue before, orange after (colour-blind friendly)',b:[.2,.45,.95],a:[.98,.6,.08]},bw:{name:'Dark before, light after (no colour)',b:[.12,.12,.12],a:[.95,.95,.95]}};
let onionT=null;
function buildOnion(){if(onionT){release(onionT);onionT=null;}const A=A_();if(ui.mode!=='anim'||!A||!A.onion.on||playing)return null;
  const o=A.onion,list=[];const pal=ONION_PALS[o.pal]||ONION_PALS.rg;for(let k=o.before;k>=1;k--)list.push([A.cur-k,k,pal.b]);for(let k=o.after;k>=1;k--)list.push([A.cur+k,k,pal.a]);
  const use=list.filter(([i])=>i>=0&&i<A.frames.length);if(!use.length)return null;
  onionT=acquire();clearTarget(onionT);
  for(const [i,k,tint] of use){const ft=frameFlat(A.frames[i]);try{run(P.onion,onionT,{uSrc:ft.tex,uTint:tint,uUseTint:!!o.tint,uAlpha:Math.pow(o.fade,k)*.9},{blend:'over'});}finally{release(ft);}}
  return onionT;}

/* ---- small images of frames (timeline thumbnails and the preview window) ---- */
const frameImgs=new WeakMap();let smallT=null;const SMALL=512;
function frameDirty(F){const r=frameImgs.get(F);if(r)r.dirty=true;scheduleTimeline();}
function renderSmall(t,canvas){const s=Math.min(1,SMALL/Math.max(doc.w,doc.h)),w=Math.max(1,Math.round(doc.w*s)),h=Math.max(1,Math.round(doc.h*s));
  if(!smallT||smallT.w!==w||smallT.h!==h){disposeTarget(smallT);smallT=makeTargetRaw(w,h);}
  clearTarget(smallT);run(P.resample,smallT,{uSrc:t.tex,uOffset:[0,0],uScale:[1/s,1/s],uTaps:{int:Math.min(8,Math.ceil(1/s))}});
  const buf=new Uint8Array(w*h*4);gl.bindFramebuffer(gl.FRAMEBUFFER,smallT.fbo);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);
  const img=new ImageData(w,h),d=img.data;for(let i=0;i<d.length;i+=4){const a=buf[i+3];if(a){d[i]=Math.min(255,buf[i]*255/a);d[i+1]=Math.min(255,buf[i+1]*255/a);d[i+2]=Math.min(255,buf[i+2]*255/a);d[i+3]=a;}}
  canvas.width=w;canvas.height=h;canvas.getContext('2d').putImageData(img,0,0);}
function frameImage(F){let r=frameImgs.get(F);if(!r){r={c:document.createElement('canvas'),dirty:true};frameImgs.set(F,r);}
  if(r.dirty&&F.children){const ft=frameFlat(F);try{renderSmall(ft,r.c);}finally{release(ft);}r.dirty=false;}return r.c;}
/* while painting, refresh the current frame's small image from the live composite a few times a second */
let liveFrameAt=0;
function liveFrameUpdate(){if(ui.mode!=='anim'||!compOut)return;const now=performance.now();if(now-liveFrameAt<180)return;liveFrameAt=now;
  const F=curFrame();if(!F)return;let r=frameImgs.get(F);if(!r){r={c:document.createElement('canvas'),dirty:false};frameImgs.set(F,r);}renderSmall(compOut,r.c);r.dirty=false;scheduleTimeline();}
