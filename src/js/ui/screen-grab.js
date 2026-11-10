/* ================= Colours and gradients from anywhere on the screen (0.96.5, Kenn) =================
   "I also want to be able to color pick off-screen" and "a gradient drag, just like in Substance Designer".
   The desktop app copies the whole screen (src-tauri screen.rs; the window steps aside for a moment), then shows the copy over the app:
   click a colour, or drag a line and the colours along it become a gradient, in the order you dragged (as Substance Designer does).
   In a browser the screen is shared through the browser's own screen picker instead. */
async function screenGrab(){
  if(platform.isDesktop){const b=await platform.invoke('screen_grab',{hide:true});const u=b instanceof Uint8Array?b:new Uint8Array(b),dv=new DataView(u.buffer,u.byteOffset);
    const w=dv.getUint32(0,true),h=dv.getUint32(4,true);return {w,h,data:new Uint8ClampedArray(u.buffer,u.byteOffset+8,w*h*4)};}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia)throw new Error('This browser cannot share the screen.');
  const st=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
  try{const v=document.createElement('video');v.srcObject=st;v.muted=true;await v.play();await new Promise(r=>setTimeout(r,250));
    const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const x=c.getContext('2d');x.drawImage(v,0,0);return {w:c.width,h:c.height,data:x.getImageData(0,0,c.width,c.height).data};}
  finally{for(const t of st.getTracks())t.stop();}}
/* the copy over the whole app; mode 'point' (click) or 'line' (drag). done(result) gets [r,g,b] (0..1) or a list of colours */
async function screenGrabPick(mode,done){let shot;try{toast(mode==='line'?'Getting the screen…':'Getting the screen…');shot=await (window.__screenGrab||screenGrab)();}catch(e){if(e&&e.name==='NotAllowedError')return;toast('Could not copy the screen: '+(e.message||e));return;}
  const img=new ImageData(shot.data,shot.w,shot.h),src=document.createElement('canvas');src.width=shot.w;src.height=shot.h;src.getContext('2d').putImageData(img,0,0);
  const ov=el('canvas',{class:'sgrab',id:'sgrabOv'}),dpr=devicePixelRatio||1;ov.width=Math.round(innerWidth*dpr);ov.height=Math.round(innerHeight*dpr);document.body.append(ov);
  const tip=el('div',{class:'gmpicktip sgrabtip',text:mode==='line'?'Drag a line across the colours for the gradient. Esc cancels.':'Click a colour. Esc cancels.'});document.body.append(tip);
  const g=ov.getContext('2d'),s=Math.min(ov.width/shot.w,ov.height/shot.h),ox=(ov.width-shot.w*s)/2,oy=(ov.height-shot.h*s)/2;
  const toShot=e=>[((e.clientX*dpr)-ox)/s,((e.clientY*dpr)-oy)/s];
  const at=(x,y)=>{x=Math.round(x);y=Math.round(y);let r=0,gg=0,b=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const X=x+i,Y=y+j;if(X<0||Y<0||X>=shot.w||Y>=shot.h)continue;const k=(Y*shot.w+X)*4;r+=shot.data[k];gg+=shot.data[k+1];b+=shot.data[k+2];n++;}return n?[r/n/255,gg/n/255,b/n/255]:null;};
  let a=null,bpt=null,hov=null;
  const draw=()=>{g.fillStyle='#000';g.fillRect(0,0,ov.width,ov.height);g.imageSmoothingQuality='high';g.drawImage(src,ox,oy,shot.w*s,shot.h*s);
    if(a&&bpt){g.lineWidth=3*dpr;g.strokeStyle='#000';g.beginPath();g.moveTo(a[0]*s+ox,a[1]*s+oy);g.lineTo(bpt[0]*s+ox,bpt[1]*s+oy);g.stroke();g.lineWidth=1.5*dpr;g.strokeStyle='#fff';g.stroke();}
    if(hov){const c=at(hov[0],hov[1]);if(c){const X=hov[0]*s+ox,Y=hov[1]*s+oy,R=14*dpr;g.fillStyle='rgb('+c.map(v=>Math.round(v*255)).join(',')+')';g.strokeStyle='#fff';g.lineWidth=2*dpr;g.beginPath();g.arc(X+R*1.6,Y-R*1.6,R,0,7);g.fill();g.stroke();}}};
  draw();
  const end=()=>{ov.remove();tip.remove();window.removeEventListener('keydown',key,true);};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();end();}};window.addEventListener('keydown',key,true);
  ov.addEventListener('pointerdown',e=>{e.preventDefault();a=bpt=toShot(e);ov.setPointerCapture(e.pointerId);draw();});
  ov.addEventListener('pointermove',e=>{hov=toShot(e);if(a)bpt=hov;draw();});
  ov.addEventListener('pointerup',e=>{if(!a)return;const A=a,B=bpt;end();
    if(mode==='point'){const c=at(B[0],B[1]);if(c)done(c);return;}
    if(Math.hypot(B[0]-A[0],B[1]-A[1])*s<4*dpr){toast('Drag a line, not a click.');return;}
    const cols=[];for(let i=0;i<64;i++){const t=i/63,c=at(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t);if(c)cols.push(c);}
    if(cols.length<2){toast('Nothing under that line.');return;}done(cols);});}
/* colours along a line → gradient stops in the order they were dragged; a new stop wherever the colour turns */
function sgStops(cols,max){max=max||16;const d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);const keep=[0];
  for(let i=1;i<cols.length-1;i++){const p=cols[keep[keep.length-1]];if(d(cols[i],p)>.06)keep.push(i);}keep.push(cols.length-1);
  while(keep.length>max){let bi=1,bd=1e9;for(let i=1;i<keep.length-1;i++){const v=d(cols[keep[i-1]],cols[keep[i]])+d(cols[keep[i]],cols[keep[i+1]]);if(v<bd){bd=v;bi=i;}}keep.splice(bi,1);}
  return keep.map(i=>({p:i/(cols.length-1),c:cols[i].slice()}));}
