/* ================= Saving without running out of memory (0.98.16, Georgian: "crashed during autosaving") =================
   Georgian's report: page memory 3725 of 4192 MB before the autosave of an 8192×4096 3D Paint project, which then read 3.5 GB of
   pictures back. The page has a hard memory ceiling (about 4 GB in WebView2); going over it ends the app at once.
   - autosave does not start when the page's memory is already high: it says so and waits (a manual save can still be asked for)
   - texture sets that have not been open since the last save reuse that save's copy (p3-project.js S._enc), so an autosave in a
     project with many sets reads back only the set being painted; the copy is dropped as soon as a set is opened or changed */
const SG_HIGH=.72;/* share of the page's memory ceiling above which autosave waits */
function sgHeap(){const m=performance.memory;return m&&m.jsHeapSizeLimit?{used:m.usedJSHeapSize,lim:m.jsHeapSizeLimit}:null;}
function sgHigh(){const h=sgHeap();return !!h&&h.used>h.lim*SG_HIGH;}
let sgSaid=0;
{const f=autosaveNow;autosaveNow=async function(force){if(sgHigh()){const now=Date.now();if(now-sgSaid>600000){sgSaid=now;const h=sgHeap();
      toast('Autosave is waiting: the app’s memory is nearly full ('+Math.round(h.used/1048576)+' of '+Math.round(h.lim/1048576)+' MB). Save with Ctrl+S, then restart the app to free it.',12000);
      if(typeof gpuLogAdd==='function')gpuLogAdd('autosave waited: page memory high');}
    return false;}
  return f.apply(this,arguments);};}
/* a set's saved copy stays valid only while the set is not open */
const sgEncDrop=S=>{if(S)delete S._enc;};
{const f=p3SwitchSet;p3SwitchSet=function(i){sgEncDrop(p3.sets[p3.cur]);sgEncDrop(p3.sets[i]);return f.apply(this,arguments);};}
{const f=p3InSet;p3InSet=function(i){sgEncDrop(p3.sets[i]);return f.apply(this,arguments);};}
