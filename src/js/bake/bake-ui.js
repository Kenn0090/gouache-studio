/* ================= Baker: dialog and results =================
   Maps › Bake from high poly… Results arrive as new layers: normal into the Normal map, height
   into Height, AO into Ambient occlusion; curvature, thickness, world-space normal, position
   and ID go into a hidden "Baked maps" group in base colour, ready to use as masks. */
const bakeCfg={low:null,high:null,cage:null,match:false,average:true,front:2.5,back:2.5,kinds:{normal:true,ao:true,curv:true,height:false,thick:false,wnormal:false,position:false,id:false},
  rays:64,aoDist:25,thickDist:50,ss:2,pad:16};
const BAKE_NAMES={normal:'Normal',ao:'Ambient occlusion',curv:'Curvature',height:'Height',thick:'Thickness',wnormal:'World-space normal',position:'Position',id:'ID colours'};
/* read a model file (OBJ, glTF, GLB, FBX) */
async function bakePickModel(){const load=async(name,bytes,sib)=>{const ext=extOf(name),buf=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    if(ext==='obj')return parseOBJ(new TextDecoder().decode(bytes),baseName(name));if(ext==='glb'||ext==='gltf')return parseGLTF(buf,baseName(name),sib);
    if(ext==='fbx')return parseFBX(buf,baseName(name));throw new Error('Use an OBJ, glTF, GLB or FBX file.');};
  if(platform.isDesktop){const p=await platform.openDialog([{name:'3D models',extensions:['obj','glb','gltf','fbx']}]);if(!p)return null;const bytes=await platform.readFile(p);
    const dir=p.replace(/[\\/][^\\/]*$/,''),sep=p.includes('\\')?'\\':'/';return load(fileNameOf(p),bytes,async u=>{const b=await platform.readFile(dir+sep+u);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);});}
  return new Promise((res,rej)=>{const f=el('input',{type:'file',accept:'.obj,.glb,.gltf,.fbx'});f.onchange=async()=>{const file=f.files[0];if(!file){res(null);return;}try{res(await load(file.name,new Uint8Array(await file.arrayBuffer()),null));}catch(e){rej(e);}};f.click();});}
/* the model shown in the 3D view, at its own detail (not subdivided) */
function bakeViewModel(){const s=v3s();if(s.model==='imported'&&v3.imported)return v3.imported;return primMesh(PRIMS[s.model]?s.model:'plane',0);}
/* put a model into the low-poly's space */
function bakeAlign(m,low){const s=m.xf.s,c=m.xf.ctr,ls=low.xf.s,lc=low.xf.ctr,pos=new Float32Array(m.pos.length);
  for(let i=0;i<pos.length;i+=3)for(let k=0;k<3;k++)pos[i+k]=(m.pos[i+k]/s+c[k]-lc[k])*ls;return Object.assign({},m,{pos});}
const partBase=n=>String(n||'').replace(/[_\-\s.]*(low|high|lo|hi|lp|hp)(poly)?$/i,'').toLowerCase();
function dlgBake(){if(stroke||preview||selLive){toast('Finish the current edit first.');return;}if(ui.mode==='anim'){toast('Switch to paint mode to bake.');return;}
  if(!canFloat){toast('Baking needs 16-bit float support, which this graphics card lacks.');return;}
  const C=bakeCfg;const body=el('div',{class:'dlg-grid bake'});
  const row=(label,ctrl)=>el('div',{class:'frow'},el('label',{text:label}),ctrl);
  const modelSel=(key,opts)=>{const s=el('select',{'aria-label':key});const draw=()=>{s.replaceChildren(...opts().map(([v,t])=>el('option',{value:v,text:t})));s.value=C[key]&&C[key].name?'file':opts()[0][0];};
    s.onchange=async()=>{if(s.value==='load'){try{const m=await bakePickModel();if(m){C[key]=m;if(key==='high'&&m.tris>6e6)toast('That is a very large high-poly; baking will be slow.');}}catch(e){toast('This model could not be loaded: '+(e.message||e));}draw();info();return;}
      if(s.value!=='file')C[key]=null;info();};draw();return s;};
  const lowOpts=()=>[['view','Model in the 3D view ('+bakeViewModel().name+')'],...(C.low?[['file',C.low.name+' · '+C.low.tris.toLocaleString()+' triangles']]:[]),['load','Load a model file…']];
  const highOpts=()=>[['none','None: bake the low-poly on its own (AO, curvature, thickness, ID…)'],...(C.high?[['file',C.high.name+' · '+C.high.tris.toLocaleString()+' triangles']]:[]),['load','Load a model file…']];
  const cageOpts=()=>[['none','Push out by the front distance'],...(C.cage?[['file',C.cage.name]]:[]),['load','Load a cage model…']];
  const inf=el('p',{class:'note'});
  const info=()=>{const L=C.low||bakeViewModel();const bits=[];if(L.noUV)bits.push('The low-poly has no UVs: nothing can be baked onto it.');
    if(C.cage&&(C.cage.verts!==L.verts||C.cage.tris!==L.tris))bits.push('The cage must be the low-poly pushed outwards: same vertices and triangles ('+L.verts+' / '+L.tris+'). This one does not match.');
    if(C.match){const lp=new Set((L.partNames||[]).map(partBase)),hp=new Set(((C.high||{}).partNames||[]).map(partBase));const both=[...lp].filter(x=>hp.has(x));
      bits.push(both.length?'Matching '+both.length+' part'+(both.length>1?'s':'')+' by name: '+both.slice(0,6).join(', ')+(both.length>6?'…':'')+'.':'No part names match between the models (use names like “crate_low” and “crate_high”).');}
    bits.push('Bakes at the document size, '+doc.w+' × '+doc.h+'.');inf.textContent=bits.join(' ');};
  const S=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:C[key],fmt,onInput:v=>{C[key]=v;}}).el;
  const kinds=el('div',{class:'chips bakekinds'},...Object.keys(BAKE_NAMES).map(k=>chk('bk_'+k,BAKE_NAMES[k],!!C.kinds[k],v=>{C.kinds[k]=v;})));
  body.append(row('Low-poly',modelSel('low',lowOpts)),row('High-poly',modelSel('high',highOpts)),row('Cage',modelSel('cage',cageOpts)),
    chk('bkMatch','Match parts by name (“_low” bakes only against its “_high”)',C.match,v=>{C.match=v;info();}),
    S('bkFront','Front','front',0,20,.1,v=>v.toFixed(1)+'%'),S('bkBack','Back','back',0,20,.1,v=>v.toFixed(1)+'%'),
    chk('bkAvg','Average ray directions (no gaps at hard edges)',C.average,v=>{C.average=v;}),
    el('div',{class:'sub',text:'Maps'}),kinds,el('p',{class:'note',text:'Rays: how many rays each pixel sends for AO and thickness (more is smoother and slower). Reach: how far they look.'}),
    S('bkRays','Rays','rays',8,256,8,v=>String(v)),S('bkAoD','AO reach','aoDist',1,100,1,v=>v+'%'),S('bkThD','Thick. reach','thickDist',1,100,1,v=>v+'%'),
    el('div',{class:'sub',text:'Anti-aliasing'}),seg([[1,'1×'],[2,'4×'],[4,'16×']],C.ss,v=>{C.ss=v;},'Anti-aliasing'),
    S('bkPad','Padding','pad',0,64,1,v=>v+'px'),
    el('p',{class:'note',text:'Front and Back are a percentage of the low-poly’s size. Front is how far outside the surface each ray starts; back is how far inside it still looks. If parts of the high-poly are missed, raise them; if detail from other parts leaks in, lower them or match parts by name.'}),inf);
  info();
  openDialog({title:'Bake from high poly',body,wide:true,okLabel:'Bake',onOk(){const L=C.low||bakeViewModel();if(L.noUV){toast('The low-poly has no UVs.');return false;}
      if(C.cage&&(C.cage.verts!==L.verts||C.cage.tris!==L.tris)){toast('The cage does not match the low-poly.');return false;}
      const ks=Object.keys(C.kinds).filter(k=>C.kinds[k]);if(!ks.length){toast('Pick at least one map.');return false;}setTimeout(()=>runBake(L,ks),0);}});}
async function runBake(L,ks){const C=bakeCfg;const high=C.high?bakeAlign(C.high,L):null,cage=C.cage?bakeAlign(C.cage,L).pos:null;
  let low=Object.assign({},L);
  if(C.match&&high){const names=(L.partNames||['default']).map(partBase),ix=new Map(names.map((n,i)=>[n,i]));
    low.vertPart=new Float32Array(L.verts);(L.triPart||new Uint32Array(L.tris)).forEach((p,t)=>{for(let k=0;k<3;k++)low.vertPart[L.idx[t*3+k]]=p;});
    const hn=(high.partNames||['default']).map(n=>ix.has(partBase(n))?ix.get(partBase(n)):9999);high.bakePart=new Float32Array((high.triPart||new Uint32Array(high.tris)).length);(high.triPart||[]).forEach((p,t)=>{high.bakePart[t]=hn[p];});}
  /* on its own the low-poly has no extra detail: normal and height would be flat, and curvature comes from its shape */
  if(!high){const skip=ks.filter(k=>k==='normal'||k==='height');if(skip.length)toast('Without a high-poly, '+skip.map(k=>BAKE_NAMES[k].toLowerCase()).join(' and ')+' would be flat, so '+(skip.length>1?'they are':'it is')+' skipped.');ks=ks.filter(k=>k!=='normal'&&k!=='height');if(!ks.length)return;}
  const kinds=ks.slice();if(kinds.includes('curv')){if(high){if(!kinds.includes('normal'))kinds.push('normal');}else kinds.push('mcurv');}
  const bar=el('div',{class:'bakebar'},el('div')),msg=el('p',{class:'note',text:'Preparing…'});const prog={cancelled:false,set(f){bar.firstChild.style.width=(f*100).toFixed(1)+'%';},step(t){msg.textContent=t;}};
  const t0=performance.now();
  openDialog({title:'Baking…',body:el('div',{class:'dlg-grid'},msg,bar),okLabel:null,cancelLabel:'Cancel',onCancel(){prog.cancelled=true;}});
  await tick();let res=null;
  try{prog.step('Baking '+ks.map(k=>BAKE_NAMES[k].toLowerCase()).join(', ')+'…');
    res=await bakeRun(low,high,{size:doc.w,sizeH:doc.h,ss:C.ss,front:C.front*.02,back:C.back*.02,average:C.average,cage,match:C.match&&!!high,kinds:kinds.filter(k=>k!=='curv'),
      rays:C.rays,aoDist:C.aoDist*.02,thickDist:C.thickDist*.02,pad:C.pad,dx:false,seed:Math.random()*10},prog);}
  catch(e){console.error(e);closeDialog();toast('The bake failed: '+(e.message||e));return;}
  if(!res){toast('Bake cancelled.');return;}
  closeDialog();bakeToLayers(res,ks);
  toast('Baked '+ks.length+' map'+(ks.length>1?'s':'')+' in '+((performance.now()-t0)/1000).toFixed(1)+' s.');}
/* results → layers */
function bakeToLayers(res,ks){const need=[];if(res.normal&&ks.includes('normal'))need.push('normal');if(res.height)need.push('height');if(res.ao)need.push('ao');
  const missing=need.filter(k=>!doc.maps.includes(k));if(missing.length)setDocMaps([...doc.maps,...missing],'Add maps for the bake');
  const layers=[],aux=[];
  const mk=(name,k,src)=>{const L=newLayerObj(name);for(const m of Object.keys(L.maps))if(m!=='base'&&m!==k){disposeTarget(L.maps[m]);delete L.maps[m];}
    const T=ensureMapTarget(L,k);run(P.shift,T,{uSrc:src.tex,uOff:[0,0],uWrap:false,uOutside:[0,0,0,0]});if(k!=='base'){L.blankBase=true;setMapModeOf(L,k,0);}return L;};
  if(res.normal&&ks.includes('normal'))layers.push(mk('Baked normal','normal',res.normal));
  if(res.height)layers.push(mk('Baked height','height',res.height));
  if(res.ao)layers.push(mk('Baked AO','ao',res.ao));
  if(ks.includes('curv')&&res.mcurv){aux.push(mk('Curvature','base',res.mcurv));}
  else if(ks.includes('curv')&&res.normal){const t=makeTarget(doc.w,doc.h,doc.depth,false),b=acquireD(res.normal.depth);gaussian(res.normal,b,.8);
    run(P.f_ncurv,t,{uN:b.tex,uWrap:!!doc.wrap,uStr:1.2,uMode:{int:0},uStep:1});release(b);aux.push(mk('Curvature','base',t));disposeTarget(t);}
  for(const k of ['thick','wnormal','position','id'])if(res[k])aux.push(mk(BAKE_NAMES[k],'base',res[k]));
  for(const k in res)disposeTarget(res[k]);
  structOp('Bake',()=>{for(const L of layers)insertNode(L,doc.root);
    if(aux.length){const G=newGroupObj('Baked maps');G.visible=false;G.open=false;for(const L of aux)insertNode(L,G);insertNode(G,doc.root);}
    const last=layers[layers.length-1]||aux[aux.length-1];if(last)selectOnly(last);});
  syncTargets();changedAll();refreshMapsUI();if(typeof v3Changed==='function')v3Changed();}
