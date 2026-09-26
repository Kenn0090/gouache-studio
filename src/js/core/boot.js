/* ================= Boot ================= */
renderLibrary();buildBrushPanel();applyPreset(PRESETS[0]);loadSavedSets();loadSavedFonts();refreshChanUI();
setFG(ui.fg);renderRecent();resizeGL();
try{buildSample();toast('Sample tile loaded. Paint on it, or start fresh from File › New document.');}catch(err){console.error(err);newDoc(1024,1024,8,[1,1,1],'Untitled',false);}
updateStatus();requestRender(true);
if(platform.isDesktop)setTimeout(()=>checkForUpdates(false),4000);
/* test hook: only with ?debug in the address */
if(/[?&]debug\b/.test(location.search))window.__gs={doc,sel,view,hist,ui,readRGBA8,selPixels:()=>captureSel(sel.t,[0,0,doc.w,doc.h]).data,layerByName:n=>allLayers().find(L=>L.name===n),newDoc};
