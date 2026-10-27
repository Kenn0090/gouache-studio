/* ================= Online library (0.75) =================
   Materials > Library > "Get more…": browse ambientCG (free, CC0), tick materials, pick 1K / 2K / 4K, and they are built
   into ordinary materials and kept on this computer (store 'materials', record.dl). Desktop app only: the search and the
   download link send no cross-site permission, so the Rust side (net.rs) does the asking.
   A downloaded material is listed in the Library by its small description; its pictures stay in the store until it is used.
   The same code upgrades the whole bundled Library to 2K or 4K (File > Add-ons). */
const OL_API='https://ambientcg.com/api/v2/full_json';
const OL_RES={'1K':1024,'2K':2048,'4K':4096};
const OL_PAGE=30;
/* ambientCG's own categories, grouped into the Library's */
const OL_GROUPS={
  'Metal':['Metal','Metal Plates','Diamond Plate','Painted Metal','Corrugated Steel','Metal Walkway','Rust','Sheet Metal','Chainmail','Foil','Grate','Pipe','Rails'],
  'Leather':['Leather'],
  'Fabric':['Fabric','Carpet','Wicker','Net','Rope','Tatami','Wallpaper'],
  'Plastic & rubber':['Plastic','Rubber','Styrofoam','Foam','Acoustic Foam','Sponge','Payment Card'],
  'Wood':['Wood','Wood Floor','Planks','Bark','Painted Wood','Wood Siding','Fence','Chipboard','Bamboo','Logs','Tree End','Wood Chips','Cork'],
  'Ground & nature':['Ground','Gravel','Snow','Grass','Scattered Leaves','Moss','Lava','Ice','Clay','Leaf','Shells','Flower Set','Thatched Roof','Pathway'],
  'Stone & tile':['Tiles','Paving Stones','Bricks','Rock','Rocks','Concrete','Asphalt','Road','Roofing Tiles','Facade','Marble','Terrazzo','Onyx','Granite','Travertine','Tactile Paving','Plaster'],
  'Paint & ceramic':['Painted Plaster','Painted Bricks','Paint','Porcelain','Glazed Terracotta','Painting','Sign']};
/* the sets that make good grunge maps (scratches, smears, dirt...): their opacity map, else roughness, is what the Textures panel wants */
const OL_GRUNGE=['Scratches','Smear','Surface Imperfections','Fingerprints','Chip','Footsteps','Rust','Asphalt'];
const OL_GRUNGE_OPACITY=['Scratches','Smear','Surface Imperfections','Fingerprints','Chip','Footsteps'];
/* ---- Poly Haven (polyhaven.com, CC0): one list of ~870 textures, searched here; each map is its own file ---- */
const PV_API='https://api.polyhaven.com';
const PV_GROUPS={'Metal':['metal'],'Leather':['leather','suede'],'Fabric':['fabric','cotton','denim','wool','fleece','knitted','fur','hessian','crepe','jacquard','satin','carpet','corduroy','woven','velvet','stretchy'],
  'Wood':['wood','raw wood','bark'],'Stone & tile':['rock','brick','concrete','cobblestone','tiles','roofing','road','asphalt','plaster-concrete'],'Ground & nature':['terrain','sand','snow','gravel','sandstone'],'Paint & ceramic':['plaster']};
/* typical download sizes per picture size (their API gives each file's size only when the material is opened) */
const PV_TYPICAL={'1K':1.5e6,'2K':5e6,'4K':18e6};
function pvGroupOf(cats){for(const g in PV_GROUPS)if(cats.some(c=>PV_GROUPS[g].includes(c)))return g;return 'Other';}
function pvItem(id,a){const cats=a.categories||[],mx=Math.max(...(a.max_resolution||[1024])),dl={};for(const r of ['1K','2K','4K'])if(mx>=OL_RES[r]||r==='1K')dl[r]={url:'',size:PV_TYPICAL[r],est:true};
  return {id,src:'ph',name:a.name||id,dc:(a.category||'').split('/').pop()||'',cats,tags:a.tags||[],cat:pvGroupOf(cats),thumb:a.thumbnail_url||'',dl,pop:a.download_count||0,date:a.date_published||0,authors:Object.keys(a.authors||{})};}
async function pvLoad(){if(ol.pv)return ol.pv;const j=JSON.parse(await platform.invoke('net_get_text',{url:PV_API+'/assets?t=textures'}));ol.pv=Object.entries(j).map(([id,a])=>pvItem(id,a));return ol.pv;}
const ol={src:'ac',pv:null,q:'',cat:'all',sort:'Popular',offset:0,total:0,items:[],sel:new Map(),res:'1K',loading:false,err:'',busy:null,prog:{},seq:0,job:0,listening:false,body:null,grid:null,foot:null,chips:null};
function olGroupOf(dc){for(const g in OL_GROUPS)if(OL_GROUPS[g].includes(dc))return g;return 'Other';}
/* "ambientCG.com Metal047B (CC0)" -> Metal047B */
function olIdOf(credit){const m=/ambientCG\.com\s+([A-Za-z0-9_]+)/i.exec(credit||'');return m?m[1]:null;}
function olOwned(){const s=new Map();for(const r of gmRecs){const id=olIdOf(r.credit);if(id)s.set(id,'1K');}for(const r of dlLib.list)s.set(r.dl.aid,r.dl.res);return s;}
const olMB=b=>b>=1073741824?(b/1073741824).toFixed(1)+' GB':Math.max(1,Math.round(b/1048576))+' MB';
/* the zip's address: the search gives them, and they follow one pattern, so the upgrade needs no search */
const olZip=(id,res,kind)=>'https://ambientcg.com/get?file='+id+'_'+res+'-'+(kind||'JPG')+'.zip';
function olItem(a){const dl={};const zips=((((a.downloadFolders||{}).default||{}).downloadFiletypeCategories||{}).zip||{}).downloads||[];
  for(const d of zips){const m=/^(1K|2K|4K)-(JPG|PNG)$/.exec(d.attribute||'');if(m&&(m[2]==='JPG'||!dl[m[1]]))dl[m[1]]={url:d.fullDownloadPath||d.downloadLink||olZip(a.assetId,m[1],m[2]),size:+d.size||0};}
  const pv=a.previewImage||{};return {id:a.assetId,name:(a.displayName||a.assetId).replace(/\s+/g,' ').trim(),dc:a.displayCategory||'',cat:olGroupOf(a.displayCategory),thumb:pv['256-WEBP']||pv['256-JPG-242424']||pv['128-WEBP']||'',dl};}
function olListen(){if(ol.listening||typeof TAURI==='undefined'||!TAURI||!TAURI.event)return;ol.listening=true;
  TAURI.event.listen('gs-net-progress',e=>{const [id,got,total]=e.payload||[];ol.prog[id]={got,total};olProgress(id);});}
function olProgress(id){const b=ol.body;if(!b)return;const row=b.querySelector('[data-job="'+id+'"]');if(!row)return;const p=ol.prog[id];if(!p)return;
  const bar=row.querySelector('.bakebar div'),txt=row.querySelector('.olstat');if(bar)bar.style.width=(p.total?Math.round(p.got/p.total*100):30)+'%';if(txt)txt.textContent='Downloading '+olMB(p.got)+(p.total?' of '+olMB(p.total):'');}
/* ---- asking ambientCG (through the desktop side) ---- */
async function olSearch(){const my=++ol.seq;ol.loading=true;ol.err='';olDraw();
  try{if(ol.src==='ph'){const all=await pvLoad();if(my!==ol.seq)return;let L=all;const q=ol.q.trim().toLowerCase();
      if(q)L=L.filter(it=>(it.name+' '+it.tags.join(' ')+' '+it.cats.join(' ')+' '+it.dc).toLowerCase().includes(q));
      if(ol.cat!=='all'&&PV_GROUPS[ol.cat])L=L.filter(it=>it.cat===ol.cat);else if(ol.cat==='grunge')L=[];
      L=L.slice().sort(ol.sort==='Latest'?(a,b)=>b.date-a.date:(a,b)=>b.pop-a.pop);ol.total=L.length;ol.items=L.slice(ol.offset,ol.offset+OL_PAGE);return;}
    const p=new URLSearchParams({type:'Material',limit:String(OL_PAGE),offset:String(ol.offset),sort:ol.sort,include:'downloadData,previewData'});
    if(ol.q.trim())p.set('q',ol.q.trim());if(ol.cat==='grunge')p.set('category',OL_GRUNGE.join(','));else if(ol.cat!=='all'&&OL_GROUPS[ol.cat])p.set('category',OL_GROUPS[ol.cat].join(','));
    const j=JSON.parse(await platform.invoke('net_get_text',{url:OL_API+'?'+p.toString()}));if(my!==ol.seq)return;
    ol.total=+j.numberOfResults||0;ol.items=(j.foundAssets||[]).map(olItem).filter(x=>Object.keys(x.dl).length);}
  catch(e){if(my===ol.seq){ol.items=[];ol.total=0;ol.err='Could not reach ambientCG: '+(e&&e.message||e)+'. Check your internet connection.';}}
  finally{if(my===ol.seq){ol.loading=false;olDraw();}}}
async function olZipGet(url,row){const id='ol'+(++ol.job);if(row)row.job=id;olDraw(true);
  const ab=await platform.invoke('net_download',{id,url});if(row)row.job=null;return ab instanceof ArrayBuffer?ab:(ab&&ab.buffer)||new Uint8Array(ab).buffer;}
/* ---- a downloaded zip -> a Library material ---- */
function olThumbPixels(im){const c=document.createElement('canvas'),s=Math.min(1,192/Math.max(im.w,im.h));c.width=Math.max(1,Math.round(im.w*s));c.height=Math.max(1,Math.round(im.h*s));
  const full=document.createElement('canvas');full.width=im.w;full.height=im.h;const x=full.getContext('2d'),id=x.createImageData(im.w,im.h);id.data.set(im.data);x.putImageData(id,0,0);c.getContext('2d').drawImage(full,0,0,c.width,c.height);return c.toDataURL('image/webp',.8);}
async function olThumb(it,built){if(it.thumb){try{const r=await fetch(it.thumb);if(r.ok){const b=await r.blob();return await new Promise((res,rej)=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=rej;f.readAsDataURL(b);});}}catch(e){}}
  const im=built.imgs.base||Object.values(built.imgs)[0];return im?olThumbPixels(im):'';}
/* res: '1K' | '2K' | '4K'; info: {id, name, cat, url?, upg?} */
async function olMake(info,res,row){
  const ab=await olZipGet(info.url||olZip(info.id,res),row);if(row){row.state='building';olDraw(true);}
  const files=await miUnzip(ab),built=await miBuild(files,info.name,OL_RES[res]);
  const rec={id:'d:'+info.id,name:info.name,t:Date.now(),kind:'material',dl:{aid:info.id,res,upg:!!info.upg},cat:info.cat||'Other',credit:'ambientCG.com '+info.id+' (CC0)',url:'https://ambientcg.com/view?id='+info.id,
    thumb:/^data:/.test(info.thumb||'')?info.thumb:await olThumb(info,built),fill:built.fill,imgs:built.imgs};
  return olStore(rec);}
/* save a built material and list it */
async function olStore(rec){await store.put(rec,'materials');
  const view=dlView(rec),old=dlLib.list.findIndex(r=>r.id===rec.id);if(old>=0){const o=dlLib.list[old];if(o._t)for(const k in o._t)disposeTarget(o._t[k]);dlLib.list[old]=view;}else dlLib.list.push(view);
  return view;}
/* Poly Haven: the map files (colour, normal, packed roughness/AO/metal or the single maps, height) one by one, then built like any other */
async function pvFiles(it,res,row){const rk=res.toLowerCase(),files=JSON.parse(await platform.invoke('net_get_text',{url:PV_API+'/files/'+it.id}));
  const pick=k=>{const e=files[k]&&files[k][rk],f=e&&(e.jpg||e.png);return f?f.url:null;};
  const urls=[pick('Diffuse'),pick('nor_gl'),pick('Displacement')].filter(Boolean),arm=pick('arm');
  if(arm)urls.push(arm);else for(const k of ['Rough','AO','Metal']){const u=pick(k);if(u)urls.push(u);}
  if(!urls.length)throw new Error('that size is not available');
  const out=[];let n=0;for(const u of urls){if(row){row.state='downloading';row.sub=(++n)+' of '+urls.length;olDraw(true);}const ab=await olZipGet(u,row);out.push(new File([ab],u.split('/').pop().split('?')[0]));}
  return out;}
async function olMakePV(it,res,row){if(!it.dl[res])res='1K';const files=await pvFiles(it,res,row);if(row){row.state='building';row.sub='';olDraw(true);}
  const built=await miBuild(files,it.name,OL_RES[res]);
  return olStore({id:'d:ph:'+it.id,name:it.name,t:Date.now(),kind:'material',dl:{aid:'ph:'+it.id,res,upg:false,src:'ph'},cat:it.cat,credit:'Poly Haven · '+(it.authors.join(', ')||'Poly Haven')+' (CC0)',url:'https://polyhaven.com/a/'+it.id,
    thumb:await olThumb(it,built),fill:built.fill,imgs:built.imgs});}

/* grunge: ambientCG materials also carry grey maps; the height (else AO, else roughness) goes to Textures */
async function olGrunge(it,row){let files;if(it.src==='ph'){const rk='1k',fl=JSON.parse(await platform.invoke('net_get_text',{url:PV_API+'/files/'+it.id})),u=['Displacement','Rough','AO'].map(k=>fl[k]&&fl[k][rk]&&(fl[k][rk].jpg||fl[k][rk].png)).filter(Boolean).map(f=>f.url)[0];
    if(!u)throw new Error('no grey map in that download');files=[new File([await olZipGet(u,row)],u.split('/').pop())];}
  else{const ab=await olZipGet(it.dl['1K']?it.dl['1K'].url:olZip(it.id,'1K'),row);files=await miUnzip(ab);}
  if(row){row.state='building';olDraw(true);}
  let pick=null;for(const want of (OL_GRUNGE_OPACITY.includes(it.dc)?['opac','rough','height','ao']:OL_GRUNGE.includes(it.dc)?['rough','height','ao']:['height','ao','rough'])){for(const f of files){const c=miChannel(f.name);if(c&&c.k===want){pick=f;break;}}if(pick)break;}
  if(!pick)throw new Error('no grey map in that download');
  const t=await fileTarget(pick),d=captureRegionNow(t,0,0,t.w,t.h).data;for(let i=0;i<d.length;i+=4){const g=Math.round(d[i]*.299+d[i+1]*.587+d[i+2]*.114);d[i]=d[i+1]=d[i+2]=g;d[i+3]=255;}
  writeRegion(t,0,0,t.w,t.h,d);await txAddTarget(t,it.name+(it.src==='ph'?' (Poly Haven)':' (ambientCG)'));}
/* ---- the window ---- */
function olSelCount(){return ol.sel.size;}
function olEstimate(){let b=0;for(const it of ol.sel.values()){const d=it.dl[ol.res]||it.dl['1K'];b+=d?d.size:0;}return b;}
function olTile(it,owned){const own=owned.get(it.src==='ph'?'ph:'+it.id:it.id),on=ol.sel.has(it.id);
  const b=el('button',{type:'button',class:'oltile'+(on?' sel':'')+(own?' own':''),'data-id':it.id,'aria-pressed':String(on),title:it.name+' ('+it.dc+')'+(own?' — already in your Library ('+own+')':'')+'. Click to select.',
    onclick:()=>{if(ol.busy)return;if(ol.sel.has(it.id))ol.sel.delete(it.id);else ol.sel.set(it.id,it);olDraw();}},
    el('img',{src:it.thumb,alt:'',loading:'lazy',decoding:'async',draggable:'false'}),el('span',{class:'olname',text:it.name}),
    ...(own?[el('span',{class:'olown',text:own==='1K'?'In Library':'In Library · '+own})]:[]),el('span',{class:'olcheck',text:on?'✓':''}));return b;}
function olDraw(light){const b=ol.body;if(!b||!document.contains(b))return;const owned=olOwned();
  ol.chips.replaceChildren(...[...(ol.src==='ph'?['all']:['all','grunge']),...Object.keys(OL_GROUPS)].map(c=>el('button',{type:'button',class:'chip'+(ol.cat===c?' on':''),'data-cat':c,text:c==='all'?'All':c==='grunge'?'Grunge maps':c,title:c==='grunge'?'Scratches, smears, dirt and rust: grey maps for the Textures panel':null,disabled:!!ol.busy,onclick:()=>{if(ol.cat===c)return;ol.cat=c;ol.offset=0;olSearch();}})));
  if(!light||!ol.grid.childNodes.length){ol.grid.replaceChildren(...(ol.items.length?ol.items.map(it=>olTile(it,owned)):[el('p',{class:'note olmsg',text:ol.loading?'Loading…':(ol.err||'Nothing found. Try another word or category.')})]));ol.grid.classList.toggle('loading',ol.loading);}
  else ol.grid.querySelectorAll('.oltile').forEach(t=>{const id=t.dataset.id,on=ol.sel.has(id);t.classList.toggle('sel',on);t.setAttribute('aria-pressed',String(on));t.querySelector('.olcheck').textContent=on?'✓':'';});
  ol.credit.textContent=ol.src==='ph'?'Powered by Poly Haven (polyhaven.com). The textures are CC0, free for any use; each material keeps its creator’s name.':'Materials come from ambientCG.com (CC0, free for any use). Each keeps its source in its details.';
  const n=olSelCount(),from=ol.total?ol.offset+1:0,to=Math.min(ol.total,ol.offset+ol.items.length);
  const busy=ol.busy,shown=busy?busy.rows:(ol.last||[]),rows=shown.map(r=>el('div',{class:'olrow','data-job':r.job||''},el('span',{class:'olrn',text:r.it.name}),el('span',{class:'olstat',text:({waiting:'Waiting',downloading:'Downloading…',building:'Building the material…',done:'Added',failed:'Failed: '+(r.err||''),cancelled:'Cancelled',skipped:'Skipped'})[r.state]||r.state}),el('div',{class:'bakebar',hidden:r.state!=='downloading'},el('div',{style:'width:'+(r.job&&ol.prog[r.job]&&ol.prog[r.job].total?Math.round(ol.prog[r.job].got/ol.prog[r.job].total*100):0)+'%'}))));
  ol.foot.replaceChildren(
    el('div',{class:'olpage'},el('button',{type:'button',class:'btn sm',id:'olPrev',text:'‹ Previous',disabled:ol.loading||ol.offset===0||!!busy,onclick:()=>{ol.offset=Math.max(0,ol.offset-OL_PAGE);olSearch();}}),
      el('span',{class:'dim',text:ol.total?from+'–'+to+' of '+ol.total:''}),el('button',{type:'button',class:'btn sm',id:'olNext',text:'Next ›',disabled:ol.loading||to>=ol.total||!!busy,onclick:()=>{ol.offset+=OL_PAGE;olSearch();}})),
    el('div',{class:'olact'},el('span',{class:'dim',text:n?n+' selected · about '+olMB(olEstimate())+' to download':'Click materials to select them.'}),
      el('button',{type:'button',class:'btn'+(ol.cat==='grunge'?'':' primary'),id:'olAdd',text:n?'Add '+n+' to Library':'Add to Library',disabled:!n||!!busy,onclick:()=>olRun('material')}),
      el('button',{type:'button',class:'btn'+(ol.cat==='grunge'?' primary':''),id:'olGrunge',text:'Add as grunge map'+(n>1?'s':''),title:'Take the grey height map of each selected material and add it to Textures',disabled:!n||!!busy,onclick:()=>olRun('grunge')}),
      ...(busy?[el('button',{type:'button',class:'btn',id:'olCancel',text:'Cancel',onclick:olCancel})]:[])),
    ...(rows.length?[el('div',{class:'olrows'},...rows)]:[]));}
function olCancel(){const b=ol.busy;if(!b)return;b.cancel=true;for(const r of b.rows)if(r.job)platform.invoke('net_cancel',{id:r.job}).catch(()=>{});}
async function olRun(mode){if(ol.busy||!ol.sel.size)return;const list=[...ol.sel.values()],res=ol.res;
  ol.last=null;ol.busy={cancel:false,rows:list.map(it=>({it,state:'waiting',job:null,err:''}))};olDraw();let done=0,failed=0;
  for(const row of ol.busy.rows){if(ol.busy.cancel){row.state='skipped';continue;}row.state='downloading';olDraw(true);
    try{if(mode==='grunge')await olGrunge(row.it,row);else if(row.it.src==='ph')await olMakePV(row.it,res,row);else{const d=row.it.dl[res]||row.it.dl['1K'];await olMake({id:row.it.id,name:row.it.name,cat:row.it.cat,thumb:row.it.thumb,url:d.url},res in row.it.dl?res:'1K',row);}
      row.state='done';done++;ol.sel.delete(row.it.id);if(mode!=='grunge')renderMats();}
    catch(e){const m=e&&e.message||String(e);if(m==='cancelled'||ol.busy.cancel){row.state='cancelled';}else{row.state='failed';row.err=m;failed++;console.warn(e);}}
    olDraw(true);}
  const was=ol.busy;ol.last=was.rows;ol.busy=null;olDraw();
  toast(done?('Added '+done+(mode==='grunge'?' grunge map':' material')+(done>1?'s':'')+(mode==='grunge'?' to Textures.':' to the Library.')):(was.cancel?'Cancelled.':'Nothing was added.')+(failed?' '+failed+' failed.':''));}
function dlgOnlineLib(){
  if(!platform.isDesktop){openDialog({title:'Get more materials',body:el('div',{class:'dlg-grid'},el('p',{text:'Downloading materials needs the Gouache Studio desktop app. The web version cannot ask ambientCG directly.'}),el('p',{class:'note',text:'You can still download materials from ambientcg.com yourself and use Materials › From textures… to add them.'})),okLabel:null,cancelLabel:'Close'});return;}
  olListen();
  const q=el('input',{type:'search',id:'olSearch',class:'matsearch',placeholder:'Search (for example “rust”, “leather”, “brick”)','aria-label':'Search ambientCG',value:ol.q}),
    go=()=>{if(ol.busy)return;ol.q=q.value;ol.offset=0;olSearch();};
  q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}});
  const sort=seg([['Popular','Popular'],['Latest','Newest']],ol.sort,v=>{ol.sort=v;ol.offset=0;olSearch();},'Sort'),
    res=seg([['1K','1K'],['2K','2K'],['4K','4K']],ol.res,v=>{ol.res=v;olDraw(true);},'Picture size'),
    sepBox=chk('olSeparate','Keep downloaded materials in their own “Downloaded” group only (otherwise they are mixed into the categories)',!!prefs.dlSeparate,v=>{prefs.dlSeparate=v?true:undefined;savePrefs();renderMats();});
  ol.chips=el('div',{class:'chips olchips'});ol.grid=el('div',{class:'olgrid',id:'olGrid'});ol.foot=el('div',{class:'olfoot'});
  const src=seg([['ac','ambientCG'],['ph','Poly Haven']],ol.src,v=>{if(ol.busy||ol.src===v)return;ol.src=v;ol.cat='all';ol.offset=0;ol.items=[];ol.total=0;ol.sel.clear();olSearch();},'Source');
  ol.credit=el('p',{class:'note',id:'olCredit'});
  ol.body=el('div',{class:'olwin'},el('div',{class:'olsrc'},el('span',{class:'dim',text:'Source'}),src),el('div',{class:'olbar'},q,el('button',{type:'button',class:'btn',id:'olGo',text:'Search',onclick:go}),sort),ol.chips,
    el('div',{class:'olres'},el('span',{class:'dim',text:'Picture size'}),res,el('span',{class:'note',text:'1K is small and quick (a few MB each). 2K and 4K are sharper but much bigger, and heavier to paint with.'})),
    ol.grid,ol.foot,sepBox,ol.credit);
  openDialog({title:'Get more materials',body:ol.body,okLabel:null,cancelLabel:'Close',wide:true,resizable:true,onCancel(){if(ol.busy)olCancel();ol.body=null;}});
  if(!ol.items.length)olSearch();else olDraw();}
/* ---- upgrade the whole bundled Library to 2K or 4K (File > Add-ons) ---- */
const olUp={busy:null,ask:null,sizes:{'2K':{dl:21e6,kept:1.9e6},'4K':{dl:73e6,kept:7e6}}};
function olUpTargets(res){const have=new Map(dlLib.list.map(r=>[r.dl.aid,r.dl.res]));const rank={'1K':1,'2K':2,'4K':3};
  return gmRecs.filter(r=>r.kind!=='smart').map(r=>({r,id:olIdOf(r.credit)})).filter(x=>x.id&&!(have.has(x.id)&&rank[have.get(x.id)]>=rank[res])).map(x=>({id:x.id,name:x.r.name,cat:x.r.cat,thumb:x.r.thumb,upg:true,url:olZip(x.id,res)}));}
function olUpStats(){const have=dlLib.list.filter(r=>r.dl.upg),n={'2K':0,'4K':0};for(const r of have)n[r.dl.res]=(n[r.dl.res]||0)+1;return {have:have.length,n,total:gmRecs.filter(r=>olIdOf(r.credit)).length};}
async function olUpgrade(res,onStep){if(olUp.busy)return;const list=olUpTargets(res);if(!list.length){toast('The whole Library is already at '+res+' or better.');return;}
  const st={cancel:false,done:0,failed:0,total:list.length,res,cur:'',jobRow:{job:null}};olUp.busy=st;
  for(const info of list){if(st.cancel)break;st.cur=info.name;onStep&&onStep();
    try{st.jobRow.job=null;await olMake(info,res,st.jobRow);st.done++;if(dlLib.list.length)renderMats();}
    catch(e){const m=e&&e.message||String(e);if(m==='cancelled'||st.cancel)break;st.failed++;console.warn(info.id,e);if(st.failed>=5&&st.failed>st.done+4){toast('Too many downloads failed. Check your internet connection and try again later.');break;}}
    onStep&&onStep();}
  olUp.busy=null;onStep&&onStep();renderMats();
  toast(st.cancel?'Stopped after '+st.done+' materials. Press upgrade again to carry on where it stopped.':'Upgraded '+st.done+' of '+st.total+' materials to '+res+(st.failed?' ('+st.failed+' failed; press upgrade again to retry them).':'.'));}
function olUpCancel(){const st=olUp.busy;if(!st)return;st.cancel=true;if(st.jobRow&&st.jobRow.job)platform.invoke('net_cancel',{id:st.jobRow.job}).catch(()=>{});}
async function olUpRemove(){const mine=dlLib.list.filter(r=>r.dl.upg);for(const r of mine){await store.del(r.id,'materials');if(r._t)for(const k in r._t)disposeTarget(r._t[k]);}dlLib.list=dlLib.list.filter(r=>!r.dl.upg);renderMats();toast('The Library is back to the 1K materials that come with the app.');}
/* the section shown in the add-ons window (asks inside the window, so progress stays in view) */
function olUpSection(rebuild){const S=olUpStats(),busy=olUp.busy,box=el('div',{class:'airow olup'+(S.have?' on':''),id:'olUpSection'});
  const dis=!platform.isDesktop||!!busy,ask=olUp.ask,re=()=>{if(rebuild)rebuild();};
  const row=res=>{const z=olUp.sizes[res],targets=platform.isDesktop?olUpTargets(res).length:0;
    return el('button',{type:'button',class:'btn sm primary',id:'olUp'+res,disabled:dis||!targets,text:targets?'Upgrade to '+res+' ('+targets+' materials)':'Already at '+res+' or better',onclick:()=>{olUp.ask=res;re();}});};
  box.append(el('div',{class:'aihead'},el('b',{text:'Library pictures: 2K / 4K'}),el('span',{class:'dim',text:'ambientCG · CC0'}),el('span',{class:'aistat',text:busy?'Upgrading '+busy.done+' of '+busy.total+' to '+busy.res:S.have?S.have+' of '+S.total+' upgraded':'1K (comes with the app)'})),
    el('p',{class:'note',text:'The materials that come with the app are 1K (1024 pixels). This downloads the sharper 2K or 4K originals from ambientCG and uses them in their place. Bigger pictures look better up close but use much more memory and disk, so most projects do best with 1K or 2K.'}),
    ...(platform.isDesktop?[]:[el('p',{class:'note',text:'Needs the desktop app.'})]),
    el('div',{class:'chips'},row('2K'),row('4K')));
  if(ask&&ask!=='remove'&&!busy){const z=olUp.sizes[ask],n=olUpTargets(ask).length;
    box.append(el('p',{class:'note',id:'olUpAsk',text:'Upgrade '+n+' materials to '+ask+'? This downloads about '+olMB(n*z.dl)+' and keeps about '+olMB(n*z.kept)+' on this computer. It can take a long time. You can stop it at any time, and what is done is kept.'}),
      el('div',{class:'chips'},el('button',{type:'button',class:'btn sm primary',id:'olUpGo',text:'Start the upgrade',onclick:()=>{olUp.ask=null;olUpgrade(ask,re);re();}}),el('button',{type:'button',class:'btn sm',text:'Not now',onclick:()=>{olUp.ask=null;re();}})));}
  if(busy)box.append(el('div',{class:'olrow'},el('span',{class:'olrn',text:busy.cur}),el('button',{type:'button',class:'btn sm',id:'olUpStop',text:'Stop',onclick:olUpCancel})));
  if(S.have&&!busy){if(ask==='remove')box.append(el('p',{class:'note',text:'Delete the upgraded pictures? The 1K materials that come with the app are used again. Layers that already use an upgraded material keep it.'}),
      el('div',{class:'chips'},el('button',{type:'button',class:'btn sm primary',id:'olUpRemoveGo',text:'Go back to 1K',onclick:async()=>{olUp.ask=null;await olUpRemove();re();}}),el('button',{type:'button',class:'btn sm',text:'Not now',onclick:()=>{olUp.ask=null;re();}})));
    else box.append(el('div',{class:'chips'},el('button',{type:'button',class:'btn sm',id:'olUpRemove',text:'Back to 1K',title:'Delete the upgraded pictures and use the 1K materials again',onclick:()=>{olUp.ask='remove';re();}})));}
  return box;}
