/* ================= Bake mesh maps, inside 3D Paint (0.24) =================
   Like Substance Painter's Bake Mesh Maps window: pick the maps, the size, a high-poly (optional) and which
   texture sets, press Bake. Each set is baked on its own part of the model and the results become that set's
   mesh maps, so masks, generators, anchors and materials that read them update straight away.
   The bake runs with the Bake tab's machinery and stays there afterwards: open the Bake tab to fine-tune it
   (cage, skew and offset fixes, per-map settings), send it to 3D Paint again, or send it to the Paint canvas
   to clean up intersections by hand. */
const P3BK_MAPS=['normal','ao','curv','height','thick','wnormal','position','id','light'];
const p3bk={sets:null,useHigh:true,last:null};
/* run fn on the Bake tab's own canvas, at w×h, without leaving 3D Paint (the screen holds still meanwhile) */
async function p3WithBakeDoc(w,h,fn){const mine=docState(),v3d=doc.v3d,wf=doc.workflow;let s=tabDocs.own.bake;tabDocs.own.bake=null;
  if(s&&s.doc.w===w&&s.doc.h===h)setDocState(s);else{disposeDocState(s);blankTabDoc(w,h,'Bake');}
  doc.v3d=v3d;doc.workflow=wf;tabDocs.hold=true;
  try{return await fn();}finally{tabDocs.hold=false;tabDocs.own.bake=docState();setDocState(mine);v3.mapsDirty=true;v3.dirty=true;requestRender(true);}}
function dlgP3Bake(){if(ui.mode!=='p3d')return;if(bk.busy){toast('Wait for the bake to finish.');return;}
  const model=bakeViewModel();if(!model||model.noUV){toast('The model has no UVs: nothing can be baked onto it.');return;}
  const C=bakeCfg,sets=p3.sets.filter(S=>!S.missing).map(S=>S.name);if(!p3bk.sets)p3bk.sets={};for(const S of p3.sets)if(S.hidden)p3bk.sets[S.name]=false;/* hidden sets (the eyeball) are left out of the bake unless you tick them */
  const size=[[doc.w,'Same as the set ('+doc.w+')'],[512,'512'],[1024,'1K'],[2048,'2K'],[4096,'4K'],...(MAX_DIM>=8192?[[8192,'8K']]:[])].filter((o,i,a)=>i===0||o[0]!==doc.w);let pick=C.size&&size.some(o=>o[0]===C.size)?C.size:doc.w;
  const kinds=Object.assign({},C.kinds);
  const body=el('div',{class:'dlg-grid',id:'p3bkDlg'});
  const draw=()=>{const hi=C.high;body.replaceChildren(
    el('div',{class:'sub',text:'Maps'}),
    el('div',{class:'chips'},...P3BK_MAPS.map(k=>chk('p3bk_'+k,BAKE_NAMES[k],!!kinds[k],v=>{kinds[k]=v;}))),
    el('div',{class:'sub',text:'Size'}),seg(size,pick,v=>{pick=+v;},'Bake size'),
    el('div',{class:'sub',text:'High-poly'}),
    hi?chk('p3bkHigh','Use “'+hi.name+'” ('+hi.tris.toLocaleString()+' triangles)',p3bk.useHigh,v=>{p3bk.useHigh=v;}):el('p',{class:'note',text:'None: the maps come from the model itself (height needs a high-poly, so it is skipped; the normal map only with the Bevel shader below).'}),
    el('div',{class:'chips'},el('button',{class:'btn sm',id:'p3bkLoadHigh',text:hi?'Load another…':'Load a high-poly…',onclick:async()=>{try{const m=await bakePickModel();if(m){bakeSetModel('high',m);p3bk.useHigh=true;draw();}}catch(e){toast('Could not load the model: '+(e.message||e));}}})),
    el('div',{class:'sub',text:'Texture sets'}),
    sets.length>1?el('div',{class:'chips'},...sets.map((n,i)=>chk('p3bkSet'+i,n,p3bk.sets[n]!==false,v=>{p3bk.sets[n]=v;}))):el('p',{class:'note',text:'The model has one texture set.'}),
    ...p3FromNBox(),
    bevelSection(draw,'p3bk'),
    el('div',{class:'sub',text:'Quality'}),seg([[32,'Draft'],[64,'Normal'],[128,'High']],C.rays>=128?128:C.rays<=32?32:64,v=>{C.rays=+v;},'Ray count'),
    chk('p3bkLayers','Also add other baked maps as layers',!!C.p3Layers,v=>{C.p3Layers=v;}),
    bakeLightLayerOption('p3bkLightLayer'),
    el('p',{class:'note',text:'Masks, generators and materials that use the mesh maps update when the bake is done. The bake also waits in the Bake tab: fine-tune it there (cage, fixes, per-map settings), or send it to the Paint canvas to clean it up.'}));};
  draw();
  openDialog({title:'Bake mesh maps',body,okLabel:'Bake',onOk(){const ks=P3BK_MAPS.filter(k=>kinds[k]);if(!ks.length){toast('Tick at least one map.');return false;}
    const which=sets.length>1?sets.filter(n=>p3bk.sets[n]!==false):sets;if(!which.length){toast('Tick at least one texture set.');return false;}
    Object.assign(C.kinds,kinds);const fromN=ks.filter(k=>p3FromNOn(k)),bake=ks.filter(k=>!fromN.includes(k));
    setTimeout(async()=>{if(fromN.length)await p3DeriveSets(fromN,which);if(bake.length)p3Bake(bake,pick,which);},0);}});}
/* ---- (0.95.8, Kenn) mesh maps made from the set's own normal map (imported or baked): curvature (with edges and creases),
   AO and height, picked as the source in this window. The result is a regular mesh map: generators, smart masks and
   materials use it like a baked one. ---- */
const P3_FROM_N=['curv','ao','height'];
const p3FromNOn=k=>P3_FROM_N.includes(k)&&p3bk.fromN&&p3bk.fromN[k]==='normal';
const p3HasNormalMap=()=>!!(doc.meshMaps&&doc.meshMaps.normal);
function p3FromNBox(){if(!p3HasNormalMap())return [];if(!p3bk.fromN)p3bk.fromN={};const F=p3bk.fromN,info=doc.meshMapInfo&&doc.meshMapInfo.normal;
  return [el('div',{class:'sub',text:'Source'}),el('p',{class:'note',text:'This set has a normal map'+(info&&info.name?' (“'+info.name+'”)':'')+'. Curvature, AO and Height can be made from it instead of baked from the model.'}),
    ...P3_FROM_N.map(k=>el('div',{class:'frow'},el('span',{text:BAKE_NAMES[k]}),seg([['bake','Bake from the model'],['normal','From the normal map']],F[k]||'bake',v=>{F[k]=v;},BAKE_NAMES[k]+' source'))),
    chk('p3bkNdx','The normal map is DirectX (green down)',!!F.dx,v=>{F.dx=v;})];}
/* make the maps from the live set's normal map */
function p3DeriveFromNormal(ks){const n0=doc.meshMaps&&doc.meshMaps.normal;if(!n0)return 0;const dx=!!(p3bk.fromN&&p3bk.fromN.dx),W=doc.w,H=doc.h,C=bakeCfg;
  const src=makeTarget(W,H,8,false);copyScaled(n0,src);let made=0;
  try{if(ks.includes('curv')){const raw=makeTarget(W,H,16,false),b=acquireD(src.depth),rad=Math.max(1,C.curvRadius||3);gaussian(src,b,Math.max(.8,rad*.35));
      run(P.f_ncurv,raw,{uN:b.tex,uWrap:!!doc.wrap,uStr:1.2*(C.curvStr||1),uMode:{int:0},uStep:rad,uFlipG:dx});release(b);
      if(!bkCurvP)bkCurvP=program(FS_BKCURV);const out=m=>{const t=makeTarget(W,H,8,false);run(bkCurvP,t,{uSrc:raw.tex,uEdges:C.curvEdges==null?1:C.curvEdges,uCreases:C.curvCreases==null?1:C.curvCreases,uMode:{int:m},uStr:1});setWrap(t,true);return t;};
      p3MapSet('curv',out(0),'Curvature from the normal map');p3MapSet('curvEdge',out(1),'Edges from the normal map');p3MapSet('curvCrease',out(2),'Creases from the normal map');disposeTarget(raw);made++;}
    if(ks.includes('ao')){const v={r:16,str:1,dx},t=makeTarget(W,H,8,false);CONVERTERS.aoFromNormal.make(src,t,v);CONVERTERS.aoFromNormal.cleanup(v);setWrap(t,true);p3MapSet('ao',t,'AO from the normal map');made++;}
    if(ks.includes('height')){const t=makeTarget(W,H,canFloat?16:8,false);heightFromNormal(src,t,{str:.6,iter:60,dx});setWrap(t,true);p3MapSet('height',t,'Height from the normal map');made++;}}
  finally{disposeTarget(src);}return made;}
async function p3DeriveSets(ks,which){loadStart('Mesh maps from the normal map');let n=0,miss=[];
  try{for(const name of which){const i=p3.sets.findIndex(S=>S.name===name);if(i<0)continue;loadBusy('From the normal map: '+name);await new Promise(r=>setTimeout(r,0));
      const job=()=>{if(!p3HasNormalMap()){miss.push(name);return;}n+=p3DeriveFromNormal(ks);};
      p3InSet(i,job);}}
  finally{loadEnd();}
  if(miss.length)toast('No normal map in '+miss.join(', ')+': nothing made there.');else if(n)toast('Made '+ks.map(k=>BAKE_NAMES[k]).join(', ')+' from the normal map.');}
/* bake the ticked maps for the ticked sets and hand them to the sets */
async function p3Bake(ks,size,which){p3bk.lastArgs={ks:ks.slice(),size,which:which&&which.slice()};const C=bakeCfg,model0=bakeViewModel(),
    /* (0.95) UDIM: bake the model with its tiles' canvas UVs, at a size that keeps each tile's pixels */
    ua=!!(p3.ua&&model0&&!model0.udimAtlas&&model0===v3.imported),model=ua?udimAtlasMesh(model0):model0,names=bkMats(model);
  if(ua){let n=1;for(const w of which||[]){const S=p3.sets.find(S=>S.name===w),B=S&&udimBox(p3Binding(S));if(B)n=Math.max(n,B.nx,B.ny);}size=Math.min(8192,size*n);}
  const keep={high:C.high,cage:C.cage,size:C.size};if(!p3bk.useHigh)C.high=null;if(C.cage&&C.low!==model)C.cage=null;
  /* the Bake tab's fixes are painted for its own model and size */
  if(C.low!==model||(C.size||0)!==size){for(const k of ['skew','offset'])if(bk.maps[k]){disposeTarget(bk.maps[k]);bk.maps[k]=null;}}
  C.size=size;const by={},t0=performance.now();let done=0,cancelled=false;
  try{await p3WithBakeDoc(size,size,async()=>{
    for(const n in bk.byMat||{})if(bk.byMat[n].res!==bk.res)for(const k in bk.byMat[n].res)disposeTarget(bk.byMat[n].res[k]);bk.byMat=null;
    for(const n of which){const S=p3.sets.find(S=>S.name===n),binding=p3Binding(S||{name:n}),i=names?names.indexOf(binding):-1,L=S&&S.tile?meshSubset(model,i>=0?i:null,S.tile):names&&i>=0?meshSubset(model,i):model;if(done)bk.res={};
      const r=await runBake(L,ks,{quiet:true});if(r==='cancelled'||!Object.keys(bk.res).length){cancelled=true;return;}
      by[S&&S.tile?binding+'@'+S.tile.id:names?binding:'*']={res:bk.res,kinds:bk.kinds,opts:bk.opts,src:bk.src};done++;}});}
  finally{if(!p3bk.useHigh)C.high=keep.high;if(keep.cage&&!C.cage)C.cage=keep.cage;}
  if(cancelled&&!done)return;
  /* the Bake tab keeps them for fine-tuning */
  C.low=model;if(names||p3.udim){bk.byMat=by;bk.matShow=null;bakeShowMat(Object.keys(by)[0]);}else{bk.byMat=null;const E=by['*'];if(E){bk.res=E.res;bk.kinds=E.kinds;bk.opts=E.opts;bk.src=E.src;}}
  const res={};for(const n in by)res[n]=by[n].res;
  const send=BK_SEND_ORDER.filter(k=>ks.includes(k)||((k==='curvEdge'||k==='curvCrease')&&ks.includes('curv')&&C.curvParts!==false));
  p3ReceiveBake(v3.imported&&model0===v3.imported?model0:null,res,send,!!C.p3Layers);
  p3bk.last={t:Date.now(),sets:done};
  toast('Baked '+ks.length+' map'+(ks.length>1?'s':'')+' for '+done+' texture set'+(done>1?'s':'')+' in '+((performance.now()-t0)/1000).toFixed(1)+' s. The mesh maps are updated.');}
/* after a bake: everything that reads the mesh maps is worked out again */
function p3MeshMapsChanged(){if(typeof msEpoch!=='undefined')msEpoch++;if(typeof p3MapsRender==='function')p3MapsRender();if(typeof paRefresh==='function')paRefresh();
  for(const L of paintLayers())if(L.fill&&L.fill.maps&&Object.values(L.fill.maps).some(m=>m&&m.on&&(m.src==='baked'||m.src==='conv')))fillRender(L);
  changedAll();}
/* Send the active set's bake to the Paint canvas (to clean up by hand) */
function p3BakeToPaint(){const S=p3.sets[p3.cur],key=S&&S.tile?p3Binding(S)+'@'+S.tile.id:S&&p3Binding(S);if(bk.byMat&&S&&bk.byMat[key])bakeShowMat(key);if(!Object.keys(bk.res).length){toast('Bake first.');return;}
  if(bakeSend())toast('Sent the bake'+(S&&bk.byMat?' of “'+S.name+'”':'')+' to the Paint canvas as layers.');}

