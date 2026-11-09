/* ================= De-light (0.96.3, Kenn: "add the De-light filter to Paint") =================
   The Convert tab's photo de-lighting as an ordinary filter: Filter menu, Filter Gallery and filter layers.
   The light falling across the picture is found by blurring its brightness over "Lighting size" (on a
   shrunk copy, so big sizes stay quick) and divided out towards the picture's average brightness;
   then shadows are lifted, highlights tamed and the colour strength set, as in Convert › Base colour. */
const FS_DELIGHT=`uniform sampler2D uSrc; uniform sampler2D uLB; uniform vec2 uSize; uniform float uMean; uniform float uEven; uniform float uShad; uniform float uHigh; uniform float uSat;
float lum(vec3 c){ return dot(c,vec3(0.2126,0.7152,0.0722)); }
void main(){ vec4 s=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); if(s.a<=1e-6){ o=s; return; } vec3 c=s.rgb/s.a; vec4 b=texture(uLB,gl_FragCoord.xy/uSize); float lb=b.a>1e-4?lum(b.rgb/b.a):uMean;
  c*=mix(1.0,clamp(uMean/max(lb,1e-3),0.25,4.0),uEven); float l=lum(c);
  c*=1.0+(1.0-smoothstep(0.0,0.45,l))*uShad*1.4; l=lum(c); c=mix(c,c*(0.55+0.45*(1.0-l)),smoothstep(0.55,1.0,l)*uHigh);
  c=mix(vec3(lum(c)),c,uSat); o=vec4(clamp(c,0.0,1.0)*s.a,s.a); }`;
let P_DELIGHT=null;const dlTmp={};
function dlT(name,w,h){let t=dlTmp[name];if(!t||t.w!==w||t.h!==h){if(t)disposeTarget(t);t=dlTmp[name]=makeTarget(w,h,canFloat?16:8,false);}return t;}
function delightRender(src,dst,v){if(!P_DELIGHT)P_DELIGHT=program(FS_DELIGHT);
  const W=src.w,H=src.h,r=Math.max(2,v.r||80);
  /* halve down until one texel is about a sixth of the lighting size (and to a small copy for the average) */
  let i=0;const half=t=>{const o=dlT('h'+(i++),Math.max(1,Math.ceil(t.w/2)),Math.max(1,Math.ceil(t.h/2)));run(P.f_rs,o,{uSrc:t.tex,uOut:[o.w,o.h]});return o;};
  let cur=src,f=1;const want=Math.max(1,r/6);while(f*2<=want&&(cur.w>1||cur.h>1)){cur=half(cur);f*=2;}
  const small={t:cur,f};while(cur.w>32||cur.h>32)cur=half(cur);
  /* the picture's average brightness, from the smallest copy (only where something is painted) */
  const d=captureRegionNow(cur,0,0,cur.w,cur.h),q=d.depth===16?Array.from(d.data,h2f):Array.from(d.data,x=>x/255);let s=0,n=0;
  for(let k=0;k<q.length;k+=4){const a=q[k+3];if(a<.5)continue;s+=(.2126*q[k]+.7152*q[k+1]+.0722*q[k+2])/a;n++;}const mean=n?s/n:.5;
  /* the light across the picture: the copy at the right scale, blurred */
  const B=small.t,sig=Math.max(.5,r/small.f/2.2),R=Math.min(128,Math.ceil(sig*3)),b1=dlT('b1',B.w,B.h),b2=dlT('b2',B.w,B.h);
  withUVWrap(!!doc.wrap,[B,b1],()=>{run(P.blur,b1,{uSrc:B.tex,uDir:[1,0],uSigma:sig,uRadius:{int:R}});run(P.blur,b2,{uSrc:b1.tex,uDir:[0,1],uSigma:sig,uRadius:{int:R}});});
  run(P_DELIGHT,dst,{uSrc:src.tex,uLB:b2.tex,uSize:[W,H],uMean:mean,uEven:v.even,uShad:v.shad,uHigh:v.high,uSat:v.sat});}
fxDef('delight',{title:'De-light',note:'Removes lighting baked into a photo (bright and dark patches, shadows, shiny spots) so the colour works under any light.',
  defs:[{key:'even',label:'Even out lighting',min:0,max:1,step:.01,value:.6,fmt:pct},{key:'r',label:'Lighting size',min:8,max:400,step:1,value:80,fmt:v=>v+'px'},
    {key:'shad',label:'Lift shadows',min:0,max:1,step:.01,value:.3,fmt:pct},{key:'high',label:'Tame highlights',min:0,max:1,step:.01,value:.25,fmt:pct},{key:'sat',label:'Saturation',min:0,max:2,step:.01,value:1,fmt:pct}],
  render(src,dst,v){delightRender(src,dst,v);}});
