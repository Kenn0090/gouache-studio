/* ================= Recent files and where files are saved (0.25) =================
   The File menu lists the files you saved or opened lately, split into Paint documents and 3D Paint projects,
   each with its folder and when it was last saved; "All recent files…" shows the full list with Show in folder.
   The status bar shows where the current file is saved (click it to see it in Explorer). In the browser, files
   go to the Downloads folder and there is no list. */
Object.assign(platform,{
  recentDetails(){return this.invoke('recent_details').then(l=>(l||[]).map(([path,t])=>({path,t:t*1000}))).catch(async()=>(await this.recentList()).map(path=>({path,t:0})));},
  recentRemove(path){return this.invoke('recent_remove',{path}).catch(()=>{});},
  reveal(path){return this.invoke('reveal_path',{path}).catch(e=>toast('Could not open the folder: '+(e.message||e)));}});
const recentKind=p=>/\.gouache3d$/i.test(p)?'3d':'paint';
const folderOf=p=>String(p||'').replace(/[\\/][^\\/]*$/,'');
function agoText(t){if(!t)return '';const s=(Date.now()-t)/1000;if(s<60)return 'just now';if(s<3600)return Math.round(s/60)+' min ago';if(s<86400)return Math.round(s/3600)+' h ago';if(s<172800)return 'yesterday';
  const d=new Date(t);return d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:d.getFullYear()===new Date().getFullYear()?undefined:'numeric'});}
/* the file being worked on: the 3D Paint project in 3D Paint, else the painting */
function curFilePath(){if(ui.mode==='p3d'&&typeof p3!=='undefined')return p3.path||null;const d=typeof tabDocs!=='undefined'&&tabDocs.paint&&ui.mode!=='brush'?tabDocs.paint.doc:doc;return d&&d.filePath||null;}
function recentItem(r,onPick){return el('button',{class:'mi mrecent',role:'menuitem',title:r.path,onclick:onPick},el('span',{class:'mricon',text:recentKind(r.path)==='3d'?'◈':'▦'}),
  el('span',{class:'mrtext'},el('b',{text:fileNameOf(r.path)}),el('small',{text:folderOf(r.path)})),el('span',{class:'mk',text:agoText(r.t)}));}
/* added to the File menu when it opens */
async function fileMenuExtras(pop){const anchor=pop.querySelector('.mi[data-act="recent"]');
  const cur=curFilePath(),head=el('div',{class:'mfile'});
  if(!platform.isDesktop)head.append(el('span',{class:'dim',text:'In the browser, saved files go to your Downloads folder.'}));
  else if(cur)head.append(el('span',{class:'dim',text:'Saved in '}),el('button',{class:'mlink',id:'fmReveal',title:'Show it in Explorer',text:folderOf(cur),onclick:()=>{closeMenu();platform.reveal(cur);}}));
  else head.append(el('span',{class:'dim',text:'This file is not saved yet.'}));
  pop.prepend(head,el('div',{class:'msep'}));
  if(!platform.isDesktop||!anchor)return;
  const list=await platform.recentDetails();if(!pop.isConnected||pop.hidden)return;
  const box=el('div',{class:'mrecents',id:'fmRecents'});
  const sec=(kind,label)=>{const rs=list.filter(r=>recentKind(r.path)===kind).slice(0,5);if(!rs.length)return;box.append(el('div',{class:'mhead',text:label}),...rs.map(r=>recentItem(r,()=>{closeMenu();openRecent(r.path);})));};
  sec('paint','Recent Paint documents');sec('3d','Recent 3D Paint projects');
  if(box.children.length)anchor.after(box);}
function openRecent(path){if(recentKind(path)==='3d'){if(ui.mode!=='p3d'&&!setMode('p3d',true))return;}openPath(path,'open');}
/* File › All recent files… */
async function dlgRecent(){const list=await platform.recentDetails(),body=el('div',{class:'dlg-grid',id:'recentDlg'});
  const draw=()=>{body.replaceChildren();if(!list.length){body.append(el('p',{class:'note',text:'No recent files yet. Files you open or save appear here.'}));return;}
    for(const [kind,label] of [['paint','Paint documents'],['3d','3D Paint projects']]){const rs=list.filter(r=>recentKind(r.path)===kind);if(!rs.length)continue;
      body.append(el('div',{class:'sub',text:label}),el('div',{class:'recentlist'},...rs.map(r=>el('div',{class:'recentrow'},
        el('button',{class:'btn recentopen',title:'Open '+r.path,onclick:()=>{closeDialog();openRecent(r.path);}},el('b',{text:fileNameOf(r.path)}),el('span',{class:'dim',text:folderOf(r.path)}),el('span',{class:'dim',text:r.t?'Saved '+agoText(r.t):''})),
        el('button',{class:'btn sm',text:'Show in folder',onclick:()=>platform.reveal(r.path)}),
        el('button',{class:'btn sm',text:'×',title:'Remove from this list','aria-label':'Remove '+fileNameOf(r.path)+' from the list',onclick:async()=>{await platform.recentRemove(r.path);list.splice(list.indexOf(r),1);draw();}})))));}};
  draw();openDialog({title:'Recent files',body,okLabel:null,cancelLabel:'Close'});}
/* the status bar: where the current file is saved */
function fileLocUpdate(){let s=document.getElementById('stFile');if(!s){const d=document.getElementById('stDoc');if(!d)return;s=el('button',{class:'pill',id:'stFile'});d.after(s);s.onclick=()=>{const p=curFilePath();if(p&&platform.isDesktop)platform.reveal(p);else if(!p)toast('Not saved yet: File › Save.');};}
  const p=curFilePath();s.textContent=p?(platform.isDesktop?'📁 '+folderOf(p).split(/[\\/]/).slice(-2).join('\\'):'💾 '+fileNameOf(p)):'Not saved';
  s.title=p?(platform.isDesktop?'Saved as '+p+'. Click to show it in Explorer.':'Saved as '+p+' (your Downloads folder)'):'This file has not been saved yet';}
