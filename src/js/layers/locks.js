/* ================= Layer locks, like Photoshop (0.26.1) =================
   Four locks per layer or group, as buttons in the Layers panel:
   - transparent pixels (L.lockAlpha, the old "Lock alpha"): paint only where there already is paint
   - image pixels (n.lockPx): no painting, filling, filters or other pixel changes (the mask can still be edited)
   - position (n.lockPos): no moving or transforming
   - all (n.lockAll): all of the above, the mask too
   A group's locks apply to everything inside it. Saved in .gouache files. */
function lockChain(n){const out=[];for(let x=n;x&&!x.isRoot&&x!==doc.root;x=x.parent)out.push(x);return out;}
const lockedAll=n=>lockChain(n).some(x=>x.lockAll);
const lockedPx=n=>lockChain(n).some(x=>x.lockAll||x.lockPx);
const lockedPos=n=>lockChain(n).some(x=>x.lockAll||x.lockPos);
function lockMsg(n,what){toast('“'+(n.name||'Layer')+'” is locked ('+what+'). Unlock it with the padlock buttons in the Layers panel.');}
/* an edit of et (from editTarget) is blocked by a lock: says so and returns true */
function lockStop(et){if(!et)return false;const n=et.node||(et.L&&(et.L.maskOf||et.L));if(!n||n.quick||!n.parent)return false;
  if(et.isMask){if(lockedAll(n)){lockMsg(n,'everything');return true;}return false;}
  if(lockedPx(n)){lockMsg(n,'pixels');return true;}return false;}
/* the gates: editTarget users that change pixels, whole-layer edits, moving and transforming */
{const nt=needTarget;needTarget=function(){const et=nt();return et&&lockStop(et)?null:et;};}
{const fr=fullRecord;fullRecord=function(L,label,fn,rect,others){if(L&&(L.type==='layer'||L.maskOf)&&lockStop({node:L.maskOf||L,isMask:!!L.maskOf}))return;return fr(L,label,fn,rect,others);};}
{const xs=xfStart;xfStart=function(opts){if(!xf){const pk=typeof xfLayers==='function'?xfLayers():{};if(pk.maskOnly&&lockedAll(pk.maskOnly)){lockMsg(pk.maskOnly,'everything');return false;}for(const n of (pk.layers||[])){const N=n;if(N&&N.parent&&(lockedPos(N)||lockedPx(N))){lockMsg(N,lockedPos(N)?'position':'pixels');return false;}}}return xs(opts);};}
{const md=cmdMergeDown;cmdMergeDown=function(){const L=doc.active;if(isLayer(L)){const p=L.parent,i=p.children.indexOf(L),lo=p.children[i-1];if(lo&&lockedPx(lo)){lockMsg(lo,'pixels');return;}if(lockedAll(L)){lockMsg(L,'everything');return;}}return md();};}
/* the buttons */
const LOCK_BTNS=[
  ['alpha','Lock transparent pixels: paint only where there already is paint','<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16" /><rect x="4" y="4" width="8" height="8" fill="currentColor" stroke="none" opacity=".55"/><rect x="12" y="12" width="8" height="8" fill="currentColor" stroke="none" opacity=".55"/>'],
  ['px','Lock image pixels: no painting or pixel changes','<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>'],
  ['pos','Lock position: no moving or transforming','<path d="M12 2v20M2 12h20"/><path d="m9 5 3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>'],
  ['all','Lock all','<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>']];
const lockKey={alpha:'lockAlpha',px:'lockPx',pos:'lockPos',all:'lockAll'};
function lockRow(){const lc=$('#lLock');if(!lc)return;const chk=lc.closest('label');const row=el('div',{class:'lockrow',role:'group','aria-label':'Lock'},el('span',{class:'lab',text:'Lock'}),
    ...LOCK_BTNS.map(([k,t,svg])=>{const b=el('button',{class:'lkb',id:'lock_'+k,title:t,'aria-label':t,'aria-pressed':'false',onclick:()=>lockToggle(k)});b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+svg+'</svg>';return b;}));
  chk.hidden=true;chk.after(row);}
function lockToggle(k){const nodes=doc.sel&&doc.sel.size?[...doc.sel]:doc.active?[doc.active]:[];if(!nodes.length){toast('Select a layer first.');return;}
  const key=lockKey[k];if(k==='alpha'&&!nodes.some(isLayer)){toast('Lock transparent pixels is for layers.');return;}
  const on=!nodes.every(n=>n[key]);for(const n of nodes){if(k==='alpha'&&!isLayer(n))continue;n[key]=on;}renderLayers();lockSync();}
function lockSync(){const A=doc.active;for(const [k] of LOCK_BTNS){const b=$('#lock_'+k);if(!b)continue;const on=!!(A&&A[lockKey[k]]);b.setAttribute('aria-pressed',String(on));b.classList.toggle('on',on);b.disabled=!A;}}
lockRow();
{const rl0=renderLayers;renderLayers=function(){const r=rl0.apply(this,arguments);lockSync();return r;};}
