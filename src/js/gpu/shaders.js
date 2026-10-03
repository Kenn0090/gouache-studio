/* ================= Shaders ================= */
const VS_FULL=`#version 300 es
in vec2 a; out vec2 vUV; void main(){ vUV=a; gl_Position=vec4(a*2.0-1.0,0.0,1.0); }`;
const VS_STAMP=`#version 300 es
in vec2 a; uniform vec2 uCenter; uniform float uExtent; uniform vec2 uSize;
void main(){ vec2 p=uCenter+(a*2.0-1.0)*uExtent; gl_Position=vec4(p/uSize*2.0-1.0,0.0,1.0); }`;
const VS_VIEW=`#version 300 es
in vec2 a; uniform vec2 uOrigin; uniform vec2 uExtent; uniform vec2 uViewport; uniform vec2 uUV0; uniform vec2 uUV1; uniform vec4 uR; out vec2 vUV;
void main(){ vec2 q=a*uExtent; vec2 p=uOrigin+vec2(uR.x*q.x+uR.y*q.y,uR.z*q.x+uR.w*q.y); vUV=mix(uUV0,uUV1,a); gl_Position=vec4(p.x/uViewport.x*2.0-1.0,1.0-p.y/uViewport.y*2.0,0.0,1.0); }`;
const FS_HEAD=`#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
out vec4 o;
`;
const CH_BRUSH=`
uniform vec2 uCenter; uniform float uRadius; uniform float uHard; uniform float uGrain; uniform vec2 uGrainScale; uniform vec2 uPeriod;
float hash(vec2 p, vec2 per){ p=mod(p,per); return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p, vec2 per){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash(i,per), b=hash(i+vec2(1.0,0.0),per), c=hash(i+vec2(0.0,1.0),per), d=hash(i+vec2(1.0,1.0),per);
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
uniform int uUseTip; uniform sampler2D uTip; uniform float uAngle; uniform float uRound; uniform vec2 uFlip; uniform float uTipAspect;
float brushMask(vec2 pix){
  float r=max(uRadius,0.01);
  vec2 dv=pix-uCenter; float ca=cos(uAngle), sa=sin(uAngle);
  vec2 q=vec2(ca*dv.x+sa*dv.y,-sa*dv.x+ca*dv.y)*uFlip; q.y/=max(uRound,0.02);
  float m;
  if(uUseTip==1){
    vec2 hs=uTipAspect>=1.0?vec2(r,r/uTipAspect):vec2(r*uTipAspect,r);
    vec2 tuv=q/hs*0.5+0.5;
    m=(tuv.x<0.0||tuv.y<0.0||tuv.x>1.0||tuv.y>1.0)?0.0:texture(uTip,tuv).r;
  } else {
    float d=length(q)/r;
    float h=clamp(min(uHard,1.0-1.2/max(r,1.2)),0.0,0.995);
    m=1.0-smoothstep(h,1.0,d);
  }
  if(uGrain>0.0){ vec2 q=pix/uGrainScale; float n=vnoise(q,uPeriod)*0.6+vnoise(q*2.0,uPeriod*2.0)*0.4;
    m*=clamp(mix(1.0,n*2.3-0.5,uGrain),0.0,1.0); }
  return m; }
`;
const CH_STROKE=`
uniform int uStroke; uniform vec3 uStrokeColor; uniform int uStrokeTint; vec3 gSC; uniform float uStrokeOpacity; uniform int uLockAlpha; uniform int uChanMode; uniform vec4 uChan;
uniform sampler2D uSelTex; uniform int uUseSel;
float selCov(ivec2 p, float c){ return uUseSel==1?c*texelFetch(uSelTex,p,0).r:c; }
/* dodge (3) and burn (4): uTonalRange 0 shadows, 1 midtones, 2 highlights; uProtect keeps hue and saturation */
uniform int uTonalRange; uniform int uProtect;
vec3 tonal(vec3 c, float k, bool dodge){ float l=dot(c,vec3(0.299,0.587,0.114));
  float w=uTonalRange==0?1.0-smoothstep(0.0,0.7,l):uTonalRange==2?smoothstep(0.3,1.0,l):1.0-abs(l-0.5)*2.0; float a=k*clamp(w,0.0,1.0);
  if(uProtect==1){ float nl=dodge?l+(1.0-l)*a:l*(1.0-a); vec3 r=c+(nl-l);
    float n=min(min(r.r,r.g),r.b), x=max(max(r.r,r.g),r.b);
    if(n<0.0) r=nl+(r-nl)*nl/max(nl-n,1e-5); if(x>1.0) r=nl+(r-nl)*(1.0-nl)/max(x-nl,1e-5); return clamp(r,0.0,1.0); }
  return dodge?c+(1.0-c)*a:c*(1.0-a); }
vec4 chanMix(vec4 oldP, vec4 t, float a){
  vec3 oc=oldP.a>1e-6?oldP.rgb/oldP.a:vec3(0.0); float oa=oldP.a;
  vec3 nc=mix(oc,mix(oc,t.rgb,a),uChan.rgb); float na=mix(oa,mix(oa,t.a,a),uChan.a); if(uLockAlpha==1) na=oa;
  return vec4(clamp(nc,0.0,1.0)*na,na); }
vec4 applyStroke(vec4 L, float cov){
  float a=clamp(cov,0.0,1.0)*uStrokeOpacity;
  if(uStroke>=3){ if(L.a<=1e-6) return L; vec3 r=tonal(clamp(L.rgb/L.a,0.0,1.0),a,uStroke==3);
    if(uChanMode==1) return chanMix(L,vec4(r,L.a),1.0); return vec4(r*L.a,L.a); }
  if(uChanMode==1&&uStroke!=0){ vec4 t=uStroke==1?vec4(gSC,dot(gSC,vec3(0.299,0.587,0.114))):vec4(0.0); return chanMix(L,t,a); }
  if(uStroke==1){ if(uLockAlpha==1) return vec4(mix(L.rgb,gSC*L.a,a),L.a); return vec4(gSC*a,a)+L*(1.0-a); }
  if(uStroke==2){ if(uLockAlpha==1) return L; return L*(1.0-a); }
  return L; }
`;
const FS_STAMP=CH_BRUSH+`uniform float uAlpha; uniform int uTint; uniform vec3 uDabCol; void main(){ float m=brushMask(gl_FragCoord.xy)*uAlpha; if(uTint==2){ if(m<=0.0) discard; o=vec4(uDabCol,0.0); return; } o=uTint==1?vec4(uDabCol*m,m):vec4(m); }`;
/* colour-jitter strokes stamp each dab twice: uTint 2 first gives pixels nothing has touched yet the dab's colour
   (so soft edges keep it), then uTint 1 lays the dab over what is there */
const FS_SMUDGE=CH_BRUSH+`
uniform sampler2D uSrc; uniform vec2 uDelta; uniform float uAlpha; uniform float uStrength; uniform float uCharge; uniform vec3 uColor; uniform int uLockAlpha; uniform int uChanMode; uniform vec4 uChan;
uniform sampler2D uSelTex; uniform int uUseSel;
void main(){ vec2 size=vec2(textureSize(uSrc,0)); vec2 uv=gl_FragCoord.xy/size;
  vec4 dst=texture(uSrc,uv); vec4 pulled=texture(uSrc,uv-uDelta/size);
  float m=brushMask(gl_FragCoord.xy)*uAlpha; if(uUseSel==1) m*=texelFetch(uSelTex,ivec2(gl_FragCoord.xy),0).r;
  vec4 paint=mix(pulled,vec4(uColor,1.0),uCharge);
  vec4 r=mix(dst,paint,clamp(m*uStrength,0.0,1.0));
  if(uChanMode==1){ vec3 oc=dst.a>1e-6?dst.rgb/dst.a:vec3(0.0),rc=r.a>1e-6?r.rgb/r.a:vec3(0.0); float na=mix(dst.a,r.a,uChan.a); r=vec4(mix(oc,rc,uChan.rgb)*na,na); }
  if(uLockAlpha==1){ vec3 c=r.a>1e-6?r.rgb/r.a:vec3(0.0); r=vec4(c*dst.a,dst.a); }
  o=r; }`;
const FS_MERGE=CH_STROKE+`uniform sampler2D uSrc; uniform sampler2D uStrokeTex;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 st=texelFetch(uStrokeTex,p,0); gSC=uStrokeTint==1?st.rgb:uStrokeColor; o=applyStroke(texelFetch(uSrc,p,0),selCov(p,st.a)); }`;
const FS_COMP=CH_STROKE+`
uniform sampler2D uBase; uniform sampler2D uLayer; uniform sampler2D uStrokeTex; uniform sampler2D uMask; uniform sampler2D uMask2; uniform sampler2D uLMask;
uniform int uMode; uniform int uUseMask; uniform int uUseMask2; uniform int uUseLMask; uniform float uOpacity;
uniform bool uSolid; uniform vec4 uSolidColor;
vec3 screenB(vec3 b,vec3 s){ return b+s-b*s; }
vec3 hardLight(vec3 b,vec3 s){ return mix(b*2.0*s,screenB(b,2.0*s-1.0),step(vec3(0.5),s)); }
vec3 dodge(vec3 b,vec3 s){ vec3 r=min(vec3(1.0),b/max(vec3(1.0)-s,vec3(1e-5))); return mix(r,vec3(0.0),step(b,vec3(0.0))); }
vec3 burn(vec3 b,vec3 s){ vec3 r=vec3(1.0)-min(vec3(1.0),(vec3(1.0)-b)/max(s,vec3(1e-5))); return mix(r,vec3(1.0),step(vec3(1.0),b)); }
vec3 softLight(vec3 b,vec3 s){ vec3 D=mix(((16.0*b-12.0)*b+4.0)*b,sqrt(b),step(vec3(0.25),b)); return mix(b-(1.0-2.0*s)*b*(1.0-b),b+(2.0*s-1.0)*(D-b),step(vec3(0.5),s)); }
float lum(vec3 c){ return dot(c,vec3(0.3,0.59,0.11)); }
vec3 clipColor(vec3 c){ float l=lum(c); float n=min(min(c.r,c.g),c.b); float x=max(max(c.r,c.g),c.b);
  if(n<0.0) c=l+(c-l)*l/max(l-n,1e-5); if(x>1.0) c=l+(c-l)*(1.0-l)/max(x-l,1e-5); return c; }
vec3 setLum(vec3 c,float l){ return clipColor(c+(l-lum(c))); }
float sat(vec3 c){ return max(max(c.r,c.g),c.b)-min(min(c.r,c.g),c.b); }
vec3 setSat(vec3 c,float s){ float mx=max(max(c.r,c.g),c.b); float mn=min(min(c.r,c.g),c.b); if(mx<=mn) return vec3(0.0); return (c-mn)*s/(mx-mn); }
vec3 blendFn(vec3 b,vec3 s){
  if(uMode==1) return b*s; if(uMode==2) return screenB(b,s); if(uMode==3) return hardLight(s,b);
  if(uMode==4) return min(b,s); if(uMode==5) return max(b,s); if(uMode==6) return dodge(b,s); if(uMode==7) return burn(b,s);
  if(uMode==8) return hardLight(b,s); if(uMode==9) return softLight(b,s); if(uMode==10) return abs(b-s); if(uMode==11) return b+s-2.0*b*s;
  if(uMode==12) return min(b+s,vec3(1.0));
  if(uMode==13) return setLum(setSat(s,sat(b)),lum(b)); if(uMode==14) return setLum(setSat(b,sat(s)),lum(b));
  if(uMode==15) return setLum(s,lum(b)); if(uMode==16) return setLum(b,lum(s));
  if(uMode==17) return max(b+s-1.0,vec3(0.0));
  if(uMode==18) return lum(s)<lum(b)?s:b; if(uMode==19) return lum(s)>lum(b)?s:b;
  if(uMode==20) return mix(burn(b,2.0*s),dodge(b,2.0*s-1.0),step(vec3(0.5),s));
  if(uMode==21) return clamp(b+2.0*s-1.0,0.0,1.0);
  if(uMode==22) return mix(min(b,2.0*s),max(b,2.0*s-1.0),step(vec3(0.5),s));
  if(uMode==23) return step(vec3(1.0),b+s);
  if(uMode==24) return max(b-s,vec3(0.0));
  if(uMode==25) return mix(min(b/max(s,vec3(1e-5)),vec3(1.0)),vec3(1.0),step(s,vec3(0.0)));
  return s; }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy);
  vec4 b=texelFetch(uBase,p,0); vec4 s=uSolid?uSolidColor:texelFetch(uLayer,p,0);
  if(uStroke!=0){ vec4 st=texelFetch(uStrokeTex,p,0); gSC=uStrokeTint==1?st.rgb:uStrokeColor; s=applyStroke(s,selCov(p,st.a)); }
  s*=uOpacity; if(uUseLMask==1) s*=texelFetch(uLMask,p,0).r;
  if(uUseMask==1) s*=texelFetch(uMask,p,0).a*(uUseMask2==1?texelFetch(uMask2,p,0).r:1.0);
  if(uMode==0){ o=s+b*(1.0-s.a); return; }
  vec3 Cs=s.a>1e-6?clamp(s.rgb/s.a,0.0,1.0):vec3(0.0); vec3 Cb=b.a>1e-6?clamp(b.rgb/b.a,0.0,1.0):vec3(0.0);
  vec3 B=clamp(blendFn(Cb,Cs),0.0,1.0);
  o=vec4(s.rgb*(1.0-b.a)+b.rgb*(1.0-s.a)+s.a*b.a*B, s.a+b.a*(1.0-s.a)); }`;
/* Integer hashing stays evenly distributed at 8K/16K; stochastic rounding is
   unbiased and preserves exact 8-bit values, including transparent/opaque ends. */
const GS_DITHER=`float gsNoise(ivec2 p){uint h=uint(p.x)*0x9e3779b9u^uint(p.y)*0x85ebca6bu;h^=h>>16;h*=0x7feb352du;h^=h>>15;h*=0x846ca68bu;h^=h>>16;return float(h>>8)/16777216.0;}
vec4 gsQuantize(vec4 c,ivec2 p){return floor(clamp(c,0.0,1.0)*255.0+gsNoise(p))/255.0;}
`;
const FS_VIEW=GS_DITHER+`in vec2 vUV; uniform sampler2D uComp; uniform vec3 uChk1; uniform vec3 uChk2; uniform float uChkSize; uniform vec4 uShow; uniform int uSingle; uniform int uMaskView;
uniform sampler2D uSel; uniform int uSelMode; uniform float uTime; uniform float uPx; uniform int uWrap;
uniform sampler2D uUnder; uniform int uUseUnder; uniform vec4 uBg;
float selAt(vec2 dp){ ivec2 sz=textureSize(uSel,0); ivec2 q=ivec2(floor(dp));
  if(uWrap==1) q=ivec2(mod(vec2(q),vec2(sz))); else if(any(lessThan(q,ivec2(0)))||any(greaterThanEqual(q,sz))) return 0.0;
  return texelFetch(uSel,q,0).r; }
void main(){ vec4 c=texture(uComp,vUV); vec2 q=floor(gl_FragCoord.xy/uChkSize); float k=mod(q.x+q.y,2.0);
  if(uUseUnder==1){ vec4 u=texture(uUnder,vUV); c=c+u*(1.0-c.a); }
  vec3 col=c.rgb+(uBg.a>0.5?uBg.rgb:mix(uChk1,uChk2,k))*(1.0-c.a);
  if(uMaskView==1) col=vec3(c.r);
  else if(uSingle>=0){ float v=uSingle==3?c.a:(uSingle==0?col.r:uSingle==1?col.g:col.b); col=vec3(v); }
  else { col*=uShow.rgb; if(uShow.a>0.5) col=mix(col,vec3(0.86,0.14,0.14),(1.0-c.a)*0.55); }
  if(uSelMode>0){ vec2 dp=vUV*vec2(textureSize(uSel,0)); float v=selAt(dp);
    if(uSelMode==2) col=mix(col,vec3(0.86,0.12,0.12),(1.0-v)*0.5);
    else if(v>=0.5){ float d=uPx;
      bool e=selAt(dp+vec2(d,0.0))<0.5||selAt(dp-vec2(d,0.0))<0.5||selAt(dp+vec2(0.0,d))<0.5||selAt(dp-vec2(0.0,d))<0.5;
      if(e){ float k=mod(floor((gl_FragCoord.x+gl_FragCoord.y)/4.0-uTime*6.0),2.0); col=vec3(k*0.92+0.04); } } }
  if(any(lessThan(vUV,vec2(0.0)))||any(greaterThan(vUV,vec2(1.0)))) col*=0.78;
  o=gsQuantize(vec4(col,1.0),ivec2(gl_FragCoord.xy)); }`;
const FS_RESAMPLE=`uniform sampler2D uSrc; uniform vec2 uOffset; uniform vec2 uScale; uniform int uTaps; uniform vec4 uOutside;
void main(){ vec2 ss=vec2(textureSize(uSrc,0)); vec2 lo=(gl_FragCoord.xy-0.5-uOffset)*uScale; vec2 hi=(gl_FragCoord.xy+0.5-uOffset)*uScale;
  vec4 acc=vec4(0.0); int n=max(uTaps,1);
  for(int j=0;j<8;j++){ if(j>=n) break; for(int i=0;i<8;i++){ if(i>=n) break;
    vec2 sp=mix(lo,hi,(vec2(float(i),float(j))+0.5)/float(n));
    if(sp.x<0.0||sp.y<0.0||sp.x>ss.x||sp.y>ss.y){ acc+=uOutside; continue; }
    acc+=texture(uSrc,sp/ss); } }
  o=acc/float(n*n); }`;
const FS_AXF=`uniform sampler2D uSrc; uniform vec2 uX; uniform vec2 uY; uniform vec2 uB;
void main(){ vec2 d=gl_FragCoord.xy; vec2 s=vec2(dot(uX,d),dot(uY,d))+uB; o=texelFetch(uSrc,ivec2(floor(s)),0); }`;
const FS_ADJUST=`uniform sampler2D uSrc; uniform float uExposure; uniform float uBright; uniform float uContrast; uniform float uSat; uniform float uHue; uniform float uTemp;
vec3 hueRot(vec3 c,float a){ vec3 k=vec3(0.57735); float cs=cos(a), sn=sin(a); return c*cs+cross(k,c)*sn+k*dot(k,c)*(1.0-cs); }
void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); if(c.a<=1e-6){ o=c; return; } vec3 r=c.rgb/c.a;
  r*=exp2(uExposure); r*=vec3(1.0+uTemp*0.16,1.0+uTemp*0.03,1.0-uTemp*0.16); r+=uBright; r=(r-0.5)*uContrast+0.5;
  r=hueRot(r,uHue); float l=dot(r,vec3(0.2126,0.7152,0.0722)); r=mix(vec3(l),r,uSat);
  r=clamp(r,0.0,1.0); o=vec4(r*c.a,c.a); }`;
const FS_BLUR=`uniform sampler2D uSrc; uniform vec2 uDir; uniform float uSigma; uniform int uRadius;
void main(){ vec2 size=vec2(textureSize(uSrc,0)); vec2 uv=gl_FragCoord.xy/size; vec4 acc=vec4(0.0); float ws=0.0;
  for(int i=-128;i<=128;i++){ if(i<-uRadius) continue; if(i>uRadius) break; float fi=float(i); float w=exp(-fi*fi/(2.0*uSigma*uSigma));
    acc+=texture(uSrc,uv+uDir*fi/size)*w; ws+=w; }
  o=acc/ws; }`;
const FS_SHARPEN=`uniform sampler2D uSrc; uniform sampler2D uBlur; uniform float uAmount;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(uSrc,p,0); vec4 b=texelFetch(uBlur,p,0);
  vec3 r=s.rgb+(s.rgb-b.rgb)*uAmount; o=vec4(clamp(r,vec3(0.0),vec3(s.a)),s.a); }`;
const FS_POSTER=`uniform sampler2D uSrc; uniform float uLevels;
void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); if(c.a<=1e-6){ o=c; return; } vec3 r=c.rgb/c.a; float n=uLevels-1.0;
  r=floor(r*n+0.5)/n; o=vec4(r*c.a,c.a); }`;
const FS_PLACE=`uniform sampler2D uSrc; uniform vec2 uOff; uniform sampler2D uMask; uniform vec4 uMaskRect; uniform float uMaskDefault; uniform int uUseMask;
void main(){ vec2 p=floor(gl_FragCoord.xy); ivec2 ss=textureSize(uSrc,0); ivec2 sp=ivec2(p-uOff);
  if(sp.x<0||sp.y<0||sp.x>=ss.x||sp.y>=ss.y){ o=vec4(0.0); return; }
  vec4 c=texelFetch(uSrc,sp,0); float a=clamp(c.a,0.0,1.0);
  if(uUseMask==1){ ivec2 mp=ivec2(p-uMaskRect.xy); float m=uMaskDefault;
    if(mp.x>=0&&mp.y>=0&&mp.x<int(uMaskRect.z)&&mp.y<int(uMaskRect.w)) m=texelFetch(uMask,mp,0).r; a*=m; }
  o=vec4(clamp(c.rgb,0.0,1.0)*a,a); }`;
const FS_MIX=`uniform sampler2D uA; uniform sampler2D uB; uniform float uT; uniform sampler2D uM; uniform int uUseM;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float t=uT*(uUseM==1?texelFetch(uM,p,0).r:1.0); o=mix(texelFetch(uA,p,0),texelFetch(uB,p,0),t); }`;
const FS_CHMERGE=`uniform sampler2D uOld; uniform sampler2D uNew; uniform vec4 uChan;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 a=texelFetch(uOld,p,0),b=texelFetch(uNew,p,0);
  vec3 ac=a.a>1e-6?a.rgb/a.a:vec3(0.0),bc=b.a>1e-6?b.rgb/b.a:vec3(0.0); float na=mix(a.a,b.a,uChan.a); o=vec4(mix(ac,bc,uChan.rgb)*na,na); }`;
const FS_MASKPLACE=`uniform sampler2D uMask; uniform vec4 uRect; uniform float uDef;
void main(){ ivec2 mp=ivec2(floor(gl_FragCoord.xy)-uRect.xy); float m=uDef;
  if(mp.x>=0&&mp.y>=0&&mp.x<int(uRect.z)&&mp.y<int(uRect.w)) m=texelFetch(uMask,mp,0).r; o=vec4(vec3(m),1.0); }`;
const FS_APPLYMASK=`uniform sampler2D uSrc; uniform sampler2D uM;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); o=texelFetch(uSrc,p,0)*texelFetch(uM,p,0).r; }`;
const FS_INVERT=`uniform sampler2D uSrc;
void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); if(c.a<=1e-6){ o=c; return; } o=vec4((1.0-c.rgb/c.a)*c.a,c.a); }`;
/* ---- maps: normal from height, lit material preview ---- */
/* Sobel slope of the height composite -> tangent-space normal (OpenGL: green = up), combined with
   any painted/loaded normal detail by reoriented normal blending. uFlipY gives DirectX (green = down). */
const FS_NRM=`uniform sampler2D uH; uniform sampler2D uN; uniform int uUseN; uniform float uStr; uniform int uWrap; uniform int uFlipY;
float hAt(ivec2 p){ ivec2 s=textureSize(uH,0); if(uWrap==1) p=((p%s)+s)%s; else p=clamp(p,ivec2(0),s-1); return texelFetch(uH,p,0).r; }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy);
  float tl=hAt(p+ivec2(-1,-1)),t=hAt(p+ivec2(0,-1)),tr=hAt(p+ivec2(1,-1)),l=hAt(p+ivec2(-1,0)),r=hAt(p+ivec2(1,0)),bl=hAt(p+ivec2(-1,1)),b=hAt(p+ivec2(0,1)),br=hAt(p+ivec2(1,1));
  float dx=((tr+2.0*r+br)-(tl+2.0*l+bl))/8.0, dy=((bl+2.0*b+br)-(tl+2.0*t+tr))/8.0;
  vec3 n=normalize(vec3(-dx*uStr, dy*uStr, 1.0));
  if(uUseN==1){ vec3 d=texelFetch(uN,p,0).rgb*2.0-1.0; vec3 tt=n+vec3(0,0,1), u=d*vec3(-1,-1,1); n=normalize(tt*dot(tt,u)/tt.z-u); }
  if(uFlipY==1) n.y=-n.y;
  o=vec4(n*0.5+0.5,1.0); }`;
/* the baked mesh normal (uB, any size) with the painted normal detail (uD) on top: reoriented normal mapping */
const FS_NRMB=`uniform sampler2D uB; uniform sampler2D uD; uniform int uFlipY;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec2 uv=(vec2(p)+0.5)/vec2(textureSize(uD,0));
  vec3 b=texture(uB,uv).rgb*2.0-1.0, d=texelFetch(uD,p,0).rgb*2.0-1.0; vec3 t=b+vec3(0,0,1), u=d*vec3(-1,-1,1);
  vec3 n=normalize(t*dot(t,u)/t.z-u); if(uFlipY==1) n.y=-n.y; o=vec4(n*0.5+0.5,1.0); }`;
const FS_MAT=`uniform sampler2D uBase; uniform sampler2D uRough; uniform sampler2D uMetal; uniform sampler2D uNrm; uniform sampler2D uAO; uniform sampler2D uEmis;
uniform int uHas; uniform vec3 uLight; uniform vec4 uDef;
vec3 lin(vec3 c){ return pow(max(c,0.0),vec3(2.2)); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 b=texelFetch(uBase,p,0); if(b.a<=1e-5){ o=vec4(0); return; }
  vec3 alb=lin(b.rgb/b.a);
  float rough=(uHas&1)!=0?texelFetch(uRough,p,0).r:uDef.x, metal=(uHas&2)!=0?texelFetch(uMetal,p,0).r:uDef.y, ao=(uHas&8)!=0?texelFetch(uAO,p,0).r:1.0;
  vec3 N=(uHas&4)!=0?normalize(texelFetch(uNrm,p,0).rgb*2.0-1.0):vec3(0,0,1); vec3 emis=(uHas&16)!=0?lin(texelFetch(uEmis,p,0).rgb):vec3(0);
  vec3 L=normalize(uLight), V=vec3(0,0,1), H=normalize(L+V);
  float NdL=max(dot(N,L),0.0), NdV=max(dot(N,V),1e-3), NdH=max(dot(N,H),0.0), VdH=max(dot(V,H),0.0);
  float a=max(rough*rough,0.002), a2=a*a, dd=NdH*NdH*(a2-1.0)+1.0, D=a2/(3.14159*dd*dd);
  float k=(rough+1.0)*(rough+1.0)/8.0, G=(NdL/(NdL*(1.0-k)+k))*(NdV/(NdV*(1.0-k)+k));
  vec3 F0=mix(vec3(0.04),alb,metal), F=F0+(1.0-F0)*pow(1.0-VdH,5.0);
  vec3 spec=D*G*F/max(4.0*NdL*NdV,1e-3);
  vec3 dif=(1.0-F)*(1.0-metal)*alb/3.14159;
  vec3 col=(dif+spec)*NdL*3.2 + (alb*(1.0-metal)*0.22 + F0*0.18)*ao + emis;
  col=col/(1.0+col*0.15); col=pow(clamp(col,0.0,1.0),vec3(1.0/2.2));
  o=vec4(col*b.a,b.a); }`;
/* ---- selections ---- */
const VS_POLY=`#version 300 es
in vec2 a; uniform vec2 uOrigin; uniform vec2 uSize; void main(){ gl_Position=vec4((a-uOrigin)/uSize*2.0-1.0,0.0,1.0); }`;
const FS_ONE=`void main(){ o=vec4(1.0); }`;
/* copy the red channel of a (chunk or upload) texture into a target as grey, offset by uOff */
const FS_RCOPY=`uniform sampler2D uSrc; uniform vec2 uOff;
void main(){ ivec2 q=ivec2(floor(gl_FragCoord.xy-uOff)); ivec2 sz=textureSize(uSrc,0);
  float v=(any(lessThan(q,ivec2(0)))||any(greaterThanEqual(q,sz)))?0.0:texelFetch(uSrc,q,0).r; o=vec4(vec3(v),1.0); }`;
/* combine the current selection with a new shape: 0 new, 1 add, 2 subtract, 3 intersect, 4 invert */
const FS_SELOP=`uniform sampler2D uOld; uniform sampler2D uShape; uniform int uMode; uniform int uOldOn;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float a=uOldOn==1?texelFetch(uOld,p,0).r:0.0; float b=texelFetch(uShape,p,0).r; float v;
  if(uMode==0) v=b; else if(uMode==1) v=max(a,b); else if(uMode==2) v=a*(1.0-b); else if(uMode==3) v=min(a,b); else v=1.0-a;
  o=vec4(vec3(clamp(v,0.0,1.0)),1.0); }`;
/* move an image by a whole-pixel offset (wrapping in tile mode) */
const FS_SHIFT=`uniform sampler2D uSrc; uniform vec2 uOff; uniform int uWrap; uniform vec4 uOutside;
void main(){ ivec2 sz=textureSize(uSrc,0); ivec2 q=ivec2(floor(gl_FragCoord.xy-uOff));
  if(uWrap==1) q=ivec2(mod(vec2(q),vec2(sz))); else if(any(lessThan(q,ivec2(0)))||any(greaterThanEqual(q,sz))){ o=uOutside; return; }
  o=texelFetch(uSrc,q,0); }`;
/* grow (max) or shrink (min) along one axis */
const FS_MORPH=`uniform sampler2D uSrc; uniform vec2 uDir; uniform int uR; uniform int uMax; uniform int uWrap;
void main(){ ivec2 sz=textureSize(uSrc,0); ivec2 p=ivec2(gl_FragCoord.xy); ivec2 d=ivec2(uDir); float v=uMax==1?0.0:1.0;
  for(int i=0;i<=1024;i++){ if(i>2*uR) break; ivec2 q=p+d*(i-uR);
    if(uWrap==1) q=ivec2(mod(vec2(q),vec2(sz))); else q=clamp(q,ivec2(0),sz-1);
    float s=texelFetch(uSrc,q,0).r; v=uMax==1?max(v,s):min(v,s); }
  o=vec4(vec3(v),1.0); }`;
const FS_THRESH=`uniform sampler2D uSrc; void main(){ float v=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0).r; o=vec4(vec3(smoothstep(0.42,0.58,v)),1.0); }`;
/* blend an edited version of a layer into the original, only inside the selection */
const FS_SELMIX=`uniform sampler2D uOld; uniform sampler2D uNew; uniform sampler2D uSel;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); o=mix(texelFetch(uOld,p,0),texelFetch(uNew,p,0),texelFetch(uSel,p,0).r); }`;
/* selection from an image: 0 alpha, 1 red, 2 green, 3 blue, 4 luminosity */
const FS_LOADSEL=`uniform sampler2D uSrc; uniform int uWhat; uniform int uInv;
void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0);
  float v=uWhat==0?c.a:uWhat==1?c.r:uWhat==2?c.g:uWhat==3?c.b:dot(c.rgb,vec3(0.299,0.587,0.114));
  if(uInv==1) v=1.0-v; o=vec4(vec3(clamp(v,0.0,1.0)),1.0); }`;
/* cut a rectangle out of an image, keeping only what is selected */
const FS_CROPSEL=`uniform sampler2D uSrc; uniform sampler2D uSel; uniform vec2 uOff; uniform int uUseSel;
void main(){ ivec2 p=ivec2(floor(gl_FragCoord.xy+uOff)); vec4 c=texelFetch(uSrc,p,0); if(uUseSel==1) c*=texelFetch(uSel,p,0).r; o=c; }`;
/* onion skin: a frame, optionally tinted, faded */
const FS_ONION=`uniform sampler2D uSrc; uniform vec3 uTint; uniform int uUseTint; uniform float uAlpha;
void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); if(uUseTint==1&&c.a>1e-6){ vec3 s=c.rgb/c.a; float l=dot(s,vec3(0.299,0.587,0.114)); c.rgb=mix(vec3(l),uTint,0.65)*c.a; } o=c*uAlpha; }`;
/* ---- gradients ---- */
/* uLut: 1-pixel-high strip of straight colour + alpha along the gradient; shapes 0 linear 1 radial 2 angle 3 reflected 4 diamond */
const FS_GRAD=GS_DITHER+`uniform sampler2D uLut; uniform vec2 uA; uniform vec2 uB; uniform int uShape; uniform int uDither; uniform float uOpacity; uniform int uGray;
uniform sampler2D uBase; uniform int uUseBase; uniform sampler2D uSelTex; uniform int uUseSel;
void main(){ vec2 p=gl_FragCoord.xy; vec2 d=uB-uA; float L2=max(dot(d,d),1e-6), L=sqrt(L2); vec2 v=p-uA; float t;
  if(uShape==0) t=dot(v,d)/L2;
  else if(uShape==1) t=length(v)/L;
  else if(uShape==2) t=fract((atan(v.y,v.x)-atan(d.y,d.x))/6.28318530718);
  else if(uShape==3) t=abs(dot(v,d)/L2);
  else { vec2 u=d/L; t=(abs(dot(v,u))+abs(dot(v,vec2(-u.y,u.x))))/L; }
  t=clamp(t,0.0,1.0); int n=textureSize(uLut,0).x-1; float x=t*float(n); int i=int(floor(x)); float f=x-float(i);
  vec4 c=mix(texelFetch(uLut,ivec2(i,0),0),texelFetch(uLut,ivec2(min(i+1,n),0),0),f);
  if(uGray==1) c.rgb=vec3(dot(c.rgb,vec3(0.299,0.587,0.114)));
  c=clamp(c,0.0,1.0); vec4 g=vec4(c.rgb*c.a,c.a)*uOpacity;
  if(uUseSel==1) g*=texelFetch(uSelTex,ivec2(p),0).r;
  if(uUseBase==1){ vec4 b=texelFetch(uBase,ivec2(p),0); g=g+b*(1.0-g.a); }
  o=uDither==1?gsQuantize(g,ivec2(p)):g; }`;
/* paint bucket: lay a colour over the old pixels by a coverage image */
const FS_FILLCOV=`uniform sampler2D uOld; uniform sampler2D uCov; uniform vec4 uColor; uniform sampler2D uSelTex; uniform int uUseSel;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float k=texelFetch(uCov,p,0).r; if(uUseSel==1) k*=texelFetch(uSelTex,p,0).r;
  vec4 b=texelFetch(uOld,p,0),c=uColor*k; o=c+b*(1.0-c.a); }`;
/* where other maps may be painted when Lock alpha is on: the base colour's alpha (times the selection) */
const FS_LOCKCOV=`uniform sampler2D uA; uniform sampler2D uSelTex; uniform int uUseSel;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float a=texelFetch(uA,p,0).a; if(uUseSel==1) a*=texelFetch(uSelTex,p,0).r; o=vec4(a); }`;
/* gradient bucket: lay a premultiplied image over the old pixels by a coverage image */
const FS_TEXCOV=`uniform sampler2D uOld; uniform sampler2D uCov; uniform sampler2D uTex; uniform sampler2D uSelTex; uniform int uUseSel;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float k=texelFetch(uCov,p,0).r; if(uUseSel==1) k*=texelFetch(uSelTex,p,0).r;
  vec4 b=texelFetch(uOld,p,0),c=texelFetch(uTex,p,0)*k; o=c+b*(1.0-c.a); }`;
/* ---- transforms ---- */
/* shared sampling of a source image in pixel coordinates; outside the image = uOutside */
const CH_SAMPLE=`
uniform sampler2D uSrc; uniform vec4 uOutside; uniform int uInterp;
vec4 fetchS(ivec2 q){ ivec2 sz=textureSize(uSrc,0); if(any(lessThan(q,ivec2(0)))||any(greaterThanEqual(q,sz))) return uOutside; return texelFetch(uSrc,q,0); }
vec4 cubW(float t){ float t2=t*t, t3=t2*t; return vec4(-0.5*t3+t2-0.5*t, 1.5*t3-2.5*t2+1.0, -1.5*t3+2.0*t2+0.5*t, 0.5*t3-0.5*t2); }
vec4 sampleAt(vec2 s){
  if(uInterp==0) return fetchS(ivec2(floor(s)));
  vec2 t=s-0.5; ivec2 i=ivec2(floor(t)); vec2 f=t-floor(t);
  if(uInterp==1) return mix(mix(fetchS(i),fetchS(i+ivec2(1,0)),f.x),mix(fetchS(i+ivec2(0,1)),fetchS(i+ivec2(1,1)),f.x),f.y);
  vec4 wx=cubW(f.x), wy=cubW(f.y); vec4 acc=vec4(0.0);
  for(int y=0;y<4;y++){ vec4 row=vec4(0.0); for(int x=0;x<4;x++) row+=fetchS(i+ivec2(x-1,y-1))*wx[x]; acc+=row*wy[y]; }
  acc.a=clamp(acc.a,0.0,1.0); acc.rgb=clamp(acc.rgb,vec3(0.0),vec3(acc.a)); return acc; }
`;
/* free transform: uH0..2 = rows of the matrix mapping a document pixel to a source pixel (projective) */
const FS_XFORM=CH_SAMPLE+`uniform vec3 uH0; uniform vec3 uH1; uniform vec3 uH2; uniform int uSS; uniform int uWrap; uniform vec4 uRect; uniform vec2 uDoc;
uniform sampler2D uBase; uniform int uUseBase;
bool mapTo(vec2 p, out vec2 s){ vec3 v=vec3(p,1.0); float z=dot(uH2,v); if(z<=1e-8) return false; s=vec2(dot(uH0,v),dot(uH1,v))/z; return true; }
vec4 one(vec2 p){ vec2 s;
  if(uWrap==0){ if(!mapTo(p,s)) return uOutside; return sampleAt(s); }
  vec2 D=uDoc;
  for(int k=0;k<9;k++){ vec2 off=vec2(float(k%3-1),float(k/3-1))*D;
    if(mapTo(p+off,s)&&s.x>=uRect.x-1.0&&s.y>=uRect.y-1.0&&s.x<=uRect.z+1.0&&s.y<=uRect.w+1.0) return sampleAt(s); }
  return uOutside; }
void main(){ vec2 p0=floor(gl_FragCoord.xy); vec4 acc=vec4(0.0); int n=max(uSS,1);
  for(int j=0;j<4;j++){ if(j>=n) break; for(int i=0;i<4;i++){ if(i>=n) break; acc+=one(p0+(vec2(float(i),float(j))+0.5)/float(n)); } }
  vec4 c=acc/float(n*n);
  if(uUseBase==1) c=c+texelFetch(uBase,ivec2(gl_FragCoord.xy),0)*(1.0-c.a);
  o=c; }`;
/* warp: a mesh whose vertices carry document position (a) and source position (b) */
const VS_MESH=`#version 300 es
in vec2 a; in vec2 b; uniform vec2 uSize; uniform vec2 uOff; out vec2 vS;
void main(){ vS=b; gl_Position=vec4((a+uOff)/uSize*2.0-1.0,0.0,1.0); }`;
const FS_MESH=CH_SAMPLE+`in vec2 vS; void main(){ o=sampleAt(vS); }`;
/* content bounds: for each column (uAxis 0) or row (1), is anything there? */
const FS_PROJ=`uniform sampler2D uSrc; uniform int uAxis; uniform int uAlphaOnly;
void main(){ ivec2 sz=textureSize(uSrc,0); int n=uAxis==0?sz.y:sz.x; int k=int(gl_FragCoord.x); float m=0.0;
  for(int i=0;i<16384;i++){ if(i>=n) break; vec4 c=texelFetch(uSrc,uAxis==0?ivec2(k,i):ivec2(i,k),0); m=max(m,uAlphaOnly==1?c.a:c.r); }
  o=vec4(step(0.002,m)); }`;

function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
/* Height needs one half-float value plus coverage, rather than three copies of the value.
   RG16F avoids WebView2/D3D11's single-resource limit at 16K, preserving both 16-bit values. */
function packedShaderSource(src,fragment,names,inputOnly){let declarations='';
  src=src.replace(/uniform\s+(?:highp\s+)?sampler2D\s+([^;]+);/g,(all,list)=>{for(const name of list.split(',').map(s=>s.trim())){if(!/^\w+$/.test(name))throw new Error('Unsupported packed sampler: '+name);names.add(name);
      declarations+=`uniform highp sampler2D ${name}; uniform bool gsPacked_${name}; uniform bool gsMono_${name};
vec4 gsDecode_${name}(vec4 c){return gsMono_${name}?vec4(c.rrr,1.0):gsPacked_${name}?vec4(c.rrr,c.g):c;}
vec4 gsFetch_${name}(ivec2 p,int l){return gsDecode_${name}(texelFetch(${name},p,l));}
vec4 gsTex_${name}(vec2 p){return gsDecode_${name}(texture(${name},p));}
${fragment?`vec4 gsTex_${name}(vec2 p,float b){return gsDecode_${name}(texture(${name},p,b));}`:''}
vec4 gsLod_${name}(vec2 p,float l){return gsDecode_${name}(textureLod(${name},p,l));}
vec4 gsGrad_${name}(vec2 p,vec2 x,vec2 y){return gsDecode_${name}(textureGrad(${name},p,x,y));}
`;}
    return '';});
  for(const name of names)for(const [fn,to] of [['texelFetch','gsFetch'],['textureLod','gsLod'],['textureGrad','gsGrad'],['texture','gsTex']])src=src.replace(new RegExp('\\b'+fn+'\\(\\s*'+name+'\\s*,','g'),to+'_'+name+'(');
  if(fragment&&!inputOnly){src=src.replace(/void\s+main\s*\(\s*\)/,'void gsOriginalMain()');src+=`\nuniform bool gsPackedOut; uniform int gsPackedTint; uniform sampler2D gsPackedDst; uniform vec2 gsPackedOrigin;
void main(){gsOriginalMain();if(gsPackedOut){if(gsPackedTint!=0){vec4 c=texelFetch(gsPackedDst,ivec2(gl_FragCoord.xy-gsPackedOrigin),0);vec4 d=vec4(c.rrr,c.g);if(gsPackedTint==1)o=vec4(o.rgb*(1.0-d.a)+d.rgb*d.a,d.a);else o=vec4(o.rgb+d.rgb*(1.0-o.a),max(o.a,d.a));}o=vec4(o.r,o.a,0.0,o.a);}}`;}
  return src.startsWith('#version')?src.replace(/^(#version[^\n]*\n)/,'$1'+declarations):declarations+src;}
function packedProgram(prog){if(prog.packedShader)return prog;if(!prog.packedVariant){if(!prog.fs)throw new Error('This graphics operation does not support packed height.');const names=new Set(),fs=packedShaderSource(prog.fs,true,names,!!prog.decodeOnly),vs=packedShaderSource(prog.vs||VS_FULL,false,names),p=program(fs,vs);
    Object.assign(p,{packedShader:true,packNames:[...names],defaults:prog.defaults,tiled:prog.tiled,_n:prog._n});prog.packedVariant=p;}return prog.packedVariant;}
function program(fs,vs){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs||VS_FULL));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,FS_HEAD+fs));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return {p,locs:{},fs,vs};}
const P={
  stamp:program(FS_STAMP,VS_STAMP), smudge:program(FS_SMUDGE,VS_STAMP), merge:program(FS_MERGE), comp:program(FS_COMP),
  view:program(FS_VIEW,VS_VIEW), resample:program(FS_RESAMPLE), axf:program(FS_AXF), adjust:program(FS_ADJUST), blur:program(FS_BLUR),
  sharpen:program(FS_SHARPEN), poster:program(FS_POSTER), invert:program(FS_INVERT), place:program(FS_PLACE), mix:program(FS_MIX), chmerge:program(FS_CHMERGE), maskplace:program(FS_MASKPLACE), applymask:program(FS_APPLYMASK),
  poly:program(FS_ONE,VS_POLY), rcopy:program(FS_RCOPY), selop:program(FS_SELOP), shift:program(FS_SHIFT), morph:program(FS_MORPH), thresh:program(FS_THRESH),
  selmix:program(FS_SELMIX), loadsel:program(FS_LOADSEL), cropsel:program(FS_CROPSEL),
  onion:program(FS_ONION), grad:program(FS_GRAD), fillcov:program(FS_FILLCOV), nrm:program(FS_NRM), mat:program(FS_MAT), lockcov:program(FS_LOCKCOV), texcov:program(FS_TEXCOV), xform:program(FS_XFORM), proj:program(FS_PROJ), mesh:(()=>{const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,VS_MESH));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,FS_HEAD+FS_MESH));
    gl.bindAttribLocation(p,0,'a');gl.bindAttribLocation(p,1,'b');gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return {p,locs:{},fs:FS_MESH,vs:VS_MESH};})()
};
const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
