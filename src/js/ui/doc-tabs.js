/* ================= Document tabs (0.26.2) =================
   Several pictures open at once, like Photoshop: a tab per document above the canvas (name, • when unsaved,
   × to close, asking to save first), click to switch, drag to reorder. New, Open, the examples and recovered
   autosaves open a new tab (an untouched Untitled start-up document is reused instead). Drag a tab down out of
   the bar and it becomes its own window, for a second monitor. There is one GPU canvas: the document you are
   working on has it (the whole #work area moves into its window), the others show a still picture of how you
   left them until you click into them. Panels in the main window always show the document you are working on.
   Closing the last tab leaves a blank Untitled and shows the welcome screen. Tabs don't reopen at start-up. */
const dtab={tabs:[],live:0,main:0,seq:0,sig:''};
const dtTab=id=>dtab.tabs.find(t=>t.id===id);
const dtLive=()=>dtTab(dtab.live);
function dtName(t){const d=t.state?t.state.doc:(tabDocs.paint?tabDocs.paint.doc:doc);return d.name||'Untitled';}
function dtUnsaved(t){if(!t.state){try{return !asPaintSaved();}catch(e){return false;}}const u=t.state.undo;return !!(u.length&&u[u.length-1]!==t.state.doc.savedAt);}
function dtPristine(){return ui.mode==='paint'&&!hist.undo.length&&!hist.redo.length&&!doc.filePath&&(doc.name||'Untitled')==='Untitled'&&!doc.anim;}
/* ---- the layout: a tab bar over the canvas area, which can be empty while the canvas is in another window ---- */
const dtWrap=el('div',{id:'workWrap'}),dtBar=el('div',{id:'docTabs',role:'tablist','aria-label':'Open documents'}),dtSlot=el('div',{id:'workSlot'});
const dtPh=el('div',{id:'workAway',hidden:true},el('canvas',{class:'dwshot'}),el('div',{class:'dwnote'}));
work.before(dtWrap);dtWrap.append(dtBar,dtSlot);dtSlot.append(work,dtPh);
dtPh.addEventListener('pointerdown',e=>{e.preventDefault();const m=dtTab(dtab.main);if(m)dtActivate(m.id);});
/* ---- a still picture of the canvas, kept by a document while another one has the canvas ---- */
function dtShot(t){try{if(dirtyComp){composite();dirtyComp=false;}drawView();const c=t.shot||(t.shot=document.createElement('canvas'));c.width=cv.width;c.height=cv.height;c.getContext('2d').drawImage(cv,0,0);}catch(e){console.warn('shot',e);}}
function dtDrawShot(c,t){const r=c.getBoundingClientRect(),d=(c.ownerDocument.defaultView.devicePixelRatio)||1,W=Math.max(1,Math.round(r.width*d)),H=Math.max(1,Math.round(r.height*d));
  if(c.width!==W||c.height!==H){c.width=W;c.height=H;}const x=c.getContext('2d');x.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--ground')||'#16181c';x.fillRect(0,0,W,H);
  if(t&&t.shot&&t.shot.width){const s=Math.min(W/t.shot.width,H/t.shot.height,1.5),w=t.shot.width*s,h=t.shot.height*s;x.globalAlpha=.9;x.drawImage(t.shot,(W-w)/2,(H-h)/2,w,h);x.globalAlpha=1;}}
/* ---- which window has the canvas ---- */
function dtPlaceWork(){const L=dtLive(),inPop=!!(L&&L.win),holder=inPop?L.win.holder:dtSlot;
  if(work.parentNode!==holder)holder.append(work);if(L&&!inPop)dtab.main=L.id;
  dtPh.hidden=!inPop;if(inPop){const m=dtTab(dtab.main);dtPh.querySelector('.dwnote').textContent=m?'“'+dtName(m)+'”: click to work on it here. “'+dtName(L)+'” is in its own window.':'“'+dtName(L)+'” is in its own window. Every open document is in a window of its own.';dtDrawShot(dtPh.querySelector('canvas'),m);}
  for(const t of dtab.tabs)if(t.win){const on=t.id===dtab.live;t.win.shot.hidden=on;if(!on)dtDrawShot(t.win.shot,t);}
  resizeGL();requestRender(true);}
/* ---- switching ---- */
function dtBusy(){return !!(stroke||ptr||preview||(typeof xf!=='undefined'&&xf)||(typeof selLive!=='undefined'&&selLive)||(typeof crop!=='undefined'&&crop)||!modal.hidden);}
function dtLeave(){const L=dtLive();if(!L)return;dtShot(L);L.state=docState();dtab.live=0;}
function dtActivate(id){if(id===dtab.live){const t=dtTab(id);if(t&&ui.mode!=='paint')setMode('paint',true);return true;}const t=dtTab(id);if(!t||!t.state)return false;
  if(ui.mode!=='paint'&&!setMode('paint',true))return false;if(dtBusy()){toast('Finish or cancel what you are doing first (a stroke, transform, crop or dialog).');return false;}
  if(typeof matEdFlush==='function')try{matEdFlush();}catch(e){}
  dtLeave();setDocState(t.state);t.state=null;dtab.live=id;dtPlaceWork();dtAfterSwitch();return true;}
function dtAfterSwitch(){$('#docName').textContent=doc.name;const tb=$('#tileBtn');if(tb)tb.setAttribute('aria-pressed',String(!!doc.wrap));
  for(const f of ['changedAll','refreshMapsUI','updateStatus','selChanged','renderHistory','updateTitle','fileLocUpdate','tipBanner'])if(typeof window[f]==='function')try{window[f]();}catch(e){console.warn(f,e);}
  if(typeof rl!=='undefined')rl.sig='';if(typeof v3!=='undefined'){v3.mapsDirty=true;v3.dirty=true;}resizeGL();requestRender(true);dtRender();}
/* a new document or an opened file goes into a tab of its own (the untouched start-up document is reused) */
function dtNewTab(){if(ui.mode!=='paint'&&!setMode('paint',true))return false;if(stroke||preview){toast('Finish what you are doing first.');return false;}if(typeof xf!=='undefined'&&xf&&typeof xfCommit==='function')xfCommit();
  if(dtPristine())return true;
  dtLeave();blankTabDoc(doc.w||1024,doc.h||1024,'Untitled');const t={id:++dtab.seq,state:null,win:null,shot:null};
  const i=dtab.tabs.findIndex(x=>x.id===dtab.main);dtab.tabs.splice(i<0?dtab.tabs.length:i+1,0,t);dtab.live=t.id;dtPlaceWork();dtRender();return true;}
/* new documents are Untitled, Untitled-2, Untitled-3… so the tabs can be told apart */
function dtUntitled(){const names=new Set(dtab.tabs.filter(t=>t.id!==dtab.live).map(dtName));if(!names.has('Untitled'))return 'Untitled';let i=2;while(names.has('Untitled-'+i))i++;return 'Untitled-'+i;}
/* ---- closing ---- */
function dtAskSave(t){return new Promise(res=>{let done=false;const fin=v=>{if(done)return;done=true;res(v);};
  const dont=el('button',{class:'btn',text:'Don’t save',onclick:()=>{fin('discard');closeDialog();}});
  openDialog({title:'Save “'+dtName(t)+'”?',body:el('div',{class:'dlg-grid'},el('p',{class:'note',text:'It has changes that are not saved. They are lost if you close it without saving.'}),dont),okLabel:'Save',onOk(){fin('save');},onCancel(){fin('cancel');}});});}
async function dtClose(id){const t=dtTab(id);if(!t)return;
  if(dtUnsaved(t)){const r=await dtAskSave(t);if(r==='cancel')return;if(r==='save'){if(!dtActivate(id))return;await new Promise(r=>setTimeout(r,0));try{await saveDoc(false);}catch(e){return;}if(dtUnsaved(t))return;}}
  if(dtab.tabs.length===1){if(ui.mode!=='paint'&&!setMode('paint',true))return;if(t.win)dtDock(id);newDoc(1024,1024,8,[1,1,1],'Untitled',false);dtRender();if(typeof showWelcome==='function')showWelcome();return;}
  if(id===dtab.live){const i=dtab.tabs.indexOf(t),o=dtab.tabs.filter(x=>x!==t).sort((a,b)=>(!!a.win-!!b.win)||Math.abs(dtab.tabs.indexOf(a)-i)-Math.abs(dtab.tabs.indexOf(b)-i))[0];if(!dtActivate(o.id))return;}
  if(t.win){const W=t.win;t.win=null;W.closing=true;try{W.w.close();}catch(e){}}
  disposeDocState(t.state);t.state=null;t.shot=null;dtab.tabs.splice(dtab.tabs.indexOf(t),1);
  if(dtab.main===id){const o=dtab.tabs.find(x=>!x.win);dtab.main=o?o.id:0;}dtPlaceWork();dtRender();}
/* ---- windows of their own ---- */
function dtPop(id,sx,sy){const t=dtTab(id);if(!t||t.win)return;if(ui.mode!=='paint'&&!setMode('paint',true))return;if(dtBusy()){toast('Finish what you are doing first.');return;}
  const W=Math.round(Math.max(640,Math.min(1400,work.clientWidth||1000))),H=Math.round(Math.max(480,Math.min(1000,(work.clientHeight||700)+34)));
  const feat='width='+W+',height='+H+(sx!=null?',left='+Math.round(sx-120)+',top='+Math.round(sy-20):'');
  let w=null;try{w=window.open('about:blank','gsdoc'+(++dtab.seq),feat);}catch(e){}if(!w){toast('The window could not be opened.');return;}
  const d=w.document;d.title=dtName(t)+' — Gouache Studio';for(const st of document.querySelectorAll('style,link[rel=stylesheet]'))d.head.append(d.importNode(st,true));
  d.documentElement.style.cssText=document.documentElement.style.cssText;d.body.className=document.body.className+' dwbody';
  const name=el('span',{class:'dwname'}),dock=el('button',{class:'btn sm',text:'⤓ Back to the main window',title:'Put this document back as a tab in the main window',onclick:()=>dtDock(id)});
  const holder=el('div',{class:'dwholder'}),shot=el('canvas',{class:'dwshot'});holder.append(shot);
  d.body.append(el('div',{class:'dwbar'},name,dock),holder);
  t.win={w,holder,shot,name};
  for(const type of ['keydown','keyup'])w.addEventListener(type,e=>{const tg=e.target,tag=(tg.tagName||'').toLowerCase();if((tag==='input'&&!['range','checkbox','radio','button'].includes(tg.type))||tag==='textarea'||tag==='select')return;
    const ev=new KeyboardEvent(type,{key:e.key,code:e.code,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey,repeat:e.repeat,bubbles:true,cancelable:true});window.dispatchEvent(ev);if(ev.defaultPrevented)e.preventDefault();});
  w.addEventListener('keyup',()=>{},true);
  holder.addEventListener('pointerdown',e=>{if(dtab.live!==id){e.preventDefault();e.stopPropagation();dtActivate(id);}},true);
  w.addEventListener('focus',()=>{if(dtab.live!==id&&!dtBusy())dtActivate(id);});
  w.addEventListener('resize',()=>{if(dtab.live===id){resizeGL();requestRender(true);}else dtDrawShot(shot,t);});
  w.addEventListener('pagehide',()=>{if(t.win&&!t.win.closing)dtDock(id);});
  if(dtab.main===id){const o=dtab.tabs.find(x=>!x.win&&x.id!==id);dtab.main=o?o.id:0;}
  dtPlaceWork();dtRender();if(dtab.live!==id)dtDrawShot(shot,t);
  toast('“'+dtName(t)+'” is in its own window: drag it to your other monitor. Click into a window to work on its document.');}
function dtDock(id){const t=dtTab(id);if(!t||!t.win)return;const W=t.win;t.win=null;W.closing=true;
  if(dtab.live===id||!dtab.main)dtab.main=id;dtPlaceWork();try{W.w.close();}catch(e){}dtRender();}
/* $() also looks in the document windows (the canvas area can be in one) */
{const q=dkPopQuery;dkPopQuery=function(s){const r=q(s);if(r)return r;for(const t of dtab.tabs)if(t.win&&!t.win.w.closed){try{const e=t.win.w.document.querySelector(s);if(e)return e;}catch(e){}}return null;};}
{const ps=dkPopSync;dkPopSync=function(){ps();for(const t of dtab.tabs)if(t.win&&!t.win.w.closed){const d=t.win.w.document;d.documentElement.style.cssText=document.documentElement.style.cssText;d.body.className=document.body.className+' dwbody';}};}
window.addEventListener('beforeunload',()=>{for(const t of dtab.tabs)if(t.win){t.win.closing=true;try{t.win.w.close();}catch(e){}}});
/* ---- the tab bar ---- */
function dtRender(){const L=dtLive();dtab.sig=dtSig();dtBar.replaceChildren(...dtab.tabs.map(t=>{const on=t.id===dtab.live,un=dtUnsaved(t),nm=dtName(t);
    const b=el('div',{class:'dtab'+(on?' on':'')+(t.win?' popped':''),role:'tab','aria-selected':String(on),title:nm+(un?' (not saved)':'')+(t.win?' · in its own window':' · drag down out of the bar for a window of its own')},
      el('span',{class:'dtname',text:(t.win?'↗ ':'')+nm}),el('span',{class:'dtdot',text:un?'•':''}),
      el('button',{class:'dtx',title:'Close','aria-label':'Close '+nm,text:'×',onclick:e=>{e.stopPropagation();dtClose(t.id);}}));
    b.addEventListener('pointerdown',e=>dtDragStart(e,t,b));b.addEventListener('auxclick',e=>{if(e.button===1){e.preventDefault();dtClose(t.id);}});
    return b;}),el('button',{class:'dtnew',title:'New document (Ctrl+Alt+N)','aria-label':'New document',text:'+',onclick:()=>actions.new()}));
  for(const t of dtab.tabs)if(t.win){t.win.name.textContent=dtName(t)+(dtUnsaved(t)?' •':'');try{t.win.w.document.title=dtName(t)+' — Gouache Studio';}catch(e){}}}
function dtSig(){return dtab.live+'|'+dtab.tabs.map(t=>t.id+':'+dtName(t)+':'+dtUnsaved(t)+':'+!!t.win).join(',');}
setInterval(()=>{if(dtSig()!==dtab.sig)dtRender();for(const t of dtab.tabs)if(t.win&&t.win.w.closed&&!t.win.closing)dtDock(t.id);},700);
/* drag: left/right reorders, down out of the bar opens a window of its own */
function dtDragStart(e,t,b){if(e.button!==0||e.target.closest('.dtx'))return;const x0=e.clientX,y0=e.clientY;let moved=false,out=false;b.setPointerCapture(e.pointerId);
  const mv=ev=>{if(!moved&&Math.hypot(ev.clientX-x0,ev.clientY-y0)<6)return;moved=true;const br=dtBar.getBoundingClientRect();out=ev.clientY>br.bottom+40||ev.clientY<br.top-40;
    b.classList.toggle('tearing',out);document.body.classList.toggle('dtdrag',true);
    if(!out){const others=[...dtBar.querySelectorAll('.dtab')];const i=dtab.tabs.indexOf(t);for(const [j,o] of others.entries()){if(o===b)continue;const r=o.getBoundingClientRect();
        if(ev.clientX>r.left&&ev.clientX<r.right){dtab.tabs.splice(i,1);dtab.tabs.splice(j,0,t);dtRender();const nb=[...dtBar.querySelectorAll('.dtab')][j];if(nb){b.releasePointerCapture&&b.releasePointerCapture(ev.pointerId);up(ev);}return;}}}},
    up=ev=>{b.removeEventListener('pointermove',mv);b.removeEventListener('pointerup',up);b.removeEventListener('pointercancel',up);document.body.classList.remove('dtdrag');b.classList.remove('tearing');
      if(!moved){if(t.win){try{t.win.w.focus();}catch(e){}dtActivate(t.id);}else dtActivate(t.id);return;}
      if(out&&ev.type==='pointerup'&&!t.win)dtPop(t.id,ev.screenX,ev.screenY);};
  b.addEventListener('pointermove',mv);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);}
/* ---- keys: Ctrl+Tab / Ctrl+Shift+Tab switch documents, Ctrl+W closes one ---- */
window.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||ui.mode!=='paint'||!modal.hidden)return;
  if(e.key==='Tab'&&dtab.tabs.length>1){e.preventDefault();e.stopImmediatePropagation();const i=dtab.tabs.findIndex(t=>t.id===dtab.live),n=dtab.tabs.length,o=dtab.tabs[(i+(e.shiftKey?-1:1)+n)%n];if(o.win)try{o.win.w.focus();}catch(err){}dtActivate(o.id);}
  else if((e.key==='w'||e.key==='W')&&!e.shiftKey&&!isTypingTarget(e.target)){e.preventDefault();e.stopImmediatePropagation();dtClose(dtab.live);}},true);
/* unsaved work in any tab counts when closing the app */
{const u=unsavedWork;unsavedWork=function(){return u()||dtab.tabs.some(t=>t.state&&dtUnsaved(t));};}
/* opening a file (and the examples, which ask first) now opens it in a new tab instead of replacing the canvas */
askReplace=function(){return Promise.resolve(dtNewTab());};
Object.assign(actions,{closeDoc:()=>dtClose(dtab.live),nextDoc:()=>{const i=dtab.tabs.findIndex(t=>t.id===dtab.live);const o=dtab.tabs[(i+1)%dtab.tabs.length];if(o)dtActivate(o.id);},popDoc:()=>dtPop(dtab.live)});
MENUS.File.splice(MENUS.File.findIndex(it=>it[1]==='new')+1,0,['Close document','closeDoc','Ctrl+W']);
MENUS.Window.push('-',['Next document','nextDoc','Ctrl+Tab'],['Document in its own window','popDoc']);
/* the first tab: the document the app started with */
dtab.tabs.push({id:++dtab.seq,state:null,win:null,shot:null});dtab.live=dtab.main=dtab.seq;dtRender();
