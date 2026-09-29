/* ================= Baker: shared pieces =================
   Settings, model loading and alignment. The Bake tab (bake-tab.js) runs bakes and shows them.
   Results sent to the document arrive as new layers: normal into the Normal map, height into
   Height, AO into Ambient occlusion; curvature, thickness, world-space normal, position and ID
   go into a hidden "Baked maps" group in base colour, ready to use as masks. */
const bakeCfg={low:null,high:null,cage:null,match:false,average:true,front:2.5,back:2.5,kinds:{normal:true,ao:true,curv:true,height:false,thick:false,wnormal:false,position:false,id:false},
  rays:64,aoDist:25,thickDist:50,ss:2,pad:16,autoSend:false,replace:true,
  aoSpread:1,thickRays:32,curvSrc:'mesh',curvRadius:3,curvStr:1,curvEdges:1,curvCreases:1,curvFlip:false,curvParts:true,sendAs:'layers',tab:'general'};
const BAKE_NAMES={normal:'Normal',ao:'Ambient occlusion',curv:'Curvature',curvEdge:'Curvature edges',curvCrease:'Curvature creases',height:'Height',thick:'Thickness',wnormal:'World-space normal',position:'Position',id:'ID colours'};
/* read a model file (OBJ, glTF, GLB, FBX) */
const MODEL_EXTS=['obj','glb','gltf','fbx'];
const isModelName=n=>MODEL_EXTS.includes(extOf(n));
async function parseModelBytes(name,bytes,sib){const mb=(bytes.byteLength/1048576).toFixed(1),ext=extOf(name);
  const prog=(f,phase)=>{if(phase==='finish')loadBusy('Preparing the model (normals and tangents)…');else loadSet(f,'Building the model from '+name+' · '+Math.round(f*100)+'%');};
  if(ext==='obj'){loadSet(0,'Building the model from '+name+' ('+mb+' MB)…');await loadPaint();return parseOBJAsync(bytes,baseName(name),prog);}
  loadBusy('Building the model from '+name+' ('+mb+' MB)…');await loadPaint();const buf=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);if(ext==='glb'||ext==='gltf')return parseGLTF(buf,baseName(name),sib);
  if(ext==='fbx'){const head=new TextDecoder().decode(bytes.subarray(0,20));if(!head.startsWith('Kaydara FBX Binary'))throw new Error('this FBX is saved as text (ASCII). Export it as binary FBX, OBJ or glTF.');return parseFBX(buf,baseName(name),prog);}
  throw new Error('use an OBJ, glTF, GLB or FBX file.');}
/* dropped File objects (other dropped files serve as a glTF's .bin and textures) */
async function parseModelFile(file,all){const sib=async u=>{const f=(all||[]).find(x=>x.name===u||x.name===u.split('/').pop());if(!f)throw new Error('“'+u+'” was not dropped with the glTF.');return await f.arrayBuffer();};
  return parseModelBytes(file.name,await readFileObj(file),sib);}
async function bakePickModel(){
  if(platform.isDesktop){const p=await platform.openDialog([{name:'3D models',extensions:['obj','glb','gltf','fbx','OBJ','GLB','GLTF','FBX']}]);if(!p)return null;
    loadStart(fileNameOf(p));try{
    const bytes=await platform.readFile(p);
    const dir=p.replace(/[\\/][^\\/]*$/,''),sep=p.includes('\\')?'\\':'/';return await mwTag(await parseModelBytes(fileNameOf(p),bytes,async u=>{const b=await platform.readFile(dir+sep+u);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}),p);}finally{loadEnd();}}
  return new Promise((res,rej)=>{const f=el('input',{type:'file',accept:'.obj,.glb,.gltf,.fbx'});f.onchange=async()=>{const file=f.files[0];if(!file){res(null);return;}loadStart(file.name);try{res(await parseModelFile(file,[...f.files]));}catch(e){rej(e);}finally{loadEnd();}};f.click();});}
/* the model shown in the 3D view, at its own detail (not subdivided) */
function bakeViewModel(){const s=v3s();if(s.model==='imported'&&v3.imported)return v3.imported;return primMesh(PRIMS[s.model]?s.model:'plane',0);}
/* put a model into the low-poly's space */
function bakeAlign(m,low){const s=m.xf.s,c=m.xf.ctr,ls=low.xf.s,lc=low.xf.ctr,pos=new Float32Array(m.pos.length);
  for(let i=0;i<pos.length;i+=3)for(let k=0;k<3;k++)pos[i+k]=(m.pos[i+k]/s+c[k]-lc[k])*ls;return Object.assign({},m,{pos});}
const partBase=n=>String(n||'').replace(/[_\-\s.]*(low|high|lo|hi|lp|hp)(poly)?$/i,'').toLowerCase();
