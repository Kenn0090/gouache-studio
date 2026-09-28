/* ================= Maps panel =================
   Lists the document's maps. Clicking one shows it and makes it the map that painting and
   filters change. Material shows every map lit together; Normal shows the normal built from height. */
const MAP_SWATCH={base:null,normal:'#8080ff',emis:'#000'};
function mapSwatch(k){const s=el('span',{class:'mswatch'});
  if(k==='nfinal')k='normal';if(k==='base')s.classList.add('rainbow');else if(k==='material')s.classList.add('mat');else if(MAP_SWATCH[k])s.style.background=MAP_SWATCH[k];
  else{const v=Math.round(mapDefault(k)[0]*255);s.style.background='rgb('+v+','+v+','+v+')';}return s;}
function refreshMapsUI(){if(typeof renderShading==="function")renderShading();const list=$("#mapList");if(!list)return;list.replaceChildren();const anim=ui.mode==='anim';
  const rows=doc.maps.map(k=>[k,MAP_DEFS[k].label]);
  if(doc.maps.length>1)rows.push(['material','Material (lit)']);
  if(doc.maps.includes('height')||doc.maps.includes('normal'))rows.push(['nfinal','Normal (final)']);
  rows.forEach(([k,label],i)=>{const on=doc.view===k,editing=k===doc.map,dis=anim&&k!=='base';
    const row=el('div',{class:'crow2 mrow'+(on?' on':'')+(dis?' dis':''),role:'option','aria-selected':String(on),tabindex:'0',title:dis?'Animation mode paints the base colour map only.':
      k==='material'?'See all maps together, lit. You keep painting '+MAP_DEFS[doc.map].label.toLowerCase()+'.':k==='nfinal'?'The normal map as exported: built from height plus any normal content. You keep painting '+MAP_DEFS[doc.map].label.toLowerCase()+'.':
      MAP_DEFS[k].noPaint?'Loaded normal detail. Painting here edits it directly; usually you paint Height instead.':'View and paint '+label.toLowerCase()+(MAP_DEFS[k].hint?'. '+MAP_DEFS[k].hint:'')},
      mapSwatch(k),el('div',{class:'lname',text:label}),editing&&!on?el('span',{class:'dim',text:'painting'}):null,i<9&&!dis?el('kbd',{text:'Shift+Alt+'+(i+1)}):null);
    const go=()=>{if(dis)return;setView(k);};
    row.addEventListener('click',go);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});list.append(row);});
  const ctl=$('#mapCtl');ctl.replaceChildren();
  if(doc.maps.includes('height')&&!anim)ctl.append(makeSlider({id:'nrmStr',label:'Bump',min:0,max:32,step:.5,value:doc.nrmStr,fmt:v=>v.toFixed(1),onInput:v=>{doc.nrmStr=v;if(doc.view==='material'||doc.view==='nfinal')requestRender(true);}}).el);
  if(doc.view==='material'&&!anim)ctl.append(
    makeSlider({id:'lAz',label:'Light angle',min:0,max:360,step:1,value:doc.light.az,fmt:v=>Math.round(v)+'°',onInput:v=>{doc.light.az=v;requestRender(true);}}).el,
    makeSlider({id:'lEl',label:'Light height',min:5,max:90,step:1,value:doc.light.el,fmt:v=>Math.round(v)+'°',onInput:v=>{doc.light.el=v;requestRender(true);}}).el);
  ctl.hidden=!ctl.children.length;
  $('#mapState').textContent=doc.maps.length>1?doc.maps.length+' maps':'';
  const st=$('#stMap');if(st){st.hidden=doc.maps.length<2;st.textContent='Map: '+MAP_DEFS[doc.map].label+(doc.view!==doc.map?' (viewing '+(doc.view==='material'?'material':'normal')+')':'');}
  if(typeof renderLayers==='function'&&doc.active)$('#lModeName').textContent=modeLabel(mapModeOf(doc.active,doc.map));}
function mapKeyNav(e){if(!(e.shiftKey&&e.altKey)||e.ctrlKey||e.metaKey)return false;const n=+e.code.replace('Digit','');if(!(n>=1&&n<=9))return false;
  const rows=[...doc.maps];if(doc.maps.length>1)rows.push('material');if(doc.maps.includes('height')||doc.maps.includes('normal'))rows.push('nfinal');
  const k=rows[n-1];if(!k)return false;e.preventDefault();if(ui.mode==='anim'&&k!=='base')return true;setView(k);return true;}
/* Maps dialog: choose which maps the document has and what unpainted areas default to */
function dlgMaps(){if(ui.mode==='anim'){toast('Switch to paint mode to change maps.');return;}
  const on=new Set(doc.maps),defs=Object.assign({},doc.mapDef),body=el('div',{class:'dlg-grid'});
  let wf=doc.workflow||'metal';const other=w=>WF_KEYS[w==='spec'?'metal':'spec'];
  const wfSeg=el('div',{class:'seg'});const drawWf=()=>wfSeg.replaceChildren(...[['metal','Metal/Rough'],['spec','Specular/Gloss']].map(([k,l])=>el('button',{class:'segb','aria-pressed':String(wf===k),text:l,onclick:()=>{
      if(wf===k)return;wf=k;for(const x of other(k))on.delete(x);for(const x of WF_KEYS[k])on.add(x);drawWf();draw();}})));drawWf();
  const tpl=el('div',{class:'chips'},...Object.entries({hand:'Hand-painted',pbr:'PBR'}).map(([t,l])=>el('button',{class:'chip',text:l,onclick:()=>{on.clear();MAP_TEMPLATES[t==='pbr'&&wf==='spec'?'pbrsg':t].forEach(k=>on.add(k));draw();}})));
  const box=el('div',{class:'dlg-grid'});
  const draw=()=>{box.replaceChildren(...MAP_ORDER.filter(k=>!other(wf).includes(k)).map(k=>{const D=MAP_DEFS[k];
    const c=chk('mp_'+k,D.label,on.has(k),v=>{if(v)on.add(k);else on.delete(k);draw();});if(k==='base'){c.querySelector('input').disabled=true;}
    const kids=[c];
    if((D.grey||k==='spec')&&D.def!=null&&on.has(k)){const s=makeSlider({id:'mpd_'+k,label:'Unpainted value',min:0,max:100,step:1,value:Math.round((defs[k]!=null?defs[k]:D.def)*100),fmt:v=>v+'%',onInput:v=>{defs[k]=v/100;}});kids.push(s.el);}
    if(k==='normal'&&on.has(k))kids.push(el('p',{class:'note',text:'Normal is built from Height automatically. Its own layer content is only for loaded normal detail.'}));
    return el('div',{class:'mapopt'},...kids);}));};draw();
  const gone=()=>doc.maps.filter(k=>!on.has(k)&&!(wf!==(doc.workflow||'metal')&&WF_KEYS[doc.workflow||'metal'].includes(k)));
  body.append(el('div',{class:'sub',text:'Workflow'}),wfSeg,el('p',{class:'note',text:'Specular/Gloss paints Diffuse, Specular (colour) and Glossiness instead of Base colour, Metallic and Roughness. Switching converts what you have; switching back can restore your layers.'}),el('div',{class:'sub',text:'Start from'}),tpl,box,el('p',{class:'note',text:'Removing a map discards what was painted in it (you can undo).'}));
  openDialog({title:'Document maps',body,okLabel:'Apply',onOk(){const g=gone();if(g.length&&!confirm('Remove '+g.map(k=>MAP_DEFS[k].label).join(', ')+'? What was painted there is discarded (Undo brings it back).'))return false;
    const apply=()=>{const keys=MAP_ORDER.filter(k=>on.has(k));const same=keys.join()===doc.maps.join()&&JSON.stringify(defs)===JSON.stringify(doc.mapDef);if(!same)setDocMaps(keys,'Document maps',defs);};
    if(wf!==(doc.workflow||'metal')){setTimeout(()=>wfAsk(wf,apply),0);return;}apply();}});}
$('#mapsBtn').addEventListener('click',dlgMaps);
if($('#stMap'))$('#stMap').addEventListener('click',()=>setView(doc.map));
