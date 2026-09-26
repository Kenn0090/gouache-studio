/* ================= Layer content ops ================= */
function needLayer(){const L=activeLayer();if(!L)toast(doc.active?'Select a layer (not a group) for this.':'Select a layer first.');return L;}
function needTarget(){const et=editTarget();if(et&&!et.isMask&&et.node.text){rasterizeText(et.node);toast('Text converted to pixels for this edit. Undo brings the editable text back.');}if(!et)toast(doc.active?'A group is selected. Select a layer, or click the group’s mask thumbnail to edit its mask.':'Select a layer first.');return et;}
/* rect = [x0,y0,x1,y1] limits what the undo step stores (the selection bounds, when one is active) */
function fullRecord(L,label,fn,rect){const r=rect||[0,0,doc.w,doc.h],x=r[0],y=r[1],w=r[2]-r[0],h=r[3]-r[1];if(w<=0||h<=0){fn();changed(L.maskOf||L);return;}
  const b=captureRegion(L.target,x,y,w,h);fn();const a=captureRegion(L.target,x,y,w,h);pushUndo(regionRecord(L,b,a,x,y,w,h,label));changed(L.maskOf||L);}
/* is this edit limited by the selection? (not when the selection itself is being edited in quick mask) */
function selOn(et){return sel.active&&!sel.quick&&!(et&&et.L&&et.L.quick);}
function selRect(et){return selOn(et)&&sel.bb?sel.bb:null;}
/* keep a filter's preview only inside the selection */
function selLimit(et){if(!selOn(et))return;run(P.selmix,scratchT,{uOld:et.target.tex,uNew:previewT.tex,uSel:sel.t.tex});blit(scratchT,previewT,0,0,doc.w,doc.h,0,0);}
function fillSel(et,color,label){const t=acquire();clearTarget(t,color);
  fullRecord(et.L,label,()=>{run(P.selmix,scratchT,{uOld:et.target.tex,uNew:t.tex,uSel:sel.t.tex});blit(scratchT,et.target,0,0,doc.w,doc.h,0,0);},selRect(et));release(t);}
const lum3=c=>c[0]*.299+c[1]*.587+c[2]*.114;
function fillLayer(){const et=needTarget();if(!et)return;const g=lum3(ui.fg),c=et.isMask?[g,g,g,1]:[...ui.fg,1];
  if(selOn(et)){fillSel(et,c,'Fill selection');return;}fullRecord(et.L,'Fill',()=>clearTarget(et.target,c));}
function clearLayer(){const et=needTarget();if(!et)return;const c=et.isMask?[1,1,1,1]:[0,0,0,0];
  if(selOn(et)){fillSel(et,c,et.isMask?'Clear mask selection':'Delete selection');return;}fullRecord(et.L,et.isMask?'Reset mask':'Clear layer',()=>clearTarget(et.target,c));}
function chanLimit(et){if(et.isMask||!chanRestricted())return;run(P.chmerge,scratchT,{uOld:et.target.tex,uNew:previewT.tex,uChan:chan.edit});blit(scratchT,previewT,0,0,doc.w,doc.h,0,0);}
function applyPreview(label){const et=preview.et;fullRecord(et.L,label,()=>blit(previewT,et.target,0,0,doc.w,doc.h,0,0),selRect(et));preview=null;requestRender(true);}
function gaussian(src,dst,radius){const sigma=Math.max(.3,radius/2.2),R=Math.min(128,Math.ceil(sigma*3));
  run(P.blur,scratchT,{uSrc:src.tex,uDir:[1,0],uSigma:sigma,uRadius:{int:R}});run(P.blur,dst,{uSrc:scratchT.tex,uDir:[0,1],uSigma:sigma,uRadius:{int:R}});}
function invert(){const et=needTarget();if(!et)return;preview={L:et.node,isMask:et.isMask,et};run(P.invert,previewT,{uSrc:et.target.tex});chanLimit(et);selLimit(et);applyPreview(et.isMask?'Invert mask':'Invert');}
