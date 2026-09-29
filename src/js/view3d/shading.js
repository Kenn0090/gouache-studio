/* ================= Viewer shaders, per texture set (0.26) =================
   How the model is shaded in the 3D view, chosen per texture set (so skin and armour can differ on one model):
   Standard (PBR), Skin (light wraps round and shines through thin parts, using the baked thickness), Brushed
   metal (anisotropic highlights along a direction), Velvet (a soft sheen at grazing angles), Toon (flat bands)
   and Cel (two tones), both with an outline, and a Spec/Gloss view (lit, or diffuse colour, specular colour,
   glossiness or reflections alone). Each shader has its own tab of settings in the Shader panel, and keeps
   them when you switch. Kept in the document (doc.v3shade) and so per texture set in 3D Paint. */
const SHADERS=[['std','Standard'],['skin','Skin'],['aniso','Brushed metal'],['velvet','Velvet'],['toon','Toon'],['cel','Cel'],['specgloss','Spec/Gloss']];
const SH_DEF={std:{},skin:{scatter:.5,strength:.6,soft:.5,thick:.5,col:[.85,.25,.18]},aniso:{amount:.7,dir:0},velvet:{sheen:.8,srough:.5,rim:1,col:[1,1,1]},
  toon:{steps:3,spec:.3,rim:.2,offset:0,col:[.45,.4,.55],outline:2,ocol:[0,0,0]},cel:{thresh:.5,soft:.06,spec:.3,rim:.15,col:[.45,.42,.55],outline:2,ocol:[0,0,0]},specgloss:{view:0}};
function v3ShadeOf(D){const d=D&&D.v3shade;return d&&d.kind?d:{kind:'std',p:{}};}
function shParams(sh,k){return Object.assign({},SH_DEF[k||sh.kind]||{},(sh.p&&sh.p[k||sh.kind])||{});}
function shadeUniforms(sh){if(!sh)return {uSh:{int:0},uShP:[0,0,0,.5],uShQ:[0,0,0,0],uShC:[1,1,1],uShD:[0,0,0]};const k=sh.kind,P=shParams(sh),i=Math.max(0,SHADERS.findIndex(x=>x[0]===k));
  const v={skin:[P.scatter,P.strength,P.soft,P.thick],aniso:[P.amount,P.dir,0,.5],velvet:[P.sheen,P.srough,P.rim,.5],toon:[P.steps,0,P.spec,P.rim],cel:[P.thresh,P.soft,P.spec,P.rim],specgloss:[P.view,0,0,.5]}[k]||[0,0,0,.5];
  return {uSh:{int:i},uShP:v,uShQ:[P.outline||0,P.offset||0,0,0],uShC:P.col||[1,1,1],uShD:P.ocol||[0,0,0]};}
/* the outline for Toon and Cel: the back faces drawn slightly larger, in the outline colour */
const VS_3DOUT=VS_3D.replace('vec3 p=aP;','vec3 p=aP+aN*uOutW;').replace('uniform mat4 uVP;','uniform mat4 uVP; uniform float uOutW;');
/* only the faces turned away from the camera are drawn, so it works whichever way the model's faces wind */
const FS_3DOUT=`in vec3 vP; in vec3 vN; in vec2 vT; in vec4 vTan; uniform vec3 uCamO; uniform vec4 uCol; void main(){ if(dot(normalize(vN),normalize(uCamO-vP))>0.0) discard; o=uCol; }`;
let P3OUT=null;
function v3DrawOutlines(list,common,F,flip){const eye=v3Eye(),c=v3.cam,dist=Math.hypot(eye[0]-c.tx,eye[1]-c.ty,eye[2]-c.tz),pxW=2*dist*Math.tan(v3s().fov*Math.PI/360)/F.h;let on=false;
  for(const it of list){const sh=it.sh;if(!sh||(sh.kind!=='toon'&&sh.kind!=='cel'))continue;const P=shParams(sh);if(!(P.outline>0)||!it.count)continue;
    if(!P3OUT)P3OUT=prog3(VS_3DOUT,FS_3DOUT);on=true;
    useProg(P3OUT,Object.assign({},common,{uOutW:P.outline*pxW,uCol:[...P.ocol,1],uCamO:eye}));gl.drawElements(gl.TRIANGLES,it.count*3,gl.UNSIGNED_INT,it.start*12);}
  return on;}
/* ---- the Shader panel: a tab per shader, each with its own settings ---- */
function shadeEdit(fn){const d=doc.v3shade||(doc.v3shade={kind:'std',p:{}});if(!d.p)d.p={};fn(d);v3.dirty=true;requestRender();}
function renderShading(){const box=document.getElementById('shadeBody');if(!box)return;const sh=v3ShadeOf(doc),k=sh.kind,P=shParams(sh);
  const setP=(key,v)=>shadeEdit(d=>{d.p[k]=Object.assign({},shParams(d,k),{[key]:v});});
  const sl=(key,label,min=0,max=1,step=.01,fmt)=>makeSlider({id:'sh_'+key,label,min,max,step,value:P[key],fmt:fmt||pct,onInput:v=>setP(key,v)}).el;
  const colr=(key,label)=>el('div',{class:'frow'},el('span',{text:label}),colourBtn('sh_'+key,()=>P[key],c=>setP(key,c),label));
  const who=ui.mode==='p3d'&&typeof p3!=='undefined'&&p3.sets[p3.cur]?'texture set “'+p3.sets[p3.cur].name+'”':'this document';
  /* a drop-down list of the shaders (Kenn); each keeps its own settings below it */
  const tabs=el('select',{id:'shKind',class:'shsel','aria-label':'Shader'},...SHADERS.map(([id,l])=>el('option',{value:id,text:l})));tabs.value=k;tabs.onchange=()=>{shadeEdit(d=>{d.kind=tabs.value;});renderShading();};
  const body=el('div',{class:'dlg-grid'});
  if(k==='std')body.append(el('p',{class:'note',text:'Physically based shading (metal/roughness), lit by the environment chosen below.'}));
  if(k==='skin')body.append(sl('scatter','Scatter'),sl('strength','Strength'),sl('soft','Softness'),colr('col','Subsurface colour'),
    ...(doc.meshMaps&&doc.meshMaps.thick?[el('p',{class:'note',text:'Thin parts glow, from the baked Thickness map.'})]:[sl('thick','Thickness'),el('p',{class:'note',text:'Bake a Thickness map (Bake mesh maps) so thin parts like ears glow on their own.'})]));
  if(k==='aniso')body.append(sl('amount','Stretch',-1,1,.01,v=>Math.round(v*100)+'%'),sl('dir','Direction',0,1,.01,v=>Math.round(v*360)+'°'),el('p',{class:'note',text:'Highlights stretch along the model’s UV direction, turned by Direction, like brushed or spun metal.'}));
  if(k==='velvet')body.append(sl('sheen','Sheen',0,2,.01),sl('srough','Sheen softness'),sl('rim','Rim',0,3,.05,v=>v.toFixed(2)),colr('col','Sheen colour'));
  if(k==='toon')body.append(sl('steps','Bands',1,6,1,v=>String(v)),sl('offset','Band shift',-1,1,.01,v=>v.toFixed(2)),colr('col','Shadow colour'),sl('spec','Highlight'),sl('rim','Rim light'),sl('outline','Outline',0,10,.5,v=>v?v+' px':'off'),colr('ocol','Outline colour'));
  if(k==='cel')body.append(sl('thresh','Shadow line'),sl('soft','Edge softness',0,.5,.01),colr('col','Shadow colour'),sl('spec','Highlight'),sl('rim','Rim light'),sl('outline','Outline',0,10,.5,v=>v?v+' px':'off'),colr('ocol','Outline colour'));
  if(k==='specgloss')body.append((()=>{const g=seg([[0,'Lit'],[1,'Diffuse'],[2,'Specular'],[3,'Gloss'],[4,'Reflections']],P.view,v=>{setP('view',+v);},'Spec/Gloss view');g.classList.add('themeseg');return g;})(),
    el('p',{class:'note',text:'See the diffuse colour, the specular colour, the glossiness or the reflections alone, as a Specular/Gloss material would store them.'}));
  /* (0.27, Kenn) the environment (HDRI) lives here too: the lighting the shaders are seen in */
  const envS=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:v3s()[key],fmt,onInput:v=>{v3s()[key]=v;v3.dirty=true;requestRender();}}).el;
  const envPart=typeof envSettingsBox==='function'?[el('div',{class:'sub',text:'Environment'}),el('p',{class:'note',text:'The HDRI lighting the model. Shift + right-drag in the 3D view turns it.'}),envSettingsBox(envS,'sh')]:[];
  box.replaceChildren(el('p',{class:'note',text:'Shader for '+who+'. Each shader keeps its own settings.'}),tabs,body,...envPart);}
