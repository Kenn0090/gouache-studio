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
const matFlush=()=>{if(typeof matEd!=='undefined'&&matEd.snap)matEdCommit();};
{const pu=pushUndo;pushUndo=function(r){matFlush();pu(r);renderHistory();};const u=undo;undo=async function(){matFlush();await u();renderHistory();};const rd=redo;redo=async function(){matFlush();await rd();renderHistory();};
  const ch=clearHistory;clearHistory=function(){if(typeof matEd!=='undefined'){clearTimeout(matEd.timer);matEd.snap=null;}ch();renderHistory();};const sd=setDocState;setDocState=function(s){matFlush();sd(s);renderHistory();if(typeof renderMatEd==='function')renderMatEd(true);};}
/* the Edit menu and Ctrl+Z hold their own reference: point them at the ones above */
actions.undo=()=>undo();actions.redo=()=>redo();
