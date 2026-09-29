/* ================= Colour panel modes (0.26.1) =================
   Tabs at the top of the Color panel: Square (the saturation/brightness square and hue bar), Wheel (a hue ring with a
   triangle inside, like Photoshop's colour wheel, with HSB or RGB sliders above it), Sliders (HSB, HSL, RGB, CMYK or
   Lab) and Swatches (your own colour sets: click to use, + adds the current colour, right-click removes). Under every
   mode: Darker, Lighter, Less saturated and More saturated (steps in OKLab), then the mixing strip and recent colours. */
const CM_MODES=[['square','Square'],['wheel','Wheel'],['sliders','Sliders'],['swatches','Swatches']];
const CM_MODELS=[['hsb','HSB'],['hsl','HSL'],['rgb','RGB'],['cmyk','CMYK'],['lab','Lab']];
const cm=(()=>{const d={mode:'square',model:'hsb',wheelModel:'hsb'};try{return Object.assign(d,JSON.parse(localStorage.getItem('gs.colMode')||'{}'));}catch(e){return d;}})();
function cmStore(){try{localStorage.setItem('gs.colMode',JSON.stringify({mode:cm.mode,model:cm.model,wheelModel:cm.wheelModel}));}catch(e){}}
/* ---- colour models: [values], ranges, to/from rgb (0..1) ---- */
function rgb2hsl(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}return [h,s,l];}
function hsl2rgb(h,s,l){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return [r+m,g+m,b+m];}
function rgb2lab(c){const [r,g,b]=c.map(lin);let X=(.4124564*r+.3575761*g+.1804375*b)/.95047,Y=.2126729*r+.7151522*g+.072175*b,Z=(.0193339*r+.119192*g+.9503041*b)/1.08883;
  const f=t=>t>216/24389?Math.cbrt(t):(24389/27*t+16)/116;const fx=f(X),fy=f(Y),fz=f(Z);return [116*fy-16,500*(fx-fy),200*(fy-fz)];}
function lab2rgb(L,a,b){const fy=(L+16)/116,fx=fy+a/500,fz=fy-b/200,fi=t=>t*t*t>216/24389?t*t*t:(116*t-16)/(24389/27);const X=fi(fx)*.95047,Y=L>8?Math.pow(fy,3):L/(24389/27),Z=fi(fz)*1.08883;
  return [3.2404542*X-1.5371385*Y-.4985314*Z,-.969266*X+1.8760108*Y+.041556*Z,.0556434*X-.2040259*Y+1.0572252*Z].map(v=>clamp(unlin(clamp(v,0,1)),0,1));}
const CM_DEF={
  hsb:{ch:[['H',0,360,'°'],['S',0,100,'%'],['B',0,100,'%']],get:()=>[ui.hsv[0],ui.hsv[1]*100,ui.hsv[2]*100],set:v=>setHSV(v[0]%360,v[1]/100,v[2]/100),rgb:v=>hsv2rgb(v[0]%360,v[1]/100,v[2]/100)},
  hsl:{ch:[['H',0,360,'°'],['S',0,100,'%'],['L',0,100,'%']],get:()=>{const h=rgb2hsl(...ui.fg);return [h[1]>1e-3?h[0]:ui.hsv[0],h[1]*100,h[2]*100];},rgb:v=>hsl2rgb(v[0]%360,v[1]/100,v[2]/100)},
  rgb:{ch:[['R',0,255,''],['G',0,255,''],['B',0,255,'']],get:()=>ui.fg.map(x=>x*255),rgb:v=>v.map(x=>clamp(x/255,0,1))},
  cmyk:{ch:[['C',0,100,'%'],['M',0,100,'%'],['Y',0,100,'%'],['K',0,100,'%']],get:()=>{const [r,g,b]=ui.fg,k=1-Math.max(r,g,b);return k>=.9999?[0,0,0,100]:[(1-r-k)/(1-k)*100,(1-g-k)/(1-k)*100,(1-b-k)/(1-k)*100,k*100];},
    rgb:v=>{const k=v[3]/100;return [0,1,2].map(i=>(1-v[i]/100)*(1-k));}},
  lab:{ch:[['L',0,100,''],['a',-128,127,''],['b',-128,127,'']],get:()=>rgb2lab(ui.fg),rgb:v=>lab2rgb(v[0],v[1],v[2])}};
function cmSetVals(model,v){const D=CM_DEF[model];if(D.set)D.set(v);else{cm.hold={model,v:v.slice()};setFG(D.rgb(v));}}
function cmVals(model){if(cm.hold&&cm.hold.model===model&&toHex(CM_DEF[model].rgb(cm.hold.v))===toHex(ui.fg))return cm.hold.v.slice();return CM_DEF[model].get();}
/* ---- a slider: gradient track + number box ---- */
function cmSlider(model,i,box){const D=CM_DEF[model],[lab,lo,hi,unit]=D.ch[i];const c=el('canvas',{class:'cmtrack','aria-label':lab,role:'slider','aria-valuemin':lo,'aria-valuemax':hi});
  const inp=el('input',{class:'num cmnum',type:'number',min:lo,max:hi,step:1,'aria-label':lab});
  const setFrom=x=>{const v=cmVals(model);v[i]=clamp(lo+x*(hi-lo),lo,hi);cmSetVals(model,v);};
  dragOn(c,e=>{const r=c.getBoundingClientRect();setFrom((e.clientX-r.left)/r.width);});
  inp.addEventListener('change',()=>{const v=cmVals(model);v[i]=clamp(+inp.value||0,lo,hi);cmSetVals(model,v);});inp.addEventListener('keydown',e=>{if(e.key==='Enter')inp.blur();});
  const draw=()=>{const d=Math.min(devicePixelRatio||1,2),w=Math.max(10,Math.round(c.clientWidth*d)),h=Math.max(4,Math.round(c.clientHeight*d));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
    const x=c.getContext('2d'),v=cmVals(model),g=x.createLinearGradient(0,0,w,0);for(let k=0;k<=16;k++){const u=v.slice();u[i]=lo+(hi-lo)*k/16;g.addColorStop(k/16,toHex(D.rgb(u)));}
    x.fillStyle=g;x.fillRect(0,0,w,h);const px=(v[i]-lo)/(hi-lo)*w;x.fillStyle='#fff';x.fillRect(px-1.5*d,0,3*d,h);x.fillStyle='rgba(0,0,0,.55)';x.fillRect(px-2.5*d,0,d,h);x.fillRect(px+1.5*d,0,d,h);
    if(document.activeElement!==inp)inp.value=Math.round(v[i]);c.setAttribute('aria-valuenow',Math.round(v[i]));};
  box.append(el('div',{class:'cmrow'},el('span',{class:'cmlab',text:lab}),c,inp,el('span',{class:'cmunit',text:unit})));return draw;}
/* ---- the wheel: hue ring and a triangle (pure hue, white, black) that turns with the hue ---- */
const cmW={c:null,ring:null,size:0,drag:null};
function cmWheelGeo(){const s=cmW.size,cx=s/2,cy=s/2,R=s/2-2,r=R*.84,tr=r-4,a=-ui.hsv[0]*Math.PI/180;
  const P=k=>[cx+tr*Math.cos(a+k*2*Math.PI/3),cy+tr*Math.sin(a+k*2*Math.PI/3)];return {cx,cy,R,r,H:P(0),Wv:P(1),K:P(2)};}
function cmBary(p,G){const [x1,y1]=G.H,[x2,y2]=G.Wv,[x3,y3]=G.K,det=(y2-y3)*(x1-x3)+(x3-x2)*(y1-y3);const a=((y2-y3)*(p[0]-x3)+(x3-x2)*(p[1]-y3))/det,b=((y3-y1)*(p[0]-x3)+(x1-x3)*(p[1]-y3))/det;return [a,b,1-a-b];}
function cmDrawWheel(){const c=cmW.c;if(!c||!c.clientWidth)return;const d=Math.min(devicePixelRatio||1,2),s=Math.round(Math.min(c.clientWidth,280)*d);
  if(c.width!==s){c.width=c.height=s;c.style.height=(s/d)+'px';cmW.ring=null;}cmW.size=s;const x=c.getContext('2d'),G=cmWheelGeo();
  if(!cmW.ring){const img=x.createImageData(s,s),D=img.data;for(let j=0;j<s;j++)for(let i=0;i<s;i++){const dx=i+.5-G.cx,dy=j+.5-G.cy,rr=Math.hypot(dx,dy);if(rr>G.R||rr<G.r)continue;
      const h=(-Math.atan2(dy,dx)*180/Math.PI+360)%360,[r,g,b]=hsv2rgb(h,1,1),p=(j*s+i)*4,aa=clamp(Math.min(G.R-rr,rr-G.r)+.5,0,1);D[p]=r*255;D[p+1]=g*255;D[p+2]=b*255;D[p+3]=aa*255;}cmW.ring=img;}
  x.clearRect(0,0,s,s);x.putImageData(cmW.ring,0,0);
  const t=x.createImageData(s,s),T=t.data,h=ui.hsv[0],base=hsv2rgb(h,1,1),mnx=Math.floor(Math.min(G.H[0],G.Wv[0],G.K[0])),mxx=Math.ceil(Math.max(G.H[0],G.Wv[0],G.K[0])),mny=Math.floor(Math.min(G.H[1],G.Wv[1],G.K[1])),mxy=Math.ceil(Math.max(G.H[1],G.Wv[1],G.K[1]));
  for(let j=Math.max(0,mny);j<Math.min(s,mxy);j++)for(let i=Math.max(0,mnx);i<Math.min(s,mxx);i++){const [a,b,k]=cmBary([i+.5,j+.5],G),m=Math.min(a,b,k);if(m<-.01)continue;
    const v=clamp(a+b,0,1),p=(j*s+i)*4;for(let q=0;q<3;q++)T[p+q]=(a*base[q]+b)*255;T[p+3]=clamp(m*60+1,0,1)*255;}
  const tc=document.createElement('canvas');tc.width=tc.height=s;tc.getContext('2d').putImageData(t,0,0);x.drawImage(tc,0,0);
  /* markers: hue on the ring, the colour in the triangle */
  const ang=-h*Math.PI/180,rm=(G.R+G.r)/2;x.lineWidth=2*d;x.strokeStyle='#fff';x.beginPath();x.arc(G.cx+rm*Math.cos(ang),G.cy+rm*Math.sin(ang),(G.R-G.r)/2+1*d,0,7);x.stroke();
  const S=ui.hsv[1],V=ui.hsv[2],pt=[G.K[0]*(1-V)+V*(S*G.H[0]+(1-S)*G.Wv[0]),G.K[1]*(1-V)+V*(S*G.H[1]+(1-S)*G.Wv[1])];
  x.strokeStyle=V>.55&&S<.5?'#000':'#fff';x.lineWidth=1.6*d;x.beginPath();x.arc(pt[0],pt[1],5*d,0,7);x.stroke();}
function cmWheelPick(e,start){const c=cmW.c,r=c.getBoundingClientRect(),k=cmW.size/r.width,p=[(e.clientX-r.left)*k,(e.clientY-r.top)*k],G=cmWheelGeo(),dd=Math.hypot(p[0]-G.cx,p[1]-G.cy);
  if(start)cmW.drag=dd>=G.r-2?'ring':'tri';
  if(cmW.drag==='ring'){const h=(-Math.atan2(p[1]-G.cy,p[0]-G.cx)*180/Math.PI+360)%360;setHSV(h,ui.hsv[1],ui.hsv[2]);return;}
  let [a,b,kk]=cmBary(p,G);a=Math.max(0,a);b=Math.max(0,b);kk=Math.max(0,kk);const n=a+b+kk||1;a/=n;b/=n;const v=clamp(a+b,0,1),s=v>1e-4?clamp(a/v,0,1):ui.hsv[1];setHSV(ui.hsv[0],s,v);}
/* ---- swatches ---- */
const CM_SWATCH_DEFAULT=['#000000','#3a3a3a','#6e6e6e','#a0a0a0','#d2d2d2','#ffffff','#5c2e1f','#8b4a2b','#c47a44','#e8b27a','#f3dcb5','#7a1f1f','#c0392b','#e8664f','#f2a07b','#8a5a00','#d4a017','#f5d76e','#2f5d1e','#4f8a2b','#8cc152','#1e5a5a','#2e8b8b','#7fc4c4','#1f3a6e','#2e5fa8','#6b9bd8','#3e2a6e','#6a4aa8','#a98bd8','#6e1f4f','#a8327a','#e07ab4'];
const cmSw=(()=>{try{const a=JSON.parse(localStorage.getItem('gs.swatches')||'null');return Array.isArray(a)?a:CM_SWATCH_DEFAULT.slice();}catch(e){return CM_SWATCH_DEFAULT.slice();}})();
function cmSwStore(){try{localStorage.setItem('gs.swatches',JSON.stringify(cmSw));}catch(e){}}
function cmDrawSwatches(box){box.replaceChildren(...cmSw.map((hx,i)=>el('button',{class:'cmsw'+(hx===toHex(ui.fg)?' on':''),style:'background:'+hx,title:hx+' · right-click to remove','aria-label':'Use '+hx,onclick:()=>setFG(fromHex(hx)),
    oncontextmenu:ev=>{ev.preventDefault();cmSw.splice(i,1);cmSwStore();cmDrawSwatches(box);}})),
  el('button',{class:'cmsw add',title:'Add the current colour','aria-label':'Add the current colour',text:'+',onclick:()=>{const hx=toHex(ui.fg);if(!cmSw.includes(hx)){cmSw.push(hx);cmSwStore();}cmDrawSwatches(box);}}),
  el('button',{class:'btn sm cmswreset',text:'Reset',title:'Back to the built-in swatches',onclick:()=>{cmSw.splice(0,cmSw.length,...CM_SWATCH_DEFAULT);cmSwStore();cmDrawSwatches(box);}}));}
/* ---- darker / lighter / less or more saturated ---- */
function cmNudge(dl,dc){const o=toOk(ui.fg);const L=clamp(o[0]+dl,0,1),k=dc?Math.pow(dc>0?1.18:1/1.18,1):1;let c=fromOk([L,o[1]*k,o[2]*k]);
  if(dc>0&&toHex(c)===toHex(ui.fg)){const h=rgb2hsv(...ui.fg);c=hsv2rgb(ui.hsv[0],clamp(h[1]+.06,0,1),h[2]);}setFG(c);}
/* ---- building the panel ---- */
const cmUI={draws:[],box:null};
function cmBuild(){const sec=$('#hColor').parentElement,sv=$('#sv'),hue=$('#hue');
  const tabs=el('div',{class:'cmtabs',role:'tablist','aria-label':'Colour picker'},...CM_MODES.map(([k,n])=>el('button',{class:'cmtab',role:'tab',id:'cmTab_'+k,'aria-selected':'false',text:n,onclick:()=>{cm.mode=k;cmStore();cmShow();}})));
  const sq=el('div',{class:'cmpane',id:'cmSquare'});sv.before(tabs);tabs.after(sq);sq.append(sv,hue);
  const wh=el('div',{class:'cmpane',id:'cmWheel'});cmW.c=el('canvas',{class:'cmwheel','aria-label':'Hue ring and colour triangle'});
  cmW.c.addEventListener('pointerdown',e=>{cmW.c.setPointerCapture(e.pointerId);cmWheelPick(e,true);const mv=ev=>cmWheelPick(ev,false),up=()=>{cmW.c.removeEventListener('pointermove',mv);cmW.c.removeEventListener('pointerup',up);cmW.drag=null;};cmW.c.addEventListener('pointermove',mv);cmW.c.addEventListener('pointerup',up);});
  const whSl=el('div',{class:'cmsliders',id:'cmWheelSl'}),whSeg=el('div',{class:'cmmodels'});
  wh.append(whSeg,whSl,cmW.c);sq.after(wh);
  const sl=el('div',{class:'cmpane',id:'cmSliders'}),slSeg=el('div',{class:'cmmodels'}),slBox=el('div',{class:'cmsliders'});sl.append(slSeg,slBox);wh.after(sl);
  const sw=el('div',{class:'cmpane',id:'cmSwatches'}),swBox=el('div',{class:'cmswatches'});sw.append(swBox);sl.after(sw);
  const nudge=el('div',{class:'cmnudge',role:'group','aria-label':'Adjust the colour'},
    el('button',{class:'btn sm',id:'cmDarker',text:'Darker',title:'A little darker',onclick:()=>cmNudge(-.05,0)}),el('button',{class:'btn sm',id:'cmLighter',text:'Lighter',title:'A little lighter',onclick:()=>cmNudge(.05,0)}),
    el('button',{class:'btn sm',id:'cmDuller',text:'Less saturated',title:'A little greyer',onclick:()=>cmNudge(0,-1)}),el('button',{class:'btn sm',id:'cmRicher',text:'More saturated',title:'A little more colourful',onclick:()=>cmNudge(0,1)}));
  sec.querySelector('.crow').after(nudge);
  cmUI.box={whSl,whSeg,slSeg,slBox,swBox};cmRebuildSliders();}
function cmModelSeg(box,cur,list,set){box.replaceChildren(...list.map(([k,n])=>el('button',{class:'chip'+(k===cur?' on':''),'aria-pressed':String(k===cur),text:n,onclick:()=>{set(k);cmStore();cmRebuildSliders();cmRefresh();}})));}
function cmRebuildSliders(){const B=cmUI.box;if(!B)return;cmUI.draws=[];
  cmModelSeg(B.whSeg,cm.wheelModel,CM_MODELS.filter(m=>m[0]==='hsb'||m[0]==='rgb'),k=>{cm.wheelModel=k;});B.whSl.replaceChildren();for(let i=0;i<CM_DEF[cm.wheelModel].ch.length;i++)cmUI.draws.push(['wheel',cmSlider(cm.wheelModel,i,B.whSl)]);
  cmModelSeg(B.slSeg,cm.model,CM_MODELS,k=>{cm.model=k;});B.slBox.replaceChildren();for(let i=0;i<CM_DEF[cm.model].ch.length;i++)cmUI.draws.push(['sliders',cmSlider(cm.model,i,B.slBox)]);}
function cmShow(){for(const [k] of CM_MODES){const p=$('#cm'+k[0].toUpperCase()+k.slice(1));if(p)p.hidden=k!==cm.mode;const t=$('#cmTab_'+k);if(t){t.setAttribute('aria-selected',String(k===cm.mode));t.classList.toggle('on',k===cm.mode);}}
  if(cm.mode==='square')drawSV();cmRefresh();}
function cmRefresh(){if(!cmUI.box)return;if(cm.mode==='wheel'){cmDrawWheel();}if(cm.mode==='wheel'||cm.mode==='sliders')for(const [m,d] of cmUI.draws)if(m===cm.mode)d();if(cm.mode==='swatches')cmDrawSwatches(cmUI.box.swBox);}
cmBuild();cmShow();
{const rc=refreshColor;refreshColor=function(){rc.apply(this,arguments);cmRefresh();};}
new ResizeObserver(()=>{cmW.ring=null;cmRefresh();}).observe($('#hColor').parentElement);
