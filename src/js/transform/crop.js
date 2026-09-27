/* ================= Crop tool (C) =================
   The box is centre, size and angle in document pixels. Applying builds new, smaller (or larger) layers;
   pixels outside the box are deleted. Undo swaps the old layers back in, so crop is fully undoable. */
let crop=null;
function cropStart(){crop={cx:doc.w/2,cy:doc.h/2,w:doc.w,h:doc.h,ang:0,ratio:null};buildBrushPanel();drawXfOverlay();}
function cropCornersOf(c){const co=Math.cos(c.ang),si=Math.sin(c.ang),hw=c.w/2,hh=c.h/2;
  return [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([x,y])=>[c.cx+x*co-y*si,c.cy+x*si+y*co]);}
function cropEdgesOf(c){const k=cropCornersOf(c);return [0,1,2,3].map(i=>[(k[i][0]+k[(i+1)%4][0])/2,(k[i][1]+k[(i+1)%4][1])/2]);}
function cropLocal(c,x,y){const co=Math.cos(-c.ang),si=Math.sin(-c.ang),dx=x-c.cx,dy=y-c.cy;return [dx*co-dy*si,dx*si+dy*co];}
function cropFromLocalCenter(c0,lx,ly){const co=Math.cos(c0.ang),si=Math.sin(c0.ang);return [c0.cx+lx*co-ly*si,c0.cy+lx*si+ly*co];}
function cropHit(sx,sy){const c=crop,near=(p,r)=>{const s=scrPt(p);return Math.hypot(s[0]-sx,s[1]-sy)<=(r||9);};
  const k=cropCornersOf(c),ed=cropEdgesOf(c);
  for(let i=0;i<4;i++)if(near(k[i]))return {type:'corner',k:i};
  for(let i=0;i<4;i++)if(near(ed[i]))return {type:'edge',k:i};
  const sp=k.map(scrPt);if(pointInPoly(sx,sy,sp))return {type:'move'};
  /* just outside the box rotates it; further away draws a new box */
  let d=Infinity;for(let i=0;i<4;i++){const a=sp[i],b=sp[(i+1)%4],vx=b[0]-a[0],vy=b[1]-a[1],t=clamp(((sx-a[0])*vx+(sy-a[1])*vy)/(vx*vx+vy*vy||1),0,1);d=Math.min(d,Math.hypot(sx-a[0]-vx*t,sy-a[1]-vy*t));}
  return d<40?{type:'rotate'}:{type:'new'};}
function cropHover(e){const [sx,sy]=stageXY(e),h=cropHit(sx,sy);
  cv.style.cursor=h.type==='move'?'move':h.type==='rotate'?ROT_CURSOR:h.type==='new'?'crosshair':h.type==='corner'?(h.k%2?'nesw-resize':'nwse-resize'):(h.k%2?'ew-resize':'ns-resize');}
function cropPointerDown(e,ix,iy){const [sx,sy]=stageXY(e);ptr={mode:'crop',id:e.pointerId,hit:cropHit(sx,sy),c0:Object.assign({},crop),m0:[ix,iy]};}
function cropPointerMove(e,ix,iy){const p=ptr,h=p.hit,c0=p.c0,c=crop,ratio=c.ratio||(e.shiftKey&&h.type!=='edge'?c0.w/c0.h:null);
  if(h.type==='move'){c.cx=c0.cx+ix-p.m0[0];c.cy=c0.cy+iy-p.m0[1];}
  else if(h.type==='rotate'){let a=Math.atan2(iy-c0.cy,ix-c0.cx)-Math.atan2(p.m0[1]-c0.cy,p.m0[0]-c0.cx);if(e.shiftKey)a=Math.round(a/(Math.PI/12))*(Math.PI/12);c.ang=c0.ang+a;}
  else if(h.type==='new'){let x0=p.m0[0],y0=p.m0[1],w=Math.abs(ix-x0),hh=Math.abs(iy-y0);if(ratio){if(w/ratio>hh)hh=w/ratio;else w=hh*ratio;}
    c.ang=0;c.w=Math.max(1,w);c.h=Math.max(1,hh);c.cx=x0+Math.sign(ix-x0||1)*c.w/2;c.cy=y0+Math.sign(iy-y0||1)*c.h/2;}
  else{const u=cropLocal(c0,ix,iy),alt=e.altKey;
    if(h.type==='corner'){const sgx=h.k===0||h.k===3?-1:1,sgy=h.k<2?-1:1,ax=alt?0:-sgx*c0.w/2,ay=alt?0:-sgy*c0.h/2;
      let w=Math.max(1,(u[0]-ax)*sgx*(alt?2:1)),hh=Math.max(1,(u[1]-ay)*sgy*(alt?2:1));if(ratio){if(w/ratio>hh)hh=w/ratio;else w=hh*ratio;}
      const lcx=alt?0:ax+sgx*w/2,lcy=alt?0:ay+sgy*hh/2;[c.cx,c.cy]=cropFromLocalCenter(c0,lcx,lcy);c.w=w;c.h=hh;}
    else{const k=h.k,vert=k%2===0,sg=k===0||k===3?-1:1;
      if(vert){const a=alt?0:-sg*c0.h/2;let hh=Math.max(1,(u[1]-a)*sg*(alt?2:1));c.h=hh;if(c.ratio)c.w=hh*c.ratio;[c.cx,c.cy]=cropFromLocalCenter(c0,0,alt?0:a+sg*hh/2);}
      else{const a=alt?0:-sg*c0.w/2;let w=Math.max(1,(u[0]-a)*sg*(alt?2:1));c.w=w;if(c.ratio)c.h=w/c.ratio;[c.cx,c.cy]=cropFromLocalCenter(c0,alt?0:a+sg*w/2,0);}}}
  drawXfOverlay();cropPanelSync();}
function cropPointerUp(){ptr=null;cropPanelSync();}
function drawCropOverlay(){const c=crop,r=stage.getBoundingClientRect(),k=cropCornersOf(c).map(scrPt),f=p=>p.map(v=>v.toFixed(1)).join(' ');
  let s='<path class="dim" fill-rule="evenodd" d="M-10 -10H'+(r.width+10)+'V'+(r.height+10)+'H-10Z M'+k.map(f).join('L')+'Z"/>';
  s+='<path class="ln" d="M'+k.map(f).join('L')+'Z"/>';
  let g='';for(const t of [1/3,2/3]){const a=[k[0][0]+(k[1][0]-k[0][0])*t,k[0][1]+(k[1][1]-k[0][1])*t],b=[k[3][0]+(k[2][0]-k[3][0])*t,k[3][1]+(k[2][1]-k[3][1])*t],
    c2=[k[0][0]+(k[3][0]-k[0][0])*t,k[0][1]+(k[3][1]-k[0][1])*t],d=[k[1][0]+(k[2][0]-k[1][0])*t,k[1][1]+(k[2][1]-k[1][1])*t];g+='M'+f(a)+'L'+f(b)+'M'+f(c2)+'L'+f(d);}
  s+='<path class="th" d="'+g+'"/>';
  for(const p of [...k,...cropEdgesOf(c).map(scrPt)])s+='<rect class="hs" x="'+(p[0]-4)+'" y="'+(p[1]-4)+'" width="8" height="8"/>';
  xfOv.innerHTML=s;}

/* ---- panel ---- */
let cropFields=null;
function cropPanelSync(){if(!cropFields||!crop)return;const v={w:Math.round(crop.w),h:Math.round(crop.h),ang:+(crop.ang*180/Math.PI).toFixed(1)};
  for(const [k,inp] of cropFields)if(document.activeElement!==inp)inp.value=v[k];}
function buildCropPanel(box){$('#brushTitle').textContent='Crop';if(!crop)cropStart();
  const ratios=[['free','Free'],['orig','Original ('+doc.w+':'+doc.h+')'],['1','1 : 1'],['2','2 : 1'],['0.5','1 : 2'],['1.3333','4 : 3'],['0.75','3 : 4'],['1.7778','16 : 9'],['0.5625','9 : 16']];
  const rs=el('select',{id:'crRatio','aria-label':'Ratio'},...ratios.map(([v,t])=>el('option',{value:v,text:t})));rs.value=crop.ratio?(Math.abs(crop.ratio-doc.w/doc.h)<1e-6?'orig':String(ratios.find(r=>Math.abs(+r[0]-crop.ratio)<1e-3)?.[0]||'free')):'free';
  rs.addEventListener('change',()=>{crop.ratio=rs.value==='free'?null:rs.value==='orig'?doc.w/doc.h:+rs.value;if(crop.ratio)crop.h=crop.w/crop.ratio;drawXfOverlay();cropPanelSync();});
  const sizes=[];for(let s=256;s<=MAX_DIM;s*=2)sizes.push([s,s]);for(let s=512;s<=MAX_DIM;s*=2){sizes.push([s,s/2]);sizes.push([s/2,s]);}
  sizes.sort((a,b)=>a[0]*a[1]-b[0]*b[1]||b[0]-a[0]);
  const ps=el('select',{id:'crPow','aria-label':'Power-of-two size'},el('option',{value:'',text:'Power of two…'}),...sizes.map(([w,h])=>el('option',{value:w+'x'+h,text:w+' × '+h})));
  ps.addEventListener('change',()=>{if(!ps.value)return;const [w,h]=ps.value.split('x').map(Number);crop.w=w;crop.h=h;crop.ratio=null;rs.value='free';ps.value='';drawXfOverlay();cropPanelSync();});
  const num=(k,label)=>{const inp=el('input',{class:'num',type:'number',id:'cr_'+k,step:k==='ang'?'0.1':'1','aria-label':label});
    inp.addEventListener('change',()=>{const n=parseFloat(inp.value);if(!isFinite(n))return;
      if(k==='ang')crop.ang=n*Math.PI/180;else{const v=clamp(Math.round(n),1,MAX_DIM);if(k==='w'){crop.w=v;if(crop.ratio)crop.h=v/crop.ratio;}else{crop.h=v;if(crop.ratio)crop.w=v*crop.ratio;}}
      drawXfOverlay();cropPanelSync();});return [k,inp,label];};
  cropFields=[num('w','Width'),num('h','Height'),num('ang','Angle °')];
  const grid=el('div',{class:'xfgrid'});for(const [k,inp,label] of cropFields)grid.append(el('label',{for:inp.id,text:label}),inp);
  box.append(el('div',{class:'frow'},el('label',{for:'crRatio',text:'Ratio'}),rs),el('div',{class:'frow'},el('label',{for:'crPow',text:'Size'}),ps),grid,
    el('div',{class:'frow'},el('button',{class:'btn sm',text:'Crop to selection',onclick:()=>{if(!sel.active||!sel.bb){toast('Make a selection first.');return;}const b=sel.bb;Object.assign(crop,{cx:(b[0]+b[2])/2,cy:(b[1]+b[3])/2,w:b[2]-b[0],h:b[3]-b[1],ang:0});drawXfOverlay();cropPanelSync();}}),
      el('button',{class:'btn sm',text:'Reset',onclick:()=>{const r=crop.ratio;cropStart();crop.ratio=r;}})),
    el('div',{class:'frow'},el('button',{class:'btn sm primary',text:'Crop (Enter)',onclick:cropApply})),
    el('div',{class:'sub',text:'Drag the edges or corners (Shift keeps the shape, Alt works from the centre). Drag inside to move, just outside to rotate and straighten, further out to draw a new box. Pixels outside the box are deleted. Double-click or Enter crops.'}));
  cropPanelSync();}
function cropKeys(e){if(ui.tool!=='crop'||!crop)return false;
  if(e.key==='Enter'){e.preventDefault();cropApply();return true;}
  if(e.key==='Escape'){e.preventDefault();cropStart();return true;}return false;}

/* ---- applying ---- */
function cropApply(){if(!crop)return;if(preview||selLive||xf){toast('Finish the open edit first.');return;}const c=crop;applyCropBox(c);if(ui.tool==='crop')cropStart();}
function cropToSelection(){if(!sel.active||!sel.bb){toast('Make a selection first.');return;}const b=sel.bb;applyCropBox({cx:(b[0]+b[2])/2,cy:(b[1]+b[3])/2,w:b[2]-b[0],h:b[3]-b[1],ang:0});if(ui.tool==='crop')cropStart();}
function applyCropBox(c){const nw=clamp(Math.round(c.w),1,MAX_DIM),nh=clamp(Math.round(c.h),1,MAX_DIM),rot=Math.abs(c.ang)>1e-6;
  let H,x0=0,y0=0;
  if(!rot){x0=Math.round(c.cx-nw/2);y0=Math.round(c.cy-nh/2);H=[1,0,x0,0,1,y0,0,0,1];}
  else{const co=Math.cos(c.ang),si=Math.sin(c.ang);H=[co,-si,c.cx-co*nw/2+si*nh/2, si,co,c.cy-si*nw/2-co*nh/2, 0,0,1];}
  const layers=everyLayer();if(rot)for(const L of layers)if(L.text||L.grad)rasterizeText(L);
  const maskNodes=everyNode().filter(n=>n.mask),mObjs=maskNodes.map(n=>n.mask),texts=rot?[]:layers.filter(L=>L.text),grads=rot?[]:layers.filter(L=>L.grad);
  const draw=(src,outside)=>{const t=makeTarget(nw,nh,src.depth,doc.wrap);run(P.xform,t,{uSrc:src.tex,uH0:H.slice(0,3),uH1:H.slice(3,6),uH2:H.slice(6,9),uInterp:{int:rot?2:0},uSS:{int:1},uWrap:false,uDoc:[nw,nh],uOutside:outside});return t;};
  /* every map of every layer (frames too) */
  const mapsOf=L=>L.maps?Object.assign({},...Object.keys(L.maps).filter(k=>L.maps[k]&&!L.maps[k].empty).map(k=>({[k]:L.maps[k]}))):{base:L.target};
  const oldT=layers.map(mapsOf),newT=oldT.map(ms=>Object.fromEntries(Object.entries(ms).map(([k,t])=>[k,draw(t,[0,0,0,0])]))),newM=mObjs.map(m=>draw(m.target,[1,1,1,1]));
  const oldM=mObjs.map(m=>m.target),oldSize=[doc.w,doc.h],newSize=[nw,nh];
  const set=(sz,ts,ms,dir)=>{doc.w=sz[0];doc.h=sz[1];layers.forEach((L,i)=>{L.maps=Object.assign({},ts[i]);L.target=L.maps.base;});mObjs.forEach((m,i)=>m.target=ms[i]);
    for(const L of texts){L.text.x-=dir*x0;L.text.y-=dir*y0;}for(const L of grads)for(const k of ['a','b']){L.grad[k][0]-=dir*x0;L.grad[k][1]-=dir*y0;}
    allocAux();syncTargets();if(doc.anim){doc.anim.frames.forEach(frameDirty);showFrame(doc.anim.cur,true);}for(const L of texts)renderText(L);for(const L of grads)renderLiveGrad(L);fit();changedAll();updateStatus();};
  set(newSize,newT,newM,1);let usingNew=true;
  pushUndo({label:'Crop',refs:layers,undo(){usingNew=false;set(oldSize,oldT,oldM,-1);if(crop)cropStart();},redo(){usingNew=true;set(newSize,newT,newM,1);if(crop)cropStart();},
    drop(){const flat=a=>a.flatMap(m=>Object.values(m));(usingNew?[...flat(oldT),...oldM]:[...flat(newT),...newM]).forEach(disposeTarget);}});
  toast('Cropped to '+nw+' × '+nh+'.');}
