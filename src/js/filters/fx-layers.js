/* ================= Filter layers =================
   A filter layer holds a stack of filters (and/or patterns and live converters) and changes
   everything below it in its group, on the map it was made on. Clipped to a layer, it changes
   only that layer (like a smart filter). Nothing is baked: double-click it to change any setting.
   L.fx = {map, stack:[{id|conv, v, on}]}. The layer has no pixels of its own. */
const FX_KINDS=()=>[
  ['Adjust',['colorAdj','levels','curves','hueSat','gradMap','desat','invert','threshold','posterize','quantize']],
  ['Blur and sharpen',['blur','boxBlur','radialBlur','lensBlur','surfBlur','motionBlur','sharpen','highPass']],
  ['Artistic',['oilPaint','painterly','cutout','mosaic','emboss','edges','noise']],
  ['Patterns',['clouds','cells']],
  ['Tiling',['offset','seamless']]];
const fxItemTitle=it=>it.conv?CONVERTERS[it.conv].title+' (live)':FX[it.id].title;
const fxItemHeavy=it=>!!(it.conv||(FX[it.id]&&FX[it.id].heavy));
const fxItemGen=it=>!!(it.conv||(FX[it.id]&&FX[it.id].gen));
function fxItem(id){return {id,v:fxDefaults(FX[id]),on:true};}
function convItem(cid,v){const C=CONVERTERS[cid];const d={};for(const x of C.defs)d[x.key]=x.value;for(const c of C.checks||[])d[c[0]]=c[2];for(const s of C.segs||[])d[s[0]]=s[3];return {conv:cid,v:Object.assign(d,v||{}),on:true};}
/* an empty layer object that carries filters */
function newFxLayerObj(name,stack,map){const L=newLayerObj(name);for(const k in L.maps)disposeTarget(L.maps[k]);L.maps={};
  L.target=emptyFor(mapDepth(map));L.fx={map,stack};L.mapModes={};if(map!=='base')L.mapModes[map]=0;return L;}
const isFx=n=>!!(n&&n.fx);

/* ---- compositing ---- */
const convBusy=[];
/* image made by a pattern or live converter */
function fxGenImage(it,base,k){const g=acquire();
  if(it.conv){const C=CONVERTERS[it.conv],from=C.finalNormal?'normal':C.from;
    if(convBusy.includes(from)||(C.finalNormal?!(doc.maps.includes('normal')||doc.maps.includes('height')):!doc.maps.includes(C.from))){release(g);return null;}
    convBusy.push(from);try{const src=C.finalNormal?normalComposite(false,null):compositeMap(C.from);C.make(src,g,it.v);release(src);}finally{convBusy.pop();}}
  else FX[it.id].render(base,g,it.v,{});
  return g;}
/* run the stack on an image; returns a new image (or base itself when nothing is on) */
function fxStackResult(n,base,k){let cur=base;
  for(const it of n.fx.stack){if(it.on===false)continue;
    if(fxItemGen(it)){const g=fxGenImage(it,cur,k);if(!g)continue;const o=acquire();
      run(P.comp,o,{uBase:cur.tex,uLayer:g.tex,uStrokeTex:strokeT.tex,uMask:dummy,uUseMask:false,uLMask:dummy,uUseLMask:false,uMode:{int:0},uOpacity:1,uStroke:{int:0},uStrokeColor:[0,0,0],uStrokeOpacity:0,uLockAlpha:false});
      release(g);if(cur!==base)release(cur);cur=o;}
    else{const o=acquire();FX[it.id].render(cur,o,it.v,{});if(cur!==base)release(cur);cur=o;}}
  return cur;}
/* the filter layer applied over base with its opacity, blend mode and mask */
function fxApplyLayer(n,base,k,mt){const on=n.fx.stack.filter(it=>it.on!==false);if(!on.length)return base;
  const mode=mapModeOf(n,k),heavy=on.some(fxItemHeavy),c=n._fxc&&n._fxc[k];
  /* slow filters are not redone every frame while you paint: they catch up when the stroke ends */
  if(stroke&&heavy&&c&&c.depth===base.depth){const o=acquire();blit(c,o,0,0,doc.w,doc.h,0,0);return o;}
  let out;
  if(on.length===1&&fxItemGen(on[0])){const g=fxGenImage(on[0],base,k);if(!g)return base;out=acquire();
    run(P.comp,out,{uBase:base.tex,uLayer:g.tex,uStrokeTex:strokeT.tex,uMask:dummy,uUseMask:false,uLMask:mt||dummy,uUseLMask:!!mt,uMode:{int:mode},uOpacity:n.opacity,uStroke:{int:0},uStrokeColor:[0,0,0],uStrokeOpacity:0,uLockAlpha:false});release(g);}
  else{const cur=fxStackResult(n,base,k);if(cur===base)return base;out=acquire();
    if(mode===0)run(P.mix,out,{uA:base.tex,uB:cur.tex,uT:n.opacity,uM:mt||dummy,uUseM:!!mt});
    else run(P.comp,out,{uBase:base.tex,uLayer:cur.tex,uStrokeTex:strokeT.tex,uMask:dummy,uUseMask:false,uLMask:mt||dummy,uUseLMask:!!mt,uMode:{int:mode},uOpacity:n.opacity,uStroke:{int:0},uStrokeColor:[0,0,0],uStrokeOpacity:0,uLockAlpha:false});
    release(cur);}
  if(heavy){n._fxc=n._fxc||{};let t=n._fxc[k];if(!t||t.w!==doc.w||t.h!==doc.h||t.depth!==out.depth){if(t)disposeTarget(t);t=n._fxc[k]=makeTarget(doc.w,doc.h,out.depth);}blit(out,t,0,0,doc.w,doc.h,0,0);}
  return out;}
function dropFxCache(n){if(n&&n._fxc){for(const k in n._fxc)disposeTarget(n._fxc[k]);n._fxc=null;}}
/* filter layers clipped to layer i (applied to that layer's own image) */
function clippedFx(list,i,k){const out=[];for(let j=i+1;j<list.length&&list[j].clip;j++){const f=list[j];if(isFx(f)&&f.visible&&f.fx.map===k)out.push(f);}return out;}

/* ---- creating ---- */
function fxDefaultName(stack){return stack.length?fxItemTitle(stack[0]).replace(' (live)',''):'Filters';}
/* one-off dialog → "Keep editable": a filter layer clipped to the layer that was being filtered */
function addFxLayer(id,v,target,clip){const L=newFxLayerObj(FX[id].title,[{id,v,on:true}],doc.map);
  const p=target?target.parent:doc.root,i=target?p.children.indexOf(target)+1:p.children.length;
  if(clip&&isLayer(target)&&!isFx(target))L.clip=true;
  structOp('New filter layer',()=>{insertNode(L,p,i);selectOnly(L);});requestRender(true);
  toast('Added the filter layer “'+L.name+'”. Double-click its thumbnail to change the settings.');return L;}
/* Layers panel "+ Filter": a new filter layer above the active layer, opened in the editor */
function cmdNewFxLayer(){if(ui.mode==='anim'){toast('Filter layers are for paint mode.');return;}if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const A=doc.active,p=A?A.parent:doc.root,i=A?p.children.indexOf(A)+1:p.children.length;
  const L=newFxLayerObj('Filters',[],doc.map);insertNode(L,p,i);selectOnly(L);changedAll();
  fxEditor(L,{isNew:true,parent:p,index:i});}

/* ---- the editor: every filter in the stack, with its controls, live ---- */
function fxEditor(L,opts){opts=opts||{};if(!isFx(L))return;if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const before=JSON.stringify(fxCleanStack(L.fx.stack));const body=el('div',{class:'dlg-grid fxed'});let open=L.fx.stack.length?L.fx.stack.length-1:-1;
  let pend=0;const upd=()=>{if(pend)return;pend=requestAnimationFrame(()=>{pend=0;dropFxCache(L);requestRender(true);});};
  const ctx={};
  const draw=()=>{body.replaceChildren();const S=L.fx.stack;
    if(!S.length)body.append(el('p',{class:'note',text:'Add a filter below. Filters apply from top to bottom, to everything under this layer'+(L.clip?' (only the layer it is clipped to)':'')+'.'}));
    S.forEach((it,i)=>{const isOpen=i===open,ttl=fxItemTitle(it);
      const eye=el('button',{class:'eye','aria-label':(it.on!==false?'Turn off ':'Turn on ')+ttl,title:it.on!==false?'Turn off':'Turn on'});eye.innerHTML=it.on!==false?eyeOn:eyeOff;
      eye.onclick=e=>{e.stopPropagation();it.on=it.on===false;draw();upd();};
      const btn=(t,lab,fn,dis)=>el('button',{class:'btn sm ghost',text:t,'aria-label':lab,title:lab,disabled:!!dis,onclick:e=>{e.stopPropagation();fn();draw();upd();}});
      const head=el('div',{class:'fxhead'+(isOpen?' open':''),role:'button',tabindex:'0'},eye,el('span',{class:'lname',text:ttl}),
        btn('↑','Move up',()=>{S.splice(i-1,0,S.splice(i,1)[0]);open=i-1;},i===0),btn('↓','Move down',()=>{S.splice(i+1,0,S.splice(i,1)[0]);open=i+1;},i===S.length-1),
        btn('×','Remove',()=>{S.splice(i,1);open=Math.min(open,S.length-1);}));
      head.onclick=()=>{open=isOpen?-1:i;draw();};head.onkeydown=e=>{if(e.key==='Enter'){open=isOpen?-1:i;draw();}};
      const item=el('div',{class:'fxitem'},head);
      if(isOpen){const box=el('div',{class:'dlg-grid fxbody'});
        if(it.conv)box.append(...convControls(CONVERTERS[it.conv],it.v,upd));
        else{const c=fxControls(FX[it.id],it.v,upd,ctx);box.append(...c.body);if(c.reset)box.append(el('div',{class:'frow'},c.reset));}
        item.append(box);}
      body.append(item);});
    const add=el('select',{id:'fxAdd','aria-label':'Add a filter'},el('option',{value:'',text:'+ Add a filter…'}));
    for(const [g,ids] of FX_KINDS()){const og=el('optgroup',{label:g});for(const id of ids)og.append(el('option',{value:id,text:FX[id].title}));add.append(og);}
    const live=Object.keys(CONVERTERS).filter(c=>c!=='heightFromNormal'&&CONVERTERS[c].make&&(CONVERTERS[c].finalNormal?doc.maps.includes('normal')||doc.maps.includes('height'):doc.maps.includes(CONVERTERS[c].from))&&CONVERTERS[c].from!==L.fx.map);
    if(live.length){const og=el('optgroup',{label:'Live from another map'});for(const c of live)og.append(el('option',{value:'conv:'+c,text:CONVERTERS[c].title}));add.append(og);}
    add.onchange=()=>{const v=add.value;if(!v)return;S.push(v.startsWith('conv:')?convItem(v.slice(5)):fxItem(v));open=S.length-1;
      if(L.autoName!==false&&(L.name==='Filters'||S.length===1))L.name=fxDefaultName(S);draw();upd();renderLayers();};
    body.append(el('div',{class:'frow'},add),el('p',{class:'note',text:'Editing “'+L.name+'” on the '+MAP_DEFS[L.fx.map].label.toLowerCase()+' map. Its opacity, blend mode and mask are in the Layers panel.'}));};
  draw();preview={off:true,fxEdit:true};
  const close=()=>{cancelAnimationFrame(pend);pend=0;preview=null;};
  openDialog({title:opts.isNew?'New filter layer':'Filter layer',body,float:true,okLabel:'Done',
    onOk(){close();const after=JSON.stringify(fxCleanStack(L.fx.stack));
      if(opts.isNew){if(!L.fx.stack.length){detachNode(L);disposeLayer(L);changedAll();return;}detachNode(L);structOp('New filter layer',()=>{insertNode(L,opts.parent,opts.index);selectOnly(L);});}
      else if(after!==before){const b=JSON.parse(before),a=JSON.parse(after);pushUndo({label:'Edit filter layer',refs:[L],undo(){L.fx.stack=JSON.parse(JSON.stringify(b));dropFxCache(L);},redo(){L.fx.stack=JSON.parse(JSON.stringify(a));dropFxCache(L);}});}
      dropFxCache(L);changedAll();},
    onCancel(){close();if(opts.isNew){detachNode(L);disposeLayer(L);}else{L.fx.stack=JSON.parse(before);dropFxCache(L);}changedAll();}});}
const fxCleanStack=S=>S.map(it=>Object.assign({},it,{v:fxClean(it.v)}));
/* converter settings inside the filter layer editor */
function convControls(C,v,upd){const out=[];if(C.note)out.push(el('p',{class:'note',text:C.note}));
  for(const [key,label,opts,cur] of C.segs||[])out.push(el('div',{class:'sub',text:label}),seg(opts,v[key],x=>{v[key]=x;upd();},label));
  for(const d of C.defs)out.push(makeSlider(Object.assign({},d,{value:v[d.key],id:'cv_'+d.key,onInput:x=>{v[d.key]=x;upd();}})).el);
  for(const [key,label] of C.checks||[])out.push(chk('cv_'+key,label,!!v[key],x=>{v[key]=x;upd();}));
  out.push(el('p',{class:'note',text:'Updates by itself when the '+(C.finalNormal?'normal or height':MAP_DEFS[C.from].label.toLowerCase())+' map changes.'}));return out;}
function editActiveFx(){const A=doc.active;if(isFx(A))fxEditor(A);else toast('Select a filter layer first.');}
$('#lFx').addEventListener('click',cmdNewFxLayer);
