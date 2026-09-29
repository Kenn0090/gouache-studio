/* ================= Alt + click on a group of tick boxes (0.28) =================
   Kenn: Alt + click a tick box keeps only that one ticked; Alt + click it again ticks all the others and unticks it.
   Works on any group of tick boxes: the bake maps, the Material panel's channels, the export and send ticks, etc.
   A group is the tick boxes whose ids share a start (bks_ao, bks_curv… or fl_on_base, fl_on_rough…) in the nearest
   panel or window holding at least two of them; boxes without such ids group by the row of chips they sit in. */
function tickGroup(box){const pre=(box.id||'').replace(/[^_]+$/,''),stop=box.closest('.dialog,.dksec,.dkbody,#modal,body')||document.body;
  if(pre&&pre.length>1){let n=box.parentElement;while(n&&n!==stop.parentElement){const g=[...n.querySelectorAll('input[type=checkbox]')].filter(b=>b.id&&b.id.startsWith(pre)&&!/[_]/.test(b.id.slice(pre.length)));if(g.length>=2)return g;n=n.parentElement;}}
  const row=box.closest('.chips,[data-ticks]');if(row){const g=[...row.querySelectorAll('input[type=checkbox]')];if(g.length>=2)return g;}
  return null;}
function tickSolo(box,group){const others=group.filter(b=>b!==box&&!b.disabled);
  const flip=box.checked&&others.every(b=>!b.checked);
  const want=new Map([[box,!flip],...others.map(b=>[b,flip])]);
  /* a change can redraw the panel: find each box again by its id before clicking it */
  for(const [b,v] of want){const cur=(b.id&&document.getElementById(b.id))||b;if(cur.checked!==v)cur.click();}}
document.addEventListener('click',e=>{if(!e.altKey||e.ctrlKey||e.metaKey)return;const lab=e.target.closest&&e.target.closest('label');
  const box=e.target.matches&&e.target.matches('input[type=checkbox]')?e.target:lab&&lab.querySelector('input[type=checkbox]');if(!box||box.disabled)return;
  const g=tickGroup(box);if(!g)return;e.preventDefault();e.stopPropagation();tickSolo(box,g);},true);
