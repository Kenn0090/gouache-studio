/* ================= Custom shader maker (0.97.27, Kenn: "mix things from other shaders and assign them to texture sets") =================
   A Custom shader is a stack of ingredients taken from the other looks, applied in order on top of Standard (physical) shading:
     Lighting styles  replace the shading by their amount: Skin scattering, Wax glow, Toon bands, Cel, Halftone, Ink shadows
     Shine            adds on top: Brushed metal, Clear coat and flakes, Cloth sheen, Iridescent colour
     Extras           Rim light, Hologram lines, Glass, Retro pixels, Outline, Moving textures (panner)
   Each row has on/off, an amount and (except Outline and Moving textures) a mask: any channel of the set, inverted if asked.
   The recipe lives in the set's shader (doc.v3shade = {kind:'custom', p:{custom:{name,libId,rows}}}), so it is saved with the
   project; the Shaders library (shelf) keeps recipes for every project (localStorage gs.cxLib) and can export/import .gshader.
   In the 3D view (FS_3D, uSh 19): rows go in uCxA/B/C (8 at most); up to 4 different mask channels are packed into the
   thickness input (uHas 2048). Game engines get Standard, as for the newer looks. */
const CX_MAX=8,CX_LIB_KEY='gs.cxLib';
const CX_GROUPS=[['light','Lighting styles'],['shine','Shine'],['extra','Extras']];
const cxPc=v=>Math.round(v*100)+'%';
const CX={
  skin:{code:1,g:'light',label:'Skin scattering',def:{scatter:.5,strength:.6,transmission:.5,thick:.5,depth:1,col:[.85,.25,.18]},B:P=>[P.scatter,P.strength,P.transmission,P.thick],C:P=>[...P.col,P.depth],
    ui:[['scatter','Scatter'],['strength','Strength'],['transmission','Light through thin parts'],['thick','Thickness'],['depth','How far light travels',0,3,.05,v=>v.toFixed(2)]],col:['col','Scatter colour']},
  wax:{code:1,g:'light',label:'Wax glow',def:{scatter:.85,strength:.9,transmission:.6,thick:.4,depth:.6,col:[1,.62,.3]},B:P=>[P.scatter,P.strength,P.transmission,P.thick],C:P=>[...P.col,P.depth],
    ui:[['scatter','Glow spread'],['strength','Strength'],['transmission','Light through thin parts'],['thick','Thickness'],['depth','How far light travels',0,3,.05,v=>v.toFixed(2)]],col:['col','Glow colour']},
  toon:{code:2,g:'light',label:'Toon bands',def:{steps:3,soft:0,spec:.4,rim:.2,col:[.55,.55,.7]},B:P=>[P.steps,P.soft,P.spec,P.rim],
    ui:[['steps','Bands',1,8,1,v=>String(v)],['soft','Soft band edges'],['spec','Highlight'],['rim','Rim']],col:['col','Shadow colour']},
  cel:{code:3,g:'light',label:'Cel shading',def:{thresh:.5,soft:.05,spec:.4,rim:.2,col:[.55,.55,.7]},B:P=>[P.thresh,P.soft,P.spec,P.rim],
    ui:[['thresh','Where the shadow starts'],['soft','Softness',0,.5,.01],['spec','Highlight'],['rim','Rim']],col:['col','Shadow colour']},
  halftone:{code:4,g:'light',label:'Halftone dots',def:{steps:3,soft:.1,dots:.5,dotSize:30,col:[.7,.25,.6]},B:P=>[P.steps,P.soft,P.dots,P.dotSize],
    ui:[['steps','Bands',1,6,1,v=>String(v)],['soft','Softness',0,.5,.01],['dots','Dots'],['dotSize','Dot count',4,160,1,v=>String(v)]],col:['col','Shadow tint']},
  ink:{code:5,g:'light',label:'Ink shadows',def:{steps:2,soft:.03,rimW:.3,rim:.6,col:[.45,.45,.75]},B:P=>[P.steps,P.soft,P.rimW,P.rim],
    ui:[['steps','Shadow shapes',1,3,1,v=>String(v)],['soft','Softness',0,.3,.01],['rimW','Rim width'],['rim','Rim light']],col:['col','Shadow colour']},
  brushed:{code:6,g:'shine',label:'Brushed metal',def:{amount:.7,dir:0},B:P=>[P.amount,P.dir,0,0],ui:[['amount','Stretch',-.95,.95,.01,v=>v.toFixed(2)],['dir','Direction',0,1,.01,v=>Math.round(v*360)+'°']]},
  coat:{code:7,g:'shine',label:'Clear coat and flakes',def:{coat:1,coatRough:.04,flakes:.5,size:170,col:[1,.85,.5],sparkle:1},B:P=>[P.coat,P.coatRough,P.flakes,P.size],C:P=>[...P.col,P.sparkle],
    ui:[['coat','Clear coat'],['coatRough','Coat roughness',0,.5,.01],['flakes','Flakes'],['size','Flake count',20,400,1,v=>String(v)],['sparkle','Sparkle',0,2,.01]],col:['col','Flake colour']},
  sheen:{code:8,g:'shine',label:'Cloth sheen',def:{sheen:1,soft:.5,fibre:0,satin:0,col:[1,1,1]},B:P=>[P.sheen,P.soft,P.fibre,P.satin],
    ui:[['sheen','Sheen',0,2,.01],['soft','Softness'],['fibre','Fibre direction',0,1,.01,v=>Math.round(v*360)+'°'],['satin','Satin streak']],col:['col','Sheen colour']},
  irid:{code:9,g:'shine',label:'Iridescent colour',def:{strength:.8,shift:0,range:1.2,angle:1},B:P=>[P.strength,P.shift,P.range,P.angle],
    ui:[['strength','Strength'],['shift','Colour shift'],['range','Colour range',.2,5,.05,v=>v.toFixed(2)],['angle','Changes with angle']]},
  rim:{code:10,g:'extra',label:'Rim light',def:{width:.35,strength:1,light:0,col:[1,1,1]},B:P=>[P.width,P.strength,P.light,0],
    ui:[['width','Width'],['strength','Strength',0,3,.01],['light','Only on the lit side']],col:['col','Rim colour']},
  holo:{code:11,g:'extra',label:'Hologram lines',def:{lines:40,flicker:.3,glow:1.2,speed:1,col:[.2,.85,1]},B:P=>[P.lines,P.flicker,P.glow,P.speed],
    ui:[['lines','Lines',4,160,1,v=>String(v)],['flicker','Flicker'],['glow','Edge glow',0,3,.01],['speed','Speed',0,3,.01]],col:['col','Colour']},
  glass:{code:12,g:'extra',label:'Glass',def:{refr:.5,frost:0,thick:.3,edge:1,col:[.95,1,1]},B:P=>[P.refr,P.frost,P.thick,P.edge],
    ui:[['refr','Bending'],['frost','Frost'],['thick','Tint depth',0,2,.05,v=>v.toFixed(2)],['edge','Edge reflection',0,2,.01]],col:['col','Tint']},
  retro:{code:13,g:'extra',label:'Retro pixels',def:{res:128,bits:31,dither:.6},B:P=>[P.res,P.bits,P.dither,0],
    ui:[['res','Texels across (0 = off)',0,512,8,v=>v?String(v):'off'],['bits','Colour steps',2,64,1,v=>String(v)],['dither','Dither']],noMask:'Texels apply to the whole set; colour steps follow the mask.'},
  outline:{code:14,g:'extra',label:'Outline',def:{width:2,col:[0,0,0]},B:()=>[0,0,0,0],ui:[['width','Width',.5,10,.5,v=>v+' px']],col:['col','Colour'],noMask:'An outline goes round the whole set.'},
  panner:{code:15,g:'extra',label:'Moving textures',def:{sx:.1,sy:0},B:()=>[0,0,0,0],ui:[['sx','Speed across',-1,1,.01,v=>v.toFixed(2)],['sy','Speed up/down',-1,1,.01,v=>v.toFixed(2)]],noMask:'All the set’s textures slide (whole set).'}};
const CX_NOMASK=['outline','panner'];
/* the custom shader is the 20th look (its index is uSh 19 in FS_3D) */
SHADERS.push(['custom','Custom (mix your own)']);SH_DEF.custom={};
let cxN=0;const cxId=()=>'r'+Date.now().toString(36)+(++cxN);
function cxRecipe(sh){const c=sh&&sh.p&&sh.p.custom;return c&&Array.isArray(c.rows)?c:{name:'My shader',rows:[]};}
const cxOn=R=>R.rows.filter(r=>r.on!==false&&CX[r.k]);
/* the distinct mask channels of the rows that are on, in row order (4 at most: one picture input) */
function cxMaskKeys(R){const out=[];for(const r of cxOn(R).slice(0,CX_MAX)){if(!r.mask||CX_NOMASK.includes(r.k)||out.includes(r.mask))continue;if(out.length<4)out.push(r.mask);}return out;}
{const f=shadeUniforms;shadeUniforms=function(sh,time){if(!sh||sh.kind!=='custom')return f.apply(this,arguments);
  const U=f({kind:'std',p:{}},time),R=cxRecipe(sh),rows=cxOn(R).slice(0,CX_MAX),slots=cxMaskKeys(R),A=new Float32Array(CX_MAX*4),B=new Float32Array(CX_MAX*4),C=new Float32Array(CX_MAX*4);
  rows.forEach((r,i)=>{const d=CX[r.k],P=Object.assign({},d.def,r.p),s=r.mask&&!CX_NOMASK.includes(r.k)?slots.indexOf(r.mask):-1;
    A.set([d.code,r.amt==null?1:r.amt,s,r.inv?1:0],i*4);B.set(d.B(P),i*4);C.set(d.C?d.C(P):[...(P.col||[1,1,1]),0],i*4);});
  const ret=rows.find(r=>r.k==='retro'),pan=rows.find(r=>r.k==='panner');
  Object.assign(U,{uSh:{int:19},uCxN:{int:rows.length},uCxA:{v4a:A},uCxB:{v4a:B},uCxC:{v4a:C},uCxR:[ret?Math.max(0,Object.assign({},CX.retro.def,ret.p).res):0,0,0,0]});
  if(pan){const P=Object.assign({},CX.panner.def,pan.p);Object.assign(U,pnUniforms({sx:P.sx,sy:P.sy,play:true,maps:{base:1,rough:1,metal:1,nfinal:1,ao:1,emis:1,opac:1}}));}
  return U;};}
{const f=shMoves;shMoves=function(sh){if(sh&&sh.kind==='custom')return cxOn(cxRecipe(sh)).some(r=>r.k==='holo'||(r.k==='panner'&&(r.p?.sx??CX.panner.def.sx)||r.p?.sy));return f.apply(this,arguments);};}
{const f=shOutline;shOutline=function(sh){if(sh&&sh.kind==='custom'){const r=cxOn(cxRecipe(sh)).find(x=>x.k==='outline');if(!r)return null;const P=Object.assign({},CX.outline.def,r.p);return {w:P.width*(r.amt==null?1:r.amt),mode:1,dark:0,col:P.col,wobble:0};}return f.apply(this,arguments);};}
/* the mask channels, packed into the thickness input (R G B A = the first four mask channels; one not painted yet reads as its unpainted value) */
{const f=chPackUniforms;chPackUniforms=function(U,T,sh,it){f.apply(this,arguments);if(!sh||sh.kind!=='custom'||!T||!T.base)return;
  const keys=cxMaskKeys(cxRecipe(sh));if(!keys.length)return;const has=k=>!!T[k]&&(T!==v3.tex||doc.maps.includes(k)),w=T.base.w,h=T.base.h,t=k=>has(k)?T[k]:null;
  const ts=[0,1,2,3].map(i=>keys[i]?t(keys[i]):null);
  const p=chPackRun(T,'cxMask',ts.map(chId).join('|')+'|'+keys.map(k=>k+':'+(MAP_DEFS[k]?mapDefault(k)[0]:1)).join()+'|'+w+'x'+h,w,h,{uA:ts[0]?ts[0].tex:dummy,uB:ts[1]?ts[1].tex:dummy,uC:ts[2]?ts[2].tex:dummy,uD:ts[3]?ts[3].tex:dummy,uHasA:ts.map(x=>x?1:0),uV:keys.concat([null,null,null,null]).slice(0,4).map(k=>k&&MAP_DEFS[k]?mapDefault(k)[0]:1),uPass:{int:3}});
  U.uThick=p.tex;U.uUseSafeMip=false;U.uHas={int:(U.uHas.int|2048)&~128};};}

/* ---- editing ---- */
const cxOpen=new Set();
function cxEdit(fn,redraw){shadeEdit(d=>{d.p=d.p||{};const r=JSON.parse(JSON.stringify(cxRecipe(d)));fn(r);d.p.custom=r;});if(redraw)renderShading();}
function cxRowEl(r,i,n){const d=CX[r.k],P=Object.assign({},d.def,r.p),open=cxOpen.has(r.id),set=(key,v)=>cxEdit(R=>{const x=R.rows.find(q=>q.id===r.id);if(x)x.p=Object.assign({},x.p,{[key]:v});});
  const row=(fn)=>cxEdit(R=>{const x=R.rows.find(q=>q.id===r.id);if(x)fn(x,R);},true);
  const on=el('input',{type:'checkbox',id:'cxOn_'+i,'aria-label':'Use '+d.label});on.checked=r.on!==false;on.onchange=()=>row(x=>{x.on=on.checked;});
  const fold=el('button',{type:'button',class:'btn sm cxfold',id:'cxFold_'+i,'aria-expanded':String(open),text:open?'▾':'▸',title:'Settings',onclick:()=>{if(open)cxOpen.delete(r.id);else cxOpen.add(r.id);renderShading();}});
  const btn=(id,t,title,fn,dis)=>el('button',{type:'button',class:'btn sm',id,text:t,title,disabled:dis||null,onclick:fn});
  const head=el('div',{class:'cxhead'},on,fold,el('span',{class:'cxname',text:d.label}),el('span',{class:'cxgrp dim',text:CX_GROUPS.find(g=>g[0]===d.g)[1]}),
    btn('cxUp_'+i,'↑','Move up',()=>row((x,R)=>{const j=R.rows.indexOf(x);if(j>0){R.rows.splice(j,1);R.rows.splice(j-1,0,x);}}),i===0),
    btn('cxDn_'+i,'↓','Move down',()=>row((x,R)=>{const j=R.rows.indexOf(x);if(j<R.rows.length-1){R.rows.splice(j,1);R.rows.splice(j+1,0,x);}}),i===n-1),
    btn('cxDel_'+i,'×','Remove',()=>row((x,R)=>{R.rows.splice(R.rows.indexOf(x),1);})));
  const amt=makeSlider({id:'cxAmt_'+i,label:'Amount',min:0,max:d.g==='light'?1:2,step:.01,value:r.amt==null?1:r.amt,fmt:cxPc,onInput:v=>cxEdit(R=>{const x=R.rows.find(q=>q.id===r.id);if(x)x.amt=v;})}).el;
  const kids=[head,amt];
  if(!CX_NOMASK.includes(r.k)){const ms=el('select',{id:'cxMask_'+i,class:'shsel','aria-label':'Mask'},el('option',{value:'',text:'Whole set'}),...doc.maps.filter(k=>k!=='normal').map(k=>el('option',{value:k,text:'Where '+MAP_DEFS[k].label+' is light'})));
    ms.value=r.mask&&doc.maps.includes(r.mask)?r.mask:'';ms.onchange=()=>row(x=>{x.mask=ms.value||null;});
    const inv=el('label',{class:'chk',for:'cxInv_'+i},el('input',{type:'checkbox',id:'cxInv_'+i}),el('span',{text:'Invert'}));inv.querySelector('input').checked=!!r.inv;inv.querySelector('input').onchange=e=>row(x=>{x.inv=e.target.checked;});
    const own=el('button',{type:'button',class:'btn sm',id:'cxMaskNew_'+i,text:'New mask channel',title:'Add a channel of your own to paint this ingredient’s mask',onclick:()=>cxNewMask(r.id)});
    kids.push(el('div',{class:'frow cxmask'},el('span',{text:'Mask'}),ms,inv,own));}
  else kids.push(el('p',{class:'note',text:d.noMask}));
  if(open){for(const [key,label,min=0,max=1,step=.01,fmt=cxPc] of d.ui)kids.push(makeSlider({id:'cx_'+key+'_'+i,label,min,max,step,value:P[key],fmt,onInput:v=>set(key,v)}).el);
    if(d.col)kids.push(el('div',{class:'frow'},el('span',{text:d.col[1]}),colourBtn('cx_'+d.col[0]+'_'+i,()=>Object.assign({},d.def,cxRecipe(v3ShadeOf(doc)).rows.find(q=>q.id===r.id)?.p)[d.col[0]],c=>set(d.col[0],c),d.col[1])));
    if(d.noMask&&!CX_NOMASK.includes(r.k))kids.push(el('p',{class:'note',text:d.noMask}));}
  return el('div',{class:'cxrow'+(r.on===false?' off':''),id:'cxRow_'+i},...kids);}
/* a channel of your own named after the ingredient, painted white where it should show */
function cxNewMask(rowId){const free=MAP_USER.find(k=>!doc.maps.includes(k));if(!free){toast('All eight channels of your own are in use.');return;}
  const R=cxRecipe(v3ShadeOf(doc)),r=R.rows.find(q=>q.id===rowId);if(!r)return;const nm=(CX[r.k].label+' mask').slice(0,32);
  doc.mapDef=Object.assign({},doc.mapDef,{['name:'+free]:nm});setDocMaps(doc.maps.concat(free),nm);
  cxEdit(Q=>{const x=Q.rows.find(q=>q.id===rowId);if(x)x.mask=free;},true);toast('“'+nm+'” is black: paint white where '+CX[r.k].label+' should show.');}
function cxEditor(sh){const R=cxRecipe(sh),rows=R.rows.filter(r=>CX[r.k]);
  const name=el('input',{type:'text',id:'cxName',class:'txt',value:R.name||'My shader',maxlength:'40','aria-label':'Shader name'});name.oninput=()=>cxEdit(Q=>{Q.name=name.value.trim()||'My shader';});
  const add=el('select',{id:'cxAdd',class:'shsel','aria-label':'Add an ingredient'},el('option',{value:'',text:'+ Add an ingredient…'}),
    ...CX_GROUPS.map(([g,l])=>el('optgroup',{label:l},...Object.entries(CX).filter(([,d])=>d.g===g).map(([k,d])=>el('option',{value:k,text:d.label})))));
  add.onchange=()=>{const k=add.value;if(!k)return;if(rows.length>=CX_MAX){toast('A custom shader holds up to '+CX_MAX+' ingredients.');renderShading();return;}const id=cxId();cxOpen.add(id);cxEdit(Q=>{Q.rows.push({id,k,on:true,amt:1,mask:null,inv:false,p:{}});},true);};
  const lib=cxLib(),saved=R.libId&&lib.find(x=>x.id===R.libId);
  return el('div',{class:'cxed',id:'cxEd'},el('div',{class:'sub',text:'Custom shader'}),
    el('p',{class:'note',text:'Starts as Standard (physical) shading. Each ingredient below is applied in order, by its amount, where its mask is light. Lighting styles replace the shading; Shine and Extras add on top.'}),
    el('div',{class:'frow'},el('span',{text:'Name'}),name),...rows.map((r,i)=>cxRowEl(r,i,rows.length)),add,
    el('div',{class:'chips cxlibbtns'},el('button',{type:'button',class:'btn sm',id:'cxSave',text:saved?'Update in library':'Save to library',onclick:()=>cxSave(false)}),
      saved?el('button',{type:'button',class:'btn sm',id:'cxSaveNew',text:'Save as new',onclick:()=>cxSave(true)}):'',
      el('button',{type:'button',class:'btn sm',id:'cxExport',text:'Export…',onclick:()=>cxExport(cxRecipe(v3ShadeOf(doc)))}),
      el('button',{type:'button',class:'btn sm',id:'cxImport',text:'Import…',onclick:()=>cxImport()})));}

/* ---- the library (every project) ---- */
function cxLib(){try{const a=JSON.parse(localStorage.getItem(CX_LIB_KEY)||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function cxLibPut(a){try{localStorage.setItem(CX_LIB_KEY,JSON.stringify(a));}catch(e){toast('Could not save the Shaders library: '+(e.message||e));}cxShelfRender();}
const cxClean=R=>({name:R.name||'My shader',rows:(R.rows||[]).filter(r=>CX[r.k]).slice(0,CX_MAX).map(r=>({id:r.id||cxId(),k:r.k,on:r.on!==false,amt:r.amt==null?1:+r.amt,mask:r.mask||null,inv:!!r.inv,p:Object.assign({},r.p)}))});
function cxSave(asNew){const R=cxRecipe(v3ShadeOf(doc)),lib=cxLib();let rec=!asNew&&R.libId&&lib.find(x=>x.id===R.libId);
  if(!rec){rec={id:'cx'+Date.now().toString(36),ts:Date.now()};lib.push(rec);}Object.assign(rec,cxClean(R),{ts:Date.now()});cxLibPut(lib);
  cxEdit(Q=>{Q.libId=rec.id;},true);toast('“'+rec.name+'” is in the Shaders library.');}
/* use a recipe on texture set i (the active one when i is missing) */
function cxApplyTo(rec,i){const put=()=>{shadeEdit(d=>{d.kind='custom';d.p=d.p||{};d.p.custom=Object.assign(JSON.parse(JSON.stringify(cxClean(rec))),{libId:rec.id||null});});};
  if(ui.mode==='p3d'&&i!=null&&i!==p3.cur&&typeof p3InSet==='function')p3InSet(i,put);else put();
  renderShading();toast('“'+(rec.name||'Custom shader')+'” on '+(ui.mode==='p3d'?'“'+(p3.sets[i??p3.cur]||{}).name+'”':'this document')+'.');}
function cxExport(R){const blob=new Blob([JSON.stringify({gouacheShader:1,...cxClean(R)},null,1)],{type:'application/json'});
  deliver((R.name||'Shader').replace(/[^\w\- ]+/g,'')+'.gshader',blob).then(r=>toast(deliveredText(r,'Shader')));}
async function cxImport(){const f=await pickFiles('.gshader,application/json',true,'Gouache shaders',['gshader','json']);if(!f||!f.length)return;const lib=cxLib();let n=0;
  for(const file of f){try{const o=JSON.parse(await file.text());if(!o||!Array.isArray(o.rows))throw new Error('not a Gouache shader');lib.push(Object.assign({id:'cx'+Date.now().toString(36)+n,ts:Date.now()},cxClean(o)));n++;}catch(e){toast(file.name+': '+(e.message||e));}}
  if(n){cxLibPut(lib);toast(n+' shader'+(n>1?'s':'')+' added to the Shaders library.');}}
function cxDelete(id){const lib=cxLib().filter(x=>x.id!==id);cxLibPut(lib);}
/* a small picture of what's in a recipe: one band per ingredient group colour */
function cxSwatch(rec){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),rows=(rec.rows||[]).filter(r=>r.on!==false&&CX[r.k]);
  const g=x.createRadialGradient(24,22,4,32,32,34);g.addColorStop(0,'#e8e8ea');g.addColorStop(.6,'#8a8c92');g.addColorStop(1,'#3a3b40');x.fillStyle=g;x.beginPath();x.arc(32,32,28,0,7);x.fill();
  rows.slice(0,6).forEach((r,i)=>{const col=Object.assign({},CX[r.k].def,r.p).col||({shine:[1,1,1],extra:[.4,.8,1],light:[.9,.6,.4]})[CX[r.k].g];x.strokeStyle='rgb('+col.map(v=>Math.round(v*255)).join(',')+')';x.lineWidth=4;x.beginPath();x.arc(32,32,24-i*4,-1.2,-1.2+Math.PI*0.9);x.stroke();});
  return c.toDataURL();}
/* the Shaders category on the shelf */
function cxShelfRender(){const box=document.getElementById('shShadersBody');if(!box)return;const lib=cxLib();
  const tile=rec=>{const t=el('button',{type:'button',class:'mattile cxtile',title:rec.name+' — click: use on the active texture set; drag onto a texture set',draggable:'true'},el('img',{class:'matprev',src:cxSwatch(rec),alt:''}),el('span',{class:'matname',text:rec.name}));
    t.onclick=()=>cxApplyTo(rec);t.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/x-gouache-shader',rec.id);e.dataTransfer.effectAllowed='copy';});
    t.addEventListener('contextmenu',e=>{e.preventDefault();if(confirm('Remove “'+rec.name+'” from the Shaders library?'))cxDelete(rec.id);});t.dataset.cx=rec.id;return t;};
  box.replaceChildren(el('div',{class:'chips'},el('button',{type:'button',class:'btn sm',id:'cxShNew',text:'New custom shader',onclick:()=>{shadeEdit(d=>{d.kind='custom';d.p=d.p||{};d.p.custom={name:'My shader',rows:[]};});if(typeof showPanel==='function')showPanel('shading');renderShading();}}),
      el('button',{type:'button',class:'btn sm',id:'cxShImport',text:'Import…',onclick:()=>cxImport()})),
    lib.length?el('div',{class:'matgrid',id:'cxGrid'},...lib.map(tile)):el('p',{class:'note',id:'cxNone',text:'No custom shaders yet. Pick Custom (mix your own) in the Shader panel, add ingredients, then Save to library.'}));}
/* drop a shader tile on a texture set row */
document.addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('text/x-gouache-shader')&&e.target.closest&&e.target.closest('.p3set,#v3Hit')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
document.addEventListener('drop',e=>{const id=e.dataTransfer&&e.dataTransfer.getData('text/x-gouache-shader');if(!id)return;const row=e.target.closest&&e.target.closest('.p3set');const rec=cxLib().find(x=>x.id===id);if(!rec)return;
  e.preventDefault();e.stopPropagation();if(row){const i=[...row.parentElement.querySelectorAll('.p3set')].indexOf(row);cxApplyTo(rec,i<0?null:i);}else cxApplyTo(rec);},true);
/* the Shader panel: library shaders in the drop-down, and the editor under the Custom look */
{const f=renderShading;renderShading=function(){f.apply(this,arguments);
  try{const box=document.getElementById('shadeBody'),tabs=box&&box.querySelector('#shKind');if(!tabs)return;const sh=v3ShadeOf(doc),lib=cxLib();
    if(lib.length&&ui.mode!=='bake'&&ui.mode!=='convert'){tabs.append(el('optgroup',{label:'Shaders library'},...lib.map(r=>el('option',{value:'lib:'+r.id,text:'★ '+r.name}))));
      const on=tabs.onchange;tabs.onchange=function(){const v=tabs.value;if(v.startsWith('lib:')){const rec=cxLib().find(x=>'lib:'+x.id===v);if(rec)cxApplyTo(rec);return;}return on.apply(this,arguments);};}
    tabs.value=sh.kind;
    if(sh.kind==='custom'){const body=tabs.nextElementSibling;if(body)body.prepend(cxEditor(sh));}}catch(e){console.warn('custom shader',e);}};}
