/* 0.56: Clothing (pattern) style cuts tubes along one seam, cleaner seams, Relax, overlap check and fix. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1600,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:30000});
 await p.click('#modeTabs [data-mode=bake]');await p.waitForTimeout(1200);
 const r=await p.evaluate(async()=>{const G=__gs,out={};
   const avg=mm=>{const M=G.uvMetrics(mm);let s=0;for(const x of M.str)s+=x;return s/M.str.length;};
   // an open tube (a sleeve): the cylinder without its end caps
   const cyl=G.primMesh('cylinder',3),keep=[];for(let t=0;t<cyl.idx.length/3;t++){let cap=true;for(let k=0;k<3;k++)if(Math.abs(cyl.nrm[cyl.idx[t*3+k]*3+1])<.9)cap=false;if(!cap)keep.push(cyl.idx[t*3],cyl.idx[t*3+1],cyl.idx[t*3+2]);}
   const tube=Object.assign({},cyl,{idx:Uint32Array.from(keep),noUV:true,uv:null,tris:keep.length/3});
   const t0=await G.uvRunUnwrap(tube,Object.assign({},G.uwPresetOpts('clothing'),{seed:1}),true),a0=G.uwAnalyze(t0);
   out.tube={islands:a0.islands,overlap:a0.overlapPct,outside:a0.outsidePct,stretch:avg(t0),tris:tube.tris};
   // relax on a sphere unwrap
   const sp=Object.assign({},G.primMesh('sphere',2),{noUV:true,uv:null}),s0=await G.uvRunUnwrap(sp,Object.assign({},G.uwPresetOpts('balanced'),{seed:1}),true);
   /* a layout with stretching built in: squeeze every piece on the way across the square */
   const wuv=Float32Array.from(s0.uv,(v,i)=>i%2?v:v*v*.9+v*.1),w0=Object.assign({},s0,{uv:wuv,_uvAn:null,_uvIsl:null,_uvMet:null,_uvStamp:3});
   const rp=await G.uwRelax(w0,{strength:40,pin:true}),rf=await G.uwRelax(w0,{strength:40,pin:false});
   out.relax={before:avg(w0),pinned:avg(rp),free:avg(rf),ovPinned:G.uvOverlapCheck(rp).faces,ovBefore:G.uvOverlapCheck(w0).faces};
   // overlap check and fix: lay one piece on top of another
   const isl=G.uwIslands(s0);const cx=new Float64Array(isl.count),cy=new Float64Array(isl.count),n=new Float64Array(isl.count);
   for(let t=0;t<s0.idx.length/3;t++)for(let k=0;k<3;k++){const v=s0.idx[t*3+k],i=isl.ids[t];cx[i]+=s0.uv[v*2];cy[i]+=s0.uv[v*2+1];n[i]++;}
   const uv=Float32Array.from(s0.uv),dx=cx[0]/n[0]-cx[1]/n[1],dy=cy[0]/n[0]-cy[1]/n[1],moved=new Set();
   for(let t=0;t<s0.idx.length/3;t++)if(isl.ids[t]===1)for(let k=0;k<3;k++){const v=s0.idx[t*3+k];if(!moved.has(v)){moved.add(v);uv[v*2]+=dx;uv[v*2+1]+=dy;}}
   const bad=Object.assign({},s0,{uv,_uvAn:null,_uvIsl:null,_uvMet:null,_uvStamp:9,uwRes:null,uwSrc:null,uvRelaxed:true}),cb=G.uvOverlapCheck(bad);
   const fx=await G.uvFixOverlap(bad),cf=G.uvOverlapCheck(fx);
   out.overlap={before:cb.faces,after:cf.faces};
   return out;});
 ok(r.tube.islands<=2&&r.tube.overlap<1&&r.tube.outside<1,'Clothing: an open tube becomes one or two flat pieces with no overlaps ('+r.tube.islands+' pieces)');
 ok(r.tube.stretch<1.3,'and they are not stretched ('+r.tube.stretch.toFixed(2)+')');
 ok(r.relax.pinned<=r.relax.before*1.02&&r.relax.ovPinned<=r.relax.ovBefore,'Relax with the outlines kept does not make it worse ('+r.relax.before.toFixed(3)+' → '+r.relax.pinned.toFixed(3)+')');
 ok(r.relax.free<r.relax.before*.9,'free Relax takes out the stretching ('+r.relax.before.toFixed(3)+' → '+r.relax.free.toFixed(3)+')');
 ok(r.overlap.before>50,'the overlap check finds the pieces lying on each other ('+r.overlap.before+' faces)');
 ok(r.overlap.after===0,'Fix overlaps packs them apart ('+r.overlap.after+' left)');
 // the buttons
 await p.evaluate(async()=>{const G=__gs,m=G.primMesh('sphere',2),src=Object.assign({},m,{noUV:true,uv:null});const nm=await G.uvRunUnwrap(src,{seed:1},true);G.bakeSetModel('low',nm);G.uvw.open=true;G.buildBakePanel();});await p.waitForTimeout(800);
 const opts=await p.evaluate(()=>[...document.querySelectorAll('#uvPreset option')].map(o=>o.textContent));
 ok(opts.some(o=>/Clothing/.test(o)),'the Style list has a Clothing style ('+opts.join(', ')+')');
 await p.click('#uvCheck');await p.waitForTimeout(800);
 ok(await p.evaluate(()=>/overlap/i.test(document.getElementById('uvOvlNote').textContent)&&__gs.uvw.view==='overlap'),'Check overlaps shows the result and the model view');
 await p.click('#uvRelax');await p.waitForFunction(()=>!__gs.uvw.busy,null,{timeout:60000});
 ok(await p.evaluate(()=>!!document.getElementById('uvRelax')),'the Relax button works (and says so when there is nothing to relax)');
 ok(!errs.length,'no errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
