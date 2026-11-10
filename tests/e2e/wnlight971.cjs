/* 0.97.1 (Kenn: "generators like Light should use the world-space baked input"): with a baked world-space normal on the set,
   the Light generator (and the Direction row) follow it instead of the model's smooth normals. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 await p.evaluate(()=>__gs.useModel(__gs.primMesh('sphere',1)));await W(600);
 /* a light from +X */
 const spread=async()=>p.evaluate(()=>{const G=__gs,L=G.doc.active;G.msUpdate(L);const t=L.mask.target,d=G.captureRegionNow(t,0,0,t.w,t.h).data;let lo=255,hi=0,n=0,s=0;
   for(let i=0;i<d.length;i+=4){const a=G.v3&&d[i];if(a<lo)lo=a;if(a>hi)hi=a;s+=a;n++;}return {lo,hi,mean:Math.round(s/n)};});
 await p.evaluate(()=>{const G=__gs;G.cmdAddLayer();const L=G.doc.active;G.msAdd(L,'gen',{p:Object.assign(G.msGenDefaults('light'),{lightAz:90,lightEl:0,width:0,occlude:0})});G.msEpoch&&0;});await W(400);
 const a=await spread();
 ok(a.hi-a.lo>150,'without a baked world normal the light falls off across the sphere '+JSON.stringify(a));
 /* a baked world normal pointing at +X everywhere: the whole surface faces the light */
 await p.evaluate(()=>{const G=__gs,t=G.makeTarget(G.doc.w,G.doc.h,8,false);G.clearTarget(t,[1,.5,.5,1]);G.doc.meshMaps=G.doc.meshMaps||{};G.doc.meshMaps.wnormal=t;G.p3MeshMapsChanged&&G.p3MeshMapsChanged();});await W(400);
 const c=await spread();
 ok(c.lo>200,'with it the Light generator follows the baked normal (lit everywhere) '+JSON.stringify(c));
 /* pointing away: dark everywhere */
 await p.evaluate(()=>{const G=__gs,t=G.makeTarget(G.doc.w,G.doc.h,8,false);G.clearTarget(t,[0,.5,.5,1]);G.doc.meshMaps.wnormal=t;G.p3MeshMapsChanged();});await W(400);
 const d=await spread();
 ok(d.hi<60,'and turning the baked normal away darkens it '+JSON.stringify(d));
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
