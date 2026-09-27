/* ================= Resize / depth ================= */
function rebuildLayers(newW,newH,depth,draw){
  clearHistory();
  for(const L of everyLayer()){if(!L.maps)L.maps={base:L.target};for(const k of Object.keys(L.maps)){const t=L.maps[k];if(!t||t.empty){delete L.maps[k];continue;}
      const nt=makeTarget(newW,newH,k==='height'&&canFloat?16:depth);draw(t,nt,false);disposeTarget(t);L.maps[k]=nt;}L.target=L.maps.base;}
  for(const n of everyNode())if(n.mask){const nt=makeTarget(newW,newH,depth);draw(n.mask.target,nt,true);disposeTarget(n.mask.target);n.mask.target=nt;}
  doc.w=newW;doc.h=newH;doc.depth=depth;allocAux();syncTargets();if(doc.anim){doc.anim.frames.forEach(frameDirty);showFrame(doc.anim.cur,true);}
}
function resizeCanvasDoc(w,h,ax,ay){const ox=Math.round((w-doc.w)*ax),oy=Math.round((h-doc.h)*ay);
  rebuildLayers(w,h,doc.depth,(s,d,m)=>run(P.resample,d,{uSrc:s.tex,uOffset:[ox,oy],uScale:[1,1],uTaps:{int:1},uOutside:m?[1,1,1,1]:[0,0,0,0]}));for(const L of everyLayer()){if(L.text){L.text.x+=ox;L.text.y+=oy;renderText(L);}if(L.grad){for(const k of ['a','b']){L.grad[k][0]+=ox;L.grad[k][1]+=oy;}renderLiveGrad(L);}}fit();changedAll();updateStatus();toast('Canvas is now '+w+' × '+h+'. Undo history was cleared.');}
function resizeImageDoc(w,h){const fx=w/doc.w,fy=h/doc.h,sx=doc.w/w,sy=doc.h/h,taps=Math.min(8,Math.max(1,Math.ceil(Math.max(sx,sy))));
  rebuildLayers(w,h,doc.depth,(s,d)=>run(P.resample,d,{uSrc:s.tex,uOffset:[0,0],uScale:[sx,sy],uTaps:{int:taps}}));for(const L of everyLayer())if(L.text){const f=(fx+fy)/2,t=L.text;t.x=Math.round(t.x*fx);t.y=Math.round(t.y*fy);t.size=Math.max(1,Math.round(t.size*f));t.outline=(t.outline||0)*f;t.tracking=(t.tracking||0)*f;renderText(L);}for(const L of everyLayer())if(L.grad){for(const k of ['a','b']){L.grad[k][0]*=fx;L.grad[k][1]*=fy;}renderLiveGrad(L);}fit();changedAll();updateStatus();toast('Image resampled to '+w+' × '+h+'. Undo history was cleared.');}
function setDepth(d){if(d===doc.depth)return;if(d===16&&!canFloat){toast('This GPU cannot render to 16-bit float textures, so 16-bit mode is unavailable.');return;}
  rebuildLayers(doc.w,doc.h,d,(s,t)=>run(P.resample,t,{uSrc:s.tex,uOffset:[0,0],uScale:[1,1],uTaps:{int:1}}));changedAll();updateStatus();
  toast(d===16?'Now 16 bits per channel (half float). Soft gradients and glazes will not band.':'Now 8 bits per channel.');}
function toggleTile(){doc.wrap=!doc.wrap;const all=[strokeT,beforeT,scratchT,previewT,...pool.all,...everyLayer().flatMap(l=>l.maps?Object.values(l.maps):[l.target]),...Object.values(emptyTs),...auxTargets(),...everyNode().filter(n=>n.mask).map(n=>n.mask.target),sel.t];all.forEach(t=>setWrap(t,doc.wrap));
  $('#tileBtn').setAttribute('aria-pressed',String(doc.wrap));fit();requestRender(true);toast(doc.wrap?'Tile mode on: strokes wrap across edges.':'Tile mode off.');}

function newDoc(w,h,depth,bg,name,wrap,tpl){
  if(tedit){tedit=null;ted.hidden=true;}if(tsess){clearTimeout(tsess.timer);tsess=null;}
  if(ui.mode==='anim'){stopPlay();doc.root=doc.paintRoot;doc.paintRoot=null;ui.mode='paint';document.body.classList.remove('animmode');$('#modeSel').value='paint';}
  clearHistory();for(const L of everyNode())disposeLayer(L);doc.anim=null;doc.root.children=[];ui.viewMask=false;selectOnly(null);preview=null;dropStrokeCache(stroke);stroke=null;groupCount=0;
  Object.assign(doc,{w,h,depth,name,wrap,count:0,filePath:null,maps:(MAP_TEMPLATES[tpl]||['base']).slice(),map:'base',view:'base',mapDef:{},nrmStr:8,light:{az:135,el:40}});allocAux();
  let L=null;if(bg!==false){L=newLayerObj('Background');insertNode(L,doc.root);selectOnly(L);if(bg)clearTarget(L.target,[bg[0],bg[1],bg[2],1]);}
  if(typeof xf!=='undefined'&&xf){for(const it of xf.items)freeItem(it);xf=null;}if(typeof crop!=='undefined'&&crop)cropStart();
  $('#tileBtn').setAttribute('aria-pressed',String(wrap));$('#docName').textContent=name;fit();changedAll();updateStatus();refreshMapsUI();return L;
}
