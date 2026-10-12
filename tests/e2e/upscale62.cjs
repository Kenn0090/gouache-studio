/* 0.62: AI upscaler (Real-ESRGAN): 2×, 4×, 8× on real pictures, the Paint, Convert and Photo-export entry points, size limits */
const {chromium}=require('playwright');const env=require('./ai-env.cjs');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 if(!env.haveUp()){console.log('SKIP no upscaler model files');return;}
 const {srv,url}=await env.start();
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{try{localStorage.setItem('gs.prefs',JSON.stringify({aiDevice:'cpu'}));}catch(e){}});
 await p.goto(url+'/?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 ok(await p.evaluate(()=>__gs.aiUpBest(1000,1000,4096)===4&&__gs.aiUpBest(600,600,4096)===4&&__gs.aiUpBest(500,500,4096)===8&&__gs.aiUpBest(3000,3000,4096)===0&&!__gs.aiUpSize(1000,1000,8,4096).ok),'the size rules know what fits');
 // without the add-on the box offers the download
 await p.evaluate(()=>{window.__box=__gs.aiUpBox({size:[100,80],max:4096,scale:4,crop:async n=>({w:n,h:n,data:new Uint8ClampedArray(n*n*4)})});document.body.append(window.__box.el);});
 ok(await p.evaluate(()=>!!document.getElementById('aiUpGet')&&/becomes 400 × 320/.test(document.getElementById('aiUpNote').textContent)),'the box shows the new size and a download button when the add-on is missing');
 await p.evaluate(()=>window.__box.el.remove());
 await p.evaluate(async()=>{__gs.AI.urlFix=(u,f)=>location.origin+'/aimodels/'+f.n;await __gs.aiInstall('engine');await __gs.aiInstall('upscale');});
 ok(await p.evaluate(()=>__gs.AI.have.upscale),'the upscaler installs (checksums match)');
 // a small picture with a gradient, an edge and some alpha
 const mk=`(()=>{const w=24,h=16,d=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;d[i]=x*10;d[i+1]=y*14;d[i+2]=x<12?200:40;d[i+3]=(x<3)?120:255;}return {w,h,data:d};})()`;
 for(const s of [2,4,8]){
  const r=await p.evaluate(async([s,mk])=>{const img=eval(mk),t=Date.now(),o=await __gs.aiUpscale(img,s,{strength:100});let sum=0,n=0,a0=0,a1=0,bad=0;for(let i=0;i<o.data.length;i+=4){sum+=o.data[i]+o.data[i+1]+o.data[i+2];n+=3;}
    for(let y=0;y<o.h;y++){a0+=o.data[(y*o.w+1)*4+3];a1+=o.data[(y*o.w+o.w-2)*4+3];}
    let m0=0;for(let i=0;i<img.data.length;i+=4)m0+=img.data[i]+img.data[i+1]+img.data[i+2];return {w:o.w,h:o.h,mean:sum/n,src:m0/(img.w*img.h*3),a0:a0/o.h,a1:a1/o.h,ms:Date.now()-t};},[s,mk]);
  ok(r.w===24*s&&r.h===16*s,'×'+s+' makes '+r.w+' × '+r.h+' ('+r.ms+' ms)');
  ok(Math.abs(r.mean-r.src)<30,'×'+s+' keeps the picture\'s overall brightness ('+r.mean.toFixed(1)+' vs '+r.src.toFixed(1)+')');
  ok(Math.abs(r.a0-120)<12&&r.a1>250,'×'+s+' keeps the see-through edge ('+r.a0.toFixed(0)+' / '+r.a1.toFixed(0)+')');}
 // AI detail 0 is the plain enlargement (smooth)
 const sm=await p.evaluate(async mk=>{const img=eval(mk),o=await __gs.aiUpscale(img,2,{strength:0});let rough=0;for(let x=1;x<o.w-1;x++){const i=(5*o.w+x)*4;rough+=Math.abs(o.data[i]*2-o.data[i-4]-o.data[i+4]);}return rough/o.w;},mk);
 ok(sm<8,'AI detail 0 gives a smooth enlargement ('+sm.toFixed(2)+')');
 // a stop request ends it
 ok(await p.evaluate(async mk=>{try{await __gs.aiUpscale(eval(mk),2,{stop:()=>true});return false;}catch(e){return /Stopped/.test(e.message);}},mk),'Stop ends the job');
 // Paint: Image › Upscale makes a new tab twice as big
 await p.evaluate(()=>__gs.newDoc(40,30,8,[1,1,1],'Up',false));await p.waitForTimeout(250);
 await p.evaluate(()=>__gs.act('clouds'));await p.waitForTimeout(300);await p.click('#dlgOk').catch(()=>{});await p.waitForTimeout(300);
 await p.evaluate(()=>__gs.aiPaintUpscale());await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!!document.getElementById('aiUpScale')&&/80 × 60/.test(document.getElementById('aiUpNote').textContent)||/160 × 120/.test(document.getElementById('aiUpNote').textContent)),'the Paint window shows the new size');
 await p.selectOption('#aiUpScale','2');await p.waitForTimeout(200);
 await p.click('#aiUpPrev');await p.waitForFunction(()=>document.getElementById('aiUpAft').width>0,null,{timeout:60000});
 ok(await p.evaluate(()=>document.getElementById('aiUpAft').width>=40&&/AI upscale/.test(document.getElementById('aiUpPNote').textContent)),'the preview shows before and after');
 await p.click('#dlgOk');await p.waitForFunction(()=>__gs.doc.w===80,null,{timeout:60000}).catch(()=>{});
 ok(await p.evaluate(()=>__gs.doc.w===80&&__gs.doc.h===60&&/×2/.test(__gs.doc.name||'')),'a new tab opens at 80 × 60 ('+await p.evaluate(()=>__gs.doc.w+'×'+__gs.doc.h+' '+__gs.doc.name)+')');
 // Convert: source swapped for a bigger one
 await p.evaluate(()=>__gs.newDoc(32,32,8,[1,1,1],'Cv',false));await p.waitForTimeout(250);
 await p.evaluate(()=>__gs.act('clouds'));await p.waitForTimeout(300);await p.click('#dlgOk').catch(()=>{});await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=convert]');await p.waitForTimeout(1200);
 ok(await p.evaluate(()=>!!document.getElementById('cvUpscale')),'the Convert tab has Upscale (AI)…');
 await p.evaluate(()=>__gs.cvAiUpscale());await p.waitForTimeout(400);await p.selectOption('#aiUpScale','2');await p.waitForTimeout(150);
 await p.click('#dlgOk');await p.waitForFunction(()=>__gs.cv.src&&__gs.cv.src.w===64,null,{timeout:60000}).catch(()=>{});
 ok(await p.evaluate(()=>__gs.cv.src&&__gs.cv.src.w===64&&__gs.doc.w===64),'the Convert source is now 64 × 64');
 // too big is refused up front
 await p.evaluate(()=>{window.__b2=__gs.aiUpBox({size:[3000,3000],max:4096,scale:2,crop:async n=>null});document.body.append(window.__b2.el);});
 ok(await p.evaluate(()=>/bigger than the 4096 px limit/.test(window.__b2.el.querySelector('#aiUpNote').textContent)),'a size over the limit is flagged');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();srv.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
