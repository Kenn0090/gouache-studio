/* ================= Window scale (0.65.1) =================
   Makes the whole window (panels, buttons and text) bigger or smaller, like zooming a web page. In the desktop app this uses the
   window's own zoom, so everything, including the canvas, stays sharp and lines up. In a browser use the browser's zoom (Ctrl + and −). */
const UI_SCALES=[.75,.9,1,1.1,1.25,1.5,1.75,2];
async function uiScaleApply(){const f=clamp(+prefs.uiScale||1,.5,3);if(!platform.isDesktop)return false;
  try{const T=window.__TAURI__,wv=T&&T.webview&&T.webview.getCurrentWebview&&T.webview.getCurrentWebview();if(wv&&wv.setZoom){await wv.setZoom(f);return true;}
    await platform.invoke('plugin:webview|set_webview_zoom',{label:'main',value:f});return true;}
  catch(e){console.warn('window scale',e);return false;}}
async function uiScaleSet(f,quiet){f=clamp(f,.5,3);prefs.uiScale=Math.abs(f-1)<.001?undefined:f;savePrefs();
  if(!platform.isDesktop){if(!quiet)toast('In a browser, use the browser’s zoom (Ctrl and + or −, Ctrl 0 to reset).');return;}
  const ok=await uiScaleApply();if(!quiet)toast(ok?'Window scale: '+Math.round(f*100)+'%.':'The window scale could not be changed.');}
function uiScaleStep(d){const cur=+prefs.uiScale||1;let i=UI_SCALES.findIndex(v=>v>=cur-.001);if(i<0)i=UI_SCALES.length-1;const j=clamp(i+d,0,UI_SCALES.length-1);uiScaleSet(UI_SCALES[j]);}
for(const p of [75,90,100,110,125,150,175,200])actions['uiScale'+p]=()=>uiScaleSet(p/100);
actions.uiScaleUp=()=>uiScaleStep(1);actions.uiScaleDown=()=>uiScaleStep(-1);
/* an exact percentage, 50 to 300 */
function dlgUiScale(){const cur=Math.round((+prefs.uiScale||1)*100),inp=el('input',{type:'number',id:'uiScalePct',class:'num',min:'50',max:'300',step:'1',value:String(cur),'aria-label':'Window scale in percent'});
  const apply=()=>{const v=clamp(Math.round(+inp.value||100),50,300);inp.value=String(v);uiScaleSet(v/100,true);};
  inp.addEventListener('change',apply);inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();apply();}});
  openDialog({title:'Window scale',body:el('div',{class:'dlg-grid'},el('div',{class:'frow'},el('label',{for:'uiScalePct',text:'Scale'}),inp,el('span',{class:'dim',text:'%'})),el('p',{class:'note',text:platform.isDesktop?'Type any value from 50 to 300 and press Enter. 100 is the normal size.':'In a browser use the browser’s zoom (Ctrl and + or −).'})),okLabel:'Apply',onOk(){apply();}});setTimeout(()=>{inp.focus();inp.select();},0);}
actions.uiScaleCustom=dlgUiScale;
MENUS.View.push('-',['Window scale','sub',[['Larger','uiScaleUp'],['Smaller','uiScaleDown'],'-',...[75,90,100,110,125,150,175,200].map(p=>[p+'%','uiScale'+p]),'-',['Exact percentage…','uiScaleCustom']]]);
if(prefs.uiScale)setTimeout(uiScaleApply,300);
