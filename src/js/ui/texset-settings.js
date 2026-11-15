/* ================= Texture Set Settings, channel buttons on materials and brushes (0.97.26, Kenn with Painter's screenshot) =================
   Like Substance Painter: each texture set lists its channels (+ to add, − to remove, a format per channel). Adding a channel
   gives every material an input for it (a row of channel buttons at the top of the material editor: color, height, rough,
   metal, nrm, scatt, s lvl, user1…) and the brush the same buttons, each with its own value, so one stroke can paint several
   channels. The format (8-bit / 16-bit) is stored in doc.mapDef['fmt:k'], which is saved, copied and undone with the set. */
const TSS_SHORT={base:'color',rough:'rough',metal:'metal',specl:'s lvl',spec:'spec',gloss:'gloss',height:'height',normal:'nrm',ao:'ao',curv:'curv',emis:'emiss',opac:'opac',sss:'scatt',sssc:'s col',trans:'trans',fur:'fur'};
const tssShort=k=>MAP_DEFS[k]&&MAP_DEFS[k].user?MAP_DEFS[k].label.toLowerCase().slice(0,8):TSS_SHORT[k]||k;
const tssFmt=k=>mapDepth(k)>8?16:8;
/* the brush can paint every channel (the viewed one gets the brush colour, the rest their own value) */
for(const k of ['specl','sss','sssc','trans',...MAP_USER])if(!MAP_BRUSH_KEYS.includes(k))MAP_BRUSH_KEYS.push(k);
Object.assign(ui.mapBrush,{specl:{on:false,v:.5},sss:{on:false,v:1},sssc:{on:false,c:[.85,.25,.18]},trans:{on:false,v:1}},Object.fromEntries(MAP_USER.map(k=>[k,{on:false,v:1}])));

/* ---- channel format: 8-bit or 16-bit; existing pictures are copied into the new format (one undo step) ---- */
function tssSetFormat(k,bits){if(!doc.maps.includes(k)||tssFmt(k)===bits)return;const key='fmt:'+k,before=doc.mapDef[key],after=bits;
  if(packedHeight(16)&&k==='height'){toast('Height on a canvas this size has to stay 16-bit.');return;}
  const swap=(val)=>{const was=[];doc.mapDef=Object.assign({},doc.mapDef);if(val==null)delete doc.mapDef[key];else doc.mapDef[key]=val;const d=mapDepth(k);
    for(const L of paintLayers()){const t=L.maps&&L.maps[k];if(!t||t.empty||t.depth===d||t.packed)continue;const n=makeTarget(t.w,t.h,d,undefined,false,t.mono);
      run(P.resample,n,{uSrc:t.tex,uOffset:[0,0],uScale:[1,1],uTaps:{int:1}});was.push([L,t]);L.maps[k]=n;if(L.target===t)L.target=n;}
    return was;};
  let old=swap(after),cur='after';
  pushUndo({label:MAP_DEFS[k].label+' '+bits+'-bit',refs:[],undo(){for(const [L,t] of old){const n=L.maps[k];L.maps[k]=t;if(L.target===n)L.target=t;disposeTarget(n);}const d=doc.mapDef=Object.assign({},doc.mapDef);if(before==null)delete d[key];else d[key]=before;cur='before';changedAll();tssRender();},
    redo(){old=swap(after);cur='after';changedAll();tssRender();},drop(){if(cur==='after')for(const [,t] of old)disposeTarget(t);}});
  changedAll();tssRender();toast(MAP_DEFS[k].label+' is now '+bits+'-bit'+(bits===16?' (smoother, twice the memory).':'.'));}
/* ---- add / remove a channel (setDocMaps is undoable; removing asks when something was painted) ---- */
function tssAdd(k){if(k==='own'){const free=MAP_USER.find(u=>!doc.maps.includes(u));if(!free){toast('All eight channels of your own are in use.');return;}k=free;}
  if(doc.maps.includes(k))return;setDocMaps(doc.maps.concat(k),MAP_DEFS[k].label);tssRender();}
function tssRemove(k){if(k==='base'||!doc.maps.includes(k))return;const used=paintLayers().some(L=>hasMap(L,k)),go=()=>{setDocMaps(doc.maps.filter(x=>x!==k),'Remove '+MAP_DEFS[k].label);tssRender();};
  if(used)confirmDlg('Remove '+MAP_DEFS[k].label+'?','What was painted in '+MAP_DEFS[k].label+' is taken out of this texture set (Undo brings it back).','Remove',go);else go();}
function tssAddable(){const other=WF_KEYS[doc.workflow==='spec'?'metal':'spec'];return MAP_ORDER.filter(k=>!doc.maps.includes(k)&&!other.includes(k)&&!(doc.workflow==='spec'&&k==='specl')&&!MAP_DEFS[k].user);}
/* ---- the panel ---- */
function tssRender(){const box=document.getElementById('tssBody');if(!box)return;if(ui.mode!=='p3d'){box.replaceChildren(el('p',{class:'note',text:'Texture set settings are for 3D Paint.'}));return;}
  const S=p3.sets&&p3.sets[p3.cur];
  const size=el('select',{id:'tssSize',class:'shsel','aria-label':'Texture size'},...[512,1024,2048,4096,8192].map(n=>el('option',{value:String(n),text:String(n)})));size.value=String(p3.size||doc.w);
  size.onchange=async()=>{const n=+size.value;if(typeof p3Resize==='function'&&!(await p3Resize(n)))size.value=String(p3.size||doc.w);tssRender();};
  const wf=el('select',{id:'tssWf',class:'shsel','aria-label':'Workflow'},el('option',{value:'metal',text:'Metal / Rough'}),el('option',{value:'spec',text:'Specular / Gloss'}));wf.value=doc.workflow==='spec'?'spec':'metal';
  wf.onchange=()=>{const to=wf.value;if(to===(doc.workflow||'metal'))return;wfAsk(to,()=>tssRender());};
  const rows=doc.maps.map(k=>{const D=MAP_DEFS[k],fmt=el('select',{id:'tssFmt_'+k,class:'shsel tssfmt','aria-label':D.label+' format'},el('option',{value:'8',text:'8-bit'}),el('option',{value:'16',text:'16-bit'}));
      fmt.value=String(tssFmt(k));fmt.onchange=()=>tssSetFormat(k,+fmt.value);
      const name=D.user?el('input',{type:'text',class:'txt tssname',id:'tssName_'+k,value:D.label,maxlength:'32','aria-label':'Channel name',onchange:e=>{const v=e.target.value.trim();doc.mapDef=Object.assign({},doc.mapDef);if(v)doc.mapDef['name:'+k]=v;else delete doc.mapDef['name:'+k];refreshMapsUI();tssRender();}}):el('span',{class:'tssname',text:D.label});
      const kind=D.user?el('select',{class:'shsel tsskind',id:'tssKind_'+k,'aria-label':'Grey or colour'},el('option',{value:'g',text:'Grey'}),el('option',{value:'c',text:'Colour'})):el('span',{class:'dim tsskind',text:D.grey?'Grey':'Colour'});
      if(D.user){kind.value=D.grey?'g':'c';kind.onchange=()=>{doc.mapDef=Object.assign({},doc.mapDef);if(kind.value==='c')doc.mapDef['col:'+k]=1;else delete doc.mapDef['col:'+k];changedAll();refreshMapsUI();tssRender();};}
      return el('div',{class:'tssrow',id:'tssRow_'+k,title:D.hint||''},name,kind,fmt,k==='base'?el('span',{class:'tssx'}):el('button',{type:'button',class:'btn sm tssx',id:'tssDel_'+k,text:'−',title:'Remove '+D.label,'aria-label':'Remove '+D.label,onclick:()=>tssRemove(k)}));});
  const add=el('select',{id:'tssAdd',class:'shsel','aria-label':'Add a channel'},el('option',{value:'',text:'+ Add a channel…'}),...tssAddable().map(k=>el('option',{value:k,text:MAP_DEFS[k].label})),
    MAP_USER.some(u=>!doc.maps.includes(u))?el('option',{value:'own',text:'A channel of your own'}):'');add.onchange=()=>{const v=add.value;if(v)tssAdd(v);};
  box.replaceChildren(el('div',{class:'sub',text:'Texture set'+(S?' · '+S.name:'')}),el('div',{class:'frow'},el('span',{text:'Size (per tile)'}),size),el('div',{class:'frow'},el('span',{text:'Workflow'}),wf),
    el('div',{class:'sub',text:'Channels'}),el('div',{class:'tsslist',id:'tssList'},...rows),add,
    el('p',{class:'note',text:'Every material and the brush get an input for each channel here. 16-bit is smoother (height, gradients) and uses twice the memory.'}));}
{const f=refreshMapsUI;refreshMapsUI=function(){const r=f.apply(this,arguments);try{tssRender();}catch(e){console.warn('texture set settings',e);}return r;};}
function tssInit(){if(dkSecs.tsset)return;const sec=el('section',{class:'sec',id:'tssSec','aria-labelledby':'hTss'},el('div',{class:'sec-h',id:'hTss'},el('span',{text:'Texture Set Settings'})),el('div',{id:'tssBody',class:'dlg-grid'}));
  dkSecs.tsset=sec;(dk.park||document.body).append(sec);tssRender();}
{const f=shInit;shInit=function(){const r=f.apply(this,arguments);try{tssInit();}catch(e){console.warn('texture set settings',e);}return r;};}

/* ---- channel buttons at the top of the material editor ---- */
function tssMatChips(){const box=document.getElementById('matEdBody'),L=doc.active;if(!box||!L||!L.fill||box.querySelector('#tssMatChips'))return;
  const cards=[...box.querySelectorAll('.fillcard[data-material-channel]')];if(!cards.length)return;
  const row=el('div',{class:'tsschips',id:'tssMatChips',role:'group','aria-label':'Channels this material sets'},...cards.map(c=>{const k=c.dataset.materialChannel,cb=c.querySelector('#fl_on_'+k),on=!!(cb&&cb.checked);
    return el('button',{type:'button',class:'tsschip'+(on?' on':''),id:'tssMat_'+k,'aria-pressed':String(on),text:tssShort(k),title:(on?'Turn off ':'Turn on ')+MAP_DEFS[k].label+' in this material',onclick:()=>{const x=document.getElementById('fl_on_'+k);if(x)x.click();}});}));
  cards[0].before(el('div',{class:'sub',text:'Material'}),row);}
{const f=renderMatEd;renderMatEd=function(){const r=f.apply(this,arguments);try{tssMatChips();}catch(e){console.warn('material channel buttons',e);}return r;};}

/* ---- the same buttons on the brush, each with its own value ---- */
buildMapBrushSection=function(box,what){if(doc.maps.length<2||ui.mode==='anim')return;
  const erase=what==='erase',keys=MAP_BRUSH_KEYS.filter(k=>doc.maps.includes(k));
  const sec=el('div',{class:'mapbrush'},el('div',{class:'sub',text:erase?'Erases from':what==='fill'?'Fills':'Paints'}));
  const chips=el('div',{class:'tsschips',id:'tssBrushChips',role:'group','aria-label':'Channels this brush paints'},
    el('span',{class:'tsschip on lock',id:'tssBr_view',title:MAP_DEFS[doc.map].label+' (the channel you are viewing) '+(erase?'is erased':'gets the brush colour'),text:tssShort(doc.map)}));
  const vals=el('div',{class:'mbvals'});
  for(const k of keys){if(k===doc.map)continue;const m=ui.mapBrush[k]||(ui.mapBrush[k]={on:false,v:1}),D=MAP_DEFS[k];
    if(!D.grey&&!m.c)m.c=[.5,.5,.5];if(D.grey&&m.c&&D.user)delete m.c;
    const cb=el('input',{type:'checkbox',id:'mb_'+k,'aria-label':D.label});cb.checked=!!m.on;cb.onchange=()=>{m.on=cb.checked;brushEdited();buildBrushPanel();};
    chips.append(el('label',{class:'tsschip'+(m.on?' on':''),for:'mb_'+k,title:(m.on?'Stop painting ':'Also paint ')+D.label},cb,el('span',{text:tssShort(k)})));
    if(!erase&&m.on){const nm=el('span',{class:'mbname',text:D.label});
      if(m.c){const c=el('input',{type:'color','aria-label':D.label+' colour',value:toHex(m.c)});c.addEventListener('input',()=>{m.c=fromHex(c.value);brushEdited();});vals.append(el('div',{class:'mbrow'},nm,c));}
      else if(k==='height')vals.append(makeSlider({id:'mbv_'+k,label:'Height',min:-1,max:1,step:.01,value:m.v*2-1,fmt:v=>(v>0?'+':'')+Math.round(v*100)+'%',onInput:v=>{m.v=(v+1)/2;brushEdited();}}).el);
      else vals.append(makeSlider({id:'mbv_'+k,label:D.label,min:0,max:1,step:.01,value:m.v,fmt:pct,onInput:v=>{m.v=v;brushEdited();}}).el);}}
  sec.append(chips,vals,el('p',{class:'note',text:'Lit buttons are painted by the same stroke, each with the value below. '+(what==='fill'?'':'Edit › Fill and Delete follow them too.')}));
  box.append(sec);};
/* the channel buttons are a main brush setting (as in Painter), not an Advanced one: shown in Simple mode, right before the setting groups */
{const f=brOrganize;brOrganize=function(box){const r=f.apply(this,arguments);try{const s=box&&box.querySelector('.mapbrush');if(s){s.classList.remove('br-adv');const g=box.querySelector(':scope>details.brgrp,:scope>.brg3');if(g&&g!==s)g.before(s);}}catch(e){}return r;};}
