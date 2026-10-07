/* Library material strokes share a compact coverage mask across their channels.
   Pixel-layer callers can also sample directly in the existing stroke merge. */
const materialBrush={rec:null,tile:1,loading:false};
let P_MATERIALMERGE=null,P_MATERIALCOMP=null,P_WELDMERGE=null,P_WELDCOMP=null;
function materialStrokeProgram(comp,solid=false){if(solid){let p=comp?P_WELDCOMP:P_WELDMERGE;if(p)return p;
  const body=(comp?FS_COMP:FS_MERGE).replace(/gSC=uStrokeTint==1\?st.rgb:uStrokeColor;/g,'gSC=uMatColor.rgb; st.a*=uMatColor.a;');
  p=program('uniform vec4 uMatColor;\n'+body);p.defaults=Object.assign({},comp?P.comp.defaults:P.merge.defaults);if(comp)P_WELDCOMP=p;else P_WELDMERGE=p;return p;}
if(comp&&P_MATERIALCOMP)return P_MATERIALCOMP;if(!comp&&P_MATERIALMERGE)return P_MATERIALMERGE;
  const sample=FS_FILLIMG.replace(/uSrc/g,'uMatSrc').replace('void main(){ vec4 s;','vec4 materialImage(){ vec4 s;').replace(/o=([^;]+);\s*(?:return;)?/g,'return $1;');
  const body=(comp?FS_COMP:FS_MERGE).replace(/gSC=uStrokeTint==1\?st.rgb:uStrokeColor;/g,'vec4 mc=uMatImage==1?materialImage():uMatColor; gSC=mc.a>1e-6?mc.rgb/mc.a:vec3(0.0); st.a*=mc.a;');
  const p=program(sample+'\nuniform int uMatImage; uniform vec4 uMatColor;\n'+body);p.defaults=Object.assign({},comp?P.comp.defaults:P.merge.defaults);
  if(comp)P_MATERIALCOMP=p;else P_MATERIALMERGE=p;return p;}
function materialStrokeU(s,k){const m=s.o.material,f=m.fill,c=f.maps[k],img=c?.on&&m.imgs[k],image=!!(img&&c.src==='image');
  return Object.assign({uMatImage:{int:image?1:0},uMatColor:c?.on?[...(c.c||[c.v??.5,c.v??.5,c.v??.5]),1]:[0,0,0,0],uMatSrc:image?img.tex:dummy,
    uTile:Math.max(.05,(c?.tile||1)*m.tile),uRot:(c?.rot||0)*Math.PI/180,uGrey:{int:MAP_DEFS[k].grey?1:0},uHeight:{int:k==='height'?1:0},uNormal:{int:k==='normal'?1:0},uHStr:f.hStr??1,
    uProj:{int:0},uPos:dummy,uNrm:dummy,uRep:{int:1},uFront:{int:0},uKeepA:{int:1},uSharp:4,uInv:{m4:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]},uUvM:{m3:[1,0,0,0,1,0,0,0,1]}});}
function strokeMergeProgram(s){return s?.o.material?materialStrokeProgram(false,!!s.o.material.weldPaint):P.merge;}
function strokeMaterialU(s,k){return s?.o.material?materialStrokeU(s,k||doc.map):{};}
async function materialBrushUse(rec){if(!rec){toast('Select a material in the Materials shelf first.');return false;}
  if(rec.kind==='smart'||rec.kind==='smask'){toast('Choose a single material for painting.');return false;}
  materialBrush.loading=true;try{if(rec.bundled)await gmLoad(rec);if(!rec.fill)throw new Error('Choose a single material.');materialBrush.rec=rec;matRecTargets(rec);if(rec.weldPaint){packedProgram(materialStrokeProgram(false,true));packedProgram(materialStrokeProgram(true,true));}const need=Object.keys(rec.fill.maps).filter(k=>rec.fill.maps[k].on&&MAP_DEFS[k]&&!doc.maps.includes(k)&&!(doc.workflow==='spec'&&(k==='rough'||k==='metal')));if(need.length)setDocMaps([...doc.maps,...need],'Material brush channels');setTool('material');return true;}
  catch(e){toast('Could not load the material: '+e.message);return false;}finally{materialBrush.loading=false;}}
function materialPaintOpts(o,et){if(ui.tool!=='material')return o;if(et.isMask&&et.node?.materialPaint){if(!materialBrush.rec||materialBrush.loading)return null;o.tool='brush';o.color=[1,1,1];o.noTint=true;o.chan=null;o.extras=[];o.weldMask=et.node.materialPaint.startsWith('weld:');return o;}if(et.isMask){toast('Select a layer’s colour thumbnail to start painting a material.');return null;}
  const rec=materialBrush.rec;if(!rec||materialBrush.loading){toast(materialBrush.loading?'The material is loading.':'Choose a material in the shelf, then press Paint material.');return null;}
  o.tool='brush';o.noTint=true;o.chan=null;o.material={weldPaint:!!rec.weldPaint,fill:fillClone(rec.fill),imgs:matRecTargets(rec),tile:materialBrush.tile};
  o.extras=doc.maps.filter(k=>k!==doc.map&&rec.fill.maps[k]?.on).map(k=>({key:k,mode:1,color:[0,0,0]}));return o;}
function materialBrushTarget(){if(ui.tool!=='material')return null;const n=doc.active,r=materialBrush.rec;if(!r||materialBrush.loading||sel.quick)return null;
  const key=(r.id||r.bundled?.file||r.name)+':'+materialBrush.tile;if(n?.materialPaint===key&&n.fill&&n.mask)return n;if(n?.editMask&&!n.materialPaint&&!r.weldPaint)return null;
  /* Coverage uses one channel per texel. All channels share it and keep the material's
     original small sources, so 8K/16K material strokes do not expand six pixel layers. */
  const f=fillClone(r.fill);for(const k in f.maps)if(f.maps[k].src==='image')f.maps[k].tile=(f.maps[k].tile||1)*materialBrush.tile;
  const L=cmdNewFillLayer({name:'Paint · '+r.name,maps:f.maps,proj:f.proj,triSharp:f.triSharp,hStr:f.hStr,xf:f.xf,rep:f.rep,front:f.front,decal:f.decal,imgs:matRecTargets(r)});if(!L)return null;
  if(L.mask)maskDispose(L.mask);L.materialPaint=key;L.mask=makeMask(0,true);L.editMask=false;L.fill.coverH=false;fillRender(L);changed(L);return L;}
function buildMaterialBrushPanel(box){box.append(el('div',{class:'sub',text:'Painting material'}),el('p',{class:'note',text:materialBrush.rec?.name||'Select a material in the Materials shelf.'}),
  el('button',{class:'btn sm',id:'mbPick',text:'Choose from Materials',onclick:()=>showPanel('mats')}),
  makeSlider({id:'mbTile',label:'Material tiling',min:.05,max:100,step:.05,value:materialBrush.tile,fmt:v=>v.toFixed(2)+'×',onInput:v=>{materialBrush.tile=v;}}).el,
  el('p',{class:'note',text:'Each stroke paints the material’s enabled channels together. Undo removes them together.'}));}
