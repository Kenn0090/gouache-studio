/* ================= VFX filters: Dissolve and Glow (made for animating on the timeline) ================= */
const VFX_FS={
  dissolve:GL_ST+`uniform sampler2D uSrc; uniform float uT; uniform float uScale; uniform float uSoft; uniform float uEdge; uniform vec3 uCol; uniform float uGlow; uniform float uSeed; uniform float uRough;
float hv(vec2 p){ return fract(sin(dot(p+uSeed,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f); return mix(mix(hv(i),hv(i+vec2(1,0)),u.x),mix(hv(i+vec2(0,1)),hv(i+vec2(1,1)),u.x),u.y); }
void main(){ vec2 p=gl_FragCoord.xy; vec4 c=texelFetch(uSrc,ivec2(p),0);
  float n=0.0,a=0.5,s=1.0/max(uScale,1.0); for(int i=0;i<5;i++){ n+=a*vn(p*s); s*=2.0; a*=uRough; } float tot=0.0; a=0.5; for(int i=0;i<5;i++){ tot+=a; a*=uRough; } n/=tot;
  n=clamp((n-0.5)*1.6+0.5,0.0,1.0);
  float e=uT*(1.0+uSoft+uEdge)-uSoft-uEdge;
  float vis=smoothstep(e,e+uSoft+0.0001,n);
  float ring=(1.0-smoothstep(e+uEdge,e+uEdge+uSoft+0.0001,n))*vis;
  vec3 r=mix(st(c),uCol,clamp(ring*uGlow,0.0,1.0)); float al=c.a*vis; o=vec4(r*al,al); }`,
  glow:`uniform sampler2D uSrc; uniform sampler2D uBlur; uniform float uAmt; uniform vec3 uTint; uniform float uTh;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 c=texelFetch(uSrc,p,0),b=texelFetch(uBlur,p,0);
  float l=dot(b.rgb,vec3(0.2126,0.7152,0.0722)); float k=smoothstep(uTh,uTh+0.25,l/max(b.a,1e-4));
  vec3 add=b.rgb*uTint*uAmt*k; o=vec4(c.rgb+add,clamp(c.a+b.a*uAmt*k,0.0,1.0)); }`};
VFX_FS.filmgrain=GL_ST+`uniform sampler2D uSrc; uniform float uAmt; uniform float uSize; uniform float uCol; uniform float uSeed;
float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){ vec2 gp=floor(gl_FragCoord.xy/max(uSize,0.5)); vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); if(c.a<=1e-6){ o=c; return; } vec3 r=st(c);
  float m=h12(gp+uSeed)+h12(gp+uSeed+19.7)-1.0; vec3 n=vec3(h12(gp+uSeed+41.3)+h12(gp+uSeed+57.1)-1.0,h12(gp+uSeed+73.9)+h12(gp+uSeed+88.3)-1.0,h12(gp+uSeed+101.7)+h12(gp+uSeed+127.9)-1.0);
  float l=lumOf(r); float w=0.3+0.7*clamp(4.0*l*(1.0-l),0.0,1.0); r=clamp(r+mix(vec3(m),n,uCol)*uAmt*0.3*w,0.0,1.0); o=vec4(r*c.a,c.a); }`;
const PVX=Object.fromEntries(Object.entries(VFX_FS).map(([k,s])=>[k,program(s)]));
fxDef('dissolve',{title:'Erode / Dissolve',note:'Eats the picture away with a noise pattern. Animate Amount from 0 to 100% to make it erode over time, with an optional glowing burn edge.',
  init:()=>({seed:Math.random()*100,col:[1,.55,.1]}),
  defs:[{key:'t',label:'Amount',min:0,max:1,step:.005,value:0,fmt:pct},{key:'sc',label:'Size',min:4,max:400,step:1,value:60,fmt:px},{key:'soft',label:'Softness',min:0,max:.5,step:.01,value:.05,fmt:pct},{key:'edge',label:'Burn edge',min:0,max:.4,step:.01,value:.08,fmt:pct},{key:'glow',label:'Edge glow',min:0,max:1,step:.01,value:1,fmt:pct},{key:'rough',label:'Roughness',min:.2,max:.9,step:.01,value:.5,fmt:pct}],
  controls:(v,upd)=>[el('div',{class:'frow'},colIn(v,'col','Edge colour',upd),el('button',{class:'btn sm',text:'New random',onclick:()=>{v.seed=Math.random()*100;upd();}}))],
  render(src,dst,v){run(PVX.dissolve,dst,{uSrc:src.tex,uT:v.t,uScale:v.sc,uSoft:v.soft,uEdge:v.edge,uCol:v.col,uGlow:v.glow,uSeed:v.seed,uRough:v.rough});}});
fxDef('vfxGlow',{title:'Glow',note:'A soft bloom around the bright parts, added on top.',init:()=>({tint:[1,1,1]}),
  defs:[{key:'amt',label:'Amount',min:0,max:4,step:.01,value:1,fmt:pct},{key:'r',label:'Size',min:1,max:100,step:.5,value:14,fmt:px},{key:'th',label:'From brightness',min:0,max:.95,step:.01,value:.3,fmt:pct}],
  controls:(v,upd)=>[el('div',{class:'frow'},colIn(v,'tint','Glow colour',upd))],
  render(src,dst,v){const b=acquire();gaussian(src,b,v.r);run(PVX.glow,dst,{uSrc:src.tex,uBlur:b.tex,uAmt:v.amt,uTint:v.tint,uTh:v.th});release(b);}});
fxDef('filmGrain',{title:'Film grain',frameSeed:true,note:'Fine film-style grain, strongest in the mid-tones. On the animation timeline it changes on every frame, so the grain moves when it plays.',init:()=>({seed:Math.random()*100,animated:true}),
  defs:[{key:'amt',label:'Amount',min:0,max:1,step:.01,value:.4,fmt:pct},{key:'size',label:'Grain size',min:.6,max:6,step:.05,value:1.4,fmt:px},{key:'col',label:'Colour noise',min:0,max:1,step:.01,value:.25,fmt:pct}],
  checks:[['animated','Change every frame (animation)',true]],
  controls:(v,upd)=>[el('div',{class:'frow'},el('button',{class:'btn sm',text:'New random',onclick:()=>{v.seed=Math.random()*100;upd();}}))],
  render(src,dst,v){run(PVX.filmgrain,dst,{uSrc:src.tex,uAmt:v.amt,uSize:v.size,uCol:v.col,uSeed:v.seed});}});
