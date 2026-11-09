/* 0.96.2 (Kenn: herringbone on a shiny pistol, swirls on smooth skin): the final normal is built and shown with fine steps,
   baked normals are kept fine, and an 8-bit normal export gets a fine grain instead of contour lines */
const {chromium}=require('playwright'),path=require('path');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 const r=await p.evaluate(()=>{const G=__gs,d=G.doc;if(!d.maps.includes('height'))d.maps.push('height');
   /* a very gentle height ramp: in 8 bits its slope would round into bands */
   const L=G.doc.active,t=G.mapT?G.mapT(L,'height'):null;const n=G.normalComposite(false,null);const dep=n.depth;
   const ramp=new Float32Array(1000).map((_,i)=>.5+.3*Math.sin(i/160));const f=G.texDither(ramp.slice());let lev=new Set(),levD=new Set();
   for(let i=0;i<1000;i++){lev.add(Math.round(ramp[i]*255));}
   /* banding check: count runs where the rounded value stays the same for 20+ samples */
   const runs=a=>{let r=0,c=1;for(let i=1;i<a.length;i++){if(Math.round(a[i]*255)===Math.round(a[i-1]*255))c++;else{if(c>=20)r++;c=1;}}return r;};
   G.release&&G.release(n);return {dep,plain:runs(ramp),dith:runs(f),maxd:Math.max(...f.map((v,i)=>Math.abs(v-ramp[i])))*255};});
 ok(r.dep===16,'the final normal is built with fine (16-bit) steps ('+r.dep+')');
 ok(r.plain>=2&&r.dith===0,'an 8-bit normal export no longer forms long flat bands (plain '+r.plain+', with grain '+r.dith+')');
 ok(r.maxd<=1.0001,'the grain is at most one step ('+r.maxd.toFixed(2)+')');
 await p.evaluate(()=>{__gs.v3s().env='studio';__gs.requestRender(true);});for(let i=0;i<40;i++){if(await p.evaluate(()=>__gs.env.lv&&__gs.env.lv.length>0))break;await p.waitForTimeout(250);}
 const lv=await p.evaluate(()=>__gs.env.lv.map(t=>t.w+'x'+t.h));ok(lv.length&&lv.every(x=>+x.split('x')[0]>=64),'the blurry reflection levels are at least 64 wide (no blocky swirls at full roughness): '+lv.join(' '));
 ok(!errs.length,'no errors '+errs.join('|'));await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);})();
