/* ================= Post processing for the 3D view (0.40) =================
   Effects laid over the finished picture of the model: Bloom, Ambient occlusion, Depth of field, Sharpen, Colour
   grade (exposure, contrast, saturation, warmth), Vignette, Chromatic aberration and Film grain. Each has a switch
   and its own sliders in the Shader panel. They sit in the viewer settings (v3s().post), so the screenshot, the
   render window and the turntable get them too. Depth of field and occlusion read the model's depth. */
const POST_DEF={bloom:{on:false,amt:.6,thr:.7,rad:.5},ao:{on:false,amt:.7,rad:.15},dof:{on:false,amt:.5,focus:0},sharp:{on:false,amt:.6},
  grade:{on:false,exp:0,con:0,sat:0,warm:0},vig:{on:false,amt:.5,soft:.5},ca:{on:false,amt:.4},grain:{on:false,amt:.3}};
const POST_NAMES=[['bloom','Bloom','Bright parts glow'],['ao','Ambient occlusion','Darkens creases and where things meet'],['dof','Depth of field','Blurs what is nearer or farther than the focus'],
  ['sharp','Sharpen','Crisper fine detail'],['grade','Colour grade','Exposure, contrast, saturation and warmth'],['vig','Vignette','Darker corners'],
  ['ca','Chromatic aberration','Colour fringes towards the edges, like a cheap lens'],['grain','Film grain','A little noise over everything']];
function postOf(s){s=s||v3s();const p=s.post||{},o={};for(const k in POST_DEF)o[k]=Object.assign({},POST_DEF[k],p[k]||{});return o;}
function postActive(s){if(ui.mode==='bake'||ui.mode==='convert')return false;const p=postOf(s);for(const k in p)if(p[k].on)return true;return false;}
const FS_POSTTH=`in vec2 vUV; uniform sampler2D uSrc; uniform float uT;
void main(){ vec3 c=texture(uSrc,vUV).rgb; float l=max(max(c.r,c.g),c.b); float k=max(l-uT,0.0)/max(l,1e-3); o=vec4(c*k,1.0); }`;
const FS_POSTBL=`in vec2 vUV; uniform sampler2D uSrc; uniform vec2 uDir;
void main(){ vec3 s=texture(uSrc,vUV).rgb*0.227027; s+=(texture(uSrc,vUV+uDir*1.3846).rgb+texture(uSrc,vUV-uDir*1.3846).rgb)*0.316216; s+=(texture(uSrc,vUV+uDir*3.2308).rgb+texture(uSrc,vUV-uDir*3.2308).rgb)*0.070270; o=vec4(s,1.0); }`;
const FS_POSTC=`in vec2 vUV; uniform sampler2D uSrc; uniform sampler2D uBloom; uniform sampler2D uDepth;
uniform vec2 uPx; uniform float uAsp; uniform float uOrtho; uniform float uTan; uniform float uOH;
uniform vec4 uA; uniform vec4 uD; uniform vec4 uB; uniform vec4 uG; uniform vec4 uV; uniform vec4 uS;
float lin(vec2 uv){ float d=texture(uDepth,uv).r; if(d>=0.99999) return 1e4; return uOrtho>0.5 ? 0.02+d*99.98 : 2.0*0.02*100.0/(100.02-(2.0*d-1.0)*99.98); }
float hsh(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 uv=vUV; vec4 s0=texture(uSrc,uv); vec3 c=s0.rgb;
  if(uV.w>0.0){ vec2 d=(uv-0.5)*uV.w*0.03; c=vec3(texture(uSrc,uv+d).r,c.g,texture(uSrc,uv-d).b); }
  if(uD.x>0.5){ float z=lin(uv), foc=uD.z; float coc=min(abs(z-foc)/max(foc,0.001),1.0)*uD.y; float r=coc*14.0;
    if(r>0.5){ vec3 acc=c; float w=1.0;
      for(int i=0;i<24;i++){ float a=float(i)*2.39996; float rr=sqrt((float(i)+0.5)/24.0); vec2 off=vec2(cos(a),sin(a))*rr*r*uPx; float zs=lin(uv+off);
        float cs=min(abs(zs-foc)/max(foc,0.001),1.0)*uD.y*14.0; float wt=smoothstep(0.0,1.0,cs/max(rr*r,0.5)); acc+=texture(uSrc,uv+off).rgb*wt; w+=wt; }
      c=acc/w; } }
  if(uA.x>0.5){ float z=lin(uv); if(z<1000.0){ float R=uA.z; float ry=uOrtho>0.5 ? R/uOH : R/(z*uTan); float occ=0.0;
      for(int i=0;i<12;i++){ float a=float(i)*2.39996+hsh(uv*vec2(913.0,517.0))*6.283; float rr=sqrt((float(i)+0.5)/12.0); vec2 off=vec2(cos(a)/uAsp,sin(a))*rr*ry; float zs=lin(uv+off);
        if(zs<z-0.02*R){ occ+=smoothstep(0.0,1.0,R/max(abs(z-zs),1e-4)); } }
      c*=1.0-uA.y*occ/12.0; } }
  if(uS.x>0.0){ vec3 av=(texture(uSrc,uv+vec2(uPx.x,0.0)).rgb+texture(uSrc,uv-vec2(uPx.x,0.0)).rgb+texture(uSrc,uv+vec2(0.0,uPx.y)).rgb+texture(uSrc,uv-vec2(0.0,uPx.y)).rgb)*0.25; c+=(c-av)*uS.x*2.0; }
  if(uB.x>0.5) c+=texture(uBloom,uv).rgb*uB.y*1.5;
  if(uS.z>0.5){ c*=exp2(uG.x); c=(c-0.5)*(1.0+uG.y)+0.5; float l=dot(c,vec3(0.2126,0.7152,0.0722)); c=mix(vec3(l),c,1.0+uG.z); c.r*=1.0+uG.w*0.15; c.b*=1.0-uG.w*0.15; }
  if(uV.x>0.0){ float d=length((uv-0.5)*vec2(uAsp,1.0)); c*=1.0-uV.x*smoothstep(0.3,0.3+0.15+uV.y*0.9,d); }
  if(uV.z>0.0){ c+=(hsh(uv/uPx+uS.y)-0.5)*uV.z*0.25; }
  o=vec4(clamp(c,0.0,1.0),s0.a); }`;
let P_PTH=null,P_PBL=null,P_PC=null;
function postTex(w,h,filter){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);return {tex:t,fbo:f,w,h};}
function postFreeT(t){if(!t)return;gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.fbo);}
function v3PostFree(F){const X=F&&F.px;if(!X)return;postFreeT(X.a);postFreeT(X.b0);postFreeT(X.b1);if(X.dt){gl.deleteTexture(X.dt);gl.deleteFramebuffer(X.df);}F.px=null;}
/* run after the model is resolved into F.rf; the result goes back into F.rf */
function v3Post(F){const s=v3s();if(!postActive(s))return;const p=postOf(s),needD=p.dof.on||p.ao.on;
  if(!P_PC){P_PTH=program(FS_POSTTH);P_PBL=program(FS_POSTBL);P_PC=program(FS_POSTC);}
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
  const sm=v3s(),c=v3.cam,foc=Math.max(.01,c.dist*(1+p.dof.focus)),tanH=2*Math.tan(sm.fov*Math.PI/360),oh=sm.ortho?2*c.dist*Math.tan(sm.fov*Math.PI/360):1;
  run(P_PC,{fbo:F.rf,w:F.w,h:F.h},{uSrc:X.a.tex,uBloom:X.b0.tex,uDepth:needD&&X.dt?X.dt:dummy,uPx:[1/F.w,1/F.h],uAsp:F.w/F.h,uOrtho:sm.ortho?1:0,uTan:tanH,uOH:oh,
    uA:[p.ao.on?1:0,p.ao.amt,p.ao.rad,0],uD:[p.dof.on?1:0,p.dof.amt,foc,0],uB:[p.bloom.on?1:0,p.bloom.amt,0,0],uG:p.grade.on?[p.grade.exp,p.grade.con,p.grade.sat,p.grade.warm]:[0,0,0,0],
    uV:[p.vig.on?p.vig.amt:0,p.vig.soft,p.grain.on?p.grain.amt:0,p.ca.on?p.ca.amt:0],uS:[p.sharp.on?p.sharp.amt:0,7.13,p.grade.on?1:0,0]});
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
/* ---- the settings, in the Shader panel ---- */
function postEdit(k,key,v){const s=v3s();if(!s.post)s.post={};s.post[k]=Object.assign({},s.post[k]||{},{[key]:v});v3.dirty=true;requestRender(true);}
const POST_SL={bloom:[['amt','Amount',0,2,.01],['thr','Threshold',0,1,.01],['rad','Spread',0,1,.01]],ao:[['amt','Strength',0,1,.01],['rad','Radius',.02,1,.01]],dof:[['amt','Blur',0,1,.01],['focus','Focus distance',-.8,1.5,.01]],
  sharp:[['amt','Amount',0,1,.01]],grade:[['exp','Exposure',-2,2,.01],['con','Contrast',-.5,.8,.01],['sat','Saturation',-1,1,.01],['warm','Warmth',-1,1,.01]],vig:[['amt','Amount',0,1,.01],['soft','Softness',0,1,.01]],ca:[['amt','Amount',0,1,.01]],grain:[['amt','Amount',0,1,.01]]};
function postBox(){const P=postOf(),box=el('div',{class:'dlg-grid',id:'postBox'});
  for(const [k,label,tip] of POST_NAMES){const row=el('div',{class:'postfx'+(P[k].on?' on':''),title:tip});
    row.append(chk('post_'+k,label,P[k].on,v=>{postEdit(k,'on',v);row.classList.toggle('on',v);}));
    const sl=el('div',{class:'postsl'});for(const [key,lab,mn,mx,st] of POST_SL[k])sl.append(makeSlider({id:'post_'+k+'_'+key,label:lab,min:mn,max:mx,step:st,value:P[k][key],fmt:v=>v.toFixed(2),onInput:v=>postEdit(k,key,v)}).el);
    row.append(sl);box.append(row);}
  box.append(el('div',{class:'chips resetrow'},el('button',{class:'btn sm',id:'postReset',text:'Reset post processing',title:'Turn every effect off and put the sliders back',onclick:()=>{const s=v3s();delete s.post;v3.dirty=true;requestRender(true);renderShading();}})));
  return box;}
