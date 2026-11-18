/* ================= Ray-traced rendering (0.26) =================
   A progressive path tracer on the GPU: light from the HDRI (and the extra sun) bounces off the model's
   materials (base colour, roughness, metallic, normal), with real shadows and bounced light. It reuses the
   baker's triangle search tree and ray code (BK_TRACE). Each frame adds one sample per pixel, so the picture
   gets cleaner the longer it runs. Used by the 3D view's "Ray traced" mode and by the Render window.
   The scene (tree, triangle corners, UVs, tangents, set per triangle) is rebuilt when the model changes; the
   texture sets' maps are packed into one texture array (4 layers per set: base, roughness, metallic, normal). */
const rt={mesh:null,g:null,building:false,mat:null,matKey:'',view:null,ver:0};
async function rtScene(){const m=v3.mesh;if(!m||m.noUV)return null;if(rt.mesh===m&&rt.g)return rt.g;if(rt.building)return null;rt.building=true;
  try{const list=ui.mode==='p3d'&&typeof p3DrawList==='function'?p3DrawList():[{start:0,count:m.idx.length/3}],T=m.idx.length/3,triSet=new Float32Array(T);
    list.forEach((it,i)=>{for(let t=it.start;t<it.start+it.count&&t<T;t++)triSet[t]=i;});
    const B=await bvhBuildAsync(m.pos,m.idx,()=>{});if(v3.mesh!==m)return null;const o=B.order,I=m.idx,nd=B.nodeData;
    const corner=(src,stride,w,fix)=>(b,t0,t1)=>{for(let q=t0;q<t1;q++){const k=(q/3)|0,t=o[k],vi=I[t*3+q-k*3],d=(q-t0)*4;for(let c=0;c<stride;c++)b[d+c]=src[vi*stride+c];if(fix)fix(b,d,t);}};
    const g={nodes:bkBandTex(B.nodes*2,false,(b,t0,t1)=>b.set(nd.subarray(t0*4,t1*4))),
      tris:bkBandTex(T*3,false,corner(m.pos,3,0,(b,d,t)=>{b[d+3]=triSet[t];})),nrm:bkBandTex(T*3,true,corner(m.nrm,3)),
      uv:bkBandTex(T*3,false,corner(m.uv,2)),tan:bkBandTex(T*3,true,corner(m.tan,4)),sets:list.length,radius:m.radius||1};
    if(rt.g)for(const k of ['nodes','tris','nrm','uv','tan'])gl.deleteTexture(rt.g[k]);rt.g=g;rt.mesh=m;rt.matKey='';rt.ver++;return g;}
  catch(e){console.warn('raytrace',e);toast('Ray tracing could not start: '+(e.message||e));return null;}
  finally{rt.building=false;}}
/* every texture set's maps in one texture array (rebuilt when the maps change) */
const RT_MAPS=[['base',[0,0,0,0]],['rough',null],['metal',null],['nfinal',[.5,.5,1,1]],['sss',[1,1,1,1]],['sssc',null]];
/* (0.98.18, Kenn: "every viewer shader in the ray-traced view, skin first") each set has 6 layers: base, roughness, metallic, normal,
   and for Skin its Scattering amount and Scatter colour (the shader's colour when the set has no Scatter colour channel) */
const RT_L=6,RT_SETS=32;
/* (0.98.18) the viewer shaders in the tracer: per set a kind code and its settings (uSk: kind, scatter amount, scatter depth in model units,
   transmission; uSkP / uSkQ / uSkC: the shader's own numbers and colour). Standard, Spec/Gloss, Panner, Retro and custom shaders trace as
   plain PBR. Fur traces as a soft sheen (its strands are drawn only in the normal view). */
const RT_KIND={skin:1,glass:2,car:3,iridescent:4,velvet:5,cloth:6,aniso:7,wax:8,eye:9,fur:10,toon:11,cel:12,halfcel:13,ink:14,hatch:15,hologram:16};
function rtPerMm(P){const m=v3.mesh,realMm=Math.max(10,(P.realH!=null?P.realH:skAutoCm(m))*10)/2;return (m&&m.radius||1)/realMm;}
function rtKindOf(sh){const k=sh&&RT_KIND[sh.kind];if(!k)return null;const P=shParams(sh),o={k,w:0,depth:0,trans:0,col:null,p:[0,0,0,0],q:[0,0,0,0],c:P.col||[1,1,1]};
  if(k===1){o.w=clamp(P.scatter??.5,0,1);o.depth=Math.max(0,P.depth??1)*rtPerMm(P);o.trans=P.transmission??.5;o.col=P.col||[.85,.25,.18];}
  else if(k===8){o.w=clamp((P.glow??1.5)/1.5,0,1);o.depth=Math.max(0,(P.depth??.7)*4)*rtPerMm(P);o.col=P.col||[1,.62,.3];}
  else if(k===2){o.p=[P.refr??.5,P.frost??0,P.thick??.5,P.edge??1];o.q=[P.cloud??0,P.disp??0,0,0];}
  else if(k===3){o.p=[P.flakes??.5,P.size??170,P.coat??1,P.sparkle??1];o.q=[P.coatRough??.04,P.peel??0,0,0];}
  else if(k===4)o.p=[P.strength??.8,P.shift??0,P.range??1.5,P.angle??.8];
  else if(k===5)o.p=[P.sheen??.8,P.srough??.5,P.rim??1,0];
  else if(k===6)o.p=[P.sheen??1,P.soft??.5,P.fibre??0,P.aniso??.5];
  else if(k===7)o.p=[P.amount??.7,P.dir??0,0,0];
  else if(k===9){o.p=[P.cx??.5,P.cy??.5,P.iris??.22,P.pupil??.5];o.q=[P.depth??.35,P.refract??.5,P.limbal??.5,P.gloss??.04];o.c=P.tint||[1,1,1];}
  else if(k===10)o.c=P.col||[.95,.85,.7];
  else if(k===11)o.p=[P.steps??3,0,P.spec??0,P.rim??0];
  else if(k===12)o.p=[P.thresh??.5,P.soft??.1,P.spec??0,P.rim??0];
  else if(k===13)o.p=[P.bands??3,P.soft??.1,0,P.rim??0];
  else if(k===14)o.p=[P.steps??2,P.soft??.1,0,P.rim??0];
  else if(k===15)o.p=[3,0,0,0];
  else if(k===16){o.p=[P.lines??40,P.flicker??0,P.glow??1.4,P.opacity??.8];o.c=P.col||[.2,.85,1];}
  return o;}
const rtSkinOf=sh=>{const o=rtKindOf(sh);return o&&(o.k===1||o.k===8)?o:null;};
function rtShadeList(){return ui.mode==='p3d'&&typeof p3DrawList==='function'?p3DrawList():[{T:v3.tex,sh:v3ShadeOf(doc)}];}
function rtKindUniforms(list){const A=[0,1,2,3].map(()=>new Float32Array(RT_SETS*4));list.slice(0,RT_SETS).forEach((it,i)=>{const o=rtKindOf(it.sh||v3ShadeOf(doc));if(!o)return;
  A[0].set([o.k,o.w,o.depth,o.trans],i*4);A[1].set(o.p,i*4);A[2].set(o.q,i*4);A[3].set([...o.c.slice(0,3),0],i*4);});return {uSk:{v4a:A[0]},uSkP:{v4a:A[1]},uSkQ:{v4a:A[2]},uSkC:{v4a:A[3]}};}
const rtSkinUniform=list=>rtKindUniforms(list).uSk.v4a;
function rtSkinKey(list){return list.map(it=>JSON.stringify(rtKindOf(it.sh||v3ShadeOf(doc)))).join('|');}
/* (0.97.27, Kenn: "when painting it's flickering a lot") the traced copy of the textures follows every change, not only the full
   refreshes (about once a second while painting): before, the ray-traced picture showed the textures from before the stroke, and the
   paint only flashed up while the tracer restarted. While a stroke goes on, the copy is remade at most every 120 ms. */
function rtTexVer(){const T=v3.tex||{};const v=['base','rough','metal','nfinal','emis','opac','sgBase'].map(k=>T[k]?T[k]._studioVer||0:'-').join('.');
  const now=performance.now();if(v!==rt.texVer){if(!stroke||!rt.texVer||now-(rt.texVerAt||0)>120){rt.texVer=v;rt.texVerAt=now;}else{clearTimeout(rt.texVerT);rt.texVerT=setTimeout(()=>{v3.dirty=true;requestRender();},130);}}
  return rt.texVer||'';}
function rtMaterials(g){const list=rtShadeList(),key=v3.lastFull+':'+rtTexVer()+':'+list.length+':'+(doc.maps||[]).join()+':'+(doc.workflow||'')+':'+rtSkinKey(list);
  if(rt.mat&&rt.matKey===key)return rt.mat;const S=1024,L=list.length*RT_L;if(rt.mat)gl.deleteTexture(rt.mat);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D_ARRAY,tex);gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.RGBA8,S,S,L,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  const fb=gl.createFramebuffer(),sgW=doc.workflow==='spec',sgK={base:'sgBase',metal:'sgMetal',rough:'sgRough'},has=k=>k==='nfinal'?doc.maps.includes('height')||doc.maps.includes('normal')||!!meshNormalBase():doc.maps.includes(k)||(sgW&&(k==='metal'||k==='rough'));
  list.forEach((it,i)=>{const T=it.T||{},sk=rtSkinOf(it.sh||v3ShadeOf(doc));RT_MAPS.forEach(([k,def],j)=>{gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,fb);gl.framebufferTextureLayer(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,tex,0,i*RT_L+j);
    if(k==='sss'||k==='sssc'){const src=sk&&T[k]&&T[k].fbo&&(T!==v3.tex||doc.maps.includes(k))?T[k]:null;if(src){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,src.fbo);gl.blitFramebuffer(0,0,src.w,src.h,0,0,S,S,gl.COLOR_BUFFER_BIT,gl.LINEAR);}
      else{const d=k==='sss'?def:sk?[...sk.col,1]:[1,1,1,1];gl.viewport(0,0,S,S);gl.clearColor(d[0],d[1],d[2],d[3]);gl.clear(gl.COLOR_BUFFER_BIT);}return;}
    /* (0.52) a Spec/Gloss set is traced with the base / metal / rough the viewer derives from its Specular and Glossiness */
    const src=sgW&&sgK[k]&&T[sgK[k]]?T[sgK[k]]:T[k];if(src&&src.fbo&&has(k)){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,src.fbo);gl.blitFramebuffer(0,0,src.w,src.h,0,0,S,S,gl.COLOR_BUFFER_BIT,gl.LINEAR);}
    else{const d=def||[mapDefault(k)[0],0,0,1];gl.viewport(0,0,S,S);gl.clearColor(d[0],d[1],d[2],d[3]);gl.clear(gl.COLOR_BUFFER_BIT);}});});
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(fb);gl.bindTexture(gl.TEXTURE_2D_ARRAY,tex);gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.REPEAT);rt.mat=tex;rt.matKey=key;return tex;}
const FS_RT=BK_TRACE+`precision highp sampler2DArray;
uniform highp sampler2D uUV; uniform highp sampler2D uTan; uniform sampler2DArray uMat; uniform sampler2D uEnvSrc; uniform int uEnvOn; uniform float uEnvRot; uniform float uEnvI;
uniform mat4 uInvVP; uniform vec2 uSize; uniform int uFrame; uniform sampler2D uPrev; uniform int uBounces; uniform vec3 uSunDir; uniform float uSunI; uniform int uBg; uniform vec3 uBgCol; uniform float uUVs; uniform float uEps; uniform float uClampL; uniform int uFlip; uniform vec4 uSk[32]; uniform vec4 uSkP[32]; uniform vec4 uSkQ[32]; uniform vec4 uSkC[32];
const float PI=3.14159265;
vec3 lin(vec3 c){ return pow(max(c,0.0),vec3(2.2)); }
vec3 sky(vec3 d){ float y=d.y; vec3 zen=vec3(0.32,0.45,0.72),hor=vec3(0.78,0.80,0.84),gnd=vec3(0.24,0.22,0.20); return y>0.0?mix(hor,zen,pow(y,0.6)):mix(hor,gnd,pow(-y,0.4)); }
vec3 envL(vec3 d){ if(uEnvOn==0) return sky(d); return textureLod(uEnvSrc,vec2(atan(d.x,-d.z)/(2.0*PI)+0.5+uEnvRot,acos(clamp(d.y,-1.0,1.0))/PI),0.0).rgb*uEnvI; }
/* Skin (0.98.18): the surface colour is what comes back out after many scatterings; this gives the single-scattering albedo that does it
   (the fit used by Cycles' random walk) */
vec3 rtSssAlpha(vec3 A){ A=clamp(A,0.0,0.999); vec3 q=4.09712+4.20863*A-sqrt(9.59217+41.6808*A+17.7126*A*A); return clamp(1.0-q*q,0.0,0.9999); }
vec3 rtIso(vec2 r){ float z=1.0-2.0*r.x,s=sqrt(max(0.0,1.0-z*z)),ph=6.2831853*r.y; return vec3(s*cos(ph),s*sin(ph),z); }
vec3 bary(highp sampler2D s,int t,vec2 bc){ return bkF(s,t*3).xyz*(1.0-bc.x-bc.y)+bkF(s,t*3+1).xyz*bc.x+bkF(s,t*3+2).xyz*bc.y; }
void main(){ ivec2 px=ivec2(gl_FragCoord.xy); uint seed=uint(px.x)*1973u+uint(px.y)*9277u+uint(uFrame)*26699u+1u;
  vec2 jit=vec2(bkRnd(seed),bkRnd(seed+1u)); seed+=2u; vec2 ndc=(vec2(px)+jit)/uSize*2.0-1.0; if(uFlip==1) ndc.y=-ndc.y;
  vec4 a=uInvVP*vec4(ndc,-1.0,1.0),b=uInvVP*vec4(ndc,1.0,1.0); vec3 ro=a.xyz/a.w, rd=normalize(b.xyz/b.w-ro);
  vec3 thr=vec3(1.0), L=vec3(0.0); float alpha=0.0;
  for(int bn=0;bn<8;bn++){ if(bn>=uBounces) break; float th; vec2 bc; int t=bkTrace(ro,rd,1e20,false,th,bc);
    if(t<0){ if(bn==0){ if(uBg==0){ L+=envL(rd); alpha=1.0; } else if(uBg==1){ L+=uBgCol; alpha=1.0; } } else L+=thr*envL(rd); break; }
    if(bn==0) alpha=1.0;
    vec3 v0=bkF(uTris,t*3).xyz,v1=bkF(uTris,t*3+1).xyz,v2=bkF(uTris,t*3+2).xyz; int set=int(bkF(uTris,t*3).w+0.5);
    vec3 Ng=normalize(cross(v1-v0,v2-v0)); vec3 Nv0=normalize(bary(uTN,t,bc)); vec3 Ngo=dot(Ng,Nv0)<0.0?-Ng:Ng; bool inside=dot(rd,Ngo)>0.0;/* inside a closed part (glass) */
    if(dot(Ng,rd)>0.0) Ng=-Ng; vec3 P=ro+rd*th;
    vec3 N=Nv0; if(dot(N,Ng)<0.0) N=-N; vec2 uv=bary(uUV,t,bc).xy*uUVs;
    vec4 bs=texture(uMat,vec3(uv,float(set*6))); if(bs.a<0.5){ ro=P+rd*uEps; continue; }
    vec3 alb=lin(bs.rgb/max(bs.a,1e-4)); float rough=clamp(texture(uMat,vec3(uv,float(set*6+1))).r,0.04,1.0), metal=texture(uMat,vec3(uv,float(set*6+2))).r;
    vec4 tg=bkF(uTan,t*3)*(1.0-bc.x-bc.y)+bkF(uTan,t*3+1)*bc.x+bkF(uTan,t*3+2)*bc.y; vec3 T=tg.xyz-N*dot(N,tg.xyz); vec3 Tt=vec3(0.0),Bt=vec3(0.0); vec3 Ni=N;
    { vec3 up=abs(N.y)<0.999?vec3(0,1,0):vec3(1,0,0); Tt=normalize(cross(up,N)); Bt=cross(N,Tt); }
    if(dot(T,T)>1e-8){ T=normalize(T); vec3 B=cross(N,T)*(tg.w<0.0?-1.0:1.0); Tt=T; Bt=B; vec3 nm=texture(uMat,vec3(uv,float(set*6+3))).rgb*2.0-1.0; N=normalize(T*nm.x+B*nm.y+N*nm.z); if(dot(N,Ng)<0.0) N=normalize(N-Ng*dot(N,Ng)*1.01); }
    int si=min(set,31); vec4 sk=uSk[si],sp=uSkP[si],sq=uSkQ[si]; vec3 sc=lin(uSkC[si].rgb); int kd=int(sk.x+0.5);
    float sssW=0.0; vec3 sCol=vec3(1.0); float dif=1.0,coat=0.0,coatR=0.03,sheen=0.0,sheenR=0.5; vec3 sheenC=vec3(1.0); float ax=0.0,ay=0.0; vec3 Ta=Tt,Ba=Bt; vec3 V=-rd;
    if(kd==1||kd==8){ sssW=clamp(sk.y*texture(uMat,vec3(uv,float(set*6+4))).r,0.0,1.0); sCol=lin(texture(uMat,vec3(uv,float(set*6+5))).rgb); metal=0.0; }
    else if(kd==2){ dif=0.0; metal=0.0; rough=max(clamp(sp.y,0.0,1.0),0.02); }
    else if(kd==3){ coat=clamp(sp.z,0.0,1.0); coatR=max(sq.x,0.01); vec2 cell=floor(uv/uUVs*max(sp.y,1.0)*6.0);/* flakes per texture width: Size × 6, as fine as in the normal view */ uint hc=bkPcg(uint(int(cell.x)*7919+int(cell.y)*104729+911));
      float fh=float(hc&0xffffu)/65535.0; if(fh<clamp(sp.x,0.0,1.0)*0.6){ metal=1.0; alb=mix(alb,sc,0.6); rough=0.25;
        vec3 jt=vec3(float((hc>>16u)&255u),float((hc>>8u)&255u),float(hc&255u))/255.0-0.5; N=normalize(N+(Tt*jt.x+Bt*jt.y)*0.5*clamp(sp.w,0.0,2.0)); if(dot(N,Ng)<0.05) N=Ni; } }
    else if(kd==5){ sheen=clamp(sp.x,0.0,2.0)*(0.6+0.4*sp.z); sheenR=max(sp.y,0.05); sheenC=sc; }
    else if(kd==6){ sheen=clamp(sp.x,0.0,2.0)*0.8; sheenR=mix(0.3,0.8,clamp(sp.y,0.0,1.0)); sheenC=sc; }
    else if(kd==10){ sheen=0.7; sheenR=0.4; sheenC=sc*alb; }
    else if(kd==7){ float am=clamp(sp.x,0.0,1.0),r2=max(rough*rough,0.002),ang=sp.y*PI; ax=max(r2*(1.0+2.0*am),0.002); ay=max(r2*(1.0-0.9*am),0.002); Ta=normalize(Tt*cos(ang)+Bt*sin(ang)); Ba=cross(N,Ta); }
    else if(kd==9){ vec2 d=uv/uUVs-sp.xy; float ir=max(sp.z,1e-3),r=length(d)/ir; coat=1.0; coatR=max(sq.w,0.01);
      if(r<1.0){ vec3 Vt=vec3(dot(V,Tt),dot(V,Bt),max(dot(V,Ni),0.2)); vec2 off=-Vt.xy/Vt.z*sq.x*ir*(0.3+0.7*sq.y)*(1.0-r*r)*0.5; vec2 uv2=uv+off*uUVs;
        vec4 b2=texture(uMat,vec3(uv2,float(set*6))); alb=lin(b2.rgb/max(b2.a,1e-4))*sc; float r2=length(d+off)/ir;
        if(r2<clamp(sp.w,0.05,0.95)*0.5) alb*=0.03; alb*=1.0-clamp(sq.z,0.0,1.0)*smoothstep(0.72,1.0,r); rough=max(rough,0.35); metal=0.0; } }
    float NdV=max(dot(N,V),1e-3); vec3 F0=mix(vec3(kd==1||kd==8?0.028:0.04),alb,metal); float a2=pow(rough,4.0);
    if(kd==4){ vec3 rb=0.5+0.5*cos(6.2831853*(sp.y+sp.z*(1.0-NdV)*(0.5+sp.w)+vec3(0.0,0.33,0.67))); F0=mix(F0,max(F0,vec3(0.5))*rb,clamp(sp.x,0.0,1.0)); }
    /* drawn styles (Toon, Cel, Half-tone, Ink, Hatch): their flat look with traced shadows, no further bounces */
    if(kd>=11&&kd<=15){ vec3 Ls=uSunI>0.0?normalize(uSunDir):normalize(vec3(0.4,0.8,0.45)); float li=uSunI>0.0?uSunI:1.0; float ndl=max(dot(N,Ls),0.0); float tt; vec2 bb;
      float shd=(ndl>0.0&&bkTrace(P+Ng*uEps,Ls,1e20,true,tt,bb)<0)?1.0:0.0; float x=ndl*shd,band;
      if(kd==12) band=smoothstep(sp.x-sp.y*0.5-0.001,sp.x+sp.y*0.5,x); else { float n=kd==15?3.0:max(sp.x,1.0); band=floor(x*n+0.5)/n; }
      vec3 col=alb*(envL(N)*0.35+band*li*0.9)+sp.z*pow(max(dot(N,normalize(Ls+V)),0.0),40.0)*shd*li*0.5+sp.w*pow(1.0-NdV,3.0)*0.4;
      if((kd==14||kd==15)&&band<0.34) col*=0.55; L+=thr*col; break; }
    /* Hologram: glowing lines, partly see-through */
    if(kd==16){ float fr=pow(1.0-NdV,2.0),ln=0.55+0.45*step(0.5,fract(P.y/(uEps*10000.0)*max(sp.x,1.0)));
      L+=thr*sc*sp.z*(0.25+fr)*ln*clamp(sp.w,0.0,1.0); thr*=1.0-clamp(sp.w,0.0,1.0)*0.6; ro=P+rd*uEps; continue; }
    /* the sun, if any: straight to it, unless something is in the way */
    if(uSunI>0.0){ vec3 Ls=normalize(uSunDir); float NdL=dot(N,Ls); if(NdL>0.0){ float tt; vec2 bb; if(bkTrace(P+Ng*uEps,Ls,1e20,true,tt,bb)<0){
      vec3 H=normalize(Ls+V); float NdH=max(dot(N,H),0.0),VdH=max(dot(V,H),0.0),dd=NdH*NdH*(a2-1.0)+1.0,D=a2/(PI*dd*dd),k=(rough+1.0)*(rough+1.0)/8.0,G=(NdL/(NdL*(1.0-k)+k))*(NdV/(NdV*(1.0-k)+k));
      if(ax>0.0){ float hx=dot(H,Ta)/ax,hy=dot(H,Ba)/ay,dn=hx*hx+hy*hy+NdH*NdH; D=1.0/(PI*ax*ay*dn*dn); }
      vec3 F=F0+(1.0-F0)*pow(1.0-VdH,5.0); vec3 Lb=(1.0-F)*(1.0-metal)*(1.0-sssW)*dif*alb/PI+D*G*F/max(4.0*NdL*NdV,1e-3);
      if(sheen>0.0){ float sH=sqrt(max(1.0-NdH*NdH,0.0)),ir=1.0/sheenR,Dc=(2.0+ir)*pow(sH,ir)/(2.0*PI); Lb+=sheen*sheenC*Dc/(4.0*(NdL+NdV-NdL*NdV)); }
      if(coat>0.0){ float c2=pow(coatR,4.0),dc=NdH*NdH*(c2-1.0)+1.0,Dk=c2/(PI*dc*dc),Fc=0.04+0.96*pow(1.0-VdH,5.0); Lb=Lb*(1.0-coat*Fc)+vec3(coat*Dk*Fc/max(4.0*NdV*NdL,1e-3)); }
      L+=thr*Lb*NdL*uSunI*3.0; } } }
    /* Glass: reflect or bend through, by the exact Fresnel; tinted by how far the light went inside */
    if(kd==2){ if(inside) thr*=pow(clamp(sc,0.001,1.0),vec3(th/(uEps*5000.0*max(sp.z,0.05))));/* the Glass colour, per Thickness of travel */
      vec3 m=N; float fa=rough*rough; if(rough>0.03){ vec2 xr=vec2(bkRnd(seed),bkRnd(seed+1u)); seed+=2u; float ph=2.0*PI*xr.x,ct=sqrt((1.0-xr.y)/(1.0+(fa*fa-1.0)*xr.y)),st=sqrt(1.0-ct*ct); m=normalize(Tt*(st*cos(ph))+Bt*(st*sin(ph))+N*ct); if(dot(m,V)<=0.0) m=N; }
      float ior=1.0+max(sp.x,0.01),eta=inside?ior:1.0/ior,ci=clamp(dot(V,m),0.0,1.0),s2=eta*eta*(1.0-ci*ci),Fr=1.0;
      if(s2<1.0){ float ct=sqrt(1.0-s2),rs=(eta*ci-ct)/(eta*ci+ct),rp=(ci-eta*ct)/(ci+eta*ct); Fr=0.5*(rs*rs+rp*rp); }
      if(bkRnd(seed++)<Fr){ rd=reflect(rd,m); ro=P+Ng*uEps; } else { rd=normalize(refract(rd,m,eta)); ro=P-Ng*uEps; }
      continue; }
    /* a clear coat (car paint, the eye's cornea): a sharp reflection picked by its Fresnel */
    if(coat>0.0){ float Fcv=0.04+0.96*pow(1.0-NdV,5.0); if(bkRnd(seed++)<coat*Fcv){ vec2 xr=vec2(bkRnd(seed),bkRnd(seed+1u)); seed+=2u; float c2=coatR*coatR,ph=2.0*PI*xr.x,ct=sqrt((1.0-xr.y)/(1.0+(c2*c2-1.0)*xr.y)),st=sqrt(1.0-ct*ct);
        vec3 H=normalize(Tt*(st*cos(ph))+Bt*(st*sin(ph))+Ni*ct),nd2=reflect(-V,H); if(dot(nd2,Ng)<=0.0) break; ro=P+Ng*uEps; rd=nd2; continue; } }
    /* the next bounce: a reflection (GGX) or diffuse, picked at random */
    float ps=mix(0.25,0.95,metal)*mix(1.0,0.6,rough*(1.0-metal)); vec2 xi=vec2(bkRnd(seed),bkRnd(seed+1u)); float pick=bkRnd(seed+2u); seed+=3u; vec3 nd;
    if(pick<ps){ float ph=2.0*PI*xi.x, ct=sqrt((1.0-xi.y)/(1.0+(a2-1.0)*xi.y)), st=sqrt(1.0-ct*ct); vec3 up=abs(N.y)<0.999?vec3(0,1,0):vec3(1,0,0), tx=normalize(cross(up,N)), ty=cross(N,tx);
      vec3 H=normalize(tx*(st*cos(ph))+ty*(st*sin(ph))+N*ct);
      if(ax>0.0){ float rr=sqrt(xi.y/max(1.0-xi.y,1e-6)); H=normalize(Ta*(ax*rr*cos(ph))+Ba*(ay*rr*sin(ph))+N); } nd=reflect(-V,H); float NdL=dot(N,nd); if(NdL<=0.0||dot(nd,Ng)<=0.0) break;
      float NdH=max(dot(N,H),1e-4),VdH=max(dot(V,H),1e-4),k=rough*rough/2.0,G=(NdL/(NdL*(1.0-k)+k))*(NdV/(NdV*(1.0-k)+k)); vec3 F=F0+(1.0-F0)*pow(1.0-VdH,5.0);
      thr*=F*G*VdH/(NdH*NdV)/ps; }
    else if(sssW>0.0&&bkRnd(seed++)<sssW){
      /* Skin: light goes under the surface and wanders (a random walk through the model), then comes out somewhere near, redder
         the deeper it went; thin parts (ears, nostrils) let it through to the far side */
      vec3 F=F0+(1.0-F0)*pow(1.0-NdV,5.0); thr*=(1.0-F)/(1.0-ps);
      vec3 sigT=1.0/max(sk.z*max(sCol,vec3(0.02)),vec3(1e-6)), sigS=sigT*rtSssAlpha(alb);
      vec3 wp=P-Ng*uEps, wd=bkHemi(-Ng,vec2(bkRnd(seed),bkRnd(seed+1u))); seed+=2u; bool exited=false; vec3 Nx=Ng;
      for(int w=0;w<48;w++){ float pc=bkRnd(seed++); float st=pc<0.3333?sigT.r:(pc<0.6667?sigT.g:sigT.b); float d=-log(max(1.0-bkRnd(seed++),1e-7))/st;
        float th2; vec2 bc2; int h=bkTrace(wp,wd,d,false,th2,bc2);
        if(h>=0){ vec3 Tr=exp(-sigT*th2); thr*=Tr/max(dot(Tr,vec3(1.0/3.0)),1e-8);
          vec3 u0=bkF(uTris,h*3).xyz,u1=bkF(uTris,h*3+1).xyz,u2=bkF(uTris,h*3+2).xyz; Nx=normalize(cross(u1-u0,u2-u0)); if(dot(Nx,wd)<0.0) Nx=-Nx;
          wp+=wd*th2; exited=true; break; }
        wp+=wd*d; vec3 Tr=exp(-sigT*d); thr*=sigS*Tr/max(dot(sigT*Tr,vec3(1.0/3.0)),1e-8); wd=rtIso(vec2(bkRnd(seed),bkRnd(seed+1u))); seed+=2u;
        if(max(thr.r,max(thr.g,thr.b))<1e-4) break; }
      if(!exited) break;
      thr*=0.972;/* back out through the surface */
      if(uSunI>0.0){ vec3 Ls=normalize(uSunDir); float NdL=dot(Nx,Ls); float tt; vec2 bb; if(NdL>0.0&&bkTrace(wp+Nx*uEps,Ls,1e20,true,tt,bb)<0) L+=thr*NdL/PI*uSunI*3.0; }
      ro=wp+Nx*uEps; rd=bkHemi(Nx,vec2(bkRnd(seed),bkRnd(seed+1u))); seed+=2u;
      if(bn>=2){ float q=clamp(max(thr.r,max(thr.g,thr.b)),0.05,0.95); if(bkRnd(seed++)>q) break; thr/=q; }
      continue; }
    else { nd=bkHemi(N,xi); if(dot(nd,Ng)<=0.0) nd=bkHemi(Ng,xi); vec3 F=F0+(1.0-F0)*pow(1.0-NdV,5.0); thr*=((1.0-F)*(1.0-metal)*alb+sheen*sheenC*(0.1+0.6*pow(1.0-NdV,3.0)))/(1.0-ps); }
    ro=P+Ng*uEps; rd=nd;
    if(bn>=2){ float q=clamp(max(thr.r,max(thr.g,thr.b)),0.05,0.95); if(bkRnd(seed++)>q) break; thr/=q; } }
  float lm=max(L.r,max(L.g,L.b)); if(lm>uClampL) L*=uClampL/lm;
  o=texelFetch(uPrev,px,0)+vec4(L,alpha); }`;
const FS_RTSHOW=`uniform sampler2D uAcc; uniform float uN; uniform float uExpo; uniform int uTone; uniform vec2 uOff; uniform vec3 uBg; uniform int uOpaque; uniform float uScale;
${TONE_GLSL}
/* (0.98.19) a trace made smaller than the view (Render resolution) is stretched with a smooth (bilinear) read */
vec4 accAt(vec2 q){ if(uScale>=0.999) return texelFetch(uAcc,ivec2(q),0); ivec2 sz=textureSize(uAcc,0); vec2 f=(q+0.5)*uScale-0.5; ivec2 i=ivec2(floor(f)); vec2 t=fract(f);
  ivec2 m=sz-1; vec4 a=texelFetch(uAcc,clamp(i,ivec2(0),m),0),b=texelFetch(uAcc,clamp(i+ivec2(1,0),ivec2(0),m),0),c=texelFetch(uAcc,clamp(i+ivec2(0,1),ivec2(0),m),0),d=texelFetch(uAcc,clamp(i+ivec2(1,1),ivec2(0),m),0);
  return mix(mix(a,b,t.x),mix(c,d,t.x),t.y); }
void main(){ vec4 c=accAt(gl_FragCoord.xy-uOff)/max(uN,1.0); vec3 col=pow(clamp(tone(c.rgb*uExpo),0.0,1.0),vec3(1.0/2.2));
  if(uOpaque==1){ o=vec4(mix(uBg,col,clamp(c.a,0.0,1.0)),1.0); return; } o=vec4(col*c.a,c.a); }`;
/* (0.98.19, Kenn: "raytracing controls so we can adjust the graininess ... like a denoiser") the denoiser: what the camera ray first hits
   (normal and distance; surface colour) is traced once per picture, then the noisy picture is smoothed with growing steps (an "a-trous"
   filter) that stop at edges in shape, distance and brightness. The surface colour is taken out before smoothing and put back after,
   so texture detail stays sharp. The fewer samples so far, the more it smooths. */
const FS_RTG=BK_TRACE+`precision highp sampler2DArray;
uniform highp sampler2D uUV; uniform sampler2DArray uMat; uniform mat4 uInvVP; uniform vec2 uSize; uniform float uUVs; uniform int uFlip; uniform int uMode;
vec3 lin(vec3 c){ return pow(max(c,0.0),vec3(2.2)); }
vec3 bary(highp sampler2D s,int t,vec2 bc){ return bkF(s,t*3).xyz*(1.0-bc.x-bc.y)+bkF(s,t*3+1).xyz*bc.x+bkF(s,t*3+2).xyz*bc.y; }
void main(){ vec2 ndc=(gl_FragCoord.xy)/uSize*2.0-1.0; if(uFlip==1) ndc.y=-ndc.y; vec4 a=uInvVP*vec4(ndc,-1.0,1.0),b=uInvVP*vec4(ndc,1.0,1.0); vec3 ro=a.xyz/a.w, rd=normalize(b.xyz/b.w-ro);
  float th; vec2 bc; int t=bkTrace(ro,rd,1e20,false,th,bc); if(t<0){ o=uMode==0?vec4(0.0,0.0,0.0,-1.0):vec4(0.0); return; }
  vec3 N=normalize(bary(uTN,t,bc)); if(dot(N,rd)>0.0) N=-N; if(uMode==0){ o=vec4(N,th); return; }
  int set=int(bkF(uTris,t*3).w+0.5); vec2 uv=bary(uUV,t,bc).xy*uUVs; vec4 bs=texture(uMat,vec3(uv,float(set*6))); o=vec4(lin(bs.rgb/max(bs.a,1e-4)),1.0); }`;
const FS_RTDN=`uniform sampler2D uSrc; uniform sampler2D uGA; uniform sampler2D uGB; uniform float uN; uniform int uStep; uniform float uSigL;
float lum(vec3 c){ return dot(c,vec3(0.2126,0.7152,0.0722)); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),sz=textureSize(uSrc,0); vec4 c0=texelFetch(uSrc,p,0)/max(uN,1.0); vec4 g0=texelFetch(uGA,p,0); vec3 a0=max(texelFetch(uGB,p,0).rgb,vec3(0.03));
  if(g0.w<0.0){ o=c0; return; }
  vec3 i0=c0.rgb/a0; float l0=lum(i0); vec3 sum=vec3(0.0); float ws=0.0; float k[3]=float[3](0.375,0.25,0.0625);
  for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++){ ivec2 q=p+ivec2(x,y)*uStep; if(q.x<0||q.y<0||q.x>=sz.x||q.y>=sz.y) continue;
    vec4 gq=texelFetch(uGA,q,0); if(gq.w<0.0) continue; vec4 cq=texelFetch(uSrc,q,0)/max(uN,1.0); vec3 iq=cq.rgb/max(texelFetch(uGB,q,0).rgb,vec3(0.03));
    float w=k[abs(x)]*k[abs(y)]*pow(max(dot(g0.xyz,gq.xyz),0.0),64.0)*exp(-abs(g0.w-gq.w)/(0.01*g0.w*float(uStep)+1e-5))*exp(-abs(l0-lum(iq))/(uSigL*(l0+0.05)+1e-5));
    sum+=iq*w; ws+=w; }
  o=vec4((ws>0.0?sum/ws:i0)*a0,c0.a); }`;
let P_RT=null;
/* (0.94.9) the trace is drawn in 512-pixel tiles with a flush after each: one long draw over a big view made Windows reset the graphics card (a friend's RTX 3090 lost the picture and the app stopped) */
function rtProgs(){if(!P_RT){P_RT={trace:program(FS_RT),show:program(FS_RTSHOW),g:program(FS_RTG),dn:program(FS_RTDN)};P_RT.trace.tiled=true;P_RT.g.tiled=true;}return P_RT;}
/* a render in progress: two accumulation targets (ping-pong) at the render's size */
/* 32-bit float textures can't be filtered on every card: NEAREST keeps them readable */
function rtAccT(w,h){const t=makeTarget(w,h,32,false);gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t;}
function rtSession(w,h){return {w,h,a:rtAccT(w,h),b:rtAccT(w,h),n:0,key:''};}
function rtFree(S){if(!S)return;disposeTarget(S.a);disposeTarget(S.b);for(const k of ['ga','gb','d0','d1'])if(S[k])disposeTarget(S[k]);}
/* the settings of the Ray tracing panel (0.98.19) */
function rtOpts(){const s=v3s();return {bounces:clamp(Math.round(s.rtBounces??4),1,8),clampL:s.rtClamp===0?1e6:clamp(s.rtClamp??12,1,100),dn:clamp(s.rtDenoise??.5,0,1),
  move:s.rtMove??.5,still:s.rtStill??1};}
/* the first hit of each pixel, for the denoiser (traced once per picture, with the camera of its first sample) */
function rtGBuffer(S,g,cam){const PR=rtProgs();if(!S.ga){S.ga=rtAccT(S.w,S.h);/* 32-bit float: NEAREST, or it reads as blank where float filtering is missing */S.gb=makeTarget(S.w,S.h,16,false);}
  const U={uNodes:g.nodes,uTris:g.tris,uTN:g.nrm,uTC:dummy,uUV:g.uv,uMat:{arr:rt.mat},uInvVP:{m4:m4inv(cam.VP)},uSize:[S.w,S.h],uUVs:v3s().uvs||1,uFlip:false};
  run(PR.g,S.ga,Object.assign({uMode:{int:0}},U));run(PR.g,S.gb,Object.assign({uMode:{int:1}},U));S.gOk=true;}
/* the denoised picture of session S (a texture holding the average, so it is shown with uN 1), or null when the denoiser is off */
function rtDenoised(S,strength){if(!(strength>0)||!S.gOk||!S.n)return null;const PR=rtProgs();if(!S.d0){S.d0=makeTarget(S.w,S.h,16,false);S.d1=makeTarget(S.w,S.h,16,false);}
  const it=1+Math.round(strength*4),sig=(0.4+3*strength)/Math.sqrt(S.n)+.02*strength;let src=S.a.tex,n=S.n,dst=S.d0,other=S.d1;
  for(let i=0;i<it;i++){run(PR.dn,dst,{uSrc:src,uGA:S.ga.tex,uGB:S.gb.tex,uN:n,uStep:{int:1<<i},uSigL:sig});src=dst.tex;n=1;const t=dst;dst=other;other=t;}
  return src;}
function rtCamera(w,h,flip,yawAdd){const s=v3s(),c=v3.cam,cam=yawAdd?Object.assign({},c,{yaw:c.yaw+yawAdd}):c,cp=Math.cos(cam.pitch),eye=[cam.tx+Math.sin(cam.yaw)*cp*cam.dist,cam.ty+Math.sin(cam.pitch)*cam.dist,cam.tz+Math.cos(cam.yaw)*cp*cam.dist];
  const V=m4look(eye,[cam.tx,cam.ty,cam.tz],[0,1,0]),Pm=m4persp(s.fov*Math.PI/180,w/h,...v3Clip());if(flip)Pm[5]=-Pm[5];return {VP:m4mul(Pm,V),eye};}
/* one more sample into session S; bg: 0 HDRI, 1 colour, 2 transparent */
function rtStep(S,g,o){const s=v3s(),PR=rtProgs(),E=envUniforms(),a=s.sunAz*Math.PI/180,e=s.sunEl*Math.PI/180,cam=rtCamera(S.w,S.h,false,o.yaw||0);if(S.n===0)rtGBuffer(S,g,cam);
  const envOn=!!(E.uEnvOn&&envOf(s)!=='none');run(PR.trace,S.b,{uNodes:g.nodes,uTris:g.tris,uTN:g.nrm,uTC:dummy,uUV:g.uv,uTan:g.tan,uMat:{arr:rt.mat},uEnvSrc:envOn?envG().src.tex:dummy,uEnvOn:envOn,uEnvRot:(s.envRot||0)/360+(o.envAdd||0),uEnvI:s.envI==null?1:s.envI,
    uInvVP:{m4:m4inv(cam.VP)},uSize:[S.w,S.h],uFrame:{int:S.n},uPrev:S.a.tex,uBounces:{int:o.bounces||4},uSunDir:[Math.cos(e)*Math.sin(a),Math.sin(e),Math.cos(e)*Math.cos(a)],uSunI:envOn?(s.envSun||0):s.sunI,
    uBg:{int:o.bg==null?0:o.bg},uBgCol:o.bgCol||[0,0,0],...rtKindUniforms(rtShadeList()),uUVs:s.uvs||1,uEps:g.radius*2e-4,uClampL:o.clampL||rtOpts().clampL,uFlip:false});
  const t=S.a;S.a=S.b;S.b=t;S.n++;}
const envG=()=>env;
/* ---- the 3D view's "Ray traced" mode ---- */
function rtViewKey(F){const c=v3.cam,s=v3s();return [F.w,F.h,c.yaw,c.pitch,c.dist,c.tx,c.ty,c.tz,s.fov,s.env,s.envRot,s.envI,s.envSun,s.sunAz,s.sunEl,s.envBg,s.bg,v3.lastFull,rt.texVer||'',rt.ver,env.key,rtSkinKey(rtShadeList()),rtOpts().bounces,rtOpts().clampL].join();}
function rtViewDraw(F){const g=rt.mesh===v3.mesh?rt.g:null;if(!g){if(v3.infoEl)v3.infoEl.textContent='Preparing ray tracing…';rtScene().then(()=>{v3.dirty=true;requestRender();});return null;}
  const E=envUniforms();if(envOf(v3s())!=='none'&&!E.uEnvOn){setTimeout(()=>{v3.dirty=true;requestRender();},100);return null;}
  rtMaterials(g);const O=rtOpts(),now=performance.now(),key0=rtViewKey(F);
  /* (0.98.19) Render resolution: smaller while the view moves, then the still size once it has rested 0.3 s */
  const c=v3.cam,camK=[F.w,F.h,c.yaw,c.pitch,c.dist,c.tx,c.ty,c.tz,v3s().fov].join();rt.lastKey0=key0;if(camK!==rt.camK){if(rt.camK)rt.movedAt=now;rt.camK=camK;}/* only the camera moving counts */const moving=now-(rt.movedAt||0)<300&&rt.view&&rt.view.n>0,sc=clamp(moving?O.move:O.still,.25,1);
  if(moving){clearTimeout(rt.stillT);rt.stillT=setTimeout(()=>{v3.dirty=true;requestRender();},320);}
  const W=Math.max(1,Math.round(F.w*sc)),H=Math.max(1,Math.round(F.h*sc)),key=key0+'|'+W+'x'+H;let S=rt.view;if(!S||S.w!==W||S.h!==H){rtFree(S);S=rt.view=rtSession(W,H);}
  if(S.key!==key){S.key=key;S.n=0;clearTarget(S.a);clearTarget(S.b);}
  const s=v3s(),max=s.rtSamples||qual('rt');if(S.n<max){const per=1;for(let i=0;i<per&&S.n<max;i++)rtStep(S,g,{bg:s.envBg?0:1,bgCol:(BG3[s.bg]||BG3.dark).map(v=>Math.pow(v,2.2)),bounces:O.bounces});}
  const dn=rtDenoised(S,O.dn);
  gl.bindFramebuffer(gl.FRAMEBUFFER,F.ms);gl.viewport(0,0,F.w,F.h);useProg(rtProgs().show,{uAcc:dn||S.a.tex,uN:dn?1:S.n,uExpo:s.expo,uTone:{int:toneInt(s)},uOff:[0,0],uBg:BG3[s.bg]||BG3.dark,uOpaque:true,uScale:S.w/F.w});gl.bindVertexArray(vao);gl.disable(gl.DEPTH_TEST);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,F.ms);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,F.rf);gl.blitFramebuffer(0,0,F.w,F.h,0,0,F.w,F.h,gl.COLOR_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(v3.infoEl)v3.infoEl.textContent='Ray traced · '+S.n+' / '+max+' samples'+(sc<1?' · '+Math.round(sc*100)+'% size':'')+(dn?' · denoised':'')+(S.n<max?' (cleaning up…)':'');
  return S.n<max;}
/* ---- reading a finished picture back ---- */
function rtPixels(S,opaque){const t=makeTarget(S.w,S.h,8,false),dn=rtDenoised(S,rtOpts().dn);run(rtProgs().show,t,{uScale:1,uAcc:dn||S.a.tex,uN:dn?1:S.n,uExpo:v3s().expo,uTone:{int:toneInt(v3s())},uOff:[0,0],uBg:[0,0,0],uOpaque:!!opaque});
  const d=captureRegionNow(t,0,0,S.w,S.h).data;disposeTarget(t);return d;}
/* RGBA rows (bottom first, premultiplied or not) → PNG blob */
async function pixelsToPNG(w,h,d,premul){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h);
  for(let y=0;y<h;y++){const src=(h-1-y)*w*4,dst=y*w*4;for(let i=0;i<w*4;i+=4){const a=d[src+i+3];if(premul&&a>0&&a<255){im.data[dst+i]=Math.min(255,d[src+i]*255/a);im.data[dst+i+1]=Math.min(255,d[src+i+1]*255/a);im.data[dst+i+2]=Math.min(255,d[src+i+2]*255/a);}else{im.data[dst+i]=d[src+i];im.data[dst+i+1]=d[src+i+1];im.data[dst+i+2]=d[src+i+2];}im.data[dst+i+3]=a;}}
  x.putImageData(im,0,0);return await new Promise(r=>c.toBlob(r,'image/png'));}
