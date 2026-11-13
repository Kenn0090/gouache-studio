/* 0.97.10 (Kenn: "it's just not generating the normal map"): the normal-map shader's "pad height" switch is set by 3D Paint and stayed on, so the Convert tab made a flat map afterwards */
const {chromium}=require('playwright'),path=require('path'),fs=require('fs');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await(await b.newContext({viewport:{width:1500,height:950}})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
/* a small noisy picture as a PNG made in the page */
await p.click('#modeTabs [data-mode=convert]');await p.waitForTimeout(1200);
/* switch the normal shader's "pad height" on, the way 3D Paint leaves it */
await p.evaluate(()=>__gs.stickPad());
const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click('#cvLoad')]);
const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');for(let i=0;i<900;i++){const g=Math.random()*255|0;x.fillStyle='rgb('+g+','+g+','+g+')';x.fillRect(Math.random()*128,Math.random()*128,6,6);}return c.toDataURL('image/png').split(',')[1];});
fs.writeFileSync('/tmp/nrm_in.png',Buffer.from(png,'base64'));await fc.setFiles('/tmp/nrm_in.png');await p.waitForTimeout(4000);
const spread=await p.evaluate(()=>__gs.cvNormalSpread());
ok(spread>.02,'the converted normal map has relief even when 3D Paint left the switch on (spread '+spread.toFixed(3)+')');
ok(errs.length===0,'no page errors '+errs.join('|'));
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
