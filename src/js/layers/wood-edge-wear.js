const MS_WOOD_STYLES=[
  ['rubbed','Rubbed Finish',{amount:.72,width:.53,edgeGrow:.27,distort:.2,woodGrain:.48,woodSplinters:.18}],
  ['chipped','Chipped Finish',{amount:.79,width:.62,edgeGrow:.42,distort:.43,woodGrain:.7,woodSplinters:.48}],
  ['splintered','Splintered Timber',{amount:.84,width:.7,edgeGrow:.66,distort:.49,woodGrain:.86,woodSplinters:.9}]
];
const MS_WOOD_OUTPUTS=[['combined','Wear and splinters'],['wear','Wear only'],['splinters','Splinters only']];
const MS_WOOD_SCANS=TX_EXTRA_GRUNGE.filter(([id])=>id.startsWith('grunge-wood-')).map(([id,name])=>({kind:'photo',id,name}));
MS_GENS.push(['woodWear','Wood Edge Wear']);

function msWoodDefaults(){
  return {woodStyle:'rubbed',woodOutput:'combined',woodAxis:'x',woodAngle:0,woodFrequency:23,woodLength:1,
    woodScan:MS_WOOD_SCANS.find(scan=>scan.id==='grunge-wood-table-scuffs')?.id||'',woodScanAmount:.38,woodScanTile:2,
    contrast:1.35,cavityProtection:.86,edgeStrength:1.15,edgeDistortScale:10,...MS_WOOD_STYLES[0][2]};
}

const FS_MSWOOD=MS_NOISE_GLSL+MS_SURF_GLSL+`
uniform sampler2D uEdge,uAnchor,uAO,uGrainScan;
uniform vec4 uMaps; // edge type, anchor, AO, grain scan
uniform vec4 uWear; // amount, width, edge strength, contrast
uniform vec3 uShape; // cavity protection, distortion, distortion scale
uniform vec4 uFibre; // grain influence, grain frequency, splinter amount, splinter length
uniform vec4 uScan; // influence, tiling, rotation, inversion
uniform vec3 uGrainAxis;
uniform vec2 uGrainTurn;
uniform int uInvert,uOutput;

float convex(vec2 uv){
  float edge=uMaps.x==0.0?0.0:texture(uEdge,uv).r;
  if(uMaps.x==1.0)edge=(edge-.5)*2.0;
  if(uMaps.y==1.0)edge=max(edge,(texture(uAnchor,uv).r-.5)*2.0);
  return clamp(edge,0.0,1.0);
}
vec3 woodCoordinates(vec3 p, bool world){
  if(!world){float c=uGrainTurn.x,s=uGrainTurn.y;return vec3(mat2(c,-s,s,c)*p.xy,0);}
  vec3 across=abs(uGrainAxis.y)>.5?vec3(0,0,1):vec3(0,1,0);
  return vec3(dot(p,uGrainAxis),dot(p,across),dot(p,cross(uGrainAxis,across)));
}
float woodScan(vec2 p){
  float c=cos(uScan.z),s=sin(uScan.z);
  // The bundled wood scans run vertically. Match the scan's fibres to the grain axis.
  float v=texture(uGrainScan,fract(mat2(c,-s,s,c)*p.yx*uScan.y)).r;
  return uScan.w>.5?1.0-v:v;
}

void main(){
  vec2 uv=gl_FragCoord.xy/uSz;
  bool world=uWorld==1&&uHasPos==1&&texelFetch(uPos,ivec2(gl_FragCoord.xy),0).a>.5;
  vec3 q=surfQ(uv),p=woodCoordinates(q,world);
  vec3 n=world?normalize(mat3(uInv)*surfN()):vec3(0,0,1);
  float endGrain=world?smoothstep(.58,.93,abs(dot(n,uGrainAxis))):0.0;
  float bend=vn(p*vec3(2.4,4.8,4.8)+11.2)-.5;
  float edge=convex(uv);
  float cutoff=mix(.44,.105,uWear.x)*mix(1.24,.68,uWear.y);
  if(uShape.y>0.0){
    if(world)cutoff=max(.02,cutoff+(vn(q*uShape.z)-.5)*uShape.y*.25);
    else{
      vec3 d=vec3(uv*uShape.z,0);
      vec2 offset=vec2(vn(d+5.4),vn(d+17.2))-.5;
      edge=convex(uv+offset*uShape.y*.045);
    }
  }
  float freq=uFibre.y;
  vec3 grain=p*freq*vec3(.24,1.75,1.75);
  grain.y+=bend*1.75;grain.z+=bend*1.35;
  float bands=vn(grain),fibre=vn(grain*vec3(.82,2.3,2.3)+7.7);
  float rings=cos((length(p.yz-vec2(-.24,.5))+bend*.025)*freq*2.8)*.5+.5;
  float streak=mix(bands*.72+fibre*.28,rings,endGrain*.73);
  if(uMaps.w==1.0){
    float scan=woodScan(p.xy);
    if(world){
      vec3 crossNormal=abs(woodCoordinates(n,true));
      scan=mix(scan,woodScan(p.xz),crossNormal.y/max(.001,crossNormal.y+crossNormal.z));
    }
    streak=mix(streak,scan,uScan.x*(1.0-endGrain*.7));
  }
  float textureGate=mix(1.0,mix(.18,1.0,smoothstep(.2,.8,streak)),uFibre.x);
  float edgeSignal=edge*uWear.z;
  float width=.34/max(.3,uWear.w);
  float wear=smoothstep(cutoff,cutoff+width,edgeSignal)*textureGate;
  // Long tapered fibre losses reach off the band but still need nearby convex curvature.
  vec3 sp=p*freq*vec3(.27/uFibre.w,1.9,1.9);
  sp.y+=bend*1.1;sp.z+=bend*.8;
  float lanes=smoothstep(.57,.84,vn(sp+31.1));
  float tips=smoothstep(.31,.78,vn(sp*vec3(.72,2.2,2.2)+5.3));
  float split=lanes*tips*(.32+.68*streak)*uFibre.z*(1.0-endGrain*.92);
  split*=smoothstep(cutoff*.14,cutoff+width*.22,edgeSignal);
  float cavity=uMaps.z==1.0?texture(uAO,uv).r:1.0;
  float v=(uOutput==1?wear:uOutput==2?split:max(wear,split))*mix(1.0,smoothstep(.12,.84,cavity),uShape.x);
  v=clamp(v*min(1.0,uWear.x*2.0),0.0,1.0);
  o=vec4(vec3(uInvert==1?1.0-v:v),1);
}`;

let msWoodProgram=null;
function msWoodRender(r,ctx,dst,{curv,edgeMap,ao,anchor,distort}){
  const p={...msWoodDefaults(),...r.p};
  if(!msWoodProgram)msWoodProgram=program(FS_MSWOOD);
  const presetScan=MS_WOOD_SCANS.find(scan=>scan.id===p.woodScan);
  const scan=p.woodScanAmount>0&&(p.woodImg||presetScan)?msGrungeTex(p,'woodImg',p.woodImg||presetScan):null;
  const a=p.woodAngle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const axis=p.woodAxis==='up'?[0,1,0]:p.woodAxis==='z'?[0,0,1]:[1,0,0];
  withUVWrap(p.uvWrap!==false,[curv,anchor,ao],()=>run(msWoodProgram,dst,{
    ...msPx(r,ctx),uEdge:curv?.tex||dummy,uAnchor:anchor?.tex||dummy,uAO:ao?.tex||dummy,uGrainScan:scan?.tex||dummy,
    uMaps:[curv?(edgeMap?2:1):0,anchor?1:0,ao?1:0,scan?1:0],uWear:[p.amount,p.width,p.edgeStrength,p.contrast],
    uShape:[p.cavityProtection,distort,p.edgeDistortScale],uFibre:[p.woodGrain,p.woodFrequency,p.woodSplinters,Math.max(.2,p.woodLength)],
    uScan:[p.woodScanAmount,p.woodScanTile,(p.woodScanAngle||0)*Math.PI/180,p.woodScanInvert?1:0],
    uGrainAxis:axis,uGrainTurn:[c,s],uInvert:{int:p.inv?1:0},uSeed:p.seed||1,
    uOutput:{int:Math.max(0,MS_WOOD_OUTPUTS.findIndex(([key])=>key===p.woodOutput))}
  }));
}

function msWoodControls(box,L,r,p,ed,S,sel,inv){
  const style=sel('ms_woodStyle','Wood wear preset',MS_WOOD_STYLES.map(([id,label])=>[id,label]),'woodStyle');
  style.querySelector('select').onchange=e=>{
    const preset=MS_WOOD_STYLES.find(([id])=>id===e.target.value);
    if(!preset)return;
    msCommit();ed(x=>Object.assign(x.p,preset[2],{woodStyle:preset[0]}));msCommit();renderMatEd(true);
  };
  const angle=v=>Math.round(v)+'°';
  const scan=sel('ms_woodScan','Wood scan',[['','Procedural grain'],...MS_WOOD_SCANS.map(({id,name})=>[id,name])],'woodScan');
  scan.querySelector('select').addEventListener('change',()=>renderMatEd(true));
  const g=grungeSlot({id:'msWoodGrainSlot',title:'Custom wood grain',ref:p.woodImg,empty:'Use the wood scan above',
    set:ref=>{ed(x=>{x.p.woodImg=ref?{kind:ref.kind,id:ref.id,name:ref.name}:null;});renderMatEd(true);},
    inv:{on:!!p.woodScanInvert,set:on=>ed(x=>{x.p.woodScanInvert=on;})}});
  const world=pxfRowMode(r)==='world'&&(ui.mode==='p3d'||v3.on&&v3.mesh);
  box.append(style,sel('ms_woodOutput','Output',MS_WOOD_OUTPUTS,'woodOutput'),
    S('ms_amt','Wear amount','amount',0,1,.01,pct),S('ms_w','Edge width','width',0,1,.01,pct),
    S('ms_edgeStrength','Edge strength','edgeStrength',0,2,.01,pct),S('ms_edgeGrow','Edge growth','edgeGrow',0,1,.01,pct),
    S('ms_dist','Edge distortion','distort',0,1,.01,pct),S('ms_edgeDistortScale','Edge distortion scale','edgeDistortScale',1,32,.5),
    S('ms_cavityProtection','Cavity protection','cavityProtection',0,1,.01,pct),S('ms_con','Contrast','contrast',.3,6,.05),
    el('div',{class:'sub',text:'Wood grain'}),world
      ?sel('ms_woodAxis','Grain axis',[['x','X'],['up','Y'],['z','Z']],'woodAxis')
      :S('ms_woodAngle','Grain angle','woodAngle',-180,180,1,angle),
    S('ms_woodGrain','Grain breakup','woodGrain',0,1,.01,pct),S('ms_woodFrequency','Grain frequency','woodFrequency',2,100,1),
    S('ms_woodSplinters','Splinter amount','woodSplinters',0,1,.01,pct),S('ms_woodLength','Splinter length','woodLength',.25,3,.05,v=>v.toFixed(2)+'×'),
    scan,g,...(p.woodScan||p.woodImg?[
      S('ms_woodScanAmount','Scan influence','woodScanAmount',0,1,.01,pct),S('ms_woodScanTile','Scan tiling','woodScanTile',.25,16,.05,v=>v.toFixed(2)+'×'),
      S('ms_woodScanAngle','Scan rotation','woodScanAngle',-180,180,1,angle,0)
    ]:[]),S('ms_seed','Seed','seed',1,99,1),inv(),
    sel('ms_ganc','Also follow anchor',[['','None'],...msAnchorNames().map(name=>[name,name])],'anchor'),
    pxfBox(L,r,[['world','World (no seams)'],['uv','UV']]),
    el('p',{class:'note',text:'Use over bare wood to wear away a painted or varnished coat. Invert the mask on the coat so the worn areas reveal the wood underneath.'}));
}
