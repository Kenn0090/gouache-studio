/* ================= Mixing brush (0.81) =================
   Real paint mixing for the Paint tab. The brush carries a LOAD (a small picture of the paint on the bristles, kept for the whole
   stroke), and every layer has a hidden WETNESS map (a quarter of the canvas size). On each dab:
   1. the brush picks paint up from the canvas into its load (wet paint is picked up easily, dry paint hardly), mixed like pigments;
   2. the load is laid down on the layer; where the canvas is wet the new paint mixes with it, where it is dry it covers it;
   3. the dab makes the canvas wet; the wetness dries away by itself (Dry after) or by hand (Dry paint).
   It works on the layer's base colour only (not masks, 3D or other maps). It reuses the Blend brush's stroke path, so selections,
   symmetry, lock alpha and undo all behave like the other brushes. */
const MIXQ=4;/* the wetness map is this many times smaller than the canvas */
/* shared by the watercolour brushes and the paper layer: value noise, and the height of each paper type (0..1) */
const MIX_NOISE=`
float wh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float wn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(wh(i),wh(i+vec2(1.0,0.0)),f.x),mix(wh(i+vec2(0.0,1.0)),wh(i+vec2(1.0,1.0)),f.x),f.y); }
float wf(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*wn(p); p=p*2.03+17.0; a*=0.5; } return s/0.9375; }
`;
const PAPER_NAMES=['Smooth white','Notebook, lined','Notebook, grid','Notebook, dots','Sketch paper','Watercolour, cold-press','Watercolour, rough','Oak wood','Canvas','Kraft paper','Parchment','Newsprint','Brick wall','Concrete','Rough plaster','Corrugated metal'];
const PAPER_GLSL=MIX_NOISE+`
float pap_h(vec2 p,int t,float sc){ vec2 q=p/sc; float h=0.5;
  if(t<=0) h=0.5+(wn(q*2.0)-0.5)*0.06;
  else if(t<=3) h=wn(q*1.4)*0.45+wn(q*3.3)*0.35+wn(q*8.0)*0.2;
  else if(t==4) h=wf(q*0.8)*0.5+wn(q*2.2)*0.3+wn(q*vec2(6.0,1.0)+3.0)*0.1+wn(q*vec2(1.0,6.0)+9.0)*0.1;
  else if(t==5){ float c=wf(q*0.22); h=pow(clamp(c*1.25,0.0,1.0),1.5)*0.7+wn(q*0.9)*0.2+wn(q*3.0)*0.1; }
  else if(t==6){ float c=wf(q*0.12); h=pow(clamp(c*1.35,0.0,1.0),1.8)*0.75+wn(q*0.5)*0.15+wn(q*2.0)*0.1; }
  else if(t==7){ float w=wf(vec2(q.x*0.006,q.y*0.05))*5.0; float ring=abs(fract(q.y*0.045+w)-0.5)*2.0; float pores=step(0.82,wn(vec2(q.x*0.5,q.y*3.0)));
    h=ring*0.55+wn(vec2(q.x*0.04,q.y*0.8))*0.3+pores*0.15+0.05; }
  else if(t==8){ vec2 u=q/5.0; vec2 f=fract(u),i=floor(u); float over=mod(i.x+i.y,2.0); float th=over<1.0?0.5+0.5*cos((f.x-0.5)*3.14159):0.5+0.5*cos((f.y-0.5)*3.14159);
    h=th*0.7+wn(q*1.1)*0.2+wn(q*0.2)*0.1; }
  else if(t==9) h=wn(q*vec2(0.12,1.0))*0.4+wn(q*vec2(1.0,0.12)+5.0)*0.3+wn(q*3.0)*0.3;
  else if(t==10) h=wf(q*0.05)*0.5+wn(q*1.2)*0.3+wn(q*4.0)*0.2;
  else if(t==11) h=wn(q*vec2(0.3,2.0))*0.35+wn(q*vec2(2.0,0.3)+7.0)*0.35+step(0.93,wn(q*2.5))*0.3;
  else if(t==12){ vec2 b=vec2(64.0,28.0); vec2 u=q/b; float row=floor(u.y); u.x+=mod(row,2.0)*0.5; vec2 f=fract(u); float edge=min(min(f.x,1.0-f.x)*b.x,min(f.y,1.0-f.y)*b.y);
    float brick=smoothstep(1.5,4.5,edge); h=mix(0.12,0.62+0.25*wn(q*0.6),brick)+wn(q*2.4)*0.08; }
  else if(t==13) h=wf(q*0.05)*0.45+wn(q*0.7)*0.3+wn(q*2.6)*0.15+step(0.965,wn(q*1.7))*-0.25+0.25;
  else if(t==14) h=wf(q*0.1)*0.55+wn(q*0.8)*0.25+wn(q*3.2)*0.2;
  else h=0.5+0.5*sin(q.x*0.5236)+wn(q*vec2(0.2,0.02))*0.08;
  return h; }
`;
const FS_MIXLOAD=CH_BRUSH+PIGMENT_MIX+`
uniform sampler2D uLoad; uniform sampler2D uSrc; uniform sampler2D uBase; uniform bool uUseBase; uniform sampler2D uWet;
uniform vec2 uDocSize; uniform float uD; uniform float uExt; uniform float uPick; uniform float uDeplete; uniform float uDry; uniform float uBristles;
void main(){
  vec2 vUV=gl_FragCoord.xy/uD; vec2 lq=vUV*2.0-1.0;
  /* bristles: every bristle takes up the colour of one line of canvas, so it keeps its own colour along the stroke */
  if(uBristles>0.5) lq.y=(floor((lq.y*0.5+0.5)*uBristles)+0.5)/uBristles*2.0-1.0;
  float ca=cos(uAngle),sa=sin(uAngle); vec2 p=uCenter+vec2(ca*lq.x-sa*lq.y,sa*lq.x+ca*lq.y)*uExt;
  vec4 ld=texture(uLoad,vUV); float m=brushMask(p); vec2 duv=p/uDocSize;
  vec4 cc=texture(uSrc,duv); if(uUseBase){ vec4 b=texture(uBase,duv); cc=cc+b*(1.0-cc.a); }
  float w=texture(uWet,duv).r;
  float k=clamp(uPick*m*mix(uDry,1.0,w),0.0,1.0), wc=k*cc.a, wl=ld.a;
  vec3 ccol=cc.a>1e-4?cc.rgb/cc.a:vec3(0.0); vec3 lc=wl>1e-4?ld.rgb/wl:ccol;
  float kk=wc/max(wl+wc,1e-5); vec3 col=wc>1e-5?pgMix(lc,ccol,kk):lc;
  float amt=clamp(wl+wc*1.4,0.0,1.0)*(1.0-uDeplete*m);
  o=vec4(col*amt,amt); }`;
const FS_MIXDAB=CH_BRUSH+PIGMENT_MIX+PAPER_GLSL+`
uniform sampler2D uDst; uniform sampler2D uLoad; uniform sampler2D uWet; uniform float uExt; uniform float uAlpha; uniform float uDeposit; uniform float uWetMix;
uniform int uLockAlpha; uniform sampler2D uSelTex; uniform int uUseSel; uniform float uBristles; uniform float uDryB; uniform float uStepK; uniform float uThick; uniform float uEven; uniform float uWC; uniform float uWCEdge; uniform float uWCPools; uniform float uWCGran; uniform bool uWCOut; uniform int uPT; uniform float uPSc; uniform float uTooth;
/* watercolour: the blot's shape comes from noise fixed to the canvas (not a picture), so it never repeats. The outline is uneven and hard,
   pigment pools along the rim, hard-edged pools lie in layers inside, and paper grain breaks up the colour */
float wcMask(vec2 pix,float m0){
  float sc=max(uRadius*0.32,5.0); vec2 q=pix/sc; vec2 w=vec2(wf(q*0.7+3.1),wf(q*0.7+9.7))-0.5; float n=wf(q+w*1.6);
  float f=m0+(n-0.5)*uWC*1.15; float cover=smoothstep(0.46,0.5,f); float pool=(1.0-smoothstep(0.0,0.4,f-0.5))*cover;
  float n2=wf(q*0.55+41.0+w); float lay=smoothstep(0.52,0.545,n2)*0.6+smoothstep(0.38,0.405,n2)*0.4;
  float gr=wn(pix*0.8)*0.6+wn(pix*2.3)*0.4;
  float dens=0.5+uWCEdge*0.8*pool+uWCPools*(lay-0.5)*0.9; dens*=1.0+uWCGran*(gr-0.5)*1.6;
  return cover*clamp(dens,0.0,1.5); }
float bh(float i){ return fract(sin(i*127.1+311.7)*43758.5453); }
/* how thick the paint is at a pixel (this dab only): the stroke's own shape times the bristles' round ridges */
float hAt(vec2 pix){ float m=brushMask(pix)*uAlpha; float ca=cos(uAngle),sa=sin(uAngle); vec2 dv=pix-uCenter; vec2 q=vec2(ca*dv.x+sa*dv.y,-sa*dv.x+ca*dv.y)/(2.0*uExt)+0.5;
  float a=texture(uLoad,q).a, ridge=1.0;
  if(uBristles>0.5){ float t=q.y*uBristles, fr=fract(t), bump=sqrt(max(0.0,1.0-(2.0*fr-1.0)*(2.0*fr-1.0))); float amp=mix(0.2,1.0,bh(floor(t)))*(0.55+0.45*sin(q.x*7.0+bh(floor(t)+3.0)*40.0)); ridge=mix(0.25,1.0,bump)*amp; }
  return m*a*ridge; }
float hEnv(vec2 pix){ float ca=cos(uAngle),sa=sin(uAngle); vec2 dv=pix-uCenter; vec2 q=vec2(ca*dv.x+sa*dv.y,-sa*dv.x+ca*dv.y)/(2.0*uExt)+0.5; return brushMask(pix)*uAlpha*texture(uLoad,q).a; }
void main(){ vec2 size=vec2(textureSize(uDst,0)); vec2 uv=gl_FragCoord.xy/size; vec4 dst=texture(uDst,uv);
  float m0=brushMask(gl_FragCoord.xy); float m=(uWC>0.0?wcMask(gl_FragCoord.xy,m0):m0)*uAlpha; if(uUseSel==1) m*=texelFetch(uSelTex,ivec2(gl_FragCoord.xy),0).r;
  vec2 dv=gl_FragCoord.xy-uCenter; float ca=cos(uAngle),sa=sin(uAngle); vec2 q=vec2(ca*dv.x+sa*dv.y,-sa*dv.x+ca*dv.y)/(2.0*uExt)+0.5;
  vec4 ld=texture(uLoad,q);
  float bf=1.0; if(uBristles>0.5){ float bi=floor(q.y*uBristles); bf=0.5+0.5*bh(bi); float thr=bh(bi+17.0)*uDryB; bf*=clamp((ld.a-thr)/0.25,0.0,1.0); }
  float d=clamp(m*ld.a*uDeposit*bf,0.0,1.0); vec3 lc=ld.a>1e-4?ld.rgb/ld.a:vec3(0.0);
  if(uEven!=1.0) d=1.0-pow(1.0-d,uEven); /* keep paint even: coverage of overlapping dabs stays the same at any spacing */
  if(uPT>=0&&uTooth>0.0){ float ph=pap_h(gl_FragCoord.xy,uPT,uPSc); d=clamp(d*(1.0+uTooth*(0.5-ph)*2.2*(1.35-ld.a)),0.0,1.0); } /* the paper's tooth: dips take more paint, peaks less, most when the brush is dry */
  if(uBristles>0.5){ float bi2=floor(q.y*uBristles); lc=clamp(lc*(0.9+0.2*bh(bi2+5.0)),0.0,1.0); }
  if(uThick>0.0&&d>1e-3){ /* the paint stands up from the canvas: light from the top left catches the ridges and edges */
    vec2 fc=gl_FragCoord.xy; float gx=(hAt(fc+vec2(1.0,0.0))-hAt(fc-vec2(1.0,0.0)))*0.5, gy=(hAt(fc+vec2(0.0,1.0))-hAt(fc-vec2(0.0,1.0)))*0.5;
    float st=max(1.5,uRadius*0.06), ex=hEnv(fc+vec2(st,0.0))-hEnv(fc-vec2(st,0.0)), ey=hEnv(fc+vec2(0.0,st))-hEnv(fc-vec2(0.0,st));
    float sh=-(gx*-0.6+gy*-0.8)*uThick*1.3-(ex*-0.6+ey*-0.8)*uThick*0.55; lc=clamp(lc*(1.0+sh)+max(sh,0.0)*0.05,0.0,1.0); }
  float w=texture(uWet,uv).r*uWetMix;
  vec4 r=vec4(lc*d+dst.rgb*(1.0-d),d+dst.a*(1.0-d));
  if(uWCOut){ o=vec4(lc*d,d); return; } /* watercolour: only the density goes out, into the stroke buffer (the strongest dab wins) */
  if(uLockAlpha==1){ vec3 c=r.a>1e-6?r.rgb/r.a:vec3(0.0); r=vec4(c*dst.a,dst.a); }
  o=r; }`;
const FS_MIXCOMP=`uniform sampler2D uBefore; uniform sampler2D uStroke; uniform int uLockAlpha;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 b=texelFetch(uBefore,p,0), st=texelFetch(uStroke,p,0); /* a glaze: the stroke's colour multiplies the colour under it (like thin transparent paint), so white paper shows the colour as it is and layers darken */
  vec4 r=vec4(st.rgb*(1.0-b.a+b.rgb)+b.rgb*(1.0-st.a),st.a+b.a*(1.0-st.a));
  if(uLockAlpha==1){ vec3 c=r.a>1e-6?r.rgb/r.a:vec3(0.0); r=vec4(c*b.a,b.a); } o=r; }`;
const FS_MIXWET=CH_BRUSH+`uniform float uAlpha; uniform float uWetSet;
void main(){ o=vec4(clamp(brushMask(gl_FragCoord.xy)*uAlpha*uWetSet,0.0,1.0),0.0,0.0,0.0); }`;
const FS_MIXDRY=`uniform sampler2D uSrc; uniform float uStep;
void main(){ o=vec4(max(texelFetch(uSrc,ivec2(gl_FragCoord.xy),0).r-uStep,0.0),0.0,0.0,0.0); }`;
P.mixload=program(FS_MIXLOAD,VS_FULL);P.mixdab=program(FS_MIXDAB,VS_STAMP);P.mixwet=program(FS_MIXWET,VS_STAMP);P.mixdry=program(FS_MIXDRY);P.mixcomp=program(FS_MIXCOMP,VS_STAMP);
{const D0=Object.assign({uUseTip:false,uTip:dummy,uAngle:0,uRound:1,uFlip:[1,1],uTipAspect:1,uGrain:0,uGrainScale:[1,1],uPeriod:[1,1],uHard:.8,uRadius:1,uCenter:[0,0],uSpray:[0,0,0,0],uSprayVar:0,uSprayFleck:0,uSprayRing:[0,0,0],uSpraySolid:1},DUAL_UNIFORM_DEFAULTS);
 P.mixload.defaults=Object.assign({uUseBase:false,uBase:dummy,uBristles:0},D0);P.mixdab.defaults=Object.assign({uLockAlpha:0,uWetMix:1,uBristles:0,uDryB:0,uStepK:1,uThick:0,uEven:1,uWC:0,uWCEdge:0,uWCPools:0,uWCGran:0,uWCOut:false,uPT:{int:-1},uPSc:1,uTooth:0},D0,SEL_DEF);P.mixwet.defaults=Object.assign({},D0);}
/* the hidden wetness map of a layer (red channel: 0 dry … 1 soaking) */
function mixWetFor(L){const w=Math.max(1,Math.ceil(doc.w/MIXQ)),h=Math.max(1,Math.ceil(doc.h/MIXQ));let m=L._wet;
  if(m&&(m.w!==w||m.h!==h)){disposeTarget(m.t);if(m.t2)disposeTarget(m.t2);m=L._wet=null;}
  if(!m)m=L._wet={t:makeTarget(w,h,8,false),t2:null,w,h,until:0,dry:0};return m;}
function mixBegin(s){const o=s.o;if(o.space||s.L.maskOf)return;
  const D=clamp(Math.ceil((o.size/2*(s.rs||1)*1.5+2)*2),16,512),A=makeTarget(D,D,16,false),B=makeTarget(D,D,16,false),a=clamp(o.mixLoad,0,1),c=o.color;
  clearTarget(A,[c[0]*a,c[1]*a,c[2]*a,a]);clearTarget(B);
  const wet=mixWetFor(s.L);wet.dry=o.mixDry||0;wet.until=Infinity;const w0=makeTarget(wet.w,wet.h,8,false);blit(wet.t,w0,0,0,wet.w,wet.h,0,0);s.mix={A,B,D,wet,w0,dist:0};}
function mixEnd(s){const m=s.mix;if(!m)return;disposeTarget(m.A);disposeTarget(m.B);disposeTarget(m.w0);
  m.wet.until=m.wet.dry>0?performance.now()+m.wet.dry*1000+400:Infinity;s.mix=null;if(m.wet.dry>0)mixDryStart();}
/* one dab: pick up into the load, lay the load down, make the canvas wet */
function mixDab(s,c,U,a,ext,r,dx,dy){const o=s.o,m=s.mix;if(!m)return;
  const dist=Math.hypot(dx,dy),deplete=clamp((o.mixUse||0)*dist/Math.max(2*r,2),0,.6),wet=m.wet;
  run(P.mixload,m.B,Object.assign({},U,{uCenter:c,uLoad:m.A.tex,uSrc:(beforeT.w===doc.w?beforeT:scratchT).tex,uBase:(s.sampleT||dummy)?.tex||dummy,uUseBase:!!s.sampleT,uWet:m.w0.tex,uDocSize:[doc.w,doc.h],uD:m.D,uExt:ext,uPick:1-Math.pow(1-clamp(o.mixPick,0,.98),clamp(dist/Math.max(2*r,2),0,1)),uDeplete:deplete,uDry:.03,uMixLab:.5,uBristles:o.mixBristles||0}));
  {const t=m.A;m.A=m.B;m.B=t;}
  const pi=(o.mixTooth>0)?paperInfo():null;
  const wcOut=o.mixWC>0&&!doc.wrap&&beforeT.w===doc.w&&strokeT.w===doc.w;
  const dabU=Object.assign({},U,{uCenter:c,uDst:scratchT.tex,uLoad:m.A.tex,uWet:wet.t.tex,uExt:ext,uAlpha:a,uDeposit:o.opacity,uWetMix:1,uBristles:o.mixBristles||0,uDryB:o.mixDryB||0,uStepK:dist<1?.5:1-Math.pow(.3,clamp(dist/Math.max(2*r,2),0,1)),uThick:clamp(o.mixThick||0,0,1),uEven:o.mixEven&&!(o.mixWC>0)?clamp(o.spacing/.02,.25,40):1,uWC:clamp(o.mixWC||0,0,1),uWCEdge:o.mixWCEdge||0,uWCPools:o.mixWCPools||0,uWCGran:o.mixWCGran||0,uWCOut:wcOut,uPT:{int:pi?pi.t:-1},uPSc:pi?pi.sc:1,uTooth:o.mixTooth||0,uLockAlpha:s.L.lockAlpha?1:0},selU(o));
  if(wcOut){/* watercolour: this stroke's density goes into the stroke buffer (the strongest dab wins, so dab edges never stack into steps); the layer shows it laid over what was there before the stroke */
    s.wcBuf=true;clearStrokeBufferRegion(s,[c[0]-ext-1,c[1]-ext-1,c[0]+ext+1,c[1]+ext+1]);
    run(P.mixdab,strokeT,dabU,{blend:'max'});
    run(P.mixcomp,s.L.target,{uCenter:c,uExtent:ext+1,uSize:U.uSize,uBefore:beforeT.tex,uStroke:strokeT.tex,uLockAlpha:s.L.lockAlpha?1:0});
  }else run(P.mixdab,s.L.target,dabU);
  const q=MIXQ;run(P.mixwet,wet.t,Object.assign({},U,{uCenter:[c[0]/q,c[1]/q],uRadius:r/q,uExtent:ext/q,uSize:[wet.w,wet.h],uUseTip:false,uTip:dummy,uGrain:0,uUseDual:false,uAlpha:a,uWetSet:clamp(o.mixWet,0,1)}),{blend:'max'});}
/* drying: wetness fades over "Dry after" seconds; Dry paint clears it at once */
let mixDryTimer=0,mixDryLast=0;
function mixDryStart(){if(mixDryTimer)return;mixDryLast=performance.now();mixDryTimer=setInterval(mixDryTick,120);}
function mixDryTick(){const now=performance.now(),dt=(now-mixDryLast)/1000;mixDryLast=now;let any=false;
  for(const L of allLayers()){const w=L._wet;if(!w||!w.dry||w.until===Infinity)continue;
    if(now>w.until){clearTarget(w.t);w.until=0;continue;}any=true;
    if(!w.t2)w.t2=makeTarget(w.w,w.h,8,false);run(P.mixdry,w.t2,{uSrc:w.t.tex,uStep:dt/w.dry});{const t=w.t;w.t=w.t2;w.t2=t;}}
  if(!any){clearInterval(mixDryTimer);mixDryTimer=0;}}
function mixDryAll(){let n=0;for(const L of allLayers())if(L._wet){clearTarget(L._wet.t);L._wet.until=0;n++;}toast(n?'Paint is dry.':'No wet paint.');}
/* built-in mixing brushes */
const MIX_PRESETS=[
 ['Oil mixer','bristle',{size:56,hardness:.6,mix:true,mixLoad:.85,mixPick:.55,mixWet:.9,mixDry:0,mixUse:.18,mixBristles:30,mixDryB:.35,mixThick:.7,followDir:true,pSize:true,minSize:.5,spacing:.02}],
 ['Gouache mixer','bristle',{size:48,hardness:.7,mix:true,mixLoad:.9,mixPick:.35,mixWet:.6,mixDry:25,mixUse:.25,mixBristles:26,mixDryB:.3,mixThick:.6,followDir:true,pSize:true,minSize:.5,spacing:.02}],
 ['Watercolour wash',null,{size:170,hardness:.3,flow:.6,mix:true,mixLoad:.8,mixPick:.3,mixWet:1,mixDry:40,mixUse:.08,mixBristles:0,mixThick:0,mixWC:.8,mixWCEdge:.8,mixWCPools:.7,mixWCGran:.5,mixTooth:.6,followDir:false,pSize:true,minSize:.6,spacing:.04,smoothing:.55}],
 ['Watercolour splatter',null,{size:44,hardness:.55,flow:1,mix:true,mixLoad:.8,mixPick:0,mixWet:.4,mixDry:20,mixUse:0,mixBristles:0,mixThick:0,mixWC:.95,mixWCEdge:1,mixWCPools:.3,mixWCGran:.5,mixEven:false,count:9,scatter:4.5,bothAxes:true,sizeJitter:.96,followDir:false,pSize:false,spacing:1.1,smoothing:.2}],
 ['Watercolour wet-in-wet',null,{size:130,hardness:.2,flow:.55,mix:true,mixLoad:.7,mixPick:.85,mixWet:1,mixDry:60,mixUse:.05,mixBristles:0,mixThick:0,mixWC:.7,mixWCEdge:.7,mixWCPools:.6,mixWCGran:.55,mixTooth:.5,followDir:false,pSize:true,minSize:.6,spacing:.04,smoothing:.55}],
 ['Smear (empty brush)',null,{followDir:true,mixBristles:22,size:60,hardness:.5,mix:true,mixLoad:0,mixPick:.9,mixWet:.9,mixDry:0,mixUse:0,pSize:true,spacing:.02}],
 ['Big oil (350 px)','bristle',{size:350,hardness:.6,mix:true,mixLoad:.9,mixPick:.5,mixWet:.9,mixDry:0,mixUse:.08,mixBristles:34,mixDryB:.3,mixThick:.7,followDir:true,pSize:true,minSize:.6,spacing:.02,smoothing:.6}],
 ['Big gouache wash (250 px)','bristle',{size:250,hardness:.7,mix:true,mixLoad:.9,mixPick:.35,mixWet:.6,mixDry:25,mixUse:.12,mixBristles:28,mixDryB:.25,mixThick:.5,followDir:true,pSize:true,minSize:.6,spacing:.02,smoothing:.6}],
 ['Big smear (300 px)',null,{size:300,hardness:.5,mix:true,mixLoad:0,mixPick:.9,mixWet:.9,mixDry:0,mixUse:0,mixBristles:30,mixThick:.4,followDir:true,pSize:true,minSize:.6,spacing:.02,smoothing:.6}],
 ['Palette knife mixer','knife',{size:70,hardness:.8,mix:true,mixLoad:.5,mixPick:.8,mixWet:.8,mixDry:0,mixUse:.1,mixBristles:12,mixDryB:.1,mixThick:.5,followDir:true,pSize:true,minSize:.65,spacing:.02}]
].map(([name,tip,settings])=>Object.assign({name,tool:'brush',tip:tip?ART_TIPS[tip]:null,smoothing:.45,smoothCurve:true,mixEven:true,pOpacity:false},settings));
library.splice(3,0,{id:'mixing',name:'Mixing (real paint)',builtin:true,presets:MIX_PRESETS,tips:[]});
