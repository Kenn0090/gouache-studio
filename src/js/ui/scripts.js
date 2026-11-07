/* ================= Scripts window (0.96, Kenn: scripting first) =================
   Window › Scripts…: write, run, save and load scripts that use the `gouache` command set (api/gs-api.js), with a log, the
   list of commands, examples, and a Record button that turns what you do into a script (menu commands, layer commands,
   colours, tools, brushes, filters with their settings, and brush strokes on the flat canvas).
   A script is JavaScript; `await` is allowed at the top. A whole run is one undo step. Stop asks the script to stop at its
   next command. Python comes later on the same commands. */
window.gouache=gouache;
const scr={list:null,cur:null,body:null,log:null,ed:null,run:null,stop:false,rec:null};
const SCR_KEY='gs.scripts';
const SCR_EXAMPLES=[
  {name:'Example: list the layers',code:`// Writes every layer of the open document into the log.
const info = gouache.doc.info();
gouache.log('Document', info.name, info.width + ' × ' + info.height);
for (const L of gouache.layers.list())
  gouache.log('-', L.name, '(' + L.kind + ')', 'opacity', L.opacity, L.blend);`},
  {name:'Example: a paint layer with a stroke',code:`// Adds a layer, picks a colour and draws a wavy line across the canvas.
const { width, height } = gouache.doc.info();
gouache.layers.add('Scripted stroke');
gouache.paint.colour('#d9643a');
gouache.paint.size(Math.max(8, width / 40));
const pts = [];
for (let i = 0; i <= 40; i++) {
  const x = width * (0.1 + 0.8 * i / 40);
  const y = height * (0.5 + 0.2 * Math.sin(i / 4));
  pts.push([x, y, 1]);
}
await gouache.paint.stroke(pts);`},
  {name:'Example: rusty edges on every texture set',code:`// 3D Paint: in every texture set, a material with an Edge wear mask.
await gouache.setMode('p3d');
await gouache.p3d.inEverySet(async set => {
  gouache.layers.addMaterial({ name: 'Rust edges', base: [0.42, 0.2, 0.09], rough: 0.85, metal: 0 });
  gouache.layers.addMask(null, 'black');
  gouache.layers.addMaskRow('gen', { g: 'edge', amount: 0.55, width: 0.5 });
  gouache.log('Done:', set);
});`},
  {name:'Example: filter with settings',code:`// Blurs the selected layer, then sharpens it a little.
await gouache.filters.apply('blur', { r: 6 });
await gouache.filters.apply('sharpen', { a: 0.6, r: 2 });
gouache.log('Filters you can use:', gouache.filters.list().map(f => f.id).join(', '));`}];
function scrLoad(){if(scr.list)return scr.list;try{scr.list=JSON.parse(localStorage.getItem(SCR_KEY)||'[]');}catch(e){scr.list=[];}if(!Array.isArray(scr.list))scr.list=[];return scr.list;}
function scrSave(){try{localStorage.setItem(SCR_KEY,JSON.stringify(scr.list));}catch(e){toast('Could not save the scripts (storage is full?).');}}
/* the log */
function apiLog(kind,args){const t=args.map(a=>typeof a==='string'?a:(()=>{try{return JSON.stringify(a);}catch(e){return String(a);}})()).join(' ');
  if(scr.log&&scr.log.isConnected){const line=el('div',{class:'scrline '+kind,text:t});scr.log.append(line);scr.log.scrollTop=scr.log.scrollHeight;}else(kind==='err'?console.warn:console.log)('[script]',t);}
/* run a script: one undo step, Stop between commands */
const AsyncFn=Object.getPrototypeOf(async function(){}).constructor;
async function scrRun(code,name){if(scr.run){toast('A script is already running.');return;}let fn;
  try{fn=new AsyncFn('gouache','log',code);}catch(e){apiLog('err',['The script has a typing mistake: '+e.message]);return false;}
  scr.stop=false;const from=hist.undo.length,t0=performance.now();scr.run={name};scrSync();apiLog('info',['▶ '+(name||'Script')]);let ok=true;
  try{const r=await fn(gouache,gouache.log);if(r!==undefined)apiLog('log',['Result:',r]);}
  catch(e){ok=false;apiLog('err',[e&&e.name==='Gouache'||e&&e.message==='Stopped.'?e.message:'Error: '+(e&&e.message||e)]);if(!(e&&e.name==='Gouache'))console.warn(e);}
  finally{scr.run=null;scr.stop=false;if(typeof undoMerge==='function'&&hist.undo.length-from>1)undoMerge(from,'Script: '+(name||'script'));renderLayers();requestRender(true);scrSync();
    apiLog('info',[(ok?'✓ Done':'✗ Stopped')+' in '+((performance.now()-t0)/1000).toFixed(1)+' s'+(hist.undo.length>from?' (one undo step)':'')]);}
  return ok;}
/* Stop: every command checks it */
{const b=apiBusy;apiBusy=function(){if(scr.stop&&scr.run)throw new ApiError('Stopped.');return b();};}
{const w=gouache.wait;gouache.wait=async ms=>{const end=performance.now()+ms;while(performance.now()<end){if(scr.stop&&scr.run)throw new ApiError('Stopped.');await apiWait(Math.min(100,end-performance.now()));}};}

/* ---- the recorder: what you do becomes script lines ---- */
const SCR_REC_SKIP=new Set(['undo','redo','scripts','keys','prefs','save','saveAs','open','recent','new','checkUpdates','helpGuide','whatsNew','about','content','aiAddons','welcome','setup']);
let scrDepth=0;
function scrRecLine(line){const R=scr.rec;if(!R||scr.run||scrDepth>0)return;const a=doc.active;
  if(a&&a!==R.lastActive&&!/^gouache\.layers\.(add|addMaterial|addGroup|duplicate|add3DGradient)/.test(line)){R.lines.push('gouache.layers.select('+JSON.stringify(a.name)+');');}
  R.lines.push(line);setTimeout(()=>{R.lastActive=doc.active;scrSync();},0);}
const scrJ=v=>JSON.stringify(v,(k,x)=>typeof x==='number'?Math.round(x*1000)/1000:x);
/* wrap a global function: run it, then record a line built from its arguments (inner calls are not recorded) */
/* (the app's commands live inside its own script, not on window: each is swapped here by name) */
function scrWrap(f,make){if(typeof f!=='function'||f._scr)return f;const w=function(...a){scrDepth++;let r;try{r=f.apply(this,a);}finally{scrDepth--;}const line=scr.rec&&!scr.run&&scrDepth===0?make(...a):null;if(line)scrRecLine(line);return r;};w._scr=true;return w;}
function scrHooksOnce(){if(scr.hooked)return;scr.hooked=true;
  cmdAddLayer=scrWrap(cmdAddLayer,n=>'gouache.layers.add('+(n?scrJ(n):'')+');');
  cmdDuplicate=scrWrap(cmdDuplicate,()=>'gouache.layers.duplicate();');
  cmdDelete=scrWrap(cmdDelete,()=>'gouache.layers.delete();');
  cmdMerge=scrWrap(cmdMerge,()=>'gouache.layers.mergeDown();');
  cmdGroup=scrWrap(cmdGroup,()=>'gouache.layers.group();');
  cmdAddMask=scrWrap(cmdAddMask,f=>'gouache.layers.addMask(null, '+(f===0?'"black"':'"white"')+');');
  cmdNewFillLayer=scrWrap(cmdNewFillLayer,p=>{if(!p)return 'gouache.layers.addMaterial();';const o={name:p.name||'Material'};for(const k in p.maps||{}){const m=p.maps[k];if(m.c)o[k]=m.c;else if(m.v!=null)o[k]=m.v;}return 'gouache.layers.addMaterial('+scrJ(o)+');';});
  cmdNewG3dLayer=scrWrap(cmdNewG3dLayer,()=>'gouache.layers.add3DGradient();');
  setFG=scrWrap(setFG,c=>{const R=scr.rec;if(R&&R.lines.length&&/^gouache\.paint\.colour\(/.test(R.lines[R.lines.length-1]))R.lines.pop();return 'gouache.paint.colour('+scrJ(c.slice(0,3))+');';});
  setTool=scrWrap(setTool,t=>'gouache.paint.tool('+scrJ(t)+');');
  applyPreset=scrWrap(applyPreset,p=>p&&p.name?'gouache.paint.brush('+scrJ(p.name)+');':null);
  setEditMap=scrWrap(setEditMap,k=>'gouache.doc.setMap('+scrJ(k)+');');
  selectAll=scrWrap(selectAll,()=>'gouache.select.all();');deselect=scrWrap(deselect,()=>'gouache.select.none();');invertSel=scrWrap(invertSel,()=>'gouache.select.invert();');
  setMode=scrWrap(setMode,m=>'await gouache.setMode('+scrJ(m)+');');
  /* menu commands (filters are recorded when applied, with their settings) */
  for(const id in actions){const f=actions[id];if(typeof f!=='function'||f._scr||SCR_REC_SKIP.has(id))continue;const w=function(...a){const isFx=!!FX[id];scrDepth++;let r;try{r=f.apply(this,a);}finally{scrDepth--;}if(!isFx&&scr.rec&&!scr.run&&scrDepth===0)scrRecLine('await gouache.menu('+scrJ(id)+');');return r;};w._scr=true;actions[id]=w;}
  /* brush strokes on the flat canvas */
  const bs=beginStroke,ap=addPoint,es=endStroke;
  beginStroke=function(L,x,y,p,o){const r=bs.apply(this,arguments);if(scr.rec&&!scr.run&&scrDepth===0)scr.rec.pts=stroke&&!stroke.space&&!v3.mstroke?[[x,y,p]]:null;return r;};
  addPoint=function(x,y,p){const r=ap.apply(this,arguments);if(scr.rec&&scr.rec.pts&&scr.rec.pts.length<4000)scr.rec.pts.push([x,y,p]);return r;};
  endStroke=function(record){const R=scr.rec,pts=R&&R.pts;if(R)R.pts=null;const r=es.apply(this,arguments);if(R&&!scr.run&&record){/* brush previews draw strokes without recording them: those are not yours */if(pts&&pts.length)scrRecLine('await gouache.paint.stroke('+scrJ(pts.map(q=>[q[0],q[1],q[2]==null?1:q[2]]))+');');else if(pts===null&&v3.on)R.lines.push('// (a stroke on the 3D model is not recorded yet)');}return r;};}
/* filters: called from the filter window's Apply (and the one-step filters) */
function apiRecFx(id,v,asLayer){if(!scr.rec||scr.run)return;scrRecLine(asLayer?'gouache.filters.addFilterLayer('+scrJ(id)+', '+scrJ(v)+');':'await gouache.filters.apply('+scrJ(id)+', '+scrJ(v)+');');}
function scrRecToggle(){if(scr.rec){const R=scr.rec;scr.rec=null;const code='// Recorded '+new Date().toLocaleString()+'\n'+R.lines.join('\n')+'\n';
    if(scr.ed){scr.ed.value=(scr.ed.value.trim()?scr.ed.value.replace(/\s*$/,'\n\n'):'')+code;scr.cur=null;}apiLog('info',['■ Recording stopped: '+R.lines.length+' lines added to the script.']);scrSync();return;}
  scrHooksOnce();scr.rec={lines:[],lastActive:doc.active,pts:null};apiLog('info',['● Recording: use the app as usual, then press Stop recording.']);scrSync();}

/* ---- the window ---- */
function scrSync(){const b=scr.body;if(!b||!b.isConnected)return;const run=$('#scrRun'),stop=$('#scrStop'),rec=$('#scrRec');
  if(run)run.disabled=!!scr.run;if(stop)stop.disabled=!scr.run;if(rec){rec.textContent=scr.rec?'■ Stop recording ('+scr.rec.lines.length+')':'● Record';rec.classList.toggle('on',!!scr.rec);}}
function dlgScripts(){scrLoad();const list=el('select',{id:'scrList','aria-label':'Saved scripts',size:8,class:'scrlist'});
  const name=el('input',{type:'text',id:'scrName',placeholder:'Script name','aria-label':'Script name'});
  const ed=el('textarea',{id:'scrCode',class:'scrcode',spellcheck:'false','aria-label':'Script'});scr.ed=ed;
  ed.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const s=ed.selectionStart,t=ed.selectionEnd;ed.value=ed.value.slice(0,s)+'  '+ed.value.slice(t);ed.selectionStart=ed.selectionEnd=s+2;}
    if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();scrRun(ed.value,name.value);}e.stopPropagation();});
  const log=el('div',{class:'scrlog',id:'scrLog','aria-live':'polite'});scr.log=log;
  const fill=()=>{const mine=scrLoad();list.replaceChildren(el('optgroup',{label:'Your scripts'},...(mine.length?mine.map((s,i)=>el('option',{value:'m'+i,text:s.name})):[el('option',{value:'',text:'(none yet)',disabled:true})])),
      el('optgroup',{label:'Examples'},...SCR_EXAMPLES.map((s,i)=>el('option',{value:'x'+i,text:s.name.replace('Example: ','')}))));};
  list.onchange=()=>{const v=list.value;if(!v)return;const s=v[0]==='m'?scrLoad()[+v.slice(1)]:SCR_EXAMPLES[+v.slice(1)];if(!s)return;ed.value=s.code;name.value=v[0]==='m'?s.name:s.name.replace('Example: ','')+' (copy)';scr.cur=v[0]==='m'?+v.slice(1):null;};
  const save=()=>{const n=name.value.trim()||'Untitled script',L=scrLoad();let i=L.findIndex(s=>s.name===n);if(i<0){L.push({name:n,code:ed.value});i=L.length-1;}else L[i].code=ed.value;scrSave();fill();list.value='m'+i;scr.cur=i;toast('Saved “'+n+'”.');};
  const del=()=>{const v=list.value;if(!v||v[0]!=='m')return toast('Pick one of your scripts to delete.');const L=scrLoad(),s=L[+v.slice(1)];if(!s)return;L.splice(+v.slice(1),1);scrSave();fill();toast('Deleted “'+s.name+'”.');};
  const imp=async()=>{const fs=await pickFiles('.js,.txt,text/javascript',false,'Script',['js','txt']);const f=fs&&fs[0];if(!f)return;const code=await f.text();
    const go=()=>{ed.value=code;name.value=f.name.replace(/\.(js|txt)$/i,'');scr.cur=null;apiLog('info',['Loaded “'+f.name+'”. Read it before you run it: only run scripts from people you trust.']);};go();};
  const exp=()=>{const n=(name.value.trim()||'script').replace(/[\\/:*?"<>|]/g,'_');const a=el('a',{href:URL.createObjectURL(new Blob([ed.value],{type:'text/javascript'})),download:n+'.js'});document.body.append(a);a.click();a.remove();};
  const cmds=el('details',{class:'scrcmds'},el('summary',{text:'Commands ('+apiCommands().length+')'}),el('div',{class:'scrcmdlist'},...apiCommands().map(c=>el('button',{type:'button',class:'btn sm mono',text:c,title:'Insert at the cursor',onclick:()=>{const s=ed.selectionStart;ed.value=ed.value.slice(0,s)+c+'('+ed.value.slice(s);ed.focus();ed.selectionStart=ed.selectionEnd=s+c.length+1;}}))),
    el('p',{class:'note',text:'Colours are [r, g, b] from 0 to 1 or "#rrggbb"; positions are canvas pixels. Commands that wait (marked with await in the examples) need await. gouache.menus() lists every menu command for gouache.menu(id). The user guide (Scripting) explains each command.'}));
  scr.body=el('div',{class:'scrdlg',id:'scrDlg'},
    el('div',{class:'scrside'},list,el('div',{class:'chips'},el('button',{type:'button',class:'btn sm',id:'scrNew',text:'New',onclick:()=>{ed.value='';name.value='';scr.cur=null;list.value='';ed.focus();}}),el('button',{type:'button',class:'btn sm',id:'scrDel',text:'Delete',onclick:del})),
      el('div',{class:'chips'},el('button',{type:'button',class:'btn sm',id:'scrImp',text:'Load file…',onclick:imp}),el('button',{type:'button',class:'btn sm',id:'scrExp',text:'Save file…',onclick:exp}))),
    el('div',{class:'scrmain'},el('div',{class:'frow'},name,el('span',{class:'note',text:'JavaScript · Python later'})),ed,
      el('div',{class:'chips'},el('button',{type:'button',class:'btn primary',id:'scrRun',text:'▶ Run',title:'Ctrl+Enter',onclick:()=>scrRun(ed.value,name.value)}),el('button',{type:'button',class:'btn',id:'scrStop',text:'Stop',disabled:true,onclick:()=>{scr.stop=true;}}),
        el('button',{type:'button',class:'btn',id:'scrSave',text:'Save',onclick:save}),el('button',{type:'button',class:'btn',id:'scrRec',text:'● Record',onclick:scrRecToggle}),el('button',{type:'button',class:'btn sm',id:'scrClear',text:'Clear log',onclick:()=>log.replaceChildren()})),
      log,cmds));
  fill();openDialog({title:'Scripts',body:scr.body,float:true,wide:true,resizable:true,okLabel:null,cancelLabel:'Close',onCancel(){scr.body=null;scr.log=null;scr.ed=null;}});scrSync();}
Object.assign(actions,{scripts:dlgScripts});
MENUS.Window.push('-',['Scripts…','scripts']);
