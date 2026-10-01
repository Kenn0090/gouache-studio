/* ================= Resize / depth ================= */
/* Two steps so a change that doesn't fit in graphics memory can't break the picture: first every new texture is made
   (plus room for the working textures), and only if the GPU managed all of them is anything copied and the old ones freed. */
function rebuildLayers(newW,newH,depth,draw){
  const jobs=[];
  for(const L of everyLayer()){if(!L.maps)L.maps={base:L.target};for(const k of Object.keys(L.maps)){const t=L.maps[k];if(!t||t.empty){delete L.maps[k];continue;}
      jobs.push({src:t,d:k==='height'&&canFloat?16:depth,m:false,set:nt=>{L.maps[k]=nt;}});}}
  for(const n of everyNode())if(n.mask)jobs.push({src:n.mask.target,d:depth,m:true,set:nt=>{n.mask.target=nt;}});
  /* mask rows with pictures of their own (Paint rows; pictures keep their size) */
  for(const n of everyNode())if(n.mask&&n.mask.stack)for(const r of n.mask.stack)if(r.t&&r.kind!=='image')jobs.push({src:r.t,d:depth,m:false,row:true,set:nt=>{r.t=nt;}});
  for(const d in aux){const pl=aux[d].pool;for(const t of pl.free.splice(0)){pl.all.splice(pl.all.indexOf(t),1);disposeTarget(t);}} /* spare room first */
  while(gl.getError()!==gl.NO_ERROR);
  const made=[];let bad=false;
  for(const j of jobs){j.nt=makeTarget(newW,newH,j.d);made.push(j.nt);if(gl.getError()!==gl.NO_ERROR||gl.isContextLost()){bad=true;break;}}
  if(!bad)for(let i=0;i<5;i++){const t=makeTarget(newW,newH,depth);made.push(t);if(gl.getError()!==gl.NO_ERROR){bad=true;break;}}
  if(bad){for(const t of made)disposeTarget(t);while(gl.getError()!==gl.NO_ERROR);return false;}
  for(const t of made.splice(jobs.length))disposeTarget(t);
  clearHistory();
  for(const j of jobs){if(j.row)clearTarget(j.nt,[0,0,0,0]);draw(j.src,j.nt,j.m);disposeTarget(j.src);j.set(j.nt);}
  for(const L of everyLayer())if(L.maps)L.target=L.maps.base;
  for(const n of everyNode())if(n.mask&&n.mask.stack)n.mask._key=null;
  if(newW!==doc.w||newH!==doc.h){if(doc.cage){doc.cage=null;cageFlatOff();}if(typeof bakeReset==='function')bakeReset();if(typeof cvReset==='function')cvReset();}doc.w=newW;doc.h=newH;doc.depth=depth;
  for(const L of everyLayer())for(const k in L._fillSolid||{})L._fillSolid[k]=fillSolidColor(k,L._fillSolid[k]);
  allocAux();syncTargets();if(doc.anim){doc.anim.frames.forEach(frameDirty);showFrame(doc.anim.cur,true);}
  return true;
}
const NO_GPU_MEM='Not enough graphics memory for that. Nothing was changed. Try fewer layers or a smaller canvas.';
function resizeCanvasDoc(w,h,ax,ay){const ox=Math.round((w-doc.w)*ax),oy=Math.round((h-doc.h)*ay);
  for(const L of everyLayer())for(const k of Object.keys(L._fillSolid||{}))ensureMapTarget(L,k);
  if(!rebuildLayers(w,h,doc.depth,(s,d,m)=>run(P.resample,d,{uSrc:s.tex,uOffset:[ox,oy],uScale:[1,1],uTaps:{int:1},uOutside:m?[1,1,1,1]:[0,0,0,0]}))){toast(NO_GPU_MEM);return;}for(const L of everyLayer()){if(L.text){L.text.x+=ox;L.text.y+=oy;renderText(L);}if(L.grad){for(const k of ['a','b']){L.grad[k][0]+=ox;L.grad[k][1]+=oy;}renderLiveGrad(L);}}fit();changedAll();updateStatus();toast('Canvas is now '+w+' × '+h+'. Undo history was cleared.');}
function resizeImageDoc(w,h){const fx=w/doc.w,fy=h/doc.h,sx=doc.w/w,sy=doc.h/h,taps=Math.min(8,Math.max(1,Math.ceil(Math.max(sx,sy))));
  if(!rebuildLayers(w,h,doc.depth,(s,d)=>run(P.resample,d,{uSrc:s.tex,uOffset:[0,0],uScale:[sx,sy],uTaps:{int:taps}}))){toast(NO_GPU_MEM);return;}for(const L of everyLayer())if(L.text){const f=(fx+fy)/2,t=L.text;t.x=Math.round(t.x*fx);t.y=Math.round(t.y*fy);t.size=Math.max(1,Math.round(t.size*f));t.outline=(t.outline||0)*f;t.tracking=(t.tracking||0)*f;renderText(L);}for(const L of everyLayer())if(L.grad){for(const k of ['a','b']){L.grad[k][0]*=fx;L.grad[k][1]*=fy;}renderLiveGrad(L);}fit();changedAll();updateStatus();toast('Image resampled to '+w+' × '+h+'. Undo history was cleared.');}
function setDepth(d){if(d===doc.depth)return;if(d===16&&!canFloat){toast('This GPU cannot render to 16-bit float textures, so 16-bit mode is unavailable.');return;}
  if(!rebuildLayers(doc.w,doc.h,d,(s,t)=>run(P.resample,t,{uSrc:s.tex,uOffset:[0,0],uScale:[1,1],uTaps:{int:1}}))){toast(d===16?'Not enough graphics memory for 16-bit at this canvas size ('+doc.w+' × '+doc.h+'). The picture is still 8-bit and unchanged.':NO_GPU_MEM);return;}changedAll();updateStatus();
  toast(d===16?'Now 16 bits per channel (half float). Soft gradients and glazes will not band.':'Now 8 bits per channel.');}
function toggleTile(){doc.wrap=!doc.wrap;const all=[strokeT,beforeT,scratchT,previewT,...pool.all,...everyLayer().flatMap(l=>l.maps?Object.values(l.maps):[l.target]),...Object.values(emptyTs),...auxTargets(),...everyNode().filter(n=>n.mask).map(n=>n.mask.target),sel.t];all.forEach(t=>setWrap(t,doc.wrap));
  $('#tileBtn').setAttribute('aria-pressed',String(doc.wrap));fit();requestRender(true);toast(doc.wrap?'Tile mode on: strokes wrap across edges.':'Tile mode off.');}

function newDoc(w,h,depth,bg,name,wrap,tpl){
  if(ui.mode==='brush'||tabDocs.paint)setMode('paint',true);
  if(tedit){tedit=null;ted.hidden=true;}if(tsess){clearTimeout(tsess.timer);tsess=null;}
  if(ui.mode==='bake'){bakeExit();ui.mode='paint';document.body.classList.remove('bakemode');syncModeTabs();}
  if(ui.mode==='convert'){convertExit();ui.mode='paint';document.body.classList.remove('convmode');syncModeTabs();}
  if(typeof cvReset==='function')cvReset();
  if(typeof bakeReset==='function')bakeReset();
  if(ui.mode==='anim'){stopPlay();doc.root=doc.paintRoot;doc.paintRoot=null;ui.mode='paint';document.body.classList.remove('animmode');syncModeTabs();}
  clearHistory();for(const L of everyNode())disposeLayer(L);doc.anim=null;doc.root.children=[];ui.viewMask=false;selectOnly(null);preview=null;dropStrokeCache(stroke);stroke=null;groupCount=0;if(typeof cageFlatOff==='function')cageFlatOff();doc.cage=null;
  Object.assign(doc,{w,h,depth,name,wrap,count:0,filePath:null,guides:[],dpi:72,maps:(MAP_TEMPLATES[tpl]||['base']).slice(),map:'base',view:'base',mapDef:{},nrmStr:8,light:{az:135,el:40},v3d:null,brushTpl:false,workflow:tpl==='pbrsg'?'spec':'metal'});allocAux();if(typeof v3!=='undefined'){v3.mesh=null;v3.imported=null;for(const k in v3.tex){disposeTarget(v3.tex[k]);delete v3.tex[k];}}
  let L=null;if(bg!==false){L=newLayerObj('Background');insertNode(L,doc.root);selectOnly(L);if(bg)clearTarget(L.target,[bg[0],bg[1],bg[2],1]);}
  if(typeof xf!=='undefined'&&xf){for(const it of xf.items)freeItem(it);xf=null;}if(typeof crop!=='undefined'&&crop)cropStart();
  $('#tileBtn').setAttribute('aria-pressed',String(wrap));$('#docName').textContent=name;fit();changedAll();updateStatus();refreshMapsUI();if(typeof tipBanner==='function')tipBanner();return L;
}
