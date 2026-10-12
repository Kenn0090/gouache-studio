/* ================= Each painting tool keeps its own brush (0.25) =================
   Brush, Eraser, Blend, Dodge/Burn, Healing and Clone each remember their own brush and settings (size,
   opacity, tip, spacing, jitter…), so switching tools no longer carries one brush across. With "All tools share
   the brush tip" on, the tip (and its angle, roundness and flips) stays the same across tools while the other
   settings stay per tool. Kept on this computer between sessions (the tip by name). */
const TB_TOOLS=['brush','erase','smudge','dodge','heal','clone','material'];
const TB_TIP=['tip','angle','roundness','flipX','flipY'];
const tbGroup=t=>t==='burn'?'dodge':t;
const toolBrush={cur:'brush',slots:{},share:false};
try{const s=JSON.parse(localStorage.getItem('gs.toolBrush')||'{}');toolBrush.share=!!s.share;for(const k in s.slots||{})if(TB_TOOLS.includes(k))toolBrush.slots[k]=s.slots[k];}catch(e){}
function tbStore(){try{const slots={};for(const k in toolBrush.slots){const o=Object.assign({},toolBrush.slots[k]);o.tipName=o.tip?o.tip.name:(o.tipName||null);delete o.tip;o.presetName=o.preset?o.preset.name:(o.presetName||null);delete o.preset;o.sourceName=o.source?o.source.name:(o.sourceName||null);delete o.source;slots[k]=o;}
  localStorage.setItem('gs.toolBrush',JSON.stringify({share:toolBrush.share,slots}));}catch(e){}}
function tbSnap(){const o={};for(const k of SETTING_KEYS)o[k]=brush[k];o.preset=activePreset;o.source=brushSession.source;return o;}
/* a saved tip, found again by name in the brush library */
function tbFindTip(name){if(!name)return null;for(const set of library){for(const p of set.presets||[])if(p.tip&&p.tip.name===name)return p.tip;for(const t of set.tips||[])if(t&&t.name===name)return t;}return null;}
function tbFindPreset(name){if(!name)return null;for(const set of library)for(const p of set.presets||[])if(p.name===name)return p;return null;}
function tbSaveCur(){brushRememberSize();const c=toolBrush.cur;if(TB_TOOLS.includes(c))toolBrush.slots[c]=tbSnap();}
/* called by setTool: put away the old tool's brush, bring out the new one's */
function tbSwitch(t,keepPreset){const g=tbGroup(t);if(!TB_TOOLS.includes(g))return;
  if(keepPreset){toolBrush.cur=g;return;}/* a preset was just applied: it belongs to the new tool */
  if(g===toolBrush.cur)return;tbSaveCur();toolBrush.cur=g;const S=toolBrush.slots[g];
  if(S){tbApply(S);if(typeof renderLibrary==='function')renderLibrary();}
  swRebase();tbStore();}
function tbSetShare(v){toolBrush.share=!!v;tbStore();}
window.addEventListener('beforeunload',()=>{tbSaveCur();tbStore();});

/* ---- (0.55.1) each document remembers its own brushes ----
   Every tab keeps the brushes of all its tools; a new document starts with the starting brush. */
function tbApply(S){const keep={};if(toolBrush.share)for(const k of TB_TIP)keep[k]=brush[k];
  for(const k of SETTING_KEYS)if(S&&k in S)brush[k]=S[k];else brush[k]=BRUSH_DEFAULTS[k];
  if(!S||!('tip' in S)||S.tip===undefined)brush.tip=S&&S.tipName?tbFindTip(S.tipName):null;
  activePreset=S?(S.preset!==undefined?S.preset:tbFindPreset(S.presetName)):null;
  brushSession.source=S?(S.source!==undefined?S.source:tbFindPreset(S.sourceName||S.presetName)):null;
  if(toolBrush.share)Object.assign(brush,keep);}
function tbDocGet(){tbSaveCur();return {cur:toolBrush.cur,slots:Object.assign({},toolBrush.slots)};}
function tbDocRefresh(){if(typeof renderLibrary==='function')renderLibrary();if(typeof buildBrushPanel==='function')buildBrushPanel();if(typeof buildOptBar==='function')buildOptBar();if(typeof refreshCursor==='function')refreshCursor();}
function tbDocPut(s){if(!s)return tbDocReset();toolBrush.slots=Object.assign({},s.slots);toolBrush.cur=s.cur;tbApply(toolBrush.slots[toolBrush.cur]);swRebase();tbDocRefresh();}
/* (0.58, Kenn: "make Gasa the default brush") the brush a new app or document starts with */
function startingBrush(){return tbFindPreset('Gasa Pen')||PRESETS[0];}
function tbDocReset(){toolBrush.slots={};const g=tbGroup(ui.tool);toolBrush.cur=TB_TOOLS.includes(g)?g:'brush';tbApply(null);if(toolBrush.cur==='brush'){const sb=startingBrush();if(sb){brushSession.sizes.delete(sb);applyPreset(sb);}}swRebase();tbDocRefresh();}

/* ---- (0.55.1) Preferences › Undo also covers settings: brush settings and colours ----
   Watches the brush and the colours; after they have held still for a moment, a change becomes one undo step. Switching tool or
   document, and undoing itself, do not count as changes. */
const sw={last:null,lastKey:'',pendKey:'',pendAt:0};
function swSnap(){const b={};for(const k of SETTING_KEYS)b[k]=brush[k];return {b,preset:activePreset,fg:ui.fg.slice(),bg:ui.bg?ui.bg.slice():null};}
function swKey(s){return JSON.stringify([s.b,s.preset&&s.preset.name,s.fg,s.bg],(k,v)=>k==='tip'&&v?(v.name||'tip'):v);}
function swRebase(){sw.last=null;sw.pendKey='';}
function swPut(s){for(const k of SETTING_KEYS)brush[k]=s.b[k];activePreset=s.preset;ui.fg=s.fg.slice();if(s.bg)ui.bg=s.bg.slice();
  if(typeof setFG==='function')setFG(ui.fg);else if(typeof refreshColor==='function')refreshColor();tbSaveCur();sw.last=swSnap();sw.lastKey=swKey(sw.last);sw.pendKey='';tbDocRefresh();}
function swTick(){if(!prefs.undoSettings){sw.last=null;return;}
  if(typeof stroke!=='undefined'&&stroke)return;if(typeof ptr!=='undefined'&&ptr)return;
  const now=performance.now(),snap=swSnap(),key=swKey(snap);
  if(!sw.last){sw.last=snap;sw.lastKey=key;sw.pendKey='';return;}
  if(key===sw.lastKey){sw.pendKey='';return;}
  if(sw.pendKey!==key){sw.pendKey=key;sw.pendAt=now;return;}
  if(now-sw.pendAt<700)return;
  const before=sw.last,after=snap,onlyColour=JSON.stringify(before.b)===JSON.stringify(after.b)&&before.preset===after.preset;
  sw.last=after;sw.lastKey=key;sw.pendKey='';
  pushUndo({label:onlyColour?'Colour':'Brush settings',refs:[],undo(){swPut(before);},redo(){swPut(after);}});}
setInterval(swTick,300);
