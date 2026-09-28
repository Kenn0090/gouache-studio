/* ================= Mesh maps from a material =================
   Reads a material layer's height (or its normal, rebuilt into a height) and makes the maps masks and
   generators use: curvature, edges, creases, cavity AO, and a roughness and a metallic that follow them.
   They go where you tick: the texture set's mesh maps as "converted" maps (masks, generators and the Material
   panel's Converted tab use them), added onto the baked maps, new layers, and/or the material's own roughness
   and metallic (linked, so they update when you make them again). */
const MC_MAPS=[['curv','Curvature'],['ao','Cavity AO'],['curvEdge','Edges'],['curvCrease','Creases'],['rough','Roughness'],['metal','Metallic']];
const FS_MCRM=`uniform sampler2D uC; uniform sampler2D uA; uniform int uWhat; uniform float uTop; uniform float uGap; uniform float uAmt; uniform int uOn;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float c=texelFetch(uC,p,0).r, a=texelFetch(uA,p,0).r, cav=clamp((1.0-a)*1.6+max(0.0,0.5-c)*2.0,0.0,1.0), edge=clamp((c-0.5)*2.0,0.0,1.0);
  float v; if(uWhat==0) v=mix(uTop,uGap,cav);
  else { float s=uOn==0?edge:cav; v=smoothstep(1.0-uAmt-0.08,1.0-uAmt+0.08,s); }
  o=vec4(vec3(v),1.0); }`;
/* adding onto a baked map: curvature shifts by the detail's own, AO multiplies */
const FS_MCADD=`uniform sampler2D uB; uniform sampler2D uD; uniform int uAO; void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float b=texelFetch(uB,p,0).r, d=texelFetch(uD,p,0).r; o=vec4(vec3(uAO==1?b*d:clamp(b+(d-0.5),0.0,1.0)),1.0); }`;
let P_MC=null;
const mcCfg={curv:true,ao:true,curvEdge:true,curvCrease:false,rough:true,metal:false,r:4,str:1,aoR:16,top:.35,gap:.9,metalOn:'edge',metalAmt:.5,toMesh:true,toBaked:false,toLayers:false,toMat:false};
function mcSource(L){const h=mapT(L,'height'),n=mapT(L,'normal');if(h&&!h.empty)return {h,own:false};
  if(n&&!n.empty){const t=makeTarget(doc.w,doc.h,16);heightFromNormal(n,t,{str:1,iter:50,dx:false});return {h:t,own:true};}return null;}
/* the maps themselves (new targets, document size) */
function mcMake(L,cfg){const src=mcSource(L);if(!src)return null;if(!P_MC)P_MC={rm:program(FS_MCRM),add:program(FS_MCADD)};const out={},H=src.h,mk=()=>makeTarget(doc.w,doc.h,8,false);
  const curvMode=m=>{const t=mk(),b1=blurOf(H,cfg.r),b2=blurOf(H,cfg.r*3);run(P.f_curv,t,{uH:H.tex,uB1:b1.tex,uB2:b2.tex,uStr:cfg.str,uMode:{int:m}});release(b1);release(b2);return t;};
  const need=k=>cfg[k]||((k==='curv'||k==='ao')&&(cfg.rough||cfg.metal));
  if(need('curv'))out.curv=curvMode(0);if(cfg.curvEdge)out.curvEdge=curvMode(1);if(cfg.curvCrease)out.curvCrease=curvMode(2);
  if(need('ao')){const t=mk(),r=cfg.aoR,b1=blurOf(H,r*.25),b2=blurOf(H,r*.5),b3=blurOf(H,r);run(P.f_ao,t,{uH:H.tex,uB1:b1.tex,uB2:b2.tex,uB3:b3.tex,uStr:cfg.str});[b1,b2,b3].forEach(release);out.ao=t;}
  if(cfg.rough){const t=mk();run(P_MC.rm,t,{uC:out.curv.tex,uA:out.ao.tex,uWhat:{int:0},uTop:cfg.top,uGap:cfg.gap,uAmt:0,uOn:{int:0}});out.rough=t;}
  if(cfg.metal){const t=mk();run(P_MC.rm,t,{uC:out.curv.tex,uA:out.ao.tex,uWhat:{int:1},uTop:0,uGap:0,uAmt:cfg.metalAmt,uOn:{int:cfg.metalOn==='edge'?0:1}});out.metal=t;}
  if(src.own)disposeTarget(src.h);
  for(const k of ['curv','ao'])if(out[k]&&!cfg[k]){disposeTarget(out[k]);delete out[k];}
  return out;}
function mcRun(L,cfg){const maps=mcMake(L,cfg);if(!maps){toast('“'+L.name+'” has no height or normal to read. Give its material a Height or Normal image first.');return;}
  const M=doc.meshMaps||(doc.meshMaps={}),before=Object.assign({},M),made=Object.keys(maps);
  if(cfg.toMesh||cfg.toMat)for(const k of made){const key='cv:'+k,t=makeTarget(doc.w,doc.h,8,false);blit(maps[k],t,0,0,doc.w,doc.h,0,0);M[key]=t;}
  if(cfg.toBaked)for(const k of ['curv','ao','curvEdge','curvCrease']){if(!maps[k]||!M[k])continue;const t=makeTarget(M[k].w,M[k].h,M[k].depth,false),d=makeTarget(M[k].w,M[k].h,8,false);copyScaled(maps[k],d);run(P_MC.add,t,{uB:M[k].tex,uD:d.tex,uAO:{int:k==='ao'?1:0}});disposeTarget(d);M[k]=t;}
  const after=Object.assign({},M);
  const lays=[];if(cfg.toLayers)for(const k of made){const Ln=newLayerObj((MC_MAPS.find(x=>x[0]===k)||[k,k])[1]+' (from '+L.name+')');doc.count--;
    const own=k==='rough'||k==='metal'?k:'base';if(own!=='base'&&!doc.maps.includes(own))continue;for(const x of Object.keys(Ln.maps))if(x!==own){disposeTarget(Ln.maps[x]);delete Ln.maps[x];}
    blit(maps[k],ensureMapTarget(Ln,own),0,0,doc.w,doc.h,0,0);if(own!=='base'){Ln.blankBase=true;setMapModeOf(Ln,own,0);}
    if(k==='ao')Ln.mode=MODES.indexOf('Multiply');else if(own==='base'&&k!=='ao'&&/^curv/.test(k))Ln.mode=MODES.indexOf('Overlay');lays.push(Ln);}
  const fB=L.fill?fillClone(L.fill):null;
  if(cfg.toMat&&L.fill)for(const k of ['rough','metal'])if(maps[k]&&doc.maps.includes(k)){const s=L.fill.maps[k]||(L.fill.maps[k]=fillDefaults().maps[k]);Object.assign(s,{on:true,src:'conv',mm:'cv:'+k});}
  const fA=L.fill?fillClone(L.fill):null;
  const apply=(mm,f,add)=>{doc.meshMaps=Object.assign({},mm);if(L.fill&&f){L.fill=fillClone(f);fillRender(L);}msEpoch++;if(typeof buildP3Panel==='function'&&ui.mode==='p3d')buildP3Panel();renderMatEd(true);};
  const P0=lays[0]&&insertPoint();
  pushUndo({label:'Mesh maps from “'+L.name+'”',refs:[L,...lays],undo(){apply(before,fB);for(const n of lays)detachNode(n);changedAll();},redo(){apply(after,fA);for(const n of lays)insertNode(n,P0[0],P0[1]);changedAll();}});
  for(const n of lays)insertNode(n,P0[0],P0[1]);apply(after,fA);for(const k of made)disposeTarget(maps[k]);changedAll();
  toast('Made '+made.map(k=>(MC_MAPS.find(x=>x[0]===k)||[k,k])[1].toLowerCase()).join(', ')+' from “'+L.name+'”.');}
function dlgMatConvert(L){L=L||doc.active;if(!isLayer(L)||L.fx){toast('Select a material layer first.');return;}const c=mcCfg;
  const box=el('div',{class:'dlg-grid'},el('p',{class:'note',text:'Reads the height of “'+L.name+'” (or its normal) and makes the maps masks and generators use.'}),el('div',{class:'sub',text:'Make'}),
    el('div',{class:'chips'},...MC_MAPS.map(([k,t])=>chk('mc_'+k,t,!!c[k],v=>{c[k]=v;}))),
    makeSlider({id:'mc_r',label:'Radius',min:1,max:32,step:.5,value:c.r,fmt:v=>v+'px',onInput:v=>{c.r=v;}}).el,
    makeSlider({id:'mc_s',label:'Strength',min:.1,max:4,step:.05,value:c.str,fmt:pct,onInput:v=>{c.str=v;}}).el,
    makeSlider({id:'mc_aor',label:'AO reach',min:2,max:96,step:1,value:c.aoR,fmt:v=>v+'px',onInput:v=>{c.aoR=v;}}).el,
    makeSlider({id:'mc_top',label:'Roughness on tops',min:0,max:1,step:.01,value:c.top,fmt:pct,onInput:v=>{c.top=v;}}).el,
    makeSlider({id:'mc_gap',label:'Roughness in gaps',min:0,max:1,step:.01,value:c.gap,fmt:pct,onInput:v=>{c.gap=v;}}).el,
    el('div',{class:'frow'},el('label',{text:'Bare metal on'}),seg([['edge','Worn edges'],['cav','Cavities']],c.metalOn,v=>{c.metalOn=v;},'Bare metal on')),
    makeSlider({id:'mc_ma',label:'Metal amount',min:0,max:1,step:.01,value:c.metalAmt,fmt:pct,onInput:v=>{c.metalAmt=v;}}).el,
    el('div',{class:'sub',text:'Send to (any of them)'}),
    chk('mc_toMesh','Mesh maps, as converted maps (masks, generators and the Converted tab use them)',c.toMesh,v=>{c.toMesh=v;}),
    chk('mc_toBaked','Also add them onto the baked maps',c.toBaked,v=>{c.toBaked=v;}),
    chk('mc_toLayers','New layers',c.toLayers,v=>{c.toLayers=v;}),
    L.fill?chk('mc_toMat','Into this material’s own roughness and metallic',c.toMat,v=>{c.toMat=v;}):null);
  openDialog({title:'Mesh maps from a material',body:box,okLabel:'Make',onOk(){if(!MC_MAPS.some(([k])=>c[k])){toast('Tick at least one map.');return false;}
    if(!(c.toMesh||c.toBaked||c.toLayers||c.toMat)){toast('Tick where they go.');return false;}mcRun(L,c);}});}
