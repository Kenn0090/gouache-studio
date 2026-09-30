/* ---- (0.39, Kenn) First-launch screen: Look (Classic / Modern), Level (Beginner / Full), Start in ----
   Classic = square corners, compact (the Photoshop feel); Modern = rounded and roomy. Beginner hides the less-used
   tools and panels and shows a small Getting started card; Full shows everything. All three can be changed later in
   Preferences, and File › Launch screen… shows this again. Nobody who already uses the app is switched to Beginner. */
const BEGINNER_TOOLS=['move','brush','erase','gradient','marquee','picker','hand'];
const BEGINNER_HIDE_PANELS=['chan','hist','maps','p3bake','shading','textures','decals','envs'];
const isBeginner=()=>prefs.level==='beginner';
function applyLevel(){document.body.classList.toggle('lv-beginner',isBeginner());if(typeof dkRender==='function'){try{dkRender();}catch(e){}}gsRefresh();}
const GS_TIPS={paint:['Paint with the brush (B). Size and opacity are in the bar above the canvas.','Layers are on the right. Add one with the + button before you paint something new.','Use Ctrl+Z to undo and Ctrl+S to save.'],
  p3d:['Import a model from the File menu, then paint on it with the brush.','Drag a material from the shelf below onto the model to add it as a layer.','Use the 3D · Split · 2D · UV switch at the lower right to change the view.'],
  anim:['Add frames, then press Space to play them.'],bake:['Load a low-poly model and a high-poly model, then press Bake.'],convert:['Open a photo, then make normal, height and other maps from it.'],brush:['Draw a shape here and turn it into a brush tip.']};
let gsLastMode=null;
function gsRefresh(){let c=document.getElementById('gsCard');const show=isBeginner()&&!prefs.gsHide&&ui.mode&&GS_TIPS[ui.mode];
  if(!show){if(c)c.remove();return;}
  const w=document.getElementById('work');if(!w)return;
  if(c&&c.dataset.mode===ui.mode)return;if(c)c.remove();
  c=el('div',{id:'gsCard',class:'gscard',role:'note','data-mode':ui.mode},el('b',{text:'Getting started'}),el('ul',{},...GS_TIPS[ui.mode].map(t=>el('li',{text:t}))),
    el('div',{class:'chips'},el('button',{class:'btn sm',id:'gsFull',text:'Show everything',title:'Switch to the Full level',onclick:()=>{prefs.level='full';savePrefs();applyLevel();}}),
      el('button',{class:'btn sm',id:'gsHide',text:'Hide this',onclick:()=>{prefs.gsHide=true;savePrefs();gsRefresh();}})));
  w.append(c);}
setInterval(()=>{if(ui.mode!==gsLastMode){gsLastMode=ui.mode;gsRefresh();}},400);
function closeSetup(){const w=document.getElementById('setup');if(w)w.remove();document.removeEventListener('keydown',setupKey,true);}
function setupKey(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeSetup();}}
function showSetup(first){closeSetup();
  let look=(prefs.uiShape==='sharp')?'classic':'modern',level=prefs.level||(first&&!gsHadPrefs?'beginner':'full'),start=prefs.startMode||'paint';
  const choice=(label,sub,items,get,set,id)=>{const box=el('div',{class:'wmodes',role:'group','aria-label':label,id});const draw=()=>box.replaceChildren(...items.map(([k,n,t])=>el('button',{class:'wmode'+(get()===k?' on':''),id:id+'_'+k,'aria-pressed':String(get()===k),title:t,onclick:()=>{set(k);draw();}},el('span',{class:'wmn',text:n}),el('small',{text:t}))));draw();
    return el('div',{},el('div',{class:'sub',text:label}),el('p',{class:'note',text:sub}),box);};
  const done=()=>{prefs.uiShape=look==='classic'?'sharp':'round';prefs.level=level;prefs.setupDone=true;if(start==='paint')delete prefs.startMode;else prefs.startMode=start;savePrefs();applyUiShape();applyLevel();closeSetup();
    if(ui.mode!==start&&WELCOME_MODES.some(x=>x[0]===start))setMode(start);if(first&&welcomeOn())setTimeout(showWelcome,50);};
  const card=el('div',{class:'wcard',role:'dialog','aria-modal':'true','aria-label':'Set up Gouache Studio'},
    el('div',{class:'whead'},el('i',{class:'spdab'}),el('div',{},el('div',{class:'wname'},'Gouache ',el('small',{text:'Studio'})),el('div',{class:'dim',text:'Version '+APP_VERSION+' · set it up your way'}))),
    choice('Look','Change it any time in Preferences.',[['classic','Classic','Square corners and a compact layout'],['modern','Modern','Rounded corners and more room']],()=>look,v=>{look=v;applyUiShape(v==='classic'?'sharp':'round');},'suLook'),
    choice('Level','Beginner shows the tools and panels most people need, with a short Getting started card.',[['beginner','Beginner','The main tools and panels'],['full','Full','Everything']],()=>level,v=>{level=v;},'suLevel'),
    choice('Start in','Where the app opens.',WELCOME_MODES.map(([m,l,t])=>[m,l,t]),()=>start,v=>{start=v;},'suStart'),
    el('div',{class:'wfoot'},el('button',{class:'btn primary',id:'suGo',text:first?'Start':'Save',onclick:done}),el('span',{class:'dim',text:'File › Launch screen… shows this again.'})));
  const w=el('div',{id:'setup',class:'welcome'},card);document.body.append(w);document.addEventListener('keydown',setupKey,true);}
Object.assign(actions,{setup:()=>showSetup(false)});
