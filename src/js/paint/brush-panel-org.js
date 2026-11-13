/* (0.97.10, Kenn) the Brush panel less daunting: settings sit in folding groups (the first open, the rest closed), a Simple / Advanced switch hides the rarer groups,
   and a search box finds a setting by name (it shows hidden Advanced ones too). Runs after buildBrushPanel has laid the panel out. */
const BR_GROUP_OF={bSpace:'Stroke',bSmooth:'Stroke',bLazy:'Stroke',bTooth:'Texture',bTexD:'Texture',bTexS:'Texture',bGrain:'Texture',
  bSpDot:'Spray and drips',bSpDen:'Spray and drips',bSpMist:'Spray and drips',bDrip:'Spray and drips',bDripA:'Spray and drips',bDripW:'Spray and drips',
  bMix:'Paint mixing',bMxLoad:'Paint mixing',bMxPick:'Paint mixing',bMxWet:'Paint mixing',bMxUse:'Paint mixing',
  bEndInk:'Paint feel',bWet:'Paint feel',bPickup:'Paint feel',
  bSimLvl:'Pressure',bPS:'Pressure',bPO:'Pressure',bPF:'Pressure',bBU:'Pressure',bMin:'Pressure',bCurve:'Pressure'};
const BR_SUB_GROUP={'Spray paint':'Spray and drips','Real paint mixing':'Paint mixing','Line blend':'Line blend','Pressure without a pen':'Pressure','Pen pressure':'Pressure'};
const BR_SIMPLE=['Stroke','Texture','Pressure'];
const BR_ESSENTIAL=/^(bShareTip|tipChange|bSize|bDefaultSize|bOp|bStr|bFlow|bHard)$/;
const brAdvanced=()=>{try{return localStorage.getItem('gs.brushAdv')==='1';}catch(e){return false;}};
const brGroupOpen={Stroke:true};
function brIdsOf(n){const s=[];if(n.id)s.push(n.id);if(n.querySelectorAll)for(const e of n.querySelectorAll('[id]'))s.push(e.id);return s;}
function brOrganize(box){
  if(!box||!(ui.tool==='brush'||ui.tool==='erase'))return;
  if(box.querySelector(':scope>.brg3'))return;/* 3D Paint's condensed panel has its own groups */
  const kids=[...box.children];let last=-1;kids.forEach((k,i)=>{if(brIdsOf(k).some(id=>BR_ESSENTIAL.test(id)))last=i;});
  if(last<0)return;
  const rest=kids.slice(last+1),reset=rest.find(k=>k.classList&&k.classList.contains('resetrow')&&!k.querySelector('#bShowAll3d'));
  const groups=new Map();let cur='Stroke';const adv=[];let afterReset=false;
  const put=(g,n)=>{if(!groups.has(g))groups.set(g,[]);groups.get(g).push(n);};
  for(const k of rest){
    if(k===reset){afterReset=true;continue;}
    if(afterReset||k.tagName==='DETAILS'||(k.classList&&k.classList.contains('resetrow'))){adv.push(k);continue;}
    if(k.classList&&k.classList.contains('sub')&&BR_SUB_GROUP[k.textContent.trim()])cur=BR_SUB_GROUP[k.textContent.trim()];
    else{const id=brIdsOf(k).find(i=>BR_GROUP_OF[i]);if(id)cur=BR_GROUP_OF[id];}
    put(cur,k);
  }
  const head=el('div',{class:'brhead'});
  const search=el('input',{type:'search',id:'brSearch',class:'brsearch',placeholder:'Search brush settings…','aria-label':'Search brush settings'});
  const seg=el('div',{class:'seg',role:'group','aria-label':'How many settings'},...[[false,'Simple','The common settings'],[true,'Advanced','Every setting']].map(([v,l,t])=>
    el('button',{class:'btn sm'+(brAdvanced()===v?' on':''),id:'brMode_'+(v?'adv':'simple'),text:l,title:t,'aria-pressed':String(brAdvanced()===v),onclick:()=>{try{localStorage.setItem('gs.brushAdv',v?'1':'0');}catch(e){}buildBrushPanel();}})));
  head.append(search,seg);
  const items=[];/* {el,group,adv} for the search */
  const wrap=[];
  const ORDER=['Stroke','Texture','Pressure','Spray and drips','Paint mixing','Paint feel','Line blend'];
  for(const [g,list] of [...groups].sort((a,b)=>(ORDER.indexOf(a[0])+99)%99-(ORDER.indexOf(b[0])+99)%99)){
    const simple=BR_SIMPLE.includes(g),d=el('details',{class:'more brgrp'+(simple?'':' br-adv'),id:'brgrp_'+g.replace(/\W+/g,'')},el('summary',{text:g}),el('div',{class:'dlg-grid'},...list));
    d.open=g in brGroupOpen?brGroupOpen[g]:false;d.addEventListener('toggle',()=>{brGroupOpen[g]=d.open;});
    wrap.push(d);for(const n of list)items.push({el:n,group:d,adv:!simple});
  }
  for(const n of adv){n.classList.add('br-adv');items.push({el:n,group:null,adv:true});}
  box.classList.toggle('br-simple',!brAdvanced());
  /* put the header after the essentials, the groups next, then the rarely used sections, with Reset brush at the very end */
  const anchor=kids[last];anchor.after(head,...wrap,...adv);
  if(reset)box.append(reset);
  const run=()=>{const q=search.value.trim().toLowerCase();box.classList.toggle('br-searching',!!q);
    const shown=new Map();
    for(const it of items){const t=(it.el.textContent||'').toLowerCase();const hit=!q||t.includes(q)||(it.el.classList.contains('sub')&&false);it.el.hidden=!hit;if(hit&&it.group)shown.set(it.group,true);}
    for(const d of wrap){d.hidden=!!q&&!shown.get(d);if(q&&shown.get(d))d.open=true;}
    for(const n of adv)if(n.tagName==='DETAILS'&&q&&!n.hidden)n.open=true;};
  search.addEventListener('input',run);
}
