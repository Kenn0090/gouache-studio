/* ================= Selections: core =================
   sel.t holds the selection as grey pixels (white = selected), same size as the document.
   Shapes (marquee, lasso) are drawn on the GPU as polygons, anti-aliased with multisampling,
   then combined with the current selection (new / add / subtract / intersect). */
const SEL_MODES=['new','add','sub','int'];
ui.selMode='new';ui.selFeather=0;ui.selAA=true;ui.marquee='rect';ui.lasso='free';
ui.wandTol=32;ui.wandContig=true;ui.wandAll=false;

/* working images at the selection's own bit depth */
const acquireS=()=>acquireD(sel.t?sel.t.depth:doc.depth);
function selChanged(){requestRender();updateSelStatus();}
function updateSelStatus(){const p=$('#stSel');if(!p)return;
  if(sel.quick){p.hidden=false;p.textContent='Quick mask';p.title='Painting the selection: black hides, white selects. Press Q to turn it back into a selection.';return;}
  if(sel.active&&sel.bb){const b=sel.bb;p.hidden=false;p.textContent='Selection '+(b[2]-b[0])+' × '+(b[3]-b[1]);p.title='Ctrl+D deselects. Ctrl+Shift+I inverts.';return;}
  p.hidden=true;}
$('#stSel').addEventListener('click',()=>{if(sel.quick)toggleQuickMask();else deselect();});
/* marching ants are animated: redraw the view a few times a second while a selection is shown */
setInterval(()=>{if(sel.active&&!sel.quick&&!document.hidden)requestRender();},90);

/* ---- rectangles ---- */
const fullRect=()=>[0,0,doc.w,doc.h];
function rUnion(a,b){if(!a)return b?b.slice():null;if(!b)return a.slice();return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];}
function rInter(a,b){if(!a||!b)return null;const r=[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])];return r[2]>r[0]&&r[3]>r[1]?r:null;}
function rGrow(a,n){return a?[a[0]-n,a[1]-n,a[2]+n,a[3]+n]:null;}
/* bounds in document space: in tile mode anything crossing an edge wraps round, so that axis becomes the full width/height */
function rToDoc(a){if(!a)return null;let [x0,y0,x1,y1]=[Math.floor(a[0]),Math.floor(a[1]),Math.ceil(a[2]),Math.ceil(a[3])];
  if(doc.wrap){if(x0<0||x1>doc.w){x0=0;x1=doc.w;}if(y0<0||y1>doc.h){y0=0;y1=doc.h;}}
  return rInter([x0,y0,x1,y1],fullRect());}

/* ---- undo snapshots of the selection: 1 byte per pixel, read in strips to keep memory low ---- */
let H2F=null;
function h2fLut(){if(H2F)return H2F;H2F=new Float32Array(65536);for(let h=0;h<65536;h++){const s=h&0x8000?-1:1,e=(h>>10)&31,f=h&1023;H2F[h]=e===0?s*f*5.960464477539063e-8:e===31?(f?NaN:s*Infinity):s*Math.pow(2,e-15)*(1+f/1024);}return H2F;}
let F2H8=null;
function f2h8(){if(F2H8)return F2H8;F2H8=new Uint16Array(256);for(let i=0;i<256;i++)F2H8[i]=f2h(i/255);return F2H8;}
function captureSel(t,r){const [x,y]=r,w=r[2]-r[0],h=r[3]-r[1],out=new Uint8Array(w*h),strip=Math.max(1,Math.floor(4194304/w));
  for(let sy=0;sy<h;sy+=strip){const sh=Math.min(strip,h-sy),s=captureRegionNow(t,x,y+sy,w,sh),d=s.data,o=sy*w;
    if(s.depth===16){const L=h2fLut();for(let i=0;i<w*sh;i++)out[o+i]=Math.max(0,Math.min(255,Math.round(L[d[i*4]]*255)));}
    else for(let i=0;i<w*sh;i++)out[o+i]=d[i*4];}
  return {w,h,depth:'sel',data:out,bytes:out.byteLength};}
function restoreSel(snap,x,y){const w=snap.w,h=snap.h,src=snap.data,strip=Math.max(1,Math.floor(4194304/w)),d16=sel.t.depth===16,H=d16?f2h8():null,one=d16?f2h(1):255;
  for(let sy=0;sy<h;sy+=strip){const sh=Math.min(strip,h-sy),n=w*sh,o=sy*w;
    if(d16){const u=new Uint16Array(n*4);for(let i=0;i<n;i++){const v=H[src[o+i]];u[i*4]=u[i*4+1]=u[i*4+2]=v;u[i*4+3]=one;}restoreRegion({w,h:sh,depth:16,data:u},sel.t,x,y+sy);}
    else{const u=new Uint8Array(n*4);for(let i=0;i<n;i++){const v=src[o+i];u[i*4]=u[i*4+1]=u[i*4+2]=v;u[i*4+3]=255;}restoreRegion({w,h:sh,depth:8,data:u},sel.t,x,y+sy);}}}
const selState=()=>({active:sel.active,bb:sel.bb&&sel.bb.slice(),quick:sel.quick});
function setSelState(s){sel.active=s.active;sel.bb=s.bb&&s.bb.slice();sel.quick=s.quick;}
/* one undoable selection change; rect = the part of the selection image fn may rewrite (null = only flags change) */
function selRecord(label,rect,fn,fromT){const r=rect&&rToDoc(rect);const before=selState(),bs=r?captureSel(fromT||sel.t,r):null;
  if(fn()===false)return false;const after=selState(),as=r?captureSel(sel.t,r):null;
  pushUndo({label,refs:[],snaps:[bs,as].filter(Boolean),
    undo(){if(bs)restoreSel(bs,r[0],r[1]);setSelState(before);selChanged();refreshQuickUI();},
    redo(){if(as)restoreSel(as,r[0],r[1]);setSelState(after);selChanged();refreshQuickUI();}});
  selChanged();return true;}
function selBusy(){if(selLive){toast('Apply or cancel the selection dialog first.');return true;}if(preview){toast('Apply or cancel the open filter first.');return true;}if(sel.quick){toast('Quick mask is on. Press Q to turn it back into a selection first.');return true;}return false;}

/* ---- GPU polygon fill (even-odd, optionally anti-aliased), in chunks so huge documents work ---- */
const CHUNK=2048;let polyRes=null;
function polyResources(){if(polyRes)return polyRes;
  const samples=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)||0);
  const vao2=gl.createVertexArray(),buf=gl.createBuffer();gl.bindVertexArray(vao2);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(vao);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,CHUNK,CHUNK,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  let msFbo=null;if(samples>1){const rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.RGBA8,CHUNK,CHUNK);
    msFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,msFbo);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,rb);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  return polyRes={vao2,buf,tex,fbo,msFbo};}
function polyBounds(pts){let b=[Infinity,Infinity,-Infinity,-Infinity];for(let i=0;i<pts.length;i+=2){b[0]=Math.min(b[0],pts[i]);b[1]=Math.min(b[1],pts[i+1]);b[2]=Math.max(b[2],pts[i]);b[3]=Math.max(b[3],pts[i+1]);}return b;}
/* fills dst (a pooled document-size target) with the polygon's coverage in grey */
function rasterPoly(pts,dst,aa){clearTarget(dst,[0,0,0,1]);if(pts.length<6)return;
  const R=polyResources(),W=doc.w,H=doc.h,bb=polyBounds(pts),useMs=aa&&R.msFbo;
  const offs=doc.wrap?[[-W,-H],[0,-H],[W,-H],[-W,0],[0,0],[W,0],[-W,H],[0,H],[W,H]]:[[0,0]];
  const copies=offs.filter(([ox,oy])=>bb[0]+ox<W&&bb[2]+ox>0&&bb[1]+oy<H&&bb[3]+oy>0);
  gl.bindBuffer(gl.ARRAY_BUFFER,R.buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pts),gl.STREAM_DRAW);
  const n=pts.length/2;
  for(let cy=0;cy<H;cy+=CHUNK)for(let cx=0;cx<W;cx+=CHUNK){const cw=Math.min(CHUNK,W-cx),ch=Math.min(CHUNK,H-cy);
    for(const [ox,oy] of copies){if(bb[0]+ox>=cx+cw||bb[2]+ox<=cx||bb[1]+oy>=cy+ch||bb[3]+oy<=cy)continue;
      /* toggle-fill: every covered sample flips 0 <-> 1, which gives even-odd filling for any polygon */
      gl.bindFramebuffer(gl.FRAMEBUFFER,useMs?R.msFbo:R.fbo);gl.viewport(0,0,cw,ch);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(P.poly.p);gl.uniform2f(gl.getUniformLocation(P.poly.p,'uOrigin'),cx-ox,cy-oy);gl.uniform2f(gl.getUniformLocation(P.poly.p,'uSize'),cw,ch);
      gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE_MINUS_DST_COLOR,gl.ZERO);
      gl.bindVertexArray(R.vao2);gl.drawArrays(gl.TRIANGLE_FAN,0,n);gl.bindVertexArray(vao);gl.disable(gl.BLEND);
      if(useMs){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,R.msFbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,R.fbo);gl.blitFramebuffer(0,0,cw,ch,0,0,cw,ch,gl.COLOR_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
      /* keep the brightest of the wrapped copies */
      gl.enable(gl.SCISSOR_TEST);gl.scissor(cx,cy,cw,ch);run(P.rcopy,dst,{uSrc:R.tex,uOff:[cx,cy]},{blend:'max'});gl.disable(gl.SCISSOR_TEST);}}}
function ellipsePts(x0,y0,x1,y1){const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=Math.abs(x1-x0)/2,ry=Math.abs(y1-y0)/2,
  n=clamp(Math.ceil(2*Math.PI*Math.sqrt((rx*rx+ry*ry)/2)/1.5),24,4096),p=[];
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;p.push(cx+Math.cos(a)*rx,cy+Math.sin(a)*ry);}return p;}
const rectPts=(x0,y0,x1,y1)=>[x0,y0,x1,y0,x1,y1,x0,y1];

/* ---- combining a shape with the selection ---- */
function modeIndex(m){return Math.max(0,SEL_MODES.indexOf(m));}
/* shapeT: pooled target with the new shape in grey; shapeBB: its document bounds (already feathered) */
function applyShape(shapeT,mode,shapeBB,label){
  const had=sel.active&&!!sel.bb;let m=modeIndex(mode);
  if(!had){if(m===2){toast('Nothing is selected to subtract from.');return;}if(m===3){toast('Nothing is selected to intersect with.');return;}m=0;}
  const old=sel.bb;let region,nb;
  if(m===0){region=rUnion(old,shapeBB);nb=shapeBB;}
  else if(m===1){region=shapeBB;nb=rUnion(old,shapeBB);}
  else if(m===2){region=rInter(old,shapeBB);nb=old;}
  else{region=old;nb=rInter(old,shapeBB);}
  selRecord(label,region||[0,0,0,0],()=>{const tmp=acquireS();run(P.selop,tmp,{uOld:sel.t.tex,uShape:shapeT.tex,uMode:{int:m},uOldOn:had});
    blit(tmp,sel.t,0,0,doc.w,doc.h,0,0);release(tmp);sel.bb=nb;sel.active=!!nb;});}
function featherInto(t,bb,f){if(f>0){gaussian(t,t,f);return rToDoc(rGrow(bb,Math.ceil(f*1.4)+2));}return rToDoc(bb);}
function selectPolygon(pts,mode,label,aa){if(selBusy())return;const bbRaw=polyBounds(pts);if(!(bbRaw[2]>bbRaw[0]&&bbRaw[3]>bbRaw[1]))return;
  const t=acquireS();rasterPoly(pts,t,aa);const bb=featherInto(t,bbRaw,ui.selFeather);
  if(!bb&&!doc.wrap){release(t);if(modeIndex(mode)===0)deselect();return;}
  applyShape(t,mode,bb,label);release(t);}

/* ---- Select menu ---- */
function selectAll(){if(selBusy())return;selRecord('Select all',fullRect(),()=>{clearTarget(sel.t,[1,1,1,1]);sel.bb=fullRect();sel.active=true;});}
function deselect(){if(sel.quick)return;if(!sel.active)return;cancelSelTool();selRecord('Deselect',null,()=>{sel.active=false;});}
function reselect(){if(selBusy())return;if(sel.active)return;if(!sel.bb){toast('There is no earlier selection to bring back.');return;}selRecord('Reselect',null,()=>{sel.active=true;});}
function invertSel(){if(selBusy())return;const had=sel.active;
  selRecord('Invert selection',fullRect(),()=>{const tmp=acquireS();run(P.selop,tmp,{uOld:sel.t.tex,uMode:{int:4},uOldOn:had});blit(tmp,sel.t,0,0,doc.w,doc.h,0,0);release(tmp);sel.bb=fullRect();sel.active=true;});}
function needSel(){if(selBusy())return false;if(!sel.active){toast('Make a selection first.');return false;}return true;}
function modifySel(label,grow,fn){if(!needSel())return;const nb=rToDoc(rGrow(sel.bb,grow));const region=rUnion(sel.bb,nb);
  selRecord(label,region,()=>{const tmp=acquireS();fn(tmp);blit(tmp,sel.t,0,0,doc.w,doc.h,0,0);release(tmp);sel.bb=nb;});}
function featherSel(r){modifySel('Feather selection',Math.ceil(r*1.4)+2,tmp=>gaussian(sel.t,tmp,r));}
function morph(src,dst,r,max){const a=acquireS();run(P.morph,a,{uSrc:src.tex,uDir:[1,0],uR:{int:r},uMax:{int:max?1:0},uWrap:doc.wrap});run(P.morph,dst,{uSrc:a.tex,uDir:[0,1],uR:{int:r},uMax:{int:max?1:0},uWrap:doc.wrap});release(a);}
function expandSel(r){modifySel('Expand selection',r,tmp=>morph(sel.t,tmp,r,true));}
function contractSel(r){modifySel('Contract selection',0,tmp=>morph(sel.t,tmp,r,false));}
function smoothSel(r){modifySel('Smooth selection',0,tmp=>{const b=acquireS();gaussian(sel.t,b,r);run(P.thresh,tmp,{uSrc:b.tex});release(b);});}
/* selection from an image: what = 0 alpha, 1 red, 2 green, 3 blue, 4 luminosity */
function loadSelFrom(tex,what,mode,label,inv){if(selBusy())return;const t=acquireS();run(P.loadsel,t,{uSrc:tex,uWhat:{int:what},uInv:!!inv});applyShape(t,mode,fullRect(),label);release(t);}
function selectLayerPixels(n,mode){n=n||doc.active;if(!n){toast('Select a layer first.');return;}
  if(isLayer(n)){loadSelFrom(n.target.tex,0,mode||'new','Select layer pixels');return;}
  const r=renderNodes(n.children);loadSelFrom(r.tex,0,mode||'new','Select group pixels');release(r);}
function selectMask(n,mode){if(!n||!n.mask){toast('This has no mask.');return;}loadSelFrom(n.mask.target.tex,1,mode||'new','Select mask');}
function freshComposite(){if(dirtyComp){composite();dirtyComp=false;}return compOut;}

/* ---- moving the selection outline ---- */
function shiftSel(src,dx,dy){run(P.shift,sel.t,{uSrc:src.tex,uOff:[dx,dy],uWrap:doc.wrap,uOutside:[0,0,0,1]});}
function nudgeSel(dx,dy){if(!needSel())return;const snap=acquireS();blit(sel.t,snap,0,0,doc.w,doc.h,0,0);const nb=rToDoc([sel.bb[0]+dx,sel.bb[1]+dy,sel.bb[2]+dx,sel.bb[3]+dy]);
  selRecord('Move selection',rUnion(sel.bb,nb),()=>{shiftSel(snap,dx,dy);sel.bb=nb;});release(snap);}
function selValueAt(x,y){if(!sel.active)return 0;x=Math.floor(x);y=Math.floor(y);if(doc.wrap){x=mod(x,doc.w);y=mod(y,doc.h);}if(x<0||y<0||x>=doc.w||y>=doc.h)return 0;
  gl.bindFramebuffer(gl.FRAMEBUFFER,sel.t.fbo);if(sel.t.depth===16){const f=new Float32Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.FLOAT,f);return f[0];}
  const u=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,u);return u[0]/255;}

/* ---- magic wand ---- */
function readRGBA8(t){const W=doc.w,H=doc.h;let src=t,tmp=null;
  if(t.depth===16){tmp=makeTarget(W,H,8,false);run(P.resample,tmp,{uSrc:t.tex,uOffset:[0,0],uScale:[1,1],uTaps:{int:1}});src=tmp;}
  const u=new Uint8Array(W*H*4);gl.bindFramebuffer(gl.FRAMEBUFFER,src.fbo);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,u);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(tmp)disposeTarget(tmp);return u;}
/* returns a W*H mask (255 = picked) of pixels within tol of the clicked colour (premultiplied RGBA, 0-255) */
function wandMask(px,W,H,sx,sy,tol,contig,wrap){const m=new Uint8Array(W*H),j0=(sy*W+sx)*4,r=px[j0],g=px[j0+1],b=px[j0+2],a=px[j0+3];
  const match=i=>{const j=i*4;return Math.abs(px[j]-r)<=tol&&Math.abs(px[j+1]-g)<=tol&&Math.abs(px[j+2]-b)<=tol&&Math.abs(px[j+3]-a)<=tol;};
  if(!contig){for(let i=0;i<W*H;i++)if(match(i))m[i]=255;return m;}
  const st=[sx,sy];
  while(st.length){const y=st.pop(),x=st.pop(),row=y*W;if(m[row+x]||!match(row+x))continue;
    let l=x,len=1;
    while(len<W){const nx=l-1;if(nx<0&&!wrap)break;const q=nx<0?nx+W:nx;if(m[row+q]||!match(row+q))break;l=q;len++;}
    let rr=x;
    while(len<W){const nx=rr+1;if(nx>=W&&!wrap)break;const q=nx>=W?nx-W:nx;if(m[row+q]||!match(row+q))break;rr=q;len++;}
    for(let k=0;k<len;k++){let xx=l+k;if(xx>=W)xx-=W;m[row+xx]=255;}
    for(const dy of [-1,1]){let ny=y+dy;if(ny<0||ny>=H){if(!wrap)continue;ny=(ny+H)%H;}const nrow=ny*W;let prev=false;
      for(let k=0;k<len;k++){let xx=l+k;if(xx>=W)xx-=W;const ok=!m[nrow+xx]&&match(nrow+xx);if(ok&&!prev)st.push(xx,ny);prev=ok;}}}
  return m;}
function maskBounds(m,W,H){let x0=W,y0=H,x1=-1,y1=-1;for(let y=0;y<H;y++){const row=y*W;let any=false;
    for(let x=0;x<W;x++)if(m[row+x]){any=true;if(x<x0)x0=x;break;}
    if(!any)continue;if(y<y0)y0=y;y1=y;for(let x=W-1;x>=0;x--)if(m[row+x]){if(x>x1)x1=x;break;}}
  return x1<0?null:[x0,y0,x1+1,y1+1];}
function magicWand(ix,iy,mode){if(selBusy())return;const W=doc.w,H=doc.h;let x=Math.floor(ix),y=Math.floor(iy);if(doc.wrap){x=mod(x,W);y=mod(y,H);}
  if(x<0||y<0||x>=W||y>=H)return;
  let src;const A=doc.active;
  if(ui.wandAll||!A)src=freshComposite();else if(isLayer(A))src=A.target;else src=null;
  let grp=null;if(!src){grp=renderNodes(A.children);src=grp;}
  const px=readRGBA8(src);if(grp)release(grp);
  const m=wandMask(px,W,H,x,y,Math.round(ui.wandTol),ui.wandContig,doc.wrap);let bb=maskBounds(m,W,H);if(!bb)return;
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,W,H,0,gl.RED,gl.UNSIGNED_BYTE,m);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  const t=acquireS();run(P.rcopy,t,{uSrc:tex,uOff:[0,0]});gl.deleteTexture(tex);
  if(ui.selAA){gaussian(t,t,.7);bb=rToDoc(rGrow(bb,2));}
  bb=featherInto(t,bb,ui.selFeather);applyShape(t,mode,bb,'Magic wand');release(t);}

/* ---- quick mask ---- */
function toggleQuickMask(){if(preview){toast('Apply or cancel the open filter first.');return;}if(stroke)return;cancelSelTool();
  if(!sel.quick){const had=sel.active;
    selRecord('Quick mask',had?null:fullRect(),()=>{if(!had)clearTarget(sel.t,[1,1,1,1]);sel.quick=true;sel.active=false;});
    toast('Quick mask: paint black to hide, white to select. Press Q to turn it into a selection.');}
  else{selRecord('Exit quick mask',null,()=>{sel.quick=false;sel.active=true;sel.bb=fullRect();});}
  refreshQuickUI();}
function refreshQuickUI(){stage.classList.toggle('quick',sel.quick);updateSelStatus();if(typeof renderMaskRow==='function')renderMaskRow();}

/* ---- copy / cut / paste ---- */
let clip=null;
function selectionSource(merged){if(merged)return {t:freshComposite(),et:null};const et=editTarget();
  if(!et){toast(doc.active?'Select a layer (not a group) to copy from, or use Copy merged.':'Select a layer first.');return null;}
  if(et.L.quick){toast('Leave quick mask (Q) before copying.');return null;}return {t:et.target,et};}
function copySel(merged){if(preview){toast('Apply or cancel the open filter first.');return false;}const s=selectionSource(merged);if(!s)return false;
  const r=sel.active&&sel.bb?sel.bb:fullRect(),w=r[2]-r[0],h=r[3]-r[1];if(w<=0||h<=0)return false;
  if(clip)disposeTarget(clip.t);const t=makeTarget(w,h,doc.depth,false);
  run(P.cropsel,t,{uSrc:s.t.tex,uSel:sel.t.tex,uOff:[r[0],r[1]],uUseSel:sel.active});
  clip={t,x:r[0],y:r[1],w,h,marker:'gouache-studio-clip:'+Date.now()};toast((merged?'Copied merged ':'Copied ')+w+' × '+h+'.');return true;}
function cutSel(){if(!copySel(false))return false;clearLayer();return true;}
function pasteClip(){if(!clip){toast('Nothing has been copied yet.');return;}if(preview){toast('Apply or cancel the open filter first.');return;}
  if(ui.mode==='anim'){const F=curFrame();fullRecord(F,'Paste',()=>run(P.shift,F.target,{uSrc:clip.t.tex,uOff:[clip.x,clip.y],uWrap:false,uOutside:[0,0,0,0]},{blend:'over'}),[clip.x,clip.y,Math.min(doc.w,clip.x+clip.w),Math.min(doc.h,clip.y+clip.h)].map((v,i)=>clamp(v,0,i%2?doc.h:doc.w)));toast('Pasted onto this frame.');return;}
  const L=newLayerObj('Pasted');run(P.shift,L.target,{uSrc:clip.t.tex,uOff:[clip.x,clip.y],uWrap:false,uOutside:[0,0,0,0]});
  structOp('Paste',()=>{const [p,i]=insertPoint();insertNode(L,p,i);selectOnly(L);});toast('Pasted as a new layer in the same place.');}
/* Ctrl+J / Ctrl+Shift+J with a selection: the selected pixels onto a new layer */
function layerViaSel(cut){if(ui.mode==='anim'){toast('Layers are not used in Animation mode.');return;}const et=editTarget();if(!et||et.isMask||!isLayer(et.node)){toast('Select a layer to copy from.');return;}if(preview)return;
  const src=et.node,r=sel.bb||fullRect(),x=r[0],y=r[1],w=r[2]-r[0],h=r[3]-r[1];if(w<=0||h<=0)return;
  /* every map of the layer: the selected part is copied (and cut) */
  const L=newLayerObj(src.name+(cut?' (cut)':' (copy)')),keys=mapKeysOf(src),steps=[];L.mapModes=Object.assign({},src.mapModes);
  for(const k of keys)run(P.cropsel,ensureMapTarget(L,k),{uSrc:mapT(src,k).tex,uSel:sel.t.tex,uOff:[0,0],uUseSel:true});L.target=L.maps[doc.map]||emptyFor(mapDepth(doc.map));
  const before=snapTree();
  if(cut)for(const k of keys){const T=mapT(src,k),b=captureRegion(T,x,y,w,h),t=acquireD(T.depth),o=acquireD(T.depth);clearTarget(t);run(P.selmix,o,{uOld:T.tex,uNew:t.tex,uSel:sel.t.tex});blit(o,T,0,0,doc.w,doc.h,0,0);release(t);release(o);steps.push({k,b,a:captureRegion(T,x,y,w,h)});}
  insertNode(L,src.parent,src.parent.children.indexOf(src)+1);selectOnly(L);
  const after=snapTree();
  pushUndo({label:cut?'Layer via cut':'Layer via copy',refs:[...new Set([...layersOfSnap(before),...layersOfSnap(after)])],snaps:steps.flatMap(s=>[s.b,s.a]),
    undo(){restoreTree(before);for(const s of steps)restoreRegion(s.b,mapT(src,s.k),x,y);},redo(){restoreTree(after);for(const s of steps)restoreRegion(s.a,mapT(src,s.k),x,y);}});
  changedAll();}
document.addEventListener('copy',e=>{if(isTypingTarget(e.target))return;e.preventDefault();if(copySel(false)&&e.clipboardData)e.clipboardData.setData('text/plain',clip.marker);});
document.addEventListener('cut',e=>{if(isTypingTarget(e.target))return;e.preventDefault();if(cutSel()&&e.clipboardData)e.clipboardData.setData('text/plain',clip.marker);});
function isTypingTarget(t){const tag=((t&&t.tagName)||'').toLowerCase();return (tag==='input'&&!['range','checkbox','radio','button'].includes(t.type))||tag==='select'||tag==='textarea'||(t&&t.isContentEditable)||!modal.hidden;}
function writeClipMarker(){try{if(clip&&navigator.clipboard)navigator.clipboard.writeText(clip.marker).catch(()=>{});}catch(e){}}
