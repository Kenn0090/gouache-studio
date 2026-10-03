/* ================= Help menu (0.28) =================
   Kenn: a Help menu that points people to the guide (wiki) and shows what's new in each version. */
const HELP_REPO='https://github.com/Kenn0090/gouache-studio';
const HELP_GUIDE=HELP_REPO+'/blob/main/docs/wiki/Home.md';
function openLink(url){if(platform.isDesktop){platform.invoke('open_url',{url}).catch(e=>toast('Could not open the link: '+(e.message||e)));return;}window.open(url,'_blank','noopener');}
/* a little Markdown: headings, bullet points, bold, links */
function helpMd(md){const box=el('div',{class:'helpmd'});let list=null;
  const inline=t=>{const s=el('span');const re=/\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;let i=0,m;
    while((m=re.exec(t))){if(m.index>i)s.append(t.slice(i,m.index));if(m[1])s.append(el('b',{text:m[1]}));else{const u=m[3];s.append(el('a',{href:'#',text:m[2],onclick:ev=>{ev.preventDefault();openLink(/^https?:/.test(u)?u:HELP_REPO+'/blob/main/docs/wiki/'+u);}}));}i=re.lastIndex;}
    if(i<t.length)s.append(t.slice(i));return s;};
  for(const raw of String(md).split('\n')){const l=raw.trimEnd();
    if(/^#\s/.test(l)){list=null;continue;}
    if(/^##\s/.test(l)){list=null;box.append(el('h3',{text:l.replace(/^##\s+/,'')}));continue;}
    if(/^\s*-\s/.test(l)){if(!list){list=el('ul');box.append(list);}list.append(el('li',{},inline(l.replace(/^\s*-\s+/,''))));continue;}
    if(!l.trim()){list=null;continue;}
    list=null;box.append(el('p',{},inline(l)));}
  return box;}
function dlgWhatsNew(){const body=el('div',{class:'dlg-grid helpnew'},el('p',{class:'note',text:'You are using version '+APP_VERSION+'.'}),helpMd(CHANGELOG_MD||'No change log in this build.'));
  openDialog({title:'What’s new',body,okLabel:null,cancelLabel:'Close'});}
function dlgAbout(){const link=(t,u)=>el('button',{class:'btn sm',text:t,onclick:()=>openLink(u)});
  openDialog({title:'About Gouache Studio',body:el('div',{class:'dlg-grid'},
    el('p',{},el('b',{text:'Gouache Studio '+APP_VERSION})),
    el('p',{class:'note',text:'A GPU painting and texture app for hand-painted and PBR game art: painting, PBR maps, 3D Paint, baking and map conversion. Open source.'}),
    el('p',{class:'note',text:(platform.isDesktop?'Desktop app, updates itself.':'Browser version.')+' The HDRIs are by Poly Haven artists (CC0): see the guide’s 3D view page.'}),
    el('div',{class:'chips'},link('User guide',HELP_GUIDE),link('What’s new',HELP_REPO+'/releases'),link('Source code',HELP_REPO))),okLabel:null,cancelLabel:'Close'});}
MENUS.Help.push(['User guide (online)','helpGuide','F1'],['What’s new…','whatsNew'],['Keyboard shortcuts…','keys'],'-',['Report a problem or ask for a feature','helpIssue'],['Welcome screen and examples…','welcome'],'-',['About Gouache Studio','about']);
Object.assign(actions,{helpGuide:()=>openLink(HELP_GUIDE),whatsNew:dlgWhatsNew,helpIssue:()=>openLink(HELP_REPO+'/issues/new'),about:dlgAbout});
/* Search the same commands and current shortcuts shown by the menus and shortcut editor. */
function helpCommandText(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function helpCommandNear(a,b){if(Math.abs(a.length-b.length)>1)return false;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const row=[i+1];for(let j=0;j<b.length;j++)row[j+1]=Math.min(row[j]+1,prev[j+1]+1,prev[j]+(a[i]===b[j]?0:1));prev=row;}return prev[b.length]<=1;}
function dlgCommandSearch(){let hits=[],chosen=0;const search=el('input',{id:'helpCommandQuery',type:'search',placeholder:'Search tools, filters and menu commands…','aria-label':'Search commands','aria-controls':'helpCommandResults'}),list=el('div',{id:'helpCommandResults',class:'commandresults',role:'listbox','aria-label':'Matching commands'}),status=el('p',{class:'note',role:'status'});
  const run=c=>{if(!c)return;closeDialog();if(xf&&!xf.move&&!['freeTransform','xfWarp'].includes(c[0]))xfCommit();if(ui.mode==='anim'&&LAYER_ONLY.includes(c[0])){toast('Switch to Paint mode for layers.');return;}c[4]();};
  const draw=()=>{list.replaceChildren(...hits.map((c,i)=>el('button',{class:'commandresult'+(i===chosen?' on':''),id:'helpCmd_'+i,role:'option','aria-selected':String(i===chosen),onclick:()=>run(c)},el('span',{},el('b',{text:c[1]}),el('small',{text:c[2]})),el('kbd',{text:kbKeyOf(c[0])||''}))));if(hits.length){search.setAttribute('aria-activedescendant','helpCmd_'+chosen);list.children[chosen]?.scrollIntoView({block:'nearest'});}else search.removeAttribute('aria-activedescendant');};
  const update=()=>{const q=helpCommandText(search.value),tokens=q.split(' ').filter(Boolean);hits=kbCommands().filter(c=>{const name=helpCommandText(c[1]),text=name+' '+helpCommandText(c[2]);return !q||tokens.every(t=>text.includes(t))||(q.length>=4&&!q.includes(' ')&&name.split(' ').some(w=>helpCommandNear(q,w)));}).sort((a,b)=>a[1].localeCompare(b[1])).slice(0,50);chosen=0;status.textContent=hits.length?'Choose a command, or use ↑ / ↓ and Enter.': 'No matching commands.';draw();};
  search.addEventListener('input',update);search.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(hits.length)chosen=(chosen+(e.key==='ArrowDown'?1:-1)+hits.length)%hits.length;draw();}else if(e.key==='Enter'){e.preventDefault();run(hits[chosen]);}});
  openDialog({title:'Search commands',okLabel:null,cancelLabel:'Close',body:el('div',{class:'dlg-grid'},search,status,list)});update();search.focus();}
actions.searchCommands=dlgCommandSearch;MENUS.Help.unshift(['Search commands…','searchCommands','Ctrl+Shift+P'],'-');
/* F1 opens the guide */
window.addEventListener('keydown',e=>{if(e.key==='F1'&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();actions.helpGuide();}});
