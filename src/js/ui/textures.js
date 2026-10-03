/* ================= Textures panel: grunge maps and textures (0.28) =================
   Kenn: a tab that houses grunge maps and textures anyone can use. Three kinds:
   - Generated: made by the app on the spot, seamless (clouds, cells, cracks, grain, scratches…)
   - Photo grunge: sourced damage textures shipped with the app (CC0: see the guide's Textures page)
   - Yours: pictures you import, kept on this computer; share them as .gtex packs
   Click one for what to do with it: a picture row in the mask, a material channel, a new layer, a stencil, a brush tip. */
const TX_GEN=[['clouds','Clouds'],['cells','Cells'],['cracks','Cracks'],['grain','Grain'],['ridges','Ridges'],['streaks','Streaks (noise)'],['scratchy','Fine scratches'],['blotches','Blotches'],['dots','Dots'],['weave','Weave'],['bricks','Bricks'],['pits','Pits'],['twill','Fabric · Twill'],['herringbone','Fabric · Herringbone'],['knit','Fabric · Knit'],['basket','Fabric · Basket weave'],['checker','Pattern · Checkerboard'],['chevron','Pattern · Chevron'],['hexagons','Pattern · Hexagons'],['scales','Pattern · Scales']];
const TX_PHOTO=[['streaks','Streaks'],['rings','Water rings'],['specks','Specks'],['stains','Stains'],['drips','Drips'],['splotches','Splotches'],['spatter','Spatter'],['scratches','Scratches'],['dirt','Dirt'],['dust','Dust'],['fingerprints','Fingerprints'],['smears','Smears'],['leaks','Leak streaks'],
  ['circles','Circles'],['scattered-rings','Scattered rings'],['chips','Chips'],['grime','Grime'],['fine-grime','Fine grime'],['speckle','Speckle'],['micro-scratches','Micro scratches'],['faint-marks','Faint marks'],
  ['prints','Prints'],['prints-2','Prints 2'],['hand-print','Hand print'],['thumb-prints','Thumb prints'],['smudges','Smudges'],['greasy-prints','Greasy prints'],['print-smears','Print smears'],['oily-marks','Oily marks'],
  ['wipe','Wipe'],['brush-smears','Brush smears'],['streaky-wipes','Streaky wipes'],['swipes','Swipes'],
  ['leaks-2','Leaks 2'],['leaks-3','Leaks 3'],['leaks-4','Leaks 4'],['leaks-5','Leaks 5'],['leaks-6','Leaks 6'],['leaks-7','Leaks 7'],['leaks-8','Leaks 8'],
  ['brushed-scratches','Brushed scratches'],['tangled-scratches','Tangled scratches'],['light-scratches','Light scratches'],['fine-brushed-lines','Fine brushed lines'],['hairline-scratches','Hairline scratches'],['ink-smears','Ink smears'],['greasy-swirls','Greasy swirls'],['bubble-stains','Bubble stains'],['foggy-blotches','Foggy blotches'],
  ['runs-1','Runs 1'],['runs-2','Runs 2'],['runs-3','Runs 3'],['runs-4','Runs 4'],['runs-5','Runs 5'],['runs-6','Runs 6'],['runs-7','Runs 7'],['runs-8','Runs 8'],
  ['cracks-1','Cracks 1'],['cracks-2','Cracks 2'],['cracks-3','Cracks 3'],['crazed-cracks','Crazed cracks'],['dry-cracks','Dry cracks'],['cracked-plates','Cracked plates'],['broken-plates','Broken plates'],
  ['rust-pits-1','Rust pits 1'],['rust-pits-2','Rust pits 2'],['rust-pits-3','Rust pits 3'],['rust-pits-4','Rust pits 4'],['rust-pits-5','Rust pits 5'],['rust-pits-6','Rust pits 6'],['rust-pits-7','Rust pits 7'],
  ['worn-paint-1','Worn paint 1'],['worn-paint-2','Worn paint 2'],['worn-paint-3','Worn paint 3'],['frost-veins','Frost veins']];
TX_PHOTO.push(...TX_WORKSHOP.map(r=>[r.slug,r.name,r.category]));
const tx={category:(()=>{try{return localStorage.getItem('gs.txCategory')||'all';}catch(e){return 'all';}})(),query:'',show:(()=>{try{return localStorage.getItem('gs.txShow')||'all';}catch(e){return 'all';}})(),size:(()=>{try{return localStorage.getItem('gs.txSize')||'m';}catch(e){return 'm';}})(),mine:[],loaded:false,loading:null,cache:new Map(),used:new Map(),pending:new Map(),pins:new Map(),owners:new WeakMap(),thumbs:new Map(),thumbPending:new Map(),thumbQueue:[],thumbJobs:0,cacheTimer:0,cacheLimit:128*1024*1024,cacheCount:16,stats:{loads:0,unpacks:0,previews:0,coalesced:0}};
/* seamless grey patterns: periodic noise so every one tiles */
const FS_TXGEN=`uniform int uKind; uniform float uSeed; uniform vec2 uOut; uniform vec2 uPhase;
float hs(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+uSeed*13.17)*43758.5453); }
vec2 hs2(vec2 p){ return vec2(hs(p),hs(p+vec2(19.3,7.9))); }
float vn(vec2 p,float P){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hs(mod(i,P)),hs(mod(i+vec2(1,0),P)),f.x),mix(hs(mod(i+vec2(0,1),P)),hs(mod(i+vec2(1,1),P)),f.x),f.y); }
float fbm(vec2 p,float P){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*vn(p,P); p*=2.0; P*=2.0; a*=0.5; } return v/0.984; }
vec3 vor(vec2 p,float P){ vec2 i=floor(p),f=fract(p); float d1=9.0,d2=9.0; float id=0.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y),c=mod(i+g,P); vec2 o=hs2(c); float d=length(g+o-f); if(d<d1){ d2=d1; d1=d; id=hs(c+3.1); } else if(d<d2) d2=d; }
  return vec3(d1,d2,id); }
void main(){ vec2 uv=gl_FragCoord.xy/uOut+uPhase; float v=0.0;
  if(uKind==0) v=fbm(uv*4.0,4.0);
  else if(uKind==1){ vec3 c=vor(uv*8.0,8.0); v=1.0-smoothstep(0.0,0.9,c.x); }
  else if(uKind==2){ vec3 c=vor(uv*6.0+vec2(fbm(uv*8.0,8.0)*0.4),6.0); v=1.0-smoothstep(0.0,0.06,c.y-c.x); }
  else if(uKind==3) v=hs(floor(gl_FragCoord.xy))*0.6+fbm(uv*32.0,32.0)*0.4;
  else if(uKind==4) v=1.0-abs(fbm(uv*3.0,3.0)*2.0-1.0);
  else if(uKind==5) v=fbm(vec2(uv.x*24.0,uv.y*2.0),24.0)*0.7+fbm(uv*8.0,8.0)*0.3;
  else if(uKind==6){ float s=0.0; for(int k=0;k<5;k++){ float a=float(k)*1.3+uSeed; vec2 q=vec2(cos(a),sin(a)); float t=fract(dot(uv,vec2(-q.y,q.x))*float(40+k*13)); float n=fbm(uv*vec2(4.0)+float(k),4.0);
      s=max(s,smoothstep(0.93,1.0,1.0-abs(t*2.0-1.0))*smoothstep(0.55,0.7,n)); } v=s; }
  else if(uKind==7) v=smoothstep(0.45,0.62,fbm(uv*5.0,5.0));
  else if(uKind==8){ vec2 g=uv*24.0; vec2 f=fract(g)-0.5; v=1.0-smoothstep(0.25,0.32,length(f)); }
  else if(uKind==9){ vec2 g=uv*32.0; float a=sin(g.x*3.14159),b=sin(g.y*3.14159); float over=mod(floor(g.x)+floor(g.y),2.0); v=0.5+0.5*(over>0.5?abs(a):abs(b))*(0.8+0.2*fbm(uv*16.0,16.0)); }
  else if(uKind==10){ vec2 g=uv*vec2(8.0,16.0); g.x+=mod(floor(g.y),2.0)*0.5; vec2 f=fract(g); float e=min(min(f.x,1.0-f.x)*2.0,min(f.y,1.0-f.y)*4.0); v=smoothstep(0.02,0.12,e)*(0.75+0.25*hs(mod(floor(g),vec2(8.0,16.0)))); }
  else if(uKind==11){ vec3 c=vor(uv*16.0,16.0); v=(1.0-smoothstep(0.1,0.35,c.x))*step(0.55,c.z)*(0.6+0.4*fbm(uv*16.0,16.0)); }
  else if(uKind==12||uKind==13||uKind==15){vec2 g=uv*32.0,i=floor(g),f=fract(g);float ix=mod(i.x,32.0);ix=uKind==13?mix(ix,31.0-ix,step(16.0,ix)):i.x;float over=uKind==15?step(1.0,mod(floor(i.x/2.0)+floor(i.y/2.0),2.0)):step(1.0,mod(ix+i.y,4.0));float a=sin(f.x*3.14159265),b=sin(f.y*3.14159265);float fiber=.9+.1*cos((over>.5?f.y:f.x)*18.8495559);v=.15+.8*mix(a,b,over)*fiber;}
  else if(uKind==14){vec2 g=uv*vec2(16.0,24.0);g.x+=mod(floor(g.y),2.0)*.5;vec2 f=fract(g)-.5;float y=f.y+.15;float d=min(abs(f.x-y*.45-.16),abs(f.x+y*.45+.16));v=(1.0-smoothstep(.07,.14,d))*(.65+.35*cos(f.y*3.14159265));}
  else if(uKind==16)v=mod(floor(uv.x*16.0)+floor(uv.y*16.0),2.0);
  else if(uKind==17){float x=abs(fract(uv.x*8.0)*2.0-1.0);v=step(.5,fract(uv.y*8.0+x*.5));}
  else if(uKind==18){vec2 g=uv*vec2(12.0,13.85640646);vec2 a=mod(g,vec2(1.0,1.73205))-.5*vec2(1.0,1.73205),b=mod(g-vec2(.5,.866025),vec2(1.0,1.73205))-.5*vec2(1.0,1.73205);vec2 f=dot(a,a)<dot(b,b)?a:b;float d=max(abs(f.x),dot(abs(f),vec2(.5,.866025)));v=1.0-smoothstep(.42,.47,d);}
  else {vec2 g=uv*vec2(12.0,16.0);g.x+=mod(floor(g.y),2.0)*.5;vec2 f=fract(g)-vec2(.5,0.0);float d=length(f);v=1.0-smoothstep(.47,.5,d);}
  v=clamp(v,0.0,1.0); o=vec4(v,v,v,1.0); }`;
let P_TXGEN=null;
function txGenTarget(k,S,phase){if(!P_TXGEN)P_TXGEN=program(FS_TXGEN);const i=TX_GEN.findIndex(g=>g[0]===k),t=makeTarget(S,S,8,true);run(P_TXGEN,t,{uKind:{int:i},uSeed:1,uOut:[S,S],uPhase:phase||[0,0]});setWrap(t,true);return t;}
/* the shipped photo grunge: files next to the desktop app, or inside the page for the web version */
async function txPhotoBytes(slug){const tag=document.getElementById('gr_'+slug);if(tag){const b=atob(tag.textContent.trim()),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
  const r=await fetch('grunge/'+slug+'.webp');if(!r.ok)throw new Error('missing');return new Uint8Array(await r.arrayBuffer());}
async function bitmapTarget(bm){const c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;c.getContext('2d').drawImage(bm,0,0);
  const tex=uploadStraight({el:c,w:c.width,h:c.height}),t=makeTarget(c.width,c.height,8,true);premultInto(t,tex,[0,0],null);gl.deleteTexture(tex);setWrap(t,true);return t;}
/* The shelf owns borrowed originals. Layers/masks/stencils copy them. Live picture guides
   pin their original through weak references, including guides retained by undo. */
function txCacheGet(key){const t=tx.cache.get(key);if(t&&t.tex){tx.used.set(key,performance.now());return t;}return null;}
function txCachePin(g){const key=g.kind+':'+g.id;if(tx.owners.get(g)===key)return;tx.owners.set(g,key);let refs=tx.pins.get(key);if(!refs)tx.pins.set(key,refs=new Set());refs.add(new WeakRef(g));}
function txCachePinned(key){const refs=tx.pins.get(key);if(!refs)return false;for(const r of refs){const g=r.deref();if(!g||g.kind+':'+g.id!==key)refs.delete(r);}if(!refs.size)tx.pins.delete(key);return !!refs.size;}
function txCacheDrop(key){if(txCachePinned(key))return;const t=tx.cache.get(key);tx.cache.delete(key);tx.used.delete(key);if(t&&![...tx.cache.values()].includes(t))disposeTarget(t);}
function txCacheTrim(now=performance.now()){let bytes=0;for(const t of new Set(tx.cache.values()))bytes+=gpuBytes(t);
  const keys=[...tx.cache.keys()].sort((a,b)=>(tx.used.get(a)||0)-(tx.used.get(b)||0));
  for(const key of keys){if(txCachePinned(key))continue;if(bytes<=tx.cacheLimit&&tx.cache.size<=tx.cacheCount&&now-(tx.used.get(key)||0)<10000)continue;
    const t=tx.cache.get(key);txCacheDrop(key);if(![...tx.cache.values()].includes(t))bytes-=gpuBytes(t);}
  for(const key of tx.pins.keys())txCachePinned(key);
  if(tx.cache.size&&!tx.cacheTimer)tx.cacheTimer=setTimeout(()=>{tx.cacheTimer=0;txCacheTrim();},10000);}
function txCacheKeep(key,t){tx.cache.set(key,t);tx.used.set(key,performance.now());
  /* All promise consumers get to copy/use the borrowed result before eviction. */
  if(tx.cacheTimer)clearTimeout(tx.cacheTimer);tx.cacheTimer=setTimeout(()=>{tx.cacheTimer=0;txCacheTrim();},0);return t;}
async function txRead(rec){if(rec.data)return rec;const raw=await store.getRaw(rec.id,'textures');if(!raw)throw new Error('This texture is no longer in the library.');tx.stats.unpacks++;const full=await pxDeep(raw,false);
  if(!(full.data instanceof Uint8Array)||full.data.length!==full.w*full.h*4)throw new Error('The saved texture could not be read.');return full;}
async function txTarget(it){const key=it.kind+':'+it.id,cached=txCacheGet(key);if(cached)return cached;
  if(tx.pending.has(key)){tx.stats.coalesced++;return tx.pending.get(key);}
  const job=(async()=>{let t;tx.stats.loads++;
    if(it.kind==='gen')t=txGenTarget(it.id,1024);
    else if(it.kind==='photo'){const bm=await createImageBitmap(new Blob([await txPhotoBytes(it.id)],{type:'image/webp'}));try{t=await bitmapTarget(bm);}finally{bm.close();}}
    else{const rec=await txRead(it.rec||{id:it.id});t=makeTarget(rec.w,rec.h,8,true);writeRegion(t,0,0,rec.w,rec.h,rec.data);setWrap(t,true);}
    return txCacheKeep(key,t);})();tx.pending.set(key,job);try{return await job;}finally{tx.pending.delete(key);}}
function txCopy(t){const c=makeTarget(t.w,t.h,8,true);blit(t,c,0,0,t.w,t.h,0,0);setWrap(c,true);return c;}
/* thumbnails */
function txThumbOf(t){const S=72,s=makeTarget(S,S,8,false);copyScaled(t,s);const d=captureRegionNow(s,0,0,S,S).data;disposeTarget(s);
  const c=document.createElement('canvas');c.width=c.height=S;const id=c.getContext('2d').createImageData(S,S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const i=(y*S+x)*4,a=d[i+3]||1;id.data[i]=d[i]*255/a;id.data[i+1]=d[i+1]*255/a;id.data[i+2]=d[i+2]*255/a;id.data[i+3]=255;}
  c.getContext('2d').putImageData(id,0,0);return c.toDataURL('image/png');}
/* The app's texture row zero is the top of the painting (VS_VIEW flips screen Y).
   Sample premultiplied pixels straight into a tiny canvas, without a full-size upload. */
function txThumbPixels(rec){const S=96,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),im=x.createImageData(S,S),d=rec.data;
  for(let y=0;y<S;y++)for(let i=0;i<S;i++){const sx=Math.min(rec.w-1,Math.floor((i+.5)*rec.w/S)),sy=Math.min(rec.h-1,Math.floor((y+.5)*rec.h/S)),a=(sy*rec.w+sx)*4,b=(y*S+i)*4,f=d[a+3]?255/d[a+3]:0;
    im.data[b]=d[a]*f;im.data[b+1]=d[a+1]*f;im.data[b+2]=d[a+2]*f;im.data[b+3]=255;}
  x.putImageData(im,0,0);return c.toDataURL('image/png');}
function txMeta(rec){return {id:rec.id,name:rec.name,t:rec.t,w:rec.w,h:rec.h,category:rec.category,thumb:rec.thumb||''};}
async function txSaveThumb(rec,u){/* Update only a record that still exists; never resurrect a deleted texture. */
  await store.tx('readwrite',st=>{const r=st.get(rec.id);r.onsuccess=()=>{const old=r.result;if(old&&old.t===rec.t&&!old.thumb)st.put(Object.assign(old,{thumb:u}));};return r;},'textures');}
async function txMakeThumb(it){tx.stats.previews++;if(it.kind==='photo'){
    if(TX_PREVIEWS[it.id])return TX_PREVIEWS[it.id];
    const bm=await createImageBitmap(new Blob([await txPhotoBytes(it.id)],{type:'image/webp'}),{resizeWidth:96,resizeHeight:96,resizeQuality:'high'});
    try{const c=document.createElement('canvas');c.width=c.height=96;c.getContext('2d').drawImage(bm,0,0);return c.toDataURL('image/png');}finally{bm.close();}}
  if(it.kind==='gen'){const t=txGenTarget(it.id,144);try{return txThumbOf(t);}finally{disposeTarget(t);}}
  if(it.rec.thumb)return it.rec.thumb;const full=await txRead(it.rec),u=txThumbPixels(full);it.rec.thumb=u;txSaveThumb(it.rec,u).catch(()=>{});return u;}
function txPumpThumbs(){while(tx.thumbJobs<2&&tx.thumbQueue.length){const j=tx.thumbQueue.shift();
    if(!j.waiters.some(img=>img.isConnected&&!img._txCancelled)){tx.thumbPending.delete(j.key);j.resolve(null);continue;}
    tx.thumbJobs++;txMakeThumb(j.it).then(u=>{tx.thumbs.set(j.key,u);j.resolve(u);},j.reject).finally(()=>{tx.thumbPending.delete(j.key);tx.thumbJobs--;setTimeout(txPumpThumbs,0);});}}
async function txThumb(it,img){const key=it.kind+':'+it.id;try{let u=tx.thumbs.get(key);if(!u){let j=tx.thumbPending.get(key);if(!j){j={key,it,waiters:[]};j.promise=new Promise((resolve,reject)=>Object.assign(j,{resolve,reject}));tx.thumbPending.set(key,j);tx.thumbQueue.push(j);}j.waiters.push(img);txPumpThumbs();u=await j.promise;}
    if(u&&img.isConnected&&!img._txCancelled&&img._tx===it)img.src=u;}catch(e){if(img.isConnected&&!img._txCancelled)img.alt='?';}}
/* your own textures (IndexedDB store 'textures', pictures packed) */
async function txLoad(){if(tx.loading)return tx.loading;if(tx.loaded)return;tx.loading=(async()=>{try{tx.mine=(await store.scanRaw('textures',r=>!r.decal?txMeta(r):undefined)).sort((a,b)=>(a.t||0)-(b.t||0));}catch(e){tx.mine=[];}tx.loaded=true;renderTextures();})();try{return await tx.loading;}finally{tx.loading=null;}}
async function txAddTarget(t,name){/* Own a borrowed input before packing yields and the cache can trim it. */
  const borrowed=[...tx.cache.values()].includes(t),owned=borrowed?txCopy(t):t;let kept=false;try{await txLoad();const rec={id:'t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,t:Date.now(),w:owned.w,h:owned.h,data:captureRegionNow(owned,0,0,owned.w,owned.h).data};rec.thumb=txThumbPixels(rec);
  const packed=await pxDeep(rec,true);await store.tx('readwrite',st=>st.put(packed),'textures');const meta=txMeta(rec);tx.mine.push(meta);tx.thumbs.set('mine:'+rec.id,rec.thumb);
  txCacheKeep('mine:'+rec.id,owned);kept=true;return meta;}finally{if(borrowed&&!kept)disposeTarget(owned);}}
async function txImport(){const fs=await pickFiles('image/*,.gtex',true,'Textures and texture packs',['png','jpg','jpeg','webp','tga','tif','tiff','bmp','psd','gtex']);let n=0;
  for(const f of fs){try{if(/\.gtex$/i.test(f.name)){const j=await gmatParse(f);for(const it of j.items||[]){const bm=await createImageBitmap(await (await fetch(it.img)).blob());let t;try{t=await bitmapTarget(bm);}finally{bm.close();}try{await txAddTarget(t,it.name||'Texture');}catch(e){disposeTarget(t);throw e;}n++;}}
      else{const t=await fileTarget(f);setWrap(t,true);try{await txAddTarget(t,baseName(f.name));}catch(e){disposeTarget(t);throw e;}n++;}}catch(e){toast('Could not read '+f.name+': '+(e.message||e));}}
  if(n){tx.show=tx.show==='gen'||tx.show==='photo'?'mine':tx.show;renderTextures();toast('Added '+n+' texture'+(n>1?'s':'')+' to Textures › Yours.');}}
/* a pack: every texture of yours in one file to share */
async function txExportPack(){if(!tx.mine.length){toast('Import some textures first: the pack holds yours.');return;}
  const items=[];for(const meta of tx.mine){const rec=await txRead(meta),c=document.createElement('canvas');c.width=rec.w;c.height=rec.h;const id=c.getContext('2d').createImageData(rec.w,rec.h),d=rec.data;
    for(let i=0;i<d.length;i+=4){const a=d[i+3]||1;id.data[i]=Math.min(255,d[i]*255/a);id.data[i+1]=Math.min(255,d[i+1]*255/a);id.data[i+2]=Math.min(255,d[i+2]*255/a);id.data[i+3]=d[i+3];}
    c.getContext('2d').putImageData(id,0,0);items.push({name:rec.name,img:pxDataURL(c,'base')});}
  const r=await deliver('textures.gtex',await gmatBlob({app:'Gouache Studio',kind:'textures',v:1,items}));toast(deliveredText(r,'Texture pack ('+items.length+')'));}
function txDelete(rec){confirmDlg('Delete texture','Delete “'+rec.name+'” from Textures? Layers that use it keep it.','Delete',()=>{const i=tx.mine.indexOf(rec);if(i>=0)tx.mine.splice(i,1);
  txCacheDrop('mine:'+rec.id);tx.thumbs.delete('mine:'+rec.id);store.del(rec.id,'textures');renderTextures();});}
/* ---- the uses ---- */
async function txToMask(it){const L=doc.active;if(!isLayer(L)&&!(L&&L.type==='group')){toast('Select a layer first: the texture goes into its mask.');return;}
  const t=txCopy(await txTarget(it)),r=msAdd(L,'image',{p:{name:it.name}},'Add '+it.name.toLowerCase()+' to the mask');if(!r){disposeTarget(t);return;}
  msEdit(L,r,x=>{x.t=t;x.p.name=it.name;});(L.mask._rows||(L.mask._rows=new Set())).add(r);if(typeof msCommit==='function')msCommit();if(ui.mode==='paint')msSelect(L,'m',r.id);renderLayers();if(typeof renderMatEd==='function')renderMatEd(true);
  toast('Added “'+it.name+'” to the mask of “'+L.name+'”. Its settings (size, turn, invert) are in Properties.');}
const TX_CHANNELS=[['base','Base colour'],['rough','Roughness'],['metal','Metallic'],['height','Height'],['ao','Ambient occlusion'],['emis','Emissive'],['opac','Opacity']];
async function txToChannel(it,k){const L=doc.active;if(!isLayer(L)||!L.fill){toast('Select a material layer first.');return;}
  const t=txCopy(await txTarget(it));matEdBegin(L);const s=L.fill.maps[k]||(L.fill.maps[k]={on:true,src:'value',v:.5,tile:1});
  const old=L._fillImg&&L._fillImg[k];L._fillImg=Object.assign({},L._fillImg||{});L._fillImg[k]=t;s.src='image';s.name=it.name;s.on=true;fillRender(L,k);matEdCommit();
  if(old&&!Object.values(L._fillImg).includes(old)){/* kept by undo */}
  renderLayers();if(typeof renderMatEd==='function')renderMatEd(true);toast('“'+it.name+'” is now the '+(TX_CHANNELS.find(c=>c[0]===k)||[0,k])[1].toLowerCase()+' of “'+L.name+'”.');}
const FS_TXLAYER=`uniform sampler2D uSrc; uniform vec2 uDoc; uniform float uScale;
void main(){ vec2 sz=vec2(textureSize(uSrc,0)); vec2 uv=gl_FragCoord.xy/(sz*uScale); o=texture(uSrc,uv); }`;
let P_TXLAYER=null;
async function txToLayer(it,at){if(ui.mode!=='paint'&&ui.mode!=='p3d'){toast('Switch to Paint or 3D Paint first.');return;}
  const src=await txTarget(it);if(!P_TXLAYER)P_TXLAYER=program(FS_TXLAYER);
  const A=doc.active,parent=at?at.parent:A?(A.parent||doc.root):doc.root,idx=at?at.index:A?parent.children.indexOf(A)+1:doc.root.children.length,L=newLayerObj(it.name);
  const sc=Math.max(doc.w,doc.h)/Math.max(src.w,src.h);run(P_TXLAYER,mapT(L,'base'),{uSrc:src.tex,uDoc:[doc.w,doc.h],uScale:sc});
  if(doc.map!=='base'&&L.maps[doc.map]){run(P_TXLAYER,L.maps[doc.map],{uSrc:src.tex,uDoc:[doc.w,doc.h],uScale:sc});}
  structOp('New layer from '+it.name.toLowerCase(),()=>{insertNode(L,parent,idx);selectOnly(L);});changedAll();toast('Added the layer “'+it.name+'”. Try a blend mode such as Multiply or Overlay.');}
async function txToStencil(it){if(ui.mode!=='p3d'){toast('Stencils are in 3D Paint.');return;}st3Use(txCopy(await txTarget(it)),it.name);if(st3.mode==='off')st3.mode='mask';if(typeof buildP3Panel==='function')buildP3Panel();
  if(typeof showPanel==='function')showPanel('stencils');toast('“'+it.name+'” is the stencil. S + drag moves it over the model.');}
async function txToTip(it){const t=await txTarget(it),S=Math.min(512,t.w),s=makeTarget(S,S,8,false);copyScaled(t,s);const d=captureRegionNow(s,0,0,S,S).data;disposeTarget(s);
  const v=new Uint8Array(S*S);for(let i=0;i<S*S;i++)v[i]=Math.round(d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11);
  const p=addCustomTip(it.name+' tip',S,S,v);if(!p){toast('This texture is too dark to make a brush tip from.');return;}toast('Made the brush tip “'+p.name+'”: it is in Custom tips and selected.');}
function txMenu(e,it){const pop=$('#menuPop');closeMenu();const L=doc.active,hasL=isLayer(L)||(L&&L.type==='group'),mat=isLayer(L)&&!!L.fill;
  const item=(t,f,dis,tip)=>el('button',{class:'mi',role:'menuitem',disabled:!!dis,title:tip||'',onclick:()=>{pop.hidden=true;f();}},el('span'),el('span',{text:t}),el('span'));
  pop.replaceChildren(el('div',{class:'mh',text:it.name}),
    item('Add to the mask (picture row)',()=>txToMask(it),!hasL,'Select a layer first'),
    ...(mat?[el('div',{class:'mh',text:'Material channel'}),...TX_CHANNELS.map(([k,l])=>item(l,()=>txToChannel(it,k)))]:[item('Material channel…',()=>{},true,'Select a material layer first')]),
    el('div',{class:'msep'}),item('New layer',()=>txToLayer(it)),item('Stencil (3D Paint)',()=>txToStencil(it),ui.mode!=='p3d','Stencils are in 3D Paint'),item('Brush tip',()=>txToTip(it)),
    ...(it.kind==='mine'?[el('div',{class:'msep'}),item('Delete…',()=>txDelete(it.rec))]:[]));
  pop.hidden=false;pop.style.left=Math.min(e.clientX,innerWidth-pop.offsetWidth-8)+'px';pop.style.top=Math.min(e.clientY+4,innerHeight-pop.offsetHeight-8)+'px';
  const off=ev=>{if(!pop.contains(ev.target)){pop.hidden=true;document.removeEventListener('pointerdown',off,true);}};setTimeout(()=>document.addEventListener('pointerdown',off,true),0);}
const TX_CATEGORIES=['Scratches','Grunge','Fabric','Patterns'];
function txCategory(id,name,category){return category||(/scratch|abrasion|brushed|hairline|scuff|gouge|tool scar/i.test(name)?'Scratches':/fabric|weave|twill|herringbone|knit|basket/i.test(name)?'Fabric':/pattern|dots|bricks/i.test(name)?'Patterns':'Grunge');}
function txItems(){const g=TX_GEN.map(([id,name])=>({kind:'gen',id,name,category:txCategory(id,name)})),p=TX_PHOTO.map(([id,name,category])=>({kind:'photo',id,name,category:txCategory(id,name,category)})),m=tx.mine.map(rec=>({kind:'mine',id:rec.id,name:rec.name,category:txCategory(rec.id,rec.name,rec.category),rec}));
  const items=tx.show==='gen'?g:tx.show==='photo'?p:tx.show==='mine'?m:[...m,...p,...g];return items.filter(it=>(tx.category==='all'||it.category===tx.category)&&it.name.toLowerCase().includes(tx.query.trim().toLowerCase()));}
/* thumbnails are made when a tile comes into view (the panel may be hidden) */
const txObserved=new Set();
function txObserve(img){txObserved.add(img);txSeen.observe(img);}
function txForget(root){for(const img of root.querySelectorAll('img')){img._txCancelled=true;txSeen.unobserve(img);txObserved.delete(img);}}
function txPruneObserved(){for(const img of txObserved)if(!img.isConnected){txSeen.unobserve(img);txObserved.delete(img);}}
const txSeen=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){txSeen.unobserve(e.target);txObserved.delete(e.target);if(e.target.isConnected)txThumb(e.target._tx,e.target);}});
function renderTextures(){const box=$('#txBody');if(!box)return;if(!tx.loaded){txLoad();}const tw=MT_SIZES[tx.size]||64;box.style.setProperty('--tw',tw+'px');
  const tile=it=>{const img=el('img',{alt:'',width:72,height:72,draggable:'false'});img._tx=it;txObserve(img);const b=el('button',{class:'mattile txtile',title:it.name+' (click: new layer. Right-click: more uses. Drag onto the layers)',id:'tx_'+it.kind+'_'+it.id,onclick:()=>txToLayer(it),oncontextmenu:e=>{e.preventDefault();txMenu(e,it);}},img,el('span',{text:it.name}));b._libDrag=['tex',it];return b;};
  const items=txItems();
  const category=el('select',{id:'txCategory','aria-label':'Texture category'},el('option',{value:'all',text:'All categories'}),...TX_CATEGORIES.map(k=>el('option',{value:k,text:k})));category.value=tx.category;category.addEventListener('change',()=>{tx.category=category.value;try{localStorage.setItem('gs.txCategory',tx.category);}catch(e){}renderTextures();});
  const search=el('input',{type:'search',id:'txSearch',placeholder:'Search textures','aria-label':'Search textures',value:tx.query});search.addEventListener('input',()=>{tx.query=search.value;const start=search.selectionStart;renderTextures();const next=$('#txSearch');next.focus();try{next.setSelectionRange(start,start);}catch(e){}});
  box.replaceChildren(segChips([['all','All'],['mine','Yours'],['photo','Photo grunge'],['gen','Generated']],()=>tx.show,v=>{tx.show=v;try{localStorage.setItem('gs.txShow',v);}catch(e){}renderTextures();}),
    el('div',{class:'row wrap'},category,search),el('p',{class:'note',text:items.length+' textures'}),
    el('div',{class:'chips'},el('button',{class:'btn sm',id:'txFromCanvas',text:'From canvas…',title:'Turn the Paint canvas or the selection into a texture',onclick:()=>{if(ui.mode==='paint')dlgToTexture();else toast('Switch to the Paint tab first.');}}),el('button',{class:'btn sm',id:'txImport',text:'Import…',title:'Pictures, or a .gtex texture pack',onclick:txImport}),el('button',{class:'btn sm',id:'txExport',text:'Export pack…',title:'All your textures in one .gtex file to share',onclick:txExportPack}),el('div',{class:'seg matsize',role:'radiogroup','aria-label':'Texture thumbnail size'},...['s','m','l'].map(k=>el('button',{id:'txSize_'+k,type:'button',role:'radio','aria-checked':String(tx.size===k),text:k.toUpperCase(),class:tx.size===k?'on':'',onclick:()=>{tx.size=k;try{localStorage.setItem('gs.txSize',k);}catch(e){}renderTextures();}})))),
    items.length?el('div',{class:'matgrid',id:'txGrid'},...items.map(tile)):el('p',{class:'note',text:'No textures match these filters. Choose All categories or clear the search.'}),
    el('p',{class:'note',text:'Click a texture for what to do with it. Sources: ambientCG, Poly Haven, Public Domain Pictures and OpenGameArt (CC0).'}));txPruneObserved();}
