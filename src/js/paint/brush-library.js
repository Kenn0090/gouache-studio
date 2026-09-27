/* ================= Brush tips & library ================= */
const SETTING_KEYS=Object.keys(BRUSH_DEFAULTS);
let tipSeq=0;
function downscaleAlpha(a,w,h,W,H){const out=new Uint8Array(W*H),sx=w/W,sy=h/H;
  for(let y=0;y<H;y++){const y0=Math.floor(y*sy),y1=Math.max(y0+1,Math.floor((y+1)*sy));for(let x=0;x<W;x++){const x0=Math.floor(x*sx),x1=Math.max(x0+1,Math.floor((x+1)*sx));let sum=0,n=0;
    for(let yy=y0;yy<y1&&yy<h;yy++)for(let xx=x0;xx<x1&&xx<w;xx++){sum+=a[yy*w+xx];n++;}out[y*W+x]=n?Math.round(sum/n):0;}}return out;}
function makeTip(name,w,h,alpha){
  let W=w,H=h,A=alpha;const mx=Math.max(w,h);
  if(mx>1024){const s=1024/mx;W=Math.max(1,Math.round(w*s));H=Math.max(1,Math.round(h*s));A=downscaleAlpha(alpha,w,h,W,H);}
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,W,H,0,gl.RED,gl.UNSIGNED_BYTE,A);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const c=document.createElement('canvas');c.width=W;c.height=H;const cx=c.getContext('2d'),id=cx.createImageData(W,H);
  for(let i=0;i<A.length;i++){id.data[i*4]=255;id.data[i*4+1]=255;id.data[i*4+2]=255;id.data[i*4+3]=A[i];}cx.putImageData(id,0,0);
  return {id:'t'+(++tipSeq),name,w:W,h:H,alpha:A,tex,canvas:c};
}
function disposeTip(t){if(t&&t.tex){gl.deleteTexture(t.tex);t.tex=null;}}
function genTip(name,w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.strokeStyle='#fff';
  draw(x,w,h,rng(name.length*7919+w));const d=x.getImageData(0,0,w,h).data;const a=new Uint8Array(w*h);for(let i=0;i<a.length;i++)a[i]=d[i*4+3];return makeTip(name,w,h,a);}
const TIPS={
  bristle:genTip('Flat bristle',96,256,(x,w,h,R)=>{for(let i=0;i<150;i++){const y=h*.03+R()*h*.94,len=w*(.55+R()*.45),x0=(w-len)/2+(R()-.5)*8;x.globalAlpha=.25+R()*.6;x.fillRect(x0,y,len,1+R()*2.2);}}),
  sponge:genTip('Sponge',256,256,(x,w,h,R)=>{for(let i=0;i<420;i++){const a=R()*6.283,rr=Math.sqrt(R())*w*.44;x.globalAlpha=.25+R()*.5;x.beginPath();x.arc(w/2+Math.cos(a)*rr,h/2+Math.sin(a)*rr,2+R()*9,0,7);x.fill();}}),
  leaf:genTip('Leaf',160,256,(x,w,h)=>{x.beginPath();x.moveTo(w/2,4);x.bezierCurveTo(w*1.02,h*.28,w*.86,h*.78,w/2,h-4);x.bezierCurveTo(w*.14,h*.78,-w*.02,h*.28,w/2,4);x.fill();
    x.globalCompositeOperation='destination-out';x.lineWidth=3;x.globalAlpha=.7;x.beginPath();x.moveTo(w/2,h*.12);x.quadraticCurveTo(w*.53,h*.5,w/2,h*.92);x.stroke();}),
  grass:genTip('Grass',256,256,(x,w,h,R)=>{for(let i=0;i<9;i++){const bx=w*.3+R()*w*.4,bend=(R()-.5)*w*.6,top=h*(.05+R()*.35),bw=4+R()*6;x.globalAlpha=.7+R()*.3;x.beginPath();x.moveTo(bx-bw,h);
    x.quadraticCurveTo(bx-bw*.5+bend*.3,(h+top)/2,bx+bend,top);x.quadraticCurveTo(bx+bw*.5+bend*.3,(h+top)/2,bx+bw,h);x.closePath();x.fill();}}),
  splatter:genTip('Splatter',256,256,(x,w,h,R)=>{for(let i=0;i<90;i++){const a=R()*6.283,rr=Math.pow(R(),.7)*w*.45,s=rr<w*.15?4+R()*14:1+R()*5;x.globalAlpha=.8+R()*.2;x.beginPath();x.arc(w/2+Math.cos(a)*rr,h/2+Math.sin(a)*rr,s,0,7);x.fill();}})
};
const PRESETS=[
  {name:'Round',tool:'brush',size:24,hardness:.85,spacing:.06,pSize:true,minSize:.2,smoothing:.25},
  {name:'Soft air',tool:'brush',size:110,hardness:0,flow:.16,spacing:.06,pSize:false,pOpacity:true,buildup:true,smoothing:.2},
  {name:'Chalk',tool:'brush',size:40,hardness:.75,spacing:.05,grain:.8,pSize:true,pOpacity:true,minSize:.35,smoothing:.2},
  {name:'Ink',tool:'brush',size:7,hardness:1,spacing:.04,pSize:true,minSize:.05,smoothing:.55},
  {name:'Flat bristle',tool:'brush',tip:TIPS.bristle,size:44,spacing:.03,followDir:true,pSize:true,minSize:.55,pOpacity:true,smoothing:.3},
  {name:'Sponge',tool:'brush',tip:TIPS.sponge,size:80,spacing:.3,angleJitter:1,sizeJitter:.3,pSize:false,pOpacity:true,buildup:true,flow:.5},
  {name:'Foliage',tool:'brush',tip:TIPS.leaf,size:44,spacing:.7,angleJitter:.3,sizeJitter:.5,scatter:1.2,count:2,pSize:false,randFlipX:true},
  {name:'Grass',tool:'brush',tip:TIPS.grass,size:64,spacing:.35,sizeJitter:.45,scatter:.5,angleJitter:.06,pSize:true,minSize:.4,randFlipX:true},
  {name:'Splatter',tool:'brush',tip:TIPS.splatter,size:90,spacing:.9,angleJitter:1,sizeJitter:.4,scatter:.5,pSize:false},
  {name:'Blender',tool:'smudge',size:44,hardness:.35,spacing:.05,strength:.65,charge:0,pSize:false,pOpacity:true,smoothing:.2},
  {name:'Wet mix',tool:'smudge',size:36,hardness:.6,spacing:.05,grain:.3,strength:.55,charge:.3,pSize:true,pOpacity:true,minSize:.4,smoothing:.2},
  {name:'Bristle blend',tool:'smudge',tip:TIPS.bristle,size:44,spacing:.04,followDir:true,strength:.6,charge:.15,pSize:false,pOpacity:true}
];
const library=[{id:'builtin',name:'Built-in',builtin:true,presets:PRESETS,tips:[]}];
let activePreset=null;
function tileCanvas(p){const c=el('canvas',{width:64,height:64});const x=c.getContext('2d');
  if(p.tip&&p.tip.canvas){const t=p.tip,s=54/Math.max(t.w,t.h);x.drawImage(t.canvas,32-t.w*s/2,32-t.h*s/2,t.w*s,t.h*s);}
  else{const h=clamp(p.hardness==null?.85:p.hardness,0,.98),g=x.createRadialGradient(32,32,0,32,32,26);g.addColorStop(0,'#fff');g.addColorStop(h,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g;x.save();x.translate(32,32);x.scale(1,clamp(p.roundness==null?1:p.roundness,.05,1));x.beginPath();x.arc(0,0,26,0,7);x.restore();x.fill();
    if(p.grain){x.globalCompositeOperation='destination-out';const R=rng(3);for(let i=0;i<260;i++){x.globalAlpha=R()*.8;x.fillRect(R()*64,R()*64,2,2);}}}
  x.globalCompositeOperation='source-in';x.globalAlpha=1;x.fillStyle=p.tool==='smudge'?'#e2a453':'#e1e3e7';x.fillRect(0,0,64,64);return c;}
function renderLibrary(){const box=$('#libBody');box.replaceChildren();
  for(const set of library){const head=el('div',{class:'libset-h'},el('span',{text:set.builtin?set.name:set.name+' · '+set.presets.length}),set.builtin?null:el('button',{text:'Remove','aria-label':'Remove brush set '+set.name,onclick:()=>removeSet(set)}));
    const tiles=el('div',{class:'tiles'});
    for(const p of set.presets){const b=el('button',{title:p.name+(p.tool==='smudge'?' (blend)':''),'aria-label':p.name,class:p===activePreset?'on':null,onclick:()=>applyPreset(p)});b.append(p._thumb||(p._thumb=tileCanvas(p)));tiles.append(b);}
    box.append(el('div',{class:'libset'},head,tiles));}}
function makeSlider(o){
  const to=o.map?o.map.to:v=>v,from=o.map?o.map.from:v=>v,fmt=o.fmt||(v=>String(v));
  const inp=el('input',{type:'range',id:o.id,min:o.min,max:o.max,step:o.step});inp.value=to(o.value);
  const out=el('output',{for:o.id,text:fmt(o.value)});
  inp.addEventListener('input',()=>{const v=from(parseFloat(inp.value));out.textContent=fmt(v);o.onInput(v);});
  return {el:el('div',{class:'srow'},el('label',{for:o.id,text:o.label}),inp,out),set(v){inp.value=to(v);out.textContent=fmt(v);}};
}
function chk(id,label,checked,onChange){const i=el('input',{type:'checkbox',id});i.checked=checked;i.addEventListener('change',()=>onChange(i.checked));return el('label',{class:'chk',for:id},i,el('span',{text:label}));}
const pct=v=>Math.round(v*100)+'%';
const sizeMap={to:v=>Math.round(Math.pow((v-1)/499,1/2.2)*1000),from:u=>Math.max(1,Math.round(1+499*Math.pow(u/1000,2.2)))};
let sizeSlider=null,dynOpen=false;
function brushEdited(){if(activePreset){activePreset=null;renderLibrary();}schedulePreview();}
function buildBrushPanel(){
  const box=$('#brushBody');box.replaceChildren();const sm=ui.tool==='smudge',isText=ui.tool==='text',isSel=isSelTool(ui.tool),isXf=!!(xf&&!xf.move),isOther=['crop','move','gradient','bucket'].includes(ui.tool),noBrush=isText||isSel||isXf||isOther;
  $('#libBody').hidden=noBrush;document.querySelector('.prevwrap').hidden=noBrush;$('#abrBtn').hidden=noBrush;$('#tipBtn').hidden=noBrush;
  if(isText){$('#brushTitle').textContent='Text';buildTextPanel(box);return;}
  if(isXf){buildXfPanel(box);return;}
  if(ui.tool==='crop'){buildCropPanel(box);return;}
  if(ui.tool==='move'){buildMovePanel(box);return;}
  if(ui.tool==='gradient'){buildGradPanel(box);return;}
  if(ui.tool==='bucket'){buildBucketPanel(box);return;}
  if(isSel){buildSelectPanel(box);return;}
  const tonal=ui.tool==='dodge'||ui.tool==='burn';
  $('#brushTitle').textContent=sm?'Blend brush':ui.tool==='erase'?'Eraser':tonal?(ui.tool==='dodge'?'Dodge':'Burn'):'Brush';
  if(tonal)box.append(seg([['dodge','Dodge','Lighten (O)'],['burn','Burn','Darken (Shift+O switches)']],ui.tool,v=>{ui.tonal=v;setTool(v);},'Dodge or burn'),
    el('div',{class:'sub',text:'Range'}),seg([[0,'Shadows'],[1,'Midtones'],[2,'Highlights']],ui.tonalRange,v=>{ui.tonalRange=v;},'Range'),
    makeSlider({id:'tExp',label:'Exposure',min:.01,max:1,step:.01,value:ui.tonalExposure,fmt:pct,onInput:v=>{ui.tonalExposure=v;}}).el,
    el('div',{class:'chips'},chk('tProt','Protect tones',ui.tonalProtect,v=>{ui.tonalProtect=v;})));
  const S=(id,label,key,min,max,step,fmt,map)=>makeSlider({id,label,min,max,step,value:brush[key],fmt,map,onInput:v=>{brush[key]=v;brushEdited();if(key==='size')refreshCursor();}});
  const C=(id,label,key,rebuild)=>chk(id,label,!!brush[key],v=>{brush[key]=v;brushEdited();if(rebuild)buildBrushPanel();});
  box.append(el('div',{class:'sub',text:'Tip: '+(brush.tip?brush.tip.name+' ('+brush.tip.w+'×'+brush.tip.h+')':'round')+(activePreset?' · preset “'+activePreset.name+'”':'')}));
  sizeSlider=S('bSize','Size','size',0,1000,1,v=>v+'px',sizeMap);box.append(sizeSlider.el);
  if(sm)box.append(S('bStr','Strength','strength',0,1,.01,pct).el,S('bCharge','Paint load','charge',0,1,.01,pct).el);
  else if(!tonal)box.append(S('bOp','Opacity','opacity',0,1,.01,pct).el);
  box.append(S('bFlow','Flow','flow',.01,1,.01,pct).el);
  if(!brush.tip)box.append(S('bHard','Hardness','hardness',0,1,.01,pct).el);
  box.append(S('bSpace','Spacing','spacing',.01,1.5,.01,pct).el,S('bGrain','Grain','grain',0,1,.01,pct).el,S('bSmooth','Smoothing','smoothing',0,1,.01,pct).el);
  box.append(el('div',{class:'sub',text:'Pen pressure'}));
  box.append(el('div',{class:'chips'},C('bPS','Size','pSize',true),C('bPO','Opacity','pOpacity'),sm?null:C('bBU','Build-up','buildup')));
  if(brush.pSize)box.append(S('bMin','Min size','minSize',0,1,.01,pct).el);
  box.append(S('bCurve','Curve','curve',-1,1,.05,v=>v>0.02?'soft':v<-0.02?'firm':'linear').el);
  const det=el('details',{class:'more'});det.open=dynOpen;det.addEventListener('toggle',()=>{dynOpen=det.open;});
  det.append(el('summary',{text:'Tip shape & dynamics'}),el('div',{},
    S('bAng','Angle','angle',-180,180,1,v=>Math.round(v)+'°').el,
    S('bRound','Roundness','roundness',.05,1,.01,pct).el,
    S('bSJ','Size jitter','sizeJitter',0,1,.01,pct).el,
    S('bAJ','Angle jitter','angleJitter',0,1,.01,pct).el,
    S('bSc','Scatter','scatter',0,4,.05,pct).el,
    S('bCnt','Count','count',1,8,1,v=>String(Math.round(v))).el,
    el('div',{class:'chips'},C('bFD','Follow stroke','followDir'),C('bBA','Scatter both axes','bothAxes'),C('bRF','Random flip','randFlipX'))));
  box.append(det);schedulePreview();
}
function applyPreset(p){for(const k of SETTING_KEYS)brush[k]=(k in p)?p[k]:BRUSH_DEFAULTS[k];activePreset=p;setTool((ui.tool==='dodge'||ui.tool==='burn')&&p.tool!=='smudge'?ui.tool:(p.tool||'brush'),true);renderLibrary();refreshCursor();}
function setTool(t,keepPreset){if(t!=='text'&&typeof closeTextEditor==='function')closeTextEditor();if(t!=='lasso'&&typeof polyLasso!=='undefined'&&polyLasso){polyLasso=null;drawSelOverlay();}
  if(typeof xf!=='undefined'&&xf&&!xf.move)xfCommit();if(t!=='gradient'&&typeof gsess!=='undefined'&&gsess)gradCommit();if(t==='gradient'||t==='bucket')ui.fillKind=t;if(t==='dodge'||t==='burn')ui.tonal=t;updateGroupButtons(t);if(typeof crop!=='undefined'){if(t==='crop'&&ui.tool!=='crop')crop=null;else if(t!=='crop')crop=null;}cv.style.cursor='';ui.tool=t;stage.classList.toggle('txt',t==='text');stage.classList.toggle('selt',isSelTool(t));stage.classList.toggle('movet',t==='move');stage.classList.toggle('fillt',t==='gradient'||t==='bucket');document.querySelectorAll('.tool').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===t)));
  if(!keepPreset&&activePreset&&(activePreset.tool==='smudge')!==(t==='smudge')){activePreset=null;renderLibrary();}
  stage.classList.toggle('grab',t==='hand');stage.classList.toggle('pick',t==='picker');buildBrushPanel();refreshCursor();}
document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));

/* live brush preview: runs the real brush engine on a small offscreen canvas */
const prevC=$('#brushPrev');let prevT=null,prevStroke=null,prevBefore=null,prevScratch=null,prevQueued=false;
function schedulePreview(){if(prevQueued)return;prevQueued=true;requestAnimationFrame(()=>{prevQueued=false;try{drawBrushPreview();}catch(e){console.error(e);}});}
function drawBrushPreview(){
  if(stroke){schedulePreview();return;}
  const d=Math.min(window.devicePixelRatio||1,2),W=Math.round(prevC.clientWidth*d),H=Math.round(prevC.clientHeight*d);if(W<20||H<20)return;
  if(!prevT||prevT.w!==W||prevT.h!==H){[prevT,prevStroke,prevBefore,prevScratch].forEach(disposeTarget);prevT=makeTarget(W,H,8,false);prevStroke=makeTarget(W,H,8,false);prevBefore=makeTarget(W,H,8,false);prevScratch=makeTarget(W,H,8,false);prevC.width=W;prevC.height=H;}
  const tool=ui.tool==='erase'||ui.tool==='smudge'?ui.tool:'brush',scale=Math.min(d,(H*.62)/Math.max(1,brush.size));
  const saved={w:doc.w,h:doc.h,wrap:doc.wrap,strokeT,beforeT,scratchT};
  doc.w=W;doc.h=H;doc.wrap=false;strokeT=prevStroke;beforeT=prevBefore;scratchT=prevScratch;
  try{
    if(tool==='brush')clearTarget(prevT);
    else if(tool==='erase')clearTarget(prevT,[ui.fg[0],ui.fg[1],ui.fg[2],1]);
    else{bindTarget(prevT);gl.enable(gl.SCISSOR_TEST);const n=6;for(let i=0;i<n;i++){const c=i%2?ui.bg:ui.fg,x0=Math.round(i*W/n),x1=Math.round((i+1)*W/n);gl.scissor(x0,0,x1-x0,H);gl.clearColor(c[0],c[1],c[2],1);gl.clear(gl.COLOR_BUFFER_BIT);}gl.disable(gl.SCISSOR_TEST);}
    const o=Object.assign({},brush,{tool,color:ui.fg.slice(),size:Math.max(1,brush.size*scale),smoothing:0});
    const L={target:prevT,lockAlpha:false},pad=Math.min(W*.12,o.size*.7+6),N=90;
    const pt=i=>{const t=i/N;return [pad+(W-2*pad)*t,H/2+Math.sin(t*Math.PI*2)*H*.2,Math.max(.04,Math.pow(Math.sin(t*Math.PI),.8))];};
    const p0=pt(0);beginStroke(L,p0[0],p0[1],p0[2],o);for(let i=1;i<=N;i++){const q=pt(i);addPoint(q[0],q[1],q[2]);}endStroke(false);
  }finally{Object.assign(doc,{w:saved.w,h:saved.h,wrap:saved.wrap});strokeT=saved.strokeT;beforeT=saved.beforeT;scratchT=saved.scratchT;}
  const st=toStraight(readPremult(prevT),8),x=prevC.getContext('2d'),id=x.createImageData(W,H);id.data.set(st);x.putImageData(id,0,0);
  $('#prevNote').textContent=scale<d*.995?'shown at '+Math.round(scale/d*100)+'%':'';
}
new ResizeObserver(()=>schedulePreview()).observe(prevC);

/* brush library persistence (per browser, best effort) */
const store={db:null,
  open(){if(this.db)return Promise.resolve(this.db);return new Promise((res,rej)=>{try{const r=indexedDB.open('gouache-studio',2);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('sets'))db.createObjectStore('sets',{keyPath:'id'});if(!db.objectStoreNames.contains('fonts'))db.createObjectStore('fonts',{keyPath:'name'});};r.onsuccess=()=>{this.db=r.result;res(r.result);};r.onerror=()=>rej(r.error);}catch(e){rej(e);}});},
  tx(mode,fn,sn){sn=sn||'sets';return this.open().then(db=>new Promise((res,rej)=>{const t=db.transaction(sn,mode);const req=fn(t.objectStore(sn));t.oncomplete=()=>res(req&&req.result);t.onerror=()=>rej(t.error);}));},
  put(d,sn){return this.tx('readwrite',st=>st.put(d),sn).catch(()=>{});},
  del(id,sn){return this.tx('readwrite',st=>st.delete(id),sn).catch(()=>{});},
  all(sn){return this.tx('readonly',st=>st.getAll(),sn).catch(()=>[]);}
};
function serializeSet(set){const tips=[],idx=new Map();
  const presets=set.presets.map(p=>{const o={name:p.name,tool:p.tool};for(const k of SETTING_KEYS)if(k!=='tip')o[k]=p[k];
    if(p.tip){if(!idx.has(p.tip)){idx.set(p.tip,tips.length);tips.push({name:p.tip.name,w:p.tip.w,h:p.tip.h,alpha:p.tip.alpha});}o.tipIndex=idx.get(p.tip);}return o;});
  return {id:set.id,name:set.name,presets,tips};}
function deserializeSet(d){const tips=d.tips.map(t=>makeTip(t.name,t.w,t.h,t.alpha));
  return {id:d.id,name:d.name,tips,presets:d.presets.map(o=>{const p=Object.assign({},o);p.tip=o.tipIndex!=null?tips[o.tipIndex]:null;delete p.tipIndex;return p;})};}
function saveSet(set){store.put(serializeSet(set));}
function addSet(set){library.push(set);renderLibrary();saveSet(set);}
function removeSet(set){const i=library.indexOf(set);if(i<0)return;library.splice(i,1);
  if(set.presets.some(p=>p===activePreset)||(brush.tip&&set.tips.includes(brush.tip)))applyPreset(PRESETS[0]);
  for(const t of set.tips)disposeTip(t);store.del(set.id);renderLibrary();toast('Removed “'+set.name+'”.');}
async function loadSavedSets(){try{const all=await store.all();for(const d of all||[]){try{library.push(deserializeSet(d));}catch(e){}}renderLibrary();}catch(e){}}
