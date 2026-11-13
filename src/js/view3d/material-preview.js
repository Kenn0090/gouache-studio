/* User-provided UV mesh, loaded once only when the material preview is selected. */
const studioPreview={mesh:null,pending:null};
async function studioPreviewBytes(name){const tag=document.getElementById('studio_'+name.replace(/[^a-z0-9]/gi,'_'));
  if(tag){const s=atob(tag.textContent.trim()),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;}
  const r=await fetch('studio/'+name);if(!r.ok)throw new Error('Preview file unavailable: '+name);return new Uint8Array(await r.arrayBuffer());}
function studioPreviewLoad(){if(studioPreview.mesh)return Promise.resolve(studioPreview.mesh);if(studioPreview.pending)return studioPreview.pending;
  studioPreview.pending=(async()=>{const b=await studioPreviewBytes('material-preview.obj.gz'),data=await streamThrough(b,'gzip',true),m=parseOBJ(new TextDecoder().decode(data),'Material preview');studioPreview.mesh=m;
    if(v3.on&&v3s().model==='matpreview'){v3LoadModel();Object.assign(v3.cam,{yaw:.62,pitch:.36});v3Frame();v3.dirty=true;requestRender();if(ui.mode==='p3d')buildP3Panel();}return m;})().catch(e=>{studioPreview.pending=null;toast('Could not load the material preview: '+e.message);return null;});return studioPreview.pending;}
PRIMS.matpreview=['Material preview',()=>{const m=studioPreview.mesh;if(!m){studioPreviewLoad();return PRIMS.rcube[1](0);}return {pos:m.pos.slice(),nrm:m.nrm.slice(),uv:m.uv.slice(),idx:m.idx.slice(),triMat:m.triMat?.slice(),matNames:m.matNames?.slice(),triPart:m.triPart?.slice(),partNames:m.partNames?.slice(),triIdPart:m.triIdPart?.slice(),idPartNames:m.idPartNames?.slice()};}];
/* (0.97.12, Kenn's updated mesh and bakes) the preview model's own baked maps become the texture set's mesh maps: Normal, Ambient occlusion, Curvature,
   Height, Thickness, Position, World normal and ID. The material on it is a plain grey one. */
async function studioPreviewMaps(){if(ui.mode!=='p3d')return;const root=doc.root;try{loadStart('Preview mesh maps');
  for(const [k,n] of [['normal','N'],['ao','AO'],['curv','Curv'],['height','H'],['thick','Thickness'],['position','Position'],['wnormal','WNormal'],['id','ID']]){
    if(doc.root!==root)throw new Error('The document changed during import.');
    await p3MapImport(k,new File([await studioPreviewBytes('preview-'+n+'.png')],'Preview_'+n+'.png',{type:'image/png'}));}
  if(doc.root!==root)throw new Error('The document changed during import.');
  cmdNewFillLayer({name:'Preview mesh material',maps:{base:{on:true,src:'value',c:[.5,.5,.5]},rough:{on:true,src:'value',v:.5},metal:{on:true,src:'value',v:0},normal:{on:false},height:{on:false}}});
  toast('Preview material and mesh maps attached to this texture set.');
 }catch(e){toast('Could not attach preview maps: '+e.message);}finally{loadEnd();}}
