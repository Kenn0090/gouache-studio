/* ================= Photo tab: photos strip, presets, history, copy and paste, saving the edits, export ================= */
/* ---- presets (their values go on top of what the photo has) ---- */
const PH_PRESETS=[
  ['Look',[['Vivid',{con:18,vib:35,sat:8,cla:12,hi:-15,sh:15}],['Soft matte',{con:-12,bl:25,sh:20,sat:-8,curve:{m:[[0,.08],[.5,.5],[1,.94]]}}],['Warm film',{temp:18,tint:4,con:8,sat:-6,grain:{amt:18},curve:{m:[[0,.05],[.25,.22],[.75,.8],[1,.96]]}}],['Teal & orange',{con:12,grade:{sh:{h:195,s:35,l:0},hi:{h:35,s:30,l:0},blend:60},vib:12}],
    ['Faded',{con:-18,bl:35,sat:-18,curve:{m:[[0,.12],[1,.9]]}}],['Punchy',{con:30,hi:-20,sh:20,cla:20,vib:20,sat:6,wh:10,bl:-10}],['Cinematic',{con:14,sat:-10,temp:-6,grade:{sh:{h:210,s:30,l:-5},mid:{h:35,s:10,l:0},hi:{h:45,s:25,l:0},blend:55,bal:10},vig:{amt:-22,mid:55,feather:60},grain:{amt:10}}],['Golden hour',{temp:30,tint:6,exp:.15,hi:-25,sh:20,vib:25,grade:{hi:{h:40,s:30,l:0},blend:55}}],
    ['Cool blue',{temp:-22,tint:-4,con:8,vib:10,grade:{sh:{h:215,s:25,l:0},blend:50}}],['Warm sunset',{temp:28,tint:8,exp:.1,con:10,vib:22,hi:-18,grade:{hi:{h:25,s:35,l:0},sh:{h:340,s:15,l:0},blend:55}}],['Muted earth',{sat:-22,vib:-5,con:6,temp:8,mix:{s:[-10,-8,-5,-15,-20,-25,-15,-10]}}],
    ['Dreamy',{exp:.15,con:-18,cla:-25,hi:-10,sh:25,vib:10,bl:20,vig:{amt:12,mid:60,feather:80}}],['Crisp',{con:16,tex:30,cla:18,dehaze:8,sharp:{amt:55,rad:1,mask:15}}],['Pastel',{exp:.2,con:-20,sat:-10,vib:25,bl:30,sh:30,hi:-10}],
    ['HDR look',{dehaze:20,cla:35,tex:30,hi:-55,sh:55,wh:15,bl:-15,vib:25}],['Matte black',{con:12,bl:40,sat:-8,sh:-10}],['Neon night',{con:25,vib:40,sat:12,sh:-15,bl:-12,cla:12,grade:{sh:{h:260,s:40,l:-4},hi:{h:320,s:30,l:0},blend:65}}]]],
  ['Film',[['Portra-like',{temp:6,tint:3,con:-6,sat:-10,hi:-12,sh:14,curve:{m:[[0,.05],[.25,.24],[.75,.78],[1,.96]]},grain:{amt:14,size:26}}],['Ektar-like',{con:18,vib:28,sat:10,temp:4,grain:{amt:12}}],['Slide film',{con:28,sat:20,hi:-12,bl:-10,vib:12}],['Fuji cool',{temp:-10,tint:-6,con:8,sat:-4,mix:{s:[0,0,0,12,10,8,0,0]},grain:{amt:12}}],
    ['Vintage 70s',{temp:15,tint:8,con:-8,sat:-12,bl:30,wh:-10,grain:{amt:22,size:28},curve:{m:[[0,.08],[.3,.28],[.7,.74],[1,.92]],b:[[0,.05],[.5,.46],[1,.9]]},vig:{amt:-22,mid:50,feather:70}}],['Bleach bypass',{con:35,sat:-45,cla:25,hi:-10,sh:-8,tex:20,grain:{amt:14}}],
    ['Cross process',{con:18,vib:20,curve:{r:[[0,0],[.5,.58],[1,1]],b:[[0,.12],[.5,.45],[1,.85]]}}],['Lomo',{con:30,sat:25,temp:8,vig:{amt:-55,mid:35,feather:60},grain:{amt:16}}],['Polaroid',{temp:10,tint:6,con:-14,sat:-10,bl:35,exp:.1,curve:{m:[[0,.1],[1,.93]],b:[[0,.1],[1,.85]]},vig:{amt:-15,mid:55,feather:70}}]]],
  ['Portrait',[['Soft skin',{cla:-22,tex:-18,hi:-10,sh:12,vib:-6,nr:{lum:12}}],['Bright & airy',{exp:.3,con:-8,sh:30,wh:15,sat:-8,temp:4}],['Moody',{exp:-.2,con:20,sh:-10,sat:-18,vig:{amt:-30,mid:45,feather:70}}],
    ['Warm glow',{temp:12,tint:5,exp:.15,cla:-10,hi:-12,sh:12,vib:8,grade:{hi:{h:35,s:20,l:0},blend:50}}],['Cool studio',{temp:-8,con:12,cla:8,tex:8,vib:-4}],['Beauty',{cla:-28,tex:-25,exp:.15,sh:15,hi:-8,sat:-4,nr:{lum:18}}],
    ['Dramatic',{con:35,cla:25,exp:-.15,hi:-25,sh:-18,bl:-18,vig:{amt:-35,mid:40,feather:60}}],['Pastel portrait',{exp:.25,con:-18,sat:-12,sh:30,bl:25,temp:6,vib:12}],['Golden skin',{temp:16,tint:6,vib:10,mix:{h:[0,-6,0,0,0,0,0,0],s:[8,12,0,0,0,0,0,0],l:[4,6,0,0,0,0,0,0]}}]]],
  ['Landscape',[['Rich sky',{dehaze:22,cla:14,vib:28,hi:-30,mix:{s:[0,8,6,10,22,30,10,0],l:[0,0,0,0,-10,-18,0,0]}}],['Lush green',{vib:20,mix:{h:[0,0,8,-8,0,0,0,0],s:[0,0,15,30,10,0,0,0]}}],['Clear air',{dehaze:30,con:10,tex:18}],
    ['Sunset glow',{temp:25,tint:10,hi:-35,sh:25,vib:35,dehaze:12,mix:{s:[15,25,20,0,0,10,10,12],l:[0,-4,0,0,0,-10,0,0]},grade:{hi:{h:20,s:35,l:0},blend:60}}],['Foggy morning',{dehaze:-28,exp:.2,con:-18,sat:-15,bl:25,temp:-4}],
    ['Autumn',{temp:18,vib:30,con:10,cla:10,mix:{h:[0,-8,-10,-20,0,0,0,0],s:[10,25,25,-10,0,0,0,0]}}],['Deep blue sky',{hi:-25,cla:12,dehaze:12,mix:{s:[0,0,0,0,25,35,10,0],l:[0,0,0,0,-18,-28,0,0]}}],['Snow bright',{exp:.35,con:12,wh:15,sh:25,temp:-8,vib:5}],
    ['Desert warm',{temp:22,tint:6,con:14,vib:15,dehaze:10,mix:{s:[8,16,10,-10,-10,-5,0,0]}}],['Misty forest',{dehaze:-18,con:-6,vib:12,temp:-5,tint:-4,mix:{s:[0,0,0,12,5,0,0,0],l:[0,0,0,-10,0,0,0,0]},grade:{sh:{h:170,s:20,l:0},blend:50}}],['Tropical',{vib:40,sat:10,con:10,temp:6,mix:{s:[0,10,10,25,35,30,0,0]}}]]],
  ['Street & night',[['Gritty street',{con:30,sat:-25,tex:35,cla:30,sh:-10,grain:{amt:28,size:30},vig:{amt:-20,mid:50,feather:60}}],['Rainy day',{temp:-12,tint:-4,sat:-22,con:8,dehaze:14,vib:-5,grade:{sh:{h:210,s:25,l:0},blend:50}}],
    ['Cyberpunk',{con:28,vib:35,sh:-20,bl:-15,cla:15,grade:{sh:{h:270,s:45,l:-5},mid:{h:190,s:20,l:0},hi:{h:330,s:35,l:0},blend:70,bal:-5}}],['Night boost',{exp:.5,sh:45,bl:-8,vib:15,con:10,nr:{lum:25,col:30}}]]],
  ['Black & white',[['B&W natural',{bw:true,con:8}],['B&W high contrast',{bw:true,con:40,cla:20,bl:-15,wh:15}],['B&W soft',{bw:true,con:-10,bl:20,sh:20,grain:{amt:12}}],['Silver film',{bw:true,con:18,cla:12,grain:{amt:25,size:30},vig:{amt:-18,mid:55}}],
    ['Noir',{bw:true,con:50,bl:-25,wh:15,cla:25,vig:{amt:-35,mid:40,feather:60},grain:{amt:20}}],['High key',{bw:true,exp:.45,con:-10,sh:25,bl:10,wh:15}],['Low key',{bw:true,exp:-.35,con:30,bl:-20,vig:{amt:-30,mid:45,feather:65}}],
    ['Infrared',{bw:true,con:20,exp:.15,cla:15,mix:{l:[0,20,50,60,-20,-50,-20,0]},vig:{amt:-15,mid:55,feather:70}}],['Red filter',{bw:true,con:20,mix:{l:[40,35,25,-20,-40,-60,-20,10]}}],['B&W portrait',{bw:true,cla:-8,con:6,mix:{l:[10,8,0,0,0,0,0,0]}}],
    ['Sepia',{bw:true,con:8,grade:{sh:{h:30,s:35,l:0},mid:{h:35,s:45,l:0},hi:{h:45,s:30,l:0},blend:60}}],['Selenium',{bw:true,con:15,grade:{sh:{h:260,s:30,l:0},hi:{h:40,s:12,l:0},blend:50}}],['Cyanotype',{bw:true,con:12,grade:{sh:{h:215,s:70,l:-8},mid:{h:205,s:55,l:0},hi:{h:195,s:25,l:5},blend:70}}]]],
  ['Game art',[['Flat light',{hi:-45,sh:45,con:-20,dehaze:-8,cla:-10,wh:-10,bl:15}],['Texture detail',{tex:45,cla:25,sharp:{amt:60,rad:.8,mask:10}}],['Hand-painted pop',{con:20,vib:35,sat:12,cla:-10,tex:-15}],['Boost albedo',{exp:.15,sat:15,con:-8,hi:-10,sh:15}],['Desaturate',{sat:-70}]]]];
function phMerge(a,b){for(const k in b){if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))phMerge(a[k],b[k]);else a[k]=phClone(b[k]);}return a;}
const phUserPresets=()=>{try{return JSON.parse(localStorage.getItem('gs.phPresets')||'[]');}catch(e){return [];}};
/* A preset goes on top of the photo as it was before the presets: clicking one after another swaps them instead of piling them up.
   (Any edit you make in between becomes the new starting point.) The Amount slider mixes the look in or out. */
function phApplyPreset(patch,name){const p=phP();if(!p)return;const now=JSON.stringify(p.s);let base=(p._pre&&p._pre.res===now)?p._pre.base:phClone(p.s);const amt=(ph.preAmt==null?100:ph.preAmt)/100;
  const full=phMerge(phClone(base),patch),n=amt>=1?full:phBlendSettings(base,full,amt);p._pre={base,patch,name,res:null};phApply(n,name);p._pre.res=JSON.stringify(p.s);document.querySelectorAll('#phPreBody .phpre').forEach(b=>b.classList.toggle('on',b.title===name));}
function phBlendSettings(a,b,t){if(typeof a==='number'&&typeof b==='number')return a+(b-a)*t;if(Array.isArray(a)&&Array.isArray(b)){if(a.length===b.length&&a.every(v=>typeof v==='number'||Array.isArray(v)))return a.map((v,i)=>phBlendSettings(v,b[i],t));return t>=.5?phClone(b):phClone(a);}
  if(a&&b&&typeof a==='object'&&typeof b==='object'){const o={};for(const k of Object.keys(b))o[k]=k in a?phBlendSettings(a[k],b[k],t):phClone(b[k]);return o;}return t>=.5?b:a;}
/* the Amount slider re-mixes the preset just applied */
function phPresetAmount(v){ph.preAmt=v;const p=phP();if(!p||!p._pre||p._pre.res!==JSON.stringify(p.s))return;const full=phMerge(phClone(p._pre.base),p._pre.patch);p.s=v>=100?full:phBlendSettings(p._pre.base,full,v/100);p._pre.res=JSON.stringify(p.s);phDirty();phHistLater(p._pre.name+' amount');}
function phSavePreset(){const p=phP();if(!p)return;const inp=el('input',{type:'text',id:'phPreName',value:'My look','aria-label':'Preset name'});
  openDialog({title:'Save preset',body:el('div',{class:'dlg-grid'},inp,el('p',{class:'note',text:'Saves this photo’s edits (not the crop or turn) so you can use them on other photos.'})),okLabel:'Save',onOk(){const n=inp.value.trim();if(!n)return false;const s=phClone(p.s);delete s.geo;const l=phUserPresets();l.push([n,s]);try{localStorage.setItem('gs.phPresets',JSON.stringify(l));}catch(e){}phBuildPre();toast('Saved the preset “'+n+'”.');}});setTimeout(()=>{inp.focus();inp.select();},0);}
/* a small picture of the current photo with each preset, so you can choose by eye */
/* with no photo open the little pictures show a built-in sample scene (sky, sun, hills, a house and a face) so every look can be judged */
function phSampleCanvas(){const W=240,H=160,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  let q=g.createLinearGradient(0,0,0,H*.62);q.addColorStop(0,'#3d78c8');q.addColorStop(.7,'#a9cdf0');q.addColorStop(1,'#f5d9a8');g.fillStyle=q;g.fillRect(0,0,W,H);
  q=g.createRadialGradient(176,40,2,176,40,34);q.addColorStop(0,'#fffbe6');q.addColorStop(.25,'#ffe9a0');q.addColorStop(1,'rgba(255,220,140,0)');g.fillStyle=q;g.fillRect(100,0,140,100);
  g.fillStyle='rgba(255,255,255,.9)';for(const [x,y,r] of [[50,34,13],[64,30,16],[80,35,12],[150,64,9],[160,61,11]]){g.beginPath();g.arc(x,y,r,0,7);g.fill();}
  g.fillStyle='#6f8c9c';g.beginPath();g.moveTo(0,104);g.lineTo(50,70);g.lineTo(92,100);g.lineTo(140,66);g.lineTo(200,104);g.lineTo(240,84);g.lineTo(240,120);g.lineTo(0,120);g.fill();
  q=g.createLinearGradient(0,96,0,H);q.addColorStop(0,'#5d9a45');q.addColorStop(1,'#2e5b2a');g.fillStyle=q;g.fillRect(0,100,W,60);
  g.fillStyle='#d9d2c4';g.fillRect(22,84,56,38);g.fillStyle='#b5412f';g.beginPath();g.moveTo(16,86);g.lineTo(50,58);g.lineTo(84,86);g.fill();g.fillStyle='#4a3224';g.fillRect(44,100,13,22);g.fillStyle='#f4e08a';g.fillRect(28,92,10,10);g.fillRect(62,92,10,10);
  g.fillStyle='#caa27a';g.fillRect(120,126,8,20);
  g.fillStyle='#2f4a7a';g.beginPath();g.moveTo(104,H);g.quadraticCurveTo(124,116,144,H);g.fill();
  q=g.createRadialGradient(121,104,3,124,108,16);q.addColorStop(0,'#f1c9a4');q.addColorStop(1,'#c58c66');g.fillStyle=q;g.beginPath();g.ellipse(124,108,13,16,0,0,7);g.fill();
  g.fillStyle='#3b2a20';g.beginPath();g.ellipse(124,98,14,9,0,Math.PI,0);g.fill();g.fillStyle='#2a2a2a';g.fillRect(118,106,3,2);g.fillRect(127,106,3,2);g.fillStyle='#a1493f';g.fillRect(120,115,9,2);
  g.fillStyle='#e0452e';g.beginPath();g.arc(196,128,6,0,7);g.fill();g.fillStyle='#f2c230';g.beginPath();g.arc(208,134,5,0,7);g.fill();g.fillStyle='#8a4fb8';g.beginPath();g.arc(186,138,5,0,7);g.fill();
  return c;}
function phSampleTarget(){if(ph.sample)return ph.sample;const c=phSampleCanvas(),t=makeTarget(c.width,c.height,8,false);phUploadInto({w:c.width,h:c.height,bm:c},t);return ph.sample=t;}
function phPreThumb(patch,key){const p=phP();const S=96;ph.tc=ph.tc||{};const ck=(p&&p.psrc?p.id:'sample')+'|'+key;if(ph.tc[ck])return ph.tc[ck];
  if(!p||!p.psrc){const sm=phSampleTarget(),k=S/sm.w,w=Math.round(sm.w*k),h=Math.round(sm.h*k);return phThumbOf(sm,w,h,patch,ck);}
  if(!p.small){const k=Math.min(1,S*2/Math.max(p.pw,p.ph)),w=Math.max(2,Math.round(p.pw*k)),h=Math.max(2,Math.round(p.ph*k));p.small=makeTarget(w,h,8,false);run(P.resample,p.small,{uSrc:p.psrc.tex,uOffset:[0,0],uScale:[p.pw/w,p.ph/h],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(p.pw/w)))}});}
  const sm=p.small,k=Math.min(1,S/Math.max(sm.w,sm.h)),w=Math.max(2,Math.round(sm.w*k)),h=Math.max(2,Math.round(sm.h*k));return phThumbOf(sm,w,h,patch,ck);}
function phThumbOf(sm,w,h,patch,ck){const t=makeTarget(w,h,8,false),s=phMerge(phDefaults(),patch);s.geo=phDefaults().geo;
  try{phRender(sm,t,s);const d=captureRegionNow(t,0,0,w,h).data,c=document.createElement('canvas');c.width=w;c.height=h;const id=new ImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,j=(y*w+x)*4;id.data[j]=d[i];id.data[j+1]=d[i+1];id.data[j+2]=d[i+2];id.data[j+3]=255;}c.getContext('2d').putImageData(id,0,0);return ph.tc[ck]=c.toDataURL('image/jpeg',.8);}
  finally{disposeTarget(t);}}
function phBuildPre(){const box=$('#phPreBody');if(!box)return;box.replaceChildren();const p=phP();
  const amtSl=makeSlider({id:'phPreAmt',label:'Amount',min:0,max:100,step:1,value:ph.preAmt==null?100:ph.preAmt,fmt:v=>Math.round(v)+'%',onInput:phPresetAmount,onChange:phPresetAmount});
  box.append(el('div',{class:'phbar'},el('button',{class:'btn sm',text:'Save current as preset…',onclick:phSavePreset}),el('button',{class:'btn sm',text:'Reset',onclick:phReset})),el('div',{class:'phpreamt'},amtSl.el));
  const lazy=[],mk=(name,patch,key)=>{const img=el('img',{alt:''}),on=p&&p._pre&&p._pre.name===name;lazy.push([img,patch,key]);return el('button',{class:'phpre'+(on?' on':''),title:name,onclick:()=>phApplyPreset(patch,name)},img,el('span',{text:name}));};
  for(const [grp,list] of PH_PRESETS)box.append(el('div',{class:'sub',text:grp}),el('div',{class:'phpregrid'},...list.map(([n,pt])=>mk(n,pt,'b:'+n))));
  const u=phUserPresets();if(u.length)box.append(el('div',{class:'sub',text:'My presets'}),el('div',{class:'phpregrid'},...u.map(([n,s],i)=>{const b=mk(n,s,'u:'+n);b.append(el('i',{class:'phprex',title:'Delete this preset',text:'×',onclick:e=>{e.stopPropagation();const l=phUserPresets();l.splice(i,1);localStorage.setItem('gs.phPresets',JSON.stringify(l));phBuildPre();}}));return b;})));
  if(!p)box.append(el('p',{class:'note',text:'These pictures show a sample scene. Open a photo to see the presets on it.'}));
  /* the little pictures are made a few at a time, so a long list opens at once */
  const tok=ph.preTok=(ph.preTok||0)+1;let i=0;const step=()=>{if(tok!==ph.preTok||!box.isConnected)return;for(let n=0;n<4&&i<lazy.length;n++,i++){const [img,patch,key]=lazy[i];img.src=phPreThumb(patch,key);}if(i<lazy.length)setTimeout(step,16);};step();}
/* ---- history and snapshots ---- */
function phRenderHist(){const box=$('#phHistBody');if(!box)return;box.replaceChildren();const p=phP();if(!p||!p.hist){box.append(el('p',{class:'note',text:'Edits show up here.'}));return;}
  box.append(el('div',{class:'phbar'},el('button',{class:'btn sm',text:'Undo',onclick:phUndo}),el('button',{class:'btn sm',text:'Redo',onclick:phRedo}),el('button',{class:'btn sm',text:'New snapshot',onclick:phSnapshot})));
  if(p.snaps.length)box.append(el('div',{class:'sub',text:'Snapshots'}),...p.snaps.map((sn,i)=>el('div',{class:'phrow'},el('button',{class:'btn sm',text:sn.name,onclick:()=>phApply(phClone(sn.s),'Snapshot “'+sn.name+'”')}),el('button',{class:'xbtn',text:'×','aria-label':'Delete snapshot',onclick:()=>{p.snaps.splice(i,1);phSidecarSoon();phRenderHist();}}))));
  box.append(el('div',{class:'sub',text:'History'}),el('div',{class:'phhist'},...p.hist.list.map((h,i)=>el('button',{class:'phhi'+(i===p.hist.i?' on':''),text:h.label,onclick:()=>phHistGo(i)})).reverse()));}
function phSnapshot(){const p=phP();if(!p)return;const inp=el('input',{type:'text',value:'Snapshot '+(p.snaps.length+1),'aria-label':'Snapshot name'});
  openDialog({title:'New snapshot',body:el('div',{class:'dlg-grid'},inp),okLabel:'Save',onOk(){const n=inp.value.trim()||'Snapshot';p.snaps.push({name:n,s:phClone(p.s)});phSidecarSoon();phRenderHist();}});setTimeout(()=>{inp.focus();inp.select();},0);}
/* ---- the photos strip ---- */
ph.sel=new Set();
const PH_FILTERS=[['all','All photos'],['r1','★ and up'],['r3','★★★ and up'],['r5','★★★★★'],['pick','Picked'],['rej','Rejected'],['edited','Edited']];
function phShown(p){const f=ph.filter||'all',r=p.rating|0;return f==='all'?true:f==='pick'?p.flag>0:f==='rej'?p.flag<0:f==='edited'?JSON.stringify(p.s)!==JSON.stringify(phDefaults()):r>=(+f.slice(1));}
function phRate(n){const p=phP();if(!p)return;p.rating=n;phSidecarSoon();phBuildLib();toast(n?'★'.repeat(n):'No stars');}
function phFlag(v){const p=phP();if(!p)return;p.flag=p.flag===v?0:v;phSidecarSoon();phBuildLib();toast(p.flag>0?'Picked':p.flag<0?'Rejected':'Flag removed');}
function phStep(d){let i=ph.cur+d;while(i>=0&&i<ph.photos.length&&!phShown(ph.photos[i]))i+=d;if(i>=0&&i<ph.photos.length)phSelect(i);}
function phBuildLib(){phBuildPre();phRenderHist();const box=$('#phLibBody');if(!box)return;box.replaceChildren();
  const bar=el('div',{class:'phbar'},el('button',{class:'btn sm primary',text:'Add photos…',onclick:phOpenDialog}),el('button',{class:'btn sm',text:'Paste edits to selected',title:'Paste the copied edits onto every selected photo (click with Ctrl or Shift to select several)',onclick:()=>phPaste(true)}),el('button',{class:'btn sm',text:'Export…',onclick:()=>dlgPhotoExport()}),
    el('span',{class:'dim',text:ph.photos.length?ph.photos.length+' photo'+(ph.photos.length===1?'':'s'):''}));
  const strip=el('div',{class:'phstrip',role:'listbox','aria-label':'Photos'});
  ph.photos.forEach((p,i)=>{if(!phShown(p))return;const b=el('button',{class:'phthumb'+(p.flag<0?' rej':'')+(i===ph.cur?' on':'')+(ph.sel.has(i)?' sel':''),role:'option','aria-selected':String(i===ph.cur),title:p.name+' · '+p.w+' × '+p.h,
      onclick:e=>{if(e.ctrlKey||e.metaKey){ph.sel.has(i)?ph.sel.delete(i):ph.sel.add(i);phBuildLib();return;}if(e.shiftKey&&ph.cur>=0){const a=Math.min(ph.cur,i),z=Math.max(ph.cur,i);for(let k=a;k<=z;k++)ph.sel.add(k);phBuildLib();return;}ph.sel.clear();phSelect(i);}},
      el('img',{src:p.thumb,alt:p.name}),el('span',{text:p.name}),el('em',{class:'phstars',text:(p.flag>0?'⚑ ':p.flag<0?'✕ ':'')+'★'.repeat(p.rating|0)}),el('i',{class:'phtx',title:'Remove from this list','aria-label':'Remove '+p.name,text:'×',onclick:e=>{e.stopPropagation();phRemove(i);}}));strip.append(b);});
  if(!ph.photos.length)strip.append(el('p',{class:'note',text:'Add photos, or drop them on the picture. Click one to edit it.'}));
  const fsel=el('select',{id:'phFilter','aria-label':'Show',title:'Show only some photos'},...PH_FILTERS.map(([v,t])=>el('option',{value:v,text:t})));fsel.value=ph.filter||'all';fsel.onchange=()=>{ph.filter=fsel.value;phBuildLib();};bar.append(fsel);
  box.append(bar,strip);}
function phRemove(i){const p=ph.photos[i];if(!p)return;phSidecarFlush();if(p.psrc)disposeTarget(p.psrc);if(p.small)disposeTarget(p.small);ph.photos.splice(i,1);ph.sel.clear();
  if(ph.cur===i){ph.cur=-1;if(ph.photos.length)phSelect(Math.min(i,ph.photos.length-1));else{if(ph.out){disposeTarget(ph.out);ph.out=null;}phBuildPanel();phDirty();}}else if(ph.cur>i)ph.cur--;phBuildLib();}
/* ---- copy and paste edits ---- */
const PH_GROUPS=[['Basic',['temp','tint','exp','con','hi','sh','wh','bl','tex','cla','dehaze','vib','sat','bw']],['Tone curve',['curve']],['Colour mixer',['mix']],['Point colour',['pts']],['Colour grading',['grade']],['Detail',['sharp','nr']],['Effects',['vig','grain']],['Masks',['local']],['Spot removal',['spots']],['Crop and turn',['geo']]];
function phCopy(){const p=phP();if(!p)return;ph.clip=phClone(p.s);toast('Copied the edits of “'+p.name+'”.');}
function phPaste(toSelected){if(!ph.clip){toast('Copy a photo’s edits first (Copy button).');return;}const targets=toSelected&&ph.sel.size?[...ph.sel]:[ph.cur];if(!targets.length||targets[0]<0)return;
  const on=new Set(PH_GROUPS.filter(g=>g[0]!=='Crop and turn').map(g=>g[0])),list=el('div',{class:'dlg-grid'},el('p',{class:'note',text:'Paste onto '+targets.length+' photo'+(targets.length===1?'':'s')+'. Pick what to paste.'}),
    ...PH_GROUPS.map(([n])=>chk('phpg_'+n.replace(/\W/g,''),n,on.has(n),v=>{v?on.add(n):on.delete(n);})));
  openDialog({title:'Paste edits',body:list,okLabel:'Paste',onOk(){const keys=PH_GROUPS.filter(g=>on.has(g[0])).flatMap(g=>g[1]);
    for(const i of targets){const p=ph.photos[i];if(!p)continue;const n=phClone(p.s);for(const k of keys)n[k]=phClone(ph.clip[k]);p.s=n;if(!p.hist)p.hist={list:[{label:'Open',s:phDefaults()}],i:0};
      const h=p.hist;h.list.push({label:'Paste edits',s:phClone(n)});h.i=h.list.length-1;phSidecarWrite(p);}
    phAfterSet();phRenderHist();phBuildLib();toast('Pasted the edits onto '+targets.length+' photo'+(targets.length===1?'':'s')+'.');}});}
/* ---- edits saved beside the photo (Lightroom keeps edits next to the photos too) ---- */
const phScKey=p=>'gs.ph.'+p.name+'.'+(p.file?p.file.size:0);
async function phSidecarLoad(p){try{let txt=null;if(p.path&&platform.isDesktop){try{const b=await platform.readFile(p.path+'.gphoto');txt=new TextDecoder().decode(b);}catch(e){}}
    if(!txt)txt=localStorage.getItem(phScKey(p));if(!txt)return;const o=JSON.parse(txt);if(!o||!o.s)return;p.s=phMerge(phDefaults(),o.s);p.snaps=o.snaps||[];p.rating=o.r|0;p.flag=o.f|0;phAiUnpack(o.ai);phRmUnpack(o.rmp);if(o.dq)phDepthUnpack(p,o.dq,false);else phDepthUnpack(p,o.dp,true);setTimeout(phBuildLib,0);p.hist={list:[{label:'Open',s:phClone(phDefaults())},{label:'Saved edits',s:phClone(p.s)}],i:1};
    if(phP()===p){phAfterSet();phRenderHist();}}catch(e){console.warn('edits not read',e);}}
function phSidecarWrite(p){if(!p)return;const o=JSON.stringify({v:1,app:'Gouache Studio',s:p.s,snaps:p.snaps,r:p.rating|0,f:p.flag|0,ai:phAiPack(p),rmp:phRmPack(p),dq:phDepthPack(p)});const def=JSON.stringify(phDefaults());
  try{if(JSON.stringify(p.s)===def&&!p.snaps.length&&!p.rating&&!p.flag){localStorage.removeItem(phScKey(p));}else localStorage.setItem(phScKey(p),o);}catch(e){}
  if(p.path&&platform.isDesktop&&(JSON.stringify(p.s)!==def||p.rating||p.flag))platform.writeFile(p.path+'.gphoto',new TextEncoder().encode(o)).catch(()=>{});}
let phSCT=0;function phSidecarSoon(){clearTimeout(phSCT);phSCT=setTimeout(()=>phSidecarWrite(phP()),1200);}
function phSidecarFlush(){clearTimeout(phSCT);if(phP())phSidecarWrite(phP());}
/* ---- export ---- */
async function phRenderFull(p,opt){const dec=await phDecode(p.file),t=makeTarget(dec.w,dec.h,phDecDepth(dec),false);try{phUploadInto(dec,t);phRmApply(t,p.s.rm);if(dec.bm&&dec.bm.close)dec.bm.close();
    const [cw,ch]=phOutSize(p.s,dec.w,dec.h);let W=cw,H=ch;if(opt.mode==='long'){const k=opt.long/Math.max(cw,ch);if(k<1||opt.up){W=Math.max(1,Math.round(cw*k));H=Math.max(1,Math.round(ch*k));}}else if(opt.mode==='pct'){W=Math.max(1,Math.round(cw*opt.pct/100));H=Math.max(1,Math.round(ch*opt.pct/100));}
    W=Math.min(W,MAX_DIM);H=Math.min(H,MAX_DIM);const out=makeTarget(W,H,8,false);try{phRender(t,out,p.s,{depth:phDepthTex(p),seed:p.seed||0});const px=readRGBA8(out),id=new ImageData(W,H),d=id.data;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,j=(y*W+x)*4;d[j]=px[i];d[j+1]=px[i+1];d[j+2]=px[i+2];d[j+3]=255;}
      const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').putImageData(id,0,0);return c;}finally{disposeTarget(out);}}finally{disposeTarget(t);}}
const PH_FMT=[['jpg','JPEG','image/jpeg'],['png','PNG','image/png'],['webp','WebP','image/webp']];
function dlgPhotoExport(){if(!ph.photos.length){toast('Open a photo first.');return;}const o={scope:ph.sel.size>1?'sel':'one',fmt:'jpg',q:90,mode:'orig',long:2048,pct:50,up:false};
  const sel=(id,label,opts,get,set)=>{const s=el('select',{id,'aria-label':label},...opts.map(([v,t])=>el('option',{value:String(v),text:t})));s.value=String(get());s.onchange=()=>{set(s.value);upd();};return el('div',{class:'frow'},el('label',{for:id,text:label}),s);};
  const note=el('p',{class:'note',id:'phExNote'}),upd=()=>{const p=phP();if(!p)return;const [cw,ch]=phOutSize(p.s,p.w,p.h);let W=cw,H=ch;if(o.mode==='long'){const k=Math.min(1,o.long/Math.max(cw,ch));W=Math.round(cw*k);H=Math.round(ch*k);}else if(o.mode==='pct'){W=Math.round(cw*o.pct/100);H=Math.round(ch*o.pct/100);}note.textContent='Current photo comes out at '+W+' × '+H+' px.';};
  const q=makeSlider({id:'phExQ',label:'Quality',min:40,max:100,step:1,value:o.q,fmt:v=>Math.round(v)+'',onInput:v=>{o.q=Math.round(v);}});
  const body=el('div',{class:'dlg-grid'},sel('phExScope','Photos',[['one','This photo'],['sel','Selected photos'],['all','All photos']],()=>o.scope,v=>{o.scope=v;}),sel('phExFmt','Format',PH_FMT.map(f=>[f[0],f[1]]),()=>o.fmt,v=>{o.fmt=v;}),q.el,
    sel('phExSize','Size',[['orig','Original size'],['long','Longest side…'],['pct','Percent']],()=>o.mode,v=>{o.mode=v;}),
    el('div',{class:'frow'},el('label',{for:'phExLong',text:'Longest side'}),el('input',{id:'phExLong',type:'number',class:'num',value:String(o.long),min:'16',max:String(MAX_DIM),onchange(){o.long=Math.max(16,Math.min(MAX_DIM,+this.value||2048));upd();}}),el('span',{class:'dim',text:'px'}),el('label',{for:'phExPct',text:'Percent'}),el('input',{id:'phExPct',type:'number',class:'num',value:String(o.pct),min:'1',max:'400',onchange(){o.pct=Math.max(1,Math.min(400,+this.value||50));upd();}})),
    note,el('p',{class:'note',text:'The photo files are not changed. Edits are applied to a copy.'}));
  upd();openDialog({title:'Export photos',body,okLabel:'Export',onOk(){setTimeout(()=>phExportRun(o),0);}});}
async function phExportRun(o){const idx=o.scope==='all'?ph.photos.map((_,i)=>i):o.scope==='sel'&&ph.sel.size?[...ph.sel].sort((a,b)=>a-b):[ph.cur];const F=PH_FMT.find(f=>f[0]===o.fmt),files=[];loadStart('Exporting photos');
  try{let k=0;for(const i of idx){const p=ph.photos[i];if(!p)continue;loadSet(k/idx.length,p.name);const c=await phRenderFull(p,o),blob=await new Promise(r=>c.toBlob(r,F[2],o.q/100));if(!blob)throw new Error('This format is not available here.');
      files.push({name:(p.name.replace(/\.[^.]+$/,'')||'photo')+'-edit.'+F[0],data:new Uint8Array(await blob.arrayBuffer()),blob});k++;await new Promise(r=>setTimeout(r,0));}
    loadSet(.95,'Saving…');
    if(platform.isDesktop){if(files.length===1){const r=await deliver(files[0].name,files[0].blob);toast(deliveredText(r,'Photo'));}else{const dir=await platform.pickFolder();if(!dir)return;const sep=dir.includes('\\')?'\\':'/';for(const f of files)await platform.writeFile(dir.replace(/[\\/]$/,'')+sep+f.name,f.data);toast('Saved '+files.length+' photos in '+dir);}}
    else{if(files.length===1){const r=await deliver(files[0].name,files[0].blob);toast(deliveredText(r,'Photo'));}else{const r=await deliver('photos.zip',await makeZipMulti(files.map(f=>({name:f.name,data:f.data}))));toast(deliveredText(r,'Photos'));}}}
  catch(e){console.error(e);toast('The export did not work: '+(e.message||e));}finally{loadEnd();}}
/* ---- the edited photo on a Paint layer ---- */
function phToPaint(){const p=phP();if(!p||!ph.out){toast('Open a photo first.');return;}const W=ph.out.w,H=ph.out.h,px=readRGBA8(ph.out),id=new Uint8Array(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,j=(y*W+x)*4;id[j]=px[i];id[j+1]=px[i+1];id[j+2]=px[i+2];id[j+3]=255;}
  withPaintDoc(()=>{const L=newLayerObj(p.name.replace(/\.[^.]+$/,''));drawRawInto(L.target,{w:W,h:H,data:id,bits:8},true);structOp('Place edited photo',()=>{insertNode(L,doc.root);selectOnly(L);});});
  toast('Put the edited photo on a new layer in Paint.');}
