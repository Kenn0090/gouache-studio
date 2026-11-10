/* ================= Smart material previews on the Material preview model (0.96.9, Kenn: "like Substance Painter") =================
   Saving a smart material used to keep a small screenshot of the 3D view as it was (your model, your camera, whatever was
   around it). Now the saved folder is built again on the Material preview model, with that model's own mesh maps (curvature,
   ambient occlusion, thickness, height, normal), over a mid grey base, and photographed from the same angle as the built-in
   smart materials (scripts/smart-thumbs.cjs). The project is set aside for that moment and put back exactly as it was:
   nothing is drawn on screen meanwhile (everything between setting aside and putting back runs without waiting). */
const smTh={kit:null,pending:null,busy:false,size:256};
/* the model and its mesh maps, made once (kept on the graphics card while the app runs) */
function smThumbKit(){if(smTh.kit)return Promise.resolve(smTh.kit);if(smTh.pending)return smTh.pending;
  smTh.pending=(async()=>{const m=await studioPreviewLoad();if(!m)throw new Error('the Material preview model could not be loaded');
    const pic=async name=>{const raw=await decodeFile(new File([await studioPreviewBytes('preview-'+name+'.png')],'Preview_'+name+'.png',{type:'image/png'}));
      const tex=uploadStraight(raw),t=makeTarget(raw.w,raw.h,8,false);try{premultInto(t,tex,[0,0],null);}finally{gl.deleteTexture(tex);}setWrap(t,true);return t;};
    const maps={normal:await pic('N'),curv:await pic('Curv'),height:await pic('H'),thick:await pic('Thickness')};
    /* ambient occlusion is the red channel of the packed ORM picture */
    const raw=await decodeFile(new File([await studioPreviewBytes('preview-ORM.png')],'Preview_ORM.png',{type:'image/png'})),c=document.createElement('canvas');c.width=raw.w;c.height=raw.h;
    const x=c.getContext('2d');x.drawImage(raw.el,0,0);const d=x.getImageData(0,0,raw.w,raw.h).data;try{URL.revokeObjectURL(raw.el.src);}catch(e){}
    const g=new Uint8Array(raw.w*raw.h*4);for(let i=0;i<raw.w*raw.h;i++){const v=d[i*4];g[i*4]=g[i*4+1]=g[i*4+2]=v;g[i*4+3]=255;}
    const ao=makeTarget(raw.w,raw.h,8,false);writeRegion(ao,0,0,raw.w,raw.h,g);setWrap(ao,true);maps.ao=ao;
    const mesh=primMesh('matpreview',0);smTh.kit={mesh,maps,w:raw.w,h:raw.h};return smTh.kit;})().finally(()=>{smTh.pending=null;});
  return smTh.pending;}
const smThumbFreeGpu=g=>{if(!g)return;if(g.wireRanges)for(const r of g.wireRanges.values())gl.deleteBuffer(r.b);gl.deleteVertexArray(g.vao);gl.deleteBuffer(g.vb);gl.deleteBuffer(g.ib);gl.deleteBuffer(g.eb);gl.deleteVertexArray(g.evao);};
/* tree = a smart material as saved (smSer); returns a data URL, or null when it cannot be made (the caller keeps the old picture) */
async function smStudioThumb(tree){if(ui.mode!=='p3d'||typeof p3==='undefined'||smTh.busy)return null;smTh.busy=true;
  try{const kit=await smThumbKit(),t=JSON.parse(JSON.stringify(tree));
    /* Library materials and grunge pictures the folder names are fetched before anything is set aside */
    if(smNeeds(t))await smResolveNode(t);
    if(stroke||preview||selLive||(typeof tabDocs!=='undefined'&&tabDocs.hold)||ui.mode!=='p3d')return null;
    return smThumbRender(kit,t);}
  catch(e){console.warn('smart material preview',e);return null;}finally{smTh.busy=false;}}
function smThumbRender(kit,t){const mine=docState(),wf=doc.workflow,v3d=doc.v3d,keep={mesh:v3.mesh,gpu:v3.gpu,tex:v3.tex,cam:Object.assign({},v3.cam),rt:v3.rt,sets:p3.sets,cur:p3.cur,mv:v3.mapsDirty};
  const thq=new Set(thumbQ),S=smTh.size,W=S*2,set={name:'Smart preview'};let out=null,gpu=null,temp=null;
  try{blankTabDoc(kit.w,kit.h,'Smart preview');doc.v3d=v3d;doc.workflow=wf;
    /* the maps a 3D Paint texture set has, plus any the folder paints into */
    const need=[...smMapsOf(t)].filter(k=>MAP_DEFS[k]&&!FILL_SKIP.includes(k)&&!WF_KEYS[wf==='spec'?'metal':'spec'].includes(k));
    doc.maps=MAP_ORDER.filter(k=>(wf==='spec'?P3_MAPS_SPEC:P3_MAPS).includes(k)||need.includes(k));syncTargets();
    doc.meshMaps=Object.assign({},kit.maps);doc.meshMapVer=1;
    for(const n of [...doc.root.children]){doc.root.children.splice(doc.root.children.indexOf(n),1);disposeLayer(n);}
    /* a mid grey base, so overlay materials (dirt, dust, edge wear) show against something, as in the built-in previews */
    const B=newLayerObj('Base');B.fill=fillDefaults();const F=B.fill.maps;for(const k in F)F[k].on=false;
    Object.assign(F.base,{on:true,src:'value',c:[.42,.43,.45]});if(wf==='spec'){if(F.spec)Object.assign(F.spec,{on:true,src:'value',c:[.04,.04,.04]});if(F.gloss)Object.assign(F.gloss,{on:true,src:'value',v:.4});}
    else{Object.assign(F.rough,{on:true,src:'value',v:.6});Object.assign(F.metal,{on:true,src:'value',v:0});}
    fillRender(B);insertNode(B,doc.root);
    const solo=t.t==='G'&&(t.kids||[]).length===1&&t.kids[0].fx&&t.kids[0].fx.map==='all',n=smBuild(solo?t.kids[0]:t);smFitWorkflow(n);insertNode(n,doc.root);selectOnly(n);
    /* the model: its own buffers, one material range for the one stand-in texture set */
    temp=Object.assign({},kit.mesh,{setRanges:[{name:set.name,start:0,count:kit.mesh.idx.length/3}]});
    v3.gpu=null;v3.mesh=temp;v3Upload(temp);gpu=v3.gpu;gl.bindVertexArray(vao);
    p3.sets=[set];p3.cur=0;v3.tex={};v3.rt=false;msEpoch++;msUpdateAll();
    p3RefreshTex();
    Object.assign(v3.cam,{yaw:.7,pitch:.9});v3Frame();v3.cam.dist*=.95;
    const d=v3Offscreen(W,W,{transparent:true}),c=document.createElement('canvas');c.width=c.height=W;const x=c.getContext('2d'),id=x.createImageData(W,W);
    for(let y=0;y<W;y++)id.data.set(d.subarray((W-1-y)*W*4,(W-y)*W*4),y*W*4);x.putImageData(id,0,0);
    const o=document.createElement('canvas');o.width=o.height=S;const ox=o.getContext('2d');ox.imageSmoothingQuality='high';ox.drawImage(c,0,0,S,S);
    out=o.toDataURL('image/webp',.86);if(!/^data:image\/webp/.test(out))out=o.toDataURL('image/png');}
  catch(e){console.warn('smart material preview',e);out=null;}
  finally{for(const k in v3.tex)disposeTarget(v3.tex[k]);smThumbFreeGpu(gpu);
    v3.gpu=keep.gpu;v3.mesh=keep.mesh;v3.tex=keep.tex;Object.assign(v3.cam,keep.cam);v3.rt=keep.rt;p3.sets=keep.sets;p3.cur=keep.cur;
    gl.bindVertexArray(vao);/* the flat full-screen shape every 2D pass draws with (not the model) */
    /* the stand-in document goes (its mesh maps stay in the kit for next time) */
    doc.meshMaps={};const gone=docState();setDocState(mine);disposeDocState(gone);
    thumbQ.clear();for(const q of thq)thumbQ.add(q);msEpoch++;v3.mapsDirty=true;v3.dirty=true;requestRender(true);}
  return out;}
/* after Save / Update: the quick screenshot is kept until the proper preview is ready, then replaced */
function smThumbLater(rec){if(!rec||rec.kind!=='smart')return;smStudioThumb(rec.tree).then(u=>{if(!u)return;const r=matLib.list.find(x=>x.id===rec.id);if(!r)return;
  r.thumb=u;Promise.resolve(store.put(r,'materials')).catch(e=>console.warn('smart material preview',e));renderMats();});}
/* Right-click › Redo preview on one of your own smart materials */
function smThumbRedo(rec){if(ui.mode!=='p3d'){toast('Open 3D Paint to make the preview.');return;}toast('Making the preview of “'+rec.name+'”…');smThumbLater(rec);}
