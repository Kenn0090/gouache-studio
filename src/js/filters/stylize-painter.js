/* ================= Stylize layer, Painter edition (0.79) =================
   The same idea as Substance Painter's Stylization filter, in our own words: one layer on top that repaints every map below.
   A few master sliders (Stylization, Brush strokes, Smoothness, Colorize, Gradient, Baked lighting, Edges and cavities), each with
   its own folding group of settings. The shape of the model comes from the mesh maps (world normal, position, AO, curvature),
   else from the model, else the picture, through the Hand-painted layer's reading (hpPaint with showN 1/2/3 gives packs:
   N = normal, M = AO / curvature / thinness, P = position).
   Each map goes: smoothed (its own amount) → colour only: colorize, gradient, edges and cavities, the part of the baked lighting
   that the strokes carry → brush strokes (stamps of a brush tip; the SAME stamps in every map, laid out from the colour below,
   so colour, height and normal agree) → stroke effects (relief in height and normal, darker stroke edges, roughness) → colour
   only: the rest of the baked lighting → mixed with the original by Stylization.
   L.fx = {map:'all', stack:[{id:'stylizeP', v}]}. */
let P_PA=null;
function paProgs(){if(P_PA)return P_PA;
  /* colour looks: part 0 = before the strokes, part 1 = after (only the lighting the strokes do not carry) */
  const look=GL_ST+`uniform sampler2D uSrc; uniform sampler2D uN; uniform sampler2D uM; uniform sampler2D uP; uniform int uPart;
uniform float uCol; uniform float uHue; uniform float uSat; uniform float uVal; uniform float uCon; uniform float uPost;
uniform float uGrad; uniform int uGMode; uniform vec3 uG1; uniform float uGO1; uniform int uGB1; uniform vec3 uG2; uniform float uGO2; uniform int uGB2; uniform vec3 uGDir; uniform int uGInv; uniform float uGOff; uniform float uGCon;
uniform float uLit; uniform float uLitPart; uniform vec3 uL; uniform float uDI; uniform vec3 uDC; uniform float uDR; uniform float uDCon; uniform float uSI; uniform vec3 uSC; uniform float uSR; uniform float uSCon;
uniform float uEdg; uniform vec3 uEC; uniform float uEO; uniform float uEW; uniform vec3 uCC; uniform float uCO; uniform float uCW; uniform float uAOO;
float lum(vec3 c){ return dot(c,vec3(0.299,0.587,0.114)); }
vec3 ovl(vec3 a,vec3 b){ return mix(2.0*a*b,1.0-2.0*(1.0-a)*(1.0-b),step(0.5,a)); }
vec3 blendM(int m,vec3 a,vec3 b){ if(m==1) return a*b; if(m==2) return 1.0-(1.0-a)*(1.0-b); if(m==3) return ovl(a,b);
  if(m==4) return mix(2.0*a*b+a*a*(1.0-2.0*b),sqrt(max(a,0.0))*(2.0*b-1.0)+2.0*a*(1.0-b),step(0.5,b)); if(m==5) return a+b; return b; }
vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
  float d=q.x-min(q.w,q.y); return vec3(abs(q.z+(q.w-q.y)/(6.0*d+1e-10)),d/(q.x+1e-10),q.x); }
vec3 hsv2rgb(vec3 c){ vec3 p=abs(fract(c.xxx+vec3(1.0,2.0/3.0,1.0/3.0))*6.0-3.0); return c.z*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),c.y); }
vec3 light(vec3 c,vec3 N,float w){ if(w<=0.0) return c; float d=dot(N,uL);
  float t=clamp((d+uDR)/(1.0+uDR),0.0,1.0); t=clamp((t-0.5)*(1.0+uDCon*4.0)+0.5,0.0,1.0);
  vec3 r=c*mix(1.0-uDI*0.7,1.0+uDI*0.5,t); r=mix(r,ovl(r,uDC),t*uDI*0.6);
  float sp=pow(smoothstep(1.0-max(uSR,0.01)*0.6,1.0,d),1.0+uSCon*6.0); r+=uSC*sp*uSI;
  return mix(c,r,w); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(uSrc,p,0); if(s.a<0.002){ o=s; return; } vec3 c=st(s);
  vec3 N=normalize(texelFetch(uN,p,0).rgb*2.0-1.0+1e-5); vec4 M=texelFetch(uM,p,0); vec3 P=texelFetch(uP,p,0).rgb;
  if(uPart==0){
    /* colorize: hue, saturation, brightness, contrast, and flat tones (fewer steps of value, as a painter would) */
    if(uCol>0.0){ vec3 h=rgb2hsv(clamp(c,0.0,1.0)); h.x=fract(h.x+uHue/360.0); h.y=clamp(h.y*uSat,0.0,1.0); h.z=clamp(h.z*uVal,0.0,1.0);
      if(uPost>1.5) h.z=floor(h.z*uPost+0.5)/uPost; vec3 r=hsv2rgb(h); r=clamp((r-0.5)*uCon+0.5,0.0,1.0); c=mix(c,r,uCol); }
    /* gradient across the model (position), one or two colours each with its own blend */
    if(uGrad>0.0){ float g=clamp(dot(P-0.5,uGDir)+0.5+(uGOff-0.5),0.0,1.0); if(uGInv==1) g=1.0-g; g=clamp((g-0.5)*(1.0+uGCon*4.0)+0.5,0.0,1.0);
      c=mix(c,blendM(uGB1,c,uG1),g*uGO1*uGrad); if(uGMode==1) c=mix(c,blendM(uGB2,c,uG2),(1.0-g)*uGO2*uGrad); }
    /* edges and cavities: curvature (0.5 = flat) and AO */
    if(uEdg>0.0){ float cv=(M.g-0.5)*2.0; float e=smoothstep(mix(0.6,0.02,uEW),mix(0.95,0.3,uEW),cv), k=smoothstep(mix(0.6,0.02,uCW),mix(0.95,0.3,uCW),-cv);
      c=mix(c,blendM(2,c,uEC),e*uEO*uEdg); c=mix(c,c*uCC,k*uCO*uEdg); c=mix(c,c*M.r,(1.0-M.r)*uAOO*uEdg); }
    c=light(c,N,uLit*uLitPart);
  } else c=light(c,N,uLit*(1.0-uLitPart));
  o=vec4(clamp(c,0.0,1.0)*s.a,s.a); }`;
  /* brush strokes: stamps of a brush tip on a jittered grid. Where they go and how they turn comes from the guide (the colour
     below), so every map gets the same stamps. Each stamp copies the map's value at its centre (a flat dab of paint).
     uMode 1: the relief of the stamps instead (for height, normal and stroke edges). */
  const stamp=GL_ST+`uniform sampler2D uA; uniform sampler2D uG; uniform sampler2D uN; uniform sampler2D uTip; uniform vec2 uTipS; uniform int uMode; uniform int uKind;
uniform float uSize; uniform float uRand; uniform float uDens; uniform float uLen; uniform float uRot; uniform float uRotRand; uniform float uFollow; uniform float uHard; uniform float uNThr;
uniform float uCVar; uniform float uSeed; uniform int uWrap;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)+uSeed*0.0137); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float lm(ivec2 q,ivec2 s){ vec4 c=texelFetch(uG,wrapP(q,s,uWrap),0); return dot(st(c),vec3(0.299,0.587,0.114)); }
vec3 nAt(ivec2 q,ivec2 s){ return normalize(texelFetch(uN,wrapP(q,s,uWrap),0).rgb*2.0-1.0+1e-5); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uG,0); vec4 c0=texelFetch(uA,p,0); vec4 g0=texelFetch(uG,p,0);
  if(g0.a<0.01){ o=uMode==1?vec4(0.0,0.0,0.0,1.0):c0; return; }
  vec2 x=vec2(p)+0.5; float big=uSize*(1.0+uRand)*max(1.0,uLen), cell=max(max(2.0,uSize/max(uDens,0.2)),big*0.375); vec2 ci=floor(x/cell);
  vec3 N0=nAt(p,s); vec4 res=c0; float rel=0.0;
  for(int dy=-2;dy<=2;dy++)for(int dx=-2;dx<=2;dx++){ vec2 cc=ci+vec2(dx,dy);
    float r1=h21(cc),r2=h21(cc+11.3),r3=h21(cc+23.7),r4=h21(cc+37.1),r5=h21(cc+44.4),r7=h21(cc+63.2);
    vec2 ctr=(cc+vec2(r1,r2))*cell; ivec2 cp=wrapP(ivec2(floor(ctr)),s,uWrap); vec4 gk=texelFetch(uG,cp,0); if(gk.a<0.5) continue;
    /* a stamp stays on the side of the model it started on (normal threshold) */
    if(uNThr>0.0&&dot(nAt(cp,s),N0)<mix(-1.0,0.98,uNThr)) continue;
    float size=max(1.0,uSize*(1.0+(r3*2.0-1.0)*uRand)), ang=uRot+(r4*2.0-1.0)*uRotRand*3.1415927;
    if(uFollow>0.0){ int st2=max(1,int(size*0.35)); float gx=lm(cp+ivec2(st2,0),s)-lm(cp-ivec2(st2,0),s), gy=lm(cp+ivec2(0,st2),s)-lm(cp-ivec2(0,st2),s);
      if(abs(gx)+abs(gy)>1e-3){ float a2=atan(gx,-gy)+(r4*2.0-1.0)*uRotRand*3.1415927+uRot; float dd=mod(a2-ang+3.1415927,6.2831853)-3.1415927; ang+=dd*uFollow; } }
    vec2 d=x-ctr; if(uWrap==1) d-=round(d/vec2(s))*vec2(s);
    float cs=cos(ang),sn=sin(ang); vec2 l=vec2(cs*d.x+sn*d.y,-sn*d.x+cs*d.y);
    vec2 wh=uTipS.x>=uTipS.y?vec2(size,size*uTipS.y/uTipS.x):vec2(size*uTipS.x/uTipS.y,size); wh.x*=1.0+(uLen-1.0)*(0.6+0.4*r5);
    vec2 t=l/wh+0.5; if(t.x<0.0||t.y<0.0||t.x>1.0||t.y>1.0) continue;
    float ta=texture(uTip,t).r; ta=mix(ta,smoothstep(0.35,0.65,ta),uHard); if(ta<0.02) continue;
    if(uMode==1){ rel=mix(rel,0.55+0.45*r7,ta); continue; }
    vec4 k=texelFetch(uA,cp,0); vec3 kc=st(k);
    if(uKind==0&&uCVar>0.0) kc=clamp(kc*(1.0+(r7-0.5)*uCVar*0.5)+(r5-0.5)*uCVar*0.08,0.0,1.0);
    res=mix(res,vec4(kc*c0.a,c0.a),ta); }
  o=uMode==1?vec4(vec3(rel),1.0):res; }`;
  /* stroke effects from the relief: kinds 0 colour (darker stroke edges), 1 rough/gloss (variation), 2 height (raised), 3 normal (tilted) */
  const fx=GL_ST+`uniform sampler2D uSrc; uniform sampler2D uR; uniform int uKind; uniform int uWrap; uniform float uEH; uniform float uEN; uniform float uEE; uniform float uER; uniform int uGl;
float R(ivec2 q,ivec2 s){ return texelFetch(uR,wrapP(q,s,uWrap),0).r; }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec4 c=texelFetch(uSrc,p,0); float r=R(p,s);
  float gx=R(p+ivec2(1,0),s)-R(p-ivec2(1,0),s), gy=R(p+ivec2(0,1),s)-R(p-ivec2(0,1),s); vec3 v=st(c);
  if(uKind==0) v*=1.0-clamp(length(vec2(gx,gy))*1.5,0.0,1.0)*uEE;
  else if(uKind==1) v=clamp(v+(r-0.5)*uER*0.3*(uGl==1?-1.0:1.0),0.0,1.0);
  else if(uKind==2) v+=vec3(r*uEH*0.05);
  else if(uKind==3){ vec3 n=v*2.0-1.0; n=length(n)>1e-4?normalize(n):vec3(0.0,0.0,1.0); n.xy-=vec2(gx,-gy)*uEN*2.0; n=normalize(n); v=n*0.5+0.5; }
  o=vec4(v*c.a,c.a); }`;
  /* normals stay unit length after being smoothed */
  const nrm=GL_ST+`uniform sampler2D uSrc; void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); vec3 n=st(c)*2.0-1.0; n=length(n)>1e-4?normalize(n):vec3(0.0,0.0,1.0); o=vec4((n*0.5+0.5)*c.a,c.a); }`;
  P_PA={look:program(look),stamp:program(stamp),fx:program(fx),nrm:program(nrm)};P_PA.stamp.tiled=true;return P_PA;}

const PA_DEFAULTS={stylization:1,strokes:1,smooth:1,colorize:0,gradient:0,lighting:.3,edges:.4,seed:1,
  tipKey:'b:bristle',sDens:2.2,sSize:36,sRand:.45,sLen:1.6,sFollow:.85,sRot:0,sRotRand:.2,sHard:.5,sNThr:.6,sCVar:.4,
  eH:.5,eN:.5,eE:.12,eR:.3,
  smR:4,smC:.6,smH:.8,smN:.8,smRo:1,smM:1,
  hue:0,sat:1.1,val:1,con:1.05,post:0,
  gMode:1,g1:[1,.92,.8],gO1:.6,gB1:3,g2:[.35,.3,.5],gO2:.5,gB2:1,gH:0,gV:90,gInv:false,gOff:.5,gCon:.2,
  litPart:1,dI:.5,dC:[1,.95,.85],dR:.3,dCon:.3,sI:.25,sC:[1,1,1],sR:.25,sCon:.3,lH:25,lV:60,
  eC:[1,.95,.85],eO:.6,eW:.4,cC:[.35,.28,.3],cO:.6,cW:.4,aoO:.5,show:'result'};
const PA_PRESETS={
  'Painterly':{},
  'Smudges':{tipKey:'b:sponge',sSize:28,sLen:1.2,sHard:.2,sCVar:.2,eE:.1,eH:.2,eN:.2,smC:.8},
  'Thick strokes':{sSize:48,sLen:2.2,sHard:.8,eH:1,eN:1,eE:.25,sCVar:.5},
  'Soft paint':{sSize:40,sLen:1.4,sHard:.1,eH:.2,eN:.2,eE:.05,smC:.9,lighting:.2,edges:.25},
  'Sketchy':{tipKey:'b:scratch',sSize:22,sLen:2.5,sDens:2.6,sHard:.9,eE:.3,colorize:.5,sat:.8,post:6},
  'Comic':{strokes:.4,colorize:1,post:4,con:1.3,sat:1.2,edges:.8,eO:.9,cO:.9,lighting:.5,dCon:1}};

/* the model's shape as three pictures, worked out once per layer: normal, AO/curvature/thinness, position */
function paDrop(n){const f=n&&n._paF;if(f){for(const k of ['N','M','P','R','G'])if(f[k])disposeTarget(f[k]);n._paF=null;}}
function paField(n,src,v,k){
  const key=[typeof msDocVer==='number'?msDocVer:0,typeof msEpoch==='number'?msEpoch:0,n?n.lookVer||0:0,doc.w,doc.h,!!doc.wrap,
    Object.keys(doc.meshMaps||{}).join(','),typeof v3!=='undefined'&&v3.mesh?v3.mesh.name+':'+v3.mesh.idx.length:'',
    ['tipKey','sDens','sSize','sRand','sLen','sFollow','sRot','sRotRand','sHard','sNThr','seed'].map(x=>v[x]).join(',')].join('|');
  const f=n&&n._paF;if(f&&(f.key===key||stroke))return f;
  if(n)paDrop(n);
  let base=src,own=null;if(k!=='base'){own=typeof hpBelow==='function'?hpBelow(n,'base'):null;if(!own){own=acquireD(mapDepth('base'));clearTarget(own);}base=own;}
  const mk=()=>makeTarget(doc.w,doc.h,doc.depth,false),F={key,temp:!n,N:mk(),M:mk(),P:mk(),G:mk(),R:makeTarget(doc.w,doc.h,canFloat?16:doc.depth,false)};
  blit(base,F.G,0,0,doc.w,doc.h,0,0);
  for(const [t,m] of [[F.N,1],[F.M,2],[F.P,3]])hpPaint(base,t,Object.assign({},SG_SHAPE_V,{showN:m}),n);
  run(paProgs().stamp,F.R,Object.assign(paStampU(v),{uA:F.G.tex,uG:F.G.tex,uN:F.N.tex,uMode:{int:1},uKind:{int:0}}));
  /* the relief is softened a little, so a stroke's body shows and not every bristle line of the tip */
  {const t=acquireD(F.R.depth);gaussian(F.R,t,Math.max(1,v.sSize*Math.max(doc.w,doc.h)/1024*.06));blit(t,F.R,0,0,doc.w,doc.h,0,0);release(t);}
  if(own)release(own);if(n)n._paF=F;return F;}
function paStampU(v){const S=Math.max(doc.w,doc.h)/1024,tip=typeof dualTip==='function'?dualTip({tipKey:v.tipKey}):null,tt=tip&&tip.alpha?tip:TIPS.bristle;
  return {uTip:tt.tex,uTipS:[tt.w,tt.h],uSize:v.sSize*S,uRand:v.sRand,uDens:v.sDens,uLen:v.sLen,uRot:v.sRot*Math.PI/180,uRotRand:v.sRotRand,uFollow:v.sFollow,uHard:v.sHard,uNThr:v.sNThr,
    uCVar:v.sCVar,uSeed:v.seed||1,uWrap:{int:doc.wrap?1:0}};}
const PA_KIND={base:0,rough:1,gloss:1,height:2,normal:3};
const paLookU=(v,F,part)=>({uN:F.N.tex,uM:F.M.tex,uP:F.P.tex,uPart:{int:part},uCol:v.colorize,uHue:v.hue,uSat:v.sat,uVal:v.val,uCon:v.con,uPost:v.post,
  uGrad:v.gradient,uGMode:{int:v.gMode|0},uG1:v.g1,uGO1:v.gO1,uGB1:{int:v.gB1|0},uG2:v.g2,uGO2:v.gO2,uGB2:{int:v.gB2|0},uGDir:hpDir(v.gV,v.gH),uGInv:{int:v.gInv?1:0},uGOff:v.gOff,uGCon:v.gCon,
  uLit:v.lighting,uLitPart:v.litPart,uL:hpDir(v.lV,v.lH),uDI:v.dI,uDC:v.dC,uDR:v.dR,uDCon:v.dCon,uSI:v.sI,uSC:v.sC,uSR:v.sR,uSCon:v.sCon,
  uEdg:v.edges,uEC:v.eC,uEO:v.eO,uEW:v.eW,uCC:v.cC,uCO:v.cO,uCW:v.cW,uAOO:v.aoO});

fxDef('stylizeP',{title:'Stylize (Painter style)',heavy:true,onlyLayer:true,wide:true,
  note:'Repaints everything below in every map, like the stylization filter of Substance Painter: brush strokes, smoothness, colorize, a gradient, baked lighting and edges and cavities, from the mesh maps of the model.',
  init:()=>Object.assign(JSON.parse(JSON.stringify(PA_DEFAULTS)),{preset:'Painterly'}),
  controls:(v,upd)=>paControls(v,upd),
  render(src,dst,v,ctx){const k=ctx&&ctx.k||'base',n=ctx&&ctx.layer,PG=paProgs();v=Object.assign({},PA_DEFAULTS,v);
    const kind=PA_KIND[k]??(k==='spec'||k==='metal'?4:5),F=paField(n,src,v,k),tmp=[],get=()=>{const t=acquireD(src.depth||doc.depth);tmp.push(t);return t;};
    /* helper views: what the layer reads */
    if(v.show!=='result'){const T=v.show==='normal'?F.N:v.show==='edges'?F.M:F.R;if(k==='base')blit(T,dst,0,0,doc.w,doc.h,0,0);else blit(src,dst,0,0,doc.w,doc.h,0,0);if(F.temp)paDrop({_paF:F});return;}
    let cur=src;
    /* smoothness: each map its own amount */
    const sm=(kind===0?v.smC:kind===1?v.smRo:kind===2?v.smH:kind===3?v.smN:kind===4?v.smM:0)*v.smooth;
    if(sm>0&&v.smR>.2){const b1=get(),b2=get();blit(cur,b1,0,0,doc.w,doc.h,0,0);gaussian(b1,b2,v.smR*Math.max(doc.w,doc.h)/1024);const o=get();run(P.mix,o,{uA:cur.tex,uB:b2.tex,uT:Math.min(1,sm),uM:dummy,uUseM:false});cur=o;
      if(kind===3){const o2=get();run(PG.nrm,o2,{uSrc:cur.tex});cur=o2;}}
    if(kind===0){const o=get();run(PG.look,o,Object.assign(paLookU(v,F,0),{uSrc:cur.tex}));cur=o;}
    /* brush strokes: the same stamps in every map */
    if(v.strokes>0){const o=get();run(PG.stamp,o,Object.assign(paStampU(v),{uA:cur.tex,uG:F.G.tex,uN:F.N.tex,uMode:{int:0},uKind:{int:kind}}));
      const o2=get();run(P.mix,o2,{uA:cur.tex,uB:o.tex,uT:Math.min(1,v.strokes),uM:dummy,uUseM:false});cur=o2;
      if(kind<=3){const o3=get();run(PG.fx,o3,{uSrc:cur.tex,uR:F.R.tex,uKind:{int:kind},uWrap:{int:doc.wrap?1:0},uEH:v.eH*v.strokes,uEN:v.eN*v.strokes,uEE:v.eE*v.strokes,uER:v.eR*v.strokes,uGl:{int:k==='gloss'?1:0}});cur=o3;}}
    if(kind===0&&v.lighting>0&&v.litPart<1){const o=get();run(PG.look,o,Object.assign(paLookU(v,F,1),{uSrc:cur.tex}));cur=o;}
    run(P.mix,dst,{uA:src.tex,uB:cur.tex,uT:Math.min(1,v.stylization),uM:dummy,uUseM:false});
    for(const t of tmp)release(t);if(F.temp)paDrop({_paF:F});}});

/* ---- settings: master sliders on top (like Painter), each group folds open below ---- */
function paControls(v,upd){for(const k in PA_DEFAULTS)if(v[k]===undefined)v[k]=JSON.parse(JSON.stringify(PA_DEFAULTS[k]));
  const changed=()=>{v.preset='custom';refreshChips();upd();},U=fxUiKit('pa_',v,changed),{S,C,K,SEL,G,setAll}=U;
  const chips=[];const refreshChips=()=>{for(const b of chips)b.classList.toggle('on',b.dataset.pre===v.preset);};
  const presetRow=el('div',{class:'chips'},...Object.keys(PA_PRESETS).map(name=>{const b=el('button',{class:'chip'+(v.preset===name?' on':''),'data-pre':name,id:'pa_pre_'+name.replace(/\W+/g,''),text:name,
    onclick:()=>{Object.assign(v,JSON.parse(JSON.stringify(PA_DEFAULTS)),{seed:v.seed},JSON.parse(JSON.stringify(PA_PRESETS[name])),{preset:name});setAll();refreshChips();upd();}});chips.push(b);return b;}));
  const tp=fxTipPicker('paTips',v,changed);U.after.push(tp.render);
  const blends=[[0,'Normal'],[1,'Multiply'],[2,'Screen'],[3,'Overlay'],[4,'Soft light'],[5,'Add']],deg=x=>Math.round(x)+'°';
  const restore=el('button',{class:'btn sm',id:'pa_restore',text:'Restore defaults',onclick:()=>{Object.assign(v,JSON.parse(JSON.stringify(PA_DEFAULTS)),{preset:'Painterly'});setAll();refreshChips();upd();}});
  const src=(()=>{try{const L=doc.active;return L?hpSources(L):'';}catch(e){return '';}})();
  return [el('div',{class:'sub',text:'Presets'}),presetRow,el('p',{class:'note hpsrc',id:'paSrc',text:src}),
    S('seed','Random seed',1,99,1),S('stylization','Stylization',0,1,.01,pct),S('strokes','Brush strokes',0,1,.01,pct),S('smooth','Smoothness',0,1,.01,pct),
    S('colorize','Colorize',0,1,.01,pct),S('gradient','Gradient',0,1,.01,pct),S('lighting','Baked lighting',0,1,.01,pct),S('edges','Edges and cavities',0,1,.01,pct),
    G('Brush strokes',false,tp.tipName,tp.tipHost,tp.importTip,S('sDens','Strokes amount',.3,3,.05),S('sSize','Strokes scale',4,200,1,px),S('sRand','Scale random',0,1,.01,pct),
      S('sLen','Stroke length (non-uniform size)',1,4,.05),S('sFollow','Strokes follow surface',0,1,.01,pct),S('sRot','Strokes rotation',-180,180,1,deg),S('sRotRand','Rotation random',0,1,.01,pct),
      S('sHard','Projection hardness',0,1,.01,pct),S('sNThr','Normal threshold',0,1,.01,pct),S('sCVar','Colour per stroke',0,1,.01,pct)),
    G('Brush strokes effects',false,S('eH','Height relief',0,2,.01,pct),S('eN','Normal relief',0,2,.01,pct),S('eE','Darker stroke edges',0,1,.01,pct),S('eR','Roughness variation',0,1,.01,pct)),
    G('Smoothness',false,S('smR','Radius',0,30,.5,px),S('smC','Colour',0,1,.01,pct),S('smH','Height',0,1,.01,pct),S('smN','Normal',0,1,.01,pct),
      S('smRo',doc.workflow==='spec'?'Glossiness':'Roughness',0,1,.01,pct),S('smM',doc.workflow==='spec'?'Specular':'Metallic',0,1,.01,pct)),
    G('Colorize',false,S('hue','Hue shift',-180,180,1,deg),S('sat','Saturation',0,2,.01,pct),S('val','Brightness',0,2,.01,pct),S('con','Contrast',0,2,.01,pct),S('post','Flat tones (0 = off)',0,12,1)),
    G('Gradient',false,SEL('gMode','Gradient mode',[[0,'1 colour'],[1,'2 colours']]),C('g1','Colour'),S('gO1','Colour opacity',0,1,.01,pct),SEL('gB1','Colour blending mode',blends),
      C('g2','Colour 2'),S('gO2','Colour 2 opacity',0,1,.01,pct),SEL('gB2','Colour 2 blending mode',blends),S('gH','Horizontal rotation',-180,180,1,deg),S('gV','Vertical rotation',-90,90,1,deg),
      K('gInv','Gradient invert'),S('gOff','Gradient offset',0,1,.01,pct),S('gCon','Gradient contrast',0,1,.01,pct)),
    G('Baked lighting',false,S('litPart','Brush strokes in lighting',0,1,.01,pct),S('dI','Diffuse intensity',0,1,.01,pct),C('dC','Diffuse colour'),S('dR','Diffuse radius',0,1,.01,pct),S('dCon','Diffuse contrast',0,1,.01,pct),
      S('sI','Specular intensity',0,1,.01,pct),C('sC','Specular colour'),S('sR','Specular radius',0,1,.01,pct),S('sCon','Specular contrast',0,1,.01,pct),
      S('lH','Horizontal rotation',-180,180,1,deg),S('lV','Vertical rotation',-90,90,1,deg)),
    G('Edges and cavities',false,C('eC','Edge colour'),S('eO','Edge opacity',0,1,.01,pct),S('eW','Edge width',0,1,.01,pct),C('cC','Cavity colour'),S('cO','Cavity opacity',0,1,.01,pct),S('cW','Cavity width',0,1,.01,pct),S('aoO','Ambient occlusion',0,1,.01,pct)),
    G('Helpers',false,SEL('show','Show',[['result','The result'],['strokes','Strokes only (relief)'],['normal','Normals the layer reads'],['edges','AO, curvature and thin parts']])),
    el('div',{class:'frow'},restore)];}

/* Layer › New › Stylize layer (Painter style): on top of the stack */
function cmdNewStylizePLayer(preset){if(ui.mode==='anim'){toast('Stylize layers are for paint mode.');return;}if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const p=doc.root,i=p.children.length,L=newFxLayerObj('Stylize (Painter style)',[fxItem('stylizeP')],'all');
  if(preset&&PA_PRESETS[preset])Object.assign(L.fx.stack[0].v,JSON.parse(JSON.stringify(PA_PRESETS[preset])),{preset});
  insertNode(L,p,i);selectOnly(L);changedAll();fxEditor(L,{isNew:true,parent:p,index:i});}
