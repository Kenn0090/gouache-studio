/* ================= Library pictures kept by name (0.98) =================
   Kenn: smaller 3D projects and faster loading. A material layer used to be stored twice over: every channel drawn out at
   the document's size (only so that old versions could open the file), and a full copy of each of the material's own
   pictures. Now a file keeps the material's settings, and for a picture that came from the Library only the Library
   material's name; the pictures are fetched from the Library when the file opens, and the channels are drawn again.
   Preferences › Memory and disk › "Keep every picture inside saved files" writes the old, self-contained file. */
const gfKeepPics=()=>prefs.keepPics===true;
/* what a material picture says about where it came from: a bundled Library material (_lib, its file name without .gmat)
   or the 2K / 4K download of one (_libDl {aid,res}) */
function lrRefOf(t){if(!t)return null;if(t._lib)return {lib:t._lib};if(t._libDl&&t._libDl.aid)return {dl:{aid:t._libDl.aid,res:t._libDl.res}};return null;}
function lrTag(to,from){if(from._lib)to._lib=from._lib;if(from._libDl)to._libDl=from._libDl;return to;}
const lrCache=new Map(),lrNote={miss:new Set(),low:new Set(),timer:0};let lrTimer=0;
/* one Library material's pictures, decoded once for every layer and texture set that uses it while a file opens */
function lrImgs(key,load){if(!lrCache.has(key))lrCache.set(key,load().catch(e=>{console.warn('library picture',key,e);return null;}));
  clearTimeout(lrTimer);lrTimer=setTimeout(()=>lrCache.clear(),45000);return lrCache.get(key);}
const lrBundledRec=slug=>gmRecs.find(r=>r.bundled&&r.bundled.file===slug+'.gmat');
function lrBundled(slug){const rec=lrBundledRec(slug);if(!rec)return Promise.resolve(null);return lrImgs('s:'+slug,async()=>gmatImgs(await gmatParse(await gmFetch(rec.bundled.file))));}
async function lrDl(aid){if(!matLib.loaded)matLoad();for(let i=0;i<200&&!(matLib.list&&dlLib.list);i++)await new Promise(r=>setTimeout(r,25));
  const rec=(dlLib.list||[]).find(r=>r.dl&&r.dl.aid===aid);if(!rec)return null;
  return lrImgs('d:'+aid,async()=>{const raw=await store.getRaw(rec.id,'materials');if(!raw)return null;return (await pxDeep(raw,false)).imgs||null;});}
/* the picture for channel k of a saved reference, as a graphics-card picture carrying the same tag (so saving again keeps
   the reference even when the Library copy could not be found and a plain stand-in is shown) */
async function lrPicture(r,k){let imgs=null,name=r.lib||(r.dl&&r.dl.aid)||'?';
  if(r.dl){imgs=await lrDl(r.dl.aid);
    if(!imgs){const rec=gmRecs.find(x=>olIdOf(x.credit)===r.dl.aid);if(rec){imgs=await lrBundled(rec.bundled.file.slice(0,-5));if(imgs)lrNote.low.add(rec.name);name=rec.name;}}}
  else if(r.lib){imgs=await lrBundled(r.lib);const rec=lrBundledRec(r.lib);if(rec)name=rec.name;}
  const im=imgs&&imgs[k];let t;
  if(im){t=makeTarget(im.w,im.h,8,true);writeRegion(t,0,0,im.w,im.h,im.data);}
  else{t=makeTarget(4,4,8,true);clearTarget(t,k==='normal'?[.5,.5,1,1]:[.5,.5,.5,1]);lrNote.miss.add(name);}
  if(r.lib)t._lib=r.lib;if(r.dl)t._libDl={aid:r.dl.aid,res:r.dl.res};
  if(lrNote.miss.size||lrNote.low.size){clearTimeout(lrNote.timer);lrNote.timer=setTimeout(lrTell,1200);}
  return t;}
function lrTell(){const miss=[...lrNote.miss],low=[...lrNote.low];lrNote.miss.clear();lrNote.low.clear();const list=a=>a.slice(0,4).join(', ')+(a.length>4?' and '+(a.length-4)+' more':'');
  if(miss.length)toast('This file uses Library materials that are not on this computer yet ('+list(miss)+'). They show as plain grey until the Library is here: connect to the internet and open the file again, or get them in File › Content.');
  else if(low.length)toast('This file was made with the 2K / 4K Library ('+list(low)+'). This computer has the 1K pictures, so those materials look a little softer. File › Content downloads the larger ones.');}
