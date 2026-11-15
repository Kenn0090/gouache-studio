/* ================= Skin blur, like Marmoset's Subsurface Scatter (0.97.27, Kenn: "real skin blur") =================
   Light that enters skin comes out a little further along, softened and reddened. After the model is drawn:
     1. the Skin texture sets are drawn again: the light under the skin alone (FS_3D uSkinPass 1) and the skin colour
        (uSkinPass 2), on top of the scene's own depth, so only the skin you can see is kept;
     2. that picture is blurred across the screen in two passes, each colour by its own distance (Scatter Depth in mm ×
        the scatter colour, so red spreads furthest), and the blur stops at depth edges so it does not leak off the skin;
     3. the drawn picture swaps its sharp under-skin light for the blurred one, times the skin colour, so painted detail,
        shine and fuzz stay sharp.
   Millimetres need the model's real size: Model height (cm) in the skin settings (25 cm for a head, 180 cm for a body). */
Object.assign(SH_DEF.skin,{blur:1,realH:25});
const FS_SKBLUR=`vec3 dec(vec3 e){ e=min(e,vec3(0.996)); return e/(1.0-e); }
uniform sampler2D uSrc; uniform sampler2D uDepth; uniform vec2 uDir; uniform vec3 uR; uniform vec2 uSz;
void main(){ vec2 uv=gl_FragCoord.xy/uSz; vec4 c0=texture(uSrc,uv); if(c0.a<0.01){ o=c0; return; } float z0=texture(uDepth,uv).r;
  vec3 acc=dec(c0.rgb), wsum=vec3(1.0); float rm=max(max(uR.r,uR.g),uR.b);
  for(int i=1;i<=12;i++){ float d=float(i)/12.0*rm; for(int sgn=-1;sgn<=1;sgn+=2){ vec2 q=uv+uDir*float(sgn)*d/uSz; vec4 c=texture(uSrc,q);
      float z=texture(uDepth,q).r, edge=c.a*exp(-abs(z-z0)*4000.0); vec3 w=exp(-0.5*pow(vec3(d)/max(uR*0.5,vec3(0.05)),vec3(2.0)))*edge;
      acc+=dec(c.rgb)*w; wsum+=w; } }
  vec3 L=acc/wsum; o=vec4(L/(1.0+L),c0.a); }`;
const FS_SKCOMB='uniform int uTone;\n'+TONE_GLSL+`uniform float uExpo; uniform sampler2D uScene; uniform sampler2D uD; uniform sampler2D uB; uniform sampler2D uA; uniform float uK; uniform vec2 uSz;
vec3 dec(vec3 e){ e=min(e,vec3(0.996)); return e/(1.0-e); }
vec3 disp(vec3 c){ return pow(clamp(tone(c*uExpo),0.0,1.0),vec3(1.0/2.2)); }
void main(){ vec2 uv=gl_FragCoord.xy/uSz,px=1.0/uSz; vec4 s=texture(uScene,uv), d=texture(uD,uv), b=texture(uB,uv); vec3 A=pow(texture(uA,uv).rgb,vec3(2.0));
  float e=min(min(texture(uD,uv+vec2(px.x,0.0)).a,texture(uD,uv-vec2(px.x,0.0)).a),min(texture(uD,uv+vec2(0.0,px.y)).a,texture(uD,uv-vec2(0.0,px.y)).a));
  vec3 delta=disp(A*dec(b.rgb))-disp(A*dec(d.rgb));
  o=vec4(clamp(s.rgb+delta*d.a*e*uK,0.0,1.0),s.a); }`;
let P_SKBLUR=null,P_SKCOMB=null;const skb={F:null};
function skbFree(){const X=skb.F;if(!X)return;for(const t of [X.d,X.a,X.b0,X.b1,X.sc])postFreeT(t);if(X.dt)gl.deleteTexture(X.dt);if(X.df)gl.deleteFramebuffer(X.df);skb.F=null;}
function skbTargets(w,h){let X=skb.F;if(X&&(X.w!==w||X.h!==h)){skbFree();X=null;}if(X)return X;
  X=skb.F={w,h,d:postTex(w,h,gl.LINEAR),a:postTex(w,h,gl.NEAREST),b0:postTex(w,h,gl.LINEAR),b1:postTex(w,h,gl.LINEAR),sc:postTex(w,h,gl.NEAREST)};
  X.dt=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,X.dt);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,w,h,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
  for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
  /* the under-skin picture's framebuffer also holds the scene's depth, so hidden skin is not drawn */
  for(const t of [X.d,X.a]){gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,X.dt,0);}gl.bindFramebuffer(gl.FRAMEBUFFER,null);return X;}
/* blur distance in pixels for each colour: Scatter Depth (mm) × scatter colour, at the model's real size on screen */
function skbRadius(P,F){const s=v3s(),m=v3.mesh;if(!m)return [0,0,0];const realMm=Math.max(10,(P.realH??25)*10)/2;
  const halfView=s.ortho?v3.cam.dist*Math.tan(s.fov*Math.PI/360):v3.cam.dist*Math.tan(s.fov*Math.PI/360);
  const pxPerUnit=(F.h/2)/Math.max(1e-4,halfView),pxPerMm=pxPerUnit*(m.radius||1)/realMm,c=P.col||[1,.62,.52],d=Math.max(0,P.scatDepth??1);
  return c.map(x=>Math.min(48,d*(0.35+0.65*x)*pxPerMm));}
function skinBlurPass(F,C,list,common,flip,g){
  const items=list.filter(it=>{const sh=it.sh||v3ShadeOf(doc);return it.count&&it.T&&it.T.base&&sh&&sh.kind==='skin'&&(shParams(sh).blur??1)>0;});
  if(!items.length||v3Unlit())return;
  const P=shParams(items[0].sh||v3ShadeOf(doc)),R=skbRadius(P,F);if(Math.max(...R)<0.75)return;
  if(!P_SKBLUR){P_SKBLUR=program(FS_SKBLUR);P_SKCOMB=program(FS_SKCOMB);}
  const X=skbTargets(F.w,F.h);
  /* the scene's depth and colour */
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,F.ms);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,X.d.fbo);gl.blitFramebuffer(0,0,F.w,F.h,0,0,F.w,F.h,gl.DEPTH_BUFFER_BIT,gl.NEAREST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,F.rf);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,X.sc.fbo);gl.blitFramebuffer(0,0,F.w,F.h,0,0,F.w,F.h,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  /* 1. the under-skin light of the visible skin */
  gl.bindFramebuffer(gl.FRAMEBUFFER,X.d.fbo);gl.viewport(0,0,F.w,F.h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  /* drawn a hair nearer than the scene's depth, so the same surface always passes (no speckles) */
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);gl.disable(gl.BLEND);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-2,-4);gl.bindVertexArray(g.vao);
  try{for(const [tgt,pass] of [[X.d,1],[X.a,2]]){gl.bindFramebuffer(gl.FRAMEBUFFER,tgt.fbo);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      for(const it of items){const U=v3MeshU(C,common,it,flip,null);U.uSkinPass={int:pass};useProg(P3.mesh,U);gl.drawElements(gl.TRIANGLES,it.count*3,gl.UNSIGNED_INT,it.start*12);}}}
  finally{gl.depthMask(true);gl.disable(gl.DEPTH_TEST);gl.disable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(0,0);gl.bindVertexArray(vao);}
  /* 2. blurred across, then down */
  const sz=[F.w,F.h];run(P_SKBLUR,X.b0,{uSrc:X.d.tex,uDepth:X.dt,uDir:[1,0],uR:R,uSz:sz});run(P_SKBLUR,X.b1,{uSrc:X.b0.tex,uDepth:X.dt,uDir:[0,1],uR:R,uSz:sz});
  /* 3. sharp under-skin light swapped for the blurred one */
  const U0=v3MeshU(C,common,items[0],flip,null);run(P_SKCOMB,{fbo:F.rf,w:F.w,h:F.h},{uScene:X.sc.tex,uD:X.d.tex,uB:X.b1.tex,uA:X.a.tex,uK:Math.min(1,P.blur??1),uSz:sz,uTone:U0.uTone??{int:1},uExpo:U0.uExpo??1});
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);v3Work.postPasses=(v3Work.postPasses||0)+4;}
/* the settings: Skin blur and the model's real height, beside Scatter Depth */
{const f=skSkinUI;skSkinUI=function(sh){const box=f.apply(this,arguments);try{const P=shParams(sh),setP=(key,v)=>shadeEdit(d=>{d.p.skin=Object.assign({},shParams(d,'skin'),{[key]:v});});
  const blur=makeSlider({id:'sh_blur',label:'Skin blur (soft light under the skin)',min:0,max:1,step:.01,value:P.blur??1,fmt:v=>Math.round(v*100)+'%',onInput:v=>setP('blur',v)}).el;
  const real=makeSlider({id:'sh_realH',label:'Model height (cm), for the mm depths',min:5,max:250,step:1,value:P.realH??25,fmt:v=>v+' cm',onInput:v=>setP('realH',v)}).el;
  const anchor=box.querySelector('#sh_strength');const row=anchor&&(anchor.closest('.srow')||anchor);if(row)row.before(blur,real);else box.append(blur,real);}catch(e){console.warn('skin blur settings',e);}return box;};}
