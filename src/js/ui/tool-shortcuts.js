/* Tool keys run before canvas editors and popovers. A tap selects; a hold springs back.
   Resolve the user's actual binding, and keep typing, modal dialogs and 3D navigation intact. */
const toolKeys={ready:false,changing:false,base:null,frames:[],root:null,mode:null,hold:250};
function toolKeySnapshot(){return {tool:ui.tool,fill:ui.fillKind,tonal:ui.tonal,marquee:ui.marquee,lasso:ui.lasso,heal:heal.mode,
  mask:typeof mk3!=='undefined'?mk3.tool:null,armed:typeof sel3!=='undefined'&&sel3.armed};}
function toolKeyContext(){return toolKeys.root===doc.root&&toolKeys.mode===ui.mode;}
function toolKeyClear(){toolKeys.frames=[];toolKeys.base=null;toolKeys.root=null;toolKeys.mode=null;}
/* Finish at the last real pointer sample; switching away from an untouched Zoom click must not zoom. */
function toolKeyFinish(){if(!toolKeys.ready)return;
  if(typeof pathEdit!=='undefined'&&pathEdit.drag)pathUp({pointerId:pathEdit.drag.id},false);
  if(typeof ptr!=='undefined'&&ptr){const id=ptr.id;if(ptr.mode==='zdrag')ptr=null;else endPtr({pointerId:id});
    if(cv.hasPointerCapture(id))cv.releasePointerCapture(id);}
  if(typeof v3!=='undefined'&&v3.mstroke)meshUp({pointerId:v3.mstroke.id});
  if(typeof stroke!=='undefined'&&stroke)endStroke(true);
  if(typeof v3!=='undefined'){v3.drag=null;v3PickRelease();}
  if(typeof mk3!=='undefined'){if(mk3.draw?.kind==='poly')mk3Finish();else mk3Up();}
  if(typeof pathEdit!=='undefined'&&pathEdit.drawing)pathFinish();
  if(typeof spaceDown!=='undefined'){spaceDown=false;rotHold=false;altPickDown=false;stage.classList.remove('panning');}
}
function toolKeyRestore(s){if(!s)return;toolKeys.changing=true;try{
  ui.fillKind=s.fill;ui.tonal=s.tonal;ui.marquee=s.marquee;ui.lasso=s.lasso;if(heal.mode!==s.heal){heal.mode=s.heal;healSave();}
  setTool(s.tool);if(typeof maskToolsOn==='function'&&(maskToolsOn()||liveOn())&&mk3.tool!==s.mask)maskTool(s.mask);
  if(typeof sel3!=='undefined'&&sel3.armed!==s.armed)sel3Arm(s.armed);
  if(typeof updateSelIcons==='function')updateSelIcons();buildBrushPanel();refreshCursor();
}finally{toolKeys.changing=false;}}
function toolKeyCancel(restore=false){const base=toolKeys.base,valid=toolKeyContext();toolKeyClear();if(restore&&valid)toolKeyRestore(base);}
function toolKeyBinding(e){if(e.isComposing||e.key==='Process'||/^Numpad/.test(e.code||''))return null;
  const combo=kbCombo(e);if(!combo)return null;
  const user=Object.keys(kbUser).find(id=>kbUser[id]===combo),isTool=id=>id.startsWith('tool:')||id==='cageTool'||id==='arrayTool';
  if(user)return isTool(user)?{cmd:kbCommands().find(c=>c[0]===user)}:null;
  const cmd=kbCommands().find(c=>isTool(c[0])&&kbKeyOf(c[0])===combo);if(cmd){/* Crop is not a 3D tool; keep the viewport's channel-cycle key. */
    if(ui.mode==='p3d'&&combo==='C'&&cmd[0]==='tool:crop')return null;return {cmd};}
  /* Shift cycles the built-in tool groups, unless that key has been rebound. */
  if(e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const k=combo.slice(6),group={M:'marquee',L:'lasso',G:'gradient',O:'dodge'}[k];
    if(group&&kbKeyOf('tool:'+group)===k)return {cmd:kbCommands().find(c=>c[0]==='tool:'+group),cycle:group};}
  return null;
}
function toolKeyChoose(B){const id=B.cmd[0],t=id.startsWith('tool:')?id.slice(5):id==='cageTool'?'cage':'array';
  if(t==='path'&&ui.mode!=='p3d'||t==='pen'&&!['paint','p3d','anim'].includes(ui.mode)||t==='material'&&!['paint','p3d'].includes(ui.mode)){B.cmd[4]();return false;}
  if(typeof bpClose==='function')bpClose();if(typeof closeMenu==='function')closeMenu();
  if(typeof sel3!=='undefined'&&sel3.armed)sel3Arm(false);
  if(B.cycle==='marquee'&&ui.tool==='marquee')ui.marquee=ui.marquee==='rect'?'ellipse':'rect';
  if(B.cycle==='lasso'&&ui.tool==='lasso'){ui.lasso=ui.lasso==='free'?'poly':'free';polyLasso=null;}
  if(B.cycle==='gradient'&&['gradient','bucket','gbucket'].includes(ui.tool))ui.fillKind=['gradient','bucket','gbucket'][(['gradient','bucket','gbucket'].indexOf(ui.tool)+1)%3];
  if(B.cycle==='dodge'&&['dodge','burn'].includes(ui.tool))ui.tonal=ui.tool==='dodge'?'burn':'dodge';
  B.cmd[4]();if(typeof updateSelIcons==='function')updateSelIcons();
  if(typeof maskToolsOn==='function'&&(maskToolsOn()||liveOn())){const k=ui.tool==='marquee'?'box':ui.tool==='lasso'?(ui.lasso==='poly'?'poly':'lasso'):MESH_TOOLS.includes(ui.tool)?'paint':null;
    if(k&&mk3.tool!==k)maskTool(k);}
  return true;
}
function toolKeyDown(e){if(!toolKeys.ready||e.defaultPrevented||isTypingTarget(e.target)||document.getElementById('welcome')||document.getElementById('setup'))return;
  const B=toolKeyBinding(e);if(!B?.cmd)return;
  e.preventDefault();e.stopImmediatePropagation();const code=e.code||e.key;
  if(e.repeat||toolKeys.frames.some(f=>f.code===code&&!f.released))return;
  if(toolKeys.base&&!toolKeyContext())toolKeyClear();
  const before=toolKeySnapshot(),at=e.timeStamp;toolKeys.changing=true;let switched=false;try{switched=toolKeyChoose(B);}finally{toolKeys.changing=false;}
  if(!switched)return;
  if(!toolKeys.base){toolKeys.base=before;toolKeys.root=doc.root;toolKeys.mode=ui.mode;}
  toolKeys.frames.push({code,at,after:toolKeySnapshot(),used:false,released:false});
}
function toolKeyUp(e){if(!toolKeys.ready)return;const code=e.code||e.key,i=toolKeys.frames.findIndex(f=>f.code===code&&!f.released);if(i<0)return;
  e.preventDefault();e.stopImmediatePropagation();if(!toolKeyContext()){toolKeyClear();return;}
  const f=toolKeys.frames[i],held=f.used||e.timeStamp-f.at>=toolKeys.hold;
  if(!held){/* A new tapped choice becomes permanent, even while an older tool key is held. */
    toolKeys.base=f.after;toolKeys.frames=toolKeys.frames.slice(i+1);if(!toolKeys.frames.length)toolKeyClear();return;}
  f.released=true;if(i<toolKeys.frames.length-1)return;while(toolKeys.frames.at(-1)?.released)toolKeys.frames.pop();
  const back=toolKeys.frames.at(-1)?.after||toolKeys.base;toolKeyRestore(back);if(!toolKeys.frames.length)toolKeyClear();
}
function toolKeyWindow(w){w.addEventListener('keydown',toolKeyDown,true);w.addEventListener('keyup',toolKeyUp,true);
  w.addEventListener('pointerdown',()=>{for(const f of toolKeys.frames)f.used=true;},true);
  w.addEventListener('blur',()=>{if(toolKeys.ready)toolKeyCancel(true);});
  if(w!==window)w.addEventListener('pagehide',()=>{if(toolKeys.ready)toolKeyCancel(true);});}
toolKeyWindow(window);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&toolKeys.ready)toolKeyCancel(true);});
