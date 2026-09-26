/* ================= Text tool + fonts ================= */
const FONT_STACKS={'Sans':'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif','Serif':'Georgia,"Times New Roman",serif','Mono':'"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace','Instrument Sans':'"Instrument Sans",system-ui,sans-serif'};
const GFONTS=['Bangers','Cinzel','Lilita One','Press Start 2P','Pirata One','Caveat','Oswald','Fredoka'];
const userFonts=[];let gfontsLoaded=false;
function loadGFonts(){if(gfontsLoaded)return;gfontsLoaded=true;const fam=GFONTS.map(f=>'family='+f.replace(/ /g,'+')+(['Oswald','Cinzel','Fredoka','Caveat'].includes(f)?':wght@400;700':'')).join('&');
  document.head.append(el('link',{rel:'stylesheet',href:'https://fonts.googleapis.com/css2?'+fam+'&display=swap'}));}
function fontCss(n){return FONT_STACKS[n]||('"'+n+'",system-ui,sans-serif');}
function textFont(t){return (t.italic?'italic ':'')+(t.bold?700:400)+' '+t.size+'px '+fontCss(t.font);}
ui.textStyle={font:'Sans',size:72,bold:true,italic:false,align:'left',lineHeight:1.15,tracking:0,outline:0,outlineColor:[0,0,0]};
const cloneText=t=>{const c=JSON.parse(JSON.stringify(t));delete c.bbox;return c;};
const mctx=document.createElement('canvas').getContext('2d');
function layoutText(t){mctx.font=textFont(t);try{mctx.letterSpacing=(t.tracking||0)+'px';}catch(e){}
  const lines=String(t.content).split('\n'),widths=lines.map(l=>mctx.measureText(l).width),m=mctx.measureText('Hg');
  const asc=m.fontBoundingBoxAscent||t.size*.8,desc=m.fontBoundingBoxDescent||t.size*.25,lh=t.size*t.lineHeight,W=Math.max(1,...widths);
  const pad=Math.ceil((t.outline||0)+3),H=Math.ceil((lines.length-1)*lh+asc+desc);
  const left=t.align==='left'?t.x:t.align==='center'?t.x-W/2:t.x-W;
  return {lines,widths,asc,desc,lh,W,H,pad,bx:Math.floor(left)-pad,by:Math.floor(t.y)-pad,bw:Math.ceil(W)+pad*2,bh:H+pad*2,fx:left-Math.floor(left)};}
function ensureFont(t){const f=textFont(t);if(GFONTS.includes(t.font))loadGFonts();if(document.fonts.check(f,'Ag'))return Promise.resolve(false);return document.fonts.load(f,'Ag').then(()=>true).catch(()=>false);}
function renderText(L){const t=L.text;if(!t)return;
  if(!document.fonts.check(textFont(t),'Ag')||(GFONTS.includes(t.font)&&!gfontsLoaded)){const want=textFont(t);ensureFont(t).then(()=>{if(L.text&&textFont(L.text)===want){drawTextNow(L);positionEditor();}});}
  drawTextNow(L);}
function drawTextNow(L){const t=L.text,lay=layoutText(t);t.bbox=lay;clearTarget(L.target);
  if(String(t.content).trim()){const bw=Math.min(lay.bw,8192),bh=Math.min(lay.bh,8192),c=document.createElement('canvas');c.width=bw;c.height=bh;const x=c.getContext('2d');
    x.font=textFont(t);try{x.letterSpacing=(t.tracking||0)+'px';}catch(e){}x.textBaseline='alphabetic';x.lineJoin='round';x.miterLimit=2;
    lay.lines.forEach((ln,i)=>{const w=lay.widths[i],ox=lay.pad+lay.fx+(t.align==='left'?0:t.align==='center'?(lay.W-w)/2:lay.W-w),oy=lay.pad+lay.asc+i*lay.lh;
      if(t.outline>0){x.lineWidth=t.outline*2;x.strokeStyle=toHex(t.outlineColor||[0,0,0]);x.strokeText(ln,ox,oy);}});
    x.fillStyle=toHex(t.color||[1,1,1]);
    lay.lines.forEach((ln,i)=>{const w=lay.widths[i],ox=lay.pad+lay.fx+(t.align==='left'?0:t.align==='center'?(lay.W-w)/2:lay.W-w),oy=lay.pad+lay.asc+i*lay.lh;x.fillText(ln,ox,oy);});
    const d=x.getImageData(0,0,bw,bh);const tex=uploadStraight({w:bw,h:bh,data:d.data,bits:8});premultInto(L.target,tex,[lay.bx,lay.by],null);gl.deleteTexture(tex);}
  scheduleThumb(L);requestRender(true);}
function activeText(){return isLayer(doc.active)&&doc.active.text?doc.active:null;}
function hitText(x,y){const ls=allLayers();for(let i=ls.length-1;i>=0;i--){const L=ls[i];if(!L.text||!effVisible(L))continue;const b=L.text.bbox;if(b&&x>=b.bx&&x<=b.bx+b.bw&&y>=b.by&&y<=b.by+b.bh)return L;}return null;}
/* edit sessions (one undo step per edit) */
let tsess=null;
function textBegin(L){if(tsess&&tsess.L!==L)textCommit();if(!tsess)tsess={L,before:cloneText(L.text)};clearTimeout(tsess.timer);}
function textTouch(){if(!tsess||tedit)return;clearTimeout(tsess.timer);tsess.timer=setTimeout(textCommit,700);}
function textCommit(){const s=tsess;if(!s)return;tsess=null;clearTimeout(s.timer);const L=s.L;if(!L.text)return;const a=s.before,b=cloneText(L.text);
  if(JSON.stringify(a)===JSON.stringify(b))return;
  pushUndo({label:'Edit text',refs:[L],undo(){L.text=cloneText(a);renderText(L);},redo(){L.text=cloneText(b);renderText(L);}});renderLayers();}
function setTextProp(k,v){ui.textStyle[k]=Array.isArray(v)?v.slice():v;const L=activeText();if(!L)return;
  if(!(tedit&&tedit.isNew))textBegin(L);L.text[k]=Array.isArray(v)?v.slice():v;renderText(L);positionEditor();textTouch();}
/* on-canvas editor */
const ted=el('textarea',{class:'texted',spellcheck:'false','aria-label':'Text',wrap:'off'});ted.hidden=true;stage.append(ted);
let tedit=null;
function positionEditor(){if(!tedit||!tedit.L.text)return;const t=tedit.L.text,b=t.bbox||layoutText(t),z=view.zoom,half=(b.lh-(b.asc+b.desc))/2;
  Object.assign(ted.style,{left:(view.x+b.bx*z)+'px',top:(view.y+b.by*z)+'px',width:Math.max(b.bw,t.size*.8)*z+'px',height:(b.bh+b.lh*.2)*z+'px',
    paddingLeft:(b.pad+b.fx)*z+'px',paddingRight:b.pad*z+'px',paddingTop:Math.max(0,(b.pad-half)*z)+'px',paddingBottom:'0px',
    fontFamily:fontCss(t.font),fontSize:t.size*z+'px',fontWeight:t.bold?700:400,fontStyle:t.italic?'italic':'normal',lineHeight:b.lh*z+'px',letterSpacing:(t.tracking||0)*z+'px',textAlign:t.align});}
function openTextEditor(L,isNew,treeBefore){if(tedit)closeTextEditor();if(!isNew)textBegin(L);tedit={L,isNew,treeBefore};ted.value=L.text.content;ted.hidden=false;positionEditor();
  ted.focus();ted.setSelectionRange(ted.value.length,ted.value.length);if(ui.tool==='text')buildBrushPanel();}
function closeTextEditor(){const s=tedit;if(!s)return;tedit=null;ted.hidden=true;ted.blur();const L=s.L;
  if(s.isNew){if(!String(L.text.content).trim()){restoreTree(s.treeBefore);disposeLayer(L);changedAll();buildBrushPanel();return;}
    const before=s.treeBefore,after=snapTree();pushUndo({label:'Add text',refs:[...new Set([...layersOfSnap(before),...layersOfSnap(after)])],undo(){restoreTree(before);},redo(){restoreTree(after);}});}
  else textCommit();
  changedAll();if(ui.tool==='text')buildBrushPanel();}
ted.addEventListener('input',()=>{if(!tedit)return;const L=tedit.L;L.text.content=ted.value;if(L.autoName){L.name=(ted.value.split('\n')[0].trim().slice(0,28))||'Text';renderLayers();}renderText(L);positionEditor();});
ted.addEventListener('keydown',e=>{if(e.key==='Escape'||(e.key==='Enter'&&(e.ctrlKey||e.metaKey))){e.preventDefault();closeTextEditor();}e.stopPropagation();});
ted.addEventListener('pointerdown',e=>e.stopPropagation());
function createText(ix,iy){const before=snapTree(),L=newLayerObj('Text');L.autoName=true;
  const st=ui.textStyle;L.text=Object.assign(cloneText(st),{content:'',color:ui.fg.slice(),x:Math.round(ix),y:Math.round(iy-st.size*.8)});
  const [p,i]=insertPoint();insertNode(L,p,i);selectOnly(L);renderText(L);renderLayers();openTextEditor(L,true,before);}
function rasterizeText(L){if(!L||!L.text)return;if(tedit&&tedit.L===L)closeTextEditor();textCommit();const t=L.text;L.text=null;
  pushUndo({label:'Rasterize text',refs:[L],undo(){L.text=t;},redo(){L.text=null;}});renderLayers();if(ui.tool==='text')buildBrushPanel();}
/* user fonts */
async function addFontFile(file){const buf=await file.arrayBuffer();const base=baseName(file.name).replace(/[-_]+/g,' ').trim()||'Custom font';let n=base,k=2;
  while(userFonts.some(f=>f.name===n)||FONT_STACKS[n]||GFONTS.includes(n))n=base+' '+(k++);
  let face;try{face=new FontFace(n,buf.slice(0));await face.load();}catch(e){throw new Error('“'+file.name+'” could not be read as a font. Use a .ttf, .otf, .woff or .woff2 file.');}
  document.fonts.add(face);userFonts.push({name:n,face});store.put({name:n,data:buf},'fonts');
  toast('Added the font “'+n+'”.');setTextProp('font',n);if(ui.tool==='text')buildBrushPanel();}
function removeFont(n){const i=userFonts.findIndex(f=>f.name===n);if(i<0)return;try{document.fonts.delete(userFonts[i].face);}catch(e){}userFonts.splice(i,1);store.del(n,'fonts');toast('Removed “'+n+'”. Text already set in it keeps its pixels until you edit it.');}
async function loadSavedFonts(){try{const all=await store.all('fonts');for(const d of all||[]){try{const face=new FontFace(d.name,d.data);await face.load();document.fonts.add(face);userFonts.push({name:d.name,face});}catch(e){}}}catch(e){}}
/* font picker with hover preview */
const fontPop=el('div',{class:'modepop fontpop',role:'listbox','aria-label':'Fonts',hidden:true});document.body.append(fontPop);
let fontState=null;
function closeFontPop(commit){const st=fontState;if(!st)return;fontState=null;fontPop.hidden=true;
  if(st.L&&st.L.text){st.L.text.font=st.orig;if(commit==null)renderText(st.L);}
  if(commit!=null)setTextProp('font',commit);if(ui.tool==='text')buildBrushPanel();}
function openFontPop(anchor){if(fontState){closeFontPop();return;}loadGFonts();const L=activeText();fontState={L,orig:L?L.text.font:ui.textStyle.font};if(L&&!(tedit&&tedit.isNew))textBegin(L);
  const cur=fontState.orig,kids=[el('div',{class:'mhint',text:'Hover to preview on the selected text. Click to use.'})];
  const item=n=>{const b=el('button',{role:'option','aria-selected':String(n===cur),style:'font-family:'+fontCss(n)+';font-size:15px',text:n});
    b.addEventListener('mouseenter',()=>b.focus({preventScroll:true}));b.addEventListener('focus',()=>{if(fontState&&fontState.L&&fontState.L.text){fontState.L.text.font=n;renderText(fontState.L);positionEditor();}});
    b.addEventListener('click',()=>closeFontPop(n));return b;};
  kids.push(el('div',{class:'mg',text:'Built-in'}),...Object.keys(FONT_STACKS).map(item),el('div',{class:'mg',text:'Game fonts (Google Fonts)'}),...GFONTS.map(item),el('div',{class:'mg',text:'Your fonts'}));
  if(!userFonts.length)kids.push(el('div',{class:'mhint',style:'border:0',text:'None yet. Add a .ttf, .otf, .woff or .woff2 file.'}));
  for(const f of userFonts){const row=el('div',{class:'frow',style:'gap:4px;flex-wrap:nowrap'},item(f.name),el('button',{class:'xbtn','aria-label':'Remove '+f.name,title:'Remove font',text:'×',onclick:e=>{e.stopPropagation();removeFont(f.name);closeFontPop();}}));kids.push(row);}
  kids.push(el('button',{class:'addfont',text:'+ Add font file…',onclick:()=>{closeFontPop();pickFile('font');}}));
  fontPop.replaceChildren(...kids);fontPop.hidden=false;const r=anchor.getBoundingClientRect(),h=Math.min(window.innerHeight*.7,520);fontPop.style.maxHeight=h+'px';fontPop.style.width='240px';
  fontPop.style.left=Math.max(8,Math.min(r.left,window.innerWidth-248))+'px';const below=window.innerHeight-r.bottom-8;
  fontPop.style.top=(below>=Math.min(h,fontPop.scrollHeight)?r.bottom+4:Math.max(8,r.top-4-Math.min(h,fontPop.scrollHeight)))+'px';
  const sel=fontPop.querySelector('[aria-selected=true]');if(sel){sel.scrollIntoView({block:'center'});sel.focus({preventScroll:true});}}
fontPop.addEventListener('mouseleave',()=>{if(fontState&&fontState.L&&fontState.L.text){fontState.L.text.font=fontState.orig;renderText(fontState.L);positionEditor();}});
fontPop.addEventListener('keydown',e=>{const items=[...fontPop.querySelectorAll('button[role=option]')],i=items.indexOf(document.activeElement);
  if(e.key==='ArrowDown'){e.preventDefault();(items[i+1]||items[0]).focus();}else if(e.key==='ArrowUp'){e.preventDefault();(items[i-1]||items[items.length-1]).focus();}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeFontPop();}});
document.addEventListener('pointerdown',e=>{if(fontState&&!fontPop.contains(e.target)&&!(e.target.closest&&e.target.closest('#fontBtn')))closeFontPop();});
/* text options panel (replaces brush options while the Text tool is active) */
let textPanelFor=undefined;
function buildTextPanel(box){const L=activeText(),t=L?L.text:ui.textStyle;textPanelFor=L;
  const sw=c=>el('span',{class:'swatch',style:'background:'+toHex(c)});
  box.append(el('div',{class:'sub',text:L?(tedit&&tedit.L===L?'Typing. Esc or Ctrl+Enter to finish.':'Editing “'+L.name+'”. Click it on the canvas to type, drag it to move.'):'Click the canvas to add text. Click existing text to edit it, drag it to move.'}));
  const fb=el('button',{class:'modebtn',id:'fontBtn','aria-haspopup':'listbox',title:'Font (hover to preview)'},el('span',{text:t.font,style:'font-family:'+fontCss(t.font)+';font-size:14px'}));
  fb.insertAdjacentHTML('beforeend','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>');fb.addEventListener('click',()=>openFontPop(fb));
  box.append(fb,el('div',{class:'frow'},el('button',{class:'btn sm',text:'+ Add font file…',onclick:()=>pickFile('font')}),el('span',{class:'dim',text:userFonts.length?userFonts.length+' custom font'+(userFonts.length>1?'s':''):'.ttf .otf .woff .woff2'})));
  const S=(id,label,key,min,max,step,fmt,map)=>makeSlider({id,label,min,max,step,value:t[key],fmt,map,onInput:v=>setTextProp(key,v)});
  box.append(S('tSize','Size','size',0,1000,1,v=>v+'px',{to:v=>Math.round(Math.pow((v-4)/796,1/2)*1000),from:u=>Math.max(4,Math.round(4+796*Math.pow(u/1000,2)))}).el);
  box.append(el('div',{class:'chips'},chk('tBold','Bold',!!t.bold,v=>setTextProp('bold',v)),chk('tItal','Italic',!!t.italic,v=>setTextProp('italic',v))),
    segChips([['left','Left'],['center','Center'],['right','Right']],()=>(activeText()||{text:ui.textStyle}).text.align||ui.textStyle.align,v=>{
      const A=activeText();if(A&&A.text.bbox){const b=A.text.bbox,l=b.bx+b.pad+b.fx;A.text.x=v==='left'?l:v==='center'?l+b.W/2:l+b.W;}setTextProp('align',v);}),
    S('tLh','Line height','lineHeight',.7,3,.05,v=>v.toFixed(2)).el,S('tTr','Letter spacing','tracking',-20,100,1,v=>v+'px').el,
    el('div',{class:'frow'},sw(t.color||ui.fg),el('button',{class:'btn sm',text:'Use foreground color',onclick:()=>{setTextProp('color',ui.fg.slice());buildBrushPanel();}})),
    S('tOut','Outline','outline',0,40,1,v=>v+'px').el,
    el('div',{class:'frow'},sw(t.outlineColor||[0,0,0]),el('button',{class:'btn sm',text:'Use background color for outline',onclick:()=>{setTextProp('outlineColor',ui.bg.slice());buildBrushPanel();}})));
  if(L)box.append(el('div',{class:'frow'},el('button',{class:'btn sm',text:'Edit text',onclick:()=>openTextEditor(L,false)}),el('button',{class:'btn sm',text:'Rasterize',title:'Turn this text into ordinary pixels',onclick:()=>{rasterizeText(L);toast('Text converted to pixels.');}})));
  box.append(el('p',{class:'note',text:'Text layers stay editable. Painting, filters or merging turn them into pixels. PSD files save text layers as pixels.'}));}
