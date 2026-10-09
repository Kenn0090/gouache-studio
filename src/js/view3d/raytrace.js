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
const RT_MAPS=[['base',[0,0,0,0]],['rough',null],['metal',null],['nfinal',[.5,.5,1,1]]];
function rtMaterials(g){const list=ui.mode==='p3d'&&typeof p3DrawList==='function'?p3DrawList():[{T:v3.tex}],key=v3.lastFull+':'+list.length+':'+(doc.maps||[]).join()+':'+(doc.workflow||'');
  if(rt.mat&&rt.matKey===key)return rt.mat;const S=1024,L=list.length*4;if(rt.mat)gl.deleteTexture(rt.mat);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D_ARRAY,tex);gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.RGBA8,S,S,L,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  const fb=gl.createFramebuffer(),sgW=doc.workflow==='spec',sgK={base:'sgBase',metal:'sgMetal',rough:'sgRough'},has=k=>k==='nfinal'?doc.maps.includes('height')||doc.maps.includes('normal')||!!meshNormalBase():doc.maps.includes(k)||(sgW&&(k==='metal'||k==='rough'));
  list.forEach((it,i)=>{const T=it.T||{};RT_MAPS.forEach(([k,def],j)=>{gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,fb);gl.framebufferTextureLayer(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,tex,0,i*4+j);
    /* (0.52) a Spec/Gloss set is traced with the base / metal / rough the viewer derives from its Specular and Glossiness */
    const src=sgW&&sgK[k]&&T[sgK[k]]?T[sgK[k]]:T[k];if(src&&src.fbo&&has(k)){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,src.fbo);gl.blitFramebuffer(0,0,src.w,src.h,0,0,S,S,gl.COLOR_BUFFER_BIT,gl.LINEAR);}
    else{const d=def||[mapDefault(k)[0],0,0,1];gl.viewport(0,0,S,S);gl.clearColor(d[0],d[1],d[2],d[3]);gl.clear(gl.COLOR_BUFFER_BIT);}});});
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(fb);gl.bindTexture(gl.TEXTURE_2D_ARRAY,tex);gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.REPEAT);rt.mat=tex;rt.matKey=key;return tex;}
const FS_RT=BK_TRACE+`precision highp sampler2DArray;
uniform highp sampler2D uUV; uniform highp sampler2D uTan; uniform sampler2DArray uMat; uniform sampler2D uEnvSrc; uniform int uEnvOn; uniform float uEnvRot; uniform float uEnvI;
uniform mat4 uInvVP; uniform vec2 uSize; uniform int uFrame; uniform sampler2D uPrev; uniform int uBounces; uniform vec3 uSunDir; uniform float uSunI; uniform int uBg; uniform vec3 uBgCol; uniform float uUVs; uniform float uEps; uniform float uClampL; uniform int uFlip;
const float PI=3.14159265;
vec3 lin(vec3 c){ return pow(max(c,0.0),vec3(2.2)); }
vec3 sky(vec3 d){ float y=d.y; vec3 zen=vec3(0.32,0.45,0.72),hor=vec3(0.78,0.80,0.84),gnd=vec3(0.24,0.22,0.20); return y>0.0?mix(hor,zen,pow(y,0.6)):mix(hor,gnd,pow(-y,0.4)); }
vec3 envL(vec3 d){ if(uEnvOn==0) return sky(d); return textureLod(uEnvSrc,vec2(atan(d.x,-d.z)/(2.0*PI)+0.5+uEnvRot,acos(clamp(d.y,-1.0,1.0))/PI),0.0).rgb*uEnvI; }
vec3 bary(highp sampler2D s,int t,vec2 bc){ return bkF(s,t*3).xyz*(1.0-bc.x-bc.y)+bkF(s,t*3+1).xyz*bc.x+bkF(s,t*3+2).xyz*bc.y; }
void main(){ ivec2 px=ivec2(gl_FragCoord.xy); uint seed=uint(px.x)*1973u+uint(px.y)*9277u+uint(uFrame)*26699u+1u;
  vec2 jit=vec2(bkRnd(seed),bkRnd(seed+1u)); seed+=2u; vec2 ndc=(vec2(px)+jit)/uSize*2.0-1.0; if(uFlip==1) ndc.y=-ndc.y;
  vec4 a=uInvVP*vec4(ndc,-1.0,1.0),b=uInvVP*vec4(ndc,1.0,1.0); vec3 ro=a.xyz/a.w, rd=normalize(b.xyz/b.w-ro);
  vec3 thr=vec3(1.0), L=vec3(0.0); float alpha=0.0;
  for(int bn=0;bn<8;bn++){ if(bn>=uBounces) break; float th; vec2 bc; int t=bkTrace(ro,rd,1e20,false,th,bc);
    if(t<0){ if(bn==0){ if(uBg==0){ L+=envL(rd); alpha=1.0; } else if(uBg==1){ L+=uBgCol; alpha=1.0; } } else L+=thr*envL(rd); break; }
    if(bn==0) alpha=1.0;
    vec3 v0=bkF(uTris,t*3).xyz,v1=bkF(uTris,t*3+1).xyz,v2=bkF(uTris,t*3+2).xyz; int set=int(bkF(uTris,t*3).w+0.5);
    vec3 Ng=normalize(cross(v1-v0,v2-v0)); if(dot(Ng,rd)>0.0) Ng=-Ng; vec3 P=ro+rd*th;
    vec3 N=normalize(bary(uTN,t,bc)); if(dot(N,Ng)<0.0) N=-N; vec2 uv=bary(uUV,t,bc).xy*uUVs;
    vec4 bs=texture(uMat,vec3(uv,float(set*4))); if(bs.a<0.5){ ro=P+rd*uEps; continue; }
    vec3 alb=lin(bs.rgb/max(bs.a,1e-4)); float rough=clamp(texture(uMat,vec3(uv,float(set*4+1))).r,0.04,1.0), metal=texture(uMat,vec3(uv,float(set*4+2))).r;
    vec4 tg=bkF(uTan,t*3)*(1.0-bc.x-bc.y)+bkF(uTan,t*3+1)*bc.x+bkF(uTan,t*3+2)*bc.y; vec3 T=tg.xyz-N*dot(N,tg.xyz);
    if(dot(T,T)>1e-8){ T=normalize(T); vec3 B=cross(N,T)*(tg.w<0.0?-1.0:1.0); vec3 nm=texture(uMat,vec3(uv,float(set*4+3))).rgb*2.0-1.0; N=normalize(T*nm.x+B*nm.y+N*nm.z); if(dot(N,Ng)<0.0) N=normalize(N-Ng*dot(N,Ng)*1.01); }
    vec3 V=-rd; float NdV=max(dot(N,V),1e-3); vec3 F0=mix(vec3(0.04),alb,metal); float a2=pow(rough,4.0);
    /* the sun, if any: straight to it, unless something is in the way */
    if(uSunI>0.0){ vec3 Ls=normalize(uSunDir); float NdL=dot(N,Ls); if(NdL>0.0){ float tt; vec2 bb; if(bkTrace(P+Ng*uEps,Ls,1e20,true,tt,bb)<0){
      vec3 H=normalize(Ls+V); float NdH=max(dot(N,H),0.0),VdH=max(dot(V,H),0.0),dd=NdH*NdH*(a2-1.0)+1.0,D=a2/(PI*dd*dd),k=(rough+1.0)*(rough+1.0)/8.0,G=(NdL/(NdL*(1.0-k)+k))*(NdV/(NdV*(1.0-k)+k));
      vec3 F=F0+(1.0-F0)*pow(1.0-VdH,5.0); L+=thr*((1.0-F)*(1.0-metal)*alb/PI+D*G*F/max(4.0*NdL*NdV,1e-3))*NdL*uSunI*3.0; } } }
    /* the next bounce: a reflection (GGX) or diffuse, picked at random */
    float ps=mix(0.25,0.95,metal)*mix(1.0,0.6,rough*(1.0-metal)); vec2 xi=vec2(bkRnd(seed),bkRnd(seed+1u)); float pick=bkRnd(seed+2u); seed+=3u; vec3 nd;
    if(pick<ps){ float ph=2.0*PI*xi.x, ct=sqrt((1.0-xi.y)/(1.0+(a2-1.0)*xi.y)), st=sqrt(1.0-ct*ct); vec3 up=abs(N.y)<0.999?vec3(0,1,0):vec3(1,0,0), tx=normalize(cross(up,N)), ty=cross(N,tx);
      vec3 H=normalize(tx*(st*cos(ph))+ty*(st*sin(ph))+N*ct); nd=reflect(-V,H); float NdL=dot(N,nd); if(NdL<=0.0||dot(nd,Ng)<=0.0) break;
      float NdH=max(dot(N,H),1e-4),VdH=max(dot(V,H),1e-4),k=rough*rough/2.0,G=(NdL/(NdL*(1.0-k)+k))*(NdV/(NdV*(1.0-k)+k)); vec3 F=F0+(1.0-F0)*pow(1.0-VdH,5.0);
      thr*=F*G*VdH/(NdH*NdV)/ps; }
    else { nd=bkHemi(N,xi); if(dot(nd,Ng)<=0.0) nd=bkHemi(Ng,xi); vec3 F=F0+(1.0-F0)*pow(1.0-NdV,5.0); thr*=(1.0-F)*(1.0-metal)*alb/(1.0-ps); }
    ro=P+Ng*uEps; rd=nd;
    if(bn>=2){ float q=clamp(max(thr.r,max(thr.g,thr.b)),0.05,0.95); if(bkRnd(seed++)>q) break; thr/=q; } }
  float lm=max(L.r,max(L.g,L.b)); if(lm>uClampL) L*=uClampL/lm;
  o=texelFetch(uPrev,px,0)+vec4(L,alpha); }`;
const FS_RTSHOW=`uniform sampler2D uAcc; uniform float uN; uniform float uExpo; uniform int uTone; uniform vec2 uOff; uniform vec3 uBg; uniform int uOpaque;
${TONE_GLSL}
void main(){ vec4 c=texelFetch(uAcc,ivec2(gl_FragCoord.xy-uOff),0)/max(uN,1.0); vec3 col=pow(clamp(tone(c.rgb*uExpo),0.0,1.0),vec3(1.0/2.2));
  if(uOpaque==1){ o=vec4(mix(uBg,col,clamp(c.a,0.0,1.0)),1.0); return; } o=vec4(col*c.a,c.a); }`;
let P_RT=null;
function rtProgs(){if(!P_RT)P_RT={trace:program(FS_RT),show:program(FS_RTSHOW)};return P_RT;}
/* a render in progress: two accumulation targets (ping-pong) at the render's size */
/* 32-bit float textures can't be filtered on every card: NEAREST keeps them readable */
function rtAccT(w,h){const t=makeTarget(w,h,32,false);gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t;}
function rtSession(w,h){return {w,h,a:rtAccT(w,h),b:rtAccT(w,h),n:0,key:''};}
function rtFree(S){if(!S)return;disposeTarget(S.a);disposeTarget(S.b);}
function rtCamera(w,h,flip,yawAdd){const s=v3s(),c=v3.cam,cam=yawAdd?Object.assign({},c,{yaw:c.yaw+yawAdd}):c,cp=Math.cos(cam.pitch),eye=[cam.tx+Math.sin(cam.yaw)*cp*cam.dist,cam.ty+Math.sin(cam.pitch)*cam.dist,cam.tz+Math.cos(cam.yaw)*cp*cam.dist];
  const V=m4look(eye,[cam.tx,cam.ty,cam.tz],[0,1,0]),Pm=m4persp(s.fov*Math.PI/180,w/h,.02,100);if(flip)Pm[5]=-Pm[5];return {VP:m4mul(Pm,V),eye};}
/* one more sample into session S; bg: 0 HDRI, 1 colour, 2 transparent */
function rtStep(S,g,o){const s=v3s(),PR=rtProgs(),E=envUniforms(),a=s.sunAz*Math.PI/180,e=s.sunEl*Math.PI/180,cam=rtCamera(S.w,S.h,false,o.yaw||0);
  const envOn=!!(E.uEnvOn&&envOf(s)!=='none');run(PR.trace,S.b,{uNodes:g.nodes,uTris:g.tris,uTN:g.nrm,uTC:dummy,uUV:g.uv,uTan:g.tan,uMat:{arr:rt.mat},uEnvSrc:envOn?envG().src.tex:dummy,uEnvOn:envOn,uEnvRot:(s.envRot||0)/360+(o.envAdd||0),uEnvI:s.envI==null?1:s.envI,
    uInvVP:{m4:m4inv(cam.VP)},uSize:[S.w,S.h],uFrame:{int:S.n},uPrev:S.a.tex,uBounces:{int:o.bounces||4},uSunDir:[Math.cos(e)*Math.sin(a),Math.sin(e),Math.cos(e)*Math.cos(a)],uSunI:envOn?(s.envSun||0):s.sunI,
    uBg:{int:o.bg==null?0:o.bg},uBgCol:o.bgCol||[0,0,0],uUVs:s.uvs||1,uEps:g.radius*2e-4,uClampL:o.clampL||12,uFlip:false});
  const t=S.a;S.a=S.b;S.b=t;S.n++;}
const envG=()=>env;
/* ---- the 3D view's "Ray traced" mode ---- */
function rtViewKey(F){const c=v3.cam,s=v3s();return [F.w,F.h,c.yaw,c.pitch,c.dist,c.tx,c.ty,c.tz,s.fov,s.env,s.envRot,s.envI,s.envSun,s.sunAz,s.sunEl,s.envBg,s.bg,v3.lastFull,rt.ver,env.key].join();}
function rtViewDraw(F){const g=rt.mesh===v3.mesh?rt.g:null;if(!g){if(v3.infoEl)v3.infoEl.textContent='Preparing ray tracing…';rtScene().then(()=>{v3.dirty=true;requestRender();});return null;}
  const E=envUniforms();if(envOf(v3s())!=='none'&&!E.uEnvOn){setTimeout(()=>{v3.dirty=true;requestRender();},100);return null;}
  rtMaterials(g);let S=rt.view;const key=rtViewKey(F);if(!S||S.w!==F.w||S.h!==F.h){rtFree(S);S=rt.view=rtSession(F.w,F.h);}
  if(S.key!==key){S.key=key;S.n=0;clearTarget(S.a);clearTarget(S.b);}
  const s=v3s(),max=s.rtSamples||qual('rt');if(S.n<max){const per=S.n<4?1:2;for(let i=0;i<per&&S.n<max;i++)rtStep(S,g,{bg:s.envBg?0:1,bgCol:(BG3[s.bg]||BG3.dark).map(v=>Math.pow(v,2.2))});}
  gl.bindFramebuffer(gl.FRAMEBUFFER,F.ms);gl.viewport(0,0,F.w,F.h);useProg(rtProgs().show,{uAcc:S.a.tex,uN:S.n,uExpo:s.expo,uTone:{int:toneInt(s)},uOff:[0,0],uBg:BG3[s.bg]||BG3.dark,uOpaque:true});gl.bindVertexArray(vao);gl.disable(gl.DEPTH_TEST);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,F.ms);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,F.rf);gl.blitFramebuffer(0,0,F.w,F.h,0,0,F.w,F.h,gl.COLOR_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(v3.infoEl)v3.infoEl.textContent='Ray traced · '+S.n+' / '+max+' samples'+(S.n<max?' (cleaning up…)':'');
  return S.n<max;}
/* ---- reading a finished picture back ---- */
function rtPixels(S,opaque){const t=makeTarget(S.w,S.h,8,false);run(rtProgs().show,t,{uAcc:S.a.tex,uN:S.n,uExpo:v3s().expo,uTone:{int:toneInt(v3s())},uOff:[0,0],uBg:[0,0,0],uOpaque:!!opaque});
  const d=captureRegionNow(t,0,0,S.w,S.h).data;disposeTarget(t);return d;}
/* RGBA rows (bottom first, premultiplied or not) → PNG blob */
async function pixelsToPNG(w,h,d,premul){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h);
  for(let y=0;y<h;y++){const src=(h-1-y)*w*4,dst=y*w*4;for(let i=0;i<w*4;i+=4){const a=d[src+i+3];if(premul&&a>0&&a<255){im.data[dst+i]=Math.min(255,d[src+i]*255/a);im.data[dst+i+1]=Math.min(255,d[src+i+1]*255/a);im.data[dst+i+2]=Math.min(255,d[src+i+2]*255/a);}else{im.data[dst+i]=d[src+i];im.data[dst+i+1]=d[src+i+1];im.data[dst+i+2]=d[src+i+2];}im.data[dst+i+3]=a;}}
  x.putImageData(im,0,0);return await new Promise(r=>c.toBlob(r,'image/png'));}
