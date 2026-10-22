/* ================= The brush preview stays in view, and pops out (0.67) =================
   The little stroke preview at the top of the brush settings stays at the top while the settings scroll under it, so you see each
   change as you make it. The ⧉ button pops it out into a window you can move and resize over the canvas; the ↗ button in that
   window moves it into a window of its own (for a second monitor). All of them redraw together with every change. */
const prevPop={el:null,win:null};
function prevPopOut(){if(prevPop.el&&prevPop.el.isConnected){prevPop.el.classList.add('flash');setTimeout(()=>prevPop.el&&prevPop.el.classList.remove('flash'),600);return;}
  let st={};try{st=JSON.parse(localStorage.getItem('gs.prevFloat')||'{}');}catch(e){}
  const c=el('canvas',{id:'brushPrevFloat','aria-label':'Preview of a stroke with the current brush settings'}),note=el('span',{class:'note',id:'prevNoteFloat'});
  const w=el('div',{id:'prevFloat',class:'prevfloat',role:'dialog','aria-label':'Brush preview',style:'left:'+clamp(st.x==null?160:st.x,0,window.innerWidth-120)+'px;top:'+clamp(st.y==null?120:st.y,0,window.innerHeight-90)+'px;width:'+(st.w||360)+'px;height:'+(st.h||150)+'px'});
  const save=()=>{try{const r=w.getBoundingClientRect();localStorage.setItem('gs.prevFloat',JSON.stringify({x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}));}catch(e){}};
  const head=el('div',{class:'pfhead',title:'Drag to move'},el('span',{class:'pft',text:'Brush preview'}),
    el('button',{class:'tx',id:'prevOwn',title:'Move the preview into a window of its own (second monitor)','aria-label':'Own window',text:'↗',onclick:e=>{e.stopPropagation();prevOwnWindow(w);}}),
    el('button',{class:'tx',id:'prevFloatX',title:'Close the preview window','aria-label':'Close',text:'×',onclick:e=>{e.stopPropagation();w.remove();prevPop.el=null;schedulePreview();}}));
  head.addEventListener('pointerdown',e=>{if(e.target.closest('button')||e.button!==0)return;e.preventDefault();const r=w.getBoundingClientRect(),x0=e.clientX-r.left,y0=e.clientY-r.top;head.setPointerCapture(e.pointerId);
    const mv=ev=>{w.style.left=clamp(ev.clientX-x0,-r.width+80,window.innerWidth-60)+'px';w.style.top=clamp(ev.clientY-y0,0,window.innerHeight-40)+'px';};
    const up=()=>{head.removeEventListener('pointermove',mv);head.removeEventListener('pointerup',up);head.removeEventListener('pointercancel',up);save();};head.addEventListener('pointermove',mv);head.addEventListener('pointerup',up);head.addEventListener('pointercancel',up);});
  w.append(head,c,note);document.body.append(w);prevPop.el=w;new ResizeObserver(()=>{save();}).observe(w);
  prevFloats.push({canvas:c,note});prevRO.observe(c);schedulePreview();}
/* a window of its own: the same drawing, in a browser window (the desktop app allows these like its panel pop-outs) */
function prevOwnWindow(floatEl){const win=window.open('','gsBrushPreview','width=560,height=260');if(!win){toast('The pop-up window was blocked. Allow pop-ups for this page.');return;}
  const d=win.document;d.title='Brush preview';d.body.style.cssText='margin:0;background:#15171a;overflow:hidden';const c=d.createElement('canvas');c.id='brushPrevWin';c.style.cssText='display:block;width:100vw;height:100vh';d.body.append(c);
  prevFloats.push({canvas:c,note:null,win});prevRO.observe(c);prevPop.win=win;if(floatEl){floatEl.remove();prevPop.el=null;}
  win.addEventListener('resize',()=>schedulePreview());win.addEventListener('pagehide',()=>{prevPop.win=null;schedulePreview();});setTimeout(schedulePreview,50);}
(function(){const wrap=document.querySelector('.prevwrap');if(!wrap)return;wrap.append(el('button',{class:'prevpopbtn',id:'prevPop',title:'Pop out the preview into a window you can move and resize','aria-label':'Pop out the preview',text:'⧉',onclick:prevPopOut}));})();
