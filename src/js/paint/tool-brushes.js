/* ================= Each painting tool keeps its own brush (0.25) =================
   Brush, Eraser, Blend, Dodge/Burn, Healing and Clone each remember their own brush and settings (size,
   opacity, tip, spacing, jitter…), so switching tools no longer carries one brush across. With "All tools share
   the brush tip" on, the tip (and its angle, roundness and flips) stays the same across tools while the other
   settings stay per tool. Kept on this computer between sessions (the tip by name). */
const TB_TOOLS=['brush','erase','smudge','dodge','heal','clone'];
const TB_TIP=['tip','angle','roundness','flipX','flipY'];
const tbGroup=t=>t==='burn'?'dodge':t;
const toolBrush={cur:'brush',slots:{},share:false};
try{const s=JSON.parse(localStorage.getItem('gs.toolBrush')||'{}');toolBrush.share=!!s.share;for(const k in s.slots||{})if(TB_TOOLS.includes(k))toolBrush.slots[k]=s.slots[k];}catch(e){}
function tbStore(){try{const slots={};for(const k in toolBrush.slots){const o=Object.assign({},toolBrush.slots[k]);o.tipName=o.tip?o.tip.name:(o.tipName||null);delete o.tip;o.presetName=o.preset?o.preset.name:(o.presetName||null);delete o.preset;slots[k]=o;}
  localStorage.setItem('gs.toolBrush',JSON.stringify({share:toolBrush.share,slots}));}catch(e){}}
function tbSnap(){const o={};for(const k of SETTING_KEYS)o[k]=brush[k];o.preset=activePreset;return o;}
/* a saved tip, found again by name in the brush library */
function tbFindTip(name){if(!name)return null;for(const set of library){for(const p of set.presets||[])if(p.tip&&p.tip.name===name)return p.tip;for(const t of set.tips||[])if(t&&t.name===name)return t;}return null;}
function tbFindPreset(name){if(!name)return null;for(const set of library)for(const p of set.presets||[])if(p.name===name)return p;return null;}
function tbSaveCur(){const c=toolBrush.cur;if(TB_TOOLS.includes(c))toolBrush.slots[c]=tbSnap();}
/* called by setTool: put away the old tool's brush, bring out the new one's */
function tbSwitch(t,keepPreset){const g=tbGroup(t);if(!TB_TOOLS.includes(g))return;
  if(keepPreset){toolBrush.cur=g;return;}/* a preset was just applied: it belongs to the new tool */
  if(g===toolBrush.cur)return;tbSaveCur();toolBrush.cur=g;const S=toolBrush.slots[g];
  if(S){const keep={};if(toolBrush.share)for(const k of TB_TIP)keep[k]=brush[k];
    for(const k of SETTING_KEYS)if(k in S)brush[k]=S[k];else brush[k]=BRUSH_DEFAULTS[k];
    if(!('tip' in S)||S.tip===undefined)brush.tip=S.tipName?tbFindTip(S.tipName):null;
    activePreset=S.preset!==undefined?S.preset:tbFindPreset(S.presetName);
    if(toolBrush.share)Object.assign(brush,keep);if(typeof renderLibrary==='function')renderLibrary();}
  tbStore();}
function tbSetShare(v){toolBrush.share=!!v;tbStore();}
window.addEventListener('beforeunload',()=>{tbSaveCur();tbStore();});
