/* ================= Photo tab: the editing engine (0.60) =================
   A Lightroom-style develop pipeline on the GPU. A photo keeps its original; its edits are a small settings object, so they can
   always be changed or reset. phRender(src, dst, settings) draws the edited picture into any size of target (the screen while
   editing, the full size when exporting). Settings use Lightroom's ranges: most sliders go from -100 to +100. */
const PH_BANDS=[['Red',0],['Orange',30],['Yellow',60],['Green',120],['Aqua',180],['Blue',240],['Purple',275],['Magenta',320]];
function phDefaults(){return {
  temp:0,tint:0,exp:0,con:0,hi:0,sh:0,wh:0,bl:0,tex:0,cla:0,dehaze:0,vib:0,sat:0,
  curve:{m:[[0,0],[1,1]],r:[[0,0],[1,1]],g:[[0,0],[1,1]],b:[[0,0],[1,1]]},
  mix:{h:new Array(8).fill(0),s:new Array(8).fill(0),l:new Array(8).fill(0)},
  grade:{sh:{h:220,s:0,l:0},mid:{h:40,s:0,l:0},hi:{h:50,s:0,l:0},blend:50,bal:0},
  sharp:{amt:0,rad:1,detail:25,mask:0},nr:{lum:0,col:0},
  vig:{amt:0,mid:50,feather:50,round:0},grain:{amt:0,size:25,rough:50},
  geo:{angle:0,flipH:false,flipV:false,vert:0,horiz:0,scale:0,crop:[0,0,1,1],aspect:'original',auto:true},
  bw:false};}
const phClone=s=>JSON.parse(JSON.stringify(s));
/* a tone curve through its points (smooth, never going backwards) as 256 values */
function phCurveLut(pts){const p=pts.slice().sort((a,b)=>a[0]-b[0]),n=p.length,out=new Float32Array(256);
  if(n<2){for(let i=0;i<256;i++)out[i]=i/255;return out;}
  const dx=[],m=[],t=new Array(n).fill(0);for(let i=0;i<n-1;i++){dx.push(Math.max(1e-6,p[i+1][0]-p[i][0]));m.push((p[i+1][1]-p[i][1])/dx[i]);}
  t[0]=m[0];t[n-1]=m[n-2];for(let i=1;i<n-1;i++)t[i]=m[i-1]*m[i]<=0?0:(m[i-1]+m[i])/2;
  for(let i=0;i<n-1;i++){if(Math.abs(m[i])<1e-9){t[i]=t[i+1]=0;continue;}const a=t[i]/m[i],b=t[i+1]/m[i],h=Math.hypot(a,b);if(h>3){const k=3/h;t[i]=k*a*m[i];t[i+1]=k*b*m[i];}}
  for(let k=0;k<256;k++){const x=k/255;let i=0;while(i<n-2&&x>p[i+1][0])i++;if(x<=p[0][0]){out[k]=p[0][1];continue;}if(x>=p[n-1][0]){out[k]=p[n-1][1];continue;}
    const h=dx[i],s=(x-p[i][0])/h,s2=s*s,s3=s2*s;out[k]=Math.min(1,Math.max(0,(2*s3-3*s2+1)*p[i][1]+(s3-2*s2+s)*h*t[i]+(-2*s3+3*s2)*p[i+1][1]+(s3-s2)*h*t[i+1]));}
  return out;}
const phIsId=pts=>pts.length===2&&pts[0][0]===0&&pts[0][1]===0&&pts[1][0]===1&&pts[1][1]===1;
const FS_PHOTO=`uniform sampler2D uSrc; uniform sampler2D uBA; uniform sampler2D uBB; uniform sampler2D uBC; uniform sampler2D uCM; uniform sampler2D uCC;
uniform vec2 uSz; uniform vec2 uSrcSz; uniform vec4 uCrop; uniform float uAng; uniform vec2 uKey; uniform vec2 uFlip; uniform float uZoom;
uniform float uTemp; uniform float uTint; uniform float uExp; uniform float uCon; uniform float uHi; uniform float uSh; uniform float uWh; uniform float uBl;
uniform float uTex; uniform float uCla; uniform float uDeh; uniform float uVib; uniform float uSat; uniform float uSharp; uniform float uSharpMask; uniform float uNRL; uniform float uNRC;
uniform vec4 uMix[8]; uniform vec4 uGSh; uniform vec4 uGMid; uniform vec4 uGHi; uniform vec2 uGBal; uniform vec4 uVig; uniform vec3 uGrain; uniform float uBW; uniform float uUseCurve; uniform float uSeed;
float lum(vec3 c){ return dot(c,vec3(0.2126,0.7152,0.0722)); }
vec3 s2l(vec3 c){ return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(0.04045,c)); }
vec3 l2s(vec3 c){ c=max(c,0.0); return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(0.0031308,c)); }
vec3 rgb2hsl(vec3 c){ float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b)),l=(mx+mn)*.5,d=mx-mn,h=0.0,s=0.0;
  if(d>1e-5){ s=l>.5?d/(2.0-mx-mn):d/(mx+mn); if(mx==c.r)h=mod((c.g-c.b)/d,6.0); else if(mx==c.g)h=(c.b-c.r)/d+2.0; else h=(c.r-c.g)/d+4.0; h*=60.0; }
  return vec3(h,s,l); }
float hue2(float p,float q,float t){ t=mod(t,1.0); if(t<1.0/6.0)return p+(q-p)*6.0*t; if(t<.5)return q; if(t<2.0/3.0)return p+(q-p)*(2.0/3.0-t)*6.0; return p; }
vec3 hsl2rgb(vec3 c){ float h=mod(c.x,360.0)/360.0,s=clamp(c.y,0.0,1.0),l=clamp(c.z,0.0,1.0); if(s<1e-5)return vec3(l); float q=l<.5?l*(1.0+s):l+s-l*s,p=2.0*l-q; return vec3(hue2(p,q,h+1.0/3.0),hue2(p,q,h),hue2(p,q,h-1.0/3.0)); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453); }
void main(){
  vec2 uv=gl_FragCoord.xy/uSz;
  /* output position -> position in the original picture: crop, flips, straighten, keystone */
  vec2 p=vec2(mix(uCrop.x,uCrop.z,uv.x),mix(uCrop.y,uCrop.w,uv.y));
  vec2 q=(p-.5); q.x*=uSrcSz.x/uSrcSz.y;
  q/= uZoom; float ca=cos(uAng),sa=sin(uAng); q=vec2(ca*q.x+sa*q.y,-sa*q.x+ca*q.y);
  q.x*=1.0+uKey.x*q.y; q.y*=1.0+uKey.y*q.x;
  q.x/=uSrcSz.x/uSrcSz.y; vec2 sp=q+.5; if(uFlip.x>.5)sp.x=1.0-sp.x; if(uFlip.y>.5)sp.y=1.0-sp.y;
  vec3 s=texture(uSrc,sp).rgb;
  vec3 ba=texture(uBA,sp).rgb;
  /* noise reduction */
  if(uNRL>0.0||uNRC>0.0){ float d=length(s-ba); float w=exp(-d*d*40.0); vec3 sm=ba; float l0=lum(s),l1=lum(ba); vec3 cs=sm+(l0-l1);
    s=mix(s,mix(sm,cs,1.0-uNRC),clamp(max(uNRL,uNRC)*w,0.0,1.0)); }
  vec3 c=s2l(s);
  /* white balance and exposure in linear light */
  c*=vec3(1.0+uTemp*.35,1.0-uTint*.18,1.0-uTemp*.35); c*=exp2(uExp);
  vec3 e=l2s(c);
  float L=lum(e);
  /* contrast around the middle, then the tone regions */
  e=mix(e,e*e*(3.0-2.0*e),clamp(uCon,0.0,1.0)); if(uCon<0.0)e=mix(e,vec3(.5)+(e-.5)*(1.0+uCon),1.0);
  L=lum(e);
  float mH=smoothstep(.45,.95,L),mS=1.0-smoothstep(.05,.55,L),mW=smoothstep(.7,1.0,L),mB=1.0-smoothstep(.0,.3,L);
  e+=uHi*.35*mH*(1.0-L*.3)+uSh*.35*mS*(1.0-(1.0-L)*.3)+uWh*.25*mW+uBl*.25*mB;
  /* dehaze, clarity, texture: local contrast against blurred copies */
  if(uDeh!=0.0){ vec3 bc=texture(uBC,sp).rgb; float hz=min(bc.r,min(bc.g,bc.b)); e=(e-uDeh*hz*.9)/(1.0-uDeh*hz*.9+1e-3); e=mix(e,vec3(.5)+(e-.5)*(1.0+uDeh*.35),abs(uDeh)); }
  float Lc=lum(e);
  if(uCla!=0.0){ float lb=lum(texture(uBB,sp).rgb); e+=uCla*(Lc-lb)*(1.0-abs(Lc-.5)*1.4)*1.3; }
  if(uTex!=0.0){ float la=lum(ba); e+=uTex*(Lc-la)*.9; }
  if(uSharp>0.0){ vec3 d=e-ba; float m=smoothstep(uSharpMask*.06,uSharpMask*.06+.02,length(d)); e+=d*uSharp*2.5*(uSharpMask>0.0?m:1.0); }
  e=clamp(e,0.0,1.0);
  /* tone curves: all channels, then each colour channel */
  if(uUseCurve>.5){ e=vec3(texture(uCM,vec2(e.r*255.0/256.0+.5/256.0,.5)).r,texture(uCM,vec2(e.g*255.0/256.0+.5/256.0,.5)).r,texture(uCM,vec2(e.b*255.0/256.0+.5/256.0,.5)).r);
    e=vec3(texture(uCC,vec2(e.r*255.0/256.0+.5/256.0,.5)).r,texture(uCC,vec2(e.g*255.0/256.0+.5/256.0,.5)).g,texture(uCC,vec2(e.b*255.0/256.0+.5/256.0,.5)).b); }
  /* colour: vibrance, saturation, and the eight colour bands */
  L=lum(e);
  vec3 hsl=rgb2hsl(e);
  float satK=1.0+uSat+uVib*(1.0-hsl.y)*(1.0-.5*smoothstep(20.0,50.0,hsl.x)*(1.0-smoothstep(50.0,90.0,hsl.x)));
  e=vec3(L)+(e-vec3(L))*max(0.0,satK);
  hsl=rgb2hsl(clamp(e,0.0,1.0));
  float dh=0.0,ds=0.0,dl=0.0,wsum=0.0;
  for(int i=0;i<8;i++){ float ctr=(i==0)?0.0:(i==1)?30.0:(i==2)?60.0:(i==3)?120.0:(i==4)?180.0:(i==5)?240.0:(i==6)?275.0:320.0;
    float d=abs(mod(hsl.x-ctr+180.0,360.0)-180.0); float w=max(0.0,1.0-d/45.0); w*=smoothstep(0.0,.12,hsl.y); dh+=uMix[i].x*w; ds+=uMix[i].y*w; dl+=uMix[i].z*w; }
  hsl.x+=dh*30.0; hsl.y*=1.0+ds; hsl.z+=dl*.35*(hsl.y);
  e=hsl2rgb(hsl);
  /* colour grading: tints for shadows, middle, highlights */
  L=lum(e);
  { float bal=uGBal.x*.4; float ws=1.0-smoothstep(.0,.5+bal,L),wh=smoothstep(.5+bal,1.0,L),wm=1.0-ws-wh; wm=max(wm,0.0);
    vec3 ts=hsl2rgb(vec3(uGSh.x,1.0,.5)),tm=hsl2rgb(vec3(uGMid.x,1.0,.5)),th=hsl2rgb(vec3(uGHi.x,1.0,.5));
    float k=uGBal.y;
    vec3 tint=ts*uGSh.y*ws+tm*uGMid.y*wm+th*uGHi.y*wh; float amt=uGSh.y*ws+uGMid.y*wm+uGHi.y*wh;
    e+= (tint-vec3(amt*.5))*.6*k; e+=(uGSh.z*ws+uGMid.z*wm+uGHi.z*wh)*.3; }
  /* vignette */
  if(uVig.x!=0.0){ vec2 vq=(uv-.5)*2.0; vq.x*=mix(1.0,uSz.x/uSz.y,uVig.w); float r=length(vq)/1.41; float v=smoothstep(uVig.y,uVig.y+uVig.z+.001,r); e=uVig.x<0.0?e*(1.0+uVig.x*v):mix(e,vec3(1.0),uVig.x*v*.8); }
  /* black and white */
  if(uBW>.5){ float g=lum(e); e=vec3(g); }
  /* grain */
  if(uGrain.x>0.0){ vec2 gp=floor(gl_FragCoord.xy/max(1.0,uGrain.y)); float n=hash(gp)-.5; n=mix(n,(hash(gp*1.7+3.1)-.5),uGrain.z*.0); e+=n*uGrain.x*.35*(1.0-abs(lum(e)-.5)*1.2); }
  o=vec4(clamp(e,0.0,1.0),1.0);
}`;
const PH={prog:null,lutM:null,lutC:null,cache:{},lutKey:''};
function phProg(){if(!PH.prog)PH.prog=program(FS_PHOTO);return PH.prog;}
function phLutTex(old,data,rgba){const t=old||gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
function phLuts(s){const key=JSON.stringify(s.curve);if(PH.lutKey===key&&PH.lutM)return;PH.lutKey=key;
  const m=phCurveLut(s.curve.m),r=phCurveLut(s.curve.r),g=phCurveLut(s.curve.g),b=phCurveLut(s.curve.b),A=new Uint8Array(256*4),B=new Uint8Array(256*4);
  for(let i=0;i<256;i++){A[i*4]=A[i*4+1]=A[i*4+2]=Math.round(m[i]*255);A[i*4+3]=255;B[i*4]=Math.round(r[i]*255);B[i*4+1]=Math.round(g[i]*255);B[i*4+2]=Math.round(b[i]*255);B[i*4+3]=255;}
  PH.lutM=phLutTex(PH.lutM,m,A);PH.lutC=phLutTex(PH.lutC,g,B);}
/* a blurred copy of src (made smaller for big radii: the shader reads it at the same coordinates) */
function phBlurred(src,sigma,name){const k=Math.max(1,Math.floor(sigma/7)),w=Math.max(2,Math.round(src.w/k)),h=Math.max(2,Math.round(src.h/k)),sg=Math.max(.3,sigma/k);
  let c=PH.cache[name];if(!c||c.w!==w||c.h!==h||c.depth!==src.depth){if(c)disposeTarget(c);c=PH.cache[name]=makeTarget(w,h,src.depth,false);}
  let t=PH.cache[name+'_t'];if(!t||t.w!==w||t.h!==h||t.depth!==src.depth){if(t)disposeTarget(t);t=PH.cache[name+'_t']=makeTarget(w,h,src.depth,false);}
  const R=Math.min(48,Math.ceil(sg*3));
  if(k>1){const d=PH.cache[name+'_d']&&PH.cache[name+'_d'].w===w&&PH.cache[name+'_d'].h===h&&PH.cache[name+'_d'].depth===src.depth?PH.cache[name+'_d']:(PH.cache[name+'_d']&&disposeTarget(PH.cache[name+'_d']),PH.cache[name+'_d']=makeTarget(w,h,src.depth,false));
    run(P.f_rs,d,{uSrc:src.tex,uOut:[w,h]});run(P.blur,t,{uSrc:d.tex,uDir:[1,0],uSigma:sg,uRadius:{int:R}});}
  else run(P.blur,t,{uSrc:src.tex,uDir:[1,0],uSigma:sg,uRadius:{int:R}});
  run(P.blur,c,{uSrc:t.tex,uDir:[0,1],uSigma:sg,uRadius:{int:R}});return c;}
function phFreeCache(){for(const k in PH.cache){disposeTarget(PH.cache[k]);}PH.cache={};}
/* the crop box and turn, with the zoom that keeps a turned picture filled */
function phGeo(s,srcW,srcH){const g=s.geo,a=g.angle*Math.PI/180,ar=srcW/srcH,ca=Math.abs(Math.cos(a)),sa=Math.abs(Math.sin(a));
  const zoom=(g.auto?Math.max(1,ca+sa*Math.max(ar,1/ar)):1)*(1+g.scale/100);return {a,zoom:Math.max(.05,1/ (1/zoom) ),crop:g.crop};}
/* the size a picture ends up at after the crop (for the canvas and for export) */
function phOutSize(s,w,h){const c=s.geo.crop;return [Math.max(1,Math.round(w*(c[2]-c[0]))),Math.max(1,Math.round(h*(c[3]-c[1])))];}
/* draw the edited picture; src: the photo (w×h), dst: the output target */
function phRender(src,dst,s,opts){opts=opts||{};phLuts(s);const sc=Math.max(src.w,src.h)/2000;
  const needA=s.sharp.amt>0||s.tex!==0||s.nr.lum>0||s.nr.col>0,needB=s.cla!==0,needC=s.dehaze!==0;
  const ba=needA?phBlurred(src,Math.max(.6,(s.sharp.amt>0&&s.tex===0?s.sharp.rad*1.2:1.6)*sc*(s.tex!==0?2:1)),'ba'):src,bb=needB?phBlurred(src,28*sc,'bb'):src,bc=needC?phBlurred(src,70*sc,'bc'):src;
  const g=phGeo(s,src.w,src.h),G=s.grade,mix=new Float32Array(32);for(let i=0;i<8;i++){mix[i*4]=s.mix.h[i]/100;mix[i*4+1]=s.mix.s[i]/100;mix[i*4+2]=s.mix.l[i]/100;}
  const useCurve=!(phIsId(s.curve.m)&&phIsId(s.curve.r)&&phIsId(s.curve.g)&&phIsId(s.curve.b));
  run(phProg(),dst,{uSrc:src.tex,uBA:ba.tex,uBB:bb.tex,uBC:bc.tex,uCM:PH.lutM,uCC:PH.lutC,uSz:[dst.w,dst.h],uSrcSz:[src.w,src.h],uCrop:s.geo.crop,uAng:g.a,uKey:[s.geo.horiz/100*.5,s.geo.vert/100*.5],uFlip:[s.geo.flipH?1:0,s.geo.flipV?1:0],uZoom:g.zoom,
    uTemp:s.temp/100,uTint:s.tint/100,uExp:s.exp,uCon:s.con/100,uHi:s.hi/100,uSh:s.sh/100,uWh:s.wh/100,uBl:s.bl/100,uTex:s.tex/100,uCla:s.cla/100,uDeh:s.dehaze/100,uVib:s.vib/100,uSat:s.sat/100,
    uSharp:s.sharp.amt/150,uSharpMask:s.sharp.mask/100,uNRL:s.nr.lum/100,uNRC:s.nr.col/100,uMix:{v4a:mix},
    uGSh:[G.sh.h,G.sh.s/100,G.sh.l/100,0],uGMid:[G.mid.h,G.mid.s/100,G.mid.l/100,0],uGHi:[G.hi.h,G.hi.s/100,G.hi.l/100,0],uGBal:[G.bal/100,G.blend/100],
    uVig:[s.vig.amt/100,s.vig.mid/100*.9,s.vig.feather/100*.9,s.vig.round/100],uGrain:[s.grain.amt/100,Math.max(1,s.grain.size/12),s.grain.rough/100],uBW:s.bw?1:0,uUseCurve:useCurve?1:0,uSeed:opts.seed||0});}
