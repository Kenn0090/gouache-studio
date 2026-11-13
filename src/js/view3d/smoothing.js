/* (0.97.12, Kenn) Smoothing groups: remove them (the whole model shades smooth) or make them again from an angle (Auto smooth, like Blender's).
   A model keeps the file's own normals as `smOrig`, so "Keep the file's" always goes back. Only the normals change: positions, UVs and
   the triangles stay as they are, so painted textures and baked maps still fit. */
function meshRenormal(m,mode,angleDeg){
  const src=m.smOrig||m;if(mode==='keep'||!mode){if(!m.smOrig)return m;const o=m.smOrig;return o;}
  const n=src.verts||src.pos.length/3,idx=src.idx,T=idx.length/3,P=src.pos instanceof Float32Array?src.pos:Float32Array.from(src.pos);
  /* corners at the same position are one point */
  const bits=new Uint32Array(P.buffer,P.byteOffset,n*3),weld=new Int32Array(n),map=new Map();let W=0;
  for(let i=0;i<n;i++){const k=bits[i*3]+','+bits[i*3+1]+','+bits[i*3+2];let w=map.get(k);if(w===undefined){w=W++;map.set(k,w);}weld[i]=w;}
  /* face normals (unit) and the corner angle of each face at each of its corners */
  const fn=new Float32Array(T*3),ang=new Float32Array(T*3);
  for(let t=0;t<T;t++){const a=idx[t*3],b=idx[t*3+1],c=idx[t*3+2],ax=P[a*3],ay=P[a*3+1],az=P[a*3+2];
    const e1=[P[b*3]-ax,P[b*3+1]-ay,P[b*3+2]-az],e2=[P[c*3]-ax,P[c*3+1]-ay,P[c*3+2]-az];
    let nx=e1[1]*e2[2]-e1[2]*e2[1],ny=e1[2]*e2[0]-e1[0]*e2[2],nz=e1[0]*e2[1]-e1[1]*e2[0];const l=Math.hypot(nx,ny,nz);if(l>1e-20){nx/=l;ny/=l;nz/=l;}else{nx=ny=nz=0;}
    fn[t*3]=nx;fn[t*3+1]=ny;fn[t*3+2]=nz;
    const V=[a,b,c];for(let k=0;k<3;k++){const p=V[k],q=V[(k+1)%3],r=V[(k+2)%3];const u=[P[q*3]-P[p*3],P[q*3+1]-P[p*3+1],P[q*3+2]-P[p*3+2]],v=[P[r*3]-P[p*3],P[r*3+1]-P[p*3+1],P[r*3+2]-P[p*3+2]];
      const lu=Math.hypot(u[0],u[1],u[2])||1,lv=Math.hypot(v[0],v[1],v[2])||1;ang[t*3+k]=Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/(lu*lv))));}}
  /* the faces around each point */
  const cnt=new Int32Array(W+1);for(let t=0;t<T*3;t++)cnt[weld[idx[t]]+1]++;for(let i=0;i<W;i++)cnt[i+1]+=cnt[i];
  const fill=cnt.slice(0,W),around=new Int32Array(T*3);for(let t=0;t<T*3;t++){const w=weld[idx[t]];around[fill[w]++]=t;}/* corner numbers: face = floor(c/3) */
  const cosT=Math.cos((angleDeg==null?30:angleDeg)*Math.PI/180),all=mode==='all';
  const norm=(nx,ny,nz,fb)=>{const l=Math.hypot(nx,ny,nz);return l>1e-12?[nx/l,ny/l,nz/l]:fb;};
  if(all){/* one normal per point: every face around it, weighted by its corner angle */
    const out=new Float32Array(n*3),sum=new Float32Array(W*3);
    for(let c=0;c<T*3;c++){const w=weld[idx[c]],f=(c/3)|0,a=ang[c];sum[w*3]+=fn[f*3]*a;sum[w*3+1]+=fn[f*3+1]*a;sum[w*3+2]+=fn[f*3+2]*a;}
    for(let i=0;i<n;i++){const w=weld[i],r=norm(sum[w*3],sum[w*3+1],sum[w*3+2],[0,1,0]);out[i*3]=r[0];out[i*3+1]=r[1];out[i*3+2]=r[2];}
    const r=Object.assign({},src);for(const k of Object.keys(r))if(k[0]==='_')delete r[k];
    r.nrm=out;r.tan=tangentsOf(r.pos,out,r.uv,r.idx);r.smOrig=src;r.smMode='all';r.smAngle=undefined;return r;}
  /* by angle: each corner takes the faces around its point that lie within the angle of its own face; a corner that gets a different normal becomes its own vertex */
  const key=new Map(),newIdx=new Uint32Array(T*3),from=[],nx=[],ny=[],nz=[];
  for(let c=0;c<T*3;c++){const f=(c/3)|0,v=idx[c],w=weld[v];let sx=0,sy=0,sz=0;
    for(let j=cnt[w];j<cnt[w+1];j++){const c2=around[j],f2=(c2/3)|0;const d=fn[f*3]*fn[f2*3]+fn[f*3+1]*fn[f2*3+1]+fn[f*3+2]*fn[f2*3+2];if(d>=cosT-1e-6){const a=ang[c2];sx+=fn[f2*3]*a;sy+=fn[f2*3+1]*a;sz+=fn[f2*3+2]*a;}}
    const r=norm(sx,sy,sz,[fn[f*3],fn[f*3+1],fn[f*3+2]]);
    const k=v+'|'+Math.round(r[0]*2000)+'|'+Math.round(r[1]*2000)+'|'+Math.round(r[2]*2000);let id=key.get(k);
    if(id===undefined){id=from.length;key.set(k,id);from.push(v);nx.push(r[0]);ny.push(r[1]);nz.push(r[2]);}newIdx[c]=id;}
  const N=from.length,pos=new Float32Array(N*3),uv=new Float32Array(N*2),nrm=new Float32Array(N*3);
  for(let i=0;i<N;i++){const v=from[i];pos[i*3]=P[v*3];pos[i*3+1]=P[v*3+1];pos[i*3+2]=P[v*3+2];uv[i*2]=src.uv[v*2];uv[i*2+1]=src.uv[v*2+1];nrm[i*3]=nx[i];nrm[i*3+1]=ny[i];nrm[i*3+2]=nz[i];}
  const r=Object.assign({},src);for(const k of Object.keys(r))if(k[0]==='_')delete r[k];
  /* any other per-point list (vertex colours…) follows the new points */
  for(const k of Object.keys(src)){const a=src[k];if(['idx','pos','nrm','uv','tan','triMat','triPart'].includes(k)||!ArrayBuffer.isView(a)||k==='smOrig')continue;const per=a.length/n;if(!Number.isInteger(per)||per<1||per>4)continue;const b=new a.constructor(N*per);for(let i=0;i<N;i++)for(let j=0;j<per;j++)b[i*per+j]=a[from[i]*per+j];r[k]=b;}
  r.pos=pos;r.uv=uv;r.nrm=nrm;r.idx=newIdx;r.verts=N;r.tan=tangentsOf(pos,nrm,uv,newIdx);r.smOrig=src;r.smMode='angle';r.smAngle=angleDeg;return r;}
/* apply to the model you are working on: the bake's low-poly, or 3D Paint's imported model */
function smModelApply(mode,angle){if(stroke){toast('Finish the stroke first.');return;}
  const say=(m)=>toast(mode==='keep'?'Back to the file’s own smoothing.':mode==='all'?'Smoothing groups removed: the whole model is smooth.':'Auto smooth at '+angle+'°: edges sharper than that stay hard.');
  if(ui.mode==='bake'){const C=bakeCfg;if(!C.low){toast('Load a low-poly first.');return;}bakeSetModel('low',meshRenormal(C.low,mode,angle));say();return;}
  const m=v3.imported;if(!m||v3s().model!=='imported'){toast('Import a model first: the built-in shapes stay as they are.');return;}
  const r=meshRenormal(m,mode,angle);v3.imported=r;if(ui.mode==='p3d')p3.imported=r;v3.mesh=null;v3LoadModel(true);v3.dirty=true;requestRender(true);say();}
function smoothingState(){const m=ui.mode==='bake'?bakeCfg.low:v3.imported;return {mode:(m&&m.smMode)||'keep',angle:(m&&m.smAngle)||30};}
function smoothingRow(pre){pre=pre||'sm_';const st=smoothingState(),box=el('div',{class:'smoothrow'},el('div',{class:'sub',text:'Smoothing groups',title:'How the model shades across its edges. Baking uses it too.'}));
  box.append(seg([['keep','File’s own','Use the smoothing the file came with'],['all','Smooth all','Remove smoothing groups: every edge shades smooth'],['angle','Auto by angle','Edges sharper than the angle stay hard, the rest shade smooth']],st.mode,v=>smModelApply(v,smoothingState().angle),'Smoothing groups'));
  box.firstChild.nextSibling.id=pre+'mode';
  if(st.mode==='angle')box.append(makeSlider({id:pre+'angle',label:'Angle',min:1,max:180,step:1,value:st.angle,fmt:v=>Math.round(v)+'°',onInput:v=>{},onChange:v=>smModelApply('angle',Math.round(v))}).el);
  return box;}
