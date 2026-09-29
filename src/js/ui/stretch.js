/* ================= Stretch any panel (0.27) =================
   Kenn: "I should be able to adjust all panels, stretch things if I want, in 3D Paint or in any tab".
   - The main dock can be much wider (up to all but 300 px of the window).
   - 3D Paint's middle column (Colour, Brushes, Materials…) has its own drag edge.
   - The animation timeline can be made taller (bigger frame pictures): drag its top edge.
   - The toolbar: drag its edge to switch between one and two columns.
   Group heights (the bars between panel groups) and the 3D view split already drag. Sizes are part of each
   workspace's layout (gs.dock), so each tab/workspace remembers its own; double-click an edge to reset it. */
function stMaxW(extra){return Math.max(260,window.innerWidth-300-(extra||0));}
/* the main dock: a higher limit */
dkSetWidth=function(w){const c2=dkCol2On()&&dk.col2?dk.col2.w:0;dk.L.w=Math.round(clamp(w,200,stMaxW(c2)));dkGrid();if(typeof resizeGL==='function'){resizeGL();fit();}if(typeof drawSV==='function')drawSV();if(typeof cmRefresh==='function')cmRefresh();};
/* a generic vertical drag edge */
function stEdge(cls,label,get,set,dir,reset){const s=el('div',{class:'stedge '+cls,role:'separator','aria-orientation':'vertical','aria-label':label,title:label+' (double-click to reset)'});
  s.addEventListener('dblclick',()=>{if(dk.lock)return;set(reset);dkSave();});
  s.addEventListener('pointerdown',e=>{if(dk.lock||e.button!==0)return;e.preventDefault();const v0=get(),x0=e.clientX;document.body.classList.add('dkresizing');
    const mv=ev=>set(v0+dir*(ev.clientX-x0));const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);document.body.classList.remove('dkresizing');dkSave();};
    window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);});
  return s;}
/* 3D Paint's middle column */
function stSetCol2(w){if(!dk.col2)return;dk.col2.w=Math.round(clamp(w,180,stMaxW(dk.L.w||0)));dkGrid();if(typeof resizeGL==='function'){resizeGL();fit();}if(typeof drawSV==='function')drawSV();if(typeof cmRefresh==='function')cmRefresh();}
const stCol2=stEdge('stcol2','Column width',()=>dk.col2?dk.col2.w:250,stSetCol2,-1,250);
$('#app').append(stCol2);
/* the toolbar: one or two columns */
const stTools=stEdge('sttools','Toolbar width',()=>dk.L.tb.cols===2?82:46,w=>{const c=w>64?2:1;if(c!==dk.L.tb.cols)dkToolbar({cols:c});},1,46);
$('#app').append(stTools);
{const g=dkGrid;dkGrid=function(){g();const show=dkCol2On()&&dk.col2&&dk.col2.groups.some(x=>dkAvail(x).length);stCol2.hidden=!show;
  document.body.classList.toggle('tbright',dk.L.tb.side==='right');};}
/* the animation timeline: taller = bigger frame pictures */
const stTl=(()=>{let v=72;try{v=+(localStorage.getItem('gs.tlSize')||72)||72;}catch(e){}return {v};})();
function stSetTl(v){stTl.v=Math.round(clamp(v,48,240));document.documentElement.style.setProperty('--fcs',stTl.v+'px');try{localStorage.setItem('gs.tlSize',String(stTl.v));}catch(e){}}
{const tl=$('#timeline'),bar=el('div',{class:'sttl',role:'separator','aria-orientation':'horizontal','aria-label':'Timeline height',title:'Drag to make the timeline taller (double-click to reset)'});
  bar.addEventListener('dblclick',()=>stSetTl(72));
  bar.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();const v0=stTl.v,y0=e.clientY;document.body.classList.add('stvresize');
    const mv=ev=>{stSetTl(v0-(ev.clientY-y0));if(typeof resizeGL==='function')resizeGL();};const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);document.body.classList.remove('stvresize');if(typeof fit==='function')fit();};
    window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);});
  if(tl){tl.style.position='relative';tl.prepend(bar);}stSetTl(stTl.v);}
