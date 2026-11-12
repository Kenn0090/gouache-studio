/* Browsing must not allocate originals; owned layer images and live guides must survive eviction. */
const {chromium}=require('playwright'),path=require('path'),fs=require('fs'),http=require('http');
let failures=0;const ok=(v,m)=>{console.log((v?'PASS ':'FAIL ')+m);if(!v)failures++;};
(async()=>{
 let server=null,url;
 if(process.env.GS_SHELF_BUILD==='desktop'){const root=path.resolve(__dirname,'../../dist');server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port+'/index.html?debug';
 }else url='file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug';
 const browser=await chromium.launch({channel:process.env.GS_BROWSER_CHANNEL||'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 p.on('pageerror',e=>errors.push(e.stack));p.on('console',m=>{if(m.type()==='error'&&/shader|compile|link/i.test(m.text()))errors.push(m.text());});
 await p.addInitScript(()=>localStorage.setItem('gs.p3d',JSON.stringify({size:64,layout:'3d'})));
 await p.route('**/*',r=>r.request().url().startsWith('file:')||r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.fulfill({body:''}));
 await p.goto(url);await p.waitForFunction(()=>window.__gs&&__gs.tx.loaded);
 await p.evaluate(()=>{__gs.closeWelcome();__gs.newDoc(64,64,8,[1,1,1],'Shelf',false);__gs.showPanel('textures');});
 await p.locator('#txGrid img').first().scrollIntoViewIfNeeded();
 await p.waitForFunction(()=>[...document.querySelectorAll('#txGrid img')].some(i=>i.complete&&i.naturalWidth),null,{timeout:10000}).catch(async e=>{console.log(JSON.stringify(await p.evaluate(()=>({stats:__gs.tx.stats,queue:__gs.tx.thumbQueue.length,jobs:__gs.tx.thumbJobs,observed:__gs.txObserved.size,images:[...document.querySelectorAll('#txGrid img')].slice(0,3).map(i=>({src:i.src,alt:i.alt,rect:i.getBoundingClientRect().toJSON()}))}))));console.log(errors);throw e;});
 const browsing=await p.evaluate(async()=>{const G=__gs;for(const [id,name] of G.TX_PHOTO){const img=new Image();img.src=await G.txMakeThumb({kind:'photo',id,name});await img.decode();if(img.naturalWidth>96)return {small:false};}
  for(const [id,name] of G.TX_GEN)await G.txMakeThumb({kind:'gen',id,name});return {small:true,loads:G.tx.stats.loads,cache:G.tx.cache.size,photos:G.TX_PHOTO.length,previews:Object.keys(G.TX_PREVIEWS).length};});
 ok(browsing.small&&browsing.photos===browsing.previews,'every built-in photo uses its verified small preview '+JSON.stringify(browsing));
 ok(browsing.loads===0&&browsing.cache===0,'browsing photos and generated patterns loads zero full GPU originals');
 const fallback=await p.evaluate(async()=>{const G=__gs,id='drips',saved=G.TX_PREVIEWS[id];delete G.TX_PREVIEWS[id];try{const img=new Image();img.src=await G.txMakeThumb({kind:'photo',id});await img.decode();return img.naturalWidth===96&&G.tx.stats.loads===0&&G.tx.cache.size===0;}finally{G.TX_PREVIEWS[id]=saved;}});
 ok(fallback,'new or changed photo assets fall back to a small decode without a GPU original');
 const pending=await p.evaluate(async()=>{const G=__gs,it={kind:'photo',id:'mixed-extreme-damage'},n=G.tx.stats.loads;
  const [a,b,c]=await Promise.all([G.txTarget(it),G.txTarget(it),G.txTarget(it)]);const raw=G.captureRegionNow(a,0,0,a.w,a.h).data;let lo=255,hi=0;for(let i=0;i<raw.length;i+=4){lo=Math.min(lo,raw[i]);hi=Math.max(hi,raw[i]);}
  return {same:a===b&&b===c,loads:G.tx.stats.loads-n,w:a.w,h:a.h,range:hi-lo,coalesced:G.tx.stats.coalesced};});
 ok(pending.same&&pending.loads===1&&pending.coalesced>=2,'simultaneous uses share one decode and upload');
 ok(pending.w===1024&&pending.h===1024&&pending.range>200,'applied originals retain full resolution and contrast');
 const seed=await p.evaluate(async()=>{const G=__gs,w=512,h=256,data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,a=(x+y)%7?255:0;data[i]=a?x%256:0;data[i+1]=a?y:0;data[i+2]=a?(x*3+y)%256:0;data[i+3]=a;}
  window.shelfExpected=data;await G.store.put({id:'legacy-shelf',name:'Legacy asymmetrical texture',t:1,w,h,data},'textures');
  await G.store.put({id:'legacy-decal',name:'Separate decal',t:2,w:8,h:8,decal:true,data:new Uint8Array(8*8*4).fill(255)},'textures');
  const meta=await G.txAddTarget(await G.txTarget({kind:'gen',id:'dots'}),'New import');const raw=await G.store.getRaw(meta.id,'textures');return {id:meta.id,packed:!!raw.z&&!raw.data,preview:!!raw.thumb,metadata:!meta.data&&!meta.z};});
 ok(seed.packed&&seed.preview&&seed.metadata,'new imports persist packed originals plus previews and retain metadata only');
 // Measure startup separately from preview requests made by a visible Textures tab.
 await p.evaluate(()=>__gs.showPanel('mats'));
 await p.reload();await p.waitForFunction(()=>window.__gs&&__gs.tx.loaded&&__gs.dc.loaded);await p.waitForTimeout(300);
 const startup=await p.evaluate(()=>({n:__gs.tx.mine.length,meta:__gs.tx.mine.every(r=>!r.data&&!r.z),unpacks:__gs.tx.stats.unpacks,loads:__gs.tx.stats.loads,decals:__gs.dc.mine.length,decalPixels:__gs.dc.mine[0].data.length}));
 ok(startup.n===2&&startup.meta&&startup.unpacks===0&&startup.loads===0,'startup lists imported textures without unpacking their originals '+JSON.stringify(startup));
 ok(startup.decals===1&&startup.decalPixels===256,'decal loading still works and skips non-decal originals');
 const legacy=await p.evaluate(async()=>{const G=__gs,rec=G.tx.mine.find(r=>r.id==='legacy-shelf'),u=await G.txMakeThumb({kind:'mine',rec,id:rec.id});
  const img=new Image();img.src=u;await img.decode();const c=document.createElement('canvas');c.width=c.height=96;c.getContext('2d').drawImage(img,0,0);const d=c.getContext('2d').getImageData(0,0,96,96).data;
  const top=d[1],bottom=d[(95*96+1)*4+1];await G.txSaveThumb(rec,u);const raw=await G.store.getRaw(rec.id,'textures');const full=await G.txRead(rec);let same=true;
  for(let y=0;y<full.h;y++)for(let x=0;x<full.w;x++){const i=(y*full.w+x)*4,a=(x+y)%7?255:0;if(full.data[i]!== (a?x%256:0)||full.data[i+1]!== (a?y:0)||full.data[i+2]!== (a?(x*3+y)%256:0)||full.data[i+3]!==a)same=false;}
  return {small:img.naturalWidth===96,orientation:top<10&&bottom>230,saved:!!raw.thumb&&!!raw.z&&!raw.data,same,cache:G.tx.cache.size,meta:!rec.data&&!rec.z};});
 ok(legacy.small&&legacy.orientation&&legacy.saved,'legacy imports backfill a correctly oriented small preview without rewriting pixels '+JSON.stringify(legacy));
 ok(legacy.same&&legacy.cache===0&&legacy.meta,'legacy unpack is lossless and creates no full GPU preview target');
 await p.reload();await p.waitForFunction(()=>window.__gs&&__gs.tx.loaded);
 const persisted=await p.evaluate(async()=>{const G=__gs,r=G.tx.mine.find(x=>x.id==='legacy-shelf'),n=G.tx.stats.unpacks;await G.txMakeThumb({kind:'mine',id:r.id,rec:r});return {same:G.tx.stats.unpacks===n,cached:!!r.thumb};});
 ok(persisted.same&&persisted.cached,'reopening uses the persisted preview with no legacy decode');
 const pack=await p.evaluate(async()=>{const G=__gs,desktop=G.platform.isDesktop,save=G.platform.saveAs;let bytes;G.platform.isDesktop=true;G.platform.saveAs=async(name,b)=>{bytes=b;return name;};
  try{await G.txExportPack();const parsed=await G.gmatParse(bytes),sizes=[];for(const it of parsed.items){const bm=await createImageBitmap(await (await fetch(it.img)).blob());sizes.push([bm.width,bm.height]);bm.close();}
   return {names:parsed.items.map(it=>it.name),sizes,metadata:G.tx.mine.every(r=>!r.data&&!r.z)};}finally{G.platform.isDesktop=desktop;G.platform.saveAs=save;}});
 ok(pack.names.includes('Legacy asymmetrical texture')&&pack.names.includes('New import')&&pack.sizes.some(s=>s[0]===512&&s[1]===256)&&pack.metadata,'texture packs still export full originals from a metadata-only shelf');
 const owned=await p.evaluate(async()=>{const G=__gs;G.closeWelcome();G.newDoc(64,64,8,[1,1,1],'Eviction',false);
  const it={kind:'photo',id:'drips',name:'Drips'};await G.txToMask(it);const L=G.doc.active,row=L.mask.stack.find(r=>r.kind==='image'),mask=row.t;
  await G.txToLayer({kind:'gen',id:'cells',name:'Cells'});const layer=G.doc.active;
  G.cmdNewFillLayer();const mat=G.doc.active;await G.txToChannel(it,'rough');const channel=mat._fillImg.rough;
  const before=t=>G.captureRegionNow(t,0,0,t.w,t.h).data;const a=before(mask),b=before(layer.target),c=before(channel);
  window.shelfGuide={guide:'image',gimg:{kind:'photo',id:'drips',name:'Drips'}};G.fxdGuideTex(shelfGuide);await G.txTarget(it);const guide=G.fxdGuideTex(shelfGuide);
  G.tx.cacheLimit=0;G.tx.cacheCount=0;G.txCacheTrim(performance.now()+20000);
  const intact=(t,d)=>!!t.tex&&before(t).every((v,i)=>v===d[i]);return {mask:intact(mask,a),layer:intact(layer.target,b),channel:intact(channel,c),guide:G.fxdGuideTex(shelfGuide)===guide&&!!guide.tex,cache:[...G.tx.cache.keys()],error:G.gl.getError()};});
 ok(owned.mask&&owned.layer&&owned.channel,'eviction preserves independent mask, layer and material images');
 ok(owned.guide&&owned.cache.length===1&&owned.cache[0]==='photo:drips','live picture guides remain pinned while unused originals leave the cache '+JSON.stringify(owned));
 const bounded=await p.evaluate(async()=>{const G=__gs;delete shelfGuide.gimg.kind;G.txCacheTrim(performance.now()+20000);G.tx.cacheLimit=8*1024*1024;G.tx.cacheCount=16;
  for(const id of ['streaks','rings','specks','stains','drips','splotches']){await G.txTarget({kind:'photo',id});await new Promise(r=>setTimeout(r,5));}G.txCacheTrim();const n=G.tx.cache.size;const old=G.tx.cache.get('photo:drips');
  G.txCacheTrim(performance.now()+20000);return {n,empty:G.tx.cache.size===0,disposed:!old||!old.tex,error:G.gl.getError()};});
 ok(bounded.n<=2&&bounded.empty&&bounded.disposed,'unused originals obey the byte limit and leave after idle time '+JSON.stringify(bounded));
 const queue=await p.evaluate(async()=>{const G=__gs;G.tx.thumbs.clear();const host=document.createElement('div');document.body.append(host);
  const jobs=G.TX_GEN.map(([id,name])=>{const it={kind:'gen',id,name},img=new Image();img._tx=it;host.append(img);return G.txThumb(it,img);});
  const limited=G.tx.thumbJobs<=2&&G.tx.thumbQueue.length>0;await Promise.all(jobs);const done=[...host.children].every(i=>i.src.startsWith('data:'));host.remove();
  for(let i=0;i<12;i++){G.tx.show=i%2?'photo':'gen';G.renderTextures();}const detached=[...G.txObserved].filter(i=>!i.isConnected).length;
  return {limited,done,detached,loads:G.tx.stats.loads};});
 ok(queue.limited&&queue.done&&queue.detached===0,'preview work is limited to two jobs and rebuilt shelves release detached observers');
 await p.evaluate(()=>__gs.fxdPickTexture(()=>{}));await p.waitForSelector('.fxdpick');await p.click('#dlgCancel');await p.waitForTimeout(100);
 ok(await p.evaluate(()=>![...__gs.txObserved].some(i=>i.closest('.fxdpick'))),'closing the texture picker releases its thumbnail observers');
 // Deletion can race a legacy preview backfill; it must never recreate the record.
 const deleted=await p.evaluate(async()=>{const G=__gs,r=G.tx.mine.find(x=>x.id==='legacy-shelf');await G.store.del(r.id,'textures');await G.txSaveThumb(r,r.thumb);return !(await G.store.getRaw(r.id,'textures'));});
 ok(deleted,'late preview backfills cannot resurrect deleted textures');
 const newGrunges=require('../../assets/grunge/extra-grunge-sources.json');
 const library=await p.evaluate(async scans=>{
  const G=__gs;
  const all=scans.every(({slug,name,category})=>G.TX_PHOTO.some(([id,title,group])=>id===slug&&title===name&&group===category));
  const concrete=await G.txTarget({kind:'photo',id:'grunge-concrete-fractures'});
  G.tx.show='photo';
  const count=category=>{
   G.tx.category=category;G.renderTextures();
   return G.txItems().filter(it=>scans.some(s=>s.slug===it.id&&(category!=='Scratches'||s.family==='Metal'))).length;
  };
  return {all,metal:count('Metal'),fabric:count('Fabric'),scratches:count('Scratches'),dents:count('Dents'),
    width:concrete.w,height:concrete.h};
 },newGrunges);
 ok(library.all&&library.metal===11&&library.fabric===10&&library.scratches===5&&library.dents===5
    &&library.width===1024&&library.height===1024,
    'new scans are browsable by category and cracked concrete loads offline at full size '+JSON.stringify(library));

 await p.evaluate(()=>{
  const G=__gs;G.setMode('paint');G.newDoc(64,64,8,[1,1,1],'Photo grunge',false);
  const L=G.doc.active;L.name='Test concrete.jpg';
  const pixels=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
   const i=(y*64+x)*4, shade=Math.abs(x-28)<2?18:140+x+y;
   if(x>59&&y>59)continue;
   pixels.set([shade,Math.round(shade*.8),Math.round(shade*.6),255],i);
  }
  G.writeRegion(L.target,0,0,64,64,pixels);
  window.grungePhotoPixels=pixels;
 });
 const openPhotoGrunge=async()=>{
  await p.locator('#menus').getByRole('button',{name:'Filter',exact:true}).click();
  await p.locator('[data-act=photoGrunge]').click();
 };
 await openPhotoGrunge();
 await p.locator('#fx_photoGrunge_preset').selectOption({label:'Fabric'});
 await p.locator('#fx_photoGrunge_preset').selectOption({label:'Cracks'});
 await p.locator('#fx_seamless').check();
 await p.locator('#fxPrev').uncheck();
 await p.locator('#fxTextureName').fill('Cracks from Paint');
 await p.getByRole('button',{name:'Save to Textures',exact:true}).click();
 await p.waitForFunction(()=>__gs.doc.projectAssets?.some(a=>a.rec.name==='Cracks from Paint'));
 await p.click('#dlgCancel');
 const photoGrunge=await p.evaluate(async()=>{
  const G=__gs,rec=G.tx.mine.find(r=>r.name==='Cracks from Paint'),full=await G.txRead(rec),bytes=full.data;
  const preserved=G.captureRegionNow(G.doc.active.target,0,0,64,64).data.every((v,i)=>v===grungePhotoPixels[i]);
  const grey=bytes.every((v,i)=>i%4!==0||v===bytes[i+1]&&v===bytes[i+2]);
  const val=(x,y,c=0)=>bytes[(y*64+x)*4+c];
  const visible=G.tx.show==='mine'&&!!document.querySelector('#tx_mine_'+rec.id);
  return {preserved,grey,visible,crack:val(28,32),surface:val(20,32),transparent:val(62,62,3),size:[full.w,full.h]};
 });
 ok(photoGrunge.preserved&&photoGrunge.grey&&photoGrunge.visible&&photoGrunge.crack-photoGrunge.surface>120
    &&photoGrunge.size.every(v=>v===64),'saving with preview off stores the converted full-resolution grayscale texture '+JSON.stringify(photoGrunge));
 await openPhotoGrunge();
 await p.click('#dlgOk');
 const applied=await p.evaluate(async()=>{
  const G=__gs,read=()=>G.captureRegionNow(G.doc.active.target,0,0,64,64).data;
  const edited=read(),i=(32*64+28)*4;
  const grey=edited[i]===edited[i+1]&&edited[i]===edited[i+2]&&edited[i]>150&&edited[(62*64+62)*4+3]===0;
  await G.undo();
  return grey&&read().every((v,i)=>v===grungePhotoPixels[i]);
 });
 ok(applied,'applying the filter preserves transparency and can be undone');
 await p.reload();await p.waitForFunction(()=>window.__gs&&__gs.tx.loaded);
 await p.evaluate(()=>{
  const G=__gs;G.closeWelcome();G.newDoc(64,64,8,[1,1,1],'Saved grunge mask',false);
  const L=G.cmdNewFillLayer({name:'Metal',maps:{base:{c:[1,1,1]}}});
  G.msAdd(L,'gen',{p:G.msGenDefaults('metalWear')});
 });
 await p.click('#msGrungePick');
 await p.locator('.fxdpick').getByRole('button',{name:'Cracks from Paint',exact:true}).click();
 const picked=await p.evaluate(()=>__gs.doc.active.mask.stack.some(r=>r.p?.gimg?.name==='Cracks from Paint'));
 ok(picked,'a grunge saved from Paint stays available in the metal-wear generator after restart');
 ok(errors.length===0&&owned.error===0&&bounded.error===0,'no application or graphics errors '+errors.join(' | '));
 await browser.close();if(server)await new Promise(r=>server.close(r));process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
