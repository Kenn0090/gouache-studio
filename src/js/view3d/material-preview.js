/* User-provided UV mesh, loaded once only when the material preview is selected. */
const studioPreview={mesh:null,pending:null};
async function studioPreviewBytes(name){const tag=document.getElementById('studio_'+name.replace(/[^a-z0-9]/gi,'_'));
  if(tag){const s=atob(tag.textContent.trim()),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;}
  const r=await fetch('studio/'+name);if(!r.ok)throw new Error('Preview file unavailable: '+name);return new Uint8Array(await r.arrayBuffer());}
function studioPreviewLoad(){if(studioPreview.mesh)return Promise.resolve(studioPreview.mesh);if(studioPreview.pending)return studioPreview.pending;
  studioPreview.pending=(async()=>{const b=await studioPreviewBytes('material-preview.obj.gz'),data=await streamThrough(b,'gzip',true),m=parseOBJ(new TextDecoder().decode(data),'Material preview');studioPreview.mesh=m;
    if(v3.on&&v3s().model==='matpreview'){v3LoadModel();Object.assign(v3.cam,{yaw:.62,pitch:.36});v3Frame();v3.dirty=true;requestRender();if(ui.mode==='p3d')buildP3Panel();}return m;})().catch(e=>{studioPreview.pending=null;toast('Could not load the material preview: '+e.message);return null;});return studioPreview.pending;}
PRIMS.matpreview=['Material preview',()=>{const m=studioPreview.mesh;if(!m){studioPreviewLoad();return PRIMS.rcube[1](0);}return {pos:m.pos.slice(),nrm:m.nrm.slice(),uv:m.uv.slice(),idx:m.idx.slice(),triMat:m.triMat?.slice(),matNames:m.matNames?.slice(),triPart:m.triPart?.slice(),partNames:m.partNames?.slice()};}];
async function studioPreviewMaps(){if(ui.mode!=='p3d')return;const root=doc.root,imgs={};try{loadStart('Preview mesh maps');
  const files={};for(const k of ['BC','ORM','N','Curv','H','Thickness'])files[k]=new File([await studioPreviewBytes('preview-'+k+'.png')],'Preview_'+k+'.png',{type:'image/png'});
  const raw=await decodeFile(files.ORM),canvas=document.createElement('canvas');canvas.width=raw.w;canvas.height=raw.h;
  const ctx=canvas.getContext('2d');ctx.drawImage(raw.el,0,0);const packed=ctx.getImageData(0,0,raw.w,raw.h).data;URL.revokeObjectURL(raw.el.src);
  const toTarget=data=>{const t=makeTarget(raw.w,raw.h,8,false);writeRegion(t,0,0,raw.w,raw.h,data);return t;};
  for(const [k,ch] of [['ao',0],['rough',1],['metal',2]]){const data=new Uint8Array(raw.w*raw.h*4);for(let i=0;i<raw.w*raw.h;i++){const v=packed[i*4+ch];data.set([v,v,v,255],i*4);}imgs[k]=toTarget(data);}
  if(doc.root!==root)throw new Error('The document changed during import.');
  for(const [k,file] of [['normal','N'],['curv','Curv'],['height','H'],['thick','Thickness']]){if(doc.root!==root)throw new Error('The document changed during import.');await p3MapImport(k,files[file]);}
  if(doc.root!==root)throw new Error('The document changed during import.');p3MapSet('ao',imgs.ao,'Preview ambient occlusion');delete imgs.ao;
  const im=await decodeFile(files.BC),tex=uploadStraight(im),t=makeTarget(im.w,im.h,8,false);premultInto(t,tex,[0,0],null);gl.deleteTexture(tex);imgs.base=t;if(doc.root!==root)throw new Error('The document changed during import.');
    cmdNewFillLayer({name:'Preview mesh material',proj:'uv',maps:{base:{on:true,src:'image',tile:1},rough:{on:true,src:'image',tile:1},metal:{on:true,src:'image',tile:1},normal:{on:false},height:{on:false}},imgs});
  toast('Preview material and mesh maps attached to this texture set.');
 }catch(e){toast('Could not attach preview maps: '+e.message);}finally{for(const t of Object.values(imgs))disposeTarget(t);loadEnd();}}
