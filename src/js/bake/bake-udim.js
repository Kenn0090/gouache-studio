/* ================= UV tiles (UDIMs) in the Bake tab (0.97.32, Kenn: "we don't support UDIM baking") =================
   Kenn's answers: bake in the Bake tab, one picture per tile, every tile at the bake size, and the model shows every tile's bake
   at once with a tile list to flash a tile or re-bake just that one.
   A low-poly whose UVs reach into several tiles (1001, 1002, 1011…) is baked tile by tile: each tile's triangles are moved into
   0..1 and baked on their own at the full bake size (bk.ud.by[id] keeps each tile's maps). The view shows the model with its tiles
   side by side on one canvas (the plain grid, like 3D Paint), and a smaller copy of every tile's maps put together there (bk.res),
   so the 🔍 / C views and skew painting work on the whole model. Export writes Name_Normal.1001.png …; Send to 3D Paint puts
   each tile's maps into its place in the texture set. */
const bkUdC=new WeakMap();
function bkUdBox(L){if(!L||!L.uv||!L.idx||L.noUV)return null;if(L.whole&&L.whole!==L)return null;if(bkUdC.has(L))return bkUdC.get(L);
  const tiles=udimTilesOf(L,{start:0,count:L.idx.length/3});let B=null;
  if(tiles.length>1){let x0=1e9,y0=1e9,x1=-1,y1=-1;for(const t of tiles){x0=Math.min(x0,t.u);y0=Math.min(y0,t.v);x1=Math.max(x1,t.u);y1=Math.max(y1,t.v);}B={x0,y0,nx:x1-x0+1,ny:y1-y0+1,tiles};}
  bkUdC.set(L,B);return B;}
const bkUdOn=L=>bakeCfg.udim!==false&&!!bkUdBox(L);
/* a tile's box on the shown canvas (rows from the top, as in 3D Paint) */
function bkUdRect(B,T,w,h){const tw=w/B.nx,th=h/B.ny;return [Math.round((T.u-B.x0)*tw),Math.round((B.ny-1-(T.v-B.y0))*th),Math.round(tw),Math.round(th)];}
const bkUdLayR=(B,T)=>[(T.u-B.x0)/B.nx,(B.ny-1-(T.v-B.y0))/B.ny,1/B.nx,1/B.ny];
/* the shown model: its tiles side by side on one canvas */
const bkUdAt=new WeakMap();
function bkUdAtlas(m,B){let r=bkUdAt.get(m);if(r&&r.B===B)return r.m;const uv=new Float32Array(m.uv);
  for(let i=0;i<uv.length;i+=2){uv[i]=(uv[i]-B.x0)/B.nx;uv[i+1]=1-((1-uv[i+1])-B.y0)/B.ny;}
  const o=Object.assign({},m,{uv,bkUdAtlas:true,bgOf:m.bgOf||m});for(const k of Object.keys(o))if(k[0]==='_')delete o[k];bkUdAt.set(m,{B,m:o});return o;}
{const f=bgLowShown;bgLowShown=function(L){const m=f(L);if(!bkUdOn(L))return m;if(bgCfg().groupMode==='tree'&&typeof btColourOn==='function'&&btColourOn())return m;return bkUdAtlas(m,bkUdBox(L));};}
/* one tile's triangles, moved into 0..1 */
function bkUdSub(L,T){const n=L.idx.length/3,ix=L.idx,uv=L.uv,keep=[];
  for(let t=0;t<n;t++){const a=ix[t*3],b=ix[t*3+1],c=ix[t*3+2],q=udimAddr((uv[a*2]+uv[b*2]+uv[c*2])/3,(uv[a*2+1]+uv[b*2+1]+uv[c*2+1])/3);if(q&&q.id===T.id)keep.push(t);}
  const idx=new Uint32Array(keep.length*3),u2=new Float32Array(uv);for(let i=0;i<u2.length;i+=2){u2[i]-=T.u;u2[i+1]+=T.v;}
  const per=(a,w)=>{if(!a)return a;const o=new a.constructor(keep.length*w);keep.forEach((t,i)=>{for(let c=0;c<w;c++)o[i*w+c]=a[t*w+c];});return o;};
  keep.forEach((t,i)=>{idx[i*3]=ix[t*3];idx[i*3+1]=ix[t*3+1];idx[i*3+2]=ix[t*3+2];});
  const o=Object.assign({},L,{idx,uv:u2,tris:keep.length,triPart:per(L.triPart,1),triIdPart:per(L.triIdPart,1),triCol:per(L.triCol,3),triMat:per(L.triMat,1),whole:L,setRanges:null,udimTile:T.id});
  for(const k of Object.keys(o))if(k[0]==='_')delete o[k];return o;}
function bkUdFree(by){for(const id in by||{})for(const k in by[id].res)disposeTarget(by[id].res[k]);}
/* bake every ticked tile (or only some), then put the view together */
async function bkUdBake(L,ks,only){const B=bkUdBox(L),C=bakeCfg,skip=C.udSkip||{};
  const todo=B.tiles.filter(T=>only?only.includes(T.id):!skip[T.id]);if(!todo.length){toast('Every UV tile is left out. Tick at least one tile to bake.');return;}
  const same=bk.ud&&bk.ud.L===L;let by=same&&only?bk.ud.by:{};if(bk.ud&&!(same&&only))bkUdFree(bk.ud.by);
  for(const k in bk.res)disposeTarget(bk.res[k]);bk.res={};bk.byMat=null;bk.ud={L,B,by,busy:true};const t0=performance.now();let done=0,cancelled=false;
  try{for(let j=0;j<todo.length;j++){const T=todo[j];bk.udCur=T;bk.udInner=true;bk.res={};let r;
      try{r=await runBake(bkUdSub(L,T),ks,{quiet:true});}finally{bk.udInner=false;bk.udCur=null;bkUdSoftFree();}
      if(r==='cancelled'||!Object.keys(bk.res).length){cancelled=true;for(const k in bk.res)disposeTarget(bk.res[k]);bk.res={};break;}
      if(by[T.id])for(const k in by[T.id].res)disposeTarget(by[T.id].res[k]);by[T.id]={res:bk.res,kinds:bk.kinds,opts:bk.opts,src:bk.src};bk.res={};done++;
      if(todo.length>1)toast('Baked UV tile '+T.id+' ('+(j+1)+' of '+todo.length+').');}}
  finally{bk.ud.busy=false;}
  bkUdCompose();bakeSyncMesh();bakeRefresh();
  if(done)toast((cancelled?'Stopped after ':'Baked ')+done+' UV tile'+(done>1?'s':'')+' in '+((performance.now()-t0)/1000).toFixed(1)+' s.');else if(cancelled)toast('Bake cancelled.');
  if(done&&!cancelled&&!only&&bakeCfg.autoSend)bakeSend();}
/* the view's maps: every baked tile shrunk into its box on one canvas */
function bkUdCompose(){const U=bk.ud;if(!U)return;for(const k in bk.res)disposeTarget(bk.res[k]);const out={},kinds=new Set();let last=null;
  for(const T of U.B.tiles){const E=U.by[T.id];if(!E)continue;last=E;(E.kinds||[]).forEach(k=>kinds.add(k));
    for(const [k,src] of Object.entries(E.res)){if(!src||!src.tex)continue;let t=out[k];if(!t){t=out[k]=makeTarget(doc.w,doc.h,src.depth,false);clearTarget(t,k==='normal'?[.5,.5,1,1]:[0,0,0,0]);}
      const R=bkUdRect(U.B,T,t.w,t.h),sc=[src.w/R[2],src.h/R[3]];
      scissorDo(R,()=>run(P.resample,t,{uSrc:src.tex,uOffset:[R[0],R[1]],uScale:sc,uTaps:{int:Math.min(8,Math.max(1,Math.ceil(Math.max(...sc))))},uOutside:[0,0,0,0]}));}}
  bk.res=out;if(last){bk.kinds=[...kinds];bk.opts=last.opts;bk.src=last.src;}bk.dirty=true;v3.dirty=true;}
/* while a tile bakes, the painted skew / offset maps (drawn on the whole model) are cut down to that tile */
{const f=bakeSoftMap;bakeSoftMap=function(k){const T0=f(k);const T=bk.udCur,U=bk.ud;if(!T0||!T||!U)return T0;bk.udSoft=bk.udSoft||{};const c=bk.udSoft[k];if(c)return c;
  const R=bkUdRect(U.B,T,T0.w,T0.h),t=makeTarget(doc.w,doc.h,T0.depth,false),sc=[R[2]/doc.w,R[3]/doc.h];
  run(P.resample,t,{uSrc:T0.tex,uOffset:[-R[0]/sc[0],-R[1]/sc[1]],uScale:sc,uTaps:{int:1},uOutside:[.5,.5,.5,1]});return bk.udSoft[k]=t;};}
function bkUdSoftFree(){for(const k in bk.udSoft||{})disposeTarget(bk.udSoft[k]);bk.udSoft=null;}
/* the bake entry points: a tiled low-poly goes tile by tile */
{const f=runBake;runBake=async function(L,ks,opt){if(!bk.udInner&&L&&!L.udimTile&&bkUdOn(L)&&(!bk.ud||!bk.ud.busy))return bkUdBake(L,ks);return f.apply(this,arguments);};}
{const f=runBakeSets;runBakeSets=async function(L,ks){if(bkUdOn(L))return bkUdBake(L,ks);return f.apply(this,arguments);};}
/* no half-done preview while tiles bake (a tile's own 0..1 maps would cover the whole model) */
{const f=bakeShowPartial;bakeShowPartial=function(){if(bk.udInner)return;return f.apply(this,arguments);};}
/* painting skew / offset re-bakes the tiles under the paint */
{const f=bakeRegion;bakeRegion=async function(rect){const U=bk.ud;if(!U||bk.udInner)return f.apply(this,arguments);if(U.busy||bk.busy)return;
  const ids=U.B.tiles.filter(T=>{const R=bkUdRect(U.B,T,doc.w,doc.h);return U.by[T.id]&&rect[0]<R[0]+R[2]&&rect[0]+rect[2]>R[0]&&rect[1]<R[1]+R[3]&&rect[1]+rect[3]>R[1];}).map(T=>T.id);
  clearTimeout(bk.udRegT);if(ids.length)bk.udRegT=setTimeout(()=>{const ks=[...new Set(ids.flatMap(id=>U.by[id].kinds||[]))];bkUdBake(U.L,ks,ids);},500);};}
{const f=bakeReset;bakeReset=function(){if(bk.ud){bkUdFree(bk.ud.by);bk.ud=null;}return f.apply(this,arguments);};}
/* export: one picture per tile and map */
{const f=bakeExport;bakeExport=async function(){const U=bk.ud;if(!U||!Object.keys(U.by).length)return f.apply(this,arguments);
  const ks=bakeSendSelected();if(!ks.length){toast('Tick at least one map to export.');return;}
  let dir=null;if(platform.isDesktop){dir=await platform.pickFolder();if(!dir)return;}
  const base=pascal(((U.L&&U.L.name)||'Bake').replace(/\.[a-z0-9]+$/i,'').replace(/[_\-\s]*(low|lo|lp)(poly)?$/i,''))||'Bake';
  const fileOf={normal:'Normal',height:'Height',ao:'AO',curv:'Curvature',curvEdge:'CurvatureEdges',curvCrease:'CurvatureCreases',thick:'Thickness',wnormal:'WorldNormal',position:'Position',id:'ID',light:'Lighting'};
  loadStart('Exporting baked maps');try{const files=[],ids=Object.keys(U.by).map(Number).sort((a,b)=>a-b),n=ids.length*ks.length;let i=0;
    for(const id of ids)for(const k of ks){const t=U.by[id].res[k];if(!t)continue;loadSet(i++/n,'Tile '+id+': '+BAKE_NAMES[k]+'…');await loadPaint();
      const col=k==='normal'||k==='wnormal'||k==='position'||k==='id'||k==='light',Cn=col?3:1,W=t.w,H=t.h;let fl=readMapF(t,col?4:1);if(Cn===3)fl=dropAlpha(fl,W*H);
      const blob=await encodeTex(W,H,fl,Cn,'png',(k==='height'||k==='normal')&&canFloat?16:8);files.push({name:base+'_'+(fileOf[k]||k)+'.'+id+'.png',data:new Uint8Array(await blob.arrayBuffer())});}
    if(dir){const sep=dir.includes('\\')?'\\':'/';for(const fl of files)await platform.writeFile(dir.replace(/[\\/]$/,'')+sep+fl.name,fl.data);toast('Saved '+files.length+' baked tile pictures to '+dir);}
    else{const r=await deliver(base+'_bake.zip',await makeZipMulti(files));toast(deliveredText(r,'Baked UV tiles'));}
    return files;}
  catch(e){console.error(e);toast('Export failed: '+(e.message||e));}finally{loadEnd();}};}
/* Send to 3D Paint: every tile's maps go into their place in the texture set (UV tiles set up there if needed) */
{const f=bakeSendP3;bakeSendP3=function(){const U=bk.ud;if(!U||!Object.keys(U.by).length)return f.apply(this,arguments);const ks=bakeSendSelected();if(!ks.length){toast('Tick at least one map to send.');return;}
  /* copies: 3D Paint may resize its set for the tiles, and a resize clears the Bake tab's results */
  const tiles={},own=[];for(const id in U.by){tiles[id]={};for(const k of ks){const t=U.by[id].res[k];if(!t||!t.tex)continue;const c=makeTarget(t.w,t.h,t.depth,false);blit(t,c,0,0,t.w,t.h,0,0);tiles[id][k]=c;own.push(c);}}
  try{p3ReceiveBake(U.L,{'*':{__tiles:tiles}},ks,!!bakeCfg.p3Layers);}finally{own.forEach(disposeTarget);}};}
{const f=p3ReceiveBake;p3ReceiveBake=function(mesh,by,ks,asLayers){const m=mesh&&mesh.udimAtlas?mesh.udimOf:mesh;
  if(by&&by['*']&&by['*'].__tiles&&m&&!p3.ua&&bkUdBox(m)){if(ui.mode!=='p3d'&&!setMode('p3d',true))return;p3.ua=udimLayout(m);p3.udim=false;v3.imported=p3.imported=m;v3s().model='imported';v3.mesh=null;v3LoadModel(true);if(typeof p3SyncSets==='function')p3SyncSets();/* the set's canvas grows to hold its tiles BEFORE the maps arrive */}
  return f.call(this,mesh,by,ks,asLayers);};}
{const f=p3ApplyBake;p3ApplyBake=function(res,ks,asLayers){if(!res||!res.__tiles)return f.apply(this,arguments);const S=p3.sets[p3.cur],name=S&&p3Binding(S),B=name&&udimBox(name),out={};
  for(const k of ks){let t=null;for(const [id,r] of Object.entries(res.__tiles)){const src=r[k];if(!src||!src.tex)continue;const T=B?B.tiles.find(x=>x.id===+id):(+id===1001?{id:1001,u:0,v:0}:null);if(!T)continue;
      if(!t){t=makeTarget(doc.w,doc.h,src.depth,false);clearTarget(t,k==='normal'?[.5,.5,1,1]:[0,0,0,0]);}const R=B?udimTileRect(name,T,doc.w,doc.h):[0,0,doc.w,doc.h],sc=[src.w/R[2],src.h/R[3]];
      scissorDo(R,()=>run(P.resample,t,{uSrc:src.tex,uOffset:[R[0],R[1]],uScale:sc,uTaps:{int:Math.min(8,Math.max(1,Math.ceil(Math.max(...sc))))},uOutside:[0,0,0,0]}));}
    if(t)out[k]=t;}
  try{return f.call(this,out,ks,asLayers);}finally{for(const k in out)disposeTarget(out[k]);}};}
/* the tile list in the Bake panel */
function bkUdCard(){const L=bkLow(),B=bkUdBox(L);if(!B)return null;const C=bakeCfg,on=C.udim!==false,skip=C.udSkip||(C.udSkip={}),U=bk.ud&&bk.ud.L===L?bk.ud:null;
  const kf=n=>n>=1024?(Math.round(n/102.4)/10)+'K':String(n);
  const head=el('div',{class:'bkudhead'},el('span',{class:'bkudttl',text:'UV tiles (UDIMs) · '+B.tiles.length}),chk('bkUdimOn','Bake each tile on its own',on,v=>{C.udim=v;bakeSyncMesh();bk.dirty=true;v3.dirty=true;requestRender(true);buildBakePanel();}));
  if(!on)return el('div',{class:'bkud',id:'bkUdim'},head,el('p',{class:'note',text:'Off: the whole low-poly bakes into one 0–1 square, so its tiles land on top of each other.'}));
  const grid=el('div',{class:'bkudgrid'},...B.tiles.map(T=>{const done=!!(U&&U.by[T.id]),left=!!skip[T.id];
    return el('span',{class:'bkudt'+(left?' off':'')+(done?' done':''),'data-tile':String(T.id)},
      el('input',{type:'checkbox',id:'bkUdT_'+T.id,checked:!left,title:left?'Left out of the bake':'Will be baked','aria-label':'Bake UV tile '+T.id,onchange:e=>{skip[T.id]=!e.target.checked;buildBakePanel();}}),
      el('button',{type:'button',class:'bkudid',text:String(T.id),title:'Show tile '+T.id+' on the model',onclick:()=>bkUdFlash(T)}),
      el('span',{class:'bkudst',text:done?'✓':'',title:done?'Baked':'Not baked yet'}),
      el('button',{type:'button',class:'btn sm bkudre',id:'bkUdRe_'+T.id,text:'↻',disabled:!(U&&U.by[T.id]&&!bk.busy),title:'Bake this tile again',onclick:()=>{const ks=Object.keys(C.kinds).filter(k=>C.kinds[k]);if(!ks.length){toast('Pick at least one map.');return;}bkUdBake(L,ks,[T.id]);}}));}));
  return el('div',{class:'bkud',id:'bkUdim'},head,grid,el('p',{class:'note',text:'Each tile bakes at the bake size ('+kf(C.size||doc.w)+' each). Export writes one picture per tile (Name_Normal.1001.png …); Send to 3D Paint puts each tile in its place.'}));}
function bkUdFlash(T){const L=bkLow(),B=bkUdBox(L);if(!B)return;if(typeof udimFlashS==='undefined')return;udimFlashS.on=true;udimFlashS.r=bkUdLayR(B,T);udimFlashS.t0=performance.now();udimFlashS.id=T.id;v3.dirty=true;requestRender();}
{const f=buildBakePanel;buildBakePanel=function(){const r=f.apply(this,arguments);try{const card=bkUdCard();const w=document.getElementById('btWide');if(card&&w)w.after(card);}catch(e){console.warn('UV tiles card',e);}return r;};}
