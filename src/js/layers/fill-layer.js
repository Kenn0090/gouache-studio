/* ================= Fill (material) layers =================
   Like Substance Painter's fill layers: one layer that fills every map it has switched on (base colour,
   roughness, metallic, height, normal, emissive, opacity…) with a value or colour, or with an image. Images are
   laid out by the UVs (tiled, turned) or triplanar: projected from the three axes of the model and blended, so
   there are no seams. Height images make bump detail (the normal follows the height), with a strength. What shows
   is decided by the mask, so painting on a fill layer paints its mask. The layer stays live: double-click it to
   change the material. L.fill = {maps:{k:{on,src,c,v,tile,rot,name}},proj,triSharp,hStr,name};
   the chosen images are L._fillImg[k] (kept in .gouache files). */
const FS_FILLIMG=`uniform sampler2D uSrc; uniform float uTile; uniform float uRot; uniform int uGrey; uniform int uTri; uniform sampler2D uPos; uniform sampler2D uNrm;
uniform float uSharp; uniform float uHStr; uniform int uHeight; uniform int uNormal; in vec2 vUV;
vec4 samp(vec2 t){ float c=cos(uRot),s=sin(uRot); t=mat2(c,s,-s,c)*(t-0.5)+0.5; return texture(uSrc,t); }
void main(){ vec4 s;
  if(uTri==1){ ivec2 q=ivec2(gl_FragCoord.xy); vec4 P=texelFetch(uPos,q,0); if(P.a<0.5){ o=vec4(0.0); return; }
    vec3 N=normalize(texelFetch(uNrm,q,0).xyz+1e-5); vec3 w=pow(abs(N),vec3(uSharp)); w/=max(w.x+w.y+w.z,1e-5); vec3 p=P.xyz*uTile*0.5;
    s=samp(p.zy)*w.x+samp(p.xz)*w.y+samp(p.xy)*w.z; }
  else s=samp(vUV*uTile);
  vec3 c=s.a>1e-6?s.rgb/s.a:vec3(0.0);
  if(uGrey==1){ float g=dot(c,vec3(0.299,0.587,0.114)); if(uHeight==1) g=clamp(0.5+(g-0.5)*uHStr,0.0,1.0); o=vec4(vec3(g),1.0); return; }
  if(uNormal==1){ o=vec4(c,1.0); return; }
  o=s; }`;
let P_FILLIMG=null,fillCount=0;
/* maps a fill can fill (curvature is a measurement, not a material) */
const FILL_SKIP=['curv'];
const fillMapsOf=()=>doc.maps.filter(k=>!FILL_SKIP.includes(k));
function fillDefaults(){const m={};for(const k of MAP_ORDER){if(FILL_SKIP.includes(k))continue;const d=MAP_DEFS[k].def;
    m[k]={on:k==='base'||k==='rough'||k==='metal'||k==='spec'||k==='gloss',src:k==='normal'?'image':'value',c:k==='base'?ui.fg.slice():k==='spec'?[.22,.22,.22]:k==='emis'?[0,0,0]:null,v:d==null?.5:d,tile:1,rot:0};}
  return {maps:m,proj:'uv',triSharp:4,hStr:1};}
const fillClone=f=>JSON.parse(JSON.stringify(f));
/* where each texel of the texture sits on the model (and which way it faces), for triplanar: the model drawn in UV space */
const VS_FILLPOS=`#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aT; uniform vec2 uShift; uniform float uUVs; out vec3 vP; out vec3 vN;
void main(){ vP=aP; vN=aN; gl_Position=vec4((aT*uUVs-uShift)*2.0-1.0,0.0,1.0); }`;
const FS_FILLDIL=`uniform sampler2D uSrc; void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uSrc,0); vec4 c=texelFetch(uSrc,p,0); if(c.a>0.5){ o=c; return; }
  vec4 acc=vec4(0.0); for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ vec4 n=texelFetch(uSrc,clamp(p+ivec2(i,j),ivec2(0),s-1),0); if(n.a>0.5) acc+=vec4(n.rgb,1.0); }
  o=acc.a>0.0?vec4(acc.rgb/acc.a,1.0):vec4(0.0); }`;
let P_FILLPOS=null,fillPosC=null;
function fillPosMaps(){const m=v3.mesh,g=v3.gpu;if(!m||!g||m.noUV)return null;const R=ui.mode==='p3d'&&typeof p3Range==='function'?p3Range():{start:0,count:m.idx.length/3},uvs=(v3s().uvs)||1;
  const key=[m.name,m.idx.length,R.start,R.count,doc.w,doc.h,uvs].join();if(fillPosC&&fillPosC.key===key&&fillPosC.m===m)return fillPosC;
  if(fillPosC){disposeTarget(fillPosC.pos);disposeTarget(fillPosC.nrm);}
  if(!P_FILLPOS)P_FILLPOS={pos:prog3(VS_FILLPOS,'in vec3 vP; in vec3 vN; void main(){ o=vec4(vP,1.0); }'),nrm:prog3(VS_FILLPOS,'in vec3 vP; in vec3 vN; void main(){ o=vec4(normalize(vN),1.0); }'),dil:program(FS_FILLDIL)};
  /* 32-bit float images must be read unfiltered (nearest), or they read as zero */
  const mk=()=>{const t=makeTarget(doc.w,doc.h,32,false);gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t;},pos=mk(),nrm=mk(),tmp=mk();
  for(const [t,pr] of [[pos,P_FILLPOS.pos],[nrm,P_FILLPOS.nrm]]){clearTarget(t,[0,0,0,0]);
    for(let j=0;j<uvs;j++)for(let i=0;i<uvs;i++){useProg(pr,{uShift:[i,j],uUVs:uvs});bindTarget(t);gl.disable(gl.BLEND);gl.bindVertexArray(g.vao);gl.drawElements(gl.TRIANGLES,R.count*3,gl.UNSIGNED_INT,R.start*12);}
    gl.bindVertexArray(vao);
    /* a few texels of padding past the UV edges, so seams don't show */
    for(let n=0;n<4;n++){run(P_FILLPOS.dil,tmp,{uSrc:t.tex});blit(tmp,t,0,0,doc.w,doc.h,0,0);}}
  disposeTarget(tmp);fillPosC={key,m,pos,nrm};return fillPosC;}
/* redraw a fill layer's maps from its settings (image maps need their picture in memory) */
function fillRender(L,only){const f=L.fill;if(!f)return;const tri=f.proj==='tri'?fillPosMaps():null;
  for(const k of fillMapsOf()){if(only&&k!==only)continue;const s=f.maps[k]||(f.maps[k]=fillDefaults().maps[k]);
    if(!s.on){const t=mapT(L,k);if(t&&!t.empty)clearTarget(t);continue;}
    const T=ensureMapTarget(L,k),grey=MAP_DEFS[k].grey;
    if(s.src==='image'){const img=L._fillImg&&L._fillImg[k];if(!img){if(k==='normal')clearTarget(T,[.5,.5,1,1]);continue;}if(!P_FILLIMG)P_FILLIMG=program(FS_FILLIMG);
      run(P_FILLIMG,T,{uSrc:img.tex,uTile:Math.max(.05,s.tile||1),uRot:(s.rot||0)*Math.PI/180,uGrey:{int:grey?1:0},uTri:{int:tri?1:0},uPos:tri?tri.pos.tex:dummy,uNrm:tri?tri.nrm.tex:dummy,
        uSharp:f.triSharp||4,uHStr:f.hStr==null?1:f.hStr,uHeight:{int:k==='height'?1:0},uNormal:{int:k==='normal'?1:0}});continue;}
    if(k==='normal'){clearTarget(T,[.5,.5,1,1]);continue;}
    const c=grey?[s.v,s.v,s.v]:(s.c||[s.v,s.v,s.v]);clearTarget(T,[c[0],c[1],c[2],1]);}
  if(doc.map==='base')delete L.blankBase;L.lookVer=(L.lookVer||0)+1;scheduleThumb(L);requestRender(true);}
/* Layer › New fill layer (and the fill button under the layers): fills everything; a selection becomes its mask.
   preset: a material {name, maps:{k:{c|v|src…}}, proj, triSharp, hStr, imgs:{k:target}} fills with it and skips the dialog */
function cmdNewFillLayer(preset){if(ui.mode==='anim'){toast('Fill layers are available in Paint mode.');return;}
  if(ui.mode!=='paint'&&ui.mode!=='p3d'&&typeof setMode==='function')setMode('paint',true);
  const L=newLayerObj(preset&&preset.name||'Fill '+(++fillCount));doc.count--;L.fill=fillDefaults();
  if(preset&&preset.maps){for(const k in L.fill.maps)L.fill.maps[k].on=false;for(const k in preset.maps)if(L.fill.maps[k])Object.assign(L.fill.maps[k],{on:true,src:'value'},preset.maps[k]);
    for(const k of ['proj','triSharp','hStr'])if(preset[k]!=null)L.fill[k]=preset[k];L.fill.name=preset.name;
    if(preset.imgs){L._fillImg={};for(const k in preset.imgs){const s=preset.imgs[k],t=makeTarget(s.w,s.h,8,true);blit(s,t,0,0,s.w,s.h,0,0);L._fillImg[k]=t;}}
    const need=Object.keys(preset.maps).filter(k=>preset.maps[k].on!==false&&!doc.maps.includes(k)&&MAP_DEFS[k]&&!(doc.workflow==='spec'&&(k==='rough'||k==='metal')));
    if(need.length)setDocMaps([...doc.maps,...need],'Add maps for the material');}
  fillRender(L);
  const m=makeMask(1),fromSel=sel.active&&!sel.quick;if(fromSel)run(P.loadsel,m.target,{uSrc:sel.t.tex,uWhat:{int:1},uInv:false});
  L.mask=m;L.editMask=true;
  structOp(preset?'Add material':'New fill layer',()=>{const [p,i]=insertPoint();insertNode(L,p,i);selectOnly(L);});
  changed(L);if(!preset)dlgFillLayer(L,true);else{renderLayers();toast('Added “'+L.name+'”'+(fromSel?' in the selection.':'. Paint its mask to show it where you want (black hides, white shows).'));}return L;}
/* the material editor: live on the canvas and the model, one undo step on OK */
const MAT_CH=['base','rough','metal','height','normal','emis','opac','spec','gloss','ao'];
function dlgFillLayer(L,fresh){L=L||doc.active;if(!isLayer(L)||!L.fill){toast('Select a fill layer.');return;}
  const before=fillClone(L.fill),W=fillClone(L.fill),keys0=fillMapsOf(),snapB={};
  for(const k of keys0){const t=mapT(L,k);snapB[k]=t&&!t.empty?captureRegion(t,0,0,doc.w,doc.h):null;}
  const imgB=Object.assign({},L._fillImg||{}),nameB=L.name;
  const apply=k=>{L.fill=W;fillRender(L,k);prev.redraw();};
  const box=el('div',{class:'dlg-grid filldlg'}),prev=matPreviewEl(()=>W,()=>L._fillImg);
  const draw=()=>{box.replaceChildren();const keys=MAT_CH.filter(k=>fillMapsOf().includes(k));
    const nm=el('input',{type:'text',id:'fl_name',value:L.name,'aria-label':'Material name'});nm.addEventListener('input',()=>{L.name=nm.value||L.name;W.name=L.name;renderLayers();});
    box.append(el('div',{class:'matHead'},prev.el,el('div',{class:'dlg-grid'},nm,
      el('div',{class:'sub',text:'Projection'}),seg([['uv','UV'],['tri','Triplanar']],W.proj||'uv',v=>{W.proj=v;if(v==='tri'&&!fillPosMaps())toast('Triplanar needs a model: open the 3D view or 3D Paint. Until then images follow the UVs.');apply();draw();},'Projection'),
      W.proj==='tri'?makeSlider({id:'fl_sharp',label:'Blend',min:1,max:16,step:.5,value:W.triSharp||4,fmt:v=>v<3?'soft':v>9?'sharp':'medium',onInput:v=>{W.triSharp=v;apply();}}).el:null)));
    for(const k of keys){const s=W.maps[k]||(W.maps[k]=fillDefaults().maps[k]),grey=MAP_DEFS[k].grey,isN=k==='normal';
      const row=el('div',{class:'fillrow'+(s.on?'':' off')});
      row.append(chk('fl_on_'+k,MAP_DEFS[k].label,!!s.on,v=>{s.on=v;if(v&&isN)s.src='image';apply(k);draw();}));
      if(s.on){if(!isN)row.append(seg([['value',grey?'Value':'Colour'],['image','Image']],s.src,v=>{s.src=v;if(v==='image'&&!(L._fillImg&&L._fillImg[k]))fillPickImage(L,k,s,()=>{apply(k);draw();});else{apply(k);draw();}},'Fill '+MAP_DEFS[k].label+' with'));
        if(s.src==='value'&&!isN){if(grey)row.append(makeSlider({id:'fl_v_'+k,label:k==='metal'?'Metallic':k==='rough'?'Roughness':k==='height'?'Height':'Level',min:0,max:1,step:.01,value:s.v,fmt:pct,onInput:v=>{s.v=v;apply(k);}}).el);
          else row.append(el('div',{class:'frow'},el('label',{text:'Colour'}),colourBtn('fl_c_'+k,()=>s.c||[.5,.5,.5],c=>{s.c=c;apply(k);},MAP_DEFS[k].label+' colour')));}
        else{const has=!!(L._fillImg&&L._fillImg[k]);
          row.append(el('div',{class:'row wrap'},el('span',{class:'note',text:s.name||(isN?'No normal map yet':'No image')}),el('button',{class:'btn sm',text:'Choose image…',id:'fl_img_'+k,onclick:()=>fillPickImage(L,k,s,()=>{apply(k);draw();})})));
          if(has)row.append(makeSlider({id:'fl_t_'+k,label:W.proj==='tri'?'Scale':'Tile',min:.25,max:16,step:.25,value:s.tile||1,fmt:v=>v+'×',onInput:v=>{s.tile=v;apply(k);}}).el,
            makeSlider({id:'fl_r_'+k,label:'Turn',min:-180,max:180,step:1,value:s.rot||0,fmt:v=>v+'°',onInput:v=>{s.rot=v;apply(k);}}).el);
          else if(s.name)row.append(el('p',{class:'note',text:'Choose the image again to change its tiling.'}));
          if(k==='height'&&has)row.append(makeSlider({id:'fl_hs',label:'Bump strength',min:0,max:4,step:.05,value:W.hStr==null?1:W.hStr,fmt:pct,onInput:v=>{W.hStr=v;apply(k);}}).el,
            el('p',{class:'note',text:'Height makes bump detail: the normal follows it, on the model and in exported normal maps.'}));}}
      box.append(row);}
    const miss=['rough','metal','height','normal','emis','opac'].filter(k=>!doc.maps.includes(k)&&!(doc.workflow==='spec'&&(k==='rough'||k==='metal')));
    if(miss.length)box.append(el('div',{class:'chips'},el('span',{class:'note',text:'Add a map:'}),...miss.map(k=>el('button',{class:'btn sm',text:MAP_DEFS[k].label,onclick:()=>{setDocMaps([...doc.maps,k],'Add a map for the material');fillRender(L);draw();}}))));
    box.append(el('div',{class:'chips'},el('button',{class:'btn sm',id:'fl_save',text:'Save to Materials',title:'Keep this material in the Materials tab for other layers and projects',onclick:()=>{if(typeof matSaveFromFill==='function')matSaveFromFill(L,W);}})),
      el('p',{class:'note',text:'Painting on a fill layer paints its mask: black hides the material, white shows it.'}));};
  draw();
  const restore=()=>{L.fill=before;L.name=nameB;for(const k in L._fillImg||{})if(L._fillImg[k]!==imgB[k])disposeTarget(L._fillImg[k]);L._fillImg=imgB;for(const k of Object.keys(snapB)){const s=snapB[k];if(s)restoreRegion(s,ensureMapTarget(L,k),0,0);else{const t=mapT(L,k);if(t&&!t.empty)clearTarget(t);}}fillRender(L);changed(L);renderLayers();};
  openDialog({title:(fresh?'New material':'Material')+': '+L.name,body:box,okLabel:'OK',
    onCancel(){restore();},
    onOk(){L.fill=W;const keys=[...new Set([...keys0,...fillMapsOf()])],snapA={},imgA=Object.assign({},L._fillImg||{}),nameA=L.name;
      for(const k of keys){const t=mapT(L,k);snapA[k]=t&&!t.empty?captureRegion(t,0,0,doc.w,doc.h):null;}
      const put=(f,S,I,n)=>{L.fill=fillClone(f);L._fillImg=I;L.name=n;for(const k of keys){const s=S[k];if(s)restoreRegion(s,ensureMapTarget(L,k),0,0);else{const t=mapT(L,k);if(t&&!t.empty)clearTarget(t);}}L.lookVer=(L.lookVer||0)+1;renderLayers();};
      if(JSON.stringify(before)!==JSON.stringify(W)||nameA!==nameB)pushUndo({label:'Material',refs:[L],snaps:[...Object.values(snapB),...Object.values(snapA)].filter(Boolean),undo(){put(before,snapB,imgB,nameB);},redo(){put(W,snapA,imgA,nameA);}});
      changed(L);}});}
async function fillPickImage(L,k,s,done){const fs=await pickFiles('image/*',false,'Images',['png','jpg','jpeg','webp','tga','tif','tiff','bmp','psd','exr','hdr']);const f=fs[0];if(!f){if(!(L._fillImg&&L._fillImg[k])&&k!=='normal')s.src='value';done();return;}
  let t;try{t=await fileTarget(f);}catch(e){toast('Could not read '+f.name+': '+(e.message||e));if(k!=='normal')s.src='value';done();return;}
  setWrap(t,true);L._fillImg=L._fillImg||{};L._fillImg[k]=t;s.src='image';s.name=f.name;done();}
/* painting, filters and fills on a fill layer go to its mask */
function fillMaskEdit(n){if(isLayer(n)&&n.fill&&n.mask&&!n.editMask)n.editMask=true;}
/* Convert to pixels: the layer keeps what it shows now and becomes a normal layer */
function fillRasterize(L){if(!L||!L.fill)return;const f=L.fill;L.fill=null;pushUndo({label:'Convert fill to pixels',refs:[L],undo(){L.fill=f;renderLayers();},redo(){L.fill=null;renderLayers();}});renderLayers();}
/* ---- a small preview ball of a material (drawn on the CPU: base colour or its image, roughness, metallic, height bumps) ---- */
const matImgCPU=new WeakMap();
function matImgPixels(t){if(!t)return null;let c=matImgCPU.get(t);if(c)return c;const n=64,tmp=makeTarget(n,n,8,false);run(P.resample,tmp,{uSrc:t.tex,uOffset:[0,0],uScale:[t.w/n,t.h/n],uTaps:{int:8},uOutside:[0,0,0,0]});
  const d=captureRegionNow(tmp,0,0,n,n).data;disposeTarget(tmp);c={n,d};matImgCPU.set(t,c);return c;}
function matPreviewEl(getF,getImgs,size){const S=size||96,cv2=el('canvas',{class:'matprev',width:S,height:S,'aria-hidden':'true'});
  const redraw=()=>{const f=getF(),I=getImgs()||{},x=cv2.getContext('2d'),id=x.createImageData(S,S),D=id.data,ch=k=>f.maps[k]&&f.maps[k].on?f.maps[k]:null;
    const bI=ch('base')&&ch('base').src==='image'?matImgPixels(I.base):null,hI=ch('height')&&ch('height').src==='image'?matImgPixels(I.height):null;
    const bc=ch('base')?(ch('base').c||[.7,.7,.7]):[.72,.72,.72],r=ch('rough')?ch('rough').v:.5,mt=ch('metal')?ch('metal').v:0,hs=f.hStr==null?1:f.hStr;
    const smp=(im,u,v)=>{const n=im.n,i=((Math.floor(v*n)%n+n)%n*n+(Math.floor(u*n)%n+n)%n)*4,a=im.d[i+3]/255||1;return [im.d[i]/255/a,im.d[i+1]/255/a,im.d[i+2]/255/a];};
    const L=norm3([-.5,.6,.65]),lin=v=>Math.pow(v,2.2);
    for(let y=0;y<S;y++)for(let x0=0;x0<S;x0++){const nx=(x0+.5)/S*2-1,ny=1-(y+.5)/S*2,rr=nx*nx+ny*ny,p=(y*S+x0)*4;if(rr>1){D[p+3]=0;continue;}
      let N=[nx,ny,Math.sqrt(1-rr)];const u=.5+Math.atan2(N[0],N[2])/(2*Math.PI),v=.5-Math.asin(N[1])/Math.PI;
      if(hI){const e=.01,h=q=>smp(hI,q[0]*2,q[1])[0],g0=h([u,v]),gx=h([u+e,v])-g0,gy=h([u,v+e])-g0;N=norm3([N[0]-gx*hs*6,N[1]+gy*hs*6,N[2]]);}
      const c=(bI?smp(bI,u*2,v):bc).map(lin),H=norm3([L[0],L[1],L[2]+1]),nl=Math.max(0,dot3(N,L)),nh=Math.max(0,dot3(N,H)),sp=Math.pow(nh,2+(1-r)*(1-r)*120)*(1-r*.7)*(.3+mt*.7);
      /* a simple sky reflected in it (bright above, dark below), blurrier the rougher it is */
      const Ry=2*N[2]*N[1],env=(.25+.75*clamp(Ry*.5+.5,0,1))*(1-r*.55)+r*.2,fr=Math.pow(1-N[2],3);
      const amb=.18+.1*N[1];for(let k=0;k<3;k++){const dif=c[k]*(1-mt),spc=mt?c[k]:.04+.5*fr*(1-r);D[p+k]=Math.round(Math.pow(Math.min(1,dif*(nl*.9+amb)+spc*(sp*1.6+env*(mt?1.1:.8))),1/2.2)*255);}D[p+3]=255;}
    x.putImageData(id,0,0);};
  redraw();return {el:cv2,redraw};}
