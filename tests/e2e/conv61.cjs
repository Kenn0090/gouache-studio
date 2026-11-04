/* 0.61: Convert tab: height from AI depth (real depth model) */
const {chromium}=require('playwright');const env=require('./ai-env.cjs');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 if(!env.haveAll()){console.log('SKIP no AI model files');return;}
 const {srv,url}=await env.start();
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{try{localStorage.setItem('gs.prefs',JSON.stringify({aiDevice:'cpu'}));}catch(e){}});
 await p.goto(url+'/?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.evaluate(async()=>{__gs.AI.urlFix=(u,f)=>location.origin+'/aimodels/'+f.n;await __gs.aiInstall('engine');await __gs.aiInstall('depth');});
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'Conv',false));await p.waitForTimeout(250);
 await p.evaluate(()=>__gs.act('clouds'));await p.waitForTimeout(400);await p.click('#dlgOk');await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=convert]');await p.waitForTimeout(1200);
 const sig=()=>p.evaluate(()=>{const t=__gs.cv.res.height;const d=__gs.readRGBA8(t);let h=0;for(let i=0;i<d.length;i+=40)h=(h*31+d[i])%1000003;return h;});
 const s0=await sig();
 ok(await p.evaluate(()=>!!document.getElementById('cvAiD')),'the Convert panel has the AI depth choice');
 await p.evaluate(()=>__gs.cvAiDepth(true));await p.waitForTimeout(1500);
 ok(await p.evaluate(()=>__gs.cv.aiDepth&&!!__gs.cv.cache.depthT),'the depth map is made');
 const s1=await sig();ok(s0!==s1,'the height map now comes from the depth');
 ok(await p.evaluate(()=>document.getElementById('cvAiD').checked),'the choice shows as on');
 await p.evaluate(()=>__gs.cvAiDepth(false));await p.waitForTimeout(800);const s2=await sig();ok(s2===s0,'turning it off brings the old height back');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();srv.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
