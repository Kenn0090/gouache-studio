/* ================= Embroidery =================
   Quantize the artwork into thread colours, then stitch the colour regions and
   bind the silhouette. Colour, Height and Roughness share the same profiles. */
const EMB_MAX=16;
/* a small copy of the picture for choosing the thread colours */
const FS_EMB_DOWN=`uniform sampler2D uSrc; uniform vec2 uOut;
void main(){ vec2 sz=vec2(textureSize(uSrc,0)); o=texelFetch(uSrc,ivec2((floor(gl_FragCoord.xy)+0.5)*sz/uOut),0); }`;
/* R is the nearest thread colour. G keeps the original silhouette at antialiased edges. */
const FS_EMB_LABEL=GL_ST+`uniform sampler2D uSrc, uShape; uniform vec4 uPal[${EMB_MAX}]; uniform int uN; uniform int uWhole;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 c=texelFetch(uSrc,p,0); vec3 s=st(c); int bi=0; float bd=1e9;
  for(int i=0;i<${EMB_MAX};i++){ if(i>=uN) break; vec3 d=s-uPal[i].rgb; float e=dot(d*d,vec3(0.3,0.59,0.11)); if(e<bd){ bd=e; bi=i; } }
  float alpha=uWhole==1?1.0:texelFetch(uShape,p,0).a;
  o=vec4(float(bi)/255.0,alpha,0.0,1.0); }`;
/* tidy: every pixel takes the most common thread colour around it (removes specks too small to stitch) */
const FS_EMB_MAJ=`uniform sampler2D uL; uniform int uR;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uL,0); vec4 me=texelFetch(uL,p,0); int cnt[${EMB_MAX}];
  for(int i=0;i<${EMB_MAX};i++) cnt[i]=0;
  for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++){ if(abs(x)>uR||abs(y)>uR) continue; vec4 q=texelFetch(uL,clamp(p+ivec2(x,y),ivec2(0),s-1),0); if(q.g<0.5) continue; int k=int(q.r*255.0+0.5); cnt[k]+=1; }
  int bi=int(me.r*255.0+0.5),bc=cnt[bi]; for(int i=0;i<${EMB_MAX};i++) if(cnt[i]>bc){ bc=cnt[i]; bi=i; }
  o=vec4(float(bi)/255.0,me.g,0.0,1.0); }`;
/* seeds for the distance fields: uWhat 0 = edges between thread colours (and the patch's outline), 1 = the patch's outline only */
const FS_EMB_SEED=`uniform sampler2D uL; uniform int uWhat;
vec2 lab(ivec2 q,ivec2 s){ if(any(lessThan(q,ivec2(0)))||any(greaterThanEqual(q,s))) return vec2(-1.0,0.0); vec4 c=texelFetch(uL,q,0); return vec2(c.g<0.5?-1.0:c.r*255.0,c.g); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uL,0); vec2 me=lab(p,s); bool e=false;
  if(me.y<0.5){ o=vec4(-1.0,-1.0,0.0,0.0); return; }
  for(int k=0;k<4;k++){ ivec2 d=k==0?ivec2(1,0):k==1?ivec2(-1,0):k==2?ivec2(0,1):ivec2(0,-1); vec2 n=lab(p+d,s);
    if(uWhat==1){ if(n.y<0.5) e=true; } else if(n.x!=me.x) e=true; }
  o=e?vec4(vec2(p),0.0,1.0):vec4(-1.0,-1.0,0.0,0.0); }`;
/* The same stitch profiles drive colour, height, and roughness. */
const FS_EMB=`uniform sampler2D uL, uE, uP;
uniform vec4 uPal[${EMB_MAX}];
uniform int uMap, uStyle;
uniform float uSp, uLength, uSat, uAng, uVary, uMw, uShine, uDepth, uSeed;
uniform vec3 uMc;

struct Stitch {
  float cover;
  float height;
  float light;
  float shine;
};

Stitch blendStitch(Stitch a, Stitch b, float t){
  return Stitch(mix(a.cover,b.cover,t),mix(a.height,b.height,t),
    mix(a.light,b.light,t),mix(a.shine,b.shine,t));
}

float threadHash(vec2 p){
  vec3 n=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)+uSeed*.071);
  n+=dot(n,n.yzx+33.33);
  return fract((n.x+n.y)*n.z);
}

vec2 rotateThread(vec2 p, float angle){
  float c=cos(angle), s=sin(angle);
  return vec2(c*p.x-s*p.y,s*p.x+c*p.y);
}

/* A rounded strand with a recessed end, two twisted plies and a small change in
   tension from stitch to stitch. The radial slope also puts the shine off-centre. */
Stitch thread(vec2 p, vec2 direction, float stagger, bool ends){
  vec2 across=vec2(-direction.y,direction.x);
  float row=floor(p.y);
  float s=p.x+row*stagger;
  float stitch=floor(s);
  float along=fract(s);
  float variation=threadHash(vec2(stitch,row));
  float center=fract(p.y)-.5+.062*sin(along*6.283+variation*6.283);
  float aa=clamp(.30/uSp,.025,.18);
  float halfWidth=mix(.405,.48,variation);
  float cap=ends?smoothstep(.012,min(.25,1.1/uLength),min(along,1.0-along)):1.0;
  float radial=center/(halfWidth*mix(.63,1.0,cap));
  float cover=(1.0-smoothstep(1.0-aa,1.0+aa,abs(radial)))*mix(.38,1.0,cap);
  float crown=sqrt(max(0.0,1.0-radial*radial));
  float twist=cos(6.283*(p.x*(ends?uLength:3.1)*.72+center*2.0+variation*.32));
  float fibre=cos(6.283*(center*3.1+twist*.18))*smoothstep(1.65,3.2,uSp);
  vec3 normal=normalize(vec3(across*radial*.76,max(.24,crown)));
  vec3 light=normalize(vec3(-.54,.59,.63));
  float diffuse=.72+.30*max(0.0,dot(normal,light))+.07*twist+.065*fibre;
  float glint=pow(max(0.0,dot(normal,normalize(light+vec3(0,0,1)))),8.0);
  glint*=mix(.52,1.0,abs(dot(direction,vec2(.62,.78))))*(.78+.22*twist);
  return Stitch(cover,crown*mix(.70,1.0,cap)*(1.0+.045*twist),diffuse*mix(.88,1.09,variation),glint);
}

/* Approximate the tangent with two fixed axes. Smoothly blend their stitch
   profiles near diagonals so a nearest-edge change cannot reset the phase. */
Stitch edgeThread(vec2 p, vec2 inward, float distance, float spacing, float bias){
  float angleBlend=smoothstep(.44,.56,abs(inward.y)/(abs(inward.x)+abs(inward.y)));
  vec2 tx=vec2(sign(inward.y),0), ty=vec2(0,-sign(inward.x));
  float offset=distance*bias;
  Stitch vertical=thread(vec2(distance/(spacing*3.1),(dot(p,ty)+offset)/spacing),inward,0.0,false);
  Stitch horizontal=thread(vec2(distance/(spacing*3.1),(dot(p,tx)+offset)/spacing),inward,0.0,false);
  return blendStitch(vertical,horizontal,angleBlend);
}

vec2 nearestOffset(sampler2D field, ivec2 p){
  vec2 seed=texelFetch(field,p,0).xy;
  return seed.x>=0.0?vec2(p)-seed:vec2(4096.0);
}

/* Read the distance gradient across several pixels to smooth pixel stairs and
   nearest-seed ties on curves and acute corners. */
float edgeDistance(sampler2D field, sampler2D labels, ivec2 p, bool outline, int label){
  ivec2 size=textureSize(labels,0);
  if(any(lessThan(p,ivec2(0)))||any(greaterThanEqual(p,size)))return -1.0;
  vec4 sampleLabel=texelFetch(labels,p,0);
  bool same=sampleLabel.g>=.5&&(outline||int(sampleLabel.r*255.0+.5)==label);
  float d=length(nearestOffset(field,p))+.5;
  return same?d:-min(d,2.0);
}
vec2 edgeDirection(sampler2D field, sampler2D labels, ivec2 p, vec2 offset, bool outline, int label){
  ivec2 dx=ivec2(2,0),dy=ivec2(0,2);
  vec2 gradient=vec2(
    edgeDistance(field,labels,p+dx,outline,label)-edgeDistance(field,labels,p-dx,outline,label),
    edgeDistance(field,labels,p+dy,outline,label)-edgeDistance(field,labels,p-dy,outline,label));
  if(dot(gradient,gradient)>.01)return normalize(gradient);
  if(dot(offset,offset)>.01)return normalize(offset);
  return vec2(0,1);
}

void main(){
  ivec2 ip=ivec2(gl_FragCoord.xy);
  vec2 p=gl_FragCoord.xy;
  vec4 label=texelFetch(uL,ip,0);
  float alpha=label.g;
  if(alpha<=0.0){o=vec4(0);return;}
  int k=int(label.r*255.0+.5);
  vec3 colour=uPal[k].rgb;
  vec2 region=nearestOffset(uE,ip), outline=nearestOffset(uP,ip);
  float de=length(region)+.5, dp=length(outline)+.5;
  if(alpha<.5&&dp<8.0)dp=.25;
  float angle=uAng+uVary*float(k)*.6854;
  vec2 direction=vec2(cos(angle),sin(angle));
  vec2 q=rotateThread(p,-angle)/uSp;

  Stitch fill;
  float foundation=.17, pile=.55, backing=.48;
  if(uStyle==2){
    vec2 cell=floor(q);
    Stitch warp=thread(vec2(q.x*.5,q.y),direction,0.0,false);
    Stitch weft=thread(vec2(q.y*.5,q.x),vec2(-direction.y,direction.x),0.0,false);
    float over=step(2.0,mod(cell.x-cell.y,4.0));
    fill=blendStitch(warp,weft,over);
    foundation=.12; pile=.40; backing=.60;
  }else{
    fill=thread(vec2(q.x/uLength,q.y),direction,.37,uStyle!=1);
    if(uStyle==1){foundation=.22; pile=.62;}
  }
  if(uSat>0.0&&de<uSat+uSp){
    vec2 inward=edgeDirection(uE,uL,ip,region,false,k);
    Stitch satin=edgeThread(p,inward,de,uSp*.91,0.0);
    float band=1.0-smoothstep(max(.4,uSat-uSp*.85),uSat+uSp*.45,de);
    fill=blendStitch(fill,satin,band);
    foundation+=.16*band*smoothstep(.3,uSp*1.35,de);
    pile+=.08*band;
    backing*=mix(1.0,.76,band);
  }
  if(uMw>0.0&&dp<uMw+uSp*.4){
    vec2 inward=edgeDirection(uP,uL,ip,outline,true,k);
    float rim=clamp(dp/uMw,0.0,1.0);
    float roll=sqrt(max(0.0,1.0-pow(2.0*rim-1.0,2.0)));
    float binding=1.0-smoothstep(uMw-uSp*.27,uMw+uSp*.4,dp);
    Stitch wrap=edgeThread(p,inward,dp,uSp*1.19,.72);
    wrap.light*=.67+.29*roll+.15*dot(inward,vec2(-.55,.62))*(1.0-2.0*rim);
    wrap.shine*=.66+.52*roll;
    fill=blendStitch(fill,wrap,binding);
    colour=mix(colour,uMc,binding);
    foundation=mix(foundation,.19+.49*roll,binding);
    pile=mix(pile,.43,binding);
    backing=mix(backing,.47,binding);
    float contact=exp(-pow((dp-uMw-uSp*.40)/max(.75,uSp*.56),2.0));
    fill.light*=1.0-contact*.21;
    backing*=1.0-contact*.26;
  }else{
    float turn=smoothstep(.45,uSp*.96+.45,dp);
    fill.light*=.77+.23*turn;
    foundation*=.68+.32*turn;
  }

  float weight=fill.cover;
  if(uMap==0){
    float weave=.94+.06*cos(p.x*2.9)*cos(p.y*3.3);
    vec3 base=colour*mix(backing*weave,fill.light,weight);
    vec3 glint=mix(colour,vec3(1),.58)*fill.shine*uShine*.26*weight;
    o=vec4(clamp(base+glint,0.0,1.0)*alpha,alpha);
  }else if(uMap==1){
    float h=.5+uDepth*.44*(foundation+pile*fill.height*weight);
    o=vec4(vec3(clamp(h,0.0,1.0)*alpha),alpha);
  }else{
    float roughness=clamp(mix(.88,.69-uShine*(.16+.20*fill.shine),weight),.14,.92);
    o=vec4(vec3(roughness*alpha),alpha);
  }
}`;

let EMBP=null;
function embProgs(){
  if(!EMBP)EMBP={down:program(FS_EMB_DOWN),label:program(FS_EMB_LABEL),maj:program(FS_EMB_MAJ),
    seed:program(FS_EMB_SEED),jfa:program(FS_LKJFA),emb:program(FS_EMB)};
  return EMBP;
}

/* thread colours: sharp samples of the picture (transparent pixels left out), split where the colours spread most
   (so a small yellow detail still gets its own thread), refined by a few rounds of k-means, near-twins merged */
function embPalette(src,n){const E=embProgs(),S=128,t=makeTarget(S,S,8);run(E.down,t,{uSrc:src.tex,uOut:[S,S]});const d=captureRegionNow(t,0,0,S,S).data;disposeTarget(t);
  const px=[];for(let i=0;i<d.length;i+=4){const a=d[i+3];if(a<128)continue;px.push([d[i]/a,d[i+1]/a,d[i+2]/a]);}
  if(!px.length)return [[1,1,1]];
  const range=b=>{const r=[0,1,2].map(c=>{let lo=1,hi=0;for(const p of b){lo=Math.min(lo,p[c]);hi=Math.max(hi,p[c]);}return hi-lo;});return r;};
  let boxes=[px];
  while(boxes.length<n){let bi=-1,bs=0;boxes.forEach((b,i)=>{if(b.length<2)return;const s=Math.max(...range(b))*Math.pow(b.length,.25);if(s>bs){bs=s;bi=i;}});
    if(bi<0||bs<.02)break;const b=boxes.splice(bi,1)[0],r=range(b),c=r.indexOf(Math.max(...r));b.sort((x,y)=>x[c]-y[c]);
    /* split at the biggest jump in that channel (a clean border between colours), else in the middle */
    let m=b.length>>1,gap=0;for(let i=1;i<b.length;i++){const g=b[i][c]-b[i-1][c];if(g>gap){gap=g;m=i;}}boxes.push(b.slice(0,m),b.slice(m));}
  let pal=boxes.map(b=>{const s=[0,0,0];for(const p of b){s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];}return s.map(v=>v/Math.max(1,b.length));});
  const dist=(a,b)=>(a[0]-b[0])**2*.3+(a[1]-b[1])**2*.59+(a[2]-b[2])**2*.11;
  for(let it=0;it<6;it++){const sum=pal.map(()=>[0,0,0,0]);for(const p of px){let bi=0,bd=1e9;pal.forEach((c,i)=>{const e=dist(p,c);if(e<bd){bd=e;bi=i;}});const s=sum[bi];s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];s[3]++;}
    pal=pal.map((c,i)=>sum[i][3]?[sum[i][0]/sum[i][3],sum[i][1]/sum[i][3],sum[i][2]/sum[i][3]]:c);}
  const out=[];for(const c of pal)if(!out.some(o=>dist(o,c)<.0015))out.push(c.map(v=>Math.min(1,Math.max(0,v))));return out;}
/* Only the first 92 pixels from an edge can affect a stitch. An even number
   of flood passes puts the refined field back in its own target. */
function embField(E,labels,what,a,b){
  run(E.seed,a,{uL:labels.tex,uWhat:{int:what}});
  for(const step of [64,32,16,8,4,2,1,1]){
    run(E.jfa,b,{uSrc:a.tex,uStep:{int:step}});
    [a,b]=[b,a];
  }
}

function embGeometry(src,v,palette,fields){
  const E=embProgs();
  if(!fields){
    fields={labels:makeTarget(doc.w,doc.h,8,false),spare:makeTarget(doc.w,doc.h,8,false),
      region:lkTex(gl.RG32F),outline:lkTex(gl.RG32F),flood:lkTex(gl.RG32F)};
  }
  const soft=v.simplify>.25?blurOf(src,v.simplify):null;
  try{
    run(E.label,fields.labels,{uSrc:(soft||src).tex,uShape:src.tex,uPal:{v4a:palette},
      uN:{int:v.pal.length},uWhole:{int:v.shape==='whole'?1:0}});
  }finally{if(soft)release(soft);}
  for(let i=0;i<v.clean;i++){
    run(E.maj,fields.spare,{uL:fields.labels.tex,uR:{int:2}});
    [fields.labels,fields.spare]=[fields.spare,fields.labels];
  }
  embField(E,fields.labels,0,fields.region,fields.flood);
  embField(E,fields.labels,1,fields.outline,fields.flood);
  return fields;
}

function embRender(v,maps,fields,palette){
  const u={uL:fields.labels.tex,uE:fields.region.tex,uP:fields.outline.tex,uPal:{v4a:palette},
    uStyle:{int:v.style},uSp:v.sp,uLength:v.length,uSat:v.satin,uAng:v.ang*Math.PI/180,
    uVary:v.vary?1:0,uMw:v.merrow?v.mw:0,uMc:v.mc,uShine:v.shine,uDepth:v.depth,uSeed:v.seed};
  for(const [key,index] of [['base',0],['height',1],['rough',2]]){
    if(maps[key])run(embProgs().emb,maps[key],{...u,uMap:{int:index}});
  }
}
function embBorderColour(v){const pal=v.pal,lum=c=>c[0]*.3+c[1]*.59+c[2]*.11;
  return v.mcFrom==='fg'?ui.fg.slice(0,3):v.mcFrom==='light'?pal.reduce((a,c)=>lum(c)>lum(a)?c:a,pal[0]):pal.reduce((a,c)=>lum(c)<lum(a)?c:a,pal[0]);}
let embDlg=null;
function dlgEmbroidery(){if(stroke||preview||selLive||embDlg){toast('Finish the current edit first.');return;}
  if(ui.mode==='anim'){toast('Switch to paint mode to make an embroidery patch.');return;}
  if(!canFloat){toast('This needs float textures, which this graphics card lacks.');return;}
  const A=doc.active,fromLayer=isLayer(A)&&hasMap(A,'base');
  let srcT=acquireD(doc.depth);if(fromLayer)blit(mapT(A,'base'),srcT,0,0,doc.w,doc.h,0,0);else{release(srcT);srcT=compositeMap('base');}
  const size=Math.max(doc.w,doc.h);
  const v={threads:8,simplify:.5,clean:1,style:0,sp:clamp(Math.round(size/105)*.5,2.5,12),length:4.5,
    satin:clamp(Math.round(size/150),3,60),ang:33,vary:true,merrow:true,
    mw:clamp(Math.round(size/60),6,72),mcFrom:'dark',shine:.72,depth:.73,seed:1,shape:'outline'};
  const parent=A?(A.parent||doc.root):doc.root,idx=A?parent.children.indexOf(A)+1:doc.root.children.length;
  const L=newLayerObj('Embroidery',true);
  ensureMapTarget(L,'base');ensureMapTarget(L,'height');
  if(doc.maps.includes('rough'))ensureMapTarget(L,'rough');
  insertNode(L,parent,idx);
  preview={off:true,conv:true};embDlg={L};
  let fields=null,palette=null,geometryKey='',colours=0,dirty=true,show=prefs.livePreview,tm=0;
  const draw=()=>{
    if(!dirty)return;
    if(colours!==v.threads){
      colours=v.threads;
      v.pal=embPalette(srcT,colours);
      palette=new Float32Array(EMB_MAX*4);
      v.pal.forEach((colour,i)=>palette.set([...colour,1],i*4));
      chips();
    }
    const key=[v.threads,v.simplify,v.clean,v.shape].join(':');
    if(geometryKey!==key){
      fields=embGeometry(srcT,v,palette,fields);
      geometryKey=key;
    }
    v.mc=embBorderColour(v);
    embRender(v,L.maps,fields,palette);
    dirty=false;scheduleThumb(L);changedAll();
  };
  const later=()=>{dirty=true;clearTimeout(tm);if(show)tm=setTimeout(draw,100);};
  const sw=el('div',{class:'chips',id:'embPal','aria-label':'Thread colours'});
  const chips=()=>sw.replaceChildren(...(v.pal||[]).map(c=>el('span',{class:'embsw',style:'background:'+toHex(c),title:toHex(c)})));
  const S=(key,label,min,max,step,fmt)=>makeSlider({id:'emb_'+key,label,min,max,step,value:v[key],fmt,onInput:x=>{v[key]=x;later();}}).el;
  const style=el('select',{id:'embStyle','aria-label':'Stitch style'},
    el('option',{value:'tatami',text:'Tatami fill'}),el('option',{value:'satin',text:'Satin fill'}),
    el('option',{value:'woven',text:'Woven twill'}));
  style.onchange=()=>{v.style=style.selectedIndex;later();};
  const body=el('div',{class:'dlg-grid'},
    el('p',{class:'note',text:'Stitch '+(fromLayer?'“'+A.name+'”':'the canvas')+' on a new layer with Height'+(doc.maps.includes('rough')?' and Roughness':'')+'.'}),
    el('div',{class:'sub',text:'Threads'}),S('threads','Thread colours',2,EMB_MAX,1,x=>String(x)),sw,S('simplify','Simplify',0,12,.5,px),S('clean','Clean up small bits',0,6,1,x=>String(x)),
    el('div',{class:'sub',text:'Stitches'}),el('label',{class:'frow'},el('span',{text:'Stitch style'}),style),
    S('sp','Thread width',1.5,12,.5,px),S('length','Stitch length',2,12,.25,x=>x+'×'),
    S('satin','Satin edge width',0,80,1,px),S('ang','Fill angle',0,180,1,x=>x+'°'),
    chk('emb_vary','Different angle for each colour',v.vary,x=>{v.vary=x;later();}),
    el('div',{class:'sub',text:'Merrow border'}),chk('emb_merrow','Rolled border around the patch',v.merrow,x=>{v.merrow=x;later();}),S('mw','Border width',2,80,1,px),
    seg([['dark','Darkest thread'],['light','Lightest thread'],['fg','Foreground colour']],v.mcFrom,x=>{v.mcFrom=x;later();},'Border colour'),
    el('div',{class:'sub',text:'Patch shape'}),seg([['outline','The picture’s outline'],['whole','Whole canvas']],v.shape,x=>{v.shape=x;later();},'Patch shape'),
    el('div',{class:'sub',text:'Look'}),S('shine','Thread shine',0,1,.01,pct),S('depth','Height',0,1,.01,pct),S('seed','Variation',1,99,1,x=>String(x)),
    previewChk('embPrev',show,x=>{show=x;clearTimeout(tm);L.visible=x;if(x)draw();changed(L);requestRender(true);}));
  L.visible=show;
  if(show)draw();
  const finish=()=>{
    clearTimeout(tm);preview=null;embDlg=null;release(srcT);
    if(fields)Object.values(fields).forEach(disposeTarget);
  };
  openDialog({title:'Embroidery patch',body,float:true,okLabel:'Create layer',
    onOk(){clearTimeout(tm);draw();detachNode(L);L.visible=true;
      let heightStep=null;
      if(!doc.maps.includes('height')){
        setDocMaps([...doc.maps,'height'],'Add Height map');
        heightStep=hist.undo[hist.undo.length-1];
      }
      structOp('Embroidery patch',()=>{insertNode(L,parent,idx);selectOnly(L);});
      const first=hist.undo.indexOf(heightStep);
      if(first>=0)undoMerge(first,'Embroidery patch');
      finish();syncTargets();changedAll();refreshMapsUI();
      toast('Added the layer “'+L.name+'”: colour and Height'+(L.maps.rough?' and Roughness':'')+'. Paint on it, or hide the picture under it.');},
    onCancel(){detachNode(L);disposeLayer(L);finish();changedAll();}});}
