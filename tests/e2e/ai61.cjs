/* 0.61: AI add-ons: install from a local copy of the files, then pick an object and the sky with the real SlimSAM model */
const {chromium}=require('playwright');const env=require('./ai-env.cjs');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 if(!env.have()){console.log('SKIP no AI model files in '+(process.env.AI_DIR||'/tmp/aimodels'));return;}
 const {srv,url}=await env.start();
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));if(process.env.DBG)p.on('console',m=>console.log('C',m.text().slice(0,300)));
 await p.addInitScript(()=>{try{localStorage.setItem('gs.prefs',JSON.stringify({aiDevice:'cpu'}));}catch(e){}});
 await p.goto(url+'/?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 ok(await p.evaluate(()=>!__gs.AI.have.engine&&!__gs.AI.have.sam),'nothing is installed to begin with');
 await p.evaluate(()=>{__gs.AI.urlFix=(u,f)=>location.origin+'/aimodels/'+f.n;});
 await p.evaluate(async()=>{await __gs.aiInstall('engine');await __gs.aiInstall('sam');});
 ok(await p.evaluate(()=>__gs.AI.have.engine&&__gs.AI.have.sam&&!__gs.AI.have.lama),'the engine and the selection model install');
 await p.evaluate(()=>{__gs.AI.have={};});await p.evaluate(()=>__gs.aiRefresh());
 ok(await p.evaluate(()=>__gs.AI.have.engine&&__gs.AI.have.sam),'they are found again after a refresh');
 // the add-ons window
 await p.evaluate(()=>__gs.dlgAddons());await p.waitForSelector('.airow',{timeout:30000});await p.waitForTimeout(300);
 ok((await p.evaluate(()=>document.querySelectorAll('.airow').length))===5,'the add-ons window lists the five parts');
 ok((await p.evaluate(()=>document.querySelectorAll('.airow.on').length))===2,'two of them show as installed');
 await p.screenshot({path:'/tmp/ai_window.png'});await p.click('#dlgCancel');
 // a picture: sky on top, grass below, a red ball
 const r=await p.evaluate(async()=>{const W=320,H=240,c=new OffscreenCanvas(W,H),x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,150);g.addColorStop(0,'#3a78d8');g.addColorStop(1,'#a8cdf4');x.fillStyle=g;x.fillRect(0,0,W,150);x.fillStyle='#e8f0fa';x.beginPath();x.ellipse(220,50,40,14,0,0,7);x.fill();
   x.fillStyle='#3c7a30';x.fillRect(0,150,W,90);x.fillStyle='#d02020';x.beginPath();x.arc(110,170,34,0,7);x.fill();
   const im=x.getImageData(0,0,W,H),img={w:W,h:H,data:im.data};
   const t0=performance.now(),E=await __gs.aiSamEmbed(img),t1=performance.now();
   const m=await __gs.aiSamMask(E,[{x:110,y:170,pos:true}],W,H),t2=performance.now();
   let inside=0,inN=0,outside=0,outN=0;for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){const d=Math.hypot(xx-110,y-170),v=m.data[y*W+xx]>127;if(d<30){inN++;if(v)inside++;}else if(d>40){outN++;if(v)outside++;}}
   const sky=__gs.aiSkyGuess(img);let skyIn=0,skyN=0,skyOut=0,skyOutN=0,ms=null;
   if(sky){const m2=await __gs.aiSamMask(E,sky.points,W,H);ms=m2;for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){const v=m2.data[y*W+xx]>127;if(y<140){skyN++;if(v)skyIn++;}else if(y>160){skyOutN++;if(v)skyOut++;}}}
   return {ep:__gs.AI.lastEp,embedMs:Math.round(t1-t0),maskMs:Math.round(t2-t1),inside:inside/inN,outside:outside/outN,sky:!!sky,pts:sky&&sky.points.length,skyIn:skyIn/Math.max(1,skyN),skyOut:skyOut/Math.max(1,skyOutN)};});
 console.log(JSON.stringify(r));
 ok(r.inside>.9&&r.outside<.05,'a click on the ball selects the ball ('+r.inside.toFixed(2)+' inside, '+r.outside.toFixed(2)+' outside)');
 ok(r.sky&&r.skyIn>.9&&r.skyOut<.05,'Select sky finds the sky ('+r.skyIn.toFixed(2)+' of the sky, '+r.skyOut.toFixed(2)+' of the ground)');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();srv.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
