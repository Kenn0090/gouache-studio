/* Live weathering masks. Source placement and the surface flow are separate so the
   same painted anchors can drive a deposit, relief, or a stain without baking pixels. */
const MS_WEATHER_GENS=[
  ['rustRunoff','Rust & Runoff'],['mineralBuildup','Mineral Buildup']
];
MS_GENS.push(...MS_WEATHER_GENS);
const msWeatherKind=g=>MS_WEATHER_GENS.some(([id])=>id===g);
const MS_WEATHER_PRESETS={
  rustRunoff:[
    ['spot','Spot Rust',{amount:.54,spread:.28,breakup:.64,dripLength:0,dripWidth:.23}],
    ['underPaint','Rust Under Paint',{amount:.74,spread:.65,breakup:.68,dripLength:.12,dripWidth:.24}],
    ['rain','Rain Streaks',{amount:.67,spread:.33,breakup:.36,dripLength:.44,dripWidth:.31,branching:.58}]
  ],
  mineralBuildup:[
    ['waterline','Waterline Rings',{source:'waterline',amount:.76,spread:.28,dripLength:0,bands:4}],
    ['pipe','Leaking Pipe',{source:'below',amount:.83,spread:.37,dripLength:.35,dripWidth:.38,bands:0}],
    ['crust','Chalky Crust',{source:'geometry',amount:.75,spread:.4,dripLength:0,bands:0}]
  ]
};
const MS_WEATHER_OUTPUTS={
  rustRunoff:[['combined','Combined'],['deposit','Rust coverage'],['pits','Corrosion pits'],['runoff','Runoff stains'],['fresh','Fresh oxide']],
  mineralBuildup:[['combined','Combined'],['deposit','Crust'],['pits','Rough deposits'],['runoff','Runoff stains']]
};
const MS_WEATHER_AXES=[['down','Down (−Y)'],['up','Up (+Y)'],['x','Right (+X)'],['-x','Left (−X)'],['z','Forward (+Z)'],['-z','Backward (−Z)']];
function msWeatherDefaults(g,preset){
  const variants=MS_WEATHER_PRESETS[g];
  const selected=variants.find(([key])=>key===preset)||variants[0];
  return {preset:selected[0],source:'geometry',output:MS_WEATHER_OUTPUTS[g][0][0],amount:.68,spread:.42,breakup:.48,
    scale:10,gtile:1,seed:1,direction:'down',dripLength:.32,dripWidth:.3,taper:.72,branching:.34,
    waterline:.52,bands:3,pitDepth:.75,...selected[2]};
}

const FS_WEATHER_SOURCE=MS_NOISE_GLSL+MS_SURF_GLSL+`
uniform sampler2D uMask, uCurv, uAO, uGrunge;
uniform int uSource, uHasCurv, uHasAO, uHasGrunge;
uniform vec4 uShape, uGrungeShape;
uniform float uPitDepth,uGrungeLevel;
uniform vec2 uWater;
vec3 weights(){
  vec3 n=pow(abs(surfN()),vec3(5.0));
  return n/max(dot(n,vec3(1)),1e-5);
}
float grainImage(vec3 q){
  float a=uGrungeShape.y,c=cos(a),s=sin(a);
  mat2 turn=mat2(c,s,-s,c);
  q*=uGrungeShape.x;
  float value=texture(uGrunge,fract(turn*q.xy)).r;
  if(uWorld==1&&uHasPos==1){
    vec3 w=weights();
    value=dot(w,vec3(texture(uGrunge,fract(turn*q.zy)).r,texture(uGrunge,fract(turn*q.xz)).r,value));
  }
  if(uGrungeShape.z>0.5)value=1.0-value;
  return clamp((value-.5)*max(.05,1.0+uGrungeShape.w*3.0)+.5+uGrungeLevel*.5,0.0,1.0);
}
void main(){
  vec2 uv=gl_FragCoord.xy/uSz;
  vec3 q=surfQ(uv),p=q*uShape.w;
  float breakup=clamp(uShape.z,0.0,1.0);
  float noise=uHasGrunge==1?grainImage(q):fbm(p);
  float fine=vn(p*14.0+12.7);
  float edge=0.0,cavity=0.0;
  if(uHasCurv>0){
    float c=texture(uCurv,uv).r;
    edge=clamp(uHasCurv==2?c:(c-.5)*4.0,0.0,1.0);
    cavity=uHasCurv==2?0.0:clamp((.5-c)*4.0,0.0,1.0);
  }
  float ao=uHasAO==1?clamp((1.0-texture(uAO,uv).r)*1.75,0.0,1.0):0.0;
  float amount=clamp(uShape.x,0.0,1.0),spread=uShape.y;
  float seed=0.0,core=0.0;
  if(uSource==3){
    float distance=abs(surfP(uv).y-uWater.x+(noise-.5)*.028);
    float extent=mix(.006,.103,spread);
    float envelope=1.0-smoothstep(extent*.12,extent,distance);
    float rings=1.0-smoothstep(.12,.48,abs(fract(distance/extent*uWater.y)-.18));
    core=envelope*mix(1.0,.22+.78*rings,step(.5,uWater.y));
    seed=core;
  }else if(uSource==0){
    float exposure=max(edge*.80,max(cavity,ao*.82));
    if(uHasCurv==0&&uHasAO==0)exposure=smoothstep(.41,.75,fbm(p*.64+7.9));
    float threshold=mix(.80,.12,amount)*mix(1.15,.48,spread);
    core=smoothstep(threshold,threshold+mix(.10,.34,spread),exposure+(noise-.51)*breakup*.58);
    seed=core;
  }else{
    vec2 offset=vec2(spread*.017);
    seed=texture(uMask,uv).r;
    float surrounding=max(max(texture(uMask,uv+vec2(offset.x,0)).r,texture(uMask,uv-vec2(offset.x,0)).r),
                          max(texture(uMask,uv+vec2(0,offset.y)).r,texture(uMask,uv-vec2(0,offset.y)).r));
    // In 3D the input is already grown with the mesh-connected sampler.
    if(uHasPos==1&&uWorld==1)surrounding=seed;
    core=max(seed,surrounding*spread*.72);
    core=smoothstep(mix(.68,.04,amount),mix(.97,.20,amount),core+(noise-.5)*breakup*core*.6);
  }
  float deposit=core*amount*mix(1.0,smoothstep(.18,.82,noise),breakup*.87);
  float pits=deposit*smoothstep(.52,.85,vn(p*8.0+2.8)*.64+fine*.36)*uPitDepth;
  float fresh=deposit*smoothstep(.42,.76,noise*.72+fine*.28);
  o=vec4(deposit,seed*amount,pits,fresh);
}`;
const WEATHER_FLOW=`
uniform vec4 uFlow;
uniform float uSeed;
float flowNoise(float x){
  float n=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
  return mix(fract(sin(n*127.1+uSeed*17.9)*43758.5453),
             fract(sin((n+1.0)*127.1+uSeed*17.9)*43758.5453),f);
}
vec2 flowShape(float t,float lane){
  float wiggle=(flowNoise(lane*11.3+t*4.0)-flowNoise(lane*11.3))*uFlow.w;
  float width=uFlow.y*mix(1.0,1.0-t*.87,uFlow.z)*(1.0+uFlow.w*t*.8);
  return vec2(wiggle*uFlow.y*3.1,width);
}
float flowWeight(float t,float lane){
  float run=mix(.29,1.0,flowNoise(lane*7.0+5.7));
  return (1.0-smoothstep(run*.46,run+.13,t))*mix(.52,1.0,flowNoise(lane*17.0+4.2));
}`;
const FS_WEATHER_FLAT=WEATHER_FLOW+`
in vec2 vUV;
uniform sampler2D uSource;
uniform vec2 uDirection,uSize;
float upstream(vec2 uv){
  if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1))))return 0.0;
  return texture(uSource,uv).g;
}
void main(){
  vec2 uv=gl_FragCoord.xy/uSize;
  vec2 side=vec2(-uDirection.y,uDirection.x),aspect=min(uSize.x,uSize.y)/uSize;
  float lane=dot(uv/aspect,side)*49.0;
  float value=0.0;
  for(int i=1;i<=32;i++){
    float t=float(i)/32.0;
    vec2 shape=flowShape(t,lane);
    vec2 tap=uv+(-uDirection*(uFlow.x*t)+side*shape.x)*aspect;
    vec2 offset=side*shape.y*aspect;
    float root=upstream(tap),fork=max(upstream(tap+offset),upstream(tap-offset));
    value=max(value,max(root,fork*mix(.34,.82,uFlow.w))*flowWeight(t,lane));
  }
  o=vec4(vec3(value),1.0);
}`;
const FS_WEATHER_MESH=FS_SEAMBLUR.slice(0,FS_SEAMBLUR.indexOf('void main()'))+WEATHER_FLOW+`
uniform vec3 uGravity;
uniform float uBounds;
float upstream(int face,vec3 anchor,vec3 p){
  return textureLod(uSrc,walkUV(face,anchor,baryWorld(face,p)),0.0).g;
}
void main(){
  int face=vFace;vec3 b=vec3(1.0-vBary.x-vBary.y,vBary);
  vec3 a=pointAt(face,0),c=pointAt(face,1),d=pointAt(face,2);
  vec3 p=a*b.x+c*b.y+d*b.z,n=normalize(cross(c-a,d-a));
  vec3 direction=uGravity-n*dot(uGravity,n);
  float slope=length(direction);
  if(slope<.025){o=vec4(0,0,0,1);return;}
  direction/=slope;
  vec3 side=normalize(cross(n,direction));
  vec3 axis=abs(uGravity.z)<.8?vec3(0,0,1):vec3(1,0,0);
  vec3 lanePoint=p/max(uBounds,1e-6);
  float lane=dot(lanePoint,normalize(cross(uGravity,axis)))*47.0+dot(lanePoint,axis)*28.0;
  float value=0.0;
  for(int i=1;i<=24;i++){
    float t=float(i)/24.0;
    vec2 shape=flowShape(t,lane);
    vec3 tap=p+(-direction*(uFlow.x*t*min(1.0,slope*2.0))+side*shape.x)*uBounds;
    vec3 offset=side*(shape.y*uBounds);
    float root=upstream(face,b,tap),fork=max(upstream(face,b,tap+offset),upstream(face,b,tap-offset));
    value=max(value,max(root,fork*mix(.34,.82,uFlow.w))*flowWeight(t,lane));
  }
  o=vec4(vec3(value*smoothstep(.025,.28,slope)),1.0);
}`;
const FS_WEATHER_OUT=`
uniform sampler2D uSource,uRunoff;
uniform int uOutput,uInvert;
uniform float uRunStrength;
void main(){
  ivec2 xy=ivec2(gl_FragCoord.xy);
  vec4 s=texelFetch(uSource,xy,0);
  float flow=uRunStrength>0.0?texelFetch(uRunoff,xy,0).r*uRunStrength:0.0;
  float v=uOutput==1?s.r:uOutput==2?s.b:uOutput==3?flow*(1.0-s.r):uOutput==4?s.a:max(s.r,flow*.78);
  o=vec4(vec3(uInvert==1?1.0-v:v),1.0);
}`;
let msWeatherPrograms=null,msWeatherMeshProgram=null;
function msWeatherFlow(src,dst,p,ctx){
  const axis=MS_AXES[p.direction]||MS_AXES.down;
  const flow=[clamp(p.dripLength,0,1)*.56,clamp(p.dripWidth,0,1)*.035,clamp(p.taper,0,1),clamp(p.branching,0,1)];
  const mesh=ctx.surf.uHasPos.int&&ui.mode==='p3d'&&p.proj!=='uv'&&p.uvWrap!==false?seamBlurMesh():null;
  if(mesh){
    if(!msWeatherMeshProgram)msWeatherMeshProgram=prog3(VS_SEAMBLUR,FS_WEATHER_MESH);
    clearTarget(dst,[0,0,0,1]);
    try{
      useProg(msWeatherMeshProgram,{uFaces:mesh.tex,uSrc:src.tex,uSize:[src.w,src.h],uGravity:axis,
        uBounds:Math.max(...ctx.surf.uBsize),uFlow:flow,uSeed:p.seed},!!dst.packed);
      bindTarget(dst);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(mesh.vao);gl.drawArrays(gl.TRIANGLES,0,mesh.count*3);
    }finally{gl.bindVertexArray(vao);}
    seamBlurPadding(mesh,dst);
    return;
  }
  const flat=axis[2]?[0,-axis[2]]:[axis[0],-axis[1]];
  run(msWeatherPrograms.flat,dst,{uSource:src.tex,uDirection:flat,uFlow:flow,uSize:[src.w,src.h],uSeed:p.seed});
}
function msWeatherAnchor(p,L,guard,depth){
  const anchor=msAnchor(p.anchor);
  if(!anchor||anchor===L||(guard||[]).includes(anchor))return null;
  if(msHas(anchor))msUpdate(anchor,[...(guard||[]),L]);
  if(anchor.mask?.enabled)return {target:anchor.mask.target,borrowed:false};
  const base=mapT(anchor,'base');
  if(!base||base.empty)return null;
  const target=acquireD(depth);
  run(msProgs().anc,target,{uT:base.tex,uM:dummy,uUseM:{int:0},uCh:{int:1},uNeg:{int:0}});
  return {target,borrowed:true};
}
function msWeatherSource(r,ctx,depth,L,guard,below){
  const p={...msWeatherDefaults(r.p.g,r.p.preset),...r.p};
  if(!msWeatherPrograms)msWeatherPrograms={source:program(FS_WEATHER_SOURCE),flat:program(FS_WEATHER_FLAT),out:program(FS_WEATHER_OUT)};
  const anchor=p.source==='anchor'?msWeatherAnchor(p,L,guard,8):null;
  const mask=anchor?.target||(p.source==='below'?below:null);
  const edgeOnly=p.source==='geometry'&&(msMeshTex('curvEdge')||msMeshTex('cv:curvEdge'));
  const curv=p.source==='geometry'&&(msMeshTex('curv')||msMeshTex('cv:curv')||edgeOnly||msDocMap('curv',ctx)||msModelCurv());
  const ao=p.source==='geometry'&&(msMeshTex('ao')||msMeshTex('cv:ao')||msDocMap('ao',ctx));
  const grunge=msGrungeTex(p),src=acquireD(8),dst=acquireD(depth);
  let flow=null;
  try{
    let input=mask;
    if(mask&&p.spread>0&&ctx.surf.uHasPos.int&&p.proj!=='uv'&&p.uvWrap!==false)
      input=msWarpEdgeMap(mask,ctx,0,1,p.seed,clamp(p.spread,0,1)*.018,0)||mask;
    const output=Math.max(0,MS_WEATHER_OUTPUTS[p.g].findIndex(([key])=>key===p.output));
    const source=['geometry','below','anchor','waterline'].indexOf(p.source);
    run(msWeatherPrograms.source,src,{...msPx(r,ctx),uSource:{int:Math.max(0,source)},
      uMask:input?.tex||dummy,uCurv:curv?.tex||dummy,uAO:ao?.tex||dummy,uGrunge:grunge?.tex||dummy,
      uHasCurv:{int:curv?(curv===edgeOnly?2:1):0},uHasAO:{int:ao?1:0},uHasGrunge:{int:grunge?1:0},
      uShape:[p.amount,clamp(p.spread,0,1),p.breakup,Math.max(.5,p.scale)],uSeed:p.seed,
      uGrungeShape:[p.gtile||1,(p.grot||0)*Math.PI/180,p.ginv?1:0,p.gcon||0],
      uPitDepth:clamp(p.pitDepth,0,1),uGrungeLevel:p.glev||0,uWater:[p.waterline,p.bands]});
    if((output===0||output===3)&&p.dripLength>0){
      flow=acquireD(8);
      msWeatherFlow(src,flow,p,ctx);
    }
    run(msWeatherPrograms.out,dst,{uSource:src.tex,uRunoff:flow?.tex||dummy,uRunStrength:flow?1:0,
      uOutput:{int:output},uInvert:{int:p.inv?1:0}});
    return {t:dst,pooled:true};
  }catch(error){release(dst);throw error;}
  finally{release(src);if(flow)release(flow);if(anchor?.borrowed)release(anchor.target);}
}

function msWeatherControls(box,L,r,p,ed,S,sel,inv){
  const defaults=msWeatherDefaults(p.g,p.preset);
  const type=p.g,mineral=type==='mineralBuildup';
  for(const [key,value] of Object.entries(defaults))if(p[key]==null)p[key]=value;
  const variants=MS_WEATHER_PRESETS[type];
  const preset=sel('ms_weatherPreset','Style',variants,'preset');
  preset.querySelector('select').onchange=e=>{
    const choice=variants.find(([key])=>key===e.target.value);
    if(!choice)return;
    msCommit();
    ed(x=>{
      const settings=msWeatherDefaults(type,choice[0]);
      const keepSource=mineral?settings.source:x.p.source;
      Object.assign(x.p,settings,{source:keepSource,output:x.p.output,gtile:x.p.gtile});
    });
    msCommit();renderMatEd(true);
  };
  const source=sel('ms_weatherSource','Starts from',[
    ['geometry','Edges and cavities'],['below','Mask rows below'],['anchor','Anchor point'],
    ...(mineral?[['waterline','Waterline']]:[])
  ],'source');
  source.querySelector('select').addEventListener('change',()=>renderMatEd(true));
  box.append(preset,source,sel('ms_weatherOutput','Output',MS_WEATHER_OUTPUTS[type],'output'));
  if(p.source==='anchor')box.append(sel('ms_weatherAnchor','Anchor',[['','Choose an anchor'],...msAnchorNames().map(n=>[n,n])],'anchor'));
  if(p.source==='waterline')box.append(S('ms_waterline','Waterline height','waterline',0,1,.01,pct),S('ms_mineralBands','Deposit bands','bands',0,10,1));
  box.append(S('ms_weatherAmount','Coverage','amount',0,1,.01,pct),S('ms_weatherSpread','Spread','spread',0,1,.01,pct),
    S('ms_weatherBreakup','Breakup','breakup',0,1,.01,pct),S('ms_weatherScale','Texture scale','scale',1,50,.5),
    S('ms_weatherSeed','Seed','seed',1,999,1));
  box.append(S('ms_weatherPits',mineral?'Deposit relief':'Pit strength','pitDepth',0,1,.01,pct),
    sel('ms_runDirection','Gravity',MS_WEATHER_AXES,'direction'),S('ms_runLength','Drip length','dripLength',0,1,.01,pct),
    S('ms_runWidth','Drip width','dripWidth',0,1,.01,pct),S('ms_runTaper','Taper','taper',0,1,.01,pct),
    S('ms_runBranch','Branching','branching',0,1,.01,pct));
  box.append(inv(),pxfBox(L,r,[['world','World (no seams)'],['uv','UV']]),msGrungeBox(r,p,ed,S),
    el('p',{class:'note',text:'Use Mask rows below for paint chips or hand-painted spots. Set Drip length to zero for dry deposits.'}));
}
