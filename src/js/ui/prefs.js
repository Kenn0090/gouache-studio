/* ================= Preferences =================
   Stored on this computer (per user). Edit › Preferences (Ctrl+K). */
const prefs=Object.assign({livePreview:true},(()=>{try{return JSON.parse(localStorage.getItem('gs.prefs')||'{}');}catch(e){return {};}})());
function savePrefs(){try{localStorage.setItem('gs.prefs',JSON.stringify(prefs));}catch(e){}}
/* the Preview checkbox every image-changing dialog carries; starts from the global setting */
function previewChk(id,on,onChange){return chk(id,'Preview',on,onChange);}
function dlgPrefs(){let live=prefs.livePreview,hints=!prefs.hideHints,tipCur=!!prefs.tipCursor,maxB=prefs.maxBrush||5000;const th=themeSection(),ms=memSection();
  const body=el('div',{class:'dlg-grid'},
    el('div',{class:'sub',text:'Theme'}),th.el,
    el('div',{class:'sub',text:'Screen'}),
    chk('pHints','Show shortcut hints on the canvas',hints,v=>{hints=v;}),
    chk('pTipCur','Show the brush tip’s shape as the cursor',tipCur,v=>{tipCur=v;}),
    el('div',{class:'sub',text:'Largest brush size'}),seg([[5000,'5000 px'],[10000,'10000 px'],[20000,'20000 px']],maxB,v=>{maxB=+v;},'Largest brush size'),
    el('p',{class:'note',text:'Very big brushes paint slowly on large documents.'}),
    el('button',{class:'btn sm',text:'Keyboard shortcuts…',onclick:()=>{th.save();savePrefs();dlgKeys();}}),
    el('div',{class:'sub',text:'Live previews'}),
    chk('pLive','Show changes live while adjusting',live,v=>{live=v;}),
    el('p',{class:'note',text:'When on, filters, adjustments, Select menu changes and hover previews (blend modes, fonts) show on the canvas as you adjust them. Each dialog also has its own Preview checkbox. Turn this off for very large documents or slower machines.'}),
    el('div',{class:'sub',text:'Memory and disk'}),ms.el);
  openDialog({title:'Preferences',body,okLabel:'Save',onCancel(){th.cancel();},onOk(){prefs.livePreview=live;prefs.hideHints=!hints;prefs.tipCursor=tipCur;prefs.maxBrush=maxB===5000?0:maxB;if(typeof sizeSlider!=='undefined'&&sizeSlider)sizeSlider.set(brush.size);if(typeof buildOptBar==='function')buildOptBar();if(typeof refreshCursor==='function')refreshCursor();th.save();savePrefs();refreshHints();ms.save();toast('Preferences saved.');}});}
