/* ================= Your own export presets, and the model with its textures (0.27) =================
   Kenn: own presets with packed channels (e.g. metal/rough/AO in one image), and the exported model comes with its
   textures hooked up. A preset lists files; each file is a colour map, a grey map, or a packed image whose red,
   green, blue (and alpha) each hold one map. They are kept in this computer's storage (localStorage gs.texPresets)
   and show in the Export textures window beside the engines' presets.
   The model goes out as .glb (glTF binary: the textures are inside it, and Blender, Godot, Unreal and Unity with
   glTFast open it with everything connected) or .obj + .mtl beside the texture files. In 3D Paint each texture set
   becomes one material. */
const TXP_MAPS=[['base','Base colour'],['normal','Normal'],['emis','Emissive']];
const TXP_GREYS=[['rough','Roughness'],['smooth','Smoothness (1 − roughness)'],['metal','Metallic'],['ao','Ambient occlusion'],['height','Height'],['curv','Curvature'],['opac','Opacity'],['thick','Thickness'],['one','White'],['zero','Black']];
const TXP_KEY=k=>k==='smooth'?'rough':k;
let txUser=(()=>{try{const a=JSON.parse(localStorage.getItem('gs.texPresets')||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}})();
function txSave(){try{localStorage.setItem('gs.texPresets',JSON.stringify(txUser));}catch(e){}txInstall();}
const txNameFn=d=>n=>{const nm=d.naming==='snake'?snake(n):d.naming==='keep'?String(n||'Texture').replace(/\.[a-z0-9]+$/i,'').replace(/[\\/:*?"<>|]+/g,'_'):pascal(n);return (d.pattern||'{name}_{s}').replace('{name}',nm);};
const txLabelOf=k=>{const g=TXP_GREYS.find(x=>x[0]===k);return g?g[1].replace(/ \(.*\)$/,''):k;};
/* a saved preset → the form buildTextures reads */
function txToPreset(d){return {label:'★ '+(d.label||'My preset'),user:d.id,wf:d.wf||undefined,normal:d.normal==='dx'?'dx':'gl',name:txNameFn(d),outs:(d.outs||[]).map(o=>{
    if(o.kind==='rgb')return {s:o.s,what:(TXP_MAPS.find(x=>x[0]===o.map)||[0,o.map])[1]+(o.alpha==='opac'?' (alpha: opacity)':''),rgb:o.map,a:o.alpha==='opac'?'opac?':undefined};
    if(o.kind==='grey')return {s:o.s,what:txLabelOf(o.map),grey:o.map};
    const ch=(o.ch||[]).slice(0,o.ch&&o.ch[3]&&o.ch[3]!=='none'?4:3).map(c=>c||'zero');
    return {s:o.s,what:ch.map((c,i)=>'RGBA'[i]+' '+txLabelOf(c).toLowerCase()).join(' · '),ch,need:[...new Set(ch.filter(c=>c!=='one'&&c!=='zero').map(TXP_KEY))]};})};}
function txInstall(){for(const k of Object.keys(TEX_PRESETS))if(TEX_PRESETS[k].user)delete TEX_PRESETS[k];for(const d of txUser)TEX_PRESETS['u_'+d.id]=txToPreset(d);}
txInstall();
/* a built-in (or saved) preset as an editable description */
function txFromPreset(key){const pr=TEX_PRESETS[key],u=pr&&pr.user&&txUser.find(d=>d.id===pr.user);if(u)return JSON.parse(JSON.stringify(u));
  const pat=pr?String(pr.name('Qzx')).replace('Qzx','{name}').replace('qzx','{name}'):'{name}_{s}',naming=pr&&/qzx/.test(pr.name('Qzx'))?'snake':'pascal';
  return {id:null,label:(pr?pr.label.replace(/^★ /,''):'My preset')+' (mine)',normal:pr?pr.normal:'gl',naming,pattern:pat.includes('{name}')?pat:'{name}_{s}',wf:pr&&pr.wf,
    outs:(pr?pr.outs:[]).map(o=>o.rgb?{s:o.s,kind:'rgb',map:o.rgb,alpha:o.a?'opac':'none'}:o.grey?{s:o.s,kind:'grey',map:o.grey}:{s:o.s,kind:'pack',ch:[...o.ch,'none'].slice(0,4)})};}
/* the preset editor */
function dlgTexPreset(key){const D=txFromPreset(key),body=el('div',{class:'dlg-grid txpe'}),rows=el('div',{class:'txprows'});
  const inp=(id,val,set,ph)=>{const i=el('input',{type:'text',id,value:val||'',placeholder:ph||''});i.addEventListener('input',()=>set(i.value));return i;};
  const pick=(opts,cur,set,label)=>{const s=el('select',{'aria-label':label},...opts.map(([v,l])=>el('option',{value:v,text:l})));s.value=cur;s.onchange=()=>set(s.value);return s;};
  const draw=()=>{rows.replaceChildren(...D.outs.map((o,i)=>{const r=el('div',{class:'txprow'});
      const kind=pick([['rgb','Colour map'],['grey','Grey map'],['pack','Packed channels']],o.kind,v=>{o.kind=v;if(v==='rgb'&&!o.map)o.map='base';if(v==='grey'&&!o.map)o.map='rough';if(v==='pack'&&!o.ch)o.ch=['ao','rough','metal','none'];draw();},'File kind');
      const parts=[inp('txp_s'+i,o.s,v=>{o.s=v;},'Suffix (e.g. ORM)'),kind];
      if(o.kind==='rgb')parts.push(pick(TXP_MAPS,o.map||'base',v=>{o.map=v;},'Map'),...(o.map==='base'?[pick([['none','No alpha'],['opac','Alpha: opacity']],o.alpha||'none',v=>{o.alpha=v;},'Alpha')]:[]));
      else if(o.kind==='grey')parts.push(pick(TXP_GREYS.filter(g=>g[0]!=='one'&&g[0]!=='zero'),o.map||'rough',v=>{o.map=v;},'Map'));
      else{o.ch=o.ch||['ao','rough','metal','none'];for(let c=0;c<4;c++)parts.push(el('label',{class:'txpch',text:'RGBA'[c]},pick(c===3?[['none','—'],...TXP_GREYS]:TXP_GREYS,o.ch[c]||(c===3?'none':'zero'),v=>{o.ch[c]=v;},'RGBA'[c]+' channel')));}
      parts.push(el('button',{class:'btn sm',text:'×',title:'Remove this file','aria-label':'Remove file '+(i+1),onclick:()=>{D.outs.splice(i,1);draw();}}));
      r.append(...parts);return r;}));};
  draw();
  const start=pick([['','Start from…'],...Object.entries(TEX_PRESETS).map(([k,p])=>[k,p.label])],'',v=>{if(!v)return;const S=txFromPreset(v);D.outs=S.outs;D.normal=S.normal;D.wf=S.wf;draw();nrm.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===D.normal));},'Start from a preset');
  const nrm=seg([['gl','OpenGL (green up)'],['dx','DirectX (green down)']],D.normal,v=>{D.normal=v;},'Normal map');nrm.querySelectorAll('button').forEach((b,i)=>b.dataset.v=['gl','dx'][i]);
  body.append(el('div',{class:'frow'},el('label',{for:'txpName',text:'Name'}),inp('txpName',D.label,v=>{D.label=v;})),start,
    el('div',{class:'sub',text:'Normal map'}),nrm,
    el('div',{class:'frow'},el('label',{for:'txpPat',text:'File names'}),inp('txpPat',D.pattern,v=>{D.pattern=v;},'T_{name}_{s}')),
    seg([['pascal','PascalCase'],['snake','snake_case'],['keep','As typed']],D.naming||'pascal',v=>{D.naming=v;},'Name style'),
    el('p',{class:'note',text:'{name} is the export name, {s} each file’s suffix. Packed files put one map in each channel: for example R ambient occlusion, G roughness, B metallic.'}),
    el('div',{class:'sub',text:'Files'}),rows,el('div',{class:'chips'},el('button',{class:'btn sm',id:'txpAdd',text:'+ File',onclick:()=>{D.outs.push({s:'Map'+(D.outs.length+1),kind:'pack',ch:['ao','rough','metal','none']});draw();}}),
      D.id?el('button',{class:'btn sm',id:'txpDel',text:'Delete preset',onclick:()=>{txUser=txUser.filter(d=>d.id!==D.id);txSave();if(texCfg.preset==='u_'+D.id)texCfg.preset=texPresetsFor()[0][0];closeDialog();dlgExportTextures();}}):null));
  openDialog({title:D.id?'Edit export preset':'New export preset',body,okLabel:'Save',onOk(){
    if(!D.outs.length){toast('Add at least one file.');return false;}if(D.outs.some(o=>!String(o.s||'').trim())){toast('Every file needs a suffix.');return false;}
    if(!D.id){D.id=Date.now().toString(36);txUser.push(D);}else{const i=txUser.findIndex(d=>d.id===D.id);if(i>=0)txUser[i]=D;else txUser.push(D);}
    txSave();texCfg.preset='u_'+D.id;setTimeout(dlgExportTextures,0);},onCancel(){setTimeout(dlgExportTextures,0);}});}

/* ---- the model ---- */
/* the model on show (original, not the subdivided copy), with each triangle's material */
function mxModel(){const s=v3s();if(s.model==='imported'&&v3.imported)return v3.imported;if(v3.mesh)return v3.mesh;return primMesh(PRIMS[s.model]?s.model:'rcube',0);}
function mxHasModel(){return ui.mode==='p3d'||!!v3.imported||!!v3.on;}
/* the textures a glTF material wants: base colour (+opacity), metal/rough (with AO in red, so one image is also the
   occlusion), OpenGL normal, emissive */
const GLTF_TEX={label:'glTF',normal:'gl',name:n=>n+'_{s}',outs:[
  {s:'BaseColor',rgb:'base',a:'opac?'},{s:'ORM',ch:['ao','rough','metal'],need:['ao','rough','metal']},{s:'Normal',rgb:'normal'},{s:'Emissive',rgb:'emis'}]};
/* groups of triangles by texture set (material); names as the sets are called */
function mxGroups(m,sets){const T=m.idx.length/3,names=m.matNames||[],by=new Map();
  for(let t=0;t<T;t++){const nm=m.triMat&&names[m.triMat[t]]!=null?names[m.triMat[t]]:(sets[0]||'Material');const key=sets.includes(nm)?nm:(sets.length===1?sets[0]:nm);let a=by.get(key);if(!a)by.set(key,a=[]);a.push(m.idx[t*3],m.idx[t*3+1],m.idx[t*3+2]);}
  return [...by].map(([name,idx])=>({name,idx:new Uint32Array(idx)}));}
/* glTF binary: positions, normals, UVs, one primitive per material, textures inside */
function mxGLB(m,groups,tex,name){const parts=[],views=[],acc=[];let off=0;
  const add=(bytes,target)=>{const pad=(4-off%4)%4;if(pad){parts.push(new Uint8Array(pad));off+=pad;}views.push(Object.assign({buffer:0,byteOffset:off,byteLength:bytes.byteLength},target?{target}:{}));parts.push(new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength));off+=bytes.byteLength;return views.length-1;};
  const n=m.pos.length/3,mn=[1e30,1e30,1e30],mx=[-1e30,-1e30,-1e30];for(let i=0;i<n;i++)for(let j=0;j<3;j++){const v=m.pos[i*3+j];if(v<mn[j])mn[j]=v;if(v>mx[j])mx[j]=v;}
  acc.push({bufferView:add(new Float32Array(m.pos),34962),componentType:5126,count:n,type:'VEC3',min:mn,max:mx});const A={POSITION:0};
  if(m.nrm&&m.nrm.length===m.pos.length){acc.push({bufferView:add(new Float32Array(m.nrm),34962),componentType:5126,count:n,type:'VEC3'});A.NORMAL=acc.length-1;}
  if(m.uv&&m.uv.length===n*2){acc.push({bufferView:add(new Float32Array(m.uv),34962),componentType:5126,count:n,type:'VEC2'});A.TEXCOORD_0=acc.length-1;}
  const images=[],textures=[],materials=[],prims=[];
  const img=file=>{if(!file)return undefined;images.push({bufferView:add(file.data),mimeType:'image/png',name:file.name});textures.push({sampler:0,source:images.length-1});return {index:textures.length-1};};
  for(const g of groups){const T=tex[g.name]||{},mat={name:g.name,pbrMetallicRoughness:{metallicFactor:T.ORM?1:0,roughnessFactor:T.ORM?1:.6}};
    const bc=img(T.BaseColor);if(bc)mat.pbrMetallicRoughness.baseColorTexture=bc;
    const orm=img(T.ORM);if(orm){mat.pbrMetallicRoughness.metallicRoughnessTexture=orm;mat.occlusionTexture={index:orm.index};}
    const nt=img(T.Normal);if(nt)mat.normalTexture=nt;const em=img(T.Emissive);if(em){mat.emissiveTexture=em;mat.emissiveFactor=[1,1,1];}
    if(T.alpha)mat.alphaMode='BLEND';mat.doubleSided=false;materials.push(mat);
    acc.push({bufferView:add(g.idx,34963),componentType:5125,count:g.idx.length,type:'SCALAR'});prims.push({attributes:A,indices:acc.length-1,material:materials.length-1});}
  const json={asset:{version:'2.0',generator:'Gouache Studio'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name}],meshes:[{name,primitives:prims}],
    accessors:acc,bufferViews:views,buffers:[{byteLength:off}],materials,...(images.length?{images,textures,samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}]}:{})};
  const bin=new Uint8Array(off+((4-off%4)%4));let o=0;for(const p of parts){bin.set(p,o);o+=p.byteLength;}
  let js=new TextEncoder().encode(JSON.stringify(json));const jp=(4-js.length%4)%4;if(jp){const t=new Uint8Array(js.length+jp);t.set(js);t.fill(32,js.length);js=t;}
  const out=new Uint8Array(12+8+js.length+8+bin.length),dv=new DataView(out.buffer);
  dv.setUint32(0,0x46546C67,true);dv.setUint32(4,2,true);dv.setUint32(8,out.length,true);dv.setUint32(12,js.length,true);dv.setUint32(16,0x4E4F534A,true);out.set(js,20);
  dv.setUint32(20+js.length,bin.length,true);dv.setUint32(24+js.length,0x004E4942,true);out.set(bin,28+js.length);return out;}
/* OBJ + MTL, pointing at the texture files the preset wrote (the maps an .mtl can name) */
function mxOBJ(m,groups,filesBySet,name,pr){const n=m.pos.length/3,L=['# Gouache Studio','mtllib '+name+'.mtl'],f=v=>+v.toFixed(6);
  for(let i=0;i<n;i++)L.push('v '+f(m.pos[i*3])+' '+f(m.pos[i*3+1])+' '+f(m.pos[i*3+2]));
  const hasT=m.uv&&m.uv.length===n*2,hasN=m.nrm&&m.nrm.length===m.pos.length;
  if(hasT)for(let i=0;i<n;i++)L.push('vt '+f(m.uv[i*2])+' '+f(1-m.uv[i*2+1]));
  if(hasN)for(let i=0;i<n;i++)L.push('vn '+f(m.nrm[i*3])+' '+f(m.nrm[i*3+1])+' '+f(m.nrm[i*3+2]));
  const ref=i=>{const k=i+1;return hasT&&hasN?k+'/'+k+'/'+k:hasT?k+'/'+k:hasN?k+'//'+k:String(k);};
  const M=[];
  for(const g of groups){L.push('usemtl '+g.name);for(let t=0;t<g.idx.length;t+=3)L.push('f '+ref(g.idx[t])+' '+ref(g.idx[t+1])+' '+ref(g.idx[t+2]));
    const fs=filesBySet[g.name]||[],by=s=>{const o=pr.outs.find(x=>x.s===s);return o;},file=test=>{for(const x of fs){const o=by(x.suffix);if(o&&test(o))return x.name;}return null;};
    M.push('newmtl '+g.name,'Kd 1 1 1','Ks 0.5 0.5 0.5');const put=(key,fn)=>{if(fn)M.push(key+' '+fn);};
    put('map_Kd',file(o=>o.rgb==='base'));const nf=file(o=>o.rgb==='normal');if(nf){M.push('map_Bump -bm 1 '+nf,'norm '+nf);}
    put('map_Pr',file(o=>o.grey==='rough'));put('map_Pm',file(o=>o.grey==='metal'));put('map_Ke',file(o=>o.rgb==='emis'));put('map_d',file(o=>o.grey==='opac'));put('disp',file(o=>o.grey==='height'));
    const pk=fs.map(x=>({x,o:by(x.suffix)})).filter(q=>q.o&&q.o.ch);for(const q of pk)M.push('# packed: '+q.x.name+' = '+q.o.what);M.push('');}
  return {obj:new TextEncoder().encode(L.join('\n')+'\n'),mtl:new TextEncoder().encode(M.join('\n')+'\n')};}
