/* Surface detail dabs store recessed relief, raised relief, and pigment coverage independently. */
const SURFACE_DETAILS=[
  {name:'Hammer dent',detail:'Shallow impact with a displaced rim',size:68,spacing:.89,depth:.72,paint:0,rough:.56,color:[.26,.24,.21]},
  {name:'Scored gouge',detail:'A torn groove with raised burrs',size:75,spacing:.29,depth:.80,paint:0,rough:.58,color:[.27,.23,.21],follow:true},
  {name:'Paint chips',detail:'Jagged flakes with exposed substrate color',size:65,spacing:.73,depth:.64,paint:.87,rough:.67,color:[.36,.32,.27]},
  {name:'Corrosion pits',detail:'Irregular clusters of recessed pinholes',size:73,spacing:.73,depth:.77,paint:.14,rough:.81,color:[.23,.18,.13]},
  {name:'Grime stipple',detail:'Dry, broken deposits with soft edges',size:96,spacing:.48,depth:.22,paint:.83,rough:.85,color:[.25,.22,.17]},
  {name:'Rust bloom',detail:'Coarse oxide islands with scattered edges',size:96,spacing:.58,depth:.45,paint:.85,rough:.90,color:[.50,.23,.10]},
  {name:'Cast metal',detail:'Raised granular texture for rough castings',size:90,spacing:.48,depth:.53,paint:0,rough:.69,color:[.28,.27,.25]}
];
const surfaceDetail={index:0,...SURFACE_DETAILS[0],finish:.72};
const detailKeys=()=>doc.workflow==='spec'?['base','height','gloss']:['base','height','rough'];

const DETAIL_SHAPE=`
float detailHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float detailNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(detailHash(i),detailHash(i+vec2(1,0)),f.x),mix(detailHash(i+vec2(0,1)),detailHash(i+1.0),f.x),f.y);
}
vec3 detailShape(vec2 p,int style,float seed,float aa){
  vec2 q=p+vec2(seed,seed*.37);
  float coarse=detailNoise(q*5.4),grain=detailNoise(q*30.0);
  float distance=length(p*vec2(.90,1.13));
  float fade=1.0-smoothstep(.42,1.0,length(p));
  if(style==0){
    float d=distance+(coarse-.5)*.15;
    float bowl=1.0-smoothstep(.03,.66,d);
    float rim=exp(-pow((d-.64)/.12,2.0))*(.34+.66*coarse);
    return vec3(.84*bowl,.38*rim,.66*bowl);
  }
  if(style==1){
    float reach=1.0-smoothstep(.28,.93,abs(p.x));
    float y=abs(p.y-(detailNoise(vec2(q.x*5.0,seed))-.5)*.14);
    float width=mix(.032,.145,reach)*(.61+.53*coarse);
    float groove=(1.0-smoothstep(width*.12,width+aa,y))*reach;
    float burr=exp(-pow((y-width*1.18)/(width*.55+aa),2.0))*reach*coarse;
    return vec3(groove,.43*burr,groove);
  }
  if(style==2){
    float edge=distance+(coarse-.5)*.65+(grain-.5)*.16;
    float chip=1.0-smoothstep(.51-aa,.52+aa,edge);
    float lip=exp(-pow((edge-.54)/(.043+aa),2.0))*fade;
    return vec3(chip*(.65+.26*coarse),.27*lip,chip*(.56+.44*grain));
  }
  if(style==3){
    vec2 cell=floor(q*8.0),f=fract(q*8.0)-.5;
    float n=detailHash(cell),m=detailHash(cell+2.7);
    float d=length(f+vec2(n-.5,m-.5)*.37)+(grain-.5)*.08;
    float radius=.14+.16*m;
    float pit=(1.0-smoothstep(radius*.20,radius+aa*2.5,d))*step(.40,n)*fade;
    float lip=exp(-pow((d-radius)/.07,2.0))*step(.40,n)*fade;
    return vec3(pit,.21*lip,.75*pit);
  }
  if(style==4){
    float powder=smoothstep(.40,.78,.56*coarse+.44*grain)*fade;
    return vec3(0.0,.38*powder,powder);
  }
  if(style==5){
    float flakes=smoothstep(.32,.71,.51*coarse+.32*grain+.17*fade)*fade;
    return vec3(.08*fade,.78*flakes,flakes*(.60+.40*coarse));
  }
  float casting=smoothstep(.20,.83,.28*coarse+.72*grain)*fade;
  return vec3(0.0,.78*casting,casting);
}`;
const FS_DETAIL_DAB=DETAIL_SHAPE+`
uniform vec2 uCenter,uFlip;
uniform float uRadius,uAngle,uAlpha,uSeed;
uniform int uStyle;
void main(){
  vec2 p=(gl_FragCoord.xy-uCenter)/uRadius;
  float c=cos(uAngle),s=sin(uAngle);
  p=vec2(c*p.x+s*p.y,-s*p.x+c*p.y)*uFlip;
  if(length(p)>1.06){o=vec4(0);return;}
  vec3 d=detailShape(p,uStyle,uSeed,clamp(.75/uRadius,.008,.15));
  o=vec4(d,max(d.r,max(d.g,d.b)))*uAlpha;
}`;
const DETAIL_CHANNEL=`
uniform int uDetailMap;
uniform vec3 uDetailColor;
uniform float uDetailDepth,uDetailPaint,uDetailFinish,uDetailRough;
float detailChannel(vec4 d){
  if(uDetailMap==1){
    float mask=max(d.r,d.g);
    gSC=vec3(clamp(.5+.48*uDetailDepth*(d.g-d.r)/max(mask,1e-5),0.0,1.0));
    return mask*step(.001,uDetailDepth);
  }
  if(uDetailMap==2||uDetailMap==3){
    float rough=clamp(uDetailRough+.13*(d.g-d.r),0.0,1.0);
    gSC=vec3(uDetailMap==2?rough:1.0-rough);
    return d.a*uDetailFinish;
  }
  gSC=uDetailColor;
  return uDetailMap==0?d.b*uDetailPaint:0.0;
}`;
let detailDabProgram=null,detailMergeProgram=null,detailCompProgram=null,detailCardProgram=null,detailCards=null;
function surfaceDetailStrokeProgram(comp){
  const existing=comp?detailCompProgram:detailMergeProgram;
  if(existing)return existing;
  const source=(comp?FS_COMP:FS_MERGE).replace('gSC=uStrokeTint==1?st.rgb:uStrokeColor;','st.a=detailChannel(st);');
  const p=program(source.replace('void main(){',DETAIL_CHANNEL+'\nvoid main(){'));
  p.defaults={...(comp?P.comp.defaults:P.merge.defaults)};
  if(comp)detailCompProgram=p;
  else detailMergeProgram=p;
  return p;
}
function surfaceDetailStrokeUniforms(s,k){
  const v=s.o.material.surfaceDetail;
  return {uDetailMap:{int:{base:0,height:1,rough:2,gloss:3}[k]??-1},uDetailColor:s.o.color,
    uDetailDepth:v.depth,uDetailPaint:v.paint,uDetailFinish:v.finish,uDetailRough:v.rough};
}
function surfaceDetailStamp(s,dst,U,copies,alpha){
  if(!detailDabProgram)detailDabProgram=program(FS_DETAIL_DAB,VS_STAMP);
  const index=s.o.material.surfaceDetail.index;
  for(const [x,y] of copies)run(detailDabProgram,dst,{
    uCenter:[x,y],uExtent:U.uExtent,uSize:U.uSize,uRadius:U.uRadius,uAngle:U.uAngle,uFlip:U.uFlip,
    uAlpha:alpha,uSeed:((s.detailDabs-1)*.61803399%1)*19.7+index*2.17,uStyle:{int:index}
  },{blend:'max'});
}
function surfaceDetailUse(index){
  if(stroke||preview||selLive)return;
  const preset=SURFACE_DETAILS[index];
  if(surfaceDetail.index!==index||!materialBrush.rec?.surfaceDetail){
    Object.assign(surfaceDetail,preset,{index,finish:.72});
    setFG(preset.color);
  }
  if(doc.map!=='base')setEditMap('base');
  materialBrush.rec={name:preset.name,surfaceDetail:true,fill:{maps:{}}};
  materialBrush.loading=false;
  applyPreset({name:preset.name,tool:'material',ownTool:true,size:surfaceDetail.size,
    spacing:surfaceDetail.spacing,followDir:!!preset.follow,angleJitter:preset.follow?0:.18,
    pSize:false,pOpacity:false,smoothing:.18});
  surfaceDetailRender();
}
function surfaceDetailTarget(){
  if(sel.quick)return null;
  const keys=detailKeys();
  if(keys.some(k=>!doc.maps.includes(k)))setDocMaps([...doc.maps,...keys],'Add surface detail channels');
  const active=doc.active;
  const name=SURFACE_DETAILS[surfaceDetail.index].name,key='surface-detail:'+name;
  if(active?.materialPaint===key&&!active.fill&&!active.editMask)return active;
  const L=newLayerObj(name,true);
  L.materialPaint=key;
  ensureMapTarget(L,'base');
  structOp('New surface detail layer',()=>{const [parent,index]=insertPoint();insertNode(L,parent,index);selectOnly(L);});
  return L;
}
function surfaceDetailPaintOptions(o,et){
  if(!et||et.isMask){toast('Select a paint layer to paint surface details.');return null;}
  o.tool='brush';
  o.noTint=true;
  o.chan=null;
  o.material={surfaceDetail:{...surfaceDetail}};
  o.extras=detailKeys().filter(k=>k!==doc.map&&doc.maps.includes(k)).map(key=>({key,mode:1,color:[0,0,0]}));
  return o;
}
function surfaceDetailCardPixels(){
  if(detailCards)return detailCards;
  if(!detailCardProgram)detailCardProgram=program(DETAIL_SHAPE+`
uniform int uStyle;
uniform vec2 uSize;
uniform vec3 uTint;
void main(){
  vec2 p=(gl_FragCoord.xy-uSize*.5)/(uSize.y*.47);
  vec3 d=detailShape(p,uStyle,float(uStyle)*2.17,.027);
  float h=d.g-d.r;
  vec3 dx=detailShape(p+vec2(.030,0),uStyle,float(uStyle)*2.17,.027);
  vec3 dy=detailShape(p+vec2(0,.030),uStyle,float(uStyle)*2.17,.027);
  vec3 n=normalize(vec3((h-dx.g+dx.r)*6.0,(h-dy.g+dy.r)*6.0,1));
  float light=max(0.0,dot(n,normalize(vec3(-.55,.56,.67))));
  o=vec4(mix(vec3(.27,.31,.34),uTint,d.b*.70)*(.36+.84*light),1);
}`);
  const w=132,h=49,target=makeTarget(w,h,8,false);
  try{
    detailCards=SURFACE_DETAILS.map((preset,i)=>{
      run(detailCardProgram,target,{uSize:[w,h],uStyle:{int:i},uTint:preset.paint>0?preset.color:[.35,.39,.41]});
      const src=captureRegionNow(target,0,0,w,h).data,dst=new Uint8ClampedArray(src.length);
      for(let y=0;y<h;y++)dst.set(src.subarray(y*w*4,(y+1)*w*4),(h-1-y)*w*4);
      return new ImageData(dst,w,h);
    });
  }finally{disposeTarget(target);}
  return detailCards;
}
function surfaceDetailRender(){
  const box=$('#surfaceDetailsBody');
  if(!box)return;
  const pixels=surfaceDetailCardPixels();
  const cards=SURFACE_DETAILS.map((preset,index)=>{
    const c=el('canvas',{width:pixels[index].width,height:pixels[index].height,'aria-hidden':'true'});
    c.getContext('2d').putImageData(pixels[index],0,0);
    return el('button',{type:'button',class:'mattile weld-card','aria-label':preset.name,
      'aria-pressed':String(ui.tool==='material'&&!!materialBrush.rec?.surfaceDetail&&surfaceDetail.index===index),
      onclick:()=>surfaceDetailUse(index)},c,el('span',{text:preset.name}),el('small',{text:preset.detail}));
  });
  const slider=(key,label,min,max,step,fmt=pct)=>makeSlider({id:'surfaceDetail-'+key,label,min,max,step,fmt,
    value:surfaceDetail[key],onInput:value=>{
      surfaceDetail[key]=value;
      if(ui.tool==='material'&&materialBrush.rec?.surfaceDetail&&(key==='size'||key==='spacing')){
        brush[key]=value;refreshCursor();brushEdited(key);
      }
    }}).el;
  const color=colourBtn('surfaceDetail-color',()=>ui.fg,setFG,'Detail color');
  box.replaceChildren(el('div',{class:'weld-shelf'},el('div',{class:'matgrid weld-grid'},...cards),
    el('div',{class:'chips'},el('button',{class:'btn sm',text:'Sealant Bead',
      title:'Lay an editable sealant bead on the model',onclick:sealantPathStart})),
    el('div',{class:'weld-controls'},el('label',{class:'frow'},el('span',{text:'Detail color'}),color),
      slider('size','Size',8,250,1,v=>v+' px'),slider('spacing','Spacing',.12,1.5,.01),
      slider('depth','Relief strength',0,1,.01),slider('paint','Color amount',0,1,.01),
      slider('rough','Roughness',0,1,.01),slider('finish','Roughness amount',0,1,.01))));
}
