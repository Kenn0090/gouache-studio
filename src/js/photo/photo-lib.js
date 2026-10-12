/* ================= Photo tab: photos strip, presets, history, copy and paste, saving the edits, export ================= */
/* ---- presets (their values go on top of what the photo has) ---- */
const PH_PRESETS=[
  ['Look',[['Vivid',{con:18,vib:35,sat:8,cla:12,hi:-15,sh:15}],['Soft matte',{con:-12,bl:25,sh:20,sat:-8,curve:{m:[[0,.08],[.5,.5],[1,.94]]}}],['Warm film',{temp:18,tint:4,con:8,sat:-6,grain:{amt:18},curve:{m:[[0,.05],[.25,.22],[.75,.8],[1,.96]]}}],['Teal & orange',{con:12,grade:{sh:{h:195,s:35,l:0},hi:{h:35,s:30,l:0},blend:60},vib:12}],
    ['Faded',{con:-18,bl:35,sat:-18,curve:{m:[[0,.12],[1,.9]]}}],['Punchy',{con:30,hi:-20,sh:20,cla:20,vib:20,sat:6,wh:10,bl:-10}],['Cinematic',{con:14,sat:-10,temp:-6,grade:{sh:{h:210,s:30,l:-5},mid:{h:35,s:10,l:0},hi:{h:45,s:25,l:0},blend:55,bal:10},vig:{amt:-22,mid:55,feather:60},grain:{amt:10}}],['Golden hour',{temp:30,tint:6,exp:.15,hi:-25,sh:20,vib:25,grade:{hi:{h:40,s:30,l:0},blend:55}}]]],
  ['Portrait',[['Soft skin',{cla:-22,tex:-18,hi:-10,sh:12,vib:-6,nr:{lum:12}}],['Bright & airy',{exp:.3,con:-8,sh:30,wh:15,sat:-8,temp:4}],['Moody',{exp:-.2,con:20,sh:-10,sat:-18,vig:{amt:-30,mid:45,feather:70}}]]],
  ['Landscape',[['Rich sky',{dehaze:22,cla:14,vib:28,hi:-30,mix:{s:[0,8,6,10,22,30,10,0],l:[0,0,0,0,-10,-18,0,0]}}],['Lush green',{vib:20,mix:{h:[0,0,8,-8,0,0,0,0],s:[0,0,15,30,10,0,0,0]}}],['Clear air',{dehaze:30,con:10,tex:18}]]],
  ['Black & white',[['B&W natural',{bw:true,con:8}],['B&W high contrast',{bw:true,con:40,cla:20,bl:-15,wh:15}],['B&W soft',{bw:true,con:-10,bl:20,sh:20,grain:{amt:12}}],['Silver film',{bw:true,con:18,cla:12,grain:{amt:25,size:30},vig:{amt:-18,mid:55}}]]]];
function phMerge(a,b){for(const k in b){if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))phMerge(a[k],b[k]);else a[k]=phClone(b[k]);}return a;}
const phUserPresets=()=>{try{return JSON.parse(localStorage.getItem('gs.phPresets')||'[]');}catch(e){return [];}};
function phApplyPreset(patch,name){const p=phP();if(!p)return;const n=phMerge(phClone(p.s),patch);phApply(n,name);}
function phSavePreset(){const p=phP();if(!p)return;const inp=el('input',{type:'text',id:'phPreName',value:'My look','aria-label':'Preset name'});
  openDialog({title:'Save preset',body:el('div',{class:'dlg-grid'},inp,el('p',{class:'note',text:'Saves this photo’s edits (not the crop or turn) so you can use them on other photos.'})),okLabel:'Save',onOk(){const n=inp.value.trim();if(!n)return false;const s=phClone(p.s);delete s.geo;const l=phUserPresets();l.push([n,s]);try{localStorage.setItem('gs.phPresets',JSON.stringify(l));}catch(e){}phBuildPre();toast('Saved the preset “'+n+'”.');}});setTimeout(()=>{inp.focus();inp.select();},0);}
/* a small picture of the current photo with each preset, so you can choose by eye */
function phPreThumb(patch,key){const p=phP();if(!p||!p.psrc)return '';const S=96;ph.tc=ph.tc||{};const ck=p.id+'|'+key;if(ph.tc[ck])return ph.tc[ck];
  if(!p.small){const k=Math.min(1,S*2/Math.max(p.pw,p.ph)),w=Math.max(2,Math.round(p.pw*k)),h=Math.max(2,Math.round(p.ph*k));p.small=makeTarget(w,h,8,false);run(P.resample,p.small,{uSrc:p.psrc.tex,uOffset:[0,0],uScale:[p.pw/w,p.ph/h],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(p.pw/w)))}});}
  const sm=p.small,k=Math.min(1,S/Math.max(sm.w,sm.h)),w=Math.max(2,Math.round(sm.w*k)),h=Math.max(2,Math.round(sm.h*k)),t=makeTarget(w,h,8,false),s=phMerge(phDefaults(),patch);s.geo=phDefaults().geo;
  try{phRender(sm,t,s);const d=captureRegionNow(t,0,0,w,h).data,c=document.createElement('canvas');c.width=w;c.height=h;const id=new ImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,j=(y*w+x)*4;id.data[j]=d[i];id.data[j+1]=d[i+1];id.data[j+2]=d[i+2];id.data[j+3]=255;}c.getContext('2d').putImageData(id,0,0);return ph.tc[ck]=c.toDataURL('image/jpeg',.8);}
  finally{disposeTarget(t);}}
function phBuildPre(){const box=$('#phPreBody');if(!box)return;box.replaceChildren();const p=phP();
  box.append(el('div',{class:'phbar'},el('button',{class:'btn sm',text:'Save current as preset…',onclick:phSavePreset}),el('button',{class:'btn sm',text:'Reset',onclick:phReset})));
  const mk=(name,patch,key)=>el('button',{class:'phpre',title:name,onclick:()=>phApplyPreset(patch,name)},el('img',{alt:'',src:phPreThumb(patch,key)}),el('span',{text:name}));
  for(const [grp,list] of PH_PRESETS)box.append(el('div',{class:'sub',text:grp}),el('div',{class:'phpregrid'},...list.map(([n,pt])=>mk(n,pt,'b:'+n))));
  const u=phUserPresets();if(u.length)box.append(el('div',{class:'sub',text:'My presets'}),el('div',{class:'phpregrid'},...u.map(([n,s],i)=>{const b=mk(n,s,'u:'+n);b.append(el('i',{class:'phprex',title:'Delete this preset',text:'×',onclick:e=>{e.stopPropagation();const l=phUserPresets();l.splice(i,1);localStorage.setItem('gs.phPresets',JSON.stringify(l));phBuildPre();}}));return b;})));
  if(!p)box.append(el('p',{class:'note',text:'Open a photo to see the presets on it.'}));}
/* ---- history and snapshots ---- */
function phRenderHist(){const box=$('#phHistBody');if(!box)return;box.replaceChildren();const p=phP();if(!p||!p.hist){box.append(el('p',{class:'note',text:'Edits show up here.'}));return;}
  box.append(el('div',{class:'phbar'},el('button',{class:'btn sm',text:'Undo',onclick:phUndo}),el('button',{class:'btn sm',text:'Redo',onclick:phRedo}),el('button',{class:'btn sm',text:'New snapshot',onclick:phSnapshot})));
  if(p.snaps.length)box.append(el('div',{class:'sub',text:'Snapshots'}),...p.snaps.map((sn,i)=>el('div',{class:'phrow'},el('button',{class:'btn sm',text:sn.name,onclick:()=>phApply(phClone(sn.s),'Snapshot “'+sn.name+'”')}),el('button',{class:'xbtn',text:'×','aria-label':'Delete snapshot',onclick:()=>{p.snaps.splice(i,1);phSidecarSoon();phRenderHist();}}))));
  box.append(el('div',{class:'sub',text:'History'}),el('div',{class:'phhist'},...p.hist.list.map((h,i)=>el('button',{class:'phhi'+(i===p.hist.i?' on':''),text:h.label,onclick:()=>phHistGo(i)})).reverse()));}
function phSnapshot(){const p=phP();if(!p)return;const inp=el('input',{type:'text',value:'Snapshot '+(p.snaps.length+1),'aria-label':'Snapshot name'});
  openDialog({title:'New snapshot',body:el('div',{class:'dlg-grid'},inp),okLabel:'Save',onOk(){const n=inp.value.trim()||'Snapshot';p.snaps.push({name:n,s:phClone(p.s)});phSidecarSoon();phRenderHist();}});setTimeout(()=>{inp.focus();inp.select();},0);}
/* ---- the photos strip ---- */
ph.sel=new Set();
function phBuildLib(){phBuildPre();phRenderHist();const box=$('#phLibBody');if(!box)return;box.replaceChildren();
  const bar=el('div',{class:'phbar'},el('button',{class:'btn sm primary',text:'Add photos…',onclick:phOpenDialog}),el('button',{class:'btn sm',text:'Paste edits to selected',title:'Paste the copied edits onto every selected photo (click with Ctrl or Shift to select several)',onclick:()=>phPaste(true)}),el('button',{class:'btn sm',text:'Export…',onclick:()=>dlgPhotoExport()}),
    el('span',{class:'dim',text:ph.photos.length?ph.photos.length+' photo'+(ph.photos.length===1?'':'s'):''}));
  const strip=el('div',{class:'phstrip',role:'listbox','aria-label':'Photos'});
  ph.photos.forEach((p,i)=>{const b=el('button',{class:'phthumb'+(i===ph.cur?' on':'')+(ph.sel.has(i)?' sel':''),role:'option','aria-selected':String(i===ph.cur),title:p.name+' · '+p.w+' × '+p.h,
      onclick:e=>{if(e.ctrlKey||e.metaKey){ph.sel.has(i)?ph.sel.delete(i):ph.sel.add(i);phBuildLib();return;}if(e.shiftKey&&ph.cur>=0){const a=Math.min(ph.cur,i),z=Math.max(ph.cur,i);for(let k=a;k<=z;k++)ph.sel.add(k);phBuildLib();return;}ph.sel.clear();phSelect(i);}},
      el('img',{src:p.thumb,alt:p.name}),el('span',{text:p.name}),el('i',{class:'phtx',title:'Remove from this list','aria-label':'Remove '+p.name,text:'×',onclick:e=>{e.stopPropagation();phRemove(i);}}));strip.append(b);});
  if(!ph.photos.length)strip.append(el('p',{class:'note',text:'Add photos, or drop them on the picture. Click one to edit it.'}));
  box.append(bar,strip);}
function phRemove(i){const p=ph.photos[i];if(!p)return;phSidecarFlush();if(p.psrc)disposeTarget(p.psrc);if(p.small)disposeTarget(p.small);ph.photos.splice(i,1);ph.sel.clear();
  if(ph.cur===i){ph.cur=-1;if(ph.photos.length)phSelect(Math.min(i,ph.photos.length-1));else{if(ph.out){disposeTarget(ph.out);ph.out=null;}phBuildPanel();phDirty();}}else if(ph.cur>i)ph.cur--;phBuildLib();}
/* ---- copy and paste edits ---- */
const PH_GROUPS=[['Basic',['temp','tint','exp','con','hi','sh','wh','bl','tex','cla','dehaze','vib','sat','bw']],['Tone curve',['curve']],['Colour mixer',['mix']],['Colour grading',['grade']],['Detail',['sharp','nr']],['Effects',['vig','grain']],['Crop and turn',['geo']]];
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
    if(!txt)txt=localStorage.getItem(phScKey(p));if(!txt)return;const o=JSON.parse(txt);if(!o||!o.s)return;p.s=phMerge(phDefaults(),o.s);p.snaps=o.snaps||[];p.hist={list:[{label:'Open',s:phClone(phDefaults())},{label:'Saved edits',s:phClone(p.s)}],i:1};
    if(phP()===p){phAfterSet();phRenderHist();}}catch(e){console.warn('edits not read',e);}}
function phSidecarWrite(p){if(!p)return;const o=JSON.stringify({v:1,app:'Gouache Studio',s:p.s,snaps:p.snaps});const def=JSON.stringify(phDefaults());
  try{if(JSON.stringify(p.s)===def&&!p.snaps.length){localStorage.removeItem(phScKey(p));}else localStorage.setItem(phScKey(p),o);}catch(e){}
  if(p.path&&platform.isDesktop&&JSON.stringify(p.s)!==def)platform.writeFile(p.path+'.gphoto',new TextEncoder().encode(o)).catch(()=>{});}
let phSCT=0;function phSidecarSoon(){clearTimeout(phSCT);phSCT=setTimeout(()=>phSidecarWrite(phP()),1200);}
function phSidecarFlush(){clearTimeout(phSCT);if(phP())phSidecarWrite(phP());}
/* ---- export ---- */
async function phRenderFull(p,opt){const dec=await phDecode(p.file),t=makeTarget(dec.w,dec.h,phDecDepth(dec),false);try{phUploadInto(dec,t);if(dec.bm&&dec.bm.close)dec.bm.close();
    const [cw,ch]=phOutSize(p.s,dec.w,dec.h);let W=cw,H=ch;if(opt.mode==='long'){const k=opt.long/Math.max(cw,ch);if(k<1||opt.up){W=Math.max(1,Math.round(cw*k));H=Math.max(1,Math.round(ch*k));}}else if(opt.mode==='pct'){W=Math.max(1,Math.round(cw*opt.pct/100));H=Math.max(1,Math.round(ch*opt.pct/100));}
    W=Math.min(W,MAX_DIM);H=Math.min(H,MAX_DIM);const out=makeTarget(W,H,8,false);try{phRender(t,out,p.s,{seed:p.seed||0});const px=readRGBA8(out),id=new ImageData(W,H),d=id.data;
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
