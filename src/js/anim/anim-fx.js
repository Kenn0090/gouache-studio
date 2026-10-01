/* ================= Animation effect tracks =================
   An effect track is a filter (Radial blur, Warp…) that sits over every frame. Each slider can have
   keyframes, so the effect changes as the animation plays. A.fxl = [{id, v, keys:{param:[{f,e,v}]}, on, open}].
   Each track owns a real filter layer (tr._L) that is put above the frame while in Animation mode. */
const AFX_IDS=['filmGrain','dissolve','vfxGlow','radialBlur','warp','distort','noise','gradMap','blur','motionBlur','hueSat','levels','pixelBitmap','halftone','glass','acid'];
const AFX_EASE=[['lin','Linear'],['in','Ease in'],['out','Ease out'],['io','Ease in-out'],['hold','Hold']];
const afxEase=(e,t)=>e==='in'?t*t:e==='out'?1-(1-t)*(1-t):e==='io'?t*t*(3-2*t):t;
const afxList=()=>{const A=A_();return A?(A.fxl||(A.fxl=[])):[];};
const afxAnimatable=id=>(FX[id].defs||[]).filter(d=>typeof d.value==='number');
/* value of one slider at frame f */
function afxValue(tr,key,f){const ks=tr.keys[key];if(!ks||!ks.length)return tr.v[key];
  if(f<=ks[0].f)return ks[0].v;const l=ks[ks.length-1];if(f>=l.f)return l.v;
  for(let i=0;i<ks.length-1;i++){const a=ks[i],b=ks[i+1];if(f>=a.f&&f<=b.f){if(a.e==='hold')return a.v;return a.v+(b.v-a.v)*afxEase(a.e,(f-a.f)/(b.f-a.f));}}
  return tr.v[key];}
function afxValues(tr,f){const v=Object.assign({},tr.v);for(const k in tr.keys)v[k]=afxValue(tr,k,f);if(FX[tr.id].frameSeed&&v.animated!==false)v.seed=(tr.v.seed||0)+f*13.37;return v;}
function afxLayer(tr){if(!tr._L){tr._L=newFxLayerObj(FX[tr.id].title,[{id:tr.id,v:fxDefaults(FX[tr.id]),on:true}],'base');tr._L.autoName=false;}return tr._L;}
/* put the layers above the current frame with this frame's values */
function afxApply(){const A=A_();if(!A||ui.mode!=='anim')return;const F=A.frames[A.cur],kids=[F];
  for(const tr of afxList()){const L=afxLayer(tr);L.fx.stack[0].v=afxValues(tr,A.cur);L.fx.stack[0].on=tr.on!==false;L.visible=tr.on!==false;L.parent=animRoot;dropFxCache(L);kids.push(L);}
  animRoot.children=kids;}
const afxActive=()=>afxList().some(t=>t.on!==false);
const afxClone=tr=>Object.assign({},tr,{v:Object.assign({},tr.v),keys:JSON.parse(JSON.stringify(tr.keys))});
const afxSave=()=>afxList().map(t=>({id:t.id,v:t.v,keys:t.keys,on:t.on!==false}));
function afxLoad(a){return (a||[]).filter(t=>FX[t.id]).map(t=>({id:t.id,v:Object.assign(fxDefaults(FX[t.id]),t.v),keys:t.keys||{},on:t.on!==false}));}
function afxAdd(id){if(!FX[id])return;animOp('Add effect',A=>{A.fxl=A.fxl||[];const tr={id,v:fxDefaults(FX[id]),keys:{},on:true,open:true};A.fxl.push(tr);afxUI.sel=A.fxl.length-1;});}
function afxRemove(i){animOp('Remove effect',A=>{const [tr]=A.fxl.splice(i,1);afxUI.sel=Math.min(afxUI.sel,A.fxl.length-1);});}
function afxToggle(i){animOp('Effect on/off',A=>{A.fxl[i].on=A.fxl[i].on===false;});}
function afxSetKey(i,key,f,val,e){animOp('Keyframe',A=>{const tr=A.fxl[i],ks=tr.keys[key]=tr.keys[key]||[];const k=ks.find(x=>x.f===f);
  if(k){k.v=val;if(e)k.e=e;}else{ks.push({f,v:val,e:e||afxUI.ease});ks.sort((a,b)=>a.f-b.f);}});}
function afxDelKey(i,key,f){animOp('Remove keyframe',A=>{const tr=A.fxl[i],ks=tr.keys[key];if(!ks)return false;const n=ks.findIndex(x=>x.f===f);if(n<0)return false;
  if(ks.length===1)tr.v[key]=ks[0].v;ks.splice(n,1);if(!ks.length)delete tr.keys[key];});}
/* slider moved on the current frame: change the base value, or the key that sits here, or (once animated) make a key */
function afxEdit(i,key,val){const A=A_(),tr=afxList()[i];if(!tr)return;const ks=tr.keys[key];
  if(!ks||!ks.length)tr.v[key]=val;else{const k=ks.find(x=>x.f===A.cur);if(k)k.v=val;else{ks.push({f:A.cur,v:val,e:afxUI.ease});ks.sort((a,b)=>a.f-b.f);}}
  afxApply();requestRender(true);afxMarks();afxUI.dirty=true;clearTimeout(afxUI.t);afxUI.t=setTimeout(afxCommit,600);}
/* undo step for slider drags: snapshot taken at the first edit */
function afxCommit(){afxUI.dirty=false;}
const afxUI={sel:0,ease:'lin',open:true,dirty:false,t:0};
/* undoable slider edits: wrap a drag in one step */
function afxEditStep(i,key,val){const A=A_();if(!afxUI.pre){afxUI.pre=animState();}afxEdit(i,key,val);afxUndoLater();}
/* any other setting of an effect changed (mode buttons, ticks, colours, pickers) */
function afxTouch(){if(!afxUI.pre)afxUI.pre=animState();afxApply();requestRender(true);afxUndoLater();}
function afxUndoLater(){
  clearTimeout(afxUI.pt);afxUI.pt=setTimeout(()=>{const before=afxUI.pre,after=animState();afxUI.pre=null;if(JSON.stringify(afxSave2(before))===JSON.stringify(afxSave2(after)))return;
    pushUndo({label:'Effect',mode:'anim',refs:[...new Set([...before.frames,...after.frames])],undo(){setAnimState(before);},redo(){setAnimState(after);}});},700);}
const afxSave2=s=>(s.fxl||[]).map(t=>({id:t.id,v:t.v,keys:t.keys,on:t.on}));

/* ---- timeline UI ---- */
function afxStripFill(strip,tr,A){strip.replaceChildren();const fs=new Set();for(const k in tr.keys)for(const p of tr.keys[k])fs.add(p.f);
  for(const f of fs){if(f>=A.frames.length)continue;strip.append(el('span',{class:'afxkey'+(f===A.cur?' cur':''),style:'left:'+(f*CELL+CELL/2-5)+'px',title:'Frame '+(f+1)}));}}
/* after a slider moves: update the diamonds and the key strips in place (the sliders keep their focus) */
function afxMarks(){const A=A_();if(!A||!tlParts.fxbox)return;const L=afxList();
  tlParts.fxstrips.querySelectorAll('.afxstrip').forEach((st,i)=>{if(L[i])afxStripFill(st,L[i],A);});
  const tr=L[afxUI.sel];if(!tr)return;tlParts.fxedit.querySelectorAll('.afxdia').forEach(d=>{const ks=tr.keys[d.dataset.key],has=ks&&ks.some(k=>k.f===A.cur);
    d.classList.toggle('on',!!has);d.classList.toggle('mid',!has&&!!(ks&&ks.length));d.title=has?'Remove the keyframe on this frame':'Keyframe this slider on this frame';});}
/* Keep the frame being edited inside the key viewport, which is narrower than the frames. */
function afxRevealKey(f){const sc=tlParts.fxstrips.parentNode,left=f*CELL,right=left+CELL;
  if(left<sc.scrollLeft||right>sc.scrollLeft+sc.clientWidth)sc.scrollLeft=left-sc.clientWidth/2+CELL/2;}
function afxSyncScroll(){const sc=tlParts.fxstrips.parentNode,frames=tlParts.scroll,A=A_();
  sc.scrollLeft=frames.scrollLeft+Math.max(0,(frames.clientWidth-sc.clientWidth)/2);
  if(A&&A.cur*CELL>=frames.scrollLeft&&A.cur*CELL<frames.scrollLeft+frames.clientWidth)afxRevealKey(A.cur);}
function renderAnimFx(){const A=A_();const box=tlParts.fxbox;if(!box||ui.mode!=='anim'||!A)return;
  const L=afxList(),hd=tlParts.fxhead;
  hd.querySelector('.fxcount').textContent=L.length?L.length+(L.length===1?' effect':' effects'):'';
  hd.classList.toggle('open',afxUI.open);box.style.display=afxUI.open?'':'none';if(!afxUI.open)return;
  const rows=L.map((tr,i)=>{const row=el('div',{class:'afxrow'+(i===afxUI.sel?' sel':'')});
    const eye=el('button',{class:'eye','aria-label':'Effect on/off',title:'Turn off / on'});eye.innerHTML=tr.on!==false?eyeOn:eyeOff;eye.onclick=()=>afxToggle(i);
    const nm=el('button',{class:'afxname',text:FX[tr.id].title,title:'Show its settings',onclick:()=>{afxUI.sel=i;renderAnimFx();}});
    const x=el('button',{class:'btn sm ghost',text:'×',title:'Remove effect','aria-label':'Remove effect',onclick:()=>afxRemove(i)});
    const strip=el('div',{class:'afxstrip',style:'width:'+(A.frames.length*CELL)+'px'});
    afxStripFill(strip,tr,A);
    strip.addEventListener('pointerdown',e=>{const b=strip.getBoundingClientRect();afxUI.sel=i;showFrame(clamp(Math.floor((e.clientX-b.left)/CELL),0,A.frames.length-1));});
    row.append(el('div',{class:'afxhead'},eye,nm,x),strip);return row;});
  tlParts.fxrows.replaceChildren(...rows.map(r=>r.firstChild));tlParts.fxstrips.replaceChildren(...rows.map(r=>r.lastChild));
  tlParts.fxrows.querySelectorAll('.afxhead').forEach((h,i)=>h.classList.toggle('sel',i===afxUI.sel));
  /* settings of the picked effect */
  const tr=L[afxUI.sel],ed=tlParts.fxedit;ed.replaceChildren();if(!tr){ed.append(el('span',{class:'dim',text:'Add an effect, then press ◆ next to a slider on different frames to animate it.'}));return;}
  const f=A.cur;
  const ease=el('select',{class:'tlsel','aria-label':'Easing for new keys',title:'How the value moves after a new keyframe'});for(const [v,t] of AFX_EASE)ease.append(el('option',{value:v,text:t}));ease.value=afxUI.ease;
  ease.onchange=()=>{afxUI.ease=ease.value;};
  ed.append(el('div',{class:'afxtop'},el('b',{text:FX[tr.id].title}),el('span',{class:'dim',text:'Frame '+(f+1)}),el('label',{class:'dim',text:'New keys: '}),ease));
  const grid=el('div',{class:'afxgrid'});
  for(const d of afxAnimatable(tr.id)){const ks=tr.keys[d.key],has=ks&&ks.some(k=>k.f===f);
    const s=makeSlider(Object.assign({},d,{value:afxValue(tr,d.key,f),id:'afx_'+d.key,onInput:x=>afxEditStep(afxUI.sel,d.key,x)}));
    const dia=el('button',{class:'afxdia'+(has?' on':ks&&ks.length?' mid':''),title:has?'Remove the keyframe on this frame':'Keyframe this slider on this frame','aria-label':'Keyframe '+(d.label||d.key),text:'◆'});
    dia.dataset.key=d.key;dia.onclick=()=>{const k=tr.keys[d.key],on=k&&k.some(x=>x.f===A_().cur);if(on)afxDelKey(afxUI.sel,d.key,A_().cur);else afxSetKey(afxUI.sel,d.key,A_().cur,afxValue(tr,d.key,A_().cur));};
    grid.append(el('div',{class:'afxsl'},dia,s.el));}
  ed.append(grid);
  /* the rest of the filter's own controls (modes, ticks, colours, pickers) */
  const o=FX[tr.id],extra=el('div',{class:'dlg-grid afxextra'});
  try{const ctx={src:A.frames[A.cur].target};if(o.note)extra.append(el('p',{class:'note',text:o.note}));
    if(o.controls)extra.append(...o.controls(tr.v,afxTouch,ctx));
    for(const [key,label] of o.checks||[])extra.append(chk('afx_ck_'+key,label,key==='uvWrap'?tr.v[key]!==false:!!tr.v[key],x=>{tr.v[key]=x;afxTouch();}));}catch(e){}
  if(extra.children.length)ed.append(extra);afxSyncScroll();}
/* (0.45, Kenn) the effect picker: a small window with the effects in sections (Blurs, Patterns, Artistic…) and a search box */
const AFX_SECTIONS=()=>{const nm={'Blur and sharpen':'Blurs'};const out=[['Animated',AFX_IDS.slice(0,7)]];
  for(const [g,ids] of FX_KINDS())out.push([nm[g]||g,ids]);
  const used=new Set(out.flatMap(x=>x[1]));const more=Object.keys(FX).filter(id=>!used.has(id));if(more.length)out.push(['More',more]);
  return out.map(([n,ids])=>[n,ids.filter(id=>FX[id]&&FX[id].render)]).filter(x=>x[1].length);};
function afxAddMenu(){const btn=el('button',{class:'tlchip afxaddbtn',type:'button','aria-label':'Add an effect','aria-haspopup':'dialog',title:'Add an effect you can animate',text:'+ Effect ▾'});
  let pop=null,off=null;
  const close=()=>{if(pop){pop.remove();pop=null;}if(off){off();off=null;}};
  btn.onclick=()=>{if(pop){close();return;}
    const secs=AFX_SECTIONS(),all=[...new Set(secs.flatMap(x=>x[1]))].sort((x,y)=>FX[x].title.localeCompare(FX[y].title));
    let cur=secs[0][0],q='';
    const search=el('input',{type:'search',class:'afxsearch',placeholder:'Search effects…','aria-label':'Search effects'}),nav=el('div',{class:'afxnav',role:'tablist'}),grid=el('div',{class:'afxgrid'});
    const pick=id=>{close();afxUI.open=true;afxAdd(id);};
    const draw=()=>{nav.replaceChildren(...secs.map(([n,ids])=>el('button',{type:'button',role:'tab',class:'afxsec'+(!q&&n===cur?' on':''),'aria-selected':String(!q&&n===cur),text:n,onclick:()=>{cur=n;q='';search.value='';draw();}},el('i',{text:String(ids.length)}))));
      const ids=q?all.filter(id=>FX[id].title.toLowerCase().includes(q)||id.toLowerCase().includes(q)):(secs.find(x=>x[0]===cur)||secs[0])[1];
      grid.replaceChildren(...(ids.length?ids.map(id=>el('button',{type:'button',class:'afxfx',text:FX[id].title,'data-fx':id,onclick:()=>pick(id)})):[el('p',{class:'note',text:'No effect has that name.'})]));};
    search.addEventListener('input',()=>{q=search.value.trim().toLowerCase();draw();});
    pop=el('div',{class:'afxmenu',role:'dialog','aria-label':'Add an effect'},search,el('div',{class:'afxmbody'},nav,grid));
    document.body.append(pop);draw();
    const r=btn.getBoundingClientRect(),w=Math.min(520,window.innerWidth-16);pop.style.width=w+'px';pop.style.left=Math.max(8,Math.min(r.left,window.innerWidth-w-8))+'px';
    const h=pop.offsetHeight;pop.style.top=Math.max(8,(r.top-h-6>8?r.top-h-6:r.bottom+6))+'px';search.focus();
    const dn=e=>{if(pop&&!pop.contains(e.target)&&e.target!==btn)close();},kd=e=>{if(e.key==='Escape'){e.stopPropagation();close();btn.focus();}};
    window.addEventListener('pointerdown',dn,true);window.addEventListener('keydown',kd,true);off=()=>{window.removeEventListener('pointerdown',dn,true);window.removeEventListener('keydown',kd,true);};};
  return btn;}
(function buildFxArea(){const hd=el('div',{class:'afxbar'});
  const tg=el('button',{class:'tlchip',text:'Effects ▾',title:'Show or hide the effects under the frames',onclick:()=>{afxUI.open=!afxUI.open;renderAnimFx();}});
  hd.append(tg,afxAddMenu(),el('span',{class:'dim fxcount'}));tlParts.fxhead=hd;
  tlParts.fxrows=el('div',{class:'afxrows'});tlParts.fxstrips=el('div',{class:'afxstrips'});
  tlParts.fxedit=el('div',{class:'afxedit'});
  tlParts.fxbox=el('div',{class:'afxbox'},el('div',{class:'afxlist'},tlParts.fxrows,el('div',{class:'afxscroll'},tlParts.fxstrips)),tlParts.fxedit);
  const grip=el('div',{class:'afxresize',role:'separator','aria-label':'Resize effect settings',title:'Drag to widen the effect settings'});tlParts.fxbox.insertBefore(grip,tlParts.fxedit);
  grip.addEventListener('pointerdown',e=>{e.preventDefault();grip.setPointerCapture(e.pointerId);const x=e.clientX,w=tlParts.fxedit.getBoundingClientRect().width;const move=ev=>{tlParts.fxedit.style.setProperty('--afx-width',clamp(w+x-ev.clientX,250,Math.max(250,tl.clientWidth-360))+'px');};const end=()=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',end);grip.removeEventListener('pointercancel',end);};grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',end);grip.addEventListener('pointercancel',end);});
  tl.append(hd,tlParts.fxbox);
  tlParts.scroll.addEventListener('scroll',afxSyncScroll);
  new ResizeObserver(()=>{if(ui.mode==='anim'&&A_())afxSyncScroll();}).observe(tlParts.fxstrips.parentNode);})();
/* every frame as it looks with the effects on (used by export) */
function afxRenderAll(A){if(!afxActive())return A.frames.map(F=>frameCanvas(F));
  const keep=A.cur,out=[];try{for(let i=0;i<A.frames.length;i++){A.cur=i;afxApply();dirtyComp=true;out.push(frameCanvas(A.frames[i],freshComposite()));}}
  finally{showFrame(keep);}return out;}
