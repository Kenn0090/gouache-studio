/* ================= Environment lighting (HDRIs) for the 3D view (0.26) =================
   The model is lit by an HDRI (a 360° photo of real light), like Substance Painter and Marmoset: five free
   ones from Poly Haven come with the app (credits in the guide), and you can load your own .hdr or .exr.
   The picture is prepared once on the GPU: copies blurred for rougher and rougher reflections (GGX, a level per
   roughness step) and a very blurred one for the diffuse light. The shader then reads the right copy for each
   pixel's roughness. Settings (kept in the document's 3D settings): which HDRI, turn, brightness, show it as
   the background (with its own blur), an extra sun, and the tone mapping. */
const ENV_LIST=[['studio','Studio','studio_small_09','Sergej Majboroda'],['photo','Photo studio','brown_photostudio_02','Sergej Majboroda'],
  ['sky','Cloudy sky','kloofendal_48d_partly_cloudy_puresky','Greg Zaal, Jarod Guest'],['sunset','Venice sunset','venice_sunset','Greg Zaal'],['evening','Evening sky','industrial_sunset_02_puresky','Jarod Guest, Sergej Majboroda']];
const ENV_LEVELS=6;
const env={key:null,src:null,lv:[],irr:null,loading:null,custom:null,name:''};
const envOf=s=>s.env===undefined?'studio':s.env;
/* ---- reading .hdr (Radiance RGBE, with or without run-length encoding) ---- */
function parseHDR(bytes){const u=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);let p=0;const line=()=>{let s='';while(p<u.length&&u[p]!==10)s+=String.fromCharCode(u[p++]);p++;return s;};
  const head=line();if(!/^#\?(RADIANCE|RGBE)/.test(head))throw new Error('not a Radiance .hdr file');let fmt='';for(;;){const l=line();if(p>=u.length)throw new Error('the .hdr header never ends');if(!l)break;if(l.startsWith('FORMAT='))fmt=l.slice(7);}
  if(fmt&&fmt!=='32-bit_rle_rgbe')throw new Error('only RGBE .hdr files can be read (this one is '+fmt+')');
  const m=/-Y\s+(\d+)\s+\+X\s+(\d+)/.exec(line());if(!m)throw new Error('this .hdr is stored in an unusual orientation');const H=+m[1],W=+m[2],out=new Float32Array(W*H*3),sc=new Uint8Array(W*4);
  for(let y=0;y<H;y++){if(W>=8&&W<32768&&u[p]===2&&u[p+1]===2&&!(u[p+2]&128)&&((u[p+2]<<8)|u[p+3])===W){p+=4;
      for(let c=0;c<4;c++){let x=0;while(x<W){let n=u[p++];if(n>128){n-=128;const v=u[p++];while(n--)sc[(x++)*4+c]=v;}else while(n--)sc[(x++)*4+c]=u[p++];}}}
    else for(let x=0;x<W;x++){sc[x*4]=u[p++];sc[x*4+1]=u[p++];sc[x*4+2]=u[p++];sc[x*4+3]=u[p++];}
    for(let x=0;x<W;x++){const e=sc[x*4+3],o=(y*W+x)*3;if(!e){out[o]=out[o+1]=out[o+2]=0;continue;}const f=Math.pow(2,e-136);out[o]=sc[x*4]*f;out[o+1]=sc[x*4+1]*f;out[o+2]=sc[x*4+2]*f;}}
  return {w:W,h:H,rgb:out};}
/* ---- reading .exr (scanline; no compression, RLE, ZIP or ZIPS; half or float) ---- */
function parseEXR(buf){const dv=new DataView(buf instanceof ArrayBuffer?buf:buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength)),u=new Uint8Array(dv.buffer);if(dv.getUint32(0,true)!==20000630)throw new Error('not an OpenEXR file');
  if(dv.getUint32(4,true)&0x200)throw new Error('tiled EXR files cannot be read yet; save it as scanlines');let p=8;const str=()=>{let s='';while(u[p])s+=String.fromCharCode(u[p++]);p++;return s;};
  const at={};for(;;){const name=str();if(!name)break;const type=str(),size=dv.getUint32(p,true);p+=4;at[name]={type,off:p,size};p+=size;}
  const ch=[];{let q=at.channels.off;const end=q+at.channels.size-1;while(q<end){let s='';while(u[q])s+=String.fromCharCode(u[q++]);q++;ch.push({name:s,type:dv.getInt32(q,true)});q+=16;}}
  const comp=u[at.compression.off],dw=at.dataWindow.off,x0=dv.getInt32(dw,true),y0=dv.getInt32(dw+4,true),x1=dv.getInt32(dw+8,true),y1=dv.getInt32(dw+12,true),W=x1-x0+1,H=y1-y0+1;
  const lines=comp===0||comp===1||comp===2?1:comp===3?16:0;if(!lines)throw new Error('this EXR uses '+(['','','','','PIZ','PXR24','B44','B44A','DWAA','DWAB'][comp]||'an unknown')+' compression; save it with ZIP compression (or as .hdr)');
  const bpp=ch.map(c=>c.type===1?2:4),rowBytes=bpp.reduce((a,b)=>a+b,0)*W,nBlocks=Math.ceil(H/lines),out=new Float32Array(W*H*3);p+=nBlocks*8;
  const idx=n=>ch.findIndex(c=>c.name===n||c.name.endsWith('.'+n)),iR=idx('R'),iG=idx('G'),iB=idx('B'),iY=idx('Y');
  const unpred=d=>{for(let i=1;i<d.length;i++)d[i]=(d[i-1]+d[i]-128)&255;const o=new Uint8Array(d.length),h=(d.length+1)>>1;for(let i=0,a=0,b=h;i<d.length;i++)o[i]=i&1?d[b++]:d[a++];return o;};
  const rle=(d,n)=>{const o=new Uint8Array(n);let i=0,j=0;while(i<d.length&&j<n){const c=(d[i]<<24)>>24;i++;if(c<0){for(let k=0;k<-c;k++)o[j++]=d[i++];}else{const v=d[i++];for(let k=0;k<=c;k++)o[j++]=v;}}return o;};
  for(let b=0;b<nBlocks;b++){const y=dv.getInt32(p,true)-y0,n=dv.getUint32(p+4,true);p+=8;const rowsHere=Math.min(lines,H-y);let d=u.subarray(p,p+n);p+=n;const want=rowBytes*rowsHere;
    if(n<want){if(comp===1)d=unpred(rle(d,want));else{if(typeof pako==='undefined')throw new Error('the ZIP reader has not loaded yet; try again in a moment');d=unpred(pako.inflate(d));}}
    const bdv=new DataView(d.buffer,d.byteOffset,d.byteLength);
    for(let r=0;r<rowsHere;r++){let off=r*rowBytes;const vals=[];for(let c=0;c<ch.length;c++){vals.push(off);off+=bpp[c]*W;}
      const get=(c,x)=>c<0?0:bpp[c]===2?h2f(bdv.getUint16(vals[c]+x*2,true)):ch[c].type===2?bdv.getFloat32(vals[c]+x*4,true):bdv.getUint32(vals[c]+x*4,true);
      for(let x=0;x<W;x++){const o=((y+r)*W+x)*3;if(iR<0&&iY>=0){const v=get(iY,x);out[o]=out[o+1]=out[o+2]=v;}else{out[o]=get(iR,x);out[o+1]=get(iG,x);out[o+2]=get(iB,x);}}}}
  return {w:W,h:H,rgb:out};}
function h2f(h){const s=h&0x8000?-1:1,e=(h>>10)&31,f=h&1023;return e===0?s*f*5.960464477539063e-8:e===31?(f?0:s*65504):s*Math.pow(2,e-15)*(1+f/1024);}
/* ---- on the GPU ---- */
const ENV_GLSL=`const float PI=3.14159265;
vec2 envUV(vec3 d,float rot){ return vec2(atan(d.x,-d.z)/(2.0*PI)+0.5+rot, acos(clamp(d.y,-1.0,1.0))/PI); }
vec3 uvDir(vec2 uv,float rot){ float ph=(uv.x-0.5-rot)*2.0*PI, th=uv.y*PI; return vec3(sin(th)*sin(ph),cos(th),-sin(th)*cos(ph)); }
float rnd2(vec2 c){ return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453); }
vec2 hamm(int i,int n){ uint b=uint(i); b=(b<<16u)|(b>>16u); b=((b&0x55555555u)<<1u)|((b&0xAAAAAAAAu)>>1u); b=((b&0x33333333u)<<2u)|((b&0xCCCCCCCCu)>>2u); b=((b&0x0F0F0F0Fu)<<4u)|((b&0xF0F0F0F0u)>>4u); b=((b&0x00FF00FFu)<<8u)|((b&0xFF00FF00u)>>8u); return vec2(float(i)/float(n),float(b)*2.3283064365386963e-10); }
`;
/* one prefiltered level: GGX lobe of roughness uR around each direction (N = V = R) */
const FS_ENVPRE=ENV_GLSL+`uniform sampler2D uSrc; uniform float uR; uniform int uN; uniform float uSrcW;
void main(){ vec2 uv=gl_FragCoord.xy/vec2(textureSize(uSrc,0).x,textureSize(uSrc,0).y); uv=gl_FragCoord.xy/vec2(float(uOutW),float(uOutH)); vec3 N=uvDir(uv,0.0);
  vec3 up=abs(N.y)<0.999?vec3(0,1,0):vec3(1,0,0), T=normalize(cross(up,N)), B=cross(N,T); float a=uR*uR; vec3 acc=vec3(0.0); float wsum=0.0;
  for(int i=0;i<256;i++){ if(i>=uN) break; vec2 xi=hamm(i,uN); float ph=2.0*PI*xi.x, ct=sqrt((1.0-xi.y)/(1.0+(a*a-1.0)*xi.y)), st=sqrt(1.0-ct*ct);
    vec3 H=normalize(T*(st*cos(ph))+B*(st*sin(ph))+N*ct), L=2.0*dot(N,H)*H-N; float NdL=dot(N,L); if(NdL<=0.0) continue;
    float NdH=max(dot(N,H),0.0), d=(NdH*NdH*(a*a-1.0)+1.0), D=a*a/(PI*d*d), pdf=D/4.0+1e-4, sa=1.0/(float(uN)*pdf), sp=4.0*PI/(uSrcW*uSrcW*0.5), lod=uR<0.01?0.0:max(0.5*log2(sa/sp)+1.0,0.0);
    acc+=textureLod(uSrc,envUV(L,0.0),lod).rgb*NdL; wsum+=NdL; }
  o=vec4(acc/max(wsum,1e-4),1.0); }`;
/* diffuse light: cosine-weighted over the hemisphere */
const FS_ENVIRR=ENV_GLSL+`uniform sampler2D uSrc;
void main(){ vec2 uv=gl_FragCoord.xy/vec2(float(uOutW),float(uOutH)); vec3 N=uvDir(uv,0.0); vec3 up=abs(N.y)<0.999?vec3(0,1,0):vec3(1,0,0), T=normalize(cross(up,N)), B=cross(N,T); vec3 acc=vec3(0.0);
  for(int i=0;i<256;i++){ vec2 xi=hamm(i,256); float ph=2.0*PI*xi.x, r=sqrt(xi.y); vec3 L=T*(r*cos(ph))+B*(r*sin(ph))+N*sqrt(1.0-xi.y); acc+=textureLod(uSrc,envUV(L,0.0),5.0).rgb; }
  o=vec4(acc/256.0,1.0); }`;
let P_ENV=null;
function envProgs(){if(!P_ENV){const U='uniform int uOutW; uniform int uOutH;\n';P_ENV={pre:program(U+FS_ENVPRE),irr:program(U+FS_ENVIRR)};}return P_ENV;}
function envTex(w,h,data){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,canFloat?gl.RGBA16F:gl.RGBA8,w,h,0,gl.RGBA,canFloat?gl.FLOAT:gl.UNSIGNED_BYTE,data||null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return t;}
function envTarget(w,h){const tex=envTex(w,h),fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {tex,fbo,w,h,depth:16};}
function envFree(){const del=t=>{if(!t)return;gl.deleteTexture(t.tex||t);if(t.fbo)gl.deleteFramebuffer(t.fbo);};if(env.src)gl.deleteTexture(env.src.tex);env.src=null;for(const t of env.lv)del(t);env.lv=[];del(env.irr);env.irr=null;env.key=null;}
/* the picture → source texture (with mips), the blurred levels and the diffuse copy */
function envBuild(img,key,name){envFree();let {w,h,rgb}=img;
  /* very large pictures are scaled down to 2048 wide: plenty for lighting, and far less memory */
  if(w>2048){const k=Math.ceil(w/2048),W=Math.floor(w/k),H=Math.floor(h/k),o=new Float32Array(W*H*3);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let r=0,g=0,b=0;for(let j=0;j<k;j++)for(let i=0;i<k;i++){const q=((y*k+j)*w+x*k+i)*3;r+=rgb[q];g+=rgb[q+1];b+=rgb[q+2];}const q=(y*W+x)*3,n=k*k;o[q]=r/n;o[q+1]=g/n;o[q+2]=b/n;}w=W;h=H;rgb=o;}
  const px=new Float32Array(w*h*4);for(let i=0;i<w*h;i++){px[i*4]=Math.min(rgb[i*3],6e4);px[i*4+1]=Math.min(rgb[i*3+1],6e4);px[i*4+2]=Math.min(rgb[i*3+2],6e4);px[i*4+3]=1;}
  let data=px;if(!canFloat){data=new Uint8Array(w*h*4);for(let i=0;i<px.length;i++)data[i]=Math.min(255,Math.pow(px[i]/(1+px[i]),1/2.2)*255);}
  const src=envTex(w,h,data);gl.bindTexture(gl.TEXTURE_2D,src);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  env.src={tex:src,w,h};const PR=envProgs();let lw=Math.min(512,w);
  for(let i=0;i<ENV_LEVELS;i++){const W=Math.max(16,lw>>i),H=Math.max(8,W>>1),t=envTarget(W,H);run(PR.pre,t,{uSrc:src,uR:i/(ENV_LEVELS-1),uN:{int:i===0?1:i<2?64:128},uSrcW:w,uOutW:{int:W},uOutH:{int:H}});env.lv.push(t);}
  const irr=envTarget(64,32);run(PR.irr,irr,{uSrc:src,uOutW:{int:64},uOutH:{int:32}});env.irr=irr;env.key=key;env.name=name;v3.dirty=true;requestRender();}
/* the bundled ones: inside the page (web version) or beside it (desktop) */
async function envBundled(file){const tag=document.getElementById('hdri_'+file);if(tag){const b=atob(tag.textContent.trim()),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
  const r=await fetch('hdri/'+file+'_1k.hdr');if(!r.ok)throw new Error('missing');return new Uint8Array(await r.arrayBuffer());}
/* make sure the chosen environment is ready (called when drawing; loads in the background) */
function envEnsure(){const s=v3s(),k=envOf(s);if(k==='none'){return null;}if(env.key===k)return env;if(env.loading===k)return null;
  if(k==='custom'){if(env.custom){env.loading=k;try{envBuild(env.custom.img,'custom',env.custom.name);}finally{env.loading=null;}return env;}s.env='studio';return null;}
  const it=ENV_LIST.find(e=>e[0]===k);if(!it){s.env='studio';return null;}env.loading=k;
  envBundled(it[2]).then(u=>{if(envOf(v3s())===k)envBuild(parseHDR(u),k,it[1]);}).catch(e=>{console.warn('hdri',e);toast('The HDRI “'+it[1]+'” could not be loaded.');}).finally(()=>{env.loading=null;v3.dirty=true;requestRender();});
  return null;}
async function envLoadFile(){const fs=await pickFiles('.hdr,.exr',false,'HDR images',['hdr','exr']);const f=fs&&fs[0];if(!f)return;
  try{const buf=await f.arrayBuffer(),img=/\.exr$/i.test(f.name)?parseEXR(buf):parseHDR(new Uint8Array(buf));env.custom={img,name:baseName(f.name)};v3s().env='custom';env.key=null;envEnsure();
    toast('Lighting with “'+baseName(f.name)+'”.');if(typeof build3dPane==='function'&&v3.on)build3dPane();}
  catch(e){toast('Could not read '+f.name+': '+(e.message||e));}}
/* the uniforms the model's shader needs */
function envUniforms(){const s=v3s(),E=envEnsure(),on=!!(E&&E.src&&E.lv.length===ENV_LEVELS),U={uEnvOn:on,uEnvRot:(s.envRot||0)/360,uEnvI:s.envI==null?1:s.envI};
  for(let i=0;i<ENV_LEVELS;i++)U['uEnv'+i]=on?E.lv[i].tex:dummy;U.uEnvSrc=on?E.src.tex:dummy;U.uIrr=on?E.irr.tex:dummy;return U;}
/* the background: the HDRI behind the model (optional), blurred as you like */
const FS_ENVBG=ENV_GLSL+`uniform mat4 uInvVP; uniform vec2 uSize; uniform sampler2D uEnvSrc; uniform sampler2D uL0; uniform sampler2D uL1; uniform sampler2D uL2; uniform float uBlur; uniform float uRot; uniform float uI; uniform float uExpo; uniform int uTone; uniform int uFlip;
vec3 tone(vec3 c){ if(uTone==1){ c*=0.6; return clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14),0.0,1.0); } return c/(1.0+c*0.12); }
void main(){ vec2 ndc=gl_FragCoord.xy/uSize*2.0-1.0; if(uFlip==1) ndc.y=-ndc.y; vec4 a=uInvVP*vec4(ndc,-1.0,1.0),b=uInvVP*vec4(ndc,1.0,1.0); vec3 d=normalize(b.xyz/b.w-a.xyz/a.w); vec2 uv=envUV(d,uRot);
  float t=uBlur*3.0; vec3 c=t<1.0?mix(textureLod(uEnvSrc,uv,0.0).rgb,texture(uL0,uv).rgb,t):t<2.0?mix(texture(uL0,uv).rgb,texture(uL1,uv).rgb,t-1.0):mix(texture(uL1,uv).rgb,texture(uL2,uv).rgb,t-2.0);
  c=tone(c*uI*uExpo); o=vec4(pow(clamp(c,0.0,1.0),vec3(1.0/2.2)),1.0); }`;
let P_ENVBG=null;
function envDrawBg(F,VP,flip){const s=v3s(),E=env;if(!s.envBg||!E||!E.src||E.lv.length<3||envOf(s)==='none'||envOf(s)!==E.key)return false;if(!P_ENVBG)P_ENVBG=program(FS_ENVBG);
  gl.disable(gl.DEPTH_TEST);useProg(P_ENVBG,{uInvVP:{m4:m4inv(VP)},uSize:[F.w,F.h],uEnvSrc:E.src.tex,uL0:E.lv[0].tex,uL1:E.lv[1].tex,uL2:E.lv[2].tex,uBlur:s.envBlur==null?.35:s.envBlur,uRot:(s.envRot||0)/360,uI:s.envI==null?1:s.envI,uExpo:s.expo,uTone:{int:s.tone==='neutral'?0:1},uFlip:!!flip});
  gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.enable(gl.DEPTH_TEST);return true;}
function m4inv(m){const inv=new Float32Array(16),a=m;
  inv[0]=a[5]*a[10]*a[15]-a[5]*a[11]*a[14]-a[9]*a[6]*a[15]+a[9]*a[7]*a[14]+a[13]*a[6]*a[11]-a[13]*a[7]*a[10];inv[4]=-a[4]*a[10]*a[15]+a[4]*a[11]*a[14]+a[8]*a[6]*a[15]-a[8]*a[7]*a[14]-a[12]*a[6]*a[11]+a[12]*a[7]*a[10];
  inv[8]=a[4]*a[9]*a[15]-a[4]*a[11]*a[13]-a[8]*a[5]*a[15]+a[8]*a[7]*a[13]+a[12]*a[5]*a[11]-a[12]*a[7]*a[9];inv[12]=-a[4]*a[9]*a[14]+a[4]*a[10]*a[13]+a[8]*a[5]*a[14]-a[8]*a[6]*a[13]-a[12]*a[5]*a[10]+a[12]*a[6]*a[9];
  inv[1]=-a[1]*a[10]*a[15]+a[1]*a[11]*a[14]+a[9]*a[2]*a[15]-a[9]*a[3]*a[14]-a[13]*a[2]*a[11]+a[13]*a[3]*a[10];inv[5]=a[0]*a[10]*a[15]-a[0]*a[11]*a[14]-a[8]*a[2]*a[15]+a[8]*a[3]*a[14]+a[12]*a[2]*a[11]-a[12]*a[3]*a[10];
  inv[9]=-a[0]*a[9]*a[15]+a[0]*a[11]*a[13]+a[8]*a[1]*a[15]-a[8]*a[3]*a[13]-a[12]*a[1]*a[11]+a[12]*a[3]*a[9];inv[13]=a[0]*a[9]*a[14]-a[0]*a[10]*a[13]-a[8]*a[1]*a[14]+a[8]*a[2]*a[13]+a[12]*a[1]*a[10]-a[12]*a[2]*a[9];
  inv[2]=a[1]*a[6]*a[15]-a[1]*a[7]*a[14]-a[5]*a[2]*a[15]+a[5]*a[3]*a[14]+a[13]*a[2]*a[7]-a[13]*a[3]*a[6];inv[6]=-a[0]*a[6]*a[15]+a[0]*a[7]*a[14]+a[4]*a[2]*a[15]-a[4]*a[3]*a[14]-a[12]*a[2]*a[7]+a[12]*a[3]*a[6];
  inv[10]=a[0]*a[5]*a[15]-a[0]*a[7]*a[13]-a[4]*a[1]*a[15]+a[4]*a[3]*a[13]+a[12]*a[1]*a[7]-a[12]*a[3]*a[5];inv[14]=-a[0]*a[5]*a[14]+a[0]*a[6]*a[13]+a[4]*a[1]*a[14]-a[4]*a[2]*a[13]-a[12]*a[1]*a[6]+a[12]*a[2]*a[5];
  inv[3]=-a[1]*a[6]*a[11]+a[1]*a[7]*a[10]+a[5]*a[2]*a[11]-a[5]*a[3]*a[10]-a[9]*a[2]*a[7]+a[9]*a[3]*a[6];inv[7]=a[0]*a[6]*a[11]-a[0]*a[7]*a[10]-a[4]*a[2]*a[11]+a[4]*a[3]*a[10]+a[8]*a[2]*a[7]-a[8]*a[3]*a[6];
  inv[11]=-a[0]*a[5]*a[11]+a[0]*a[7]*a[9]+a[4]*a[1]*a[11]-a[4]*a[3]*a[9]-a[8]*a[1]*a[7]+a[8]*a[3]*a[5];inv[15]=a[0]*a[5]*a[10]-a[0]*a[6]*a[9]-a[4]*a[1]*a[10]+a[4]*a[2]*a[9]+a[8]*a[1]*a[6]-a[8]*a[2]*a[5];
  let det=a[0]*inv[0]+a[1]*inv[4]+a[2]*inv[8]+a[3]*inv[12];det=det?1/det:0;for(let i=0;i<16;i++)inv[i]*=det;return inv;}
/* turning the sky from the 3D view (Shift+right-drag): the HDRI, or the sun of the simple sky; sliders showing it follow */
function envTurnBy(deg){const s=v3s(),k=envOf(s)==='none'?'sunAz':'envRot';s[k]=(((s[k]||0)+deg)%360+360)%360;
  for(const i of document.querySelectorAll('input[type=range][id$="'+(k==='envRot'?'EnvRot':'Az')+'"]')){i.value=s[k];const o=i.parentNode&&i.parentNode.querySelector('output');if(o)o.textContent=Math.round(s[k])+'°';}
  v3.dirty=true;requestRender();}
/* the Lighting part of the 3D view's Settings; also the Environment part of the Shader panel (pre: id prefix) */
function envSettingsBox(S,pre){pre=pre||'v3';if(pre!=='v3'){const S0=S;S=(id,...r)=>S0(id.replace(/^v3/,pre),...r);}const s=v3s(),k=envOf(s),box=el('div',{class:'dlg-grid',id:pre==='v3'?'envBox':pre+'EnvBox'}),redo=()=>{const n=envSettingsBox(S,pre);box.replaceWith(n);v3.dirty=true;requestRender();if(typeof renderEnvs==='function')renderEnvs();};
  const sel=el('select',{id:pre+'Env','aria-label':'Environment'},...ENV_LIST.map(([id,l])=>el('option',{value:id,text:l})),...(env.custom?[el('option',{value:'custom',text:env.custom.name})]:[]),el('option',{value:'none',text:'Simple sky (no HDRI)'}),el('option',{value:'__load',text:'Load your own .hdr or .exr…'}));
  sel.value=k;sel.onchange=()=>{if(sel.value==='__load'){sel.value=k;envLoadFile().then(redo);return;}s.env=sel.value;envEnsure();redo();};
  const deg=v=>Math.round(v)+'°';
  box.append(sel);
  if(k==='none')box.append(S('v3Az','Sun angle','sunAz',0,360,1,deg),S('v3El','Sun height','sunEl',0,90,1,deg),S('v3Si','Sun strength','sunI',0,3,.05,pct),S('v3Ki','Sky strength','skyI',0,3,.05,pct));
  else box.append(S('v3EnvRot','Turn','envRot',0,360,1,deg),S('v3EnvI','Brightness','envI',0,4,.05,pct),
    chk(pre+'EnvBg','Show it as the background',!!s.envBg,v=>{s.envBg=v;redo();}),...(s.envBg?[S('v3EnvBlur','Background blur','envBlur',0,1,.01,pct)]:[]),
    S('v3EnvSun','Extra sun','envSun',0,3,.05,v=>v?pct(v):'off'),...(s.envSun?[S('v3Az','Sun angle','sunAz',0,360,1,deg),S('v3El','Sun height','sunEl',0,90,1,deg)]:[]));
  box.append(S('v3Ex','Exposure','expo',.2,3,.05,pct),seg([['filmic','Filmic'],['neutral','Neutral']],s.tone==='neutral'?'neutral':'filmic',v=>{s.tone=v;v3.dirty=true;requestRender();},'Tone mapping'));
  if(k!=='none'&&k!=='custom'){const it=ENV_LIST.find(e=>e[0]===k);if(it)box.append(el('p',{class:'note',text:'“'+it[1]+'” by '+it[3]+', from Poly Haven (CC0).'}));}
  box.append(el('div',{class:'chips resetrow'},el('button',{class:'btn sm',id:pre+'EnvReset',text:'Reset lighting',title:'Back to the starting environment, sun and exposure',onclick:()=>{for(const q of ['env','envRot','envI','envBg','envBlur','envSun','sunAz','sunEl','sunI','skyI','expo','tone'])s[q]=V3D_DEFAULTS[q];if(typeof envEnsure==='function')envEnsure();redo();}})));
  return box;}
