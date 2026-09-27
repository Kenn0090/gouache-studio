/* ================= Material workflow: Metal/Rough or Specular/Gloss =================
   doc.workflow 'metal': base colour + metallic + roughness. 'spec': diffuse (kept in the 'base' map) + specular
   (a colour map) + glossiness. Shading always uses metal/rough: a Specular/Gloss document is converted on the
   fly (the Khronos glTF spec/gloss conversion). Switching a document converts its finished look into one new
   group per map; the maps it had before are set aside on each layer (L.wfStash) so switching back can restore them. */
const WF_KEYS={metal:['rough','metal'],spec:['spec','gloss']};
const WF_NAMES={metal:'Metal/Rough',spec:'Specular/Gloss'};
const FS_WF=`
vec3 toLin(vec3 c){ return pow(max(c,vec3(0.0)),vec3(2.2)); } vec3 toSrgb(vec3 c){ return pow(max(c,vec3(0.0)),vec3(1.0/2.2)); }
float lum(vec3 c){ return sqrt(0.299*c.r*c.r+0.587*c.g*c.g+0.114*c.b*c.b); }`;
/* spec/gloss -> base/metal/rough; uOut 0 base colour (premultiplied like the diffuse), 1 metallic, 2 roughness */
const FS_SG2MR=FS_WF+`uniform sampler2D uD; uniform sampler2D uS; uniform sampler2D uG; uniform int uHasS; uniform int uHasG; uniform vec2 uDef; uniform int uOut;
float solveMetal(float d,float s,float oms){ if(s<0.04) return 0.0; float a=0.04,b=d*oms/(1.0-a)+s-2.0*a,c=a-s,D=max(b*b-4.0*a*c,0.0); return clamp((-b+sqrt(D))/(2.0*a),0.0,1.0); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 d4=texelFetch(uD,p,0); vec3 D=toLin(d4.a>1e-6?d4.rgb/d4.a:vec3(0.0));
  vec4 s4=uHasS==1?texelFetch(uS,p,0):vec4(vec3(uDef.x),1.0); vec3 S=toLin(s4.a>1e-6?s4.rgb/s4.a:vec3(uDef.x));
  float g=uHasG==1?texelFetch(uG,p,0).r:uDef.y; float oms=1.0-max(S.r,max(S.g,S.b)); float m=solveMetal(lum(D),lum(S),oms);
  if(uOut==1){ o=vec4(vec3(m),1.0); return; } if(uOut==2){ o=vec4(vec3(1.0-g),1.0); return; }
  vec3 bd=D*oms/(1.0-0.04)/max(1.0-m,1e-4), bs=(S-vec3(0.04)*(1.0-m))/max(m,1e-4); vec3 B=clamp(mix(bd,bs,m*m),0.0,1.0);
  o=vec4(toSrgb(B)*d4.a,d4.a); }`;
/* base/metal/rough -> spec/gloss; uOut 0 diffuse (premultiplied), 1 specular, 2 glossiness */
const FS_MR2SG=FS_WF+`uniform sampler2D uB; uniform sampler2D uM; uniform sampler2D uR; uniform int uHasM; uniform int uHasR; uniform vec2 uDef; uniform int uOut;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 b4=texelFetch(uB,p,0); vec3 B=toLin(b4.a>1e-6?b4.rgb/b4.a:vec3(0.0));
  float m=uHasM==1?texelFetch(uM,p,0).r:uDef.x, r=uHasR==1?texelFetch(uR,p,0).r:uDef.y;
  if(uOut==2){ o=vec4(vec3(1.0-r),1.0); return; }
  if(uOut==1){ o=vec4(toSrgb(mix(vec3(0.04),B,m)),1.0); return; }
  o=vec4(toSrgb(B*(1.0-m))*b4.a,b4.a); }`;
let P_WF=null;const wfP=()=>P_WF||(P_WF={sg2mr:program(FS_SG2MR),mr2sg:program(FS_MR2SG)});
/* the base/metal/rough a document shades with, as images of the whole document ({base,metal,rough,own}: own ones are released by the caller) */
function sgAsMR(diff,spec,gloss){const P2=wfP(),out={};
  for(const [i,k] of [[0,'base'],[1,'metal'],[2,'rough']]){const t=acquireD(k==='base'?diff.depth:doc.depth);
    run(P2.sg2mr,t,{uD:diff.tex,uS:spec?spec.tex:dummy,uG:gloss?gloss.tex:dummy,uHasS:!!spec,uHasG:!!gloss,uDef:[mapDefault('spec')[0],mapDefault('gloss')[0]],uOut:{int:i}});out[k]=t;}
  return out;}
function mrAsSG(base,metal,rough){const P2=wfP(),out={};
  for(const [i,k] of [[0,'base'],[1,'spec'],[2,'gloss']]){const t=acquireD(k==='base'?base.depth:doc.depth);
    run(P2.mr2sg,t,{uB:base.tex,uM:metal?metal.tex:dummy,uR:rough?rough.tex:dummy,uHasM:!!metal,uHasR:!!rough,uDef:[mapDefault('metal')[0],mapDefault('rough')[0]],uOut:{int:i}});out[k]=t;}
  return out;}
/* ---- switching ---- */
function wfLayers(){return paintLayers().filter(L=>L.maps);}
function wfCanRestore(to){return wfLayers().some(L=>L.wfStash&&L.wfStash[to]);}
/* one undo step: the tree, each layer's maps and stashes, the document's map list and workflow */
function wfSnap(){return {tree:snapTree(),layers:wfLayers().map(L=>({L,maps:Object.assign({},L.maps),stash:L.wfStash?Object.keys(L.wfStash).reduce((o,k)=>(o[k]=Object.assign({},L.wfStash[k]),o),{}):null,blank:!!L.blankBase,target:L.target})),
  maps:doc.maps.slice(),mapDef:Object.assign({},doc.mapDef),wf:doc.workflow,map:doc.map,view:doc.view};}
function wfApply(S){restoreTree(S.tree);for(const x of S.layers){x.L.maps=Object.assign({},x.maps);x.L.wfStash=x.stash?Object.keys(x.stash).reduce((o,k)=>(o[k]=Object.assign({},x.stash[k]),o),{}):null;if(x.blank)x.L.blankBase=true;else delete x.L.blankBase;}
  doc.maps=S.maps.slice();doc.mapDef=Object.assign({},S.mapDef);doc.workflow=S.wf;doc.map=S.map;doc.view=S.view;useAux(mapDepth(doc.map));syncTargets();changedAll();renderLayers();refreshMapsUI();buildBrushPanel();}
/* how = 'convert' (the current look into new layers) or 'restore' (the layers set aside the last time) */
function wfSwitch(to,how){const from=doc.workflow||'metal';if(to===from)return;if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  if(ui.mode!=='paint'){toast('Switch to Paint first.');return;}
  if(typeof xf!=='undefined'&&xf)xfCommit();if(doc.map!=='base')setEditMap('base');
  const before=wfSnap(),oldK=WF_KEYS[from],newK=WF_KEYS[to],had=oldK.filter(k=>doc.maps.includes(k)),made=[];
  let res=null;
  if(how!=='restore'){/* the finished look, converted */
    const base=compositeMap('base'),a=had.includes(oldK[0])?compositeMap(oldK[0]):null,b=had.includes(oldK[1])?compositeMap(oldK[1]):null;
    res=from==='metal'?mrAsSG(base,b,a):sgAsMR(base,a,b);release(base);if(a)release(a);if(b)release(b);}
  /* set the old workflow's maps aside on every layer */
  for(const L of wfLayers()){const st={};for(const k of ['base',...oldK])if(L.maps[k]&&!L.maps[k].empty){st[k]=L.maps[k];delete L.maps[k];}
    if(!L.maps.base)L.maps.base=makeTarget(doc.w,doc.h,mapDepth('base'));
    if(Object.keys(st).length){L.wfStash=L.wfStash||{};L.wfStash[from]=Object.assign(st,{blank:!!L.blankBase});L.blankBase=true;}}
  if(how==='restore'){for(const L of wfLayers()){const st=L.wfStash&&L.wfStash[to];if(!st)continue;for(const k of Object.keys(st))if(k!=='blank'){if(k==='base'&&L.maps.base)disposeTarget(L.maps.base);L.maps[k]=st[k];}
      if(st.blank)L.blankBase=true;else delete L.blankBase;delete L.wfStash[to];}
    /* the groups the last switch made hold nothing now: take them out */
    for(const n of [...doc.root.children])if(n.wfMade===from)detachNode(n);}
  else{const names=to==='spec'?{base:'Diffuse',spec:'Specular',gloss:'Glossiness'}:{base:'Base colour',metal:'Metallic',rough:'Roughness'};
    for(const k of ['base',...newK]){const L=newLayerObj(names[k]);for(const x of Object.keys(L.maps))if(x!=='base'){disposeTarget(L.maps[x]);delete L.maps[x];}
      if(k==='base'){blit(res.base,L.maps.base,0,0,doc.w,doc.h,0,0);}else{L.maps[k]=makeTarget(doc.w,doc.h,mapDepth(k));blit(res[k],L.maps[k],0,0,doc.w,doc.h,0,0);L.blankBase=true;}
      const G=newGroupObj(names[k]+' (converted)');G.open=false;G.wfMade=to;insertNode(L,G);made.push(G);}
    for(const k of Object.keys(res))release(res[k]);
    for(const G of made.reverse())insertNode(G,doc.root);}
  doc.workflow=to;doc.maps=MAP_ORDER.filter(k=>(doc.maps.includes(k)&&!oldK.includes(k))||newK.includes(k));
  useAux(mapDepth(doc.map));syncTargets();
  const after=wfSnap();
  pushUndo({label:'Switch to '+WF_NAMES[to],refs:[],undo(){wfApply(before);},redo(){wfApply(after);}});
  changedAll();renderLayers();refreshMapsUI();buildBrushPanel();if(typeof v3Changed==='function')v3Changed();
  toast(how==='restore'?'Back to '+WF_NAMES[to]+': your layers are as they were.':'Now '+WF_NAMES[to]+'. The look was converted into new groups; the '+WF_NAMES[from]+' maps are set aside, so switching back can restore them.');}
/* asks restore or convert when layers from before are set aside */
function wfAsk(to,after){if(!wfCanRestore(to)){wfSwitch(to,'convert');if(after)after();return;}
  const body=el('div',{class:'dlg-grid'},el('p',{class:'note',text:'Your '+WF_NAMES[to]+' layers from before are still here. Bring them back as they were (what you painted in '+WF_NAMES[doc.workflow]+' is dropped), or convert the current look into new layers?'}));
  openDialog({title:'Switch to '+WF_NAMES[to],body,okLabel:'Bring them back',cancelLabel:'Convert instead',onOk(){wfSwitch(to,'restore');if(after)after();},onCancel(){setTimeout(()=>{wfSwitch(to,'convert');if(after)after();},0);}});}
