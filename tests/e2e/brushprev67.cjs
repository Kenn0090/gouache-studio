/* 0.67: the brush preview stays in view while the settings scroll, pops out into a window, and (in a window of its own) follows every change */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'bp',false));await p.waitForTimeout(300);
 await p.evaluate(()=>{__gs.showPanel('tool');});await p.waitForTimeout(500);
 const nz=sel=>p.evaluate(s=>{const c=document.querySelector(s);if(!c||!c.width)return -1;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)n++;return n;},sel);
 ok(await p.evaluate(()=>!!document.getElementById('prevPop')),'the preview has a pop-out button');
 ok(await nz('#brushPrev')>100,'the preview shows a stroke ('+await nz('#brushPrev')+' px)');
 // it stays in view while the settings scroll
 await p.evaluate(()=>{const sc=document.querySelector('.prevwrap').closest('.dkbody');sc.scrollTop=sc.scrollHeight;});await p.waitForTimeout(300);
 const st=await p.evaluate(()=>{const sc=document.querySelector('.prevwrap').closest('.dkbody');return {scr:sc.scrollTop,pv:document.querySelector('.prevwrap').getBoundingClientRect().top,sc:sc.getBoundingClientRect().top};});
 ok(st.scr>30&&Math.abs(st.pv-st.sc)<10,'when the settings scroll the preview stays at the top of the panel (scrolled '+st.scr+'px, preview '+Math.round(st.pv-st.sc)+'px from the top)');
 // pop out
 await p.click('#prevPop');await p.waitForTimeout(500);
 ok(await p.evaluate(()=>!!document.getElementById('prevFloat')&&document.getElementById('brushPrevFloat').width>100),'the pop-out opens a preview window');
 const a=await nz('#brushPrevFloat');ok(a>100,'it shows the stroke ('+a+' px)');
 await p.evaluate(()=>{__gs.brush.size=90;__gs.brush.hardness=.2;__gs.brushEdited('size');});await p.waitForTimeout(500);
 const a2=await nz('#brushPrevFloat'),m2=await nz('#brushPrev');ok(a2!==a&&m2>0,'changing the brush redraws both previews ('+a+' → '+a2+')');
 // move and resize
 const hd=await p.locator('#prevFloat .pfhead').boundingBox();const r0=await p.locator('#prevFloat').boundingBox();
 await p.mouse.move(hd.x+40,hd.y+10);await p.mouse.down();await p.mouse.move(hd.x+240,hd.y+110,{steps:6});await p.mouse.up();
 const r1=await p.locator('#prevFloat').boundingBox();ok(Math.abs(r1.x-r0.x-200)<6&&Math.abs(r1.y-r0.y-100)<6,'the window can be moved by its title bar');
 ok(await p.evaluate(()=>getComputedStyle(document.getElementById('prevFloat')).resize==='both'),'and resized by its corner');
 ok(await p.evaluate(()=>!!JSON.parse(localStorage.getItem('gs.prevFloat')||'null')),'its place is remembered');
 // its own window
 const [pop]=await Promise.all([ctx.waitForEvent('page'),p.click('#prevOwn')]);await pop.waitForTimeout(800);await p.waitForTimeout(500);
 ok(await p.evaluate(()=>!document.getElementById('prevFloat')),'the in-page window closes when it moves to its own window');
 const wn=await pop.evaluate(()=>{const c=document.getElementById('brushPrevWin');if(!c||!c.width)return -1;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)n++;return n;});
 ok(wn>100,'the window of its own shows the stroke ('+wn+' px)');
 await p.evaluate(()=>{__gs.brush.size=20;__gs.brushEdited('size');});await p.waitForTimeout(600);
 const wn2=await pop.evaluate(()=>{const c=document.getElementById('brushPrevWin'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)n++;return n;});
 ok(wn2!==wn,'and follows changes ('+wn+' → '+wn2+')');
 await pop.close();await p.waitForTimeout(400);
 await p.click('#prevPop');await p.waitForTimeout(400);await p.click('#prevFloatX');await p.waitForTimeout(300);ok(await p.evaluate(()=>!document.getElementById('prevFloat')),'× closes the preview window');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
