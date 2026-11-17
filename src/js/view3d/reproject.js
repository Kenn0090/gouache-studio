/* ================= Re-project paint onto new UVs (0.98.6) =================
   Kenn: "when the model's UVs change, the painting must follow, like Painter's update mesh". The paint stays where it is on the
   SURFACE: every texel of the new UV layout finds the same spot on the old model and takes its colour from the old texture.
   - same triangles (only the UVs changed): the old UV comes straight from the matching corners of the old triangle
   - different triangles: the nearest point on the old model (a grid of triangles), so retopology works too
   The same engine moves paint between two assets (Transfer), because it only needs "old model + its pictures" and "new model". */
const RP_MIN_COVER=.35;
let P_RPMAP=null;
const FS_RPMAP=`uniform sampler2D uSrc; uniform sampler2D uMap; void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec2 m=texelFetch(uMap,p,0).rg; if(m.x<0.0){ o=vec4(0.0); return; } o=texture(uSrc,m); }`;
const rpTick=()=>new Promise(r=>setTimeout(r,0));
/* triangle ids of a model, by material name */
function rpTrisByMat(m){const T=m.idx.length/3,nm=m.matNames||['default'],M=m.triMat,out=new Map();for(const n of nm)out.set(n,[]);
  for(let t=0;t<T;t++){const n=nm[M?M[t]:0]||nm[0];out.get(n).push(t);}return out;}
/* vertex positions in the model file's own units, so two models of different size or centring still line up */
function rpFilePos(m){const s=m.fitS||1,c=m.fitC||[0,0,0],n=m.pos.length/3,o=new Float64Array(n*3);for(let i=0;i<n;i++)for(let k=0;k<3;k++)o[i*3+k]=m.pos[i*3+k]/s+c[k];return o;}
/* same triangles in the same places? (only the UVs differ) */
function rpSameShape(a,b,pa,pb){if(a.idx.length!==b.idx.length||pa.length!==pb.length)return false;for(let i=0;i<a.idx.length;i++)if(a.idx[i]!==b.idx[i])return false;
  let mn=1e30,mx=-1e30;for(let i=0;i<pa.length;i++){mn=Math.min(mn,pa[i]);mx=Math.max(mx,pa[i]);}const tol=(mx-mn)*1e-5+1e-9;
  for(let i=0;i<pa.length;i++)if(Math.abs(pa[i]-pb[i])>tol)return false;return true;}
/* did the UVs change? (different triangle count, or the same count with moved UVs) */
function rpUVsDiffer(a,b){if(!a||!b||!a.uv||!b.uv)return false;if(a.uv.length!==b.uv.length||a.idx.length!==b.idx.length)return true;
  for(let i=0;i<a.uv.length;i++)if(Math.abs(a.uv[i]-b.uv[i])>1e-4)return true;return false;}
/* closest point on a triangle (Ericson): fills out = [d2,u,v,w] with barycentric weights of a,b,c */
function rpClosest(px,py,pz,ax,ay,az,bx,by,bz,cx,cy,cz,out){
  const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az,apx=px-ax,apy=py-ay,apz=pz-az;
  const d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;let u,v,w;
  if(d1<=0&&d2<=0){u=1;v=0;w=0;}
  else{const bpx=px-bx,bpy=py-by,bpz=pz-bz,d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;
    if(d3>=0&&d4<=d3){u=0;v=1;w=0;}
    else{const vc=d1*d4-d3*d2;
      if(vc<=0&&d1>=0&&d3<=0){const t=d1/(d1-d3);u=1-t;v=t;w=0;}
      else{const cpx=px-cx,cpy=py-cy,cpz=pz-cz,d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;
        if(d6>=0&&d5<=d6){u=0;v=0;w=1;}
        else{const vb=d5*d2-d1*d6;
          if(vb<=0&&d2>=0&&d6<=0){const t=d2/(d2-d6);u=1-t;v=0;w=t;}
          else{const va=d3*d6-d5*d4;
            if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const t=(d4-d3)/((d4-d3)+(d5-d6));u=0;v=1-t;w=t;}
            else{const dn=1/(va+vb+vc);v=vb*dn;w=vc*dn;u=1-v-w;}}}}}}
  const qx=ax+abx*v+acx*w,qy=ay+aby*v+acy*w,qz=az+abz*v+acz*w,dx=px-qx,dy=py-qy,dz=pz-qz;out[0]=dx*dx+dy*dy+dz*dz;out[1]=u;out[2]=v;out[3]=w;}
/* a grid of the old triangles for "nearest point" lookups */
function rpGrid(pos,idx,tris){let mn=[1e30,1e30,1e30],mx=[-1e30,-1e30,-1e30];
  for(const t of tris)for(let c=0;c<3;c++){const v=idx[t*3+c];for(let k=0;k<3;k++){const x=pos[v*3+k];if(x<mn[k])mn[k]=x;if(x>mx[k])mx[k]=x;}}
  const sz=[mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]],diag=Math.hypot(sz[0],sz[1],sz[2])||1,G=Math.max(4,Math.min(96,Math.round(Math.cbrt(tris.length)*1.2))),cell=diag/G*1.8;
  const dims=[Math.max(1,Math.ceil(sz[0]/cell)),Math.max(1,Math.ceil(sz[1]/cell)),Math.max(1,Math.ceil(sz[2]/cell))],cells=new Map();
  const key=(x,y,z)=>x+dims[0]*(y+dims[1]*z);
  for(const t of tris){let lo=[1e30,1e30,1e30],hi=[-1e30,-1e30,-1e30];
    for(let c=0;c<3;c++){const v=idx[t*3+c];for(let k=0;k<3;k++){const x=pos[v*3+k];if(x<lo[k])lo[k]=x;if(x>hi[k])hi[k]=x;}}
    const a=lo.map((x,k)=>Math.max(0,Math.floor((x-mn[k])/cell))),b=hi.map((x,k)=>Math.min(dims[k]-1,Math.floor((x-mn[k])/cell)));
    for(let z=a[2];z<=b[2];z++)for(let y=a[1];y<=b[1];y++)for(let x=a[0];x<=b[0];x++){const k=key(x,y,z);let l=cells.get(k);if(!l)cells.set(k,l=[]);l.push(t);}}
  return {mn,cell,dims,cells,key,diag};}
/* the map: for each texel of the new layout, the old UV (u,v) of the same spot on the surface, or -1 */
async function rpBuildMap(oldM,newM,oldTris,newTris,W,H,progress,tolFrac){
  const map=new Float32Array(W*H*2).fill(-1),inside=new Uint8Array(W*H),got={n:0},pa=rpFilePos(oldM),pb=rpFilePos(newM),same=rpSameShape(oldM,newM,pa,pb);
  const grid=same?null:rpGrid(pa,oldM.idx,oldTris),tmp=[0,0,0,0],best=[0,0,0,0],lastT={t:-1},tol=grid?grid.diag*(tolFrac||.03):0;
  const ouv=oldM.uv,uvn=newM.uv,io=oldM.idx,inw=newM.idx;let work=0;
  const lookup=(t,wa,wb,wc)=>{/* position of the new texel on the new triangle, in file units */
    const a=inw[t*3],b=inw[t*3+1],c=inw[t*3+2],px=pb[a*3]*wa+pb[b*3]*wb+pb[c*3]*wc,py=pb[a*3+1]*wa+pb[b*3+1]*wb+pb[c*3+1]*wc,pz=pb[a*3+2]*wa+pb[b*3+2]*wb+pb[c*3+2]*wc;
    const test=ot=>{const x=io[ot*3],y=io[ot*3+1],z=io[ot*3+2];rpClosest(px,py,pz,pa[x*3],pa[x*3+1],pa[x*3+2],pa[y*3],pa[y*3+1],pa[y*3+2],pa[z*3],pa[z*3+1],pa[z*3+2],tmp);return tmp[0];};
    let bt=-1,bd=1e30;
    if(lastT.t>=0){const d=test(lastT.t);if(d<(tol*.05)**2){bt=lastT.t;bd=d;best[1]=tmp[1];best[2]=tmp[2];best[3]=tmp[3];}}
    if(bt<0){const g=grid,ix=Math.min(g.dims[0]-1,Math.max(0,Math.floor((px-g.mn[0])/g.cell))),iy=Math.min(g.dims[1]-1,Math.max(0,Math.floor((py-g.mn[1])/g.cell))),iz=Math.min(g.dims[2]-1,Math.max(0,Math.floor((pz-g.mn[2])/g.cell)));
      for(let r=0;r<=5;r++){
        for(let z=iz-r;z<=iz+r;z++)for(let y=iy-r;y<=iy+r;y++)for(let x=ix-r;x<=ix+r;x++){if(r>0&&Math.max(Math.abs(x-ix),Math.abs(y-iy),Math.abs(z-iz))!==r)continue;
          if(x<0||y<0||z<0||x>=g.dims[0]||y>=g.dims[1]||z>=g.dims[2])continue;const l=g.cells.get(g.key(x,y,z));if(!l)continue;
          for(const ot of l){const d=test(ot);if(d<bd){bd=d;bt=ot;best[1]=tmp[1];best[2]=tmp[2];best[3]=tmp[3];}}}
        if(bt>=0&&Math.sqrt(bd)<=r*g.cell)break;}}
    if(bt<0||bd>tol*tol)return null;lastT.t=bt;const x=io[bt*3],y=io[bt*3+1],z=io[bt*3+2];
    return [ouv[x*2]*best[1]+ouv[y*2]*best[2]+ouv[z*2]*best[3],ouv[x*2+1]*best[1]+ouv[y*2+1]*best[2]+ouv[z*2+1]*best[3]];};
  for(let ti=0;ti<newTris.length;ti++){const t=newTris[ti],a=inw[t*3],b=inw[t*3+1],c=inw[t*3+2];
    const ax=uvn[a*2]*W,ay=uvn[a*2+1]*H,bx=uvn[b*2]*W,by=uvn[b*2+1]*H,cx=uvn[c*2]*W,cy=uvn[c*2+1]*H,den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-9)continue;
    const l0=Math.hypot(bx-cx,by-cy),l1=Math.hypot(cx-ax,cy-ay),l2=Math.hypot(ax-bx,ay-by),area=Math.abs(den),e0=1.6*l0/area,e1=1.6*l1/area,e2=1.6*l2/area;/* 1.6 texels of padding */
    const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx)-2)),x1=Math.min(W-1,Math.ceil(Math.max(ax,bx,cx)+2)),y0=Math.max(0,Math.floor(Math.min(ay,by,cy)-2)),y1=Math.min(H-1,Math.ceil(Math.max(ay,by,cy)+2));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=x+.5,py=y+.5,wa=((by-cy)*(px-cx)+(cx-bx)*(py-cy))/den,wb=((cy-ay)*(px-cx)+(ax-cx)*(py-cy))/den,wc=1-wa-wb;
      const ins=wa>=-1e-6&&wb>=-1e-6&&wc>=-1e-6;if(!ins&&!(wa>=-e0&&wb>=-e1&&wc>=-e2))continue;const k=y*W+x;if(!ins&&map[k*2]>=0)continue;if(ins&&inside[k])continue;
      let uv;if(same){uv=[ouv[a*2]*wa+ouv[b*2]*wb+ouv[c*2]*wc,ouv[a*2+1]*wa+ouv[b*2+1]*wb+ouv[c*2+1]*wc];}else uv=lookup(t,wa,wb,wc);
      if(!uv)continue;map[k*2]=uv[0];map[k*2+1]=uv[1];if(ins)inside[k]=1;got.n++;work++;}
    if(ti%64===0&&(work>20000)){work=0;if(progress)progress(ti/newTris.length);await rpTick();}}
  return {map,got:got.n,inside:inside};}
/* the map as a texture the remap shader can read exactly */
function rpMapTex(map,W,H){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RG32F,W,H,0,gl.RG,gl.FLOAT,map);
  for(const [p,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,p,v);return tex;}
/* move every picture of the live document through the map */
function rpApply(map){const W=doc.w,H=doc.h,tex=rpMapTex(map,W,H);let ok=false;
  try{if(!P_RPMAP)P_RPMAP=program(FS_RPMAP);
    const draw=(src,dst)=>run(P_RPMAP,dst,{uSrc:src.tex,uMap:tex});
    ok=rebuildLayers(W,H,doc.depth,draw);
    if(ok&&doc.meshMaps)for(const k of Object.keys(doc.meshMaps)){const t=doc.meshMaps[k];if(!t||t.w!==W||t.h!==H)continue;const nt=makeTarget(W,H,t.depth,false,t.packed,t.mono);run(P_RPMAP,nt,{uSrc:t.tex,uMap:tex});disposeTarget(t);doc.meshMaps[k]=nt;}}
  finally{gl.deleteTexture(tex);}
  return ok;}
/* the whole job: every texture set of the 3D Paint project */
async function rpReproject(oldM,newM,opt){opt=opt||{};if(ui.mode!=='p3d'||!p3||!p3.sets||!p3.sets.length)return {ok:false,why:'No 3D Paint project is open.'};
  /* UDIM sets paint on the atlas mesh (UVs in canvas places): both models are laid out with the project's tile layout, so they line up */
  const oldA=p3.ua?udimAtlasMesh(oldM):oldM,newA=p3.ua?udimAtlasMesh(newM):newM;oldM=oldA;newM=newA;
  const oldBy=rpTrisByMat(oldM),newBy=rpTrisByMat(newM),report={sets:0,moved:0,missed:[],low:[]};
  const jobs=p3.sets.map((S,i)=>({i,name:p3Binding(S),S})).filter(j=>!j.S.missing);
  loadStart('Re-projecting your paint');
  try{for(let n=0;n<jobs.length;n++){const j=jobs[n];const dims=p3InSet(j.i,()=>[doc.w,doc.h]);if(!dims)continue;
      const nt=newBy.get(j.name)||(newBy.size===1?[...newBy.values()][0]:null),ot=oldBy.get(j.name)||(oldBy.size===1?[...oldBy.values()][0]:null);
      if(!nt||!ot||!nt.length||!ot.length){report.missed.push(j.name);continue;}
      loadSet(n/jobs.length,'Looking up “'+j.name+'”…');
      const r=await rpBuildMap(oldM,newM,ot,nt,dims[0],dims[1],f=>loadSet((n+f*.8)/jobs.length));
      let area=0;for(let i=0;i<r.inside.length;i++)area+=r.inside[i];
      if(area<50||r.got<area*RP_MIN_COVER){report.low.push(j.name);continue;}
      loadSet((n+.85)/jobs.length,'Moving the paint of “'+j.name+'”…');await rpTick();
      const ok=p3InSet(j.i,()=>rpApply(r.map));
      if(ok){report.sets++;report.moved+=r.got;}else report.low.push(j.name);}}
  finally{loadEnd();}
  if(typeof p3RefreshTex==='function')p3RefreshTex();v3.mapsDirty=true;v3.dirty=true;requestRender(true);if(typeof buildP3Panel==='function')buildP3Panel();
  report.ok=report.sets>0;return report;}
/* the updater calls this after it swapped the model: if the UVs changed, the paint follows */
async function rpAfterSwap(old,m){try{if(ui.mode!=='p3d'||!rpUVsDiffer(old,m))return false;if(p3.imported!==m)return false;
    const r=await rpReproject(old,m);
    if(r.ok)toast('Your paint was moved onto the new UVs'+(r.missed.length||r.low.length?' (not for: '+[...r.missed,...r.low].join(', ')+')':'')+'. Baked maps were moved too, so bake again for exact ones.');
    else toast(r.why||'The paint could not be moved onto the new UVs'+(r.low.length?' (too little of the new model matches the old one: '+r.low.join(', ')+')':'')+'.');
    return !!r.ok;}catch(e){loadEnd();console.warn('re-project',e);toast('Re-projecting the paint failed: '+(e.message||e));return false;}}

/* File › Replace the model, keep my paint: another model (new UVs, other triangles, a retopologised version) takes the old one's place and
   the paint is moved across by surface position */
async function p3ReplaceModel(){if(ui.mode!=='p3d'||!p3.imported){toast('Open a 3D Paint project with an imported model first.');return;}
  const old=p3.imported,opts={udim:!!(p3.udim||p3.ua)},done=m=>{if(!m)return;if(typeof mwTag==='function'&&m.srcPath===undefined&&old.srcPath)m.srcPath=undefined;mwSwap(old,m);toast('Replaced with “'+(m.name||'the new model')+'”.');};
  if(platform.isDesktop){try{const p=await platform.openDialog([{name:'3D models',extensions:['obj','glb','gltf','fbx','OBJ','GLB','GLTF','FBX']}]);if(!p)return;loadModelStart(fileNameOf(p));
      try{const bytes=await platform.readFile(p),dir=p.replace(/[\\/][^\\/]*$/,''),sep=p.includes('\\')?'\\':'/';
        done(await mwTag(await parseModelBytes(fileNameOf(p),bytes,async u=>{const b=await platform.readFile(dir+sep+u);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);},opts),p));}finally{loadEnd();}}
    catch(e){if(e.message==='Import cancelled.')toast('Cancelled.');else{console.warn(e);toast('This model could not be loaded: '+(e.message||e));}}return;}
  const f=el('input',{type:'file',accept:'.obj,.glb,.gltf,.fbx',multiple:true});f.onchange=async()=>{const fs=[...f.files],file=fs.find(x=>isModelName(x.name));if(!file)return;loadModelStart(file.name);
    try{done(await parseModelFile(file,fs,opts));}catch(e){if(e.message==='Import cancelled.')toast('Cancelled.');else{console.warn(e);toast('This model could not be loaded: '+(e.message||e));}}finally{loadEnd();}};f.click();}

/* ================= Transfer: paint from another saved 3D Paint project =================
   Reads the other project's model and every texture set's flattened maps (without opening it), then projects them onto this model by
   surface position, as one new layer per set (all the ticked maps in it), so nothing already painted is lost. */
async function trReadProject(file){const buf=await file.arrayBuffer();if(!isP3Proj(buf))throw new Error('That is not a Gouache Studio 3D Paint project.');
  const dv=new DataView(buf),hl=dv.getUint32(12,true),head=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,16,hl))),data=16+hl;
  if(!head.mesh)throw new Error('That project has no imported model to transfer from.');
  const raw=await streamThrough(new Uint8Array(buf,data+head.mesh.o,head.mesh.n),'deflate-raw',true),mesh=meshUnpack(raw,head.mesh.name||'Model');
  const sets=[],mine=docState();
  try{for(const rec of head.sets||[]){if(rec.empty)continue;
      const b=buf.slice(data+rec.o,data+rec.o+rec.n),{head:h,data:d}=gfHead(b);blankTabDoc(h.w,h.h,rec.name);for(const L of everyNode())disposeLayer(L);doc.root.children=[];doc.count=0;
      await gfReadInto(b,h,d);const maps={};
      for(const k of doc.maps){try{const c=compositeMap(k),t=makeTarget(doc.w,doc.h,c.depth);blit(c,t,0,0,doc.w,doc.h,0,0);release(c);maps[k]=t;}catch(e){console.warn('transfer map',k,e);}}
      sets.push({name:rec.name,material:rec.material||rec.name,w:doc.w,h:doc.h,maps,tile:rec.tile||null});disposeDocState(docState());await rpTick();}}
  finally{setDocState(mine);}
  return {name:head.name||file.name,mesh,sets,ua:head.ua||null};}
function trFree(src){if(!src)return;for(const S of src.sets)for(const k in S.maps)disposeTarget(S.maps[k]);src.sets=[];}
/* one source set onto one target set: a new paint layer */
async function trRun(src,jobs,keys,tolFrac,newM){let n=0;const newBy=rpTrisByMat(newM),oldBy=rpTrisByMat(src.mesh),report={done:0,low:[]};
  loadStart('Transferring paint');
  try{for(const j of jobs){const S=src.sets[j.si],T=p3.sets[j.ti];if(!S||!T||T.missing)continue;
      const dims=p3InSet(j.ti,()=>[doc.w,doc.h]),nt=newBy.get(p3Binding(T))||(newBy.size===1?[...newBy.values()][0]:null),ot=oldBy.get(S.material)||oldBy.get(S.name)||(oldBy.size===1?[...oldBy.values()][0]:null);
      if(!nt||!ot||!dims){report.low.push(S.name);continue;}
      loadSet(n/jobs.length,'Looking up “'+S.name+'”…');
      const r=await rpBuildMap(src.mesh,newM,ot,nt,dims[0],dims[1],f=>loadSet((n+f*.8)/jobs.length),tolFrac);let area=0;for(let i=0;i<r.inside.length;i++)area+=r.inside[i];
      if(area<50||r.got<area*RP_MIN_COVER){report.low.push(S.name);n++;continue;}
      const tex=rpMapTex(r.map,dims[0],dims[1]);
      try{if(!P_RPMAP)P_RPMAP=program(FS_RPMAP);
        p3InSet(j.ti,()=>{const L=cmdAddLayer();if(!L)return;L.name='Transfer · '+S.name;
          for(const k of keys){if(!S.maps[k]||!doc.maps.includes(k))continue;const Tg=ensureMapTarget(L,k);run(P_RPMAP,Tg,{uSrc:S.maps[k].tex,uMap:tex});Tg.opaque=false;}
          L.lookVer=(L.lookVer||0)+1;changedAll();});report.done++;}
      finally{gl.deleteTexture(tex);}
      n++;await rpTick();}}
  finally{loadEnd();}
  if(typeof p3RefreshTex==='function')p3RefreshTex();v3.mapsDirty=true;v3.dirty=true;requestRender(true);if(typeof buildP3Panel==='function')buildP3Panel();
  return report;}
async function dlgTransfer(){if(ui.mode!=='p3d'||!p3.imported){toast('Open a 3D Paint project with an imported model first. The paint lands on that model.');return;}
  const fs=await pickFiles('.gouache3d',false,'3D Paint projects',['gouache3d']);if(!fs||!fs[0])return;
  let src;loadStart('Reading “'+fs[0].name+'”');try{src=await trReadProject(fs[0]);}catch(e){loadEnd();console.warn(e);toast(e.message||'That project could not be read.');return;}loadEnd();
  if(src.ua||p3.ua){toast('Transfers between UDIM projects are not supported yet.');trFree(src);return;}
  const allKeys=[...new Set(src.sets.flatMap(S=>Object.keys(S.maps)))].filter(k=>doc.maps.includes(k)),pick=new Set(allKeys.filter(k=>['base','normal','rough','metal','height','ao','emis'].includes(k)||allKeys.length<8));
  const rows=src.sets.map((S,si)=>{const ti=Math.max(0,p3.sets.findIndex(T=>p3Binding(T)===S.material||T.name===S.name));return {si,ti:p3.sets.length?(ti>=0?ti:0):0,on:true};});
  let tol=3;
  const setRows=rows.map(r=>el('div',{class:'frow'},chk('tr_set_'+r.si,src.sets[r.si].name+' ('+src.sets[r.si].w+' px)',true,v=>{r.on=v;}),el('span',{class:'note',text:'→'}),
    (()=>{const s=el('select',{id:'tr_to_'+r.si,'aria-label':'Target texture set'},...p3.sets.map((T,i)=>el('option',{value:String(i),text:T.name,selected:i===r.ti})));s.onchange=()=>{r.ti=+s.value;};return s;})()));
  const left=el('div',{class:'mccol'},el('p',{class:'note',text:'From “'+src.name+'”: '+src.mesh.tris.toLocaleString()+' triangles, '+src.sets.length+' texture set'+(src.sets.length===1?'':'s')+'. The paint is projected onto this model by surface position, as a new layer in each target set.'}),
    el('div',{class:'sub',text:'Texture sets'}),...setRows);
  const right=el('div',{class:'mccol'},el('div',{class:'sub',text:'Maps to transfer'}),el('div',{class:'chips'},...allKeys.map(k=>chk('tr_k_'+k,MAP_DEFS[k]?MAP_DEFS[k].label:k,pick.has(k),v=>{if(v)pick.add(k);else pick.delete(k);}))),
    makeSlider({id:'tr_tol',label:'How far apart the two models can be',min:.5,max:15,step:.5,value:tol,fmt:v=>v+'% of the model',onInput:v=>{tol=v;}}).el);
  openDialog({title:'Transfer paint from another project',body:el('div',{class:'mcwide'},left,right),xwin:true,resizable:true,okLabel:'Transfer',cancelLabel:'Cancel',
    onOk(){const jobs=rows.filter(r=>r.on).map(r=>({si:r.si,ti:r.ti}));if(!jobs.length||!pick.size){toast('Tick a set and at least one map.');return false;}
      const keys=[...pick];trRun(src,jobs,keys,tol/100,p3.imported).then(rep=>{toast(rep.done?'Transferred the paint of '+rep.done+' texture set'+(rep.done===1?'':'s')+' as new layers.'+(rep.low.length?' Not found on this model: '+rep.low.join(', ')+'.':''):'Nothing could be transferred: the two models do not match closely enough ('+rep.low.join(', ')+'). Try a bigger distance.');}).catch(e=>{console.warn(e);toast('The transfer failed: '+(e.message||e));}).finally(()=>trFree(src));},
    onCancel(){trFree(src);}});}
