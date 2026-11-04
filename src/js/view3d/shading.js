/* ================= Viewer shaders, per texture set (0.26) =================
   How the model is shaded in the 3D view, chosen per texture set (so skin and armour can differ on one model):
   Standard (PBR), Skin (light wraps round and shines through thin parts, using the baked thickness), Brushed
   metal (anisotropic highlights along a direction), Velvet (a soft sheen at grazing angles), Toon (flat bands)
   and Cel (two tones), both with an outline, and a Spec/Gloss view (lit, or diffuse colour, specular colour,
   glossiness or reflections alone). Each shader has its own tab of settings in the Shader panel, and keeps
   them when you switch. Kept in the document (doc.v3shade) and so per texture set in 3D Paint. */
const SHADERS=[['std','Standard'],['skin','Skin'],['aniso','Brushed metal'],['velvet','Velvet'],['toon','Toon'],['cel','Cel'],['specgloss','Spec/Gloss'],['panner','Panner (PBR)'],['retro','Retro (N64 / PSX)'],['hologram','Hologram'],['glass','Glass'],['fur','Fur'],['iridescent','Iridescent'],['car','Car paint'],['cloth','Cloth sheen'],['wax','Wax / marble glow']];
const SH_DEF={std:{},skin:{scatter:.5,strength:.6,soft:.5,thick:.5,oil:.3,surface:.45,depth:1,transmission:.5,col:[.85,.25,.18]},aniso:{amount:.7,dir:0},velvet:{sheen:.8,srough:.5,rim:1,col:[1,1,1]},
  toon:{steps:3,spec:.3,rim:.2,offset:0,col:[.45,.4,.55],outline:2,ocol:[0,0,0]},cel:{thresh:.5,soft:.06,spec:.3,rim:.15,col:[.45,.42,.55],outline:2,ocol:[0,0,0]},specgloss:{view:0},panner:{sx:0,sy:.25,play:true,layer:0,maps:{base:true,rough:true,metal:true,nfinal:true,ao:true,emis:true,opac:true}},
  retro:{bright:1,res:32,filt:1,br:5,bg:5,bb:5,dither:.6,steps:0,amb:.35,wobble:0,fog:0,fogc:[.5,.55,.65],preset:'n64'},
  hologram:{lines:40,flicker:.35,glow:1.4,opacity:.8,speed:.6,fill:.5,glitch:.5,pulse:.5,sweep:.6,col:[.2,.85,1]},glass:{refr:.5,frost:0,thick:.5,edge:1,cloud:.08,disp:.2,col:[.9,.97,1]},
  fur:{length:.5,density:90,clump:.3,wind:.3,windSpeed:1,root:.5,width:.7,tipMix:.5,gravity:.3,col:[.95,.85,.7]},iridescent:{strength:.8,shift:0,range:1.5,angle:.8},
  car:{flakes:.5,size:170,coat:1,sparkle:1,coatRough:.04,peel:.3,col:[1,.85,.5]},cloth:{sheen:1,soft:.5,fibre:0,aniso:.5,weave:.4,col:[1,.9,.85]},wax:{glow:1.5,depth:.7,soft:.6,thick:.5,col:[1,.62,.3]}};
/* (0.70, Kenn) Retro shader: old-school console looks for the viewport */
const RETRO_SHADER_PRESETS=[['n64','Nintendo 64',{res:32,filt:1,br:5,bg:5,bb:5,dither:.6,steps:0,amb:.4,wobble:0,fog:.25}],['psx','PlayStation',{res:64,filt:0,br:5,bg:5,bb:5,dither:.9,steps:0,amb:.35,wobble:.6,fog:.3}],['saturn','Saturn',{res:64,filt:0,br:5,bg:5,bb:5,dither:0,steps:0,amb:.35,wobble:.2,fog:0}],['dc','Dreamcast',{res:128,filt:2,br:5,bg:6,bb:5,dither:.4,steps:0,amb:.4,wobble:0,fog:0}],['chunky','Chunky 3-bit',{res:16,filt:0,br:1,bg:1,bb:1,dither:.9,steps:3,amb:.3,wobble:.3,fog:0}]];
function v3ShadeOf(D){const d=D&&D.v3shade;return d&&d.kind?d:{kind:'std',p:{}};}
function shParams(sh,k){return Object.assign({},SH_DEF[k||sh.kind]||{},(sh.p&&sh.p[k||sh.kind])||{});}
function shadeUniforms(sh){if(!sh)return Object.assign({uSkin:[.45,1,.5,0],uSh:{int:0},uShP:[0,0,0,.5],uShQ:[0,0,0,0],uShC:[1,1,1],uShD:[0,0,0],uSnap:0},pnUniforms(null));const k=sh.kind,P=shParams(sh),i=Math.max(0,SHADERS.findIndex(x=>x[0]===k));
  const v={skin:[P.scatter,P.strength,P.soft,P.thick],aniso:[P.amount,P.dir,0,.5],velvet:[P.sheen,P.srough,P.rim,.5],toon:[P.steps,0,P.spec,P.rim],cel:[P.thresh,P.soft,P.spec,P.rim],specgloss:[P.view,0,0,.5],retro:[P.res,P.filt,P.dither,0],hologram:[P.lines,P.flicker,P.glow,P.opacity],glass:[P.refr,P.frost,P.thick,P.edge],fur:[P.length,P.density,P.clump,P.wind],iridescent:[P.strength,P.shift,P.range,P.angle],car:[P.flakes,P.size,P.coat,P.sparkle],cloth:[P.sheen,P.soft,P.fibre,P.aniso],wax:[P.glow,P.depth,P.soft,P.thick]}[k]||[0,0,0,.5];
  const q={hologram:[P.speed,P.fill,P.glitch,P.pulse],glass:[P.cloud,P.disp,0,0],fur:[P.windSpeed,P.root,P.width,P.tipMix],car:[P.coatRough,P.peel,0,0],cloth:[P.weave,0,0,0]}[k];
  return Object.assign({uSkin:k==='skin'?[P.surface,P.depth,P.transmission,0]:k==='fur'?[P.gravity,0,0,0]:[.45,1,.5,0],uSh:{int:i},uShP:v,uShQ:q?q:k==='retro'?[P.steps||0,P.fog||0,P.amb==null?.35:P.amb,P.bright==null?1:P.bright]:[P.outline||0,P.offset||0,k==='skin'?(P.oil||0):0,0],uShC:k==='retro'?[(1<<P.br)-1,(1<<P.bg)-1,(1<<P.bb)-1]:P.col||[1,1,1],uShD:k==='retro'?P.fogc:k==='hologram'?[P.sweep,0,0]:P.ocol||[0,0,0],uSnap:k==='retro'&&P.wobble>0?320-280*P.wobble:0,uTime:pnNow()},pnUniforms(k==='panner'?P:null));}
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

/* (0.95) Hologram and Glass are drawn after the solid parts and blended over them; Fur is grown in shells (the surface drawn again and again, a little further out each time, keeping only the strand dots) */
const FUR_SHELLS=24,FUR_LEN=.09;
const VS_3DFUR=VS_3D.replace('vec3 p=aP;','vec3 p=aP+aN*uOutW+uOutD*(0.45+0.55*sin(dot(aP,vec3(3.1,1.7,2.3))+uTime*uWindS));').replace('uniform mat4 uVP;','uniform mat4 uVP; uniform float uOutW; uniform vec3 uOutD; uniform float uTime; uniform float uWindS;');
let P3FUR=null;
function v3KindOf(C,it){if(C.bake)return '';const sh=it.sh||v3ShadeOf(doc);return sh&&sh.kind||'';}
function v3DrawFur(items,g){if(!items.length)return;if(!P3FUR)P3FUR=prog3(VS_3DFUR,FS_3D);gl.bindVertexArray(g.vao);
  for(const [it,U] of items){const P=shParams(it.sh||v3ShadeOf(doc),'fur');
    for(let n=1;n<=FUR_SHELLS;n++){const k=n/FUR_SHELLS,w=P.length*FUR_LEN*k;
      useProg(P3FUR,Object.assign({},U,{uFurK:k,uOutW:w,uOutD:[P.wind*FUR_LEN*.6*k*k,-P.gravity*FUR_LEN*k*k,P.wind*FUR_LEN*.25*k*k],uWindS:P.windSpeed*2}));
      gl.drawElements(gl.TRIANGLES,it.count*3,gl.UNSIGNED_INT,it.start*12);}}}
function v3DrawAlpha(items,C,common,flip,g){if(!items.length)return;gl.bindVertexArray(g.vao);gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  try{for(const it of items){useProg(P3.mesh,v3MeshU(C,common,it,flip,null));gl.drawElements(gl.TRIANGLES,it.count*3,gl.UNSIGNED_INT,it.start*12);}}
  finally{gl.depthMask(true);gl.disable(gl.BLEND);}}
/* does a shader move by itself (so the view must keep drawing)? */
function shMoves(sh){if(!sh)return false;const P=shParams(sh);return (sh.kind==='hologram'&&(P.speed>0||P.flicker>0||P.glitch>0||P.pulse>0||P.sweep>0))||(sh.kind==='fur'&&P.wind>0&&P.windSpeed>0);}
/* ---- the Shader panel: a tab per shader, each with its own settings ---- */
function shadeEdit(fn){const d=doc.v3shade||(doc.v3shade={kind:'std',p:{}});if(!d.p)d.p={};fn(d);v3.dirty=true;requestRender();}
function renderShading(){const box=document.getElementById('shadeBody');if(!box)return;const sh=v3ShadeOf(doc),k=sh.kind,P=shParams(sh);
  const setP=(key,v)=>shadeEdit(d=>{d.p[k]=Object.assign({},shParams(d,k),{[key]:v});});
  const sl=(key,label,min=0,max=1,step=.01,fmt)=>makeSlider({id:'sh_'+key,label,min,max,step,value:P[key],fmt:fmt||pct,onInput:v=>setP(key,v)}).el;
  const colr=(key,label)=>el('div',{class:'frow'},el('span',{text:label}),colourBtn('sh_'+key,()=>P[key],c=>setP(key,c),label));
  const who=ui.mode==='p3d'&&typeof p3!=='undefined'&&p3.sets[p3.cur]?'texture set “'+p3.sets[p3.cur].name+'”':'this document';
  /* a drop-down list of the shaders (Kenn); each keeps its own settings below it */
  const tabs=el('select',{id:'shKind',class:'shsel','aria-label':'Shader'},...SHADERS.map(([id,l])=>el('option',{value:id,text:l})));tabs.value=k;tabs.onchange=()=>{const v=tabs.value,apply=()=>{shadeEdit(d=>{d.kind=v;});renderShading();};
    /* (0.51.31) Spec/Gloss is the set's workflow too: switching converts its maps (as in the Maps dialog) before the shader changes */
    if(v==='specgloss'&&doc.workflow!=='spec'){wfAsk('spec',()=>{if(doc.workflow==='spec')apply();else renderShading();});renderShading();return;}
    apply();};
  const body=el('div',{class:'dlg-grid'});
  if(k==='std')body.append(el('p',{class:'note',text:'Physically based shading (metal/roughness), lit by the environment chosen below.'}));
  if(k==='skin')body.append(seg([['natural','Natural skin'],['soft','Soft skin'],['wax','Wax']],null,id=>{const presets={natural:{scatter:.5,strength:.6,soft:.5,oil:.3,surface:.45,depth:1,transmission:.5,col:[.85,.25,.18]},soft:{scatter:.7,strength:.8,soft:.65,oil:.15,surface:.55,depth:1.4,transmission:.35,col:[1,.35,.22]},wax:{scatter:.85,strength:.9,soft:.8,oil:.1,surface:.3,depth:.6,transmission:.8,col:[1,.72,.4]}};shadeEdit(d=>{d.p.skin=presets[id];});renderShading();},'Skin preset'),sl('surface','Surface roughness',.08,1),sl('depth','Scatter depth',.1,4,.05,v=>v.toFixed(2)),sl('transmission','Transmission'),sl('scatter','Scatter'),sl('strength','Strength'),sl('soft','Softness'),sl('oil','Oily sheen'),colr('col','Subsurface colour'),
    ...(doc.meshMaps&&doc.meshMaps.thick?[el('p',{class:'note',text:'Thin parts glow, from the baked Thickness map.'})]:[sl('thick','Thickness'),el('p',{class:'note',text:'Bake a Thickness map (Bake mesh maps) so thin parts like ears glow on their own.'})]));
  if(k==='aniso')body.append(sl('amount','Stretch',-1,1,.01,v=>Math.round(v*100)+'%'),sl('dir','Direction',0,1,.01,v=>Math.round(v*360)+'°'),el('p',{class:'note',text:'Highlights stretch along the model’s UV direction, turned by Direction, like brushed or spun metal.'}));
  if(k==='velvet')body.append(sl('sheen','Sheen',0,2,.01),sl('srough','Sheen softness'),sl('rim','Rim',0,3,.05,v=>v.toFixed(2)),colr('col','Sheen colour'));
  if(k==='toon')body.append(sl('steps','Bands',1,6,1,v=>String(v)),sl('offset','Band shift',-1,1,.01,v=>v.toFixed(2)),colr('col','Shadow colour'),sl('spec','Highlight'),sl('rim','Rim light'),sl('outline','Outline',0,10,.5,v=>v?v+' px':'off'),colr('ocol','Outline colour'));
  if(k==='cel')body.append(sl('thresh','Shadow line'),sl('soft','Edge softness',0,.5,.01),colr('col','Shadow colour'),sl('spec','Highlight'),sl('rim','Rim light'),sl('outline','Outline',0,10,.5,v=>v?v+' px':'off'),colr('ocol','Outline colour'));
  if(k==='specgloss')body.append((()=>{const g=seg([[0,'Lit'],[1,'Diffuse'],[2,'Specular'],[3,'Gloss'],[4,'Reflections']],P.view,v=>{setP('view',+v);},'Spec/Gloss view');g.classList.add('themeseg');return g;})(),
    el('p',{class:'note',text:'See the diffuse colour, the specular colour, the glossiness or the reflections alone, as a Specular/Gloss material would store them.'}));
  if(k==='retro')body.append(el('p',{class:'note',text:'An old-school console look: a small grid of texels, console filtering, 15/16-bit colour with a dither, a plain light and fog. Pick a console, then adjust.'}),
    el('div',{class:'chips'},...RETRO_SHADER_PRESETS.map(([id,name,o])=>el('button',{class:'chip'+(P.preset===id?' on':''),id:'shRetro_'+id,text:name,onclick:()=>{shadeEdit(d=>{d.p.retro=Object.assign({},shParams(d,'retro'),o,{preset:id});});renderShading();}}))),
    sl('res','Texture size',4,256,1,v=>v+' texels across'),seg([[0,'None (PSX)'],[1,'3-point (N64)'],[2,'Bilinear']],P.filt,v=>setP('filt',+v),'Texture filtering'),
    sl('br','Red bits',1,8,1,v=>v+' bits'),sl('bg','Green bits',1,8,1,v=>v+' bits'),sl('bb','Blue bits',1,8,1,v=>v+' bits'),sl('dither','Dither',0,1.5,.01),
    sl('steps','Light bands',0,8,1,v=>v?String(v):'smooth'),sl('amb','Ambient light',0,1,.01),sl('bright','Brightness',.4,2,.01),sl('wobble','Vertex wobble',0,1,.01,v=>v?Math.round(v*100)+'%':'off'),sl('fog','Fog',0,1,.01,v=>v?Math.round(v*100)+'%':'off'),colr('fogc','Fog colour'));
  if(k==='hologram')body.append(el('p',{class:'note',text:'A see-through projected look: glowing edges, moving scan lines and a flicker. The model behind it shows through.'}),colr('col','Colour'),sl('opacity','See-through (1 = most solid)'),sl('glow','Edge glow',0,3,.05,v=>v.toFixed(2)),sl('lines','Scan lines',4,160,1,v=>String(v)),sl('speed','Scan speed',0,3,.05,v=>v.toFixed(2)),sl('flicker','Flicker'),sl('glitch','Glitch slices'),sl('pulse','Edge pulse'),sl('sweep','Sweep band'),sl('fill','Body glow'));
  if(k==='glass')body.append(el('p',{class:'note',text:'Bends the sky and shows the model’s own back parts through it. Use the normal map for ripples.'}),colr('col','Tint'),sl('refr','Bending'),sl('frost','Frost'),sl('thick','Thickness (tint depth)',0,2,.05,v=>v.toFixed(2)),sl('edge','Edge reflections',0,2,.05,v=>v.toFixed(2)),sl('cloud','Cloudiness'),sl('disp','Colour split'));
  if(k==='fur')body.append(el('p',{class:'note',text:'Fur grown from the surface in layers. The base colour map colours it; the tip colour fades in towards the ends. More strands cost more on big models.'}),sl('length','Length'),sl('density','Strands',8,260,1,v=>String(v)),sl('width','Strand thickness'),sl('clump','Clumping'),sl('root','Dark roots'),colr('col','Tip colour'),sl('tipMix','Tip colour amount'),sl('wind','Wind'),sl('windSpeed','Wind speed',0,4,.05,v=>v.toFixed(2)),sl('gravity','Droop'));
  if(k==='iridescent')body.append(el('p',{class:'note',text:'Colour that shifts with the angle you look from, like a soap bubble, beetle shell or oil slick.'}),sl('strength','Strength'),sl('range','Colour range',.2,5,.05,v=>v.toFixed(2)),sl('shift','Colour shift'),sl('angle','Angle effect'));
  if(k==='car')body.append(el('p',{class:'note',text:'A coloured base under a glossy clear coat, with metallic flakes that sparkle as you move.'}),sl('coat','Clear coat'),sl('coatRough','Coat roughness',0,.5,.01),sl('peel','Orange peel'),sl('flakes','Flake amount'),sl('size','Flake size (smaller number = bigger)',10,300,1,v=>String(v)),sl('sparkle','Flake sparkle',0,2,.05,v=>v.toFixed(2)),colr('col','Flake colour'));
  if(k==='cloth')body.append(el('p',{class:'note',text:'Soft sheen on fabric. Set Fibre direction and Satin streak for satin or silk; leave streak low for felt and velvet-like cloth.'}),sl('sheen','Sheen',0,2,.01),sl('soft','Softness'),sl('aniso','Satin streak'),sl('fibre','Fibre direction',0,1,.01,v=>Math.round(v*360)+'°'),sl('weave','Weave pattern'),colr('col','Sheen colour'));
  if(k==='wax')body.append(el('p',{class:'note',text:'Light travelling through the surface, like wax, jade or marble. A baked Thickness map makes thin parts glow more.'}),colr('col','Glow colour'),sl('glow','Glow',0,2,.01),sl('depth','How far light travels'),sl('soft','Surface softness'),sl('thick','Thickness'));
  if(k==='panner')body.append(...pnPanelRows(P,setP,sl));
  if(ui.mode==='p3d'&&typeof bevelSection==='function')body.append(bevelSection(renderShading,'sh'));
  body.append(el('div',{class:'chips resetrow'},el('button',{class:'btn sm',id:'shReset',text:'Reset this shader',title:'Put this shader’s settings back to how they start',onclick:()=>{shadeEdit(d=>{delete d.p[k];});renderShading();}})));
  /* (0.27, Kenn) the environment (HDRI) lives here too: the lighting the shaders are seen in */
  const envS=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:v3s()[key],fmt,onInput:v=>{v3s()[key]=v;v3.dirty=true;requestRender();}}).el;
  const envPart=typeof envSettingsBox==='function'?[el('div',{class:'sub',text:'Environment'}),el('p',{class:'note',text:'The HDRI lighting the model. Shift + right-drag in the 3D view turns it.'}),envSettingsBox(envS,'sh')]:[];
  box.replaceChildren(el('p',{class:'note',text:'Shader for '+who+'. Each shader keeps its own settings.'}),tabs,body,...envPart,studioSettingsBox(envS,'shStudio'),el('div',{class:'sub',text:'Post processing'}),el('p',{class:'note',text:'Effects laid over the picture of the model. They also go into screenshots and renders.'}),postBox());}
