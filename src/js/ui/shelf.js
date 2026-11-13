/* ================= The 3D Paint shelf, like Substance Painter's (0.96) =================
   Kenn: "work on the shelf in the 3D paint tab: similar to Painter, a little more, with some quick icons, and the brushes that work
   with 3D paint housed in their own category".
   Categories (each its own dock panel, in the shelf's list on the left): Brushes · Materials · Smart materials · Smart masks · Alphas ·
   Textures · Decals · Environments · Mesh maps · Tools · Projects.
   Every category with tiles gets the same quick bar: search, ★ favourites, 🕒 recent, tile size S/M/L, grid/list, then its own buttons.
   Tiles are the ordinary .mattile buttons of each panel: a MutationObserver gives each one a star, a key and the filters, so the
   panels keep rendering the way they always did. Favourites and recent items are remembered per computer (gs.shFav, gs.shRecent). */
const SH_SEC={shbrush:'#shBrushSec',mats:'#matSec',smats:'#smSec',smasks:'#smkSec',shalpha:'#shAlphaSec',textures:'#txSec',decals:'#dcSec',envs:'#envSec'};
const SH_BODY={shbrush:'shBrushBody',mats:'matBody',smats:'smBody',smasks:'smkBody',shalpha:'shAlphaBody',textures:'txBody',decals:'dcBody',envs:'envBody'};
const SH_KEY='gs.shelf96',SH_SIZES={s:44,m:64,l:104};
const shS=(()=>{let o={};try{o=JSON.parse(localStorage.getItem(SH_KEY)||'{}');}catch(e){}return Object.assign({size:'m',list:false,fav:false,recent:false,all:false},o);})();
const shQ={},shLoad=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]');}catch(e){return [];}};
let shFav=new Set(shLoad('gs.shFav')),shRecent=shLoad('gs.shRecent');
const shObs={},shDirty={smats:true,smasks:true,shbrush:true,shalpha:true};let shBusy=false;
function shSave(){try{localStorage.setItem(SH_KEY,JSON.stringify({size:shS.size,list:shS.list,fav:shS.fav,recent:shS.recent,all:shS.all}));localStorage.setItem('gs.shFav',JSON.stringify([...shFav]));localStorage.setItem('gs.shRecent',JSON.stringify(shRecent));}catch(e){}}
const shTw=()=>shS.list?30:(SH_SIZES[shS.size]||64);
const SH_ICO={star:'<path d="m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1z"/>',clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',grid:'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/>'};
const shSvg=p=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.innerHTML=p;return s;};
/* a tile's name and key */
function shName(t){for(const s of t.children){if(s.tagName==='SPAN'&&!s.classList.contains('sgbadge')&&!s.classList.contains('shstar')&&s.textContent.trim())return s.textContent.trim();}
  return ((t.getAttribute('aria-label')||t.title||'').split(':')[0]).trim();}
const shKeyOf=(cat,t)=>t.dataset.shkey||(cat+':'+shName(t));
const shIsFav=k=>shFav.has(k);
function shToggleFav(k){if(shFav.has(k))shFav.delete(k);else shFav.add(k);shSave();}
function shRecentAdd(k){shRecent=[k,...shRecent.filter(x=>x!==k)].slice(0,40);shSave();}
/* the quick bar of one category; `acts` = that category's own buttons */
function shBar(cat,acts){
  const q=el('input',{type:'search',class:'shq',id:'shq_'+cat,placeholder:'Search','aria-label':'Search '+cat,value:shQ[cat]||''});
  q.addEventListener('input',()=>{shQ[cat]=q.value;shApply(cat);});
  const tog=(key,ico,title)=>{const b=el('button',{type:'button',class:'shbtn',id:'sh_'+key+'_'+cat,title,'aria-label':title,'aria-pressed':String(!!shS[key])});b.append(shSvg(ico));
    b.onclick=()=>{shS[key]=!shS[key];shSave();shSyncBars();for(const c of Object.keys(SH_SEC))shApply(c);};return b;};
  const sizes=el('div',{class:'seg shsize','aria-label':'Tile size'},...[['s','S'],['m','M'],['l','L']].map(([k,l])=>el('button',{type:'button',class:'segb shsz','data-k':k,id:'shsz_'+k+'_'+cat,title:'Tile size '+l,text:l,onclick:()=>{shS.size=k;shS.list=false;shSave();shSyncBars();shResize();}})));
  const view=el('div',{class:'seg shview','aria-label':'View'},...[[false,'grid','Tiles'],[true,'list','List']].map(([v,ico,l])=>{const b=el('button',{type:'button',class:'segb shvw','data-v':String(v),id:'shvw_'+(v?'list':'grid')+'_'+cat,title:l+' view'});b.append(shSvg(SH_ICO[ico]));b.onclick=()=>{shS.list=v;shSave();shSyncBars();shResize();};return b;}));
  const bar=el('div',{class:'shbar',id:'shbar_'+cat},q,tog('fav',SH_ICO.star,'Favourites only (click the star on a tile)'),tog('recent',SH_ICO.clock,'Recently used only'),sizes,view,el('span',{class:'shgrow'}),...(acts||[]).filter(Boolean));
  bar._cat=cat;return bar;}
function shSyncBars(){for(const b of document.querySelectorAll('.shbar')){
  b.querySelectorAll('.shbtn').forEach(x=>{const k=x.id.split('_')[1];x.setAttribute('aria-pressed',String(!!shS[k]));x.classList.toggle('on',!!shS[k]);});
  b.querySelectorAll('.shsz').forEach(x=>{const on=!shS.list&&shS.size===x.dataset.k;x.setAttribute('aria-pressed',String(on));});
  b.querySelectorAll('.shvw').forEach(x=>{const on=(x.dataset.v==='true')===!!shS.list;x.setAttribute('aria-pressed',String(on));});}}
/* stars, keys and the filters on the tiles of one category */
function shApply(cat){const sec=document.querySelector(SH_SEC[cat]);if(!sec)return;shBusy=true;
  try{sec.style.setProperty('--tw',shTw()+'px');sec.classList.toggle('shlist',!!shS.list);
    const q=(shQ[cat]||'').trim().toLowerCase();
    for(const t of sec.querySelectorAll('.mattile')){const k=shKeyOf(cat,t);t.dataset.shkey=k;
      if(!t.querySelector(':scope>.shstar')){const s=el('span',{class:'shstar',role:'button',title:'Favourite','aria-label':'Favourite'});s.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();shToggleFav(t.dataset.shkey);shApply(cat);});s.addEventListener('pointerdown',e=>e.stopPropagation());t.append(s);}
      const fav=shIsFav(k),s=t.querySelector(':scope>.shstar');s.textContent=fav?'★':'☆';s.classList.toggle('on',fav);s.setAttribute('aria-pressed',String(fav));
      const w=t.closest('.matwrap')||t,nm=shName(t).toLowerCase();
      w.hidden=!!(q&&!nm.includes(q))||(shS.fav&&!fav)||(shS.recent&&!shRecent.includes(k));}
    /* a heading with nothing under it, and a note when the filters hide everything */
    for(const g of sec.querySelectorAll('.matgrid,.shgrid')){const any=[...g.children].some(c=>!c.hidden);g.previousElementSibling&&g.previousElementSibling.classList.contains('sub')&&(g.previousElementSibling.hidden=!any&&(!!q||shS.fav||shS.recent));}
  }finally{shBusy=false;const o=shObs[cat];if(o)o.takeRecords();}}
/* a new tile size: material previews are drawn at that size, so those categories are drawn again */
function shResize(){for(const c of Object.keys(SH_SEC))shApply(c);if(typeof renderMats==='function')renderMats();}
/* each category rendered the first time it is shown, and again after it changed while it was hidden */
const SH_RENDER={smats:()=>typeof renderSmartMats==='function'&&renderSmartMats(false),smasks:()=>typeof renderSmartMats==='function'&&renderSmartMats(true),shbrush:()=>shBrushRender(),shalpha:()=>shAlphaRender()};
function shVisible(cat){const s=document.querySelector(SH_SEC[cat]);return !!s&&ui.mode==='p3d'&&!s.classList.contains('dk-off')&&!!s.offsetParent;}
function shEnsure(){if(ui.mode!=='p3d')return;for(const c of Object.keys(shDirty)){if(shDirty[c]&&shVisible(c)){shDirty[c]=false;try{SH_RENDER[c]();}catch(e){console.error(e);}}}}
function shMarkDirty(cat){shDirty[cat]=true;shEnsure();}
/* the sections and bars, made once */
function shInit(){const mk=(id,hid,title,body)=>{const s=el('section',{class:'sec shsec',id,'aria-labelledby':hid},el('div',{class:'sec-h',id:hid},el('span',{text:title})),el('div',{id:body,class:'dlg-grid'}));return s;};
  const add=(pid,sec)=>{dkSecs[pid]=sec;};
  add('shbrush',mk('shBrushSec','hShBrush','Brushes','shBrushBody'));add('smats',mk('smSec','hSm','Smart materials','smBody'));add('smasks',mk('smkSec','hSmk','Smart masks','smkBody'));add('shalpha',mk('shAlphaSec','hShAlpha','Alphas','shAlphaBody'));
  const acts={mats:()=>[shMatActs()],shbrush:()=>[shBrushActs()]};
  /* the bars go between each section's title and its body */
  const park=()=>dk.park||document.body;
  for(const pid of ['shbrush','smats','smasks','shalpha'])park().append(dkSecs[pid]);
  for(const cat of Object.keys(SH_SEC)){const sec=dkSec(cat)||document.querySelector(SH_SEC[cat]);if(!sec)continue;sec.classList.add('shsec');
    const body=sec.querySelector('#'+SH_BODY[cat]);if(!body||sec.querySelector(':scope>.shbar'))continue;
    sec.insertBefore(shBar(cat,acts[cat]?acts[cat]():[]),body);
    const o=new MutationObserver(()=>{if(shBusy)return;requestAnimationFrame(()=>shApply(cat));});o.observe(body,{childList:true,subtree:true});shObs[cat]=o;
    /* a click or drag on a tile = used recently */
    const used=e=>{const t=e.target.closest&&e.target.closest('.mattile');if(t&&!e.target.closest('.shstar'))shRecentAdd(t.dataset.shkey||shKeyOf(cat,t));};
    body.addEventListener('click',used,true);body.addEventListener('dragstart',used,true);}
  shSyncBars();}
/* ---- the Brushes category: the brushes that work on the model ---- */
/* Presets that cannot work on a 3D model: they read paint already on the canvas (mixing, wet paint), draw a strip between two points
   (line blend, fans), lay lanes of colour, or drip. The Brushes category lists the rest (and every brush with "All brushes"). Smooth curves
   and similar finishing touches do not make a brush unusable. */
const SH_NO3D=['mix','lineBlend','fanFill','laneN','drip','dripAuto','endInk','wet'];/* tested on the model (0.96): these have no effect there, or paint nothing */
function shWorks3D(p){if(!p)return false;if(!['brush','erase','smudge','dodge','burn',undefined].includes(p.tool))return false;
  for(const k of SH_NO3D){const v=p[k];if(v&&v!==(BRUSH_DEFAULTS[k]||0))return false;}return true;}
function shBrushActs(){const a=el('div',{class:'seg shall','aria-label':'Which brushes'},...[[false,'3D brushes','Brushes that work on the model'],[true,'All brushes','Every brush, also the ones that need a flat canvas']].map(([v,l,t])=>el('button',{type:'button',class:'segb shallb','aria-pressed':String(!!shS.all===v),id:'shall_'+(v?'all':'3d'),title:t,text:l,onclick:()=>{shS.all=v;shSave();shDirty.shbrush=true;shEnsure();a.querySelectorAll('.shallb').forEach(x=>x.setAttribute('aria-pressed',String((x.id==='shall_all')===v)));}})));
  return el('span',{class:'shacts'},a,el('button',{class:'btn sm',id:'shSaveBrush',text:'Save brush',title:'Keep the current brush settings as a brush',onclick:()=>{const b=document.getElementById('saveBrushBtn');if(b)b.click();}}),el('button',{class:'btn sm',id:'shImportBrush',text:'Import…',title:'Import brushes (.abr, .brush, .brushset…)',onclick:()=>{const b=document.getElementById('abrBtn');if(b)b.click();}}),el('button',{class:'btn sm',id:'shMakeTip',text:'Make tip',title:'Make a brush tip from a picture',onclick:()=>{const b=document.getElementById('tipBtn');if(b)b.click();}}));}
/* Tip pictures are made the first time a tile scrolls into view: 300 brushes and 195 tips drawn at once would make every one of their tips (and stall the page) */
let shIO=null;
function shLazy(c,draw){c._draw=draw;if(typeof IntersectionObserver==='undefined'){draw(c);return c;}
  if(!shIO)shIO=new IntersectionObserver(es=>{for(const e of es){if(!e.isIntersecting)continue;shIO.unobserve(e.target);const c=e.target;try{c._draw(c);}catch(err){}c._draw=null;}},{rootMargin:'160px'});
  shIO.observe(c);return c;}
function shBrushTile(p){const c=el('canvas',{width:64,height:64,class:'shbtc'});shLazy(c,cv=>{const t=typeof themeKey==='function'?themeKey():'';if(p._shThumb&&p._shTheme===t){cv.getContext('2d').drawImage(p._shThumb,0,0);return;}const src=tileCanvas(p);p._shThumb=src;p._shTheme=t;cv.getContext('2d').drawImage(src,0,0);});
  const b=el('button',{type:'button',class:'mattile shbt'+(p===activePreset?' sel':''),title:p.name+(p.tool==='smudge'?' (blend)':'')+': click to paint with it','data-shkey':'shbrush:'+p.name,onclick:()=>applyPreset(p)},c,el('span',{text:p.name}));b._libDrag=['brush',p];b._preset=p;return b;}
function shBrushRender(){const box=document.getElementById('shBrushBody');if(!box)return;
  if(typeof library==='undefined')return;
  const keep=p=>shS.all||shWorks3D(p),parts=[];let n=0;
  const recent=(brushSession.recent||[]).filter(keep);
  if(recent.length)parts.push(el('div',{class:'sub',text:'Recent'}),el('div',{class:'matgrid shgrid',id:'shBrushRecent'},...recent.map(shBrushTile)));
  for(const set of library){const ps=set.presets.filter(keep);if(!ps.length)continue;n+=ps.length;parts.push(el('div',{class:'sub',text:(set.builtin?set.name:set.name)+' · '+ps.length}),el('div',{class:'matgrid shgrid'},...ps.map(shBrushTile)));}
  if(!n)parts.push(el('p',{class:'note',text:'No brushes match. Choose “All brushes” to see every brush.'}));
  parts.push(el('p',{class:'note',text:shS.all?'Every brush. Brushes that read paint already on the canvas (mixing, drips, line blend…) have no effect on the model.':'The brushes that work on the model. “All brushes” shows the rest, which need a flat canvas.'}));
  box.replaceChildren(...parts);}
function shBrushSync(){for(const b of document.querySelectorAll('#shBrushBody .shbt'))b.classList.toggle('sel',b._preset===activePreset);}
/* ---- the Alphas category: brush tips and stencils ---- */
function shAlphaRender(){const box=document.getElementById('shAlphaBody');if(!box||typeof tipCatalogue!=='function')return;
  const all=tipCatalogue(),groups=[];let last=null;
  for(const it of all){if(!last||last.name!==it.group){last={name:it.group,items:[]};groups.push(last);}last.items.push(it);}
  const cur=()=>brush.tip||null;
  const tile=it=>{const b=el('button',{type:'button',class:'mattile shat'+(cur()===it.tip?' sel':''),title:it.tip.name+': click to use it as the brush tip','data-shkey':'shalpha:'+it.tip.name,onclick:()=>{tipSet(it.tip);shAlphaMark();}},(()=>{const c=el('canvas',{width:56,height:56,class:'shtc'});shLazy(c,cv=>{cv.getContext('2d').drawImage(tipThumb(it.tip),0,0);});return c;})(),el('span',{text:it.tip.name}));b._tip=it.tip;return b;};
  box.replaceChildren(el('p',{class:'note',text:'Brush tips. Click one to paint with it; the brush keeps its other settings. Stencils are in Brushes › Stencils.'}),
    ...groups.flatMap(g=>[el('div',{class:'sub',text:g.name+' · '+g.items.length}),el('div',{class:'matgrid shgrid'},...g.items.map(tile))]));}
function shAlphaMark(){for(const b of document.querySelectorAll('#shAlphaBody .shat'))b.classList.toggle('sel',(b._tip||null)===(brush.tip||null));}

/* ---- Materials: the buttons sit in the quick bar ---- */
function shMatActs(){return el('span',{class:'shacts'},el('button',{class:'btn sm',id:'matNew',text:'New material…',title:'A new material layer, with the material editor',onclick:()=>cmdNewFillLayer()}),
  el('button',{class:'btn sm',id:'matPaint',text:'Paint material',disabled:matSel.kind!=='mat',onclick:()=>materialBrushUse(matSel.rec)}),
  el('button',{class:'btn sm',text:'Import…',title:'A .gmat file saved from Gouache Studio',onclick:matImport}),
  el('button',{class:'btn sm',id:'matFromTex',text:'From textures…',title:'Make a material from downloaded textures (a folder, images or a .zip)',onclick:()=>dlgMatFromTextures()}));}

/* the brush library changed what is active (or its recent list): the Brushes category follows. Safe to call during start-up, before this file's constants exist. */
function shBrushChanged(){try{if(shVisible('shbrush'))shBrushSync();else shDirty.shbrush=true;}catch(e){}}
