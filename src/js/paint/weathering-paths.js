/* Sealant beads use the same surface projection as welds. */
const SEALANT_DEFAULTS={name:'Sealant Bead',kind:'sealant',width:.048,depth:.45,rough:.46,
  profile:'tooled',marks:.35,squeeze:.42,gaps:.09,color:[.16,.17,.18]};
function sealantPathStart(){
  if(stroke||preview||selLive||ui.mode!=='p3d')return;
  if(!v3.mesh||v3.mesh.noUV){toast('Choose a model with UVs first.');return;}
  const previous=pathActive()?.path;
  const options=previous?.weather?.kind==='sealant'
    ?{...pathCopy(previous.weather),width:previous.width/(v3.mesh.radius||1)}:pathCopy(SEALANT_DEFAULTS);
  pathFinish();
  setTool('path');
  if(ui.tool!=='path')return;
  pathNew('3d',null,options);
  buildBrushPanel();requestRender(true);
  toast('Click on the model to place points. Press Enter to finish.');
}
function weatherPathSetup(L,settings){
  L.name=settings.name;
  L.path.weather=settings;
  L.path.width=(v3.mesh.radius||1)*settings.width;
  L.path.opacity=1;
  const keys=doc.workflow==='spec'?['height','gloss']:['height','rough'];
  if(keys.some(k=>!doc.maps.includes(k)))setDocMaps([...doc.maps,...keys],'Surface path channels');
}
function weatherPathControls(box,P){
  const w=P.weather;
  const slider=(key,label,min=0,max=1,step=.01,fmt=pct)=>makeSlider({id:'weatherPath_'+key,label,min,max,step,fmt,
    value:w[key],onInput:value=>{
      const L=pathActive();
      if(!L||L.path!==P||!pathValid(L)||lockStop({node:L}))return;
      if(!L._pathBefore)L._pathBefore=pathSnap(L);
      w[key]=value;
      pathRender(L);
      clearTimeout(L._pathTimer);
      L._pathTimer=setTimeout(pathFlush,400);
    }}).el;
  const profile=el('select',{id:'weatherPath_profile','aria-label':'Bead profile'},
    ...[['tooled','Tooled seam'],['round','Round bead'],['flat','Flat strip']].map(([value,text])=>el('option',{value,text})));
  profile.value=w.profile||'tooled';
  profile.onchange=()=>pathChange(p=>{p.weather.profile=profile.value;},'Bead profile');
  box.append(el('div',{class:'frow'},el('span',{text:'Sealant color'}),
    colourBtn('weatherPathColor',()=>w.color,c=>pathChange(p=>{p.weather.color=c;},'Path material color'),'Path material color')));
  box.append(el('label',{class:'frow'},el('span',{text:'Bead profile'}),profile),
    slider('marks','Tool marks'),slider('squeeze','Squeeze-out'),slider('gaps','Gaps'),
    slider('depth','Bead height'),slider('rough','Roughness'));
}
const FS_WEATHER_PATH=`
in vec3 vP,vN;
uniform vec3 uA,uB,uNA,uNB;
uniform vec2 uRadius,uRun;
uniform float uDepth;
uniform int uProfile;
uniform vec3 uShape;
float edgeNoise(float x){
  float i=floor(x),f=fract(x);
  return mix(fract(sin(i*91.3+17.9)*43758.5453),fract(sin((i+1.0)*91.3+17.9)*43758.5453),f*f*(3.0-2.0*f));
}
void main(){
  vec3 ab=uB-uA;
  float along=dot(vP-uA,ab)/max(dot(ab,ab),1e-10),t=clamp(along,0.0,1.0);
  float r=max(mix(uRadius.x,uRadius.y,t),1e-6);
  vec3 n=normalize(mix(uNA,uNB,t)),q=vP-mix(uA,uB,t);
  float z=dot(q,n);
  if(abs(z)>uDepth||dot(normalize(vN),n)<.10){o=vec4(0);return;}
  vec3 tangent=normalize(ab-n*dot(ab,n)+vec3(1e-9)), side=normalize(cross(n,tangent));
  float y=dot(q,side)/r;
  float endDistance=dot(q,tangent)/r;
  if(abs(endDistance)>1.6){o=vec4(0);return;}
  float run=mix(uRun.x,uRun.y,t);
  float units=run/max((uRadius.x+uRadius.y)*.5,1e-6);
  float variation=edgeNoise(units*.84);
  float offset=(variation-.5)*.18*uShape.y;
  float d=length(vec2(endDistance,(y-offset)));
  float aa=max(fwidth(d),.025);
  float a=1.0-smoothstep(1.0-aa,1.0+aa,d);
  float rounded=sqrt(max(0.0,1.0-d*d));
  float tooled=mix(rounded, .57+.17*d, 1.0-smoothstep(.56,1.0,d));
  float crown=uProfile==1?rounded:uProfile==2?min(1.0,rounded*2.5)*.64:tooled;
  float lines=(edgeNoise(units*4.6+y*.34)-.5)*uShape.x;
  float squeeze=(1.0-smoothstep(1.05,1.44,d))*uShape.y*(.42+.58*variation);
  float continuous=1.0-uShape.z*smoothstep(.74,.98,edgeNoise(units*.29+11.2));
  float cover=max(a,squeeze*.46)*continuous;
  o=vec4(max(a*(crown+lines*.18),squeeze*.13)*continuous,0.0,cover,cover);
}`;
const FS_WEATHER_PATH_MAPS=`
uniform sampler2D uProfile;
uniform vec3 uColor;
uniform float uRelief,uRoughness;
uniform int uMap;
void main(){
  vec4 m=texelFetch(uProfile,ivec2(gl_FragCoord.xy),0);
  float a=m.b;
  float height=.5+.49*uRelief*m.r/max(a,1e-5);
  vec3 value=uMap==1?vec3(clamp(height,0.0,1.0)):uMap==2?vec3(uRoughness):
    uMap==3?vec3(1.0-uRoughness):uColor*(.88+.18*m.r/max(a,1e-5));
  o=vec4(value*a,a);
}`;
let weatherPathProgram=null,weatherPathMapProgram=null;
function weatherPathDistances(samples){
  const distance=[0];
  for(let i=1;i<samples.length;i++)distance.push(distance[i-1]+Math.hypot(...sub3(samples[i].p,samples[i-1].p)));
  return distance;
}
function weatherPathRender(L){
  if(!pathValid(L))return;
  const P=L.path,w=P.weather;
  if(!weatherPathProgram)weatherPathProgram=prog3(VS_3DPROJ,FS_WEATHER_PATH);
  if(!weatherPathMapProgram)weatherPathMapProgram=program(FS_WEATHER_PATH_MAPS);
  const coverage=acquireD(8);
  try{
    clearTarget(coverage,[0,0,0,0]);
    if(!P.hidden&&P.points.length>=2&&P.mode!=='none'){
      const samples=pathSamples(P,true);
      if(samples.length>=2){
        const distance=weatherPathDistances(samples);
        const uniforms={uProfile:{int:Math.max(0,['tooled','round','flat'].indexOf(w.profile))},
          uShape:[w.marks,w.squeeze,w.gaps]};
        for(const set of pathMirrorSets(P,samples))
          pathSurfaceMask(L,set,coverage,false,{program:weatherPathProgram,uniforms,distance});
      }
    }
    const maps=doc.workflow==='spec'?[['base',0],['height',1],['gloss',3]]:[['base',0],['height',1],['rough',2]];
    for(const [key,mode] of maps)if(doc.maps.includes(key))
      run(weatherPathMapProgram,ensureMapTarget(L,key),{uProfile:coverage.tex,uColor:w.color,uRelief:w.depth,uRoughness:w.rough,uMap:{int:mode}});
    L.opacity=P.opacity;changed(L);
  }finally{release(coverage);}
}
