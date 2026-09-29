/* ================= Colour themes =================
   Presets and a custom theme made from five colours (Edit › Preferences). Everything else is worked out from those. */
const THEMES={
  dark:{name:'Dark',c:{ground:'#15171b',panel:'#1e2126',raise:'#282c32',text:'#e1e3e7',accent:'#e2a453'}},
  red:{name:'Dark red',c:{ground:'#15171b',panel:'#1e2126',raise:'#282c32',text:'#e1e3e7',accent:'#e05555'}},
  darker:{name:'Darker',c:{ground:'#0c0d10',panel:'#141619',raise:'#1d2024',text:'#dcdfe3',accent:'#e2a453'}},
  warm:{name:'Warm',c:{ground:'#1b1714',panel:'#25201b',raise:'#312a23',text:'#ece4da',accent:'#e0914a'}},
  light:{name:'Light',c:{ground:'#d4d8de',panel:'#f2f3f5',raise:'#e2e5ea',text:'#1d2126',accent:'#c7701c'}}};
/* the canvas area's colour, for the GPU (it clears the view to it) */
let themeGround=[21/255,23/255,27/255];
/* changes whenever the text or accent colour does (cached brush thumbnails are redrawn) */
const themeKey=()=>{const cs=document.documentElement.style;return cs.getPropertyValue('--text')+cs.getPropertyValue('--accent');};
const THEME_KEYS=[['ground','Background'],['panel','Panels'],['text','Text'],['raise','Highlight'],['accent','Accent']];
const hexRGB=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);};
const rgbHex=c=>'#'+c.map(v=>Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0')).join('');
const mixHex=(a,b,t)=>{const A=hexRGB(a),B=hexRGB(b);return rgbHex(A.map((v,i)=>v+(B[i]-v)*t));};
const lumHex=h=>{const c=hexRGB(h);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
/* the five colours of the theme in use */
function themeColors(){const t=prefs.theme||'dark';return t==='custom'&&prefs.customTheme?Object.assign({},THEMES.dark.c,prefs.customTheme):(THEMES[t]||THEMES.dark).c;}
function applyTheme(c){c=c||themeColors();const R=document.documentElement.style,light=lumHex(c.panel)>.5;
  const set=(k,v)=>R.setProperty('--'+k,v);
  set('ground',c.ground);set('panel',c.panel);set('raise',c.raise);set('text',c.text);set('accent',c.accent);
  set('line',mixHex(c.panel,c.text,light?.14:.1));set('line-2',mixHex(c.panel,c.text,light?.24:.16));
  set('muted',mixHex(c.text,c.panel,.38));set('faint',mixHex(c.text,c.panel,.58));
  const a=hexRGB(c.accent);set('accent-soft','rgba('+a.map(v=>Math.round(v*255)).join(',')+',.15)');set('accent-ink',lumHex(c.accent)>.45?mixHex(c.accent,'#000000',.88):'#ffffff');
  themeGround=hexRGB(c.ground);R.setProperty('color-scheme',light?'light':'dark');
  if(typeof renderLibrary==='function')renderLibrary();if(typeof requestRender==='function')requestRender(true);document.body.classList.toggle('lighttheme',light);try{dkPopSync();}catch(e){}}
/* the theme part of the Preferences dialog; returns {el, save(), cancel()} */
function themeSection(){let theme=prefs.theme||'dark',custom=Object.assign({},themeColors(),prefs.customTheme||{});
  const wrap=el('div',{});
  const draw=()=>{wrap.replaceChildren(el('div',{class:'seg themeseg'},...[...Object.keys(THEMES),'custom'].map(k=>{const c=k==='custom'?custom:THEMES[k].c;
      const b=el('button',{class:'segb','aria-pressed':String(theme===k),title:k==='custom'?'Your own colours':THEMES[k].name,onclick:()=>{theme=k;if(k==='custom')applyTheme(custom);else applyTheme(THEMES[k].c);draw();}},
        el('span',{class:'swatch',style:'background:linear-gradient(135deg,'+c.panel+' 50%,'+c.accent+' 50%)'}),el('span',{text:k==='custom'?'Custom':THEMES[k].name}));return b;})));
    if(theme==='custom'){const g=el('div',{class:'themecols'});
      for(const [k,label] of THEME_KEYS){const inp=el('input',{type:'color',value:custom[k],'aria-label':label});inp.addEventListener('input',()=>{custom[k]=inp.value;applyTheme(custom);});
        g.append(el('label',{class:'themecol'},inp,el('span',{text:label})));}
      const from=el('select',{'aria-label':'Start from a preset'},el('option',{value:'',text:'Start from…'}),...Object.keys(THEMES).map(k=>el('option',{value:k,text:THEMES[k].name})));
      from.onchange=()=>{if(!from.value)return;custom=Object.assign({},THEMES[from.value].c);applyTheme(custom);draw();};
      wrap.append(g,from);}
    /* 0.26.1: the shape of the interface, with any colours: rounded (as before) or sharp (square corners, flatter, minimal) */
    wrap.append(el('div',{class:'frow'},el('label',{text:'Shape'}),el('div',{class:'seg'},...[['round','Rounded'],['sharp','Sharp']].map(([k,n])=>el('button',{class:'segb',id:'thShape_'+k,'aria-pressed':String(shape===k),text:n,onclick:()=>{shape=k;applyShape(k);draw();}})))));};
  let shape=prefs.uiShape||'round';
  draw();
  return {el:wrap,save(){prefs.theme=theme;if(theme==='custom')prefs.customTheme=custom;prefs.uiShape=shape;applyTheme();applyShape();},cancel(){applyTheme();applyShape();}};}
function applyShape(k){document.body.classList.toggle('sharp',(k||prefs.uiShape)==='sharp');}
applyTheme();applyShape();
