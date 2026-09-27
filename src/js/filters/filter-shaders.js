/* ================= Shaders for converters and filters =================
   Images are premultiplied; most filters work on the straight colour and multiply back. */
const GL_ST=`vec3 st(vec4 c){ return c.a>1e-6?c.rgb/c.a:vec3(0.0); }
float lumOf(vec3 c){ return dot(c,vec3(0.2126,0.7152,0.0722)); }
ivec2 wrapP(ivec2 p,ivec2 s,int w){ return w==1?((p%s)+s)%s:clamp(p,ivec2(0),s-1); }
`;
const FILTER_FS={
  /* brightness of a colour image, as opaque grey (transparent counts as black) */
  lum:GL_ST+`uniform sampler2D uSrc; void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); float v=lumOf(st(c))*c.a; o=vec4(vec3(v),1.0); }`,
  /* height from brightness: big shapes (blurred) and fine detail (what the blur removed), each with its own weight */
  hgen:`uniform sampler2D uL; uniform sampler2D uB; uniform float uLarge; uniform float uFine; uniform float uContrast; uniform int uInv;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float l=texelFetch(uL,p,0).r, b=texelFetch(uB,p,0).r;
  float h=0.5+(b-0.5)*uLarge+(l-b)*uFine; h=(h-0.5)*uContrast+0.5; if(uInv==1) h=1.0-h; o=vec4(vec3(clamp(h,0.0,1.0)),1.0); }`,
  /* ambient occlusion from height: how far below its surroundings each point sits, at three scales */
  ao:`uniform sampler2D uH; uniform sampler2D uB1; uniform sampler2D uB2; uniform sampler2D uB3; uniform float uStr;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float h=texelFetch(uH,p,0).r;
  float d=max(texelFetch(uB1,p,0).r-h,0.0)*0.5+max(texelFetch(uB2,p,0).r-h,0.0)*0.3+max(texelFetch(uB3,p,0).r-h,0.0)*0.2;
  float a=1.0-clamp(d*uStr*6.0,0.0,1.0); o=vec4(vec3(a),1.0); }`,
  /* smooth curvature: height minus its blurred self at two scales; convex (ridges, edges) light, concave dark */
  curv:`uniform sampler2D uH; uniform sampler2D uB1; uniform sampler2D uB2; uniform float uStr; uniform int uMode;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float h=texelFetch(uH,p,0).r;
  float c=(h-texelFetch(uB1,p,0).r)*0.6+(h-texelFetch(uB2,p,0).r)*0.4; c*=uStr*8.0;
  float v=uMode==1?clamp(c,0.0,1.0):uMode==2?1.0-clamp(-c,0.0,1.0):clamp(0.5+c*0.5,0.0,1.0); o=vec4(vec3(v),1.0); }`,
  /* brightness mapped into a roughness range */
  rgen:`uniform sampler2D uL; uniform float uMin; uniform float uMax; uniform float uContrast; uniform int uInv;
void main(){ float l=texelFetch(uL,ivec2(gl_FragCoord.xy),0).r; l=clamp((l-0.5)*uContrast+0.5,0.0,1.0); if(uInv==1) l=1.0-l; o=vec4(vec3(mix(uMin,uMax,l)),1.0); }`,
  /* normal -> height: slopes from the normal (OpenGL), then a relaxation step of the Poisson equation */
  nslope:`uniform sampler2D uN; uniform int uFlip; void main(){ vec4 c=texelFetch(uN,ivec2(gl_FragCoord.xy),0); vec3 n=c.a>1e-6?c.rgb/c.a*2.0-1.0:vec3(0,0,1);
  if(uFlip==1) n.y=-n.y; n.z=max(n.z,0.15); o=vec4(-n.x/n.z*0.5+0.5, n.y/n.z*0.5+0.5, 0.0, 1.0); }`,
  ndiv:`uniform sampler2D uS; uniform int uWrap; void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uS,0);
  float gx1=texelFetch(uS,wrapP(p+ivec2(1,0),s,uWrap),0).r, gx0=texelFetch(uS,wrapP(p-ivec2(1,0),s,uWrap),0).r;
  float gy1=texelFetch(uS,wrapP(p+ivec2(0,1),s,uWrap),0).g, gy0=texelFetch(uS,wrapP(p-ivec2(0,1),s,uWrap),0).g;
  /* not tiling: no slope crosses the image edge (else the edges come out raised) */
  if(uWrap==0){ vec2 c=texelFetch(uS,p,0).rg; if(p.x==0) gx0=1.0-c.r; if(p.x==s.x-1) gx1=1.0-c.r; if(p.y==0) gy0=1.0-c.g; if(p.y==s.y-1) gy1=1.0-c.g; }
  float d=((gx1-gx0)+(gy1-gy0))*0.5*2.0; o=vec4(d,0,0,1); }`.replace('uniform sampler2D uS;',GL_ST.split('\n')[2]+'\nuniform sampler2D uS;'),
  jacobi:`uniform sampler2D uH; uniform sampler2D uD; uniform int uWrap; uniform float uScale;
ivec2 wrapP(ivec2 p,ivec2 s,int w){ return w==1?((p%s)+s)%s:clamp(p,ivec2(0),s-1); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uH,0);
  float n=texelFetch(uH,wrapP(p+ivec2(1,0),s,uWrap),0).r+texelFetch(uH,wrapP(p-ivec2(1,0),s,uWrap),0).r+texelFetch(uH,wrapP(p+ivec2(0,1),s,uWrap),0).r+texelFetch(uH,wrapP(p-ivec2(0,1),s,uWrap),0).r;
  vec2 dc=vec2(p)+0.5; float d=texture(uD,dc/vec2(s)).r*uScale; o=vec4((n-d)*0.25,0,0,1); }`,
  hnorm:`uniform sampler2D uH; uniform float uMid; uniform float uStr; void main(){ float h=texelFetch(uH,ivec2(gl_FragCoord.xy),0).r; o=vec4(vec3(clamp(0.5+(h-uMid)*uStr,0.0,1.0)),1.0); }`,
  /* flip the green channel of a normal map (DirectX <-> OpenGL) */
  flipg:`uniform sampler2D uSrc; void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); o=vec4(c.r,c.a-c.g,c.b,c.a); }`,
  /* grey-scale linear resample into a smaller / larger target */
  rs:`uniform sampler2D uSrc; uniform vec2 uOut; void main(){ o=texture(uSrc,gl_FragCoord.xy/uOut); }`,
  /* ---- adjustments: one RGB lookup (256 x 1, R,G,B curves; A = master curve) ---- */
  lut:GL_ST+`uniform sampler2D uSrc; uniform sampler2D uLut;
float lk(float v,int ch){ return texture(uLut,vec2((clamp(v,0.0,1.0)*255.0+0.5)/256.0,0.5))[ch]; }
void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); if(c.a<=1e-6){ o=c; return; } vec3 r=st(c);
  r=vec3(lk(r.r,3),lk(r.g,3),lk(r.b,3)); r=vec3(lk(r.r,0),lk(r.g,1),lk(r.b,2)); o=vec4(clamp(r,0.0,1.0)*c.a,c.a); }`,
  hsl:GL_ST+`uniform sampler2D uSrc; uniform float uHue; uniform float uSat; uniform float uLight; uniform int uColorize;
vec3 rgb2hsl(vec3 c){ float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b)),l=(mx+mn)*0.5,d=mx-mn; if(d<1e-5) return vec3(0,0,l);
  float s=l>0.5?d/(2.0-mx-mn):d/(mx+mn); float h=mx==c.r?(c.g-c.b)/d+(c.g<c.b?6.0:0.0):mx==c.g?(c.b-c.r)/d+2.0:(c.r-c.g)/d+4.0; return vec3(h/6.0,s,l); }
float h2r(float p,float q,float t){ t=fract(t); if(t<1.0/6.0) return p+(q-p)*6.0*t; if(t<0.5) return q; if(t<2.0/3.0) return p+(q-p)*(2.0/3.0-t)*6.0; return p; }
vec3 hsl2rgb(vec3 h){ if(h.y<1e-5) return vec3(h.z); float q=h.z<0.5?h.z*(1.0+h.y):h.z+h.y-h.z*h.y,p=2.0*h.z-q; return vec3(h2r(p,q,h.x+1.0/3.0),h2r(p,q,h.x),h2r(p,q,h.x-1.0/3.0)); }
void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); if(c.a<=1e-6){ o=c; return; } vec3 h=rgb2hsl(st(c));
  if(uColorize==1){ h.x=uHue; h.y=clamp(uSat,0.0,1.0); } else { h.x=fract(h.x+uHue); h.y=clamp(h.y*(1.0+uSat),0.0,1.0); }
  h.z=uLight>0.0?mix(h.z,1.0,uLight):h.z*(1.0+uLight); o=vec4(hsl2rgb(h)*c.a,c.a); }`,
  gmap:GL_ST+`uniform sampler2D uSrc; uniform sampler2D uLut; uniform int uRev;
void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); if(c.a<=1e-6){ o=c; return; } float l=lumOf(st(c)); if(uRev==1) l=1.0-l;
  vec4 g=texture(uLut,vec2((l*511.0+0.5)/512.0,0.5)); o=vec4(clamp(g.rgb,0.0,1.0)*c.a,c.a); }`,
  thresh:GL_ST+`uniform sampler2D uSrc; uniform float uT; void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); float v=lumOf(st(c))>=uT?1.0:0.0; o=vec4(vec3(v)*c.a,c.a); }`,
  desat:GL_ST+`uniform sampler2D uSrc; void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); o=vec4(vec3(lumOf(st(c)))*c.a,c.a); }`,
  /* ---- blurs ---- */
  /* edge-preserving: neighbours count less the more their colour differs */
  surface:GL_ST+`uniform sampler2D uSrc; uniform int uR; uniform float uT; uniform int uWrap;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec4 c0=texelFetch(uSrc,p,0); vec3 s0=st(c0); vec4 acc=vec4(0); float ws=0.0; float sg=float(uR)*0.5+0.5;
  for(int y=-12;y<=12;y++){ if(abs(y)>uR) continue; for(int x=-12;x<=12;x++){ if(abs(x)>uR) continue;
    vec4 c=texelFetch(uSrc,wrapP(p+ivec2(x,y),s,uWrap),0); vec3 d=st(c)-s0; float w=exp(-dot(d,d)/(2.0*uT*uT))*exp(-float(x*x+y*y)/(2.0*sg*sg)); acc+=c*w; ws+=w; } }
  o=acc/max(ws,1e-6); }`,
  motion:`uniform sampler2D uSrc; uniform vec2 uDir; uniform float uLen;
void main(){ vec2 s=vec2(textureSize(uSrc,0)),uv=gl_FragCoord.xy/s; vec4 a=vec4(0); float n=0.0;
  for(int i=-64;i<=64;i++){ float t=float(i)/64.0; a+=texture(uSrc,uv+uDir*t*uLen*0.5/s); n+=1.0; } o=a/n; }`,
  box:`uniform sampler2D uSrc; uniform vec2 uDir; uniform int uR; uniform int uWrap;
ivec2 wrapP(ivec2 p,ivec2 s,int w){ return w==1?((p%s)+s)%s:clamp(p,ivec2(0),s-1); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec4 a=vec4(0); ivec2 d=ivec2(uDir);
  for(int i=-256;i<=256;i++){ if(i<-uR) continue; if(i>uR) break; a+=texelFetch(uSrc,wrapP(p+d*i,s,uWrap),0); } o=a/float(2*uR+1); }`,
  /* radial: spin (around the centre) or zoom (towards it) */
  radial:`uniform sampler2D uSrc; uniform vec2 uC; uniform float uAmt; uniform int uZoom;
void main(){ vec2 s=vec2(textureSize(uSrc,0)),p=gl_FragCoord.xy,d=p-uC; vec4 a=vec4(0); float n=0.0;
  for(int i=0;i<64;i++){ float t=(float(i)/63.0-0.5); vec2 q;
    if(uZoom==1) q=uC+d*(1.0+t*uAmt); else { float ang=t*uAmt; float c=cos(ang),sn=sin(ang); q=uC+vec2(d.x*c-d.y*sn,d.x*sn+d.y*c); }
    a+=texture(uSrc,q/s); n+=1.0; } o=a/n; }`,
  /* lens blur: a camera-like out-of-focus blur; bright spots bloom into round or six-sided highlights */
  lens:`uniform sampler2D uSrc; uniform float uR; uniform float uBoost; uniform float uThr; uniform int uShape; uniform float uRot;
float inShape(vec2 q){ if(uShape==0) return 1.0; float a=atan(q.y,q.x)-uRot, r=length(q); float k=3.14159265/3.0; float m=cos(k*0.5)/cos(mod(a,k)-k*0.5); return r<=m?1.0:0.0; }
void main(){ vec2 s=vec2(textureSize(uSrc,0)),p=gl_FragCoord.xy; vec4 acc=vec4(0); float ws=0.0;
  for(int i=0;i<192;i++){ float f=(float(i)+0.5)/192.0, r=sqrt(f), ang=float(i)*2.39996323; vec2 q=vec2(cos(ang),sin(ang))*r; if(inShape(q)<0.5) continue;
    vec4 c=texture(uSrc,(p+q*uR)/s); vec3 st=c.a>1e-6?c.rgb/c.a:vec3(0); float l=dot(st,vec3(0.2126,0.7152,0.0722));
    float w=1.0+uBoost*pow(max(l-uThr,0.0)/max(1.0-uThr,1e-3),2.0)*8.0; acc+=c*w; ws+=w; }
  o=acc/max(ws,1e-6); }`,
  /* edge wear: lighten raised edges and darken cavities of the colour, using a curvature image (mid-grey flat) */
  cwear:`uniform sampler2D uSrc; uniform sampler2D uC; uniform float uEdge; uniform float uCav; uniform vec3 uEC; uniform vec3 uCC; uniform int uEM; uniform int uCM; uniform float uSharp; uniform float uK;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(uSrc,p,0); if(s.a<=1e-6){ o=s; return; } vec3 c=s.rgb/s.a; float k=0.5+(texelFetch(uC,p,0).r-0.5)*uK;
  float e=clamp((k-0.5)*2.0,0.0,1.0), d=clamp((0.5-k)*2.0,0.0,1.0); e=smoothstep(0.0,1.0,pow(e,1.0/uSharp)); d=smoothstep(0.0,1.0,pow(d,1.0/uSharp));
  vec3 et=uEM==0?c+(1.0-c)*0.75:uEC, ct=uCM==0?c*0.25:uCC;
  c=mix(c,et,clamp(e*uEdge,0.0,1.0)); c=mix(c,ct,clamp(d*uCav,0.0,1.0)); o=vec4(clamp(c,0.0,1.0)*s.a,s.a); }`,
  /* curvature straight from a normal map: how much the normals spread apart (ridges) or come together (cavities) */
  ncurv:`uniform sampler2D uN; uniform int uWrap; uniform float uStr; uniform int uMode; uniform float uStep;
ivec2 wrapP(ivec2 p,ivec2 s,int w){ return w==1?((p%s)+s)%s:clamp(p,ivec2(0),s-1); }
vec2 nAt(ivec2 p,ivec2 s){ vec4 c=texelFetch(uN,wrapP(p,s,uWrap),0); return c.a>1e-6?c.rg/c.a*2.0-1.0:vec2(0); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uN,0); int k=int(uStep);
  float dx=nAt(p+ivec2(k,0),s).x-nAt(p-ivec2(k,0),s).x, dy=nAt(p+ivec2(0,k),s).y-nAt(p-ivec2(0,k),s).y;
  float c=(dx-dy)*uStr*2.0/uStep;
  float v=uMode==1?clamp(c,0.0,1.0):uMode==2?1.0-clamp(-c,0.0,1.0):clamp(0.5+c*0.5,0.0,1.0); o=vec4(vec3(v),1.0); }`,
  highpass:`uniform sampler2D uSrc; uniform sampler2D uBlur; void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(uSrc,p,0),b=texelFetch(uBlur,p,0);
  if(s.a<=1e-6){ o=s; return; } vec3 r=clamp(s.rgb/s.a-(b.a>1e-6?b.rgb/b.a:vec3(0))+0.5,0.0,1.0); o=vec4(r*s.a,s.a); }`,
  /* ---- painterly ---- */
  /* Kuwahara (oil paint): each pixel takes the calmest of the four quadrants around it */
  kuwa:GL_ST+`uniform sampler2D uSrc; uniform int uR; uniform int uWrap;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec4 best=texelFetch(uSrc,p,0); float bv=1e9;
  for(int q=0;q<4;q++){ ivec2 dir=ivec2(q==0||q==2?-1:1,q<2?-1:1); vec4 m=vec4(0); vec3 m2=vec3(0); float n=0.0;
    for(int y=0;y<=10;y++){ if(y>uR) break; for(int x=0;x<=10;x++){ if(x>uR) break; vec4 c=texelFetch(uSrc,wrapP(p+ivec2(x,y)*dir,s,uWrap),0); m+=c; vec3 v=st(c); m2+=v*v; n+=1.0; } }
    m/=n; vec3 mu=st(m); vec3 var=m2/n-mu*mu; float v=var.r+var.g+var.b; if(v<bv){ bv=v; best=m; } }
  o=best; }`,
  /* structure tensor (direction of the brush strokes) */
  tensor:GL_ST+`uniform sampler2D uSrc; uniform int uWrap; void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0);
  #define L(dx,dy) st(texelFetch(uSrc,wrapP(p+ivec2(dx,dy),s,uWrap),0))
  vec3 gx=(-L(-1,-1)-2.0*L(-1,0)-L(-1,1)+L(1,-1)+2.0*L(1,0)+L(1,1))/4.0, gy=(-L(-1,-1)-2.0*L(0,-1)-L(1,-1)+L(-1,1)+2.0*L(0,1)+L(1,1))/4.0;
  o=vec4(dot(gx,gx),dot(gy,gy),dot(gx,gy),1.0); }`,
  /* anisotropic Kuwahara: eight sectors of an ellipse stretched along the stroke direction */
  akuwa:GL_ST+`uniform sampler2D uSrc; uniform sampler2D uT; uniform float uR; uniform float uQ; uniform int uWrap;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec3 t=texelFetch(uT,p,0).rgb;
  float lam1=0.5*(t.x+t.y+sqrt((t.x-t.y)*(t.x-t.y)+4.0*t.z*t.z)), lam2=0.5*(t.x+t.y-sqrt((t.x-t.y)*(t.x-t.y)+4.0*t.z*t.z));
  vec2 v=vec2(lam1-t.x,-t.z); v=length(v)>0.0?normalize(v):vec2(0,1); float phi=-atan(v.y,v.x);
  float A=lam1+lam2>0.0?(lam1-lam2)/(lam1+lam2):0.0; float a=uR*clamp((1.0+A),0.5,2.0), b=uR*clamp(1.0/(1.0+A),0.5,2.0);
  float cp=cos(phi),sp=sin(phi); mat2 SR=mat2(0.5/a,0.0,0.0,0.5/b)*mat2(cp,-sp,sp,cp);
  vec4 m[8]; vec3 s2[8]; for(int k=0;k<8;k++){ m[k]=vec4(0); s2[k]=vec3(0); }
  int R=int(ceil(max(a,b))); float wsum[8]; for(int k=0;k<8;k++) wsum[k]=0.0;
  for(int j=-12;j<=12;j++){ if(abs(j)>R) continue; for(int i=-12;i<=12;i++){ if(abs(i)>R) continue;
    vec2 d=vec2(i,j), q=SR*d; if(dot(q,q)>0.25) continue; vec4 c=texelFetch(uSrc,wrapP(p+ivec2(i,j),s,uWrap),0); vec3 cs=st(c);
    float ang=atan(q.y,q.x); float fk=(ang+3.14159265)/(2.0*3.14159265)*8.0; int k=int(floor(fk))%8; float w=1.0;
    m[k]+=c*w; s2[k]+=cs*cs*w; wsum[k]+=w; } }
  vec4 acc=vec4(0); float ws=0.0;
  for(int k=0;k<8;k++){ if(wsum[k]<=0.0) continue; vec4 mu=m[k]/wsum[k]; vec3 ms=st(mu); vec3 var=s2[k]/wsum[k]-ms*ms; float sg=sqrt(max(var.r+var.g+var.b,0.0));
    float w=1.0/(1.0+pow(255.0*sg,uQ)); acc+=mu*w; ws+=w; }
  o=ws>0.0?acc/ws:texelFetch(uSrc,p,0); }`,
  /* ---- cutout: each pixel takes the nearest colour of a small palette ---- */
  pal:GL_ST+`uniform sampler2D uSrc; uniform vec3 uPal[16]; uniform int uN;
void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); if(c.a<=1e-6){ o=c; return; } vec3 v=st(c); int bi=0; float bd=1e9;
  for(int i=0;i<16;i++){ if(i>=uN) break; vec3 d=v-uPal[i]; float e=dot(d,d); if(e<bd){ bd=e; bi=i; } } o=vec4(float(bi)/15.0,0,0,1); }`,
  /* majority vote of palette labels in a neighbourhood: smooths the cut shapes */
  vote:`uniform sampler2D uL; uniform int uR; uniform int uWrap;
ivec2 wrapP(ivec2 p,ivec2 s,int w){ return w==1?((p%s)+s)%s:clamp(p,ivec2(0),s-1); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uL,0); float cnt[16]; for(int i=0;i<16;i++) cnt[i]=0.0;
  for(int y=-6;y<=6;y++){ if(abs(y)>uR) continue; for(int x=-6;x<=6;x++){ if(abs(x)>uR||x*x+y*y>uR*uR+1) continue; int l=int(texelFetch(uL,wrapP(p+ivec2(x,y),s,uWrap),0).r*15.0+0.5); cnt[l]+=1.0; } }
  int bi=int(texelFetch(uL,p,0).r*15.0+0.5); float bc=cnt[bi]; for(int i=0;i<16;i++) if(cnt[i]>bc){ bc=cnt[i]; bi=i; } o=vec4(float(bi)/15.0,0,0,1); }`,
  paint:`uniform sampler2D uSrc; uniform sampler2D uL; uniform vec3 uPal[16];
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 c=texelFetch(uSrc,p,0); int l=int(texelFetch(uL,p,0).r*15.0+0.5); vec3 r=uPal[0]; for(int i=0;i<16;i++) if(i==l) r=uPal[i]; o=vec4(r*c.a,c.a); }`,
  /* ---- quantize: nearest of up to 64 colours, with optional ordered dithering ---- */
  quant:GL_ST+`uniform sampler2D uSrc; uniform vec3 uPal[64]; uniform int uN; uniform float uDither;
float bayer(ivec2 p){ int x=p.x&3,y=p.y&3; int m[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return (float(m[y*4+x])+0.5)/16.0; }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 c=texelFetch(uSrc,p,0); if(c.a<=1e-6){ o=c; return; } vec3 v=st(c)+(bayer(p)-0.5)*uDither; int bi=0; float bd=1e9;
  for(int i=0;i<64;i++){ if(i>=uN) break; vec3 d=v-uPal[i]; float e=dot(d,d); if(e<bd){ bd=e; bi=i; } } vec3 r=uPal[0]; for(int i=0;i<64;i++) if(i==bi) r=uPal[i]; o=vec4(r*c.a,c.a); }`,
  /* ---- mosaic: square cells of their average colour, with optional grout lines ---- */
  /* repeat the image across x down; odd rows slide by uShift; each tile turned by a random angle up to uRot */
  tile:`uniform sampler2D uSrc; uniform vec2 uN; uniform float uShift; uniform float uRot; uniform float uSeed; uniform int uFlip;
float h2(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uSeed*7.13)*43758.5453); }
void main(){ vec2 sz=vec2(textureSize(uSrc,0)); vec2 t=gl_FragCoord.xy/sz*uN; float row=floor(t.y); t.x+=mod(row,2.0)*uShift; vec2 id=floor(t); vec2 l=fract(t)-0.5;
  float a=(h2(id)*2.0-1.0)*uRot; float c=cos(a),s=sin(a); l=vec2(c*l.x-s*l.y,s*l.x+c*l.y);
  if(uFlip==1){ if(h2(id+17.0)<0.5) l.x=-l.x; if(h2(id+31.0)<0.5) l.y=-l.y; }
  o=texture(uSrc,fract(l+0.5)); }`,
  mosaic:`uniform sampler2D uSrc; uniform float uCell; uniform float uGrout; uniform vec4 uGC; uniform float uBevel;
void main(){ vec2 s=vec2(textureSize(uSrc,0)),p=gl_FragCoord.xy; vec2 cell=floor(p/uCell); vec2 c0=cell*uCell;
  vec4 acc=vec4(0); float n=0.0; for(int y=0;y<8;y++) for(int x=0;x<8;x++){ vec2 q=c0+(vec2(x,y)+0.5)*uCell/8.0; if(q.x>=s.x||q.y>=s.y) continue; acc+=texture(uSrc,q/s); n+=1.0; }
  vec4 c=acc/max(n,1.0); vec2 f=p-c0; float e=min(min(f.x,f.y),min(uCell-f.x,uCell-f.y));
  if(uBevel>0.0){ float b=clamp(e/max(uCell*0.25,1.0),0.0,1.0); float sh=(f.x+f.y)/(2.0*uCell)-0.5; c.rgb=clamp(c.rgb*(1.0-sh*uBevel*(1.0-b)*0.8),vec3(0.0),vec3(c.a)); }
  if(e<uGrout*0.5) c=uGC; o=c; }`,
  /* ---- stylize ---- */
  emboss:GL_ST+`uniform sampler2D uSrc; uniform vec2 uDir; uniform float uAmt; uniform int uWrap; uniform int uGrey;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec4 c=texelFetch(uSrc,p,0); ivec2 d=ivec2(round(uDir));
  vec3 a=st(texelFetch(uSrc,wrapP(p+d,s,uWrap),0)), b=st(texelFetch(uSrc,wrapP(p-d,s,uWrap),0)); vec3 e=(b-a)*uAmt;
  vec3 r=uGrey==1?vec3(0.5+lumOf(e)):clamp(st(c)+lumOf(e),0.0,1.0); o=vec4(clamp(r,0.0,1.0)*c.a,c.a); }`,
  edges:GL_ST+`uniform sampler2D uSrc; uniform float uAmt; uniform int uWrap; uniform int uInv;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec4 c=texelFetch(uSrc,p,0);
  #define L(dx,dy) lumOf(st(texelFetch(uSrc,wrapP(p+ivec2(dx,dy),s,uWrap),0)))
  float gx=-L(-1,-1)-2.0*L(-1,0)-L(-1,1)+L(1,-1)+2.0*L(1,0)+L(1,1), gy=-L(-1,-1)-2.0*L(0,-1)-L(1,-1)+L(-1,1)+2.0*L(0,1)+L(1,1);
  float v=clamp(length(vec2(gx,gy))*uAmt,0.0,1.0); if(uInv==1) v=1.0-v; o=vec4(vec3(v)*c.a,c.a); }`,
  /* ---- noise (tileable when the period matches the image) ---- */
  noise:`uniform sampler2D uSrc; uniform float uAmt; uniform int uMono; uniform float uSeed;
float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uSeed)*43758.5453); }
void main(){ vec2 p=gl_FragCoord.xy; vec4 c=texelFetch(uSrc,ivec2(p),0); if(c.a<=1e-6){ o=c; return; } vec3 r=c.rgb/c.a;
  vec3 n=uMono==1?vec3(h(p)-0.5):vec3(h(p),h(p+17.3),h(p+41.7))-0.5; o=vec4(clamp(r+n*uAmt,0.0,1.0)*c.a,c.a); }`,
  clouds:`uniform vec2 uSize; uniform float uScale; uniform int uOct; uniform float uRough; uniform float uSeed; uniform vec3 uA; uniform vec3 uB; uniform float uContrast;
vec2 hh(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p+uSeed)*43758.5453)*2.0-1.0; }
float gn(vec2 p,vec2 per){ vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
  float a=dot(hh(mod(i,per)),f),b=dot(hh(mod(i+vec2(1,0),per)),f-vec2(1,0)),c=dot(hh(mod(i+vec2(0,1),per)),f-vec2(0,1)),d=dot(hh(mod(i+vec2(1,1),per)),f-vec2(1,1));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
void main(){ vec2 uv=gl_FragCoord.xy/uSize; float v=0.0,amp=0.5,tot=0.0; vec2 per=vec2(max(1.0,floor(uScale+0.5)));
  for(int k=0;k<8;k++){ if(k>=uOct) break; v+=gn(uv*per,per)*amp; tot+=amp; amp*=uRough; per*=2.0; }
  v=clamp((v/tot)*uContrast*1.6+0.5,0.0,1.0); o=vec4(mix(uA,uB,v),1.0); }`,
  cells:`uniform vec2 uSize; uniform float uScale; uniform float uSeed; uniform vec3 uA; uniform vec3 uB; uniform int uMode; uniform float uJit;
vec2 hh(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)))+uSeed)*43758.5453); }
void main(){ vec2 per=vec2(max(1.0,floor(uScale+0.5))); vec2 p=gl_FragCoord.xy/uSize*per; vec2 i=floor(p),f=fract(p); float d1=9.0,d2=9.0; vec2 id=vec2(0);
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y),c=i+g; vec2 r=g+0.5+(hh(mod(c,per))-0.5)*uJit-f; float d=length(r); if(d<d1){ d2=d1; d1=d; id=mod(c,per); } else if(d<d2) d2=d; }
  float v=uMode==0?clamp(d1,0.0,1.0):uMode==1?clamp((d2-d1)*2.0,0.0,1.0):hh(id+7.0).x; o=vec4(mix(uA,uB,v),1.0); }`,
  /* ---- tiling ---- */
  seam:`uniform sampler2D uSrc; uniform float uW; void main(){ vec2 s=vec2(textureSize(uSrc,0)),p=gl_FragCoord.xy; vec4 a=texelFetch(uSrc,ivec2(p),0);
  vec4 b=texelFetch(uSrc,ivec2(mod(p+s*0.5,s)),0); vec2 e=min(p,s-p)/(s*uW*0.5); float w=clamp(min(e.x,e.y),0.0,1.0); w=w*w*(3.0-2.0*w); o=mix(b,a,w); }`,
};
/* heavy filters are drawn in tiles, so no single GPU job runs long enough for Windows to reset the driver */
const HEAVY=new Set(['box','radial','lens','surface','kuwa','akuwa','vote','motion','quant','pal']);
function runTiled(prog,target,u){const T=512;gl.enable(gl.SCISSOR_TEST);
  for(let y=0;y<target.h;y+=T)for(let x=0;x<target.w;x+=T){gl.scissor(x,y,Math.min(T,target.w-x),Math.min(T,target.h-y));run(prog,target,u);gl.flush();}
  gl.disable(gl.SCISSOR_TEST);}
Object.assign(P,Object.fromEntries(Object.entries(FILTER_FS).map(([k,fs])=>{const pr=program(fs);if(HEAVY.has(k))pr.tiled=true;return ['f_'+k,pr];})));
