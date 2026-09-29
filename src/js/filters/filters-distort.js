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
  slope:()=>FX2_H+`uniform sampler2D uSrc; uniform float uAmt; uniform int uSteps; uniform int uMode; uniform int uGuide; uniform float uSize; uniform float uSeed; uniform int uWrap;
vec2 wr(vec2 p,vec2 sz){ return uWrap==1?mod(p,sz):clamp(p,vec2(0.5),sz-0.5); }
float gd(vec2 p,vec2 sz){ if(uGuide==1) return fbm(p/max(uSize,1.0)+uSeed*3.7); vec4 c=at(uSrc,wr(p,sz)); return dot(st(c),vec3(0.299,0.587,0.114))*c.a; }
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
fxDef('slopeBlur',{title:'Slope blur',note:'Smears the picture downhill along a slope (like Substance): its own brightness, or a noise. Min eats into bright parts, Max grows them.',init:()=>({mode:'blur',guide:'self'}),
  defs:[{key:'amt',label:'Intensity',min:0,max:200,step:.5,value:16,fmt:px},{key:'steps',label:'Samples',min:4,max:64,step:1,value:16,fmt:v=>String(v)},{key:'size',label:'Noise size',min:4,max:600,step:1,value:60,fmt:px},{key:'seed',label:'Seed',min:1,max:99,step:1,value:1,fmt:v=>String(v)}],
  controls:(v,upd)=>[modeSeg(v,'mode',[['blur','Blur'],['min','Min'],['max','Max']],upd,'Slope blur mode'),modeSeg(v,'guide',[['self','Its own slope'],['noise','Noise']],upd,'Slope from')],
  render(src,dst,v){run(pxd('slope'),dst,{uSrc:src.tex,uAmt:v.amt,uSteps:{int:Math.round(v.steps)},uMode:{int:v.mode==='min'?1:v.mode==='max'?2:0},uGuide:{int:v.guide==='noise'?1:0},uSize:v.size,uSeed:v.seed,uWrap:fxdWrap()});}});
fxDef('distort',{title:'Distort',note:'Waves, ripples, a twirl, or a pinch or bulge around the middle.',init:()=>({kind:'waves'}),
  defs:[{key:'amt',label:'Amount',min:-100,max:100,step:.5,value:10,fmt:v=>String(v)},{key:'size',label:'Wave length',min:4,max:600,step:1,value:60,fmt:px},{key:'ang',label:'Angle',min:-180,max:180,step:1,value:0,fmt:deg},
    {key:'cx',label:'Centre across',min:0,max:1,step:.01,value:.5,fmt:pct},{key:'cy',label:'Centre down',min:0,max:1,step:.01,value:.5,fmt:pct}],
  controls:(v,upd)=>[modeSeg(v,'kind',[['waves','Waves'],['ripple','Ripple'],['twirl','Twirl'],['pinch','Pinch / bulge']],upd,'Distort kind')],
  render(src,dst,v){const k=['waves','ripple','twirl','pinch'].indexOf(v.kind);run(pxd('distort'),dst,{uSrc:src.tex,uKind:{int:Math.max(0,k)},uAmt:k===3?v.amt/100:v.amt,uSize:v.size,uAng:rad(v.ang),uC:[v.cx,1-v.cy],uWrap:fxdWrap()});}});
