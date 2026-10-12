/* ================= Photo tab: the Develop panel, the photos strip, presets, history ================= */
const PH_SIGN=v=>(v>0?'+':'')+(Math.abs(v)>=100?Math.round(v):Math.round(v*10)/10);
function phSl(path,label,min,max,step,o){o=o||{};const s=phS(),def=phPathGet(phDefaults(),path),id='ph_'+path.replace(/[^\w]/g,'_');
  const sl=makeSlider({id,label,min,max,step,value:phPathGet(s,path),fmt:o.fmt||PH_SIGN,onInput:v=>phSet(path,v,label),onChange:v=>phSet(path,v,label)});
  const lab=sl.el.querySelector('label');if(lab){lab.title='Double-click to reset';lab.addEventListener('dblclick',()=>{phSet(path,def,label);phBuildPanel();});}return sl.el;}
function phSec(key,title,body,resetFn){const d=el('details',{class:'phs',id:'phs_'+key}),sm=el('summary',{},el('span',{text:title}),...(resetFn?[el('button',{class:'phsreset',title:'Reset this section','aria-label':'Reset '+title,text:'↺',onclick:e=>{e.preventDefault();e.stopPropagation();resetFn();}})]:[]));
  d.open=!!ph.open[key];d.addEventListener('toggle',()=>{ph.open[key]=d.open;try{localStorage.setItem('gs.phOpen',JSON.stringify(ph.open));}catch(e){}});d.append(sm,el('div',{class:'phsbody dlg-grid'},...body));return d;}
try{Object.assign(ph.open,JSON.parse(localStorage.getItem('gs.phOpen')||'{}'));}catch(e){}
const phResetKeys=(keys,label)=>()=>{const p=phP();if(!p)return;const n=phClone(p.s),d=phDefaults();for(const k of keys)n[k]=d[k];phApply(n,'Reset '+label);};
function phBuildPanel(){const box=$('#photoBody');if(!box)return;box.replaceChildren();const p=phP();
  const bar=el('div',{class:'phbar'},el('button',{class:'btn sm primary',text:'Open photos…',onclick:phOpenDialog}),
    el('button',{class:'btn sm',id:'phBefore',text:'Before',title:'Hold to see the photo as it was (\\)',onpointerdown:()=>phShow('before'),onpointerup:()=>phShow('edit'),onpointerleave:()=>{if(ph.show==='before')phShow('edit');}}),
    el('button',{class:'btn sm',text:'Reset',title:'Take all edits off this photo',onclick:phReset}),
    el('button',{class:'btn sm',text:'Copy',title:'Copy this photo’s edits (Ctrl+Shift+C)',onclick:phCopy}),el('button',{class:'btn sm',text:'Paste',title:'Paste the copied edits (Ctrl+Shift+V)',onclick:()=>phPaste()}),
    el('button',{class:'btn sm',text:'Export…',onclick:()=>dlgPhotoExport()}),el('button',{class:'btn sm',text:'To Paint',title:'Put the edited photo on a new layer in Paint',onclick:phToPaint}));
  box.append(bar);
  if(!p){box.append(el('div',{class:'phempty'},el('p',{text:'Open a photo to start editing. JPEG, PNG, WebP, TIFF and RAW photos work. You can also drop photos on the picture.'}),el('button',{class:'btn primary',text:'Open photos…',onclick:phOpenDialog})));return;}
  const s=p.s;
  box.append(el('div',{class:'phhisto'},el('canvas',{id:'phHisto',width:300,height:70,'aria-label':'Histogram'})),
    phSec('light','Basic',[
      el('div',{class:'phlmbtns'},el('button',{class:'btn sm',text:'Auto tone',title:'Set exposure, contrast and the tone sliders from the picture',onclick:phAutoTone})),
      el('div',{class:'sub',text:'White balance'}),phSl('temp','Temperature',-100,100,1),phSl('tint','Tint',-100,100,1),
      el('div',{class:'sub',text:'Tone'}),phSl('exp','Exposure',-5,5,.01,{fmt:v=>(v>0?'+':'')+v.toFixed(2)}),phSl('con','Contrast',-100,100,1),phSl('hi','Highlights',-100,100,1),phSl('sh','Shadows',-100,100,1),phSl('wh','Whites',-100,100,1),phSl('bl','Blacks',-100,100,1),
      el('div',{class:'sub',text:'Presence'}),phSl('tex','Texture',-100,100,1),phSl('cla','Clarity',-100,100,1),phSl('dehaze','Dehaze',-100,100,1),phSl('vib','Vibrance',-100,100,1),phSl('sat','Saturation',-100,100,1),
      chk('phBW','Black & white',!!s.bw,v=>{phSet('bw',v,'Black & white');})],phResetKeys(['temp','tint','exp','con','hi','sh','wh','bl','tex','cla','dehaze','vib','sat','bw'],'Basic')),
    phSec('spots','Spot removal',phSpotPanel(),()=>{const n=phClone(phS());n.spots=[];ph.sp.sel=null;phApply(n,'Remove spots');}),
    phSec('local','Masks',phLocalPanel(),()=>{const n=phClone(phS());n.local=[];ph.lm.sel=null;ph.lm.tool=null;phApply(n,'Remove masks');}),
    phSec('curve','Tone curve',[phCurveEditor()],phResetKeys(['curve'],'Tone curve')),
    phSec('mix','Colour mixer',phMixer(),phResetKeys(['mix'],'Colour mixer')),
    phSec('point','Point colour',phPointPanel(),()=>{const n=phClone(phS());n.pts=[];phApply(n,'Remove colour points');}),
    phSec('grade','Colour grading',phGrading(),phResetKeys(['grade'],'Colour grading')),
    phSec('detail','Detail',[el('div',{class:'sub',text:'Sharpening'}),phSl('sharp.amt','Amount',0,150,1,{fmt:v=>Math.round(v)}),phSl('sharp.rad','Radius',.5,3,.1,{fmt:v=>v.toFixed(1)}),phSl('sharp.mask','Masking',0,100,1,{fmt:v=>Math.round(v)}),
      el('div',{class:'sub',text:'Noise reduction'}),phSl('nr.lum','Luminance',0,100,1,{fmt:v=>Math.round(v)}),phSl('nr.col','Colour',0,100,1,{fmt:v=>Math.round(v)})],phResetKeys(['sharp','nr'],'Detail')),
    phSec('effects','Effects',[el('div',{class:'sub',text:'Vignette'}),phSl('vig.amt','Amount',-100,100,1),phSl('vig.mid','Midpoint',0,100,1,{fmt:v=>Math.round(v)}),phSl('vig.feather','Feather',0,100,1,{fmt:v=>Math.round(v)}),phSl('vig.round','Roundness',0,100,1,{fmt:v=>Math.round(v)}),
      el('div',{class:'sub',text:'Grain'}),phSl('grain.amt','Amount',0,100,1,{fmt:v=>Math.round(v)}),phSl('grain.size','Size',1,100,1,{fmt:v=>Math.round(v)}),phSl('grain.rough','Roughness',0,100,1,{fmt:v=>Math.round(v)})],phResetKeys(['vig','grain'],'Effects')),
    phSec('geo','Geometry & crop',phGeometry(),()=>{const n=phClone(p.s);n.geo=phDefaults().geo;phApply(n,'Reset geometry');}));
  requestAnimationFrame(phHistogram);}
/* ---- the tone curve ---- */
function phCurveEditor(){const wrap=el('div',{class:'phcurve'}),W=240;let ch=ph.curveCh||'m';
  const tabs=el('div',{class:'seg phcurvetabs',role:'radiogroup','aria-label':'Curve channel'}),cv=el('canvas',{width:W,height:W,class:'phcv','aria-label':'Tone curve'});
  const draw=()=>{const s=phS();if(!s)return;const x=cv.getContext('2d');x.clearRect(0,0,W,W);x.strokeStyle='rgba(255,255,255,.12)';x.lineWidth=1;for(let i=1;i<4;i++){x.beginPath();x.moveTo(i*W/4,0);x.lineTo(i*W/4,W);x.moveTo(0,i*W/4);x.lineTo(W,i*W/4);x.stroke();}
    x.strokeStyle='rgba(255,255,255,.2)';x.beginPath();x.moveTo(0,W);x.lineTo(W,0);x.stroke();const col={m:'#eee',r:'#f66',g:'#6e6',b:'#6af'}[ch];
    const lut=phCurveLut(s.curve[ch]);x.strokeStyle=col;x.lineWidth=2;x.beginPath();for(let i=0;i<256;i++){const px=i/255*W,py=W-lut[i]*W;i?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();
    x.fillStyle=col;for(const [a,b] of s.curve[ch]){x.beginPath();x.arc(a*W,W-b*W,5,0,6.3);x.fill();x.strokeStyle='#000';x.lineWidth=1;x.stroke();}};
  [['m','RGB'],['r','Red'],['g','Green'],['b','Blue']].forEach(([k,l])=>tabs.append(el('button',{class:'segb',role:'radio','aria-pressed':String(k===ch),text:l,onclick:()=>{ch=ph.curveCh=k;[...tabs.children].forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===l)));draw();}})));
  let drag=-1;const pos=e=>{const r=cv.getBoundingClientRect();return [clamp((e.clientX-r.left)/r.width,0,1),clamp(1-(e.clientY-r.top)/r.height,0,1)];};
  const pts=()=>phS().curve[ch];
  cv.addEventListener('pointerdown',e=>{e.preventDefault();const [x,y]=pos(e),P=pts();let best=-1,bd=.05;P.forEach((q,i)=>{const d=Math.hypot(q[0]-x,q[1]-y);if(d<bd){bd=d;best=i;}});
    if(e.button===2||(e.detail===2&&best>0&&best<P.length-1)){if(best>0&&best<P.length-1){P.splice(best,1);phDirty();phCommit('Tone curve');draw();}return;}
    if(best<0){P.push([x,y]);P.sort((a,b)=>a[0]-b[0]);best=P.findIndex(q=>q[0]===x&&q[1]===y);}drag=best;cv.setPointerCapture(e.pointerId);draw();});
  cv.addEventListener('pointermove',e=>{if(drag<0)return;const [x,y]=pos(e),P=pts(),lo=drag>0?P[drag-1][0]+.01:0,hi=drag<P.length-1?P[drag+1][0]-.01:1;P[drag]=[(drag===0||drag===P.length-1)?clamp(x,lo,hi):clamp(x,lo,hi),y];phDirty();draw();});
  const end=()=>{if(drag>=0){drag=-1;phCommit('Tone curve');}};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);cv.addEventListener('contextmenu',e=>e.preventDefault());
  wrap.append(tabs,cv,el('p',{class:'note',text:'Click to add a point, drag to move it, double-click a point to remove it.'}));draw();return wrap;}
/* ---- colour mixer ---- */
function phMixer(){let mode=ph.mixMode||'h';const box=el('div',{class:'dlg-grid'}),draw=()=>{box.replaceChildren(seg([['h','Hue'],['s','Saturation'],['l','Luminance']],mode,v=>{mode=ph.mixMode=v;draw();},'Mixer'),
    ...PH_BANDS.map(([n,hue],i)=>{const sl=phSl('mix.'+mode+'.'+i,n,-100,100,1);const t=sl.querySelector('input[type=range]');if(t)t.style.setProperty('--phc','hsl('+hue+',70%,50%)');sl.classList.add('phband');return sl;}));};draw();return [box];}
/* ---- colour grading ---- */
function phGrading(){const row=(key,title)=>[el('div',{class:'sub',text:title}),phSl('grade.'+key+'.h','Hue',0,360,1,{fmt:v=>Math.round(v)+'°'}),phSl('grade.'+key+'.s','Saturation',0,100,1,{fmt:v=>Math.round(v)}),phSl('grade.'+key+'.l','Luminance',-100,100,1)];
  const hues=[...document.querySelectorAll('#photoBody .phgh')];void hues;
  return [...row('sh','Shadows'),...row('mid','Midtones'),...row('hi','Highlights'),el('div',{class:'sub',text:'Mix'}),phSl('grade.blend','Blending',0,100,1,{fmt:v=>Math.round(v)}),phSl('grade.bal','Balance',-100,100,1)];}
/* ---- geometry and crop ---- */
const PH_ASPECTS=[['original','Original'],['1:1','1 : 1'],['4:5','4 : 5'],['5:4','5 : 4'],['3:2','3 : 2'],['2:3','2 : 3'],['16:9','16 : 9'],['9:16','9 : 16'],['free','Free']];
function phAspectValue(a,w,h){if(a==='original')return w/h;if(a==='free')return null;const [x,y]=a.split(':').map(Number);return x/y;}
function phGeometry(){const p=phP(),g=p.s.geo;
  const asp=el('select',{id:'phAspect','aria-label':'Crop shape'},...PH_ASPECTS.map(([v,t])=>el('option',{value:v,text:t})));asp.value=g.aspect||'original';
  asp.onchange=()=>{const n=phClone(p.s);n.geo.aspect=asp.value;const r=phAspectValue(asp.value,p.w,p.h);if(r){n.geo.crop=phFitCrop(n.geo.crop,r,p.w/p.h);}phApply(n,'Crop shape');};
  return [el('div',{class:'frow'},el('label',{for:'phAspect',text:'Crop shape'}),asp),
    el('div',{class:'frow'},el('button',{class:'btn sm'+(ph.crop?' primary':''),id:'phCropBtn',text:ph.crop?'Done cropping':'Crop…',title:'Drag the corners and edges on the photo',onclick:()=>phCropToggle()}),
      el('button',{class:'btn sm',text:'Reset crop',onclick:()=>{const n=phClone(p.s);n.geo.crop=[0,0,1,1];n.geo.aspect='original';phApply(n,'Reset crop');}})),
    el('div',{class:'frow'},el('button',{class:'btn sm',text:'Auto level',title:'Find the horizon or the walls and straighten the picture',onclick:phAutoLevel})),
    phSl('geo.angle','Straighten',-45,45,.1,{fmt:v=>v.toFixed(1)+'°'}),phSl('geo.vert','Vertical',-100,100,1),phSl('geo.horiz','Horizontal',-100,100,1),phSl('geo.dist','Lens distortion',-100,100,1),phSl('geo.ca','Colour fringing',-100,100,1),phSl('geo.scale','Scale',-50,100,1),
    el('div',{class:'frow'},chk('phFH','Flip across',!!g.flipH,v=>phSet('geo.flipH',v,'Flip')),chk('phFV','Flip down',!!g.flipV,v=>phSet('geo.flipV',v,'Flip')),chk('phAuto','Fill the frame',g.auto!==false,v=>phSet('geo.auto',v,'Fill the frame')))];}
/* the biggest crop of that shape, kept around the middle of the old one */
function phFitCrop(c,ratio,pr){const cw=c[2]-c[0],ch=c[3]-c[1],cx=(c[0]+c[2])/2,cy=(c[1]+c[3])/2;let w=cw,h=cw*pr/ratio;if(h>ch+1e-6){h=ch;w=ch*ratio/pr;}w=Math.min(w,1);h=Math.min(h,1);
  let x0=clamp(cx-w/2,0,1-w),y0=clamp(cy-h/2,0,1-h);return [x0,y0,x0+w,y0+h];}
function phCropToggle(){const p=phP();if(!p)return;ph.crop=!ph.crop;phSizeDoc();phBuildPanel();phDirty();fit();requestRender(true);if(!ph.crop)phCommit('Crop');if(typeof drawXfOverlay==='function')drawXfOverlay();}
