/* ================= Updates (desktop) =================
   A few seconds after launch the app quietly checks GitHub for a newer signed release.
   If one exists, a banner offers "Update now" or "Later". Updating asks to save unsaved work
   first, downloads with a progress bar, installs, and restarts the app. */
let updateInfo=null,updateBusy=false;
const isDirty=()=>!!hist.undo.length&&hist.undo[hist.undo.length-1]!==doc.savedAt;

function updateBanner(){let b=$('#updBanner');
  if(!b){b=el('div',{id:'updBanner',role:'status'});document.body.append(b);}
  return b;}
function hideUpdateBanner(){const b=$('#updBanner');if(b)b.remove();}

function showUpdateBanner(){const b=updateBanner();
  const notes=(updateInfo.notes||'').trim();
  b.replaceChildren(
    el('div',{class:'upd-text'},
      el('strong',{text:'Update available: '+updateInfo.version}),
      el('span',{class:'note',text:'You have '+updateInfo.current+'.'}),
      notes?el('button',{class:'upd-link',text:'What’s new',onclick:showUpdateNotes}):el('span')),
    el('div',{class:'upd-actions'},
      el('button',{class:'btn sm',text:'Later',onclick:hideUpdateBanner}),
      el('button',{class:'btn sm primary',text:'Update now',onclick:startUpdate})));}

/* release notes are light markdown: paragraphs, "- " bullets and **bold** */
function inlineMd(line){const out=[];line.split(/(\*\*[^*]+\*\*|`[^`]+`)/).forEach(part=>{
    if(/^\*\*[^*]+\*\*$/.test(part))out.push(el('strong',{text:part.slice(2,-2)}));
    else if(/^`[^`]+`$/.test(part))out.push(el('code',{text:part.slice(1,-1)}));
    else if(part)out.push(document.createTextNode(part));});return out;}
function renderNotes(md){const box=el('div',{class:'upd-notes'});let list=null;
  for(const raw of md.replace(/\r/g,'').split('\n')){const line=raw.trim();
    if(!line){list=null;continue;}
    const b=line.match(/^[-*]\s+(.*)$/);
    if(b){if(!list){list=el('ul');box.append(list);}list.append(el('li',null,...inlineMd(b[1])));}
    else{list=null;box.append(el('p',null,...inlineMd(line)));}}
  return box;}
function showUpdateNotes(){const body=el('div',{class:'dlg-grid'});
  body.append(renderNotes((updateInfo.notes||'').trim()));
  openDialog({title:'What’s new in '+updateInfo.version,body,okLabel:'Update now',cancelLabel:'Close',onOk(){startUpdate();}});}

async function checkForUpdates(manual){if(!platform.isDesktop||updateBusy)return;
  if(manual)toast('Checking for updates…');
  try{updateInfo=await platform.updateCheck();
    if(updateInfo)showUpdateBanner();
    else if(manual)toast('Gouache Studio is up to date.');}
  catch(e){console.warn('Update check failed',e);if(manual)toast('Could not check for updates: '+e);}}

function startUpdate(){if(!updateInfo||updateBusy)return;
  if(!isDirty()){installUpdate();return;}
  const body=el('div',{class:'dlg-grid'},
    el('p',{class:'note',text:'The app restarts to finish updating. Your painting has unsaved changes.'}),
    el('div',{class:'frow'},
      el('button',{class:'btn sm primary',text:'Save, then update',onclick:async()=>{closeDialog();await savePSD(false);if(isDirty())toast('Not saved, so the update was not started.');else installUpdate();}}),
      el('button',{class:'btn sm',text:'Update without saving',onclick:()=>{closeDialog();installUpdate();}})));
  openDialog({title:'Save before updating?',body,cancelLabel:'Not now'});}

async function installUpdate(){updateBusy=true;const b=updateBanner();
  const bar=el('div',{class:'upd-bar'},el('i'));const label=el('span',{class:'note',text:'Downloading…'});
  b.replaceChildren(el('div',{class:'upd-text'},el('strong',{text:'Updating to '+updateInfo.version}),label),bar);
  let stop=null;
  try{stop=await platform.onUpdateProgress((got,total)=>{
      const pct=total?Math.min(100,Math.round(got/total*100)):0;
      bar.firstChild.style.width=pct+'%';
      label.textContent=total?`Downloading… ${pct}% of ${(total/1048576).toFixed(1)} MB`:`Downloading… ${(got/1048576).toFixed(1)} MB`;
      if(total&&got>=total)label.textContent='Installing… the app will restart.';});
    window.__gsQuit=true;await platform.updateInstall(); /* on success the app restarts and never gets here */
  }catch(e){window.__gsQuit=false;console.error(e);updateBusy=false;toast('The update failed: '+e);showUpdateBanner();}
  finally{if(stop)stop();}}
