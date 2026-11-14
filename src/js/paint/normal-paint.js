/* ================= Normal layers (0.68) =================
   A normal layer is an ordinary layer that holds only Height and Normal. Its brush has these modes:
   - Raise / Dent paint the layer's Height (the final normal is built from height, so the surface bumps up or sinks in),
     with the brush's own soft or textured shape as the profile and Strength as how high it goes.
   - Direction paints the Normal map itself: the surface tilts toward the angle you set.
   - World direction projects one world-space aim onto the mesh and stores it in tangent space.
   Selections, the lasso and marquee, Levels and the gradient tool work on its Height like any other map, and Smudge
   on the Normal map keeps the normals unit length. */
const NP_MODES=[['raise','Raise'],['dent','Dent'],['dir','Direction']];
const np={mode:'raise',str:.5,ang:90,tilt:.6,worldAz:45,worldEl:35};
try{Object.assign(np,JSON.parse(localStorage.getItem('gs.np')||'{}'));}catch(e){}
const npSave=()=>{try{localStorage.setItem('gs.np',JSON.stringify(np));}catch(e){}};
const isNormalLayer=L=>!!L&&L.type==='layer'&&!!L.nrm;
const npWorldPaint=L=>ui.mode==='p3d'&&np.mode==='world'&&ui.tool==='brush'&&isNormalLayer(L)&&!L.editMask;
const npMapOf=()=>(np.mode==='dir'||(np.mode==='world'&&ui.mode==='p3d'))?'normal':'height';
function npWorldDirection(){return hpDir(clamp(np.worldEl,-90,90),np.worldAz);}
function npWorldAim(direction){np.worldAz=(Math.round(Math.atan2(direction[0],direction[2])*180/Math.PI)+360)%360;np.worldEl=Math.round(Math.asin(clamp(direction[1],-1,1))*180/Math.PI);npSave();buildBrushPanel();}
/* the colour a Direction stroke paints: the normal tilted np.tilt of the way toward np.ang (0° right, 90° up) */
function npDirColour(){const a=np.ang*Math.PI/180,t=clamp(np.tilt,0,1)*Math.PI/2,s=Math.sin(t),z=Math.cos(t);return [Math.cos(a)*s*.5+.5,Math.sin(a)*s*.5+.5,z*.5+.5];}
/* keep painting on the map the mode needs; in Paint the lit normal is shown so the bumps can be seen */
function npSync(force){if(stroke||preview||selLive||ui.mode==='anim')return;if(ui.tool!=='brush'&&ui.tool!=='smudge'&&ui.tool!=='gradient')return;const L=doc.active;if(!isNormalLayer(L)||L.fx||L.editMask)return;
  if(ui.tool==='smudge'&&(doc.map==='height'||doc.map==='normal'))return;
  const k=ui.tool==='gradient'?'height':npMapOf();if(!doc.maps.includes(k))return;if(doc.map!==k)setEditMap(k,true);
  if(force&&ui.mode==='paint'&&doc.view!=='nfinal')setView('nfinal');}
/* the gradient tool on a normal layer makes a slope: a ramp of height from flat to the strength, dragged from the low side to the high side */
const npSlopeOn=()=>ui.tool==='gradient'&&isNormalLayer(doc.active)&&!doc.active.fx&&doc.map==='height';
function npSlopeDef(){const h=clamp(np.mode==='dent'?.5-.25*np.str:.5+.25*np.str,0,1);return gradDef([{p:0,c:[.5,.5,.5]},{p:1,c:[h,h,h]}],null,{method:'classic',dither:false});}
/* settings of a stroke on a normal layer */
function npApply(o,et,projected){const L=et&&et.L;if(o.tool!=='brush'||!isNormalLayer(L)||et.isMask)return;
  o.noTint=true;o.hueJitter=o.satJitter=o.valJitter=0;o.extras=[];
  if(npWorldPaint(L)){
    if(!projected){toast('Paint World direction on the model in the 3D view.');return false;}
    Object.assign(o,{worldNormal:npWorldDirection(),chan:null,edgeSat:0,glaze:0,wet:0});
  }else if(np.mode==='dir')o.color=npDirColour();
  else{/* Height adds twice the colour's distance from mid-grey, so Strength 100% is the whole height range */
    const c=np.mode==='dent'?.5-.25*np.str:.5+.25*np.str;o.color=[c,c,c];}}
function cmdNewNormalLayer(){if(ui.mode==='anim'){toast('Normal layers are available in Paint and 3D Paint.');return null;}
  if(ui.mode!=='paint'&&ui.mode!=='p3d'&&typeof setMode==='function')setMode('paint',true);
  if(stroke||preview||selLive){toast('Finish the current edit first.');return null;}
  const need=['height','normal'].filter(k=>!doc.maps.includes(k));if(need.length)setDocMaps([...doc.maps,...need],'Add Height and Normal for the normal layer');
  const L=newLayerObj('Normal');
  for(const k of Object.keys(L.maps))if(k!=='height'&&k!=='normal'&&k!==doc.map){disposeTarget(L.maps[k]);delete L.maps[k];}
  L.blankBase=true;L.nrm=true;ensureMapTarget(L,'height');ensureMapTarget(L,'normal');
  structOp('New normal layer',()=>{const [p,i]=insertPoint();insertNode(L,p,i);selectOnly(L);});
  if(ui.tool!=='smudge')setTool('brush');npSync(true);if(typeof buildBrushPanel==='function')buildBrushPanel();
  if(ui.mode==='p3d'){p3SetChannelView(np.mode==='world'?null:'nfinal');showPanel('tool');}
  toast('Normal layer added. Paint Raise or Dent to bump the surface, or Direction to tilt it. Settings are in the Brush panel.');return L;}
/* the Normal paint section of the brush settings */
function buildNormalSection(box){const L=doc.active;if(!isNormalLayer(L)||ui.mode==='bake')return;
  const sec=el('div',{class:'npsec'},el('div',{class:'sub',text:'Normal paint'}));
  const world=ui.mode==='p3d'&&np.mode==='world',mode=np.mode==='world'&&!world?'raise':np.mode;
  const swatch=el('span',{class:'npsw','aria-hidden':'true'});const paint=()=>{swatch.hidden=mode!=='dir'&&!world;if(!swatch.hidden){const rgb=world?npWorldDirection().map(v=>.5+.5*v):npDirColour();swatch.style.background='rgb('+rgb.map(v=>Math.round(v*255)).join(',')+')';}};
  const modes=ui.mode==='p3d'?[...NP_MODES,['world','World direction']]:NP_MODES;
  const modeBar=seg(modes,mode,v=>{np.mode=v;npSave();npSync(true);if(ui.mode==='p3d')p3SetChannelView(v==='world'?null:'nfinal');buildBrushPanel();},'Normal paint mode');
  modeBar.classList.add('themeseg');
  sec.append(el('div',{class:'frow'},modeBar,swatch));
  if(world){
    const direction=(key,label,min,max)=>makeSlider({id:'np_'+key,label,min,max,step:1,value:np[key],fmt:v=>Math.round(v)+'°',onInput:v=>{np[key]=v;npSave();paint();}}).el;
    const aim=()=>{const c=v3.cam;npWorldAim(norm3(sub3(v3Eye(),[c.tx,c.ty,c.tz])));};
    sec.append(direction('worldAz','Azimuth',0,359),direction('worldEl','Elevation',-90,90),
      el('div',{class:'chips'},el('button',{class:'btn sm',text:'Aim at camera',onclick:aim})),
      chk('npWorldView','Show world normals',!!v3s().worldNormalView,on=>p3SetWorldNormalView(on)),
      el('p',{class:'note',text:'Paint on the model. Each stroke points the surface toward the same world direction.'}));
  }else if(mode==='dir'){sec.append(makeSlider({id:'npAng',label:'Direction',min:0,max:359,step:1,value:np.ang,fmt:v=>Math.round(v)+'°',onInput:v=>{np.ang=v;npSave();paint();}}).el,
    makeSlider({id:'npTilt',label:'Tilt',min:0,max:1,step:.01,value:np.tilt,fmt:pct,onInput:v=>{np.tilt=v;npSave();paint();}}).el,
    el('p',{class:'note',text:'0° tilts toward the right, 90° up. Tilt 0% is flat.'}));}
  else sec.append(makeSlider({id:'npStr',label:'Strength',min:.02,max:1,step:.01,value:np.str,fmt:pct,onInput:v=>{np.str=v;npSave();}}).el,
    el('p',{class:'note',text:(mode==='dent'?'Sinks':'Raises')+' the surface where you paint. The brush shape is the profile: soft makes hills, a textured tip makes a textured bump. Lower Opacity or Flow for gentler strokes.'}));
  if(doc.maps.includes('height'))sec.append(makeSlider({id:'npBump',label:'Bump (whole document)',min:0,max:32,step:.5,value:doc.nrmStr,fmt:v=>v.toFixed(1),onInput:v=>{doc.nrmStr=v;if(doc.view==='material'||doc.view==='nfinal')requestRender(true);if(typeof v3Refresh==='function'&&ui.mode==='p3d')v3Refresh();}}).el);
  paint();box.append(sec);}

try{$('#lNrm').addEventListener('click',()=>cmdNewNormalLayer());}catch(e){console.warn('normal layer button',e);}
