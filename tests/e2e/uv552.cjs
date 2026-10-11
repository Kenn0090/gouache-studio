/* 0.55.2: the Artist style unwrap: fewer, bigger, straighter pieces than Balanced, valid layout, picked from the Style list. */
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
   for(const kind of ['sphere','rcube']){const m=G.primMesh(kind,2),src=Object.assign({},m,{noUV:true,uv:null});
     for(const k of ['balanced','artist']){const nm=await G.uvRunUnwrap(src,Object.assign({},G.uwPresetOpts(k),{seed:1}),true),an=G.uwAnalyze(nm);out[kind+'_'+k]={islands:an.islands,overlap:an.overlapPct,outside:an.outsidePct,util:nm.uvAuto&&nm.uvAuto.util};}}
   return out;});
 for(const kind of ['sphere','rcube']){const a=r[kind+'_artist'],bl=r[kind+'_balanced'];
   ok(a.islands>=1&&a.islands<=bl.islands,kind+': Artist style makes no more pieces than Balanced ('+a.islands+' vs '+bl.islands+')');
   ok(a.overlap<1&&a.outside<1,kind+': the Artist layout has no overlaps and stays inside the square ('+a.overlap.toFixed(2)+'% overlap)');}
 // picking it in the list
 await p.evaluate(async()=>{const G=__gs,m=G.primMesh('sphere',2),src=Object.assign({},m,{noUV:true,uv:null});const nm=await G.uvRunUnwrap(src,{seed:1},true);G.bakeSetModel('low',nm);G.uvw.open=true;G.buildBakePanel();});await p.waitForTimeout(800);
 const opts=await p.evaluate(()=>[...document.querySelectorAll('#uvPreset option')].map(o=>o.textContent));
 ok(opts.includes('Artist style'),'the Style list has Artist style ('+opts.join(', ')+')');
 await p.selectOption('#uvPreset','artist');await p.waitForFunction(()=>!__gs.uvw.busy&&__gs.bakeCfg.low.uwOpt&&__gs.bakeCfg.low.uwOpt.preset==='artist',null,{timeout:60000});
 const o=await p.evaluate(()=>{const O=__gs.bakeCfg.low.uwOpt;return {artist:O.artist,straighten:O.straighten,angle:O.angle};});
 ok(o.artist&&o.straighten&&o.angle===89,'choosing it sets the Artist style options ('+JSON.stringify(o)+')');
 await p.selectOption('#uvPreset','organic');await p.waitForFunction(()=>!__gs.uvw.busy&&__gs.bakeCfg.low.uwOpt.preset==='organic',null,{timeout:60000});
 ok(await p.evaluate(()=>!__gs.bakeCfg.low.uwOpt.artist),'and going back to another style turns them off');
 ok(!errs.length,'no errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
