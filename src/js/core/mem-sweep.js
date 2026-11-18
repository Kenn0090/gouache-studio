/* ================= Work pictures of documents set aside (0.98.16, Georgian's 8K crashes) =================
   Every document keeps four work pictures per colour depth for painting (stroke, before, scratch and preview) plus spare pictures,
   each as big as the canvas: about 0.5 GB per document at 8192×4096 for 8-bit, twice that again for 16-bit maps. A document that is
   set aside (the texture sets not being painted, the Paint document while in 3D Paint, other document tabs, the Bake and Convert
   documents) kept all of them. They are scratch pictures, so a sweep releases them a few seconds after a document is set aside; they
   are made again (blank) when the document comes back. The live document is never touched. */
function auxReleaseState(st){if(!st||!st.aux)return 0;let freed=0;
  for(const d in st.aux){const a=st.aux[d];if(!a||a===aux[d])continue;/* shared with the live document: leave it */
    for(const k of ['strokeT','beforeT','scratchT','previewT'])if(a[k]&&a[k].tex){freed+=gpuBytes(a[k]);disposeTarget(a[k]);a[k]=null;}
    if(a.pool){for(const t of a.pool.free)if(t.tex){freed+=gpuBytes(t);disposeTarget(t);}a.pool.free=[];a.pool.all=a.pool.all.filter(t=>t.tex);}}
  return freed;}
function auxStashes(){const out=[];
  try{if(typeof p3!=='undefined'&&p3.sets)p3.sets.forEach((S,i)=>{if(S&&S.state&&!(ui.mode==='p3d'&&i===p3.cur))out.push(S.state);});}catch(e){}
  try{if(tabDocs.paint)out.push(tabDocs.paint);for(const k in tabDocs.own||{})if(tabDocs.own[k])out.push(tabDocs.own[k]);}catch(e){}
  try{for(const t of dtab.tabs||[])if(t&&t.state)out.push(t.state);}catch(e){}
  return out;}
function auxSweep(){if(window.__noSweep)return 0;if(typeof stroke!=='undefined'&&stroke)return 0;if(typeof gfSaving!=='undefined'&&gfSaving)return 0;if(typeof tabDocs!=='undefined'&&tabDocs.hold)return 0;
  if(typeof gpuHealth!=='undefined'&&gpuHealth.lost)return 0;let freed=0;for(const st of auxStashes())freed+=auxReleaseState(st);return freed;}
setInterval(()=>{try{auxSweep();}catch(e){console.warn('work picture sweep',e);}},4000);
