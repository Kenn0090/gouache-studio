/* ================= Fan fill brushes (0.95) =================
   Heavy Paint's Fan / Fan fade (Kenn: "some brushes acted like lassos but with paint"): the stroke is not a trail of dabs.
   The spot where you press stays as a pivot, and the shape between the pivot and the path you drag is filled solid, ray by ray,
   with streaky colour (each ray a little lighter, darker or a different hue). Fade softens the outer rim.
   Same stroke path as Line blend: the stroke buffer carries its own colours, so opacity, selection, lock alpha and undo work as usual. */
const FS_FAN=`uniform vec2 uA; uniform vec2 uP; uniform vec2 uQ; uniform vec3 uC; uniform float uAlpha; uniform float uRays; uniform float uHue; uniform float uVal; uniform float uFade; uniform float uSeed;
float fh(float n){return fract(sin(n*91.3458+uSeed)*47453.5453);}
void main(){ vec2 p=gl_FragCoord.xy; vec2 a=uP-uA, b=uQ-uA, q=p-uA; float den=a.x*b.y-a.y*b.x; if(abs(den)<1e-5){discard;}
  float s=(q.x*b.y-q.y*b.x)/den, t=(a.x*q.y-a.y*q.x)/den; float w=1.0-s-t;
  float e=1.0/max(length(a)+length(b),1.0); if(s<-e||t<-e||s+t>1.0+e){discard;}
  float ang=atan(q.y,q.x); float ray=floor(ang*uRays/6.2831853); float r1=fh(ray), r2=fh(ray+17.0);
  vec3 c=uC; float m=max(c.r,max(c.g,c.b)); c=mix(c,c.gbr,(r1-.5)*uHue*2.0); c*=1.0+(r2-.5)*uVal*2.0; c=clamp(c,0.0,1.0);
  float al=uAlpha; if(uFade>0.0){float rim=smoothstep(1.0,1.0-uFade,s+t); al*=rim;}
  o=vec4(c,al); }`;
let P_FAN=null;
function fanBegin(s){const o=s.o;s.lb={fan:true,ax:s.x,ay:s.y,px:s.x,py:s.y,n:0,box:null,seed:Math.random()*100,c:(o.color||[0,0,0]).slice(0,3)};}
function fanMove(s,x,y,p){const f=s.lb;if(Math.hypot(x-f.px,y-f.py)<1.5)return;
  if(f.n>0||Math.hypot(x-f.ax,y-f.ay)>2){
    if(!P_FAN)P_FAN=program(FS_FAN);const o=s.o,W=doc.w,H=doc.h,pad=3,
      u=[Math.floor(Math.min(f.ax,f.px,x)-pad),Math.floor(Math.min(f.ay,f.py,y)-pad),Math.ceil(Math.max(f.ax,f.px,x)+pad),Math.ceil(Math.max(f.ay,f.py,y)+pad)].map((v,i)=>clamp(v,0,i%2?H:W));
    if(f.n>0&&u[2]>u[0]&&u[3]>u[1]){
      scissorDo([u[0],u[1],u[2]-u[0],u[3]-u[1]],()=>run(P_FAN,strokeT,{uA:[f.ax,f.ay],uP:[f.px,f.py],uQ:[x,y],uC:f.c,uAlpha:clamp(o.flow,.01,1),uRays:Math.max(8,(o.laneN||40)*6),uHue:o.laneHue||0,uVal:o.laneVal||0,uFade:o.fanFill===2?.35:0,uSeed:f.seed}));
      const b=s.bb;b[0]=Math.min(b[0],u[0]);b[1]=Math.min(b[1],u[1]);b[2]=Math.max(b[2],u[2]);b[3]=Math.max(b[3],u[3]);fdAdd(s,u);requestRender(true);}
    f.n++;}
  f.px=x;f.py=y;s.x=x;s.y=y;s.p=p;}
