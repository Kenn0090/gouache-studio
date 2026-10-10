/* 0.55: the fun part of the UV review: stretch colours, live seam angle, the dice gallery, unfold. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1600,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:40000});
 await p.click('#modeTabs [data-mode=bake]');await p.waitForTimeout(1200);
 // a sphere without UVs, unwrapped and made the low-poly
 await p.evaluate(async()=>{const G=__gs,m=G.primMesh('sphere',0),src=Object.assign({},m,{noUV:true});const nm=await G.uvRunUnwrap(src,{seed:1},true);G.bakeSetModel('low',nm);G.uvw.open=true;G.buildBakePanel();});await p.waitForTimeout(800);
 // ---- stretch numbers
 const met=await p.evaluate(()=>{const G=__gs,m=G.bakeCfg.low,M=G.uvMetrics(m);let mx=0,sum=0;for(const s of M.str){mx=Math.max(mx,s);sum+=s;}
   const bad=Object.assign({},m,{uv:Float32Array.from(m.uv,(v,i)=>i%2?v:v*3),_uvMet:null});const B=G.uvMetrics(bad);let bs=0;for(const s of B.str)bs+=s;return {avg:sum/M.str.length,mx,badAvg:bs/B.str.length,med:M.med};});
 ok(met.avg<1.6,'a fresh unwrap is mostly un-stretched (average stretch '+met.avg.toFixed(2)+')');
 ok(met.badAvg>met.avg*1.8,'squeezing the UVs makes the stretch number jump ('+met.avg.toFixed(2)+' → '+met.badAvg.toFixed(2)+')');
 // ---- colours: good areas are green, bad ones red
 const col=await p.evaluate(()=>{const G=__gs,m=G.bakeCfg.low,bad=Object.assign({},m,{uv:Float32Array.from(m.uv,(v,i)=>i%2?v:v*3),_uvMet:null});
   const avg=(mm)=>{const c=G.uvHeatCanvas(mm,'stretch',128,false),d=c.getContext('2d').getImageData(0,0,128,128).data;let r=0,g=0,bl=0,n=0;for(let i=0;i<d.length;i+=4){if(d[i]+d[i+1]+d[i+2]>120&&!(d[i]===23&&d[i+1]===24)){r+=d[i];g+=d[i+1];bl+=d[i+2];n++;}}return [r/n,g/n,bl/n];};return {good:avg(m),bad:avg(bad)};});
 ok(col.good[1]>col.good[0],'stretch colours: a good layout is greener than red ('+col.good.map(Math.round)+')');
 ok(col.bad[0]>col.good[0]+20,'and a stretched one turns red ('+col.bad.map(Math.round)+')');
 // ---- on the model
 const px=()=>p.evaluate(()=>{const a=__gs.v3Offscreen(96,96,{transparent:true});let r=0,g=0,bl=0,n=0;for(let i=0;i<a.length;i+=4)if(a[i+3]>0){r+=a[i];g+=a[i+1];bl+=a[i+2];n++;}return n?[r/n,g/n,bl/n,n]:[0,0,0,0];});
 const off=await px();
 await p.evaluate(()=>{__gs.uvw.view='stretch';__gs.uvViewSync();});await p.waitForTimeout(1200);const st=await px();
 ok(st[3]>100&&(Math.abs(st[0]-off[0])+Math.abs(st[1]-off[1])+Math.abs(st[2]-off[2]))>15,'the stretch colours show on the model ('+off.slice(0,3).map(Math.round)+' → '+st.slice(0,3).map(Math.round)+')');
 await p.evaluate(()=>{__gs.uvw.view='check';__gs.uvViewSync();});await p.waitForTimeout(1200);const ck=await px();
 ok(Math.abs(ck[0]-st[0])+Math.abs(ck[1]-st[1])>15,'and the checker is a different picture');
 await p.evaluate(()=>{__gs.uvw.view='off';__gs.uvViewSync();});
 // ---- live seam angle
 const live=await p.evaluate(async()=>{const G=__gs,a0=G.bakeCfg.low.uvAuto.charts;G.uvLive({angle:35});G.uvLive({angle:40});await new Promise(r=>setTimeout(r,2500));const m=G.bakeCfg.low;return {a0,a1:m.uvAuto.charts,angle:m.uwOpt.angle};});
 ok(live.angle===40&&live.a1>live.a0,'dragging the seam angle re-cuts live: pieces '+live.a0+' → '+live.a1+' at '+live.angle+'°');
 // ---- dice gallery
 await p.evaluate(()=>{__gs.uvw.open=true;__gs.buildBakePanel();});await p.waitForTimeout(500);
 await p.click('#uvDice');await p.waitForFunction(()=>!__gs.uvw.busy&&__gs.uvw.gal.length>0,null,{timeout:60000});await p.waitForTimeout(500);
 const gal=await p.evaluate(()=>({n:__gs.uvw.gal.length,utils:__gs.uvw.gal.map(g=>+g.util.toFixed(2)),tiles:document.querySelectorAll('#uvGallery .uvdie').length,best:document.querySelectorAll('#uvGallery .uvdie.best').length}));
 ok(gal.n===12&&gal.tiles===12,'rolling gives 12 layouts shown as tiles ('+gal.utils.join(', ')+')');
 ok(gal.best>=1,'the tightest one is marked best');
 await p.click('#uvGallery .uvdie:nth-child(3) .uvpin');await p.waitForTimeout(500);
 ok(await p.evaluate(()=>__gs.uvw.gal.filter(g=>g.pin).length)===1,'a layout can be pinned');
 await p.click('#uvDice');await p.waitForFunction(()=>!__gs.uvw.busy&&__gs.uvw.gal.length>12,null,{timeout:60000});
 ok(await p.evaluate(()=>__gs.uvw.gal.length)===13&&await p.evaluate(()=>__gs.uvw.gal[0].pin===true),'rolling again keeps the pinned one first (13 tiles)');
 const before=await p.evaluate(()=>JSON.stringify(Array.from(__gs.bakeCfg.low.uv.slice(0,30))));
 await p.click('#uvGallery .uvdie:nth-child(5) .uvdiepic');await p.waitForFunction(()=>!__gs.uvw.busy,null,{timeout:20000});await p.waitForTimeout(500);
 ok(await p.evaluate(()=>JSON.stringify(Array.from(__gs.bakeCfg.low.uv.slice(0,30))))!==before,'clicking a tile uses that layout on the model');
 // ---- unfold
 const f0=await px();
 await p.evaluate(()=>{__gs.uvFoldSet(1);});await p.waitForTimeout(1000);const f1=await px();
 await p.evaluate(()=>{__gs.uvFoldSet(.5);});await p.waitForTimeout(1000);const fh=await px();
 ok(f1[3]>0&&Math.abs(f1[3]-f0[3])>150,'unfolded, the model has turned into a flat layout (covered pixels '+f0[3]+' → '+f1[3]+')');
 ok(fh[3]<f0[3]-150,'half way is something in between ('+fh[3]+')');
 await p.evaluate(()=>{__gs.uvFoldSet(0);});await p.waitForTimeout(800);const f2=await px();
 ok(Math.abs(f2[3]-f0[3])<40,'and it folds back ('+f2[3]+' vs '+f0[3]+')');
 // Play moves it by itself
 await p.evaluate(()=>{__gs.uvFoldPlay();});await p.waitForTimeout(900);const mid=await p.evaluate(()=>__gs.bk.fold);await p.evaluate(()=>{__gs.uvFoldPlay();});
 ok(mid>0.05,'Play unfolds on its own (fold '+mid.toFixed(2)+')');
 // two materials side by side
 const two=await p.evaluate(async()=>{const G=__gs,m=G.bakeCfg.low,T=m.idx.length/3,tm=new Uint8Array(T);for(let t=0;t<T;t++)tm[t]=t%2;const mm=Object.assign({},m,{triMat:tm,matNames:['A','B'],setRanges:null});G.bakeSetModel('low',mm);await new Promise(r=>setTimeout(r,500));G.uvFoldSet(1);await new Promise(r=>setTimeout(r,800));return true;});
 ok(errs.length===0,'no page errors '+errs.slice(0,2));
 await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
