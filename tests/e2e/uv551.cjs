/* 0.55.1: re-rolling shows a real progress bar with Stop and never freezes the app; hovering the UV picture shows a bigger one. */
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
 await p.evaluate(async()=>{const G=__gs,m=G.primMesh('sphere',2),src=Object.assign({},m,{noUV:true});const nm=await G.uvRunUnwrap(src,{seed:1},true);G.bakeSetModel('low',nm);G.uvw.open=true;G.buildBakePanel();});await p.waitForTimeout(600);
 // ---- the dice roll: progress, small gaps
 const r=await p.evaluate(async()=>{const G=__gs;let last=performance.now(),mx=0,on=true;const tick=()=>{const n=performance.now();mx=Math.max(mx,n-last);last=n;if(on)setTimeout(tick,0);};tick();
   const seen=new Set();const iv=setInterval(()=>{const lb=document.getElementById('loadBox');if(lb&&!lb.hidden){seen.add(lb.querySelector('.lb-bar>div').style.width);}},50);
   const stop=!!document.querySelector('#loadBox .lb-x');await G.uvRoll();clearInterval(iv);on=false;return {gal:G.uvw.gal.length,steps:seen.size,maxGap:Math.round(mx),hiddenAfter:document.getElementById('loadBox').hidden};});
 ok(r.gal===12,'the dice roll still makes 12 layouts');
 ok(r.steps>=3,'the progress bar moves in steps while rolling ('+r.steps+' different widths)');
 ok(r.maxGap<900,'the app stays alive while rolling (longest freeze '+r.maxGap+' ms)');
 ok(r.hiddenAfter,'the bar goes away afterwards');
 // ---- Stop
 await p.evaluate(()=>{__gs.uvw.gal=[];__gs.buildBakePanel();});
 const st=await p.evaluate(async()=>{const G=__gs;const pr=G.uvRoll();await new Promise(r=>setTimeout(r,500));const btn=document.querySelector('#loadBox .lb-x');const had=!!btn&&!btn.hidden;if(btn)btn.click();await pr;return {had,gal:G.uvw.gal.length,busy:G.uvw.busy};});
 ok(st.had,'a Stop button shows under the bar');ok(st.gal<12&&!st.busy,'Stop gives up early and frees the buttons ('+st.gal+' layouts kept)');
 // ---- Re-roll with the bar
 const rr=await p.evaluate(async()=>{const G=__gs;const seen=new Set();const iv=setInterval(()=>{const lb=document.getElementById('loadBox');if(lb&&!lb.hidden)seen.add(lb.querySelector('.lb-bar>div').style.width+'|'+lb.querySelector('.lb-bar').classList.contains('busy'));},20);const s0=G.bakeCfg.low.uwOpt.seed;await G.uvAct('reroll');clearInterval(iv);return {seed:G.bakeCfg.low.uwOpt.seed,s0,seen:[...seen]};});
 ok(rr.seed!==rr.s0,'Re-roll still makes a new layout');ok(rr.seen.length>=1&&rr.seen.every(x=>x.endsWith('|false')),'and its bar shows real progress, not a plain moving stripe');
 // ---- hover
 await p.evaluate(()=>{__gs.uvw.open=true;__gs.buildBakePanel();});await p.waitForTimeout(500);
 const small=await p.evaluate(()=>{const c=document.getElementById('uvPrev'),b=c.getBoundingClientRect();return {w:b.width,x:b.x+b.width/2,y:b.y+b.height/2};});
 await p.mouse.move(small.x,small.y);await p.waitForTimeout(900);
 const big=await p.evaluate(()=>{const e=document.getElementById('uvBig');if(!e||e.hidden)return null;const c=e.querySelector('canvas').getBoundingClientRect();let nz=0;const cv=e.querySelector('canvas'),d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;for(let i=0;i<d.length;i+=4*97)if(d[i]!==23)nz++;return {w:c.width,cap:e.querySelector('.uvbigcap').textContent,nz};});
 ok(big&&big.w>=small.w*1.6,'hovering the UV picture shows a bigger one ('+(big&&Math.round(big.w))+' px vs '+Math.round(small.w)+' px)');
 ok(big&&big.nz>50&&/island/.test(big.cap),'it shows the islands and the numbers ('+(big&&big.cap)+')');
 await p.mouse.move(5,5);await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.getElementById('uvBig').hidden),'and goes away when the pointer leaves');
 ok(!errs.length,'no errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
