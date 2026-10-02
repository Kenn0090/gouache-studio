/* ================= Canvases of their own =================
   The Bake and Convert tabs each work on a canvas of their own, at their own size, so nothing
   there touches the painting until you send it. Entering one sets the painting document aside
   (its layers, undo steps, selection, working images and view: docState() from brush-tab.js)
   and brings in the tab's own; leaving swaps them back. withPaintDoc() steps into the
   painting for a moment, to read from it or to send results to it. */
const tabDocs={paint:null,own:{},key:null};
/* free everything a set-aside document holds on the graphics card */
function disposeDocState(s){if(!s)return;const walk=g=>{for(const n of g.children||[]){if(n.type==='group')walk(n);else disposeLayer(n);if(n.mask&&n.type==='group')maskDispose(n.mask);}};
  if(s.doc&&s.doc.root)walk(s.doc.root);if(s.doc&&s.doc.meshMaps)for(const k in s.doc.meshMaps)disposeTarget(s.doc.meshMaps[k]);
  for(const d in s.aux){const a=s.aux[d];for(const k of ['strokeT','beforeT','scratchT','previewT'])disposeTarget(a[k]);for(const t of a.pool.all)disposeTarget(t);}
  for(const d in s.empties)disposeTarget(s.empties[d]);if(s.sel&&s.sel.t)disposeTarget(s.sel.t);}
/* a blank document of the given size, with one empty layer */
function blankTabDoc(w,h,name){for(const k of Object.keys(aux))delete aux[k];for(const k of Object.keys(emptyTs))delete emptyTs[k];sel.t=null;sel.active=false;hist.undo=[];hist.redo=[];compOut=null;
  for(const k of Object.keys(doc))delete doc[k];
  Object.assign(doc,{w,h,depth:8,wrap:false,name,root:{type:'group',children:[],isRoot:true,visible:true,opacity:1,mode:-1},active:null,sel:new Set(),count:0,
    maps:['base'],map:'base',view:'base',mapDef:{},nrmStr:8,light:{az:135,el:40},v3d:null,anim:null,cage:null,workflow:'metal',projectAssets:[]});
  allocAux();groupCount=0;const L=newLayerObj('Layer');insertNode(L,doc.root);selectOnly(L);}
/* the tab's canvas size: its own, or the painting's the first time */
function tabDocEnter(key,w,h,name){if(tabDocs.paint)return;const v3d=doc.v3d,wf=doc.workflow;tabDocs.paint=docState();tabDocs.key=key;
  let s=tabDocs.own[key];tabDocs.own[key]=null;
  if(s&&s.doc.w===w&&s.doc.h===h)setDocState(s);else{disposeDocState(s);blankTabDoc(w,h,name);}
  doc.v3d=v3d;doc.workflow=wf;$('#docName').textContent=name;if(typeof selChanged==='function')selChanged();}
function tabDocExit(key){if(!tabDocs.paint)return;tabDocs.own[key]=docState();setDocState(tabDocs.paint);tabDocs.paint=null;tabDocs.key=null;
  $('#docName').textContent=doc.name;if(typeof selChanged==='function')selChanged();if(typeof updateStatus==='function')updateStatus();}
/* change the tab's canvas size (everything on it is cleared) */
function tabDocResize(w,h,name){if(!tabDocs.paint||(doc.w===w&&doc.h===h))return;const v3d=doc.v3d,wf=doc.workflow,old=docState();blankTabDoc(w,h,name||doc.name);disposeDocState(old);doc.v3d=v3d;doc.workflow=wf;
  resizeGL();fit();requestRender(true);}
/* run fn with the painting document in place (a no-op switch when it already is) */
function withPaintDoc(fn){if(!tabDocs.paint||tabDocs.inPaint)return fn();const mine=docState();setDocState(tabDocs.paint);tabDocs.inPaint=true;
  try{return fn();}finally{tabDocs.inPaint=false;tabDocs.paint=docState();setDocState(mine);}}
/* the same for work that waits (saving): the screen holds still meanwhile */
async function withPaintDocAsync(fn){if(!tabDocs.paint||tabDocs.inPaint)return fn();const mine=docState();setDocState(tabDocs.paint);tabDocs.inPaint=true;tabDocs.hold=true;
  try{return await fn();}finally{tabDocs.inPaint=false;tabDocs.hold=false;tabDocs.paint=docState();setDocState(mine);requestRender(true);}}
const paintDocSize=()=>tabDocs.paint?[tabDocs.paint.doc.w,tabDocs.paint.doc.h]:[doc.w,doc.h];
/* commands about the painting itself switch back to Paint first when a tab with its own canvas is open */
/* (3D Paint exports and changes its own texture set) */
for(const k of ['export','expTex','imageSize','canvasSize','place','depth8','depth16','maps','flatten','mergeVisible'])if(actions[k]){const f=actions[k];actions[k]=(...a)=>{if(tabDocs.paint&&!(ui.mode==='p3d'&&['export','expTex','maps','depth8','depth16','flatten','mergeVisible'].includes(k))&&!setMode('paint',true))return;return f(...a);};}
/* a copy of src into dst at dst's size (smoothly scaled when the sizes differ) */
function copyScaled(src,dst){if(src.w===dst.w&&src.h===dst.h){run(P.shift,dst,{uSrc:src.tex,uOff:[0,0],uWrap:false,uOutside:[0,0,0,0]});return;}
  run(P.resample,dst,{uSrc:src.tex,uOffset:[0,0],uScale:[src.w/dst.w,src.h/dst.h],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(src.w/dst.w)))}});}
