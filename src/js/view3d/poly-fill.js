/* ================= Polygon fill (0.95.5, Kenn) =================
   A 3D Paint tool like Substance Painter's: click (or drag over) the model to fill whole polygons at once, by
   Face (the quad), Triangle, Loop (a ring of quads) or UV island. It fills the selected layer with the brush colour (and the
   material brush's other maps); on a mask it fills white, Alt+click black. One undo step per click or drag. */
const PF_KINDS=[['face','Face'],['tri','Triangle'],['loop','Loop'],['island','UV island']];
const pf=(()=>{const d={kind:'face'};try{Object.assign(d,JSON.parse(localStorage.getItem('gs.pfill')||'{}'));}catch(e){}return d;})();
const pfSave=()=>{try{localStorage.setItem('gs.pfill',JSON.stringify({kind:pf.kind}));}catch(e){}};
let pfDrag=null;
const pfOn=()=>ui.tool==='pfill'&&ui.mode==='p3d';
/* the triangles one seed grows into (the drawn mesh's triangles, subdivided ones included) */
function pfGrow(s){const own=pf.kind==='tri'?[s.t]:sel3Grow(s.O,s.t,pf.kind,s.pos,s.R),out=[];for(const x of own)for(let j=0;j<s.f;j++)out.push(x*s.f+j);return out;}
/* Alt + click (no drag) on a mask fills black; Alt + drag still turns the view */
function pfDown(hit,e){if(!pfOn()||e.button!==0||v3.drag||e.ctrlKey||e.metaKey)return false;if(e.altKey&&!pfMaskTarget())return false;
  const s=sel3HitSeed(hit,e);if(!s){return false;}e.preventDefault();try{hit.setPointerCapture(e.pointerId);}catch(er){}
  pfDrag={id:e.pointerId,m:s.m,O:s.O,f:s.f,R:s.R,tris:new Set(pfGrow(s)),seeds:new Set([s.t]),black:e.altKey,altPend:e.altKey,x:e.clientX,y:e.clientY,nav:e.altKey?v3NavOf(hit,e):null,root:doc.root};if(!e.altKey)pfPreview();return true;}
const pfMaskTarget=()=>{const et=typeof editTarget==='function'?editTarget():null;return !!(et&&et.isMask);};
function pfBusy(){return !!pfDrag;}
function pfMove(hit,e){const d=pfDrag;if(!d||e.pointerId!==d.id)return;if(!e.buttons){pfUp(e);return;}
  if(d.altPend){if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<4)return;pfDrag=null;sel3HoverClear();v3.drag={x:d.x,y:d.y,how:d.nav||'turn',id:d.id,x0:d.x,y0:d.y,alt:true};return;}const s=sel3HitSeed(hit,e);if(!s||s.m!==d.m||d.seeds.has(s.t))return;d.seeds.add(s.t);for(const t of pfGrow(s))d.tris.add(t);pfPreview();}
function pfPreview(){const d=pfDrag,H=sel3HoverState;if(!d)return;H.mesh=d.m;H.root=d.root;H.tris=[...d.tris];H.upload=true;v3.dirty=true;requestRender();}
/* hovering shows what a click would fill */
function pfHover(hit,e){if(!pfOn()||e.buttons||!modal.hidden||v3.drag){return false;}pfHover.q={clientX:e.clientX,clientY:e.clientY,hit};if(pfHover.f)return true;
  pfHover.f=requestAnimationFrame(()=>{pfHover.f=0;const q=pfHover.q;if(q&&pfOn()&&!pfDrag)pfHoverRun(q.hit,q);});return true;}
function pfHoverRun(hit,e){hit.style.cursor='crosshair';const s=sel3HitSeed(hit,e),H=sel3HoverState;
  if(!s){if(H.tris){H.tris=null;v3.dirty=true;requestRender();}return true;}const key=s.t+':'+pf.kind;if(H.pfKey===key&&H.tris)return true;H.pfKey=key;H.mesh=s.m;H.root=doc.root;H.tris=pfGrow(s);H.upload=true;v3.dirty=true;requestRender();return true;}
function pfUp(e){const d=pfDrag;if(!d||e&&e.pointerId!==undefined&&e.pointerId!==d.id)return;pfDrag=null;sel3HoverClear();if(e&&e.type==='pointercancel')return;pfApply(d.m,[...d.tris],d.black);}
/* fill those triangles: their UV shapes become a temporary selection, then the layer (or mask) is filled through it */
function pfApply(m,tris,black){if(!tris.length)return;if(stroke||preview){toast('Finish the current edit first.');return;}
  if(typeof fillNoMask==='function'&&fillNoMask())return;const et=needTarget();if(!et)return;if(typeof lockStop==='function'&&lockStop(et))return;
  const cov=sel3Draw(m,tris),keep=selState(),keepT=sel.t;
  try{sel.t=cov;sel.active=true;sel.quick=false;sel.bb=fullRect();
    const g=black?0:1,c=et.isMask?[g,g,g,1]:[...ui.fg,1],oth=fillOthers(et,et.isMask?null:mapBrushColor);fillSel(et,c,'Polygon fill',oth);}
  finally{sel.t=keepT;setSelState(keep);release(cov);}
  v3.mapsDirty=true;v3.dirty=true;requestRender(true);}
/* the tool's options (in the Brush panel's place) */
function pfPanel(box){$('#brushTitle').textContent='Polygon fill';
  box.append(el('div',{class:'sub',text:'Fill by'}),seg(PF_KINDS,pf.kind,v=>{pf.kind=v;pfSave();sel3HoverState.pfKey=null;buildBrushPanel();},'Polygon fill by'),
    el('p',{class:'note',text:'Click the model to fill a whole '+(PF_KINDS.find(k=>k[0]===pf.kind)||PF_KINDS[0])[1].toLowerCase()+' with the brush colour; drag to fill several. On a mask it fills white; Alt+click fills black. Only the active texture set takes paint.'}));}
/* the tool button (3D Paint only) */
(function pfButton(){const bar=$('#tools');if(!bar)return;const b=el('button',{class:'tool','data-tool':'pfill',title:'Polygon fill','aria-label':'Polygon fill','aria-pressed':'false'});
  b.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 18 9 5l11 4-4 11z"/><path d="M9 5l7 15M4 18l16-9" opacity=".45"/></svg>';b.addEventListener('click',()=>setTool('pfill'));
  const after=bar.querySelector('.tool[data-tool="smudge"]');if(after&&after.nextSibling)bar.insertBefore(b,after.nextSibling);else bar.append(b);})();
