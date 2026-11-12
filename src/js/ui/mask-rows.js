/* ================= Mask and effect rows in the Layers panel (like Substance Painter) =================
   Under a layer: its mask's rows (red square) and its content effects (blue fx), top first, each with an eye,
   its blend mode and opacity, and ✕. Click a row to change it in Properties; drag rows to reorder; ▾ on the layer
   folds them. FX ▾ adds to the mask when the mask thumbnail is selected, else to the layer's content. */
function msRowsEl(n){const out=[];if(!(msHas(n)||(n.cfx&&n.cfx.length))||n.fxFold)return out;
  const mk=(where,S)=>{for(let i=S.length-1;i>=0;i--){const r=S[i],on=ui.msSel&&ui.msSel.L===n&&ui.msSel.id===r.id;
    const eye=el('button',{class:'eye',title:r.on!==false?'Hide':'Show','aria-label':(r.on!==false?'Hide ':'Show ')+msRowTitle(r)});eye.innerHTML=r.on!==false?eyeOn:eyeOff;
    eye.addEventListener('pointerdown',e=>e.stopPropagation());eye.addEventListener('click',e=>{e.stopPropagation();msRecord(n,(r.on!==false?'Hide ':'Show ')+msRowTitle(r).toLowerCase(),()=>{r.on=r.on===false;});});
    const del=el('button',{class:'msdel',text:'✕',title:'Delete','aria-label':'Delete '+msRowTitle(r)});del.addEventListener('pointerdown',e=>e.stopPropagation());del.addEventListener('click',e=>{e.stopPropagation();msRemove(n,where,r.id);});
    const modeBtn=el('button',{class:'msmode',text:(MS_MODES.find(m=>m[0]===(r.mode||'normal'))||MS_MODES[0])[2],title:'Blend mode: click to change','aria-label':'Blend mode of '+msRowTitle(r)+': click to change'});
    modeBtn.addEventListener('pointerdown',e=>e.stopPropagation());modeBtn.addEventListener('click',e=>{e.stopPropagation();msModeMenu(e,n,r,modeBtn);});
    const row=el('div',{class:'msrow '+(where==='m'?'m':'c')+(on?' on':'')+(r.on===false?' hid':''),role:'option',tabindex:'0','aria-selected':String(!!on),title:where==='m'?'In the mask: click to change it in Properties, drag to reorder':'On the layer: click to change it in Properties, drag to reorder'},
      eye,el('span',{class:'mskind',text:where==='m'?'▣':'fx','aria-hidden':'true'}),el('span',{class:'lname',text:msRowTitle(r)}),
      modeBtn,el('span',{class:'msop',text:String(Math.round((r.op==null?1:r.op)*100))}),del);
    row._ms={L:n,where,id:r.id};
    row.addEventListener('pointerdown',e=>msRowDown(e,row));
    row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();msSelect(n,where,r.id);}if(e.key==='Delete'){e.preventDefault();e.stopPropagation();msRemove(n,where,r.id);}});
    out.push(row);}};
  /* (0.97.1, Kenn: "like Painter") only the selected layer shows rows: its mask's rows when the mask is selected, else its own effects;
     clicking the same thumbnail again folds them away (layerPointerDown) */
  if(n!==doc.active)return out;if(n.editMask&&msHas(n))mk('m',n.mask.stack);else if(!n.editMask&&n.cfx&&n.cfx.length)mk('c',n.cfx);return out;}
/* (0.31.2) click a row's blend name to pick another blend mode right there */
function msModeMenu(e,n,r,btn){const pop=$('#menuPop');closeMenu();const cur=r.mode||'normal',b=btn.getBoundingClientRect();
  pop.replaceChildren(...MS_MODES.map(([v,t])=>el('button',{class:'mi',role:'menuitemradio','aria-checked':String(v===cur),onclick:()=>{pop.hidden=true;if(v===cur)return;msRecord(n,'Blend mode: '+t.toLowerCase(),()=>{r.mode=v;});}},el('span',{text:v===cur?'✓':''}),el('span',{text:t}),el('span'))));
  pop.hidden=false;pop.style.left=Math.max(4,Math.min(b.left,window.innerWidth-pop.offsetWidth-8))+'px';pop.style.top=Math.max(4,Math.min(b.bottom+2,window.innerHeight-pop.offsetHeight-8))+'px';
  const off=ev=>{if(!pop.contains(ev.target)){pop.hidden=true;document.removeEventListener('pointerdown',off,true);}};setTimeout(()=>document.addEventListener('pointerdown',off,true),0);}
/* click selects; a drag moves the row among the rows of the same layer and kind */
function msRowDown(e,row){if(e.button!==0)return;e.stopPropagation();const {L,where,id}=row._ms,y0=e.clientY;let moved=false;
  const mv=ev=>{if(Math.abs(ev.clientY-y0)>5)moved=true;if(!moved)return;row.classList.add('drag');};
  const up=ev=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);row.classList.remove('drag');
    if(!moved){msSelect(L,where,id);return;}
    const t=document.elementFromPoint(ev.clientX,ev.clientY),o=t&&t.closest('.msrow');if(!o||!o._ms||o._ms.L!==L||o._ms.where!==where||o._ms.id===id)return;
    const S=where==='m'?L.mask.stack:L.cfx,to=S.findIndex(r=>r.id===o._ms.id);msMove(L,where,id,to);};
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);}

/* ---- FX ▾ ---- */
function fxAddMenu(e,start){const L=doc.active;if(!L||!(isLayer(L)||L.type==='group')||L.fx){toast('Select a layer first.');return;}if(ui.mode==='anim'){toast('Masks with rows are for Paint and 3D Paint.');return;}
  const toMask=!!(L.editMask||!isLayer(L)),pop=$('#menuPop');closeMenu();
  const it=(t,f,sub)=>el('button',{class:'mi',role:'menuitem',onclick:ev=>{ev.stopPropagation();if(!sub)pop.hidden=true;f();}},el('span'),el('span',{text:t}),el('span',{text:sub?'▸':''}));
  const head=t=>el('div',{class:'mh',text:t}),sep=()=>el('div',{class:'msep'});
  const page=items=>{pop.replaceChildren(...items);pop.hidden=false;place();};
  const place=()=>{pop.style.left=Math.max(4,Math.min(e.clientX,window.innerWidth-pop.offsetWidth-8))+'px';pop.style.top=Math.max(4,Math.min(e.clientY-pop.offsetHeight-6,window.innerHeight-pop.offsetHeight-8))+'px';};
  const back=()=>it('‹ Back',main,true);
  const add=(kind,o)=>()=>{msAdd(L,kind,o);if(kind==='image')msPickImage(L,msRowOf(ui.msSel));};
  const sub=(title,list)=>()=>page([back(),head(title),...list]);
  const filters=own=>[...MS_FILTERS.filter(id=>FX[id]).map(id=>it(FX[id].title,own?add('filter',{fx:id}):()=>cfxAdd(L,id))),...(own?Object.keys(MS_OWN_FILTERS).map(k=>it(MS_OWN_FILTERS[k],add('filter',{own:k,p:{r:k==='grow'?3:k==='warp'?4:6,scale:6,seed:1}}))):[])];
  function main(){
    if(!toMask){const all=[];for(const [g,ids] of FX_KINDS())for(const id of ids)if(FX[id]&&!(FX[id].gen))all.push(it(FX[id].title,()=>cfxAdd(L,id)));
      page([head('Add to the layer’s content'),it('⚓ Anchor point',()=>cfxAddAnchor(L)),sep(),...all.slice(0,40),sep(),...(isLayer(L)&&!L.mask?[it('Live mask (limits painting)…',()=>liveMaskStart(L))]:[]),it('Add to its mask instead…',()=>{if(!L.mask){msAdd(L,'fill',{p:{v:1}});}L.editMask=true;renderLayers();fxAddMenu(e);},true)]);return;}
    const mks=msMeshKeys(),others=allNodes(doc.root).filter(n=>n!==L&&n.mask);
    page([head('Add to the mask of “'+L.name+'”'),
      it('Paint',add('paint')),it('Fill white',add('fill',{p:{v:1}})),it('Fill black',add('fill',{p:{v:0}})),
      it('Mesh map',sub('Mesh map',mks.length?mks.map(k=>it(msMeshName(k),add('mesh',{p:{k,inv:false}}))):[el('p',{class:'note',style:'padding:6px 10px;max-width:240px',text:'No baked maps yet. Bake in the Bake tab and press Send to 3D Paint.'})]),true),
      it('ID colour',()=>{const r=msAdd(L,'id');if(r){ui.viewMask=true;maskTool('id');}}),
      it('Direction (facing up…)',add('dir')),it('Gradient',add('grad')),it('3D gradient (points around the model)',add('g3d')),
      it('Noise',sub('Noise',MS_NOISES.map(([k,t])=>it(t,add('noise',{p:Object.assign(MS_KINDS.noise.p(),{type:k})})))),true),
      it('Picture…',add('image')),
      it('From anchor',sub('From anchor',msAnchorNames().length?msAnchorNames().map(nm=>it(nm,add('anchor',{p:{name:nm,ch:'height',inv:false}}))):[el('p',{class:'note',style:'padding:6px 10px;max-width:240px',text:'No anchor points yet. Select a layer’s own thumbnail, press ✦ and choose Anchor point.'})]),true),
      it('Another layer’s mask',sub('Another layer’s mask',others.length?others.map(o=>it(o.name,add('ref',{p:{name:o.name}}))):[el('p',{class:'note',style:'padding:6px 10px',text:'No other layer has a mask.'})]),true),
      it('Generator',sub('Generator',MS_GENS.map(([k,t])=>it(t,add('gen',{p:msGenDefaults(k)})))),true),
      sep(),it('Filter',sub('Filter',filters(true)),true),
      /* (0.27, Kenn: filter layers on masks) every filter, in the Filter Gallery's folders; it works on the rows below it */
      it('All filters',sub('All filters',maskGroups()),true)]);}
  function maskGroups(){return FX_KINDS().map(([g,ids])=>it(g,sub(g,ids.filter(id=>FX[id]&&!FX[id].gen).map(id=>it(FX[id].title,add('filter',{fx:id})))),true));}
  /* (0.27) from the right-click layer menu: straight to the filters */
  if(start==='filters'){if(toMask)page([head('Filter the mask of “'+L.name+'”'),...filters(true),sep(),head('All filters'),...maskGroups()]);
    else page([head('Filter “'+L.name+'” (live, editable)'),...FX_KINDS().map(([g,ids])=>it(g,()=>page([it('‹ Back',()=>fxAddMenu(e,'filters'),true),head(g),...ids.filter(id=>FX[id]&&!FX[id].gen).map(id=>it(FX[id].title,()=>cfxAdd(L,id)))]),true))]);return;}
  main();
  const off=ev=>{if(!pop.contains(ev.target)){pop.hidden=true;document.removeEventListener('pointerdown',off,true);}};setTimeout(()=>document.addEventListener('pointerdown',off,true),0);}
async function msPickImage(L,r){if(!r)return;const fs=await pickFiles('image/*',false,'Images',['png','jpg','jpeg','webp','tga','tif','tiff','bmp','psd','exr','hdr']);const f=fs[0];if(!f)return;
  let t;try{t=await fileTarget(f);}catch(er){toast('Could not read '+f.name+': '+(er.message||er));return;}setWrap(t,true);
  msEdit(L,r,x=>{x.t=t;x.p.name=f.name;});(L.mask._rows||(L.mask._rows=new Set())).add(r);renderLayers();renderMatEd(true);}

/* (0.96.1, Kenn) a texture tile dragged from the Textures panel onto a Picture row replaces its picture */
function msImageDrop(L,r){const drop=el('div',{class:'fxddrop',id:'msImageDrop',tabindex:'0',title:'Drop a texture tile here to use it as this picture'},el('b',{text:'Drop a texture'}),el('small',{text:'a tile from Textures'}));
  drop._texDrop=async ref=>{try{await txLoad();const it=fxdAllTex().find(x=>x.kind===ref.kind&&x.id===ref.id);if(!it)return;const t=txCopy(await txTarget(it));setWrap(t,true);
      msEdit(L,r,x=>{x.t=t;x.p.name=it.name;});(L.mask._rows||(L.mask._rows=new Set())).add(r);renderLayers();renderMatEd(true);}catch(e){toast('Could not read that texture: '+(e.message||e));}};
  return drop;}
/* ---- Properties: the selected row's settings ---- */
function msRowEditor(box,L,where,r){const title=msRowTitle(r),p=r.p||(r.p={});
  const ed=fn=>msEdit(L,r,fn);const S=(id,label,key,min,max,step,fmt,fallback)=>makeSlider({id,label,min,max,step,
    numericMax:['scale','scratchScale','tile','gtile','gcon','contrast'].includes(key)||(key==='r'&&r.own==='warp')||
      (p.g==='builder'&&MS_BUILDER_INPUTS.some(([input])=>input===key))?Infinity:undefined,
    value:p[key]??fallback??min,fmt:fmt||(v=>String(Math.round(v*100)/100)),onInput:v=>ed(x=>{x.p[key]=v;})}).el;
  const sel=(id,label,opts,key)=>{const s=el('select',{id,'aria-label':label},...opts.map(([v,t])=>el('option',{value:v,text:t})));s.value=p[key];s.onchange=()=>{ed(x=>{x.p[key]=s.value;});renderLayers();};return el('div',{class:'frow'},el('label',{text:label}),s);};
  const inv=()=>chk('ms_inv','Invert',!!p.inv,v=>ed(x=>{x.p.inv=v;}));
  const modeSel=el('select',{id:'ms_mode','aria-label':'Blend mode'},...MS_MODES.map(([v,t])=>el('option',{value:v,text:t})));modeSel.value=r.mode||'normal';modeSel.onchange=()=>{ed(x=>{x.mode=modeSel.value;});renderLayers();};
  box.append(el('div',{class:'mshead'},el('span',{class:'mskind '+(where==='m'?'m':'c'),text:where==='m'?'▣':'fx','aria-hidden':'true'}),el('div',{},el('div',{class:'mstitle',text:title}),el('div',{class:'note',text:(where==='m'?'In the mask of “':'On “')+L.name+'”'}))),
    el('div',{class:'frow'},el('label',{text:'Blend'}),modeSel),
    makeSlider({id:'ms_op',label:'Opacity',min:0,max:1,step:.01,value:r.op==null?1:r.op,fmt:pct,onInput:v=>{ed(x=>{x.op=v;});const e=document.querySelector('.msrow.on .msop');if(e)e.textContent=String(Math.round(v*100));}}).el);
  /* filters take the settings of the filter itself */
  if(r.kind==='filter'&&(!r.own||r.own==='slope')){
    const legacySlope=r.own==='slope',F=FX[legacySlope?'slopeBlur':r.fx];
    if(!F){box.append(el('p',{class:'note',text:'This filter is not available.'}));return;}
    // Keep the old mask result until its filter settings are edited.
    const defaults=fxDefaults(F);
    if(legacySlope)Object.assign(defaults,{guide:'noise',amt:(p.r??3)*3.75,
      size:clamp(Math.round(doc.w/(p.scale||6)),4,600),seed:p.seed||1,uvWrap:p.uvWrap!==false});
    const settings=legacySlope?p.slope:r.v;
    const draft=Object.assign(defaults,fxClean(settings||{})),ctx={};
    if(where==='m'&&(r.fx==='levels'||r.fx==='curves')){const t=msEval(L,{upTo:L.mask.stack.indexOf(r)});try{ctx._h=histogramOf(t);}finally{release(t);}}
    const c=fxControls(F,draft,()=>ed(x=>{if(legacySlope)x.p.slope=fxClean(draft);else x.v=fxClean(draft);}),ctx);
    /* (0.94.6) a Hand-painted material: its look's settings, with the way back to the material's channels and the switch to painting over the layers below */
    if(r.fx==='handPaint'&&where==='c'&&L.fill)box.append(el('div',{class:'chips'},el('button',{class:'btn sm',id:'hpMatChannels',text:'Material channels',title:'Roughness, metallic, height and the other channels of this material',onclick:()=>{matEd.hpChan=L;ui.msSel=null;renderLayers();renderMatEd(true);}}),el('button',{class:'btn sm',id:'hpOverBelow',text:'Paint over the layers below',title:'Turn it into a Hand-painted layer that lights and shades what is under it',onclick:()=>hpMatToOverlay(L)})));
    box.append(...c.body);if(c.reset)box.append(el('div',{class:'frow'},c.reset));
    if(where==='c'){const ms=el('select',{id:'ms_maps','aria-label':'Maps it changes'},el('option',{value:'all',text:'Every map but the normal'}),el('option',{value:'base',text:'Base colour only'}),...doc.maps.filter(k=>k!=='base').map(k=>el('option',{value:'only:'+k,text:MAP_DEFS[k].label+' only'})));
      ms.value=Array.isArray(r.maps)?'only:'+r.maps[0]:r.maps==='all'?'all':'base';ms.onchange=()=>ed(x=>{x.maps=ms.value==='all'?'all':ms.value==='base'?'base':[ms.value.slice(5)];});
      box.append(el('div',{class:'frow'},el('label',{text:'Changes'}),ms));}
    else box.append(el('p',{class:'note',text:'A filter changes everything below it in the mask.'}));return;}
  if(r.kind==='filter'){box.append(chk('ms_uvWrap','UV wrap',p.uvWrap!==false,v=>ed(x=>{x.p.uvWrap=v;})),S('ms_r',r.own==='grow'?'Grow (−: shrink)':'Amount',...(r.own==='grow'?['r',-12,12,1]:['r',0,24,.5]),v=>String(v)));
    if(r.own!=='grow')box.append(S('ms_scale','Noise size','scale',1,40,.5),S('ms_seed','Seed','seed',1,99,1,v=>String(v)));
    box.append(el('p',{class:'note',text:r.own==='grow'?'Makes the white parts bigger (or smaller, below 0).':'Pushes the mask around with a noise, to break up clean edges.'}));return;}
  if(r.kind==='paint'){box.append(el('p',{class:'note',text:'Paint on the model or the canvas: white shows the layer, black hides it. The eraser takes paint away (back to the rows below).'}),
    el('div',{class:'chips'},el('button',{class:'btn sm',text:'Fill white',onclick:()=>{msSelect(L,where,r.id);maskOp(0,1);}}),el('button',{class:'btn sm',text:'Fill black',onclick:()=>{msSelect(L,where,r.id);maskOp(0,0);}}),
      el('button',{class:'btn sm',text:'Clear',onclick:()=>{msSelect(L,where,r.id);fullRecord({target:r.t,lockAlpha:false,maskOf:L,maskObj:L.mask},'Clear paint row',()=>clearTarget(r.t,[0,0,0,0]));}})));return;}
  if(r.kind==='fill')box.append(S('ms_v','Value','v',0,1,.01,pct));
  if(r.kind==='anchorpt'){box.replaceChildren(box.firstChild);const i=el('input',{type:'text',id:'ms_aname',value:p.name||'','aria-label':'Anchor name'});i.addEventListener('change',()=>{const old=p.name,nw=i.value.trim()||old;
      ed(x=>{x.p.name=nw;});for(const n of allNodes(doc.root))for(const q of (n.mask&&n.mask.stack)||[])if((q.kind==='anchor'&&q.p.name===old)||(q.kind==='gen'&&q.p.anchor===old)){if(q.kind==='anchor')q.p.name=nw;else q.p.anchor=nw;if(n.mask)n.mask._key=null;}renderLayers();});
    box.append(el('div',{class:'frow'},el('label',{text:'Name'}),i),el('p',{class:'note',text:'Masks elsewhere can read this layer through its anchor (✦ › From anchor): its height, colour or shape. Generators can follow its height too (Also follow anchor).'}));return;}
  if(r.kind==='anchor'){const ns=msAnchorNames();if(p.name&&!ns.includes(p.name))ns.unshift(p.name);
    box.append(sel('ms_anc','Anchor',ns.map(x=>[x,x]),'name'),el('div',{class:'sub',text:'Reads'}),seg([['height','Height'],['shape','Shape'],['colour','Colour']],p.ch||'height',v=>{ed(x=>{x.p.ch=v;});renderLayers();},'Reads'),inv(),
      el('p',{class:'note',text:msAnchor(p.name)?'Follows “'+msAnchor(p.name).name+'”, live.':'That anchor point is gone.'}));}
  if(r.kind==='mesh'){const ks=msMeshKeys();if(!ks.includes(p.k))ks.unshift(p.k);if(p.bal==null)p.bal=0;if(p.con==null)p.con=0;
    const curvy=/curv(?!Edge|Crease)/.test(p.k);
    box.append(sel('ms_k','Map',ks.map(k=>[k,msMeshName(k)]),'k'),
      ...(curvy?[el('div',{class:'sub',text:'Use'}),seg([['both','Both'],['edges','Edges'],['cavities','Cavities']],p.part||'both',v=>{ed(x=>{x.p.part=v;});},'Curvature part')]:[]),
      S('ms_bal','Balance','bal',-1,1,.01,v=>(v>0?'+':'')+Math.round(v*100)),S('ms_con','Contrast','con',-1,1,.01,v=>(v>0?'+':'')+Math.round(v*100)),inv(),
    el('p',{class:'note',text:msMeshTex(p.k)?'A baked map of this texture set.':'Not baked yet: using the document’s own map, if it has one.'}));}
  if(r.kind==='id'){const sw=(p.cols||[]).map((c,i)=>el('button',{class:'idsw',style:'background:'+toHex(c),title:'Remove this colour','aria-label':'Remove colour '+toHex(c),onclick:()=>{ed(x=>x.p.cols.splice(i,1));renderMatEd(true);}}));
    box.append(el('div',{class:'chips'},...sw,el('button',{class:'btn sm',text:'Pick colours',onclick:()=>{msSelect(L,where,r.id);ui.viewMask=true;L.editMask=true;maskTool('id');renderLayers();}})),
      S('idTol','Tolerance','tol',0,.6,.01,pct),S('idSoft','Softness','soft',0,.3,.01,pct),inv(),
      el('p',{class:'note',text:doc.meshMaps&&doc.meshMaps.id?'Pick colours on the model: where the ID map has them, the mask is white.':'This texture set has no baked ID map yet.'}));}
  if(r.kind==='dir')box.append(sel('ms_axis','Facing',[['up','Up'],['down','Down'],['x','Right (+X)'],['-x','Left (−X)'],['z','Front (+Z)'],['-z','Back (−Z)']],'axis'),S('ms_ang','Angle','angle',1,90,1,v=>v+'°'),S('ms_soft','Softness','soft',1,60,1,v=>v+'°'),inv(),
    el('p',{class:'note',text:v3.mesh?'Uses the model: world directions.':'On the flat texture it uses the normal map (up = the top of the texture).'}));
  if(r.kind==='g3d')box.append(g3Box({L,g:p,row:r},true),inv());
  if(r.kind==='grad')box.append(sel('ms_axis','Towards',[['up','Top'],['down','Bottom'],['x','Right'],['-x','Left'],['z','Front'],['-z','Back']],'axis'),S('ms_from','From','from',0,1,.01,pct),S('ms_to','To','to',0,1,.01,pct),inv());
  if(r.kind==='noise')box.append(sel('ms_type','Pattern',MS_NOISES,'type'),S('ms_scale','Size','scale',.5,40,.5),S('ms_con','Contrast','contrast',.2,8,.05),S('ms_lvl','Level','level',-1,1,.01),S('ms_seed','Seed','seed',1,99,1,v=>String(v)),
    inv(),pxfBox(L,r,[['world','World (no seams)'],['uv','UV']]));
  if(r.kind==='image')box.append(el('div',{class:'row wrap'},el('span',{class:'note',text:p.name||'No picture'}),el('button',{class:'btn sm',text:'Choose picture…',onclick:()=>msPickImage(L,r)})),msImageDrop(L,r),
    makeSlider({id:'ms_imgContrast',label:'Contrast',min:-1,max:4,step:.01,value:p.contrast??0,fmt:pct,onInput:v=>ed(x=>{x.p.contrast=v;})}).el,
    S('ms_tile','Tile','tile',.25,16,.25,v=>v+'×'),inv(),pxfBox(L,r,PXF_MODES));
  if(r.kind==='alpha')box.append(inv(),el('p',{class:'note',text:'Uses the transparency of this material’s picture (and its Opacity map, if it has one). Where it is see-through, the layers under show in every map.'}));
  if(r.kind==='ref'){const os=allNodes(doc.root).filter(n=>n!==L&&n.mask);box.append(sel('ms_ref','Layer',os.map(o=>[o.name,o.name]),'name'),inv(),el('p',{class:'note',text:'Follows that layer’s mask, live.'}));}
  if(r.kind==='gen'){
    if(p.g==='builder'){
      for(const [k,v] of Object.entries(msGenDefaults('builder')))if(p[k]==null)p[k]=v;
      const axes=[['up','Up'],['down','Down'],['x','Right'],['-x','Left'],['z','Front'],['-z','Back']];
      const facing=sel('ms_directionAxis','Faces towards',axes,'directionAxis');
      facing.querySelector('select').value=p.directionAxis||p.gradAxis;
      const position=sel('ms_gradAxis','Position runs towards',axes,'gradAxis'),positionAxis=position.querySelector('select');
      positionAxis.onchange=()=>ed(x=>{x.p.directionAxis??=x.p.gradAxis;x.p.gradAxis=positionAxis.value;});
      const combine=sel('ms_builderCombine','Combine inputs',MS_BUILDER_MIX,'combine');
      combine.querySelector('select').value=p.combine||'add';
      box.append(el('div',{class:'sub',text:'Mask Builder'}),msBuilderPreset(ed),combine,
        ...MS_BUILDER_INPUTS.map(([k,label])=>S('ms_'+k,label,k,0,1,.01,pct)),msBuilderTone(p,ed),
        facing,S('ms_w','Direction softness','width',0,1,.01,pct),position,
        S('ms_positionFrom','Position start','positionFrom',0,1,.01,pct),S('ms_positionTo','Position end','positionTo',0,1,.01,pct),
        el('div',{class:'sub',text:'Final mask'}),S('ms_amt','Offset','amount',0,1,.01,pct),S('ms_con','Contrast','contrast',.3,6,.05),
        inv(),sel('ms_ganc','Also follow anchor',[['','None'],...msAnchorNames().map(x=>[x,x])],'anchor'),
        chk('ms_uvWrap','UV wrap',p.uvWrap!==false,v=>ed(x=>{x.p.uvWrap=v;})),
        S('ms_brk','Grunge breakup','breakup',0,1,.01,pct),S('ms_scale','Grunge scale','scale',.5,40,.5),S('ms_seed','Seed','seed',1,99,1),
        S('ms_dist','Distort mesh maps','distort',0,1,.01,pct),pxfBox(L,r,[['world','World (no seams)'],['uv','UV']]),msGrungeBox(r,p,ed,S),
        el('p',{class:'note',text:'Add sums the inputs. Lightest keeps the strongest. Intersect keeps their overlap and skips missing maps. Bake the mesh maps to get the most detail.'}));
      return;
    }
    const choose=sel('ms_g','Preset',MS_GENS,'g'),input=choose.querySelector('select');input.onchange=()=>{ed(x=>Object.assign(x.p,['light','linear','radial','comic',...MS_WEAR_GENS,...MS_PAINT_DAMAGE].includes(input.value)?msGenDefaults(input.value):{g:input.value}));renderLayers();renderMatEd(true);};box.append(choose);
    box.append(chk('ms_uvWrap','UV wrap',p.uvWrap!==false,v=>ed(x=>{x.p.uvWrap=v;})));
    const fresh=['light','linear','radial','comic'].includes(p.g);
    if(fresh){for(const [k,v] of Object.entries(msGenDefaults(p.g)))if(p[k]==null)p[k]=v;
      if(p.g==='light'||p.g==='comic')box.append(S('ms_lightAz','Light horizontal angle','lightAz',-180,180,1,v=>v+'°'),S('ms_lightEl','Light elevation','lightEl',-90,90,1,v=>v+'°'),S('ms_wrap','Light wrap','width',0,1,.01,pct),S('ms_occ','Cavity shading','occlude',0,1,.01,pct));
      if(p.g==='linear'||p.g==='radial'){if(p.g==='linear')box.append(sel('ms_gradAxis','Direction',[['up','Bottom to top'],['down','Top to bottom'],['x','Left to right'],['-x','Right to left'],['z','Back to front'],['-z','Front to back']],'gradAxis'));
        else box.append(S('ms_centerX','Centre X','centerX',0,1,.01,pct),S('ms_centerY','Centre Y','centerY',0,1,.01,pct),S('ms_centerZ','Centre Z','centerZ',0,1,.01,pct));
        const style=sel('ms_gradStyle','Falloff',[['linear','Linear'],['smooth','Smooth'],['bands','Stepped']],'gradStyle');style.querySelector('select').addEventListener('change',()=>renderMatEd(true));box.append(S('ms_gradFrom','Start','gradFrom',0,1,.01,pct),S('ms_gradTo','End','gradTo',0,1,.01,pct),style);if(p.gradStyle==='bands')box.append(S('ms_bands','Bands','bands',2,8,1,v=>String(v)));
      }
      if(p.g==='comic'){const style=sel('ms_comicStyle','Style',[['shade','Shading and dots'],['shadow','Solid ink shadows'],['dots','Halftone dots']],'comicStyle');style.querySelector('select').addEventListener('change',()=>renderMatEd(true));box.append(style);if(p.comicStyle==='shade')box.append(S('ms_bands','Shading bands','bands',2,6,1,v=>String(v)));if(p.comicStyle!=='shadow')box.append(S('ms_dots','Dot density','dots',4,120,1,v=>String(v)),S('ms_dotSize','Dot size','dotSize',0,.8,.01,pct),S('ms_dotAngle','Dot angle','dotAngle',-180,180,1,v=>v+'°'));}
      box.append(S('ms_amt','Offset','amount',0,1,.01,pct),S('ms_con','Contrast','contrast',.3,6,.05),inv(),el('p',{class:'note',text:p.g==='light'||p.g==='comic'?'Follows surface normals; Cavity shading uses baked AO. Change the angles to move the mask across the model.':'Follows the model’s bounds. On a flat canvas it follows the image. Start and End can be reversed.'}));
    }else{
      const wear=MS_WEAR_GENS.includes(p.g),useWear=p.g==='useWear',peeling=p.g==='peelingPaint',bubbles=p.g==='paintBubbles';
      const has=[msMeshTex('curv')&&'curvature',msMeshTex('ao')&&'AO',v3.mesh&&'the model'].filter(Boolean);
      const note=useWear?'Contact wear adds scuffed patches to exposed surfaces. Use Contact faces to favor the parts most often touched.'
        :wear?'Edge growth spreads the wear outward from exposed edges. Edge distortion bends the band.'
        :peeling?'Invert the damage mask on your top coat. Use a second row with the same preset and seed for lifted edges or coating relief in Height.'
        :bubbles?'Makes clusters of rounded paint blisters. Use this mask on a fill with Height to give the bubbles relief.'
        :'Uses '+(has.length?has.join(', '):'the document’s maps')+'. Bake curvature and AO for the best results.';
      if(wear)p.cavityProtection??=.75;
      const scanSelect=(id,label,key,sources)=>{
        const row=sel(id,label,[['','None'],...sources.map(({slug,name})=>[slug,name])],key);
        const picker=row.querySelector('select');
        if(!picker.value)picker.value='';
        picker.onchange=()=>{
          ed(x=>{x.p[key]=picker.value;});
          renderMatEd(true);
        };
        return row;
      };
      if(peeling){
        const variants=MS_PEEL_PRESETS.map(([key,label])=>[key,label]);
        if(!p.peelPreset)variants.unshift(['','Original flakes']);
        const row=sel('ms_peelPreset','Peeling Paint preset',variants,'peelPreset'),picker=row.querySelector('select');
        picker.value=p.peelPreset||'';
        picker.onchange=()=>{
          const preset=MS_PEEL_PRESETS.find(([key])=>key===picker.value);
          if(!preset)return;
          msCommit();
          ed(x=>Object.assign(x.p,preset[2],{peelPreset:preset[0]}));
          msCommit();
          renderMatEd(true);
        };
        box.append(row);
        if(p.crackWidth!=null){
          const output=sel('ms_peelOutput','Output',MS_PEEL_OUTPUTS,'peelOutput');
          output.querySelector('select').value=p.peelOutput||'damage';
          const scan=scanSelect('ms_peelScan','Paint scan','peelScan',TX_PAINT_SCANS);
          box.append(output,S('ms_crackWidth','Crack width','crackWidth',0,1,.01,pct),
            S('ms_flakeLoss','Missing flakes','flakeLoss',0,1,.01,pct),
            S('ms_edgeLift','Rim height','edgeLift',0,1,.01,pct),
            S('ms_stretch','Directional stretch','stretch',0,1,.01,pct),
            S('ms_direction','Direction','direction',-180,180,1,v=>Math.round(v)+'°'),scan);
          if(scan.querySelector('select').value)box.append(
            S('ms_peelScanAmount','Scan strength','peelScanAmount',0,1,.01,pct,.65),
            S('ms_peelScanTile','Scan tiling','peelScanTile',.25,16,.25,v=>v+'×',2));
        }
      }
      box.append(S('ms_amt',bubbles?'Density':'Amount','amount',0,1,.01,pct),
        S('ms_w',wear?'Edge width':peeling?'Flake spread':bubbles?'Bubble radius':'Width','width',0,1,.01,pct),
        ...(wear?[
          S('ms_edgeStrength','Edge strength','edgeStrength',0,2,.01,pct,1),
          S('ms_edgeGrow','Edge growth','edgeGrow',0,1,.01,pct,0),
          S('ms_dist','Edge distortion','distort',0,1,.01,pct),
          S('ms_edgeDistortScale','Edge distortion scale','edgeDistortScale',1,32,.5,v=>String(v),9)
        ]:[]),
        wear?S('ms_cavityProtection','Cavity protection','cavityProtection',0,1,.01,pct):null,
        S('ms_brk','Breakup','breakup',0,1,.01,pct),wear?null:S('ms_dist','Distort','distort',0,1,.01,pct),
        S('ms_con','Contrast','contrast',.3,6,.05),
        S('ms_scale',useWear?'Contact scale':peeling||bubbles?'Pattern frequency':'Noise size','scale',.5,40,.5),S('ms_seed','Seed','seed',1,99,1,v=>String(v)));
      if(wear){
        if(useWear)box.append(S('ms_contactAmount','Contact wear','contactAmount',0,1,.01,pct,.72),
          sel('ms_contactAxis','Contact faces',[['','All exposed faces'],['up','Top'],['down','Bottom'],
            ['x','Right (+X)'],['-x','Left (−X)'],['z','Front (+Z)'],['-z','Back (−Z)']],'contactAxis'));
        const scan=scanSelect('ms_metalScan',useWear?'Wear scan':'Metal scan','metalScan',[...TX_METAL_SCANS,...TX_WEAR_SCANS]);
        box.append(scan);
        if(scan.querySelector('select').value)box.append(
          S('ms_metalScanAmount','Scan influence','metalScanAmount',0,1,.01,pct,.65),
          S('ms_metalScanTile','Scan tiling','metalScanTile',.25,16,.25,v=>v+'×',2),
          S('ms_metalScanAngle','Scan rotation','metalScanAngle',-180,180,1,v=>Math.round(v)+'°'));
        box.append(
          S('ms_scratchAmount','Scratch amount','scratchAmount',0,1,.01,pct),
          S('ms_scratchScale','Scratch frequency','scratchScale',2,100,1,v=>String(Math.round(v)),34),
          S('ms_scratchAngle','Scratch angle','scratchAngle',-180,180,1,v=>Math.round(v)+'°'),
          S('ms_scratchReach','Scratch reach','scratchReach',0,1,.01,pct,.35));
      }
      if(bubbles)box.append(S('ms_sizeVariation','Size variation','sizeVariation',0,1,.01,pct,.82),
        S('ms_clumping','Clumping','clumping',0,1,.01,pct,.85));
      box.append(inv(),
        peeling||bubbles?null:sel('ms_ganc','Also follow anchor',[['','None'],...msAnchorNames().map(x=>[x,x])],'anchor'),
        pxfBox(L,r,[['world','World (no seams)'],['uv','UV']]),msGrungeBox(r,p,ed,S),el('p',{class:'note',text:note}));
    }
  }}

$('#lFxAdd').addEventListener('click',fxAddMenu);

/* a row's projection: its mode, and the offset/rotation/scale fields (the gizmo or the 2D handles move them too) */
const MS_BUILDER_PRESETS=[
  ['Edge wear',{edgeWeight:1}],
  ['Cavity dirt',{cavityWeight:.45,aoWeight:.8}],
  ['Top dust',{directionWeight:.65,positionWeight:.35,positionFrom:.35}],
  ['Low buildup',{positionWeight:.65,aoWeight:.35,gradAxis:'down',positionFrom:.4}]
];
function msBuilderPreset(edit){
  const picker=el('select',{id:'ms_builderPreset','aria-label':'Mask Builder preset'},
    el('option',{value:'',text:'Choose a starting point…'}),
    ...MS_BUILDER_PRESETS.map(([label],i)=>el('option',{value:String(i),text:label})));
  picker.onchange=()=>{
    if(picker.value==='')return;
    const settings=MS_BUILDER_PRESETS[Number(picker.value)][1];
    const weights=Object.fromEntries(MS_BUILDER_INPUTS.map(([key])=>[key,0]));
    msCommit();
    edit(r=>Object.assign(r.p,weights,{combine:'add',gradAxis:'up',directionAxis:'up',positionFrom:0,positionTo:1},settings));
    msCommit();
    renderMatEd(true);
  };
  return el('label',{class:'frow'},el('span',{text:'Preset'}),picker);
}
function msBuilderTone(p,edit){
  const picker=el('select',{id:'ms_builderInput','aria-label':'Tune input'},
    ...MS_BUILDER_INPUTS.map(([key,label])=>el('option',{value:key,text:label})));
  const controls=el('div',{class:'dlg-grid'});
  const draw=()=>{
    const key=picker.value,tone=p.inputTone?.[key]||{};
    const set=(field,value)=>edit(r=>{
      const inputs=r.p.inputTone||(r.p.inputTone={});
      (inputs[key]||(inputs[key]={}))[field]=value;
    });
    controls.replaceChildren(
      makeSlider({id:'ms_builderBalance',label:'Input balance',min:-1,max:1,step:.01,value:tone.balance??0,def:0,fmt:pct,onInput:v=>set('balance',v)}).el,
      makeSlider({id:'ms_builderContrast',label:'Input contrast',min:-1,max:1,numericMax:Infinity,step:.01,value:tone.contrast??0,def:0,fmt:pct,onInput:v=>set('contrast',v)}).el,
      chk('ms_builderInvert','Invert input',!!tone.invert,v=>set('invert',v)));
  };
  picker.onchange=draw;
  draw();
  return el('div',{class:'dlg-grid'},el('label',{class:'frow'},el('span',{text:'Tune input'}),picker),controls);
}
function pxfBox(L,r,modes){const m=pxfRowMode(r),g=seg(modes,m,v=>{msEdit(L,r,x=>{x.p.proj=v;delete x.p.tri;});renderMatEd(true);requestRender(true);},'Projection');g.classList.add('tight');g.id='ms_proj';
  return el('div',{class:'dlg-grid'},el('div',{class:'sub',text:'Projection'}),g,
    m==='planar'?el('div',{class:'chips'},chk('ms_rep','Repeat',r.p.rep!==false,v=>msEdit(L,r,x=>{x.p.rep=v;})),chk('ms_front','Front faces only',!!r.p.front,v=>msEdit(L,r,x=>{x.p.front=v;}))):null,
    pxfFields(()=>pxfOf(r.p),fn=>msEdit(L,r,x=>fn(pxfOf(x.p))),m,()=>renderMatEd(true)));}

/* ✦ › Anchor point: marks this layer's content so masks elsewhere can read it */
function cfxAddAnchor(L){if(!isLayer(L))return null;let row=null;const names=msAnchorNames();let nm=L.name,i=2;while(names.includes(nm))nm=L.name+' '+(i++);
  msRecord(L,'Add anchor point to “'+L.name+'”',()=>{row=msRow('anchorpt',{p:{name:nm}});L.cfx=L.cfx||[];L.cfx.push(row);L.editMask=false;});
  if(row){L.fxFold=false;msSelect(L,'c',row.id);}return row;}

/* (0.95.7, Kenn: "generators should take your own grunge textures") the generator's breakup can be a texture: any Textures item
   (photo grunge, mixed, generated, your own) or a picture dropped here; Breakup sets how strongly it eats into the mask */
function msGrungeBox(r,p,ed,S){const box=el('div',{class:'dlg-grid msgrunge',id:'msGrunge'});
  const name=el('span',{class:'note',id:'msGrungeName',text:p.gimg?p.gimg.name:'Built-in noise'});
  name._hpv=()=>p.gimg?{tex:p.gimg,name:p.gimg.name}:null;/* (0.97.1) hover shows the chosen grunge */
  const set=g=>{ed(x=>{x.p.gimg=g?{kind:g.kind,id:g.id,name:g.name}:null;});name.textContent=g?g.name:'Built-in noise';if(typeof renderMatEd==='function')renderMatEd(true);};
  const drop=el('div',{class:'fxddrop',id:'msGrungeDrop',tabindex:'0',title:'Drop a texture tile or a picture here to use it as the grunge'},el('b',{text:'Drop a grunge'}),el('small',{text:'a Textures tile or a picture, or click to browse'}));drop._texDrop=set;drop._hpv=name._hpv;
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');const tx0=e.dataTransfer.getData('text/gouache-texture');if(tx0){try{set(JSON.parse(tx0));return;}catch(er){}}fxdDropFiles(e.dataTransfer.files,set);});
  drop.addEventListener('click',async()=>{const fs=await pickFiles('image/*',false,'Pictures',['png','jpg','jpeg','webp','tga','bmp','tif','tiff']);if(fs&&fs.length)fxdDropFiles(fs,set);});
  box.append(el('div',{class:'sub',text:'Grunge'}),drop,el('div',{class:'chips'},el('button',{class:'btn sm',id:'msGrungePick',text:'Choose from Textures…',onclick:()=>fxdPickTexture(set)}),
    p.gimg?el('button',{class:'btn sm',id:'msGrungeClear',text:'Use built-in noise',onclick:()=>set(null)}):'',name));
  if(p.gimg)box.append(S('ms_gtile','Grunge tiling','gtile',.25,16,.05,v=>v.toFixed(2)+'×'),S('ms_grot','Grunge rotation','grot',0,360,1,v=>Math.round(v)+'°'),S('ms_gcon','Grunge contrast','gcon',-1,1,.01,v=>(v>0?'+':'')+Math.round(v*100)+'%'),S('ms_glev','Grunge level','glev',-1,1,.01,v=>(v>0?'+':'')+Math.round(v*100)+'%'),chk('ms_ginv','Invert grunge',!!p.ginv,v=>ed(x=>{x.p.ginv=v;})),
    el('p',{class:'note',text:'Breakup sets how strongly the grunge eats into the mask. With the World projection it is laid over the model from three sides, so it has no seams.'}));
  return box;}
