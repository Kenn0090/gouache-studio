/* ================= Color ================= */
const ui={tool:'brush',fg:[0,0,0],bg:[1,1,1],hsv:[0,0,0],recent:[],preset:'Round'};
function hsv2rgb(h,s,v){const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1));};return [f(5),f(3),f(1)];}
function rgb2hsv(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}return [h,mx?d/mx:0,mx];}
const toHex=c=>'#'+c.map(v=>Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0')).join('');
function fromHex(s){s=String(s).trim().replace('#','');if(s.length===3)s=s.split('').map(c=>c+c).join('');if(!/^[0-9a-f]{6}$/i.test(s))return null;return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255);}
const lin=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4), unlin=c=>c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055;
function toOk(c){const [r,g,b]=c.map(lin);const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];}
function fromOk(o){const l=Math.pow(o[0]+.3963377774*o[1]+.2158037573*o[2],3),m=Math.pow(o[0]-.1055613458*o[1]-.0638541728*o[2],3),s=Math.pow(o[0]-.0894841775*o[1]-1.291485548*o[2],3);return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s].map(v=>clamp(unlin(clamp(v,0,1)),0,1));}
function setFG(rgb){ui.fg=rgb.slice();const h=rgb2hsv(...rgb);ui.hsv=[h[1]>0.001&&h[2]>0.001?h[0]:ui.hsv[0],h[1],h[2]];refreshColor();}
function setHSV(h,s,v){ui.hsv=[h,s,v];ui.fg=hsv2rgb(h,s,v);refreshColor();}
function pushRecent(c){const hx=toHex(c);ui.recent=[hx,...ui.recent.filter(x=>x!==hx)].slice(0,14);renderRecent();}
const svC=$('#sv'),hueC=$('#hue');
function sizeColorCanvases(){const d=Math.min(window.devicePixelRatio||1,2);for(const c of [svC,hueC]){const w=Math.max(10,Math.round(c.clientWidth*d)),h=Math.max(4,Math.round(c.clientHeight*d));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}}}
function drawSV(){
  sizeColorCanvases();const x=svC.getContext('2d'),w=svC.width,h=svC.height,d=w/Math.max(1,svC.clientWidth);
  x.fillStyle=toHex(hsv2rgb(ui.hsv[0],1,1));x.fillRect(0,0,w,h);
  let g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);
  g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'#000');x.fillStyle=g;x.fillRect(0,0,w,h);
  const mx=ui.hsv[1]*w,my=(1-ui.hsv[2])*h;x.lineWidth=2*d;x.strokeStyle='rgba(0,0,0,.6)';x.beginPath();x.arc(mx,my,6*d,0,7);x.stroke();x.strokeStyle='#fff';x.lineWidth=1.3*d;x.beginPath();x.arc(mx,my,5*d,0,7);x.stroke();
  const y=hueC.getContext('2d'),hw=hueC.width,hh=hueC.height;const hg=y.createLinearGradient(0,0,hw,0);for(let i=0;i<=6;i++)hg.addColorStop(i/6,toHex(hsv2rgb(i*60%360,1,1)));
  y.fillStyle=hg;y.fillRect(0,0,hw,hh);const hx=ui.hsv[0]/360*hw;y.fillStyle='#fff';y.fillRect(hx-1.5*d,0,3*d,hh);y.fillStyle='rgba(0,0,0,.5)';y.fillRect(hx-2.5*d,0,1*d,hh);y.fillRect(hx+1.5*d,0,1*d,hh);
}
function refreshColor(){
  drawSV();if(typeof schedulePreview==='function')schedulePreview();const fh=toHex(ui.fg),bh=toHex(ui.bg);
  $('#swFG').style.background=fh;$('#swBG').style.background=bh;$('#miniFG').style.background=fh;$('#miniBG').style.background=bh;
  if(document.activeElement!==$('#hex'))$('#hex').value=fh;
  $('#hsvOut').textContent='H'+Math.round(ui.hsv[0])+' S'+Math.round(ui.hsv[1]*100)+' V'+Math.round(ui.hsv[2]*100);
  /* the shade strip stays put while you step through it (click, or Left/Right arrow keys); it starts again from the colour you pick elsewhere */
  const sh=ui.shade;if(!sh||toHex(shadeAt(sh,sh.i))!==fh||toHex(sh.b)!==bh)ui.shade={a:ui.fg.slice(),b:ui.bg.slice(),i:0};
  /* the strip shows nine shades around the current one: past either end it keeps going, lighter or darker in the same colour */
  const S=ui.shade,mix=$('#mix');mix.replaceChildren();const o=S.i<0?S.i:S.i>8?S.i-8:0;
  for(let k=0;k<9;k++){const i=o+k,c=shadeAt(S,i),hx=toHex(c);
    mix.append(el('button',{class:i===S.i?'on':'',title:hx+(i<0||i>8?' (beyond the strip)':' ('+Math.round(i/8*100)+'% background)')+'. Left/Right arrow keys step through the shades','aria-label':'Mixed color '+hx,'aria-pressed':String(i===S.i),style:'background:'+hx,onclick:()=>shadeStep(i-S.i)}));}
}
function shadeAt(S,i){const a=toOk(S.a),b=toOk(S.b);if(i>=0&&i<=8){const t=i/8;return fromOk([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}
  /* beyond an end: that end's colour, lightness moving on in the same direction (steps as on the strip), colourfulness easing off near black and white */
  const e=i>8?b:a,o=i>8?a:b,n=i>8?i-8:-i,dl=e[0]-o[0],s=Math.abs(dl)>1e-4?Math.sign(dl):(i>8?1:-1),step=Math.max(.035,Math.abs(dl)/8),L=clamp(e[0]+s*step*n,0,1);
  const room=s>0?(1-L)/Math.max(1e-4,1-e[0]):L/Math.max(1e-4,e[0]),k=clamp(room,0,1);return fromOk([L,e[1]*k,e[2]*k]);}
function shadeStep(d){const S=ui.shade;if(!S)return;const i=clamp(S.i+d,-40,48);if(i===S.i)return;const c=shadeAt(S,i);if(toHex(c)===toHex(shadeAt(S,S.i)))return;/* already black or white */
  S.i=i;const keep=ui.bg;setFG(c);ui.bg=keep;refreshColor();}
function renderRecent(){const r=$('#recent');r.replaceChildren();if(!ui.recent.length){r.append(el('span',{class:'none',text:'Colors you paint with appear here'}));return;}
  for(const hx of ui.recent)r.append(el('button',{style:'background:'+hx,title:hx,'aria-label':'Use '+hx,onclick:()=>setFG(fromHex(hx))}));}
function dragOn(c,fn){c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);fn(e);
  /* a missed button release must not leave the drag running (the colour would follow the pointer around) */
  const end=()=>{c.removeEventListener('pointermove',mv);c.removeEventListener('pointerup',end);c.removeEventListener('pointercancel',end);c.removeEventListener('lostpointercapture',end);window.removeEventListener('blur',end);};
  const mv=ev=>{if(!ev.buttons){end();return;}fn(ev);};
  c.addEventListener('pointermove',mv);c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);c.addEventListener('lostpointercapture',end);window.addEventListener('blur',end);});}
dragOn(svC,e=>{const r=svC.getBoundingClientRect();setHSV(ui.hsv[0],clamp((e.clientX-r.left)/r.width,0,1),clamp(1-(e.clientY-r.top)/r.height,0,1));});
dragOn(hueC,e=>{const r=hueC.getBoundingClientRect();setHSV(clamp((e.clientX-r.left)/r.width,0,1)*359.9,ui.hsv[1],ui.hsv[2]);});
function swapColors(){const t=ui.fg;ui.fg=ui.bg;ui.bg=t;setFG(ui.fg);}
$('#swBG').addEventListener('click',swapColors);
$('#swFG').addEventListener('click',()=>$('#hex').focus());
$('#hex').addEventListener('change',e=>{const c=fromHex(e.target.value);if(c)setFG(c);else{toast('Enter a hex color like #d99f5a');e.target.value=toHex(ui.fg);}});
$('#hex').addEventListener('keydown',e=>{if(e.key==='Enter')e.target.blur();});

function pickAt(x,y){
  const W=doc.w,H=doc.h;x=Math.floor(x);y=Math.floor(y);if(doc.wrap){x=mod(x,W);y=mod(y,H);}if(x<0||y<0||x>=W||y>=H)return;
  if(dirtyComp){composite();dirtyComp=false;}
  gl.bindFramebuffer(gl.FRAMEBUFFER,compOut.fbo);let px;
  if(compOut.depth===16){const f=new Float32Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.FLOAT,f);px=Array.from(f);}
  else{const u=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,u);px=Array.from(u,v=>v/255);}
  if(px[3]<.002)return;setFG([px[0]/px[3],px[1]/px[3],px[2]/px[3]].map(v=>clamp(v,0,1)));
}
