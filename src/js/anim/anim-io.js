/* ================= Animation: import and export ================= */

/* ---- picking files (several at once) and folders ---- */
function pickFiles(accept,multiple,filterName,exts){return new Promise(async res=>{
  if(platform.isDesktop){try{const p=await platform.openFiles([{name:filterName,extensions:exts}],multiple);if(!p||!p.length){res([]);return;}
      const files=[];for(const path of p){const b=await platform.readFile(path);files.push(new File([b],fileNameOf(path)));}res(files);}catch(e){toast('The file dialog failed: '+(e.message||e));res([]);}return;}
  const inp=el('input',{type:'file',accept,multiple:multiple||null,hidden:true});document.body.append(inp);
  inp.addEventListener('change',()=>{res([...inp.files]);inp.remove();});inp.addEventListener('cancel',()=>{res([]);inp.remove();});inp.click();});}
async function framesEmpty(){const A=A_();return !A||A.frames.every(F=>!contentBounds(F.target));}
function ensureAnimMode(){if(ui.mode!=='anim')return setMode('anim',true);return true;}
/* add or replace frames in one undo step */
function putFrames(list,replace,label){if(!list.length){toast('No frames were found.');return;}
  animOp(label,A=>{if(replace){A.frames=list;A.tags=[];A.cur=0;}else{A.frames.splice(A.cur+1,0,...list);A.cur=A.cur+1;}});
  list.forEach(frameDirty);toast(list.length+' frame'+(list.length===1?'':'s')+' added.');}

/* sprite sheet -> frames */
async function importSheet(rawIn){if(!ensureAnimMode())return;const given=!!(rawIn&&rawIn.w&&rawIn.data);let raw=given?rawIn:null;
  if(!raw){const [f]=await pickFiles('image/*,.tga,.dds,.tif,.tiff,.psd',false,'Images',['png','jpg','jpeg','webp','gif','tga','dds','tif','tiff','bmp']);if(!f)return;
    try{raw=await decodeFile(f);}catch(e){toast(e.message);return;}}
  const guess=raw.w%raw.h===0&&raw.w>raw.h?[raw.w/raw.h,1]:raw.h%raw.w===0&&raw.h>raw.w?[1,raw.h/raw.w]:[4,4];
  const st={cols:guess[0],rows:guess[1],replace:given?false:await framesEmpty(),skip:true,resize:true};
  const prev=el('canvas',{class:'slicepv'}),pw_=Math.min(460,raw.w),ph=Math.round(raw.h*pw_/raw.w);prev.width=pw_;prev.height=ph;
  const base=document.createElement('canvas');base.width=raw.w;base.height=raw.h;const bx=base.getContext('2d'),id=new ImageData(raw.w,raw.h);
  if(raw.el)bx.drawImage(raw.el,0,0);
  else{const d=raw.data;for(let i=0;i<raw.w*raw.h*4;i++)id.data[i]=d instanceof Uint16Array?d[i]>>8:d instanceof Float32Array?((i&3)===3?d[i]:lin2srgb(Math.max(0,d[i])))*255:d[i];bx.putImageData(id,0,0);}
  const info=el('p',{class:'note'});
  const draw=()=>{const x=prev.getContext('2d');x.clearRect(0,0,pw_,ph);x.drawImage(base,0,0,pw_,ph);x.strokeStyle='rgba(226,164,83,.9)';x.lineWidth=1;
    for(let c=1;c<st.cols;c++){const X=Math.round(c*pw_/st.cols)+.5;x.beginPath();x.moveTo(X,0);x.lineTo(X,ph);x.stroke();}
    for(let r=1;r<st.rows;r++){const Y=Math.round(r*ph/st.rows)+.5;x.beginPath();x.moveTo(0,Y);x.lineTo(pw_,Y);x.stroke();}
    const cw=Math.floor(raw.w/st.cols),ch=Math.floor(raw.h/st.rows);info.textContent='Cells '+cw+' × '+ch+' px · '+(st.cols*st.rows)+' cells · canvas is '+doc.w+' × '+doc.h+'.';};
  const num=(k,label)=>{const i=el('input',{class:'num',type:'number',min:1,max:128,value:st[k],id:'sl'+k,'aria-label':label});i.addEventListener('input',()=>{st[k]=clamp(+i.value||1,1,128);draw();});return [el('label',{for:'sl'+k,text:label}),i];};
  const body=el('div',{class:'dlg-grid'},prev,el('div',{class:'frow'},...num('cols','Columns'),...num('rows','Rows')),info,
    el('div',{class:'chips'},chk('slRes','Resize canvas to the cell size',st.resize,v=>{st.resize=v;}),chk('slSkip','Skip empty cells',st.skip,v=>{st.skip=v;}),chk('slRep','Replace current frames',st.replace,v=>{st.replace=v;})));
  draw();openDialog({title:'Frames from a sprite sheet',body,okLabel:'Import',onOk(){
    const cw=Math.floor(raw.w/st.cols),ch=Math.floor(raw.h/st.rows);if(st.resize&&(cw!==doc.w||ch!==doc.h))resizeCanvasDoc(cw,ch,0,0);
    const tex=uploadStraight(raw),list=[];
    for(let r=0;r<st.rows;r++)for(let c=0;c<st.cols;c++){const F=newFrame();premultInto(F.target,tex,[-c*cw,-r*ch],null);
      if(st.skip&&!contentBounds(F.target)){disposeLayer(F);continue;}list.push(F);}
    gl.deleteTexture(tex);putFrames(list,st.replace,'Import sprite sheet');}});}
/* numbered images -> frames */
async function importSequence(){if(!ensureAnimMode())return;const files=await pickFiles('image/*,.tga,.dds,.tif,.tiff',true,'Images',['png','jpg','jpeg','webp','tga','dds','tif','tiff','bmp']);if(!files.length)return;
  files.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));const replace=await framesEmpty();const raws=[];
  for(const f of files){try{raws.push(await decodeFile(f));}catch(e){toast(f.name+': '+e.message);}}if(!raws.length)return;
  if(replace&&(raws[0].w!==doc.w||raws[0].h!==doc.h))resizeCanvasDoc(Math.min(MAX_DIM,raws[0].w),Math.min(MAX_DIM,raws[0].h),0,0);
  const list=raws.map(raw=>{const F=newFrame(),tex=uploadStraight(raw);premultInto(F.target,tex,[0,0],null);gl.deleteTexture(tex);return F;});
  putFrames(list,replace,'Import image sequence');}
/* GIF -> frames (the browser engine decodes and composites each GIF frame) */
async function importGif(){if(!ensureAnimMode())return;const [f]=await pickFiles('.gif,image/gif',false,'GIF',['gif']);if(!f)return;
  if(typeof ImageDecoder==='undefined'){toast('GIF import needs a newer version of the WebView2 runtime.');return;}
  try{const dec=new ImageDecoder({data:await f.arrayBuffer(),type:'image/gif'});await dec.tracks.ready;const n=dec.tracks.selectedTrack.frameCount,replace=await framesEmpty(),A=A_();
    const list=[];let size=null;
    for(let i=0;i<n;i++){const {image}=await dec.decode({frameIndex:i});const w=image.displayWidth,h=image.displayHeight;
      if(!size){size=[w,h];if(replace&&(w!==doc.w||h!==doc.h))resizeCanvasDoc(w,h,0,0);}
      const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(image,0,0);const d=x.getImageData(0,0,w,h);
      const F=newFrame(),tex=uploadStraight({w,h,data:d.data,bits:8});premultInto(F.target,tex,[0,0],null);gl.deleteTexture(tex);
      F.hold=Math.max(1,Math.round((image.duration||100000)/1000*A.fps/1000));image.close();list.push(F);}
    dec.close();putFrames(list,replace,'Import GIF');}catch(e){console.error(e);toast('This GIF could not be read: '+(e.message||e));}}

/* ---- reading frames at full size, straight (not premultiplied) colour ---- */
function frameCanvas(F,T){const W=doc.w,H=doc.h,px=readRGBA8(T||F.target),img=new ImageData(W,H),d=img.data;
  for(let i=0;i<d.length;i+=4){const a=px[i+3];if(a){d[i]=Math.min(255,px[i]*255/a);d[i+1]=Math.min(255,px[i+1]*255/a);d[i+2]=Math.min(255,px[i+2]*255/a);d[i+3]=a;}}
  const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').putImageData(img,0,0);return c;}
function scaledCanvas(src,s){if(s===1)return src;const c=document.createElement('canvas');c.width=Math.max(1,Math.round(src.width*s));c.height=Math.max(1,Math.round(src.height*s));
  const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(src,0,0,c.width,c.height);return c;}
const cvsToBlob=(c,type)=>new Promise(r=>c.toBlob(r,type||'image/png'));
const nextPow2=n=>{let p=1;while(p<n)p*=2;return p;};

/* ---- sprite sheet / flipbook export window ---- */
function dlgExportSheet(){if(!doc.anim){toast('Switch to Animation mode (top right) and make some frames first.');return;}if(!ensureAnimMode())return;stopPlay();
  const A0=A_(),full0=afxRenderAll(A0);let A=A0,full=full0;
  const st={rate:'same',inter:'off',range:-1,tagRows:false,auto:true,cols:0,rows:0,left:'empty',scale:1,pad:0,ext:0,pot:false,holds:false,data:'json'};
  const sheet=document.createElement('canvas'),view=el('canvas',{class:'sheetview'}),anim=el('canvas',{class:'sheetanim'}),info=el('div',{class:'note sheetinfo'}),warn=el('div',{class:'note warn'}),unity=el('div',{class:'note'});
  let L=null,animTimer=0,ak=0;
  /* which frames go in, in order; holds can be repeated for engines that only step one cell per tick */
  const seqOf=(a,b)=>{const s=[];for(let i=a;i<=b;i++){const n=st.holds?A.frames[i].hold:1;for(let k=0;k<n;k++)s.push(i);}return s;};
  function layout(){const fw=Math.max(1,Math.round(doc.w*st.scale)),fh=Math.max(1,Math.round(doc.h*st.scale)),e=st.ext,p=st.pad;let groups;
    if(st.tagRows&&A.tags.length)groups=A.tags.map(t=>{const [a,b]=tagRange(t,A);return {tag:t,seq:seqOf(a,b)};});
    else{let a=0,b=A.frames.length-1,tag=null;if(st.range>=0&&A.tags[st.range]){tag=A.tags[st.range];[a,b]=tagRange(tag);}groups=[{tag,seq:seqOf(a,b)}];}
    const n=groups.reduce((s,g)=>s+g.seq.length,0);let cols,rows,cells=[],lost=0;
    if(groups.length>1){cols=Math.max(...groups.map(g=>g.seq.length));rows=groups.length;groups.forEach((g,r)=>g.seq.forEach((fi,c)=>cells.push({fi,c,r,g})));}
    else{const s=groups[0].seq;if(st.auto){cols=Math.ceil(Math.sqrt(s.length));rows=Math.ceil(s.length/cols);}else{cols=st.cols;rows=st.left==='shrink'?Math.ceil(s.length/cols):st.rows;}
      const cap=cols*rows;lost=Math.max(0,s.length-cap);s.slice(0,cap).forEach((fi,k)=>cells.push({fi,c:k%cols,r:Math.floor(k/cols),g:groups[0]}));
      if(st.left==='repeat'&&s.length&&cap>s.length)for(let k=s.length;k<cap;k++)cells.push({fi:s[s.length-1],c:k%cols,r:Math.floor(k/cols),g:groups[0],filler:true});}
    const slotW=fw+2*e+p,slotH=fh+2*e+p;let W=p+cols*slotW,H=p+rows*slotH;if(st.pot){W=nextPow2(W);H=nextPow2(H);}
    for(const c of cells){c.x=p+c.c*slotW+e;c.y=p+c.r*slotH+e;}
    return {fw,fh,e,p,cols,rows,cells,W,H,n,lost,groups};}
  function render(){L=layout();sheet.width=L.W;sheet.height=L.H;const x=sheet.getContext('2d');x.clearRect(0,0,L.W,L.H);x.imageSmoothingQuality='high';
    const cache=new Map(),get=fi=>{if(!cache.has(fi))cache.set(fi,scaledCanvas(full[fi],st.scale));return cache.get(fi);};
    for(const c of L.cells){const img=get(c.fi),{fw,fh,e}=L;x.drawImage(img,c.x,c.y);
      if(e>0){x.drawImage(img,0,0,1,fh,c.x-e,c.y,e,fh);x.drawImage(img,fw-1,0,1,fh,c.x+fw,c.y,e,fh);x.drawImage(img,0,0,fw,1,c.x,c.y-e,fw,e);x.drawImage(img,0,fh-1,fw,1,c.x,c.y+fh,fw,e);
        x.drawImage(img,0,0,1,1,c.x-e,c.y-e,e,e);x.drawImage(img,fw-1,0,1,1,c.x+fw,c.y-e,e,e);x.drawImage(img,0,fh-1,1,1,c.x-e,c.y+fh,e,e);x.drawImage(img,fw-1,fh-1,1,1,c.x+fw,c.y+fh,e,e);}}
    /* the view: sheet scaled to fit, with the cell grid drawn over it */
    const vs=Math.min(1,560/L.W,440/L.H),vw=Math.max(1,Math.round(L.W*vs)),vh=Math.max(1,Math.round(L.H*vs));view.width=vw;view.height=vh;const v=view.getContext('2d');
    v.imageSmoothingQuality='high';v.drawImage(sheet,0,0,vw,vh);v.strokeStyle='rgba(226,164,83,.85)';v.lineWidth=1;
    for(const c of L.cells){v.strokeRect(Math.round(c.x*vs)+.5,Math.round(c.y*vs)+.5,Math.round(L.fw*vs)-1,Math.round(L.fh*vs)-1);}
    info.textContent=L.n+' frame'+(L.n===1?'':'s')+' · grid '+L.cols+' × '+L.rows+' · cells '+L.fw+' × '+L.fh+' px · sheet '+L.W+' × '+L.H+' px';
    warn.textContent=L.lost?L.n+' frames do not fit in '+L.cols+' × '+L.rows+'; '+L.lost+' would be left out. Pick a bigger grid, or choose “Shrink the grid”.':'';
    unity.textContent='Unity: Sprite Mode Multiple › Sprite Editor › Slice › Grid By Cell Size '+L.fw+' × '+L.fh+', Offset '+(L.p+L.e)+', '+(L.p+L.e)+', Padding '+(L.p+2*L.e)+', '+(L.p+2*L.e)+'.';
    expBtns.forEach(b=>b.disabled=!!L.lost);ak=0;}
  /* the animation, played from the sheet itself */
  function tick(){clearTimeout(animTimer);if(!view.isConnected)return;const cells=L.cells.filter(c=>!c.filler&&c.g===L.groups[0]);if(!cells.length)return;const c=cells[ak%cells.length];
    const s=Math.min(1,220/L.fw,220/L.fh),w=Math.max(1,Math.round(L.fw*s)),h=Math.max(1,Math.round(L.fh*s));anim.width=w;anim.height=h;const x=anim.getContext('2d');x.clearRect(0,0,w,h);x.imageSmoothingQuality='high';x.drawImage(sheet,c.x,c.y,L.fw,L.fh,0,0,w,h);
    const hold=st.holds?1:A.frames[c.fi].hold;ak++;animTimer=setTimeout(tick,hold*1000/A.fps);}
  const upd=()=>{render();tick();};
  /* controls */
  const gridBtns=el('div',{class:'seg tight'});const colsI=el('input',{class:'num',type:'number',min:1,max:64,id:'exCols','aria-label':'Columns'}),rowsI=el('input',{class:'num',type:'number',min:1,max:64,id:'exRows','aria-label':'Rows'});
  const syncGrid=()=>{gridBtns.querySelectorAll('.segb').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.g==='auto'?st.auto:!st.auto&&st.cols===+b.dataset.g&&st.rows===+b.dataset.g)));colsI.value=L?L.cols:'';rowsI.value=L?L.rows:'';};
  for(const g of ['auto',2,4,8,16]){const b=el('button',{class:'segb',text:g==='auto'?'Fit':g+'×'+g,title:g==='auto'?'Smallest grid that fits':g+' × '+g+' grid'});b.dataset.g=String(g);
    b.addEventListener('click',()=>{if(g==='auto')st.auto=true;else{st.auto=false;st.cols=st.rows=g;}upd();syncGrid();});gridBtns.append(b);}
  colsI.addEventListener('change',()=>{st.auto=false;st.cols=clamp(+colsI.value||1,1,64);st.rows=L.rows;upd();syncGrid();});rowsI.addEventListener('change',()=>{st.auto=false;st.rows=clamp(+rowsI.value||1,1,64);st.cols=L.cols;upd();syncGrid();});
  const sel=(id,label,opts,val,fn)=>{const s=el('select',{id,'aria-label':label},...opts.map(([v,t])=>el('option',{value:String(v),text:t})));s.value=String(val);s.addEventListener('change',()=>{fn(s.value);upd();syncGrid();});return [el('label',{for:id,text:label}),s];};
  const numI=(id,label,val,max,fn)=>{const i=el('input',{class:'num',type:'number',min:0,max,value:val,id,'aria-label':label});i.addEventListener('change',()=>{fn(clamp(+i.value||0,0,max));upd();});return [el('label',{for:id,text:label}),i];};
  const rangeOpts=[[-1,'All frames'],...A.tags.map((t,i)=>[i,'Tag: '+t.name])];
  const expBtns=[el('button',{class:'btn primary',text:'Export sheet',onclick:()=>exportSheet()}),el('button',{class:'btn',text:'PNG sequence',onclick:()=>exportSequence()}),el('button',{class:'btn',text:'GIF',onclick:()=>exportGif()})];
  /* (0.41, Kenn) export frame rate and in-between frames (blend or motion) */
  const retimeNote=el('div',{class:'note'});let rtToken=0;
  async function retime(){const my=++rtToken;const rate=exRate(st.rate,A0.fps);
    if(rate===A0.fps){A=A0;full=full0;retimeNote.textContent='';upd();syncGrid();return;}
    retimeNote.textContent='Making the in-between frames…';expBtns.forEach(b=>b.disabled=true);
    try{const R=await buildRetimed(A0,full0,rate,st.inter,k=>{if(my===rtToken)retimeNote.textContent='Making frame '+k.done+' of '+k.total+'…';return my!==rtToken;});
      if(my!==rtToken)return;A=R.A;full=R.full;retimeNote.textContent=A.frames.length+' frames at '+rate+' fps'+(st.inter==='off'?'':' ('+(st.inter==='motion'?'motion':'blended')+' in-betweens)')+'.'+(rate>50?' GIF files can’t play faster than 50 fps; use a PNG sequence or the sheet for higher rates.':'');}
    catch(e){console.error(e);retimeNote.textContent='The in-between frames could not be made: '+(e.message||e);A=A0;full=full0;}
    upd();syncGrid();}
  const side=el('div',{class:'dlg-grid sheetctl'},
    el('div',{class:'sub',text:'Frame rate'}),
    el('div',{class:'frow'},...sel('exRate','Export at',[['same','Same as the animation ('+A0.fps+' fps)'],['x2','2× ('+A0.fps*2+' fps)'],['x4','4× ('+A0.fps*4+' fps)'],[24,'24 fps'],[30,'30 fps'],[48,'48 fps'],[60,'60 fps'],[90,'90 fps'],[120,'120 fps'],[240,'240 fps']],st.rate,v=>{st.rate=isNaN(+v)?v:+v;retime();})),
    el('div',{class:'frow'},...sel('exInter','In-between frames',[['off','Off (repeat the nearest frame)'],['blend','Blend (soft cross-fade)'],['motion','Motion (follows movement)']],st.inter,v=>{st.inter=v;retime();})),
    retimeNote,
    el('div',{class:'sub',text:'Grid'}),gridBtns,el('div',{class:'frow'},el('label',{for:'exCols',text:'Columns'}),colsI,el('label',{for:'exRows',text:'Rows'}),rowsI),
    el('div',{class:'frow'},...sel('exLeft','If frames don’t fill it',[['empty','Leave cells empty'],['repeat','Repeat the last frame'],['shrink','Shrink the grid']],st.left,v=>{st.left=v;})),
    el('div',{class:'frow'},...sel('exRange','Frames',rangeOpts,st.range,v=>{st.range=+v;})),
    A.tags.length>1?chk('exTagRows','Each tag on its own row',false,v=>{st.tagRows=v;upd();syncGrid();}):null,
    el('div',{class:'frow'},...sel('exScale','Frame size',[[1,'100%'],[.5,'50%'],[.25,'25%']],st.scale,v=>{st.scale=+v;})),
    el('div',{class:'frow'},...numI('exPad','Padding',st.pad,64,v=>{st.pad=v;}),...numI('exExt','Extrude',st.ext,16,v=>{st.ext=v;})),
    el('div',{class:'chips'},chk('exPot','Power-of-two size',false,v=>{st.pot=v;upd();}),chk('exHolds','Repeat held frames',false,v=>{st.holds=v;upd();syncGrid();})),
    el('div',{class:'frow'},...sel('exData','Data file',[['json','JSON (Unity, Godot, Unreal Paper2D, Aseprite format)'],['godot','Godot SpriteFrames (.tres)'],['none','None']],st.data,v=>{st.data=v;})),
    unity,warn,el('div',{class:'frow'},...expBtns));
  const body=el('div',{class:'sheetdlg'},el('div',{class:'sheetleft'},view,info),el('div',{class:'sheetright'},el('div',{class:'sub',text:'Plays from the sheet'}),anim,side));
  render();syncGrid();openDialog({title:'Sprite sheet / flipbook export',body,wide:true,cancelLabel:'Close',onCancel(){clearTimeout(animTimer);}});tick();
  const base=slug(doc.name)+'_sheet';
  async function exportSheet(){const blob=await cvsToBlob(sheet),r=await deliver(base+'.png',blob);toast(deliveredText(r,'Sprite sheet'));if(!r.ok||st.data==='none')return;
    const text=st.data==='godot'?godotTres(L,base+'.png',A):sheetJson(L,base+'.png',A),ext=st.data==='godot'?'.tres':'.json',bytes=new TextEncoder().encode(text);
    if(r.desktop&&r.path){await platform.writeFile(r.path.replace(/\.png$/i,'')+ext,bytes);toast('Saved '+r.path+' and its '+ext+' file.');}
    else{const r2=await deliver(base+ext,new Blob([bytes]));toast(deliveredText(r2,'Data file'));}}
  async function exportSequence(){const list=L.cells.filter(c=>!c.filler).map(c=>c.fi),files=[];
    for(let k=0;k<list.length;k++)files.push({name:slug(doc.name)+'_'+String(k).padStart(3,'0')+'.png',data:new Uint8Array(await (await cvsToBlob(scaledCanvas(full[list[k]],st.scale))).arrayBuffer())});
    if(platform.isDesktop){const dir=await platform.pickFolder();if(!dir)return;for(const f of files)await platform.writeFile(dir.replace(/[\\/]$/,'')+(dir.includes('\\')?'\\':'/')+f.name,f.data);toast('Saved '+files.length+' PNGs in '+dir);return;}
    const r=await deliver(slug(doc.name)+'_frames.zip',await makeZipMulti(files));toast(deliveredText(r,'PNG sequence'));}
  async function exportGif(){toast('Encoding GIF…');await tick0();const list=L.cells.filter(c=>!c.filler&&c.g===L.groups[0]),frames=[];
    for(const c of list){const cv=scaledCanvas(full[c.fi],st.scale),d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;frames.push({d,delay:Math.max(2,Math.round((st.holds?1:A.frames[c.fi].hold)*100/A.fps))});}
    const loop=!(L.groups[0].tag&&L.groups[0].tag.mode==='once');const bytes=encodeGIF(frames,L.fw,L.fh,loop);const r=await deliver(slug(doc.name)+'.gif',new Blob([bytes],{type:'image/gif'}));toast(deliveredText(r,'GIF'));}}
const tick0=()=>new Promise(r=>setTimeout(r,30));

/* ---- engine data files ---- */
function sheetJson(L,image,A){A=A||A_();const frames={},names=[];let k=0;
  for(const c of L.cells){if(c.filler)continue;const name=slug(doc.name)+' '+(k++)+'.png';names.push({c,name});
    frames[name]={frame:{x:c.x,y:c.y,w:L.fw,h:L.fh},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:L.fw,h:L.fh},sourceSize:{w:L.fw,h:L.fh},duration:Math.round((document.getElementById('exHolds')&&document.getElementById('exHolds').checked?1:A.frames[c.fi].hold)*1000/A.fps)};}
  const tags=[];for(const g of L.groups){if(!g.tag)continue;const idx=names.map((n,i)=>n.c.g===g?i:-1).filter(i=>i>=0);if(idx.length)tags.push({name:g.tag.name,from:idx[0],to:idx[idx.length-1],direction:g.tag.mode==='pingpong'?'pingpong':'forward'});}
  if(L.groups.length===1&&!L.groups[0].tag)for(const t of A.tags){const [a,b]=tagRange(t,A);const idx=names.map((n,i)=>n.c.fi>=a&&n.c.fi<=b?i:-1).filter(i=>i>=0);if(idx.length)tags.push({name:t.name,from:idx[0],to:idx[idx.length-1],direction:t.mode==='pingpong'?'pingpong':'forward'});}
  return JSON.stringify({frames,meta:{app:'Gouache Studio',version:'1.0',image,format:'RGBA8888',size:{w:L.W,h:L.H},scale:'1',frameTags:tags}},null,1);}
function godotTres(L,image,A){A=A||A_();const cells=L.cells.filter(c=>!c.filler);let s='',subs='';
  cells.forEach((c,i)=>{subs+='\n[sub_resource type="AtlasTexture" id="AtlasTexture_'+(i+1)+'"]\natlas = ExtResource("1_sheet")\nregion = Rect2('+c.x+', '+c.y+', '+L.fw+', '+L.fh+')\n';});
  const anims=[];const holdOf=c=>document.getElementById('exHolds')&&document.getElementById('exHolds').checked?1:A.frames[c.fi].hold;
  const mk=(name,list,loop)=>'{\n"frames": ['+list.map(c=>'{\n"duration": '+holdOf(c).toFixed(1)+',\n"texture": SubResource("AtlasTexture_'+(cells.indexOf(c)+1)+'")\n}').join(', ')+'],\n"loop": '+loop+',\n"name": &"'+name.replace(/"/g,'')+'",\n"speed": '+A.fps.toFixed(1)+'\n}';
  if(L.groups.length>1||L.groups[0].tag)for(const g of L.groups)anims.push(mk(g.tag?g.tag.name:'default',cells.filter(c=>c.g===g),!(g.tag&&g.tag.mode==='once')));
  else{anims.push(mk('default',cells,true));for(const t of A.tags){const [a,b]=tagRange(t,A);const list=cells.filter(c=>c.fi>=a&&c.fi<=b);if(list.length)anims.push(mk(t.name,list,t.mode!=='once'));}}
  s='[gd_resource type="SpriteFrames" load_steps='+(cells.length+2)+' format=3]\n\n[ext_resource type="Texture2D" path="res://'+image+'" id="1_sheet"]\n'+subs+'\n[resource]\nanimations = ['+anims.join(', ')+']\n';return s;}

/* ---- several files in one zip (browser version) ---- */
async function makeZipMulti(files){const parts=[],cd=[];let off=0;
  for(const f of files){const nb=new TextEncoder().encode(f.name),comp=await streamThrough(f.data,'deflate-raw'),crc=crc32(f.data);
    const lh=new DataView(new ArrayBuffer(30));lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,8,true);lh.setUint16(12,0x21,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,comp.length,true);lh.setUint32(22,f.data.length,true);lh.setUint16(26,nb.length,true);parts.push(lh,nb,comp);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,8,true);c.setUint16(14,0x21,true);
    c.setUint32(16,crc,true);c.setUint32(20,comp.length,true);c.setUint32(24,f.data.length,true);c.setUint16(28,nb.length,true);c.setUint32(42,off,true);cd.push(c,nb);off+=30+nb.length+comp.length;}
  const cdLen=cd.reduce((s,x)=>s+(x.byteLength||x.length),0),end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cdLen,true);end.setUint32(16,off,true);
  return new Blob([...parts,...cd,end],{type:'application/zip'});}

/* ---- GIF encoder: one shared 255-colour palette (median cut) + a transparent index, LZW ---- */
function encodeGIF(frames,W,H,loop){
  const samp=[],total=frames.length*W*H,step=Math.max(1,Math.floor(total/120000));let k=0;
  for(const f of frames)for(let i=0;i<W*H;i++,k++)if(k%step===0&&f.d[i*4+3]>=128)samp.push(f.d[i*4],f.d[i*4+1],f.d[i*4+2]);
  const pal=medianCut(samp,255),P=pal.length/3,cache=new Int16Array(32768).fill(-1);
  const near=(r,g,b)=>{const key=(r>>3)<<10|(g>>3)<<5|(b>>3);let v=cache[key];if(v>=0)return v;let best=0,bd=1e9;for(let j=0;j<P;j++){const dr=pal[j*3]-r,dg=pal[j*3+1]-g,db=pal[j*3+2]-b,d=dr*dr*2+dg*dg*3+db*db;if(d<bd){bd=d;best=j;}}cache[key]=best;return best;};
  const out=[];const u8=v=>out.push(v&255),u16=v=>{out.push(v&255,(v>>8)&255);},str=s=>{for(const ch of s)out.push(ch.charCodeAt(0));};
  str('GIF89a');u16(W);u16(H);u8(0xF7);u8(255);u8(0);for(let j=0;j<256;j++){if(j<P){u8(pal[j*3]);u8(pal[j*3+1]);u8(pal[j*3+2]);}else{u8(0);u8(0);u8(0);}}
  if(loop){u8(0x21);u8(0xFF);u8(11);str('NETSCAPE2.0');u8(3);u8(1);u16(0);u8(0);}
  for(const f of frames){u8(0x21);u8(0xF9);u8(4);u8((2<<2)|1);u16(f.delay);u8(255);u8(0);
    u8(0x2C);u16(0);u16(0);u16(W);u16(H);u8(0);
    const idx=new Uint8Array(W*H);for(let i=0;i<W*H;i++){const a=f.d[i*4+3];idx[i]=a<128?255:near(f.d[i*4],f.d[i*4+1],f.d[i*4+2]);}
    u8(8);const data=lzwEncode(idx);for(let i=0;i<data.length;i+=255){const n=Math.min(255,data.length-i);u8(n);for(let j=0;j<n;j++)out.push(data[i+j]);}u8(0);}
  u8(0x3B);return new Uint8Array(out);}
function medianCut(s,max){const n=s.length/3;if(!n)return [0,0,0];let boxes=[Array.from({length:n},(_,i)=>i)];
  const range=b=>{let lo=[255,255,255],hi=[0,0,0];for(const i of b)for(let c=0;c<3;c++){const v=s[i*3+c];if(v<lo[c])lo[c]=v;if(v>hi[c])hi[c]=v;}return hi.map((h,c)=>h-lo[c]);};
  while(boxes.length<max){let bi=-1,bs=-1,bc=0;boxes.forEach((b,i)=>{if(b.length<2)return;const r=range(b),m=Math.max(...r),score=m*Math.sqrt(b.length);if(score>bs){bs=score;bi=i;bc=r.indexOf(m);}});
    if(bi<0||bs<=0)break;const b=boxes[bi].sort((x,y)=>s[x*3+bc]-s[y*3+bc]),h=b.length>>1;boxes.splice(bi,1,b.slice(0,h),b.slice(h));}
  const pal=[];for(const b of boxes){let r=0,g=0,bl=0;for(const i of b){r+=s[i*3];g+=s[i*3+1];bl+=s[i*3+2];}pal.push(Math.round(r/b.length),Math.round(g/b.length),Math.round(bl/b.length));}return pal;}
function lzwEncode(idx){const out=[];let cur=0,bits=0,size=9,next=258;const dict=new Map();
  const put=code=>{cur|=code<<bits;bits+=size;while(bits>=8){out.push(cur&255);cur>>>=8;bits-=8;}};
  put(256);let prefix=idx[0];
  for(let i=1;i<idx.length;i++){const k=idx[i],key=prefix*256+k,v=dict.get(key);if(v!==undefined){prefix=v;continue;}
    put(prefix);if(next<4096){dict.set(key,next++);if(next>(1<<size)&&size<12)size++;}else{put(256);dict.clear();next=258;size=9;}prefix=k;}
  put(prefix);put(257);if(bits>0)out.push(cur&255);return out;}

/* ---- (0.41) retiming and in-between frames for export ---- */
const exRate=(v,fps)=>v==='same'?fps:v==='x2'?fps*2:v==='x4'?fps*4:+v||fps;
/* straight-alpha RGBA bytes of a canvas */
const cvPix=c=>c.getContext('2d').getImageData(0,0,c.width,c.height);
/* a picture from RGBA bytes held premultiplied (Float32), back to a canvas with straight colour */
function pixToCanvas(W,H,pm){const c=document.createElement('canvas');c.width=W;c.height=H;const img=new ImageData(W,H),d=img.data;
  for(let i=0;i<W*H;i++){const a=pm[i*4+3];if(a>0.001){d[i*4]=Math.min(255,pm[i*4]/a*255+.5);d[i*4+1]=Math.min(255,pm[i*4+1]/a*255+.5);d[i*4+2]=Math.min(255,pm[i*4+2]/a*255+.5);d[i*4+3]=Math.round(a*255);}}
  c.getContext('2d').putImageData(img,0,0);return c;}
/* premultiplied 0..1 floats of a canvas */
function cvPremul(c){const d=cvPix(c).data,n=d.length/4,o=new Float32Array(n*4);for(let i=0;i<n;i++){const a=d[i*4+3]/255;o[i*4]=d[i*4]/255*a;o[i*4+1]=d[i*4+1]/255*a;o[i*4+2]=d[i*4+2]/255*a;o[i*4+3]=a;}return o;}
function blendFrames(ca,cb,w){const W=ca.width,H=ca.height,a=cvPremul(ca),b=cvPremul(cb),o=new Float32Array(a.length);for(let i=0;i<o.length;i++)o[i]=a[i]*(1-w)+b[i]*w;return pixToCanvas(W,H,o);}
/* Motion: block matching on small copies (coarse, then refined), smoothed, then both frames are pulled along the movement */
function flowFeat(c,maxD){const s=Math.min(1,maxD/Math.max(c.width,c.height)),w=Math.max(8,Math.round(c.width*s)),h=Math.max(8,Math.round(c.height*s)),t=document.createElement('canvas');t.width=w;t.height=h;
  const x=t.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(c,0,0,w,h);const d=x.getImageData(0,0,w,h).data,f=new Float32Array(w*h*2);
  for(let i=0;i<w*h;i++){const a=d[i*4+3]/255;f[i*2]=(0.3*d[i*4]+0.59*d[i*4+1]+0.11*d[i*4+2])*a;f[i*2+1]=d[i*4+3]*0.6;}return {f,w,h};}
/* for each block (step px apart) find the shift in B that best matches A; gx/gy = a first guess per block from a coarser level (in this level's px) */
function blockMatch(A,B,step,win,R,guess){const w=A.w,h=A.h,gw=Math.ceil(w/step),gh=Math.ceil(h/step),dx=new Float32Array(gw*gh),dy=new Float32Array(gw*gh),ok=new Uint8Array(gw*gh),fa=A.f,fb=B.f;
  for(let by=0;by<gh;by++)for(let bx=0;bx<gw;bx++){const cx=bx*step,cy=by*step;let g0=0,g1=0;if(guess){const gi=Math.min(guess.gh-1,Math.round(by*guess.ry))*guess.gw+Math.min(guess.gw-1,Math.round(bx*guess.rx));g0=Math.round(guess.dx[gi]*guess.sc);g1=Math.round(guess.dy[gi]*guess.sc);}
    let en=0;for(let yy=-win;yy<=win;yy++){const ya=cy+yy;if(ya<0||ya>=h)continue;for(let xx=-win;xx<=win;xx++){const xa=cx+xx;if(xa>=0&&xa<w)en+=fa[(ya*w+xa)*2+1];}}
    let best=1e30,bdx=g0,bdy=g1;
    if(en<8){dx[by*gw+bx]=g0;dy[by*gw+bx]=g1;continue;}ok[by*gw+bx]=1;
    for(let oy=-R;oy<=R;oy++)for(let ox=-R;ox<=R;ox++){const sx=g0+ox,sy=g1+oy;let sad=0;
      for(let yy=-win;yy<=win;yy++){const ya=cy+yy;if(ya<0||ya>=h)continue;const yb=Math.min(h-1,Math.max(0,ya+sy));for(let xx=-win;xx<=win;xx++){const xa=cx+xx;if(xa<0||xa>=w)continue;const xb=Math.min(w-1,Math.max(0,xa+sx)),ia=(ya*w+xa)*2,ib=(yb*w+xb)*2;sad+=Math.abs(fa[ia]-fb[ib])+Math.abs(fa[ia+1]-fb[ib+1]);}}
      sad+=(Math.abs(ox)+Math.abs(oy))*0.4;if(sad<best){best=sad;bdx=sx;bdy=sy;}}
    dx[by*gw+bx]=bdx;dy[by*gw+bx]=bdy;}
  return {dx,dy,ok,gw,gh};}
function smoothFlow(F,times){const {gw,gh,ok}=F;for(let k=0;k<times;k++)for(const arr of [F.dx,F.dy]){const c=arr.slice();for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){if(!ok[y*gw+x])continue;const v=[];for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=Math.min(gw-1,Math.max(0,x+i)),yy=Math.min(gh-1,Math.max(0,y+j));if(ok[yy*gw+xx])v.push(c[yy*gw+xx]);}v.sort((p,q)=>p-q);arr[y*gw+x]=v[v.length>>1];}}}
function motionField(ca,cb){const lv=[[16,1,1,7],[32,2,2,3],[96,3,3,3],[256,4,4,2]];let prev=null,pw=0,F=null,fw=0,fh=0;
  for(const [d,step,win,R] of lv){const A1=flowFeat(ca,d),B1=flowFeat(cb,d);let guess=null;
    if(prev){const sc=A1.w/pw;guess={dx:prev.dx,dy:prev.dy,gw:prev.gw,gh:prev.gh,rx:(step/sc)/prev.step,ry:(step/sc)/prev.step,sc};}
    F=blockMatch(A1,B1,step,win,R,guess);F.step=step;smoothFlow(F,prev?1:2);prev=F;pw=A1.w;fw=A1.w;fh=A1.h;}
  return {F,step:prev.step,lw:fw,lh:fh};}
/* the movement seen from the in-between picture: each block's movement is carried to where the block is at time w, holes are filled from their neighbours */
function splatFlow(fld,w){const {F,step}=fld,{gw,gh}=F,sx=new Float32Array(gw*gh),sy=new Float32Array(gw*gh),has=new Uint8Array(gw*gh),mag=new Float32Array(gw*gh);
  for(let by=0;by<gh;by++)for(let bx=0;bx<gw;bx++){const i=by*gw+bx,dx=F.dx[i],dy=F.dy[i],m=Math.abs(dx)+Math.abs(dy);if(!F.ok[i]||m<0.5)continue;
    const tx=Math.round(bx+w*dx/step),ty=Math.round(by+w*dy/step);if(tx<0||ty<0||tx>=gw||ty>=gh)continue;const j=ty*gw+tx;if(!has[j]||m>mag[j]){has[j]=1;mag[j]=m;sx[j]=dx;sy[j]=dy;}}
  for(let it=0;it<6;it++){const add=[];for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){const j=y*gw+x;if(has[j])continue;let n=0,ax=0,ay=0;
      for(let q=-1;q<=1;q++)for(let r=-1;r<=1;r++){const xx=x+r,yy=y+q;if(xx<0||yy<0||xx>=gw||yy>=gh)continue;const k=yy*gw+xx;if(has[k]){n++;ax+=sx[k];ay+=sy[k];}}
      if(n)add.push([j,ax/n,ay/n]);}
    for(const [j,ax,ay] of add){has[j]=1;sx[j]=ax;sy[j]=ay;}}
  return {dx:sx,dy:sy,gw,gh};}
/* one in-between at time w (0..1) from A to B */
function motionFrame(ca,cb,fld,w){const W=ca.width,H=ca.height,a=cvPremul(ca),b=cvPremul(cb),o=new Float32Array(a.length),{step}=fld,F=splatFlow(fld,w),kx=fld.lw/W,ky=fld.lh/H,gw=F.gw,gh=F.gh;
  const samp=(src,x,y,out)=>{x=Math.min(W-1.001,Math.max(0,x));y=Math.min(H-1.001,Math.max(0,y));const x0=x|0,y0=y|0,fx=x-x0,fy=y-y0,i00=(y0*W+x0)*4,i10=i00+4,i01=i00+W*4,i11=i01+4;
    for(let c=0;c<4;c++)out[c]=(src[i00+c]*(1-fx)+src[i10+c]*fx)*(1-fy)+(src[i01+c]*(1-fx)+src[i11+c]*fx)*fy;};
  const t1=[0,0,0,0],t2=[0,0,0,0];
  for(let y=0;y<H;y++){const gy=Math.min(gh-1.001,y*ky/step),y0=gy|0,fy=gy-y0;
    for(let x=0;x<W;x++){const gx=Math.min(gw-1.001,x*kx/step),x0=gx|0,fx=gx-x0,i=y0*gw+x0;
      const vx=((F.dx[i]*(1-fx)+F.dx[i+1]*fx)*(1-fy)+(F.dx[i+gw]*(1-fx)+F.dx[i+gw+1]*fx)*fy)/kx,vy=((F.dy[i]*(1-fx)+F.dy[i+1]*fx)*(1-fy)+(F.dy[i+gw]*(1-fx)+F.dy[i+gw+1]*fx)*fy)/ky;
      samp(a,x-w*vx,y-w*vy,t1);samp(b,x+(1-w)*vx,y+(1-w)*vy,t2);const k=(y*W+x)*4;for(let c=0;c<4;c++)o[k+c]=t1[c]*(1-w)+t2[c]*w;}}
  return pixToCanvas(W,H,o);}
/* the animation resampled at a new frame rate, each new frame either the nearest earlier one, a blend, or a motion in-between */
async function buildRetimed(A0,full0,rate,mode,progress){const n=A0.frames.length,starts=[];let t=0;for(const f of A0.frames){starts.push(t);t+=f.hold/A0.fps;}const total=t,count=Math.max(1,Math.round(total*rate));
  const out=[],src=[],fields=new Map();let done=0,lastY=performance.now();
  for(let j=0;j<count;j++){const tj=j/rate;let i=0;while(i+1<n&&starts[i+1]<=tj+1e-9)i++;let w=0;if(mode!=='off'&&i+1<n){w=(tj-starts[i])/(starts[i+1]-starts[i]);if(w<.02)w=0;}
    src.push(i);
    if(w===0)out.push(full0[i]);
    else if(mode==='blend')out.push(blendFrames(full0[i],full0[i+1],w));
    else{if(!fields.has(i))fields.set(i,motionField(full0[i],full0[i+1]));out.push(motionFrame(full0[i],full0[i+1],fields.get(i),w));}
    done++;if(progress({done,total:count}))throw new Error('cancelled');if(w!==0&&performance.now()-lastY>40){await new Promise(r=>setTimeout(r,0));lastY=performance.now();}}
  const frames=out.map(()=>({hold:1})),tags=[];
  for(const tg of A0.tags){const [a,b]=tagRange(tg,A0);let from=-1,to=-1;src.forEach((i,j)=>{if(i>=a&&i<=b){if(from<0)from=j;to=j;}});if(from>=0)tags.push({name:tg.name,mode:tg.mode,color:tg.color,from:frames[from],to:frames[to]});}
  return {A:{frames,fps:rate,tags},full:out};}
