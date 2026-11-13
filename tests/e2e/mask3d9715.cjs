/* 0.97.15 (Kenn): a black mask on the bottom layer must not make the model vanish: a plain base material shows */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const fs=require('fs'),{execSync}=require('child_process');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await(await b.newContext({viewport:{width:1500,height:950}})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(3500);
const mean=async()=>{const buf=await p.screenshot({clip:{x:60,y:120,width:560,height:460}});fs.writeFileSync('/tmp/m.png',buf);return +execSync("python3 -I -c \"from PIL import Image;import numpy as np;print(np.asarray(Image.open('/tmp/m.png').convert('L'),dtype=float).mean())\"").toString();};
const before=await mean();
await p.evaluate(()=>{const G=__gs;const B=G.allLayers().find(l=>l.fill);G.selectOnly(B);G.cmdAddMask(0);G.renderLayers();});await p.waitForTimeout(1500);
const after=await mean();
console.log('brightness before',before.toFixed(1),'after black mask',after.toFixed(1));
ok(after>before*0.55,'the model is still there after a black mask on the base material');
/* the grey base is not black: sample pixels in the model area */
ok(after>45,'it shows a grey material, not the empty background');
ok(errs.length===0,'no page errors '+errs.join('|'));
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
