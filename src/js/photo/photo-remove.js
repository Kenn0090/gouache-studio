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
    const img=aiPixels(p.psrc,Math.max(W,H)),mc=new OffscreenCanvas(img.w,img.h),mx=mc.getContext('2d',{willReadFrequently:true});mx.fillStyle='#000';mx.fillRect(0,0,img.w,img.h);mx.strokeStyle=mx.fillStyle='#fff';mx.lineCap='round';mx.lineJoin='round';mx.lineWidth=rad*2*img.w/W;
    const X=q=>q[0]*img.w,Y=q=>q[1]*img.h;mx.beginPath();pts.forEach((q,i)=>{if(i)mx.lineTo(X(q),Y(q));else mx.moveTo(X(q),Y(q));});if(pts.length===1){mx.arc(X(pts[0]),Y(pts[0]),rad*img.w/W,0,7);mx.fill();}else mx.stroke();
    const md=mx.getImageData(0,0,img.w,img.h).data,hole=new Uint8Array(img.w*img.h);for(let i=0;i<hole.length;i++)hole[i]=md[i*4]>127?255:0;
    const k=img.w/W,patch=await aiInpaintPatch(img,hole,[Math.max(0,x0*k),Math.max(0,y0*k),Math.min(img.w,x1*k),Math.min(img.h,y1*k)],prog);
    const id='r'+Date.now().toString(36)+Math.floor(Math.random()*999);PH_PATCH[id]={rect:patch.rect,rgba:patch.rgba,v:1};
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
