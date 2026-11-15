/* ================= Skin like Marmoset Toolbag's Subsurface Scatter, and Metalness / Specular reflectivity (0.97.26, Kenn) =================
   Skin settings laid out like Marmoset's Diffusion › Subsurface Scatter: Scatter Map + Scatter Depth (mm) + scatter colour; Translucency
   Map + Translucency + colour, Translucency Depth (mm), Translucency Scatter; Fuzz Map + Fuzz + colour, Fuzz Scale, Fuzz Occlusion.
   The maps are the set's channels (Scatter colour, Translucency, Fuzz), painted or given a picture like any channel.
   Reflectivity (Standard and Skin): Metalness reads the Metallic channel; Specular reads a Specular colour channel instead
   (like Marmoset's Specular module), packed into the metallic input (uHas 256), with the Roughness channel kept. */
Object.assign(SH_DEF.skin,{scatDepth:1,tcol:[1,.45,.25],transDepth:1,transScatter:.5,fuzz:0,fcol:[1,1,1],fuzzScale:1,fuzzOcc:1,refl:'metal',specDef:[.22,.22,.22]});
Object.assign(SH_DEF.std,{refl:'metal',specDef:[.22,.22,.22]});
const SK_REFL=['std','skin'];
const skReflSpec=sh=>!!sh&&SK_REFL.includes(sh.kind)&&shParams(sh).refl==='spec'&&doc.workflow!=='spec';
{const f=shadeUniforms;shadeUniforms=function(sh,time){const U=f.apply(this,arguments);if(!sh||sh.kind!=='skin')return U;const P=shParams(sh);
  U.uShP=[.5*Math.max(0,P.scatDepth??2*P.scatter),U.uShP[1],U.uShP[2],U.uShP[3]];
  U.uSkin=[P.surface,1/Math.max(.05,P.transDepth??1/Math.max(.05,P.depth)),P.transmission,P.transScatter??0];
  U.uShD=P.tcol||P.col;const fc=P.fcol||[1,1,1];U.uShQ=[fc[0],fc[1],P.oil||0,fc[2]];U.uShE=[P.fuzz||0,P.fuzzScale??1,P.fuzzOcc??1,0];return U;};}
/* Specular reflectivity: the Specular colour channel (or the shader's default colour) into the metallic input */
{const f=chPackUniforms;chPackUniforms=function(U,T,sh,it){f.apply(this,arguments);if(!skReflSpec(sh)||!T||!T.base)return;const P=shParams(sh),w=T.base.w,h=T.base.h;
  const has=!!T.specc&&(T!==v3.tex||doc.maps.includes('specc')),c=P.specDef||[.22,.22,.22];
  const t=chPackRun(T,'refl',[has?chId(T.specc):'-',c.join(),w,h].join('|'),w,h,{uA:has?T.specc.tex:dummy,uB:dummy,uHasA:[has?1:0,0,0,0],uCol:c,uPass:{int:1}});
  U.uMetal=t.tex;U.uHas={int:(U.uHas.int|256)&~2&~1024};U.uDef=[(U.uDef||[.5,0])[0],0];};}
function skSetRefl(v){shadeEdit(d=>{d.p=d.p||{};d.p[d.kind]=Object.assign({},shParams(d,d.kind),{refl:v});});
  if(v==='spec'&&!doc.maps.includes('specc')){setDocMaps(doc.maps.concat('specc'),'Specular colour');toast('Specular reflectivity: the set now has a Specular colour channel, used instead of Metallic. Unpainted areas use the colour beside the drop-down.');}
  renderShading();}
/* a map slot like Marmoset's: a small picture, the channel's name, then Paint / Picture… / × */
function skMapRow(k,label){const on=doc.maps.includes(k),t=v3.tex&&v3.tex[k],sw=el('span',{class:'skmapsw'+(on?' on':'')});if(on&&t)sw._hpv=()=>({t,name:MAP_DEFS[k].label});
  const pic=paintLayers().find(L=>L.fill&&L.fill.maps&&L.fill.maps[k]&&L.fill.maps[k].on&&L.fill.maps[k].src==='image'),nm=on?(pic?pic.fill.maps[k].name||'picture':'painted channel'):'none';
  return el('div',{class:'skmap',id:'skMap_'+k},sw,el('span',{class:'skmapname'},el('b',{text:label+': '}),el('span',{class:'dim',text:nm})),
    el('span',{class:'skmapbtns'},el('button',{type:'button',class:'btn sm',id:'skPaint_'+k,text:'Paint',title:'Paint '+MAP_DEFS[k].label+' (lights it on the brush)',onclick:()=>slotPaint(k)}),
      el('button',{type:'button',class:'btn sm',id:'skPic_'+k,text:'Picture…',title:'Use a picture for '+MAP_DEFS[k].label,onclick:()=>slotPicture(k)}),
      on?el('button',{type:'button',class:'btn sm',id:'skOff_'+k,text:'×',title:'Take '+MAP_DEFS[k].label+' out of the set (use the sliders only)',onclick:()=>slotValue(k)}):''));}
function skReflRow(sh){const P=shParams(sh),spec=doc.workflow==='spec',sel=el('select',{id:'shRefl',class:'shsel','aria-label':'Reflectivity',disabled:spec||null},el('option',{value:'metal',text:'Metalness'}),el('option',{value:'spec',text:'Specular'}));
  sel.value=P.refl==='spec'?'spec':'metal';sel.onchange=()=>skSetRefl(sel.value);
  const kids=[el('div',{class:'frow'},el('span',{text:'Reflectivity'}),sel)];
  if(spec)kids.push(el('p',{class:'note',text:'This set uses the Specular / Gloss workflow (Texture Set Settings), so it already reads specular colour.'}));
  else if(P.refl==='spec')kids.push(el('div',{class:'frow'},el('span',{text:'Unpainted specular'}),colourBtn('sh_specDef',()=>shParams(v3ShadeOf(doc)).specDef,c=>shadeEdit(d=>{d.p[d.kind]=Object.assign({},shParams(d,d.kind),{specDef:c});}),'Unpainted specular')),
    skMapRow('specc','Specular Map'));
  return el('div',{class:'skrefl',id:'skRefl'},el('div',{class:'sub',text:'Reflection'}),...kids);}
function skSkinUI(sh){const P=shParams(sh),k='skin',setP=(key,v)=>shadeEdit(d=>{d.p[k]=Object.assign({},shParams(d,k),{[key]:v});});
  const sl=(key,label,min=0,max=1,step=.01,fmt=v=>Math.round(v*100)+'%')=>makeSlider({id:'sh_'+key,label,min,max,step,value:P[key],fmt,onInput:v=>setP(key,v)}).el;
  const mm=v=>(Math.round(v*100)/100)+' mm',colr=(key,label)=>colourBtn('sh_'+key,()=>shParams(v3ShadeOf(doc))[key],c=>setP(key,c),label);
  const withCol=(slider,key,label)=>el('div',{class:'skslcol'},slider,colr(key,label));
  const presets=seg([['natural','Natural skin'],['soft','Soft skin'],['wax','Wax']],null,id=>{const o={natural:{scatDepth:1,strength:.6,soft:.5,transmission:.5,transDepth:1,transScatter:.5,col:[1,.62,.52],tcol:[1,.45,.25],surface:.45,oil:.3},
      soft:{scatDepth:1.6,strength:.8,soft:.65,transmission:.4,transDepth:1.4,transScatter:.6,col:[1,.55,.45],tcol:[1,.5,.3],surface:.55,oil:.15},wax:{scatDepth:2.2,strength:.9,soft:.8,transmission:.6,transDepth:.8,transScatter:.7,col:[1,.85,.6],tcol:[1,.7,.35],surface:.3,oil:.1}}[id];
    shadeEdit(d=>{d.p.skin=Object.assign({},shParams(d,'skin'),o);});renderShading();});
  return el('div',{class:'skmarm',id:'skMarm'},presets,
    el('div',{class:'sub skhead',text:'Diffusion: Subsurface Scatter'}),
    skMapRow('sssc','Scatter Map'),withCol(sl('scatDepth','Scatter Depth (mm)',0,6,.05,mm),'col','Scatter colour'),sl('strength','Scatter strength'),sl('soft','Soften normals'),
    skMapRow('trans','Translucency Map'),withCol(sl('transmission','Translucency'),'tcol','Translucency colour'),sl('transDepth','Translucency Depth (mm)',.05,6,.05,mm),sl('transScatter','Translucency Scatter'),
    ...(doc.meshMaps&&doc.meshMaps.thick?[el('p',{class:'note',text:'Thin parts let more light through, from the baked Thickness map.'})]:[sl('thick','Thickness'),el('p',{class:'note',text:'Bake a Thickness map (Bake mesh maps) so ears and nostrils glow on their own.'})]),
    skMapRow('fuzzm','Fuzz Map'),withCol(sl('fuzz','Fuzz'),'fcol','Fuzz colour'),sl('fuzzScale','Fuzz Scale',.2,3,.05,v=>v.toFixed(2)),sl('fuzzOcc','Fuzz Occlusion'),
    el('div',{class:'sub',text:'Surface'}),sl('surface','Skin roughness'),sl('oil','Secondary reflection'));}
{const f=renderShading;renderShading=function(){f.apply(this,arguments);
  try{const box=document.getElementById('shadeBody'),tabs=box&&box.querySelector('#shKind');if(!tabs||ui.mode==='bake'||ui.mode==='convert')return;const sh=v3ShadeOf(doc),body=tabs.nextElementSibling;if(!body)return;
    if(sh.kind==='skin'){const keep=[];for(const id of ['sh_oline','sh_outline','sh_ocol']){const n=body.querySelector('#'+id);const r=n&&(n.closest('.chk,.srow,.frow')||n);if(r&&!keep.includes(r))keep.push(r);}
      const slots=body.querySelector('#shSlots');body.replaceChildren(skSkinUI(sh),skReflRow(sh),...(keep.length?[el('div',{class:'sub',text:'Outline'}),...keep]:[]),...(slots?[slots]:[]));}
    else if(SK_REFL.includes(sh.kind))body.prepend(skReflRow(sh));}catch(e){console.warn('skin settings',e);}};}
/* Specular reflectivity shows the Specular colour channel in the Material slots in place of Metallic */
{const f=slotList;slotList=function(kind){const L=f.apply(this,arguments);if(!skReflSpec(v3ShadeOf(doc)))return L;return L.map(x=>x[0]==='metal'?['specc','Specular colour']:x);};}
