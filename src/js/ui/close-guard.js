/* (0.55.1) Closing the desktop window asks about unsaved work. The browser has its own "leave this page?" question
   (safety.js); the desktop window gave none, so closing lost the painting. The Rust side holds the close and tells
   the page ("gs-close"); the page asks about each unsaved document, then quits for real. */
let cgBusy=false;
async function appCloseRequest(){if(cgBusy)return;cgBusy=true;
  try{
    const dirty=(typeof dtab!=='undefined'?dtab.tabs:[]).filter(t=>{try{return dtUnsaved(t);}catch(e){return false;}});
    if(dirty.length&&ui.mode!=='paint'&&!setMode('paint',true))return;
    for(const t of dirty){const r=await dtAskSave(t);if(r==='cancel')return;
      if(r==='save'){if(t.id!==dtab.live&&!dtActivate(t.id))return;await new Promise(r=>setTimeout(r,0));try{await saveDoc(false);}catch(e){return;}if(dtUnsaved(t))return;}}
    if(typeof p3!=='undefined'&&p3.started&&p3.savedAt!==p3Sig()){const r=await dtAskSave({state:{doc:{name:(p3.name||'3D Paint project')}}});if(r==='cancel')return;
      if(r==='save'){try{await saveP3Project(false);}catch(e){return;}if(p3.savedAt!==p3Sig())return;}}
    window.__gsQuit=true;await platform.invoke('quit_app');
  }finally{cgBusy=false;}}
if(platform.isDesktop&&TAURI.event){TAURI.event.listen('gs-close',()=>{appCloseRequest();});platform.invoke('close_guard',{on:true}).catch(()=>{});}
