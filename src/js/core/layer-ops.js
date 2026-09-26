/* ================= Layer content ops ================= */
function needLayer(){const L=activeLayer();if(!L)toast(doc.active?'Select a layer (not a group) for this.':'Select a layer first.');return L;}
function needTarget(){const et=editTarget();if(et&&!et.isMask&&et.node.text){rasterizeText(et.node);toast('Text converted to pixels for this edit. Undo brings the editable text back.');}if(!et)toast(doc.active?'A group is selected. Select a layer, or click the group’s mask thumbnail to edit its mask.':'Select a layer first.');return et;}
function fullRecord(L,label,fn){const W=doc.w,H=doc.h;const b=captureRegion(L.target,0,0,W,H);fn();const a=captureRegion(L.target,0,0,W,H);pushUndo(regionRecord(L,b,a,0,0,W,H,label));changed(L.maskOf||L);}
const lum3=c=>c[0]*.299+c[1]*.587+c[2]*.114;
function fillLayer(){const et=needTarget();if(!et)return;const g=lum3(ui.fg);fullRecord(et.L,'Fill',()=>clearTarget(et.target,et.isMask?[g,g,g,1]:[...ui.fg,1]));}
function clearLayer(){const et=needTarget();if(!et)return;fullRecord(et.L,et.isMask?'Reset mask':'Clear layer',()=>clearTarget(et.target,et.isMask?[1,1,1,1]:[0,0,0,0]));}
function chanLimit(et){if(et.isMask||!chanRestricted())return;run(P.chmerge,scratchT,{uOld:et.target.tex,uNew:previewT.tex,uChan:chan.edit});blit(scratchT,previewT,0,0,doc.w,doc.h,0,0);}
function applyPreview(label){const et=preview.et;fullRecord(et.L,label,()=>blit(previewT,et.target,0,0,doc.w,doc.h,0,0));preview=null;requestRender(true);}
function gaussian(src,dst,radius){const sigma=Math.max(.3,radius/2.2),R=Math.min(128,Math.ceil(sigma*3));
  run(P.blur,scratchT,{uSrc:src.tex,uDir:[1,0],uSigma:sigma,uRadius:{int:R}});run(P.blur,dst,{uSrc:scratchT.tex,uDir:[0,1],uSigma:sigma,uRadius:{int:R}});}
function invert(){const et=needTarget();if(!et)return;preview={L:et.node,isMask:et.isMask,et};run(P.invert,previewT,{uSrc:et.target.tex});chanLimit(et);applyPreview(et.isMask?'Invert mask':'Invert');}
