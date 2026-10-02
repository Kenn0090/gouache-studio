/* Corner arrows and press-and-hold menus use the same setTool path as a normal click,
   so each painting tool keeps its own tip and settings. No work runs while painting. */
const TOOL_MENU_LABELS={heal:'Healing brush','heal:spot':'Spot healing brush','heal:source':'Healing brush (source)',dodge:'Dodge',burn:'Burn',gradient:'Gradient',bucket:'Paint bucket',gbucket:'Gradient bucket'};
const TOOL_MENU_GROUPS={heal:{name:'Healing brushes',tools:['heal:spot','heal:source']},dodge:{name:'Dodge / Burn',tools:['dodge','burn']},gradient:{name:'Fill tools',tools:['gradient','bucket','gbucket']}};
const toolMenuState={owner:null,press:null,block:null,icons:{}};
function toolMenuTools(b){const g=TOOL_MENU_GROUPS[b.dataset.group||b.dataset.tool];return g&&g.tools.length>1?g.tools:null;}
function toolMenuDecorate(b){if(!toolMenuTools(b)){if(b.classList.contains('has-tool-menu')){b.classList.remove('has-tool-menu');b.querySelector('.tool-arrow')?.remove();for(const a of ['aria-haspopup','aria-controls','aria-expanded'])b.removeAttribute(a);}return;}
  b.classList.add('has-tool-menu');b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-controls','menuPop');b.setAttribute('aria-expanded',String(toolMenuState.owner===b));
  if(!b.querySelector('.tool-arrow'))b.append(el('span',{class:'tool-arrow','aria-hidden':'true'}));
  const label=TOOL_MENU_LABELS[b.dataset.tool],key=kbKeyOf('tool:'+b.dataset.tool);
  b.setAttribute('aria-label',label);b.title=label+(key?' ('+key+')':'')+' — click the arrow or hold the left mouse button for more tools';}
function toolMenuClosed(){if(toolMenuState.owner)toolMenuState.owner.setAttribute('aria-expanded','false');toolMenuState.owner=null;pop.classList.remove('tool-menu');pop.removeAttribute('aria-label');}
function toolMenuCancelPress(){const p=toolMenuState.press;if(p)clearTimeout(p.timer);toolMenuState.press=null;}
function toolMenuOpen(b,keyboard){const tools=toolMenuTools(b);if(!tools)return;
  closeMenu();toolMenuState.owner=b;openName=':tools';b.setAttribute('aria-expanded','true');pop.classList.add('tool-menu');pop.setAttribute('aria-label',TOOL_MENU_GROUPS[b.dataset.group||b.dataset.tool].name);
  pop.replaceChildren(...tools.map(t=>{const [tool,mode]=t.split(':'),key=!mode||heal.mode===mode?kbKeyOf('tool:'+tool):'',icon=el('span',{class:'tool-menu-icon','aria-hidden':'true'});icon.innerHTML=toolMenuState.icons[tool]||'';
    return el('button',{class:'mi tool-menu-item',role:'menuitemradio','aria-checked':String(ui.tool===tool&&(!mode||heal.mode===mode)),'data-tool-choice':t,onclick:()=>{closeMenu();if(mode){heal.mode=mode;healSave();}setTool(tool);if(mode)healMarker();b.focus();}},icon,el('span',{text:TOOL_MENU_LABELS[t]}),key?el('kbd',{text:key}):el('span'));}));
  pop.hidden=false;const r=b.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;
  pop.style.left=Math.max(4,Math.min(r.right+4+w<=innerWidth-4?r.right+4:r.left-w-4,innerWidth-w-4))+'px';pop.style.top=Math.max(4,Math.min(r.top,innerHeight-h-4))+'px';
  if(keyboard)(pop.querySelector('[aria-checked="true"]:not([disabled])')||pop.querySelector('button:not([disabled])'))?.focus();}
(function initToolMenus(){const bar=$('#tools');
  for(const b of bar.querySelectorAll('.tool')){const t=b.dataset.tool,svg=b.querySelector('svg');if(svg)toolMenuState.icons[t]=svg.outerHTML;toolMenuDecorate(b);}
  for(const [t,icon] of Object.entries(window.__groupIcons||{}))toolMenuState.icons[t]='<svg viewBox="0 0 24 24">'+icon+'</svg>';
  bar.addEventListener('pointerdown',e=>{const b=e.target.closest('.has-tool-menu');if(!b||e.button!==0)return;
    toolMenuCancelPress();toolMenuState.block=null;const p={b,id:e.pointerId,x:e.clientX,y:e.clientY,opened:false};toolMenuState.press=p;
    if(e.target.closest('.tool-arrow')){e.preventDefault();e.stopImmediatePropagation();p.opened=true;toolMenuOpen(b,false);}
    else p.timer=setTimeout(()=>{if(toolMenuState.press===p&&b.isConnected&&b.getClientRects().length){p.opened=true;toolMenuOpen(b,false);}},350);
  },true);
  window.addEventListener('pointermove',e=>{const p=toolMenuState.press;if(!p||p.id!==e.pointerId||p.opened)return;
    if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>8||!p.b.contains(document.elementFromPoint(e.clientX,e.clientY)))toolMenuCancelPress();
  },true);
  window.addEventListener('pointerup',e=>{const p=toolMenuState.press;if(!p||p.id!==e.pointerId)return;toolMenuCancelPress();if(!p.opened)return;
    toolMenuState.block={b:p.b,until:performance.now()+400};e.preventDefault();e.stopImmediatePropagation();
    const item=e.target.closest('.tool-menu-item');if(item&&pop.contains(item))item.click();
  },true);
  window.addEventListener('pointercancel',toolMenuCancelPress,true);
  window.addEventListener('blur',()=>{toolMenuCancelPress();toolMenuState.block=null;if(toolMenuState.owner)closeMenu();});
  bar.addEventListener('click',e=>{const b=e.target.closest('.has-tool-menu');if(!b)return;const block=toolMenuState.block;toolMenuState.block=null;
    if(block&&block.b===b&&e.detail&&performance.now()<block.until){e.preventDefault();e.stopImmediatePropagation();return;}
    if(e.target.closest('.tool-arrow')){e.preventDefault();e.stopImmediatePropagation();toolMenuOpen(b,true);}
  },true);
  window.addEventListener('keydown',e=>{const b=e.target.closest?.('.has-tool-menu');
    if(!toolMenuState.owner){if(b&&(e.key==='ArrowDown'||e.key==='ArrowRight')){e.preventDefault();e.stopImmediatePropagation();toolMenuCancelPress();toolMenuOpen(b,true);}else if(e.key==='Escape')toolMenuCancelPress();return;}
    e.stopImmediatePropagation();const owner=toolMenuState.owner,items=[...pop.querySelectorAll('.tool-menu-item:not([disabled])')],i=items.indexOf(document.activeElement);
    if(['Escape','ArrowLeft','Tab'].includes(e.key)){closeMenu();owner.focus();if(e.key!=='Tab')e.preventDefault();return;}
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?items.length-1:e.key==='ArrowDown'?(i+1)%items.length:i<0?items.length-1:(i-1+items.length)%items.length;items[next].focus();}
    if(e.key==='Enter'||e.key===' '){e.preventDefault();(items[i]||items[0]).click();}
  },true);
})();
