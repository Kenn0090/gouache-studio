/* ================= Brush tip picker (0.95) =================
   Kenn: "I should be able to switch brush tips for the tools and brushes, just in case I don't like the default."
   Any brush (and any tool that paints with a tip: Brush, Eraser, Blend, Mixing…) can take another tip without changing its other settings.
   Tips come from everywhere the app has them: the basic shapes, the art media, every brush pack and the tips you made or imported.
   "Original tip" puts back the tip the brush came with; "Round (no tip)" makes it a plain round brush. */
function tipCatalogue(){const seen=new Set(),out=[];
  const add=(group,t)=>{if(!t||typeof t!=='object'||!('w' in t)||!('name' in t)||seen.has(t))return;seen.add(t);out.push({group,tip:t});};
  if(typeof TIPS!=='undefined')for(const k in TIPS)add('Basic shapes',TIPS[k]);
  if(typeof ART_TIPS!=='undefined')for(const k in ART_TIPS)add('Art media',ART_TIPS[k]);
  if(typeof BP_TIPS!=='undefined')for(const k in BP_TIPS)add('Brush pack',BP_TIPS[k]);
  if(typeof WC_TIPS!=='undefined')for(const k in WC_TIPS)add('Watercolour',WC_TIPS[k]);
  if(typeof library!=='undefined')for(const lib of library){const g=lib.builtin?'Built-in brushes':lib.name||'Imported';for(const t of lib.tips||[])add(g,t);for(const p of lib.presets||[])add(g,p.tip);}
  return out;}
function tipSet(tip){const b=brush;
  if(activePreset&&activePreset.tip&&!b._tipOrig)b._tipOrig=activePreset.tip;
  else if(!b._tipOrig&&b.tip)b._tipOrig=b.tip;
  b.tip=tip||null;brushEdited();if(typeof buildBrushPanel==='function')buildBrushPanel();if(typeof buildOptBar==='function')buildOptBar();if(typeof refreshCursor==='function')refreshCursor();}
function tipThumb(tip){const c=document.createElement('canvas');c.width=c.height=56;const x=c.getContext('2d');
  try{const s=tip.canvas,k=Math.min(52/s.width,52/s.height);x.drawImage(s,(56-s.width*k)/2,(56-s.height*k)/2,s.width*k,s.height*k);}catch(e){}return c;}
function dlgTipPicker(){
  const all=tipCatalogue(),cur=()=>brush.tip||null;
  const q=el('input',{type:'search',id:'tipSearch',placeholder:'Search tips…','aria-label':'Search tips'}),grid=el('div',{class:'tipgrid',id:'tipGrid'});
  const marks=()=>{for(const b of grid.querySelectorAll('.tipcell'))b.classList.toggle('on',(b._tip||null)===cur());};
  const tile=(label,tip,thumb)=>{const b=el('button',{class:'tipcell',title:label,'aria-label':label,onclick:()=>{tipSet(tip);marks();}},thumb,el('span',{text:label}));b._tip=tip;return b;};
  let shown=0,list=[];
  const more=()=>{const end=Math.min(list.length,shown+60);for(;shown<end;shown++){const it=list[shown];if(it.head){grid.append(el('div',{class:'tipgroup',text:it.head}));continue;}grid.append(tile(it.tip.name,it.tip,tipThumb(it.tip)));}marks();if(shown<list.length)requestAnimationFrame(more);};
  const fill=()=>{grid.replaceChildren();const w=q.value.trim().toLowerCase();list=[];let last='';
    for(const it of all){if(w&&!it.tip.name.toLowerCase().includes(w)&&!it.group.toLowerCase().includes(w))continue;if(it.group!==last){list.push({head:it.group});last=it.group;}list.push(it);}
    const first=[];const round=el('span',{class:'tipround'});first.push(tile('Round (no tip)',null,round));
    if(brush._tipOrig)first.push(tile('Original tip: '+brush._tipOrig.name,brush._tipOrig,tipThumb(brush._tipOrig)));
    grid.append(...first);shown=0;more();};
  q.addEventListener('input',fill);fill();
  openDialog({title:'Brush tip',resizable:true,body:el('div',{class:'tippick'},el('p',{class:'note',text:'Pick a tip for this brush. Its other settings stay as they are. Make your own tips with Make tip.'}),q,grid),okLabel:'Close',cancelLabel:' ',onOk(){}});}
