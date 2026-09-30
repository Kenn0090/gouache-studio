/* ================= Tool options bar =================
   The strip under the menus with the settings you change all the time: for painting tools size, opacity (or
   strength / exposure), flow, hardness, pen pressure, symmetry and the other maps the brush paints. Everything
   else stays in the Tool settings panel. */
let optSliders={};
const OPT_PAINT=['brush','erase','smudge','dodge','burn','heal','clone'];
function buildOptBar(){const bar=$('#optBar');if(!bar)return;bar.replaceChildren();optSliders={};
  const t=ui.tool,title=$('#brushTitle')?$('#brushTitle').textContent:'';
  const slim=ui.mode==='p3d'&&OPT_PAINT.includes(t);bar.classList.toggle('slim',slim);
  if(!slim)bar.append(el('span',{class:'optname',text:title||t}));
  if(!OPT_PAINT.includes(t)||ui.mode==='convert'){bar.append(el('span',{class:'optnote',text:'More settings in the Tool settings panel.'}),el('button',{class:'btn sm',text:'Tool settings',onclick:()=>showPanel('tool')}));return;}
  const sm=t==='smudge',tonal=t==='dodge'||t==='burn';
  if(typeof activePreset!=='undefined')bar.append(el('button',{class:'optpreset',title:'Pick a brush in the Brushes panel',onclick:()=>showPanel('brushes')},
    (()=>{const t=brush.tip;if(t&&t.canvas){/* the brush's own tip shape (0.26.1), not a plain dot */if(!t._url)try{t._url=t.canvas.toDataURL();}catch(e){t._url='';}
      if(t._url){const s=el('span',{class:'optdot tipimg'});s.style.webkitMaskImage=s.style.maskImage='url('+t._url+')';return s;}}
      return el('span',{class:'optdot'+(brush.tip?' tip':''),style:brush.hardness<.5&&!brush.tip?'opacity:.7;filter:blur(1px)':''});})(),el('span',{text:activePreset?activePreset.name:(brush.tip?brush.tip.name:'Custom')})));
  bar.append(el('span',{class:'optsep'}));
  const S=(key,label,min,max,step,fmt,map,get,set)=>{const sl=makeSlider({id:'ob_'+key,label,min,max,step,value:get?get():brush[key],fmt,map,onInput:v=>{if(set)set(v);else brush[key]=v;
      if(key==='size'){if(sizeSlider)sizeSlider.set(v);refreshCursor();}else{const s=document.getElementById({opacity:'bOp',flow:'bFlow',hardness:'bHard',strength:'bStr'}[key]);if(s){s.value=v;const o=s.nextSibling;if(o)o.textContent=fmt(v);}}
      if(!set)brushEdited();}});sl.el.classList.add('optslider');optSliders[key]={sl,get:get||(()=>brush[key])};bar.append(sl.el);};
  S('size','Size',0,1000,1,v=>Math.round(v)+'px',typeof sizeMap!=='undefined'?sizeMap:undefined);
  if(tonal)S('exposure','Exposure',.01,1,.01,pct,null,()=>ui.tonalExposure,v=>{ui.tonalExposure=v;});
  else if(sm)S('strength','Strength',0,1,.01,pct);else if(t!=='heal')S('opacity','Opacity',0,1,.01,pct);
  S('flow','Flow',.01,1,.01,pct);if(!brush.tip)S('hardness','Hardness',0,1,.01,pct);
  bar.append(el('span',{class:'optsep'}));
  const tg=(label,on,fn,title)=>el('button',{class:'optchip'+(on?' on':''),'aria-pressed':String(!!on),title:title||'',text:label,onclick:fn});
  if(t==='heal'){bar.append(tg('Spot',heal.mode==='spot',()=>{heal.mode='spot';healSave();buildBrushPanel();buildOptBar();healMarker();},'Paint over a flaw: clean texture from nearby'),
      tg('Healing',heal.mode==='source',()=>{heal.mode='source';healSave();buildBrushPanel();buildOptBar();healMarker();},'Alt+click where to copy from, then paint'));
    if(heal.mode==='source')bar.append(tg('Aligned',heal.aligned,()=>{heal.aligned=!heal.aligned;heal.off=null;healSave();buildOptBar();buildBrushPanel();},'The source moves along with each stroke'));
    bar.append(el('span',{class:'optsep'}));}
  if(t==='clone')bar.append(tg('Aligned',heal.aligned,()=>{heal.aligned=!heal.aligned;heal.off=null;healSave();buildOptBar();buildBrushPanel();},'The source moves along with each stroke'),el('span',{class:'optsep'}));
  if(slim){/* 3D Paint (0.37): only size, opacity, flow, hardness and what the brush paints; the rest is in the Brush tab */
    const pm=typeof mapBrushTargets==='function'?mapBrushTargets():[],cur=(typeof MAP_DEFS!=='undefined'&&MAP_DEFS[doc.map]?MAP_DEFS[doc.map].label:'Base colour');
    bar.append(el('span',{class:'optsep'}),tg('Paints: '+cur+(pm.length?' + '+pm.length:''),pm.length>0,()=>showPanel('tool'),'Which maps the brush paints, and every other brush setting (Brush tab)'));return;}
  bar.append(tg('Pressure: size',brush.pSize,()=>{brush.pSize=!brush.pSize;brushEdited();buildBrushPanel();},'Pen pressure changes the size'));
  const sy=el('select',{class:'optsel','aria-label':'Symmetry',title:'Symmetry'},...SYM_MODES.map(([k,l])=>el('option',{value:k,text:'Symmetry: '+l})));sy.value=ui.sym.mode;sy.onchange=()=>setSym(sy.value);bar.append(sy);
  const mb=typeof mapBrushTargets==='function'?mapBrushTargets():[];
  if(doc.maps.length>1&&(t==='brush'||t==='erase')&&ui.mode!=='anim')bar.append(tg(mb.length?'Also paints: '+mb.map(k=>MAP_DEFS[k].label).join(', '):'Also paint other maps…',mb.length>0,()=>showPanel('tool'),'Which other maps this brush paints (Tool settings)'));
  /* More: a second row with the settings you change now and then (spacing, smoothing, jitter, pressure…) */
  const more=optMore();bar.classList.toggle('more',more);
  bar.append(el('button',{class:'optchip optmore'+(more?' on':''),id:'obMore','aria-expanded':String(more),title:more?'Show fewer settings':'Show more brush settings',text:more?'Less ▴':'More ▾',onclick:()=>{optMore(!more);buildOptBar();if(typeof dkGrid==='function'&&dk.L)dkGrid();if(typeof resizeGL==='function'){resizeGL();fit();}}}));
  if(!more)return;
  bar.append(el('span',{class:'optbreak'}));
  const X=(key,label,min,max,step,fmt,id)=>{S(key,label,min,max,step,fmt);const o=optSliders[key];o.sl.el.querySelector('input').addEventListener('input',()=>{const s=document.getElementById(id);if(s){s.value=brush[key];const n=s.nextSibling;if(n)n.textContent=fmt(brush[key]);}});};
  X('spacing','Spacing',.01,1.5,.01,pct,'bSpace');X('smoothing','Smoothing',0,1,.01,pct,'bSmooth');X('lazy','Lazy mouse',0,200,1,v=>v?v+' px':'off','bLazy');X('grain','Grain',0,1,.01,pct,'bGrain');
  X('sizeJitter','Size jitter',0,1,.01,pct,'bSJ');X('angleJitter','Angle jitter',0,1,.01,pct,'bAJ');
  bar.append(el('span',{class:'optsep'}));
  bar.append(tg('Pressure: opacity',brush.pOpacity,()=>{brush.pOpacity=!brush.pOpacity;brushEdited();buildBrushPanel();},'Pen pressure changes the opacity'));
  if(!sm)bar.append(tg('Build-up',brush.buildup,()=>{brush.buildup=!brush.buildup;brushEdited();buildBrushPanel();},'Paint builds up while you hold the pen still'));
  if(brush.pSize)X('minSize','Min size',0,1,.01,pct,'bMin');}
function optMore(v){if(v===undefined){try{return localStorage.getItem('gs.optMore')==='1';}catch(e){return false;}}try{localStorage.setItem('gs.optMore',v?'1':'0');}catch(e){}return v;}
/* keep the bar's values in step when the brush changes elsewhere */
function optSync(){for(const k in optSliders){const o=optSliders[k];o.sl.set(o.get());}}
{const bbp=buildBrushPanel;buildBrushPanel=function(){bbp();buildOptBar();if(!OPT_PAINT.includes(ui.tool))dkActivate('tool');};const be=brushEdited;brushEdited=function(){be();optSync();};const rc=refreshCursor;refreshCursor=function(){rc();optSync();};}
