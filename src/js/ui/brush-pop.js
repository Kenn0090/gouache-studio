/* ================= Right-click brush picker (0.67, tester feedback) =================
   Right-click (without dragging) on the canvas, or on the model in 3D Paint, with a painting tool, opens a small window at the
   pointer: size, hardness and opacity, and the whole brush library in its collections (with a search) and the Textures library
   (click one to use it as the brush tip). Esc, or a click outside, closes it. Preferences › Painting can turn it off. */
const bp={el:null,tab:'brushes',q:'',open:new Set()};
const BP_TOOLS=['brush','erase','smudge','dodge','burn'];
function bpEligible(e){return prefs.rcBrush!==false&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&['paint','p3d','brush'].includes(ui.mode)&&BP_TOOLS.includes(ui.tool)&&!(xf&&!xf.move)&&!stroke&&modal.hidden&&(ui.mode!=='p3d'||v3.paintOn);}
function bpClose(){if(!bp.el)return;bp.el.remove();bp.el=null;document.removeEventListener('pointerdown',bp.out,true);document.removeEventListener('keydown',bp.key,true);window.removeEventListener('blur',bpClose);}
function bpTile(p){const c=tileCanvas(p),b=el('button',{class:'bptile'+(p===activePreset?' on':''),title:p.name+(p.tool==='smudge'?' (blend)':''),'aria-label':p.name,onclick:()=>{applyPreset(p);bpClose();}},c);return b;}
function bpSliders(){const t=ui.tool,box=el('div',{class:'bpsl'});
  const add=(id,label,min,max,step,fmt,get,set,map,extra)=>{const s=makeSlider(Object.assign({id,label,min,max,step,value:get(),fmt,map,onInput:v=>{set(v);}},extra||{}));box.append(s.el);return s;};
  add('rcSize','Size',0,1000,1,v=>Math.round(v)+'px',()=>brush.size,v=>{brush.size=v;if(sizeSlider)sizeSlider.set(v);refreshCursor();brushEdited('size');},typeof sizeMap!=='undefined'?sizeMap:undefined,brushNumericRange('size'));
  if(!brush.tip&&t!=='dodge'&&t!=='burn')add('rcHard','Hardness',0,1,.01,pct,()=>brush.hardness,v=>{brush.hardness=v;brushEdited('hardness');});
  if(t==='smudge')add('rcStr','Strength',0,1,.01,pct,()=>brush.strength,v=>{brush.strength=v;brushEdited('strength');});
  else if(t==='dodge'||t==='burn')add('rcExp','Exposure',.01,1,.01,pct,()=>ui.tonalExposure,v=>{ui.tonalExposure=v;});
  else add('rcOp','Opacity',0,1,.01,pct,()=>brush.opacity,v=>{brush.opacity=v;brushEdited('opacity');});
  return box;}
function bpBrushes(body){const search=el('input',{type:'search',id:'bpSearch',placeholder:'Search brushes','aria-label':'Search brushes',value:bp.q}),list=el('div',{class:'bplist'});
  const fill=()=>{list.replaceChildren();const q=bp.q.trim().toLowerCase();
    if(q){const hits=[];for(const s of library)for(const p of s.presets)if(p.name.toLowerCase().includes(q))hits.push(p);
      list.append(el('div',{class:'bptiles'},...hits.slice(0,150).map(bpTile)),hits.length?null:el('p',{class:'note',text:'No brushes match.'}));return;}
    if(brushSession.recent.length)list.append(el('div',{class:'bphead',text:'Recent brushes'}),el('div',{class:'bptiles'},...brushSession.recent.slice(0,12).map(bpTile)));
    for(const s of library){const d=el('details',{class:'bpset'}),n=s.presets.length;d.open=bp.open.has(s.id)||(s.presets.includes(activePreset));
      const tiles=el('div',{class:'bptiles'});let made=false;const make=()=>{if(made)return;made=true;tiles.append(...s.presets.map(bpTile));};
      d.append(el('summary',{text:s.name+' · '+n}),tiles);d.addEventListener('toggle',()=>{if(d.open){bp.open.add(s.id);make();}else bp.open.delete(s.id);});if(d.open)make();list.append(d);}};
  search.addEventListener('input',()=>{bp.q=search.value;fill();});fill();body.append(search,list);setTimeout(()=>search.focus({preventScroll:true}),0);}
function bpTextures(body){if(typeof tx==='undefined'||typeof txItems!=='function'){body.append(el('p',{class:'note',text:'Textures are not available here.'}));return;}if(!tx.loaded&&typeof txLoad==='function')txLoad();
  const search=el('input',{type:'search',id:'bpTxSearch',placeholder:'Search textures','aria-label':'Search textures'}),grid=el('div',{class:'bptiles bptx'});
  const fill=()=>{grid.replaceChildren();const q=search.value.trim().toLowerCase(),items=txItems().filter(it=>!q||it.name.toLowerCase().includes(q)).slice(0,200);
    for(const it of items){const img=el('img',{alt:'',width:64,height:64,draggable:'false'});img._tx=it;txObserve(img);grid.append(el('button',{class:'bptile',title:it.name+' — use as the brush tip','aria-label':it.name,onclick:async()=>{bpClose();try{await txToTip(it);toast('Using “'+it.name+'” as the brush tip.');}catch(e){toast('That texture could not be used: '+(e.message||e));}}},img));}
    if(!items.length)grid.append(el('p',{class:'note',text:'No textures match.'}));};
  search.addEventListener('input',fill);fill();body.append(el('p',{class:'note',text:'Click a texture to use it as the brush tip.'}),search,grid);}
function bpOpen(x,y){bpClose();const pop=el('div',{class:'brushpop',id:'brushPop',role:'dialog','aria-label':'Brush picker'}),tabs=el('div',{class:'seg bptabs'}),body=el('div',{class:'bpbody'});
  const draw=()=>{tabs.replaceChildren(...[['brushes','Brushes'],['textures','Textures']].map(([k,l])=>el('button',{type:'button',class:'segb','aria-pressed':String(bp.tab===k),id:'bpTab_'+k,text:l,onclick:()=>{bp.tab=k;draw();}})));
    body.replaceChildren();if(bp.tab==='textures')bpTextures(body);else bpBrushes(body);};
  pop.append(bpSliders(),tabs,body);document.body.append(pop);bp.el=pop;draw();
  const W=360,H=Math.min(560,window.innerHeight-20),left=clamp(x+10,8,window.innerWidth-W-8),top=clamp(y-20,8,window.innerHeight-H-8);pop.style.cssText='left:'+left+'px;top:'+top+'px;width:'+W+'px;max-height:'+H+'px';
  bp.out=e=>{if(!bp.el.contains(e.target))bpClose();};bp.key=e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();bpClose();}};
  document.addEventListener('pointerdown',bp.out,true);document.addEventListener('keydown',bp.key,true);window.addEventListener('blur',bpClose);}
/* a right-click is a press and release in the same place; one that moved (panning with the pen's side button, moving the view) does not open it */
function bpBind(elm){let dn=null;elm.addEventListener('pointerdown',e=>{dn=e.button===2?{x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId}:null;},true);
  elm.addEventListener('pointerup',e=>{const d=dn;dn=null;if(e.button!==2||!d||e.pointerId!==d.id||Math.hypot(e.clientX-d.x,e.clientY-d.y)>6||performance.now()-d.t>700||!bpEligible(e))return;bpOpen(e.clientX,e.clientY);},true);}
function bpContext(){return false;}
bpBind(document.getElementById('gl'));
