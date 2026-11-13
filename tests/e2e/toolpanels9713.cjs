/* 0.97.13 (Kenn): Smudge, Dodge, Burn, Heal and Clone settings use the folding groups, Simple / Advanced and search too */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await(await b.newContext({viewport:{width:1500,height:1000}})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3000);
await p.evaluate(()=>{__gs.closeWelcome&&__gs.closeWelcome();localStorage.removeItem('gs.brushAdv');});
for(const t of ['smudge','dodge','burn','heal','clone','brush']){
  await p.evaluate(t=>{__gs.setTool(t);__gs.showPanel('tool');},t);await p.waitForTimeout(500);
  const r=await p.evaluate(()=>({search:!!document.getElementById('brSearch'),mode:!!document.getElementById('brMode_simple'),groups:document.querySelectorAll('#brushBody .brgrp').length,size:!!document.getElementById('bSize'),reset:!!document.getElementById('brushReset')}));
  ok(r.search&&r.mode&&r.size,t+': search and Simple / Advanced are there, size stays on top ('+r.groups+' groups)');
}
/* a smudge-only setting stays findable through search */
await p.evaluate(()=>{__gs.setTool('smudge');__gs.showPanel('tool');});await p.waitForTimeout(400);
await p.fill('#brSearch','grain');await p.waitForTimeout(300);
ok(await p.evaluate(()=>{const e=document.getElementById('bGrain');return !!e&&e.offsetParent!==null}),'searching "grain" shows it in the smudge panel');
ok(errs.length===0,'no page errors '+errs.join('|'));
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
