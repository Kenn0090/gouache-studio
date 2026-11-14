/* Shelf tiles and the layer's filter picker share the same filter catalog. */
function shelfFilterGroups(){
  const groups=[
    ['Stylize',['arcane','stylizeP','stylizeG','handPaint']],
    ...FX_KINDS().map(([name,ids])=>[name,ids.slice()])
  ];
  const known=new Set(groups.flatMap(([,ids])=>ids));
  const extra=Object.keys(FX).filter(id=>!known.has(id)&&!FX[id].noLayer);
  if(extra.length)groups.push(['More filters',extra]);
  return groups.map(([name,ids])=>[name,ids.filter(id=>id==='arcane'||FX[id]&&!FX[id].noLayer).map(id=>({
    id,name:id==='arcane'?'Arcane-inspired paint':FX[id].title
  }))]).filter(([,records])=>records.length);
}
const shelfStackFilter=id=>id==='arcane'||FX[id].onlyLayer||FX[id].gen;
function shelfFilterItem(id){
  const item=fxItem(id==='arcane'?'stylizeP':id);
  if(id==='arcane')Object.assign(item.v,JSON.parse(JSON.stringify(PA_PRESETS['Arcane-inspired'])),{preset:'Arcane-inspired'});
  return item;
}
function shelfFilterAdd(rec,at){
  const [parent,index]=at?[at.parent,at.index]:insertPoint();
  const map=rec.id==='arcane'||FX[rec.id].onlyLayer?'all':doc.map;
  const L=newFxLayerObj(rec.name,[shelfFilterItem(rec.id)],map);
  structOp('Add '+rec.name,()=>{insertNode(L,parent,index);selectOnly(L);});
  return L;
}
function shelfFilterApply(rec,T){
  if(stroke||preview||selLive||!modal.hidden){toast('Finish the current edit first.');return;}
  if(T.mask){
    if(lockStop({node:T.mask,isMask:true}))return;
    const settings=rec.own?{own:rec.own,p:{r:rec.own==='grow'?3:rec.own==='warp'?4:6,scale:6,seed:1}}:{fx:rec.id};
    return msAdd(T.mask,'filter',settings,'Add '+rec.name+' to mask',1);
  }
  if(T.effect&&!shelfStackFilter(rec.id)){
    const L=T.effect;
    if(lockStop({node:L}))return;
    const before=L.fx.stack.slice(),after=[...before,shelfFilterItem(rec.id)];
    const set=stack=>{L.fx.stack=stack;dropFxCache(L);changed(L);};
    set(after);selectOnly(L);updateRowClasses();
    pushUndo({label:'Add '+rec.name,refs:[L],undo(){set(before);},redo(){set(after);}});
    return L;
  }
  if(T.layer&&!shelfStackFilter(rec.id)){
    if(lockStop({node:T.layer}))return;
    return cfxAdd(T.layer,rec.id,doc.map==='base'?'base':[doc.map]);
  }
  return shelfFilterAdd(rec,T.at);
}
function dlgLayerEffects(L,mode='layer'){
  if(stroke||preview||selLive||!modal.hidden){toast('Finish the current edit first.');return;}
  const filterGroups=shelfFilterGroups();
  const masks=[
    ['Mask shaping',Object.entries(MS_OWN_FILTERS).map(([own,name])=>({own,name}))],
    ...filterGroups.map(([name,rows])=>[name,rows.filter(r=>!shelfStackFilter(r.id))])
  ];
  const results=el('div',{class:'effect-results'});
  const search=el('input',{type:'search',placeholder:'Search filters and effects…','aria-label':'Search filters and effects'});
  let target=mode;
  const next=fn=>{closeDialog();if(!inDoc(L))return;selectOnly(L);updateRowClasses();fn();};
  const draw=()=>{
    const stack=target==='stack',mask=target==='mask',q=search.value.trim().toLowerCase();
    const groupForAction=(name,run)=>({name,run:()=>next(run)});
    let groups=mask?masks:filterGroups;
    if(stack)groups=[['Layer effects',[
      groupForAction('Empty filter layer',cmdNewFxLayer),
      groupForAction('Retro effect clipped to this layer',()=>cmdNewRetroLayer(true))
    ]],...groups];
    else if(!mask)groups=[['Layer effects',[
      groupForAction('Layer styles…',()=>dlgLayerStyle()),
      ...(ui.mode==='paint'?[groupForAction('Array',()=>setTool('array'))]:[])
    ]],...groups];
    const rows=[];
    for(const [name,recs] of groups){
      const hits=recs.filter(r=>!q||(r.name+' '+name).toLowerCase().includes(q));
      if(!hits.length)continue;
      rows.push(el('div',{class:'sub',text:name}),...hits.map(r=>el('button',{type:'button',class:'effect-choice',
        'aria-label':r.name,onclick:r.run||(()=>next(()=>shelfFilterApply(r,stack?{}:mask?{mask:L}:{layer:L})))},
        el('span',{text:r.name}),!stack&&!mask&&r.id&&shelfStackFilter(r.id)?el('span',{class:'note',text:'Filter layer'}):null)));
    }
    results.replaceChildren(...(rows.length?rows:[el('p',{class:'note',text:'No effects match your search.'})]));
  };
  const tabs=isLayer(L)?seg([['layer','This layer'],['mask','Its mask'],['stack','New filter layer']],target,v=>{target=v;draw();},'Apply effect to'):null;
  search.addEventListener('input',draw);
  search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();results.querySelector('button')?.click();}});
  draw();
  openDialog({title:'Effects · '+L.name,body:el('div',{class:'dlg-grid effect-picker'},search,tabs,results),cancelLabel:'Close'});
}
function shelfStyleApply(rec,L){
  if(stroke||preview||selLive||!modal.hidden){toast('Finish the current edit first.');return;}
  if(!isLayer(L)||L.fx){toast('Choose a layer to style.');return;}
  if(lockStop({node:L}))return;
  selectOnly(L);updateRowClasses();dlgLayerStyle(rec.id,true);
  return L;
}
function shelfEffectTile(kind,rec,icon){
  const destination=kind==='filter'?'on a layer or between layers':'onto a layer';
  const tile=el('button',{type:'button',class:'mattile sheffect',title:rec.name+' · Drag '+destination,'aria-label':rec.name,
    'aria-description':'Drag '+destination+' to apply','data-shkey':kind+':'+rec.id},icon,el('span',{text:rec.name}));
  tile._libDrag=[kind,rec];
  return tile;
}
function shFiltersRender(){
  const box=dkSec('shfilters').querySelector('#shFiltersBody');
  const preview=id=>{
    const icon=()=>shSvg(id==='arcane'?SH_ICO.star:PANELS.shfilters.icon);
    const frame=el('span',{class:'sheffect-icon','aria-hidden':'true'});
    const src=FILTER_THUMBS[id];
    if(!src){frame.append(icon());return frame;}
    const img=el('img',{alt:'',width:128,height:128,loading:'lazy',decoding:'async',draggable:'false'});
    img.addEventListener('error',()=>frame.replaceChildren(icon()),{once:true});
    img.src=src;
    frame.append(img);
    return frame;
  };
  box.replaceChildren(...shelfFilterGroups().flatMap(([group,records])=>[
    el('div',{class:'sub',text:group}),
    el('div',{class:'shgrid'},...records.map(rec=>shelfEffectTile('filter',rec,preview(rec.id))))
  ]),el('p',{class:'note sh-empty',hidden:true,text:'No filters match.'}));
}
function shStylesRender(){
  const box=dkSec('shstyles').querySelector('#shStylesBody');
  box.replaceChildren(el('div',{class:'shgrid'},...STYLE_ORDER.map(id=>{
    const rec={id,name:STYLE_DEFS[id].label};
    return shelfEffectTile('style',rec,el('span',{class:'sheffect-icon shstyle-icon','data-style':id,'aria-hidden':'true'},
      el('i')));
  })),el('p',{class:'note sh-empty',hidden:true,text:'No layer styles match.'}));
}
