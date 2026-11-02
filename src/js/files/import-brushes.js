/* ================= Procreate and Clip Studio brushes (0.88) =================
   Procreate: .brush (one brush) and .brushset (many) are zip files; each brush holds Shape.png (the tip), Grain.png (the paper texture) and
   Brush.archive (its settings, a binary property list). We take the tip images and the main settings we have an equivalent for.
   Clip Studio Paint: a .sut file is a database with picture files inside it. We take the greyscale and see-through pictures as tips (the
   settings in the database are not read). Neither format's full brush engine can be copied, so brushes will look close, not identical. */
async function bzUnzip(buf){const d=new DataView(buf),u8=new Uint8Array(buf),out=[];let e=-1;
  for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-66000);i--)if(d.getUint32(i,true)===0x06054b50){e=i;break;}
  if(e<0)throw new Error('This file could not be read as a zip.');
  let n=d.getUint16(e+10,true),p=d.getUint32(e+16,true);const dec=new TextDecoder();
  while(n-->0&&d.getUint32(p,true)===0x02014b50){const meth=d.getUint16(p+10,true),csz=d.getUint32(p+20,true),nl=d.getUint16(p+28,true),xl=d.getUint16(p+30,true),cl=d.getUint16(p+32,true),off=d.getUint32(p+42,true);
    const name=dec.decode(u8.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;if(name.endsWith('/'))continue;
    const lo=off+30+d.getUint16(off+26,true)+d.getUint16(off+28,true),raw=u8.subarray(lo,lo+csz);
    let data;if(meth===0)data=raw.slice();else if(meth===8)data=new Uint8Array(await streamThrough(raw,'deflate-raw',true));else continue;
    out.push({name,data});}
  return out;}
/* ---- binary property list (bplist00) ---- */
function bpParse(u8){const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  if(u8.length<40||String.fromCharCode(...u8.subarray(0,8))!=='bplist00')throw new Error('not a property list');
  const t=u8.length-32,offSize=u8[t+6],refSize=u8[t+7],num=Number(dv.getBigUint64(t+8)),top=Number(dv.getBigUint64(t+16)),tab=Number(dv.getBigUint64(t+24));
  const uint=(p,n)=>{let v=0;for(let i=0;i<n;i++)v=v*256+u8[p+i];return v;},off=i=>uint(tab+i*offSize,offSize),memo=new Map();
  const lenAt=(p,m)=>{let l=m&15,q=p+1;if(l===15){const b=u8[q],nb=1<<(b&15);l=uint(q+1,nb);q+=1+nb;}return [l,q];};
  function obj(i){if(memo.has(i))return memo.get(i);const p=off(i),m=u8[p],hi=m>>4;let v;
    if(hi===0)v=m===8?false:m===9?true:null;
    else if(hi===1)v=uint(p+1,1<<(m&15));
    else if(hi===2){const n=1<<(m&15);v=n===4?dv.getFloat32(p+1):dv.getFloat64(p+1);}
    else if(hi===3)v=dv.getFloat64(p+1);
    else if(hi===4){const [l,q]=lenAt(p,m);v=u8.slice(q,q+l);}
    else if(hi===5){const [l,q]=lenAt(p,m);v=String.fromCharCode(...u8.subarray(q,q+l));}
    else if(hi===6){const [l,q]=lenAt(p,m);let s='';for(let k=0;k<l;k++)s+=String.fromCharCode(dv.getUint16(q+k*2));v=s;}
    else if(hi===8)v={uid:uint(p+1,(m&15)+1)};
    else if(hi===10){const [l,q]=lenAt(p,m);v=[];memo.set(i,v);for(let k=0;k<l;k++)v.push(obj(uint(q+k*refSize,refSize)));}
    else if(hi===13){const [l,q]=lenAt(p,m);v={};memo.set(i,v);for(let k=0;k<l;k++){const key=obj(uint(q+k*refSize,refSize));v[String(key)]=obj(uint(q+(l+k)*refSize,refSize));}}
    memo.set(i,v);return v;}
  return obj(top);}
/* an NSKeyedArchiver file: follow the object references into plain nested values */
function bpUnarchive(root){const objs=root&&root.$objects;if(!objs)return root;const seen=new Set();
  const res=(v,depth)=>{if(depth>14)return null;if(v&&typeof v==='object'&&!Array.isArray(v)&&!(v instanceof Uint8Array)&&'uid' in v&&Object.keys(v).length===1)return res(objs[v.uid],depth+1);
    if(v==='$null')return null;if(Array.isArray(v))return v.map(x=>res(x,depth+1));
    if(v&&typeof v==='object'&&!(v instanceof Uint8Array)){const o={};
      if(v['NS.keys']&&v['NS.objects']){v['NS.keys'].forEach((k,i)=>{o[String(res(k,depth+1))]=res(v['NS.objects'][i],depth+1);});return o;}
      if(v['NS.objects']&&!v['NS.keys'])return v['NS.objects'].map(x=>res(x,depth+1));
      for(const k in v)if(k!=='$class')o[k]=res(v[k],depth+1);return o;}
    return v;};
  const top=root.$top&&root.$top.root?res(root.$top.root,0):res(objs[1],0);return top;}
function bpFind(o,key,depth=0){if(!o||typeof o!=='object'||depth>8)return undefined;if(key in o&&o[key]!=null&&typeof o[key]!=='object')return o[key];
  for(const k in o){const r=bpFind(o[k],key,depth+1);if(r!==undefined)return r;}return undefined;}
/* ---- pictures ---- */
async function bzBitmap(bytes){const bmp=await createImageBitmap(new Blob([bytes],{type:'image/png'})),c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bmp,0,0);return x.getImageData(0,0,c.width,c.height);}
/* the shape of a tip from a picture: its see-through part when it has one, else its brightness (dark paint on white, or white paint on dark);
   a colourful picture (a preview thumbnail) is not a tip, so it returns null */
function bzTipAlpha(im){const {data,width:w,height:h}=im,n=w*h;let trans=0,col=0,sum=0;
  for(let i=0;i<n;i++){const j=i*4,r=data[j],g=data[j+1],b=data[j+2];if(data[j+3]<250)trans++;if(Math.max(r,g,b)-Math.min(r,g,b)>24)col++;sum+=(r*.299+g*.587+b*.114);}
  const a=new Uint8Array(n);
  if(trans>n*.02){for(let i=0;i<n;i++)a[i]=data[i*4+3];return {w,h,a};}
  if(col>n*.2)return null;
  const mean=sum/n,invert=mean>140;for(let i=0;i<n;i++){const l=data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114;a[i]=Math.round(clamp(invert?255-l:l,0,255));}
  return {w,h,a};}
function bzPresetFromTip(name,tip,extra){const t=makeTip(name,tip.w,tip.h,tip.a);return {tipObj:t,preset:Object.assign({},BRUSH_DEFAULTS,{name,tool:'brush',tip:t,size:clamp(Math.max(24,Math.min(tip.w,tip.h)/4),8,400),spacing:.15,pSize:true,minSize:.3,smoothing:.25},extra||{})};}
/* the settings we have an equivalent for (Procreate's names for them) */
function bzProcreateSettings(a,notes){const n=k=>{const v=bpFind(a,k);return typeof v==='number'?v:undefined;},b=k=>bpFind(a,k)===true,x={},sp=n('plotSpacing');
  /* key names checked against a real .brushset (0.93.2): shapeRotation is not an angle (1.0 there), shapeCount is a fraction of 16, sizes are fractions of the biggest brush */
  if(sp!=null)x.spacing=clamp(sp,.01,1.5);const rd=n('shapeRoundness');if(rd!=null&&rd>0)x.roundness=clamp(rd,.05,1);
  const ang=n('shapeAngle');if(ang)x.angle=Math.abs(ang)<=6.3?ang*180/Math.PI:ang;
  const cnt=n('shapeCount');if(cnt>0)x.count=clamp(Math.round(cnt<=1?cnt*16:cnt),1,8);
  const scat=n('shapeScatter');if(scat>0){x.scatter=clamp(scat,0,4);x.bothAxes=true;}const mo=n('maxOpacity');if(mo>0&&mo<=1)x.opacity=mo;
  const ps=n('dynamicsPressureSize'),po=n('dynamicsPressureOpacity');if(ps!=null)x.pSize=ps>0.02;if(po!=null)x.pOpacity=po>0.02;
  const mn=n('minSize');if(x.pSize&&mn>0)x.minSize=clamp(mn,0,1);
  const jit=n('plotJitter');if(jit>0)x.scatter=Math.max(x.scatter||0,clamp(jit,0,2));
  if(b('shapeAzimuth'))x.followDir=true;if(b('shapeRandomise'))x.angleJitter=1;
  const sj=n('dynamicsJitterSize');if(sj>0)x.sizeJitter=clamp(sj,0,1);
  const hj=Math.max(n('dynamicsJitterHue')||0,n('dynamicsJitterStrokeHue')||0),sj2=Math.max(n('dynamicsJitterSaturation')||0,n('dynamicsJitterStrokeSaturation')||0),vj=Math.max(n('dynamicsJitterLightness')||0,n('dynamicsJitterDarkness')||0,n('dynamicsJitterStrokeLightness')||0,n('dynamicsJitterStrokeDarkness')||0);
  if(hj>0||sj2>0||vj>0){x.hueJitter=clamp(hj,0,1);x.satJitter=clamp(sj2,0,1);x.valJitter=clamp(vj,0,1);x.jitterPerStroke=!((n('dynamicsJitterHue')||0)+(n('dynamicsJitterSaturation')||0)+(n('dynamicsJitterLightness')||0)+(n('dynamicsJitterDarkness')||0)>0);}
  const sm=n('plotSmoothing');if(sm>0)x.smoothing=clamp(sm,0,1);
  const ps2=n('paintSize');if(ps2>0)x.size=clamp(Math.round(ps2*800),4,400);
  const gp=bpFind(a,'bundledGrainPath');if(typeof gp==='string'&&!/blank/i.test(gp)){x.grain=clamp(.45*(n('grainDepth')==null?1:n('grainDepth')),.1,.9);notes.add('Grain textures were approximated with the Grain setting; the grain picture itself is not used.');}
  const bm=n('blendMode');if(bm>0)notes.add('Brush blend modes were not applied.');
  notes.add('Procreate settings such as pressure curves, tapering, wet mix and wet edges are not applied.');return x;}
async function importProcreate(file){const entries=await bzUnzip(await file.arrayBuffer()),notes=new Set(),groups=new Map();
  for(const e of entries){const i=e.name.lastIndexOf('/'),dir=i<0?'':e.name.slice(0,i),leaf=e.name.slice(i+1);if(!groups.has(dir))groups.set(dir,{});groups.get(dir)[leaf]=e.data;}
  const presets=[],tips=[];let k=0;
  let builtin=0;
  for(const [dir,g] of groups){const leafDir=dir.split('/').pop();if(/^reset$/i.test(leafDir))continue;if(/^sub\d+$/i.test(leafDir)){notes.add('Procreate’s second (sub) brushes were not imported.');continue;}const shapeKey=Object.keys(g).find(x=>/^shape(\.png)?$/i.test(x)||/^shape.*\.png$/i.test(x)),archKey=Object.keys(g).find(x=>/\.archive$/i.test(x));if(!shapeKey&&!archKey)continue;
    let name=null,extra={};if(archKey){try{const arch=bpUnarchive(bpParse(g[archKey])),nm=bpFind(arch,'name');if(typeof nm==='string'&&nm)name=nm;extra=bzProcreateSettings(arch,notes);}catch(e){notes.add('One brush’s settings could not be read; it uses default settings.');}}
    const tip=shapeKey?bzTipAlpha(await bzBitmap(g[shapeKey])):null;if(shapeKey&&!tip){notes.add('A tip picture was in colour and was skipped.');continue;}
    k++;const nm=name||(dir&&!/^[0-9A-F-]{16,}$/i.test(dir.split('/').pop())?dir.split('/').pop():baseName(file.name)+(groups.size>1?' '+k:''));
    /* (0.93.2) a brush with a grain picture: the paper-like grain is approximated with the Grain setting */
    if(Object.keys(g).some(x=>/^grain/i.test(x))){extra=Object.assign({grain:.45},extra);notes.add('Grain textures were approximated with the Grain setting; the grain picture itself is not used.');}
    if(!tip){/* uses one of Procreate's own built-in shapes, which are not stored in the file: a round tip stands in so the settings still come across */
      builtin++;presets.push(Object.assign({},BRUSH_DEFAULTS,{name:nm,tool:'brush',tip:null,size:50,hardness:.7,spacing:.15,pSize:true,minSize:.3,smoothing:.25},extra));continue;}
    const r=bzPresetFromTip(nm,tip,extra);tips.push(r.tipObj);presets.push(r.preset);}
  if(builtin)notes.add(builtin+' brush'+(builtin===1?' uses':'es use')+' Procreate’s own built-in shapes, which are not stored in the file; a round tip stands in for '+(builtin===1?'it':'them')+'.');
  return {presets,tips,notes};}
async function importCsp(file){const u8=new Uint8Array(await file.arrayBuffer()),notes=new Set(),presets=[],tips=[],sig=[137,80,78,71,13,10,26,10];
  const at=i=>{for(let k=0;k<8;k++)if(u8[i+k]!==sig[k])return false;return true;};let k=0;
  for(let i=0;i<u8.length-16&&presets.length<60;i++){if(u8[i]!==137||!at(i))continue;
    let j=i+8,ok=false;while(j+12<=u8.length){const len=(u8[j]<<24|u8[j+1]<<16|u8[j+2]<<8|u8[j+3])>>>0,type=String.fromCharCode(u8[j+4],u8[j+5],u8[j+6],u8[j+7]);j+=12+len;if(type==='IEND'){ok=true;break;}if(len>u8.length)break;}
    if(!ok)continue;try{const im=await bzBitmap(u8.slice(i,j)),tip=im.width>=8&&im.height>=8?bzTipAlpha(im):null;if(tip){k++;const r=bzPresetFromTip(baseName(file.name)+(k>1?' '+k:''),tip);tips.push(r.tipObj);presets.push(r.preset);}}catch(e){}i=j-1;}
  notes.add('Clip Studio brushes are read for their tip pictures only. Their settings (spacing, dynamics, texture) are not read, so adjust the brush after importing.');return {presets,tips,notes};}
async function importBrushFile(file){const ext=extOf(file.name);let r;
  try{r=ext==='sut'||ext==='sutb'?await importCsp(file):await importProcreate(file);}catch(e){throw new Error('This brush file could not be read: '+e.message);}
  if(!r.presets.length)throw new Error('No brush tips were found in “'+file.name+'”.');
  const set={id:'imp-'+Date.now(),name:baseName(file.name),presets:r.presets,tips:r.tips};addSet(set);applyPreset(r.presets[0]);
  const msg='Imported '+r.presets.length+' brush'+(r.presets.length===1?'':'es')+' from “'+set.name+'”.';
  if(r.notes.size)openDialog({title:'Brushes imported',okLabel:null,cancelLabel:'OK',body:el('div',{class:'dlg-grid'},el('p',{class:'note',text:msg+' Some settings are approximated:'}),el('ul',{class:'report'},...[...r.notes].map(n=>el('li',{text:n}))))});
  else toast(msg);return r.presets.length;}
