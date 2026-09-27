window.__bumpy=(m)=>{const p=m.pos.slice(),n=p.length/3;for(let i=0;i<n;i++){const x=p[i*3],y=p[i*3+1],z=p[i*3+2],f=1+.035*Math.sin(9*x)*Math.sin(9*y)*Math.sin(9*z);p[i*3]*=f;p[i*3+1]*=f;p[i*3+2]*=f;}
  const N=new Float32Array(p.length),key=i=>Math.round(p[i*3]*1e4)+','+Math.round(p[i*3+1]*1e4)+','+Math.round(p[i*3+2]*1e4),acc=new Map();
  for(let t=0;t<m.idx.length;t+=3){const a=m.idx[t],b=m.idx[t+1],c=m.idx[t+2];const u=[0,1,2].map(k=>p[b*3+k]-p[a*3+k]),v=[0,1,2].map(k=>p[c*3+k]-p[a*3+k]),f=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    for(const x of [a,b,c]){const k=key(x);let s=acc.get(k);if(!s){s=[0,0,0];acc.set(k,s);}s[0]+=f[0];s[1]+=f[1];s[2]+=f[2];}}
  for(let i=0;i<n;i++){const s=acc.get(key(i)),l=Math.hypot(...s)||1;N[i*3]=s[0]/l;N[i*3+1]=s[1]/l;N[i*3+2]=s[2]/l;}
  return Object.assign({},m,{pos:p,nrm:N,name:'bumpy'});};
