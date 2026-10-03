/* ================= Keyboard shortcuts =================
   Every menu command plus the tools and a few painting keys can be given a key (Edit › Keyboard shortcuts).
   The built-in keys are still handled where they always were; kbHandle() runs first and only steps in for keys
   the user changed: a new key runs its command, and a command's old key stops working once it has moved. */
const KB_EXTRA=[
  ['tool:pen','Pen','Tools','P',()=>setTool('pen')],['tool:path','Surface Path','Tools','',()=>setTool('path')],['tool:material','Material brush','Tools','',()=>setTool('material')],
  ['tool:brush','Brush','Tools','B',()=>setTool('brush')],['tool:erase','Eraser','Tools','E',()=>setTool('erase')],['tool:smudge','Blend / smudge','Tools','S',()=>setTool('smudge')],['tool:heal','Healing brush','Tools','J',()=>setTool('heal')],['tool:clone','Clone stamp','Tools','Y',()=>setTool('clone')],
  ['tool:liquify','Liquify','Tools','Ctrl+Shift+X',()=>setTool('liquify')],['tool:picker','Eyedropper','Tools','I',()=>setTool('picker')],['tool:hand','Hand','Tools','H',()=>setTool('hand')],['tool:move','Move','Tools','V',()=>setTool('move')],
  ['tool:gradient','Gradient / fill','Tools','G',()=>setTool(ui.fillKind||'gradient')],['tool:dodge','Dodge / burn','Tools','O',()=>setTool(ui.tonal||'dodge')],['tool:crop','Crop','Tools','C',()=>setTool('crop')],
  ['tool:text','Text','Tools','T',()=>setTool('text')],['tool:shape','Shape','Tools','U',()=>setTool('shape')],['tool:array','Array','Tools','',()=>setTool('array')],['tool:marquee','Marquee','Tools','M',()=>setTool('marquee')],['tool:lasso','Lasso','Tools','L',()=>setTool('lasso')],['tool:wand','Magic wand','Tools','W',()=>setTool('wand')],
  ['paint:lastBrush','Swap last two brushes','Painting','Shift+B',brushSwapLast],
  ['paint:smaller','Brush smaller','Painting','[',()=>kbBrushSize(-1)],['paint:bigger','Brush bigger','Painting',']',()=>kbBrushSize(1)],
  ['paint:swap','Swap colours','Painting','X',()=>swapColors()],['paint:reset','Black and white colours','Painting','D',()=>{ui.bg=[1,1,1];setFG([0,0,0]);}]];
function kbBrushSize(d){if(ui.tool==='liquify'){liqSetSetting('size',clamp(Math.round(liq.size*(d>0?1.15:1/1.15)+d),10,1500));return;}brush.size=clamp(Math.round(brush.size*(d>0?1.15:1/1.15)+d),1,brushMax());brushRememberSize();if(sizeSlider)sizeSlider.set(brush.size);refreshCursor();schedulePreview();}
/* Photoshop's keys where they differ from this app's (the rest already match) */
const KB_PHOTOSHOP={hueSat:'Ctrl+U',adjust:'',mergeVisible:'Ctrl+Shift+E',export:'Ctrl+Alt+Shift+W',imageSize:'Ctrl+Alt+I',canvasSize:'Ctrl+Alt+C',selFeather:'Shift+F6',new:'Ctrl+N','tool:smudge':''};
let kbCmds=null;
/* [id,label,group,default key,run] for everything that can have a key */
function kbCommands(){if(kbCmds)return kbCmds;kbCmds=[];const seen=new Set();
  for(const name in MENUS)for(const it of menuFlat(MENUS[name])){if(it==='-'||seen.has(it[1])||!actions[it[1]])continue;seen.add(it[1]);
    const key=it[2]&&!/click/i.test(it[2])?it[2]:'';kbCmds.push([it[1],it[0].replace(/…$/,'').replace(/\s*\(.*\)$/,''),name,key,()=>actions[it[1]]()]);}
  kbCmds.push(...KB_EXTRA);return kbCmds;}
let kbUser=(()=>{try{return JSON.parse(localStorage.getItem('gs.keys')||'{}');}catch(e){return {};}})();
function kbSave(){try{localStorage.setItem('gs.keys',JSON.stringify(kbUser));}catch(e){}refreshHints();}
const kbDefault=id=>{const c=kbCommands().find(c=>c[0]===id);return c?c[3]:'';};
const kbKeyOf=id=>id in kbUser?kbUser[id]:kbDefault(id);
/* "Ctrl+Shift+N" style name of a key press, or null for a lone modifier */
function kbCombo(e){let k=e.key;if(['Control','Shift','Alt','Meta'].includes(k))return null;
  if(/^Key[A-Z]$/.test(e.code))k=e.code.slice(3);else if(/^Digit\d$/.test(e.code))k=e.code.slice(5);
  else if(e.code==='BracketLeft')k='[';else if(e.code==='BracketRight')k=']';else if(k==='Delete')k='Del';else if(k===' ')k='Space';else if(k.length===1)k=k.toUpperCase();
  return (e.ctrlKey||e.metaKey?'Ctrl+':'')+(e.shiftKey?'Shift+':'')+(e.altKey?'Alt+':'')+k;}
function kbHandle(e){const combo=kbCombo(e);if(!combo)return false;
  let mine=Object.keys(kbUser).find(id=>kbUser[id]===combo);if(!mine&&typeof KB_AUTO!=='undefined')mine=KB_AUTO.find(id=>!(id in kbUser)&&kbDefault(id)===combo);
  if(!mine&&!Object.keys(kbUser).length)return false;
  if(mine){const c=kbCommands().find(c=>c[0]===mine);if(c){e.preventDefault();if(ui.mode==='anim'&&LAYER_ONLY.includes(mine)){toast('Layers are not used in Animation mode.');return true;}c[4]();return true;}}
  /* the built-in key of a command that was moved (or cleared) does nothing now */
  const moved=kbCommands().find(c=>c[3]===combo&&c[0] in kbUser&&kbUser[c[0]]!==combo);
  if(moved){e.preventDefault();return true;}
  return false;}
/* the editor's categories (0.25): menus and tools sorted into groups that are easier to scan */
const KB_CATS=[['tools-paint','Painting tools'],['tools-sel','Selection tools'],['tools-other','Other tools'],['brush','Brush and colour'],['File','Files'],['Edit','Edit and history'],['Image','Image and canvas'],['Maps','Maps'],['Layer','Layers'],['Select','Selections'],['Adjust','Adjustments'],['Filter','Filters'],['View','View and 3D'],['Window','Panels and workspaces']];
function kbCat(c){const id=c[0];if(id.startsWith('tool:')){const t=id.slice(5);return ['brush','erase','smudge','heal','clone','liquify','dodge','picker','gradient'].includes(t)?'tools-paint':['marquee','lasso','wand'].includes(t)?'tools-sel':'tools-other';}
  if(id.startsWith('paint:'))return 'brush';return KB_CATS.some(k=>k[0]===c[2])?c[2]:'Edit';}
function dlgKeys(){const list=el('div',{class:'kblist'}),search=el('input',{type:'search',placeholder:'Search all commands or keys',class:'kbsearch','aria-label':'Search commands'}),cats=el('div',{class:'kbcats',role:'tablist','aria-label':'Categories'});
  let capture=null,cat='all',pending=null;
  const used=()=>{const m=new Map();for(const c of kbCommands()){const k=kbKeyOf(c[0]);if(k)m.set(k,(m.get(k)||0)+1);}return m;};
  const drawCats=()=>{const n={all:kbCommands().length},clash=used();for(const c of kbCommands()){const k=kbCat(c);n[k]=(n[k]||0)+1;}
    cats.replaceChildren(...[['all','All'],...KB_CATS].filter(([k])=>n[k]).map(([k,l])=>el('button',{class:'kbcat'+(cat===k?' on':''),role:'tab','aria-selected':String(cat===k),'data-cat':k,onclick:()=>{cat=k;search.value='';drawCats();draw();}},el('span',{text:l}),el('small',{text:String(n[k])}))));
    if([...clash.values()].some(v=>v>1))cats.append(el('p',{class:'note kbwarn',text:'⚠ Some keys are used twice: those rows are marked.'}));};
  const draw=()=>{const q=search.value.trim().toLowerCase(),clash=used();list.replaceChildren();let group=null;
    const cmds=kbCommands().map(c=>[c,kbCat(c)]).filter(([c,k])=>q?(c[1].toLowerCase().includes(q)||c[2].toLowerCase().includes(q)||kbKeyOf(c[0]).toLowerCase().includes(q)):(cat==='all'||k===cat));
    cmds.sort((x,y)=>KB_CATS.findIndex(k=>k[0]===x[1])-KB_CATS.findIndex(k=>k[0]===y[1]));
    for(const [c,k0] of cmds){
      if(k0!==group){group=k0;list.append(el('div',{class:'sub',text:(KB_CATS.find(k=>k[0]===k0)||[0,k0])[1]}));}
      const k=kbKeyOf(c[0]),changed=c[0] in kbUser,twice=k&&clash.get(k)>1;
      const btn=el('button',{class:'btn sm kbkey'+(capture===c[0]?' on':''),text:capture===c[0]?'Press keys…':(k||'—'),title:'Click, then press the new key',onclick:()=>{capture=capture===c[0]?null:c[0];pending=null;draw();}});
      const clr=el('button',{class:'btn sm',text:'×',title:'Remove this key','aria-label':'Remove the key of '+c[1],onclick:()=>{kbUser[c[0]]='';kbSave();drawCats();draw();}});
      const rst=changed?el('button',{class:'btn sm',text:'↺',title:'Back to '+(c[3]||'no key'),'aria-label':'Reset '+c[1],onclick:()=>{delete kbUser[c[0]];kbSave();drawCats();draw();}}):null;
      list.append(el('div',{class:'kbrow'+(changed?' changed':'')+(twice?' clash':''),'data-id':c[0]},el('span',{text:(twice?'⚠ ':'')+c[1],title:twice?k+' is also used by another command':''}),el('span',{class:'kbbtns'},btn,k?clr:null,rst)));
      /* the key is taken: ask before moving it */
      if(pending&&pending.id===c[0])list.append(el('div',{class:'kbclash',id:'kbClash'},el('span',{text:pending.combo+' is used by “'+pending.other[1]+'”.'}),
        el('button',{class:'btn sm',id:'kbUseHere',text:'Use it here',onclick:()=>{kbUser[pending.other[0]]='';kbSet(pending.id,pending.combo);toast(pending.combo+' now runs “'+c[1]+'”; “'+pending.other[1]+'” has no key.');pending=null;kbSave();drawCats();draw();}}),
        el('button',{class:'btn sm',text:'Cancel',onclick:()=>{pending=null;draw();}})));}
    if(!list.children.length)list.append(el('p',{class:'note',text:'No command matches.'}));};
  const kbSet=(id,combo)=>{kbUser[id]=combo===kbDefault(id)?undefined:combo;if(kbUser[id]===undefined)delete kbUser[id];};
  const onKey=e=>{if(!capture)return;e.preventDefault();e.stopPropagation();if(e.key==='Escape'){capture=null;draw();return;}
    const combo=kbCombo(e);if(!combo)return;
    const other=kbCommands().find(c=>c[0]!==capture&&kbKeyOf(c[0])===combo);
    if(other){pending={id:capture,combo,other};capture=null;draw();return;}
    kbSet(capture,combo);capture=null;kbSave();drawCats();draw();};
  search.addEventListener('input',draw);
  const reset=el('button',{class:'btn',text:'Reset all',title:'Back to Gouache Studio’s own keys',onclick:()=>{kbUser={};kbSave();draw();toast('All keys are back to the defaults.');drawCats();}});
  const ps=el('button',{class:'btn',text:'Photoshop keys',title:'Keys as close to Photoshop’s as this app allows',onclick:()=>{kbUser=Object.assign({},KB_PHOTOSHOP);kbSave();drawCats();draw();toast('Photoshop-style keys set.');}});
  const exp=el('button',{class:'btn',text:'Save to file…',onclick:async()=>{const r=await deliver('Keyboard shortcuts.gskeys',new Blob([JSON.stringify({gouacheKeys:1,keys:kbUser},null,1)],{type:'application/json'}));toast(deliveredText(r,'Keys'));}});
  const imp=el('button',{class:'btn',text:'Load from file…',onclick:async()=>{const [f]=await pickFiles('.gskeys,.json',false,'Key sets',['gskeys','json']);if(!f)return;
    try{const j=JSON.parse(await f.text());if(!j||!j.keys||typeof j.keys!=='object')throw 0;kbUser={};for(const [id,k] of Object.entries(j.keys))if(typeof k==='string'&&kbCommands().some(c=>c[0]===id))kbUser[id]=k;kbSave();drawCats();draw();toast('Keys loaded from '+f.name+'.');}
    catch(e){toast('That file is not a key set saved by Gouache Studio.');}}});
  const body=el('div',{class:'kbdlg'},el('p',{class:'note',text:'Pick a category, or search. Click a key, then press the new one (Esc cancels). Keys you changed are highlighted.'}),search,el('div',{class:'kbmain'},cats,list),el('div',{class:'chips'},ps,exp,imp,reset));
  /* listen on the whole window while open: the button that was clicked is redrawn and loses focus */
  window.addEventListener('keydown',onKey,true);const off=()=>window.removeEventListener('keydown',onKey,true);drawCats();draw();
  openDialog({title:'Keyboard shortcuts',body,cancelLabel:'Close',onCancel:off});$('#modal .dialog').classList.add('kbwide');setTimeout(()=>search.focus(),0);}

/* the one-line reminder of the main keys at the bottom of the canvas (View › Shortcut hints) */
function refreshHints(){const h=$('#hint');if(!h)return;document.body.classList.toggle('nohints',!!prefs.hideHints);
  const K=id=>kbKeyOf(id),items=[[K('tool:brush'),'brush'],[K('tool:erase'),'eraser'],[K('tool:smudge'),'blend'],['Alt','pick color'],['Space','pan'],['','wheel zoom'],
    [[K('paint:smaller'),K('paint:bigger')].filter(Boolean).join(' '),'size'],[K('tool:move'),'move'],[K('tool:gradient'),'gradient'],[K('tool:dodge'),'dodge'],[K('freeTransform'),'transform'],[K('tool:crop'),'crop'],
    [[K('tool:marquee'),K('tool:lasso'),K('tool:wand')].filter(Boolean).join(' '),'select'],[K('quickMask'),'quick mask'],[K('tool:text'),'text'],[K('tile'),'tile'],[K('save'),'save']];
  h.replaceChildren();let first=true;for(const [k,t] of items){if(k===''&&t!=='wheel zoom')continue;if(!first)h.append(' · ');first=false;if(k)h.append(el('b',{text:k}),' ');h.append(t);}}
function toggleHints(){prefs.hideHints=!prefs.hideHints;savePrefs();refreshHints();toast(prefs.hideHints?'Shortcut hints hidden (View › Shortcut hints brings them back).':'Shortcut hints shown.');}
refreshHints();
