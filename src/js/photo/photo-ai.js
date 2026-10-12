/* ================= Photo tab: the AI tools (0.61) =================
   Select subject (click an object; more clicks refine, Alt-click = "not this"), Select sky. The result is a mask like the others
   (its own sliders, Invert, range) kept as a small grey picture. Needs File › AI add-ons. */
const PH_AIMASK=1024;
ph.ai={mask:null};
function phAiDims(ar){return ar>=1?[PH_AIMASK,Math.max(2,Math.round(PH_AIMASK/ar))]:[Math.max(2,Math.round(PH_AIMASK*ar)),PH_AIMASK];}
function phAiPrep(){const p=phP();if(!p||!p.psrc)throw new Error('Open a photo first.');return p;}
/* the embedding of this photo's picture, made once and kept for further clicks */
async function phAiEmbed(p){if(p._sam&&p._sam.src===p.psrc)return p._sam;const img=aiPixels(p.psrc,SAM_SIDE),E=await aiSamEmbed(img);E.img=img;E.src=p.psrc;p._sam=E;return E;}
function phAiAdd(name,mask,pts){const p=phP(),ar=p.pw/p.ph,[W,H]=[mask.w,mask.h],id='m'+Date.now().toString(36)+Math.floor(Math.random()*999),aid='a'+id;
  PH_AI[aid]={w:W,h:H,data:mask.data,v:1};const m={id,type:'ai',aid,name:name,on:true,inv:false,amt:100,feather:50,adj:{exp:-.5},rng:{kind:'none',lo:0,hi:100,soft:30,h:0,hr:30},pts:pts||[]};
  phMasks().push(m);ph.open.local=true;ph.lm.sel=id;ph.lm.tool=null;phCommit('AI selection');phBuildPanel();phDirty();drawXfOverlay();return m;}
function phAiNeed(parts){const miss=parts.filter(i=>!aiHas(i));if(!miss.length)return false;toast('This needs the AI add-on. Opening File › AI add-ons…');dlgAddons();return true;}
async function phAiClick(ix,iy,e){const p=phP(),M=phMapper();if(!p||!M)return;if(phAiNeed(['engine','sam'])){ph.pick=null;return;}
  const sp=M.fwd(ix/doc.w,iy/doc.h);if(sp[0]<0||sp[0]>1||sp[1]<0||sp[1]>1)return;const neg=!!(e&&e.altKey);
  try{await aiBusy('Selecting',async prog=>{const E=await phAiEmbed(p);prog(.6);const cur=ph.ai&&ph.ai.mask&&phMasks().includes(ph.ai.mask)?ph.ai.mask:null,pts=(cur?cur.pts:[]).concat([{x:sp[0],y:sp[1],pos:!neg}]);
    const [W,H]=phAiDims(p.pw/p.ph),m=await aiSamMask(E,pts.map(q=>({x:q.x*E.w,y:q.y*E.h,pos:q.pos})),W,H);
    if(cur){const a=PH_AI[cur.aid];a.w=W;a.h=H;a.data=m.data;a.v++;cur.pts=pts;phCommit('Refine selection');phDirty();}
    else{const mk=phAiAdd('Subject',m,pts);ph.ai={mask:mk};}});}
  catch(err){console.warn(err);toast('Select subject failed: '+(err.message||err));}}
async function phAiSky(){const p=phP();if(!p)return;if(phAiNeed(['engine','sam']))return;
  try{await aiBusy('Finding the sky',async prog=>{const E=await phAiEmbed(p);prog(.3);const [W,H]=phAiDims(p.pw/p.ph),r=await aiSkyMask(E,W,H);if(!r){toast('No clear sky found in this photo.');return;}
    const mk=phAiAdd('Sky',r.mask,r.points.map(q=>({x:q.x/E.w,y:q.y/E.h,pos:q.pos})));ph.ai={mask:null};mk.adj={exp:-.4,sat:15};phDirty();phBuildPanel();});}
  catch(err){console.warn(err);toast('Select sky failed: '+(err.message||err));}}
function phAiStopTool(){ph.pick=null;stage.classList.remove('phpicking');ph.ai={mask:null};phBuildPanel();}
function phAiPanel(){const body=[],need=!aiHas('engine')||!aiHas('sam');
  if(need)body.push(el('p',{class:'note',text:'The AI tools need a download (File › AI add-ons). Everything runs on this computer.'}),el('div',{class:'phlmbtns'},el('button',{class:'btn sm primary',text:'AI add-ons…',onclick:dlgAddons})));
  const on=ph.pick==='aisubject';
  body.push(el('div',{class:'phlmbtns'},el('button',{class:'btn sm'+(on?' primary':''),id:'phAiSubject',text:on?'Done picking':'Select subject…',title:'Click an object. Click more to add, Alt+click to take away.',onclick:()=>{if(on){phAiStopTool();return;}if(phAiNeed(['engine','sam']))return;ph.ai={mask:null};ph.pick='aisubject';stage.classList.add('phpicking');phBuildPanel();toast('Click the subject. Click more to refine; Alt+click takes an area away.');}}),
    el('button',{class:'btn sm',id:'phAiSky',text:'Select sky',title:'Find the sky and make a mask of it',onclick:phAiSky})));
  body.push(el('p',{class:'note',text:'The selection is a mask in the Masks section: change its sliders, Invert it to work on everything else.'}));
  return body;}
/* the masks' pictures travel with the photo's saved edits */
function phAiPack(p){const out={};for(const m of (p.s.local||[]))if(m.type==='ai'&&PH_AI[m.aid]){const a=PH_AI[m.aid];if(!a.png||a.pngV!==a.v){const c=document.createElement('canvas');c.width=a.w;c.height=a.h;const x=c.getContext('2d'),id=x.createImageData(a.w,a.h);for(let i=0;i<a.w*a.h;i++){id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=255;id.data[i*4+3]=a.data[i];}x.putImageData(id,0,0);a.png=c.toDataURL('image/png');a.pngV=a.v;}out[m.aid]=a.png;}return out;}
async function phAiUnpack(o){if(!o)return;for(const aid of Object.keys(o)){if(PH_AI[aid])continue;try{const bm=await createImageBitmap(await (await fetch(o[aid])).blob()),c=new OffscreenCanvas(bm.width,bm.height),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bm,0,0);const d=x.getImageData(0,0,bm.width,bm.height).data,data=new Uint8Array(bm.width*bm.height);for(let i=0;i<data.length;i++)data[i]=d[i*4+3];PH_AI[aid]={w:bm.width,h:bm.height,data,v:1};}catch(e){console.warn('AI mask not read',e);}}phDirty();}

