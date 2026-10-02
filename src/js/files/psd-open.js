/* ================= PSD open ================= */
/* Placing a PSD retains its tree in one new folder, with a single undo step. All offsets
   use the document's overall fit, so separate layers and masks stay aligned. */
/* Big PSDs hold hundreds of megapixels of layers. ag-psd would decode them all at once and stop at its 2 GB limit,
   so we read the file keeping every layer packed, and unpack one layer at a time as it is placed. */
function psdRead(buf){return agPsd.readPsd(buf,{useImageData:true,useRawData:true,skipThumbnail:true,totalMemoryLimit:undefined});}
function psdUnpack(l){if(l.rawData)agPsd.decodeLayerPixels(l,true);}
/* Layers can hang far outside the canvas (a 10000 px layer on a 2550 px page): keep only what shows. */
function psdCrop(l,x0,y0,x1,y1){const im=l.imageData;if(!im||!(im.width>0))return null;const L=l.left||0,T=l.top||0,a=Math.max(L,x0),b=Math.max(T,y0),c=Math.min(L+im.width,x1),d=Math.min(T+im.height,y1);
  if(c<=a||d<=b)return null;if(a===L&&b===T&&c===L+im.width&&d===T+im.height)return {w:im.width,h:im.height,data:im.data,left:L,top:T};
  const w=c-a,h=d-b,out=new im.data.constructor(w*h*4);for(let y=0;y<h;y++){const o=((y+b-T)*im.width+(a-L))*4;out.set(im.data.subarray(o,o+w*4),y*w*4);}return {w,h,data:out,left:a,top:b};}
function psdFree(l){l.imageData=null;if(l.mask)l.mask.imageData=null;}
async function placePSD(buf,name){needLib('agPsd','PSD');const psd=psdRead(buf);
  if(!(psd.width>0&&psd.height>0)||psd.width>MAX_DIM||psd.height>MAX_DIM)throw new Error('This PSD is larger than this computer can edit.');
  const root=doc.root,S=Math.min(1,doc.w/psd.width,doc.h/psd.height),off=[Math.round((doc.w-psd.width*S)/2),Math.round((doc.h-psd.height*S)/2)],G=newGroupObj(name||'PSD'),items=[],notes=new Set();
  const mask=m=>{if(!m?.imageData?.width)return null;const mk=makeMask((m.defaultColor||0)/255),tex=uploadMask(m.imageData);try{run(P.maskplace,mk.target,{uMask:tex,uRect:[off[0]+(m.left||0)*S,off[1]+(m.top||0)*S,m.imageData.width*S,m.imageData.height*S],uDef:(m.defaultColor||0)/255});}finally{gl.deleteTexture(tex);}mk.enabled=!m.disabled;return mk;};
  const build=async(list,parent)=>{for(const l of list||[]){let cr;if(l.adjustment){notes.add('Adjustment layers were skipped.');continue;}psdUnpack(l);let n;
    if(l.children){n=newGroupObj(l.name||'Group');n.open=l.opened!==false;n.mode=(!l.blendMode||l.blendMode==='pass through')?-1:(PS_MODE[l.blendMode]||0);}
    else{n=newLayerObj(l.name||'Layer');doc.count--;n.mode=PS_MODE[l.blendMode]||0;n.clip=!!l.clipping;n.lockAlpha=!!l.transparencyProtected;items.push(n);}
    Object.assign(n,{visible:!l.hidden,opacity:clamp((l.opacity??1)*(l.fillOpacity??1),0,1),mask:mask(l.mask)});insertNode(n,parent);
    if(l.vectorMask)notes.add('Vector masks were skipped.');if(l.effects&&!l.effects.disabled&&Object.keys(l.effects).some(k=>!['disabled','scale'].includes(k)))notes.add('Photoshop layer effects were not imported.');if(l.text||l.placedLayer)notes.add('Text and smart objects were imported as pixels.');if(l.blendMode&&l.blendMode!=='pass through'&&!(l.blendMode in PS_MODE))notes.add('Unsupported blend modes use Normal.');
    if(l.children)await build(l.children,n);else if(l.imageData?.width>0&&l.imageData?.height>0&&(cr=psdCrop(l,0,0,psd.width,psd.height))){const raw={w:cr.w,h:cr.h,data:cr.data,bits:psd.bitsPerChannel||8},tex=uploadStraight(raw);
      try{if(S===1)premultInto(n.target,tex,[off[0]+cr.left,off[1]+(l.top||0)],null);else{const t=makeTarget(raw.w,raw.h,doc.depth,false);try{premultInto(t,tex,[0,0],null);run(P.resample,n.target,{uSrc:t.tex,uOffset:[off[0]+cr.left*S,off[1]+(l.top||0)*S],uScale:[1/S,1/S],uTaps:{int:Math.min(8,Math.ceil(1/S))},uOutside:[0,0,0,0]});}finally{disposeTarget(t);}}}finally{gl.deleteTexture(tex);}}
    psdFree(l);await tick();if(doc.root!==root)throw new Error('The document changed during import. Try again.');}};
  try{await build(psd.children,G);if(!items.length&&psd.imageData){const L=newLayerObj('Background');doc.count--;drawRawInto(L.target,{w:psd.width,h:psd.height,data:psd.imageData.data,bits:psd.bitsPerChannel||8},true);insertNode(L,G);items.push(L);}if(!items.length)throw new Error('This PSD contains no readable pixel layers.');
    structOp('Place layered PSD',()=>{insertNode(G,doc.root);selectOnly(G);});changedAll();toast('Placed “'+name+'”: '+items.length+' layers in a folder.'+(notes.size?' '+[...notes].join(' '):''));return G;
  }catch(e){const dispose=n=>{if(n.children)n.children.forEach(dispose);disposeLayer(n);};dispose(G);throw e;}}
function psdMask(m,W,H){if(!m||!m.imageData||!(m.imageData.width>0))return null;const mk=makeMask((m.defaultColor||0)/255),c=psdCrop(m,0,0,W,H);if(!c){mk.enabled=!m.disabled;return mk;}const tex=uploadMask({width:c.w,height:c.h,data:c.data});
  run(P.maskplace,mk.target,{uMask:tex,uRect:[c.left,c.top,c.w,c.h],uDef:(m.defaultColor||0)/255});gl.deleteTexture(tex);mk.enabled=!m.disabled;return mk;}
async function openPSD(buf,name){
  needLib('agPsd','PSD');let psd;
  try{psd=psdRead(buf);}
  catch(e){throw new Error('This PSD could not be read: '+e.message+(/mode/i.test(e.message)?'. Convert it to RGB in Photoshop first.':''));}
  const W=psd.width,H=psd.height;if(W>MAX_DIM||H>MAX_DIM)throw new Error('This PSD is '+W+' × '+H+'. The editor handles canvases up to '+MAX_DIM+' px on a side.');
  const bits=psd.bitsPerChannel||8,notes=[],fx=[],adj=[],modes=new Set();const note=s=>{if(!notes.includes(s))notes.push(s);};
  if(bits>8&&!canFloat)note('This GPU cannot edit at 16 bits, so the file was opened at 8 bits per channel.');
  if(bits===32)note('32-bit HDR data was converted to 16-bit.');
  const items=[];let groups=0;
  const scan=(list)=>{for(const l of list||[]){
    if(l.children){groups++;
      if(l.blendMode&&l.blendMode!=='pass through'&&!(l.blendMode in PS_MODE))modes.add(l.blendMode);scan(l.children);continue;}
    if(l.adjustment){adj.push(l.name);continue;}
    if(l.effects&&Object.keys(l.effects).some(k=>!['disabled','scale'].includes(k))&&!l.effects.disabled)fx.push(l.name);
    if(l.text)note('Text layers came in as pixels, so the text is no longer editable.');
    if(l.placedLayer)note('Smart objects came in as pixels.');
    if(l.blendMode&&!(l.blendMode in PS_MODE))modes.add(l.blendMode);
    if(l.vectorMask)note('Vector masks were ignored.');}};
  scan(psd.children);
  if(adj.length)note('Adjustment layers were skipped: '+adj.join(', ')+'.');
  if(fx.length)note('Layer effects such as shadows, strokes and glows are not drawn yet: '+fx.join(', ')+'.');
  if(modes.size)note('Blend modes replaced with Normal: '+[...modes].join(', ')+'.');
  const depth=bits>8&&canFloat?16:8;
  newDoc(W,H,depth,false,name,false);
  const build=async(list,parent)=>{for(const l of list||[]){
    if(l.adjustment)continue;
    psdUnpack(l);
    if(l.children){const G=newGroupObj(l.name||'Group');Object.assign(G,{visible:!l.hidden,opacity:l.opacity==null?1:l.opacity,mode:(!l.blendMode||l.blendMode==='pass through')?-1:(PS_MODE[l.blendMode]||0),open:l.opened!==false});
      G.mask=psdMask(l.mask,W,H);psdFree(l);insertNode(G,parent);await build(l.children,G);continue;}
    const L=newLayerObj(l.name||'Layer');
    Object.assign(L,{visible:!l.hidden,opacity:clamp((l.opacity==null?1:l.opacity)*(l.fillOpacity==null?1:l.fillOpacity),0,1),mode:PS_MODE[l.blendMode]||0,clip:!!l.clipping,lockAlpha:!!l.transparencyProtected});
    L.mask=psdMask(l.mask,W,H);insertNode(L,parent);items.push({l,L});
    const c=psdCrop(l,0,0,W,H);if(c){const tex=uploadStraight({w:c.w,h:c.h,data:c.data,bits});
      premultInto(L.target,tex,[c.left,c.top],null);gl.deleteTexture(tex);}
    psdFree(l);await tick();}};
  await build(psd.children,doc.root);
  const addComposite=(nm,visible)=>{const L=newLayerObj(nm);L.visible=visible;insertNode(L,doc.root);const tex=uploadStraight({w:W,h:H,data:psd.imageData.data,bits});premultInto(L.target,tex,[0,0],null);gl.deleteTexture(tex);return L;};
  if(!items.length&&psd.imageData)addComposite('Background',true);
  else if(notes.length&&psd.imageData)addComposite('Photoshop composite (reference)',false);
  if(!allLayers().length){const L=newLayerObj('Background');insertNode(L,doc.root);}
  /* bring back live gradients and editable text saved by Gouache Studio */
  const notes2=readLiveLayersXmp(psd.imageResources&&psd.imageResources.xmpMetadata),live=notes2.layers;let restored=0;
  for(const it of live){const x=items[it.i];if(!x||x.L.name!==it.name)continue;if(it.grad){x.L.grad=it.grad;renderLiveGrad(x.L);restored++;}else if(it.text){x.L.text=it.text;renderText(x.L);restored++;}}
  /* an animation saved by Gouache Studio: its frames sit in a hidden group at the top */
  const G=doc.root.children[doc.root.children.length-1];let animMode=false;
  if(notes2.anim&&G&&G.type==='group'&&G.name==='Gouache animation'){const an=notes2.anim,frames=G.children.filter(isLayer);detachNode(G);
    frames.forEach((F,i)=>{F.frame=true;F.hold=an.holds&&an.holds[i]||1;F.parent=null;});
    if(frames.length){doc.anim=makeAnim(frames);doc.anim.fps=an.fps||12;doc.anim.cur=clamp(an.cur||0,0,frames.length-1);if(an.onion)doc.anim.onion=Object.assign(doc.anim.onion,an.onion);
      doc.anim.tags=(an.tags||[]).filter(t=>frames[t.from]&&frames[t.to]).map(t=>({name:t.name,from:frames[t.from],to:frames[t.to],mode:t.mode||'loop',color:t.color||TAG_COLORS[0]}));
      if(an.bg)ui.animBg=an.bg;animMode=an.mode==='anim';}}
  const lays=allLayers();selectOnly([...lays].reverse().find(L=>effVisible(L))||lays[lays.length-1]);doc.count=lays.length;
  changedAll();updateStatus();fit();if(animMode)setMode('anim',true);
  const summary=items.length+' layer'+(items.length===1?'':'s')+(groups?' in '+groups+' group'+(groups===1?'':'s'):'')+', '+W+' × '+H+', '+bits+'-bit';
  if(notes.length)openDialog({title:'Opened “'+name+'”',okLabel:null,cancelLabel:'OK',body:el('div',{class:'dlg-grid'},
    el('p',{class:'note',text:summary+'. A few Photoshop features did not carry over:'}),el('ul',{class:'report'},...notes.map(n=>el('li',{text:n}))),
    psd.imageData?el('p',{class:'note',text:'Photoshop’s flattened version is included as a hidden layer at the top so you can compare.'}):null)});
  else toast('Opened “'+name+'”: '+summary+'.');
}
