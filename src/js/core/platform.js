/* ================= Platform bridge =================
   One place that knows whether we run as the desktop app (Tauri) or in a browser.
   Desktop: native open/save dialogs, direct file writes, recent files, undo spill-to-disk.
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
  async readFile(path){return new Uint8Array(await this.invoke('read_file',{path}));},
  async openDialog(filters){const p=await this.invoke('plugin:dialog|open',{options:{multiple:false,directory:false,filters}});return Array.isArray(p)?p[0]:p;},
  recentList(){return this.invoke('recent_list').catch(()=>[]);},
  recentAdd(path){return this.invoke('recent_add',{path}).catch(()=>{});},
  setTitle(t){if(TAURI)this.invoke('set_title',{title:t}).catch(()=>{});},
  spillWrite(bytes){return this.invoke('spill_write',bytes);},
  async spillRead(id){return await this.invoke('spill_read',{id});},
  spillDelete(id){return this.invoke('spill_delete',{id}).catch(()=>{});},
  engineInfo(){return this.invoke('engine_info').catch(()=>null);}
};
const fileNameOf=p=>String(p).split(/[\\/]/).pop();
