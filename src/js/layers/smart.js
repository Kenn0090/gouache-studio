/* ================= Smart materials and smart masks (0.24) =================
   Like Substance Painter's: a smart material is a folder of layers (material layers with their mask rows,
   effects, styles and pictures) saved to the Materials tab; a click adds the whole folder, still live, so its
   generators fit whatever model it lands on. A smart mask is a mask's rows on their own, dropped onto any layer.
   Saved ones live with the materials (the browser's storage) and export as .gmat files. The built-ins are made
   of materials and generators, plus (0.34) some that fetch library materials and grunge pictures when added. */
/* ---- a layer or folder → a plain description (pictures copied as 8-bit images) ---- */
function smCap(t){if(!t||t.empty)return null;let s=t,tmp=null;if(t.depth!==8){tmp=makeTarget(t.w,t.h,8,false);copyScaled(t,tmp);s=tmp;}const c=captureRegionNow(s,0,0,s.w,s.h);if(tmp)disposeTarget(tmp);return {w:c.w,h:c.h,data:c.data};}
const smClone=o=>JSON.parse(JSON.stringify(o,(k,x)=>k==='t'||k[0]==='_'?undefined:x));
function smSer(n){const o={t:n.type==='group'?'G':'L',name:n.name,mode:n.mode,op:n.opacity,vis:n.visible!==false,clip:!!n.clip,mapModes:Object.assign({},n.mapModes||{})};
  if(n.type==='group'){o.open=n.open!==false;o.kids=n.children.map(smSer);}
  else{if(n.fill){o.fill=fillClone(n.fill);o.fillImg={};for(const k in n._fillImg||{})o.fillImg[k]=smCap(n._fillImg[k]);}
    else{o.maps={};for(const k of mapKeysOf(n)){const c=smCap(mapT(n,k));if(c)o.maps[k]=c;}}
    if(n.styles)o.styles=smClone(n.styles);if(n.cfx&&n.cfx.length)o.cfx=smClone(n.cfx);}
  if(n.mask)o.mask=smSerMask(n.mask);return o;}
function smSerMask(m){if(m.stack)return {en:m.enabled!==false,rows:m.stack.map(r=>Object.assign(smClone(r),r.t?{img:smCap(r.t)}:{}))};return {en:m.enabled!==false,img:smCap(m.target)};}
/* ---- a description → layers (pictures stretched to this document's size) ---- */
function smImg(im){if(!im)return null;const t=makeTarget(im.w,im.h,8,false);writeRegion(t,0,0,im.w,im.h,im.data);return t;}
function smFit(im,depth){const s=smImg(im);if(!s)return null;const d=makeTarget(doc.w,doc.h,depth||8,false);if(s.w===doc.w&&s.h===doc.h)copyScaled(s,d);else run(P.resample,d,{uSrc:s.tex,uOffset:[0,0],uScale:[s.w/doc.w,s.h/doc.h],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(s.w/doc.w)))},uOutside:[0,0,0,0]});disposeTarget(s);return d;}
function smBuildMask(o){const m=makeMask(o.rows?0:1);m.enabled=o.en!==false;
  if(o.rows){m.stack=[];m._rows=new Set();for(const d of o.rows){const r=Object.assign(msRow(d.kind),smClone(d),{id:'r'+(++msSeq)});delete r.img;
      if(d.img){r.t=d.kind==='image'?smImg(d.img):smFit(d.img,m.target.depth);if(r.t&&d.kind==='image')setWrap(r.t,true);}else if(d.kind==='paint'){r.t=makeTarget(doc.w,doc.h,m.target.depth);clearTarget(r.t,[0,0,0,0]);}
      m.stack.push(r);m._rows.add(r);}m._key=null;}
  else if(o.img){const t=smFit(o.img,m.target.depth);if(t){copyScaled(t,m.target);disposeTarget(t);}}
  return m;}
function smBuild(o){let n;
  if(o.t==='G'){n=newGroupObj(o.name);n.open=o.open!==false;for(const k of o.kids||[]){const c=smBuild(k);insertNode(c,n);}}
  else{n=newLayerObj(o.name);doc.count--;
    if(o.fill){n.fill=Object.assign(fillDefaults(),fillClone(o.fill));const D=fillDefaults().maps;for(const k in D)n.fill.maps[k]=Object.assign({},D[k],o.fill.maps&&o.fill.maps[k]||{on:false});
      if(o.fillImg&&Object.keys(o.fillImg).length){n._fillImg={};for(const k in o.fillImg){const t=smImg(o.fillImg[k]);if(t){setWrap(t,true);n._fillImg[k]=t;}}}fillRender(n);}
    else for(const k in o.maps||{}){if(!doc.maps.includes(k)&&k!=='base')continue;const t=smFit(o.maps[k],mapDepth(k));if(t){copyScaled(t,ensureMapTarget(n,k));disposeTarget(t);}}
    if(o.styles)n.styles=smClone(o.styles);if(o.cfx)n.cfx=o.cfx.map(r=>Object.assign(msRow('filter'),smClone(r),{id:'r'+(++msSeq)}));}
  Object.assign(n,{visible:o.vis!==false,opacity:o.op==null?1:o.op,mode:o.mode==null?(o.t==='G'?-1:0):o.mode,clip:!!o.clip,mapModes:Object.assign({},o.mapModes||{})});
  if(o.mask)n.mask=smBuildMask(o.mask);return n;}
/* the maps a description needs (added to the document if missing) */
function smMapsOf(o,out){out=out||new Set();if(o.fill)for(const k in o.fill.maps||{})if(o.fill.maps[k].on!==false)out.add(k);for(const k in o.maps||{})out.add(k);for(const c of o.kids||[])smMapsOf(c,out);return out;}
/* Materials tab › a smart material: the folder goes above the active layer (a selection becomes its mask) */
function smApplyNow(rec){if(ui.mode==='anim'){toast('Smart materials are for Paint and 3D Paint.');return;}if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const need=[...smMapsOf(rec.tree)].filter(k=>MAP_DEFS[k]&&!doc.maps.includes(k)&&!FILL_SKIP.includes(k)&&!(doc.workflow==='spec'&&(k==='rough'||k==='metal')));
  if(need.length)setDocMaps([...doc.maps,...need],'Add maps for the smart material');
  const n=smBuild(rec.tree);n.name=rec.name;if(!rec.builtin)n.smSrc=rec.id;const fromSel=sel.active&&!sel.quick&&!n.mask;
  if(fromSel){n.mask=makeMask(0);run(P.loadsel,n.mask.target,{uSrc:sel.t.tex,uWhat:{int:1},uInv:false});}
  /* above the selected layer or folder (not inside a folder that happens to be selected) */
  const A=doc.active,P=insertAt?insertAt.parent:A&&A.parent?A.parent:doc.root,I=insertAt?insertAt.index:A&&A.parent?P.children.indexOf(A)+1:P.children.length;
  structOp('Add smart material',()=>{insertNode(n,P,I);selectOnly(n);});msEpoch++;changedAll();
  toast('Added the smart material “'+rec.name+'”'+(fromSel?' in the selection.':'. Its rows stay live: change them under each layer.'));return n;}
/* built-ins that use library materials or grunge pictures fetch them first (a moment on the first use) */
function smApply(rec){if(!smNeeds(rec.tree))return smApplyNow(rec);
  const at=insertAt;toast('Loading “'+rec.name+'”…');
  return (async()=>{const t=JSON.parse(JSON.stringify(rec.tree));try{await smResolveNode(t);}catch(e){toast('Could not load “'+rec.name+'”: '+(e.message||e));return null;}
    insertAt=at;try{return smApplyNow(Object.assign({},rec,{tree:t}));}finally{insertAt=null;}})();}
/* Materials tab › a smart mask: it becomes the active layer's mask */
function smMaskApply(rec){if(!(rec.mask.rows||[]).some(r=>r.p&&r.p.grunge&&!r.img))return smMaskApplyNow(rec);
  const L=doc.active;if(!L||L.fx||ui.mode==='anim'){toast('Select a layer first.');return;}
  toast('Loading “'+rec.name+'”…');return (async()=>{const m=JSON.parse(JSON.stringify(rec.mask));try{await smResolveMask(m);}catch(e){toast('Could not load “'+rec.name+'”: '+(e.message||e));return;}
    if(doc.active!==L)return;smMaskApplyNow(Object.assign({},rec,{mask:m}));})();}
function smMaskApplyNow(rec){const L=doc.active;if(!L||L.fx||ui.mode==='anim'){toast('Select a layer first.');return;}
  msRecord(L,'Smart mask “'+rec.name+'”',()=>{const m=smBuildMask(rec.mask);if(L.mask){m.enabled=L.mask.enabled;}L.mask=m;L.editMask=true;L.smMaskSrc=rec.builtin?undefined:rec.id;});msEpoch++;toast('“'+L.name+'” has the smart mask “'+rec.name+'”.');}

/* ---- saving ---- */
function smThumb(){/* what the 3D view shows (or the base colour of the painting), small */
  try{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
    if(v3.on&&v3.fbo){const F=v3.fbo,s=Math.min(F.w,F.h),d=new Uint8Array(s*s*4);gl.bindFramebuffer(gl.FRAMEBUFFER,F.rf);gl.readPixels((F.w-s)>>1,(F.h-s)>>1,s,s,gl.RGBA,gl.UNSIGNED_BYTE,d);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      const t=document.createElement('canvas');t.width=t.height=s;const id=t.getContext('2d').createImageData(s,s);for(let y=0;y<s;y++)id.data.set(d.subarray((s-1-y)*s*4,(s-y)*s*4),y*s*4);t.getContext('2d').putImageData(id,0,0);x.drawImage(t,0,0,64,64);}
    else{const t=compositeMap('base'),im=captureRegionNow(t,0,0,doc.w,doc.h);release(t);const s=document.createElement('canvas');s.width=doc.w;s.height=doc.h;const id=s.getContext('2d').createImageData(doc.w,doc.h);
      for(let i=0;i<im.data.length;i+=4){const a=im.data[i+3]||1;id.data[i]=im.data[i]*255/a;id.data[i+1]=im.data[i+1]*255/a;id.data[i+2]=im.data[i+2]*255/a;id.data[i+3]=255;}s.getContext('2d').putImageData(id,0,0);x.drawImage(s,0,0,64,64);}
    return c.toDataURL('image/png');}catch(e){return null;}}
function smAskName(title,def,fn){const inp=el('input',{type:'text',id:'smName',value:def,'aria-label':'Name'});
  openDialog({title,body:el('div',{class:'dlg-grid'},inp),okLabel:'Save',onOk(){const n=inp.value.trim();if(!n)return false;fn(n);}});setTimeout(()=>{inp.focus();inp.select();},0);}
function smSave(n){if(!n)return;smAskName('Save as smart material',n.name,name=>{const tree=n.type==='group'?smSer(n):{t:'G',name,open:true,kids:[smSer(n)]};
  const r=smPut({kind:'smart',name,tree,thumb:smThumb()});n.smSrc=r.id;toast('Saved “'+name+'” in Materials › Smart materials.');});}
function smMaskSave(n){if(!n||!n.mask)return;smAskName('Save as smart mask',n.name+' mask',name=>{const r=smPut({kind:'smask',name,mask:smSerMask(n.mask)});n.smMaskSrc=r.id;toast('Saved “'+name+'” in Materials › Smart masks.');});}
/* (0.35, Kenn) right-click a folder that came from a saved smart material (or a layer whose mask came from a saved smart mask): put the changes back into the library */
function smOrigin(n,kind){if(!n)return null;const id=kind==='smask'?n.smMaskSrc:n.smSrc,nm=kind==='smask'?null:n.name;
  return matLib.list.find(r=>r.kind===kind&&!r.builtin&&(r.id===id||(!id&&nm&&r.name===nm)))||null;}
function smUpdate(n){const rec=smOrigin(n,'smart');if(!rec){toast('This folder is not from a saved smart material. Use Save as smart material.');return;}
  confirmDlg('Update smart material','Replace the saved smart material “'+rec.name+'” with this folder as it is now?','Update',()=>{
    const tree=n.type==='group'?smSer(n):{t:'G',name:rec.name,open:true,kids:[smSer(n)]};tree.name=rec.name;
    smPut({kind:'smart',name:rec.name,tree,thumb:smThumb()});n.smSrc=rec.id;toast('Updated “'+rec.name+'” in Materials › Smart materials.');});}
function smMaskUpdate(n){const rec=smOrigin(n,'smask');if(!rec||!n.mask){toast('This mask is not from a saved smart mask. Use Save mask as smart mask.');return;}
  confirmDlg('Update smart mask','Replace the saved smart mask “'+rec.name+'” with this mask as it is now?','Update',()=>{
    smPut({kind:'smask',name:rec.name,mask:smSerMask(n.mask)});n.smMaskSrc=rec.id;toast('Updated “'+rec.name+'” in Materials › Smart masks.');});}
function smPut(o){const old=matLib.list.find(r=>r.kind===o.kind&&r.name===o.name),rec=Object.assign({id:old?old.id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),t:old?old.t:Date.now()},o);
  if(old)matLib.list[matLib.list.indexOf(old)]=rec;else matLib.list.push(rec);store.put(rec,'materials');renderMats();return rec;}

/* ---- the built-ins: materials and generators only ---- */
const SM_F=(name,maps,o)=>Object.assign({t:'L',name,fill:{maps:Object.fromEntries(Object.entries(maps).map(([k,v])=>[k,Object.assign({on:true,src:'value'},v)])),proj:'uv',triSharp:4,hStr:1}},o||{});
const SM_M=(...rows)=>({en:true,rows:rows.map(([kind,p,mode,op])=>({kind,on:true,mode:mode||'normal',op:op==null?1:op,p:Object.assign(MS_KINDS[kind].p?MS_KINDS[kind].p():{},p||{})}))});
const SM_GEN=(g,amount,width,breakup,extra)=>['gen',Object.assign({g,amount,width,breakup,contrast:1.5,scale:6,seed:3,inv:false},extra||{})];
const SM_NOISE=(type,scale,contrast,level,mode,op,extra)=>['noise',Object.assign({type,scale,contrast,level,seed:5,inv:false},extra||{}),mode,op];
const SM_FILL=v=>['fill',{v}];
const SM_BUILTIN=[
  ['Gun Metal',[SM_F('Gun metal',{base:{c:[.26,.27,.29]},rough:{v:.4},metal:{v:1}}),
    SM_F('Worn edges',{base:{c:[.62,.63,.64]},rough:{v:.22},metal:{v:1}},{mask:SM_M(SM_GEN('edge',.5,.45,.55),SM_NOISE('grunge',8,2,.1,'multiply',.7))}),
    SM_F('Grime',{base:{c:[.12,.11,.1]},rough:{v:.85},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.45,.5,.5)),op:.8})]],
  ['Steel',[SM_F('Steel',{base:{c:[.56,.57,.58]},rough:{v:.32},metal:{v:1}}),
    SM_F('Polished edges',{rough:{v:.15}},{mask:SM_M(SM_GEN('edge',.45,.4,.4))}),
    SM_F('Rough patches',{rough:{v:.55}},{mask:SM_M(SM_NOISE('clouds',3,2.5,-.1)),op:.6})]],
  ['Moss',[SM_F('Stone',{base:{c:[.47,.46,.43]},rough:{v:.82},metal:{v:0},height:{v:.5}}),
    SM_F('Stone grain',{height:{v:.62}},{mask:SM_M(SM_NOISE('grunge',10,2,0))}),
    SM_F('Moss',{base:{c:[.24,.38,.1]},rough:{v:.95},metal:{v:0},height:{v:.6}},{mask:SM_M(SM_GEN('moss',.5,.6,.6))})]],
  ['Dirt',[SM_F('Dirt',{base:{c:[.28,.21,.14]},rough:{v:.95},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.5,.6,.55),SM_NOISE('grunge',7,2,.15,'multiply',.8))})]],
  ['Dust',[SM_F('Dust',{base:{c:[.68,.64,.56]},rough:{v:.92},metal:{v:0}},{mask:SM_M(SM_GEN('dust',.5,.5,.5),SM_NOISE('clouds',6,1.5,.1,'multiply',.7))})]],
  ['Imperfections',[SM_F('Rough smudges',{rough:{v:.7}},{mask:SM_M(SM_NOISE('clouds',4,2,-.15)),op:.5}),
    SM_F('Fine scratches',{rough:{v:.2}},{mask:SM_M(SM_NOISE('scratches',3,2,0)),op:.7}),
    SM_F('Fingerprints',{rough:{v:.55}},{mask:SM_M(SM_NOISE('cells',12,2,-.2)),op:.35})]],
  ['Skin',[SM_F('Skin',{base:{c:[.82,.58,.47]},rough:{v:.52},metal:{v:0},height:{v:.5}}),
    SM_F('Redness',{base:{c:[.78,.4,.36]}},{mask:SM_M(SM_GEN('dirt',.45,.55,.6)),op:.55}),
    SM_F('Pores',{height:{v:.42},rough:{v:.6}},{mask:SM_M(SM_NOISE('dots',40,2,-.1)),op:.8}),
    SM_F('Blotches',{base:{c:[.72,.5,.42]}},{mask:SM_M(SM_NOISE('clouds',5,2,-.1)),op:.4})]],
  ['Wood',[SM_F('Wood',{base:{c:[.5,.32,.17]},rough:{v:.62},metal:{v:0},height:{v:.5}}),
    SM_F('Grain',{base:{c:[.34,.2,.1]},height:{v:.44}},{mask:SM_M(SM_NOISE('fibres',4,2.5,0)),op:.85}),
    SM_F('Varnish wear',{rough:{v:.85}},{mask:SM_M(SM_GEN('edge',.45,.5,.6))})]],
  ['Leather',[SM_F('Leather',{base:{c:[.36,.2,.12]},rough:{v:.6},metal:{v:0},height:{v:.5}}),
    SM_F('Grain',{height:{v:.44},rough:{v:.7}},{mask:SM_M(SM_NOISE('cells',30,2,0)),op:.8}),
    SM_F('Worn edges',{base:{c:[.52,.34,.22]},rough:{v:.45}},{mask:SM_M(SM_GEN('edge',.5,.5,.6))})]]];

/* ---- (0.34) richer built-ins made from the library materials and the photo grunge maps. A layer with `lib` takes
   its whole material from the bundled Library and a mask row with p.grunge takes its picture from the grunge maps;
   both are fetched when the smart material is added (smResolveNode), so the tile itself stays light. ---- */
const SM_L=(name,slug,c,o)=>Object.assign({t:'L',name,lib:slug,fill:{maps:{base:{on:true,src:'value',c}},proj:'uv',triSharp:4,hStr:1}},o||{});
const SM_IMG=(id,tile,inv,mode,op)=>['image',{grunge:id,name:id,tile:tile||1,inv:!!inv},mode,op];
const SM_LIB=[
  ['Worn Steel',[SM_L('Worn steel','worn-steel',[.42,.43,.44]),
    SM_L('Polished edges','polished-steel',[.72,.73,.74],{mask:SM_M(SM_GEN('edge',.5,.45,.55),SM_IMG('light-scratches',2,false,'multiply',.9))}),
    SM_L('Rust','rusty-steel',[.36,.2,.1],{mask:SM_M(SM_GEN('dirt',.4,.5,.5),SM_IMG('rust-pits-2',2,false,'multiply',.9))}),
    SM_F('Grime',{base:{c:[.1,.09,.08]},rough:{v:.9},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.4,.5,.5),SM_IMG('grime',1,false,'multiply',.8)),op:.7})]],
  ['Rusty Painted Metal',[SM_L('Painted metal','red-painted-metal',[.5,.1,.08]),
    SM_L('Chipped through','scratched-rusty-iron',[.35,.2,.12],{mask:SM_M(SM_GEN('chips',.5,.5,.5),SM_IMG('worn-paint-1',1,false,'multiply',1))}),
    SM_F('Rust streaks',{base:{c:[.3,.15,.07]},rough:{v:.85},metal:{v:0}},{mask:SM_M(SM_IMG('leaks-3',1,false,'normal',1),SM_GEN('dirt',.5,.5,.5)),op:.75})]],
  ['Chipped Yellow Paint',[SM_L('Yellow paint','scratched-yellow-paint',[.75,.6,.1]),
    SM_L('Bare metal','damaged-iron',[.4,.4,.4],{mask:SM_M(SM_GEN('chips',.55,.5,.5),SM_IMG('worn-paint-2',1,false,'multiply',1))}),
    SM_F('Dirt',{base:{c:[.15,.12,.09]},rough:{v:.9},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.45,.5,.5),SM_IMG('stains',1,false,'multiply',.9)),op:.6})]],
  ['Aged Bronze',[SM_L('Bronze','bronze',[.55,.35,.15]),
    SM_L('Polished high points','brass',[.8,.6,.25],{mask:SM_M(SM_GEN('edge',.5,.45,.5),SM_IMG('micro-scratches',2,false,'multiply',.8))}),
    SM_L('Verdigris','oxidised-copper',[.2,.5,.42],{mask:SM_M(SM_GEN('dirt',.5,.55,.5),SM_IMG('stains',1,false,'multiply',.9))})]],
  ['Copper Patina',[SM_L('Copper','copper',[.7,.35,.2]),
    SM_L('Patina','oxidised-copper',[.2,.5,.42],{mask:SM_M(SM_GEN('dirt',.5,.6,.55),SM_IMG('rings',1,false,'multiply',.9))}),
    SM_L('Worn shine','polished-nickel',[.75,.75,.78],{mask:SM_M(SM_GEN('edge',.4,.4,.5)),op:.5})]],
  ['Battle Leather',[SM_L('Leather','worn-brown-leather',[.36,.22,.13]),
    SM_L('Scuffed edges','scuffed-leather',[.5,.35,.24],{mask:SM_M(SM_GEN('edge',.5,.5,.6),SM_IMG('brush-smears',1,false,'multiply',.9))}),
    SM_F('Dirt',{base:{c:[.16,.12,.08]},rough:{v:.9},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.5,.55,.5),SM_IMG('grime',1,false,'multiply',.9)),op:.7}),
    SM_F('Cracks',{base:{c:[.08,.05,.03]},rough:{v:.8},metal:{v:0}},{mask:SM_M(SM_IMG('cracks-1',1,false,'normal',1)),op:.6})]],
  ['Old Black Leather',[SM_L('Leather','smooth-black-leather',[.09,.09,.1]),
    SM_L('Worn through','scratched-old-leather',[.3,.24,.2],{mask:SM_M(SM_GEN('edge',.45,.4,.55),SM_IMG('brushed-scratches',1,false,'multiply',.8))}),
    SM_F('Dust',{base:{c:[.55,.5,.44]},rough:{v:.95},metal:{v:0}},{mask:SM_M(SM_GEN('dust',.5,.5,.5),SM_IMG('dust',1,false,'multiply',.8)),op:.5})]],
  ['Dirty Canvas',[SM_L('Canvas','canvas',[.6,.55,.45]),
    SM_F('Dirt',{base:{c:[.2,.16,.11]},rough:{v:.95},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.5,.55,.5),SM_IMG('grime',1,false,'multiply',.9)),op:.8}),
    SM_F('Stains',{base:{c:[.3,.22,.12]},rough:{v:.9},metal:{v:0}},{mask:SM_M(SM_IMG('stains',1,false,'normal',1)),op:.5})]],
  ['Worn Khaki Cloth',[SM_L('Cloth','khaki-cloth',[.4,.38,.25]),
    SM_L('Frayed edges','rough-cloth',[.55,.52,.4],{mask:SM_M(SM_GEN('edge',.5,.5,.6),SM_IMG('speckle',1,false,'multiply',.8))}),
    SM_F('Mud',{base:{c:[.17,.12,.08]},rough:{v:.95},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.45,.6,.5),SM_IMG('spatter',1,false,'multiply',.9)),op:.75})]],
  ['Weathered Wood',[SM_L('Wood','old-dark-wood',[.28,.18,.1]),
    SM_L('Bare wood edges','pale-wood',[.6,.45,.28],{mask:SM_M(SM_GEN('edge',.5,.5,.6),SM_IMG('fine-brushed-lines',2,false,'multiply',.7))}),
    SM_F('Grime',{base:{c:[.1,.08,.06]},rough:{v:.9},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.45,.55,.5),SM_IMG('dirt',1,false,'multiply',.9)),op:.6})]],
  ['Old Planks',[SM_L('Planks','old-planks',[.35,.27,.19]),
    SM_F('Water stains',{base:{c:[.16,.13,.1]},rough:{v:.9},metal:{v:0}},{mask:SM_M(SM_IMG('leaks-2',1,false,'normal',1),SM_GEN('dirt',.5,.5,.5)),op:.65}),
    SM_L('Mossy patches','thick-moss',[.2,.35,.1],{mask:SM_M(SM_GEN('moss',.4,.6,.6),SM_IMG('splotches',1,false,'multiply',.9))})]],
  ['Cracked Stone',[SM_L('Stone','rough-stone',[.42,.4,.37]),
    SM_F('Dark cracks',{base:{c:[.05,.05,.05]},rough:{v:1},metal:{v:0},height:{v:.2}},{mask:SM_M(SM_IMG('cracks-2',1,false,'normal',1)),op:.9}),
    SM_L('Moss','thick-moss',[.2,.35,.1],{mask:SM_M(SM_GEN('moss',.5,.6,.6),SM_IMG('splotches',1,false,'multiply',.9))})]],
  ['Snowy Rock',[SM_L('Rock','black-rock',[.12,.12,.13]),
    SM_L('Snow','fresh-snow',[.92,.94,.98],{mask:SM_M(SM_GEN('dust',.55,.55,.5),SM_IMG('spatter',1,false,'multiply',.9))})]],
  ['Muddy Ground',[SM_L('Dry mud','dry-mud',[.35,.27,.19]),
    SM_L('Wet clay','wet-clay',[.28,.2,.14],{mask:SM_M(SM_NOISE('clouds',4,2.5,-.05),SM_IMG('splotches',1,false,'multiply',.9))}),
    SM_L('Forest mud','forest-mud',[.15,.11,.08],{mask:SM_M(SM_GEN('dirt',.5,.6,.5)),op:.7})]],
  ['Stained Concrete',[SM_L('Concrete','cast-concrete',[.5,.5,.48]),
    SM_F('Stains',{base:{c:[.2,.2,.19]},rough:{v:.95},metal:{v:0}},{mask:SM_M(SM_IMG('stains',1,false,'normal',1),SM_IMG('drips',1,false,'multiply',.8)),op:.7}),
    SM_F('Cracks',{base:{c:[.08,.08,.08]},rough:{v:1},metal:{v:0},height:{v:.25}},{mask:SM_M(SM_IMG('cracks-3',1,false,'normal',1)),op:.85})]],
  ['Scuffed Plastic',[SM_L('Plastic','white-plastic',[.85,.85,.82]),
    SM_L('Scuffs','scuffed-plastic',[.6,.6,.58],{mask:SM_M(SM_GEN('edge',.5,.5,.55),SM_IMG('light-scratches',2,false,'multiply',.9))}),
    SM_F('Fingerprints',{rough:{v:.55}},{mask:SM_M(SM_IMG('fingerprints',1,false,'normal',1)),op:.5})]],
  ['Cracked Porcelain',[SM_L('Porcelain','white-porcelain',[.9,.9,.88]),
    SM_F('Crazing',{base:{c:[.35,.3,.22]},rough:{v:.6},metal:{v:0}},{mask:SM_M(SM_IMG('crazed-cracks',1,false,'normal',1)),op:.7}),
    SM_F('Tea stains',{base:{c:[.5,.38,.22]},rough:{v:.5},metal:{v:0}},{mask:SM_M(SM_IMG('stains',1,false,'normal',1),SM_GEN('dirt',.5,.5,.5)),op:.4})]],
  ['Worn Carbon',[SM_L('Carbon','carbon-weave',[.06,.06,.07]),
    SM_L('Scratches','scratched-black-plastic',[.15,.15,.16],{mask:SM_M(SM_IMG('tangled-scratches',1,false,'multiply',1),SM_GEN('edge',.5,.5,.5)),op:.9})]],
  ['Molten Rock',[SM_L('Rock','black-rock',[.1,.1,.11]),
    SM_L('Lava','lava',[.9,.35,.05],{mask:SM_M(SM_IMG('cracks-1',1,false,'normal',1))})]]];
/* Original procedural textile presets: no external or paid texture packs are required. */
const SM_DENIM=[
  ['Indigo Denim',[.055,.12,.28],28],['Faded Denim',[.27,.34,.43],22],['Black Denim',[.035,.045,.07],34],
  ['Stonewashed Denim',[.31,.36,.42],18],['Teal Denim',[.035,.22,.25],25]
].map(([name,c,s],i)=>[name,[
  SM_F(name,{base:{c},rough:{v:.88},metal:{v:0},height:{v:.47}}),
  SM_F('Twill weave',{base:{c:c.map(v=>Math.min(1,v*1.16+.035))},rough:{v:.82},height:{v:.56}},
    {mask:SM_M(SM_NOISE('fibres',s,2.1,-.05,'normal',.72,{seed:17+i,tri:true}))}),
  SM_F('Thread wear',{base:{c:c.map(v=>Math.min(1,v*1.48+.12))},rough:{v:.94},height:{v:.51}},
    {mask:SM_M(SM_GEN('edge',.32,.44,.7,{seed:31+i}),SM_NOISE('scratches',s*.7,2.3,.12,'multiply',.55,{seed:41+i})),op:.45})
]]);
const SM_CLOTH_WRINKLES=Array.from({length:10},(_,i)=>{
  const scale=5+i*2.25,amount=.3+i*.045,rough=.76+(i%4)*.045;
  const base=SM_F('Cloth base',{base:{c:[.48,.43,.36]},rough:{v:rough},metal:{v:0},height:{v:.5}});
  const folds=SM_F('Fold relief',{height:{v:.5+amount*.22},rough:{v:Math.min(.98,rough+.08)}},
    {mask:SM_M(SM_NOISE(i%2?'streaks':'fibres',scale,1.45+(i%3)*.25,-.08,'normal',.45+amount*.35,{seed:51+i,tri:true}))});
  const wear=SM_F('Soft fold wear',{base:{c:[.56,.51,.44]},rough:{v:.9}},
    {mask:SM_M(SM_NOISE('clouds',scale*.58,1.8,-.1,'multiply',.38,{seed:71+i,tri:true})),op:.35});
  return [`Cloth folds ${String(i+1).padStart(2,'0')}`,[base,folds,wear]];
});
SM_LIB.push(...SM_DENIM,...SM_CLOTH_WRINKLES);
/* fetch what a description points at: library materials and grunge pictures */
function smNeeds(o){if(o.lib)return true;for(const r of (o.mask&&o.mask.rows)||[])if(r.p&&r.p.grunge&&!r.img)return true;for(const c of o.kids||[])if(smNeeds(c))return true;return false;}
async function smResolveMask(m){for(const r of m.rows||[]){const g=r.p&&r.p.grunge;if(g&&!r.img){const it=txItems().find(x=>x.kind==='photo'&&x.id===g);if(it){r.img=smCap(await txTarget(it));r.p.name=it.name;}}}}
async function smResolveNode(o){
  if(o.lib){const rec=gmRecs.find(r=>r.bundled&&r.bundled.file===o.lib+'.gmat');
    if(rec){if(!(rec.fill&&rec.imgs))await gmLoad(rec);o.fill=fillClone(rec.fill);
      if(o.libAdjust){const a=fillClone(o.libAdjust),tile=a.tile;delete a.tile;const maps=a.maps;delete a.maps;Object.assign(o.fill,a);if(tile!=null)for(const k in o.fill.maps)o.fill.maps[k].tile=tile;if(maps)for(const k in maps)o.fill.maps[k]=Object.assign({},o.fill.maps[k]||{},maps[k]);}
      o.fillImg={};const T=matRecTargets(rec);for(const k in T){const c=smCap(T[k]);if(c)o.fillImg[k]=c;}}}
  if(o.mask)await smResolveMask(o.mask);
  for(const c of o.kids||[])await smResolveNode(c);}
function smBuiltins(){return SM_BUILTIN.concat(SM_LIB).map(([name,kids])=>({id:'sb:'+name,kind:'smart',builtin:true,name,tree:{t:'G',name,open:true,kids:kids.slice()}}));}
const SMASK_BUILTIN=[['Worn edges',SM_M(SM_GEN('edge',.5,.5,.55),SM_NOISE('grunge',8,2,.1,'multiply',.7))],['Dirty cavities',SM_M(SM_GEN('dirt',.5,.55,.5),SM_NOISE('clouds',6,1.5,.1,'multiply',.7))],
  ['Dusty top',SM_M(SM_GEN('dust',.5,.5,.5),SM_NOISE('clouds',5,1.5,.1,'multiply',.7))],['Scratched',SM_M(SM_NOISE('scratches',3,2,0))],['Chipped paint',SM_M(SM_GEN('chips',.5,.5,.5))]];
const SMASK_LIB=[
  ['Chunky paint wear',SM_M(SM_GEN('chips',.46,.54,.62,{seed:81}),SM_NOISE('cells',8,2.2,-.06,'multiply',.68,{seed:83,tri:true}))],
  ['Poster pigment breakup',SM_M(SM_NOISE('clouds',4.5,1.75,-.13,'normal',.72,{seed:85,tri:true}),SM_NOISE('dots',18,1.6,.08,'multiply',.4,{seed:87,tri:true}))],
  ['Stylized edge chips',SM_M(SM_GEN('edge',.48,.38,.68,{seed:89}),SM_NOISE('grunge',9,2.1,.03,'multiply',.62,{seed:91,tri:true}))],
  ['Denim abrasion',SM_M(SM_GEN('edge',.4,.32,.7,{seed:93}),SM_NOISE('scratches',24,2.4,-.04,'multiply',.84,{seed:95,tri:true}))],
  ['Cloth crease breakup',SM_M(SM_NOISE('fibres',12,1.65,-.1,'normal',.7,{seed:97,tri:true}),SM_NOISE('streaks',7,1.4,.02,'multiply',.46,{seed:99,tri:true}))],
  ['Scratched edges',SM_M(SM_GEN('edge',.5,.45,.55),SM_IMG('light-scratches',2,false,'multiply',.9))],
  ['Scuffed edges',SM_M(SM_GEN('edge',.5,.5,.6),SM_IMG('brush-smears',1,false,'multiply',.9))],
  ['Rust streaks',SM_M(SM_IMG('leaks-3',1,false,'normal',1),SM_GEN('dirt',.5,.5,.5))],
  ['Rust pits',SM_M(SM_IMG('rust-pits-2',2,false,'normal',1),SM_GEN('dirt',.4,.5,.5))],
  ['Heavy grime',SM_M(SM_GEN('dirt',.55,.6,.5),SM_IMG('grime',1,false,'multiply',.9))],
  ['Paint chips',SM_M(SM_GEN('chips',.5,.5,.5),SM_IMG('worn-paint-1',1,false,'multiply',1))],
  ['Cracks',SM_M(SM_IMG('cracks-1',1,false,'normal',1))],
  ['Water stains',SM_M(SM_IMG('stains',1,false,'normal',1),SM_IMG('drips',1,false,'multiply',.8))],
  ['Settled dust',SM_M(SM_GEN('dust',.5,.5,.5),SM_IMG('dust',1,false,'multiply',.85))],
  ['Frost',SM_M(SM_GEN('dust',.5,.5,.5),SM_IMG('frost-veins',1,false,'multiply',1))],
  ['Fingerprints',SM_M(SM_IMG('fingerprints',1,false,'normal',1))],
  ['Dripping grime',SM_M(SM_IMG('runs-2',1,false,'normal',1),SM_GEN('dirt',.5,.5,.5))]];
function smaskBuiltins(){return SMASK_BUILTIN.concat(SMASK_LIB).map(([name,mask])=>({id:'mb:'+name,kind:'smask',builtin:true,name,mask}));}

/* ---- a small picture for the tiles: the bottom material as a ball, the layers above painted on where their
   generators would put them (edges at the rim, cavities low, dust on top, patterns as noise) ---- */
function smPreviewEl(rec,S){const S0=S||56;if(rec.thumb){const i=el('img',{class:'matprev',src:rec.thumb,width:S0,height:S0,alt:''});return i;}S=Math.min(1024,Math.max(256,S0*4));
  const kids=rec.tree?rec.tree.kids:[],base=kids.find(k=>k.fill&&k.fill.maps.base)||kids[0],cv2=el('canvas',{class:'matprev',width:S,height:S,style:'width:'+S0+'px;height:'+S0+'px','aria-hidden':'true'});
  const bf=base&&base.fill?Object.assign({maps:{}},base.fill):{maps:{base:{on:true,c:[.6,.6,.6]}}},pv=matPreviewEl(()=>bf,()=>({}),S,1),x=cv2.getContext('2d');x.drawImage(pv.el,0,0,S,S);
  const id=x.getImageData(0,0,S,S),D=id.data,h=(a,b)=>{const s=Math.sin(a*12.9898+b*78.233)*43758.5453;return s-Math.floor(s);},vn=(u,v)=>{const i=Math.floor(u),j=Math.floor(v),f=u-i,g=v-j;return (h(i,j)*(1-f)+h(i+1,j)*f)*(1-g)+(h(i,j+1)*(1-f)+h(i+1,j+1)*f)*g;};
  for(const k of kids){if(k===base||!k.fill||!k.fill.maps.base||!k.mask)continue;const c=k.fill.maps.base.c||[.5,.5,.5],row=(k.mask.rows||[]).find(r=>r.kind==='gen'||r.kind==='noise'),op=k.op==null?1:k.op;
    for(let y=0;y<S;y++)for(let x0=0;x0<S;x0++){const nx=(x0+.5)/S*2-1,ny=1-(y+.5)/S*2,rr=nx*nx+ny*ny;if(rr>1)continue;const nz=Math.sqrt(1-rr),n=vn(x0/S*S0/5,y/S*S0/5);let m=0;
      if(row&&row.kind==='gen'){const g=row.p.g;m=g==='edge'||g==='chips'?(1-nz)*1.6+(n-.5):g==='dust'||g==='snow'||g==='moss'?ny*1.4+(n-.5)*.8:(nz*.6+ny*-.6)+(n-.5)}else m=n*1.3-.2;
      m=clamp((m-.5)*3+.5,0,1)*op;const p=(y*S+x0)*4;for(let j=0;j<3;j++)D[p+j]=D[p+j]*(1-m)+Math.pow(c[j],1/2.2)*255*m;}}
  x.putImageData(id,0,0);return cv2;}
function smaskPreviewEl(rec,S){const S0=S||56;S=Math.min(1024,Math.max(256,S0*4));const cv2=el('canvas',{class:'matprev',width:S,height:S,style:'width:'+S0+'px;height:'+S0+'px','aria-hidden':'true'}),x=cv2.getContext('2d'),id=x.createImageData(S,S),D=id.data;
  const rows=rec.mask.rows||[],g=(rows.find(r=>r.kind==='gen')||{p:{}}).p.g;
  for(let y=0;y<S;y++)for(let x0=0;x0<S;x0++){const nx=(x0+.5)/S*2-1,ny=1-(y+.5)/S*2,rr=nx*nx+ny*ny,p=(y*S+x0)*4;if(rr>1){D[p+3]=0;continue;}const nz=Math.sqrt(1-rr),n=Math.abs(Math.sin((x0*1.7+y*.9)*S0/S)*Math.cos((y*1.3-x0*.4)*S0/S));
    let m=g==='edge'||g==='chips'?(1-nz)*1.7+(n-.5)*.6:g==='dust'?ny*1.4+(n-.5)*.5:g==='dirt'?(-ny*.5+.5)*.9+(n-.5)*.6:n;m=clamp((m-.5)*3+.5,0,1);D[p]=D[p+1]=D[p+2]=40+m*200;D[p+3]=255;}
  x.putImageData(id,0,0);return cv2;}

/* .gmat for smart ones: every picture ({w,h,data}) as a PNG, and back */
async function smImgsOut(o,key){if(!o||typeof o!=='object')return o;if(o.data&&o.w&&o.h){const c=document.createElement('canvas');c.width=o.w;c.height=o.h;const x=c.getContext('2d'),id=x.createImageData(o.w,o.h),d=o.data;
    for(let i=0;i<d.length;i+=4){const a=d[i+3]||1;id.data[i]=Math.min(255,d[i]*255/a);id.data[i+1]=Math.min(255,d[i+1]*255/a);id.data[i+2]=Math.min(255,d[i+2]*255/a);id.data[i+3]=d[i+3];}x.putImageData(id,0,0);return {w:o.w,h:o.h,png:pxDataURL(c,key)};}
  if(Array.isArray(o)){const a=[];for(const v of o)a.push(await smImgsOut(v,key));return a;}const r={};for(const k in o)r[k]=await smImgsOut(o[k],k);return r;}
async function smImgsIn(o){if(!o||typeof o!=='object')return o;if(o.png&&o.w&&o.h){const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('bad image'));i.src=o.png;});
    const c=document.createElement('canvas');c.width=o.w;c.height=o.h;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,o.w,o.h).data,out=new Uint8Array(d.length);
    for(let i=0;i<d.length;i+=4){const a=d[i+3];out[i]=d[i]*a/255;out[i+1]=d[i+1]*a/255;out[i+2]=d[i+2]*a/255;out[i+3]=a;}return {w:o.w,h:o.h,data:out};}
  if(Array.isArray(o)){const a=[];for(const v of o)a.push(await smImgsIn(v));return a;}const r={};for(const k in o)r[k]=await smImgsIn(o[k]);return r;}

