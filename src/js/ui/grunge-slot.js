/* (0.97.24, Kenn: like Marmoset's grunge slot) one small square to drop a grunge on, or click to open a little gallery of the grunges
   in the program. Used by the generators' Grunge, the zone grunges (edges, cavities, flat, contact wear, scans) and the paint scan. */
let gslotPop=null;
function gslotClose(){if(gslotPop){try{txForget(gslotPop.el);}catch(e){}gslotPop.el.remove();document.removeEventListener('pointerdown',gslotPop.out,true);document.removeEventListener('keydown',gslotPop.key,true);gslotPop=null;}}
/* the gallery: search, the program's grunges and textures, your own, and "browse files…" */
function gslotGallery(anchor,done){gslotClose();
  const q=el('input',{type:'search',class:'gpop-q',placeholder:'Search grunges…','aria-label':'Search grunges'}),grid=el('div',{class:'gpop-grid'}),more=el('div',{class:'gpop-note',text:'Loading…'});
  const pop=el('div',{class:'gpop',role:'dialog','aria-label':'Choose a grunge'},el('div',{class:'gpop-h'},q,el('button',{type:'button',class:'btn sm',text:'Browse files…',title:'Use a picture from your computer',onclick:async()=>{const fs=await pickFiles('image/*',false,'Pictures',['png','jpg','jpeg','webp','tga','bmp','tif','tiff']);if(fs&&fs.length){gslotClose();fxdDropFiles(fs,done);}}})),grid,more);
  const draw=items=>{txForget(grid);const t=q.value.trim().toLowerCase(),list=items.filter(it=>!t||it.name.toLowerCase().includes(t));
    grid.replaceChildren(...list.map(it=>{const img=el('img',{alt:'',width:64,height:64,draggable:'false'});img._tx=it;txObserve(img);
      return el('button',{type:'button',class:'gpop-tile',title:it.name,onclick:()=>{gslotClose();done({kind:it.kind,id:it.id,name:it.name});}},img,el('span',{text:it.name}));}));
    more.hidden=list.length>0;more.textContent='No grunge matches.';};
  document.body.append(pop);
  const place=()=>{const r=anchor.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;let x=r.left-w-8;if(x<8)x=Math.min(window.innerWidth-w-8,r.right+8);const y=Math.max(8,Math.min(window.innerHeight-h-8,r.top-20));pop.style.left=x+'px';pop.style.top=y+'px';};
  txLoad().then(()=>{const items=fxdAllTex();draw(items);q.oninput=()=>draw(items);place();q.focus();});place();
  const out=e=>{if(!pop.contains(e.target)&&!anchor.contains(e.target))gslotClose();},key=e=>{if(e.key==='Escape'){e.stopPropagation();gslotClose();}};
  document.addEventListener('pointerdown',out,true);document.addEventListener('keydown',key,true);gslotPop={el:pop,out,key};}
/* the slot itself.
   o: id (prefix for the element ids), title, ref ({kind,id,name} or null), set(ref|null), tri:{on,set} and inv:{on,set} (both optional), empty (what "nothing chosen" means) */
function grungeSlot(o){const g=o.ref,box=el('div',{class:'gslot',id:o.id});
  const pic=el('button',{type:'button',class:'fxddrop gslot-pic'+(g?' has':''),id:o.id+'Drop',title:(g?g.name+' · ':'')+'Drop a grunge here, or click to choose one'},
    g?'':el('span',{class:'gslot-ph',text:'Drop a grunge'}));
  const name=el('div',{class:'gslot-name',text:g?g.name:(o.empty||'Built-in clouds')});name._hpv=()=>g?{tex:g,name:g.name}:null;pic._hpv=name._hpv;
  if(g){const img=el('img',{alt:'',width:72,height:72,draggable:'false'});txLoad().then(()=>{const it=fxdAllTex().find(x=>x.kind===g.kind&&x.id===g.id);if(it&&img.isConnected){img._tx=it;txObserve(img);}});pic.append(img);}
  pic._texDrop=o.set;
  pic.addEventListener('dragover',e=>{e.preventDefault();pic.classList.add('over');});pic.addEventListener('dragleave',()=>pic.classList.remove('over'));
  pic.addEventListener('drop',e=>{e.preventDefault();pic.classList.remove('over');const t0=e.dataTransfer.getData('text/gouache-texture');if(t0){try{o.set(JSON.parse(t0));return;}catch(er){}}fxdDropFiles(e.dataTransfer.files,o.set);});
  const open=()=>gslotGallery(pic,o.set);pic.addEventListener('click',open);
  const side=el('div',{class:'gslot-side'},el('div',{class:'gslot-title',text:o.title}),name,
    el('div',{class:'gslot-btns'},el('button',{type:'button',class:'btn sm',id:o.id+'Pick',text:'Choose…',title:'Open the gallery of grunges',onclick:open}),
      g?el('button',{type:'button',class:'btn sm',id:o.id+'Clear',text:'Clear',title:'Back to '+(o.empty||'the built-in clouds'),onclick:()=>o.set(null)}):''));
  const tick=(id,label,c)=>{const l=el('label',{class:'gslot-chk'},el('input',{type:'checkbox',id,checked:!!c.on,onchange:e=>c.set(e.target.checked)}),el('span',{text:label}));return l;};
  if(o.tri)side.append(tick(o.id+'_tri','Tri-planar',o.tri));
  if(g&&o.inv)side.append(tick(o.id+'_inv','Invert',o.inv));
  box.append(pic,side);return box;}
