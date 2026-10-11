/* ================= Undo for layer settings (0.57) =================
   Kenn: "when you undo it does it for any action the user does, such as hiding layers". With Preferences › Undo also covers settings, showing and hiding
   layers (also by dragging down the eyes), locking, renaming, opacity, blend mode, clipping and the mask switch are undo steps too. The layers are looked at
   twice a second; a change that has stopped for half a second becomes one step, and one still waiting becomes its step before any other step is made
   (history.js calls luFlush), so steps stay in order. A change in the layers' number (added, deleted, merged) is left to the steps that do that. */
const LU_KEYS=['visible','opacity','mode','clip','lockAlpha','lockPx','lockPos','lockAll','name'];
const lu={last:null,sig:'',pendKey:'',pendAt:0,busy:false};
const luSig=()=>hist.undo.length+':'+hist.redo.length+':'+(hist.undo.length?hist.undo[hist.undo.length-1].label:'');
function luSnap(){const m=new Map();for(const n of (typeof allNodes==='function'?allNodes():[])){const o={};for(const k of LU_KEYS)o[k]=n[k];if(n.mask)o.maskOn=n.mask.enabled;m.set(n,o);}return m;}
/* what changed since the last look: null when layers came or went */
function luDiff(a,b){if(a.size!==b.size)return null;const out=[];for(const [n,o] of b){const p=a.get(n);if(!p)return null;for(const k of Object.keys(o))if(p[k]!==o[k])out.push({n,k,before:p[k],after:o[k]});}return out;}
function luLabel(list){const ks=new Set(list.map(c=>c.k)),nodes=new Set(list.map(c=>c.n));
  if(ks.size===1){const k=[...ks][0],many=nodes.size>1,nm=many?nodes.size+' layers':'“'+[...nodes][0].name+'”';
    if(k==='visible')return (list[0].after?'Show ':'Hide ')+nm;if(k==='opacity')return 'Opacity of '+nm;if(k==='mode')return 'Blend mode of '+nm;if(k==='name')return 'Rename layer';
    if(k==='clip')return 'Clip '+nm;if(k==='maskOn')return 'Mask switch of '+nm;if(k.startsWith('lock'))return 'Lock '+nm;}
  return 'Layer settings';}
function luPut(list,which){for(const c of list){const v=c[which];if(c.k==='maskOn'){if(c.n.mask)c.n.mask.enabled=v;}else c.n[c.k]=v;}
  lu.last=luSnap();lu.sig=luSig();lu.pendKey='';if(typeof renderLayers==='function')renderLayers();if(typeof requestRender==='function')requestRender(true);}
/* look now; force = make a waiting change its step at once */
function luLook(force){if(typeof prefs==='undefined'||!prefs.undoSettings){lu.last=null;return;}if(lu.busy)return;
  if((typeof stroke!=='undefined'&&stroke)||(typeof ptr!=='undefined'&&ptr))return;
  const snap=luSnap();if(!lu.last){lu.last=snap;lu.sig=luSig();return;}
  const s=luSig();if(s!==lu.sig){lu.last=snap;lu.sig=s;lu.pendKey='';return;}/* another step moved history: start from here */
  const d=luDiff(lu.last,snap);if(d===null){lu.last=snap;lu.pendKey='';return;}if(!d.length){lu.pendKey='';return;}
  const key=JSON.stringify(d.map(c=>[c.k,c.after,c.n.name]));
  if(!force){const now=performance.now();if(lu.pendKey!==key){lu.pendKey=key;lu.pendAt=now;return;}if(now-lu.pendAt<500)return;}
  lu.busy=true;try{const label=luLabel(d);lu.last=snap;lu.pendKey='';
    pushUndo({label,refs:d.map(c=>c.n),undo(){luPut(d,'before');},redo(){luPut(d,'after');}});lu.sig=luSig();}finally{lu.busy=false;}}
const luFlush=()=>luLook(true);
setInterval(()=>luLook(false),300);
