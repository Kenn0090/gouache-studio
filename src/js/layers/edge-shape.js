/* ================= Edge controls for the edge presets (0.97.24, Kenn: "Edge wear doesn't have enough controls for edges") =================
   Edge wear, Chipped paint, Scratches and Sun-bleached read the curvature's convex side as "the edges". Before they do, the
   curvature is reshaped here: Sharp edges only (a minimum), Corners (where edges meet wear more), Edge strength, Edge sharpness
   (crisp line or soft fade), Cavity protection (no wear in creases, from AO), then Edge growth (spread outward) and Edge
   distortion (the band wobbles, World projection on a model). With everything at its default nothing is changed. */
const EDGE_GENS=['edge','chips','scratch','bleach'];
const EDGE_DEF={edgeStrength:1,edgeGrow:0,edgeSharp:0,edgeMin:0,edgeCorner:0,cavityProtection:0,edgeDist:0,edgeDistortScale:9};
const FS_MSEDGESHAPE=`uniform sampler2D uC; uniform sampler2D uB; uniform int uHasB; uniform sampler2D uAO; uniform int uHasAO; uniform vec4 uP; uniform float uGuard; uniform vec2 uSz; uniform int uPass;
float edgeOf(vec2 uv){ float c=texture(uC,uv).r; float e=clamp((c-0.5)*2.0,0.0,1.0); return clamp((e-uP.z)/max(1e-3,1.0-uP.z),0.0,1.0); }
void main(){ vec2 uv=gl_FragCoord.xy/uSz;
  if(uPass==0){ o=vec4(vec3(edgeOf(uv)),1.0); return; }
  float c=texture(uC,uv).r; if(c<=0.5){ o=vec4(vec3(c),1.0); return; }
  float e=edgeOf(uv);
  if(uHasB==1) e=clamp(e*(1.0+uP.w*4.0*max(0.0,texture(uB,uv).r-0.3)),0.0,1.0);
  e=clamp(e*uP.x,0.0,1.0);
  if(uP.y>0.0){ float lo=0.45*uP.y,hi=max(lo+0.02,1.0-0.45*uP.y); e=smoothstep(lo,hi,e); }
  if(uHasAO==1) e*=mix(1.0,smoothstep(0.1,0.9,texture(uAO,uv).r),uGuard);
  o=vec4(vec3(0.5+e*0.5),1.0); }`;
let P_EDGESHAPE=null;
const edgeShapeOn=p=>EDGE_GENS.includes(p.g)&&Object.keys(EDGE_DEF).some(k=>p[k]!=null&&p[k]!==EDGE_DEF[k]);
/* curv: the curvature the generator would read; returns it reshaped (a temp kept in ctx.tmp) or unchanged */
function msEdgeShape(curv,p,ctx,r){if(!curv||!edgeShapeOn(p))return curv;if(!P_EDGESHAPE)P_EDGESHAPE=program(FS_MSEDGESHAPE);
  const v=k=>p[k]??EDGE_DEF[k],ao=v('cavityProtection')>0&&(msMeshTex('ao')||msMeshTex('cv:ao')||msDocMap('ao',ctx)),sz=[doc.w,doc.h];
  const U={uC:curv.tex,uP:[v('edgeStrength'),v('edgeSharp'),Math.min(.95,v('edgeMin')),v('edgeCorner')],uGuard:v('cavityProtection'),uAO:ao?ao.tex:dummy,uHasAO:{int:ao?1:0},uSz:sz,uB:dummy,uHasB:{int:0}};
  let blur=null;
  if(v('edgeCorner')>0){/* where edges crowd together (corners), the spread-out edge amount is higher */
    const e=acquireD(16);blur=acquireD(16);run(P_EDGESHAPE,e,Object.assign({},U,{uPass:{int:0}}));gaussian(e,blur,Math.max(2,.012*Math.max(doc.w,doc.h)));release(e);U.uB=blur.tex;U.uHasB={int:1};}
  let out=acquireD(16);run(P_EDGESHAPE,out,Object.assign({},U,{uPass:{int:1}}));if(blur)release(blur);ctx.tmp.push(out);
  const grow=Math.max(0,Math.min(1,v('edgeGrow')))*.045,dist=Math.max(0,v('edgeDist')),wrap=p.uvWrap!==false;
  if((dist>0||grow>0)&&ui.mode==='p3d'&&r&&pxfRowMode(r)==='world'){const w=msWarpEdgeMap(out,ctx,dist,Math.max(.5,v('edgeDistortScale')),p.seed||1,grow,.5);if(w)return w;}
  if(grow>0)out=msGrowEdgeMap(out,ctx,grow,.5,wrap)||out;
  return out;}
/* the sliders, added to the generator editor (they land in the Edges card) */
function edgeShapeSliders(L,r){const p=r.p,S=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:p[key]??EDGE_DEF[key],fmt,onInput:x=>msEdit(L,r,q=>{q.p[key]=x;})}).el;
  const pct=x=>Math.round(x*100)+'%';
  return [S('ms_edgeStrength','Edge strength','edgeStrength',0,2,.01,pct),S('ms_edgeGrow','Edge growth','edgeGrow',0,1,.01,pct),
    S('ms_edgeSharp','Edge sharpness','edgeSharp',0,1,.01,pct),S('ms_edgeMin','Sharp edges only','edgeMin',0,.9,.01,x=>x<.005?'all edges':pct(x)),
    S('ms_edgeCorner','Corners wear more','edgeCorner',0,1,.01,pct),S('ms_cavityProtection','Cavity protection','cavityProtection',0,1,.01,pct),
    S('ms_edgeDist','Edge distortion','edgeDist',0,1,.01,pct),S('ms_edgeDistortScale','Edge distortion scale','edgeDistortScale',1,32,.5,x=>String(x))];}
