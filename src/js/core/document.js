/* ================= Document ================= */
const MODES=['Normal','Multiply','Screen','Overlay','Darken','Lighten','Color Dodge','Color Burn','Hard Light','Soft Light','Difference','Exclusion','Linear Dodge (Add)','Hue','Saturation','Color','Luminosity',
  'Linear Burn','Darker Color','Lighter Color','Vivid Light','Linear Light','Pin Light','Hard Mix','Subtract','Divide'];
const MODE_GROUPS=[['',[0]],['Darken',[4,1,7,17,18]],['Lighten',[5,2,6,12,19]],['Contrast',[3,9,8,20,21,22,23]],['Inversion',[10,11,24,25]],['Component',[13,14,15,16]]];
const PSD_KEYS=['norm','mul ','scrn','over','dark','lite','div ','idiv','hLit','sLit','diff','smud','lddg','hue ','sat ','colr','lum ','lbrn','dkCl','lgCl','vLit','lLit','pLit','hMix','fsub','fdiv'];
const PS_MODE={'normal':0,'darken':4,'multiply':1,'color burn':7,'linear burn':17,'darker color':18,'lighten':5,'screen':2,'color dodge':6,'linear dodge':12,'lighter color':19,
  'overlay':3,'soft light':9,'hard light':8,'vivid light':20,'linear light':21,'pin light':22,'hard mix':23,'difference':10,'exclusion':11,'subtract':24,'divide':25,'hue':13,'saturation':14,'color':15,'luminosity':16};
const doc={w:1024,h:1024,depth:8,wrap:false,name:'Untitled',root:{type:'group',children:[],isRoot:true,visible:true,opacity:1,mode:-1},active:null,sel:new Set(),count:0,maps:['base'],map:'base',view:'base',mapDef:{},nrmStr:8,light:{az:135,el:40},workflow:'metal'};
const view={zoom:1,x:0,y:0};
let compOut=null,strokeT=null,beforeT=null,scratchT=null,previewT=null;
let stroke=null, preview=null, dirtyComp=true, raf=0, lid=0, groupCount=0;
const hist={undo:[],redo:[]};
/* The selection is a greyscale image the size of the document (white = selected). It stays in video memory
   next to the layers. "active" says whether it is in use; after Deselect the pixels are kept for Reselect.
   bb = bounds of its non-empty pixels [x0,y0,x1,y1] (may be generous). In quick mask mode it is painted directly. */
const sel={t:null,active:false,bb:null,quick:false,L:null,node:{name:'Quick mask',visible:true,parent:null}};
/* Working images come in sets per bit depth (8-bit documents still edit height at 16 bits).
   pool is the current set's pool of spare document-size images; every image remembers its pool. */
const aux={};let pool=null;
function auxFor(d){let a=aux[d];if(!a){const mk=()=>makeTarget(doc.w,doc.h,d);a=aux[d]={depth:d,strokeT:mk(),beforeT:mk(),scratchT:mk(),previewT:mk(),pool:{free:[],all:[],depth:d}};}return a;}
function useAux(d){const a=auxFor(d);strokeT=a.strokeT;beforeT=a.beforeT;scratchT=a.scratchT;previewT=a.previewT;pool=a.pool;}
function acquireIn(pl){let t=pl.free.pop();if(!t){t=makeTarget(doc.w,doc.h,pl.depth);t.pool=pl;pl.all.push(t);}return t;}
function acquire(){return acquireIn(pool);}
function acquireD(d){return acquireIn(auxFor(d).pool);}
function release(t){const pl=t&&t.pool;if(pl&&pl.all.includes(t)&&!pl.free.includes(t))pl.free.push(t);}
function auxTargets(){const out=[];for(const d in aux){const a=aux[d];out.push(a.strokeT,a.beforeT,a.scratchT,a.previewT,...a.pool.all);}return out;}
function allocAux(){
  auxTargets().forEach(disposeTarget);for(const d in aux)delete aux[d];if(typeof resetEmpties==='function')resetEmpties();
  auxFor(doc.depth);useAux(mapDepth(doc.map||'base'));
  compOut=acquire();clearTarget(compOut);
  disposeTarget(sel.t);sel.t=makeTarget(doc.w,doc.h);clearTarget(sel.t,[0,0,0,1]);
  sel.active=false;sel.bb=null;sel.quick=false;sel.L={target:sel.t,lockAlpha:false,quick:true};
  if(typeof selChanged==='function')selChanged();
}
function thumbCanvas(){const c=el('canvas',{width:40,height:40});return c;}
function newLayerObj(name){doc.count++;const B=makeTarget(doc.w,doc.h,mapDepth('base')),maps={base:B};let T=B;
  if(doc.map&&doc.map!=='base'&&ui.mode!=='anim'){T=makeTarget(doc.w,doc.h,mapDepth(doc.map));maps[doc.map]=T;}
  return {type:'layer',id:++lid,name:name||('Layer '+doc.count),target:T,maps,mapModes:{},visible:true,opacity:1,mode:0,clip:false,lockAlpha:false,thumb:thumbCanvas(),parent:null};}
function newGroupObj(name){return {type:'group',id:++lid,name:name||('Group '+(++groupCount)),children:[],open:true,visible:true,opacity:1,mode:-1,clip:false,lockAlpha:false,parent:null};}
function disposeLayer(n){if(n._fxc)dropFxCache(n);if(n._lk)lookFree(n);if(n.maps)for(const k in n.maps){const t=n.maps[k];if(t&&!t.empty)disposeTarget(t);}if(n.target&&!n.target.empty)disposeTarget(n.target);if(n.mask)disposeTarget(n.mask.target);if(n._fillImg){for(const k in n._fillImg)disposeTarget(n._fillImg[k]);n._fillImg=null;}}
const isLayer=n=>!!n&&n.type==='layer';
function insertNode(n,parent,i){n.parent=parent;const c=parent.children;c.splice(i==null?c.length:clamp(i,0,c.length),0,n);}
function detachNode(n){const p=n.parent;if(!p)return -1;const i=p.children.indexOf(n);if(i>=0)p.children.splice(i,1);return i;}
function allLayers(g,out){g=g||doc.root;out=out||[];for(const n of g.children){if(n.type==='group')allLayers(n,out);else out.push(n);}return out;}
function allNodes(g,out){g=g||doc.root;out=out||[];for(const n of g.children){out.push(n);if(n.type==='group')allNodes(n,out);}return out;}
function inDoc(n){if(n&&n.frame)return !!(doc.anim&&doc.anim.frames.includes(n));const roots=[doc.root,doc.paintRoot].filter(Boolean);let c=n;
  while(c&&!roots.includes(c)){const p=c.parent;if(!p||!p.children.includes(c))return false;c=p;}return roots.includes(c);}
function isAncestor(a,n){let c=n.parent;while(c){if(c===a)return true;c=c.parent;}return false;}
function activeLayer(){return isLayer(doc.active)?doc.active:null;}
function makeMask(fill){const m={target:makeTarget(doc.w,doc.h),enabled:true,thumb:thumbCanvas()};m.thumb.className='mthumb';clearTarget(m.target,[fill,fill,fill,1]);return m;}
function cloneMask(m){if(!m)return null;const c=makeMask(1);blit(m.target,c.target,0,0,doc.w,doc.h,0,0);c.enabled=m.enabled;return c;}
function editTarget(){if(sel.quick){useAux(sel.t.depth);return {node:sel.node,target:sel.t,isMask:true,L:sel.L};}const n=doc.active;if(!n)return null;fillMaskEdit(n);if(n.fx&&!n.editMask)return null;if(isLayer(n)&&!n.editMask){ensureTarget(n);useAux(n.target.depth);if(doc.map==='base')delete n.blankBase;}else if(n.mask&&n.editMask)useAux(n.mask.target.depth);
  if(n.editMask&&n.mask)return {node:n,target:n.mask.target,isMask:true,L:{target:n.mask.target,lockAlpha:false,maskOf:n,maskObj:n.mask}};
  if(n.type==='layer')return {node:n,target:n.target,isMask:false,L:n};return null;}
function clipBaseOf(list,i){const n=list[i];if(!isLayer(n)||!n.clip)return null;let j=i-1;while(j>=0&&isLayer(list[j])&&list[j].clip)j--;return j>=0&&isLayer(list[j])?list[j]:null;}
function selectOnly(n){doc.active=n||null;doc.sel=new Set(n?[n]:[]);}
function topSelected(){const sel=doc.sel;return allNodes().filter(n=>sel.has(n)&&![...sel].some(a=>a!==n&&isAncestor(a,n)));}
function snapTree(){const m=new Map();const walk=g=>{m.set(g,g.children.slice());for(const c of g.children)if(c.type==='group')walk(c);};walk(doc.root);return {m,active:doc.active,sel:[...doc.sel]};}
function restoreTree(t){for(const [g,ch] of t.m){g.children=ch.slice();for(const c of ch)c.parent=g;}doc.active=t.active;doc.sel=new Set(t.sel);}
function layersOfSnap(t){const out=new Set();for(const ch of t.m.values())for(const c of ch)out.add(c);return out;}
function structOp(label,fn){const before=snapTree();if(fn()===false)return false;const after=snapTree();
  pushUndo({label,refs:[...new Set([...layersOfSnap(before),...layersOfSnap(after)])],undo(){restoreTree(before);},redo(){restoreTree(after);}});
  changedAll();return true;}

function dropRecords(list){const cands=new Set(),mc=new Set();for(const r of list){r.drop&&r.drop();for(const s of r.snaps||[])if(s.file)platform.spillDelete(s.file);for(const n of r.refs||[])cands.add(n);for(const m of r.masks||[])mc.add(m);}
  const live=new Set(),liveM=new Set();for(const r of [...hist.undo,...hist.redo]){for(const n of r.refs||[]){live.add(n);if(n.mask)liveM.add(n.mask);}for(const m of r.masks||[])liveM.add(m);}
  for(const n of [...allNodes(doc.root),...(doc.paintRoot?allNodes(doc.paintRoot):[])])if(n.mask)liveM.add(n.mask);
  for(const n of cands)if(!live.has(n)&&!inDoc(n)){disposeLayer(n);if(n.mask)liveM.delete(n.mask);}
  for(const m of mc)if(!liveM.has(m))disposeTarget(m.target);}
/* Memory and disk (Edit › Preferences), like Photoshop's memory limit and scratch disk.
   Undo snapshots stay in RAM while they and the loaded models fit within the memory limit. Beyond it the
   desktop app moves the oldest snapshots to the disk cache (read back if you undo that far); the browser
   drops the oldest steps instead. The disk cache has its own limit: past it the oldest steps are dropped. */
const mem=Object.assign({limitMB:0,steps:0,diskGB:20,dir:''},(()=>{try{return JSON.parse(localStorage.getItem('gs.mem')||'{}');}catch(e){return {};}})());
const memSys={ramTotal:0,ramAvail:0};/* filled in by the desktop app at start-up (memory.js) */
function memSave(){try{localStorage.setItem('gs.mem',JSON.stringify(mem));}catch(e){}}
/* the limit in bytes: yours, or half of this computer's memory (at least 2 GB) */
const memAutoMB=()=>platform.isDesktop?(memSys.ramTotal?Math.max(2048,Math.round(memSys.ramTotal/1048576*.5/256)*256):4096):1024;
const memLimit=()=>(mem.limitMB||memAutoMB())*1048576;
const undoSteps=()=>mem.steps||(platform.isDesktop?500:120);
/* loaded models (3D view and Bake tab) count against the limit too */
function memModels(){const seen=new Set();let n=0;const add=m=>{if(!m||seen.has(m))return;seen.add(m);for(const k of ['pos','nrm','uv','tan','idx','col','triPart','triCol','bakePart'])if(m[k]&&m[k].byteLength)n+=m[k].byteLength;};
  try{add(v3.imported);add(bakeCfg.low);add(bakeCfg.high);add(bakeCfg.cage);}catch(e){/* not loaded yet */}return n;}
const undoRam=()=>Math.max(256*1048576,memLimit()-memModels());
const recBytes=r=>(r.snaps||[]).reduce((s,x)=>s+(x.resident!==false&&!x.file?x.bytes:0),0);
const recDisk=r=>(r.snaps||[]).reduce((s,x)=>s+(x.file?x.bytes:0),0);
let undoBusy=false;
function pushUndo(rec){if(!rec.mode)rec.mode=ui.mode;hist.undo.push(rec);const dropped=hist.redo;hist.redo=[];while(hist.undo.length>undoSteps())dropped.push(hist.undo.shift());
  if(!platform.isDesktop){let total=hist.undo.reduce((s,r)=>s+recBytes(r),0);while(total>undoRam()&&hist.undo.length>1){const r=hist.undo.shift();total-=recBytes(r);dropped.push(r);}}
  dropRecords(dropped);if(platform.isDesktop)spillOld();}
/* after a Preferences change: fewer steps, less memory */
function memApply(){const dropped=[];while(hist.undo.length>undoSteps())dropped.push(hist.undo.shift());
  if(!platform.isDesktop){let total=hist.undo.reduce((s,r)=>s+recBytes(r),0);while(total>undoRam()&&hist.undo.length>1){const r=hist.undo.shift();total-=recBytes(r);dropped.push(r);}}
  dropRecords(dropped);if(platform.isDesktop)spillOld();}
async function spillOld(){let total=hist.undo.reduce((s,r)=>s+recBytes(r),0);const budget=undoRam();
  for(const r of hist.undo){if(total<=budget)break;for(const s of r.snaps||[]){if(s.file||s.spilling||s.resident===false)continue;s.spilling=true;
    try{const bytes=new Uint8Array(s.data.buffer,s.data.byteOffset,s.data.byteLength);s.file=await platform.spillWrite(bytes);total-=s.bytes;s.data=null;}catch(e){console.warn('undo spill failed',e);}s.spilling=false;}}
  /* the disk cache is full: the oldest steps go */
  let disk=hist.undo.reduce((s,r)=>s+recDisk(r),0);const cap=mem.diskGB*1073741824,dropped=[];
  while(disk>cap&&hist.undo.length>1&&!(hist.undo[0].snaps||[]).some(s=>s.spilling)){const r=hist.undo.shift();disk-=recDisk(r);dropped.push(r);}
  if(dropped.length)dropRecords(dropped);}
async function loadSnaps(r){for(const s of r.snaps||[]){if(!s.file)continue;const buf=await platform.spillRead(s.file);s.data=s.depth===16?new Uint16Array(buf):new Uint8Array(buf);platform.spillDelete(s.file);s.file=null;}}
function clearHistory(){const all=[...hist.undo,...hist.redo];hist.undo=[];hist.redo=[];dropRecords(all);}
/* the image a record restores into: a layer's map as it was when the step was made (not whichever map is being edited now) */
function recTarget(L){const k=doc.map;if(L.quick||L.maskOf||!L.maps)return ()=>L.target;return ()=>mapT(L,k);}
function regionRecord(L,before,after,x,y,w,h,label){const T=recTarget(L);return {label,refs:L.quick?[]:[L.maskOf||L],masks:L.maskObj?[L.maskObj]:[],snaps:[before,after],undo(){const t=T();if(t)restoreRegion(before,t,x,y);},redo(){const t=T();if(t)restoreRegion(after,t,x,y);}};}
/* one undo step that also covers other maps of the same layer */
function withMapParts(r,L,parts,x,y){const u=r.undo,re=r.redo;r.snaps=[...r.snaps,...parts.flatMap(p=>[p.before,p.after])];
  r.undo=function(){u.call(this);for(const p of parts){const t=mapT(L,p.k);if(t&&!t.empty)restoreRegion(p.before,t,x,y);}};
  r.redo=function(){re.call(this);for(const p of parts){const t=mapT(L,p.k);if(t&&!t.empty)restoreRegion(p.after,t,x,y);}};return r;}
/* undoing a step from the other mode switches to it; a step on another frame shows that frame */
function undoFocus(r){if(r.mode&&r.mode!==ui.mode)setMode(r.mode,true);
  if(ui.mode==='anim'&&doc.anim){const f=(r.refs||[]).find(n=>n.frame);if(f){const i=doc.anim.frames.indexOf(f);if(i>=0&&i!==doc.anim.cur&&!r.label.includes('frame'))showFrame(i);}for(const n of r.refs||[])if(n.frame)frameDirty(n);}}
async function undo(){if(undoBusy)return;if(tedit)closeTextEditor();textCommit();const r=hist.undo[hist.undo.length-1];if(!r){toast('Nothing to undo');return;}
  undoBusy=true;try{await loadSnaps(r);}finally{undoBusy=false;}if(hist.undo[hist.undo.length-1]!==r)return;undoFocus(r);hist.undo.pop();r.undo();hist.redo.push(r);toast('Undo: '+r.label);changedAll();}
async function redo(){if(undoBusy)return;if(tedit)closeTextEditor();textCommit();const r=hist.redo[hist.redo.length-1];if(!r){toast('Nothing to redo');return;}
  undoBusy=true;try{await loadSnaps(r);}finally{undoBusy=false;}if(hist.redo[hist.redo.length-1]!==r)return;undoFocus(r);hist.redo.pop();r.redo();hist.undo.push(r);toast('Redo: '+r.label);changedAll();if(platform.isDesktop)spillOld();}
