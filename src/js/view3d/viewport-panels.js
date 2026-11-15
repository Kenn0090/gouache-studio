/* ================= Lights, Camera and Post FX on the 3D view (0.97.27, Kenn) =================
   "Bring the viewport Lights button on to the viewports so you can easily add them", "I should be able to dock the lights menu",
   "Add a camera button to the viewport as well so you can adjust focal, and post FX; the things you're adding to the viewport as a
   button should be removed from the settings and added as a button that opens a dockable menu", and (Marmoset) "a sticky focus and
   depth of field settings".
   Three buttons on the 3D view's top bar open three panels. A panel that is not placed yet opens floating beside its button; from
   there its tab docks like any other (drag it into a group or to an edge). Clicking the button again while the panel shows hides it.
     Lights   your light rig (add sun / point / spot / sky lights, move them with the gizmo on the model) and the studio lighting
     Camera   view angle and focal length, depth of field, and sticky focus: click a point of the model and it stays sharp as the
              camera moves
     Post FX  the effects laid over the picture (bloom, ambient occlusion, colour grade, vignette, grain…) */
const VP_PANELS={v3lights:{sec:'vpLightsSec',body:'vpLightsBody',title:'Lights'},v3cam:{sec:'vpCamSec',body:'vpCamBody',title:'Camera'},v3post:{sec:'vpPostSec',body:'vpPostBody',title:'Post FX'}};
const VP_BTN={v3lights:['v3LightsBtn','Lights','Add and move lights; studio lighting'],v3cam:['v3CamBtn','Camera','Focal length, depth of field and sticky focus'],v3post:['v3PostBtn','Post FX','Bloom, occlusion, colour grade, vignette, grain…']};
function vpInit(){for(const [id,P] of Object.entries(VP_PANELS)){if(dkSecs[id])continue;
    const sec=el('section',{class:'sec',id:P.sec,'aria-labelledby':'h_'+P.sec},el('div',{class:'sec-h',id:'h_'+P.sec},el('span',{text:P.title})),el('div',{id:P.body,class:'dlg-grid'}));
    dkSecs[id]=sec;(dk.park||document.body).append(sec);}
  vpRender();}
{const f=shInit;shInit=function(){const r=f.apply(this,arguments);try{vpInit();}catch(e){console.warn('viewport panels',e);}return r;};}
/* a slider on a 3D view setting (the same helper the Settings drop-down uses) */
function vpS(id,label,key,min,max,step,fmt){const s=v3s();return makeSlider({id,label,min,max,step,value:s[key],fmt,...(['sunI','skyI','envIntensity','studioFill','studioRim'].includes(key)?{numericMax:Math.max(max,1)*4}:{}),onInput:v=>{v3s()[key]=v;v3.dirty=true;requestRender();}}).el;}
/* a panel is built only while it is on screen (and rebuilt for another tab), so its controls always edit the current 3D view and
   never share ids with a hidden copy */
const vpKey=()=>ui.mode+'|'+(ui.mode==='p3d'&&typeof p3!=='undefined'?p3.cur:'');
function vpRender(which){if(!dk.L)return;for(const id of which?[which]:Object.keys(VP_PANELS)){const body=dkSecs[id]&&dkSecs[id].querySelector('#'+VP_PANELS[id].body);if(!body)continue;
  if(!panelShown(id)||!dkIn(id)){body.replaceChildren();body._k='';continue;}
  try{body.replaceChildren(...(id==='v3lights'?vpLightsBody():id==='v3cam'?vpCamBody():vpPostBody()).filter(Boolean));body._k=vpKey();}catch(e){console.warn('viewport panel '+id,e);}}}
function vpSync(){if(!dk.L)return;for(const id of Object.keys(VP_PANELS)){const body=dkSecs[id]&&dkSecs[id].querySelector('#'+VP_PANELS[id].body);if(!body)continue;const on=panelShown(id)&&dkIn(id);
  if(on&&(!body.childElementCount||body._k!==vpKey()))vpRender(id);else if(!on&&body.childElementCount)vpRender(id);}}
/* ---- Lights ---- */
function vpLightsBody(){const s=v3s(),rig=ui.mode==='p3d';
  const out=[];
  if(rig){out.push(chk('vpRigLive','Light the view with my lights',!!s.rigLive,v=>{s.rigLive=v;if(v&&!lightRig().lights.length)lightAutoRig();v3.dirty=true;requestRender(true);vpRender('v3lights');}));
    if(s.rigLive)out.push(lightTabPage(null,t=>el('p',{class:'note',text:t})),el('p',{class:'note',text:'Drag a light on the model to move it: the arrows move it along X, Y and Z, the ring turns a sun or a spot. Up to four lights show in the view; the Lighting bake bakes them all, with shadows.'}));
    else out.push(el('p',{class:'note',text:'Turn this on to add your own lights (sun, point, spot, sky) and move them on the model. Off: the studio lighting below and the environment light the model.'}));}
  out.push(studioSettingsBox(vpS,'vpl'));
  return out;}
/* ---- Camera ---- */
function vpCamBody(){const s=v3s(),p=postOf(s),D=p.dof,set=(k,v)=>{postEdit('dof',k,v);};
  const dofOn=chk('vpDof','Depth of field',!!D.on,v=>{set('on',v);vpRender('v3cam');});
  const rows=[el('div',{class:'sub',text:'Lens'}),...lensBox(s,vpS),el('div',{class:'sub',text:'Depth of field'}),dofOn];
  if(D.on){rows.push(makeSlider({id:'vpDofAmt',label:'Blur (aperture)',min:0,max:1,step:.01,value:D.amt,fmt:pct,onInput:v=>set('amt',v)}).el);
    rows.push(chk('vpSticky','Sticky focus: keep a point of the model sharp',!!(D.sticky&&D.pt),v=>{if(v&&!D.pt){vpFocusArm();return;}set('sticky',v);vpRender('v3cam');}));
    if(D.sticky&&D.pt)rows.push(el('p',{class:'note',id:'vpFocusNote',text:'The focus stays on the point you picked, wherever the camera goes.'}));
    else rows.push(makeSlider({id:'vpDofFocus',label:'Focus distance',min:-.8,max:1.5,step:.01,value:D.focus,fmt:v=>(v>0?'+':'')+Math.round(v*100)+'%',onInput:v=>set('focus',v)}).el);
    rows.push(el('div',{class:'chips'},el('button',{type:'button',class:'btn sm'+(vpFocus.armed?' on':''),id:'vpFocusPick',text:vpFocus.armed?'Click the model…':'Pick the focus on the model',title:'Click a point of the model: it becomes the focus, and stays in focus as you turn and zoom',onclick:vpFocusArm}),
      D.pt?el('button',{type:'button',class:'btn sm',id:'vpFocusClear',text:'Forget the point',onclick:()=>{const s2=v3s();s2.post=Object.assign({},s2.post);s2.post.dof=Object.assign({},s2.post.dof||{});delete s2.post.dof.pt;s2.post.dof.sticky=false;v3.dirty=true;requestRender();vpRender('v3cam');}}):''));}
  return rows;}
/* sticky focus: the next click on the model picks the point */
const vpFocus={armed:false};
function vpFocusArm(){vpFocus.armed=true;toast('Click the point of the model that should stay sharp. Esc: cancel.');vpRender('v3cam');}
window.addEventListener('pointerdown',e=>{if(!vpFocus.armed)return;const hit=document.getElementById('v3Hit');if(!hit||e.target!==hit||e.button!==0)return;
  e.preventDefault();e.stopImmediatePropagation();vpFocus.armed=false;const pk=v3PickAt(hit,e);
  if(!pk||!pk.pos){toast('That missed the model. Pick the focus again and click on the model.');vpRender('v3cam');return;}
  const s=v3s();s.post=Object.assign({},s.post);s.post.dof=Object.assign({},s.post.dof||{},{on:true,pt:pk.pos.slice(),sticky:true});v3.dirty=true;requestRender();vpRender('v3cam');toast('Focus set. It stays on that point as the camera moves.');},true);
window.addEventListener('keydown',e=>{if(vpFocus.armed&&e.key==='Escape'){vpFocus.armed=false;vpRender('v3cam');}},true);
/* the focus distance used by the depth of field: the picked point's depth when sticky, else the slider (a share of the zoom) */
function vpFocusDist(D){const c=v3.cam;if(D.sticky&&D.pt){const eye=v3Eye(),f=norm3(sub3([c.tx,c.ty,c.tz],eye));return Math.max(.001,dot3(sub3(D.pt,eye),f));}return Math.max(.01,c.dist*(1+D.focus));}
/* ---- Post FX ---- */
function vpPostBody(){const b=postBox();const row=b.querySelector('#post_dof');const card=row&&(row.closest('.postfx')||row);if(card)card.replaceWith(el('p',{class:'note',text:'Depth of field and sticky focus are in Camera.'}));return [b];}
/* ---- the buttons on the 3D view ---- */
function vpButtons(){return Object.entries(VP_BTN).filter(([id])=>dkIn(id)).map(([id,[bid,text,title]])=>{const on=panelShown(id);
  return el('button',{type:'button',class:'btn sm vpbtn'+(on?' on':''),id:bid,text,title:title+(on?' (click to hide)':''),'aria-pressed':String(on),onclick:e=>vpOpen(id,e.currentTarget)});});}
function vpOpen(id,btn){if(!dkSecs[id])vpInit();
  if(panelShown(id)){const g=[...dkAllGroups(),...dk.L.floats].find(x=>x.tabs&&x.tabs.includes(id));if(!g||g.active===id){dkMove(id,{hidden:true});dkRender();dkSave();}else showPanel(id);}
  else{const r=btn?btn.getBoundingClientRect():{left:200,bottom:120};const w=320;dkMove(id,{float:{x:Math.max(8,Math.min(window.innerWidth-w-8,r.left)),y:Math.max(8,r.bottom+6)}});
    const f=dk.L.floats.find(x=>x.tabs.includes(id));if(f){f.w=w;f.h=Math.min(560,window.innerHeight-r.bottom-30);}dkRender();dkSave();}
  if(id==='v3lights'&&ui.mode==='p3d'&&panelShown(id)&&!v3s().rigLive){v3s().rigLive=true;if(!lightRig().lights.length)lightAutoRig();v3.dirty=true;}
  vpRender(id);vpBtnSync();requestRender(true);}
function vpBtnSync(){for(const [id,[bid]] of Object.entries(VP_BTN)){const b=document.getElementById(bid);if(!b)continue;const on=panelShown(id);b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));}}
{const f=dkRender;dkRender=function(){const r=f.apply(this,arguments);try{vpSync();vpBtnSync();}catch(e){}return r;};}
/* the light gizmo shows whenever the Lights panel is open in 3D Paint */
{const f=lgzActive;lgzActive=function(){const R=f.apply(this,arguments);if(R||ui.mode!=='p3d'||!panelShown('v3lights'))return R;const C=bakeCfg&&bakeCfg.rig;return v3.on&&C&&C.show!==false&&C.lights&&C.lights.some(L=>L.type!=='sky')?C:null;};}
