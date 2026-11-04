/* ================= Mixing brush upgrades (0.95) =================
   Kenn: "a mixer brush that's better than Photoshop's": mix ratio with the colour panel, a mixing palette, clean/reload buttons with a preview, mix presets.
   - Mix ratio: one slider from "all canvas colour" to "all colour-panel colour" (it sets the paint on the brush and the pick-up together).
   - Mix presets: Dry, Moist, Wet, Very wet, Oil, in one click.
   - Keep paint between strokes: the brush stays loaded (like Photoshop's Mixer Brush) until you clean it; the Clean and Reload buttons, with a preview of what is on the brush.
   - Mixing palette: a small floating canvas to dab paint on and mix, then pick a colour from it into the colour panel. */
let mixCarry=null;/* {A: the load picture, D: its size, empty: true after Clean} */
function mixCarryInto(A,D){const c=mixCarry;if(!c)return;if(c.empty){clearTarget(A);return;}
  if(c.A&&c.D===D){blit(c.A,A,0,0,D,D,0,0);}}
function mixCarryStore(A,D){if(mixCarry&&mixCarry.A&&mixCarry.A!==A)disposeTarget(mixCarry.A);mixCarry={A,D,empty:false};mixPreviewUpdate();}
function mixClean(){if(mixCarry&&mixCarry.A)disposeTarget(mixCarry.A);mixCarry={A:null,D:0,empty:true};mixPreviewUpdate();toast('The brush is clean.');}
function mixReload(){if(mixCarry&&mixCarry.A)disposeTarget(mixCarry.A);mixCarry=null;mixPreviewUpdate();toast('The brush is loaded with the colour panel colour.');}
/* what is on the brush: an average colour and a picture, drawn into the little preview in the panel */
function mixLoadColours(){const c=mixCarry;if(!c||c.empty||!c.A)return null;const t=c.A,n=t.w*t.h;gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);let f;
  if(t.depth===16){f=new Float32Array(n*4);gl.readPixels(0,0,t.w,t.h,gl.RGBA,gl.FLOAT,f);}else{const u=new Uint8Array(n*4);gl.readPixels(0,0,t.w,t.h,gl.RGBA,gl.UNSIGNED_BYTE,u);f=Float32Array.from(u,v=>v/255);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {f,w:t.w,h:t.h};}
function mixPreviewUpdate(){const cv=document.getElementById('mixPrev');if(!cv)return;const x=cv.getContext('2d'),W=cv.width,H=cv.height;
  x.fillStyle='#2b2b2b';x.fillRect(0,0,W,H);for(let i=0;i<W;i+=8)for(let j=0;j<H;j+=8)if(((i+j)/8)%2){x.fillStyle='#3a3a3a';x.fillRect(i,j,8,8);}
  const L=mixLoadColours();
  if(L){const id=x.createImageData(W,H);for(let j=0;j<H;j++)for(let i=0;i<W;i++){const sx=Math.min(L.w-1,Math.floor(i/W*L.w)),sy=Math.min(L.h-1,Math.floor(j/H*L.h)),k=(sy*L.w+sx)*4,a=L.f[k+3],o=(j*W+i)*4;
      if(a>.01){id.data[o]=Math.min(255,L.f[k]/a*255);id.data[o+1]=Math.min(255,L.f[k+1]/a*255);id.data[o+2]=Math.min(255,L.f[k+2]/a*255);id.data[o+3]=Math.min(255,a*255);}}
    const tmp=document.createElement('canvas');tmp.width=W;tmp.height=H;tmp.getContext('2d').putImageData(id,0,0);x.drawImage(tmp,0,0);}
  else if(!(mixCarry&&mixCarry.empty)){const c=brush.color||[0,0,0],a=clamp(brush.mixLoad==null?1:brush.mixLoad,0,1);x.globalAlpha=a;x.fillStyle='rgb('+c.map(v=>Math.round(v*255)).join(',')+')';x.beginPath();x.arc(W/2,H/2,Math.min(W,H)*.4,0,6.283);x.fill();x.globalAlpha=1;}
  cv.title=L?'The paint on the brush now':(mixCarry&&mixCarry.empty?'The brush is clean':'The brush will load the colour panel colour');}
/* presets: how wet and how thirsty the brush is */
const MIX_FEEL=[['Dry',{mixWet:.08,mixPick:.2,mixUse:.35,mixDryB:.55,mixDry:5,mixThick:.4}],['Moist',{mixWet:.4,mixPick:.45,mixUse:.2,mixDryB:.3,mixDry:20,mixThick:.5}],['Wet',{mixWet:.8,mixPick:.6,mixUse:.12,mixDryB:.15,mixDry:40,mixThick:.5}],['Very wet',{mixWet:1,mixPick:.8,mixUse:.05,mixDryB:0,mixDry:90,mixThick:.2}],['Oil',{mixWet:.9,mixPick:.55,mixUse:.15,mixDryB:.3,mixDry:0,mixThick:.7,mixBristles:30}]];
function mixPanelExtras(S){/* rows for the Brush panel, above the usual mixing sliders */
  const box=el('div',{class:'mixplus'});
  box.append(el('div',{class:'chips'},...MIX_FEEL.map(([n,o])=>el('button',{class:'chip',id:'mixFeel_'+n.replace(' ',''),text:n,title:'Set how wet and how thirsty the brush is',onclick:()=>{Object.assign(brush,o);brushEdited();buildBrushPanel();}}))));
  const ratio=makeSlider({id:'bMxRatio',label:'Mix ratio: canvas ↔ colour panel',min:0,max:1,step:.01,value:clamp(brush.mixLoad==null?.85:brush.mixLoad,0,1),fmt:v=>v<.02?'all canvas':v>.98?'all colour panel':Math.round(v*100)+'% colour panel',onInput:v=>{brush.mixLoad=v;brush.mixPick=clamp(1-v*.7,.15,1);brushEdited();mixPreviewUpdate();}});
  box.append(ratio.el);
  const prev=el('canvas',{id:'mixPrev',width:56,height:56,class:'mixprev'});
  box.append(el('div',{class:'chips'},chk('bMxKeep','Keep paint between strokes',!!brush.mixKeep,v=>{brush.mixKeep=v;brushEdited();if(!v){if(mixCarry&&mixCarry.A)disposeTarget(mixCarry.A);mixCarry=null;}mixPreviewUpdate();})),
    el('div',{class:'frow mixrow'},prev,el('button',{class:'btn sm',id:'mixClean',text:'Clean brush',title:'Wipe the paint off the brush',onclick:mixClean}),el('button',{class:'btn sm',id:'mixReload',text:'Reload',title:'Load the colour panel colour onto the brush',onclick:mixReload}),el('button',{class:'btn sm',id:'mixPalBtn',text:'Mixing palette…',title:'A small area to mix paint on, then pick the colour',onclick:()=>mixPaletteOpen()})));
  setTimeout(mixPreviewUpdate,0);return box;}

/* ---- the mixing palette: a floating canvas ---- */
let mixPal=null;
function palLin(c){return c.map(v=>Math.pow(Math.max(v,0),2.2));}
function palMix(a,b,t){/* between a and b the way paint mixes (partly multiplying, so blue and yellow go towards green), in linear light */
  const A=palLin(a),B=palLin(b),r=[0,0,0];for(let i=0;i<3;i++){const g=Math.exp(Math.log(A[i]+.02)*(1-t)+Math.log(B[i]+.02)*t)-.02,l=A[i]*(1-t)+B[i]*t;r[i]=Math.pow(Math.max(0,g*.6+l*.4),1/2.2);}return r;}
function mixPaletteOpen(){if(mixPal&&mixPal.el.isConnected){mixPal.el.hidden=false;return;}
  const W=560,H=340,cv=el('canvas',{width:W,height:H,id:'palCanvas',class:'palcv'}),x=cv.getContext('2d',{willReadFrequently:true});
  let saved=null;try{saved=localStorage.getItem('gs.mixPal');}catch(e){}
  x.fillStyle='#e9e6df';x.fillRect(0,0,W,H);if(saved){const im=new Image();im.onload=()=>x.drawImage(im,0,0);im.src=saved;}
  const st={mode:'add',size:34},mode=(k,l,t)=>el('button',{class:'btn sm palmode'+(k==='add'?' on':''),id:'pal_'+k,text:l,title:t,onclick:e=>{st.mode=k;for(const b of bar.querySelectorAll('.palmode'))b.classList.toggle('on',b===e.currentTarget);}});
  const size=makeSlider({id:'palSize',label:'Size',min:6,max:120,step:1,value:st.size,fmt:v=>v+' px',onInput:v=>{st.size=v;}});
  const bar=el('div',{class:'palbar'},mode('add','Add paint','Drag to lay your colour panel colour down'),mode('mix','Mix','Drag to stir the paint around'),mode('pick','Pick','Click to take a colour into the colour panel (Alt does this in any mode)'),size.el,
    el('button',{class:'btn sm',id:'palClear',text:'Clear',onclick:()=>{x.fillStyle='#e9e6df';x.fillRect(0,0,W,H);}}),el('button',{class:'btn sm',id:'palClose',text:'Close',onclick:()=>{try{localStorage.setItem('gs.mixPal',cv.toDataURL('image/png'));}catch(e){}root.hidden=true;}}));
  const head=el('div',{class:'palhead',text:'Mixing palette'});
  const root=el('div',{class:'mixpal',role:'dialog','aria-label':'Mixing palette'},head,bar,cv);document.body.append(root);
  root.style.left=Math.max(20,innerWidth/2-W/2)+'px';root.style.top='90px';
  head.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();const r=root.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;const mv=ev=>{root.style.left=clamp(ev.clientX-dx,0,innerWidth-80)+'px';root.style.top=clamp(ev.clientY-dy,0,innerHeight-40)+'px';};const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);};addEventListener('pointermove',mv);addEventListener('pointerup',up);});
  const px=(ix,iy)=>{const d=x.getImageData(clamp(Math.round(ix),0,W-1),clamp(Math.round(iy),0,H-1),1,1).data;return [d[0]/255,d[1]/255,d[2]/255];};
  const at=e=>{const r=cv.getBoundingClientRect();return [(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height];};
  let drag=null;
  cv.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();cv.setPointerCapture(e.pointerId);const [ix,iy]=at(e);
    if(st.mode==='pick'||e.altKey){setFG(px(ix,iy));drag={pick:true};return;}
    drag={last:[ix,iy],carry:px(ix,iy),fg:(typeof ui!=='undefined'&&ui.fg)?ui.fg.slice(0,3):[0,0,0]};dab(drag,ix,iy);});
  cv.addEventListener('pointermove',e=>{if(!drag)return;const [ix,iy]=at(e);if(drag.pick){setFG(px(ix,iy));return;}
    const dx=ix-drag.last[0],dy=iy-drag.last[1],d=Math.hypot(dx,dy),step=Math.max(2,st.size/4);for(let t=step;t<=d;t+=step){dab(drag,drag.last[0]+dx*t/d,drag.last[1]+dy*t/d);}if(d>=step)drag.last=[ix,iy];});
  const end=()=>{drag=null;};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  function dab(dr,cx,cy){const r=st.size/2,x0=Math.max(0,Math.floor(cx-r)),y0=Math.max(0,Math.floor(cy-r)),x1=Math.min(W,Math.ceil(cx+r)),y1=Math.min(H,Math.ceil(cy+r));if(x1<=x0||y1<=y0)return;
    const id=x.getImageData(x0,y0,x1-x0,y1-y0),d=id.data;
    if(st.mode==='mix'){let ar=0,ag=0,ab=0,n=0;for(let k=0;k<d.length;k+=16){ar+=d[k];ag+=d[k+1];ab+=d[k+2];n++;}const avg=[ar/n/255,ag/n/255,ab/n/255];dr.carry=palMix(dr.carry,avg,.3);}
    const col=st.mode==='mix'?dr.carry:dr.fg;
    for(let j=0;j<y1-y0;j++)for(let i=0;i<x1-x0;i++){const q=Math.hypot(x0+i+.5-cx,y0+j+.5-cy)/r;if(q>=1)continue;const w=(1-q*q)*(st.mode==='mix'?.5:.7),k=(j*(x1-x0)+i)*4,old=[d[k]/255,d[k+1]/255,d[k+2]/255],m=palMix(old,col,w);d[k]=m[0]*255;d[k+1]=m[1]*255;d[k+2]=m[2]*255;}
    x.putImageData(id,x0,y0);}
  mixPal={el:root,cv};}
