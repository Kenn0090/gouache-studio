/* ================= UV check, auto unwrap and its review (0.54) =================
   On import a model's UVs are checked. No UVs: say so and offer an auto unwrap. Bad UVs (overlapping, outside the square,
   very uneven): say so and offer Optimize (pack the islands again) or a fresh auto unwrap. The review lives in the Bake
   tab (the card under the models): the layout drawn flat, a checker on the model, Seed + Re-roll to pack again,
   the seam angle, the padding, one square per material or a shared one, Best of 24, and Revert.
   Each mesh carries its own history: m.uwSrc (the mesh before any change), m.uwRes (the cut and flattened pieces), m.uwOpt. */
const uvw={open:false,view:'off',showOverlap:true,busy:false,gal:[],anim:false,rollNote:''};
const uvSizeNow=()=>{try{return bakeCfg&&bakeCfg.size||2048;}catch(e){return 2048;}};
/* the analysis is cached on the mesh (it is the same until the UVs change) */
function uvAn(m){if(!m)return null;if(!m._uvAn)m._uvAn=uwAnalyze(m,{udim:typeof p3!=='undefined'&&ui.mode==='p3d'&&!!p3.udim,mask:true});return m._uvAn;}
const uvWorst=an=>an&&an.issues.find(i=>i.kind!=='none')||null;
/* a dialog that gives back what was pressed: 'ok', 'cancel' or the name of a button inside it */
function uvDialog(title,body,okLabel,cancelLabel){return new Promise(res=>{let done=false;const fin=v=>{if(!done){done=true;res(v);}};
  body._pick=v=>{fin(v);closeDialog();};openDialog({title,body,okLabel,cancelLabel,onOk(){fin('ok');},onCancel(){fin('cancel');}});});}
/* ---- running an unwrap ---- */
async function uvRunUnwrap(m,optIn,quiet){const src=m.uwSrc||m,opt=Object.assign(uwDefaults(),m.uwOpt||{},{size:uvSizeNow()},optIn||{});
  if(!quiet){loadStart('Unwrapping “'+(src.name||'model')+'”');loadCancel(()=>{uwStop.on=true;});}try{const res=await uwUnwrap(src,opt,quiet?null:(msg,f)=>{loadSet(f,msg);});
    if(!quiet){loadSet(.96,'Placing the pieces…');await uwYield();}const lay=uwLayout(src,res,opt);if(!quiet){loadSet(.99,'Building the model…');await uwYield();}if(uwStop.on)throw new Error('Stopped');const nm=uwBuild(src,res,lay);
    nm.uwSrc=src;nm.uwRes=res;nm.uwOpt=Object.assign({},res.opt,{packSeed:lay.packSeed});nm.name=src.name;nm.xf=src.xf;return nm;}finally{if(!quiet)loadEnd();}}
/* just the layout again from the charts already cut (a new pack seed, padding or layout) */
function uvRelayout(m,optIn){const src=m.uwSrc,res=m.uwRes;if(!src||!res)return null;const opt=Object.assign({},m.uwOpt,{size:uvSizeNow()},optIn||{}),lay=uwLayout(src,res,opt),nm=uwBuild(src,res,lay);
  nm.uwSrc=src;nm.uwRes=res;nm.uwOpt=Object.assign({},res.opt,opt,{packSeed:lay.packSeed});nm.xf=src.xf;nm.name=src.name;return nm;}
/* the model's own UVs, packed again (the islands keep their shapes) */
function uvRepackOwn(m,optIn){const src=m.uwSrc||m,opt=Object.assign(uwDefaults(),m.uwOpt||{},{size:uvSizeNow()},optIn||{}),nm=uwRepack(src,opt);nm.uwSrc=src;nm.uwOpt=Object.assign({},opt,{packSeed:nm.uvAuto.packSeed,repack:true});nm.xf=src.xf;nm.name=src.name;return nm;}
/* swap a model for its new version everywhere it is in use */
function uvReplaceMesh(old,nm){if(!old||!nm||old===nm)return nm;
  const C=typeof bakeCfg!=='undefined'?bakeCfg:null;if(C&&C.low===old)C.low=nm;if(typeof v3!=='undefined'){if(v3.imported===old)v3.imported=nm;}
  if(typeof p3!=='undefined'&&p3.imported===old)p3.imported=nm;if(typeof rt!=='undefined'&&rt){rt.mesh=null;rt.g=null;}
  if(typeof v3!=='undefined'&&v3.mesh===old){v3SetMesh(nm,true);if(ui.mode==='bake'||ui.mode==='p3d')build3dPane();}
  if(typeof p3!=='undefined'&&p3.started&&p3.imported===nm)toast('The UVs changed. Paint you already made in 3D Paint does not follow the new UVs.');
  if(typeof bk!=='undefined'&&Object.keys(bk.res||{}).length){bakeReset();toast('The UVs changed, so the baked maps were cleared: bake again.');}
  return nm;}
/* ---- the question on import ---- */
function uvLine(t){return el('p',{class:'note',text:t});}
async function uvImportCheck(m,ctx={}){if(!m||!m.pos)return m;const an=uvAn(m);
  if(ctx.quiet){return m;}
  if(an.none){const body=el('div',{class:'dlg-grid'},uvLine('“'+(m.name||'This model')+'” has no UVs, so textures cannot be painted on it or baked onto it.'),
      uvLine('Auto unwrap cuts it into pieces, flattens them and packs them into the 0–1 square. You can review the layout, change the seam angle, and pack it again with a new seed in the Bake tab.'));
    const r=await uvDialog('This model has no UVs',body,'Auto unwrap','Continue without UVs');if(r!=='ok'){toast('Loaded without UVs: it can be viewed, but not painted or baked.');return m;}
    return await uvRunUnwrap(m);}
  const bad=an.issues.filter(i=>i.kind==='overlap'||i.kind==='outside'||(i.kind==='uneven'&&an.uneven>30));
  if(bad.length){const body=el('div',{class:'dlg-grid'},uvLine('“'+(m.name||'This model')+'” has UVs, but they may cause trouble:'),el('ul',{class:'uvissues'},...an.issues.map(i=>el('li',{text:i.text}))),
      uvLine('Optimize packs the islands you have again so they stop overlapping (their shapes stay). Auto unwrap throws the UVs away and makes new ones. Both can be re-rolled and reviewed in the Bake tab.'),
      el('div',{class:'chips'},el('button',{class:'btn',text:'Auto unwrap instead',onclick:()=>body._pick('unwrap')})));
    const r=await uvDialog('Check the UVs',body,'Optimize layout','Keep as they are');
    if(r==='ok'){const nm=uvRepackOwn(m);return nm;}if(r==='unwrap')return await uvRunUnwrap(m.uwSrc||Object.assign({},m,{noUV:true}));toast('Kept the UVs as they are.');}
  return m;}
/* the check for the New 3D Paint Project window (no second dialog on top of it): what to tell, and whether to unwrap once the project is made */
function uvDialogState(m){if(!m)return null;const an=uvAn(m);return {none:an.none,issues:an.issues.map(i=>i.text),bad:!an.none&&an.issues.some(i=>i.kind==='overlap'||i.kind==='outside')};}
/* ---- the preview picture ---- */
function uvIslandsOf(m){return m._uvIsl||(m._uvIsl=uwIslands(m));}
function uvDrawPreview(cv,m){const S=cv.width,x=cv.getContext('2d',{willReadFrequently:true});x.fillStyle='#17181c';x.fillRect(0,0,S,S);
  if(uvw.view==='check'){const n=16,c=S/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){x.fillStyle=(i+j)&1?'#2a2d34':'#20232a';x.fillRect(i*c,j*c,c,c);}}
  if(!m||m.noUV){x.fillStyle='#8a8f99';x.font='12px sans-serif';x.textAlign='center';x.fillText('No UVs',S/2,S/2);return;}
  if(uvw.view==='stretch'||uvw.view==='texel'){x.drawImage(uvHeatCanvas(m,uvw.view,S,true),0,0);const an0=uvAn(m);if(uvw.showOverlap&&an0&&an0.mask){const G=an0.mask.S,bd=an0.mask.bad,u=S/G;x.fillStyle='rgba(255,40,255,.7)';for(let i=0;i<G*G;i++)if(bd[i])x.fillRect((i%G)*u,Math.floor(i/G)*u,Math.ceil(u),Math.ceil(u));}x.strokeStyle='#6a6f7a';x.lineWidth=1;x.strokeRect(.5,.5,S-1,S-1);return;}
  const I=m.idx,T=I.length/3,UV=m.uv,isl=uvIslandsOf(m),pal=[[224,108,108],[108,192,108],[108,156,224],[224,192,92],[192,108,192],[92,192,192],[240,160,96],[160,160,168]];
  /* the islands (one colour each) and, when the model is small enough, the edges: written into pixels by hand, which is far quicker than the canvas for a big model */
  const img=x.getImageData(0,0,S,S),d=img.data;
  for(let t=0;t<T;t++){const c=pal[isl.ids[t]%pal.length];uvFillTri(d,S,UV[I[t*3]*2]*S,UV[I[t*3]*2+1]*S,UV[I[t*3+1]*2]*S,UV[I[t*3+1]*2+1]*S,UV[I[t*3+2]*2]*S,UV[I[t*3+2]*2+1]*S,c[0],c[1],c[2],.55);}
  if(T<=(S>=480?120000:40000)){for(let t=0;t<T;t++)for(let k=0;k<3;k++){const a=I[t*3+k],b=I[t*3+(k+1)%3];if(a<b)uvLinePx(d,S,UV[a*2]*S,UV[a*2+1]*S,UV[b*2]*S,UV[b*2+1]*S,.18);}}
  x.putImageData(img,0,0);
  const an=uvAn(m);if(uvw.showOverlap&&an&&an.mask){const G=an.mask.S,bd=an.mask.bad,u=S/G;x.fillStyle='rgba(255,40,40,.75)';for(let i=0;i<G*G;i++)if(bd[i])x.fillRect((i%G)*u,Math.floor(i/G)*u,Math.ceil(u),Math.ceil(u));}
  x.strokeStyle='#6a6f7a';x.lineWidth=1;x.strokeRect(.5,.5,S-1,S-1);}
/* hovering the small picture shows a big one beside it (as large as fits, up to 640 px) */
let uvBigEl=null,uvBigTimer=0;
function uvBigHide(){clearTimeout(uvBigTimer);if(uvBigEl)uvBigEl.hidden=true;}
function uvBigShow(anchor){clearTimeout(uvBigTimer);uvBigTimer=setTimeout(()=>{const m=bkLow();if(!m||!anchor.isConnected)return;
    const r=anchor.getBoundingClientRect(),room=Math.max(r.left,innerWidth-r.right),S=Math.max(320,Math.min(640,innerHeight-90,room-30)),left=r.left-S-24>=8;
    if(!uvBigEl){uvBigEl=el('div',{class:'uvbig',id:'uvBig','aria-hidden':'true'},el('canvas',{id:'uvBigCv'}),el('div',{class:'uvbigcap',id:'uvBigCap'}));document.body.append(uvBigEl);}
    const cv=uvBigEl.querySelector('canvas');if(cv.width!==S){cv.width=cv.height=S;}cv.style.width=cv.style.height=S+'px';uvDrawPreview(cv,m);
    const an=uvAn(m),A=m.uvAuto;uvBigEl.querySelector('.uvbigcap').textContent=(an.none?'No UVs':an.islands+' island'+(an.islands===1?'':'s')+(A?' · '+Math.round(A.util*100)+'% of the square used':'')+(an.overlapPct>1?' · '+Math.round(an.overlapPct)+'% overlap':''));
    uvBigEl.hidden=false;const h=uvBigEl.offsetHeight;uvBigEl.style.left=(left?r.left-S-24:Math.min(innerWidth-S-24,r.right+12))+'px';uvBigEl.style.top=Math.max(8,Math.min(innerHeight-h-8,r.top+r.height/2-h/2))+'px';},160);}
/* a thin white line blended into the pixels */
function uvLinePx(d,S,x0,y0,x1,y1,al){const n=Math.max(1,Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0))));for(let i=0;i<=n;i++){const px=Math.floor(x0+(x1-x0)*i/n),py=Math.floor(y0+(y1-y0)*i/n);if(px<0||py<0||px>=S||py>=S)continue;const o=(py*S+px)*4;d[o]+=(255-d[o])*al;d[o+1]+=(255-d[o+1])*al;d[o+2]+=(255-d[o+2])*al;}}
/* ---- the card in the Bake tab ---- */
function uvCard(L){uvBigHide();if(!L||!L.pos)return null;const an=uvAn(L),A=L.uvAuto,worst=uvWorst(an),flagged=an.none||!!worst||!!A;
  const card=el('div',{class:'uvcard',id:'uvCard'});
  const util=A?Math.round(A.util*100):0,chips=[];if(an.none)chips.push('No UVs');else{chips.push(an.islands+' island'+(an.islands===1?'':'s'));if(A)chips.push(util+'% of the square used');if(an.overlapPct>1)chips.push(Math.round(an.overlapPct)+'% overlap');}
  const head=el('div',{class:'uvhead'},el('div',{class:'sub',text:'UVs'}),el('span',{class:'uvstat'+(an.none||worst?' warn':''),id:'uvStat',text:chips.join(' · ')}),
    el('button',{class:'btn sm',id:'uvToggle',text:uvw.open||an.none?'Hide':'Review…',hidden:an.none,onclick:()=>{uvw.open=!uvw.open;buildBakePanel();}}));card.append(head);
  if(an.none){card.append(uvLine('This low-poly has no UVs, so nothing can be baked onto it.'),el('div',{class:'chips'},el('button',{class:'btn primary',id:'uvAuto',text:'Auto unwrap',disabled:uvw.busy,onclick:()=>uvAct('unwrap')})));return card;}
  if(worst&&!uvw.open)card.append(uvLine(worst.text+' Optimize packs the islands again; Re-roll tries another layout.'));
  if(!uvw.open&&!worst&&!A){return card;}
  if(!uvw.open&&(worst||A)){card.append(el('div',{class:'chips'},el('button',{class:'btn sm',id:'uvOpt',text:'Optimize layout',onclick:()=>uvAct('repack')}),el('button',{class:'btn sm',id:'uvRoll',text:'Re-roll',onclick:()=>uvAct('reroll')})));return card;}
  /* the full review */
  const O=Object.assign(uwDefaults(),L.uwOpt||{}),own=!L.uwRes,cv=el('canvas',{id:'uvPrev',width:240,height:240,class:'uvprev',title:'Hover for a bigger view',onpointerenter:()=>uvBigShow(cv),onpointerleave:uvBigHide});uvDrawPreview(cv,L);
  const seedIn=el('input',{type:'number',id:'uvSeed',min:1,max:99999,step:1,value:String(O.seed||1),'aria-label':'Seed',onchange:()=>uvAct(own?'repack':'reroll',{seed:Math.max(1,Math.round(+seedIn.value||1))})});
  const seg2=(id,opts,val,fn)=>seg(opts,val,fn,id);
  const padVal=O.padding||uwAutoPad(uvSizeNow());
  const ctl=el('div',{class:'uvctl'},
    ...(own?[]:[el('div',{class:'frow'},el('label',{text:'Style'}),(()=>{const s=el('select',{id:'uvPreset','aria-label':'Unwrap style'},...Object.entries(UW_PRESETS).map(([k,v])=>el('option',{value:k,text:v.label})));s.value=O.preset||'balanced';s.onchange=()=>uvAct('unwrap',uwPresetOpts(s.value));return s;})()),
      makeSlider({id:'uvAngle',label:'Seam angle',min:30,max:89,step:1,value:O.angle,fmt:v=>Math.round(v)+'°',onInput:v=>uvLive({angle:Math.round(v)}),onChange:v=>{clearTimeout(uvLiveTimer);uvLiveOpt=null;uvAct('unwrap',{angle:Math.round(v)},{quiet:true});}}).el]),
    makeSlider({id:'uvPad',label:'Padding',min:2,max:64,step:1,value:padVal,fmt:v=>Math.round(v)+' px',onInput:()=>{},onChange:v=>uvAct('layout',{padding:Math.round(v)})}).el,
    el('div',{class:'frow'},el('label',{text:'Layout'}),seg([['material','One square per material'],['shared','Shared square']],O.layout||'material',v=>uvAct('layout',{layout:v}),'Layout')),
    el('div',{class:'frow uvseed'},el('label',{for:'uvSeed',text:'Seed'}),seedIn,el('button',{class:'btn sm',id:'uvRoll',text:'Re-roll',title:'Try another layout (another seed)',onclick:()=>uvAct(own?'repack':'reroll')}),
      el('button',{class:'btn sm',id:'uvBest',text:'Best of 24',title:'Try 24 ways of packing the same pieces and keep the tightest',onclick:()=>uvAct('best')})),
    el('div',{class:'frow'},el('label',{text:'On the model'}),seg([['off','Off'],['check','Checker'],['stretch','Stretch'],['texel','Texel size']],uvw.view,v=>{uvw.view=v;uvViewSync();uvDrawPreview(cv,L);},'Show on the model')),
    el('div',{class:'chips'},chk('uvOverlap','Show overlaps',uvw.showOverlap,v=>{uvw.showOverlap=v;uvDrawPreview(cv,L);})),
    el('div',{class:'frow uvfoldrow'},makeSlider({id:'uvFold',label:'Unfold',min:0,max:1,step:.01,value:bk.fold||0,fmt:pct,onInput:v=>{uvw.anim=false;uvFoldSet(v);}}).el,el('button',{class:'btn sm',id:'uvPlay',text:uvw.anim?'Pause':'Play',title:'Unfold the model into its layout and fold it back',onclick:()=>uvFoldPlay()})),
    el('div',{class:'chips'},el('button',{class:'btn sm primary',id:'uvDice',text:'Roll the dice ('+UV_ROLLS+')',title:'Cut and pack '+UV_ROLLS+' different layouts and show them all',disabled:uvw.busy||own,onclick:()=>uvRoll()}),el('span',{class:'note',id:'uvRollNote',text:uvw.rollNote||''})),
    el('div',{class:'chips'},el('button',{class:'btn sm',id:'uvOpt',text:'Optimize layout',title:'Pack the islands again so they stop overlapping and fill the square',onclick:()=>uvAct('repack')}),
      el('button',{class:'btn sm',id:'uvRevert',text:'Original UVs',hidden:!(L.uwSrc&&!L.uwSrc.noUV),onclick:()=>uvAct('revert')}),
      el('button',{class:'btn sm',id:'uvExport',text:'Export model with UVs…',onclick:()=>dlgExportUV()})));
  card.append(el('div',{class:'uvreview'},cv,ctl));uvw.keepEl=true;
  if(uvw.gal.length)card.append(uvGalleryEl());
  if(an.issues.length)card.append(el('ul',{class:'uvissues'},...an.issues.filter(i=>i.kind!=='none').map(i=>el('li',{text:i.text}))));
  return card;}
/* the buttons of the card */
async function uvAct(what,optIn,flags){const quiet=!!(flags&&flags.quiet);if(uvw.busy)return;const old=(typeof bkLow==='function'?bkLow():null);if(!old)return;uvw.busy=true;uwStop.on=false;
  try{let nm=null;const o=optIn||{};
    if(what==='unwrap'){nm=await uvRunUnwrap(old.uwSrc?old:Object.assign({},old,{noUV:true,uwSrc:null}),Object.assign({},o,{seed:o.seed||(old.uwOpt&&old.uwOpt.seed)||1}),quiet);}
    else if(what==='reroll'){const seed=o.seed||((old.uwOpt&&old.uwOpt.seed)||1)+1;nm=await uvRunUnwrap(old,Object.assign({},o,{seed,packSeed:null}));}
    else if(what==='layout'){nm=old.uwRes?uvRelayout(old,o):uvRepackOwn(old,o);}
    else if(what==='repack'){const seed=o.seed||((old.uwOpt&&old.uwOpt.packSeed)||0)+1;nm=old.uwRes?uvRelayout(old,Object.assign({},o,{packSeed:seed,seed:old.uwOpt.seed})):uvRepackOwn(old,Object.assign({},o,{packSeed:seed,seed}));}
    else if(what==='best'){let best=null,bu=-1;const base=old.uwOpt&&old.uwOpt.packSeed||0;for(let k=0;k<24;k++){const ps=base+k+1,c=old.uwRes?uvRelayout(old,{packSeed:ps}):uvRepackOwn(old,{packSeed:ps});if(c&&c.uvAuto.util>bu){bu=c.uvAuto.util;best=c;}if(k%4===3)await uwYield();}nm=best;if(best)toast('Best of 24: '+Math.round(bu*100)+'% of the square used.');}
    else if(what==='revert'){const s=old.uwSrc;if(s){nm=Object.assign({},s);delete nm.uwSrc;delete nm.uwRes;delete nm.uwOpt;delete nm.uvAuto;delete nm._uvAn;delete nm._uvIsl;}}
    if(nm){nm._uvAn=null;nm._uvIsl=null;nm._uvMet=null;nm._uvStamp=(old._uvStamp||0)+1;uvReplaceMesh(old,nm);uvViewSync();}
  }catch(e){if(e&&e.message==='Stopped')toast('Stopped. The model is as it was.');else{console.warn(e);toast('The unwrap did not work: '+(e.message||e));}}finally{uvw.busy=false;if(ui.mode==='bake'){if(quiet&&uvw.keepEl)uvRefreshCard();else buildBakePanel();}}}
/* a light refresh while dragging: only the picture and the numbers change, not the controls under the pointer */
function uvRefreshCard(){const m=bkLow(),cv=$('#uvPrev');if(cv&&m)uvDrawPreview(cv,m);const st=$('#uvStat');if(st&&m){const an=uvAn(m),A=m.uvAuto;st.textContent=an.none?'No UVs':an.islands+' island'+(an.islands===1?'':'s')+(A?' · '+Math.round(A.util*100)+'% of the square used':'')+(an.overlapPct>1?' · '+Math.round(an.overlapPct)+'% overlap':'');}}
/* the checker on the model in the 3D view */
/* ---- exporting the model with its UVs ---- */
function uvExportMesh(){const m=ui.mode==='bake'?bkLow():(typeof mxModel==='function'?mxModel():null);return m&&m.pos?m:null;}
function dlgExportUV(){const m=uvExportMesh();if(!m){toast('Load a model first.');return;}if(m.noUV){toast('This model has no UVs yet: unwrap it first.');return;}
  const fmt=el('select',{id:'uvxFmt','aria-label':'Format'},...[['fbx','FBX (binary)'],['glb','glTF binary (.glb)'],['obj','OBJ']].map(([v,t])=>el('option',{value:v,text:t})));try{fmt.value=localStorage.getItem('gs.uvxFmt')||'fbx';}catch(e){}
  const unit=el('select',{id:'uvxUnit','aria-label':'Scale'},...[['file','As in the file I loaded'],['norm','Fit in 2 units (as shown in the app)']].map(([v,t])=>el('option',{value:v,text:t})));
  const body=el('div',{class:'dlg-grid'},uvLine('Writes “'+m.name+'” with its UVs: '+m.tris.toLocaleString()+' triangles, one material group per material. Normals and vertex colours are kept.'),
    el('div',{class:'frow'},el('label',{text:'Format'}),fmt),el('div',{class:'frow'},el('label',{text:'Size'}),unit));
  openDialog({title:'Export model with UVs',body,okLabel:'Export',onOk(){try{localStorage.setItem('gs.uvxFmt',fmt.value);}catch(e){}uvExportRun(m,fmt.value,unit.value==='file');}});}
async function uvExportRun(m,fmt,orig){try{const name=(m.name||'model').replace(/\.[a-z0-9]+$/i,'').replace(/[\\/:*?"<>|]+/g,'_'),bytes=fmt==='fbx'?uvFBX(m,name,orig):fmt==='glb'?uvGLB(m,name,orig):uvOBJ(m,name,orig);
    const r=await deliver(name+'_uv.'+fmt,new Blob([bytes],{type:'application/octet-stream'}));toast(deliveredText(r,'The model'));}catch(e){console.warn(e);toast('Could not export: '+(e.message||e));}}
/* the vertices in the file's own units and axes when asked (the app centres and shrinks every model) */
function uvPositions(m,orig){const P=m.pos,n=P.length/3,o=new Float64Array(P.length);
  if(orig&&m.xf){const {ctr,s}=m.xf;for(let i=0;i<n;i++)for(let k=0;k<3;k++)o[i*3+k]=P[i*3+k]/s+ctr[k];}else for(let i=0;i<P.length;i++)o[i]=P[i];return o;}
/* triangles grouped by material, in order */
function uvGroups(m){const T=m.idx.length/3,names=m.matNames||[],by=new Map();for(let t=0;t<T;t++){const k=m.triMat?(names[m.triMat[t]]||('Material'+m.triMat[t])):'Material';let a=by.get(k);if(!a)by.set(k,a=[]);a.push(t);}return [...by].map(([name,tris])=>({name,tris}));}
function uvOBJ(m,name,orig){const P=uvPositions(m,orig),n=P.length/3,f=v=>+v.toFixed(6),L=['# Gouache Studio · UVs by auto unwrap','o '+name];
  for(let i=0;i<n;i++)L.push('v '+f(P[i*3])+' '+f(P[i*3+1])+' '+f(P[i*3+2]));for(let i=0;i<n;i++)L.push('vt '+f(m.uv[i*2])+' '+f(1-m.uv[i*2+1]));
  const hasN=m.nrm&&m.nrm.length===m.pos.length;if(hasN)for(let i=0;i<n;i++)L.push('vn '+f(m.nrm[i*3])+' '+f(m.nrm[i*3+1])+' '+f(m.nrm[i*3+2]));
  const ref=i=>{const k=i+1;return hasN?k+'/'+k+'/'+k:k+'/'+k;};
  for(const g of uvGroups(m)){L.push('usemtl '+g.name.replace(/\s+/g,'_'));for(const t of g.tris)L.push('f '+ref(m.idx[t*3])+' '+ref(m.idx[t*3+1])+' '+ref(m.idx[t*3+2]));}
  return new TextEncoder().encode(L.join('\n')+'\n');}
function uvGLB(m,name,orig){const P=uvPositions(m,orig),n=P.length/3,parts=[],views=[],acc=[];let off=0;
  const add=(bytes,target)=>{const pad=(4-off%4)%4;if(pad){parts.push(new Uint8Array(pad));off+=pad;}views.push(Object.assign({buffer:0,byteOffset:off,byteLength:bytes.byteLength},target?{target}:{}));parts.push(new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength));off+=bytes.byteLength;return views.length-1;};
  const pos=Float32Array.from(P),mn=[1e30,1e30,1e30],mx=[-1e30,-1e30,-1e30];for(let i=0;i<n;i++)for(let j=0;j<3;j++){const v=pos[i*3+j];if(v<mn[j])mn[j]=v;if(v>mx[j])mx[j]=v;}
  acc.push({bufferView:add(pos,34962),componentType:5126,count:n,type:'VEC3',min:mn,max:mx});const A={POSITION:0};
  if(m.nrm&&m.nrm.length===m.pos.length){acc.push({bufferView:add(new Float32Array(m.nrm),34962),componentType:5126,count:n,type:'VEC3'});A.NORMAL=acc.length-1;}
  acc.push({bufferView:add(new Float32Array(m.uv),34962),componentType:5126,count:n,type:'VEC2'});A.TEXCOORD_0=acc.length-1;
  const materials=[],prims=[];for(const g of uvGroups(m)){const ix=new Uint32Array(g.tris.length*3);g.tris.forEach((t,i)=>{ix[i*3]=m.idx[t*3];ix[i*3+1]=m.idx[t*3+1];ix[i*3+2]=m.idx[t*3+2];});
    materials.push({name:g.name,pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:.6}});acc.push({bufferView:add(ix,34963),componentType:5125,count:ix.length,type:'SCALAR'});prims.push({attributes:A,indices:acc.length-1,material:materials.length-1});}
  const json={asset:{version:'2.0',generator:'Gouache Studio'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name}],meshes:[{name,primitives:prims}],accessors:acc,bufferViews:views,buffers:[{byteLength:off}],materials};
  const bin=new Uint8Array(off+((4-off%4)%4));let o=0;for(const p of parts){bin.set(p,o);o+=p.byteLength;}
  let js=new TextEncoder().encode(JSON.stringify(json));const jp=(4-js.length%4)%4;if(jp){const t=new Uint8Array(js.length+jp);t.set(js);t.fill(32,js.length);js=t;}
  const out=new Uint8Array(12+8+js.length+8+bin.length),dv=new DataView(out.buffer);dv.setUint32(0,0x46546C67,true);dv.setUint32(4,2,true);dv.setUint32(8,out.length,true);dv.setUint32(12,js.length,true);dv.setUint32(16,0x4E4F534A,true);out.set(js,20);
  dv.setUint32(20+js.length,bin.length,true);dv.setUint32(24+js.length,0x004E4942,true);out.set(bin,28+js.length);return out;}
/* ---- binary FBX 7.4 (what Blender, Maya, Unity, Unreal and Godot read): one mesh, its UVs, normals and a material per group ---- */
function uvFBX(m,name,orig){const P=uvPositions(m,orig),n=P.length/3,T=m.idx.length/3,groups=uvGroups(m),te=new TextEncoder();
  /* a growing byte buffer */
  let buf=new Uint8Array(1<<20),len=0;const dvOf=()=>new DataView(buf.buffer);const need=k=>{if(len+k>buf.length){const nb=new Uint8Array(Math.max(buf.length*2,len+k));nb.set(buf.subarray(0,len));buf=nb;}};
  const u8=v=>{need(1);buf[len++]=v;},u32=v=>{need(4);dvOf().setUint32(len,v>>>0,true);len+=4;},bytes=b=>{need(b.length);buf.set(b,len);len+=b.length;};
  const f64=v=>{need(8);dvOf().setFloat64(len,v,true);len+=8;},i64=v=>{need(8);dvOf().setBigInt64(len,BigInt(v),true);len+=8;},i32=v=>{need(4);dvOf().setInt32(len,v|0,true);len+=4;};
  /* node writers: props are [type, value] */
  const prop=p=>{const [t,v]=p;u8(t.charCodeAt(0));
    if(t==='I')i32(v);else if(t==='L')i64(v);else if(t==='D')f64(v);else if(t==='C')u8(v?1:0);
    else if(t==='S'||t==='R'){const b=typeof v==='string'?te.encode(v):v;u32(b.length);bytes(b);}
    else{const w=t==='d'?8:4;u32(v.length);u32(0);u32(v.length*w);need(v.length*w);const dv=dvOf();for(let i=0;i<v.length;i++){if(t==='d')dv.setFloat64(len+i*8,v[i],true);else dv.setInt32(len+i*4,v[i],true);}len+=v.length*w;}};
  const node=(nm,props,kids)=>{const start=len;u32(0);u32(props.length);const lenPos=len;u32(0);const nb=te.encode(nm);u8(nb.length);bytes(nb);const ps=len;for(const p of props)prop(p);dvOf().setUint32(lenPos,len-ps,true);
    if(kids&&kids.length){for(const k of kids)k();for(let i=0;i<13;i++)u8(0);}dvOf().setUint32(start,len,true);};
  const N=(nm,props,kids)=>()=>node(nm,props||[],kids),S=v=>['S',v],I=v=>['I',v],L=v=>['L',v],D=v=>['D',v];
  const idGeo=100001,idModel=100002,mats=groups.map((g,i)=>200001+i);
  /* geometry: one polygon list, the last index of each triangle written as -(i+1) */
  const verts=Array.from(P),pidx=new Array(T*3),mi=new Array(T);for(let t=0;t<T;t++){pidx[t*3]=m.idx[t*3];pidx[t*3+1]=m.idx[t*3+1];pidx[t*3+2]=-(m.idx[t*3+2]+1);}
  groups.forEach((g,gi)=>{for(const t of g.tris)mi[t]=gi;});
  const hasN=m.nrm&&m.nrm.length===m.pos.length,uvs=new Array(n*2);for(let i=0;i<n;i++){uvs[i*2]=m.uv[i*2];uvs[i*2+1]=1-m.uv[i*2+1];}
  const kids=[N('GeometryVersion',[I(124)]),N('Vertices',[['d',verts]]),N('PolygonVertexIndex',[['i',pidx]]),
    ...(hasN?[N('LayerElementNormal',[I(0)],[N('Version',[I(101)]),N('Name',[S('')]),N('MappingInformationType',[S('ByVertice')]),N('ReferenceInformationType',[S('Direct')]),N('Normals',[['d',Array.from(m.nrm)]])])]:[]),
    N('LayerElementUV',[I(0)],[N('Version',[I(101)]),N('Name',[S('UVMap')]),N('MappingInformationType',[S('ByVertice')]),N('ReferenceInformationType',[S('Direct')]),N('UV',[['d',uvs]])]),
    N('LayerElementMaterial',[I(0)],[N('Version',[I(101)]),N('Name',[S('')]),N('MappingInformationType',[S('ByPolygon')]),N('ReferenceInformationType',[S('IndexToDirect')]),N('Materials',[['i',mi]])]),
    N('Layer',[I(0)],[N('Version',[I(100)]),...(hasN?[N('LayerElement',[],[N('Type',[S('LayerElementNormal')]),N('TypedIndex',[I(0)])])]:[]),N('LayerElement',[],[N('Type',[S('LayerElementUV')]),N('TypedIndex',[I(0)])]),N('LayerElement',[],[N('Type',[S('LayerElementMaterial')]),N('TypedIndex',[I(0)])])])];
  const P70=(props)=>N('Properties70',[],props.map(p=>N('P',p)));
  /* header */
  bytes(te.encode('Kaydara FBX Binary  '));u8(0);u8(0x1a);u8(0);u32(7400);
  node('FBXHeaderExtension',[],[N('FBXHeaderVersion',[I(1003)]),N('FBXVersion',[I(7400)]),N('Creator',[S('Gouache Studio')])].map(f=>f));
  node('GlobalSettings',[],[N('Version',[I(1000)]),P70([[S('UpAxis'),S('int'),S('Integer'),S(''),I(1)],[S('UpAxisSign'),S('int'),S('Integer'),S(''),I(1)],[S('FrontAxis'),S('int'),S('Integer'),S(''),I(2)],[S('FrontAxisSign'),S('int'),S('Integer'),S(''),I(1)],[S('CoordAxis'),S('int'),S('Integer'),S(''),I(0)],[S('CoordAxisSign'),S('int'),S('Integer'),S(''),I(1)],[S('UnitScaleFactor'),S('double'),S('Number'),S(''),D(1)]])]);
  node('Definitions',[],[N('Version',[I(100)]),N('Count',[I(2+mats.length)]),N('ObjectType',[S('Geometry')],[N('Count',[I(1)])]),N('ObjectType',[S('Model')],[N('Count',[I(1)])]),N('ObjectType',[S('Material')],[N('Count',[I(mats.length)])])]);
  node('Objects',[],[N('Geometry',[L(idGeo),S('Geometry::'+name),S('Mesh')],kids),
    N('Model',[L(idModel),S('Model::'+name),S('Mesh')],[N('Version',[I(232)]),P70([[S('Lcl Translation'),S('Lcl Translation'),S(''),S('A'),D(0),D(0),D(0)]]),N('Shading',[['C',1]]),N('Culling',[S('CullingOff')])]),
    ...groups.map((g,i)=>N('Material',[L(mats[i]),S('Material::'+g.name),S('')],[N('Version',[I(102)]),N('ShadingModel',[S('lambert')]),N('MultiLayer',[I(0)]),P70([[S('DiffuseColor'),S('Color'),S(''),S('A'),D(.8),D(.8),D(.8)]])]))]);
  node('Connections',[],[N('C',[S('OO'),L(idModel),L(0)]),N('C',[S('OO'),L(idGeo),L(idModel)]),...mats.map(id=>N('C',[S('OO'),L(id),L(idModel)]))]);
  for(let i=0;i<13;i++)u8(0);
  /* the footer older readers look for */
  bytes(Uint8Array.from([0xfa,0xbc,0xab,0x09,0xd0,0xc8,0xd4,0x66,0xb1,0x76,0xfb,0x83,0x1c,0xf7,0x26,0x7e]));const pad=(16-len%16)%16||16;for(let i=0;i<pad;i++)u8(0);u32(0);u32(7400);for(let i=0;i<120;i++)u8(0);
  bytes(Uint8Array.from([0xf8,0x5a,0x8c,0x6a,0xde,0xf5,0xd9,0x7e,0xec,0xe9,0x0c,0xe3,0x75,0x8f,0x29,0x0b]));
  return buf.slice(0,len);}
/* the File menu entry (3D Paint and Bake) */
if(typeof actions!=='undefined')actions.exportUV=()=>dlgExportUV();
{const F=typeof MENUS!=='undefined'?MENUS.File:null;if(F){const i=F.findIndex(x=>Array.isArray(x)&&/Export/i.test(x[0]));F.splice(i>=0?i+1:F.length,0,['Export model with UVs…','exportUV']);}}
