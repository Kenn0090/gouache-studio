/* ================= Filters and adjustments =================
   Every one previews live on the canvas (unless previews are off), works on the map being viewed,
   and stays inside the selection. fxDialog is filterDialog with room for custom controls. */
function fxDialog(o){const et=needTarget();if(!et)return;const L=et.L;if(!effVisible(et.node)){toast('Show the active layer before filtering it.');return;}
  const v={};for(const d of o.defs||[])v[d.key]=d.value;Object.assign(v,o.init?o.init(L):{});
  const body=el('div',{class:'dlg-grid'}),sliders=[];
  const draw=()=>{o.render(L,v);chanLimit(et);selLimit(et);};
  /* slider moves are gathered into one redraw per frame */
  let pend=0;const upd=()=>{if(pend)return;pend=requestAnimationFrame(()=>{pend=0;if(preview&&!preview.off){draw();requestRender(true);}});};
  if(o.note)body.append(el('p',{class:'note',text:o.note}));
  if(o.controls)body.append(...o.controls(v,upd,L));
  for(const d of o.defs||[]){const s=makeSlider(Object.assign({},d,{id:'fx_'+d.key,onInput:x=>{v[d.key]=x;upd();}}));sliders.push([s,d]);body.append(s.el);}
  for(const [key,label,on] of o.checks||[]){v[key]=on;body.append(chk('fx_'+key,label,on,x=>{v[key]=x;upd();}));}
  if(sliders.length)body.append(el('div',{class:'frow'},el('button',{class:'btn sm',text:'Reset',onclick:()=>{for(const [s,d] of sliders){v[d.key]=d.value;s.set(d.value);}upd();}}),el('span',{class:'note',text:'Previewing on “'+et.node.name+'”'+(et.isMask?' (mask)':doc.map!=='base'?' ('+MAP_DEFS[doc.map].label.toLowerCase()+')':'')})));
  body.append(previewChk('fxPrev',prefs.livePreview,x=>{if(!preview)return;preview.off=!x;if(x)draw();requestRender(true);}));
  preview={L:et.node,isMask:et.isMask,et,off:!prefs.livePreview};upd();
  openDialog({title:o.title,body,float:true,wide:!!o.wide,okLabel:'Apply',onOk(){if(preview.off||pend){cancelAnimationFrame(pend);pend=0;draw();}applyPreview(o.label||o.title);if(o.done)o.done();},onCancel(){cancelAnimationFrame(pend);pend=0;preview=null;requestRender(true);if(o.done)o.done();}});}
/* one-step filters without settings */
function fxNow(label,render){const et=needTarget();if(!et)return;preview={L:et.node,isMask:et.isMask,et};render(et.L);chanLimit(et);selLimit(et);applyPreview(label);}
const px=v=>v+'px',deg=v=>Math.round(v)+'°';

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
  const u=new Uint8Array(S*S*4);gl.bindFramebuffer(gl.FRAMEBUFFER,sm.fbo);gl.readPixels(0,0,S,S,gl.RGBA,gl.UNSIGNED_BYTE,u);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteTexture(sm.tex);gl.deleteFramebuffer(sm.fbo);
  const h=[new Float32Array(256),new Float32Array(256),new Float32Array(256),new Float32Array(256)];
  for(let i=0;i<u.length;i+=4){const a=u[i+3];if(a<8)continue;const r=Math.min(255,u[i]*255/a|0),g=Math.min(255,u[i+1]*255/a|0),b=Math.min(255,u[i+2]*255/a|0);h[0][r]++;h[1][g]++;h[2][b]++;h[3][Math.round(r*.2126+g*.7152+b*.0722)]++;}
  return h;}
function drawHist(x,W,H,h,color){let mx=1;const s=[...h].sort((a,b)=>a-b);mx=Math.max(1,s[250]*1.2);x.fillStyle=color;
  for(let i=0;i<256;i++){const v=Math.min(1,h[i]/mx)*H;x.fillRect(i*W/256,H-v,W/256+.5,v);}}
const CH_NAMES=[['m','RGB'],['r','Red'],['g','Green'],['b','Blue']];

/* Levels: input black / gamma / white and output black / white, for all channels or one */
function dlgLevels(){let hist=null;const lv={m:[0,1,1,0,1],r:[0,1,1,0,1],g:[0,1,1,0,1],b:[0,1,1,0,1]};let ch='m';
  const curve=p=>{const [ib,g,iw,ob,ow]=p;return identity().map(x=>{let t=clamp((x-ib)/Math.max(1e-4,iw-ib),0,1);t=Math.pow(t,1/g);return ob+(ow-ob)*t;});};
  let setters=[];
  fxDialog({title:'Levels',label:'Levels',init:L=>{hist=histogramOf(L.target);return {};},
    controls:(v,upd)=>{const cv=el('canvas',{class:'histo',width:256,height:90,'aria-label':'Histogram'});
      const drawH=()=>{const x=cv.getContext('2d');x.clearRect(0,0,256,90);drawHist(x,256,90,hist[ch==='m'?3:'rgb'.indexOf(ch)],'rgba(200,205,215,.7)');};
      const S=(id,label,i,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:lv[ch][i],fmt,onInput:x=>{lv[ch][i]=x;upd();}});
      const box=el('div',{class:'dlg-grid'});
      const build=()=>{setters=[S('lvIb','Input black',0,0,1,.005,x=>Math.round(x*255)),S('lvG','Midtones',1,.1,5,.01,x=>x.toFixed(2)),S('lvIw','Input white',2,0,1,.005,x=>Math.round(x*255)),
          S('lvOb','Output black',3,0,1,.005,x=>Math.round(x*255)),S('lvOw','Output white',4,0,1,.005,x=>Math.round(x*255))];box.replaceChildren(...setters.map(s=>s.el));drawH();};
      const chs=seg(CH_NAMES.map(([k,l])=>[k,l]),ch,k=>{ch=k;build();},'Channel');build();
      const auto=el('button',{class:'btn sm',text:'Auto',title:'Stretch the darkest and lightest 0.1% to black and white',onclick:()=>{const h=hist[3],n=h.reduce((a,b)=>a+b,0);let a=0,lo=0,hi=255;
        for(let i=0;i<256;i++){a+=h[i];if(a>n*.001){lo=i;break;}}a=0;for(let i=255;i>=0;i--){a+=h[i];if(a>n*.001){hi=i;break;}}lv.m[0]=lo/255;lv.m[2]=Math.max(lo+1,hi)/255;ch='m';build();upd();}});
      return [chs,cv,box,el('div',{class:'frow'},auto)];},
    render(L){const m=curve(lv.m),r=curve(lv.r),g=curve(lv.g),b=curve(lv.b);run(P.f_lut,previewT,{uSrc:L.target.tex,uLut:uploadFxLut([r,g,b,m])});}});}

/* Curves: points per channel, smooth monotone curve through them */
function monotone(pts){pts=pts.slice().sort((a,b)=>a[0]-b[0]);const n=pts.length;if(n<2)return identity();
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),d=[],m=[];for(let i=0;i<n-1;i++)d.push((ys[i+1]-ys[i])/Math.max(1e-6,xs[i+1]-xs[i]));
  m[0]=d[0];m[n-1]=d[n-2];for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
  for(let i=0;i<n-1;i++){if(d[i]===0){m[i]=m[i+1]=0;continue;}const a=m[i]/d[i],b=m[i+1]/d[i],s=a*a+b*b;if(s>9){const t=3/Math.sqrt(s);m[i]=t*a*d[i];m[i+1]=t*b*d[i];}}
  return identity().map(x=>{if(x<=xs[0])return ys[0];if(x>=xs[n-1])return ys[n-1];let k=0;while(k<n-2&&x>xs[k+1])k++;const h=xs[k+1]-xs[k],t=(x-xs[k])/h,t2=t*t,t3=t2*t;
    return clamp((2*t3-3*t2+1)*ys[k]+(t3-2*t2+t)*h*m[k]+(-2*t3+3*t2)*ys[k+1]+(t3-t2)*h*m[k+1],0,1);});}
function dlgCurves(){let hist=null;const pts={m:[[0,0],[1,1]],r:[[0,0],[1,1]],g:[[0,0],[1,1]],b:[[0,0],[1,1]]};let ch='m';
  fxDialog({title:'Curves',label:'Curves',init:L=>{hist=histogramOf(L.target);return {};},
    note:'Click the curve to add a point, drag to move it, drag it off the box to remove it.',
    controls:(v,upd)=>{const S=256,cv=el('canvas',{class:'curves',width:S,height:S,tabindex:'0','aria-label':'Curve'});let drag=null;
      const col={m:'#e8eaed',r:'#ff6b6b',g:'#69db7c',b:'#74c0fc'};
      const paint=()=>{const x=cv.getContext('2d');x.clearRect(0,0,S,S);x.fillStyle='rgba(255,255,255,.03)';x.fillRect(0,0,S,S);
        drawHist(x,S,S,hist[ch==='m'?3:'rgb'.indexOf(ch)],'rgba(160,165,175,.28)');x.strokeStyle='rgba(255,255,255,.08)';x.lineWidth=1;
        for(let i=1;i<4;i++){x.beginPath();x.moveTo(i*S/4,0);x.lineTo(i*S/4,S);x.moveTo(0,i*S/4);x.lineTo(S,i*S/4);x.stroke();}
        x.beginPath();x.moveTo(0,S);x.lineTo(S,0);x.stroke();
        for(const [k] of CH_NAMES){if(k!==ch&&pts[k].length===2&&pts[k][0].join()==='0,0'&&pts[k][1].join()==='1,1')continue;const c=monotone(pts[k]);x.strokeStyle=k===ch?col[k]:col[k]+'55';x.lineWidth=k===ch?2:1;x.beginPath();c.forEach((y,i)=>i?x.lineTo(i*S/255,S-y*S):x.moveTo(0,S-y*S));x.stroke();}
        x.fillStyle=col[ch];for(const [px2,py] of pts[ch]){x.beginPath();x.arc(px2*S,S-py*S,4,0,7);x.fill();}};
      const at=e=>{const r=cv.getBoundingClientRect();return [(e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height];};
      cv.addEventListener('pointerdown',e=>{const [x,y]=at(e);const P2=pts[ch];let i=P2.findIndex(p=>Math.hypot(p[0]-x,p[1]-y)<.04);
        if(i<0){P2.push([clamp(x,0,1),clamp(y,0,1)]);P2.sort((a,b)=>a[0]-b[0]);i=P2.findIndex(p=>p[0]===clamp(x,0,1));}
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
    render(L){run(P.f_lut,previewT,{uSrc:L.target.tex,uLut:uploadFxLut([monotone(pts.r),monotone(pts.g),monotone(pts.b),monotone(pts.m)])});}});}

function dlgHueSat(){fxDialog({title:'Hue / Saturation',defs:[{key:'h',label:'Hue',min:-180,max:180,step:1,value:0,fmt:v=>(v>0?'+':'')+v+'°'},{key:'s',label:'Saturation',min:-100,max:100,step:1,value:0,fmt:v=>(v>0?'+':'')+v},{key:'l',label:'Lightness',min:-100,max:100,step:1,value:0,fmt:v=>(v>0?'+':'')+v}],
  checks:[['c','Colorize',false]],render(L,v){run(P.f_hsl,previewT,{uSrc:L.target.tex,uHue:v.c?((v.h+360)%360)/360:v.h/360,uSat:v.c?(v.s+100)/200:v.s/100,uLight:v.l/100,uColorize:!!v.c});}});}
function dlgGradMap(){const list=GRAD_BUILTIN.map((p,i)=>[i,p.name]);let pick=2;
  fxDialog({title:'Gradient map',note:'Replaces each brightness with a colour from the gradient: dark to the left end, light to the right.',
    controls:(v,upd)=>{const s=el('select',{id:'gmSel'},el('option',{value:'cur',text:'Current gradient (Gradient tool)'}),...list.map(([i,n])=>el('option',{value:i,text:n})));s.value=String(pick);s.addEventListener('change',()=>{pick=s.value;upd();});
      return [el('div',{class:'frow'},el('label',{for:'gmSel',text:'Gradient'}),s)];},checks:[['rev','Reverse',false]],
    render(L,v){const def=pick==='cur'?ui.grad:presetDef(GRAD_BUILTIN[+pick]);run(P.f_gmap,previewT,{uSrc:L.target.tex,uLut:uploadLut(def),uRev:!!v.rev});}});}
function dlgThreshold(){fxDialog({title:'Threshold',defs:[{key:'t',label:'Level',min:1,max:255,step:1,value:128}],render(L,v){run(P.f_thresh,previewT,{uSrc:L.target.tex,uT:v.t/255});}});}
function desaturate(){fxNow('Desaturate',L=>run(P.f_desat,previewT,{uSrc:L.target.tex}));}

/* ---- palettes (Cutout, Quantize): k-means on a small copy of the layer ---- */
function paletteOf(t,k){const S=96,sm=makeTargetRaw(S,S);run(P.resample,sm,{uSrc:t.tex,uOffset:[0,0],uScale:[doc.w/S,doc.h/S],uTaps:{int:Math.min(8,Math.ceil(Math.max(doc.w,doc.h)/S))}});
  const u=new Uint8Array(S*S*4);gl.bindFramebuffer(gl.FRAMEBUFFER,sm.fbo);gl.readPixels(0,0,S,S,gl.RGBA,gl.UNSIGNED_BYTE,u);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteTexture(sm.tex);gl.deleteFramebuffer(sm.fbo);
  const pts=[];for(let i=0;i<u.length;i+=4){const a=u[i+3];if(a<16)continue;pts.push([u[i]/a,u[i+1]/a,u[i+2]/a]);}
  if(!pts.length)return [[0,0,0]];k=Math.min(k,pts.length);
  /* k-means++ start (deterministic), then refine */
  const d2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;const cs=[pts[0].slice()];const dist=pts.map(p=>d2(p,cs[0]));
  while(cs.length<k){let bi=0,bd=-1;for(let i=0;i<pts.length;i++)if(dist[i]>bd){bd=dist[i];bi=i;}cs.push(pts[bi].slice());for(let i=0;i<pts.length;i++)dist[i]=Math.min(dist[i],d2(pts[i],pts[bi]));}
  for(let it=0;it<12;it++){const sum=cs.map(()=>[0,0,0,0]);for(const p of pts){let bi=0,bd=1e9;for(let j=0;j<cs.length;j++){const e=d2(p,cs[j]);if(e<bd){bd=e;bi=j;}}const s=sum[bi];s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];s[3]++;}
    cs.forEach((c,j)=>{const s=sum[j];if(s[3]){c[0]=s[0]/s[3];c[1]=s[1]/s[3];c[2]=s[2]/s[3];}});}
  return cs;}
const palU=(cs,n)=>{const a=new Float32Array(n*3);cs.forEach((c,i)=>a.set(c,i*3));return {v3:a};};
/* Cutout: few flat colours with simplified shapes, like torn paper */
function dlgCutout(){let cache=null;
  fxDialog({title:'Cutout',note:'Flattens the image into a few colours with simplified edges.',
    defs:[{key:'n',label:'Number of levels',min:2,max:8,step:1,value:5},{key:'simp',label:'Edge simplicity',min:0,max:10,step:1,value:4},{key:'fid',label:'Edge fidelity',min:1,max:3,step:1,value:2}],
    render(L,v){const sm=acquire(),r=Math.max(.5,v.simp*.9);gaussian(L.target,sm,r);
      const key=v.n+'|'+v.simp;if(!cache||cache.key!==key){cache={key,pal:paletteOf(sm,v.n)};}const pal=cache.pal;
      const a=acquireD(8),b=acquireD(8);run(P.f_pal,a,{uSrc:sm.tex,uPal:palU(pal,16),uN:{int:pal.length}});
      const R=Math.round(v.simp*.6)+1,passes=Math.max(1,4-v.fid);
      let x=a,y=b;for(let i=0;i<passes;i++){run(P.f_vote,y,{uL:x.tex,uR:{int:Math.min(6,R)},uWrap:!!doc.wrap});[x,y]=[y,x];}
      run(P.f_paint,previewT,{uSrc:L.target.tex,uL:x.tex,uPal:palU(pal,16)});release(a);release(b);release(sm);}});}
function dlgQuantize(){let cache=null;
  fxDialog({title:'Quantize',note:'Reduces the image to a palette of colours chosen from it.',
    defs:[{key:'n',label:'Colours',min:2,max:64,step:1,value:8},{key:'d',label:'Dither',min:0,max:1,step:.01,value:0,fmt:pct}],
    render(L,v){if(!cache||cache.n!==v.n)cache={n:v.n,pal:paletteOf(L.target,v.n)};const pal=cache.pal;
      run(P.f_quant,previewT,{uSrc:L.target.tex,uPal:palU(pal,64),uN:{int:pal.length},uDither:v.d*.9/Math.cbrt(pal.length)});}});}

/* ---- blur and sharpen ---- */
function dlgSurfaceBlur(){fxDialog({title:'Surface blur',note:'Smooths areas of similar colour but keeps edges sharp.',defs:[{key:'r',label:'Radius',min:1,max:12,step:1,value:5,fmt:px},{key:'t',label:'Threshold',min:1,max:100,step:1,value:20}],
  render(L,v){run(P.f_surface,previewT,{uSrc:L.target.tex,uR:{int:v.r},uT:v.t/255*2.2,uWrap:!!doc.wrap});}});}
function dlgMotionBlur(){fxDialog({title:'Motion blur',defs:[{key:'a',label:'Angle',min:-180,max:180,step:1,value:0,fmt:deg},{key:'d',label:'Distance',min:1,max:200,step:1,value:20,fmt:px}],
  render(L,v){const r=v.a*Math.PI/180;run(P.f_motion,previewT,{uSrc:L.target.tex,uDir:[Math.cos(r),-Math.sin(r)],uLen:v.d});}});}
function dlgHighPass(){fxDialog({title:'High pass',note:'Keeps only detail smaller than the radius, around mid-grey. Set the layer to Overlay to sharpen.',defs:[{key:'r',label:'Radius',min:.5,max:100,step:.5,value:8,fmt:px}],
  render(L,v){const b=acquire();gaussian(L.target,b,v.r);run(P.f_highpass,previewT,{uSrc:L.target.tex,uBlur:b.tex});release(b);}});}

/* ---- painterly ---- */
function dlgOilPaint(){fxDialog({title:'Oil paint',note:'Each spot takes the calmest nearby colour, giving flat dabs of paint.',defs:[{key:'r',label:'Brush size',min:1,max:10,step:1,value:4,fmt:px},{key:'p',label:'Passes',min:1,max:3,step:1,value:1}],
  render(L,v){let src=L.target;const t=acquire();for(let i=0;i<v.p;i++){run(P.f_kuwa,i%2?t:previewT,{uSrc:src.tex,uR:{int:v.r},uWrap:!!doc.wrap});src=i%2?t:previewT;}if(src===t)blit(t,previewT,0,0,doc.w,doc.h,0,0);release(t);}});}
function dlgPainterly(){fxDialog({title:'Painterly',note:'Turns the image into brush strokes that follow its shapes.',
  defs:[{key:'r',label:'Stroke size',min:2,max:12,step:.5,value:5,fmt:px},{key:'q',label:'Sharpness',min:2,max:16,step:1,value:8},{key:'flow',label:'Stroke flow',min:0,max:8,step:.5,value:2,fmt:px},{key:'p',label:'Passes',min:1,max:3,step:1,value:1}],
  render(L,v){const T=acquireD(canFloat?16:doc.depth),T2=acquireD(T.depth),tmp=acquire();let src=L.target;
    for(let i=0;i<v.p;i++){run(P.f_tensor,T,{uSrc:src.tex,uWrap:!!doc.wrap});if(v.flow>.25){gaussian(T,T2,v.flow);blit(T2,T,0,0,doc.w,doc.h,0,0);}
      const dst=i%2?tmp:previewT;run(P.f_akuwa,dst,{uSrc:src.tex,uT:T.tex,uR:v.r,uQ:v.q,uWrap:!!doc.wrap});src=dst;}
    if(src===tmp)blit(tmp,previewT,0,0,doc.w,doc.h,0,0);release(T);release(T2);release(tmp);}});}
/* Mosaic: square tiles of one colour, with grout lines if you want them */
function dlgMosaic(){fxDialog({title:'Mosaic',defs:[{key:'c',label:'Cell size',min:2,max:128,step:1,value:12,fmt:px},{key:'g',label:'Grout',min:0,max:12,step:.5,value:0,fmt:px},{key:'bv',label:'Bevel',min:0,max:1,step:.01,value:0,fmt:pct}],
  controls:(v)=>{v.gc='bg';return [el('div',{class:'sub',text:'Grout colour'}),seg([['bg','Background colour'],['fg','Foreground colour'],['clear','Transparent']],'bg',x=>{v.gc=x;const s=$('#fx_c');if(s)s.dispatchEvent(new Event('input'));},'Grout colour')];},
  render(L,v){const c=v.gc==='clear'?[0,0,0,0]:[...(v.gc==='fg'?ui.fg:ui.bg),1];run(P.f_mosaic,previewT,{uSrc:L.target.tex,uCell:v.c,uGrout:v.g,uGC:c,uBevel:v.bv});}});}

/* ---- stylize ---- */
function dlgEmboss(){fxDialog({title:'Emboss',defs:[{key:'a',label:'Angle',min:-180,max:180,step:1,value:135,fmt:deg},{key:'h',label:'Height',min:1,max:10,step:1,value:2,fmt:px},{key:'amt',label:'Amount',min:.1,max:5,step:.05,value:1.5,fmt:pct}],
  checks:[['grey','Grey (like Photoshop)',true]],render(L,v){const r=v.a*Math.PI/180;run(P.f_emboss,previewT,{uSrc:L.target.tex,uDir:[Math.cos(r)*v.h,-Math.sin(r)*v.h],uAmt:v.amt,uWrap:!!doc.wrap,uGrey:!!v.grey});}});}
function dlgEdges(){fxDialog({title:'Find edges',defs:[{key:'a',label:'Strength',min:.2,max:8,step:.1,value:2,fmt:pct}],checks:[['inv','Dark lines on white',true]],
  render(L,v){run(P.f_edges,previewT,{uSrc:L.target.tex,uAmt:v.a,uWrap:!!doc.wrap,uInv:!!v.inv});}});}

/* ---- noise and generated patterns ---- */
function dlgNoise(){const seed=Math.random()*100;fxDialog({title:'Add noise',defs:[{key:'a',label:'Amount',min:0,max:1,step:.01,value:.15,fmt:pct}],checks:[['mono','Monochrome',true]],
  render(L,v){run(P.f_noise,previewT,{uSrc:L.target.tex,uAmt:v.a,uMono:!!v.mono,uSeed:seed});}});}
function genColors(v){return v.col==='bw'?[[0,0,0],[1,1,1]]:[ui.fg.slice(),ui.bg.slice()];}
const colSeg=v=>{v.col='fgbg';return [el('div',{class:'sub',text:'Colours'}),seg([['fgbg','Foreground to background'],['bw','Black to white']],'fgbg',x=>{v.col=x;const s=document.querySelector('.dlg-grid input[type=range]');if(s)s.dispatchEvent(new Event('input'));},'Colours')];};
function dlgClouds(){let seed=Math.random()*100;fxDialog({title:'Render clouds',note:'Soft noise that tiles seamlessly. Replaces the layer (inside the selection).',
  controls:v=>[...colSeg(v),el('div',{class:'frow'},el('button',{class:'btn sm',text:'New pattern',onclick:()=>{seed=Math.random()*100;const s=$('#fx_s');if(s)s.dispatchEvent(new Event('input'));}}))],
  defs:[{key:'s',label:'Scale',min:1,max:32,step:1,value:4,fmt:v=>v+'×'},{key:'o',label:'Detail',min:1,max:8,step:1,value:5},{key:'r',label:'Roughness',min:.2,max:.8,step:.01,value:.5,fmt:pct},{key:'c',label:'Contrast',min:.2,max:3,step:.05,value:1,fmt:pct}],
  render(L,v){const [a,b]=genColors(v);run(P.f_clouds,previewT,{uSize:[doc.w,doc.h],uScale:v.s,uOct:{int:v.o},uRough:v.r,uSeed:seed,uA:a,uB:b,uContrast:v.c});}});}
function dlgCells(){let seed=Math.random()*100;fxDialog({title:'Render cells',note:'Cell (Voronoi) pattern that tiles seamlessly: stones, scales, cracked earth.',
  controls:v=>{v.mode=0;return [...colSeg(v),el('div',{class:'sub',text:'Style'}),seg([[0,'Distance'],[1,'Borders'],[2,'Flat cells']],0,x=>{v.mode=x;const s=$('#fx_s');if(s)s.dispatchEvent(new Event('input'));},'Style'),
    el('div',{class:'frow'},el('button',{class:'btn sm',text:'New pattern',onclick:()=>{seed=Math.random()*100;const s=$('#fx_s');if(s)s.dispatchEvent(new Event('input'));}}))];},
  defs:[{key:'s',label:'Cells across',min:1,max:64,step:1,value:8},{key:'j',label:'Randomness',min:0,max:1,step:.01,value:.9,fmt:pct}],
  render(L,v){const [a,b]=genColors(v);run(P.f_cells,previewT,{uSize:[doc.w,doc.h],uScale:v.s,uSeed:seed,uA:a,uB:b,uMode:{int:v.mode},uJit:v.j});}});}

/* ---- tiling ---- */
function dlgOffset(){fxDialog({title:'Offset',note:'Slides the image, wrapping around the edges, so you can see and paint over tiling seams.',
  defs:[{key:'x',label:'Horizontal',min:-doc.w,max:doc.w,step:1,value:Math.round(doc.w/2),fmt:px},{key:'y',label:'Vertical',min:-doc.h,max:doc.h,step:1,value:Math.round(doc.h/2),fmt:px}],
  render(L,v){run(P.shift,previewT,{uSrc:L.target.tex,uOff:[v.x,v.y],uWrap:true,uOutside:[0,0,0,0]});}});}
function dlgSeamless(){fxDialog({title:'Make seamless',note:'Blends the edges with the middle of the image so it repeats without visible seams. Check it with Tile mode.',
  defs:[{key:'w',label:'Blend width',min:.05,max:1,step:.01,value:.35,fmt:pct}],render(L,v){run(P.f_seam,previewT,{uSrc:L.target.tex,uW:v.w});}});}
