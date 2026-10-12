/* 0.60: Photo tab Spot removal */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));if(process.env.DBG)p.on('console',m=>console.log('C',m.text().slice(0,300)));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 await p.evaluate(async()=>{const c=new OffscreenCanvas(400,300),x=c.getContext('2d'),g=x.createLinearGradient(0,0,400,0);g.addColorStop(0,'#707070');g.addColorStop(1,'#909090');x.fillStyle=g;x.fillRect(0,0,400,300);x.fillStyle='#101010';x.beginPath();x.arc(200,150,9,0,7);x.fill();
  const blob=await c.convertToBlob({type:'image/png'});await __gs.phAddFiles([new File([blob],'s.png',{type:'image/png'})]);});await p.waitForTimeout(1000);
 const px=async(x,y)=>p.evaluate(([x,y])=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out),W=__gs.ph.out.w,i=(y*W+x)*4;return d[i];},[x,y]);
 const W=await p.evaluate(()=>__gs.ph.out.w),H=await p.evaluate(()=>__gs.ph.out.h);const cx=Math.round(W/2),cy=Math.round(H/2);
 const dark=await px(cx,cy);ok(dark<40,'the spot is dark to begin with ('+dark+')');
 await p.evaluate(([cx,cy])=>{__gs.phSpotTool(true);__gs.ph.sp.size=.045;__gs.phSpotAdd(cx,cy);},[cx,cy]);await p.waitForTimeout(400);
 const after=await px(cx,cy),around=await px(cx+Math.round(W*.1),cy);
 ok(after>100&&Math.abs(after-around)<25,'the spot is taken out ('+dark+' → '+after+', around it '+around+')');
 const q=await p.evaluate(()=>__gs.phSpots()[0]);ok(Math.hypot(q.sx-q.x,q.sy-q.y)>q.r*1.5,'it copies from a different place '+JSON.stringify([q.x,q.y,q.sx,q.sy].map(v=>+v.toFixed(2))));
 ok(await p.evaluate(()=>document.querySelectorAll('#xfOv .phlmh').length>=3),'handles show for the spot');
 await p.evaluate(()=>{__gs.phSpots()[0].op=0;__gs.phApply(__gs.phClone(__gs.phS()),'op');});await p.waitForTimeout(300);
 ok(await px(cx,cy)<40,'opacity 0 puts the spot back');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
