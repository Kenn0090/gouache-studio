/* ================= Layer content ops ================= */
function needLayer(){const L=activeLayer();if(!L)toast(doc.active?'Select a layer (not a group) for this.':'Select a layer first.');return L;}
function needTarget(){const et=editTarget();if(et&&!et.isMask&&(et.node.text||et.node.grad)){const g=!!et.node.grad;rasterizeText(et.node);toast(g?'Gradient converted to pixels for this edit. Undo brings the editable gradient back.':'Text converted to pixels for this edit. Undo brings the editable text back.');}if(!et)toast(doc.active&&doc.active.fx?'This is a filter layer: it has no pixels of its own. Double-click its thumbnail to change its filters, or select a normal layer.':doc.active?'A group is selected. Select a layer, or click the group’s mask thumbnail to edit its mask.':'Select a layer first.');return et;}
/* rect = [x0,y0,x1,y1] limits what the undo step stores (the selection bounds, when one is active) */
/* others: [{k,apply(T)}] — the same edit made to other maps of the layer, in the same undo step */
function fullRecord(L,label,fn,rect,others){const r=rect||[0,0,doc.w,doc.h],x=r[0],y=r[1],w=r[2]-r[0],h=r[3]-r[1];others=others||[];
  if(w<=0||h<=0){fn();for(const o of others)o.apply(ensureMapTarget(L,o.k));changed(L.maskOf||L);return;}
  const b=captureRegion(L.target,x,y,w,h);fn();const a=captureRegion(L.target,x,y,w,h);
  const parts=others.map(o=>{const T=ensureMapTarget(L,o.k),before=captureRegion(T,x,y,w,h);o.apply(T);return {k:o.k,before,after:captureRegion(T,x,y,w,h)};});
  const rec=regionRecord(L,b,a,x,y,w,h,label);pushUndo(parts.length?withMapParts(rec,L,parts,x,y):rec);changed(L.maskOf||L);}
/* other maps a fill / delete / bucket also changes: the ones switched on in the brush's Maps section */
function otherMapsFor(et,needContent){if(!et||et.isMask||et.L.quick||!et.L.maps||chanRestricted())return [];return mapBrushTargets().filter(k=>!needContent||hasMap(et.L,k));}
/* write src over T through the selection (T and a temp share T's depth) */
function selMixInto(T,src){const o=acquireD(T.depth);run(P.selmix,o,{uOld:T.tex,uNew:src.tex,uSel:sel.t.tex});blit(o,T,0,0,doc.w,doc.h,0,0);release(o);}
function fillOthers(et,colorOf){const on=selOn(et);return otherMapsFor(et,!colorOf).map(k=>({k,apply:T=>{const c=colorOf?[...colorOf(k),1]:[0,0,0,0];
  if(!on){clearTarget(T,c);return;}const t=acquireD(T.depth);clearTarget(t,c);selMixInto(T,t);release(t);}}));}
/* is this edit limited by the selection? (not when the selection itself is being edited in quick mask) */
function selOn(et){return sel.active&&!sel.quick&&!(et&&et.L&&et.L.quick);}
function selRect(et){return selOn(et)&&sel.bb?sel.bb:null;}
/* keep a filter's preview only inside the selection */
function selLimit(et){if(!selOn(et))return;run(P.selmix,scratchT,{uOld:et.target.tex,uNew:previewT.tex,uSel:sel.t.tex});blit(scratchT,previewT,0,0,doc.w,doc.h,0,0);}
function fillSel(et,color,label,others){const t=acquire();clearTarget(t,color);
  fullRecord(et.L,label,()=>{run(P.selmix,scratchT,{uOld:et.target.tex,uNew:t.tex,uSel:sel.t.tex});blit(scratchT,et.target,0,0,doc.w,doc.h,0,0);},selRect(et),others);release(t);}
const lum3=c=>c[0]*.299+c[1]*.587+c[2]*.114;
function fillLayer(){const et=needTarget();if(!et)return;const g=lum3(ui.fg),c=et.isMask?[g,g,g,1]:[...ui.fg,1];
  const oth=fillOthers(et,mapBrushColor);if(selOn(et)){fillSel(et,c,'Fill selection',oth);return;}fullRecord(et.L,'Fill',()=>clearTarget(et.target,c),null,oth);}
function clearLayer(){const et=needTarget();if(!et)return;const c=et.isMask?[1,1,1,1]:[0,0,0,0];
  const oth=fillOthers(et,null);if(selOn(et)){fillSel(et,c,et.isMask?'Clear mask selection':'Delete selection',oth);return;}fullRecord(et.L,et.isMask?'Reset mask':'Clear layer',()=>clearTarget(et.target,c),null,oth);}
function chanLimit(et){if(et.isMask||!chanRestricted())return;run(P.chmerge,scratchT,{uOld:et.target.tex,uNew:previewT.tex,uChan:chan.edit});blit(scratchT,previewT,0,0,doc.w,doc.h,0,0);}
function applyPreview(label){const et=preview.et;fullRecord(et.L,label,()=>blit(previewT,et.target,0,0,doc.w,doc.h,0,0),selRect(et));preview=null;requestRender(true);}
function gaussian(src,dst,radius){const sigma=Math.max(.3,radius/2.2),R=Math.min(128,Math.ceil(sigma*3));
  if(uvWrapScope)uvWrapTarget(scratchT);
  run(P.blur,scratchT,{uSrc:src.tex,uDir:[1,0],uSigma:sigma,uRadius:{int:R}});run(P.blur,dst,{uSrc:scratchT.tex,uDir:[0,1],uSigma:sigma,uRadius:{int:R}});}
function invert(){const et=needTarget();if(!et)return;preview={L:et.node,isMask:et.isMask,et};run(P.invert,previewT,{uSrc:et.target.tex});chanLimit(et);selLimit(et);applyPreview(et.isMask?'Invert mask':'Invert');}
