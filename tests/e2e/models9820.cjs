/* test models with real, non-overlapping UV layouts (islands at different texel densities, seams, hard and smooth edges) */
function obj(V,T,N,F){return V.map(v=>'v '+v.join(' ')).concat(T.map(t=>'vt '+t.join(' ')),N.map(n=>'vn '+n.join(' ')),F.map(f=>'f '+f.map(c=>c.join('/')).join(' '))).join('\n');}
function box(){const V=[],T=[],N=[],F=[],S=8;
  const faces=[{n:[0,0,1],u:[1,0,0],v:[0,1,0],r:[.05,.05,.40]},{n:[0,0,-1],u:[-1,0,0],v:[0,1,0],r:[.55,.05,.20]},{n:[1,0,0],u:[0,0,-1],v:[0,1,0],r:[.55,.30,.30]},
    {n:[-1,0,0],u:[0,0,1],v:[0,1,0],r:[.05,.55,.20]},{n:[0,1,0],u:[1,0,0],v:[0,0,-1],r:[.30,.55,.20]},{n:[0,-1,0],u:[1,0,0],v:[0,0,1],r:[.55,.65,.30]}];
  for(const f of faces){N.push(f.n);const ni=N.length,base=V.length;for(let j=0;j<=S;j++)for(let i=0;i<=S;i++){const a=i/S*2-1,b=j/S*2-1;V.push([0,1,2].map(c=>f.n[c]+f.u[c]*a+f.v[c]*b));T.push([f.r[0]+f.r[2]*i/S,f.r[1]+f.r[2]*j/S]);}
    for(let j=0;j<S;j++)for(let i=0;i<S;i++){const k=base+j*(S+1)+i+1;F.push([[k,k,ni],[k+1,k+1,ni],[k+S+2,k+S+2,ni]],[[k,k,ni],[k+S+2,k+S+2,ni],[k+S+1,k+S+1,ni]]);}}
  return obj(V,T,N,F);}
function tube(){const V=[],T=[],N=[],F=[],R=48,H=8;/* side: one island with a seam at the back; caps: two small islands */
  for(let j=0;j<=H;j++)for(let i=0;i<=R;i++){const th=i/R*Math.PI*2,x=Math.sin(th),z=Math.cos(th);V.push([x,1-2*j/H,z]);N.push([x,0,z]);T.push([.02+.96*i/R,.98-.46*j/H]);}
  for(let j=0;j<H;j++)for(let i=0;i<R;i++){const k=j*(R+1)+i+1,a=k,b=k+1,c=k+R+2,d=k+R+1;F.push([[a,a,a],[d,d,d],[c,c,c]],[[a,a,a],[c,c,c],[b,b,b]]);}
  for(const [y,s,cx,cy,rad] of [[1,1,.2,.3,.16],[-1,-1,.7,.25,.22]]){N.push([0,s,0]);const ni=N.length,c0=V.length+1;V.push([0,y,0]);T.push([cx,cy]);
    for(let i=0;i<=R;i++){const th=i/R*Math.PI*2,x=Math.sin(th),z=Math.cos(th);V.push([x,y,z]);T.push([cx+x*rad,cy+z*rad]);}
    for(let i=0;i<R;i++){const a=c0+1+i,b=c0+2+i;F.push(s>0?[[c0,c0,ni],[a,a,ni],[b,b,ni]]:[[c0,c0,ni],[b,b,ni],[a,a,ni]]);}}
  return obj(V,T,N,F);}
module.exports={box,tube};
