/* ================= Pen and tablet test (0.62.1) =================
   Shows what the computer reports when you use a pen or tablet: which buttons arrive and how. Move the pen over the grey square,
   press its tip and each side button, touch with the eraser end, and watch the ticks. */
function dlgPenTest(){
  const seen={pen:false,mouse:false,tip:false,barrel:false,middle:false,hoverBtn:false,eraser:false,touch:false};
  const rows=[['pen','The computer sees a pen'],['mouse','A mouse (or a tablet acting as a mouse)'],['tip','Tip pressed on the surface'],['barrel','Side button seen as a right click'],['middle','Side button seen as a middle click'],['hoverBtn','A side button pressed while the pen hovers'],['eraser','Eraser end'],['touch','Finger touch']];
  const pad=el('div',{class:'pentest',id:'penPad',tabindex:'0','aria-label':'Test area'},el('span',{text:'Use the pen here'})),log=el('pre',{class:'penlog',id:'penLog'}),list=el('div',{class:'penseen',id:'penSeen'});
  const line=[],draw=()=>{list.replaceChildren(...rows.map(([k,t])=>el('div',{class:'penrow'+(seen[k]?' on':'')},el('b',{text:seen[k]?'✓':'–'}),el('span',{text:t}))));log.textContent=line.join('\n');};
  const note=(e,t)=>{const pt=e.pointerType||'';if(pt==='pen')seen.pen=true;else if(pt==='mouse')seen.mouse=true;else if(pt==='touch')seen.touch=true;
    const b=e.buttons|0;if(pt==='pen'&&(b&1)&&t==='pointerdown')seen.tip=true;if(e.button===2||(b&2))seen.barrel=true;if(e.button===1||(b&4))seen.middle=true;if(pt==='pen'&&(b&6)&&!(b&1))seen.hoverBtn=true;if(b&32||e.button===5)seen.eraser=true;
    if(t!=='pointermove'||b){line.push(t.replace('pointer','')+'  '+pt+'  button '+e.button+'  buttons '+b+'  pressure '+(Math.round((e.pressure||0)*100)/100));if(line.length>12)line.shift();}draw();};
  for(const t of ['pointerdown','pointermove','pointerup','pointercancel','auxclick','contextmenu'])pad.addEventListener(t,e=>{if(t==='contextmenu'||t==='auxclick')e.preventDefault();note(e,t);});
  pad.addEventListener('pointerdown',e=>{try{pad.setPointerCapture(e.pointerId);}catch(er){}e.preventDefault();});
  draw();
  openDialog({title:'Pen and tablet test',body:el('div',{class:'dlg-grid'},el('p',{class:'note',text:'Move the pen over the square, press its tip, press each side button (also while hovering above the surface), and turn it over for the eraser. The ticks show what arrives. If the side button you set to “middle click” never shows a tick, the pen driver is not sending it to apps; the pen’s side button can still move the view (Preferences › Painting).'}),pad,list,el('p',{class:'note',text:'Last events:'}),log),okLabel:'',cancelLabel:'Close',wide:true});}
actions.penTest=dlgPenTest;
MENUS.Help.splice(MENUS.Help.findIndex(m=>Array.isArray(m)&&m[1]==='keys')+1,0,['Pen and tablet test…','penTest']);
