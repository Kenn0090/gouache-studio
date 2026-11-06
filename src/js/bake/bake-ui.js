/* ================= Baker: shared pieces =================
   Settings, model loading and alignment. The Bake tab (bake-tab.js) runs bakes and shows them.
   Results sent to the document arrive as new layers: normal into the Normal map, height into
   Height, AO into Ambient occlusion; curvature, thickness, world-space normal, position and ID
   go into a hidden "Baked maps" group in base colour, ready to use as masks. */
const bakeCfg={low:null,high:null,cage:null,match:false,average:true,front:2.5,back:2.5,kinds:{normal:true,ao:true,curv:true,height:false,thick:false,wnormal:false,position:false,id:false,light:false},
  rays:64,aoDist:25,thickDist:50,ss:4,pad:16,autoSend:false,replace:true,
  aoSpread:1,thickRays:32,curvSrc:'mesh',curvRadius:3,curvStr:1,curvEdges:1,curvCreases:1,curvFlip:false,curvParts:true,sendAs:'layers',tab:'general'};
const BAKE_NAMES={normal:'Normal',ao:'Ambient occlusion',curv:'Curvature',curvEdge:'Curvature edges',curvCrease:'Curvature creases',height:'Height',thick:'Thickness',wnormal:'World-space normal',position:'Position',id:'ID colours',light:'Lighting'};
/* read a model file (OBJ, glTF, GLB, FBX) */
const MODEL_EXTS=['obj','glb','gltf','fbx'];
const isModelName=n=>MODEL_EXTS.includes(extOf(n));
/* (0.94.9, Kenn) a model saved by ZBrush: its polygroups arrive as groups/materials, so 3D Paint offers to ignore them */
function zbTag(m,bytes){try{const n=Math.min(bytes.length,65536);m.fromZBrush=/zbrush/i.test(new TextDecoder('latin1').decode(bytes.subarray(0,n)))||/zbrush/i.test(new TextDecoder('latin1').decode(bytes.subarray(Math.max(0,bytes.length-65536))));}catch(e){}return m;}
async function parseModelBytes(name,bytes,sib,options={}){const m=zbTag(await parseModelBytes0(name,bytes,sib,options),bytes);if(m&&/\.(glb|gltf)$/i.test(name))m.fileUp='y';return options.noUp||typeof upApply!=='function'?m:upApply(m,options.up);}
async function parseModelBytes0(name,bytes,sib,options={}){modelCancelCheck();const ext=extOf(name),mb=(bytes.byteLength/1048576).toFixed(1);
  if(!MODEL_EXTS.includes(ext))throw new Error('use an OBJ, glTF, GLB or FBX file.');
  loadBusy('Building the model from '+name+' ('+mb+' MB)…');await loadPaint();modelCancelCheck();
  const funcs=[grow,mergeParts,meshFinish,smoothNormals,tangentsOf,idColor,objReader,parseOBJAsync,parseGLTF,fbxTextNodes,parseFBX,partsInfo,matsInfo,matCompact,streamThrough];
  const code=funcs.map(f=>f.toString()).join('\n')+`\nconst loadPaint=()=>new Promise(r=>setTimeout(r,0));let requests=new Map(),next=0;
    onmessage=async e=>{const d=e.data;if(d.reply){const r=requests.get(d.reply);if(r){requests.delete(d.reply);d.error?r.reject(new Error(d.error)):r.resolve(d.data);}return;}
      try{const progress=(f,phase)=>postMessage({progress:f,phase});const sibling=u=>new Promise((resolve,reject)=>{const id=++next;requests.set(id,{resolve,reject});postMessage({sibling:u,id});});
        const m=d.ext==='obj'?await parseOBJAsync(new Uint8Array(d.buf),d.name,progress):d.ext==='fbx'?await parseFBX(d.buf,d.name,progress,d.options):await parseGLTF(d.buf,d.name,sibling);postMessage({mesh:m});
      }catch(err){postMessage({error:err.message||String(err)});}};`;
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);
  return new Promise((resolve,reject)=>{let finished=false;const cleanup=()=>{worker.terminate();if(modelCancel)modelCancel.stop=null;};
    const fail=err=>{if(finished)return;finished=true;cleanup();reject(err);};
    if(modelCancel)modelCancel.stop=()=>fail(new Error('Import cancelled.'));
    worker.onerror=e=>fail(new Error(e.message||'Could not read this model.'));
    worker.onmessage=async e=>{const d=e.data;if(d.sibling){try{const data=await sib(d.sibling);if(!finished)worker.postMessage({reply:d.id,data},[data]);}catch(err){if(!finished)worker.postMessage({reply:d.id,error:err.message||String(err)});}return;}
      if(d.error){fail(new Error(d.error));return;}if(d.mesh){if(finished)return;finished=true;cleanup();resolve(d.mesh);return;}
      if(d.phase==='finish')loadBusy('Preparing the model (normals and tangents)…');else if(typeof d.progress==='number')loadSet(d.progress,'Building the model from '+name+' · '+Math.round(d.progress*100)+'%');};
    const buf=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);worker.postMessage({buf,ext,name:baseName(name),options},[buf]);});}
/* dropped File objects (other dropped files serve as a glTF's .bin and textures) */
async function parseModelFile(file,all,options={}){const sib=async u=>{const f=(all||[]).find(x=>x.name===u||x.name===u.split('/').pop());if(!f)throw new Error('“'+u+'” was not dropped with the glTF.');return await f.arrayBuffer();};
  return parseModelBytes(file.name,await readFileObj(file),sib,options);}
/* options.uv: check the UVs of the picked model (the low-poly); options.uv==='quiet': only read them, the window asks later */
async function bakePickModel(options={}){const m=await bakePickModelRaw(options);if(m&&options.uv===true&&typeof uvImportCheck==='function')return await uvImportCheck(m);if(m&&options.uv==='quiet'&&typeof uvAn==='function')uvAn(m);return m;}
async function bakePickModelRaw(options={}){
  if(platform.isDesktop){const p=await platform.openDialog([{name:'3D models',extensions:['obj','glb','gltf','fbx','OBJ','GLB','GLTF','FBX']}]);if(!p)return null;
    loadModelStart(fileNameOf(p));try{
    const bytes=await platform.readFile(p);
    const dir=p.replace(/[\\/][^\\/]*$/,''),sep=p.includes('\\')?'\\':'/';return await mwTag(await parseModelBytes(fileNameOf(p),bytes,async u=>{const b=await platform.readFile(dir+sep+u);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);},options),p);}finally{loadEnd();}}
  return new Promise((res,rej)=>{const f=el('input',{type:'file',accept:'.obj,.glb,.gltf,.fbx'});f.onchange=async()=>{const file=f.files[0];if(!file){res(null);return;}loadModelStart(file.name);try{res(await parseModelFile(file,[...f.files],options));}catch(e){rej(e);}finally{loadEnd();}};f.click();});}
/* the model shown in the 3D view, at its own detail (not subdivided) */
function bakeViewModel(){const s=v3s();if(s.model==='imported'&&v3.imported)return v3.imported;return primMesh(PRIMS[s.model]?s.model:'plane',0);}
/* put a model into the low-poly's space */
function bakeAlign(m,low){const s=m.xf.s,c=m.xf.ctr,ls=low.xf.s,lc=low.xf.ctr,pos=new Float32Array(m.pos.length);
  for(let i=0;i<pos.length;i+=3)for(let k=0;k<3;k++)pos[i+k]=(m.pos[i+k]/s+c[k]-lc[k])*ls;return Object.assign({},m,{pos});}
const partBase=n=>String(n||'').replace(/[_\-\s.]*(low|high|lo|hi|lp|hp)(poly)?$/i,'').toLowerCase();

