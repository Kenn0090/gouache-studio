/* ================= Preferences =================
   Stored on this computer (per user). Edit › Preferences (Ctrl+K). */
const prefs=Object.assign({livePreview:true},(()=>{try{return JSON.parse(localStorage.getItem('gs.prefs')||'{}');}catch(e){return {};}})());
function savePrefs(){try{localStorage.setItem('gs.prefs',JSON.stringify(prefs));}catch(e){}}
/* the Preview checkbox every image-changing dialog carries; starts from the global setting */
function previewChk(id,on,onChange){return chk(id,'Preview',on,onChange);}
function dlgPrefs(){let live=prefs.livePreview,ram=undoRamMB;
  const body=el('div',{class:'dlg-grid'},
    el('div',{class:'sub',text:'Live previews'}),
    chk('pLive','Show changes live while adjusting',live,v=>{live=v;}),
    el('p',{class:'note',text:'When on, filters, adjustments, Select menu changes and hover previews (blend modes, fonts) show on the canvas as you adjust them. Each dialog also has its own Preview checkbox. Turn this off for very large documents or slower machines.'}),
    el('div',{class:'sub',text:'Memory'}),
    makeSlider({id:'pRam',label:'Undo memory',min:256,max:16384,step:256,value:ram,fmt:v=>(v>=1024?(v/1024).toFixed(v%1024?1:0)+' GB':v+' MB'),onInput:v=>{ram=v;}}).el,
    el('p',{class:'note',text:platform.isDesktop?'Undo steps beyond this move to a temporary file on disk. Takes effect the next time the app starts.':'Older undo steps beyond this are dropped. Takes effect the next time the page loads.'}));
  openDialog({title:'Preferences',body,okLabel:'Save',onOk(){prefs.livePreview=live;savePrefs();if(ram!==undoRamMB){try{localStorage.setItem('gs.undoRamMB',String(ram));}catch(e){}}toast('Preferences saved.');}});}
