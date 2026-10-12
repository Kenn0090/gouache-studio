/* 0.60: Photo tab lens distortion, colour fringing, clipping warning */
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
 await p.evaluate(async()=>{const c=new OffscreenCanvas(300,200),x=c.getContext('2d');x.fillStyle='#000000';x.fillRect(0,0,300,200);x.fillStyle='#ffffff';x.fillRect(240,60,40,80);x.fillStyle='#808080';x.fillRect(20,20,200,20);
  await __gs.phAddFiles([new File([await c.convertToBlob({type:'image/png'})],'l.png',{type:'image/png'})]);});await p.waitForTimeout(1000);
 const px=async(x,y)=>p.evaluate(([x,y])=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out),W=__gs.ph.out.w,i=(y*W+x)*4;return [d[i],d[i+1],d[i+2]];},[x,y]);
 const row=async(y)=>p.evaluate(y=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out),W=__gs.ph.out.w;const r=[];for(let x=0;x<W;x++)r.push(d[(y*W+x)*4+1]);return r;},y);
 // grey bar's right end moves with distortion
 const edge=r=>{let k=0;for(let x=0;x<r.length;x++)if(r[x]>60)k=x;return k;};
 const e0=edge(await row(30));await p.evaluate(()=>__gs.phSet('geo.dist',60));await p.waitForTimeout(300);const e1=edge(await row(30));
 ok(Math.abs(e1-e0)>=4,'lens distortion bends the picture ('+e0+' → '+e1+')');
 await p.evaluate(()=>__gs.phSet('geo.dist',0));await p.waitForTimeout(200);
 // colour fringing: the white block's edge gets a colour fringe
 const f0=await px(238,100);await p.evaluate(()=>__gs.phSet('geo.ca',100));await p.waitForTimeout(300);
 let diff=0;for(let x=232;x<250;x++){const c=await px(x,100);diff=Math.max(diff,Math.abs(c[0]-c[1]));}
 ok(diff>20,'colour fringing pulls red and blue apart at an edge (max R−G '+diff+')');
 await p.evaluate(()=>__gs.phSet('geo.ca',0));
 // clipping warning
 const w0=await px(260,100);ok(w0[0]>250&&w0[1]>250,'the white block is white');
 await p.keyboard.press('j');await p.waitForTimeout(300);const w1=await px(260,100),d1=await px(5,5);
 ok(w1[0]>200&&w1[1]<60,'J marks clipped highlights red '+w1);ok(d1[2]>200&&d1[0]<60,'and clipped shadows blue '+d1);
 await p.keyboard.press('j');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
