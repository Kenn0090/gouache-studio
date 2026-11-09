/* 0.96.1 (Kenn): Gradient map with a preset grid, stop editor, saving, blend/steps, input range, strength, pick from the picture; compact sharp Levels */
const {chromium}=require('playwright'),path=require('path');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1400,height:900},deviceScaleFactor:2});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.removeItem('gs.gradPresets');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);const W=ms=>p.waitForTimeout(ms||300);
 /* a left-to-right grey ramp to map */
 await p.evaluate(()=>{const G=__gs;G.newDoc(256,64,8,[1,1,1],'gm',false);const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,256,0);g.addColorStop(0,'#000');g.addColorStop(1,'#fff');x.fillStyle=g;x.fillRect(0,0,256,64);
   const d=x.getImageData(0,0,256,64).data,L=G.doc.active,tex=G.uploadStraight({w:256,h:64,data:d,bits:8});G.premultInto(L.target,tex,[0,0],null);G.requestRender(true);});await W(500);
 const row=()=>p.evaluate(()=>{const G=__gs,L=G.doc.active,d=G.captureRegionNow(G.previewTarget?G.previewTarget():G.mapT(L,'base'),0,32,256,1).data;return Array.from(d);});
 await p.evaluate(()=>__gs.act('gradMap'));await W(800);
 ok(await p.locator('#gmGrid .gmtile').count()>10,'the Gradient map shows a grid of gradient previews ('+await p.locator('#gmGrid .gmtile').count()+')');
 await p.screenshot({path:OLD+'out/gm961.png',clip:await (await p.locator('#modal .dialog').boundingBox())});
 /* click a preset: the strip follows */
 const bg0=await p.$eval('#gmStrip',e=>e.style.background);await p.locator('#gmGrid .gmtile').nth(5).click();await W(300);
 ok(await p.$eval('#gmStrip',e=>e.style.background)!==bg0&&await p.locator('#gmGrid .gmtile.on').count()===1,'clicking a preview uses it and marks it');
 /* add a stop by clicking under the strip */
 const n0=await p.locator('#gmStops .gstop').count();const sb=await p.locator('#gmStops').boundingBox();await p.mouse.click(sb.x+sb.width*.33,sb.y+sb.height/2);await W(200);
 ok(await p.locator('#gmStops .gstop').count()===n0+1,'clicking under the strip adds a colour stop');
 /* save as new: shared with the Gradient tool */
 await p.fill('#gmName','Kenn test');await p.click('#gmSave');await W(300);
 ok(await p.evaluate(()=>__gs.userGrads().some(g=>g.name==='Kenn test')),'Save as new keeps it with the Gradient tool’s gradients');
 ok(await p.locator('#gmGrid .gmtile.user').count()===1,'the saved one shows in the grid');
 await p.click('#gmEven');await W(200);ok(await p.isVisible('#gmUpdate'),'after a change, Update appears for the saved gradient');
 await p.click('#gmUpdate');await W(200);ok(!(await p.isVisible('#gmUpdate')),'Update saves the change');
 /* colour maths: steps and hard blend */
 const st=await p.evaluate(()=>{const G=__gs,d={stops:[{p:0,c:[0,0,0]},{p:.5,c:[1,0,0]},{p:1,c:[1,1,1]}],alphas:[{p:0,a:1},{p:1,a:1}],method:'perceptual',reverse:false,dither:false};
   const v={def:d,blend:'smooth',steps:4,inLo:0,inHi:1,str:1},seen=new Set();for(let i=0;i<=100;i++)seen.add(G.gmColourAt(v,i/100).slice(0,3).map(x=>x.toFixed(3)).join());
   const h={def:d,blend:'hard',steps:0,inLo:0,inHi:1,str:1},hs=new Set();for(let i=0;i<=100;i++)hs.add(G.gmColourAt(h,i/100).slice(0,3).map(x=>x.toFixed(3)).join());
   const r={def:d,blend:'smooth',steps:0,inLo:.4,inHi:.6,str:1};return {steps:seen.size,hard:hs.size,lo:G.gmColourAt(r,.3)[0],hi:G.gmColourAt(r,.7)[0]};});
 ok(st.steps===4,'Steps 4 gives 4 flat bands ('+st.steps+')');ok(st.hard===3,'Hard blending gives one band per stop ('+st.hard+')');
 ok(st.lo===0&&st.hi===1,'the input range clamps below and above it');
 /* the dialog previews: Strength 0 leaves the picture */
 const prev=()=>p.evaluate(()=>{const G=__gs;G.requestRender(true);return null;});
 /* pick from the picture: drag a line across the ramp */
 const cb=await p.locator('#gl').boundingBox();
 await p.click('#gmPick');await W(200);ok(await p.isVisible('#gmPickOv'),'Pick from picture covers the screen for the line');
 const a=await p.evaluate(()=>{const G=__gs,s=G.toScreen?G.toScreen(10,32):null;return s;});
 const pts=await p.evaluate(()=>{const G=__gs,r=document.getElementById('stage').getBoundingClientRect();const v=G.view;return [r.left+v.x+20*v.zoom,r.top+v.y+32*v.zoom,r.left+v.x+236*v.zoom,r.top+v.y+32*v.zoom];});
 await p.mouse.move(pts[0],pts[1]);await p.mouse.down();await p.mouse.move(pts[2],pts[3],{steps:6});await p.mouse.up();await W(400);
 const stops=await p.evaluate(()=>{const dlg=document.getElementById('gmStops');return dlg.querySelectorAll('.gstop').length;});
 const lum=await p.$$eval('#gmStops .gstop',bs=>bs.map(b=>getComputedStyle(b).backgroundColor));
 ok(stops>=4&&!(await p.isVisible('#gmPickOv')),'the line’s colours become the stops ('+stops+': '+lum.slice(0,3).join(' ')+'…)');
 await p.click('#dlgCancel');await W(300);
 /* Levels */
 await p.evaluate(()=>{try{localStorage.setItem('gs.lvMode','simple');}catch(e){}__gs.act('levels');});await W(800);
 const lv=await p.$eval('.lvsimple',c=>({w:c.width,cw:c.getBoundingClientRect().width,h:c.getBoundingClientRect().height}));
 ok(lv.w>=Math.round(lv.cw*2)-1,'Levels is drawn at the screen’s real pixel size ('+lv.w+' px for '+Math.round(lv.cw)+' on screen)');
 ok(lv.h<=100,'Levels is shorter ('+Math.round(lv.h)+' px high)');
 await p.fill('#lvNIb','40');await p.press('#lvNIb','Enter');await W(200);
 ok(await p.$eval('#lvNIb',i=>i.value)==='40','the number boxes set the handles');
 await p.screenshot({path:OLD+'out/lv961.png',clip:await (await p.locator('#modal .dialog').boundingBox())});
 await p.click('#dlgCancel');
 ok(!errs.length,'no errors '+errs.join('|'));await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);})();
