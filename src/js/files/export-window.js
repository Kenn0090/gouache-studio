/* ================= The Export window (0.98.1, Kenn) =================
   Kenn: "this tall menu is too much to look at … inviting and intuitive, like a mix of Substance Painter and Marmoset,
   and the game engine export as a tab". His choices: two columns (settings left, the texture sets and their files
   right), UV tiles as a grid in their real places with a size on each, the game engine on its own tab with big
   buttons, and always in view: preset / size / format / folder, which sets to export, the model, and how much will
   be written. Everything else folds away under More options.
   The export itself is unchanged (exportTextures in tex-export.js); this file is only the window. It adds four things
   to texCfg that the export reads: setOff {set name: true} (left out), setSz {set name: px}, tileSz {set name: {tile: px}}
   (a tile's own export size) and tileOff {set name: {tile: true}}. */
const xw=(()=>{const d={tab:'tex',more:false,fold:{}};try{Object.assign(d,JSON.parse(localStorage.getItem('gs.exportWin')||'{}'));}catch(e){}d.tab=d.tab==='eng'?'eng':'tex';return d;})();
const xwSave=()=>{try{localStorage.setItem('gs.exportWin',JSON.stringify({tab:xw.tab,more:xw.more}));}catch(e){}};
const XW_SIZES=[256,512,1024,2048,4096,8192];
const xwK=n=>n>=1024?(Math.round(n/102.4)/10)+'K':String(n);
/* the sets this window lists: the texture sets of 3D Paint, or the one document */
function xwSets(){if(ui.mode==='p3d'&&p3.sets)return p3.sets.map((S,i)=>({S,i,name:S.name,missing:!!S.missing})).filter(x=>!x.missing);return [{S:null,i:-1,name:doc.name||'Document'}];}
const xwSetOn=name=>!(texCfg.setOff&&texCfg.setOff[name]);
/* a set's UV tiles (more than one), or null */
function xwTiles(x){if(!x.S||ui.mode!=='p3d'||!p3.ua)return null;const m=p3Binding(x.S),B=m&&udimBox(m);return B&&B.tiles.length>1?{m,B}:null;}
/* the size a set's pictures are painted at, and the size they will be written at */
function xwSetPx(x){if(!x.S||x.i===p3.cur)return [doc.w,doc.h];const D=x.S.state&&x.S.state.doc;return D?[D.w,D.h]:[p3.size||doc.w,p3.size||doc.h];}
function xwOutPx(x){const pr=TEX_PRESETS[texCfg.preset],[w,h]=xwSetPx(x),s=(texCfg.setSz&&texCfg.setSz[x.name])||texCfg.size||0;let o=s||Math.max(w,h);if(pr&&pr.max)o=Math.min(o,pr.max);return o;}
function xwTilePaintPx(x,U,T){if(x.i===p3.cur)return udimTilePx(U.m,T);return udimNominal(U.m,T);}
function xwTileAutoPx(x,U,T){const s=(texCfg.setSz&&texCfg.setSz[x.name])||texCfg.size||0;return s?Math.max(1,Math.round(s*udimNominal(U.m,T)/(p3.size||s))):xwTilePaintPx(x,U,T);}
function xwTileOutPx(x,U,T){const ov=texCfg.tileSz&&texCfg.tileSz[x.name]&&texCfg.tileSz[x.name][T.id];return ov||xwTileAutoPx(x,U,T);}
const xwTileOn=(x,T)=>!(texCfg.tileOff&&texCfg.tileOff[x.name]&&texCfg.tileOff[x.name][T.id]);
/* the files of the live document's preset (other sets usually have the same maps; the count is an estimate for them) */
/* (0.98.4, Georgian: the map chips should be tick boxes) which maps each set writes: texCfg.fileOff[set][suffix]=true leaves one out */
const xwFileOff=(set,suffix)=>!!(texCfg.fileOff&&texCfg.fileOff[set]&&texCfg.fileOff[set][suffix]);
const xwOutsAllRaw=texOutputs;/* every map the preset could write for this document, ticked or not */
texOutputs=function(pr){const l=xwOutsAllRaw(pr),set=typeof texSetNow==='function'?texSetNow():'';return l.filter(o=>!xwFileOff(set,o.s));};
function xwOuts(){const pr=TEX_PRESETS[texCfg.preset];return pr?xwOutsAllRaw(pr):[];}
/* how many files and about how many megabytes */
function xwEstimate(){const outs=xwOuts(),png=texCfg.fmt==='png';let files=0,bytes=0;const add=(px,o)=>{const C=o.rgb==='normal'?3:o.grey?1:(o.ch?o.ch.length:4),b=o.grey==='height'&&texCfg.h16&&png?2:1;files++;bytes+=px*px*C*b*(png?.45:1);};
  const sets=xwSets().filter(x=>xwSetOn(x.name)&&(texCfg.allSets!==false||x.i<0||x.i===p3.cur));
  for(const x of sets){const U=xwTiles(x),outsX=outs.filter(o=>!xwFileOff(x.i<0?'':x.name,o.s));if(U){for(const T of U.B.tiles)if(xwTileOn(x,T))for(const o of outsX)add(xwTileOutPx(x,U,T),o);}else for(const o of outsX)add(xwOutPx(x),o);
    if(texCfg.meshMaps&&(x.i<0||x.i===p3.cur))for(const k of texMeshKeys())if(texMeshWanted(k)){const t=doc.meshMaps[k];files++;bytes+=(texCfg.size||t.w)*(texCfg.size||t.h)*3*(png?.45:1);}}
  if(mxHasModel()&&texCfg.model&&texCfg.model!=='none')files+=texCfg.model==='obj'?2:1;
  return {files,mb:bytes/1048576,sets:sets.length};}
function xwSel(id,opts,cur,set,label){const s=el('select',{id,'aria-label':label||id});for(const [v,l] of opts){const o=el('option',{value:String(v),text:l});if(String(v)===String(cur))o.selected=true;s.append(o);}s.addEventListener('change',()=>set(s.value));return s;}
const xwRow=(label,ctl,id)=>el('div',{class:'frow xwrow'},el('label',{text:label,for:id||ctl.id||undefined}),ctl);
/* ---- the right column: one card per texture set ---- */
function xwSetCard(x,redraw){const U=xwTiles(x),on=xwSetOn(x.name),pr=TEX_PRESETS[texCfg.preset],outs=xwOuts(),many=xwSets().length>1,
    fileBase=many&&texCfg.allSets!==false?(texCfg.name||'Texture')+'_'+x.name:(texCfg.name||'Texture'),key=x.i<0?'doc':String(x.i);
  const tick=el('input',{type:'checkbox',id:'xwSet_'+key,'aria-label':'Export '+x.name});tick.checked=on;tick.disabled=!many;
  tick.onchange=()=>{texCfg.setOff=texCfg.setOff||{};if(tick.checked)delete texCfg.setOff[x.name];else texCfg.setOff[x.name]=true;redraw();};
  const sizeOpts=[[0,'Same as Size'],...XW_SIZES.filter(s=>!pr.max||s<=pr.max).map(s=>[s,xwK(s)])];
  const head=el('div',{class:'xwsethead'},el('label',{class:'xwsetname',for:'xwSet_'+key},tick,el('b',{text:x.name})),
    U?el('span',{class:'xwbadge',id:'xwUd_'+key,title:'This set has UV tiles (UDIMs). Every map is written once for each tile, with the tile’s number in the file name.',text:'UV tiles: '+U.B.tiles.length+' · '+U.B.tiles.filter(T=>xwTileOn(x,T)).length+' file'+(U.B.tiles.filter(T=>xwTileOn(x,T)).length===1?'':'s')+' per map'})
     :el('span',{class:'xwpx',text:xwK(xwOutPx(x))}),
    U?null:xwSel('xwSetSz_'+key,sizeOpts,(texCfg.setSz&&texCfg.setSz[x.name])||0,v=>{texCfg.setSz=texCfg.setSz||{};if(+v)texCfg.setSz[x.name]=+v;else delete texCfg.setSz[x.name];redraw();},'Export size of '+x.name));
  const card=el('div',{class:'xwset'+(on?'':' off'),id:'xwCard_'+key},head);if(!on)return card;
  if(U){/* the tiles in their real places: column = u, row = v, the first row at the bottom as in a UV editor */
    const us=U.B.tiles.map(T=>T.u),vs=U.B.tiles.map(T=>T.v),u0=Math.min(...us),v0=Math.min(...vs),nu=Math.max(...us)-u0+1,nv=Math.max(...vs)-v0+1;
    const grid=el('div',{class:'xwtiles',id:'xwTiles_'+key,style:'grid-template-columns:repeat('+nu+',minmax(86px,118px))',role:'group','aria-label':'UV tiles of '+x.name});
    const setT=(T,px)=>{texCfg.tileSz=texCfg.tileSz||{};const o=texCfg.tileSz[x.name]=texCfg.tileSz[x.name]||{};if(px)o[T.id]=px;else delete o[T.id];};
    for(const T of U.B.tiles){const tOn=xwTileOn(x,T),painted=xwTilePaintPx(x,U,T),cur=(texCfg.tileSz&&texCfg.tileSz[x.name]&&texCfg.tileSz[x.name][T.id])||0;
      const tt=el('input',{type:'checkbox',id:'xwTileOn_'+key+'_'+T.id,'aria-label':'Export tile '+T.id});tt.checked=tOn;
      tt.onchange=()=>{texCfg.tileOff=texCfg.tileOff||{};const o=texCfg.tileOff[x.name]=texCfg.tileOff[x.name]||{};if(tt.checked)delete o[T.id];else o[T.id]=true;redraw();};
      const sz=xwSel('xwTile_'+key+'_'+T.id,[[0,'Auto · '+xwK(xwTileAutoPx(x,U,T))],...XW_SIZES.filter(s=>!pr.max||s<=pr.max).map(s=>[s,xwK(s)])],cur,v=>{setT(T,+v);redraw();},'Export size of tile '+T.id);
      sz.title='Size this tile is written at. Auto follows Size (painted at '+painted+' px). This only changes the exported picture, not your project.';sz.disabled=!tOn;
      grid.append(el('div',{class:'xwtile'+(tOn?'':' off'),style:'grid-column:'+(T.u-u0+1)+';grid-row:'+(nv-(T.v-v0)),id:'xwTileBox_'+key+'_'+T.id},el('label',{class:'xwtileno',for:tt.id},tt,el('b',{text:String(T.id)})),sz));}
    const all=xwSel('xwTilesAll_'+key,[['','All tiles…'],[0,'Auto'],...XW_SIZES.filter(s=>!pr.max||s<=pr.max).map(s=>[s,xwK(s)])],'',v=>{if(v==='')return;for(const T of U.B.tiles)setT(T,+v);redraw();},'Size of every tile of '+x.name);
    card.append(grid,el('div',{class:'xwtilesall'},all,el('span',{class:'note',text:'One picture per tile, named like '+pr.name(fileBase).replace('{s}',(outs[0]||{s:'BaseColor'}).s)+'.'+U.B.tiles[0].id+'.'+texCfg.fmt})));}
  /* the maps this set writes, as small chips (the full file name is the tip) */
  const chips=el('div',{class:'xwfiles',id:'xwFiles_'+key});
  for(const o of outs){const nm=pr.name(fileBase).replace('{s}',o.s),flip=texNormalFlip(pr),what=o.rgb==='normal'?'Normal ('+(flip?'DirectX':'OpenGL')+')':o.what;
    const fk=x.i<0?'':x.name,offF=xwFileOff(fk,o.s),cb=el('input',{type:'checkbox',id:'xwFile_'+key+'_'+o.s,'aria-label':'Export '+o.s+' for '+x.name});cb.checked=!offF;
    cb.onchange=()=>{texCfg.fileOff=texCfg.fileOff||{};const q=texCfg.fileOff[fk]=texCfg.fileOff[fk]||{};if(cb.checked)delete q[o.s];else q[o.s]=true;redraw();};
    chips.append(el('label',{class:'xwfile'+(offF?' off':''),title:(offF?'Not exported. Tick to export:\n':'')+(U?U.B.tiles.filter(T=>xwTileOn(x,T)).map(T=>nm+'.'+T.id+'.'+texCfg.fmt).join('\n'):nm+'.'+texCfg.fmt)+'\n'+what},cb,el('span',{class:'xwfile-t'},el('code',{text:o.s}),el('small',{text:what}))));}
  if(texCfg.meshMaps&&(x.i<0||x.i===p3.cur))for(const k of texMeshKeys())if(texMeshWanted(k))chips.append(el('span',{class:'xwfile baked',title:pr.name(fileBase).replace('{s}',meshExportSuffix(k))+'.'+texCfg.fmt},el('code',{text:meshExportSuffix(k)}),el('small',{text:'Baked · '+(P3_MESHMAP_NAMES[k]||k)})));
  card.append(chips);
  if(x.i<0&&doc.maps.length<2)card.append(el('p',{class:'note',text:'This document only has base colour. Add maps with Image › Document maps… to export roughness, metallic, height and normal too.'}));
  return card;}
/* ---- the left column of the Textures tab ---- */
function xwLeft(redraw){const sizes=[[0,'As painted'+(ui.mode==='p3d'?'':' ('+doc.w+' × '+doc.h+')')],...XW_SIZES.map(s=>[s,s>=1024?s+' ('+xwK(s)+')':String(s)])];
  const nameIn=el('input',{type:'text',id:'txName',value:texCfg.name,'aria-label':'Name of the files'});nameIn.addEventListener('input',()=>{texCfg.name=nameIn.value;redraw(true);});
  const out=[xwRow('Preset',xwSel('txPreset',texPresetsFor().map(([k,p])=>[k,p.label]),texCfg.preset,v=>{texCfg.preset=v;redraw();},'Preset')),
    el('div',{class:'chips xwpre'},el('button',{class:'btn sm',type:'button',id:'txNewPreset',text:'New preset…',title:'Your own files and channel packing',onclick:()=>{closeDialog();dlgTexPreset(texCfg.preset);}}),
      TEX_PRESETS[texCfg.preset].user?el('button',{class:'btn sm',type:'button',id:'txEditPreset',text:'Edit preset…',onclick:()=>{closeDialog();dlgTexPreset(texCfg.preset);}}):null),
    xwRow('Name',nameIn,'txName'),
    xwRow('Size',xwSel('txSize',sizes,texCfg.size,v=>{texCfg.size=+v;redraw();},'Size')),
    xwRow('Format',xwSel('txFmt',TEX_FORMATS,texCfg.fmt,v=>{texCfg.fmt=v;redraw();},'Format'))];
  if(mxHasModel())out.push(xwRow('Model',xwSel('txModel',[['none','No model'],['glb','.glb (textures inside)'],['obj','.obj + .mtl'],['fbx','.fbx (mesh + texture links)']],texCfg.model||'none',v=>{texCfg.model=v;redraw();},'Model')));
  if(platform.isDesktop&&!esActive()){const d=texCfg.dir||'';out.push(el('div',{class:'frow xwrow'},el('label',{text:'Folder'}),el('div',{class:'xwfolder'},el('span',{class:'xwdir',id:'xwDir',title:d,text:d||'Asked when you export'}),
    el('button',{class:'btn sm',type:'button',id:'xwFolder',text:d?'Change…':'Choose…',onclick:async()=>{const p=await platform.pickFolder();if(p){texCfg.dir=p;try{localStorage.setItem('gs.exportDir',p);}catch(e){}redraw();}}}))));}
  else if(esActive())out.push(el('div',{class:'frow xwrow'},el('label',{text:'Goes to'}),el('span',{class:'xwdir',id:'xwDir',text:(ES_TARGETS.find(t=>t[0]===es.to)||[0,''])[1]+(es.dirs[es.to]?' · '+es.dirs[es.to]:' (choose the project on the Game engine tab)')})));
  /* everything else */
  const more=el('details',{class:'xwmore',id:'xwMore'},el('summary',{text:'More options'}));more.open=!!xw.more;more.addEventListener('toggle',()=>{xw.more=more.open;xwSave();});
  const meshPick=el('div',{class:'chips',id:'txMeshPick'},...(texCfg.meshMaps?texMeshKeys().map(k=>chk('txMesh_'+k,P3_MESHMAP_NAMES[k]||k,!(texCfg.meshOff&&texCfg.meshOff[k]),v=>{texCfg.meshOff=texCfg.meshOff||{};texCfg.meshOff[k]=!v;redraw();})):[]));
  more.append(el('div',{class:'dlg-grid'},
    xwRow('Normal map',xwSel('txNrm',[['preset','Preset’s own'],['gl','OpenGL (green up)'],['dx','DirectX (green down)']],texCfg.normal,v=>{texCfg.normal=v;redraw();},'Normal map')),
    xwRow('Padding',xwSel('txPad',TEX_PAD_MODES,texCfg.pad||'none',v=>{texCfg.pad=v;},'Padding')),
    makeSlider({id:'txPadPx',label:'Dilation',min:0,max:128,step:1,value:texCfg.padPx??16,def:16,fmt:v=>Math.round(v)+' px',onInput:v=>{texCfg.padPx=Math.round(v);}}).el,
    el('p',{class:'note',id:'txPadNote',text:texPadAvail()?'Padding grows each UV island’s colours past its edges, so the engine shows no seams.':'Padding needs the model’s UVs: export from 3D Paint, or open the 3D view with your model.'}),
    chk('txH16','Height at 16 bits (PNG, TIFF)',texCfg.h16,v=>{texCfg.h16=v;redraw(true);}),
    chk('txPsd','Also each channel as a layered PSD',!!texCfg.psd,v=>{texCfg.psd=v;}),
    texMeshKeys().length?chk('txMeshMaps','Export baked maps ('+texMeshKeys().length+' in this set)',texCfg.meshMaps,v=>{texCfg.meshMaps=v;redraw();}):el('p',{class:'note',id:'txNoBaked',text:'This set has no baked maps yet.'}),meshPick,
    ...(mxHasModel()&&(texCfg.model==='obj'||texCfg.model==='fbx')?[xwRow('Up axis',xwSel('txUp',[['engine','Follow the engine (now '+(upEngine()==='z'?'Z':'Y')+' up)'],['y','Y up'],['z','Z up']],texCfg.up||'engine',v=>{texCfg.up=v;},'Up axis'))]:[])));
  out.push(more);return out.filter(Boolean);}
/* ---- the Game engine tab ---- */
const XW_ENG_ICON={none:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',blender:'<circle cx="13" cy="13" r="5"/><path d="M4 13h4M6 8l4 3M9 4l3 4"/>',unity:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',godot:'<rect x="4" y="6" width="16" height="13" rx="4"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><path d="M8 6V3M16 6V3"/>',unreal:'<circle cx="12" cy="12" r="9"/><path d="M9 8v6a3 3 0 0 0 6 0V8"/>',roblox:'<rect x="5" y="5" width="14" height="14" rx="1.5" transform="rotate(12 12 12)"/><rect x="10" y="10" width="4" height="4" transform="rotate(12 12 12)"/>'};
function xwEngine(redraw){if(!platform.isDesktop)return [el('p',{class:'note',id:'xwEngWeb',text:'Sending straight into Blender, Unity, Godot, Unreal or Roblox works in the desktop app. Here, export the textures and bring the files into your engine yourself; the Preset on the Textures tab names and packs them the way each engine expects.'})];
  const pick=to=>{es.to=to;es.warn='';esSave();if(to==='roblox'){texCfg.preset='roblox';texCfg.fmt='png';if(mxHasModel())texCfg.model='fbx';}
    else if(to!=='none'){const k={unity:'urp'}[to]||to;if(TEX_PRESETS[k]&&(TEX_PRESETS[k].wf||'metal')===(doc.workflow||'metal'))texCfg.preset=k;}
    if(esActive()&&mxHasModel()&&texCfg.model==='none')texCfg.model='glb';redraw();};
  const btns=el('div',{class:'xwengs',role:'radiogroup','aria-label':'Send to'},...ES_TARGETS.map(([v,l])=>{const b=el('button',{type:'button',class:'xweng'+((es.to||'none')===v?' on':''),id:'xwEng_'+v,role:'radio','aria-checked':String((es.to||'none')===v),onclick:()=>pick(v)});
    b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+(XW_ENG_ICON[v]||'')+'</svg>';b.append(el('span',{text:v==='none'?'Just save to a folder':l}));return b;}));
  /* the engine's own few settings: the same rows as before, without the old drop-down (kept, hidden, for scripts) */
  const rows=esRow(redraw),first=rows[0];if(first&&first.querySelector&&first.querySelector('#txSend'))first.hidden=true;
  return [el('p',{class:'note',text:'Send the export straight into a game engine or Blender. The Textures tab stays the same either way.'}),btns,
    es.to&&es.to!=='none'?el('div',{class:'xwengset dlg-grid',id:'xwEngSet'},...rows):el('div',{class:'xwengset dlg-grid',id:'xwEngSet'},first||'',el('p',{class:'note',text:'The files are saved to the folder on the Textures tab. Pick an engine above to have them arrive in its project, with materials set up.'}))];}
function dlgExportTextures(){if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  if(ui.mode==='anim'){toast('Switch to paint mode to export textures.');return;}
  if(!texCfg.name)texCfg.name=(doc.name||'Texture').replace(/\.[a-z0-9]+$/i,'');
  if(texCfg.dir===undefined){try{texCfg.dir=localStorage.getItem('gs.exportDir')||'';}catch(e){texCfg.dir='';}}
  if(!TEX_PRESETS[texCfg.preset]||(TEX_PRESETS[texCfg.preset].wf||'metal')!==(doc.workflow||'metal'))texCfg.preset=texPresetsFor()[0][0];
  xw.tab='tex';/* always opens on Textures: the tab's own label says when an engine is chosen */
  const body=el('div',{class:'xwin',id:'xwBody'}),foot=el('div',{class:'xwfoot',id:'xwFoot','aria-live':'polite'});
  const tabBtn=(k,l)=>el('button',{type:'button',class:'xwtab'+(xw.tab===k?' on':''),id:'xwTab_'+k,role:'tab','aria-selected':String(xw.tab===k),onclick:()=>{xw.tab=k;xwSave();redraw();}},l);
  const okText=()=>platform.isDesktop?(esActive()?'Export and send':'Export'):'Export';
  /* light = only the names and the estimate changed (typing the name must not rebuild the box being typed in) */
  const redraw=light=>{const est=xwEstimate();foot.textContent=est.files+' file'+(est.files===1?'':'s')+' · about '+(est.mb<10?est.mb.toFixed(1):Math.round(est.mb))+' MB'+(est.sets>1?' · '+est.sets+' texture sets':'');
    const right=el('div',{class:'xwright',id:'xwRight'},...xwSets().filter(x=>texCfg.allSets!==false||x.i<0||x.i===p3.cur).map(x=>xwSetCard(x,redraw)));
    if(light){const old=body.querySelector('#xwRight');if(old)old.replaceWith(right);return;}
    const engLabel=esActive()?'Game engine · '+(ES_TARGETS.find(t=>t[0]===es.to)||[0,''])[1]:'Game engine';
    const tabs=el('div',{class:'xwtabs',role:'tablist','aria-label':'Export'},tabBtn('tex','Textures'),tabBtn('eng',engLabel));
    const many=ui.mode==='p3d'&&xwSets().length>1;
    const left=el('div',{class:'xwleft dlg-grid',id:'xwLeft'},...(xw.tab==='eng'?xwEngine(redraw):[...xwLeft(redraw),
      many?chk('txAll','Every texture set',texCfg.allSets!==false,v=>{texCfg.allSets=v;redraw();}):'']));
    body.replaceChildren(tabs,el('div',{class:'xwcols'},left,el('div',{class:'xwside'},el('div',{class:'sub',text:many?'Texture sets':'Files'}),right,foot)));
    const ok=$('#dlgOk');if(ok&&dlg&&dlg.title==='Export textures')ok.textContent=okText();};
  redraw();
  openDialog({title:'Export textures',xwin:true,body,okLabel:okText(),onOk(){exportTextures();}});}
