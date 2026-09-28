/* ================= Memory and disk =================
   The memory limit and the disk cache (Edit › Preferences). The rules themselves live with the
   undo history in core/document.js; this file sets the desktop app up at start-up and draws the
   Preferences section. */
const fmtBytes=b=>b>=1073741824?(b/1073741824).toFixed(b>=10737418240?0:1)+' GB':Math.max(0,Math.round(b/1048576))+' MB';
async function memInit(){if(!platform.isDesktop)return;
  const i=await platform.cacheInfo();if(i){memSys.ramTotal=i.ram_total;memSys.ramAvail=i.ram_avail;}
  if(mem.dir){try{await platform.cacheSetDir(mem.dir);}catch(e){console.warn(e);toast('The disk cache folder '+mem.dir+' cannot be used ('+(e.message||e)+'), so the default one is used.');mem.dir='';memSave();}}}
memInit();
/* the Preferences section: returns its element and what Save does */
function memSection(){const d={limitMB:mem.limitMB||memAutoMB(),steps:undoSteps(),diskGB:mem.diskGB,dir:mem.dir};
  const ramMB=memSys.ramTotal?Math.floor(memSys.ramTotal/1048576):(platform.isDesktop?16384:(navigator.deviceMemory||4)*1024);
  const pct=v=>memSys.ramTotal?' ('+Math.round(v/ramMB*100)+'%)':'';
  const box=el('div',{class:'dlg-grid'});
  box.append(el('p',{class:'note',text:memSys.ramTotal?'This computer has '+fmtBytes(memSys.ramTotal)+' of memory; '+fmtBytes(memSys.ramAvail)+' is free right now.':platform.isDesktop?'':'The browser does not say how much memory this computer has.'}),
    makeSlider({id:'pMem',label:'Use up to',min:512,max:Math.max(1024,Math.floor(ramMB/256)*256),step:256,value:Math.min(d.limitMB,Math.max(1024,ramMB)),fmt:v=>fmtBytes(v*1048576)+pct(v),onInput:v=>{d.limitMB=v;}}).el,
    el('p',{class:'note',text:'Undo history and loaded models share this memory. '+(platform.isDesktop?'Past it, older undo steps move to the disk cache and come back if you undo that far.':'Past it, the oldest undo steps are dropped.')+' Leave room for Windows and other apps: half to three quarters of your memory works well.'}),
    makeSlider({id:'pSteps',label:'Undo steps',min:20,max:1000,step:10,value:d.steps,fmt:v=>String(v),onInput:v=>{d.steps=v;}}).el);
  if(platform.isDesktop){const where=el('p',{class:'note mono',id:'pCacheDir',text:d.dir?d.dir:'Default folder'}),use=el('p',{class:'note',id:'pCacheUse',text:'…'});
    const show=async()=>{const i=await platform.cacheInfo();if(!i)return;where.textContent=(d.dir||i.custom?'':'Default folder: ')+i.dir;
      use.textContent='In use: '+fmtBytes(i.spill_bytes+i.tree_bytes)+' (undo steps '+fmtBytes(i.spill_bytes)+', bake search trees '+fmtBytes(i.tree_bytes)+')'+(i.free_bytes?' · free on this drive: '+fmtBytes(i.free_bytes):'');};
    const change=el('button',{class:'btn sm',text:'Change…',id:'pCacheChange',title:'Put the disk cache on another drive (a fast SSD with plenty of space is best)',onclick:async()=>{const p=await platform.pickFolder();if(p){d.dir=p;where.textContent=p+' (after Save)';}}});
    const def=el('button',{class:'btn sm',text:'Default',title:'Use the app’s own cache folder',onclick:()=>{d.dir='';where.textContent='Default folder (after Save)';}});
    const clr=el('button',{class:'btn sm',text:'Clear bake trees',title:'Delete the saved high-poly search trees (they are rebuilt when needed)',onclick:async()=>{await platform.treePrune(0);show();toast('Saved search trees cleared.');}});
    box.append(el('div',{class:'sub',text:'Disk cache'}),where,el('div',{class:'row wrap'},change,def,clr),
      makeSlider({id:'pDisk',label:'Cache size',min:1,max:500,step:1,value:d.diskGB,fmt:v=>v+' GB',onInput:v=>{d.diskGB=v;}}).el,use,
      el('p',{class:'note',text:'Holds undo steps past the memory limit, and the search trees of high-polys you have baked, so baking the same high-poly again (even after a restart) skips the “Sorting triangles” step. Past the limit, the oldest are removed.'}));
    show();}
  return {el:box,async save(){const auto=!mem.limitMB&&d.limitMB===memAutoMB();mem.limitMB=auto?0:d.limitMB;mem.steps=d.steps===(platform.isDesktop?500:120)?0:d.steps;mem.diskGB=d.diskGB;
    if(platform.isDesktop&&d.dir!==mem.dir){try{await platform.cacheSetDir(d.dir);mem.dir=d.dir;}catch(e){toast('That folder cannot be used: '+(e.message||e));}}
    memSave();memApply();if(platform.isDesktop)platform.treePrune(Math.max(0,mem.diskGB*1073741824-hist.undo.reduce((s,r)=>s+recDisk(r),0)));}};}
