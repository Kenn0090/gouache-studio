/* ================= Customise the top bar (0.92, Kenn) =================
   Choose what shows in the top row and the tool options row. Three presets (Minimal, Balanced, All) and a tick list.
   Right-click either bar, or use the ⚙ at the top right. The Timelapse recorder starts switched off and can sit
   at the top or the bottom of the canvas. Also: any label cut short with "…" shows its full text when you hover it. */
const BAR_TOP=[['tile','Tile mode'],['ws','Panel layout list'],['doc','Document name']];
const BAR_OPT=[['preset','Brush name'],['size','Size'],['defsize','Default size button'],['opacity','Opacity / strength / exposure'],['flow','Flow'],['hardness','Hardness'],['sym','Symmetry'],['pSize','Pressure: size'],['alsoMaps','Also paint other maps'],
  ['spacing','Spacing (More row)'],['smoothing','Smoothing (More row)'],['lazy','Lazy mouse (More row)'],['grain','Grain (More row)'],['sizeJitter','Size jitter (More row)'],['angleJitter','Angle jitter (More row)'],['pOpacity','Pressure: opacity (More row)'],['pFlow','Pressure: flow (More row)'],['buildup','Build-up (More row)'],['minSize','Min size (More row)']];
const BAR_MORE=['spacing','smoothing','lazy','grain','sizeJitter','angleJitter','pOpacity','pFlow','buildup','minSize'];
/* what Photoshop, Procreate and Clip Studio Paint all keep within reach: size, opacity, flow, hardness, smoothing, symmetry, pen pressure */
const BAR_PRESETS={
  minimal:{name:'Minimal',hide:['tile','ws','defsize','hardness','sym','pSize','alsoMaps',...BAR_MORE],tl:'off'},
  balanced:{name:'Balanced',hide:['tile','defsize','alsoMaps','spacing','lazy','grain','sizeJitter','angleJitter','pOpacity','pFlow','buildup','minSize'],tl:'off'},
  all:{name:'All',hide:[],tl:'top'}};
let barCfg=(()=>{try{const s=JSON.parse(localStorage.getItem('gs.bar')||'null');if(s&&Array.isArray(s.hide))return s;}catch(e){}return {preset:'custom',hide:[],tl:'off'};})();
function barSave(){try{localStorage.setItem('gs.bar',JSON.stringify(barCfg));}catch(e){}}
function barKeyOf(c){if(c.classList.contains('optpreset'))return 'preset';if(c.id==='ob_default_size')return 'defsize';
  const id=c.id||(c.querySelector('[id]')||{}).id||'';if(/^ob_/.test(id)){const k=id.slice(3);return BAR_OPT.some(o=>o[0]===k)?k:(k==='strength'||k==='exposure'?'opacity':'');}
  const t=(c.textContent||'').trim();if(c.matches('select')&&c.getAttribute('aria-label')==='Symmetry')return 'sym';
  if(/^Pressure: size/.test(t))return 'pSize';if(/^Pressure: opacity/.test(t))return 'pOpacity';if(/^Pressure: flow/.test(t))return 'pFlow';if(/^Build-up/.test(t))return 'buildup';if(/^Also paint/.test(t))return 'alsoMaps';return '';}
function barApply(){const h=new Set(barCfg.hide);
  for(const c of document.querySelectorAll('#optBar > *')){const k=barKeyOf(c);c.classList.toggle('bar-off',!!k&&h.has(k));}
  for(const [k,sel] of [['tile','#tileBtn'],['ws','#wsSel'],['doc','#docName']]){const e=document.querySelector(sel);if(e)e.classList.toggle('bar-off',h.has(k));}
  const t=document.getElementById('tlBar');if(t){const w=document.getElementById('workWrap'),m=document.getElementById('menus');
    t.classList.toggle('bar-off',barCfg.tl==='off');t.classList.toggle('tlbottom',barCfg.tl==='bottom');
    if(barCfg.tl==='bottom'&&w&&t.parentNode!==w)w.append(t);else if(barCfg.tl!=='bottom'&&m&&t.parentNode!==m.parentNode)m.after(t);}}
{const b=buildOptBar;buildOptBar=function(){b.apply(this,arguments);barApply();};}
function barPreset(k){const p=BAR_PRESETS[k];barCfg={preset:k,hide:p.hide.slice(),tl:p.tl};barSave();barApply();if(document.querySelector('.barpop'))barPop(true);}
function barPop(keep){document.querySelector('.barpop')?.remove();const pop=el('div',{class:'barpop',role:'dialog','aria-label':'Customise the top bar'});
  const row=(k,label)=>{const c=el('input',{type:'checkbox',id:'bc_'+k});c.checked=!barCfg.hide.includes(k);c.onchange=()=>{barCfg.hide=barCfg.hide.filter(x=>x!==k);if(!c.checked)barCfg.hide.push(k);barCfg.preset='custom';barSave();barApply();syncPre();};return el('label',{class:'barrow'},c,el('span',{text:label}));};
  const pre=el('div',{class:'barpre'}),syncPre=()=>pre.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.k===barCfg.preset));
  for(const k in BAR_PRESETS)pre.append(el('button',{class:'btn sm',type:'button','data-k':k,text:BAR_PRESETS[k].name,title:{minimal:'Just size, opacity, flow and the brush name',balanced:'What Photoshop, Procreate and Clip Studio Paint keep in reach',all:'Everything, including the Timelapse recorder'}[k],onclick:()=>barPreset(k)}));
  const tl=el('select',{id:'bc_tl','aria-label':'Timelapse recorder'},...[['off','Timelapse: off'],['top','Timelapse: top of the window'],['bottom','Timelapse: bottom of the canvas']].map(([v,t])=>el('option',{value:v,text:t})));tl.value=barCfg.tl;tl.onchange=()=>{barCfg.tl=tl.value;barCfg.preset='custom';barSave();barApply();syncPre();};
  pop.append(el('div',{class:'barh',text:'Customise the top bar'}),pre,el('div',{class:'barsub',text:'Top row'}),...BAR_TOP.map(([k,l])=>row(k,l)),tl,el('div',{class:'barsub',text:'Tool options'}),...BAR_OPT.map(([k,l])=>row(k,l)),
    el('div',{class:'frow'},el('button',{class:'btn sm',type:'button',text:'Close',onclick:()=>pop.remove()})));
  syncPre();document.body.append(pop);const anchor=document.getElementById('barCust');
  if(!keep&&anchor){const r=anchor.getBoundingClientRect();pop.style.right=Math.max(8,innerWidth-r.right)+'px';pop.style.top=(r.bottom+6)+'px';}else{pop.style.right='12px';pop.style.top='44px';}
  if(!keep)setTimeout(()=>{const off=e=>{if(!pop.contains(e.target)&&e.target.id!=='barCust'){pop.remove();window.removeEventListener('pointerdown',off,true);}};window.addEventListener('pointerdown',off,true);},0);}
(function(){const go=()=>{const r=document.querySelector('.bar-r');if(r&&!document.getElementById('barCust'))r.prepend(el('button',{id:'barCust',type:'button',class:'btn sm',text:'⚙','aria-label':'Customise the top bar',title:'Customise the top bar: choose what shows, or pick Minimal, Balanced or All',onclick:()=>{const o=document.querySelector('.barpop');if(o)o.remove();else barPop(false);}}));
    for(const sel of ['.bar','#optBar','#tlBar'])document.addEventListener('contextmenu',e=>{const t=e.target.closest(sel);if(!t||e.target.closest('input,textarea'))return;if(sel==='.bar'&&e.target.closest('#menus .mi,.tabs'))return;e.preventDefault();barPop(false);},true);
    barApply();};
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',go);else setTimeout(go,0);})();
/* a label that is cut short by "…" shows all of its text when you hover it */
document.addEventListener('mouseover',e=>{let n=e.target;for(let i=0;n&&n.nodeType===1&&i<4;i++,n=n.parentElement){if(n.title||n.matches('input,textarea,canvas,svg'))return;
  if(n.scrollWidth>n.clientWidth+1&&n.clientWidth>0){const cs=getComputedStyle(n);if(cs.textOverflow==='ellipsis'){const t=(n.textContent||'').trim();if(t){n.title=t;n.dataset.autoTip='1';}return;}}}},true);
document.addEventListener('mouseout',e=>{const n=e.target;if(n&&n.dataset&&n.dataset.autoTip){n.removeAttribute('title');delete n.dataset.autoTip;}},true);
