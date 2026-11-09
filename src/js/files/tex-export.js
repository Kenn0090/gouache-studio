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
  /* (0.96.4, Kenn) Roblox: a SurfaceAppearance takes Color (alpha: transparency), Normal (OpenGL), Roughness and Metalness, at most 1024 px */
  roblox:{label:'Roblox (SurfaceAppearance)',normal:'gl',max:1024,name:n=>pascal(n)+'_{s}',outs:[
    {s:'Color',what:'ColorMap (alpha: transparency)',rgb:'base',a:'opac?'},
    {s:'Normal',what:'NormalMap (OpenGL)',rgb:'normal'},
    {s:'Roughness',what:'RoughnessMap',grey:'rough'},
    {s:'Metalness',what:'MetalnessMap',grey:'metal'}]},
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
const texCfg={preset:'unreal',normal:'preset',size:0,fmt:'png',h16:true,name:'',allSets:true,model:'none',meshMaps:false,pad:'dilate+inf',padPx:16};
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
/* (0.96.2) a fine, even grain of ±1 step before an 8-bit normal map is rounded: without it a gentle slope rounds into
   contour lines that bend at every triangle (herringbone and swirls on shiny or smooth surfaces); with it, they melt into noise
   too fine to see. Same seed every time, so exports are repeatable. */
function texDither(f){let s=0x9e3779b9;const r=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};for(let i=0;i<f.length;i++)f[i]+=(r()-r())/255;return f;}
function quant(f,bits){const m=bits===16?65535:255,q=bits===16?new Uint16Array(f.length):new Uint8Array(f.length);for(let i=0;i<f.length;i++)q[i]=Math.min(1,Math.max(0,f[i]))*m+.5|0;return q;}
async function encodeTex(W,H,f,C,fmt,bits){
  if(fmt==='tga'){const q=quant(f,8),st=new Uint8Array(W*H*4);for(let i=0;i<W*H;i++){if(C===1){st[i*4]=st[i*4+1]=st[i*4+2]=q[i];st[i*4+3]=255;}else{st.set(q.subarray(i*C,i*C+C),i*4);if(C===3)st[i*4+3]=255;}}
    return encodeTGA(W,H,st,true,C===4);}
  return encodePNGx(W,H,quant(f,bits),C,bits);}
/* build every file of a preset: [{name,data}] */
async function buildTextures(pr,name,opt){const W=doc.w,H=doc.h,S=pr&&pr.max?Math.max(1,Math.round(Math.min(texCfg.size||W,pr.max*W/Math.max(W,H)))):(texCfg.size||0),U=opt&&opt.udim?texUdim():null;
  /* (0.95) a UDIM set: the size is per tile, and each tile is its own file (Name_BaseColor.1001.png …) */
  const tw=U?W/U.B.nx:W,th=U?H/U.B.ny:H,nw=U?(S||Math.round(tw)):(S||W),nh=U?(S?Math.max(1,Math.round(S*th/tw)):Math.round(th)):(S?Math.max(1,Math.round(S*H/W)):H);
  const pad=texPadBegin(U?Math.round(nw*U.B.nx):nw);try{return await buildTexturesIn(pr,name,W,H,nw,nh,pad,U);}finally{texPadEnd(pad);}}
function texUdim(){if(ui.mode!=='p3d'||!p3.ua)return null;const S=p3.sets[p3.cur],m=S&&p3Binding(S),B=m&&udimBox(m);return B?{m,B}:null;}
function texCrop(f,W,H,C,r){const [x,y,w,h]=r,o=new Float32Array(w*h*C);for(let j=0;j<h;j++){const yy=Math.min(H-1,y+j);o.set(f.subarray((yy*W+x)*C,(yy*W+x+w)*C),j*w*C);}return o;}
async function buildTexturesIn(pr,name,W,H,nw,nh,pad,U){
  const cache={},has=k=>doc.maps.includes(k);
  const grey=k=>{if(k==='one')return null;const kk=k==='smooth'?'rough':k;const mm=texMesh(kk);if(!has(kk)&&!mm)return null;if(!cache[kk]){if(mm){const pt=texPadT(pad,mm,true);cache[kk]=resampleF(readMapF(pt,1),pt.w,pt.h,1,W,H,false);if(pt!==mm)release(pt);}else{const t=texPadT(pad,compositeMap(kk));cache[kk]=readMapF(t,1);release(t);}}return cache[kk];};
  const def=k=>k==='zero'?0:k==='one'?1:k==='smooth'?1-mapDefault('rough')[0]:has(k)?mapDefault(k)[0]:(MAP_DEFS[k].def!=null?MAP_DEFS[k].def:0);
  const files=[],ext=texCfg.fmt,n=W*H;
  for(const o of texOutputs(pr)){let f,C;
    if(o.rgb==='normal'){const t=texPadT(pad,normalComposite(texNormalFlip(pr),null));f=readMapF(t,4);release(t);C=3;f=dropAlpha(f,n);}
    else if(o.rgb){const t=texPadT(pad,compositeMap(o.rgb));const rgba=readMapF(t,4);release(t);
      if(o.a==='opac?'&&has('opac')){const op=grey('opac');for(let i=0;i<n;i++)rgba[i*4+3]*=op[i];C=4;f=rgba;}
      else if(o.rgb==='base'&&baseHasAlpha(rgba,n)&&o.a){C=4;f=rgba;}
      else{C=3;f=dropAlpha(rgba,n);}}
    else if(o.rgbA){const [rk,ak]=o.rgbA;const t=texPadT(pad,compositeMap(rk));const rgba=readMapF(t,4);release(t);const g=grey(ak),d=def(ak);for(let i=0;i<n;i++)rgba[i*4+3]=g?g[i]:d;C=4;f=rgba;
      if(!has(rk)){const c=mapDefault(rk);for(let i=0;i<n;i++){rgba[i*4]=c[0];rgba[i*4+1]=c[1];rgba[i*4+2]=c[2];}}}
    else if(o.grey){const g=grey(o.grey);if(!g)continue;f=g.slice();C=1;}
    else{C=o.ch.length;f=new Float32Array(n*C);o.ch.forEach((k,c)=>{const g=grey(k),inv=k==='smooth',d=def(k);for(let i=0;i<n;i++){const v=g?g[i]:d;f[i*C+c]=inv&&g?1-v:v;}});}
    const bits=o.grey==='height'&&texCfg.h16&&ext==='png'?16:8;
    if(U){for(const T of U.B.tiles){const R=udimTileRect(U.m,T,W,H),r=resampleF(texCrop(f,W,H,C,R),R[2],R[3],C,nw,nh,C===4);if(o.rgb==='normal'&&bits===8)texDither(r);
      const blob=await encodeTex(nw,nh,r,C,ext,bits);files.push({suffix:o.s,tile:T.id,name:pr.name(name).replace('{s}',o.s)+'.'+T.id+'.'+ext,data:new Uint8Array(await blob.arrayBuffer())});await tick();}continue;}
    const r=resampleF(f,W,H,C,nw,nh,C===4);if(o.rgb==='normal'&&bits===8)texDither(r);
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
    el('p',{class:'note',text:'The model goes with the textures. GLB embeds them; OBJ and FBX link to the exported files. FBX exports the static mesh, UVs, normals and material slots.'}),
    ...(texCfg.model==='obj'||texCfg.model==='fbx'?[sel('txUp','Up axis',[['engine','Follow the engine (now '+(upEngine()==='z'?'Z':'Y')+' up)'],['y','Y up'],['z','Z up']],texCfg.up||'engine',v=>{texCfg.up=v;})]:texCfg.model==='glb'?[el('p',{class:'note',text:'A .glb is always Y up (the glTF rule); Unreal and Blender turn it on import.'})]:[])]:[];
  body.append(sel('txPreset','Engine',texPresetsFor().map(([k,p])=>[k,p.label]),texCfg.preset,v=>{texCfg.preset=v;closeDialog();dlgExportTextures();}),own,
    el('div',{class:'frow'},el('label',{for:'txName',text:'Name'}),nameIn),
    sel('txNrm','Normal map',[['preset','Engine default'],['gl','OpenGL (green up)'],['dx','DirectX (green down)']],texCfg.normal,v=>{texCfg.normal=v;}),
    sel('txSize','Size',sizes,texCfg.size,v=>{texCfg.size=+v;}),
    sel('txFmt','Format',[['png','PNG'],['tga','TGA']],texCfg.fmt,v=>{texCfg.fmt=v;}),
    el('div',{class:'sub',text:'Padding'}),sel('txPad','Padding',TEX_PAD_MODES,texCfg.pad||'none',v=>{texCfg.pad=v;}),
    makeSlider({id:'txPadPx',label:'Dilation',min:0,max:128,step:1,value:texCfg.padPx??16,def:16,fmt:v=>Math.round(v)+' px',onInput:v=>{texCfg.padPx=Math.round(v);}}).el,
    el('p',{class:'note',id:'txPadNote',text:texPadAvail()?'Grows each UV island’s colours outward past its edges (in pixels of the exported size), so mip-maps in the engine show no seams. Fill the rest: the space between islands takes the nearest island’s colours. Transparent: it stays see-through (PNG/TGA with alpha).':'Padding needs the model’s UVs: export from 3D Paint, or open the 3D view with your model. Without them the maps are saved as painted.'}),
    chk('txH16','Height at 16 bits (PNG)',texCfg.h16,v=>{texCfg.h16=v;}),chk('txMeshMaps','Include assigned mesh maps',texCfg.meshMaps,v=>{texCfg.meshMaps=v;draw();}),el('p',{class:'note',text:'Mesh maps export at their original size unless you choose an export size. They have a Mesh_ prefix and belong to their texture set.'}),
    ui.mode==='p3d'&&p3.sets.filter(S=>!S.missing).length>1?chk('txAll','Every texture set (files named after each set)',texCfg.allSets,v=>{texCfg.allSets=v;draw();}):'',
    ...modelRow,...esRow(()=>{closeDialog();dlgExportTextures();}),el('div',{class:'sub',text:'Files'}),list);draw();
  openDialog({title:'Export textures',body,okLabel:platform.isDesktop?(esActive()?'Export and send':'Choose folder…'):'Export',onOk(){exportTextures();}});}
async function exportTextures(){const pr=TEX_PRESETS[texCfg.preset],name=texCfg.name||'Texture',wantModel=mxHasModel()&&texCfg.model&&texCfg.model!=='none';
  let dir=null;if(platform.isDesktop){dir=await esTargetDir(name);if(!dir)return;}
  const epm=esActive()?await epMastersCheck(es.to):{rec:null,update:false};
  toast('Exporting textures…');await tick();
  try{let files=[];const bySet={},glTex={},shInfo={};
    /* each texture set (3D Paint), or the document; the model needs glTF-shaped textures too */
    const one=async(setName,fileName)=>{const fs=await buildTextures(pr,fileName,{udim:true});bySet[setName]=fs;files.push(...fs);
      if(eshWanted()){const g=await buildTextures(GLTF_TEX,pascal(fileName)),T={};for(const f of g)T[f.suffix]=f;shInfo[setName]={sh:JSON.parse(JSON.stringify(eshSafeShade(v3ShadeOf(doc)))),tex:T,alpha:doc.maps.includes('opac')};for(const f of g)if(!files.some(x=>x.name===f.name))files.push(f);}if(texCfg.meshMaps)files.push(...await buildMeshMapTextures(pr,fileName));
      if(wantModel&&texCfg.model==='glb'){const g=await buildTextures(GLTF_TEX,pascal(fileName)),T={};for(const f of g)T[f.suffix]=f;T.alpha=doc.maps.includes('opac');glTex[setName]=T;}};
    const sets=ui.mode==='p3d'?p3.sets.filter(S=>!S.missing):[];
    if(ui.mode==='p3d'&&(texCfg.allSets||wantModel)&&sets.length>1){const back=p3.cur;
      try{for(let i=0;i<p3.sets.length;i++){if(p3.sets[i].missing)continue;p3SwitchSet(i,true);const S=p3.sets[i];await one(S.name,S.tile?name+'_'+S.tile.id:name+'_'+S.name);}}finally{p3SwitchSet(back,true);}}
    else{const S=ui.mode==='p3d'&&p3.sets[p3.cur];await one(S?S.name:(doc.name||name),S&&S.tile?name+'_'+S.tile.id:name);}
    if(wantModel){const m=p3.ua&&ui.mode==='p3d'&&texCfg.model==='glb'&&v3.imported?udimAtlasMesh(v3.imported):mxModel()/* (0.95) glTF has no UDIM tiles: the .glb carries the tiles' canvas UVs and whole-canvas textures; OBJ/FBX keep the file's UDIM UVs with one picture per tile */,setNames=Object.keys(bySet),groups=mxGroups(m,setNames),mn=pascal(name);
      if(texCfg.model==='glb')files=files.concat([{name:mn+'.glb',data:mxGLB(m,groups,glTex,mn)}]);
      /* (0.95.1) OBJ and FBX follow the chosen up axis (Unreal/Blender Z up); glTF is always Y up */
      else if(texCfg.model==='fbx'){const z=upExportAxis()==='z';files.push({name:mn+'.fbx',data:mxFBX(z?upYtoZ(m):m,groups,bySet,mn,pr,{zUp:z})});}
      else{const o=mxOBJ(upExportAxis()==='z'?upYtoZ(m):m,groups,bySet,mn,pr);files.push({name:mn+'.obj',data:o.obj},{name:mn+'.mtl',data:o.mtl});}}
    const epv=eshWanted()?await epResolve(es.to,epm.rec,name,shInfo):{regen:new Set(),updates:[]};
    if(eshWanted()&&Object.keys(shInfo).length)files.push(...eshFiles(es.to,name,shInfo,eshModelSize(mxHasModel()?mxModel():null),wantModel&&['glb','obj','fbx'].includes(texCfg.model)?pascal(name)+'.'+texCfg.model:null,{updateMasters:epm.update,updates:epv.updates}));
    if(!files.length){toast('Nothing to export.');return;}
    if(dir){const sep=dir.includes('\\')?'\\':'/';for(const f of files){const fp=eshPath(dir,f.name);if(f.shared&&!epm.update&&await elExists(fp)&&!await eshStale(fp))continue;if(/^(\.\.\/)*[^\/]+\//.test(f.name))await platform.invoke('make_dir',{path:fp.replace(/[\\/][^\\/]*$/,'')});await platform.writeFile(fp,f.data);}toast('Saved '+files.length+' files to '+dir);esLastBySet=bySet;await esAfter(dir,files,name);if(eshWanted()){const nregen=await epRegen(es.to,epm.rec,epv.regen);if(nregen)toast('Updated '+nregen+' material file'+(nregen===1?'':'s')+' of other assets that follow this look.');}
    if(eshWanted())await epRecord(es.to,epm.rec,name,files,shInfo,wantModel&&['glb','obj','fbx'].includes(texCfg.model)?pascal(name)+'.'+texCfg.model:null,epm.update);}
    else{const r=await deliver(pascal(name)+'_'+(pr.user?'custom':texCfg.preset)+'.zip',await makeZipMulti(files));toast(deliveredText(r,'Textures'));}
    return files;}
  catch(e){console.error(e);toast('Export failed: '+(e.message||e));}}

const meshExportSuffix=k=>'Mesh_'+({normal:'Normal',height:'Height',ao:'AO',curv:'Curvature',curvEdge:'CurvatureEdges',curvCrease:'CurvatureCreases',thick:'Thickness',wnormal:'WorldNormal',position:'Position',id:'ID',rough:'Roughness',metal:'Metallic'}[k]||pascal(k));
async function buildMeshMapTextures(pr,name){const files=[],pad=texPadBegin(texCfg.size||doc.w);try{for(const [k,t0] of Object.entries(doc.meshMaps||{})){if(!t0||k.startsWith('cv:'))continue;
 const t=texPadT(pad,t0,true),C=['normal','wnormal','position','id'].includes(k)?3:1,raw=readMapF(t,C===3?4:1);if(t!==t0)release(t);let f=C===3?dropAlpha(raw,t.w*t.h):raw;
 if(k==='normal'&&texNormalFlip(pr))for(let i=1;i<f.length;i+=3)f[i]=1-f[i];
 const W=texCfg.size||t.w,H=texCfg.size?Math.max(1,Math.round(texCfg.size*t.h/t.w)):t.h,r=resampleF(f,t.w,t.h,C,W,H,false),bits=k==='height'&&texCfg.h16&&texCfg.fmt==='png'?16:8;
 const blob=await encodeTex(W,H,r,C,texCfg.fmt,bits),suffix=meshExportSuffix(k);files.push({suffix,name:pr.name(name).replace('{s}',suffix)+'.'+texCfg.fmt,data:new Uint8Array(await blob.arrayBuffer())});await tick();}}finally{texPadEnd(pad);}return files;}

