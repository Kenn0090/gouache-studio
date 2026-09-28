/* ================= Layer style dialog =================
   Layer › Layer style… (or the fx badge on a layer): drop shadow, outer glow, stroke, colour
   overlay, inner shadow, inner glow and bevel & emboss, all live on the layer (see look.js).
   Changes show on the canvas as you adjust them (Preview); OK keeps them as one undo step. */
function dlgLayerStyle(pick){const L=doc.active;if(!isLayer(L)||L.fx){toast('Select a layer to give it a style.');return;}
  const before=L.styles?JSON.parse(JSON.stringify(L.styles)):null,W=Object.assign(newStyles(),before?JSON.parse(JSON.stringify(before)):{});
  for(const k of STYLE_ORDER)W[k]=Object.assign(JSON.parse(JSON.stringify(STYLE_DEFS[k])),W[k]);for(const k of STYLE_ORDER)delete W[k].label;
  let cur=pick||STYLE_ORDER.find(k=>W[k].on)||'drop',live=prefs.livePreview;
  const apply=()=>{L.styles=live?JSON.parse(JSON.stringify(W)):before;L.lookVer=(L.lookVer||0)+1;requestRender(true);};
  const list=el('div',{class:'stylelist'}),pane=el('div',{class:'dlg-grid stylepane'});
  const drawList=()=>{list.replaceChildren(...STYLE_ORDER.map(k=>{const c=el('input',{type:'checkbox',id:'ls_'+k,'aria-label':STYLE_DEFS[k].label});c.checked=!!W[k].on;
      c.addEventListener('change',()=>{W[k].on=c.checked;if(c.checked){cur=k;drawPane();}drawList();apply();});
      const b=el('button',{class:'stylebtn'+(k===cur?' on':''),id:'lsb_'+k,text:STYLE_DEFS[k].label,onclick:()=>{cur=k;drawList();drawPane();}});return el('div',{class:'stylerow'},c,b);}));};
  const drawPane=()=>{const s=W[cur],set=(key,v)=>{s[key]=v;if(!s.on){s.on=true;drawList();}apply();};
    const S=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:s[key],fmt,onInput:v=>set(key,v)}).el;
    const C=(label,key)=>el('div',{class:'frow'},el('label',{text:label}),colourBtn('lsc_'+cur+'_'+key,()=>s[key],c=>set(key,c),label));
    const px=v=>v+' px',deg=v=>v+'°';
    pane.replaceChildren(el('div',{class:'sub',text:STYLE_DEFS[cur].label}));
    if(cur==='drop')pane.append(C('Colour','color'),S('lsOp','Opacity','opacity',0,1,.01,pct),S('lsAng','Angle','angle',0,360,1,deg),S('lsDist','Distance','dist',0,200,1,px),S('lsSize','Size','size',0,200,1,px),S('lsSpread','Spread','spread',0,1,.01,pct));
    if(cur==='outerGlow')pane.append(C('Colour','color'),S('lsOp','Opacity','opacity',0,1,.01,pct),S('lsSize','Size','size',0,200,1,px),S('lsSpread','Spread','spread',0,1,.01,pct));
    if(cur==='innerShadow')pane.append(C('Colour','color'),S('lsOp','Opacity','opacity',0,1,.01,pct),S('lsAng','Angle','angle',0,360,1,deg),S('lsDist','Distance','dist',0,200,1,px),S('lsSize','Size','size',0,200,1,px));
    if(cur==='innerGlow')pane.append(C('Colour','color'),S('lsOp','Opacity','opacity',0,1,.01,pct),S('lsSize','Size','size',0,200,1,px));
    const surf=()=>{const box=el('div',{class:'dlg-grid'});const d=()=>{box.replaceChildren(chk('lsSurf_'+cur,'Also set roughness and metallic here',!!s.surf,v=>{set('surf',v);d();}));
        if(s.surf)box.append(S('lsRough','Roughness','rough',0,1,.01,pct),S('lsMetal','Metallic','metal',0,1,.01,pct));};d();return box;};
    if(cur==='stroke')pane.append(C('Colour','color'),S('lsOp','Opacity','opacity',0,1,.01,pct),S('lsSize','Size','size',1,100,1,px),
      seg([['outside','Outside'],['inside','Inside'],['center','Centre']],s.pos||'outside',v=>set('pos',v),'Stroke position'),
      S('lsSH','Height','height',-1,1,.01,v=>(v>0?'+':'')+Math.round(v*100)+'%'),el('p',{class:'note',text:'Height raises (or sinks) the stroke in the Height map, so it shows as a rim on the model.'}),surf());
    if(cur==='overlay')pane.append(C('Colour','color'),S('lsOp','Opacity','opacity',0,1,.01,pct),surf());
    if(cur==='bevel'){const kind=seg([['inner','Inner'],['outer','Outer'],['emboss','Emboss']],s.kind||'inner',v=>set('kind',v),'Bevel kind');
      const prof=seg(BEVEL_PROFILES,s.profile||'round',v=>set('profile',v),'Bevel profile');prof.classList.add('themeseg');
      pane.append(kind,el('div',{class:'sub',text:'Profile'}),prof,S('lsSize','Size','size',1,200,1,px),S('lsDepth','Depth','depth',0,1,.01,pct),
        seg([['up','Raised'],['down','Sunken']],s.dir||'up',v=>set('dir',v),'Bevel direction'),
        el('p',{class:'note',text:'The bevel raises the Height map, so the normal and the 3D view follow. Shading also lights it in the colour, like Photoshop.'}),
        chk('lsShade','Shade the colour',s.shade!==false,v=>set('shade',v)),S('lsAng','Light angle','angle',0,360,1,deg),S('lsAlt','Light height','alt',5,90,1,deg),S('lsHi','Highlights','hi',0,1,.01,pct),S('lsLo','Shadows','lo',0,1,.01,pct));}};
  drawList();drawPane();
  const prev=previewChk('lsPrev',live,v=>{live=v;apply();});
  const clear=el('button',{class:'btn sm',text:'Clear all',onclick:()=>{for(const k of STYLE_ORDER)W[k].on=false;drawList();apply();}});
  const body=el('div',{class:'styledlg'},el('div',{},list,el('div',{class:'row wrap'},prev,clear)),pane);
  apply();
  openDialog({title:'Layer style: '+L.name,body,okLabel:'OK',wide:true,
    onCancel(){L.styles=before;L.lookVer=(L.lookVer||0)+1;requestRender(true);},
    onOk(){const after=STYLE_ORDER.some(k=>W[k].on)?JSON.parse(JSON.stringify(W)):null;L.styles=after;L.lookVer=(L.lookVer||0)+1;
      const need=[];if(after){if(after.bevel.on||(after.stroke.on&&after.stroke.height))need.push('height');if((after.stroke.on&&after.stroke.surf)||(after.overlay.on&&after.overlay.surf))need.push('rough','metal');}
      const missing=need.filter(k=>!doc.maps.includes(k)&&!(doc.workflow==='spec'&&(k==='rough'||k==='metal')));
      if(JSON.stringify(before)!==JSON.stringify(after))pushUndo({label:'Layer style',refs:[L],undo(){L.styles=before;L.lookVer++;renderLayers();},redo(){L.styles=after;L.lookVer++;renderLayers();}});
      if(missing.length){setDocMaps([...doc.maps,...missing],'Add maps for the layer style');toast('Added '+missing.map(k=>MAP_DEFS[k].label).join(' and ')+' for the style.');}
      changed(L);}});}
