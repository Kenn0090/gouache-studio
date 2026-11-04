/* ================= Line blend brush (0.95) =================
   Kenn (from Heavypaint): a brush that "samples colours and creates a gradient between the two in a strip, like a gradient mixed with an eye dropper".
   Press: the colour under the pen is picked up. Drag: a straight strip (as wide as the brush) runs from where you pressed to where the pen is now,
   and its colour is a gradient from the colour picked at the start to the colour under the pen now, shown live. Lift: the strip is laid down.
   It uses the normal stroke path (the stroke buffer carries its own colours, like colour jitter), so opacity, selections, lock alpha and undo behave as for other brushes.
   It samples the layer being painted, or all visible layers when "Sample visible layers" is on. Colour maps only. */
const FS_LBSTRIP=`uniform vec2 uA; uniform vec2 uB; uniform float uHalf; uniform float uSoft; uniform vec3 uCa; uniform vec3 uCb; uniform float uAlpha; uniform float uCap;
void main(){ vec2 p=gl_FragCoord.xy; vec2 d=uB-uA; float L=max(length(d),1e-4); vec2 n=d/L; float s=dot(p-uA,n), u=dot(p-uA,vec2(-n.y,n.x));
  float side=uCap>0.5?clamp((uHalf-length(vec2(s-clamp(s,0.0,L),u)))/max(uSoft,1.0)+0.5,0.0,1.0):clamp((uHalf-abs(u))/max(uSoft,1.0)+0.5,0.0,1.0)*clamp(s+0.5,0.0,1.0)*clamp(L-s+0.5,0.0,1.0);
  vec3 c=mix(uCa,uCb,clamp(s/L,0.0,1.0)); o=vec4(c,side*uAlpha); }`;
let P_LBSTRIP=null;
/* the colour under (x, y): a 3×3 average, straight (not premultiplied); null when the canvas is empty there */
function lbColour(t,x,y){if(!t)return null;const R=3,x0=clamp(Math.round(x)-1,0,Math.max(0,t.w-R)),y0=clamp(Math.round(y)-1,0,Math.max(0,t.h-R));
  gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);let r=0,g=0,b=0,a=0,n=R*R;
  if(t.depth===16){const f=new Float32Array(n*4);gl.readPixels(x0,y0,R,R,gl.RGBA,gl.FLOAT,f);for(let i=0;i<n;i++){r+=f[i*4];g+=f[i*4+1];b+=f[i*4+2];a+=f[i*4+3];}}
  else{const u=new Uint8Array(n*4);gl.readPixels(x0,y0,R,R,gl.RGBA,gl.UNSIGNED_BYTE,u);for(let i=0;i<n;i++){r+=u[i*4]/255;g+=u[i*4+1]/255;b+=u[i*4+2]/255;a+=u[i*4+3]/255;}}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(a<.02*n)return null;return [clamp(r/a,0,1),clamp(g/a,0,1),clamp(b/a,0,1)];}
function lbBegin(s){if(s.o.fanFill)return fanBegin(s);const o=s.o,all=!!o.sampleAll&&!s.L.maskOf&&!s.L.quick,src=all?compositeMap('base'):s.L.target;
  s.lb={ax:s.x,ay:s.y,p0:s.p,src,own:all,ca:null,cb:null,at:0,sx:-1e9,sy:-1e9,box:null,fg:(o.color||[0,0,0]).slice(0,3),solid:!!o.lineSolid};
  if(o.lineSolid){let c=s.lb.fg;if((o.hueJitter||0)+(o.valJitter||0)>0){let [h,sa,v]=rgb2hsv(c[0],c[1],c[2]);h=((h+(Math.random()*2-1)*(o.hueJitter||0)*180)%360+360)%360;v=clamp(v*(1+(Math.random()*2-1)*(o.valJitter||0)),0,1);c=hsv2rgb(h,sa,v);}s.lb.ca=s.lb.cb=c;return;}
  s.lb.ca=lbColour(src,s.x,s.y)||s.lb.fg;}
function lbMove(s,x,y,p){const lb=s.lb;if(lb&&lb.fan)return fanMove(s,x,y,p);if(!lb||Math.hypot(x-lb.ax,y-lb.ay)<1)return;
  const now=performance.now();if(!lb.solid&&(!lb.cb||(now-lb.at>40&&Math.hypot(x-lb.sx,y-lb.sy)>1.5))){lb.cb=lbColour(lb.src,x,y)||lb.fg;lb.at=now;lb.sx=x;lb.sy=y;}
  const W=doc.w,H=doc.h,half=radiusAt(lb.p0),pad=half+3,
    nb=[Math.floor(Math.min(lb.ax,x)-pad),Math.floor(Math.min(lb.ay,y)-pad),Math.ceil(Math.max(lb.ax,x)+pad),Math.ceil(Math.max(lb.ay,y)+pad)].map((v,i)=>clamp(v,0,i%2?H:W)),
    u=lb.box?[Math.min(nb[0],lb.box[0]),Math.min(nb[1],lb.box[1]),Math.max(nb[2],lb.box[2]),Math.max(nb[3],lb.box[3])]:nb;
  if(u[2]<=u[0]||u[3]<=u[1])return;
  if(!P_LBSTRIP)P_LBSTRIP=program(FS_LBSTRIP);
  scissorDo([u[0],u[1],u[2]-u[0],u[3]-u[1]],()=>run(P_LBSTRIP,strokeT,{uA:[lb.ax,lb.ay],uB:[x,y],uHalf:half,uSoft:Math.max(1,(1-(s.o.hardness==null?1:s.o.hardness))*half),uCa:lb.ca,uCb:lb.cb,uAlpha:clamp(s.o.flow,.01,1),uCap:lb.solid?1:0}));
  lb.box=nb;const b=s.bb;b[0]=Math.min(b[0],nb[0]);b[1]=Math.min(b[1],nb[1]);b[2]=Math.max(b[2],nb[2]);b[3]=Math.max(b[3],nb[3]);
  fdAdd(s,u);s.x=x;s.y=y;s.p=p;requestRender(true);}
function lbEnd(s){const lb=s.lb;if(lb&&lb.own&&lb.src)release(lb.src);s.lb=null;}
PRESETS.push({name:'Line blend',tool:'brush',lineBlend:true,size:60,opacity:1,flow:1,hardness:1,spacing:.05,pSize:false,pOpacity:false,smoothing:0,sampleAll:true});
