/* ================= Close the tabs you do not use (0.65.1) =================
   Each work tab at the top (Photo, 3D Paint, Animation, Bake, Convert, Brush) can be closed with its small × (2D Paint always
   stays). Window › Sections… brings them back. A closed tab also comes back by itself when something sends you there
   (for example Send to Bake). Panel tabs in the docks have a × too (they come back from the Window menu). */
const SECTIONS=[['photo','Photo'],['p3d','3D Paint'],['anim','Animation'],['bake','Bake'],['convert','Convert'],['brush','Brush']];
const secHidden=m=>Array.isArray(prefs.hiddenModes)&&prefs.hiddenModes.includes(m);
function secApply(){for(const b of document.querySelectorAll('#modeTabs [data-mode]'))b.hidden=secHidden(b.dataset.mode);}
function secSet(m,hide,quiet){if(m==='paint')return;const list=(Array.isArray(prefs.hiddenModes)?prefs.hiddenModes:[]).filter(x=>x!==m);if(hide)list.push(m);
  prefs.hiddenModes=list.length?list:undefined;savePrefs();if(hide&&ui.mode===m)setMode('paint',true);secApply();if(!quiet&&hide)toast('Closed the '+(SECTIONS.find(s=>s[0]===m)||[m,m])[1]+' tab. Window › Sections… brings it back.');}
(function(){for(const b of document.querySelectorAll('#modeTabs [data-mode]')){const m=b.dataset.mode;if(m==='paint')continue;
  b.append(el('span',{class:'modex',role:'button','aria-label':'Close the '+b.textContent+' tab',title:'Close this tab (Window › Sections… brings it back)',text:'×',
    onclick:e=>{e.stopPropagation();e.preventDefault();secSet(m,true);}}));}
  secApply();
  /* something that sends you to a closed tab opens it again */
  const sm=setMode;setMode=function(m){if(m&&secHidden(m))secSet(m,false,true);return sm.apply(this,arguments);};})();
function dlgSections(){const body=el('div',{class:'dlg-grid'},el('p',{class:'note',text:'Choose which work tabs show at the top. 2D Paint is always there. A closed tab comes back by itself if something sends you to it.'}),
  ...SECTIONS.map(([m,t])=>chk('sec_'+m,t,!secHidden(m),v=>secSet(m,!v,true))));
  openDialog({title:'Sections',body,okLabel:'',cancelLabel:'Close'});}
actions.sections=dlgSections;MENUS.Window.push('-',['Sections…','sections']);
/* Window › Panels…: every panel of the tab you are in, ticked when it is open. Close one with its × and bring it back here. */
function dlgPanels(){const ids=PANEL_IDS.filter(id=>!PANELS[id].mode&&dkIn(id));
  const body=el('div',{class:'dlg-grid'},el('p',{class:'note',text:'Tick the panels you want. Each panel tab also has a × to close it.'}),
    ...ids.map(id=>chk('pnl_'+id,id==='tool'?(dk.toolTitle&&dk.toolTitle.textContent)||'Tool settings':PANELS[id].title,panelShown(id),v=>{if(v)showPanel(id);else dkMove(id,{hidden:true});})));
  openDialog({title:'Panels',body,okLabel:'',cancelLabel:'Close'});}
actions.panelsDlg=dlgPanels;MENUS.Window.push(['Panels…','panelsDlg']);
