/* ================= Filter Gallery =================
   Every filter in one window: a big preview, the filters as thumbnails in folders, the chosen filter's settings,
   and a stack of filters applied on top of each other (reorder, switch off, remove). Apply bakes the stack into the
   layer; "As a filter layer" keeps it editable as a filter layer clipped to the layer. */
const GALLERY_FOLDERS=()=>[
  ['Artistic',['oilPaint','painterly','cutout','mosaic']],
  ['Blur',['blur','boxBlur','radialBlur','lensBlur','surfBlur','motionBlur']],
  ['Sharpen',['sharpen','highPass']],
  ['Stylize',['emboss','edges','edgeWear']],
  ['Render',['clouds','cells','noise']],
  ['Tiling',['offset','tile','seamless']],
  ['Adjust',['levels','curves','hueSat','gradMap','threshold','posterize','quantize','desat','invert']]].map(([n,ids])=>[n,ids.filter(id=>FX[id])]).filter(f=>f[1].length);
const gal={open:{Artistic:true},thumbs:{},thumbFor:null};
function dlgGallery(){const et=needTarget();if(!et)return;if(!effVisible(et.node)){toast('Show the active layer before filtering it.');return;}if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const L=et.L,S={stack:[fxItem(GALLERY_FOLDERS()[0][1][0])],sel:0,search:'',compare:false};
  const node={fx:{stack:S.stack}};
  /* the preview in the window: the result shrunk on the GPU */
  const pv=el('canvas',{class:'galprev','aria-label':'Preview'}),PW=560,sc=Math.min(1,PW/Math.max(doc.w,doc.h)),pw=Math.max(1,Math.round(doc.w*sc)),ph=Math.max(1,Math.round(doc.h*sc));pv.width=pw;pv.height=ph;
  const small=makeTarget(pw,ph,8,false);
  const draw=()=>{if(S.compare||preview.off)blit(L.target,previewT,0,0,doc.w,doc.h,0,0);
    else{node.fx.stack=S.stack;const r=fxStackResult(node,L.target,doc.map);blit(r,previewT,0,0,doc.w,doc.h,0,0);if(r!==L.target)release(r);chanLimit(et);selLimit(et);}
    run(P.f_rs,small,{uSrc:previewT.tex,uOut:[pw,ph]});const d=captureRegionNow(small,0,0,pw,ph);const st=d.depth===16?null:d.data;const x=pv.getContext('2d'),id=x.createImageData(pw,ph);
    if(st){for(let i=0;i<st.length;i+=4){const a=st[i+3];id.data[i]=a?Math.min(255,st[i]*255/a):0;id.data[i+1]=a?Math.min(255,st[i+1]*255/a):0;id.data[i+2]=a?Math.min(255,st[i+2]*255/a):0;id.data[i+3]=a;}}
    x.putImageData(id,0,0);requestRender(true);};
  let pend=0;const upd=()=>{if(pend)return;pend=requestAnimationFrame(()=>{pend=0;if(preview)draw();});};
  preview={L:et.node,isMask:et.isMask,et,off:false};
  /* thumbnails: each filter at its defaults on the layer, made a few per frame */
  const TS=84,ts=Math.min(1,TS/Math.max(doc.w,doc.h)),tw=Math.max(1,Math.round(doc.w*ts)),th=Math.max(1,Math.round(doc.h*ts)),tsm=makeTarget(tw,th,8,false);
  if(gal.thumbFor!==L.target){gal.thumbs={};gal.thumbFor=L.target;}
  const thumbQ=[];let thumbRaf=0;
  const thumbOf=id=>{const c=el('canvas',{width:tw,height:th,class:'galthumb'});if(gal.thumbs[id])c.getContext('2d').putImageData(gal.thumbs[id],0,0);else{thumbQ.push([id,c]);if(!thumbRaf)thumbRaf=requestAnimationFrame(thumbStep);}return c;};
  const thumbStep=()=>{thumbRaf=0;const t0=performance.now();
    while(thumbQ.length&&performance.now()-t0<30){const [id,c]=thumbQ.shift();if(!c.isConnected)continue;const o=acquire();
      try{const n={fx:{stack:[fxItem(id)]}},r=fxStackResult(n,L.target,doc.map);run(P.f_rs,tsm,{uSrc:r.tex,uOut:[tw,th]});if(r!==L.target)release(r);}finally{release(o);}
      const d=captureRegionNow(tsm,0,0,tw,th).data,im=new ImageData(tw,th);for(let i=0;i<d.length;i+=4){const a=d[i+3];im.data[i]=a?d[i]*255/a:0;im.data[i+1]=a?d[i+1]*255/a:0;im.data[i+2]=a?d[i+2]*255/a:0;im.data[i+3]=a;}
      gal.thumbs[id]=im;c.getContext('2d').putImageData(im,0,0);}
    if(thumbQ.length)thumbRaf=requestAnimationFrame(thumbStep);};
  /* the three columns */
  const list=el('div',{class:'galfolders'}),settings=el('div',{class:'galset'}),stackBox=el('div',{class:'galstack'});
  const cur=()=>S.stack[S.sel];
  const drawList=()=>{list.replaceChildren();const q=S.search.trim().toLowerCase();
    for(const [name,ids] of GALLERY_FOLDERS()){const hits=ids.filter(id=>!q||FX[id].title.toLowerCase().includes(q));if(!hits.length)continue;const open=q||gal.open[name];
      const head=el('button',{class:'galhead','aria-expanded':String(!!open),text:(open?'▾ ':'▸ ')+name,onclick:()=>{gal.open[name]=!gal.open[name];drawList();}});list.append(head);
      if(open)list.append(el('div',{class:'galgrid'},...hits.map(id=>{const on=cur()&&cur().id===id;const b=el('button',{class:'galitem'+(on?' on':''),title:FX[id].title,onclick:()=>{
          if(!S.stack.length){S.stack.push(fxItem(id));S.sel=0;}else S.stack[S.sel]=Object.assign(fxItem(id),{on:true});drawAll();upd();}},thumbOf(id),el('span',{text:FX[id].title.replace(/…$/,'')}));return b;})));}};
  const drawSettings=()=>{settings.replaceChildren();const it=cur();if(!it){settings.append(el('p',{class:'note',text:'Pick a filter on the left.'}));return;}const o=FX[it.id];
    settings.append(el('div',{class:'galtitle',text:o.title}));const c=fxControls(o,it.v,upd,{src:L.target});settings.append(...c.body,el('div',{class:'frow'},c.reset));};
  const drawStack=()=>{stackBox.replaceChildren(el('div',{class:'sub',text:'Applied, top first'}));
    S.stack.map((it,i)=>[it,i]).reverse().forEach(([it,i])=>{const row=el('div',{class:'galrow'+(i===S.sel?' on':'')},
        el('button',{class:'eyeb','aria-label':(it.on===false?'Show ':'Hide ')+FX[it.id].title,text:it.on===false?'○':'◉',onclick:e=>{e.stopPropagation();it.on=it.on===false;drawStack();upd();}}),
        el('span',{class:'galname',text:FX[it.id].title}),
        el('button',{class:'btn sm',text:'↑',title:'Up','aria-label':'Move up',disabled:i===S.stack.length-1,onclick:e=>{e.stopPropagation();S.stack.splice(i+1,0,S.stack.splice(i,1)[0]);S.sel=i+1;drawAll();upd();}}),
        el('button',{class:'btn sm',text:'↓',title:'Down','aria-label':'Move down',disabled:i===0,onclick:e=>{e.stopPropagation();S.stack.splice(i-1,0,S.stack.splice(i,1)[0]);S.sel=i-1;drawAll();upd();}}));
      row.onclick=()=>{S.sel=i;drawAll();};stackBox.append(row);});
    stackBox.append(el('div',{class:'chips'},el('button',{class:'btn sm',text:'+ Add',title:'Add another filter on top',onclick:()=>{S.stack.push(fxItem(cur()?cur().id:'blur'));S.sel=S.stack.length-1;drawAll();upd();}}),
      el('button',{class:'btn sm',text:'Remove',disabled:!S.stack.length,onclick:()=>{S.stack.splice(S.sel,1);S.sel=Math.max(0,Math.min(S.sel,S.stack.length-1));drawAll();upd();}})));};
  const drawAll=()=>{drawList();drawSettings();drawStack();};
  const search=el('input',{type:'search',class:'galsearch',placeholder:'Search filters','aria-label':'Search filters'});search.addEventListener('input',()=>{S.search=search.value;drawList();});
  const cmp=el('button',{class:'btn sm',text:'Hold to compare',title:'Shows the layer without the filters while held'});
  cmp.addEventListener('pointerdown',()=>{S.compare=true;draw();});for(const ev of ['pointerup','pointerleave'])cmp.addEventListener(ev,()=>{if(S.compare){S.compare=false;draw();}});
  const prevChk=previewChk('galPrev',true,x=>{preview.off=!x;draw();});
  const body=el('div',{class:'gallery'},
    el('div',{class:'galview'},el('div',{class:'galcanvas'},pv),el('div',{class:'frow'},cmp,prevChk,el('span',{class:'note',text:'On “'+et.node.name+'”'+(et.isMask?' (mask)':'')}))),
    el('div',{class:'galmid'},search,list),
    el('div',{class:'galright'},settings,stackBox));
  drawAll();draw();
  const cleanup=()=>{cancelAnimationFrame(pend);pend=0;cancelAnimationFrame(thumbRaf);disposeTarget(small);disposeTarget(tsm);};
  const canLayer=!et.isMask&&!L.quick&&ui.mode!=='anim';
  const asLayer=canLayer?el('button',{class:'btn',id:'galAsLayer',text:'As a filter layer',title:'Keep the filters editable: a filter layer clipped to this layer',onclick:()=>{
      const st=S.stack.map(it=>({id:it.id,v:fxClean(it.v),on:it.on!==false}));if(!st.length)return;cleanup();preview=null;closeDialog();
      const T=et.node,Lf=newFxLayerObj(st.length===1?FX[st[0].id].title:'Filters',st,doc.map),p=T.parent,i=p.children.indexOf(T)+1;if(isLayer(T)&&!isFx(T))Lf.clip=true;
      structOp('New filter layer',()=>{insertNode(Lf,p,i);selectOnly(Lf);});requestRender(true);toast('Added the filter layer “'+Lf.name+'”. Double-click its thumbnail to change the filters.');}}):null;
  openDialog({title:'Filter Gallery',body,wide:true,okLabel:'Apply',onOk(){if(!S.stack.some(it=>it.on!==false)){cleanup();preview=null;requestRender(true);return;}
      preview.off=false;S.compare=false;draw();cleanup();applyPreview(S.stack.filter(it=>it.on!==false).length===1?FX[S.stack.find(it=>it.on!==false).id].title:'Filter Gallery');},
    onCancel(){cleanup();preview=null;requestRender(true);}});
  if(asLayer)$('#dlgOk').before(asLayer);
  /* the extra button belongs to this window only */
  const mo=new MutationObserver(()=>{if(modal.hidden||!body.isConnected){if(asLayer)asLayer.remove();mo.disconnect();}});mo.observe(modal,{attributes:true,childList:true,subtree:true});}
