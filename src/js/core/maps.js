/* ================= Maps (material channels) =================
   A document has a list of maps (doc.maps). Every layer keeps one image per map it uses in L.maps;
   maps a layer does not use take no memory. L.target is always the image for the map being edited
   (doc.map), or a shared empty image when the layer has nothing in that map, so every tool keeps
   working on "the layer" unchanged. Height is stored at 16 bits even in 8-bit documents. */
const MAP_DEFS={
  base:{label:'Base colour',grey:false,def:null,blend:0},
  rough:{label:'Roughness',grey:true,def:.5,blend:0},
  metal:{label:'Metallic',grey:true,def:0,blend:0},
  height:{label:'Height',grey:true,def:.5,blend:21,hint:'Mid-grey is flat; lighter raises, darker lowers.'},
  normal:{label:'Normal',grey:false,def:null,blend:0,noPaint:true},
  ao:{label:'Ambient occlusion',grey:true,def:1,blend:0},
  emis:{label:'Emissive',grey:false,def:null,blend:0},
  opac:{label:'Opacity',grey:true,def:1,blend:0}};
const MAP_ORDER=['base','rough','metal','height','normal','ao','emis','opac'];
const MAP_TEMPLATES={hand:['base'],pbr:['base','rough','metal','height','normal']};
function mapDepth(k){return k==='height'&&canFloat?16:doc.depth;}
/* what a map shows where no layer has painted it */
function mapDefault(k){if(k==='base')return [0,0,0,0];if(k==='normal')return [.5,.5,1,1];if(k==='emis')return [0,0,0,1];
  const v=doc.mapDef&&doc.mapDef[k]!=null?doc.mapDef[k]:MAP_DEFS[k].def;return [v,v,v,1];}
function mapModeOf(n,k){if(n.type==='group')return n.mode;if(k==='base')return n.mode;const m=n.mapModes&&n.mapModes[k];return m!=null?m:MAP_DEFS[k].blend;}
function setMapModeOf(n,k,m){if(k==='base'||n.type==='group'){n.mode=m;return;}n.mapModes=n.mapModes||{};n.mapModes[k]=m;}
const mapT=(L,k)=>L.maps?L.maps[k]:(k==='base'?L.target:null);
const hasMap=(L,k)=>{const t=mapT(L,k);return !!t&&!t.empty;};
function mapKeysOf(L){return L.maps?Object.keys(L.maps).filter(k=>L.maps[k]&&!L.maps[k].empty):['base'];}
/* shared, never-written empty images, one per bit depth */
const emptyTs={};
function emptyFor(d){let t=emptyTs[d];if(!t||t.w!==doc.w||t.h!==doc.h){if(t)disposeTarget(t);t=makeTarget(doc.w,doc.h,d);t.empty=true;emptyTs[d]=t;}return t;}
function resetEmpties(){for(const d in emptyTs){disposeTarget(emptyTs[d]);delete emptyTs[d];}}
function ensureMapTarget(L,k){if(!L.maps)L.maps={base:L.target};let t=L.maps[k];if(!t||t.empty){t=makeTarget(doc.w,doc.h,mapDepth(k));L.maps[k]=t;if(k===doc.map)L.target=t;}return t;}
/* before writing to L.target */
function ensureTarget(L){if(L&&L.maps&&L.target&&L.target.empty)ensureMapTarget(L,doc.map);return L&&L.target;}
function paintLayers(){return allLayers(paintRoot());}
/* point every layer's .target at the edited map */
function syncTargets(){for(const L of paintLayers()){if(!L.maps)L.maps={base:L.target};L.target=L.maps[doc.map]||emptyFor(mapDepth(doc.map));}}
function setEditMap(k,keepView){if(!doc.maps.includes(k))return;if(ui.mode==='anim'&&k!=='base'){toast('Animation mode paints the base colour map only.');return;}if(k===doc.map&&(keepView||doc.view===k))return;
  if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  if(typeof xf!=='undefined'&&xf)xfCommit();if(typeof gsess!=='undefined'&&gsess)gradCommit();
  const prev=doc.map;if(k!==prev){for(const L of paintLayers())if(L.maps&&L.target&&!L.target.empty)L.maps[prev]=L.target;
    doc.map=k;useAux(mapDepth(k));if(compOut){release(compOut);compOut=acquire();}syncTargets();}
  if(!keepView)doc.view=k;
  if(typeof chanRestricted==='function'&&chanRestricted())selectChannel(-1);
  changedAll();refreshMapsUI();buildBrushPanel();}
function setView(v){doc.view=v;if(v!=='material'&&v!=='normal'&&v!==doc.map){setEditMap(v);return;}requestRender(true);refreshMapsUI();}

/* ---- rendering one map ---- */
/* layers of a list composited for map k onto a transparent image (for merges and groups) */
function renderNodesMap(list,k){const prev=pool;pool=auxFor(mapDepth(k)).pool;const acc=acquire();clearTarget(acc);const r=compositeList(list,acc,k);pool=prev;return r;}
/* the whole document's map k, over that map's default value */
function compositeMap(k){const prev=pool;pool=auxFor(mapDepth(k)).pool;const acc=acquire();clearTarget(acc,mapDefault(k));const r=compositeList(paintRoot().children,acc,k);pool=prev;return r;}

/* ---- adding and removing maps (undoable) ---- */
function setDocMaps(keys,label,defs){keys=MAP_ORDER.filter(k=>keys.includes(k)||k==='base');const before=doc.maps.slice(),removed=before.filter(k=>!keys.includes(k));
  const defB=Object.assign({},doc.mapDef),defA=Object.assign({},doc.mapDef,defs||{});
  if(removed.includes(doc.map))setEditMap('base');const stash=new Map();
  for(const L of paintLayers())for(const k of removed)if(L.maps&&L.maps[k]){stash.set(L.maps[k],[L,k]);delete L.maps[k];}
  const apply=(ks,df)=>{doc.maps=ks.slice();doc.mapDef=Object.assign({},df);if(!doc.maps.includes(doc.map))setEditMap('base');if(!doc.maps.includes(doc.view)&&doc.view!=='material'&&doc.view!=='normal')doc.view=doc.map;
    if((doc.view==='material'||doc.view==='normal')&&doc.maps.length<2)doc.view=doc.map;syncTargets();changedAll();refreshMapsUI();buildBrushPanel();};
  let applied=true;apply(keys,defA);
  pushUndo({label:label||'Maps',refs:[],
    undo(){for(const [t,[L,k]] of stash)L.maps[k]=t;applied=false;apply(before,defB);},
    redo(){for(const [t,[L,k]] of stash)delete L.maps[k];applied=true;apply(keys,defA);},
    drop(){if(applied)for(const t of stash.keys())disposeTarget(t);}});}

/* ---- normal map and lit material view ---- */
/* map k of the whole document; the edited map reuses the frame's composite (it includes live strokes) */
function mapComp(k,own){if(k===doc.map&&own)return {t:own,own:true};return {t:compositeMap(k),own:false};}
/* the final normal: built from height (strength doc.nrmStr) and combined with normal detail */
function normalComposite(flipY,own){const hasH=doc.maps.includes('height'),hasN=doc.maps.includes('normal');
  const out=acquireD(doc.depth);if(!hasH&&!hasN){clearTarget(out,[.5,.5,1,1]);return out;}
  const h=hasH?mapComp('height',own):null,n=hasN?mapComp('normal',own):null;
  run(P.nrm,out,{uH:h?h.t.tex:dummy,uN:n?n.t.tex:dummy,uUseN:!!n,uStr:hasH?doc.nrmStr:0,uWrap:!!doc.wrap,uFlipY:!!flipY});
  for(const c of [h,n])if(c&&!c.own)release(c.t);return out;}
function lightVec(){const a=doc.light.az*Math.PI/180,e=doc.light.el*Math.PI/180;return [Math.cos(e)*Math.cos(a),Math.cos(e)*Math.sin(a),Math.sin(e)];}
function buildMaterialView(){const own=compOut;let out;
  if(doc.view==='normal')out=normalComposite(false,own);
  else{const get=k=>doc.maps.includes(k)?mapComp(k,own):null;
    const base=get('base'),r=get('rough'),m=get('metal'),ao=get('ao'),em=get('emis'),nrm=normalComposite(false,own);
    out=acquireD(doc.depth);
    run(P.mat,out,{uBase:base.t.tex,uRough:r?r.t.tex:dummy,uMetal:m?m.t.tex:dummy,uNrm:nrm.tex,uAO:ao?ao.t.tex:dummy,uEmis:em?em.t.tex:dummy,
      uHas:{int:(r?1:0)|(m?2:0)|4|(ao?8:0)|(em?16:0)},uLight:lightVec(),uDef:[MAP_DEFS.rough.def,MAP_DEFS.metal.def,0,0]});
    for(const c of [base,r,m,ao,em])if(c&&!c.own)release(c.t);release(nrm);}
  release(own);compOut=out;}
