/* ================= Convert tab =================
   CrazyBump-style map making. Pick a source (a document map, a layer or an image file), say what
   it is (photo / colour, height, or normal map; the app guesses), and get normal, height, AO,
   curvature, roughness, metallic and a cleaned-up base colour, each with its own live settings.
   Before converting, a photo can be straightened (perspective) and made seamless.
   Everything runs on the GPU at the document size; results go into the document (one group per
   map) or straight out as image files. Only the normal map is in colour. */
const CV_OUTS={photo:['normal','height','ao','curv','rough','metal','base'],height:['normal','height','ao','curv'],normal:['normal','height','ao','curv']};
const CV_NAMES={normal:'Normal',height:'Height',ao:'Ambient occlusion',curv:'Curvature',rough:'Roughness',metal:'Metallic',base:'Base colour'};
const CV_MAP={normal:'normal',height:'height',ao:'ao',curv:'curv',rough:'rough',metal:'metal',base:'base'};
const CV_KINDS=[['photo','Photo / colour'],['height','Height (grey)'],['normal','Normal map']];
const BANDS=[{key:'fine',label:'Fine detail',value:.8},{key:'med',label:'Medium detail',value:.5},{key:'large',label:'Large detail',value:.3},{key:'vlarge',label:'Very large detail',value:.15},{key:'huge',label:'Huge detail',value:0}];
const band=(k)=>BANDS.map(b=>({key:b.key,label:b.label,min:0,max:1,step:.01,value:b.value,fmt:pct,kinds:k}));
/* settings of each output; kinds: which sources show that setting */
const CV_DEFS={
  normal:[{key:'str',label:'Intensity',min:0,max:30,step:.1,value:10,fmt:v=>v.toFixed(1),kinds:['photo','height']},{key:'nstr',label:'Intensity',min:0,max:3,step:.01,value:1,fmt:pct,kinds:['normal']},
    {key:'sharp',label:'Sharpen',min:0,max:2,step:.01,value:.2,fmt:pct,kinds:['photo']},{key:'noise',label:'Noise removal',min:0,max:4,step:.1,value:.5,fmt:v=>v.toFixed(1),kinds:['photo','height','normal']},
    {key:'shape',label:'Shape recognition',min:0,max:1,step:.01,value:.3,fmt:pct,kinds:['photo']},...band(['photo'])],
  height:[{key:'con',label:'Intensity',min:0,max:4,step:.01,value:1,fmt:pct},{key:'sharp',label:'Sharpen',min:0,max:2,step:.01,value:0,fmt:pct,kinds:['photo','height']},
    {key:'noise',label:'Noise removal',min:0,max:4,step:.1,value:1,fmt:v=>v.toFixed(1),kinds:['photo']},{key:'shape',label:'Shape recognition',min:0,max:1,step:.01,value:.5,fmt:pct,kinds:['photo']},
    ...band(['photo']).map(d=>Object.assign(d,{value:{fine:.4,med:.6,large:.7,vlarge:.5,huge:.2}[d.key]})),{key:'smooth',label:'Smooth',min:0,max:12,step:.5,value:0,fmt:v=>v+'px'}],
  ao:[{key:'str',label:'Intensity',min:0,max:4,step:.01,value:1,fmt:pct},{key:'r',label:'Spread',min:1,max:128,step:1,value:16,fmt:v=>v+'px'},{key:'bal',label:'Balance (fine ↔ large)',min:0,max:1,step:.01,value:.5,fmt:pct},
    {key:'smooth',label:'Smooth',min:0,max:8,step:.5,value:1,fmt:v=>v+'px'}],
  curv:[{key:'r',label:'Width',min:0,max:16,step:.5,value:1.5,fmt:v=>v+'px'},{key:'str',label:'Strength',min:0,max:4,step:.05,value:1.5,fmt:pct},{key:'smooth',label:'Smooth',min:0,max:8,step:.5,value:1,fmt:v=>v+'px'}],
  rough:[{key:'min',label:'Darkest becomes',min:0,max:1,step:.01,value:.35,fmt:pct},{key:'max',label:'Lightest becomes',min:0,max:1,step:.01,value:.85,fmt:pct},{key:'con',label:'Contrast',min:.2,max:4,step:.05,value:1,fmt:pct}],
  metal:[{key:'base',label:'Everything else',min:0,max:1,step:.01,value:0,fmt:pct}],
  base:[{key:'even',label:'Even out lighting',min:0,max:1,step:.01,value:.6,fmt:pct},{key:'r',label:'Lighting size',min:8,max:400,step:1,value:80,fmt:v=>v+'px'},
    {key:'shad',label:'Lift shadows',min:0,max:1,step:.01,value:.3,fmt:pct},{key:'high',label:'Tame highlights',min:0,max:1,step:.01,value:.25,fmt:pct},{key:'sat',label:'Saturation',min:0,max:2,step:.01,value:1,fmt:pct}]};
const CV_NOTES={normal:'Surface direction detail. The detail sliders pick which sizes of shape become bumps, like CrazyBump.',height:'Light is high, dark is low. The detail sliders decide which sizes of shape count.',
  ao:'Crevices get darker. Balance favours small crevices (left) or large dips (right).',curv:'Raised edges light, cavities dark: a mask for wear and dirt.',
  rough:'Brightness becomes roughness (0% glossy, 100% matte). Pick colours in the image to give them their own roughness.',metal:'Pick the colours that are metal: those areas become metallic.',
  base:'Removes lighting baked into a photo so the colour works under any light.'};
const cvS={src:null,srcName:'',srcVer:0,kind:'photo',guess:'',dx:false,inv:false,tab:'normal',show:'result',prep:null,res:{},dirty:new Set(),prepDirty:true,
  seam:{on:false,w:.35},persp:{on:false,edit:false,q:null},make:{normal:true,height:true,ao:true,curv:false,rough:false,metal:false,base:false},
  v:{},keys:{rough:[],metal:[]},pick:null,prev3d:null,sent:[],cache:{},mean:.5,replace:true,thumbs:null};
for(const k in CV_DEFS){cvS.v[k]={};for(const d of CV_DEFS[k])cvS.v[k][d.key]=d.value;}
cvS.v.curv.part=0;cvS.v.normal.dx=false;cvS.v.normal.mix=false;cvS.v.rough.inv=false;

/* ---------- shaders ---------- */
const CV_FS={
  bands:`uniform sampler2D uL; uniform sampler2D uB1; uniform sampler2D uB2; uniform sampler2D uB3; uniform sampler2D uB4; uniform sampler2D uB5; uniform vec2 uSize;
uniform float uF; uniform float uM; uniform float uLg; uniform float uVL; uniform float uHg; uniform float uShape; uniform float uCon; uniform int uInv; uniform vec4 uG; uniform float uG5;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec2 uv=gl_FragCoord.xy/uSize; float l=texelFetch(uL,p,0).r,b1=texelFetch(uB1,p,0).r,b2=texelFetch(uB2,p,0).r,b3=texture(uB3,uv).r,b4=texture(uB4,uv).r,b5=texture(uB5,uv).r;
  float h=uF*(l-b1)*uG.x+uM*(b1-b2)*uG.y+uLg*(b2-b3)*uG.z+uVL*(b3-b4)*uG.w+uHg*(b4-b5)*uG5+uShape*(b3-0.5)*0.6*uG.z/2.5;
  if(uInv==1) h=-h; o=vec4(vec3(clamp(0.5+h*uCon,0.0,1.0)),1.0); }`,
  adjh:`uniform sampler2D uH; uniform sampler2D uB; uniform float uCon; uniform float uSharp; uniform int uInv;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float h=texelFetch(uH,p,0).r,b=texelFetch(uB,p,0).r; h=h+(h-b)*uSharp*2.0; h=0.5+(h-0.5)*uCon; if(uInv==1) h=1.0-h; o=vec4(vec3(clamp(h,0.0,1.0)),1.0); }`,
  nadj:`uniform sampler2D uN; uniform float uStr; uniform int uInDX; uniform int uOutDX;
void main(){ vec4 c=texelFetch(uN,ivec2(gl_FragCoord.xy),0); vec3 n=(c.a>1e-6?c.rgb/c.a:vec3(0.5,0.5,1.0))*2.0-1.0; if(uInDX==1) n.y=-n.y;
  n.xy*=uStr; n.z=max(n.z,0.02); n=normalize(n); if(uOutDX==1) n.y=-n.y; o=vec4(n*0.5+0.5,1.0); }`,
  ao:`uniform sampler2D uH; uniform sampler2D uB1; uniform sampler2D uB2; uniform sampler2D uB3; uniform float uStr; uniform float uBal;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float h=texelFetch(uH,p,0).r; float w1=0.1+(1.0-uBal)*0.7,w3=0.1+uBal*0.7,w2=0.25,s=w1+w2+w3;
  float d=(max(texelFetch(uB1,p,0).r-h,0.0)*w1+max(texelFetch(uB2,p,0).r-h,0.0)*w2+max(texelFetch(uB3,p,0).r-h,0.0)*w3)/s; o=vec4(vec3(1.0-clamp(d*uStr*22.0,0.0,1.0)),1.0); }`,
  key:`uniform sampler2D uSrc; uniform int uMode; uniform float uMin; uniform float uMax; uniform float uCon; uniform float uBase; uniform int uInv; uniform vec3 uKC[6]; uniform vec3 uKP[6]; uniform int uKN;
void main(){ vec4 s=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); vec3 c=s.a>1e-6?s.rgb/s.a:vec3(0.0); float l=dot(c,vec3(0.2126,0.7152,0.0722));
  float t=clamp((l-0.5)*uCon+0.5,0.0,1.0); if(uInv==1) t=1.0-t; float v=uMode==0?mix(uMin,uMax,t):uBase;
  for(int i=0;i<6;i++){ if(i>=uKN) break; float d=distance(c,uKC[i]),tol=max(uKP[i].y,1e-3); float w=1.0-smoothstep(tol*(1.0-uKP[i].z),tol,d); v=mix(v,uKP[i].x,w); }
  o=vec4(vec3(v),1.0); }`,
  base:`uniform sampler2D uSrc; uniform sampler2D uLB; uniform vec2 uSize; uniform float uMean; uniform float uEven; uniform float uShad; uniform float uHigh; uniform float uSat;
float lum(vec3 c){ return dot(c,vec3(0.2126,0.7152,0.0722)); }
void main(){ vec4 s=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); if(s.a<=1e-6){ o=s; return; } vec3 c=s.rgb/s.a; float lb=texture(uLB,gl_FragCoord.xy/uSize).r;
  c*=mix(1.0,clamp(uMean/max(lb,1e-3),0.25,4.0),uEven); float l=lum(c);
  c*=1.0+(1.0-smoothstep(0.0,0.45,l))*uShad*1.4; l=lum(c); c=mix(c,c*(0.55+0.45*(1.0-l)),smoothstep(0.55,1.0,l)*uHigh);
  c=mix(vec3(lum(c)),c,uSat); o=vec4(clamp(c,0.0,1.0)*s.a,s.a); }`,
  persp:`uniform sampler2D uSrc; uniform vec2 uSize; uniform vec4 uHa; uniform vec4 uHb;
void main(){ vec2 u=gl_FragCoord.xy/uSize; float w=uHb.z*u.x+uHb.w*u.y+1.0; vec2 q=vec2(uHa.x*u.x+uHa.y*u.y+uHa.z,uHa.w*u.x+uHb.x*u.y+uHb.y)/w; o=texture(uSrc,q); }`,
  rnm:`uniform sampler2D uA; uniform sampler2D uB; uniform int uOutDX;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 A=texelFetch(uA,p,0),B=texelFetch(uB,p,0); vec3 a=(A.a>1e-6?A.rgb/A.a:vec3(0.5,0.5,1.0))*2.0-1.0,b=(B.a>1e-6?B.rgb/B.a:vec3(0.5,0.5,1.0))*2.0-1.0;
  vec3 t=a+vec3(0,0,1),u=b*vec3(-1,-1,1); vec3 n=normalize(t*dot(t,u)/t.z-u); if(uOutDX==1) n.y=-n.y; o=vec4(n*0.5+0.5,1.0); }`,
  /* evens out the one-level stair steps of 8-bit images (seen as rings in the normal map): averages
     nearby pixels that differ by less than uT, so real detail and edges stay */
  deband:`uniform sampler2D uSrc; uniform float uR; uniform float uT;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); float c=texelFetch(uSrc,p,0).r,sum=c,n=1.0;
  for(int i=0;i<16;i++){ float a=float(i)*0.3927+(i>=8?0.19635:0.0); float r=i>=8?uR:uR*0.5; ivec2 q=clamp(p+ivec2(round(vec2(cos(a),sin(a))*r)),ivec2(0),s-1);
    float v=texelFetch(uSrc,q,0).r; if(abs(v-c)<=uT){ sum+=v; n+=1.0; } }
  o=vec4(vec3(sum/n),1.0); }`,
  /* roughness -> glossiness, or metallic -> specular (about 22% grey, the photo's colour where metal) */
  tosg:`uniform sampler2D uSrc; uniform sampler2D uCol; uniform int uSpec;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float v=texelFetch(uSrc,p,0).r; if(uSpec==0){ o=vec4(vec3(1.0-v),1.0); return; }
  vec4 c=texelFetch(uCol,p,0); vec3 col=c.a>1e-6?c.rgb/c.a:vec3(0.0); o=vec4(mix(vec3(0.22),col,v),1.0); }`,
  shade:`uniform sampler2D uN; uniform vec2 uSize; void main(){ vec3 n=texture(uN,gl_FragCoord.xy/uSize).rgb*2.0-1.0; vec3 L=normalize(vec3(-0.55,0.55,0.62)); float d=max(dot(normalize(n),L),0.0);
  o=vec4(vec3(0.18+0.82*d)*vec3(0.95,0.9,0.82),1.0); }`};
let CVP=null;const cvP=()=>CVP||(CVP=Object.fromEntries(Object.entries(CV_FS).map(([k,s])=>[k,program(s)])));

/* ---------- targets and blurs of any size ---------- */
const cvDepth=()=>canFloat?16:doc.depth;
function cvT(name,w,h,d){let t=cvS.cache[name];w=w||doc.w;h=h||doc.h;d=d||cvDepth();if(!t||t.w!==w||t.h!==h||t.depth!==d){if(t)disposeTarget(t);t=cvS.cache[name]=makeTarget(w,h,d,false);}return t;}
function cvBlur(src,dst,r,tmpName){if(r<=.25){run(P.f_rs,dst,{uSrc:src.tex,uOut:[dst.w,dst.h]});return;}const sigma=Math.max(.3,r/2.2),R=Math.min(128,Math.ceil(sigma*3)),t=cvT(tmpName||('bt'+dst.w+'x'+dst.h),dst.w,dst.h,dst.depth);
  run(P.blur,t,{uSrc:src.tex,uDir:[1,0],uSigma:sigma,uRadius:{int:R}});run(P.blur,dst,{uSrc:t.tex,uDir:[0,1],uSigma:sigma,uRadius:{int:R}});}
/* halve until smaller than 1/f of the document */
function cvDown(src,f,name){let cur=src,w=doc.w,h=doc.h,i=0;while(f>1){w=Math.max(1,Math.ceil(w/2));h=Math.max(1,Math.ceil(h/2));const t=cvT(name+'_'+(i++),w,h);run(P.f_rs,t,{uSrc:cur.tex,uOut:[w,h]});cur=t;f/=2;}return cur;}

/* ---------- source ---------- */
function cvSetSource(t,name,own){cvS.decal=false;if(cvS.src&&cvS.srcOwn)disposeTarget(cvS.src);cvS.src=t;cvS.srcOwn=!!own;cvS.srcName=name||'Texture';cvS.srcVer++;cvS.cache.pois=null;cvS.cache.pyr={};
  cvDetect();cvS.prepDirty=true;cvAllDirty();cvS.thumbs=null;if(ui.mode==='convert'){buildConvertPanel();fitSoon();}}
const fitSoon=()=>requestAnimationFrame(()=>{fit();requestRender(true);});
/* a snapshot of a document map or the active layer */
/* read from the painting (the Convert tab's own canvas then takes its size) */
function cvSourceFromDoc(what){const got=withPaintDoc(()=>cvReadPaint(what));if(!got)return false;if(ui.mode==='convert')tabDocResize(got.t.w,got.t.h,'Convert');
  cvSetSource(got.t,got.name,true);if(what==='normal')cvSetKind('normal');else if(what==='height')cvSetKind('height');return true;}
function cvReadPaint(what){const W=doc.w,H=doc.h,t=makeTarget(W,H,cvDepth(),false);let s=null,name=doc.name||'Texture';
  if(what==='layer'){const L=doc.active;if(!L||!isLayer(L)||!mapT(L,doc.map)||mapT(L,doc.map).empty){toast('The active layer has nothing in this map.');disposeTarget(t);return false;}blit(mapT(L,doc.map),t,0,0,W,H,0,0);name=L.name;}
  else if(what==='normal'){if(!doc.maps.includes('normal')&&!doc.maps.includes('height')){toast('This document has no normal or height map.');disposeTarget(t);return false;}s=normalComposite(false,null);blit(s,t,0,0,W,H,0,0);release(s);}
  else{if(!doc.maps.includes(what)){toast('This document has no '+MAP_DEFS[what].label.toLowerCase()+' map.');disposeTarget(t);return false;}s=compositeMap(what);blit(s,t,0,0,W,H,0,0);release(s);}
  return {t,name};}
async function cvSourceFromFile(file){loadStart(file.name);try{loadBusy('Reading the image…');await loadPaint();const raw=await decodeFile(file);
    /* the Convert tab's canvas takes the picture's own size (8192 at most) */
    const k=Math.min(1,8192/Math.max(raw.w,raw.h)),w=Math.max(1,Math.round(raw.w*k)),h=Math.max(1,Math.round(raw.h*k));if(ui.mode==='convert')tabDocResize(w,h,'Convert');
    const t=makeTarget(doc.w,doc.h,cvDepth(),false);drawRawStretch(t,raw);cvSetSource(t,baseName(file.name),true);
    if(k<1)toast('“'+file.name+'” is '+raw.w+' × '+raw.h+'; it is converted at '+w+' × '+h+'.');}
  catch(e){console.warn(e);toast('That image could not be read: '+(e.message||e));}finally{loadEnd();}}
/* a decoded image stretched over a target */
function drawRawStretch(target,raw){const tex=uploadStraight(raw),tmp=makeTarget(raw.w,raw.h,cvDepth(),false);premultInto(tmp,tex,[0,0],null);gl.deleteTexture(tex);
  run(P.resample,target,{uSrc:tmp.tex,uOffset:[0,0],uScale:[raw.w/target.w,raw.h/target.h],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(raw.w/target.w)))}});disposeTarget(tmp);}
async function cvPickFile(){if(platform.isDesktop){const p=await platform.openDialog([{name:'Images',extensions:['png','jpg','jpeg','webp','tga','tif','tiff','bmp','dds','psd','PNG','JPG','JPEG','TGA','TIF','TIFF']}]);if(!p)return;
    loadStart(fileNameOf(p));let bytes;try{bytes=await platform.readFile(p);}finally{loadEnd();}const name=fileNameOf(p);await cvSourceFromFile(new File([bytes],name,{type:MIME[extOf(name)]||''}));return;}
  const f=el('input',{type:'file',accept:'.png,.jpg,.jpeg,.webp,.tga,.tif,.tiff,.bmp,.dds,.psd,image/*'});f.onchange=()=>{if(f.files[0])cvSourceFromFile(f.files[0]);};f.click();}
/* guess what the source is: normal maps are bluish around (0.5, 0.5, 1); grey images are height */
function cvDetect(){const S=64,sm=makeTarget(S,S,8,false);run(P.f_rs,sm,{uSrc:cvS.src.tex,uOut:[S,S]});const d=captureRegionNow(sm,0,0,sm.w,sm.h).data;disposeTarget(sm);
  let r=0,g=0,b=0,sat=0,blue=0,n=0;for(let i=0;i<d.length;i+=4){const a=d[i+3]/255;if(a<.5)continue;const R=d[i]/255,G=d[i+1]/255,B=d[i+2]/255;r+=R;g+=G;b+=B;sat+=Math.max(R,G,B)-Math.min(R,G,B);if(B>.7&&B>=R&&B>=G)blue++;n++;}
  if(!n){cvS.kind='photo';cvS.guess='photo';return;}r/=n;g/=n;b/=n;sat/=n;
  let kind='photo';if(b>.72&&Math.abs(r-.5)<.12&&Math.abs(g-.5)<.12&&blue/n>.8)kind='normal';else if(sat<.035)kind='height';
  cvS.kind=cvS.guess=kind;if(kind==='normal')cvS.dx=cvGuessDX(d,S);}
/* DirectX or OpenGL: the slopes a true normal map describes have no "twist" (curl); with the
   green channel read the wrong way round they do */
function cvGuessDX(d,S){let cg=0,cd=0;const at=(x,y,c)=>d[((y*S)+x)*4+c]/255*2-1;
  for(let y=1;y<S-1;y++)for(let x=1;x<S-1;x++){const gx=(u,v)=>-at(u,v,0)/Math.max(.1,at(u,v,2)),gy=(u,v,s)=>s*at(u,v,1)/Math.max(.1,at(u,v,2));
    const dgxdy=(gx(x,y+1)-gx(x,y-1))/2;cg+=Math.abs(dgxdy-(gy(x+1,y,1)-gy(x-1,y,1))/2);cd+=Math.abs(dgxdy-(gy(x+1,y,-1)-gy(x-1,y,-1))/2);}
  return cd<cg*.85;}
function cvSetKind(k){cvS.kind=k;if(!CV_OUTS[k].includes(cvS.tab))cvS.tab='normal';cvAllDirty();cvS.thumbs=null;if(ui.mode==='convert')buildConvertPanel();}
function cvAllDirty(){for(const k of CV_OUTS[cvS.kind])cvS.dirty.add(k);cvSchedule();}
function cvChanged(k){cvS.dirty.add(k);if(k==='height'){cvS.dirty.add('ao');if(cvS.kind!=='photo')cvS.dirty.add('normal');}if(k==='normal')cvS.dirty.add('curv');if(cvS.kind==='normal'&&k==='normal'){}cvSchedule();}
let cvQueued=false;function cvSchedule(){if(cvQueued)return;cvQueued=true;requestAnimationFrame(()=>{cvQueued=false;if(ui.mode!=='convert')return;try{cvCompute();}catch(e){console.error(e);}});}

/* ---------- before converting: straighten and make seamless ---------- */
function cvHomog(q){const x0=q[0][0]/doc.w,y0=q[0][1]/doc.h,x1=q[1][0]/doc.w,y1=q[1][1]/doc.h,x2=q[2][0]/doc.w,y2=q[2][1]/doc.h,x3=q[3][0]/doc.w,y3=q[3][1]/doc.h;
  const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;let g=0,h=0;
  if(Math.abs(dx3)>1e-9||Math.abs(dy3)>1e-9){const den=dx1*dy2-dx2*dy1;if(Math.abs(den)>1e-12){g=(dx3*dy2-dx2*dy3)/den;h=(dx1*dy3-dx3*dy1)/den;}}
  return [x1-x0+g*x1,x3-x0+h*x3,x0,y1-y0+g*y1,y3-y0+h*y3,y0,g,h];}
function cvPrep(){if(!cvS.prepDirty&&cvS.prep)return cvS.prep;const P2=cvP();let cur=cvS.src;
  if(cvS.persp.on&&cvS.persp.q){const t=cvT('persp');const H=cvHomog(cvS.persp.q);run(P2.persp,t,{uSrc:cur.tex,uSize:[doc.w,doc.h],uHa:[H[0],H[1],H[2],H[3]],uHb:[H[4],H[5],H[6],H[7]]});cur=t;}
  if(cvS.seam.on){const t=cvT('seam');run(P.f_seam,t,{uSrc:cur.tex,uW:cvS.seam.w});cur=t;}
  cvS.prep=cur;cvS.prepDirty=false;cvS.lumOK=false;cvS.cache.pyr={};cvS.cache.pois=null;
  /* average brightness, for evening out the lighting */
  const S=32,sm=makeTarget(S,S,8,false);run(P.f_rs,sm,{uSrc:cur.tex,uOut:[S,S]});const d=captureRegionNow(sm,0,0,sm.w,sm.h).data;disposeTarget(sm);let s=0,n=0;for(let i=0;i<d.length;i+=4){if(d[i+3]<128)continue;s+=(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2])/255;n++;}cvS.mean=n?s/n:.5;
  return cur;}
/* brightness of the prepared source, with the 8-bit steps evened out */
function cvLum(){if(cvS.lumOK&&cvS.cache.lum)return cvS.cache.lum;const src=cvPrep(),l=cvT('lum');run(P.f_lum,l,{uSrc:src.tex});
  if(l.depth>8){let a=l,b=cvT('lumdb');for(const r of [2,4,8,16]){run(cvP().deband,b,{uSrc:a.tex,uR:r,uT:1.5/255});[a,b]=[b,a];}if(a!==l)blit(a,l,0,0,doc.w,doc.h,0,0);}
  cvS.lumOK=true;return l;}
/* brightness and its blurs at five sizes (noise removal first) */
function cvPyr(noise){const key=noise.toFixed(2);if(cvS.cache.pyr&&cvS.cache.pyr[key])return cvS.cache.pyr[key];cvS.cache.pyr=cvS.cache.pyr||{};
  const l=cvLum();const L0=cvT('L0_'+key);cvBlur(l,L0,noise*.8,'btA');
  const b1=cvT('b1_'+key),b2=cvT('b2_'+key);cvBlur(L0,b1,1.4,'btA');cvBlur(L0,b2,4,'btA');
  const d3=cvDown(L0,4,'d3'),b3=cvT('b3_'+key,d3.w,d3.h);cvBlur(d3,b3,3);const d4=cvDown(L0,8,'d4'),b4=cvT('b4_'+key,d4.w,d4.h);cvBlur(d4,b4,5);const d5=cvDown(L0,16,'d5'),b5=cvT('b5_'+key,d5.w,d5.h);cvBlur(d5,b5,8);
  return cvS.cache.pyr[key]={L0,b1,b2,b3,b4,b5};}
/* gains per band: a normal map needs much more of the big shapes (their slopes are gentle) */
function cvBands(dst,v,con,forNormal){const p=cvPyr(v.noise||0),g=forNormal?[4,8,18,40,80]:[4,3,2.5,2,1.5];run(cvP().bands,dst,{uL:p.L0.tex,uB1:p.b1.tex,uB2:p.b2.tex,uB3:p.b3.tex,uB4:p.b4.tex,uB5:p.b5.tex,uSize:[doc.w,doc.h],
  uF:v.fine,uM:v.med,uLg:v.large,uVL:v.vlarge,uHg:v.huge,uShape:v.shape,uCon:con,uInv:!!cvS.inv,uG:g.slice(0,4),uG5:g[4]});}
function cvOut(k){return cvT('out_'+k,doc.w,doc.h,k==='normal'||k==='base'?(canFloat?16:doc.depth):cvDepth());}
/* the height a normal-map source describes (slow: kept until the source changes) */
function cvPois(){if(cvS.cache.pois&&cvS.cache.poisDx===cvS.dx)return cvS.cache.pois;const t=cvT('pois',doc.w,doc.h,16);heightFromNormal(cvPrep(),t,{str:1,iter:50,dx:cvS.dx});cvS.cache.pois=t;cvS.cache.poisDx=cvS.dx;return t;}
/* ---------- each output ---------- */
const CV_MAKE={
  height(dst){const v=cvS.v.height,P2=cvP();
    if(cvS.kind==='photo'){const t=cvT('hraw');cvBands(t,v,v.con);const b=cvT('hb');cvBlur(t,b,1.5,'btB');run(P2.adjh,dst,{uH:t.tex,uB:b.tex,uCon:1,uSharp:v.sharp,uInv:false});}
    else{const src=cvS.kind==='normal'?cvPois():cvLum();const b=cvT('hb');cvBlur(src,b,1.5,'btB');run(P2.adjh,dst,{uH:src.tex,uB:b.tex,uCon:v.con,uSharp:v.sharp||0,uInv:cvS.kind==='height'&&!!cvS.inv});}
    if(v.smooth>.25){const t=cvT('hs');cvBlur(dst,t,v.smooth,'btB');blit(t,dst,0,0,doc.w,doc.h,0,0);}},
  normal(dst){const v=cvS.v.normal,P2=cvP(),mix=v.mix&&(doc.maps.includes('normal')||doc.maps.includes('height'));let dn=null;if(mix)dn=normalComposite(false,null);
    if(cvS.kind==='normal'){const s=cvT('ns');cvBlur(cvPrep(),s,v.noise*.8,'btC');const t=mix?cvT('nt'):dst;run(P2.nadj,t,{uN:s.tex,uStr:v.nstr,uInDX:!!cvS.dx,uOutDX:!!v.dx&&!mix});
      if(mix)run(P2.rnm,dst,{uA:t.tex,uB:dn.tex,uOutDX:!!v.dx});}
    else{let h;if(cvS.kind==='photo'){h=cvT('nh');cvBands(h,v,1,true);if(v.sharp>0){const b=cvT('nhb');cvBlur(h,b,1.2,'btC');const t=cvT('nhs');run(P2.adjh,t,{uH:h.tex,uB:b.tex,uCon:1,uSharp:v.sharp,uInv:false});h=t;}}
      else{h=cvT('nh');const l=cvLum();cvBlur(l,h,v.noise*.8,'btC');if(cvS.inv){const t=cvT('nhi');run(P2.adjh,t,{uH:h.tex,uB:h.tex,uCon:1,uSharp:0,uInv:true});h=t;}}
      run(P.nrm,dst,{uH:h.tex,uN:dn?dn.tex:dummy,uUseN:!!dn,uStr:v.str,uWrap:!!(cvS.seam.on||doc.wrap),uFlipY:!!v.dx});}
    if(dn)release(dn);},
  ao(dst){const v=cvS.v.ao,h=cvRes('height'),b1=cvT('ab1'),b2=cvT('ab2'),b3=cvT('ab3');cvBlur(h,b1,v.r*.25,'btD');cvBlur(h,b2,v.r*.5,'btD');cvBlur(h,b3,v.r,'btD');
    run(cvP().ao,dst,{uH:h.tex,uB1:b1.tex,uB2:b2.tex,uB3:b3.tex,uStr:v.str,uBal:v.bal});if(v.smooth>.25){const t=cvT('as');cvBlur(dst,t,v.smooth,'btD');blit(t,dst,0,0,doc.w,doc.h,0,0);}},
  curv(dst){const v=cvS.v.curv,n=cvS.kind==='normal'?cvPrep():cvRes('normal'),b=cvT('cb',doc.w,doc.h,n.depth);cvBlur(n,b,v.r,'btE');
    run(P.f_ncurv,dst,{uN:b.tex,uWrap:!!(cvS.seam.on||doc.wrap),uStr:v.str*(cvS.v.normal.dx&&cvS.kind!=='normal'?-1:1)*(cvS.kind==='normal'&&cvS.dx?-1:1),uMode:{int:v.part||0},uStep:Math.max(1,Math.round(v.r*.7))});
    if(v.smooth>.25){const t=cvT('cs');cvBlur(dst,t,v.smooth,'btE');blit(t,dst,0,0,doc.w,doc.h,0,0);}},
  rough(dst){cvKeyed(dst,'rough',0);},
  metal(dst){cvKeyed(dst,'metal',1);},
  base(dst){const v=cvS.v.base,src=cvPrep(),l=cvT('blum');run(P.f_lum,l,{uSrc:src.tex});const d=cvDown(l,Math.max(1,Math.pow(2,Math.floor(Math.log2(Math.max(1,v.r/6))))),'bd'),lb=cvT('blb',d.w,d.h);
    cvBlur(d,lb,Math.max(1,v.r/Math.max(1,doc.w/d.w)));run(cvP().base,dst,{uSrc:src.tex,uLB:lb.tex,uSize:[doc.w,doc.h],uMean:cvS.mean,uEven:v.even,uShad:v.shad,uHigh:v.high,uSat:v.sat});}};
function cvKeyed(dst,k,mode){const v=cvS.v[k],keys=cvS.keys[k].slice(0,6),kc=new Float32Array(18),kp=new Float32Array(18);keys.forEach((q,i)=>{kc.set(q.c,i*3);kp.set([q.v,q.tol,q.soft],i*3);});
  run(cvP().key,dst,{uSrc:cvPrep().tex,uMode:{int:mode},uMin:v.min||0,uMax:v.max||1,uCon:v.con||1,uBase:v.base||0,uInv:!!v.inv,uKC:{v3:kc},uKP:{v3:kp},uKN:{int:keys.length}});}
/* a result, computed if it is out of date */
function cvRes(k){const t=cvOut(k);if(cvS.dirty.has(k)||!cvS.res[k]){cvS.dirty.delete(k);CV_MAKE[k](t);cvS.res[k]=t;}return t;}
function cvCompute(){if(!cvS.src)return;cvPrep();const need=new Set([cvS.tab,...CV_OUTS[cvS.kind].filter(k=>cvS.make[k])]);
  for(const k of CV_OUTS[cvS.kind])if(need.has(k)&&(cvS.dirty.has(k)||!cvS.res[k]))cvRes(k);
  if(!cvS.thumbs&&cvS.kind!=='normal')cvThumbs();cvView=null;v3.dirty=true;cvS.v3dirty=true;requestRender();}
let cvView=null;
/* the two "which looks right?" previews: the photo as bumps pushed out and pushed in */
function cvThumbs(){const S=112,P2=cvP();cvS.thumbs=[];const keepInv=cvS.inv;
  for(const inv of [false,true]){cvS.inv=inv;const h=cvT('th_h');cvBands(h,cvS.v.normal,1,true);const n=cvT('th_n');run(P.nrm,n,{uH:h.tex,uN:dummy,uUseN:false,uStr:cvS.v.normal.str,uWrap:false,uFlipY:false});
    const sm=makeTarget(S,S,8,false);run(P2.shade,sm,{uN:n.tex,uSize:[S,S]});const d=captureRegionNow(sm,0,0,sm.w,sm.h).data;disposeTarget(sm);cvS.thumbs.push(d);}
  cvS.inv=keepInv;const box=$('#cvThumbs');if(box)cvDrawThumbs(box);}
function cvDrawThumbs(box){box.querySelectorAll('canvas').forEach((c,i)=>{const d=cvS.thumbs&&cvS.thumbs[i];if(!d)return;const x=c.getContext('2d'),im=x.createImageData(112,112);im.data.set(d);x.putImageData(im,0,0);});}

/* ---------- workspace ---------- */
function convertEnter(){const own=tabDocs.own.convert,ps=paintDocSize();tabDocEnter('convert',own?own.doc.w:ps[0],own?own.doc.h:ps[1],'Convert');
  const work=$('#work');cvS.prev3d={on:v3.on,w:getComputedStyle(work).getPropertyValue('--pane3d')};
  if(!v3.on)toggle3D(true);if(!v3.pop)work.style.setProperty('--pane3d',Math.round(work.clientWidth*.46)+'px');
  if(!cvS.src){if(withPaintDoc(()=>doc.maps.includes('base')&&paintLayers().some(L=>hasMap(L,'base'))))cvSourceFromDoc('base');}
  const s=v3s();if(s.model==='plane'&&!v3.convModel){v3.convModel=true;s.model='sphere';v3LoadModel();}
  buildConvertPanel();build3dPane();cvAllDirty();v3.dirty=true;resizeGL();fit();requestRender(true);}
function convertExit(){tabDocExit('convert');const p=cvS.prev3d;cvS.prev3d=null;v3.btex=null;cvS.pick=null;cvS.persp.edit=false;
  if(p&&!p.on)toggle3D(false);else if(p&&!v3.pop)$('#work').style.setProperty('--pane3d',p.w||'0px');v3.mapsDirty=true;v3.dirty=true;resizeGL();fit();requestRender(true);}
/* canvas: the result being edited, or the source */
function cvViewTex(){if(!cvS.src){return cvT('empty',doc.w,doc.h,8);}
  if(cvS.show==='source'||cvS.persp.edit||cvS.pick)return cvS.persp.edit?cvS.src:cvPrep();const t=cvS.res[cvS.tab];return t||cvPrep();}
/* model: all results together */
function cvV3Refresh(){if(!cvS.v3dirty&&v3.btex)return;cvS.v3dirty=false;const r=cvS.res,T={};
  T.base=cvS.kind==='photo'?(cvS.make.base&&r.base?r.base:cvPrep()):cvT('grey',4,4,8);if(cvS.kind!=='photo'&&!cvS.greyed){clearTarget(T.base,[.62,.62,.64,1]);cvS.greyed=true;}
  if(r.normal)T.nfinal=r.normal;if(r.ao&&cvS.make.ao)T.ao=r.ao;if(r.rough&&cvS.make.rough)T.rough=r.rough;if(r.metal&&cvS.make.metal)T.metal=r.metal;
  v3.btex=T;v3.bunlit=false;v3.dirty=true;}

/* ---------- pointer on the canvas: pick colours, move the perspective corners ---------- */
function cvPointerDown(e,ix,iy){
  if(cvS.persp.edit){const q=cvS.persp.q,[sx,sy]=stageXY(e);let best=-1,bd=12;q.forEach((p,i)=>{const s=scrPt(p),d=Math.hypot(s[0]-sx,s[1]-sy);if(d<bd){bd=d;best=i;}});
    if(best>=0){ptr={mode:'cvq',id:e.pointerId,i:best};return;}return;}
  if(cvS.pick){const src=cvPrep(),x=clamp(Math.floor(ix),0,doc.w-1),y=clamp(Math.floor(iy),0,doc.h-1),d=captureRegionNow(src,x,y,1,1);const px=d.data;const a=(src.depth===16?h2fLut()[px[3]]:px[3]/255)||1;
    const f=i=>src.depth===16?h2fLut()[px[i]]:px[i]/255,c=[f(0)/a,f(1)/a,f(2)/a].map(v=>clamp(v,0,1));const k=cvS.pick;cvS.pick=null;
    cvS.keys[k].push({c,v:k==='metal'?1:.2,tol:.12,soft:.5});if(cvS.keys[k].length>6)cvS.keys[k].shift();cvChanged(k);buildConvertPanel();toast('Colour picked. Adjust its value and tolerance in the panel.');requestRender();return;}}
function cvPointerMove(e,mx,my){if(ptr.mode==='cvq'){cvS.persp.q[ptr.i]=[clamp(mx,0,doc.w),clamp(my,0,doc.h)];cvS.prepDirty=true;cvAllDirty();drawXfOverlay();}}
function cvOverlay(){if(ui.mode!=='convert'||!cvS.persp.edit||!cvS.persp.q)return '';const f=p=>scrPt(p).map(v=>v.toFixed(1)).join(' ');const q=cvS.persp.q;
  let s='<path class="ln" d="M'+q.map(f).join('L')+'Z"/>';for(const p of q){const c=scrPt(p);s+='<rect class="hs" x="'+(c[0]-5)+'" y="'+(c[1]-5)+'" width="10" height="10"/>';}return s;}

/* ---------- sending and exporting ---------- */
const cvMade=()=>CV_OUTS[cvS.kind].filter(k=>cvS.make[k]);
/* send the ticked maps to the painting, as plain layers (scaled to its size when it differs) */
function cvSend(){if(!cvS.src){toast('Pick a source first.');return;}const ks=cvMade();if(!ks.length){toast('Tick at least one map to make.');return;}
  const sg=withPaintDoc(()=>doc.workflow==='spec'),mapOf=k=>sg&&k==='rough'?'gloss':sg&&k==='metal'?'spec':CV_MAP[k],nameOf=k=>sg&&k==='rough'?'Glossiness':sg&&k==='metal'?'Specular':CV_NAMES[k];
  /* each result as it will go in, at the Convert canvas's size */
  const src={},tmp=[];for(const k of ks){const r=cvRes(k),m=mapOf(k);if(m==='gloss'||m==='spec'){const t=makeTarget(r.w,r.h,r.depth,false);run(cvP().tosg,t,{uSrc:r.tex,uCol:cvPrep().tex,uSpec:m==='spec'});src[k]=t;tmp.push(t);}else src[k]=r;}
  let n=0,replaced=false;
  withPaintDoc(()=>{const need=ks.map(mapOf).filter(m=>!doc.maps.includes(m));if(need.length)setDocMaps([...doc.maps,...need],'Add maps for the conversion');
    const mk=k=>{const m=mapOf(k),L=newLayerObj('Converted '+nameOf(k).toLowerCase());for(const x of Object.keys(L.maps))if(x!=='base'&&x!==m){disposeTarget(L.maps[x]);delete L.maps[x];}
      copyScaled(src[k],ensureMapTarget(L,m));if(m!=='base'){L.blankBase=true;setMapModeOf(L,m,0);}L.converted=true;return L;};
    const old=cvS.replace?cvS.sent.filter(x=>x.parent&&allNodes().includes(x)):[];replaced=old.length>0;
    structOp(old.length?'Replace converted maps':'Convert maps',()=>{for(const x of old)detachNode(x);const Ls=ks.map(mk);for(const L of Ls)insertNode(L,doc.root);cvS.sent=Ls;n=Ls.length;});
    syncTargets();changedAll();refreshMapsUI();});
  tmp.forEach(disposeTarget);v3Changed();toast((replaced?'Replaced':'Sent')+' '+n+' map'+(n>1?'s':'')+' to the painting, as layers.');}
async function cvExport(){if(!cvS.src){toast('Pick a source first.');return;}const ks=cvMade();if(!ks.length){toast('Tick at least one map to make.');return;}
  let dir=null;if(platform.isDesktop){dir=await platform.pickFolder();if(!dir)return;}
  loadStart('Exporting maps');try{const files=[],name=pascal(cvS.srcName||'Texture');let i=0;
    for(const k of ks){loadSet(i++/ks.length,CV_NAMES[k]+'…');await loadPaint();const t=cvRes(k),C=k==='normal'||k==='base'?(k==='base'?4:3):1;let f=readMapF(t,C===3?4:C);if(C===3)f=dropAlpha(f,doc.w*doc.h);
      const blob=await encodeTex(doc.w,doc.h,f,C,'png',k==='height'&&canFloat?16:8);files.push({name:name+'_'+(k==='curv'?'Curvature':k==='ao'?'AO':CV_NAMES[k].replace(/\s/g,''))+'.png',data:new Uint8Array(await blob.arrayBuffer())});}
    if(dir){const sep=dir.includes('\\')?'\\':'/';for(const f of files)await platform.writeFile(dir.replace(/[\\/]$/,'')+sep+f.name,f.data);toast('Saved '+files.length+' maps to '+dir);}
    else{const r=await deliver(name+'_maps.zip',await makeZipMulti(files));toast(deliveredText(r,'Maps'));}}
  catch(e){console.error(e);toast('Export failed: '+(e.message||e));}finally{loadEnd();}}

/* Maps menu: open the tab on a source map with one output's settings showing */
function cvOpen(from,to){if(!setMode('convert',true))return;if(from){const ok=cvSourceFromDoc(from);if(ok&&from==='base')cvSetKind('photo');}cvS.tab=CV_OUTS[cvS.kind].includes(to)?to:cvS.tab;if(to)cvS.make[to]=true;buildConvertPanel();cvAllDirty();}
function cvReset(){if(cvS.src&&cvS.srcOwn)disposeTarget(cvS.src);cvS.src=null;cvS.srcName='';cvS.res={};cvS.prep=null;cvS.prepDirty=true;for(const k in cvS.cache){const t=cvS.cache[k];if(t&&t.tex)disposeTarget(t);}cvS.cache={};cvS.sent=[];cvS.persp.q=null;cvS.persp.on=false;cvS.thumbs=null;cvS.greyed=false;}
/* ---------- panel ---------- */
function buildConvertPanel(){const box=$('#convBody');if(!box)return;box.replaceChildren();const row=(label,ctrl)=>el('div',{class:'frow'},el('label',{text:label}),ctrl);
  /* source */
  const src=el('select',{id:'cvSource','aria-label':'Source'},el('option',{value:'',text:cvS.src?cvS.srcName:'Choose a source…'}),
    ...['base','height','normal','rough','ao'].filter(k=>doc.maps.includes(k)||(k==='normal'&&doc.maps.includes('height'))).map(k=>el('option',{value:'map:'+k,text:MAP_DEFS[k].label+(k==='normal'?' (final)':'')+' of the document'})),
    el('option',{value:'layer',text:'Active layer ('+MAP_DEFS[doc.map].label.toLowerCase()+')'}),el('option',{value:'file',text:'Image file…'}));
  src.onchange=()=>{const v=src.value;src.value='';if(v==='file')cvPickFile();else if(v==='layer')cvSourceFromDoc('layer');else if(v.startsWith('map:'))cvSourceFromDoc(v.slice(4));};
  const lb=el('button',{class:'btn sm',text:'Load…',id:'cvLoad',title:'Load an image, or drop one here'});lb.onclick=cvPickFile;
  box.append(el('p',{class:'note',text:'Pick a source or drop an image here, say what it is, then tick the maps to make and fine-tune each one. Everything previews live.'}),row('Source',el('div',{class:'bkmodel'},src,lb)));
  if(!cvS.src){box.append(el('p',{class:'note warn',text:'No source yet.'}));return;}
  box.append(el('div',{class:'sub',text:'This image is'+(cvS.guess?' (it looks like: '+CV_KINDS.find(k=>k[0]===cvS.guess)[1].toLowerCase()+')':'')}),seg(CV_KINDS,cvS.kind,k=>cvSetKind(k),'Source type'));
  if(cvS.kind==='normal')box.append(el('div',{class:'chips'},chk('cvDX','Green points down (DirectX)',cvS.dx,v=>{cvS.dx=v;cvS.cache.pois=null;cvAllDirty();})));
  if(cvS.kind!=='normal'){const tb=el('div',{class:'cvthumbs',id:'cvThumbs'});for(const [inv,label] of [[false,'Bumps out'],[true,'Bumps in']]){const b=el('button',{class:'cvthumb'+(cvS.inv===inv?' on':''),title:'Light areas '+(inv?'sink in':'come forward')},el('canvas',{width:112,height:112}),el('span',{text:label}));
      b.onclick=()=>{cvS.inv=inv;cvAllDirty();buildConvertPanel();};tb.append(b);}
    box.append(el('div',{class:'sub',text:'Which looks right?'}),tb);if(cvS.thumbs)cvDrawThumbs(tb);}
  /* before converting */
  const pre=el('details',{class:'more'},el('summary',{text:'Straighten and make seamless'}));pre.open=cvS.persp.on||cvS.seam.on;
  const pg=el('div',{class:'dlg-grid'});
  pg.append(el('div',{class:'chips'},chk('cvPersp','Straighten (fix perspective)',cvS.persp.on,v=>{cvS.persp.on=v;if(v&&!cvS.persp.q){const m=Math.round(Math.min(doc.w,doc.h)*.08);cvS.persp.q=[[m,m],[doc.w-m,m],[doc.w-m,doc.h-m],[m,doc.h-m]];cvS.persp.edit=true;}if(!v)cvS.persp.edit=false;cvS.prepDirty=true;cvAllDirty();buildConvertPanel();drawXfOverlay();})));
  if(cvS.persp.on){const eb=el('button',{class:'btn sm'+(cvS.persp.edit?' on':''),text:cvS.persp.edit?'Done moving corners':'Move corners'});eb.onclick=()=>{cvS.persp.edit=!cvS.persp.edit;buildConvertPanel();drawXfOverlay();requestRender();};
    pg.append(el('p',{class:'note',text:'Drag the four corners onto the edges of the surface in the photo (a wall, a floor tile). It is stretched out flat before converting.'}),eb);}
  pg.append(el('div',{class:'chips'},chk('cvSeam','Make seamless',cvS.seam.on,v=>{cvS.seam.on=v;cvS.prepDirty=true;cvAllDirty();buildConvertPanel();})));
  if(cvS.seam.on)pg.append(makeSlider({id:'cvSeamW',label:'Blend width',min:.05,max:1,step:.01,value:cvS.seam.w,fmt:pct,onInput:v=>{cvS.seam.w=v;cvS.prepDirty=true;cvAllDirty();}}).el);
  pre.append(pg);box.append(pre);
  /* what to make */
  const outs=CV_OUTS[cvS.kind];if(!outs.includes(cvS.tab))cvS.tab=outs[0];
  box.append(el('div',{class:'sub',text:'Make'}),el('div',{class:'chips'},...outs.map(k=>chk('cvMk_'+k,CV_NAMES[k],!!cvS.make[k],v=>{cvS.make[k]=v;cvSchedule();cvS.v3dirty=true;}))));
  {const sg=seg(outs.map(k=>[k,k==='ao'?'AO':CV_NAMES[k].replace(' colour','')]),cvS.tab,k=>{cvS.tab=k;cvSchedule();buildConvertPanel();requestRender();},'Settings for');sg.classList.add('wrapseg');box.append(el('div',{class:'sub',text:'Settings for'}),sg);}
  const k=cvS.tab,v=cvS.v[k];box.append(el('p',{class:'note',text:CV_NOTES[k]}));
  for(const d of CV_DEFS[k]){if(d.kinds&&!d.kinds.includes(cvS.kind))continue;box.append(makeSlider(Object.assign({},d,{id:'cv_'+k+'_'+d.key,value:v[d.key],onInput:x=>{v[d.key]=x;cvChanged(k);}})).el);}
  if(k==='normal')box.append(el('div',{class:'chips'},chk('cvNdx','DirectX (green down, for Unreal)',!!v.dx,x=>{v.dx=x;cvChanged('normal');}),
    ...(doc.maps.includes('normal')||doc.maps.includes('height')?[chk('cvNmix','Mix with the document’s normal map',!!v.mix,x=>{v.mix=x;cvChanged('normal');})]:[])));
  if(k==='curv')box.append(seg([[0,'Edges and cavities'],[1,'Edges only'],[2,'Cavities only']],v.part||0,x=>{v.part=x;cvChanged('curv');},'Show'));
  if(k==='rough')box.append(el('div',{class:'chips'},chk('cvRinv','Invert',!!v.inv,x=>{v.inv=x;cvChanged('rough');})));
  if(k==='rough'||k==='metal'){const pk=el('button',{class:'btn sm'+(cvS.pick===k?' on':''),text:cvS.pick===k?'Click a colour in the image…':'Pick a colour'});pk.onclick=()=>{cvS.pick=cvS.pick===k?null:k;buildConvertPanel();requestRender();};
    box.append(el('div',{class:'row wrap'},pk));
    cvS.keys[k].forEach((q,i)=>{const sw=el('span',{class:'cvsw'});sw.style.background='rgb('+q.c.map(x=>Math.round(x*255)).join(',')+')';
      const rm=el('button',{class:'btn sm',text:'×',title:'Remove'});rm.onclick=()=>{cvS.keys[k].splice(i,1);cvChanged(k);buildConvertPanel();};
      box.append(el('div',{class:'cvkey'},sw,el('div',{class:'dlg-grid'},makeSlider({id:'cvk'+k+i+'v',label:k==='metal'?'Metallic':'Roughness',min:0,max:1,step:.01,value:q.v,fmt:pct,onInput:x=>{q.v=x;cvChanged(k);}}).el,
        makeSlider({id:'cvk'+k+i+'t',label:'Tolerance',min:.01,max:.6,step:.01,value:q.tol,fmt:pct,onInput:x=>{q.tol=x;cvChanged(k);}}).el,makeSlider({id:'cvk'+k+i+'s',label:'Softness',min:0,max:1,step:.01,value:q.soft,fmt:pct,onInput:x=>{q.soft=x;cvChanged(k);}}).el),rm));});}
  box.append(el('div',{class:'sub',text:'Canvas shows'}),seg([['result','This map'],['source','The source']],cvS.show,x=>{cvS.show=x;requestRender();},'Canvas shows'));
  const send=el('button',{class:'btn primary',id:'cvSend',text:'Send to document'});send.onclick=cvSend;const ex=el('button',{class:'btn',id:'cvExport',text:'Export files…'});ex.onclick=cvExport;const tm=el('button',{class:'btn',id:'cvToMat',text:'Turn into material…',title:'Save these maps as a material in Materials, ready for 3D Paint'});tm.onclick=dlgCvMaterial;
  box.append(el('div',{class:'chips'},chk('cvRepl','Replace the last converted maps',cvS.replace,x=>{cvS.replace=x;})),el('div',{class:'row wrap'},send,ex,tm));}

/* ---- (0.27, Kenn) Turn into material: the converted maps become a material in Materials (and 3D Paint) ----
   Base colour is the lighting-evened colour when it is made, otherwise the photo itself; normal, height, AO,
   roughness and metallic come from the conversion. Curvature is a measurement, not a material channel. */
const CV_MAT_CH=['base','normal','height','ao','rough','metal'];
function cvMaterialRec(name,max){const made=new Set(cvMade()),pix={},fill=fillDefaults();for(const k in fill.maps)fill.maps[k].on=false;
  for(const k of CV_MAT_CH){let t=null;if(k==='base')t=made.has('base')?cvRes('base'):cvPrep();else if(made.has(k))t=cvRes(k);if(!t)continue;
    const s=Math.min(1,(max||1e9)/Math.max(t.w,t.h)),w=Math.max(1,Math.round(t.w*s)),h=Math.max(1,Math.round(t.h*s)),o=makeTarget(w,h,8,false);copyScaled(t,o);
    const d=captureRegionNow(o,0,0,w,h).data;disposeTarget(o);pix[k]={w,h,data:new Uint8Array(d.buffer.slice(0))};
    if(fill.maps[k])Object.assign(fill.maps[k],{on:true,src:'image',name:(CV_NAMES[k]||k)+' (converted)',tile:1,rot:0});}
  /* (0.38) a decal keeps the picture's cut-out on every map and sits on the model like a sticker */
  if(cvS.decal&&cvS.src){for(const k in pix){const P=pix[k],o=makeTarget(P.w,P.h,8,false);copyScaled(cvS.src,o);const a=captureRegionNow(o,0,0,P.w,P.h).data;disposeTarget(o);for(let i=3;i<P.data.length;i+=4)P.data[i]=a[i];}
    fill.decal=true;fill.proj='planar';fill.rep=false;fill.front=true;}
  if(!fill.maps.rough.on)Object.assign(fill.maps.rough,{on:true,src:'value',v:.6});if(!fill.maps.metal.on)Object.assign(fill.maps.metal,{on:true,src:'value',v:0});
  if(fill.maps.height.on)fill.hStr=1;
  return {id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:name||'Converted material',t:Date.now(),fill,imgs:pix};}
function dlgCvMaterial(){if(!cvS.src){toast('Pick a source first.');return;}
  let name=(cvS.srcName||'Converted').replace(/\.[a-z0-9]+$/i,'').replace(/[_-]+/g,' ').trim()||'Converted',max=2048,add=true;
  const nm=el('input',{type:'text',id:'cvMatName',value:name});nm.addEventListener('input',()=>{name=nm.value;});
  const made=cvMade().filter(k=>CV_MAT_CH.includes(k)).map(k=>CV_NAMES[k].toLowerCase());
  openDialog({title:'Turn into material',body:el('div',{class:'dlg-grid'},el('div',{class:'frow'},el('label',{for:'cvMatName',text:'Name'}),nm),
      el('p',{class:'note',text:'Base colour'+(made.length?', '+made.join(', '):'')+'. Saved in Materials so every 3D Paint project can use it; tick more maps above to include them.'}),
      el('div',{class:'sub',text:'Picture size'}),seg([[1024,'1K'],[2048,'2K'],[4096,'4K'],[0,'Full size']],max,v=>{max=+v;},'Picture size'),
      chk('cvMatAdd','Also add it to 3D Paint now (a new material layer in the texture set)',add,v=>{add=v;})),
    okLabel:'Make material',onOk(){const rec=cvMaterialRec(name.trim(),max);matLib.list.push(rec);store.put(rec,'materials');if(typeof renderMats==='function')renderMats();
      if(add&&setMode('p3d',true)){matApply(rec);toast('“'+rec.name+'” is in Materials and on a new layer in 3D Paint.');}
      else toast('Saved “'+rec.name+'” in Materials. Add it from the Materials tab in 3D Paint.');}});}
