/* ================= Photo tab: the crop box on the picture, keys, dropping photos ================= */
const PH_HANDLES=['tl','t','tr','r','br','b','bl','l'];
function phHandlePts(c){const [x0,y0,x1,y1]=c,mx=(x0+x1)/2,my=(y0+y1)/2;return {tl:[x0,y0],t:[mx,y0],tr:[x1,y0],r:[x1,my],br:[x1,y1],b:[mx,y1],bl:[x0,y1],l:[x0,my]};}
function phOverlay(f){if(ui.mode==='photo'&&!ph.crop&&typeof phLocalOverlay==='function')return phLocalOverlay(f)+(typeof phSpotOverlay==='function'?phSpotOverlay(f):'')+(typeof phRmOverlay==='function'?phRmOverlay(f):'');if(ui.mode!=='photo'||!ph.crop||!phP())return '';const c=phS().geo.crop,W=doc.w,H=doc.h,P=([x,y])=>f([x*W,y*H]);
  const q=[[c[0],c[1]],[c[2],c[1]],[c[2],c[3]],[c[0],c[3]]].map(P),outer=[[0,0],[1,0],[1,1],[0,1]].map(P);
  let s='<path class="phdim" fill-rule="evenodd" d="M'+outer.join('L')+'ZM'+q.join('L')+'Z"/><path class="phcrop" d="M'+q.join('L')+'Z"/>';
  let g='';for(const t of [1/3,2/3]){g+='M'+P([c[0]+(c[2]-c[0])*t,c[1]])+'L'+P([c[0]+(c[2]-c[0])*t,c[3]])+'M'+P([c[0],c[1]+(c[3]-c[1])*t])+'L'+P([c[2],c[1]+(c[3]-c[1])*t]);}
  s+='<path class="phgrid" d="'+g+'"/>';const hp=phHandlePts(c);for(const k of PH_HANDLES){const [a,b]=P(hp[k]).split(' ').map(Number);s+='<rect class="phhandle" x="'+(a-5)+'" y="'+(b-5)+'" width="10" height="10"/>';}return s;}
function phPointerDown(e,ix,iy){const p=phP();if(!p)return false;
  if(ph.pick&&!ph.crop&&e.button===0){phPickAt(ix,iy,e);return true;}
  if(ph.crop){const c=phS().geo.crop,W=doc.w,H=doc.h,r=stage.getBoundingClientRect(),hp=phHandlePts(c);let hit=null,bd=14;
    for(const k of PH_HANDLES){const sp=scrPt([hp[k][0]*W,hp[k][1]*H]),d=Math.hypot(e.clientX-r.left-sp[0],e.clientY-r.top-sp[1]);if(d<bd){bd=d;hit=k;}}
    const nx=ix/W,ny=iy/H;if(!hit&&nx>c[0]&&nx<c[2]&&ny>c[1]&&ny<c[3])hit='move';
    if(hit){ptr={mode:'phcrop',id:e.pointerId,h:hit,c0:c.slice(),nx0:nx,ny0:ny};return true;}}
  if(!ph.crop&&!e.altKey&&e.button===0&&ph.rm&&ph.rm.on&&phRmDown(e,ix,iy))return true;
  if(!ph.crop&&!e.altKey&&e.button===0&&ph.sp&&ph.sp.tool&&phSpotDown(e,ix,iy))return true;
  if(!ph.crop&&!e.altKey&&e.button===0&&typeof phLocalDown==='function'&&phLocalDown(e,ix,iy))return true;
  ptr={mode:'pan',id:e.pointerId,sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y};stage.classList.add('panning');return true;}
function phCropMove(ix,iy){const p=phP(),g=p.s.geo,W=doc.w,H=doc.h,t=ptr,dx=ix/W-t.nx0,dy=iy/H-t.ny0;let [x0,y0,x1,y1]=t.c0;const MIN=.03;
  if(t.h==='move'){const w=x1-x0,h=y1-y0;x0=clamp(x0+dx,0,1-w);y0=clamp(y0+dy,0,1-h);x1=x0+w;y1=y0+h;}
  else{if(t.h.includes('l'))x0=clamp(t.c0[0]+dx,0,x1-MIN);if(t.h.includes('r'))x1=clamp(t.c0[2]+dx,x0+MIN,1);if(t.h.includes('t'))y0=clamp(t.c0[1]+dy,0,y1-MIN);if(t.h.includes('b'))y1=clamp(t.c0[3]+dy,y0+MIN,1);
    const R=phAspectValue(g.aspect||'original',doc.w,doc.h);
    if(R){const horiz=t.h==='l'||t.h==='r'||t.h.length===2,anchorX=t.h.includes('l')?x1:t.h.includes('r')?x0:null,anchorY=t.h.includes('t')?y1:t.h.includes('b')?y0:null;
      if(horiz){const w=x1-x0;let h=w*W/(H*R);if(h>1){h=1;}const cy=(y0+y1)/2;if(anchorY!=null){if(t.h.includes('t'))y0=Math.max(0,y1-h);else y1=Math.min(1,y0+h);}else{y0=clamp(cy-h/2,0,1-h);y1=y0+h;}
        const w2=(y1-y0)*H*R/W;if(w2<w-1e-6){if(t.h.includes('l'))x0=x1-w2;else x1=x0+w2;}}
      else{const h=y1-y0;let w=h*H*R/W;if(w>1)w=1;const cx=(x0+x1)/2;x0=clamp(cx-w/2,0,1-w);x1=x0+w;}}}
  g.crop=[x0,y0,x1,y1];drawXfOverlay();phDirty();}
function phCropUp(){ptr=null;phCommit('Crop');phSidecarSoon();}
/* keys */
window.addEventListener('keydown',e=>{if(ui.mode!=='photo'||isTypingTarget(e.target)||document.getElementById('modal')&&!document.getElementById('modal').hidden)return;const k=e.key,m=e.ctrlKey||e.metaKey;let used=true;
  if(k==='\\'&&!e.repeat)phShow('before');
  else if(m&&e.shiftKey&&(k==='c'||k==='C'))phCopy();else if(m&&e.shiftKey&&(k==='v'||k==='V'))phPaste(false);
  else if(!m&&!e.altKey&&k==='ArrowRight')phStep(1);else if(!m&&!e.altKey&&k==='ArrowLeft')phStep(-1);
  else if(!m&&!e.altKey&&!e.shiftKey&&/^[0-5]$/.test(k))phRate(+k);else if(!m&&!e.altKey&&!e.shiftKey&&(k==='p'||k==='P'))phFlag(1);else if(!m&&!e.altKey&&!e.shiftKey&&(k==='x'||k==='X'))phFlag(-1);
  else if(!m&&!e.altKey&&!e.shiftKey&&(k==='c'||k==='C'))phCropToggle();else if(k==='Escape'&&ph.crop)phCropToggle();else if(k==='Enter'&&ph.crop)phCropToggle();
  else if(m&&(k==='o'||k==='O')){phOpenDialog();}
  else if(!m&&!e.altKey&&(k==='j'||k==='J')){ph.clipWarn=!ph.clipWarn;phDirty();toast(ph.clipWarn?'Clipping shown: red = too bright, blue = too dark':'Clipping hidden');}
  else used=false;if(used){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('keyup',e=>{if(ui.mode==='photo'&&e.key==='\\'){phShow('edit');}},true);
/* Undo and Redo follow the photo's own history in this tab */
{const u=undo,r=redo;undo=function(){if(ui.mode==='photo'){phUndo();return;}return u.apply(this,arguments);};redo=function(){if(ui.mode==='photo'){phRedo();return;}return r.apply(this,arguments);};}
/* dropping photos on the picture */
(()=>{const s=document.getElementById('stage');if(!s)return;s.addEventListener('dragover',e=>{if(ui.mode!=='photo')return;e.preventDefault();e.stopImmediatePropagation();},true);
  s.addEventListener('drop',e=>{if(ui.mode!=='photo')return;e.preventDefault();e.stopImmediatePropagation();const fs=[...(e.dataTransfer?e.dataTransfer.files:[])].filter(f=>{const x=(f.name.split('.').pop()||'').toLowerCase();return PH_EXTS.includes(x)||PH_RAW.includes(x)||(f.type||'').startsWith('image/');});if(fs.length)phAddFiles(fs);},true);})();
