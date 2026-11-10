/* ================= Bake log (0.97, Kenn: like Painter's Baking log) =================
   The last section of the Bake panel: what the groups matched by name (and what found no partner), and a line per bake:
   when, which maps, how long, finished or cancelled. Kept for this run of the app only. */
const bkLog={list:[]};
function bkLogAdd(text,kind){bkLog.list.unshift({t:new Date(),text,kind:kind||''});if(bkLog.list.length>30)bkLog.list.length=30;const b=document.getElementById('bkLogList');if(b)b.replaceWith(bkLogList());}
function bkLogList(){const L=el('div',{class:'bklogl',id:'bkLogList'});if(!bkLog.list.length)L.append(el('p',{class:'note',text:'Each bake adds a line here: which maps, how long it took.'}));
  for(const e of bkLog.list){const hh=String(e.t.getHours()).padStart(2,'0'),mm=String(e.t.getMinutes()).padStart(2,'0');L.append(el('div',{class:'bklogrow'+(e.kind?' '+e.kind:'')},el('span',{class:'bklogt',text:hh+':'+mm}),el('span',{text:e.text})));}
  return L;}
/* what each group pairs up, and parts left without a partner */
function bkMatchLines(){const C=bakeCfg,out=[];if(!C.high)return [el('p',{class:'note',text:'No high-poly: the low-poly is baked on its own (AO, curvature, thickness and the like).'})];
  if(bgCfg().groupMode!=='tree')return [];const T=btSync(),lp=btParts('low'),hp=btParts('high');
  for(const g of T.groups){const l=lp.filter(p=>T.low[p]===g.id),h=hp.filter(p=>T.high[p]===g.id);if(!l.length&&!h.length)continue;
    const warn=g.skip?'':!h.length?' — no high-poly parts: it bakes from nothing':!l.length?' — no low-poly parts: its high-poly is not used':'';
    out.push(el('div',{class:'bklogrow'+(warn?' warn':'')+(g.skip?' dim':'')},el('span',{class:'bklogsw',style:'background:'+g.col}),el('span',{text:g.name+': '+l.length+' low · '+h.length+' high'+(g.skip?' (not baked)':'')+warn})));}
  return out;}
function bkLogPanel(){return el('div',{class:'bklog',id:'bkLog'},el('div',{class:'sub',text:'Matching'}),...bkMatchLines(),el('div',{class:'sub',text:'Bakes'}),bkLogList());}
/* every bake leaves a line */
{const f=runBake;runBake=async function(L,ks,opt){const t0=performance.now(),names=(ks||[]).map(k=>BAKE_NAMES[k]||k).join(', '),was=bk.busy;let r;
  try{r=await f.apply(this,arguments);}catch(e){bkLogAdd('Failed: '+(e&&e.message||e),'warn');throw e;}
  if(!was){const s=((performance.now()-t0)/1000),cancelled=bk.prog&&bk.prog.cancelled;bkLogAdd((cancelled?'Cancelled ':'Baked ')+names+(bk.byMat&&bk.matShow?' ('+bk.matShow+')':'')+' at '+doc.w+(doc.h!==doc.w?'×'+doc.h:'')+' px in '+(s<10?s.toFixed(1):Math.round(s))+' s',cancelled?'warn':'');}
  return r;};}
