/* ================= Meshes for the 3D view =================
   A mesh is plain arrays: pos (xyz), nrm (xyz), uv (uv, v = 0 at the top of the image), idx
   (triangles). Tangents are worked out here so normal maps shade correctly. */
function meshFinish(m,name){const n=m.pos.length/3;
  if(!m.nrm||m.nrm.length!==n*3)m.nrm=smoothNormals(m.pos,m.idx);
  if(!m.uv||m.uv.length!==n*2)m.uv=new Float32Array(n*2);
  m.tan=tangentsOf(m.pos,m.nrm,m.uv,m.idx);
  /* centre on the origin and scale to about 2 units across */
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<n;i++)for(let c=0;c<3;c++){const v=m.pos[i*3+c];if(v<mn[c])mn[c]=v;if(v>mx[c])mx[c]=v;}
  const ctr=[0,1,2].map(c=>(mn[c]+mx[c])/2),size=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])||1,s=2/size;
  for(let i=0;i<n;i++)for(let c=0;c<3;c++)m.pos[i*3+c]=(m.pos[i*3+c]-ctr[c])*s;
  m.radius=0;for(let i=0;i<n;i++)m.radius=Math.max(m.radius,Math.hypot(m.pos[i*3],m.pos[i*3+1],m.pos[i*3+2]));
  /* how to get back to the file's own coordinates (the baker lines up low and high poly with it) */
  m.xf={ctr,s};
  m.name=name;m.tris=m.idx.length/3;m.verts=n;return m;}
function smoothNormals(pos,idx){const n=new Float32Array(pos.length);
  for(let t=0;t<idx.length;t+=3){const a=idx[t]*3,b=idx[t+1]*3,c=idx[t+2]*3;
    const ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2],vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const k of [a,b,c]){n[k]+=nx;n[k+1]+=ny;n[k+2]+=nz;}}
  for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2])||1;n[i]/=l;n[i+1]/=l;n[i+2]/=l;}return n;}
/* per-vertex tangent (xyz) and handedness (w) from the UV layout */
function tangentsOf(pos,nrm,uv,idx){const n=pos.length/3,T=new Float32Array(n*3),B=new Float32Array(n*3),out=new Float32Array(n*4);
  for(let t=0;t<idx.length;t+=3){const i0=idx[t],i1=idx[t+1],i2=idx[t+2];
    const e1=[pos[i1*3]-pos[i0*3],pos[i1*3+1]-pos[i0*3+1],pos[i1*3+2]-pos[i0*3+2]],e2=[pos[i2*3]-pos[i0*3],pos[i2*3+1]-pos[i0*3+1],pos[i2*3+2]-pos[i0*3+2]];
    /* v grows downwards in our UVs; tangent space wants it growing upwards */
    const du1=uv[i1*2]-uv[i0*2],dv1=-(uv[i1*2+1]-uv[i0*2+1]),du2=uv[i2*2]-uv[i0*2],dv2=-(uv[i2*2+1]-uv[i0*2+1]);
    const r=du1*dv2-du2*dv1;if(Math.abs(r)<1e-12)continue;const f=1/r;
    const tx=(e1[0]*dv2-e2[0]*dv1)*f,ty=(e1[1]*dv2-e2[1]*dv1)*f,tz=(e1[2]*dv2-e2[2]*dv1)*f;
    const bx=(e2[0]*du1-e1[0]*du2)*f,by=(e2[1]*du1-e1[1]*du2)*f,bz=(e2[2]*du1-e1[2]*du2)*f;
    for(const i of [i0,i1,i2]){T[i*3]+=tx;T[i*3+1]+=ty;T[i*3+2]+=tz;B[i*3]+=bx;B[i*3+1]+=by;B[i*3+2]+=bz;}}
  for(let i=0;i<n;i++){const nx=nrm[i*3],ny=nrm[i*3+1],nz=nrm[i*3+2];let tx=T[i*3],ty=T[i*3+1],tz=T[i*3+2];const d=nx*tx+ny*ty+nz*tz;tx-=nx*d;ty-=ny*d;tz-=nz*d;
    let l=Math.hypot(tx,ty,tz);if(l<1e-8){const a=Math.abs(nx)<.9?[1,0,0]:[0,1,0];tx=a[1]*nz-a[2]*ny;ty=a[2]*nx-a[0]*nz;tz=a[0]*ny-a[1]*nx;l=Math.hypot(tx,ty,tz)||1;}
    tx/=l;ty/=l;tz/=l;const cx=ny*tz-nz*ty,cy=nz*tx-nx*tz,cz=nx*ty-ny*tx,w=(cx*B[i*3]+cy*B[i*3+1]+cz*B[i*3+2])<0?-1:1;
    out[i*4]=tx;out[i*4+1]=ty;out[i*4+2]=tz;out[i*4+3]=w;}
  return out;}
/* unique edges, for the wireframe and the UV overlay */
function meshEdges(m){const I=m.idx,T=I.length/3;
  /* very big meshes: every triangle's edges (a few doubled), without the memory of finding duplicates */
  if(T>1.5e6){const e=new Uint32Array(T*6);for(let t=0;t<T;t++){const a=I[t*3],b=I[t*3+1],c=I[t*3+2];e.set([a,b,b,c,c,a],t*6);}return e;}
  const seen=new Set(),e=grow(Uint32Array,T*3);const k=(a,b)=>a<b?a*4294967296+b:b*4294967296+a;
  for(let t=0;t<I.length;t+=3){const a=I[t],b=I[t+1],c=I[t+2];let h=k(a,b);if(!seen.has(h)){seen.add(h);e.p2(a,b);}h=k(b,c);if(!seen.has(h)){seen.add(h);e.p2(b,c);}h=k(c,a);if(!seen.has(h)){seen.add(h);e.p2(c,a);}}
  return e.out();}

/* ---- built-in shapes ---- */
function gridBuild(nu,nv,fn){const pos=[],nrm=[],uv=[],idx=[];
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu,v=j/nv,r=fn(u,v);pos.push(...r.p);nrm.push(...r.n);uv.push(u,v);}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;idx.push(a,c,b,b,c,d);}
  return {pos,nrm,uv,idx};}
/* growable typed arrays: big models stay compact in memory (plain arrays take several times more) */
function grow(T,n){return {a:new T(n||4096),n:0,T,need(k){if(this.n+k>this.a.length){const b=new this.T(Math.max(this.a.length*2,this.n+k));b.set(this.a.subarray(0,this.n));this.a=b;}},
  p1(x){this.need(1);this.a[this.n++]=x;},p2(x,y){this.need(2);const a=this.a,n=this.n;a[n]=x;a[n+1]=y;this.n=n+2;},p3(x,y,z){this.need(3);const a=this.a,n=this.n;a[n]=x;a[n+1]=y;a[n+2]=z;this.n=n+3;},
  out(){return this.a.length===this.n?this.a:this.a.slice(0,this.n);}};}
function mergeParts(parts){let np=0,ni=0;for(const p of parts){np+=p.pos.length;ni+=p.idx.length;}
  const pos=new Float32Array(np),nrm=new Float32Array(np),uv=new Float32Array(np/3*2),idx=new Uint32Array(ni);let o=0,oi=0;
  for(const p of parts){pos.set(p.pos,o);nrm.set(p.nrm,o);uv.set(p.uv,o/3*2);const base=o/3;for(let i=0;i<p.idx.length;i++)idx[oi+i]=p.idx[i]+base;o+=p.pos.length;oi+=p.idx.length;}
  return {pos,nrm,uv,idx};}
/* detail 0..7: how many triangles the shapes get (more for testing height displacement) */
const DETAIL=[1,2,4,8,16,32,64,128],RDETAIL=[1,1.5,2,3,4,6,8,11];
function primPlane(d){const seg=Math.min(1024,8*DETAIL[d]*(d?1:.125)),a=doc.w/doc.h,w=a>=1?1:a,h=a>=1?1/a:1;
  return mergeParts([gridBuild(seg,seg,(u,v)=>({p:[(u*2-1)*w,(1-v*2)*h,0],n:[0,0,1]}))]);}
/* six faces, each with the whole texture; round>0 rounds the edges */
function primCube(round,d){const N=Math.min(400,Math.max(round?16:1,Math.round(4*DETAIL[d]*(d?1:.25)))),faces=[[[1,0,0],[0,0,-1],[0,-1,0]],[[-1,0,0],[0,0,1],[0,-1,0]],[[0,1,0],[1,0,0],[0,0,1]],[[0,-1,0],[1,0,0],[0,0,-1]],[[0,0,1],[1,0,0],[0,-1,0]],[[0,0,-1],[-1,0,0],[0,-1,0]]];
  return mergeParts(faces.map(([n,U,V])=>gridBuild(N,N,(u,v)=>{let p=[0,1,2].map(c=>n[c]+U[c]*(u*2-1)+V[c]*(v*2-1)),nn=n;
    if(round){const r=round,q=p.map(x=>clamp(x,-1+r,1-r)),dd=p.map((x,c)=>x-q[c]),l=Math.hypot(...dd)||1;nn=dd.map(x=>x/l);p=q.map((x,c)=>x+nn[c]*r);}
    return {p,n:nn};})));}
function primSphere(d){const k=RDETAIL[d];return mergeParts([gridBuild(Math.round(96*k),Math.round(48*k),(u,v)=>{const th=u*Math.PI*2,ph=v*Math.PI,x=-Math.sin(ph)*Math.sin(th),y=Math.cos(ph),z=Math.sin(ph)*Math.cos(th);return {p:[x,y,z],n:[x,y,z]};})]);}
function primCylinder(d){const k=RDETAIL[d],R=Math.round(64*k),side=gridBuild(R,Math.max(1,Math.round(2*DETAIL[d]*(d?4:.5))),(u,v)=>{const th=u*Math.PI*2,x=-Math.sin(th),z=Math.cos(th);return {p:[x,1-v*2,z],n:[x,0,z]};});
  const cap=(y,s)=>{const pos=[0,y,0],nrm=[0,s,0],uv=[.5,.5],idx=[];for(let i=0;i<=R;i++){const th=i/R*Math.PI*2,x=-Math.sin(th),z=Math.cos(th);pos.push(x,y,z);nrm.push(0,s,0);uv.push(.5+x*.5,.5+z*.5*s);}
    for(let i=1;i<=R;i++)s>0?idx.push(0,i+1,i):idx.push(0,i,i+1);return {pos,nrm,uv,idx};};
  return mergeParts([side,cap(1,1),cap(-1,-1)]);}
const PRIMS={plane:['Plane',d=>primPlane(d)],cube:['Cube',d=>primCube(0,d)],rcube:['Rounded cube',d=>primCube(.18,d)],sphere:['Sphere',primSphere],cylinder:['Cylinder',primCylinder]};
function primMesh(k,d){const [label,fn]=PRIMS[k]||PRIMS.plane;return meshFinish(fn(d||0),label);}
/* split every triangle into four, d times (for imported models), up to about two million triangles */
function subdivideMesh(m,d){let cur=m;for(let l=0;l<d;l++){if(cur.idx.length/3*4>2e6)break;
    const pos=Array.from(cur.pos),nrm=Array.from(cur.nrm),uv=Array.from(cur.uv),idx=[],mid=new Map();
    const M=(a,b)=>{const k=a<b?a*4294967296+b:b*4294967296+a;let r=mid.get(k);if(r!==undefined)return r;r=pos.length/3;
      for(let c=0;c<3;c++){pos.push((pos[a*3+c]+pos[b*3+c])/2);nrm.push((nrm[a*3+c]+nrm[b*3+c])/2);}uv.push((uv[a*2]+uv[b*2])/2,(uv[a*2+1]+uv[b*2+1])/2);mid.set(k,r);return r;};
    for(let t=0;t<cur.idx.length;t+=3){const a=cur.idx[t],b=cur.idx[t+1],c=cur.idx[t+2],ab=M(a,b),bc=M(b,c),ca=M(c,a);idx.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}
    for(let i=0;i<nrm.length;i+=3){const l=Math.hypot(nrm[i],nrm[i+1],nrm[i+2])||1;nrm[i]/=l;nrm[i+1]/=l;nrm[i+2]/=l;}
    cur={pos:new Float32Array(pos),nrm:new Float32Array(nrm),uv:new Float32Array(uv),idx:new Uint32Array(idx)};}
  if(cur===m)return m;const r=meshFinish(cur,m.name);r.noUV=m.noUV;
  /* each triangle became 4^levels triangles in a row: per-triangle data is repeated */
  const f=cur.idx.length/m.idx.length,rep=(a,w)=>{if(!a)return a;const T=a.length/w,o=new a.constructor(a.length*f);for(let t=0;t<T;t++)for(let j=0;j<f;j++)for(let c=0;c<w;c++)o[(t*f+j)*w+c]=a[t*w+c];return o;};
  r.triMat=rep(m.triMat,1);r.matNames=m.matNames;r.triPart=rep(m.triPart,1);r.partNames=m.partNames;r.triCol=rep(m.triCol,3);
  r.src=m;r.subF=f;/* triangle t here came from triangle floor(t/subF) of the model as loaded */return r;}

/* a distinct colour for each part or material (for ID maps) */
function idColor(key){let h=2166136261;for(const c of String(key))h=Math.imul(h^c.charCodeAt(0),16777619);const H=((h>>>0)%360)/360;
  const f=n=>{const k=(n+H*6)%6;return .92-.72*Math.max(0,Math.min(k,4-k,1));};return [f(5),f(3),f(1)];}
/* ---- OBJ ---- */
/* OBJ, read straight from the file's bytes: no giant text string, compact arrays, and it can
   pause between pieces so the loading bar moves (a high-poly OBJ can be hundreds of MB) */
function objReader(name){const P=grow(Float32Array),T=grow(Float32Array),N=grow(Float32Array),pos=grow(Float32Array),uv=grow(Float32Array),nrm=grow(Float32Array),idx=grow(Uint32Array),tc=grow(Float32Array),tp=grow(Uint32Array);
  const tm=grow(Uint32Array),mn=['default'];let mat=0;const vF=grow(Int32Array),vT=grow(Int32Array),vN=grow(Int32Array),alt=new Map(),pn=['default'],dec=new TextDecoder();let hasN=false,hasT=false,grp='default',gc=idColor('default'),part=0,face=[];
  const nameOf=(b,i,e)=>dec.decode(b.subarray(i,e)).trim();
  /* number at b[i..]: returns [value, next index] */
  let ni=0;const num=(b,i,e)=>{while(i<e&&(b[i]===32||b[i]===9))i++;let sg=1;if(b[i]===45){sg=-1;i++;}else if(b[i]===43)i++;let v=0,f=0,d=1,any=false;
    while(i<e&&b[i]>=48&&b[i]<=57){v=v*10+(b[i]-48);i++;any=true;}if(b[i]===46){i++;while(i<e&&b[i]>=48&&b[i]<=57){f=f*10+(b[i]-48);d*=10;i++;any=true;}}v+=f/d;
    if(b[i]===101||b[i]===69){i++;let es=1;if(b[i]===45){es=-1;i++;}else if(b[i]===43)i++;let ex=0;while(i<e&&b[i]>=48&&b[i]<=57){ex=ex*10+(b[i]-48);i++;}v*=Math.pow(10,es*ex);}
    ni=i;return any?sg*v:NaN;};
  const vert=(pi,ti,ki)=>{const nP=P.n/3;while(vF.n<nP){vF.p1(-1);vT.p1(-1);vN.p1(-1);}
    let r=vF.a[pi];if(r>=0){if(vT.a[pi]===ti&&vN.a[pi]===ki)return r;const key=pi+','+ti+','+ki;const q=alt.get(key);if(q!==undefined)return q;}
    pos.p3(P.a[pi*3],P.a[pi*3+1],P.a[pi*3+2]);if(ti>=0){uv.p2(T.a[ti*2],1-T.a[ti*2+1]);hasT=true;}else uv.p2(0,0);
    if(ki>=0){nrm.p3(N.a[ki*3],N.a[ki*3+1],N.a[ki*3+2]);hasN=true;}else nrm.p3(0,0,0);r=pos.n/3-1;
    if(vF.a[pi]<0){vF.a[pi]=r;vT.a[pi]=ti;vN.a[pi]=ki;}else alt.set(pi+','+ti+','+ki,r);return r;};
  const line=(b,i,e)=>{while(i<e&&(b[i]===32||b[i]===9))i++;if(i>=e||b[i]===35)return;const c0=b[i],c1=b[i+1];
    if(c0===118&&(c1===32||c1===9)){const x=num(b,i+2,e),y=num(b,ni,e),z=num(b,ni,e);P.p3(x,y,z);return;}
    if(c0===118&&c1===116){const x=num(b,i+2,e);let y=num(b,ni,e);if(isNaN(y))y=0;T.p2(x,y);return;}
    if(c0===118&&c1===110){const x=num(b,i+2,e),y=num(b,ni,e),z=num(b,ni,e);N.p3(x,y,z);return;}
    if(c0===102&&(c1===32||c1===9)){face.length=0;let k=i+2;const nP=P.n/3,nT=T.n/2,nN=N.n/3;
      while(k<e){while(k<e&&(b[k]===32||b[k]===9||b[k]===13))k++;if(k>=e)break;
        const v=num(b,k,e);k=ni;let t=-1,n=-1;
        if(b[k]===47){k++;if(b[k]!==47){const tv=num(b,k,e);k=ni;if(!isNaN(tv))t=tv<0?nT+tv:tv-1;}if(b[k]===47){k++;const nv=num(b,k,e);k=ni;if(!isNaN(nv))n=nv<0?nN+nv:nv-1;}}
        while(k<e&&b[k]!==32&&b[k]!==9)k++;if(isNaN(v))continue;face.push(vert(v<0?nP+v:v-1,t,n));}
      for(let j=1;j+1<face.length;j++){idx.p3(face[0],face[j],face[j+1]);tc.p3(gc[0],gc[1],gc[2]);tp.p1(part);tm.p1(mat);}return;}
    const w=nameOf(b,i,Math.min(e,i+7)).split(/\s/)[0];
    if(w==='o'||w==='g'||w==='usemtl'){const nm=nameOf(b,i+w.length,e)||'default';if(w==='usemtl'){mat=mn.indexOf(nm);if(mat<0){mat=mn.length;mn.push(nm);}}if(w!=='usemtl'){part=pn.indexOf(nm);if(part<0){part=pn.length;pn.push(nm);}}if(w==='usemtl'||grp==='default'||w==='o'){grp=nm||grp;gc=idColor(grp);}}};
  return {
    /* read b[s..e) line by line; returns where the last complete line ended */
    feed(b,s,e,final){let i=s;for(;;){let j=b.indexOf(10,i);if(j<0||j>=e){if(final&&i<e){line(b,i,e);return e;}return i;}line(b,i,j);i=j+1;}},
    finish(){if(!idx.n)throw new Error('This OBJ file has no faces.');const m={pos:pos.out(),uv:uv.out(),idx:idx.out(),nrm:hasN?nrm.out():null};
      const r=meshFinish(m,name);r.noUV=!hasT;r.triCol=tc.out();r.partNames=pn;r.triPart=tp.out();r.matNames=mn;r.triMat=tm.out();matCompact(r);return r;}};}
function parseOBJ(text,name){const b=typeof text==='string'?new TextEncoder().encode(text):text,R=objReader(name);R.feed(b,0,b.length,true);return R.finish();}
async function parseOBJAsync(b,name,onProgress){const R=objReader(name),CH=8*1024*1024;let i=0;
  while(i<b.length){const e=Math.min(b.length,i+CH),fin=e>=b.length;const j=R.feed(b,i,e,fin);i=j>i?j:e;if(onProgress)onProgress(i/b.length);await new Promise(r=>setTimeout(r,0));}
  if(onProgress)onProgress(1,'finish');await loadPaint();return R.finish();}

/* ---- glTF 2.0 (.glb, or .gltf with embedded data) ---- */
async function parseGLTF(buf,name,readSibling){let json,bin=null;const u8=new Uint8Array(buf);
  if(u8[0]===0x67&&u8[1]===0x6c&&u8[2]===0x54&&u8[3]===0x46){const dv=new DataView(buf);let o=12;
    while(o<buf.byteLength){const len=dv.getUint32(o,true),type=dv.getUint32(o+4,true);const chunk=buf.slice(o+8,o+8+len);
      if(type===0x4E4F534A)json=JSON.parse(new TextDecoder().decode(chunk));else if(type===0x004E4942)bin=chunk;o+=8+len;}}
  else json=JSON.parse(new TextDecoder().decode(u8));
  if((json.extensionsRequired||[]).length)throw new Error('This glTF needs '+json.extensionsRequired.join(', ')+', which is not supported yet (for example Draco compression). Export it without compression.');
  const buffers=[];for(const [i,b] of (json.buffers||[]).entries()){
    if(b.uri===undefined)buffers.push(bin);
    else if(b.uri.startsWith('data:')){const s=atob(b.uri.split(',')[1]);const a=new Uint8Array(s.length);for(let k=0;k<s.length;k++)a[k]=s.charCodeAt(k);buffers.push(a.buffer);}
    else{if(!readSibling)throw new Error('This .gltf keeps its data in a separate file ('+b.uri+'). Use a .glb file instead.');buffers.push(await readSibling(decodeURIComponent(b.uri)));}}
  const CN={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  const acc=i=>{const a=json.accessors[i],bv=json.bufferViews[a.bufferView],C=CN[a.componentType],nc=NC[a.type],B=buffers[bv.buffer];
    const off=(bv.byteOffset||0)+(a.byteOffset||0),stride=bv.byteStride||0,es=C.BYTES_PER_ELEMENT,out=new Float32Array(a.count*nc);
    const norm=a.normalized?(C===Uint8Array?255:C===Uint16Array?65535:C===Int8Array?127:C===Int16Array?32767:1):1;
    if(!stride||stride===nc*es){const src=new C(B,off,a.count*nc);for(let k=0;k<src.length;k++)out[k]=src[k]/norm;}
    else{const dv=new DataView(B);for(let e=0;e<a.count;e++)for(let c=0;c<nc;c++){const p=off+e*stride+c*es;let v=C===Float32Array?dv.getFloat32(p,true):C===Uint16Array?dv.getUint16(p,true):C===Uint8Array?dv.getUint8(p):C===Int16Array?dv.getInt16(p,true):C===Uint32Array?dv.getUint32(p,true):dv.getInt8(p);out[e*nc+c]=v/norm;}}
    return out;};
  const mul=(a,b)=>{const o=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o;};
  const local=n=>{if(n.matrix)return n.matrix;const t=n.translation||[0,0,0],r=n.rotation||[0,0,0,1],s=n.scale||[1,1,1],[x,y,z,w]=r;
    return [(1-2*(y*y+z*z))*s[0],(2*(x*y+z*w))*s[0],(2*(x*z-y*w))*s[0],0,(2*(x*y-z*w))*s[1],(1-2*(x*x+z*z))*s[1],(2*(y*z+x*w))*s[1],0,(2*(x*z+y*w))*s[2],(2*(y*z-x*w))*s[2],(1-2*(x*x+y*y))*s[2],0,t[0],t[1],t[2],1];};
  const parts=[];let noUV=false;
  const visit=(ni,M)=>{const n=json.nodes[ni],W=mul(M,local(n));
    if(n.mesh!==undefined)for(const pr of json.meshes[n.mesh].primitives){if(pr.mode!==undefined&&pr.mode!==4)continue;const at=pr.attributes;if(at.POSITION===undefined)continue;
      const p=acc(at.POSITION),cnt=p.length/3,nr=at.NORMAL!==undefined?acc(at.NORMAL):null,tc=at.TEXCOORD_0!==undefined?acc(at.TEXCOORD_0):null;if(!tc)noUV=true;
      const pos=[],nrm=[];for(let i=0;i<cnt;i++){const x=p[i*3],y=p[i*3+1],z=p[i*3+2];pos.push(W[0]*x+W[4]*y+W[8]*z+W[12],W[1]*x+W[5]*y+W[9]*z+W[13],W[2]*x+W[6]*y+W[10]*z+W[14]);
        if(nr){const a=nr[i*3],b=nr[i*3+1],c=nr[i*3+2];const nx=W[0]*a+W[4]*b+W[8]*c,ny=W[1]*a+W[5]*b+W[9]*c,nz=W[2]*a+W[6]*b+W[10]*c,l=Math.hypot(nx,ny,nz)||1;nrm.push(nx/l,ny/l,nz/l);}}
      const idx=pr.indices!==undefined?Array.from(acc(pr.indices)):Array.from({length:cnt},(_,i)=>i);
      /* ID colour per triangle: vertex colours, else the material colour, else one colour per part */
      const vc=at.COLOR_0!==undefined?acc(at.COLOR_0):null,vn=vc?vc.length/cnt:0,mat=pr.material!==undefined&&json.materials?json.materials[pr.material]:null;
      const fc=mat&&mat.pbrMetallicRoughness&&mat.pbrMetallicRoughness.baseColorFactor?mat.pbrMetallicRoughness.baseColorFactor.slice(0,3):idColor((mat&&mat.name)||(json.meshes[n.mesh].name||'mesh'+n.mesh)+':'+parts.length);
      const tcol=[];for(let t=0;t<idx.length;t+=3){if(vc){for(let c=0;c<3;c++)tcol.push((vc[idx[t]*vn+c]+vc[idx[t+1]*vn+c]+vc[idx[t+2]*vn+c])/3);}else tcol.push(fc[0],fc[1],fc[2]);}
      parts.push({pos,nrm:nr?nrm:null,uv:tc?Array.from(tc):new Array(cnt*2).fill(0),idx,tcol,pname:n.name||json.meshes[n.mesh].name||('mesh'+n.mesh),mname:mat?(mat.name||('Material '+pr.material)):'default'});}
    for(const c of n.children||[])visit(c,W);};
  const scene=json.scenes?json.scenes[json.scene||0]:{nodes:(json.nodes||[]).map((_,i)=>i)};const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  for(const r of scene.nodes)visit(r,I);
  if(!parts.length)throw new Error('No triangle meshes were found in this file.');
  const needN=parts.some(p=>!p.nrm);const m=mergeParts(parts.map(p=>Object.assign({},p,{nrm:p.nrm||new Array(p.pos.length).fill(0)})));if(needN)m.nrm=null;
  const r=meshFinish(m,name);r.noUV=noUV;r.triCol=new Float32Array(parts.flatMap(p=>p.tcol));partsInfo(r,parts);matsInfo(r,parts);return r;}

/* ---- keeping an imported model inside a .gouache file ---- */
function meshPack(m){const n=m.pos.length,u=m.uv.length,x=m.idx.length,T=x/3,hasM=!!m.triMat,hasP=!!m.triPart,js=new TextEncoder().encode(JSON.stringify({matNames:m.matNames||null,partNames:m.partNames||null}));
  const out=new Uint8Array(16+(n*2+u)*4+x*4+(hasM?T*4:0)+(hasP?T*4:0)+4+js.length),dv=new DataView(out.buffer);
  dv.setUint32(0,n,true);dv.setUint32(4,u,true);dv.setUint32(8,x,true);dv.setUint32(12,(hasM?1:0)|(hasP?2:0)|4,true);let o=16;
  for(const a of [m.pos,m.nrm,m.uv]){new Float32Array(out.buffer,o,a.length).set(a);o+=a.length*4;}new Uint32Array(out.buffer,o,x).set(m.idx);o+=x*4;
  /* materials (texture sets) and parts per triangle, and their names */
  if(hasM){new Uint32Array(out.buffer,o,T).set(m.triMat);o+=T*4;}if(hasP){new Uint32Array(out.buffer,o,T).set(m.triPart);o+=T*4;}dv.setUint32(o,js.length,true);out.set(js,o+4);return out;}
function meshUnpack(bytes,name){const b=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),dv=new DataView(b),n=dv.getUint32(0,true),u=dv.getUint32(4,true),x=dv.getUint32(8,true),fl=dv.getUint32(12,true);let o=16;
  const f=len=>{const a=new Float32Array(b.slice(o,o+len*4));o+=len*4;return a;};const pos=f(n),nrm=f(n),uv=f(u),idx=new Uint32Array(b.slice(o,o+x*4));o+=x*4;
  const r=meshFinish({pos,nrm,uv,idx},name),T=x/3;
  if(fl&1){r.triMat=new Uint32Array(b.slice(o,o+T*4));o+=T*4;}if(fl&2){r.triPart=new Uint32Array(b.slice(o,o+T*4));o+=T*4;}
  if(fl&4){const l=dv.getUint32(o,true),j=JSON.parse(new TextDecoder().decode(new Uint8Array(b,o+4,l)));if(j.matNames)r.matNames=j.matNames;if(j.partNames)r.partNames=j.partNames;}
  return r;}

/* ---- FBX (binary, as written by Blender, Maya, 3ds Max, Unity and Unreal) ---- */
async function parseFBX(buf,name,onProgress){const u8=new Uint8Array(buf),dv=new DataView(buf);
  const sig='Kaydara FBX Binary';if(new TextDecoder().decode(u8.subarray(0,18))!==sig){
    if(/FBXHeaderExtension|; FBX/.test(new TextDecoder().decode(u8.subarray(0,400))))throw new Error('This is a text (ASCII) FBX. Export it as binary FBX, glTF or OBJ.');throw new Error('This does not look like an FBX file.');}
  const ver=dv.getUint32(23,true),big=ver>=7500,pending=[];
  const rd=o=>big?Number(dv.getBigUint64(o,true)):dv.getUint32(o,true);
  const arr=(o,C,sz)=>{const len=dv.getUint32(o,true),enc=dv.getUint32(o+4,true),clen=dv.getUint32(o+8,true),start=o+12;const box={v:null};
    if(enc===1)pending.push(streamThrough(u8.subarray(start,start+clen),'deflate',true).then(r=>{box.v=new C(r.buffer.slice(r.byteOffset,r.byteOffset+len*sz));}));
    else box.v=new C(buf.slice(start,start+len*sz));return [box,start+clen];};
  const prop=o=>{const t=String.fromCharCode(u8[o]);o++;
    switch(t){case 'Y':return [dv.getInt16(o,true),o+2];case 'C':return [!!u8[o],o+1];case 'I':return [dv.getInt32(o,true),o+4];case 'F':return [dv.getFloat32(o,true),o+4];
      case 'D':return [dv.getFloat64(o,true),o+8];case 'L':return [String(dv.getBigInt64(o,true)),o+8];
      case 'S':case 'R':{const l=dv.getUint32(o,true);return [t==='S'?new TextDecoder().decode(u8.subarray(o+4,o+4+l)):null,o+4+l];}
      case 'f':return arr(o,Float32Array,4);case 'd':return arr(o,Float64Array,8);case 'i':return arr(o,Int32Array,4);case 'l':return arr(o,BigInt64Array,8);case 'b':return arr(o,Uint8Array,1);
      default:throw new Error('Unknown FBX data type '+t);}};
  const node=o=>{const end=rd(o),np=rd(o+(big?8:4)),hl=big?25:13,nl=u8[o+(big?24:12)];if(end===0)return [null,o+hl];
    const n={name:new TextDecoder().decode(u8.subarray(o+hl,o+hl+nl)),props:[],kids:[]};let p=o+hl+nl;
    for(let i=0;i<np;i++){const [v,q]=prop(p);n.props.push(v);p=q;}
    while(p<end){const [c,q]=node(p);p=q;if(!c)break;n.kids.push(c);}return [n,end];};
  const top=[];let o=27;while(o<u8.length-160){const [n,q]=node(o);if(!n)break;top.push(n);o=q;}
  await Promise.all(pending);
  const val=x=>x&&x.v!==undefined?x.v:x,kid=(n,k)=>n&&n.kids.find(c=>c.name===k),objs=kid({kids:top},'Objects');if(!objs)throw new Error('No objects in this FBX file.');
  const models={},geoms={},parent={},geoOf={};
  const matN={};for(const n of objs.kids)if(n.name==='Material')matN[n.props[0]]=String(n.props[1]||'').split('\u0000')[0]||('Material '+n.props[0]);
  for(const n of objs.kids){const id=n.props[0];if(n.name==='Geometry'&&n.props[2]==='Mesh')geoms[id]=n;else if(n.name==='Model'){const m={t:[0,0,0],r:[0,0,0],s:[1,1,1],pre:[0,0,0]};
      for(const p of (kid(n,'Properties70')||{kids:[]}).kids){const k=p.props[0],v=p.props.slice(4,7);if(k==='Lcl Translation')m.t=v;else if(k==='Lcl Rotation')m.r=v;else if(k==='Lcl Scaling')m.s=v;else if(k==='PreRotation')m.pre=v;}m.name=String(n.props[1]||'').split('\u0000')[0]||('model'+id);m.mats=[];models[id]=m;}}
  for(const c of (kid({kids:top},'Connections')||{kids:[]}).kids){if(c.props[0]!=='OO')continue;const a=c.props[1],b=c.props[2];if(geoms[a]&&models[b])geoOf[a]=b;else if(matN[a]!==undefined&&models[b])models[b].mats.push(matN[a]);else if(models[a])parent[a]=b;}
  const rot=(r)=>{const [x,y,z]=r.map(v=>v*Math.PI/180),cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
    return [cy*cz,cy*sz,-sy,0, sx*sy*cz-cx*sz,sx*sy*sz+cx*cz,sx*cy,0, cx*sy*cz+sx*sz,cx*sy*sz-sx*cz,cx*cy,0, 0,0,0,1];};
  const mul=(a,b)=>{const r=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)r[j*4+i]+=a[k*4+i]*b[j*4+k];return r;};
  const localM=m=>{let M=mul(rot(m.pre),rot(m.r));M=mul(M,[m.s[0],0,0,0,0,m.s[1],0,0,0,0,m.s[2],0,0,0,0,1]);M[12]+=m.t[0];M[13]+=m.t[1];M[14]+=m.t[2];return M;};
  const world=id=>{let M=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],g=0;while(models[id]&&g++<64){M=mul(localM(models[id]),M);id=parent[id];}return M;};
  const layer=(g,k,data,index)=>{const L=kid(g,k);if(!L)return null;const d=val((kid(L,data)||{props:[]}).props[0]);if(!d)return null;
    return {d,idx:val((kid(L,index)||{props:[]}).props[0]),map:(kid(L,'MappingInformationType')||{props:['']}).props[0],ref:(kid(L,'ReferenceInformationType')||{props:['']}).props[0]};};
  const parts=[];let noUV=false;
  for(const [id,g] of Object.entries(geoms)){const V=val((kid(g,'Vertices')||{props:[]}).props[0]),PI=val((kid(g,'PolygonVertexIndex')||{props:[]}).props[0]);if(!V||!PI)continue;
    const N=layer(g,'LayerElementNormal','Normals','NormalsIndex'),U=layer(g,'LayerElementUV','UV','UVIndex');if(!U)noUV=true;
    const ML=kid(g,'LayerElementMaterial'),MA=ML?val((kid(ML,'Materials')||{props:[]}).props[0]):null,Mall=ML&&/AllSame/.test((kid(ML,'MappingInformationType')||{props:['']}).props[0]),mdl=models[geoOf[id]],tmat=[];let poly=0;
    const mnm=()=>{const k=MA?(Mall?MA[0]:MA[poly]):0;return (mdl&&mdl.mats[k])||(mdl&&mdl.mats[0])||'default';};
    const M=world(geoOf[id]),cnt=PI.length,pos=new Float32Array(cnt*3),nrm=new Float32Array(cnt*3),uv=new Float32Array(cnt*2),idx=grow(Uint32Array,cnt*2);
    const at=(L,pv,vi)=>{let k=/Vert/.test(L.map)&&!/Polygon/.test(L.map)?vi:pv;if(/Index/.test(L.ref)&&L.idx)k=L.idx[k];return k;};
    let p0=0,pv=0;
    for(let i=0;i<cnt;i++){let vi=PI[i],last=false;if(vi<0){vi=-vi-1;last=true;}
      const x=V[vi*3],y=V[vi*3+1],z=V[vi*3+2];pos[i*3]=M[0]*x+M[4]*y+M[8]*z+M[12];pos[i*3+1]=M[1]*x+M[5]*y+M[9]*z+M[13];pos[i*3+2]=M[2]*x+M[6]*y+M[10]*z+M[14];
      if(N){const k=at(N,pv,vi)*3,a=N.d[k],b=N.d[k+1],c=N.d[k+2];const nx=M[0]*a+M[4]*b+M[8]*c,ny=M[1]*a+M[5]*b+M[9]*c,nz=M[2]*a+M[6]*b+M[10]*c,l=Math.hypot(nx,ny,nz)||1;nrm[i*3]=nx/l;nrm[i*3+1]=ny/l;nrm[i*3+2]=nz/l;}
      if(U){const k=at(U,pv,vi)*2;uv[i*2]=U.d[k];uv[i*2+1]=1-U.d[k+1];}
      pv++;if(last){const mm=mnm();for(let k=p0+1;k+1<=i;k++){idx.p3(p0,k,k+1);tmat.push(mm);}p0=i+1;poly++;}
      if((i&1048575)===1048575){if(onProgress)onProgress(i/cnt);await new Promise(r=>setTimeout(r,0));}}
    const pname=models[geoOf[id]]?models[geoOf[id]].name:('mesh'+id);parts.push({pos,nrm,uv,idx:idx.out(),hasN:!!N,pname,tmat});}
  if(!parts.length)throw new Error('No meshes were found in this FBX file.');
  const m=mergeParts(parts);if(parts.some(p=>!p.hasN))m.nrm=null;const r=meshFinish(m,name);r.noUV=noUV;partsInfo(r,parts);matsInfo(r,parts);
  r.triCol=new Float32Array(r.triPart.length*3);r.triPart.forEach((p,i)=>r.triCol.set(idColor(r.partNames[p]),i*3));return r;}
/* which material each triangle uses (texture sets in 3D Paint): per part one name (mname) or one per triangle (tmat) */
function matsInfo(r,parts){const names=[],tm=new Uint32Array(r.idx.length/3);let o=0;const id=nm=>{let k=names.indexOf(nm);if(k<0){k=names.length;names.push(nm);}return k;};
  for(const p of parts){const n=p.idx.length/3;if(p.tmat)for(let t=0;t<n;t++)tm[o+t]=id(p.tmat[t]||'default');else tm.fill(id(p.mname||'default'),o,o+n);o+=n;}r.matNames=names;r.triMat=tm;matCompact(r);}
/* drop material names no triangle uses */
function matCompact(r){if(!r.triMat)return;const used=new Map();for(const k of r.triMat)if(!used.has(k))used.set(k,used.size);if(used.size===r.matNames.length&&[...used].every(([a,b])=>a===b))return;
  const order=[...used.keys()].sort((a,b)=>a-b),map=new Map(order.map((k,i)=>[k,i]));r.matNames=order.map(k=>r.matNames[k]);for(let i=0;i<r.triMat.length;i++)r.triMat[i]=map.get(r.triMat[i]);}
/* the triangles of each material together (so each texture set is one range to draw); per-triangle data follows */
function meshGroupByMat(m){if(m.setRanges)return m.setRanges;const T=m.idx.length/3,M=m.triMat,nm=m.matNames||['default'];
  if(!M||nm.length<2){m.setRanges=[{name:nm[0]||'default',start:0,count:T}];return m.setRanges;}
  const cnt=new Uint32Array(nm.length);for(let t=0;t<T;t++)cnt[M[t]]++;const st=new Uint32Array(nm.length);for(let k=1;k<nm.length;k++)st[k]=st[k-1]+cnt[k-1];
  const pos=st.slice(),order=new Uint32Array(T);for(let t=0;t<T;t++)order[pos[M[t]]++]=t;
  const idx=new Uint32Array(m.idx.length);for(let i=0;i<T;i++){const t=order[i];idx[i*3]=m.idx[t*3];idx[i*3+1]=m.idx[t*3+1];idx[i*3+2]=m.idx[t*3+2];}m.idx=idx;
  const per=(a,w)=>{if(!a)return a;const o=new a.constructor(a.length);for(let i=0;i<T;i++)for(let c=0;c<w;c++)o[i*w+c]=a[order[i]*w+c];return o;};
  m.triMat=per(M,1);m.triPart=per(m.triPart,1);m.triCol=per(m.triCol,3);
  m.setRanges=nm.map((name,k)=>({name,start:st[k],count:cnt[k]}));return m.setRanges;}
/* which part (object) each triangle came from, by name */
function partsInfo(r,parts){const names=[];let T=0;for(const p of parts)T+=p.idx.length/3;const tp=new Uint32Array(T);let o=0;for(const p of parts){let k=names.indexOf(p.pname);if(k<0){k=names.length;names.push(p.pname);}const n=p.idx.length/3;tp.fill(k,o,o+n);o+=n;}r.partNames=names;r.triPart=tp;}
