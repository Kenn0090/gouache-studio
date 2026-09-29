/* Safety: the page must never reload or close by accident (Ctrl+R / F5 reloaded the app and lost the painting).
   Ctrl+R now shows the rulers (as in Photoshop), F5 does nothing, and Ctrl+Shift+R reloads the app on purpose,
   asking first when something is unsaved (a recovery copy is kept). Tab doesn't walk through the buttons, and
   dragging doesn't highlight the interface's text. */
function unsavedWork(){try{if(!asPaintSaved())return true;}catch(e){}
  try{if(typeof p3!=='undefined'&&p3.started&&p3.savedAt!==p3Sig())return true;}catch(e){}return false;}
async function reloadApp(){const go=async()=>{try{await autosaveNow(true);}catch(e){}window.__gsQuit=true;location.reload();};
  if(!unsavedWork())return go();
  confirmDlg('Reload the app?','You have unsaved changes. A recovery copy is kept, and the welcome screen offers it back after the reload.','Reload',go);}
window.addEventListener('keydown',e=>{const m=(e.ctrlKey||e.metaKey)&&!e.altKey,r=e.key==='r'||e.key==='R';
  if(e.key==='F5'||e.key==='BrowserRefresh'||(m&&r)){e.preventDefault();e.stopImmediatePropagation();
    if(m&&r&&e.shiftKey){if(modal.hidden)reloadApp();}
    else if(m&&r){if(modal.hidden&&!isTypingTarget(e.target)&&typeof toggleRulers==='function')toggleRulers();}
    else toast('Reloading is turned off so your work is never lost. Ctrl+Shift+R reloads the app.');
    return;}
  if(e.key==='Tab'&&!e.ctrlKey&&!e.altKey&&!e.metaKey){if(!modal.hidden||(e.target.closest&&e.target.closest('.dialog,.welcome')))return;e.preventDefault();}
},true);
window.addEventListener('beforeunload',e=>{if(window.__gsQuit||!unsavedWork())return;try{autosaveNow(true);}catch(err){}e.preventDefault();e.returnValue='';});
/* nothing outside text boxes gets highlighted when you drag */
document.addEventListener('selectstart',e=>{const t=e.target.nodeType===1?e.target:e.target.parentElement;if(t&&t.closest&&t.closest('input,textarea,[contenteditable],.selectable'))return;e.preventDefault();});
