/* Mesh maps open at their source size in a separate Paint document. A persistent texture-set
   identity keeps the return link valid after rename/save, and prevents edits reaching another project. */
function p3MapEdit(k){if(ui.mode!=='p3d'||stroke||preview||selLive)return;const S=p3.sets[p3.cur],t=doc.meshMaps?.[k];if(!S||!t?.tex)return;
  S.meshEditID=S.meshEditID||crypto.randomUUID();
  const channel=t.depth===16?'height':'base',link={setID:S.meshEditID,setName:S.name,key:k,w:t.w,h:t.h,depth:t.depth,channel},name=P3_MESHMAP_NAMES[k]||k;
  const copy=makeTarget(t.w,t.h,t.depth,false,!!t.packed);copyScaled(t,copy);
  try{if(!dtNewTab())return;newDoc(t.w,t.h,8,false,'Edit '+name+' · '+S.name,false);
    if(channel==='height')setDocMaps(['base','height'],'Mesh map channels');
    const L=newLayerObj('Baked '+name,true);doc.count--;L.meshEdit=link;L.baked=true;L.meshMap=k;
    copyScaled(copy,ensureMapTarget(L,channel));structOp('Edit mesh map',()=>{insertNode(L,doc.root);selectOnly(L);});setEditMap(channel);syncTargets();changed(L);renderLayers();dtRender();
    toast('Edit '+name+' here. Right-click its marked layer › Send to 3D Paint as mesh map.');return L;
  }finally{disposeTarget(copy);}}
function p3MapEditBadge(n){const link=n.meshEdit;if(!link)return null;const name=P3_MESHMAP_NAMES[link.key]||link.key;
  const badge=el('span',{class:'meshmapbadge',title:'Baked '+name+' · linked to '+link.setName,'aria-label':'Baked '+name+' mesh map'});
  badge.innerHTML='<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 5l5-2 6 2 5-2v12l-5 2-6-2-5 2zM7 3v12M13 5v12M4 10l2 2 4-4"/></svg>';return badge;}
function paintMeshMapBack(n){const link=n?.meshEdit;if(ui.mode!=='paint'||!link||stroke||preview||selLive)return false;
  const si=p3.sets.findIndex(S=>S.meshEditID===link.setID);if(si<0){toast('Open the original 3D Paint project before sending this mesh map back.');return false;}
  if(!P3_IMPORT_MAPS.includes(link.key)||!doc.maps.includes(link.channel)){toast('The mesh map channel is no longer in this document.');return false;}
  const imgs=flatNodeMaps(n,[link.channel]),source=imgs[link.channel];
  try{if(!setMode('p3d',true))return false;if(si!==p3.cur)p3SwitchSet(si,true);
    const M=doc.meshMaps||(doc.meshMaps={}),meta=doc.meshMapInfo||(doc.meshMapInfo={}),k=link.key,old=M[k],info=meta[k]?Object.assign({},meta[k]):null;
    /* Replacing a map keeps its original resolution/precision. Undo uses the desktop scratch
       system rather than retaining additional document-size GPU textures. */
    const w=old?.w||link.w,h=old?.h||link.h,depth=old?.depth||link.depth,before=old?captureRegion(old,0,0,w,h):null;
    const T=old||makeTarget(w,h,depth,false,packedHeight(depth));copyScaled(source,T);setWrap(T,true);M[k]=T;
    const after=captureRegion(T,0,0,w,h),updated={name:n.name+' (edited)',w,h};meta[k]=updated;
    const refresh=()=>{doc.meshMapVer=(doc.meshMapVer||0)+1;p3MeshMapsChanged();buildP3Panel();};
    const apply=(snap,inf)=>{if(!snap){if(M[k])disposeTarget(M[k]);delete M[k];delete meta[k];}else{let dst=M[k];if(!dst||dst.w!==w||dst.h!==h||dst.depth!==depth){if(dst)disposeTarget(dst);dst=M[k]=makeTarget(w,h,depth,false,packedHeight(depth));}restoreRegion(snap,dst,0,0);setWrap(dst,true);meta[k]=Object.assign({},inf);}refresh();};
    pushUndo({label:'Update '+(P3_MESHMAP_NAMES[k]||k)+' mesh map',refs:[],snaps:[before,after].filter(Boolean),undo(){apply(before,info);},redo(){apply(after,updated);}});refresh();
    toast('Updated '+(P3_MESHMAP_NAMES[k]||k)+' in “'+p3.sets[p3.cur].name+'”. Materials and generators now use the edited map.');return true;
  }finally{disposeTarget(source);}}
