/* 0.98.19 (Kenn: "raytracing controls so we can adjust the graininess we need like a denoiser"): a Ray tracing panel with Samples, Light
   bounces, Denoiser, Firefly clamp and render size; the denoiser takes out the grain but keeps the picture's brightness. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(2000);
 await p.evaluate(()=>{const g=__gs;const s=g.v3s();s.model='sphere';g.v3.mesh=null;s.env='none';s.sunI=3;s.sunAz=-50;s.sunEl=30;s.envBg=false;s.rtSamples=4;s.rtDenoise=0;
   Object.assign(g.v3.cam,{yaw:0,pitch:0,dist:2.6,tx:0,ty:0,tz:0});g.v3.rt=true;g.v3.mapsDirty=true;g.v3.dirty=true;g.requestRender(true);});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.vpOpen('v3rt',document.getElementById('v3RtBtn')||document.body));await p.waitForTimeout(500);
 const ids=await p.evaluate(()=>['vpRtOn','vpRtSpp','vpRtBounces','vpRtDenoise','vpRtClamp','vpRtMove','vpRtStill'].filter(i=>document.getElementById(i)));
 ok(ids.length===7,'the Ray tracing panel has its controls ('+ids.join(', ')+')');
 const wait=async n=>{for(let i=0;i<200;i++){await p.waitForTimeout(300);const k=await p.evaluate(()=>{__gs.v3.dirty=true;__gs.requestRender(true);return __gs.rt.view?__gs.rt.view.n:0;});if(k>=n){await p.waitForTimeout(400);if(await p.evaluate(()=>__gs.rt.view.n)>=n)return;}}};
 await wait(4);
 await p.waitForTimeout(1500);await p.evaluate(()=>{__gs.v3.dirty=true;__gs.requestRender(true);});await p.waitForTimeout(800);await wait(4);
 const both=await p.evaluate(()=>{const g=__gs,S=g.rt.view,one=dn=>{g.v3s().rtDenoise=dn;const d=g.rtPixels(S,true),w=S.w,h=S.h;let m=0,nz=0,c=0;
   for(let y=Math.round(h*.35);y<h*.65;y++)for(let x=Math.round(w/2-h*.15);x<w/2+h*.15;x++){const i=(y*w+x)*4,l=d[i]+d[i+1]+d[i+2],r=d[i+4]+d[i+5]+d[i+6];m+=l;nz+=Math.abs(l-r);c++;}
   return {mean:m/c/3,noise:nz/c/3,w,h,n:S.n};};return [one(0),one(1)];});
 const raw=both[0],den=both[1];console.log('raw',JSON.stringify(raw),'denoised',JSON.stringify(den));
 ok(den.noise<raw.noise*.5,'the denoiser takes out most of the grain ('+raw.noise.toFixed(1)+' → '+den.noise.toFixed(1)+')');
 ok(Math.abs(den.mean-raw.mean)<raw.mean*.08,'and keeps the brightness ('+raw.mean.toFixed(1)+' / '+den.mean.toFixed(1)+')');
 const full=await p.evaluate(()=>__gs.rt.view.w);
 /* turning the view: traced at half size while it moves */
 const mv=await p.evaluate(()=>{const g=__gs;g.v3.cam.yaw+=.05;g.v3.dirty=true;g.requestRender(true);return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(g.rt.view.w))));});
 ok(Math.abs(mv-full/2)<=1,'while the view turns it traces at half size ('+mv+')');
 await p.waitForTimeout(900);await p.evaluate(()=>{__gs.v3.dirty=true;__gs.requestRender(true);});await p.waitForTimeout(500);
 ok(await p.evaluate(()=>__gs.rt.view.w)===full,'and at full size once it rests');
 await p.evaluate(()=>{__gs.v3s().rtStill=.5;__gs.v3.dirty=true;__gs.requestRender(true);});await p.waitForTimeout(800);await p.evaluate(()=>{__gs.v3.dirty=true;__gs.requestRender(true);});await wait(1);
 const half=await p.evaluate(()=>__gs.rt.view.w);ok(Math.abs(half-full/2)<=1,'"Size when still: Half" traces at half size ('+full+' → '+half+')');
 await p.evaluate(()=>{__gs.v3s().rtStill=1;__gs.v3s().rtBounces=2;__gs.v3s().rtClamp=5;});await wait(2);
 ok(await p.evaluate(()=>{const o=__gs.rtOpts();return o.bounces===2&&o.clampL===5;}),'bounces and the firefly clamp reach the tracer');
 ok(!errs.length,'no page errors '+[...new Set(errs)].slice(0,3).join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
