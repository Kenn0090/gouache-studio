/* ================= The Panner shader (0.40) =================
   A PBR shader that slides its textures over the model at a steady speed: water, conveyor belts, glowing energy.
   Only in the viewer, nothing in the painting changes and nothing is exported. Pick which maps slide, and whether the
   whole material slides or just one layer (the rest of the material stays still). "Whole material" is a shift in the
   shader; one layer is redone from the layers each frame, so it is best on the active texture set. */
let panState=null;/* while the maps for the viewer are composited: {id, off:[x,y], maps:Set} */
const PN_MAPS=[['base','Base colour'],['rough','Roughness'],['metal','Metallic'],['nfinal','Normal and height'],['ao','Ambient occlusion'],['emis','Emissive'],['opac','Opacity']];
const PN_UNI={base:'uPB',rough:'uPR',metal:'uPM',nfinal:'uPN',ao:'uPA',emis:'uPE',opac:'uPO'};
const pn={t0:performance.now()};
function pnNow(){return (performance.now()-pn.t0)/1000;}
function pnOff(P,t){const f=v=>((v%1)+1)%1;return [f(-P.sx*t),f(-P.sy*t)];}
function pnUniforms(P){const u={};for(const k in PN_UNI)u[PN_UNI[k]]=[0,0];
  if(!P||P.layer)return u;const o=pnOff(P,P.play?pnNow():0);for(const k in PN_UNI)if(P.maps&&P.maps[k])u[PN_UNI[k]]=o;return u;}
/* the shader of the set being edited, when it is a Panner */
function pnActive(){const sh=v3ShadeOf(doc);return sh&&sh.kind==='panner'?shParams(sh):null;}
/* does any texture set slide? (3D Paint keeps a shader per set) */
function pnPlaying(){if(!v3.on||stroke||ui.mode==='bake'||ui.mode==='convert')return false;
  const a=pnActive();if(a&&a.play&&(a.sx||a.sy))return true;
  if(ui.mode==='p3d'&&typeof p3!=='undefined'&&p3.sets)for(const S of p3.sets){const sh=S.state&&S.state.v3shade;if(sh&&sh.kind==='panner'){const P=shParams(sh);if(P.play&&(P.sx||P.sy))return true;}}
  return false;}
function pnLayerNode(P){if(!P||!P.layer)return null;let f=null;const walk=g=>{for(const n of g.children){if(n.id===P.layer)f=n;if(n.children)walk(n);}};walk(doc.root);return f;}
/* which of the viewer's maps are composited with the layer sliding */
function pnKeysOf(P){const o=[];for(const [k] of PN_MAPS)if(P.maps&&P.maps[k])o.push(k);return o;}
function pnBegin(k){panState=null;const P=pnActive();if(!P||!P.layer)return;const n=pnLayerNode(P);if(!n)return;
  const m=new Set();for(const x of pnKeysOf(P))if(x==='nfinal'){m.add('height');m.add('normal');}else m.add(x);
  if(!(k==='nfinal'?(m.has('height')||m.has('normal')):m.has(k)))return;
  panState={id:n.id,off:pnOff(P,P.play?pnNow():0),maps:m};}
let P_PAN=null;
function panShift(src){if(!P_PAN)P_PAN=program(`in vec2 vUV; uniform sampler2D uSrc; uniform vec2 uOff; void main(){ o=texture(uSrc,fract(vUV+uOff)); }`);
  const out=acquire();run(P_PAN,out,{uSrc:src.tex,uOff:panState.off});return out;}
/* every frame while it plays: redo the maps that slide (layer mode) and ask for another frame */
function pnTick(one,full){if(!pnPlaying())return;const P=pnActive();
  if(P&&P.layer&&P.play&&(P.sx||P.sy)&&!full&&pnLayerNode(P)){const need=v3Needed();for(const k of pnKeysOf(P))if(need.includes(k))one(k);}
  v3.dirty=true;requestRender();}
/* ---- the Shader panel rows for the Panner ---- */
function pnLayerList(){const out=[];const walk=(g,d)=>{for(const n of g.children){out.push([n.id,'  '.repeat(d)+(n.name||'Layer')+(n.type==='group'?' (folder)':'')]);if(n.children)walk(n,d+1);}};walk(doc.root,0);return out;}
function pnPanelRows(P,setP,sl){const rows=[];
  rows.push(el('p',{class:'note',text:'Slides the textures over the model in the 3D view only. Speeds are in texture repeats per second.'}));
  rows.push(sl('sx','Speed across',-2,2,.01,v=>v.toFixed(2)+'/s'),sl('sy','Speed up',-2,2,.01,v=>v.toFixed(2)+'/s'));
  rows.push(chk('pn_play','Playing',!!P.play,v=>{setP('play',v);v3.mapsDirty=true;}));
  const lay=el('select',{id:'pnLayer',class:'shsel','aria-label':'What slides'},el('option',{value:'0',text:'Whole material'}),...pnLayerList().map(([id,l])=>el('option',{value:String(id),text:l})));
  lay.value=String(P.layer||0);if(lay.value!==String(P.layer||0))lay.value='0';lay.onchange=()=>{setP('layer',+lay.value);v3.mapsDirty=true;requestRender(true);};
  rows.push(el('div',{class:'frow'},el('span',{text:'What slides'}),lay));
  rows.push(el('div',{class:'sub',text:'Which maps slide'}));
  for(const [k,l] of PN_MAPS)rows.push(chk('pn_m_'+k,l,!!(P.maps&&P.maps[k]),v=>{setP('maps',Object.assign({},P.maps,{[k]:v}));v3.mapsDirty=true;requestRender(true);}));
  rows.push(el('button',{class:'btn sm',id:'pnRestart',text:'Restart',title:'Put the texture back where it started',onclick:()=>{pn.t0=performance.now();v3.mapsDirty=true;v3.dirty=true;requestRender(true);}}));
  return rows;}
