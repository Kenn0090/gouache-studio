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
/* shared by the watercolour brushes and the paper layer: value noise, and the height of each paper type (0..1) */
const MIX_NOISE=`
float wh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float wn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(wh(i),wh(i+vec2(1.0,0.0)),f.x),mix(wh(i+vec2(0.0,1.0)),wh(i+vec2(1.0,1.0)),f.x),f.y); }
float wf(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*wn(p); p=p*2.03+17.0; a*=0.5; } return s/0.9375; }
`;
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
const CH_BRUSH=PAPER_GLSL+`
uniform vec2 uCenter; uniform float uRadius; uniform float uHard; uniform float uGrain; uniform vec2 uGrainScale; uniform vec2 uPeriod;
uniform int uUseDual; uniform sampler2D uDual; uniform vec2 uDualSize; uniform vec2 uDualOff; uniform int uDualMode; uniform float uDualAmt;
float hash(vec2 p, vec2 per){ p=mod(p,per); return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p, vec2 per){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash(i,per), b=hash(i+vec2(1.0,0.0),per), c=hash(i+vec2(0.0,1.0),per), d=hash(i+vec2(1.0,1.0),per);
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
uniform int uUseTip; uniform sampler2D uTip; uniform float uAngle; uniform float uRound; uniform vec2 uFlip; uniform float uTipAspect;
/* spray paint: paint falls off smoothly from a solid core (a bell curve), and where it is thin it breaks into separate round droplets placed at random
   (a different scatter on every dab). uSpray = (droplet size in pixels, density, random seed, mist); size 0 turns it off. uSprayVar spreads the droplet sizes. */
uniform sampler2D uTexImg; uniform vec4 uTexSet; /* brush texture picture: (tile size px, depth, invert, contrast); depth 0 is off */
uniform vec3 uPaper; /* paper tooth: (paper type, texture size, strength); strength 0 is off */
uniform vec4 uSpray; uniform float uSprayVar; uniform float uSprayFleck; uniform vec3 uSprayRing; uniform float uSpraySolid;
float sph(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
float sprayN(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(sph(i),sph(i+vec2(1.0,0.0)),f.x),mix(sph(i+vec2(0.0,1.0)),sph(i+vec2(1.0,1.0)),f.x),f.y); }
float sprayMask(vec2 pix,float g){ float ds=max(uSpray.x,0.5); vec2 gp=pix/ds; vec2 c0=floor(gp); float sd=uSpray.z, cover=0.0;
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++){ vec2 c=c0+vec2(float(i),float(j));
    if(sph(c+sd)<g*uSpray.y){ vec2 dp=c+vec2(sph(c*1.7+sd+3.1),sph(c*2.3+sd+7.7)); float rv=sph(c+sd+11.0);
      float rr=0.3+(0.5+1.6*uSprayVar)*pow(rv,1.0+2.0*uSprayVar); cover=max(cover,1.0-smoothstep(rr*0.55,rr,length(gp-dp))); } }
  return max(cover,max(smoothstep(0.7,1.0,g*uSpray.y)*uSpraySolid,uSpray.w*g*0.5)); }
/* flecks: single droplets thrown out around the stroke (two sizes), thinning with distance from the centre (d is in brush radii) */
float sprayFleckMask(vec2 pix,float d){ float f=0.0,sd=uSpray.z;
  for(int k=0;k<2;k++){ float fs=max(uSpray.x*(k==0?4.0:14.0),2.0); vec2 gp=pix/fs, c=floor(gp); float pr=uSprayFleck*(k==0?0.011:0.0028)*exp(-0.9*d*d)*(1.0-smoothstep(2.2,2.8,d));
    if(sph(c+sd+21.0+float(k))<pr){ vec2 dp=c+0.25+0.5*vec2(sph(c+sd+23.0),sph(c+sd+29.0)); float rr=(k==0?0.08:0.07)+(k==0?0.2:0.22)*pow(sph(c+sd+31.0),2.0); f=max(f,1.0-smoothstep(rr*0.6,rr,length(gp-dp))); } }
  return f; }

/* pattern brushes (0.93): the stroke's body is filled with a pattern that stays put on the canvas. uPat = (pattern, feature size in pixels, strength, seed).
   Each pattern gives a distance-like field f (0 on a mark, 1 far from it); a mark shows where f is below the brush's strength there, so marks
   grow fatter toward the middle of the stroke and thin out to scattered pieces at its edges and tail. */
uniform vec4 uPat;
float pt_h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
vec2 pt_h2(vec2 p){ return vec2(pt_h(p),pt_h(p+vec2(17.3,91.7))); }
float pt_n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(pt_h(i),pt_h(i+vec2(1.0,0.0)),f.x),mix(pt_h(i+vec2(0.0,1.0)),pt_h(i+vec2(1.0,1.0)),f.x),f.y); }
float pt_fbm(vec2 p){ return pt_n(p)*0.55+pt_n(p*2.1+7.3)*0.3+pt_n(p*4.3+3.1)*0.15; }
float pt_seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
/* short strokes at random angles, one per cell (len = half length, wid = width at full strength) */
float pt_dash(vec2 p, float seed, float len, float wid, float spread){ vec2 g=floor(p), f=fract(p); float best=1.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 c=g+vec2(float(i),float(j)); vec2 r=pt_h2(c+seed); vec2 ctr=vec2(float(i),float(j))+0.5+(r-0.5)*spread;
    float a=6.2832*pt_h(c*1.7+seed); vec2 d=vec2(cos(a),sin(a))*len*(0.6+0.8*pt_h(c+3.1)); float dd=pt_seg(f,ctr-d,ctr+d);
    best=min(best,dd/wid+0.75*pt_h(c+9.0)); }
  return best; }
/* round specks of very different sizes (salt, speckles, splatters) */
float pt_specks(vec2 p, float seed, float rmax, float skew){ vec2 g=floor(p), f=fract(p); float best=1.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 c=g+vec2(float(i),float(j)); vec2 r=pt_h2(c+seed); float h=pt_h(c*2.3+seed); float rad=rmax*(0.12+0.88*pow(h,skew));
    vec2 ctr=vec2(float(i),float(j))+0.15+0.7*r; vec2 q=(f-ctr); q.x*=1.0+0.8*(pt_h(c+5.0)-0.5); best=min(best,length(q)/rad+0.4*pt_h(c+11.0)); }
  return best; }
float pt_field(vec2 pix, int id, float S, float seed){ vec2 p=pix/S;
  if(id==1) return pt_dash(p,seed,0.30,0.16,0.7);            /* sprinkles */
  if(id==2) return pt_dash(p*1.6,seed,0.26,0.17,0.8);        /* tiny sprinkles */
  if(id==3) return pt_fbm(p*0.9+seed)*1.15;                   /* noise */
  if(id==4) return mix(pt_h(floor(pix/max(S*0.5,1.0))+seed),pt_fbm(p*0.7+seed),0.45)*1.1; /* static */
  if(id==5){ float y=p.y+0.33*sin(p.x*2.4+seed)+0.1*sin(p.x*5.1); return abs(fract(y)-0.5)*2.0+0.35*pt_n(vec2(p.x*0.8,floor(y)+seed)); } /* wavy lines */
  if(id==6){ float tr=abs(fract(p.x*0.5)-0.5)*2.0; float y=p.y+(tr-0.5)*0.9; return abs(fract(y)-0.5)*2.0+0.3*pt_n(vec2(p.x*0.6,floor(y)+seed)); } /* zig zag */
  if(id==7) return pt_dash(p,seed,0.62,0.07,0.9);             /* brush hatch */
  if(id==8){ float gx=p.x+0.35*(pt_n(vec2(p.y*0.6,seed))-0.5), gy=p.y+0.35*(pt_n(vec2(p.x*0.6,seed+5.0))-0.5);
    float f=min(abs(fract(gx)-0.5)*2.0,abs(fract(gy)-0.5)*2.0); return f+0.5*pt_n(p*1.3+seed); } /* grid */
  if(id==9){ vec2 g=floor(p), f=fract(p); float d1=9.0, d2=9.0; for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 c=g+vec2(float(i),float(j)); vec2 o=vec2(float(i),float(j))+pt_h2(c+seed); float d=length(f-o); if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d; }
    return clamp((d2-d1)*2.2,0.0,1.0)+0.25*pt_n(p*2.0+seed); } /* crackle */
  if(id==10){ vec2 w=vec2(pt_fbm(p*0.5+seed),pt_fbm(p*0.5+seed+9.7)); float n=pt_fbm(p*0.45+w*2.0+seed); return abs(fract(n*6.0)-0.5)*2.0+0.2*pt_n(p*1.7); } /* swirly */
  if(id==11||id==14){ vec2 q=p; q.x+=0.5*mod(floor(q.y),2.0); vec2 g=floor(q), f=fract(q)-0.5; vec2 j=(pt_h2(g+seed)-0.5)*0.22; return length(f-j)*2.0*(id==14?0.9:1.0)+0.3*pt_h(g+7.0); } /* pointillism */
  if(id==12) return min(pt_specks(p*1.5,seed,0.42,2.2),pt_specks(p*2.9+3.7,seed+4.0,0.4,1.8)+0.15);               /* salt and speckles */
  if(id==13) return pt_specks(p,seed,0.46,3.4);               /* splatter */
  return 1.0; }
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
    if(uSpray.x>0.0){ float core=exp(-mix(2.2,8.0,uHard)*d*d), tail=0.38*pow(max(1.0-d,0.0),2.2);
      /* a real nozzle spins the paint into a hollow cone: a ring denser than the middle (uSprayRing.x), with swirling arms that turn on every dab (y, and z is the turn) */
      if(uSprayRing.x>0.0){ /* the footprint of a hollow cone: a bright, uneven ring at the rim, a dim middle with faint ripples and blotches, and a wobbly outline */
        float an0=atan(q.y,q.x), ph=uSprayRing.z, da=d*(1.0+0.09*(sprayN(vec2(an0*1.3+ph,ph*0.7))-0.5)); vec2 dir=vec2(cos(an0),sin(an0));
        float nz=sprayN(dir*2.4+vec2(ph*0.5,d*2.0)), rim=exp(-pow((da-0.82)/0.11,2.0))*(0.45+1.0*nz);
        float ripple=0.12*(0.5+0.5*sin(da*36.0+ph))*(1.0-smoothstep(0.1,0.7,da));
        float inner=(0.07+ripple)*(0.3+1.4*sprayN(dir*3.0+vec2(ph,da*3.0)))*(1.0-smoothstep(0.7,0.9,da));
        core=mix(core,clamp(rim+inner,0.0,1.4),uSprayRing.x); }
      if(uSprayRing.y>0.0){ float an=atan(q.y,q.x); core*=clamp(1.0+uSprayRing.y*0.9*sin(3.0*an+7.0*d+uSprayRing.z),0.0,2.0); tail*=1.0+uSprayRing.y*0.3*sin(3.0*an+7.0*d+uSprayRing.z); }
 m=sprayMask(pix,max(core,tail)*(1.0-smoothstep(mix(0.9,0.97,uSprayRing.x),1.0,d))); if(uSprayFleck>0.0) m=max(m,sprayFleckMask(pix,d)); }
  }
  if(m<=0.0) return 0.0; /* nothing to grain or knock out (most of a bristle tip's square is empty) */
  if(uPaper.z>0.0){ float ph=pap_h(pix,int(uPaper.x+0.5),max(uPaper.y,0.2)); m*=clamp(1.0-uPaper.z*(1.0-smoothstep(0.40,0.60,ph)),0.0,1.0); } /* the paint only catches on the peaks of the paper */
  if(uTexSet.y>0.0){ float tv=texture(uTexImg,fract(pix/max(uTexSet.x,4.0))).r; if(uTexSet.z>0.5) tv=1.0-tv; tv=clamp((tv-0.5)*uTexSet.w+0.5,0.0,1.0); m*=mix(1.0,tv,uTexSet.y); } /* the paint only shows where the picture is light */
  if(uPat.x>0.5){ float cc=clamp(m*uPat.z*(0.8+0.4*pt_n(pix/(uPat.y*5.0)+uPat.w)),0.0,1.0); float f=pt_field(pix,int(uPat.x+0.5),max(uPat.y,1.0),uPat.w); m=1.0-smoothstep(cc-0.06,cc+0.06,f); if(cc<=0.0) m=0.0; }
  if(uGrain>0.0){ vec2 q=pix/uGrainScale; float n=vnoise(q,uPeriod)*0.6+vnoise(q*2.0,uPeriod*2.0)*0.4;
    m*=clamp(mix(1.0,n*2.3-0.5,uGrain),0.0,1.0); }
  if(uUseDual==1){ float dl=texture(uDual,(pix+uDualOff)/uDualSize).r; if(uDualMode==1) dl=1.0-dl; m*=mix(1.0,dl,uDualAmt); }
  return m; }
`;
/* paint-like mixing: the hue comes from mixing like pigments (Kubelka-Munk, one constant per channel: blue and yellow give green), but the lightness is kept
   from the two colours (OKLab), so two bright colours never mix to black */
const PIGMENT_MIX=`
uniform float uMixLab; /* 1: mix in perceptual Lab (OKLab) instead of like pigments */
vec3 pgK(vec3 c){ vec3 R=clamp(pow(max(c,vec3(0.0)),vec3(2.2)),vec3(0.004),vec3(0.996)); return (1.0-R)*(1.0-R)/(2.0*R); }
vec3 pgB(vec3 k){ vec3 R=1.0+k-sqrt(k*k+2.0*k); return pow(clamp(R,vec3(0.0),vec3(1.0)),vec3(1.0/2.2)); }
vec3 pgOK(vec3 c){ vec3 l=pow(max(c,vec3(0.0)),vec3(2.2)); vec3 q=pow(vec3(0.4122214708*l.r+0.5363325363*l.g+0.0514459929*l.b,0.2119034982*l.r+0.6806995451*l.g+0.1073969566*l.b,0.0883024619*l.r+0.2817188376*l.g+0.6299787005*l.b),vec3(1.0/3.0));
  return vec3(0.2104542553*q.x+0.7936177850*q.y-0.0040720468*q.z,1.9779984951*q.x-2.4285922050*q.y+0.4505937099*q.z,0.0259040371*q.x+0.7827717662*q.y-0.8086757660*q.z); }
vec3 pgRGB(vec3 o){ vec3 q=vec3(o.x+0.3963377774*o.y+0.2158037573*o.z,o.x-0.1055613458*o.y-0.0638541728*o.z,o.x-0.0894841775*o.y-1.2914855480*o.z); vec3 l=q*q*q;
  vec3 c=vec3(4.0767416621*l.x-3.3077115913*l.y+0.2309699292*l.z,-1.2684380046*l.x+2.6097574011*l.y-0.3413193965*l.z,-0.0041960863*l.x-0.7034186147*l.y+1.7076147010*l.z); return pow(clamp(c,vec3(0.0),vec3(1.0)),vec3(1.0/2.2)); }
vec3 pgMix(vec3 c1,vec3 c2,float k){ vec3 km=pgB(mix(pgK(c1),pgK(c2),k)); vec3 o1=pgOK(c1),o2=pgOK(c2),ok=pgOK(km); float L=mix(ok.x,mix(o1.x,o2.x,k),0.75); vec3 pig=pgRGB(vec3(L,ok.y,ok.z)); return uMixLab>0.0?mix(pig,pgRGB(mix(o1,o2,k)),uMixLab):pig; }
`;
const CH_STROKE=`
uniform int uStroke; uniform vec3 uStrokeColor; uniform int uStrokeTint; vec3 gSC; uniform float uStrokeOpacity; uniform float uEdge; uniform float uGlaze; uniform float uPig; uniform float uWet;
${PIGMENT_MIX} uniform int uLockAlpha; uniform int uChanMode; uniform vec4 uChan;
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
  /* watercolour edge: where the stroke is faint the pigment gathers, so the colour gets richer and a little deeper there */
  if(uStroke==1&&uEdge>0.0){ float e=1.0-smoothstep(0.0,0.85,clamp(cov,0.0,1.0)); float l=dot(gSC,vec3(0.299,0.587,0.114));
    gSC=clamp(mix(vec3(l),gSC,1.0+uEdge*1.5*e)*(1.0-0.2*uEdge*e),0.0,1.0); a=min(1.0,a*(1.0+0.7*uEdge*e)); }
  /* thin pigment (glaze): the stroke is a layer of pigment as thick as its coverage. Each channel lets light through like T=colour^thickness, so a thin
     layer stays bright and keeps its hue, the paper shows through and what lies under it stays visible; where the layer is full it is the plain colour */
  if(uStroke==1&&uGlaze>0.0&&a>0.0&&uChanMode!=1&&uLockAlpha!=1){ vec3 T=pow(max(gSC,vec3(0.02)),vec3(a*uPig)); float As=clamp(1.0-min(min(T.r,T.g),T.b),0.0,1.0);
    vec3 Cs=As>1e-4?clamp((T-(1.0-As))/As,0.0,1.0):gSC; gSC=mix(gSC,Cs,uGlaze); a=mix(a,As,uGlaze); }
  if(uStroke>=3){ if(L.a<=1e-6) return L; vec3 r=tonal(clamp(L.rgb/L.a,0.0,1.0),a,uStroke==3);
    if(uChanMode==1) return chanMix(L,vec4(r,L.a),1.0); return vec4(r*L.a,L.a); }
  if(uChanMode==1&&uStroke!=0){ vec4 t=uStroke==1?vec4(gSC,dot(gSC,vec3(0.299,0.587,0.114))):vec4(0.0); return chanMix(L,t,a); }
  if(uStroke==1){ if(uLockAlpha==1) return vec4(mix(L.rgb,gSC*L.a,a),L.a);
    /* wet paint: the new colour mixes with the paint it goes over like pigments, even where the stroke is solid */
    if(uWet>0.0&&L.a>1e-4&&a>0.0){ vec3 Lc=L.rgb/L.a; float na=a+L.a*(1.0-a); float kn=L.a*(1.0-a)/max(na,1e-5); float k=kn+(1.0-kn)*0.4*uWet*L.a;
      vec3 nc=(gSC*a+Lc*L.a*(1.0-a))/max(na,1e-5); vec3 mc=pgMix(gSC,Lc,k); return vec4(mix(nc,mc,min(1.0,uWet*3.0))*na,na); }
    return vec4(gSC*a,a)+L*(1.0-a); }
  if(uStroke==2){ if(uLockAlpha==1) return L; return L*(1.0-a); }
  return L; }
`;
const FS_STAMP=CH_BRUSH+`uniform float uAlpha; uniform int uTint; uniform vec3 uDabCol; void main(){ float m=brushMask(gl_FragCoord.xy)*uAlpha; if(uTint==2){ if(m<=0.0) discard; o=vec4(uDabCol,0.0); return; } o=uTint==1?vec4(uDabCol*m,m):vec4(m); }`;
/* colour-jitter strokes stamp each dab twice: uTint 2 first gives pixels nothing has touched yet the dab's colour
   (so soft edges keep it), then uTint 1 lays the dab over what is there */
const FS_SMUDGE=CH_BRUSH+`
  uniform sampler2D uSrc; uniform sampler2D uSrcPrev; uniform sampler2D uDst; uniform vec2 uDelta; uniform float uSampleBlend; uniform float uAlpha; uniform float uStrength; uniform float uCharge; uniform vec3 uColor; uniform float uHueMix; uniform int uLockAlpha; uniform int uChanMode; uniform vec4 uChan; uniform float uPaintMix; uniform int uNormalMap;
uniform sampler2D uSelTex; uniform int uUseSel;
${PIGMENT_MIX}
  vec3 smHsv(vec3 c){vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);return vec3(abs(q.z+(q.w-q.y)/(6.0*d+1e-10)),d/(q.x+1e-10),q.x);}
  vec3 smRgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);return c.z*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),c.y);}
  vec3 hueMixRgb(vec3 a,vec3 b,float t){vec3 x=smHsv(a),y=smHsv(b);float d=mod(y.x-x.x+1.5,1.0)-0.5;return smRgb(vec3(fract(x.x+d*t+1.0),mix(x.y,y.y,t),mix(x.z,y.z,t)));}
void main(){ vec2 size=vec2(textureSize(uSrc,0)); vec2 uv=gl_FragCoord.xy/size;
    vec4 dst=texture(uDst,uv); vec4 pulled=mix(texture(uSrcPrev,uv-uDelta/size),texture(uSrc,uv-uDelta/size),uSampleBlend);
  float m=brushMask(gl_FragCoord.xy)*uAlpha; if(uUseSel==1) m*=texelFetch(uSelTex,ivec2(gl_FragCoord.xy),0).r;
  vec4 paint=mix(pulled,vec4(uColor,1.0),uCharge);
  float tm=clamp(m*uStrength,0.0,1.0); vec4 r=mix(dst,paint,tm);
    if((uPaintMix>0.0||uHueMix>0.0)&&uNormalMap==0&&uChanMode!=1&&dst.a>1e-4&&paint.a>1e-4){ vec3 cd=dst.rgb/dst.a,cp=paint.rgb/paint.a; float wp=paint.a*tm,wd=dst.a*(1.0-tm); float k=wp/max(wp+wd,1e-5);
      vec3 pm=pgMix(cd,cp,k); pm=mix(pm,hueMixRgb(cd,cp,k),uHueMix); vec3 lc=r.rgb/max(r.a,1e-5); r=vec4(mix(lc,pm,max(uPaintMix,uHueMix)*clamp(tm*8.0,0.0,1.0))*r.a,r.a); }
  if(uNormalMap==1&&r.a>1e-6){ vec3 n=r.rgb/r.a*2.0-1.0; float l=length(n); n=l>1e-4?n/l:vec3(0.0,0.0,1.0); r=vec4((n*0.5+0.5)*r.a,r.a); } /* normals stay unit length */
  if(uChanMode==1){ vec3 oc=dst.a>1e-6?dst.rgb/dst.a:vec3(0.0),rc=r.a>1e-6?r.rgb/r.a:vec3(0.0); float na=mix(dst.a,r.a,uChan.a); r=vec4(mix(oc,rc,uChan.rgb)*na,na); }
  if(uLockAlpha==1){ vec3 c=r.a>1e-6?r.rgb/r.a:vec3(0.0); r=vec4(c*dst.a,dst.a); }
  o=r; }`;
const FS_MERGE=CH_STROKE+`uniform sampler2D uSrc; uniform sampler2D uStrokeTex; uniform ivec2 uSrcOrigin;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 st=texelFetch(uStrokeTex,p,0); gSC=uStrokeTint==1?st.rgb:uStrokeColor; o=applyStroke(texelFetch(uSrc,p-uSrcOrigin,0),selCov(p,st.a)); }`;
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
const FS_MASKPLACE=`uniform sampler2D uMask; uniform vec4 uRect; uniform vec2 uSourceOffset; uniform float uDef;
void main(){ ivec2 local=ivec2(floor(gl_FragCoord.xy)-uRect.xy),mp=local+ivec2(uSourceOffset); float m=uDef;
  if(local.x>=0&&local.y>=0&&local.x<int(uRect.z)&&local.y<int(uRect.w)&&mp.x>=0&&mp.y>=0&&mp.x<textureSize(uMask,0).x&&mp.y<textureSize(uMask,0).y) m=texelFetch(uMask,mp,0).r; o=vec4(vec3(m),1.0); }`;
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

/* Programs are compiled in the background: we only start the compile here and look at the result the first time a program is used
   (progOk). Asking right away made the page wait for each one in turn, which took seconds at start-up on some graphics drivers. */
const glParallel=gl.getExtension('KHR_parallel_shader_compile');
function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;}
function progOk(prog){if(prog._ok)return prog;if(prog._sh){for(const sh of prog._sh)if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));}
  if(!gl.getProgramParameter(prog.p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog.p));prog._ok=true;prog._sh=null;return prog;}
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
function packedProgram(prog){if(prog.packedShader)return prog;if(!prog.packedVariant){if(!prog.fs)throw new Error('This graphics operation does not support packed height.');const names=new Set(),fs=packedShaderSource(prog.fs,true,names,!!prog.decodeOnly),vs=packedShaderSource(prog.vs||VS_FULL,false,names),p=program(fs,vs,prog.head);
    Object.assign(p,{packedShader:true,packNames:[...names],defaults:prog.defaults,tiled:prog.tiled,_n:prog._n});prog.packedVariant=p;}return prog.packedVariant;}
function program(fs,vs,head){const p=gl.createProgram(),v=compile(gl.VERTEX_SHADER,vs||VS_FULL),f=compile(gl.FRAGMENT_SHADER,(head||FS_HEAD)+fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);return {p,locs:{},fs,vs,_sh:[v,f]};}
const P={
  stamp:program(FS_STAMP,VS_STAMP), smudge:program(FS_SMUDGE,VS_STAMP), merge:program(FS_MERGE), comp:program(FS_COMP),
  view:program(FS_VIEW,VS_VIEW), resample:program(FS_RESAMPLE), axf:program(FS_AXF), adjust:program(FS_ADJUST), blur:program(FS_BLUR),
  sharpen:program(FS_SHARPEN), poster:program(FS_POSTER), invert:program(FS_INVERT), place:program(FS_PLACE), mix:program(FS_MIX), chmerge:program(FS_CHMERGE), maskplace:program(FS_MASKPLACE), applymask:program(FS_APPLYMASK),
  poly:program(FS_ONE,VS_POLY), rcopy:program(FS_RCOPY), selop:program(FS_SELOP), shift:program(FS_SHIFT), morph:program(FS_MORPH), thresh:program(FS_THRESH),
  selmix:program(FS_SELMIX), loadsel:program(FS_LOADSEL), cropsel:program(FS_CROPSEL),
  onion:program(FS_ONION), grad:program(FS_GRAD), fillcov:program(FS_FILLCOV), nrm:program(FS_NRM), mat:program(FS_MAT), lockcov:program(FS_LOCKCOV), texcov:program(FS_TEXCOV), xform:program(FS_XFORM), proj:program(FS_PROJ), mesh:(()=>{const p=gl.createProgram(),v=compile(gl.VERTEX_SHADER,VS_MESH),f=compile(gl.FRAGMENT_SHADER,FS_HEAD+FS_MESH);gl.attachShader(p,v);gl.attachShader(p,f);
    gl.bindAttribLocation(p,0,'a');gl.bindAttribLocation(p,1,'b');gl.linkProgram(p);return {p,locs:{},fs:FS_MESH,vs:VS_MESH,_sh:[v,f]};})()
};
const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
