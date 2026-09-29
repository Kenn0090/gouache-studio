/* ================= Live layer effects: Array and layer styles =================
   A layer can carry an array (L.array: copies in a line, grid or circle, with optional random
   variety) and layer styles (L.styles: shadows, glows, stroke, colour overlay, bevel & emboss).
   Both stay live: they are worked out while compositing, for every map, from the layer's own
   pixels, so painting on the layer or changing a setting updates them straight away.
   - Array copies each map of the layer the same way.
   - Styles are measured on the shape of the layer's base colour (after the array) with a distance
     field, so a stroke, glow or bevel knows how far each pixel is from the edge. In the base colour
     they draw colours; the bevel also raises the Height map (so the normal follows); a stroke or
     colour overlay can also set Roughness and Metallic where it paints.
   Results are cached per layer and map until the layer or its settings change. */

/* ---- settings ---- */
const ARRAY_DEF={on:true,mode:'line',count:5,dx:80,dy:0,cols:4,rows:3,gx:80,gy:80,cx:0,cy:0,radius:0,start:0,sweep:360,turn:true,
  vary:false,seed:1,vRot:0,vScale:0,vHue:0,vVal:0};
const STYLE_DEFS={
  drop:{label:'Drop shadow',on:false,color:[0,0,0],opacity:.6,angle:120,dist:10,size:12,spread:0},
  outerGlow:{label:'Outer glow',on:false,color:[1,.85,.45],opacity:.75,size:18,spread:0},
  stroke:{label:'Stroke',on:false,color:[0,0,0],opacity:1,size:4,pos:'outside',surf:false,rough:.4,metal:1,height:0},
  overlay:{label:'Colour overlay',on:false,color:[.85,.3,.25],opacity:1,surf:false,rough:.5,metal:0},
  innerShadow:{label:'Inner shadow',on:false,color:[0,0,0],opacity:.6,angle:120,dist:6,size:10},
  innerGlow:{label:'Inner glow',on:false,color:[1,.95,.7],opacity:.75,size:12},
  bevel:{label:'Bevel & emboss',on:false,kind:'inner',profile:'round',size:12,depth:.6,dir:'up',soften:0,shade:true,angle:120,alt:35,hi:.6,lo:.6}};
const STYLE_ORDER=['drop','outerGlow','stroke','overlay','innerShadow','innerGlow','bevel'];
const BEVEL_PROFILES=[['flat','Flat'],['round','Round'],['cove','Cove'],['ogee','Ogee'],['steps','Steps'],['pillow','Pillow']];
function newStyles(){const s={};for(const k of STYLE_ORDER){s[k]=JSON.parse(JSON.stringify(STYLE_DEFS[k]));delete s[k].label;}return s;}
const styleOn=(n,k)=>!!(n.styles&&n.styles[k]&&n.styles[k].on);
const anyStyle=n=>!!n.styles&&STYLE_ORDER.some(k=>styleOn(n,k));
const arrayOn=n=>!!(n.array&&n.array.on!==false);
function hasLook(n){return n.type==='layer'&&!n.fx&&(arrayOn(n)||anyStyle(n));}
/* which maps a layer's look draws into, even where the layer itself has nothing */
function lookTouches(n,k){if(!hasLook(n))return false;if(k==='base')return true;
  if(k==='height'&&(styleOn(n,'bevel')||(styleOn(n,'stroke')&&n.styles.stroke.height)))return true;
  if((k==='rough'||k==='metal')&&((styleOn(n,'stroke')&&n.styles.stroke.surf)||(styleOn(n,'overlay')&&n.styles.overlay.surf)))return true;
  return arrayOn(n)&&hasMap(n,k);}

/* ---- shaders ---- */
/* one copy of the layer: the content's box is drawn where the copy goes; each pixel reads the source back */
const VS_LKCOPY=`#version 300 es
in vec2 a; uniform vec4 uBox; uniform vec3 uF0; uniform vec3 uF1; uniform vec2 uSize; out vec2 vSrc;
void main(){ vec2 s=mix(uBox.xy,uBox.zw,a); vec2 d=vec2(dot(uF0,vec3(s,1.0)),dot(uF1,vec3(s,1.0))); vSrc=s/uSize; gl_Position=vec4(d/uSize*2.0-1.0,0.0,1.0); }`;
const FS_LKCOPY=`in vec2 vSrc; uniform sampler2D uSrc; uniform float uHue; uniform float uVal; uniform int uGrey;
vec3 lkHue(vec3 c,float a){ vec3 k=vec3(0.57735); float cs=cos(a),sn=sin(a); return c*cs+cross(k,c)*sn+k*dot(k,c)*(1.0-cs); }
void main(){ vec4 c=texture(uSrc,vSrc); if(uGrey==0&&c.a>1e-5&&(uHue!=0.0||uVal!=1.0)){ vec3 r=c.rgb/c.a; r=clamp(lkHue(r,uHue)*uVal,0.0,1.0); c.rgb=r*c.a; } o=c; }`;
/* distance field (jump flooding): seeds on the shape's edge, then the nearest seed spreads in halving steps */
const FS_LKSEED=`uniform sampler2D uSrc; float al(ivec2 q,ivec2 s){ q=clamp(q,ivec2(0),s-1); return texelFetch(uSrc,q,0).a; }
/* edge pixels become seeds, placed where the coverage crosses one half (between pixels), so curves stay smooth */
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); float a=al(p,s); bool c=a>=0.5;
  bool edge=c!=(al(p+ivec2(1,0),s)>=0.5)||c!=(al(p-ivec2(1,0),s)>=0.5)||c!=(al(p+ivec2(0,1),s)>=0.5)||c!=(al(p-ivec2(0,1),s)>=0.5);
  if(!edge){ o=vec4(-1.0,-1.0,0.0,0.0); return; } /* x < 0: no seed */
  vec2 g=vec2(al(p+ivec2(1,0),s)-al(p-ivec2(1,0),s),al(p+ivec2(0,1),s)-al(p-ivec2(0,1),s))*0.5; float l=length(g); vec2 off=l>1e-4?g/l*clamp((0.5-a)/l,-0.75,0.75):vec2(0.0);
  o=vec4(vec2(p)+off,0.0,1.0); }`;
const FS_LKJFA=`uniform sampler2D uSrc; uniform int uStep;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec4 best=texelFetch(uSrc,p,0); float bd=best.x>=0.0?dot(best.xy-vec2(p),best.xy-vec2(p)):1e20;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ if(x==0&&y==0) continue; ivec2 q=p+ivec2(x,y)*uStep; if(any(lessThan(q,ivec2(0)))||any(greaterThanEqual(q,s))) continue;
    vec4 c=texelFetch(uSrc,q,0); if(c.x<0.0) continue; float d=dot(c.xy-vec2(p),c.xy-vec2(p)); if(d<bd){ bd=d; best=c; } }
  o=best; }`;
/* signed distance in pixels: negative inside the shape; sub-pixel from the edge pixels' own coverage */
const FS_LKSDF=`uniform sampler2D uSeed; uniform sampler2D uShape;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(uSeed,p,0); float a=texelFetch(uShape,p,0).a; float d=s.x>=0.0?length(s.xy-vec2(p)):6e4;
  float sd=a>=0.5?-d:d; o=vec4(sd,0.0,0.0,1.0); }`;
/* the styles, for one map at a time (uMap: 0 base colour, 1 height, 2 roughness, 3 metallic).
   Each style's settings: x = on, then opacity, size and one more; colours and offsets separately. */
const FS_LKSTYLE=`uniform sampler2D uSrc; uniform sampler2D uD; uniform sampler2D uShape; uniform int uMap;
uniform vec4 uDrop; uniform vec3 uDropC; uniform vec2 uDropO;
uniform vec4 uOG; uniform vec3 uOGC;
uniform vec4 uSt; uniform vec3 uStC; uniform vec4 uStS;
uniform vec4 uOv; uniform vec3 uOvC; uniform vec3 uOvS;
uniform vec4 uIS; uniform vec3 uISC; uniform vec2 uISO;
uniform vec4 uIG; uniform vec3 uIGC;
uniform vec4 uBv; uniform vec4 uBv2; uniform vec3 uBvL; uniform vec2 uBvHL;
ivec2 SZ;
float sdAt(ivec2 q){ q=clamp(q,ivec2(0),SZ-1); return texelFetch(uD,q,0).r; }
float prof(float t,int k){ t=clamp(t,0.0,1.0);
  if(k==1) return sqrt(1.0-(1.0-t)*(1.0-t));          /* round */
  if(k==2) return 1.0-sqrt(max(1.0-t*t,0.0));         /* cove */
  if(k==3) return smoothstep(0.0,1.0,t);              /* ogee */
  if(k==4){ float u=t*2.999; return (floor(u)+smoothstep(0.3,0.7,fract(u)))/3.0; } /* steps */
  if(k==5) return sin(t*1.5707963);                   /* pillow */
  return t; }                                         /* flat (chamfer) */
/* bevel: 0..1 height at a pixel, and how much of the pixel the bevel covers */
float bevH(ivec2 q){ float sd=sdAt(q),sz=max(uBv.y,0.5); int kind=int(uBv.w+0.5); float t;
  if(kind==0){ if(sd>0.0) return 0.0; t=-sd/sz; } else if(kind==1) t=1.0-sd/sz; else t=(sz*0.5-sd)/sz;
  return prof(t,int(uBv2.x+0.5))*uBv2.y; }
float bevCov(float sd){ float sz=max(uBv.y,0.5); int kind=int(uBv.w+0.5); return kind==0?clamp(0.5-sd,0.0,1.0):kind==1?clamp(sz-sd+0.5,0.0,1.0):clamp(sz*0.5-sd+0.5,0.0,1.0); }
float ring(float sd){ float w=max(uSt.z,0.5); int pos=int(uSt.w+0.5);
  if(pos==0) return clamp(sd+0.5,0.0,1.0)*clamp(w-sd+0.5,0.0,1.0);
  if(pos==1) return clamp(0.5-sd,0.0,1.0)*clamp(w+sd+0.5,0.0,1.0);
  return clamp(w*0.5-abs(sd)+0.5,0.0,1.0); }
vec4 over(vec4 top,vec4 b){ return top+b*(1.0-top.a); }
vec3 unp(vec4 c){ return c.a>0.0?c.rgb/c.a:vec3(0.0); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); SZ=textureSize(uD,0); vec4 c=texelFetch(uSrc,p,0); float sd=sdAt(p), shp=clamp(texelFetch(uShape,p,0).a,0.0,1.0);
  if(uMap==0){ vec4 r=c;
    if(uOv.x>0.5&&r.a>0.0) r.rgb=mix(unp(r),uOvC,uOv.y)*r.a;
    if(uIS.x>0.5&&r.a>0.0){ float a=smoothstep(-max(uIS.z,0.5),0.0,sdAt(p-ivec2(round(uISO))))*uIS.y*shp; r.rgb=mix(unp(r),uISC,a)*r.a; }
    if(uIG.x>0.5&&r.a>0.0){ float a=(1.0-smoothstep(0.0,max(uIG.z,0.5),-sd))*uIG.y*shp; r.rgb=mix(unp(r),uIGC,a)*r.a; }
    if(uBv.x>0.5&&uBv2.z>0.5&&r.a>0.0){ /* slope of the bevel, smoothed over a few pixels (Sobel at two distances) so the distance field's steps don't show */
      float hx=0.0,hy=0.0; for(int st=1;st<=2;st++){ int d=st; float a1=bevH(p+ivec2(-d,-d)),a2=bevH(p+ivec2(0,-d)),a3=bevH(p+ivec2(d,-d)),b1=bevH(p+ivec2(-d,0)),b3=bevH(p+ivec2(d,0)),c1=bevH(p+ivec2(-d,d)),c2=bevH(p+ivec2(0,d)),c3=bevH(p+ivec2(d,d));
        hx+=((a3+2.0*b3+c3)-(a1+2.0*b1+c1))/(8.0*float(d)); hy+=((c1+2.0*c2+c3)-(a1+2.0*a2+a3))/(8.0*float(d)); }
      float k=0.5*uBv.z*max(uBv.y,1.0); /* hx, hy: twice the slope, as a central difference would give */
      vec3 n=normalize(vec3(-hx*k,-hy*k,1.0)); float d=dot(n,uBvL)-uBvL.z; vec3 u=unp(r);
      u=d>0.0?mix(u,vec3(1.0),clamp(d*2.0,0.0,1.0)*uBvHL.x):mix(u,vec3(0.0),clamp(-d*2.0,0.0,1.0)*uBvHL.y); r.rgb=u*r.a; }
    if(uSt.x>0.5){ float a=ring(sd)*uSt.y; r=over(vec4(uStC*a,a),r); }
    vec4 under=vec4(0.0);
    if(uOG.x>0.5){ float sz=max(uOG.z,0.5); float a=(1.0-smoothstep(sz*uOG.w,sz,max(sd,0.0)))*uOG.y; under=vec4(uOGC*a,a); }
    if(uDrop.x>0.5){ float sz=max(uDrop.z,0.5),s=sdAt(p-ivec2(round(uDropO))); float a=(1.0-smoothstep(sz*uDrop.w-0.5,sz,s))*uDrop.y; under=over(under,vec4(uDropC*a,a)); }
    o=over(r,under); return; }
  if(uMap==1){ float h=0.0,cov=0.0;
    if(uBv.x>0.5){ h+=bevH(p)*uBv.z; cov=max(cov,bevCov(sd)); }
    if(uSt.x>0.5&&uStS.w!=0.0){ float a=ring(sd); h+=uStS.w*a; cov=max(cov,a); }
    float A=max(c.a,cov),own=c.a>0.0?c.r/c.a:0.5; float v=clamp(own+h*0.5,0.0,1.0); o=vec4(vec3(v)*A,A); return; }
  if(uMap==2||uMap==3){ vec4 q=c;
    if(uOv.x>0.5&&uOvS.x>0.5){ float v=uMap==2?uOvS.y:uOvS.z; q=over(vec4(vec3(v)*shp,shp),q); }
    if(uSt.x>0.5&&uStS.x>0.5){ float a=ring(sd)*uSt.y,v=uMap==2?uStS.y:uStS.z; q=over(vec4(vec3(v)*a,a),q); }
    o=q; return; }
  o=c; }`;
let LKP=null;
function lkProgs(){if(!LKP)LKP={copy:program(FS_LKCOPY,VS_LKCOPY),seed:program(FS_LKSEED),jfa:program(FS_LKJFA),sdf:program(FS_LKSDF),style:program(FS_LKSTYLE)};return LKP;}
/* float render targets with fewer channels (the distance field of a 4K layer would otherwise take a lot of video memory):
   RG32F for seed positions while jump flooding, R16F for the finished distances. Not filtered. */
function lkTex(fmt){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texStorage2D(gl.TEXTURE_2D,1,fmt,doc.w,doc.h);
  for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
  const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  return {tex,fbo,w:doc.w,h:doc.h,depth:32};}
const lk32=()=>lkTex(gl.RG32F),lkSD=()=>lkTex(gl.R16F);
let lkS=null;/* ping-pong pair for the distance field */
function lkScratch(){if(!lkS||lkS[0].w!==doc.w||lkS[0].h!==doc.h){if(lkS)lkS.forEach(disposeTarget);lkS=[lk32(),lk32()];}return lkS;}

/* ---- array: where each copy goes ---- */
function lkRand(seed,i,k){let x=Math.sin((seed*7.13+i*127.1+k*311.7))*43758.5453;return (x-Math.floor(x))*2-1;}
/* the copies as affine maps [a,b,c,d,e,f]: x'=a x+b y+c, y'=d x+e y+f (copy 0 is the layer itself) */
function arrayCopies(A,piv){const out=[],vary=(i,M)=>{if(!A.vary||i===0)return M;const r=(A.vRot||0)*lkRand(A.seed,i,1)*Math.PI/180,s=1+(A.vScale||0)*lkRand(A.seed,i,2);
    const c=Math.cos(r)*s,sn=Math.sin(r)*s;/* rotate and scale about the copy's own centre (where the pivot lands) */
    const px=M[0]*piv[0]+M[1]*piv[1]+M[2],py=M[3]*piv[0]+M[4]*piv[1]+M[5];
    return [c*M[0]-sn*M[3],c*M[1]-sn*M[4],c*(M[2]-px)-sn*(M[5]-py)+px,sn*M[0]+c*M[3],sn*M[1]+c*M[4],sn*(M[2]-px)+c*(M[5]-py)+py];};
  const T=(x,y)=>[1,0,x,0,1,y];
  if(A.mode==='grid'){for(let r=0;r<Math.max(1,A.rows|0);r++)for(let c=0;c<Math.max(1,A.cols|0);c++)out.push(vary(out.length,T(c*A.gx,r*A.gy)));return out;}
  if(A.mode==='circle'){const n=Math.max(1,A.count|0),full=Math.abs(A.sweep)>=359.5,step=(A.sweep||360)*Math.PI/180/(full?n:Math.max(1,n-1));
    for(let i=0;i<n;i++){const t=(A.start||0)*Math.PI/180+i*step,c=Math.cos(t),s=Math.sin(t),t0=(A.start||0)*Math.PI/180;const cx=A.cx,cy=A.cy;
      const rel=t-t0,rc=Math.cos(rel),rs=Math.sin(rel);
      if(A.turn)out.push(vary(i,[rc,-rs,cx-rc*cx+rs*cy,rs,rc,cy-rs*cx-rc*cy]));
      else{const qx=cx+rc*(piv[0]-cx)-rs*(piv[1]-cy),qy=cy+rs*(piv[0]-cx)+rc*(piv[1]-cy);out.push(vary(i,T(qx-piv[0],qy-piv[1])));}}return out;}
  const n=Math.max(1,A.count|0);for(let i=0;i<n;i++)out.push(vary(i,T(i*A.dx,i*A.dy)));return out;}
function inv6(M){const det=M[0]*M[4]-M[1]*M[3]||1e-9,a=M[4]/det,b=-M[1]/det,d=-M[3]/det,e=M[0]/det;return [a,b,-(a*M[2]+b*M[5]),d,e,-(d*M[2]+e*M[5])];}
/* draw the arrayed copies of src into dst (cleared first) */
function arrayDraw(n,src,dst,k,whole){const A=n.array,P=lkProgs(),pb=n.arrBox||[0,0,doc.w,doc.h],piv=[(pb[0]+pb[2])/2,(pb[1]+pb[3])/2],box=whole?[0,0,doc.w,doc.h]:pb;clearTarget(dst);
  const grey=k!=='base',copies=arrayCopies(A,piv);
  copies.forEach((M,i)=>{const hue=!grey&&A.vary&&i?(A.vHue||0)*lkRand(A.seed,i,3)*Math.PI/180:0,val=!grey&&A.vary&&i?1+(A.vVal||0)*lkRand(A.seed,i,4):1;
    run(P.copy,dst,{uSrc:src.tex,uBox:[box[0],box[1],box[2],box[3]],uF0:[M[0],M[1],M[2]],uF1:[M[3],M[4],M[5]],uSize:[doc.w,doc.h],uHue:hue,uVal:val,uGrey:grey},{blend:'over'});});}
/* the content's box and centre, measured once when the array is set up or the layer changes */
function arrayMeasure(n){const t=mapT(n,'base');const b=t&&!t.empty?contentBounds(t):null;n.arrBox=b?[b[0]-1,b[1]-1,b[2]+1,b[3]+1]:[0,0,doc.w,doc.h];return n.arrBox;}

/* ---- distance field of a shape (its alpha), in pixels, negative inside ---- */
function lkDistance(shape,out){const P=lkProgs(),[a,b]=lkScratch();run(P.seed,a,{uSrc:shape.tex});let cur=a,nxt=b;
  let step=1;while(step*2<Math.max(doc.w,doc.h))step*=2;
  for(;step>=1;step>>=1){run(P.jfa,nxt,{uSrc:cur.tex,uStep:{int:step}});const t=cur;cur=nxt;nxt=t;}
  run(P.jfa,nxt,{uSrc:cur.tex,uStep:{int:1}});cur=nxt;/* one extra pass tidies the last errors */
  run(P.sdf,out,{uSeed:cur.tex,uShape:shape.tex});}

/* ---- the whole look of a layer for map k; returns a pooled target (release it) or src itself ---- */
const LK_MAPS={base:0,height:1,rough:2,metal:3};
function styleUniforms(S){const on=k=>S[k]&&S[k].on,u={};const col=c=>c||[0,0,0];
  const off=(ang,d)=>[-Math.cos(ang*Math.PI/180)*d,Math.sin(ang*Math.PI/180)*d];
  const D=S.drop||{},G=S.outerGlow||{},St=S.stroke||{},Ov=S.overlay||{},IS=S.innerShadow||{},IG=S.innerGlow||{},B=S.bevel||{};
  u.uDrop=[on('drop')?1:0,D.opacity||0,D.size||0,(D.spread||0)];u.uDropC=col(D.color);u.uDropO=off(D.angle||0,D.dist||0);
  u.uOG=[on('outerGlow')?1:0,G.opacity||0,G.size||0,G.spread||0];u.uOGC=col(G.color);
  u.uSt=[on('stroke')?1:0,St.opacity==null?1:St.opacity,St.size||0,{outside:0,inside:1,center:2}[St.pos]||0];u.uStC=col(St.color);u.uStS=[St.surf?1:0,St.rough||0,St.metal||0,St.height||0];
  u.uOv=[on('overlay')?1:0,Ov.opacity==null?1:Ov.opacity,0,0];u.uOvC=col(Ov.color);u.uOvS=[Ov.surf?1:0,Ov.rough||0,Ov.metal||0];
  u.uIS=[on('innerShadow')?1:0,IS.opacity||0,IS.size||0,0];u.uISC=col(IS.color);u.uISO=off(IS.angle||0,IS.dist||0);
  u.uIG=[on('innerGlow')?1:0,IG.opacity||0,IG.size||0,0];u.uIGC=col(IG.color);
  const alt=(B.alt==null?35:B.alt)*Math.PI/180,an=(B.angle==null?120:B.angle)*Math.PI/180;
  u.uBv=[on('bevel')?1:0,B.size||0,B.depth==null?.6:B.depth,{inner:0,outer:1,emboss:2}[B.kind]||0];
  u.uBv2=[Math.max(0,BEVEL_PROFILES.findIndex(p=>p[0]===B.profile)),B.dir==='down'?-1:1,B.shade===false?0:1,0];
  u.uBvL=[Math.cos(alt)*Math.cos(an),-Math.cos(alt)*Math.sin(an),Math.sin(alt)];u.uBvHL=[B.hi==null?.6:B.hi,B.lo==null?.6:B.lo];return u;}
function lookKey(n){return JSON.stringify([n.lookVer||0,doc.w,doc.h,n.array,n.styles]);}
function lookFree(n){const c=n._lk;if(!c)return;if(c.sd)disposeTarget(c.sd);if(c.shape)disposeTarget(c.shape);for(const k in c.maps)disposeTarget(c.maps[k].t);n._lk=null;}
/* (0.27) a masked layer's styles follow the masked shape (Kenn: styles did nothing on materials and masked layers) */
const FS_LKMASK=`uniform sampler2D uSrc; uniform sampler2D uM; void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 c=texelFetch(uSrc,p,0); o=c*texelFetch(uM,p,0).r; }`;
let P_LKMASK=null;function lkMasked(src,mt){if(!P_LKMASK)P_LKMASK=program(FS_LKMASK);const o=acquireD(src.depth===32?16:src.depth);run(P_LKMASK,o,{uSrc:src.tex,uM:mt});return o;}
function layerLook(n,src,k,cacheable,mt){const P=lkProgs();let c=n._lk;const key=lookKey(n);
  if(!c||c.w!==doc.w||c.h!==doc.h){lookFree(n);c=n._lk={w:doc.w,h:doc.h,maps:{},shapeKey:null};}
  if(cacheable&&c.maps[k]&&c.maps[k].key===key)return {t:c.maps[k].t,cached:true};
  /* this map's content, arrayed */
  /* the content's box (and so the array's centre) is measured again whenever the layer has changed; while painting, copies take the whole canvas */
  if(arrayOn(n)&&cacheable&&c.boxVer!==n.lookVer){arrayMeasure(n);c.boxVer=n.lookVer;}
  let body=src,tmp=[];if(arrayOn(n)){if(!n.arrBox)arrayMeasure(n);body=acquireD(src.depth===32?16:src.depth);tmp.push(body);arrayDraw(n,src,body,k,!cacheable);}
  let out=body;
  if(anyStyle(n)){/* the shape: the base colour's alpha, arrayed too; and its distance field (kept while unchanged) */
    const live=!cacheable,sk=key;
    if(live||c.shapeKey!==sk||!c.sd){if(!c.sd)c.sd=lkSD();if(!c.shape)c.shape=makeTarget(doc.w,doc.h,8,false);
      const B=k==='base'?body:null;
      if(B)blit(B,c.shape,0,0,doc.w,doc.h,0,0);
      else{const bt=mapT(n,'base');if(bt&&!bt.empty){const bm=mt?lkMasked(bt,mt):bt;if(arrayOn(n))arrayDraw(n,bm,c.shape,'base',!cacheable);else blit(bm,c.shape,0,0,doc.w,doc.h,0,0);if(bm!==bt)release(bm);}else clearTarget(c.shape);}
      lkDistance(c.shape,c.sd);c.shapeKey=live?null:sk;}
    const m=LK_MAPS[k];
    if(m!=null){out=acquireD(Math.max(body.depth===32?16:body.depth,k==='height'?mapDepth('height'):8));tmp.push(out);
      run(P.style,out,Object.assign({uSrc:body.tex,uD:c.sd.tex,uShape:c.shape.tex,uMap:{int:m}},styleUniforms(n.styles)));}}
  if(out===src)return {t:src,cached:false};
  if(cacheable){let e=c.maps[k];if(!e||e.t.depth!==out.depth){if(e)disposeTarget(e.t);e=c.maps[k]={t:makeTarget(doc.w,doc.h,out.depth,false)};}
    blit(out,e.t,0,0,doc.w,doc.h,0,0);e.key=key;tmp.forEach(release);return {t:e.t,cached:true};}
  tmp.forEach(t=>{if(t!==out)release(t);});return {t:out,cached:false,pooled:true};}
