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
/* F1 opens the guide */
window.addEventListener('keydown',e=>{if(e.key==='F1'&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();actions.helpGuide();}});
