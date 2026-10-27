/* ================= Stylize layer (0.77, Gouache edition) =================
   One layer that repaints everything below it as brush strokes, in every channel at once.
   The strokes are worked out ONCE, from the colour below: a direction field (the existing structure tensor, smoothed) and
   streaks of noise smeared along it (a line-integral convolution). Then each channel (colour, roughness, metallic, height,
   normal, AO...) is smoothed along the SAME strokes (anisotropic Kuwahara), and the streaks give the paint its body:
   bristle lines and colour variation in the colour, ridges in the height, and tilt in the normal (so the strokes catch light).
   L.fx = {map:'all', stack:[{id:'stylizeG', v}]}: a filter layer that acts on every map (see compositeList). */
const SG_FS={
  /* streaks: white noise smeared along the stroke direction. R = fine bristles, G = coarse blotches, B = grain */
  streak:GL_ST+`uniform sampler2D uT; uniform int uLen; uniform float uSeed; uniform int uWrap;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
vec2 dirAt(vec2 pos,ivec2 s){ vec3 t=texelFetch(uT,wrapP(ivec2(floor(pos)),s,uWrap),0).rgb;
  float lam1=0.5*(t.x+t.y+sqrt((t.x-t.y)*(t.x-t.y)+4.0*t.z*t.z)); vec2 d=vec2(lam1-t.x,t.z); return length(d)>1e-6?normalize(d):vec2(1.0,0.0); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uT,0); vec2 c0=vec2(p)+0.5; float fine=0.0,coarse=0.0,wsum=0.0;
  for(int sg=0;sg<2;sg++){ vec2 pos=c0, prev=dirAt(c0,s)*(sg==0?1.0:-1.0);
    for(int i=0;i<=80;i++){ if(i>uLen) break; float w=1.0-float(i)/float(uLen+1);
      fine+=w*h21(floor(pos)+uSeed); coarse+=w*h21(floor(pos/3.0)+uSeed*7.0+17.0); wsum+=w;
      vec2 d=dirAt(pos,s); if(dot(d,prev)<0.0) d=-d; pos+=d; prev=d; } }
  fine/=wsum; coarse/=wsum; fine=clamp(0.5+(fine-0.5)*3.0,0.0,1.0); coarse=clamp(0.5+(coarse-0.5)*3.0,0.0,1.0);
  o=vec4(fine,coarse,h21(vec2(p)+uSeed*3.1+91.0),1.0); }`,
  /* the paint itself, per channel kind: 0 colour, 1 roughness/gloss, 2 height, 3 normal, 4 anything else (only smoothed) */
  post:GL_ST+`uniform sampler2D uSrc; uniform sampler2D uOrig; uniform sampler2D uS; uniform int uKind; uniform int uWrap;
uniform float uBristle; uniform float uCVar; uniform float uRelief; uniform float uBend; uniform float uGrain; uniform float uAmt;
float Rf(ivec2 q,ivec2 s){ return texelFetch(uS,wrapP(q,s,uWrap),0).r; }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec4 c=texelFetch(uSrc,p,0), c0=texelFetch(uOrig,p,0);
  vec3 S=texelFetch(uS,p,0).rgb; float r=S.r-0.5, r2=S.g-0.5, g=S.b-0.5;
  float rx=Rf(p+ivec2(1,0),s)-Rf(p-ivec2(1,0),s), ry=Rf(p+ivec2(0,1),s)-Rf(p-ivec2(0,1),s);
  vec4 res=c;
  if(uKind==0){ vec3 col=st(c); float shade=(rx*-0.6+ry*0.8)*uRelief*2.5+r*uBristle*0.7+g*uGrain*0.5; col=col*(1.0+r2*uCVar*1.4+shade); res=vec4(clamp(col,0.0,1.0)*c.a,c.a); }
  else if(uKind==1){ vec3 v=st(c)+vec3((r2*uCVar+g*uGrain*0.4)*0.25); res=vec4(clamp(v,0.0,1.0)*c.a,c.a); }
  else if(uKind==2){ vec3 v=st(c)+vec3((r*0.5+g*uGrain*0.5)*uRelief*0.08); res=vec4(v*c.a,c.a); }
  else if(uKind==3){ vec3 n=st(c)*2.0-1.0; n=length(n)>1e-4?normalize(n):vec3(0.0,0.0,1.0); n.xy-=vec2(rx,ry)*uBend*3.0+vec2(g)*uGrain*0.05; n=normalize(n); res=vec4((n*0.5+0.5)*c.a,c.a); }
  o=mix(c0,res,uAmt); }`};
for(const k in SG_FS){P['sg_'+k]=program(SG_FS[k]);}
P.sg_streak.tiled=true;/* drawn in tiles, like the other heavy filters */

/* starting points: every slider the layer has, so a preset is just a set of values */
const SG_PRESETS={
  'Gouache':   {size:5,flow:3,sharp:8,len:12,bristle:.3,cvar:.2,relief:.5,bend:.6,grain:.15},
  'Oil':       {size:4,flow:2,sharp:10,len:16,bristle:.5,cvar:.2,relief:.7,bend:.9,grain:.05},
  'Thick paint':{size:8,flow:4,sharp:6,len:20,bristle:.65,cvar:.25,relief:1.2,bend:1.4,grain:.05},
  'Soft wash': {size:9,flow:6,sharp:3,len:8,bristle:.05,cvar:.25,relief:.05,bend:.1,grain:.35},
  'Watercolour':{size:8,flow:6,sharp:2,len:6,bristle:0,cvar:.35,relief:.03,bend:.05,grain:.6},
  'Comic':     {size:3,flow:1.5,sharp:14,len:6,bristle:.1,cvar:0,relief:.15,bend:.2,grain:0},
  'Pastel':    {size:3,flow:2,sharp:5,len:8,bristle:.5,cvar:.3,relief:.2,bend:.3,grain:.6},
  'Chalk':     {size:2.5,flow:1.5,sharp:4,len:6,bristle:.7,cvar:.2,relief:.3,bend:.4,grain:.8},
  'Charcoal':  {size:3,flow:2,sharp:5,len:14,bristle:.8,cvar:0,relief:.25,bend:.3,grain:.7}};
const SG_KIND={base:0,rough:1,gloss:1,height:2,normal:3};

/* the stroke field of one layer: kept until the picture below, or a setting that shapes the strokes, changes */
function sgDrop(n){const f=n&&n._sgF;if(f){disposeTarget(f.T);disposeTarget(f.S);n._sgF=null;}}
function sgField(n,src,v,k){
  const key=[typeof msDocVer==='number'?msDocVer:0,n?n.lookVer||0:0,doc.w,doc.h,!!doc.wrap,v.flow,v.len,v.seed||1].join('|');
  const f=n&&n._sgF;if(f&&(f.key===key||stroke))return f;
  if(n)sgDrop(n);
  /* the colour below this layer is what the strokes follow */
  let base=src,own=null;
  if(k!=='base'&&n&&n.parent){const p=n.parent,i=p.children.indexOf(n);if(i>0){own=renderNodesMap(p.children.slice(0,i),'base');base=own;}}
  const d16=canFloat?16:doc.depth,t1=acquireD(d16),t2=acquireD(d16);
  run(P.f_tensor,t1,{uSrc:base.tex,uWrap:!!doc.wrap});
  if(v.flow>.25)gaussian(t1,t2,v.flow);else blit(t1,t2,0,0,doc.w,doc.h,0,0);
  const T=makeTarget(doc.w,doc.h,d16,false),S=makeTarget(doc.w,doc.h,d16,false);
  blit(t2,T,0,0,doc.w,doc.h,0,0);release(t1);release(t2);if(own)release(own);
  run(P.sg_streak,S,{uT:T.tex,uLen:Math.round(v.len||12),uSeed:v.seed||1,uWrap:!!doc.wrap});
  const F={key,T,S,temp:!n};if(n)n._sgF=F;return F;}

fxDef('stylizeG',{title:'Stylize (Gouache)',heavy:true,onlyLayer:true,
  note:'Repaints everything below as brush strokes, in every channel at once: colour, roughness, metallic, height and normal share the same strokes, so the paint catches light.',
  init:()=>Object.assign({seed:1,preset:'Gouache',amount:1,sMat:true,sHgt:true},SG_PRESETS['Gouache']),
  checks:[['sMat','Even out roughness and metallic along the strokes',true],['sHgt','Smooth height and normal along the strokes',true]],
  controls:(v,upd)=>{const sl={},refresh=()=>{for(const b of chipRow.querySelectorAll('[data-pre]'))b.classList.toggle('on',b.dataset.pre===v.preset);};
    const mk=(key,label,min,max,step,fmt)=>{const s=makeSlider({id:'sg_'+key,label,min,max,step,value:v[key],fmt,onInput:x=>{v[key]=x;v.preset='custom';refresh();upd();}});sl[key]=s;return s.el;};
    const chipRow=el('div',{class:'chips'},...Object.keys(SG_PRESETS).map(name=>el('button',{class:'chip'+(v.preset===name?' on':''),'data-pre':name,id:'sg_pre_'+name.replace(/\W+/g,''),text:name,onclick:()=>{v.preset=name;Object.assign(v,SG_PRESETS[name]);for(const k in SG_PRESETS[name])if(sl[k])sl[k].set(SG_PRESETS[name][k]);refresh();upd();}})));
    return [el('div',{class:'sub',text:'Style'}),chipRow,
      el('div',{class:'sub',text:'Strokes'}),mk('size','Stroke size',1,10,.5,px),mk('flow','Stroke flow',0,10,.5,px),mk('sharp','Edge keeping',2,16,1),mk('len','Stroke length',4,40,1,px),
      el('div',{class:'sub',text:'Paint'}),mk('bristle','Bristles',0,1,.01,pct),mk('cvar','Colour variation',0,1,.01,pct),mk('grain','Canvas grain',0,1,.01,pct),
      el('div',{class:'sub',text:'Relief (height and normal)'}),mk('relief','Paint relief',0,2,.01,pct),mk('bend','Normal bend',0,2,.01,pct),
      el('div',{class:'sub',text:'Overall'}),makeSlider({id:'sg_amount',label:'Amount',min:0,max:1,step:.01,value:v.amount,fmt:pct,onInput:x=>{v.amount=x;upd();}}).el,
      makeSlider({id:'sg_seed',label:'Random seed',min:1,max:99,step:1,value:v.seed||1,onInput:x=>{v.seed=x;upd();}}).el];},
  render(src,dst,v,ctx){const k=ctx&&ctx.k||'base',n=ctx&&ctx.layer,F=sgField(n,src,v,k),kind=SG_KIND[k]??4,
      smooth=kind===0||((kind===2||kind===3)?v.sHgt:v.sMat);let sm=src,a=null;
    if(smooth&&v.size>.5){a=acquire();run(P.f_akuwa,a,{uSrc:src.tex,uT:F.T.tex,uR:v.size,uQ:v.sharp,uWrap:!!doc.wrap});sm=a;}
    run(P.sg_post,dst,{uSrc:sm.tex,uOrig:src.tex,uS:F.S.tex,uKind:{int:kind},uBristle:v.bristle,uCVar:v.cvar,uRelief:v.relief,uBend:v.bend,uGrain:v.grain,uAmt:v.amount,uWrap:!!doc.wrap});
    if(a)release(a);if(F.temp){disposeTarget(F.T);disposeTarget(F.S);}}});

/* Layer › New › Stylize layer: on top of the stack, so it changes everything below, in every map */
function cmdNewStylizeLayer(preset){if(ui.mode==='anim'){toast('Stylize layers are for paint mode.');return;}if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const p=doc.root,i=p.children.length,L=newFxLayerObj('Stylize',[fxItem('stylizeG')],'all');
  if(preset&&SG_PRESETS[preset])Object.assign(L.fx.stack[0].v,SG_PRESETS[preset],{preset});
  insertNode(L,p,i);selectOnly(L);changedAll();fxEditor(L,{isNew:true,parent:p,index:i});}
