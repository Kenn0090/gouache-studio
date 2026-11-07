/* ================= The Gouache command set (0.96, Kenn: scripting, add-ons and outside control) =================
   One list of commands that scripts (the Scripts window), add-ons (later) and other programs (later) all use, so each new
   way in reaches the same things. Everything is plain: names and numbers in, plain objects out (no app internals), and
   every command checks its input and explains in plain words what was wrong. Colours are [r,g,b] from 0 to 1; positions
   are canvas pixels (x right, y down). API_VERSION goes up when commands are added; old scripts keep working. */
const API_VERSION=1;
class ApiError extends Error{constructor(m){super(m);this.name='Gouache';}}
const apiFail=m=>{throw new ApiError(m);};
const apiNum=(v,name,lo,hi)=>{if(typeof v!=='number'||!isFinite(v))apiFail(name+' must be a number.');if(lo!=null&&v<lo||hi!=null&&v>hi)apiFail(name+' must be between '+lo+' and '+hi+'.');return v;};
const apiCol=(c,name)=>{if(typeof c==='string'&&/^#?[0-9a-f]{6}$/i.test(c)){const h=c.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);}
  if(!Array.isArray(c)||c.length<3||c.slice(0,3).some(v=>typeof v!=='number'))apiFail((name||'Colour')+' must be [r, g, b] (0 to 1) or "#rrggbb".');return c.slice(0,3).map(v=>Math.min(1,Math.max(0,v)));};
let apiBusy=()=>{if(stroke)apiFail('A brush stroke is still going on.');if(preview)apiFail('A filter window is open: apply or cancel it first.');if(typeof xf!=='undefined'&&xf)apiFail('A transform is going on: apply or cancel it first.');};
const apiLayerKind=n=>n.type==='group'?'group':n.fx?'filter':n.fill?'material':n.text?'text':n.shape?'shape':'paint';
let apiIds=new WeakMap(),apiSeq=0;
const apiId=n=>{let i=apiIds.get(n);if(!i){i='L'+(++apiSeq);apiIds.set(n,i);}return i;};
function apiLayerInfo(n){if(!n)return null;return {id:apiId(n),name:n.name,kind:apiLayerKind(n),visible:n.visible!==false,opacity:n.opacity==null?1:n.opacity,blend:(()=>{const m=mapModeOf(n,doc.map);return m<0?'pass through':(MODES[m]||'Normal').toLowerCase();})(),mask:!!n.mask,parent:n.parent&&n.parent!==doc.root?n.parent.name:null,active:doc.active===n};}
function apiFind(ref){if(ref==null)return doc.active||apiFail('No layer is selected.');if(typeof ref==='object'&&ref.id)ref=ref.id;
  const all=allNodes(doc.root);const n=all.find(x=>apiId(x)===ref)||all.find(x=>x.name===ref);return n||apiFail('There is no layer called “'+ref+'”.');}
const apiWait=ms=>new Promise(r=>setTimeout(r,ms));
/* let the app catch up (redraw, panels) between commands */
const apiSettle=async()=>{requestRender(true);await new Promise(r=>requestAnimationFrame(()=>r()));};

const gouache={
  version:API_VERSION,
  /* ---- talking to you ---- */
  log:(...a)=>apiLog('log',a),
  toast:t=>{toast(String(t));},
  wait:ms=>apiWait(apiNum(ms,'wait time',0,600000)),
  ask:(question,def)=>new Promise(res=>{const i=el('input',{type:'text',id:'apiAsk',value:def==null?'':String(def)});
    openDialog({title:'Script question',body:el('div',{class:'dlg-grid'},el('p',{text:String(question)}),i),okLabel:'OK',onOk(){res(i.value);},onCancel(){res(null);}});setTimeout(()=>i.focus(),50);}),
  /* ---- tabs ---- */
  mode:()=>ui.mode,
  setMode:async m=>{const ok=['paint','p3d','anim','bake','convert','photo','brush'];if(!ok.includes(m))apiFail('Tab must be one of: '+ok.join(', ')+'.');apiBusy();if(!setMode(m,true))apiFail('Could not switch to '+m+'.');await apiWait(200);await apiSettle();return ui.mode;},
  /* ---- the document ---- */
  doc:{
    info:()=>({name:doc.name,width:doc.w,height:doc.h,bits:doc.depth,maps:doc.maps.slice(),map:doc.map,workflow:doc.workflow||'metal',saved:!(typeof unsavedWork==='function'&&unsavedWork()),path:typeof curFilePath==='function'?curFilePath()||null:null}),
    new:async o=>{o=o||{};apiBusy();const w=apiNum(o.width??1024,'width',1,16384),h=apiNum(o.height??w,'height',1,16384),bits=o.bits===16?16:8;
      const bg=o.background===null?null:apiCol(o.background||[1,1,1],'background');if(ui.mode!=='paint')await gouache.setMode('paint');
      if(typeof dtNewTab==='function')dtNewTab();newDoc(w,h,bits,bg,o.name||'Untitled',!!o.tile);await apiSettle();return gouache.doc.info();},
    open:async path=>{if(!platform.isDesktop)apiFail('Opening files by path needs the desktop app.');if(typeof path!=='string')apiFail('Give the full path of the file.');apiBusy();await openPath(path,'open');await apiSettle();return gouache.doc.info();},
    save:async()=>{apiBusy();await saveDoc(false);return gouache.doc.info();},
    setMap:k=>{if(!doc.maps.includes(k))apiFail('This document has no '+k+' map. Its maps: '+doc.maps.join(', ')+'.');setEditMap(k);requestRender(true);return doc.map;}},
  /* ---- layers ---- */
  layers:{
    list:()=>allNodes(doc.root).map(apiLayerInfo),
    active:()=>apiLayerInfo(doc.active),
    select:ref=>{const n=apiFind(ref);selectOnly(n);renderLayers();return apiLayerInfo(n);},
    add:name=>{apiBusy();const L=cmdAddLayer(name?String(name):undefined);renderLayers();return apiLayerInfo(L||doc.active);},
    addGroup:name=>{apiBusy();const g=newGroupObj?newGroupObj(name||'Group'):null;if(!g){cmdGroup();return apiLayerInfo(doc.active);}structOp('New group',()=>{const [p,i]=insertPoint();insertNode(g,p,i);selectOnly(g);});renderLayers();return apiLayerInfo(g);},
    /* a material: {name, base:[r,g,b], rough, metal, height, ...} (any channel: colour for colour channels, 0..1 for grey ones) */
    addMaterial:o=>{apiBusy();o=o||{};const maps={};for(const k in o){if(k==='name'||!MAP_DEFS[k])continue;maps[k]=MAP_DEFS[k].grey?{v:apiNum(o[k],k,0,1)}:{c:apiCol(o[k],k)};}
      cmdNewFillLayer(Object.keys(maps).length?{name:o.name||'Material',maps}:undefined);if(o.name&&doc.active)doc.active.name=String(o.name);renderLayers();return apiLayerInfo(doc.active);},
    addLibraryMaterial:async name=>{apiBusy();const all=(typeof gmRecs!=='undefined'?gmRecs:[]).concat(typeof dlLib!=='undefined'?dlLib.list:[]),r=all.find(x=>x.name===name)||all.find(x=>x.name.toLowerCase()===String(name).toLowerCase());
      if(!r)apiFail('No Library material called “'+name+'”.');await gmApply(r);await apiSettle();return apiLayerInfo(doc.active);},
    addSmartMaterial:async name=>{apiBusy();const r=smBuiltins().find(x=>x.name===name);if(!r)apiFail('No smart material called “'+name+'”.');await smApply(r);await apiSettle();return apiLayerInfo(doc.active);},
    addSmartMask:async name=>{apiBusy();const r=smaskBuiltins().find(x=>x.name===name);if(!r)apiFail('No smart mask called “'+name+'”.');await smMaskApply(r);await apiSettle();return apiLayerInfo(doc.active);},
    add3DGradient:()=>{apiBusy();cmdNewG3dLayer();return apiLayerInfo(doc.active);},
    set:(ref,o)=>{apiBusy();const n=apiFind(ref);o=o||{};
      if(o.name!=null)n.name=String(o.name);
      if(o.opacity!=null){const v=apiNum(o.opacity,'opacity',0,1);if((ui.mode==='p3d'||doc.p3)&&typeof setMapOpacityOf==='function')setMapOpacityOf(n,doc.map,v);else n.opacity=v;}
      if(o.visible!=null)n.visible=!!o.visible;
      if(o.blend!=null){const i=MODES.findIndex(m=>m.toLowerCase()===String(o.blend).toLowerCase());if(i<0)apiFail('Blend must be one of: '+MODES.join(', ')+'.');setMapModeOf(n,doc.map,i);}
      changed(n);return apiLayerInfo(n);},
    duplicate:ref=>{apiBusy();if(ref!=null)gouache.layers.select(ref);cmdDuplicate();renderLayers();return apiLayerInfo(doc.active);},
    delete:ref=>{apiBusy();if(ref!=null)gouache.layers.select(ref);cmdDelete();renderLayers();return true;},
    mergeDown:ref=>{apiBusy();if(ref!=null)gouache.layers.select(ref);cmdMerge();renderLayers();return apiLayerInfo(doc.active);},
    group:refs=>{apiBusy();if(refs){const ns=refs.map(apiFind);doc.sel=new Set(ns);doc.active=ns[ns.length-1];}cmdGroup();renderLayers();return apiLayerInfo(doc.active);},
    addMask:(ref,colour)=>{apiBusy();if(ref!=null)gouache.layers.select(ref);cmdAddMask(colour==='black'?0:1);renderLayers();return apiLayerInfo(doc.active);},
    /* a mask row: kind 'gen' (a generator, give its name as g, e.g. {g:'edge'}), 'noise', 'fill', 'dir', 'grad', 'g3d', 'filter' ({fx:'blur'})… */
    addMaskRow:(kind,params,ref)=>{apiBusy();const L=apiFind(ref);if(!MS_KINDS[kind])apiFail('Mask rows can be: '+Object.keys(MS_KINDS).join(', ')+'.');params=params||{};
      const o=kind==='gen'?{p:Object.assign(msGenDefaults(params.g||'edge'),params)}:kind==='filter'?{fx:params.fx||'blur',v:params.v}:{p:Object.assign(MS_KINDS[kind].p?MS_KINDS[kind].p():{},params)};
      if(kind==='gen'&&params.g&&!MS_GENS.some(g=>g[0]===params.g))apiFail('Generators: '+MS_GENS.map(g=>g[0]).join(', ')+'.');const r=msAdd(L,kind,o);renderLayers();return r?{id:r.id,kind:r.kind}:null;},
    fill:(colour,ref)=>{apiBusy();if(ref!=null)gouache.layers.select(ref);const c=apiCol(colour);const old=ui.fg.slice();setFG(c);try{actions.fill();}finally{setFG(old);}return apiLayerInfo(doc.active);}},
  /* ---- selections ---- */
  select:{
    all:()=>{selectAll();return true;},
    none:()=>{deselect();return true;},
    invert:()=>{invertSel();return true;},
    rect:(x,y,w,h)=>{[x,y,w,h].forEach((v,i)=>apiNum(v,['x','y','width','height'][i]));const r=[Math.max(0,x),Math.max(0,y),Math.min(doc.w,x+w),Math.min(doc.h,y+h)];if(r[2]<=r[0]||r[3]<=r[1])apiFail('The rectangle is outside the canvas.');
      selRecord('Select',fullRect(),()=>{clearTarget(sel.t,[0,0,0,1]);scissorDo([r[0],r[1],r[2]-r[0],r[3]-r[1]],()=>clearTarget(sel.t,[1,1,1,1]));sel.active=true;sel.bb=r;});selChanged();return true;},
    active:()=>!!sel.active},
  /* ---- painting ---- */
  paint:{
    colour:c=>{if(c==null)return ui.fg.slice();setFG(apiCol(c));return ui.fg.slice();},
    tool:t=>{if(t==null)return ui.tool;setTool(String(t));if(ui.tool!==t)apiFail('No tool called “'+t+'” here.');return ui.tool;},
    brush:name=>{const all=library.flatMap(s=>s.presets||[]),p=all.find(x=>x.name===name)||all.find(x=>x.name&&x.name.toLowerCase()===String(name).toLowerCase());
      if(!p)apiFail('No brush called “'+name+'”.');applyPreset(p);return p.name;},
    size:px=>{if(px==null)return brush.size;brush.size=apiNum(px,'size',1,100000);if(typeof optSync==='function')optSync();if(typeof buildBrushPanel==='function')buildBrushPanel();return brush.size;},
    opacity:v=>{if(v==null)return brush.opacity;brush.opacity=apiNum(v,'opacity',0,1);if(typeof optSync==='function')optSync();if(typeof buildBrushPanel==='function')buildBrushPanel();return brush.opacity;},
    /* one stroke through the points [[x, y, pressure?], …] on the flat canvas, with the current brush, tool and colour */
    stroke:async pts=>{apiBusy();if(!Array.isArray(pts)||pts.length<1||pts.some(q=>!Array.isArray(q)||q.length<2))apiFail('stroke needs a list of points like [[x, y], [x, y, pressure]].');
      const et=editTarget();if(!et)apiFail('Select a layer to paint on.');const o=paintOpts(et);if(!o)apiFail('This layer cannot be painted on.');
      const P=q=>[apiNum(q[0],'x'),apiNum(q[1],'y'),q[2]==null?1:apiNum(q[2],'pressure',0,1)];const a=P(pts[0]);beginStroke(et.L,a[0],a[1],a[2],o);
      for(let i=1;i<pts.length;i++){const q=P(pts[i]);addPoint(q[0],q[1],q[2]);}endStroke(true);await apiSettle();return true;}},
  /* ---- filters ---- */
  filters:{
    list:()=>Object.values(FX).filter(o=>!o.gen).map(o=>({id:o.id,title:o.title,settings:fxDefaults(o)})),
    /* apply a filter to the selected layer (or its mask), with your settings on top of its defaults */
    apply:async(id,settings)=>{apiBusy();const o=FX[id];if(!o)apiFail('No filter called “'+id+'”. See gouache.filters.list().');const et=needTarget();if(!et)apiFail('Select a layer to filter.');
      const v=Object.assign(fxDefaults(o),settings||{});preview={L:et.node,isMask:et.isMask,et};try{o.render(et.L.target,previewT,v,{src:et.L.target});chanLimit(et);selLimit(et);applyPreview(o.label||o.title);}catch(e){preview=null;throw e;}
      await apiSettle();return true;},
    addFilterLayer:(id,settings,clip)=>{apiBusy();const o=FX[id];if(!o)apiFail('No filter called “'+id+'”.');addFxLayer(id,fxClean(Object.assign(fxDefaults(o),settings||{})),doc.active,clip!==false);renderLayers();return apiLayerInfo(doc.active);}},
  /* ---- 3D Paint ---- */
  p3d:{
    sets:()=>ui.mode==='p3d'?p3.sets.map((S,i)=>({name:S.name,active:i===p3.cur,hidden:!!S.hidden})):apiFail('Switch to 3D Paint first: await gouache.setMode("p3d").'),
    selectSet:async name=>{if(ui.mode!=='p3d')apiFail('Switch to 3D Paint first.');const i=p3.sets.findIndex(S=>S.name===name);if(i<0)apiFail('No texture set called “'+name+'”.');p3SwitchSet(i);await apiSettle();return name;},
    inEverySet:async fn=>{if(ui.mode!=='p3d')apiFail('Switch to 3D Paint first.');if(typeof fn!=='function')apiFail('Give a function to run in each set.');const back=p3.cur,out=[];
      for(let i=0;i<p3.sets.length;i++){if(p3.sets[i].missing)continue;p3SwitchSet(i,true);await apiSettle();out.push(await fn(p3.sets[i].name));}p3SwitchSet(back,true);await apiSettle();return out;}},
  /* ---- any menu command, by its id (gouache.menus() lists them) ---- */
  menu:async id=>{if(typeof actions[id]!=='function')apiFail('No menu command “'+id+'”. See gouache.menus().');apiBusy();const r=actions[id]();if(r&&r.then)await r;await apiSettle();return true;},
  menus:()=>{const out=[];const walk=(l,path)=>{for(const it of l||[]){if(it==='-')continue;if(it[1]==='sub')walk(it[2],path+it[0]+' › ');else out.push({id:it[1],title:path+it[0]});}};for(const k in MENUS)walk(MENUS[k],k+' › ');return out;},
  undo:()=>{if(typeof actions.undo==='function')actions.undo();return true;},
  redo:()=>{if(typeof actions.redo==='function')actions.redo();return true;}};
/* the commands, listed for the Scripts window's help and for add-ons/outside control later */
function apiCommands(){const out=[];const walk=(o,p)=>{for(const k in o){const v=o[k];if(typeof v==='function')out.push(p+k);else if(v&&typeof v==='object'&&!Array.isArray(v))walk(v,p+k+'.');}};walk(gouache,'gouache.');return out;}
