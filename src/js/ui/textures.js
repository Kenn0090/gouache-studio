/* ================= Textures panel: grunge maps and textures (0.28) =================
   Kenn: a tab that houses grunge maps and textures anyone can use. Three kinds:
   - Generated: made by the app on the spot, seamless (clouds, cells, cracks, grain, scratches…)
   - Photo grunge: real scans shipped with the app (ambientCG, CC0: see the guide's Textures page)
   - Yours: pictures you import, kept on this computer; share them as .gtex packs
   Click one for what to do with it: a picture row in the mask, a material channel, a new layer, a stencil, a brush tip. */
const TX_GEN=[['clouds','Clouds'],['cells','Cells'],['cracks','Cracks'],['grain','Grain'],['ridges','Ridges'],['streaks','Streaks (noise)'],['scratchy','Fine scratches'],['blotches','Blotches'],['dots','Dots'],['weave','Weave'],['bricks','Bricks'],['pits','Pits']];
const TX_PHOTO=[['streaks','Streaks'],['rings','Water rings'],['specks','Specks'],['stains','Stains'],['drips','Drips'],['splotches','Splotches'],['spatter','Spatter'],['scratches','Scratches'],['dirt','Dirt'],['dust','Dust'],['fingerprints','Fingerprints'],['smears','Smears'],['leaks','Leak streaks'],
  ['circles','Circles'],['scattered-rings','Scattered rings'],['chips','Chips'],['grime','Grime'],['fine-grime','Fine grime'],['speckle','Speckle'],['micro-scratches','Micro scratches'],['faint-marks','Faint marks'],
  ['prints','Prints'],['prints-2','Prints 2'],['hand-print','Hand print'],['thumb-prints','Thumb prints'],['smudges','Smudges'],['greasy-prints','Greasy prints'],['print-smears','Print smears'],['oily-marks','Oily marks'],
  ['wipe','Wipe'],['brush-smears','Brush smears'],['streaky-wipes','Streaky wipes'],['swipes','Swipes'],
  ['leaks-2','Leaks 2'],['leaks-3','Leaks 3'],['leaks-4','Leaks 4'],['leaks-5','Leaks 5'],['leaks-6','Leaks 6'],['leaks-7','Leaks 7'],['leaks-8','Leaks 8']];
const tx={show:(()=>{try{return localStorage.getItem('gs.txShow')||'all';}catch(e){return 'all';}})(),mine:[],loaded:false,cache:new Map(),thumbs:new Map()};
/* seamless grey patterns: periodic noise so every one tiles */
const FS_TXGEN=`uniform int uKind; uniform float uSeed; uniform vec2 uOut;
float hs(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+uSeed*13.17)*43758.5453); }
vec2 hs2(vec2 p){ return vec2(hs(p),hs(p+vec2(19.3,7.9))); }
float vn(vec2 p,float P){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hs(mod(i,P)),hs(mod(i+vec2(1,0),P)),f.x),mix(hs(mod(i+vec2(0,1),P)),hs(mod(i+vec2(1,1),P)),f.x),f.y); }
float fbm(vec2 p,float P){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*vn(p,P); p*=2.0; P*=2.0; a*=0.5; } return v/0.984; }
vec3 vor(vec2 p,float P){ vec2 i=floor(p),f=fract(p); float d1=9.0,d2=9.0; float id=0.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y),c=mod(i+g,P); vec2 o=hs2(c); float d=length(g+o-f); if(d<d1){ d2=d1; d1=d; id=hs(c+3.1); } else if(d<d2) d2=d; }
  return vec3(d1,d2,id); }
void main(){ vec2 uv=gl_FragCoord.xy/uOut; float v=0.0;
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
  else { vec3 c=vor(uv*16.0,16.0); v=smoothstep(0.35,0.1,c.x)*step(0.55,c.z)*(0.6+0.4*fbm(uv*16.0,16.0)); }
  v=clamp(v,0.0,1.0); o=vec4(v,v,v,1.0); }`;
let P_TXGEN=null;
function txGenTarget(k,S){if(!P_TXGEN)P_TXGEN=program(FS_TXGEN);const i=TX_GEN.findIndex(g=>g[0]===k),t=makeTarget(S,S,8,true);run(P_TXGEN,t,{uKind:{int:i},uSeed:1,uOut:[S,S]});setWrap(t,true);return t;}
/* the shipped photo grunge: files next to the desktop app, or inside the page for the web version */
async function txPhotoBytes(slug){const tag=document.getElementById('gr_'+slug);if(tag){const b=atob(tag.textContent.trim()),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
  const r=await fetch('grunge/'+slug+'.webp');if(!r.ok)throw new Error('missing');return new Uint8Array(await r.arrayBuffer());}
async function bitmapTarget(bm){const c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;c.getContext('2d').drawImage(bm,0,0);
  const tex=uploadStraight({el:c,w:c.width,h:c.height}),t=makeTarget(c.width,c.height,8,true);premultInto(t,tex,[0,0],null);gl.deleteTexture(tex);setWrap(t,true);return t;}
/* a texture as a target (kept while the app runs) */
async function txTarget(it){const key=it.kind+':'+it.id;let t=tx.cache.get(key);if(t)return t;
  if(it.kind==='gen')t=txGenTarget(it.id,1024);
  else if(it.kind==='photo')t=await bitmapTarget(await createImageBitmap(new Blob([await txPhotoBytes(it.id)],{type:'image/webp'})));
  else{t=makeTarget(it.rec.w,it.rec.h,8,true);writeRegion(t,0,0,it.rec.w,it.rec.h,it.rec.data);setWrap(t,true);}
  tx.cache.set(key,t);return t;}
function txCopy(t){const c=makeTarget(t.w,t.h,8,true);blit(t,c,0,0,t.w,t.h,0,0);setWrap(c,true);return c;}
/* thumbnails */
function txThumbOf(t){const S=72,s=makeTarget(S,S,8,false);copyScaled(t,s);const d=captureRegionNow(s,0,0,S,S).data;disposeTarget(s);
  const c=document.createElement('canvas');c.width=c.height=S;const id=c.getContext('2d').createImageData(S,S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const i=(y*S+x)*4,j=((S-1-y)*S+x)*4,a=d[j+3]||1;id.data[i]=d[j]*255/a;id.data[i+1]=d[j+1]*255/a;id.data[i+2]=d[j+2]*255/a;id.data[i+3]=255;}
  c.getContext('2d').putImageData(id,0,0);return c.toDataURL('image/png');}
async function txThumb(it,img){const key=it.kind+':'+it.id;if(tx.thumbs.has(key)){img.src=tx.thumbs.get(key);return;}
  try{const t=await txTarget(it);const u=txThumbOf(t);tx.thumbs.set(key,u);img.src=u;}catch(e){img.alt='?';}}
/* your own textures (IndexedDB store 'textures', pictures packed) */
async function txLoad(){if(tx.loaded)return;tx.loaded=true;try{tx.mine=((await store.all('textures'))||[]).filter(r=>!r.decal).sort((a,b)=>(a.t||0)-(b.t||0));}catch(e){tx.mine=[];}renderTextures();}
async function txAddTarget(t,name){const rec={id:'t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,t:Date.now(),w:t.w,h:t.h,data:captureRegionNow(t,0,0,t.w,t.h).data};
  tx.mine.push(rec);tx.cache.set('mine:'+rec.id,t);await store.put(rec,'textures');return rec;}
async function txImport(){const fs=await pickFiles('image/*,.gtex',true,'Textures and texture packs',['png','jpg','jpeg','webp','tga','tif','tiff','bmp','psd','gtex']);let n=0;
  for(const f of fs){try{if(/\.gtex$/i.test(f.name)){const j=await gmatParse(f);for(const it of j.items||[]){const bm=await createImageBitmap(await (await fetch(it.img)).blob());await txAddTarget(await bitmapTarget(bm),it.name||'Texture');n++;}}
      else{const t=await fileTarget(f);setWrap(t,true);await txAddTarget(t,baseName(f.name));n++;}}catch(e){toast('Could not read '+f.name+': '+(e.message||e));}}
  if(n){tx.show=tx.show==='gen'||tx.show==='photo'?'mine':tx.show;renderTextures();toast('Added '+n+' texture'+(n>1?'s':'')+' to Textures › Yours.');}}
/* a pack: every texture of yours in one file to share */
async function txExportPack(){if(!tx.mine.length){toast('Import some textures first: the pack holds yours.');return;}
  const items=[];for(const rec of tx.mine){const c=document.createElement('canvas');c.width=rec.w;c.height=rec.h;const id=c.getContext('2d').createImageData(rec.w,rec.h),d=rec.data;
    for(let i=0;i<d.length;i+=4){const a=d[i+3]||1;id.data[i]=Math.min(255,d[i]*255/a);id.data[i+1]=Math.min(255,d[i+1]*255/a);id.data[i+2]=Math.min(255,d[i+2]*255/a);id.data[i+3]=d[i+3];}
    c.getContext('2d').putImageData(id,0,0);items.push({name:rec.name,img:pxDataURL(c,'base')});}
  const r=await deliver('textures.gtex',await gmatBlob({app:'Gouache Studio',kind:'textures',v:1,items}));toast(deliveredText(r,'Texture pack ('+items.length+')'));}
function txDelete(rec){confirmDlg('Delete texture','Delete “'+rec.name+'” from Textures? Layers that use it keep it.','Delete',()=>{const i=tx.mine.indexOf(rec);if(i>=0)tx.mine.splice(i,1);
  const t=tx.cache.get('mine:'+rec.id);if(t){disposeTarget(t);tx.cache.delete('mine:'+rec.id);}tx.thumbs.delete('mine:'+rec.id);store.del(rec.id,'textures');renderTextures();});}
/* ---- the uses ---- */
async function txToMask(it){const L=doc.active;if(!isLayer(L)&&!(L&&L.type==='group')){toast('Select a layer first: the texture goes into its mask.');return;}
  const t=txCopy(await txTarget(it)),r=msAdd(L,'image',{p:{name:it.name}},'Add '+it.name.toLowerCase()+' to the mask');if(!r){disposeTarget(t);return;}
  msEdit(L,r,x=>{x.t=t;x.p.name=it.name;});(L.mask._rows||(L.mask._rows=new Set())).add(r);if(typeof msCommit==='function')msCommit();renderLayers();if(typeof renderMatEd==='function')renderMatEd(true);
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
async function txToLayer(it){if(ui.mode!=='paint'&&ui.mode!=='p3d'){toast('Switch to Paint or 3D Paint first.');return;}
  const src=await txTarget(it);if(!P_TXLAYER)P_TXLAYER=program(FS_TXLAYER);
  const A=doc.active,parent=A?(A.parent||doc.root):doc.root,idx=A?parent.children.indexOf(A)+1:doc.root.children.length,L=newLayerObj(it.name);
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
function txItems(){const g=TX_GEN.map(([id,name])=>({kind:'gen',id,name})),p=TX_PHOTO.map(([id,name])=>({kind:'photo',id,name})),m=tx.mine.map(rec=>({kind:'mine',id:rec.id,name:rec.name,rec}));
  return tx.show==='gen'?g:tx.show==='photo'?p:tx.show==='mine'?m:[...m,...p,...g];}
/* thumbnails are made when a tile comes into view (the panel may be hidden) */
const txSeen=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){txSeen.unobserve(e.target);txThumb(e.target._tx,e.target);}});
function renderTextures(){const box=$('#txBody');if(!box)return;if(!tx.loaded){txLoad();}
  const tile=it=>{const img=el('img',{alt:'',width:72,height:72});img._tx=it;txSeen.observe(img);const b=el('button',{class:'mattile txtile',title:it.name+' (click for uses)',id:'tx_'+it.kind+'_'+it.id,onclick:e=>txMenu(e,it)},img,el('span',{text:it.name}));return b;};
  const items=txItems();
  box.replaceChildren(segChips([['all','All'],['mine','Yours'],['photo','Photo grunge'],['gen','Generated']],()=>tx.show,v=>{tx.show=v;try{localStorage.setItem('gs.txShow',v);}catch(e){}renderTextures();}),
    el('div',{class:'chips'},el('button',{class:'btn sm',id:'txImport',text:'Import…',title:'Pictures, or a .gtex texture pack',onclick:txImport}),el('button',{class:'btn sm',id:'txExport',text:'Export pack…',title:'All your textures in one .gtex file to share',onclick:txExportPack})),
    items.length?el('div',{class:'matgrid',id:'txGrid'},...items.map(tile)):el('p',{class:'note',text:'No textures of yours yet. Import pictures or a .gtex pack.'}),
    el('p',{class:'note',text:'Click a texture for what to do with it. Photo grunge: ambientCG (CC0).'}));}
