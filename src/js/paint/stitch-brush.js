/* One dab is one repeating stitch unit. The stroke buffer carries raised thread,
   recessed holes, and fiber shading into the existing multi-map paint workflow. */
const STITCH_PRESETS=[
  {name:'Lockstitch',detail:'Even, single-row topstitching',size:26,spacing:.78,thickness:.25},
  {name:'Double topstitch',detail:'Two parallel rows',size:30,spacing:.79,thickness:.23},
  {name:'Saddle stitch',detail:'Slanted stitches for leather',size:28,spacing:.81,thickness:.28},
  {name:'Cross stitch',detail:'Overlapping diagonal threads',size:32,spacing:.85,thickness:.26},
  {name:'Zigzag stitch',detail:'Alternating stitches across a seam',size:34,spacing:.69,thickness:.24},
  {name:'Chain stitch',detail:'Interlocking loops',size:34,spacing:.67,thickness:.25},
  {name:'Blanket stitch',detail:'Edge binding with perpendicular stitches',size:33,spacing:.72,thickness:.24},
  {name:'Herringbone stitch',detail:'Wide, staggered crossed diagonals',size:34,spacing:.78,thickness:.25},
  {name:'Ladder stitch',detail:'Short rungs between two rows',size:34,spacing:.77,thickness:.22},
  {name:'Baseball stitch',detail:'Paired red lacing over a leather join',size:32,spacing:.51,thickness:.24,seam:.72,color:[.70,.08,.12]},
  {name:'Flat-felled seam',detail:'Two rows along a folded fabric edge',size:33,spacing:.75,thickness:.22,seam:.65},
  {name:'Overlock seam',detail:'Dense loops wrapping a fabric edge',size:36,spacing:.34,thickness:.17,seam:.57},
  {name:'Whipstitch seam',detail:'Slanted thread wrapped over a join',size:33,spacing:.46,thickness:.25,seam:.52},
  {name:'Piping',detail:'Raised welt cord with optional topstitching',size:32,spacing:.68,thickness:.20,seam:.82},
  {name:'Bar tack',detail:'Dense reinforcement for pockets and straps',size:54,spacing:1,thickness:.22,stamp:true},
  {name:'Buttonhole',detail:'Straight stitched opening',size:62,spacing:1,thickness:.21,seam:.75,stamp:true},
  {name:'Darning repair',detail:'Woven repair with uneven thread ends',size:70,spacing:1,thickness:.22,stamp:true},
  {name:'Keyhole buttonhole',detail:'Rounded eye and stitched slit',size:62,spacing:1,thickness:.21,seam:.75,stamp:true},
  {name:'Centered puckered piping',detail:'Center stitching with gathered fabric on both sides',size:40,spacing:.70,
    thickness:.22,seam:.70,pucker:.68,puckerWidth:1.06}
];
const stitchWearDefaults={damage:0,fray:0,variation:0,seed:1};
const stitchOptions={style:0,size:26,spacing:.78,length:1,thickness:.25,relief:.68,holes:.72,
  twist:.80,roughness:.55,pucker:0,puckerWidth:.62,seam:0,pipeStitch:true,...stitchWearDefaults};
const stitchMapKeys=()=>doc.workflow==='spec'?['base','height','gloss']:['base','height','rough','metal'];
const stitchSeamAmount=v=>STITCH_PRESETS[v.style]?.seam?v.seam??STITCH_PRESETS[v.style].seam:0;

const STITCH_PROFILE=`
struct StitchSample { float thread; float hole; float fiber; float crown; };
struct StitchWear { vec2 shift; float angle; float length; float thickness; float lift; float damage; float fray; float phase; };
float stitchAA;
uint stitchHash(uint n){
  n=(n^(n>>16u))*0x7feb352du;
  n=(n^(n>>15u))*0x846ca68bu;
  return n^(n>>16u);
}
float stitchRandom(uint n){return float(stitchHash(n)&65535u)/65536.0;}
StitchWear stitchWear(int index,int seed,vec3 controls,float phase){
  StitchWear w=StitchWear(vec2(0),0.0,1.0,1.0,1.0,0.0,0.0,phase);
  if(all(equal(controls,vec3(0))))return w;
  uint key=stitchHash(uint(seed)+0x9e3779b9u*uint(index));
  float jitter=controls.z;
  w.shift=vec2(stitchRandom(key+1u)-.5,stitchRandom(key+2u)-.5)*vec2(.24,.32)*jitter;
  w.angle=(stitchRandom(key+3u)-.5)*.42*jitter;
  w.length=1.0+(stitchRandom(key+4u)-.5)*.34*jitter;
  w.thickness=1.0+(stitchRandom(key+5u)-.5)*.42*jitter;
  w.lift=1.0-.25*stitchRandom(key+6u)*jitter;
  w.phase=fract(phase+stitchRandom(key+7u)*jitter);
  float wear=stitchRandom(key+8u);
  if(wear<.83*controls.x)w.damage=wear<.22*controls.x?2.0:1.0;
  w.fray=controls.y*(.28+.72*stitchRandom(key+9u));
  return w;
}
vec2 stitchWearPoint(vec2 p,StitchWear w){
  p-=w.shift;
  float c=cos(w.angle),s=sin(w.angle);
  return vec2(c*p.x+s*p.y,-s*p.x+c*p.y);
}
void stitchStrand(inout StitchSample m,vec2 p,vec2 a,vec2 b,float thickness,float twist,float lift,float phase,float bend){
  vec2 axis=b-a;
  float span=length(axis);
  vec2 along=axis/span,across=vec2(-along.y,along.x);
  float t=clamp(dot(p-a,along)/span,0.0,1.0);
  float ends=sin(t*3.14159265);
  vec2 center=mix(a,b,t)+across*(bend*ends);
  float side=dot(p-center,across);
  float radius=thickness*mix(.68,1.0,smoothstep(0.0,.32,ends));
  float ply=cos(6.2831853*(t*4.8+side/thickness*.68+phase));
  float resolved=1.0-smoothstep(.025,.105,stitchAA);
  radius*=1.0+.09*twist*ply*resolved;
  float d=length(p-center);
  float cover=1.0-smoothstep(max(0.0,radius-stitchAA),radius+stitchAA,d);
  float crown=sqrt(max(0.0,1.0-pow(d/max(radius,1e-4),2.0)));
  float height=cover*crown*lift*mix(.30,1.0,smoothstep(0.0,.70,ends))*(1.0+.16*twist*ply*resolved);
  if(cover>m.thread||height>m.crown){
    float filament=cos(6.2831853*(side/thickness*2.2+.16*ply));
    m.fiber=cover*clamp(.61+twist*resolved*(.24*ply+.11*filament),.15,1.0);
  }
  m.thread=max(m.thread,cover);
  m.crown=max(m.crown,height);
}
void stitchLooseFibers(inout StitchSample m,vec2 p,vec2 a,vec2 b,float r,float amount,float phase,float bend){
  if(amount<=0.0)return;
  vec2 delta=b-a;
  float span=length(delta);
  vec2 axis=delta/max(span,.001),side=vec2(-axis.y,axis.x);
  for(int i=0;i<3;i++){
    float f=float(i);
    float n=fract(phase+f*.618034);
    float signSide=abs(bend)>.09?sign(bend):(n<.5?-1.0:1.0);
    float origin=.16+.35*f;
    vec2 root=mix(a,b,origin)+side*(bend*sin(origin*3.14159265)+signSide*r*.50);
    float reach=(.12+.23*amount)*(.60+.55*n);
    vec2 end=root+axis*reach*(i==1?-1.0:1.0)+side*signSide*(r+reach*(.72+.22*n));
    vec2 fiber=end-root;
    float t=clamp(dot(p-root,fiber)/dot(fiber,fiber),0.0,1.0);
    vec2 center=mix(root,end,t)+side*signSide*(reach*.24*sin(t*3.14159265));
    float width=r*mix(.34,.10,t)*(.78+.42*n);
    float edge=max(width,stitchAA*.72);
    float antialias=1.0-smoothstep(max(0.0,edge-stitchAA),edge+stitchAA,length(p-center));
    float coverage=antialias*min(1.0,width/edge)*amount*(1.0-.55*t);
    if(coverage>m.thread)m.fiber=coverage*(.47+.23*n);
    m.thread=max(m.thread,coverage);
    m.crown=max(m.crown,coverage*(.24-.14*t));
  }
}
void stitchWornStrand(inout StitchSample m,vec2 p,vec2 a,vec2 b,float r,float twist,float lift,float phase,float bend,StitchWear w){
  if(w.damage>1.5)return;
  float margin=r+abs(bend)+stitchAA+w.fray*.54;
  if(any(lessThan(p,min(a,b)-margin))||any(greaterThan(p,max(a,b)+margin)))return;
  if(w.damage>.5){
    float cut=.28+.43*fract(phase+.31);
    vec2 dir=b-a,side=normalize(vec2(-dir.y,dir.x));
    vec2 left=mix(a,b,cut-.12)+side*bend*sin((cut-.12)*3.14159265);
    vec2 right=mix(a,b,cut+.13)+side*bend*sin((cut+.13)*3.14159265);
    stitchStrand(m,p,a,left,r*.83,twist,lift*.74,phase,bend*.25);
    stitchStrand(m,p,right,b,r*.88,twist,lift*.72,phase+.27,bend*.25);
    stitchLooseFibers(m,p,a,left,r,w.fray,phase,bend*.25);
    stitchLooseFibers(m,p,right,b,r,w.fray,phase+.47,bend*.25);
    return;
  }
  stitchStrand(m,p,a,b,r,twist,lift,phase,bend);
  stitchLooseFibers(m,p,a,b,r,w.fray,phase,bend);
}
void stitchHole(inout StitchSample m,vec2 p,vec2 center,float size,float strength){
  vec2 q=(p-center)/vec2(1.16,.84);
  float r=length(q)/max(size,.001);
  m.hole=max(m.hole,strength*(1.0-smoothstep(.15,1.15,r)));
}
void stitchSeamThreads(inout StitchSample m,vec2 p,int style,float span,float r,float holes,float twist,float lift,StitchWear w){
  float phase=w.phase;
  if(style==9){
    vec2 left=vec2(-.29*span,-.53),right=vec2(-.29*span,.53);
    vec2 inner=vec2(.23*span,.035);
    stitchWornStrand(m,p,left,inner,r,twist,lift,phase,.12,w);
    stitchWornStrand(m,p,right,vec2(.31*span,-.025),r,twist,lift*.88,phase+.45,-.12,w);
    stitchHole(m,p,left,r*1.85,holes);
    stitchHole(m,p,right,r*1.85,holes);
  }else if(style==10){
    for(int i=0;i<2;i++){
      float row=i==0?-.42:.30;
      vec2 a=vec2(-.57*span,row),b=vec2(.57*span,row);
      stitchWornStrand(m,p,a,b,r,twist,lift,phase+float(i)*.36,0.0,w);
      stitchHole(m,p,a,r*1.67,holes);
      stitchHole(m,p,b,r*1.67,holes);
    }
  }else if(style==11){
    vec2 a=vec2(-.27*span,-.50),b=vec2(.27*span,.32);
    stitchWornStrand(m,p,a,b,r,twist,lift,phase,.075,w);
    stitchWornStrand(m,p,b,vec2(.35*span,-.48),r*.82,twist,lift*.78,phase+.44,-.10,w);
    stitchWornStrand(m,p,a,vec2(.36*span,-.48),r*.77,twist,lift*.65,phase+.72,0.0,w);
    stitchHole(m,p,b,r*1.65,holes);
  }else if(style==12){
    vec2 a=vec2(-.36*span,-.50),b=vec2(.36*span,.48);
    stitchWornStrand(m,p,a,b,r,twist,lift,phase,.12,w);
    stitchHole(m,p,a,r*1.66,holes);
    stitchHole(m,p,b,r*1.66,holes);
  }else{
    float row=style==18?0.0:-.47;
    vec2 a=vec2(-.48*span,row),b=vec2(.48*span,row);
    stitchWornStrand(m,p,a,b,r,twist,lift,phase,0.0,w);
    stitchHole(m,p,a,r*1.65,holes);
    stitchHole(m,p,b,r*1.65,holes);
  }
}
vec2 stitchButtonholeEdge(float t,bool keyhole){
  vec2 edge=vec2(.61*cos(t),.185*sin(t));
  if(keyhole)edge.y*=1.0+.66*smoothstep(.07,.56,edge.x);
  return edge;
}
void stitchStampThreads(inout StitchSample m,vec2 p,int style,float r,float twist,float lift,StitchWear w){
  if(style==14){
    for(int i=0;i<12;i++){
      float x=-.62+float(i)*.11;
      stitchWornStrand(m,p,vec2(x-.045,-.23),vec2(x+.045,.23),r*.61,twist,lift,w.phase+float(i)*.14,.032,w);
    }
  }else if(style==16){
    for(int i=0;i<9;i++){
      float y=(float(i)-4.0)*.116;
      float ends=.54+.13*sin(float(i)*2.77);
      stitchWornStrand(m,p,vec2(-ends,y),vec2(ends-.10*cos(float(i)*4.0),y+.025),r*.59,twist,lift*.67,w.phase+float(i)*.17,.024,w);
    }
    for(int i=0;i<9;i++){
      float x=(float(i)-4.0)*.121;
      for(int j=0;j<5;j++){
        float y=-.49+float(j)*.195+float(i%2)*.081;
        stitchWornStrand(m,p,vec2(x,y),vec2(x+.021,y+.156),r*.52,twist,lift,w.phase+float(i+j)*.27,.016,w);
      }
    }
  }else{
    for(int i=0;i<25;i++){
      float t=float(i)*6.2831853/25.0;
      vec2 edge=stitchButtonholeEdge(t,style==17);
      vec2 outward=normalize(vec2(.39*cos(t),sin(t)));
      stitchWornStrand(m,p,edge-outward*.025,edge+outward*.132,r*.60,twist,lift,w.phase+float(i)*.24,.015,w);
    }
  }
}
StitchSample stitchProfile(vec2 p,int style,float thickness,float holes,float twist,float stitchLength,StitchWear w){
  StitchSample m=StitchSample(0.0,0.0,0.0,0.0);
  float r=thickness*.44*w.thickness;
  float phase=w.phase;
  stitchLength*=w.length;
  float lift=(.94+.06*cos(phase*6.2831853))*w.lift;
  if(style>=14&&style<=17){
    stitchStampThreads(m,vec2(p.x/stitchLength,p.y),style,r,twist,lift,w);
    return m;
  }
  if(style>=9){
    stitchSeamThreads(m,p,style,stitchLength,r,holes,twist,lift,w);
    m.hole*=1.0-.94*m.thread;
    return m;
  }
  if(style>=5){
    float halfLength=(style==5?.72:style==6?.72:style==7?.76:.77)*stitchLength;
    vec2 a=vec2(-halfLength,0),b=vec2(halfLength,0);
    if(style==5){
      stitchWornStrand(m,p,a,b,r,twist,lift,phase,.27,w);
      stitchWornStrand(m,p,a,b,r,twist,lift*.85,phase+.43,-.27,w);
      stitchHole(m,p,a,r*1.5,holes);
      stitchHole(m,p,b,r*1.5,holes);
    }else if(style==6){
      a.y=-.36;b.y=-.36;
      vec2 top=vec2(-.38*stitchLength,.44);
      vec2 base=vec2(-.38*stitchLength,-.36);
      stitchWornStrand(m,p,top,base,r,twist,lift,phase,.055,w);
      stitchWornStrand(m,p,a,b,r,twist,lift*.83,phase+.43,0.0,w);
      stitchHole(m,p,top,r*1.78,holes);
      stitchHole(m,p,base,r*1.55,holes);
    }else if(style==7){
      vec2 low=vec2(-.60*stitchLength,-.49),high=vec2(halfLength,.49);
      vec2 up=vec2(.11*stitchLength,.49),down=vec2(halfLength,-.49);
      stitchWornStrand(m,p,low,high,r,twist,lift,phase,0.0,w);
      stitchWornStrand(m,p,up,down,r,twist,lift*.82,phase+.43,0.0,w);
      stitchHole(m,p,low,r*1.67,holes);stitchHole(m,p,high,r*1.67,holes);
      stitchHole(m,p,up,r*1.67,holes);stitchHole(m,p,down,r*1.67,holes);
    }else{
      vec2 low=vec2(0,-.41),high=vec2(0,.41);
      stitchWornStrand(m,p,low,high,r,twist,lift,phase,.025,w);
      stitchWornStrand(m,p,a+low,b+low,r*.76,twist,lift*.66,phase+.21,0.0,w);
      stitchWornStrand(m,p,a+high,b+high,r*.76,twist,lift*.66,phase+.62,0.0,w);
      stitchHole(m,p,low,r*1.7,holes);stitchHole(m,p,high,r*1.7,holes);
    }
    m.hole*=1.0-.94*m.thread;
    return m;
  }
  vec2 a=vec2(-.60,0.0),b=vec2(.60,0.0);
  if(style==1){a.y=-.34;b.y=-.34;}
  if(style==2){a=vec2(-.63,-.13);b=vec2(.63,.13);}
  if(style==3){a=vec2(-.61,-.43);b=vec2(.61,.43);}
  if(style==4){a=vec2(-.69,-.46);b=vec2(0.0,.46);}
  a.x*=stitchLength;b.x*=stitchLength;
  stitchWornStrand(m,p,a,b,r,twist,(style==3?.68:1.0)*lift,phase,0.0,w);
  stitchHole(m,p,a,r*1.82,holes);
  stitchHole(m,p,b,r*1.82,holes);
  if(style==1||style==3||style==4){
    if(style==1){a.y=.34;b.y=.34;}
    if(style==3){a.y=-a.y;b.y=-b.y;}
    if(style==4){a=b;b=vec2(.69*stitchLength,-.46);}
    stitchWornStrand(m,p,a,b,r,twist,lift,phase+.43,0.0,w);
    stitchHole(m,p,a,r*1.82,holes);
    stitchHole(m,p,b,r*1.82,holes);
  }
  m.hole*=1.0-.94*m.thread;
  return m;
}
float stitchPucker(vec2 q,float width,float phase,float stitchLength,float spacing){
  float anchor=.61*stitchLength;
  float side=abs(q.y);
  float fan=abs(q.x+.24*q.y+(.12*sin(phase*6.2831853))*side);
  float ends=exp(-pow((fan-anchor)/.16,2.0));
  float valley=exp(-pow((fan-anchor+.22)/.15,2.0));
  float envelope=exp(-pow((side-.36*width)/(.46*width),2.0))*
    smoothstep(.06,.19,side)*(1.0-smoothstep(spacing*.86,spacing,abs(q.x)))*
    (1.0-smoothstep(.98,1.40,side));
  return envelope*(.68*ends-.46*valley);
}
float stitchSeamRelief(vec2 p,int style){
  float y=p.y;
  if(style==9){
    float side=abs(y);
    float lip=exp(-pow((side-.16)/.16,2.0));
    return .31*lip-.72*exp(-pow(side/.095,2.0));
  }
  if(style==10){
    float fold=smoothstep(-.86,-.34,y)*(1.0-smoothstep(.34,.55,y));
    return .54*fold-.15*exp(-pow((y-.57)/.10,2.0));
  }
  if(style==11)return .46*exp(-pow((y+.45)/.28,2.0))-.18*exp(-pow((y-.30)/.12,2.0));
  if(style==13||style==18){
    float center=style==18?0.0:.13;
    float width=style==18?.30:.39;
    float cord=max(0.0,1.0-pow((y-center)/width,2.0));
    float edge=style==18?abs(y)-width:y+.29;
    return .73*pow(cord,.82)-.19*exp(-pow(edge/.10,2.0));
  }
  if(style==15||style==17){
    float x=max(abs(p.x)-.45,0.0);
    float slit=exp(-pow(length(vec2(x,p.y))/.093,2.0));
    float eye=style==17?exp(-pow(length(p-vec2(.43,0.0))/.19,2.0)):0.0;
    return -.86*max(slit,eye);
  }
  return .27*exp(-pow((abs(y)-.20)/.22,2.0))-.40*exp(-pow(y/.12,2.0));
}
vec4 stitchSurfaceRelief(vec2 p,vec2 q,int style,StitchWear w,float length,float spacing,vec3 surface){
  float fold=stitchPucker(q,surface.y,w.phase,length*w.length,spacing)*surface.x;
  if(style==18)fold*=smoothstep(.17,.44,abs(p.y));
  if(style==15||style==17)p=vec2(q.x/(length*w.length),q.y);
  float band=surface.z>0.0?stitchSeamRelief(p,style)*surface.z:0.0;
  band*=1.0-smoothstep(spacing,spacing*1.30,abs(p.x));
  return vec4(max(fold,0.0),max(-fold,0.0),max(band,0.0),max(-band,0.0));
}`;

const FS_STITCH_DAB=STITCH_PROFILE+`
uniform vec2 uCenter, uFlip;
uniform float uRadius, uAngle, uRound, uThickness, uHoles, uTwist, uAlpha, uPhase;
uniform float uLength, uSpacing, uFoldPass;
uniform vec3 uSurface;
uniform bool uPipeStitch;
uniform vec3 uWear;
uniform int uStyle,uSeed,uIndex;
void main(){
  vec2 d=(gl_FragCoord.xy-uCenter)/uRadius;
  float c=cos(uAngle),s=sin(uAngle);
  vec2 q=vec2(c*d.x+s*d.y,-s*d.x+c*d.y)*uFlip;
  q.y/=max(uRound,.02);
  stitchAA=clamp(.65/uRadius,.005,.13);
  StitchWear w=stitchWear(uIndex,uSeed,uWear,uPhase);
  vec2 local=stitchWearPoint(q,w);
  if(uFoldPass>0.0){
    o=stitchSurfaceRelief(q,local,uStyle,w,uLength,uSpacing,uSurface)*uAlpha;
    return;
  }
  if((uStyle==13||uStyle==18)&&!uPipeStitch){o=vec4(0);return;}
  StitchSample m=stitchProfile(local,uStyle,uThickness,uHoles,uTwist,uLength,w);
  o=vec4(m.thread,m.hole,m.fiber,m.crown)*uAlpha;
}`;

const STITCH_CHANNEL=`
uniform int uStitchMap;
uniform vec3 uThreadColor;
uniform float uThreadRelief, uThreadRoughness;
uniform sampler2D uStitchFolds;
uniform bool uHasStitchFolds;
float stitchChannel(vec4 st,ivec2 p){
  float thread=st.r, hole=st.g;
  float fiber=st.b/max(thread,1e-5);
  if(uStitchMap==1){
    vec4 folds=uHasStitchFolds?texelFetch(uStitchFolds,p,0):vec4(0);
    float coverage=max(max(thread,hole),max(max(folds.r,folds.g),max(folds.b,folds.a)));
    gSC=vec3(clamp(.5+(uThreadRelief*(.32*st.a-.22*hole)+
      (.52*(folds.r-folds.g)+.58*(folds.b-folds.a))*(1.0-thread))/max(coverage,1e-5),0.0,1.0));
    return coverage;
  }
  if(uStitchMap==2){
    gSC=vec3(clamp(uThreadRoughness+.20*(.58-fiber),.10,.98));
    return thread;
  }
  if(uStitchMap==3){
    gSC=vec3(1.0-clamp(uThreadRoughness+.20*(.58-fiber),.10,.98));
    return thread;
  }
  if(uStitchMap==4){
    gSC=vec3(0.0);
    return thread;
  }
  if(uStitchMap<0){gSC=vec3(0);return 0.0;}
  float shade=clamp(.69+.49*fiber,.65,1.06);
  float coverage=max(thread,hole*.77);
  gSC=(uThreadColor*shade*thread+uThreadColor*.13*hole*.77*(1.0-thread))/max(coverage,1e-5);
  return coverage;
}`;

let stitchDabProgram=null,stitchPreviewProgram=null,stitchMergeProgram=null,stitchCompProgram=null;
function stitchStrokeProgram(comp){
  const existing=comp?stitchCompProgram:stitchMergeProgram;
  if(existing)return existing;
  const source=(comp?FS_COMP:FS_MERGE).replace('gSC=uStrokeTint==1?st.rgb:uStrokeColor;',
    'st.a=stitchChannel(st,p);');
  const p=program(source.replace('void main(){',STITCH_CHANNEL+'\nvoid main(){'));
  p.defaults=Object.assign({},comp?P.comp.defaults:P.merge.defaults);
  if(comp)stitchCompProgram=p;
  else stitchMergeProgram=p;
  return p;
}

function stitchStrokeUniforms(s,k){
  const v=s.o.material.stitch;
  return {uStitchMap:{int:{base:0,height:1,rough:2,gloss:3,metal:4}[k]??-1},
    uThreadColor:s.o.color,uThreadRelief:v.relief,uThreadRoughness:v.roughness,
    uHasStitchFolds:!!s.stitchFolds,uStitchFolds:s.stitchFolds?.uv.tex||dummy};
}

function stitchFoldsBegin(s){
  const uv=acquireD(8);
  clearTarget(uv);
  s.stitchFolds={uv,screen:s.space?.mesh?makeTarget(s.SW,s.SH,8,false):null};
}
function stitchFoldsRelease(s){
  if(!s?.stitchFolds)return;
  release(s.stitchFolds.uv);
  disposeTarget(s.stitchFolds.screen);
}

function stitchWearUniforms(settings){
  return {uWear:[settings.damage??0,settings.fray??0,settings.variation??0],uSeed:{int:settings.seed??1}};
}
function stitchSurfaceUniforms(v){
  return {uSurface:[v.pucker,v.puckerWidth,stitchSeamAmount(v)],uPipeStitch:v.pipeStitch!==false};
}
function stitchHasRelief(v){return !!v&&(v.pucker>0||stitchSeamAmount(v)>0);}
function stitchStamp(s,dst,U,copies,alpha){
  if(!stitchDabProgram)stitchDabProgram=program(FS_STITCH_DAB,VS_STAMP);
  const v=s.o.material.stitch;
  for(const [x,y] of copies){
    const uniforms={uCenter:[x,y],uRadius:U.uRadius,uExtent:U.uExtent,uSize:U.uSize,
      uAngle:U.uAngle,uRound:U.uRound,uFlip:U.uFlip,uThickness:v.thickness,uHoles:v.holes,
      uTwist:v.twist,uStyle:{int:v.style},uLength:v.length,
      ...stitchWearUniforms(v),...stitchSurfaceUniforms(v),uIndex:{int:(s.stitchDabs||1)-1},
      uSpacing:s.o.spacing,uPhase:((s.stitchDabs||0)*.381966)%1,uAlpha:alpha};
    run(stitchDabProgram,dst,{...uniforms,uFoldPass:0},{blend:'max'});
    if(s.stitchFolds)run(stitchDabProgram,s.stitchFolds.screen||s.stitchFolds.uv,
      {...uniforms,uFoldPass:1},{blend:'max'});
  }
}

function stitchSelect(index,recipe){
  if(stroke||preview||selLive)return;
  const preset=STITCH_PRESETS[index];
  if(recipe){
    Object.assign(stitchOptions,stitchPresetSettings(index),stitchWearDefaults,{pipeStitch:true},recipe);
    setFG(recipe.color);
  }else if(stitchOptions.style!==index||!materialBrush.rec?.stitch){
    Object.assign(stitchOptions,stitchPresetSettings(index));
    if(preset.color)setFG(preset.color);
  }
  if(doc.map!=='base')setEditMap('base');
  materialBrush.rec={name:preset.name,stitch:true,fill:{maps:{}}};
  materialBrush.loading=false;
  applyPreset({name:preset.name,tool:'material',ownTool:true,size:stitchOptions.size,spacing:stitchOptions.spacing,
    followDir:!preset.stamp,pSize:false,pOpacity:false,smoothing:preset.stamp?0:.23});
  stitchToolsRender();
  if(ui.mode==='p3d')showPanel('tool');
}
function stitchPresetSettings(index){
  const {size,spacing,thickness,seam=0,pucker,puckerWidth}=STITCH_PRESETS[index];
  const settings={style:index,size,spacing,thickness,seam};
  if(pucker!==undefined)Object.assign(settings,{pucker,puckerWidth});
  return settings;
}

function stitchEnsureChannels(){
  const keys=stitchMapKeys();
  if(keys.some(k=>!doc.maps.includes(k)))setDocMaps([...doc.maps,...keys],'Add stitch channels');
}
/* (0.97.10, Kenn) stitches never add a layer: they go onto the paint layer you picked (or its mask) */
function stitchTarget(){
  if(sel.quick)return null;
  const n=doc.active;
  if(!toolPaintLayerOk(n,'sew stitches'))return null;
  stitchEnsureChannels();
  return n;
}

function stitchPaintOptions(o,et){
  if(!et){toast('Select a paint layer to sew stitches.');return null;}
  o.tool='brush';
  o.noTint=true;
  o.chan=null;
  if(et.isMask)return toolMaskOptions(o,{stitch:{...stitchOptions}},stitchOptions.style!==undefined&&STITCH_PRESETS[stitchOptions.style].stamp);
  o.material={stitch:{...stitchOptions}};
  o.singleDab=!!STITCH_PRESETS[stitchOptions.style].stamp;
  o.extras=stitchMapKeys().filter(k=>k!==doc.map&&doc.maps.includes(k)).map(key=>({key,mode:1,color:[0,0,0]}));
  return o;
}

const FS_STITCH_PATH=STITCH_PROFILE+`
in vec3 vP,vN;
uniform vec3 uA,uB,uNA,uNB;
uniform vec2 uRadius,uRun,uEnd;
uniform float uDepth,uPitch,uTotal,uThickness,uHoles,uTwist,uLength,uFoldPass;
uniform vec3 uWear,uSurface;
uniform bool uPipeStitch;
uniform int uStyle,uSeed,uRepeat;
void main(){
  vec3 ab=uB-uA;
  float span=length(ab);
  if(span<1e-6)discard;
  vec3 axis=ab/span;
  float along=dot(vP-uA,axis);
  float t=clamp(along/span,0.0,1.0);
  vec3 n=normalize(mix(uNA,uNB,t));
  vec3 q=vP-mix(uA,uB,t);
  if(abs(dot(q,n))>uDepth||dot(vN,n)<0.0)discard;
  vec3 side=cross(n,axis);
  if(dot(side,side)<1e-6)discard;
  float radius=max(mix(uRadius.x,uRadius.y,t),1e-6);
  float outside=along-t*span;
  if((outside<0.0&&uEnd.x<.5)||(outside>0.0&&uEnd.y<.5)){
    if(abs(outside)>.06*radius)discard;
  }
  float distance=mix(uRun.x,uRun.y,t)+outside;
  float stepIndex=floor(distance/uPitch);
  if(uTotal>0.0&&(stepIndex<0.0||(stepIndex+.5)*uPitch>uTotal))discard;
  vec2 p=vec2((distance-(stepIndex+.5)*uPitch)/radius,dot(q,normalize(side))/radius);
  int index=uRepeat>0?int(mod(stepIndex,float(uRepeat))):int(stepIndex);
  float phase=fract(float(index)*.381966);
  StitchWear w=stitchWear(index,uSeed,uWear,phase);
  vec2 local=stitchWearPoint(p,w);
  stitchAA=clamp(.64*max(fwidth(distance),fwidth(dot(q,normalize(side))))/radius,.005,.13);
  if(uFoldPass>0.0){
    o=stitchSurfaceRelief(p,local,uStyle,w,uLength,uPitch/(radius*2.0),uSurface);
  }else{
    if((uStyle==13||uStyle==18)&&!uPipeStitch){o=vec4(0);return;}
    StitchSample m=stitchProfile(local,uStyle,uThickness,uHoles,uTwist,uLength,w);
    o=vec4(m.thread,m.hole,m.fiber,m.crown);
  }
}`;
let stitchPathProgram=null,stitchPathMapProgram=null;
function stitchPathRender(L){
  if(!pathValid(L))return;
  if(!stitchPathProgram)stitchPathProgram=prog3(VS_3DPROJ,FS_STITCH_PATH);
  if(!stitchPathMapProgram)stitchPathMapProgram=program('vec3 gSC;\n'+STITCH_CHANNEL+`
uniform sampler2D uStitchData;
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  float a=stitchChannel(texelFetch(uStitchData,p,0),p);
  o=vec4(gSC*a,a);
}`);
  const P=L.path,v=P.stitch;
  const data=acquireD(8),folds=stitchHasRelief(v)?acquireD(8):null;
  try{
    clearTarget(data);if(folds)clearTarget(folds);
    if(!P.hidden&&P.mode==='stroke'&&P.points.length>=2){
      const points=pathSamples(P,true),distance=[0];
      for(let i=1;i<points.length;i++)distance.push(distance[i-1]+Math.hypot(...sub3d(points[i].p,points[i-1].p)));
      const total=distance.at(-1),spacing=Math.max(1e-6,P.width*v.spacing);
      if(total>0){
        const repeats=P.closed?Math.max(1,Math.round(total/spacing)):0;
        const pitch=repeats?total/repeats:Math.min(spacing,total);
        const uniforms={uStyle:{int:v.style},uPitch:pitch,uTotal:P.closed?-1:total,uLength:v.length,
          uThickness:v.thickness,uHoles:v.holes,uTwist:v.twist,
          ...stitchWearUniforms(v),...stitchSurfaceUniforms(v),uRepeat:{int:repeats}};
        for(const copy of pathMirrorSets(P,points)){
          pathSurfaceMask(L,copy,data,false,{program:stitchPathProgram,distance,uniforms:{...uniforms,uFoldPass:0}});
          if(folds)pathSurfaceMask(L,copy,folds,false,{program:stitchPathProgram,distance,uniforms:{...uniforms,uFoldPass:1}});
        }
      }
    }
    const s={o:{material:{stitch:v},color:v.color},stitchFolds:folds?{uv:folds}:null};
    for(const key of stitchMapKeys())if(doc.maps.includes(key))run(stitchPathMapProgram,ensureMapTarget(L,key),
      {...stitchStrokeUniforms(s,key),uStitchData:data.tex});
    L.opacity=P.opacity;
    changed(L);
  }finally{release(data);if(folds)release(folds);}
}
function stitchPathStart(){
  if(stroke||preview||selLive)return;
  if(!v3.mesh||v3.mesh.noUV){toast('Choose a model with UVs before drawing stitches.');return;}
  const active=ui.tool==='path'&&pathActive()?.path?.stitch;
  const settings=active?pathCopy(active):{...stitchOptions,color:ui.fg.slice()};
  if(STITCH_PRESETS[settings.style].stamp)return;
  pathFinish();
  setTool('path');
  pathNew('3d',settings);
  buildBrushPanel();stitchToolsRender();requestRender(true);
  toast('Click on the model to place stitch path points. Press Enter to finish.');
}
function stitchPathEdit(L,updates){
  if(!pathValid(L)||lockStop({node:L}))return;
  if(!L._pathBefore)L._pathBefore=pathSnap(L);
  const P=L.path;Object.assign(P.stitch,updates);
  if(updates.size!==undefined)P.width=(v3.mesh.radius||1)*updates.size/256;
  stitchPathRender(L);
  clearTimeout(L._pathTimer);
  L._pathTimer=setTimeout(()=>{const before=L._pathBefore;L._pathBefore=null;if(before)pathRecord(L,before,'Stitch settings');},350);
}

const FS_STITCH_CARD=STITCH_PROFILE+`
uniform vec2 uSize;
uniform int uStyle;
uniform float uThickness, uSpacing, uSeam, uPucker, uPuckerWidth;
uniform vec3 uCardColor;
StitchSample stitchCardSample(vec2 p){
  return stitchProfile(p,uStyle,uThickness,.72,.80,1.0,stitchWear(0,1,vec3(0),0.0));
}
float profile(vec2 p){
  StitchSample m=stitchCardSample(p);
  vec4 relief=stitchSurfaceRelief(p,p,uStyle,stitchWear(0,1,vec3(0),0.0),1.0,uSpacing,vec3(uPucker,uPuckerWidth,uSeam));
  return m.crown-.25*m.hole+(.52*(relief.r-relief.g)+.58*(relief.b-relief.a))*(1.0-m.thread);
}
void main(){
  stitchAA=.035;
  bool stamp=uStyle>=14&&uStyle<=17;
  vec2 p=(gl_FragCoord.xy-uSize*.5)/(stamp?34.0:15.0);
  if(!stamp)p.x=mod(p.x+uSpacing,uSpacing*2.0)-uSpacing;
  float h=profile(p);
  vec2 slope=vec2(profile(p+vec2(.05,0))-h,profile(p+vec2(0,.05))-h);
  vec3 n=normalize(vec3(-slope*5.5,1.0));
  float l=max(0.0,dot(n,normalize(vec3(-.45,.60,.80))));
  StitchSample m=stitchCardSample(p);
  vec3 fabric=vec3(.19,.22,.24)*(1.0-.65*m.hole)*mix(1.0,.55+.70*l,clamp(uSeam*1.7,0.0,1.0));
  vec3 thread=uCardColor*(.36+.49*l+.23*m.fiber);
  o=vec4(mix(fabric,thread,m.thread),1.0);
}`;
let stitchCards=null;
function stitchCardPixels(){
  if(stitchCards)return stitchCards;
  if(!stitchPreviewProgram)stitchPreviewProgram=program(FS_STITCH_CARD);
  const w=132,h=49,target=makeTarget(w,h,8,false);
  try{
    stitchCards=STITCH_PRESETS.map((preset,i)=>{
      run(stitchPreviewProgram,target,{uSize:[w,h],uStyle:{int:i},uThickness:preset.thickness,uSpacing:preset.spacing,
        uSeam:preset.seam??0,uPucker:preset.pucker??0,uPuckerWidth:preset.puckerWidth??.62,
        uCardColor:preset.color??[.84,.70,.49]});
      const pixels=captureRegionNow(target,0,0,w,h).data;
      const flipped=new Uint8ClampedArray(pixels.length);
      for(let y=0;y<h;y++)flipped.set(pixels.subarray(y*w*4,(y+1)*w*4),(h-1-y)*w*4);
      return new ImageData(flipped,w,h);
    });
  }finally{disposeTarget(target);}
  return stitchCards;
}

let stitchShelfPath=null;
function stitchPathLayer(){
  const L=ui.tool==='path'?pathActive():null;
  return L?.path?.stitch?L:null;
}
function stitchToolsRender(){
  const box=$('#stitchToolsBody');
  if(!box)return;
  const edit=stitchShelfPath=stitchPathLayer();
  const settings=edit?edit.path.stitch:stitchOptions;
  const pixels=stitchCardPixels();
  const tiles=STITCH_PRESETS.map((preset,i)=>{
    const c=el('canvas',{width:pixels[i].width,height:pixels[i].height,'aria-hidden':'true'});
    c.getContext('2d').putImageData(pixels[i],0,0);
    const selected=(edit||ui.tool==='material'&&materialBrush.rec?.stitch)&&settings.style===i;
    return el('button',{type:'button',class:'mattile weld-card','aria-label':preset.name,
      'aria-pressed':String(!!selected),onclick:()=>{
        if(edit&&settings.style!==i){
          if(preset.stamp){pathFinish();stitchSelect(i);return;}
          const updates=stitchPresetSettings(i);
          if(preset.color)updates.color=preset.color.slice();
          stitchPathEdit(edit,updates);stitchToolsRender();
        }
        else if(!edit)stitchSelect(i);
      }},c,el('span',{text:preset.name}),el('small',{text:preset.detail}));
  });
  const slider=(key,label,min,max,step,fmt=pct)=>makeSlider({id:'stitch-'+key,label,min,max,step,fmt,
    value:settings[key]??stitchWearDefaults[key]??stitchSeamAmount(settings),onInput:value=>{
      if(edit){stitchPathEdit(edit,{[key]:value});return;}
      stitchOptions[key]=value;
      if(materialBrush.rec?.stitch&&ui.tool==='material'&&(key==='size'||key==='spacing')){
        brush[key]=value;
        if(key==='size')refreshCursor();
        brushEdited(key);
      }
    }}).el;
  const color=colourBtn('stitch-color',()=>edit?settings.color:ui.fg,
    c=>edit?stitchPathEdit(edit,{color:c}):setFG(c),'Thread color');
  const randomize=el('button',{class:'btn',type:'button',text:'Shuffle variation',title:'Choose a new pattern for damage, fray and variation',onclick:()=>{
    const seed=1+((settings.seed??stitchWearDefaults.seed)+Math.floor(Math.random()*9998))%9999;
    if(edit)stitchPathEdit(edit,{seed});
    else stitchOptions.seed=seed;
    stitchToolsRender();
  }});
  const preset=STITCH_PRESETS[settings.style];
  const draw=preset.stamp?null:el('button',{class:'btn',type:'button',text:'Draw stitch path',onclick:stitchPathStart});
  const freehand=edit?el('button',{class:'btn',type:'button',text:'Paint freehand',onclick:()=>{
    pathFinish();stitchSelect(settings.style,settings);
  }}):null;
  box.replaceChildren(el('div',{class:'matgrid weld-grid'},...tiles));
  tsSet('stitch',el('div',{class:'weld-shelf'},el('div',{class:'weld-actions'},draw,freehand),
    el('div',{class:'weld-controls'},el('label',{class:'frow'},el('span',{text:'Thread color'}),color),
      slider('size','Stitch size',6,160,1,v=>v+' px'),preset.stamp?null:slider('spacing','Stitch spacing',.30,1.55,.01),
      slider('length','Stitch length',.45,1.22,.01),
      slider('thickness','Thread thickness',.10,.46,.01),slider('relief','Thread height',0,1,.01),
      slider('holes','Needle holes',0,1,.01),slider('twist','Fiber twist',0,1,.01),
      slider('roughness','Thread roughness',.15,.95,.01),slider('pucker','Puckering',0,1,.01),
      slider('puckerWidth','Pucker spread',.25,1.25,.01),
      preset.seam?slider('seam','Seam relief',0,1,.01):null,
      (settings.style===13||settings.style===18)?chk('stitch-pipeStitch','Piping topstitch',settings.pipeStitch!==false,v=>{
        if(edit)stitchPathEdit(edit,{pipeStitch:v});else stitchOptions.pipeStitch=v;
      }):null),
    el('div',{class:'sub',text:'Wear and variation'}),
    el('div',{class:'weld-controls'},
      slider('damage','Stitch damage',0,1,.01),slider('fray','Thread fray',0,1,.01),
      slider('variation','Stitch variation',0,1,.01),slider('seed','Random seed',1,9999,1,String)),
    el('div',{class:'weld-actions'},randomize)));
}
