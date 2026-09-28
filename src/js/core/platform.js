/* ================= Platform bridge =================
   One place that knows whether we run as the desktop app (Tauri) or in a browser.
   Desktop: native open/save dialogs, direct file writes, recent files, undo spill-to-disk, self-update.
   Browser: falls back to file inputs and downloads. */
const TAURI=window.__TAURI__&&window.__TAURI__.core?window.__TAURI__:null;
const platform={
  isDesktop:!!TAURI,
  invoke(cmd,args,opts){return TAURI.core.invoke(cmd,args,opts);},
  /* native save dialog, then write bytes straight to disk; resolves to the chosen path or null if cancelled */
  async saveAs(defaultName,bytes,filterName){
    const ext=extOf(defaultName);
    const path=await this.invoke('plugin:dialog|save',{options:{defaultPath:defaultName,filters:[{name:filterName||ext.toUpperCase(),extensions:[ext]}]}});
    if(!path)return null;await this.writeFile(path,bytes);return path;},
  writeFile(path,bytes){return this.invoke('write_file',bytes,{headers:{'x-path':encodeURIComponent(path)}});},
  /* big files are read in pieces so the loading bar can move */
  async readFile(path){let size=0;try{size=await this.invoke('file_size',{path});}catch(e){}
    if(!size||size<16*1024*1024)return new Uint8Array(await this.invoke('read_file',{path}));
    const out=new Uint8Array(size),CH=16*1024*1024;const name=path.split(/[\\/]/).pop(),show=typeof loadDepth!=='undefined'&&loadDepth>0;
    for(let o=0;o<size;o+=CH){const part=new Uint8Array(await this.invoke('read_file_range',{path,offset:o,len:Math.min(CH,size-o)}));out.set(part,o);if(show)loadSet((o+part.length)/size,'Reading '+name+' · '+Math.round((o+part.length)/1048576)+' of '+Math.round(size/1048576)+' MB');}
    return out;},
  async openDialog(filters){const p=await this.invoke('plugin:dialog|open',{options:{multiple:false,directory:false,filters}});return Array.isArray(p)?p[0]:p;},
  async openFiles(filters,multiple){const p=await this.invoke('plugin:dialog|open',{options:{multiple:!!multiple,directory:false,filters}});return p?(Array.isArray(p)?p:[p]):[];},
  async pickFolder(){const p=await this.invoke('plugin:dialog|open',{options:{multiple:false,directory:true}});return Array.isArray(p)?p[0]:p;},
  recentList(){return this.invoke('recent_list').catch(()=>[]);},
  recentAdd(path){return this.invoke('recent_add',{path}).catch(()=>{});},
  setTitle(t){if(TAURI)this.invoke('set_title',{title:t}).catch(()=>{});},
  spillWrite(bytes){return this.invoke('spill_write',bytes);},
  async spillRead(id){return await this.invoke('spill_read',{id});},
  spillDelete(id){return this.invoke('spill_delete',{id}).catch(()=>{});},
  /* the disk cache: where it is, what it holds, how much memory this computer has */
  cacheInfo(){return this.invoke('cache_info').catch(()=>null);},
  cacheSetDir(dir){return this.invoke('cache_set_dir',{dir:dir||null});},
  treeWrite(key,bytes){return this.invoke('tree_write',bytes,{headers:{'x-key':key}});},
  async treeRead(key){return await this.invoke('tree_read',{key});},
  treePrune(maxBytes){return this.invoke('tree_prune',{maxBytes:Math.max(0,Math.floor(maxBytes))}).catch(()=>0);},
  launchFile(){return this.invoke('launch_file').catch(()=>null);},
  engineInfo(){return this.invoke('engine_info').catch(()=>null);},
  updateCheck(){return this.invoke('update_check');},
  updateInstall(){return this.invoke('update_install');},
  /* progress callback gets (bytesReceived, totalBytes|null); resolves to an unsubscribe function */
  onUpdateProgress(cb){return TAURI.event.listen('update-progress',e=>cb(e.payload[0],e.payload[1]));}
};
const fileNameOf=p=>String(p).split(/[\\/]/).pop();
