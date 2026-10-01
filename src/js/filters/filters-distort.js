/* ================= Warp, Slope blur, Distort (0.27) =================
   Kenn: Distort and Warp filters, plus Slope blur like Substance Painter/Designer, to push things further and to give
   generated masks irregularity. They work on any layer (Filter menu, Filter Gallery, filter layers, material and
   mask effects). Seamless (tile mode) documents wrap around the edges. */
const FXD_FS={
  /* warp: every pixel is pushed by a smooth noise (1 = turbulent, sharper folds) */
  warp:()=>FX2_H+`uniform sampler2D uSrc; uniform float uAmt; uniform float uSize; uniform float uSeed; uniform int uMode; uniform int uWrap;
vec2 wr(vec2 p,vec2 sz){ return uWrap==1?mod(p,sz):clamp(p,vec2(0.5),sz-0.5); }
void main(){ vec2 p=gl_FragCoord.xy,sz=SZ(uSrc),q=p/max(uSize,1.0)+uSeed*3.7;
  vec2 d=vec2(fbm(q),fbm(q+vec2(5.2,1.3)))-0.5;
  if(uMode==1){ d=vec2(abs(fbm(q*1.7+2.0)-0.5),abs(fbm(q*1.7+9.0)-0.5))*2.0-0.5; d+=vec2(fbm(q+d*3.0),fbm(q+d*3.0+4.4))-0.5; }
  o=at(uSrc,wr(p+d*2.0*uAmt,sz)); }`,
  /* slope blur: smears along the slope of a guide (the image's own brightness, or a noise), downhill;
     Blur averages, Min keeps the darkest, Max the brightest (Substance's modes) */
  slope:()=>FX2_H+`uniform sampler2D uSrc; uniform float uAmt; uniform int uSteps; uniform int uMode; uniform int uGuide; uniform float uSize; uniform float uSeed; uniform int uWrap; uniform sampler2D uGImg; uniform float uGTile; uniform float uGInv;
vec2 wr(vec2 p,vec2 sz){ return uWrap==1?mod(p,sz):clamp(p,vec2(0.5),sz-0.5); }
float gd(vec2 p,vec2 sz){ if(uGuide==1) return fbm(p/max(uSize,1.0)+uSeed*3.7);
  if(uGuide==2){ vec2 gs=SZ(uGImg); vec2 u=fract(p/sz*uGTile); vec4 c=at(uGImg,u*gs); float l=dot(st(c),vec3(0.299,0.587,0.114))*c.a; return uGInv>0.5?1.0-l:l; } vec4 c=at(uSrc,wr(p,sz)); return dot(st(c),vec3(0.299,0.587,0.114))*c.a; }
void main(){ vec2 p=gl_FragCoord.xy,sz=SZ(uSrc); float e=uGuide==1?max(uSize*0.08,1.0):1.5;
  vec2 g=vec2(gd(p+vec2(e,0.0),sz)-gd(p-vec2(e,0.0),sz),gd(p+vec2(0.0,e),sz)-gd(p-vec2(0.0,e),sz));
  vec2 dir=length(g)>1e-6?-normalize(g):vec2(0.0); vec4 acc=at(uSrc,p),mn=acc,mx=acc; float n=1.0;
  for(int i=1;i<=64;i++){ if(i>uSteps) break; vec2 q=p+dir*uAmt*float(i)/float(uSteps); vec4 c=at(uSrc,wr(q,sz)); acc+=c; n+=1.0; mn=min(mn,c); mx=max(mx,c); }
  o=uMode==1?mn:uMode==2?mx:acc/n; }`,
  /* distort: waves, ripples, a twirl, or a pinch/bulge around the middle */
  distort:()=>FX2_H+`uniform sampler2D uSrc; uniform int uKind; uniform float uAmt; uniform float uSize; uniform float uAng; uniform vec2 uC; uniform int uWrap;
vec2 wr(vec2 p,vec2 sz){ return uWrap==1?mod(p,sz):clamp(p,vec2(0.5),sz-0.5); }
void main(){ vec2 p=gl_FragCoord.xy,sz=SZ(uSrc),c=uC*sz,d=p-c; float R=0.5*min(sz.x,sz.y),r=length(d); vec2 q=p;
  if(uKind==0){ vec2 t=rot(p,-uAng); t.y+=sin(t.x/max(uSize,1.0)*6.2831853)*uAmt; t.x+=sin(t.y/max(uSize,1.0)*6.2831853)*uAmt*0.35; q=rot(t,uAng); }
  else if(uKind==1){ float w=sin(r/max(uSize,1.0)*6.2831853)*uAmt; q=p+(r>1e-3?d/r:vec2(0.0))*w; }
  else if(uKind==2){ float f=clamp(1.0-r/R,0.0,1.0); q=c+rot(d,uAmt*0.0349066*f*f); }
  else { float f=clamp(r/R,0.0,1.0); float k=pow(f,1.0+clamp(uAmt,-0.95,0.95)*0.9*(uAmt>0.0?1.0:1.5)); q=r>1e-3&&f<1.0?c+d/r*k*R:p; }
  o=at(uSrc,wr(q,sz)); }`};
let PXD=null;const pxd=k=>{if(!PXD)PXD={};return PXD[k]||(PXD[k]=program(FXD_FS[k]()));};
const fxdWrap=()=>({int:doc.wrap?1:0});
fxDef('warp',{title:'Warp',note:'Pushes the picture around with a smooth noise: wobbly edges, organic breakup. Turbulent folds it harder.',init:()=>({mode:'smooth'}),
  defs:[{key:'amt',label:'Amount',min:0,max:120,step:.5,value:12,fmt:px},{key:'size',label:'Noise size',min:4,max:600,step:1,value:80,fmt:px},{key:'seed',label:'Seed',min:1,max:99,step:1,value:1,fmt:v=>String(v)}],
  controls:(v,upd)=>[modeSeg(v,'mode',[['smooth','Smooth'],['turb','Turbulent']],upd,'Warp kind')],
  render(src,dst,v){run(pxd('warp'),dst,{uSrc:src.tex,uAmt:v.amt,uSize:v.size,uSeed:v.seed,uMode:{int:v.mode==='turb'?1:0},uWrap:fxdWrap()});}});
/* (0.39, Kenn) the slope can come from a picture: drop one on the box, or pick from the Textures library */
function fxdAllTex(){return [...tx.mine.map(rec=>({kind:'mine',id:rec.id,name:rec.name,rec})),...TX_PHOTO.map(([id,name])=>({kind:'photo',id,name})),...TX_GEN.map(([id,name])=>({kind:'gen',id,name}))];}
function fxdGuideTex(v){const g=v.gimg;if(!g)return null;txCachePin(g);const key=g.kind+':'+g.id,t=txCacheGet(key);if(t)return t;
  if(!g._busy){g._busy=true;txLoad().then(()=>{const it=fxdAllTex().find(x=>x.kind===g.kind&&x.id===g.id);return it&&txTarget(it);}).then(r=>{g._busy=false;if(r)changedAll();}).catch(()=>{g._busy=false;});}
  return null;}
function fxdPickTexture(done){txLoad().then(()=>{const items=fxdAllTex();
  const grid=el('div',{class:'fxdpick'},...items.map(it=>{const img=el('img',{alt:'',width:64,height:64,draggable:'false'});img._tx=it;txObserve(img);
    return el('button',{class:'mattile txtile',type:'button',title:it.name,onclick:()=>{txForget(grid);closeDialog();done({kind:it.kind,id:it.id,name:it.name});}},img,el('span',{text:it.name}));}));
  openDialog({title:'Pick a texture',body:grid,okLabel:'Close',onOk:()=>txForget(grid),onCancel:()=>txForget(grid)});txPruneObserved();});}
async function fxdDropFiles(files,done){const f=[...files].find(x=>/^image\//.test(x.type)||/\.(png|jpe?g|webp|tga|bmp|tiff?)$/i.test(x.name));if(!f)return;
  let t;try{await txLoad();t=await fileTarget(f);const rec=await txAddTarget(t,baseName(f.name));t=null;if(typeof renderTextures==='function')renderTextures();done({kind:'mine',id:rec.id,name:rec.name});}catch(e){if(t)disposeTarget(t);toast('Could not read that picture: '+(e.message||e));}}
function fxdGuideRow(v,upd){const name=el('span',{class:'note',text:v.gimg?v.gimg.name:'No picture yet'});
  const set=g=>{v.gimg=g;txCachePin(g);name.textContent=g.name;txLoad().then(()=>{const it=fxdAllTex().find(x=>x.kind===g.kind&&x.id===g.id);return it&&txTarget(it);}).then(()=>upd()).catch(e=>toast('Could not read that texture: '+(e.message||e)));};
  const drop=el('div',{class:'fxddrop',id:'fxdDrop',tabindex:'0',title:'Drop a picture here'},el('b',{text:'Drop a picture'}),el('small',{text:'or click to browse'}));
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');fxdDropFiles(e.dataTransfer.files,set);});
  drop.addEventListener('click',async()=>{const fs=await pickFiles('image/*',false,'Pictures',['png','jpg','jpeg','webp','tga','bmp','tif','tiff']);if(fs&&fs.length)fxdDropFiles(fs,set);});
  return el('div',{class:'fxdguide',id:'fxdGuide'},drop,el('div',{class:'chips'},el('button',{class:'btn sm',id:'fxdLib',text:'Choose from Textures…',onclick:()=>fxdPickTexture(set)}),name),
    chk('fxdInv','Flip the slope',!!v.ginv,x=>{v.ginv=x;upd();}));}
fxDef('slopeBlur',{title:'Slope blur',note:'Smears the picture downhill along a slope (like Substance): its own brightness, a noise, or a picture you choose. Min eats into bright parts, Max grows them.',init:()=>({mode:'blur',guide:'self',gimg:null,ginv:false}),
  defs:[{key:'amt',label:'Intensity',min:0,max:200,step:.5,value:16,fmt:px},{key:'steps',label:'Samples',min:4,max:64,step:1,value:16,fmt:v=>String(v)},{key:'size',label:'Noise size',min:4,max:600,step:1,value:60,fmt:px},{key:'seed',label:'Seed',min:1,max:99,step:1,value:1,fmt:v=>String(v)},{key:'gtile',label:'Picture repeat',min:1,max:8,step:1,value:1,fmt:v=>v+'×'}],
  controls:(v,upd)=>{const row=fxdGuideRow(v,upd);row.hidden=v.guide!=='image';
    const gs=seg([['self','Its own slope'],['noise','Noise'],['image','A picture']],v.guide,x=>{v.guide=x;row.hidden=x!=='image';upd();},'Slope from');
    return [modeSeg(v,'mode',[['blur','Blur'],['min','Min'],['max','Max']],upd,'Slope blur mode'),gs,row];},
  render(src,dst,v){const gt=v.guide==='image'?fxdGuideTex(v):null;run(pxd('slope'),dst,{uSrc:src.tex,uAmt:v.amt,uSteps:{int:Math.round(v.steps)},uMode:{int:v.mode==='min'?1:v.mode==='max'?2:0},uGuide:{int:(v.guide==='image'&&gt)?2:v.guide==='noise'?1:0},uSize:v.size,uSeed:v.seed,uWrap:fxdWrap(),uGImg:(gt||src).tex,uGTile:v.gtile||1,uGInv:v.ginv?1:0});}});
fxDef('distort',{title:'Distort',note:'Waves, ripples, a twirl, or a pinch or bulge around the middle.',init:()=>({kind:'waves'}),
  defs:[{key:'amt',label:'Amount',min:-100,max:100,step:.5,value:10,fmt:v=>String(v)},{key:'size',label:'Wave length',min:4,max:600,step:1,value:60,fmt:px},{key:'ang',label:'Angle',min:-180,max:180,step:1,value:0,fmt:deg},
    {key:'cx',label:'Centre across',min:0,max:1,step:.01,value:.5,fmt:pct},{key:'cy',label:'Centre down',min:0,max:1,step:.01,value:.5,fmt:pct}],
  controls:(v,upd)=>[modeSeg(v,'kind',[['waves','Waves'],['ripple','Ripple'],['twirl','Twirl'],['pinch','Pinch / bulge']],upd,'Distort kind')],
  render(src,dst,v){const k=['waves','ripple','twirl','pinch'].indexOf(v.kind);run(pxd('distort'),dst,{uSrc:src.tex,uKind:{int:Math.max(0,k)},uAmt:k===3?v.amt/100:v.amt,uSize:v.size,uAng:rad(v.ang),uC:[v.cx,1-v.cy],uWrap:fxdWrap()});}});
