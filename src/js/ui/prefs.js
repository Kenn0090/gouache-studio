/* ================= Preferences =================
   Stored on this computer (per user). Edit › Preferences (Ctrl+K). */
const gsHadPrefs=(()=>{try{return localStorage.getItem('gs.prefs')!==null;}catch(e){return false;}})();/* a returning user is not switched to Beginner */
const prefs=Object.assign({livePreview:true},(()=>{try{return JSON.parse(localStorage.getItem('gs.prefs')||'{}');}catch(e){return {};}})());
/* Engine quality (0.28, Kenn: for lower-end PCs). High is how the app always ran. */
const QUALITY={low:{dpr:1,msaa:0,aniso:1,tris:5e5,refresh:400,rt:128},medium:{dpr:1.5,msaa:2,aniso:4,tris:1e6,refresh:250,rt:256},
  high:{dpr:2,msaa:4,aniso:8,tris:2e6,refresh:150,rt:512},ultra:{dpr:3,msaa:8,aniso:16,tris:4e6,refresh:80,rt:1024}};
const qual=k=>(QUALITY[prefs.quality]||QUALITY.high)[k];
function qualityChanged(){savePrefs();if(typeof resizeGL==='function')resizeGL();if(typeof v3!=='undefined'){v3.mapsDirty=true;v3.dirty=true;if(v3.on&&v3s().detail)v3LoadModel(true);}requestRender(true);}
function savePrefs(){try{localStorage.setItem('gs.prefs',JSON.stringify(prefs));}catch(e){}}
/* the Preview checkbox every image-changing dialog carries; starts from the global setting */
function previewChk(id,on,onChange){return chk(id,'Preview',on,onChange);}
function dlgPrefs(startTab){
  /* (0.37.2, Kenn) tabs instead of one long window; every tab but Look can go back to its usual settings */
  const S={uiScale:+prefs.uiScale||1,level:prefs.level||'full',meshAuto:!!prefs.meshAuto,live:prefs.livePreview,hints:!prefs.hideHints,tipCur:prefs.tipCursor!==false,undoSet:!!prefs.undoSettings,altPk:prefs.altPick!==false,pCtl:prefs.painterControls!==false,penPan:prefs.penPan!==false,maxB:prefs.maxBrush||5000,qk:QUALITY[prefs.quality]?prefs.quality:'high',small:prefs.smallFiles!==false,sesSave:prefs.saveSession!==false,sesRest:prefs.restoreSession!==false,ps:PAINT_GAP[prefs.paintSpeed]?prefs.paintSpeed:'best',half:String(paintScale())};
  const D={meshAuto:false,live:true,hints:true,tipCur:true,undoSet:false,altPk:true,pCtl:true,penPan:true,maxB:5000,qk:'high',small:true,sesSave:true,sesRest:true,ps:'best',half:'1'};
  const th=themeSection(),ms=memSection(),asb=autosavePrefsBox();
  const TABS=[['look','Look'],['paint','Painting'],['speed','Speed'],['files','Files']],KEYS={paint:['hints','altPk','pCtl','penPan','tipCur','undoSet','maxB'],speed:['ps','half','qk','live'],files:['small','meshAuto','sesSave','sesRest']};
  let cur=TABS.some(t=>t[0]===startTab)?startTab:(()=>{try{const t=localStorage.getItem('gs.prefTab');return TABS.some(x=>x[0]===t)?t:'look';}catch(e){return 'look';}})();
  const holder=el('div',{class:'dlg-grid prefpanel'}),bar=el('div',{class:'seg preftabs',role:'tablist','aria-label':'Preferences'}),body=el('div',{class:'dlg-grid prefs'},bar,holder);
  const panels={
    look:()=>[el('div',{class:'sub',text:'Theme'}),th.el,el('div',{class:'sub',text:'Window scale'}),seg(UI_SCALES.map(v=>[v,Math.round(v*100)+'%']),UI_SCALES.reduce((a,v)=>Math.abs(v-S.uiScale)<Math.abs(a-S.uiScale)?v:a,1),v=>{S.uiScale=+v;},'Window scale'),el('p',{class:'note',text:platform.isDesktop?'Makes the whole window bigger or smaller. Also in View › Window scale.':'In a browser use the browser’s zoom (Ctrl and + or −).'}),el('div',{class:'sub',text:'Level'}),seg([['beginner','Beginner'],['full','Full']],S.level,v=>{S.level=v;},'Level'),el('p',{class:'note',text:'Beginner hides the less-used tools and panels and shows a Getting started card. Full shows everything.'}),el('button',{class:'btn sm',id:'pLaunch',text:'Launch screen…',onclick:()=>{th.cancel();closeDialog&&closeDialog();showSetup(false);}})],
    paint:()=>[chk('pHints','Show shortcut hints on the canvas',S.hints,v=>{S.hints=v;}),
      chk('pAltPick','Temporary colour picking (Alt+click in 2D; 3D hold key in Keyboard shortcuts)',S.altPk,v=>{S.altPk=v;}),
      chk('pPainterCtl','3D Paint: Substance Painter mouse controls on the model (Ctrl + right-drag: size and hardness; Ctrl + left-drag: flow and rotation)',S.pCtl,v=>{S.pCtl=v;}),
      chk('pPenPan','Pen and tablet: the pen’s side button moves the view (like the middle mouse button)',S.penPan,v=>{S.penPan=v;}),
      el('button',{class:'btn sm',id:'pPenTest',text:'Pen and tablet test…',onclick:()=>{th.cancel();closeDialog&&closeDialog();setTimeout(dlgPenTest,50);}}),
      chk('pTipCur','Show the brush tip’s shape as the cursor',S.tipCur,v=>{S.tipCur=v;}),
      chk('pUndoSet','Undo also covers settings (layers shown or hidden, locked, renamed, opacity and blend mode; symmetry; brush settings; colour)',S.undoSet,v=>{S.undoSet=v;}),
      el('div',{class:'sub',text:'Largest brush size'}),seg([[5000,'5000 px'],[10000,'10000 px'],[20000,'20000 px']],S.maxB,v=>{S.maxB=+v;},'Largest brush size'),
      el('p',{class:'note',text:'Very big brushes paint slowly on large documents.'}),
      el('button',{class:'btn sm',text:'Keyboard shortcuts…',onclick:()=>{th.save();savePrefs();dlgKeys();}})],
    speed:()=>[el('div',{class:'sub',text:'Painting speed'}),seg([['best','Best'],['balanced','Balanced'],['fast','Fast']],S.ps,v=>{S.ps=v;},'Painting speed'),
      el('p',{class:'note',text:'For slower computers and big documents. Balanced and Fast redraw the picture less often while you drag the brush. The paint you put down is exactly the same.'}),
      el('div',{class:'sub',text:'Model while painting'}),seg([['1','Full size'],['0.75','Three quarters'],['0.5','Half size']],S.half,v=>{S.half=v;},'Model while painting'),
      el('p',{class:'note',text:'Draws the 3D model smaller while you paint, then sharp again when you lift the brush. Good for integrated graphics.'}),
      el('div',{class:'sub',text:'Engine quality'}),seg([['low','Low'],['medium','Medium'],['high','High'],['ultra','Ultra']],S.qk,v=>{S.qk=v;},'Engine quality'),
      el('p',{class:'note',text:'Lower settings help slower computers: fewer pixels, fewer triangles, and less frequent catching up while you paint. High is the normal setting; Ultra is for fast graphics cards.'}),
      chk('pLive','Show changes live while adjusting',S.live,v=>{S.live=v;}),
      el('p',{class:'note',text:'Filters, adjustments and hover previews show on the canvas as you adjust them. Turn this off for very large documents.'}),
      el('div',{class:'sub',text:'Memory and disk'}),ms.el],
    files:()=>[chk('prSmall','Smaller files (on by default)',S.small,v=>{S.small=v;}),
      el('p',{class:'note',text:'Pictures are packed without losing anything. With Smaller files on, colour and grey maps are also kept as high-quality WebP when that is smaller. Normal maps, Height, masks and baked maps always stay exact.'}),
      el('div',{class:'sub',text:'Autosave and backups'}),asb.el,
      el('div',{class:'sub',text:'Session'}),chk('prSesSave','Keep my panel layout, zoom and tool in the file when I save',S.sesSave,v=>{S.sesSave=v;}),chk('prSesRest','Bring that layout back when I open a file that has one',S.sesRest,v=>{S.sesRest=v;}),
      el('div',{class:'sub',text:'Models'}),chk('prMeshAuto','When a model file is saved again elsewhere, update it and bake again without asking',S.meshAuto,v=>{S.meshAuto=v;}),
      el('p',{class:'note',text:platform.isDesktop?'The high-poly is never updated without asking. Only models opened with Import model or Load… are followed.':'This works in the desktop app only: a browser can’t watch files on your computer.'})]};
  const draw=()=>{bar.replaceChildren(...TABS.map(([k,l])=>el('button',{type:'button',role:'tab',class:'segb','aria-selected':String(k===cur),'aria-pressed':String(k===cur),id:'pTab_'+k,text:l,onclick:()=>{cur=k;try{localStorage.setItem('gs.prefTab',k);}catch(e){}draw();}})));
    holder.replaceChildren(...panels[cur](),...(KEYS[cur]?[el('div',{class:'chips prefreset'},el('button',{class:'btn sm',id:'pReset',text:'Reset this tab',title:'Put these settings back to how the app starts',onclick:()=>{for(const k of KEYS[cur])S[k]=D[k];draw();}}))]:[]));};
  draw();
  openDialog({title:'Preferences',body,okLabel:'Save',onCancel(){th.cancel();},onOk(){const qOld=prefs.quality||'high';prefs.quality=S.qk==='high'?undefined:S.qk;if(qOld!==S.qk)qualityChanged();prefs.smallFiles=S.small?undefined:false;prefs.paintSpeed=S.ps==='best'?undefined:S.ps;prefs.paintScale=S.half==='1'?undefined:+S.half;delete prefs.paintHalf;prefs.meshAuto=S.meshAuto;prefs.saveSession=S.sesSave?undefined:false;prefs.restoreSession=S.sesRest?undefined:false;if(S.level!==(prefs.level||'full')){prefs.level=S.level;applyLevel();}prefs.livePreview=S.live;prefs.hideHints=!S.hints;prefs.tipCursor=S.tipCur;prefs.undoSettings=S.undoSet||undefined;prefs.altPick=S.altPk?undefined:false;prefs.penPan=S.penPan?undefined:false;if(Math.abs(S.uiScale-(+prefs.uiScale||1))>.001)uiScaleSet(S.uiScale,true);prefs.painterControls=S.pCtl?undefined:false;prefs.maxBrush=S.maxB===5000?0:S.maxB;if(typeof sizeSlider!=='undefined'&&sizeSlider)sizeSlider.set(brush.size);if(typeof buildOptBar==='function')buildOptBar();if(typeof refreshCursor==='function')refreshCursor();th.save();savePrefs();refreshHints();ms.save();asb.save();savePrefs();toast('Preferences saved.');}});}
