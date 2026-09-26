/* ================= Shaders ================= */
const VS_FULL=`#version 300 es
in vec2 a; out vec2 vUV; void main(){ vUV=a; gl_Position=vec4(a*2.0-1.0,0.0,1.0); }`;
const VS_STAMP=`#version 300 es
in vec2 a; uniform vec2 uCenter; uniform float uExtent; uniform vec2 uSize;
void main(){ vec2 p=uCenter+(a*2.0-1.0)*uExtent; gl_Position=vec4(p/uSize*2.0-1.0,0.0,1.0); }`;
const VS_VIEW=`#version 300 es
in vec2 a; uniform vec2 uOrigin; uniform vec2 uExtent; uniform vec2 uViewport; uniform vec2 uUV0; uniform vec2 uUV1; out vec2 vUV;
void main(){ vec2 p=uOrigin+a*uExtent; vUV=mix(uUV0,uUV1,a); gl_Position=vec4(p.x/uViewport.x*2.0-1.0,1.0-p.y/uViewport.y*2.0,0.0,1.0); }`;
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
uniform int uStroke; uniform vec3 uStrokeColor; uniform float uStrokeOpacity; uniform int uLockAlpha; uniform int uChanMode; uniform vec4 uChan;
vec4 chanMix(vec4 oldP, vec4 t, float a){
  vec3 oc=oldP.a>1e-6?oldP.rgb/oldP.a:vec3(0.0); float oa=oldP.a;
  vec3 nc=mix(oc,mix(oc,t.rgb,a),uChan.rgb); float na=mix(oa,mix(oa,t.a,a),uChan.a); if(uLockAlpha==1) na=oa;
  return vec4(clamp(nc,0.0,1.0)*na,na); }
vec4 applyStroke(vec4 L, float cov){
  float a=clamp(cov,0.0,1.0)*uStrokeOpacity;
  if(uChanMode==1&&uStroke!=0){ vec4 t=uStroke==1?vec4(uStrokeColor,dot(uStrokeColor,vec3(0.299,0.587,0.114))):vec4(0.0); return chanMix(L,t,a); }
  if(uStroke==1){ if(uLockAlpha==1) return vec4(mix(L.rgb,uStrokeColor*L.a,a),L.a); return vec4(uStrokeColor*a,a)+L*(1.0-a); }
  if(uStroke==2){ if(uLockAlpha==1) return L; return L*(1.0-a); }
  return L; }
`;
const FS_STAMP=CH_BRUSH+`uniform float uAlpha; void main(){ float m=brushMask(gl_FragCoord.xy)*uAlpha; o=vec4(m); }`;
const FS_SMUDGE=CH_BRUSH+`
uniform sampler2D uSrc; uniform vec2 uDelta; uniform float uAlpha; uniform float uStrength; uniform float uCharge; uniform vec3 uColor; uniform int uLockAlpha; uniform int uChanMode; uniform vec4 uChan;
void main(){ vec2 size=vec2(textureSize(uSrc,0)); vec2 uv=gl_FragCoord.xy/size;
  vec4 dst=texture(uSrc,uv); vec4 pulled=texture(uSrc,uv-uDelta/size);
  float m=brushMask(gl_FragCoord.xy)*uAlpha;
  vec4 paint=mix(pulled,vec4(uColor,1.0),uCharge);
  vec4 r=mix(dst,paint,clamp(m*uStrength,0.0,1.0));
  if(uChanMode==1){ vec3 oc=dst.a>1e-6?dst.rgb/dst.a:vec3(0.0),rc=r.a>1e-6?r.rgb/r.a:vec3(0.0); float na=mix(dst.a,r.a,uChan.a); r=vec4(mix(oc,rc,uChan.rgb)*na,na); }
  if(uLockAlpha==1){ vec3 c=r.a>1e-6?r.rgb/r.a:vec3(0.0); r=vec4(c*dst.a,dst.a); }
  o=r; }`;
const FS_MERGE=CH_STROKE+`uniform sampler2D uSrc; uniform sampler2D uStrokeTex;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); o=applyStroke(texelFetch(uSrc,p,0),texelFetch(uStrokeTex,p,0).a); }`;
const FS_COMP=CH_STROKE+`
uniform sampler2D uBase; uniform sampler2D uLayer; uniform sampler2D uStrokeTex; uniform sampler2D uMask; uniform sampler2D uMask2; uniform sampler2D uLMask;
uniform int uMode; uniform int uUseMask; uniform int uUseMask2; uniform int uUseLMask; uniform float uOpacity;
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
  vec4 b=texelFetch(uBase,p,0); vec4 s=texelFetch(uLayer,p,0);
  if(uStroke!=0) s=applyStroke(s,texelFetch(uStrokeTex,p,0).a);
  s*=uOpacity; if(uUseLMask==1) s*=texelFetch(uLMask,p,0).r;
  if(uUseMask==1) s*=texelFetch(uMask,p,0).a*(uUseMask2==1?texelFetch(uMask2,p,0).r:1.0);
  if(uMode==0){ o=s+b*(1.0-s.a); return; }
  vec3 Cs=s.a>1e-6?clamp(s.rgb/s.a,0.0,1.0):vec3(0.0); vec3 Cb=b.a>1e-6?clamp(b.rgb/b.a,0.0,1.0):vec3(0.0);
  vec3 B=clamp(blendFn(Cb,Cs),0.0,1.0);
  o=vec4(s.rgb*(1.0-b.a)+b.rgb*(1.0-s.a)+s.a*b.a*B, s.a+b.a*(1.0-s.a)); }`;
const FS_VIEW=`in vec2 vUV; uniform sampler2D uComp; uniform vec3 uChk1; uniform vec3 uChk2; uniform float uChkSize; uniform vec4 uShow; uniform int uSingle; uniform int uMaskView;
void main(){ vec4 c=texture(uComp,vUV); vec2 q=floor(gl_FragCoord.xy/uChkSize); float k=mod(q.x+q.y,2.0);
  vec3 col=c.rgb+mix(uChk1,uChk2,k)*(1.0-c.a);
  if(uMaskView==1) col=vec3(c.r);
  else if(uSingle>=0){ float v=uSingle==3?c.a:(uSingle==0?col.r:uSingle==1?col.g:col.b); col=vec3(v); }
  else { col*=uShow.rgb; if(uShow.a>0.5) col=mix(col,vec3(0.86,0.14,0.14),(1.0-c.a)*0.55); }
  if(any(lessThan(vUV,vec2(0.0)))||any(greaterThan(vUV,vec2(1.0)))) col*=0.78;
  o=vec4(col,1.0); }`;
const FS_RESAMPLE=`uniform sampler2D uSrc; uniform vec2 uOffset; uniform vec2 uScale; uniform int uTaps; uniform vec4 uOutside;
void main(){ vec2 ss=vec2(textureSize(uSrc,0)); vec2 lo=(gl_FragCoord.xy-0.5-uOffset)*uScale; vec2 hi=(gl_FragCoord.xy+0.5-uOffset)*uScale;
  vec4 acc=vec4(0.0); int n=max(uTaps,1);
  for(int j=0;j<8;j++){ if(j>=n) break; for(int i=0;i<8;i++){ if(i>=n) break;
    vec2 sp=mix(lo,hi,(vec2(float(i),float(j))+0.5)/float(n));
    if(sp.x<0.0||sp.y<0.0||sp.x>ss.x||sp.y>ss.y){ acc+=uOutside; continue; }
    acc+=texture(uSrc,sp/ss); } }
  o=acc/float(n*n); }`;
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

function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(fs,vs){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs||VS_FULL));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,FS_HEAD+fs));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return {p,locs:{}};}
const P={
  stamp:program(FS_STAMP,VS_STAMP), smudge:program(FS_SMUDGE,VS_STAMP), merge:program(FS_MERGE), comp:program(FS_COMP),
  view:program(FS_VIEW,VS_VIEW), resample:program(FS_RESAMPLE), adjust:program(FS_ADJUST), blur:program(FS_BLUR),
  sharpen:program(FS_SHARPEN), poster:program(FS_POSTER), invert:program(FS_INVERT), place:program(FS_PLACE), mix:program(FS_MIX), chmerge:program(FS_CHMERGE), maskplace:program(FS_MASKPLACE), applymask:program(FS_APPLYMASK)
};
const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
