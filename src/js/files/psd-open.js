/* ================= PSD open ================= */
function psdMask(m){if(!m||!m.imageData||!(m.imageData.width>0))return null;const mk=makeMask((m.defaultColor||0)/255),tex=uploadMask(m.imageData);
  run(P.maskplace,mk.target,{uMask:tex,uRect:[m.left||0,m.top||0,m.imageData.width,m.imageData.height],uDef:(m.defaultColor||0)/255});gl.deleteTexture(tex);mk.enabled=!m.disabled;return mk;}
async function openPSD(buf,name){
  needLib('agPsd','PSD');let psd;
  try{psd=agPsd.readPsd(buf,{useImageData:true,skipThumbnail:true});}
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
  const build=(list,parent)=>{for(const l of list||[]){
    if(l.children){const G=newGroupObj(l.name||'Group');Object.assign(G,{visible:!l.hidden,opacity:l.opacity==null?1:l.opacity,mode:(!l.blendMode||l.blendMode==='pass through')?-1:(PS_MODE[l.blendMode]||0),open:l.opened!==false});
      G.mask=psdMask(l.mask);insertNode(G,parent);build(l.children,G);continue;}
    if(l.adjustment)continue;
    const L=newLayerObj(l.name||'Layer');
    Object.assign(L,{visible:!l.hidden,opacity:clamp((l.opacity==null?1:l.opacity)*(l.fillOpacity==null?1:l.fillOpacity),0,1),mode:PS_MODE[l.blendMode]||0,clip:!!l.clipping,lockAlpha:!!l.transparencyProtected});
    L.mask=psdMask(l.mask);insertNode(L,parent);items.push({l,L});}};
  build(psd.children,doc.root);
  for(const {l,L} of items){
    if(l.imageData&&l.imageData.width>0&&l.imageData.height>0){const tex=uploadStraight({w:l.imageData.width,h:l.imageData.height,data:l.imageData.data,bits});
      premultInto(L.target,tex,[l.left||0,l.top||0],null);gl.deleteTexture(tex);}
    await tick();}
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
