/* ================= Boot ================= */
renderLibrary();buildBrushPanel();applyPreset(PRESETS[0]);loadSavedSets();loadSavedFonts();refreshChanUI();
setFG(ui.fg);renderRecent();resizeGL();
try{buildSample();toast('Sample tile loaded. Paint on it, or start fresh from File › New document.');}catch(err){console.error(err);newDoc(1024,1024,8,[1,1,1],'Untitled',false);}
updateStatus();requestRender(true);
