/* ================= Material slots (0.97.26, Georgian via Kenn: "a custom shader/material setup like Painter's SSS shader and Marmoset's") =================
   Under each shader's own settings in the Shader panel, a list of the slots that shader reads, like Marmoset's material editor:
   for each slot you choose where it comes from:
     Value    the channel is not in the texture set; the shader uses one number (or the look's own setting above)
     Painted  the channel is in the set and you paint it (Paint button), like any map
     Picture  the channel is in the set and a new layer brings a picture into it
   Painter's half: picking a shader that has its own channels (Skin) adds them to the set by itself. */
const SLOT_COMMON=[['rough','Roughness'],['metal','Metallic'],['specl','Specular level'],['spec','Specular'],['gloss','Glossiness'],['height','Height'],['normal','Normal'],['ao','Ambient occlusion'],['emis','Emissive'],['opac','Opacity']];
const SLOT_LOOK={skin:[['sss','Scattering'],['sssc','Scatter colour'],['trans','Translucency']],fur:[['fur','Fur mask']]};
const SLOT_AUTO={skin:['sss','sssc','trans']};
function slotList(kind){const wf=doc.workflow==='spec'?'spec':'metal',skip=WF_KEYS[wf==='spec'?'metal':'spec'];
  const L=[...(SLOT_LOOK[kind]||[]),...SLOT_COMMON.filter(([k])=>!skip.includes(k)&&!(wf==='spec'&&k==='specl'))];
  for(const k of MAP_USER)if(doc.maps.includes(k))L.push([k,MAP_DEFS[k].label]);return L;}
const slotSrc=k=>doc.maps.includes(k)?(paintLayers().some(L=>L.slotPic===k)?'pic':'paint'):'value';
/* a picture into channel k of a new layer (grey channels take the picture's brightness) */
const FS_SLOTPIC=`uniform sampler2D uSrc; uniform int uGrey; uniform vec2 uSz;
void main(){ vec4 c=texture(uSrc,gl_FragCoord.xy/uSz); if(uGrey==1){ float a=c.a; vec3 s=a>1e-5?c.rgb/a:vec3(0.0); float g=dot(s,vec3(0.2126,0.7152,0.0722)); o=vec4(vec3(g)*a,a); return; } o=c; }`;
let P_SLOTPIC=null;
async function slotPicture(k,file){if(!file){const f=await pickFiles('image/*,.tga,.tif,.tiff,.dds,.psd',false,'Pictures',['png','jpg','jpeg','webp','tga','tif','tiff','dds','bmp','psd']);file=f&&f[0];}if(!file)return;
  if(/\.psd$/i.test(file.name)){try{await loadPaint();needLib('agPsd','PSD');await psdIntoChannel(await file.arrayBuffer(),baseName(file.name),k);}catch(e){toast('Could not use that PSD: '+(e.message||e));}return;}
  let raw,tx=null,src=null,fit=null;try{raw=await decodeFile(file);
    if(!doc.maps.includes(k))setDocMaps(doc.maps.concat(k),MAP_DEFS[k].label);
    tx=uploadStraight(raw);src=makeTarget(raw.w,raw.h,8,false);premultInto(src,tx,[0,0],null);fit=makeTarget(doc.w,doc.h,8,false);copyScaled(src,fit);
    const A=doc.active,parent=A?(A.parent||doc.root):doc.root,idx=A?parent.children.indexOf(A)+1:doc.root.children.length,L=newLayerObj(MAP_DEFS[k].label+': '+baseName(file.name),true);
    if(!P_SLOTPIC)P_SLOTPIC=program(FS_SLOTPIC);run(P_SLOTPIC,ensureMapTarget(L,k),{uSrc:fit.tex,uGrey:{int:MAP_DEFS[k].grey?1:0},uSz:[doc.w,doc.h]});L.blankBase=true;L.slotPic=k;
    structOp(MAP_DEFS[k].label+' from a picture',()=>{insertNode(L,parent,idx);selectOnly(L);});changedAll();renderShading();
    toast('The picture is in '+MAP_DEFS[k].label+' (layer “'+L.name+'”). Paint on it to fix spots.');}
  catch(e){toast('Could not use that picture: '+(e.message||e));}
  finally{if(tx)gl.deleteTexture(tx);disposeTarget(src);disposeTarget(fit);if(raw&&raw.el)URL.revokeObjectURL(raw.el.src);}}
function slotPaint(k){if(!doc.maps.includes(k))setDocMaps(doc.maps.concat(k),MAP_DEFS[k].label);setEditMap(k);if(typeof setView==='function')setView(k);
  if(typeof setTool==='function'&&!['brush','erase','fill','gradient','bucket'].includes(ui.tool))setTool('brush');
  toast('Painting '+MAP_DEFS[k].label+'. Pick Base colour in the channel list to paint colour again.');renderShading();}
function slotValue(k){if(!doc.maps.includes(k))return;const used=paintLayers().some(L=>hasMap(L,k));
  const go=()=>{setDocMaps(doc.maps.filter(x=>x!==k),MAP_DEFS[k].label+' off');renderShading();};
  if(used)confirmDlg('Use a value for '+MAP_DEFS[k].label+'?','What was painted in '+MAP_DEFS[k].label+' is taken out of the texture set (Undo brings it back).','Use a value',go);else go();}
/* the value used where a channel is not painted (Roughness, Metallic: doc.mapDef, as in Document maps) */
function slotValueCtl(k){if(k!=='rough'&&k!=='metal')return el('span',{class:'dim slotv',text:SLOT_LOOK.skin.some(x=>x[0]===k)?'the look’s setting above':k==='specl'?'normal (4%)':'none'});
  const v=mapDefault(k)[0];return makeSlider({id:'slv_'+k,label:'',min:0,max:100,step:1,value:Math.round(v*100),fmt:x=>x+'%',onInput:x=>{doc.mapDef=Object.assign({},doc.mapDef,{[k]:x/100});if(typeof v3Refresh==='function')v3.mapsDirty=true;requestRender(true);}}).el;}
function slotsBox(kind){const rows=slotList(kind).map(([k,label])=>{const src=slotSrc(k),sel=el('select',{id:'slot_'+k,class:'shsel slotsel','aria-label':label+' comes from'},
      el('option',{value:'value',text:'Value'}),el('option',{value:'paint',text:'Painted'}),el('option',{value:'pic',text:'Picture'}));sel.value=src;
    sel.onchange=()=>{const v=sel.value;sel.value=src;if(v==='value')slotValue(k);else if(v==='paint')slotPaint(k);else slotPicture(k);};
    const act=src==='value'?slotValueCtl(k):el('span',{class:'slotacts'},el('button',{type:'button',class:'btn sm',id:'slotPaint_'+k,text:doc.map===k?'Painting':'Paint',onclick:()=>slotPaint(k)}),
      el('button',{type:'button',class:'btn sm',id:'slotPic_'+k,text:'Picture…',title:'Bring a picture into '+label+' as a new layer',onclick:()=>slotPicture(k)}));
    return el('div',{class:'slotrow'+(src==='value'?'':' on'),title:MAP_DEFS[k].hint||''},el('span',{class:'slotname',text:label}),sel,act);});
  return el('div',{class:'slots',id:'shSlots'},el('div',{class:'sub',text:'Material slots'}),
    el('p',{class:'note',text:'Where each input of this shader comes from: one value, a channel you paint, or a picture. Painted channels are exported with the textures.'}),...rows,
    el('button',{type:'button',class:'btn sm',id:'slotAddOwn',text:'+ Channel of your own…',onclick:()=>dlgMaps()}));}
/* Painter's half: picking a shader with its own channels adds them to the set */
function slotAutoAdd(kind){const want=(SLOT_AUTO[kind]||[]).filter(k=>!doc.maps.includes(k));if(!want.length)return;
  setDocMaps(doc.maps.concat(want),MAP_DEFS[want[0]].label+' and more');
  toast('Added '+want.map(k=>MAP_DEFS[k].label).join(', ')+' to “'+(doc.name||'this set')+'”. Paint them, or set them to Value under Material slots.');}
{const f=renderShading;renderShading=function(){const kind0=typeof v3ShadeOf==='function'&&v3ShadeOf(doc).kind;f.apply(this,arguments);
  try{const box=document.getElementById('shadeBody'),tabs=box&&box.querySelector('#shKind');if(!tabs||ui.mode==='bake'||ui.mode==='convert')return;
    if(!tabs._slotHook){tabs._slotHook=1;const on=tabs.onchange;tabs.onchange=function(){const v=tabs.value;on.apply(this,arguments);if(v3ShadeOf(doc).kind===v&&v!==kind0)slotAutoAdd(v);};}
    const body=tabs.nextElementSibling;if(body)body.append(slotsBox(v3ShadeOf(doc).kind));}catch(e){console.warn('material slots',e);}};}
