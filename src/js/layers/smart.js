/* ================= Smart materials and smart masks (0.24) =================
   Like Substance Painter's: a smart material is a folder of layers (material layers with their mask rows,
   effects, styles and pictures) saved to the Materials tab; a click adds the whole folder, still live, so its
   generators fit whatever model it lands on. A smart mask is a mask's rows on their own, dropped onto any layer.
   Saved ones live with the materials (the browser's storage) and export as .gmat files. The built-ins are made
   of materials and generators only (no pictures), so they work at any size. */
/* ---- a layer or folder → a plain description (pictures copied as 8-bit images) ---- */
function smCap(t){if(!t||t.empty)return null;let s=t,tmp=null;if(t.depth!==8){tmp=makeTarget(t.w,t.h,8,false);copyScaled(t,tmp);s=tmp;}const c=captureRegionNow(s,0,0,s.w,s.h);if(tmp)disposeTarget(tmp);return {w:c.w,h:c.h,data:c.data};}
const smClone=o=>JSON.parse(JSON.stringify(o,(k,x)=>k==='t'||k[0]==='_'?undefined:x));
function smSer(n){const o={t:n.type==='group'?'G':'L',name:n.name,mode:n.mode,op:n.opacity,vis:n.visible!==false,clip:!!n.clip,mapModes:Object.assign({},n.mapModes||{})};
  if(n.type==='group'){o.open=n.open!==false;o.kids=n.children.map(smSer);}
  else{if(n.fill){o.fill=fillClone(n.fill);o.fillImg={};for(const k in n._fillImg||{})o.fillImg[k]=smCap(n._fillImg[k]);}
    else{o.maps={};for(const k of mapKeysOf(n)){const c=smCap(mapT(n,k));if(c)o.maps[k]=c;}}
    if(n.styles)o.styles=smClone(n.styles);if(n.cfx&&n.cfx.length)o.cfx=smClone(n.cfx);}
  if(n.mask)o.mask=smSerMask(n.mask);return o;}
function smSerMask(m){if(m.stack)return {en:m.enabled!==false,rows:m.stack.map(r=>Object.assign(smClone(r),r.t?{img:smCap(r.t)}:{}))};return {en:m.enabled!==false,img:smCap(m.target)};}
/* ---- a description → layers (pictures stretched to this document's size) ---- */
function smImg(im){if(!im)return null;const t=makeTarget(im.w,im.h,8,false);writeRegion(t,0,0,im.w,im.h,im.data);return t;}
function smFit(im,depth){const s=smImg(im);if(!s)return null;const d=makeTarget(doc.w,doc.h,depth||8,false);if(s.w===doc.w&&s.h===doc.h)copyScaled(s,d);else run(P.resample,d,{uSrc:s.tex,uOffset:[0,0],uScale:[s.w/doc.w,s.h/doc.h],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(s.w/doc.w)))},uOutside:[0,0,0,0]});disposeTarget(s);return d;}
function smBuildMask(o){const m=makeMask(o.rows?0:1);m.enabled=o.en!==false;
  if(o.rows){m.stack=[];m._rows=new Set();for(const d of o.rows){const r=Object.assign(msRow(d.kind),smClone(d),{id:'r'+(++msSeq)});delete r.img;
      if(d.img){r.t=d.kind==='image'?smImg(d.img):smFit(d.img,m.target.depth);if(r.t&&d.kind==='image')setWrap(r.t,true);}else if(d.kind==='paint'){r.t=makeTarget(doc.w,doc.h,m.target.depth);clearTarget(r.t,[0,0,0,0]);}
      m.stack.push(r);m._rows.add(r);}m._key=null;}
  else if(o.img){const t=smFit(o.img,m.target.depth);if(t){copyScaled(t,m.target);disposeTarget(t);}}
  return m;}
function smBuild(o){let n;
  if(o.t==='G'){n=newGroupObj(o.name);n.open=o.open!==false;for(const k of o.kids||[]){const c=smBuild(k);insertNode(c,n);}}
  else{n=newLayerObj(o.name);doc.count--;
    if(o.fill){n.fill=Object.assign(fillDefaults(),fillClone(o.fill));const D=fillDefaults().maps;for(const k in D)n.fill.maps[k]=Object.assign({},D[k],o.fill.maps&&o.fill.maps[k]||{on:false});
      if(o.fillImg&&Object.keys(o.fillImg).length){n._fillImg={};for(const k in o.fillImg){const t=smImg(o.fillImg[k]);if(t){setWrap(t,true);n._fillImg[k]=t;}}}fillRender(n);}
    else for(const k in o.maps||{}){if(!doc.maps.includes(k)&&k!=='base')continue;const t=smFit(o.maps[k],mapDepth(k));if(t){copyScaled(t,ensureMapTarget(n,k));disposeTarget(t);}}
    if(o.styles)n.styles=smClone(o.styles);if(o.cfx)n.cfx=o.cfx.map(r=>Object.assign(msRow('filter'),smClone(r),{id:'r'+(++msSeq)}));}
  Object.assign(n,{visible:o.vis!==false,opacity:o.op==null?1:o.op,mode:o.mode==null?(o.t==='G'?-1:0):o.mode,clip:!!o.clip,mapModes:Object.assign({},o.mapModes||{})});
  if(o.mask)n.mask=smBuildMask(o.mask);return n;}
/* the maps a description needs (added to the document if missing) */
function smMapsOf(o,out){out=out||new Set();if(o.fill)for(const k in o.fill.maps||{})if(o.fill.maps[k].on!==false)out.add(k);for(const k in o.maps||{})out.add(k);for(const c of o.kids||[])smMapsOf(c,out);return out;}
/* Materials tab › a smart material: the folder goes above the active layer (a selection becomes its mask) */
function smApply(rec){if(ui.mode==='anim'){toast('Smart materials are for Paint and 3D Paint.');return;}if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const need=[...smMapsOf(rec.tree)].filter(k=>MAP_DEFS[k]&&!doc.maps.includes(k)&&!FILL_SKIP.includes(k)&&!(doc.workflow==='spec'&&(k==='rough'||k==='metal')));
  if(need.length)setDocMaps([...doc.maps,...need],'Add maps for the smart material');
  const n=smBuild(rec.tree);n.name=rec.name;const fromSel=sel.active&&!sel.quick&&!n.mask;
  if(fromSel){n.mask=makeMask(0);run(P.loadsel,n.mask.target,{uSrc:sel.t.tex,uWhat:{int:1},uInv:false});}
  /* above the selected layer or folder (not inside a folder that happens to be selected) */
  const A=doc.active,P=insertAt?insertAt.parent:A&&A.parent?A.parent:doc.root,I=insertAt?insertAt.index:A&&A.parent?P.children.indexOf(A)+1:P.children.length;
  structOp('Add smart material',()=>{insertNode(n,P,I);selectOnly(n);});msEpoch++;changedAll();
  toast('Added the smart material “'+rec.name+'”'+(fromSel?' in the selection.':'. Its rows stay live: change them under each layer.'));return n;}
/* Materials tab › a smart mask: it becomes the active layer's mask */
function smMaskApply(rec){const L=doc.active;if(!L||L.fx||ui.mode==='anim'){toast('Select a layer first.');return;}
  msRecord(L,'Smart mask “'+rec.name+'”',()=>{const m=smBuildMask(rec.mask);if(L.mask){m.enabled=L.mask.enabled;}L.mask=m;L.editMask=true;});msEpoch++;toast('“'+L.name+'” has the smart mask “'+rec.name+'”.');}

/* ---- saving ---- */
function smThumb(){/* what the 3D view shows (or the base colour of the painting), small */
  try{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
    if(v3.on&&v3.fbo){const F=v3.fbo,s=Math.min(F.w,F.h),d=new Uint8Array(s*s*4);gl.bindFramebuffer(gl.FRAMEBUFFER,F.rf);gl.readPixels((F.w-s)>>1,(F.h-s)>>1,s,s,gl.RGBA,gl.UNSIGNED_BYTE,d);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      const t=document.createElement('canvas');t.width=t.height=s;const id=t.getContext('2d').createImageData(s,s);for(let y=0;y<s;y++)id.data.set(d.subarray((s-1-y)*s*4,(s-y)*s*4),y*s*4);t.getContext('2d').putImageData(id,0,0);x.drawImage(t,0,0,64,64);}
    else{const t=compositeMap('base'),im=captureRegionNow(t,0,0,doc.w,doc.h);release(t);const s=document.createElement('canvas');s.width=doc.w;s.height=doc.h;const id=s.getContext('2d').createImageData(doc.w,doc.h);
      for(let i=0;i<im.data.length;i+=4){const a=im.data[i+3]||1;id.data[i]=im.data[i]*255/a;id.data[i+1]=im.data[i+1]*255/a;id.data[i+2]=im.data[i+2]*255/a;id.data[i+3]=255;}s.getContext('2d').putImageData(id,0,0);x.drawImage(s,0,0,64,64);}
    return c.toDataURL('image/png');}catch(e){return null;}}
function smAskName(title,def,fn){const inp=el('input',{type:'text',id:'smName',value:def,'aria-label':'Name'});
  openDialog({title,body:el('div',{class:'dlg-grid'},inp),okLabel:'Save',onOk(){const n=inp.value.trim();if(!n)return false;fn(n);}});setTimeout(()=>{inp.focus();inp.select();},0);}
function smSave(n){if(!n)return;smAskName('Save as smart material',n.name,name=>{const tree=n.type==='group'?smSer(n):{t:'G',name,open:true,kids:[smSer(n)]};
  smPut({kind:'smart',name,tree,thumb:smThumb()});toast('Saved “'+name+'” in Materials › Smart materials.');});}
function smMaskSave(n){if(!n||!n.mask)return;smAskName('Save as smart mask',n.name+' mask',name=>{smPut({kind:'smask',name,mask:smSerMask(n.mask)});toast('Saved “'+name+'” in Materials › Smart masks.');});}
function smPut(o){const old=matLib.list.find(r=>r.kind===o.kind&&r.name===o.name),rec=Object.assign({id:old?old.id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),t:old?old.t:Date.now()},o);
  if(old)matLib.list[matLib.list.indexOf(old)]=rec;else matLib.list.push(rec);store.put(rec,'materials');renderMats();}

/* ---- the built-ins: materials and generators only ---- */
const SM_F=(name,maps,o)=>Object.assign({t:'L',name,fill:{maps:Object.fromEntries(Object.entries(maps).map(([k,v])=>[k,Object.assign({on:true,src:'value'},v)])),proj:'uv',triSharp:4,hStr:1}},o||{});
const SM_M=(...rows)=>({en:true,rows:rows.map(([kind,p,mode,op])=>({kind,on:true,mode:mode||'normal',op:op==null?1:op,p:Object.assign(MS_KINDS[kind].p?MS_KINDS[kind].p():{},p||{})}))});
const SM_GEN=(g,amount,width,breakup,extra)=>['gen',Object.assign({g,amount,width,breakup,contrast:1.5,scale:6,seed:3,inv:false},extra||{})];
const SM_NOISE=(type,scale,contrast,level,mode,op,extra)=>['noise',Object.assign({type,scale,contrast,level,seed:5,inv:false},extra||{}),mode,op];
const SM_FILL=v=>['fill',{v}];
const SM_BUILTIN=[
  ['Gun Metal',[SM_F('Gun metal',{base:{c:[.26,.27,.29]},rough:{v:.4},metal:{v:1}}),
    SM_F('Worn edges',{base:{c:[.62,.63,.64]},rough:{v:.22},metal:{v:1}},{mask:SM_M(SM_GEN('edge',.5,.45,.55),SM_NOISE('grunge',8,2,.1,'multiply',.7))}),
    SM_F('Grime',{base:{c:[.12,.11,.1]},rough:{v:.85},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.45,.5,.5)),op:.8})]],
  ['Steel',[SM_F('Steel',{base:{c:[.56,.57,.58]},rough:{v:.32},metal:{v:1}}),
    SM_F('Polished edges',{rough:{v:.15}},{mask:SM_M(SM_GEN('edge',.45,.4,.4))}),
    SM_F('Rough patches',{rough:{v:.55}},{mask:SM_M(SM_NOISE('clouds',3,2.5,-.1)),op:.6})]],
  ['Moss',[SM_F('Stone',{base:{c:[.47,.46,.43]},rough:{v:.82},metal:{v:0},height:{v:.5}}),
    SM_F('Stone grain',{height:{v:.62}},{mask:SM_M(SM_NOISE('grunge',10,2,0))}),
    SM_F('Moss',{base:{c:[.24,.38,.1]},rough:{v:.95},metal:{v:0},height:{v:.6}},{mask:SM_M(SM_GEN('moss',.5,.6,.6))})]],
  ['Dirt',[SM_F('Dirt',{base:{c:[.28,.21,.14]},rough:{v:.95},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.5,.6,.55),SM_NOISE('grunge',7,2,.15,'multiply',.8))})]],
  ['Dust',[SM_F('Dust',{base:{c:[.68,.64,.56]},rough:{v:.92},metal:{v:0}},{mask:SM_M(SM_GEN('dust',.5,.5,.5),SM_NOISE('clouds',6,1.5,.1,'multiply',.7))})]],
  ['Imperfections',[SM_F('Rough smudges',{rough:{v:.7}},{mask:SM_M(SM_NOISE('clouds',4,2,-.15)),op:.5}),
    SM_F('Fine scratches',{rough:{v:.2}},{mask:SM_M(SM_NOISE('scratches',3,2,0)),op:.7}),
    SM_F('Fingerprints',{rough:{v:.55}},{mask:SM_M(SM_NOISE('cells',12,2,-.2)),op:.35})]],
  ['Skin',[SM_F('Skin',{base:{c:[.82,.58,.47]},rough:{v:.52},metal:{v:0},height:{v:.5}}),
    SM_F('Redness',{base:{c:[.78,.4,.36]}},{mask:SM_M(SM_GEN('dirt',.45,.55,.6)),op:.55}),
    SM_F('Pores',{height:{v:.42},rough:{v:.6}},{mask:SM_M(SM_NOISE('dots',40,2,-.1)),op:.8}),
    SM_F('Blotches',{base:{c:[.72,.5,.42]}},{mask:SM_M(SM_NOISE('clouds',5,2,-.1)),op:.4})]],
  ['Wood',[SM_F('Wood',{base:{c:[.5,.32,.17]},rough:{v:.62},metal:{v:0},height:{v:.5}}),
    SM_F('Grain',{base:{c:[.34,.2,.1]},height:{v:.44}},{mask:SM_M(SM_NOISE('fibres',4,2.5,0)),op:.85}),
    SM_F('Varnish wear',{rough:{v:.85}},{mask:SM_M(SM_GEN('edge',.45,.5,.6))})]],
  ['Leather',[SM_F('Leather',{base:{c:[.36,.2,.12]},rough:{v:.6},metal:{v:0},height:{v:.5}}),
    SM_F('Grain',{height:{v:.44},rough:{v:.7}},{mask:SM_M(SM_NOISE('cells',30,2,0)),op:.8}),
    SM_F('Worn edges',{base:{c:[.52,.34,.22]},rough:{v:.45}},{mask:SM_M(SM_GEN('edge',.5,.5,.6))})]]];
function smBuiltins(){return SM_BUILTIN.map(([name,kids])=>({id:'sb:'+name,kind:'smart',builtin:true,name,tree:{t:'G',name,open:true,kids:kids.slice()}}));}
const SMASK_BUILTIN=[['Worn edges',SM_M(SM_GEN('edge',.5,.5,.55),SM_NOISE('grunge',8,2,.1,'multiply',.7))],['Dirty cavities',SM_M(SM_GEN('dirt',.5,.55,.5),SM_NOISE('clouds',6,1.5,.1,'multiply',.7))],
  ['Dusty top',SM_M(SM_GEN('dust',.5,.5,.5),SM_NOISE('clouds',5,1.5,.1,'multiply',.7))],['Scratched',SM_M(SM_NOISE('scratches',3,2,0))],['Chipped paint',SM_M(SM_GEN('chips',.5,.5,.5))]];
function smaskBuiltins(){return SMASK_BUILTIN.map(([name,mask])=>({id:'mb:'+name,kind:'smask',builtin:true,name,mask}));}

/* ---- a small picture for the tiles: the bottom material as a ball, the layers above painted on where their
   generators would put them (edges at the rim, cavities low, dust on top, patterns as noise) ---- */
function smPreviewEl(rec,S){S=S||56;if(rec.thumb){const i=el('img',{class:'matprev',src:rec.thumb,width:S,height:S,alt:''});return i;}
  const kids=rec.tree?rec.tree.kids:[],base=kids.find(k=>k.fill&&k.fill.maps.base)||kids[0],cv2=el('canvas',{class:'matprev',width:S,height:S,'aria-hidden':'true'});
  const bf=base&&base.fill?Object.assign({maps:{}},base.fill):{maps:{base:{on:true,c:[.6,.6,.6]}}},pv=matPreviewEl(()=>bf,()=>({}),S),x=cv2.getContext('2d');x.drawImage(pv.el,0,0);
  const id=x.getImageData(0,0,S,S),D=id.data,h=(a,b)=>{const s=Math.sin(a*12.9898+b*78.233)*43758.5453;return s-Math.floor(s);},vn=(u,v)=>{const i=Math.floor(u),j=Math.floor(v),f=u-i,g=v-j;return (h(i,j)*(1-f)+h(i+1,j)*f)*(1-g)+(h(i,j+1)*(1-f)+h(i+1,j+1)*f)*g;};
  for(const k of kids){if(k===base||!k.fill||!k.fill.maps.base||!k.mask)continue;const c=k.fill.maps.base.c||[.5,.5,.5],row=(k.mask.rows||[]).find(r=>r.kind==='gen'||r.kind==='noise'),op=k.op==null?1:k.op;
    for(let y=0;y<S;y++)for(let x0=0;x0<S;x0++){const nx=(x0+.5)/S*2-1,ny=1-(y+.5)/S*2,rr=nx*nx+ny*ny;if(rr>1)continue;const nz=Math.sqrt(1-rr),n=vn(x0/5,y/5);let m=0;
      if(row&&row.kind==='gen'){const g=row.p.g;m=g==='edge'||g==='chips'?(1-nz)*1.6+(n-.5):g==='dust'||g==='snow'||g==='moss'?ny*1.4+(n-.5)*.8:(nz*.6+ny*-.6)+(n-.5)}else m=n*1.3-.2;
      m=clamp((m-.5)*3+.5,0,1)*op;const p=(y*S+x0)*4;for(let j=0;j<3;j++)D[p+j]=D[p+j]*(1-m)+Math.pow(c[j],1/2.2)*255*m;}}
  x.putImageData(id,0,0);return cv2;}
function smaskPreviewEl(rec,S){S=S||56;const cv2=el('canvas',{class:'matprev',width:S,height:S,'aria-hidden':'true'}),x=cv2.getContext('2d'),id=x.createImageData(S,S),D=id.data;
  const rows=rec.mask.rows||[],g=(rows.find(r=>r.kind==='gen')||{p:{}}).p.g;
  for(let y=0;y<S;y++)for(let x0=0;x0<S;x0++){const nx=(x0+.5)/S*2-1,ny=1-(y+.5)/S*2,rr=nx*nx+ny*ny,p=(y*S+x0)*4;if(rr>1){D[p+3]=0;continue;}const nz=Math.sqrt(1-rr),n=Math.abs(Math.sin(x0*1.7+y*.9)*Math.cos(y*1.3-x0*.4));
    let m=g==='edge'||g==='chips'?(1-nz)*1.7+(n-.5)*.6:g==='dust'?ny*1.4+(n-.5)*.5:g==='dirt'?(-ny*.5+.5)*.9+(n-.5)*.6:n;m=clamp((m-.5)*3+.5,0,1);D[p]=D[p+1]=D[p+2]=40+m*200;D[p+3]=255;}
  x.putImageData(id,0,0);return cv2;}

/* .gmat for smart ones: every picture ({w,h,data}) as a PNG, and back */
async function smImgsOut(o){if(!o||typeof o!=='object')return o;if(o.data&&o.w&&o.h){const c=document.createElement('canvas');c.width=o.w;c.height=o.h;const x=c.getContext('2d'),id=x.createImageData(o.w,o.h),d=o.data;
    for(let i=0;i<d.length;i+=4){const a=d[i+3]||1;id.data[i]=Math.min(255,d[i]*255/a);id.data[i+1]=Math.min(255,d[i+1]*255/a);id.data[i+2]=Math.min(255,d[i+2]*255/a);id.data[i+3]=d[i+3];}x.putImageData(id,0,0);return {w:o.w,h:o.h,png:c.toDataURL('image/png')};}
  if(Array.isArray(o)){const a=[];for(const v of o)a.push(await smImgsOut(v));return a;}const r={};for(const k in o)r[k]=await smImgsOut(o[k]);return r;}
async function smImgsIn(o){if(!o||typeof o!=='object')return o;if(o.png&&o.w&&o.h){const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('bad image'));i.src=o.png;});
    const c=document.createElement('canvas');c.width=o.w;c.height=o.h;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,o.w,o.h).data,out=new Uint8Array(d.length);
    for(let i=0;i<d.length;i+=4){const a=d[i+3];out[i]=d[i]*a/255;out[i+1]=d[i+1]*a/255;out[i+2]=d[i+2]*a/255;out[i+3]=a;}return {w:o.w,h:o.h,data:out};}
  if(Array.isArray(o)){const a=[];for(const v of o)a.push(await smImgsIn(v));return a;}const r={};for(const k in o)r[k]=await smImgsIn(o[k]);return r;}
