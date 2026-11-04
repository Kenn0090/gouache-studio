/* 0.61: AI in the Paint tab: Select subject, Select sky, Remove selection (real models) */
const {chromium}=require('playwright');const env=require('./ai-env.cjs');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 if(!env.haveAll()){console.log('SKIP no AI model files');return;}
 const {srv,url}=await env.start();
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{try{localStorage.setItem('gs.prefs',JSON.stringify({aiDevice:'cpu'}));}catch(e){}});
 await p.goto(url+'/?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.evaluate(async()=>{__gs.AI.urlFix=(u,f)=>location.origin+'/aimodels/'+f.n;await __gs.aiInstall('engine');await __gs.aiInstall('sam');await __gs.aiInstall('lama');});
 await p.evaluate(()=>__gs.newDoc(320,240,8,[1,1,1],'AI',false));await p.waitForTimeout(300);
 await p.evaluate(async()=>{const W=320,H=240,c=new OffscreenCanvas(W,H),x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,150);g.addColorStop(0,'#3a78d8');g.addColorStop(1,'#a8cdf4');x.fillStyle=g;x.fillRect(0,0,W,150);
   const g2=x.createLinearGradient(0,150,W,H);g2.addColorStop(0,'#3c7a30');g2.addColorStop(1,'#5a9a40');x.fillStyle=g2;x.fillRect(0,150,W,90);x.fillStyle='#d02020';x.beginPath();x.arc(110,170,34,0,7);x.fill();
   const bm=await createImageBitmap(c),tex=__gs.uploadStraight({w:W,h:H,el:bm});__gs.premultInto(__gs.doc.active.target,tex,[0,0],null);__gs.requestRender(true);});await p.waitForTimeout(300);
 const selv=(x,y)=>p.evaluate(([x,y])=>{const d=__gs.readRGBA8(__gs.sel.t);return d[(y*__gs.doc.w+x)*4];},[x,y]);
 const lay=(x,y)=>p.evaluate(([x,y])=>{const d=__gs.readRGBA8(__gs.doc.active.target);const i=(y*__gs.doc.w+x)*4;return [d[i],d[i+1],d[i+2]];},[x,y]);
 ok(await p.evaluate(()=>[...document.querySelectorAll('#menus .mi,.menu .mi')].length>=0),'the app is ready');
 ok((await lay(110,170))[0]>180,'the ball is on the layer');
 await p.evaluate(()=>__gs.aiPaintSubject());ok(await p.evaluate(()=>__gs.aiPS.on),'Select subject waits for a click');
 await p.evaluate(()=>__gs.aiPaintClick({altKey:false},110,170));await p.waitForTimeout(800);
 ok((await selv(110,170))>200&&(await selv(280,30))<30&&(await selv(250,220))<30,'a click on the ball selects the ball only ('+await selv(110,170)+', '+await selv(280,30)+', '+await selv(250,220)+')');
 await p.keyboard.press('Escape');ok(!(await p.evaluate(()=>__gs.aiPS.on)),'Esc ends it');
 // remove the selection
 await p.evaluate(()=>__gs.aiPaintRemove());await p.waitForTimeout(800);
 const after=await lay(110,170);ok(after[0]<150&&after[1]>70,'Remove fills the ball with the grass ('+after+')');
 const far=await lay(40,40);ok(Math.abs(far[2]-216)<30,'the rest is untouched ('+far+')');
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(400);ok((await lay(110,170))[0]>180,'Undo brings the ball back');
 // the sky
 await p.evaluate(()=>__gs.aiPaintSky());await p.waitForTimeout(800);
 ok((await selv(160,30))>200&&(await selv(160,200))<30,'Select sky selects the sky ('+await selv(160,30)+', '+await selv(160,200)+')');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();srv.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
