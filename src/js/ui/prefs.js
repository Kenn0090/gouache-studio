/* ================= Preferences =================
   Stored on this computer (per user). Edit › Preferences (Ctrl+K). */
const prefs=Object.assign({livePreview:true},(()=>{try{return JSON.parse(localStorage.getItem('gs.prefs')||'{}');}catch(e){return {};}})());
/* Engine quality (0.28, Kenn: for lower-end PCs). High is how the app always ran. */
const QUALITY={low:{dpr:1,msaa:0,aniso:1,tris:5e5,refresh:400,rt:128},medium:{dpr:1.5,msaa:2,aniso:4,tris:1e6,refresh:250,rt:256},
  high:{dpr:2,msaa:4,aniso:8,tris:2e6,refresh:150,rt:512},ultra:{dpr:3,msaa:8,aniso:16,tris:4e6,refresh:80,rt:1024}};
const qual=k=>(QUALITY[prefs.quality]||QUALITY.high)[k];
function qualityChanged(){savePrefs();if(typeof resizeGL==='function')resizeGL();if(typeof v3!=='undefined'){v3.mapsDirty=true;v3.dirty=true;if(v3.on&&v3s().detail)v3LoadModel(true);}requestRender(true);}
function savePrefs(){try{localStorage.setItem('gs.prefs',JSON.stringify(prefs));}catch(e){}}
/* the Preview checkbox every image-changing dialog carries; starts from the global setting */
function previewChk(id,on,onChange){return chk(id,'Preview',on,onChange);}
function dlgPrefs(){let meshAuto=!!prefs.meshAuto,live=prefs.livePreview,hints=!prefs.hideHints,tipCur=prefs.tipCursor!==false,altPk=prefs.altPick!==false,maxB=prefs.maxBrush||5000,qk=QUALITY[prefs.quality]?prefs.quality:'high',small=prefs.smallFiles!==false,ps=PAINT_GAP[prefs.paintSpeed]?prefs.paintSpeed:'best',half=String(paintScale());const th=themeSection(),ms=memSection(),asb=autosavePrefsBox();
  const body=el('div',{class:'dlg-grid'},
    el('div',{class:'sub',text:'Theme'}),th.el,
    el('div',{class:'sub',text:'Screen'}),
    chk('pHints','Show shortcut hints on the canvas',hints,v=>{hints=v;}),
    chk('pAltPick','Alt picks a colour (Alt+click on the canvas, Alt over the model)',altPk,v=>{altPk=v;}),
    chk('pTipCur','Show the brush tip’s shape as the cursor',tipCur,v=>{tipCur=v;}),
    el('div',{class:'sub',text:'Largest brush size'}),seg([[5000,'5000 px'],[10000,'10000 px'],[20000,'20000 px']],maxB,v=>{maxB=+v;},'Largest brush size'),
    el('p',{class:'note',text:'Very big brushes paint slowly on large documents.'}),
    el('button',{class:'btn sm',text:'Keyboard shortcuts…',onclick:()=>{th.save();savePrefs();dlgKeys();}}),
    el('div',{class:'sub',text:'Painting speed'}),seg([['best','Best'],['balanced','Balanced'],['fast','Fast']],ps,v=>{ps=v;},'Painting speed'),
    el('div',{class:'sub',text:'Model while painting'}),seg([['1','Full size'],['0.75','Three quarters'],['0.5','Half size']],half,v=>{half=v;},'Model while painting'),
    el('p',{class:'note',text:'Draws the 3D model smaller and without smoothing while you paint, then sharp again when you lift the brush. Three quarters is a middle step; half is fastest. Good for integrated graphics.'}),
    el('p',{class:'note',text:'For slower computers and big documents. Balanced and Fast redraw the picture less often while you drag the brush. The paint you put down is exactly the same; the screen just updates a little less smoothly. It is saved on this computer only.'}),
    el('div',{class:'sub',text:'Engine quality'}),seg([['low','Low'],['medium','Medium'],['high','High'],['ultra','Ultra']],qk,v=>{qk=v;},'Engine quality'),
    el('p',{class:'note',text:'Lower settings help slower computers: the canvas and 3D view draw fewer pixels, the model’s edges and textures are less smooth, Detail makes fewer triangles, the 3D view catches up less often while you paint, and the ray-traced view stops sooner. High is the normal setting; Ultra is for fast graphics cards and sharp screens.'}),
    el('div',{class:'sub',text:'Live previews'}),
    chk('pLive','Show changes live while adjusting',live,v=>{live=v;}),
    el('p',{class:'note',text:'When on, filters, adjustments, Select menu changes and hover previews (blend modes, fonts) show on the canvas as you adjust them. Each dialog also has its own Preview checkbox. Turn this off for very large documents or slower machines.'}),
    el('div',{class:'sub',text:'Files'}),chk('prSmall','Smaller files (on by default)',small,v=>{small=v;}),
    el('p',{class:'note',text:'Every picture in documents, projects, autosaves and materials is packed without losing anything. With Smaller files on, colour and grey maps are also kept as high-quality WebP when that is smaller (a much smaller file; changes are too small to see). Normal maps, Height, masks and baked maps always stay exact.'}),
    el('div',{class:'sub',text:'Autosave and backups'}),asb.el,
    el('div',{class:'sub',text:'Models'}),chk('prMeshAuto','When a model file is saved again elsewhere, update it and bake again without asking',!!prefs.meshAuto,v=>{meshAuto=v;}),
    el('p',{class:'note',text:platform.isDesktop?'The high-poly is never updated without asking. Only models opened with Import model or Load… are followed.':'This works in the desktop app only: a browser can’t watch files on your computer.'}),
    el('div',{class:'sub',text:'Memory and disk'}),ms.el);
  openDialog({title:'Preferences',body,okLabel:'Save',onCancel(){th.cancel();},onOk(){const qOld=prefs.quality||'high';prefs.quality=qk==='high'?undefined:qk;if(qOld!==qk)qualityChanged();prefs.smallFiles=small?undefined:false;prefs.paintSpeed=ps==='best'?undefined:ps;prefs.paintScale=half==='1'?undefined:+half;delete prefs.paintHalf;prefs.meshAuto=meshAuto;prefs.livePreview=live;prefs.hideHints=!hints;prefs.tipCursor=tipCur;prefs.altPick=altPk?undefined:false;prefs.maxBrush=maxB===5000?0:maxB;if(typeof sizeSlider!=='undefined'&&sizeSlider)sizeSlider.set(brush.size);if(typeof buildOptBar==='function')buildOptBar();if(typeof refreshCursor==='function')refreshCursor();th.save();savePrefs();refreshHints();ms.save();asb.save();savePrefs();toast('Preferences saved.');}});}
