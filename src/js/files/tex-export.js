/* ================= Export textures for game engines =================
   Each preset lists the files an engine expects: which maps go in which channels (packing),
   the normal map's green direction (DirectX for Unreal, OpenGL for the rest), roughness or
   smoothness, and the usual file names. Layouts checked against the engines' documentation:
   Unreal ORM = R occlusion, G roughness, B metallic; Unity URP metallic map = R metallic,
   A smoothness; Unity HDRP mask map = R metallic, G occlusion, B detail mask, A smoothness;
   Godot ORM = R occlusion, G roughness, B metallic, OpenGL normals; Blender = separate maps. */
const TEX_PRESETS={
  unreal:{label:'Unreal Engine',normal:'dx',name:n=>'T_'+pascal(n)+'_{s}',outs:[
    {s:'BC',what:'Base colour'+' (alpha: opacity)',rgb:'base',a:'opac?'},
    {s:'N',what:'Normal (DirectX)',rgb:'normal'},
    {s:'ORM',what:'R occlusion · G roughness · B metallic',ch:['ao','rough','metal'],need:['ao','rough','metal']},
    {s:'H',what:'Height',grey:'height'},
    {s:'Curv',what:'Curvature (mask)',grey:'curv'},
    {s:'E',what:'Emissive',rgb:'emis'}]},
  urp:{label:'Unity (URP)',normal:'gl',name:n=>pascal(n)+'_{s}',outs:[
    {s:'Albedo',what:'Base map (alpha: opacity)',rgb:'base',a:'opac?'},
    {s:'MetallicSmoothness',what:'R metallic · A smoothness',ch:['metal','metal','metal','smooth'],need:['metal','rough']},
    {s:'Normal',what:'Normal (OpenGL)',rgb:'normal'},
    {s:'Occlusion',what:'Occlusion',grey:'ao'},
    {s:'Height',what:'Height (parallax)',grey:'height'},
    {s:'Curvature',what:'Curvature (mask)',grey:'curv'},
    {s:'Emission',what:'Emission',rgb:'emis'}]},
  hdrp:{label:'Unity (HDRP)',normal:'gl',name:n=>pascal(n)+'_{s}',outs:[
    {s:'BaseColor',what:'Base colour (alpha: opacity)',rgb:'base',a:'opac?'},
    {s:'MaskMap',what:'R metallic · G occlusion · B detail mask · A smoothness',ch:['metal','ao','one','smooth'],need:['metal','ao','rough']},
    {s:'Normal',what:'Normal (OpenGL)',rgb:'normal'},
    {s:'Height',what:'Height',grey:'height'},
    {s:'Curvature',what:'Curvature (mask)',grey:'curv'},
    {s:'Emissive',what:'Emissive',rgb:'emis'}]},
  godot:{label:'Godot',normal:'gl',name:n=>snake(n)+'_{s}',outs:[
    {s:'albedo',what:'Albedo (alpha: opacity)',rgb:'base',a:'opac?'},
    {s:'orm',what:'R occlusion · G roughness · B metallic (ORMMaterial3D)',ch:['ao','rough','metal'],need:['ao','rough','metal']},
    {s:'normal',what:'Normal (OpenGL)',rgb:'normal'},
    {s:'height',what:'Height (white is high)',grey:'height'},
    {s:'curvature',what:'Curvature (mask)',grey:'curv'},
    {s:'emission',what:'Emission',rgb:'emis'}]},
  /* Specular/Gloss documents. Unity's Standard (Specular setup): specular in RGB, smoothness (gloss) in alpha. Unreal has no built-in
     spec/gloss material, so the maps come separately for a custom material. */
  unitySG:{label:'Unity (Standard, specular)',wf:'spec',normal:'gl',name:n=>pascal(n)+'_{s}',outs:[
    {s:'Albedo',what:'Diffuse (alpha: opacity)',rgb:'base',a:'opac?'},
    {s:'Specular',what:'RGB specular · A smoothness (glossiness)',rgbA:['spec','gloss'],need:['spec','gloss']},
    {s:'Normal',what:'Normal (OpenGL)',rgb:'normal'},
    {s:'Occlusion',what:'Occlusion',grey:'ao'},
    {s:'Height',what:'Height (parallax)',grey:'height'},
    {s:'Emission',what:'Emission',rgb:'emis'}]},
  unrealSG:{label:'Unreal Engine (specular/gloss)',wf:'spec',normal:'dx',name:n=>'T_'+pascal(n)+'_{s}',outs:[
    {s:'D',what:'Diffuse (alpha: opacity)',rgb:'base',a:'opac?'},
    {s:'S',what:'Specular colour',rgb:'spec'},
    {s:'G',what:'Glossiness',grey:'gloss'},
    {s:'N',what:'Normal (DirectX)',rgb:'normal'},
    {s:'AO',what:'Ambient occlusion',grey:'ao'},
    {s:'H',what:'Height',grey:'height'},
    {s:'E',what:'Emissive',rgb:'emis'}]},
  separateSG:{label:'Separate maps (specular/gloss)',wf:'spec',normal:'gl',name:n=>pascal(n)+'_{s}',outs:[
    {s:'Diffuse',what:'Diffuse',rgb:'base'},
    {s:'Specular',what:'Specular colour',rgb:'spec'},
    {s:'Glossiness',what:'Glossiness',grey:'gloss'},
    {s:'Normal',what:'Normal (OpenGL)',rgb:'normal'},
    {s:'Height',what:'Height',grey:'height'},
    {s:'AO',what:'Ambient occlusion',grey:'ao'},
    {s:'Emission',what:'Emission',rgb:'emis'},
    {s:'Opacity',what:'Opacity',grey:'opac'}]},
  blender:{label:'Blender',normal:'gl',name:n=>pascal(n)+'_{s}',outs:[
    {s:'BaseColor',what:'Base colour',rgb:'base'},
    {s:'Roughness',what:'Roughness',grey:'rough'},
    {s:'Metallic',what:'Metallic',grey:'metal'},
    {s:'Normal',what:'Normal (OpenGL)',rgb:'normal'},
    {s:'Height',what:'Height',grey:'height'},
    {s:'Curvature',what:'Curvature (mask)',grey:'curv'},
    {s:'AO',what:'Ambient occlusion',grey:'ao'},
    {s:'Emission',what:'Emission',rgb:'emis'},
    {s:'Opacity',what:'Opacity',grey:'opac'}]}};
const pascal=n=>(String(n||'Texture').replace(/\.[a-z0-9]+$/i,'').match(/[A-Za-z0-9]+/g)||['Texture']).map(w=>w[0].toUpperCase()+w.slice(1)).join('');
const snake=n=>(String(n||'texture').replace(/\.[a-z0-9]+$/i,'').match(/[A-Za-z0-9]+/g)||['texture']).map(w=>w.toLowerCase()).join('_');
const texCfg={preset:'unreal',normal:'preset',size:0,fmt:'png',h16:true,name:'',allSets:true,model:'none',meshMaps:false};
/* a baked mesh map (3D Paint) stands in for a map the document doesn't paint, like AO in the ORM file */
const texMesh=k=>doc.meshMaps&&doc.meshMaps[k]&&!doc.maps.includes(k)?doc.meshMaps[k]:null;
/* which files this document produces with a preset */
const texPresetsFor=()=>Object.entries(TEX_PRESETS).filter(([k,p])=>(p.wf||'metal')===(doc.workflow||'metal'));
function texOutputs(pr){const has=k=>doc.maps.includes(k)||!!texMesh(k);
  return pr.outs.filter(o=>{if(o.rgb==='normal')return has('height')||has('normal');if(o.rgb)return has(o.rgb);if(o.grey)return has(o.grey);return o.need.some(has);});}
function texNormalFlip(pr){const c=texCfg.normal==='preset'?pr.normal:texCfg.normal;return c==='dx';}
/* read a map of the whole document as straight 0..1 floats (C = 1 grey or 4 RGBA) */
function readMapF(t,C){const px=readPremult(t),sc=px instanceof Float32Array?1:1/255,n=t.w*t.h,out=new Float32Array(n*C);
  for(let i=0;i<n;i++){const a=px[i*4+3]*sc;if(C===1){out[i]=a>0?Math.min(1,Math.max(0,px[i*4]*sc/a)):0;continue;}
    if(a>0)for(let c=0;c<3;c++)out[i*4+c]=Math.min(1,Math.max(0,px[i*4+c]*sc/a));out[i*4+3]=Math.min(1,a);}
  return out;}
/* area average when shrinking, bilinear when enlarging; alpha-weighted colour for RGBA */
function resampleF(src,W,H,C,nw,nh,aw){if(nw===W&&nh===H)return src;
  const axis=(n,N)=>{const s=N/n,taps=[];for(let i=0;i<n;i++){const t=[];if(s>=1){const a=i*s,b=a+s;for(let j=Math.floor(a);j<Math.ceil(b);j++){const w=Math.min(b,j+1)-Math.max(a,j);if(w>0)t.push([Math.min(N-1,j),w]);}}
      else{const x=(i+.5)*s-.5,j=Math.floor(x),f=x-j;t.push([clamp(j,0,N-1),1-f],[clamp(j+1,0,N-1),f]);}const tw=t.reduce((q,v)=>q+v[1],0);t.forEach(v=>v[1]/=tw);taps.push(t);}return taps;};
  const tx=axis(nw,W),ty=axis(nh,H),mid=new Float32Array(nw*H*C),out=new Float32Array(nw*nh*C);
  const pass=(inp,outp,taps,len,other,stride,ostride,iw,ow)=>{for(let o=0;o<other;o++)for(let i=0;i<len;i++){const acc=[0,0,0,0];let aw2=0;
      for(const [j,w] of taps[i]){const p=(iw(o,j))*C;if(C===4&&aw){const a=inp[p+3]*w;for(let c=0;c<3;c++)acc[c]+=inp[p+c]*a;acc[3]+=a;aw2+=a;}else for(let c=0;c<C;c++)acc[c]+=inp[p+c]*w;}
      const q=ow(o,i)*C;if(C===4&&aw){for(let c=0;c<3;c++)outp[q+c]=aw2>0?acc[c]/aw2:0;outp[q+3]=acc[3];}else for(let c=0;c<C;c++)outp[q+c]=acc[c];}};
  pass(src,mid,tx,nw,H,0,0,(y,x)=>y*W+x,(y,x)=>y*nw+x);
  pass(mid,out,ty,nh,nw,0,0,(x,y)=>y*nw+x,(x,y)=>y*nw+x);
  return out;}
/* PNG with any channel count (1 grey, 3 RGB, 4 RGBA) at 8 or 16 bits */
async function encodePNGx(W,H,q,C,bits){const bpp=C*bits/8,row=1+W*bpp,raw=new Uint8Array(row*H);
  for(let y=0;y<H;y++){let o=y*row+1;const s=y*W*C,e=s+W*C;if(bits===16)for(let i=s;i<e;i++){raw[o++]=q[i]>>8;raw[o++]=q[i]&255;}else for(let i=s;i<e;i++)raw[o++]=q[i];}
  const z=await zlib(raw),ih=new Uint8Array(13),dv=new DataView(ih.buffer);dv.setUint32(0,W);dv.setUint32(4,H);ih[8]=bits;ih[9]=C===1?0:C===3?2:6;
  return new Blob([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',z),chunk('IEND',new Uint8Array(0))],{type:'image/png'});}
function quant(f,bits){const m=bits===16?65535:255,q=bits===16?new Uint16Array(f.length):new Uint8Array(f.length);for(let i=0;i<f.length;i++)q[i]=Math.min(1,Math.max(0,f[i]))*m+.5|0;return q;}
async function encodeTex(W,H,f,C,fmt,bits){
  if(fmt==='tga'){const q=quant(f,8),st=new Uint8Array(W*H*4);for(let i=0;i<W*H;i++){if(C===1){st[i*4]=st[i*4+1]=st[i*4+2]=q[i];st[i*4+3]=255;}else{st.set(q.subarray(i*C,i*C+C),i*4);if(C===3)st[i*4+3]=255;}}
    return encodeTGA(W,H,st,true,C===4);}
  return encodePNGx(W,H,quant(f,bits),C,bits);}
/* build every file of a preset: [{name,data}] */
async function buildTextures(pr,name){const W=doc.w,H=doc.h,S=texCfg.size||0,nw=S||W,nh=S?Math.max(1,Math.round(S*H/W)):H;
  const cache={},has=k=>doc.maps.includes(k);
  const grey=k=>{if(k==='one')return null;const kk=k==='smooth'?'rough':k;const mm=texMesh(kk);if(!has(kk)&&!mm)return null;if(!cache[kk]){if(mm)cache[kk]=resampleF(readMapF(mm,1),mm.w,mm.h,1,W,H,false);else{const t=compositeMap(kk);cache[kk]=readMapF(t,1);release(t);}}return cache[kk];};
  const def=k=>k==='zero'?0:k==='one'?1:k==='smooth'?1-mapDefault('rough')[0]:has(k)?mapDefault(k)[0]:(MAP_DEFS[k].def!=null?MAP_DEFS[k].def:0);
  const files=[],ext=texCfg.fmt,n=W*H;
  for(const o of texOutputs(pr)){let f,C;
    if(o.rgb==='normal'){const t=normalComposite(texNormalFlip(pr),null);f=readMapF(t,4);release(t);C=3;f=dropAlpha(f,n);}
    else if(o.rgb){const t=compositeMap(o.rgb);const rgba=readMapF(t,4);release(t);
      if(o.a==='opac?'&&has('opac')){const op=grey('opac');for(let i=0;i<n;i++)rgba[i*4+3]*=op[i];C=4;f=rgba;}
      else if(o.rgb==='base'&&baseHasAlpha(rgba,n)&&o.a){C=4;f=rgba;}
      else{C=3;f=dropAlpha(rgba,n);}}
    else if(o.rgbA){const [rk,ak]=o.rgbA;const t=compositeMap(rk);const rgba=readMapF(t,4);release(t);const g=grey(ak),d=def(ak);for(let i=0;i<n;i++)rgba[i*4+3]=g?g[i]:d;C=4;f=rgba;
      if(!has(rk)){const c=mapDefault(rk);for(let i=0;i<n;i++){rgba[i*4]=c[0];rgba[i*4+1]=c[1];rgba[i*4+2]=c[2];}}}
    else if(o.grey){const g=grey(o.grey);if(!g)continue;f=g.slice();C=1;}
    else{C=o.ch.length;f=new Float32Array(n*C);o.ch.forEach((k,c)=>{const g=grey(k),inv=k==='smooth',d=def(k);for(let i=0;i<n;i++){const v=g?g[i]:d;f[i*C+c]=inv&&g?1-v:v;}});}
    const r=resampleF(f,W,H,C,nw,nh,C===4);const bits=o.grey==='height'&&texCfg.h16&&ext==='png'?16:8;
    const blob=await encodeTex(nw,nh,r,C,ext,bits);files.push({suffix:o.s,name:pr.name(name).replace('{s}',o.s)+'.'+ext,data:new Uint8Array(await blob.arrayBuffer())});await tick();}
  return files;}
function dropAlpha(f,n){const o=new Float32Array(n*3);for(let i=0;i<n;i++){o[i*3]=f[i*4];o[i*3+1]=f[i*4+1];o[i*3+2]=f[i*4+2];}return o;}
function baseHasAlpha(f,n){for(let i=0;i<n;i++)if(f[i*4+3]<.999)return true;return false;}
function dlgExportTextures(){if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  if(ui.mode==='anim'){toast('Switch to paint mode to export textures.');return;}
  if(!texCfg.name)texCfg.name=(doc.name||'Texture').replace(/\.[a-z0-9]+$/i,'');
  const body=el('div',{class:'dlg-grid'}),list=el('div',{class:'texlist'});
  const sel=(id,label,opts,cur,set)=>{const s=el('select',{id});for(const [v,l] of opts){const o=el('option',{value:String(v),text:l});if(String(v)===String(cur))o.selected=true;s.append(o);}s.addEventListener('change',()=>{set(s.value);draw();});return el('div',{class:'frow'},el('label',{for:id,text:label}),s);};
  const nameIn=el('input',{type:'text',id:'txName',value:texCfg.name});nameIn.addEventListener('input',()=>{texCfg.name=nameIn.value;draw();});
  const sizes=[[0,'Document ('+doc.w+' × '+doc.h+')'],[256,'256'],[512,'512'],[1024,'1024'],[2048,'2048'],[4096,'4096'],[8192,'8192 (8K)']];
  const setNm=()=>ui.mode==='p3d'&&texCfg.allSets&&p3.sets.filter(S=>!S.missing).length>1?(texCfg.name||'Texture')+'_'+doc.name:(texCfg.name||'Texture');
  const draw=()=>{const pr=TEX_PRESETS[texCfg.preset],outs=texOutputs(pr),flip=texNormalFlip(pr);list.replaceChildren(...outs.map(o=>el('div',{class:'texrow'},
      el('code',{text:pr.name(setNm()).replace('{s}',o.s)+'.'+texCfg.fmt}),el('span',{class:'dim',text:o.rgb==='normal'?'Normal ('+(flip?'DirectX':'OpenGL')+')':o.what}))));
    if(texCfg.meshMaps)for(const [k,t] of Object.entries(doc.meshMaps||{})){if(k.startsWith('cv:')||!t)continue;list.append(el('div',{class:'texrow'},el('code',{text:pr.name(setNm()).replace('{s}',meshExportSuffix(k))+'.'+texCfg.fmt}),el('span',{class:'dim',text:(P3_MESHMAP_NAMES[k]||k)+' · '+t.w+' × '+t.h})));}
    if(doc.maps.length<2)list.append(el('p',{class:'note',text:'This document only has base colour. Add maps with Image › Document maps… to export roughness, metallic, height and normal too.'}));};
  if((TEX_PRESETS[texCfg.preset].wf||'metal')!==(doc.workflow||'metal'))texCfg.preset=texPresetsFor()[0][0];
  if(!TEX_PRESETS[texCfg.preset])texCfg.preset=texPresetsFor()[0][0];
  const own=el('div',{class:'chips'},el('button',{class:'btn sm',id:'txNewPreset',text:'New preset…',title:'Your own files and channel packing',onclick:()=>{closeDialog();dlgTexPreset(texCfg.preset);}}),
    TEX_PRESETS[texCfg.preset].user?el('button',{class:'btn sm',id:'txEditPreset',text:'Edit preset…',onclick:()=>{closeDialog();dlgTexPreset(texCfg.preset);}}):null);
  /* (0.27) the model too, with its textures connected */
  const modelRow=mxHasModel()?[sel('txModel','Model',[['none','No model'],['glb','.glb (textures inside)'],['obj','.obj + .mtl'],['fbx','.fbx (mesh + texture links)']],texCfg.model||'none',v=>{texCfg.model=v;}),
    el('p',{class:'note',text:'The model goes with the textures. GLB embeds them; OBJ and FBX link to the exported files. FBX exports the static mesh, UVs, normals and material slots.'})]:[];
  body.append(sel('txPreset','Engine',texPresetsFor().map(([k,p])=>[k,p.label]),texCfg.preset,v=>{texCfg.preset=v;closeDialog();dlgExportTextures();}),own,
    el('div',{class:'frow'},el('label',{for:'txName',text:'Name'}),nameIn),
    sel('txNrm','Normal map',[['preset','Engine default'],['gl','OpenGL (green up)'],['dx','DirectX (green down)']],texCfg.normal,v=>{texCfg.normal=v;}),
    sel('txSize','Size',sizes,texCfg.size,v=>{texCfg.size=+v;}),
    sel('txFmt','Format',[['png','PNG'],['tga','TGA']],texCfg.fmt,v=>{texCfg.fmt=v;}),
    chk('txH16','Height at 16 bits (PNG)',texCfg.h16,v=>{texCfg.h16=v;}),chk('txMeshMaps','Include assigned mesh maps',texCfg.meshMaps,v=>{texCfg.meshMaps=v;draw();}),el('p',{class:'note',text:'Mesh maps export at their original size unless you choose an export size. They have a Mesh_ prefix and belong to their texture set.'}),
    ui.mode==='p3d'&&p3.sets.filter(S=>!S.missing).length>1?chk('txAll','Every texture set (files named after each set)',texCfg.allSets,v=>{texCfg.allSets=v;draw();}):null,
    ...modelRow,...esRow(()=>{closeDialog();dlgExportTextures();}),el('div',{class:'sub',text:'Files'}),list);draw();
  openDialog({title:'Export textures',body,okLabel:platform.isDesktop?(esActive()?'Export and send':'Choose folder…'):'Export',onOk(){exportTextures();}});}
async function exportTextures(){const pr=TEX_PRESETS[texCfg.preset],name=texCfg.name||'Texture',wantModel=mxHasModel()&&texCfg.model&&texCfg.model!=='none';
  let dir=null;if(platform.isDesktop){dir=await esTargetDir(name);if(!dir)return;}
  toast('Exporting textures…');await tick();
  try{let files=[];const bySet={},glTex={};
    /* each texture set (3D Paint), or the document; the model needs glTF-shaped textures too */
    const one=async(setName,fileName)=>{const fs=await buildTextures(pr,fileName);bySet[setName]=fs;files.push(...fs);if(texCfg.meshMaps)files.push(...await buildMeshMapTextures(pr,fileName));
      if(wantModel&&texCfg.model==='glb'){const g=await buildTextures(GLTF_TEX,pascal(fileName)),T={};for(const f of g)T[f.suffix]=f;T.alpha=doc.maps.includes('opac');glTex[setName]=T;}};
    const sets=ui.mode==='p3d'?p3.sets.filter(S=>!S.missing):[];
    if(ui.mode==='p3d'&&(texCfg.allSets||wantModel)&&sets.length>1){const back=p3.cur;
      try{for(let i=0;i<p3.sets.length;i++){if(p3.sets[i].missing)continue;p3SwitchSet(i,true);await one(p3.sets[i].name,name+'_'+p3.sets[i].name);}}finally{p3SwitchSet(back,true);}}
    else await one(ui.mode==='p3d'&&p3.sets[p3.cur]?p3.sets[p3.cur].name:(doc.name||name),name);
    if(wantModel){const m=mxModel(),setNames=Object.keys(bySet),groups=mxGroups(m,setNames),mn=pascal(name);
      if(texCfg.model==='glb')files=files.concat([{name:mn+'.glb',data:mxGLB(m,groups,glTex,mn)}]);
      else if(texCfg.model==='fbx')files.push({name:mn+'.fbx',data:mxFBX(m,groups,bySet,mn,pr)});
      else{const o=mxOBJ(m,groups,bySet,mn,pr);files.push({name:mn+'.obj',data:o.obj},{name:mn+'.mtl',data:o.mtl});}}
    if(!files.length){toast('Nothing to export.');return;}
    if(dir){const sep=dir.includes('\\')?'\\':'/';for(const f of files)await platform.writeFile(dir.replace(/[\\/]$/,'')+sep+f.name,f.data);toast('Saved '+files.length+' files to '+dir);await esAfter(dir,files,name);}
    else{const r=await deliver(pascal(name)+'_'+(pr.user?'custom':texCfg.preset)+'.zip',await makeZipMulti(files));toast(deliveredText(r,'Textures'));}
    return files;}
  catch(e){console.error(e);toast('Export failed: '+(e.message||e));}}

const meshExportSuffix=k=>'Mesh_'+({normal:'Normal',height:'Height',ao:'AO',curv:'Curvature',curvEdge:'CurvatureEdges',curvCrease:'CurvatureCreases',thick:'Thickness',wnormal:'WorldNormal',position:'Position',id:'ID',rough:'Roughness',metal:'Metallic'}[k]||pascal(k));
async function buildMeshMapTextures(pr,name){const files=[];for(const [k,t] of Object.entries(doc.meshMaps||{})){if(!t||k.startsWith('cv:'))continue;
 const C=['normal','wnormal','position','id'].includes(k)?3:1,raw=readMapF(t,C===3?4:1);let f=C===3?dropAlpha(raw,t.w*t.h):raw;
 if(k==='normal'&&texNormalFlip(pr))for(let i=1;i<f.length;i+=3)f[i]=1-f[i];
 const W=texCfg.size||t.w,H=texCfg.size?Math.max(1,Math.round(texCfg.size*t.h/t.w)):t.h,r=resampleF(f,t.w,t.h,C,W,H,false),bits=k==='height'&&texCfg.h16&&texCfg.fmt==='png'?16:8;
 const blob=await encodeTex(W,H,r,C,texCfg.fmt,bits),suffix=meshExportSuffix(k);files.push({suffix,name:pr.name(name).replace('{s}',suffix)+'.'+texCfg.fmt,data:new Uint8Array(await blob.arrayBuffer())});await tick();}return files;}
