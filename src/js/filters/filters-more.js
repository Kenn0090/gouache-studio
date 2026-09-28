/* ================= More filters (0.17) =================
   Looks Kenn asked for, made our own way: Glass, Soft focus, Acid, Halftone, Engraving, Riso print, B&W print,
   Watercolour, Drift blur, Pixel / bitmap, Anaglyph, Charcoal, Cinematic mono, Kuwahara, and Y2K gradient maps.
   Images are premultiplied: each shader works on the straight colour and multiplies back. */
const FX2_H=GL_ST+`
float hash1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash1(i),hash1(i+vec2(1,0)),f.x),mix(hash1(i+vec2(0,1)),hash1(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=0.5; } return v; }
vec2 SZ(sampler2D s){ return vec2(textureSize(s,0)); }
vec4 at(sampler2D s,vec2 px){ return texture(s,px/SZ(s)); }
vec2 rot(vec2 p,float a){ float c=cos(a),s=sin(a); return vec2(c*p.x-s*p.y,s*p.x+c*p.y); }
vec4 outC(vec3 c,float a){ return vec4(clamp(c,0.0,1.0)*a,a); }`;
const FX2_FS={
  /* frosted or ribbed glass seen through (0 frosted, 1 ribbed), or a glassy overlay of streaks and reflections (2) */
  glass:FX2_H+`uniform sampler2D uSrc; uniform int uMode; uniform float uAmt; uniform float uScale; uniform float uAng; uniform float uSheen; uniform float uSeed;
void main(){ vec2 p=gl_FragCoord.xy,sz=SZ(uSrc); vec2 q=rot(p,-uAng); vec2 off=vec2(0.0); float hl=0.0;
  if(uMode==0){ vec2 n=vec2(hash1(p+uSeed),hash1(p+uSeed+19.7))-0.5; vec2 m=vec2(fbm(p/uScale+uSeed),fbm(p/uScale+uSeed+7.3))-0.5; off=n*uAmt*0.9+m*uAmt*1.6; hl=(fbm(p/(uScale*0.7)+uSeed+3.1)-0.45)*uSheen*0.35; }
  else if(uMode==1){ float t=fract(q.x/uScale); float s=sin(t*6.28318); off=rot(vec2(s*uAmt,0.0),uAng); hl=pow(max(0.0,cos(t*6.28318)),6.0)*uSheen*0.45-pow(max(0.0,-cos(t*6.28318)),4.0)*uSheen*0.12; }
  else { vec2 m=vec2(fbm(p/uScale+uSeed),fbm(p/uScale+uSeed+7.3))-0.5; off=m*uAmt*0.6;
    float band=fbm(vec2(q.x/(uScale*1.6),q.y/(uScale*14.0))+uSeed); float streak=smoothstep(0.62,0.8,band)*0.8+smoothstep(0.7,0.95,fbm(vec2(q.x/(uScale*0.25),q.y/(uScale*40.0))+uSeed+4.0))*0.5;
    float refl=smoothstep(0.0,1.0,1.0-dot(p/sz,vec2(0.55,0.45))); hl=(streak*0.6+refl*0.25)*uSheen; }
  vec4 c=at(uSrc,p+off); vec3 s=st(c); s=s+(1.0-s)*max(hl,0.0)+s*min(hl,0.0); o=outC(s,c.a); }`,
  /* soft focus: a glow from the blurred bright parts laid over with Screen, a little contrast and warmth */
  soft:FX2_H+`uniform sampler2D uSrc; uniform sampler2D uBlur; uniform float uGlow; uniform float uThresh; uniform float uCon; uniform float uWarm; uniform float uAmt;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 c=texelFetch(uSrc,p,0),b=texelFetch(uBlur,p,0); vec3 s=st(c),bl=st(b);
  vec3 g=max(bl-uThresh,0.0)/(1.0-uThresh)*uGlow; vec3 r=1.0-(1.0-s)*(1.0-clamp(g,0.0,1.0)); r=mix(r,bl,0.25*uAmt);
  r=(r-0.5)*(1.0+uCon)+0.5; r*=vec3(1.0+0.08*uWarm,1.0+0.02*uWarm,1.0-0.08*uWarm); o=outC(mix(s,r,uAmt),c.a); }`,
  /* acid: warped flowing colour (0) or glitchy stretched motion trails with split colour (1) */
  acid:FX2_H+`uniform sampler2D uSrc; uniform int uMode; uniform float uAmt; uniform float uScale; uniform float uHue; uniform float uSeed;
vec3 hueRot(vec3 c,float h){ const vec3 k=vec3(0.57735); float ca=cos(h); return c*ca+cross(k,c)*sin(h)+k*dot(k,c)*(1.0-ca); }
void main(){ vec2 p=gl_FragCoord.xy; vec4 c;
  if(uMode==0){ vec2 w=vec2(fbm(p/uScale+uSeed),fbm(p/uScale+uSeed+5.2)); vec2 w2=vec2(fbm(p/uScale+w*2.5+uSeed+1.7),fbm(p/uScale+w*2.5+uSeed+9.1));
    c=at(uSrc,p+(w2-0.5)*uAmt*2.0); vec3 s=st(c); s=hueRot(s,(w2.x-0.5)*6.2832*uHue); float l=lumOf(s); s=mix(vec3(l),s,1.0+0.6*uHue); o=outC(s,c.a); return; }
  float band=floor(p.y/max(2.0,uScale*0.25)); float h=hash1(vec2(band,uSeed)); float shift=h>0.55?(hash1(vec2(band,uSeed+3.0))-0.5)*uAmt*2.0:0.0;
  vec2 q=p+vec2(shift,0.0); float sp=uAmt*0.08*uHue*4.0; vec3 acc=vec3(0.0); float aa=0.0,wt=0.0;
  for(int i=0;i<14;i++){ float f=float(i)/13.0,w=1.0-f*0.85; vec2 d=vec2(-f*uAmt*0.6*step(0.35,h),0.0);
    acc.r+=st(at(uSrc,q+d+vec2(sp,0))).r*w; acc.g+=st(at(uSrc,q+d)).g*w; acc.b+=st(at(uSrc,q+d-vec2(sp,0))).b*w; aa+=at(uSrc,q+d).a*w; wt+=w; }
  o=outC(acc/wt,aa/wt); }`,
  /* halftone: dots (0), lines (1) or wavy lines (2) on a rotated screen; ink colour or the image's colours */
  half:FX2_H+`uniform sampler2D uSrc; uniform int uShape; uniform float uCell; uniform float uAng; uniform float uWave; uniform int uColor; uniform vec3 uInk; uniform vec3 uPaper;
void main(){ vec2 p=gl_FragCoord.xy; vec2 q=rot(p,-uAng); if(uShape==2) q.y+=sin(q.x/uCell*0.9)*uCell*uWave;
  vec2 cell=floor(q/uCell),f=q/uCell-cell-0.5; vec2 cen=rot((cell+0.5)*uCell,uAng); if(uShape==2) cen.y-=0.0;
  vec4 c=at(uSrc,uShape==0?cen:p); vec3 s=st(c); float d=clamp(1.0-lumOf(s),0.0,1.0); float aa=1.2/uCell,cov;
  if(uShape==0){ float r=sqrt(d)*0.72; cov=smoothstep(r+aa,r-aa,length(f)); } else { float t=d*0.5; cov=smoothstep(t+aa,t-aa,abs(f.y)); }
  vec3 ink=uColor==1?s*mix(1.0,0.55,d):uInk; o=outC(mix(uPaper,ink,cov),c.a); }`,
  /* engraving: parallel lines whose thickness follows the darkness and which bend with the shapes; cross-hatching in the darkest tones; optional pop-art colour behind */
  engr:FX2_H+`uniform sampler2D uSrc; uniform float uSp; uniform float uAng; uniform float uBend; uniform int uCross; uniform int uPop; uniform vec3 uInk; uniform vec3 uPaper;
float lines(vec2 p,float ang,float d,float l){ vec2 q=rot(p,-ang); float y=q.y/uSp+l*uBend*4.0; float f=abs(fract(y)-0.5); float t=d*0.5; float aa=0.9/uSp; return smoothstep(t+aa,t-aa,f); }
void main(){ vec2 p=gl_FragCoord.xy; vec4 c=at(uSrc,p); vec3 s=st(c); float l=lumOf(s),d=clamp(1.0-l,0.0,1.0);
  float cov=lines(p,uAng,d,l); if(uCross==1) cov=max(cov,lines(p,uAng+1.5708,clamp((d-0.55)*2.2,0.0,1.0),l));
  vec3 base=uPaper; if(uPop==1){ vec3 hs=floor(s*3.0+0.5)/3.0; float mx=max(hs.r,max(hs.g,hs.b)); base=mix(vec3(1.0,0.95,0.85),hs/max(mx,0.2),0.85); }
  o=outC(mix(base,uInk,cov),c.a); }`,
  /* riso print: each ink takes the part of the image that absorbs like it does, printed a little out of register with grain; inks multiply on paper */
  riso:FX2_H+`uniform sampler2D uSrc; uniform vec3 uI1; uniform vec3 uI2; uniform vec3 uI3; uniform int uN; uniform float uMis; uniform float uGrain; uniform float uStr; uniform vec3 uPaper; uniform float uSeed;
float cov(vec2 p,vec3 ink,float k){ vec3 s=st(at(uSrc,p)); vec3 a=1.0-s,b=max(1.0-ink,vec3(0.02)); float v=clamp(dot(a,b)/dot(b,b),0.0,1.0)*uStr;
  float g=hash1(floor(p/1.5)+uSeed+k*13.0); v=clamp(v+(g-0.5)*uGrain*0.9,0.0,1.0); return smoothstep(0.08,0.92,v); }
void main(){ vec2 p=gl_FragCoord.xy; vec4 c=at(uSrc,p); vec3 r=uPaper;
  r*=mix(vec3(1.0),uI1,cov(p+vec2(uMis,-uMis*0.5),uI1,1.0)); r*=mix(vec3(1.0),uI2,cov(p-vec2(uMis*0.6,uMis),uI2,2.0)); if(uN>2) r*=mix(vec3(1.0),uI3,cov(p+vec2(-uMis,uMis*0.4),uI3,3.0));
  o=outC(r*(1.0-(hash1(p*0.37+uSeed)-0.5)*0.06),c.a); }`,
  /* black and white print: hard ink with a rough, spreading edge, on grainy paper */
  bwp:FX2_H+`uniform sampler2D uSrc; uniform float uT; uniform float uRough; uniform float uSoft; uniform float uPaperG; uniform vec3 uInk; uniform vec3 uPaper; uniform float uSeed;
void main(){ vec2 p=gl_FragCoord.xy; vec4 c=at(uSrc,p); float l=0.0; for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++) l+=lumOf(st(at(uSrc,p+vec2(x,y)))); l/=9.0;
  float n=(fbm(p/3.0+uSeed)-0.5)*uRough+(hash1(p+uSeed)-0.5)*uRough*0.5; float inkc=1.0-smoothstep(uT-uSoft,uT+uSoft,l+n);
  vec3 paper=uPaper*(1.0-(fbm(p/1.3+uSeed+8.0)-0.5)*uPaperG); o=outC(mix(paper,uInk,inkc),c.a); }`,
  /* watercolour: soft washes (from a Kuwahara pass), colour bleeding, darker pooled edges, pigment granulation and paper */
  wcol:FX2_H+`uniform sampler2D uSrc; uniform sampler2D uK; uniform float uBleed; uniform float uEdge; uniform float uGran; uniform float uLight; uniform float uSeed;
void main(){ vec2 p=gl_FragCoord.xy; vec2 w=vec2(fbm(p/28.0+uSeed),fbm(p/28.0+uSeed+4.1))-0.5; vec4 c=at(uK,p+w*uBleed*2.0); vec3 s=st(c);
  float gx=lumOf(st(at(uK,p+vec2(1,0))))-lumOf(st(at(uK,p-vec2(1,0)))),gy=lumOf(st(at(uK,p+vec2(0,1))))-lumOf(st(at(uK,p-vec2(0,1)))); float e=clamp(length(vec2(gx,gy))*6.0,0.0,1.0);
  s=mix(s,vec3(1.0),uLight*0.45); s*=1.0-e*uEdge*0.45; float g=fbm(p/2.2+uSeed+2.0); s*=1.0-(g-0.5)*uGran*0.5*(1.0-lumOf(s)*0.5);
  s*=0.97+0.06*fbm(p/1.1+uSeed+11.0); o=outC(s,max(c.a,at(uSrc,p).a)); }`,
  /* charcoal: grey tones drawn as streaky strokes along an angle on toothy paper */
  char:FX2_H+`uniform sampler2D uSrc; uniform float uAng; uniform float uLen; uniform float uCon; uniform float uTooth; uniform vec3 uInk; uniform vec3 uPaper; uniform float uSeed;
void main(){ vec2 p=gl_FragCoord.xy; vec4 c=at(uSrc,p); float l=lumOf(st(c)); l=clamp((l-0.5)*(1.0+uCon)+0.5,0.0,1.0);
  vec2 q=rot(p,-uAng); float stroke=fbm(vec2(q.x/uLen,q.y/1.6)+uSeed)*0.75+fbm(vec2(q.x/(uLen*0.3),q.y/0.9)+uSeed+5.0)*0.25; float tooth=fbm(p/1.4+uSeed+9.0);
  float m=smoothstep(-0.16,0.16,l-(stroke*0.85+tooth*uTooth*0.3)+0.08); vec3 r=mix(uInk,uPaper,m); r*=1.0-(1.0-tooth)*uTooth*0.12; o=outC(r,c.a); }`,
  /* drift blur: streaks along a direction that wanders over the image */
  drift:FX2_H+`uniform sampler2D uSrc; uniform float uAng; uniform float uLen; uniform float uCurve; uniform float uScale; uniform float uStreak; uniform float uSeed;
void main(){ vec2 p=gl_FragCoord.xy; float a=uAng+(fbm(p/uScale+uSeed)-0.5)*uCurve*3.1416; vec2 d=vec2(cos(a),-sin(a)); vec3 acc=vec3(0.0); float aa=0.0,wt=0.0,mx=0.0;
  for(int i=0;i<40;i++){ float f=float(i)/39.0-0.5; vec4 c=at(uSrc,p+d*f*uLen); float w=1.0-abs(f)*0.8; vec3 s=st(c); acc+=s*w; aa+=c.a*w; wt+=w; mx=max(mx,lumOf(s)); }
  vec3 r=acc/wt; float l=lumOf(r); r=r+(r/max(l,0.05))*(mx-l)*uStreak*0.6; o=outC(r,aa/wt); }`,
  /* pixels: blocks, fewer colours, dithering; or 1-bit black and white */
  pix:FX2_H+`uniform sampler2D uSrc; uniform float uPx; uniform int uMode; uniform float uLevels; uniform int uDith; uniform float uDA; uniform vec3 uInk; uniform vec3 uPaper;
/* the 8x8 ordered-dither (Bayer) matrix: the lowest bits of x and y matter most */
float bayer(vec2 p){ ivec2 i=ivec2(mod(p,8.0)); int v=0; for(int k=0;k<3;k++){ int x=(i.x>>k)&1,y=(i.y>>k)&1; v|=(((x^y)<<1)|y)<<(2*(2-k)); } return (float(v)+0.5)/64.0; }
void main(){ vec2 p=gl_FragCoord.xy; vec2 cell=floor(p/uPx); vec3 acc=vec3(0.0); float aa=0.0; for(int y=0;y<3;y++)for(int x=0;x<3;x++){ vec4 c=at(uSrc,(cell+(vec2(x,y)+0.5)/3.0)*uPx); acc+=st(c); aa+=c.a; }
  vec3 s=acc/9.0; float a=aa/9.0; float t=uDith==1?bayer(cell)-0.5:uDith==2?hash1(cell*1.37)-0.5:0.0;
  if(uMode==2){ float l=lumOf(s)+t*uDA*0.9; o=outC(l>0.5?uPaper:uInk,a); return; }
  if(uMode==1) s=vec3(lumOf(s)); float n=max(uLevels-1.0,1.0); s=floor(s*n+0.5+t*uDA)/n; o=outC(s,a); }`,
  /* anaglyph: red from one side, cyan from the other (the shift can grow with brightness for a fake depth) */
  ana:FX2_H+`uniform sampler2D uSrc; uniform float uOff; uniform float uAng; uniform int uGrey; uniform float uDepth;
void main(){ vec2 p=gl_FragCoord.xy; vec2 d=vec2(cos(uAng),-sin(uAng)); float k=mix(1.0,lumOf(st(at(uSrc,p)))*2.0,uDepth);
  vec4 l=at(uSrc,p-d*uOff*k),r=at(uSrc,p+d*uOff*k); vec3 sl=st(l),sr=st(r); if(uGrey==1){ sl=vec3(lumOf(sl)); sr=vec3(lumOf(sr)); }
  o=outC(vec3(sl.r,sr.g,sr.b),max(l.a,r.a)); }`,
  /* cinematic black and white: a colour filter in front of the lens, film curve, faded blacks, grain, vignette, a touch of tone */
  cine:FX2_H+`uniform sampler2D uSrc; uniform vec3 uW; uniform float uCon; uniform float uFade; uniform float uGrain; uniform float uVig; uniform vec3 uTone; uniform float uToneA; uniform float uSeed;
void main(){ vec2 p=gl_FragCoord.xy,sz=SZ(uSrc); vec4 c=at(uSrc,p); vec3 s=st(c); float l=clamp(dot(s,uW)/max(uW.r+uW.g+uW.b,0.01),0.0,1.0);
  float k=1.0+uCon*2.0; l=1.0/(1.0+exp(-(l-0.5)*4.0*k)); l=(l-1.0/(1.0+exp(2.0*k)))/(1.0/(1.0+exp(-2.0*k))-1.0/(1.0+exp(2.0*k)));
  l=uFade*0.25+l*(1.0-uFade*0.25); l+=(hash1(p+uSeed)-0.5)*uGrain*0.25; vec2 v=p/sz-0.5; l*=1.0-dot(v,v)*uVig*1.6;
  vec3 r=mix(vec3(l),l*uTone*1.8,uToneA*0.5); o=outC(r,c.a); }`};
const PX2=Object.fromEntries(Object.entries(FX2_FS).map(([k,s])=>[k,program(s)]));
for(const k of ['acid','drift','bwp','pix','wcol'])PX2[k].tiled=true;
/* ---- controls ---- */
const colIn=(v,key,label,upd)=>{const i=el('input',{type:'color',value:toHex(v[key]),'aria-label':label});i.addEventListener('input',()=>{v[key]=fromHex(i.value);upd();});return el('label',{class:'fxcol'},i,el('span',{text:label}));};
const modeSeg=(v,key,opts,upd,label)=>seg(opts,v[key],x=>{v[key]=x;upd();},label);
const seedBtn=(v,upd,t)=>el('button',{class:'btn sm',text:t||'New random',onclick:()=>{v.seed=Math.random()*100;upd();}});
const rad=d=>d*Math.PI/180;
/* ---- the filters ---- */
fxDef('glass',{title:'Glass',note:'The image seen through frosted or ribbed glass, or a glassy overlay of streaks and reflections.',init:()=>({mode:'frost',seed:Math.random()*100}),
  defs:[{key:'amt',label:'Distortion',min:0,max:60,step:.5,value:10,fmt:px},{key:'sc',label:'Size',min:4,max:200,step:1,value:24,fmt:px},{key:'ang',label:'Angle',min:-90,max:90,step:1,value:0,fmt:deg},{key:'sheen',label:'Sheen',min:0,max:1,step:.01,value:.4,fmt:pct}],
  controls:(v,upd)=>[modeSeg(v,'mode',[['frost','Frosted'],['rib','Ribbed'],['over','Overlay']],upd,'Glass'),el('div',{class:'frow'},seedBtn(v,upd))],
  render(src,dst,v){run(PX2.glass,dst,{uSrc:src.tex,uMode:{int:v.mode==='rib'?1:v.mode==='over'?2:0},uAmt:v.amt,uScale:v.sc,uAng:rad(v.ang),uSheen:v.sheen,uSeed:v.seed||1});}});
fxDef('softFocus',{title:'Soft focus',note:'A dreamy glow from the bright parts, like a soft-focus lens.',
  defs:[{key:'amt',label:'Amount',min:0,max:1,step:.01,value:.7,fmt:pct},{key:'r',label:'Glow size',min:1,max:80,step:.5,value:18,fmt:px},{key:'glow',label:'Glow',min:0,max:2,step:.01,value:.9,fmt:pct},{key:'th',label:'From brightness',min:0,max:.95,step:.01,value:.35,fmt:pct},{key:'con',label:'Contrast',min:-.5,max:.5,step:.01,value:.08,fmt:pct},{key:'warm',label:'Warmth',min:-1,max:1,step:.01,value:.3,fmt:pct}],
  render(src,dst,v){const b=acquire();gaussian(src,b,v.r);run(PX2.soft,dst,{uSrc:src.tex,uBlur:b.tex,uGlow:v.glow,uThresh:v.th,uCon:v.con,uWarm:v.warm,uAmt:v.amt});release(b);}});
fxDef('acid',{title:'Acid',heavy:true,note:'Warped, flowing colour, or glitchy stretched motion trails.',init:()=>({mode:'flow',seed:Math.random()*100}),
  defs:[{key:'amt',label:'Amount',min:0,max:200,step:1,value:40,fmt:px},{key:'sc',label:'Scale',min:10,max:600,step:1,value:140,fmt:px},{key:'hue',label:'Colour shift',min:0,max:1,step:.01,value:.4,fmt:pct}],
  controls:(v,upd)=>[modeSeg(v,'mode',[['flow','Colour flow'],['glitch','Glitch trails']],upd,'Acid'),el('div',{class:'frow'},seedBtn(v,upd))],
  render(src,dst,v){run(PX2.acid,dst,{uSrc:src.tex,uMode:{int:v.mode==='glitch'?1:0},uAmt:v.amt,uScale:v.sc,uHue:v.hue,uSeed:v.seed||1});}});
fxDef('halftone',{title:'Halftone',note:'Printed with a screen of dots or lines, straight or wavy.',init:()=>({shape:'dots',col:'ink',ink:[.08,.08,.1],paper:[.96,.94,.9]}),
  defs:[{key:'cell',label:'Cell size',min:3,max:60,step:.5,value:9,fmt:px},{key:'ang',label:'Angle',min:-90,max:90,step:1,value:45,fmt:deg},{key:'wave',label:'Wave',min:0,max:1.5,step:.01,value:.5,fmt:pct}],
  controls:(v,upd)=>[modeSeg(v,'shape',[['dots','Dots'],['lines','Lines'],['wavy','Wavy lines']],upd,'Shape'),modeSeg(v,'col',[['ink','One ink'],['img','Image colours']],upd,'Colour'),el('div',{class:'chips'},colIn(v,'ink','Ink',upd),colIn(v,'paper','Paper',upd))],
  render(src,dst,v){run(PX2.half,dst,{uSrc:src.tex,uShape:{int:v.shape==='lines'?1:v.shape==='wavy'?2:0},uCell:v.cell,uAng:rad(v.ang),uWave:v.wave,uColor:{int:v.col==='img'?1:0},uInk:v.ink,uPaper:v.paper});}});
fxDef('engraving',{title:'Engraving',note:'Fine lines like an etching; thicker where it is darker, bending with the shapes. Pop art puts bold flat colour behind.',init:()=>({pop:false,cross:true,ink:[.06,.05,.05],paper:[.97,.95,.9]}),
  defs:[{key:'sp',label:'Line spacing',min:2,max:30,step:.5,value:6,fmt:px},{key:'ang',label:'Angle',min:-90,max:90,step:1,value:30,fmt:deg},{key:'bend',label:'Bend with shapes',min:0,max:1,step:.01,value:.35,fmt:pct}],
  controls:(v,upd)=>[el('div',{class:'chips'},chk('fx_cross','Cross-hatch the darkest parts',!!v.cross,x=>{v.cross=x;upd();}),chk('fx_pop','Pop art colour',!!v.pop,x=>{v.pop=x;upd();})),el('div',{class:'chips'},colIn(v,'ink','Ink',upd),colIn(v,'paper','Paper',upd))],
  render(src,dst,v){run(PX2.engr,dst,{uSrc:src.tex,uSp:v.sp,uAng:rad(v.ang),uBend:v.bend,uCross:!!v.cross,uPop:!!v.pop,uInk:v.ink,uPaper:v.paper});}});
fxDef('riso',{title:'Riso print',note:'Two or three bright inks printed a little out of line, with grain, like a risograph.',init:()=>({n:2,i1:[1,.28,.55],i2:[.1,.35,.85],i3:[1,.85,0],paper:[.98,.96,.92],seed:Math.random()*100}),
  defs:[{key:'str',label:'Ink strength',min:.2,max:2,step:.01,value:.8,fmt:pct},{key:'mis',label:'Out of line',min:0,max:20,step:.5,value:3,fmt:px},{key:'gr',label:'Grain',min:0,max:1,step:.01,value:.45,fmt:pct}],
  controls:(v,upd)=>[modeSeg(v,'n',[[2,'Two inks'],[3,'Three inks']],upd,'Inks'),el('div',{class:'chips'},colIn(v,'i1','Ink 1',upd),colIn(v,'i2','Ink 2',upd),colIn(v,'i3','Ink 3',upd),colIn(v,'paper','Paper',upd)),el('div',{class:'frow'},seedBtn(v,upd,'New grain'))],
  render(src,dst,v){run(PX2.riso,dst,{uSrc:src.tex,uI1:v.i1,uI2:v.i2,uI3:v.i3,uN:{int:v.n},uMis:v.mis,uGrain:v.gr,uStr:v.str,uPaper:v.paper,uSeed:v.seed||1});}});
fxDef('bwPrint',{title:'B&W print',note:'Hard black ink with rough edges on grainy paper.',init:()=>({ink:[.05,.05,.05],paper:[.95,.94,.9],seed:Math.random()*100}),
  defs:[{key:'t',label:'Threshold',min:.05,max:.95,step:.01,value:.5,fmt:pct},{key:'rough',label:'Roughness',min:0,max:.6,step:.01,value:.2,fmt:pct},{key:'soft',label:'Softness',min:0,max:.3,step:.005,value:.04,fmt:pct},{key:'pg',label:'Paper grain',min:0,max:1,step:.01,value:.35,fmt:pct}],
  controls:(v,upd)=>[el('div',{class:'chips'},colIn(v,'ink','Ink',upd),colIn(v,'paper','Paper',upd)),el('div',{class:'frow'},seedBtn(v,upd,'New grain'))],
  render(src,dst,v){run(PX2.bwp,dst,{uSrc:src.tex,uT:v.t,uRough:v.rough,uSoft:v.soft,uPaperG:v.pg,uInk:v.ink,uPaper:v.paper,uSeed:v.seed||1});}});
fxDef('watercolour',{title:'Watercolour',heavy:true,note:'Soft washes that bleed a little, darker pooled edges, pigment grain and paper.',init:()=>({seed:Math.random()*100}),
  defs:[{key:'r',label:'Wash size',min:1,max:10,step:1,value:4,fmt:px},{key:'bleed',label:'Bleed',min:0,max:20,step:.5,value:5,fmt:px},{key:'edge',label:'Dark edges',min:0,max:1,step:.01,value:.6,fmt:pct},{key:'gran',label:'Granulation',min:0,max:1,step:.01,value:.5,fmt:pct},{key:'light',label:'Lighter',min:0,max:1,step:.01,value:.25,fmt:pct}],
  controls:(v,upd)=>[el('div',{class:'frow'},seedBtn(v,upd))],
  render(src,dst,v){const k=acquire();run(P.f_kuwa,k,{uSrc:src.tex,uR:{int:v.r},uWrap:!!doc.wrap});run(PX2.wcol,dst,{uSrc:src.tex,uK:k.tex,uBleed:v.bleed,uEdge:v.edge,uGran:v.gran,uLight:v.light,uSeed:v.seed||1});release(k);}});
fxDef('charcoal',{title:'Charcoal',note:'Smudgy strokes of charcoal on toothy paper.',init:()=>({ink:[.08,.07,.07],paper:[.93,.91,.87],seed:Math.random()*100}),
  defs:[{key:'ang',label:'Stroke angle',min:-90,max:90,step:1,value:35,fmt:deg},{key:'len',label:'Stroke length',min:2,max:80,step:1,value:18,fmt:px},{key:'con',label:'Contrast',min:-.5,max:1.5,step:.01,value:.4,fmt:pct},{key:'smudge',label:'Smudge',min:0,max:12,step:.5,value:1.5,fmt:px},{key:'tooth',label:'Paper tooth',min:0,max:1,step:.01,value:.5,fmt:pct}],
  controls:(v,upd)=>[el('div',{class:'chips'},colIn(v,'ink','Charcoal',upd),colIn(v,'paper','Paper',upd)),el('div',{class:'frow'},seedBtn(v,upd))],
  render(src,dst,v){let s=src,b=null;if(v.smudge>.25){b=acquire();gaussian(src,b,v.smudge);s=b;}run(PX2.char,dst,{uSrc:s.tex,uAng:rad(v.ang),uLen:v.len,uCon:v.con,uTooth:v.tooth,uInk:v.ink,uPaper:v.paper,uSeed:v.seed||1});if(b)release(b);}});
fxDef('driftBlur',{title:'Drift blur',heavy:true,note:'Streaky motion blur whose direction drifts across the image.',init:()=>({seed:Math.random()*100}),
  defs:[{key:'ang',label:'Angle',min:-180,max:180,step:1,value:0,fmt:deg},{key:'len',label:'Distance',min:2,max:300,step:1,value:60,fmt:px},{key:'curve',label:'Drift',min:0,max:1,step:.01,value:.35,fmt:pct},{key:'sc',label:'Drift size',min:20,max:1000,step:5,value:260,fmt:px},{key:'streak',label:'Streaks',min:0,max:1,step:.01,value:.35,fmt:pct}],
  controls:(v,upd)=>[el('div',{class:'frow'},seedBtn(v,upd))],
  render(src,dst,v){run(PX2.drift,dst,{uSrc:src.tex,uAng:rad(v.ang),uLen:v.len,uCurve:v.curve,uScale:v.sc,uStreak:v.streak,uSeed:v.seed||1});}});
fxDef('pixelBitmap',{title:'Pixel / bitmap',note:'Chunky pixels with fewer colours and dithering, or 1-bit black and white like Photoshop’s Bitmap mode.',init:()=>({mode:'color',dith:'ordered',ink:[0,0,0],paper:[1,1,1]}),
  defs:[{key:'px',label:'Pixel size',min:1,max:64,step:1,value:6,fmt:px},{key:'lv',label:'Levels per colour',min:2,max:16,step:1,value:4},{key:'da',label:'Dither strength',min:0,max:1.5,step:.01,value:1,fmt:pct}],
  controls:(v,upd)=>[modeSeg(v,'mode',[['color','Colour'],['grey','Grey'],['bit','1-bit']],upd,'Mode'),modeSeg(v,'dith',[['none','No dither'],['ordered','Pattern'],['noise','Diffusion']],upd,'Dither'),el('div',{class:'chips'},colIn(v,'ink','Dark',upd),colIn(v,'paper','Light',upd))],
  render(src,dst,v){run(PX2.pix,dst,{uSrc:src.tex,uPx:v.px,uMode:{int:v.mode==='bit'?2:v.mode==='grey'?1:0},uLevels:v.lv,uDith:{int:v.dith==='ordered'?1:v.dith==='noise'?2:0},uDA:v.dith==='none'?0:v.da,uInk:v.ink,uPaper:v.paper});}});
fxDef('anaglyph',{title:'Anaglyph',note:'Red and cyan pulled apart like a 3D-glasses picture.',init:()=>({grey:false}),
  defs:[{key:'off',label:'Offset',min:0,max:40,step:.5,value:6,fmt:px},{key:'ang',label:'Angle',min:-90,max:90,step:1,value:0,fmt:deg},{key:'depth',label:'Depth from brightness',min:0,max:1,step:.01,value:0,fmt:pct}],checks:[['grey','Black and white first',false]],
  render(src,dst,v){run(PX2.ana,dst,{uSrc:src.tex,uOff:v.off,uAng:rad(v.ang),uGrey:!!v.grey,uDepth:v.depth});}});
const CINE_FILTERS={none:[.2126,.7152,.0722],red:[.6,.3,.1],yellow:[.45,.45,.1],green:[.2,.7,.1],blue:[.1,.25,.65]};
fxDef('cineMono',{title:'Cinematic mono',note:'Black and white with a film curve, lifted blacks, grain and a vignette.',init:()=>({flt:'yellow',tone:[.72,.6,.45],seed:Math.random()*100}),
  defs:[{key:'con',label:'Contrast',min:-.4,max:1,step:.01,value:.35,fmt:pct},{key:'fade',label:'Faded blacks',min:0,max:1,step:.01,value:.35,fmt:pct},{key:'grain',label:'Grain',min:0,max:1,step:.01,value:.35,fmt:pct},{key:'vig',label:'Vignette',min:0,max:1,step:.01,value:.4,fmt:pct},{key:'toneA',label:'Tone',min:0,max:1,step:.01,value:.15,fmt:pct}],
  controls:(v,upd)=>[el('div',{class:'sub',text:'Lens filter'}),modeSeg(v,'flt',[['none','None'],['red','Red'],['yellow','Yellow'],['green','Green'],['blue','Blue']],upd,'Lens filter'),el('div',{class:'chips'},colIn(v,'tone','Tone colour',upd),seedBtn(v,upd,'New grain'))],
  render(src,dst,v){run(PX2.cine,dst,{uSrc:src.tex,uW:CINE_FILTERS[v.flt]||CINE_FILTERS.none,uCon:v.con,uFade:v.fade,uGrain:v.grain,uVig:v.vig,uTone:v.tone,uToneA:v.toneA,uSeed:v.seed||1});}});
fxDef('kuwahara',{title:'Kuwahara',heavy:true,note:'Painterly smoothing that keeps edges sharp: each spot takes the calmest of the four areas around it.',
  defs:[{key:'r',label:'Radius',min:1,max:12,step:1,value:4,fmt:px},{key:'p',label:'Passes',min:1,max:3,step:1,value:1}],
  render(src,dst,v){if(v.p<2){run(P.f_kuwa,dst,{uSrc:src.tex,uR:{int:v.r},uWrap:!!doc.wrap});return;}
    const a=acquire(),b=acquire();let s=src;for(let i=0;i<v.p;i++){const out=i===v.p-1?dst:(i%2?b:a);run(P.f_kuwa,out,{uSrc:s.tex,uR:{int:v.r},uWrap:!!doc.wrap});s=out;}release(a);release(b);}});
/* Y2K gradient maps, for Adjust › Gradient map */
GRAD_BUILTIN.push(
  {name:'Y2K chrome',def:gradDef(hexStops([[0,'#0b0c1a'],[.3,'#4a5a8c'],[.55,'#e6ecff'],[.7,'#8fa3c9'],[1,'#ffffff']]))},
  {name:'Y2K cyber pink',def:gradDef(hexStops([[0,'#12002a'],[.4,'#b0138a'],[.75,'#ff79d0'],[1,'#fff0fb']]))},
  {name:'Y2K holo',def:gradDef(hexStops([[0,'#1b1036'],[.25,'#5f7cff'],[.5,'#7ff5e0'],[.75,'#ffb8f1'],[1,'#fffbe6']]))},
  {name:'Y2K lime',def:gradDef(hexStops([[0,'#07140a'],[.45,'#2f8f2a'],[.75,'#b8ff3c'],[1,'#f5ffe0']]))},
  {name:'Y2K ice',def:gradDef(hexStops([[0,'#050d1f'],[.4,'#1a6fd1'],[.7,'#8fe9ff'],[1,'#ffffff']]))},
  {name:'Y2K sunset',def:gradDef(hexStops([[0,'#1a0633'],[.35,'#ff2e88'],[.65,'#ff9a3c'],[1,'#fff27a']]))});
