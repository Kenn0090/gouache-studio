/* ================= Tool options bar =================
   The strip under the menus with the settings you change all the time: for painting tools size, opacity (or
   strength / exposure), flow, hardness, pen pressure, symmetry and the other maps the brush paints. Everything
   else stays in the Tool settings panel. */
let optSliders={};
const OPT_PAINT=['brush','erase','smudge','dodge','burn','heal','clone','material'];
function buildOptBar(){const bar=$('#optBar');if(!bar)return;bar.replaceChildren();bar.classList.remove('xfoptions');optSliders={};xfQuickFields=[];
  const t=ui.tool,title=$('#brushTitle')?$('#brushTitle').textContent:'';
  const slim=ui.mode==='p3d'&&OPT_PAINT.includes(t);bar.classList.toggle('slim',slim);
  if(!slim)bar.append(el('span',{class:'optname',text:title||t}));
  if(xf&&!xf.move){buildXfOptBar(bar);return;}
  if(t==='pen'||t==='path'){bar.append(el('button',{class:'btn sm',text:'New path',onclick:pathNewButton}),el('button',{class:'btn sm',text:'Finish path',onclick:pathFinish}),el('span',{class:'optnote',text:'Click points · drag for curves · Enter to finish'}),el('button',{class:'btn sm',text:'Path settings',onclick:()=>showPanel('tool')}));return;}
  if(t==='liquify'){buildLiquifyOpt(bar);return;}
  if(t==='move'||SEL_TOOLS.includes(t)){bar.append(el('button',{class:'btn sm',id:'ob_flip_h',text:'Flip horizontal',title:'Flip selected pixels left-right (Ctrl+Alt+H)',disabled:!doc.active||(t!=='move'&&!sel.active),onclick:()=>flipLayers(true)}),el('button',{class:'btn sm',id:'ob_flip_v',text:'Flip vertical',title:'Flip selected pixels top-bottom (Ctrl+Alt+V)',disabled:!doc.active||(t!=='move'&&!sel.active),onclick:()=>flipLayers(false)}));}
  if(!OPT_PAINT.includes(t)||ui.mode==='convert'){bar.append(el('span',{class:'optnote',text:'More settings in the Tool settings panel.'}),el('button',{class:'btn sm',text:'Tool settings',onclick:()=>showPanel('tool')}));return;}
  const sm=t==='smudge',tonal=t==='dodge'||t==='burn';
  if(typeof activePreset!=='undefined')bar.append(el('button',{class:'optpreset',title:'Pick a brush in the Brushes panel',onclick:()=>showPanel('brushes')},
    (()=>{const t=brush.tip;if(t&&t.canvas){/* the brush's own tip shape (0.26.1), not a plain dot */if(!t._url)try{t._url=t.canvas.toDataURL();}catch(e){t._url='';}
      if(t._url){const s=el('span',{class:'optdot tipimg'});s.style.webkitMaskImage=s.style.maskImage='url('+t._url+')';return s;}}
      return el('span',{class:'optdot'+(brush.tip?' tip':''),style:brush.hardness<.5&&!brush.tip?'opacity:.7;filter:blur(1px)':''});})(),el('span',{text:activePreset?activePreset.name:(brush.tip?brush.tip.name:'Custom')})));
  bar.append(el('span',{class:'optsep'}));
  const S=(key,label,min,max,step,fmt,map,get,set)=>{const sl=makeSlider({id:'ob_'+key,label,min,max,step,value:get?get():brush[key],fmt,map,onInput:v=>{if(set)set(v);else brush[key]=v;
      if(key==='size'){if(sizeSlider)sizeSlider.set(v);refreshCursor();}else{const s=document.getElementById({opacity:'bOp',flow:'bFlow',hardness:'bHard',strength:'bStr'}[key]);if(s){s.value=v;const o=s.nextSibling;if(o)o.textContent=fmt(v);}}
      if(!set)brushEdited(key);}});sl.el.classList.add('optslider');optSliders[key]={sl,get:get||(()=>brush[key])};bar.append(sl.el);};
  S('size','Size',0,1000,1,v=>Math.round(v)+'px',typeof sizeMap!=='undefined'?sizeMap:undefined);
  bar.append(brushDefaultSizeButton('ob_default_size'));
  if(tonal)S('exposure','Exposure',.01,1,.01,pct,null,()=>ui.tonalExposure,v=>{ui.tonalExposure=v;});
  else if(sm)S('strength','Strength',0,1,.01,pct);else S('opacity','Opacity',0,1,.01,pct);
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
{const bbp=buildBrushPanel;buildBrushPanel=function(){bbp();buildOptBar();if(!OPT_PAINT.includes(ui.tool))dkActivate('tool');};const be=brushEdited;brushEdited=function(key){be(key);optSync();};const rc=refreshCursor;refreshCursor=function(){rc();optSync();};}

/* Live transform controls above the canvas, kept in step with handle drags. */
let xfQuickFields=[];
function xfQuickSync(){const grid=$('#ob_xf_grid'),interp=$('#ob_xf_interp'),link=$('#ob_xf_link');if(grid&&xf&&xf.warp)grid.value=String(xf.warp.n);if(interp)interp.value=String(ui.xfInterp);if(link)link.checked=ui.xfLink;const v=xf&&!xf.warp?xfDecompose():null;for(const [k,e,scale] of xfQuickFields){e.disabled=!v;if(document.activeElement!==e)e.value=v?Number((v[k]*scale).toFixed(2)):'';}}
function buildXfOptBar(bar){bar.classList.add('xfoptions');
  const mode=el('select',{id:'ob_xf_mode',class:'optsel','aria-label':'Transform mode'});
  for(const [k,t] of [['free','Free transform'],['scale','Scale'],['rotate','Rotate'],['skew','Skew'],['shear','Shear'],['distort','Distort'],['perspective','Perspective'],['warp','Warp']])mode.append(el('option',{value:k,text:t,disabled:!!xf.warp&&k!=='warp'}));
  mode.value=xf.warp?'warp':xf.dragMode||'free';mode.onchange=()=>{if(!xf)return;if(mode.value==='warp'&&!xf.warp)warpInit(ui.warpN);xf.dragMode=mode.value;xfRender(false);buildBrushPanel();drawXfOverlay();};bar.append(mode);
  if(xf.warp){const grid=el('select',{id:'ob_xf_grid',class:'optsel','aria-label':'Warp grid size'},...[2,3,4,5,6,8].map(n=>el('option',{value:String(n),text:n+' × '+n})));grid.value=String(xf.warp.n);grid.onchange=()=>{ui.warpN=+grid.value;warpResize(ui.warpN);xfRender(false);drawXfOverlay();buildBrushPanel();};bar.append(el('label',{text:'Grid',for:grid.id}),grid,el('button',{class:'btn sm',text:'Reset warp',onclick:()=>{warpInit(ui.warpN);xfRender(false);drawXfOverlay();}}));}
  else{for(const [k,label,scale] of [['x','X',1],['y','Y',1],['sx','W %',100],['sy','H %',100],['ang','Angle °',1],['skew','Skew °',1]]){const e=el('input',{id:'ob_xf_'+k,type:'number',step:'any',class:'num xfquick','aria-label':'Transform '+label});e.onchange=()=>{const v=xf&&xfDecompose(),n=Number(e.value);if(!v||!Number.isFinite(n)||e.value==='')return;const old=v[k];v[k]=n/scale;if(ui.xfLink&&(k==='sx'||k==='sy')&&old){if(k==='sx')v.sy*=v[k]/old;else v.sx*=v[k]/old;}xfCompose(v);xfRender(false);drawXfOverlay();xfPanelSync();};xfQuickFields.push([k,e,scale]);bar.append(el('label',{class:'xfquicklabel',text:label,for:e.id}),e);}
    bar.append(chk('ob_xf_link','Link W/H',ui.xfLink,v=>{ui.xfLink=v;const e=$('#xfLink');if(e)e.checked=v;}));}
  const interp=el('select',{id:'ob_xf_interp',class:'optsel','aria-label':'Transform resampling'},...[['2','Smooth'],['1','Bilinear'],['0','Nearest']].map(([v,t])=>el('option',{value:v,text:t})));interp.value=String(ui.xfInterp);interp.onchange=()=>{ui.xfInterp=+interp.value;const e=$('#xfInterp');if(e)e.value=interp.value;xfRender(false);};
  bar.append(interp,el('button',{id:'ob_xf_apply',class:'btn sm primary',text:'Apply',onclick:xfCommit}),el('button',{id:'ob_xf_cancel',class:'btn sm',text:'Cancel',onclick:xfCancel}));xfQuickSync();}
