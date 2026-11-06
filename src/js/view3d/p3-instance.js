/* (0.95, Kenn) Instance to sets: the same material in several texture sets, linked like Substance Painter's instances.
   Each copy is an ordinary material layer carrying the same L.inst id; a change to one (a Material undo step) is copied to the
   others in the other sets, which are re-rendered in place without switching to them. Unlink makes a copy its own again.
   A triplanar or planar projection is placed on the whole model (proj-xf.js pxfModel), so the pattern continues across sets and tiles. */
let instBusy=false;
/* run fn with set i as the live document, without rebuilding the panels */
function p3InSet(i,fn){if(i===p3.cur)return fn();const S=p3.sets[i];if(!S||S.missing)return;
  if(!S.state){const back=p3.cur;p3SwitchSet(i,true);p3SwitchSet(back,true);}if(!S.state)return;
  const mine=docState(),tex=v3.tex,cur=p3.cur;let out;
  try{setDocState(S.state);S.state=null;p3.cur=i;v3.tex=S.tex||{};out=fn();p3RefreshTex();}
  finally{S.tex=v3.tex;S.state=docState();S.channelCache=null;setDocState(mine);v3.tex=tex;p3.cur=cur;}return out;}
/* the live document's look on the model, rebuilt in full */
function p3RefreshTex(){withWeldMask(null,()=>{for(const k of v3Needed()){const t=k==='nfinal'?normalComposite(false,null):compositeMap(k);v3MapTex(k,t);release(t);}
  if(doc.maps.includes('height')){const t=compositeMap('height');v3MapTex('height',t);release(t);}});}
const instNew=()=>'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
/* copy material L (in the live set) into the live document of another set: settings, pictures and content effects */
function instCopyInto(src,imgs){const L=newLayerObj(src.name,true);L.fill=fillClone(src.fill);L.inst=src.inst;L.opacity=src.opacity;L.mode=src.mode;
  L.mapModes=Object.assign({},src.mapModes);L.mapOpacities=Object.assign({},src.mapOpacities);
  if(imgs){L._fillImg={};for(const k in imgs)L._fillImg[k]=fillImgCopy(imgs[k]);}
  if(src.cfx)L.cfx=JSON.parse(JSON.stringify(src.cfx));fillRender(L);return L;}
function instTargets(L){const out=[];p3.sets.forEach((S,i)=>{if(i===p3.cur||S.missing)return;const D=S.state&&S.state.doc;if(!D)return;const has=(function find(n){if(n.inst===L.inst&&n!==L&&n.fill)return true;return (n.children||[]).some(find);})(D.root);if(has)out.push(i);});return out;}
function instLayersIn(id){return paintLayers().filter(n=>n.inst===id&&n.fill);}
/* Right-click › Instance to sets… */
function dlgInstance(L){if(!L||!L.fill){toast('Pick a material layer first.');return;}if(ui.mode!=='p3d'){toast('Instances are for 3D Paint texture sets.');return;}
  const others=p3.sets.map((S,i)=>({S,i})).filter(x=>x.i!==p3.cur&&!x.S.missing);if(!others.length){toast('This model has only one texture set.');return;}
  const have=L.inst?new Set(instTargets(L)):new Set(),pick={};const body=el('div',{class:'dlg-grid'},el('p',{class:'note',text:'“'+L.name+'” is added to the sets you tick, linked: change it in any of them and the others follow. A triplanar or planar projection is placed on the whole model, so the pattern lines up across sets.'}),
    ...others.map(({S,i})=>{const c=el('input',{type:'checkbox',id:'inst_'+i});c.checked=have.has(i);c.disabled=have.has(i);pick[i]=c;return el('label',{class:'chk'},c,el('span',{text:S.name+(have.has(i)?' (linked)':'')}));}));
  openDialog({title:'Instance to sets',body,okLabel:'Link',onOk(){const which=Object.keys(pick).map(Number).filter(i=>pick[i].checked&&!have.has(i));if(!which.length)return;instAdd(L,which);}});}
function instAdd(L,which){matEdCommit();if(!L.inst)L.inst=instNew();const imgs=L._fillImg||null;let n=0;
  for(const i of which)p3InSet(i,()=>{const c=instCopyInto(L,imgs);insertNode(c,doc.root,doc.root.children.length);n++;});
  v3.dirty=true;renderLayers();requestRender(true);toast('Linked “'+L.name+'” to '+n+' more texture set'+(n>1?'s':'')+'.');return n;}
/* a change to a linked material reaches its copies */
function instSync(L){if(instBusy||!L||!L.inst||!L.fill||ui.mode!=='p3d')return 0;instBusy=true;let n=0;
  try{const imgs=L._fillImg||{},f=L.fill;
    for(const i of instTargets(L))p3InSet(i,()=>{for(const C of instLayersIn(L.inst)){C.fill=fillClone(f);C.name=L.name;
      const keep=C._fillImg||{};for(const k of new Set([...Object.keys(keep),...Object.keys(imgs)])){if(keep[k]&&keep[k]._instSrc===imgs[k])continue;if(keep[k])disposeTarget(keep[k]);delete keep[k];
        const s=imgs[k];if(s){const t=fillImgCopy(s);t._instSrc=s;keep[k]=t;}}C._fillImg=keep;
      C.cfx=L.cfx?JSON.parse(JSON.stringify(L.cfx)):C.cfx;fillRender(C);C.lookVer=(C.lookVer||0)+1;n++;}});}
  finally{instBusy=false;}if(n){v3.dirty=true;requestRender(true);}return n;}
function instUnlink(L){if(!L||!L.inst)return;delete L.inst;renderLayers();toast('“'+L.name+'” is no longer linked; the other copies stay.');}
