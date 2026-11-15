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
/* the texture size of one tile, and the canvas of a material: tiles across × tiles down, kept under the card's limit.
   (0.97.30, Kenn: per-tile sizes) with tiles of different sizes the tiles are packed onto the canvas instead (udimPack) */
function udimDims(name,tile){const B=udimBox(name);tile=tile||p3.size;if(!B)return [tile,tile];
  if(udimHasSizes(B)){const P=udimPack(name,tile);return [P.W,P.H];}
  const lim=udimLim(),n=Math.max(B.nx,B.ny);
  const t=Math.max(64,Math.min(tile,Math.floor(lim/n)));return [t*B.nx,t*B.ny];}
function p3SetDims(S){return S?udimDims(p3Binding(S)):[p3.size,p3.size];}
/* the drawn copy of the model with canvas UVs; a corner shared by materials with different tile boxes is split */
function udimAtlasMeshGrid(m){if(!p3.ua||!m||!m.uv)return m;const rs=meshGroupByMat(m),n=m.verts||m.pos.length/3,T=m.idx.length/3;
  const boxOf=new Array(rs.length);rs.forEach((r,k)=>{boxOf[k]=udimBox(r.name);});
  const map=new Map(),src=[],box=[],idx=new Uint32Array(m.idx.length);
  rs.forEach((r,k)=>{for(let t=r.start;t<r.start+r.count;t++)for(let c=0;c<3;c++){const v=m.idx[t*3+c],key=v*rs.length+k;let i=map.get(key);
    if(i===undefined){i=src.length;map.set(key,i);src.push(v);box.push(k);}idx[t*3+c]=i;}});
  const N=src.length,out={};
  for(const key of Object.keys(m)){const a=m[key];if(key==='idx'||!a||!ArrayBuffer.isView(a)||a.length%n)continue;const w=a.length/n;if(w<1||w>4||!Number.isInteger(w))continue;
    if(/^tri/.test(key))continue;const o=new a.constructor(N*w);for(let i=0;i<N;i++)for(let c=0;c<w;c++)o[i*w+c]=a[src[i]*w+c];out[key]=o;}
  const uv=out.uv;for(let i=0;i<N;i++){const B=boxOf[box[i]];if(!B)continue;uv[i*2]=(uv[i*2]-B.x0)/B.nx;uv[i*2+1]=1-((1-uv[i*2+1])-B.y0)/B.ny;/* in the file's V, then turned back over */}
  const r=Object.assign({},m,out,{idx,verts:N,udimAtlas:true,udimOf:m});for(const key of Object.keys(r))if(key[0]==='_')delete r[key];return r;}
/* which tile of a material a canvas point (0..1, rows from the top) lies on */
function udimTileAt(name,u,v){const B=udimBox(name);if(!B)return null;if(B.lay){for(const T of B.tiles){const r=B.lay[T.id];if(r&&u>=r[0]&&u<r[0]+r[2]&&v>=r[1]&&v<r[1]+r[3])return T;}return null;}const x=B.x0+Math.floor(u*B.nx),y=B.y0+Math.floor((1-v)*B.ny);return B.tiles.find(t=>t.u===x&&t.v===y)||null;}
/* one tile's pixel box in the material's canvas: rows are counted like the model's V (canvas row 0 = model v 0 = the top of the file's highest tile row) */
function udimTileRect(name,tile,w,h){const B=udimBox(name);if(!B)return [0,0,w,h];const r=B.lay&&B.lay[tile.id];if(r)return [Math.round(r[0]*w),Math.round(r[1]*h),Math.round(r[2]*w),Math.round(r[3]*h)];return udimGridRect(name,tile,w,h);}
/* the same tile in the plain grid (every tile the same size): pictures that hold every tile are laid out this way */
function udimGridRect(name,tile,w,h){const B=udimBox(name);if(!B)return [0,0,w,h];const tw=w/B.nx,th=h/B.ny;return [Math.round((tile.u-B.x0)*tw),Math.round((B.ny-1-(tile.v-B.y0))*th),Math.round(tw),Math.round(th)];}
/* frame one tile on the flat canvas (the 2D part of the 3D Paint view) */
function udimFrameTile(name,T){const B=udimBox(name);if(!B)return;fit();const R=udimTileRect(name,T,doc.w,doc.h),z=view.zoom,f=Math.min(B.nx,B.ny)>1||Math.max(B.nx,B.ny)>1?Math.max(1,Math.min(doc.w/R[2],doc.h/R[3])):1;
  const cx=view.x+doc.w/2*z,cy=view.y+doc.h/2*z,tx=view.x+(R[0]+R[2]/2)*z,ty=view.y+(R[1]+R[3]/2)*z;zoomAt(f*.95,tx,ty);view.x+=cx-tx;view.y+=cy-ty;requestRender();toast('UV tile '+T.id+'.');}

/* ================= Per-tile texture sizes (0.97.30, Kenn: "B: real sizes") =================
   Each UV tile can have its own texture size (an 8K face tile beside 2K body tiles), so a material's canvas holds every tile at its
   own size: tiles are packed onto the canvas, biggest first. The packing is kept in B.lay ({tile id: [x, y, w, h]} as shares of
   the canvas, rows from the top) and saved with the project; B.size holds the sizes asked for ({tile id: px}, missing = the set's
   size). No B.lay = the old grid, every tile the same size.
   Everything that thinks in tiles keeps working through two conversions:
     - the model drawn and painted (udimAtlasMesh) puts each tile's UVs into its own box on the canvas
     - patterns, pictures and procedurals in UV space measure against the plain grid (udimG in the shaders), so they still
       repeat once per tile at the same scale on the model
   Changing a size rebuilds the canvas from the strokes (paint-resolution.js), so nothing is blurred by scaling. */
const udimLim=()=>Math.min(typeof MAX_DIM!=='undefined'?MAX_DIM:16384,gl.getParameter(gl.MAX_TEXTURE_SIZE)||8192);
const udimHasSizes=B=>!!(B&&B.size&&B.tiles.some(T=>B.size[T.id]>0));
const udimNominal=(name,T,base)=>{const B=udimBox(name),s=B&&B.size&&B.size[T.id];return s>0?s:(base||p3.size);};
/* the grid layout as shares of the canvas */
function udimGridLay(B){const o={};for(const T of B.tiles)o[T.id]=[(T.u-B.x0)/B.nx,(B.ny-1-(T.v-B.y0))/B.ny,1/B.nx,1/B.ny];return o;}
function udimLay(name){const B=udimBox(name);return B?(B.lay||udimGridLay(B)):null;}
function udimLayEq(a,b){if(a===b)return true;if(!a||!b)return false;const ka=Object.keys(a);if(ka.length!==Object.keys(b).length)return false;
  for(const k of ka){const x=a[k],y=b[k];if(!y)return false;for(let i=0;i<4;i++)if(Math.abs(x[i]-y[i])>1e-6)return false;}return true;}
/* skyline packing of squares (sizes in px, all multiples of 64): bottom-left, the lowest place first; tries several canvas widths
   and keeps the smallest square-ish canvas */
function udimSky(sizes){const g=64,u=sizes.map(s=>Math.max(1,Math.round(s/g))),ord=u.map((x,i)=>i).sort((a,b)=>u[b]-u[a]||a-b);
  const widths=new Set();let acc=0;for(const i of ord){acc+=u[i];widths.add(Math.max(acc,u[ord[0]]));}
  let best=null;
  for(const Wu of widths){const h=new Int32Array(Wu),pos=new Array(u.length);let H=0;
    for(const i of ord){const w=u[i];let bx=0,by=1e9;for(let x=0;x+w<=Wu;x++){let y=0;for(let k=x;k<x+w;k++)if(h[k]>y)y=h[k];if(y<by){by=y;bx=x;}}
      for(let k=bx;k<bx+w;k++)h[k]=by+w;pos[i]=[bx,by];H=Math.max(H,by+w);}
    let W=0;for(let i=0;i<u.length;i++)W=Math.max(W,pos[i][0]+u[i]);
    const score=Math.max(W,H)*1e6+W*H;if(!best||score<best.score)best={score,W:W*g,H:H*g,pos:pos.map(p=>[p[0]*g,p[1]*g]),s:u.map(x=>x*g)};}
  return best;}
/* the canvas for a material with the sizes asked for (base = the set's size); halved until it fits the graphics card */
function udimPack(name,base){const B=udimBox(name);if(!B)return null;base=base||p3.size;const lim=udimLim();
  if(!udimHasSizes(B)){const n=Math.max(B.nx,B.ny),t=Math.max(64,Math.min(base,Math.floor(lim/n)));return {W:t*B.nx,H:t*B.ny,lay:null,grid:true};}
  for(let f=1;f>=1/64;f/=2){const S=B.tiles.map(T=>Math.max(64,Math.round(udimNominal(name,T,base)*f/64)*64)),P=udimSky(S);
    if(Math.max(P.W,P.H)<=lim){const lay={};B.tiles.forEach((T,i)=>{lay[T.id]=[P.pos[i][0]/P.W,P.pos[i][1]/P.H,P.s[i]/P.W,P.s[i]/P.H];});
      if(udimLayEq(lay,udimGridLay(B)))return {W:P.W,H:P.H,lay:null,grid:true,f};return {W:P.W,H:P.H,lay,grid:false,f};}}
  return {W:64,H:64,lay:null,grid:true};}
/* the drawn copy of the model: each tile's UVs go into the tile's box; corners shared by two tiles are split */
function udimAtlasMesh(m){if(!p3.ua||!m||!m.uv)return m;const rs=meshGroupByMat(m);
  if(!rs.some(r=>{const B=udimBox(r.name);return B&&B.lay;}))return udimAtlasMeshGrid(m);
  const n=m.verts||m.pos.length/3,tiles=[],tix=new Map(),triT=new Int32Array(m.idx.length/3).fill(-1);
  rs.forEach(r=>{const B=udimBox(r.name);if(!B)return;const L=udimLay(r.name);
    for(let t=r.start;t<r.start+r.count;t++){const a=m.idx[t*3],b=m.idx[t*3+1],c=m.idx[t*3+2],q=udimAddr((m.uv[a*2]+m.uv[b*2]+m.uv[c*2])/3,(m.uv[a*2+1]+m.uv[b*2+1]+m.uv[c*2+1])/3);
      const T=q&&B.tiles.find(x=>x.id===q.id),key=r.name+'|'+(T?T.id:'-');let k=tix.get(key);
      if(k===undefined){k=tiles.length;tix.set(key,k);tiles.push({B,T,R:T?L[T.id]:null});}triT[t]=k;}});
  const NT=tiles.length+1,map=new Map(),src=[],tt=[],idx=new Uint32Array(m.idx.length);
  for(let t=0;t<triT.length;t++)for(let c=0;c<3;c++){const v=m.idx[t*3+c],k=triT[t]<0?NT-1:triT[t],key=v*NT+k;let i=map.get(key);
    if(i===undefined){i=src.length;map.set(key,i);src.push(v);tt.push(k);}idx[t*3+c]=i;}
  const N=src.length,out={};
  for(const key of Object.keys(m)){const a=m[key];if(key==='idx'||!a||!ArrayBuffer.isView(a)||a.length%n)continue;const w=a.length/n;if(w<1||w>4||!Number.isInteger(w))continue;
    if(/^tri/.test(key))continue;const o=new a.constructor(N*w);for(let i=0;i<N;i++)for(let c=0;c<w;c++)o[i*w+c]=a[src[i]*w+c];out[key]=o;}
  const uv=out.uv;
  for(let i=0;i<N;i++){const X=tiles[tt[i]];if(!X)continue;const B=X.B,u=uv[i*2],vf=1-uv[i*2+1];
    if(X.R){const fu=u-X.T.u,fv=vf-X.T.v;uv[i*2]=X.R[0]+fu*X.R[2];uv[i*2+1]=X.R[1]+(1-fv)*X.R[3];}
    else{uv[i*2]=(u-B.x0)/B.nx;uv[i*2+1]=1-(vf-B.y0)/B.ny;}}
  const r=Object.assign({},m,out,{idx,verts:N,udimAtlas:true,udimOf:m});for(const key of Object.keys(r))if(key[0]==='_')delete r[key];return r;}
/* shader side: UDIM_GLSL (in layers/fill-layer.js, loaded first) turns canvas UV into the plain grid; these are its uniforms */
function udimGU(name){const B=name&&udimBox(name);if(!B||!B.lay)return {uUdN:{int:0}};const G=udimGridLay(B),P=new Float32Array(128),Q=new Float32Array(128);let n=0;
  for(const T of B.tiles){if(n>=32)break;const r=B.lay[T.id],g=G[T.id];if(!r||!g)continue;P.set(r,n*4);Q.set(g,n*4);n++;}
  return {uUdN:{int:n},uUdP:{v4a:P},uUdG:{v4a:Q}};}
/* the layout the active set's canvas is in (null = not a set with several UV tiles); kept with every stroke record so a rebuild
   can put old work in its new place */
function udimLayNow(){if(typeof udimImgBox!=='function')return null;const b=udimImgBox();return b?udimLay(b.name):null;}
/* copy a picture from one tile layout into another (any sizes): each tile's box is resampled into its new box */
function udimRemapT(src,dst,from,to){if(!from||!to||udimLayEq(from,to)){p3PaintScale(src,dst);return;}
  clearTarget(dst);
  for(const id of Object.keys(to)){const a=from[id],b=to[id];if(!a)continue;
    const Rd=[Math.round(b[0]*dst.w),Math.round(b[1]*dst.h),Math.round(b[2]*dst.w),Math.round(b[3]*dst.h)],Rs=[a[0]*src.w,a[1]*src.h,a[2]*src.w,a[3]*src.h];
    if(Rd[2]<1||Rd[3]<1)continue;const sc=[Rs[2]/Rd[2],Rs[3]/Rd[3]],taps=Math.min(8,Math.max(1,Math.ceil(Math.max(...sc))));
    scissorDo(Rd,()=>run(P.resample,dst,{uSrc:src.tex,uOffset:[Rd[0]-Rs[0]/sc[0],Rd[1]-Rs[1]/sc[1]],uScale:sc,uTaps:{int:taps},uOutside:[0,0,0,0]}));}}
/* a size change in progress: {from, to: layouts, oldKey: the model's paint key before the tiles moved} (paint-resolution.js) */
let udimRelay=null;
/* set one tile's size (px; 0 or the set's size = follow the set) and rebuild the canvas from the strokes */
const UDIM_TILE_SIZES=[512,1024,2048,4096,8192];
async function udimSetTileSize(name,id,px){const B=udimBox(name);if(!B)return false;const S=p3.sets[p3.cur];
  if(!S||p3Binding(S)!==name){toast('Select that texture set first.');return false;}
  const was=B.size?Object.assign({},B.size):null;B.size=Object.assign({},B.size||{});
  if(!px||px===p3.size)delete B.size[id];else B.size[id]=px;if(!Object.keys(B.size).length)delete B.size;
  const ok=await p3Resize(p3.size);
  if(!ok){if(was)B.size=was;else delete B.size;buildP3Panel();return false;}
  p3.metadataVer=(p3.metadataVer||0)+1;p3Save();buildP3Panel();return true;}
/* a tile's size as painted (px on the canvas) */
function udimTilePx(name,T){const R=udimTileRect(name,T,doc.w,doc.h);return Math.max(R[2],R[3]);}
function udimTileSizeSel(name,T,i){const B=udimBox(name),cur=B&&B.size&&B.size[T.id]||0,sizes=UDIM_TILE_SIZES.filter(s=>s<=udimLim());
  const sel=el('select',{class:'p3tilesz',id:'p3TileSz_'+T.id,'aria-label':'Texture size of UV tile '+T.id,title:'Texture size of UV tile '+T.id+(p3.cur===i?' (painted at '+udimTilePx(name,T)+' px)':'')+'. Changing it rebuilds the set from your strokes.'},
    el('option',{value:'0',text:'Set ('+p3.size+')'}),...sizes.map(s=>el('option',{value:String(s),text:s>=1024?(s/1024)+'K':String(s)})));
  sel.value=String(cur&&sizes.includes(cur)?cur:0);
  sel.onclick=e=>e.stopPropagation();
  sel.onchange=async e=>{e.stopPropagation();const v=+sel.value;if(p3.cur!==i)p3SwitchSet(i,true);sel.blur();await udimSetTileSize(name,T.id,v);};
  return sel;}
