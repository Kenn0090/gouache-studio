/* ================= Resize report (0.98.15, Georgian: "it's how it's recalculating the layers already done") =================
   Help › Resize report… lists the last texture-size changes: how big, how much graphics memory, and for every layer, mask and map HOW it was brought
   to the new size (strokes replayed, scaled, re-made from its rows, filled with one colour) and whether it worked. Only names, sizes and counts, no pictures.
   "Hide layer names" swaps them for Layer 1, Layer 2… so it can be shared. */
const rr={log:[],hide:false};
function rrMem(){try{const G=gpuMemory();return {bytes:G.bytes,budget:gpuBudget()};}catch(e){return {bytes:0,budget:0};}}
function rrTiles(){try{const S=p3.sets[p3.cur],nm=S&&p3Binding(S),B=nm&&udimBox(nm);if(!B)return null;return {set:nm,tiles:B.tiles.map(t=>t.id+':'+((B.size&&B.size[t.id])||p3.size)+'px'),packed:!!B.lay};}catch(e){return null;}}
{const f=p3Resize;p3Resize=async function(n){const e={at:new Date().toLocaleTimeString(),req:n,from:[doc.w,doc.h],depth:doc.depth,mem0:rrMem(),tiles0:rrTiles(),sets:(p3.sets||[]).length,layers:(typeof paintLayers==='function'?paintLayers().length:0),jobs:null,msg:null,ok:null};
    rr.log.push(e);if(rr.log.length>6)rr.log.shift();rr.cur=e;const t0=performance.now(),tst=toast;toast=function(m){e.msg=m;return tst.apply(this,arguments);};
    try{e.ok=await f.apply(this,arguments);}catch(x){e.ok=false;e.msg=x&&x.message||String(x);throw x;}
    finally{toast=tst;e.ms=Math.round(performance.now()-t0);e.to=[doc.w,doc.h];e.mem1=rrMem();e.tiles1=rrTiles();rr.cur=null;}
    return e.ok;};}
{const f=p3PaintPrepare;p3PaintPrepare=async function(w,h,keep,cancel){const e=rr.cur;try{const jobs=await f.apply(this,arguments);if(e)e.jobs=jobs.map(j=>({what:j.what||'map',layer:j.layer,map:j.map,fill:j.fill,from:j.src?[j.src.w,j.src.h,j.src.depth]:null,to:j.nt?[j.nt.w,j.nt.h,j.nt.depth]:null,how:j.how||'?'}));return jobs;}
  catch(x){if(e)e.jobsErr=x&&x.message||String(x);throw x;}};}
function rrText(){const hide=rr.hide,names=new Map(),nm=s=>{if(!hide)return s||'(unnamed)';if(!names.has(s))names.set(s,'Layer '+(names.size+1));return names.get(s);},fb=n=>fmtBytes(n),out=['RESIZE REPORT · Gouache Studio '+(typeof APP_VERSION!=='undefined'?APP_VERSION:''),'Only names, sizes and counts. No pictures.',''];
  if(!rr.log.length)out.push('No texture-size change has been made in this session yet.');
  for(const e of rr.log.slice().reverse()){
    out.push('— '+e.at+' · asked for '+e.req+' px · canvas '+e.from.join('×')+' → '+(e.to?e.to.join('×'):'?')+' · '+(e.ok?'DONE':e.ok===false?'NOT DONE':'running')+(e.ms!=null?' in '+(e.ms/1000).toFixed(1)+' s':''));
    out.push('  '+e.layers+' paint layers, '+e.sets+' texture set(s), '+e.depth+'-bit'+(e.tiles0?' · tiles before: '+e.tiles0.tiles.join(' ')+(e.tiles0.packed?' (packed)':''):'')+(e.tiles1?' · after: '+e.tiles1.tiles.join(' '):''));
    out.push('  graphics memory: '+fb(e.mem0.bytes)+' before'+(e.mem1?', '+fb(e.mem1.bytes)+' after':'')+' · card budget '+fb(e.mem0.budget));
    if(e.msg)out.push('  message: '+e.msg);if(e.jobsErr)out.push('  stopped while preparing: '+e.jobsErr);
    if(e.jobs){const by={};for(const j of e.jobs)by[j.how]=(by[j.how]||0)+1;out.push('  how the '+e.jobs.length+' pictures were brought to the new size: '+Object.entries(by).map(([k,v])=>v+' × '+k).join(', '));
      for(const j of e.jobs)out.push('    · '+j.what+' · '+nm(j.layer)+(j.map?' · '+j.map:'')+(j.fill?' (material)':'')+' · '+(j.from?j.from[0]+'×'+j.from[1]+' '+j.from[2]+'-bit':'?')+' → '+(j.to?j.to[0]+'×'+j.to[1]:'?')+' · '+j.how);}
    out.push('');}
  return out.join('\n');}
function dlgResizeReport(){const ta=el('textarea',{id:'rrText',class:'prtext',readonly:true,rows:22,'aria-label':'Resize report'}),upd=()=>{ta.value=rrText();};upd();
  const hide=chk('rrHide','Hide layer names (Layer 1, Layer 2…)',rr.hide,v=>{rr.hide=v;upd();});
  const copy=el('button',{class:'btn',type:'button',id:'rrCopy',text:'Copy the report',onclick:async()=>{let ok=false;try{await navigator.clipboard.writeText(ta.value);ok=true;}catch(e){try{ta.select();ok=document.execCommand('copy');}catch(_){}}toast(ok?'Copied.':'Select the text and copy it.');}});
  openDialog({title:'Resize report',body:el('div',{class:'dlg-grid'},el('p',{class:'note',text:'This lists the last texture-size changes of this session: the memory used, and for each layer, mask and map how it was brought to the new size. Send it when a resize goes wrong.'}),hide,ta,el('div',{class:'chips'},copy)),okLabel:'Close',onOk(){},resizable:true,wide:true});}
actions.resizeReport=dlgResizeReport;
{const i=MENUS.Help.findIndex(m=>Array.isArray(m)&&m[1]==='paintReport');MENUS.Help.splice(i<0?MENUS.Help.length:i+1,0,['Resize report…','resizeReport']);}
