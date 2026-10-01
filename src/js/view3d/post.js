/* ================= Post processing for the 3D view (0.40) =================
   Effects laid over the finished picture of the model: Bloom, Ambient occlusion, Depth of field, Sharpen, Colour
   grade (exposure, contrast, saturation, warmth), Vignette, Chromatic aberration and Film grain. Each has a switch
   and its own sliders in the Shader panel. They sit in the viewer settings (v3s().post), so the screenshot, the
   render window and the turntable get them too. Depth of field and occlusion read the model's depth. */
const POST_DEF={bloom:{on:false,amt:.6,thr:.7,rad:.5},ao:{on:false,amt:.8,rad:.15,soft:.5},dof:{on:false,amt:.5,focus:0},sharp:{on:false,amt:.6},
  grade:{on:false,exp:0,con:0,sat:0,warm:0},vig:{on:false,amt:.5,soft:.5},ca:{on:false,amt:.4},grain:{on:false,amt:.3,size:1.4,col:.25,animated:false,speed:24},look:{on:false,mode:1,amt:1,lv:5}};
const POST_NAMES=[['bloom','Bloom','Bright parts glow'],['ao','Ambient occlusion','Darkens creases and where things meet'],['dof','Depth of field','Blurs what is nearer or farther than the focus'],
  ['sharp','Sharpen','Crisper fine detail'],['grade','Colour grade','Exposure, contrast, saturation and warmth'],['vig','Vignette','Darker corners'],
  ['ca','Chromatic aberration','Colour fringes towards the edges, like a cheap lens'],['look','Filter look','Live screen filters: greyscale, sepia, invert, black and white, duotone, posterize, night vision, thermal, scanlines, blueprint'],['grain','Film grain','Fine film-style grain: strongest in the mid-tones, with its own size and a touch of colour']];
const POST_LOOKS=[[1,'Greyscale'],[2,'Sepia'],[3,'Invert'],[4,'Black and white'],[5,'Duotone'],[6,'Posterize'],[7,'Night vision'],[8,'Thermal'],[9,'CRT scanlines'],[10,'Blueprint']];
function postOf(s){s=s||v3s();const p=s.post||{},o={};for(const k in POST_DEF)o[k]=Object.assign({},POST_DEF[k],p[k]||{});return o;}
function postActive(s){if(ui.mode==='bake'||ui.mode==='convert')return false;const p=postOf(s);for(const k in p)if(p[k].on)return true;return false;}
const FS_POSTTH=`in vec2 vUV; uniform sampler2D uSrc; uniform float uT;
void main(){ vec3 c=texture(uSrc,vUV).rgb; float l=max(max(c.r,c.g),c.b); float k=max(l-uT,0.0)/max(l,1e-3); o=vec4(c*k,1.0); }`;
const FS_POSTBL=`in vec2 vUV; uniform sampler2D uSrc; uniform vec2 uDir;
void main(){ vec3 s=texture(uSrc,vUV).rgb*0.227027; s+=(texture(uSrc,vUV+uDir*1.3846).rgb+texture(uSrc,vUV-uDir*1.3846).rgb)*0.316216; s+=(texture(uSrc,vUV+uDir*3.2308).rgb+texture(uSrc,vUV-uDir*3.2308).rgb)*0.070270; o=vec4(s,1.0); }`;
const FS_POSTC=`in vec2 vUV; uniform sampler2D uSrc; uniform sampler2D uBloom; uniform sampler2D uDepth; uniform sampler2D uAO;
uniform vec2 uPx; uniform float uAsp; uniform float uOrtho; uniform float uTan; uniform float uOH;
uniform vec4 uA; uniform vec4 uD; uniform vec4 uB; uniform vec4 uG; uniform vec4 uV; uniform vec4 uS; uniform vec4 uL;
float lin(vec2 uv){ float d=texture(uDepth,uv).r; if(d>=0.99999) return 1e4; return uOrtho>0.5 ? 0.02+d*99.98 : 2.0*0.02*100.0/(100.02-(2.0*d-1.0)*99.98); }
float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 uv=vUV; vec4 s0=texture(uSrc,uv); vec3 c=s0.rgb;
  if(uV.w>0.0){ vec2 d=(uv-0.5)*uV.w*0.03; c=vec3(texture(uSrc,uv+d).r,c.g,texture(uSrc,uv-d).b); }
  if(uD.x>0.5){ float z=lin(uv), foc=uD.z; float coc=min(abs(z-foc)/max(foc,0.001),1.0)*uD.y; float r=coc*14.0;
    if(r>0.5){ vec3 acc=c; float w=1.0;
      for(int i=0;i<24;i++){ float a=float(i)*2.39996; float rr=sqrt((float(i)+0.5)/24.0); vec2 off=vec2(cos(a),sin(a))*rr*r*uPx; float zs=lin(uv+off);
        float cs=min(abs(zs-foc)/max(foc,0.001),1.0)*uD.y*14.0; float wt=smoothstep(0.0,1.0,cs/max(rr*r,0.5)); acc+=texture(uSrc,uv+off).rgb*wt; w+=wt; }
      c=acc/w; } }
  if(uA.x>0.5){ float ao=mix(1.0,texture(uAO,uv).r,uA.y); vec3 al=clamp(c,0.0,1.0)*0.5; vec3 aa=2.0404*al-0.3324, bb=-4.7951*al+0.6417, cc=2.7552*al+0.6903; c*=max(vec3(ao),((ao*aa+bb)*ao+cc)*ao); }
  if(uS.x>0.0){ vec3 av=(texture(uSrc,uv+vec2(uPx.x,0.0)).rgb+texture(uSrc,uv-vec2(uPx.x,0.0)).rgb+texture(uSrc,uv+vec2(0.0,uPx.y)).rgb+texture(uSrc,uv-vec2(0.0,uPx.y)).rgb)*0.25; c+=(c-av)*uS.x*2.0; }
  if(uB.x>0.5) c+=texture(uBloom,uv).rgb*uB.y*1.5;
  if(uS.z>0.5){ c*=exp2(uG.x); c=(c-0.5)*(1.0+uG.y)+0.5; float l=dot(c,vec3(0.2126,0.7152,0.0722)); c=mix(vec3(l),c,1.0+uG.z); c.r*=1.0+uG.w*0.15; c.b*=1.0-uG.w*0.15; }
  if(uV.x>0.0){ float d=length((uv-0.5)*vec2(uAsp,1.0)); c*=1.0-uV.x*smoothstep(0.3,0.3+0.15+uV.y*0.9,d); }
  if(uV.z>0.0){ vec2 gp=floor(gl_FragCoord.xy/max(uS.w,0.5)); float m=h12(gp+uS.y)+h12(gp+uS.y+19.7)-1.0; vec3 n=vec3(h12(gp+uS.y+41.3)+h12(gp+uS.y+57.1)-1.0,h12(gp+uS.y+73.9)+h12(gp+uS.y+88.3)-1.0,h12(gp+uS.y+101.7)+h12(gp+uS.y+127.9)-1.0);
    float l=dot(c,vec3(0.2126,0.7152,0.0722)); float w=0.3+0.7*clamp(4.0*l*(1.0-l),0.0,1.0); c+=mix(vec3(m),n,uB.z)*uV.z*0.3*w; }
  if(uL.x>0.5){ c=clamp(c,0.0,1.0); float l=dot(c,vec3(0.2126,0.7152,0.0722)); vec3 r=c; int m=int(uL.x+0.5);
    if(m==1) r=vec3(l);
    else if(m==2) r=vec3(l)*vec3(1.07,0.86,0.62)+vec3(0.02,0.0,-0.02);
    else if(m==3) r=1.0-c;
    else if(m==4) r=vec3(step(0.5,l));
    else if(m==5) r=mix(vec3(0.05,0.08,0.3),vec3(1.0,0.75,0.35),l);
    else if(m==6){ float n=max(uL.z,2.0); r=floor(c*n+0.5)/n; }
    else if(m==7){ float g=clamp(l*1.6,0.0,1.0)*(0.85+0.15*h12(gl_FragCoord.xy+uS.y)); r=vec3(0.05,1.0,0.25)*g; }
    else if(m==8){ r=clamp(vec3(1.5*l-0.5,1.5-abs(3.0*l-1.5),1.5*(1.0-l)-0.25),0.0,1.0); }
    else if(m==9){ float sl=0.75+0.25*sin(gl_FragCoord.y*3.14159); r=c*sl; r=mix(r,r*vec3(1.05,1.0,0.95),0.5); }
    else if(m==10){ r=mix(vec3(0.05,0.2,0.55),vec3(0.85,0.93,1.0),l); }
    c=mix(c,r,uL.y); }
  o=vec4(clamp(c,0.0,1.0),s0.a); }`;
/* ambient occlusion: a normal-aware screen-space pass into its own picture, then a blur that stops at edges */
const FS_POSTAO=`in vec2 vUV; uniform sampler2D uDepth; uniform vec2 uPx; uniform float uAsp; uniform float uOrtho; uniform float uTan; uniform float uOH; uniform float uR;
float lin(vec2 uv){ float d=texture(uDepth,uv).r; if(d>=0.99999) return 1e4; return uOrtho>0.5 ? 0.02+d*99.98 : 2.0*0.02*100.0/(100.02-(2.0*d-1.0)*99.98); }
vec3 pos(vec2 uv,float z){ vec2 q=(uv-0.5)*vec2(uAsp,1.0); return uOrtho>0.5 ? vec3(q*uOH,z) : vec3(q*uTan*z,z); }
void main(){ vec2 uv=vUV; float z=lin(uv); if(z>=1000.0){ o=vec4(1.0); return; } vec3 P=pos(uv,z);
  vec2 dx=vec2(uPx.x,0.0), dy=vec2(0.0,uPx.y); float zl=lin(uv-dx), zr=lin(uv+dx), zd=lin(uv-dy), zu=lin(uv+dy);
  vec3 ex=abs(zr-z)<abs(z-zl) ? pos(uv+dx,zr)-P : P-pos(uv-dx,zl); vec3 ey=abs(zu-z)<abs(z-zd) ? pos(uv+dy,zu)-P : P-pos(uv-dy,zd);
  vec3 N=normalize(cross(ex,ey)); if(dot(N,-P)<0.0) N=-N;
  float ry=uOrtho>0.5 ? uR/uOH : uR/(z*uTan); float ign=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715)))); float occ=0.0;
  for(int i=0;i<20;i++){ float a=(float(i)+ign)*2.39996; float rr=sqrt((float(i)+0.5)/20.0); vec2 off=vec2(cos(a)/uAsp,sin(a))*rr*ry; float zs=lin(uv+off); if(zs>=1000.0) continue;
    vec3 V=pos(uv+off,zs)-P; float dist=length(V); if(dist<1e-5) continue; float w=clamp(1.0-dist/uR,0.0,1.0); occ+=max(dot(N,V/dist)-0.12,0.0)*w*w*(3.0-2.0*w); }
  float ao=1.0-clamp(occ/20.0*4.0,0.0,1.0); o=vec4(vec3(ao),1.0); }`;
const FS_POSTAOB=`in vec2 vUV; uniform sampler2D uSrc; uniform sampler2D uDepth; uniform vec2 uDir; uniform float uOrtho;
float lin(vec2 uv){ float d=texture(uDepth,uv).r; if(d>=0.99999) return 1e4; return uOrtho>0.5 ? 0.02+d*99.98 : 2.0*0.02*100.0/(100.02-(2.0*d-1.0)*99.98); }
void main(){ float z=lin(vUV); float s=texture(uSrc,vUV).r, ws=1.0; float k=1.0/(0.03*min(z,100.0)+0.004);
  for(int i=-4;i<=4;i++){ if(i==0) continue; vec2 u=vUV+uDir*float(i); float zs=lin(u); float w=exp(-abs(zs-z)*k)*exp(-float(i*i)*0.08); s+=texture(uSrc,u).r*w; ws+=w; }
  o=vec4(vec3(s/ws),1.0); }`;
let P_PAO=null,P_PAOB=null;
let P_PTH=null,P_PBL=null,P_PC=null;
function postTex(w,h,filter){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);return {tex:t,fbo:f,w,h};}
function postFreeT(t){if(!t)return;gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.fbo);}
function v3PostFree(F){const X=F&&F.px;if(!X)return;postFreeT(X.a);postFreeT(X.b0);postFreeT(X.b1);postFreeT(X.ao0);postFreeT(X.ao1);if(X.dt){gl.deleteTexture(X.dt);gl.deleteFramebuffer(X.df);}F.px=null;}
/* run after the model is resolved into F.rf; the result goes back into F.rf */
function v3Post(F){const s=v3s();if(!postActive(s))return;const p=postOf(s),needD=p.dof.on||p.ao.on;
  if(!P_PC){P_PAO=program(FS_POSTAO);P_PAOB=program(FS_POSTAOB);P_PTH=program(FS_POSTTH);P_PBL=program(FS_POSTBL);P_PC=program(FS_POSTC);}
  let X=F.px;if(X&&(X.w!==F.w||X.h!==F.h)){v3PostFree(F);X=null;}
  if(!X){X=F.px={w:F.w,h:F.h,a:postTex(F.w,F.h,gl.LINEAR),b0:postTex(Math.max(1,F.w>>1),Math.max(1,F.h>>1),gl.LINEAR),b1:postTex(Math.max(1,F.w>>1),Math.max(1,F.h>>1),gl.LINEAR)};}
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.bindVertexArray(vao);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,F.rf);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,X.a.fbo);gl.blitFramebuffer(0,0,F.w,F.h,0,0,F.w,F.h,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  if(needD){if(!X.dt){X.dt=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,X.dt);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,F.w,F.h,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      X.df=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,X.df);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,X.dt,0);}
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,F.ms);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,X.df);gl.blitFramebuffer(0,0,F.w,F.h,0,0,F.w,F.h,gl.DEPTH_BUFFER_BIT,gl.NEAREST);}
  if(p.bloom.on){run(P_PTH,X.b0,{uSrc:X.a.tex,uT:p.bloom.thr});const st=1+p.bloom.rad*5;
    for(let i=0;i<2;i++){run(P_PBL,X.b1,{uSrc:X.b0.tex,uDir:[st/X.b0.w,0]});run(P_PBL,X.b0,{uSrc:X.b1.tex,uDir:[0,st/X.b0.h]});}}
  const sm=v3s(),c=v3.cam,foc=Math.max(.01,c.dist*(1+p.dof.focus)),tanH=2*Math.tan(sm.fov*Math.PI/360),oh=sm.ortho?2*c.dist*Math.tan(sm.fov*Math.PI/360):1,tanH0=tanH,oh0=oh;
  if(p.ao.on&&X.dt){if(!X.ao0){X.ao0=postTex(F.w,F.h,gl.LINEAR);X.ao1=postTex(F.w,F.h,gl.LINEAR);}
    run(P_PAO,X.ao0,{uDepth:X.dt,uPx:[1/F.w,1/F.h],uAsp:F.w/F.h,uOrtho:sm.ortho?1:0,uTan:tanH0,uOH:oh0,uR:p.ao.rad});
    const st=1+p.ao.soft*2.5;run(P_PAOB,X.ao1,{uSrc:X.ao0.tex,uDepth:X.dt,uDir:[st/F.w,0],uOrtho:sm.ortho?1:0});run(P_PAOB,X.ao0,{uSrc:X.ao1.tex,uDepth:X.dt,uDir:[0,st/F.h],uOrtho:sm.ortho?1:0});}
  run(P_PC,{fbo:F.rf,w:F.w,h:F.h},{uSrc:X.a.tex,uBloom:X.b0.tex,uDepth:needD&&X.dt?X.dt:dummy,uAO:p.ao.on&&X.ao0?X.ao0.tex:dummy,uPx:[1/F.w,1/F.h],uAsp:F.w/F.h,uOrtho:sm.ortho?1:0,uTan:tanH,uOH:oh,
    uA:[p.ao.on?1:0,p.ao.amt,p.ao.rad,0],uD:[p.dof.on?1:0,p.dof.amt,foc,0],uB:[p.bloom.on?1:0,p.bloom.amt,p.grain.col,0],uG:p.grade.on?[p.grade.exp,p.grade.con,p.grade.sat,p.grade.warm]:[0,0,0,0],
    uV:[p.vig.on?p.vig.amt:0,p.vig.soft,p.grain.on?p.grain.amt:0,p.ca.on?p.ca.amt:0],uS:[p.sharp.on?p.sharp.amt:0,postGrainSeed(p.grain),p.grade.on?1:0,p.grain.size*Math.max(1,F.h/1080)],uL:[p.look.on?p.look.mode:0,p.look.amt,p.look.lv,0]});
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
/* ---- the settings, in the Shader panel ---- */
function postEdit(k,key,v){const s=v3s();if(!s.post)s.post={};s.post[k]=Object.assign({},s.post[k]||{},{[key]:v});v3.dirty=true;requestRender(true);}
const POST_SL={bloom:[['amt','Amount',0,2,.01],['thr','Threshold',0,1,.01],['rad','Spread',0,1,.01]],ao:[['amt','Strength',0,1,.01],['rad','Radius',.02,1,.01],['soft','Smoothness',0,1,.01]],dof:[['amt','Blur',0,1,.01],['focus','Focus distance',-.8,1.5,.01]],
  sharp:[['amt','Amount',0,1,.01]],grade:[['exp','Exposure',-2,2,.01],['con','Contrast',-.5,.8,.01],['sat','Saturation',-1,1,.01],['warm','Warmth',-1,1,.01]],vig:[['amt','Amount',0,1,.01],['soft','Softness',0,1,.01]],ca:[['amt','Amount',0,1,.01]],look:[['amt','Strength',0,1,.01],['lv','Levels (posterize)',2,12,1]],grain:[['amt','Amount',0,1,.01],['size','Grain size',.6,4,.05],['col','Colour noise',0,1,.01]]};
function postBox(){const P=postOf(),box=el('div',{class:'dlg-grid',id:'postBox'});
  for(const [k,label,tip] of POST_NAMES){const row=el('div',{class:'postfx'+(P[k].on?' on':''),title:tip});
    row.append(chk('post_'+k,label,P[k].on,v=>{postEdit(k,'on',v);row.classList.toggle('on',v);}));
    const sl=el('div',{class:'postsl'});for(const [key,lab,mn,mx,st] of POST_SL[k])sl.append(makeSlider({id:'post_'+k+'_'+key,label:lab,min:mn,max:mx,step:st,value:P[k][key],fmt:v=>v.toFixed(2),onInput:v=>postEdit(k,key,v)}).el);
    if(k==='grain')sl.append(chk('post_grain_animated','Animate grain',!!P.grain.animated,v=>postEdit('grain','animated',v)),makeSlider({id:'post_grain_speed',label:'Frames per second',min:1,max:60,step:1,value:P.grain.speed,fmt:v=>String(v),onInput:v=>postEdit('grain','speed',v)}).el);
    if(k==='look'){const ms=el('select',{id:'post_look_mode','aria-label':'Filter look'});for(const [v,t] of POST_LOOKS)ms.append(el('option',{value:String(v),text:t}));ms.value=String(P.look.mode);ms.onchange=()=>postEdit('look','mode',+ms.value);sl.prepend(ms);}
    row.append(sl);box.append(row);}
  box.append(el('div',{class:'chips resetrow'},el('button',{class:'btn sm',id:'postReset',text:'Reset post processing',title:'Turn every effect off and put the sliders back',onclick:()=>{const s=v3s();delete s.post;v3.dirty=true;requestRender(true);renderShading();}})));
  return box;}

function postGrainSeed(g){if(v3.postSeed)return g.animated?v3.postSeed:7.13;return g.animated?7.13+Math.floor(performance.now()/1000*(g.speed||24))*3.17:7.13;}
/* Request view-only redraws; painting composites and idle views are left alone. */
setInterval(()=>{if(document.hidden||!v3.on||ui.mode==='bake'||ui.mode==='convert')return;const g=postOf().grain;if(!g.on||!g.animated||g.amt<=0)return;v3.dirty=true;requestRender();},1000/60);
