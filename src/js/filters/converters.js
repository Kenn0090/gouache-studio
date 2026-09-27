/* ================= Map converters (Maps menu) =================
   Make one map from another: height or normal from base colour, ambient occlusion or curvature
   from height, and so on. The result is a new layer in the target map (or a selection), so it can
   be undone, faded, masked or painted over. The dialog previews live on the canvas. */
const greyDepth=()=>canFloat?16:doc.depth;
function lumOfT(src){const t=acquireD(greyDepth());run(P.f_lum,t,{uSrc:src.tex});return t;}
function blurOf(src,r){const t=acquireD(src.depth);if(r<=.25){blit(src,t,0,0,doc.w,doc.h,0,0);return t;}gaussian(src,t,r);return t;}
/* height from brightness (shared by Height and Normal from base colour) */
function heightFromColor(src,out,v){const l=lumOfT(src),b=blurOf(l,v.shapes);
  run(P.f_hgen,out,{uL:l.tex,uB:b.tex,uLarge:v.large,uFine:v.fine,uContrast:v.contrast,uInv:!!v.inv});release(l);release(b);
  if(v.smooth>.25){const t=blurOf(out,v.smooth);blit(t,out,0,0,doc.w,doc.h,0,0);release(t);}}
const HEIGHT_DEFS=[{key:'fine',label:'Fine detail',min:0,max:3,step:.05,value:1,fmt:pct},{key:'large',label:'Large shapes',min:0,max:3,step:.05,value:.6,fmt:pct},
  {key:'shapes',label:'Shape size',min:2,max:200,step:1,value:24,fmt:v=>v+'px'},{key:'contrast',label:'Contrast',min:.2,max:4,step:.05,value:1,fmt:pct},
  {key:'smooth',label:'Smooth',min:0,max:20,step:.5,value:1,fmt:v=>v+'px'}];
const CONVERTERS={
  heightFromBase:{title:'Height from base colour',from:'base',to:'height',name:'Height from colour',defs:HEIGHT_DEFS,checks:[['inv','Invert (dark is high)',false]],
    note:'Lighter areas become raised. Fine detail keeps small texture; Large shapes keeps the broad forms.',
    make(src,out,v){heightFromColor(src,out,v);}},
  normalFromBase:{title:'Normal from base colour',from:'base',to:'normal',name:'Normal from colour',
    defs:[...HEIGHT_DEFS,{key:'str',label:'Strength',min:0,max:32,step:.5,value:6,fmt:v=>v.toFixed(1)}],checks:[['inv','Invert (dark is high)',false]],
    note:'Builds a height from the colour’s brightness, then turns it into normal detail. It adds to any normal made from the Height map.',
    make(src,out,v){const h=acquireD(greyDepth());heightFromColor(src,h,v);run(P.nrm,out,{uH:h.tex,uN:dummy,uUseN:false,uStr:v.str,uWrap:!!doc.wrap,uFlipY:false});release(h);}},
  roughFromBase:{title:'Roughness from base colour',from:'base',to:'rough',name:'Roughness from colour',
    defs:[{key:'min',label:'Darkest becomes',min:0,max:1,step:.01,value:.35,fmt:pct},{key:'max',label:'Lightest becomes',min:0,max:1,step:.01,value:.85,fmt:pct},{key:'contrast',label:'Contrast',min:.2,max:4,step:.05,value:1,fmt:pct}],
    checks:[['inv','Invert',false]],note:'Maps brightness to a roughness range: 0% is glossy, 100% is matte.',
    make(src,out,v){const l=lumOfT(src);run(P.f_rgen,out,{uL:l.tex,uMin:v.min,uMax:v.max,uContrast:v.contrast,uInv:!!v.inv});release(l);}},
  aoFromHeight:{title:'Ambient occlusion from height',from:'height',to:'ao',name:'AO from height',mode:1,
    defs:[{key:'r',label:'Radius',min:1,max:128,step:1,value:16,fmt:v=>v+'px'},{key:'str',label:'Strength',min:0,max:4,step:.05,value:1,fmt:pct}],
    note:'Crevices and dips get darker. The layer multiplies over the ambient occlusion map.',
    make(src,out,v){const b1=blurOf(src,v.r*.25),b2=blurOf(src,v.r*.5),b3=blurOf(src,v.r);run(P.f_ao,out,{uH:src.tex,uB1:b1.tex,uB2:b2.tex,uB3:b3.tex,uStr:v.str});[b1,b2,b3].forEach(release);}},
  curvFromHeight:{title:'Curvature from height',from:'height',name:'Curvature',outputs:[['curv','Curvature map'],['sel','Selection']],
    defs:[{key:'r',label:'Radius',min:1,max:64,step:.5,value:4,fmt:v=>v+'px'},{key:'str',label:'Strength',min:0,max:4,step:.05,value:1,fmt:pct},{key:'smooth',label:'Smooth',min:0,max:16,step:.5,value:1.5,fmt:v=>v+'px'}],
    segs:[['part','Show',[[0,'Edges and cavities'],[1,'Edges only'],[2,'Cavities only']],0]],
    note:'Smooth curvature: raised edges light, crevices dark. It goes into its own grey Curvature map (your colours are not touched). Use Filter › Edge wear to put it onto colour, or make it a selection.',
    make(src,out,v){const b1=blurOf(src,v.r),b2=blurOf(src,v.r*3);run(P.f_curv,out,{uH:src.tex,uB1:b1.tex,uB2:b2.tex,uStr:v.str,uMode:{int:v.part}});release(b1);release(b2);
      if(v.smooth>.25){const t=blurOf(out,v.smooth);blit(t,out,0,0,doc.w,doc.h,0,0);release(t);}}},
  curvFromNormal:{title:'Curvature from normal',from:'normal',finalNormal:true,name:'Curvature',outputs:[['curv','Curvature map'],['sel','Selection']],
    defs:[{key:'r',label:'Radius',min:0,max:32,step:.5,value:1.5,fmt:v=>v+'px'},{key:'str',label:'Strength',min:0,max:4,step:.05,value:1,fmt:pct},{key:'smooth',label:'Smooth',min:0,max:16,step:.5,value:1,fmt:v=>v+'px'}],
    segs:[['part','Show',[[0,'Edges and cavities'],[1,'Edges only'],[2,'Cavities only']],0]],
    note:'Reads curvature straight from the normal map (including the normal made from Height). It goes into its own grey Curvature map (your colours are not touched). Use Filter › Edge wear to put it onto colour, or make it a selection.',
    make(src,out,v){const n=blurOf(src,v.r);run(P.f_ncurv,out,{uN:n.tex,uWrap:!!doc.wrap,uStr:v.str,uMode:{int:v.part},uStep:Math.max(1,Math.round(v.r*.7))});release(n);
      if(v.smooth>.25){const t=blurOf(out,v.smooth);blit(t,out,0,0,doc.w,doc.h,0,0);release(t);}}},
  aoFromNormal:{title:'Ambient occlusion from normal',from:'normal',finalNormal:true,to:'ao',name:'AO from normal',mode:1,float:true,
    defs:[{key:'r',label:'Radius',min:1,max:128,step:1,value:16,fmt:v=>v+'px'},{key:'str',label:'Strength',min:0,max:4,step:.05,value:1,fmt:pct}],checks:[['dx','Normal map is DirectX (green down)',false]],
    note:'Rebuilds the shape from the normal map, then darkens its crevices.',
    make(src,out,v){if(!v._h||v._hdx!==v.dx){if(v._h)disposeTarget(v._h);v._h=makeTarget(doc.w,doc.h,16);v._hdx=v.dx;heightFromNormal(src,v._h,{str:1,iter:50,dx:v.dx});}
      const h=v._h,b1=blurOf(h,v.r*.25),b2=blurOf(h,v.r*.5),b3=blurOf(h,v.r);run(P.f_ao,out,{uH:h.tex,uB1:b1.tex,uB2:b2.tex,uB3:b3.tex,uStr:v.str});[b1,b2,b3].forEach(release);},
    cleanup(v){if(v._h){disposeTarget(v._h);v._h=null;}}},
  heightFromNormal:{title:'Height from normal',from:'normal',to:'height',name:'Height from normal',float:true,
    defs:[{key:'str',label:'Strength',min:.05,max:2,step:.05,value:.6,fmt:pct},{key:'iter',label:'Quality',min:10,max:200,step:5,value:60,fmt:v=>String(v)}],
    checks:[['dx','Normal map is DirectX (green down)',false]],
    note:'Rebuilds the shape a loaded normal map describes. Results are approximate on very sharp normal maps.',
    make(src,out,v){heightFromNormal(src,out,v);}},
};
/* Poisson solve from coarse to fine: slopes -> divergence -> relaxation at 1/8, 1/4, 1/2, full size */
/* full-precision float targets for solving the height (half floats round it into terraces: rings in AO) */
const solveDepth=()=>canFloat&&gl.getExtension('OES_texture_float_linear')?32:16;
function heightFromNormal(src,out,v){const W=doc.w,H=doc.h,F=solveDepth(),S=makeTarget(W,H,F),D=makeTarget(W,H,F);
  run(P.f_nslope,S,{uN:src.tex,uFlip:!!v.dx});run(P.f_ndiv,D,{uS:S.tex,uWrap:!!doc.wrap});disposeTarget(S);
  const levels=[];let w=W,h=H,l=0;while(true){levels.push([w,h,l]);if(Math.max(w,h)<=96||l>=6)break;w=Math.ceil(w/2);h=Math.ceil(h/2);l++;}
  /* the slopes' divergence averaged down for each coarser level (sampling it at single points misses thin lines) */
  const Ds=[D];for(let i=1;i<levels.length;i++){const [lw,lh]=levels[i],t=makeTarget(lw,lh,F);run(P.f_rs,t,{uSrc:Ds[i-1].tex,uOut:[lw,lh]});Ds.push(t);}
  let cur=null;
  for(let i=levels.length-1;i>=0;i--){const [lw,lh,ll]=levels[i];let a=makeTarget(lw,lh,F),b=makeTarget(lw,lh,F);
    if(cur){run(P.f_rs,a,{uSrc:cur.tex,uOut:[lw,lh]});disposeTarget(cur);}else clearTarget(a,[0,0,0,1]);
    const n=Math.round(v.iter*(i===levels.length-1?4:1));
    for(let k=0;k<n;k++){run(P.f_jacobi,b,{uH:a.tex,uD:Ds[i].tex,uWrap:!!doc.wrap,uScale:Math.pow(4,ll)});const t=a;a=b;b=t;}
    disposeTarget(b);cur=a;}
  for(const t of Ds)disposeTarget(t);
  /* spread: find the range on a small copy */
  const sm=makeTarget(64,64,16);run(P.f_rs,sm,{uSrc:cur.tex,uOut:[64,64]});gl.bindFramebuffer(gl.FRAMEBUFFER,sm.fbo);const f=new Float32Array(64*64*4);gl.readPixels(0,0,64,64,gl.RGBA,gl.FLOAT,f);gl.bindFramebuffer(gl.FRAMEBUFFER,null);disposeTarget(sm);
  let mn=1e9,mx=-1e9,sum=0;for(let i=0;i<f.length;i+=4){mn=Math.min(mn,f[i]);mx=Math.max(mx,f[i]);sum+=f[i];}
  run(P.f_hnorm,out,{uH:cur.tex,uMid:sum/(f.length/4),uStr:v.str/Math.max(1e-3,mx-mn)});disposeTarget(cur);}

let conv=null;
function dlgConvert(id){const C=CONVERTERS[id];
  if(stroke||preview||selLive||conv){toast('Finish the current edit first.');return;}
  if(ui.mode==='anim'){toast('Switch to paint mode to convert maps.');return;}
  if(C.float&&!canFloat){toast('This needs 16-bit float support, which this graphics card lacks.');return;}
  if(C.finalNormal?!(doc.maps.includes('normal')||doc.maps.includes('height')):!doc.maps.includes(C.from)){toast('This needs a '+MAP_DEFS[C.from].label+' map. Add it with Maps › Document maps…');return;}
  const v={},prev={map:doc.map,view:doc.view},A=doc.active;for(const d of C.defs)v[d.key]=d.value;for(const c of C.checks||[])v[c[0]]=c[2];for(const s of C.segs||[])v[s[0]]=s[3];
  v.out=C.outputs?C.outputs[0][0]:C.to;v.src='all';
  let added=null,srcT=null,L=null,parent=doc.root,idx=doc.root.children.length;
  if(A){parent=A.parent||doc.root;idx=parent.children.indexOf(A)+1;}
  const outMap=()=>v.out==='sel'?'base':v.out;
  const ensureMap=k=>{if(doc.maps.includes(k))return;setDocMaps([...doc.maps,k],'Add '+MAP_DEFS[k].label+' map');added=added||hist.undo[hist.undo.length-1];};
  const getSrc=()=>{if(srcT)release(srcT);srcT=null;
    if(v.src==='layer'){if(!A||!isLayer(A)||!hasMap(A,C.from))return false;const T=mapT(A,C.from);srcT=acquireD(T.depth);blit(T,srcT,0,0,doc.w,doc.h,0,0);}
    else srcT=C.finalNormal?normalComposite(false,null):compositeMap(C.from);return true;};
  const makeLayer=()=>{if(L){detachNode(L);disposeLayer(L);}const k=outMap(),pv=preview;preview=null;ensureMap(k);if(doc.map!==k||doc.view!==k)setView(k);preview=pv;
    L=newLayerObj(C.name);for(const m of Object.keys(L.maps))if(m!=='base'&&m!==k){disposeTarget(L.maps[m]);delete L.maps[m];}const T=ensureMapTarget(L,k);L.target=T;if(k!=='base')L.blankBase=true;
    if(C.mode!=null)setMapModeOf(L,k,C.mode);if(C.layerMode&&v.out!=='sel')setMapModeOf(L,k,C.layerMode(v));
    insertNode(L,parent,idx);};
  const draw=()=>{if(!L)return;const T=L.maps[outMap()];if(C.layerMode&&v.out!=='sel')setMapModeOf(L,outMap(),C.layerMode(v));
    C.make(srcT,T,v);L.visible=prefs.livePreview&&!conv.hidden;changed(L);requestRender(true);};
  if(!getSrc()){toast('Nothing to convert.');return;}
  preview={off:true,conv:true};conv={hidden:!prefs.livePreview};makeLayer();
  const body=el('div',{class:'dlg-grid'});
  if(C.note)body.append(el('p',{class:'note',text:C.note}));
  const srcSel=el('select',{id:'cvSrc'},el('option',{value:'all',text:'All layers'}),el('option',{value:'layer',text:'Active layer only'}));
  srcSel.addEventListener('change',()=>{v.src=srcSel.value;if(!getSrc()){toast('The active layer has nothing in '+MAP_DEFS[C.from].label+'.');v.src='all';srcSel.value='all';getSrc();}draw();});
  body.append(el('div',{class:'frow'},el('label',{for:'cvSrc',text:'From '+MAP_DEFS[C.from].label.toLowerCase()+' of'}),srcSel));
  if(C.outputs){const os=el('select',{id:'cvOut'},...C.outputs.map(([k,l])=>el('option',{value:k,text:l})));os.addEventListener('change',()=>{v.out=os.value;makeLayer();draw();});
    body.append(el('div',{class:'frow'},el('label',{for:'cvOut',text:'Make'}),os));}
  for(const [key,label,opts,cur] of C.segs||[])body.append(el('div',{class:'sub',text:label}),seg(opts,cur,x=>{v[key]=x;draw();},label));
  for(const d of C.defs)body.append(makeSlider(Object.assign({},d,{id:'cv_'+d.key,onInput:x=>{v[d.key]=x;draw();}})).el);
  for(const [key,label,on] of C.checks||[])body.append(chk('cv_'+key,label,on,x=>{v[key]=x;draw();}));
  let live=false;const liveOk=id!=='heightFromNormal';
  if(liveOk){const lc=chk('cvLive','Keep live (a filter layer that updates when the '+(C.finalNormal?'normal':MAP_DEFS[C.from].label.toLowerCase())+' map changes)',false,x=>{live=x;});body.append(lc);}
  body.append(previewChk('cvPrev',prefs.livePreview,x=>{conv.hidden=!x;if(L){L.visible=x;changed(L);}}));
  draw();
  const finish=()=>{if(C.cleanup)C.cleanup(v);preview=null;conv=null;if(srcT)release(srcT);srcT=null;};
  openDialog({title:C.title,body,float:true,okLabel:v.out==='sel'?'Make selection':'Create layer',
    onOk(){if(!L)return;
      if(live&&v.out!=='sel'){const k=outMap(),F=newFxLayerObj(C.name,[convItem(id,fxClean(Object.assign({},v,{out:undefined,src:undefined})))],k);
        const m=C.layerMode?C.layerMode(v):C.mode;if(m!=null)setMapModeOf(F,k,m);detachNode(L);disposeLayer(L);L=null;
        structOp(C.title+' (live)',()=>{insertNode(F,parent,idx);selectOnly(F);});finish();syncTargets();changedAll();refreshMapsUI();
        toast('Added the live layer “'+F.name+'” to the '+MAP_DEFS[k].label+' map. It updates as you paint; double-click its thumbnail to change it.');return;}
      C.make(srcT,L.maps[outMap()],v);detachNode(L);
      if(v.out==='sel'){const g=L.maps.base;selRecord(C.title,fullRect(),()=>{run(P.loadsel,sel.t,{uSrc:g.tex,uWhat:{int:1},uInv:v.part===2});sel.active=true;sel.bb=fullRect();});disposeLayer(L);}
      else{L.visible=true;const node=L;structOp(C.title,()=>{insertNode(node,parent,idx);selectOnly(node);});syncTargets();
        toast('Added the layer “'+node.name+'” to the '+MAP_DEFS[outMap()].label+' map, which you are viewing now. It is selected, so you can paint on it or change its blend mode and opacity.');}
      finish();changedAll();refreshMapsUI();},
    onCancel(){detachNode(L);disposeLayer(L);L=null;finish();
      if(added&&hist.undo[hist.undo.length-1]===added){hist.undo.pop();added.undo();dropRecords([added]);}
      if(doc.maps.includes(prev.map))setEditMap(prev.map);doc.view=doc.maps.includes(prev.view)||prev.view==='material'||prev.view==='nfinal'?prev.view:doc.map;
      changedAll();refreshMapsUI();}});}
/* flip the green channel of the active layer's normal map (DirectX <-> OpenGL) */
function flipNormalGreen(){const et=needTarget();if(!et||et.isMask)return;if(doc.map!=='normal'){toast('View the Normal map first (Maps panel), then flip its green channel.');return;}
  preview={L:et.node,isMask:false,et};run(P.f_flipg,previewT,{uSrc:et.target.tex});selLimit(et);applyPreview('Flip normal green');}
