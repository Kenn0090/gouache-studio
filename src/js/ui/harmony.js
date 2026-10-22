/* ================= Colour harmony and three-colour mixing (0.65.1, tester feedback) =================
   Harmony: pick a scheme (complementary, split complementary, triadic, tetradic, analogous, monochrome) and the colours that go with
   the colour you have appear as swatches (click one to paint with it, Shift+click to make it the background colour).
   Mix 3: three corner colours and a triangle between them; click or drag inside it to mix them in OKLab (like the shade strip). */
const HARM_SCHEMES=[['comp','Complementary',[0,180]],['split','Split complementary',[0,150,210]],['tri','Triadic',[0,120,240]],['tetra','Tetradic',[0,90,180,270]],['ana','Analogous',[-30,0,30]],['mono','Monochrome',null]];
const harm=(()=>{const d={scheme:'tri',open:false};try{Object.assign(d,JSON.parse(localStorage.getItem('gs.harm')||'{}'));}catch(e){}return d;})();
const harmSave=()=>{try{localStorage.setItem('gs.harm',JSON.stringify({scheme:harm.scheme,open:harm.open}));}catch(e){}};
function harmColours(base,scheme){const h=rgb2hsv(...base),def=HARM_SCHEMES.find(x=>x[0]===scheme)||HARM_SCHEMES[2];
  if(!def[2]){const s=h[1],v=h[2];return [[s,clamp(v*.35,0,1)],[s,clamp(v*.6,0,1)],[s,v],[clamp(s*.55,0,1),clamp(v+(1-v)*.45,0,1)],[clamp(s*.25,0,1),clamp(v+(1-v)*.8,0,1)]].map(([ss,vv])=>hsv2rgb(h[0],ss,vv));}
  return def[2].map(a=>hsv2rgb(((h[0]+a)%360+360)%360,h[1],h[2]));}
let mix3=null;
const m3Init=()=>{if(!mix3)mix3={c:[ui.fg.slice(),ui.bg.slice(),fromOk((a=>[a[0],-a[1],-a[2]])(toOk(ui.fg)))],w:[1/3,1/3,1/3]};return mix3;};
function m3Colour(){const M=m3Init(),o=M.c.map(toOk);return fromOk([0,1,2].map(i=>o[0][i]*M.w[0]+o[1][i]*M.w[1]+o[2][i]*M.w[2]));}
const M3W=180,M3H=150,M3P=[[M3W/2,10],[10,M3H-10],[M3W-10,M3H-10]];
function m3Draw(cv){const g=cv.getContext('2d'),M=m3Init(),S=2,w=cv.width,h=cv.height,id=g.createImageData(w,h),o=M.c.map(toOk),P=M3P.map(p=>[p[0]*S,p[1]*S]);
  const area=(P[1][0]-P[0][0])*(P[2][1]-P[0][1])-(P[2][0]-P[0][0])*(P[1][1]-P[0][1]);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const l0=((P[1][0]-x)*(P[2][1]-y)-(P[2][0]-x)*(P[1][1]-y))/area,l1=((P[2][0]-x)*(P[0][1]-y)-(P[0][0]-x)*(P[2][1]-y))/area,l2=1-l0-l1;
    if(l0<-.002||l1<-.002||l2<-.002)continue;const c=fromOk([0,1,2].map(i=>o[0][i]*l0+o[1][i]*l1+o[2][i]*l2)),k=(y*w+x)*4;id.data[k]=c[0]*255;id.data[k+1]=c[1]*255;id.data[k+2]=c[2]*255;id.data[k+3]=255;}
  g.putImageData(id,0,0);
  M3P.forEach((p,i)=>{g.beginPath();g.arc(p[0]*S,p[1]*S,9,0,7);g.fillStyle=toHex(M.c[i]);g.fill();g.lineWidth=3;g.strokeStyle='#fff';g.stroke();});
  const px=M3P[0][0]*M.w[0]+M3P[1][0]*M.w[1]+M3P[2][0]*M.w[2],py=M3P[0][1]*M.w[0]+M3P[1][1]*M.w[1]+M3P[2][1]*M.w[2];g.beginPath();g.arc(px*S,py*S,8,0,7);g.lineWidth=3;g.strokeStyle='#000';g.stroke();g.lineWidth=1.5;g.strokeStyle='#fff';g.stroke();}
function m3At(cv,e){const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*M3W,y=(e.clientY-r.top)/r.height*M3H,[A,B,C]=M3P,
  area=(B[0]-A[0])*(C[1]-A[1])-(C[0]-A[0])*(B[1]-A[1]);let l0=((B[0]-x)*(C[1]-y)-(C[0]-x)*(B[1]-y))/area,l1=((C[0]-x)*(A[1]-y)-(A[0]-x)*(C[1]-y))/area,l2=1-l0-l1;
  l0=Math.max(0,l0);l1=Math.max(0,l1);l2=Math.max(0,l2);const s=l0+l1+l2||1;mix3.w=[l0/s,l1/s,l2/s];}
function harmRender(){const body=document.getElementById('harmBody');if(!body||!body.isConnected)return;if(!document.getElementById('harmBox').open&&!body.childElementCount)return;
  const row=body.querySelector('.harmrow'),sel=body.querySelector('#harmScheme');if(!row||!sel){harmBuild();return;}
  row.replaceChildren(...harmColours(ui.fg,harm.scheme).map(c=>{const hx=toHex(c);return el('button',{class:'harmsw',style:'background:'+hx,title:hx+'. Click to paint with it; Shift+click for the background colour','aria-label':'Use '+hx,onclick:e=>{if(e.shiftKey){ui.bg=c.slice();refreshColor();}else setFG(c);}});}));}
function harmBuild(){const body=document.getElementById('harmBody');if(!body)return;body.replaceChildren();
  const sel=el('select',{id:'harmScheme','aria-label':'Colour scheme'},...HARM_SCHEMES.map(([k,t])=>el('option',{value:k,text:t})));sel.value=harm.scheme;sel.onchange=()=>{harm.scheme=sel.value;harmSave();harmRender();};
  const M=m3Init(),cv=el('canvas',{id:'mix3',width:M3W*2,height:M3H*2,class:'mix3cv',title:'Click or drag to mix the three colours','aria-label':'Mix three colours'});cv.style.width=M3W+'px';cv.style.height=M3H+'px';
  let drag=false;const use=e=>{m3At(cv,e);m3Draw(cv);const keep=ui.bg;setFG(m3Colour());ui.bg=keep;};
  cv.addEventListener('pointerdown',e=>{drag=true;cv.setPointerCapture(e.pointerId);use(e);e.preventDefault();});cv.addEventListener('pointermove',e=>{if(drag)use(e);});cv.addEventListener('pointerup',()=>{drag=false;});cv.addEventListener('pointercancel',()=>{drag=false;});
  const corner=i=>el('button',{class:'harmsw',id:'m3c'+i,style:'background:'+toHex(M.c[i]),title:'Corner '+(i+1)+': click to set it to the colour you are using','aria-label':'Set corner '+(i+1)+' to the current colour',onclick:()=>{M.c[i]=ui.fg.slice();m3Draw(cv);harmBuild();}});
  body.append(el('div',{class:'sub',text:'Harmony'}),el('div',{class:'frow'},sel),el('div',{class:'harmrow'}),
    el('div',{class:'sub',text:'Mix three colours'}),el('div',{class:'chips'},corner(0),corner(1),corner(2),el('button',{class:'btn sm',id:'m3Reset',text:'Start again',title:'Corners: the foreground, the background and the opposite of the foreground',onclick:()=>{mix3=null;harmBuild();}})),cv);
  m3Draw(cv);harmRender();}
(function(){const sec=document.getElementById('mix');if(!sec)return;const d=el('details',{class:'more',id:'harmBox'},el('summary',{text:'Harmony and three-colour mixing'}),el('div',{id:'harmBody',class:'dlg-grid'}));d.open=harm.open;
  d.addEventListener('toggle',()=>{harm.open=d.open;harmSave();if(d.open)harmBuild();});sec.after(d);if(d.open)setTimeout(harmBuild,0);})();
{const rc=refreshColor;refreshColor=function(){rc.apply(this,arguments);try{harmRender();}catch(e){}};}
