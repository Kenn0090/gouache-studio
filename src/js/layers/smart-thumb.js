/* Render saved materials on the same model regardless of the current viewport.
   Load assets first, then use a small temporary document for the synchronous render. */
const smTh={kit:null,pending:null,busy:false,size:256,queue:Promise.resolve()};

function smThumbKit(){
  if(smTh.kit)return Promise.resolve(smTh.kit);
  if(smTh.pending)return smTh.pending;
  smTh.pending=(async()=>{
    const mesh=await studioPreviewLoad();
    if(!mesh)throw new Error('The Material Preview mesh could not be loaded.');
    const size=512,maps={};
    const decode=async name=>decodeFile(new File(
      [await studioPreviewBytes('preview-'+name+'.png')],'Preview_'+name+'.png',{type:'image/png'}));
    try{
      for(const [key,name] of [['normal','N'],['curv','Curv'],['height','H'],['thick','Thickness']]){
        const raw=await decode(name);
        let texture=null,source=null;
        try{
          texture=uploadStraight(raw);
          source=makeTarget(raw.w,raw.h,8,false);
          premultInto(source,texture,[0,0],null);
          maps[key]=makeTarget(size,size,8,false);
          copyScaled(source,maps[key]);
          setWrap(maps[key],true);
        }finally{
          if(texture)gl.deleteTexture(texture);
          disposeTarget(source);
          if(raw.el)URL.revokeObjectURL(raw.el.src);
        }
      }
      const raw=await decode('ORM'),canvas=document.createElement('canvas');
      canvas.width=canvas.height=size;
      const context=canvas.getContext('2d');
      try{context.drawImage(raw.el,0,0,size,size);}finally{URL.revokeObjectURL(raw.el.src);}
      const data=context.getImageData(0,0,size,size).data;
      for(let i=0;i<data.length;i+=4){data[i+1]=data[i+2]=data[i];data[i+3]=255;}
      maps.ao=makeTarget(size,size,8,false);
      writeRegion(maps.ao,0,0,size,size,new Uint8Array(data.buffer));
      setWrap(maps.ao,true);
      smTh.kit={mesh:primMesh('matpreview',0),maps,w:size,h:size};
      return smTh.kit;
    }catch(e){
      for(const map of Object.values(maps))disposeTarget(map);
      throw e;
    }
  })().finally(()=>{smTh.pending=null;});
  return smTh.pending;
}

function smThumbFreeGpu(gpu){
  if(!gpu)return;
  if(gpu.wireRanges)for(const range of gpu.wireRanges.values())gl.deleteBuffer(range.b);
  for(const buffer of [gpu.vb,gpu.ib,gpu.eb])gl.deleteBuffer(buffer);
  gl.deleteVertexArray(gpu.vao);
  gl.deleteVertexArray(gpu.evao);
}

async function smStudioThumb(tree,workflow=doc.workflow,isCurrent=()=>true){
  if(!isCurrent()||gl.isContextLost())return null;
  smTh.busy=true;
  try{
    const kit=await smThumbKit(),copy=smCopyTree(tree);
    if(smNeeds(copy))await smResolveNode(copy,workflow);
    while(isCurrent()&&!gl.isContextLost()&&(stroke||preview||selLive||tabDocs.hold)){
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!isCurrent()||gl.isContextLost())return null;
    return await smThumbRender(kit,copy,workflow);
  }catch(e){
    console.warn('smart material preview',e);
    return null;
  }finally{smTh.busy=false;}
}

function smThumbRender(kit,tree,workflow){
  const project=docState();
  const viewState={mesh:v3.mesh,gpu:v3.gpu,tex:v3.tex,cam:v3.cam,rt:v3.rt,dirty:v3.dirty,mapsDirty:v3.mapsDirty};
  const paintState={sets:p3.sets,cur:p3.cur,udim:p3.udim,ua:p3.ua};
  const uiState={mode:ui.mode,viewMask:ui.viewMask};
  const meshMap=p3mm.k,thumbs=new Set(thumbQ);
  const projectMasks={epoch:msEpoch,version:msDocVer};
  const projectProjection={maps:fillPosC,limit:fillPosLimit};
  const projectSeams=seamBlurCache;
  const projectRender={dirty:dirtyComp,weld:weldEndPreview,timelapse:tlTouch};
  const size=smTh.size,width=size*2,set={name:'Smart preview'};
  try{
    Object.assign(v3,{gpu:null,mesh:null,tex:{},rt:false});
    Object.assign(p3,{sets:[set],cur:0,udim:false,ua:null});
    Object.assign(ui,{mode:'p3d',viewMask:false});
    p3mm.k=null;
    fillPosC=null;
    seamBlurCache=null;
    blankTabDoc(kit.w,kit.h,'Smart preview');
    doc.v3d={...V3D_DEFAULTS,model:'matpreview',unlit:false,env:'none',shadows:false};
    doc.workflow=workflow;

    const need=[...smMapsOf(tree)].filter(key=>MAP_DEFS[key]&&!FILL_SKIP.includes(key)&&
      !WF_KEYS[workflow==='spec'?'metal':'spec'].includes(key));
    const standard=workflow==='spec'?P3_MAPS_SPEC:P3_MAPS;
    doc.maps=MAP_ORDER.filter(key=>standard.includes(key)||need.includes(key));
    syncTargets();
    doc.meshMaps={...kit.maps};
    doc.meshMapVer=1;
    for(const layer of doc.root.children.splice(0))disposeLayer(layer);

    const mesh={...kit.mesh,setRanges:[{name:set.name,start:0,count:kit.mesh.idx.length/3}]};
    v3.mesh=mesh;
    v3Upload(mesh);
    gl.bindVertexArray(vao);
    const base=newLayerObj('Base',true);
    base.fill=fillDefaults();
    const maps=base.fill.maps;
    for(const map of Object.values(maps))map.on=false;
    Object.assign(maps.base,{on:true,src:'value',c:[.42,.43,.45]});
    if(workflow==='spec'){
      Object.assign(maps.spec,{on:true,src:'value',c:[.04,.04,.04]});
      Object.assign(maps.gloss,{on:true,src:'value',v:.4});
    }else{
      Object.assign(maps.rough,{on:true,src:'value',v:.6});
      Object.assign(maps.metal,{on:true,src:'value',v:0});
    }
    fillRender(base);
    insertNode(base,doc.root);

    const only=tree.t==='G'&&tree.kids?.length===1&&tree.kids[0].fx?.map==='all';
    const material=smBuild(only?tree.kids[0]:tree);
    insertNode(material,doc.root);
    selectOnly(material);

    msUpdateAll();
    p3RefreshTex();
    const dist=mesh.radius/Math.sin(doc.v3d.fov*Math.PI/360)*1.026;
    v3.cam={yaw:.7,pitch:.9,dist,tx:0,ty:0,tz:0};
    return v3Offscreen(width,width,{transparent:true,overlays:false,async:true})
      .then(pixels=>smThumbImage(pixels,width,size));
  }finally{
    const temp=doc.root!==project.doc.root?docState():null;
    if(temp)temp.doc.meshMaps={}; // The preview kit owns these maps.
    for(const target of Object.values(v3.tex))disposeTarget(target);
    if(fillPosC)for(const target of [fillPosC.pos,fillPosC.nrm,fillPosC.tan])disposeTarget(target);
    fillPosC=projectProjection.maps;
    fillPosLimit=projectProjection.limit;
    seamBlurDispose();
    seamBlurCache=projectSeams;
    smThumbFreeGpu(v3.gpu);
    Object.assign(v3,viewState);
    Object.assign(p3,paintState);
    Object.assign(ui,uiState);
    p3mm.k=meshMap;
    gl.bindVertexArray(vao);
    setDocState(project);
    disposeDocState(temp);
    thumbQ.clear();
    for(const item of thumbs)thumbQ.add(item);
    msEpoch=projectMasks.epoch;
    msDocVer=projectMasks.version;
    dirtyComp=projectRender.dirty;
    weldEndPreview=projectRender.weld;
    tlTouch=projectRender.timelapse;
  }
}

function smThumbImage(pixels,width,size){
  const render=document.createElement('canvas');
  render.width=render.height=width;
  const context=render.getContext('2d'),image=context.createImageData(width,width);
  for(let y=0;y<width;y++){
    image.data.set(pixels.subarray((width-1-y)*width*4,(width-y)*width*4),y*width*4);
  }
  context.putImageData(image,0,0);
  const tile=document.createElement('canvas');
  tile.width=tile.height=size;
  const tileContext=tile.getContext('2d');
  tileContext.imageSmoothingQuality='high';
  tileContext.drawImage(render,0,0,size,size);
  return tile.toDataURL('image/webp',.86);
}

/* Every save gets a turn. An older job must not overwrite a newer save or recreate a deleted tile. */
function smThumbLater(rec,workflow=doc.workflow){
  if(!rec||rec.kind!=='smart')return Promise.resolve(null);
  const isCurrent=()=>matLib.list.includes(rec);
  const next=smTh.queue.then(async()=>{
    const thumb=await smStudioThumb(rec.tree,workflow,isCurrent);
    if(!thumb||!isCurrent())return null;
    rec.thumb=thumb;
    // Store only the thumbnail. Saving the recipe again would repack every embedded image.
    store.tx('readwrite',st=>isCurrent()?st.put({
      id:smThumbKey(rec.id),kind:'smart-preview',revision:rec.previewRev,thumb
    }):null,'materials').catch(e=>console.warn('smart material preview',e));
    renderMats();
    return thumb;
  });
  smTh.queue=next.catch(e=>{console.warn('smart material preview',e);return null;});
  return smTh.queue;
}

const smThumbKey=id=>'smart-preview:'+id;

function smThumbRedo(rec){
  toast('Making the preview of “'+rec.name+'”…');
  return smThumbLater(rec).then(thumb=>{
    if(!thumb&&matLib.list.includes(rec))toast('Could not make a Material Preview thumbnail for “'+rec.name+'”.');
    return thumb;
  });
}
