/* ================= Photo tab: depth map, Lens blur, Relight (0.61) =================
   The depth map is made once per photo (File › AI add-ons: Depth) and saved with the photo's edits. Lens blur blurs by distance from
   the focus you pick; Relight puts a light on the picture and shades it like a surface made from the depth map. */
function phDepthTex(p){if(!p||!p.depth)return null;const d=p.depth;if(p._dtex&&p._dv===d.v)return p._dtex;if(!p._dtex)p._dtex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,p._dtex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,d.w,d.h,0,gl.RED,gl.UNSIGNED_BYTE,d.data);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);p._dv=d.v;return p._dtex;}
async function phDepthEnsure(){const p=phP();if(!p||!p.psrc)return false;if(p.depth)return true;if(phAiNeed(['engine','depth']))return false;
  try{await aiBusy('Measuring depth',async prog=>{const img=aiPixels(p.psrc,1024);prog(.2);const d=await aiDepthRun(img);d.v=1;p.depth=d;});phDirty();return true;}
  catch(err){console.warn(err);toast('The depth map failed: '+(err.message||err));return false;}}
/* the depth map's value (0..100) under a point on the shown picture */
function phDepthAt(ix,iy){const p=phP(),M=phMapper();if(!p||!p.depth||!M)return null;const sp=M.fwd(ix/doc.w,iy/doc.h),d=p.depth,x=clamp(Math.floor(sp[0]*d.w),0,d.w-1),y=clamp(Math.floor(sp[1]*d.h),0,d.h-1);return d.data[y*d.w+x]/255*100;}
async function phLensOn(v){const s=phS();if(v&&!(await phDepthEnsure()))return;s.lens.on=v;phCommit('Lens blur');phBuildPanel();phDirty();}
async function phRelightOn(v){const s=phS();if(v&&!(await phDepthEnsure()))return;s.relight.on=v;phCommit('Relight');phBuildPanel();phDirty();drawXfOverlay();}
function phDSl(obj,key,label,min,max,step,hist,fmt){const sl=makeSlider({id:'phd_'+key,label,min,max,step,value:obj[key],fmt:fmt||(v=>Math.round(v)),onInput:v=>{obj[key]=v;phDirty();drawXfOverlay();phHistLater(hist);},onChange:v=>{obj[key]=v;phDirty();drawXfOverlay();phHistLater(hist);}});return sl.el;}
function phLensPanel(){const s=phS(),L=s.lens,body=[],need=!aiHas('engine')||!aiHas('depth');
  if(need)body.push(el('p',{class:'note',text:'Lens blur needs the AI add-on (File › AI add-ons: Depth).'}),el('div',{class:'phlmbtns'},el('button',{class:'btn sm primary',text:'AI add-ons…',onclick:dlgAddons})));
  body.push(chk('phLensOn','Blur by distance',!!L.on,v=>phLensOn(v)));
  if(L.on)body.push(el('div',{class:'phlmbtns'},el('button',{class:'btn sm',text:'Pick the focus…',title:'Click the part of the picture that stays sharp',onclick:()=>{ph.pick='lensfocus';stage.classList.add('phpicking');toast('Click what should stay sharp.');}})),
    phDSl(L,'focus','Focus distance',0,100,1,'Lens blur'),phDSl(L,'range','In focus range',2,60,1,'Lens blur'),phDSl(L,'amount','Blur amount',0,100,1,'Lens blur'),phDSl(L,'hl','Bright highlights',0,100,1,'Lens blur'),
    chk('phShowDepth','Show the depth map',!!ph.showDepth,v=>{ph.showDepth=v;phDirty();}));
  return body;}
function phRelightPanel(){const s=phS(),R=s.relight,body=[],need=!aiHas('engine')||!aiHas('depth');
  if(need)body.push(el('p',{class:'note',text:'Relight needs the AI add-on (File › AI add-ons: Depth).'}),el('div',{class:'phlmbtns'},el('button',{class:'btn sm primary',text:'AI add-ons…',onclick:dlgAddons})));
  body.push(chk('phRelightOn','Add a light',!!R.on,v=>phRelightOn(v)));
  if(R.on)body.push(el('p',{class:'note',text:'Drag the light on the picture to move it.'}),phDSl(R,'int','Intensity',0,150,1,'Relight'),phDSl(R,'rad','Reach',5,200,1,'Relight'),phDSl(R,'z','Height',0,100,1,'Relight',v=>Math.round(v)),phDSl(R,'dep','Depth strength',0,100,1,'Relight'),phDSl(R,'amb','Darken the rest',0,80,1,'Relight'),phDSl(R,'hue','Colour',0,360,1,'Relight'),phDSl(R,'sat','Colour strength',0,100,1,'Relight'));
  return body;}
/* the light's handle on the picture */
function phRelightOverlay(f){const s=phS();if(ui.mode!=='photo'||ph.crop||!s||!s.relight||!s.relight.on)return '';const M=phMapper();if(!M)return '';const R=s.relight,u=M.inv(R.x,R.y),p0=f([u[0]*doc.w,u[1]*doc.h]).split(' ').map(Number),
  rr=(typeof phRelightR==='function'?phRelightR(M,R):30);return '<circle class="phlm" cx="'+p0[0]+'" cy="'+p0[1]+'" r="'+rr+'" style="opacity:.55"/><circle class="phlmh" cx="'+p0[0]+'" cy="'+p0[1]+'" r="8"/>';}
function phRelightR(M,R){const u=M.inv(R.x,R.y),v=M.inv(R.x,R.y+R.rad/100*.5),a=scrPt([u[0]*doc.w,u[1]*doc.h]),b=scrPt([v[0]*doc.w,v[1]*doc.h]);return Math.max(10,Math.hypot(a[0]-b[0],a[1]-b[1]));}
function phRelightDown(e,ix,iy){const s=phS();if(!s||!s.relight||!s.relight.on||ph.crop||e.button!==0)return false;const M=phMapper();if(!M)return false;const R=s.relight,u=M.inv(R.x,R.y),sp=scrPt([u[0]*doc.w,u[1]*doc.h]),r=stage.getBoundingClientRect();
  if(Math.hypot(e.clientX-r.left-sp[0],e.clientY-r.top-sp[1])>16)return false;ptr={mode:'phrl',id:e.pointerId,M};return true;}
function phRelightMove(ix,iy){const R=phS().relight,sp=ptr.M.fwd(ix/doc.w,iy/doc.h);R.x=clamp(sp[0],-.2,1.2);R.y=clamp(sp[1],-.2,1.2);phDirty();drawXfOverlay();}
function phRelightUp(){ptr=null;phCommit('Move light');phSidecarSoon();drawXfOverlay();}
function phDepthPack(p){if(!p.depth)return null;const d=p.depth;if(!d.png||d.pngV!==d.v){const c=document.createElement('canvas');c.width=d.w;c.height=d.h;const x=c.getContext('2d'),id=x.createImageData(d.w,d.h);for(let i=0;i<d.w*d.h;i++){id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=d.data[i];id.data[i*4+3]=255;}x.putImageData(id,0,0);d.png=c.toDataURL('image/png');d.pngV=d.v;}return d.png;}
async function phDepthUnpack(p,png){if(!png||p.depth)return;try{const bm=await createImageBitmap(await (await fetch(png)).blob()),c=new OffscreenCanvas(bm.width,bm.height),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bm,0,0);const d=x.getImageData(0,0,bm.width,bm.height).data,data=new Uint8Array(bm.width*bm.height);for(let i=0;i<data.length;i++)data[i]=d[i*4];p.depth={w:bm.width,h:bm.height,data,v:1,png};phDirty();}catch(e){console.warn('depth not read',e);}}
