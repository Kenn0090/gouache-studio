/* ================= Baker: shared pieces =================
   Settings, model loading and alignment. The Bake tab (bake-tab.js) runs bakes and shows them.
   Results sent to the document arrive as new layers: normal into the Normal map, height into
   Height, AO into Ambient occlusion; curvature, thickness, world-space normal, position and ID
   go into a hidden "Baked maps" group in base colour, ready to use as masks. */
const bakeCfg={low:null,high:null,cage:null,match:false,average:true,front:2.5,back:2.5,kinds:{normal:true,ao:true,curv:true,height:false,thick:false,wnormal:false,position:false,id:false},
  rays:64,aoDist:25,thickDist:50,ss:2,pad:16,autoSend:false,replace:true};
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
