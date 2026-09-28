/* ================= Fill layers =================
   Like Substance Painter's fill layers: one layer that fills every map it has switched on with a value
   (a colour, or a roughness / metallic / height level) or with an image (stretched or tiled). What shows
   is decided by its mask, so painting on a fill layer paints its mask. L.fill = {maps:{k:{on,src,c,v,tile,name}}}.
   Value maps are redrawn from the settings; image maps keep their pixels (saved with the file), and the
   picked image stays in memory (L._fillImg[k]) so its tiling can still be changed until the file is closed. */
const FS_FILLIMG=`uniform sampler2D uSrc; uniform float uTile; uniform int uGrey; in vec2 vUV;
void main(){ vec4 s=texture(uSrc,fract(vUV*uTile));
  if(uGrey==1){ float g=s.a>1e-6?dot(s.rgb/s.a,vec3(0.299,0.587,0.114)):0.0; o=vec4(vec3(g),1.0); return; }
  o=s; }`;
let P_FILLIMG=null,fillCount=0;
const FILL_SKIP=['normal'];
const fillMapsOf=()=>doc.maps.filter(k=>!FILL_SKIP.includes(k));
function fillDefaults(){const m={};for(const k of MAP_ORDER){if(FILL_SKIP.includes(k))continue;const d=MAP_DEFS[k].def;
    m[k]={on:k==='base'||k==='rough'||k==='metal'||k==='spec'||k==='gloss',src:'value',c:k==='base'?ui.fg.slice():k==='spec'?[.22,.22,.22]:k==='emis'?[0,0,0]:null,v:d==null?.5:d,tile:1};}
  return {maps:m};}
const fillClone=f=>{const c=JSON.parse(JSON.stringify(f));return c;};
/* redraw a fill layer's maps from its settings (only kinds: 'value' maps, or also image maps when their picture is in memory) */
function fillRender(L,only){const f=L.fill;if(!f)return;
  for(const k of fillMapsOf()){if(only&&k!==only)continue;const s=f.maps[k]||(f.maps[k]=fillDefaults().maps[k]);
    if(!s.on){const t=mapT(L,k);if(t&&!t.empty)clearTarget(t);continue;}
    const T=ensureMapTarget(L,k),grey=MAP_DEFS[k].grey;
    if(s.src==='image'){const img=L._fillImg&&L._fillImg[k];if(!img)continue;if(!P_FILLIMG)P_FILLIMG=program(FS_FILLIMG);run(P_FILLIMG,T,{uSrc:img.tex,uTile:Math.max(1,s.tile||1),uGrey:{int:grey?1:0}});continue;}
    const c=grey?[s.v,s.v,s.v]:(s.c||[s.v,s.v,s.v]);clearTarget(T,[c[0],c[1],c[2],1]);}
  if(doc.map==='base')delete L.blankBase;L.lookVer=(L.lookVer||0)+1;scheduleThumb(L);requestRender(true);}
/* Layer › New fill layer (and the fill button under the layers): fills everything; a selection becomes its mask */
/* preset: {name, maps:{k:{c|v}}} fills those maps (a material from the 3D Paint panel) and skips the dialog */
function cmdNewFillLayer(preset){if(ui.mode==='anim'){toast('Fill layers are available in Paint mode.');return;}
  if(ui.mode!=='paint'&&ui.mode!=='p3d'&&typeof setMode==='function')setMode('paint',true);
  const L=newLayerObj(preset&&preset.name||'Fill '+(++fillCount));doc.count--;L.fill=fillDefaults();
  if(preset&&preset.maps){for(const k in L.fill.maps)L.fill.maps[k].on=false;for(const k in preset.maps)if(L.fill.maps[k])Object.assign(L.fill.maps[k],{on:true,src:'value'},preset.maps[k]);}
  fillRender(L);
  const m=makeMask(1),fromSel=sel.active&&!sel.quick;if(fromSel)run(P.loadsel,m.target,{uSrc:sel.t.tex,uWhat:{int:1},uInv:false});
  L.mask=m;L.editMask=true;
  structOp('New fill layer',()=>{const [p,i]=insertPoint();insertNode(L,p,i);selectOnly(L);});
  changed(L);if(!preset)dlgFillLayer(L,true);else{renderLayers();toast('Added “'+L.name+'”'+(fromSel?' in the selection.':'. Paint its mask to show it where you want (black hides, white shows).'));}return L;}
/* the fill's settings: live on the canvas, one undo step on OK */
function dlgFillLayer(L,fresh){L=L||doc.active;if(!isLayer(L)||!L.fill){toast('Select a fill layer.');return;}
  const before=fillClone(L.fill),W=fillClone(L.fill),keys0=fillMapsOf(),snapB={};
  for(const k of keys0){const t=mapT(L,k);snapB[k]=t&&!t.empty?captureRegion(t,0,0,doc.w,doc.h):null;}
  const imgB=Object.assign({},L._fillImg||{});
  const apply=k=>{L.fill=W;fillRender(L,k);};
  const box=el('div',{class:'dlg-grid filldlg'});
  const draw=()=>{box.replaceChildren();const keys=fillMapsOf();
    for(const k of keys){const s=W.maps[k]||(W.maps[k]=fillDefaults().maps[k]),grey=MAP_DEFS[k].grey;
      const row=el('div',{class:'fillrow'+(s.on?'':' off')});
      row.append(chk('fl_on_'+k,MAP_DEFS[k].label,!!s.on,v=>{s.on=v;apply(k);draw();}));
      if(s.on){row.append(seg([['value',grey?'Value':'Colour'],['image','Image']],s.src,v=>{s.src=v;if(v==='image'&&!(L._fillImg&&L._fillImg[k]))fillPickImage(L,k,s,()=>{apply(k);draw();});else{apply(k);draw();}},'Fill '+MAP_DEFS[k].label+' with'));
        if(s.src==='value'){if(grey)row.append(makeSlider({id:'fl_v_'+k,label:k==='metal'?'Metallic':k==='rough'?'Roughness':'Level',min:0,max:1,step:.01,value:s.v,fmt:pct,onInput:v=>{s.v=v;apply(k);}}).el);
          else row.append(el('div',{class:'frow'},el('label',{text:'Colour'}),colourBtn('fl_c_'+k,()=>s.c||[.5,.5,.5],c=>{s.c=c;apply(k);},MAP_DEFS[k].label+' colour')));}
        else{const has=!!(L._fillImg&&L._fillImg[k]);
          row.append(el('div',{class:'row wrap'},el('span',{class:'note',text:s.name||'No image'}),el('button',{class:'btn sm',text:'Choose image…',onclick:()=>fillPickImage(L,k,s,()=>{apply(k);draw();})})));
          if(has)row.append(makeSlider({id:'fl_t_'+k,label:'Tile',min:1,max:16,step:1,value:s.tile||1,fmt:v=>v+'×',onInput:v=>{s.tile=v;apply(k);}}).el);
          else if(s.name)row.append(el('p',{class:'note',text:'Choose the image again to change its tiling.'}));}}
      box.append(row);}
    const miss=['rough','metal'].filter(k=>doc.workflow!=='spec'&&!doc.maps.includes(k));
    if(miss.length)box.append(el('div',{class:'row wrap'},el('span',{class:'note',text:'This document has no '+miss.map(k=>MAP_DEFS[k].label.toLowerCase()).join(' or ')+' map.'}),
      el('button',{class:'btn sm',text:'Add '+miss.map(k=>MAP_DEFS[k].label.toLowerCase()).join(' and '),onclick:()=>{setDocMaps([...doc.maps,...miss],'Add maps for the fill layer');fillRender(L);draw();}})));
    box.append(el('p',{class:'note',text:'Painting on a fill layer paints its mask: black hides the fill, white shows it.'}));};
  draw();
  const restore=()=>{L.fill=before;L._fillImg=imgB;for(const k of Object.keys(snapB)){const s=snapB[k];if(s)restoreRegion(s,ensureMapTarget(L,k),0,0);else{const t=mapT(L,k);if(t&&!t.empty)clearTarget(t);}}fillRender(L);changed(L);};
  openDialog({title:(fresh?'New fill layer':'Fill layer')+': '+L.name,body:box,okLabel:'OK',
    onCancel(){restore();},
    onOk(){L.fill=W;const keys=[...new Set([...keys0,...fillMapsOf()])],snapA={};
      for(const k of keys){const t=mapT(L,k);snapA[k]=t&&!t.empty?captureRegion(t,0,0,doc.w,doc.h):null;}
      const put=(f,S)=>{L.fill=fillClone(f);for(const k of keys){const s=S[k];if(s)restoreRegion(s,ensureMapTarget(L,k),0,0);else{const t=mapT(L,k);if(t&&!t.empty)clearTarget(t);}}L.lookVer=(L.lookVer||0)+1;renderLayers();};
      if(JSON.stringify(before)!==JSON.stringify(W))pushUndo({label:'Fill layer',refs:[L],snaps:[...Object.values(snapB),...Object.values(snapA)].filter(Boolean),undo(){put(before,snapB);},redo(){put(W,snapA);}});
      changed(L);}});}
async function fillPickImage(L,k,s,done){const fs=await pickFiles('image/*',false,'Images',['png','jpg','jpeg','webp','tga','tif','tiff','bmp','psd','exr','hdr']);const f=fs[0];if(!f){if(!(L._fillImg&&L._fillImg[k]))s.src='value';done();return;}
  let t;try{t=await fileTarget(f);}catch(e){toast('Could not read '+f.name+': '+(e.message||e));s.src='value';done();return;}
  setWrap(t,true);L._fillImg=L._fillImg||{};if(L._fillImg[k])disposeTarget(L._fillImg[k]);L._fillImg[k]=t;s.src='image';s.name=f.name;done();}
/* painting, filters and fills on a fill layer go to its mask */
function fillMaskEdit(n){if(isLayer(n)&&n.fill&&n.mask&&!n.editMask)n.editMask=true;}
/* Convert to pixels: the layer keeps what it shows now and becomes a normal layer */
function fillRasterize(L){if(!L||!L.fill)return;const f=L.fill;L.fill=null;pushUndo({label:'Convert fill to pixels',refs:[L],undo(){L.fill=f;renderLayers();},redo(){L.fill=null;renderLayers();}});renderLayers();}
