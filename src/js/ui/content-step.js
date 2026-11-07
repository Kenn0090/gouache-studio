/* ================= Content (0.95): the download choices at first launch, and File › Content… =================
   What comes with the app is the 1K Library, 1K skies and the grunge maps. This window offers the bigger versions and the
   AI add-ons in one place, with the real sizes:
     Library pictures  2K / 4K   (the existing ambientCG upgrade, olUpgrade)
     Skies             2K        (Poly Haven HDRIs; the 3D view uses at most 2048 pixels wide, so 4K would add nothing)
     AI add-ons                  (aiInstall, one part at a time)
   It opens by itself once per CONTENT_VER (a new Library or new downloads ask again; nothing else does) and any time from
   the File menu. Desktop app only: the web version cannot ask those sites directly. */
const CONTENT_VER=1;
const ct={offHave:null,body:null,busy:null,pick:null,status:'',log:[],stop:false,job:null,first:false,envHave:null};
const CT_ENV_MB=7e6;/* a 2K .hdr from Poly Haven is about 6 to 9 MB */
/* the smaller installer leaves the Library files, skies and grunge maps out: they are fetched when first used and a copy is kept.
   This row downloads all of them now, so the app works offline. */
const ctLite=()=>(typeof GM_LITE!=='undefined'&&GM_LITE)||/[?&]lite\b/.test(location.search);
const CT_OFF_MB={materials:5e5,hdri:1.4e6,grunge:3.5e5};
function ctOffList(){const L=[];for(const g of GM_BUNDLED)L.push(['materials',g.file]);for(const e of ENV_LIST)L.push(['hdri',e[2]+'_1k.hdr']);for(const t of TX_PHOTO)L.push(['grunge',t[0]+'.webp']);return L;}
async function ctOffRefresh(){const have=new Set();for(const [k,f] of ctOffList()){if(await aiDB.info('b/'+k+'/'+f).catch(()=>null))have.add(k+'/'+f);}ct.offHave=have;}
const ctOffMissing=()=>ctOffList().filter(([k,f])=>!(ct.offHave&&ct.offHave.has(k+'/'+f)));
function ctPick(){if(!ct.pick)ct.pick={lib:prefs.ctLib||'2K',env:prefs.ctEnv||'2K',ai:new Set(),off:ctLite(),g4:false};return ct.pick;}
async function ctEnvRefresh(){const have={};for(const e of ENV_LIST){try{have[e[2]]=!!(await aiDB.info('hdri/'+e[2]+'_2k.hdr'));}catch(err){have[e[2]]=false;}}ct.envHave=have;}
const ctEnvMissing=()=>ENV_LIST.filter(e=>!(ct.envHave&&ct.envHave[e[2]]));
/* one sky at 2K from Poly Haven, kept in the add-ons store (envBundled looks there first) */
async function ctEnvGet(e){const fl=JSON.parse(await platform.invoke('net_get_text',{url:'https://api.polyhaven.com/files/'+e[2]})),u=fl&&fl.hdri&&fl.hdri['2k']&&fl.hdri['2k'].hdr&&fl.hdri['2k'].hdr.url;
  if(!u)throw new Error('no 2K file for '+e[1]);const id='ct'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);ct.job=id;
  try{const ab=await platform.invoke('net_download',{id,url:u}),buf=ab instanceof ArrayBuffer?ab:(ab&&ab.buffer)||new Uint8Array(ab).buffer;
    await aiDB.put('hdri/'+e[2]+'_2k.hdr',{buf,size:buf.byteLength,v:1});}finally{ct.job=null;}}
async function ctEnvBack(){for(const e of ENV_LIST){try{await aiDB.del('hdri/'+e[2]+'_2k.hdr');}catch(err){}}env.key=null;await ctEnvRefresh();v3.dirty=true;requestRender();toast('The skies are back to the 1K ones that come with the app.');}
function ctEstimates(){const P=ctPick(),parts=[...P.ai];if(parts.length&&!aiHas('engine')&&!parts.includes('engine'))parts.push('engine');
  const lib=P.lib==='1K'?0:olUpTargets(P.lib).length*olUp.sizes[P.lib].dl,envN=P.env==='2K'?ctEnvMissing().length:0,ai=parts.reduce((a,i)=>a+aiSize(i),0);
  const offM=ctLite()&&P.off?ctOffMissing():[],off=offM.reduce((a,[k])=>a+CT_OFF_MB[k],0);
  const g4N=P.g4?g4Missing().length:0,g4b=g4N*G4_MB;
  return {lib,env:envN*CT_ENV_MB,envN,ai,parts,off,offN:offM.length,g4N,g4:g4b,total:lib+envN*CT_ENV_MB+ai+off+g4b};}
function ctDraw(light){const b=ct.body;if(!b||!document.contains(b))return;const P=ctPick(),E=ctEstimates(),busy=!!ct.busy;
  const choice=(id,items,get,set)=>seg(items,get(),v=>{if(busy)return;set(v);ctDraw();},id);
  const libTargets=n=>olUpTargets(n).length;
  const libRow=el('div',{class:'airow'},el('div',{class:'aihead'},el('b',{text:'Material Library pictures'}),el('span',{class:'dim',text:'ambientCG · CC0'})),
    el('p',{class:'note',text:'The Library that comes with the app is 1K (sharp enough for most work and light on memory). 2K and 4K are the sharper originals. They look better up close and use much more memory and disk.'}),
    choice('Library size',[['1K','Keep 1K'],['2K','2K'],['4K','4K']],()=>P.lib,v=>{P.lib=v;prefs.ctLib=v;savePrefs();}),
    el('label',{class:'chk'},(()=>{const c=el('input',{type:'checkbox',id:'ctGrey2k'});c.checked=prefs.grey2k!==false;c.onchange=()=>{prefs.grey2k=c.checked?undefined:false;savePrefs();};return c;})(),el('span',{text:'Keep roughness, AO, metal and height at 2K in 4K materials (colour and normal stay 4K): a quarter of the memory and disk for those maps, barely visible'})),
    el('p',{class:'note',text:P.lib==='1K'?'Nothing to download.':libTargets(P.lib)?'About '+olMB(E.lib)+' to download for '+libTargets(P.lib)+' materials, and about '+olMB(libTargets(P.lib)*olUp.sizes[P.lib].kept)+' kept on this computer. It takes a while; you can stop at any time and what is done is kept.':'The whole Library is already at '+P.lib+' or better.'}));
  const envRow=el('div',{class:'airow'},el('div',{class:'aihead'},el('b',{text:'Skies (lighting pictures)'}),el('span',{class:'dim',text:'Poly Haven · CC0'})),
    el('p',{class:'note',text:'The five skies that come with the app are 1K. 2K is sharper in reflections and as a background. (The 3D view uses at most 2048 pixels wide, so there is no 4K.)'}),
    choice('Sky size',[['1K','Keep 1K'],['2K','2K']],()=>P.env,v=>{P.env=v;prefs.ctEnv=v;savePrefs();}),
    el('p',{class:'note',id:'ctEnvNote',text:P.env==='1K'?'Nothing to download.':E.envN?'About '+olMB(E.env)+' to download ('+E.envN+' of '+ENV_LIST.length+' skies).':'All the skies are already 2K.'}),
    ...(ct.envHave&&ENV_LIST.some(e=>ct.envHave[e[2]])&&!busy?[el('div',{class:'chips'},el('button',{type:'button',class:'btn sm',id:'ctEnvBack',text:'Back to 1K skies',onclick:ctEnvBack}))]:[]));
  const g4All=g4List().length,g4Have=g4.have?g4.have.size:0,g4Row=el('div',{class:'airow',id:'ctG4'},el('div',{class:'aihead'},el('b',{text:'Grunge maps at 4K'}),el('span',{class:'dim',text:'ambientCG · CC0'}),el('span',{class:'aistat',text:g4Have?g4Have+' of '+g4All+' at 4K':'1K (comes with the app)'})),
    el('p',{class:'note',text:'The '+g4All+' photo grunges scanned by ambientCG (scratches, fingerprints, smears, stains, dust, leaks, cracks, rust and more) come with the app at 1K. This fetches the 4K originals for close-ups and big textures. Each one is downloaded as a whole material (10 to 80 MB) and only its grunge is kept (about 3 MB each). Pictures already open stay 1K until the next start.'}),
    el('label',{class:'chk'},el('input',{type:'checkbox',id:'ctG4On',checked:P.g4,disabled:busy||!g4Missing().length,onchange:ev=>{P.g4=ev.target.checked;ctDraw();}}),el('span',{text:g4Missing().length?'Download the 4K grunge maps ('+g4Missing().length+', about '+olMB(g4Missing().length*G4_MB)+' to download)':'All the grunge maps are already 4K'})),
    ...(g4Have&&!busy?[el('div',{class:'chips'},el('button',{type:'button',class:'btn sm',id:'ctG4Back',text:'Back to 1K grunge',onclick:async()=>{await g4Back();ctDraw();}}))]:[]));
  const aiIds=AI_ORDER.filter(i=>i!=='engine'),aiRow=el('div',{class:'airow'},el('div',{class:'aihead'},el('b',{text:'AI add-ons'}),el('span',{class:'dim',text:'runs on this computer'})),
    el('p',{class:'note',text:'Pick out a subject or the sky with a click, take an object out of a photo, lens blur, relight, upscale and height maps from photos. Nothing is sent anywhere. Tick the parts you want; the AI engine comes with them.'}),
    ...aiIds.map(i=>{const have=aiHas(i);return el('label',{class:'chk ctai'},el('input',{type:'checkbox','data-ai':i,checked:have||P.ai.has(i),disabled:have||busy,onchange:ev=>{if(ev.target.checked)P.ai.add(i);else P.ai.delete(i);ctDraw();}}),el('span',{text:AI_PARTS[i].title+' · '+aiMB(aiSize(i))+(have?' (installed)':'')}));}));
  const offRow=ctLite()?el('div',{class:'airow'},el('div',{class:'aihead'},el('b',{text:'Starter content for offline work'}),el('span',{class:'dim',text:'this is the smaller installer'})),
    el('p',{class:'note',text:'The 1K Library, the skies and the grunge maps are not inside this installer. They are fetched from the internet when you first use them, and a copy is kept. Download them all now to work offline.'}),
    el('label',{class:'chk ctoff'},el('input',{type:'checkbox',id:'ctOff',checked:P.off,disabled:busy,onchange:ev=>{P.off=ev.target.checked;ctDraw();}}),el('span',{text:E.offN?'Download the starter content now ('+E.offN+' files, about '+olMB(E.off)+')':'All the starter content is already on this computer'}))):null;
  const run=el('div',{class:'olact'},el('span',{class:'dim',id:'ctTotal',text:busy?(ct.status||'Working…'):E.total?'In all about '+olMB(E.total)+' to download.':'Nothing selected to download.'}),
    ...(busy?[el('button',{type:'button',class:'btn',id:'ctStop',text:'Stop',onclick:ctStop})]:[el('button',{type:'button',class:'btn primary',id:'ctGo',text:'Download selected',disabled:!E.total,onclick:ctRun})]));
  const log=ct.log.length?[el('div',{class:'olrows'},...ct.log.map(t=>el('div',{class:'olrow'},el('span',{class:'olrn',text:t}))))]:[];
  b.replaceChildren(...(offRow?[offRow]:[]),libRow,envRow,g4Row,aiRow,run,...log,el('p',{class:'note',text:'File › Content… opens this again any time. Skies and AI parts can also be removed there and in File › Add-ons.'}));}
function ctStop(){ct.stop=true;if(ct.job)platform.invoke('net_cancel',{id:ct.job}).catch(()=>{});if(typeof olUpCancel==='function')olUpCancel();}
async function ctRun(){if(ct.busy)return;const E=ctEstimates(),P=ctPick();ct.busy=true;ct.stop=false;ct.log=[];ct.status='Starting…';ctDraw();
  const say=t=>{ct.status=t;ctDraw(true);};
  try{
    if(ctLite()&&P.off&&!ct.stop){const todo=ctOffMissing();let n=0,bad=0;for(const [k,f] of todo){if(ct.stop)break;say('Starter content '+(n+1)+' of '+todo.length);try{await bcGet(k,f,null);n++;}catch(e){bad++;if(bad>8){ct.log.push('Starter content: stopped, too many files failed (check your internet connection)');break;}}}
      await ctOffRefresh();ct.log.push('Starter content: '+n+' of '+todo.length+(ct.stop?' (stopped; what is done is kept)':' done'));}
    for(const id of E.parts){if(ct.stop)break;if(aiHas(id))continue;try{await aiInstall(id,(f,txt)=>say((txt||id)+' · '+Math.round(f*100)+'%'));ct.log.push(AI_PARTS[id].title+': done');}catch(e){ct.log.push(AI_PARTS[id].title+': failed ('+(e&&e.message||e)+')');}}
    if(P.env==='2K'&&!ct.stop){const todo=ctEnvMissing();let n=0;for(const e of todo){if(ct.stop)break;say('Sky '+(n+1)+' of '+todo.length+': '+e[1]);try{await ctEnvGet(e);n++;}catch(err){if(ct.stop)break;ct.log.push('Sky '+e[1]+': failed ('+(err&&err.message||err)+')');}}
      env.key=null;await ctEnvRefresh();if(n)ct.log.push(n+' sky'+(n>1?'s':'')+' at 2K: done');}
    if(P.g4&&!ct.stop){const todo=g4Missing();let n=0,bad=0;for(const s of todo){if(ct.stop)break;const nm=(TX_PHOTO.find(t=>t[0]===s)||[s,s])[1];say('Grunge '+(n+bad+1)+' of '+todo.length+' at 4K: '+nm);
        try{await g4Get(s,j=>{ct.job=j;});n++;}catch(e){if(ct.stop)break;bad++;ct.log.push('Grunge '+nm+': failed ('+(e&&e.message||e)+')');if(bad>=5&&bad>n+4){ct.log.push('Grunge: stopped, too many failed (check your internet connection)');break;}}}
      ct.log.push(n+' grunge map'+(n===1?'':'s')+' at 4K'+(ct.stop?' (stopped; what is done is kept)':': done'));P.g4=false;}
    if(P.lib!=='1K'&&!ct.stop){say('Library to '+P.lib+'…');await olUpgrade(P.lib,()=>{const s=olUp.busy;if(s)say('Library '+s.done+' of '+s.total+' to '+s.res+(s.cur?' · '+s.cur:''));});ct.log.push('Library pictures: '+(ct.stop?'stopped (what is done is kept)':'done'));}
  }catch(e){console.warn(e);ct.log.push('Stopped: '+(e&&e.message||e));}
  ct.busy=null;ct.status='';prefs.contentVer=CONTENT_VER;savePrefs();ctDraw();toast(ct.stop?'Stopped. What was downloaded is kept; File › Content… carries on.':'Downloads finished.');}
function dlgContent(first){if(!platform.isDesktop){openDialog({title:'Content',body:el('div',{class:'dlg-grid'},el('p',{text:'Downloading bigger pictures, skies and the AI add-ons needs the Gouache Studio desktop app. The web version cannot ask those sites directly.'})),okLabel:'',cancelLabel:'Close'});return;}
  ct.first=!!first;ct.body=el('div',{class:'dlg-grid ctdlg',id:'ctBody'});
  openDialog({title:first?'Choose what to download':'Content',body:ct.body,okLabel:'',cancelLabel:first?'Not now':'Close',wide:true,onCancel(){if(ct.busy)ctStop();if(first&&!ct.busy){prefs.contentVer=CONTENT_VER;savePrefs();}ct.body=null;}});
  ctDraw();Promise.all([ctEnvRefresh(),g4Refresh(),ctLite()?ctOffRefresh():null,typeof aiRefresh==='function'?aiRefresh():null]).then(()=>ctDraw()).catch(()=>{});}
/* once per CONTENT_VER, after the launch and welcome screens (never in tests, never on the web) */
function contentOfferOnce(){if(!platform.isDesktop||(prefs.contentVer||0)>=CONTENT_VER||navigator.webdriver||/[?&]debug\b/.test(location.search)||document.getElementById('welcome')||document.getElementById('setup')||!modal.hidden)return;dlgContent(true);}
Object.assign(actions,{content:()=>dlgContent(false)});
