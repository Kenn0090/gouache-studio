/* (0.96.1) tangents like MikkTSpace: corners an FBX lists separately but that share position, normal and UV
   get the same tangent, and an unwelded mesh gets the same tangents as the welded one. node tan961.cjs */
const fs=require('fs');const src=fs.readFileSync(__dirname+'/../../src/js/view3d/mesh.js','utf8');
eval(src.slice(src.indexOf('function tangentsOf'),src.indexOf('/* unique edges')).replace('function tangentsOf','globalThis.tangentsOf=function'));
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const S=12,R=3,V=(i,j)=>{const a=i/S*Math.PI*2;return [[Math.cos(a),j/R*2,Math.sin(a)],[Math.cos(a),0,Math.sin(a)],[i/S,1-j/R]];};
const un={pos:[],nrm:[],uv:[],idx:[]},we={pos:[],nrm:[],uv:[],idx:[]},key=new Map();
for(let i=0;i<S;i++)for(let j=0;j<R;j++)for(const [a,b] of [[i,j],[i+1,j],[i+1,j+1],[i,j],[i+1,j+1],[i,j+1]]){const v=V(a,b);
  un.idx.push(un.pos.length/3);un.pos.push(...v[0]);un.nrm.push(...v[1]);un.uv.push(...v[2]);
  const k=a+','+b;if(!key.has(k)){key.set(k,we.pos.length/3);we.pos.push(...v[0]);we.nrm.push(...v[1]);we.uv.push(...v[2]);}we.idx.push(key.get(k));}
const T=m=>tangentsOf(new Float32Array(m.pos),new Float32Array(m.nrm),new Float32Array(m.uv),m.idx);
const tu=T(un),tw=T(we);let worst=0,diff=0;
for(let q=0;q<un.idx.length;q++){const a=un.idx[q],b=we.idx[q];diff=Math.max(diff,Math.hypot(tu[a*4]-tw[b*4],tu[a*4+1]-tw[b*4+1],tu[a*4+2]-tw[b*4+2]));}
const n=un.pos.length/3;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if([0,1,2].every(c=>un.pos[i*3+c]===un.pos[j*3+c])&&un.uv[i*2]===un.uv[j*2]&&un.uv[i*2+1]===un.uv[j*2+1])
  worst=Math.max(worst,Math.hypot(tu[i*4]-tu[j*4],tu[i*4+1]-tu[j*4+1],tu[i*4+2]-tu[j*4+2]));
ok(worst<1e-6,'shared corners get one tangent ('+worst.toExponential(1)+')');
ok(diff<1e-5,'unwelded mesh = welded mesh ('+diff.toExponential(1)+')');
ok(Math.abs(tu[2]-1)<1e-5,'tangent follows the U direction');
console.log(fails?'FAILED '+fails:'ALL PASSED');process.exit(fails?1:0);
