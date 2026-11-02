/* ================= Layer shortcuts on the canvas (0.87) =================
   Ctrl + click on the canvas selects the layer that owns the clicked pixel (the cursor shows a move-cross while Ctrl is held).
   Ctrl + Alt + click duplicates that layer (with a selection: only the selected part); the cursor shows two crosses.
   Ctrl + Alt + Shift + E stamps everything visible into a new layer on top and keeps the layers below. */
let lpCtrl=false,lpAlt=false;
const lpSvg=s=>'url("data:image/svg+xml,'+encodeURIComponent(s)+'") 14 14, move';
const LP_ARROWS='<path d="M14 2v24M2 14h24" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M14 2v24M2 14h24" stroke="#111" stroke-width="1.6" stroke-linecap="round"/>'+
  [[14,2,-4,4,4,4],[14,26,-4,-4,4,-4],[2,14,4,-4,4,4],[26,14,-4,-4,-4,4]].map(a=>`<path d="M${a[0]+a[2]} ${a[1]+a[3]}L${a[0]} ${a[1]}L${a[0]+a[4]} ${a[1]+a[5]}" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/><path d="M${a[0]+a[2]} ${a[1]+a[3]}L${a[0]} ${a[1]}L${a[0]+a[4]} ${a[1]+a[5]}" fill="none" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>`).join('');
const LP_PICK=lpSvg('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">'+LP_ARROWS+'</svg>');
const LP_DUP=lpSvg('<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="-3 -3 34 34"><g transform="translate(5 5)" opacity=".55">'+LP_ARROWS+'</g>'+LP_ARROWS+'</svg>');
function lpActive(){return ui.mode==='paint'&&!stroke&&!ptr&&lpCtrl&&!spaceDown&&!(typeof xf!=='undefined'&&xf&&!xf.move);}
/* refreshCursor asks first: while the shortcut is armed the brush outline is hidden and the move-cross shows */
function lpCursor(){if(!lpActive())return false;bc.hidden=true;cv.style.cursor=lpAlt?LP_DUP:LP_PICK;return true;}
/* the top-most visible layer that has paint at this pixel */
function lpLayerAt(x,y){x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=doc.w||y>=doc.h)return null;const list=allLayers();
  for(let i=list.length-1;i>=0;i--){const L=list[i];if(L.type!=='layer'||L.fx||L.paper||!effVisible(L)||!(L.opacity>0))continue;
    try{const t=mapT(L,'base');if(!t||t.empty)continue;if(captureRegionNow(t,x,y,1,1).data[3]>0)return L;}catch(e){}}
  return null;}
function cmdStampVisible(){if(ui.mode==='anim'){toast('Stamp visible works on a normal layer document.');return;}
  const M=mergedLayer('Stamped visible',doc.root.children.filter(n=>n.visible!==false));structOp('Stamp visible',()=>{insertNode(M,doc.root);selectOnly(M);});toast('Everything visible was stamped into a new layer on top.');}
/* Ctrl + Alt + click: a copy of the layer; with a selection only the selected part of it */
function lpDuplicate(L){const c=cloneNode(L);
  if(selOn(null)&&sel.t){const W=doc.w,H=doc.h;for(const k of mapKeysOf(c)){const T=mapT(c,k),tmp=acquireD(T.depth);run(P.applymask,tmp,{uSrc:T.tex,uM:sel.t.tex});blit(tmp,T,0,0,W,H,0,0);release(tmp);}c.name=L.name+' (selection)';}
  structOp('Duplicate layer under the cursor',()=>{insertNode(c,L.parent,L.parent.children.indexOf(L)+1);selectOnly(c);});return c;}
window.addEventListener('pointerdown',e=>{if(e.button!==0||e.target!==cv||!(e.ctrlKey||e.metaKey)||!lpActive())return;
  const r=stage.getBoundingClientRect();if(typeof gdAt==='function'&&rl.show&&!rl.lock&&gdAt(e.clientX-r.left,e.clientY-r.top))return;/* a guide under the pointer: Ctrl drags the guide */
  const [ix,iy]=toImage(e.clientX,e.clientY),L=lpLayerAt(ix,iy);e.preventDefault();e.stopPropagation();
  if(!L){toast('There is no painted layer under the pointer.');return;}
  if(e.altKey){lpDuplicate(L);toast('Duplicated "'+L.name+'".');}else{selectOnly(L);renderLayers();toast('Selected "'+L.name+'".');}},true);
const lpSync=e=>{const c=e.ctrlKey||e.metaKey,a=e.altKey;if(c!==lpCtrl||a!==lpAlt){lpCtrl=c;lpAlt=a;refreshCursor();}};
window.addEventListener('keydown',lpSync,true);window.addEventListener('keyup',lpSync,true);window.addEventListener('blur',()=>{lpCtrl=lpAlt=false;refreshCursor();});
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.altKey&&e.shiftKey&&e.code==='KeyE'&&!isTypingTarget(e.target)){e.preventDefault();e.stopPropagation();cmdStampVisible();}},true);
