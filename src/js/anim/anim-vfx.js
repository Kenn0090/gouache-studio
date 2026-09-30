/* ================= VFX helpers for the animation tab =================
   Generators: Fire, Smoke and Sparks drawn by the GPU into new frames, made to loop exactly. They can be shaped by
   the painted frame. Helpers: spin the current frame, make a loop seamless, cut the current frame into a grid. */
const VFXG_FS=`uniform vec2 uSize; uniform float uT; uniform float uSeed; uniform float uScale; uniform float uTurb; uniform float uInt; uniform int uKind; uniform int uPal;
uniform sampler2D uBase; uniform float uUseBase; uniform float uFlip;
float hs(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+uSeed*1.7)*43758.5453); }
float vnp(vec2 p,vec2 per){ vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f); vec2 a=mod(i,per),b=mod(i+1.0,per);
  return mix(mix(hs(a),hs(vec2(b.x,a.y)),u.x),mix(hs(vec2(a.x,b.y)),hs(b),u.x),u.y); }
float fbmp(vec2 p,vec2 per){ float s=0.0,a=0.5,tot=0.0; for(int i=0;i<5;i++){ s+=a*vnp(p,per); tot+=a; p*=2.0; per*=2.0; a*=0.5; } return s/tot; }
vec3 ramp(float h,int pal){ vec3 a,b,c,d;
  if(pal==1){ a=vec3(0.0,0.05,0.4); b=vec3(0.1,0.35,1.0); c=vec3(0.4,0.8,1.0); d=vec3(0.9,1.0,1.0); }
  else if(pal==2){ a=vec3(0.0,0.3,0.0); b=vec3(0.2,0.9,0.05); c=vec3(0.7,1.0,0.3); d=vec3(0.95,1.0,0.8); }
  else if(pal==3){ a=vec3(0.25,0.0,0.4); b=vec3(0.6,0.1,1.0); c=vec3(0.9,0.5,1.0); d=vec3(1.0,0.9,1.0); }
  else { a=vec3(0.6,0.05,0.0); b=vec3(1.0,0.35,0.02); c=vec3(1.0,0.8,0.25); d=vec3(1.0,1.0,0.85); }
  return h<0.33?mix(a,b,h/0.33):h<0.66?mix(b,c,(h-0.33)/0.33):mix(c,d,clamp((h-0.66)/0.34,0.0,1.0)); }
float baseA(vec2 uv){ return texture(uBase,vec2(uv.x,1.0-uv.y)).a; }
void main(){ vec2 uv=gl_FragCoord.xy/uSize; uv.y=1.0-uv.y; float asp=uSize.x/uSize.y; vec4 res=vec4(0.0);
  if(uKind==2){ vec3 acc=vec3(0.0); float al=0.0;
    for(int i=0;i<48;i++){ float fi=float(i); float h1=hs(vec2(fi,1.0)),h2=hs(vec2(fi,2.0)),h3=hs(vec2(fi,3.0)),h4=hs(vec2(fi,4.0));
      float tp=fract(uT+h3); float y=-0.03+tp*(0.5+h2*0.9)*uScale*0.6; float x=h1+(h2-0.5)*0.3*tp*uTurb+sin(tp*6.2832*(1.0+floor(h4*3.0))+h1*6.2832)*0.02*uTurb;
      vec2 d=(uv-vec2(x,y))*vec2(asp,1.0); float r=(0.012+0.02*h4)*uScale; float g=exp(-dot(d,d)/(r*r))*(1.0-tp)*(1.0-tp);
      acc+=ramp(0.45+0.55*(1.0-tp),uPal)*g*(1.0+h4)*uInt; al+=g*uInt; }
    res=vec4(acc,clamp(al,0.0,1.0)); res.rgb=min(res.rgb,vec3(res.a)*1.6); }
  else { vec2 per=floor(vec2(uKind==0?3.0:2.0,uKind==0?4.0:3.0)*uScale*vec2(asp,1.0)+0.5); per=max(2.0*floor(per*0.5+0.5),vec2(2.0));
    vec2 p=uv*per; p.y-=uT*per.y; vec2 q=p*0.5; float w=fbmp(q+vec2(3.1,1.7),max(per*0.5,vec2(1.0))); p.x+=(w-0.5)*uTurb*3.0;
    float n=fbmp(p,per);
    float sm=0.0; if(uUseBase>0.5){ float ds=0.0; for(int i=0;i<8;i++){ float k=float(i)/8.0; float a=baseA(uv-vec2((w-0.5)*0.1*uTurb,k*0.3)); ds=max(ds,a*(1.0-k)); } sm=ds; }
    if(uKind==0){
      float wd=mix(0.30,0.05,pow(uv.y,0.7)); float b=1.0-smoothstep(0.0,wd,abs(uv.x-0.5)+(n-0.5)*(0.15+0.5*uTurb)*(0.3+uv.y));
      float heat=uUseBase>0.5 ? sm*(0.45+1.1*n) : b*(1.0-uv.y*0.8)*(0.35+1.3*n);
      heat=clamp((heat-0.22-uv.y*0.25)*2.0*uInt,0.0,1.0); vec3 c=ramp(heat,uPal); float al=smoothstep(0.02,0.25,heat); res=vec4(c*al,al); }
    else { float wd=mix(0.14,0.46,uv.y); float b=1.0-smoothstep(0.0,wd,abs(uv.x-0.5)); float fade=smoothstep(0.0,0.12,uv.y)*(1.0-smoothstep(0.5,1.0,uv.y));
      float body=uUseBase>0.5 ? sm : b*fade; float d=clamp((n-0.35)*2.4,0.0,1.0)*body*uInt; float lum=mix(0.22,0.8,fbmp(p+vec2(5.2,1.3),per)*0.5+uv.y*0.5);
      float al=clamp(d*0.95,0.0,1.0); res=vec4(vec3(lum)*al,al); } }
  o=res; }`;
let P_VFXG=null;
/* draw one frame of a generator; t is 0..1 and the last frame comes just before t=1, so the loop is exact */
function vfxGenInto(T,opt,t,base){if(!P_VFXG)P_VFXG=program(VFXG_FS);
  run(P_VFXG,T,{uSize:[doc.w,doc.h],uT:t,uSeed:opt.seed,uScale:opt.scale,uTurb:opt.turb,uInt:opt.inten,uKind:{int:opt.kind},uPal:{int:opt.pal},uBase:base?base.tex:dummy,uUseBase:base?1:0,uFlip:opt.flip?1:0});}
function vfxGenerate(opt){const A=A_();if(!A)return;const n=clamp(Math.round(opt.n)||8,2,256);if(!animMemOk(n))return;
  const src=curFrame();let base=null;if(opt.useBase&&contentBounds(src.target)){base=acquire();blit(src.target,base,0,0,doc.w,doc.h,0,0);}
  const list=[];for(let i=0;i<n;i++){const F=newFrame();vfxGenInto(F.target,opt,i/n,base);list.push(F);}
  if(base)release(base);
  putFrames(list,!!opt.replace,'Generate '+['fire','smoke','sparks'][opt.kind]);}
const VFX_KINDS=[[0,'Fire'],[1,'Smoke'],[2,'Sparks']],VFX_PALS=[[0,'Orange fire'],[1,'Blue flame'],[2,'Toxic green'],[3,'Magic purple']];
const VFX_DEF={kind:0,n:24,seed:3.7,scale:1,turb:.5,inten:1,pal:0,useBase:false,replace:false,flip:false};
function dlgGenerate(kind){if(!ensureAnimMode())return;const o=Object.assign({},VFX_DEF,{kind:kind||0,seed:Math.random()*50,flip:VFX_FLIP()});
  const body=el('div',{class:'dlg-grid'});const pv=el('canvas',{class:'slicepv',width:160,height:160,style:'width:160px;height:160px;background:#111;border-radius:6px;align-self:center'});
  let t=0,raf=0,tmp=null;
  const draw=()=>{const A=A_();if(!A)return;if(!tmp)tmp=makeTarget(doc.w,doc.h,8);const src=curFrame();let base=null;if(o.useBase&&contentBounds(src.target)){base=src.target;}
    vfxGenInto(tmp,o,(t%1),base);const c=document.createElement('canvas');c.width=doc.w;c.height=doc.h;const px=readRGBA8(tmp),id=new ImageData(doc.w,doc.h);
    for(let i=0;i<px.length;i+=4){const a=px[i+3];if(a){id.data[i]=Math.min(255,px[i]*255/a);id.data[i+1]=Math.min(255,px[i+1]*255/a);id.data[i+2]=Math.min(255,px[i+2]*255/a);id.data[i+3]=a;}}
    c.getContext('2d').putImageData(id,0,0);const x=pv.getContext('2d');x.clearRect(0,0,160,160);x.fillStyle='#111';x.fillRect(0,0,160,160);const s=Math.min(160/doc.w,160/doc.h);x.drawImage(c,80-doc.w*s/2,80-doc.h*s/2,doc.w*s,doc.h*s);};
  let stop=false;const tick=()=>{if(stop)return;t+=1/o.n/2;try{draw();}catch(e){}raf=setTimeout(tick,90);};
  const redraw=()=>{};
  const kinds=el('div',{class:'chips'});const drawKinds=()=>{kinds.replaceChildren(...VFX_KINDS.map(([v,l])=>el('button',{class:'chip'+(o.kind===v?' on':''),text:l,onclick:()=>{o.kind=v;drawKinds();}})));};drawKinds();
  const sl=(key,label,mn,mx,st)=>makeSlider({id:'vg_'+key,label,min:mn,max:mx,step:st,value:o[key],fmt:v=>v.toFixed(2),onInput:v=>{o[key]=v;}}).el;
  const numN=el('input',{class:'num',type:'number',min:2,max:256,value:o.n,id:'vgN','aria-label':'Frames'});numN.addEventListener('input',()=>{o.n=clamp(+numN.value||8,2,256);});
  const presets=el('div',{class:'chips'},...[8,16,24,32,64].map(v=>el('button',{class:'chip',text:String(v),onclick:()=>{o.n=v;numN.value=v;}})));
  const pal=el('select',{id:'vgPal','aria-label':'Colours'});for(const [v,l] of VFX_PALS)pal.append(el('option',{value:String(v),text:l}));pal.onchange=()=>{o.pal=+pal.value;};
  body.append(pv,kinds,el('div',{class:'frow'},el('label',{for:'vgN',text:'Frames (it loops)'}),numN),presets,el('div',{class:'frow'},el('label',{for:'vgPal',text:'Colours'}),pal),
    sl('scale','Size of the detail',.5,3,.05),sl('turb','Turbulence',0,1.5,.01),sl('inten','Strength',.3,2,.01),
    el('div',{class:'frow'},el('button',{class:'btn sm',text:'New random',onclick:()=>{o.seed=Math.random()*50;}})),
    el('div',{class:'chips'},chk('vgBase','Shape it with the painted frame (Fire, Smoke)',o.useBase,v=>{o.useBase=v;}),chk('vgRep','Replace the current frames',o.replace,v=>{o.replace=v;})));
  tick();openDialog({title:'Generate effect',body,okLabel:'Make frames',onOk(){stop=true;clearTimeout(raf);if(tmp)disposeTarget(tmp);vfxGenerate(o);},onCancel(){stop=true;clearTimeout(raf);if(tmp)disposeTarget(tmp);}});}
/* the generators draw with y up; the picture is stored top row first in some builds, so this is detected once */
function VFX_FLIP(){return false;}

/* ---- helpers ---- */
function spinFrames(n,deg){const A=A_();if(!A)return;n=clamp(Math.round(n)||8,2,256);if(!animMemOk(n))return;
  const src=frameCanvas(curFrame()),W=doc.w,H=doc.h,list=[];
  for(let i=0;i<n;i++){const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.translate(W/2,H/2);x.rotate(i*deg/n*Math.PI/180);x.drawImage(src,-W/2,-H/2);
    const d=x.getImageData?c.getContext('2d').getImageData(0,0,W,H):null;const F=newFrame(),tex=uploadStraight({w:W,h:H,data:d.data,bits:8});premultInto(F.target,tex,[0,0],null);gl.deleteTexture(tex);list.push(F);}
  putFrames(list,false,'Spin frame');}
/* make the loop seamless: the first k frames fade in from the last k, and the last k are dropped */
function seamlessLoop(k){const A=A_();if(!A)return;const [a,b]=animRange(),n=b-a+1;k=clamp(Math.round(k)||1,1,Math.floor((n-1)/2));
  if(n<3){toast('Needs at least three frames.');return;}if(n<=2*k){toast('Too few frames for that overlap.');return;}
  animOp('Seamless loop',A=>{const fr=A.frames.slice();for(let j=0;j<k;j++){const tail=fr[b-k+1+j],head=fr[a+j],F=newFrame();
      run(P.mix,F.target,{uA:tail.target.tex,uB:head.target.tex,uT:j/k,uM:dummy.tex||dummy,uUseM:false});F.hold=head.hold;fr[a+j]=F;frameDirty(F);}
    fr.splice(b-k+1,k);A.frames=fr;A.cur=clamp(A.cur,0,fr.length-1);ui.fsel=null;});
  toast('Loop made seamless: '+k+' frames now fade from the end into the start.');}
function cutFrameGrid(){if(!ensureAnimMode())return;const c=frameCanvas(curFrame()),id=c.getContext('2d').getImageData(0,0,c.width,c.height);importSheet({w:c.width,h:c.height,data:id.data,bits:8});}
(function buildVfxMenu(){const s=el('select',{class:'tlsel','aria-label':'VFX',title:'Fire, smoke and sparks generators, spin, seamless loop and cut into a grid'},el('option',{value:'',text:'VFX…'}),
    el('option',{value:'g0',text:'Fire…'}),el('option',{value:'g1',text:'Smoke…'}),el('option',{value:'g2',text:'Sparks…'}),el('option',{value:'spin',text:'Spin this frame…'}),el('option',{value:'loop',text:'Make loop seamless…'}),el('option',{value:'cut',text:'Cut this frame into a grid…'}));
  s.addEventListener('change',()=>{const v=s.value;s.value='';s.blur();
    if(v[0]==='g')dlgGenerate(+v[1]);
    if(v==='spin')dlgNumber('Spin this frame','How many frames for one full turn?',16,2,256,n=>spinFrames(n,360));
    if(v==='loop')dlgNumber('Make loop seamless','How many frames should fade between the end and the start?',Math.max(1,Math.min(8,Math.floor((A_().frames.length-1)/4))),1,64,seamlessLoop);
    if(v==='cut')cutFrameGrid();});
  const c=document.querySelector('#timeline .tlctrl');const pv=[...c.children].find(x=>x.tagName==='BUTTON'&&x.textContent==='Preview');c.insertBefore(s,pv||null);})();
