/* (0.95, Kenn) UDIMs as one texture set per material, its tiles inside.
   Each material's tiles sit side by side on ONE canvas in their own grid places (column = U tile, row = V tile),
   so the model is drawn and painted with UVs turned into that canvas: (uv - first tile) / tiles across.
   One layer stack, fills, blurs and strokes then carry across tile borders with no seams.
   p3.ua = {mats:{<material>:{x0,y0,nx,ny,tiles:[{id,u,v}]}}}; the model file keeps its own UVs (v3.imported),
   only the drawn/painted copy (v3.mesh) uses canvas UVs. Older projects with one set per tile keep working (p3.udim). */
/* the model keeps V turned over (1 - V of the file), but UDIM rows count up in the file's V: row = floor(1 - v) */
function udimAddr(u,v){if(!Number.isFinite(u)||!Number.isFinite(v))return null;const x=Math.floor(u),y=Math.floor(1-v);if(x<0||x>9||y<0||y>99)return null;return {id:1001+x+y*10,u:x,v:y};}
function udimTilesOf(m,r){const uv=m.uv,ix=m.idx,found=new Map();for(let t=r.start;t<r.start+r.count;t++){const a=ix[t*3],b=ix[t*3+1],c=ix[t*3+2],q=udimAddr((uv[a*2]+uv[b*2]+uv[c*2])/3,(uv[a*2+1]+uv[b*2+1]+uv[c*2+1])/3);if(q&&!found.has(q.id))found.set(q.id,q);}
  return [...found.values()].sort((a,b)=>a.id-b.id);}
function udimLayout(m){if(!m||!m.uv||!m.idx)return null;const rs=meshGroupByMat(m),mats={};
  for(const r of rs){const tiles=udimTilesOf(m,r);if(!tiles.length)continue;let x0=1e9,y0=1e9,x1=-1,y1=-1;
    for(const t of tiles){x0=Math.min(x0,t.u);y0=Math.min(y0,t.v);x1=Math.max(x1,t.u);y1=Math.max(y1,t.v);}
    mats[r.name]={x0,y0,nx:x1-x0+1,ny:y1-y0+1,tiles:tiles.map(t=>({id:t.id,u:t.u,v:t.v}))};}
  return {mats};}
const udimBox=name=>p3.ua&&p3.ua.mats&&p3.ua.mats[name]||null;
const udimOn=()=>typeof p3!=='undefined'&&!!p3.ua&&ui.mode==='p3d';
/* the texture size of one tile, and the canvas of a material: tiles across × tiles down, kept under the card's limit */
function udimDims(name,tile){const B=udimBox(name);tile=tile||p3.size;if(!B)return [tile,tile];
  const lim=Math.min(typeof MAX_DIM!=='undefined'?MAX_DIM:16384,gl.getParameter(gl.MAX_TEXTURE_SIZE)||8192),n=Math.max(B.nx,B.ny);
  const t=Math.max(64,Math.min(tile,Math.floor(lim/n)));return [t*B.nx,t*B.ny];}
function p3SetDims(S){return S?udimDims(p3Binding(S)):[p3.size,p3.size];}
/* the drawn copy of the model with canvas UVs; a corner shared by materials with different tile boxes is split */
function udimAtlasMesh(m){if(!p3.ua||!m||!m.uv)return m;const rs=meshGroupByMat(m),n=m.verts||m.pos.length/3,T=m.idx.length/3;
  const boxOf=new Array(rs.length);rs.forEach((r,k)=>{boxOf[k]=udimBox(r.name);});
  const map=new Map(),src=[],box=[],idx=new Uint32Array(m.idx.length);
  rs.forEach((r,k)=>{for(let t=r.start;t<r.start+r.count;t++)for(let c=0;c<3;c++){const v=m.idx[t*3+c],key=v*rs.length+k;let i=map.get(key);
    if(i===undefined){i=src.length;map.set(key,i);src.push(v);box.push(k);}idx[t*3+c]=i;}});
  const N=src.length,out={};
  for(const key of Object.keys(m)){const a=m[key];if(key==='idx'||!a||!ArrayBuffer.isView(a)||a.length%n)continue;const w=a.length/n;if(w<1||w>4||!Number.isInteger(w))continue;
    if(/^tri/.test(key))continue;const o=new a.constructor(N*w);for(let i=0;i<N;i++)for(let c=0;c<w;c++)o[i*w+c]=a[src[i]*w+c];out[key]=o;}
  const uv=out.uv;for(let i=0;i<N;i++){const B=boxOf[box[i]];if(!B)continue;uv[i*2]=(uv[i*2]-B.x0)/B.nx;uv[i*2+1]=1-((1-uv[i*2+1])-B.y0)/B.ny;/* in the file's V, then turned back over */}
  const r=Object.assign({},m,out,{idx,verts:N,udimAtlas:true,udimOf:m});for(const key of Object.keys(r))if(key[0]==='_')delete r[key];return r;}
/* which tile of a material a canvas point (0..1) lies on */
function udimTileAt(name,u,v){const B=udimBox(name);if(!B)return null;const x=B.x0+Math.floor(u*B.nx),y=B.y0+Math.floor((1-v)*B.ny);return B.tiles.find(t=>t.u===x&&t.v===y)||null;}
/* one tile's pixel box in the material's canvas: rows are counted like the model's V (canvas row 0 = model v 0 = the top of the file's highest tile row) */
function udimTileRect(name,tile,w,h){const B=udimBox(name);if(!B)return [0,0,w,h];const tw=w/B.nx,th=h/B.ny;return [Math.round((tile.u-B.x0)*tw),Math.round((B.ny-1-(tile.v-B.y0))*th),Math.round(tw),Math.round(th)];}
