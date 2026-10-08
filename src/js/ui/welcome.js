/* ================= Splash and welcome screen (0.25) =================
   The splash (logo, version, a moving bar) shows while the app loads, then the welcome screen: New document,
   Open, a new 3D Paint project, recent files (desktop), examples (the cobblestone tile used to open at start-up),
   and any autosaved work to recover. "Show at start-up" can be turned off; File › Welcome screen brings it back. */
const EXAMPLES=[
  {id:'cobble',name:'Cobblestone tile',kind:'Paint',text:'A hand-painted, tiling stone texture in layers and groups.',icon:'▦',async run(){if(!(await askReplace()))return;buildSample();fit();}},
  {id:'p3metal',name:'Smart materials on a cube',kind:'3D Paint',text:'Gun metal with dust in 3D Paint: open the folders to see the generated masks.',icon:'◈',async run(){if(ui.mode!=='p3d'&&!setMode('p3d',true))return;await tick();await new Promise(r=>setTimeout(r,300));
    for(const n of ['Gun Metal','Dust']){const rec=smBuiltins().find(r=>r.name.toLowerCase()===n.toLowerCase());if(rec)smApply(rec);}}}];
const welcomeOn=()=>!prefs.noWelcome;
/* where to start: each tab of the app (Kenn: choose the starting section right after the splash) */
const WELCOME_MODES=[['paint','2D Paint','Paint textures on a flat canvas; the 3D preview is optional','▨'],['p3d','3D Paint','Paint directly on a model with texture sets and materials','◈'],['anim','Animation','Flipbooks and sprite sheets','▶'],
  ['bake','Bake','Bake maps from a high-poly model','◎'],['convert','Convert','Normal, height, AO and more from a photo','◐'],['brush','Brush','Draw your own brush tips','✎']];
function welcomeGo(m,remember){if(remember){prefs.startMode=m;savePrefs();}closeWelcome();if(ui.mode!==m)setMode(m);}
function closeWelcome(){const w=document.getElementById('welcome');if(w)w.remove();document.removeEventListener('keydown',welcomeKey,true);}
function welcomeKey(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeWelcome();}}
async function showWelcome(){closeWelcome();
  const act=(label,sub,id,fn)=>el('button',{class:'wact',id,onclick:()=>{closeWelcome();fn();}},el('b',{text:label}),el('span',{text:sub}));
  const recentBox=el('div',{class:'wlist',id:'wRecent'},el('p',{class:'note',text:platform.isDesktop?'Loading…':'In the browser, open files with Open… (recent files are listed in the desktop app).'}));
  const recover=el('div',{id:'wRecover'});
  const card=el('div',{class:'wcard',role:'dialog','aria-modal':'true','aria-label':'Welcome'},
    el('div',{class:'whead'},el('i',{class:'spdab'}),el('div',{},el('div',{class:'wname'},'Gouache ',el('small',{text:'Studio'})),el('div',{class:'dim',text:'Version '+APP_VERSION})),
      el('button',{class:'btn sm wclose',text:'×','aria-label':'Close the welcome screen',onclick:closeWelcome})),
    recover,
    el('div',{class:'sub',text:'Start in'}),el('div',{class:'wmodes',role:'group','aria-label':'Start in'},...WELCOME_MODES.map(([m,l,t,i])=>el('button',{class:'wmode'+(ui.mode===m?' on':''),id:'wMode_'+m,title:t,onclick:()=>welcomeGo(m,document.getElementById('wRemember')&&document.getElementById('wRemember').checked)},el('span',{class:'wmicon',text:i}),el('b',{text:l}),el('small',{text:t})))),
    el('div',{class:'wcols'},
      el('div',{class:'wcol'},el('div',{class:'sub',text:'Start'}),
        act('New document…','A blank canvas for painting and texture maps','wNew',()=>actions.new()),
        act('Open…','A .gouache, PSD, image or 3D Paint project','wOpen',()=>actions.open()),
        act('New 3D Paint project','Paint on a model with texture sets and materials','wP3',()=>setMode('p3d'))),
      el('div',{class:'wcol'},el('div',{class:'sub',text:'Recent'}),recentBox),
      el('div',{class:'wcol'},el('div',{class:'sub',text:'Examples'}),...EXAMPLES.map(x=>el('button',{class:'wex',id:'wEx_'+x.id,onclick:()=>{closeWelcome();x.run();}},
        el('span',{class:'wexicon',text:x.icon}),el('span',{},el('b',{text:x.name}),el('small',{text:x.kind+' · '+x.text})))))),
    el('div',{class:'wfoot'},chk('wShow','Show this at start-up',welcomeOn(),v=>{prefs.noWelcome=!v;savePrefs();}),chk('wRemember','Always start in the section I pick',!!prefs.startMode,v=>{if(!v){delete prefs.startMode;savePrefs();}}),el('span',{class:'dim',text:'File › Welcome screen opens it again.'})));
  const w=el('div',{id:'welcome',class:'welcome'},card);w.addEventListener('pointerdown',e=>{if(e.target===w)closeWelcome();});document.body.append(w);document.addEventListener('keydown',welcomeKey,true);
  /* autosaved work from a session that did not end saved */
  const rs=await asRecoveries();if(rs.length&&recover.isConnected)recover.replaceWith(el('div',{class:'wrecover',id:'wRecover'},el('b',{text:'Unsaved work was kept by autosave:'}),
    ...rs.map(r=>{const row=el('div',{class:'wrrow'},el('span',{text:(r.kind==='p3d'?'3D Paint · ':'Paint · ')+r.name+(r.t?' · '+agoText(r.t):'')}),
      el('button',{class:'btn sm',text:'Recover',onclick:()=>{closeWelcome();asRecover(r);}}),el('button',{class:'btn sm',text:'Discard',onclick:async()=>{await asDiscard(r);row.remove();}}));return row;})));
  if(platform.isDesktop){const list=await platform.recentDetails();if(!recentBox.isConnected)return;
    recentBox.replaceChildren(...(list.length?list.slice(0,8).map(r=>recentItem(r,()=>{closeWelcome();openRecent(r.path);})):[el('p',{class:'note',text:'Files you open or save appear here.'})]));}}
/* after loading: fade the splash out, then the welcome screen */
function bootDone(){const s=document.getElementById('splash');const go=()=>{if(s){s.classList.add('out');setTimeout(()=>s.remove(),400);}};
  const t0=window.__gsT0||0,wait=Math.max(0,700-(performance.now()-t0));setTimeout(go,wait);
  const test=/[?&]debug\b/.test(location.search);
  /* the section picked with "Always start in" */
  if(!test&&prefs.startMode&&prefs.startMode!=='paint'&&WELCOME_MODES.some(x=>x[0]===prefs.startMode))setTimeout(()=>{if(ui.mode==='paint')setMode(prefs.startMode);},wait+20);if(!test&&!prefs.setupDone){setTimeout(()=>showSetup(true),wait+50);return;}applyLevel();if(test?/[?&]welcome\b/.test(location.search):welcomeOn())setTimeout(showWelcome,wait+50);}
Object.assign(actions,{welcome:()=>showWelcome(),examples:()=>showWelcome()});
