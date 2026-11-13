/* Procedural welds use an oriented brush tip for freehand painting, or a continuous
   material profile evaluated along an editable world-space path. */
// Keep the retired style IDs and their shader indices for saved weld paths.
const RETIRED_WELD_STYLES=[
  {id:'tig',name:'TIG · even',detail:'Clean overlapping ripples',size:18,spacing:.30,rough:.30,color:[.58,.60,.62],height:.62,irregularity:.08,heat:.12,ripple:.64,crown:1.05},
  {id:'mig',name:'MIG · heavy',detail:'Heavy bead with spatter',size:30,spacing:.42,rough:.43,color:[.48,.50,.52],height:.77,irregularity:.35,heat:.14,ripple:.47,crown:.72,spatter:.52,pitting:.28},
  {id:'walking',name:'Walking the cup',detail:'Wide, rounded bars with a side-to-side weave',size:25,spacing:.24,rough:.43,color:[.44,.45,.46],height:.66,irregularity:.34,heat:.28,ripple:.82,crown:.69},
  {id:'convex',name:'Convex',detail:'Full crowned bead',size:26,spacing:.29,rough:.32,color:[.60,.62,.64],height:.86,irregularity:.12,heat:.10,ripple:.50,crown:.57},
  {id:'concave',name:'Concave',detail:'Shallow bead with raised toes',size:22,spacing:.32,rough:.36,color:[.53,.56,.59],height:.42,irregularity:.14,heat:.08,ripple:.46,crown:1.25},
  {id:'angular',name:'Angular',detail:'Chevron-shaped ripples',size:24,spacing:.40,rough:.40,color:[.55,.57,.60],height:.70,irregularity:.24,heat:.12,ripple:.90,crown:1.35},
  {id:'double',name:'Double weld',detail:'Twin rails with shallow ribs between them',size:30,spacing:.17,rough:.38,color:[.54,.54,.53],height:.73,irregularity:.10,heat:.22,ripple:.82,crown:.92,taper:.12},
  {id:'tack',name:'Tack weld',detail:'Short interrupted beads',size:25,spacing:.55,rough:.42,color:[.65,.58,.48],height:.68,irregularity:.30,heat:.14,ripple:.75,crown:.75}
];
const WELD_PRESETS=[
  {id:'standard',name:'Standard weld',detail:'Fused, rounded puddles with a soft edge',size:21,spacing:.32,rough:.39,color:[.50,.47,.42],height:.62,irregularity:.40,heat:.29,ripple:.73,crown:.95,sharpness:.78,burn:.17,fusion:.86,edgeBlend:.80},
  {id:'narrow',name:'Narrow weld',detail:'A thin seam with long, uneven swells',size:13,spacing:.67,rough:.45,color:[.39,.39,.40],height:.68,irregularity:.57,heat:.26,ripple:.45,crown:1.18,sharpness:.71,burn:.22},
  {id:'sharp',name:'Sharp weld',detail:'Fine, closely spaced crests',size:16,spacing:.21,rough:.34,color:[.49,.50,.52],height:.67,irregularity:.29,heat:.17,ripple:.92,crown:.95,sharpness:.96}
];
const WELD_STYLES=[...RETIRED_WELD_STYLES,...WELD_PRESETS];
const WELD_SHOP_STYLES=new Set(['standard','walking','narrow','double','sharp']);
const weldStyle=id=>WELD_STYLES.find(s=>s.id===id)||WELD_PRESETS[0];
const weldIsPreset=id=>WELD_PRESETS.some(s=>s.id===id);
function weldDefaults(style){
  return {profile:1,style:style.id,width:style.size,height:style.height,spacing:style.spacing,
    irregularity:style.irregularity,heat:style.heat,ripple:style.ripple,spatter:style.spatter||0,pitting:style.pitting||0,taper:style.taper??.58,
    roughness:style.rough,sharpness:style.sharpness??.72,smoothness:0,surface:'metal',
    haloSpread:.44,burn:style.burn??.12,edgeBlend:style.edgeBlend??.42,pressureHalo:true,
    fusion:style.fusion??(style.id==='tack'?0:style.id==='tig'?.32:.68),seed:1};
}
function weldPathSettings(recipe){
  return {...weldDefaults(weldStyle(recipe.style)),fusion:0,edgeBlend:0,...recipe};
}
const weldOptions=weldDefaults(WELD_PRESETS[0]);
let weldPathArmed=false,weldBusy=false;
const weldTips=new Map();
const weldSmooth=(lo,hi,x)=>{const t=clamp((x-lo)/(hi-lo),0,1);return t*t*(3-2*t);};

/* An asymmetric weld puddle and trailing lip, in local brush coordinates.
   The paint engine rotates this tip with the stroke and uses its alpha as height coverage. */
function weldDab(x,y,style,v){
  const k=WELD_STYLES.indexOf(style);
  const standard=k===8,narrow=k===9,sharp=k===10;
  const texture=1-v.smoothness;
  if(k===2)y-=.13*texture*Math.sin((x+.25)*3.2);
  if(standard||narrow||sharp)y-=texture*v.irregularity*(.16*Math.sin(x*4.2+v.seed)+.07*Math.sin(x*8.7));
  const side=Math.abs(y);
  let arc=k===5?.58*side:k===2?.24*y*y+.11*y:k===6?.02*side:narrow?.19*y*y:.69*y*y;
  if(standard)arc*=.78;
  if(standard||sharp)arc+=texture*v.irregularity*(.18*y+.15*Math.sin(y*7.4)*side);
  const along=x+arc;
  const width=side;
  const lip=(narrow?.06+v.ripple*.14:.14+v.ripple*.24)*texture;
  const body=Math.pow(Math.max(0,1-width*width),style.crown);
  const crisp=v.sharpness;
  const puddle=1-weldSmooth((k===0?.64:.73)+crisp*.15,1,Math.hypot(along*(k===7?1.85:narrow?1.09:1.38),width));
  const atLip=(along+.34)/(.17+(k===1?.075:k===2?.031:0)-crisp*.094);
  const ridge=Math.exp(-atLip*atLip);
  const lipShadow=texture*crisp*.075*Math.exp(-Math.pow((along+.46)/.058,2));
  const toes=k===4?.28*Math.exp(-Math.pow((width-.63)/.20,2)):0;
  const melt=(narrow?.78:.63)+.12*Math.cos(5.0*along+v.seed)*v.irregularity;
  let pore=0;
  if(v.pitting>0&&side<.76&&texture>0){
    const px=x*7,py=y*7,cx=Math.floor(px),cy=Math.floor(py);
    const hash=Math.sin(cx*127.1+cy*311.7+v.seed*74.7)*43758.5453;
    const random=hash-Math.floor(hash);
    if(random>.77){
      const distance=Math.hypot(px-cx-.5,py-cy-.34-(random-.77));
      pore=v.pitting*.13*(1-weldSmooth(.05,.23,distance))*(1-weldSmooth(.50,.76,side));
    }
  }
  const specks=v.spatter*.46*texture*(1-weldSmooth(.035,.095,Math.min(Math.hypot(x+.48,y-.91),Math.hypot(x-.42,y+.83))));
  const smoothBead=(1-weldSmooth(.78,1,Math.hypot(x*1.5,y)))*body*.72;
  let shaped=puddle*(body*(melt+lip*ridge-lipShadow-pore)+toes);
  if(k===6){
    const rails=.84*Math.exp(-Math.pow((width-.77)/.095,2));
    const web=(1-weldSmooth(.65,.80,width))*(.27+lip*ridge*.51);
    shaped=(1-weldSmooth(.59,.98,Math.abs(x)))*(rails+web);
  }else if(standard||sharp){
    const shoulder=Math.exp(-Math.pow((along+.23)/.058,2));
    const lipEnvelope=Math.exp(-Math.pow((along+.29)/.16,2));
    const flow=Math.sin(along*(sharp?60:43)+.82*Math.sin(y*9.5)+.35*Math.sin(y*19));
    shaped+=puddle*body*texture*crisp*(.046*flow*lipEnvelope+.084*shoulder);
  }else if(narrow){
    const seam=1-weldSmooth(.78,1,Math.abs(x));
    const swell=.07+.05*Math.cos(x*6.2+y*3.1+v.seed);
    shaped=seam*body*(.71+texture*(swell+lip*ridge*.36-pore));
  }
  let relief=k===6?shaped:shaped*texture+smoothBead*v.smoothness;
  if(v.fusion>0&&k!==7){
    // The longer, rounded bed bridges adjacent dabs. Keep the trailing lip above it.
    const bedWidth=Math.max(0,1-y*y);
    const bed=(1-weldSmooth(.44,.98,Math.abs(x)))*Math.pow(bedWidth,style.crown+.16);
    const beadBed=k===6?bed*.23:bed*(.62+.045*Math.cos(x*4.6));
    relief+=Math.max(0,beadBed-relief)*v.fusion;
  }
  if(standard){
    const support=(1-weldSmooth(.55,.98,Math.abs(x)))*body;
    const crest=puddle*body*texture*lip*ridge;
    relief+=(support*(.62+v.irregularity*.07*Math.sin(x*4.1+y*2.8))+
      crest*(1-weldSmooth(.43,.97,side))*.70-relief)*v.fusion;
  }
  // The shared freehand mask fades all painted channels at the side of the bead.
  relief*=1-v.edgeBlend*weldSmooth(k===6?.80:.56,1,side);
  return clamp(relief+specks,0,1);
}

function weldTipGet(style=weldStyle(weldOptions.style),v=weldOptions){
  const key=[style.id,v.ripple,v.irregularity,v.spatter,v.pitting,v.sharpness,v.smoothness,v.fusion,v.edgeBlend,v.seed].join(':');
  if(weldTips.has(key))return weldTips.get(key);
  const size=160;
  const options={...v};
  const tip=makeTip('Weld tip · '+style.name,size,size,null,false,()=>{
    const alpha=new Uint8Array(size*size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      alpha[y*size+x]=Math.round(255*weldDab((x+.5)/size*2-1,(y+.5)/size*2-1,style,options));
    }
    return alpha;
  });
  weldTips.set(key,tip);
  if(weldTips.size>24)weldTips.delete(weldTips.keys().next().value);
  return tip;
}

function weldBrushDynamics(style,v){
  return {tip:weldTipGet(style,v),size:v.width,spacing:v.spacing,angleJitter:v.irregularity*.085,
    sizeJitter:v.irregularity*.17,scatter:v.irregularity*.06};
}

function weldBrushPreset(style,v,tool){
  return {name:'Weld · '+style.name,tool,ownTool:true,...weldBrushDynamics(style,v),hardness:.92,
    flow:1,opacity:1,pSize:true,minSize:.55,pOpacity:false,smoothing:.20,followDir:true,buildup:false};
}

const weldPaintPresets=WELD_PRESETS.map(style=>weldBrushPreset(style,weldDefaults(style),'brush'));
library.push({id:'welds',name:'Welds',builtin:true,presets:weldPaintPresets,tips:[]});

function weldMaterial(style,v,legacy=false){
  const warm=v.heat*(legacy?1:.38);
  const base=style.color.map((c,i)=>clamp(c+(i===0?warm*.35:i===1?warm*.12:0),0,1));
  const rough=v.roughness??style.rough;
  const spec=!legacy&&doc.workflow==='spec';
  const painted=!legacy&&v.surface==='paint';
  const key=[style.id,v.height,v.heat,rough,painted?'paint':spec?'spec':'metal'].join(':');
  const maps={height:{on:true,src:'value',v:.5+v.height*.5}};
  if(!painted)maps.base={on:true,src:'value',c:spec?[0,0,0]:base};
  if(!painted&&spec){
    maps.spec={on:true,src:'value',c:base};
    maps.gloss={on:true,src:'value',v:1-rough};
  }else if(!painted){
    maps.rough={on:true,src:'value',v:rough};
    maps.metal={on:true,src:'value',v:1};
  }
  const heatHalo=!legacy&&!painted&&v.heat>0&&weldIsPreset(style.id)
    ?{heat:v.heat,spread:v.haloSpread,pressure:v.pressureHalo,name:style.name}:null;
  return {weldPaint:true,heatHalo,id:'weld:'+key,name:'Weld · '+style.name,fill:{proj:'uv',triSharp:4,hStr:1,maps}};
}

// The freehand halo stores heat separately from the shared bead mask.
let P_WELD_HEAT_DAB=null,P_WELD_HEAT_MERGE=null;
const FS_WELD_HEAT_DAB=`
uniform vec2 uCenter;
uniform float uRadius, uAngle, uRound, uSpread, uPressure, uStrength;
void main(){
  vec2 p=(gl_FragCoord.xy-uCenter)/uRadius;
  float c=cos(uAngle),s=sin(uAngle);
  vec2 q=vec2(c*p.x+s*p.y,(-s*p.x+c*p.y)/max(uRound,.02));
  float d=length(vec2(q.x*.82,q.y));
  float edge=.83;
  float width=uSpread*mix(.30,1.20,uPressure);
  float band=clamp((d-edge)/width,0.0,1.0);
  float coverage=(1.0-smoothstep(.13,1.0,band))*uStrength*mix(.66,1.0,uPressure);
  float heat=mix(.22,1.0,smoothstep(.12,.93,uPressure))*(1.0-.80*band);
  o=vec4(heat*coverage,0.0,0.0,coverage);
}`;
const WELD_HEAT_COLOR=`
vec3 weldHeatColor(float h){
  vec3 straw=vec3(.78,.55,.24),bronze=vec3(.64,.32,.19);
  vec3 violet=vec3(.49,.21,.57),blue=vec3(.21,.41,.79);
  vec3 color=mix(straw,bronze,smoothstep(.23,.46,h));
  color=mix(color,violet,smoothstep(.37,.70,h));
  return mix(color,blue,smoothstep(.64,.96,h));
}`;

function weldHeatBegin(s){
  const settings=s.o.weldHeat,weld=s.L.maskOf;
  if(!settings||s.o.tool!=='brush'||!weld?.mask?.enabled||s.L.mrow||(s.space&&!s.space.mesh))return;
  const parent=weld.parent,index=parent.children.indexOf(weld);
  const id='weld-halo:'+weld.materialPaint;
  let layer=parent.children[index-1];
  const fresh=layer?.materialPaint!==id;
  if(fresh){
    layer=newLayerObj('Heat halo · '+settings.name,true);
    layer.materialPaint=id;
    insertNode(layer,parent,index);
  }else if(!layer.visible||layer.lockAll||layer.lockPx||layer.lockAlpha)return;
  ensureMapTarget(layer,'base');
  const uv=acquireD(8);
  if(doc.wrap)clearTarget(uv);
  else if(!s.space&&s.clearBox){
    const [x,y,x1,y1]=s.clearBox;
    scissorDo([x,y,x1-x,y1-y],()=>clearTarget(uv));
  }
  const screen=s.space?.mesh?makeTarget(s.SW,s.SH,8,false):null;
  s.weldHeat={layer,parent,index,fresh,uv,screen,settings};
}

function weldHeatDab(heat,uniforms,pressure,alpha){
  if(!P_WELD_HEAT_DAB)P_WELD_HEAT_DAB=program(FS_WELD_HEAT_DAB,VS_STAMP);
  const h=heat.settings;
  run(P_WELD_HEAT_DAB,heat.screen||heat.uv,{...uniforms,uPressure:h.pressure?pressure:1,
    uSpread:.22+.94*h.spread,uStrength:h.heat*alpha},{blend:'max'});
}

function weldHeatClear(heat,rect){
  if(!heat.screen&&!doc.wrap)scissorDo(rect,()=>clearTarget(heat.uv));
}

function weldHeatMerge(s,dst,source,origin){
  if(!P_WELD_HEAT_MERGE)P_WELD_HEAT_MERGE=program(WELD_HEAT_COLOR+`
uniform sampler2D uSrc, uHeat;
uniform ivec2 uSrcOrigin;
uniform vec4 uHeatBounds;
uniform sampler2D uSelTex;
uniform bool uUseSel;
uniform float uOpacity;
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec4 base=texelFetch(uSrc,p-uSrcOrigin,0);
  vec2 q=vec2(p);
  if(any(lessThan(q,uHeatBounds.xy))||any(greaterThanEqual(q,uHeatBounds.zw))){o=base;return;}
  vec4 heat=texelFetch(uHeat,p,0);
  float a=heat.a*uOpacity;
  if(uUseSel)a*=texelFetch(uSelTex,p,0).r;
  o=vec4(weldHeatColor(heat.r/max(heat.a,1e-5))*a,a)+base*(1.0-a);
}`);
  const full=[0,0,doc.w,doc.h],empty=[0,0,0,0];
  const bounds=doc.wrap?full:s.space?(s.syncR||(s.weldHeat.projected?full:empty)):(s.clearBox||empty);
  run(P_WELD_HEAT_MERGE,dst,{uSrc:source.tex,uSrcOrigin:{iv2:origin},uHeat:s.weldHeat.uv.tex,
    uHeatBounds:bounds,uOpacity:s.o.opacity,...selU(s.o)});
}

function weldHeatRelease(s){
  if(!s?.weldHeat)return;
  release(s.weldHeat.uv);
  disposeTarget(s.weldHeat.screen);
}

function weldHeatFinish(s,R,record){
  const h=s.weldHeat;
  if(!h)return null;
  try{
    const [x,y,w,height]=R;
    if(w<=0||height<=0){
      if(h.fresh){detachNode(h.layer);disposeLayer(h.layer);}
      return null;
    }
    const target=mapT(h.layer,'base'),old=makeTarget(w,height,target.depth,false);
    try{
      blit(target,old,x,y,w,height,0,0);
      const before=record&&!h.fresh?captureRegion(old,0,0,w,height):null;
      scissorDo(R,()=>weldHeatMerge(s,target,old,[x,y]));
      scheduleThumb(h.layer);
      if(h.fresh)renderLayers();
      if(!record)return null;
      if(h.fresh)return {layer:h.layer,snaps:[],undo:()=>detachNode(h.layer),
        redo:()=>insertNode(h.layer,h.parent,h.index)};
      const after=captureRegion(target,x,y,w,height);
      return {layer:h.layer,snaps:[before,after],undo:()=>restoreRegion(before,mapT(h.layer,'base'),x,y),
        redo:()=>restoreRegion(after,mapT(h.layer,'base'),x,y)};
    }finally{disposeTarget(old);}
  }finally{weldHeatRelease(s);}
}

/* For a new path, RGBA stores coverage, signed relief, heat and surface variation.
   Keeping phase in model-space distance keeps both sides of a UV split aligned. */
const FS_WELDPATH=`
in vec3 vP;
in vec3 vN;
uniform vec3 uA, uB, uNA, uNB;
uniform vec2 uRadius, uRun, uEnd;
uniform vec4 uProfile;
uniform vec4 uFinish;
uniform float uDepth, uTotal, uNominal, uCycleCount, uSharpness, uSmoothness, uHaloSpread, uPitting, uFusion, uEdgeBlend;
uniform int uStyle;

float weldHash(vec2 p){
  vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)+uFinish.w*.051);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}

float weldVariation(float position,float period,float seed){
  float first=floor(position);
  float next=first+1.0;
  if(period>0.0){
    first=mod(first,period);
    next=mod(next,period);
  }
  return mix(weldHash(vec2(first,seed)),weldHash(vec2(next,seed)),smoothstep(0.0,1.0,fract(position)))-.5;
}

void main(){
  vec3 segment=uB-uA;
  float len=length(segment);
  if(len<1e-6)discard;
  float along=dot(vP-uA,segment)/len;
  float t=clamp(along/len,0.0,1.0);
  vec3 n=normalize(mix(uNA,uNB,t));
  vec3 q=vP-mix(uA,uB,t);
  float r=max(mix(uRadius.x,uRadius.y,t),1e-6);
  float depth=abs(dot(q,n));
  if(depth>uDepth||dot(normalize(vN),n)<-.02)discard;
  vec3 transverse=cross(n,segment/len);
  if(dot(transverse,transverse)<1e-6)discard;
  vec3 across=normalize(transverse);
  float y=dot(q,across)/r;
  float s=mix(uRun.x,uRun.y,t);
  float lengthOutside=(along-clamp(along,0.0,len))/r;
  if((along<0.0&&uEnd.x<.5)||(along>len&&uEnd.y<.5)){
    if(abs(lengthOutside)>.14)discard;
  }
  float aa=clamp(fwidth(y)*.52,.015,.34);
  float taperRange=max(.02,uFinish.z)*uNominal*2.5;
  float endDistance=min(s,uTotal-s);
  float tapered=uTotal<0.0?1.0:smoothstep(0.0,taperRange,endDistance);
  float width=mix(1.0-uFinish.z*.55,1.0,tapered);
  float phase=(s+lengthOutside*r)/max(uProfile.x,1e-6);
  float travel=uCycleCount>0.0?phase/uCycleCount*6.2831853:phase;
  float texture=1.0-uSmoothness;
  bool walking=uStyle==2, doubleWeld=uStyle==6;
  bool standard=uStyle==8, narrow=uStyle==9, sharp=uStyle==10;
  bool shop=standard||walking||narrow||doubleWeld||sharp;
  float fusion=uStyle==7?0.0:uFusion;
  float beadWander=sin(travel*(uCycleCount>0.0?5.0:.49)+uFinish.w)*
    cos(travel*(uCycleCount>0.0?7.0:.81)+uFinish.w*.67);
  float longSwells=sin(travel*(uCycleCount>0.0?6.0:1.31)+uFinish.w);
  if(standard||narrow){
    float swellCount=uCycleCount>0.0?max(1.0,round(uCycleCount*.43)):0.0;
    float swellPhase=uCycleCount>0.0?phase*swellCount/uCycleCount:phase*.43;
    longSwells=2.0*weldVariation(swellPhase,swellCount,73.0);
  }
  float widthVariation=narrow?.23*longSwells+.21*beadWander:(standard?.39:.33)*beadWander;
  if(shop)widthVariation+=.39*weldVariation(phase,uCycleCount,47.0);
  width*=1.0+texture*uProfile.z*widthVariation;
  float roughShift=texture*uProfile.z*(narrow||standard?.16:.065)*sin(travel*(uCycleCount>0.0?3.0:1.71)+uFinish.w);
  float weave=walking?texture*.14*sin(travel*(uCycleCount>0.0?4.0:.68)):0.0;
  y=(y-roughShift-weave)/max(width,.3);
  float side=abs(y);
  float rawCross=side;
  float edgeArc=1.55*rawCross*rawCross;
  if(uStyle==5)edgeArc=1.10*rawCross;
  if(walking)edgeArc=.46*y*y+.17*y*cos(travel*(uCycleCount>0.0?4.0:.68));
  if(doubleWeld)edgeArc=.018*y*y;
  if(narrow)edgeArc=.62*y*y;
  if(standard||sharp)edgeArc=(standard?1.20:1.37)*y*y;
  // Limit the sweep in model space so moving ripples apart keeps the overlap lip curved.
  edgeArc*=min(1.0,.46*uNominal/max(uProfile.x,1e-6));
  float phaseDrift=(doubleWeld?.018:.10)+uProfile.z*(standard?.48:.33);
  float unit=phase+edgeArc+phaseDrift*sin(travel*(uCycleCount>0.0?2.0:.53)+uFinish.w);
  float overlapVariation=shop?weldVariation(phase,uCycleCount,55.0):0.0;
  if(shop&&!doubleWeld)unit+=uProfile.z*overlapVariation*(sharp?1.41+.63*y:.79+.39*y);
  if(standard||sharp)unit+=texture*uProfile.z*(standard?.55:1.0)*(.22*sin(y*7.0+travel)+.09*sin(y*16.0-travel));
  float f=fract(unit);
  float sizeChange=weldVariation(unit,uCycleCount,17.0);
  float scallopDepth=uStyle==0?.057:standard?.13:walking?.12:doubleWeld?.012:.09;
  scallopDepth*=1.0-.73*fusion;
  float scallop=1.0+texture*(-.04+scallopDepth*sin(3.1415926*f)+sizeChange*uProfile.z*.22);
  float crossBead=rawCross/max(scallop,.76);
  float rounded=length(vec2(crossBead,lengthOutside));
  if(uStyle==7){
    float pulses=uCycleCount>0.0?max(1.0,round(uCycleCount*.46))/uCycleCount:.46;
    float gap=abs(fract(phase*pulses)-.5);
    rounded=max(rounded,length(vec2(crossBead,gap/.385)));
  }
  float toeWidth=mix(.115,.032,uSharpness);
  if(uStyle==0)toeWidth+=.048;
  toeWidth+=.055*fusion;
  float edge=1.0-smoothstep(.98-toeWidth-aa,.98+toeWidth+aa,rounded);
  float crown=pow(max(0.0,1.0-crossBead*crossBead),uProfile.w);
  if(uStyle==4)crown=crown*(.33+.63*crossBead)+.19*exp(-pow((crossBead-.63)/.18,2.0));
  float samplePhase=uCycleCount>0.0?mod(phase,uCycleCount):phase;
  float phaseAA=clamp(fwidth(unit)*.36,.012,.48);
  float rise=smoothstep(0.0,max(phaseAA,uStyle==1?.48:.23),f);
  float settle=smoothstep(walking?.65:.36,walking?.98:1.0,f);
  float ripple=rise*(1.0-settle);
  // A narrow shoulder catches light while the groove just before it stays recessed.
  float lipWidth=mix(.155,.064,uSharpness)*(uStyle==1?1.45:sharp?.69:1.0);
  float filteredWidth=length(vec2(lipWidth,phaseAA));
  float lipOffset=fract(f-.20+.5)-.5;
  float grooveOffset=fract(f-.055+.5)-.5;
  float lip=exp(-pow(lipOffset/filteredWidth,2.0))*lipWidth/filteredWidth;
  float groove=exp(-pow(grooveOffset/filteredWidth,2.0))*lipWidth/filteredWidth;
  float crease=uSharpness*(.15*lip-(uStyle==0?.085:.14)*(1.0-.52*fusion)*groove);
  if(sharp){
    float shoulderOffset=fract(f-.37-.10*overlapVariation+.5)-.5;
    float shoulder=exp(-pow(shoulderOffset/filteredWidth,2.0))*lipWidth/filteredWidth;
    crease+=.115*(.66+.34*sin(y*7.0+travel))*shoulder;
  }
  float pore=0.0;
  if(uPitting>0.0){
    vec2 grainUV=vec2(samplePhase*4.8,y*7.5);
    vec2 grainCell=floor(grainUV);
    vec2 grainCenter=.29+.42*vec2(weldHash(grainCell+31.0),weldHash(grainCell+19.0));
    float pitDistance=length(fract(grainUV)-grainCenter);
    float grainAA=clamp(length(fwidth(vec2(phase*4.8,y*7.5)))*.46,.025,.5);
    pore=(1.0-smoothstep(.075,.075+min(grainAA,.20),pitDistance))*step(.77,weldHash(grainCell+7.0));
    pore*=uPitting*(1.0-smoothstep(.17,.45,grainAA))*(1.0-smoothstep(.52,.77,side));
  }
  float toe=exp(-pow((crossBead-.86)/max(aa,.045),2.0))*uSharpness;
  float flow=unit*(sharp?3.0:2.0)+.17*sin(y*8.0+travel*.37);
  float flowAA=1.0-smoothstep(.22,.67,fwidth(flow));
  float flowBand=cos(flow*6.2831853)*flowAA*(.66+.68*weldVariation(unit,uCycleCount,91.0));
  float puddleRelief=.24*ripple-.028+crease;
  float narrowOverlap=smoothstep(-.35,.42,longSwells);
  if(narrow)puddleRelief=.24*longSwells+narrowOverlap*(.10*ripple+.47*crease);
  if(standard)puddleRelief=(.18*ripple+1.30*crease)*(1.0+.42*overlapVariation)+.08*beadWander+.05*flowBand;
  if(walking)puddleRelief=.17*ripple+1.5*crease-.06*groove;
  if(sharp)puddleRelief=.16*ripple+1.25*crease+.05*flowBand;
  // Let the ripple dissolve into the toe while the center retains its overlap lines.
  puddleRelief*=1.0-fusion*(.25+.67*smoothstep(.35,.96,crossBead));
  float relief=edge*crown*(.66+texture*(uProfile.y*puddleRelief+.095*uProfile.z*beadWander));
  relief+=fusion*.086*(1.0-smoothstep(.53,1.0,rounded));
  if(doubleWeld){
    float railDistance=length(vec2(crossBead-.77,lengthOutside));
    float rail=exp(-pow(railDistance/max(.105,aa),2.0));
    float railEdge=1.0-smoothstep(.11-aa,.19+aa,railDistance);
    float web=(1.0-smoothstep(.64,.77,crossBead))*(1.0-smoothstep(0.0,.25,abs(lengthOutside)));
    edge=max(railEdge,.88*web);
    relief=.82*rail*railEdge+web*(.085+.054*fusion+texture*uProfile.y*
      (.20*ripple+.50*crease)*(1.0+.35*overlapVariation)*(1.0-.42*fusion));
    toe=0.0;
  }else{
    float edgeFade=1.0-uEdgeBlend*smoothstep(.61,1.0,rounded);
    edge*=edgeFade;
    relief*=edgeFade;
  }
  relief*=.74+.26*tapered;
  relief=max(0.0,relief+edge*((uStyle==0?.009:.021)*toe-.12*texture*pore));
  relief*=1.0+texture*sizeChange*uProfile.z*.26;
  float oxEdge=length(vec2(side,lengthOutside))+.055*sin(travel*(uCycleCount>0.0?3.0:.63)+y*4.0);
  float heatRange=mix(1.12,2.40,uHaloSpread);
  float heat=(1.0-smoothstep(.97,heatRange,oxEdge))*smoothstep(.62,1.03,oxEdge);
  heat*=.89+.11*beadWander;
  float spatter=0.0;
  if(uFinish.y>0.0){
    vec2 cells=vec2(samplePhase*.72,y*5.0),cell=floor(cells);
    float speck=weldHash(cell+vec2(13.0,7.0));
    float offset=weldHash(cell+vec2(3.0,11.0));
    float radius=mix(.095,.22,offset);
    float dotMask=1.0-smoothstep(radius,radius+max(.035,aa*.55),length(fract(cells)-vec2(speck,offset)*.55-.225));
    spatter=dotMask*step(1.0-uFinish.y*.47,speck)*smoothstep(.91,1.06,side)*(1.0-smoothstep(1.24,1.48,side))*texture;
    spatter*=1.0-smoothstep(0.0,.35,abs(lengthOutside));
  }
  float a=max(edge,spatter);
  if(max(a,heat)<=0.0)discard;
  float finishRipple=(uStyle==0?.33:.64)*ripple+uSharpness*(.29*lip-.39*groove);
  if(shop)finishRipple=.19*ripple+.79*lip-.32*groove+.23*sizeChange;
  if(narrow)finishRipple=.31*longSwells+narrowOverlap*(.10*ripple+.24*lip);
  if(doubleWeld)finishRipple*=1.0-smoothstep(.58,.73,crossBead);
  // Fine flow marks follow the overlap and fade below texture resolution.
  if(standard||sharp)finishRipple+=.17*flowBand;
  finishRipple*=1.0-fusion*(.23+.61*smoothstep(.40,1.0,crossBead));
  float finish=clamp(.265+texture*(finishRipple+.09*toe-.25*pore),0.0,1.0);
  o=vec4(a,max(relief,.38*spatter),heat,max(edge*finish,spatter*.4));
}`;

const FS_WELDMAPS=`
uniform sampler2D uCoverage;
uniform vec3 uSteel;
uniform float uHeight, uRoughness, uHeat, uBurn, uGlossVariation, uEdgeBlend;
uniform int uMap;
void main(){
  vec4 mask=texelFetch(uCoverage,ivec2(gl_FragCoord.xy),0);
  float bead=mask.r;
  float heat=mask.b*uHeat*.61;
  float burn=pow(mask.b,2.5)*uBurn;
  float halo=uMap==0||uMap==2||uMap==4?clamp(heat+burn,0.0,1.0):0.0;
  float detail=mask.a/max(bead,1e-5);
  // The deposited metal fades sooner than its relief, so the underlying finish carries into the toe.
  float material=uMap==1?bead:mix(bead,bead*smoothstep(0.0,.85,bead),uEdgeBlend);
  float a=material+(1.0-material)*halo;
  if(a<=0.0){o=vec4(0);return;}
  vec3 oxide=mix(vec3(.42,.31,.18),vec3(.17,.32,.43),1.0-smoothstep(.12,.70,mask.b));
  oxide=mix(oxide,vec3(.055,.045,.035),burn/max(halo,1e-5));
  vec3 colour=uSteel*mix(.63+.55*detail,.48+.95*detail,uGlossVariation);
  float height=.5+clamp(mask.g/max(bead,1e-5),0.0,1.0)*uHeight*.50;
  float rough=clamp(uRoughness-mix(.16,.29,uGlossVariation)*detail,mix(.06,.15,uGlossVariation),.96);
  vec3 value=uMap==1?vec3(height):uMap==2?vec3(rough):uMap==3?vec3(1):
    uMap==4?vec3(1.0-rough):uMap==5?vec3(0):colour;
  vec3 haloValue=uMap==0?oxide:vec3(uMap==4?.25:.75);
  o=vec4(value*material+haloValue*(a-material),a);
}`;

let P_WELDPATH=null,P_WELDMAPS=null,P_WELDLEGACY=null;
function weldPathSetup(L){
  if(!weldIsPreset(weldOptions.style))Object.assign(weldOptions,weldDefaults(WELD_PRESETS[0]));
  const style=weldStyle(weldOptions.style);
  L.path.weld={...weldOptions};
  L.path.width=(v3.mesh?.radius||1)*weldOptions.width/100;
  L.path.spacing=weldOptions.spacing;
  L.path.opacity=1;
  L.name='Weld · '+style.name+' path';
}
function weldPathUpdate(L){
  if(!L?.path?.weld||!pathValid(L))return;
  const P=L.path,profile=P.weld.profile;
  P.weld={...weldOptions,profile};
  P.width=(v3.mesh?.radius||1)*weldOptions.width/100;
  P.spacing=weldOptions.spacing;
  weldPathRender(L);
}
function weldEnsureChannels(){
  const maps=doc.workflow==='spec'?['height','spec','gloss']:['height','rough','metal'];
  if(maps.some(k=>!doc.maps.includes(k)))setDocMaps([...doc.maps,...maps],'Weld channels');
}
function weldPathLegacy(L,P,style){
  const rec=weldMaterial(style,P.weld,true);
  const coverage=makeTarget(doc.w,doc.h,8,false,false,true);
  try{
    if(!P.hidden&&P.points.length>=2&&P.mode!=='none'){
      for(const samples of pathMirrorSets(P,pathSamples(P,true)))pathSurfaceMask(L,samples,coverage,true);
    }
    if(!P_WELDLEGACY)P_WELDLEGACY=program('uniform sampler2D uCoverage; uniform vec3 uColor; void main(){float a=texelFetch(uCoverage,ivec2(gl_FragCoord.xy),0).r; o=vec4(uColor*a,a);}');
    for(const k of doc.maps){
      const v=rec.fill.maps[k];
      if(v?.on)run(P_WELDLEGACY,ensureMapTarget(L,k),{uCoverage:coverage.tex,uColor:v.c||[v.v,v.v,v.v]});
    }
  }finally{disposeTarget(coverage);}
}
function weldPathRender(L){
  if(!pathValid(L))return;
  const P=L.path,style=weldStyle(P.weld.style),v=weldPathSettings(P.weld);
  if(!P.weld.profile){weldPathLegacy(L,P,style);}
  else{
    if(!P_WELDPATH)P_WELDPATH=prog3(VS_3DPROJ,FS_WELDPATH);
    if(!P_WELDMAPS)P_WELDMAPS=program(FS_WELDMAPS);
    // Keep shallow relief and pores through the material passes on ordinary texture sizes.
    const coverage=makeTarget(doc.w,doc.h,canFloat&&doc.w*doc.h<=16777216?16:8,false);
    try{
      if(!P.hidden&&P.points.length>=2&&P.mode!=='none'){
        const samples=pathSamples(P,true);
        if(samples.length>=2){
          const distance=[0];
          for(let i=1;i<samples.length;i++)distance.push(distance[i-1]+Math.hypot(...sub3d(samples[i].p,samples[i-1].p)));
          const total=distance[distance.length-1];
          const spacing=Math.max(P.width*v.spacing,1e-6);
          const cycles=P.closed?Math.max(1,Math.round(total/spacing)):0;
          const cycle=cycles?total/cycles:spacing;
          const uniforms={uNominal:P.width*.5,uTotal:P.closed?-1:total,uCycleCount:cycles,uSharpness:v.sharpness,
            uSmoothness:v.smoothness,uHaloSpread:v.haloSpread,uPitting:v.pitting,uFusion:v.fusion,uEdgeBlend:v.edgeBlend,
            uStyle:{int:WELD_STYLES.indexOf(style)},
            uProfile:[Math.max(cycle,1e-6),v.ripple,v.irregularity,style.crown],uFinish:[0,v.spatter,v.taper,v.seed]};
          for(const points of pathMirrorSets(P,samples))pathSurfaceMask(L,points,coverage,false,{program:P_WELDPATH,uniforms,distance});
        }
      }
      const maps=doc.workflow==='spec'?[['base',5],['height',1],['spec',0],['gloss',4]]:
        [['base',0],['height',1],['rough',2],['metal',3]];
      const glossVariation=WELD_SHOP_STYLES.has(style.id)?1:0;
      for(const [k,map] of maps)if(doc.maps.includes(k)){
        const target=ensureMapTarget(L,k);
        if(v.surface==='paint'&&k!=='height'){clearTarget(target);continue;}
        run(P_WELDMAPS,target,{uCoverage:coverage.tex,uSteel:style.color,
          uHeight:v.height,uRoughness:v.roughness,uHeat:v.heat,uBurn:v.burn,
          uGlossVariation:glossVariation,uEdgeBlend:v.edgeBlend,uMap:{int:map}});
      }
    }finally{disposeTarget(coverage);}
  }
  L.opacity=P.opacity;
  L.name='Weld · '+style.name+' path';
  changed(L);
}

function weldApplyBrush(preset){
  const v=weldOptions,style=weldStyle(v.style);
  materialBrush.rec=weldMaterial(style,v);
  if(preset)applyPreset(weldBrushPreset(style,v,'material'));
  else{Object.assign(brush,weldBrushDynamics(style,v));refreshCursor();schedulePreview();}
}
function weldLiveUpdate(key,value){
  const L=pathActive();
  if(L?.path?.weld&&ui.tool==='path'){
    if(lockStop({node:L})||!pathValid(L))return;
    if(!L._pathBefore)L._pathBefore=pathSnap(L);
    Object.assign(weldOptions,weldPathSettings(L.path.weld));
    if(key==='style')Object.assign(weldOptions,weldDefaults(weldStyle(value)));
    else weldOptions[key]=value;
    weldPathUpdate(L);
    clearTimeout(L._pathTimer);
    L._pathTimer=setTimeout(()=>{
      const before=L._pathBefore;L._pathBefore=null;
      if(before)pathRecord(L,before,'Weld settings');
    },400);
  }else{
    if(key==='style')Object.assign(weldOptions,weldDefaults(weldStyle(value)));
    else weldOptions[key]=value;
    if(ui.tool==='material'&&materialBrush.rec?.weldPaint&&!stroke)weldApplyBrush(false);
  }
}

const weldCoverageWarm=new Set();
function weldWarmMask(){
  const depth=doc.depth;if(weldCoverageWarm.has(depth))return;
  const mask=makeTarget(1,1,depth,false,false,true),rgba=makeTarget(1,1,depth,false);
  try{
    blit(mask,rgba,0,0,1,1,0,0);
    run(P.merge,mask,{uSrc:rgba.tex,uStrokeTex:dummy,uStroke:{int:0},uStrokeColor:[1,1,1],uStrokeOpacity:1,uLockAlpha:false,...chanU(null),...selU(null)});
    captureRegionNow(mask,0,0,1,1);weldCoverageWarm.add(depth);
  }finally{disposeTarget(mask);disposeTarget(rgba);}
}
async function weldUse(style){
  if(weldBusy||stroke)return;
  const L=pathActive();
  if(L?.path?.weld&&ui.tool==='path'){weldLiveUpdate('style',style.id);weldToolsRender();return;}
  Object.assign(weldOptions,weldDefaults(style));
  weldBusy=true;weldPathArmed=false;
  try{
    if(!await materialBrushUse(weldMaterial(style,weldOptions)))return;
    weldWarmMask();weldApplyBrush(true);
    toast(style.name+' ready. Drag to weld or choose Draw weld path.');
    weldToolsRender();
  }finally{weldBusy=false;}
}

function weldCard(style){
  const c=el('canvas',{width:126,height:57,role:'img','aria-label':style.name+' bead preview'});
  const x=c.getContext('2d'),v=weldDefaults(style),bead=x.createImageData(c.width,c.height),d=bead.data,r=13;
  const profile=(px,py)=>{
    const axis=29+4*Math.sin(px*.066);
    const period=r*Math.max(.24,v.spacing*2);
    const off=px-14;
    const y=(py-axis)/r;
    let h=0;
    const k=Math.floor(off/period);
    for(let i=-3;i<=3;i++){
      const centre=14+(k+i)*period;
      if(centre>c.width-13||centre<12)continue;
      h=Math.max(h,weldDab((px-centre)/r,y,style,v));
    }
    return h;
  };
  for(let py=0;py<c.height;py++)for(let px=0;px<c.width;px++){
    const h=profile(px,py);
    const dx=profile(px+1,py)-h,dy=profile(px,py+1)-h;
    const silver=clamp(.50+h*.25+dx*.81+dy*.99,0,1);
    const a=clamp(h*5,0,1),i=(py*c.width+px)*4;
    for(let k=0;k<3;k++)d[i+k]=Math.round(255*((.12+k*.016)*(1-a)+(silver+style.color[k]*.15)*a));
    d[i+3]=255;
  }
  x.putImageData(bead,0,0);
  return el('button',{class:'mattile weld-card',type:'button',title:style.name,onclick:()=>weldUse(style)},c,
    el('span',{text:style.name}),el('small',{text:style.detail}));
}

function weldShelfContent(){
  const grid=el('div',{class:'matgrid weld-grid'},...WELD_PRESETS.map(weldCard));
  const L=pathActive(),editing=!!(L?.path?.weld&&ui.tool==='path');
  const savedStyle=editing&&!weldIsPreset(weldOptions.style);
  const select=el('select',{'aria-label':'Weld bead style'},
    savedStyle?el('option',{value:weldOptions.style,text:'Saved weld style',disabled:true}):null,
    ...WELD_PRESETS.map(s=>el('option',{value:s.id,text:s.name})));
  select.value=weldOptions.style;
  select.onchange=()=>{weldLiveUpdate('style',select.value);weldToolsRender();};
  const row=(label,key,min,max,step,fmt=pct,extra={})=>makeSlider({id:'weld-'+key,label,min,max,step,
    value:weldOptions[key],fmt,onInput:v=>weldLiveUpdate(key,v),...extra}).el;
  const path=el('button',{class:'btn',type:'button',text:'Draw weld path',onclick:()=>{
    if(stroke||preview)return;
    if(ui.mode!=='p3d'){toast('Open 3D Paint to draw a weld path.');return;}
    if(!v3.mesh||v3.mesh.noUV){toast('Choose a model with UVs before drawing a weld path.');return;}
    pathFinish();
    weldPathArmed=true;setTool('path');const L=pathNew('3d');
    weldToolsRender();buildBrushPanel();requestRender(true);
    toast(weldStyle(L.path.weld.style).name+' path ready. Click on the model to place points. Press Enter to finish.');
  }});
  const legacy=editing&&!L.path.weld.profile;
  const surface=el('select',{'aria-label':'Weld finish'},
    el('option',{value:'metal',text:'Bare metal'}),el('option',{value:'paint',text:'Keep underlying paint'}));
  surface.value=weldOptions.surface;
  surface.onchange=()=>{weldLiveUpdate('surface',surface.value);weldToolsRender();};
  const halo=editing&&!legacy&&weldOptions.surface==='metal';
  const bareMetal=!legacy&&weldOptions.surface==='metal';
  const paint=el('button',{class:'btn',type:'button',text:'Use as Brush',disabled:savedStyle,onclick:()=>{
    if(stroke||preview||weldBusy)return;
    const style=weldStyle(weldOptions.style);
    const settings=editing?{...weldOptions,width:style.size}:weldOptions;
    applyPreset(weldBrushPreset(style,settings,'brush'));
    if(editing)weldToolsRender();
    toast(style.name+' ready. Paint with your foreground color.');
  }});
  const joins=legacy?null:el('div',{class:'weld-controls'},
    weldOptions.style==='tack'?null:row('Bead fusion','fusion',0,1,.01),
    row('Edge blend','edgeBlend',0,1,.01));
  const controls=el('div',{class:'weld-controls'},
    row('Bead width','width',4,48,1,v=>v.toFixed(0)+(editing?'% of model radius':' px'),{numericMax:500}),
    row('Ripple spacing','spacing',.06,1,.01,v=>Math.round(v*100)+'% of width',{numericScale:100}),
    row('Bead height','height',0,1,.01),
    legacy?null:row('Ripple depth','ripple',0,1,.01),legacy?null:row('Detail sharpness','sharpness',0,1,.01),
    legacy?null:row('Smoothness','smoothness',0,1,.01),legacy?null:row('Irregularity','irregularity',0,1,.01),
    legacy?null:el('label',{class:'frow'},el('span',{text:'Weld finish'}),surface),
    weldOptions.surface==='metal'?row('Heat tint','heat',0,1,.01):null,
    bareMetal?row('Halo spread','haloSpread',0,1,.01):null,halo?row('Burn halo','burn',0,1,.01):null,
    bareMetal&&!editing?chk('weld-pressure-halo','Heat responds to pen pressure',weldOptions.pressureHalo,
      v=>weldLiveUpdate('pressureHalo',v)):null,
    weldOptions.surface==='metal'?row('Roughness','roughness',.06,.95,.01):null,
    legacy?null:row('Pitting','pitting',0,1,.01),legacy?null:row('Spatter','spatter',0,1,.01),
    editing&&!legacy?row('End taper','taper',0,1,.01):null,
    legacy?null:row('Variation seed','seed',1,99,1,v=>String(Math.round(v))));
  return el('div',{class:'weld-shelf'},
    el('div',{class:'weld-actions'},select,paint,path),joins,grid,controls);
}
function weldToolsRender(){
  const L=pathActive();
  if(L?.path?.weld&&ui.tool==='path')Object.assign(weldOptions,weldPathSettings(L.path.weld));
  else if(!weldIsPreset(weldOptions.style))Object.assign(weldOptions,weldDefaults(WELD_PRESETS[0]));
  const box=$('#weldToolsBody');if(box)box.replaceChildren(weldShelfContent());
}
