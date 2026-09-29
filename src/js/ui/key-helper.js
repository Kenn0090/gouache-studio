/* ================= Shortcut helper (0.26.1) =================
   Hold Ctrl, Alt or Shift (on its own) for half a second and a card shows every shortcut that starts with it
   (with your own keys from Edit › Keyboard shortcuts). Pressing another key, clicking or moving the pointer hides it,
   so holding Alt to pick a colour or turn the 3D view doesn't bring it up. View › Shortcut helper turns it off. */
const KH_EXTRA=[['Alt+click','Pick a colour'],['Alt+Del','Fill with the foreground colour'],['Alt+drag','Turn the 3D view'],['Ctrl+drag','Move a guide'],['Ctrl+;','Show or hide guides'],['Alt+Ctrl+;','Lock guides'],
  ['Shift+drag','Straight line / keep proportions'],['Shift+click','Add to a selection or select several layers'],['Ctrl+click','Select several layers'],['Shift+T','Tile mode'],['Shift+X','Symmetry left–right'],['Shift+C','Previous baked map (Bake tab)'],['Ctrl+Shift+R','Reload the app']];
const kh={timer:0,card:null,mods:'',x:0,y:0};
function khOn(){return prefs.keyHelper!==false;}
function khPrefix(e){return (e.ctrlKey||e.metaKey?'Ctrl+':'')+(e.shiftKey?'Shift+':'')+(e.altKey?'Alt+':'');}
function khList(pre){const out=[],seen=new Set(),norm=k=>k.replace(/^Alt\+Ctrl\+/,'Ctrl+Alt+');
  for(const c of kbCommands()){const k=kbKeyOf(c[0]);if(!k)continue;const n=norm(k);if(!n.startsWith(pre))continue;const rest=n.slice(pre.length);if(/^(Ctrl|Shift|Alt)\+/.test(rest))continue;if(seen.has(n))continue;seen.add(n);out.push([rest,c[1]]);}
  for(const [k,t] of KH_EXTRA){const n=norm(k);if(n.startsWith(pre)&&!/^(Ctrl|Shift|Alt)\+/.test(n.slice(pre.length))&&!seen.has(n)){seen.add(n);out.push([n.slice(pre.length),t]);}}
  return out.sort((a,b)=>(a[0].length-b[0].length)||a[0].localeCompare(b[0]));}
function khHide(){clearTimeout(kh.timer);kh.timer=0;if(kh.card){kh.card.remove();kh.card=null;}}
function khShow(pre){khHide();const list=khList(pre);if(!list.length)return;
  kh.card=el('div',{class:'khcard',role:'status','aria-live':'polite'},el('div',{class:'khh'},el('b',{text:pre.replace(/\+$/,'')}),el('span',{text:' + …'})),
    el('div',{class:'khgrid'},...list.flatMap(([k,t])=>[el('kbd',{text:k}),el('span',{text:t})])));
  document.body.append(kh.card);}
window.addEventListener('keydown',e=>{const mod=['Control','Shift','Alt','Meta'].includes(e.key);
  if(!mod){khHide();return;}if(!khOn()||e.repeat&&kh.card)return;if(isTypingTarget(e.target)||!modal.hidden||(typeof stroke!=='undefined'&&stroke)||(typeof ptr!=='undefined'&&ptr))return;
  const pre=khPrefix(e);if(kh.card&&kh.mods===pre)return;khHide();kh.mods=pre;kh.timer=setTimeout(()=>{kh.timer=0;khShow(pre);},500);},true);
window.addEventListener('keyup',e=>{if(!['Control','Shift','Alt','Meta'].includes(e.key))return;const pre=khPrefix(e);khHide();
  /* still holding another modifier: show its card again after the pause */
  if(pre&&khOn()){kh.mods=pre;kh.timer=setTimeout(()=>{kh.timer=0;khShow(pre);},500);}},true);
window.addEventListener('pointerdown',khHide,true);window.addEventListener('blur',khHide);window.addEventListener('wheel',khHide,{capture:true,passive:true});
window.addEventListener('pointermove',e=>{if(!kh.timer&&!kh.card){kh.x=e.clientX;kh.y=e.clientY;return;}if(Math.hypot(e.clientX-kh.x,e.clientY-kh.y)>6)khHide();},true);
MENUS.View.push(['Shortcut helper (hold Ctrl, Alt or Shift)','keyHelper']);
actions.keyHelper=()=>{prefs.keyHelper=!khOn();if(typeof savePrefs==='function')savePrefs();toast(khOn()?'Shortcut helper on: hold Ctrl, Alt or Shift to see its shortcuts.':'Shortcut helper off.');};
checked.keyHelper=()=>khOn();
