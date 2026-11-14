/* ================= Generator settings in cards, like Marmoset's layer settings (0.97.24, Kenn: "the inputs should be near their sliders") =================
   The generator editor used to be one long list: Breakup at the top, its grunge at the bottom; edge sliders far from the Edges grunge.
   After the editor is built, its parts are moved into titled cards: Mask, Edges, Cavities, Top and flat surfaces, Breakup and
   Projection, each with its grunge slot (and that slot's own Tiling / Rotation / Contrast / Level controls) next to the sliders it
   works with. Anything not listed stays where it was, at the top. A card folds by its title; the fold is remembered. */
const MSC_FOLD_KEY='gs.msCards';
function mscFolds(){try{return JSON.parse(localStorage.getItem(MSC_FOLD_KEY)||'{}')||{};}catch(e){return {};}}
function mscSaveFolds(o){try{localStorage.setItem(MSC_FOLD_KEY,JSON.stringify(o));}catch(e){}}
/* the part of the editor that holds element #id (a slider row, a grunge box…) */
function mscPart(box,id){const n=box.querySelector('#'+id);if(!n)return null;let t=n;
  while(t.parentElement&&t.parentElement!==box&&!(t.parentElement.matches&&t.parentElement.matches('details.gzones')))t=t.parentElement;
  return t.parentElement?t:null;}
function mscCard(key,title,parts){const folds=mscFolds(),open=folds[key]!==false;
  const body=el('div',{class:'msccard-b',hidden:!open}),arrow=el('span',{class:'msccard-arr',text:open?'▾':'▸'});
  const head=el('button',{type:'button',class:'msccard-h',id:'msCard_'+key,'aria-expanded':String(open),onclick:()=>{const o=body.hidden;body.hidden=!o;arrow.textContent=o?'▾':'▸';head.setAttribute('aria-expanded',String(o));const f=mscFolds();f[key]=o;mscSaveFolds(f);}},arrow,el('span',{text:title}));
  /* (Kenn: "image input and then beside it the controls associated with it") the picture slot leads each card, its controls follow */
  const isG=n=>n.matches&&(n.matches('.msgrunge')||!!n.querySelector('.gslot'))?1:0;parts=[...parts].sort((a,b)=>isG(b)-isG(a));
  for(const p of parts){for(const s of p.querySelectorAll(':scope>.sub'))if(/^(Grunge|Projection)$/.test(s.textContent.trim()))s.remove();body.append(p);}
  return el('section',{class:'msccard',id:'msC_'+key},head,body);}
const MSC_WIDTH_CARD={edge:'edges',chips:'edges',scratch:'edges',bleach:'edges',dirt:'cav',soot:'cav',crud:'cav',slime:'cav',moss:'cav',rust:'cav',drips:'cav',dust:'flat',snow:'flat',water:'flat'};
function mscLayout(box,r){const p=r.p||{},wear=typeof MS_WEAR_GENS!=='undefined'&&MS_WEAR_GENS.includes(p.g),builder=p.g==='builder',wc=wear?'edges':MSC_WIDTH_CARD[p.g]||'mask',edgeG=typeof EDGE_GENS!=='undefined'&&EDGE_GENS.includes(p.g);
  const proj=box.querySelector('#ms_proj');
  const plan=[
    ['mask',builder?'Final mask':'Mask',['ms_amt','ms_con','ms_inv',...(wc==='mask'&&!builder?['ms_w']:[]),'ms_ganc','ms_uvWrap']],
    ['edges','Edges',[...(wc==='edges'?['ms_w']:[]),...(wear?['ms_edgeStrength','ms_edgeGrow','ms_dist','ms_edgeDistortScale']:[]),...(edgeG?['ms_edgeStrength','ms_edgeGrow','ms_edgeSharp','ms_edgeMin','ms_edgeCorner','ms_edgeDist','ms_edgeDistortScale']:[]),...(wear||edgeG?['ms_cavityProtection']:[]),'msEGrunge']],
    ['cav','Cavities',[...(wc==='cav'?['ms_w']:[]),...(wear||edgeG?[]:['ms_cavityProtection']),'msVGrunge']],
    ['flat','Top and flat surfaces',[...(wc==='flat'?['ms_w']:[]),'msFGrunge']],
    ['breakup','Breakup',['ms_brk','ms_scale','ms_seed',...(wear?[]:['ms_dist']),'msGrunge']],
  ];
  const cards=[];
  for(const [key,title,ids] of plan){const parts=[];for(const id of ids){const t=mscPart(box,id);if(t&&!parts.includes(t)&&!cards.some(c=>c.contains(t)))parts.push(t);}
    if(parts.length)cards.push(mscCard(key,title,parts));}
  const pj=proj&&mscPart(box,'ms_proj');if(pj)cards.push(mscCard('proj','Projection',[pj]));
  if(!cards.length)return;
  /* the zone fold-out is no longer needed once its slots sit in their cards */
  for(const d of box.querySelectorAll('details.gzones'))if(!d.querySelector('.msgrunge'))d.remove();
  for(const s of [...box.children])if(s.classList&&s.classList.contains('sub')&&/^Final mask$/.test(s.textContent.trim()))s.remove();
  /* the closing note stays last */
  const notes=[...box.children].filter(n=>n.matches&&n.matches('p.note')&&n===box.lastElementChild);
  box.append(el('div',{class:'msccards',id:'msCards'},...cards),...notes);}
{const f=msRowEditor;msRowEditor=function(box,L,where,r){const out=f.apply(this,arguments);
  try{if(r&&r.kind==='gen'&&r.p&&!['light','linear','radial','comic'].includes(r.p.g)&&!(typeof msWeatherKind==='function'&&msWeatherKind(r.p.g))){if(typeof EDGE_GENS!=='undefined'&&EDGE_GENS.includes(r.p.g)&&!box.querySelector('#ms_edgeStrength'))box.append(...edgeShapeSliders(L,r));mscLayout(box,r);}}catch(e){console.warn('generator cards',e);}
  try{if(r&&r.kind==='gen')mscInvert(box);}catch(e){console.warn('invert button',e);}
  return out;};}
/* (0.97.24, Kenn: "make the invert a more visible option in the generators") a clear toggle under the Preset; the old tick box is hidden
   and still does the work, so undo and saving are unchanged */
function mscInvert(box){const cb=box.querySelector('#ms_inv');if(!cb||box.querySelector('#msInvBtn'))return;const holder=cb.closest('label')||cb.parentElement;
  const on=!!cb.checked,btn=el('button',{type:'button',class:'btn msinvbtn'+(on?' on':''),id:'msInvBtn','aria-pressed':String(on),title:'Swap what the mask shows and hides',
    onclick:()=>{cb.click();const now=!!cb.checked;btn.classList.toggle('on',now);btn.setAttribute('aria-pressed',String(now));btn.lastChild.textContent=now?'Inverted':'Invert';}},
    el('span',{class:'msinv-ic',text:'◐','aria-hidden':'true'}),el('span',{text:on?'Inverted':'Invert'}));
  if(holder)holder.hidden=true;
  const pre=box.querySelector('#ms_g'),anchor=pre?(pre.closest('.frow')||pre):null;
  if(anchor&&anchor.parentElement)anchor.after(btn);else box.prepend(btn);}
