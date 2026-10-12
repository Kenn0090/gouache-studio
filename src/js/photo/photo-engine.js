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
  geo:{dist:0,ca:0,angle:0,flipH:false,flipV:false,vert:0,horiz:0,scale:0,crop:[0,0,1,1],aspect:'original',auto:true},
  pts:[],local:[],spots:[],rm:[],lens:{on:false,focus:50,range:14,amount:40,hl:30},relight:{on:false,x:.3,y:.3,z:.35,int:70,rad:60,hue:40,sat:15,amb:25,dep:50},bw:false};}
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
const FS_PHOTO=`uniform sampler2D uSrc; uniform sampler2D uDN; uniform sampler2D uBA; uniform sampler2D uBB; uniform sampler2D uBC; uniform sampler2D uCM; uniform sampler2D uCC;
uniform vec2 uSz; uniform vec2 uSrcSz; uniform vec4 uCrop; uniform float uAng; uniform vec2 uKey; uniform vec2 uFlip; uniform float uZoom; uniform float uDist; uniform float uCA; uniform float uClip;
uniform float uTemp; uniform float uTint; uniform float uExp; uniform float uCon; uniform float uHi; uniform float uSh; uniform float uWh; uniform float uBl;
uniform float uTex; uniform float uCla; uniform float uDeh; uniform float uVib; uniform float uSat; uniform float uSharp; uniform float uSharpMask; uniform float uNRL; uniform float uNRC;
uniform vec4 uMix[8]; uniform vec4 uGSh; uniform vec4 uGMid; uniform vec4 uGHi; uniform vec2 uGBal; uniform vec4 uVig; uniform vec3 uGrain; uniform float uBW; uniform float uUseCurve; uniform float uSeed;
uniform sampler2D uDepth; uniform float uHasD; uniform float uLensOut; uniform vec4 uRL; uniform vec4 uRL2; uniform vec3 uRL3; uniform float uSN; uniform vec4 uSA[16]; uniform vec4 uSB[16]; uniform float uPN; uniform vec4 uPA[8]; uniform vec4 uPB[8]; uniform float uLN; uniform float uLShow; uniform sampler2D uLB; uniform vec4 uLA[8]; uniform vec4 uLG[8]; uniform vec4 uLC[8]; uniform vec4 uLD[8]; uniform vec4 uLE[8]; uniform vec4 uLF[8]; uniform vec4 uLT[8]; uniform vec4 uLH[8];
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
  q*=1.0+uDist*dot(q,q);
  q.x/=uSrcSz.x/uSrcSz.y; vec2 sp=q+.5; if(uFlip.x>.5)sp.x=1.0-sp.x; if(uFlip.y>.5)sp.y=1.0-sp.y;
  vec3 s=texture(uSrc,sp).rgb;
  if(uCA!=0.0){ vec2 cd=(sp-.5)*uCA*.0002; s.r=texture(uSrc,sp+cd).r; s.b=texture(uSrc,sp-cd).b; }
  /* spot removal: patches of the picture taken from somewhere else, healed to the light around them */
  if(uSN>0.0){ vec2 Pn=(sp-.5)*vec2(uSrcSz.x/uSrcSz.y,1.0); vec3 cs=s;
    for(int si=0;si<16;si++){ if(float(si)>=uSN)break; vec2 Cn=(uSA[si].xy-.5)*vec2(uSrcSz.x/uSrcSz.y,1.0); float d=length(Pn-Cn); float r=uSA[si].z; if(d>=r)continue;
      float w=(1.0-smoothstep(r*(1.0-uSA[si].w),r,d))*uSB[si].w; vec2 off=uSB[si].xy-uSA[si].xy; vec3 c2=texture(uSrc,sp+off).rgb;
      if(uSB[si].z>.5){ vec3 dsum=vec3(0.0); float ar0=uSrcSz.x/uSrcSz.y; for(int k=0;k<8;k++){ float an=float(k)*.7854; vec2 rv=vec2(cos(an)/ar0,sin(an))*r*1.3; dsum+=texture(uSrc,uSA[si].xy+rv).rgb-texture(uSrc,uSB[si].xy+rv).rgb; } c2+=dsum/8.0; }
      cs=mix(cs,clamp(c2,0.0,1.0),w); }
    s=cs; }
  vec3 ba=texture(uBA,sp).rgb;
  /* noise reduction: the picture comes from a filtered copy (made in an earlier pass) */
  if(uNRL>0.0||uNRC>0.0)s=texture(uDN,sp).rgb;
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
  /* local adjustments: gradients, circles and brushed areas, each with its own sliders (positions are on the original picture, so they follow the crop) */
  float wShow=0.0;
  for(int li=0;li<8;li++){ if(float(li)>=uLN)break;
    float lt=uLA[li].x; vec2 P=(sp-.5)*vec2(uSrcSz.x/uSrcSz.y,1.0); float w=0.0;
    if(lt<.5){ vec2 A=(uLG[li].xy-.5)*vec2(uSrcSz.x/uSrcSz.y,1.0),B=(uLG[li].zw-.5)*vec2(uSrcSz.x/uSrcSz.y,1.0); float tt=clamp(dot(P-A,B-A)/max(dot(B-A,B-A),1e-6),0.0,1.0); w=1.0-smoothstep(0.0,1.0,tt); }
    else if(lt<1.5){ vec2 C=(uLG[li].xy-.5)*vec2(uSrcSz.x/uSrcSz.y,1.0); vec2 d=P-C; float cr=cos(uLC[li].x),sr=sin(uLC[li].x); d=vec2(cr*d.x+sr*d.y,-sr*d.x+cr*d.y); float n=length(d/max(uLG[li].zw,vec2(1e-4))); float f=clamp(uLA[li].z,0.01,1.0); w=1.0-smoothstep(1.0-f,1.0,n); }
    else { vec4 bm=texture(uLB,sp); w=dot(bm,vec4(uLA[li].w==0.0?1.0:0.0,uLA[li].w==1.0?1.0:0.0,uLA[li].w==2.0?1.0:0.0,uLA[li].w==3.0?1.0:0.0)); }
    if(uLA[li].y>.5)w=1.0-w;
    if(uLC[li].y>.5){ if(uLC[li].y<1.5){ float l0=lum(s); float sf=uLD[li].x; w*=smoothstep(uLC[li].z-sf,uLC[li].z,l0)*(1.0-smoothstep(uLC[li].w,uLC[li].w+sf,l0)); }
      else { vec3 h0=rgb2hsl(s); float dd=abs(mod(h0.x-uLC[li].z+180.0,360.0)-180.0); w*=(1.0-smoothstep(uLC[li].w*.5,uLC[li].w,dd))*smoothstep(0.03,0.12,h0.y); } }
    w*=uLD[li].y; if(float(li)==uLShow)wShow=w;
    if(w>.001){
      vec3 c2=s2l(e); c2*=vec3(1.0+uLF[li].x*.35,1.0-uLF[li].y*.18,1.0-uLF[li].x*.35); c2*=exp2(uLE[li].x); vec3 e2=l2s(c2);
      e2=mix(e2,e2*e2*(3.0-2.0*e2),clamp(uLE[li].y,0.0,1.0)); if(uLE[li].y<0.0)e2=vec3(.5)+(e2-.5)*(1.0+uLE[li].y);
      float L2=lum(e2); float mH2=smoothstep(.45,.95,L2),mS2=1.0-smoothstep(.05,.55,L2),mW2=smoothstep(.7,1.0,L2),mB2=1.0-smoothstep(.0,.3,L2);
      e2+=uLE[li].z*.35*mH2*(1.0-L2*.3)+uLE[li].w*.35*mS2*(1.0-(1.0-L2)*.3)+uLH[li].x*.25*mW2+uLH[li].y*.25*mB2;
      if(uLT[li].z!=0.0){ vec3 bcc=texture(uBC,sp).rgb; float hz=min(bcc.r,min(bcc.g,bcc.b)); e2=(e2-uLT[li].z*hz*.9)/(1.0-uLT[li].z*hz*.9+1e-3); }
      if(uLT[li].y!=0.0){ float lb2=lum(texture(uBB,sp).rgb); e2+=uLT[li].y*(lum(e2)-lb2)*(1.0-abs(lum(e2)-.5)*1.4)*1.3; }
      if(uLT[li].x!=0.0){ e2+=uLT[li].x*(lum(e2)-lum(ba))*.9; }
      if(uLT[li].w>0.0){ e2+=(e2-ba)*uLT[li].w*2.5; }
      float L3=lum(e2); vec3 hs=rgb2hsl(clamp(e2,0.0,1.0)); float sk=1.0+uLF[li].z+uLF[li].w*(1.0-hs.y); e2=vec3(L3)+(e2-vec3(L3))*max(0.0,sk);
      e=mix(e,e2,clamp(w,0.0,1.0)); } }
  /* relight: a light you place on the picture, shading the depth map as a surface */
  if(uRL2.w>.5&&uHasD>.5){ float ar=uSrcSz.x/uSrcSz.y; vec2 px=1.0/vec2(textureSize(uDepth,0)); float d0=texture(uDepth,sp).r;
    float ddx=(texture(uDepth,sp+vec2(px.x*2.0,0.0)).r-texture(uDepth,sp-vec2(px.x*2.0,0.0)).r)/(4.0*px.x*ar), ddy=(texture(uDepth,sp+vec2(0.0,px.y*2.0)).r-texture(uDepth,sp-vec2(0.0,px.y*2.0)).r)/(4.0*px.y);
    float dsc=uRL2.z; vec3 nn=normalize(vec3(-ddx*dsc,-ddy*dsc,1.0)); vec3 tl=vec3((uRL.xy-sp)*vec2(ar,1.0),uRL.z-d0*dsc*.5); float dist=length(tl);
    float dif=max(dot(nn,tl/max(dist,1e-4)),0.0); float fall=1.0/(1.0+pow(dist/max(uRL2.x,.02),2.0));
    e=e*((1.0-uRL2.y)+uRL.w*uRL3*dif*fall*2.2); }
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
  /* point colour: a picked colour with its own hue, saturation and brightness shifts */
  for(int pi=0;pi<8;pi++){ if(float(pi)>=uPN)break; vec3 hp=rgb2hsl(clamp(e,0.0,1.0)); float rg=uPA[pi].w;
    float dh=abs(mod(hp.x-uPA[pi].x+180.0,360.0)-180.0); float wgt=(1.0-smoothstep(rg*.4,rg,dh))*(1.0-smoothstep(.25+rg/240.0,.5+rg/160.0,abs(hp.y-uPA[pi].y)))*(1.0-smoothstep(.3+rg/200.0,.6+rg/120.0,abs(hp.z-uPA[pi].z)))*smoothstep(0.02,0.1,hp.y);
    hp.x+=uPB[pi].x*wgt*40.0; hp.y=clamp(hp.y*(1.0+uPB[pi].y*wgt),0.0,1.0); hp.z=clamp(hp.z+uPB[pi].z*wgt*.3*mix(.5,1.0,hp.y),0.0,1.0); e=hsl2rgb(hp); }
  /* colour grading: tints for shadows, middle, highlights */
  L=lum(e);
  { float bal=uGBal.x*.4; float ws=1.0-smoothstep(.0,.5+bal,L),wh=smoothstep(.5+bal,1.0,L),wm=1.0-ws-wh; wm=max(wm,0.0);
    vec3 ts=hsl2rgb(vec3(uGSh.x,1.0,.5)),tm=hsl2rgb(vec3(uGMid.x,1.0,.5)),th=hsl2rgb(vec3(uGHi.x,1.0,.5));
    float k=uGBal.y;
    vec3 tint=ts*uGSh.y*ws+tm*uGMid.y*wm+th*uGHi.y*wh; float amt=uGSh.y*ws+uGMid.y*wm+uGHi.y*wh;
    e+= (tint-vec3(amt*.5))*.6*k; e+=(uGSh.z*ws+uGMid.z*wm+uGHi.z*wh)*.3; }
  /* vignette */
  if(uVig.x!=0.0){ vec2 vq=(uv-.5)*2.0; vq.x*=mix(1.0,uSz.x/uSz.y,uVig.w); float r=length(vq)/1.41; float v=smoothstep(uVig.y,uVig.y+uVig.z+.001,r); e=uVig.x<0.0?e*(1.0+uVig.x*v):mix(e,vec3(1.0),uVig.x*v*.8); }
  if(wShow>0.0)e=mix(e,vec3(.9,.1,.1),clamp(wShow,0.0,1.0)*.55);
  /* black and white */
  if(uBW>.5){ float g=lum(e); e=vec3(g); }
  /* grain */
  if(uGrain.x>0.0){ vec2 gp=floor(gl_FragCoord.xy/max(1.0,uGrain.y)); float n=hash(gp)-.5; n=mix(n,(hash(gp*1.7+3.1)-.5),uGrain.z*.0); e+=n*uGrain.x*.35*(1.0-abs(lum(e)-.5)*1.2); }
  e=clamp(e,0.0,1.0); if(uClip>.5){ if(max(e.r,max(e.g,e.b))>=.995)e=vec3(1.0,.1,.1); else if(min(e.r,min(e.g,e.b))<=.005)e=vec3(.1,.3,1.0); }
  o=vec4(e,(uLensOut>.5&&uHasD>.5)?texture(uDepth,sp).r:1.0);
}`;
const PH={prog:null,lutM:null,lutC:null,cache:{},lutKey:''};
function phProg(){if(!PH.prog)PH.prog=program(FS_PHOTO);return PH.prog;}
function phLutTex(old,data,rgba){const t=old||gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
function phLuts(s){const key=JSON.stringify(s.curve);if(PH.lutKey===key&&PH.lutM)return;PH.lutKey=key;
  const m=phCurveLut(s.curve.m),r=phCurveLut(s.curve.r),g=phCurveLut(s.curve.g),b=phCurveLut(s.curve.b),A=new Uint8Array(256*4),B=new Uint8Array(256*4);
  for(let i=0;i<256;i++){A[i*4]=A[i*4+1]=A[i*4+2]=Math.round(m[i]*255);A[i*4+3]=255;B[i*4]=Math.round(r[i]*255);B[i*4+1]=Math.round(g[i]*255);B[i*4+2]=Math.round(b[i]*255);B[i*4+3]=255;}
  PH.lutM=phLutTex(PH.lutM,m,A);PH.lutC=phLutTex(PH.lutC,g,B);}

/* noise reduction pass: an edge-keeping blur, tighter for brightness and wider for colour */
const FS_PHDN=`uniform sampler2D uSrc; uniform vec2 uPx; uniform float uL; uniform float uC; uniform float uStep;
vec3 ycc(vec3 c){ return vec3(dot(c,vec3(.299,.587,.114)),dot(c,vec3(-.1687,-.3313,.5)),dot(c,vec3(.5,-.4187,-.0813))); }
void main(){ vec2 uv=gl_FragCoord.xy*uPx; vec3 c0=texture(uSrc,uv).rgb; vec3 y0=ycc(c0);
  float sl=.015+.11*uL,sc=.02+.16*uC; float wl=0.0,wc=0.0,al=0.0; vec2 ac=vec2(0.0);
  for(int j=-3;j<=3;j++)for(int i=-3;i<=3;i++){ vec2 o=vec2(float(i),float(j));
    vec3 c1=texture(uSrc,uv+o*uPx*uStep).rgb; vec3 y1=ycc(c1); float sp=exp(-dot(o,o)/8.0);
    float dl=y1.x-y0.x; float w1=sp*exp(-dl*dl/(2.0*sl*sl)); wl+=w1; al+=w1*y1.x;
    vec3 c2=texture(uSrc,uv+o*uPx*uStep*2.2).rgb; vec3 y2=ycc(c2); vec2 dc=y2.yz-y0.yz; float dd=dl*0.0+(y2.x-y0.x); float w2=sp*exp(-(dot(dc,dc)*4.0+dd*dd)/(2.0*sc*sc)); wc+=w2; ac+=w2*y2.yz; }
  float yl=mix(y0.x,al/max(wl,1e-4),uL); vec2 cc=mix(y0.yz,ac/max(wc,1e-4),uC);
  vec3 rgb=vec3(yl+1.402*cc.y,yl-.34414*cc.x-.71414*cc.y,yl+1.772*cc.x); o=vec4(clamp(rgb,0.0,1.0),1.0); }`;
PH.dnProg=null;
function phDenoise(src,s,sc){const L=s.nr.lum/100,C=s.nr.col/100;if(!(L>0||C>0))return src;
  if(!PH.dnProg)PH.dnProg=program(FS_PHDN);let t=PH.cache.dn;if(!t||t.w!==src.w||t.h!==src.h||t.depth!==src.depth){if(t)disposeTarget(t);t=PH.cache.dn=makeTarget(src.w,src.h,src.depth,false);}
  run(PH.dnProg,t,{uSrc:src.tex,uPx:[1/src.w,1/src.h],uL:L,uC:C,uStep:Math.max(1,sc*.9)});return t;}
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
function phRenderMain(src,dst,s,opts){opts=opts||{};phLuts(s);const sc=Math.max(src.w,src.h)/2000;
  const LM=(s.local||[]).filter(m=>m.on!==false).slice(0,8),lad=k=>LM.some(m=>m.adj&&m.adj[k]),
    needA=s.sharp.amt>0||s.tex!==0||lad('tex')||lad('sharp'),needB=s.cla!==0||lad('cla'),needC=s.dehaze!==0||lad('dehaze');
  const ba=needA?phBlurred(src,Math.max(.6,(s.sharp.amt>0&&s.tex===0?s.sharp.rad*1.2:1.6)*sc*(s.tex!==0||lad('tex')?2:1)),'ba'):src,bb=needB?phBlurred(src,28*sc,'bb'):src,bc=needC?phBlurred(src,70*sc,'bc'):src;
  const dnT=phDenoise(src,s,sc),g=phGeo(s,src.w,src.h),G=s.grade,mix=new Float32Array(32);for(let i=0;i<8;i++){mix[i*4]=s.mix.h[i]/100;mix[i*4+1]=s.mix.s[i]/100;mix[i*4+2]=s.mix.l[i]/100;}
  const useCurve=!(phIsId(s.curve.m)&&phIsId(s.curve.r)&&phIsId(s.curve.g)&&phIsId(s.curve.b));
  run(phProg(),dst,Object.assign({uSrc:src.tex,uDN:dnT.tex,uBA:ba.tex,uBB:bb.tex,uBC:bc.tex,uCM:PH.lutM,uCC:PH.lutC,uSz:[dst.w,dst.h],uSrcSz:[src.w,src.h],uCrop:s.geo.crop,uAng:g.a,uKey:[s.geo.horiz/100*.5,s.geo.vert/100*.5],uFlip:[s.geo.flipH?1:0,s.geo.flipV?1:0],uZoom:g.zoom,uDist:s.geo.dist/100*.6,uCA:s.geo.ca,uClip:opts.clip?1:0,
    uTemp:s.temp/100,uTint:s.tint/100,uExp:s.exp,uCon:s.con/100,uHi:s.hi/100,uSh:s.sh/100,uWh:s.wh/100,uBl:s.bl/100,uTex:s.tex/100,uCla:s.cla/100,uDeh:s.dehaze/100,uVib:s.vib/100,uSat:s.sat/100,
    uSharp:s.sharp.amt/150,uSharpMask:s.sharp.mask/100,uNRL:s.nr.lum/100,uNRC:s.nr.col/100,uMix:{v4a:mix},
    uGSh:[G.sh.h,G.sh.s/100,G.sh.l/100,0],uGMid:[G.mid.h,G.mid.s/100,G.mid.l/100,0],uGHi:[G.hi.h,G.hi.s/100,G.hi.l/100,0],uGBal:[G.bal/100,G.blend/100],
    uVig:[s.vig.amt/100,s.vig.mid/100*.9,s.vig.feather/100*.9,s.vig.round/100],uGrain:[s.grain.amt/100,Math.max(1,s.grain.size/12),s.grain.rough/100],uBW:s.bw?1:0,uUseCurve:useCurve?1:0,uSeed:opts.seed||0},phDepthUniforms(s,opts),phPointUniforms(s),phSpotUniforms(s),phLocalUniforms(LM,src,opts)));}

/* the local adjustments as uniforms; brushed areas are painted into one RGBA picture (a channel each, up to four) on the original's own axes */
function phLocalUniforms(LM,src,opts){const N=8,mk=()=>new Float32Array(N*4),A=mk(),G=mk(),C=mk(),D=mk(),E=mk(),F=mk(),T=mk(),H=mk(),brushes=[];
  LM.forEach((m,i)=>{const a=m.adj||{},r=m.rng||{kind:'none'},o=i*4;
    A[o]=m.type==='lin'?0:m.type==='rad'?1:2;A[o+1]=m.inv?1:0;A[o+2]=(m.feather==null?50:m.feather)/100;
    let amt=(m.amt==null?100:m.amt)/100;
    if(m.type==='lin')G.set([m.a[0],m.a[1],m.b[0],m.b[1]],o);
    else if(m.type==='rad'){G.set([m.c[0],m.c[1],m.r[0],m.r[1]],o);C[o]=(m.rot||0)*Math.PI/180;}
    else if(brushes.length<4){A[o+3]=brushes.length;brushes.push(m);}else amt=0;
    C[o+1]=r.kind==='lum'?1:r.kind==='col'?2:0;
    if(r.kind==='lum'){C[o+2]=(r.lo==null?0:r.lo)/100;C[o+3]=(r.hi==null?100:r.hi)/100;D[o]=Math.max(.01,(r.soft==null?30:r.soft)/100*.3);}
    else if(r.kind==='col'){C[o+2]=r.h||0;C[o+3]=Math.max(5,r.hr==null?30:r.hr);}
    D[o+1]=amt;
    E.set([a.exp||0,(a.con||0)/100,(a.hi||0)/100,(a.sh||0)/100],o);F.set([(a.temp||0)/100,(a.tint||0)/100,(a.sat||0)/100,(a.vib||0)/100],o);
    T.set([(a.tex||0)/100,(a.cla||0)/100,(a.dehaze||0)/100,(a.sharp||0)/150],o);H.set([(a.wh||0)/100,(a.bl||0)/100,0,0],o);});
  return {uLN:LM.length,uLShow:opts&&opts.showId?LM.findIndex(m=>m.id===opts.showId):-1,uLA:{v4a:A},uLG:{v4a:G},uLC:{v4a:C},uLD:{v4a:D},uLE:{v4a:E},uLF:{v4a:F},uLT:{v4a:T},uLH:{v4a:H},uLB:phBrushTex(brushes,src.w/src.h)};}
/* the brushed masks: strokes are kept as small lists of points in the settings (so undo and sidecars cover them) and painted here */
const PH_AI={};
const PH_BRUSH={tex:null,key:'',w:0,h:0,dummy:null};
function phBrushDraw(ctx,m,W,H){ctx.clearRect(0,0,W,H);ctx.lineCap='round';ctx.lineJoin='round';
  for(const st of (m.strokes||[])){const pts=st.pts,sz=Math.max(1,st.sz*H),fe=st.fe/100,fl=st.fl/100;
    ctx.globalCompositeOperation=st.e?'destination-out':'source-over';
    const dab=(x,y)=>{const g=ctx.createRadialGradient(x,y,sz*.5*(1-fe),x,y,sz*.5);g.addColorStop(0,'rgba(255,255,255,'+fl+')');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,sz*.5,0,6.2832);ctx.fill();};
    let px=null,py=null;for(let i=0;i<pts.length;i+=2){const x=pts[i]*W,y=pts[i+1]*H;if(px===null){dab(x,y);}else{const d=Math.hypot(x-px,y-py),n=Math.max(1,Math.ceil(d/(sz*.12)));for(let k=1;k<=n;k++)dab(px+(x-px)*k/n,py+(y-py)*k/n);}px=x;py=y;}}
  ctx.globalCompositeOperation='source-over';}
function phBrushTex(list,ar){const key=ar.toFixed(4)+JSON.stringify(list.map(m=>[m.id,m.strokes,m.aid,PH_AI[m.aid]&&PH_AI[m.aid].v]));
  if(PH_BRUSH.tex&&PH_BRUSH.key===key)return PH_BRUSH.tex;
  const W=ar>=1?1024:Math.max(2,Math.round(1024*ar)),H=ar>=1?Math.max(2,Math.round(1024/ar)):1024,out=new Uint8Array(W*H*4);
  list.forEach((m,ch)=>{if(m.type==='ai'){const a=PH_AI[m.aid];if(a){for(let y=0;y<H;y++){const sy=Math.min(a.h-1,Math.floor((y+.5)/H*a.h));for(let x=0;x<W;x++)out[(y*W+x)*4+ch]=a.data[sy*a.w+Math.min(a.w-1,Math.floor((x+.5)/W*a.w))];}}return;}
    const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});phBrushDraw(x,m,W,H);const d=x.getImageData(0,0,W,H).data;for(let i=0;i<W*H;i++)out[i*4+ch]=d[i*4+3];});
  if(!PH_BRUSH.tex)PH_BRUSH.tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,PH_BRUSH.tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,out);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  PH_BRUSH.key=key;return PH_BRUSH.tex;}

function phPointUniforms(s){const L=(s.pts||[]).filter(q=>q.on!==false).slice(0,8),A=new Float32Array(32),B=new Float32Array(32);
  L.forEach((q,i)=>{A.set([q.h,q.s,q.l,q.range==null?40:q.range],i*4);B.set([(q.dh||0)/100,(q.ds||0)/100,(q.dl||0)/100,0],i*4);});
  return {uPN:L.length,uPA:{v4a:A},uPB:{v4a:B}};}

function phSpotUniforms(s){const L=(s.spots||[]).slice(0,16),A=new Float32Array(64),B=new Float32Array(64);
  L.forEach((q,i)=>{A.set([q.x,q.y,q.r,(q.fe==null?40:q.fe)/100],i*4);B.set([q.sx,q.sy,q.heal?1:0,(q.op==null?100:q.op)/100],i*4);});return {uSN:L.length,uSA:{v4a:A},uSB:{v4a:B}};}

/* depth: the grey picture (near = white) and what uses it */
function phDummyTex(){if(!PH.dummy){PH.dummy=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,PH.dummy);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,1,1,0,gl.RED,gl.UNSIGNED_BYTE,new Uint8Array([128]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);}return PH.dummy;}
function phHsvRGB(h,s,v){const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1));};return [f(5),f(3),f(1)];}
function phDepthUniforms(s,opts){const R=s.relight||{},on=!!(R.on&&opts.depth),c=phHsvRGB(R.hue==null?40:R.hue,(R.sat==null?15:R.sat)/100,1);
  return {uDepth:opts.depth||phDummyTex(),uHasD:opts.depth?1:0,uLensOut:opts.lensOut?1:0,uRL:[R.x||0,R.y||0,R.z==null?.35:R.z,(R.int==null?70:R.int)/100],uRL2:[Math.max(.02,(R.rad||60)/100),(R.amb==null?25:R.amb)/100,(R.dep==null?50:R.dep)/100*2,on?1:0],uRL3:c};}
const FS_PHLENS=`uniform sampler2D uT; uniform vec2 uSz; uniform vec4 uL; uniform float uShow;
float coc(float d){ return smoothstep(0.0,1.0,max(abs(d-uL.x)-uL.y*.35,0.0)/max(uL.y,.02)); }
void main(){ vec2 uv=gl_FragCoord.xy/uSz; vec4 c0=texture(uT,uv); if(uShow>.5){ o=vec4(vec3(c0.a),1.0); return; } float r0=coc(c0.a)*uL.z; vec3 acc=c0.rgb;
  if(r0>.6){ acc=vec3(0.0); float ws=0.0;
    for(int i=0;i<56;i++){ float fi=float(i)+.5; float rr=sqrt(fi/56.0); float ang=fi*2.39996; vec2 off=vec2(cos(ang),sin(ang))*rr*r0; vec4 c=texture(uT,uv+off/uSz); float rn=coc(c.a)*uL.z; float dist=rr*r0;
      float w=(dist<=rn+1.0?1.0:0.0)*(1.0+uL.w*pow(dot(c.rgb,vec3(.3333)),4.0)*10.0); acc+=c.rgb*w; ws+=w; }
    acc=ws>0.0?acc/ws:c0.rgb; }
  o=vec4(acc,1.0); }`;
PH.lensProg=null;
function phRender(src,dst,s,opts){opts=opts||{};const L=s.lens;if(!(opts.depth&&((L&&L.on)||opts.showDepth)))return phRenderMain(src,dst,s,opts);
  let T=PH.cache.lensT;if(!T||T.w!==dst.w||T.h!==dst.h||T.depth!==dst.depth){if(T)disposeTarget(T);T=PH.cache.lensT=makeTarget(dst.w,dst.h,dst.depth,false);}
  phRenderMain(src,T,s,Object.assign({},opts,{lensOut:1}));if(!PH.lensProg)PH.lensProg=program(FS_PHLENS);
  run(PH.lensProg,dst,{uT:T.tex,uSz:[dst.w,dst.h],uL:[L.focus/100,Math.max(.02,L.range/100),(L.on?L.amount:0)/100*.045*dst.h,L.hl/100],uShow:opts.showDepth?1:0});}
