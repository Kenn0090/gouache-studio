/* (0.98.3, Kenn: flatten layers with effects on them) bake a layer's live effects (the blue effect rows, layer styles and the Array) into its own
   pixels, in every map the effects touch, and drop the live effects. A material (fill) layer is turned into pixels first. One undo step. */
function fxFlattenable(n){return !!n&&n.type==='layer'&&!n.fx&&(!!(n.cfx&&n.cfx.some(r=>r.kind==='filter'&&r.on!==false))||(typeof hasLook==='function'&&hasLook(n)));}
function cmdFlattenEffects(n=doc.active){
  if(!fxFlattenable(n)){toast('This layer has no live effects to flatten.');return false;}
  if(typeof lockStop==='function'&&lockStop({node:n}))return false;
  if(stroke||preview||selLive){toast('Finish the current edit first.');return false;}
  const W=doc.w,H=doc.h,oldFill=n.fill,oldCfx=n.cfx,oldStyles=n.styles,oldArray=n.array,steps=[];
  if(oldFill)for(const k of mapKeysOf(n))if(mapSolid(n,k)||mapLive(n,k))ensureMapTarget(n,k);
  const keys=mapKeysOf(n).filter(k=>mapT(n,k)&&!mapT(n,k).empty||k==='base');
  for(const k of keys){const T=mapT(n,k,true)||ensureMapTarget(n,k);if(!T)continue;
    const touched=(n.cfx&&typeof cfxOn==='function'&&cfxOn(n,k))||(typeof lookTouches==='function'&&lookTouches(n,k));if(!touched)continue;
    const before=captureRegion(T,0,0,W,H);let src=T,own=null;
    if(n.cfx&&cfxOn(n,k)){const r=cfxApply(n,src,k,'off');if(r!==src){own=r;src=r;}}
    if(lookTouches(n,k)){const r=layerLook(n,src,k,false,null);if(r.t!==src){if(own)release(own);own=r.pooled?r.t:null;src=r.t;}}
    if(src!==T)blit(src,T,0,0,W,H,0,0);if(own)release(own);
    steps.push({k,before,after:captureRegion(T,0,0,W,H)});}
  const fix=()=>{if(typeof lookFree==='function')lookFree(n);if(n._cxc){for(const k in n._cxc)if(n._cxc[k]&&n._cxc[k].t)disposeTarget(n._cxc[k].t);n._cxc=null;}n.lookVer=(n.lookVer||0)+1;};
  n.fill=null;n.cfx=undefined;n.styles=null;n.array=null;fix();
  pushUndo({label:'Flatten effects',refs:[n],snaps:steps.flatMap(s=>[s.before,s.after]),
    undo(){for(const s of steps)restoreRegion(s.before,mapT(n,s.k),0,0);n.fill=oldFill;n.cfx=oldCfx;n.styles=oldStyles;n.array=oldArray;fix();renderLayers();},
    redo(){for(const s of steps)restoreRegion(s.after,mapT(n,s.k),0,0);n.fill=null;n.cfx=undefined;n.styles=null;n.array=null;fix();renderLayers();}});
  changed(n);renderLayers();if(typeof renderMatEd==='function')renderMatEd(true);toast('Effects flattened into the layer.');return true;}
