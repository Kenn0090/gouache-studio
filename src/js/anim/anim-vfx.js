/* ================= VFX helpers for the animation tab =================
   Generators drawn by the GPU into new frames: Fire, Smoke, Sparks, Explosion, Lightning, Magic orb, Shockwave, Rain, Snow,
   Blood splat, Ripples, Slash, Impact burst, Dust puff, Energy beam, Bubbles, Portal, Sparkles and Muzzle flash. The ones that can loop do so exactly. Fire and Smoke can be shaped by the painted frame.
   Helpers: spin the current frame, make a loop seamless, cut the current frame into a grid. */
const VFXG_FS=`uniform vec2 uSize; uniform float uT; uniform float uSeed; uniform float uScale; uniform float uTurb; uniform float uInt; uniform int uKind; uniform int uPal;
uniform vec4 uP1; uniform vec4 uP2; uniform vec4 uP3; uniform vec3 uC1; uniform vec3 uC2;
uniform sampler2D uBase; uniform float uUseBase; uniform float uFlip; uniform vec4 uMuzzle;
float hs(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+uSeed*1.7)*43758.5453); }
float vnp(vec2 p,vec2 per){ vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f); vec2 a=mod(i,per),b=mod(i+1.0,per);
  return mix(mix(hs(a),hs(vec2(b.x,a.y)),u.x),mix(hs(vec2(a.x,b.y)),hs(b),u.x),u.y); }
float fbmp(vec2 p,vec2 per){ float s=0.0,a=0.5,tot=0.0; for(int i=0;i<5;i++){ s+=a*vnp(p,per); tot+=a; p*=2.0; per*=2.0; a*=0.5; } return s/tot; }
vec3 ramp(float h,int pal){ vec3 a,b,c,d;
  if(pal==1){ a=vec3(0.0,0.05,0.4); b=vec3(0.1,0.35,1.0); c=vec3(0.4,0.8,1.0); d=vec3(0.9,1.0,1.0); }
  else if(pal==2){ a=vec3(0.0,0.3,0.0); b=vec3(0.2,0.9,0.05); c=vec3(0.7,1.0,0.3); d=vec3(0.95,1.0,0.8); }
  else if(pal==3){ a=vec3(0.25,0.0,0.4); b=vec3(0.6,0.1,1.0); c=vec3(0.9,0.5,1.0); d=vec3(1.0,0.9,1.0); }
  else if(pal==4){ a=uC1*0.3; b=uC1; c=mix(uC1,uC2,0.5); d=uC2; }
  else { a=vec3(0.6,0.05,0.0); b=vec3(1.0,0.35,0.02); c=vec3(1.0,0.8,0.25); d=vec3(1.0,1.0,0.85); }
  return h<0.33?mix(a,b,h/0.33):h<0.66?mix(b,c,(h-0.33)/0.33):mix(c,d,clamp((h-0.66)/0.34,0.0,1.0)); }
/* liquid colours for the splat: dark edge and bright body */
vec3 fluid(int pal,float th){ vec3 dk,br; if(pal==1){ dk=vec3(0.03,0.22,0.02); br=vec3(0.25,0.75,0.08); } else if(pal==2){ dk=vec3(0.01,0.01,0.015); br=vec3(0.12,0.12,0.16); }
  else if(pal==3){ dk=vec3(0.18,0.0,0.3); br=vec3(0.55,0.15,0.85); } else if(pal==4){ dk=uC1*0.4; br=uC1; } else { dk=vec3(0.22,0.0,0.01); br=vec3(0.72,0.04,0.05); }
  return mix(dk,br,smoothstep(0.0,0.7,th)); }
float baseA(vec2 uv){ return texture(uBase,vec2(uv.x,1.0-uv.y)).a; }
void main(){ vec2 uv=gl_FragCoord.xy/uSize; uv.y=1.0-uv.y; float asp=uSize.x/uSize.y; vec4 res=vec4(0.0);
  float spd=uP1.x,wid=uP1.y,hei=uP1.z,lean=uP1.w,cnt=uP2.x,soft=uP2.y,glow=uP2.z,flick=uP2.w,cont=uP3.x,bright=uP3.y,spike=uP3.z,rot=uP3.w;
  vec2 c0=vec2(0.5,0.5); vec2 pc=(uv-c0)*vec2(asp,1.0); float rr=length(pc);
  if(uKind==2){ vec3 acc=vec3(0.0); float al=0.0;
    for(int i=0;i<48;i++){ if(float(i)>=cnt) break; float fi=float(i); float h1=hs(vec2(fi,1.0)),h2=hs(vec2(fi,2.0)),h3=hs(vec2(fi,3.0)),h4=hs(vec2(fi,4.0));
      float tp=fract(uT*spd+h3); float y=-0.03+tp*(0.5+h2*0.9)*uScale*0.6*hei; float x=h1+lean*tp*0.5+(h2-0.5)*0.3*tp*uTurb+sin(tp*6.2832*(1.0+floor(h4*3.0))+h1*6.2832)*0.02*uTurb;
      vec2 d=(uv-vec2(x,y))*vec2(asp,1.0); float r=(0.012+0.02*h4)*uScale*wid; float g=exp(-dot(d,d)/(r*r))*(1.0-tp)*(1.0-tp); g+=glow*0.25*exp(-dot(d,d)/(r*r*9.0))*(1.0-tp);
      acc+=ramp(0.45+0.55*(1.0-tp),uPal)*g*(1.0+h4)*uInt; al+=g*uInt; }
    res=vec4(acc,clamp(al,0.0,1.0)); res.rgb=min(res.rgb,vec3(res.a)*1.6); }
  else if(uKind==0||uKind==1){ vec2 per=floor(vec2(uKind==0?3.0:2.0,uKind==0?4.0:3.0)*uScale*vec2(asp,1.0)+0.5); per=max(2.0*floor(per*0.5+0.5),vec2(2.0));
    vec2 p=uv*per; p.y-=uT*per.y*spd; vec2 q=p*0.5; float w=fbmp(q+vec2(3.1,1.7),max(per*0.5,vec2(1.0))); p.x+=(w-0.5)*uTurb*3.0;
    float n=fbmp(p,per); float lx=uv.x-0.5-lean*uv.y*0.5;
    float sm=0.0; if(uUseBase>0.5){ float ds=0.0; for(int i=0;i<8;i++){ float k=float(i)/8.0; float a=baseA(uv-vec2((w-0.5)*0.1*uTurb-lean*k*0.1,k*0.3*hei)); ds=max(ds,a*(1.0-k)); } sm=ds; }
    if(uKind==0){
      float yy=uv.y/max(hei,0.2); float wd=mix(0.30,0.05,pow(clamp(yy,0.0,1.0),0.7))*wid; float b=1.0-smoothstep(0.0,wd,abs(lx)+(n-0.5)*(0.15+0.5*uTurb)*(0.3+yy));
      float fl=1.0+flick*0.35*sin(6.2832*uT*spd+n*6.2832);
      float heat=uUseBase>0.5 ? sm*(0.45+1.1*n) : b*(1.0-yy*0.8)*(0.35+1.3*n);
      heat=clamp((heat*fl-0.22-yy*0.25)*2.0*uInt,0.0,1.0); vec3 c=ramp(heat,uPal); float al=smoothstep(0.02,0.02+0.05+soft*0.4,heat); res=vec4(c*al,al); }
    else { float yy=uv.y/max(hei,0.2); float wd=mix(0.14,0.46,clamp(yy,0.0,1.0))*wid; float b=1.0-smoothstep(0.0,wd,abs(lx)); float fade=smoothstep(0.0,0.12,yy)*(1.0-smoothstep(0.5,1.0,yy));
      float body=uUseBase>0.5 ? sm : b*fade; float d=clamp((n-0.35)*(1.2+cont*2.4),0.0,1.0)*body*uInt; float lum=mix(0.22,0.8,fbmp(p+vec2(5.2,1.3),per)*0.5+uv.y*0.5)*(0.5+bright);
      float al=clamp(d*(0.6+soft*0.5),0.0,1.0); res=vec4(clamp(vec3(lum),0.0,1.0)*al,al); } }
  else if(uKind==3){ float e=1.0-pow(1.0-min(uT*1.6,1.0),3.0); vec2 per=vec2(6.0,6.0); float n=fbmp((pc+0.5)*per*uScale+uSeed,per*uScale+vec2(0.0));
    float ang=atan(pc.y,pc.x); float sp=vnp(vec2(ang/6.2832*10.0+uT*2.0,3.0),vec2(10.0,64.0));
    float R=0.30*e*uScale*wid*(0.85+0.3*sp*(0.5+spike)); float edge=R*(0.7+0.6*n*(0.4+uTurb));
    float body=1.0-smoothstep(edge*(0.85-soft*0.3),edge,rr); float life=1.0-smoothstep(0.35,1.0,uT);
    float heat=clamp(body*(1.05-uT*0.8)*(0.6+0.7*n)*uInt*(0.8+0.6*(1.0-rr/max(edge,0.001))),0.0,1.0);
    vec3 col=ramp(heat,uPal); vec3 smk=vec3(0.12)+0.25*n; col=mix(col,smk,smoothstep(0.35,0.9,uT)); float al=body*life*(0.3+0.9*heat+smoothstep(0.35,0.9,uT)*0.5);
    al=clamp(al,0.0,1.0); res=vec4(col*al,al); }
  else if(uKind==4){ float fs=floor(uT*max(cnt,1.0)); float sd=fs*17.3; float a=0.0; vec3 acc=vec3(0.0);
    for(int k=0;k<3;k++){ float fk=float(k); float off=(hs(vec2(fs,fk+9.0))-0.5)*0.5*wid*(fk>0.5?1.0:0.0); float tilt=lean*0.5*(uv.y-0.5);
      float jag=(vnp(vec2(uv.y*9.0*uScale+sd+fk*31.0,0.0),vec2(512.0,1.0))-0.5)*0.34*uTurb+(vnp(vec2(uv.y*31.0*uScale+sd+fk*13.0,1.0),vec2(512.0,2.0))-0.5)*0.04*uTurb;
      float bx=0.5+off*(1.0-uv.y)+tilt+jag*(fk>0.5?0.8:1.0); float dx=abs(uv.x-bx)*asp; float reach=fk>0.5?hs(vec2(fs,fk))*0.6:1.0; float vis=fk>0.5?smoothstep(1.0-reach,1.0-reach+0.05,uv.y)*step(uv.y,1.0-hs(vec2(fs,fk+5.0))*0.2):1.0;
      float core=exp(-dx*dx/(0.0009*wid*wid*(fk>0.5?0.5:1.0))); float halo=exp(-dx*dx/(0.012*wid*wid))*glow*0.5; a+=(core+halo)*vis; acc+=(vec3(1.0)*core+(uPal==0?vec3(0.45,0.65,1.0):ramp(0.55,uPal))*halo*1.5)*vis; }
    float fl=1.0-flick*0.5*hs(vec2(fs,3.3)); a=clamp(a*uInt*fl,0.0,1.0); acc*=uInt*fl; res=vec4(min(acc,vec3(a)*1.5),a); }
  else if(uKind==5){ float ang=uT*6.2832*spd; mat2 R=mat2(cos(ang),-sin(ang),sin(ang),cos(ang)); vec2 pr=R*pc; float Rr=0.22*uScale*wid; vec2 per=vec2(8.0);
    float n=fbmp(pr*(8.0/uScale)+0.5*per+uSeed,per*4.0); float n2=fbmp(R*R*pc*(14.0/uScale)+0.25*per,per*4.0);
    float ring=exp(-pow((rr-Rr)/(0.03+0.05*soft),2.0)); float core=smoothstep(Rr,0.0,rr); float swirl=clamp((n-0.35)*2.4*(0.6+uTurb),0.0,1.0)*core;
    float heat=clamp((core*0.55+swirl*0.9+ring*0.8+n2*0.2*core)*uInt,0.0,1.0); float halo=exp(-pow(max(rr-Rr,0.0)/(0.08+0.12*glow),2.0))*glow*0.4*(1.0-core);
    float al=clamp(max(heat,halo)*1.2,0.0,1.0); vec3 col=ramp(clamp(heat+halo*0.5,0.0,1.0),uPal); res=vec4(col*al,al); }
  else if(uKind==6){ float e=1.0-pow(1.0-uT,2.0); float ang=atan(pc.y,pc.x); float n=vnp(vec2(ang/6.2832*12.0,uSeed),vec2(12.0,64.0)); float r0=0.06+0.5*e*uScale; float th=(0.012+0.05*wid*(1.0-uT))*(0.6+0.8*soft);
    float rj=r0*(1.0+(n-0.5)*uTurb*0.25); float ring=exp(-pow((rr-rj)/th,2.0))*(1.0-uT); float inner=(1.0-smoothstep(0.0,rj,rr))*0.25*glow*(1.0-uT)*(1.0-uT);
    float heat=clamp((ring+inner)*uInt,0.0,1.0); float al=clamp(heat*1.3,0.0,1.0); vec3 col=ramp(heat*0.9+0.1,uPal); res=vec4(col*al,al); }
  else if(uKind==7){ vec2 u=vec2(uv.x+lean*uv.y*0.5,uv.y); float cols=max(cnt,4.0)*uScale*1.5; float a=0.0;
    for(int L=0;L<2;L++){ float fl=float(L); float cl=cols*(1.0+fl*0.6); float id=floor(u.x*cl); float h=hs(vec2(id,fl+3.0)); float h2=hs(vec2(id,fl+7.0)); float fx=abs(fract(u.x*cl)-0.5);
      float sp=1.0+floor(h2*2.0)*spd; float v=fract(u.y*(1.5+fl)+h+uT*spd*(1.0+fl)); float len=(0.05+0.12*h2)*hei; float st=v<len?(1.0-v/len):0.0;
      float w=0.06*wid*(1.0-0.3*fl); float m=1.0-smoothstep(w*0.5,w,fx); a=max(a,st*m*(h>0.3?1.0:0.0)*(1.0-fl*0.4)); }
    a=clamp(a*uInt,0.0,1.0); vec3 col=mix(vec3(0.6,0.75,0.95),vec3(0.9,0.95,1.0),a); res=vec4(col*a,a); }
  else if(uKind==8){ float a=0.0; for(int L=0;L<3;L++){ float fl=float(L); float cl=max(2.0,floor((cnt*0.2+2.0)*uScale*(1.0+fl*0.7)+0.5)); vec2 g=vec2(uv.x*cl*asp+lean*uv.y*cl*0.4,uv.y*cl+uT*cl*spd*(1.0+fl)); vec2 id=vec2(floor(g.x),mod(floor(g.y),cl)); float sw=sin(uT*6.2832*spd+hs(id+fl)*6.2832)*0.25*uTurb;
      vec2 cen=vec2(0.3+0.4*hs(id+3.1+fl)+sw,0.3+0.4*hs(id+9.7+fl)); float d=length(fract(g)-cen); float r=(0.14+0.12*hs(id+5.5))*wid*(1.0-fl*0.2); a=max(a,(1.0-smoothstep(r*(0.6-soft*0.4),r,d))*(1.0-fl*0.25)); }
    a=clamp(a*uInt,0.0,1.0); res=vec4(vec3(0.95,0.97,1.0)*a,a); }
  else if(uKind==9){ float e=1.0-pow(1.0-min(uT*3.0,1.0),3.0); float ang=atan(pc.y,pc.x); float sp=vnp(vec2(ang/6.2832*14.0,uSeed),vec2(14.0,64.0)); float n=fbmp(pc*9.0+uSeed,vec2(1e4));
    float R=0.19*uScale*wid*e; float edge=R*(0.72+0.5*n*(0.5+uTurb)+spike*1.8*pow(sp,3.0)); float a=1.0-smoothstep(edge*(0.97-soft*0.1),edge,rr); float th=clamp((edge-rr)/max(edge,0.001),0.0,1.0);
    for(int i=0;i<48;i++){ if(float(i)>=cnt) break; float fi=float(i); float ha=hs(vec2(fi,1.0)),hd=hs(vec2(fi,2.0)),hz=hs(vec2(fi,3.0)); float aa=ha*6.2832; float dist=R*(1.2+hd*3.2*uScale*hei*(0.4+0.6*spike+0.3))*(0.25+0.75*e);
      vec2 cen=vec2(cos(aa),sin(aa))*dist; vec2 dv=pc-cen; vec2 rad=normalize(cen+1e-5); float al=dot(dv,rad),ac=dot(dv,vec2(-rad.y,rad.x)); float sz=(0.004+0.014*hz*hz)*uScale*(0.3+0.7*e)*wid; float el=1.0+1.5*(1.0-e);
      float dd=length(vec2(al/el,ac)); a=max(a,1.0-smoothstep(sz*0.7,sz,dd)); th=max(th,(1.0-smoothstep(0.0,sz,dd))*0.9); }
    float drip=0.0; float tt=clamp((uT-0.3)/0.7,0.0,1.0); for(int j=0;j<8;j++){ float fj=float(j); float xo=(hs(vec2(fj,21.0))-0.5)*R*1.7; float ln=tt*(0.06+0.22*hs(vec2(fj,22.0)))*hei*uScale; float w=(0.005+0.007*hs(vec2(fj,23.0)))*wid*uScale;
      float ytop=-R*0.35; float yb=ytop-ln; float inside=step(yb,pc.y)*step(pc.y,ytop); float m=(1.0-smoothstep(w*0.6,w,abs(pc.x-xo)))*inside; float bulb=1.0-smoothstep(w*1.0,w*1.5,length(vec2(pc.x-xo,pc.y-yb))); drip=max(drip,max(m,bulb*step(0.02,ln))); }
    a=max(a,drip*0.95); th=max(th,drip*0.6); vec3 col=fluid(uPal,th)*(1.0-0.2*uT); float spec=smoothstep(0.78,0.95,th+0.15*(n-0.5)+0.25*(1.0-abs(pc.x*8.0)))*0.5*(1.0-soft); col+=vec3(spec)*step(0.0,a-0.5)*bright;
    a*=uInt>0.0?min(uInt,1.0):0.0; res=vec4(clamp(col,0.0,1.0)*a,a); }
  else if(uKind==10){ float a=0.0; float ang=atan(pc.y,pc.x); float nr=min(cnt,8.0);
    for(int i=0;i<8;i++){ if(float(i)>=nr) break; float fi=float(i); float ph=fract(uT*spd+fi/nr); float R=(0.03+0.5*ph)*uScale; float wob=(vnp(vec2(ang/6.2832*12.0+fi*3.0,uSeed),vec2(12.0,64.0))-0.5)*uTurb*0.18*R;
      float th=(0.006+0.02*wid)*(0.5+ph)*(0.4+soft); a+=exp(-pow((rr-R-wob)/th,2.0))*pow(1.0-ph,1.4); }
    a=clamp((a+exp(-rr*rr/0.0025)*glow*0.12)*uInt,0.0,1.0); res=vec4(ramp(clamp(0.35+0.6*a,0.0,1.0),uPal)*a,a); }
  else if(uKind==11){ float e=1.0-pow(1.0-min(uT*1.8,1.0),2.0); float R=0.4*uScale; float rot=lean*1.2-0.5; mat2 Rm=mat2(cos(rot),-sin(rot),sin(rot),cos(rot)); vec2 q=Rm*pc; q.y+=0.12*uScale;
    float phi=atan(q.y,q.x); float s=(phi-0.15*3.14159)/(0.7*3.14159); float w=(0.03+0.09*wid)*uScale*pow(sin(3.14159*clamp(s,0.0,1.0)),0.9)+0.0015;
    float d=length(q)-R+(vnp(vec2(s*14.0+uSeed,3.0),vec2(64.0,64.0))-0.5)*uTurb*0.03; float a=1.0-smoothstep(0.0,1.0,abs(d+w*0.4)/w);
    float vis=smoothstep(e-1.0,e-0.3,s)*(1.0-smoothstep(e-0.03,e,s))*step(0.0,s)*step(s,1.0); float life=1.0-smoothstep(0.6,1.0,uT);
    float head=smoothstep(e-1.0,e,s); float heat=clamp(a*(0.35+0.9*head)*uInt,0.0,1.0); float halo=exp(-pow(d/(w*3.0+0.001),2.0))*glow*0.25*vis;
    float al=clamp((a*vis*uInt+halo)*life,0.0,1.0); res=vec4(ramp(clamp(heat*0.9+0.1,0.0,1.0),uPal)*al,al); }
  else if(uKind==12){ float e=1.0-pow(1.0-min(uT*4.0,1.0),3.0); float ang=atan(pc.y,pc.x)+uSeed; float N=max(floor(cnt),3.0); float f=pow(abs(cos(ang*N*0.5)),1.0+spike*3.0);
    float nz=vnp(vec2(ang/6.2832*N,5.0),vec2(N,64.0)); float R=0.34*uScale*wid*e; float edge=R*(0.25+0.75*f)*(0.9+0.2*nz*uTurb);
    float body=1.0-smoothstep(edge*(0.9-soft*0.2),edge,rr); float core=exp(-rr*rr/(0.003*uScale*uScale))*(1.0-uT); float life=1.0-smoothstep(0.45,1.0,uT);
    float heat=clamp(body*(1.1-rr/max(edge,0.001)*0.8)+core*1.5,0.0,1.0); float halo=exp(-pow(rr/(R*1.4+0.001),2.0))*glow*0.25*life;
    float al=clamp((body*life+halo)*uInt,0.0,1.0); res=vec4(ramp(heat,uPal)*al,al); }
  else if(uKind==13){ float e=1.0-pow(1.0-min(uT*1.8,1.0),2.5); vec2 c=pc-vec2(lean*0.2*e,0.12*e*hei); float rc=length(c);
    float n=fbmp(c*8.0/uScale+uSeed,vec2(1e4)); float n2=fbmp(c*17.0/uScale+vec2(7.1,2.3),vec2(1e4)); float R=(0.08+0.30*e)*uScale*wid;
    float edge=R*(0.65+0.7*(n-0.5)*(0.5+uTurb)+0.3*n2*uTurb); float body=1.0-smoothstep(edge*(0.8-soft*0.35),edge,rc); float life=1.0-smoothstep(0.35,1.0,uT);
    vec3 bs=uPal==4?uC1:(uPal==1?vec3(0.55):(uPal==2?vec3(0.93):(uPal==3?vec3(0.5,0.38,0.62):vec3(0.64,0.55,0.42)))); vec3 col=bs*(0.45+0.7*n)*(0.6+bright*0.8);
    float al=clamp(body*life*uInt*(0.45+cont*0.9),0.0,1.0); res=vec4(clamp(col,0.0,1.0)*al,al); }
  else if(uKind==14){ float env=smoothstep(0.0,0.06,uv.x)*(1.0-smoothstep(0.94,1.0,uv.x)); vec2 p=vec2(uv.x*12.0-uT*12.0*spd,uv.y*3.0); float n=fbmp(p,vec2(12.0,3.0));
    float n2=vnp(vec2(uv.x*40.0-uT*40.0*spd,2.0),vec2(40.0,4.0)); float cy=0.5+lean*0.2*(uv.x-0.5)+(n-0.5)*0.22*uTurb*uScale; float dy=abs(uv.y-cy); float wd=0.02*uScale*wid+0.0005;
    float core=exp(-pow(dy/wd,2.0)); float halo=exp(-pow(dy/(wd*4.0),2.0))*glow*0.55; float pulse=0.8+0.2*sin(6.2832*(uv.x*3.0-uT*spd))+flick*0.3*(n2-0.5);
    float a=clamp((core+halo)*pulse*env*uInt,0.0,1.0); vec3 col=mix(ramp(0.6+0.4*halo,uPal),vec3(1.0),core*0.9); res=vec4(col*a,a); }
  else if(uKind==15){ float a=0.0;
    for(int i=0;i<48;i++){ if(float(i)>=cnt) break; float fi=float(i); float h1=hs(vec2(fi,11.0)),h2=hs(vec2(fi,12.0)),h3=hs(vec2(fi,13.0)),h4=hs(vec2(fi,14.0));
      float tp=fract(uT*spd+h3); float r=(0.015+0.05*h4*h4)*uScale*wid+0.002; float y=-r+tp*(1.0+2.0*r); float x=h1+lean*tp*0.3+sin(tp*6.2832*(1.0+floor(h2*3.0))+h1*6.2832)*0.03*uTurb;
      vec2 d=(uv-vec2(x,y))*vec2(asp,1.0); float L=length(d); vec2 hv=d-vec2(-0.35*r,0.4*r);
      float v=exp(-pow((L-r)/(r*0.12+0.002),2.0))*0.8+(1.0-smoothstep(r*0.85,r,L))*0.08*(0.5+soft)+exp(-dot(hv,hv)/(r*r*0.03))*0.7; a=max(a,v); }
    a=clamp(a*uInt,0.0,1.0); vec3 col=uPal==0?vec3(0.72,0.92,1.0):ramp(0.75,uPal); res=vec4(col*a+vec3(a*a*0.15),a); }
  else if(uKind==16){ float ang=atan(pc.y,pc.x); float arms=2.0+floor(cnt/8.0); float Rr=0.22*uScale*wid; float sw=0.5+0.5*sin(arms*ang-6.2832*uT*spd+rr*(30.0/uScale));
    float ca=uT*6.2832*spd; mat2 Rm=mat2(cos(ca),-sin(ca),sin(ca),cos(ca)); float n=mix(0.5,fbmp(Rm*pc*(9.0/uScale)+4.0+uSeed,vec2(64.0)),clamp(uTurb*1.4,0.0,1.5));
    float ring=exp(-pow((rr-Rr)/(0.012+0.04*soft),2.0)); float inside=1.0-smoothstep(Rr*0.92,Rr,rr); float inner=inside*(0.25+0.75*sw*(0.4+0.6*n));
    float heat=clamp((ring*1.2+inner*0.8)*uInt,0.0,1.0); float halo=exp(-pow(max(rr-Rr,0.0)/(0.05+0.1*glow),2.0))*glow*0.45*(1.0-inside);
    float al=clamp(max(heat,halo)*1.15,0.0,1.0); res=vec4(ramp(clamp(heat*0.9+halo*0.5,0.0,1.0),uPal)*al,al); }
  else if(uKind==17){ vec3 acc=vec3(0.0); float al=0.0;
    for(int i=0;i<48;i++){ if(float(i)>=cnt) break; float fi=float(i); float h1=hs(vec2(fi,31.0)),h2=hs(vec2(fi,32.0)),h3=hs(vec2(fi,33.0)),h4=hs(vec2(fi,34.0));
      float ph=fract(uT*spd+h3); float tw=pow(sin(3.14159*ph),2.0); vec2 pos=vec2(h1+lean*ph*0.1,h2+ph*0.08*hei*(0.5+h4)); vec2 d=(uv-pos)*vec2(asp,1.0); float sz=(0.012+0.03*h4)*uScale*wid*(0.3+0.7*tw)+0.0005;
      float cr=exp(-abs(d.x*d.y)/(sz*sz*0.05))*exp(-length(d)/(sz*2.5)); float gl=exp(-dot(d,d)/(sz*sz*0.5))*glow*0.5; float v=(cr+gl)*tw; acc+=ramp(0.6+0.4*cr,uPal)*v; al+=v; }
    al=clamp(al*uInt,0.0,1.0); acc*=uInt; res=vec4(min(acc,vec3(al)*1.6),al); }
  else if(uKind==18){ /* short pressure burst: asymmetric gas jets, advected breakup and ballistic embers */
    float ra=rot*0.0174532925,ca=cos(ra),sa=sin(ra);
    vec2 q=mat2(ca,sa,-sa,ca)*pc;
    float age=clamp(uT/max(uMuzzle.y,0.15),0.0,1.0), pulse=exp(-age*7.0)*(1.0-smoothstep(0.48,0.72,age));
    float expand=0.58+0.65*(1.0-exp(-age*13.0));
    float L=max(0.015,0.25*uScale*hei*expand),W=max(0.004,0.065*uScale*wid);
    vec2 np=q/vec2(L,W);
    float noise=fbmp(np*vec2(5.0,2.5)-vec2(age*9.0,age*1.7),vec2(64.0));
    float fine=vnp(np*vec2(17.0,8.0)-vec2(age*19.0,0.0),vec2(128.0));
    bool radial=uMuzzle.x>0.5;
    float gas=0.0;
    for(int j=0;j<12;j++){ if(!radial&&j>=7)break; float fj=float(j),h1=hs(vec2(fj,71.0)),h2=hs(vec2(fj,72.0));
      float angle=(h1-0.5)*(0.65+spike*0.85); if(j==0)angle=0.0;
      if(radial)angle=(fj+(h1-0.5)*0.55)*6.2831853/12.0;
      float cj=cos(angle),sj=sin(angle); vec2 jet=mat2(cj,sj,-sj,cj)*q;
      float reach=L*(0.50+0.50*h2)*(uMuzzle.x>1.5?0.65:1.0),along=jet.x/reach;
      float bend=sin(along*5.0+h1*6.28+age*8.0)*W*0.13*uTurb*along;
      float radius=W*(0.32+0.35*h1)*pow(max(0.0,1.0-along),0.65);
      float feather=max(W*0.045,radius*(0.28+soft*0.65));
      float edge=radius-abs(jet.y+bend)+(noise-0.5)*W*(0.22+uTurb*0.65);
      float tongue=smoothstep(-feather,feather,edge)*smoothstep(-W*0.12,W*0.18,jet.x)*(1.0-smoothstep(0.72,1.0,along));
      gas=max(gas,tongue*(0.70+0.30*h2)); }
    float holes=smoothstep(0.24+age*0.32,0.58+age*0.22,noise*0.75+fine*0.25);
    gas*=mix(1.0,holes,clamp(0.35+age*1.4+uTurb*0.20,0.0,1.0));
    vec2 cp=(q-vec2(radial?0.0:L*0.12,0.0))/(radial?vec2(W*0.7):vec2(L*0.23,W*0.42));
    float core=exp(-dot(cp,cp)*2.0)*pulse;
    vec2 hp=(q-vec2(radial?0.0:L*0.19,0.0))/(radial?vec2(L*0.55):vec2(L*0.65,W*1.7));
    float halo=exp(-dot(hp,hp)*2.5)*glow*0.16*pulse;
    float sparks=0.0;
    for(int i=0;i<48;i++){ if(float(i)>=cnt)break; float fi=float(i),h1=hs(vec2(fi,41.0)),h2=hs(vec2(fi,42.0)),h3=hs(vec2(fi,43.0));
      float sa2=radial?h2*6.2831853:(h2-0.5)*1.15,travel=(0.025+age*(0.20+0.32*h1))*uScale;
      vec2 pos=vec2(cos(sa2)*travel*hei,sin(sa2)*travel*(radial?hei:wid)+age*age*0.035*uScale);
      vec2 dv=q-pos; vec2 sd=vec2(cos(sa2)*dv.x+sin(sa2)*dv.y,-sin(sa2)*dv.x+cos(sa2)*dv.y);
      float sr=(0.001+0.0015*h3)*uScale;
      float ember=exp(-dot(sd/vec2(sr*(2.0+age*7.0),sr),sd/vec2(sr*(2.0+age*7.0),sr)));
      sparks+=ember*(0.35+0.65*h3)*exp(-age*(3.0+3.0*h1))*(1.0-smoothstep(0.65,1.0,age)); }
    /* Smoke is a separate, slower envelope: transparent at birth and at the end. */
    float smoke=0.0;vec3 smokeCol=vec3(0.32,0.30,0.28);
    if(uMuzzle.z>0.0){
      float st=uT,smLife=smoothstep(0.04,0.25,st)*(1.0-smoothstep(0.55,1.0,st));
      vec2 drift=radial?vec2(0.0,-st*0.06*uScale):vec2(st*0.12*uScale*hei,-st*st*0.06*uScale);
      vec2 sq=q-drift;float cloud=0.0;
      for(int k=0;k<5;k++){float fk=float(k),h=hs(vec2(fk,94.0)),a2=radial?fk*1.256637:(h-0.5)*0.8;
        vec2 centre=vec2(cos(a2),sin(a2))*L*(0.12+fk*0.09)*(radial?1.0:0.8);
        float radius=W*(0.65+st*2.4)*(0.70+h*0.5);vec2 sc=(sq-centre)/vec2(radius*(radial?1.0:1.4),radius);
        cloud=max(cloud,exp(-dot(sc,sc)*1.7));}
      float sn=fbmp(sq/max(W,0.004)*2.0-vec2(st*2.0,st*3.0),vec2(64.0));
      smoke=cloud*smoothstep(0.20,0.75,sn)*smLife*uMuzzle.z*0.6;
      smokeCol=mix(vec3(0.19,0.18,0.17),vec3(0.48,0.46,0.43),sn); }
    float flame=gas*pulse,raw=(flame+core*0.8+halo+sparks)*uInt;
    float al=clamp(raw,0.0,1.0);
    float heat=clamp(gas*0.65+core*0.75+(noise-0.5)*0.25-age*0.65,0.0,1.0);
    vec3 col=ramp(heat,uPal); col=mix(col,vec3(1.0,0.97,0.87),clamp(core*(0.65+bright*0.25),0.0,0.9));
    vec3 rgb=col*flame+ramp(0.95,uPal)*core*0.8+ramp(0.4,uPal)*halo+ramp(0.8,uPal)*sparks;
    res=vec4(min(rgb*uInt,vec3(al))+smokeCol*smoke*(1.0-al),al+smoke*(1.0-al)); }
  o=res; }`;
let P_VFXG=null;
/* the kinds, whether they loop, and which sliders each one has */
const VFX_KINDS=[[0,'Fire'],[1,'Smoke'],[2,'Sparks'],[3,'Explosion'],[4,'Lightning'],[5,'Magic orb'],[6,'Shockwave'],[7,'Rain'],[8,'Snow'],[9,'Blood splat'],[10,'Ripples'],[11,'Slash'],[12,'Impact burst'],[13,'Dust puff'],[14,'Energy beam'],[15,'Bubbles'],[16,'Portal'],[17,'Sparkles'],[18,'Muzzle flash']];
const VFX_ONESHOT=[3,6,9,11,12,13,18];
const VFX_SL={scale:['Size',.4,3,.05,1],turb:['Turbulence',0,1.5,.01,.5],inten:['Strength',.3,2,.01,1],spd:['Speed (loops per cycle)',1,4,1,1],wid:['Width',.3,2.5,.01,1],hei:['Height / reach',.3,2,.01,1],lean:['Lean / wind',-1,1,.01,0],
  cnt:['Amount',2,48,1,16],soft:['Softness',0,1,.01,.3],glow:['Glow',0,2,.01,.8],flick:['Flicker',0,1,.01,.4],cont:['Density contrast',0,1,.01,.5],bright:['Brightness',0,1.5,.01,.5],spike:['Spikes',0,1.5,.01,.5],rot:['Rotation',-180,180,1,0]};
const VFX_SETS={0:['scale','turb','inten','spd','wid','hei','lean','soft','flick'],1:['scale','turb','inten','spd','wid','hei','lean','soft','cont','bright'],2:['scale','turb','inten','spd','wid','hei','lean','cnt','glow'],
  3:['scale','turb','inten','wid','soft','spike'],4:['scale','turb','inten','wid','lean','cnt','glow','flick'],5:['scale','turb','inten','spd','wid','soft','glow'],6:['scale','turb','inten','wid','soft','glow'],
  7:['scale','inten','spd','wid','hei','lean','cnt'],8:['scale','turb','inten','spd','wid','lean','cnt','soft'],9:['scale','turb','inten','wid','hei','soft','spike','cnt','bright'],
  10:['scale','turb','inten','spd','wid','soft','cnt','glow'],11:['scale','turb','inten','wid','lean','soft','glow'],12:['scale','turb','inten','wid','soft','glow','cnt','spike'],13:['scale','turb','inten','wid','hei','lean','soft','cont','bright'],
  14:['scale','turb','inten','spd','wid','lean','glow','flick'],15:['scale','turb','inten','spd','wid','lean','cnt','soft'],16:['scale','turb','inten','spd','wid','soft','glow','cnt'],17:['scale','inten','spd','wid','hei','lean','cnt','glow'],
  18:['scale','inten','wid','hei','rot','soft','glow','cnt','spike','turb','bright']};
const VFX_DEFS={0:{},1:{inten:1,cont:.5,bright:.5},2:{cnt:24},3:{scale:1},4:{cnt:4,wid:1,turb:.5,glow:1},5:{},6:{scale:1},7:{cnt:14,hei:1,wid:1},8:{cnt:14},9:{cnt:18,wid:1,hei:1},10:{cnt:4,pal:1,turb:.4},11:{wid:1,glow:.6},12:{cnt:10,spike:.8},13:{cont:.5,bright:.5},14:{pal:1,glow:1,turb:.4},15:{cnt:14,wid:1},16:{pal:3,cnt:16,glow:1},17:{cnt:20,glow:1},18:{cnt:7,wid:1,hei:1,soft:.35,glow:.65,spike:.65,turb:.65,bright:1,burst:0,flashTime:1,smoke:0}};
/* Presets affect the look; frame count, colours, seed and replace choice stay with the user. */
const VFX_MUZZLE_PRESETS=[
  ['Small flash',{burst:0,scale:.8,wid:.75,hei:.7,cnt:3,spike:.4,turb:.5,soft:.35,glow:.5,flashTime:.65,smoke:0}],
  ['Long flame',{burst:0,scale:1,wid:.8,hei:1.45,cnt:7,spike:.45,turb:.7,soft:.35,glow:.65,flashTime:.85,smoke:0}],
  ['Outward burst',{burst:1,scale:1,wid:1,hei:.85,cnt:14,spike:1,turb:.7,soft:.4,glow:.7,flashTime:.8,smoke:0}],
  ['Front-facing flash',{burst:2,scale:1,wid:1.3,hei:.85,cnt:9,spike:.8,turb:.65,soft:.45,glow:.8,flashTime:.65,smoke:0}],
  ['Smoky burst',{burst:0,scale:1,wid:1,hei:1,cnt:5,spike:.65,turb:.65,soft:.4,glow:.65,flashTime:.5,smoke:.7}]
];
const VFX_PALS=[[0,'Orange fire / blood'],[1,'Blue flame / ooze'],[2,'Toxic green / oil'],[3,'Magic purple'],[4,'Your colours']];
function vfxOpts(kind){const o={kind,n:24,seed:3.7,pal:0,useBase:false,replace:false,c1:[1,.35,.05],c2:[1,.95,.6]};for(const k in VFX_SL)o[k]=VFX_SL[k][4];Object.assign(o,VFX_DEFS[kind]||{});if(VFX_ONESHOT.includes(kind))o.n=16;return o;}
/* draw one frame of a generator; t is 0..1 (loops end just before 1, one-shots reach 1 on the last frame) */
function vfxGenInto(T,opt,t,base){if(!P_VFXG)P_VFXG=program(VFXG_FS);
  run(P_VFXG,T,{uSize:[doc.w,doc.h],uT:t,uSeed:opt.seed,uScale:opt.scale,uTurb:opt.turb,uInt:opt.inten,uKind:{int:opt.kind},uPal:{int:opt.pal},
    uP1:[opt.spd,opt.wid,opt.hei,opt.lean],uP2:[opt.cnt,opt.soft,opt.glow,opt.flick],uP3:[opt.cont,opt.bright,opt.spike,opt.rot||0],uC1:opt.c1||[1,.35,.05],uC2:opt.c2||[1,.95,.6],
    uBase:base?base.tex:dummy,uUseBase:base?1:0,uFlip:0,uMuzzle:[opt.burst||0,opt.flashTime??1,opt.smoke||0,0]});}
function vfxGenerate(opt){const A=A_();if(!A)return;const n=clamp(Math.round(opt.n)||8,2,256);if(!animMemOk(n))return;
  const src=curFrame();let base=null;if(opt.useBase&&contentBounds(src.target)){base=acquire();blit(src.target,base,0,0,doc.w,doc.h,0,0);}
  const one=VFX_ONESHOT.includes(opt.kind),list=[];for(let i=0;i<n;i++){const F=newFrame();vfxGenInto(F.target,opt,one?i/(n-1):i/n,base);list.push(F);}
  if(base)release(base);
  putFrames(list,!!opt.replace,'Generate '+VFX_KINDS[opt.kind][1].toLowerCase());}
function dlgGenerate(kind){if(!ensureAnimMode())return;const cur={o:vfxOpts(kind||0)};
  const body=el('div',{class:'dlg-grid vfxdlg'});const pv=el('canvas',{class:'slicepv',width:240,height:240,style:'width:240px;height:240px;background:#111;border-radius:6px;align-self:center'});
  let t=0,tmp=null,stop=false,raf=0;
  const draw=()=>{const A=A_();if(!A)return;const o=cur.o;if(!tmp)tmp=makeTarget(doc.w,doc.h,8);const src=curFrame();const base=o.useBase&&contentBounds(src.target)?src.target:null;
    vfxGenInto(tmp,o,VFX_ONESHOT.includes(o.kind)?Math.min(1,(t%1.25)/1.0):(t%1),base);const c=document.createElement('canvas');c.width=doc.w;c.height=doc.h;const px=readRGBA8(tmp),id=new ImageData(doc.w,doc.h);
    for(let i=0;i<px.length;i+=4){const a=px[i+3];if(a){id.data[i]=Math.min(255,px[i]*255/a);id.data[i+1]=Math.min(255,px[i+1]*255/a);id.data[i+2]=Math.min(255,px[i+2]*255/a);id.data[i+3]=a;}}
    c.getContext('2d').putImageData(id,0,0);const x=pv.getContext('2d');x.clearRect(0,0,240,240);x.fillStyle='#111';x.fillRect(0,0,240,240);const s=Math.min(240/doc.w,240/doc.h);x.drawImage(c,120-doc.w*s/2,120-doc.h*s/2,doc.w*s,doc.h*s);};
  const tick=()=>{if(stop)return;t+=1/Math.max(2,cur.o.n)/1.5;try{draw();}catch(e){}raf=setTimeout(tick,90);};
  const kinds=el('div',{class:'chips'}),ctl=el('div',{class:'dlg-grid'});
  const hexOf=c=>'#'+c.map(v=>Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0')).join('');
  const build=()=>{const o=cur.o;kinds.replaceChildren(...VFX_KINDS.map(([v,l])=>el('button',{class:'chip'+(o.kind===v?' on':''),text:l,onclick:()=>{const keep={replace:o.replace,useBase:o.useBase};cur.o=Object.assign(vfxOpts(v),keep);build();}})));
    const numN=el('input',{class:'num',type:'number',min:2,max:256,value:o.n,id:'vgN','aria-label':'Frames'});numN.addEventListener('input',()=>{o.n=clamp(+numN.value||8,2,256);});
    const presets=el('div',{class:'chips'},...[8,16,24,32,64].map(v=>el('button',{class:'chip',text:String(v),onclick:()=>{o.n=v;numN.value=v;}})));
    const pal=el('select',{id:'vgPal','aria-label':'Colours'});for(const [v,l] of VFX_PALS)pal.append(el('option',{value:String(v),text:l}));pal.value=String(o.pal);pal.onchange=()=>{o.pal=+pal.value;build();};
    const c1=el('input',{type:'color',value:hexOf(o.c1),id:'vgC1','aria-label':'Colour 1'}),c2=el('input',{type:'color',value:hexOf(o.c2),id:'vgC2','aria-label':'Colour 2'});
    const fh=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255);c1.oninput=()=>{o.c1=fh(c1.value);};c2.oninput=()=>{o.c2=fh(c2.value);};
    const muzzle=[];if(o.kind===18){
      const style=el('select',{id:'vgBurst','aria-label':'Burst style'});for(const [v,l] of [[0,'Directional flash'],[1,'Outward burst'],[2,'Front-facing flash']])style.append(el('option',{value:String(v),text:l}));style.value=String(o.burst||0);style.onchange=()=>{o.burst=+style.value;t=0;build();};
      const looks=el('select',{id:'vgMuzzlePreset','aria-label':'Flash preset'},el('option',{value:'',text:'Choose a preset…'}));VFX_MUZZLE_PRESETS.forEach(([name],i)=>looks.append(el('option',{value:String(i),text:name})));looks.onchange=()=>{if(looks.value==='')return;Object.assign(o,VFX_MUZZLE_PRESETS[+looks.value][1]);t=0;build();};
      muzzle.push(el('div',{class:'frow'},el('label',{for:'vgMuzzlePreset',text:'Preset'}),looks),el('div',{class:'frow'},el('label',{for:'vgBurst',text:'Burst style'}),style),makeSlider({id:'vgFlashTime',label:'Flash duration',min:.15,max:1,step:.01,value:o.flashTime,fmt:pct,onInput:v=>{o.flashTime=v;}}).el,makeSlider({id:'vgSmoke',label:'Smoke trail',min:0,max:1,step:.01,value:o.smoke,fmt:pct,onInput:v=>{o.smoke=v;}}).el);
    }
    const sls=VFX_SETS[o.kind].map(k=>{const [generic,mn,mx,st]=VFX_SL[k];const lab=o.kind===18?({cnt:'Sparks',spike:'Flame spread',hei:o.burst?'Burst radius':'Reach',turb:'Flame breakup'}[k]||generic):generic;return makeSlider({id:'vg_'+k,label:lab,min:o.kind===18&&k==='cnt'?0:mn,max:mx,step:st,value:o[k],fmt:v=>st>=1?String(Math.round(v)):v.toFixed(2),onInput:v=>{o[k]=v;}}).el;});
    ctl.replaceChildren(el('div',{class:'frow'},el('label',{for:'vgN',text:VFX_ONESHOT.includes(o.kind)?'Frames (plays once)':'Frames (it loops)'}),numN),presets,el('div',{class:'frow'},el('label',{for:'vgPal',text:'Colours'}),pal),
      ...(o.pal===4?[el('div',{class:'frow'},el('label',{text:'Dark / bright'}),c1,c2)]:[]),...muzzle,...sls,
      el('div',{class:'frow'},el('button',{class:'btn sm',id:'vgRand',text:'New random',onclick:()=>{o.seed=Math.random()*50;}}),el('button',{class:'btn sm',text:'Reset sliders',onclick:()=>{const keep={replace:o.replace,useBase:o.useBase,n:o.n,pal:o.pal,burst:o.burst};cur.o=Object.assign(vfxOpts(o.kind),keep);build();}})),
      el('div',{class:'chips'},...([0,1].includes(o.kind)?[chk('vgBase','Shape it with the painted frame',o.useBase,v=>{o.useBase=v;})]:[]),chk('vgRep','Replace the current frames',o.replace,v=>{o.replace=v;})));};
  build();body.append(pv,kinds,ctl);
  tick();openDialog({title:'Generate effect',body,okLabel:'Make frames',onOk(){stop=true;clearTimeout(raf);if(tmp)disposeTarget(tmp);vfxGenerate(cur.o);},onCancel(){stop=true;clearTimeout(raf);if(tmp)disposeTarget(tmp);}});}

/* ---- helpers ---- */
function spinFrames(n,deg){const A=A_();if(!A)return;n=clamp(Math.round(n)||8,2,256);if(!animMemOk(n))return;
  const src=frameCanvas(curFrame()),W=doc.w,H=doc.h,list=[];
  for(let i=0;i<n;i++){const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.translate(W/2,H/2);x.rotate(i*deg/n*Math.PI/180);x.drawImage(src,-W/2,-H/2);
    const d=x.getImageData?c.getContext('2d').getImageData(0,0,W,H):null;const F=newFrame(),tex=uploadStraight({w:W,h:H,data:d.data,bits:8});premultInto(F.target,tex,[0,0],null);gl.deleteTexture(tex);list.push(F);}
  putFrames(list,false,'Spin frame');}
/* make the loop seamless: the first k frames fade in from the last k, and the last k are dropped */
function seamlessLoop(k){const A=A_();if(!A)return;const [a,b]=animRange(),n=b-a+1;k=clamp(Math.round(k)||1,1,Math.floor((n-1)/2));
  if(n<3){toast('Needs at least three frames.');return;}if(n<=2*k){toast('Too few frames for that overlap.');return;}
  animOp('Seamless loop',A=>{const fr=A.frames.slice();for(let j=0;j<k;j++){const tail=fr[b-k+1+j],head=fr[a+j],F=newFrame();
      run(P.mix,F.target,{uA:tail.target.tex,uB:head.target.tex,uT:j/k,uM:dummy.tex||dummy,uUseM:false});F.hold=head.hold;fr[a+j]=F;frameDirty(F);}
    fr.splice(b-k+1,k);A.frames=fr;A.cur=clamp(A.cur,0,fr.length-1);ui.fsel=null;});
  toast('Loop made seamless: '+k+' frames now fade from the end into the start.');}
function cutFrameGrid(){if(!ensureAnimMode())return;const c=frameCanvas(curFrame()),id=c.getContext('2d').getImageData(0,0,c.width,c.height);importSheet({w:c.width,h:c.height,data:id.data,bits:8});}
(function buildVfxMenu(){const s=el('select',{class:'tlsel','aria-label':'VFX',title:'Fire, smoke and sparks generators, spin, seamless loop and cut into a grid'},el('option',{value:'',text:'VFX…'}),
    ...[['g0','Fire…'],['g1','Smoke…'],['g2','Sparks…'],['g3','Explosion…'],['g4','Lightning…'],['g5','Magic orb…'],['g6','Shockwave…'],['g7','Rain…'],['g8','Snow…'],['g9','Blood splat…'],['g10','Ripples…'],['g11','Slash…'],['g12','Impact burst…'],['g13','Dust puff…'],['g14','Energy beam…'],['g15','Bubbles…'],['g16','Portal…'],['g17','Sparkles…'],['g18','Muzzle flash…']].map(([v,t])=>el('option',{value:v,text:t})),el('option',{value:'spin',text:'Spin this frame…'}),el('option',{value:'loop',text:'Make loop seamless…'}),el('option',{value:'cut',text:'Cut this frame into a grid…'}));
  s.addEventListener('change',()=>{const v=s.value;s.value='';s.blur();
    if(v[0]==='g')dlgGenerate(+v.slice(1));
    if(v==='spin')dlgNumber('Spin this frame','How many frames for one full turn?',16,2,256,n=>spinFrames(n,360));
    if(v==='loop')dlgNumber('Make loop seamless','How many frames should fade between the end and the start?',Math.max(1,Math.min(8,Math.floor((A_().frames.length-1)/4))),1,64,seamlessLoop);
    if(v==='cut')cutFrameGrid();});
  const c=document.querySelector('#timeline .tlctrl');const pv=[...c.children].find(x=>x.tagName==='BUTTON'&&x.textContent==='Preview');c.insertBefore(s,pv||null);})();
