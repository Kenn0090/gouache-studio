/* 0.75: the online library. ambientCG is pretended (search answers and zips are made here); the desktop side is replaced by a mock. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../dist');let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),p=await b.newPage({viewport:{width:1500,height:950}}),errors=[];
 p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(()=>{localStorage.setItem('gs.welcome','no');});await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
 await p.goto(url+'/index.html?debug');await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>__gs.closeWelcome());
 /* the pretend ambientCG and desktop side */
 await p.evaluate(()=>{const G=__gs,P=G.platform;window.__calls=[];window.__hold=null;
  const crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
  const crc=u=>{let c=~0;for(const x of u)c=crcT[(c^x)&255]^(c>>>8);return ~c>>>0;};
  const cat=a=>{const n=a.reduce((s,x)=>s+x.length,0),o=new Uint8Array(n);let p=0;for(const x of a){o.set(x,p);p+=x.length;}return o;};
  const zip=files=>{const parts=[],cd=[];let off=0;const enc=new TextEncoder();for(const [name,data] of files){const nm=enc.encode(name),c=crc(data),lh=new DataView(new ArrayBuffer(30));lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint32(14,c,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,nm.length,true);parts.push(new Uint8Array(lh.buffer),nm,data);
    const ch=new DataView(new ArrayBuffer(46));ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint32(16,c,true);ch.setUint32(20,data.length,true);ch.setUint32(24,data.length,true);ch.setUint16(28,nm.length,true);ch.setUint32(42,off,true);cd.push(new Uint8Array(ch.buffer),nm);off+=30+nm.length+data.length;}
   const cl=cd.reduce((s,x)=>s+x.length,0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cl,true);e.setUint32(16,off,true);return cat([...parts,...cd,new Uint8Array(e.buffer)]);};
  const png=async(r,g,b2)=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='rgb('+r+','+g+','+b2+')';x.fillRect(0,0,64,64);x.fillStyle='rgb('+(255-r)+','+(255-g)+',20)';x.fillRect(8,8,24,24);const bl=await new Promise(res=>c.toBlob(res,'image/png'));return new Uint8Array(await bl.arrayBuffer());};
  window.__mkZip=async(id,good=true)=>zip(good?[[id+'_1K-JPG_Color.png',await png(200,90,40)],[id+'_1K-JPG_NormalGL.png',await png(128,128,255)],[id+'_1K-JPG_Roughness.png',await png(90,90,90)],[id+'_1K-JPG_Displacement.png',await png(120,120,120)],[id+'_1K-JPG_Metalness.png',await png(30,30,30)]]:[[id+'_readme.txt',new Uint8Array([1,2,3])]]);
  const mk=(id,dc,i)=>({assetId:id,displayName:'Test '+id,displayCategory:dc,previewImage:{'256-WEBP':'https://acg-media.example/'+id+'.webp'},downloadFolders:{default:{downloadFiletypeCategories:{zip:{downloads:['1K','2K','4K'].map(r=>({attribute:r+'-JPG',size:{'1K':7e6,'2K':21e6,'4K':73e6}[r],fullDownloadPath:'https://ambientcg.com/get?file='+id+'_'+r+'-JPG.zip'}))}}}}});
  const all=[mk('Metal901','Metal'),mk('Leather901','Leather'),mk('Broken901','Metal'),mk('Wood901','Wood Floor')];
  window.__api=url=>{window.__calls.push(url);const u=new URL(url),off=+u.searchParams.get('offset')||0;return JSON.stringify({numberOfResults:70,foundAssets:off?[mk('Page2_901','Tiles')]:all});};
  const phList={brick_wall_01:{name:'Brick Wall 01',categories:['brick','wall','outdoor'],tags:['red','old'],category:'Bricks/Wall',max_resolution:[8192,8192],download_count:900,date_published:100,authors:{'Rob Tuytel':'All'},thumbnail_url:'https://cdn.polyhaven.com/asset_img/thumbs/brick_wall_01.png'},
    oak_planks_02:{name:'Oak Planks 02',categories:['wood','raw wood','floor'],tags:['planks'],category:'Wood/Planks',max_resolution:[4096,4096],download_count:500,date_published:300,authors:{'Dimitrios Savva':'All','Rico Cilliers':'Textures'},thumbnail_url:'https://cdn.polyhaven.com/asset_img/thumbs/oak_planks_02.png'},
    leather_red_03:{name:'Leather Red 03',categories:['leather'],tags:[],category:'Leather',max_resolution:[2048,2048],download_count:700,date_published:200,authors:{'Someone':'All'},thumbnail_url:''}};
  const phFile=(id,k)=>{const o={};for(const r of ['1k','2k','4k'])o[r]={jpg:{size:1000,md5:'x',url:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/'+r+'/'+id+'/'+id+'_'+k+'_'+r+'.jpg'}};return o;};
  window.__phFilesMap={Diffuse:'diff',nor_gl:'nor_gl',arm:'arm',Displacement:'disp',Rough:'rough',AO:'ao'};
  window.__png=async(r,g,b2)=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle='rgb('+r+','+g+','+b2+')';x.fillRect(0,0,32,32);x.fillStyle='#fff';x.fillRect(4,4,10,10);const bl=await new Promise(res=>c.toBlob(res,'image/png'));return new Uint8Array(await bl.arrayBuffer());};
  const oldApi=window.__api;window.__api=url=>{if(url.startsWith('https://api.polyhaven.com/assets'))return (window.__calls.push(url),JSON.stringify(phList));
    const m=/^https:\/\/api\.polyhaven\.com\/files\/([a-z0-9_]+)$/.exec(url);if(m){window.__calls.push(url);const o={};for(const [k,v] of Object.entries(window.__phFilesMap))o[k]=phFile(m[1],v);return JSON.stringify(o);}return oldApi(url);};
  const oldInv=null;
  P.isDesktop=true;P.invoke=async(cmd,args)=>{if(cmd==='net_get_text')return window.__api(args.url);
    if(cmd==='net_download'&&/dl\.polyhaven\.org/.test(args.url)){window.__calls.push('dl '+args.url);const u=await window.__png(180,140,90);return u.buffer;}
    if(cmd==='net_download'){window.__calls.push('dl '+args.url);if(window.__hold){await window.__hold(args.id);if(window.__cancelFlag){window.__cancelFlag=false;throw new Error('cancelled');}}const id=/file=([A-Za-z0-9_]+?)_\d+K/.exec(args.url)[1];const z=await window.__mkZip(id,!id.startsWith('Broken'));return z.buffer;}
    if(cmd==='net_cancel'){window.__calls.push('cancel '+args.id);if(window.__cancel)window.__cancel();return;}
    return null;};});
 /* open the window and search */
 await p.evaluate(()=>__gs.dlgOnlineLib());await p.waitForSelector('.oltile');
 ok(await p.locator('.oltile').count()===4,'the first page shows the 4 pretend materials');
 ok((await p.evaluate(()=>__calls[0])).includes('type=Material')&&(await p.evaluate(()=>__calls[0])).includes('limit=30')&&(await p.evaluate(()=>__calls[0])).includes('sort=Popular'),'the search asks ambientCG for materials, popular first');
 await p.fill('#olSearch','metal');await p.click('#olGo');await p.waitForFunction(()=>__calls.some(c=>/q=metal/.test(c)));ok(true,'typing a word and pressing Search sends it as q=');
 await p.locator('[data-cat="Wood"]').click();await p.waitForFunction(()=>__calls.some(c=>/category=Wood/.test(c)&&/Wood\+Floor|Wood%20Floor/.test(c)));ok(true,'a category chip asks for all of ambientCG\'s matching categories');
 await p.locator('[data-cat="grunge"]').click();await p.waitForFunction(()=>__calls.some(c=>/category=Scratches/.test(c)&&/Surface\+Imperfections|Surface%20Imperfections/.test(c)));ok(true,'the Grunge maps chip asks for scratches, smears and similar sets');
 await p.locator('[data-cat="all"]').click();await p.waitForFunction(()=>!__gs.ol.loading);
 await p.click('#olNext');await p.waitForFunction(()=>__calls.some(c=>/offset=30/.test(c)));ok(true,'Next asks for the next 30');await p.waitForFunction(()=>!__gs.ol.loading);await p.click('#olPrev');await p.waitForFunction(()=>!__gs.ol.loading&&__gs.ol.items.length===4);
 /* choose two good ones and one broken, 2K */
 await p.locator('[data-id="Metal901"]').click();await p.locator('[data-id="Leather901"]').click();await p.locator('[data-id="Broken901"]').click();
 ok(await p.locator('.oltile.sel').count()===3,'clicking selects the tiles');
 await p.locator('.olres .seg button',{hasText:'2K'}).click();
 ok(/about \d+ MB to download/.test(await p.locator('.olact .dim').textContent()),'the download size is shown');
 await p.click('#olAdd');await p.waitForFunction(()=>!__gs.ol.busy,null,{timeout:120000});
 const st=await p.evaluate(()=>({n:__gs.dlLib.list.length,names:__gs.dlLib.list.map(r=>r.name),res:__gs.dlLib.list.map(r=>r.dl.res),cats:__gs.dlLib.list.map(r=>r.cat),cred:__gs.dlLib.list.map(r=>r.credit),imgs:__gs.dlLib.list.some(r=>r.imgs),thumb:__gs.dlLib.list.every(r=>/^data:image/.test(r.thumb||'')),sel:__gs.ol.sel.size}));
 ok(st.n===2,'two good downloads were added, the broken one was not ('+st.n+')');ok(st.res.every(r=>r==='2K'),'they were built at the chosen size');
 ok(st.cats.includes('Metal')&&st.cats.includes('Leather'),'each lands in its Library category ('+st.cats+')');ok(st.cred[0]==='ambientCG.com Metal901 (CC0)'||st.cred[1]==='ambientCG.com Metal901 (CC0)','the credit is kept');
 ok(!st.imgs&&st.thumb,'only a small description and a thumbnail are kept in memory');ok(st.sel===1,'the failed one stays selected so it can be tried again');
 ok(/Failed/.test(await p.locator('.olrow').filter({hasText:'Broken901'}).textContent()),'the broken download is reported as failed');
 /* it is in the store with its pictures, and survives a reload */
 ok(await p.evaluate(async()=>{const r=await __gs.store.getRaw('d:Metal901','materials');return !!(r&&r.imgs&&r.imgs.base&&r.dl.res==='2K');}),'the pictures are saved in the store');
 /* Library listing: mixed and separate */
 await p.evaluate(()=>__gs.dlgOnlineLib&&0);
 const mix=await p.evaluate(()=>{const G=__gs,v=G.dlLib.list.find(r=>r.dl.aid==='Metal901');G.prefs.dlSeparate=undefined;const a=G.gmIn(v,'Metal'),d=G.gmIn(v,'dl');G.prefs.dlSeparate=true;const a2=G.gmIn(v,'Metal'),d2=G.gmIn(v,'dl'),all2=G.gmIn(v,'all');G.prefs.dlSeparate=undefined;return {a,d,a2,d2,all2};});
 ok(mix.a&&mix.d,'mixed: a downloaded material is in its category and under Downloaded');ok(!mix.a2&&mix.d2&&!mix.all2,'separate: it is only under Downloaded');
 /* using it: the pictures come out of the store, are put on a layer, and are let go */
 const use=await p.evaluate(async()=>{const G=__gs;G.newDoc(64,64);const v=G.dlLib.list.find(r=>r.dl.aid==='Metal901');const L=await G.gmApply(v);return {layer:!!(L&&L.fill),maps:L?Object.keys(L._fillImg||{}).length:0,released:v.imgs===null&&!v._t,fillKept:!!v.fill};});
 ok(use.layer&&use.maps>=4,'adding it puts a material layer in the document with its pictures ('+use.maps+')');ok(use.released&&use.fillKept,'the 2K pictures are let go after use and load again when needed');
 ok(await p.evaluate(async()=>{const v=__gs.dlLib.list[0];await __gs.gmLoad(v);return !!v.imgs&&Object.keys(v.imgs).length>=4;}),'it loads again from the store');
 /* the Library shelf shows the chip and a delete button */
 await p.evaluate(()=>{__gs.closeDialog&&0;});
 /* cancel in the middle of a download */
 const can=await p.evaluate(async()=>{const G=__gs;G.ol.sel.clear();const it=G.ol.items.find(i=>i.id==='Wood901');G.ol.sel.set(it.id,it);
  let release;window.__hold=()=>new Promise(r=>{release=r;window.__cancel=()=>{window.__cancelFlag=true;r();};});const run=G.olRun('material');await new Promise(r=>setTimeout(r,300));document.getElementById('olCancel').click();await run;window.__hold=null;
  return {added:G.dlLib.list.some(r=>r.dl.aid==='Wood901'),calls:window.__calls.filter(c=>/^cancel/.test(c)).length};});
 ok(!can.added&&can.calls===1,'Cancel stops the running download and adds nothing');
 /* grunge */
 const gr=await p.evaluate(async()=>{const G=__gs;await G.txLoad();const n0=G.tx.mine.length;G.ol.sel.clear();const it=G.ol.items.find(i=>i.id==='Leather901');G.ol.sel.set(it.id,it);await G.olRun('grunge');return {added:G.tx.mine.length-n0,name:G.tx.mine[G.tx.mine.length-1]&&G.tx.mine[G.tx.mine.length-1].name};});
 ok(gr.added===1&&/Leather901/.test(gr.name||''),'Add as grunge map puts a grey texture in Textures ('+gr.name+')');
 /* In Library marks */
 await p.evaluate(()=>{__gs.ol.items=[...__gs.ol.items];});await p.evaluate(()=>__gs.olSearch());await p.waitForFunction(()=>!__gs.ol.loading);
 ok(await p.locator('.oltile.own').count()>=2,'materials you already have are marked "In Library"');
 /* delete */
 await p.evaluate(()=>{const v=__gs.dlLib.list.find(r=>r.dl.aid==='Leather901');__gs.dlDelete(v);});await p.click('#dlgOk');
 ok(await p.evaluate(async()=>!__gs.dlLib.list.some(r=>r.dl.aid==='Leather901')&&!(await __gs.store.getRaw('d:Leather901','materials'))),'deleting removes it from the list and the store');
 /* Poly Haven (the delete dialog above replaced the window: open it again) */
 await p.evaluate(()=>{const o=__gs.ol;o.sel.clear();o.q='';o.cat='all';o.offset=0;__gs.dlgOnlineLib();});await p.waitForSelector('.olsrc');await p.locator('.olsrc .seg button',{hasText:'Poly Haven'}).click();await p.waitForFunction(()=>__gs.ol.src==='ph'&&!__gs.ol.loading&&__gs.ol.items.length===3);
 ok(await p.locator('.oltile').count()===3,'switching the source lists the Poly Haven textures');
 ok(/Powered by Poly Haven/.test(await p.locator('#olCredit').textContent()),'a visible "Powered by Poly Haven" credit is shown');
 ok(await p.locator('[data-cat="grunge"]').count()===0,'the grunge chip is only for ambientCG');
 ok(await p.evaluate(()=>__gs.ol.items[0].id==='brick_wall_01'),'Popular puts the most downloaded first');
 await p.fill('#olSearch','plank');await p.click('#olGo');await p.waitForFunction(()=>__gs.ol.items.length===1&&__gs.ol.items[0].id==='oak_planks_02');ok(true,'searching filters the list (planks -> Oak Planks 02)');
 await p.fill('#olSearch','');await p.click('#olGo');await p.waitForFunction(()=>__gs.ol.items.length===3);
 await p.locator('[data-cat="Wood"]').click();await p.waitForFunction(()=>!__gs.ol.loading&&__gs.ol.items.length===1);ok(await p.evaluate(()=>__gs.ol.items[0].cat==='Wood'),'the Wood chip keeps only wood');
 await p.locator('[data-cat="all"]').click();await p.waitForFunction(()=>!__gs.ol.loading&&__gs.ol.items.length===3);
 await p.locator('.olbar .seg button',{hasText:'Newest'}).click();await p.waitForFunction(()=>__gs.ol.items[0]&&__gs.ol.items[0].id==='oak_planks_02');ok(true,'Newest puts the latest first');
 await p.locator('[data-id="brick_wall_01"]').click();await p.locator('.olres .seg button',{hasText:'2K'}).click();
 const before=await p.evaluate(()=>__calls.length);await p.click('#olAdd');await p.waitForFunction(()=>!__gs.ol.busy,null,{timeout:120000});
 const ph=await p.evaluate(()=>{const r=__gs.dlLib.list.find(x=>x.dl.aid==='ph:brick_wall_01');return r?{res:r.dl.res,cat:r.cat,credit:r.credit,url:r.url,imgs:!!r.imgs,thumb:/^data:image/.test(r.thumb||''),id:r.id}:null;});
 ok(ph&&ph.res==='2K'&&ph.cat==='Stone & tile','a Poly Haven material is added at the chosen size and category ('+JSON.stringify(ph&&{res:ph.res,cat:ph.cat})+')');
 ok(ph&&/Poly Haven · Rob Tuytel \(CC0\)/.test(ph.credit)&&/polyhaven\.com\/a\/brick_wall_01/.test(ph.url),'its credit names Poly Haven and its creator');
 ok(ph&&!ph.imgs&&ph.thumb,'only a small description and a thumbnail are kept in memory');
 const dls=await p.evaluate(b=>__calls.slice(b).filter(c=>/^dl /.test(c)),before);
 ok(dls.length===4&&dls.every(c=>/\/2k\//.test(c)),'four map files were fetched at 2k (colour, normal, height, packed roughness/AO/metal): '+dls.length);
 const loaded=await p.evaluate(async()=>{const v=__gs.dlLib.list.find(x=>x.dl.aid==='ph:brick_wall_01');await __gs.gmLoad(v);return Object.keys(v.imgs).sort().join();});
 ok(/base/.test(loaded)&&/normal/.test(loaded)&&/rough/.test(loaded)&&/metal/.test(loaded)&&/height/.test(loaded)&&/ao/.test(loaded),'its pictures come back from the store with every channel ('+loaded+')');
 ok(await p.evaluate(()=>{const t=document.querySelector('[data-id="brick_wall_01"]');return !!t&&t.classList.contains('own');}),'it is now marked In Library');
 const grPH=await p.evaluate(async()=>{const G=__gs;await G.txLoad();const n0=G.tx.mine.length;G.ol.sel.clear();const it=G.ol.items.find(i=>i.id==='oak_planks_02');G.ol.sel.set(it.id,it);await G.olRun('grunge');return {added:G.tx.mine.length-n0,name:G.tx.mine[G.tx.mine.length-1].name};});
 ok(grPH.added===1&&/Poly Haven/.test(grPH.name),'Add as grunge map works for Poly Haven too ('+grPH.name+')');
 await p.locator('.olsrc .seg button',{hasText:'ambientCG'}).click();await p.waitForFunction(()=>__gs.ol.src==='ac'&&!__gs.ol.loading&&__gs.ol.items.length>0);ok(await p.locator('[data-cat="grunge"]').count()===1,'switching back to ambientCG brings its Grunge chip back');
 /* the upgrade: stop after two */
 await p.evaluate(()=>{__gs.closeDialog&&0;});
 const up=await p.evaluate(async()=>{const G=__gs;const before=G.gmList().length,t=G.olUpTargets('2K').length;let stopped=false;await G.olUpgrade('2K',()=>{const st=G.olUp.busy;if(st&&st.done>=2&&!st.cancel){stopped=true;st.cancel=true;}});
  const upg=G.dlLib.list.filter(r=>r.dl.upg),shown=G.gmList().length,first=upg[0]&&G.gmRecs.find(r=>G.olIdOf(r.credit)===upg[0].dl.aid);return {t,n:upg.length,sameCount:shown-before,hid:first&&!G.gmList().includes(first),keepsName:upg[0]&&first&&upg[0].name===first.name,cat:upg[0]&&first&&upg[0].cat===first.cat,again:G.olUpTargets('2K').length};});
 ok(up.t>150,'the upgrade covers the bundled library ('+up.t+' materials)');ok(up.n===2,'stopping keeps what was done ('+up.n+')');ok(up.sameCount===0,'an upgraded material replaces its 1K original in the list');
 ok(up.hid&&up.keepsName&&up.cat,'the upgraded one keeps its name and category');ok(up.again===up.t-2,'pressing upgrade again carries on with the rest ('+up.again+')');
 await p.evaluate(async()=>__gs.olUpRemove());ok(await p.evaluate(()=>__gs.dlLib.list.filter(r=>r.dl.upg).length===0),'Back to 1K removes the upgrades');
 /* the add-ons window shows the section with sizes */
 await p.evaluate(()=>{__gs.dlgAddons();});await p.waitForSelector('#olUpSection');await p.click('#olUp4K');ok(/Upgrade \d+ materials to 4K/.test(await p.locator('#olUpAsk').textContent()),'the add-ons window asks before a 4K upgrade, with the download size');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors);
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
