/* ================= 3D view =================
   The model is drawn by the same GPU context as the canvas, so it uses the document's maps
   directly (no copying through the CPU). The canvas element spans the painting area and the
   3D pane; the 2D view draws first and the 3D picture is copied into the pane's part. */
const VS_3D=`#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aT; layout(location=3) in vec4 aTan; layout(location=4) in vec3 aD;
uniform mat4 uVP; uniform float uUVs; uniform sampler2D uH; uniform float uDisp; uniform int uUseH; uniform int uUseUDIM; uniform vec2 uUDIMTile;
out vec3 vP; out vec3 vN; out vec2 vT; out vec4 vTan;
void main(){ vec2 t=aT*uUVs; vec3 p=aP; if(uUseH==1&&uDisp!=0.0){ float h=textureLod(uH,uUseUDIM==1?fract(t):t,0.0).r-0.5; p+=aD*h*uDisp; }
  vP=p; vN=aN; vT=t; vTan=aTan; gl_Position=uVP*vec4(p,1.0); }`;
/* tone mapping: 0 soft, 1 filmic (quick ACES fit), 2 ACES (full), 3 AgX, 4 PBR Neutral (Khronos), 5 none */
const TONE_GLSL=`vec3 acesHill(vec3 c){ const mat3 I=mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777); const mat3 O=mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
  c=I*(c/0.6); vec3 a=c*(c+0.0245786)-0.000090537; vec3 b=c*(0.983729*c+0.4329510)+0.238081; return clamp(O*(a/b),0.0,1.0); }
vec3 agxCurve(vec3 x){ vec3 x2=x*x, x4=x2*x2; return 15.5*x4*x2-40.14*x4*x+31.96*x4-6.868*x2*x+0.4298*x2+0.1191*x-0.00232; }
vec3 agxMap(vec3 c){ const mat3 S2R=mat3(0.6274,0.0691,0.0164, 0.3293,0.9195,0.0880, 0.0433,0.0113,0.8956); const mat3 R2S=mat3(1.6605,-0.1246,-0.0182, -0.5876,1.1329,-0.1006, -0.0728,-0.0083,1.1187);
  const mat3 IN=mat3(0.856627153315983,0.137318972929847,0.11189821299995, 0.0951212405381588,0.761241990602591,0.0767994186031903, 0.0482516061458583,0.101439036467306,0.811302368396859);
  c=IN*(S2R*c); c=max(c,vec3(1e-10)); c=clamp((log2(c)+12.47393)/16.500,0.0,1.0); c=agxCurve(c); c=inverse(IN)*c; c=pow(max(c,vec3(0.0)),vec3(2.2)); return clamp(R2S*c,0.0,1.0); }
vec3 pbrNeutral(vec3 c){ const float sc=0.76; const float ds=0.15; float x=min(c.r,min(c.g,c.b)); float off=x<0.08?x-6.25*x*x:0.04; c-=off; float pk=max(c.r,max(c.g,c.b)); if(pk<sc) return c;
  float d=1.0-sc; float np=1.0-d*d/(pk+d-sc); c*=np/pk; float g=1.0-1.0/(ds*(pk-np)+1.0); return mix(c,vec3(np),g); }
vec3 tone(vec3 c){ if(uTone==1){ c*=0.6; return clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14),0.0,1.0); } if(uTone==2) return acesHill(c); if(uTone==3) return agxMap(c); if(uTone==4) return clamp(pbrNeutral(c),0.0,1.0); if(uTone==5) return clamp(c,0.0,1.0); return c/(1.0+c*0.12); }`;
const TONE_LIST=[['filmic','Filmic',1],['aces','ACES',2],['agx','AgX',3],['khr','PBR Neutral',4],['neutral','Soft',0],['none','None (linear)',5]];
const toneInt=s=>{const t=TONE_LIST.find(x=>x[0]===(s&&s.tone));return t?t[2]:1;};
const FS_3D=`in vec3 vP; in vec3 vN; in vec2 vT; in vec4 vTan;
uniform int uUseUDIM; uniform vec2 uUDIMTile;
uniform sampler2D uBase; uniform sampler2D uRough; uniform sampler2D uMetal; uniform sampler2D uNrm; uniform sampler2D uAO; uniform sampler2D uEmis; uniform sampler2D uOpac; uniform sampler2D uThick;
uniform int uUseSafeMip;
uniform int uFlipY; uniform int uHas; uniform vec2 uDef; uniform vec3 uCam; uniform vec3 uSun; uniform float uSunI; uniform float uSkyI; uniform float uExpo; uniform int uUnlit; uniform int uClip;
/* the HDRI (0.26): 6 levels from sharp to fully rough, and the diffuse light */
uniform int uEnvOn; uniform float uEnvRot; uniform float uEnvI; uniform sampler2D uEnv0; uniform sampler2D uEnv1; uniform sampler2D uEnv2; uniform sampler2D uEnv3; uniform sampler2D uEnv4; uniform sampler2D uEnv5; uniform sampler2D uIrr; uniform int uTone;
/* the texture set's shader: 0 standard, 1 skin, 2 anisotropic metal, 3 velvet, 4 toon, 5 cel, 6 spec/gloss view; its settings */
uniform vec4 uSkin; uniform int uSh; uniform vec4 uShP; uniform vec4 uShQ; uniform vec3 uShC; uniform vec3 uShD;
/* the Panner shader (0.40): each map slid by its own offset */
uniform vec2 uPB; uniform vec2 uPR; uniform vec2 uPM; uniform vec2 uPN; uniform vec2 uPA; uniform vec2 uPE; uniform vec2 uPO;
const float PI=3.14159265;
vec3 lin(vec3 c){ return pow(max(c,0.0),vec3(2.2)); }
vec3 sky(vec3 d){ float y=d.y; vec3 zen=vec3(0.32,0.45,0.72),hor=vec3(0.78,0.80,0.84),gnd=vec3(0.24,0.22,0.20);
  return y>0.0?mix(hor,zen,pow(y,0.6)):mix(hor,gnd,pow(-y,0.4)); }
vec2 envUV(vec3 d){ return vec2(atan(d.x,-d.z)/(2.0*PI)+0.5+uEnvRot, acos(clamp(d.y,-1.0,1.0))/PI); }
vec3 envLv(int i,vec2 uv){ if(i<=0) return texture(uEnv0,uv).rgb; if(i==1) return texture(uEnv1,uv).rgb; if(i==2) return texture(uEnv2,uv).rgb; if(i==3) return texture(uEnv3,uv).rgb; if(i==4) return texture(uEnv4,uv).rgb; return texture(uEnv5,uv).rgb; }
vec3 envSpec(vec3 R,float r){ if(uEnvOn==0) return mix(sky(R),mix(sky(R),vec3(0.55),0.5),r*r); vec2 uv=envUV(R); float f=clamp(r,0.0,1.0)*5.0; int i=int(floor(f)); return mix(envLv(i,uv),envLv(min(i+1,5),uv),f-float(i))*uEnvI; }
vec3 envDif(vec3 N){ if(uEnvOn==0) return mix(sky(N),vec3(0.5),0.35); return texture(uIrr,envUV(N)).rgb*uEnvI; }
/* split-sum reflection factor (Karis' fit) */
vec2 envBRDF(float NdV,float r){ vec4 rr=r*vec4(-1.0,-0.0275,-0.572,0.022)+vec4(1.0,0.0425,1.04,-0.04); float a004=min(rr.x*rr.x,exp2(-9.28*NdV))*rr.x+rr.y; return vec2(-1.04,1.04)*a004+rr.zw; }
${STUDIO_SHADOW_GLSL}
${STUDIO_LIGHT_GLSL}
${TONE_GLSL}
/* Clamp minification near packed UV borders so lower mip levels cannot sample a neighbouring island. */
void mapGrad(vec2 uv,out vec2 dx,out vec2 dy){dx=dFdx(uv);dy=dFdy(uv);if(uUseSafeMip==0)return;
 ivec2 sz=textureSize(uThick,0),p=clamp(ivec2(floor(uv*vec2(sz))),ivec2(0),sz-1);float maxLod=texelFetch(uThick,p,0).r*16.0;
 vec2 x=dx*vec2(sz),y=dy*vec2(sz);float lod=max(0.0,0.5*log2(max(dot(x,x),dot(y,y))));
 if(lod>maxLod){float k=exp2(maxLod-lod);dx*=k;dy*=k;}}
vec4 mapSample(sampler2D tex,vec2 uv){vec2 dx,dy;mapGrad(uv,dx,dy);return textureGrad(tex,uv,dx,dy);}
void main(){ if(uUseUDIM==1&&any(notEqual(floor(vT),uUDIMTile)))discard; vec2 uv=uUseUDIM==1?fract(vT):vT; vec4 b=mapSample(uBase,uv+uPB); float a=b.a; if((uHas&64)!=0) a*=mapSample(uOpac,uv+uPO).r;
  if(uClip==1&&a<0.5) discard; vec3 alb=b.a>1e-5?b.rgb/b.a:vec3(0.0);
  if(uUnlit==1){ vec3 c=alb; if((uHas&8)!=0) c*=mapSample(uAO,uv+uPA).r; o=vec4(c,1.0); return; }
  alb=lin(alb);
  vec3 Ng=normalize(vN),N=Ng; vec3 T=normalize(vTan.xyz-Ng*dot(Ng,vTan.xyz)), B=cross(Ng,T)*vTan.w;
  if((uHas&4)!=0){ vec3 n=mapSample(uNrm,uv+uPN).rgb*2.0-1.0; N=normalize(T*n.x+B*n.y+Ng*n.z); }
  /* which side faces the camera, from the surface itself (not the triangles' winding, which differs between models) */
  { vec3 Nf=normalize(cross(dFdx(vP),dFdy(vP))); if(dot(Nf,uCam-vP)<0.0) Nf=-Nf; if(dot(Ng,Nf)<0.0){ N=-N; Ng=-Ng; } }
  float rough=clamp((uHas&1)!=0?mapSample(uRough,uv+uPR).r:uDef.x,0.04,1.0), metal=(uHas&2)!=0?mapSample(uMetal,uv+uPM).r:uDef.y, ao=(uHas&8)!=0?mapSample(uAO,uv+uPA).r:1.0;
  vec3 V=normalize(uCam-vP), L=normalize(uSun), H=normalize(L+V);
  float NdL=max(dot(N,L),0.0), NdV=max(dot(N,V),1e-3), NdH=max(dot(N,H),0.0), VdH=max(dot(V,H),0.0);
  vec3 F0=mix(vec3(0.04),alb,metal), col=vec3(0.0);
  /* ---- toon and cel: flat bands of light from the key light (the sun's direction) ---- */
  if(uSh==4||uSh==5){ float l=dot(N,L)*0.5+0.5, band;
    if(uSh==4){ float st=max(uShP.x,1.0); band=floor(l*st+0.5*uShQ.y)/st; } else band=smoothstep(uShP.x-uShP.y*0.5,uShP.x+uShP.y*0.5+1e-4,l);
    vec3 base=mix(alb*lin(uShC),alb,clamp(band,0.0,1.0));
    float sp=step(1.0-uShP.z*0.05,NdH)*(1.0-rough*0.5)*step(0.01,uShP.z); float rim=smoothstep(1.0-uShP.w,1.0,1.0-NdV)*uShP.w;
    vec3 amb=envDif(N)*0.25; col=base*(0.75+0.25*uEnvI)+base*amb*ao+vec3(sp)+alb*rim;
    if((uHas&16)!=0) col+=lin(mapSample(uEmis,uv+uPE).rgb)*2.0; o=vec4(pow(clamp(col*uExpo,0.0,1.0),vec3(1.0/2.2)),1.0); return; }
  /* ---- the lit shaders ---- */
  float a2=pow(rough,4.0), dd=NdH*NdH*(a2-1.0)+1.0, D=a2/(PI*dd*dd);
  vec3 Ts=T,Bs=B;
  if(uSh==2){ float ang=uShP.y*2.0*PI; Ts=normalize(T*cos(ang)+B*sin(ang)); Ts=normalize(Ts-N*dot(N,Ts)); Bs=cross(N,Ts);
    float an=clamp(uShP.x,-0.95,0.95), ar=rough*rough, ax=max(ar*(1.0+an),0.002), ay=max(ar*(1.0-an),0.002), th=dot(Ts,H)/ax, bh=dot(Bs,H)/ay, q=th*th+bh*bh+NdH*NdH; D=1.0/(PI*ax*ay*q*q); }
  /* Correlated Smith visibility retains grazing highlights without excess energy. */
  float vis=0.5/max(NdL*sqrt(NdV*NdV*(1.0-a2)+a2)+NdV*sqrt(NdL*NdL*(1.0-a2)+a2),0.0001);
  float visibility=uSunI>0.0&&(NdL>0.0||uSh==1)?studioVisibility(vP,Ng,L):1.0;
  vec3 F=F0+(1.0-F0)*pow(1.0-VdH,5.0);
  vec3 spec=D*vis*F, dif=(1.0-F)*(1.0-metal)*alb/PI;
  float thick=(uHas&128)!=0?mapSample(uThick,uv).r:uShP.w;
  if(uSh==1){ /* RGB diffuse wrap and thickness attenuation; two surface specular lobes. */
    vec3 Ns=normalize(mix(N,Ng,uShP.z)),sss=clamp(uShC,0.02,1.0),wrap=uShP.x*vec3(0.8,0.38,0.18);
    vec3 dl=max((vec3(dot(Ns,L))+wrap)/(1.0+wrap),0.0)/(1.0+wrap);
    dl=mix(vec3(max(dot(Ns,L),0.0)),dl,clamp(uShP.y,0.0,1.0));
    vec3 attenuation=exp(-max(thick,0.0)*uSkin.y/sss);
    float back=max(dot(-Ns,L),0.0);vec3 transmitted=attenuation*sss*back*uSkin.z*uShP.y;
    float sr=clamp(mix(rough,uSkin.x,0.75),0.08,1.0);
    vec3 surface=studioDirect(N,V,L,vec3(0.0),vec3(0.028),sr,0.0);
    surface+=studioDirect(N,V,L,vec3(0.0),vec3(0.04),max(sr*0.38,0.08),0.0)*uShQ.z*0.35;
    col=((1.0-F)*(1.0-metal)*alb/PI*dl+surface)*visibility*uSunI*3.0+transmitted*alb*uSunI*1.5;
  }else col=(dif+spec)*NdL*uSunI*3.0*visibility;
  col*=uLightColor;
  vec3 fillL=normalize(vec3(-0.75,0.45,-0.25)),rimL=normalize(vec3(0.3,0.35,-0.9));
  col+=studioDirect(N,V,fillL,alb,F0,rough,metal)*uStudioFill*2.0+studioDirect(N,V,rimL,alb,F0,rough,metal)*uStudioRim*2.0;
  if(uSh==3){ /* velvet: a soft sheen at grazing angles */ float sr=max(uShP.y,0.05), sn=sqrt(max(1.0-NdH*NdH,0.0)), Dc=(2.0+1.0/sr)*pow(sn,1.0/sr)/(2.0*PI);
    col+=lin(uShC)*uShP.x*Dc*NdL*uSunI*3.0/max(4.0*(NdL+NdV-NdL*NdV),1e-3); }
  /* ---- light from the environment ---- */
  vec3 Nr=N;
  if(uSh==2){ vec3 at=cross(Bs,V), an2=normalize(cross(at,Bs)); Nr=normalize(mix(N,an2,abs(uShP.x)*clamp(1.0-rough*0.5,0.0,1.0))); }
  vec3 R=reflect(-V,Nr); vec2 ab=envBRDF(NdV,rough); vec3 Fr=F0+(max(vec3(1.0-rough),F0)-F0)*pow(1.0-NdV,5.0);
  vec3 single=F0*ab.x+ab.y;
  vec3 compensation=vec3(1.0)+F0*(1.0/max(ab.x+ab.y,0.1)-1.0);
  vec3 envS=envSpec(R,rough)*(uEnvOn==1?single*compensation:Fr),envD=envDif(N)*alb*(1.0-metal)*(1.0-Fr);
  float specAO=clamp(pow(NdV+ao,exp2(-16.0*rough-1.0))-1.0+ao,0.0,1.0);
  if(uSh==1){vec3 Ns=normalize(mix(N,Ng,uShP.z)),sss=clamp(uShC,0.02,1.0),attenuation=exp(-max(thick,0.0)*uSkin.y/sss);
    envD=envDif(Ns)*alb*(1.0-metal)*(1.0-Fr)+envDif(-Ns)*attenuation*sss*alb*uShP.y*uSkin.z*0.25;
    float sr=clamp(mix(rough,uSkin.x,0.75),0.08,1.0);vec2 sab=envBRDF(NdV,sr);
    envS=envSpec(R,sr)*(vec3(0.028)*sab.x+sab.y)+envSpec(R,max(sr*0.38,0.08))*(vec3(0.04)*sab.x+sab.y)*uShQ.z*0.35;}
  if(uSh==3){ envS+=lin(uShC)*uShP.x*envDif(N)*pow(1.0-NdV,max(uShP.z,0.5)*3.0+1.0); }
  if(uSh==6){ int m=int(uShP.x+0.5); vec3 dcol=alb*(1.0-metal), scol=F0;
    if(m==1){ o=vec4(pow(dcol,vec3(1.0/2.2)),1.0); return; } if(m==2){ o=vec4(pow(scol,vec3(1.0/2.2)),1.0); return; } if(m==3){ o=vec4(vec3(1.0-rough),1.0); return; }
    if(m==4){ col=envS*uSkyI*ao; col*=uExpo; col=tone(col); o=vec4(pow(clamp(col,0.0,1.0),vec3(1.0/2.2)),1.0); return; } }
  col+=(envD*ao+envS*specAO)*uSkyI;
  if((uHas&16)!=0) col+=lin(mapSample(uEmis,uv+uPE).rgb)*2.0;
  col*=uExpo; col=tone(col); o=vec4(pow(clamp(col,0.0,1.0),vec3(1.0/2.2)),1.0); }`;
const FS_3DLINE=`uniform vec4 uCol; void main(){ o=uCol; }`;
const VS_UV=`#version 300 es
layout(location=2) in vec2 aT; uniform vec2 uOrigin; uniform vec2 uExtent; uniform vec2 uViewport; uniform vec2 uShift;
void main(){ vec2 p=uOrigin+(aT+uShift)*uExtent; gl_Position=vec4(p.x/uViewport.x*2.0-1.0,1.0-p.y/uViewport.y*2.0,0.0,1.0); }`;
function prog3(vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,FS_HEAD+fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return {p,locs:{},fs,vs};}
const FS_3DSEL=`in vec3 vP; in vec3 vN; in vec2 vT; in vec4 vTan; uniform sampler2D uSel; void main(){ float m=texture(uSel,fract(vT)).r; if(m<0.02) discard; o=vec4(1.0,0.62,0.22,0.32*m); }`;
const P3={mesh:Object.assign(prog3(VS_3D,FS_3D),{decodeOnly:true}),line:prog3(VS_3D,FS_3DLINE),uv:prog3(VS_UV,FS_3DLINE),sel:prog3(VS_3D,FS_3DSEL)};

/* ---- settings (kept in the document) ---- */
const V3D_DEFAULTS={model:'plane',detail:0,unlit:null,uvs:1,disp:0,paintAlign:'wrap',sunAz:40,sunEl:45,sunI:1,skyI:1,expo:1,bg:'dark',clip:true,wire:false,showUV:false,litUV:false,spin:false,fov:40,ortho:false,
  env:'studio',envRot:0,envI:1,envBg:false,envBlur:.35,envSun:0,tone:'filmic',studioFill:.12,studioRim:.08,lightColor:[1,1,1],shadows:true,shadowSoft:1.5,floor:false,floorHeight:0,floorOpacity:.5,floorSoft:2,floorColor:[0,0,0]};
const v3={on:false,mesh:null,gpu:null,tex:{},cam:{yaw:.5,pitch:.25,dist:3.2,tx:0,ty:0,tz:0},dirty:true,postDirty:false,mapsDirty:true,editDirty:true,lastFull:0,fbo:null,imported:null};
function v3s(){if(!doc.v3d)doc.v3d=Object.assign({},V3D_DEFAULTS);else{for(const k in V3D_DEFAULTS)if(!(k in doc.v3d))doc.v3d[k]=V3D_DEFAULTS[k];}return doc.v3d;}
const v3Unlit=()=>{const s=v3s();return s.unlit==null?doc.maps.length<2:s.unlit;};

/* ---- mesh on the GPU ---- */
/* Height depth pushes each point out along one shared direction per position: copies of a point (hard edges, UV
   seams, the six sides of a cube) used to go different ways and tear the model open */
function meshWeldN(m){const n=m.verts,P=new Uint32Array(m.pos.buffer,m.pos.byteOffset,n*3),N=m.nrm,out=new Float32Array(n*3);
  let sz=1;while(sz<n*2)sz<<=1;const tab=new Int32Array(sz).fill(-1),grp=new Int32Array(n),mask=sz-1;
  for(let i=0;i<n;i++){const a=P[i*3],b=P[i*3+1],c=P[i*3+2];let h=(Math.imul(a,73856093)^Math.imul(b,19349663)^Math.imul(c,83492791))&mask;
    for(;;){const j=tab[h];if(j<0){tab[h]=i;grp[i]=i;break;}if(P[j*3]===a&&P[j*3+1]===b&&P[j*3+2]===c){grp[i]=j;break;}h=(h+1)&mask;}
    const g=grp[i];out[g*3]+=N[i*3];out[g*3+1]+=N[i*3+1];out[g*3+2]+=N[i*3+2];}
  for(let i=0;i<n;i++){const g=grp[i];if(g===i){const l=Math.hypot(out[i*3],out[i*3+1],out[i*3+2]);if(l>1e-6){out[i*3]/=l;out[i*3+1]/=l;out[i*3+2]/=l;}else{out[i*3]=N[i*3];out[i*3+1]=N[i*3+1];out[i*3+2]=N[i*3+2];}}}
  for(let i=0;i<n;i++){const g=grp[i];if(g!==i){out[i*3]=out[g*3];out[i*3+1]=out[g*3+1];out[i*3+2]=out[g*3+2];}}
  return out;}
function v3Upload(m){const g=v3.gpu;if(g){gl.deleteVertexArray(g.vao);gl.deleteBuffer(g.vb);gl.deleteBuffer(g.ib);gl.deleteBuffer(g.eb);gl.deleteVertexArray(g.evao);}
  const n=m.verts,d=new Float32Array(n*15),wn=meshWeldN(m);for(let i=0;i<n;i++){d.set(m.pos.subarray(i*3,i*3+3),i*15);d.set(m.nrm.subarray(i*3,i*3+3),i*15+3);d.set(m.uv.subarray(i*2,i*2+2),i*15+6);d.set(m.tan.subarray(i*4,i*4+4),i*15+8);d.set(wn.subarray(i*3,i*3+3),i*15+12);}
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);
  const at=(i,sz,o)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,sz,gl.FLOAT,false,60,o*4);};at(0,3,0);at(1,3,3);at(2,2,6);at(3,4,8);at(4,3,12);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.idx,gl.STATIC_DRAW);
  const edges=meshEdges(m),evao=gl.createVertexArray();gl.bindVertexArray(evao);gl.bindBuffer(gl.ARRAY_BUFFER,vb);at(0,3,0);at(1,3,3);at(2,2,6);at(3,4,8);at(4,3,12);
  const eb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,edges,gl.STATIC_DRAW);
  gl.bindVertexArray(vao);v3.gpu={vao,vb,ib,eb,evao,count:m.idx.length,ecount:edges.length};}
function v3SetMesh(m,keepCam){v3.mesh=m;meshGroupByMat(m);v3Upload(m);gl.bindVertexArray(vao);if(!keepCam)v3Frame();v3.dirty=true;requestRender();refresh3dUI();if(ui.mode==='p3d'&&typeof p3SyncSets==='function'){p3SyncSets();buildP3Panel();}if(v3s().showUV)requestRender();}
function v3LoadModel(keepCam){const s=v3s();if(s.model==='dplane'){s.model='plane';s.detail=Math.max(s.detail||0,5);}
  if(s.model==='imported'&&v3.imported)meshGroupByMat(v3.imported);/* grouped before subdividing, so triangles keep their order */
  const m=s.model==='imported'&&v3.imported?subdivideMesh(v3.imported,s.detail||0):primMesh(PRIMS[s.model]?s.model:'plane',s.detail||0);v3SetMesh(m,keepCam);}

/* ---- maps as textures for the model: the map being painted updates every frame, the rest a few times a second ---- */
const v3Work={copies:0,partialCopies:0,copyPixels:0,mipPixels:0,scenes:0,postPasses:0,postReuses:0};
let P_V3MIP=null;
/* Draw into a separate patch before copying to a mip level: sampling an attached texture would be feedback.
   Power-of-two levels use the same 2x2 average as generateMipmap; odd dimensions keep the driver's path. */
function v3PatchMips(t,r){if(!P_V3MIP)P_V3MIP=program(`uniform sampler2D uSrc; uniform int uLevel; uniform vec2 uOrigin;
void main(){ ivec2 p=(ivec2(gl_FragCoord.xy)+ivec2(uOrigin))*2, sz=textureSize(uSrc,uLevel)-1;
o=(texelFetch(uSrc,min(p,sz),uLevel)+texelFetch(uSrc,min(p+ivec2(1,0),sz),uLevel)+texelFetch(uSrc,min(p+ivec2(0,1),sz),uLevel)+texelFetch(uSrc,min(p+ivec2(1),sz),uLevel))*0.25; }`);
  /* texelFetch at levels above zero is only valid while the sampler exposes mip levels.
     The canvas returns pooled images to LINEAR after drawing; the 3D textures already use mips. */
  gl.bindTexture(gl.TEXTURE_2D,t.tex);const minFilter=gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  let [x,y,w,h]=r,x1=x+w,y1=y+h,W=t.w,H=t.h,level=0,patch=null;
  try{while(W>1||H>1){const nx=Math.floor(x/2),ny=Math.floor(y/2);x1=Math.ceil(x1/2);y1=Math.ceil(y1/2);W=Math.max(1,W>>1);H=Math.max(1,H>>1);w=x1-nx;h=y1-ny;
      if(!patch)patch=makeTarget(w,h,t.depth,false,t.packed,t.mono);
      run(P_V3MIP,{fbo:patch.fbo,w,h,packed:t.packed,mono:t.mono},{uSrc:t.tex,uLevel:{int:level},uOrigin:[nx,ny]});
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,t.fbo);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.tex,++level);
      blit(patch,t,0,0,w,h,nx,ny);v3Work.mipPixels+=w*h;x=nx;y=ny;}}
  finally{gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.tex,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);disposeTarget(patch);
    gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,minFilter);}}
/* Material shading reads one value from roughness, metal, AO, opacity and height. Keep full resolution. */
function v3MapTex(k,src,region){const mono=doc.w*doc.h>=67108864&&MAP_DEFS[k]?.grey,packed=!!src.packed&&!mono;let t=v3.tex[k];if(!t||t.w!==doc.w||t.h!==doc.h||t.depth!==src.depth||!!t.packed!==packed||!!t.mono!==!!mono){if(t)disposeTarget(t);t=v3.tex[k]=makeTarget(doc.w,doc.h,src.depth,true,packed,mono);region=null;}
  const edges=ui.mode==='p3d'&&v3s().uvs===1&&!v3.mesh?.noUV&&src.w===doc.w&&src.h===doc.h?seamBlurMesh():null;
  const partial=region&&t.hasMips&&!(t.w&(t.w-1))&&!(t.h&(t.h-1))&&region[2]*region[3]<t.w*t.h*.25;
  const r=partial?region:[0,0,doc.w,doc.h];if(r[2]<=0||r[3]<=0)return t;
  blit(src,t,r[0],r[1],r[2],r[3],r[0],r[1]);let border=r;
  if(edges){if(partial){const x=Math.max(0,r[0]-8),y=Math.max(0,r[1]-8);border=[x,y,Math.min(doc.w,r[0]+r[2]+8)-x,Math.min(doc.h,r[1]+r[3]+8)-y];}seamBlurPadding(edges,t,partial?border:null);}if(k==='base')t._studioOpaque=studioOpaqueBase();t._studioVer=(t._studioVer||0)+1;v3Work.copies++;v3Work.copyPixels+=r[2]*r[3];
  if(partial){v3Work.partialCopies++;v3PatchMips(t,border);}else{gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.generateMipmap(gl.TEXTURE_2D);t.hasMips=true;let w=t.w,h=t.h;while(w>1||h>1){w=Math.max(1,w>>1);h=Math.max(1,h>>1);v3Work.mipPixels+=w*h;}}
  gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  if(anisoExt)gl.texParameterf(gl.TEXTURE_2D,anisoExt.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(qual('aniso'),anisoMax));return t;}
const anisoExt=gl.getExtension('EXT_texture_filter_anisotropic'),anisoMax=anisoExt?gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT):1;
function v3Needed(){if(v3Unlit())return doc.maps.filter(k=>k==='base'||k==='ao');return doc.maps.filter(k=>k!=='normal'&&k!=='height'&&k!=='curv').concat(doc.maps.includes('height')||doc.maps.includes('normal')||meshNormalBase()?['nfinal']:[]);}
function v3Refresh(){if(!v3.on)return;if(ui.mode==='bake'){bakeV3Refresh();return;}if(ui.mode==='convert'){cvV3Refresh();return;}const now=performance.now(),gap=stroke?({fast:1e9,balanced:Math.max(qual('refresh'),900)}[prefs.paintSpeed]||qual('refresh')):0,full=v3.mapsDirty&&(!stroke||now-v3.lastFull>gap);/* (0.30) Painting speed Fast: the other maps update on the model when the stroke ends */
  const plain=doc.view===doc.map&&compOut&&ui.mode!=='anim';
  const one0=k=>{if(k==='nfinal'){const t=normalComposite(false,null);v3MapTex(k,t);release(t);return;}
    if(k===doc.map&&plain&&!panState){const q=v3.mapRegion;v3MapTex(k,compOut,!full&&q&&q.root===doc.root&&q.tex===v3.tex&&q.map===k?q.r:null);return;}
    if(ui.mode==='anim'&&k==='base'){v3MapTex(k,compOut);return;}
    const t=compositeMap(k);v3MapTex(k,t);release(t);};
  const one=k=>{if(typeof pnBegin==='function')pnBegin(k);try{one0(k);}finally{panState=null;}};
  if(full){withWeldMask(null,()=>{for(const k of v3Needed())one(k);if(v3s().disp&&doc.maps.includes('height')){const t=compositeMap('height');v3MapTex('height',t);release(t);}});
    v3.mapsDirty=false;v3.editDirty=false;v3.lastFull=now;v3.dirty=true;v3SgDerive();}
  else if(v3.editDirty&&(stroke||v3.mapRegion?.finished)&&v3.mapRegion?.weld){const q=v3.mapRegion,r=q.r;
    if(r&&q.root===doc.root&&q.tex===v3.tex&&q.map===doc.map&&r[2]*r[3]<doc.w*doc.h*.25&&!(doc.w&(doc.w-1))&&!(doc.h&(doc.h-1))&&v3Needed().every(k=>v3.tex[k]?.hasMips)){
      withWeldMask(r,()=>{const maskLayer=stroke?.o.weldMask&&stroke.L.maskOf;const keys=new Set(q.keys|| (maskLayer?Object.keys(maskLayer.fill.maps).filter(k=>maskLayer.fill.maps[k].on):[doc.map,...stroke.o.extras.map(e=>e.key)])),needed=v3Needed();
      for(const k of keys){if(!needed.includes(k)&&!(k==='height'&&v3s().disp))continue;
        const t=k===doc.map&&plain?compOut:scissorDo(r,()=>compositeMap(k));v3MapTex(k,t,r);if(t!==compOut)release(t);}
      if(keys.has('height')||keys.has('normal')){const t=normalComposite(false,null,r);v3MapTex('nfinal',t,r);release(t);}});
      v3.editDirty=false;v3.dirty=true;
    }else{v3.mapRegion=null;v3.mapsDirty=true;v3.lastFull=-Infinity;v3Refresh();}}
  else if(v3.editDirty){const k=ui.mode==='anim'?'base':doc.map;if(v3Needed().includes(k))one(k);if(k==='height'&&stroke&&now-v3.lastFull>gap){one('nfinal');}v3.editDirty=false;v3.dirty=true;if(['base','spec','gloss'].includes(k))v3SgDerive();}
  v3.mapRegion=null;if(typeof pnTick==='function')pnTick(one,full);}
/* Specular/Gloss documents shade the model with the equivalent base/metal/rough */
function v3SgDerive(){if(doc.workflow!=='spec'||!v3.tex.base||ui.mode==='anim')return;const T=v3.tex,r=sgAsMR(T.base,doc.maps.includes('spec')?T.spec:null,doc.maps.includes('gloss')?T.gloss:null);
  v3MapTex('sgBase',r.base);v3MapTex('sgMetal',r.metal);v3MapTex('sgRough',r.rough);for(const k in r)release(r[k]);}
/* called by composite(): the document changed */
function v3WeldEnd(s,r){if(!v3.on||!s.o.weldMask||!s.viewportIndependent||!s.cacheSafe||!maskPartOK(s)||prefs.paintSpeed==='fast'||doc.wrap||doc.map!=='base'||doc.workflow==='spec'||doc.view!==doc.map||v3.mapsDirty||v3.editDirty||preview||['anim','bake','convert'].includes(ui.mode)||doc.maps.some(k=>compNeedsAll(doc.root.children,k)))return;
  const x=Math.max(0,r[0]-1),y=Math.max(0,r[1]-1),box=[x,y,Math.min(doc.w,r[0]+r[2]+1)-x,Math.min(doc.h,r[1]+r[3]+1)-y];
  if(box[2]*box[3]>=doc.w*doc.h*.25)return;weldEndPreview={root:doc.root,tex:v3.tex,map:doc.map,r:box,weld:true,finished:true,keys:Object.keys(s.L.maskOf.fill.maps).filter(k=>s.L.maskOf.fill.maps[k].on)};}
function v3Changed(rects){if(!v3.on)return;if(!stroke&&weldEndPreview){const q=weldEndPreview;weldEndPreview=null;if(!v3.mapsDirty&&q.root===doc.root&&q.tex===v3.tex&&q.map===doc.map){v3.mapRegion=q;v3.editDirty=true;return;}}const s=stroke;
  /* Only independent, single-channel strokes can leave the other maps untouched. End-of-stroke, undo,
     masks, normal/height, converters and external edits still invalidate the complete material. */
  if(s&&s.viewportIndependent===undefined)s.viewportIndependent=doc.map!=='base'||!allNodes().some(n=>n.visible&&n.clip);
  const weldMask=s?.o.weldMask&&s.L.maskOf?.mask?.enabled&&maskPartOK(s);
  const weld=(s?.o.material?.weldPaint||weldMask)&&prefs.paintSpeed!=='fast'&&doc.map==='base'&&!doc.wrap&&
    doc.maps.every(k=>!compNeedsAll(doc.root.children,k));
  const safe=s&&s.viewportIndependent&&['brush','erase','dodge','burn'].includes(s.o.tool)&&(!s.L.maskOf||(weldMask&&weld))&&!s.L.quick&&!preview&&(!s.o.extras?.length||weld)&&doc.workflow!=='spec'&&doc.view===doc.map&&
    !['height','normal','curv'].includes(doc.map)&&!['anim','bake','convert'].includes(ui.mode)&&strokeCacheSafe()&&!compNeedsAll(doc.root.children,doc.map);
  if(!safe){v3.mapRegion=null;v3.editDirty=true;v3.mapsDirty=true;return;}
  let r=null;
  if(!doc.wrap){if(!rects&&s.space&&s.space.viewportBounds){const b=s.space.viewportBounds(s);rects=b&&[[b[0],b[1],b[2]-b[0],b[3]-b[1]]];}
    if(rects?.length){let x=doc.w,y=doc.h,x1=0,y1=0;for(const b of rects){x=Math.min(x,b[0]);y=Math.min(y,b[1]);x1=Math.max(x1,b[0]+b[2]);y1=Math.max(y1,b[1]+b[3]);}
      x=clamp(Math.floor(x),0,doc.w);y=clamp(Math.floor(y),0,doc.h);x1=clamp(Math.ceil(x1),x,doc.w);y1=clamp(Math.ceil(y1),y,doc.h);r=[x,y,x1-x,y1-y];}}
  const q=v3.mapRegion,same=q&&q.root===doc.root&&q.tex===v3.tex&&q.map===doc.map;
  if(v3.editDirty&&(!same||!q.r))r=null;else if(same&&q.r&&r){const a=q.r,x=Math.min(a[0],r[0]),y=Math.min(a[1],r[1]);r=[x,y,Math.max(a[0]+a[2],r[0]+r[2])-x,Math.max(a[1]+a[3],r[1]+r[3])-y];}
  v3.mapRegion={root:doc.root,tex:v3.tex,map:doc.map,r,weld:!!weld};v3.editDirty=true;}

/* ---- camera ---- */
const m4=()=>new Float32Array(16);
/* (0.32.1) perspective or orthographic: the orthographic view frames the same size at the model's centre */
/* (0.32.1) view snaps: the camera looks at the model from one side (yaw turns around, pitch goes up and down) */
const V3_VIEWS=[['front','Front'],['back','Back'],['left','Left'],['right','Right'],['top','Top'],['bottom','Bottom']];
function v3SnapView(k){const c=v3.cam,Q=Math.PI/2,P={front:[0,0],back:[Math.PI,0],left:[-Q,0],right:[Q,0],top:[c.yaw,1.5699],bottom:[c.yaw,-1.5699]}[k];if(!P)return;
  c.yaw=P[0];c.pitch=P[1];v3.dirty=true;requestRender();toast(V3_VIEWS.find(v=>v[0]===k)[1]+' view');}
function v3SetOrtho(on){const s=v3s();s.ortho=!!on;const b=document.getElementById('v3Proj');if(b){b.textContent=on?'Orthographic':'Perspective';b.setAttribute('aria-pressed',String(!!on));}v3.dirty=true;requestRender();
  if(on&&v3.rt)toast('Ray traced mode still looks through a perspective camera.');}
window.addEventListener('keydown',e=>{if(!v3.on&&ui.mode!=='p3d')return;if(!v3.hover||isTypingTarget(e.target)||e.altKey||e.metaKey)return;
  const m={Numpad1:['front','back'],Numpad3:['right','left'],Numpad7:['top','bottom']}[e.code];
  if(m){e.preventDefault();v3SnapView(e.ctrlKey?m[1]:m[0]);}else if(e.code==='Numpad5'){e.preventDefault();v3SetOrtho(!v3s().ortho);}});
function m4ortho(hw,hh,n,fa){const o=m4();o[0]=1/hw;o[5]=1/hh;o[10]=-2/(fa-n);o[14]=-(fa+n)/(fa-n);o[15]=1;return o;}
function v3Proj(a,n,fa){const s=v3s();if(s.ortho){const hh=v3.cam.dist*Math.tan(s.fov*Math.PI/360);return m4ortho(hh*a,hh,n,fa);}return m4persp(s.fov*Math.PI/180,a,n,fa);}
function m4persp(f,a,n,fa){const o=m4(),t=1/Math.tan(f/2);o[0]=t/a;o[5]=t;o[10]=(fa+n)/(n-fa);o[11]=-1;o[14]=2*fa*n/(n-fa);return o;}
function m4look(e,c,u){const z=norm3(sub3(e,c)),x=norm3(cross3(u,z)),y=cross3(z,x),o=m4();o[0]=x[0];o[4]=x[1];o[8]=x[2];o[1]=y[0];o[5]=y[1];o[9]=y[2];o[2]=z[0];o[6]=z[1];o[10]=z[2];
  o[12]=-dot3(x,e);o[13]=-dot3(y,e);o[14]=-dot3(z,e);o[15]=1;return o;}
function m4mul(a,b){const o=m4();for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+i]*b[j*4+k];o[j*4+i]=s;}return o;}
const sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm3=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
function v3Eye(){const c=v3.cam,cp=Math.cos(c.pitch);return [c.tx+Math.sin(c.yaw)*cp*c.dist,c.ty+Math.sin(c.pitch)*c.dist,c.tz+Math.cos(c.yaw)*cp*c.dist];}
function v3Frame(){const r=v3.mesh?v3.mesh.radius:1.5,pane=v3.pop?null:$('#pane3d'),asp=pane&&pane.clientHeight?Math.min(1,pane.clientWidth/pane.clientHeight):1,f=2*Math.atan(Math.tan(v3s().fov*Math.PI/360)*asp);Object.assign(v3.cam,{tx:0,ty:0,tz:0,dist:r/Math.sin(f/2)*1.08});
  if(v3s().model==='plane'||v3s().model==='dplane'){v3.cam.yaw=0;v3.cam.pitch=0;}v3.dirty=true;}

/* ---- drawing ---- */
function v3Targets(w,h,lite){let F=v3.fbo;const S=lite?0:Math.min(qual('msaa'),gl.getParameter(gl.MAX_SAMPLES)||0);if(F&&F.w===w&&F.h===h&&F.S===S)return F;
  if(F){if(typeof v3PostFree==='function')v3PostFree(F);gl.deleteFramebuffer(F.ms);gl.deleteRenderbuffer(F.c);gl.deleteRenderbuffer(F.d);gl.deleteFramebuffer(F.rf);gl.deleteRenderbuffer(F.rc);}
  F={w,h,S};
  F.ms=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,F.ms);
  F.c=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,F.c);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,S,gl.RGBA8,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,F.c);
  F.d=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,F.d);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,S,gl.DEPTH_COMPONENT24,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,F.d);
  F.rf=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,F.rf);F.rc=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,F.rc);gl.renderbufferStorage(gl.RENDERBUFFER,gl.RGBA8,w,h);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,F.rc);gl.bindFramebuffer(gl.FRAMEBUFFER,null);v3.fbo=F;v3.dirty=true;return F;}
const BG3={dark:[.09,.1,.115],grey:[.32,.33,.35],light:[.78,.79,.81]};
/* what both the 3D view and the lit UV view need to draw the model (0.40) */
function v3Ctx(){const g=v3.gpu,s=v3s();
  /* 3D Paint's per-set list is made before drawing starts (it may create textures, which binds other framebuffers) */
  const pre=ui.mode==='p3d'&&typeof p3DrawList==='function'?p3DrawList():null;
  /* mask view (Alt+click a mask): the active layer's mask on the model, black and white, unlit */
  const mv=ui.mode!=='bake'&&ui.mode!=='convert'&&typeof maskViewTex==='function'?((typeof idViewTex==='function'&&idViewTex())||maskViewTex()||(typeof p3MeshShowTex==='function'?p3MeshShowTex():null)):null;
  const EU=typeof envUniforms==='function'?envUniforms():{uEnvOn:false};/* before binding: may build the HDRI's levels */
  const bake=(ui.mode==='bake'||ui.mode==='convert')&&v3.btex,sg=!bake&&doc.workflow==='spec'&&v3.tex.sgBase&&ui.mode!=='anim'&&!v3Unlit();
  const T0=bake?v3.btex:sg?Object.assign({},v3.tex,{base:v3.tex.sgBase,metal:v3.tex.sgMetal,rough:v3.tex.sgRough}):v3.tex;
  const a=s.sunAz*Math.PI/180,e=s.sunEl*Math.PI/180;
  const eye=v3Eye();
  return {g,s,pre,mv,EU,bake,sg,T0,a,e,eye};}
function v3List(C){const {g,pre,mv,bake,T0}=C;
  /* one draw per texture set in 3D Paint (each with its own maps), else the whole model with the document's maps */
  let list=!bake&&pre?pre:[{T:T0,start:0,count:g.count/3,sh:bake?null:v3ShadeOf(doc)}];
  if(mv){const R=ui.mode==='p3d'&&typeof p3Range==='function'?p3Range():null;list=list.map(it=>!R||it.start===R.start?{T:{base:mv},start:it.start,count:it.count,unlit:true}:it);}
  if(bake&&typeof bakeHighHidesLow==='function'&&bakeHighHidesLow())list=[];
  return list;}
/* the uniforms for one texture set's draw */
function v3MeshU(C,common,it,flip,safeMip=null){const {s,bake,sg,EU,eye,a,e}=C,T=it.T||{},base=T.base,useSafeMip=!!(safeMip&&!it.thick);
    const ok=k=>T[k]&&(bake||(sg&&(k==='rough'||k==='metal'))||(k==='nfinal'?doc.maps.includes('height')||doc.maps.includes('normal')||!!meshNormalBase():doc.maps.includes(k)));
    if(!bake&&!it.thick&&!it.sh&&doc.meshMaps&&doc.meshMaps.thick)it.thick=doc.meshMaps.thick;
    const hm=(ok('rough')?1:0)|(ok('metal')?2:0)|(ok('nfinal')?4:0)|(ok('ao')?8:0)|(ok('emis')?16:0)|(ok('opac')?64:0)|(it.thick?128:0);
    return Object.assign({},common,{uH:T.height&&s.disp?T.height.tex:dummy,uUseUDIM:!!it.udim,uUDIMTile:it.udim?[it.udim.u,it.udim.v]:[0,0],uUseSafeMip:useSafeMip,uBase:base.tex,uRough:ok('rough')?T.rough.tex:dummy,uMetal:ok('metal')?T.metal.tex:dummy,uNrm:ok('nfinal')?T.nfinal.tex:dummy,uAO:ok('ao')?T.ao.tex:dummy,uEmis:ok('emis')?T.emis.tex:dummy,uOpac:ok('opac')?T.opac.tex:dummy,uThick:useSafeMip?safeMip.tex:it.thick?it.thick.tex:dummy,...EU,...shadeUniforms(bake?null:it.sh||v3ShadeOf(doc)),
      uStudioFill:s.studioFill||0,uStudioRim:s.studioRim||0,uLightColor:s.lightColor||[1,1,1],uShadow:dummy,uShadowVP:{m4:m4()},uShadowOn:0,uShadowSoft:1,...common,uHas:{int:hm},uDef:[mapDefault('rough')[0],mapDefault('metal')[0]],uCam:eye,uSun:[Math.cos(e)*Math.sin(a),Math.sin(e),Math.cos(e)*Math.cos(a)],uSunI:EU.uEnvOn?(s.envSun||0):s.sunI,uSkyI:s.skyI,uExpo:s.expo,uTone:{int:toneInt(s)},uUnlit:it.unlit?true:bake?!!v3.bunlit:v3Unlit(),uFlipY:!!flip,uClip:!it.unlit&&!!s.clip});}
function v3Render(F,flip){const g=v3.gpu;if(!g)return;v3Work.scenes++;F.sceneFlip=!!flip;const C=v3Ctx(),{s,bake}=C,list=v3List(C),SU=studioShadowPrepare(C,list);
  const activeRange=!bake&&ui.mode==='p3d'&&typeof p3Range==='function'?p3Range():null,safeMip=activeRange&&typeof seamMipLimit==='function'?seamMipLimit(activeRange):null;
  gl.bindFramebuffer(gl.FRAMEBUFFER,F.ms);gl.viewport(0,0,F.w,F.h);const bg=BG3[s.bg]||BG3.dark,tr=!!(v3.transparent);gl.clearColor(bg[0],bg[1],bg[2],tr?0:1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  const {mv,T0,eye}=C,V=m4look(eye,[v3.cam.tx,v3.cam.ty,v3.cam.tz],[0,1,0]),Pm=v3Proj(F.w/F.h,.02,100);if(flip)Pm[5]=-Pm[5];const VP=m4mul(Pm,V);
  if(!tr&&!v3.bunlitBg&&typeof envDrawBg==='function')envDrawBg(F,VP,flip);
  const common={...SU,uVP:{m4:VP},uUVs:bake?1:(p3.udim?1:s.uvs),uUseUDIM:false,uUDIMTile:[0,0],uH:T0.height&&s.disp?T0.height.tex:dummy,uDisp:s.disp*.3,uUseH:!!(!bake&&T0.height&&s.disp&&doc.maps.includes('height'))};
  if(s.wire){gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);}gl.bindVertexArray(g.vao);
  for(const it of list){const T=it.T||{},base=T.base||null;if(!base||!it.count)continue;
    const itSafeMip=safeMip&&it.start===activeRange.start&&it.count===activeRange.count?safeMip:null;
    useProg(P3.mesh,v3MeshU(C,common,it,flip,itSafeMip));
    gl.drawElements(gl.TRIANGLES,it.count*3,gl.UNSIGNED_INT,it.start*12);}
  gl.disable(gl.POLYGON_OFFSET_FILL);
  studioFloorDraw(C,VP,F,SU);
  if(!bake&&!mv&&!v3Unlit())v3DrawOutlines(list,common,F,flip);gl.bindVertexArray(g.vao);
  /* the selection, tinted on the model (3D Paint, or while painting on the model) */
  if(!bake&&sel.active&&!sel.quick&&sel.t&&(ui.mode==='p3d'||v3.paintOn)){const R=ui.mode==='p3d'&&typeof p3Range==='function'?p3Range():{start:0,count:g.count/3};
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);useProg(P3.sel,Object.assign({},common,{uSel:sel.t.tex}));gl.bindVertexArray(g.vao);
    gl.drawElements(gl.TRIANGLES,R.count*3,gl.UNSIGNED_INT,R.start*12);gl.depthMask(true);gl.disable(gl.BLEND);}
  if(s.wire){useProg(P3.line,Object.assign({},common,{uCol:[.95,.7,.35,1]}));gl.bindVertexArray(g.evao);gl.drawElements(gl.LINES,g.ecount,gl.UNSIGNED_INT,0);}
  if(bake){bakeDrawHigh(common);bakeDrawCage(common);}
  if(!bake&&(v3.paintOn||ui.mode==='p3d')){drawMir3(VP);drawMir3Cursors(F,common);}
  gl.bindVertexArray(vao);gl.disable(gl.DEPTH_TEST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,F.ms);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,F.rf);gl.blitFramebuffer(0,0,F.w,F.h,0,0,F.w,F.h,gl.COLOR_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(F.px)F.px.valid=false;if(!bake&&typeof v3Post==='function')v3Post(F);v3.postDirty=false;}
/* after the 2D view: refresh maps if needed, redraw the model if anything changed, copy it into the pane */
/* (0.31.1) how big the model is drawn while painting: 1 full, .75, .5 (older setting paintHalf = .5) */
function paintScale(){return prefs.paintScale||(prefs.paintHalf?.5:1);}
function draw3D(){if(!v3.on)return;if(v3.pop){drawPop();return;}const pane=$('#pane3d'),d=dprNow(),w=Math.max(1,Math.round(pane.clientWidth*d)),h=cv.height,x0=$('#work').classList.contains('p3left')?0:cv.width-w;
  if(!v3.mesh)v3LoadModel();v3Refresh();
  /* (0.30.2) Low power painting: while a stroke is going the model is drawn at half size without smoothing, then stretched */
  const ps=paintScale(),lite=!!(stroke&&ps<1&&!v3.rt),W=lite?Math.max(1,Math.round(w*ps)):w,H=lite?Math.max(1,Math.round(h*ps)):h,F=v3Targets(W,H,lite);
  /* Ray traced mode: a sample more each frame until it is clean (the normal view meanwhile while it prepares) */
  const rtr=v3.rt&&!v3Unlit()&&ui.mode!=='bake'&&ui.mode!=='convert'&&typeof rtViewDraw==='function'?rtViewDraw(F):null;
  if(rtr===true)requestRender();else if(rtr===null){if(v3.dirty){v3Render(F);v3.dirty=false;}else if(v3.postDirty){if(!v3Post(F,true))v3Render(F);v3.postDirty=false;}}
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,F.rf);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);gl.blitFramebuffer(0,0,W,H,x0,0,x0+w,h,gl.COLOR_BUFFER_BIT,lite?gl.LINEAR:gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(v3s().spin&&!v3.drag){v3.cam.yaw+=.006;v3.dirty=true;requestRender();}}
/* the model's UV layout over the 2D canvas */
/* (0.40, Kenn) the flat view can show the model lit, as if the mesh were laid out flat: the same shading as the 3D view,
   drawn where each triangle sits in the UV layout */
const VS_FLAT=VS_3D.replace('uniform mat4 uVP;','uniform mat4 uVP; uniform vec2 uOrigin; uniform vec2 uExtent; uniform vec2 uViewport;').replace('gl_Position=uVP*vec4(p,1.0);','vec2 q=uOrigin+aT*uExtent; gl_Position=vec4(q.x/uViewport.x*2.0-1.0,1.0-q.y/uViewport.y*2.0,0.0,1.0);');
let P3FLAT=null;
function v3DrawLitUV(){const C=v3Ctx();if(C.bake||!v3.gpu)return;const list=v3List(C),d=dprNow(),z=view.zoom;if(!P3FLAT)P3FLAT=Object.assign(prog3(VS_FLAT,FS_3D),{decodeOnly:true});
  const common={uVP:{m4:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]},uUVs:1,uH:dummy,uDisp:0,uUseH:false,uOrigin:[view.x*d+stageOx(d),view.y*d],uExtent:[doc.w*z*d,doc.h*z*d],uViewport:[cv.width,cv.height]};
  bindTarget(null);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.bindVertexArray(v3.gpu.vao);
  for(const it of list){if(!it.T||!it.T.base||!it.count)continue;useProg(P3FLAT,Object.assign(v3MeshU(C,common,it,false),{uClip:false}));gl.drawElements(gl.TRIANGLES,it.count*3,gl.UNSIGNED_INT,it.start*12);}
  gl.bindVertexArray(vao);gl.disable(gl.BLEND);}
function drawUVOverlay(){if(!v3.on||!v3.gpu)return;if(v3s().litUV&&ui.mode!=='bake'&&ui.mode!=='convert')v3DrawLitUV();if(!v3s().showUV)return;const d=dprNow(),z=view.zoom;
  bindTarget(null);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.bindVertexArray(v3.gpu.evao);
  const reps=doc.wrap?[-1,0,1]:[0];for(const sx of reps)for(const sy of reps){useProg(P3.uv,{uOrigin:[view.x*d+stageOx(d),view.y*d],uExtent:[doc.w*z*d,doc.h*z*d],uViewport:[cv.width,cv.height],uShift:[sx,sy],uCol:sx||sy?[1,.75,.35,.25]:[1,.75,.35,.8]});
    gl.drawElements(gl.LINES,v3.gpu.ecount,gl.UNSIGNED_INT,0);}
  gl.bindVertexArray(vao);gl.disable(gl.BLEND);}

/* ---- the pane: toolbar, settings, camera controls ---- */
function toggle3D(on){v3.on=on===undefined?!v3.on:!!on;$('#work').classList.toggle('p3left',ui.mode==='p3d');document.body.classList.toggle('m-p3d',ui.mode==='p3d');const pane=$('#pane3d'),sp=$('#split3d'),work=$('#work');
  if(v3.on&&ui.mode==='anim'&&false)return;
  if(!v3.on&&v3.pop)pop3D(false,true);
  pane.hidden=!v3.on||!!v3.pop;sp.hidden=!v3.on||!!v3.pop;const p3k=ui.mode==='p3d'?'gs.pane3dp':'gs.pane3d';let w=320;try{w=+localStorage.getItem(p3k)||0;}catch(e){}if(!w)w=Math.round(work.clientWidth*(ui.mode==='p3d'?.5:.42));
  const full=v3.on&&!v3.pop&&work.classList.contains('v3full');if(full)sp.hidden=true;
  work.style.setProperty('--pane3d',full?'100%':v3.on&&!v3.pop?clamp(w,200,work.clientWidth-200)+'px':'0px');if(work.classList.contains('p3left')){sp.style.right='auto';sp.style.left=v3.on?'calc(var(--pane3d) - 3px)':'';}else{sp.style.left='';sp.style.right=v3.on?'calc(var(--pane3d) - 3px)':'';}
  if(v3.on){if(!v3.pop)build3dPane();v3.mapsDirty=true;v3.editDirty=true;v3.dirty=true;if(!v3.mesh)v3LoadModel();}
  resizeGL();fit();requestRender(true);}
function build3dPane(){const pane=v3.pop?v3.pop.box:$('#pane3d'),s=v3s();pane.replaceChildren();
  const models=el('select',{id:'v3Model','aria-label':'Model',title:s.model==='imported'?'Imported mesh active. Primitive startup models are disabled; use Import to replace the mesh.':'Choose a startup primitive or import a mesh.'},...Object.entries(PRIMS).map(([k,[l]])=>el('option',{value:k,text:l,disabled:s.model==='imported'})),
    ...(v3.imported?[el('option',{value:'imported',text:v3.imported.name})]:[]),el('option',{value:'__import',text:'Import a model (OBJ, glTF, GLB, FBX)…'}));
  models.value=s.model;models.onchange=()=>{if(models.value==='__import'){models.value=s.model;importModel();return;}s.model=models.value;v3LoadModel();};
  /* mesh density: in the toolbar, since height only shows on a dense mesh */
  const detSel=el('select',{id:'v3Det','aria-label':'Mesh detail',title:'Mesh detail: more triangles let Height depth push the surface out finely'},...['Low','×2','×4','×8','×16','×32','×64','×128'].map((l,i)=>el('option',{value:i,text:'Detail '+l})));
  detSel.value=String(s.detail||0);detSel.onchange=()=>{s.detail=+detSel.value;v3LoadModel(true);};v3.detSel=detSel;
  /* (0.32.1) snap the view to front / back / left / right / top / bottom, and perspective or orthographic */
  const viewSel=el('select',{id:'v3ViewSel','aria-label':'Snap the view',title:'Snap the view to a side (Numpad 1 front, 3 right, 7 top; Ctrl for the opposite side)'},el('option',{value:'',text:'View…'}),...V3_VIEWS.map(([k,l])=>el('option',{value:k,text:l})));
  viewSel.onchange=()=>{if(viewSel.value)v3SnapView(viewSel.value);viewSel.value='';};
  const projBtn=el('button',{class:'btn sm',id:'v3Proj',text:s.ortho?'Orthographic':'Perspective',title:'Perspective looks natural; orthographic has no depth shrinking, good for lining things up (Numpad 5)','aria-pressed':String(!!s.ortho),onclick:()=>v3SetOrtho(!v3s().ortho)});
  const tog=(id,label,key,title)=>{const b=el('button',{class:'btn sm'+(s[key]?' on':''),id,text:label,title,'aria-pressed':String(!!s[key])});b.onclick=()=>{s[key]=!s[key];b.classList.toggle('on',s[key]);b.setAttribute('aria-pressed',String(s[key]));v3.dirty=true;requestRender();};return b;};
  const shade=seg([['lit','Lit'],['unlit','Unlit'],['rt','Ray traced']],v3Unlit()?'unlit':v3.rt?'rt':'lit',x=>{s.unlit=x==='unlit';v3.rt=x==='rt';v3.mapsDirty=true;v3.dirty=true;requestRender(true);refresh3dUI();},'Shading');shade.id='v3Shade';
  const gear=el('button',{class:'btn sm',text:'Settings',id:'v3Gear','aria-expanded':'false'});
  const dock=el('button',{class:'btn sm',text:v3.pop?'Dock':'Pop out',id:'v3Pop',title:v3.pop?'Put the 3D view back beside the canvas':'Open the 3D view in its own window (for a second screen)'});dock.onclick=()=>pop3D(!v3.pop);
  const close=el('button',{class:'btn sm',text:'×',title:'Close the 3D view (F3)','aria-label':'Close the 3D view'});close.onclick=()=>{if(ui.mode==='p3d')p3SetLayout('2d');else toggle3D(false);};
  const pbtn=el('button',{class:'btn sm'+(v3.paintOn?' on':''),id:'v3Paint',text:'Paint',title:'Paint on the model with the brush (Alt+drag turns it, right-drag moves it)','aria-pressed':String(v3.paintOn)});
  pbtn.onclick=()=>{v3.paintOn=!v3.paintOn;pbtn.classList.toggle('on',v3.paintOn);pbtn.setAttribute('aria-pressed',String(v3.paintOn));if(v3.paintOn&&!MESH_TOOLS.includes(ui.tool))setTool('brush');refresh3dUI();};
  const inBake=ui.mode==='bake',lowLab=inBake?el('span',{class:'v3lab',text:'Low-poly: '+bkLow().name,title:'Choose the low-poly in the Bake panel'}):null;
  const mb=ui.mode==='p3d'?mir3Bar():null;
  const wireB=tog('v3Wire','Wireframe','wire','Show the mesh edges'),uvB=tog('v3UV','UVs','showUV','Draw the model’s UV layout over your canvas'),spinB=tog('v3Spin','Spin','spin','Spin the model slowly');
  const capB=ui.mode==='bake'||ui.mode==='convert'?[]:[el('button',{class:'btn sm',id:'v3Shot',text:'📷',title:'Screenshot of the 3D view','aria-label':'Screenshot',onclick:()=>dlgScreenshot()}),el('button',{class:'btn sm',id:'v3RenderBtn',text:'Render…',title:'A ray-traced picture, in a window of its own',onclick:()=>dlgRender()}),el('button',{class:'btn sm',id:'v3TT',text:'Turntable…',title:'Record the model turning (video, GIF or PNG frames)',onclick:()=>dlgTurntable()})];
  let bar;
  if(ui.mode==='p3d'){/* 3D Paint (0.37): a slim bar, the rest behind ⋯ */
    const xt=el('div',{class:'v3xtra',id:'v3Xtra',hidden:true},models,detSel,wireB,uvB,spinB,...capB,gear,dock,close),more=el('button',{class:'btn sm',id:'v3More',text:'⋯',title:'More: model, detail, wireframe, spin, screenshot, render, turntable, settings','aria-expanded':'false','aria-label':'More 3D view options'});
    more.onclick=()=>{xt.hidden=!xt.hidden;more.setAttribute('aria-expanded',String(!xt.hidden));more.classList.toggle('on',!xt.hidden);};
    bar=el('div',{class:'v3bar slim'},shade,...(mb?[mb.wrap]:[]),viewSel,projBtn,more,xt);}
  else bar=el('div',{class:'v3bar'},...(inBake?[lowLab]:ui.mode==='convert'?[models,detSel]:[models,detSel,shade]),...(mb?[mb.wrap]:[]),...(ui.mode==='convert'||ui.mode==='p3d'?[]:[pbtn]),viewSel,projBtn,wireB,uvB,spinB,...capB,gear,dock,close);
  const box=el('div',{class:'v3set',hidden:true});
  const S=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:s[key],fmt,...(['disp','sunI','skyI','envIntensity','studioFill','studioRim'].includes(key)?{numericMax:Math.max(max,1)*4}:{}),onInput:v=>{s[key]=v;if(key==='disp'){v3.mapsDirty=true;if(v>0&&(s.detail||0)<4&&!v3.detAuto){v3.detAuto=true;s.detail=4;if(v3.detSel)v3.detSel.value='4';v3LoadModel(true);toast('Mesh detail raised to ×16 so the height can show. Change it with the Detail menu at the top of the 3D view.');}}v3.dirty=true;requestRender(key==='disp');}}).el;
  box.append(el('div',{class:'sub',text:'Lighting'}),envSettingsBox(S),studioSettingsBox(S),el('div',{class:'sub',text:'Model and camera'}),S('v3Uvs','Tile repeat','uvs',1,8,1,v=>v+'×'),S('v3Disp','Height depth','disp',0,1,.01,pct),S('v3Fov','Lens','fov',15,90,1,v=>v+'°'),
    el('div',{class:'sub',text:'Background'}),seg([['dark','Dark'],['grey','Grey'],['light','Light']],s.bg,x=>{s.bg=x;v3.dirty=true;requestRender();},'Background'),
    chk('v3Clip','Cut out transparent areas',!!s.clip,x=>{s.clip=x;v3.dirty=true;requestRender();}),
    ...(ui.mode==='p3d'||ui.mode==='bake'||ui.mode==='convert'?[]:[el('div',{class:'sub',text:'Mirror painting on the model'}),mir3Box(),el('div',{class:'sub',text:'Select on the model'}),sel3Box()]),
    el('div',{class:'sub',text:'Speed on this computer'}),seg([['low','Low'],['medium','Medium'],['high','High'],['ultra','Ultra']],QUALITY[prefs.quality]?prefs.quality:'high',x=>{prefs.quality=x==='high'?undefined:x;qualityChanged();},'Engine quality'),
    el('p',{class:'note',text:'Engine quality: lower is lighter on slower computers.'}),
    seg([['best','Best'],['balanced','Balanced'],['fast','Fast']],PAINT_GAP[prefs.paintSpeed]?prefs.paintSpeed:'best',x=>{prefs.paintSpeed=x==='best'?undefined:x;savePrefs();},'Painting speed'),
    seg([['1','Full size'],['0.75','Three quarters'],['0.5','Half size']],String(paintScale()),x=>{prefs.paintScale=x==='1'?undefined:+x;delete prefs.paintHalf;savePrefs();v3.dirty=true;requestRender();},'Model while painting'),
    el('p',{class:'note',text:'Painting speed: Balanced and Fast redraw the picture less often while you paint. The paint is the same. Also in Preferences.'}),
    el('p',{class:'note',text:'Drag to turn, right-drag to move, wheel to zoom, double-click to reframe. Raise Detail (top of the 3D view) to see Height depth push the surface out finely; imported models are subdivided.'}));
  gear.onclick=()=>{box.hidden=!box.hidden;gear.setAttribute('aria-expanded',String(!box.hidden));/* below the bar, however many rows it wraps onto */if(!box.hidden){box.style.top=(bar.offsetTop+bar.offsetHeight+6)+'px';box.style.maxHeight='calc(100% - '+(bar.offsetTop+bar.offsetHeight+16)+'px)';}};
  const info=el('div',{class:'v3info',id:'v3Info'});v3.infoEl=info;
  const hit=el('div',{class:'v3hit',id:'v3Hit'});
  pane.append(hit,bar,box,...(mb?[mb.pop]:[]),info);refresh3dUI();v3Controls(hit);st3.el=null;requestAnimationFrame(st3Overlay);}
function refresh3dUI(){const i=v3.infoEl;if(!i||!v3.mesh)return;const m=v3.mesh;i.textContent=m.name+' · '+m.tris.toLocaleString()+' triangles'+(m.noUV?' · this model has no UVs, so textures cannot map onto it':v3.paintOn?' · painting: '+v3NavHint()+'; hold Alt over the model to pick its colour':'');}
/* ---- navigation: Substance Painter style (default) or 3D-Coat style (Preferences, or the 3D Paint panel) ----
   Substance: Alt+left turns, Alt+middle moves, Alt+right zooms; middle or right drag also moves; left paints.
   3D-Coat: right-drag turns (Shift+right moves, Ctrl+right zooms), middle moves, left paints on the model and turns off it.
   With painting off, left-drag turns in both. Holding Alt over the model (no button) picks its colour. */
const v3nav={mode:(()=>{try{return localStorage.getItem('gs.nav3d')||'substance';}catch(e){return 'substance';}})()};
function setNav3d(m){v3nav.mode=m;try{localStorage.setItem('gs.nav3d',m);}catch(e){}refresh3dUI();}
const v3CanPaint=()=>v3.paintOn&&MESH_TOOLS.includes(ui.tool)&&!!v3.gpu&&!!v3.mesh&&!v3.mesh.noUV;
function v3NavHint(){return v3nav.mode==='coat'?'right-drag turns, middle moves, Ctrl+right zooms':'Alt+left turns, Alt+middle moves, Alt+right zooms';}
function v3NavOf(hit,e){const b=e.button,paint=v3CanPaint();
  if(st3.sKey&&st3.img)return b===0?'strot':b===2?'stscale':'stmove';
  /* (0.27, Kenn) turn the sky (HDRI) like Substance Painter: Shift+right-drag (3D-Coat navigation: Shift+Alt+right-drag) */
  if(b===2&&e.shiftKey&&(v3nav.mode!=='coat'||e.altKey))return 'sky';
  if(v3nav.mode==='coat'){if(b===2)return e.ctrlKey?'zoom':e.shiftKey?'pan':'turn';if(b===1)return 'pan';if(e.altKey)return 'turn';
    if(paint)return v3PickAt(hit,e)?'paint':'turn';return e.shiftKey?'pan':'turn';}
  if(e.altKey)return b===1?'pan':b===2?'zoom':'turn';
  if(b===1||b===2)return 'pan';if(paint)return 'paint';return e.shiftKey?'pan':'turn';}
function v3Controls(hit){hit.addEventListener('contextmenu',e=>e.preventDefault());
  hit.addEventListener('pointerdown',e=>{if(v3.mstroke&&!stroke)v3.mstroke=null;/* a stroke that never started must not block turning */
    if(v3.mstroke&&v3.mstroke.id!==e.pointerId)meshUp();/* one whose release was missed is finished now */v3.drag=null;
    e.preventDefault();hit.tabIndex=0;hit.focus({preventScroll:true});/* release toolbar/dropdown keyboard focus when returning to the viewport */
    try{hit.setPointerCapture(e.pointerId);}catch(er){}
    /* mask mode: Paint must be on to paint; Box, Lasso and Polygon draw shapes */
    /* the projection gizmo (a material or mask row projected from 3D) */
    if(e.button===0&&!e.altKey&&!st3.sKey&&pgzDown(hit,e))return;
    if(e.button===0&&!e.altKey&&!st3.sKey&&(maskToolsOn()||liveOn())&&mk3Down(hit,e))return;
    let how=v3NavOf(hit,e);
    if(how==='paint'){if(e.button===0&&meshDown(hit,e)&&v3.mstroke)return;how='turn';if(stroke)return;}
    v3.drag={x:e.clientX,y:e.clientY,how,id:e.pointerId,x0:e.clientX,y0:e.clientY,alt:e.altKey&&e.button===0};});
  hit.addEventListener('pointermove',e=>{if(pgz.drag){if(!e.buttons){pgzUp();return;}pgzMove(hit,e);return;}if(!e.buttons&&pgzHover(hit,e)){meshCursor(hit,null);return;}if(mk3Busy()){mk3Move(hit,e);return;}meshCursor(hit,e);
    /* no button held any more: the release went missing (another window, a pen gesture, Alt menu mode); finish instead of sticking */
    if(!e.buttons){if(v3.mstroke)meshUp();if(v3.drag)v3.drag=null;}
    if(v3.mstroke){meshMove(hit,e);return;}const d=v3.drag;
    if(!d){if(e.altKey&&!e.buttons)v3HoverPick(hit,e);return;}
    if(d.how.startsWith('st')){st3Drag(d,e,hit);d.x=e.clientX;d.y=e.clientY;return;}
    const dx=e.clientX-d.x,dy=e.clientY-d.y;d.x=e.clientX;d.y=e.clientY;const c=v3.cam;
    if(d.how==='sky'){envTurnBy(dx*.5);return;}
    if(d.how==='pan'){const k=c.dist*.0018,eye=v3Eye(),f=norm3(sub3([c.tx,c.ty,c.tz],eye)),r=norm3(cross3(f,[0,1,0])),u=cross3(r,f);c.tx+=(-r[0]*dx+u[0]*dy)*k;c.ty+=(-r[1]*dx+u[1]*dy)*k;c.tz+=(-r[2]*dx+u[2]*dy)*k;}
    else if(d.how==='zoom')c.dist=clamp(c.dist*Math.exp((dy-dx)*.006),.2,50);
    else{/* Shift while turning snaps to the nearest side view (front/back/left/right/top/bottom); the free angle keeps going underneath */
      if(d.fy==null){d.fy=c.yaw;d.fp=c.pitch;}d.fy-=dx*.008;d.fp=clamp(d.fp+dy*.008,-1.55,1.55);
      if(e.shiftKey){const Q=Math.PI/2;if(Math.abs(d.fp)>Math.PI/4){c.pitch=d.fp>0?1.5699:-1.5699;c.yaw=Math.round(d.fy/Q)*Q;}else{c.pitch=0;c.yaw=Math.round(d.fy/Q)*Q;}}
      else{c.yaw=d.fy;c.pitch=d.fp;}}v3.dirty=true;requestRender();});
  const up=e=>{if(pgz.drag){pgzUp();return;}if(mk3Busy()&&e.type!=='lostpointercapture'){mk3Up(e);return;}if(v3.drag&&e.pointerId!==undefined&&v3.drag.id!==e.pointerId)return;v3.drag=null;meshUp(e);};
  hit.addEventListener('pointerup',up);hit.addEventListener('pointercancel',up);hit.addEventListener('lostpointercapture',up);hit.addEventListener('pointerleave',()=>{v3.hover=false;meshCursor(hit,null);});hit.addEventListener('pointerenter',()=>{v3.hover=true;});
  hit.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();v3.cam.dist=clamp(v3.cam.dist*Math.exp(e.deltaY*.0012),.2,50);v3.dirty=true;requestRender();},{passive:false});
  for(const t of ['selectstart','dragstart'])hit.parentNode.addEventListener(t,e=>e.preventDefault());
  hit.addEventListener('dblclick',e=>{const s=window.getSelection&&window.getSelection();if(s&&s.rangeCount)s.removeAllRanges();if(maskToolsOn()&&mk3.tool&&mk3.tool!=='paint')return;if(typeof p3SelectAt==='function'&&p3SelectAt(hit,e))return;v3Frame();requestRender();});}
/* a release anywhere (or the window losing focus) ends turning and painting on the model */
window.addEventListener('pointerup',e=>{if(v3.drag&&v3.drag.id===e.pointerId){const d=v3.drag;v3.drag=null;
    /* a mask tool is on: Alt+click on the model (without turning it) clears the mask */
    if(d.alt&&e.button===0&&Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<4&&typeof maskClearAll==='function'&&maskClearAll())return;
    /* the heal brush: Alt+click on the model (without turning it) sets where to copy from */
    if(d.alt&&(ui.tool==='heal'||ui.tool==='clone')&&Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<4){const hit=document.getElementById('v3Hit'),pk=hit&&v3PickAt(hit,e);
      if(pk){if(ui.tool==='heal'&&heal.mode==='spot'){heal.mode='source';healSave();buildBrushPanel();buildOptBar();}healSetSource(pk.uv[0]*doc.w,pk.uv[1]*doc.h,ui.mode==='p3d'?pk.set:null);}}}if(v3.mstroke&&v3.mstroke.id===e.pointerId)meshUp(e);},true);
window.addEventListener('blur',()=>{v3.drag=null;if(v3.mstroke)meshUp();});
/* Alt on its own must not hand the keyboard to the window menu (Windows), which made the model seem locked */
for(const t of ['keydown','keyup'])window.addEventListener(t,e=>{if(e.key==='Alt')e.preventDefault();},true);
/* dragging the divider */
(()=>{const sp=$('#split3d'),work=$('#work');let d=null;
  sp.addEventListener('pointerdown',e=>{sp.setPointerCapture(e.pointerId);d={x:e.clientX,w:$('#pane3d').clientWidth};});
  sp.addEventListener('pointermove',e=>{if(!d)return;const w=clamp(work.classList.contains('p3left')?d.w+(e.clientX-d.x):d.w-(e.clientX-d.x),200,work.clientWidth-200);work.style.setProperty('--pane3d',w+'px');resizeGL();requestRender();});
  sp.addEventListener('pointerup',()=>{if(!d)return;d=null;try{localStorage.setItem(ui.mode==='p3d'?'gs.pane3dp':'gs.pane3d',String($('#pane3d').clientWidth));}catch(e){}});})();

/* ---- importing a model ---- */
async function v3DropModel(files){const f=files.find(x=>isModelName(x.name));if(!f)return;loadStart(f.name);
  try{const m=await parseModelFile(f,files,{udim:ui.mode==='p3d'&&p3.udim});v3.imported=m;v3s().model='imported';if(!v3.on)toggle3D(true);v3SetMesh(m);build3dPane();toast('Loaded “'+m.name+'”: '+m.tris.toLocaleString()+' triangles.'+(m.uvSetName?' · UV '+m.uvSetName:'')+(m.noUV?' It has no UVs, so the textures cannot map onto it.':''));}
  catch(e){console.warn(e);toast('This model could not be loaded: '+(e.message||e));}finally{loadEnd();}}
async function importModel(){const done=m=>{v3.imported=m;v3s().model='imported';v3SetMesh(m);build3dPane();toast('Loaded “'+m.name+'”: '+m.tris.toLocaleString()+' triangles.'+(m.noUV?' It has no UVs, so the textures cannot map onto it.':''));};
  if(platform.isDesktop){try{const p=await platform.openDialog([{name:'3D models',extensions:['obj','glb','gltf','fbx','OBJ','GLB','GLTF','FBX']}]);if(!p)return;loadStart(fileNameOf(p));
      try{const bytes=await platform.readFile(p);const dir=p.replace(/[\\/][^\\/]*$/,''),sep=p.includes('\\')?'\\':'/';
        done(await mwTag(await parseModelBytes(fileNameOf(p),bytes,async u=>{const b=await platform.readFile(dir+sep+u);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);},{udim:ui.mode==='p3d'&&p3.udim}),p));}finally{loadEnd();}}
    catch(e){console.warn(e);toast('This model could not be loaded: '+(e.message||e));}return;}
  const f=el('input',{type:'file',accept:'.obj,.glb,.gltf,.fbx',multiple:true});f.onchange=async()=>{const fs=[...f.files],file=fs.find(x=>isModelName(x.name));if(!file)return;loadStart(file.name);
    try{done(await parseModelFile(file,fs,{udim:ui.mode==='p3d'&&p3.udim}));}catch(e){console.warn(e);toast('This model could not be loaded: '+(e.message||e));}finally{loadEnd();}};f.click();}
/* ---- its own window (second screen): the GPU draws it here and the picture is copied into that window ---- */
function pop3D(out,quiet){if(out){if(v3.pop)return;const w=window.open('about:blank','gouache3d','width=960,height=720');
    if(!w){toast('The window could not be opened.');return;}
    const d=w.document;d.title='Gouache Studio — 3D view';for(const s of document.querySelectorAll('style,link[rel=stylesheet]'))d.head.append(d.importNode(s,true));
    d.body.style.cssText='margin:0;background:#16181c;overflow:hidden;height:100vh';
    const c=d.createElement('canvas');c.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';const box=d.createElement('div');box.style.cssText='position:absolute;inset:0';
    d.body.append(c,box);v3.pop={win:w,cv:c,ctx:c.getContext('2d'),box,busy:false};
    w.addEventListener('resize',()=>{v3.dirty=true;requestRender();});
    w.addEventListener('pagehide',()=>{if(v3.pop&&v3.pop.win===w&&!v3.pop.closing)pop3D(false);});
    build3dPane();toggle3D(true);v3.dirty=true;requestRender(true);if(!quiet)toast('3D view is in its own window. Press Dock there (or close it) to bring it back.');}
  else{const p=v3.pop;if(!p)return;p.closing=true;v3.pop=null;try{p.win.close();}catch(e){}if(v3.on){toggle3D(true);}}}
function drawPop(){const p=v3.pop;if(p.win.closed){pop3D(false);return;}const dpr=p.win.devicePixelRatio||1,w=Math.max(1,Math.round(p.win.innerWidth*dpr)),h=Math.max(1,Math.round(p.win.innerHeight*dpr));
  if(p.cv.width!==w||p.cv.height!==h){p.cv.width=w;p.cv.height=h;v3.dirty=true;}
  if(!v3.mesh)v3LoadModel();v3Refresh();const F=v3Targets(w,h);
  if((v3.dirty||v3.postDirty)&&!p.busy){if(v3.dirty||F.sceneFlip!==true||!v3Post(F,true))v3Render(F,true);v3.dirty=false;v3.postDirty=false;p.busy=true;
    asyncRead(F.rf,0,0,w,h,gl.UNSIGNED_BYTE,Uint8Array,w*h*4,buf=>{p.busy=false;if(v3.pop!==p||p.cv.width!==w||p.cv.height!==h){requestRender();return;}
      p.ctx.putImageData(new ImageData(new Uint8ClampedArray(buf.buffer),w,h),0,0);if(v3.dirty||v3.postDirty)requestRender();});}
  if(v3s().spin&&!v3.drag){v3.cam.yaw+=.006;v3.dirty=true;requestRender();}}

