/* ================= Performance monitor (View › Performance monitor) =================
   Shows frame rate and the slowest recent moment with what it was doing, so a hitch can be
   described precisely ("composite 180 ms with 14 layers at 4096"). */
const perfBox=el('div',{class:'perfbox',hidden:true,'aria-live':'off'});document.body.append(perfBox);
let perfLong=[];
const perfGpu={ext:gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending:[],samples:[]};
function perfGpuBegin(){const G=perfGpu;if(!G.ext||G.pending.length>=4)return null;const q=gl.createQuery();gl.beginQuery(G.ext.TIME_ELAPSED_EXT,q);return q;}
function perfGpuEnd(q){gl.endQuery(perfGpu.ext.TIME_ELAPSED_EXT);perfGpu.pending.push(q);}
function perfGpuPoll(){const G=perfGpu;if(!G.ext)return;const bad=gl.getParameter(G.ext.GPU_DISJOINT_EXT),keep=[];
  for(const q of G.pending){if(bad||gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(!bad)G.samples.push({t:performance.now(),ms:gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6});gl.deleteQuery(q);}else keep.push(q);}
  G.pending=keep;if(bad)G.samples=[];else G.samples=G.samples.filter(s=>s.t>performance.now()-10000);}
try{new PerformanceObserver(l=>{for(const e of l.getEntries())perfLong.push({t:performance.now(),ms:e.duration});}).observe({entryTypes:['longtask']});}catch(e){}
function perfFrame(t0,comp,viewMs,thumbs){const now=performance.now();perf.frames.push({t:now,dt:perf.last?now-perf.last:0,comp,view:viewMs,thumbs,stroke:!!stroke,view2:doc.view});perf.last=now;
  const cut=now-10000;perf.frames=perf.frames.filter(f=>f.t>cut);perfLong=perfLong.filter(f=>f.t>cut);}
function perfUpdate(){perfGpuPoll();if(!perf.on)return;const F=perf.frames,now=performance.now();
  const recent=F.filter(f=>f.t>now-1000),fps=recent.length,work=recent.length?recent.reduce((s,f)=>s+f.comp+f.view+f.thumbs,0)/recent.length:0;
  const w=F.reduce((a,f)=>!a||f.comp+f.view+f.thumbs>a.comp+a.view+a.thumbs?f:a,null),lt=perfLong.reduce((a,f)=>Math.max(a,f.ms),0);
  const layers=allLayers().length,maps=doc.maps.length,G=gpuMemory(),S=gfSaveStats.last,gs=perfGpu.samples;
  perfBox.textContent=[fps+' fps · '+work.toFixed(1)+' ms work per frame',
    'Slowest frame (10 s): '+(w?(w.comp+w.view+w.thumbs).toFixed(0)+' ms — composite '+w.comp.toFixed(0)+', view '+w.view.toFixed(0)+', thumbs '+w.thumbs.toFixed(0)+(w.stroke?' (painting)':''):'—'),
    'Longest freeze (10 s): '+(lt?lt.toFixed(0)+' ms':'none'),
    doc.w+'×'+doc.h+' '+doc.depth+'-bit · '+layers+' layers · '+maps+' map'+(maps>1?'s':'')+' · view '+doc.view,
    'Memory: undo '+fmtBytes(hist.undo.reduce((s,r)=>s+recBytes(r),0))+(platform.isDesktop?' + '+fmtBytes(hist.undo.reduce((s,r)=>s+recDisk(r),0))+' on disk':'')+' · models '+fmtBytes(memModels())+' · limit '+fmtBytes(memLimit()),
    'Tracked textures: '+fmtBytes(G.bytes)+' · reusable scratch '+fmtBytes(G.spare)+' (driver/view buffers excluded)',
    'GPU frame: '+(!perfGpu.ext?'unavailable':gs.length?(gs.reduce((a,s)=>a+s.ms,0)/gs.length).toFixed(1)+' ms average · '+Math.max(...gs.map(s=>s.ms)).toFixed(1)+' ms slowest':'waiting for samples'),
    'Redraws: '+compStats.parts+' regions · '+compStats.full+' full · '+compStats.cacheHits+' cached groups',
    S?'Last save preparation: '+(S.total/1000).toFixed(2)+' s · crop '+(S.bounds/1000).toFixed(2)+' s · GPU read '+(S.read/1000).toFixed(2)+' s · pack '+(S.pack/1000).toFixed(2)+' s · '+S.images+' images':'Last save preparation: —'].join('\n');}
setInterval(perfUpdate,500);
function togglePerf(){perf.on=!perf.on;perfBox.hidden=!perf.on;perf.frames=[];perfLong=[];if(perf.on){perfUpdate();requestRender(true);}}
