/* ================= Hand-painted layer (0.78) =================
   One layer that paints a hand-painted look from the model's own shape, like the stylized "diffuse" generators artists use:
   no real light, only the shape: which way each part faces (world-space normal; up = green), how high it sits on the model,
   its crevices (AO), its edges and cavities (curvature) and how thin it is (thickness). Each of those tints the colour.
   It reads the baked mesh maps when there are some, else the model itself (3D Paint), else the document's maps or the picture
   (the Paint tab), so it works everywhere. On top: painted highlights, colour variation and brush strokes stamped with a tip
   from the Brushes panel (each stamp takes one colour, which gives the blocky painted look). Roughness and metallic can be made
   from the colour.
   L.fx = {map:'all', stack:[{id:'handPaint', v}]}: a filter layer that acts on every map (see compositeList). With "Own colour"
   it covers what is below (its mask limits it); with "Paint over the layers below" it adds the light to them (a polypaint). */
let P_HP=null;
function hpProgs(){if(P_HP)return P_HP;
  const light=GL_ST+MS_NOISE_GLSL+MS_SURF_GLSL+`
uniform sampler2D uSrc; uniform sampler2D uBlur; uniform sampler2D uTan; uniform sampler2D uTN; uniform sampler2D uDN2; uniform int uHasTan; uniform int uHasTN; uniform int uHasDN2; uniform float uNDet;
uniform sampler2D uWN; uniform sampler2D uPM; uniform sampler2D uCurv; uniform sampler2D uAO; uniform sampler2D uThick;
uniform sampler2D uCurvB; uniform int uHasCurvB; uniform int uHasWN; uniform int uHasPM; uniform int uHasCurv; uniform int uHasAO; uniform int uHasThick; uniform int uOwn; uniform int uFormMode; uniform int uSpCount; uniform int uShowN; uniform int uWrap;
uniform vec3 uBase; uniform vec3 uL; uniform vec3 uShCol; uniform vec3 uLtCol; uniform vec3 uUlCol; uniform vec3 uGTop; uniform vec3 uGBot; uniform vec3 uAoCol; uniform vec3 uEdgeCol; uniform vec3 uCavCol; uniform vec3 uThCol; uniform vec3 uSpCol; uniform vec3 uVarCol;
uniform float uShAmt; uniform float uShSpread; uniform float uLtAmt; uniform float uForm; uniform float uUlAmt; uniform float uGTopAmt; uniform float uGBotAmt; uniform float uGOff; uniform float uGSpread;
uniform float uAoAmt; uniform float uAoSpread; uniform float uEdgeAmt; uniform float uEdgeSpread; uniform float uCavAmt; uniform float uCavSpread; uniform float uThAmt;
uniform float uSpAmt; uniform float uSpExp; uniform float uSpH; uniform float uSpRot; uniform float uVarAmt; uniform float uVarScale; uniform float uPic; uniform float uMul; uniform float uOver; uniform float uSat;
float lum(vec3 c){ return dot(c,vec3(0.299,0.587,0.114)); }
vec3 ovl(vec3 a,vec3 b){ return mix(2.0*a*b,1.0-2.0*(1.0-a)*(1.0-b),step(0.5,a)); }
vec3 scr(vec3 a,vec3 b){ return 1.0-(1.0-a)*(1.0-b); }
float bl(ivec2 q,ivec2 s){ return lum(st(texelFetch(uBlur,wrapP(q,s,uWrap),0))); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec2 uv=(vec2(p)+0.5)/vec2(s);
  vec4 sc=texelFetch(uSrc,p,0); vec3 below=st(sc); vec3 c=uOwn==1?uBase:below; float a=uOwn==1?1.0:sc.a;
  /* which way it faces: the baked world-space normal, else the model, else the document's normal map, else flat */
  vec3 N=surfN(); bool model=uHasPos==1&&texelFetch(uPos,p,0).a>0.5;
  bool wnOk=false; if(uHasWN==1){ vec4 w=texelFetch(uWN,p,0); if(w.a>0.5){ N=normalize(w.rgb*2.0-1.0+1e-5); model=true; wnOk=true; } }
  /* fine detail from normal maps on top of the model's shape: the baked normal (when there is no baked world normal, which
     already has it) and the normal painted in the layers below, turned onto the surface with the model's tangents */
  if(model&&uHasTan==1&&uNDet>0.0){ vec4 tg=texelFetch(uTan,p,0); vec3 t=vec3(0.0,0.0,1.0);
    if(uHasTN==1&&!wnOk){ vec4 q=texelFetch(uTN,p,0); if(q.a>0.01){ vec3 b=st(q)*2.0-1.0; t=normalize(vec3(t.xy+b.xy,t.z*b.z)); } }
    if(uHasDN2==1){ vec4 q=texelFetch(uDN2,p,0); if(q.a>0.01){ vec3 b=st(q)*2.0-1.0; t=normalize(vec3(t.xy+b.xy,t.z*b.z)); } }
    if(length(tg.xyz)>0.1){ vec3 T=normalize(tg.xyz-N*dot(N,tg.xyz)), B=cross(N,T)*(tg.w<0.0?-1.0:1.0); t.xy*=uNDet; N=normalize(T*t.x+B*t.y+N*max(t.z,0.05)); } }
  /* no model: the picture's own light and dark give it shape (bright = raised), as a painter reads a photo */
  float pb=bl(p,s);
  if(!model&&uPic>0.0){ float hx=bl(p+ivec2(2,0),s)-bl(p-ivec2(2,0),s), hy=bl(p+ivec2(0,2),s)-bl(p-ivec2(0,2),s); N=normalize(N+vec3(-hx,hy,0.0)*uPic*6.0); }
  if(uShowN==1){ o=vec4(N*0.5+0.5,1.0); return; }
  float d=dot(N,uL), lam=d*0.5+0.5;
  /* shadow side (multiplied) and lit side (overlaid), the main two tones of a painted form */
  float sh=1.0-smoothstep(0.5-uShSpread*0.5-0.002,0.5+uShSpread*0.5+0.002,lam); c=mix(c,c*uShCol,sh*uShAmt);
  c=mix(c,ovl(c,uLtCol),smoothstep(0.5,1.0,lam)*uLtAmt);
  /* the normals laid over the colour in grey (overlay or linear add): brings back the forms, as in the polypaint trick */
  if(uForm>0.0){ if(uFormMode==0) c=mix(c,ovl(c,vec3(lam)),uForm); else c=c+(lam-0.5)*uForm*0.6; }
  c=mix(c,scr(c,uUlCol),smoothstep(0.0,1.0,-d)*uUlAmt);
  /* height on the model along the light: dark at the bottom, light at the top */
  vec3 P3=surfP(uv); if(uHasPM==1){ vec4 q=texelFetch(uPM,p,0); if(q.a>0.5) P3=q.rgb; }
  if(uShowN==3){ o=vec4(P3,1.0); return; }
  float y=clamp(dot(P3-0.5,uL)+0.5,0.0,1.0), g=smoothstep(uGOff-uGSpread*0.5-0.001,uGOff+uGSpread*0.5+0.001,y);
  c=mix(c,c*uGBot,(1.0-g)*uGBotAmt); c=mix(c,ovl(c,uGTop),g*uGTopAmt);
  /* crevices: baked AO, else the document's AO map, else the picture (darker than around it) */
  float ao=1.0; if(uHasAO==1){ vec4 q=texelFetch(uAO,p,0); ao=q.a>0.01?lum(st(q)):1.0; } else ao=1.0-clamp((pb-lum(below))*4.0,0.0,1.0);
  float occ=pow(clamp(1.0-ao,0.0,1.0),mix(3.0,0.35,uAoSpread)); c=mix(c,c*uAoCol,occ*uAoAmt);
  /* edges (convex) and cavities (concave): curvature, or the picture's own fine light and dark */
  float cv=0.0; if(uHasCurv==1){ vec4 q=texelFetch(uCurv,p,0); if(q.a>0.01){ float c0=lum(st(q))-0.5;
    /* the blurred curvature makes edges soft painted bands, not thin lines; baked curvature is subtle (edges near 60% grey), so it is boosted */
    vec4 qb=texelFetch(uCurvB,p,0); float cb=qb.a>0.01?lum(st(qb))-0.5:c0; cv=clamp(mix(c0,cb*3.0,uHasCurvB==1?0.8:0.0)*6.0,-1.0,1.0); } } else cv=clamp((lum(below)-pb)*5.0,-1.0,1.0);
  /* (0.79) the shape as data for other layers: AO, curvature (0.5 = flat) and thinness */
  if(uShowN==2){ float th=0.0; if(uHasThick==1){ vec4 q=texelFetch(uThick,p,0); if(q.a>0.01) th=1.0-lum(st(q)); } o=vec4(ao,cv*0.5+0.5,th,1.0); return; }
  float e=smoothstep(mix(0.6,0.02,uEdgeSpread),mix(0.95,0.3,uEdgeSpread),cv), k=smoothstep(mix(0.6,0.02,uCavSpread),mix(0.95,0.3,uCavSpread),-cv);
  c=mix(c,scr(c,uEdgeCol),e*uEdgeAmt); c=mix(c,c*uCavCol,k*uCavAmt);
  /* thin parts glow (ears, fingers, crystal tips) */
  if(uHasThick==1&&uThAmt>0.0){ vec4 q=texelFetch(uThick,p,0); if(q.a>0.01){ float thin=1.0-lum(st(q)); c=mix(c,scr(c,uThCol),thin*uThAmt); } }
  /* painted highlights: a ring of small lights around the model, no view needed (stays put when you turn it) */
  if(uSpAmt>0.0&&uSpCount>0){ float hs=0.0; for(int i=0;i<8;i++){ if(i>=uSpCount) break; float az=uSpRot+6.2831853*float(i)/float(uSpCount);
      vec3 Li=vec3(cos(uSpH)*sin(az),sin(uSpH),cos(uSpH)*cos(az)); hs+=pow(max(dot(N,Li),0.0),uSpExp); } c+=uSpCol*hs*uSpAmt; }
  /* colour variation: soft blotches of lighter and darker paint and a second hue (on the model, so seams don't show) */
  if(uVarAmt>0.0){ vec3 q=model?P3*uVarScale:vec3(uv*uVarScale,0.0); float n1=fbm(q), n2=fbm(q*1.7+vec3(3.1,7.7,1.3));
    c=mix(c,c*(0.7+0.6*n1),uVarAmt); c=mix(c,ovl(c,uVarCol),smoothstep(0.45,0.75,n2)*uVarAmt); }
  /* final push */
  c=clamp(c,0.0,1.0); c=mix(c,c*c,uMul); c=mix(c,ovl(c,c),uOver); float L=lum(c); c=mix(vec3(L),c,uSat);
  o=vec4(clamp(c,0.0,1.0)*a,a); }`;
  /* brush strokes: stamps of a brush tip on a jittered grid, each filled with the colour at its centre and turned along the forms */
  const strokes=GL_ST+`uniform sampler2D uA; uniform sampler2D uTip; uniform vec2 uTipS; uniform float uSize; uniform float uRand; uniform float uDens; uniform float uRot; uniform float uRotRand;
uniform float uFollow; uniform float uDetail; uniform float uDrop; uniform float uKeep; uniform float uOp; uniform float uAmt; uniform float uSeed; uniform int uWrap;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)+uSeed*0.0137); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float lm(ivec2 q,ivec2 s){ vec4 c=texelFetch(uA,wrapP(q,s,uWrap),0); return dot(st(c),vec3(0.299,0.587,0.114)); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uA,0); vec4 c0=texelFetch(uA,p,0); if(c0.a<0.01){ o=c0; return; }
  vec2 x=vec2(p)+0.5; float big=uSize*(1.0+uRand), cell=max(max(2.0,uSize/max(uDens,0.2)),big*0.375); vec2 ci=floor(x/cell);
  vec4 res=c0;
  for(int dy=-2;dy<=2;dy++)for(int dx=-2;dx<=2;dx++){ vec2 cc=ci+vec2(dx,dy);
    float r1=h21(cc),r2=h21(cc+11.3),r3=h21(cc+23.7),r4=h21(cc+37.1),r6=h21(cc+51.9);
    if(r6<uDrop) continue;
    vec2 ctr=(cc+vec2(r1,r2))*cell; ivec2 cp=wrapP(ivec2(floor(ctr)),s,uWrap); vec4 k=texelFetch(uA,cp,0); if(k.a<0.5) continue;
    float size=max(1.0,uSize*(1.0+(r3*2.0-1.0)*uRand)), ang=uRot+(r4*2.0-1.0)*uRotRand*3.1415927;
    if(uFollow>0.0){ int st2=max(1,int(size*0.35)); float gx=lm(cp+ivec2(st2,0),s)-lm(cp-ivec2(st2,0),s), gy=lm(cp+ivec2(0,st2),s)-lm(cp-ivec2(0,st2),s);
      if(abs(gx)+abs(gy)>1e-3){ float a2=atan(gx,-gy)+(r4*2.0-1.0)*uRotRand*3.1415927+uRot; float dd=mod(a2-ang+3.1415927,6.2831853)-3.1415927; ang+=dd*uFollow; } }
    vec2 d=x-ctr; if(uWrap==1) d-=round(d/vec2(s))*vec2(s);
    float cs=cos(ang),sn=sin(ang); vec2 l=vec2(cs*d.x+sn*d.y,-sn*d.x+cs*d.y);
    vec2 wh=uTipS.x>=uTipS.y?vec2(size,size*uTipS.y/uTipS.x):vec2(size*uTipS.x/uTipS.y,size), t=l/wh+0.5;
    if(t.x<0.0||t.y<0.0||t.x>1.0||t.y>1.0) continue;
    float ta=texture(uTip,t).r; if(ta<0.02) continue;
    /* a stamp does not cross into a very different colour (another part of the model, or another island) */
    ta*=1.0-smoothstep(0.12,0.35,length(st(k)-st(c0)))*uKeep;
    vec4 col=mix(vec4(st(k)*c0.a,c0.a),c0,uDetail); res=mix(res,col,clamp(ta*uOp,0.0,1.0)); }
  o=mix(c0,res,uAmt); }`;
  /* roughness / gloss / metallic from the colour (luma), or a plain value */
  /* the other maps from the painted colour: roughness / gloss / metallic (a value, partly from the colour's luma), and for the
     Spec/Gloss workflow the specular colour and the diffuse (metal parts have dark diffuse and coloured specular, as when converting) */
  const chan=GL_ST+`uniform sampler2D uSrc; uniform sampler2D uC; uniform int uOut; uniform int uOwn; uniform int uMOn;
uniform float uRB; uniform float uRF; uniform int uRI; uniform float uRC; uniform float uMB; uniform float uMF; uniform int uMI; uniform float uMC;
vec3 toLin(vec3 c){ return pow(max(c,0.0),vec3(2.2)); } vec3 toSrgb(vec3 c){ return pow(max(c,0.0),vec3(1.0/2.2)); }
float val(float l,float b,float f,int inv,float con){ if(inv==1) l=1.0-l; l=clamp((l-0.5)*con+0.5,0.0,1.0); return mix(b,l,f); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(uSrc,p,0), c=texelFetch(uC,p,0); vec3 C=st(c); float l=dot(C,vec3(0.299,0.587,0.114));
  float m=uMOn==1?val(l,uMB,uMF,uMI,uMC):0.0;
  if(uOut==4){ o=vec4(toSrgb(toLin(C)*(1.0-m))*c.a,c.a); return; }
  vec3 v3; if(uOut==3) v3=toSrgb(mix(vec3(0.04),toLin(C),m)); else if(uOut==2) v3=vec3(m); else { float r=val(l,uRB,uRF,uRI,uRC); v3=vec3(uOut==1?1.0-r:r); }
  if(uOwn==1){ o=vec4(v3,1.0); return; }
  float a=s.a; o=vec4(mix(st(s),v3,c.a>0.0?1.0:0.0)*a,a); }`;
  P_HP={light:program(light),strokes:program(strokes),chan:program(chan)};P_HP.light.tiled=true;P_HP.strokes.tiled=true;return P_HP;}

/* every setting, so a preset is just a set of values over these */
const HP_DEFAULTS={own:true,base:[.6,.6,.6],lEl:65,lTurn:25,
  shCol:[.45,.4,.58],shAmt:.6,shSpread:.6,ltCol:[1,.92,.8],ltAmt:.35,form:0,formMode:0,ulCol:[.35,.45,.7],ulAmt:0,
  gTop:[1,.95,.85],gTopAmt:.25,gBot:[.55,.5,.62],gBotAmt:.35,gOff:.5,gSpread:.6,
  aoCol:[.35,.25,.3],aoAmt:.7,aoSpread:.5,edgeCol:[1,.93,.8],edgeAmt:.4,edgeSpread:.5,cavCol:[.3,.22,.25],cavAmt:.5,cavSpread:.4,
  thCol:[1,.45,.35],thAmt:0,spCount:3,spCol:[1,1,.95],spAmt:0,spExp:10,spH:45,spRot:0,
  varAmt:.25,varScale:6,varCol:[.9,.6,.5],pic:0,mul:0,over:.1,sat:1.05,
  tipKey:'b:bristle',sAmt:.6,sSize:40,sRand:.4,sDens:1.5,sRot:0,sRotRand:.25,sFollow:.8,sDetail:.25,sDrop:.15,sKeep:.6,sOp:.85,
  nDet:1,rOn:true,rBase:.7,rFrom:.2,rInv:true,rCon:1,mOn:false,mBase:0,mFrom:0,mInv:false,mCon:1,showN:false,seed:1};
const HP_PRESETS={
  'Game materials':{
    'Old wood':{base:[.45,.3,.18],shCol:[.5,.35,.4],edgeCol:[.9,.7,.45],cavCol:[.35,.2,.15],varAmt:.35,varCol:[.65,.42,.2],rBase:.8},
    'Steel':{base:[.55,.6,.68],shCol:[.35,.38,.55],edgeCol:[.95,.98,1],edgeAmt:.8,mOn:true,mBase:.85,rBase:.45,spAmt:.5,spExp:14,varAmt:.12,varCol:[.6,.7,.8]},
    'Gold':{base:[.88,.64,.2],shCol:[.6,.32,.18],edgeCol:[1,.95,.6],edgeAmt:.7,mOn:true,mBase:1,rBase:.35,spAmt:.6,spExp:12,varAmt:.1,varCol:[1,.8,.3]},
    'Bronze':{base:[.62,.42,.2],shCol:[.45,.28,.22],edgeCol:[1,.85,.55],mOn:true,mBase:.9,rBase:.45,spAmt:.4,varCol:[.5,.55,.3]},
    'Copper':{base:[.72,.38,.24],shCol:[.5,.22,.22],edgeCol:[1,.75,.55],mOn:true,mBase:.9,rBase:.4,spAmt:.45,varCol:[.8,.4,.3]},
    'Oxidized copper':{base:[.35,.62,.52],shCol:[.3,.42,.5],cavCol:[.3,.22,.15],cavAmt:.7,edgeCol:[.9,.55,.35],edgeAmt:.7,mOn:true,mBase:.3,rBase:.7,varAmt:.35,varCol:[.5,.75,.6]},
    'Bone':{base:[.86,.8,.66],shCol:[.6,.5,.48],cavCol:[.45,.35,.25],cavAmt:.6,rBase:.6,varCol:[.9,.85,.6]},
    'Rock':{base:[.45,.45,.47],shCol:[.38,.38,.55],edgeAmt:.7,varAmt:.4,varCol:[.6,.55,.5],rBase:.85},
    'Marble':{base:[.92,.9,.86],shCol:[.65,.65,.75],varAmt:.2,varCol:[.8,.85,.9],rBase:.3,spAmt:.2},
    'Ice':{base:[.72,.88,.98],shCol:[.42,.58,.88],edgeCol:[.95,1,1],edgeAmt:.8,ulCol:[.4,.8,1],ulAmt:.4,thCol:[.6,.9,1],thAmt:.5,rBase:.15,spAmt:.5,spExp:20,varCol:[.7,.9,1]},
    'Moss':{base:[.4,.55,.18],shCol:[.32,.42,.4],varAmt:.45,varCol:[.75,.75,.2],gTopAmt:.4,rBase:.9,edgeCol:[.85,.95,.5]},
    'Jade':{base:[.3,.62,.42],shCol:[.25,.4,.42],thCol:[.6,1,.7],thAmt:.5,ulCol:[.2,.6,.4],ulAmt:.3,rBase:.3,spAmt:.4,spExp:16,varCol:[.5,.8,.6]},
    'Obsidian':{base:[.12,.12,.18],shCol:[.5,.5,.7],edgeCol:[.6,.6,.95],edgeAmt:.7,rBase:.15,spAmt:.6,spExp:25,varAmt:.1}},
  'Skin and character':{
    'Fair skin':{base:[.92,.74,.62],shCol:[.78,.45,.45],cavCol:[.62,.32,.32],aoCol:[.6,.3,.3],thCol:[1,.42,.32],thAmt:.35,rBase:.55,varAmt:.15,varCol:[.95,.55,.5],sDetail:.4},
    'Warm skin':{base:[.74,.52,.38],shCol:[.65,.33,.33],cavCol:[.5,.25,.22],aoCol:[.55,.28,.25],thCol:[.9,.35,.25],thAmt:.3,rBase:.55,varAmt:.15,varCol:[.85,.45,.35],sDetail:.4},
    'Dark skin':{base:[.42,.27,.2],shCol:[.55,.3,.35],cavCol:[.4,.2,.2],aoCol:[.45,.25,.25],edgeCol:[.85,.65,.55],edgeAmt:.35,thCol:[.7,.25,.2],thAmt:.25,spAmt:.2,rBase:.5,varAmt:.15,varCol:[.6,.3,.25],sDetail:.4},
    'Orc skin':{base:[.42,.6,.25],shCol:[.32,.38,.5],cavCol:[.25,.25,.15],varAmt:.3,varCol:[.65,.65,.25],thCol:[.8,.6,.3],thAmt:.3,rBase:.6},
    'Painted skin':{own:false,form:.35,formMode:0,shAmt:.25,ltAmt:.2,gTopAmt:.15,gBotAmt:.15,aoAmt:.3,edgeAmt:.2,cavAmt:.25,varAmt:.1,over:0,sat:.95,sAmt:.7,sDetail:.35,sSize:30,rOn:false,pic:.5},
    'Cloth':{base:[.35,.4,.6],shCol:[.4,.35,.55],edgeAmt:.25,varAmt:.3,varCol:[.5,.55,.8],rBase:.9,sAmt:.4},
    'Leather':{base:[.4,.25,.15],shCol:[.45,.3,.35],edgeCol:[.75,.55,.38],edgeAmt:.6,cavAmt:.6,rBase:.6,spAmt:.15,varCol:[.55,.3,.18]}}};
const hpPreset=name=>{for(const g in HP_PRESETS)if(HP_PRESETS[g][name])return HP_PRESETS[g][name];return null;};
const HP_DIRS={Top:[90,0],Front:[15,0],Left:[15,-90],Right:[15,90],Back:[15,180],Bottom:[-90,0]};

/* what the layer reads: baked maps first, then the model, then the document's own maps (below this layer), else the picture */
function hpBelow(n,k){if(!n||!n.parent||!doc.maps.includes(k))return null;const p=n.parent,i=p.children.indexOf(n);if(i<=0)return null;return renderNodesMap(p.children.slice(0,i),k);}
function hpInputs(n){const M=doc.meshMaps||{},tmp=[],get=k=>{if(M[k])return M[k];const t=hpBelow(n,k);if(t){tmp.push(t);return t;}return null;};
  const wn=M.wnormal||null,pm=M.position||null,ao=get('ao'),thick=M.thick||null;
  let curv=M.curv||null;if(!curv&&typeof msModelCurv==='function')curv=msModelCurv();if(!curv)curv=get('curv');
  /* no model normal: the document's normal map below this layer */
  const is3d=typeof v3!=='undefined'&&v3.mesh&&(ui.mode==='p3d'||v3.on),tri=is3d&&typeof fillPosMaps==='function'?fillPosMaps():null;
  let dn=null,dn2=null;if(!wn&&!tri)dn=get('normal');else{dn2=hpBelow(n,'normal');if(dn2)tmp.push(dn2);}
  const tn=M.normal||null;
  const surf=msSurf();Object.assign(surf,{uDocN:dn?dn.tex:dummy,uHasDocN:{int:dn?1:0},uSz:[doc.w,doc.h]});
  return {tmp,surf,curvT:curv,u:{uWN:wn?wn.tex:dummy,uHasWN:{int:wn?1:0},uPM:pm?pm.tex:dummy,uHasPM:{int:pm?1:0},uCurv:curv?curv.tex:dummy,uHasCurv:{int:curv?1:0},
    uAO:ao?ao.tex:dummy,uHasAO:{int:ao?1:0},uThick:thick?thick.tex:dummy,uHasThick:{int:thick?1:0},
    uTan:tri?tri.tan.tex:dummy,uHasTan:{int:tri?1:0},uTN:tn?tn.tex:dummy,uHasTN:{int:tn?1:0},uDN2:dn2?dn2.tex:dummy,uHasDN2:{int:dn2?1:0}},
    src:{normal:wn?'baked world normal':tri?'the model':dn?'the normal map below':'flat (no model)',detail:tri?(tn&&!wn?'baked normal map':'')+(dn2?(tn&&!wn?' + ':'')+'normals painted below':''):'',
      position:pm?'baked position':tri?'the model':'top of the picture',ao:M.ao?'baked AO':ao?'AO map below':'the picture',
      curv:M.curv?'baked curvature':curv?(tri?'the model':'curvature map below'):'the picture',thick:thick?'baked thickness':'none (bake Thickness)'}};}
/* what the layer reads right now, in words (shown in its settings) */
function hpSources(n){const I=hpInputs(n),S=I.src;for(const t of I.tmp)release(t);
  return 'Reads: shape from '+S.normal+(S.detail?' (+ '+S.detail+')':'')+' · height from '+S.position+' · crevices from '+S.ao+' · edges from '+S.curv+' · thin parts from '+S.thick+'.';}
const hpRad=d=>d*Math.PI/180,hpDir=(el,turn)=>[Math.cos(hpRad(el))*Math.sin(hpRad(turn)),Math.sin(hpRad(el)),Math.cos(hpRad(el))*Math.cos(hpRad(turn))];
const hpScale=()=>Math.max(doc.w,doc.h)/1024;

/* the layer's colour, worked out once and kept until something it reads changes (the other maps read it too) */
function hpDrop(n){const f=n&&n._hpC;if(f){disposeTarget(f.T);n._hpC=null;}}
function hpKey(n,v){const mm=Object.keys(doc.meshMaps||{}).join(','),m=typeof v3!=='undefined'&&v3.mesh?v3.mesh.name+':'+v3.mesh.idx.length:'';
  return [typeof msDocVer==='number'?msDocVer:0,typeof msEpoch==='number'?msEpoch:0,n?n.lookVer||0:0,doc.w,doc.h,!!doc.wrap,mm,m,JSON.stringify(fxClean(v))].join('|');}
function hpColour(n,src,v){const key=hpKey(n,v),f=n&&n._hpC;if(f&&((f.key===key&&!stroke)||(stroke&&!src)))return f.T;/* while painting below, the colour is redone live; the other maps wait */
  let base=src,own=null;if(!base){own=hpBelow(n,'base');if(!own){own=acquireD(mapDepth('base'));clearTarget(own);}base=own;}
  const T=f&&f.T.w===doc.w&&f.T.h===doc.h&&f.T.depth===base.depth?f.T:(f&&disposeTarget(f.T),makeTarget(doc.w,doc.h,base.depth||doc.depth,false));
  hpPaint(base,T,v,n);if(own)release(own);if(n)n._hpC={key,T};return T;}
function hpPaint(base,T,v,n){const PG=hpProgs(),I=hpInputs(n),S=hpScale(),bl=acquireD(base.depth||doc.depth),bl2=acquireD(base.depth||doc.depth);
  blit(base,bl2,0,0,doc.w,doc.h,0,0);gaussian(bl2,bl,6*S);
  /* a softened copy of the curvature (for wide edge bands) */
  let cvB=null;const cvT=I.curvT;if(cvT&&cvT.w===doc.w&&cvT.h===doc.h){const c1=acquireD(cvT.depth||doc.depth);cvB=acquireD(cvT.depth||doc.depth);blit(cvT,c1,0,0,doc.w,doc.h,0,0);gaussian(c1,cvB,4*S);release(c1);}
  const a=v.sAmt>0?acquireD(base.depth||doc.depth):null;
  run(PG.light,a||T,Object.assign({},I.surf,I.u,{uSrc:base.tex,uBlur:bl.tex,uOwn:{int:v.own?1:0},uFormMode:{int:v.formMode|0},uSpCount:{int:v.spCount|0},uShowN:{int:+v.showN||0},uWrap:{int:doc.wrap?1:0},uSeed:v.seed||1,
    uBase:v.base,uL:hpDir(v.lEl,v.lTurn),uShCol:v.shCol,uLtCol:v.ltCol,uUlCol:v.ulCol,uGTop:v.gTop,uGBot:v.gBot,uAoCol:v.aoCol,uEdgeCol:v.edgeCol,uCavCol:v.cavCol,uThCol:v.thCol,uSpCol:v.spCol,uVarCol:v.varCol,
    uShAmt:v.shAmt,uShSpread:v.shSpread,uLtAmt:v.ltAmt,uForm:v.form,uUlAmt:v.ulAmt,uGTopAmt:v.gTopAmt,uGBotAmt:v.gBotAmt,uGOff:v.gOff,uGSpread:v.gSpread,uAoAmt:v.aoAmt,uAoSpread:v.aoSpread,
    uEdgeAmt:v.edgeAmt,uEdgeSpread:v.edgeSpread,uCavAmt:v.cavAmt,uCavSpread:v.cavSpread,uThAmt:v.thAmt,uSpAmt:v.spAmt,uSpExp:v.spExp,uSpH:hpRad(v.spH),uSpRot:hpRad(v.spRot),
    uCurvB:cvB?cvB.tex:dummy,uHasCurvB:{int:cvB?1:0},uVarAmt:v.varAmt,uVarScale:v.varScale,uPic:v.pic,uNDet:v.nDet??1,uMul:v.mul,uOver:v.over,uSat:v.sat}));
  if(a){const tip=typeof dualTip==='function'?dualTip({tipKey:v.tipKey}):null,tt=tip&&tip.alpha?tip:TIPS.bristle;
    run(PG.strokes,T,{uA:a.tex,uTip:tt.tex,uTipS:[tt.w,tt.h],uSize:v.sSize*S,uRand:v.sRand,uDens:v.sDens,uRot:hpRad(v.sRot),uRotRand:v.sRotRand,uFollow:v.sFollow,uDetail:v.sDetail,
      uDrop:v.sDrop,uKeep:v.sKeep,uOp:v.sOp,uAmt:+v.showN?0:v.sAmt,uSeed:v.seed||1,uWrap:{int:doc.wrap?1:0}});release(a);}
  release(bl);release(bl2);if(cvB)release(cvB);for(const t of I.tmp)release(t);}

fxDef('handPaint',{title:'Hand-painted',heavy:true,onlyLayer:true,wide:true,
  note:'Paints a hand-painted look from the shape of the model: shadow side, lit side, crevices, edges, top and bottom, thin parts. It reads the baked mesh maps (or the model, or the picture when there is none).',
  init:()=>Object.assign(JSON.parse(JSON.stringify(HP_DEFAULTS)),{preset:''}),
  controls:(v,upd)=>hpControls(v,upd),
  render(src,dst,v,ctx){const k=ctx&&ctx.k||'base',n=ctx&&ctx.layer;v=Object.assign({},HP_DEFAULTS,v);const sg=doc.workflow==='spec';
    /* which output each map gets: 0 roughness, 1 gloss, 2 metallic, 3 specular colour, 4 diffuse (Spec/Gloss with metal) */
    const out=v.showN?-1:k==='base'?(sg&&v.mOn?4:-2):k==='rough'&&v.rOn?0:k==='gloss'&&v.rOn?1:k==='metal'&&v.mOn?2:k==='spec'&&(v.mOn||v.own)?3:-1;
    if(out===-1&&k!=='base'){blit(src,dst,0,0,doc.w,doc.h,0,0);return;}
    const T=hpColour(n,k==='base'?src:null,v);
    if(out<0)blit(T,dst,0,0,doc.w,doc.h,0,0);
    else run(hpProgs().chan,dst,{uSrc:src.tex,uC:T.tex,uOut:{int:out},uOwn:{int:v.own?1:0},uMOn:{int:v.mOn?1:0},uRB:v.rBase,uRF:v.rFrom,uRI:{int:v.rInv?1:0},uRC:v.rCon,uMB:v.mBase,uMF:v.mFrom,uMI:{int:v.mInv?1:0},uMC:v.mCon});
    if(!n)disposeTarget(T);}});

/* ---- the settings: folding groups, presets on top ---- */
/* the small kit both painted-look editors use: a slider, colour, tick or list that writes straight into v, folding groups,
   and setAll() to show new values (after a preset). ids are prefix+key */
function fxUiKit(prefix,v,changed){const sl={},cl={},ck={},sel={},after=[];
  const S=(key,label,min,max,step,fmt)=>{const s=makeSlider({id:prefix+key,label,min,max,step,value:v[key],fmt,onInput:x=>{v[key]=x;changed();}});sl[key]=s;return s.el;};
  const C=(key,label)=>{const b=colourBtn(prefix+key,()=>v[key],c=>{v[key]=c.slice(0,3);changed();},label);cl[key]=b;return el('label',{class:'hpcol'},el('span',{text:label}),b);};
  const K=(key,label)=>{const c=chk(prefix+key,label,!!v[key],x=>{v[key]=x;changed();});ck[key]=c.querySelector('input');return c;};
  const SEL=(key,label,opts)=>{const s=el('select',{id:prefix+key,'aria-label':label},...opts.map(([val,t])=>el('option',{value:String(val),text:t})));s.value=String(v[key]);
    s.onchange=()=>{const o=opts.find(([val])=>String(val)===s.value);v[key]=o?o[0]:s.value;changed();};sel[key]=s;return el('label',{class:'hpsel'},el('span',{text:label}),s);};
  const G=(title,open,...kids)=>el('details',{class:'hpgrp',open:open||null},el('summary',{text:title}),...kids);
  const setAll=()=>{for(const k in sl)sl[k].set(v[k]);for(const k in cl)cl[k].value=toHex(v[k]);for(const k in ck)ck[k].checked=!!v[k];for(const k in sel)sel[k].value=String(v[k]);for(const f of after)f();};
  return {S,C,K,SEL,G,setAll,sl,after};}
/* the tip the strokes are stamped with: any brush from the Brushes panel, or a picture of your own (ids: hostId, hostId+'Name', hostId+'Import') */
function fxTipPicker(hostId,v,changed){const tipHost=el('div',{class:'hptips',id:hostId}),tipName=el('span',{class:'note',id:hostId+'Name'});
  const render=()=>{tipHost.replaceChildren();const builtIn=['dab','bristle','sponge','leaf','grass','splatter','square','scratch','abstract'].filter(k=>TIPS[k]);
    const tiles=el('div',{class:'tiles'});for(const k of builtIn){const key='b:'+k,t=TIPS[k];const b=el('button',{type:'button',title:t.name,class:v.tipKey===key?'on':null,onclick:()=>{v.tipKey=key;render();changed();}},t.canvas);tiles.append(b);}
    tipHost.append(el('div',{class:'libset'},el('div',{class:'libset-h',text:'Tips'}),tiles));
    for(const set of (typeof library!=='undefined'?library:[])){const tl=el('div',{class:'tiles'});set.presets.forEach((p,i)=>{if(!p.tip)return;const key=dualLibraryKey(set,p,i);
      tl.append(el('button',{type:'button',title:p.name,class:v.tipKey===key?'on':null,onclick:()=>{v.tipKey=key;render();changed();}},tileCanvas(p)));});
      if(tl.childNodes.length)tipHost.append(el('div',{class:'libset'},el('div',{class:'libset-h',text:set.name}),tl));}
    const t=dualTip({tipKey:v.tipKey});tipName.textContent=t?'Stamping with “'+t.name+'”':'Tip not found: pick another';};
  const importTip=el('button',{class:'btn sm',id:hostId+'Import',text:'Import a stroke picture…',title:'A picture of one brush stroke: dark (or opaque) is paint',onclick:()=>{
    const f=el('input',{type:'file',accept:'image/*'});f.onchange=async()=>{const file=f.files&&f.files[0];if(!file)return;const p=await hpTipFromFile(file);if(!p)return;
      const set=library.find(s=>s.id==='custom');v.tipKey=dualLibraryKey(set,p,set.presets.indexOf(p));render();changed();};f.click();}});
  render();return {tipHost,tipName,importTip,render};}
function hpControls(v,upd){for(const k in HP_DEFAULTS)if(v[k]===undefined)v[k]=JSON.parse(JSON.stringify(HP_DEFAULTS[k]));
  const changed=()=>{v.preset='custom';refreshChips();upd();},U=fxUiKit('hp_',v,changed),{S,C,K,SEL,G,setAll,sl}=U;
  const chips=[];const refreshChips=()=>{for(const b of chips)b.classList.toggle('on',b.dataset.pre===v.preset);};
  const presetRows=Object.keys(HP_PRESETS).map(g=>el('div',{},el('div',{class:'sub',text:g}),el('div',{class:'chips'},...Object.keys(HP_PRESETS[g]).map(name=>{
    const b=el('button',{class:'chip'+(v.preset===name?' on':''),'data-pre':name,id:'hp_pre_'+name.replace(/\W+/g,''),text:name,onclick:()=>{const keep={tipKey:v.tipKey,seed:v.seed};
      Object.assign(v,JSON.parse(JSON.stringify(HP_DEFAULTS)),keep,JSON.parse(JSON.stringify(HP_PRESETS[g][name])),{preset:name});setAll();refreshChips();upd();}});chips.push(b);return b;}))));
  const dirChips=el('div',{class:'chips'},...Object.keys(HP_DIRS).map(d=>el('button',{class:'chip',id:'hp_dir_'+d,text:d,onclick:()=>{[v.lEl,v.lTurn]=HP_DIRS[d];sl.lEl.set(v.lEl);sl.lTurn.set(v.lTurn);changed();}})));
  const {tipHost,tipName,importTip,render:renderTips}=fxTipPicker('hpTips',v,changed);U.after.push(renderTips);
  return [el('div',{class:'sub',text:'Presets'}),...presetRows,
    G('Colour',true,SEL('own','Colour comes from',[[true,'Its own colour'],[false,'The layers below (paint over them)']]),C('base','Base colour')),
    el('p',{class:'note hpsrc',id:'hpSrc',text:(()=>{try{return hpSources(hpCurLayer());}catch(e){return '';}})()}),
    G('Light direction',true,dirChips,S('lEl','Height of the light',-90,90,1,x=>Math.round(x)+'°'),S('lTurn','Turn',-180,180,1,x=>Math.round(x)+'°'),
      K('showN','Show the directions (normals in colour)'),S('nDet','Detail from normal maps',0,2,.01,pct),el('p',{class:'note',text:'Top uses the green of the world-space normal, the usual trick for fake lighting.'})),
    G('Shadow and light',true,C('shCol','Shadow colour'),S('shAmt','Shadow',0,1,.01,pct),S('shSpread','Shadow softness',0,1,.01,pct),C('ltCol','Light colour'),S('ltAmt','Light',0,1,.01,pct),
      S('form','Form light (normals over the colour)',0,1,.01,pct),SEL('formMode','Form light blend',[[0,'Overlay'],[1,'Linear add']])),
    G('Top and bottom',false,C('gTop','Top colour'),S('gTopAmt','Top',0,1,.01,pct),C('gBot','Bottom colour'),S('gBotAmt','Bottom',0,1,.01,pct),S('gOff','Middle',0,1,.01,pct),S('gSpread','Softness',0,1,.01,pct)),
    G('Crevices (AO)',false,C('aoCol','Crevice colour'),S('aoAmt','Crevices',0,1,.01,pct),S('aoSpread','Spread',0,1,.01,pct)),
    G('Edges and cavities',false,C('edgeCol','Edge colour'),S('edgeAmt','Edges',0,1,.01,pct),S('edgeSpread','Edge width',0,1,.01,pct),C('cavCol','Cavity colour'),S('cavAmt','Cavities',0,1,.01,pct),S('cavSpread','Cavity width',0,1,.01,pct)),
    G('Thin parts and under-glow',false,C('thCol','Thin parts colour'),S('thAmt','Thin parts glow (needs a Thickness bake)',0,1,.01,pct),C('ulCol','Under-glow colour'),S('ulAmt','Glow from below',0,1,.01,pct)),
    G('Highlights',false,S('spAmt','Highlights',0,1,.01,pct),S('spCount','Number of lights',1,8,1),C('spCol','Highlight colour'),S('spExp','Tightness',1,40,.5),S('spH','Height',0,90,1,x=>Math.round(x)+'°'),S('spRot','Turn',-180,180,1,x=>Math.round(x)+'°')),
    G('Colour variation',false,S('varAmt','Variation',0,1,.01,pct),S('varScale','Blotch size',1,30,.5),C('varCol','Second hue')),
    G('Brush strokes',false,tipName,tipHost,importTip,S('sAmt','Strokes',0,1,.01,pct),S('sSize','Stroke size',4,200,1,px),S('sRand','Size variety',0,1,.01,pct),S('sDens','Density',.3,3,.05),
      S('sRot','Turn',-180,180,1,x=>Math.round(x)+'°'),S('sRotRand','Turn variety',0,1,.01,pct),S('sFollow','Follow the forms',0,1,.01,pct),S('sDetail','Keep detail',0,1,.01,pct),
      S('sDrop','Leave some out',0,.9,.01,pct),S('sKeep','Stay inside colour edges',0,1,.01,pct),S('sOp','Stroke opacity',0,1,.01,pct)),
    G(doc.workflow==='spec'?'Glossiness':'Roughness',false,K('rOn',doc.workflow==='spec'?'Make glossiness':'Make roughness'),S('rBase','Roughness',0,1,.01,pct),S('rFrom','From the colour',0,1,.01,pct),K('rInv','Darker is rougher'),S('rCon','Contrast',0,4,.05)),
    G(doc.workflow==='spec'?'Metal (specular colour)':'Metallic',false,K('mOn',doc.workflow==='spec'?'Metal parts (coloured specular, dark diffuse)':'Make metallic'),S('mBase','Metallic',0,1,.01,pct),S('mFrom','From the colour',0,1,.01,pct),K('mInv','Darker is more metallic'),S('mCon','Contrast',0,4,.05)),
    G('Finish',false,S('mul','Multiply push',0,1,.01,pct),S('over','Overlay push',0,1,.01,pct),S('sat','Saturation',0,2,.01,pct),S('pic','Shape from the picture (no model)',0,1,.01,pct),S('seed','Random seed',1,99,1))];}

/* a picture of one stroke becomes a brush tip in Custom tips (dark or opaque = paint) */
async function hpTipFromFile(file){try{const bmp=await createImageBitmap(file),sc=Math.min(1,1024/Math.max(bmp.width,bmp.height)),W=Math.max(1,Math.round(bmp.width*sc)),H=Math.max(1,Math.round(bmp.height*sc));
    const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bmp,0,0,W,H);const px=x.getImageData(0,0,W,H).data,v=new Uint8Array(W*H);
    let trans=0;for(let i=3;i<px.length;i+=4)if(px[i]<250)trans++;const useA=trans>W*H*.01;
    for(let i=0;i<W*H;i++){const j=i*4;v[i]=useA?px[j+3]:Math.round(255-(px[j]*.299+px[j+1]*.587+px[j+2]*.114));}
    const p=addCustomTip(file.name.replace(/\.[^.]+$/,''),W,H,v,null,true);if(!p){toast('That picture has no dark or opaque pixels to make a stroke from.');return null;}toast('Added the stroke “'+p.name+'” to Custom tips.');return p;}
  catch(e){toast('Could not read that picture.');return null;}}

/* Layer › New › Hand-painted layer: on top of the stack */
function cmdNewHandPaintLayer(preset){if(ui.mode==='anim'){toast('Hand-painted layers are for paint mode.');return;}if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const p=doc.root,i=p.children.length,L=newFxLayerObj('Hand-painted',[fxItem('handPaint')],'all'),pr=preset&&hpPreset(preset);
  if(pr)Object.assign(L.fx.stack[0].v,JSON.parse(JSON.stringify(pr)),{preset});
  insertNode(L,p,i);selectOnly(L);changedAll();fxEditor(L,{isNew:true,parent:p,index:i});}

/* the Hand-painted layer whose settings are open (the editor works on the selected layer) */
function hpCurLayer(){const L=doc.active;return L&&L.fx&&L.fx.stack.some(it=>it.id==='handPaint')?L:null;}
/* the presets as smart materials (Materials › Smart materials): drag onto the layers, or click, like any material */
function hpSmartList(){if(!FX.handPaint)return [];const out=[];for(const g in HP_PRESETS)for(const name in HP_PRESETS[g]){const v=Object.assign(fxDefaults(FX.handPaint),JSON.parse(JSON.stringify(HP_PRESETS[g][name])),{preset:name});
  out.push(['Hand-painted '+name,[{t:'L',name:'Hand-painted '+name,mode:0,op:1,vis:true,fx:{map:'all',stack:[{id:'handPaint',on:true,v}]}}]]);}return out;}
