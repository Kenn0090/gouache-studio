/* 0.61: AI selection in the Photo tab (real SlimSAM model; needs the model files, see ai-env.cjs) */
const {chromium}=require('playwright');const env=require('./ai-env.cjs');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 if(!env.have()){console.log('SKIP no AI model files');return;}
 const {srv,url}=await env.start();
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{try{localStorage.setItem('gs.prefs',JSON.stringify({aiDevice:'cpu'}));}catch(e){}});
 await p.goto(url+'/?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.evaluate(async()=>{__gs.AI.urlFix=(u,f)=>location.origin+'/aimodels/'+f.n;await __gs.aiInstall('engine');await __gs.aiInstall('sam');});
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 await p.evaluate(async()=>{const W=320,H=240,c=new OffscreenCanvas(W,H),x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,150);g.addColorStop(0,'#3a78d8');g.addColorStop(1,'#a8cdf4');x.fillStyle=g;x.fillRect(0,0,W,150);
   x.fillStyle='#3c7a30';x.fillRect(0,150,W,90);x.fillStyle='#d02020';x.beginPath();x.arc(110,170,34,0,7);x.fill();
   await __gs.phAddFiles([new File([await c.convertToBlob({type:'image/png'})],'s.png',{type:'image/png'})]);});await p.waitForTimeout(1200);
 const px=async(x,y)=>p.evaluate(([x,y])=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out),W=__gs.ph.out.w,i=(y*W+x)*4;return [d[i],d[i+1],d[i+2]];},[x,y]);
 const sky0=await px(160,30),ball0=await px(110,170),grass0=await px(250,210);
 ok(await p.evaluate(()=>!!document.getElementById('phs_ai')),'there is an AI tools section');
 await p.evaluate(()=>__gs.phAiSky());await p.waitForTimeout(800);
 ok(await p.evaluate(()=>__gs.phS().local.some(m=>m.type==='ai'&&m.name==='Sky')),'Select sky makes an AI mask');
 const sky1=await px(160,30),grass1=await px(250,210);
 console.log('maskvals',await p.evaluate(()=>{const a=Object.values(__gs.PH_AI)[0];const g=(x,y)=>a.data[Math.floor(y/240*a.h)*a.w+Math.floor(x/320*a.w)];return [g(160,30),g(250,210),g(250,160),g(100,175),g(300,148),g(10,200)];}));
 ok(Math.abs(sky1[2]-sky0[2])>12&&Math.abs(grass1[1]-grass0[1])<4,'it changes only the sky ('+sky0+' → '+sky1+', ground '+grass0+' → '+grass1+')');
 // pick the ball (the same picture is embedded again: a second run is only the decoder when kept)
 await p.evaluate(()=>{__gs.phS().local=[];});
 await p.evaluate(()=>__gs.phAiClick(110,170,{altKey:false}));await p.waitForTimeout(800);
 ok(await p.evaluate(()=>__gs.phS().local.length===1&&__gs.phS().local[0].name==='Subject'),'a click makes a Subject mask');
 await p.evaluate(()=>{const m=__gs.phS().local[0];m.adj={exp:1.5};__gs.phApply(__gs.phClone(__gs.phS()),'x');});await p.waitForTimeout(400);
 const ball1=await px(110,170),sky2=await px(160,30),grass2=await px(250,210);
 ok(ball1[0]>ball0[0]+25&&Math.abs(sky2[2]-sky0[2])<4&&Math.abs(grass2[1]-grass0[1])<4,'only the ball changes ('+ball0+' → '+ball1+')');
 // saved with the photo
 const pk=await p.evaluate(()=>{const q=__gs.phP();return Object.keys(__gs.PH_AI).length>0});ok(pk,'the mask picture is kept');
 await p.evaluate(()=>__gs.phSidecarFlush());
 ok(await p.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('gs.ph.')))).ai||{}).length)===1,'it is saved with the photo’s edits');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await p.screenshot({path:'/tmp/photo_ai.png'});
 await b.close();srv.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
