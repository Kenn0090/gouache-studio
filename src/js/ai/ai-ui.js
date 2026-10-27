/* ================= Add-ons window (File › Add-ons…): the AI parts, and (0.75) the Library's 2K / 4K pictures ================= */
let aiDlgBody=null;
function aiUiSync(){if(aiDlgBody&&document.body.contains(aiDlgBody))aiBuildDlg();}
function aiPartRow(id){const P=AI_PARTS[id],have=aiHas(id),st=AI.dl&&AI.dl[id];
  const bar=el('div',{class:'bakebar',hidden:!st},el('div',{style:'width:'+(st?Math.round(st.f*100):0)+'%'}));
  const btn=have?el('button',{class:'btn sm',text:'Remove',title:'Delete the downloaded files',onclick:async()=>{await aiRemove(id);}}):
    el('button',{class:'btn sm primary',text:st?'Downloading…':'Download',disabled:!!st,onclick:()=>aiGet([id])});
  return el('div',{class:'airow'+(have?' on':'')},el('div',{class:'aihead'},el('b',{text:P.title}),el('span',{class:'dim',text:aiMB(aiSize(id))+' · '+P.license}),el('span',{class:'aistat',text:have?'Installed':(st?st.msg:'Not installed')}),btn),
    el('p',{class:'note',text:P.use}),bar,el('p',{class:'note aicred'},document.createTextNode('Credit: '+P.credit+' · '),el('a',{href:P.link,target:'_blank',rel:'noopener',text:'model page'})));}
/* download the parts in order (the engine first); shows progress in the window */
async function aiGet(ids){AI.dl=AI.dl||{};const need=ids.slice();if(need.some(i=>i!=='engine')&&!aiHas('engine')&&!need.includes('engine'))need.unshift('engine');
  for(const id of need){if(aiHas(id))continue;AI.dl[id]={f:0,msg:'Starting…'};aiUiSync();
    try{await aiInstall(id,(f,msg)=>{AI.dl[id]={f,msg:Math.round(f*100)+'%'};const row=aiDlgBody&&aiDlgBody.querySelector('[data-part="'+id+'"] .bakebar');if(row){row.hidden=false;row.firstChild.style.width=Math.round(f*100)+'%';const s=aiDlgBody.querySelector('[data-part="'+id+'"] .aistat');if(s)s.textContent=Math.round(f*100)+'%';}});}
    catch(e){console.warn(e);toast('The download of “'+AI_PARTS[id].title+'” failed: '+(e.message||e));}
    delete AI.dl[id];aiUiSync();}}
async function aiBuildDlg(){if(!aiDlgBody)return;const dev=await aiGPU();aiDlgBody.replaceChildren();
  const pref=(typeof prefs!=='undefined'&&prefs.aiDevice)||'auto',sel=el('select',{id:'aiDevice','aria-label':'Run on'},...[['auto','Automatic (graphics card when possible)'],['gpu','Graphics card only'],['cpu','Processor only']].map(([v,t])=>el('option',{value:v,text:t})));
  sel.value=pref;sel.onchange=()=>{prefs.aiDevice=sel.value;savePrefs();aiFree();};
  const total=AI_ORDER.filter(i=>!aiHas(i)).reduce((a,i)=>a+aiSize(i),0);
  aiDlgBody.append(el('p',{class:'note',text:'The AI features run on this computer. Nothing is sent anywhere. Download only what you want; each part can be removed again.'}),
    el('p',{class:'note',text:'This computer: '+(dev.gpu?'WebGPU is available'+(dev.name?' ('+dev.name+')':'')+'.':'no WebGPU, so the processor is used (slower).')}),
    el('div',{class:'frow'},el('label',{for:'aiDevice',text:'Run on'}),sel),
    el('div',{class:'sub',text:'AI features'}),
    ...AI_ORDER.map(id=>{const r=aiPartRow(id);r.dataset.part=id;return r;}),
    el('div',{class:'frow'},el('button',{class:'btn primary',id:'aiAll',text:total?'Download everything ('+aiMB(total)+')':'Everything is installed',disabled:!total||!!(AI.dl&&Object.keys(AI.dl).length),onclick:()=>aiGet(AI_ORDER)})),
    el('div',{class:'sub',text:'Library'}),typeof olUpSection==='function'?olUpSection(aiBuildDlg):null);}
function dlgAddons(){aiDlgBody=el('div',{class:'dlg-grid aidlg'});openDialog({title:'Add-ons',body:aiDlgBody,okLabel:'',cancelLabel:'Close',wide:true,onCancel(){aiDlgBody=null;}});aiRefresh().then(aiBuildDlg);}
/* "install it?" card, once, on the first start after updating (never in tests) */
function aiOfferOnce(){if(prefs.aiOffered||navigator.webdriver||/[?&]debug\b/.test(location.search)||document.getElementById('welcome')||!modal.hidden)return;prefs.aiOffered=true;savePrefs();
  const b=el('div',{class:'dlg-grid'},el('p',{text:'Gouache Studio can now do some things with AI: pick out a subject or the sky with a click, take an object out of a photo, blur the background like a lens, add light to a photo, and make a height map from a photo.'}),
    el('p',{class:'note',text:'It all runs on this computer, nothing is sent anywhere. It needs a download of about '+aiMB(AI_ORDER.reduce((a,i)=>a+aiSize(i),0))+', and you can choose which parts. You can also do this later in File › AI add-ons.'}));
  openDialog({title:'AI add-ons',body:b,okLabel:'Choose…',cancelLabel:'Not now',onOk(){setTimeout(dlgAddons,50);}});}
setTimeout(()=>{aiRefresh().catch(()=>{});},1500);
setTimeout(aiOfferOnce,6000);
