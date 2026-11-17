/* ================= Layer content ops ================= */
function needLayer(){const L=activeLayer();if(!L)toast(doc.active?'Select a layer (not a group) for this.':'Select a layer first.');return L;}
function needTarget(){const et=editTarget();if(et)useAux(et.target.depth);if(et&&!et.isMask&&(et.node.text||et.node.grad)){const g=!!et.node.grad;rasterizeText(et.node);toast(g?'Gradient converted to pixels for this edit. Undo brings the editable gradient back.':'Text converted to pixels for this edit. Undo brings the editable text back.');}if(!et)toast(doc.active&&doc.active.fx?'This is a filter layer: it has no pixels of its own. Double-click its thumbnail to change its filters, or select a normal layer.':doc.active?'A group is selected. Select a layer, or click the group’s mask thumbnail to edit it.':'Select a layer first.');return et;}
/* rect = [x0,y0,x1,y1] limits what the undo step stores (the selection bounds, when one is active) */
/* others: [{k,apply(T)}] — the same edit made to other maps of the layer, in the same undo step */
function fullRecord(L,label,fn,rect,others){const r=rect||[0,0,doc.w,doc.h],x=r[0],y=r[1],w=r[2]-r[0],h=r[3]-r[1];others=others||[];
  if(w<=0||h<=0){fn();for(const o of others)o.apply(ensureMapTarget(L,o.k));changed(L.maskOf||L);return;}
  const base=p3PaintValid(L.target),b=captureRegion(L.target,x,y,w,h);fn();const a=captureRegion(L.target,x,y,w,h);
  const change=p3PaintPatch(base,recTarget(L),b,a,x,y),changes=change?[change]:[];
  const parts=others.map(o=>{const T=ensureMapTarget(L,o.k),source=p3PaintValid(T),before=captureRegion(T,x,y,w,h);o.apply(T);
    const after=captureRegion(T,x,y,w,h),patch=p3PaintPatch(source,()=>mapT(L,o.k,true),before,after,x,y);
    if(patch)changes.push(patch);
    return {k:o.k,before,after};
  });
  const rec=regionRecord(L,b,a,x,y,w,h,label);pushUndo(p3PaintUndoSources(parts.length?withMapParts(rec,L,parts,x,y):rec,changes));changed(L.maskOf||L);}
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
function cmdClearLayer(){if(stroke||preview||selLive){toast('Finish the current edit first.');return;}const n=doc.active;if(!n||n.fx||!isLayer(n))return;if(typeof lockStop==='function'&&lockStop({node:n,L:n}))return;
  if(xf)xfCommit();
  if(n.path){pathChange(P=>P.mode='none','Clear path layer');return;}
  if(n.fill){const old=n.mask,edit=n.editMask,m=makeMask(0,true);n.mask=m;n.editMask=false;pushUndo({label:'Clear material layer',refs:[n],masks:[old,m].filter(Boolean),undo(){n.mask=old;n.editMask=edit;},redo(){n.mask=m;n.editMask=false;}});changed(n);return;}
  const edit=n.editMask;n.editMask=false;let et;try{et=needTarget();}finally{n.editMask=edit;}if(!et)return;const keys=mapKeysOf(n),rect=keys.reduce((r,k)=>rUnion(r,contentBounds(mapT(n,k))),null);if(!rect)return;
  const current=doc.map,others=keys.filter(k=>k!==current).map(k=>({k,apply:T=>clearTarget(T)}));fullRecord(n,'Clear layer',()=>clearTarget(n.target),rect,others);}
function chanLimit(et){if(et.isMask||!chanRestricted())return;run(P.chmerge,scratchT,{uOld:et.target.tex,uNew:previewT.tex,uChan:chan.edit});blit(scratchT,previewT,0,0,doc.w,doc.h,0,0);}
function applyPreview(label){const et=preview.et;fullRecord(et.L,label,()=>blit(previewT,et.target,0,0,doc.w,doc.h,0,0),selRect(et));preview=null;requestRender(true);}
/* (0.98.7, Kenn: "Gaussian blur is laggy while blurring; give it another pass on quality") a wide blur does not need a tap per pixel: the picture is
   shrunk (in half-float, so nothing bands), blurred small, brought back up and smoothed once at full size so the enlarged
   steps cannot show. Cost no longer grows with the radius. */
function gaussianPyr(src,dst,sigma){let f=1;while(sigma/f>5&&f<64)f*=2;if(f<2)return false;
  const dp=canFloat?16:src.depth,mk=(a,b)=>makeTarget(a,b,dp,false),made=[],w=Math.max(8,Math.round(src.w/f)),h=Math.max(8,Math.round(src.h/f));
  try{let cur=src,cw=src.w,ch=src.h;
    while(cw>w||ch>h){const nw=Math.max(w,Math.round(cw/4)),nh=Math.max(h,Math.round(ch/4)),t=mk(nw,nh);made.push(t);
      run(P.resample,t,{uSrc:cur.tex,uOffset:[0,0],uScale:[cw/nw,ch/nh],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(Math.max(cw/nw,ch/nh))))}});cur=t;cw=nw;ch=nh;}
    const s=Math.max(.3,sigma*cw/src.w),R=Math.min(48,Math.ceil(s*3)),tmp=mk(cw,ch),out=mk(cw,ch);made.push(tmp,out);
    run(P.blur,tmp,{uSrc:cur.tex,uDir:[1,0],uSigma:s,uRadius:{int:R}});run(P.blur,out,{uSrc:tmp.tex,uDir:[0,1],uSigma:s,uRadius:{int:R}});
    /* back up in steps of two, with one light smoothing at each size: the enlargement leaves no creases, and the work stays small */
    let up=out,uw=cw,uh=ch;
    while(uw<src.w||uh<src.h){const nw=Math.min(src.w,uw*2),nh=Math.min(src.h,uh*2),last=nw>=src.w&&nh>=src.h;
      if(last){copyScaled(up,dst);run(P.blur,scratchT,{uSrc:dst.tex,uDir:[1,0],uSigma:1.1,uRadius:{int:4}});run(P.blur,dst,{uSrc:scratchT.tex,uDir:[0,1],uSigma:1.1,uRadius:{int:4}});break;}
      const t=mk(nw,nh),t2=mk(nw,nh);made.push(t,t2);copyScaled(up,t);run(P.blur,t2,{uSrc:t.tex,uDir:[1,0],uSigma:1.1,uRadius:{int:4}});run(P.blur,t,{uSrc:t2.tex,uDir:[0,1],uSigma:1.1,uRadius:{int:4}});up=t;uw=nw;uh=nh;}
    return true;}
  finally{for(const t of made)disposeTarget(t);}}
function gaussian(src,dst,radius){const sigma=Math.max(.3,radius/2.2),R=Math.min(128,Math.ceil(sigma*3));
  if(sigma>8&&!uvWrapScope&&src.w===doc.w&&src.h===doc.h&&dst.w===src.w&&dst.h===src.h&&!src.packed&&!src.mono&&!dst.packed&&!dst.mono&&src.w>=256&&gaussianPyr(src,dst,sigma))return;
  if(uvWrapScope)uvWrapTarget(scratchT);
  run(P.blur,scratchT,{uSrc:src.tex,uDir:[1,0],uSigma:sigma,uRadius:{int:R}});run(P.blur,dst,{uSrc:scratchT.tex,uDir:[0,1],uSigma:sigma,uRadius:{int:R}});}
function invert(){const et=needTarget();if(!et)return;preview={L:et.node,isMask:et.isMask,et};run(P.invert,previewT,{uSrc:et.target.tex});chanLimit(et);selLimit(et);applyPreview(et.isMask?'Invert mask':'Invert');}
