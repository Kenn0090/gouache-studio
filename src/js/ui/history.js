/* ================= History panel =================
   Every undo step of the document you are in, oldest first (like Photoshop's History). Click a step to go back to
   it (or forward again); the greyed steps after it are what Redo brings back. A new edit drops them. */
let histQ=0,histJumping=false;
function renderHistory(){if(histQ)return;histQ=requestAnimationFrame(()=>{histQ=0;const box=document.getElementById('histBody');if(!box)return;
  const U=hist.undo,R=hist.redo,cur=U.length-1,row=(label,i,cls,title)=>{const b=el('div',{class:'hrow '+cls,role:'option','aria-selected':String(cls.includes('on')),tabindex:'0',title:title||'',text:label});
      b.addEventListener('click',()=>histJump(i));b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();histJump(i);}});return b;};
  const rows=[row(doc.name?'Open: '+doc.name:'Start',-1,cur===-1?'on first':'first','The document before the first step you can still undo')];
  U.forEach((r,i)=>rows.push(row(r.label||'Edit',i,i===cur?'on':'')));
  for(let j=R.length-1;j>=0;j--)rows.push(row(R[j].label||'Edit',U.length+(R.length-1-j),'redo','Redo brings this back'));
  box.replaceChildren(...rows);const on=box.querySelector('.on');if(on)on.scrollIntoView({block:'nearest'});});}
/* step back or forward to history index i (-1 = the start) */
async function histJump(i){if(histJumping)return;histJumping=true;try{let guard=500;
  while(hist.undo.length-1>i&&hist.undo.length&&guard--){const n=hist.undo.length;await undo();if(hist.undo.length===n)break;}
  while(hist.undo.length-1<i&&hist.redo.length&&guard--){const n=hist.redo.length;await redo();if(hist.redo.length===n)break;}}finally{histJumping=false;renderHistory();}}
/* a material change still waiting for its pause becomes its undo step first, so steps stay in order */
const matFlush=()=>{if(typeof luFlush==='function')luFlush();if(typeof pathFlush==='function')pathFlush();if(typeof matEd!=='undefined'&&matEd.snap)matEdCommit();if(typeof msEd!=='undefined'&&msEd.snap)msCommit();};
{const pu=pushUndo;pushUndo=function(r){matFlush();pu(r);renderHistory();};const u=undo;undo=async function(){matFlush();await u();renderHistory();};const rd=redo;redo=async function(){matFlush();await rd();renderHistory();};
  const ch=clearHistory;clearHistory=function(){for(const L of allLayers()){clearTimeout(L._pathTimer);L._pathBefore=null;}if(typeof matEd!=='undefined'){clearTimeout(matEd.timer);matEd.snap=null;}if(typeof msEd!=='undefined'){clearTimeout(msEd.timer);msEd.snap=null;}ch();renderHistory();};const sd=setDocState;setDocState=function(s){matFlush();sd(s);renderHistory();if(typeof renderMatEd==='function')renderMatEd(true);};}
/* the Edit menu and Ctrl+Z hold their own reference: point them at the ones above */
actions.undo=()=>{if(edHist){edHist.undo();return;}undo();};actions.redo=()=>{if(edHist){edHist.redo();return;}redo();};
/* (0.80.1, Kenn) undo inside an open editor (a filter layer's settings, the Lights window): each change is a step;
   while one is open, Ctrl+Z and the Edit menu step through it instead of the document. get() is the state as text, apply(text) puts one back. */
let edHist=null;
function editHistory(get,apply){const H={list:[get()],pos:0,t:0,sync:null,
  note(){clearTimeout(H.t);H.t=setTimeout(()=>H.commit(),400);if(H.sync)H.sync();},
  commit(){clearTimeout(H.t);H.t=0;const cur=get();if(cur!==H.list[H.pos]){H.list=H.list.slice(0,H.pos+1);H.list.push(cur);H.pos++;if(H.list.length>300){H.list.shift();H.pos--;}}if(H.sync)H.sync();},
  undo(){H.commit();if(H.pos<=0){toast('Nothing more to undo here.');return false;}H.pos--;apply(H.list[H.pos]);if(H.sync)H.sync();return true;},
  redo(){H.commit();if(H.pos>=H.list.length-1)return false;H.pos++;apply(H.list[H.pos]);if(H.sync)H.sync();return true;},
  buttons(prefix){const u=el('button',{class:'btn sm',type:'button',id:prefix+'Undo',text:'↶ Undo',title:'Undo the last change (Ctrl+Z)',onclick:()=>H.undo()}),
      r=el('button',{class:'btn sm',type:'button',id:prefix+'Redo',text:'↷ Redo',title:'Redo (Ctrl+Shift+Z)',onclick:()=>H.redo()});
    H.sync=()=>{u.disabled=H.pos<=0&&!H.t;r.disabled=H.pos>=H.list.length-1;};H.sync();return el('div',{class:'chips edhist'},u,r);},
  /* Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y while the editor is open, also with a slider or field focused (unless the app's own keys already took it) */
  bindKeys(){const k=e=>{if(e.defaultPrevented||!(e.ctrlKey||e.metaKey)||e.altKey)return;const c=e.key.toLowerCase();
      if(c==='z'&&!e.shiftKey){e.preventDefault();e.stopPropagation();H.undo();}else if(c==='y'||c==='z'&&e.shiftKey){e.preventDefault();e.stopPropagation();H.redo();}};
    window.addEventListener('keydown',k,true);return ()=>window.removeEventListener('keydown',k,true);}};
  return H;}
