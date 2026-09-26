/* ================= ABR brushes ================= */
function readAbrLegacy(buf){const dv=new DataView(buf),src=new Uint8Array(buf),ver=dv.getInt16(0),count=dv.getInt16(2),out=[];let o=4;
  for(let i=0;i<count&&o<buf.byteLength;i++){const type=dv.getInt16(o),size=dv.getInt32(o+2),st=o+6;
    if(type===1){out.push({name:'Round '+dv.getInt16(st+6),size:dv.getInt16(st+6),spacing:dv.getInt16(st+4)/100,roundness:dv.getInt16(st+8)/100,angle:dv.getInt16(st+10),hardness:dv.getInt16(st+12)/100});}
    else if(type===2){let p=st+4;const spacing=dv.getInt16(p);p+=2;let name='Sampled brush '+(i+1);
      if(ver===2){const n=dv.getInt32(p);p+=4;let s='';for(let k=0;k<n;k++){const c=dv.getUint16(p);p+=2;if(c)s+=String.fromCharCode(c);}if(s)name=s;}
      p+=1+8;const top=dv.getInt32(p),left=dv.getInt32(p+4),bottom=dv.getInt32(p+8),right=dv.getInt32(p+12);p+=16;const depth=dv.getInt16(p);p+=2;const comp=src[p];p+=1;
      const w=right-left,h=bottom-top,bpc=depth>8?2:1;if(w>0&&h>0){let raw;
        if(comp===0)raw=src.subarray(p,p+w*h*bpc);else{p+=h*2;raw=unpackBits(src,p,w*h*bpc).data;}
        const a=new Uint8Array(w*h);for(let k=0;k<w*h;k++)a[k]=raw[k*bpc];out.push({name,spacing:spacing/100,tip:{w,h,alpha:a}});}}
    o=st+size;}
  return out;}
function presetFromAbr(b,samples,notes){const sh=b.shape||{};
  const p=Object.assign({},BRUSH_DEFAULTS,{name:b.name||'Brush',tool:'brush',size:clamp(Math.round(sh.size||30),1,500),spacing:sh.spacingOn===false?.05:clamp(sh.spacing||.25,.01,1.5),
    angle:sh.angle||0,roundness:clamp(sh.roundness==null?1:sh.roundness,.05,1),flipX:!!sh.flipX,flipY:!!sh.flipY,pSize:false,pOpacity:false,minSize:0,smoothing:.2});
  if(sh.type==='sampled'){const t=samples.get(sh.sampledData);if(t)p.tip=t;else notes.add('Some brushes referenced tip images missing from the file; they use a round tip.');}
  else if(sh.type==='computed')p.hardness=sh.hardness==null?1:sh.hardness;
  else{p.tip=TIPS.bristle;p.followDir=true;notes.add('Bristle and erodible tips are approximated with a flat bristle tip.');}
  const sd=b.shapeDynamics;if(sd){const sz=sd.sizeDynamics||{},an=sd.angleDynamics||{};
    if(sz.control==='pen pressure'){p.pSize=true;p.minSize=sd.minimumDiameter||0;}else if(sz.control&&sz.control!=='off')notes.add('Size controls other than pen pressure (tilt, fade, wheel) were ignored.');
    p.sizeJitter=sz.jitter||0;if(an.control==='direction'||an.control==='initial direction')p.followDir=true;p.angleJitter=an.jitter||0;p.randFlipX=!!sd.flipX;p.randFlipY=!!sd.flipY;}
  const sc=b.scatter;if(sc){p.scatter=clamp((sc.scatterDynamics&&sc.scatterDynamics.jitter)||0,0,4);p.bothAxes=!!sc.bothAxes;p.count=clamp(Math.round(sc.count||1),1,8);}
  const tr=b.transfer;if(tr){if((tr.opacityDynamics&&tr.opacityDynamics.control==='pen pressure')||(tr.flowDynamics&&tr.flowDynamics.control==='pen pressure'))p.pOpacity=true;}
  if(b.texture)notes.add('Texture (pattern) settings are not applied.');if(b.dualBrush)notes.add('Dual brush settings are not applied.');if(b.colorDynamics)notes.add('Color dynamics are not applied.');
  return p;}
async function importABR(file){
  const buf=await file.arrayBuffer(),dv=new DataView(buf),ver=dv.getInt16(0),setName=baseName(file.name),notes=new Set(),presets=[],tips=[];
  if(ver===1||ver===2){for(const r of readAbrLegacy(buf)){
      if(r.tip){const t=makeTip(r.name,r.tip.w,r.tip.h,r.tip.alpha);tips.push(t);presets.push(Object.assign({},BRUSH_DEFAULTS,{name:r.name,tool:'brush',tip:t,size:clamp(Math.max(r.tip.w,r.tip.h),1,500),spacing:clamp(r.spacing||.25,.01,1.5),pSize:false,smoothing:.2}));}
      else presets.push(Object.assign({},BRUSH_DEFAULTS,{name:r.name,tool:'brush',size:clamp(r.size||20,1,500),hardness:clamp(r.hardness,0,1),roundness:clamp(r.roundness||1,.05,1),angle:r.angle||0,spacing:clamp(r.spacing||.25,.01,1.5),pSize:false}));}}
  else{needLib('agPsd','Brush import');let abr;try{abr=agPsd.readAbr(new Uint8Array(buf));}catch(e){throw new Error('This brush file could not be read: '+e.message);}
    const samples=new Map();for(const s of abr.samples){if(s.bounds.w>0&&s.bounds.h>0){const t=makeTip('Tip '+(samples.size+1),s.bounds.w,s.bounds.h,s.alpha);samples.set(s.id,t);tips.push(t);}}
    for(const b of abr.brushes){const p=presetFromAbr(b,samples,notes);if(p.tip&&p.tip.name.startsWith('Tip '))p.tip.name=p.name;presets.push(p);}
    const used=new Set(presets.map(p=>p.tip));for(const t of samples.values())if(!used.has(t))presets.push(Object.assign({},BRUSH_DEFAULTS,{name:t.name,tool:'brush',tip:t,size:clamp(Math.max(t.w,t.h),1,500),spacing:.25,pSize:false}));}
  if(!presets.length)throw new Error('No brushes were found in “'+file.name+'”.');
  const set={id:'abr-'+Date.now(),name:setName,presets,tips};addSet(set);applyPreset(presets[0]);
  const msg='Imported '+presets.length+' brush'+(presets.length===1?'':'es')+' from “'+setName+'”.';
  if(notes.size)openDialog({title:'Brushes imported',okLabel:null,cancelLabel:'OK',body:el('div',{class:'dlg-grid'},el('p',{class:'note',text:msg+' Some Photoshop brush settings are approximated:'}),el('ul',{class:'report'},...[...notes].map(n=>el('li',{text:n}))))});
  else toast(msg);}
function tipFromLayer(){const L=needLayer();if(!L)return;const W=doc.w,H=doc.h,px=toStraight(readPremult(L.target),8);
  let trans=0;for(let i=3;i<px.length;i+=4)if(px[i]<250)trans++;const useAlpha=trans>W*H*.01;
  const v=new Uint8Array(W*H);let x0=W,y0=H,x1=-1,y1=-1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,j=i*4,a=useAlpha?px[j+3]:255-Math.round(px[j]*.299+px[j+1]*.587+px[j+2]*.114);v[i]=a;if(a>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
  if(x1<0){toast('The active layer is empty, so there is nothing to make a tip from.');return;}
  const w=x1-x0+1,h=y1-y0+1,a=new Uint8Array(w*h);for(let y=0;y<h;y++)a.set(v.subarray((y0+y)*W+x0,(y0+y)*W+x0+w),y*w);
  const t=makeTip(L.name+' tip',w,h,a);let set=library.find(s=>s.id==='custom');if(!set){set={id:'custom',name:'Custom tips',presets:[],tips:[]};library.push(set);}
  const p=Object.assign({},BRUSH_DEFAULTS,{name:L.name+' tip',tool:'brush',tip:t,size:clamp(Math.max(w,h),4,500),spacing:.2,pSize:true,minSize:.3});
  set.presets.push(p);set.tips.push(t);saveSet(set);applyPreset(p);
  toast('Made a brush tip from “'+L.name+'” using its '+(useAlpha?'transparency':'dark areas')+'.');}
$('#abrBtn').addEventListener('click',()=>pickFile('abr'));
$('#tipBtn').addEventListener('click',tipFromLayer);
