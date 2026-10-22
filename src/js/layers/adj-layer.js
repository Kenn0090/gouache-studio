/* ================= Adjustment layer: Hue / Saturation (0.63) =================
   An empty layer that changes the colour of everything under it, with its Hue, Saturation and Lightness sliders in the
   Properties panel (no dialog), live. It is a filter layer holding one Hue / Saturation filter on the colour map, so it
   saves, undoes, takes a mask and opacity, and works in folders like every filter layer: it reaches the layers beneath a
   folder when the folder is set to Pass through. Any Hue / Saturation filter layer gets these sliders. */
const isAdjHsl=n=>!!(n&&n.fx&&n.fx.stack.length===1&&n.fx.stack[0].id==='hueSat'&&!n.fx.stack[0].conv);
function cmdNewAdjHsl(){if(ui.mode==='anim'){toast('Adjustment layers are for paint mode.');return;}if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  if(!doc.maps.includes('base')){toast('This document has no colour map to adjust.');return;}
  const A=doc.active,p=A?A.parent:doc.root,i=A?p.children.indexOf(A)+1:p.children.length,L=newFxLayerObj('Hue / Saturation',[fxItem('hueSat')],'base');L.autoName=false;
  structOp('New adjustment layer',()=>{insertNode(L,p,i);selectOnly(L);});requestRender(true);
  try{showPanel('matEd');}catch(e){}if(typeof renderMatEd==='function')renderMatEd(true);
  toast('Hue / Saturation layer added. It changes everything below it. Use the sliders in the Properties panel.');return L;}
/* the sliders; every change redraws at once and the undo step is made after a pause */
let adjEd={L:null,before:null,timer:0};
function adjCommit(){clearTimeout(adjEd.timer);const L=adjEd.L;if(!L||adjEd.before==null)return;const b=JSON.parse(adjEd.before),a=JSON.parse(JSON.stringify(fxCleanStack(L.fx.stack)));adjEd.before=null;
  if(JSON.stringify(a)===JSON.stringify(b))return;
  const show=()=>{if(doc.active===L&&typeof renderMatEd==='function')renderMatEd(true);};
  pushUndo({label:'Edit adjustment layer',refs:[L],undo(){L.fx.stack=JSON.parse(JSON.stringify(b));dropFxCache(L);show();},redo(){L.fx.stack=JSON.parse(JSON.stringify(a));dropFxCache(L);show();}});}
function adjEdit(L,fn){if(adjEd.L!==L){adjCommit();adjEd.L=L;}if(adjEd.before==null)adjEd.before=JSON.stringify(fxCleanStack(L.fx.stack));fn();dropFxCache(L);requestRender(true);clearTimeout(adjEd.timer);adjEd.timer=setTimeout(adjCommit,700);}
function renderAdjEd(box,L){const v=L.fx.stack[0].v,def=FX.hueSat.defs,cur=()=>L.fx.stack[0].v;box.replaceChildren();/* undo and redo swap the stack for a copy: always edit the one that is there now */
  const sl=(key,label)=>{const d=def.find(x=>x.key===key);return makeSlider({id:'adj_'+key,label,min:d.min,max:d.max,step:d.step,value:v[key],fmt:d.fmt,onInput:x=>adjEdit(L,()=>{cur()[key]=x;})}).el;};
  box.append(el('div',{class:'matHead'},el('b',{text:L.name}),el('span',{class:'dim',text:'adjustment layer'})),
    el('p',{class:'note',text:'Changes the colour of everything under this layer. Put it in a folder set to Pass through to reach layers below the folder. Its opacity, blend mode and mask are in the Layers panel.'}),
    sl('h','Hue'),sl('s','Saturation'),sl('l','Lightness'),
    el('div',{class:'chips'},chk('adj_c','Colorize (paint everything in one hue)',!!v.c,x=>{adjEdit(L,()=>{cur().c=x;});}),el('button',{class:'btn sm',id:'adjReset',text:'Reset',title:'Put Hue, Saturation and Lightness back to 0',onclick:()=>{adjEdit(L,()=>{const w=cur();w.h=0;w.s=0;w.l=0;w.c=false;});adjCommit();renderAdjEd(box,L);}})),
    el('div',{class:'chips'},el('button',{class:'btn sm',text:'More filters…',title:'Add more filters to this layer',onclick:()=>fxEditor(L)})));}
/* any other filter layer: a button to its editor */
function renderFxPlain(box,L){box.replaceChildren(el('div',{class:'matHead'},el('b',{text:L.name}),el('span',{class:'dim',text:'filter layer'})),
  el('p',{class:'note',text:'A filter layer changes everything under it. Its opacity, blend mode and mask are in the Layers panel.'}),
  el('div',{class:'chips'},el('button',{class:'btn sm',id:'fxPlainEdit',text:'Edit filters…',onclick:()=>fxEditor(L)}),el('button',{class:'btn sm',id:'adjNew',text:'New Hue / Saturation layer',onclick:()=>cmdNewAdjHsl()})));}
$('#lAdj').addEventListener('click',cmdNewAdjHsl);
