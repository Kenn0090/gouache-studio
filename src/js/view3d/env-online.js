/* ================= More skies (0.98.11, Kenn: "download more HDRIs") =================
   Environments shelf > "Get more skies…": browse Poly Haven's free HDRIs (CC0), pick 1K / 2K / 4K, download.
   A downloaded sky is kept in the add-ons store (aiDB 'hdri/<name>_2k.hdr', so envBundled finds it), listed with the
   bundled ones (ENV_LIST id 'ph_<name>'), and its creators are shown here and on the wiki's 3D view page.
   The desktop app does the asking (net_get_text / net_download), like the Library's online search. */
const hv={list:null,q:'',cat:'all',res:'2K',err:'',loading:false,busy:null,mine:[],body:null,grid:null,page:0,prog:{}};
const HV_PAGE=24,HV_CATS=['all','outdoor','indoor','studio','sunrise-sunset','skies','nature','urban'];
const hvRes={'1K':'1k','2K':'2k','4K':'4k'};
async function hvMineEnsure(){try{const r=await aiDB.get('hdri/_mine');hv.mine=(r&&r.list)||[];}catch(e){hv.mine=[];}
  for(const m of hv.mine)if(!ENV_LIST.some(e=>e[0]==='ph_'+m.id))ENV_LIST.push(['ph_'+m.id,m.name,m.id,m.by||'Poly Haven']);
  if(typeof renderEnvs==='function')try{renderEnvs();}catch(e){}}
async function hvMineSave(){try{await aiDB.put('hdri/_mine',{list:hv.mine});}catch(e){}}
async function hvLoad(){if(hv.list)return hv.list;const j=JSON.parse(await platform.invoke('net_get_text',{url:PV_API+'/assets?t=hdris'}));
  hv.list=Object.entries(j).map(([id,a])=>({id,name:a.name||id,cats:a.categories||[],tags:a.tags||[],by:Object.keys(a.authors||{}),thumb:a.thumbnail_url||'',pop:a.download_count||0,mx:Math.max(...(a.max_resolution||[1024]))})).sort((a,b)=>b.pop-a.pop);return hv.list;}
const hvHave=id=>hv.mine.some(m=>m.id===id)||ENV_LIST.some(e=>e[2]===id);
function hvFiltered(){const q=hv.q.trim().toLowerCase();return (hv.list||[]).filter(a=>(hv.cat==='all'||a.cats.includes(hv.cat))&&(!q||a.name.toLowerCase().includes(q)||a.id.includes(q)||a.tags.some(t=>t.toLowerCase().includes(q))||a.by.some(b=>b.toLowerCase().includes(q))));}
async function hvGet(a,res){const fl=JSON.parse(await platform.invoke('net_get_text',{url:PV_API+'/files/'+a.id})),u=fl&&fl.hdri&&fl.hdri[hvRes[res]]&&fl.hdri[hvRes[res]].hdr&&fl.hdri[hvRes[res]].hdr.url;
  if(!u)throw new Error('No '+res+' file for '+a.name+'.');const id='hv'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);hv.job=id;
  try{const ab=await platform.invoke('net_download',{id,url:u}),buf=ab instanceof ArrayBuffer?ab:(ab&&ab.buffer)||new Uint8Array(ab).buffer;
    await aiDB.put('hdri/'+a.id+'_2k.hdr',{buf,size:buf.byteLength,v:1});}finally{hv.job=null;}
  const rec={id:a.id,name:a.name,by:a.by.join(', ')||'Poly Haven',res};hv.mine=hv.mine.filter(m=>m.id!==a.id).concat(rec);await hvMineSave();
  const k='ph_'+a.id;if(!ENV_LIST.some(e=>e[0]===k))ENV_LIST.push([k,a.name,a.id,rec.by]);else{const e=ENV_LIST.find(e=>e[0]===k);e[3]=rec.by;}
  if(env.key===k)env.key=null;delete envThumbs[k];return k;}
async function hvDownload(a){if(hv.busy)return;hv.busy={id:a.id,text:'Downloading…'};hvDraw();
  try{const k=await hvGet(a,hv.res);hv.busy=null;toast('Added the sky “'+a.name+'”.');envPick(k);}catch(e){hv.busy=null;hv.err='Could not download “'+a.name+'”: '+(e&&e.message||e);}hvDraw();}
async function hvRemove(id){const k='ph_'+id;try{await aiDB.del('hdri/'+id+'_2k.hdr');}catch(e){}hv.mine=hv.mine.filter(m=>m.id!==id);await hvMineSave();
  const i=ENV_LIST.findIndex(e=>e[0]===k);if(i>=0)ENV_LIST.splice(i,1);if(envOf(v3s())===k){v3s().env='studio';env.key=null;envEnsure();v3.dirty=true;requestRender();}renderEnvs();hvDraw();}
function hvTile(a){const mine=hv.mine.find(m=>m.id===a.id),have=!!mine,bundled=!have&&hvHave(a.id),busy=hv.busy&&hv.busy.id===a.id;
  return el('div',{class:'oltile hvtile','data-id':a.id,title:a.name+' by '+(a.by.join(', ')||'Poly Haven')},
    el('img',{src:a.thumb+(a.thumb.includes('?')?'&':'?')+'width=256&height=128',alt:'',loading:'lazy',draggable:'false',style:'width:100%;aspect-ratio:2/1;object-fit:cover;border-radius:4px;background:var(--ground)'}),
    el('span',{class:'mtname',text:a.name}),el('span',{class:'dim',style:'font-size:11px',text:a.by.join(', ')}),
    have?el('div',{class:'chips'},el('button',{class:'btn sm',type:'button',text:'Use',onclick:()=>envPick('ph_'+a.id)}),el('button',{class:'btn sm',type:'button',text:'Remove',title:'Delete the downloaded file from this computer',onclick:()=>hvRemove(a.id)})):
    bundled?el('span',{class:'dim',text:'Already built in'}):
    el('button',{class:'btn sm primary hvget',type:'button',text:busy?hv.busy.text:'Download '+hv.res,disabled:!!hv.busy,onclick:()=>hvDownload(a)}));}
function hvDraw(){const b=hv.body;if(!b||!document.contains(b))return;const all=hvFiltered(),n=all.length,pages=Math.max(1,Math.ceil(n/HV_PAGE));hv.page=Math.min(hv.page,pages-1);
  hv.chips.replaceChildren(...HV_CATS.map(c=>el('button',{type:'button',class:'chip'+(hv.cat===c?' on':''),'data-cat':c,text:c==='all'?'All':c.replace('-',' / '),onclick:()=>{hv.cat=c;hv.page=0;hvDraw();}})));
  hv.grid.replaceChildren(...(hv.list?(n?all.slice(hv.page*HV_PAGE,hv.page*HV_PAGE+HV_PAGE).map(hvTile):[el('p',{class:'note',text:'Nothing found. Try another word.'})]):[el('p',{class:'note',text:hv.loading?'Loading the list…':(hv.err||'')})]));
  hv.foot.replaceChildren(el('button',{type:'button',class:'btn sm',id:'hvPrev',text:'‹ Previous',disabled:hv.page===0,onclick:()=>{hv.page--;hvDraw();}}),el('span',{class:'dim',text:n?(hv.page*HV_PAGE+1)+'–'+Math.min(n,hv.page*HV_PAGE+HV_PAGE)+' of '+n:''}),
    el('button',{type:'button',class:'btn sm',id:'hvNext',text:'Next ›',disabled:hv.page>=pages-1,onclick:()=>{hv.page++;hvDraw();}}),el('span',{class:'dim hverr',text:hv.list?hv.err:''}));}
function dlgMoreSkies(){
  if(!platform.isDesktop){toast('Downloading more skies works in the desktop app. In the browser, use Load your own… with a .hdr or .exr file.');return;}
  hv.err='';hv.q='';hv.page=0;
  const q=el('input',{type:'search',id:'hvSearch',placeholder:'Search skies (sunset, forest, studio…)','aria-label':'Search skies',style:'flex:1',oninput:()=>{hv.q=q.value;hv.page=0;hvDraw();}});
  const res=el('select',{id:'hvRes','aria-label':'Size'},...['1K','2K','4K'].map(r=>el('option',{value:r,text:r+(r==='1K'?' (about 1 MB)':r==='2K'?' (about 6 MB)':' (about 25 MB)'),selected:r===hv.res})));res.onchange=()=>{hv.res=res.value;hvDraw();};
  hv.chips=el('div',{class:'chips'});hv.grid=el('div',{class:'matgrid olgrid',id:'hvGrid'});hv.foot=el('div',{class:'olpage'});
  hv.body=el('div',{class:'dlg-grid',id:'hvBody'},el('div',{class:'chips'},q,res),hv.chips,hv.grid,hv.foot,
    el('p',{class:'note',text:'Powered by Poly Haven (polyhaven.com). The skies are CC0, free for any use; each tile shows its creator. A sky you download stays in the Environments list.'}));
  openDialog({title:'Get more skies',body:hv.body,okLabel:null,cancelLabel:'Close',float:true,onCancel(){hv.body=null;}});
  hvDraw();hv.loading=true;hvLoad().then(()=>{hv.loading=false;hvDraw();}).catch(e=>{hv.loading=false;hv.err='Could not reach Poly Haven: '+(e&&e.message||e);hvDraw();});}
setTimeout(()=>{try{hvMineEnsure();}catch(e){}},0);
