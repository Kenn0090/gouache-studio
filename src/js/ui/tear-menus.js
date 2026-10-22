/* ================= Tear-off menus (0.67, tester feedback) =================
   Every menu starts with a dotted "tear off" row. Click it and the menu stays open in a small window you can move anywhere.
   Torn-off menus can be fused: drag a menu's grip (the dots at the left of its name) onto another window to stack them in one
   column, or out onto empty space to make a window of its own. Click a menu's name to fold it, × to close it. They are kept for next time. */
const tear={cols:[],el:null,drag:null};
try{const s=JSON.parse(localStorage.getItem('gs.tear')||'[]');if(Array.isArray(s))tear.cols=s.filter(c=>c&&Array.isArray(c.secs)).map(c=>({id:c.id||('c'+Math.random().toString(36).slice(2,7)),x:+c.x||40,y:+c.y||80,secs:c.secs.filter(q=>MENUS[q.m]).map(q=>({m:q.m,open:q.open!==false}))})).filter(c=>c.secs.length);}catch(e){}
const tearSave=()=>{try{localStorage.setItem('gs.tear',JSON.stringify(tear.cols.map(c=>({id:c.id,x:Math.round(c.x),y:Math.round(c.y),secs:c.secs}))));}catch(e){}};
function tearHost(){if(!tear.el){tear.el=el('div',{id:'tearHost'});document.body.append(tear.el);}return tear.el;}
function tearFind(m){for(const c of tear.cols){const s=c.secs.find(q=>q.m===m);if(s)return [c,s];}return null;}
function tearAdd(m,x,y){const f=tearFind(m);if(f){f[1].open=true;tearRender();const e=tearHost().querySelector('[data-col="'+f[0].id+'"]');if(e){e.classList.add('flash');setTimeout(()=>e.classList.remove('flash'),700);}return;}
  tear.cols.push({id:'c'+(Date.now()%1e7)+Math.floor(Math.random()*99),x:clamp(x,4,window.innerWidth-240),y:clamp(y,4,window.innerHeight-80),secs:[{m,open:true}]});tearSave();tearRender();}
function tearClean(){tear.cols=tear.cols.filter(c=>c.secs.length);}
function tearRender(){const host=tearHost();host.replaceChildren(...tear.cols.map(tearCol));}
function tearCol(c){const col=el('div',{class:'tearcol','data-col':c.id,style:'left:'+c.x+'px;top:'+c.y+'px'});
  const head=el('div',{class:'tearhead',title:'Drag to move this window'},el('span',{class:'tdots',text:'⋮⋮'}),el('span',{class:'tt',text:c.secs.length>1?'Menus':'Torn-off menu'}),
    el('button',{class:'tx','aria-label':'Close this window',title:'Close this window',text:'×',onclick:e=>{e.stopPropagation();tear.cols=tear.cols.filter(q=>q!==c);tearSave();tearRender();}}));
  head.addEventListener('pointerdown',e=>{if(e.target.closest('button')||e.button!==0)return;e.preventDefault();const x0=e.clientX-c.x,y0=e.clientY-c.y;head.setPointerCapture(e.pointerId);
    const mv=ev=>{c.x=clamp(ev.clientX-x0,-150,window.innerWidth-60);c.y=clamp(ev.clientY-y0,0,window.innerHeight-30);col.style.left=c.x+'px';col.style.top=c.y+'px';};
    const up=()=>{head.removeEventListener('pointermove',mv);head.removeEventListener('pointerup',up);head.removeEventListener('pointercancel',up);tearSave();};head.addEventListener('pointermove',mv);head.addEventListener('pointerup',up);head.addEventListener('pointercancel',up);});
  col.append(head);
  for(const s of c.secs){const sec=el('div',{class:'tearsec','data-m':s.m}),grip=el('span',{class:'tgrip',title:'Drag onto another window to fuse them, or out to make a window of its own','aria-hidden':'true',text:'⠿'});
    const name=el('button',{class:'tname','aria-expanded':String(s.open),text:(s.open?'▾ ':'▸ ')+s.m,onclick:()=>{s.open=!s.open;tearSave();tearRender();}}),
      x=el('button',{class:'tx','aria-label':'Close '+s.m,title:'Close this menu',text:'×',onclick:()=>{c.secs=c.secs.filter(q=>q!==s);tearClean();tearSave();tearRender();}});
    grip.addEventListener('pointerdown',e=>tearGripDown(e,c,s,grip));sec.append(el('div',{class:'tearsec-h'},grip,name,x));
    if(s.open){const body=el('div',{class:'tearbody',role:'menu'},...menuList(MENUS[s.m],s.m));
      body.addEventListener('click',()=>setTimeout(tearRefresh,60));sec.append(body);}
    col.append(sec);}
  return col;}
/* the menus' states (ticks, what fits the tab you are in) are drawn again after a click or a tab change */
function tearRefresh(){if(tear.drag||!tear.cols.length)return;if(document.activeElement&&tearHost().contains(document.activeElement)&&document.activeElement.tagName==='INPUT')return;tearRender();}
function tearGripDown(e,c,s,grip){if(e.button!==0)return;e.preventDefault();e.stopPropagation();const d=tear.drag={c,s,on:false,x:e.clientX,y:e.clientY,ghost:null};grip.setPointerCapture(e.pointerId);
  const over=(x,y)=>{const hits=document.elementsFromPoint(x,y);const h=hits.find(n=>n.classList&&n.classList.contains('tearcol')&&n.dataset.col);return h?tear.cols.find(q=>q.id===h.dataset.col):null;};
  const mv=ev=>{if(!d.on){if(Math.hypot(ev.clientX-d.x,ev.clientY-d.y)<6)return;d.on=true;d.ghost=el('div',{class:'tearghost',text:s.m});document.body.append(d.ghost);}
    d.ghost.style.left=(ev.clientX+12)+'px';d.ghost.style.top=(ev.clientY+8)+'px';const t=over(ev.clientX,ev.clientY);for(const n of tearHost().querySelectorAll('.tearcol'))n.classList.toggle('drop',!!t&&n.dataset.col===t.id&&t!==c);};
  const up=ev=>{grip.removeEventListener('pointermove',mv);grip.removeEventListener('pointerup',up);grip.removeEventListener('pointercancel',up);if(d.ghost)d.ghost.remove();tear.drag=null;
    if(d.on){const t=over(ev.clientX,ev.clientY);
      if(t&&t!==c){c.secs=c.secs.filter(q=>q!==s);const rows=[...tearHost().querySelectorAll('[data-col="'+t.id+'"] .tearsec')];let at=t.secs.length;for(let i=0;i<rows.length;i++){const r=rows[i].getBoundingClientRect();if(ev.clientY<r.top+r.height/2){at=i;break;}}t.secs.splice(at,0,s);}
      else if(!t){if(c.secs.length>1||true){c.secs=c.secs.filter(q=>q!==s);tear.cols.push({id:'c'+(Date.now()%1e7)+Math.floor(Math.random()*99),x:clamp(ev.clientX-30,4,window.innerWidth-240),y:clamp(ev.clientY-14,4,window.innerHeight-80),secs:[s]});}}
      tearClean();tearSave();}
    tearRender();};
  grip.addEventListener('pointermove',mv);grip.addEventListener('pointerup',up);grip.addEventListener('pointercancel',up);}
/* the "tear off" row at the top of every menu */
{const om=openMenu;openMenu=function(name){om.apply(this,arguments);if(!MENUS[name])return;const r=menuBtns[name].getBoundingClientRect();
  pop.prepend(el('button',{class:'tearoff',title:'Tear off: keep this menu open in a window you can move, and fuse with other menus','aria-label':'Tear off the '+name+' menu',text:'· · · · · · · · · · · ·',onclick:()=>{closeMenu();tearAdd(name,r.left,r.bottom+6);}}));};}
{const sm=setMode;setMode=function(){const r=sm.apply(this,arguments);setTimeout(tearRefresh,120);return r;};}
actions.tearClear=()=>{tear.cols=[];tearSave();tearRender();};MENUS.Window.push(['Close all torn-off menus','tearClear']);
/* drawn once everything has loaded (the menus use things defined later) */
if(tear.cols.length)setTimeout(()=>{try{tearRender();}catch(e){console.warn('torn-off menus',e);}},0);
window.addEventListener('resize',()=>{let ch=false;for(const c of tear.cols){const x=clamp(c.x,-150,window.innerWidth-60),y=clamp(c.y,0,window.innerHeight-30);if(x!==c.x||y!==c.y){c.x=x;c.y=y;ch=true;}}if(ch){tearSave();tearRender();}});
