/* ================= Bake tab =================
   The Bake workspace: settings on the right, the model large in the 3D view, the baked map on
   the canvas. Bakes stay here (shown on the model as they fill in) until they are sent to the
   document, by hand or automatically.
   Fixing a bake: two maps painted on the low-poly steer the rays pixel by pixel.
   - Skew: white keeps the averaged ray direction (no gaps at hard edges); black shoots the rays
     straight out of each face, which stops floating details (screws, panel lines) from leaning.
   - Offset: grey keeps Front and Back; lighter reaches further, darker less far.
   After each stroke the quick maps (normal, height, position…) are re-baked where you painted. */
const bk={res:{},acc:{},opts:null,kinds:[],src:null,hg:null,hgKey:null,show:'material',paint:null,maps:{skew:null,offset:null},L:{},busy:false,prog:null,
  stale:new Set(),showCage:true,cageGPU:null,cageKey:null,region:null,regionBusy:false,prev3d:null,view2d:null,tint:null,grey:null,dirty:true,sentLayers:[],docBase:false};
const BK_PAINT={skew:{name:'Skew',fill:[1,1,1,1],erase:[1,1,1]},offset:{name:'Offset',fill:[.5,.5,.5,1],erase:[.5,.5,.5]}};
const BK_EMPTY={normal:[.5,.5,1,1],height:[.5,.5,.5,1],ao:[1,1,1,1],thick:[1,1,1,1]};
const bkLow=()=>bakeCfg.low||bakeViewModel();

/* ---------- workspace ---------- */
/* the Bake tab's canvas size: Size in the General tab, or the painting's */
function bakeSize(){const ps=paintDocSize(),s=bakeCfg.size;return s?[s,s]:ps;}
function bakeEnter(){const bs=bakeSize();tabDocEnter('bake',bs[0],bs[1],'Bake');if(!canFloat)toast('Baking needs 16-bit float support, which this graphics card lacks.');
  if(!['brush','erase','picker','hand'].includes(ui.tool))setTool('brush');
  const work=$('#work');bk.prev3d={on:v3.on,w:getComputedStyle(work).getPropertyValue('--pane3d')};
  if(!v3.on)toggle3D(true);if(!v3.pop){work.style.setProperty('--pane3d',Math.round(work.clientWidth*.58)+'px');}
  if(bk.paint)v3.paintOn=true;
  bakeSyncMesh();buildBakePanel();build3dPane();bk.dirty=true;v3.mapsDirty=true;v3.dirty=true;resizeGL();fit();requestRender(true);}
function bakeExit(){tabDocExit('bake');const p=bk.prev3d;bk.prev3d=null;v3.btex=null;
  if(p&&!p.on)toggle3D(false);else if(p&&!v3.pop){$('#work').style.setProperty('--pane3d',p.w||'0px');}
  /* back to the model the 3D view had (even when it closes: Convert and Paint reopen it) */
  if(v3.on||v3.mesh===bakeCfg.low)v3LoadModel(true);if(v3.on)build3dPane();v3.mapsDirty=true;v3.dirty=true;resizeGL();fit();requestRender(true);}
/* the 3D view shows the model being baked onto */
function bakeSyncMesh(){if(ui.mode!=='bake'||!v3.on)return;const C=bakeCfg,was=v3.mesh;if(C.low){if(v3.mesh!==C.low)v3SetMesh(C.low);}else v3LoadModel(true);if(v3.mesh!==was&&v3.on)build3dPane();v3.dirty=true;}
function bakeReset(){for(const k in bk.res)disposeTarget(bk.res[k]);for(const k in bk.acc)disposeTarget(bk.acc[k]);bk.res={};bk.acc={};bk.opts=null;bk.src=null;bk.kinds=[];
  if(bk.hg){bkFreeHigh(bk.hg);bk.hg=null;bk.hgKey=null;}for(const k in bk.maps)if(bk.maps[k]){disposeTarget(bk.maps[k]);bk.maps[k]=null;}bk.L={};bk.stale.clear();bk.sentLayers=[];bk.dirty=true;}

/* ---------- the maps you paint to fix the bake ---------- */
function bakeMapT(k,create){let t=bk.maps[k];if(t&&(t.w!==doc.w||t.h!==doc.h)){disposeTarget(t);t=bk.maps[k]=null;}
  if(!t&&create){t=bk.maps[k]=makeTarget(doc.w,doc.h,8,false);clearTarget(t,BK_PAINT[k].fill);}return t;}
function bakeMapL(k){const T=bakeMapT(k,true);let L=bk.L[k];if(!L||L.target!==T)L=bk.L[k]={target:T,lockAlpha:false,bakeMap:k,
    onRecord(r,rect){const u=r.undo,re=r.redo;r.undo=function(){u.call(this);bakeMapEdited(rect);};r.redo=function(){re.call(this);bakeMapEdited(rect);};bakeMapEdited(rect);}};return L;}
/* what painting in the Bake tab paints on (false: nothing, with a message already shown) */
/* the grey the brush paints skew or offset fixes with (the Bake tab has no colour panel) */
function bakePaintColor(){const val=bk.val||(bk.val={skew:0,offset:.85}),v=val[bk.paint]==null?0:val[bk.paint];return [v,v,v];}
function bakeEditTarget(){if(!bk.paint){toast('Pick Skew or Offset under “Fix the bake” to paint fixes.');return false;}if(bk.busy){toast('Wait for the bake to finish.');return false;}
  const L=bakeMapL(bk.paint);useAux(8);return {node:null,target:L.target,isMask:true,erase:BK_PAINT[bk.paint].erase,L};}
function bakeMapEdited(rect){bk.dirty=true;bk.offVer=(bk.offVer||0)+1;bk.cageKey=null;v3.dirty=true;requestRender();bakeRegion(rect);}
function bakeClearMap(k){const T=bakeMapT(k);if(!T)return;const before=captureRegionNow(T,0,0,doc.w,doc.h);clearTarget(T,BK_PAINT[k].fill);const after=captureRegionNow(T,0,0,doc.w,doc.h);
  const L=bakeMapL(k),r=regionRecord(L,before,after,0,0,doc.w,doc.h,'Clear '+BK_PAINT[k].name.toLowerCase());L.onRecord(r,[0,0,doc.w,doc.h]);pushUndo(r);toast(BK_PAINT[k].name+' map cleared.');}

/* ---------- baking ---------- */
function bakePrep(L){const C=bakeCfg;const high=C.high?bakeAlign(C.high,L):null,cage=C.cage?bakeAlign(C.cage,L).pos:null;let low=Object.assign({},L);
  if(C.match&&high){const names=(L.partNames||['default']).map(partBase),ix=new Map(names.map((n,i)=>[n,i]));
    low.vertPart=new Float32Array(L.verts);(L.triPart||new Uint32Array(L.tris)).forEach((p,t)=>{for(let k=0;k<3;k++)low.vertPart[L.idx[t*3+k]]=p;});
    const hn=(high.partNames||['default']).map(n=>ix.has(partBase(n))?ix.get(partBase(n)):9999);high.bakePart=new Float32Array((high.triPart||new Uint32Array(high.tris)).length);(high.triPart||[]).forEach((p,t)=>{high.bakePart[t]=hn[p];});}
  return {low,high,cage};}
/* the high-poly's search tree, kept between bakes of the same models */
async function bakeHG(L,high,low,step,needCol){const key=[bakeCfg.high,L.whole||L,!!(bakeCfg.match&&high)],same=k=>k&&k[0]===key[0]&&k[1]===key[1]&&k[2]===key[2];
  if(bk.hgBuild){const b=bk.hgBuild;try{await b.p;}catch(e){}if(bk.hgBuild===b)bk.hgBuild=null;}
  if(bk.hg&&same(bk.hgKey)&&(!needCol||bk.hg.hasCol))return bk.hg;if(bk.hg){bkFreeHigh(bk.hg);bk.hg=null;bk.hgKey=null;}
  const b={p:bkHighGPU(high||low,step,needCol)};bk.hgBuild=b;try{bk.hg=await b.p;}finally{if(bk.hgBuild===b)bk.hgBuild=null;}bk.hgKey=key;return bk.hg;}
/* where curvature comes from: the shape (default), the baked normal, or the document's normal map */
function bakeCurvSrc(high){const v=bakeCfg.curvSrc||'mesh';if(v==='normal'&&!high)return 'mesh';if(v==='doc'&&!doc.maps.includes('normal'))return 'mesh';return v;}
function bakeKinds(ks,high){const kinds=ks.filter(k=>k!=='curv');if(ks.includes('curv')){const src=bakeCurvSrc(high);if(src==='mesh')kinds.push(...(high?['cpos','cnrm']:['mcurv']));else if(src==='normal'&&!kinds.includes('normal'))kinds.push('normal');}return kinds;}
/* full bake of maps ks from low-poly L */
async function runBake(L,ks,opt){opt=opt||{};const C=bakeCfg;if(bk.busy)return;if(!canFloat){toast('Baking needs 16-bit float support, which this graphics card lacks.');return;}
  if(L.noUV){toast('The low-poly has no UVs: nothing can be baked onto it.');return;}
  if(C.cage&&(C.cage.verts!==L.verts||C.cage.tris!==(L.whole||L).tris)){toast('The cage does not match the low-poly.');return;}
  const {low,high,cage}=bakePrep(L);
  if(!high){const skip=ks.filter(k=>k==='normal'||k==='height');if(skip.length)toast('Without a high-poly, '+skip.map(k=>BAKE_NAMES[k].toLowerCase()).join(' and ')+' would be flat, so '+(skip.length>1?'they are':'it is')+' skipped.');ks=ks.filter(k=>k!=='normal'&&k!=='height');if(!ks.length)return;}
  if(ks.includes('curv')&&bakeCfg.curvSrc!==bakeCurvSrc(high))toast(bakeCfg.curvSrc==='normal'?'Curvature from the baked normal needs a high-poly, so it comes from the shape instead.':'The document has no normal map, so curvature comes from the shape instead.');
  const kinds=bakeKinds(ks,high),inTab=ui.mode==='bake';bk.curvSrc=bakeCurvSrc(high);
  const prog={cancelled:false,f:0,msg:'Preparing…',set(f){this.f=f;bakeProgUI();},step(t){this.msg=t;bakeProgUI();}};
  let dlgBar=null;if(!inTab){dlgBar=el('div',{class:'bakebar'},el('div'));const msg=el('p',{class:'note',text:'Preparing…'});prog.set=f=>{dlgBar.firstChild.style.width=(f*100).toFixed(1)+'%';};prog.step=t=>{msg.textContent=t;};
    openDialog({title:'Baking…',body:el('div',{class:'dlg-grid'},msg,dlgBar),okLabel:null,cancelLabel:'Cancel',onCancel(){prog.cancelled=true;}});}
  bk.busy=true;bk.prog=prog;bk.tiles=0;bakeProgUI();bakeSyncMesh();const t0=performance.now();await tick();
  /* start from a clean slate: the model fills in as tiles finish */
  for(const k in bk.res)disposeTarget(bk.res[k]);for(const k in bk.acc)disposeTarget(bk.acc[k]);bk.res={};bk.acc={};bk.stale.clear();bk.dirty=true;
  const o={size:doc.w,sizeH:doc.h,ss:C.ss,front:C.front*.02,back:C.back*.02,average:C.average,cage,match:C.match&&!!high,kinds,
    rays:C.rays,aoDist:C.aoDist*.02,thickDist:C.thickDist*.02,pad:C.pad,dx:false,seed:Math.random()*10,aoSpread:C.aoSpread,thickRays:C.thickRays,curvRadius:C.curvRadius,curvStr:C.curvStr};
  let res=null;
  try{prog.step('Baking '+ks.map(k=>BAKE_NAMES[k].toLowerCase()).join(', ')+'…');
    const hg=await bakeHG(L,high,low,t=>prog.step(t),kinds.includes('id'));
    res=await bakeRun(low,high,Object.assign({},o,{hg,acc:bk.acc,skew:bk.maps.skew,offset:bk.maps.offset,onTile:(acc,kk)=>bakeShowPartial(acc,kk)}),prog);}
  catch(e){console.error(e);bk.busy=false;bk.prog=null;if(!inTab)closeDialog();bakeProgUI();toast('The bake failed: '+(e.message||e));return;}
  bk.busy=false;bk.prog=null;if(!inTab)closeDialog();
  if(!res){for(const k in bk.acc)disposeTarget(bk.acc[k]);bk.acc={};for(const k in bk.res)disposeTarget(bk.res[k]);bk.res={};bk.opts=null;bakeProgUI();bakeRefresh();toast('Bake cancelled.');return 'cancelled';}
  for(const k in bk.res)disposeTarget(bk.res[k]);bk.res=res;bk.kinds=ks;bk.opts=o;bk.src={L,low,high};bakeDerive();
  if(!ks.includes(bk.show)&&bk.show!=='material'&&!BK_PAINT[bk.show])bk.show='material';
  bakeRefresh();if(!opt.quiet)toast('Baked '+ks.length+' map'+(ks.length>1?'s':'')+' in '+((performance.now()-t0)/1000).toFixed(1)+' s.');
  if(!opt.quiet&&(C.autoSend||!inTab))bakeSend();
  if(bk.region){const r=bk.region;bk.region=null;bakeRegion(r);}}
/* curvature: from the shape (gcurv), the baked normal or the document's normal map; then edges and creases
   are weighted and, if asked, split into their own maps (white = strong) */
const FS_BKCURV=`uniform sampler2D uSrc; uniform float uEdges; uniform float uCreases; uniform int uMode; uniform float uStr;
void main(){ vec4 s=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); float c=(s.r-0.5)*2.0*uStr; c=c>0.0?c*uEdges:c*uCreases;
  float v=uMode==1?clamp(c,0.0,1.0):uMode==2?clamp(-c,0.0,1.0):clamp(0.5+c*0.5,0.0,1.0); o=vec4(vec3(v),1.0); }`;
let bkCurvP=null;
function bakeDerive(){const r=bk.res,C=bakeCfg;for(const k of ['curv','curvEdge','curvCrease','mcurv'])if(r[k]&&k!=='mcurv'){disposeTarget(r[k]);delete r[k];}
  if(!bk.kinds.includes('curv')){if(r.gcurv){disposeTarget(r.gcurv);delete r.gcurv;}return;}
  let raw=null,str=1;
  if(r.gcurv){raw=r.gcurv;delete r.gcurv;}
  else if(r.mcurv){raw=r.mcurv;delete r.mcurv;str=C.curvStr||1;}/* the low-poly on its own: measured at its corners */
  else{const fromDoc=bk.curvSrc==='doc'&&doc.maps.includes('normal'),n=fromDoc?normalComposite(false,null):r.normal;if(!n)return;
    raw=makeTarget(doc.w,doc.h,16,false);const b=acquireD(n.depth),rad=Math.max(1,C.curvRadius||3);gaussian(n,b,Math.max(.8,rad*.35));
    run(P.f_ncurv,raw,{uN:b.tex,uWrap:!!doc.wrap,uStr:1.2*(C.curvStr||1),uMode:{int:0},uStep:rad,uFlipG:!!C.curvFlip});release(b);if(fromDoc)release(n);}
  if(!bkCurvP)bkCurvP=program(FS_BKCURV);const out=m=>{const t=makeTarget(doc.w,doc.h,doc.depth,false);run(bkCurvP,t,{uSrc:raw.tex,uEdges:C.curvEdges==null?1:C.curvEdges,uCreases:C.curvCreases==null?1:C.curvCreases,uMode:{int:m},uStr:str});return t;};
  r.curv=out(0);if(C.curvParts!==false){r.curvEdge=out(1);r.curvCrease=out(2);}disposeTarget(raw);}
/* while baking: what is done so far, shown straight away */
function bakeShowPartial(acc,kinds){const P=bkPrograms();bk.tiles=(bk.tiles||0)+1;for(const k of kinds){const kk=k==='mcurv'?'curv':k;let t=bk.res[kk];
    if(!t){t=bk.res[kk]=makeTarget(doc.w,doc.h,16,false);}run(P.fin,t,{uSrc:acc[k].tex,uEmpty:BK_EMPTY[k]||[0,0,0,1]});}
  bk.dirty=true;v3.dirty=true;requestRender();}
/* after a fix is painted: re-bake the quick maps where it changed */
async function bakeRegion(rect){if(!bk.opts||!bk.src)return;const r=[Math.max(0,rect[0]-2),Math.max(0,rect[1]-2),Math.min(doc.w,rect[0]+rect[2]+2),Math.min(doc.h,rect[1]+rect[3]+2)];
  if(bk.busy||bk.regionBusy){bk.region=bk.region?[Math.min(bk.region[0],rect[0]),Math.min(bk.region[1],rect[1]),Math.max(bk.region[0]+bk.region[2],rect[0]+rect[2])-Math.min(bk.region[0],rect[0]),Math.max(bk.region[1]+bk.region[3],rect[1]+rect[3])-Math.min(bk.region[1],rect[1])]:rect.slice();return;}
  const quick=bk.opts.kinds.filter(k=>k!=='ao'&&k!=='thick');for(const k of bk.opts.kinds)if(k==='ao'||k==='thick')bk.stale.add(k);
  if(!quick.length){buildBakePanel();return;}
  bk.regionBusy=true;bakeProgUI();const S=bk.src,prog={cancelled:false,set(){},step(){}};
  try{const hg=await bakeHG(S.L,S.high,S.low,()=>{},quick.includes('id'));
    const res=await bakeRun(S.low,S.high,Object.assign({},bk.opts,{kinds:quick,hg,acc:bk.acc,rect:r,skew:bk.maps.skew,offset:bk.maps.offset}),prog);
    if(res){for(const k in res){if(bk.res[k])disposeTarget(bk.res[k]);bk.res[k]=res[k];}if(bk.kinds.includes('curv')&&(res.gcurv||res.normal))bakeDerive();}}
  catch(e){console.error(e);}
  bk.regionBusy=false;bakeRefresh();
  if(bk.region){const q=bk.region;bk.region=null;bakeRegion(q);}}
/* baked maps -> layers (replacing the ones sent before, if asked) */
/* Send to the painting: the ticked maps, as plain layers (no folders), scaled to the painting's size when it differs.
   As layers (the default) every grey or colour result is also in the base colour, so bakes blend with each other there
   (curvature on Overlay over AO…), and AO, curvature and height are in their own maps too. Maps only: each in its own map. */
const BK_SEND_ORDER=['normal','height','ao','curv','curvEdge','curvCrease','thick','wnormal','position','id'];
/* ---- one bake per material (texture set): the low-poly's triangles of that material, the same vertices ---- */
function meshSubset(L,k){const T=L.idx.length/3,M=L.triMat,keep=[];for(let t=0;t<T;t++)if(!M||M[t]===k)keep.push(t);
  const idx=new Uint32Array(keep.length*3),per=(a,w)=>{if(!a)return a;const o=new a.constructor(keep.length*w);keep.forEach((t,i)=>{for(let c=0;c<w;c++)o[i*w+c]=a[t*w+c];});return o;};
  keep.forEach((t,i)=>{idx[i*3]=L.idx[t*3];idx[i*3+1]=L.idx[t*3+1];idx[i*3+2]=L.idx[t*3+2];});
  return Object.assign({},L,{idx,tris:keep.length,triPart:per(L.triPart,1),triCol:per(L.triCol,3),triMat:per(L.triMat,1),whole:L,setRanges:null,_topo:null});}
const bkMats=L=>(L&&L.matNames&&L.matNames.length>1&&L.triMat)?L.matNames:null;
async function runBakeSets(L,ks){const names=bkMats(L);if(!names){bk.byMat=null;return runBake(L,ks);}
  for(const n in bk.byMat||{})if(n!==bk.matShow)for(const k in bk.byMat[n].res)disposeTarget(bk.byMat[n].res[k]);bk.byMat={};const t0=performance.now();
  for(let i=0;i<names.length;i++){bk.res={};const r=await runBake(meshSubset(L,i),ks,{quiet:true});if(r==='cancelled'||!Object.keys(bk.res).length){bk.byMat=null;return;}
    bk.byMat[names[i]]={res:bk.res,kinds:bk.kinds,opts:bk.opts,src:bk.src};toast('Baked “'+names[i]+'” ('+(i+1)+' of '+names.length+').');}
  bk.matShow=null;bakeShowMat(names[0]);toast('Baked '+names.length+' materials in '+((performance.now()-t0)/1000).toFixed(1)+' s.');if(bakeCfg.autoSend)bakeSend();}
/* which material's results are shown (and sent to Paint, exported, fixed) */
function bakeShowMat(n){const B=bk.byMat;if(!B||!B[n])return;if(bk.matShow&&B[bk.matShow])Object.assign(B[bk.matShow],{res:bk.res,kinds:bk.kinds,opts:bk.opts,src:bk.src});
  const E=B[n];bk.res=E.res;bk.kinds=E.kinds;bk.opts=E.opts;bk.src=E.src;bk.matShow=n;bakeRefresh();}
/* Send to 3D Paint: the low-poly and the ticked maps, each material's to its own texture set */
function bakeSendP3(){if(!Object.keys(bk.res).length){toast('Bake first.');return;}const tick=bakeCfg.send||{},ks=bakeSendable().filter(k=>tick[k]!==false&&!(tick[k]===undefined&&(k==='curvEdge'||k==='curvCrease')));
  if(!ks.length){toast('Tick at least one map to send.');return;}
  if(bk.byMat&&bk.matShow)Object.assign(bk.byMat[bk.matShow],{res:bk.res});
  const L=bk.src&&bk.src.L?(bk.src.L.whole||bk.src.L):bkLow(),by={};if(bk.byMat)for(const n in bk.byMat)by[n]=bk.byMat[n].res;else by['*']=bk.res;
  p3ReceiveBake(L,by,ks,!!bakeCfg.p3Layers);}
function bakeSendable(){const res=bk.res,ks=bk.kinds;return BK_SEND_ORDER.filter(k=>res[k]&&(k==='curvEdge'||k==='curvCrease'?ks.includes('curv'):ks.includes(k)));}
function bakeSend(){const res=bk.res;if(!Object.keys(res).length){toast('Bake first.');return;}const asLayers=bakeCfg.sendAs!=='maps',tick=bakeCfg.send||{};
  const ks=bakeSendable().filter(k=>tick[k]!==false&&!(tick[k]===undefined&&(k==='curvEdge'||k==='curvCrease')));if(!ks.length){toast('Tick at least one map to send.');return;}
  const own={normal:'normal',height:'height',ao:'ao',curv:'curv'},inBase=k=>asLayers||!own[k],hiddenK=k=>!own[k]||(k==='height'&&asLayers&&false);
  let n=0,replaced=false;
  withPaintDoc(()=>{const need=ks.map(k=>own[k]).filter(Boolean).filter(m=>!doc.maps.includes(m));if(need.length)setDocMaps([...doc.maps,...need],'Add maps for the bake');
    const mk=k=>{const name=k==='curvEdge'||k==='curvCrease'?BAKE_NAMES[k]:k==='thick'||k==='wnormal'||k==='position'||k==='id'?BAKE_NAMES[k]:'Baked '+(k==='ao'?'AO':BAKE_NAMES[k].toLowerCase());
      const L=newLayerObj(name),m=own[k]||'base';for(const x of Object.keys(L.maps))if(x!=='base'&&x!==m){disposeTarget(L.maps[x]);delete L.maps[x];}
      copyScaled(res[k],ensureMapTarget(L,m));if(m!=='base'){if(inBase(k)&&k!=='normal')copyScaled(res[k],ensureMapTarget(L,'base'));else L.blankBase=true;setMapModeOf(L,m,0);}
      L.baked=true;if(hiddenK(k))L.visible=false;return L;};
    const old=bakeCfg.replace?bk.sentLayers.filter(x=>x.parent&&allNodes().includes(x)):[];replaced=old.length>0;
    structOp(old.length?'Replace baked layers':'Bake',()=>{for(const x of old)detachNode(x);const Ls=ks.map(mk);for(const L of Ls)insertNode(L,doc.root);bk.sentLayers=Ls;n=Ls.length;
      if(ui.mode!=='bake'){const vis=Ls.filter(L=>L.visible);const last=vis[vis.length-1]||Ls[Ls.length-1];if(last)selectOnly(last);}});
    syncTargets();changedAll();refreshMapsUI();});
  if(typeof v3Changed==='function')v3Changed();
  if(ui.mode==='bake')toast((replaced?'Replaced the baked layers':'Sent '+n+' baked map'+(n>1?'s':'')+' to the painting')+(asLayers?', as layers you can blend.':'.'));}
/* Export: the ticked maps straight to image files (a folder on the desktop, a zip in the browser) */
async function bakeExport(){const tick=bakeCfg.send||{},ks=bakeSendable().filter(k=>tick[k]!==false&&!(tick[k]===undefined&&(k==='curvEdge'||k==='curvCrease')));
  if(!ks.length){toast(Object.keys(bk.res).length?'Tick at least one map to export.':'Bake first.');return;}
  let dir=null;if(platform.isDesktop){dir=await platform.pickFolder();if(!dir)return;}
  const base=pascal(((bk.src&&bk.src.L&&bk.src.L.name)||'Bake').replace(/[_\-\s]*(low|lo|lp)(poly)?$/i,''))||'Bake',W=doc.w,H=doc.h;
  const fileOf={normal:'Normal',height:'Height',ao:'AO',curv:'Curvature',curvEdge:'CurvatureEdges',curvCrease:'CurvatureCreases',thick:'Thickness',wnormal:'WorldNormal',position:'Position',id:'ID'};
  loadStart('Exporting baked maps');try{const files=[];let i=0;
    for(const k of ks){loadSet(i++/ks.length,BAKE_NAMES[k]+'…');await loadPaint();const col=k==='normal'||k==='wnormal'||k==='position'||k==='id',C=col?3:1;let f=readMapF(bk.res[k],col?4:1);if(C===3)f=dropAlpha(f,W*H);
      const blob=await encodeTex(W,H,f,C,'png',k==='height'&&canFloat?16:8);files.push({name:base+'_'+fileOf[k]+'.png',data:new Uint8Array(await blob.arrayBuffer())});}
    if(dir){const sep=dir.includes('\\')?'\\':'/';for(const f of files)await platform.writeFile(dir.replace(/[\\/]$/,'')+sep+f.name,f.data);toast('Saved '+files.length+' baked map'+(files.length>1?'s':'')+' to '+dir);}
    else{const r=await deliver(base+'_bake.zip',await makeZipMulti(files));toast(deliveredText(r,'Baked maps'));}}
  catch(e){console.error(e);toast('Export failed: '+(e.message||e));}finally{loadEnd();}}

/* estimate offset: bake height with a long reach, then set each pixel's reach to what it needed */
const FS_BKEST=`uniform sampler2D uH; uniform float uRange; uniform float uFront; uniform float uBack;
void main(){ vec4 h=texelFetch(uH,ivec2(gl_FragCoord.xy),0); float d=(h.r-0.5)*2.0*uRange; float need=d>0.0?d/max(uFront,1e-6):-d/max(uBack,1e-6);
  float v=clamp(need*1.25*0.5,0.04,1.0); if(abs(h.r-0.5)<1e-4) v=0.5; o=vec4(v,v,v,1.0); }`;
let bkEstP=null;
async function bakeEstimateOffset(){if(bk.busy)return;const C=bakeCfg;if(!C.high){toast('Estimating the offset needs a high-poly.');return;}const L=bkLow();if(L.noUV){toast('The low-poly has no UVs.');return;}
  const {low,high,cage}=bakePrep(L);const reach=4,f=C.front*.02,b=C.back*.02;
  const prog={cancelled:false,f:0,msg:'Estimating the offset…',set(x){this.f=x;bakeProgUI();},step(t){this.msg=t;bakeProgUI();}};bk.busy=true;bk.prog=prog;bakeProgUI();await tick();
  try{const hg=await bakeHG(L,high,low,t=>prog.step(t));
    const res=await bakeRun(low,high,{size:doc.w,sizeH:doc.h,ss:1,front:f*reach,back:b*reach,average:C.average,cage,match:C.match,kinds:['height'],rays:8,aoDist:.1,thickDist:.1,pad:4,dx:false,hg},prog);
    if(res&&res.height){if(!bkEstP)bkEstP=program(FS_BKEST);const T=bakeMapT('offset',true),before=captureRegionNow(T,0,0,doc.w,doc.h);
      const t=makeTarget(doc.w,doc.h,8,false);run(bkEstP,t,{uH:res.height.tex,uRange:Math.max(f,b)*reach,uFront:f,uBack:b});gaussian(t,T,3);disposeTarget(t);disposeTarget(res.height);
      const after=captureRegionNow(T,0,0,doc.w,doc.h),Lm=bakeMapL('offset'),r=regionRecord(Lm,before,after,0,0,doc.w,doc.h,'Estimate offset');Lm.onRecord(r,[0,0,doc.w,doc.h]);pushUndo(r);
      toast('Offset estimated. Bake again to use it; paint over it to adjust.');}}
  catch(e){console.error(e);toast('Estimating failed: '+(e.message||e));}
  bk.busy=false;bk.prog=null;bk.dirty=true;bakeRefresh();}

/* ---------- showing results: canvas and model ---------- */
const FS_BKTINT=`uniform sampler2D uB; uniform sampler2D uM; uniform int uMode; uniform int uHasB; uniform vec3 uGrey;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 b=uHasB==1?texelFetch(uB,p,0):vec4(uGrey,1.0); vec3 c=b.a>1e-5?b.rgb/b.a:uGrey;
  if(uMode==1){ float m=texelFetch(uM,p,0).r; c=mix(c,vec3(1.0,0.36,0.16),(1.0-m)*0.8); }
  else if(uMode==2){ float d=texelFetch(uM,p,0).r-0.5; c=d>0.0?mix(c,vec3(1.0,0.62,0.12),min(1.0,d*1.6)):mix(c,vec3(0.2,0.5,1.0),min(1.0,-d*1.6)); }
  else if(uMode==3){ float m=texelFetch(uM,p,0).r; c=vec3(m); }
  o=vec4(c,1.0); }`;
let bkTintP=null;
/* the paint map as it looks right now (with the stroke being painted) */
function bakePaintLive(k){const T=bakeMapT(k);if(!T)return null;const L=bk.L[k];
  if(stroke&&L&&stroke.L===L&&stroke.o.tool!=='smudge'){const t=acquireD(8);run(P.merge,t,Object.assign({uSrc:beforeT.tex,uStrokeTex:strokeT.tex,uStroke:{int:strokeMode(stroke.o)},uStrokeColor:stroke.o.color,...tintU(),uStrokeOpacity:stroke.o.opacity,uLockAlpha:false},tonalU(stroke.o),chanU(null),selU(stroke.o)));return {t,tmp:true};}
  return {t:T,tmp:false};}
function bakeTint(dst,base,paintK,mode){if(!bkTintP)bkTintP=program(FS_BKTINT);const pm=paintK?bakePaintLive(paintK):null;
  run(bkTintP,dst,{uB:base?base.tex:dummy,uHasB:!!base,uM:pm?pm.t.tex:dummy,uMode:{int:pm?mode:0},uGrey:[.62,.62,.64]});if(pm&&pm.tmp)release(pm.t);}
function bkEnsure(name,depth){let t=bk[name];if(!t||t.w!==doc.w||t.h!==doc.h){if(t)disposeTarget(t);t=bk[name]=makeTarget(doc.w,doc.h,depth||8,false);}return t;}
/* canvas: the chosen baked map (normal when showing the material), tinted where fixes are painted */
function bakeViewTex(){const t=bkEnsure('view2d',8),live=stroke&&stroke.L&&stroke.L.bakeMap;
  if(bk.dirty||live||bk.busy){const k=bk.show==='material'?(bk.res.normal?'normal':Object.keys(bk.res)[0]):bk.show;
    if(BK_PAINT[k])bakeTint(t,null,k,3);else bakeTint(t,bk.res[k]||null,bk.paint,bk.paint==='skew'?1:2);}
  return t;}
/* model: lit clay with the baked normal and AO, or one map on its own */
function bakeV3Refresh(){if(bk.docBase&&v3.mapsDirty){const t=compositeMap('base');v3MapTex('base',t);release(t);v3.mapsDirty=false;bk.dirty=true;}
  const live=stroke&&stroke.L&&stroke.L.bakeMap;if(!bk.dirty&&!live&&!bk.busy&&v3.btex)return;
  const tint=bkEnsure('tint',8),r=bk.res,T={};let unlit=false;
  if(bk.show==='material'){bakeTint(tint,bk.docBase?(v3.tex.base||null):null,bk.paint,bk.paint==='skew'?1:2);T.base=tint;if(r.normal)T.nfinal=r.normal;if(r.ao)T.ao=r.ao;}
  else if(BK_PAINT[bk.show]){bakeTint(tint,null,bk.show,3);T.base=tint;unlit=true;}
  else{bakeTint(tint,r[bk.show]||null,bk.paint,bk.paint==='skew'?1:2);T.base=tint;unlit=true;}
  v3.btex=T;v3.bunlit=unlit;bk.dirty=false;v3.dirty=true;}
function bakeRefresh(){bk.dirty=true;v3.dirty=true;requestRender(true);if(ui.mode==='bake')buildBakePanel();}

/* ---------- loading models: button, menu or drag and drop ---------- */
function bakeSetModel(key,m){const C=bakeCfg;C[key]=m;
  toast('Loaded “'+m.name+'” as the '+(key==='high'?'high-poly':key==='low'?'low-poly':'cage')+': '+m.tris.toLocaleString()+' triangles.'+(key==='low'&&m.noUV?' It has no UVs, so nothing can be baked onto it.':'')+(key==='high'&&m.tris>6e6?' That is very large; baking will be slow.':''));
  if(key==='low')bakeSyncMesh();bakeCageDirty();if(ui.mode==='bake')buildBakePanel();}
/* which slot a file belongs in, from its name (crate_low, crate_high, crate_cage) */
function bakeGuessSlot(name){const n=baseName(name).toLowerCase();if(/cage/.test(n))return 'cage';if(/(^|[_\-\s.])(high|hi|hp)(poly)?($|[_\-\s.\d])|highpoly/.test(n))return 'high';if(/(^|[_\-\s.])(low|lo|lp)(poly)?($|[_\-\s.\d])|lowpoly/.test(n))return 'low';return null;}
async function bakeDropFiles(files,key){files=[...files];const models=files.filter(f=>isModelName(f.name));if(!models.length){toast('Drop an OBJ, glTF, GLB or FBX model.');return;}
  for(const f of models){let k=key||bakeGuessSlot(f.name);if(!k){if(models.length>1){toast('Name the files “…_low” and “…_high”, or drop each one on its row.');continue;}k=bakeCfg.high?'low':'high';}
    loadStart(f.name);try{bakeSetModel(k,await parseModelFile(f,files));}catch(e){console.warn(e);toast('“'+f.name+'” could not be loaded: '+(e.message||e));}finally{loadEnd();}}}
function bakeDropZone(node,key){node.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();e.stopPropagation();node.classList.add('dropon');}});
  node.addEventListener('dragleave',()=>node.classList.remove('dropon'));
  node.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();node.classList.remove('dropon');bakeDropFiles(e.dataTransfer.files,key);});}

/* ---------- the cage, drawn over the model: where the rays start ---------- */
function bakeCageDirty(){bk.cageKey=null;v3.dirty=true;requestRender();}
function bakeCageGPU(){const C=bakeCfg,L=v3.mesh;if(!L||!L.pos||!L.idx)return null;const key=[L,C.cage,C.front,C.average,bk.maps.offset?bk.offVer||0:-1].join('|');
  if(bk.cageGPU&&bk.cageKey===key)return bk.cageGPU;
  if(bk.cageGPU){const g=bk.cageGPU;gl.deleteVertexArray(g.vao);gl.deleteVertexArray(g.evao);gl.deleteBuffer(g.vb);gl.deleteBuffer(g.ib);gl.deleteBuffer(g.eb);bk.cageGPU=null;}
  const n=L.pos.length/3,pos=new Float32Array(n*3);
  if(C.cage&&C.cage.verts===L.verts&&C.cage.tris===L.tris)pos.set(bakeAlign(C.cage,L).pos);
  else{const ray=bkRayDirs(L,C.average),f=C.front*.02;let off=null;
    if(bk.maps.offset){off=readRGBA8(bk.maps.offset);}
    for(let i=0;i<n;i++){let k=1;if(off&&L.uv){const x=clamp(Math.floor(L.uv[i*2]*doc.w),0,doc.w-1),y=clamp(Math.floor(L.uv[i*2+1]*doc.h),0,doc.h-1);k=off[(y*doc.w+x)*4]/255*2;}
      for(let c=0;c<3;c++)pos[i*3+c]=L.pos[i*3+c]+ray[i*3+c]*f*k;}}
  const d=new Float32Array(n*12);for(let i=0;i<n;i++){d.set(pos.subarray(i*3,i*3+3),i*12);if(L.nrm)d.set(L.nrm.subarray(i*3,i*3+3),i*12+3);}
  const at=(i,sz,o)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,sz,gl.FLOAT,false,48,o*4);};
  const vb=gl.createBuffer(),vaoC=gl.createVertexArray();gl.bindVertexArray(vaoC);gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);at(0,3,0);at(1,3,3);at(2,2,6);at(3,4,8);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,L.idx,gl.STATIC_DRAW);
  const edges=meshEdges(L),evao=gl.createVertexArray();gl.bindVertexArray(evao);gl.bindBuffer(gl.ARRAY_BUFFER,vb);at(0,3,0);at(1,3,3);at(2,2,6);at(3,4,8);
  const eb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,edges,gl.STATIC_DRAW);gl.bindVertexArray(vao);
  bk.cageKey=key;return bk.cageGPU={vao:vaoC,evao,vb,ib,eb,count:L.idx.length,ecount:edges.length};}
/* see-through blue shell with its edges, drawn after the model */
function bakeDrawCage(common){if(!bk.showCage||ui.mode!=='bake')return;const g=bakeCageGPU();if(!g)return;
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  useProg(P3.line,Object.assign({},common,{uUseH:false,uCol:[.35,.72,1,.14]}));gl.bindVertexArray(g.vao);gl.drawElements(gl.TRIANGLES,g.count,gl.UNSIGNED_INT,0);
  useProg(P3.line,Object.assign({},common,{uUseH:false,uCol:[.45,.8,1,.55]}));gl.bindVertexArray(g.evao);gl.drawElements(gl.LINES,g.ecount,gl.UNSIGNED_INT,0);
  gl.bindVertexArray(vao);gl.depthMask(true);gl.disable(gl.BLEND);}

/* ---------- panel ---------- */
/* the Bake tab's canvas size (a change clears the bake) */
function bakeSizeSeg(){const ps=paintDocSize(),opts=[[0,'Painting ('+ps[0]+(ps[0]===ps[1]?'':'×'+ps[1])+')'],[512,'512'],[1024,'1K'],[2048,'2K'],[4096,'4K'],[8192,'8K']];
  const g=seg(opts,bakeCfg.size||0,v=>{if(bk.busy){toast('Wait for the bake to finish.');buildBakePanel();return;}bakeCfg.size=v||null;bakeReset();const bs=bakeSize();tabDocResize(bs[0],bs[1],'Bake');bk.dirty=true;buildBakePanel();requestRender(true);},'Bake size');g.classList.add('themeseg');g.id='bkSize';return g;}
/* which maps to send or export, and the buttons */
function bakeSendBox(){const box=el('div',{class:'dlg-grid',id:'bkSendBox'}),have=bakeSendable(),t=bakeCfg.send||(bakeCfg.send={});
  box.append(el('div',{class:'sub',text:'Send to the painting, or export'}));
  if(!have.length){box.append(el('p',{class:'note',text:'Bake first: the maps you bake can then be ticked here.'}));return box;}
  const on=k=>t[k]!==undefined?t[k]:!(k==='curvEdge'||k==='curvCrease');
  const none=()=>!have.some(on),send=el('button',{class:'btn',id:'bkSend',text:'Send to Paint',title:'Add the ticked maps to the painting as layers',disabled:bk.busy||none(),onclick:bakeSend}),
    exp=el('button',{class:'btn',id:'bkExport',text:'Export…',title:'Save the ticked maps as image files',disabled:bk.busy||none(),onclick:bakeExport});
  box.append(el('div',{class:'chips'},...have.map(k=>chk('bks_'+k,BAKE_NAMES[k],on(k),v=>{t[k]=v;send.disabled=exp.disabled=bk.busy||none();const p=document.getElementById('bkSendP3');if(p)p.disabled=send.disabled;}))),
    el('div',{class:'row wrap'},send,el('button',{class:'btn',id:'bkSendP3',text:'Send to 3D Paint',title:'Send the low-poly and the ticked maps to 3D Paint: each material’s maps to its own texture set',disabled:bk.busy||none(),onclick:bakeSendP3}),exp),
    chk('bkP3Layers','3D Paint: also add them as layers (they always become the set’s mesh maps)',!!bakeCfg.p3Layers,v=>{bakeCfg.p3Layers=v;}),
    el('p',{class:'note',text:'They arrive as plain layers (no folders), scaled to the painting when its size differs. In the browser, Export gives a zip.'}));
  return box;}

function bakeProgUI(){const box=$('#bkProg');if(!box)return;const p=bk.prog;
  if(p||bk.regionBusy){box.hidden=false;box.querySelector('.bakebar div').style.width=((p?p.f:0.5)*100).toFixed(1)+'%';box.querySelector('.note').textContent=p?p.msg:'Updating where you painted…';}
  else box.hidden=true;const b=$('#bkGo');if(b){b.textContent=bk.busy?'Cancel':'Bake';b.classList.toggle('primary',!bk.busy);}}
function buildBakePanel(){const box=$('#bakeBody');if(!box)return;box.replaceChildren();const C=bakeCfg;
  const row=(label,ctrl)=>el('div',{class:'frow'},el('label',{text:label}),ctrl);
  const modelSel=(key,opts)=>{const s=el('select',{'aria-label':key,id:'bk_'+key});const draw=()=>{s.replaceChildren(...opts().map(([v,t])=>el('option',{value:v,text:t})));s.value=C[key]&&C[key].name?'file':opts()[0][0];};
    const load=async()=>{try{const m=await bakePickModel();if(m)bakeSetModel(key,m);}catch(e){console.warn(e);toast('This model could not be loaded: '+(e.message||e));}draw();info();};
    s.onchange=async()=>{if(s.value==='load'){await load();return;}if(s.value!=='file')C[key]=null;info();if(key==='low')bakeSyncMesh();};draw();
    const btn=el('button',{class:'btn sm',text:'Load…',id:'bk_'+key+'Load',title:'Load a model file (OBJ, glTF, GLB, FBX), or drop one here'});btn.onclick=load;
    const wrap=el('div',{class:'bkmodel'},s,btn);bakeDropZone(wrap,key);return wrap;};
  const lowOpts=()=>[['view','Model in the 3D view ('+bakeViewModel().name+')'],...(C.low?[['file',C.low.name+' · '+C.low.tris.toLocaleString()+' triangles']]:[]),['load','Load a model file…']];
  const highOpts=()=>[['none','None: bake the low-poly on its own'],...(C.high?[['file',C.high.name+' · '+C.high.tris.toLocaleString()+' triangles']]:[]),['load','Load a model file…']];
  const cageOpts=()=>[['none','Push out by the front distance'],...(C.cage?[['file',C.cage.name]]:[]),['load','Load a cage model…']];
  const inf=el('p',{class:'note'});
  const info=()=>{const L=bkLow();const bits=[];if(L.noUV)bits.push('The low-poly has no UVs: nothing can be baked onto it.');
    if(C.cage&&(C.cage.verts!==L.verts||C.cage.tris!==L.tris))bits.push('The cage must be the low-poly pushed outwards: same vertices and triangles ('+L.verts+' / '+L.tris+'). This one does not match.');
    if(C.match){const lp=new Set((L.partNames||[]).map(partBase)),hp=new Set(((C.high||{}).partNames||[]).map(partBase));const both=[...lp].filter(x=>hp.has(x));
      bits.push(both.length?'Matching '+both.length+' part'+(both.length>1?'s':'')+' by name: '+both.slice(0,6).join(', ')+(both.length>6?'…':'')+'.':'No part names match between the models (use names like “crate_low” and “crate_high”).');}
    bits.push('Bakes at the document size, '+doc.w+' × '+doc.h+'.');inf.textContent=bits.join(' ');};
  const S=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:C[key],fmt,onInput:v=>{C[key]=v;}}).el;
  const on=k=>chk('bk_'+k,'Bake '+BAKE_NAMES[k].toLowerCase(),!!C.kinds[k],v=>{C.kinds[k]=v;tabs.replaceWith(tabs=tabBar());});
  const note=t=>el('p',{class:'note',text:t});
  /* one tab of settings per map, plus the ones they share */
  const TABS=[['general','General'],['normal','Normal'],['ao','AO'],['curv','Curvature'],['height','Height'],['thick','Thickness'],['other','Other']];
  const baking=t=>t==='other'?['wnormal','position','id'].some(k=>C.kinds[k]):!!C.kinds[t];
  const tabBar=()=>{const g=seg(TABS.map(([v,t])=>[v,t+(v!=='general'&&baking(v)?' •':''),v==='general'?'Settings every map shares':baking(v)?t+': baked':t+': not baked']),C.tab,v=>{C.tab=v;page.replaceWith(page=tabPage());},'Map settings');g.classList.add('themeseg','bktabs');return g;};
  const tabPage=()=>{const T=C.tab,pg=el('div',{class:'dlg-grid bktab',id:'bkTab_'+T});
    if(T==='general')pg.append(el('div',{class:'sub',text:'Size'}),bakeSizeSeg(),
      makeSlider({id:'bkFront',label:'Front',min:0,max:20,step:.1,value:C.front,fmt:v=>v.toFixed(1)+'%',onInput:v=>{C.front=v;bakeCageDirty();}}).el,S('bkBack','Back','back',0,20,.1,v=>v.toFixed(1)+'%'),
      chk('bkAvg','Average ray directions (no gaps at hard edges)',C.average,v=>{C.average=v;bakeCageDirty();}),
      el('div',{class:'sub',text:'Anti-aliasing'}),seg([[1,'1×'],[2,'4×'],[4,'16×']],C.ss,v=>{C.ss=v;},'Anti-aliasing'),S('bkPad','Padding','pad',0,64,1,v=>v+'px'),
      el('div',{class:'sub',text:'Send to the document as'}),seg([['layers','Layers'],['maps','Maps only']],C.sendAs==='maps'?'maps':'layers',v=>{C.sendAs=v;},'Send as'),
      note(C.sendAs==='maps'?'':'Layers: each bake is also a layer in the base colour, so you can blend them (curvature on Overlay over AO). AO, curvature and height go into their own maps too.'),
      el('div',{class:'chips'},chk('bkAuto','Send results automatically',C.autoSend,v=>{C.autoSend=v;}),chk('bkRepl','Replace the last baked layers',C.replace,v=>{C.replace=v;})));
    if(T==='normal')pg.append(on('normal'),note('Tangent-space normal, OpenGL style (green up). For engines that want DirectX, flip green when exporting (File › Export textures).'));
    if(T==='ao')pg.append(on('ao'),S('bkRays','Rays','rays',8,256,8,v=>String(v)),S('bkAoD','Reach','aoDist',1,100,1,v=>v+'%'),S('bkAoS','Spread','aoSpread',.1,1,.05,pct),
      note('Rays: how many each pixel sends (more is smoother, slower). Reach: how far they look. Spread: narrower keeps the shading to deep cavities.'));
    if(T==='curv'){const flip=chk('bkCurvFlip','Flip green',!!C.curvFlip,v=>{C.curvFlip=v;});flip.hidden=C.curvSrc==='mesh';
      pg.append(on('curv'),el('div',{class:'sub',text:'From'}),seg([['mesh','The shape'],['normal','Baked normal'],['doc','Normal map']],C.curvSrc||'mesh',v=>{C.curvSrc=v;flip.hidden=v==='mesh';},'Curvature from'),
        note('The shape: measured on the high-poly (or the low-poly on its own), right on mirrored and flipped UVs. Baked normal: from the normal baked with it. Normal map: from the document’s own normal map. Flip green if edges and creases come out swapped on some parts.'),
        flip,S('bkCurvR','Radius','curvRadius',1,32,1,v=>v+' px'),S('bkCurvS','Strength','curvStr',.1,4,.05,pct),S('bkCurvE','Edges','curvEdges',0,2,.05,pct),S('bkCurvC','Creases','curvCreases',0,2,.05,pct),
        chk('bkCurvParts','Also make edges-only and creases-only maps',C.curvParts!==false,v=>{C.curvParts=v;}),
        note('Radius: how far around each point it looks (small: thin sharp edges; large: broad soft ones). Edges and Creases set the light and dark sides on their own.'));}
    if(T==='height')pg.append(on('height'),note('How far the high-poly is above (light) or below (dark) the low-poly, within Front and Back (General).'));
    if(T==='thick')pg.append(on('thick'),S('bkThR','Rays','thickRays',8,256,8,v=>String(v)),S('bkThD','Reach','thickDist',1,100,1,v=>v+'%'),note('White is thick, dark is thin. Reach: how deep it looks.'));
    if(T==='other')pg.append(on('wnormal'),on('position'),on('id'),note('World-space normal, position (a gradient over the model’s box) and ID colours (vertex colours, material colours, or one colour per part).'));
    return pg;};
  let tabs=tabBar(),page=tabPage();
  const go=el('button',{class:'btn primary',id:'bkGo',text:'Bake'});
  go.onclick=()=>{if(bk.busy){if(bk.prog)bk.prog.cancelled=true;return;}const L=bkLow();const ks=Object.keys(C.kinds).filter(k=>C.kinds[k]);if(!ks.length){toast('Pick at least one map.');return;}if(C.perMat!==false&&bkMats(L))runBakeSets(L,ks);else{bk.byMat=null;runBake(L,ks);}};
  const prog=el('div',{id:'bkProg',hidden:true},el('p',{class:'note'}),el('div',{class:'bakebar'},el('div')));
  box.append(el('p',{class:'note',text:'Drop model files here: names ending in _low, _high and _cage go to the right place.'}),row('Low-poly',modelSel('low',lowOpts)),row('High-poly',modelSel('high',highOpts)),row('Cage',modelSel('cage',cageOpts)),
    chk('bkMatch','Match parts by name (“_low” bakes only against its “_high”)',C.match,v=>{C.match=v;info();}),
    el('div',{class:'chips'},chk('bkShowCage','Show the cage on the model',bk.showCage,v=>{bk.showCage=v;v3.dirty=true;requestRender();})),
    tabs,page,
    bkMats(bkLow())?chk('bkPerMat','Bake each material separately ('+bkMats(bkLow()).length+' materials: one set of maps per texture set)',C.perMat!==false,v=>{C.perMat=v;}):null,
    el('div',{class:'row wrap'},go),
    bk.byMat?row('Material',(()=>{const s=el('select',{id:'bkMat','aria-label':'Material'},...Object.keys(bk.byMat).map(n=>el('option',{value:n,text:n})));s.value=bk.matShow;s.onchange=()=>bakeShowMat(s.value);return s;})()):null,
    bakeSendBox(),
    prog,inf);
  info();
  /* what to look at */
  const have=Object.keys(bk.res).filter(k=>k!=='mcurv'&&k!=='gcurv');
  if(have.length||bk.maps.skew||bk.maps.offset){const opts=[['material','Material (lit)'],...have.map(k=>[k,k==='curv'?'Curvature':BAKE_NAMES[k]]),...Object.keys(BK_PAINT).filter(k=>bk.maps[k]).map(k=>[k,BK_PAINT[k].name+' map'])];
    const s=el('select',{id:'bkShow','aria-label':'Show'},...opts.map(([v,t])=>el('option',{value:v,text:t})));s.value=opts.some(o=>o[0]===bk.show)?bk.show:'material';
    s.onchange=()=>{bk.show=s.value;bk.dirty=true;requestRender();};box.append(row('Show',s));
    if(bk.show==='material')box.append(el('div',{class:'chips'},chk('bkDocBase','Use the document’s base colour on the model',bk.docBase,v=>{bk.docBase=v;v3.mapsDirty=true;bk.dirty=true;requestRender(true);})));}
  if(bk.stale.size)box.append(el('p',{class:'note warn',text:[...bk.stale].map(k=>BAKE_NAMES[k]).join(' and ')+' will update on the next full bake.'}));
  /* fixing */
  box.append(el('div',{class:'sub',text:'Fix the bake'}),seg([['off','Off'],['skew','Skew'],['offset','Offset']],bk.paint||'off',v=>{bk.paint=v==='off'?null:v;
      if(bk.paint){bakeMapT(bk.paint,true);v3.paintOn=true;if(!['brush','erase'].includes(ui.tool))setTool('brush');}bk.dirty=true;buildBakePanel();if(v3.on)build3dPane();requestRender();},'Paint fixes'));
  if(bk.paint==='skew')box.append(el('p',{class:'note',text:'Paint black over details that come out smeared or leaning (screws, bolts, panel lines): the rays there shoot straight out of the surface. White keeps the averaged direction, which avoids gaps at hard edges. The Eraser paints white.'}));
  if(bk.paint==='offset')box.append(el('p',{class:'note',text:'Grey keeps Front and Back. Lighter reaches further (for parts of the high-poly that were missed); darker reaches less far (for detail leaking in from nearby parts). The Eraser paints grey.'}));
  if(bk.paint){const vk=bk.paint,val=bk.val||(bk.val={skew:0,offset:.85});box.append(makeSlider({id:'bkPaintVal',label:'Paint',min:0,max:1,step:.01,value:val[vk],fmt:v=>v<.02?'black':v>.98?'white':Math.round(v*100)+'%',onInput:v=>{val[vk]=v;}}).el);}
  if(bk.paint)box.append(el('p',{class:'note',text:'Paint on the model in the 3D view (Alt+drag turns it) or on the map on the left. After each stroke the bake updates where you painted.'}));
  const bt=(t,f,dis)=>{const b=el('button',{class:'btn sm',text:t});b.disabled=!!dis;b.onclick=f;return b;};
  box.append(el('div',{class:'row wrap'},bt('Estimate offset',bakeEstimateOffset,!C.high||bk.busy),bt('Clear skew',()=>bakeClearMap('skew'),!bk.maps.skew),bt('Clear offset',()=>bakeClearMap('offset'),!bk.maps.offset)));
  bakeProgUI();}
