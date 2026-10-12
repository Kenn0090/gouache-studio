/* 0.60: Photo tab ratings, flags and filter */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 await p.evaluate(async()=>{const fs=[];for(let i=0;i<3;i++){const c=new OffscreenCanvas(100,80),x=c.getContext('2d');x.fillStyle='hsl('+i*100+',50%,50%)';x.fillRect(0,0,100,80);fs.push(new File([await c.convertToBlob({type:'image/png'})],'p'+i+'.png',{type:'image/png'}));}await __gs.phAddFiles(fs);});await p.waitForTimeout(1500);
 await p.keyboard.press('3');await p.waitForTimeout(100);
 ok(await p.evaluate(()=>__gs.phP().rating)===3,'key 3 gives three stars');
 ok((await p.textContent('.phthumb.on .phstars')).includes('★★★'),'the stars show on the thumbnail');
 await p.keyboard.press('ArrowRight');await p.waitForTimeout(600);await p.keyboard.press('x');await p.waitForTimeout(100);
 ok(await p.evaluate(()=>__gs.phP().flag)===-1,'X rejects the photo');
 await p.selectOption('#phFilter','r3');await p.waitForTimeout(200);
 ok(await p.evaluate(()=>document.querySelectorAll('.phthumb').length)===1,'the filter shows only 3 stars and up');
 await p.selectOption('#phFilter','rej');await p.waitForTimeout(200);
 ok(await p.evaluate(()=>document.querySelectorAll('.phthumb').length)===1,'the filter shows the rejected one');
 await p.selectOption('#phFilter','all');await p.waitForTimeout(200);
 ok(await p.evaluate(()=>document.querySelectorAll('.phthumb').length)===3,'All shows every photo');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
