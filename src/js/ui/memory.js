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
    makeSlider({id:'pSteps',label:'Undo steps',min:10,max:1000,step:10,value:d.steps,fmt:v=>String(v),onInput:v=>{d.steps=v;}}).el);
  if(platform.isDesktop){const where=el('p',{class:'note mono',id:'pCacheDir',text:d.dir?d.dir:'Default folder'}),use=el('p',{class:'note',id:'pCacheUse',text:'…'});
    const show=async()=>{const i=await platform.cacheInfo();if(!i)return;where.textContent=(d.dir||i.custom?'':'Default folder: ')+i.dir;
      use.textContent='In use: '+fmtBytes(i.spill_bytes+i.tree_bytes)+' (undo steps '+fmtBytes(i.spill_bytes)+', bake search trees '+fmtBytes(i.tree_bytes)+')'+(i.free_bytes?' · free on this drive: '+fmtBytes(i.free_bytes):'');};
    const change=el('button',{class:'btn sm',text:'Change…',id:'pCacheChange',title:'Put the disk cache on another drive (a fast SSD with plenty of space is best)',onclick:async()=>{const p=await platform.pickFolder();if(p){d.dir=p;where.textContent=p+' (after Save)';}}});
    const def=el('button',{class:'btn sm',text:'Default',title:'Use the app’s own cache folder',onclick:()=>{d.dir='';where.textContent='Default folder (after Save)';}});
    const clr=el('button',{class:'btn sm',text:'Clear bake trees',title:'Delete the saved high-poly search trees (they are rebuilt when needed)',onclick:async()=>{await platform.treePrune(0);show();toast('Saved search trees cleared.');}});
    /* (0.97.22, Kenn: keep the C drive free) where Gouache keeps its data, with a move to another drive at the next start */
    const dWhere=el('p',{class:'note mono',id:'pDataDir',text:'…'}),dUse=el('p',{class:'note',id:'pDataUse',text:''}),dMsg=el('p',{class:'note',id:'pDataMsg',text:''});
    const dShow=async()=>{const i=await platform.dataInfo();if(!i)return;dWhere.textContent=(i.custom?'':'Default folder: ')+i.dir;
      dUse.textContent='In use: '+fmtBytes(i.size_bytes)+(i.free_bytes?' · free on that drive: '+fmtBytes(i.free_bytes):'');
      dMsg.textContent=i.pending?'Waiting: your data moves to '+i.pending_to+' the next time Gouache starts.':i.error?'The last move did not finish: '+i.error:'';};
    const dRestart=()=>{if(typeof unsavedWork==='function'&&unsavedWork()){toast('Save your work first, then restart Gouache to finish the move.');return;}
      confirmDlg('Restart Gouache','Gouache restarts now and moves your data. This can take a few minutes for a big library. Do not switch the computer off.','Restart',()=>platform.dataRestart());};
    const dChoose=async()=>{const p=await platform.pickFolder();if(!p)return;const i=await platform.dataInfo();
      confirmDlg('Move Gouache’s data','Move everything Gouache has saved ('+(i?fmtBytes(i.size_bytes):'your data')+': materials, skies, textures, AI add-ons, settings, autosaves) into “'+p+'”? The old copy is deleted once the new one is checked.','Choose folder',async()=>{
        try{const r=await platform.dataSet(p);await dShow();if(r==='restart')dRestart();}catch(e){toast('That folder cannot be used: '+(e.message||e));}});};
    const dDefault=()=>confirmDlg('Move the data back','Move Gouache’s data back to its normal place on the system drive?','Move back',async()=>{try{const r=await platform.dataSet(null);await dShow();if(r==='restart')dRestart();}catch(e){toast('Could not do that: '+(e.message||e));}});
    {let cur='0';try{cur=localStorage.getItem('gs.vramSet')||'0';}catch(e){}
     box.append(el('div',{class:'sub',text:'Graphics card memory (for the low-memory warning)'}),el('select',{id:'pVram',title:'Gouache cannot read how much memory your graphics card has, so tell it here. The warning appears when the pictures in use get close to this.',onchange:ev=>{try{if(ev.target.value==='0')localStorage.removeItem('gs.vramSet');else localStorage.setItem('gs.vramSet',ev.target.value);}catch(x){}if(typeof gpuHealth!=='undefined')gpuHealth.warned=false;}},
       ...[['0','Automatic ('+(typeof gpuGuessVram==='function'&&gpuGuessVram()?'detected '+gpuGuessVram()+' GB':'assume 6 GB')+')'],['4','4 GB'],['6','6 GB'],['8','8 GB'],['10','10 GB'],['12','12 GB'],['16','16 GB'],['24','24 GB'],['32','32 GB']].map(([v,t])=>el('option',{value:v,text:t,selected:cur===v}))));}
    box.append(el('div',{class:'sub',text:'Data folder'}),dWhere,el('div',{class:'row wrap'},el('button',{class:'btn sm',id:'pDataChange',text:'Change…',title:'Keep everything Gouache saves (materials, skies, downloads, settings, autosaves) on another drive',onclick:dChoose}),el('button',{class:'btn sm',id:'pDataDefault',text:'Default',title:'Back to the system drive',onclick:dDefault}),el('button',{class:'btn sm',id:'pDataRestart',text:'Restart to finish',title:'Needed after a change',onclick:dRestart})),dUse,dMsg,
      el('p',{class:'note',text:'Saved materials, the Library, skies, grunge, AI add-ons and settings, autosave copies and the Exports folder live here. Your own .gouache files stay wherever you saved them. Changing it copies the data to the new place when Gouache restarts, checks the copy, then removes the old one. The undo cache has its own folder below.'}));
    dShow();
    box.append(el('div',{class:'sub',text:'Disk cache'}),where,el('div',{class:'row wrap'},change,def,clr),
      makeSlider({id:'pDisk',label:'Cache size',min:1,max:500,step:1,value:d.diskGB,fmt:v=>v+' GB',onInput:v=>{d.diskGB=v;}}).el,use,
      el('p',{class:'note',text:'Holds undo steps past the memory limit, and the search trees of high-polys you have baked, so baking the same high-poly again (even after a restart) skips the “Sorting triangles” step. Past the limit, the oldest are removed.'}));
    show();}
  return {el:box,async save(){const auto=!mem.limitMB&&d.limitMB===memAutoMB();mem.limitMB=auto?0:d.limitMB;mem.steps=d.steps===UNDO_DEFAULT()?0:d.steps;mem.diskGB=d.diskGB;
    if(platform.isDesktop&&d.dir!==mem.dir){try{await platform.cacheSetDir(d.dir);mem.dir=d.dir;}catch(e){toast('That folder cannot be used: '+(e.message||e));}}
    memSave();memApply();if(platform.isDesktop)platform.treePrune(Math.max(0,mem.diskGB*1073741824-hist.undo.reduce((s,r)=>s+recDisk(r),0)));}};}
