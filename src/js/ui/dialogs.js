/* ================= Dialogs ================= */
const modal=$('#modal');let dlg=null;
/* Dialogs float over the work without darkening it, and move by their title bar (they always open in the centre of the screen),
   so what they change stays in view. o.dim keeps the old darkened, centred look (none use it now). */
const dlgPos={};const dlgKey=t=>String(t||'').split(':')[0].trim();
function dlgPlace(){const d=$('#modal .dialog'),p=dlgPos[dlgKey(dlg&&dlg.title)]||[0,0];d.style.transform=p[0]||p[1]?'translate('+p[0]+'px,'+p[1]+'px)':'';}
function openDialog(o){closeMenu();dlg=o;delete dlgPos[dlgKey(o.title)];const panel=$('#modal .dialog');panel.style.width=panel.style.height='';panel.classList.remove('kbwide');panel.classList.toggle('resizable',!!o.resizable);if(o.resizable)try{const s=JSON.parse(localStorage.getItem('gs.dialogSize.'+dlgKey(o.title))||'null');if(s){panel.style.width=Math.min(innerWidth*.94,Math.max(440,s[0]))+'px';panel.style.height=Math.min(innerHeight*.94,Math.max(360,s[1]))+'px';}}catch(e){}if(o.title==='Preferences')try{const s=JSON.parse(localStorage.getItem('gs.prefSize')||'null');if(s){panel.style.width=Math.min(innerWidth*.94,Math.max(360,s[0]))+'px';panel.style.height=Math.min(innerHeight*.94,Math.max(300,s[1]))+'px';}}catch(e){}$('#dlgTitle').textContent=o.title;$('#dlgBody').replaceChildren(o.body);modal.classList.toggle('float',!o.dim);modal.classList.toggle('wide',!!o.wide);dlgPlace();
  const ok=$('#dlgOk');ok.hidden=!o.okLabel;ok.textContent=o.okLabel||'';$('#dlgCancel').textContent=o.cancelLabel||'Cancel';modal.hidden=false;
  const f=o.body.querySelector('input,button,select');if(f)f.focus();}
function closeDialog(){if(dlg?.title==='Preferences'){const d=$('#modal .dialog');try{localStorage.setItem('gs.prefSize',JSON.stringify([d.offsetWidth,d.offsetHeight]));}catch(e){}}if(dlg?.resizable){const d=$('#modal .dialog');try{localStorage.setItem('gs.dialogSize.'+dlgKey(dlg.title),JSON.stringify([d.offsetWidth,d.offsetHeight]));}catch(e){}}modal.hidden=true;dlg=null;}
(h=>{h.addEventListener('pointerdown',e=>{if(e.button!==0||!dlg)return;e.preventDefault();const k=dlgKey(dlg.title),p0=(dlgPos[k]||[0,0]).slice(),x0=e.clientX,y0=e.clientY,d=$('#modal .dialog'),r0=d.getBoundingClientRect();h.setPointerCapture(e.pointerId);
  const mv=ev=>{/* keep the title bar on screen */let dx=ev.clientX-x0,dy=ev.clientY-y0;dx=clamp(dx,-r0.left-r0.width+80,window.innerWidth-r0.left-80);dy=clamp(dy,-r0.top,window.innerHeight-r0.top-40);dlgPos[k]=[p0[0]+dx,p0[1]+dy];dlgPlace();};
  const up=()=>{h.removeEventListener('pointermove',mv);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);};h.addEventListener('pointermove',mv);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);});
  h.addEventListener('dblclick',()=>{if(!dlg)return;delete dlgPos[dlgKey(dlg.title)];dlgPlace();});h.title='Drag to move. Double-click to put it back.';})($('#dlgTitle'));
$('#dlgOk').addEventListener('click',()=>{if(dlg&&dlg.onOk&&dlg.onOk()===false)return;closeDialog();});
$('#dlgCancel').addEventListener('click',()=>{if(dlg&&dlg.onCancel)dlg.onCancel();closeDialog();});
modal.addEventListener('pointerdown',e=>{if(e.target===modal&&!modal.classList.contains('float')){if(dlg&&dlg.onCancel)dlg.onCancel();closeDialog();}});

function filterDialog(title,defs,render,label){const et=needTarget();if(!et)return;const L=et.L;if(!effVisible(et.node)){toast('Show the active layer before filtering it.');return;}
  const vals={};const body=el('div',{class:'dlg-grid'});const sliders=[];
  /* preview.off: the dialog is open (painting stays blocked) but the canvas shows the original until Apply */
  const draw=()=>{render(L,vals);chanLimit(et);selLimit(et);};
  const upd=()=>{if(preview&&!preview.off){draw();requestRender(true);}};
  for(const d of defs){vals[d.key]=d.value;const s=makeSlider(Object.assign({},d,{id:'f_'+d.key,onInput:v=>{vals[d.key]=v;upd();}}));sliders.push([s,d]);body.append(s.el);}
  body.append(el('div',{class:'frow'},el('button',{class:'btn sm',text:'Reset',onclick:()=>{for(const [s,d] of sliders){vals[d.key]=d.value;s.set(d.value);}upd();}}),el('span',{class:'note',text:'Previewing on “'+et.node.name+'”'+(et.isMask?' (mask)':chanRestricted()?' ('+chanLabel()+' only)':'')})));
  body.append(previewChk('fPrev',prefs.livePreview,v=>{if(!preview)return;preview.off=!v;if(v)draw();requestRender(true);}));
  preview={L:et.node,isMask:et.isMask,et,off:!prefs.livePreview};upd();
  openDialog({title,body,float:true,okLabel:'Apply',onOk(){if(preview.off)draw();applyPreview(label);},onCancel(){preview=null;requestRender(true);}});}
const sgn=v=>(v>0?'+':'')+v;
function dlgAdjust(){filterDialog('Color adjustments',[
  {key:'exposure',label:'Exposure',min:-3,max:3,step:.05,value:0,fmt:v=>(v>0?'+':'')+v.toFixed(1)+' EV'},
  {key:'bright',label:'Brightness',min:-100,max:100,step:1,value:0,fmt:sgn},
  {key:'contrast',label:'Contrast',min:-100,max:100,step:1,value:0,fmt:sgn},
  {key:'sat',label:'Saturation',min:-100,max:100,step:1,value:0,fmt:sgn},
  {key:'hue',label:'Hue',min:-180,max:180,step:1,value:0,fmt:v=>sgn(v)+'°'},
  {key:'temp',label:'Temperature',min:-100,max:100,step:1,value:0,fmt:sgn}],
  (L,v)=>run(P.adjust,previewT,{uSrc:L.target.tex,uExposure:v.exposure,uBright:v.bright/200,uContrast:1+v.contrast/100,uSat:1+v.sat/100,uHue:v.hue*Math.PI/180,uTemp:v.temp/100}),'Color adjustments');}
function dlgBlur(){filterDialog('Gaussian blur',[{key:'r',label:'Radius',min:.5,max:100,step:.5,value:6,fmt:v=>v+'px'}],(L,v)=>gaussian(L.target,previewT,v.r),'Gaussian blur');}
function dlgSharpen(){filterDialog('Sharpen',[{key:'a',label:'Amount',min:0,max:3,step:.05,value:.8,fmt:pct},{key:'r',label:'Radius',min:.5,max:12,step:.5,value:1.5,fmt:v=>v+'px'}],
  (L,v)=>{gaussian(L.target,previewT,v.r);run(P.sharpen,scratchT,{uSrc:L.target.tex,uBlur:previewT.tex,uAmount:v.a});blit(scratchT,previewT,0,0,doc.w,doc.h,0,0);},'Sharpen');}
function dlgPosterize(){filterDialog('Posterize',[{key:'n',label:'Levels',min:2,max:32,step:1,value:6}],(L,v)=>run(P.poster,previewT,{uSrc:L.target.tex,uLevels:v.n}),'Posterize');}

function sizeFields(w,h,lockable){
  const iw=el('input',{class:'num',type:'number',id:'dW',min:1,max:MAX_DIM,value:w}),ih=el('input',{class:'num',type:'number',id:'dH',min:1,max:MAX_DIM,value:h});
  const lock=lockable?el('input',{type:'checkbox',id:'dLock'}):null;if(lock)lock.checked=true;const ratio=w/h;
  iw.addEventListener('input',()=>{if(lock&&lock.checked)ih.value=Math.max(1,Math.round(+iw.value/ratio));});ih.addEventListener('input',()=>{if(lock&&lock.checked)iw.value=Math.max(1,Math.round(+ih.value*ratio));});
  const presets=el('div',{class:'chips'},...[256,512,1024,2048,4096,8192,16384].filter(n=>n<=MAX_DIM).map(n=>el('button',{class:'chip',text:String(n),onclick:()=>{iw.value=n;ih.value=lock&&lock.checked?Math.max(1,Math.round(n/ratio)):n;}})));
  const row=el('div',{class:'frow'},el('label',{for:'dW',text:'Width'}),iw,el('label',{for:'dH',text:'Height'}),ih,el('span',{class:'dim',text:'px'}));
  const read=()=>{const W=Math.round(+iw.value),H=Math.round(+ih.value);if(!(W>=1&&H>=1&&W<=MAX_DIM&&H<=MAX_DIM)){toast('Width and height must be between 1 and '+MAX_DIM+' px.');return null;}return [W,H];};
  return {row,presets,lock,read};
}
function dlgCanvasSize(){const f=sizeFields(doc.w,doc.h,false);let ax=.5,ay=.5;
  const anchor=el('div',{class:'anchor',role:'group','aria-label':'Anchor'});
  for(let j=0;j<3;j++)for(let i=0;i<3;i++){const b=el('button',{class:(i===1&&j===1)?'on':'','aria-label':'Anchor '+['top','middle','bottom'][j]+' '+['left','center','right'][i]});b.onclick=()=>{ax=i/2;ay=j/2;anchor.querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');};anchor.append(b);}
  const body=el('div',{class:'dlg-grid'},f.row,f.presets,el('div',{class:'frow'},el('label',{text:'Anchor'}),anchor,el('p',{class:'note',text:'Adds or trims canvas around existing pixels. Pixels are not resampled.'})));
  openDialog({title:'Canvas size',body,okLabel:'Resize canvas',onOk(){const r=f.read();if(!r)return false;if(r[0]!==doc.w||r[1]!==doc.h)resizeCanvasDoc(r[0],r[1],ax,ay);}});}
function dlgImageSize(){const f=sizeFields(doc.w,doc.h,true);
  const body=el('div',{class:'dlg-grid'},f.row,f.presets,el('label',{class:'chk',for:'dLock'},f.lock,el('span',{text:'Keep proportions'})),el('p',{class:'note',text:'Resamples every layer on the GPU with box-filtered supersampling.'}));
  openDialog({title:'Image size',body,okLabel:'Resample',onOk(){const r=f.read();if(!r)return false;if(r[0]!==doc.w||r[1]!==doc.h)resizeImageDoc(r[0],r[1]);}});}
/* (0.27, Kenn) where the new document starts: Paint (tabs), 3D Paint (a new project, square textures), Animation, Brush */
const NEW_START=[['paint','2D Paint'],['p3d','3D Paint'],['anim','Animation'],['brush','Brush']];
const NEW_START_NOTES={paint:'A new tab in the 2D texture canvas. You can show an optional 3D model preview beside it.',p3d:'A new 3D Paint project on the current model: the width sets the texture size (square).',anim:'A new document, opened in Animation for flipbooks and sprite sheets.',brush:'A new sketch canvas in the Brush tab (square) for drawing brush tips.'};
function dlgP3New(){let model=v3s().model,stagedMesh=null,stagedHigh=null,stagedMaps=[],setup='pbr',handWorkflow='metal';const models=el('select',{id:'p3NewModel','aria-label':'3D mesh'},...Object.entries(PRIMS).map(([k,[name]])=>el('option',{value:k,text:name})),...(p3.imported?[el('option',{value:'imported',text:p3.imported.name})]:[]));models.value=model;
  const meshName=el('span',{class:'dim',text:model==='imported'&&p3.imported?p3.imported.name:'Current model'}),selectMesh=el('button',{class:'btn sm',text:'Select…',onclick:async()=>{try{const m=await bakePickModel({udim:udim.checked,uv:'quiet'});if(!m)return;stagedMesh=m;uvFix.sync();if(!models.querySelector('option[value="imported"]'))models.append(el('option',{value:'imported',text:m.name}));models.value='imported';models.disabled=true;models.title='A mesh is chosen. Press Select… to pick another one.';meshName.textContent=m.name+(m.uvSetName?' · UV '+m.uvSetName:'');}catch(e){toast('This model could not be loaded: '+(e.message||e));}}});
  /* (0.54) the UV check of the chosen model: what is wrong, and what to do about it once the project is made */
  const uvFix=(()=>{const note=el('p',{class:'note',id:'p3NewUvNote',hidden:true}),pick=el('select',{id:'p3NewUv','aria-label':'What to do about the UVs',hidden:true}),row=el('div',{class:'frow p3newrow',hidden:true},el('label',{for:'p3NewUv',text:'UVs'}),pick);
    return {note,row,pick,sync(){const st=stagedMesh?uvDialogState(stagedMesh):null;note.hidden=row.hidden=pick.hidden=!st||(!st.none&&!st.issues.length);if(note.hidden)return;pick.replaceChildren();
      if(st.none){note.textContent='This model has no UVs, so it cannot be painted or baked. An auto unwrap makes UVs for it; you can review and re-roll it in the Bake tab.';pick.append(el('option',{value:'unwrap',text:'Auto unwrap it'}),el('option',{value:'none',text:'Leave it without UVs'}));}
      else{note.textContent='The UVs may cause trouble: '+st.issues.join(' ');pick.append(el('option',{value:'keep',text:'Keep them as they are'}),el('option',{value:'optimize',text:'Optimize the layout (pack the islands again)'}),el('option',{value:'unwrap',text:'Auto unwrap again'}));}}};})();
  const template=el('select',{id:'p3NewTemplate','aria-label':'Starting material'},...[["neutral","Neutral gray"],["steel","Brushed steel"],["polymer","Painted polymer"]].map(([v,n])=>el('option',{value:v,text:n})));
  const setupPick=el('select',{id:'p3NewPipeline','aria-label':'Project setup'},...[["handpainted","Hand-painted"],["pbr","PBR"],["spec","Specular / Glossiness"]].map(([v,n])=>el('option',{value:v,text:n}))),
    handPick=el('select',{id:'p3NewHandWorkflow','aria-label':'Hand-painted material workflow'},el('option',{value:'metal',text:'PBR · Base colour, Metallic, Roughness'}),el('option',{value:'spec',text:'Spec Gloss · Diffuse, Specular, Glossiness'})),
    handRow=el('div',{class:'frow p3newrow'},el('label',{for:'p3NewHandWorkflow',text:'Hand-painted channels'}),handPick),
    setupNote=el('p',{class:'note',text:'Hand-painted projects use painted colour with either PBR or Spec Gloss material channels.'}),
    updateSetup=()=>{handRow.hidden=setup!=='handpainted';setupNote.textContent=setup==='handpainted'?'Choose whether the hand-painted workflow uses PBR or Spec Gloss channels.':setup==='spec'?'Diffuse, specular and glossiness channels; The Material editor will show Spec Gloss controls.':'Base colour, metallic and roughness channels; the Material editor will show PBR controls.';};
  setupPick.onchange=()=>{setup=setupPick.value;updateSetup();};handPick.onchange=()=>{handWorkflow=handPick.value;};
  const highName=el('span',{class:'dim',text:'None'}),highPick=el('button',{class:'btn sm',id:'p3NewHigh',text:'Select…',onclick:async()=>{try{const m=await bakePickModel();if(!m)return;stagedHigh=m;highName.textContent=m.name+' · '+m.tris.toLocaleString()+' triangles';highClear.hidden=false;}catch(e){toast('This model could not be loaded: '+(e.message||e));}}}),highClear=el('button',{class:'btn sm',text:'×',hidden:true,title:'Remove the high-poly','aria-label':'Remove the high-poly',onclick:()=>{stagedHigh=null;highName.textContent='None';highClear.hidden=true;}});
  const mapSummary=el('span',{class:'dim',text:'No mesh maps selected'}),mapPick=el('button',{class:'btn sm',text:'Import mesh maps…',onclick:async()=>{try{const fs=await pickFiles('image/*,.tga,.dds,.tif,.tiff',true,'Mesh maps',['png','jpg','jpeg','webp','tga','dds','tif','tiff','bmp']);if(fs.length){stagedMaps=fs;mapSummary.textContent=fs.map(f=>f.name).join(', ');}}catch(e){toast('Could not select mesh maps: '+(e.message||e));}}});
  const sizes=[[512,'512 × 512'],[1024,'1024 × 1024'],[2048,'2048 × 2048'],[4096,'4096 × 4096'],[8192,'8192 × 8192'],[16384,'16384 × 16384']].filter(([n])=>n<=MAX_DIM),resolution=el('select',{id:'p3NewResolution','aria-label':'Document resolution'},...sizes.map(([n,label])=>el('option',{value:n,text:label})));resolution.value=String([2048,...sizes.map(s=>s[0])].find(n=>n<=MAX_DIM)||sizes[0][0]);
  const udim=el('input',{type:'checkbox','aria-label':'Use UDIM tile workflow'}),body=el('div',{class:'dlg-grid p3new'},el('div',{class:'sub',text:'Basic settings'}),
    el('div',{class:'frow p3newrow'},el('label',{for:'p3NewModel',text:'3D mesh'}),el('div',{class:'p3newmesh'},meshName,selectMesh,models)),uvFix.note,uvFix.row,el('div',{class:'frow p3newrow'},el('label',{for:'p3NewPipeline',text:'Project setup'}),setupPick),handRow,setupNote,
    el('div',{class:'frow p3newrow'},el('label',{for:'p3NewTemplate',text:'Starting material'}),template),el('div',{class:'frow p3newrow'},el('label',{for:'p3NewResolution',text:'Document resolution'}),resolution),
    el('details',{class:'p3newadvanced',open:true},el('summary',{text:'Advanced settings'}),el('div',{class:'dlg-grid'},el('div',{class:'sub',text:'UV tile settings (UDIMs)'}),el('label',{class:'chk'},udim,el('span',{text:'Use UV tile workflow'})),el('p',{class:'note',text:'Creates a separate paintable texture set for every UDIM tile detected on the mesh. Painting begins on the tile under your cursor; use the texture set list to switch tiles.'}),
      el('div',{class:'sub',text:'High-poly (to bake the maps here)'}),el('div',{class:'frow p3newrow'},el('label',{text:'Optional high-poly'}),highPick,highName,highClear),el('p',{class:'note',text:'No maps to import? Pick the high-poly mesh and the Bake mesh maps window opens with it ready once the project is created.'}),el('div',{class:'sub',text:'Import baked mesh maps'}),el('div',{class:'frow p3newrow'},el('label',{text:'Optional maps'}),mapPick,mapSummary),el('p',{class:'note',text:'Maps are assigned by filename (normal, AO, curvature, thickness, position, ID, height, roughness or metallic) after the project is created.'}),
      el('div',{class:'sub',text:'Mesh requirements'}),el('p',{class:'note',text:'The selected mesh must already have UV coordinates. Use the model controls after creating the project to import or change a mesh.'}))));
  updateSetup();openDialog({title:'New 3D Paint Project',body,resizable:true,okLabel:'Create',onOk(){const n=+resolution.value,key=models.value,mat=template.value,wf=setup==='spec'?'spec':setup==='handpainted'?handWorkflow:'metal';setTimeout(async()=>{try{if(stagedMesh&&uvFix.pick.value&&!uvFix.pick.hidden){const w=uvFix.pick.value;if(w==='unwrap')stagedMesh=await uvRunUnwrap(stagedMesh);else if(w==='optimize')stagedMesh=uvRepackOwn(stagedMesh);}}catch(e){toast('The unwrap did not work: '+(e.message||e));}if(await p3NewProject(n,{modelKey:key,imported:stagedMesh,startMaterial:mat,setup,workflow:wf,udim:udim.checked})){if(stagedMaps.length)await p3MapBatch(stagedMaps);if(stagedHigh){bakeSetModel('high',stagedHigh);p3bk.useHigh=true;setTimeout(()=>dlgP3Bake(),300);}}},0);}});}
function dlgNew(){if(ui.mode==='p3d'){dlgP3New();return;}const f=sizeFields(1024,1024,false);let depth=doc.depth,bgMode='white',tile=false,tpl='hand',start=['p3d','anim','brush'].includes(ui.mode)?ui.mode:'paint';
  const seg=(opts,cur,set)=>{const w=el('div',{class:'chips'});const draw=()=>{w.replaceChildren(...opts.map(([v,l,dis])=>el('button',{class:'chip'+(v===cur()?' on':''),disabled:!!dis,title:dis?'This GPU cannot render 16-bit float textures':null,text:l,onclick:()=>{set(v);draw();}})));};draw();return w;};
  const tileChk=chk('dTile','Seamless tile mode',false,v=>{tile=v;});
  const bgColour=el('input',{id:'dBgColour',type:'color',value:toHex(ui.bg),'aria-label':'Canvas colour'}),bgHex=el('input',{id:'dBgHex',type:'text',value:toHex(ui.bg),maxlength:7,'aria-label':'Canvas colour hex'});
  const bgHead=el('div',{class:'sub',text:'Background'}),bgCustom=el('div',{class:'frow'},el('label',{for:'dBgColour',text:'Canvas colour'}),bgColour,bgHex);
  const bgUpd=()=>{const hide=start==='p3d'||start==='brush'||tpl==='brush';bgHead.hidden=bgSeg.hidden=hide;bgCustom.hidden=hide||bgMode!=='custom';};
  const bgSeg=seg([['white','White'],['fg','Foreground color'],['custom','Custom colour'],['clear','Transparent']],()=>bgMode,v=>{bgMode=v;bgUpd();});
  bgColour.addEventListener('input',()=>{bgHex.value=bgColour.value;});bgHex.addEventListener('input',()=>{const c=fromHex(bgHex.value);if(c)bgColour.value=toHex(c);});
  const TPL_NOTES={pbrsg:'Diffuse, specular, glossiness, height and normal (the Specular/Gloss workflow).',brush:'A black-and-white canvas for drawing a brush tip: paint in black, then press Make brush.',hand:'Base colour only.',pbr:'Base colour, roughness, metallic, height and normal.',custom:'Choose the maps after creating.'};const tplNote=el('p',{class:'note',text:TPL_NOTES.hand});
  const np=newPresetBox(f);
  const spritePreset=el('select',{id:'dSpritePreset','aria-label':'Sprite document template'},el('option',{value:'pixel64',text:'Character sprite · 64 × 64'}),el('option',{value:'pixel32',text:'Pixel sprite · 32 × 32'}),el('option',{value:'pixel128',text:'Large character · 128 × 128'}),el('option',{value:'sheet256',text:'Sprite sheet · 256 × 256'}),el('option',{value:'sheet512',text:'Sprite sheet · 512 × 512'}),el('option',{value:'hd',text:'HD 2D art · 512 × 512'}),el('option',{value:'custom',text:'Custom sprite canvas'}));
  const spritePalette=el('select',{id:'dSpritePalette','aria-label':'Sprite colour palette'},...Object.entries(CM_GAME_PALETTES).map(([k,p])=>el('option',{value:k,text:p.name})));spritePalette.value='sunset-harbor';
  const spriteFPS=el('input',{id:'dSpriteFPS',class:'num',type:'number',min:1,max:240,value:12,'aria-label':'Animation frame rate',title:'Default frame rate for this sprite document'});
  const spriteBox=el('div',{class:'spriteDocOptions'},el('div',{class:'sub',text:'Sprite setup'}),el('div',{class:'frow'},el('label',{for:'dSpritePreset',text:'Template'}),spritePreset),el('div',{class:'frow'},el('label',{for:'dSpritePalette',text:'Game palette'}),spritePalette),el('div',{class:'frow'},el('label',{for:'dSpriteFPS',text:'Frame rate'}),spriteFPS,el('span',{class:'dim',text:'fps'})),el('p',{class:'note',text:'Creates a transparent 8-bit canvas, opens the animation timeline and puts the chosen palette in the colour swatches.'}));
  const spriteSizes={pixel32:[32,32],pixel64:[64,64],pixel128:[128,128],sheet256:[256,256],sheet512:[512,512],hd:[512,512]};
  let spriteTemplateApplied=false;spritePreset.addEventListener('change',()=>{const s=spriteSizes[spritePreset.value];if(s){$('#dW').value=s[0];$('#dH').value=s[1];depth=8;bgMode='clear';spriteTemplateApplied=true;bgUpd();}});if(start==='anim')spritePreset.dispatchEvent(new Event('change'));
  const tplHead=el('div',{class:'sub',text:'Template'}),tplSeg=seg([['hand','Hand-painted'],['pbr','PBR'],['pbrsg','PBR spec/gloss'],['brush','Brush tip'],['custom','Custom…']],()=>tpl,v=>{tpl=v;tplNote.textContent=TPL_NOTES[v];bgUpd();if(v==='brush'){$('#dW').value=512;$('#dH').value=512;}});
  const stNote=el('p',{class:'note',id:'dStartNote',text:NEW_START_NOTES[start]});
  const onlyPaint=[np.orientation,tplHead,tplSeg,tplNote];const stUpd=()=>{stNote.textContent=NEW_START_NOTES[start];for(const x of onlyPaint)x.hidden=start==='p3d'||start==='brush'||(start==='anim'&&x!==np.orientation);spriteBox.hidden=start!=='anim';bgUpd();};
  const stSeg=seg(NEW_START,()=>start,v=>{if(v==='p3d'){closeDialog();dlgP3New();return;}start=v;if(v==='anim'&&!spriteTemplateApplied)spritePreset.dispatchEvent(new Event('change'));stUpd();if(v==='brush'&&$('#dH'))$('#dH').value=$('#dW').value;});stSeg.id='dStart';
  const body=el('div',{class:'dlg-grid'},el('div',{class:'sub',text:'Start in'}),stSeg,stNote,spriteBox,np.el,f.row,np.orientation,np.units,f.presets,tplHead,tplSeg,tplNote,
    el('div',{class:'sub',text:'Bit depth'}),seg([[8,'8-bit'],[16,'16-bit float',!canFloat]],()=>depth,v=>{depth=v;}),
    bgHead,bgSeg,bgCustom,
    tileChk);
  /* the template row and note only matter for Paint and Animation */
  {const kids=[...body.children],ti=kids.indexOf(onlyPaint[1]);if(ti>=0)onlyPaint.push(kids[ti+1],kids[ti+2]);}stUpd();
  openDialog({title:'New document',body,okLabel:'Create',onOk(){const r=np.read();if(!r)return false;const dpiNew=np.dpi();
    if(start==='p3d'){const n=r[0];setTimeout(()=>dlgP3New(),0);return;}
    if(start==='brush'){if(ui.mode!=='brush'&&!setMode('brush',true))return;btNewCanvas(Math.max(64,Math.min(4096,r[0])));return;}
    if(depth===16&&r[0]*r[1]>=268435456){toast('Use 8-bit colour for a 16K square document. Height still keeps 16-bit precision.');return false;}
    if(start==='paint'&&ui.mode!=='paint'&&typeof setMode==='function'&&!setMode('paint',true))return;
    if(start==='anim'&&ui.mode!=='paint'&&ui.mode!=='anim'&&typeof setMode==='function'&&!setMode('paint',true))return;const bg=start==='anim'?null:bgMode==='white'?[1,1,1]:bgMode==='fg'?ui.fg.slice():bgMode==='custom'?fromHex(bgHex.value):null;if(start!=='anim'&&bgMode==='custom'&&!bg){toast('Enter a valid canvas colour, such as #f4e9dc.');return false;}if(typeof dtNewTab==='function'&&!dtNewTab())return;if(tpl==='brush'){newBrushDoc(r[0],r[1]);return;}newDoc(r[0],r[1],start==='anim'?8:depth,bg,typeof dtUntitled==='function'?dtUntitled():'Untitled',tile,start==='anim'?'hand':tpl==='custom'?'hand':tpl);doc.dpi=dpiNew;if(tpl==='custom'&&start!=='anim')setTimeout(dlgMaps,0);if(start==='anim'){if(ui.mode!=='anim')setMode('anim');setFps(+spriteFPS.value||12);cmUsePalette(spritePalette.value);const pal=CM_GAME_PALETTES[spritePalette.value];if(pal)setFG(fromHex(pal.colors[0]));}}});}
/* ---- New document presets (0.26.1): textures, screens, phones, social, paper, photo, books, cards, posters, film ---- */
const NEW_PRESETS=[
  ['Textures',[['256 × 256',256,256],['512 × 512',512,512],['1K (1024)',1024,1024],['2K (2048)',2048,2048],['4K (4096)',4096,4096],['8K (8192)',8192,8192],['16K (16384)',16384,16384],['2K × 1K (2:1)',2048,1024],['4K × 2K (2:1)',4096,2048]]],
  ['Screens',[['HD 720p (16:9)',1280,720],['Full HD 1080p (16:9)',1920,1080],['QHD 1440p (16:9)',2560,1440],['4K UHD (16:9)',3840,2160],['8K UHD (16:9)',7680,4320],['Ultrawide (21:9)',3440,1440],['4:3 (1600 × 1200)',1600,1200],['4:3 (1024 × 768)',1024,768],['16:10 (1920 × 1200)',1920,1200],['Square (1:1)',2048,2048]]],
  ['Phones and tablets',[['iPhone (portrait)',1179,2556],['iPhone Pro Max (portrait)',1290,2796],['Android phone (portrait)',1080,2400],['Phone wallpaper',1440,3200],['iPad Pro 12.9" (portrait)',2048,2732],['iPad (portrait)',1640,2360],['Android tablet (landscape)',2560,1600]]],
  ['Social media',[['Square post',1080,1080],['Portrait post (4:5)',1080,1350],['Story / Reel (9:16)',1080,1920],['YouTube thumbnail',1280,720],['YouTube banner',2560,1440],['X / Twitter header',1500,500],['Facebook cover',1640,624],['Twitch banner',1200,480],['Discord banner',960,540],['Profile picture',800,800]]],
  ['Paper',[['Letter (8.5 × 11 in)',8.5,11,'in'],['Legal (8.5 × 14 in)',8.5,14,'in'],['Tabloid (11 × 17 in)',11,17,'in'],['Ledger (17 × 11 in)',17,11,'in'],['A6',105,148,'mm'],['A5',148,210,'mm'],['A4',210,297,'mm'],['A3',297,420,'mm'],['A2',420,594,'mm'],['A1',594,841,'mm'],['B5',176,250,'mm'],['B4',250,353,'mm']]],
  ['Photo prints',[['4 × 6 in',4,6,'in'],['5 × 7 in',5,7,'in'],['8 × 10 in',8,10,'in'],['11 × 14 in',11,14,'in'],['Square 8 × 8 in',8,8,'in']]],
  ['Books and comics',[['Book 6 × 9 in',6,9,'in'],['Book 5.5 × 8.5 in',5.5,8.5,'in'],['Book 5 × 8 in',5,8,'in'],['Children’s book 8.5 × 8.5 in',8.5,8.5,'in'],['Comic page (US, 6.625 × 10.25 in)',6.625,10.25,'in'],['Comic cover with bleed (6.875 × 10.5 in)',6.875,10.5,'in'],['Manga (B6, 128 × 182 mm)',128,182,'mm'],['Webtoon strip (800 × 1280)',800,1280]]],
  ['Cards',[['Trading card (2.5 × 3.5 in)',2.5,3.5,'in'],['Trading card with bleed (2.75 × 3.75 in)',2.75,3.75,'in'],['Tarot card (2.75 × 4.75 in)',2.75,4.75,'in'],['Business card (3.5 × 2 in)',3.5,2,'in'],['Postcard (6 × 4 in)',6,4,'in'],['Greeting card (5 × 7 in)',5,7,'in']]],
  ['Posters',[['Poster 11 × 17 in',11,17,'in'],['Poster 18 × 24 in',18,24,'in'],['Poster 24 × 36 in',24,36,'in'],['Movie poster (27 × 40 in)',27,40,'in']]],
  ['Film and video',[['Cinema 2K DCI',2048,1080],['Cinema 4K DCI',4096,2160],['Widescreen 2.39:1 (1920 × 804)',1920,804],['Storyboard panel (16:9)',1920,1080],['Concept art (3:2, 3000 × 2000)',3000,2000]]]];
const NEW_UNITS=[['px','Pixels'],['in','Inches'],['cm','Centimetres'],['mm','Millimetres']];
function newPresetBox(f){const iw=f.row.querySelector('#dW'),ih=f.row.querySelector('#dH'),dimLab=f.row.querySelector('.dim');let unit='px',dpi=72;
  const per=u=>({px:1,in:dpi,cm:dpi/2.54,mm:dpi/25.4}[u]);const fmt=v=>unit==='px'?String(Math.round(v)):String(+v.toFixed(3));
  const px=()=>[Math.round(+iw.value*per(unit)),Math.round(+ih.value*per(unit))];
  const orientation=el('div',{class:'frow neworientation',role:'group','aria-label':'Canvas orientation'}),orientButtons=[];
  const info=el('span',{class:'dim'});const upd=()=>{const [W,H]=px();info.textContent=unit==='px'?'= '+(W/dpi).toFixed(2)+' × '+(H/dpi).toFixed(2)+' in at '+dpi+' DPI':'= '+W+' × '+H+' px';dimLab.textContent=unit;for(const [b,portrait] of orientButtons){const on=portrait?H>W:W>H;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));}};
  const sel=el('select',{'aria-label':'Preset'},el('option',{value:'',text:'Custom size'}),...NEW_PRESETS.map(([g,list],gi)=>{const og=el('optgroup',{label:g});list.forEach(([n],i)=>og.append(el('option',{value:gi+':'+i,text:n})));return og;}));
  const us=el('select',{'aria-label':'Units'},...NEW_UNITS.map(([u,n])=>el('option',{value:u,text:n})));
  const di=el('input',{class:'num',type:'number',min:1,max:9600,value:dpi,'aria-label':'Resolution in DPI'});
  const setUnit=u=>{const [W,H]=px();unit=u;us.value=u;iw.value=fmt(W/per(u));ih.value=fmt(H/per(u));upd();};
  us.addEventListener('change',()=>setUnit(us.value));
  di.addEventListener('input',()=>{const v=Math.round(+di.value);if(v>0){if(unit==='px'){dpi=v;upd();}else{dpi=v;upd();}}});
  sel.addEventListener('change',()=>{if(!sel.value)return;const [gi,i]=sel.value.split(':').map(Number),[,w,h,u]=NEW_PRESETS[gi][1][i];
    if(u){dpi=300;di.value=300;unit=u;us.value=u;iw.value=fmt(w);ih.value=fmt(h);}else{unit='px';us.value='px';iw.value=w;ih.value=h;}upd();});
  const swap=el('button',{class:'btn sm',title:'Swap width and height (portrait / landscape)','aria-label':'Swap width and height',text:'⇄',onclick:()=>{const a=iw.value;iw.value=ih.value;ih.value=a;upd();}});
  orientation.append(el('label',{text:'Orientation'}));
  for(const [portrait,label,icon] of [[true,'Portrait (vertical)','▯'],[false,'Landscape (horizontal)','▭']]){const b=el('button',{class:'chip','aria-label':label,title:'Swap the dimensions. A square becomes a 2:3 or 3:2 canvas.',onclick:()=>{let a=Math.min(+iw.value,+ih.value),b=Math.max(+iw.value,+ih.value);if(!(a>0&&b>0))return;if(a===b){b=Math.min(MAX_DIM/per(unit),a*1.5);if(b===a)a=b/1.5;}iw.value=fmt(portrait?a:b);ih.value=fmt(portrait?b:a);sel.value='';upd();}},el('span',{'aria-hidden':'true',text:icon}),el('span',{text:label}));orientButtons.push([b,portrait]);orientation.append(b);}
  for(const i of [iw,ih])i.addEventListener('input',()=>{sel.value='';upd();});
  for(const b of f.presets.querySelectorAll('button'))b.addEventListener('click',()=>{if(unit!=='px')setUnit('px');sel.value='';setTimeout(upd,0);});
  iw.step=ih.step='any';upd();
  return {orientation,el:el('div',{class:'frow'},el('label',{text:'Preset'}),sel),units:el('div',{class:'frow'},el('label',{text:'Units'}),us,el('label',{text:'DPI'}),di,swap,info),dpi:()=>dpi,
    read(){const [W,H]=px();if(!(W>=1&&H>=1&&W<=MAX_DIM&&H<=MAX_DIM)){toast('That is '+W+' × '+H+' px. Width and height must be between 1 and '+MAX_DIM+' px'+(unit!=='px'?' (try a lower DPI).':'.'));return null;}return [W,H];}};}
/* the brush-tip template: white, 8-bit, black brush, and a banner with Make brush */
function newBrushDoc(w,h){newDoc(w||512,h||512,8,[1,1,1],'Brush tip',false,'hand');doc.brushTpl=true;ui.bg=[1,1,1];setFG([0,0,0]);setTool('brush');tipBanner();}
let tipBan=null;
function tipBanner(){const on=!!(doc.brushTpl&&ui.mode==='paint');if(!tipBan){if(!on)return;tipBan=el('div',{id:'tipBanner',class:'banner',role:'status'});stage.append(tipBan);}
  tipBan.hidden=!on;if(on)tipBan.replaceChildren(el('b',{text:'Brush tip'}),document.createTextNode(' · paint in black, grey is partly see-through · '),
    el('button',{class:'btn sm primary',text:'Make brush',onclick:dlgMakeTip}),el('button',{class:'btn sm',text:'Clear',onclick:()=>{const L=paintLayers()[0];if(L){selectOnly(L);renderLayers();}if(sel.active)actions.deselect();const f=ui.fg;ui.fg=[1,1,1];try{fillLayer();}finally{ui.fg=f;}}}));}
const FORMATS=[['png','PNG'],['tga','TGA'],['dds','DDS'],['tif','TIFF'],['exr','EXR'],['jpg','JPG'],['webp','WebP']];
const exp={fmt:'png',png16:false,tgaRle:true,tgaAlpha:true,dds:'bc3',mips:true,tif16:false,q:.92,src:'image'};
const isPOT=n=>n>0&&(n&(n-1))===0;
function segChips(opts,get,set,after){const w=el('div',{class:'chips'});const draw=()=>w.replaceChildren(...opts.map(([v,l,dis,tip])=>el('button',{class:'chip'+(v===get()?' on':''),disabled:!!dis,title:tip||null,text:l,onclick:()=>{set(v);draw();if(after)after();}})));draw();return w;}
async function buildExport(){
  const W=doc.w,H=doc.h,t=sourceTarget(exp.src),px=readPremult(t);if(t!==compOut)release(t);const base=slug(doc.name)+(exp.src==='layer'&&doc.active?'-'+slug(doc.active.name):'');
  switch(exp.fmt){
    case 'png':return exp.png16?{blob:await encodePNG16(W,H,toStraight(px,16)),name:base+'.png'}:{blob:await canvasBlob(W,H,toStraight(px,8),'image/png'),name:base+'.png'};
    case 'tga':return {blob:encodeTGA(W,H,toStraight(px,8),exp.tgaRle,exp.tgaAlpha),name:base+'.tga'};
    case 'dds':return {blob:await encodeDDS(W,H,toStraight(px,8),exp.dds,exp.mips),name:base+'.dds'};
    case 'tif':return {blob:await encodeTIFF(W,H,toStraight(px,exp.tif16?16:8),exp.tif16?16:8),name:base+'.tif'};
    case 'exr':return {blob:encodeEXR(W,H,px),name:base+'.exr'};
    case 'jpg':return {blob:await canvasBlob(W,H,toStraight(px,8),'image/jpeg',exp.q,true),name:base+'.jpg'};
    case 'webp':return {blob:await canvasBlob(W,H,toStraight(px,8),'image/webp',exp.q,false),name:base+'.webp'};}}
function dlgExport(){
  exp.png16=exp.tif16=doc.depth===16;
  const opts=el('div',{class:'fmt-opts'}),info=el('p',{class:'note'}),status=el('div',{class:'status-line',role:'status'});
  const go=el('button',{class:'btn primary',text:'Export'});
  const fmtRow=segChips(FORMATS.map(([v,l])=>[v,l]),()=>exp.fmt,v=>{exp.fmt=v;},drawOpts);
  const srcRow=segChips([['image','Visible image'],['layer',(doc.active&&doc.active.type==='group'?'Active group':'Active layer')+(doc.active?' ('+doc.active.name+')':'')]],()=>exp.src,v=>{exp.src=v;});
  function drawOpts(){const f=exp.fmt,W=doc.w,H=doc.h,ow=[];const hi16=doc.depth===16?null:'The document is 8-bit; switch to 16-bit in the Image menu to get extra precision.';
    if(f==='png'){ow.push(segChips([[false,'8-bit'],[true,'16-bit',doc.depth!==16,hi16]],()=>exp.png16,v=>{exp.png16=v;}),el('p',{class:'note',text:'Lossless with transparency. The safe default for engines and for sharing.'}));}
    if(f==='tga'){ow.push(el('div',{class:'chips'},chk('eRle','RLE compression',exp.tgaRle,v=>{exp.tgaRle=v;}),chk('eAlpha','Alpha channel (32-bit)',exp.tgaAlpha,v=>{exp.tgaAlpha=v;})),el('p',{class:'note',text:'Top-left origin, BGRA. Read by Unreal, Unity, Godot, Substance and most DCC tools.'}));}
    if(f==='dds'){ow.push(segChips([['bc1','BC1 / DXT1'],['bc3','BC3 / DXT5'],['rgba','Uncompressed']],()=>exp.dds,v=>{exp.dds=v;},drawOpts),el('div',{class:'chips'},chk('eMip','Generate mipmaps',exp.mips,v=>{exp.mips=v;})),
        el('p',{class:'note',text:exp.dds==='bc1'?'Smallest file, for color maps without transparency (1-bit alpha at most).':exp.dds==='bc3'?'Color plus smooth alpha. Good for cutouts, foliage and decals.':'Full 8-bit BGRA, no compression artifacts, four to eight times larger.'}));
      if(exp.dds!=='rgba'&&(W%4||H%4))ow.push(el('p',{class:'note',text:'Block compression works best when width and height are multiples of 4.'}));}
    if(f==='tif'){ow.push(segChips([[false,'8-bit'],[true,'16-bit',doc.depth!==16,hi16]],()=>exp.tif16,v=>{exp.tif16=v;}),el('p',{class:'note',text:'Deflate-compressed RGBA with unassociated alpha.'}));}
    if(f==='exr')ow.push(el('p',{class:'note',text:'Half-float RGBA in linear color with premultiplied alpha. Use it for HDR, lighting or VFX work; painted color textures usually go out as PNG, TGA or DDS.'}));
    if(f==='jpg'||f==='webp'){ow.push(makeSlider({id:'eQ',label:'Quality',min:.4,max:1,step:.01,value:exp.q,fmt:pct,onInput:v=>{exp.q=v;}}).el);
      if(f==='jpg')ow.push(el('p',{class:'note',text:'JPG has no transparency; transparent areas become black. Avoid it for textures you will edit again.'}));}
    opts.replaceChildren(...ow);
    info.textContent=doc.w+' × '+doc.h+' px'+(isPOT(doc.w)&&isPOT(doc.h)?' (power of two).':'. Not a power of two; engines generate mipmaps best from sizes like 512, 1024 or 2048.');}
  drawOpts();
  go.addEventListener('click',async()=>{go.disabled=true;status.className='status-line';status.textContent='Encoding…';await tick();
    try{const {blob,name}=await buildExport();status.textContent='Saving '+name+' ('+(blob.size/1048576).toFixed(2)+' MB)…';const r=await deliver(name,blob);
      status.className='status-line '+(r.ok?'ok':'err');status.textContent=deliveredText(r,exp.fmt.toUpperCase());}
    catch(e){console.error(e);status.className='status-line err';status.textContent='Export failed: '+e.message;}finally{go.disabled=false;}});
  const body=el('div',{class:'dlg-grid'},el('div',{class:'sub',text:'Format'}),fmtRow,opts,el('div',{class:'sub',text:'Source'}),srcRow,info,el('div',{class:'frow'},go,status));
  openDialog({title:'Export',body,okLabel:null,cancelLabel:'Close'});}

