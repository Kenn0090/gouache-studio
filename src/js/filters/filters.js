/* ================= Filters and adjustments =================
   Every one previews live on the canvas (unless previews are off), works on the map being viewed,
   and stays inside the selection. fxDialog is filterDialog with room for custom controls. */
const FX={};function fxDef(id,o){o.id=id;o.checks=[...(o.checks||[]),['uvWrap','UV wrap',true]];const render=o.render;if(render)o.render=(src,dst,v,ctx)=>withUVWrap(!v||v.uvWrap!==false,[src],()=>render(src,dst,v,ctx));FX[id]=o;return o;}
/* starting settings of a filter */
function fxDefaults(o){const v={};for(const d of o.defs||[])v[d.key]=d.value;for(const [k,,on] of o.checks||[])v[k]=on;if(o.init)Object.assign(v,o.init());return v;}
/* settings as saved (no caches) */
const fxClean=v=>JSON.parse(JSON.stringify(v,(k,x)=>k[0]==='_'?undefined:x));
/* the controls of a filter, shared by the one-off dialog and the filter layer editor */
function fxControls(o,v,upd,ctx){const body=[],sliders=[];
  if(o.note)body.push(el('p',{class:'note',text:o.note}));
  if(o.controls)body.push(...o.controls(v,upd,ctx));
  for(const d of o.defs||[]){const s=makeSlider(Object.assign({},d,{value:v[d.key],id:'fx_'+d.key,onInput:x=>{v[d.key]=x;upd();}}));sliders.push([s,d]);body.push(s.el);}
  for(const [key,label] of o.checks||[])body.push(chk('fx_'+key,label,key==='uvWrap'?v[key]!==false:!!v[key],x=>{v[key]=x;upd();}));
  const reset=sliders.length?el('button',{class:'btn sm',text:'Reset',onclick:()=>{for(const [s,d] of sliders){v[d.key]=d.value;s.set(d.value);}upd();}}):null;
  return {body,reset};}
/* one-off filter on the active layer (or mask); "Keep editable" makes a filter layer instead */
function fxDialog(o){if(typeof o==='string')o=FX[o];const et=needTarget();if(!et)return;const L=et.L;if(!effVisible(et.node)){toast('Show the active layer before filtering it.');return;}
  const v=fxDefaults(o);const ctx={src:L.target};
  const body=el('div',{class:'dlg-grid'});let keep=false;
  const draw=()=>{o.render(L.target,previewT,v,ctx);chanLimit(et);selLimit(et);};
  /* slider moves are gathered into one redraw per frame */
  let pend=0;const upd=()=>{if(pend)return;pend=requestAnimationFrame(()=>{pend=0;if(preview&&!preview.off){draw();requestRender(true);}});};
  const c=fxControls(o,v,upd,ctx);body.append(...c.body);
  body.append(el('div',{class:'frow'},c.reset,el('span',{class:'note',text:'Previewing on “'+et.node.name+'”'+(et.isMask?' (mask)':doc.map!=='base'?' ('+MAP_DEFS[doc.map].label.toLowerCase()+')':'')})));
  const canKeep=!et.isMask&&!L.quick&&!o.noLayer&&ui.mode!=='anim';
  if(canKeep)body.append(chk('fxKeep','Keep editable (adds a filter layer clipped to this layer)',false,x=>{keep=x;}));
  body.append(previewChk('fxPrev',prefs.livePreview,x=>{if(!preview)return;preview.off=!x;if(x)draw();requestRender(true);}));
  preview={L:et.node,isMask:et.isMask,et,off:!prefs.livePreview};upd();
  openDialog({title:o.title,body,float:true,wide:!!o.wide,okLabel:'Apply',onOk(){cancelAnimationFrame(pend);pend=0;
      if(keep){preview=null;addFxLayer(o.id,fxClean(v),et.node,true);return;}
      if(preview.off||pend)draw();else draw();applyPreview(o.label||o.title);},
    onCancel(){cancelAnimationFrame(pend);pend=0;preview=null;requestRender(true);}});}
/* one-step filters without settings */
function fxNow(id){const o=FX[id],et=needTarget();if(!et)return;preview={L:et.node,isMask:et.isMask,et};o.render(et.L.target,previewT,fxDefaults(o),{});chanLimit(et);selLimit(et);applyPreview(o.title);}
const px=v=>v+'px',deg=v=>Math.round(v)+'°',sgnF=v=>(v>0?'+':'')+v;

/* ---- lookup tables (Levels, Curves) ---- */
let fxLut=null;
function uploadFxLut(rgbm){if(!fxLut){fxLut=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,fxLut);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
  const d=new Float32Array(256*4);for(let i=0;i<256;i++)for(let c=0;c<4;c++)d[i*4+c]=rgbm[c][i];
  gl.bindTexture(gl.TEXTURE_2D,fxLut);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,256,1,0,gl.RGBA,gl.FLOAT,d);return fxLut;}
const identity=()=>Array.from({length:256},(_,i)=>i/255);
/* brightness histogram of a layer (R, G, B, luminance), from a small copy */
function histogramOf(t){const S=256,sm=makeTargetRaw(S,S),s=Math.min(1,S/Math.max(doc.w,doc.h));
  run(P.resample,sm,{uSrc:t.tex,uOffset:[0,0],uScale:[doc.w/S,doc.h/S],uTaps:{int:Math.min(8,Math.ceil(Math.max(doc.w,doc.h)/S))}});
  const u=new Uint8Array(S*S*4);gl.bindFramebuffer(gl.FRAMEBUFFER,sm.fbo);gl.readPixels(0,0,S,S,gl.RGBA,gl.UNSIGNED_BYTE,u);gl.bindFramebuffer(gl.FRAMEBUFFER,null);disposeTarget(sm);
  const h=[new Float32Array(256),new Float32Array(256),new Float32Array(256),new Float32Array(256)];
  for(let i=0;i<u.length;i+=4){const a=u[i+3];if(a<8)continue;const r=Math.min(255,u[i]*255/a|0),g=Math.min(255,u[i+1]*255/a|0),b=Math.min(255,u[i+2]*255/a|0);h[0][r]++;h[1][g]++;h[2][b]++;h[3][Math.round(r*.2126+g*.7152+b*.0722)]++;}
  return h;}
function drawHist(x,W,H,h,color){let mx=1;const s=[...h].sort((a,b)=>a-b);mx=Math.max(1,s[250]*1.2);x.fillStyle=color;
  for(let i=0;i<256;i++){const v=Math.min(1,h[i]/mx)*H;x.fillRect(i*W/256,H-v,W/256+.5,v);}}
const CH_NAMES=[['m','RGB'],['r','Red'],['g','Green'],['b','Blue']];


/* histogram for Levels / Curves: of the layer being filtered, or (filter layers) of the whole map */
const histOf=ctx=>ctx._h||(ctx._h=histogramOf(ctx.src||freshMapComposite()));
function freshMapComposite(){const t=compositeMap(doc.map);setTimeout(()=>release(t),0);return t;}
const levelsCurve=p=>{const [ib,g,iw,ob,ow]=p;return identity().map(x=>{let t=clamp((x-ib)/Math.max(1e-4,iw-ib),0,1);t=Math.pow(t,1/g);return ob+(ow-ob)*t;});};
/* Levels: input black / gamma / white and output black / white, for all channels or one */
fxDef('levels',{title:'Levels',init:()=>({lv:{m:[0,1,1,0,1],r:[0,1,1,0,1],g:[0,1,1,0,1],b:[0,1,1,0,1]}}),
  controls:(v,upd,ctx)=>{let ch='m';const lv=v.lv,cv=el('canvas',{class:'histo',width:256,height:90,'aria-label':'Histogram'});
    const drawH=()=>{const x=cv.getContext('2d'),h=histOf(ctx);x.clearRect(0,0,256,90);drawHist(x,256,90,h[ch==='m'?3:'rgb'.indexOf(ch)],'rgba(200,205,215,.7)');};
    const S=(id,label,i,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:lv[ch][i],fmt,numericScale:i===1?1:255,onInput:x=>{lv[ch][i]=i===0?Math.min(x,lv[ch][2]-.0001):i===2?Math.max(x,lv[ch][0]+.0001):x;upd();}});
    const box=el('div',{class:'dlg-grid'});
    let mode=(()=>{try{return localStorage.getItem('gs.lvMode')||'simple';}catch(e){return 'simple';}})();
    const build=()=>{if(mode==='simple'){box.replaceChildren(lvSimple(lv[ch],upd,cv));cv.hidden=true;drawH();return;}cv.hidden=false;box.replaceChildren(...[S('lvIb','Input black',0,0,1,.005,x=>Math.round(x*255)),S('lvG','Midtones',1,.1,5,.01,x=>x.toFixed(2)),S('lvIw','Input white',2,0,1,.005,x=>Math.round(x*255)),
        S('lvOb','Output black',3,0,1,.005,x=>Math.round(x*255)),S('lvOw','Output white',4,0,1,.005,x=>Math.round(x*255))].map(s=>s.el));drawH();};
    const chs=seg(CH_NAMES.map(([k,l])=>[k,l]),ch,k=>{ch=k;build();},'Channel');build();
    const auto=el('button',{class:'btn sm',text:'Auto',title:'Stretch the darkest and lightest 0.1% to black and white',onclick:()=>{const h=histOf(ctx)[3],n=h.reduce((a,b)=>a+b,0);let a=0,lo=0,hi=255;
      for(let i=0;i<256;i++){a+=h[i];if(a>n*.001){lo=i;break;}}a=0;for(let i=255;i>=0;i--){a+=h[i];if(a>n*.001){hi=i;break;}}lv.m[0]=lo/255;lv.m[2]=Math.max(lo+1,hi)/255;ch='m';build();upd();}});
    const modeSeg=seg([['simple','Simple'],['sliders','Sliders']],mode,m=>{mode=m;try{localStorage.setItem('gs.lvMode',m);}catch(e){}build();},'Levels layout');
    return [el('div',{class:'row wrap'},chs,modeSeg),cv,box,el('div',{class:'frow'},auto)];},
  render(src,dst,v){const lv=v.lv;run(P.f_lut,dst,{uSrc:src.tex,uLut:uploadFxLut([levelsCurve(lv.r),levelsCurve(lv.g),levelsCurve(lv.b),levelsCurve(lv.m)])});}});

/* the simple Levels layout (like Substance Painter's): the histogram with three handles under it (black, midtones,
   white) and the output bar with two (drag them past each other to invert). p = [inBlack, gamma, inWhite, outBlack, outWhite] */
function lvSimple(p,upd,hcv){const W=256,cv=el('canvas',{class:'lvsimple',width:W,height:132,role:'img','aria-label':'Levels: drag the handles'});
  const X0=8,IW=W-16,HY=0,HH=86,TY=90,OY=110,midPos=()=>p[0]+(p[2]-p[0])*Math.pow(.5,p[1]);
  const draw=()=>{const x=cv.getContext('2d');x.clearRect(0,0,W,132);x.drawImage(hcv,0,0,256,90,X0,HY,IW,HH);
    const g=x.createLinearGradient(X0,0,X0+IW,0);g.addColorStop(0,'#000');g.addColorStop(1,'#fff');x.fillStyle=g;x.fillRect(X0,OY,IW,10);
    const og=x.createLinearGradient(X0+IW*p[3],0,X0+IW*p[4],0);og.addColorStop(0,'#000');og.addColorStop(1,'#fff');
    const tri=(v,y,fill)=>{const cx=X0+IW*v;x.beginPath();x.moveTo(cx,y);x.lineTo(cx-6,y+10);x.lineTo(cx+6,y+10);x.closePath();x.fillStyle=fill;x.fill();x.strokeStyle='#888';x.lineWidth=1;x.stroke();};
    x.strokeStyle='rgba(128,128,128,.5)';x.beginPath();x.moveTo(X0,TY+5);x.lineTo(X0+IW,TY+5);x.stroke();
    tri(p[0],TY,'#000');tri(midPos(),TY,'#888');tri(p[2],TY,'#fff');tri(p[3],OY+10,'#000');tri(p[4],OY+10,'#fff');
    x.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted')||'#999';x.font='10px sans-serif';x.textAlign='center';
    x.fillText(Math.round(p[0]*255)+'  ·  '+p[1].toFixed(2)+'  ·  '+Math.round(p[2]*255)+'      out '+Math.round(p[3]*255)+' – '+Math.round(p[4]*255),W/2,131);};
  let drag=null;const at=e=>{const r=cv.getBoundingClientRect();return [(e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*132];};
  cv.addEventListener('pointerdown',e=>{const [mx,my]=at(e),v=clamp((mx-X0)/IW,0,1);
    const cand=my>=OY?[[3,p[3]],[4,p[4]]]:[[0,p[0]],['m',midPos()],[2,p[2]]];let best=null,bd=1e9;for(const [k,x] of cand){const d=Math.abs(x-v);if(d<bd){bd=d;best=k;}}
    drag=best;cv.setPointerCapture(e.pointerId);e.preventDefault();});
  cv.addEventListener('pointermove',e=>{if(drag===null)return;const v=clamp((at(e)[0]-X0)/IW,0,1);
    if(drag===0)p[0]=Math.min(v,p[2]-.004);else if(drag===2)p[2]=Math.max(v,p[0]+.004);
    else if(drag==='m'){const t=clamp((v-p[0])/Math.max(1e-4,p[2]-p[0]),.01,.99);p[1]=clamp(Math.log(t)/Math.log(.5),.1,5);}
    else p[drag]=v;draw();upd();});
  const end=()=>{drag=null;};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  const inv=el('button',{class:'btn sm',text:'Invert',title:'Swap the output black and white',onclick:()=>{[p[3],p[4]]=[p[4],p[3]];draw();upd();}});
  const reset=el('button',{class:'btn sm',text:'Reset',onclick:()=>{p.splice(0,5,0,1,1,0,1);draw();upd();}});
  requestAnimationFrame(draw);return el('div',{class:'dlg-grid'},cv,el('div',{class:'chips'},inv,reset),el('p',{class:'note',text:'Drag the handles under the histogram (black, midtones, white) and on the output bar.'}));}
/* Curves: points per channel, smooth monotone curve through them */
function monotone(pts){pts=pts.slice().sort((a,b)=>a[0]-b[0]);const n=pts.length;if(n<2)return identity();
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),d=[],m=[];for(let i=0;i<n-1;i++)d.push((ys[i+1]-ys[i])/Math.max(1e-6,xs[i+1]-xs[i]));
  m[0]=d[0];m[n-1]=d[n-2];for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
  for(let i=0;i<n-1;i++){if(d[i]===0){m[i]=m[i+1]=0;continue;}const a=m[i]/d[i],b=m[i+1]/d[i],s=a*a+b*b;if(s>9){const t=3/Math.sqrt(s);m[i]=t*a*d[i];m[i+1]=t*b*d[i];}}
  return identity().map(x=>{if(x<=xs[0])return ys[0];if(x>=xs[n-1])return ys[n-1];let k=0;while(k<n-2&&x>xs[k+1])k++;const h=xs[k+1]-xs[k],t=(x-xs[k])/h,t2=t*t,t3=t2*t;
    return clamp((2*t3-3*t2+1)*ys[k]+(t3-2*t2+t)*h*m[k]+(-2*t3+3*t2)*ys[k+1]+(t3-t2)*h*m[k+1],0,1);});}
fxDef('curves',{title:'Curves',note:'Click the curve to add a point, drag to move it, drag it off the box to remove it.',init:()=>({pts:{m:[[0,0],[1,1]],r:[[0,0],[1,1]],g:[[0,0],[1,1]],b:[[0,0],[1,1]]}}),
  controls:(v,upd,ctx)=>{let ch='m';const pts=v.pts,S=256,cv=el('canvas',{class:'curves',width:S,height:S,tabindex:'0','aria-label':'Curve'});let drag=null;
    const col={m:'#e8eaed',r:'#ff6b6b',g:'#69db7c',b:'#74c0fc'};
    const paint=()=>{const x=cv.getContext('2d');x.clearRect(0,0,S,S);x.fillStyle='rgba(255,255,255,.03)';x.fillRect(0,0,S,S);
      drawHist(x,S,S,histOf(ctx)[ch==='m'?3:'rgb'.indexOf(ch)],'rgba(160,165,175,.28)');x.strokeStyle='rgba(255,255,255,.08)';x.lineWidth=1;
      for(let i=1;i<4;i++){x.beginPath();x.moveTo(i*S/4,0);x.lineTo(i*S/4,S);x.moveTo(0,i*S/4);x.lineTo(S,i*S/4);x.stroke();}
      x.beginPath();x.moveTo(0,S);x.lineTo(S,0);x.stroke();
      for(const [k] of CH_NAMES){if(k!==ch&&pts[k].length===2&&pts[k][0].join()==='0,0'&&pts[k][1].join()==='1,1')continue;const c=monotone(pts[k]);x.strokeStyle=k===ch?col[k]:col[k]+'55';x.lineWidth=k===ch?2:1;x.beginPath();c.forEach((y,i)=>i?x.lineTo(i*S/255,S-y*S):x.moveTo(0,S-y*S));x.stroke();}
      x.fillStyle=col[ch];for(const [px2,py] of pts[ch]){x.beginPath();x.arc(px2*S,S-py*S,4,0,7);x.fill();}};
    const at=e=>{const r=cv.getBoundingClientRect();return [(e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height];};
    cv.addEventListener('pointerdown',e=>{const [x,y]=at(e);const P2=pts[ch];let i=P2.findIndex(p=>Math.hypot(p[0]-x,p[1]-y)<.04);
      if(i<0){const np=[clamp(x,0,1),clamp(y,0,1)];P2.push(np);P2.sort((a,b)=>a[0]-b[0]);i=P2.indexOf(np);}
      drag=P2[i];cv.setPointerCapture(e.pointerId);paint();upd();});
    cv.addEventListener('pointermove',e=>{if(!drag)return;const [x,y]=at(e),P2=pts[ch];const out=x<-.08||x>1.08||y<-.08||y>1.08;
      if(out&&P2.length>2){P2.splice(P2.indexOf(drag),1);drag=null;paint();upd();return;}
      const i=P2.indexOf(drag),lo=i>0?P2[i-1][0]+.004:0,hi=i<P2.length-1?P2[i+1][0]-.004:1;drag[0]=clamp(x,lo,hi);drag[1]=clamp(y,0,1);paint();upd();});
    cv.addEventListener('pointerup',()=>{drag=null;});
    const chs=seg(CH_NAMES.map(([k,l])=>[k,l]),ch,k=>{ch=k;paint();},'Channel');
    const reset=el('button',{class:'btn sm',text:'Reset channel',onclick:()=>{pts[ch]=[[0,0],[1,1]];paint();upd();}});
    const pres=el('select',{id:'cvPre','aria-label':'Preset'},...[['','Presets…'],['s','S-curve (more contrast)'],['l','Lighter'],['d','Darker'],['i','Invert'],['f','Flatten (less contrast)']].map(([k,l])=>el('option',{value:k,text:l})));
    pres.addEventListener('change',()=>{const P0={s:[[0,0],[.25,.18],[.75,.82],[1,1]],l:[[0,0],[.5,.62],[1,1]],d:[[0,0],[.5,.38],[1,1]],i:[[0,1],[1,0]],f:[[0,.12],[1,.88]]}[pres.value];if(P0){pts[ch]=P0.map(p=>p.slice());paint();upd();}pres.value='';});
    setTimeout(paint,0);return [chs,cv,el('div',{class:'frow'},pres,reset)];},
  render(src,dst,v){const p=v.pts;run(P.f_lut,dst,{uSrc:src.tex,uLut:uploadFxLut([monotone(p.r),monotone(p.g),monotone(p.b),monotone(p.m)])});}});

fxDef('hueSat',{title:'Hue / Saturation',defs:[{key:'h',label:'Hue',min:-180,max:180,step:1,value:0,fmt:v=>(v>0?'+':'')+v+'°'},{key:'s',label:'Saturation',min:-100,max:100,step:1,value:0,fmt:v=>(v>0?'+':'')+v},{key:'l',label:'Lightness',min:-100,max:100,step:1,value:0,fmt:v=>(v>0?'+':'')+v}],
  checks:[['c','Colorize',false]],render(src,dst,v){run(P.f_hsl,dst,{uSrc:src.tex,uHue:v.c?((v.h+360)%360)/360:v.h/360,uSat:v.c?(v.s+100)/200:v.s/100,uLight:v.l/100,uColorize:!!v.c});}});
fxDef('gradMap',{title:'Gradient map',note:'Replaces each brightness with a colour from the gradient: dark to the left end, light to the right.',
  init:()=>({pick:2,def:null}),checks:[['rev','Reverse',false]],
  controls:(v,upd)=>{const s=el('select',{id:'gmSel'},el('option',{value:'cur',text:'Current gradient (Gradient tool)'}),...GRAD_BUILTIN.map((p,i)=>el('option',{value:i,text:p.name})));s.value=String(v.pick);
    const set=()=>{v.pick=s.value==='cur'?'cur':+s.value;v.def=cloneGrad(v.pick==='cur'?ui.grad:presetDef(GRAD_BUILTIN[v.pick]));};if(!v.def)set();
    s.addEventListener('change',()=>{set();upd();});return [el('div',{class:'frow'},el('label',{for:'gmSel',text:'Gradient'}),s)];},
  render(src,dst,v){const def=v.def||presetDef(GRAD_BUILTIN[2]);run(P.f_gmap,dst,{uSrc:src.tex,uLut:uploadLut(def),uRev:!!v.rev,uDither:!!def.dither&&dst.depth===8});}});
fxDef('threshold',{title:'Threshold',defs:[{key:'t',label:'Level',min:1,max:255,step:1,value:128}],render(src,dst,v){run(P.f_thresh,dst,{uSrc:src.tex,uT:v.t/255});}});
fxDef('desat',{title:'Desaturate',render(src,dst){run(P.f_desat,dst,{uSrc:src.tex});}});
fxDef('invert',{title:'Invert',render(src,dst){run(P.invert,dst,{uSrc:src.tex});}});
fxDef('posterize',{title:'Posterize',defs:[{key:'n',label:'Levels',min:2,max:32,step:1,value:6}],render(src,dst,v){run(P.poster,dst,{uSrc:src.tex,uLevels:v.n});}});
fxDef('colorAdj',{title:'Color adjustments',defs:[
  {key:'exposure',label:'Exposure',min:-3,max:3,step:.05,value:0,fmt:v=>(v>0?'+':'')+v.toFixed(1)+' EV'},{key:'bright',label:'Brightness',min:-100,max:100,step:1,value:0,fmt:sgnF},
  {key:'contrast',label:'Contrast',min:-100,max:100,step:1,value:0,fmt:sgnF},{key:'sat',label:'Saturation',min:-100,max:100,step:1,value:0,fmt:sgnF},
  {key:'hue',label:'Hue',min:-180,max:180,step:1,value:0,fmt:v=>sgnF(v)+'°'},{key:'temp',label:'Temperature',min:-100,max:100,step:1,value:0,fmt:sgnF}],
  render(src,dst,v){run(P.adjust,dst,{uSrc:src.tex,uExposure:v.exposure,uBright:v.bright/200,uContrast:1+v.contrast/100,uSat:1+v.sat/100,uHue:v.hue*Math.PI/180,uTemp:v.temp/100});}});

/* ---- palettes (Cutout, Quantize): k-means on a small copy of the image ---- */
function paletteOf(t,k){const S=96,sm=makeTargetRaw(S,S);run(P.resample,sm,{uSrc:t.tex,uOffset:[0,0],uScale:[doc.w/S,doc.h/S],uTaps:{int:Math.min(8,Math.ceil(Math.max(doc.w,doc.h)/S))}});
  const u=new Uint8Array(S*S*4);gl.bindFramebuffer(gl.FRAMEBUFFER,sm.fbo);gl.readPixels(0,0,S,S,gl.RGBA,gl.UNSIGNED_BYTE,u);gl.bindFramebuffer(gl.FRAMEBUFFER,null);disposeTarget(sm);
  const pts=[];for(let i=0;i<u.length;i+=4){const a=u[i+3];if(a<16)continue;pts.push([u[i]/a,u[i+1]/a,u[i+2]/a]);}
  if(!pts.length)return [[0,0,0]];k=Math.min(k,pts.length);
  const d2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;const cs=[pts[0].slice()];const dist=pts.map(p=>d2(p,cs[0]));
  while(cs.length<k){let bi=0,bd=-1;for(let i=0;i<pts.length;i++)if(dist[i]>bd){bd=dist[i];bi=i;}cs.push(pts[bi].slice());for(let i=0;i<pts.length;i++)dist[i]=Math.min(dist[i],d2(pts[i],pts[bi]));}
  for(let it=0;it<12;it++){const sum=cs.map(()=>[0,0,0,0]);for(const p of pts){let bi=0,bd=1e9;for(let j=0;j<cs.length;j++){const e=d2(p,cs[j]);if(e<bd){bd=e;bi=j;}}const s=sum[bi];s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];s[3]++;}
    cs.forEach((c,j)=>{const s=sum[j];if(s[3]){c[0]=s[0]/s[3];c[1]=s[1]/s[3];c[2]=s[2]/s[3];}});}
  return cs;}
const palU=(cs,n)=>{const a=new Float32Array(n*3);cs.forEach((c,i)=>a.set(c,i*3));return {v3:a};};
/* the palette is worked out once per setting (not every frame): "Pick colours again" refreshes it */
const palBtn=(v,upd)=>el('button',{class:'btn sm',text:'Pick colours again',title:'Choose the palette again from the current image',onclick:()=>{v._pal=null;v.pal=null;upd();}});
fxDef('cutout',{title:'Cutout',note:'Flattens the image into a few colours with simplified edges.',
  defs:[{key:'n',label:'Number of levels',min:2,max:8,step:1,value:5},{key:'simp',label:'Edge simplicity',min:0,max:10,step:1,value:4},{key:'fid',label:'Edge fidelity',min:1,max:3,step:1,value:2}],
  controls:(v,upd)=>[el('div',{class:'frow'},palBtn(v,upd))],
  render(src,dst,v){const sm=acquire(),r=Math.max(.5,v.simp*.9);gaussian(src,sm,r);
    const key=v.n+'|'+v.simp;if(!v.pal||v.palKey!==key){v.pal=paletteOf(sm,v.n);v.palKey=key;}const pal=v.pal;
    const a=acquireD(8),b=acquireD(8);run(P.f_pal,a,{uSrc:sm.tex,uPal:palU(pal,16),uN:{int:pal.length}});
    const R=Math.round(v.simp*.6)+1,passes=Math.max(1,4-v.fid);
    let x=a,y=b;for(let i=0;i<passes;i++){run(P.f_vote,y,{uL:x.tex,uR:{int:Math.min(6,R)},uWrap:!!doc.wrap});[x,y]=[y,x];}
    run(P.f_paint,dst,{uSrc:src.tex,uL:x.tex,uPal:palU(pal,16)});release(a);release(b);release(sm);}});
fxDef('quantize',{title:'Quantize',note:'Reduces the image to a palette of colours chosen from it.',
  defs:[{key:'n',label:'Colours',min:2,max:64,step:1,value:8},{key:'d',label:'Dither',min:0,max:1,step:.01,value:0,fmt:pct}],
  controls:(v,upd)=>[el('div',{class:'frow'},palBtn(v,upd))],
  render(src,dst,v){if(!v.pal||v.palKey!==v.n){v.pal=paletteOf(src,v.n);v.palKey=v.n;}const pal=v.pal;
    run(P.f_quant,dst,{uSrc:src.tex,uPal:palU(pal,64),uN:{int:pal.length},uDither:v.d*.9/Math.cbrt(pal.length)});}});

/* ---- blur and sharpen ---- */
fxDef('blur',{title:'Gaussian blur',defs:[{key:'r',label:'Radius',min:.5,max:100,step:.5,value:6,fmt:px}],render(src,dst,v){gaussian(src,dst,v.r);}});
fxDef('sharpen',{title:'Sharpen',defs:[{key:'a',label:'Amount',min:0,max:3,step:.05,value:.8,fmt:pct},{key:'r',label:'Radius',min:.5,max:12,step:.5,value:1.5,fmt:px}],
  render(src,dst,v){const b=acquire();gaussian(src,b,v.r);run(P.sharpen,dst,{uSrc:src.tex,uBlur:b.tex,uAmount:v.a});release(b);}});
fxDef('surfBlur',{title:'Surface blur',heavy:true,note:'Smooths areas of similar colour but keeps edges sharp.',defs:[{key:'r',label:'Radius',min:1,max:12,step:1,value:5,fmt:px},{key:'t',label:'Threshold',min:1,max:100,step:1,value:20}],
  render(src,dst,v){run(P.f_surface,dst,{uSrc:src.tex,uR:{int:v.r},uT:v.t/255*2.2,uWrap:!!doc.wrap});}});
fxDef('boxBlur',{title:'Box blur',note:'An even, flat blur: every pixel in the box counts the same.',defs:[{key:'x',label:'Width',min:0,max:256,step:1,value:6,fmt:px},{key:'y',label:'Height',min:0,max:256,step:1,value:6,fmt:px}],
  render(src,dst,v){const t=acquire();run(P.f_box,t,{uSrc:src.tex,uDir:[1,0],uR:{int:v.x},uWrap:!!doc.wrap});run(P.f_box,dst,{uSrc:t.tex,uDir:[0,1],uR:{int:v.y},uWrap:!!doc.wrap});release(t);}});
fxDef('radialBlur',{title:'Radial blur',init:()=>({zoom:0}),controls:(v,upd)=>[seg([[0,'Spin'],[1,'Zoom']],v.zoom,x=>{v.zoom=x;upd();},'Method')],
  defs:[{key:'a',label:'Amount',min:0,max:100,step:1,value:12},{key:'cx',label:'Centre across',min:0,max:100,step:1,value:50,fmt:v=>v+'%'},{key:'cy',label:'Centre down',min:0,max:100,step:1,value:50,fmt:v=>v+'%'}],
  render(src,dst,v){run(P.f_radial,dst,{uSrc:src.tex,uC:[doc.w*v.cx/100,doc.h*v.cy/100],uAmt:v.zoom?v.a/100:v.a/100*1.2,uZoom:{int:v.zoom}});}});
fxDef('lensBlur',{title:'Lens blur',heavy:true,note:'Blurs like an out-of-focus camera lens: bright spots open up into soft discs or six-sided highlights.',init:()=>({shape:1}),
  controls:(v,upd)=>[el('div',{class:'sub',text:'Highlight shape'}),seg([[1,'Hexagon'],[0,'Round']],v.shape,x=>{v.shape=x;upd();},'Shape')],
  defs:[{key:'r',label:'Radius',min:1,max:80,step:.5,value:12,fmt:px},{key:'b',label:'Highlight glow',min:0,max:4,step:.05,value:1.2,fmt:pct},{key:'t',label:'Highlight threshold',min:0,max:.95,step:.01,value:.7,fmt:pct},{key:'rot',label:'Rotation',min:0,max:60,step:1,value:0,fmt:deg}],
  render(src,dst,v){run(P.f_lens,dst,{uSrc:src.tex,uR:v.r,uBoost:v.b,uThr:v.t,uShape:{int:v.shape},uRot:v.rot*Math.PI/180});}});
fxDef('motionBlur',{title:'Motion blur',defs:[{key:'a',label:'Angle',min:-180,max:180,step:1,value:0,fmt:deg},{key:'d',label:'Distance',min:1,max:200,step:1,value:20,fmt:px}],
  render(src,dst,v){const r=v.a*Math.PI/180;run(P.f_motion,dst,{uSrc:src.tex,uDir:[Math.cos(r),-Math.sin(r)],uLen:v.d});}});
fxDef('highPass',{title:'High pass',note:'Keeps only detail smaller than the radius, around mid-grey. Set the layer to Overlay to sharpen.',defs:[{key:'r',label:'Radius',min:.5,max:100,step:.5,value:8,fmt:px}],
  render(src,dst,v){const b=acquire();gaussian(src,b,v.r);run(P.f_highpass,dst,{uSrc:src.tex,uBlur:b.tex});release(b);}});

/* ---- painterly ---- */
fxDef('oilPaint',{title:'Oil paint',heavy:true,note:'Each spot takes the calmest nearby colour, giving flat dabs of paint.',defs:[{key:'r',label:'Brush size',min:1,max:10,step:1,value:4,fmt:px},{key:'p',label:'Passes',min:1,max:3,step:1,value:1}],
  render(src,dst,v){const a=acquire(),b=acquire();let s=src;for(let i=0;i<v.p;i++){const d=i===v.p-1?dst:(i%2?b:a);run(P.f_kuwa,d,{uSrc:s.tex,uR:{int:v.r},uWrap:!!doc.wrap});s=d;}release(a);release(b);}});
fxDef('painterly',{title:'Painterly',heavy:true,note:'Turns the image into brush strokes that follow its shapes.',
  defs:[{key:'r',label:'Stroke size',min:2,max:12,step:.5,value:5,fmt:px},{key:'q',label:'Sharpness',min:2,max:16,step:1,value:8},{key:'flow',label:'Stroke flow',min:0,max:8,step:.5,value:2,fmt:px},{key:'p',label:'Passes',min:1,max:3,step:1,value:1}],
  render(src,dst,v){const T=acquireD(canFloat?16:doc.depth),T2=acquireD(T.depth),a=acquire(),b=acquire();let s=src;
    for(let i=0;i<v.p;i++){run(P.f_tensor,T,{uSrc:s.tex,uWrap:!!doc.wrap});if(v.flow>.25){gaussian(T,T2,v.flow);blit(T2,T,0,0,doc.w,doc.h,0,0);}
      const d=i===v.p-1?dst:(i%2?b:a);run(P.f_akuwa,d,{uSrc:s.tex,uT:T.tex,uR:v.r,uQ:v.q,uWrap:!!doc.wrap});s=d;}
    release(T);release(T2);release(a);release(b);}});
/* Mosaic: square tiles of one colour, with grout lines if you want them */
fxDef('mosaic',{title:'Mosaic',init:()=>({gc:'bg',gcol:null}),defs:[{key:'c',label:'Cell size',min:2,max:128,step:1,value:12,fmt:px},{key:'g',label:'Grout',min:0,max:12,step:.5,value:0,fmt:px},{key:'bv',label:'Bevel',min:0,max:1,step:.01,value:0,fmt:pct}],
  controls:(v,upd)=>{const pick=x=>{v.gc=x;v.gcol=x==='clear'?[0,0,0,0]:[...(x==='fg'?ui.fg:ui.bg),1];upd();};if(!v.gcol)v.gcol=[...ui.bg,1];
    return [el('div',{class:'sub',text:'Grout colour'}),seg([['bg','Background colour'],['fg','Foreground colour'],['clear','Transparent']],v.gc,pick,'Grout colour')];},
  render(src,dst,v){run(P.f_mosaic,dst,{uSrc:src.tex,uCell:v.c,uGrout:v.g,uGC:v.gcol||[1,1,1,1],uBevel:v.bv});}});

/* ---- stylize ---- */
fxDef('emboss',{title:'Emboss',defs:[{key:'a',label:'Angle',min:-180,max:180,step:1,value:135,fmt:deg},{key:'h',label:'Height',min:1,max:10,step:1,value:2,fmt:px},{key:'amt',label:'Amount',min:.1,max:5,step:.05,value:1.5,fmt:pct}],
  checks:[['grey','Grey (like Photoshop)',true]],render(src,dst,v){const r=v.a*Math.PI/180;run(P.f_emboss,dst,{uSrc:src.tex,uDir:[Math.cos(r)*v.h,-Math.sin(r)*v.h],uAmt:v.amt,uWrap:!!doc.wrap,uGrey:!!v.grey});}});
fxDef('edges',{title:'Find edges',defs:[{key:'a',label:'Strength',min:.2,max:8,step:.1,value:2,fmt:pct}],checks:[['inv','Dark lines on white',true]],
  render(src,dst,v){run(P.f_edges,dst,{uSrc:src.tex,uAmt:v.a,uWrap:!!doc.wrap,uInv:!!v.inv});}});

/* edge wear: curvature from the document's normal and height (or its Curvature map) put onto colour */
fxDef('edgeWear',{title:'Edge wear',note:'Lightens raised edges and darkens cavities of this layer, following the shape in the Normal and Height maps (or the Curvature map). As a filter layer it follows the shape as you paint.',
  init:()=>({src:'shape',em:0,cm:0,ec:null,cc:null}),
  defs:[{key:'k',label:'Strength',min:.2,max:12,step:.1,value:4,fmt:pct},{key:'r',label:'Width',min:0,max:16,step:.5,value:1.5,fmt:px},{key:'e',label:'Edges',min:0,max:2,step:.01,value:.8,fmt:pct},{key:'c',label:'Cavities',min:0,max:2,step:.01,value:.6,fmt:pct},
    {key:'s',label:'Sharpness',min:.3,max:3,step:.05,value:1,fmt:pct},{key:'sm',label:'Smooth',min:0,max:8,step:.5,value:1,fmt:px}],
  controls:(v,upd)=>{if(!v.ec){v.ec=ui.fg.slice();v.cc=ui.bg.slice();}const out=[el('div',{class:'sub',text:'Shape from'}),seg([['shape','Normal and height maps'],['curv','Curvature map']],v.src,x=>{v.src=x;upd();},'Shape from'),
      el('div',{class:'sub',text:'Edges become'}),seg([[0,'Lighter'],[1,'Foreground colour']],v.em,x=>{v.em=x;if(x===1)v.ec=ui.fg.slice();upd();},'Edges become'),
      el('div',{class:'sub',text:'Cavities become'}),seg([[0,'Darker'],[1,'Background colour']],v.cm,x=>{v.cm=x;if(x===1)v.cc=ui.bg.slice();upd();},'Cavities become')];return out;},
  render(src,dst,v){let c=null;
    if(v.src==='curv'&&doc.maps.includes('curv')){c=compositeMap('curv');}
    else if(doc.maps.includes('height')&&!(doc.maps.includes('normal')&&paintLayers().some(L=>hasMap(L,'normal')))){
      /* height only: curvature from the height itself is smoother than from its 8-bit normal */
      const h=compositeMap('height'),rr=Math.max(1,v.r*2),b1=acquireD(h.depth),b2=acquireD(h.depth);gaussian(h,b1,rr);gaussian(h,b2,rr*3);
      c=acquireD(canFloat?16:doc.depth);run(P.f_curv,c,{uH:h.tex,uB1:b1.tex,uB2:b2.tex,uStr:.5,uMode:{int:0}});release(h);release(b1);release(b2);}
    else if(doc.maps.includes('normal')||doc.maps.includes('height')){const n=normalComposite(false,null),b=acquireD(n.depth);if(v.r>.25)gaussian(n,b,v.r);else blit(n,b,0,0,doc.w,doc.h,0,0);release(n);
      c=acquireD(canFloat?16:doc.depth);run(P.f_ncurv,c,{uN:b.tex,uWrap:!!doc.wrap,uStr:1,uMode:{int:0},uStep:Math.max(1,Math.round(v.r*.7))});release(b);}
    if(!c){blit(src,dst,0,0,doc.w,doc.h,0,0);return;}
    if(v.sm>.25){const t=acquireD(c.depth);gaussian(c,t,v.sm);release(c);c=t;}
    run(P.f_cwear,dst,{uSrc:src.tex,uC:c.tex,uEdge:v.e,uCav:v.c,uEC:v.ec||[1,1,1],uCC:v.cc||[0,0,0],uEM:{int:v.em},uCM:{int:v.cm},uSharp:v.s,uK:v.k==null?4:v.k});release(c);}});

/* ---- noise and generated patterns ---- */
const newSeed=(v,upd)=>el('div',{class:'frow'},el('button',{class:'btn sm',text:'New pattern',onclick:()=>{v.seed=Math.random()*100;upd();}}));
fxDef('noise',{title:'Add noise',init:()=>({seed:Math.random()*100}),defs:[{key:'a',label:'Amount',min:0,max:1,step:.01,value:.15,fmt:pct}],checks:[['mono','Monochrome',true]],
  controls:(v,upd)=>[newSeed(v,upd)],render(src,dst,v){run(P.f_noise,dst,{uSrc:src.tex,uAmt:v.a,uMono:!!v.mono,uSeed:v.seed});}});
/* pattern colours are kept with the settings, so a pattern layer looks the same tomorrow */
const colSeg=(v,upd)=>{if(!v.ca){v.ca=ui.fg.slice();v.cb=ui.bg.slice();}
  return [el('div',{class:'sub',text:'Colours'}),seg([['fgbg','Foreground to background'],['bw','Black to white']],v.col||'fgbg',x=>{v.col=x;if(x==='bw'){v.ca=[0,0,0];v.cb=[1,1,1];}else{v.ca=ui.fg.slice();v.cb=ui.bg.slice();}upd();},'Colours')];};
fxDef('clouds',{title:'Render clouds',gen:true,note:'Soft noise that tiles seamlessly.',init:()=>({seed:Math.random()*100,col:'fgbg'}),
  controls:(v,upd)=>[...colSeg(v,upd),newSeed(v,upd)],
  defs:[{key:'s',label:'Scale',min:1,max:32,step:1,value:4,fmt:v=>v+'×'},{key:'o',label:'Detail',min:1,max:8,step:1,value:5},{key:'r',label:'Roughness',min:.2,max:.8,step:.01,value:.5,fmt:pct},{key:'c',label:'Contrast',min:.2,max:3,step:.05,value:1,fmt:pct}],
  render(src,dst,v){run(P.f_clouds,dst,{uSize:[doc.w,doc.h],uScale:v.s,uOct:{int:v.o},uRough:v.r,uSeed:v.seed,uA:v.ca||ui.fg,uB:v.cb||ui.bg,uContrast:v.c});}});
fxDef('cells',{title:'Render cells',gen:true,note:'Cell (Voronoi) pattern that tiles seamlessly: stones, scales, cracked earth.',init:()=>({seed:Math.random()*100,col:'fgbg',mode:0}),
  controls:(v,upd)=>[...colSeg(v,upd),el('div',{class:'sub',text:'Style'}),seg([[0,'Distance'],[1,'Borders'],[2,'Flat cells']],v.mode,x=>{v.mode=x;upd();},'Style'),newSeed(v,upd)],
  defs:[{key:'s',label:'Cells across',min:1,max:64,step:1,value:8},{key:'j',label:'Randomness',min:0,max:1,step:.01,value:.9,fmt:pct}],
  render(src,dst,v){run(P.f_cells,dst,{uSize:[doc.w,doc.h],uScale:v.s,uSeed:v.seed,uA:v.ca||ui.fg,uB:v.cb||ui.bg,uMode:{int:v.mode},uJit:v.j});}});

/* ---- tiling ---- */
fxDef('offset',{title:'Offset',note:'Slides the image, wrapping around the edges, so you can see and paint over tiling seams.',
  init:()=>({x:Math.round(doc.w/2),y:Math.round(doc.h/2)}),
  controls:(v,upd)=>[makeSlider({id:'fx_x',label:'Horizontal',min:-doc.w,max:doc.w,step:1,value:v.x,fmt:px,onInput:x=>{v.x=x;upd();}}).el,makeSlider({id:'fx_y',label:'Vertical',min:-doc.h,max:doc.h,step:1,value:v.y,fmt:px,onInput:x=>{v.y=x;upd();}}).el],
  render(src,dst,v){run(P.shift,dst,{uSrc:src.tex,uOff:[v.x,v.y],uWrap:true,uOutside:[0,0,0,0]});}});
fxDef('tile',{title:'Tile',note:'Repeats the image across and down, smaller each time. Works on masks too. Check the result with Tile mode.',init:()=>({flip:false,seed:1,uni:true}),
  defs:[{key:'nx',label:'Tiles',min:1,max:32,step:1,value:2,fmt:v=>String(Math.round(v))},{key:'ny',label:'Down',min:1,max:32,step:1,value:2,fmt:v=>String(Math.round(v))},
    {key:'sh',label:'Row offset',min:0,max:1,step:.01,value:0,fmt:pct},{key:'rot',label:'Random rotation',min:0,max:180,step:1,value:0,fmt:v=>Math.round(v)+'°'}],
  /* uniform scale: one count for both directions (the Down slider is then ignored) */
  controls:(v,upd)=>{if(v.uni==null)v.uni=false;const note=el('p',{class:'note',text:v.uni?'Uniform scale: Tiles sets both directions. Untick it to set Across (Tiles) and Down separately.':'Tiles is across, Down is down.'});
    return [el('div',{class:'chips'},chk('fx_tuni','Uniform scale',!!v.uni,x=>{v.uni=x;note.textContent=x?'Uniform scale: Tiles sets both directions. Untick it to set Across (Tiles) and Down separately.':'Tiles is across, Down is down.';upd();}),chk('fx_tflip','Random flip',!!v.flip,x=>{v.flip=x;upd();}),el('button',{class:'btn sm',text:'New random',onclick:()=>{v.seed=Math.floor(Math.random()*1000)+1;upd();}})),note];},
  render(src,dst,v){const nx=Math.round(v.nx),ny=v.uni===true?nx:Math.round(v.ny);run(P.f_tile,dst,{uSrc:src.tex,uN:[nx,ny],uShift:v.sh,uRot:v.rot*Math.PI/180,uSeed:v.seed||1,uFlip:!!v.flip});}});
fxDef('seamless',{title:'Make seamless',note:'Blends the edges with the middle of the image so it repeats without visible seams. Check it with Tile mode.',
  defs:[{key:'w',label:'Blend width',min:.05,max:1,step:.01,value:.35,fmt:pct}],render(src,dst,v){run(P.f_seam,dst,{uSrc:src.tex,uW:v.w});}});

/* menu entry points */
const FX_NOW=new Set(['desat','invert']);
function fxMenu(id){if(FX_NOW.has(id))fxNow(id);else fxDialog(id);}
