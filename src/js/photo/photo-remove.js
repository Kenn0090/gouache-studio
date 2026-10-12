/* ================= Photo tab: Remove (LaMa) =================
   Paint over something you want gone. The model fills the gap from what is around it. The result is a small patch (a 512 px picture
   with a soft edge) placed on the photo's own axes, so it is drawn on the preview and again at full size on export. The list of
   patches is part of the photo's settings (s.rm), so Undo works; the patch pictures are kept in PH_PATCH and saved with the photo. */
const PH_PATCH={};
ph.rm={on:false,size:.04,pts:null,docPts:null};
const FS_PHPATCH=`uniform sampler2D uP; uniform vec4 uR; uniform vec2 uSz;
void main(){ vec2 uv=gl_FragCoord.xy/uSz; vec2 l=(uv-uR.xy)/uR.zw; if(l.x<0.0||l.y<0.0||l.x>1.0||l.y>1.0){ o=vec4(0.0); return; } vec4 c=texture(uP,l); o=vec4(c.rgb*c.a,c.a); }`;
let phPatchProg=null;
/* draw the listed patches onto a target (preview picture or full-size picture) */
function phRmApply(target,list){if(!list||!list.length)return;if(!phPatchProg)phPatchProg=program(FS_PHPATCH);
  for(const id of list){const q=PH_PATCH[id];if(!q)continue;if(!q.tex){q.tex=uploadStraight({w:512,h:512,data:q.rgba});}run(phPatchProg,target,{uP:q.tex,uR:q.rect,uSz:[target.w,target.h]},{blend:'over'});}}
/* keep the preview picture in step with the list of patches */
function phRmSync(p){const key=(p.s.rm||[]).join(',');if((p._rmKey||'')===key&&p.psrc)return;
  if(!p.psrc)return;
  if(key&&!p.psrc0){p.psrc0=makeTarget(p.psrc.w,p.psrc.h,p.psrc.depth,false);blit(p.psrc,p.psrc0,0,0,p.psrc.w,p.psrc.h,0,0);}
  if(p.psrc0){blit(p.psrc0,p.psrc,0,0,p.psrc.w,p.psrc.h,0,0);phRmApply(p.psrc,p.s.rm);}
  p._rmKey=key;p._sam=null;phFreeCache();}
/* the stroke, its box, and what the model needs */
function phRmDown(e,ix,iy){const r=ph.rm;if(!r.on||ph.crop||e.button!==0)return false;const M=phMapper();if(!M)return false;if(phAiNeed(['engine','lama'])){r.on=false;phBuildPanel();return true;}
  const sp=M.fwd(ix/doc.w,iy/doc.h);r.pts=[sp];r.docPts=[[ix,iy]];ptr={mode:'phrm',id:e.pointerId,M};drawXfOverlay();return true;}
function phRmMove(ix,iy){const r=ph.rm,M=ptr.M,sp=M.fwd(ix/doc.w,iy/doc.h),l=r.pts[r.pts.length-1];if(Math.hypot((sp[0]-l[0])*M.ar,sp[1]-l[1])>r.size*.1){r.pts.push(sp);r.docPts.push([ix,iy]);drawXfOverlay();}}
function phRmUp(){const r=ph.rm,pts=r.pts;ptr=null;r.pts=null;r.docPts=null;drawXfOverlay();if(pts&&pts.length)phRmRun(pts).catch(e=>{console.warn(e);toast('Remove failed: '+(e.message||e));});}
function phRmOverlay(f){const r=ph.rm;if(ui.mode!=='photo'||ph.crop||!r.on)return '';const M=phMapper();if(!M)return '';let s='';
  if(r.docPts&&r.docPts.length){const pr=Math.max(2,phRmScreenR());s+='<path class="phrm" d="'+r.docPts.map((q,i)=>(i?'L':'M')+f(q)).join('')+'" style="stroke-width:'+(pr*2).toFixed(1)+'px"/>';}
  else if(ph.lm.cur){const [x,y]=f(ph.lm.cur).split(' ').map(Number);s+='<circle class="phlm" cx="'+x+'" cy="'+y+'" r="'+Math.max(2,phRmScreenR())+'"/>';}return s;}
function phRmScreenR(){const M=phMapper();if(!M)return 5;const a=scrPt([doc.w/2,doc.h/2]),sp=M.fwd(.5,.5),q=M.inv(sp[0],sp[1]+ph.rm.size/2),b=scrPt([q[0]*doc.w,q[1]*doc.h]);return Math.hypot(b[0]-a[0],b[1]-a[1]);}
async function phRmRun(pts){const p=phP();if(!p||!p.psrc)return;
  await aiBusy('Removing',async prog=>{const W=p.pw,H=p.ph,r=ph.rm,rad=r.size*H/2;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const q of pts){x0=Math.min(x0,q[0]*W-rad);y0=Math.min(y0,q[1]*H-rad);x1=Math.max(x1,q[0]*W+rad);y1=Math.max(y1,q[1]*H+rad);}
    const side=Math.min(Math.min(W,H),Math.max(192,Math.max(x1-x0,y1-y0)*2.2)),cx=(x0+x1)/2,cy=(y0+y1)/2,sx=clamp(cx-side/2,0,W-side),sy=clamp(cy-side/2,0,H-side),S=512,k=S/side;
    const img=aiPixels(p.psrc,Math.max(W,H)),c=new OffscreenCanvas(img.w,img.h);c.getContext('2d').putImageData(new ImageData(img.data,img.w,img.h),0,0);
    const cc=new OffscreenCanvas(S,S),cx2=cc.getContext('2d',{willReadFrequently:true});cx2.imageSmoothingQuality='high';cx2.drawImage(c,sx,sy,side,side,0,0,S,S);const px=cx2.getImageData(0,0,S,S).data;
    const mc=new OffscreenCanvas(S,S),mx=mc.getContext('2d',{willReadFrequently:true});mx.fillStyle='#000';mx.fillRect(0,0,S,S);mx.strokeStyle=mx.fillStyle='#fff';mx.lineCap='round';mx.lineJoin='round';mx.lineWidth=rad*2*k;
    mx.beginPath();pts.forEach((q,i)=>{const X=(q[0]*W-sx)*k,Y=(q[1]*H-sy)*k;if(i)mx.lineTo(X,Y);else mx.moveTo(X,Y);});if(pts.length===1){mx.arc((pts[0][0]*W-sx)*k,(pts[0][1]*H-sy)*k,rad*k,0,7);mx.fill();}else mx.stroke();
    const md=mx.getImageData(0,0,S,S).data,hole=new Uint8Array(S*S);for(let i=0;i<S*S;i++)hole[i]=md[i*4]>127?255:0;
    const grown=phMaxFilter(hole,S,S,Math.max(3,Math.round(S*.012))),ort=await aiEngine(),sess=await aiSession('lama','lama.onnx'),f=new Float32Array(3*S*S),mk=new Float32Array(S*S);
    for(let i=0;i<S*S;i++){f[i]=px[i*4]/255;f[S*S+i]=px[i*4+1]/255;f[2*S*S+i]=px[i*4+2]/255;mk[i]=grown[i]>127?1:0;}prog(.2);
    const out=await sess.run({image:new ort.Tensor('float32',f,[1,3,S,S]),mask:new ort.Tensor('float32',mk,[1,1,S,S])}),o=out.output.data;prog(.9);
    const soft=phBoxBlur(grown,S,S,Math.max(2,Math.round(S*.008))),rgba=new Uint8ClampedArray(S*S*4);
    for(let i=0;i<S*S;i++){rgba[i*4]=o[i];rgba[i*4+1]=o[S*S+i];rgba[i*4+2]=o[2*S*S+i];rgba[i*4+3]=Math.max(soft[i],grown[i]>127&&soft[i]>200?soft[i]:soft[i]);}
    const id='r'+Date.now().toString(36)+Math.floor(Math.random()*999);PH_PATCH[id]={rect:[sx/W,sy/H,side/W,side/H],rgba,v:1};
    const s=phS();if(!s.rm)s.rm=[];s.rm.push(id);phCommit('Remove');phRmSync(p);phDirty();phBuildPanel();});}
function phRmPanel(){const r=ph.rm,s=phS(),list=(s&&s.rm)||[],need=!aiHas('engine')||!aiHas('lama'),body=[];
  if(need)body.push(el('p',{class:'note',text:'Remove needs the AI add-on (File › AI add-ons).'}),el('div',{class:'phlmbtns'},el('button',{class:'btn sm primary',text:'AI add-ons…',onclick:dlgAddons})));
  body.push(el('div',{class:'phlmbtns'},el('button',{class:'btn sm'+(r.on?' primary':''),id:'phRmTool',text:r.on?'Done':'Remove…',title:'Paint over what you want gone',onclick:()=>{if(!r.on&&phAiNeed(['engine','lama']))return;r.on=!r.on;if(r.on){ph.pick=null;ph.sp.tool=false;ph.lm.tool=null;}stage.classList.toggle('phpicking',r.on);phBuildPanel();if(r.on)toast('Paint over the thing to remove.');}})),
    phLGen(null,()=>r.size*100,v=>{r.size=v/100;},'Brush size',.5,15,.1,v=>v.toFixed(1)));
  if(!list.length)body.push(el('p',{class:'note',text:'Press “Remove…”, then paint over a person, wire, spot or object. Each removal can be undone.'}));
  list.forEach((id,i)=>body.push(el('div',{class:'phlmrow'},el('span',{class:'phlmname',text:'Removal '+(i+1)}),el('button',{class:'btn sm',text:'×','aria-label':'Undo this removal',onclick:()=>{const n=phClone(phS());n.rm=n.rm.filter(x=>x!==id);phApply(n,'Undo removal');}}))));
  return body;}
function phRmPack(p){const out={};for(const id of (p.s.rm||[])){const q=PH_PATCH[id];if(!q)continue;if(!q.png){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.putImageData(new ImageData(new Uint8ClampedArray(q.rgba),512,512),0,0);q.png=c.toDataURL('image/png');}out[id]={r:q.rect,png:q.png};}return out;}
async function phRmUnpack(o){if(!o)return;for(const id of Object.keys(o)){if(PH_PATCH[id])continue;try{const bm=await createImageBitmap(await (await fetch(o[id].png)).blob()),c=new OffscreenCanvas(512,512),x=c.getContext('2d',{willReadFrequently:true});x.clearRect(0,0,512,512);x.drawImage(bm,0,0);PH_PATCH[id]={rect:o[id].r,rgba:x.getImageData(0,0,512,512).data,v:1,png:o[id].png};}catch(e){console.warn('patch not read',e);}}const p=phP();if(p)p._rmKey=null;phDirty();}
